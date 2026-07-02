import { defineConfig } from 'vitepress'
import { getNav, getRewrites, getSidebar } from './lib/content'
import { paletteCss } from './lib/paletteCss'
import { kpoDark, kpoLight } from './lib/shikiThemes'
import { mermaidPlugin } from './markdown/mermaid'
import { langOnlyPlugin, multiCodePlugin } from './markdown/multiCode'

export default defineConfig({
  lang: 'ru-RU',
  title: 'Конструирование ПО',
  description: 'Конспект лекций по архитектуре приложений и инженерным практикам',
  base: '/KPO/',
  cleanUrls: true,
  lastUpdated: true,

  // Папочные страницы (lectures/Lec1/vitepress.md) получают чистые URL
  // вида /lectures/01 — карта строится автоматически из файловой системы
  rewrites: getRewrites(),

  // В папках лекций/дополнений публикуется только vitepress.md;
  // остальные .md — материалы редактора (черновики, заметки)
  srcExclude: [
    'README.md',
    'lectures/*/!(vitepress).md',
    'extras/*/!(vitepress).md'
  ],

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/KPO/favicon.svg' }],
    // Палитра кода (--kpo-code-*) генерируется из того же источника,
    // что и Shiki-темы: см. .vitepress/lib/palette.ts
    ['style', {}, paletteCss()],
    // Выбранный язык применяется до отрисовки, чтобы секции ::: only /
    // <LangOnly> не мигали (приём тёмной темы VitePress)
    ['script', {}, ';(function(){try{document.documentElement.dataset.kpoLang=localStorage.getItem("kpo:code-language")||"kotlin"}catch(e){}})()']
  ],

  markdown: {
    lineNumbers: true,
    theme: { light: kpoLight, dark: kpoDark },
    config(md) {
      md.use(multiCodePlugin)
      md.use(langOnlyPlugin)
      md.use(mermaidPlugin)
    }
  },

  themeConfig: {
    siteTitle: 'КПО',
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg' },

    nav: getNav(),
    sidebar: getSidebar(),

    search: {
      provider: 'local',
      options: {
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
      text: 'Обновлено'
    },
    notFound: {
      title: 'Страница не найдена',
      quote: 'Возможно, лекция ещё не написана или переехала.',
      linkText: 'На главную'
    }
  }
})
