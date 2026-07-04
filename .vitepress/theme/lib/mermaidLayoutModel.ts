export type MermaidViewportMode = 'desktop' | 'mobile'

export type ResolveMermaidAutoScaleInput = {
  viewBoxWidth?: number | null
  viewBoxHeight?: number | null
  availableWidth?: number | null
  minScale: number
  minHeight: number
  minRenderedWidth?: number
}

export type ResolveMermaidManualScaleInput = {
  currentScale: number
  delta: number
  mode: MermaidViewportMode
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
  const width = positive(input.viewBoxWidth)
  const availableWidth = positive(input.availableWidth)
  if (!width || !availableWidth) return 1

  const height = positive(input.viewBoxHeight)
  const minScale = positive(input.minScale) ?? 1
  const fitScale = availableWidth / width
  let scale = fitScale >= 1 ? 1 : Math.max(fitScale, minScale)

  const minHeight = positive(input.minHeight)
  if (height && minHeight) {
    scale = Math.max(scale, minHeight / height)
  }

  const minRenderedWidth = positive(input.minRenderedWidth)
  if (minRenderedWidth) {
    scale = Math.max(scale, minRenderedWidth / width)
  }

  return roundScale(scale)
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

function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundScale(value: number): number {
  return Math.round(value * 1000) / 1000
}
