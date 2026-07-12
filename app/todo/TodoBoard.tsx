'use client';

// =============================================================================
// TodoBoard — tablero del cliente (/todo), tema claro, DB-backed
// =============================================================================
// Paridad con el PlanBoard del super-admin: COLUMNAS DE PRIORIDAD (Alta/Media/
// Baja/A futuro), fijas, a ancho completo; drag & drop nativo mueve de prioridad.
// El detalle de cada tarjeta vive en un MODAL con: nota, checklist y "Change
// history" (con actor usuario/IA). Eliminar con pop-up propio (ConfirmModal),
// nunca window.confirm(). Categorías (etiquetas con color) editables. Estado
// (Por hacer/En curso/Hecho) y avance % son metadatos de la tarjeta.
// Updates OPTIMISTAS: mutamos local y disparamos /api/todo; en demo no hay backend.
// =============================================================================

import { useRef, useState, useEffect, type CSSProperties, type ReactNode, type MouseEvent as RME } from 'react';
import type { Tarea, Categoria, EstadoTarea, Prioridad, HistEntry, ChecklistItem, Actor } from '@/lib/todo';
import { Dropdown } from '@/app/components/Dropdown';
import { ConfirmModal } from '@/app/_components/ConfirmModal';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const PRIOS: Prioridad[] = ['alta', 'media', 'baja', 'futuro'];
const PRIO_LABEL: Record<Prioridad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja', futuro: 'A futuro' };
const PRIO_COLOR: Record<Prioridad, string> = { alta: '#D0504A', media: '#C8870C', baja: '#1E9E57', futuro: '#98A0AC' };
const ESTADOS: EstadoTarea[] = ['por_hacer', 'en_curso', 'hecho'];
const EST_LABEL: Record<EstadoTarea, string> = { por_hacer: 'Por hacer', en_curso: 'En curso', hecho: 'Hecho' };
const EST_COLOR: Record<EstadoTarea, string> = { por_hacer: 'var(--faint)', en_curso: 'var(--warn)', hecho: 'var(--good)' };
const SWATCHES = ['#e5484d', '#f0a818', '#46a758', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#9b9ba2'];

const uid = () => 'x' + Math.random().toString(36).slice(2, 9);
const now = () => Date.now();
const logEntry = (hist: HistEntry[], text: string, actor: Actor = 'user'): HistEntry[] => [{ ts: now(), actor, text }, ...hist];

function relTime(ts: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - ts) / 1000));
  if (s < 45) return 'hace unos segundos';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

// Clase de urgencia del deadline: vencido → bad, ≤3 días → warn.
function dlColor(d: string | null): string {
  if (!d) return 'var(--dim)';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(`${d}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 'var(--dim)';
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'var(--bad)';
  if (diff <= 3) return 'var(--warn)';
  return 'var(--ink)';
}

async function api(body: Record<string, unknown>): Promise<{ ok: boolean; tarea?: Tarea; categoria?: Categoria; error?: string }> {
  return fetch('/api/todo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch((e) => ({ ok: false, error: String(e) }));
}

// ── íconos ──
function PencilIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>; }
function FunnelIcon({ color = 'currentColor' }: { color?: string }) { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>; }
function ActorIcon({ actor, size = 13 }: { actor: Actor; size?: number }) {
  if (actor === 'ia') return <span title="MaKo (IA)" style={{ fontSize: size, color: 'var(--accent)', lineHeight: 1 }}>✦</span>;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="usuario"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 12 0v1" /></svg>;
}
// Origen de la tarjeta: 'manual' = usuario; el resto (mako/retro/experimento) = MaKo.
function OrigenIcon({ origen, size = 13 }: { origen: Tarea['origen']; size?: number }) {
  return <span title={origen === 'manual' ? 'Creada por vos' : 'Creada por MaKo'}><ActorIcon actor={origen === 'manual' ? 'user' : 'ia'} size={size} /></span>;
}

export function TodoBoard({ tareas: tareasInit, categorias: catsInit, demo }: { tareas: Tarea[]; categorias: Categoria[]; demo: boolean }) {
  const [tareas, setTareas] = useState<Tarea[]>(tareasInit);
  const [cats, setCats] = useState<Categoria[]>(catsInit);

  const [busqueda, setBusqueda] = useState('');
  const [fCat, setFCat] = useState<Set<number>>(new Set());
  const [fEst, setFEst] = useState<Set<EstadoTarea>>(new Set());
  const [catPanel, setCatPanel] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [confirmState, setConfirmState] = useState<{ msg: string; onOk: () => void } | null>(null);

  const [dragId, setDragId] = useState<number | null>(null);
  const [overPrio, setOverPrio] = useState<Prioridad | null>(null);

  const tempId = useRef(-1);
  const findCat = (id: number) => cats.find((c) => c.id === id) ?? null;
  const ask = (msg: string, onOk: () => void) => setConfirmState({ msg, onOk });

  const patchLocal = (id: number, patch: Partial<Tarea>) =>
    setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  // ── Crear (por columna de prioridad) ──
  const crear = async (titulo: string, prioridad: Prioridad) => {
    const v = titulo.trim();
    if (!v) return;
    if (demo) {
      const id = tempId.current--;
      const nowIso = new Date().toISOString();
      setTareas((prev) => [
        { id, titulo: v, detalle: null, estado: 'por_hacer', prioridad, progreso: 0, deadline: null, categorias: [], checklist: [], historial: [{ ts: now(), actor: 'user', text: 'Creó la tarjeta' }], origen: 'manual', experimento_id: null, retro_id: null, orden: 0, hecho_at: null, created_at: nowIso, updated_at: nowIso },
        ...prev,
      ]);
      return;
    }
    const j = await api({ action: 'crear', tarea: { titulo: v, prioridad, estado: 'por_hacer' } });
    if (j.ok && j.tarea) setTareas((prev) => [j.tarea as Tarea, ...prev]);
  };

  // ── Editar (patch parcial; puede llevar checklist/historial) ──
  const editar = async (id: number, patch: { titulo?: string; detalle?: string | null; prioridad?: Prioridad; progreso?: number; deadline?: string | null; categorias?: number[]; checklist?: ChecklistItem[]; historial?: HistEntry[] }) => {
    patchLocal(id, patch);
    if (demo) return;
    const j = await api({ action: 'editar', id, patch });
    if (j.ok && j.tarea) patchLocal(id, j.tarea);
  };

  // ── Mover de prioridad (drag & drop entre columnas) ──
  const moverPrioridad = async (id: number, prioridad: Prioridad) => {
    const t = tareas.find((x) => x.id === id);
    if (!t || t.prioridad === prioridad) return;
    await editar(id, { prioridad, historial: logEntry(t.historial, `Movió a ${PRIO_LABEL[prioridad]}`) });
  };

  // ── Cambiar estado (Por hacer / En curso / Hecho) ──
  const moverEstado = async (id: number, estado: EstadoTarea) => {
    const t = tareas.find((x) => x.id === id);
    if (!t || t.estado === estado) return;
    const hist = logEntry(t.historial, `Marcó como ${EST_LABEL[estado]}`);
    const local: Partial<Tarea> = { estado, hecho_at: estado === 'hecho' ? new Date().toISOString() : null, historial: hist };
    if (estado === 'hecho') local.progreso = 100;
    patchLocal(id, local);
    if (demo) return;
    const j = await api({ action: 'mover', id, estado, historial: hist });
    if (j.ok && j.tarea) patchLocal(id, j.tarea);
  };

  // ── Borrar (con pop-up de confirmación propio) ──
  const borrar = (id: number) => {
    const t = tareas.find((x) => x.id === id);
    const label = t ? t.titulo.slice(0, 48) + (t.titulo.length > 48 ? '…' : '') : 'esta tarea';
    ask(`¿Eliminar "${label}"?`, async () => {
      setTareas((prev) => prev.filter((x) => x.id !== id));
      setOpenId(null);
      if (demo) return;
      await api({ action: 'borrar', id });
    });
  };

  // ── Categorías ──
  const crearCategoria = async (nombre: string, color: string) => {
    const n = nombre.trim();
    if (!n) return;
    if (demo) { const id = tempId.current--; setCats((prev) => [...prev, { id, nombre: n.slice(0, 40), color, created_at: new Date().toISOString() }]); return; }
    const j = await api({ action: 'categoria-crear', nombre: n, color });
    if (j.ok && j.categoria) setCats((prev) => [...prev, j.categoria as Categoria]);
  };
  const doBorrarCategoria = async (id: number) => {
    setCats((prev) => prev.filter((x) => x.id !== id));
    setTareas((prev) => prev.map((t) => (t.categorias.includes(id) ? { ...t, categorias: t.categorias.filter((x) => x !== id) } : t)));
    setFCat((prev) => { const c = new Set(prev); c.delete(id); return c; });
    if (demo) return;
    await api({ action: 'categoria-borrar', id });
  };
  const borrarCategoria = (id: number) => {
    const c = findCat(id);
    if (!c) { doBorrarCategoria(id); return; }
    ask(`¿Eliminar la categoría "${c.nombre}"? Las tareas con esta categoría quedarán sin categoría.`, () => doBorrarCategoria(id));
  };

  // ── Filtro + búsqueda ──
  const passes = (t: Tarea) => {
    const q = busqueda.trim().toLowerCase();
    if (q && !`${t.titulo} ${t.detalle ?? ''}`.toLowerCase().includes(q)) return false;
    if (fCat.size > 0 && !t.categorias.some((c) => fCat.has(c))) return false;
    if (fEst.size > 0 && !fEst.has(t.estado)) return false;
    return true;
  };
  const visibles = tareas.filter(passes); // React Compiler auto-memoiza

  const total = tareas.length;
  const avgGlobal = total ? Math.round(tareas.reduce((s, t) => s + t.progreso, 0) / total) : 0;
  const hechas = tareas.filter((t) => t.estado === 'hecho').length;
  const nFilters = fCat.size + fEst.size;
  const openTask = tareas.find((t) => t.id === openId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {demo && (
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--faint)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
          modo demo (local sin Supabase) · en producción se ven tus datos reales
        </div>
      )}

      {/* Progreso global */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 9 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>{avgGlobal}%</span>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>avance promedio</span>
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)' }}>{hechas} / {total} hechas</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ width: `${avgGlobal}%`, height: '100%', background: 'var(--primary)', borderRadius: 999, transition: 'width .35s cubic-bezier(.2,.7,.3,1)' }} />
        </div>
      </div>

      {/* Toolbar: Categorías (lápiz) · buscar · Filtrar (embudo + detalle azul) */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setCatPanel((v) => !v)} style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 7, background: catPanel ? 'var(--surface-2)' : 'var(--surface)' }}><PencilIcon />Categorías</button>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" aria-label="Buscar tareas"
          style={{ flex: 1, minWidth: 170, padding: '9px 13px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' }} />
        <FilterMenu cats={cats} fCat={fCat} setFCat={setFCat} fEst={fEst} setFEst={setFEst} n={nFilters} />
      </div>

      {catPanel && <CategoriasPanel cats={cats} onCrear={crearCategoria} onBorrar={borrarCategoria} />}

      {/* Tablero: 4 columnas de prioridad, ancho completo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, alignItems: 'start' }} className="todo-board">
        <style>{`@media (max-width: 900px){.todo-board{grid-template-columns:repeat(2,1fr)!important}}@media (max-width:560px){.todo-board{grid-template-columns:1fr!important}}`}</style>
        {PRIOS.map((p) => {
          const items = visibles.filter((t) => t.prioridad === p).sort((a, b) => (a.estado === 'hecho' ? 1 : 0) - (b.estado === 'hecho' ? 1 : 0) || a.orden - b.orden);
          const totalCol = tareas.filter((t) => t.prioridad === p).length;
          const isOver = overPrio === p && dragId != null;
          return (
            <section key={p}
              onDragOver={(e) => { e.preventDefault(); if (dragId != null && overPrio !== p) setOverPrio(p); }}
              onDrop={(e) => { e.preventDefault(); if (dragId != null) moverPrioridad(dragId, p); setOverPrio(null); setDragId(null); }}
              style={{ display: 'flex', flexDirection: 'column', background: isOver ? 'var(--primary-bg)' : 'var(--surface)', border: '1px solid ' + (isOver ? 'var(--primary-weak)' : 'var(--border)'), borderTop: `3px solid ${PRIO_COLOR[p]}`, borderRadius: 14, padding: 10, minHeight: 120, boxShadow: isOver ? '0 0 0 3px var(--primary-weak)' : 'none', transition: 'background .12s, box-shadow .12s' }}>
              <ColHeader p={p} count={totalCol} onAdd={crear} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {items.length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', padding: '14px 0' }}>—</div>
                  : items.map((t) => <CardTile key={t.id} t={t} cats={cats} onOpen={setOpenId} onDone={moverEstado} onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOverPrio(null); }} dragging={dragId === t.id} />)}
              </div>
            </section>
          );
        })}
      </div>

      {openTask && <TaskModal t={openTask} cats={cats} onEditar={editar} onEstado={moverEstado} onBorrar={borrar} onClose={() => setOpenId(null)} />}
      {confirmState && <ConfirmModal msg={confirmState.msg} onOk={() => { confirmState.onOk(); setConfirmState(null); }} onCancel={() => setConfirmState(null)} />}
    </div>
  );
}

// ── átomos ──
const ghostBtn: CSSProperties = { padding: '9px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 500, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS, whiteSpace: 'nowrap' };

function EstadoBadge({ e }: { e: EstadoTarea }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: EST_COLOR[e] }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: EST_COLOR[e] }} />{EST_LABEL[e]}</span>;
}
function MiniBar({ v }: { v: number }) {
  return <span style={{ display: 'block', height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: v + '%', background: 'var(--primary)' }} /></span>;
}

function ColHeader({ p, count, onAdd }: { p: Prioridad; count: number; onAdd: (titulo: string, p: Prioridad) => void }) {
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState('');
  return (
    <div style={{ flex: 'none', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 3px 8px' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: PRIO_COLOR[p], flex: 'none' }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--dim)' }}>{PRIO_LABEL[p]}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', background: 'var(--surface-2)', borderRadius: 999, padding: '1px 8px' }}>{count}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setAdding((a) => !a)} title="Nueva tarea" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dim)', fontSize: 18, lineHeight: 1, padding: '0 3px' }}>+</button>
      </div>
      {adding && <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { onAdd(v, p); setV(''); } if (e.key === 'Escape') setAdding(false); }} onBlur={() => setAdding(false)} placeholder="Nueva tarea… (Enter)" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, outline: 'none' }} />}
    </div>
  );
}

function CardTile({ t, cats, onOpen, onDone, onDragStart, onDragEnd, dragging }: { t: Tarea; cats: Categoria[]; onOpen: (id: number) => void; onDone: (id: number, e: EstadoTarea) => void; onDragStart: () => void; onDragEnd: () => void; dragging: boolean }) {
  const done = t.estado === 'hecho';
  const clDone = t.checklist.filter((c) => c.done).length;
  const asignadas = t.categorias.map((id) => cats.find((c) => c.id === id)).filter((c): c is Categoria => c != null);
  const dlCol = dlColor(t.deadline);
  return (
    <div draggable onDragStart={(e) => { onDragStart(); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={onDragEnd} onClick={() => onOpen(t.id)}
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 12px', cursor: 'grab', opacity: dragging ? 0.4 : done ? 0.62 : 1, transition: 'border-color .12s' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, flexWrap: 'wrap' }}>
        <EstadoBadge e={t.estado} />
        <OrigenIcon origen={t.origen} size={12} />
        <span style={{ flex: 1 }} />
        <button type="button" title={done ? 'Reabrir' : 'Marcar hecho'} onClick={(e) => { e.stopPropagation(); onDone(t.id, done ? 'por_hacer' : 'hecho'); }}
          style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', borderRadius: 6, cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1, border: `1.5px solid ${done ? 'var(--good)' : 'var(--border-strong)'}`, background: done ? 'var(--good)' : 'transparent', color: done ? '#fff' : 'var(--faint)' }}>✓</button>
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', marginBottom: 9, wordBreak: 'break-word' }}>{t.titulo}</div>
      {asignadas.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 9 }}>
          {asignadas.map((c) => (
            <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 6, border: `1px solid ${c.color}33`, background: `${c.color}14`, color: c.color }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />{c.nombre}
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {t.deadline && <span style={{ fontFamily: MONO, fontSize: 10, color: dlCol }}>◷ {t.deadline.slice(5)}</span>}
        {t.checklist.length > 0 && <span title="checklist" style={{ fontSize: 10.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>☑ {clDone}/{t.checklist.length}</span>}
        <span style={{ flex: 1 }}><MiniBar v={t.progreso} /></span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{t.progreso}%</span>
      </div>
    </div>
  );
}

// ── filtro (2 niveles: categoría / estado) ──
function FilterMenu({ cats, fCat, setFCat, fEst, setFEst, n }: { cats: Categoria[]; fCat: Set<number>; setFCat: (s: Set<number>) => void; fEst: Set<EstadoTarea>; setFEst: (s: Set<EstadoTarea>) => void; n: number }) {
  const [open, setOpen] = useState(false);
  const [grp, setGrp] = useState<'root' | 'cat' | 'est'>('root');
  const toggle = <T,>(set: Set<T>, val: T, apply: (s: Set<T>) => void) => { const c = new Set(set); if (c.has(val)) c.delete(val); else c.add(val); apply(c); };
  const clearAll = (e: RME) => { e.stopPropagation(); setFCat(new Set()); setFEst(new Set()); };
  const grpRow = (label: string, on: () => void) => <button type="button" onClick={on} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--ink)', textAlign: 'left', fontFamily: SANS }}>{label}<span style={{ marginLeft: 'auto', color: 'var(--faint)' }}>›</span></button>;
  return (
    <span style={{ position: 'relative' }}>
      <button type="button" onClick={() => { setOpen((o) => !o); setGrp('root'); }} style={{ position: 'relative', ...ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 7, background: open ? 'var(--surface-2)' : 'var(--surface)', color: n > 0 ? 'var(--primary)' : 'var(--dim)', borderColor: n > 0 ? 'var(--primary-weak)' : 'var(--border-strong)' }}>
        <FunnelIcon color="var(--primary)" />Filtrar
        {n > 0 && <span onClick={clearAll} title="Limpiar" style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{n}</span>}
      </button>
      {open && <>
        <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'absolute', top: 42, right: 0, zIndex: 41, width: 244, maxHeight: 420, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.16)', padding: 8 }}>
          {grp === 'root' && <>{grpRow('🏷  Categoría', () => setGrp('cat'))}{grpRow('◪  Estado', () => setGrp('est'))}</>}
          {grp !== 'root' && <button type="button" onClick={() => setGrp('root')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dim)', fontSize: 12, padding: '4px 8px 8px', fontFamily: SANS }}>‹ volver</button>}
          {grp === 'cat' && (cats.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--faint)', padding: '6px 9px' }}>Sin categorías</div> : cats.map((c) => <FRow key={c.id} on={fCat.has(c.id)} onClick={() => toggle(fCat, c.id, setFCat as (s: Set<number>) => void)} icon={<span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />}>{c.nombre}</FRow>))}
          {grp === 'est' && ESTADOS.map((e) => <FRow key={e} on={fEst.has(e)} onClick={() => toggle(fEst, e, setFEst as (s: Set<EstadoTarea>) => void)} icon={<span style={{ width: 8, height: 8, borderRadius: '50%', background: EST_COLOR[e] }} />}>{EST_LABEL[e]}</FRow>)}
        </div>
      </>}
    </span>
  );
}
function FRow({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return <button type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 9px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--ink)', textAlign: 'left', fontFamily: SANS }}>
    <span style={{ width: 14, height: 14, borderRadius: 4, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{on ? '✓' : ''}</span>
    {icon}<span style={{ flex: 1 }}>{children}</span>
  </button>;
}

// ── modal de detalle (checklist + change history) ──
function TaskModal({ t, cats, onEditar, onEstado, onBorrar, onClose }: {
  t: Tarea; cats: Categoria[];
  onEditar: (id: number, patch: { titulo?: string; detalle?: string | null; prioridad?: Prioridad; progreso?: number; deadline?: string | null; categorias?: number[]; checklist?: ChecklistItem[]; historial?: HistEntry[] }) => void;
  onEstado: (id: number, e: EstadoTarea) => void;
  onBorrar: (id: number) => void; onClose: () => void;
}) {
  const [newItem, setNewItem] = useState('');
  const [nowMs, setNowMs] = useState(0);
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setNowMs(now()); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rowLabel: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };
  const cl = t.checklist;
  const clDone = cl.filter((c) => c.done).length;
  const setCl = (next: ChecklistItem[], log?: string) => onEditar(t.id, { checklist: next, ...(log ? { historial: logEntry(t.historial, log) } : {}) });
  const asignadas = t.categorias.map((id) => cats.find((c) => c.id === id)).filter((c): c is Categoria => c != null);
  const disponibles = cats.filter((c) => !t.categorias.includes(c.id));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 16px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 800, maxHeight: '85vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
          <EstadoBadge e={t.estado} />
          <span title={t.origen === 'manual' ? 'Creada por vos' : 'Creada por MaKo'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--faint)' }}><OrigenIcon origen={t.origen} size={13} />{t.origen === 'manual' ? 'Vos' : 'MaKo'}</span>
          <span style={{ flex: 1 }} /><button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)', padding: '2px 6px' }}>×</button>
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 22px' }}>
            <textarea value={t.titulo} onChange={(e) => onEditar(t.id, { titulo: e.target.value })} rows={2} style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 22, fontWeight: 600, lineHeight: 1.3, fontFamily: SANS, letterSpacing: '-0.01em', marginBottom: 16 }} />
            <label style={rowLabel}>Nota · detalle</label>
            <textarea value={t.detalle ?? ''} onChange={(e) => onEditar(t.id, { detalle: e.target.value || null })} placeholder="Notas, contexto, lo que falta…" style={{ width: '100%', minHeight: 120, border: '1px solid var(--border)', borderRadius: 10, outline: 'none', resize: 'vertical', background: 'var(--surface-2)', color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.6, padding: '12px 14px', fontFamily: SANS, marginBottom: 20 }} />

            <label style={rowLabel}>Checklist {cl.length > 0 && `· ${clDone}/${cl.length}`}</label>
            {cl.length > 0 && <span style={{ display: 'block', marginBottom: 10 }}><MiniBar v={cl.length ? Math.round((clDone / cl.length) * 100) : 0} /></span>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {cl.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 2px' }}>
                  <button type="button" onClick={() => setCl(cl.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)), c.done ? undefined : `Completó "${c.text.slice(0, 30)}"`)} style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${c.done ? 'var(--good)' : 'var(--border-strong)'}`, background: c.done ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.done ? '✓' : ''}</button>
                  <input value={c.text} onChange={(e) => setCl(cl.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))} style={{ flex: 1, border: 'none', background: 'transparent', color: c.done ? 'var(--faint)' : 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS, textDecoration: c.done ? 'line-through' : 'none' }} />
                  <button type="button" onClick={() => setCl(cl.filter((x) => x.id !== c.id))} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
            <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newItem.trim()) { setCl([...cl, { id: uid(), text: newItem.trim(), done: false }], `Agregó "${newItem.trim().slice(0, 30)}" al checklist`); setNewItem(''); } }} placeholder="+ ítem de checklist (Enter)" style={{ width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--ink)', fontSize: 13, outline: 'none', marginBottom: 24 }} />

            <label style={rowLabel}>Change history</label>
            {t.historial.length === 0
              ? <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin actividad todavía. Los cambios (mover, checklist, estado…) van a aparecer acá.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {t.historial.map((h) => (
                    <div key={h.ts} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                      <span style={{ marginTop: 1, flex: 'none' }}><ActorIcon actor={h.actor} size={13} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}><strong style={{ fontWeight: 600 }}>{h.actor === 'ia' ? 'MaKo' : 'Vos'}</strong> · {h.text}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{relTime(h.ts, nowMs)}</div>
                      </div>
                    </div>
                  ))}
                </div>}
          </div>
          <div style={{ width: 236, flex: 'none', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: '20px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div><label style={rowLabel}>Estado</label><Dropdown value={t.estado} options={ESTADOS.map((e) => ({ value: e, label: EST_LABEL[e], color: EST_COLOR[e] }))} onChange={(v) => onEstado(t.id, v as EstadoTarea)} width={200} ariaLabel="Estado" /></div>
            <div><label style={rowLabel}>Prioridad</label><Dropdown value={t.prioridad} options={PRIOS.map((p) => ({ value: p, label: PRIO_LABEL[p], color: PRIO_COLOR[p] }))} onChange={(v) => onEditar(t.id, { prioridad: v as Prioridad, historial: logEntry(t.historial, `Movió a ${PRIO_LABEL[v as Prioridad]}`) })} width={200} ariaLabel="Prioridad" /></div>
            <div><label style={rowLabel}>Avance · {t.progreso}%</label><input type="range" min={0} max={100} step={5} value={t.progreso} onChange={(e) => onEditar(t.id, { progreso: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--primary)' }} /></div>
            <div><label style={rowLabel}>Deadline</label><input type="date" value={t.deadline ?? ''} onChange={(e) => onEditar(t.id, { deadline: e.target.value || null })} style={{ width: '100%', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: SANS }} /></div>
            <div>
              <label style={rowLabel}>Categorías</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: asignadas.length ? 8 : 0 }}>
                {asignadas.map((c) => (
                  <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 4px 3px 8px', borderRadius: 999, border: `1px solid ${c.color}59`, background: `${c.color}1f`, color: c.color }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color }} />{c.nombre}
                    <button type="button" onClick={() => onEditar(t.id, { categorias: t.categorias.filter((x) => x !== c.id) })} style={{ border: 'none', background: 'transparent', color: 'inherit', opacity: 0.6, fontSize: 13, lineHeight: 1, cursor: 'pointer', padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
              {disponibles.length > 0 && <Dropdown value="" options={disponibles.map((c) => ({ value: String(c.id), label: c.nombre, color: c.color }))} onChange={(v) => onEditar(t.id, { categorias: [...t.categorias, Number(v)] })} placeholder="＋ categoría" resetAfterSelect width={200} ariaLabel="Agregar categoría" buttonStyle={{ fontSize: 12 }} />}
            </div>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => onBorrar(t.id)} style={{ border: 'none', background: 'transparent', color: 'var(--bad)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}>Eliminar tarea</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel de categorías (etiquetas con color)
// ─────────────────────────────────────────────────────────────────────────────
function CategoriasPanel({ cats, onCrear, onBorrar }: { cats: Categoria[]; onCrear: (nombre: string, color: string) => void; onBorrar: (id: number) => void }) {
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const crear = () => { if (nombre.trim()) { onCrear(nombre, color); setNombre(''); } };
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
        {cats.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>Aún no hay categorías. Creá una abajo.</div>
        ) : cats.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 11px' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, flex: 'none' }} />
            <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)' }}>{c.nombre}</span>
            <button type="button" onClick={() => onBorrar(c.id)} aria-label={`Eliminar ${c.nombre}`}
              style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 16, lineHeight: 1, cursor: 'pointer', borderRadius: 7 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bad-bg)'; e.currentTarget.style.color = 'var(--bad)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--faint)'; }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); crear(); } }} placeholder="Nueva categoría…" maxLength={30} aria-label="Nombre de categoría"
          style={{ minWidth: 160, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SWATCHES.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`}
              style={{ width: 24, height: 24, borderRadius: 7, background: c, border: `2px solid ${color === c ? 'var(--ink)' : 'transparent'}`, cursor: 'pointer', padding: 0 }} />
          ))}
        </div>
        <button type="button" onClick={crear} disabled={!nombre.trim()}
          style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: nombre.trim() ? 'pointer' : 'not-allowed', opacity: nombre.trim() ? 1 : 0.5 }}>Crear</button>
      </div>
    </div>
  );
}
