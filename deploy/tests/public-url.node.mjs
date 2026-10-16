import assert from 'node:assert/strict'
import test from 'node:test'
import { isAllowedServerFetchUrl, isPublicTargetUrl as isPublicHttpUrl } from '../../shared/utils/public-url.ts'

const blocked = [
  'javascript:alert(1)',
  'data:text/html,hello',
  'file:///etc/passwd',
  'ftp://example.com/file',
  'http://localhost',
  'http://api.localhost',
  'http://localhost.localdomain',
  'http://router',
  'http://metadata.google.internal',
  'http://printer.local',
  'http://router.home.arpa',
  'http://127.1',
  'http://2130706433',
  'http://0x7f000001',
  'http://0177.0.0.1',
  'http://0.0.0.0',
  'http://10.0.0.1',
  'http://100.64.0.1',
  'http://169.254.169.254',
  'http://172.16.0.1',
  'http://192.168.0.1',
  'http://192.0.2.1',
  'http://198.18.0.1',
  'http://198.51.100.1',
  'http://203.0.113.1',
  'http://224.0.0.1',
  'http://255.255.255.255',
  'http://[::1]',
  'http://[::]',
  'http://[fc00::1]',
  'http://[fe80::1]',
  'http://[ff02::1]',
  'http://[::ffff:127.0.0.1]',
  'http://[64:ff9b::a00:1]',
  'http://[2001:db8::1]',
  'http://[2002:a00:1::1]',
  'https://user:password@example.com/path',
]
for (const url of blocked) {
  test(`rejects non-public target ${url}`, () => assert.equal(isPublicHttpUrl(url), false))
}
for (const url of ['https://example.com/path?utm_source=sink', 'http://8.8.8.8', 'https://[2606:4700:4700::1111]/']) {
  test(`accepts public target ${url}`, () => assert.equal(isPublicHttpUrl(url), true))
}
test('outbound fetches require an explicit exact trusted host', () => {
  assert.equal(isAllowedServerFetchUrl('https://example.com/page', ''), false)
  assert.equal(isAllowedServerFetchUrl('https://example.com/page', 'example.com'), true)
  assert.equal(isAllowedServerFetchUrl('https://evil.example.com/page', 'example.com'), false)
  assert.equal(isAllowedServerFetchUrl('https://example.com.evil.test', 'example.com'), false)
  assert.equal(isAllowedServerFetchUrl('https://example.com:8080/page', 'example.com'), false)
  assert.equal(isAllowedServerFetchUrl('http://127.0.0.1', '127.0.0.1'), false)
  assert.equal(isAllowedServerFetchUrl('https://127.0.0.1.nip.io', ''), false)
})
