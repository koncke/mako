'use client';

// =============================================================================
// ExperimentosApp — shell de 4 tabs de /experimentos
// =============================================================================
// Retro · Experiments · To-do · Conclusions. El shell tiene el estado de datos
// (se refresca tras cada mutación contra las APIs) y un toast simple. Cada tab
// es un componente propio; comparten los átomos de ./ui.
// =============================================================================

import { useCallback, useState, type ReactNode } from 'react';
import type { ExperimentosView } from '@/lib/experimentos';
import type { Retro } from '@/lib/retro';
import type { Tarea } from '@/lib/todo';
import { MONO, SANS } from './ui';
import { RetroTab } from './RetroTab';
import { ExperimentsTab } from './ExperimentsTab';
import { TodoTab } from './TodoTab';
import { ConclusionsTab } from './ConclusionsTab';

type TabKey = 'retro' | 'experiments' | 'todo' | 'conclusions';

export type Toast = (msg: string, tone?: 'ok' | 'bad') => void;

export function ExperimentosApp({
  exp, retros: retros0, tareas: tareas0, errorMsg, demo,
}: {
  exp: ExperimentosView; retros: Retro[]; tareas: Tarea[]; errorMsg: string | null; demo: boolean;
}) {
  const [tab, setTab] = useState<TabKey>('retro');
  const [expView, setExpView] = useState<ExperimentosView>(exp);
  const [retros, setRetros] = useState<Retro[]>(retros0);
  const [tareas, setTareas] = useState<Tarea[]>(tareas0);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'bad' } | null>(null);

  const notify: Toast = useCallback((msg, tone = 'ok') => {
    setToast({ msg, tone });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refreshExp = useCallback(async () => {
    try { const j = await fetch('/api/experimentos').then((r) => r.json()); if (j.ok) setExpView(j.view); } catch { /* local sin DB */ }
  }, []);
  const refreshTareas = useCallback(async () => {
    try { const j = await fetch('/api/todo').then((r) => r.json()); if (j.ok) setTareas(j.tareas); } catch { /* local sin DB */ }
  }, []);
  const refreshRetros = useCallback(async () => {
    try { const j = await fetch('/api/retro').then((r) => r.json()); if (j.ok) setRetros(j.retros); } catch { /* local sin DB */ }
  }, []);

  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: 'retro', label: 'Retro', count: retros.length || undefined },
    { key: 'experiments', label: 'Experiments', count: expView.counts.activos || undefined },
    { key: 'todo', label: 'To-do', count: tareas.filter((t) => t.estado !== 'hecho').length || undefined },
    { key: 'conclusions', label: 'Conclusions', count: expView.counts.cerrados || undefined },
  ];

  return (
    <div style={{ fontFamily: SANS }}>
      {demo && (
        <div style={{ marginBottom: 14, padding: '8px 14px', borderRadius: 10, background: 'var(--warn-bg)', border: '1px solid var(--warn)', color: 'var(--warn)', fontSize: 12.5, fontFamily: MONO }}>
          modo demo (local sin Supabase) · en producción se ven tus datos reales
        </div>
      )}
      {errorMsg && !demo && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'var(--bad-bg)', border: '1px solid var(--bad)', color: 'var(--bad)', fontSize: 13 }}>{errorMsg}</div>
      )}

      {/* Tab bar */}
      <nav style={{ display: 'flex', gap: 4, marginBottom: 26, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {tabs.map((t) => {
          const on = t.key === tab;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 16px', marginBottom: -1, background: 'transparent', border: 'none', borderBottom: `2px solid ${on ? 'var(--primary)' : 'transparent'}`, color: on ? 'var(--primary)' : 'var(--dim)', fontFamily: SANS, fontSize: 16.5, fontWeight: on ? 600 : 500, cursor: 'pointer', transition: 'color .15s' }}>
              {t.label}
              {t.count != null && (
                <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 600, fontFamily: MONO, background: on ? 'var(--primary-bg)' : 'var(--surface-2)', color: on ? 'var(--primary-strong)' : 'var(--faint)', border: `1px solid ${on ? 'var(--primary-weak)' : 'var(--border)'}` }}>{t.count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === 'retro' && (
        <RetroTab retros={retros} setRetros={setRetros} refreshRetros={refreshRetros}
          refreshExp={refreshExp} refreshTareas={refreshTareas} notify={notify} demo={demo}
          onGoExperiments={() => setTab('experiments')} onGoTodo={() => setTab('todo')} />
      )}
      {tab === 'experiments' && (
        <ExperimentsTab view={expView} refreshExp={refreshExp} notify={notify} demo={demo} />
      )}
      {tab === 'todo' && (
        <TodoTab tareas={tareas} setTareas={setTareas} refreshTareas={refreshTareas} notify={notify} demo={demo} />
      )}
      {tab === 'conclusions' && (
        <ConclusionsTab aprendizajes={expView.aprendizajes} />
      )}

      {toast && <ToastView msg={toast.msg} tone={toast.tone} />}
    </div>
  );
}

function ToastView({ msg, tone }: { msg: string; tone: 'ok' | 'bad' }): ReactNode {
  return (
    <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 90, padding: '12px 20px', borderRadius: 12, background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 14, fontWeight: 500, boxShadow: '0 14px 40px rgba(18,21,27,.35)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: tone === 'bad' ? '#FF9B7A' : '#7BE0A8', fontWeight: 700 }}>{tone === 'bad' ? '✕' : '✓'}</span>
      {msg}
    </div>
  );
}
