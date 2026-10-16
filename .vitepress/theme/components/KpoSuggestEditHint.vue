<script setup lang="ts">
import { useSuggestEdit } from '../composables/useSuggestEdit'
import { contributingGuideUrl } from '../lib/suggestEditModel'
import { SITE } from '../../shared/site'

const { editableSourcePath, requestTour } = useSuggestEdit()
const guideUrl = contributingGuideUrl(SITE.repository)
</script>

<template>
  <aside v-if="editableSourcePath" class="KpoSuggestEditHint" aria-label="Предложить правку">
    <p class="KpoSuggestEditHint__text">
      Нашли ошибку или неясное место?
      <span class="KpoSuggestEditHint__gesture KpoSuggestEditHint__gesture--pointer">
        Выделите текст и щёлкните по нему правой кнопкой мыши:
      </span>
      <span class="KpoSuggestEditHint__gesture KpoSuggestEditHint__gesture--touch">
        Выделите текст:
      </span>
      в меню есть «Исправить фрагмент» и «Сообщить об ошибке».
    </p>
    <p class="KpoSuggestEditHint__links">
      <button type="button" class="KpoSuggestEditHint__tour" @click="requestTour">Показать</button>
      <span aria-hidden="true">·</span>
      <a :href="guideUrl" target="_blank" rel="noopener">Как помочь курсу</a>
    </p>
  </aside>
</template>
