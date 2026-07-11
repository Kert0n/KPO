import { defineConfig } from 'vitepress'
import { askAiContextPlugin } from './lib/askAiContextPlugin'
import { getRewrites, getSidebar } from './lib/content'
import { paletteCss } from './lib/paletteCss'
import { kpoDark, kpoLight } from './lib/shikiThemes'
import { applyMarkdownExtensions } from './markdown'

export default defineConfig({
  lang: 'ru-RU',
  title: 'Конструирование ПО',
  description: 'Конспект лекций по архитектуре приложений и инженерным практикам',
  base: '/KPO/',
  srcDir: 'content',
  cleanUrls: true,
  lastUpdated: true,

  // Папочные страницы (lectures/Lec1/vitepress.md) получают чистые URL
  // вида /lectures/01 — карта строится автоматически из файловой системы
  rewrites: getRewrites(),

  // В папках лекций/дополнений публикуется только vitepress.md;
  // остальные .md — материалы редактора (черновики, заметки)
  srcExclude: [
    'lectures/_*/**',
    'extras/_*/**',
    'service-pages/_*/**',
    'lectures/*/!(vitepress).md',
    'extras/*/!(vitepress).md',
    'service-pages/*/!(vitepress).md'
  ],

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/KPO/favicon.svg' }],
    // Палитра кода (--kpo-code-*) генерируется из того же источника,
    // что и Shiki-темы: см. .vitepress/lib/palette.ts
    ['style', {}, paletteCss()],
    // Выбранный язык применяется до отрисовки, чтобы секции ::: only /
    // <LangOnly> не мигали (приём тёмной темы VitePress)
    [
      'script',
      {},
      ';(function(){try{var l=localStorage.getItem("kpo:code-language");if(!/^(kotlin|csharp|java|go)$/.test(l||""))l="kotlin";document.documentElement.dataset.kpoLang=l}catch(e){document.documentElement.dataset.kpoLang="kotlin"}})()'
    ]
  ],

  markdown: {
    lineNumbers: true,
    math: true,
    theme: { light: kpoLight, dark: kpoDark },
    config(md) {
      applyMarkdownExtensions(md)
    }
  },

  vite: {
    build: {
      // Code examples intentionally stay searchable. The local search index and
      // lazy Mermaid/Kotlin Playground chunks are larger than Vite's default
      // 500 KiB raw threshold, but the limit stays below 1 MiB so real
      // regressions remain visible.
      chunkSizeWarningLimit: 900
    },
    plugins: [
      askAiContextPlugin({
        base: '/KPO/',
        courseTitle: 'Конструирование ПО',
        courseDescription: 'Конспект лекций по архитектуре приложений и инженерным практикам'
      })
    ]
  },

  themeConfig: {
    siteTitle: 'КПО',
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg' },

    nav: [
      { text: 'Введение', link: '/intro' },
      { text: 'Лекции', link: '/lectures/01', activeMatch: '^/lectures/' },
      { text: 'Дополнения', link: '/extras/', activeMatch: '^/extras/' },
      { text: 'Заключение', link: '/conclusion' }
    ],
    sidebar: getSidebar(),

    search: {
      provider: 'local',
      options: {
        detailedView: true,
        translations: {
          button: {
            buttonText: 'Поиск',
            buttonAriaLabel: 'Поиск по конспекту'
          },
          modal: {
            displayDetails: 'Показать подробности',
            resetButtonTitle: 'Сбросить запрос',
            backButtonTitle: 'Закрыть поиск',
            noResultsText: 'Ничего не найдено по запросу',
            footer: {
              selectText: 'выбрать',
              navigateText: 'перейти',
              closeText: 'закрыть'
            }
          }
        }
      }
    },

    outline: {
      level: [2, 3],
      label: 'На этой странице'
    },
    docFooter: {
      prev: 'Предыдущая',
      next: 'Следующая'
    },
    darkModeSwitchLabel: 'Тема',
    lightModeSwitchTitle: 'Светлая тема',
    darkModeSwitchTitle: 'Тёмная тема',
    sidebarMenuLabel: 'Меню',
    returnToTopLabel: 'Наверх',
    lastUpdated: {
      text: 'Обновлено',
      formatOptions: {
        forceLocale: true,
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }
    },
    notFound: {
      title: 'Страница не найдена',
      quote: 'Возможно, лекция ещё не написана или переехала.',
      linkText: 'На главную'
    }
  }
})
