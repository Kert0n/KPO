<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'
import { useSuggestEdit } from '../composables/useSuggestEdit'
import { contributingGuideUrl } from '../lib/suggestEditModel'
import { SITE } from '../../shared/site'

const props = defineProps<{ screenMenu?: boolean }>()

const { frontmatter } = useData()
const { editableSourcePath, announcementVisible, dismissAnnouncement, requestTour } =
  useSuggestEdit()

const guideUrl = contributingGuideUrl(SITE.repository)
// Показать жест можно только там, где есть текст статьи.
const canTour = computed(
  () => Boolean(editableSourcePath.value) && (frontmatter.value.layout ?? 'doc') === 'doc'
)
const showCoach = computed(
  () => !props.screenMenu && announcementVisible.value && Boolean(editableSourcePath.value)
)
</script>

<template>
  <div v-if="screenMenu" class="KpoHelpCourseScreen">
    <a class="KpoHelpCourseScreen__link" :href="guideUrl" target="_blank" rel="noopener">
      Помочь курсу
    </a>
  </div>

  <div v-else class="KpoHelpCourse">
    <a
      class="KpoHelpCourse__link"
      :class="{ 'KpoHelpCourse__link--highlight': showCoach }"
      :href="guideUrl"
      target="_blank"
      rel="noopener"
      aria-label="Помочь курсу"
      title="Помочь курсу"
      @click="dismissAnnouncement"
    >
      <svg class="KpoHelpCourse__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
        />
      </svg>
      <span class="KpoHelpCourse__label">Помочь курсу</span>
    </a>

    <div
      v-if="showCoach"
      class="KpoHelpCourse__coach"
      role="dialog"
      aria-labelledby="kpo-help-course-coach-title"
    >
      <p class="KpoHelpCourse__coach-title" id="kpo-help-course-coach-title">
        <span class="KpoHelpCourse__badge">Новое</span>
        Нашли ошибку в конспекте?
      </p>
      <p class="KpoHelpCourse__coach-text">
        Исправьте её или сообщите о ней прямо со страницы: через меню выделенного текста, рядом с
        Ask AI.
      </p>
      <div class="KpoHelpCourse__coach-actions">
        <button
          v-if="canTour"
          type="button"
          class="KpoHelpCourse__coach-primary"
          @click="requestTour"
        >
          Показать как
        </button>
        <button type="button" class="KpoHelpCourse__coach-secondary" @click="dismissAnnouncement">
          Понятно
        </button>
      </div>
    </div>
  </div>
</template>
