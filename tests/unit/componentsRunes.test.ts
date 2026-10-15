import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// 代码审查三轮第 23 项起（APP_SPLIT_PLAN 第 8f 步起）：层级 0 视图与层级 1+ 组件改为 runes 模式的源码护栏。
// 8c–8e 的 29 个叶子见 tests/unit/leafComponentsRunes.test.ts。行为等价由各批迁移前写成、迁移时未改的行为基线保证：
// 8f viewsBehavior；8g level1ComponentsBehavior；8h adminSectionsBehavior。

const read = (path: string) => readFileSync(path, 'utf8')

function expectRunes(path: string): void {
  const source = read(path)
  const script = source.slice(source.indexOf('<script'), source.indexOf('</script>'))
  const markup = source.slice(source.indexOf('</script>'))

  expect(source.startsWith('<svelte:options runes />')).toBe(true)
  expect(script).not.toMatch(/\bexport let\b/)
  expect(script).not.toMatch(/^\s*\$:/m)
  expect(script).not.toContain('createEventDispatcher')
  expect(source).not.toMatch(/\$\$(props|restProps|slots)/)
  expect(markup).not.toMatch(/\son:[a-z]+[=|]/)
  expect(markup).not.toContain('<slot')
  expect(markup).not.toMatch(/\sslot="/)
  expect(markup).not.toContain('<svelte:component')
  expect(script).toMatch(/\}: Props = \$props\(\)/)
  expect(script).not.toMatch(/\b(beforeUpdate|afterUpdate)\b/)
}

const VIEWS_8F = ['src/views/Install.svelte', 'src/views/Recover.svelte']

describe('8f: lazy-loaded views in runes mode', () => {
  it.each(VIEWS_8F)('%s opts into runes and drops the legacy syntax', expectRunes)

  it('moves the submit preventDefault modifier into the handler', () => {
    for (const path of VIEWS_8F) {
      const source = read(path)
      expect(source, path).toContain('onsubmit={handleSubmit}')
      expect(source, path).toMatch(/async function handleSubmit\(event: SubmitEvent\): Promise<void> \{\n\s+event\.preventDefault\(\)/)
    }
  })

  it('keeps the form fields and error flags reactive', () => {
    expect(read('src/views/Install.svelte')).toContain("let username = $state('admin')")
    expect(read('src/views/Recover.svelte')).toContain('let submitting = $state(false)')
    expect(read('src/views/Recover.svelte')).toContain('let tokenHint = $state(false)')
  })
})

const LEVEL1_8G = [
  'BookmarkBaseFields',
  'BookmarkCardCompact',
  'BookmarkCardInfo',
  'BookmarkContextMenu',
  'BookmarkIconCandidatePicker',
  'GradientBackgroundInput',
  'HomeCategoryScope',
  'HomeHeroSearch',
  'IconifySelector',
  'Sidebar',
  'SpotlightBookmarkIcon',
].map((name) => `src/components/${name}.svelte`)

describe('8g: level-1 home and bookmark components in runes mode', () => {
  it.each(LEVEL1_8G)('%s opts into runes and drops the legacy syntax', expectRunes)

  it('keeps every prop that a parent binds two-way bindable, and the parents still bind them', () => {
    const base = read('src/components/BookmarkBaseFields.svelte')
    for (const name of ['categoryId', 'title', 'url', 'openMethod', 'isPrivate', 'description', 'descriptionMode']) {
      expect(base, name).toMatch(new RegExp(`\\b${name} = \\$bindable\\(`))
      expect(read('src/components/BookmarkEditModal.svelte'), name).toContain(`bind:${name}={form.`)
    }
    expect(read('src/components/HomeHeroSearch.svelte')).toContain("query = $bindable('')")
    expect(read('src/views/Home.svelte')).toContain('bind:query={searchQuery}')
    expect(read('src/components/settings/SettingsHomePreview.svelte')).toContain('bind:query={previewQuery}')
    expect(read('src/components/IconifySelector.svelte')).toContain("iconifyName = $bindable('')")
    expect(read('src/components/BookmarkEditModal.svelte')).toMatch(/<IconifySelector\s+bind:iconifyName/)
    expect(read('src/components/CategoryEditModal.svelte')).toMatch(/<IconifySelector\s+bind:iconifyName/)
    expect(read('src/components/GradientBackgroundInput.svelte')).toContain("value = $bindable('')")
    // 只被单向传入的 prop 不做 bindable
    for (const path of ['BookmarkCardCompact', 'BookmarkCardInfo', 'BookmarkContextMenu', 'HomeCategoryScope', 'Sidebar', 'SpotlightBookmarkIcon']) {
      expect(read(`src/components/${path}.svelte`), path).not.toContain('$bindable')
    }
  })

  it('replaces the GradientBackgroundInput change event with an onchange callback at its only call site', () => {
    expect(read('src/components/GradientBackgroundInput.svelte')).toContain('onchange?.(value)')
    const card = read('src/components/settings/ThemeBackgroundCard.svelte')
    const tag = card.slice(card.indexOf('<GradientBackgroundInput'), card.indexOf('/>', card.indexOf('<GradientBackgroundInput')))
    expect(tag).toContain('onchange={() => void syncBackground()}')
    expect(tag).not.toMatch(/\son:change/)
  })

  it('keeps the context menu stopPropagation listeners directly on the menu node and remeasures after updates', () => {
    const menu = read('src/components/BookmarkContextMenu.svelte')
    expect(menu).toContain('{@attach attachMenuListeners}')
    expect(menu).toContain("import { on } from 'svelte/events'")
    expect(menu).toMatch(/\$effect\(\(\) => \{\n\s+void \[placement, maxHeight, topOffset, onEdit, movePickerOpen, canMove, onMoveBookmark, categories, categories\.length, moveCategoryId\]\n\s+untrack\(scheduleMeasure\)/)
    expect(menu).toMatch(/<CategoryTreeSelect[^>]*\bbind:value=\{moveCategoryId\}/)
  })

  it('does not deep-proxy replaced Sets, observers or trusted-icon snapshots', () => {
    const sidebar = read('src/components/Sidebar.svelte')
    expect(sidebar).toContain('let expandedParentIds = $state.raw(new Set<string>())')
    expect(sidebar).toContain('let resizeObserver: ResizeObserver | null = $state.raw(null)')
    expect(read('src/components/SpotlightBookmarkIcon.svelte')).toContain('let trustedImage = $state.raw(emptyTrustedIcon)')
  })
})

const ADMIN_SECTIONS_8H = [
  'admin/AnalyticsPanel',
  'admin/BookmarkListPanel',
  'admin/CategoryListPanel',
  'settings/BackgroundSettingsSection',
  'settings/BasicSettingsSection',
  'settings/CardSettingsSection',
  'settings/CategoryDisplaySettingsSection',
  'settings/HeroSettingsSection',
  'settings/NavigationSettingsSection',
  'settings/SearchEngineSettingsSection',
].map((name) => `src/components/${name}.svelte`)

describe('8h: admin panels and settings sections in runes mode', () => {
  it.each(ADMIN_SECTIONS_8H)('%s opts into runes and drops the legacy syntax', expectRunes)

  it('keeps the settings form two-way bindable for SettingsPanel', () => {
    // 父组件：SettingsPanel；CategoryDisplay 嵌在 AdvancedSettingsSection 里
    const parents = read('src/components/SettingsPanel.svelte') + read('src/components/settings/AdvancedSettingsSection.svelte')
    for (const path of ADMIN_SECTIONS_8H.filter((item) => item.includes('/settings/'))) {
      expect(read(path), path).toContain('form = $bindable()')
      const name = path.split('/').pop()!.replace('.svelte', '')
      expect(parents, name).toMatch(new RegExp(`<${name}\\s+bind:form\\b`))
    }
    for (const path of ADMIN_SECTIONS_8H.filter((item) => item.includes('/admin/'))) {
      expect(read(path), path).not.toContain('$bindable')
    }
  })

  it('writes self-referencing statements back only when the value changes', () => {
    expect(read('src/components/settings/CardSettingsSection.svelte')).toContain('if (form.card_show_description !== showDescription) form.card_show_description = showDescription')
    for (const path of ['src/components/admin/BookmarkListPanel.svelte', 'src/components/admin/CategoryListPanel.svelte']) {
      const source = read(path)
      expect(source, path).toContain('if (next !== page) page = next')
      expect(source, path).toContain('if (next.size !== selectedIds.size) selectedIds = next')
    }
    expect(read('src/components/admin/AnalyticsPanel.svelte')).toContain('if (next !== zeroVisitPage) zeroVisitPage = next')
  })

  it('replaces whole collections instead of self-assigning them', () => {
    const bookmarks = read('src/components/admin/BookmarkListPanel.svelte')
    expect(bookmarks).toContain('let selectedIds = $state.raw(new Set<number>())')
    expect(bookmarks).toContain('let healthResults = $state.raw(new Map<')
    expect(bookmarks).not.toMatch(/^\s+healthResults = healthResults$/m)
    expect(bookmarks).toContain('healthResults = next')
    const categories = read('src/components/admin/CategoryListPanel.svelte')
    expect(categories).toContain('let expandedRootIds = $state.raw(new Set<string>())')
    expect(categories).toContain('let collapsedSearchRootIds = $state.raw(new Set<string>())')
  })
})
