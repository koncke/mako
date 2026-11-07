import { AlertTriangle, Cloud, CloudCheck, CloudOff, Loader2, Eye } from 'lucide-react'
import { useEditor, useEditorState } from './context'
import { t } from './strings'
import { Tooltip } from './ui/Tooltip'
import styles from './SaveStatus.module.css'
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

/**
 * El estado de guardado de Canva, en la barra de arriba: la nube con tilde cuando está todo guardado
 * (el texto va en el tooltip), «Guardando…» mientras guarda, y un aviso claro si hay conflicto o error.
 */
export function SaveStatus() {
  const editor = useEditor()
  const save = useEditorState((s) => s.save)
  const readOnly = useEditorState((s) => s.readOnly)
  if (readOnly) {
    return (
      <span className={`${styles.pill} ${styles.neutral}`} role="status">
        <Eye size={16} aria-hidden="true" />
        <span className={styles.text}>{t.save.readOnly}</span>
      </span>
    )
  }
  switch (save.status) {
    case 'saving':
      return (
        <span className={`${styles.pill} ${styles.neutral}`} role="status" data-testid="ed-save-status" data-state="saving">
          <Loader2 size={16} className={styles.spin} aria-hidden="true" />
          <span className={styles.text}>{t.save.saving}</span>
        </span>
      )
    case 'dirty':
      return (
        <Tooltip label={t.save.unsaved}>
          <span className={styles.cloud} role="status" aria-label={t.save.unsaved} data-testid="ed-save-status" data-state="dirty">
            <Cloud size={22} aria-hidden="true" />
          </span>
        </Tooltip>
      )
    case 'conflict':
      return (
        <span className={`${styles.pill} ${styles.warn}`} role="status" data-testid="ed-save-status" data-state="conflict">
          <AlertTriangle size={14} aria-hidden="true" />
          <span className={styles.text}>{t.save.conflict}</span>
        </span>
      )
    case 'error':
      return (
        <span className={`${styles.pill} ${styles.error}`} role="alert" title={save.message} data-testid="ed-save-status" data-state="error">
          <CloudOff size={14} aria-hidden="true" />
          <span className={styles.text}>{t.save.error}</span>
          <button type="button" className={styles.retry} onClick={() => void editor.persistence.saveNow()}>
            {t.save.retry}
          </button>
          <ReportarASoporte />
        </span>
      )
    default: {
      const label = save.status === 'local' ? t.save.local : t.save.saved
      return (
        <Tooltip label={label}>
          <span className={styles.cloud} role="status" aria-label={label} data-testid="ed-save-status" data-state={save.status}>
            <CloudCheck size={22} aria-hidden="true" />
          </span>
        </Tooltip>
      )
    }
  }
}
