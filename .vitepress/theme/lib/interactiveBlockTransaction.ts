import { preserveViewportAnchor } from './viewportAnchor'

export async function preserveBlockViewportPosition(
  root: HTMLElement | null | undefined,
  mutate: () => void | Promise<void>,
  options?: { frames?: number }
): Promise<void> {
  await preserveViewportAnchor(root, mutate, options)
}
