import { defineConfig } from 'vitepress'
import { askAiContextPlugin } from './lib/askAiContextPlugin'
import { getNav, getRewrites, getSidebar } from './lib/content'
import { paletteCss } from './lib/paletteCss'
import { kpoDark, kpoLight } from './lib/shikiThemes'
import { applyMarkdownExtensions } from './markdown'
import { contentPagesFor, findContentPageByOutputPath } from './shared/content/contentCatalog'
import { SITE, siteUrl } from './shared/site'

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
  sitemap: {
    hostname: siteUrl('/'),
    transformItems: (items) => {
      const publishedUrls = new Set(
        contentPagesFor('sitemap').map((page) =>
          page.outputPath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
        )
      )
      return items.filter((item) => publishedUrls.has(item.url))
    }
  },

  transformPageData(pageData) {
    const page = findContentPageByOutputPath(pageData.relativePath)
    if (!page) return
    const canonical = siteUrl(page.route)
    const existingHead = Array.isArray(pageData.frontmatter.head) ? pageData.frontmatter.head : []
    return {
      description: pageData.description || page.description,
      frontmatter: {
        ...pageData.frontmatter,
        search: page.inclusion.search,
        head: [
          ...existingHead,
          ['link', { rel: 'canonical', href: canonical }],
          ['meta', { property: 'og:title', content: page.title }],
          ['meta', { property: 'og:description', content: page.description || SITE.description }],
          ['meta', { property: 'og:url', content: canonical }],
          ['meta', { property: 'og:type', content: 'article' }],
          ...(page.kind === 'service'
            ? [['meta', { name: 'robots', content: 'noindex,nofollow' }] as const]
            : [])
        ]
      }
    }
  },

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
      `;(function(){try{var l=localStorage.getItem(${JSON.stringify(SITE.storageKeys.codeLanguage)});if(!/^(kotlin|csharp|java|go)$/.test(l||""))l="kotlin";document.documentElement.dataset.kpoLang=l}catch(e){document.documentElement.dataset.kpoLang="kotlin"}})()`
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
        base: SITE.base,
        courseTitle: SITE.title,
        courseDescription: SITE.description
      })
    ]
  },

  themeConfig: {
    siteTitle: SITE.shortTitle,
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg' },

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
  }
})
