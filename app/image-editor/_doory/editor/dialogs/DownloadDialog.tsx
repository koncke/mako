import { Check, ChevronDown, Copy, FileImage, FileText, FileVideo, Film, ImagePlay, PenTool, Printer } from 'lucide-react'
import { type ReactNode, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { DocPage } from '@/app/image-editor/_doory/types/document'
import { useEditor, useEditorState } from '../context'
import { safeMultiplier } from '../engine/render'
import { DEFAULT_EXPORT_OPTIONS, type ExportFormat, type ExportOptions, type ExportStage, exportFormats, parsePageRange } from '../engine/export/registry'
import { type PageSelection, copyPageAsPng, downloadFiles, pickPages, runExport } from '../engine/export/exporter'
import { fitBox, getPageSize, sameSize } from '../engine/pageSizes'
import { useInView } from '../hooks/useInView'
import { t } from '../strings'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import { Dialog } from '../ui/Dialog'
import { Popover } from '../ui/Popover'
import { Slider } from '../ui/Slider'
import { usePageSnapshot } from '../workspace/useSnapshot'
import { ExportProblem } from './print/ExportProblem'
import { PrintSection } from './print/PrintSection'
import type { VideoFormat } from '../engine/export/video/options'
import { LazyVideoSection } from './VideoSectionLoader'
import { type ExportFailure, describeExportFailure, isCancellation } from './print/exportFailure'
import { type PrintSettings, describeSizes, loadPrintSettings, savePrintSettings } from './print/printOptions'
import printStyles from './print/print.module.css'
import styles from './dialogs.module.css'

/**
 * «Compartir → Descargar» de Canva (relevamiento §9.1): «Tipo de archivo» en un desplegable con un ícono por formato
 * y el sugerido arriba, «Tamaño ×», «Calidad» (JPG), «Fondo transparente», «Seleccionar páginas» y el botón violeta
 * ancho «Descargar». La exportación es la de Doory (`engine/export`): este diálogo sólo elige qué pedirle.
 */

/** Una fila del desplegable «Tipo de archivo». El PDF de Doory sale dos veces, como en Canva: estándar y para impresión. */
interface Choice {
  id: string
  format: ExportFormat
  label: string
  hint?: string
  icon: ReactNode
  /** PDF con la sección de impresión (sangrado y marcas de corte). */
  print: boolean
  rank: number
}

/** El formato que Canva sugiere para una imagen. */
const SUGGESTED = 'png'

type TypeKey = keyof typeof t.dialog.downloadTypes

const KNOWN: Readonly<Record<string, { type: TypeKey; icon: ReactNode; rank: number }>> = {
  png: { type: 'png', icon: <FileImage size={20} aria-hidden="true" />, rank: 0 },
  jpg: { type: 'jpg', icon: <FileImage size={20} aria-hidden="true" />, rank: 10 },
  'pdf-server': { type: 'pdfServer', icon: <Printer size={20} aria-hidden="true" />, rank: 22 },
  svg: { type: 'svg', icon: <PenTool size={20} aria-hidden="true" />, rank: 30 },
  mp4: { type: 'mp4', icon: <FileVideo size={20} aria-hidden="true" />, rank: 40 },
  gif: { type: 'gif', icon: <ImagePlay size={20} aria-hidden="true" />, rank: 41 },
  webm: { type: 'webm', icon: <Film size={20} aria-hidden="true" />, rank: 42 },
}

function buildChoices(formats: readonly ExportFormat[]): Choice[] {
  const out: Choice[] = []
  for (const f of formats) {
    if (f.id === 'pdf') {
      out.push({ id: 'pdf', format: f, ...t.dialog.downloadTypes.pdf, icon: <FileText size={20} aria-hidden="true" />, print: false, rank: 20 })
      if (f.controls.print) out.push({ id: 'pdf-print', format: f, ...t.dialog.downloadTypes.pdfPrint, icon: <Printer size={20} aria-hidden="true" />, print: true, rank: 21 })
      continue
    }
    const known = KNOWN[f.id]
    if (known) out.push({ id: f.id, format: f, ...t.dialog.downloadTypes[known.type], icon: known.icon, print: f.controls.print === true, rank: known.rank })
    else out.push({ id: f.id, format: f, label: f.label, hint: f.description, icon: <FileImage size={20} aria-hidden="true" />, print: f.controls.print === true, rank: 100 + (f.order ?? 100) })
  }
  return out.sort((a, b) => a.rank - b.rank)
}

/** `[1, 2, 3, 5]` → «1-3, 5». */
function rangeText(pages: readonly number[]): string {
  const parts: string[] = []
  let start = -1
  let prev = -1
  for (const n of pages) {
    if (start < 0) {
      start = n
    } else if (n !== prev + 1) {
      parts.push(start === prev ? String(start) : `${start}-${prev}`)
      start = n
    }
    prev = n
  }
  if (start >= 0) parts.push(start === prev ? String(start) : `${start}-${prev}`)
  return parts.join(', ')
}

/** Mueve el foco entre las opciones de una lista con las flechas (las opciones son botones). */
function onListKeys(e: React.KeyboardEvent<HTMLElement>): void {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-option]:not(:disabled)')]
  if (items.length === 0) return
  e.preventDefault()
  const at = items.indexOf(document.activeElement as HTMLElement)
  const to = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : e.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length
  items[to]?.focus()
}

export function DownloadDialog({ props }: { props?: Record<string, unknown> } = {}) {
  const editor = useEditor()
  const allFormats = useSyncExternalStore(exportFormats.subscribe, exportFormats.getSnapshot)
  const formats = allFormats.filter((f) => !f.available || f.available(editor))
  const choices = buildChoices(formats)
  const doc = useEditorState((s) => s.doc)
  // `openDialog('download', { format: 'mp4' })` starts on that format (the Download menu's "Video or GIF…").
  const [choiceId, setChoiceId] = useState(() => choices.find((c) => c.id === props?.format)?.id ?? (choices.find((c) => c.id === SUGGESTED) ?? choices[0])?.id ?? SUGGESTED)
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS)
  const [print, setPrint] = useState<PrintSettings>(() => loadPrintSettings(editor.designId))
  /** Las páginas elegidas (1, 2, 3…); `null` = todas. */
  const [picked, setPicked] = useState<number[] | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [stage, setStage] = useState<ExportStage | undefined>()
  const [failure, setFailure] = useState<{ id: number; value: ExportFailure } | null>(null)
  const abort = useRef<AbortController | null>(null)
  const failures = useRef(0)
  /** Video formats: where the section draws its buttons, and whether a video is being made or shown (the choices above are held still). */
  const [footerSlot, setFooterSlot] = useState<HTMLElement | null>(null)
  const [videoLocked, setVideoLocked] = useState(false)
  const typeRef = useRef<HTMLButtonElement>(null)
  const [typeOpen, setTypeOpen] = useState(false)
  /** Ancho del desplegable: el del botón que lo abre (se mide al abrir). */
  const [dropWidth, setDropWidth] = useState<number | undefined>()
  const pagesRef = useRef<HTMLButtonElement>(null)
  const [pagesOpen, setPagesOpen] = useState(false)

  const choice = choices.find((c) => c.id === choiceId) ?? choices[0]
  const format = choice?.format
  const total = doc.pages.length
  const rangeInvalid = picked !== null && picked.length === 0
  const busy = progress !== null

  /** A change of the print options: kept for the next visit to this design. */
  const changePrint = (next: PrintSettings): void => {
    setPrint(next)
    savePrintSettings(editor.designId, next)
  }

  const selected = useMemo<PageSelection>(() => (picked === null || picked.length === total ? { kind: 'all' } : { kind: 'pages', pages: picked }), [picked, total])
  const activePageId = useEditorState((s) => s.activePageId)
  // The pages that will be exported, in document order.
  const chosenPages = useMemo(() => (rangeInvalid ? [] : pickPages(doc, activePageId, selected)), [doc, activePageId, selected, rangeInvalid])
  const chosen = chosenPages.map(({ page }) => getPageSize(doc, page.id))
  const size = chosen[0] ?? editor.pageSizeOf(editor.state.activePageId)
  const mixed = chosen.some((s) => !sameSize(s, size))
  const clamped = format?.controls.scale && chosen.some((s) => safeMultiplier(s.width, s.height, options.scale) < options.scale - 1e-6)
  const video = format?.controls.video === true
  const zipped = chosen.length > 1 && format?.mime !== 'application/pdf' && !video
  // El PDF estándar es el mismo formato sin sangrado ni marcas: la sección de impresión sólo va con «para impresión».
  const printing = format?.controls.print === true && choice?.print === true
  const activeIndex = doc.pages.findIndex((p) => p.id === activePageId)

  const pagesSummary = picked === null || picked.length === total ? `${t.dialog.downloadAllPages} (${total})` : picked.length === 0 ? t.dialog.downloadNoPages : picked.length === 1 ? t.dialog.downloadPage(picked[0]) : t.dialog.downloadSomePages(rangeText(picked))

  const fail = (error: unknown): void => {
    failures.current += 1
    setFailure({ id: failures.current, value: describeExportFailure(error) })
  }

  const download = async (): Promise<void> => {
    if (!format || rangeInvalid) return
    setFailure(null)
    setProgress(0)
    setStage(undefined)
    const controller = new AbortController()
    abort.current = controller
    const effective: ExportOptions = printing ? { ...options, bleedMm: print.bleedMm, cropMarks: print.cropMarks } : { ...options, bleedMm: 0, cropMarks: false }
    try {
      const files = await runExport(editor, {
        formatId: format.id,
        pages: selected,
        options: effective,
        onProgress: (fraction, next) => {
          setProgress(fraction)
          setStage(next)
        },
        signal: controller.signal,
      })
      downloadFiles(files)
      editor.toast(t.dialog.downloadDone, 'success')
      editor.closeDialog()
    } catch (err) {
      if (isCancellation(err)) editor.toast(t.print.cancelled)
      else fail(err)
      setProgress(null)
    }
  }

  const copy = async (): Promise<void> => {
    setFailure(null)
    try {
      await copyPageAsPng(editor)
      editor.toast(t.dialog.downloadCopied, 'success')
    } catch (err) {
      fail(err)
    }
  }

  const close = (): void => {
    abort.current?.abort()
    editor.closeDialog()
  }

  const pick = (id: string): void => {
    setChoiceId(id)
    setTypeOpen(false)
    typeRef.current?.focus()
  }

  const option = (c: Choice): ReactNode => (
    <button key={c.id} type="button" role="option" aria-selected={c.id === choice?.id} data-option className={`${styles.option} ${c.id === choice?.id ? styles.optionOn : ''}`} onClick={() => pick(c.id)}>
      <span className={styles.optionIcon}>{c.icon}</span>
      <span className={styles.optionText}>
        <strong>{c.label}</strong>
        {c.hint ? <small>{c.hint}</small> : null}
      </span>
      {c.id === choice?.id ? <Check size={18} className={styles.optionCheck} aria-hidden="true" /> : null}
    </button>
  )
  const suggested = choices.find((c) => c.id === SUGGESTED)
  const others = choices.filter((c) => c.id !== SUGGESTED)

  return (
    <Dialog title={t.dialog.downloadTitle} onClose={close} width={480}>
      <div className={styles.stack}>
        <fieldset className={styles.fieldset} disabled={videoLocked} style={videoLocked ? { opacity: 0.6 } : undefined}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t.dialog.downloadFormat}</span>
            <button
              ref={typeRef}
              type="button"
              className={styles.picker}
              aria-haspopup="listbox"
              aria-expanded={typeOpen}
              aria-label={`${t.dialog.downloadFormat}: ${choice?.label ?? ''}`}
              data-testid="download-format"
              onClick={(e) => {
                setDropWidth(e.currentTarget.offsetWidth)
                setTypeOpen((o) => !o)
              }}
            >
              <span className={styles.pickerIcon}>{choice?.icon}</span>
              <span className={styles.pickerText}>{choice?.label}</span>
              {choice?.id === SUGGESTED ? <span className={styles.badge}>{t.dialog.downloadSuggested}</span> : null}
              <ChevronDown size={18} className={styles.pickerChevron} aria-hidden="true" />
            </button>
            <Popover open={typeOpen} onClose={() => setTypeOpen(false)} anchorRef={typeRef} label={t.dialog.downloadFormat} placement="bottom-start" width={dropWidth} variant="plain" overModal focusOnOpen>
              <div role="listbox" aria-label={t.dialog.downloadFormat} className={styles.options} onKeyDown={onListKeys}>
                {suggested ? (
                  <>
                    <p className={styles.optionsGroup}>{t.dialog.downloadSuggested}</p>
                    {option(suggested)}
                    <div className={styles.optionsSep} role="separator" />
                  </>
                ) : null}
                {others.map(option)}
              </div>
            </Popover>
          </div>

          {format?.controls.scale ? (
            <div className={styles.field}>
              <Slider label={t.dialog.downloadScale} value={options.scale} min={0.5} max={4} step={0.25} decimals={2} withInput onChange={(v) => setOptions((o) => ({ ...o, scale: v }))} />
              <small className={styles.muted} data-testid="download-size">
                {mixed ? t.dialog.downloadEachSize : `${Math.round(size.width * safeMultiplier(size.width, size.height, options.scale))} × ${Math.round(size.height * safeMultiplier(size.width, size.height, options.scale))} px`}
                {clamped ? ` · ${t.dialog.downloadClamped}` : ''}
              </small>
            </div>
          ) : null}
          {format?.controls.quality ? <Slider label={t.dialog.downloadQuality} value={Math.round(options.quality * 100)} min={30} max={100} withInput onChange={(v) => setOptions((o) => ({ ...o, quality: v / 100 }))} /> : null}
          {format?.controls.transparent ? <Checkbox label={t.dialog.downloadTransparent} checked={options.transparent} onChange={(v) => setOptions((o) => ({ ...o, transparent: v }))} /> : null}

          {total > 1 ? (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>{t.dialog.downloadPages}</span>
              <button ref={pagesRef} type="button" className={styles.picker} aria-haspopup="dialog" aria-expanded={pagesOpen} data-testid="download-pages" onClick={(e) => {
                  setDropWidth(e.currentTarget.offsetWidth)
                  setPagesOpen((o) => !o)
                }}
              >
                <span className={styles.pickerText}>{pagesSummary}</span>
                <ChevronDown size={18} className={styles.pickerChevron} aria-hidden="true" />
              </button>
              <Popover open={pagesOpen} onClose={() => setPagesOpen(false)} anchorRef={pagesRef} label={t.dialog.downloadPages} placement="bottom-start" width={dropWidth} overModal focusOnOpen>
                <PagesPicker
                  pages={doc.pages}
                  picked={picked}
                  activeIndex={activeIndex}
                  onChange={setPicked}
                  onDone={() => {
                    setPagesOpen(false)
                    pagesRef.current?.focus()
                  }}
                />
              </Popover>
              {rangeInvalid ? (
                <small className={styles.error} role="alert">
                  {t.dialog.downloadPickPages}
                </small>
              ) : null}
            </div>
          ) : null}
          {printing ? (
            <small className={printStyles.summary} data-testid="print-summary">
              {describeSizes(chosen, doc.unit)}
            </small>
          ) : null}
        </fieldset>

        {printing ? <PrintSection settings={print} onChange={changePrint} sizes={chosen} unit={doc.unit} server={format?.server === true} /> : null}

        {video && format ? <LazyVideoSection format={format.id as VideoFormat} pages={chosenPages} rangeInvalid={rangeInvalid} footer={footerSlot} onLockChange={setVideoLocked} /> : null}

        {zipped ? <small className={styles.muted}>{t.dialog.downloadZip}</small> : null}

        {busy ? (
          <div className={styles.field}>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress ?? 0) * 100)} aria-label={t.dialog.downloadWorking} className={styles.progress}>
              <div style={{ width: `${Math.max(4, (progress ?? 0) * 100)}%` }} />
            </div>
            {stage ? (
              <p className={printStyles.stage} role="status" data-testid="export-stage">
                {t.print.stage[stage]}
              </p>
            ) : null}
          </div>
        ) : null}
        {failure ? <ExportProblem key={failure.id} failure={failure.value} onRetry={() => void download()} /> : null}

        {video ? (
          <div ref={setFooterSlot} className={styles.videoActions} />
        ) : (
          <div className={styles.actions}>
            <Button variant="primary" className={styles.wide} onClick={() => void download()} disabled={busy || rangeInvalid || !format} data-testid="download-submit">
              {busy ? t.dialog.downloadWorking : t.dialog.downloadButton}
            </Button>
            {busy ? (
              <Button className={styles.wide} onClick={() => abort.current?.abort()}>
                {t.print.cancel}
              </Button>
            ) : (
              <Button variant="ghost" className={styles.wide} icon={<Copy size={16} aria-hidden="true" />} onClick={() => void copy()}>
                {t.dialog.downloadCopy}
              </Button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}

/**
 * «Seleccionar páginas» de Canva: «Todas las páginas» y una casilla por página con su miniatura, más un campo para
 * escribir un rango (lo que Doory ya permitía: «1-3, 5»).
 */
function PagesPicker({ pages, picked, activeIndex, onChange, onDone }: { pages: readonly DocPage[]; picked: number[] | null; activeIndex: number; onChange: (next: number[] | null) => void; onDone: () => void }) {
  const total = pages.length
  const [draft, setDraft] = useState<string | null>(null)
  const isOn = (n: number): boolean => picked === null || picked.includes(n)
  const count = picked === null ? total : picked.length
  const draftInvalid = draft !== null && draft.trim() !== '' && parsePageRange(draft, total) === null

  const toggle = (n: number, on: boolean): void => {
    const base = picked ?? pages.map((_, i) => i + 1)
    const next = on ? [...new Set([...base, n])].sort((a, b) => a - b) : base.filter((p) => p !== n)
    setDraft(null)
    onChange(next.length === total ? null : next)
  }

  const typeRange = (text: string): void => {
    setDraft(text)
    const parsed = parsePageRange(text, total)
    if (parsed) onChange(parsed.length === total ? null : parsed)
  }

  return (
    <div className={styles.pages}>
      <Checkbox
        label={`${t.dialog.downloadAllPages} (${total})`}
        checked={count === total}
        indeterminate={count > 0 && count < total}
        onChange={(on) => {
          setDraft(null)
          onChange(on ? null : [])
        }}
      />
      <div className={styles.pagesSep} />
      <ul className={styles.pageList}>
        {pages.map((page, i) => (
          <li key={page.id}>
            <PageRow page={page} n={i + 1} current={i === activeIndex} checked={isOn(i + 1)} onToggle={(on) => toggle(i + 1, on)} />
          </li>
        ))}
      </ul>
      <label className={styles.rangeField}>
        <span>{t.dialog.downloadRange}</span>
        <input
          className={styles.input}
          value={draft ?? (picked === null ? `1-${total}` : rangeText(picked))}
          placeholder={t.dialog.downloadRangeHint}
          aria-invalid={draftInvalid || undefined}
          onChange={(e) => typeRange(e.target.value)}
          onBlur={() => setDraft(null)}
        />
      </label>
      {draftInvalid ? (
        <small className={styles.error} role="alert">
          {t.dialog.downloadRangeInvalid}
        </small>
      ) : null}
      <Button variant="primary" className={styles.wide} onClick={onDone}>
        {t.dialog.downloadPagesDone}
      </Button>
    </div>
  )
}

/** Una página en «Seleccionar páginas»: casilla, miniatura (sólo cuando se ve) y nombre. */
function PageRow({ page, n, current, checked, onToggle }: { page: DocPage; n: number; current: boolean; checked: boolean; onToggle: (on: boolean) => void }) {
  const editor = useEditor()
  const size = editor.pageSizeOf(page.id)
  const [seenRef, seen] = useInView<HTMLSpanElement>()
  const url = usePageSnapshot(page, size, seen)
  const box = fitBox(size, 48, 36)
  const name = page.name?.trim()
  return (
    <Checkbox
      className={styles.pageRow}
      checked={checked}
      onChange={onToggle}
      label={
        <span className={styles.pageLabel}>
          <span ref={seenRef} className={styles.pageThumb}>
            <span style={{ width: box.width, height: box.height }}>{url ? <img src={url} alt="" draggable={false} /> : null}</span>
          </span>
          <span className={styles.pageName}>
            {name ? `${t.dialog.downloadPage(n)} - ${name}` : t.dialog.downloadPage(n)}
            {current ? <small>{t.dialog.downloadCurrentPage}</small> : null}
          </span>
        </span>
      }
    />
  )
}
