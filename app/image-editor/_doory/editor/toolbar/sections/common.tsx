import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDownToLine,
  ArrowUpToLine,
  BringToFront,
  Check,
  LayoutGrid,
  Replace,
  SendToBack,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { I } from '../../chrome/icons'
import { useEditor, useEditorState, useSelection } from '../../context'
import type { EditorEngine } from '../../engine/editor'
import { pxToUnit, unitDecimals, unitToPx } from '../../engine/units'
import { t } from '../../strings'
import { NumberField } from '../../ui/NumberField'
import { Switch } from '../../ui/Switch'
import { Tooltip } from '../../ui/Tooltip'
import { EffectsPanel } from '../effects'
import { Accordion, AnimateTool, LimitedNumber, LockTool, OpacityTool, OverflowAction, OverflowTool, PositionTool, RotateItems } from '../controls'
import { onlyKind } from '../kinds'
import { POLYGON_SIDES, STAR_INNER_RATIO, STAR_POINTS } from '../limits'
import { Field, PopoverStack, PopoverTool, ToolButton } from '../parts'
import bar from '../parts.module.css'
import styles from './sections.module.css'

type AlignTo = Parameters<EditorEngine['arrange']['align']>[0]

/** Botón con ícono y rótulo de las grillas de «Organizar» y «Alinear». */
function GridButton({ icon, label, shortcut, disabled, onClick, testId }: { icon: ReactNode; label: string; shortcut?: string; disabled?: boolean; onClick: () => void; testId?: string }) {
  return (
    <Tooltip label={label} shortcut={shortcut} disabled={disabled}>
      <button type="button" className={styles.gridBtn} disabled={disabled} data-testid={testId} onClick={onClick}>
        {icon}
        <span>{label}</span>
      </button>
    </Tooltip>
  )
}

/** «Animar» y «Posición», después de lo propio de cada tipo (en varios elementos, sólo «Posición»). */
export function ObjectSection() {
  const sel = useSelection()
  return (
    <>
      {sel.ids.length === 1 ? <AnimateTool /> : null}
      <PositionTool />
    </>
  )
}

/** El final de la barra: «Transparencia», el candado y el `⋯` con Duplicar, Eliminar y lo menos usado. */
export function ActionsSection() {
  return (
    <>
      <OpacityTool />
      <LockTool />
      <OverflowTool>{(close) => <OverflowSections close={close} />}</OverflowTool>
    </>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className={styles.toggleRow}>
      <span>{label}</span>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  )
}

const CASES = [
  { id: 'sentence', label: t.ctx.caseSentenceOption },
  { id: 'lower', label: t.ctx.caseLowerOption },
  { id: 'upper', label: t.ctx.caseUpperOption },
  { id: 'title', label: t.ctx.caseTitleOption },
] as const

const RESTORE_CASE = { id: 'none', label: t.ctx.caseNormal } as const

/** Las secciones del `⋯ Más` que corresponden a la selección. */
export function OverflowSections({ close }: { close: () => void }) {
  const editor = useEditor()
  const sel = useSelection()
  const o = sel.objects[0] ?? {}
  const single = sel.ids.length === 1
  const text = onlyKind(sel.kinds, 'text')
  const image = onlyKind(sel.kinds, 'image') && single
  const shapeKind = single && onlyKind(sel.kinds, 'shape') && typeof o.shapeKind === 'string' ? o.shapeKind : ''
  const placeholderCapable = sel.kinds.every((k) => k === 'shape' || k === 'image')
  const isPlaceholder = o.isPlaceholder === true
  const textCase = typeof o.textCase === 'string' ? o.textCase : 'none'
  return (
    <>
      {image ? (
        <>
          <OverflowAction
            icon={<Replace size={16} aria-hidden="true" />}
            label={t.toolbar.replaceImage}
            testId="ed-replace-image"
            onClick={() => {
              close()
              void editor.insert.pickAndReplaceImage()
            }}
          />
          <div className={bar.menuSep} role="separator" />
        </>
      ) : null}
      {text ? (
        <Accordion title={t.ctx.caseTitle} testId="more-case">
          <div role="menu" aria-label={t.ctx.caseTitle}>
            {(textCase === 'none' ? CASES : [...CASES, RESTORE_CASE]).map((c) => (
              <button
                key={c.id}
                type="button"
                role="menuitemradio"
                aria-checked={textCase === c.id}
                className={bar.menuItem}
                data-testid={`ed-case-${c.id}`}
                onClick={() => editor.style.text({ textCase: c.id }, t.history.changeCase)}
              >
                <span className={bar.menuLabel}>{c.label}</span>
              </button>
            ))}
          </div>
        </Accordion>
      ) : null}
      {!text && (image || sel.kinds.every((k) => k === 'element' || k === 'shape' || k === 'group')) ? (
        <Accordion title={t.ctx.moreSectionEffects} testId="more-effects">
          <EffectsPanel text={false} />
        </Accordion>
      ) : null}
      {shapeKind === 'polygon' ? (
        <Accordion title={t.ctx.moreSectionShape} testId="more-sides">
          <LimitedNumber label={t.toolbar.sides} value={Number(o.sides ?? 6)} limit={POLYGON_SIDES} testId="ed-sides" onChange={(v) => editor.style.setPolygonSides(v)} />
        </Accordion>
      ) : null}
      {shapeKind === 'star' ? (
        <Accordion title={t.ctx.moreSectionShape} testId="more-star">
          <LimitedNumber label={t.toolbar.points} value={Number(o.starPoints ?? 5)} limit={STAR_POINTS} testId="ed-star-points" onChange={(v) => editor.style.setStarShape({ points: v })} />
          <LimitedNumber label={`${t.toolbar.innerRadius} (%)`} value={Math.round(Number(o.innerRatio ?? 0.45) * 100)} limit={STAR_INNER_RATIO} testId="ed-star-inner" onChange={(v) => editor.style.setStarShape({ innerRatio: v / 100 })} />
        </Accordion>
      ) : null}
      {image ? null : (
        <Accordion title={t.toolbar.rotate} testId="more-rotate">
          <div role="menu" aria-label={t.toolbar.rotate}>
            <RotateItems />
          </div>
        </Accordion>
      )}
      <Accordion title={t.ctx.moreSectionPosition} testId="more-position">
        <PositionPanel />
      </Accordion>
      <Accordion title={t.ctx.moreSectionArrange} testId="more-arrange">
        <ArrangePanel />
      </Accordion>
      <Accordion title={t.ctx.moreSectionLink} testId="more-link">
        <LinkPanel />
      </Accordion>
      {placeholderCapable ? (
        <Accordion title={t.ctx.placeholder} testId="more-placeholder">
          <ToggleRow label={isPlaceholder ? t.ctx.placeholderOff : t.ctx.placeholderOnTip} checked={isPlaceholder} onChange={(on) => editor.style.setPlaceholder(on)} />
        </Accordion>
      ) : null}
    </>
  )
}

/** Los seis botones de alinear, en el orden de Canva: Arriba · Izquierda / Medio · Centro / Abajo · Derecha. */
function AlignGrid({ at }: { at: 'page' | 'selection' }) {
  const editor = useEditor()
  const items: { id: AlignTo; label: string; icon: ReactNode }[] = [
    { id: 'top', label: t.context.alignTop, icon: <AlignStartHorizontal size={18} aria-hidden="true" /> },
    { id: 'left', label: t.context.alignLeft, icon: <AlignStartVertical size={18} aria-hidden="true" /> },
    { id: 'middle', label: t.context.alignMiddle, icon: <AlignCenterHorizontal size={18} aria-hidden="true" /> },
    { id: 'center', label: t.context.alignCenter, icon: <AlignCenterVertical size={18} aria-hidden="true" /> },
    { id: 'bottom', label: t.context.alignBottom, icon: <AlignEndHorizontal size={18} aria-hidden="true" /> },
    { id: 'right', label: t.context.alignRight, icon: <AlignEndVertical size={18} aria-hidden="true" /> },
  ]
  return (
    <div className={styles.grid2}>
      {items.map((a) => (
        <GridButton key={a.id} icon={a.icon} label={a.label} testId={`ed-align-to-${a.id}`} onClick={() => editor.arrange.align(a.id, at)} />
      ))}
    </div>
  )
}

export function AlignPanel({ selectionTarget }: { selectionTarget: boolean }) {
  const sel = useSelection()
  const [target, setTarget] = useState<'page' | 'selection'>(selectionTarget ? 'selection' : 'page')
  const many = sel.ids.length > 1
  const at = many ? target : 'page'
  return (
    <PopoverStack width={256}>
      {many ? (
        <div className={styles.segment} role="group" aria-label={t.toolbar.alignTitle}>
          <button type="button" className={styles.segmentBtn} aria-pressed={target === 'selection'} onClick={() => setTarget('selection')}>
            {t.toolbar.alignToSelection}
          </button>
          <button type="button" className={styles.segmentBtn} aria-pressed={target === 'page'} onClick={() => setTarget('page')}>
            {t.toolbar.alignToPage}
          </button>
        </div>
      ) : null}
      <AlignGrid at={at} />
    </PopoverStack>
  )
}

export function PositionPanel() {
  const editor = useEditor()
  const sel = useSelection()
  const unit = useEditorState((s) => s.doc.unit)
  const [lock, setLock] = useState(true)
  const b = sel.bounds
  const dec = unitDecimals(unit)
  const show = (px: number): number => Number(pxToUnit(px, unit).toFixed(dec))
  const px = (v: number): number => unitToPx(v, unit)
  if (!b) return null
  return (
    <PopoverStack width={256}>
      <div className={styles.posGrid}>
        <NumberField label={t.tools.widthShort} showLabel value={show(b.width)} decimals={dec} min={0.01} step={unit === 'px' ? 1 : 0.1} onChange={(v) => editor.arrange.setSize(px(v), undefined, lock)} suffix={unit} />
        <NumberField label={t.tools.heightShort} showLabel value={show(b.height)} decimals={dec} min={0.01} step={unit === 'px' ? 1 : 0.1} onChange={(v) => editor.arrange.setSize(undefined, px(v), lock)} suffix={unit} />
        <NumberField label={t.toolbar.x} showLabel value={show(b.x)} decimals={dec} step={unit === 'px' ? 1 : 0.1} onChange={(v) => editor.arrange.setPosition(px(v), undefined)} suffix={unit} />
        <NumberField label={t.toolbar.y} showLabel value={show(b.y)} decimals={dec} step={unit === 'px' ? 1 : 0.1} onChange={(v) => editor.arrange.setPosition(undefined, px(v))} suffix={unit} />
        <NumberField label={t.toolbar.angle} showLabel value={Math.round(b.angle)} min={0} max={360} step={1} suffix="°" disabled={sel.locked} onChange={(v) => editor.arrange.setAngle(v)} />
      </div>
      <Switch label={t.toolbar.lockAspect} checked={lock} onChange={setLock} />
    </PopoverStack>
  )
}

/** «Organizar» de Canva: el orden de las capas, voltear y alinear con la página. */
export function ArrangePanel() {
  const editor = useEditor()
  return (
    <PopoverStack width={256}>
      <div className={styles.grid2}>
        <GridButton icon={<BringToFront size={18} aria-hidden="true" />} label={t.toolbar.forward} shortcut="Mod+]" onClick={() => editor.arrange.zOrder('forward')} testId="ed-forward" />
        <GridButton icon={<SendToBack size={18} aria-hidden="true" />} label={t.toolbar.backward} shortcut="Mod+[" onClick={() => editor.arrange.zOrder('backward')} testId="ed-backward" />
        <GridButton icon={<ArrowUpToLine size={18} aria-hidden="true" />} label={t.toolbar.toFront} shortcut="Mod+Alt+]" onClick={() => editor.arrange.zOrder('front')} testId="ed-to-front" />
        <GridButton icon={<ArrowDownToLine size={18} aria-hidden="true" />} label={t.toolbar.toBack} shortcut="Mod+Alt+[" onClick={() => editor.arrange.zOrder('back')} testId="ed-to-back" />
        <GridButton icon={I.flipH} label={t.toolbar.flipH} onClick={() => editor.arrange.flip('horizontal')} />
        <GridButton icon={I.flipV} label={t.toolbar.flipV} onClick={() => editor.arrange.flip('vertical')} />
      </div>
      <Field label={t.context.alignPage}>
        <AlignGrid at="page" />
      </Field>
    </PopoverStack>
  )
}

export function LinkPanel({ onDone }: { onDone?: () => void } = {}) {
  const editor = useEditor()
  const sel = useSelection()
  const url = (sel.objects[0]?.link as { url?: string } | undefined)?.url ?? ''
  const [value, setValue] = useState(url)
  const valid = /^https?:\/\/\S+$/i.test(value)
  const apply = (): void => {
    editor.style.setLink(value)
    onDone?.()
  }
  return (
    <PopoverStack width={256}>
      <input
        className={bar.input}
        value={value}
        placeholder={t.tools.linkPlaceholder}
        aria-label={t.toolbar.link}
        inputMode="url"
        data-testid="ed-link-input"
        autoFocus={!!onDone}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid) apply()
        }}
      />
      <div className={styles.actionsRow}>
        {url ? (
          <button
            type="button"
            className={`${bar.button} ${bar.buttonGhost}`}
            onClick={() => {
              editor.style.setLink(null)
              setValue('')
              onDone?.()
            }}
          >
            {t.tools.linkRemove}
          </button>
        ) : null}
        <button type="button" className={`${bar.button} ${bar.buttonPrimary}`} disabled={!valid} onClick={apply}>
          <Check size={16} aria-hidden="true" />
          {t.tools.linkApply}
        </button>
      </div>
    </PopoverStack>
  )
}

/** Varios elementos: «Agrupar» y «Alinear» (con distribuir y ordenar el espaciado). */
export function MultiSection() {
  const editor = useEditor()
  const sel = useSelection()
  return (
    <>
      <ToolButton label={t.toolbar.group} text={t.toolbar.group} shortcut="Mod+G" testId="ed-group" onClick={() => editor.arrange.group()} />
      <PopoverTool label={t.toolbar.alignTitle} text={t.toolbar.alignTitle} testId="ed-multi-align">
        <AlignPanel selectionTarget />
        <div className={styles.grid2} style={{ marginTop: 12, width: 256 }}>
          <GridButton icon={<AlignHorizontalSpaceAround size={18} aria-hidden="true" />} label={t.toolbar.distributeH} disabled={sel.ids.length < 3} testId="ed-distribute-h" onClick={() => editor.arrange.distribute('horizontal')} />
          <GridButton icon={<AlignVerticalSpaceAround size={18} aria-hidden="true" />} label={t.toolbar.distributeV} disabled={sel.ids.length < 3} testId="ed-distribute-v" onClick={() => editor.arrange.distribute('vertical')} />
          <GridButton icon={<LayoutGrid size={18} aria-hidden="true" />} label={t.toolbar.tidy} disabled={sel.ids.length < 2} testId="ed-tidy" onClick={() => editor.arrange.tidy()} />
        </div>
      </PopoverTool>
    </>
  )
}

export function GroupSection() {
  const editor = useEditor()
  return <ToolButton label={t.toolbar.ungroup} text={t.toolbar.ungroup} shortcut="Mod+Shift+G" testId="ed-ungroup" onClick={() => editor.arrange.ungroup()} />
}
