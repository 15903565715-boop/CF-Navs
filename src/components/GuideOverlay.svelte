<svelte:options runes />

<script lang="ts">
  interface Props {
    open?: boolean
    onClose?: () => void
  }

  let { open = false, onClose }: Props = $props()

  // 指引 HTML 懒加载：只在首次打开时 fetch，避免首页多一次请求。
  // 不用 iframe：彻底绕开 frame-ancestors 等 framing 限制。
  let guideContent = $state('')
  let loadError = $state(false)
  let contentEl: HTMLDivElement | null = $state(null)
  let scriptEl: HTMLScriptElement | null = null

  async function loadGuide() {
    if (guideContent || loadError) return
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}guide/`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/)
      const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/)
      // 指引 HTML 的样式已在源文件里 scoped 到 .guide-root；<style> 随内容注入即生效
      // 去掉 HTML 自带的 <script> 引用，改用编程方式加载（innerHTML 不执行脚本）
      const bodyHtml = (bodyMatch?.[1] ?? '').replace(/<script[\s\S]*?<\/script>/g, '')
      guideContent = `<style>${cssMatch?.[1] ?? ''}</style>${bodyHtml}`
    } catch {
      loadError = true
    }
  }

  function loadGuideScript() {
    if (scriptEl || !contentEl) return
    /* eslint-disable svelte/no-dom-manipulating -- 动态加载同源脚本：innerHTML 不执行 script，必须编程注入 */
    const s = document.createElement('script')
    s.src = `${import.meta.env.BASE_URL}guide/guide.js`
    s.defer = true
    scriptEl = s
    contentEl.appendChild(s)
    /* eslint-enable svelte/no-dom-manipulating */
  }

  $effect(() => {
    if (open) void loadGuide()
  })

  // 内容注入完成后加载交互脚本
  $effect(() => {
    if (guideContent && contentEl) loadGuideScript()
  })

  function handleClose() {
    try {
      localStorage.setItem('cf-navs:guide-seen', '1')
    } catch {
      // 隐私模式下 localStorage 可能不可用，忽略
    }
    onClose?.()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') handleClose()
  }

  // 指引脚本通过 postMessage 通知关闭/跳过/完成（非 iframe 下 parent 即自身）
  function handleMessage(event: MessageEvent) {
    if (event.data?.type === 'cf-navs-guide-close') handleClose()
  }

  $effect(() => {
    if (!open) return
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  })
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="guide-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="使用指南"
    data-testid="guide-overlay"
  >
    <div class="guide-frame-wrap">
      <button
        type="button"
        class="guide-close"
        data-testid="guide-close"
        onclick={handleClose}
        aria-label="关闭使用指南"
      >×</button>
      {#if loadError}
        <div class="guide-error">指引加载失败，请检查网络后重试。</div>
      {:else if guideContent}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div class="guide-injected" bind:this={contentEl}>{@html guideContent}</div>
      {:else}
        <div class="guide-loading">加载中…</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .guide-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(2px);
  }

  .guide-frame-wrap {
    position: relative;
    width: min(760px, 100%);
    height: min(800px, 94vh);
    background: var(--color-surface, #fff);
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
  }

  .guide-injected {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .guide-close {
    position: absolute;
    top: 0.5rem;
    right: 0.75rem;
    z-index: 2;
    border: none;
    background: transparent;
    font-size: 1.6rem;
    line-height: 1;
    color: var(--color-muted, #64748b);
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 0.5rem;
  }

  .guide-close:hover {
    background: rgba(100, 116, 139, 0.15);
    color: var(--color-fg, #0f172a);
  }

  .guide-loading,
  .guide-error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-muted, #64748b);
  }

  @media (max-width: 480px) {
    .guide-overlay { padding: 0.75rem; }
    .guide-frame-wrap { height: 94vh; }
  }
</style>
