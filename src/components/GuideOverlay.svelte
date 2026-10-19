<svelte:options runes />

<script lang="ts">
  interface Props {
    open?: boolean
    onClose?: () => void
  }

  let { open = false, onClose }: Props = $props()

  // iframe 懒创建：只在首次打开时才赋值 src，避免首页多一次请求
  let iframeSrc = $state('')

  $effect(() => {
    if (open && !iframeSrc) {
      iframeSrc = `${import.meta.env.BASE_URL}guide/`
    }
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

  // 指引 HTML 内部通过 postMessage 通知关闭/跳过/完成
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
      {#if iframeSrc}
        <iframe
          class="guide-frame"
          title="使用指南"
          src={iframeSrc}
        ></iframe>
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

  .guide-frame {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
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

  @media (max-width: 480px) {
    .guide-overlay { padding: 0.75rem; }
    .guide-frame-wrap { height: 94vh; }
  }
</style>
