import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineLoader } from 'vitepress'
import { getContentCatalog } from '../../shared/content/contentCatalog'
import {
  parseLectureAdditionalReadings,
  type LectureAdditionalReadings
} from '../lib/additionalReadings'

export type {
  AdditionalReadingGroup,
  AdditionalReadingItem,
  LectureAdditionalReadings
} from '../lib/additionalReadings'

export default defineLoader({
  watch: '../../../content/lectures/Lec*/vitepress.md',
  load(): LectureAdditionalReadings[] {
    return getContentCatalog({ fresh: true })
      .filter((page) => page.kind === 'lecture')
      .map((page) => resolve(process.cwd(), page.sourcePath))
      .map((filePath) => parseLectureAdditionalReadings(filePath, readFileSync(filePath, 'utf8')))
      .filter((reading): reading is LectureAdditionalReadings => reading !== null)
      .sort((a, b) => a.lecture - b.lecture)
  }
})
