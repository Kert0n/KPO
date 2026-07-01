import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import CodeSwitcher from './components/CodeSwitcher.vue'
import PlaygroundToggle from './components/PlaygroundToggle.vue'
import SidebarToggle from './components/SidebarToggle.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-title-after': () => h(SidebarToggle),
      'nav-bar-content-after': () => h(PlaygroundToggle)
    })
  },
  enhanceApp({ app }) {
    app.component('CodeSwitcher', CodeSwitcher)
    app.component('PlaygroundToggle', PlaygroundToggle)
    app.component('SidebarToggle', SidebarToggle)
  }
} satisfies Theme
