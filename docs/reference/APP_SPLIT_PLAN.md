# App.svelte 拆分计划

> 代码审查三轮第 7 项起步。`src/App.svelte` 是全站控制器：拆分前 1415 行（`<script>` 约 1155 行，模板约 260 行，无 `<style>`）。
> 每一步都应**独立可发布**：无行为变化、补纯逻辑单测、`lint` / `type-check` / `test` / `build` / `smoke` 全绿、首屏 `index-*.js` 不增大。

## 现状

- 依赖 `svelte@^5.57`，`svelte.config.js` 未开启 `runes`，App 及组件仍用 `$:` / `export let` / `on:`，即 **Svelte 5 的 legacy（兼容）模式**。
- 已有一批纯逻辑模块（`appAuthController`、`appInstall`、`appNavigation`、`appThemeState`、`appConfirmDialog`、`appModalState`、`appSortQueue`、`appImportExport`、`appLazyComponent`、`appData`、`dataService` 等），App 剩下的主要是「状态变量 + 用例编排 + 模板接线」。

## 职责分组（行号为第 1 步之后的 App.svelte，约值）

| # | 分组 | 行 | 说明 |
|---|------|----|------|
| A | imports / 根样式写入器 | 1–108 | — |
| B | 启动 / 视图状态 | 110–121 | `booting` / `installState` / `recoverActive` / `rootError` / `currentView` |
| C | 懒加载组件 | 122–196 | 7 个 `createLazyComponentLoader` + `loadLazyView` + 2 条 `$:` |
| D | 模态与 Spotlight 状态 | 198–232 | `anyBlockingModalOpen` / open/close Spotlight / 书签查看 |
| E | 全局快捷键 | 234–243 | **已抽出**到 `src/lib/appShortcuts.ts`，App 只剩执行 |
| F | 表单 / 保存状态 | 244–267 | 模态模式、active 表单、saving/deleting/error 标志 |
| G | 数据服务接线与派生 | 269–297 | `configureDataService` 回调、store 派生、登录闸门 `$:` |
| H | 主题 / 根样式 / 自定义脚本 | 299–333 | 系统深色媒体查询、`resolveAppThemeState`、`rootStyleWriter`、`customScriptController` |
| I | 确认对话框 | 335–357 | resolver promise |
| J | 登录态数据加载 | 359–402 | `ensureLoggedInDataLoaded` / 变更后刷新 / 统计页刷新 |
| K | 安装 / 找回 / 启动流程 | 404–576 | 安装探测、`initializeApp`、`revealHomeFromCurrentData` |
| L | 认证用例 | 578–708 | 登录 / 登出 / 进入后台 |
| M | 分类 / 书签 CRUD、批量、排序 | 710–983、1018–1060 | 最大块，依赖 F 的状态与 I |
| N | 设置 / 改密 / 导入导出 | 984–1017、1062–1080 | — |
| O | 找回 / 安装跳转 | 1082–1104 | — |
| P | 生命周期 | 1106–1140 | onMount / onDestroy：图标设备、主题偏好、媒体查询、焦点刷新 |
| Q | 模板 | 1143–1401 | 3 段几乎相同的 splash SVG、视图分支、模态挂载 |

## 有序提取步骤

1. **全局快捷键决策**（E）→ `src/lib/appShortcuts.ts`（`resolveGlobalShortcut` / `isTypingTarget`）。✅ 本次完成。
2. **媒体查询订阅**（H、P 中的 `prefers-color-scheme` / `prefers-reduced-motion`）→ `src/lib/appMediaPreferences.ts`：`subscribeSystemDark(onChange) → stop`、`readReducedMotion()`，onMount/onDestroy 只调用。✅ 已完成（代码审查三轮第 8 项）。
3. **Splash 模板去重**（Q）→ `src/components/AppSplash.svelte`（`title` / `message` / `progress` / 渐变 id 前缀）。纯模板，需快照/渲染测试确认 DOM 不变；注意首屏体积。
4. **确认对话框控制器**（I）→ 在 `appConfirmDialog.ts` 增加 `createConfirmController(onChange)`（request / close，单 resolver 语义），App 订阅状态。
5. **懒加载组件注册表**（C）→ 用一个 store 化的注册表替代 7 个 `let XxxComponent` + loader；注意必须保持 `import()` 字面量以免破坏分包（`firstScreenChunks` 测试兜底）。
6. **启动 / 安装流程**（K、O）→ `appBootController.ts`（依赖注入 api / storage / 回调），这是逻辑最重、测试价值最高的一步，放在模式成熟后做。
7. **认证与 CRUD 用例**（L、M、N）→ 按领域拆 `appCategoryUseCases.ts` / `appBookmarkUseCases.ts`，保存/错误标志收进各自 store；分多次提交。
8. **（后续阶段）Svelte 5 runes 迁移**：以上步骤完成、App 变薄后，再逐组件开启 runes（`<svelte:options runes />`），`$:` → `$derived` / `$effect`，`on:` → 事件属性，`<svelte:component>` → 动态组件。不与拆分混在同一提交。
