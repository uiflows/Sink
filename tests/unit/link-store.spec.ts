import type { H3Event } from 'h3'
import type { Link } from '../../shared/schemas/link'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLinks } from '../../server/utils/link-store'
import { assertLinkTargetsAllowed } from '../../server/utils/target-policy'

vi.mock('../../server/utils/target-policy', () => ({ assertLinkTargetsAllowed: vi.fn() }))

const mocks = vi.hoisted(() => ({
  d1CreateLinks: vi.fn(),
  d1GetActiveLinkVersions: vi.fn(),
  deleteLinkCache: vi.fn(),
  putLinkCache: vi.fn(),
}))

vi.mock('../../server/services/link-store/d1', () => ({
  d1CountLinks: vi.fn(),
  d1CreateLink: vi.fn(),
  d1CreateLinks: mocks.d1CreateLinks,
  d1DeleteLink: vi.fn(),
  d1GetActiveLink: vi.fn(),
  d1GetActiveLinkVersions: mocks.d1GetActiveLinkVersions,
  d1GetAnyLink: vi.fn(),
  d1GetLinkWithMetadata: vi.fn(),
  d1HasActiveLinkVersion: vi.fn(),
  d1IterateAllLinks: vi.fn(),
  d1ListLinks: vi.fn(),
  d1ListTags: vi.fn(),
  d1SearchLinks: vi.fn(),
  d1UpdateLink: vi.fn(),
}))

vi.mock('../../server/services/link-store/kv', () => ({
  deleteLinkCache: mocks.deleteLinkCache,
  isActiveLinkExpiration: () => true,
  putLinkCache: mocks.putLinkCache,
  readLegacyKvLink: vi.fn(),
}))

vi.mock('../../server/services/link-store/migration', () => ({
  insertMigratedKvLink: vi.fn(),
  readCompletedLinkMigrationMarker: vi.fn(),
}))

describe('createLinks', () => {
  it('keeps blocked import items out of D1 while preserving item result order', async () => {
    const good: Link = { id: 'approved', slug: 'approved', url: 'https://example.com', createdAt: 1, updatedAt: 1, tags: [] }
    const bad: Link = { ...good, id: 'blocked', slug: 'blocked' }
    vi.mocked(assertLinkTargetsAllowed).mockImplementation(async (_event, link) => {
      if (link === bad)
        throw new Error('blocked target')
    })
    mocks.d1CreateLinks.mockResolvedValue([{ created: true, effectiveExpiresAt: null }])
    mocks.putLinkCache.mockResolvedValue(false)
    const results = await createLinks({} as H3Event, [bad, good])
    expect(results[0]).toHaveProperty('error')
    expect(results[1]).toEqual({ created: true })
    expect(mocks.d1CreateLinks).toHaveBeenCalledWith(expect.anything(), [good])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.mocked(assertLinkTargetsAllowed).mockReset()
  })

  it('keeps D1 success when post-write cache verification fails', async () => {
    const link: Link = {
      id: 'bulk-id',
      slug: 'bulk-success',
      url: 'https://example.com',
      createdAt: 1,
      updatedAt: 1,
      tags: [],
    }
    mocks.d1CreateLinks.mockResolvedValue([{ created: true, effectiveExpiresAt: null }])
    mocks.putLinkCache.mockResolvedValue(true)
    mocks.d1GetActiveLinkVersions.mockRejectedValue(new Error('version query failed'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(createLinks({} as H3Event, [link])).resolves.toEqual([{ created: true }])

    expect(mocks.d1CreateLinks).toHaveBeenCalledOnce()
    expect(mocks.deleteLinkCache).toHaveBeenCalledWith(expect.anything(), link.slug)
    expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ operation: 'bulk-write-through' }))
  })
})
