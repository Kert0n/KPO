import { defineConfig } from 'vitepress'
import { getFirstLectureLink, getSidebar } from './lib/content'
import { multiCodePlugin } from './markdown/multiCodePlugin'

export default defineConfig({
  lang: 'ru-RU',
  title: 'Конструирование программного обеспечения',
  description: 'Конспект лекций по архитектуре приложений и инженерным практикам',
  base: '/KPO/',
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'dracula'
    },
    config(md) {
      md.use(multiCodePlugin)
    }
  },
  themeConfig: {
    siteTitle: 'КПО',
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg' },
    nav: [
      { text: 'Введение', link: '/intro' },
      { text: 'Лекции', link: getFirstLectureLink() },
      { text: 'Hello World', link: '/hello-world' },
      { text: 'Дополнительно', link: '/extras/' },
      { text: 'Заключение', link: '/conclusion' }
    ],
    sidebar: getSidebar(),
    search: {
      provider: 'local'
    },
    outline: {
      level: [2, 3],
      label: 'На странице'
    },
    docFooter: {
      prev: 'Предыдущая',
      next: 'Следующая'
    },
    darkModeSwitchLabel: 'Тема',
    sidebarMenuLabel: 'Меню',
    returnToTopLabel: 'Наверх',
    lastUpdated: {
      text: 'Обновлено'
    }
  }
})
