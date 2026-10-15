# App.svelte 拆分计划

> 代码审查三轮第 7 项起步。`src/App.svelte` 是全站控制器：拆分前 1415 行（`<script>` 约 1155 行，模板约 260 行，无 `<style>`）。
> 每一步都应**独立可发布**：无行为变化、补纯逻辑单测、`lint` / `type-check` / `test` / `build` / `smoke` 全绿、首屏 `index-*.js` 不增大。

## 现状

- 依赖 `svelte@^5.57`，`svelte.config.js` 未开启 `runes`，App 及组件仍用 `$:` / `export let` / `on:`，即 **Svelte 5 的 legacy（兼容）模式**。第 8b 步起 App.svelte 单文件开启 runes（`<svelte:options runes />`），其余组件仍为 legacy。
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
3. **Splash 模板去重**（Q）→ `src/components/AppSplash.svelte`（`title` / `message` / `progress` / 渐变 id 前缀）。纯模板，需快照/渲染测试确认 DOM 不变；注意首屏体积。✅ 已完成（代码审查三轮第 9 项；实际 props 为 `gradientId` / `title` / `message` / `loading` / `progress`）。
4. **确认对话框控制器**（I）→ 在 `appConfirmDialog.ts` 增加 `createConfirmController(onChange)`（request / close，单 resolver 语义），App 订阅状态。✅ 已完成（代码审查三轮第 10 项；另有 `getState()`，用普通闭包控制器而非 store，App 在 `onChange` 中赋值 `confirmDialog`）。
5. **懒加载组件注册表**（C）→ 用一个 store 化的注册表替代 7 个 `let XxxComponent` + loader；注意必须保持 `import()` 字面量以免破坏分包（`firstScreenChunks` 测试兜底）。✅ 已完成（代码审查三轮第 11 项；`createLazyComponentRegistry`，每个组件一个只读 store，`import()` 字面量仍留在 App，chunk 列表不变）。
6. **启动 / 安装流程**（K、O）→ `appBootController.ts`（依赖注入 api / storage / 回调），这是逻辑最重、测试价值最高的一步，放在模式成熟后做。✅ 已完成（代码审查三轮第 12 项；`createAppBootController(deps)` 普通闭包控制器，持有 `booting` / `installState` / `recoverActive`，`rootError` / `currentView` / `loginModalOpen` 仍归 App 经回调读写；不新增 store 订阅；差分测试对照逐字复刻的原实现；App 1280 → 1104 行，首屏 `index` +1.49 kB）。原样保留的「重新检查」按钮把事件对象传进 `initializeApp` 的问题已由第 13 项修复（`retryInstallStatus`）。
7. **认证与 CRUD 用例**（L、M、N）→ 按领域拆 `appCategoryUseCases.ts` / `appBookmarkUseCases.ts`，保存/错误标志收进各自 store；分多次提交。
   - **7a 分类用例**（M 中的分类部分）→ `src/lib/appCategoryController.ts` 的 `createCategoryController(deps)`。✅ 已完成（代码审查三轮第 14 项；沿用 `appBootController` 的普通闭包 + `onChange` 而非 store，不新增 store 订阅；分类编辑框的打开 / 模式 / 表单 / 保存 / 删除中 / 错误 / 「从首页新建」标志与排序队列归控制器，`rootError` / `currentView` / `homeFocusCategoryId` 仍归 App 经回调写入；与书签共用的编辑意图计数器抽为 `src/lib/appEditIntent.ts` 的 `createEditIntentCounter()`，App 创建一个实例注入，书签代码改用同一实例；差分测试对照逐字复刻的原实现；App 1103 → 979 行，首屏 `index` 280.60 → 282.37 kB）。
   - **7b 书签用例**（M 中的书签部分：CRUD、批量删除 / 移动、排序、跨分类整理）→ `src/lib/appBookmarkController.ts` 的 `createBookmarkController(deps)`，注入同一个编辑意图计数器。✅ 已完成（代码审查三轮第 15 项；同 7a 的闭包 + `onChange` 形态；会话比较经注入的 `getSession`（`get(authStore).session`），默认分类经 `readAdminData`（`get(adminStore).data`）在原先的时机读取；App 979 → 835 行，首屏 `index` 282.37 → 284.12 kB）。
   - **7c 设置 / 改密 / 导入导出**（N）→ `src/lib/appSettingsController.ts` 的 `createSettingsController(deps)`。✅ 已完成（代码审查三轮第 16 项；同 7a / 7b 的闭包 + `onChange`，控制器持有 `saving` / `error` / `importExport`，App 只在 `importExport` 换了对象时才赋值；改密沿用原顺序：作废认证视图意图 → 清 `rootError` → 请求 → 清会话 → 重置分类编辑框 → 重置设置状态 → 重置书签编辑框 → 重置 adminStore → 清缓存 → 提示 → 懒加载登录框 → 打开登录；`authViewIntent` 改由 App 早于控制器创建并注入。为压缩首屏体积，App 新增一个共享依赖对象 `appDeps`（api / 计数器 / 登录态与数据读写 / 懒加载 / 确认框 / 刷新 / `rootError` / `loginModalOpen` / `currentView` 回调、分类与书签编辑框重置的转发），以展开方式传给启动、分类、书签与设置控制器，同名依赖只写一次；新控制器在入口一次性解构依赖。App 835 → 767 行，首屏 `index` 284.12 → 284.60 kB，gzip 96.47 → 96.76 kB）。
   - **7d 认证用例**（L 与 J）→ `src/lib/appAuthController.ts` 新增 `createAuthController(deps)`。✅ 已完成（代码审查三轮第 17 项；打开 / 关闭登录框、登录、登出、进入后台、忘记密码、`ensureLoggedInDataLoaded`、变更后刷新与统计页刷新；控制器不持有状态，`loginModalOpen` / `currentView` / `rootError` 仍归 App 经回调写入，认证视图意图仍由 App 创建并注入；登出经注入的 `resetCategories` / `resetSettings` / `resetBookmarks` 按原顺序重置；三个原先套了一层 async 的处理器保留包装。认证控制器最后创建，`appDeps` 中的 `openLogin` / `ensureLoggedInDataLoaded` / `refreshAdminDataAfterMutation` 改为转发给它的箭头函数（返回同一个 promise，兑现时机不变）。App 767 → 616 行，首屏 `index` 284.60 → 285.51 kB，gzip 96.76 → 96.95 kB）。
   - 第 7 步完成后 App `<script>` 只剩：imports、懒加载注册表、`appDeps` 与五个控制器的创建 / 接线、确认框、Spotlight / 书签查看 / 全局快捷键、数据服务回调、store 派生与登录闸门 `$:`、主题 / 根样式 / 自定义脚本、onMount / onDestroy。
8. **（后续阶段）Svelte 5 runes 迁移**：以上步骤完成、App 变薄后，再逐组件开启 runes（`<svelte:options runes />`），`$:` → `$derived` / `$effect`，`on:` → 事件属性，`<svelte:component>` → 动态组件。不与拆分混在同一提交。
   - **8a 组件级行为基线**：迁移前先在 jsdom 中真实挂载 App，钉住响应式部分的可观察行为（登录闸门及其「先于 DOM」的时机、主题 / 根样式写入与重跑条件、自定义脚本注入、Install / Recover 懒加载与加载失败提示的保持、21 条 `$:` 的效果、动态组件切换、全局快捷键、onMount / onDestroy 清理），只替换模块边界（五个控制器、dataService、懒加载分包、媒体查询、图标设备、焦点刷新、自定义脚本控制器；stores 与 rootStyleWriter 用真实实现）。✅ 已完成（代码审查三轮第 18 项；`tests/unit/appComponent.test.ts` 34 项 + `tests/helpers/appProbe/` 子组件替身；14 种对 App 的变异均有用例精确失败）。
   - **8b App.svelte 改为 runes**：只迁移 App，子组件保持 legacy（Svelte 5 支持混用）；8a 的测试必须不改一行地通过。✅ 已完成（代码审查三轮第 19 项；`<svelte:options runes />`；控制器经 onChange 写入的变量 → `$state`，其中对象值（`installState` / `activeCategory` / `activeBookmark` / `importExportState` / `confirmDialog` / `viewBookmark` / `customScriptController`）用 `$state.raw`，不做深层代理、同引用赋值即空操作，原有身份守卫保留；21 条 `$:` → 15 个 `$derived` + 6 个 `$effect.pre`（两条 Install / Recover 懒加载、登录闸门、主题写入、自定义 CSS、自定义脚本，均需与原先一样先于 DOM 更新执行）；`<svelte:component>` → 由懒加载 store 派生的动态组件；`on:keydown` → `onkeydown`。8a 测试在迁移后零改动通过；首屏 `index` 285.51 → 284.67 kB，gzip 96.95 → 96.83 kB）。已知差异（均不可观察，8a 已钉住全部功能性效果）：对象值 `$derived` 按 `===` 判等，store 以同一个 `data` 对象重复推送时不再把相同对象重推给子组件、也不再以相同内容重调 `customScript.apply`（原本即幂等空操作）；从回调里读派生值（`getAdminData` / `getCanSeeHome` 等）总是最新值，legacy 下在 store 写入后、下一次刷新前的同一同步段内可能读到旧值（现有调用点都在 await 或用户事件之后，不受影响）；两条懒加载副作用的源码位置移到派生值之后（`$effect.pre` 创建时同步执行一次，需避开 TDZ），执行顺序与原先 `$:` 拓扑排序后一致。
   - **8c+ 子组件分批迁移**（64 个 `export let` 组件，共 536 个 `export let`、304 条 `$:`、288 处 `on:`；另 `Toast.svelte` 无 props，可随任一批）。按目录、叶子优先（层级 = 依赖的本地 `.svelte` 组件的最大深度），每批独立提交、先补 / 复用组件级测试，再迁移；含 `createEventDispatcher` / `<slot>` 的组件改为回调 prop / snippet 时，同一提交内更新父组件调用处，父组件被 `bind:` 的 prop 用 `$bindable()`：
     | 批次 | 范围 | 数量 | 说明 |
     |---|---|---|---|
     | 8c | `components/` 根目录与 `admin/`、`settings/` 中的纯展示叶子：AdminSidebar、AppSplash、BookmarkCustomIconField、BookmarkIcon、BookmarkIconCandidateButton、BookmarkLinkModal、BookmarkModalActions、BookmarkModalHeader、DeviceIconCachePanel、HomeContentSummary、HomeEmptyPanel、LogoSchemeSelector、admin/AdminPageHeader、settings/FooterSettingsSection | 14 | 层级 0，无 `$:`、无 dispatcher；行为基线 `leafComponentsBehavior.test.ts` 已补（第 20 项） |
     | 8d | `components/` 有状态叶子：BackupPanel、CachedBookmarkIcon、CategoryIcon、CategoryTreeSelect、ConfirmDialog、HomeFloatingActions、LoginModal、PasswordChangePanel、SearchBox | 9 | 层级 0，共 43 条 `$:` |
     | 8e | `ui/` 与事件分发叶子：ui/InputGroup、ui/Slider、ui/Switch、ui/Tooltip、ColorAlphaInput、settings/GradientPresetSelector | 6 | 层级 0；5 个用 `createEventDispatcher`、2 个用 `<slot>`，需同步改父组件的 `on:` |
     | 8f | `views/` 叶子：Install、Recover | 2 | 层级 0，懒加载分包 |
     | 8g | 层级 1 首页 / 书签：BookmarkBaseFields、BookmarkCardCompact、BookmarkCardInfo、BookmarkContextMenu、BookmarkIconCandidatePicker、GradientBackgroundInput、HomeCategoryScope、HomeHeroSearch、IconifySelector、Sidebar、SpotlightBookmarkIcon | 11 | Sidebar 15 条 `$:` / 21 处 `on:` |
     | 8h | 层级 1 `admin/` 与 `settings/` 分区：admin/AnalyticsPanel、admin/BookmarkListPanel、admin/CategoryListPanel、settings/Background / Basic / Card / CategoryDisplay / Hero / Navigation / SearchEngine 七个 Section | 10 | 两个列表面板各 16 条 `$:` |
     | 8i | 层级 2：BookmarkCard、BookmarkEditModal、CategoryEditModal、SearchSpotlight、admin/AdminTabContent、settings/ThemeBackgroundCard | 6 | BookmarkCard 32 条 `$:` |
     | 8j | 层级 3–4 顶层：CategorySection、settings/AdvancedSettingsSection、settings/SettingsHomePreview、views/Admin、SettingsPanel、views/Home | 6 | Home 40 条 `$:`，最后迁移 |
