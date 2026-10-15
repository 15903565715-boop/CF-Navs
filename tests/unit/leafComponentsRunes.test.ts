import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// 代码审查三轮第 20 项（APP_SPLIT_PLAN 第 8c 步）：14 个层级 0 纯展示组件改为 runes 模式的源码护栏。
// 行为等价由 tests/unit/leafComponentsBehavior.test.ts（迁移前写成、迁移时未改）及 appSplash /
// deviceIconCachePanel / bookmarkIconTimeout 保证。
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
]

describe('level-0 presentational components in runes mode', () => {
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
