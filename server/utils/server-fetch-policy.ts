import type { H3Event } from 'h3'
import { isAllowedServerFetchUrl } from '#shared/utils/public-url'

export function isServerFetchAllowed(event: H3Event, url: string): boolean {
  return isAllowedServerFetchUrl(url, useRuntimeConfig(event).serverFetchAllowedHosts)
}
