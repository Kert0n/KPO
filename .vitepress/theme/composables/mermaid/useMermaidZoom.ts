import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { resolveMermaidManualScale, type MermaidViewportMode } from '../../lib/mermaidLayoutModel'

type MermaidZoomOptions = {
  autoScale: ComputedRef<number>
  viewportMode: Ref<MermaidViewportMode>
  currentCenterRatio: () => number | null
  resetUserScroll: () => void
  syncViewportLayout: (options?: { forceCenter?: boolean; centerRatio?: number | null }) => Promise<void>
}

export function useMermaidZoom(options: MermaidZoomOptions) {
  const manualScale = ref<number | null>(null)
  const effectiveScale = computed(() => manualScale.value ?? options.autoScale.value)
  const scaleLabel = computed(() => `${Math.round(effectiveScale.value * 100)}%`)

  async function zoomOut(): Promise<void> {
    await updateManualScale(-0.1)
  }

  async function zoomIn(): Promise<void> {
    await updateManualScale(0.1)
  }

  async function resetScale(): Promise<void> {
    manualScale.value = null
    options.resetUserScroll()
    await options.syncViewportLayout({ forceCenter: true })
  }

  async function updateManualScale(delta: number): Promise<void> {
    const centerRatio = options.currentCenterRatio()
    manualScale.value = resolveMermaidManualScale({
      currentScale: effectiveScale.value,
      delta,
      mode: options.viewportMode.value
    })
    await options.syncViewportLayout({ centerRatio })
  }

  return { manualScale, effectiveScale, scaleLabel, zoomOut, zoomIn, resetScale }
}
