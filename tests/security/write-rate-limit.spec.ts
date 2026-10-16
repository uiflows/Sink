import type { H3Event } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logLinkMutation } from '../../server/utils/link-audit'
import { enforceWriteRateLimit } from '../../server/utils/write-rate-limit'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function makeEvent(limiter?: unknown) {
  return ({
    node: { req: { headers: {} }, res: { setHeader: vi.fn() } },
    context: { userID: 'operator', authMethod: 'site-token', cloudflare: { env: { LINK_WRITE_LIMITER: limiter } } },
  }) as unknown as H3Event
}

describe('authenticated write controls', () => {
  it('fails closed when production requires a missing rate limiter', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ requireWriteRateLimit: true }))
    await expect(enforceWriteRateLimit(makeEvent())).rejects.toMatchObject({ statusCode: 503 })
  })
  it('rejects excessive writes and keeps tokens out of the limiter key', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ requireWriteRateLimit: true }))
    const limit = vi.fn().mockResolvedValue({ success: false })
    const event = makeEvent({ limit })
    await expect(enforceWriteRateLimit(event)).rejects.toMatchObject({ statusCode: 429 })
    expect(limit).toHaveBeenCalledWith({ key: 'api-write:operator' })
    expect(event.node.res.setHeader).toHaveBeenCalledWith('Retry-After', 60)
  })
  it('allows permitted writes', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ requireWriteRateLimit: true }))
    await expect(enforceWriteRateLimit(makeEvent({ limit: vi.fn().mockResolvedValue({ success: true }) }))).resolves.toBeUndefined()
  })
  it('records mutation identity without request credentials or target URLs', () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    const event = makeEvent()
    event.node.req.headers.authorization = 'Bearer must-not-be-logged'
    logLinkMutation(event, 'create', 'audited-link')
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'link.mutation.committed', operation: 'create', slug: 'audited-link', actor: 'operator' }))
    expect(JSON.stringify(log.mock.calls)).not.toContain('must-not-be-logged')
  })
})
