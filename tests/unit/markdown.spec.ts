import type { H3Event } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPageMarkdown } from '../../server/utils/markdown'

function createEvent(headers: Record<string, string>): H3Event {
  return {
    node: {
      req: { headers },
    },
  } as H3Event
}

function createAI(toMarkdown = vi.fn()): Ai {
  return { toMarkdown } as unknown as Ai
}

beforeEach(() => {
  vi.stubGlobal('useRuntimeConfig', () => ({ serverFetchAllowedHosts: 'example.com' }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPageMarkdown', () => {
  it('forwards only Accept and Accept-Language headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('# Page', {
      headers: { 'Content-Type': 'text/markdown' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPageMarkdown(createEvent({
      'authorization': 'Bearer secret',
      'cookie': 'session=secret',
      'cf-access-jwt-assertion': 'access-secret',
      'x-custom-secret': 'custom-secret',
      'accept-language': 'zh-CN,zh;q=0.9',
    }), 'https://example.com/page', createAI())

    expect(result).toBe('# Page')
    expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe('error')
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(Object.fromEntries(headers.entries())).toEqual({
      'accept': 'text/markdown, text/html;q=0.9, */*;q=0.8',
      'accept-language': 'zh-CN,zh;q=0.9',
    })
  })

  it('rejects non-http protocols without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchPageMarkdown(createEvent({}), 'file:///etc/passwd', createAI())).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not fetch private targets even when a hostname is explicitly allowed', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ serverFetchAllowedHosts: '127.0.0.1' }))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchPageMarkdown(createEvent({}), 'http://127.0.0.1/private', createAI())).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not fetch arbitrary domains when the trusted-host list is empty', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ serverFetchAllowedHosts: '' }))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchPageMarkdown(createEvent({}), 'https://example.com', createAI())).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('caps streamed responses at 256 KiB and cancels the reader', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(128 * 1024).fill(97))
        controller.enqueue(new Uint8Array(128 * 1024).fill(98))
        controller.enqueue(new Uint8Array(128 * 1024).fill(99))
      },
      cancel,
    })
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream, {
      headers: { 'Content-Type': 'text/html' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const toMarkdown = vi.fn().mockResolvedValue({
      format: 'markdown',
      data: 'x'.repeat(5000),
    })

    const result = await fetchPageMarkdown(createEvent({}), 'https://example.com/large', createAI(toMarkdown))

    expect(cancel).toHaveBeenCalledOnce()
    expect(toMarkdown).toHaveBeenCalledOnce()
    expect(toMarkdown.mock.calls[0]?.[0].blob.size).toBe(256 * 1024)
    expect(result).toHaveLength(4096)
  })
})
