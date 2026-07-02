import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import CodeSwitcher from './components/CodeSwitcher.vue'
import LangOnly from './components/LangOnly.vue'
import MermaidDiagram from './components/MermaidDiagram.vue'
import SidebarToggle from './components/SidebarToggle.vue'

import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'

import './styles/vars.css'
import './styles/layout.css'
import './styles/code.css'
import './styles/playground.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-title-after': () => h(SidebarToggle)
    })
  },
  enhanceApp({ app }) {
    app.component('CodeSwitcher', CodeSwitcher)
    app.component('LangOnly', LangOnly)
    app.component('MermaidDiagram', MermaidDiagram)
  }
} satisfies Theme
