import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertResourceOwnership } from '../verify-bindings.mjs'

const config = {
  name: 'sink-brand',
  d1_databases: [{ binding: 'DB', database_id: 'brand-db-id' }],
  kv_namespaces: [{ binding: 'KV', id: 'brand-kv-id' }],
}
const databases = [{ uuid: 'brand-db-id', name: 'sink-brand-db' }]
const namespaces = [{ id: 'brand-kv-id', title: 'sink-brand-kv' }]

test('a live ID and matching instance name are both required', () => {
  assert.doesNotThrow(() => assertResourceOwnership(config, databases, namespaces))
  assert.throws(() => assertResourceOwnership(config, [{ uuid: 'marketing-db-id', name: 'sink-brand-db' }], namespaces), /D1/)
  assert.throws(() => assertResourceOwnership(config, [{ uuid: 'brand-db-id', name: 'sink-marketing-db' }], namespaces), /D1/)
  assert.throws(() => assertResourceOwnership(config, databases, [{ id: 'brand-kv-id', title: 'sink-marketing-kv' }]), /KV/)
  assert.throws(() => assertResourceOwnership(config, databases, [{ id: 'marketing-kv-id', title: 'sink-brand-kv' }]), /KV/)
})
