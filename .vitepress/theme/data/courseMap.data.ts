import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineLoader } from 'vitepress'
import { getContentCatalog } from '../../shared/content/contentCatalog'
import { buildCourseMap, type CourseMap } from '../../shared/content/courseMap'

export declare const data: CourseMap

export default defineLoader({
  watch: ['../../../content/lectures/Lec*/vitepress.md', '../../../content/extras/*/vitepress.md'],
  load(): CourseMap {
    return buildCourseMap(getContentCatalog({ fresh: true }), (page) => {
      return readFileSync(resolve(process.cwd(), page.sourcePath), 'utf8')
    })
  }
})
