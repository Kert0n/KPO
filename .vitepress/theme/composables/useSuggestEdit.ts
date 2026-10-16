import { useData } from 'vitepress'
import { computed, onMounted, ref, type ComputedRef, type Ref } from 'vue'
import { SITE } from '../../shared/site'
import {
  isAnnouncementActive,
  sourcePathFromFilePath,
  SUGGEST_EDIT_ANNOUNCEMENT_UNTIL
} from '../lib/suggestEditModel'
import { booleanCodec, createPersistentState } from './persistentState'

/**
 * «Предложить правку»: какие страницы можно править, анонс новой
 * возможности и запрос на демонстрацию жеста выделения.
 *
 * Анонс видно только после монтирования: SSR-разметка совпадает с первой
 * клиентской отрисовкой, а тем, кто уже закрыл подсказку, она не мелькает.
 */

const announcementSeen = createPersistentState<boolean>({
  key: SITE.storageKeys.suggestEditAnnouncement,
  initial: false,
  validate: (value) => typeof value === 'boolean',
  ...booleanCodec
})

const mounted = ref(false)
const tourRequest = ref(0)

export function useSuggestEdit(): {
  editableSourcePath: ComputedRef<string>
  announcementVisible: ComputedRef<boolean>
  tourRequest: Ref<number>
  dismissAnnouncement: () => void
  requestTour: () => void
} {
  const { page } = useData()
  announcementSeen.setupOnMounted()
  onMounted(() => {
    mounted.value = true
  })

  const editableSourcePath = computed(() => {
    const { filePath, isNotFound } = page.value
    return isNotFound || !filePath ? '' : sourcePathFromFilePath(filePath)
  })

  const announcementVisible = computed(
    () =>
      mounted.value &&
      !announcementSeen.state.value &&
      isAnnouncementActive(new Date(), SUGGEST_EDIT_ANNOUNCEMENT_UNTIL)
  )

  return {
    editableSourcePath,
    announcementVisible,
    tourRequest,
    dismissAnnouncement: () => announcementSeen.set(true),
    requestTour: () => {
      announcementSeen.set(true)
      tourRequest.value += 1
    }
  }
}
