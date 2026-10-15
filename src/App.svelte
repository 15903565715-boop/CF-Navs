<script lang="ts">
  import { startIconDevice } from './lib/iconDeviceState'
  let stopIconDevice: (() => void) | undefined
  import { onDestroy, onMount, tick } from 'svelte'
  import { get } from 'svelte/store'
  import { fade } from 'svelte/transition'
  import {
    type BookmarkBatchMoveReq,
    type BookmarkReorganizeReq,
    type ChangePasswordReq,
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
  import type { BackupSelection as BackupSelectionInput } from './lib/appBackup'
  import { clearCachedAdminData } from './lib/adminDataCache'
  import { clearCachedPublicData } from './lib/publicDataCache'
  import { toastStore } from './lib/toast'
  import type { AdminTab, BookmarkFormValue } from './lib/adminTypes'
  import { toBookmarkForm, toBookmarkPayload } from './lib/adminFormAdapters'
  import { runAdminMutation } from './lib/appAdminMutation'
  import { createAuthViewIntent, logoutRevocationWarning } from './lib/appAuthController'
  import {
    createImportExportState,
    exportDataToFile,
    importDataFromFile,
  } from './lib/appImportExport'
  import {
    createConfirmController,
    createBatchDeleteConfirmation,
    createDeleteBookmarkConfirmation,
    type ConfirmDialogInput,
    type ConfirmDialogState,
  } from './lib/appConfirmDialog'
  import {
    buildHomeBackground,
    toAdminBookmarks,
    toAdminCategories,
    toSettingsForm,
    type SettingsFormValue,
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
  import { createBookmarkDraft } from './lib/appModalState'
  import { createEditIntentCounter } from './lib/appEditIntent'
  import { createCategoryController } from './lib/appCategoryController'
  import {
    canSeeHomeView,
    createHomeGateState,
    shouldOpenLoginGate,
    type AppView,
  } from './lib/appNavigation'
  import { resolveGlobalShortcut } from './lib/appShortcuts'
  import { createOptimisticSortState, runOptimisticSort } from './lib/appSortQueue'
  import { getAdminBookmarkCategoryOptions } from './lib/adminListState'
  import { getNextThemePreference, resolveAppThemeState } from './lib/appThemeState'
  import type { ImportSource } from './lib/importData'
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

  type SettingsSubset = SettingsFormValue
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
  // 启动 / 安装 / 找回流程见 lib/appBootController：控制器持有 booting / installState / recoverActive，
  // rootError / currentView / loginModalOpen 仍归 App，经下列回调在原先的时机读写。
  const boot = createAppBootController({
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
    clearCachedAdminData,
    clearCachedPublicData,
    setSession: (session) => authStore.setSession(session),
    initializeAuth: () => authStore.initialize(),
    resetAdminData: () => adminStore.reset(),
    isLoggedIn,
    refreshLoggedInData,
    refreshPublicData,
    getPublicMode: () => get(configStore).data?.public_mode,
    isAdminPath,
    ensureLazyComponent: (name) => lazyComponents.ensure(name),
    getRootError: () => rootError,
    setRootError: (message) => {
      rootError = message
    },
    setLoginModalOpen: (open) => {
      loginModalOpen = open
    },
    setCurrentView: (view) => {
      currentView = view
    },
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

  const authViewIntent = createAuthViewIntent()
  let loginModalOpen = false
  let bookmarkModalOpen = false
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

  let bookmarkModalMode: 'create' | 'edit' = 'create'

  let activeBookmark: Partial<BookmarkFormValue> | null = null
  // 分类与书签共用一个编辑意图计数器（见 lib/appEditIntent），必须注入同一个实例。
  const editIntent = createEditIntentCounter()

  let savingBookmark = false
  let savingSettings = false
  let deletingBookmarkId: number | null = null

  let bookmarkError = ''
  let settingsError = ''

  let importExportState = createImportExportState()
  let preferredThemeMode: ThemeMode | null = null
  let prefersReducedMotion = false
  // 只在浏览器里创建：SSR/测试环境没有 document 和 URL.createObjectURL。
  let customScriptController: CustomScriptController | null = null
  const bookmarkSortState = createOptimisticSortState()

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
    editIntent,
    api,
    isLoggedIn,
    openLogin: handleOpenLogin,
    ensureLoggedInDataLoaded,
    ensureLazyComponent: (name) => lazyComponents.ensure(name),
    readAdminDataForEdit,
    getAdminData: () => adminData,
    requestConfirmation,
    applyLocalCategoryUpsert,
    applyLocalCategoryDelete,
    applyLocalCategorySort,
    persistCurrentAdminData,
    refreshAdminDataAfterMutation,
    refreshLoggedInData,
    setRootError: (message) => {
      rootError = message
    },
    setCurrentView: (view) => {
      currentView = view
    },
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

  function resetSettingsState(): void {
    settingsError = ''
    savingSettings = false
  }

  function resetBookmarkState(): void {
    editIntent.next()
    bookmarkModalOpen = false
    bookmarkModalMode = 'create'
    activeBookmark = null
    bookmarkError = ''
    savingBookmark = false
  }

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
    resetSettingsState()
    resetBookmarkState()
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
  async function handleOpenCreateBookmark(categoryId?: string | number): Promise<void> {
    editIntent.next()
    if (!isLoggedIn()) {
      await handleOpenLogin()
      return
    }

    bookmarkError = ''
    if (!await ensureLoggedInDataLoaded()) {
      return
    }
    const fallbackCategoryId = categoryId ?? get(adminStore).data.categories[0]?.id
    await lazyComponents.ensure('BookmarkEditModal')
    bookmarkModalMode = 'create'
    activeBookmark = createBookmarkDraft(fallbackCategoryId)
    bookmarkModalOpen = true
  }

  async function handleEditBookmark(bookmark: { id: string | number }): Promise<void> {
    const intent = editIntent.next()
    const editSession = get(authStore).session
    if (!isLoggedIn()) {
      await handleOpenLogin()
      return
    }
    bookmarkError = ''
    try {
      const data = await readAdminDataForEdit()
      if (!data || intent !== editIntent.current()) return
      const current = data.bookmarks.find(item => item.id === Number(bookmark.id))
      if (!current) throw new Error('书签已不存在，请刷新后重试。')
      await lazyComponents.ensure('BookmarkEditModal')
      if (!isLoggedIn() || get(authStore).session !== editSession || intent !== editIntent.current()) return
      bookmarkModalMode = 'edit'
      activeBookmark = toBookmarkForm(current)
      bookmarkModalOpen = true
      refreshBookmarkIconCacheInBackground(Number(bookmark.id))
    } catch (error) {
      if (intent === editIntent.current()) rootError = `无法读取书签的原始编辑数据：${getErrorMessage(error)}`
    }
  }

  async function handleCloseBookmarkModal(): Promise<void> {
    resetBookmarkState()
  }

  async function handleSubmitBookmark(form: BookmarkFormValue): Promise<void> {
    // 同分类提交（appCategoryController 的 submit）：意图只看表单，resetBookmarkState() 之后 mode 已经变回 'create'。
    const isEdit = form.id != null
    const submitSession = get(authStore).session
    const isCurrent = () => submitSession !== null && get(authStore).session === submitSession
    savingBookmark = true
    bookmarkError = ''

    await runAdminMutation({
      isCurrent,
      run: () =>
        isEdit
          ? api.bookmarks.update(Number(form.id), toBookmarkPayload(form))
          : api.bookmarks.create(toBookmarkPayload(form)),
      onSuccess: async (bookmark) => {
        resetBookmarkState()
        await applyLocalBookmarkUpsert(bookmark)
        if (!isCurrent()) return
        await refreshAdminDataAfterMutation()
        if (isCurrent()) refreshBookmarkIconCacheInBackground(bookmark.id)
      },
      successMessage: (bookmark) =>
        isEdit ? `书签「${bookmark.title}」已更新` : `书签「${bookmark.title}」已创建`,
      onError: (message) => {
        bookmarkError = message
      },
      onSettled: () => {
        savingBookmark = false
      },
    })
  }

  async function handleDeleteBookmark(bookmark: { id: string | number; title: string }): Promise<void> {
    const confirmed = await requestConfirmation(createDeleteBookmarkConfirmation(bookmark.title))
    if (!confirmed) return

    const bookmarkId = Number(bookmark.id)
    deletingBookmarkId = bookmarkId
    bookmarkError = ''

    await runAdminMutation({
      run: () => api.bookmarks.remove(bookmarkId),
      onSuccess: async () => {
        resetBookmarkState()
        await applyLocalBookmarkDelete(bookmarkId)
        await refreshAdminDataAfterMutation()
      },
      successMessage: () => `书签「${bookmark.title}」已删除`,
      onError: (message) => {
        bookmarkError = message
      },
      onSettled: () => {
        deletingBookmarkId = null
      },
    })
  }

  async function handleBatchDeleteBookmarks(ids: number[]): Promise<void> {
    if (ids.length === 0) return
    if (!await requestConfirmation(createBatchDeleteConfirmation('bookmark', ids.length))) return

    await runAdminMutation({
      run: () => api.bookmarks.batchDelete(ids),
      onSuccess: async (result) => {
        if (result.deleted > 0) await refreshAdminDataAfterMutation()
      },
      successMessage: (result) => `已删除 ${result.deleted} 个书签`,
      onError: (message) => {
        bookmarkError = message
      },
    })
  }
  async function handleBatchMoveBookmarks(payload: BookmarkBatchMoveReq): Promise<void> {
    bookmarkError = ''

    await runAdminMutation({
      run: () => api.bookmarks.batchMove(payload),
      onSuccess: () => refreshAdminDataAfterMutation(),
      successMessage: (result) => `已移动 ${result.moved} 个书签`,
      onError: (message) => {
        bookmarkError = message
      },
      rethrow: true,
    })
  }

  async function handleSubmitSettings(payload: SettingsSubset): Promise<void> {
    savingSettings = true
    settingsError = ''

    await runAdminMutation({
      run: () => api.settings.update(payload),
      onSuccess: (settings) => applyLocalSettings(settings),
      successMessage: () => '设置已保存',
      onError: (message) => {
        settingsError = message
      },
      onSettled: () => {
        savingSettings = false
      },
    })
  }

  async function handleChangePassword(payload: ChangePasswordReq): Promise<void> {
    authViewIntent.invalidate()
    rootError = ''

    await api.auth.changePassword(payload)
    authStore.setSession(null)
    categoryController.reset()
    resetSettingsState()
    resetBookmarkState()
    adminStore.reset()
    await clearCachedAdminData()
    rootError = '管理员密码已更新，请使用新密码重新登录。'
    await lazyComponents.ensure('LoginModal')
    loginModalOpen = true
    currentView = 'login'
  }

  async function handleSortBookmarks(ids: Array<string | number>): Promise<void> {
    bookmarkError = ''

    await runOptimisticSort(bookmarkSortState, ids, {
      applyLocalSort: (sortedIds) => applyLocalBookmarkSort(sortedIds, false),
      saveRemoteSort: (sortedIds) => api.bookmarks.sort(sortedIds),
      persist: persistCurrentAdminData,
      onSuccess: refreshAdminDataAfterMutation,
      restoreOnError: () => refreshLoggedInData(true),
      onError: (error) => {
        bookmarkError = getErrorMessage(error)
      },
    })
  }

  // 跨分类整理是全量提交：失败时草稿与服务端状态已不一致，
  // 先按兄弟排序处理器的约定回滚到服务端数据，再把原始错误交给首页展示。
  async function handleReorganizeBookmarks(
    categoryOrders: BookmarkReorganizeReq['category_orders'],
  ): Promise<void> {
    try {
      await api.bookmarks.reorganize(categoryOrders)
    } catch (error) {
      await refreshLoggedInData(true)
      throw error
    }
    await refreshAdminDataAfterMutation()
  }

  async function handleExportData(selection: BackupSelectionInput): Promise<void> {
    await exportDataToFile(importExportState, selection, (next) => {
      importExportState = next
    })
  }

  async function handleImportData(file: File, source: ImportSource, mode: 'replace' | 'merge'): Promise<void> {
    await importDataFromFile(importExportState, file, source, mode, {
      adminData,
      requestConfirmation,
      applyLoggedInData: (data) => applyLoggedInData(data),
      persistCurrentAdminData,
      onStateChange: (next) => {
        importExportState = next
      },
    })
    if (!importExportState.backupError && importExportState.backupMessage) {
      await refreshAdminDataAfterMutation()
    }
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
          onOpenCreateBookmark={handleOpenCreateBookmark}
          onEditBookmark={handleEditBookmark}
          onReorganizeBookmarks={handleReorganizeBookmarks}
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
        onOpenCreateBookmark={handleOpenCreateBookmark}
        onEditBookmark={handleEditBookmark}
        onDeleteBookmark={handleDeleteBookmark}
        onBatchDeleteBookmarks={handleBatchDeleteBookmarks}
        onBatchMoveBookmarks={handleBatchMoveBookmarks}
        onSubmitSettings={handleSubmitSettings}
        onVerifyDevice={() => refreshLoggedInData(true)}
        onChangePassword={handleChangePassword}
        onSortCategories={categoryController.sort}
        onSortBookmarks={handleSortBookmarks}
        onSelectTab={handleAdminTabChange}
        importing={importExportState.importing}
        exporting={importExportState.exporting}
        backupError={importExportState.backupError}
        backupMessage={importExportState.backupMessage}
        onExportData={handleExportData}
        onImportData={handleImportData}
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
        onSubmit={handleSubmitBookmark}
        onCancel={handleCloseBookmarkModal}
        onDelete={handleDeleteBookmark}
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
