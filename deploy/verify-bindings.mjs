import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function assertResourceOwnership(config, databases, namespaces) {
  const database = config.d1_databases.find(item => item.binding === 'DB')
  const namespace = config.kv_namespaces.find(item => item.binding === 'KV')
  if (!databases.some(item => item.uuid === database.database_id && item.name === `${config.name}-db`))
    throw new Error('The live D1 ID and name do not belong to the selected Sink instance')
  if (!namespaces.some(item => item.id === namespace.id && item.title === `${config.name}-kv`))
    throw new Error('The live KV ID and title do not belong to the selected Sink instance')
}

async function main() {
  const config = JSON.parse(await readFile(new URL('../wrangler.deploy.jsonc', import.meta.url), 'utf8'))
  const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url))
  const configPath = fileURLToPath(new URL('../wrangler.deploy.jsonc', import.meta.url))
  const readJson = args => JSON.parse(execFileSync(process.execPath, [wrangler, ...args, '--config', configPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
    timeout: 60_000,
  }))
  const databases = readJson(['d1', 'list', '--json'])
  const namespaces = readJson(['kv', 'namespace', 'list'])
  assertResourceOwnership(config, databases, namespaces)
  console.log(`Verified isolated D1 and KV ownership for ${config.name}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
