import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyInstancePolicy } from '../instance-policy.mjs'

function environment(name) {
  return {
    DEPLOY_WORKER_NAME: name,
    DEPLOY_CF_ACCOUNT_ID: '00000000000000000000000000000000',
    DEPLOY_D1_DATABASE_NAME: `${name}-db`,
    DEPLOY_ANALYTICS_DATASET: name.replaceAll('-', '_'),
    DEPLOY_R2_BUCKET_NAME: `${name}-backup`,
  }
}

for (const name of ['sink-brand', 'sink-marketing']) {
  test(`${name} keeps its own deployment identity and analytics`, () => {
    const config = applyInstancePolicy({ name: 'sink', ai: { binding: 'AI' } }, environment(name))
    assert.equal(config.name, name)
    assert.equal(config.vars.NUXT_DATASET, name.replaceAll('-', '_'))
    assert.equal(config.ai, undefined)
    assert.equal(config.workers_dev, true)
    assert.equal(config.preview_urls, false)
  })
}

test('an omitted, default or unrelated Worker name is rejected', () => {
  for (const name of [undefined, '', 'sink', 'social-agent-hub'])
    assert.throws(() => applyInstancePolicy({}, { ...environment('sink-brand'), DEPLOY_WORKER_NAME: name }), /DEPLOY_WORKER_NAME/)
})

test('cross-instance database, analytics and backup names are rejected', () => {
  for (const key of ['DEPLOY_D1_DATABASE_NAME', 'DEPLOY_ANALYTICS_DATASET', 'DEPLOY_R2_BUCKET_NAME']) {
    const env = { ...environment('sink-brand'), [key]: environment('sink-marketing')[key] }
    assert.throws(() => applyInstancePolicy({}, env), /does not match/)
  }
})

test('existing domain routes and nested environments cannot be deployed accidentally', () => {
  for (const config of [{ routes: ['hub.nsyuop.me/*'] }, { route: 'example.com/*' }, { env: { production: {} } }])
    assert.throws(() => applyInstancePolicy(config, environment('sink-brand')))
})

test('optional R2 and explicit AI opt-in are supported', () => {
  const env = { ...environment('sink-brand'), DEPLOY_R2_BUCKET_NAME: undefined, DEPLOY_ENABLE_AI: 'true' }
  const config = applyInstancePolicy({ ai: { binding: 'AI' } }, env)
  assert.deepEqual(config.ai, { binding: 'AI' })
})
