/**
 * The Audio tool (a docked sidebar): play the page or the whole design with its sound, add music, effects, uploads or a
 * voiceover from three tabs, and manage the tracks of the design below. A view-only design shows just the transport
 * and the tracks. The tab last used is kept while the editor stays open.
 */
import { useId, useRef, useState } from 'react'
import { useEditorState } from '../context'
import { t } from '../strings'
import { AudioLibraryTab } from './AudioLibraryTab'
import { AudioRecordTab } from './AudioRecordTab'
import { AudioTracks } from './AudioTracks'
import { AudioTransport } from './AudioTransport'
import { AudioUploadsTab } from './AudioUploadsTab'
import styles from './Audio.module.css'

type TabId = 'library' | 'uploads' | 'record'

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'library', label: t.audio.tabs.library },
  { id: 'uploads', label: t.audio.tabs.uploads },
  { id: 'record', label: t.audio.tabs.record },
]

/** The last tab used, kept for the page's lifetime so reopening the tool lands where the person left off. */
const memory: { tab: TabId } = { tab: 'library' }

function remember(id: TabId): void {
  memory.tab = id
}

export function AudioPanel() {
  const readOnly = useEditorState((s) => s.readOnly)
  const [tab, setTab] = useState<TabId>(memory.tab)
  const base = useId()
  const refs = useRef<Record<TabId, HTMLButtonElement | null>>({ library: null, uploads: null, record: null })

  const select = (id: TabId, focus: boolean): void => {
    remember(id)
    setTab(id)
    if (focus) refs.current[id]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent, index: number): void => {
    let next = index
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    select(TABS[next].id, true)
  }

  return (
    <div className={styles.panel} data-testid="audio-panel">
      <AudioTransport />
      {readOnly ? null : (
        <div className={styles.sources}>
          <div role="tablist" aria-label={t.audio.tabs.label} className={styles.tablist}>
            {TABS.map((item, index) => (
              <button
                key={item.id}
                ref={(node) => {
                  refs.current[item.id] = node
                }}
                type="button"
                role="tab"
                id={`${base}-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`${base}-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                className={styles.tabButton}
                data-testid={`audio-tab-${item.id}`}
                onClick={() => select(item.id, false)}
                onKeyDown={(e) => onKeyDown(e, index)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`${base}-panel-${tab}`} aria-labelledby={`${base}-tab-${tab}`} className={styles.tabPanel}>
            {tab === 'library' ? <AudioLibraryTab /> : tab === 'uploads' ? <AudioUploadsTab /> : <AudioRecordTab />}
          </div>
        </div>
      )}
      <AudioTracks readOnly={readOnly} />
    </div>
  )
}
