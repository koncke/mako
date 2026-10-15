import { Type } from 'lucide-react'
import { useEffect } from 'react'
import { useEditor } from '../context'
import { TEXT_PRESETS, createTextbox } from '../engine/objects/factories'
import { fontStack, primaryFamily } from '../engine/text/fontStack'
import type { PanelProps } from '../panels/registry'
import { t } from '../strings'
import { pageCentre } from './insertAt'
import { PAIRINGS, type Pairing, faceOptions } from './pairings'
import { useInsertDone } from './useInsertDone'
import styles from './Drawers.module.css'

const ARC_UP = <path d="M2 18 Q20 0 38 18" stroke="currentColor" strokeWidth="2" fill="none" />
const ARC_DOWN = <path d="M2 2 Q20 20 38 2" stroke="currentColor" strokeWidth="2" fill="none" />

/**
 * El panel «Texto» de Canva (relevamiento §3.2): el botón violeta «Agregar un cuadro de texto», los «Estilos de
 * texto predeterminados» (título, subtítulo, un poco de texto) y las combinaciones de fuentes. Abajo, lo que Doory
 * suma: texto curvo y listas.
 */
export function TextDrawer({ close }: PanelProps) {
  const editor = useEditor()
  const done = useInsertDone(close)

  // Las tarjetas muestran las fuentes que agregan.
  useEffect(() => {
    for (const spec of Object.values(TEXT_PRESETS)) void editor.fonts.load(primaryFamily(spec.font), spec.weight)
    for (const p of PAIRINGS) {
      void editor.fonts.load(p.heading.family, p.heading.weight)
      void editor.fonts.load(p.body.family, p.body.weight)
    }
  }, [editor])

  const add = (preset: 'heading' | 'subheading' | 'body'): void => {
    void editor.insert.text(preset)
    done()
  }
  const addPairing = async (pairing: Pairing): Promise<void> => {
    done()
    await Promise.all([editor.fonts.load(pairing.heading.family, pairing.heading.weight), editor.fonts.load(pairing.body.family, pairing.body.weight)])
    const page = editor.pageSizeOf(editor.state.activePageId)
    const at = pageCentre(editor)
    const heading = createTextbox(page, { x: at.x, y: at.y - page.height * 0.03 }, faceOptions(pairing.heading, 'heading', t.drawers.pairingHeading))
    const body = createTextbox(page, { x: at.x, y: at.y + page.height * 0.045 }, faceOptions(pairing.body, 'body', t.drawers.pairingBody))
    await editor.insert.add([heading, body], t.history.addTextPairing)
  }
  const list = (style: 'bullet' | 'number'): void => {
    void editor.insert.list(style)
    done()
  }
  const arc = (direction: 'up' | 'down'): void => {
    void editor.insert.curvedText(direction)
    done()
  }

  return (
    <>
      <button type="button" className={styles.cta} data-testid="text-add-box" onClick={() => add('body')}>
        <Type size={18} aria-hidden="true" />
        {t.drawers.addTextBox}
      </button>

      <p className={styles.sectionTitle}>{t.drawers.defaultStyles}</p>
      <div className={styles.textStyles}>
        <button type="button" className={styles.textStyle} data-testid="text-preset-heading" onClick={() => add('heading')}>
          <span className={styles.tsHeading} style={{ fontFamily: TEXT_PRESETS.heading.font }}>
            {t.drawers.addHeading}
          </span>
        </button>
        <button type="button" className={styles.textStyle} data-testid="text-preset-subheading" onClick={() => add('subheading')}>
          <span className={styles.tsSub} style={{ fontFamily: TEXT_PRESETS.subheading.font }}>
            {t.drawers.addSubheading}
          </span>
        </button>
        <button type="button" className={styles.textStyle} data-testid="text-preset-body" onClick={() => add('body')}>
          <span className={styles.tsBody} style={{ fontFamily: TEXT_PRESETS.body.font }}>
            {t.drawers.addBody}
          </span>
        </button>
      </div>

      <p className={styles.sectionTitle}>{t.drawers.pairings}</p>
      <div className={styles.pairings}>
        {PAIRINGS.map((p) => (
          <button key={p.id} type="button" className={styles.pairCard} aria-label={t.drawers.addPairing(p.name)} title={p.name} data-testid={`text-pairing-${p.id}`} onClick={() => void addPairing(p)}>
            <span className={styles.pairHead} style={{ fontFamily: fontStack(p.heading.family, p.heading.category), fontWeight: p.heading.weight, color: p.heading.color }}>
              {t.drawers.pairingHeading}
            </span>
            <span className={styles.pairBody} style={{ fontFamily: fontStack(p.body.family, p.body.category), fontWeight: p.body.weight }}>
              {t.drawers.pairingBody}
            </span>
          </button>
        ))}
      </div>

      <p className={styles.sectionTitle}>{t.drawers.curvedText}</p>
      <div className={styles.optionRow}>
        <button type="button" className={styles.option} data-testid="text-arc-up" onClick={() => arc('up')}>
          <svg width="40" height="20" viewBox="0 0 40 20" fill="none" aria-hidden="true">
            {ARC_UP}
          </svg>
          {t.drawers.arcUp}
        </button>
        <button type="button" className={styles.option} data-testid="text-arc-down" onClick={() => arc('down')}>
          <svg width="40" height="20" viewBox="0 0 40 20" fill="none" aria-hidden="true">
            {ARC_DOWN}
          </svg>
          {t.drawers.arcDown}
        </button>
      </div>

      <p className={styles.sectionTitle}>{t.drawers.lists}</p>
      <div className={styles.optionRow}>
        <button type="button" className={styles.option} data-testid="text-list-bullet" onClick={() => list('bullet')}>
          <span className={styles.listGlyph} aria-hidden="true">
            • — • — • —
          </span>
          {t.drawers.bulleted}
        </button>
        <button type="button" className={styles.option} data-testid="text-list-number" onClick={() => list('number')}>
          <span className={styles.listGlyph} aria-hidden="true">
            1. 2. 3.
          </span>
          {t.drawers.numbered}
        </button>
      </div>
    </>
  )
}
