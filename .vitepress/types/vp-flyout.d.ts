import type { DefineComponent, PropType } from 'vue'

type FlyoutItem = Record<string, unknown>

declare const component: DefineComponent<{
  icon: StringConstructor
  button: StringConstructor
  label: StringConstructor
  items: PropType<FlyoutItem[]>
}>

export default component
