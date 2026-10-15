/**
 * Text styling that understands per-character styles: while editing with a selection range the
 * character-level props apply to the range; otherwise they apply to the whole object (clearing any
 * stale per-character overrides of the same props, so the change is visible everywhere).
 */
import type { IText, TextStyleDeclaration } from 'fabric'
import type { ListStyle, TextCase } from '@/app/image-editor/_doory/types/document'
import { CHAR_SPACING_RANGE, FONT_SIZE_RANGE, LINE_HEIGHT_RANGE, clampOrUndefined, isFiniteNumber } from '../numbers'
import { applyCase, toggleCase } from '../text/case'
import { applyListStyle, detectListStyle } from '../text/lists'
import { asDory } from './dory'
import { applyCurve, refitCurve } from './curvedText'
import { type FillSpec, buildFill } from './fills'

export interface TextPatch {
  fontFamily?: string
  fontSize?: number
  fontWeight?: number | string
  fontStyle?: 'normal' | 'italic'
  underline?: boolean
  linethrough?: boolean
  fill?: FillSpec
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  lineHeight?: number
  charSpacing?: number
  textCase?: TextCase
  listStyle?: ListStyle
  curveAmount?: number
}

/**
 * Drops what cannot be applied (NaN, Infinity, an unknown weight) and limits the numbers to the engine's range, so a
 * text patch from any caller is safe: the toolbar's tighter limits (size 8-200, line height 0.5-3) are the UI's own rules.
 */
export function sanitizeTextPatch(patch: TextPatch): TextPatch {
  const out: TextPatch = { ...patch }
  const size = clampOrUndefined(patch.fontSize, FONT_SIZE_RANGE[0], FONT_SIZE_RANGE[1])
  const lineHeight = clampOrUndefined(patch.lineHeight, LINE_HEIGHT_RANGE[0], LINE_HEIGHT_RANGE[1])
  const spacing = clampOrUndefined(patch.charSpacing, CHAR_SPACING_RANGE[0], CHAR_SPACING_RANGE[1])
  if (size === undefined) delete out.fontSize
  else out.fontSize = size
  if (lineHeight === undefined) delete out.lineHeight
  else out.lineHeight = lineHeight
  if (spacing === undefined) delete out.charSpacing
  else out.charSpacing = spacing
  if (!isFiniteNumber(patch.curveAmount)) delete out.curveAmount
  const w = patch.fontWeight
  if (typeof w === 'number') {
    if (isFiniteNumber(w)) out.fontWeight = Math.min(900, Math.max(100, Math.round(w / 100) * 100))
    else delete out.fontWeight
  } else if (w !== undefined && !/^(normal|bold|[1-9]00)$/.test(w)) delete out.fontWeight
  if (typeof patch.fontFamily === 'string' && patch.fontFamily.trim() === '') delete out.fontFamily
  return out
}

const CHAR_LEVEL = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'fill'] as const
type CharKey = (typeof CHAR_LEVEL)[number]

/** A partial selection while editing. Selecting the whole text counts as styling the whole object. */
function hasRange(t: IText): boolean {
  return t.isEditing && t.selectionStart !== t.selectionEnd && !(t.selectionStart === 0 && t.selectionEnd >= t.text.length)
}

function clearStyleKeys(t: IText, keys: readonly string[]): void {
  const styles = t.styles
  for (const line of Object.keys(styles)) {
    const row = styles[Number(line)]
    for (const ch of Object.keys(row)) {
      const style = row[Number(ch)] as Record<string, unknown>
      for (const k of keys) delete style[k]
      if (Object.keys(style).length === 0) delete row[Number(ch)]
    }
    if (Object.keys(row).length === 0) delete styles[Number(line)]
  }
}

/** Applies `patch` to `t`. Returns true when the text content changed (case / list). */
export function applyTextPatch(t: IText, patch: TextPatch): boolean {
  let textChanged = false
  const charPatch: Partial<Record<CharKey, unknown>> = {}
  for (const key of CHAR_LEVEL) {
    if (key === 'fill') {
      if (patch.fill) charPatch.fill = buildFill(patch.fill)
    } else if (patch[key] !== undefined) {
      charPatch[key] = patch[key]
    }
  }

  if (Object.keys(charPatch).length > 0) {
    if (hasRange(t)) {
      t.setSelectionStyles(charPatch as TextStyleDeclaration, t.selectionStart, t.selectionEnd)
    } else {
      clearStyleKeys(t, Object.keys(charPatch))
      t.set(charPatch)
    }
  }

  if (patch.textAlign !== undefined) t.set('textAlign', patch.textAlign)
  if (patch.lineHeight !== undefined) t.set('lineHeight', patch.lineHeight)
  if (patch.charSpacing !== undefined) t.set('charSpacing', patch.charSpacing)

  const d = asDory(t)
  if (patch.textCase !== undefined) {
    const next = toggleCase({ text: t.text, textCase: d.textCase ?? 'none', caseSource: d.caseSource }, patch.textCase)
    if (next.text !== t.text) {
      t.set('text', next.text)
      textChanged = true
    }
    d.textCase = next.textCase === 'none' ? undefined : next.textCase
    d.caseSource = next.caseSource
  }
  if (patch.listStyle !== undefined) {
    const next = applyListStyle(t.text, patch.listStyle)
    if (next !== t.text) {
      t.set('text', next)
      textChanged = true
    }
    const style = detectListStyle(next)
    d.listStyle = style === 'none' ? undefined : style
  }

  if (patch.curveAmount !== undefined) applyCurve(t, patch.curveAmount)
  else if (asDory(t).curveAmount && (patch.fontSize !== undefined || patch.fontFamily !== undefined || patch.fontWeight !== undefined || patch.charSpacing !== undefined || textChanged)) {
    refitCurve(t)
  }

  t.initDimensions()
  t.setCoords()
  t.set('dirty', true)
  return textChanged
}

/** Re-applies the active case after the user edited the characters. */
export function reapplyCase(t: IText): void {
  const d = asDory(t)
  if (!d.textCase || d.textCase === 'none') return
  const next = applyCase(t.text, d.textCase)
  d.caseSource = t.text
  if (next !== t.text) t.set('text', next)
}

/** The effective character style at the caret/selection (for toolbar state). */
export function currentTextStyle(t: IText): Record<string, unknown> {
  const base: Record<string, unknown> = {
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight,
    fontStyle: t.fontStyle,
    underline: t.underline,
    linethrough: t.linethrough,
    fill: t.fill,
  }
  if (!t.isEditing) return base
  const start = t.selectionStart
  const end = t.selectionEnd
  const style = start === end ? t.getSelectionStyles(Math.max(0, start - 1), start, true)[0] : t.getSelectionStyles(start, start + 1, true)[0]
  return { ...base, ...(style as Record<string, unknown> | undefined) }
}
