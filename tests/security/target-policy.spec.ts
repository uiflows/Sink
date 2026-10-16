import type { H3Event } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertLinkTargetsAllowed } from '../../server/utils/target-policy'

const event = () => ({}) as H3Event
function configure(overrides = {}) {
  vi.stubGlobal('useRuntimeConfig', () => ({ targetRiskCheck: true, targetAllowedHosts: '', targetDeniedHosts: '', ...overrides }))
}
function resolver(data: string = '1.1.1.1') {
  return vi.fn(async (_url?: unknown) => Response.json({ Status: 0, Answer: [{ type: 1, data }] }))
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('enforced target policy', () => {
  it('checks all destination variants and cannot be overridden by an unsafe flag', async () => {
    configure()
    const fetcher = resolver('0.0.0.0')
    vi.stubGlobal('fetch', fetcher)
    const target = { url: 'https://example.com', unsafe: false }
    await expect(assertLinkTargetsAllowed(event(), target)).rejects.toMatchObject({ statusCode: 403 })
    for (const variant of [{ apple: 'https://malware.example.com' }, { google: 'https://malware.example.com' }, { geo: { US: 'https://malware.example.com' } }]) {
      fetcher.mockImplementation(async (url?: unknown) => Response.json({ Status: 0, Answer: [{ type: 1, data: String(url).includes('malware.example.com') ? '0.0.0.0' : '1.1.1.1' }] }))
      await expect(assertLinkTargetsAllowed(event(), { url: 'https://example.com', ...variant })).rejects.toMatchObject({ statusCode: 403 })
    }
  })
  it('fails closed when lookup is unavailable or DNS returns a private address', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private provider details')))
    await expect(assertLinkTargetsAllowed(event(), { url: 'https://example.com' })).rejects.toMatchObject({ statusCode: 503 })
    vi.stubGlobal('fetch', resolver('10.0.0.1'))
    await expect(assertLinkTargetsAllowed(event(), { url: 'https://example.com' })).rejects.toMatchObject({ statusCode: 403 })
  })
  it('never requests user content and deduplicates lookup by host within a request', async () => {
    configure()
    const fetcher = resolver()
    vi.stubGlobal('fetch', fetcher)
    const request = event()
    await assertLinkTargetsAllowed(request, { url: 'https://example.com/private?token=not-for-resolver', apple: 'https://example.com/apple' })
    await assertLinkTargetsAllowed(request, { url: 'https://example.com/second' })
    expect(fetcher).toHaveBeenCalledTimes(2)
    for (const [url, init] of fetcher.mock.calls as unknown as [string, RequestInit][]) {
      expect(url.startsWith('https://security.cloudflare-dns.com/dns-query?')).toBe(true)
      expect(url).not.toContain('private')
      expect(url).not.toContain('token')
      expect(init.redirect).toBe('error')
    }
  })
  it('enforces exact manual host approvals and deny rules without subdomain inheritance', async () => {
    configure({ targetAllowedHosts: 'example.com', targetDeniedHosts: 'example.org' })
    vi.stubGlobal('fetch', resolver())
    await expect(assertLinkTargetsAllowed(event(), { url: 'https://example.com' })).resolves.toBeUndefined()
    for (const url of ['https://sub.example.com', 'https://example.org', 'https://example.org.'])
      await expect(assertLinkTargetsAllowed(event(), { url })).rejects.toMatchObject({ statusCode: 403 })
  })
  it('requires explicit review for IP targets and bounds DNS subrequests', async () => {
    configure()
    vi.stubGlobal('fetch', resolver())
    await expect(assertLinkTargetsAllowed(event(), { url: 'https://8.8.8.8' })).rejects.toMatchObject({ statusCode: 403 })
    const request = event()
    for (let index = 0; index < 16; index++)
      await assertLinkTargetsAllowed(request, { url: `https://host${index}.example.com` })
    await expect(assertLinkTargetsAllowed(request, { url: 'https://host16.example.com' })).rejects.toMatchObject({ statusCode: 400 })
  })
})
