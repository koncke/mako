/**
 * Los tiradores de la selección, con el aspecto de Canva: marco violeta de 2 px, tiradores de esquina circulares
 * blancos con borde gris y sombra (12 px), tiradores laterales en forma de píldora y el control de rotación ABAJO
 * del elemento (un círculo blanco con la flecha de girar), sin la rayita que lo une.
 *
 * Qué tiradores tiene cada tipo (de Doory): las formas, los ocho (ancho y alto por separado); fotos, stickers, grupos
 * y texto curvo, sólo las esquinas (estirar un lado los deformaría); las cajas de texto, además las dos laterales,
 * que cambian el ancho de la caja y no las letras; las líneas, un tirador en cada punta (ver `DoryLine`).
 *
 * La selección de varios elementos (`ActiveSelection`) usa los tiradores de Canva desde que se crea: se le cambia
 * `createControls` al cargar este módulo.
 */
import { ActiveSelection, Circle, type Control, Ellipse, type FabricObject, IText, Path, Polygon, Polyline, Rect, Textbox, Triangle, util } from 'fabric'
import { DoryLine, installLineControls } from './DoryLine'

/** Diámetro del tirador de esquina (Canva: ~12 px). */
const CORNER = 12
/** Píldora lateral: largo y ancho. */
const PILL_LONG = 18
const PILL_SHORT = 6
/** Diámetro del control de rotación. */
const ROTATE = 24
/** Distancia del borde de abajo al centro del control de rotación. */
export const ROTATE_OFFSET = 30
/** Grosor del marco de la selección (Canva: 2 px). */
const BORDER_WIDTH = 2

const HANDLE_FILL = '#ffffff'
const HANDLE_BORDER = 'rgba(57, 70, 96, 0.24)' /* Canva: neutro normal #39466024 */
const HANDLE_SHADOW = 'rgba(21, 30, 130, 0.22)' /* Canva: sombra elevada #151e82 */
const GLYPH = '#0e1318' /* Canva: texto de la interfaz */

const EDGES = ['ml', 'mr', 'mt', 'mb'] as const
const CORNERS = ['tl', 'tr', 'bl', 'br'] as const

const SHAPE_CLASSES: readonly (abstract new (...args: never[]) => FabricObject)[] = [Rect, Circle, Ellipse, Triangle, Polygon, Polyline, Path]

function isShape(obj: FabricObject): boolean {
  return SHAPE_CLASSES.some((cls) => obj instanceof cls)
}

type Painter = (ctx: CanvasRenderingContext2D, left: number, top: number, style: unknown, target: FabricObject) => void

/** Sombra suave y borde gris, como los tiradores de Canva. */
function withHandleStyle(ctx: CanvasRenderingContext2D, draw: () => void): void {
  ctx.fillStyle = HANDLE_FILL
  ctx.shadowColor = HANDLE_SHADOW
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1
  draw()
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 1
  ctx.strokeStyle = HANDLE_BORDER
  ctx.stroke()
}

const paintCorner: Painter = (ctx, left, top) => {
  ctx.save()
  withHandleStyle(ctx, () => {
    ctx.beginPath()
    ctx.arc(left, top, CORNER / 2, 0, Math.PI * 2)
  })
  ctx.restore()
}

/** Píldora lateral: vertical en los costados (`ml`, `mr`), horizontal arriba y abajo; gira con el elemento. */
function pillPainter(vertical: boolean): Painter {
  return (ctx, left, top, _style, target) => {
    const w = vertical ? PILL_SHORT : PILL_LONG
    const h = vertical ? PILL_LONG : PILL_SHORT
    ctx.save()
    ctx.translate(left, top)
    ctx.rotate(util.degreesToRadians(target.getTotalAngle()))
    withHandleStyle(ctx, () => {
      ctx.beginPath()
      ctx.roundRect(-w / 2, -h / 2, w, h, PILL_SHORT / 2)
    })
    ctx.restore()
  }
}

/** El control de rotación: círculo blanco con la flecha circular de «girar». */
const paintRotate: Painter = (ctx, left, top) => {
  ctx.save()
  withHandleStyle(ctx, () => {
    ctx.beginPath()
    ctx.arc(left, top, ROTATE / 2, 0, Math.PI * 2)
  })
  // Tres cuartos de círculo con la punta de flecha.
  const r = 5
  ctx.strokeStyle = GLYPH
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(left, top, r, Math.PI * 1.75, Math.PI * 1.25)
  ctx.stroke()
  const tipX = left + Math.cos(Math.PI * 1.75) * r
  const tipY = top + Math.sin(Math.PI * 1.75) * r
  ctx.beginPath()
  ctx.moveTo(tipX + 2.6, tipY - 0.4)
  ctx.lineTo(tipX, tipY)
  ctx.lineTo(tipX + 0.2, tipY - 2.8)
  ctx.stroke()
  ctx.restore()
}

type ControlSet = Record<string, Control | undefined>

/** Les pone el aspecto de Canva a los tiradores de un juego de controles (no cambia cuáles se ven). */
function dressControls(controls: ControlSet): void {
  for (const name of CORNERS) {
    const c = controls[name]
    if (!c) continue
    c.sizeX = c.sizeY = CORNER + 4
    c.touchSizeX = c.touchSizeY = CORNER + 20
    c.render = paintCorner
  }
  for (const name of EDGES) {
    const c = controls[name]
    if (!c) continue
    const vertical = name === 'ml' || name === 'mr'
    c.sizeX = vertical ? PILL_SHORT + 6 : PILL_LONG + 6
    c.sizeY = vertical ? PILL_LONG + 6 : PILL_SHORT + 6
    c.touchSizeX = c.touchSizeY = PILL_LONG + 14
    c.render = pillPainter(vertical)
  }
  const rotate = controls.mtr
  if (rotate) {
    rotate.x = 0
    rotate.y = 0.5
    rotate.offsetY = ROTATE_OFFSET
    rotate.withConnection = false
    rotate.sizeX = rotate.sizeY = ROTATE
    rotate.touchSizeX = rotate.touchSizeY = ROTATE + 12
    rotate.render = paintRotate
  }
}

/** Aplica a `obj` los tiradores que le tocan por su tipo, con el aspecto de Canva. Se puede llamar varias veces. */
export function customizeControls(obj: FabricObject): void {
  if (obj instanceof ActiveSelection) return
  if (obj instanceof DoryLine) {
    installLineControls(obj)
    return
  }
  obj.borderScaleFactor = BORDER_WIDTH
  const controls = obj.controls as ControlSet
  // Texto: las laterales fijan el ancho de la caja (no mientras va en curva); arriba o abajo sólo deformarían las
  // letras. Las formas tienen todas; el resto (fotos, grupos, stickers), sólo las esquinas.
  const sidesOnly = obj instanceof IText
  const wrapWidth = obj instanceof Textbox && !(typeof (obj as { curveAmount?: number }).curveAmount === 'number' && (obj as { curveAmount?: number }).curveAmount !== 0)
  for (const name of EDGES) {
    const control = controls[name]
    if (!control) continue
    if (sidesOnly) control.visible = wrapWidth && (name === 'ml' || name === 'mr')
    else control.visible = isShape(obj)
  }
  dressControls(controls)
}

// La selección de varios elementos se crea sin pasar por `customizeControls` (la arma Fabric): sus tiradores se
// visten al crearse.
const baseCreateControls = ActiveSelection.createControls
ActiveSelection.createControls = function createCanvaControls() {
  const set = baseCreateControls.call(ActiveSelection)
  dressControls(set.controls as ControlSet)
  return set
}
