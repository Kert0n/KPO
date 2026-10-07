import { data as courseMap } from '../data/courseMap.data'
import type { CourseGroup, CourseLecture, CourseMap } from '../../shared/content/courseMap'

export function useCourseMap(): CourseMap & {
  lecture: (number: number) => CourseLecture
  groupOf: (number: number) => CourseGroup | undefined
} {
  const byNumber = new Map(courseMap.lectures.map((lecture) => [lecture.number, lecture]))
  return {
    ...courseMap,
    lecture: (number) => {
      const found = byNumber.get(number)
      if (!found) throw new Error(`Unknown lecture ${number}`)
      return found
    },
    groupOf: (number) => courseMap.groups.find((group) => group.lectures.includes(number))
  }
}

export type { CourseGroup, CourseLecture, CourseMap }
