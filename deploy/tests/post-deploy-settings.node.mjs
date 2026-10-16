import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enforceLogPrivacy } from '../post-deploy-settings.mjs'

const config = { name: 'sink-brand', account_id: '00000000000000000000000000000000', observability: { enabled: true, logs: { enabled: true, invocation_logs: false } } }

test('post-deploy privacy only changes observability and keeps credentials out of the payload', async () => {
  await enforceLogPrivacy(config, { CLOUDFLARE_API_TOKEN: 'test-only' }, async (url, options) => {
    assert.equal(url, 'https://api.cloudflare.com/client/v4/accounts/00000000000000000000000000000000/workers/scripts/sink-brand/script-settings')
    assert.equal(options.method, 'PATCH')
    assert.equal(options.redirect, 'error')
    const body = JSON.parse(options.body)
    assert.deepEqual(Object.keys(body), ['observability'])
    assert.equal(body.observability.redact_query_string, true)
    assert.equal(options.body.includes('test-only'), false)
    return Response.json({ success: true, result: { observability: { redact_query_string: true } } })
  })
})

test('post-deploy privacy refuses unrelated Workers before sending a request', async () => {
  await assert.rejects(() => enforceLogPrivacy({ ...config, name: 'social-agent-hub' }, { CLOUDFLARE_API_TOKEN: 'test-only' }, () => {
    throw new Error('must not run')
  }), /verified Sink instance/)
})
