import type { H3Event } from 'h3'
import { createError, setResponseHeader } from 'h3'

interface WriteLimiter {
  limit: (options: { key: string }) => Promise<{ success: boolean }>
}

export async function enforceWriteRateLimit(event: H3Event): Promise<void> {
  if (!useRuntimeConfig(event).requireWriteRateLimit)
    return
  const env = event.context.cloudflare?.env as { LINK_WRITE_LIMITER?: WriteLimiter } | undefined
  if (!env?.LINK_WRITE_LIMITER)
    throw createError({ status: 503, statusText: 'Write limiter is unavailable' })
  const { success } = await env.LINK_WRITE_LIMITER.limit({ key: `api-write:${event.context.userID || 'root'}` })
  if (!success) {
    setResponseHeader(event, 'Retry-After', 60)
    throw createError({ status: 429, statusText: 'Too many write requests' })
  }
}
