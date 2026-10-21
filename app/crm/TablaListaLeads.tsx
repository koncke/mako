'use client';
// =============================================================================
// La vista LISTA de /crm: el encabezado y las celdas de una fila (21/10/2026)
// =============================================================================
// Separado de CrmBoard para que la tabla se pueda DIBUJAR sola y medir en un navegador a cualquier ancho
// (tests/_crm-lista-arnes.tsx): en un escritorio chico se pisaban los encabezados y la etapa se montaba sobre la fecha.
// Qué columnas entran lo decide app/crm/tabla-columnas.ts; acá, cómo se dibujan sin pisarse:
//   · cada celda tiene `minWidth: 0` y recorta con «…»; ninguna se sale de su lugar;
//   · el rótulo del encabezado se recorta adentro de su botón de ordenar;
//   · la etapa se recorta adentro de su chip, con el nombre entero en el `title`;
//   · la Empresa que no entra como columna va debajo del nombre, junto al email.
// La casilla y las acciones las pone CrmBoard (tienen sus manejadores): acá van como nodos.
// =============================================================================

import type { CSSProperties, ReactNode } from 'react';
import type { ColumnaLista } from './tabla-columnas';

export const MONO_LISTA = "'Geist Mono', monospace";

/** La grilla del ENCABEZADO: la misma plantilla que cada fila. */
export function estiloEncabezado(plantilla: string, minAncho: number): CSSProperties {
  return {
    display: 'grid', gridTemplateColumns: plantilla, minWidth: minAncho, gap: 12, padding: '15px 22px',
    borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', fontFamily: MONO_LISTA, fontSize: 11,
    letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--dim)', alignItems: 'center',
  };
}

/** La grilla de una FILA (sin el fondo del arrastre ni de la selección, que pone CrmBoard). */
export function estiloFila(plantilla: string, minAncho: number): CSSProperties {
  return {
    display: 'grid', gridTemplateColumns: plantilla, minWidth: minAncho, gap: 12, padding: '15px 22px',
    borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer',
  };
}

/**
 * Un encabezado que ORDENA. Copiado del `Th` de la tabla del plan
 * (app/plan/board/Tablas.tsx), con lo mismo que lo hace usable ahi:
 *
 *   · sin `onSort` no dibuja boton — una columna que no se puede ordenar no finge que si;
 *   · la flecha sale SOLO en la columna activa, o siete flechas grises compiten con los
 *     rotulos y ninguna dice nada;
 *   · `aria-sort` para que se anuncie, que es lo unico que le queda a quien no ve la flecha.
 */
export function ThCrm({ children, activo, dir, onSort, alinear = 'left' }: {
  children: ReactNode;
  activo?: boolean;
  dir?: 'asc' | 'desc';
  onSort?: () => void;
  alinear?: 'left' | 'right';
}) {
  // ⚠️ EL RÓTULO SE RECORTA, NO SE MONTA (21/10/2026): el botón no se achicaba y «¿AGENDÓ?», «MONTO» y «CREADO» se pisaban
  // («¿AGENDÓMONTCREADO»). Con `minWidth: 0` en la celda Y en el botón, lo que no entra termina en «…».
  const base: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden',
    justifyContent: alinear === 'right' ? 'flex-end' : 'flex-start',
  };
  const rotulo: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  if (!onSort) return <span style={base}><span style={rotulo}>{children}</span></span>;
  return (
    <span style={base} aria-sort={activo ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={onSort}
        title={`Ordenar por ${typeof children === 'string' ? children.toLowerCase() : 'esta columna'}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, border: 0, minWidth: 0, maxWidth: '100%',
          background: 'none', cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit',
          textTransform: 'inherit', color: activo ? 'var(--ink)' : 'inherit',
          fontWeight: activo ? 700 : 'inherit',
        }}>
        <span style={rotulo}>{children}</span>
        {activo && <span aria-hidden style={{ fontSize: 9, lineHeight: 1 }}>{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </span>
  );
}

export type OrdenLista = 'nombre' | 'empresa' | 'origen' | 'etapa' | 'agenda' | 'monto' | 'creado';

/** Los rótulos de las columnas que entran (sin la casilla ni las acciones, que pone CrmBoard). */
export function TitulosLista({ cols, orden, dir, onSort }: {
  cols: readonly ColumnaLista[];
  orden: OrdenLista;
  dir: 'asc' | 'desc';
  onSort: (c: OrdenLista) => void;
}) {
  const ve = (c: ColumnaLista) => cols.includes(c);
  const th = (c: OrdenLista, rotulo: string, alinear?: 'right') => (
    <ThCrm key={c} activo={orden === c} dir={dir} onSort={() => onSort(c)} alinear={alinear}>{rotulo}</ThCrm>
  );
  return (
    <>
      {th('nombre', 'Nombre')}
      {ve('empresa') && th('empresa', 'Empresa')}
      {ve('origen') && th('origen', 'Origen')}
      {th('etapa', 'Etapa')}
      {ve('agenda') && th('agenda', '¿Agendó?')}
      {ve('monto') && th('monto', 'Monto')}
      {ve('creado') && th('creado', 'Creado', 'right')}
    </>
  );
}

const corta: CSSProperties = { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

/** Las celdas de datos de UNA fila, en el orden de pantalla, sólo las columnas que entran. */
export function CeldasLead({ cols, nombre, email, empresa, origen, etapa, agenda, monto, creado }: {
  cols: readonly ColumnaLista[];
  nombre: string;
  email: string | null | undefined;
  empresa: string | null | undefined;
  origen: string | null | undefined;
  /** El rótulo de la etapa y el estilo de su chip (los colores los decide CrmBoard). */
  etapa: { rotulo: string; estilo: CSSProperties };
  agenda: string | null | undefined;
  monto: { texto: string; ganado: boolean };
  creado: string;
}) {
  const ve = (c: ColumnaLista) => cols.includes(c);
  // La Empresa que no entra como columna pasa a la FILA, junto al email (21/10/2026).
  const debajo = [email, ve('empresa') ? '' : empresa].filter(Boolean).join(' · ');
  return (
    <>
      <div style={{ minWidth: 0 }} title={[nombre, debajo].filter(Boolean).join(' · ')}>
        <div data-celda="nombre" style={{ ...corta, fontWeight: 600, fontSize: 14.5, color: 'var(--primary)' }}>{nombre}</div>
        <div style={{ ...corta, fontSize: 12.5, color: 'var(--faint)' }}>{debajo}</div>
      </div>
      {ve('empresa') && <div style={{ ...corta, fontSize: 13.5, color: 'var(--ink)' }}>{empresa}</div>}
      {ve('origen') && <div style={{ ...corta, fontSize: 12.5, color: 'var(--dim)' }}>{origen}</div>}
      {/* La etapa se RECORTA dentro de su chip: «Nutrición – Reactivación» se montaba sobre la fecha (21/10/2026). */}
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <span title={etapa.rotulo} style={{ ...etapa.estilo, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' }}>{etapa.rotulo}</span>
      </div>
      {ve('agenda') && <div style={{ ...corta, fontSize: 13, color: 'var(--dim)' }}>{agenda ?? '—'}</div>}
      {ve('monto') && <div style={{ ...corta, fontSize: 13.5, fontWeight: 600, color: monto.ganado ? 'var(--good)' : 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{monto.ganado ? monto.texto : '—'}</div>}
      {ve('creado') && <div style={{ ...corta, fontSize: 12.5, color: 'var(--faint)', textAlign: 'right' }}>{creado}</div>}
    </>
  );
}
