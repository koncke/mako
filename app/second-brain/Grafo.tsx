'use client';

// =============================================================================
// Grafo — el mapa del segundo cerebro: lo que MaKo entendió del negocio
// =============================================================================
// El lenguaje visual sale de leer el `app.js`, el `app.css` y el worker reales de
// Obsidian. Lo que hay que saber antes de tocar nada:
//
// 1. TRES GRUPOS ANIDADOS POR NODO, Y NO ES CAPRICHO. Una animación CSS sobre
//    `transform` GANA en la cascada contra un `transform` escrito por JS. Si la
//    posición y la flotación vivieran en el mismo `<g>`, la flotación ganaría y el
//    nodo quedaría clavado en su keyframe — sin error, sin warning, y con el mapa
//    aparentando estar vivo porque flota. Un dueño por grupo:
//      · el de afuera lleva la POSICIÓN (la escribe la física con setAttribute)
//      · el del medio, la FLOTACIÓN (CSS, GPU, 0 ms de main thread)
//      · el de adentro, el POP de entrada (CSS)
//
// 2. EL COLOR ES OPT-IN Y TIENE TOPE. Obsidian tiene seis slots de grupo y su valor
//    por defecto es el MISMO gris de un nodo normal: el sistema está cableado y viene
//    apagado. Acá igual — monocromo por defecto, y un grupo que el usuario enciende.
//    Y hay un techo medido: sobre este fondo (#14161B) solo hay dos tokens con más
//    contraste que el gris base (6,55:1) que no estén ya tomados. `--primary`,
//    `--good` y `--bad` quedan por DEBAJO del gris: un nodo marcado con ellos se
//    vería menos importante que uno sin marcar.
//
// 3. EL HOVER NO SE REPINTA. Obsidian sí lo hace, pero acá el color significa autoría
//    y taparlo justo en el nodo que estás mirando sería perder el dato. El foco se
//    marca con tres señales no cromáticas: anillo, escala y todo lo demás atenuado.
//
// 4. `onWheel` de JSX no puede preventDefault (react-dom 19 lo registra passive), y
//    el drag nativo del navegador hay que apagarlo a mano o se come el paneo.
// =============================================================================

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { AREAS, radioNodo, type Cerebro, type NodoCerebro, type AreaId, type Punto } from '@/lib/cerebro-modelo';
import type { NodoFisico, Simulacion } from './fisica';
import { MONO } from '@/app/_ui/tokens';

const K_MIN = 0.5;
const K_MAX = 4;
/** Umbral de clic vs arrastre, 5 px de pantalla al cuadrado (el mismo que Obsidian). */
const ARRASTRE2 = 25;
/** La `Rl` de Obsidian: cuánto se apaga lo que no toca al nodo en foco. */
const ATENUADO = 0.2;
/** El «todavía no existe»: mismo círculo relleno, más apagado. Nunca un aro punteado. */
const PENDIENTE = 0.5;

type Vista = { k: number; x: number; y: number };

/** El atributo `draggable` es de HTML y React lo rechaza en un `<svg>`, así que el
 *  drag-and-drop nativo se corta acá: sin esto, arrastrar sobre un nodo levanta el
 *  «fantasma» de imagen del navegador y mata el paneo a mitad del gesto. */
const frenarDragNativo = (e: React.DragEvent) => e.preventDefault();

/** FNV-1a, el mismo hash que usa la semilla del layout en el servidor: así el nodo
 *  flota con la misma fase en cada visita en vez de sortearla en cada carga. */
function hashDe(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

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
  const [grupoTuyo, setGrupoTuyo] = useState(false);

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

  // El fade de etiquetas de Obsidian: clamp(log2(zoom) + 1, 0, 1). A zoom 1 vale 1,
  // o sea que se dibujan TODAS y se dejan pisar.
  const alphaEtiqueta = Math.min(1, Math.max(0, Math.log2(kPaso) + 1));

  const radioMundo = useCallback((n: NodoCerebro) => radioNodo(grados[n.id] ?? 0), [grados]);
  const kr = Math.sqrt(kPaso);
  const radioDe = (n: NodoCerebro) => radioMundo(n) / kr;

  // ── El orden de entrada: por GRADO, no por índice del array ────────────────
  // Así el mapa se arma de adentro hacia afuera —la raíz y las áreas primero, las
  // hojas al final— y el ojo entiende la estructura antes de que llegue el detalle.
  // Por índice del array el orden no significaba nada.
  const ordenEntrada = useMemo(() => {
    const orden = [...nodos].sort((a, b) => {
      const d = (grados[b.id] ?? 0) - (grados[a.id] ?? 0);
      return d !== 0 ? d : a.id < b.id ? -1 : 1;   // desempate estable
    });
    return new Map(orden.map((n, i) => [n.id, i]));
  }, [nodos, grados]);

  // ── Color ──────────────────────────────────────────────────────────────────
  // Precedencia, de arriba abajo, el primero que matchea gana. Es la de Obsidian:
  // el color de grupo gana contra el tipo pero nunca tapa un estado interactivo.
  const rellenoDe = (n: NodoCerebro): string => {
    if (n.id === 'raiz') return 'var(--on-sidebar)';
    if (n.destacado) return 'var(--mako)';
    if (n.alerta) return 'var(--warn-fill)';
    if (grupoTuyo && n.autoria === 'usuario') return 'var(--primary-weak)';
    return 'var(--sidebar-text)';
  };

  const opacidadDe = (n: NodoCerebro): number => {
    const base = n.autoria === 'pendiente' ? PENDIENTE : 1;
    if (n.id === 'raiz') return base;
    if (cerca) return cerca.has(n.id) ? base : ATENUADO;
    if (areaFoco) return n.area === areaFoco ? base : ATENUADO;
    return base;
  };

  // ── Física viva (solo durante un gesto) ────────────────────────────────────
  const simRef = useRef<Simulacion | null>(null);
  const nodoRefs = useRef(new Map<string, SVGGElement | null>());
  const aristaRefs = useRef(new Map<number, SVGLineElement | null>());
  const arrastrando = useRef<string | null>(null);

  /** Escribe las posiciones en el DOM. NO pasa por React: un setState por frame
   *  durante un arrastre son 60 renders por segundo de 50 nodos. */
  const pintarFisica = useCallback((fisicos: NodoFisico[]) => {
    const pos = new Map(fisicos.map((f) => [f.id, f]));
    for (const [id, g] of nodoRefs.current) {
      const f = pos.get(id);
      if (g && f) g.setAttribute('transform', `translate(${f.x} ${f.y})`);
    }
    aristas.forEach((e, i) => {
      const l = aristaRefs.current.get(i);
      const a = pos.get(e.de);
      const b = pos.get(e.a);
      const na = porId.get(e.a);
      const nb = porId.get(e.de);
      if (!l || !a || !b || !na || !nb) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const ra = radioMundo(nb);
      const rb = radioMundo(na);
      l.setAttribute('x1', String(a.x + (dx / d) * ra));
      l.setAttribute('y1', String(a.y + (dy / d) * ra));
      l.setAttribute('x2', String(b.x - (dx / d) * rb));
      l.setAttribute('y2', String(b.y - (dy / d) * rb));
    });
  }, [aristas, porId, radioMundo]);

  useEffect(() => () => { simRef.current?.destruir(); simRef.current = null; }, []);

  /** Carga d3-force la primera vez que hace falta y nada más. */
  const asegurarSim = useCallback(async (): Promise<Simulacion | null> => {
    if (simRef.current) return simRef.current;
    const { crearSimulacion } = await import('./fisica');
    if (simRef.current) return simRef.current;   // por si dos gestos entraron a la vez
    simRef.current = await crearSimulacion(posiciones, pintarFisica);
    return simRef.current;
  }, [posiciones, pintarFisica]);

  // ── Zoom y paneo ───────────────────────────────────────────────────────────
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

  /** Un punto de pantalla a coordenadas del viewBox. `getScreenCTM` fuerza layout:
   *  se llama por gesto, no por frame. */
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

  /** Del viewBox al mundo, deshaciendo el zoom/paneo. */
  const aMundoReal = useCallback((cx: number, cy: number): Punto | null => {
    const p = aMundo(cx, cy);
    if (!p) return null;
    const v = vista.current;
    return { x: (p.x - v.x) / v.k, y: (p.y - v.y) / v.k };
  }, [aMundo]);

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
    // La captura va sobre el SVG, NO sobre `e.target`. Si se captura sobre el
    // `<circle>` que se tocó, el primer re-render de React lo reemplaza y la captura
    // se pierde a mitad del gesto: el paneo se corta solo.
    svgRef.current?.setPointerCapture?.(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size === 1) {
      const v = vista.current;
      arrastre.current = { x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y, movido: false };
    } else if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      pellizco.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: vista.current.k };
      arrastre.current = null;
      arrastrando.current = null;
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

    // Si el gesto empezó sobre un nodo, se arrastra el NODO. Si no, se panea el mapa.
    if (arrastrando.current) {
      const p = aMundoReal(e.clientX, e.clientY);
      if (p) simRef.current?.mover(p.x, p.y);
      return;
    }
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
      if (arrastrando.current) simRef.current?.soltar();
      else if (arrastre.current && !arrastre.current.movido) setFijado(null);
      arrastrando.current = null;
      arrastre.current = null;
    }
  };

  const agarrarNodo = (id: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    arrastrando.current = id;
    void asegurarSim().then((s) => { if (arrastrando.current === id) s?.agarrar(id); });
  };

  const clicNodo = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (arrastre.current?.movido) return;
    setFijado((f) => (f === id ? null : id));
  };

  const areaDe = (id: AreaId) => AREAS.find((a) => a.id === id)!;
  const vb = `${encuadre.x} ${encuadre.y} ${encuadre.lado} ${encuadre.lado}`;
  /** Amplitud de la flotación, en unidades de mundo. A zoom 1 son ~2 px de pantalla:
   *  arriba de 4 marea, abajo de 1 no se ve. */
  const flote = 3 / kr;

  return (
    <div className="cbg">
      <style>{`
        .cbg .cbg-lienzo { background: var(--sidebar); border-radius: 12px; overflow: hidden; }
        /* user-select y -webkit-user-drag NO son adorno: sin ellos, arrastrar sobre un
           nodo dispara el drag-and-drop NATIVO del navegador — aparece el «fantasma»
           de la imagen, se cancelan los pointer events y el paneo se muere a mitad de
           camino. Es el síntoma de «al hacer clic parece que agarra una imagen». */
        .cbg svg {
          width: 100%; height: auto; display: block; aspect-ratio: 4/3;
          touch-action: none; cursor: grab;
          user-select: none; -webkit-user-select: none; -webkit-user-drag: none;
        }
        .cbg svg * { -webkit-user-drag: none; }
        .cbg svg:active { cursor: grabbing; }
        .cbg .cbg-nodo { cursor: pointer; }

        /* LA FLOTACIÓN. Va en su propio grupo porque una animación CSS sobre transform
           le gana al transform que escribe la física: en el mismo elemento, el nodo
           quedaría clavado en su keyframe. Dos ejes con períodos que no son múltiplos
           entre sí, para que la órbita no se cierre y no se lea mecánica. */
        .cbg .cbg-flota { animation: cbg-fx 4.3s ease-in-out infinite alternate, cbg-fy 6.7s ease-in-out infinite alternate; }
        @keyframes cbg-fx { from { transform: translateX(calc(-1 * var(--fl))); } to { transform: translateX(var(--fl)); } }
        @keyframes cbg-fy { from { transform: translateY(var(--fl)); } to { transform: translateY(calc(-1 * var(--fl))); } }

        /* EL POP. easeOutBack sobrepasa ~1,10 y vuelve. Nunca desde scale(0): eso se
           lee como glitch y esconde el área de toque. */
        .cbg .cbg-pop { animation: cbg-in .42s cubic-bezier(.34,1.56,.64,1) backwards; }
        @keyframes cbg-in { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }

        /* EL HOVER: entra rápido, sale lento. Tres señales, ninguna cromática. */
        .cbg .cbg-cuerpo { transition: transform .14s cubic-bezier(.34,1.4,.64,1); }
        .cbg .cbg-nodo:hover .cbg-cuerpo, .cbg .cbg-nodo.cbg-sel .cbg-cuerpo { transform: scale(1.35); }
        .cbg .cbg-nodo circle, .cbg .cbg-arista, .cbg .cbg-et { transition: opacity .22s ease, fill .18s ease, stroke .18s ease; }
        .cbg .cbg-nodo:hover circle, .cbg .cbg-nodo:hover .cbg-et { transition-duration: .14s; }

        /* Sin halo, sin contorno, sin sombra, sin bold: Obsidian no tiene nada de eso. */
        .cbg .cbg-et { font-size: calc(12px / var(--k, 1)); fill: var(--on-sidebar); pointer-events: none; }

        @media (prefers-reduced-motion: reduce) {
          .cbg .cbg-flota, .cbg .cbg-pop { animation: none; }
          .cbg .cbg-cuerpo, .cbg .cbg-nodo circle, .cbg .cbg-arista, .cbg .cbg-et { transition: none; }
          .cbg .cbg-nodo:hover .cbg-cuerpo, .cbg .cbg-nodo.cbg-sel .cbg-cuerpo { transform: none; }
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
            onDragStart={frenarDragNativo}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={soltar}
            onPointerCancel={soltar}
          >
            <g ref={gRef} style={{ ['--k' as string]: 1 }}>
              <g fill="none">
                {aristas.map((e, i) => {
                  const a = posiciones[e.de];
                  const b = posiciones[e.a];
                  const na = porId.get(e.a);
                  const nb = porId.get(e.de);
                  if (!a || !b || !na || !nb) return null;
                  const dx = b.x - a.x;
                  const dy = b.y - a.y;
                  const d = Math.hypot(dx, dy) || 1;
                  const ra = radioMundo(nb);
                  const rb = radioMundo(na);
                  if (d <= ra + rb) return null;
                  const viva = cerca ? cerca.has(e.de) && cerca.has(e.a) : true;
                  const enFoco = areaFoco ? na.area === areaFoco || nb.area === areaFoco : true;
                  const op = cerca ? (viva ? 1 : ATENUADO) : areaFoco ? (enFoco ? 1 : ATENUADO) : 1;
                  return (
                    <line
                      key={`${e.de}-${e.a}-${i}`}
                      ref={(el) => { aristaRefs.current.set(i, el); }}
                      className="cbg-arista"
                      x1={a.x + (dx / d) * ra} y1={a.y + (dy / d) * ra}
                      x2={b.x - (dx / d) * rb} y2={b.y - (dy / d) * rb}
                      // La arista en foco NO va dorada: eso diría «acá intervino MaKo»,
                      // que es falso. Es la línea normal subida dos escalones.
                      stroke={viva && cerca ? 'var(--sidebar-text)' : 'var(--sidebar-line)'}
                      strokeWidth={1}
                      strokeOpacity={op}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>

              {nodos.map((n) => {
                const p = posiciones[n.id];
                if (!p) return null;
                const r = radioDe(n);
                const esSel = sel === n.id;
                const h = hashDe(n.id);
                const i = ordenEntrada.get(n.id) ?? 0;
                return (
                  <g
                    key={n.id}
                    ref={(el) => { nodoRefs.current.set(n.id, el); }}
                    className={`cbg-nodo${esSel ? ' cbg-sel' : ''}`}
                    transform={`translate(${p.x} ${p.y})`}
                    onMouseEnter={() => setActivo(n.id)}
                    onMouseLeave={() => setActivo(null)}
                    onPointerDown={agarrarNodo(n.id)}
                    onClick={clicNodo(n.id)}
                  >
                    <g
                      className="cbg-flota"
                      style={{
                        ['--fl' as string]: `${flote}px`,
                        // Retardo NEGATIVO: arranca a mitad de ciclo YA, sin espera. Y
                        // sale del hash del id, así que el nodo flota igual cada visita.
                        animationDelay: `-${h % 4300}ms, -${(h >>> 7) % 6700}ms`,
                      }}
                    >
                      <g className="cbg-pop" style={{ animationDelay: `${Math.min(i * 12, 700)}ms` }}>
                        <g className="cbg-cuerpo">
                          <circle r={Math.max(r + 8 / kr, 16 / kr)} fill="transparent" />
                          <circle r={r} fill={rellenoDe(n)} opacity={opacidadDe(n)} />
                          {esSel && (
                            <circle r={r + 1.2 / kr} fill="none" stroke="var(--on-sidebar)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                          )}
                        </g>
                        {(alphaEtiqueta > 0.02 || esSel) && (
                          <text
                            className="cbg-et"
                            y={r + 6 / kr}
                            textAnchor="middle"
                            dominantBaseline="hanging"
                            opacity={esSel ? 1 : alphaEtiqueta * opacidadDe(n)}
                          >
                            {n.etiqueta}
                          </text>
                        )}
                      </g>
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <aside style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, minHeight: 210 }}>
            {nodoSel ? (
              <>
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
                <div style={{ marginTop: 10, fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>
                  {(vecinos.get(nodoSel.id)?.size ?? 0)} conexiones
                </div>
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
                  Pasa el cursor por un punto para leerlo, arrastra un nodo para moverlo, arrastra el fondo para desplazarte y usa la rueda para acercarte.
                </p>
              </>
            )}
          </div>

          {/* El color es OPT-IN, como los grupos de Obsidian: el mapa nace monocromo y
              el usuario enciende UNA distinción. Reemplaza a la leyenda, que explicaba
              rellenos que ya no codifican nada. */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 16px', fontSize: 'var(--fs-sm)', color: 'var(--dim)', cursor: 'pointer' }}>
            <input type="checkbox" checked={grupoTuyo} onChange={(e) => setGrupoTuyo(e.target.checked)} />
            Resaltar lo que escribiste tú
          </label>
        </aside>
      </div>
    </div>
  );
}
