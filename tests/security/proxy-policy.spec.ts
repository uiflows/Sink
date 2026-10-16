import type { H3Event } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxyLinkRequest } from '../../server/services/link-proxy'

afterEach(() => vi.unstubAllGlobals())

describe('reverse-proxy trust boundary', () => {
  it('denies arbitrary public hosts before touching request headers or the network', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ serverFetchAllowedHosts: '' }))
    vi.stubGlobal('createError', ({ statusText }: { statusText: string }) => new Error(statusText))
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(proxyLinkRequest({} as H3Event, 'https://example.com')).rejects.toThrow('not allowed')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('never follows an upstream redirect, including a private-network destination', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ serverFetchAllowedHosts: 'example.com' }))
    vi.stubGlobal('getHeaders', () => ({}))
    vi.stubGlobal('getHeader', () => undefined)
    vi.stubGlobal('getRequestProtocol', () => 'https')
    vi.stubGlobal('getRequestHost', () => 'sink.example.com')
    vi.stubGlobal('createError', ({ statusText }: { statusText: string }) => new Error(statusText))
    const fetcher = vi.fn().mockImplementation(async (_url, options) => {
      expect(options.redirect).toBe('error')
      throw new TypeError('redirect is not allowed')
    })
    vi.stubGlobal('fetch', fetcher)
    await expect(proxyLinkRequest({ method: 'GET' } as H3Event, 'https://example.com')).rejects.toThrow('Proxy request failed')
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
