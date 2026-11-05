'use client';

// =============================================================================
// MejoresPiezas — «Lo que mejor le fue», el bloque que cierra el riel (4/11/2026)
// =============================================================================
// Martín: «al lado de "¿Qué formatos le funcionan?" debería ir otro bloque con algo más hasta cubrir el final de "¿Qué formatos le
// funcionan?", porque sino queda vacío». El riel termina antes que el gráfico y sus formatos: este bloque ocupa lo que queda.
//
// ⚠️ CUÁNTAS FILAS LO DECIDE EL LUGAR, NO AL REVÉS. La tarjeta va en `position: absolute` dentro de una caja que estira la columna
// (`flex: 1`): así no le suma alto al riel —si se lo sumara, la grilla crecería por él y el bloque nunca «llegaría» al final—. Se
// mide el alto que quedó y se dibujan las filas ENTERAS que entran (con un piso de 3). En el teléfono (columna sola) la caja vuelve
// a fluir y se ven 5.
//
// El orden es por su múltiplo (`mejoresPiezas`, lib/spy-detalle.ts, que usa la única cuenta: lib/multiplo-rendimiento.ts): cada
// pieza contra las de su formato, así un short y un video largo no se comparan en vistas crudas. Tocar una fila abre su detalle.
// =============================================================================

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dibujarContador } from '@/lib/spy-reglas';
import { mejoresPiezas, type PiezaDestacada } from '@/lib/spy-detalle';
import { chipDeMultiplo, esFuerte, explicarMultiplo } from '@/lib/multiplo-rendimiento';
import { miniaturaDePieza } from '@/lib/spy-vista';
import type { PiezaVista } from './actions';
import { LogoRed } from './LogoRed';

/** El alto de una fila (miniatura de 44 + aire) y lo que ocupa la cabecera de la tarjeta. Los mismos del CSS de abajo. */
const ALTO_FILA = 60;
const CABECERA = 64;
const MINIMO = 3;
const EN_TELEFONO = 5;

const redDe = (canal: string): 'instagram' | 'youtube' | null => (canal === 'instagram' || canal === 'youtube' ? canal : null);
const QUE_SE_MIDE = { vistas: 'vistas', interaccion: 'me gusta y comentarios', dias: 'días activo' } as const;

export function MejoresPiezas({ piezas, onAbrir }: { piezas: readonly PiezaVista[]; onAbrir: (p: PiezaVista) => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const [caben, setCaben] = useState(MINIMO);
  const todas = useMemo(() => mejoresPiezas(piezas, 30), [piezas]);
  const porId = useMemo(() => new Map(piezas.map((p) => [p.id, p])), [piezas]);

  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => {
      // En una columna sola la caja fluye (`position: static`): ahí no hay nada que llenar.
      const fluye = getComputedStyle(el).getPropertyValue('--mejores-fluye').trim() === '1';
      setCaben(fluye ? EN_TELEFONO : Math.max(MINIMO, Math.floor((el.clientHeight - CABECERA) / ALTO_FILA)));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!todas.length) return null;
  const filas = todas.slice(0, caben);
  return (
    <div ref={caja} className="spy-mejores">
      <section className="spy-mejores__tarjeta" aria-label="Lo que mejor le fue" data-recorrido="spy-mejores">
        <h3>Lo que mejor le fue</h3>
        <ol>
          {filas.map((d) => <Fila key={d.id} d={d} p={porId.get(d.id)} onAbrir={onAbrir} />)}
        </ol>
      </section>
    </div>
  );
}

function Fila({ d, p, onAbrir }: { d: PiezaDestacada; p: PiezaVista | undefined; onAbrir: (p: PiezaVista) => void }) {
  if (!p) return null;
  const mini = miniaturaDePieza(p);
  const red = redDe(p.canal);
  const titulo = p.titulo || p.analisis?.gancho || p.texto || 'Sin texto';
  return (
    <li>
      <button type="button" onClick={() => onAbrir(p)}>
        <span className="spy-mejores__mini">
          {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de un tercero, ya bajada por el gráfico */}
          {mini && <img src={mini} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.remove(); }} />}
          {red && <span className="spy-mejores__red"><LogoRed red={red} box={12} /></span>}
        </span>
        <span className="spy-mejores__texto">
          <b>{titulo}</b>
          <small>{dibujarContador(d.valor)} {QUE_SE_MIDE[d.metrica]}</small>
        </span>
        <span className="spy-mejores__veces" data-alto={esFuerte(d.multiplo)} title={explicarMultiplo(d.multiplo)}>{chipDeMultiplo(d.multiplo)}</span>
      </button>
    </li>
  );
}
