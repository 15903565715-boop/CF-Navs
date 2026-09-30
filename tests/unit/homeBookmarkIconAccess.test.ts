// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/svelte'
import CategorySection from '../../src/components/CategorySection.svelte'
import type { PublicBookmark, PublicCategory } from '../../shared/types'

// Issue #28：首页私密书签的图标必须经带 key 的代理 URL 才能拿到真实图标；公开书签必须保持
// 匿名 URL，否则 `/api/icon/:id` 会退回 `private, no-store`，白丢 edge / Service Worker 缓存。
// 「需要授权」= 书签自身私密，或所属分类落在私密分类树（自身/祖先私密）下。
const GRANT = 'GRANT123'

function bookmark(overrides: Partial<PublicBookmark> = {}): PublicBookmark {
  return {
    id: 42,
    category_id: 1,
    title: 'Example',
    url: 'https://example.com/',
    icon: 'https://cdn.example.com/icon.png',
    icon_source: 'custom',
    icon_background_color: null,
    icon_blob: null,
    // 让图标走 `/api/icon/:id` 代理，而不是原始外链。
    icon_cached: true,
    description: null,
    open_method: 1,
    sort: 0,
    ...overrides,
  }
}

function category(overrides: Partial<PublicCategory> = {}): PublicCategory {
  return { id: 1, parent_id: null, title: 'Tools', icon: null, sort: 0, ...overrides }
}

// 本地图标缓存未命中时 BookmarkCard 会先预取代理 URL，再回落到同一个 URL 渲染 <img>。
// 这里让 Cache Storage 恒空、预取恒失败，从而稳定观察最终代理 URL。
function stubIconEnvironment(): void {
  const entries = new Map<string, Response>()
  const cache = {
    match: async (request: Request) => entries.get(request.url)?.clone(),
    keys: async () => Array.from(entries.keys()).map((url) => new Request(url)),
    put: async (request: Request, response: Response) => {
      entries.set(request.url, response.clone())
    },
    delete: async (request: Request) => entries.delete(request.url),
  }
  const caches = { open: vi.fn(async () => cache) }
  vi.stubGlobal('caches', caches)
  Object.defineProperty(window, 'caches', { value: caches, configurable: true })
  vi.stubGlobal('IntersectionObserver', undefined)
  // 预取失败 → hasRenderableIcon 回落到代理 URL（带 key 与否正是本测试要断言的分流）。
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
  window.localStorage.clear()
}

function iconSrcByAlt(root: ParentNode): Map<string, string> {
  return new Map(
    Array.from(root.querySelectorAll('img')).map((img) => [img.getAttribute('alt') ?? '', img.getAttribute('src') ?? '']),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('首页书签图标授权分流', () => {
  it('adds the access key to a private bookmark icon', async () => {
    stubIconEnvironment()
    const { container } = render(CategorySection, {
      props: {
        category: category(),
        bookmarks: [bookmark({ is_private: 1 })],
        publicCategoryIds: new Set<number>([1]),
        iconAccessKey: GRANT,
      },
    })

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull())
    expect(iconSrcByAlt(container).get('Example')).toContain('key=GRANT123')
  })

  it('keeps a public bookmark in a public category anonymous', async () => {
    stubIconEnvironment()
    const { container } = render(CategorySection, {
      props: {
        category: category(),
        bookmarks: [bookmark({ is_private: 0 })],
        publicCategoryIds: new Set<number>([1]),
        iconAccessKey: GRANT,
      },
    })

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull())
    const src = iconSrcByAlt(container).get('Example') ?? ''
    expect(src).toMatch(/^\/api\/icon\/42\?v=/)
    expect(src).not.toContain('key=')
  })

  it('adds the access key to a public bookmark that sits under a private category', async () => {
    stubIconEnvironment()
    const { container } = render(CategorySection, {
      props: {
        category: category({ id: 2, is_private: true }),
        bookmarks: [bookmark({ category_id: 2, is_private: 0 })],
        publicCategoryIds: new Set<number>([1]),
        iconAccessKey: GRANT,
      },
    })

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull())
    expect(iconSrcByAlt(container).get('Example')).toContain('key=GRANT123')
  })

  it('stays anonymous when the viewer is not logged in (no key available)', async () => {
    stubIconEnvironment()
    const { container } = render(CategorySection, {
      props: {
        category: category(),
        bookmarks: [bookmark({ is_private: 1 })],
        publicCategoryIds: new Set<number>([1]),
        iconAccessKey: '',
      },
    })

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull())
    expect(iconSrcByAlt(container).get('Example')).not.toContain('key=')
  })

  it('adds the access key to a public bookmark whose category no longer exists', async () => {
    // 陈旧数据：书签指向已被删除的分类。服务端可见集合不含该 id → 返回兜底图标，
    // 前端因此必须带 key，否则登录态首页会永久显示 NAV。
    stubIconEnvironment()
    const { container } = render(CategorySection, {
      props: {
        category: category({ id: 1 }),
        bookmarks: [bookmark({ category_id: 999, is_private: 0 })],
        publicCategoryIds: new Set<number>([1]),
        iconAccessKey: GRANT,
      },
    })

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull())
    expect(iconSrcByAlt(container).get('Example')).toContain('key=GRANT123')
  })

  it('scopes the key per bookmark inside a mixed section such as 经常访问', async () => {
    stubIconEnvironment()
    const { container } = render(CategorySection, {
      props: {
        category: category({ id: -1, title: '经常访问' }),
        bookmarks: [
          bookmark({ id: 42, title: 'Public', category_id: 1, is_private: 0 }),
          bookmark({ id: 43, title: 'Private', category_id: 1, is_private: 1 }),
          bookmark({ id: 44, title: 'Under private', category_id: 2, is_private: 0 }),
          bookmark({ id: 45, title: 'Orphan', category_id: 999, is_private: 0 }),
        ],
        publicCategoryIds: new Set<number>([1]),
        iconAccessKey: GRANT,
      },
    })

    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(4))
    const byTitle = iconSrcByAlt(container)
    expect(byTitle.get('Public')).not.toContain('key=')
    expect(byTitle.get('Private')).toContain('key=GRANT123')
    expect(byTitle.get('Under private')).toContain('key=GRANT123')
    expect(byTitle.get('Orphan')).toContain('key=GRANT123')
  })
})
