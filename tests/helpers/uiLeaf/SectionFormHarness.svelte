<script lang="ts">
  // 第 8e 步测试替身：以 SettingsPanel（legacy）的方式 `bind:form` 渲染某个设置分区，
  // 记录分区经 syncForm / 预设选择写回的每一份新 form，用于观察子组件回调是否真的被父组件收到。
  import type { Component, ComponentType } from 'svelte'
  import type { SettingsFormModel } from '../../../src/lib/settingsForm'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export let section: Component<any> | ComponentType
  export let form: SettingsFormModel
  export let saving = false
  export let onForm: (form: SettingsFormModel) => void = () => {}

  $: onForm(form)
</script>

<svelte:component this={section} bind:form {saving} />
