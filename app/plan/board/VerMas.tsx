'use client';

// =============================================================================
// VerMas — cortar una lista larga sin esconderla
// =============================================================================
// El historial se mostraba entero: en el detalle de un proyecto sin ningún tope, y en
// la tab de Proyectos con un `.slice(0, 40)` que igual dejaba una tira de 40 filas con
// avatar y chip cada una (medido en el tablero real: 191). Para llegar a lo que está
// DEBAJO del historial había que scrollear un rato largo, y el historial es justamente
// lo que menos se mira.
//
// LA REGLA: se muestran las últimas N y el botón trae OTRAS N, no todo de golpe.
// Un «ver más» que abre 183 filas de una no resolvió nada: cambió un scroll infinito
// por un scroll infinito con un click antes. Se aprieta las veces que haga falta, y
// el botón siempre dice cuántas quedan.
// =============================================================================

import { useState } from 'react';

const SANS = "'Geist', sans-serif";

export type VerMasOpts = {
  /** Cuántas se ven al principio (default 8). */
  inicial?: number;
  /** Cuántas suma cada click (default: las mismas que `inicial`). */
  tanda?: number;
  /** 'boton' = botón con borde, alineado a la izquierda (default).
   *  'texto' = link centrado, para listas que ya viven adentro de una tarjeta. */
  estilo?: 'boton' | 'texto';
};

export function useVerMas<T>(items: T[], opts: VerMasOpts | number = {}): { visibles: T[]; boton: React.ReactNode } {
  // Compat: se puede pasar un número suelto como `inicial`.
  const o: VerMasOpts = typeof opts === 'number' ? { inicial: opts } : opts;
  const inicial = o.inicial ?? 8;
  const tanda = o.tanda ?? inicial;
  const estilo = o.estilo ?? 'boton';

  const [tope, setTope] = useState(inicial);
  const visibles = items.slice(0, tope);
  const ocultas = Math.max(0, items.length - tope);
  const abierto = tope > inicial;

  const mas = () => setTope((t) => Math.min(items.length, t + tanda));
  const cerrar = () => setTope(inicial);

  // El "ver menos" solo tiene sentido cuando ya expandiste algo.
  const acciones: React.ReactNode[] = [];
  if (ocultas > 0) acciones.push(
    <button key="mas" type="button" onClick={mas}
      style={estilo === 'texto' ? txtBtn : cajaBtn}>
      Ver {Math.min(tanda, ocultas)} más{ocultas > tanda ? ` (quedan ${ocultas})` : ''}
    </button>,
  );
  if (abierto) acciones.push(
    <button key="menos" type="button" onClick={cerrar}
      style={estilo === 'texto' ? { ...txtBtn, color: 'var(--faint)' } : cajaBtn}>
      Ver menos
    </button>,
  );

  const boton = acciones.length ? (
    <div style={{
      display: 'flex', gap: 14, marginTop: estilo === 'texto' ? 8 : 2,
      justifyContent: estilo === 'texto' ? 'center' : 'flex-start',
    }}>
      {acciones}
    </div>
  ) : null;

  return { visibles, boton };
}

const cajaBtn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 9, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600,
  cursor: 'pointer', fontFamily: SANS,
};

const txtBtn: React.CSSProperties = {
  border: 'none', background: 'transparent', color: 'var(--dim)', fontSize: 12.5,
  fontWeight: 600, cursor: 'pointer', fontFamily: SANS, padding: '4px 2px',
  textDecoration: 'underline', textUnderlineOffset: 3,
};
