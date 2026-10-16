import type { H3Event } from 'h3'
import type { LinkCheckRequest, LinkCheckResponse, LinkCheckResult } from '#shared/types/link-check'
import { getHeader } from 'h3'
import { ofetch } from 'ofetch'
import { toErrorMessage } from '#shared/utils/error'
import { listLinks } from './link-store'
import { isServerFetchAllowed } from './server-fetch-policy'

const SAFE_FORWARDED_HEADERS = ['accept-language', 'user-agent'] as const

function getSafeHeaders(event: H3Event): Headers {
  const headers = new Headers()

  for (const name of SAFE_FORWARDED_HEADERS) {
    const value = getHeader(event, name)
    if (value)
      headers.set(name, value)
  }

  return headers
}

async function checkLink(
  target: { slug: string, url: string },
  headers: Headers,
  timeoutSeconds: number,
  event: H3Event,
): Promise<LinkCheckResult> {
  const startedAt = Date.now()
  const checkedAt = new Date().toISOString()
  const link = target

  if (!isServerFetchAllowed(event, link.url)) {
    return {
      ...link,
      status: 0,
      ok: false,
      error: 'URL is not allowed for server-side checking',
      duration: Date.now() - startedAt,
      checkedAt,
    }
  }

  try {
    const response = await ofetch.raw(link.url, {
      method: 'GET',
      redirect: 'manual',
      headers,
      timeout: timeoutSeconds * 1000,
      ignoreResponseError: true,
      responseType: 'stream',
    })
    const status = response.status

    if (response.body)
      await response.body.cancel().catch(() => undefined)

    return {
      ...link,
      status,
      ok: status >= 200 && status < 300,
      ...(status >= 300 && status < 400 ? { error: 'Redirect requires manual review' } : {}),
      duration: Date.now() - startedAt,
      checkedAt,
    }
  }
  catch (error) {
    return {
      ...link,
      status: 0,
      ok: false,
      error: toErrorMessage(error, 300),
      duration: Date.now() - startedAt,
      checkedAt,
    }
  }
}

export async function checkLinksPage(event: H3Event, { cursor, limit, timeout }: LinkCheckRequest): Promise<LinkCheckResponse> {
  const headers = getSafeHeaders(event)
  const page = await listLinks(event, {
    cursor,
    limit,
    sort: 'az',
    status: 'all',
  })

  return {
    results: await Promise.all(page.links.map(({ slug, url }) => checkLink({ slug, url }, headers, timeout, event))),
    cursor: page.cursor,
    list_complete: page.list_complete,
  }
}
