'use client';

// =============================================================================
// Conectores — la capa de flechas que UNEN tarjetas del Dashboard, y su panel (tanda v5, punto 11)
// =============================================================================
// Martín (12/10/2026): una línea o una flecha de antes no sabía de ningún bloque; si se movía una tarjeta, la
// flecha quedaba donde estaba. Un conector (`Hoja.conectores`) une dos componentes por id y esta capa lo dibuja
// ENCIMA de la grilla, siguiéndolos. La geometría es pura y tiene test (lib/graficos-conectores.ts).
//
// Lo que no se ve en la firma:
//   · DE DÓNDE SALEN LAS POSICIONES. En reposo, del layout DIBUJADO (filas, con lo plegado afuera) pasado a
//     píxeles con `calcGridItemPosition`, la MISMA cuenta que hace react-grid-layout. DURANTE un arrastre o un
//     estirado (entre onDragStart/onResizeStart y su Stop) la tarjeta que se mueve no está en el layout sino
//     donde está el cursor: ahí se leen los `getBoundingClientRect` de cada `[data-comp]` en un
//     requestAnimationFrame y se escriben los `d` por ref. NUNCA un setState por píxel: redibujaría la hoja
//     sesenta veces por segundo. (Es un gesto de pointer, no HTML5 drag-and-drop: el rAF sí corre.)
//   · LA CAPA NO SE TRAGA LOS CLICS: `pointer-events: none`, salvo el trazo de cada conector (editando, para
//     elegirlo), el botón de borrar del elegido y los cuatro tiradores de la tarjeta elegida.
//   · EL TIRADOR captura el puntero (`setPointerCapture`): con la captura, el `pointerup` llega al tirador y
//     no a la tarjeta de abajo, así que el destino se busca con `elementsFromPoint` en el punto donde se soltó.
//     Y frena el click: si no, burbujea hasta el lienzo y suelta la selección.

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { calcGridItemPosition } from 'react-grid-layout/core';
import { BotonBorrar, BotonCerrar } from '@/app/_ui/BotonBorrar';
import { COLS, type Conector } from '@/lib/graficos-catalogo';
import { geometriaConector, puntoDeLado, type Caja, type Lado } from '@/lib/graficos-conectores';
import { TINTA } from './Elemento';

type Celda = { x: number; y: number; w: number; h: number };
type Refs = { halo: SVGPathElement | null; linea: SVGPathElement | null; toque: SVGPathElement | null; puntas: Array<SVGPolygonElement | null> };

const LADOS: readonly Lado[] = ['arr', 'der', 'aba', 'izq'];
const colorDe = (k: Pick<Conector, 'color'>, colores: readonly string[]) => (k.color == null ? TINTA : colores[k.color] ?? TINTA);
const sel = (id: string) => `[data-comp="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id}"]`;

export function CapaConectores({
  conectores, cajas, ancho, fila, margen, colores, editando, seleccionado, onElegir, onBorrar, enGesto, contenedor, tiradoresDe, onUnir,
}: {
  conectores: readonly Conector[];
  /** Lo DIBUJADO (filas de la grilla, sin lo plegado), por id. Un conector con una punta afuera no se dibuja. */
  cajas: ReadonlyMap<string, Celda>;
  ancho: number;
  fila: number;
  margen: number;
  colores: readonly string[];
  editando: boolean;
  seleccionado: string | null;
  onElegir: (id: string) => void;
  onBorrar: (id: string) => void;
  /** Mientras se arrastra o se estira una tarjeta: la capa sigue al DOM en un rAF. */
  enGesto: boolean;
  /** El que envuelve a la grilla (el origen de las coordenadas). */
  contenedor: RefObject<HTMLDivElement | null>;
  /** La tarjeta elegida (editando): lleva los cuatro tiradores para unirla con otra. */
  tiradoresDe: string | null;
  onUnir: (desde: string, hasta: string) => void;
}) {
  const refs = useRef(new Map<string, Refs>());
  const temp = useRef<SVGPathElement>(null);
  // Los nodos de cada conector, por callback ref (corren al montar, no al dibujar): el rAF del gesto los escribe.
  const nodos = (id: string): Refs => {
    let r = refs.current.get(id);
    if (!r) { r = { halo: null, linea: null, toque: null, puntas: [] }; refs.current.set(id, r); }
    return r;
  };
  const params = { cols: COLS, rowHeight: fila, margin: [margen, margen] as const, containerPadding: [0, 0] as const, containerWidth: ancho, maxRows: Number.POSITIVE_INFINITY };
  const cajaDe = (id: string): Caja | null => {
    const c = cajas.get(id);
    if (!c || !(ancho > 0)) return null;
    const p = calcGridItemPosition(params, c.x, c.y, c.w, c.h);
    return { left: p.left, top: p.top, width: p.width, height: p.height };
  };

  // Durante el gesto, las posiciones salen del DOM en cada cuadro (sin setState).
  useEffect(() => {
    if (!enGesto) return;
    let cuadro = 0;
    const paso = () => {
      const cont = contenedor.current;
      if (cont) {
        const base = cont.getBoundingClientRect();
        const rel = (r: DOMRect): Caja => ({ left: r.left - base.left, top: r.top - base.top, width: r.width, height: r.height });
        for (const k of conectores) {
          const els = refs.current.get(k.id);
          const a = cont.querySelector(sel(k.desde)), b = cont.querySelector(sel(k.hasta));
          if (!els || !a || !b) continue;
          const geo = geometriaConector(rel(a.getBoundingClientRect()), rel(b.getBoundingClientRect()), k.trazo, k.punta);
          els.halo?.setAttribute('d', geo.d);
          els.linea?.setAttribute('d', geo.d);
          els.toque?.setAttribute('d', geo.d);
          els.puntas.forEach((p, i) => p?.setAttribute('points', geo.puntas[i] ?? ''));
        }
      }
      cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [enGesto, conectores, contenedor]);

  const dibujados = conectores.flatMap((k) => {
    const a = cajaDe(k.desde), b = cajaDe(k.hasta);
    return a && b ? [{ k, geo: geometriaConector(a, b, k.trazo, k.punta) }] : [];
  });
  const alto = [...cajas.values()].reduce((m, c) => {
    const p = calcGridItemPosition(params, c.x, c.y, c.w, c.h);
    return Math.max(m, p.top + p.height);
  }, 0);
  const elegido = dibujados.find((d) => d.k.id === seleccionado);
  const cajaTirador = editando && !enGesto && tiradoresDe ? cajaDe(tiradoresDe) : null;

  /** Arrastrar desde un tirador hasta otra tarjeta. La línea que sigue al cursor se escribe por ref. */
  const alApretar = (lado: Lado) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    const cont = contenedor.current;
    if (!cont || !tiradoresDe || !cajaTirador || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const desde = tiradoresDe;
    const p0 = puntoDeLado(cajaTirador, lado);
    const boton = e.currentTarget;
    try { boton.setPointerCapture(e.pointerId); } catch { /* sin captura, igual llegan los eventos del botón */ }
    const mover = (ev: PointerEvent) => {
      const base = cont.getBoundingClientRect();
      temp.current?.setAttribute('d', `M ${p0.x} ${p0.y} L ${ev.clientX - base.left} ${ev.clientY - base.top}`);
    };
    const terminar = (ev: PointerEvent, unir: boolean) => {
      boton.removeEventListener('pointermove', mover);
      boton.removeEventListener('pointerup', alSoltar);
      boton.removeEventListener('pointercancel', alCancelar);
      try { boton.releasePointerCapture(ev.pointerId); } catch { /* ya se soltó */ }
      temp.current?.setAttribute('d', '');
      if (!unir) return;
      const destino = document.elementsFromPoint(ev.clientX, ev.clientY)
        .map((el) => (el as HTMLElement).closest?.('[data-comp]') as HTMLElement | null)
        .find((el) => !!el && cont.contains(el) && el.getAttribute('data-comp') !== desde);
      const id = destino?.getAttribute('data-comp');
      if (id) onUnir(desde, id);
    };
    const alSoltar = (ev: PointerEvent) => terminar(ev, true);
    const alCancelar = (ev: PointerEvent) => terminar(ev, false);
    boton.addEventListener('pointermove', mover);
    boton.addEventListener('pointerup', alSoltar);
    boton.addEventListener('pointercancel', alCancelar);
  };

  if (!dibujados.length && !cajaTirador) return null;
  return (
    <div className="lk-conectores">
      <svg width={Math.max(1, ancho)} height={Math.max(1, alto)} aria-hidden>
        {dibujados.map(({ k, geo }) => {
          const color = colorDe(k, colores);
          return (
            <g key={k.id} className="lk-con-g" data-sel={k.id === seleccionado || undefined} style={{ color }}>
              <path ref={(el) => { nodos(k.id).halo = el; }} className="lk-con-halo" d={geo.d} />
              <path ref={(el) => { nodos(k.id).linea = el; }} className="lk-con" d={geo.d} stroke="currentColor" />
              {geo.puntas.map((pts, i) => (
                <polygon key={i} ref={(el) => { nodos(k.id).puntas[i] = el; }} points={pts} fill="currentColor" stroke="var(--bg)" strokeWidth={1.5} />
              ))}
              {editando && (
                <path ref={(el) => { nodos(k.id).toque = el; }} className="lk-con-toque" d={geo.d}
                  onClick={(ev) => { ev.stopPropagation(); onElegir(k.id); }} />
              )}
            </g>
          );
        })}
        <path ref={temp} className="lk-con-temp" d="" />
      </svg>
      {editando && !enGesto && elegido && (
        <span className="lk-con-borrar" style={{ left: elegido.geo.medio.x, top: elegido.geo.medio.y }} onClick={(e) => e.stopPropagation()}>
          <BotonBorrar talla="sm" title="Quitar el conector" onClick={(e) => { e.stopPropagation(); onBorrar(elegido.k.id); }} />
        </span>
      )}
      {cajaTirador && LADOS.map((lado) => {
        const p = puntoDeLado(cajaTirador, lado);
        return (
          <button key={lado} type="button" className="lk-tirador" style={{ left: p.x, top: p.y }} aria-label="Unir con otra tarjeta" title="Arrastra hasta otra tarjeta"
            onPointerDown={alApretar(lado)} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} />
        );
      })}
    </div>
  );
}

const TRAZOS: ReadonlyArray<{ id: Conector['trazo']; nombre: string }> = [{ id: 'curva', nombre: 'Curva' }, { id: 'recta', nombre: 'Recta' }, { id: 'codo', nombre: 'Codo' }];
const PUNTAS: ReadonlyArray<{ id: Conector['punta']; nombre: string }> = [{ id: 'fin', nombre: 'Al final' }, { id: 'ambas', nombre: 'Las dos' }, { id: 'ninguna', nombre: 'Sin punta' }];

/** El panel de un conector elegido: el trazo, la punta, el color y quitarlo. */
export function PropsConector({ k, colores, onCambiar, onBorrar, onCerrar }: {
  k: Conector;
  colores: readonly string[];
  onCambiar: (p: Partial<Conector>) => void;
  onBorrar: () => void;
  onCerrar: () => void;
}) {
  const paleta = colores.slice(0, 8);
  const anillo = '0 0 0 2px var(--surface), 0 0 0 4px var(--ink)';
  return (
    <>
      <div className="lk-props-cab">
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden><path d="M5 18c6 0 8-12 14-12" /><path d="m15 4 4 2-2 4" /></svg>
        <span className="lk-props-nombre">Conector</span>
        <BotonCerrar onClick={onCerrar} title="Cerrar el panel" talla="sm" />
      </div>
      <div className="lk-secciones">
        <div className="lk-seccion">
          <div className="lk-seccion-tit">Trazo</div>
          <div className="lk-seg" role="group" aria-label="Trazo">
            {TRAZOS.map((t) => <button key={t.id} type="button" aria-pressed={k.trazo === t.id} onClick={() => onCambiar({ trazo: t.id })}>{t.nombre}</button>)}
          </div>
        </div>
        <div className="lk-seccion">
          <div className="lk-seccion-tit">Punta</div>
          <div className="lk-seg" role="group" aria-label="Punta">
            {PUNTAS.map((t) => <button key={t.id} type="button" aria-pressed={k.punta === t.id} onClick={() => onCambiar({ punta: t.id })}>{t.nombre}</button>)}
          </div>
        </div>
        <div className="lk-seccion">
          <div className="lk-seccion-tit">Color</div>
          <div role="group" aria-label="Color" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <button type="button" aria-pressed={k.color == null} title="Tinta" aria-label="Tinta" onClick={() => onCambiar({ color: null })}
              style={{ width: 26, height: 26, padding: 0, borderRadius: 999, cursor: 'pointer', border: '1px solid var(--border)', background: TINTA, boxShadow: k.color == null ? anillo : 'none' }} />
            {paleta.map((c, i) => (
              <button key={i} type="button" aria-pressed={k.color === i} title={`Color ${i + 1}`} aria-label={`Color ${i + 1}`} onClick={() => onCambiar({ color: i })}
                style={{ width: 26, height: 26, padding: 0, borderRadius: 999, cursor: 'pointer', border: '1px solid var(--border)', background: c, boxShadow: k.color === i ? anillo : 'none' }} />
            ))}
          </div>
        </div>
        <div className="lk-botones">
          <BotonBorrar onClick={onBorrar} texto="Quitar" title="Quitar el conector" talla="md" />
        </div>
      </div>
    </>
  );
}
