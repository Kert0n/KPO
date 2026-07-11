import { clamp } from '../../lib/math'

export type MermaidViewportMode = 'desktop' | 'mobile'

export type ResolveMermaidAutoScaleInput = {
  viewBoxWidth?: number | null
  viewBoxHeight?: number | null
  naturalWidth?: number | null
  naturalHeight?: number | null
  availableWidth?: number | null
  minScale: number
  minHeight: number
  wideDiagramMinWidth?: number
}

export type ResolveMermaidManualScaleInput = {
  currentScale: number
  delta: number
  mode: MermaidViewportMode
}

export type MermaidOverflowState = {
  hasOverflowX: boolean
}

export type ResolveMermaidOverflowInput = {
  clientWidth: number
  scrollWidth: number
  epsilon?: number
}

export type ShouldShowMermaidToolbarInput = MermaidOverflowState & {
  hasManualScale: boolean
  isHovered: boolean
  isFocusWithin: boolean
}

export function readSvgViewBox(rendered: string): { width: number | null; height: number | null } {
  const match = rendered.match(/\sviewBox="([^"]+)"/)
  if (!match) return { width: null, height: null }

  const [, , width, height] = match[1].trim().split(/\s+/).map(Number)

  return {
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null
  }
}

export function resolveMermaidAutoScale(input: ResolveMermaidAutoScaleInput): number {
  const width = positive(input.naturalWidth) ?? positive(input.viewBoxWidth)
  const availableWidth = positive(input.availableWidth)
  if (!width || !availableWidth) return 1

  const height = positive(input.naturalHeight) ?? positive(input.viewBoxHeight)
  const minScale = positive(input.minScale) ?? 1
  const fitScale = availableWidth / width
  if (fitScale >= 1) return 1

  let scale = Math.max(fitScale, minScale)

  const minHeight = positive(input.minHeight)
  if (height && minHeight) {
    scale = Math.max(scale, Math.min(1, minHeight / height))
  }

  const wideDiagramMinWidth = positive(input.wideDiagramMinWidth)
  if (wideDiagramMinWidth && width >= wideDiagramMinWidth) {
    scale = Math.max(scale, wideDiagramMinWidth / width)
  }

  return roundScale(Math.min(1, scale))
}

export function resolveMermaidManualScale(input: ResolveMermaidManualScaleInput): number {
  const min = input.mode === 'mobile' ? 0.35 : 0.5
  const next = input.currentScale + input.delta
  return roundScale(clamp(next, min, 1.5))
}

export function resolveMermaidRenderedWidth(width: number | null | undefined, scale: number): number | null {
  const viewWidth = positive(width)
  if (!viewWidth) return null
  return Math.ceil(viewWidth * scale)
}

export function resolveMermaidRenderedHeight(height: number | null | undefined, scale: number): number | null {
  const viewHeight = positive(height)
  if (!viewHeight) return null
  return Math.ceil(viewHeight * scale)
}

export function resolveMermaidOverflow(input: ResolveMermaidOverflowInput): MermaidOverflowState {
  const epsilon = input.epsilon ?? 1

  return {
    hasOverflowX: input.scrollWidth > input.clientWidth + epsilon
  }
}

export function resolveCenteredScrollLeft(input: {
  clientWidth: number
  scrollWidth: number
}): number {
  return Math.max(0, Math.round((input.scrollWidth - input.clientWidth) / 2))
}

export function resolveScrollLeftForCenterRatio(input: {
  centerRatio: number
  clientWidth: number
  scrollWidth: number
}): number {
  const maxScrollLeft = Math.max(0, input.scrollWidth - input.clientWidth)
  const targetCenter = input.centerRatio * input.scrollWidth
  return clamp(Math.round(targetCenter - input.clientWidth / 2), 0, maxScrollLeft)
}

export function shouldShowMermaidToolbar(input: ShouldShowMermaidToolbarInput): boolean {
  return input.hasOverflowX
    || input.hasManualScale
    || input.isHovered
    || input.isFocusWithin
}

function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function roundScale(value: number): number {
  return Math.round(value * 1000) / 1000
}
