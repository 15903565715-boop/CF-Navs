<script lang="ts">
  import { startIconDevice } from './lib/iconDeviceState'
  let stopIconDevice: (() => void) | undefined
  import { onDestroy, onMount, tick } from 'svelte'
  import { get } from 'svelte/store'
  import { fade } from 'svelte/transition'
  import {
    type LoginResp,
    type PublicBookmark,
    type Settings,
    type ThemeMode,
  } from '../shared/types'
  import AppSplash from './components/AppSplash.svelte'
  import ConfirmDialog from './components/ConfirmDialog.svelte'
  import Toast from './components/Toast.svelte'
  import Home from './views/Home.svelte'
  import BookmarkLinkModal from './components/BookmarkLinkModal.svelte'
  import { api, getErrorMessage, isUnauthorizedError } from './lib/api'
  import { clearCachedAdminData } from './lib/adminDataCache'
  import { clearCachedPublicData } from './lib/publicDataCache'
  import { toastStore } from './lib/toast'
  import type { AdminTab } from './lib/adminTypes'
  import { createAuthViewIntent, logoutRevocationWarning } from './lib/appAuthController'
  import {
    createConfirmController,
    type ConfirmDialogInput,
    type ConfirmDialogState,
  } from './lib/appConfirmDialog'
  import {
    buildHomeBackground,
    toAdminBookmarks,
    toAdminCategories,
    toSettingsForm,
  } from './lib/appData'
  import { createLazyComponentRegistry } from './lib/appLazyComponent'
  import {
    createBrowserCustomScriptHost,
    createCustomScriptController,
    type CustomScriptController,
  } from './lib/customScript'
  import { getInstallViewState, replaceBrowserPath } from './lib/appInstall'
  import { createAppBootController, getBrowserInstallHintStorage } from './lib/appBootController'
  import { readReducedMotion, subscribeSystemDark } from './lib/appMediaPreferences'
  import { createEditIntentCounter } from './lib/appEditIntent'
  import { createCategoryController } from './lib/appCategoryController'
  import { createBookmarkController } from './lib/appBookmarkController'
  import { createSettingsController } from './lib/appSettingsController'
  import {
    canSeeHomeView,
    createHomeGateState,
    shouldOpenLoginGate,
    type AppView,
  } from './lib/appNavigation'
  import { resolveGlobalShortcut } from './lib/appShortcuts'
  import { getAdminBookmarkCategoryOptions } from './lib/adminListState'
  import { getNextThemePreference, resolveAppThemeState } from './lib/appThemeState'
  import { installPublicDataFocusRefresh } from './lib/publicDataFocusRefresh'
  import { adminStore, authStore, configStore, isAuthenticated, publicStore } from './lib/stores'
  import { readPreferredThemeMode, writePreferredThemeMode } from './lib/themePreference'
  import {
    applyConfigFromSettings,
    applyLocalBookmarkDelete,
    applyLocalBookmarkSort,
    applyLocalBookmarkUpsert,
    applyLocalCategoryDelete,
    applyLocalCategorySort,
    applyLocalCategoryUpsert,
    applyLocalSettings,
    applyLoggedInData,
    configureDataService,
    isLoggedIn,
    persistCurrentAdminData,
    refreshBookmarkIconCacheInBackground,
    readAdminDataForEdit,
    refreshLoggedInData,
    refreshPublicData,
    refreshVisibleData,
  } from './lib/dataService'
  import { createRootStyleWriter } from './lib/rootStyleWriter'

  const rootStyleWriter = typeof document !== 'undefined' ? createRootStyleWriter(document) : null

  let rootError = ''
  let currentView: AppView = 'home'

  function isAdminPath(): boolean {
    if (typeof window === 'undefined') return false
    return window.location.pathname === '/admin' || window.location.pathname === '/admin/'
  }
  // 7 个按需加载的视图 / 模态。保持 `import()` 字面量，Vite 才会按原样分包（firstScreenChunks 测试兜底）。
  // 安装 / 找回密码视图只在首次部署或忘记密码时出现，不进首屏 chunk（代码审查二轮第 4 项）。
  const lazyComponents = createLazyComponentRegistry({
    Admin: () => import('./views/Admin.svelte'),
    LoginModal: () => import('./components/LoginModal.svelte'),
    BookmarkEditModal: () => import('./components/BookmarkEditModal.svelte'),
    CategoryEditModal: () => import('./components/CategoryEditModal.svelte'),
    SearchSpotlight: () => import('./components/SearchSpotlight.svelte'),
    Install: () => import('./views/Install.svelte'),
    Recover: () => import('./views/Recover.svelte'),
  })
  const {
    Admin: AdminComponent,
    LoginModal: LoginModalComponent,
    BookmarkEditModal: BookmarkEditModalComponent,
    CategoryEditModal: CategoryEditModalComponent,
    SearchSpotlight: SearchSpotlightComponent,
    Install: InstallComponent,
    Recover: RecoverComponent,
  } = lazyComponents.components
  // 分类与书签共用一个编辑意图计数器（见 lib/appEditIntent），两个控制器注入同一个实例。
  const editIntent = createEditIntentCounter()
  const authViewIntent = createAuthViewIntent()
  // 各用例控制器共用的同名依赖只在这里写一次，再展开进每个控制器：依赖对象的属性名不会被压缩，
  // 逐个控制器重复书写会让首屏 index 每步多出约 1.7 kB。每个控制器只取自己声明的那几项；
  // 编辑框重置经箭头函数转发给稍后创建的控制器（只在用户操作时调用）。
  const appDeps = {
    api,
    editIntent,
    authViewIntent,
    isLoggedIn,
    isAdminPath,
    getPublicMode: () => get(configStore).data?.public_mode,
    getAdminData: () => adminData,
    setSession: (session: LoginResp | null) => authStore.setSession(session),
    resetAdminData: () => adminStore.reset(),
    clearCachedAdminData,
    refreshLoggedInData,
    refreshPublicData,
    readAdminDataForEdit,
    persistCurrentAdminData,
    requestConfirmation,
    ensureLazyComponent: lazyComponents.ensure,
    openLogin: handleOpenLogin,
    ensureLoggedInDataLoaded,
    refreshAdminDataAfterMutation,
    resetCategories: () => categoryController.reset(),
    resetBookmarks: () => bookmarkController.reset(),
    setRootError: (message: string) => {
      rootError = message
    },
    setLoginModalOpen: (open: boolean) => {
      loginModalOpen = open
    },
    setCurrentView: (view: AppView) => {
      currentView = view
    },
  }
  // 启动 / 安装 / 找回流程见 lib/appBootController：控制器持有 booting / installState / recoverActive，
  // rootError / currentView / loginModalOpen 仍归 App，经下列回调在原先的时机读写。
  const boot = createAppBootController({
    ...appDeps,
    onChange: (next) => {
      booting = next.booting
      recoverActive = next.recoverActive
      // 只在控制器真正换了对象时赋值：Svelte 对对象的同引用赋值也会触发依赖，
      // 否则 booting 变化会连带重跑 installView 与 Install 分包加载语句。
      if (installState !== next.installState) installState = next.installState
    },
    installApi: api.install,
    getInstallHintStorage: getBrowserInstallHintStorage,
    getPathname: () => typeof window === 'undefined' ? null : window.location.pathname,
    replacePath: replaceBrowserPath,
    clearCachedPublicData,
    initializeAuth: () => authStore.initialize(),
    getRootError: () => rootError,
  })
  let { booting, installState, recoverActive } = boot.getState()
  let lazyViewError = ''
  let confirmDialog: ConfirmDialogState | null = null
  const confirmController = createConfirmController((next) => {
    confirmDialog = next
  })

  function loadLazyView(name: 'Install' | 'Recover'): void {
    lazyViewError = ''
    void lazyComponents.ensure(name).catch((error) => {
      console.warn('[CF-Navs] failed to load view chunk', error)
      lazyViewError = '页面资源加载失败，请检查网络后刷新重试。'
    })
  }
  // 加载期间沿用启动 splash；失败时在 splash 上给出可读提示而不是一直转圈。
  $: if (recoverActive && !$RecoverComponent) loadLazyView('Recover')
  $: if (!recoverActive && installView && !$InstallComponent) loadLazyView('Install')

  let loginModalOpen = false
  let homeFocusCategoryId: number | null = null
  let spotlightOpen = false
  let viewBookmark: PublicBookmark | null = null

  function anyBlockingModalOpen(): boolean {
    return loginModalOpen || categoryModalOpen || bookmarkModalOpen || Boolean(confirmDialog) || Boolean(viewBookmark)
  }

  async function openSpotlight(): Promise<void> {
    if (spotlightOpen || anyBlockingModalOpen()) return
    if (currentView !== 'home' || !canSeeHome) return
    await lazyComponents.ensure('SearchSpotlight')
    // 懒加载是异步的：其间可能开了模态或切了视图/登出。加载完成后重新校验，
    // 否则会与刚打开的模态并发出现，破坏 D-e 模态互斥与单槽滚动锁。
    if (spotlightOpen || anyBlockingModalOpen()) return
    if (currentView !== 'home' || !canSeeHome) return
    spotlightOpen = true
  }

  function closeSpotlight(): void {
    spotlightOpen = false
  }

  function openBookmarkView(bookmark: PublicBookmark): void {
    viewBookmark = bookmark
  }

  function closeBookmarkView(): void {
    viewBookmark = null
  }

  // 全局快捷键集中在 App：决策逻辑见 lib/appShortcuts（Ctrl+K / Cmd+K / 「/」 唤起 Spotlight，Esc 关闭）；
  // 模态互斥由 openSpotlight 内部把关。
  function handleGlobalKeyDown(event: KeyboardEvent): void {
    const action = resolveGlobalShortcut(event, { homeActive: currentView === 'home' && canSeeHome, spotlightOpen })
    if (!action) return
    event.preventDefault()
    if (action === 'close-spotlight') closeSpotlight()
    else void openSpotlight()
  }

  let preferredThemeMode: ThemeMode | null = null
  let prefersReducedMotion = false
  // 只在浏览器里创建：SSR/测试环境没有 document 和 URL.createObjectURL。
  let customScriptController: CustomScriptController | null = null

  configureDataService({
    onRootError: (message, error) => {
      rootError = message
      boot.recordDataError(error)
    },
    onLocalSnapshotRestored: () => {
      boot.revealHomeFromCurrentData()
    },
    onNetworkFallback: (message) => {
      toastStore.addToast(message, 'info', { duration: 8000 })
    },
  })

  $: installView = getInstallViewState(installState)
  $: config = $configStore.data
  $: publicData = $publicStore.data
  $: adminData = $adminStore.data
  $: canSeeHome = canSeeHomeView({ publicMode: config?.public_mode, authenticated: $isAuthenticated })
  $: homeTitle = publicData?.settings.site_title ?? config?.site_title ?? 'CF-Navs'

  $: adminCategories = toAdminCategories(adminData.categories, adminData.bookmarks)
  $: adminBookmarks = toAdminBookmarks(adminData.bookmarks)
  $: settingsValue = toSettingsForm(adminData.settings)

  $: if (shouldOpenLoginGate({ booting, currentView, canSeeHome })) {
    void lazyComponents.ensure('LoginModal')
    loginModalOpen = true
    currentView = 'login'
  }

  let systemPrefersDark = false
  let stopSystemDark: (() => void) | null = null
  let stopPublicDataFocusRefresh: (() => void) | null = null

  $: resolvedThemeState = resolveAppThemeState({
    preferredThemeMode,
    configuredThemeMode: publicData?.settings.theme,
    systemPrefersDark,
  })
  $: themeMode = resolvedThemeState.themeMode
  $: activeTheme = resolvedThemeState.activeTheme

  $: homeBackgroundStyle = buildHomeBackground(publicData?.settings ?? null, activeTheme)

  // 主题 / 背景变量与自定义 CSS 分成两条响应式语句，只依赖各自的原始值（字符串相等即不重跑），
  // 写入口内部再按内容去重：书签、点击计数、图标状态变化不再重写全局样式。
  $: rootBackgroundPresetId = publicData?.settings.background_preset_id ?? 'custom'
  $: customCss = publicData?.settings?.custom_css ?? ''
  $: rootStyleWriter?.applyTheme({ theme: activeTheme, backgroundPresetId: rootBackgroundPresetId, backgroundStyle: homeBackgroundStyle })
  $: rootStyleWriter?.applyCustomCss(customCss)

  // 自定义 JS 单独走一条响应式语句：上面那个块还依赖 activeTheme 和
  // homeBackgroundStyle，写在里面的话切个主题就会把用户脚本重跑一遍。
  // controller 内部还做了幂等，即使这条语句被多余触发也不会重复执行。
  $: customScriptController?.apply(publicData?.settings?.custom_js)

  function setPreferredThemeMode(mode: ThemeMode): void {
    preferredThemeMode = mode
    writePreferredThemeMode(mode)
  }

  function handleToggleTheme(): void {
    setPreferredThemeMode(getNextThemePreference(themeMode))
  }

  function requestConfirmation(options: ConfirmDialogInput): Promise<boolean> {
    return confirmController.request(options)
  }

  function handleConfirmDialogConfirm(): void {
    confirmController.close(true)
  }

  function handleConfirmDialogCancel(): void {
    confirmController.close(false)
  }

  async function ensureLoggedInDataLoaded(): Promise<boolean> {
    if (!isLoggedIn()) return false

    const current = get(adminStore)
    if (current.loaded && current.data.settings) {
      return true
    }

    try {
      await refreshLoggedInData()
      return isLoggedIn() && get(adminStore).loaded
    } catch (error) {
      if (isUnauthorizedError(error)) {
        authStore.setSession(null)
        adminStore.reset()
        await clearCachedAdminData()
        await refreshPublicData()
        await handleOpenLogin()
        return false
      }

      rootError = getErrorMessage(error)
      return false
    }
  }

  async function refreshAdminDataAfterMutation(): Promise<void> {
    try {
      await refreshLoggedInData(true)
    } catch (error) {
      // 写入已经成功；刷新失败时保留本地即时结果，并提示用户稍后重试。
      rootError = getErrorMessage(error)
    }
  }

  async function handleAdminTabChange(tab: AdminTab): Promise<void> {
    if (tab !== 'analytics') return

    try {
      await refreshLoggedInData(true)
    } catch (error) {
      rootError = getErrorMessage(error)
    }
  }

  // 分类的打开 / 编辑 / 提交 / 删除 / 批量删除 / 排序见 lib/appCategoryController：控制器持有分类编辑框状态，
  // rootError / currentView / homeFocusCategoryId 仍归 App，经下列回调在原先的时机写入。
  const categoryController = createCategoryController({
    ...appDeps,
    onChange: (next) => {
      categoryModalOpen = next.modalOpen
      categoryModalMode = next.modalMode
      // 同引用不赋值：Svelte 对对象的同引用赋值也会触发依赖（会把同一份 value 再推给编辑框）。
      if (activeCategory !== next.active) activeCategory = next.active
      savingCategory = next.saving
      deletingCategoryId = next.deletingId
      categoryError = next.error
      categoryCreateReturnToHome = next.createReturnToHome
    },
    applyLocalCategoryUpsert,
    applyLocalCategoryDelete,
    applyLocalCategorySort,
    setHomeFocusCategoryId: (id) => {
      homeFocusCategoryId = id
    },
    tick,
  })
  let {
    modalOpen: categoryModalOpen,
    modalMode: categoryModalMode,
    active: activeCategory,
    saving: savingCategory,
    deletingId: deletingCategoryId,
    error: categoryError,
    createReturnToHome: categoryCreateReturnToHome,
  } = categoryController.getState()

  // 书签的新建 / 编辑 / 提交 / 删除 / 批量删除 / 批量移动 / 排序 / 跨分类整理见 lib/appBookmarkController，
  // 与分类控制器共用同一个 editIntent。
  const bookmarkController = createBookmarkController({
    ...appDeps,
    onChange: (next) => {
      bookmarkModalOpen = next.modalOpen
      bookmarkModalMode = next.modalMode
      if (activeBookmark !== next.active) activeBookmark = next.active
      savingBookmark = next.saving
      deletingBookmarkId = next.deletingId
      bookmarkError = next.error
    },
    getSession: () => get(authStore).session,
    readAdminData: () => get(adminStore).data,
    applyLocalBookmarkUpsert,
    applyLocalBookmarkDelete,
    applyLocalBookmarkSort,
    refreshBookmarkIconCacheInBackground,
  })
  let {
    modalOpen: bookmarkModalOpen,
    modalMode: bookmarkModalMode,
    active: activeBookmark,
    saving: savingBookmark,
    deletingId: deletingBookmarkId,
    error: bookmarkError,
  } = bookmarkController.getState()

  // 设置保存 / 改密 / 导入导出见 lib/appSettingsController：控制器持有保存中 / 错误与导入导出状态。
  const settingsController = createSettingsController({
    ...appDeps,
    onChange: (next) => {
      savingSettings = next.saving
      settingsError = next.error
      if (importExportState !== next.importExport) importExportState = next.importExport
    },
    applyLocalSettings,
    applyLoggedInData,
  })
  let {
    saving: savingSettings,
    error: settingsError,
    importExport: importExportState,
  } = settingsController.getState()

  async function openLoginUseCase(): Promise<void> {
    authViewIntent.invalidate()
    rootError = ''
    authStore.resetError()
    await lazyComponents.ensure('LoginModal')
    loginModalOpen = true
    if (!canSeeHome) currentView = 'login'
  }
  async function handleOpenLogin(): Promise<void> {
    await openLoginUseCase()
  }

  async function handleCloseLogin(): Promise<void> {
    authViewIntent.invalidate()
    authStore.resetError()
    if (!canSeeHome) {
      loginModalOpen = true
      currentView = 'login'
      return
    }

    loginModalOpen = false
  }

  async function handleSwitchToAdmin(): Promise<void> {
    await openAdminUseCase()
  }

  async function completeLoginUseCase(payload: { username: string; password: string }): Promise<void> {
    authViewIntent.invalidate()
    await authStore.login(payload.username, payload.password)
    loginModalOpen = false
    rootError = ''
    await refreshLoggedInData(true)
    if (isAdminPath()) {
      await lazyComponents.ensure('Admin')
      currentView = 'admin'
      return
    }
    currentView = 'home'
  }
  async function handleLogin(payload: { username: string; password: string }): Promise<void> {
    try {
      await completeLoginUseCase(payload)
    } catch {
      // authStore 已经记录错误
    }
  }

  async function completeLogoutUseCase(previousSettings: Settings | null): Promise<string | null> {
    const revocationWarning = logoutRevocationWarning(await authStore.logout())
    if (isLoggedIn()) return revocationWarning
    categoryController.reset()
    settingsController.reset()
    bookmarkController.reset()
    adminStore.reset()
    await clearCachedAdminData()
    if (isLoggedIn()) return revocationWarning
    if (previousSettings) {
      applyConfigFromSettings(previousSettings)
    }
    await refreshPublicData()
    return revocationWarning
  }

  async function handleLogout(): Promise<void> {
    const viewIsCurrent = authViewIntent.begin()
    rootError = ''
    const previousSettings = get(adminStore).data.settings

    try {
      const revocationWarning = await completeLogoutUseCase(previousSettings)

      const homeGate = createHomeGateState({
        publicMode: get(configStore).data?.public_mode,
        authenticated: false,
      })
      if (viewIsCurrent() && !isLoggedIn()) {
        if (homeGate.loginModalOpen) await lazyComponents.ensure('LoginModal')
        // Lazy loading can yield to another login/recovery action as well.
        if (viewIsCurrent() && !isLoggedIn()) {
          loginModalOpen = homeGate.loginModalOpen
          currentView = homeGate.view
        }
      }
      // 视图先切换，确保全局 Toast 不被登出后的页面切换影响。
      if (revocationWarning) {
        toastStore.addToast(revocationWarning, 'error', { duration: 12000 })
      }
    } catch (error) {
      if (viewIsCurrent()) rootError = getErrorMessage(error)
    }
  }

  async function openAdminUseCase(): Promise<void> {
    if (!isLoggedIn()) {
      await handleOpenLogin()
      return
    }

    if (!await ensureLoggedInDataLoaded()) {
      return
    }

    await lazyComponents.ensure('Admin')
    replaceBrowserPath('/admin')
    currentView = 'admin'
  }
  function handleForgotPassword(): void {
    authViewIntent.invalidate()
    // 忘记密码是登录态的子流程，按模态语义处理：不改 URL，避免 pushState 制造一个没有
    // popstate 监听的历史项（后退键会让 URL 与视图错位）。直达 /recover 仍由 onMount 处理。
    loginModalOpen = false
    boot.enterRecover()
  }

  onMount(() => {
    stopIconDevice = startIconDevice()
    preferredThemeMode = readPreferredThemeMode()
    customScriptController = createCustomScriptController(createBrowserCustomScriptHost())

    prefersReducedMotion = readReducedMotion()
    stopSystemDark = subscribeSystemDark((prefersDark) => {
      systemPrefersDark = prefersDark
    })

    // 直达 /recover 时只进入找回流程，不继续启动，也不安装焦点刷新。
    if (!boot.start()) return
    // 切回已打开的标签页时按会话状态刷新（Issue #25 跨标签页设置同步 / Issue #29
    // 登录态保留私密视图）：登录态走登录态聚合刷新，未登录走公开刷新。
    stopPublicDataFocusRefresh = installPublicDataFocusRefresh(() => refreshVisibleData())
  })

  onDestroy(() => {
    stopIconDevice?.()
    stopSystemDark?.()
    // 不 revoke 的话每次重建都会漏一个 blob URL。
    customScriptController?.destroy()
    stopPublicDataFocusRefresh?.()
  })
</script>

<svelte:window on:keydown={handleGlobalKeyDown} />

{#if recoverActive && $RecoverComponent}
  <svelte:component
    this={$RecoverComponent}
    onRecovered={boot.recovered}
    onGoInstall={boot.goInstall}
    onCancel={boot.cancelRecover}
  />
{:else if !recoverActive && installView && $InstallComponent}
  <svelte:component
    this={$InstallComponent}
    mode={installView.mode}
    missingBindings={installView.missingBindings}
    schemaVersion={installView.schemaVersion}
    installing={installView.installing}
    error={installView.error}
    onInstall={boot.install}
    onRetryStatus={boot.retryInstallStatus}
  />
{:else if booting || recoverActive || installView}
  <AppSplash
    gradientId="splash-spinner-grad-boot"
    loading
    title={lazyViewError ? '页面加载失败' : '正在加载项目数据...'}
    message={lazyViewError ? lazyViewError : '前端状态与后端接口正在初始化，请稍候。'}
    progress={{ label: '初始化数据', status: '同步中' }}
  />
{:else}
  <div class="app-shell" in:fade={{ duration: prefersReducedMotion ? 0 : 260, delay: prefersReducedMotion ? 0 : 60 }}>
    <Toast />
    {#if rootError}
      <div class="app-alert">{rootError}</div>
    {/if}

    {#if currentView === 'home' && canSeeHome}
      <div style={homeBackgroundStyle}>
        <Home
          categories={publicData?.categories ?? []}
          bookmarks={publicData?.bookmarks ?? []}
          settings={publicData?.settings ?? null}
          title={homeTitle}
          isAuthenticated={$isAuthenticated}
          authLoading={$authStore.loading}
          onOpenCreateCategory={categoryController.openCreate}
          onOpenCreateRootCategory={categoryController.openCreateRoot}
          focusCategoryId={homeFocusCategoryId}
          onOpenCreateBookmark={bookmarkController.openCreate}
          onEditBookmark={bookmarkController.openEdit}
          onReorganizeBookmarks={bookmarkController.reorganize}
          onSwitchToAdmin={handleSwitchToAdmin}
          onLogout={handleLogout}
          onOpenLogin={handleOpenLogin}
          activeTheme={activeTheme}
          activeThemeMode={themeMode}
          onToggleTheme={handleToggleTheme}
          onOpenSearch={openSpotlight}
        />
      </div>
    {:else if currentView === 'login'}
      <AppSplash
        gradientId="splash-spinner-grad-login"
        title="请先登录管理员账号"
        message="当前站点未公开，登录后再加载后台管理界面。"
      />
    {:else if $AdminComponent}
      <svelte:component
        this={$AdminComponent}
        isAuthenticated={$isAuthenticated}
        authLoading={$authStore.loading}
        categories={adminCategories}
        bookmarks={adminBookmarks}
        categoriesLoading={$adminStore.loading}
        bookmarksLoading={$adminStore.loading}
        savingCategory={savingCategory}
        deletingCategoryId={deletingCategoryId}
        deletingBookmarkId={deletingBookmarkId}
        categoryError={categoryError}
        settingsLoading={$adminStore.loading && !adminData.settings}
        settingsSaving={savingSettings}
        settingsError={settingsError}
        settingsValue={settingsValue}
        categoryModalOpen={categoryModalOpen}
        categoryModalMode={categoryModalMode}
        activeCategory={activeCategory}
        canSeeHome={canSeeHome}
        onOpenLogin={handleOpenLogin}
        onLogout={handleLogout}
      onSwitchToHome={() => { replaceBrowserPath('/'); currentView = 'home' }}
        onOpenCreateCategory={categoryController.openCreate}
        onEditCategory={categoryController.openEdit}
        onDeleteCategory={categoryController.remove}
        onBatchDeleteCategories={categoryController.batchRemove}
        onCloseCategoryModal={categoryController.close}
        onSubmitCategory={categoryController.submit}
        onOpenCreateBookmark={bookmarkController.openCreate}
        onEditBookmark={bookmarkController.openEdit}
        onDeleteBookmark={bookmarkController.remove}
        onBatchDeleteBookmarks={bookmarkController.batchRemove}
        onBatchMoveBookmarks={bookmarkController.batchMove}
        onSubmitSettings={settingsController.submit}
        onVerifyDevice={() => refreshLoggedInData(true)}
        onChangePassword={settingsController.changePassword}
        onSortCategories={categoryController.sort}
        onSortBookmarks={bookmarkController.sort}
        onSelectTab={handleAdminTabChange}
        importing={importExportState.importing}
        exporting={importExportState.exporting}
        backupError={importExportState.backupError}
        backupMessage={importExportState.backupMessage}
        onExportData={settingsController.exportData}
        onImportData={settingsController.importData}
      />
    {:else}
      <AppSplash
        gradientId="splash-spinner-grad-admin"
        loading
        title="正在加载后台..."
        message="管理界面分包正在按需载入。"
        progress={{ label: '载入模块', status: '请稍候' }}
      />
    {/if}

    {#if $LoginModalComponent}
      <svelte:component
        this={$LoginModalComponent}
        open={loginModalOpen}
        loading={$authStore.loading}
        error={$authStore.error ?? ''}
        onSubmit={handleLogin}
        onCancel={handleCloseLogin}
        onForgotPassword={handleForgotPassword}
      />
    {/if}

    {#if $BookmarkEditModalComponent}
      <svelte:component
        this={$BookmarkEditModalComponent}
        open={bookmarkModalOpen}
        loading={savingBookmark}
        error={bookmarkError}
        mode={bookmarkModalMode}
        value={activeBookmark}
        categories={getAdminBookmarkCategoryOptions(adminCategories)}
        onSubmit={bookmarkController.submit}
        onCancel={bookmarkController.close}
        onDelete={bookmarkController.remove}
        deleting={deletingBookmarkId === Number(activeBookmark?.id)}
        imageHostUrl={adminData.settings?.image_host_url ?? ''}
      />
    {/if}
    {#if $CategoryEditModalComponent && categoryCreateReturnToHome}
      <svelte:component
        this={$CategoryEditModalComponent}
        open={categoryModalOpen}
        loading={savingCategory}
        error={categoryError}
        mode={categoryModalMode}
        value={activeCategory}
        categories={adminCategories}
        onSubmit={categoryController.submit}
        onCancel={categoryController.close}
        imageHostUrl={adminData.settings?.image_host_url ?? ''}
      />
    {/if}
    {#if $SearchSpotlightComponent}
      <svelte:component
        this={$SearchSpotlightComponent}
        open={spotlightOpen}
        bookmarks={publicData?.bookmarks ?? []}
        categories={publicData?.categories ?? []}
        onClose={closeSpotlight}
        onViewBookmark={openBookmarkView}
      />
    {/if}

    {#if viewBookmark}
      <BookmarkLinkModal title={viewBookmark.title} url={viewBookmark.url} onClose={closeBookmarkView} />
    {/if}


    <ConfirmDialog
      open={Boolean(confirmDialog)}
      title={confirmDialog?.title ?? ''}
      message={confirmDialog?.message ?? ''}
      itemTitle={confirmDialog?.itemTitle ?? ''}
      confirmLabel={confirmDialog?.confirmLabel ?? '确认'}
      cancelLabel={confirmDialog?.cancelLabel ?? '取消'}
      variant={confirmDialog?.variant ?? 'default'}
      confirmDisabled={confirmDialog?.confirmDisabled ?? false}
      onConfirm={handleConfirmDialogConfirm}
      onCancel={handleConfirmDialogCancel}
    />
  </div>
{/if}
