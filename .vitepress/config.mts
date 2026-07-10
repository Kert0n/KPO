import { defineConfig } from 'vitepress'
import { askAiContextPlugin } from './lib/askAiContextPlugin'
import { getNav, getRewrites, getSidebar } from './lib/content'
import { paletteCss } from './lib/paletteCss'
import { kpoDark, kpoLight } from './lib/shikiThemes'
import { applyMarkdownExtensions } from './markdown'
import { getContentCatalog } from './shared/content/contentCatalog'
import { SITE, STORAGE_KEYS, siteUrl } from './shared/site'

export default defineConfig({
  lang: SITE.language,
  title: SITE.title,
  description: SITE.description,
  base: SITE.base,
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
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${SITE.base}favicon.svg` }],
    // Палитра кода (--kpo-code-*) генерируется из того же источника,
    // что и Shiki-темы: см. .vitepress/lib/palette.ts
    ['style', {}, paletteCss()],
    // Выбранный язык применяется до отрисовки, чтобы секции ::: only /
    // <LangOnly> не мигали (приём тёмной темы VitePress)
    [
      'script',
      {},
      `;(function(){try{var l=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.codeLanguage)});if(!/^(kotlin|csharp|java|go)$/.test(l||''))l='kotlin';document.documentElement.dataset.kpoLang=l}catch(e){document.documentElement.dataset.kpoLang='kotlin'}})()`
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

  transformPageData(pageData) {
    const sourcePath = `content/${pageData.relativePath}`
    const page = getContentCatalog().pages.find((candidate) => candidate.sourcePath === sourcePath)
    if (!page) return

    const canonical = new URL(page.route.replace(/^\//, ''), `${SITE.origin}${SITE.base}`).toString()
    const description = page.description || SITE.description
    pageData.description = description
    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:title', content: `${page.title} | ${SITE.title}` }],
      ['meta', { property: 'og:description', content: description }]
    )
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
      askAiContextPlugin({ base: SITE.base, courseTitle: SITE.title, courseDescription: SITE.description })
    ]
  },

  themeConfig: {
    siteTitle: 'КПО',
    logo: { light: `${SITE.base}logo-light.svg`, dark: `${SITE.base}logo-dark.svg` },

    nav: getNav(),
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
  },

  sitemap: {
    hostname: siteUrl(),
    transformItems(items) {
      const allowed = new Set(
        getContentCatalog()
          .pages.filter((page) => page.inclusion.sitemap)
          .map((page) => page.route)
      )
      return items.filter((item) => {
        const withoutBase = item.url.replace(SITE.base.replace(/^\//, '/').replace(/\/$/, ''), '')
        const route = withoutBase === '' ? '/' : `/${withoutBase.replace(/^\//, '')}`
        return allowed.has(route)
      })
    }
  }
})
