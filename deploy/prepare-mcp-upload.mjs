import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const require = createRequire(import.meta.resolve('wrangler/package.json'))
const { hash } = require('blake3-wasm')

const root = path.resolve('.output/public')
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/vnd.microsoft.icon',
  '.woff2': 'font/woff2',
  '.bin': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.geojson': 'application/geo+json',
}
const manifest = {}
const assets = {}
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const file = path.join(dir, entry)
    if (statSync(file).isDirectory()) {
      walk(file)
      continue
    }
    const relative = `/${path.relative(root, file).split(path.sep).join('/')}`
    if (['_headers', '_redirects', '.assetsignore'].includes(entry))
      continue
    const content = readFileSync(file)
    const extension = path.extname(file)
    const base64 = content.toString('base64')
    const key = hash(base64 + extension.slice(1)).toString('hex').slice(0, 32)
    manifest[relative] = { hash: key, size: content.length }
    assets[key] = { base64, type: mime[extension] || 'application/octet-stream' }
  }
}
walk(root)
const worker = readFileSync('.cache/mcp-upload/index.js', 'utf8')
const migrations = readdirSync('drizzle').filter(name => name.endsWith('.sql')).sort().map(name => ({ name, sql: readFileSync(path.join('drizzle', name), 'utf8') }))
const compressed = gzipSync(JSON.stringify({ manifest, assets, worker, migrations })).toString('base64')
mkdirSync('.cache/mcp-payload', { recursive: true })
writeFileSync('.cache/mcp-payload/payload.b64', compressed, { mode: 0o600 })
writeFileSync('.cache/mcp-payload/manifest.json', JSON.stringify(manifest))
console.log(JSON.stringify({ assets: Object.keys(manifest).length, workerBytes: Buffer.byteLength(worker), payloadCharacters: compressed.length, sha256: createHash('sha256').update(compressed).digest('hex') }))
