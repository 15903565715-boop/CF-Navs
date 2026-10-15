import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// 代码审查三轮第 20 项（APP_SPLIT_PLAN 第 8c 步）：14 个层级 0 纯展示组件改为 runes 模式的源码护栏。
// 行为等价由 tests/unit/leafComponentsBehavior.test.ts（迁移前写成、迁移时未改）及 appSplash /
// deviceIconCachePanel / bookmarkIconTimeout 保证。
// 第 21 项（第 8d 步）追加 9 个层级 0 有状态组件，行为等价由 statefulLeafComponentsBehavior /
// cachedBookmarkIconBehavior（迁移前写成、迁移时未改）及各组件原有测试保证。
const STATEFUL = [
  'BackupPanel',
  'CachedBookmarkIcon',
  'CategoryIcon',
  'CategoryTreeSelect',
  'ConfirmDialog',
  'HomeFloatingActions',
  'LoginModal',
  'PasswordChangePanel',
  'SearchBox',
]

const MIGRATED = [
  'AdminSidebar',
  'AppSplash',
  'BookmarkCustomIconField',
  'BookmarkIcon',
  'BookmarkIconCandidateButton',
  'BookmarkLinkModal',
  'BookmarkModalActions',
  'BookmarkModalHeader',
  'DeviceIconCachePanel',
  'HomeContentSummary',
  'HomeEmptyPanel',
  'LogoSchemeSelector',
  'admin/AdminPageHeader',
  'settings/FooterSettingsSection',
  ...STATEFUL,
]

describe('level-0 presentational and stateful components in runes mode', () => {
  it.each(MIGRATED)('%s opts into runes and drops the legacy syntax', (name) => {
    const source = readFileSync(`src/components/${name}.svelte`, 'utf8')
    const script = source.slice(source.indexOf('<script'), source.indexOf('</script>'))
    const markup = source.slice(source.indexOf('</script>'))

    expect(source.startsWith('<svelte:options runes />')).toBe(true)
    expect(script).not.toMatch(/\bexport let\b/)
    expect(script).not.toMatch(/^\s*\$:/m)
    expect(script).not.toContain('createEventDispatcher')
    expect(source).not.toMatch(/\$\$(props|restProps|slots)/)
    expect(markup).not.toMatch(/\son:[a-z]+[=|]/)
    expect(markup).not.toContain('<slot')
    expect(script).toMatch(/\}: Props = \$props\(\)/)
    expect(script).not.toMatch(/\b(beforeUpdate|afterUpdate)\b/)
  })

  it('keeps the props that legacy parents bind: two-way bindable', () => {
    const read = (path: string) => readFileSync(path, 'utf8')
    expect(read('src/components/CategoryTreeSelect.svelte')).toContain('value = $bindable(undefined)')
    expect(read('src/components/SearchBox.svelte')).toContain("query = $bindable('')")
    expect(read('src/components/BackupPanel.svelte')).toContain("importSource = $bindable('cf-navs')")
    expect(read('src/components/HomeHeroSearch.svelte')).toMatch(/<SearchBox[^>]*\bbind:query\b/)
    expect(read('src/components/admin/AdminTabContent.svelte')).toMatch(/<BackupPanel[^>]*\bbind:importSource\b/)
    expect(read('src/components/BookmarkContextMenu.svelte')).toMatch(/<CategoryTreeSelect[^>]*\bbind:value=\{moveCategoryId\}/)
  })

  it('does not deep-proxy replaced Sets or trusted-icon snapshots', () => {
    const read = (path: string) => readFileSync(path, 'utf8')
    expect(read('src/components/BackupPanel.svelte')).toContain('let selectedCategoryIds = $state.raw(')
    expect(read('src/components/BackupPanel.svelte')).toContain('let expandedRootIds = $state.raw(')
    expect(read('src/components/CategoryTreeSelect.svelte')).toContain('let expandedRootIds = $state.raw(')
    expect(read('src/components/CachedBookmarkIcon.svelte')).toContain('let trustedImage = $state.raw(emptyTrustedIcon)')
    expect(read('src/components/CategoryIcon.svelte')).toContain('let trustedState: TrustedIconState = $state.raw(emptyTrustedIcon)')
  })

  it('keeps the form two-way bindable for SettingsPanel', () => {
    const footer = readFileSync('src/components/settings/FooterSettingsSection.svelte', 'utf8')
    expect(footer).toContain('form = $bindable()')
    expect(readFileSync('src/components/SettingsPanel.svelte', 'utf8')).toContain('<FooterSettingsSection bind:form {saving} />')
  })

  it('keeps the device panel busy / error flags reactive', () => {
    const panel = readFileSync('src/components/DeviceIconCachePanel.svelte', 'utf8')
    expect(panel).toContain('let busy = $state(false)')
    expect(panel).toContain("let localError = $state('')")
  })
})
