import { Briefcase, CloudUpload, LayoutGrid, LayoutTemplate, Layers, Music, PencilRuler, Shapes, Sparkles, Type } from 'lucide-react'
import { useEditor, useEditorState } from '../context'
import { AppsPanel } from '../drawers/AppsPanel'
import { ElementsPanel } from '../drawers/ElementsPanel'
import { ImageDrawer } from '../drawers/ImageDrawer'
import { TextDrawer } from '../drawers/TextDrawer'
import { ToolsPanel } from '../drawers/ToolsPanel'
import { CommentsButtonIcon } from '../panels/CommentsButtonIcon'
import { LayersPanel } from '../panels/LayersPanel'
import { registerPanel } from '../panels/registry'
import { t } from '../strings'
import { loadable } from '../ui/loadable'
import { LazyCommentPins } from '../workspace/CommentPinsLoader'
import styles from '../drawers/Drawers.module.css'

// Tools that most sessions never open live in chunks of their own: the rail tab starts the download when it is
// hovered or focused, so the panel is usually there by the time it is clicked.
const TemplatesPanel = loadable(() => import('../panels/TemplatesPanel').then((m) => m.TemplatesPanel))
const BrandPanel = loadable(() => import('../panels/BrandPanel').then((m) => m.BrandPanel))
const AnimatePanel = loadable(() => import('../panels/AnimatePanel').then((m) => m.AnimatePanel))
const AudioPanel = loadable(() => import('../panels/AudioPanel').then((m) => m.AudioPanel))
const CommentsPanel = loadable(() => import('../panels/CommentsPanel').then((m) => m.CommentsPanel))

/**
 * «Marca»: el kit de marca de Doory cuando el servidor lo ofrece; a un invitado, la invitación a crear una cuenta
 * (lo de Doory). En MaKo todavía no hay kit de marca (etapa 3, Supabase) y nadie entra como invitado: la pestaña
 * queda, como en Canva, con un aviso corto en vez de un «Regístrate» que no lleva a ningún lado.
 */
function MarcaPanel() {
  const editor = useEditor()
  const mode = useEditorState((s) => s.mode)
  if (!editor.adapter.services.brand && mode !== 'guest') return <p className={styles.note}>{t.rail.brandSoon}</p>
  return <BrandPanel />
}

// Los íconos del riel: lucide con la forma que usa Canva (relevamiento-canva-armazon.md §11); el riel los dibuja a 24 px.
const icon = { size: 18, 'aria-hidden': true } as const

/**
 * Los paneles, como el riel izquierdo de Canva 2025–26 y en su orden: Diseño, Elementos, Texto, Marca, Subidos,
 * Herramientas, (Proyectos, que registra MaKo en app/image-editor/mako/registro.ts) y Apps. Todos se abren a la
 * izquierda (`placement: 'sidebar'`): en Canva no hay cajones colgando de la barra superior.
 *
 * Qué quedó de las herramientas de Doory y dónde (ninguna se perdió):
 * - Plantillas → «Diseño». Stickers, Formas, formas extra, gráficos de datos, marcos y código QR → «Elementos».
 * - Imagen (subir, lo subido, fotos de stock) → «Subidos». Fondo → «Herramientas» (con formas, líneas, texto, marco).
 * - Animar, Audio, Capas y Comentarios siguen registrados sin pestaña: los abren la barra del objeto (Animar,
 *   Posición → Capas), la línea de tiempo, los comandos y el panel «Apps»; Comentarios además la barra superior.
 */
export function registerBuiltinPanels(): void {
  const editable = ({ state }: { state: { readOnly: boolean } }): boolean => !state.readOnly
  registerPanel({ id: 'design', label: t.rail.design, icon: <LayoutTemplate {...icon} />, order: 10, rail: true, placement: 'sidebar', component: TemplatesPanel, preload: TemplatesPanel.preload, requires: editable })
  registerPanel({ id: 'elements', label: t.rail.elements, icon: <Shapes {...icon} />, order: 20, rail: true, placement: 'sidebar', component: ElementsPanel, requires: editable })
  registerPanel({ id: 'text', label: t.rail.text, icon: <Type {...icon} />, order: 30, rail: true, placement: 'sidebar', component: TextDrawer, requires: editable, shortcut: 'T' })
  registerPanel({ id: 'brand', label: t.rail.brand, icon: <Briefcase {...icon} />, order: 40, rail: true, placement: 'sidebar', component: MarcaPanel, preload: BrandPanel.preload, requires: ({ state }) => !state.readOnly && state.mode !== 'shared-edit' })
  registerPanel({ id: 'uploads', label: t.rail.uploads, icon: <CloudUpload {...icon} />, order: 50, rail: true, placement: 'sidebar', component: ImageDrawer, requires: editable })
  registerPanel({ id: 'tools', label: t.rail.tools, icon: <PencilRuler {...icon} />, order: 60, rail: true, placement: 'sidebar', component: ToolsPanel, requires: editable })
  // order 70: «Proyectos» (mako/registro.ts)
  registerPanel({ id: 'apps', label: t.rail.apps, icon: <LayoutGrid {...icon} />, order: 80, rail: true, placement: 'sidebar', component: AppsPanel, requires: editable })

  // Sin pestaña en el riel: se abren desde la barra del objeto, «Apps», la línea de tiempo o los comandos.
  registerPanel({ id: 'animate', label: t.rail.animate, title: t.animation.panel.title, icon: <Sparkles {...icon} />, order: 100, placement: 'sidebar', component: AnimatePanel, preload: AnimatePanel.preload, requires: editable })
  registerPanel({ id: 'audio', label: t.rail.audio, title: t.audio.title, icon: <Music {...icon} />, order: 110, placement: 'sidebar', component: AudioPanel, preload: AudioPanel.preload, readOnly: true })
  registerPanel({ id: 'layers', label: t.rail.layers, icon: <Layers {...icon} />, order: 120, placement: 'sidebar', component: LayersPanel, readOnly: true })
  registerPanel({
    id: 'comments',
    label: t.rail.comments,
    icon: <CommentsButtonIcon />,
    order: 130,
    placement: 'sidebar',
    slot: 'end',
    readOnly: true,
    component: CommentsPanel,
    preload: () => void Promise.all([CommentsPanel.preload(), LazyCommentPins.preload()]),
    requires: ({ editor, state }) => state.mode !== 'shared-view' && (!!editor.adapter.services.comments || state.mode === 'guest' || state.mode === 'shared-comment'),
  })
}

registerBuiltinPanels()
