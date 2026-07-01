declare module 'kotlin-playground' {
  const initKotlinPlayground: (selector: string) => void
  export default initKotlinPlayground
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

interface Window {
  KotlinPlayground?: (selector: string) => void
}
