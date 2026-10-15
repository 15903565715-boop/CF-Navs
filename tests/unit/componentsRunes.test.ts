import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// 代码审查三轮第 23 项起（APP_SPLIT_PLAN 第 8f 步起）：层级 0 视图与层级 1+ 组件改为 runes 模式的源码护栏。
// 8c–8e 的 29 个叶子见 tests/unit/leafComponentsRunes.test.ts。行为等价由各批迁移前写成、迁移时未改的行为基线保证：
// 8f viewsBehavior。

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
