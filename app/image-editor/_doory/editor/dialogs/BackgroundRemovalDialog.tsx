import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor } from '../context'
import { BackgroundRemovalError, type BgRemovalFailure, type BgRemovalPhase } from '../engine/bgRemoval'
import { t } from '../strings'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import styles from './dialogs.module.css'

type Status = { kind: 'running'; phase: BgRemovalPhase; percent: number } | { kind: 'error'; reason: BgRemovalFailure }

const FAILURE_MESSAGE: Record<BgRemovalFailure, string> = {
  unavailable: t.errors.bgRemoval,
  blocked: t.errors.bgRemovalBlocked,
  'no-subject': t.errors.bgRemovalNoSubject,
}

/** Runs AI background removal with a progress bar; degrades to a clear error when offline or blocked. */
export function BackgroundRemovalDialog() {
  const editor = useEditor()
  const [status, setStatus] = useState<Status>({ kind: 'running', phase: 'downloading', percent: 0 })
  const controller = useRef<AbortController | null>(null)

  const start = useCallback((): void => {
    const run = new AbortController()
    controller.current = run
    editor.style
      .removeBackground((phase, percent) => {
        if (!run.signal.aborted) setStatus({ kind: 'running', phase, percent })
      }, run.signal)
      .then((applied) => {
        if (run.signal.aborted) return
        editor.closeDialog()
        if (applied) editor.toast(t.errors.bgRemovalDone, 'success')
      })
      .catch((err: unknown) => {
        if (run.signal.aborted) return
        setStatus({ kind: 'error', reason: err instanceof BackgroundRemovalError ? err.reason : 'unavailable' })
      })
  }, [editor])

  // Start once; StrictMode's second effect run finds the first run still in flight.
  useEffect(() => {
    if (!controller.current) start()
  }, [start])

  const retry = (): void => {
    setStatus({ kind: 'running', phase: 'downloading', percent: 0 })
    start()
  }

  const close = (): void => {
    controller.current?.abort()
    editor.closeDialog()
  }

  return (
    <Dialog
      title={t.toolbar.removeBackground}
      onClose={close}
      width={440}
      footer={
        status.kind === 'error' ? (
          <>
            <Button onClick={close}>{t.dialog.close}</Button>
            {status.reason === 'no-subject' ? null : (
              <Button variant="primary" onClick={retry}>
                {t.panels.retry}
              </Button>
            )}
          </>
        ) : (
          <Button onClick={close}>{t.dialog.cancel}</Button>
        )
      }
    >
      {status.kind === 'running' ? (
        <div className={styles.stack}>
          <p role="status" className={styles.muted}>
            {status.phase === 'downloading' ? t.errors.bgRemovalDownloading : t.errors.bgRemovalProcessing}
          </p>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.percent} aria-label={t.toolbar.removeBackground} className={styles.progress}>
            <div style={{ width: `${Math.max(4, status.percent)}%` }} />
          </div>
        </div>
      ) : (
        <p role="alert" className={styles.error}>
          {FAILURE_MESSAGE[status.reason]}
        </p>
      )}
    </Dialog>
  )
}
