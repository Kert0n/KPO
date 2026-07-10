import { readFileSync } from 'node:fs'
import { defineLoader } from 'vitepress'
import { getContentCatalog } from '../../shared/content/contentCatalog'
import { parseLectureAdditionalReadings, type LectureAdditionalReadings } from '../lib/additionalReadings'

export type {
  AdditionalReadingGroup,
  AdditionalReadingItem,
  LectureAdditionalReadings
} from '../lib/additionalReadings'

// VitePress replaces this declaration with the data-loader export at build time.
export declare const data: LectureAdditionalReadings[]

const lecturePages = getContentCatalog().pages.filter((page) => page.kind === 'lecture')

export default defineLoader({
  watch: lecturePages.map((page) => `../../../${page.sourcePath}`),
  load(watchedFiles): LectureAdditionalReadings[] {
    return watchedFiles
      .map((filePath) => {
        const page = lecturePages.find((candidate) =>
          filePath.replace(/\\/g, '/').endsWith(candidate.sourcePath)
        )
        const reading = parseLectureAdditionalReadings(filePath, readFileSync(filePath, 'utf8'))
        if (!page || !reading) return null
        return {
          ...reading,
          lecture: page.order,
          title: page.title.replace(/^Лекция\s+\d+\.\s*/i, ''),
          url: page.route
        }
      })
      .filter((reading): reading is LectureAdditionalReadings => reading !== null)
      .sort((a, b) => a.lecture - b.lecture)
  }
})
