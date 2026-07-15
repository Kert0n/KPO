import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineLoader } from 'vitepress'
import {
  collectAdditionalReadings,
  type ContentAdditionalReadings
} from '../../shared/content/additionalReadings'
import { getContentCatalog } from '../../shared/content/contentCatalog'

export type {
  AdditionalReadingGroup,
  AdditionalReadingItem,
  ContentAdditionalReadings
} from '../../shared/content/additionalReadings'

export default defineLoader({
  watch: ['../../../content/lectures/Lec*/vitepress.md', '../../../content/extras/*/vitepress.md'],
  load(): ContentAdditionalReadings[] {
    return collectAdditionalReadings(getContentCatalog({ fresh: true }), (page) => {
      return readFileSync(resolve(process.cwd(), page.sourcePath), 'utf8')
    })
  }
})
