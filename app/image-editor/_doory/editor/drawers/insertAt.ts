import type { EditorEngine } from '../engine/editor'

/** Centre of the active page, nudged so repeated inserts do not stack exactly (same rule as `editor.insert`). */
export function pageCentre(editor: EditorEngine): { x: number; y: number } {
  const page = editor.pageSizeOf(editor.state.activePageId)
  const cx = page.width / 2
  const cy = page.height / 2
  const view = editor.activeView()
  if (!view) return { x: cx, y: cy }
  const stacked = view.canvas.getObjects().filter((o) => {
    const c = o.getCenterPoint()
    return Math.abs(c.x - cx) < 12 && Math.abs(c.y - cy) < 12
  }).length
  const off = Math.min(stacked, 8) * 24
  return { x: cx + off, y: cy + off }
}
