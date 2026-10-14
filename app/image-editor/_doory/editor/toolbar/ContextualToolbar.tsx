import { Fragment, useSyncExternalStore } from 'react'
import { useEditorState } from '../context'
import { t } from '../strings'
import { Toolbar } from '../ui/Toolbar'
import { toolbarSections } from './registry'
import ed from '../chrome/ed.module.css'

/**
 * The row under the top bar that morphs with the selection (text, shape, image, sticker, several objects).
 * It is always there (page tools when nothing is selected), so selecting an object never shifts the page under the pointer.
 */
export function ContextualToolbar() {
  const sections = useSyncExternalStore(toolbarSections.subscribe, toolbarSections.getSnapshot)
  const state = useEditorState((s) => s)
  const applicable = sections.filter((s) => s.appliesTo(state.selection, state))
  // While cropping only the crop controls make sense.
  const shown = state.ui.cropping ? applicable.filter((s) => s.id === 'crop') : applicable
  if (state.readOnly || shown.length === 0) return null
  return (
    <div className={ed.strip} data-testid="ed-context-strip" data-kind={state.selection.kinds.join(' ') || 'page'}>
      <div className={ed.stripInner}>
        <Toolbar label={t.toolbar.label} className={ed.row}>
          {shown.map((s, i) => {
            const Component = s.component
            return (
              <Fragment key={s.id}>
                {i > 0 ? <span className={ed.divider} role="separator" aria-orientation="vertical" /> : null}
                <Component />
              </Fragment>
            )
          })}
        </Toolbar>
      </div>
    </div>
  )
}
