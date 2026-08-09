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
import { AREAS, AUTORIA_TEXTO, radioNodo, colorArea, type Cerebro, type NodoCerebro, type AreaId, type Punto } from '@/lib/cerebro-modelo';
import type { NodoFisico, Simulacion } from './fisica';
import { MONO } from '@/app/_ui/tokens';
import { Button, Eyebrow } from '@/app/_ui';

// ⚠️ RELATIVOS AL ENCUADRE, no absolutos. Antes valían 0,5 y 4 contra k=1, que era el
// zoom de arranque cuando el mapa entraba por `preserveAspectRatio`. Ahora el mapa se
// encuadra contra la caja medida y arranca en un k que puede ser 1,8: con topes
// absolutos el usuario no podía alejarse ni un poco. No lo ve el typecheck — se ve como
// «el zoom se traba».
const K_MIN_REL = 0.35;
const K_MAX_REL = 6;
/** Umbral de clic vs arrastre, 5 px de pantalla al cuadrado (el mismo que Obsidian). */
const ARRASTRE2 = 25;
/** La `Rl` de Obsidian: cuánto se apaga lo que no toca al nodo en foco. */
const ATENUADO = 0.2;
/** El «todavía no existe»: mismo círculo relleno, más apagado. Nunca un aro punteado. */
const PENDIENTE = 0.5;
/** Amplitud de la flotación, en unidades de mundo. Con 3 el recorrido era de ~2 px de
 *  pantalla y no se leía como flotar: se leía como que el texto TEMBLABA. 16 da un
 *  movimiento intencional. Va en unidades de mundo, así que el zoom lo escala solo. */
const FLOTE = 16;

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

export function Grafo({ cerebro, onAbrirArea, areaResaltada = null }: {
  cerebro: Cerebro;
  /** Área que se resalta desde AFUERA (el cursor sobre una tarjeta del hub). Es
   *  distinta de `areaFoco`, que la enciende el propio mapa y queda fija: ésta se
   *  apaga sola al sacar el cursor y nunca pisa a la que el usuario eligió. */
  areaResaltada?: AreaId | null;
  /** Abre el área abajo, en la misma página. Es la costura entre las dos mitades de la
   *  pantalla. Si no se pasa, la tarjeta no ofrece la acción — nunca se promete un
   *  botón que no lleva a ningún lado. */
  onAbrirArea?: (area: AreaId) => void;
}) {
  const { nodos, aristas, cuenta, posiciones, encuadre } = cerebro;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const vista = useRef<Vista>({ k: 1, x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const [kPaso, setKPaso] = useState(1);
  const [zoomPct, setZoomPct] = useState(100);
  // El zoom que hace entrar el mapa entero, en ESTADO además de en el ref de más abajo:
  // el render lo necesita para decidir el fade de las etiquetas, y un ref no re-renderiza.
  const [kFitEstado, setKFitEstado] = useState(1);
  const [activo, setActivo] = useState<string | null>(null);
  const [fijado, setFijado] = useState<string | null>(null);
  const [areaFocoPropio, setAreaFoco] = useState<AreaId | null>(null);
  // La del usuario gana: si eligió un área, pasar el cursor por otra tarjeta no se la
  // cambia abajo de la mano.
  const areaFoco = areaFocoPropio ?? areaResaltada;
  const [busca, setBusca] = useState('');
  const [verTodas, setVerTodas] = useState(false);
  const [textoEntero, setTextoEntero] = useState(false);
  const [enPantallaCompleta, setEnPantallaCompleta] = useState(false);


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

  // El fade de etiquetas de Obsidian: clamp(log2(zoom) + 1, 0, 1), pero con el zoom
  // RELATIVO AL ENCUADRE y no absoluto. Antes se medía contra k=1, que era el zoom de
  // arranque cuando el mapa entraba por `preserveAspectRatio`; ahora el mapa arranca en
  // el k que lo hace entrar, y ese k depende de cuántos nodos tenga el workspace. Con
  // la fórmula vieja, dos clientes con el mismo zoom aparente veían distinta cantidad
  // de texto sin ninguna razón.
  //
  // ⚠️ PENDIENTE, y no se arregla bajando la opacidad: en el racimo más denso las
  // etiquetas SE PISAN entre sí. Atenuarlas todas las hace más difíciles de leer sin
  // resolver el solape. La salida real es no dibujar la etiqueta cuando su caja choca
  // con otra ya dibujada, que es trabajo aparte.
  const alphaEtiqueta = Math.min(1, Math.max(0, Math.log2(kPaso / (kFitEstado || 1)) + 1));

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
    if (n.alerta) return 'var(--warn-fill)';
    if (n.destacado) return 'var(--mako)';
    return colorArea(n.area);
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

  /** La posición BASE de cada nodo: la del servidor, o la que mueve la física mientras
   *  dura un arrastre. Encima de esto se suman los desplazamientos de animación. */
  const baseRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const t0 = useRef(0);
  const animRef = useRef<number | null>(null);

  /** Escribe TODO en el DOM: los nodos y los extremos de cada arista. NO pasa por React
   *  —un setState por frame durante un arrastre son 60 renders de 50 nodos— y sobre todo
   *  es UN SOLO lugar.
   *
   *  ⚠️ POR QUÉ ACÁ Y NO EN CSS. La flotación y la entrada vivían como animaciones CSS
   *  sobre grupos anidados. Funcionaban para los nodos y dejaban las ARISTAS clavadas:
   *  una línea es un <line> con cuatro coordenadas y no tiene forma de enterarse de que
   *  el `transform` de un grupo movió sus puntas. Se veían líneas colgando en el aire
   *  durante la entrada, y sin seguir a los nodos mientras flotaban. La única forma de
   *  que las líneas acompañen es que el mismo bucle que mueve los nodos recalcule sus
   *  extremos — o sea, que la animación sea JS y no CSS. */
  const pintar = useCallback((tMs: number) => {
    const base = baseRef.current;
    const pos = new Map<string, { x: number; y: number }>();
    for (const n of nodos) {
      const b = base.get(n.id) ?? posiciones[n.id];
      if (!b) continue;
      const h = hashDe(n.id);
      // FLOTACIÓN: dos senoides de períodos que no son múltiplos entre sí, con fase
      // derivada del hash del id — el nodo flota igual en cada visita.
      const fx = FLOTE * Math.sin((tMs / 7100) * Math.PI * 2 + (h % 6283) / 1000);
      const fy = FLOTE * Math.sin((tMs / 11300) * Math.PI * 2 + ((h >>> 7) % 6283) / 1000);
      // ENTRADA: nace desplazado hacia afuera y el desvío decae hasta cero.
      const demora = Math.min((ordenEntrada.get(n.id) ?? 0) * 12, 700);
      const u = Math.min(1, Math.max(0, (tMs - demora) / 900));
      // Lo que QUEDA del desvío: 1 al empezar, 0 al llegar, con desaceleración larga.
      const resto = (1 - u) ** 3;
      const d = Math.hypot(b.x, b.y) || 1;
      const lejos = (260 + (h % 220)) * resto;
      pos.set(n.id, { x: b.x + fx + (b.x / d) * lejos, y: b.y + fy + (b.y / d) * lejos });
    }
    for (const [id, g] of nodoRefs.current) {
      const f = pos.get(id);
      if (g && f) g.setAttribute('transform', `translate(${f.x.toFixed(2)} ${f.y.toFixed(2)})`);
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
      l.setAttribute('x1', (a.x + (dx / d) * ra).toFixed(2));
      l.setAttribute('y1', (a.y + (dy / d) * ra).toFixed(2));
      l.setAttribute('x2', (b.x - (dx / d) * rb).toFixed(2));
      l.setAttribute('y2', (b.y - (dy / d) * rb).toFixed(2));
    });
  }, [aristas, porId, radioMundo, nodos, posiciones, ordenEntrada]);

  // El bucle. Corre siempre salvo que el usuario pida movimiento reducido, en cuyo caso
  // se pinta UNA vez en las posiciones finales y no se enciende nada.
  useEffect(() => {
    baseRef.current = new Map(Object.entries(posiciones));
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { pintar(99_999); return; }
    t0.current = performance.now();
    const latir = () => { pintar(performance.now() - t0.current); animRef.current = requestAnimationFrame(latir); };
    animRef.current = requestAnimationFrame(latir);
    return () => { if (animRef.current != null) cancelAnimationFrame(animRef.current); animRef.current = null; };
  }, [posiciones, pintar]);

  useEffect(() => () => { simRef.current?.destruir(); simRef.current = null; }, []);

  /** Carga d3-force la primera vez que hace falta y nada más. */
  const asegurarSim = useCallback(async (): Promise<Simulacion | null> => {
    if (simRef.current) return simRef.current;
    const { crearSimulacion } = await import('./fisica');
    if (simRef.current) return simRef.current;   // por si dos gestos entraron a la vez
    const radios = Object.fromEntries(nodos.map((n) => [n.id, radioMundo(n)]));
    simRef.current = await crearSimulacion(posiciones, radios, (fisicos: NodoFisico[]) => {
      // La física NO dibuja: mueve la base y el bucle de arriba se encarga. Si dibujara
      // ella también, habría dos escritores del mismo atributo peleándose por frame.
      for (const f of fisicos) baseRef.current.set(f.id, { x: f.x, y: f.y });
    });
    return simRef.current;
  }, [posiciones, nodos, radioMundo]);

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
    // El porcentaje sale del zoom REAL, no del `kPaso` cuantizado a cuartos: con el
    // cuantizado, el mapa recién encuadrado marcaba «89%» sin que nadie hubiera tocado
    // nada, que se lee como que arranca mal puesto. 100% = el encuadre.
    const pct = kFit.current ? Math.round((v.k / kFit.current) * 100) : 100;
    setZoomPct((prev) => (prev === pct ? prev : pct));
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
      const k = Math.min(kFit.current * K_MAX_REL, Math.max(kFit.current * K_MIN_REL, v.k * factor));
      const mx = (pt.x - v.x) / v.k;
      const my = (pt.y - v.y) / v.k;
      vista.current = { k, x: pt.x - mx * k, y: pt.y - my * k };
      tocoElZoom.current = true;
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
      const k = Math.min(kFit.current * K_MAX_REL, Math.max(kFit.current * K_MIN_REL, pellizco.current.k0 * (d / pellizco.current.d0)));
      const mx = (medio.x - v.x) / v.k;
      const my = (medio.y - v.y) / v.k;
      vista.current = { k, x: medio.x - mx * k, y: medio.y - my * k };
      tocoElZoom.current = true;
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
    // ⚠️ `min(ancho, alto)` y NO `width`. El viewBox es CUADRADO y el svg lo mete con
    // `xMidYMid meet`, o sea que la escala real la fija el lado CHICO de la caja. Con
    // `width` el mapa se arrastraba al 75% de la velocidad del dedo en un lienzo 4:3, y
    // al 40% en uno apaisado. La rueda y el pellizco no tenían el bug: pasan por
    // `aMundo()`, que usa la matriz real del SVG.
    const escala = encuadre.lado / Math.min(caja.width, caja.height);
    vista.current = { ...vista.current, x: arr.vx + dx * escala, y: arr.vy + dy * escala };
    pedirPintado();
  };

  const soltar = (e: React.PointerEvent<SVGSVGElement>) => {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size < 2) pellizco.current = null;
    if (punteros.current.size === 0) {
      const quieto = arrastre.current && !arrastre.current.movido;
      const sobreNodo = arrastrando.current;
      if (sobreNodo) simRef.current?.soltar();
      // ⚠️ El clic se resuelve ACÁ y no con un onClick en el nodo. `setPointerCapture`
      // RETARGETEA todos los eventos siguientes al elemento que capturó —el <svg>—,
      // así que el `click` nunca llega al <circle> y el onClick del nodo no dispara.
      // Es lo que rompió poder fijar un nodo para leer su detalle.
      if (quieto) setFijado((f) => (sobreNodo ? (f === sobreNodo ? null : sobreNodo) : null));
      arrastrando.current = null;
      arrastre.current = null;
    }
  };

  const agarrarNodo = (id: string) => (e: React.PointerEvent) => {
    // ⚠️ SIN `stopPropagation`. Es lo que rompía el arrastre entero: cortaba la
    // burbuja antes de que el `onPointerDown` del <svg> registrara el puntero, así
    // que `onPointerMove` salía por la guarda de `punteros` y no se movía nada.
    // El orden de React ya es el correcto — el nodo dispara ANTES que el lienzo —,
    // así que cuando el <svg> arma el gesto, `arrastrando` ya está puesto.
    arrastrando.current = id;
    const p = aMundoReal(e.clientX, e.clientY);
    void asegurarSim().then((s) => {
      if (arrastrando.current === id && p) s?.agarrar(id, p.x, p.y);
    });
  };


  const areaDe = (id: AreaId) => AREAS.find((a) => a.id === id)!;

  /** Los dos nodos con significado propio: el Norte (dorado) y el cuello de botella
   *  (naranja). El lienzo los pintaba distinto y no los explicaba en ningún lado. */
  const destacado = useMemo(() => nodos.find((n) => n.destacado) ?? null, [nodos]);
  const alerta = useMemo(() => nodos.find((n) => n.alerta) ?? null, [nodos]);

  const primerMatch = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return null;
    return nodos.find((n) => n.etiqueta.toLowerCase().includes(q)) ?? null;
  }, [busca, nodos]);

  /** Los vecinos del nodo fijado CON su motivo. El motivo ya venía calculado en cada
   *  arista y no lo leía nadie. */
  const conexiones = useMemo(() => {
    if (!fijado) return [];
    const out: Array<{ nodo: NodoCerebro; motivo?: string }> = [];
    for (const e of aristas) {
      const otro = e.de === fijado ? e.a : e.a === fijado ? e.de : null;
      if (!otro) continue;
      const n = porId.get(otro);
      if (n) out.push({ nodo: n, motivo: e.motivo });
    }
    return out;
  }, [fijado, aristas, porId]);

  const vb = `${encuadre.x} ${encuadre.y} ${encuadre.lado} ${encuadre.lado}`;

  // ── EL ENCUADRE ────────────────────────────────────────────────────────────
  // ⚠️ ESTO Y EL ALTO DEL LIENZO SON UN SOLO CAMBIO. El servidor devuelve un encuadre
  // CUADRADO (`lado`), el svg lo mete con `xMidYMid meet` y por lo tanto el cuadrado
  // entra por el lado CHICO: en un lienzo apaisado se desperdicia el 60% del ancho.
  // Poner el lienzo apaisado SIN esto empeora el grafo en vez de mejorarlo.
  // Se calcula el bbox REAL de los nodos (con su radio) y se lo escala a la caja medida.
  const kFit = useRef(1);
  const tocoElZoom = useRef(false);

  const bbox = useMemo(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodos) {
      const p = posiciones[n.id];
      if (!p) continue;
      const r = radioNodo(grados[n.id] ?? 0);
      x0 = Math.min(x0, p.x - r); y0 = Math.min(y0, p.y - r);
      x1 = Math.max(x1, p.x + r); y1 = Math.max(y1, p.y + r);
    }
    if (!Number.isFinite(x0)) return null;
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }, [nodos, posiciones, grados]);

  /** Encuadra el mapa entero en la caja que hay. Es UNA función y TRES features: el
   *  encuadre inicial, el botón «Ajustar a la vista» y el centrado del buscador. */
  const ajustar = useCallback(() => {
    const caja = svgRef.current?.getBoundingClientRect();
    if (!caja || !bbox || !caja.width || !caja.height) return;
    // Cuántas unidades de mundo entran en la caja, sabiendo que `meet` escala por el
    // lado chico.
    const porPixel = Math.min(caja.width, caja.height) / encuadre.lado;
    const anchoU = caja.width / porPixel;
    const altoU = caja.height / porPixel;
    const aire = 24 / porPixel;
    const k = Math.min((anchoU - 2 * aire) / (bbox.w || 1), (altoU - 2 * aire) / (bbox.h || 1));
    kFit.current = k;
    setKFitEstado((prev) => (Math.abs(prev - k) < 1e-6 ? prev : k));
    const cxU = encuadre.x + encuadre.lado / 2;
    const cyU = encuadre.y + encuadre.lado / 2;
    vista.current = { k, x: cxU - k * bbox.cx, y: cyU - k * bbox.cy };
    pedirPintado();
  }, [bbox, encuadre, pedirPintado]);

  /** Zoom desde los botones. Va contra el CENTRO del lienzo, no contra el cursor: el
   *  botón no tiene una posición en el mapa. */
  const zoomPaso = useCallback((factor: number) => {
    const caja = svgRef.current?.getBoundingClientRect();
    if (!caja) return;
    const pt = aMundo(caja.left + caja.width / 2, caja.top + caja.height / 2);
    if (!pt) return;
    const v = vista.current;
    const k = Math.min(kFit.current * K_MAX_REL, Math.max(kFit.current * K_MIN_REL, v.k * factor));
    vista.current = { k, x: pt.x - ((pt.x - v.x) / v.k) * k, y: pt.y - ((pt.y - v.y) / v.k) * k };
    tocoElZoom.current = true;
    pedirPintado();
  }, [aMundo, pedirPintado]);

  /** Fija un nodo y lo trae al centro. Lo usan el buscador, los chips del Norte y del
   *  cuello, y cada conexión de la tarjeta. */
  const irA = useCallback((id: string) => {
    const p = posiciones[id];
    setFijado(id);
    setVerTodas(false);
    setTextoEntero(false);
    if (!p) return;
    const caja = svgRef.current?.getBoundingClientRect();
    if (!caja) return;
    const porPixel = Math.min(caja.width, caja.height) / encuadre.lado;
    const cxU = encuadre.x + (caja.width / porPixel) / 2;
    const cyU = encuadre.y + (caja.height / porPixel) / 2;
    const k = vista.current.k;
    vista.current = { k, x: cxU - k * p.x, y: cyU - k * p.y };
    tocoElZoom.current = true;
    pedirPintado();
  }, [posiciones, encuadre, pedirPintado]);

  // ⚠️ Pantalla completa con la Fullscreen API sobre `.cbg`, NUNCA con un overlay
  // `position:fixed`. En esta app los z-index son literales y ya se quemó: la pila de
  // modales arranca en 130, la sidebar está en 60 y los flyouts en 2000, así que un
  // `zIndex:100` queda pintado DEBAJO del backdrop sin error ni síntoma. El top layer
  // del navegador no compite con ningún z, y trae Escape gratis.
  const marcoRef = useRef<HTMLDivElement | null>(null);
  const pantallaCompleta = useCallback(() => {
    const el = marcoRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const alCambiar = () => setEnPantallaCompleta(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  // Escape suelta el nodo fijado. Sin esto, la única salida es volver a hacer clic en
  // el mismo punto o en el fondo, y ninguna de las dos está escrita en ningún lado: se
  // lee como que el grafo se colgó atenuado.
  useEffect(() => {
    if (!fijado) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setFijado(null); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [fijado]);

  // Al montar y en cada cambio de tamaño — salvo que el usuario ya haya tocado el zoom,
  // porque re-encuadrarle el mapa mientras lo mira es peor que dejarlo descuadrado.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    ajustar();
    const ro = new ResizeObserver(() => { if (!tocoElZoom.current) ajustar(); });
    ro.observe(el);
    const alSalir = () => ajustar();
    document.addEventListener('fullscreenchange', alSalir);
    return () => { ro.disconnect(); document.removeEventListener('fullscreenchange', alSalir); };
  }, [ajustar]);


  return (
    <div className="cbg" ref={marcoRef}>
      <style>{`
        /* ⚠️ EL ALTO NO SE DERIVA DEL ANCHO. Antes el svg llevaba \`aspect-ratio: 4/3\`
           con \`height:auto\`, así que el lienzo CRECÍA justo en el monitor donde más
           espacio hay: en 1920 con la sidebar plegada daba 1444×1083 sobre un viewport
           de 900, y se veía el tercio de arriba. Ése era el problema de fondo detrás de
           «quiero que el grafo sea el protagonista» — no que el lienzo fuera chico.
           Ahora el alto sale del VIEWPORT y el ancho se toma todo lo que haya.
           El 280 sale de MEDIR, no de estimar: 183 hasta el borde de arriba del lienzo
           (padding de Pagina + PageHeader + los 46 de la barra de control), 66 del
           título «Áreas» con su separación, y 31 de ASOMO de la primera fila de
           tarjetas. El asomo es el punto: sin él la pantalla termina justo donde
           termina el lienzo y miente diciendo que no hay nada más abajo. La primera
           versión restaba 240 y la grilla quedaba 9 px POR DEBAJO del pliegue.
           \`svh\` y NO \`dvh\`: en mobile \`dvh\` cambia cuando se esconde la barra del
           navegador, el lienzo se redimensiona a mitad del scroll y el re-encuadre da
           tirones. */
        .cbg { --cbg-alto: clamp(420px, calc(100svh - 280px), 760px); }
        .cbg .cbg-marco {
          background: var(--sidebar); border-radius: 14px; overflow: hidden;
          border: 1px solid var(--sidebar-line);
        }
        .cbg .cbg-lienzo { position: relative; height: var(--cbg-alto); }
        .cbg .cbg-barra {
          display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
          min-height: 46px; padding: 6px 14px;
          border-bottom: 1px solid var(--sidebar-line);
          font-size: 12px; color: var(--sidebar-text);
        }
        .cbg .cbg-chip {
          display: inline-flex; align-items: center; gap: 6px;
          background: none; border: 1px solid transparent; border-radius: 999px;
          padding: 4px 9px; cursor: pointer; color: var(--sidebar-text);
          font: inherit; line-height: 1;
        }
        .cbg .cbg-chip:hover { border-color: var(--sidebar-line); color: var(--on-sidebar); }
        .cbg .cbg-chip[aria-pressed="true"] { border-color: var(--sidebar-line); color: var(--on-sidebar); background: rgba(255,255,255,.06); }
        .cbg .cbg-ico {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 8px; border: 1px solid transparent;
          background: none; color: var(--sidebar-text); cursor: pointer;
        }
        .cbg .cbg-ico:hover { border-color: var(--sidebar-line); color: var(--on-sidebar); }
        .cbg .cbg-chip:focus-visible, .cbg .cbg-ico:focus-visible, .cbg .cbg-buscar:focus-visible {
          outline: 2px solid var(--mako); outline-offset: 2px;
        }
        .cbg .cbg-buscar {
          background: rgba(255,255,255,.05); border: 1px solid var(--sidebar-line);
          border-radius: 8px; color: var(--on-sidebar);
          font: inherit; width: 190px; height: 28px; padding: 0 10px;
        }
        .cbg .cbg-buscar::placeholder { color: var(--sidebar-text); }
        /* La tarjeta de detalle FLOTA sobre el lienzo en vez de comerle una columna de
           300 px que el 90% del tiempo está vacía. Y es gratis: el encuadre es cuadrado,
           así que en un lienzo apaisado quedan cientos de píxeles de aire a cada lado
           donde no hay un solo nodo. */
        .cbg .cbg-detalle {
          position: absolute; top: 12px; right: 12px; width: 320px;
          max-height: calc(var(--cbg-alto) - 24px); overflow-y: auto;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; padding: 16px;
          box-shadow: 0 8px 28px rgba(10,12,16,.28);
        }
        .cbg:fullscreen { --cbg-alto: calc(100svh - 46px); }
        .cbg:fullscreen .cbg-marco { border-radius: 0; border: none; height: 100svh; }
        /* user-select y -webkit-user-drag NO son adorno: sin ellos, arrastrar sobre un
           nodo dispara el drag-and-drop NATIVO del navegador — aparece el «fantasma»
           de la imagen, se cancelan los pointer events y el paneo se muere a mitad de
           camino. Es el síntoma de «al hacer clic parece que agarra una imagen». */
        .cbg svg {
          width: 100%; height: 100%; display: block;
          touch-action: none; cursor: grab;
          user-select: none; -webkit-user-select: none; -webkit-user-drag: none;
        }
        .cbg svg * { -webkit-user-drag: none; }
        .cbg svg:active { cursor: grabbing; }
        .cbg .cbg-nodo { cursor: pointer; }

        /* LA FLOTACIÓN. Va en su propio grupo porque una animación CSS sobre transform
           le gana al transform que escribe la física: en el mismo elemento, el nodo
           quedaría clavado en su keyframe.
           ⚠️ Y son DOS grupos, uno por eje, por la misma razón de cascada: las dos
           animaciones animan la MISMA propiedad (transform), así que puestas en el
           mismo elemento la segunda pisa a la primera y el nodo se mueve en un solo
           eje. Medido con Playwright: con las dos juntas el desplazamiento real era
           de 0,03 px, o sea ninguno.
           Períodos que no son múltiplos entre sí: la órbita no se cierra y no se lee
           mecánica. */

        /* will-change promueve el grupo a su propia capa del compositor. Sin esto el
           navegador re-rasteriza el TEXTO en cada frame y se ve tembloroso, que es
           distinto de flotar. Con la capa, el texto se mueve como una imagen. */

        /* LA LLEGADA. El nodo no nace en su lugar: nace MÁS AFUERA, en la dirección
           que lo aleja del centro, y viaja hasta su posición. Va en su propio grupo
           porque también anima transform y pisaría al pop. Curva de desaceleración
           larga (sin overshoot): el que rebota es el pop, y dos rebotes encimados se
           leen como un error. */

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
          .cbg .cbg-pop { animation: none; }
          .cbg .cbg-cuerpo, .cbg .cbg-nodo circle, .cbg .cbg-arista, .cbg .cbg-et { transition: none; }
          .cbg .cbg-nodo:hover .cbg-cuerpo, .cbg .cbg-nodo.cbg-sel .cbg-cuerpo { transform: none; }
        }
        @media (max-width: 900px) {
          /* El tope es OBLIGATORIO, no estético: el svg lleva \`touch-action:none\` para
             el pellizco, así que un lienzo alto ATRAPA el scroll de la página — el dedo
             apoyado sobre el grafo panea el mapa en vez de bajar. */
          .cbg { --cbg-alto: clamp(300px, 52svh, 440px); }
          .cbg .cbg-detalle {
            position: static; width: auto; max-height: none;
            margin-top: 12px; box-shadow: none;
          }
        }
      `}</style>

      <div className="cbg-marco">
        {/* ── LA BARRA DE CONTROL ────────────────────────────────────────────
            Acá viven las dos únicas señales cromáticas del lienzo que SIGNIFICAN algo
            —el Norte y el cuello de botella—, nombradas y clicables. Antes el mapa las
            pintaba de dorado y de naranja y no las explicaba en ningún lado. */}
        <div className="cbg-barra">
          <span style={{ fontFamily: MONO, fontSize: 11, whiteSpace: 'nowrap' }}>
            {cuenta.total} {cuenta.total === 1 ? 'dato' : 'datos'} · {cuenta.mako} de MaKo · {cuenta.usuario} {cuenta.usuario === 1 ? 'tuyo' : 'tuyos'}
          </span>
          {destacado && (
            <button type="button" className="cbg-chip" onClick={() => irA(destacado.id)} title="Ver tu Norte en el mapa">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mako)', flex: 'none' }} />
              Tu Norte
            </button>
          )}
          {alerta && (
            <button type="button" className="cbg-chip" onClick={() => irA(alerta.id)} title="Ver tu cuello de botella en el mapa">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn-fill)', flex: 'none' }} />
              Tu cuello de botella
            </button>
          )}
          {areaFoco && (
            <button type="button" className="cbg-chip" aria-pressed onClick={() => setAreaFoco(null)} title="Ver todo">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: areaDe(areaFoco).color, flex: 'none' }} />
              Solo: {areaDe(areaFoco).nombre} ✕
            </button>
          )}
          <span style={{ flex: 1 }} />
          <input
            className="cbg-buscar"
            type="search"
            value={busca}
            onChange={(ev) => setBusca(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === 'Enter' && primerMatch) { ev.preventDefault(); irA(primerMatch.id); } }}
            placeholder="Buscar un dato"
            aria-label="Buscar un dato en el mapa"
          />
          <button type="button" className="cbg-ico" onClick={() => { tocoElZoom.current = false; ajustar(); }} title="Ajustar a la vista">⤢</button>
          <button type="button" className="cbg-ico" onClick={() => zoomPaso(1 / 1.3)} title="Alejar">−</button>
          <span style={{ fontFamily: MONO, fontSize: 11, minWidth: 38, textAlign: 'center' }}>
            {zoomPct}%
          </span>
          <button type="button" className="cbg-ico" onClick={() => zoomPaso(1.3)} title="Acercar">+</button>
          <button type="button" className="cbg-ico" onClick={pantallaCompleta} title={enPantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}>⛶</button>
        </div>

        <div className="cbg-lienzo">
          <svg
            ref={svgRef}
            viewBox={vb}
            role="img"
            aria-label={`Mapa del segundo cerebro: ${cuenta.total} datos que MaKo entendió de tu negocio`}
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
                    // Enganche de las pruebas (scripts/probar-solape.mjs). El id no se
                    // puede sacar del DOM de otra forma: las clases son todas iguales y
                    // la posición la reescribe el rAF, así que sin esto no hay manera de
                    // seguir a UN nodo entre dos frames.
                    data-nodo={n.id}
                    transform={`translate(${p.x} ${p.y})`}
                    onMouseEnter={() => setActivo(n.id)}
                    onMouseLeave={() => setActivo(null)}
                    onPointerDown={agarrarNodo(n.id)}
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
                );
              })}
            </g>
          </svg>

        {/* ── LA TARJETA DE DETALLE ────────────────────────────────────────
            Flota sobre el lienzo. Dos modos, y la diferencia es deliberada:
            · AL PASO (hover) se LEE. Sin botones, porque la tarjeta flota: mover el
              mouse del nodo hacia ella cruza el lienzo, dispara el onMouseLeave y la
              tarjeta desaparecería justo antes del clic.
            · FIJADA (clic) se ACTÚA: conexiones clicables y la acción de abrir.
            El pie del modo lectura enseña ese contrato en una línea. */}
        {nodoSel && (
          <div className="cbg-detalle">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setAreaFoco(areaFoco === nodoSel.area ? null : nodoSel.area)}
                aria-pressed={areaFoco === nodoSel.area}
                title={areaFoco === nodoSel.area ? 'Ver todo' : `Ver solo ${areaDe(nodoSel.area).nombre}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
                  color: areaFoco === nodoSel.area ? 'var(--mako-ink)' : 'var(--faint)',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: areaDe(nodoSel.area).color, flex: 'none' }} />
                {areaDe(nodoSel.area).nombre}
              </button>
              <span style={{ flex: 1 }} />
              {fijado && (
                <>
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>Fijado</span>
                  <button
                    type="button"
                    onClick={() => setFijado(null)}
                    title="Soltar"
                    aria-label="Soltar el dato fijado"
                    style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--faint)', lineHeight: 1 }}
                  >✕</button>
                </>
              )}
            </div>

            <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 8 }}>
              {nodoSel.etiqueta}
            </div>
            {/* El `detalle` de un plano del panorama son varios párrafos: sin recorte,
                la tarjeta se comía el lienzo entero y empujaba las conexiones y la
                acción fuera de la vista. Se muestran ocho líneas y el resto se pide. */}
            {nodoSel.detalle && (
              <>
                <p
                  style={{
                    margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55,
                    whiteSpace: 'pre-line',
                    ...(textoEntero ? {} : {
                      display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }),
                  }}
                >
                  {nodoSel.detalle}
                </p>
                {!textoEntero && nodoSel.detalle.length > 320 && (
                  <button
                    type="button"
                    onClick={() => setTextoEntero(true)}
                    style={{ background: 'none', border: 'none', padding: '4px 0 0', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}
                  >Leer todo</button>
                )}
              </>
            )}

            {(nodoSel.fuente || nodoSel.autoria) && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <Eyebrow>De dónde salió</Eyebrow>
                <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', lineHeight: 1.5, marginTop: 4 }}>
                  {[nodoSel.fuente, AUTORIA_TEXTO[nodoSel.autoria]].filter(Boolean).join(' · ')}
                </div>
              </div>
            )}

            {fijado && conexiones.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Eyebrow>Conectado con · {conexiones.length}</Eyebrow>
                <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {conexiones.slice(0, verTodas ? undefined : 3).map((c) => (
                    <li key={c.nodo.id}>
                      <button
                        type="button"
                        onClick={() => irA(c.nodo.id)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', background: 'none',
                          border: 'none', padding: '5px 0', cursor: 'pointer',
                          fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.45,
                        }}
                      >
                        {c.nodo.etiqueta}
                        {/* `motivo` se venía calculando con cuidado en cada arista, viajaba al
                            browser en cada carga y no lo leía NADIE: el panel mostraba solo
                            «5 conexiones». Su propio tipo dice que es lo que hay que poder leer. */}
                        {c.motivo && <span style={{ color: 'var(--faint)' }}> — {c.motivo}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
                {conexiones.length > 3 && !verTodas && (
                  <button
                    type="button"
                    onClick={() => setVerTodas(true)}
                    style={{ background: 'none', border: 'none', padding: '4px 0 0', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}
                  >Ver las {conexiones.length}</button>
                )}
              </div>
            )}

            {fijado && onAbrirArea && !nodoSel.id.startsWith('area:') && nodoSel.id !== 'raiz' && (
              <div style={{ marginTop: 14 }}>
                <Button variant="secondary" full onClick={() => onAbrirArea(nodoSel.area)}>
                  Abrir {areaDe(nodoSel.area).nombre}
                </Button>
              </div>
            )}

            {!fijado && (
              <p style={{ margin: '12px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--faint)', lineHeight: 1.5 }}>
                Toca el punto para fijarlo y ver sus conexiones.
              </p>
            )}
          </div>
        )}

        {/* Estado vacío: un mensaje que explica, nunca un cuadro con los campos en cero.
            Antes acá se leían cuatro ceros seguidos y un número mal contado. */}
        {cuenta.total === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', padding: 24,
          }}>
            <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--on-sidebar)' }}>
              Todavía no sé nada de tu negocio
            </div>
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--sidebar-text)', maxWidth: 340, lineHeight: 1.55 }}>
              Suelta tus documentos en El Archivero y el mapa se arma solo.
            </p>
            {onAbrirArea && (
              <Button variant="primary" onClick={() => onAbrirArea('documentos')}>Abrir El Archivero</Button>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
