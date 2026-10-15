/**
 * "Baking" turns a transient scale into real geometry so shapes keep crisp corners and text resizes by
 * font size (like other design tools) instead of stretching glyphs.
 */
import { Ellipse, type FabricObject, IText, Rect, Triangle } from 'fabric'
import { DoryLine } from './DoryLine'
import { asDory } from './dory'

const EPS = 1e-6

export function isScaled(obj: FabricObject): boolean {
  return Math.abs(obj.scaleX - 1) > EPS || Math.abs(obj.scaleY - 1) > EPS
}

function scaleEffects(obj: FabricObject, k: number): void {
  const e = asDory(obj).effects
  if (!e) return
  const next = { ...e }
  if (e.shadow) next.shadow = { ...e.shadow, blur: e.shadow.blur * k, offsetX: e.shadow.offsetX * k, offsetY: e.shadow.offsetY * k }
  if (e.outline) next.outline = { ...e.outline, width: e.outline.width * k }
  if (e.glow) next.glow = { ...e.glow, blur: e.glow.blur * k }
  asDory(obj).effects = next
  if (e.outline) obj.set('strokeWidth', next.outline?.width ?? 0)
  if (e.shadow || e.glow) {
    const s = obj.shadow
    if (s && typeof s === 'object') {
      s.blur *= k
      s.offsetX *= k
      s.offsetY *= k
    }
  }
}

/**
 * Bakes the scale of `obj` into its geometry. Returns true if anything changed. Group, path, polygon and
 * image objects keep their scale (their content cannot be re-derived from dimensions).
 */
export function bakeScale(obj: FabricObject): boolean {
  if (!isScaled(obj)) return false
  const sx = Math.abs(obj.scaleX)
  const sy = Math.abs(obj.scaleY)
  const keepFlipX = obj.scaleX < 0
  const keepFlipY = obj.scaleY < 0

  if (obj instanceof IText) {
    if (asDory(obj).curveAmount) return false
    const k = sy
    obj.set({ fontSize: obj.fontSize * k, width: obj.width * sx, scaleX: 1, scaleY: 1 })
    if (obj.charSpacing && sx !== sy) obj.set('charSpacing', obj.charSpacing)
    scaleEffects(obj, k)
    obj.initDimensions()
    return true
  }
  if (obj instanceof Rect) {
    obj.set({ width: obj.width * sx, height: obj.height * sy, scaleX: keepFlipX ? -1 : 1, scaleY: keepFlipY ? -1 : 1 })
    return true
  }
  if (obj instanceof Ellipse) {
    obj.set({ rx: obj.rx * sx, ry: obj.ry * sy, scaleX: keepFlipX ? -1 : 1, scaleY: keepFlipY ? -1 : 1 })
    return true
  }
  if (obj instanceof Triangle) {
    obj.set({ width: obj.width * sx, height: obj.height * sy, scaleX: keepFlipX ? -1 : 1, scaleY: keepFlipY ? -1 : 1 })
    return true
  }
  if (obj instanceof DoryLine) {
    obj.set({ width: obj.width * sx, scaleX: 1, scaleY: 1 })
    return true
  }
  return false
}

/** Bakes `obj` and re-anchors it so its centre does not move. */
export function bakeInPlace(obj: FabricObject): boolean {
  const center = obj.getCenterPoint()
  const changed = bakeScale(obj)
  if (changed) {
    obj.setPositionByOrigin(center, 'center', 'center')
    obj.setCoords()
    obj.set('dirty', true)
  }
  return changed
}
