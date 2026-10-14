import type { EditorEngine } from '../engine/editor'
import type { CollabSession } from './session'

/** What the Playwright specs of `e2e/collab` reach through `window.__doory_collab` (compiled out unless the dev server runs with `VITE_E2E=true`). */
export interface CollabTestHandle {
  engine: EditorEngine
  session: CollabSession | null
}

interface TestWindow {
  __doory_collab?: CollabTestHandle
}

export function exposeForTests(handle: CollabTestHandle): () => void {
  // MaKo: sin las pruebas e2e de Doory (Vite): el gancho nunca se expone.
  if (typeof window === 'undefined' || !(window as unknown as { __MAKO_E2E__?: boolean }).__MAKO_E2E__) return () => undefined
  const target = window as unknown as TestWindow
  target.__doory_collab = handle
  return () => {
    if (target.__doory_collab === handle) delete target.__doory_collab
  }
}
