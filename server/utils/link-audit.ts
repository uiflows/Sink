import type { H3Event } from 'h3'
import { getHeader } from 'h3'

// Never log bearer tokens, target URLs, passwords, request bodies or client IPs.
export function logLinkMutation(event: H3Event, operation: 'create' | 'update' | 'delete', slug: string): void {
  console.info({
    event: 'link.mutation.committed',
    operation,
    slug,
    actor: event.context?.userID || 'root',
    authMethod: event.context?.authMethod || 'unknown',
    requestId: event.node?.req ? getHeader(event, 'cf-ray') : undefined,
    timestamp: new Date().toISOString(),
  })
}
