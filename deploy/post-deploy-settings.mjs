import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Wrangler currently omits this API setting, so reapply it after every upload.
export async function enforceLogPrivacy(config, env, fetcher = fetch) {
  if (!['sink-brand', 'sink-marketing'].includes(config.name) || !/^[a-f0-9]{32}$/.test(config.account_id ?? ''))
    throw new Error('Log privacy updates require a verified Sink instance configuration')
  if (!env.CLOUDFLARE_API_TOKEN)
    throw new Error('The cloud build deployment credential is missing')
  const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/workers/scripts/${config.name}/script-settings`, {
    method: 'PATCH',
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
    headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ observability: { ...config.observability, redact_query_string: true } }),
  })
  const result = await response.json()
  if (!response.ok || !result.success || result.result?.observability?.redact_query_string !== true)
    throw new Error(`Log privacy verification failed with HTTP ${response.status}`)
  return true
}

async function main() {
  const config = JSON.parse(await readFile(new URL('../wrangler.deploy.jsonc', import.meta.url), 'utf8'))
  await enforceLogPrivacy(config, process.env)
  console.log(`Verified query-string redaction for ${config.name}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
