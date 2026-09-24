'use client';

// =============================================================================
// AccionesLote — lo que se puede hacer con VARIAS tarjetas a la vez
// =============================================================================
// Nació en la vista de tabla (23/09/2026, «seleccionar varias tareas para realizar acciones
// múltiples») y al día siguiente hizo falta también en el Kanban: «que pueda seleccionar
// varias tarjetas también en la vista kanban». Vive acá y no en cada vista porque es la
// misma pregunta con la misma respuesta — y dos copias de una barra de acciones divergen a
// la primera acción nueva que se agregue en una sola.
//
// ⚠️ UNA ACCIÓN EN LOTE NECESITA UN SOLO DESHACER. Cada cambio individual ya ofrece el suyo
// (va en el choke point de `useBoard`), así que una acción sobre 12 tareas dispara 12 toasts
// y el que queda arriba deshace UNA. Acá se guarda el estado anterior de todas y se pisa con
// un toast que las revierte juntas — que es la unidad en la que la persona decidió.
//
// ⚠️ Y BORRAR PREGUNTA, Y NO PROMETE DESHACER. Restaurar N tareas es volver a crearlas en el
// server una por una, y a mitad de camino puede fallar dejando la mitad. Un botón que
// promete deshacer y a veces no puede es peor que uno que avisa antes.
// =============================================================================

import type { CSSProperties } from 'react';
import type { BoardTask } from './types';
import type { Board } from './useBoard';

const SANS = "'Geist', sans-serif";

const btn: CSSProperties = {
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)',
  borderRadius: 8, padding: '6px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS,
};

export function AccionesLote({ elegidas, board, ask, onLimpiar, estilo }: {
  elegidas: BoardTask[];
  board: Board;
  /** confirmar lo irreversible (lo trae el board) */
  ask: (msg: string, onOk: () => void) => void;
  onLimpiar: () => void;
  estilo?: CSSProperties;
}) {
  if (!elegidas.length) return null;

  const enLote = (texto: string, aplicar: (t: BoardTask) => void) => {
    const snaps = elegidas.map((t) => ({ ...t }));
    elegidas.forEach(aplicar);
    onLimpiar();
    board.showUndo(texto, () => snaps.forEach((snap) => board.replaceTask(snap)));
  };

  // ⚠️ UN SOLO BOTÓN PARA LAS DOS DIRECCIONES. «Elimina el "Reabrir", sería lo mismo que
  // "completar" solo que si lo aprieto a la inversa se descompleta, pero no debe haber 2
  // botones» (24/09/2026). Con dos, uno de los dos siempre está de más: sobre una selección
  // de tareas abiertas, «Reabrir» no hace nada y viceversa — un botón que no puede hacer
  // nada se lee como que la app está rota. El sentido lo decide la selección: si TODAS
  // están hechas, descompleta; si no, completa.
  const todasHechas = elegidas.every((t) => t.progress >= 100);
  const n = elegidas.length;
  const plural = n === 1 ? '' : 's';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 11, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', ...estilo }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{n} seleccionada{plural}</span>
      <span style={{ width: 1, height: 20, background: 'var(--border)' }} />
      <button type="button" style={btn}
        onClick={() => enLote(
          todasHechas ? `${n} reabierta${plural}` : `${n} completada${plural}`,
          (t) => { if (todasHechas ? t.progress >= 100 : t.progress < 100) board.toggleDone(t.id); },
        )}>
        {todasHechas ? '↺ Descompletar' : '✓ Completar'}
      </button>
      <label style={{ ...btn, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        Deadline
        <input type="date" aria-label="Ponerles la misma fecha a todas"
          onChange={(e) => { const v = e.target.value; if (v) enLote(`Deadline ${v} en ${n}`, (t) => board.setDeadline(t.id, v, t.deadline)); }}
          style={{ border: 'none', background: 'transparent', font: 'inherit', color: 'var(--ink)', cursor: 'pointer' }} />
      </label>
      <select value="" aria-label="Moverlas a un proyecto" style={{ ...btn, maxWidth: 190 }}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          const l = board.labelById(id);
          enLote(`${n} a «${l?.name ?? ''}»`, (t) => board.setTaskLabels(t.id, [id], `Movida a «${l?.name ?? ''}»`));
        }}>
        <option value="">Mover a un proyecto…</option>
        {board.labels.map((l) => <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>)}
      </select>
      <span style={{ flex: 1 }} />
      <button type="button" style={{ ...btn, borderColor: 'var(--bad)', color: 'var(--bad)' }}
        onClick={() => ask(`¿Eliminar ${n} tarea${plural}? Esto no se puede deshacer en lote.`, () => { elegidas.forEach((t) => board.removeSilent(t.id)); onLimpiar(); })}>
        Eliminar
      </button>
      <button type="button" onClick={onLimpiar} style={{ ...btn, border: 'none', background: 'transparent', color: 'var(--dim)' }}>Quitar selección</button>
    </div>
  );
}
