import { Check, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { useEditor } from '../../context'
import { t } from '../../strings'
import { Divider } from '../parts'
import bar from '../parts.module.css'
import styles from './sections.module.css'

const ASPECTS: { id: string; label: string; ratio: number | null }[] = [
  { id: 'free', label: t.toolbar.cropFree, ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
]

/** Reemplaza a la barra mientras se recorta una imagen: proporciones, «Restablecer», «Cancelar» y «Listo» (violeta). */
export function CropSection() {
  const editor = useEditor()
  const [aspect, setAspect] = useState('free')
  return (
    <>
      <div className={styles.row} role="group" aria-label={t.tools.aspectRatio}>
        {ASPECTS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`${bar.btn} ${bar.textBtn} ${aspect === a.id ? bar.on : ''}`}
            aria-pressed={aspect === a.id}
            data-testid={`ed-crop-${a.id}`}
            onClick={() => {
              setAspect(a.id)
              editor.crop.setAspect(a.ratio)
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <Divider />
      <button type="button" className={`${bar.btn} ${bar.textBtn}`} data-testid="ed-crop-reset" onClick={() => editor.crop.reset()}>
        <RotateCcw size={16} aria-hidden="true" />
        {t.toolbar.reset}
      </button>
      <button type="button" className={`${bar.btn} ${bar.textBtn}`} data-testid="ed-crop-cancel" onClick={() => editor.crop.cancel()}>
        <X size={16} aria-hidden="true" />
        {t.toolbar.cropCancel}
      </button>
      <button type="button" className={`${bar.btn} ${bar.primary}`} data-testid="ed-crop-apply" onClick={() => editor.crop.apply()}>
        <Check size={16} aria-hidden="true" />
        {t.toolbar.cropApply}
      </button>
    </>
  )
}
