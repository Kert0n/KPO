<script setup lang="ts">
import { withBase } from 'vitepress'
import { data as lectures } from '../data/additionalReadings.data'
</script>

<template>
  <div class="kpo-additional-readings">
    <section v-for="lecture in lectures" :key="lecture.lecture" class="kpo-additional-readings__lecture">
      <header class="kpo-additional-readings__header">
        <h2 :id="`lecture-${lecture.lecture}`">Лекция {{ lecture.lecture }}. {{ lecture.title }}</h2>
        <a class="kpo-additional-readings__lecture-link" :href="withBase(lecture.url)"> Открыть лекцию </a>
      </header>

      <div
        v-for="group in lecture.groups"
        :key="`${lecture.lecture}-${group.title}`"
        class="kpo-additional-readings__group"
      >
        <h3>{{ group.title }}</h3>
        <ul>
          <li v-for="item in group.items" :key="`${lecture.lecture}-${group.title}-${item.url}`">
            <a :href="item.url">{{ item.title }}</a>
            <span v-if="item.note" class="kpo-additional-readings__note"> — {{ item.note }} </span>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
