import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import AskAiContextMenu from './components/AskAiContextMenu.vue'
import AskAiProviderSelect from './components/AskAiProviderSelect.vue'
import CodeSwitcher from './components/CodeSwitcher.vue'
import AdditionalReadingsIndex from './components/AdditionalReadingsIndex.vue'
import KpoNavBarExtra from './components/KpoNavBarExtra.vue'
import LangOnly from './components/LangOnly.vue'
import MermaidDiagram from './components/MermaidDiagram.vue'
import SidebarToggle from './components/SidebarToggle.vue'
import { installAdaptiveTables } from './lib/adaptiveTables'

import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'

import './styles/vars.css'
import './styles/layout.css'
import './styles/vitepress-adapter.css'
import './styles/content-lanes.css'
import './styles/additional-readings.css'
import './styles/code.css'
import './styles/playground.css'
import './styles/ask-ai.css'
import './styles/print.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      // Кнопка сайдбара живёт в content-слоте, а НЕ в nav-bar-title-after:
      // тот рендерится внутри <a> логотипа, и до завершения гидрации клик
      // по кнопке проваливался в ссылку и уводил на главную.
      // Позиционируется абсолютно над границей сайдбара (layout.css).
      'nav-bar-content-before': () => h(SidebarToggle),
      'nav-bar-content-after': () => [h(AskAiProviderSelect), h(KpoNavBarExtra)],
      'nav-screen-content-after': () => h(AskAiProviderSelect, { screenMenu: true }),
      'layout-bottom': () => h(AskAiContextMenu)
    })
  },
  enhanceApp({ app, router }) {
    app.component('AdditionalReadingsIndex', AdditionalReadingsIndex)
    app.component('AskAiContextMenu', AskAiContextMenu)
    app.component('CodeSwitcher', CodeSwitcher)
    app.component('LangOnly', LangOnly)
    app.component('MermaidDiagram', MermaidDiagram)
    installAdaptiveTables(router)
  }
} satisfies Theme
