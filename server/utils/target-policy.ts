import type { H3Event } from 'h3'
import type { Link } from '#shared/schemas/link'
import { createError } from 'h3'
import { isPublicTargetUrl } from '#shared/utils/public-url'

const requestChecks = new WeakMap<H3Event, Map<string, Promise<void>>>()

function hostList(value: string): Set<string> {
  return new Set(value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean).map((item) => {
    const url = new URL(`https://${item}`)
    if (item.includes('*') || !isPublicTargetUrl(url.href) || url.hostname !== item || url.port || url.pathname !== '/' || url.search || url.hash)
      throw createError({ statusCode: 503, statusMessage: 'Invalid target host policy configuration' })
    return url.hostname
  }))
}

export async function assertLinkTargetsAllowed(event: H3Event, link: Pick<Link, 'url' | 'apple' | 'google' | 'geo'>): Promise<void> {
  const config = useRuntimeConfig(event)
  if (!config.targetRiskCheck && !config.targetAllowedHosts && !config.targetDeniedHosts)
    return
  const allowed = hostList(config.targetAllowedHosts)
  const denied = hostList(config.targetDeniedHosts)
  const targets = [link.url, link.apple, link.google, ...Object.values(link.geo || {})].filter((url): url is string => !!url)
  let checks = requestChecks.get(event)
  if (!checks) {
    checks = new Map()
    requestChecks.set(event, checks)
  }
  for (const target of targets) {
    if (!isPublicTargetUrl(target))
      throw createError({ statusCode: 400, statusMessage: 'Target must be a public HTTP or HTTPS URL' })
    const host = new URL(target).hostname.replace(/\.+$/, '')
    if (denied.has(host) || (allowed.size > 0 && !allowed.has(host)))
      throw createError({ statusCode: 403, statusMessage: 'Target hostname has not been approved or is denied' })
    if (!config.targetRiskCheck)
      continue
    // DNS reputation cannot assess bare IP URLs; require an explicit operator approval.
    if (/^[\d.]+$/.test(host) || host.startsWith('[')) {
      if (!allowed.has(host))
        throw createError({ statusCode: 403, statusMessage: 'IP targets require explicit hostname policy approval' })
      continue
    }
    if (!checks.has(host)) {
      if (checks.size >= 16)
        throw createError({ statusCode: 400, statusMessage: 'Maximum 16 distinct target hostnames per request; use smaller batches' })
      checks.set(host, checkTargetReputation(host))
    }
    await checks.get(host)
  }
}

async function checkTargetReputation(host: string): Promise<void> {
  let answers: Array<{ type: number, data: string }>
  try {
    const results = await Promise.all(['A', 'AAAA'].map(async (type) => {
      // Only the hostname reaches this fixed resolver; never fetch user target content.
      const response = await fetch(`https://security.cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
        headers: { accept: 'application/dns-json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok)
        throw new Error('resolver-unavailable')
      const data = await response.json() as { Status?: number, Answer?: Array<{ type: number, data: string }> }
      if (data.Status !== 0)
        throw new Error('dns-unresolved')
      return data.Answer || []
    }))
    answers = results.flat().filter(item => item.type === 1 || item.type === 28)
  }
  catch {
    // An unavailable reputation source is not a safety approval.
    throw createError({ statusCode: 503, statusMessage: 'Target safety lookup unavailable; retry after review' })
  }
  if (answers.some(answer => answer.data === '0.0.0.0' || answer.data === '::'))
    throw createError({ statusCode: 403, statusMessage: 'Target denied by malware or phishing DNS filtering' })
  if (!answers.length || answers.some(answer => !isPublicTargetUrl(`https://${answer.type === 28 ? `[${answer.data}]` : answer.data}`)))
    throw createError({ statusCode: 403, statusMessage: 'Target does not resolve exclusively to public addresses' })
}
