import { isAllowedServerFetchUrl, isPublicTargetUrl } from '../shared/utils/public-url'

export const HEALTH_STATE_KEY = '__sink_monitor:v1'
export const BACKUP_CRON = '0 0 * * *'
export const HEALTH_CRONS = ['2,12,22,32,42,52 * * * *', '7,17,27,37,47,57 * * * *']

type CheckName = 'd1' | 'kv' | 'backup' | 'dns' | 'https' | 'analytics' | 'redirect' | 'target'
interface Check { name: CheckName, status: 'ok' | 'failed' | 'not-configured', code: string }
interface HealthEvent { type: 'incident' | 'recovered', at: string, failedChecks: CheckName[] }
export interface HealthState {
  version: 1
  checkedAt: string
  status: 'healthy' | 'degraded' | 'incident'
  checks: Check[]
  streaks: Partial<Record<CheckName, number>>
  incident: boolean
  lastAlertAt?: string
  events: HealthEvent[]
}
export interface HealthConfig {
  healthOrigin: string
  healthCanarySlug: string
  healthCanaryTarget: string
  serverFetchAllowedHosts: string
  cfAccountId: string
  cfApiToken: string
  dataset: string
  redirectStatusCode: string
}

function ownOrigin(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' || !isPublicTargetUrl(value) || url.port || url.pathname !== '/' || url.search || url.hash)
    throw new Error('invalid-health-origin')
  return url.origin
}

async function check(name: CheckName, run: () => Promise<boolean>, code: string): Promise<Check> {
  try {
    return { name, status: await run() ? 'ok' : 'failed', code }
  }
  catch {
    // Never retain provider errors, request headers or target URLs in reports/logs.
    return { name, status: 'failed', code }
  }
}

export function advanceHealthState(previous: HealthState | null, checks: Check[], now: number): { state: HealthState, notification?: HealthEvent } {
  const checkedAt = new Date(now).toISOString()
  const streaks: HealthState['streaks'] = {}
  for (const result of checks)
    streaks[result.name] = result.status === 'failed' ? Math.min((previous?.streaks[result.name] || 0) + 1, 1000) : 0
  const failedChecks = checks.filter(item => item.status === 'failed').map(item => item.name)
  const confirmed = failedChecks.some(name => streaks[name]! >= 2)
  // An incident only clears after every failing check has recovered.
  const incident = confirmed || (!!previous?.incident && failedChecks.length > 0)
  let notification: HealthEvent | undefined
  if (confirmed && (!previous?.incident || !previous.lastAlertAt || now - Date.parse(previous.lastAlertAt) >= 6 * 3600_000))
    notification = { type: 'incident', at: checkedAt, failedChecks }
  else if (previous?.incident && !incident)
    notification = { type: 'recovered', at: checkedAt, failedChecks: [] }
  const state: HealthState = {
    version: 1,
    checkedAt,
    status: incident ? 'incident' : failedChecks.length ? 'degraded' : 'healthy',
    checks,
    streaks,
    incident,
    lastAlertAt: notification ? checkedAt : previous?.lastAlertAt,
    events: [...(previous?.events || []), ...(notification ? [notification] : [])].slice(-20),
  }
  return { state, notification }
}

export async function readHealthState(env: Cloudflare.Env): Promise<HealthState | null> {
  const value = await env.KV.get<HealthState>(HEALTH_STATE_KEY, 'json')
  return value?.version === 1 && Array.isArray(value.checks) && Array.isArray(value.events) ? value : null
}

export async function runHealthMonitor(env: Cloudflare.Env, config: HealthConfig, fetcher: typeof fetch = fetch, now = Date.now()): Promise<HealthState> {
  const origin = ownOrigin(config.healthOrigin)
  const hostname = new URL(origin).hostname
  const request = (url: string, init: RequestInit = {}) => fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(8000) })
  let previous: HealthState | null = null
  const kv = await check('kv', async () => {
    previous = await readHealthState(env)
    return true
  }, 'kv-read')
  if (kv.status === 'failed')
    console.error({ event: 'health.state.read.failed' })
  const checks: Check[] = await Promise.all([
    check('d1', async () => {
      const result = await env.DB.prepare('SELECT 1 FROM links LIMIT 1').all()
      return result.success
    }, 'd1-schema-read'),
    Promise.resolve(kv),
    check('backup', async () => {
      if (!env.R2)
        return false
      const listed = await env.R2.list({ prefix: 'backups/links-', limit: 1000 })
      if (listed.truncated)
        return false
      const latest = listed.objects.filter(item => item.key.endsWith('.json')).sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())[0]
      return !!latest && now - latest.uploaded.getTime() <= 26 * 3600_000 && latest.uploaded.getTime() <= now + 60_000
    }, 'daily-backup-within-26h'),
    check('dns', async () => {
      const answers = await Promise.all(['A', 'AAAA'].map(async (type) => {
        const response = await request(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { accept: 'application/dns-json' } })
        if (!response.ok)
          return false
        const data = await response.json() as { Status?: number, Answer?: { type: number, data: string }[] }
        return data.Status === 0 && !!data.Answer?.some(answer => (answer.type === 1 || answer.type === 28) && isPublicTargetUrl(`https://${answer.type === 28 ? `[${answer.data}]` : answer.data}`))
      }))
      return answers.some(Boolean)
    }, 'public-dns'),
    check('https', async () => {
      const response = await request(origin, { method: 'HEAD' })
      await response.body?.cancel()
      return response.status === 200
    }, 'https-home-200'),
    check('analytics', async () => {
      if (!/^[a-f0-9]{32}$/.test(config.cfAccountId) || !/^[a-z0-9_]+$/.test(config.dataset) || !config.cfApiToken)
        return false
      const response = await request(`https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/analytics_engine/sql`, {
        method: 'POST',
        headers: { 'authorization': `Bearer ${config.cfApiToken}`, 'content-type': 'text/plain' },
        body: `SELECT count() AS visits FROM ${config.dataset} WHERE timestamp > NOW() - INTERVAL '10' MINUTE`,
      })
      if (!response.ok) {
        await response.body?.cancel()
        return false
      }
      const result = await response.json() as { data?: unknown[] }
      return Array.isArray(result.data)
    }, 'analytics-read'),
  ])

  if (config.healthCanarySlug && config.healthCanaryTarget) {
    checks.push(await check('redirect', async () => {
      if (!/^[\w-]{1,128}$/.test(config.healthCanarySlug) || !isPublicTargetUrl(config.healthCanaryTarget))
        return false
      const response = await fetcher(`${origin}/${config.healthCanarySlug}`, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000) })
      await response.body?.cancel()
      return response.status === Number(config.redirectStatusCode) && response.headers.get('location') === config.healthCanaryTarget
    }, 'canary-location'))
    checks.push(isAllowedServerFetchUrl(config.healthCanaryTarget, config.serverFetchAllowedHosts)
      ? await check('target', async () => {
          const response = await request(config.healthCanaryTarget, { method: 'HEAD' })
          await response.body?.cancel()
          return response.ok
        }, 'trusted-target-2xx-no-redirect')
      : { name: 'target', status: 'not-configured', code: 'trusted-target-required' })
  }
  else {
    checks.push({ name: 'redirect', status: 'not-configured', code: 'canary-required' }, { name: 'target', status: 'not-configured', code: 'canary-required' })
  }

  const { state, notification } = advanceHealthState(previous, checks, now)
  try {
    await env.KV.put(HEALTH_STATE_KEY, JSON.stringify(state), { expirationTtl: 7 * 86400 })
  }
  catch {
    // If the state store fails, the normal two-sample rule cannot work.
    console.error({ event: 'health.state.write.failed', checkedAt: state.checkedAt })
    throw new Error('Health state could not be saved')
  }
  if (notification?.type === 'incident')
    console.error({ event: 'health.incident', ...notification })
  else if (notification)
    console.info({ event: 'health.recovered', ...notification })
  console.info({ event: 'health.checked', checkedAt: state.checkedAt, status: state.status, checks: state.checks })
  return state
}
