import { afterEach, describe, expect, it, vi } from 'vitest'
import { advanceHealthState, HEALTH_STATE_KEY, runHealthMonitor, scheduledHealthSettings } from '../../monitoring/health'

const now = Date.parse('2026-10-16T04:00:00Z')
const config = {
  healthOrigin: 'https://sink.example.com',
  healthCanarySlug: '',
  healthCanaryTarget: '',
  serverFetchAllowedHosts: '',
  cfAccountId: '00000000000000000000000000000000',
  cfApiToken: 'private-analysis-token',
  dataset: 'sink_test',
  redirectStatusCode: '302',
}

function fixture() {
  let saved: string | null = null
  const dbRead = vi.fn().mockResolvedValue({ success: true, results: [] })
  const get = vi.fn(async () => saved ? JSON.parse(saved) : null)
  const put = vi.fn(async (_key: string, value: string) => {
    saved = value
  })
  const list = vi.fn().mockResolvedValue({ truncated: false, objects: [{ key: 'backups/links-latest.json', uploaded: new Date(now - 3600_000) }] })
  const env = { DB: { prepare: () => ({ all: dbRead }) }, KV: { get, put }, R2: { list } } as unknown as Cloudflare.Env
  const fetcher = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.includes('dns-query'))
      return Response.json({ Status: 0, Answer: [{ type: 1, data: '1.1.1.1' }] })
    if (url.includes('analytics_engine'))
      return Response.json({ data: [{ visits: '0' }] })
    return new Response(null, { status: 200 })
  })
  return { env, dbRead, get, put, list, fetcher }
}

afterEach(() => vi.restoreAllMocks())

describe('cloud health monitoring', () => {
  it('persists healthy dependencies and explicitly marks missing redirect coverage', async () => {
    const { env, put, fetcher } = fixture()
    const state = await runHealthMonitor(env, config, fetcher as typeof fetch, now)
    expect(state.status).toBe('healthy')
    expect(state.checks.filter(check => check.status === 'not-configured').map(check => check.name)).toEqual(['redirect', 'target'])
    expect(put).toHaveBeenCalledWith(HEALTH_STATE_KEY, expect.any(String), { expirationTtl: 604800 })
    expect(JSON.stringify(state)).not.toContain(config.cfApiToken)
    expect(fetcher.mock.calls.every(([, init]) => init?.redirect === 'manual')).toBe(true)
  })
  it('confirms the same failure twice and records recovery without repeated alerts', async () => {
    const { env, dbRead, fetcher } = fixture()
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const infoLog = vi.spyOn(console, 'info').mockImplementation(() => {})
    dbRead.mockRejectedValue(new Error('provider details and private credential'))
    expect((await runHealthMonitor(env, config, fetcher as typeof fetch, now)).status).toBe('degraded')
    expect(errorLog).not.toHaveBeenCalled()
    expect((await runHealthMonitor(env, config, fetcher as typeof fetch, now + 600_000)).status).toBe('incident')
    await runHealthMonitor(env, config, fetcher as typeof fetch, now + 1200_000)
    expect(errorLog).toHaveBeenCalledTimes(1)
    dbRead.mockResolvedValue({ success: true })
    const state = await runHealthMonitor(env, config, fetcher as typeof fetch, now + 1800_000)
    expect(state.events.map(event => event.type)).toEqual(['incident', 'recovered'])
    expect(state.status).toBe('healthy')
    expect(infoLog).toHaveBeenCalledWith(expect.objectContaining({ event: 'health.recovered' }))
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('private credential')
  })
  it('does not confirm unrelated alternating failures', () => {
    const a = advanceHealthState(null, [{ name: 'd1', status: 'failed', code: 'd1' }], now).state
    const b = advanceHealthState(a, [{ name: 'd1', status: 'ok', code: 'd1' }, { name: 'https', status: 'failed', code: 'https' }], now + 600_000)
    expect(b.state.status).toBe('degraded')
    expect(b.notification).toBeUndefined()
  })
  it('detects stale/missing backups and never accepts a truncated listing as complete', async () => {
    const { env, list, fetcher } = fixture()
    for (const value of [
      { objects: [], truncated: false },
      { objects: [{ key: 'backups/links-old.json', uploaded: new Date(now - 27 * 3600_000) }], truncated: false },
      { objects: [{ key: 'backups/links-new.json', uploaded: new Date(now) }], truncated: true },
    ]) {
      list.mockResolvedValue(value)
      const state = await runHealthMonitor(env, config, fetcher as typeof fetch, now)
      expect(state.checks.find(check => check.name === 'backup')?.status).toBe('failed')
    }
  })
  it('rejects unsafe origins before making any request', async () => {
    const { env, fetcher } = fixture()
    for (const healthOrigin of ['http://sink.example.com', 'https://127.0.0.1', 'https://user:password@sink.example.com', 'https://sink.example.com/private'])
      await expect(runHealthMonitor(env, { ...config, healthOrigin }, fetcher as typeof fetch, now)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('never follows a canary redirect or fetches its untrusted destination', async () => {
    const { env, fetcher } = fixture()
    const healthCanaryTarget = 'https://target.example.com/campaign?secret=query'
    fetcher.mockImplementation(async (url: string) => {
      if (url.endsWith('/health-canary'))
        return new Response(null, { status: 302, headers: { location: healthCanaryTarget } })
      if (url.includes('dns-query'))
        return Response.json({ Status: 0, Answer: [{ type: 1, data: '1.1.1.1' }] })
      return url.includes('analytics_engine') ? Response.json({ data: [] }) : new Response(null, { status: 200 })
    })
    const state = await runHealthMonitor(env, { ...config, healthCanarySlug: 'health-canary', healthCanaryTarget }, fetcher as typeof fetch, now)
    expect(state.checks.find(check => check.name === 'redirect')?.status).toBe('ok')
    expect(state.checks.find(check => check.name === 'target')?.status).toBe('not-configured')
    expect(fetcher.mock.calls.some(([url]) => url.startsWith('https://target.example.com'))).toBe(false)
    expect(JSON.stringify(state)).not.toContain('secret=query')
  })
  it('makes a lost state write visible to the existing error alert channel', async () => {
    const { env, put, fetcher } = fixture()
    put.mockRejectedValue(new Error('private provider failure'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(runHealthMonitor(env, config, fetcher as typeof fetch, now)).rejects.toThrow('Health state could not be saved')
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'health.state.write.failed' }))
    expect(JSON.stringify(log.mock.calls)).not.toContain('private provider failure')
  })
})

describe('scheduled backup routing', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('health schedules never trigger extra daily snapshots', async () => {
    let handler: (event: unknown) => Promise<void> = async () => {}
    const backup = vi.fn().mockResolvedValue({ completed: true })
    vi.stubGlobal('defineNitroPlugin', (fn: (app: unknown) => void) => fn({ hooks: { hook: (_name: string, fn: typeof handler) => {
      handler = fn
    } } }))
    vi.stubGlobal('useRuntimeConfig', () => ({ disableAutoBackup: false }))
    vi.stubGlobal('backupLinksToR2', backup)
    vi.resetModules()
    await import('../../server/plugins/backup')
    await handler({ controller: { cron: '2,12,22,32,42,52 * * * *' }, env: {} })
    expect(backup).not.toHaveBeenCalled()
    await handler({ controller: { cron: '0 0 * * *' }, env: {} })
    expect(backup).toHaveBeenCalledOnce()
  })
  it('incomplete scheduled snapshots become errors instead of silent skips', async () => {
    let handler: (event: unknown) => Promise<void> = async () => {}
    vi.stubGlobal('defineNitroPlugin', (fn: (app: unknown) => void) => fn({ hooks: { hook: (_name: string, fn: typeof handler) => {
      handler = fn
    } } }))
    vi.stubGlobal('useRuntimeConfig', () => ({ disableAutoBackup: false }))
    vi.stubGlobal('backupLinksToR2', vi.fn().mockResolvedValue({ completed: false, reason: 'migration-incomplete' }))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.resetModules()
    await import('../../server/plugins/backup')
    await expect(handler({ controller: { cron: '0 0 * * *' }, env: {} })).rejects.toThrow('Scheduled backup failed')
    expect(error).toHaveBeenCalledWith({ event: 'backup.scheduled.failed' })
  })
})

describe('scheduled runtime bindings', () => {
  it('uses current Worker bindings when the module-level fallback was disabled', () => {
    const result = scheduledHealthSettings({ NUXT_HEALTH_MONITORING: 'true', NUXT_HEALTH_ORIGIN: 'https://current.example.com', NUXT_CF_API_TOKEN: 'current-private-read-token' }, { ...config, healthMonitoring: false })
    expect(result.enabled).toBe(true)
    expect(result.config.healthOrigin).toBe('https://current.example.com')
    expect(result.config.cfApiToken).toBe('current-private-read-token')
    expect(scheduledHealthSettings({ NUXT_HEALTH_MONITORING: 'false' }, { ...config, healthMonitoring: true }).enabled).toBe(false)
  })
})
