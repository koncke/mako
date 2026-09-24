'use client';

// =============================================================================
// Tablas — la MISMA información, en filas
// =============================================================================
// El pedido, textual (22/09/2026): «no puedo ver todos los proyectos de una página, las
// tarjetas ocupan muchísimo espacio», y con el zoom «se abudea el diseño». Y sobre el
// deadline: «no me dice cuándo es el deadline, cuánto me falta, nada de eso tengo claridad
// en la vista principal».
//
// ⚠️ ES OTRA OPCIÓN DE VERLO, NO UN REEMPLAZO. Su corrección, textual: «NO reemplaces lo
// que hay ahora, es otra opción de verlo». El default sigue siendo las tarjetas y el
// Kanban; esto se prende en la barra de arriba y se recuerda por navegador.
//
// Tres cosas que la tabla hace y las tarjetas no:
//  1. El DEADLINE con su día de la semana, cuántos días faltan y si está atrasado.
//  2. Se ordena por deadline (click en el encabezado), no solo por prioridad.
//  3. Lo COMPLETADO se va al fondo, plegado: «un proyecto marcado completo tiene que
//     desaparecer o bajar — me queda acá».
//
// ⚠️ Y NO DICE «Sin deadline». Su corrección: «no pongas "Sin deadline" cuando ya existe
// un signo de warning que utilizamos en esos casos». El triangulito es el que avisa.
// =============================================================================

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { type BoardTask, type Label, PCOLOR, PLABEL, prioFromScore } from './types';
import type { Board } from './useBoard';
import { WarnMark, fechaConDia, diasHasta, plazoTexto } from './piezas';
import { usePref, esUnoDe } from './prefs';
import { AccionesLote } from './AccionesLote';
import { ScoreIcon } from './guardian-form';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type OrdenProy = 'deadline' | 'score' | 'nombre' | 'avance';
type OrdenTarea = 'deadline' | 'score' | 'proyecto' | 'num';

// ── la caja de la tabla ──────────────────────────────────────────────────────────────
// El scroll horizontal vive ACÁ, en el contenido, que es donde la regla de la casa lo
// permite (una BARRA DE NAVEGACIÓN no scrollea; una tabla sí). Sin esto, con el zoom al
// 150% la tabla empuja el ancho del documento entero y se lleva puesto el header.
const cajaStyle: CSSProperties = { width: '100%', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' };
const tablaStyle: CSSProperties = { width: '100%', minWidth: 720, borderCollapse: 'collapse', fontFamily: SANS, fontSize: 13.5 };
const thBase: CSSProperties = { textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' };
const tdBase: CSSProperties = { padding: '9px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
const fechaInput: CSSProperties = { width: 138, padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, fontFamily: SANS };

function Th({ children, orden, activo, dir, onSort, ancho }: { children: ReactNode; orden?: string; activo?: boolean; dir?: 'asc' | 'desc'; onSort?: () => void; ancho?: number }) {
  if (!onSort) return <th style={{ ...thBase, width: ancho }}>{children}</th>;
  return (
    <th style={{ ...thBase, width: ancho }} aria-sort={activo ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={onSort} title={`Ordenar por ${orden}`}
        style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: activo ? 'var(--primary)' : 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}{activo && <span aria-hidden>{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  );
}

/** La celda del deadline: editable, con el día de la semana y el triangulito si falta. */
function CeldaFecha({ iso, hoy, onSet, titulo }: { iso: string; hoy: string; onSet: (v: string) => void; titulo: string }) {
  const dias = iso ? diasHasta(iso, hoy) : null;
  const plazo = dias == null ? null : plazoTexto(dias);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <input type="date" value={iso} onChange={(e) => onSet(e.target.value)} style={fechaInput} aria-label={titulo} />
      {iso
        ? <span style={{ fontSize: 12, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{fechaConDia(iso)}</span>
        : <WarnMark title={titulo} size={14} />}
      {plazo && <span style={{ fontSize: 12, color: plazo.color, fontWeight: plazo.fuerte ? 700 : 500, whiteSpace: 'nowrap' }}>· {plazo.texto}</span>}
    </div>
  );
}

function Score({ score, color }: { score: number; color: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 12, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}33`, borderRadius: 6, padding: '2px 7px 2px 6px' }}><ScoreIcon size={11} color={color} />{score}</span>;
}

function Barra({ pct, color }: { pct: number; color: string }) {
  return <span style={{ display: 'block', width: 56, height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: Math.max(0, Math.min(100, pct)) + '%', background: color }} /></span>;
}

/** La fila que pliega lo terminado. Se ve el número; lo que hay adentro, a un click. */
function FilaPlegada({ n, abierto, onToggle, cols, texto }: { n: number; abierto: boolean; onToggle: () => void; cols: number; texto: string }) {
  if (n === 0) return null;
  return (
    <tr>
      <td colSpan={cols} style={{ ...tdBase, padding: 0 }}>
        <button type="button" onClick={onToggle}
          style={{ width: '100%', textAlign: 'left', border: 'none', background: 'var(--surface-2)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, padding: '9px 12px', cursor: 'pointer' }}>
          {abierto ? '▾' : '▸'} {n} {texto}
        </button>
      </td>
    </tr>
  );
}

// ── PROYECTOS ────────────────────────────────────────────────────────────────────────

export function TablaProyectos({ filas, topProjectId, hoy, onOpen, onDeadline, labelPlural }: {
  filas: Array<{ l: Label; prog: { pct: number; total: number; done: number } }>;
  topProjectId: string | null;
  hoy: string;
  onOpen: (id: string) => void;
  onDeadline: (id: string, iso: string) => void;
  labelPlural: string;
}) {
  const [orden, setOrden] = usePref<OrdenProy>('proyectos.tabla.orden', 'deadline', esUnoDe('deadline', 'score', 'nombre', 'avance'));
  const [dir, setDir] = usePref<'asc' | 'desc'>('proyectos.tabla.dir', 'asc', esUnoDe('asc', 'desc'));
  const [verHechos, setVerHechos] = useState(false);

  const sortear = (col: OrdenProy) => {
    if (col === orden) { setDir(dir === 'asc' ? 'desc' : 'asc'); return; }
    setOrden(col);
    // Cada columna tiene una dirección que se lee natural: la fecha más cercana primero,
    // la prioridad más alta primero. Arrancar siempre en `asc` deja la tabla al revés.
    setDir(col === 'deadline' || col === 'nombre' ? 'asc' : 'desc');
  };

  const { vivos, hechos } = useMemo(() => {
    const s = dir === 'asc' ? 1 : -1;
    const cmp = (a: { l: Label; prog: { pct: number } }, b: { l: Label; prog: { pct: number } }) => {
      if (orden === 'nombre') return s * a.l.name.localeCompare(b.l.name, 'es');
      if (orden === 'score') return s * ((a.l.score || 0) - (b.l.score || 0));
      if (orden === 'avance') return s * (a.prog.pct - b.prog.pct);
      // Por deadline: los que NO tienen van al final SIEMPRE, en las dos direcciones —
      // invertir el orden no puede hacer que lo que no tiene fecha encabece la tabla.
      const fa = a.l.deadline || '', fb = b.l.deadline || '';
      if (!fa && !fb) return (b.l.score || 0) - (a.l.score || 0);
      if (!fa) return 1;
      if (!fb) return -1;
      return s * fa.localeCompare(fb);
    };
    const orde = filas.slice().sort(cmp);
    return {
      vivos: orde.filter(({ prog }) => !(prog.total > 0 && prog.pct >= 100)),
      hechos: orde.filter(({ prog }) => prog.total > 0 && prog.pct >= 100),
    };
  }, [filas, orden, dir]);

  const fila = ({ l, prog }: { l: Label; prog: { pct: number; total: number; done: number } }, hecho: boolean) => (
    <tr key={l.id} style={{ background: hecho ? 'var(--surface-2)' : undefined }}>
      <td style={{ ...tdBase, maxWidth: 340 }}>
        <button type="button" onClick={() => onOpen(l.id)} title={`Abrir «${l.name}»`}
          style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--ink)', textAlign: 'left', maxWidth: '100%' }}>
          <span style={{ flex: 'none' }}>{l.emoji}</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: l.color, fontWeight: 700, flex: 'none' }}>{l.pid}</span>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: hecho ? 'line-through' : 'none', opacity: hecho ? .7 : 1 }}>{l.name}</span>
          {l.id === topProjectId && <span title="Objetivo Principal" style={{ flex: 'none' }}>🎯</span>}
        </button>
      </td>
      <td style={tdBase}><Score score={l.score} color={l.color} /></td>
      <td style={tdBase}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Barra pct={prog.pct} color={l.color} />
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{prog.done}/{prog.total}</span>
        </div>
      </td>
      <td style={tdBase}>
        <CeldaFecha iso={l.deadline || ''} hoy={hoy} titulo={`«${l.name}» no tiene deadline`} onSet={(v) => onDeadline(l.id, v)} />
      </td>
    </tr>
  );

  return (
    <div style={cajaStyle} className="mk-scroll-x">
      <table style={tablaStyle}>
        <thead>
          <tr>
            <Th orden="nombre" activo={orden === 'nombre'} dir={dir} onSort={() => sortear('nombre')}>{labelPlural}</Th>
            <Th orden="prioridad" activo={orden === 'score'} dir={dir} onSort={() => sortear('score')} ancho={110}>Prioridad</Th>
            <Th orden="avance" activo={orden === 'avance'} dir={dir} onSort={() => sortear('avance')} ancho={130}>Tareas</Th>
            <Th orden="deadline" activo={orden === 'deadline'} dir={dir} onSort={() => sortear('deadline')} ancho={330}>Deadline</Th>
          </tr>
        </thead>
        <tbody>
          {vivos.map((f) => fila(f, false))}
          {vivos.length === 0 && hechos.length === 0 && (
            <tr><td colSpan={4} style={{ ...tdBase, textAlign: 'center', color: 'var(--faint)' }}>No hay {labelPlural.toLowerCase()} para este filtro.</td></tr>
          )}
          <FilaPlegada n={hechos.length} abierto={verHechos} onToggle={() => setVerHechos((v) => !v)} cols={4} texto={`completado${hechos.length === 1 ? '' : 's'}`} />
          {verHechos && hechos.map((f) => fila(f, true))}
        </tbody>
      </table>
    </div>
  );
}

// ── TAREAS ───────────────────────────────────────────────────────────────────────────

export function TablaTareas({ tareas, board, hoy, onOpen, onOpenProj, ask }: {
  tareas: BoardTask[];
  board: Board;
  hoy: string;
  onOpen: (id: string) => void;
  onOpenProj?: (id: string) => void;
  /** confirmar lo irreversible (lo trae el board) */
  ask: (msg: string, onOk: () => void) => void;
}) {
  /**
   * LO SELECCIONADO. La casilla de la primera columna SELECCIONA, no completa.
   *
   * «En la vista de tabla el botón de marcar como completada no debería salir allí, porque
   * pareciera que es un botón de seleccionar varias» (23/09/2026). Y tenía razón por partida
   * doble: en una tabla, una casilla en la primera columna ES el control de selección —lo es
   * en Gmail, en Drive y en cualquier tabla— así que la lectura no era un error de nadie.
   * Lo que faltaba era que hiciera lo que parecía que hacía.
   */
  const [sel, setSel] = useState<ReadonlySet<string>>(new Set());
  const [orden, setOrden] = usePref<OrdenTarea>('kanban.tabla.orden', 'score', esUnoDe('deadline', 'score', 'proyecto', 'num'));
  const [dir, setDir] = usePref<'asc' | 'desc'>('kanban.tabla.dir', 'desc', esUnoDe('asc', 'desc'));
  const [verHechas, setVerHechas] = useState(false);

  const sortear = (col: OrdenTarea) => {
    if (col === orden) { setDir(dir === 'asc' ? 'desc' : 'asc'); return; }
    setOrden(col);
    setDir(col === 'deadline' || col === 'proyecto' ? 'asc' : 'desc');
  };

  const nombreProy = (t: BoardTask) => board.labelById(t.labels[0])?.name ?? '';
  const { vivas, hechas } = useMemo(() => {
    const s = dir === 'asc' ? 1 : -1;
    const cmp = (a: BoardTask, b: BoardTask) => {
      if (orden === 'num') return s * (a.num - b.num);
      if (orden === 'score') return s * ((a.score || 0) - (b.score || 0));
      if (orden === 'proyecto') return s * nombreProy(a).localeCompare(nombreProy(b), 'es') || b.score - a.score;
      const fa = a.deadline || '', fb = b.deadline || '';
      if (!fa && !fb) return b.score - a.score;
      if (!fa) return 1;
      if (!fb) return -1;
      return s * fa.localeCompare(fb);
    };
    const orde = tareas.slice().sort(cmp);
    return { vivas: orde.filter((t) => t.progress < 100), hechas: orde.filter((t) => t.progress >= 100) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareas, orden, dir, board.labels]);

  // Sobre lo VISIBLE, nunca sobre el tablero entero: si hay un filtro puesto, «todas» son
  // las que se ven. Seleccionar lo que no está en pantalla es cómo se borra de más.
  const visiblesIds = (verHechas ? [...vivas, ...hechas] : vivas).map((t) => t.id);
  const todasSel = visiblesIds.length > 0 && visiblesIds.every((id) => sel.has(id));
  const alternar = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const elegidas = tareas.filter((t) => sel.has(t.id));

  const fila = (t: BoardTask, hecha: boolean) => {
    const proy = board.labelById(t.labels[0]);
    const c = PCOLOR[prioFromScore(t.score)];
    return (
      <tr key={t.id} style={{ background: hecha ? 'var(--surface-2)' : undefined }}>
        <td style={{ ...tdBase, width: 34, paddingRight: 0 }}>
          <input type="checkbox" checked={sel.has(t.id)} onChange={() => alternar(t.id)}
            title="Seleccionar" aria-label={`Seleccionar «${t.title}»`}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
        </td>
        <td style={{ ...tdBase, maxWidth: 420 }}>
          <button type="button" onClick={() => onOpen(t.id)} title={t.title}
            style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--ink)', textAlign: 'left', maxWidth: '100%' }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none' }}>#{t.num}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: hecha ? 'line-through' : 'none', opacity: hecha ? .7 : 1 }}>{t.title}</span>
          </button>
        </td>
        <td style={tdBase}>
          {proy && (
            <button type="button" onClick={() => onOpenProj?.(proy.id)} title={`Abrir «${proy.name}»`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 190, border: `1px solid ${proy.color}33`, background: proy.color + '14', color: proy.color, borderRadius: 7, padding: '3px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
              <span style={{ flex: 'none' }}>{proy.emoji}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proy.name}</span>
            </button>
          )}
        </td>
        <td style={tdBase}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Score score={t.score} color={c} />
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{PLABEL[prioFromScore(t.score)]}</span>
          </span>
        </td>
        <td style={tdBase}>
          <CeldaFecha iso={t.deadline || ''} hoy={hoy} titulo={`«${t.title}» no tiene deadline`} onSet={(v) => board.setDeadline(t.id, v, t.deadline)} />
        </td>
      </tr>
    );
  };

  return (
    <div style={cajaStyle} className="mk-scroll-x">
      {/* La barra vive en `AccionesLote`: la usa también el Kanban desde el 24/09/2026, y
          dos copias de una barra de acciones divergen a la primera acción nueva. */}
      <AccionesLote elegidas={elegidas} board={board} ask={ask} onLimpiar={() => setSel(new Set())} estilo={{ marginBottom: 10 }} />
      <table style={tablaStyle}>
        <thead>
          <tr>
            <th style={{ ...thBase, width: 34 }}>
              <input type="checkbox" checked={todasSel} ref={(el) => { if (el) el.indeterminate = sel.size > 0 && !todasSel; }}
                onChange={() => setSel(todasSel ? new Set() : new Set(visiblesIds))}
                title={todasSel ? 'Quitar la selección' : 'Seleccionar todas'} aria-label="Seleccionar todas"
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
            </th>
            <Th orden="número" activo={orden === 'num'} dir={dir} onSort={() => sortear('num')}>Tarea</Th>
            <Th orden="proyecto" activo={orden === 'proyecto'} dir={dir} onSort={() => sortear('proyecto')} ancho={210}>Proyecto</Th>
            <Th orden="prioridad" activo={orden === 'score'} dir={dir} onSort={() => sortear('score')} ancho={150}>Prioridad</Th>
            <Th orden="deadline" activo={orden === 'deadline'} dir={dir} onSort={() => sortear('deadline')} ancho={330}>Deadline</Th>
          </tr>
        </thead>
        <tbody>
          {vivas.map((t) => fila(t, false))}
          {vivas.length === 0 && hechas.length === 0 && (
            <tr><td colSpan={5} style={{ ...tdBase, textAlign: 'center', color: 'var(--faint)' }}>No hay tareas para este filtro.</td></tr>
          )}
          <FilaPlegada n={hechas.length} abierto={verHechas} onToggle={() => setVerHechas((v) => !v)} cols={5} texto={`completada${hechas.length === 1 ? '' : 's'}`} />
          {verHechas && hechas.map((t) => fila(t, true))}
        </tbody>
      </table>
    </div>
  );
}
