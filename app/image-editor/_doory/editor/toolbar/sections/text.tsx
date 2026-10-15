import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ALargeSmall, ChevronDown, List, ListOrdered, Strikethrough } from 'lucide-react'
import { ColorTool } from '../../chrome/ColorTool'
import { I } from '../../chrome/icons'
import { isBold, textValue } from '../../builtins/textState'
import { useEditor, useSelection } from '../../context'
import { readFill } from '../../engine/objects/fills'
import { primaryFamily } from '../../engine/text/fontStack'
import { t } from '../../strings'
import { Popover } from '../../ui/Popover'
import { Tooltip } from '../../ui/Tooltip'
import { RangeField, Stepper } from '../controls'
import { EffectsPanel } from '../effects'
import { FontPicker } from '../FontPicker'
import { createFontPreview } from '../fontPreview'
import { FONT_SIZE, LETTER_SPACING, LINE_HEIGHT } from '../limits'
import { Divider, PopoverStack, PopoverTool, ToolButton } from '../parts'
import bar from '../parts.module.css'

/** La alineación avanza en este orden con cada clic, como el botón de Canva. */
const ALIGN = [
  { id: 'left', label: t.toolbar.alignLeft, icon: I.alignLeft },
  { id: 'center', label: t.toolbar.alignCenter, icon: I.alignCenter },
  { id: 'right', label: t.toolbar.alignRight, icon: I.alignRight },
  { id: 'justify', label: t.toolbar.justify, icon: I.alignJustify },
] as const

/** «Lista» avanza: sin lista → viñetas → numerada → sin lista. */
const LISTS = ['none', 'bullet', 'number'] as const

/** Si el catálogo tiene la cursiva de la familia (las fuentes desconocidas y las del sistema: se asume que sí). */
function useHasItalic(family: string): boolean {
  const editor = useEditor()
  const [known, setKnown] = useState<{ family: string; italic: boolean } | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!family) return
    void editor.fonts.lookup(family).then((f) => {
      if (!cancelled) setKnown({ family, italic: !f || f.variants.length === 0 || f.variants.some((v) => v.style === 'italic') })
    })
    return () => {
      cancelled = true
    }
  }, [editor, family])
  return known?.family === family ? known.italic : true
}

/** La caja de la fuente (el nombre escrito con su propia fuente) y su lista con buscador. */
function FontTool({ family, stack }: { family: string; stack: string }) {
  const editor = useEditor()
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const preview = useMemo(() => createFontPreview(editor), [editor])
  const close = useCallback(() => {
    preview.cancel()
    setOpen(false)
  }, [preview])
  return (
    <>
      <Tooltip label={t.toolbar.font} disabled={open}>
        <button ref={ref} type="button" className={bar.fontBtn} aria-label={`${t.toolbar.font}: ${family}`} aria-haspopup="dialog" aria-expanded={open} data-testid="ed-font" onClick={() => (open ? close() : setOpen(true))}>
          <span className={bar.fontName} style={{ fontFamily: stack }}>
            {family || t.tools.fontFallback}
          </span>
          <ChevronDown size={16} className={bar.caret} aria-hidden="true" />
        </button>
      </Tooltip>
      <Popover open={open} onClose={close} anchorRef={ref} label={t.toolbar.font} placement="bottom-start" variant="plain" cover>
        <FontPicker
          current={family}
          onPreview={preview.preview}
          onPick={(next) => {
            preview.commit()
            editor.style.text({ fontFamily: next }, t.history.changeFont)
            setOpen(false)
          }}
          onClose={close}
        />
      </Popover>
    </>
  )
}

/** Texto: fuente, tamaño, color «A», B I U S, aA, alineación, lista, espaciado y «Efectos», en el orden de Canva. */
export function TextSection() {
  const editor = useEditor()
  const sel = useSelection()
  const obj = sel.objects[0] ?? {}
  const stack = String(textValue(sel, 'fontFamily') ?? '')
  const family = primaryFamily(stack)
  const hasItalic = useHasItalic(family)
  const size = Math.round(Number(textValue(sel, 'fontSize') ?? 16))
  const fill = readFill(textValue(sel, 'fill'), '#1c1517')
  const weight = textValue(sel, 'fontWeight')
  const italic = textValue(sel, 'fontStyle') === 'italic'
  const strike = !!textValue(sel, 'linethrough')
  const align = (typeof obj.textAlign === 'string' ? obj.textAlign : 'left') as (typeof ALIGN)[number]['id']
  const alignIndex = Math.max(0, ALIGN.findIndex((a) => a.id === align))
  const nextAlign = ALIGN[(alignIndex + 1) % ALIGN.length]
  const textCase = typeof obj.textCase === 'string' ? obj.textCase : 'none'
  const list = (typeof obj.listStyle === 'string' ? obj.listStyle : 'none') as (typeof LISTS)[number]
  const nextList = LISTS[(Math.max(0, LISTS.indexOf(list)) + 1) % LISTS.length]
  const lineHeight = Number(obj.lineHeight ?? 1.16)
  const spacing = Math.round(Number(obj.charSpacing ?? 0))

  return (
    <>
      <FontTool family={family} stack={stack} />
      <Stepper label={t.ctx.sizeInput} value={size} limit={FONT_SIZE} testId="ed-font-size" onChange={(n, key) => editor.style.text({ fontSize: n }, t.history.changeFontSize, key === 'step' ? 'size-step' : 'font-size')} />
      <ColorTool variant="text" label={t.toolbar.textColor} value={fill} allowGradient testId="ed-text-color" onChange={(f, key) => editor.style.text({ fill: f }, t.history.changeTextColor, key ?? 'text-color')} />

      <ToolButton label={t.toolbar.bold} shortcut="Mod+B" pressed={isBold(weight)} testId="ed-bold" onClick={() => editor.style.text({ fontWeight: isBold(weight) ? 400 : 700 }, t.history.bold)}>
        {I.bold}
      </ToolButton>
      <ToolButton label={hasItalic ? t.toolbar.italic : t.ctx.noItalic(family)} shortcut="Mod+I" pressed={italic} disabled={!hasItalic} testId="ed-italic" onClick={() => editor.style.text({ fontStyle: italic ? 'normal' : 'italic' }, t.history.italic)}>
        {I.italic}
      </ToolButton>
      <ToolButton label={t.toolbar.underline} shortcut="Mod+U" pressed={!!textValue(sel, 'underline')} testId="ed-underline" onClick={() => editor.style.text({ underline: !textValue(sel, 'underline') }, t.history.underline)}>
        {I.underline}
      </ToolButton>
      <ToolButton label={t.toolbar.strike} pressed={strike} testId="ed-strike" onClick={() => editor.style.text({ linethrough: !strike }, t.history.strikethrough)}>
        <Strikethrough size={18} aria-hidden="true" />
      </ToolButton>
      <ToolButton label={t.toolbar.caseUpper} pressed={textCase === 'upper'} testId="ed-case" onClick={() => editor.style.text({ textCase: textCase === 'upper' ? 'none' : 'upper' }, t.history.changeCase)}>
        <ALargeSmall size={18} aria-hidden="true" />
      </ToolButton>

      <ToolButton label={`${t.toolbar.textAlign}: ${ALIGN[alignIndex].label}`} testId="ed-text-align" onClick={() => editor.style.text({ textAlign: nextAlign.id }, t.history.alignText)}>
        {ALIGN[alignIndex].icon}
      </ToolButton>
      <ToolButton
        label={list === 'number' ? t.toolbar.numbers : list === 'bullet' ? t.toolbar.bullets : t.toolbar.list}
        pressed={list !== 'none'}
        testId="ed-list"
        onClick={() => editor.style.text({ listStyle: nextList }, t.history.changeList)}
      >
        {list === 'number' ? <ListOrdered size={18} aria-hidden="true" /> : <List size={18} aria-hidden="true" />}
      </ToolButton>
      <PopoverTool label={t.toolbar.spacing} trigger={I.spacing} width={288} testId="ed-spacing">
        <PopoverStack width={256}>
          <RangeField label={t.toolbar.letterSpacing} value={spacing} limit={LETTER_SPACING} onChange={(v) => editor.style.text({ charSpacing: v }, t.history.changeLetterSpacing, 'char-spacing')} />
          <RangeField label={t.toolbar.lineHeight} value={lineHeight} limit={LINE_HEIGHT} onChange={(v) => editor.style.text({ lineHeight: v }, t.history.changeLineHeight, 'line-height')} />
        </PopoverStack>
      </PopoverTool>

      <Divider />
      <PopoverTool label={t.toolbar.effects} text={t.toolbar.effects} width={296} testId="ed-effects">
        <EffectsPanel text />
      </PopoverTool>
    </>
  )
}
