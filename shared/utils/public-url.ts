export function isPublicTargetUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password)
      return false

    const rawHostname = parsed.hostname.toLowerCase()
    const hostname = rawHostname.startsWith('[') && rawHostname.endsWith(']')
      ? rawHostname.slice(1, -1)
      : rawHostname.replace(/\.+$/, '')
    if (!hostname.includes('.') && !hostname.includes(':'))
      return false
    if (hostname === 'localhost.localdomain'
      || ['localhost', 'local', 'internal', 'lan', 'corp', 'home.arpa', 'test', 'invalid', 'example', 'onion'].some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`))) {
      return false
    }

    return !isBlockedIp(hostname)
  }
  catch {
    return false
  }
}

function isBlockedIp(hostname: string): boolean {
  if (hostname.includes(':'))
    return isBlockedIpv6(hostname)

  return isBlockedIpv4(hostname)
}

function isBlockedIpv4(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length !== 4)
    return false

  const bytes = parts.map((part) => {
    if (!/^\d+$/.test(part))
      return Number.NaN

    const value = Number(part)
    return value >= 0 && value <= 255 ? value : Number.NaN
  })

  if (bytes.some(Number.isNaN))
    return false

  const [a, b] = bytes as [number, number, number, number]

  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && ((b === 0 && (bytes[2] === 0 || bytes[2] === 2)) || b === 168 || (b === 88 && bytes[2] === 99)))
    || (a === 198 && b === 51 && bytes[2] === 100)
    || (a === 203 && b === 0 && bytes[2] === 113)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224
}

function isBlockedIpv6(hostname: string): boolean {
  const [first = '0', second = '0'] = hostname.split(':')
  const firstSegment = Number.parseInt(first || '0', 16)
  const secondSegment = Number.parseInt(second || '0', 16)
  // Conservatively allow global unicast while rejecting special and transition ranges.
  return firstSegment < 0x2000 || firstSegment > 0x3FFF
    || firstSegment === 0x2002 || firstSegment === 0x3FFF
    || (firstSegment === 0x2001 && (secondSegment <= 0x1FF || secondSegment === 0xDB8))
}

export function isAllowedServerFetchUrl(url: string, allowedHosts: string): boolean {
  if (!isPublicTargetUrl(url))
    return false
  const parsed = new URL(url)
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443')
    return false
  const host = parsed.hostname.toLowerCase().replace(/\.+$/, '')
  return allowedHosts.split(',').some(value => value.trim().toLowerCase() === host)
}
