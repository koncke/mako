'use client';

// =============================================================================
// Seccion — la «Sección» a lo ancho del Dashboard: su título con la flecha de plegar, su fondo y su panel
// =============================================================================
// Decisión 2 de Martín (tanda v5, 12/10/2026): el contenedor es una sección A LO ANCHO que agrupa las filas
// de abajo hasta la siguiente sección, con título, fondo y plegable — y es también el «Desplegable» del punto
// 24. Qué agrupa, qué se esconde y cómo se mueve la grilla al plegar es PURO y vive en lib/graficos-secciones.ts
// (con test); acá sólo se dibuja.
//
//   · `CuerpoSeccion`: lo que va en la celda de la grilla. Plegable → la flecha (también MIRANDO: plegar es
//     estado de la vista y no se guarda). Sin título y no plegable → un DIVISOR: una línea que cierra el grupo de
//     arriba.
//   · `FondosSecciones`: los rectángulos detrás de cada grupo con fondo, en una capa debajo de las tarjetas.
//   · `PropsSeccion`: lo suyo en el panel (título, fondo, plegable y cómo arranca).
//
// ⚠️ La flecha está ADENTRO de una tarjeta de la grilla: lleva `lk-no-arrastrar` y frena el mousedown, o
//    apretarla arrastra la sección.

import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Switch } from '@/app/_ui';
import { calcGridItemPosition } from 'react-grid-layout/core';
import { COLS, type Elemento } from '@/lib/graficos-catalogo';
import { esCierre, type ElementoSeccion } from '@/lib/graficos-secciones';
import { TAMANOS_TEXTO, colorDeElemento } from './Elemento';

const parar = (e: ReactMouseEvent | { stopPropagation: () => void }) => e.stopPropagation();

/** Lo que la pantalla le cuenta a una sección: si está plegada, cómo alternarla y cuántas piezas agrupa. */
export type EstadoSeccion = { plegada: boolean; onPlegar?: () => void; miembros: number };

export function CuerpoSeccion({ e, colores, estado }: { e: Elemento; colores: readonly string[]; estado?: EstadoSeccion }) {
  const s = e as ElementoSeccion;
  if (esCierre(s)) return <div className="lk-sec-linea" aria-hidden />;
  const t = TAMANOS_TEXTO[e.tamano] ?? TAMANOS_TEXTO.l;
  const estilo: CSSProperties = {
    fontFamily: 'var(--dash-letra, inherit)', fontSize: t.px, fontWeight: t.peso, lineHeight: t.alto,
    letterSpacing: t.px >= 26 ? '-0.015em' : undefined, color: colorDeElemento(e, colores),
  };
  const plegable = !!e.seccion?.plegable;
  const plegada = !!estado?.plegada;
  return (
    <div className="lk-sec">
      {plegable && estado?.onPlegar && (
        <button type="button" className="lk-sec-btn lk-no-arrastrar" aria-expanded={!plegada}
          aria-label={plegada ? `Abrir «${e.texto}»` : `Plegar «${e.texto}»`} title={plegada ? 'Abrir' : 'Plegar'}
          onMouseDown={parar} onPointerDown={parar} onTouchStart={parar}
          onClick={(ev) => { ev.stopPropagation(); estado.onPlegar?.(); }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
      <span className="lk-sec-tit" style={estilo} title={e.texto}>{e.texto}</span>
      {plegada && estado && estado.miembros > 0 && <span className="lk-sec-cuenta">{estado.miembros} {estado.miembros === 1 ? 'pieza' : 'piezas'}</span>}
    </div>
  );
}

/**
 * Los fondos de las secciones: detrás de las tarjetas, del tope de la sección hasta donde termina su grupo (en
 * filas YA DIBUJADAS: lo plegado no cuenta). Un poco más anchos que la grilla, para que el grupo respire.
 */
export function FondosSecciones({ fondos, colores, ancho, fila, margen }: {
  fondos: ReadonlyArray<{ id: string; fondo: number; y: number; filas: number }>;
  colores: readonly string[];
  ancho: number;
  fila: number;
  margen: number;
}) {
  if (!fondos.length || !(ancho > 0)) return null;
  const params = { cols: COLS, rowHeight: fila, margin: [margen, margen] as const, containerPadding: [0, 0] as const, containerWidth: ancho, maxRows: Number.POSITIVE_INFINITY };
  return (
    <div className="lk-fondos" aria-hidden>
      {fondos.map((f) => {
        const p = calcGridItemPosition(params, 0, f.y, COLS, f.filas);
        const color = colores[f.fondo] ?? 'var(--surface-2)';
        return (
          <div key={f.id} className="lk-fondo"
            style={{ top: p.top - 10, height: p.height + 20, background: `color-mix(in srgb, ${color} 9%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 18%, transparent)` }} />
        );
      })}
    </div>
  );
}

/** Lo de la sección en el panel: el título, el fondo (la paleta de la hoja), si se pliega y cómo arranca. */
export function PropsSeccion({ e, colores, onCambiar, Titulo }: {
  e: Elemento;
  colores: readonly string[];
  onCambiar: (p: Partial<Elemento>) => void;
  /** El bloque de una sección del panel (el de Elemento.tsx, con su título y su filete). */
  Titulo: (p: { titulo?: string; children: ReactNode }) => ReactNode;
}) {
  const sec = e.seccion ?? { fondo: null, plegable: false, abierto: true };
  const cambiarSec = (p: Partial<NonNullable<Elemento['seccion']>>) => onCambiar({ seccion: { ...sec, ...p } });
  const paleta = colores.slice(0, 8);
  const anillo = '0 0 0 2px var(--surface), 0 0 0 4px var(--ink)';
  return (
    <>
      <Titulo titulo="Fondo">
        <div role="group" aria-label="Fondo" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <button type="button" aria-pressed={sec.fondo == null} title="Sin fondo" aria-label="Sin fondo" onClick={() => cambiarSec({ fondo: null })}
            style={{ width: 26, height: 26, padding: 0, borderRadius: 999, cursor: 'pointer', border: '1px dashed var(--border-strong)', background: 'transparent', boxShadow: sec.fondo == null ? anillo : 'none' }} />
          {paleta.map((c, i) => (
            <button key={i} type="button" aria-pressed={sec.fondo === i} title={`Color ${i + 1}`} aria-label={`Color ${i + 1}`} onClick={() => cambiarSec({ fondo: i })}
              style={{ width: 26, height: 26, padding: 0, borderRadius: 999, cursor: 'pointer', border: '1px solid var(--border)', background: c, boxShadow: sec.fondo === i ? anillo : 'none' }} />
          ))}
        </div>
      </Titulo>
      <Titulo>
        <Switch checked={sec.plegable} onChange={(v) => cambiarSec({ plegable: v, abierto: v ? sec.abierto : true })} label="Se puede plegar" />
        {sec.plegable && <Switch checked={!sec.abierto} onChange={(v) => cambiarSec({ abierto: !v })} label="Arranca plegada" />}
      </Titulo>
    </>
  );
}
