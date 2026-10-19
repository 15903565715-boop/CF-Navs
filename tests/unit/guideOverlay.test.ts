// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import HomeFloatingActions from '../../src/components/HomeFloatingActions.svelte'
import GuideOverlay from '../../src/components/GuideOverlay.svelte'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('guide entry button', () => {
  it('浮动按钮组里有"使用指南"入口，点击后回调触发', async () => {
    const onOpenGuide = vi.fn()
    render(HomeFloatingActions, { props: { isAuthenticated: false, onOpenGuide } })

    const btn = screen.getByRole('button', { name: '使用指南' })
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('data-testid')).toBe('home-guide-button')

    await fireEvent.click(btn)
    expect(onOpenGuide).toHaveBeenCalledTimes(1)
  })
})

describe('guide overlay', () => {
  it('关闭时不渲染 iframe（懒加载，首页零新增请求）', () => {
    render(GuideOverlay, { props: { open: false } })
    expect(document.querySelector('iframe.guide-frame')).toBeNull()
  })

  it('打开时才创建 iframe，且关闭后写 localStorage 标记', async () => {
    const onClose = vi.fn()
    const { rerender } = render(GuideOverlay, { props: { open: false, onClose } })

    await rerender({ open: true, onClose })
    await tick()
    const iframe = document.querySelector('iframe.guide-frame') as HTMLIFrameElement | null
    expect(iframe).toBeTruthy()
    expect(iframe?.src).toContain('guide/')

    // 右上角 × 关闭
    await fireEvent.click(screen.getByTestId('guide-close'))
    expect(localStorage.getItem('cf-navs:guide-seen')).toBe('1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('收到指引页 postMessage 关闭通知时同样关闭并标记', async () => {
    const onClose = vi.fn()
    render(GuideOverlay, { props: { open: true, onClose } })
    await tick()

    window.dispatchEvent(new MessageEvent('message', { data: { type: 'cf-navs-guide-close' } }))
    await tick()

    expect(localStorage.getItem('cf-navs:guide-seen')).toBe('1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ESC 键关闭', async () => {
    const onClose = vi.fn()
    render(GuideOverlay, { props: { open: true, onClose } })
    await tick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await tick()

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
