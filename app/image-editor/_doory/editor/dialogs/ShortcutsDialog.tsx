import { useMemo, useState, useSyncExternalStore } from 'react'
import { commands } from '../commands'
import { useEditor } from '../context'
import { formatShortcut } from '../shortcuts'
import { t } from '../strings'
import { Dialog } from '../ui/Dialog'
import styles from './dialogs.module.css'

export function ShortcutsDialog() {
  const editor = useEditor()
  const all = useSyncExternalStore(commands.subscribe, commands.getSnapshot)
  const [filter, setFilter] = useState('')
  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const map = new Map<string, { label: string; shortcut: string }[]>()
    for (const c of all) {
      if (!c.shortcut) continue
      if (needle && !c.label.toLowerCase().includes(needle) && !formatShortcut(c.shortcut).toLowerCase().includes(needle)) continue
      const g = c.group ?? t.menuMisc.otherGroup
      map.set(g, [...(map.get(g) ?? []), { label: c.label, shortcut: c.shortcut }])
    }
    return [...map.entries()]
  }, [all, filter])
  return (
    <Dialog title={t.dialog.shortcutsTitle} onClose={() => editor.closeDialog()} width={640}>
      <input className={styles.filter} type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t.dialog.shortcutsFilter} aria-label={t.dialog.shortcutsFilter} data-autofocus />
      <div className={styles.shortcutGrid}>
        {groups.map(([group, items]) => (
          <section key={group} className={styles.shortcutGroup}>
            <h3>{group}</h3>
            <dl>
              {items.map((i) => (
                <div key={i.label + i.shortcut} className={styles.shortcutRow}>
                  <dt>{i.label}</dt>
                  <dd>
                    {i.shortcut.split('|').map((alt) => (
                      <kbd key={alt}>{formatShortcut(alt)}</kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        {groups.length === 0 ? <p className={styles.muted}>{t.panels.noResults}</p> : null}
      </div>
      <p className={styles.muted}>{t.menuMisc.shortcutsHint}</p>
    </Dialog>
  )
}
