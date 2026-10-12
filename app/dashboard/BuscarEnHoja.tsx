'use client';

// =============================================================================
// BuscarEnHoja / BuscarEnTabla — la barra de búsqueda de la topbar y la de una tabla
// =============================================================================
// Tanda v5 (12/10/2026), punto 4 del pedido y la decisión del contrato: «La barra de búsqueda está SIEMPRE a
// la vista a su izquierda [del Filtro]. Ctrl/Cmd+F con el foco en el Dashboard enfoca la barra (si la barra
// ya tiene el foco, el segundo Ctrl+F es el del navegador).» Y el punto 14: una tabla con su propia barra.
// Lo puro (la comparación sin acentos, el mapa al texto original, la tecla, qué control es la barra de una
// tabla) vive en lib/graficos-buscar.ts, con test.
//
// `BuscarEnHoja` busca en lo DIBUJADO de la hoja, como el Ctrl+F del navegador: lupa, «2 de 7», ↑ ↓,
// Enter / Shift+Enter, Escape limpia.
//   · PINTA CON LA CSS CUSTOM HIGHLIGHT API (`CSS.highlights` + `::highlight()`): no toca el DOM que dibuja
//     React. Envolver las coincidencias en un `<mark>` le movería los nodos a React por debajo y el próximo
//     render tiraría (o dibujaría el texto dos veces). Sin la API (un navegador viejo) igual cuenta y lleva a
//     cada una a la vista; sólo no la pinta.
//   · LLEVA A LA VISTA scrolleando SÓLO lo que scrollea (`overflow: auto/scroll`): el lienzo y, adentro, una
//     tabla o una lista. NO `scrollIntoView`: también scrollea los contenedores con `overflow: hidden` (una
//     tarjeta lo tiene), y una tarjeta scrolleada por código queda corrida para siempre (AGENTS.md, «overflow:
//     hidden no impide que el contenedor se scrollee POR CÓDIGO»).
//   · SE REPINTA SOLA cuando llegan datos o se cambia de hoja (`MutationObserver` sobre `.lk-pagina`), sin
//     mover la vista: sólo se salta a una coincidencia cuando la persona escribe o aprieta ↑ ↓.
//   · SÓLO ENCUENTRA LO DIBUJADO: lo que el límite de una tabla dejó afuera («+N más») no llegó a la página, y
//     las etiquetas de un gráfico van cortadas a lo que entra. Para eso está la barra de una tabla.
//   · NO BUSCA en su propio cromo: los botones de cada tarjeta (`.lk-comp-acciones`, el «Filtro», MaKo), lo
//     que no se ve (lo de imprimir, una sección plegada) ni lo marcado con `data-buscar-no`.
//
// `BuscarEnTabla` (interfaz I2 del contrato: la monta app/dashboard/EditorInforme.tsx en la cabecera de una
// tarjeta de tabla con `tabla.buscar`) es OTRA cosa: un control `texto` de esa tabla sobre el campo de su
// dimensión (el que decide `idBusquedaDe`, ./exportar.ts). Lo escrito va a la VISTA (`onVista`, no se guarda) con el respiro de 300 ms de «Contiene…», y
// filtra en el server: encuentra también lo que el límite dejaba afuera.
//   ⚠️ En un link compartido no se dibuja si el campo es de personas (`campoCompartible`): el server del link
//      no aplica esa búsqueda, y un input que no hace nada se lee como roto.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as KeyboardEventReact, type SyntheticEvent } from 'react';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { conVista, type Grafico, type Hoja, type ValorControl, type VistaValores } from '@/lib/graficos-catalogo';
import { tituloControl } from '@/lib/graficos-controles-texto';
import { atajoBuscar, buscarEnSegmentos, textoContador, vecina, type FocoBuscar, type Segmento } from '@/lib/graficos-buscar';
import { campoCompartible } from '@/app/compartido/[token]/informe-reglas';
import type { Compartido } from './lectura-compartida';
import { conBusqueda, idBusquedaDe } from './exportar';

/** Los dos nombres de la Highlight API: todas las coincidencias, y la que se está mirando. */
const RESALTE = 'lk-buscar';
const RESALTE_ACTUAL = 'lk-buscar-actual';
/** El respiro al tipear (una búsqueda por tecla sobre una hoja grande se nota) y al cambiar la página. */
const ESPERA_TIPEO_MS = 120;
const ESPERA_CAMBIOS_MS = 200;
/** Lo que no se busca: el cromo de cada tarjeta, lo que no es texto de la página. */
const NO_BUSCAR = '.lk-comp-acciones, [data-buscar-no], script, style, noscript, textarea, select';

const hayHighlights = () => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

/** Los nodos de texto que se VEN en la página, en orden, cada uno con su grupo (su elemento padre). */
function recolectar(raiz: HTMLElement): { segmentos: Segmento[]; nodos: Text[] } {
  const segmentos: Segmento[] = [];
  const nodos: Text[] = [];
  const decision = new Map<Element, boolean>();
  const grupos = new Map<Element, number>();
  const sirve = (el: Element) => {
    const ya = decision.get(el);
    if (ya !== undefined) return ya;
    let si = !el.closest(NO_BUSCAR);
    if (si) {
      const ver = (el as Element & { checkVisibility?: (o?: CheckVisibilityOptions) => boolean }).checkVisibility;
      si = ver ? ver.call(el, { checkVisibilityCSS: true, visibilityProperty: true }) : el.getClientRects().length > 0;
    }
    decision.set(el, si);
    return si;
  };
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n as Text;
    const p = t.parentElement;
    if (!p || !t.data || !sirve(p)) continue;
    let g = grupos.get(p);
    if (g === undefined) { g = grupos.size; grupos.set(p, g); }
    segmentos.push({ texto: t.data, grupo: g });
    nodos.push(t);
  }
  return { segmentos, nodos };
}

/**
 * Lleva el rango a la vista scrolleando, de adentro hacia afuera, SÓLO lo que scrollea de verdad (una tabla,
 * una lista, el lienzo), y lo centra si no se ve. Nada con `overflow: hidden` (ver la cabecera).
 */
function llevarALaVista(r: Range) {
  const desde = r.startContainer.parentElement;
  if (!desde) return;
  for (let p: HTMLElement | null = desde.parentElement; p; p = p.parentElement) {
    const cs = getComputedStyle(p);
    const enY = /(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1;
    const enX = /(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1;
    if (enY || enX) {
      const a = r.getBoundingClientRect();
      const b = p.getBoundingClientRect();
      if (a.width || a.height) {
        if (enY && (a.top < b.top || a.bottom > b.bottom)) p.scrollTop += (a.top + a.height / 2) - (b.top + b.height / 2);
        if (enX && (a.left < b.left || a.right > b.right)) p.scrollLeft += (a.left + a.width / 2) - (b.left + b.width / 2);
      }
    }
    if (p.classList.contains('lk-lienzo')) break;
  }
}

function pintar(rangos: readonly Range[], actual: number) {
  if (!hayHighlights()) return;
  if (!rangos.length) { CSS.highlights.delete(RESALTE); CSS.highlights.delete(RESALTE_ACTUAL); return; }
  CSS.highlights.set(RESALTE, new Highlight(...rangos));
  if (actual >= 0 && rangos[actual]) {
    const h = new Highlight(rangos[actual]);
    h.priority = 1;
    CSS.highlights.set(RESALTE_ACTUAL, h);
  } else CSS.highlights.delete(RESALTE_ACTUAL);
}

function Flecha({ arriba }: { arriba?: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={arriba ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
    </svg>
  );
}

/** La barra de la topbar. Sin props: busca en la `.lk-pagina` de SU pantalla (la `.lk-app` que la contiene). */
export function BuscarEnHoja() {
  const caja = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [consulta, setConsulta] = useState('');
  const [estado, setEstado] = useState<{ total: number; actual: number; cortado: boolean }>({ total: 0, actual: -1, cortado: false });
  const rangos = useRef<Range[]>([]);
  const actual = useRef(-1);
  const ultimoToque = useRef<'dentro' | 'afuera' | null>(null);

  const pagina = useCallback(() => caja.current?.closest('.lk-app')?.querySelector<HTMLElement>('.lk-pagina') ?? null, []);

  /** Busca de nuevo en lo que hay dibujado. `ir`: a cuál saltar (y llevarla a la vista); null = quedarse donde estaba. */
  const buscar = useCallback((ir: number | null) => {
    const raiz = pagina();
    const { segmentos, nodos } = raiz && consulta.trim() ? recolectar(raiz) : { segmentos: [], nodos: [] };
    const { resultados, cortado } = buscarEnSegmentos(segmentos, consulta);
    const rs: Range[] = [];
    for (const m of resultados) {
      try {
        const r = document.createRange();
        r.setStart(nodos[m.desde.seg], m.desde.off);
        r.setEnd(nodos[m.hasta.seg], m.hasta.off);
        rs.push(r);
      } catch { /* un nodo que cambió entre la lectura y el rango: se saltea, la próxima pasada lo toma */ }
    }
    rangos.current = rs;
    let i = ir ?? actual.current;
    if (i >= rs.length) i = rs.length - 1;
    if (rs.length && i < 0) i = 0;
    actual.current = rs.length ? i : -1;
    pintar(rs, actual.current);
    setEstado({ total: rs.length, actual: actual.current, cortado });
    if (ir !== null && actual.current >= 0) llevarALaVista(rs[actual.current]);
  }, [consulta, pagina]);

  // El respiro al tipear.
  useEffect(() => {
    const t = setTimeout(() => setConsulta(q), q.trim() ? ESPERA_TIPEO_MS : 0);
    return () => clearTimeout(t);
  }, [q]);

  // Una consulta nueva: a la primera coincidencia. Y mientras haya consulta, se repinta sola cuando cambia la
  // página (llegan datos, se cambia de hoja, se pliega una sección), sin mover la vista.
  useEffect(() => {
    buscar(consulta.trim() ? 0 : null);
    const raiz = pagina();
    if (!raiz || !consulta.trim()) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const mo = new MutationObserver(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => buscar(null), ESPERA_CAMBIOS_MS);
    });
    // Sin `style`: el tooltip de un gráfico lo reescribe en cada movimiento del mouse, y se repintaría sin parar.
    mo.observe(raiz, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'open'] });
    return () => { mo.disconnect(); if (t) clearTimeout(t); };
  }, [consulta, buscar, pagina]);

  // Al irse, nada queda pintado.
  useEffect(() => () => { rangos.current = []; pintar([], -1); }, []);

  const ir = (delta: 1 | -1) => {
    const total = rangos.current.length;
    const sig = vecina(actual.current, total, delta);
    if (sig < 0) return;
    actual.current = sig;
    pintar(rangos.current, sig);
    setEstado((e) => ({ ...e, actual: sig }));
    llevarALaVista(rangos.current[sig]);
  };

  // Ctrl/Cmd+F con el foco en el Dashboard enfoca la barra; con la barra ya enfocada, es el del navegador.
  useEffect(() => {
    const toque = (e: PointerEvent) => {
      const app = caja.current?.closest('.lk-app');
      ultimoToque.current = app && e.target instanceof Node && app.contains(e.target) ? 'dentro' : 'afuera';
    };
    const tecla = (e: KeyboardEvent) => {
      const el = input.current;
      if (!el) return;
      const act = document.activeElement;
      const app = caja.current?.closest('.lk-app');
      const foco: FocoBuscar = act === el ? 'barra'
        : !act || act === document.body ? (ultimoToque.current === 'afuera' ? 'afuera' : 'dashboard')
          : app?.contains(act) ? 'dashboard' : 'afuera';
      if (!atajoBuscar(e, foco)) return;
      e.preventDefault();
      el.focus();
      el.select();
    };
    document.addEventListener('pointerdown', toque, true);
    window.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', toque, true); window.removeEventListener('keydown', tecla); };
  }, []);

  const teclas = (e: KeyboardEventReact<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Con el respiro todavía corriendo, Enter busca YA lo escrito (y va a la primera).
      if (consulta !== q) { setConsulta(q); return; }
      ir(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      if (!q) { input.current?.blur(); return; }
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();
      setQ('');
    }
  };

  const hay = q.trim().length > 0;
  return (
    <div ref={caja} className="bh" role="search" data-recorrido="dash-buscar">
      <EstilosBuscar />
      <span className="bh-lupa"><IconoMenu nombre="buscar" size={15} /></span>
      <input ref={input} className="bh-input" type="text" value={q} maxLength={80} spellCheck={false} autoComplete="off"
        placeholder="Buscar" aria-label="Buscar en la hoja" onChange={(e) => setQ(e.target.value)} onKeyDown={teclas} />
      {hay && (
        <>
          <span className="bh-cuenta" aria-live="polite">{textoContador(estado.actual, estado.total, estado.cortado)}</span>
          <button type="button" className="bh-flecha" aria-label="Anterior" title="Anterior (Shift+Enter)" disabled={!estado.total} onClick={() => ir(-1)}><Flecha arriba /></button>
          <button type="button" className="bh-flecha" aria-label="Siguiente" title="Siguiente (Enter)" disabled={!estado.total} onClick={() => ir(1)}><Flecha /></button>
        </>
      )}
    </div>
  );
}

const parar = (e: SyntheticEvent) => e.stopPropagation();
const RESPIRO_TABLA_MS = 300;

/**
 * La barra de una TABLA (interfaz I2: `<BuscarEnTabla grafico onVista />`, en la cabecera de una tarjeta con
 * `tabla.buscar`). Su control es el que decide `idBusquedaDe` (./exportar.ts) —el `texto` que `conBusqueda` le
 * pone a la tabla mientras tenga la barra, sin guardarlo—; sin barra prendida (o con una lista sobre ese campo)
 * no dibuja nada.
 *   · `vista`: si viene, el input muestra lo que la vista tiene en ese control («Restablecer» lo vacía); sin
 *     ella, lo último que se escribió acá.
 *   · `compartido` (+ `hoja`): en un link no se dibuja sobre un campo de personas (el server del link no aplica
 *     esa búsqueda). Con el link y sin la hoja para preguntarlo, tampoco: ante la duda, no se ofrece.
 */
export function BuscarEnTabla({ grafico, onVista, vista, hoja, compartido = null }: {
  grafico: Grafico;
  onVista: (id: string, valor: ValorControl) => void;
  vista?: VistaValores;
  hoja?: Hoja;
  compartido?: Compartido | null;
}) {
  const id = grafico.tabla?.buscar ? idBusquedaDe(grafico) : null;
  const c = id ? conBusqueda(grafico).controles.find((k) => k.id === id) ?? null : null;
  // Lo que se está tipeando y todavía no fue a la vista (null = nada pendiente: se muestra lo de la vista).
  const [borrador, setBorrador] = useState<string | null>(null);
  // Sin `vista`: lo último que esta barra mandó (null = nada todavía: lo de entrada del control).
  const [escrito, setEscrito] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendiente = useRef<{ id: string; texto: string } | null>(null);
  const mandar = useRef(onVista);
  useEffect(() => { mandar.current = onVista; }, [onVista]);
  const soltar = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const p = pendiente.current;
    if (!p) return;
    pendiente.current = null;
    mandar.current(p.id, { texto: p.texto });
    setEscrito(p.texto);
    setBorrador(null);
  }, []);
  // Al irse (se apagó la barra, se cambió de hoja), lo escrito se aplica igual: no se tira.
  useEffect(() => () => soltar(), [soltar]);

  if (!c || !c.campo) return null;
  if (compartido && (!hoja || !campoCompartible(hoja, c.campo))) return null;
  const visto = vista ? conVista(c, vista).texto : escrito ?? c.texto;
  const valor = borrador ?? visto;
  const cambiar = (v: string) => {
    setBorrador(v);
    pendiente.current = { id: c.id, texto: v };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(soltar, RESPIRO_TABLA_MS);
  };
  return (
    <div className="bh bh--tabla lk-no-arrastrar" onMouseDown={parar} onPointerDown={parar} onTouchStart={parar} onClick={parar}>
      <EstilosBuscar />
      <span className="bh-lupa"><IconoMenu nombre="buscar" size={14} /></span>
      <input className="bh-input" type="text" value={valor} maxLength={80} spellCheck={false} autoComplete="off"
        placeholder="Buscar" aria-label={`Buscar en ${tituloControl(c)}`}
        onChange={(e) => cambiar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); soltar(); }
          if (e.key === 'Escape' && valor) { e.preventDefault(); e.nativeEvent.stopImmediatePropagation(); pendiente.current = { id: c.id, texto: '' }; soltar(); }
        }} />
      {valor && (
        <button type="button" className="bh-x" aria-label="Borrar la búsqueda" title="Borrar la búsqueda"
          onClick={() => { pendiente.current = { id: c.id, texto: '' }; soltar(); }}>
          <IconoMenu nombre="cerrar" size={12} />
        </button>
      )}
    </div>
  );
}

// ── Estilos ─────────────────────────────────────────────────────────────────────────────────
// Sólo tokens. La barra tiene el alto y el radio de las pastillas de la topbar (.lk-pill, 36 px), así la fila
// no tiene dos alturas; la de una tabla, el de los botones de una tarjeta. Piso de letra: 13 px.
// El resalte: todas las coincidencias con el ámbar de MaKo a media tinta (se lee el texto de abajo en los
// dos temas), y la que se está mirando con el azul de la casa, como un botón primario.

function EstilosBuscar() {
  return <style href="bh-buscar" precedence="medium">{CSS_BUSCAR}</style>;
}

const CSS_BUSCAR = `
.bh { position: relative; display: inline-flex; align-items: center; gap: 2px; flex: 0 1 240px; min-width: 150px; height: 36px; padding: 0 4px 0 34px; box-sizing: border-box; border: 1px solid var(--border-strong); border-radius: 18px; background: var(--surface); color: var(--ink); }
.bh:focus-within { border-color: var(--primary); box-shadow: var(--focus-ring); }
.bh-lupa { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); display: inline-flex; color: var(--faint); pointer-events: none; }
.bh-input { flex: 1 1 auto; min-width: 0; height: 100%; padding: 0 4px 0 0; border: 0; outline: none; background: transparent; color: var(--ink); font: inherit; font-size: 13.5px; }
.bh-input::placeholder { color: var(--faint); }
.bh-cuenta { flex: none; padding: 0 6px; color: var(--dim); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; white-space: nowrap; }
.bh-flecha, .bh-x { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 14px; background: transparent; color: var(--dim); cursor: pointer; }
.bh-flecha:hover:not(:disabled), .bh-x:hover { background: var(--velo-hover); color: var(--ink); }
.bh-flecha:disabled { color: var(--faint); cursor: default; opacity: .6; }
.bh-flecha:focus-visible, .bh-x:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.bh--tabla { flex: 0 1 200px; min-width: 120px; height: 30px; padding-left: 30px; border-radius: 8px; border-color: var(--border); }
.bh--tabla .bh-lupa { left: 10px; }
.bh--tabla .bh-x { width: 24px; height: 24px; border-radius: 6px; }
::highlight(lk-buscar) { background-color: color-mix(in srgb, var(--mako) 40%, transparent); }
::highlight(lk-buscar-actual) { background-color: var(--primary); color: var(--on-primary); }
@media print { ::highlight(lk-buscar), ::highlight(lk-buscar-actual) { background-color: transparent; color: inherit; } }
@media (max-width: 760px) { .bh { flex: 1 1 160px; } }
`;
