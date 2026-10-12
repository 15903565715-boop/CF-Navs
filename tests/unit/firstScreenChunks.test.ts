import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// 接线断言（代码审查二轮第 4 项）：这些模块只在少见路径用到，必须保持动态导入，
// 否则会重新进入首屏 index chunk。实际 chunk 拆分以 `npm run build` 输出为准。
describe('first-screen chunk wiring', () => {
  const app = readFileSync('src/App.svelte', 'utf8')
  const card = readFileSync('src/components/BookmarkCard.svelte', 'utf8')
  const appData = readFileSync('src/lib/appData.ts', 'utf8')

  it('loads install and recover views on demand', () => {
    expect(app).not.toMatch(/import\s+(Install|Recover)\s+from/)
    expect(app).toContain("import('./views/Install.svelte')")
    expect(app).toContain("import('./views/Recover.svelte')")
  })

  it('keeps the context menu and full theme presets out of the home path', () => {
    expect(card).not.toMatch(/import\s+BookmarkContextMenu\s+from/)
    expect(appData).not.toContain("from './themePresets'")
    expect(appData).toContain("from './themePresetRender'")
  })
})
