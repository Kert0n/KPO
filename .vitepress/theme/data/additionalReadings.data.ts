import { readFileSync } from 'node:fs'
import { defineLoader } from 'vitepress'
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
  load(watchedFiles): LectureAdditionalReadings[] {
    return watchedFiles
      .map((filePath) => parseLectureAdditionalReadings(filePath, readFileSync(filePath, 'utf8')))
      .filter((reading): reading is LectureAdditionalReadings => reading !== null)
      .sort((a, b) => a.lecture - b.lecture)
  }
})
