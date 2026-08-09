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

import { useMemo, useState, useRef, useEffect, useCallback, Fragment, type CSSProperties } from 'react';
import { AREAS, AUTORIA_TEXTO, radioNodo, colorArea, type Cerebro, type NodoCerebro, type AreaId, type Punto } from '@/lib/cerebro-modelo';
import type { NodoFisico, Simulacion } from './fisica';
import { MONO } from '@/app/_ui/tokens';
import { Button, Eyebrow } from '@/app/_ui';
import { Dropdown } from '@/app/components/Dropdown';
// La misma máquina de matcheo que la barra del plan: palabras en cualquier orden, sin
// acentos ni mayúsculas, con frontera de palabra y plural tolerado. El módulo no lleva
// `server-only` justamente para poder compartirse con el navegador. Escribir una segunda
// hubiera dado dos búsquedas que se comportan distinto en la misma app.
import { coincide } from '@/lib/buscar-tareas';

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

/** La ruta que devuelve una URL firmada para MIRAR el archivo (no para bajarlo). El
 *  `?ws=` de la pestaña NO viaja solo en un `src`: el parche de fetch de la app pisa
 *  `window.fetch`, y un `<iframe>` no pasa por ahí. Por eso se lo pega a mano — sin
 *  esto, el super-admin mirando a un cliente recibe un 404 «Archivo no encontrado». */
function urlPreview(idNodo: string): string {
  const id = idNodo.slice(4);   // saca el prefijo 'doc:'
  const ws = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ws') : null;
  return `/api/onboarding/archivero/download?id=${encodeURIComponent(id)}&preview=1${ws ? `&ws=${encodeURIComponent(ws)}` : ''}`;
}

/** El nombre del área, para que buscar «voz» encuentre lo que vive en «Voz y cara». */
const areaDeId = (id: string) => AREAS.find((a) => a.id === id)?.nombre ?? '';

const esImagen = (mime?: string | null) => !!mime && mime.startsWith('image/');
/** Qué se puede mostrar de verdad adentro del navegador. Un .docx o un .xlsx bajan, no
 *  se previsualizan: ofrecer «Ver» sobre ellos abre un visor vacío. */
const sePuedeVer = (mime?: string | null) => esImagen(mime) || (!!mime && (mime.includes('pdf') || mime.startsWith('text/')));

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
  /** El rAF del vuelo de cámara. Vive acá arriba porque lo cortan el zoom y el paneo,
   *  que se declaran mucho antes que el vuelo. */
  const vueloRef = useRef<number | null>(null);
  const cortarVuelo = useCallback(() => {
    if (vueloRef.current != null) { cancelAnimationFrame(vueloRef.current); vueloRef.current = null; }
  }, []);

  const [kPaso, setKPaso] = useState(1);
  const [zoomPct, setZoomPct] = useState(100);
  // El zoom que hace entrar el mapa entero, en ESTADO además de en el ref de más abajo:
  // el render lo necesita para decidir el fade de las etiquetas, y un ref no re-renderiza.
  const [kFitEstado, setKFitEstado] = useState(1);
  // Unidades de mundo por píxel. Lo necesitan el tamaño de la etiqueta y el descarte por
  // colisión, y depende del LIENZO, no del zoom.
  const [uEstado, setUEstado] = useState(1);
  const [activo, setActivo] = useState<string | null>(null);
  const [fijado, setFijado] = useState<string | null>(null);
  const [areaFocoPropio, setAreaFoco] = useState<AreaId | null>(null);
  // La del usuario gana: si eligió un área, pasar el cursor por otra tarjeta no se la
  // cambia abajo de la mano.
  const areaFoco = areaFocoPropio ?? areaResaltada;
  const [busca, setBusca] = useState('');
  /** Dónde busca. Por defecto en el nombre, que es lo que el usuario ve en el mapa; el
   *  detalle y la procedencia se prenden a mano porque encuentran mucho más y a veces
   *  eso es ruido. */
  const [dondeBuscar, setDondeBuscar] = useState<'nombre' | 'todo'>('nombre');
  const [verTodas, setVerTodas] = useState(false);
  const [textoEntero, setTextoEntero] = useState(false);
  const [enPantallaCompleta, setEnPantallaCompleta] = useState(false);
  /** El documento que se está previsualizando sobre el lienzo, o null. */
  const [verDoc, setVerDoc] = useState<NodoCerebro | null>(null);
  /** Qué clase de dato se está mirando. Atenúa el resto, nunca lo desmonta: el mapa
   *  tiene que seguir siendo el mismo mapa, con una parte encendida. */
  const [verQue, setVerQue] = useState<'todo' | 'mako' | 'usuario' | 'falta'>('todo');


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
  // Se reinician con CADA cambio de nodo, no solo cuando se llega volando: pasar el
  // cursor por otro punto también cambia el panel, y sin esto el nuevo aparecía con el
  // «Leer todo» ya desplegado del anterior.
  useEffect(() => { setTextoEntero(false); setVerTodas(false); }, [sel]);
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

  // ── QUÉ ETIQUETAS SE DIBUJAN ───────────────────────────────────────────────
  // Con el tamaño arreglado, el texto pasa de 4,32 px ilegibles a 12 px reales — y ahí
  // aparece el problema que estaba TAPADO: medido, 17 pares de cajas se pisan (43% de
  // las etiquetas). Por eso los dos cambios van juntos; el del tamaño solo deja la
  // pantalla peor que antes.
  //
  // Se descartan por COLISIÓN, en orden de grado descendente: el nodo más conectado gana
  // su etiqueta y el que llega después la cede. Es lo que hace Obsidian, y tiene la
  // propiedad que importa: al ACERCARSE los nodos se separan en pantalla, las cajas
  // dejan de chocar y las etiquetas aparecen solas. O sea que acercarse por fin sirve.
  //
  // ⚠️ Por render CONDICIONAL, nunca con `opacity: 0`: este documento ya midió que un
  // nodo invisible cuesta lo mismo que uno dibujado.
  const etiquetasVisibles = useMemo(() => {
    const alto = (12 * uEstado) / kPaso;          // la caja, en unidades locales del <g>
    const cajas: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
    const ok = new Set<string>();
    const orden = [...nodos].sort((a, b) => {
      const d = (grados[b.id] ?? 0) - (grados[a.id] ?? 0);
      return d !== 0 ? d : a.id < b.id ? -1 : 1;   // desempate estable
    });
    for (const n of orden) {
      const p = posiciones[n.id];
      if (!p) continue;
      // Los factores salen de MEDIR la caja real en el navegador, no de estimarlos: el
      // alto renderizado de una etiqueta de 12 px es 16 px (la caja incluye el
      // interlineado), o sea 1,33 — con el 1,15 que tenía puesto quedaban 10 pares
      // pisados. Se le suma un margen: dos etiquetas que se tocan justo se leen igual de
      // mal que dos que se pisan.
      const ancho = Math.min(n.etiqueta.length, 34) * alto * 0.58 + alto * 0.6;
      const y0 = p.y + radioNodo(grados[n.id] ?? 0) + 6 / Math.sqrt(kPaso);
      const c = { x0: p.x - ancho / 2, x1: p.x + ancho / 2, y0: y0 - alto * 0.2, y1: y0 + alto * 1.55 };
      if (cajas.some((b) => c.x0 < b.x1 && c.x1 > b.x0 && c.y0 < b.y1 && c.y1 > b.y0)) continue;
      cajas.push(c);
      ok.add(n.id);
    }
    return ok;
  }, [nodos, posiciones, grados, kPaso, uEstado]);

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

  /** ¿Este nodo pasa el filtro de «Ver»? Los nodos de ÁREA y la raíz pasan siempre: son
   *  el andamiaje del mapa y apagarlos deja las etiquetas flotando sin racimo. */
  const pasaVer = useCallback((n: NodoCerebro): boolean => {
    if (verQue === 'todo' || n.id === 'raiz' || n.id.startsWith('area:')) return true;
    if (verQue === 'falta') return n.autoria === 'pendiente';
    return n.autoria === verQue;
  }, [verQue]);

  const opacidadDe = (n: NodoCerebro): number => {
    const base = n.autoria === 'pendiente' ? PENDIENTE : 1;
    if (n.id === 'raiz') return base;
    // El filtro ATENÚA, nunca desmonta: el mapa tiene que seguir siendo el mismo mapa
    // con una parte encendida, o se pierde la referencia de dónde estaba cada cosa.
    if (!pasaVer(n)) return ATENUADO * 0.5;
    // Buscar ATENÚA en vivo, igual que el filtro: se ve dónde están los resultados
    // dentro del mapa, que es la mitad de para qué sirve buscar en un grafo.
    if (busca.trim() !== '' && !idsResultado.has(n.id)) return ATENUADO * 0.5;
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
  useEffect(() => cortarVuelo, [cortarVuelo]);

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
      cortarVuelo();
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
  }, [aMundo, pedirPintado, cortarVuelo]);

  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const arrastre = useRef<{ x0: number; y0: number; vx: number; vy: number; movido: boolean } | null>(null);
  const pellizco = useRef<{ d0: number; k0: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // La captura va sobre el SVG, NO sobre `e.target`. Si se captura sobre el
    // `<circle>` que se tocó, el primer re-render de React lo reemplaza y la captura
    // se pierde a mitad del gesto: el paneo se corta solo.
    cortarVuelo();
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
      if (quieto) {
        // Clic sobre un nodo: si ya estaba fijado se suelta; si no, se vuela hasta él.
        // Clic en el fondo: se suelta.
        if (sobreNodo && fijado !== sobreNodo) irA(sobreNodo);
        else setFijado(null);
      }
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

  /** Los accesos directos del «Ir a». No es una lista escrita a mano: sale de lo que el
   *  mapa YA sabe — los dos nodos con significado propio primero, y después el nodo más
   *  conectado de cada área, que es el que resume esa parte del negocio. */
  const accesos = useMemo(() => {
    const out: Array<{ value: string; label: string }> = [];
    const norte = nodos.find((n) => n.destacado);
    const cuello = nodos.find((n) => n.alerta);
    if (norte) out.push({ value: norte.id, label: `Tu Norte · ${norte.etiqueta}` });
    if (cuello) out.push({ value: cuello.id, label: `Tu cuello de botella · ${cuello.etiqueta}` });
    for (const a of AREAS) {
      const dentro = nodos.filter((n) => n.area === a.id && !n.id.startsWith('area:') && n.id !== 'raiz' && n.autoria !== 'pendiente');
      if (!dentro.length) continue;
      const mejor = dentro.reduce((x, y) => ((grados[y.id] ?? 0) > (grados[x.id] ?? 0) ? y : x));
      if (mejor.id === norte?.id || mejor.id === cuello?.id) continue;
      out.push({ value: mejor.id, label: `${a.nombre} · ${mejor.etiqueta}` });
    }
    return out;
  }, [nodos, grados]);

  /** El botón de un desplegable dentro de la barra OSCURA del lienzo. El menú se abre
   *  claro, como en toda la app; lo que hay que vestir es el disparador. */
  const estiloBotonBarra: CSSProperties = {
    background: 'none', border: '1px solid transparent', color: 'var(--sidebar-text)',
    minHeight: 30, padding: '4px 9px', borderRadius: 999, fontSize: 12,
  };

  /** Los nodos que matchean, ordenados por grado: el más conectado primero, que es el
   *  que más probablemente se estaba buscando. */
  const resultados = useMemo(() => {
    const q = busca.trim();
    if (!q) return [] as NodoCerebro[];
    return nodos
      .filter((n) => {
        const heno = dondeBuscar === 'todo'
          ? `${n.etiqueta} ${n.detalle} ${n.fuente} ${areaDeId(n.area)}`
          : n.etiqueta;
        return coincide(heno, q);
      })
      .sort((a, b) => (grados[b.id] ?? 0) - (grados[a.id] ?? 0));
  }, [busca, nodos, grados, dondeBuscar]);
  const primerMatch = resultados[0] ?? null;
  const idsResultado = useMemo(() => new Set(resultados.map((n) => n.id)), [resultados]);
  /** Por dónde va el ciclo del Enter. Se reinicia con cada búsqueda nueva. */
  const cursorBusca = useRef(0);
  useEffect(() => { cursorBusca.current = 0; }, [busca, dondeBuscar]);

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
    // ⚠️ CUÁNTAS UNIDADES DE MUNDO ENTRAN EN UN PÍXEL. El <g> se escala DOS veces —por el
    // zoom del paneo (`--k`) y por la escala del viewBox— y el CSS de la etiqueta solo
    // compensaba la primera. Resultado medido: el texto se dibujaba a 4,32 px SIEMPRE, a
    // cualquier zoom, porque el /k se cancelaba y quedaba 12 × 0,36. O sea que acercarse
    // NO agrandaba el texto, que es justo el único mecanismo con el que Obsidian hace
    // legible un racimo denso. Se escribe acá y en el ResizeObserver, nunca por frame:
    // depende del tamaño del lienzo, no del zoom.
    svgRef.current?.style.setProperty('--u', String(1 / porPixel));
    setUEstado((prev) => (Math.abs(prev - 1 / porPixel) < 1e-9 ? prev : 1 / porPixel));
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

  // ── EL VUELO DE CÁMARA ─────────────────────────────────────────────────────
  // Antes esto TELETRANSPORTABA: el mapa aparecía de golpe en otro lado y no quedaba
  // claro que uno se hubiera movido, ni hacia dónde. Ahora se interpola la vista entera
  // —posición y zoom— para que el ojo siga el recorrido y entienda dónde quedó parado.
  /** Fija un nodo y VUELA hasta él. Lo usan el buscador, el clic sobre un nodo, los
   *  accesos del desplegable y cada conexión de la tarjeta. */
  const irA = useCallback((id: string) => {
    const p = posiciones[id];
    setFijado(id);
    setVerTodas(false);
    setTextoEntero(false);
    if (!p) return;
    if (!svgRef.current) return;
    // ⚠️ EL CENTRO DE LO VISIBLE ES EL CENTRO DEL viewBox, y no «medio ancho visible».
    // El viewBox es CUADRADO y entra con `xMidYMid meet`, o sea que se escala por el lado
    // corto y se CENTRA en el largo: lo visible se extiende más allá del viewBox por los
    // dos costados, en partes iguales. Calcularlo como `encuadre.x + anchoVisible/2`
    // dejaba el nodo 317 px a la derecha del centro — medido. `ajustar()` ya lo hacía
    // bien; esto no, y el error venía desde antes del vuelo: el buscador «centraba» un
    // nodo y lo dejaba corrido.
    const cxU = encuadre.x + encuadre.lado / 2;
    const cyU = encuadre.y + encuadre.lado / 2;
    // Se ACERCA, nunca se aleja: si el usuario ya estaba mirando de cerca se respeta su
    // zoom, y si venía del encuadre completo se lo lleva a 2,2× — lo suficiente para que
    // el nodo y sus vecinos sean el tema de la pantalla, sin perder el contexto de dónde
    // está eso dentro del mapa.
    const k = Math.min(kFit.current * K_MAX_REL, Math.max(vista.current.k, kFit.current * 2.2));
    const destino = { k, x: cxU - k * p.x, y: cyU - k * p.y };
    const desde = { ...vista.current };
    tocoElZoom.current = true;
    cortarVuelo();

    // Quien pidió menos movimiento salta directo. El archivo ya consulta este mismo
    // matchMedia para apagar la flotación.
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      vista.current = destino;
      pedirPintado();
      return;
    }

    const t0 = performance.now();
    const DURACION = 520;   // medido a ojo: menos se siente un salto, más se siente lento
    const paso = () => {
      const t = Math.min(1, (performance.now() - t0) / DURACION);
      // easeInOutCubic: arranca y termina despacio, así el ojo engancha el recorrido.
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      vista.current = {
        k: desde.k + (destino.k - desde.k) * e,
        x: desde.x + (destino.x - desde.x) * e,
        y: desde.y + (destino.y - desde.y) * e,
      };
      // Se escribe por el MISMO rAF que todo lo demás. Un segundo bucle propio pelearía
      // con `aplicar()` por el mismo atributo, que es el defecto que este archivo ya
      // documenta con la flotación y la física.
      pedirPintado();
      vueloRef.current = t < 1 ? requestAnimationFrame(paso) : null;
    };
    vueloRef.current = requestAnimationFrame(paso);
  }, [posiciones, encuadre, pedirPintado, cortarVuelo]);

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
        /* ── LO CLICKEABLE TIENE QUE VERSE CLICKEABLE ──────────────────────────
           Las conexiones y el rótulo del área eran <button> con aspecto de texto suelto:
           funcionaban y nadie los tocaba, que es la peor combinación — el trabajo estaba
           hecho y no se cobraba. Cursor, superficie al pasar, y una flecha que aparece
           para decir «esto te lleva a algún lado». */
        .cbg .cbg-link {
          display: flex; align-items: center; gap: 8px; width: 100%;
          text-align: left; background: none; border: none;
          border-radius: 8px; padding: 6px 8px; margin-left: -8px; cursor: pointer;
          font: inherit; color: var(--ink); line-height: 1.45;
        }
        .cbg .cbg-link:hover { background: var(--surface-2); }
        .cbg .cbg-link:focus-visible { outline: 2px solid var(--mako); outline-offset: 1px; }
        .cbg .cbg-link .cbg-flecha { flex: none; color: var(--faint); opacity: 0; transition: opacity .12s, transform .12s; }
        .cbg .cbg-link:hover .cbg-flecha { opacity: 1; transform: translateX(2px); }
        /* El rótulo del área es un FILTRO, no un título. */
        .cbg .cbg-area-btn {
          display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
          background: none; border: 1px solid transparent; border-radius: 999px;
          padding: 3px 8px; margin-left: -8px; font: inherit;
        }
        .cbg .cbg-area-btn:hover { border-color: var(--border); background: var(--surface-2); }
        .cbg .cbg-area-btn:focus-visible { outline: 2px solid var(--mako); outline-offset: 1px; }
        /* La previsualización del documento, sobre el lienzo. */
        .cbg .cbg-visor {
          position: absolute; inset: 12px; z-index: 2;
          background: var(--surface); border: 1px solid var(--border-strong);
          border-radius: 14px; overflow: hidden; display: flex; flex-direction: column;
          box-shadow: 0 12px 40px rgba(10,12,16,.4);
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
        .cbg .cbg-et { font-size: calc(12px * var(--u, 1) / var(--k, 1)); fill: var(--on-sidebar); pointer-events: none; }

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
          {/* ── VER ─────────────────────────────────────────────────────────
              Antes esto era un contador MUDO: decía «52 datos · 46 de MaKo · 6 tuyos» y
              no se podía hacer nada con esos tres números, que son justo las tres
              preguntas que uno le hace al mapa. Ahora los mismos números son el filtro. */}
          <Dropdown
            value={verQue}
            onChange={(v) => setVerQue(v as typeof verQue)}
            ariaLabel="Qué datos ver en el mapa"
            portalTo={enPantallaCompleta ? marcoRef.current : null}
            buttonStyle={estiloBotonBarra}
            options={[
              { value: 'todo', label: `${cuenta.total} ${cuenta.total === 1 ? 'dato' : 'datos'}` },
              { value: 'mako', label: `${cuenta.mako} los dedujo MaKo` },
              { value: 'usuario', label: `${cuenta.usuario} los escribiste tú` },
              ...(cuenta.pendientes > 0 ? [{ value: 'falta', label: `${cuenta.pendientes} sin completar` }] : []),
            ]}
          />

          {/* ── IR A ────────────────────────────────────────────────────────
              Antes eran dos chips sueltos con los dos únicos nodos que el mapa pinta
              distinto. Son pocos, y sueltos ocupan la barra sin escalar: el mapa tiene
              diez áreas y un puñado de nodos que valen un acceso directo. */}
          {accesos.length > 0 && (
            <Dropdown
              value=""
              resetAfterSelect
              placeholder="Ir a…"
              onChange={(id) => irA(id)}
              ariaLabel="Ir a un dato del mapa"
              portalTo={enPantallaCompleta ? marcoRef.current : null}
              buttonStyle={estiloBotonBarra}
              options={accesos}
            />
          )}
          {areaFoco && (
            <button type="button" className="cbg-chip" aria-pressed onClick={() => setAreaFoco(null)} title="Ver todo">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: areaDe(areaFoco).color, flex: 'none' }} />
              Solo: {areaDe(areaFoco).nombre} ✕
            </button>
          )}
          <span style={{ flex: 1 }} />
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              className="cbg-buscar"
              type="search"
              value={busca}
              onChange={(ev) => setBusca(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Escape') { ev.preventDefault(); setBusca(''); return; }
                if (ev.key !== 'Enter' || !resultados.length) return;
                ev.preventDefault();
                // Enter CICLA por los resultados en vez de volver siempre al primero:
                // con 60 nodos y nombres parecidos, «llevame al que buscaba» casi nunca
                // es el primero, y sin ciclo no había forma de llegar al segundo.
                const i = cursorBusca.current % resultados.length;
                cursorBusca.current = i + 1;
                irA(resultados[i].id);
              }}
              placeholder="Buscar un dato"
              aria-label="Buscar un dato en el mapa"
            />
            {busca.trim() !== '' && (
              <span style={{ fontFamily: MONO, fontSize: 11, color: resultados.length ? 'var(--sidebar-text)' : 'var(--warn)', whiteSpace: 'nowrap' }}>
                {resultados.length === 0 ? 'sin resultados' : `${resultados.length} de ${nodos.length}`}
              </span>
            )}
            {/* Dónde busca. Dos opciones y no cuatro checkboxes como en el plan: acá los
                nodos tienen tres campos de texto, no ocho, y una barra de filtros dentro
                de la barra del lienzo compite con el mapa. */}
            <button
              type="button"
              className="cbg-chip"
              aria-pressed={dondeBuscar === 'todo'}
              onClick={() => setDondeBuscar((v) => (v === 'todo' ? 'nombre' : 'todo'))}
              title={dondeBuscar === 'todo' ? 'Buscar solo en el nombre' : 'Buscar también en el detalle y en la procedencia'}
              style={{ fontSize: 11 }}
            >
              {dondeBuscar === 'todo' ? 'en todo' : 'en el nombre'}
            </button>
          </div>
          {/* El zoom es UN control (alejar · cuánto · acercar) y va junto. «Ajustar a la
              vista» y «Pantalla completa» son los dos que cambian el ENCUADRE, así que
              van juntos y al final. Antes «ajustar» quedaba del otro lado del zoom,
              separado del único botón con el que se emparenta. */}
          <button type="button" className="cbg-ico" onClick={() => zoomPaso(1 / 1.3)} title="Alejar">−</button>
          <span style={{ fontFamily: MONO, fontSize: 11, minWidth: 38, textAlign: 'center' }}>
            {zoomPct}%
          </span>
          <button type="button" className="cbg-ico" onClick={() => zoomPaso(1.3)} title="Acercar">+</button>
          <button type="button" className="cbg-ico" onClick={() => { tocoElZoom.current = false; ajustar(); }} title="Ajustar a la vista">⤢</button>
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
                        {/* El nodo en foco y sus vecinos SIEMPRE llevan etiqueta: es lo
                            que se está mirando, y esconderla ahí sería el peor momento. */}
                        {((etiquetasVisibles.has(n.id) && alphaEtiqueta > 0.02) || esSel || (cerca?.has(n.id) ?? false)) && (
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
                className="cbg-area-btn"
                onClick={() => setAreaFoco(areaFoco === nodoSel.area ? null : nodoSel.area)}
                aria-pressed={areaFoco === nodoSel.area}
                title={areaFoco === nodoSel.area ? 'Ver todo' : `Ver solo ${areaDe(nodoSel.area).nombre}`}
                style={{
                  fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
                  color: areaFoco === nodoSel.area ? 'var(--mako-ink)' : 'var(--faint)',
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
            {nodoSel.detalle && (
              <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                {nodoSel.detalle}
              </p>
            )}

            {/* ── LOS DATOS DEL NODO ─────────────────────────────────────────
                Antes todo esto se pegaba con « · » adentro del mismo párrafo, así que
                cada productor tenía que elegir entre tirar campos o escribir un renglón
                corrido ilegible. Como pares nombre/valor entran todos y se leen. */}
            {(nodoSel.datos ?? []).filter((d) => d.v && d.v.trim()).length > 0 && (
              <dl style={{ margin: '12px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 10px', alignItems: 'baseline' }}>
                {(nodoSel.datos ?? []).filter((d) => d.v && d.v.trim()).map((d) => (
                  <Fragment key={d.k}>
                    <dt style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', whiteSpace: 'nowrap' }}>{d.k}</dt>
                    <dd style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.5 }}>{d.v}</dd>
                  </Fragment>
                ))}
              </dl>
            )}

            {/* ── LA PROSA LARGA ─────────────────────────────────────────────
                ⚠️ El recorte anterior tenía un bug silencioso: clampeaba por LÍNEAS
                (WebkitLineClamp) y decidía si mostrar «Leer todo» por CARACTERES (> 320).
                O sea que había una banda entera —textos de ~270 a 320 caracteres— donde
                el texto se cortaba y NO había ningún botón para verlo entero. Ahora el
                que decide es uno solo: si hay cuerpo, hay botón. */}
            {nodoSel.cuerpo && (
              <div style={{ marginTop: 12 }}>
                {textoEntero
                  ? <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>{nodoSel.cuerpo}</p>
                  : (
                    <button
                      type="button"
                      className="cbg-link"
                      onClick={() => setTextoEntero(true)}
                      style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}
                    >
                      <span style={{ flex: 1 }}>Leer lo que MaKo explica</span>
                      <svg className="cbg-flecha" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                  )}
              </div>
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
                        className="cbg-link"
                        onClick={() => irA(c.nodo.id)}
                        title={`Ir a ${c.nodo.etiqueta}`}
                        style={{ fontSize: 'var(--fs-sm)' }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: areaDe(c.nodo.area).color, flex: 'none' }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                        {c.nodo.etiqueta}
                        {/* `motivo` se venía calculando con cuidado en cada arista, viajaba al
                            browser en cada carga y no lo leía NADIE: el panel mostraba solo
                            «5 conexiones». Su propio tipo dice que es lo que hay que poder leer. */}
                        {c.motivo && <span style={{ color: 'var(--faint)' }}> — {c.motivo}</span>}
                        </span>
                        <svg className="cbg-flecha" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
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

            {fijado && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Un documento se MIRA, no se «abre en su área»: el archivo está a un
                    clic y hasta ahora había que salir de la pantalla para verlo. Solo
                    aparece si de verdad se puede previsualizar — un .docx no se
                    previsualiza, y prometer un botón que no muestra nada es peor que no
                    tenerlo. */}
                {nodoSel.id.startsWith('doc:') && sePuedeVer(nodoSel.mime) && (
                  <Button variant="primary" full onClick={() => setVerDoc(nodoSel)}>
                    Ver el documento
                  </Button>
                )}
                {onAbrirArea && !nodoSel.id.startsWith('area:') && nodoSel.id !== 'raiz' && (
                  <Button variant="secondary" full onClick={() => onAbrirArea(nodoSel.area)}>
                    Abrir {areaDe(nodoSel.area).nombre}
                  </Button>
                )}
              </div>
            )}

            {!fijado && (
              <p style={{ margin: '12px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--faint)', lineHeight: 1.5 }}>
                Toca el punto para fijarlo y ver sus conexiones.
              </p>
            )}
          </div>
        )}

        {/* ── LA PREVISUALIZACIÓN ────────────────────────────────────────────
            Vive DENTRO de `.cbg-lienzo`, no en un portal a document.body: el lienzo
            puede estar en pantalla completa, y en el top layer del navegador un portal
            al body queda invisible — sin error y sin síntoma. */}
        {verDoc && (
          <div className="cbg-visor" role="dialog" aria-label={`Vista previa de ${verDoc.etiqueta}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 650, color: 'var(--ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {verDoc.etiqueta}
              </span>
              <a
                href={`/api/onboarding/archivero/download?id=${encodeURIComponent(verDoc.id.slice(4))}`}
                style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', textDecoration: 'none' }}
              >Descargar</a>
              <button
                type="button"
                onClick={() => setVerDoc(null)}
                aria-label="Cerrar la vista previa"
                style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--faint)', lineHeight: 1 }}
              >✕</button>
            </div>
            {esImagen(verDoc.mime)
              ? <img src={urlPreview(verDoc.id)} alt={verDoc.etiqueta} style={{ flex: 1, minHeight: 0, objectFit: 'contain', background: 'var(--surface-2)' }} />
              : <iframe src={urlPreview(verDoc.id)} title={verDoc.etiqueta} style={{ flex: 1, minHeight: 0, border: 'none' }} />}
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
