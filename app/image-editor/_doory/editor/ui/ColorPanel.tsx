import { Plus } from 'lucide-react'
import { type ReactNode, useMemo, useSyncExternalStore } from 'react'
import { useDocument, useEditorStateShallow } from '../context'
import { normalizeColor } from '../engine/colors'
import { documentColors } from '../engine/docOps'
import { type FillSpec, gradientCss } from '../engine/objects/fills'
import { t } from '../strings'
import { DEFAULT_COLORS, GRADIENT_PRESETS, palettes } from './swatches'
import styles from './ColorPanel.module.css'

interface ColorPanelProps {
  value: FillSpec
  onChange: (fill: FillSpec) => void
  /** Abre el selector «Agregar un color nuevo» (espectro, hexadecimal y cuentagotas). */
  onCustom: () => void
  /** Ofrece los degradados (rellenos de formas y texto); los bordes van sólo con color sólido. */
  allowGradient?: boolean
  /** Ofrece la baldosa «Sin relleno». */
  allowNone?: boolean
  /** Muestras extra, antes de las predeterminadas (los colores de un elemento, por ejemplo). */
  extraSwatches?: { label: string; colors: readonly string[] }
}

const isNone = (c: string): boolean => c === 'transparent' || c === ''

/**
 * El panel «Color» de Canva (relevamiento §9.4): «Colores del documento» con la baldosa arcoíris «Agregar un color
 * nuevo» primero, la paleta de la marca si hay, y «Colores predeterminados» (sólidos y degradados).
 */
export function ColorPanel({ value, onChange, onCustom, allowGradient, allowNone, extraSwatches }: ColorPanelProps) {
  const doc = useDocument()
  const recent = useEditorStateShallow((s) => s.recentColors)
  const design = useMemo(() => documentColors(doc, 30), [doc])
  const brand = useSyncExternalStore(palettes.subscribe, palettes.getSnapshot).find((p) => p.id === 'brand')
  const active = value.type === 'solid' && !isNone(value.color) ? normalizeColor(value.color).toLowerCase() : null
  // Canva junta en «Colores del documento» lo que hay en el diseño y lo último que se usó.
  const documentRow = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const c of [...design, ...recent]) {
      const key = c.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(c)
    }
    return out
  }, [design, recent])

  const solid = (color: string): void => onChange({ type: 'solid', color })
  const swatch = (color: string, key: string): ReactNode => (
    <button
      key={key}
      type="button"
      className={`${styles.swatch} ${active === color.toLowerCase() ? styles.on : ''}`}
      style={{ background: color }}
      title={color.toUpperCase()}
      aria-label={t.swatches.use(color.toUpperCase())}
      aria-pressed={active === color.toLowerCase()}
      onClick={() => solid(color)}
    />
  )

  const customGradient = (): void => {
    if (value.type === 'solid') {
      const base = isNone(value.color) ? '#8c52ff' : value.color
      onChange({ type: 'gradient', kind: 'linear', angle: 0, stops: [{ offset: 0, color: base }, { offset: 1, color: '#5ce1e6' }] })
    }
    onCustom()
  }

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <h3 className={styles.title}>{t.swatches.design}</h3>
        <div className={styles.grid}>
          <button type="button" className={`${styles.swatch} ${styles.rainbow}`} title={t.swatches.custom} aria-label={t.swatches.custom} onClick={onCustom}>
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>
          {documentRow.map((c) => swatch(c, `d-${c}`))}
        </div>
      </section>

      {brand ? (
        <section className={styles.section}>
          <h3 className={styles.title}>{brand.label}</h3>
          <div className={styles.grid}>{brand.colors.map((c, i) => swatch(c, `b-${i}-${c}`))}</div>
        </section>
      ) : null}

      {extraSwatches && extraSwatches.colors.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.title}>{extraSwatches.label}</h3>
          <div className={styles.grid}>{extraSwatches.colors.map((c, i) => swatch(c, `x-${i}-${c}`))}</div>
        </section>
      ) : null}

      <section className={styles.section}>
        <h3 className={styles.title}>{t.swatches.defaults}</h3>
        <p className={styles.subtitle}>{t.swatches.solid}</p>
        <div className={styles.grid}>
          {allowNone ? (
            <button
              type="button"
              className={`${styles.swatch} ${styles.none} ${value.type === 'solid' && isNone(value.color) ? styles.on : ''}`}
              title={t.swatches.noFill}
              aria-label={t.swatches.noFill}
              aria-pressed={value.type === 'solid' && isNone(value.color)}
              onClick={() => solid('transparent')}
            />
          ) : null}
          {DEFAULT_COLORS.map((c) => swatch(c, `f-${c}`))}
        </div>
        {allowGradient ? (
          <>
            <p className={styles.subtitle}>{t.swatches.gradients}</p>
            <div className={styles.grid}>
              {GRADIENT_PRESETS.map((g) => {
                const spec: FillSpec = { type: 'gradient', kind: 'linear', angle: g.angle, stops: g.stops }
                return <button key={g.id} type="button" className={styles.swatch} style={{ backgroundImage: gradientCss(spec) }} title={g.label} aria-label={t.swatches.gradient(g.label)} onClick={() => onChange(spec)} />
              })}
              <button type="button" className={`${styles.swatch} ${styles.add}`} title={t.swatches.customGradient} aria-label={t.swatches.customGradient} onClick={customGradient}>
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}
