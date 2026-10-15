import { Fragment, useSyncExternalStore } from 'react'
import { useEditorState } from '../context'
import { t } from '../strings'
import { Toolbar } from '../ui/Toolbar'
import { Divider } from './parts'
import { toolbarSections } from './registry'
import styles from './parts.module.css'

/**
 * La barra del objeto de Canva: flota centrada arriba del lienzo (8 px del borde) y cambia con la selección (texto,
 * forma, imagen, línea, varios, grupo). Sin selección muestra lo de la página, así que siempre está y el lienzo nunca
 * se corre al elegir algo.
 *
 * Se monta como PRIMER hijo del área del lienzo: el ancla mide cero de alto y la barra va en posición absoluta encima
 * del lienzo, como en Canva (el lienzo deja ~64 px arriba para que la página no quede debajo).
 */
export function ContextualToolbar() {
  const sections = useSyncExternalStore(toolbarSections.subscribe, toolbarSections.getSnapshot)
  const state = useEditorState((s) => s)
  const applicable = sections.filter((s) => s.appliesTo(state.selection, state))
  // Mientras se recorta, sólo tienen sentido los controles del recorte.
  const shown = state.ui.cropping ? applicable.filter((s) => s.id === 'crop') : applicable
  if (state.readOnly || shown.length === 0) return null
  return (
    <div className={styles.anchor}>
      <div className={styles.dock}>
        <div className={styles.bar} data-testid="ed-context-strip" data-kind={state.selection.kinds.join(' ') || 'page'}>
          <Toolbar label={t.toolbar.label} className={styles.row}>
            {shown.map((s, i) => {
              const Component = s.component
              return (
                <Fragment key={s.id}>
                  {i > 0 ? <Divider /> : null}
                  <Component />
                </Fragment>
              )
            })}
          </Toolbar>
        </div>
      </div>
    </div>
  )
}
