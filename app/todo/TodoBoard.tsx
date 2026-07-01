'use client';

// =============================================================================
// TodoBoard — tablero kanban rico de /todo (tema claro, tokens de la app)
// =============================================================================
// Réplica de las funcionalidades del tablero de martinkoncke (avance, deadline
// con urgencia, categorías con color, notas inline, editar título inline, done,
// borrar, buscar, ordenar, filtrar, panel de categorías) pero en el tema CLARO
// de la app y con COLUMNAS DE ESTADO (Por hacer / En curso / Hecho) + drag & drop
// entre columnas. Estado local con updates OPTIMISTAS: mutamos el estado local ya
// y disparamos el fetch a /api/todo; en demo no refetcheamos (no hay backend).
// =============================================================================

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Tarea, Categoria, EstadoTarea, Prioridad } from '@/lib/todo';
import { Dropdown } from '@/app/components/Dropdown';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const COLUMNAS: Array<{ key: EstadoTarea; label: string }> = [
  { key: 'por_hacer', label: 'Por hacer' },
  { key: 'en_curso', label: 'En curso' },
  { key: 'hecho', label: 'Hecho' },
];

const PRIOS: Prioridad[] = ['alta', 'media', 'baja', 'futuro'];
const PRIO_LABEL: Record<Prioridad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja', futuro: 'A futuro' };
const PRIO_COLOR: Record<Prioridad, string> = { alta: 'var(--bad)', media: 'var(--warn)', baja: 'var(--good)', futuro: 'var(--faint)' };

const SWATCHES = ['#e5484d', '#f0a818', '#46a758', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#9b9ba2'];

type SortMode = 'recientes' | 'deadline' | 'progDesc' | 'progAsc' | 'az';

const SORT_OPTS = [
  { value: 'recientes', label: 'Recientes' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'progDesc', label: 'Avance ↓' },
  { value: 'progAsc', label: 'Avance ↑' },
  { value: 'az', label: 'A–Z' },
];

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

export function TodoBoard({ tareas: tareasInit, categorias: catsInit, demo }: { tareas: Tarea[]; categorias: Categoria[]; demo: boolean }) {
  const [tareas, setTareas] = useState<Tarea[]>(tareasInit);
  const [cats, setCats] = useState<Categoria[]>(catsInit);

  // Toolbar / vista
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevaPrio, setNuevaPrio] = useState<Prioridad>('media');
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<SortMode>('recientes');
  const [filtroCat, setFiltroCat] = useState<string>('all'); // 'all' | 'none' | id
  const [hideDone, setHideDone] = useState(false);
  const [catPanel, setCatPanel] = useState(false);

  // Drag & drop
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<EstadoTarea | null>(null);

  // Genera ids negativos decrecientes para tareas creadas en demo (sin backend).
  const tempId = useRef(-1);

  const findCat = (id: number) => cats.find((c) => c.id === id) ?? null;

  // ── mutación local optimista de una tarea ──
  const patchLocal = (id: number, patch: Partial<Tarea>) =>
    setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  // ── Crear tarea ──
  const crear = async () => {
    const titulo = nuevoTitulo.trim();
    if (!titulo) return;
    const prioridad = nuevaPrio;
    setNuevoTitulo('');

    if (demo) {
      const id = tempId.current--;
      const nowIso = new Date().toISOString();
      setTareas((prev) => [
        { id, titulo, detalle: null, estado: 'por_hacer', prioridad, progreso: 0, deadline: null, categorias: [], origen: 'manual', experimento_id: null, retro_id: null, orden: 0, hecho_at: null, created_at: nowIso, updated_at: nowIso },
        ...prev,
      ]);
      return;
    }
    const j = await api({ action: 'crear', tarea: { titulo, prioridad, estado: 'por_hacer' } });
    if (j.ok && j.tarea) setTareas((prev) => [j.tarea as Tarea, ...prev]);
  };

  // ── Editar (patch parcial) ──
  const editar = async (id: number, patch: { titulo?: string; detalle?: string | null; prioridad?: Prioridad; progreso?: number; deadline?: string | null; categorias?: number[] }) => {
    // optimista — el avance (progreso) es una MÉTRICA independiente del estado;
    // "hecho" es la columna, no el 100%. Editar nunca mueve de columna.
    patchLocal(id, { ...patch });
    if (demo) return;
    const j = await api({ action: 'editar', id, patch });
    if (j.ok && j.tarea) patchLocal(id, j.tarea);
  };

  // ── Mover de columna (drag & drop + botón hecho) ──
  const mover = async (id: number, estado: EstadoTarea) => {
    const cur = tareas.find((t) => t.id === id);
    if (!cur || cur.estado === estado) return;
    const local: Partial<Tarea> = { estado, hecho_at: estado === 'hecho' ? new Date().toISOString() : null };
    if (estado === 'hecho') local.progreso = 100; // completar rellena la barra
    patchLocal(id, local);
    if (demo) return;
    const j = await api({ action: 'mover', id, estado });
    if (j.ok && j.tarea) patchLocal(id, j.tarea);
  };

  // ── Borrar ──
  const borrar = async (id: number) => {
    const t = tareas.find((x) => x.id === id);
    const label = t ? t.titulo.slice(0, 48) + (t.titulo.length > 48 ? '…' : '') : 'esta tarea';
    if (!window.confirm(`¿Eliminar "${label}"?`)) return;
    setTareas((prev) => prev.filter((x) => x.id !== id));
    if (demo) return;
    await api({ action: 'borrar', id });
  };

  // ── Categorías ──
  const crearCategoria = async (nombre: string, color: string) => {
    const n = nombre.trim();
    if (!n) return;
    if (demo) {
      const id = tempId.current--;
      setCats((prev) => [...prev, { id, nombre: n.slice(0, 40), color, created_at: new Date().toISOString() }]);
      return;
    }
    const j = await api({ action: 'categoria-crear', nombre: n, color });
    if (j.ok && j.categoria) setCats((prev) => [...prev, j.categoria as Categoria]);
  };

  const borrarCategoria = async (id: number) => {
    const c = findCat(id);
    if (c && !window.confirm(`¿Eliminar la categoría "${c.nombre}"? Las tareas con esta categoría quedarán sin categoría.`)) return;
    setCats((prev) => prev.filter((x) => x.id !== id));
    setTareas((prev) => prev.map((t) => (t.categorias.includes(id) ? { ...t, categorias: t.categorias.filter((x) => x !== id) } : t)));
    if (filtroCat === String(id)) setFiltroCat('all');
    if (demo) return;
    await api({ action: 'categoria-borrar', id });
  };

  // ── Filtro + orden (aplicado antes de repartir por columna) ──
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let arr = tareas.filter((t) => {
      if (hideDone && t.estado === 'hecho') return false;
      if (filtroCat === 'none') { if (t.categorias.length) return false; }
      else if (filtroCat !== 'all') { if (!t.categorias.includes(Number(filtroCat))) return false; }
      if (q) { const hay = `${t.titulo} ${t.detalle ?? ''}`.toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });
    arr = arr.slice().sort((a, b) => {
      switch (orden) {
        case 'deadline': {
          const av = a.deadline || '9999-99-99', bv = b.deadline || '9999-99-99';
          return av === bv ? a.orden - b.orden : av < bv ? -1 : 1;
        }
        case 'progDesc': return b.progreso !== a.progreso ? b.progreso - a.progreso : a.orden - b.orden;
        case 'progAsc': return a.progreso !== b.progreso ? a.progreso - b.progreso : a.orden - b.orden;
        case 'az': { const r = a.titulo.localeCompare(b.titulo, 'es'); return r !== 0 ? r : a.orden - b.orden; }
        default: { // recientes: created_at desc
          const r = (b.created_at || '').localeCompare(a.created_at || '');
          return r !== 0 ? r : a.orden - b.orden;
        }
      }
    });
    return arr;
  }, [tareas, busqueda, hideDone, filtroCat, orden]);

  const porColumna = (estado: EstadoTarea) => visibles.filter((t) => t.estado === estado);
  const countTotal = (estado: EstadoTarea) => tareas.filter((t) => t.estado === estado).length;

  // ── Progreso global ──
  const total = tareas.length;
  const avgGlobal = total ? Math.round(tareas.reduce((s, t) => s + t.progreso, 0) / total) : 0;
  const hechas = tareas.filter((t) => t.estado === 'hecho').length;

  const catOptions = [
    { value: 'all', label: 'Todas las categorías' },
    ...cats.map((c) => ({ value: String(c.id), label: c.nombre, color: c.color })),
    { value: 'none', label: 'Sin categoría' },
  ];
  const anyFilter = busqueda.trim() !== '' || filtroCat !== 'all' || hideDone;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {demo && (
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--faint)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
          modo demo (local sin Supabase) · en producción se ven tus datos reales
        </div>
      )}

      {/* ── Barra de progreso global ── */}
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

      {/* ── Toolbar: crear ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={nuevoTitulo}
          onChange={(e) => setNuevoTitulo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); crear(); } }}
          placeholder="+ Nueva tarea…"
          maxLength={180}
          aria-label="Nueva tarea"
          style={{ flex: 1, minWidth: 220, padding: '11px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' }}
        />
        <Dropdown
          value={nuevaPrio}
          options={PRIOS.map((p) => ({ value: p, label: PRIO_LABEL[p], color: PRIO_COLOR[p] }))}
          onChange={(v) => setNuevaPrio(v as Prioridad)}
          width={130}
          ariaLabel="Prioridad de la nueva tarea"
        />
        <button type="button" onClick={crear} disabled={!nuevoTitulo.trim()}
          style={{ padding: '11px 18px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: nuevoTitulo.trim() ? 'pointer' : 'not-allowed', opacity: nuevoTitulo.trim() ? 1 : 0.5 }}>
          Agregar
        </button>
      </div>

      {/* ── Toolbar: buscar / ordenar / filtrar ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar…"
          aria-label="Buscar tareas"
          style={{ flex: 1, minWidth: 170, padding: '9px 13px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' }}
        />
        <Dropdown value={orden} options={SORT_OPTS} onChange={(v) => setOrden(v as SortMode)} width={150} ariaLabel="Ordenar" />
        <Dropdown value={filtroCat} options={catOptions} onChange={setFiltroCat} width={185} ariaLabel="Filtrar por categoría" />
        <button type="button" onClick={() => setHideDone((v) => !v)} style={toggleBtn(hideDone)}>
          {hideDone ? 'Mostrar completadas' : 'Ocultar completadas'}
        </button>
        <button type="button" onClick={() => setCatPanel((v) => !v)} style={toggleBtn(catPanel)}>Categorías</button>
      </div>

      {/* ── Panel de categorías ── */}
      {catPanel && (
        <CategoriasPanel cats={cats} onCrear={crearCategoria} onBorrar={borrarCategoria} />
      )}

      {/* ── Tablero ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, alignItems: 'start' }} className="todo-board">
        <style>{`@media (max-width: 900px){.todo-board{grid-template-columns:1fr!important}}`}</style>
        {COLUMNAS.map((col) => {
          const items = porColumna(col.key);
          const isOver = overCol === col.key;
          return (
            <section
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); if (overCol !== col.key) setOverCol(col.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol((c) => (c === col.key ? null : c)); }}
              onDrop={(e) => { e.preventDefault(); if (dragId != null) mover(dragId, col.key); setOverCol(null); setDragId(null); }}
              style={{
                background: isOver ? 'var(--primary-bg)' : 'var(--surface-2)',
                border: `1px solid ${isOver ? 'var(--primary-weak)' : 'var(--border)'}`,
                borderRadius: 14, padding: 12, minHeight: 120, transition: 'background .15s, border-color .15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>{col.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 9px' }}>{countTotal(col.key)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center', padding: '20px 8px', border: '1px dashed var(--border-strong)', borderRadius: 10 }}>
                    {anyFilter ? 'Sin coincidencias' : 'Sin tareas'}
                  </div>
                ) : (
                  items.map((t) => (
                    <TarjetaTarea
                      key={t.id}
                      t={t}
                      cats={cats}
                      onEditar={editar}
                      onMover={mover}
                      onBorrar={borrar}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      dragging={dragId === t.id}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel de categorías
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
        ) : (
          cats.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 11px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, flex: 'none' }} />
              <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)' }}>{c.nombre}</span>
              <button type="button" onClick={() => onBorrar(c.id)} aria-label={`Eliminar ${c.nombre}`}
                style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 16, lineHeight: 1, cursor: 'pointer', borderRadius: 7 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bad-bg)'; e.currentTarget.style.color = 'var(--bad)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--faint)'; }}>
                ✕
              </button>
            </div>
          ))
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); crear(); } }}
          placeholder="Nueva categoría…"
          maxLength={30}
          aria-label="Nombre de categoría"
          style={{ minWidth: 160, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SWATCHES.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`}
              style={{ width: 24, height: 24, borderRadius: 7, background: c, border: `2px solid ${color === c ? 'var(--ink)' : 'transparent'}`, cursor: 'pointer', padding: 0 }} />
          ))}
        </div>
        <button type="button" onClick={crear} disabled={!nombre.trim()}
          style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: nombre.trim() ? 'pointer' : 'not-allowed', opacity: nombre.trim() ? 1 : 0.5 }}>
          Crear
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta de tarea
// ─────────────────────────────────────────────────────────────────────────────
function TarjetaTarea({
  t, cats, onEditar, onMover, onBorrar, onDragStart, onDragEnd, dragging,
}: {
  t: Tarea;
  cats: Categoria[];
  onEditar: (id: number, patch: { titulo?: string; detalle?: string | null; prioridad?: Prioridad; progreso?: number; deadline?: string | null; categorias?: number[] }) => void;
  onMover: (id: number, estado: EstadoTarea) => void;
  onBorrar: (id: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  // "done" = la columna Hecho (estado), no el 100% del avance (que es una métrica).
  const done = t.estado === 'hecho';
  const [editTitulo, setEditTitulo] = useState(false);
  const [tituloDraft, setTituloDraft] = useState(t.titulo);
  const [editNota, setEditNota] = useState(false);
  const [notaDraft, setNotaDraft] = useState(t.detalle ?? '');
  const [hover, setHover] = useState(false);
  // Avance mostrado = el valor REAL (t.progreso), con un override transitorio solo
  // mientras se arrastra el slider. Así queda siempre en sync sin useEffect.
  const [dragProg, setDragProg] = useState<number | null>(null);
  const shown = dragProg ?? t.progreso;
  const commitProg = () => { if (dragProg != null && dragProg !== t.progreso) onEditar(t.id, { progreso: dragProg }); setDragProg(null); };

  const findCat = (id: number) => cats.find((c) => c.id === id) ?? null;
  const asignadas = t.categorias.map(findCat).filter((c): c is Categoria => c != null);
  const disponibles = cats.filter((c) => !t.categorias.includes(c.id));

  const guardarTitulo = () => {
    const v = tituloDraft.trim();
    setEditTitulo(false);
    if (v && v !== t.titulo) onEditar(t.id, { titulo: v });
    else setTituloDraft(t.titulo);
  };
  const guardarNota = () => {
    const v = notaDraft.trim();
    setEditNota(false);
    const cur = t.detalle ?? '';
    if (v !== cur) onEditar(t.id, { detalle: v || null });
  };

  const toggleDone = () => onMover(t.id, done ? 'por_hacer' : 'hecho');

  const dlCol = dlColor(t.deadline);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${PRIO_COLOR[t.prioridad]}`,
        borderRadius: 12,
        padding: '11px 12px',
        opacity: dragging ? 0.4 : done ? 0.62 : 1,
        boxShadow: hover ? '0 6px 18px rgba(18,21,27,.08)' : 'none',
        transition: 'box-shadow .18s, opacity .18s',
        cursor: 'grab',
      }}
    >
      {/* top: prioridad + acciones */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
        <Dropdown
          value={t.prioridad}
          options={PRIOS.map((p) => ({ value: p, label: PRIO_LABEL[p], color: PRIO_COLOR[p] }))}
          onChange={(v) => onEditar(t.id, { prioridad: v as Prioridad })}
          width={112}
          ariaLabel="Prioridad"
          buttonStyle={{ padding: '5px 9px', fontSize: 12, borderRadius: 8 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
          <button type="button" onClick={toggleDone} aria-pressed={done} aria-label={done ? 'Quitar 100%' : 'Marcar 100%'} title={done ? 'Quitar 100%' : 'Marcar hecho'}
            style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 8, cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1, border: `1.5px solid ${done ? 'var(--good)' : 'var(--border-strong)'}`, background: done ? 'var(--good)' : 'var(--surface)', color: done ? '#fff' : 'var(--faint)' }}>
            ✓
          </button>
          <button type="button" onClick={() => onBorrar(t.id)} aria-label="Eliminar" title="Eliminar"
            style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 8, cursor: 'pointer', padding: 0, fontSize: 15, lineHeight: 1, border: 'none', background: 'transparent', color: 'var(--faint)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bad-bg)'; e.currentTarget.style.color = 'var(--bad)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--faint)'; }}>
            ✕
          </button>
        </div>
      </div>

      {/* título (click para editar) */}
      {editTitulo ? (
        <textarea
          value={tituloDraft}
          autoFocus
          rows={2}
          onChange={(e) => setTituloDraft(e.target.value)}
          onBlur={guardarTitulo}
          onKeyDown={(e) => { if (e.key === 'Escape') { setTituloDraft(t.titulo); setEditTitulo(false); } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); guardarTitulo(); } }}
          style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--primary)', borderRadius: 8, color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, padding: '8px 9px', resize: 'vertical', lineHeight: 1.4, outline: 'none', marginBottom: 10 }}
        />
      ) : (
        <div
          onClick={() => { setTituloDraft(t.titulo); setEditTitulo(true); }}
          title="Clic para editar"
          style={{ fontSize: 13.5, lineHeight: 1.4, marginBottom: 10, color: done ? 'var(--dim)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none', wordBreak: 'break-word', overflowWrap: 'anywhere', cursor: 'text', borderRadius: 6 }}
        >
          {t.titulo}
        </div>
      )}

      {/* meta: deadline + categorías */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
        <input
          type="date"
          value={t.deadline ?? ''}
          onChange={(e) => onEditar(t.id, { deadline: e.target.value || null })}
          aria-label="Deadline"
          style={{ background: 'var(--surface-2)', border: `1px solid ${dlCol === 'var(--bad)' ? 'var(--bad)' : dlCol === 'var(--warn)' ? 'var(--warn)' : 'var(--border-strong)'}`, borderRadius: 8, color: t.deadline ? dlCol : 'var(--faint)', fontFamily: MONO, fontSize: 11, padding: '4px 8px', cursor: 'pointer', outline: 'none' }}
        />
        {asignadas.map((c) => (
          <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 4px 3px 8px', borderRadius: 999, border: `1px solid ${c.color}59`, background: `${c.color}1f`, color: c.color, lineHeight: 1.3 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, flex: 'none' }} />
            {c.nombre}
            <button type="button" onClick={() => onEditar(t.id, { categorias: t.categorias.filter((x) => x !== c.id) })} aria-label={`Quitar ${c.nombre}`} title="Quitar"
              style={{ width: 15, height: 15, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', color: 'inherit', opacity: 0.6, fontSize: 13, lineHeight: 1, cursor: 'pointer', padding: 0, borderRadius: 5 }}>
              ✕
            </button>
          </span>
        ))}
        {disponibles.length > 0 && (
          <Dropdown
            value=""
            options={disponibles.map((c) => ({ value: String(c.id), label: c.nombre, color: c.color }))}
            onChange={(v) => onEditar(t.id, { categorias: [...t.categorias, Number(v)] })}
            placeholder="＋ categoría"
            resetAfterSelect
            width={128}
            ariaLabel="Agregar categoría"
            buttonStyle={{ padding: '4px 8px', fontSize: 11, borderRadius: 8, fontWeight: 600 }}
          />
        )}
      </div>

      {/* progreso */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={shown}
          aria-label="Progreso"
          onChange={(e) => setDragProg(Number(e.target.value))}
          onMouseUp={commitProg}
          onKeyUp={commitProg}
          onTouchEnd={commitProg}
          style={{ flex: 1, height: 5, borderRadius: 999, cursor: 'pointer', accentColor: 'var(--primary)', background: `linear-gradient(90deg, var(--primary-weak) ${shown}%, var(--surface-2) ${shown}%)` }}
        />
        <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: done ? 'var(--good)' : 'var(--dim)', minWidth: 36, textAlign: 'right' }}>{shown}%</span>
      </div>

      {/* nota */}
      {editNota ? (
        <textarea
          value={notaDraft}
          autoFocus
          rows={3}
          placeholder="Me falta… / nota"
          onChange={(e) => setNotaDraft(e.target.value)}
          onBlur={guardarNota}
          onKeyDown={(e) => { if (e.key === 'Escape') { setNotaDraft(t.detalle ?? ''); setEditNota(false); } }}
          style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--primary)', borderRadius: 8, color: 'var(--ink)', fontFamily: SANS, fontSize: 12, padding: '7px 9px', resize: 'vertical', lineHeight: 1.4, outline: 'none' }}
        />
      ) : t.detalle ? (
        <div
          onClick={() => { setNotaDraft(t.detalle ?? ''); setEditNota(true); }}
          title="Editar nota"
          style={{ fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--dim)', padding: '7px 9px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.4, cursor: 'text' }}
        >
          {t.detalle}
        </div>
      ) : (
        <button type="button" onClick={() => { setNotaDraft(''); setEditNota(true); }}
          style={{ width: '100%', textAlign: 'left', fontSize: 12, background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: 8, color: 'var(--faint)', padding: '5px 9px', cursor: 'pointer', fontFamily: SANS }}>
          + nota
        </button>
      )}
    </div>
  );
}

// ── botón toggle de la toolbar ──
function toggleBtn(active: boolean): CSSProperties {
  return {
    padding: '9px 14px', borderRadius: 11,
    border: `1px solid ${active ? 'var(--primary-weak)' : 'var(--border-strong)'}`,
    background: active ? 'var(--primary-bg)' : 'var(--surface)',
    color: active ? 'var(--primary-strong)' : 'var(--dim)',
    fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  };
}
