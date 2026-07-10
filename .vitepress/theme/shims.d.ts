declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module '*.js' {
  const module: unknown
  export default module
}

declare module 'kotlin-playground' {
  type PlaygroundOptions = {
    server?: string
    version?: string
    onChange?: (code: string) => void
    getInstance?: (instance: {
      getCode: () => string
      KotlinPlayground?: { destroy?: () => void }
      codemirror?: {
        getSelection?: () => string
      }
    }) => void
    onRun?: () => void
    onError?: () => void
    callback?: (targetNode: HTMLElement, mountNode: HTMLElement) => void
  }

  export default function createPlayground(
    target: string | Node | NodeList,
    options?: PlaygroundOptions
  ): Promise<unknown[]>
}
