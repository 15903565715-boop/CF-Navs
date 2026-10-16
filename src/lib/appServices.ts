import { subscribeMutationDataVersion } from './api'
import { applyIconDescriptor, recordMutationDataVersion } from './dataService'
import { clearIconAccessKey } from './iconAccessKey'
import { iconDevice } from './iconDeviceState'
import { objectIconLoader } from './objectIconLoader'
import { authStore } from './stores'

// 应用级模块之间的接线集中在这里，由 main.ts 在挂载 App 之前显式调用一次。
// 各模块自身不在加载时互相注册回调，也不直接引用彼此的单例：
// - authStore 登出 / 会话消失 → 图标设备退出流程、清理图标访问 key；
// - objectIconLoader 解析出图标描述符 → dataService 更新图标显示状态；
// - 写接口回报的 data_version → dataService 判断写后是否需要整包重拉。
let initialized = false
let stopMutationVersions: (() => void) | null = null

export function initAppServices(): void {
  if (initialized) return
  initialized = true
  authStore.configureLifecycle({
    onLogoutStart: () => { void iconDevice.beginLogout() },
    onSessionCleared: clearIconAccessKey,
  })
  objectIconLoader.configure((next, expected) => applyIconDescriptor(next, expected))
  stopMutationVersions = subscribeMutationDataVersion(recordMutationDataVersion)
}

/** 仅供测试：撤销接线，让下一次 initAppServices() 重新接上。 */
export function resetAppServicesForTest(): void {
  initialized = false
  authStore.configureLifecycle(null)
  objectIconLoader.configure(() => {})
  stopMutationVersions?.()
  stopMutationVersions = null
}
