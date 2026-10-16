import { afterAll, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('useAppConfig', () => ({ slugRegex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/i, reserveSlug: ['dashboard'] }))
vi.stubGlobal('useRuntimeConfig', () => ({ public: { slugDefaultLength: '6', maxUrlLength: '16384' } }))
const { CreateLinkSchema, EditLinkSchema, ImportLinkSchema, StoredLinkSchema, parseLegacyKvLink } = await import('../../shared/schemas/link')
afterAll(() => vi.unstubAllGlobals())

const input = { url: 'https://example.com/path?utm_source=sink', slug: 'security-check' }

describe('target policies across writable and stored contracts', () => {
  for (const [name, schema] of Object.entries({ create: CreateLinkSchema, edit: EditLinkSchema, import: ImportLinkSchema })) {
    it(`${name} preserves public URLs and UTM parameters`, () => {
      expect(schema.parse(input).url).toBe(input.url)
    })
    for (const override of [
      { url: 'http://127.0.0.1/private' },
      { url: 'javascript:alert(1)' },
      { apple: 'http://169.254.169.254/latest/meta-data' },
      { google: 'http://[::1]/' },
      { geo: { US: 'http://10.0.0.1/' } },
    ]) {
      it(`${name} blocks unsafe ${Object.keys(override)[0]} targets`, () => {
        expect(schema.safeParse({ ...input, ...override }).success).toBe(false)
      })
    }
  }
  it('keeps historical private targets readable without accepting them for new writes', () => {
    const historical = { ...input, url: 'http://10.0.0.1/old', id: 'historical-id', createdAt: 1, updatedAt: 1 }
    expect(StoredLinkSchema.safeParse(historical).success).toBe(true)
    expect(parseLegacyKvLink(historical, input.slug).success).toBe(true)
    expect(ImportLinkSchema.safeParse(historical).success).toBe(false)
  })
})
