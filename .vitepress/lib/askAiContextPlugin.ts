import type { Plugin } from 'vite'
import {
  buildAskAiPageContext,
  findAskAiContextEntry,
  listAskAiContextEntries
} from './askAiContext'

type AskAiContextPluginOptions = {
  root?: string
  base?: string
  courseTitle: string
  courseDescription: string
}

export function askAiContextPlugin(options: AskAiContextPluginOptions): Plugin {
  const root = options.root ?? process.cwd()
  const contextOptions = {
    root,
    courseTitle: options.courseTitle,
    courseDescription: options.courseDescription
  }

  return {
    name: 'kpo-ask-ai-context',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const routeKey = routeKeyFromRequestUrl(request.url ?? '', options.base ?? '/')
        if (!routeKey) {
          next()
          return
        }

        try {
          const entry = findAskAiContextEntry(routeKey, root)
          if (!entry) {
            response.statusCode = 404
            response.end('Ask AI context not found')
            return
          }

          const context = buildAskAiPageContext(entry, contextOptions)
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify(context))
        } catch (error) {
          response.statusCode = 500
          response.end(error instanceof Error ? error.message : String(error))
        }
      })
    },
    generateBundle() {
      for (const entry of listAskAiContextEntries(root)) {
        const context = buildAskAiPageContext(entry, contextOptions)
        this.emitFile({
          type: 'asset',
          fileName: `__ask-ai-context/${entry.routeKey}.json`,
          source: JSON.stringify(context)
        })
      }
    }
  }
}

function routeKeyFromRequestUrl(rawUrl: string, base: string): string | null {
  const pathname = decodeURIComponent(rawUrl.split(/[?#]/)[0] ?? '')
  const prefixes = [
    '/__ask-ai-context/',
    `${normalizeBase(base)}__ask-ai-context/`
  ]

  for (const prefix of prefixes) {
    if (!pathname.startsWith(prefix)) continue
    const routeKey = pathname.slice(prefix.length).replace(/\.json$/, '')
    return routeKey === '' ? null : routeKey
  }

  return null
}

function normalizeBase(base: string): string {
  if (base === '') return '/'
  return base.endsWith('/') ? base : `${base}/`
}
