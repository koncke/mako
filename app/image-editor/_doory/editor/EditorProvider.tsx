import type { ReactNode } from 'react'
import { EngineContext, PortalContext } from './context'
import type { EditorEngine } from './engine/editor'

/** Makes the engine and the portal root (where popovers and dialogs render) available to the editor UI. */
export function EditorProvider({ engine, portalRoot, children }: { engine: EditorEngine; portalRoot: HTMLElement | null; children: ReactNode }) {
  return (
    <EngineContext.Provider value={engine}>
      <PortalContext.Provider value={portalRoot}>{children}</PortalContext.Provider>
    </EngineContext.Provider>
  )
}
