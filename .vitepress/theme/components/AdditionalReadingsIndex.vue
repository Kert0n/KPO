<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import type { ContentAdditionalReadings } from '../../shared/content/additionalReadings'
// VitePress turns a data loader's default export into this virtual named export at build time.
// @ts-expect-error vue-tsc does not run the VitePress data-loader transform.
import { data as readings } from '../data/additionalReadings.data'

const typedReadings = readings as ContentAdditionalReadings[]

const sections = computed(() =>
  [
    {
      kind: 'lecture' as const,
      id: 'additional-readings-lectures',
      title: 'Лекции',
      linkLabel: 'Открыть лекцию'
    },
    {
      kind: 'extra' as const,
      id: 'additional-readings-articles',
      title: 'Статьи и дополнения',
      linkLabel: 'Открыть материал'
    }
  ]
    .map((section) => ({
      ...section,
      sources: typedReadings.filter((reading) => reading.sourceKind === section.kind)
    }))
    .filter((section) => section.sources.length > 0)
)
</script>

<template>
  <div class="kpo-additional-readings">
    <section
      v-for="section in sections"
      :key="section.kind"
      class="kpo-additional-readings__category"
      :aria-labelledby="section.id"
    >
      <h2 :id="section.id">{{ section.title }}</h2>

      <div class="kpo-additional-readings__sources">
        <article
          v-for="source in section.sources"
          :key="source.route"
          class="kpo-additional-readings__source"
        >
          <header class="kpo-additional-readings__header">
            <h3 :id="source.anchor">{{ source.title }}</h3>
            <a class="kpo-additional-readings__source-link" :href="withBase(source.route)">
              {{ section.linkLabel }}
            </a>
          </header>

          <div
            v-for="group in source.groups"
            :key="`${source.route}-${group.title}`"
            class="kpo-additional-readings__group"
          >
            <h4>{{ group.title }}</h4>
            <ul>
              <li v-for="item in group.items" :key="`${source.route}-${group.title}-${item.url}`">
                <a :href="item.url">{{ item.title }}</a>
                <span v-if="item.note" class="kpo-additional-readings__note">
                  — {{ item.note }}
                </span>
              </li>
            </ul>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
