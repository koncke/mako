import { AlertTriangle, Cloud, CloudCheck, CloudOff, Loader2, Eye } from 'lucide-react'
import { useCollabState, usePresenceState } from './collab/context'
import { useEditor, useEditorState } from './context'
import { t } from './strings'
import { Tooltip } from './ui/Tooltip'
import styles from './SaveStatus.module.css'

/** The pill while the design is edited live: who is here, or what is wrong with the connection. */
function LiveStatus() {
  const status = useCollabState((s) => s.status)
  const attempt = useCollabState((s) => s.attempt) ?? 0
  const canWrite = useCollabState((s) => s.canWrite)
  const others = usePresenceState((s) => new Set(s.peers.map((p) => p.userId)).size) ?? 0
  const text = t.collab.status
  const people = others + 1
  switch (status) {
    case 'live':
      return (
        <span className={`${styles.pill} ${styles.live}`} role="status" aria-label={text.live(people)} data-testid="collab-status" data-state="live">
          <span className={styles.liveDot} aria-hidden="true" />
          <span className={styles.text}>{text.live(people)}</span>
        </span>
      )
    case 'read-only':
      return (
        <span className={`${styles.pill} ${styles.neutral}`} role="status" aria-label={text.viewing(people)} data-testid="collab-status" data-state="read-only">
          <Eye size={14} aria-hidden="true" />
          <span className={styles.text}>{text.viewing(people)}</span>
        </span>
      )
    case 'offline':
      return attempt >= 3 || (typeof navigator !== 'undefined' && navigator.onLine === false) ? (
        <span className={`${styles.pill} ${styles.warn}`} role="status" data-testid="collab-status" data-state="offline">
          <CloudOff size={14} aria-hidden="true" />
          <span className={styles.text}>{text.offline}</span>
        </span>
      ) : (
        <span className={`${styles.pill} ${styles.neutral}`} role="status" data-testid="collab-status" data-state="reconnecting">
          <Loader2 size={14} className={styles.spin} aria-hidden="true" />
          <span className={styles.text}>{text.reconnecting}</span>
        </span>
      )
    case 'busy':
      return (
        <span className={`${styles.pill} ${styles.warn}`} role="status" data-testid="collab-status" data-state="busy">
          <Loader2 size={14} className={styles.spin} aria-hidden="true" />
          <span className={styles.text}>{text.busy}</span>
        </span>
      )
    case 'signed-out':
      return (
        <span className={`${styles.pill} ${styles.warn}`} role="status" data-testid="collab-status" data-state="signed-out">
          <AlertTriangle size={14} aria-hidden="true" />
          <span className={styles.text}>{text.signedOut}</span>
        </span>
      )
    case 'forbidden':
    case 'not-found':
    case 'too-large':
    case 'unavailable':
      return (
        <span className={`${styles.pill} ${styles.error}`} role="alert" data-testid="collab-status" data-state={status}>
          <AlertTriangle size={14} aria-hidden="true" />
          <span className={styles.text}>{status === 'forbidden' ? text.forbidden : status === 'not-found' ? text.notFound : status === 'too-large' ? text.tooLarge : text.unavailable}</span>
        </span>
      )
    default:
      return (
        <span className={`${styles.pill} ${styles.neutral}`} role="status" data-testid="collab-status" data-state="connecting">
          <Loader2 size={14} className={styles.spin} aria-hidden="true" />
          <span className={styles.text}>{canWrite ? text.reconnecting : text.connecting}</span>
        </span>
      )
  }
}

/**
 * El estado de guardado de Canva, sobre el degradado de la barra: la nube con tilde cuando está todo guardado
 * (el texto va en el tooltip), «Guardando…» mientras guarda, y un aviso claro si hay conflicto o error.
 * Mientras hay una sala en vivo muestra el estado de la conexión.
 */
export function SaveStatus() {
  const editor = useEditor()
  const save = useEditorState((s) => s.save)
  const readOnly = useEditorState((s) => s.readOnly)
  const live = useCollabState((s) => s.status !== 'fallback')
  if (live) return <LiveStatus />
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
