'use client';

// =============================================================================
// TodoTab — tablero kanban (Por hacer · En curso · Hecho)
// =============================================================================
// Drag & drop entre columnas con actualización optimista (funciona en demo).

import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Tarea, EstadoTarea, Prioridad, OrigenTarea } from '@/lib/todo';
import type { Toast } from './ExperimentosApp';
import { MONO, SANS, Pill } from './ui';

const COLUMNAS: Array<{ key: EstadoTarea; label: string; hint: string }> = [
  { key: 'por_hacer', label: 'Por hacer', hint: 'el backlog' },
  { key: 'en_curso', label: 'En curso', hint: 'lo que estás haciendo' },
  { key: 'hecho', label: 'Hecho', hint: 'terminado' },
];

const ORIGEN_LABEL: Record<OrigenTarea, string> = { manual: 'manual', mako: 'MaKo', retro: 'de una Retro', experimento: 'de un experimento' };
const prioTone = (p: Prioridad) => (p === 'alta' ? 'bad' : p === 'baja' ? 'faint' : 'warn') as 'bad' | 'faint' | 'warn';

export function TodoTab({ tareas, setTareas, refreshTareas, notify, demo }: { tareas: Tarea[]; setTareas: Dispatch<SetStateAction<Tarea[]>>; refreshTareas: () => Promise<void>; notify: Toast; demo: boolean }) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<EstadoTarea | null>(null);
  const [nueva, setNueva] = useState('');

  const porCol = (c: EstadoTarea) => tareas.filter((t) => t.estado === c).sort((a, b) => a.orden - b.orden);

  const mover = async (id: number, estado: EstadoTarea) => {
    const t = tareas.find((x) => x.id === id);
    if (!t || t.estado === estado) return;
    // optimista
    setTareas((prev) => prev.map((x) => x.id === id ? { ...x, estado, hecho_at: estado === 'hecho' ? new Date().toISOString() : null } : x));
    try {
      const j = await fetch('/api/todo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mover', id, estado }) }).then((r) => r.json());
      if (!j.ok && !demo) { notify(j.error || 'No se pudo mover', 'bad'); refreshTareas(); }
    } catch { if (!demo) refreshTareas(); }
  };

  const borrar = async (id: number) => {
    setTareas((prev) => prev.filter((x) => x.id !== id));
    try { await fetch('/api/todo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'borrar', id }) }); }
    catch { if (!demo) refreshTareas(); }
  };

  const crear = async () => {
    const titulo = nueva.trim(); if (!titulo) return;
    setNueva('');
    const tmp: Tarea = { id: -Date.now(), titulo, detalle: null, estado: 'por_hacer', prioridad: 'media', origen: 'manual', experimento_id: null, retro_id: null, orden: -Date.now(), hecho_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setTareas((prev) => [tmp, ...prev]);
    try {
      const j = await fetch('/api/todo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'crear', tarea: { titulo } }) }).then((r) => r.json());
      if (j.ok && j.tarea) setTareas((prev) => [j.tarea, ...prev.filter((x) => x.id !== tmp.id)]);
      else if (!demo) refreshTareas();
    } catch { if (!demo) refreshTareas(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--dim)', maxWidth: 620, lineHeight: 1.55 }}>
        Las cosas <b>a ejecutar</b> — las que salen de tus Retros y experimentos, o las que cargás a mano. Arrastrá las tarjetas entre columnas.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))', gap: 16, alignItems: 'start', overflowX: 'auto' }}>
        {COLUMNAS.map((col) => {
          const items = porCol(col.key);
          const on = overCol === col.key;
          return (
            <div key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
              onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => { e.preventDefault(); setOverCol(null); if (dragId != null) mover(dragId, col.key); setDragId(null); }}
              style={{ background: on ? 'var(--primary-bg)' : 'var(--surface-2)', border: `1px solid ${on ? 'var(--primary-weak)' : 'var(--border)'}`, borderRadius: 16, padding: 12, transition: 'background .15s, border-color .15s', minHeight: 160 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: col.key === 'hecho' ? 'var(--good)' : 'var(--ink)' }}>{col.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{items.length}</span>
                </div>
              </div>

              {col.key === 'por_hacer' && (
                <div style={{ marginBottom: 10 }}>
                  <input value={nueva} onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') crear(); }}
                    placeholder="+ Nueva tarea…"
                    style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, outline: 'none' }} />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {items.map((t) => (
                  <TareaCard key={t.id} t={t} onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)} onBorrar={() => borrar(t.id)} dragging={dragId === t.id} />
                ))}
                {items.length === 0 && <div style={{ padding: '14px 6px', fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', textAlign: 'center' }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TareaCard({ t, onDragStart, onDragEnd, onBorrar, dragging }: { t: Tarea; onDragStart: () => void; onDragEnd: () => void; onBorrar: () => void; dragging: boolean }) {
  const [hover, setHover] = useState(false);
  const hecha = t.estado === 'hecho';
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 12px', cursor: 'grab', opacity: dragging ? 0.4 : 1, boxShadow: hover ? '0 4px 14px rgba(18,21,27,.08)' : 'none', transition: 'box-shadow .15s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4, textDecoration: hecha ? 'line-through' : 'none', opacity: hecha ? 0.65 : 1 }}>{t.titulo}</span>
        {hover && <button type="button" onClick={onBorrar} aria-label="Borrar" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>✕</button>}
      </div>
      {t.detalle && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--dim)', lineHeight: 1.45 }}>{t.detalle}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
        {!hecha && <Pill tone={prioTone(t.prioridad)} style={{ padding: '2px 8px', fontSize: 10.5 }}>{t.prioridad}</Pill>}
        {t.origen !== 'manual' && <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)' }}>{ORIGEN_LABEL[t.origen]}</span>}
      </div>
    </div>
  );
}
