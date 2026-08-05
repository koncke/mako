'use client';

// =============================================================================
// ListaElegible — elegir de una lista larga: buscar, ordenar y marcar todo
// =============================================================================
// La pieza que le faltaba a los pasos del wizard que muestran una lista (elegir
// proyectos, elegir tareas). Antes la única forma de sacar un proyecto de un export
// era bajar por 35 opciones a ojo, y "Todos" era una opción MÁS de la lista — así que
// marcar todo y marcar uno se veían igual.
//
// Reusa el lenguaje visual que ya tiene el board: el mismo input de "Buscar…" del
// header, el mismo ícono de embudo para ordenar y los mismos tokens. No es un
// componente nuevo de diseño: es el mismo, en un lugar donde faltaba.
// =============================================================================

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Mismo input que el buscador del header del board. */
const inputBuscar: CSSProperties = {
  flex: '1 1 140px', minWidth: 110, padding: '8px 12px', borderRadius: 9,
  border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS,
};

/** Control chico de la barra: "Todos", "Ninguno", el orden. NO es una opción de la lista. */
const chipBarra: CSSProperties = {
  flex: 'none', padding: '7px 11px', borderRadius: 9, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--dim)', fontFamily: MONO, fontSize: 11,
  fontWeight: 700, cursor: 'pointer', lineHeight: 1.5, whiteSpace: 'nowrap',
};

export type ItemElegible = {
  id: string;
  /** lo que se lee en la fila. */
  titulo: string;
  /** segunda línea (P#, cuántas pendientes, el proyecto…). */
  sub?: string;
  /** texto extra por el que también se puede buscar (nunca se muestra). */
  buscarPor?: string;
  /** para ordenar por relevancia (score, prioridad). */
  peso?: number;
  /** para ordenar alfabéticamente hay que usar `titulo`; esto es el orden "natural". */
  orden?: number;
};

type Orden = 'peso' | 'alfa';

/**
 * Lista con barra propia. `sel` es el conjunto elegido; `onSel` lo reemplaza entero.
 * "Todos" y "Ninguno" operan sobre lo que está VISIBLE (lo filtrado), que es lo que
 * uno espera al haber buscado algo: si buscaste "Vender" y tocás Todos, marcás los de
 * Vender, no los 35.
 */
export function ListaElegible({ items, sel, onSel, placeholder = 'Buscar…', vacio = 'No hay nada que mostrar.', altura = 300, extra }: {
  items: ItemElegible[];
  sel: Set<string>;
  onSel: (s: Set<string>) => void;
  placeholder?: string;
  vacio?: string;
  /** alto máximo de la lista; la barra queda fija arriba. */
  altura?: number;
  /** slot al final de la barra (por ejemplo un botón "Avanzado"). */
  extra?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState<Orden>('peso');

  const visibles = useMemo(() => {
    const n = q.trim().toLowerCase();
    const filtrados = !n ? items : items.filter((i) => `${i.titulo} ${i.sub ?? ''} ${i.buscarPor ?? ''}`.toLowerCase().includes(n));
    return [...filtrados].sort((a, b) => (orden === 'alfa'
      ? a.titulo.localeCompare(b.titulo, 'es')
      : (b.peso ?? 0) - (a.peso ?? 0) || (a.orden ?? 0) - (b.orden ?? 0)));
  }, [items, q, orden]);

  const idsVisibles = visibles.map((i) => i.id);
  const todosVisiblesOn = idsVisibles.length > 0 && idsVisibles.every((id) => sel.has(id));
  const marcarTodos = () => { const c = new Set(sel); for (const id of idsVisibles) c.add(id); onSel(c); };
  const desmarcarTodos = () => { const c = new Set(sel); for (const id of idsVisibles) c.delete(id); onSel(c); };
  const toggle = (id: string) => { const c = new Set(sel); if (c.has(id)) c.delete(id); else c.add(id); onSel(c); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {/* BARRA. Acá viven "Todos"/"Ninguno" y el orden: son controles, no opciones —
          por eso son chicos y están arriba, no mezclados con la lista. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} style={inputBuscar} />
        <button type="button" onClick={todosVisiblesOn ? desmarcarTodos : marcarTodos}
          style={{ ...chipBarra, color: todosVisiblesOn ? 'var(--primary)' : 'var(--dim)', borderColor: todosVisiblesOn ? 'var(--primary-weak)' : 'var(--border-strong)' }}>
          {todosVisiblesOn ? 'Ninguno' : 'Todos'}
        </button>
        <button type="button" onClick={() => setOrden((o) => (o === 'peso' ? 'alfa' : 'peso'))}
          title={orden === 'peso' ? 'Ordenado por prioridad' : 'Ordenado por nombre'} style={chipBarra}>
          {orden === 'peso' ? '↓ prioridad' : '↓ A-Z'}
        </button>
        {extra}
      </div>

      <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', textAlign: 'left' }}>
        {sel.size} de {items.length} elegidos{q.trim() && visibles.length !== items.length ? ` · ${visibles.length} en la búsqueda` : ''}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: altura, overflowY: 'auto', textAlign: 'left' }}>
        {visibles.length === 0 && <div style={{ fontSize: 13, color: 'var(--faint)', padding: '14px 4px' }}>{q.trim() ? 'Nada coincide con la búsqueda.' : vacio}</div>}
        {visibles.map((i) => {
          const on = sel.has(i.id);
          return (
            <button key={i.id} type="button" onClick={() => toggle(i.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontFamily: SANS, border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface-2)', color: on ? 'var(--primary)' : 'var(--ink)' }}>
              <span style={{ width: 16, height: 16, flex: 'none', borderRadius: 5, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: on ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.titulo}</span>
                {i.sub && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.sub}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
