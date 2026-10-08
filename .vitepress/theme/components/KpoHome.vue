<script setup lang="ts">
// Главная: hero с примером кода (тело content/home/vitepress.md) и карта курса.
// Карта — лекции в порядке курса по частям, обязательные зависимости из frontmatter
// `requires` нарисованы дугами слева; `recommends` проявляются при наведении.
// Сбоку — панель: в покое обязательные цепочки, при наведении — что прочитать до лекции.
import { computed, ref, shallowRef } from 'vue'
import { withBase } from 'vitepress'
import type { ReadingPath } from '../../shared/content/courseMap'
import { siteUrl } from '../../shared/site'
import { useCourseMap } from '../composables/useCourseMap'
import { arcPath, COURSE_LIST_METRICS, layoutCourseList } from '../lib/courseListLayout'

const course = useCourseMap()
const pdf = siteUrl('/kpo-course.pdf')
// Сводный список дополнительного чтения открывается из раздела «Дополнения»; внизу главной
// только самостоятельные страницы рядом с курсом.
const footerExtras = course.extras.filter((extra) => extra.route !== '/extras/02')

// Цвета частей — токены подсветки кода; при большем числе частей цвета повторяются по кругу
const PART_COLORS = ['keyword', 'string', 'function', 'annotation', 'field']
const partColor = (index: number): string =>
  `var(--kpo-code-${PART_COLORS[index % PART_COLORS.length]})`

const metrics = COURSE_LIST_METRICS
const layout = layoutCourseList(course.groups, metrics)
const listStyle = {
  '--kpo-home-gutter': `${metrics.gutter}px`,
  '--kpo-home-row': `${metrics.rowHeight}px`,
  '--kpo-home-part': `${metrics.partHeight}px`
}

type ArcKind = 'requires' | 'recommends'
type Arc = { from: number; to: number; kind: ArcKind; d: string }

const arcs: Arc[] = course.lectures.flatMap((lecture) =>
  (['requires', 'recommends'] as const).flatMap((kind) =>
    lecture[kind]
      .filter(
        (dependency) => layout.centers.has(dependency.lecture) && layout.centers.has(lecture.number)
      )
      .map((dependency) => ({
        from: dependency.lecture,
        to: lecture.number,
        kind,
        d: arcPath(
          layout.centers.get(dependency.lecture)!,
          layout.centers.get(lecture.number)!,
          metrics.gutter
        )
      }))
  )
)

const active = ref<number | null>(null)
const activePath = shallowRef<ReadingPath | null>(null)
const current = computed(() => (active.value === null ? null : course.lecture(active.value)))
/** Лекция в фокусе: наведённая или последняя в наведённой цепочке */
const focusNumber = computed(() => current.value?.number ?? activePath.value?.target ?? null)
/** Подсвеченная обязательная подготовка к лекции в фокусе */
const required = computed(
  () => new Set(current.value?.prerequisites ?? activePath.value?.path.slice(0, -1) ?? [])
)
const helpful = computed(
  () => new Set(current.value?.recommends.map((dependency) => dependency.lecture) ?? [])
)

function focusLecture(number: number): void {
  activePath.value = null
  active.value = number
}

function resetFocus(): void {
  active.value = null
  activePath.value = null
}

function onFocusOut(event: FocusEvent): void {
  const explorer = event.currentTarget as HTMLElement
  if (!explorer.contains(event.relatedTarget as Node | null)) resetFocus()
}

function arcState(arc: Arc): string {
  const focus = focusNumber.value
  if (focus === null) return arc.kind === 'recommends' ? 'is-hidden' : ''
  const inPath = (number: number) => number === focus || required.value.has(number)
  if (arc.kind === 'requires') return inPath(arc.from) && inPath(arc.to) ? 'is-on' : 'is-off'
  return current.value && arc.to === focus ? 'is-hint' : 'is-hidden'
}

function rowState(number: number): string {
  if (focusNumber.value === null) return ''
  if (number === focusNumber.value) return 'is-current'
  if (required.value.has(number)) return 'is-required'
  if (helpful.value.has(number)) return 'is-recommended'
  return 'is-off'
}

/** Причина, по которой лекция попала в подготовку: из ребра `requires`, которое её требует */
function requiredReason(number: number): string {
  const lecture = current.value
  if (!lecture) return ''
  for (const holder of [lecture.number, ...lecture.prerequisites].map(course.lecture)) {
    const found = holder.requires.find((dependency) => dependency.lecture === number)
    if (!found) continue
    if (holder.number === lecture.number) return found.reason
    return found.reason
      ? `нужна для лекции ${holder.number}: ${found.reason}`
      : `нужна для лекции ${holder.number}`
  }
  return ''
}
</script>

<template>
  <div class="kpo-home">
    <section class="kpo-home__hero">
      <div class="kpo-home__copy">
        <h1>Конструирование программного обеспечения</h1>
        <p class="kpo-home__lede">
          Конспект {{ course.lectures.length }} лекций: проектирование, паттерны, архитектура,
          межсервисное взаимодействие и эксплуатация. Примеры на Kotlin, C#, Java и Go.
        </p>
        <p class="kpo-home__actions">
          <a class="kpo-home__button kpo-home__button--brand" :href="withBase('/intro')">
            Начать с введения
          </a>
          <a class="kpo-home__button kpo-home__button--alt" :href="pdf">Скачать PDF</a>
        </p>
      </div>

      <figure class="kpo-home__specimen">
        <div class="kpo-home__code vp-doc">
          <Content />
        </div>
        <figcaption>
          Один пример на четырёх языках: выбранный язык сохранится для всего конспекта.
          Kotlin-версию можно запустить прямо здесь.
        </figcaption>
      </figure>
    </section>

    <section class="kpo-home__map-section" aria-labelledby="kpo-home-map">
      <h2 id="kpo-home-map">Что прочитать до лекции</h2>
      <p class="kpo-home__lede-wide">
        Лекции можно читать в любом порядке, но некоторые опираются на другие. Дуга слева ведёт от
        лекции, без которой следующую не понять. Наведите на лекцию или перейдите к ней клавишей
        Tab, чтобы увидеть, что прочитать до неё.
      </p>
      <p class="kpo-home__lede-narrow">
        Лекции можно читать в любом порядке. Если лекция опирается на другие, под её названием
        указано, что прочитать сначала.
      </p>

      <div class="kpo-home__explorer" @mouseleave="resetFocus" @focusout="onFocusOut">
        <div class="kpo-home__course" :style="listStyle">
          <svg
            class="kpo-home__arcs"
            :width="metrics.gutter"
            :height="layout.height"
            :viewBox="`0 0 ${metrics.gutter} ${layout.height}`"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="kpo-home-arrow"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" class="kpo-home__arrow" />
              </marker>
              <marker
                id="kpo-home-arrow-on"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" class="kpo-home__arrow kpo-home__arrow--on" />
              </marker>
            </defs>
            <path
              v-for="arc in arcs"
              :key="`${arc.kind}-${arc.from}-${arc.to}`"
              :d="arc.d"
              class="kpo-home__arc"
              :class="[`kpo-home__arc--${arc.kind}`, arcState(arc)]"
              :marker-end="
                arc.kind === 'requires'
                  ? arcState(arc) === 'is-on'
                    ? 'url(#kpo-home-arrow-on)'
                    : 'url(#kpo-home-arrow)'
                  : undefined
              "
            />
          </svg>

          <section
            v-for="(group, partIndex) in course.groups"
            :key="group.id"
            class="kpo-home__part"
            :style="{ '--kpo-home-part-color': partColor(partIndex) }"
          >
            <h3 class="kpo-home__part-header">
              <span class="kpo-home__part-title">{{ group.title }}</span>
              <span v-if="group.summary" class="kpo-home__part-summary">{{ group.summary }}</span>
            </h3>
            <ol class="kpo-home__rows">
              <li v-for="number in group.lectures" :key="number">
                <a
                  class="kpo-home__row"
                  :class="rowState(number)"
                  :href="withBase(course.lecture(number).route)"
                  @mouseenter="focusLecture(number)"
                  @focus="focusLecture(number)"
                >
                  <span class="kpo-home__row-number">{{ number }}</span>
                  <span class="kpo-home__row-title">{{ course.lecture(number).title }}</span>
                  <span
                    v-if="course.lecture(number).prerequisites.length"
                    class="kpo-home__row-need"
                  >
                    сначала {{ course.lecture(number).prerequisites.join(', ') }}
                  </span>
                </a>
              </li>
            </ol>
          </section>
        </div>

        <aside class="kpo-home__panel" aria-live="polite">
          <template v-if="current">
            <h3 class="kpo-home__panel-title">Лекция {{ current.number }}. {{ current.title }}</h3>

            <h4 class="kpo-home__panel-label">Сначала прочитайте</h4>
            <ol v-if="current.prerequisites.length" class="kpo-home__steps">
              <li v-for="number in current.prerequisites" :key="number">
                <span class="kpo-home__step">{{ number }}</span>
                <span class="kpo-home__step-text">
                  <span>{{ course.lecture(number).title }}</span>
                  <span v-if="requiredReason(number)" class="kpo-home__reason">
                    {{ requiredReason(number) }}
                  </span>
                </span>
              </li>
            </ol>
            <p v-else class="kpo-home__panel-empty">Ничего: лекцию можно читать первой.</p>

            <h4 class="kpo-home__panel-label">Полезно заранее</h4>
            <ul v-if="current.recommends.length" class="kpo-home__steps">
              <li v-for="dependency in current.recommends" :key="dependency.lecture">
                <span class="kpo-home__step kpo-home__step--soft">{{ dependency.lecture }}</span>
                <span class="kpo-home__step-text">
                  <span>{{ course.lecture(dependency.lecture).title }}</span>
                  <span v-if="dependency.reason" class="kpo-home__reason">
                    {{ dependency.reason }}
                  </span>
                </span>
              </li>
            </ul>
            <p v-else class="kpo-home__panel-empty">Лекция объясняет всё нужное сама.</p>
          </template>

          <template v-else>
            <h3 class="kpo-home__panel-title">Обязательные цепочки</h3>
            <p class="kpo-home__panel-note">
              Порядок чтения, без которого лекцию не понять. Наведите на цепочку, чтобы увидеть её
              на карте.
            </p>
            <ol v-if="course.readingPaths.length" class="kpo-home__paths">
              <li
                v-for="item in course.readingPaths"
                :key="item.target"
                :class="{ 'is-active': activePath === item }"
                @mouseenter="activePath = item"
                @mouseleave="activePath = null"
                @focusin="activePath = item"
                @focusout="activePath = null"
              >
                <a
                  class="kpo-home__path-target"
                  :href="withBase(course.lecture(item.target).route)"
                >
                  Лекция {{ item.target }}. {{ course.lecture(item.target).title }}
                </a>
                <span class="kpo-home__path-steps">
                  сначала {{ item.path.slice(0, -1).join(' → ') }}
                </span>
              </li>
            </ol>
            <p v-else class="kpo-home__panel-empty">Все лекции можно читать независимо.</p>

            <h4 class="kpo-home__panel-label">Можно начинать сразу</h4>
            <p class="kpo-home__start">
              <template v-for="(number, index) in course.startHere" :key="number">
                <a :href="withBase(course.lecture(number).route)">{{ number }}</a
                ><template v-if="index < course.startHere.length - 1">, </template>
              </template>
            </p>
          </template>

          <div v-if="!current" class="kpo-home__legend" aria-hidden="true">
            <span>
              <svg width="28" height="14">
                <path d="M 26 2 C 12 2, 12 12, 26 12" class="kpo-home__legend-arc" />
              </svg>
              без этой лекции следующую не понять
            </span>
            <span>
              <svg width="28" height="14">
                <path
                  d="M 26 2 C 12 2, 12 12, 26 12"
                  class="kpo-home__legend-arc kpo-home__legend-arc--soft"
                />
              </svg>
              полезный контекст, виден при наведении
            </span>
          </div>
        </aside>
      </div>

      <div class="kpo-home__bento">
        <article
          v-for="(group, index) in course.groups"
          :key="group.id"
          class="kpo-home__cell"
          :class="`kpo-home__cell--tint-${index % 3}`"
        >
          <h3>{{ group.title }}</h3>
          <p v-if="group.summary" class="kpo-home__summary">{{ group.summary }}</p>
          <ol class="kpo-home__lectures">
            <li v-for="number in group.lectures" :key="number">
              <a :href="withBase(course.lecture(number).route)">
                <span class="kpo-home__n">{{ number }}</span>
                <span>{{ course.lecture(number).title }}</span>
              </a>
              <span v-if="course.lecture(number).prerequisites.length" class="kpo-home__need">
                Сначала:
                <template v-for="(n, i) in course.lecture(number).prerequisites" :key="n">
                  <a :href="withBase(course.lecture(n).route)">{{ n }}</a
                  ><template v-if="i < course.lecture(number).prerequisites.length - 1"
                    >,
                  </template>
                </template>
              </span>
              <span v-if="course.lecture(number).recommends.length" class="kpo-home__soft">
                Полезно:
                {{
                  course
                    .lecture(number)
                    .recommends.map((dependency) => dependency.lecture)
                    .join(', ')
                }}
              </span>
            </li>
          </ol>
        </article>
      </div>
    </section>

    <section class="kpo-home__more" aria-label="Дополнительные страницы">
      <a v-for="extra in footerExtras" :key="extra.route" :href="withBase(extra.route)">
        {{ extra.title }}
      </a>
      <a :href="withBase('/conclusion')">Заключение</a>
    </section>
  </div>
</template>
