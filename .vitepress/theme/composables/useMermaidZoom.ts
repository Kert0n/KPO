import { computed, ref, type Ref } from 'vue'
import {
  resolveMermaidAutoScale,
  resolveMermaidManualScale,
  resolveMermaidRenderedHeight,
  resolveMermaidRenderedWidth
} from '../lib/mermaidLayoutModel'
import type { useMermaidViewport } from './useMermaidViewport'

type MermaidViewport = ReturnType<typeof useMermaidViewport>

export function useMermaidZoom(options: {
  viewBoxWidth: Ref<number | null>
  viewBoxHeight: Ref<number | null>
  viewport: MermaidViewport
}) {
  const manualScale = ref<number | null>(null)
  const autoScale = computed(() => {
    const viewport = options.viewport
    return resolveMermaidAutoScale({
      viewBoxWidth: options.viewBoxWidth.value,
      viewBoxHeight: options.viewBoxHeight.value,
      availableWidth: viewport.availableWidth.value,
      minScale:
        viewport.viewportMode.value === 'mobile'
          ? viewport.scaleConfig.value.mobileMinScale
          : viewport.scaleConfig.value.desktopMinScale,
      minHeight: viewport.scaleConfig.value.minHeight,
      wideDiagramMinWidth: viewport.scaleConfig.value.wideDiagramMinWidth
    })
  })
  const effectiveScale = computed(() => manualScale.value ?? autoScale.value)
  const scaleLabel = computed(() => `${Math.round(effectiveScale.value * 100)}%`)
  const canvasStyle = computed(() => {
    const style: Record<string, string> = {}
    const width = resolveMermaidRenderedWidth(options.viewBoxWidth.value, effectiveScale.value)
    const height = resolveMermaidRenderedHeight(options.viewBoxHeight.value, effectiveScale.value)
    if (width) style['--kpo-mermaid-render-width'] = `${width}px`
    if (height) style['--kpo-mermaid-render-height'] = `${height}px`
    return style
  })

  async function zoomOut(): Promise<void> {
    await updateManualScale(-0.1)
  }

  async function zoomIn(): Promise<void> {
    await updateManualScale(0.1)
  }

  async function resetScale(): Promise<void> {
    manualScale.value = null
    options.viewport.resetUserScroll()
    await options.viewport.syncLayout({ forceCenter: true })
  }

  async function updateManualScale(delta: number): Promise<void> {
    const centerRatio = options.viewport.currentCenterRatio()
    manualScale.value = resolveMermaidManualScale({
      currentScale: effectiveScale.value,
      delta,
      mode: options.viewport.viewportMode.value
    })
    await options.viewport.syncLayout({ centerRatio })
  }

  return { manualScale, effectiveScale, scaleLabel, canvasStyle, zoomOut, zoomIn, resetScale }
}
