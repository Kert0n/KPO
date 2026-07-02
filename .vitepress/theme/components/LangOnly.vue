<script setup lang="ts">
/**
 * Строчная вставка, видимая только при выбранном языке:
 *   Завершение — <LangOnly lang="kotlin">`exitProcess(0)`</LangOnly>.
 *
 * Показ управляется чистым CSS по html[data-kpo-lang] (см. code.css),
 * поэтому SSR-разметка стабильна и гидрация ничего не перещёлкивает.
 * Блочный вариант — контейнер ::: only <язык> в markdown.
 */
defineProps<{
  lang: string
}>()
</script>

<template>
  <span class="kpo-only" :class="`kpo-only--${lang}`"><slot /></span>
</template>
