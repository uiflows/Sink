import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))

function fixture() {
  mkdirSync(path.join(root, '.cache'), { recursive: true })
  const dir = mkdtempSync(path.join(root, '.cache/config-test-'))
  for (const folder of ['scripts', 'deploy'])
    mkdirSync(path.join(dir, folder))
  for (const file of ['wrangler.jsonc', 'scripts/cloudflare-deploy-config.mjs', 'deploy/instance-policy.mjs'])
    copyFileSync(path.join(root, file), path.join(dir, file))
  symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'))
  return dir
}

function generate(name, databaseId, namespaceId) {
  const dir = fixture()
  execFileSync(process.execPath, [path.join(dir, 'scripts/cloudflare-deploy-config.mjs')], {
    cwd: dir,
    env: {
      ...process.env,
      DEPLOY_WORKER_NAME: name,
      DEPLOY_CF_ACCOUNT_ID: '00000000000000000000000000000000',
      DEPLOY_ENABLE_AI: 'false',
      DEPLOY_D1_DATABASE_ID: databaseId,
      DEPLOY_D1_DATABASE_NAME: `${name}-db`,
      DEPLOY_KV_NAMESPACE_ID: namespaceId,
      DEPLOY_ANALYTICS_DATASET: name.replaceAll('-', '_'),
      DEPLOY_R2_BUCKET_NAME: `${name}-backup`,
    },
    stdio: 'pipe',
  })
  return JSON.parse(readFileSync(path.join(dir, 'wrangler.deploy.jsonc'), 'utf8'))
}

test('the real deploy generator keeps both Workers and all four storage bindings separate', () => {
  const brand = generate('sink-brand', '11111111-1111-4111-8111-111111111111', '11111111111111111111111111111111')
  const marketing = generate('sink-marketing', '22222222-2222-4222-8222-222222222222', '22222222222222222222222222222222')
  assert.notEqual(brand.name, marketing.name)
  assert.notEqual(brand.d1_databases[0].database_id, marketing.d1_databases[0].database_id)
  assert.notEqual(brand.kv_namespaces[0].id, marketing.kv_namespaces[0].id)
  assert.notEqual(brand.analytics_engine_datasets[0].dataset, marketing.analytics_engine_datasets[0].dataset)
  assert.notEqual(brand.r2_buckets[0].bucket_name, marketing.r2_buckets[0].bucket_name)
  for (const config of [brand, marketing]) {
    assert.equal(config.ai, undefined)
    assert.equal(config.routes, undefined)
    assert.equal(config.vars.NUXT_DATASET, config.analytics_engine_datasets[0].dataset)
    assert.equal(config.triggers.crons.length, 1)
    assert.equal(config.d1_databases[0].binding, 'DB')
  }
})

test('the real generator refuses an unset instance before a deployment configuration is written', () => {
  const dir = fixture()
  const env = { ...process.env, DEPLOY_D1_DATABASE_ID: 'test', DEPLOY_KV_NAMESPACE_ID: 'test' }
  delete env.DEPLOY_WORKER_NAME
  assert.throws(() => execFileSync(process.execPath, [path.join(dir, 'scripts/cloudflare-deploy-config.mjs')], { cwd: dir, env, stdio: 'pipe' }), /DEPLOY_WORKER_NAME/)
})
