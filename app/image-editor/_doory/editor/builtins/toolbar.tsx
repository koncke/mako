import { registerCommand } from '../commands'
import { requestLinkEditor } from '../ContextMenuHost'
import { t } from '../strings'
import { registerToolbarSection } from '../toolbar/registry'
import { ActionsSection, GroupSection, MultiSection, ObjectSection } from '../toolbar/sections/common'
import { elementColors, onlyKind } from '../toolbar/kinds'
import { CropSection } from '../toolbar/sections/crop'
import { ImageSection } from '../toolbar/sections/image'
import { PageSection } from '../toolbar/sections/page'
import { ElementSection, LineSection, PlaceholderSection, QrSection, ShapeSection } from '../toolbar/sections/shapes'
import { TextSection } from '../toolbar/sections/text'

/**
 * La barra del objeto, en el orden de Canva: lo propio de cada tipo (texto, imagen, forma, línea, varios, grupo…),
 * después «Animar» y «Posición», y al final «Transparencia», el candado y el `⋯ Más`. Cada grupo es una sección; las
 * que no aplican no se dibujan y los separadores siguen a las que se ven. Sin nada elegido la barra es la de la
 * página, así que el lienzo nunca se corre cuando empieza una selección.
 */
export function registerBuiltinToolbarSections(): void {
  const selected = (ids: readonly string[], cropping: unknown): boolean => ids.length > 0 && cropping === null
  registerToolbarSection({ id: 'crop', order: 0, appliesTo: (_s, state) => state.ui.cropping !== null, component: CropSection })
  registerToolbarSection({ id: 'page', order: 10, appliesTo: (sel, state) => sel.ids.length === 0 && state.ui.cropping === null, component: PageSection })
  registerToolbarSection({ id: 'text', order: 10, appliesTo: (sel) => onlyKind(sel.kinds, 'text'), component: TextSection })
  registerToolbarSection({ id: 'shape', order: 10, appliesTo: (sel) => onlyKind(sel.kinds, 'shape') && sel.ids.length === 1, component: ShapeSection })
  registerToolbarSection({ id: 'line', order: 10, appliesTo: (sel) => onlyKind(sel.kinds, 'line') && sel.ids.length === 1, component: LineSection })
  registerToolbarSection({ id: 'image', order: 10, appliesTo: (sel) => onlyKind(sel.kinds, 'image') && sel.ids.length === 1, component: ImageSection })
  registerToolbarSection({ id: 'element', order: 10, appliesTo: (sel) => onlyKind(sel.kinds, 'element') && sel.ids.length === 1 && elementColors(sel.objects[0]).length > 0, component: ElementSection })
  registerToolbarSection({ id: 'qr', order: 10, appliesTo: (sel) => onlyKind(sel.kinds, 'qr'), component: QrSection })
  registerToolbarSection({ id: 'placeholder', order: 10, appliesTo: (sel) => onlyKind(sel.kinds, 'placeholder') && sel.ids.length === 1, component: PlaceholderSection })
  registerToolbarSection({ id: 'group', order: 10, appliesTo: (sel) => onlyKind(sel.kinds, 'group') && sel.ids.length === 1, component: GroupSection })
  registerToolbarSection({ id: 'multi', order: 10, appliesTo: (sel) => sel.ids.length > 1, component: MultiSection })
  registerToolbarSection({ id: 'object', order: 50, appliesTo: (sel, state) => selected(sel.ids, state.ui.cropping), component: ObjectSection })
  registerToolbarSection({ id: 'actions', order: 90, appliesTo: (sel, state) => selected(sel.ids, state.ui.cropping), component: ActionsSection })

  // Atajos de Canva que abren piezas de la barra y del menú del clic derecho.
  registerCommand({ id: 'edit.link', label: t.context.addLink, shortcut: 'Mod+K', group: t.cmdGroup.edit, run: (e) => requestLinkEditor(e), enabled: ({ state }) => state.selection.ids.length > 0 && !state.selection.editing })
  registerCommand({ id: 'view.layers', label: t.context.showLayers, shortcut: 'Alt+1', group: t.cmdGroup.view, run: (e) => e.patchUi({ panelId: e.state.ui.panelId === 'layers' ? null : 'layers' }) })
}

registerBuiltinToolbarSections()
