'use client';

// =============================================================================
// Grafo — el mapa del segundo cerebro: lo que MaKo entendió del negocio
// =============================================================================
// El lenguaje visual es el de Obsidian, y no de oído: los valores salieron de bajar
// su `app.css` y su `app.js` reales y leer el puente CSS→WebGL, el `render()` del
// nodo y el de la arista. Las cuatro cosas que más definen ese lenguaje, y que son
// justo las que la primera versión tenía al revés:
//
//  1. TODOS LOS NODOS SON DEL MISMO GRIS. En Obsidian el color marca EXCEPCIONES
//     —el nodo activo, un link roto, un tag— y una nota normal siempre cae en
//     `--graph-node`. Acá el 88% de los nodos era dorado, o sea que el color decía
//     «esto es lo normal». Ahora el color no gris son tres nodos de cuarenta: la
//     raíz, el Norte y el cuello.
//  2. EL NODO ES UN CÍRCULO PLANO. Sin borde, sin sombra, sin gradiente, sin
//     punteado. Ni siquiera el «no existe todavía»: eso en Obsidian es el MISMO
//     círculo relleno, más apagado (opacidad 0,5).
//  3. LA ARISTA NO ES TRANSLÚCIDA. Va a alpha 1 y lo que la hace tenue es el COLOR,
//     a dos escalones del fondo. Y se dibuja borde a borde, no centro a centro.
//  4. LA ETIQUETA NO TIENE HALO. Va debajo del punto, centrada, sin contorno ni
//     sombra, y se ven TODAS: el fade es por zoom y a zoom 1 vale 1.
//
// LAS POSICIONES NO SE CALCULAN ACÁ. Vienen del servidor, ya asentadas
// (lib/cerebro-layout.ts). Es lo que mantiene d3-force fuera del bundle del browser.
//
// DOS REGLAS QUE SE ROMPEN SOLAS SI NO SE SABEN:
//  · El transform del zoom NO va como prop de JSX: va con setAttribute sobre un ref
//    dentro de un rAF. Si además se renderiza como prop, el próximo render lo pisa
//    con el valor viejo del vdom y el mapa salta hacia atrás.
//  · `onWheel` de JSX no puede preventDefault: react-dom 19 registra `wheel`,
//    `touchstart` y `touchmove` con { passive: true }.
// =============================================================================

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { AREAS, radioNodo, type Cerebro, type NodoCerebro, type AreaId, type Punto } from '@/lib/cerebro-modelo';
import { MONO } from '@/app/_ui/tokens';

const K_MIN = 0.5;
const K_MAX = 4;
/** Umbral de clic vs arrastre, en px de pantalla al cuadrado (5 px, como Obsidian). */
const ARRASTRE2 = 25;
/** La `Rl` de Obsidian: cuánto se apaga lo que no toca al nodo en foco. */
const ATENUADO = 0.2;
/** El «no existe todavía»: mismo círculo relleno, más apagado (`--graph-node-unresolved`). */
const PENDIENTE = 0.5;

type Vista = { k: number; x: number; y: number };

export function Grafo({ cerebro }: { cerebro: Cerebro }) {
  const { nodos, aristas, cuenta, posiciones, encuadre } = cerebro;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const vista = useRef<Vista>({ k: 1, x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const [kPaso, setKPaso] = useState(1);
  const [activo, setActivo] = useState<string | null>(null);
  const [fijado, setFijado] = useState<string | null>(null);
  const [areaFoco, setAreaFoco] = useState<AreaId | null>(null);

  const porId = useMemo(() => new Map(nodos.map((n) => [n.id, n])), [nodos]);

  const grados = useMemo(() => {
    const g: Record<string, number> = {};
    for (const n of nodos) g[n.id] = 0;
    for (const a of aristas) { if (a.de in g) g[a.de]++; if (a.a in g) g[a.a]++; }
    return g;
  }, [nodos, aristas]);

  const vecinos = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => { const s = m.get(a) ?? new Set<string>(); s.add(b); m.set(a, s); };
    for (const e of aristas) { add(e.de, e.a); add(e.a, e.de); }
    return m;
  }, [aristas]);

  const sel = fijado ?? activo;
  const nodoSel = sel ? porId.get(sel) ?? null : null;
  const cerca = useMemo(() => (sel ? new Set([sel, ...(vecinos.get(sel) ?? [])]) : null), [sel, vecinos]);

  // El fade de etiquetas de Obsidian: `clamp(log2(zoom) + 1 − textFadeMult, 0, 1)`.
  // Con los defaults da 1 a zoom 1, o sea que se dibujan TODAS y se dejan pisar. La
  // versión anterior repartía un presupuesto por importancia y mostraba 13 de 42: un
  // lienzo con el 31% de los puntos nombrados no se puede parecer a uno con el 100%.
  const alphaEtiqueta = Math.min(1, Math.max(0, Math.log2(kPaso) + 1));

  const aplicar = useCallback(() => {
    rafRef.current = null;
    const g = gRef.current;
    if (!g) return;
    const v = vista.current;
    g.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.k})`);
    g.style.setProperty('--k', String(v.k));
    const paso = Math.round(v.k * 4) / 4;
    setKPaso((prev) => (prev === paso ? prev : paso));
  }, []);

  const pedirPintado = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(aplicar);
  }, [aplicar]);

  /** Un punto de pantalla a coordenadas del viewBox. `getScreenCTM` fuerza layout: se
   *  llama una vez por gesto, no por frame. */
  const aMundo = useCallback((cx: number, cy: number): Punto | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = svg.createSVGPoint();
    p.x = cx; p.y = cy;
    const q = p.matrixTransform(ctm.inverse());
    return { x: q.x, y: q.y };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = aMundo(e.clientX, e.clientY);
      if (!pt) return;
      const unidad = e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002;
      const factor = Math.pow(2, -e.deltaY * unidad * (e.ctrlKey ? 10 : 1));
      const v = vista.current;
      const k = Math.min(K_MAX, Math.max(K_MIN, v.k * factor));
      // La invariante del zoom anclado: el punto del mundo bajo el cursor no se mueve.
      const mx = (pt.x - v.x) / v.k;
      const my = (pt.y - v.y) / v.k;
      vista.current = { k, x: pt.x - mx * k, y: pt.y - my * k };
      pedirPintado();
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [aMundo, pedirPintado]);

  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const arrastre = useRef<{ x0: number; y0: number; vx: number; vy: number; movido: boolean } | null>(null);
  const pellizco = useRef<{ d0: number; k0: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size === 1) {
      const v = vista.current;
      arrastre.current = { x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y, movido: false };
    } else if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      pellizco.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: vista.current.k };
      arrastre.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pellizco.current && punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const medio = aMundo((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (!medio) return;
      const v = vista.current;
      const k = Math.min(K_MAX, Math.max(K_MIN, pellizco.current.k0 * (d / pellizco.current.d0)));
      const mx = (medio.x - v.x) / v.k;
      const my = (medio.y - v.y) / v.k;
      vista.current = { k, x: medio.x - mx * k, y: medio.y - my * k };
      pedirPintado();
      return;
    }

    const arr = arrastre.current;
    if (!arr) return;
    const dx = e.clientX - arr.x0;
    const dy = e.clientY - arr.y0;
    if (!arr.movido && dx * dx + dy * dy <= ARRASTRE2) return;
    arr.movido = true;
    const caja = svgRef.current?.getBoundingClientRect();
    if (!caja) return;
    const escala = encuadre.lado / caja.width;
    vista.current = { ...vista.current, x: arr.vx + dx * escala, y: arr.vy + dy * escala };
    pedirPintado();
  };

  const soltar = (e: React.PointerEvent<SVGSVGElement>) => {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size < 2) pellizco.current = null;
    if (punteros.current.size === 0) {
      if (arrastre.current && !arrastre.current.movido) setFijado(null);
      arrastre.current = null;
    }
  };

  const clicNodo = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (arrastre.current?.movido) return;
    setFijado((f) => (f === id ? null : id));
  };

  const areaDe = (id: AreaId) => AREAS.find((a) => a.id === id)!;
  const kr = Math.sqrt(kPaso);
  const vb = `${encuadre.x} ${encuadre.y} ${encuadre.lado} ${encuadre.lado}`;

  /** Radio EN PANTALLA. `nodeScale = √(1/zoom)` de Obsidian: los nodos resisten el
   *  zoom out en vez de desaparecer. */
  const radioDe = (n: NodoCerebro) => radioNodo(grados[n.id] ?? 0) / kr;

  /** El relleno. Tres nodos de color en todo el mapa; el resto, un solo gris. */
  const rellenoDe = (n: NodoCerebro, esSel: boolean): string => {
    if (esSel) return 'var(--mako-lite)';
    if (n.id === 'raiz') return 'var(--on-sidebar)';
    if (n.destacado) return 'var(--mako)';
    if (n.alerta) return 'var(--warn-fill)';
    return 'var(--sidebar-text)';
  };

  const opacidadDe = (n: NodoCerebro): number => {
    const base = n.autoria === 'pendiente' ? PENDIENTE : 1;
    if (n.id === 'raiz') return base;
    if (cerca) return cerca.has(n.id) ? base : ATENUADO;
    if (areaFoco) return n.area === areaFoco ? base : ATENUADO;
    return base;
  };

  return (
    <div className="cbg">
      <style>{`
        .cbg .cbg-lienzo { background: var(--sidebar); border-radius: 12px; overflow: hidden; }
        .cbg svg { width: 100%; height: auto; display: block; aspect-ratio: 4/3; touch-action: none; cursor: grab; }
        .cbg svg:active { cursor: grabbing; }
        .cbg .cbg-nodo { cursor: pointer; }
        .cbg .cbg-nodo circle, .cbg .cbg-arista, .cbg .cbg-et { transition: opacity .18s ease, fill .18s ease, stroke .18s ease; }
        /* Sin halo, sin contorno, sin sombra, sin bold: Obsidian no tiene nada de eso. */
        .cbg .cbg-et {
          font-size: calc(12px / var(--k, 1));
          fill: var(--on-sidebar);
          pointer-events: none;
        }
        .cbg .cbg-entra { animation: cbg-in .55s cubic-bezier(.23,1,.32,1) backwards; }
        @keyframes cbg-in { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .cbg .cbg-entra { animation: none; }
          .cbg .cbg-nodo circle, .cbg .cbg-arista, .cbg .cbg-et { transition: none; }
        }
        @media (max-width: 900px) {
          .cbg .cbg-cols { grid-template-columns: minmax(0,1fr) !important; }
          .cbg .cbg-cols > aside { position: static !important; }
        }
      `}</style>

      <div className="cbg-cols" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 20, alignItems: 'start' }}>
        <div className="cbg-lienzo">
          <svg
            ref={svgRef}
            viewBox={vb}
            role="img"
            aria-label={`Mapa del segundo cerebro: ${cuenta.total} cosas que MaKo entendió de tu negocio`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            onPointerLeave={soltar}
          >
            <g ref={gRef} style={{ ['--k' as string]: 1 }}>
              <g fill="none">
                {aristas.map((e, i) => {
                  const a = posiciones[e.de];
                  const b = posiciones[e.a];
                  const na = porId.get(e.a);
                  const nb = porId.get(e.de);
                  if (!a || !b || !na || !nb) return null;
                  // Borde a borde, como Obsidian: la línea arranca en el perímetro de
                  // un nodo y termina en el del otro, no en sus centros.
                  const dx = b.x - a.x;
                  const dy = b.y - a.y;
                  const d = Math.hypot(dx, dy) || 1;
                  const ra = radioDe(nb);
                  const rb = radioDe(na);
                  if (d <= ra + rb) return null;
                  const x1 = a.x + (dx / d) * ra;
                  const y1 = a.y + (dy / d) * ra;
                  const x2 = b.x - (dx / d) * rb;
                  const y2 = b.y - (dy / d) * rb;
                  const viva = cerca ? cerca.has(e.de) && cerca.has(e.a) : true;
                  const enFoco = areaFoco ? na.area === areaFoco || nb.area === areaFoco : true;
                  const op = cerca ? (viva ? 1 : ATENUADO) : areaFoco ? (enFoco ? 1 : ATENUADO) : 1;
                  return (
                    <line
                      key={`${e.de}-${e.a}-${i}`}
                      className="cbg-arista"
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={viva && cerca ? 'var(--mako)' : 'var(--sidebar-line)'}
                      strokeWidth={1}
                      strokeOpacity={op}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>

              {nodos.map((n, i) => {
                const p = posiciones[n.id];
                if (!p) return null;
                const r = radioDe(n);
                const esSel = sel === n.id;
                return (
                  <g
                    key={n.id}
                    className="cbg-nodo cbg-entra"
                    style={{ animationDelay: `${Math.min(i * 12, 700)}ms` }}
                    onMouseEnter={() => setActivo(n.id)}
                    onMouseLeave={() => setActivo(null)}
                    onClick={clicNodo(n.id)}
                  >
                    <circle cx={p.x} cy={p.y} r={Math.max(r + 8 / kr, 16 / kr)} fill="transparent" />
                    <circle
                      cx={p.x} cy={p.y} r={r}
                      fill={rellenoDe(n, esSel)}
                      opacity={opacidadDe(n)}
                    />
                    {/* El único anillo del grafo, y va PEGADO al borde: 1 px de pantalla. */}
                    {esSel && (
                      <circle cx={p.x} cy={p.y} r={r + 1.2 / kr} fill="none" stroke="var(--mako-lite)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    )}
                    {(alphaEtiqueta > 0.02 || esSel) && (
                      <text
                        className="cbg-et"
                        x={p.x}
                        y={p.y + r + 6 / kr}
                        textAnchor="middle"
                        dominantBaseline="hanging"
                        opacity={esSel ? 1 : alphaEtiqueta * opacidadDe(n)}
                      >
                        {n.etiqueta}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <aside style={{ position: 'sticky', top: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, minHeight: 210 }}>
            {nodoSel ? (
              <>
                {/* El nombre del área es el control que reemplaza a los rótulos que
                    flotaban en el lienzo: filtra sin ensuciar el dibujo. */}
                <button
                  type="button"
                  onClick={() => setAreaFoco(areaFoco === nodoSel.area ? null : nodoSel.area)}
                  style={{
                    fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
                    color: areaFoco === nodoSel.area ? 'var(--mako-ink)' : 'var(--faint)',
                    background: 'none', border: 'none', padding: 0, marginBottom: 8, cursor: 'pointer',
                  }}
                >
                  {areaDe(nodoSel.area).nombre}
                </button>
                <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 8 }}>
                  {nodoSel.etiqueta}
                </div>
                <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                  {nodoSel.detalle}
                </p>
                {nodoSel.fuente && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>
                    {nodoSel.fuente}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)', marginBottom: 8 }}>
                  MaKo entendió {cuenta.total} {cuenta.total === 1 ? 'cosa' : 'cosas'} de tu negocio
                </div>
                <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>
                  {cuenta.mako} las dedujo de tus documentos y tus cuentas conectadas. {cuenta.usuario} las escribiste tú.
                  {cuenta.pendientes > 0 && ` Quedan ${cuenta.pendientes} ${cuenta.pendientes === 1 ? 'área' : 'áreas'} sin construir.`}
                </p>
                <p style={{ margin: '12px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--faint)', lineHeight: 1.55 }}>
                  Pasa el cursor por un punto para leerlo, haz clic para fijarlo, arrastra para mover el mapa y usa la rueda para acercarte.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
