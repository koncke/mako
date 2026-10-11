'use client';

// =============================================================================
// BarraControles — los filtros de la VISTA: la barra de la página y los de cada gráfico
// =============================================================================
// Martín, 11/10/2026:
//   12. «El botón de "Añadir control", no debería ser algo que aparezca en la tab de edición, sino que
//       justamente es una forma de añadir filtros en la vista. Y faltan más opciones de "Añadir
//       Control"... siempre configurado en el mismo lugar, como en una topbar del lienzo que se desplaza
//       con el scroll y tiene los controles que le puse.»
//   13. «es importante poder agregar un control a cada grafico... Por si quiero algo personalizado. Solo
//       revisa que eso no produzca bugs. Como por ejemplo, que se pisen los filtros sin sentido.»
//   14. «Ahí vi que "Control" se agrega abajo del todo... Eso está mal, siempre arriba como en una topbar.»
//
// Tres piezas, las tres con el MISMO popover por control:
//   · `BarraControles`: la fila de la página. Un botón por control con su resumen («Últimos 7 días»,
//     «Campaña · 2»), «＋ Filtro» al final y «Restablecer» si hay algo elegido. La pega arriba del lienzo
//     la pantalla (EditorInforme.tsx): esto es sólo la fila.
//   · `ChipsControles`: en la cabecera de una tarjeta, los controles PROPIOS del gráfico como chips
//     chicos, y dos avisos tenues: «Período propio» y «No filtra por X». Un número sin filtrar que se lee
//     como filtrado es peor que ningún filtro.
//   · `EditorControlesComp`: en el panel de propiedades, la lista de los controles del gráfico y
//     «Agregar control a este gráfico».
//
// ⚠️ LO QUE SE ELIGE MIRANDO VA A LA VISTA Y NO SE GUARDA (`onVista`): es estado de la vista, como en
//    Looker. Lo único que cambia el INFORME es agregar o quitar un control y «Lo que muestra de
//    entrada» (`onCambiar` / `onCambiarComp`). `tests/dashboard-controles.test.ts` lo fija leyendo este
//    archivo: si el camino de mirar llama a `onCambiar`, cada clic en una casilla se autoguarda y le
//    cambia el informe a todos los que lo abren.
// ⚠️ QUIÉN GANA SOBRE QUIÉN no se decide acá: lo decide `efectivoDe` (lib/graficos-catalogo.ts). Acá se
//    dibuja lo que esa función ya resolvió (`efectivo.propio`, `efectivo.noAplica`).
// ⚠️ El popover se PORTALEA al body: una tarjeta recorta (`overflow: hidden`) y la barra es sticky — un
//    sticky con z-index le clampea el z-index a todo lo que nace adentro (AGENTS.md). Y como un portal de
//    React sigue BURBUJEANDO por el árbol de React, el popover frena el mousedown y el click: si no, un
//    clic en una casilla arrastraba la tarjeta de atrás (react-grid-layout escucha el mousedown).

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as KeyboardEventReact, type ReactNode, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { Spinner, shadow } from '@/app/_ui';
import { BotonBorrar, IconoBorrar } from '@/app/_ui/BotonBorrar';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { useCapaModal } from '@/app/_components/pila-modales';
import { esFechaValida, hoyEnTijuana } from '@/lib/date-utils';
import {
  AGRUPAR, MAX_CONTROLES, MAX_VALORES, PRESETS, conVista, efectivoDe, rangoDe,
  type Bloque, type ControlVista, type Efectivo, type Grafico, type Hoja, type TipoControl, type ValorControl, type VistaValores,
} from '@/lib/graficos-catalogo';
import {
  alternarValor, camposParaComp, camposParaHoja, detalleControl, distintoDeEntrada, fuentesDelCampoEnHoja, hayVistaElegida,
  nuevoControlPara, opcionesAgregar, opcionesDeLista, parcheDeEntrada, periodoDePagina, pintaActivo, rangoCorto, rangoDelControl,
  resumenControl, tituloControl, TOPE_VALORES_RUTA, type Nivel,
} from '@/lib/graficos-controles-texto';
import { useValoresCampo } from './valores';

type Modo = 'vista' | 'entrada';
/** Lo que una lista necesita para pedir sus valores: el período que mira y en qué conjuntos contar. */
type Contexto = { desde: string; hasta: string; fuentes?: string[] };

const ICONO: Record<TipoControl, NombreIconoMenu> = { periodo: 'calendario', lista: 'filtro', texto: 'buscar', agrupar: 'grafico' };
const norm = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Frena el evento en el árbol de React (ver la cabecera: el portal burbujea hasta la tarjeta). */
const parar = (e: SyntheticEvent) => e.stopPropagation();

// ── El popover ──────────────────────────────────────────────────────────────────────────────

type Pos = { left: number; top?: number; bottom?: number; alto: number };
const mismaPos = (a: Pos | null, b: Pos) => !!a && a.left === b.left && a.top === b.top && a.bottom === b.bottom && a.alto === b.alto;

/**
 * Un panel anclado a un botón (el molde es `Flotante` de EditorInforme.tsx), con tres cosas más:
 *   · Se registra en la pila de capas (`anidada`: no tapa lo de abajo) y el Escape lo escucha en
 *     `window` EN CAPTURA con `stopImmediatePropagation`: `esElDeArriba()` dice si le toca contestar,
 *     no impide que conteste otro, y todos los Escape de la casa viven en `document` (AGENTS.md).
 *   · Las teclas que nacen adentro no llegan a los atajos del editor: un Suprimir con el foco en una
 *     opción borraba el gráfico elegido. React despacha desde `document`, que registró su listener
 *     antes que el editor, así que `stopImmediatePropagation` adentro del handler lo frena.
 *   · Arriba o abajo del botón según dónde haya lugar; arriba se ancla por `bottom`, así crece hacia
 *     arriba sin tener que adivinar su alto.
 */
function Popover({ ancla, etiqueta, ancho, onCerrar, children }: { ancla: HTMLElement; etiqueta: string; ancho: number; onCerrar: () => void; children: ReactNode }) {
  const capa = useCapaModal(true, { anidada: true });
  const esArriba = capa.esElDeArriba;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const cerrar = useRef(onCerrar);
  useEffect(() => { cerrar.current = onCerrar; }, [onCerrar]);

  useLayoutEffect(() => {
    const ubicar = () => {
      const p = ref.current;
      if (!p) return;
      if (!ancla.isConnected) { cerrar.current(); return; }
      const a = ancla.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const left = Math.round(Math.min(Math.max(8, a.left), Math.max(8, vw - p.offsetWidth - 8)));
      const libreAbajo = Math.round(vh - a.bottom - 14);
      const libreArriba = Math.round(a.top - 14);
      const nueva: Pos = libreAbajo >= 300 || libreAbajo >= libreArriba
        ? { left, top: Math.round(a.bottom + 6), alto: Math.max(140, libreAbajo) }
        : { left, bottom: Math.round(vh - a.top + 6), alto: Math.max(140, libreArriba) };
      setPos((x) => (mismaPos(x, nueva) ? x : nueva));
    };
    ubicar();
    // El panel cambia de ancho al llegar los valores, y el BOTÓN de largo al elegir («Campaña · 2»).
    const ro = new ResizeObserver(ubicar);
    if (ref.current) ro.observe(ref.current);
    ro.observe(ancla);
    // En captura: lo que scrollea es el lienzo, y un `scroll` de un contenedor no burbujea a `window`.
    const alScroll = (e: Event) => { if (e.target instanceof Node && ref.current?.contains(e.target)) return; ubicar(); };
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', alScroll, true);
    return () => { ro.disconnect(); window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', alScroll, true); };
  }, [ancla]);

  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || ref.current?.contains(t) || ancla.contains(t)) return;
      cerrar.current();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !esArriba()) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      cerrar.current();
    };
    document.addEventListener('pointerdown', fuera, true);
    window.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('pointerdown', fuera, true); window.removeEventListener('keydown', tecla, true); };
  }, [ancla, esArriba]);

  // El foco entra cuando el panel ya se ve: un `autoFocus` sobre algo con `visibility: hidden` no llega.
  const enfocado = useRef(false);
  useEffect(() => {
    if (!pos || enfocado.current) return;
    enfocado.current = true;
    const p = ref.current;
    const el = p?.querySelector<HTMLElement>('[data-foco]') ?? p?.querySelector<HTMLElement>('input, button:not(:disabled)');
    el?.focus({ preventScroll: true });
  }, [pos]);
  // Y vuelve al botón al cerrar, si estaba adentro (un clic afuera ya lo puso en otro lado).
  useLayoutEffect(() => {
    const p = ref.current;
    return () => { if (p && p.contains(document.activeElement)) ancla.focus({ preventScroll: true }); };
  }, [ancla]);

  const teclas = (e: KeyboardEventReact) => { e.stopPropagation(); if (e.key !== 'Escape') e.nativeEvent.stopImmediatePropagation(); };

  return createPortal(
    <div ref={ref} className="bc-pop" role="dialog" aria-label={etiqueta} data-bc=""
      style={{ left: pos?.left ?? -9999, top: pos?.top, bottom: pos?.bottom, maxHeight: pos?.alto, minWidth: ancho, visibility: pos ? 'visible' : 'hidden' }}
      onClick={parar} onMouseDown={parar} onPointerDown={parar} onTouchStart={parar} onDoubleClick={parar} onContextMenu={parar} onKeyDown={teclas}>
      {children}
    </div>,
    document.body,
  );
}

function Chevron() {
  return <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="bc-chev"><path d="m6 9 6 6 6-6" /></svg>;
}
function Marca({ si }: { si: boolean }) {
  return <span className="bc-marca">{si && <IconoMenu nombre="check" size={14} />}</span>;
}

// ── Los paneles: cada uno sólo ELIGE. A dónde va lo elegido lo decide `BotonControl` ─────────────

function PanelPeriodo({ c, hoy, onElegir, onListo }: { c: ControlVista; hoy: string; onElegir: (v: ValorControl) => void; onListo: () => void }) {
  const r = rangoDelControl(c, hoy);
  const [abierto, setAbierto] = useState(c.preset === 'personalizado');
  const [desde, setDesde] = useState(r.desde);
  const [hasta, setHasta] = useState(r.hasta);
  const valido = esFechaValida(desde) && esFechaValida(hasta) && desde <= hasta;
  const esPers = c.preset === 'personalizado';
  return (
    <div className="bc-cuerpo" role="radiogroup" aria-label="Período">
      <div className="bc-nota bc-nota--arriba">{rangoCorto(r.desde, r.hasta, hoy)}</div>
      {PRESETS.filter((p) => p.id !== 'personalizado').map((p) => {
        const rp = rangoDe(p.id, hoy);
        const actual = c.preset === p.id;
        return (
          <button key={p.id} type="button" role="radio" aria-checked={actual} className="bc-opcion" data-foco={actual || undefined}
            onClick={() => { onElegir({ preset: p.id, desde: null, hasta: null }); onListo(); }}>
            <Marca si={actual} />
            <span className="bc-opcion-txt">{p.nombre}</span>
            <span className="bc-dim">{rangoCorto(rp.desde, rp.hasta, hoy)}</span>
          </button>
        );
      })}
      <button type="button" aria-pressed={esPers} aria-expanded={abierto} className="bc-opcion" data-actual={esPers || undefined} data-foco={esPers || undefined} onClick={() => setAbierto((x) => !x)}>
        <Marca si={esPers} />
        <span className="bc-opcion-txt">Personalizado</span>
        <Chevron />
      </button>
      {abierto && (
        <div className="bc-fechas">
          <label className="bc-fecha">Desde<input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className="bc-fecha">Hasta<input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} /></label>
          <button type="button" className="bc-aplicar" disabled={!valido} onClick={() => { onElegir({ preset: 'personalizado', desde, hasta }); onListo(); }}>Aplicar</button>
        </div>
      )}
    </div>
  );
}

function PanelLista({ c, ctx, onElegir }: { c: ControlVista; ctx: Contexto; onElegir: (v: ValorControl) => void }) {
  const [q, setQ] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const est = useValoresCampo(c.campo, ctx.desde, ctx.hasta, ctx.fuentes);
  const { opciones, ocultos } = opcionesDeLista(est.valores, c.valores, q);
  const todos = !c.valores || !c.valores.length;
  const alternar = (valor: string) => {
    const r = alternarValor(c.valores, valor);
    setAviso(r.topeado ? `Hasta ${MAX_VALORES} valores` : null);
    if (!r.topeado) onElegir({ valores: r.valores });
  };
  return (
    <div className="bc-cuerpo">
      <div className="bc-buscar">
        <IconoMenu nombre="buscar" size={14} />
        <input data-foco="" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar un valor" />
      </div>
      <label className="bc-fila">
        <input type="checkbox" checked={todos} onChange={() => { setAviso(null); onElegir({ valores: null }); }} />
        <span className="bc-fila-txt">Todos</span>
      </label>
      {est.cargando && <div className="bc-estado"><Spinner size={14} /> Cargando valores</div>}
      {!est.cargando && est.error && (
        <div className="bc-estado bc-estado--error">No se pudieron leer los valores. <button type="button" className="bc-link" onClick={est.reintentar}>Reintentar</button></div>
      )}
      {!est.cargando && !est.error && !opciones.length && (
        // «No llegó» y no «No hay»: la ruta contesta una lista vacía también cuando la lectura falló.
        <div className="bc-estado">{est.valores.length ? 'Ningún valor contiene eso.' : 'No llegó ningún valor.'}</div>
      )}
      {opciones.map((o) => (
        <div key={o.valor} className="bc-fila">
          <label className="bc-fila-lbl">
            <input type="checkbox" checked={o.elegido} onChange={() => alternar(o.valor)} />
            <span className="bc-fila-txt" title={o.valor}>{o.valor}</span>
          </label>
          <button type="button" className="bc-solo" onClick={() => { setAviso(null); onElegir({ valores: [o.valor] }); }} aria-label={`Sólo ${o.valor}`}>Sólo este</button>
          <span className="bc-cuenta" title="Filas en este período">{o.filas.toLocaleString('es-MX')}</span>
        </div>
      ))}
      {ocultos > 0 && <div className="bc-nota">Y {ocultos.toLocaleString('es-MX')} más: usa el buscador.</div>}
      {est.valores.length >= TOPE_VALORES_RUTA && <div className="bc-nota">Llegan los {TOPE_VALORES_RUTA} con más filas.</div>}
      {aviso && <div className="bc-nota bc-nota--aviso" role="status">{aviso}</div>}
    </div>
  );
}

/**
 * La búsqueda: se aplica sola a los 300 ms de dejar de tipear (un pedido de datos por tecla serían
 * diez por palabra), con Enter al instante, y al cerrar se aplica lo que quedó pendiente: cerrar el
 * popover no puede tirar lo que se escribió.
 */
function PanelTexto({ c, onElegir, onListo }: { c: ControlVista; onElegir: (v: ValorControl) => void; onListo: () => void }) {
  const [t, setT] = useState(c.texto);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendiente = useRef<string | null>(null);
  const elegir = useRef(onElegir);
  useEffect(() => { elegir.current = onElegir; }, [onElegir]);
  const soltar = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (pendiente.current === null) return;
    const v = pendiente.current;
    pendiente.current = null;
    elegir.current({ texto: v });
  }, []);
  useEffect(() => () => soltar(), [soltar]);
  const cambiar = (v: string) => {
    setT(v);
    pendiente.current = v;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(soltar, 300);
  };
  return (
    <div className="bc-cuerpo">
      <div className="bc-buscar">
        <IconoMenu nombre="buscar" size={14} />
        <input data-foco="" value={t} maxLength={80} placeholder="Contiene…" aria-label={`Buscar en ${tituloControl(c)}`}
          onChange={(e) => cambiar(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); soltar(); onListo(); } }} />
        {t && (
          <button type="button" className="bc-x" aria-label="Borrar el texto" title="Borrar el texto" onClick={() => { setT(''); pendiente.current = ''; soltar(); }}>
            <IconoMenu nombre="cerrar" size={12} />
          </button>
        )}
      </div>
      <div className="bc-nota">No distingue mayúsculas ni acentos.</div>
    </div>
  );
}

function PanelAgrupar({ c, onElegir, onListo }: { c: ControlVista; onElegir: (v: ValorControl) => void; onListo: () => void }) {
  return (
    <div className="bc-cuerpo" role="radiogroup" aria-label="Agrupar por">
      {AGRUPAR.map((a) => {
        const actual = c.agrupar === a.id;
        return (
          <button key={a.id} type="button" role="radio" aria-checked={actual} className="bc-opcion" data-foco={actual || undefined}
            onClick={() => { onElegir({ agrupar: a.id }); onListo(); }}>
            <Marca si={actual} />
            <span className="bc-opcion-txt">{a.nombre}</span>
            {a.id === 'auto' && <span className="bc-dim">según el período</span>}
          </button>
        );
      })}
      <div className="bc-nota">Sólo cambia los gráficos que van por fecha.</div>
    </div>
  );
}

// ── Un control: su botón y su popover ───────────────────────────────────────────────────────

type PropsBoton = {
  /** El control GUARDADO (lo que muestra de entrada). */
  c: ControlVista;
  vista: VistaValores;
  hoy: string;
  ctx: Contexto;
  chico?: boolean;
  /** Editando el informe: suma «Lo que muestra de entrada» y «Quitar». */
  editando: boolean;
  /** El panel de propiedades: sólo edita lo de entrada (no hay vista ahí). */
  soloEntrada?: boolean;
  onVista?: (id: string, valor: ValorControl) => void;
  onCambiar: (id: string, parche: Partial<ControlVista>) => void;
  onQuitar: (id: string) => void;
  /** Recién agregado: se abre solo, para que la persona lo configure sin buscarlo. */
  autoAbrir?: boolean;
  onAutoAbierto?: () => void;
};

function BotonControl({ c, vista, hoy, ctx, chico, editando, soloEntrada, onVista, onCambiar, onQuitar, autoAbrir, onAutoAbierto }: PropsBoton) {
  const btn = useRef<HTMLButtonElement>(null);
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const [modo, setModo] = useState<Modo>(soloEntrada ? 'entrada' : 'vista');
  const cerrar = useCallback(() => setAncla(null), []);
  const listo = useRef(onAutoAbierto);
  useEffect(() => { listo.current = onAutoAbierto; }, [onAutoAbierto]);
  // En el cuadro siguiente: el botón recién montado ya tiene su lugar, y el popover se mide contra él.
  useEffect(() => {
    if (!autoAbrir) return;
    const id = requestAnimationFrame(() => {
      if (!btn.current) return;
      setModo(soloEntrada ? 'entrada' : 'vista');
      setAncla(btn.current);
      listo.current?.();
    });
    return () => cancelAnimationFrame(id);
  }, [autoAbrir, soloEntrada]);

  // Lo que se ve en el botón: lo que se está mirando (o, en el panel de propiedades, lo de entrada).
  const visto = soloEntrada ? c : conVista(c, vista);
  const cambiado = !soloEntrada && distintoDeEntrada(c, vista);

  // ⚠️ MIRANDO, lo elegido va a la VISTA y NO se guarda. Sólo «Lo que muestra de entrada» toca el
  //    informe, y de paso alinea la vista: si no, una elección vieja seguiría tapando lo que se acaba
  //    de guardar y parecería que no se guardó.
  const elegirMirando = (v: ValorControl) => onVista?.(c.id, v);
  const elegirDeEntrada = (v: ValorControl) => { onCambiar(c.id, parcheDeEntrada(c.tipo, v)); onVista?.(c.id, v); };
  const onElegir = modo === 'vista' ? elegirMirando : elegirDeEntrada;
  const enPanel = modo === 'vista' ? visto : c;

  const abrir = () => {
    setModo(soloEntrada ? 'entrada' : 'vista');
    setAncla((a) => (a ? null : btn.current));
  };
  const titulo = tituloControl(c);
  const panel = (() => {
    switch (c.tipo) {
      case 'periodo': return <PanelPeriodo key={modo} c={enPanel} hoy={hoy} onElegir={onElegir} onListo={cerrar} />;
      case 'lista': return <PanelLista key={modo} c={enPanel} ctx={ctx} onElegir={onElegir} />;
      case 'texto': return <PanelTexto key={modo} c={enPanel} onElegir={onElegir} onListo={cerrar} />;
      case 'agrupar': return <PanelAgrupar key={modo} c={enPanel} onElegir={onElegir} onListo={cerrar} />;
    }
  })();

  return (
    <>
      <button ref={btn} type="button" className={chico ? 'bc-btn bc-btn--chico' : 'bc-btn'} data-activo={pintaActivo(visto) || undefined}
        aria-haspopup="dialog" aria-expanded={!!ancla} title={detalleControl(visto, hoy)} onClick={abrir}>
        <IconoMenu nombre={ICONO[c.tipo]} size={chico ? 12 : 14} />
        <span className="bc-btn-txt">{resumenControl(visto, hoy)}</span>
        {!chico && c.tipo === 'periodo' && visto.preset !== 'personalizado' && (() => { const r = rangoDelControl(visto, hoy); return <span className="bc-rango">{rangoCorto(r.desde, r.hasta, hoy)}</span>; })()}
        {cambiado && <span className="bc-punto" aria-hidden title="Distinto de lo que muestra de entrada" />}
        <Chevron />
      </button>
      {ancla && (
        <Popover ancla={ancla} etiqueta={titulo} ancho={c.tipo === 'lista' ? 300 : c.tipo === 'periodo' ? 290 : 250} onCerrar={cerrar}>
          <div className="bc-pop-cab">
            <span className="bc-pop-tit">{titulo}</span>
            {modo === 'entrada' && <span className="bc-pop-modo">De entrada</span>}
          </div>
          {panel}
          {editando && (
            <div className="bc-pop-pie">
              {!soloEntrada && (modo === 'vista'
                ? <button type="button" className="bc-pie-btn" onClick={() => setModo('entrada')}>Lo que muestra de entrada</button>
                : <button type="button" className="bc-pie-btn" onClick={() => setModo('vista')}>Volver a lo que ves</button>)}
              <button type="button" className="bc-pie-btn bc-quitar" onClick={() => { cerrar(); onQuitar(c.id); }}>
                <IconoBorrar size={14} /> Quitar
              </button>
            </div>
          )}
        </Popover>
      )}
    </>
  );
}

// ── «＋ Filtro» / «Agregar control a este gráfico» ─────────────────────────────────────────────

function MenuAgregar({ nivel, texto, clase, onAgregar }: { nivel: Nivel; texto: string; clase: string; onAgregar: (c: ControlVista) => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const [paso, setPaso] = useState<'lista' | 'texto' | null>(null);
  const [q, setQ] = useState('');
  const cerrar = useCallback(() => setAncla(null), []);
  const opciones = opcionesAgregar(nivel);
  const abrir = () => { setPaso(null); setQ(''); setAncla((a) => (a ? null : btn.current)); };
  const agregar = (tipo: TipoControl, campo: string | null) => {
    const nuevo = nuevoControlPara(tipo, campo, nivel);
    setAncla(null);
    if (nuevo) onAgregar(nuevo);
  };
  // Al pasar a elegir el campo, el foco va al buscador: el del popover ya se usó al abrir.
  const buscador = useRef<HTMLInputElement>(null);
  useEffect(() => { if (paso) buscador.current?.focus({ preventScroll: true }); }, [paso]);
  const enHoja = nivel.nivel === 'hoja';
  const campos = !paso ? [] : nivel.nivel === 'hoja' ? camposParaHoja(nivel.hoja) : camposParaComp(nivel.comp);
  const busca = norm(q.trim());
  const pasan = campos.filter((c) => !busca || norm(c.nombre).includes(busca));
  const grupos = enHoja
    ? [{ tit: 'En esta página', lista: pasan.filter((c) => c.graficos > 0) }, { tit: 'Otros campos', lista: pasan.filter((c) => c.graficos === 0) }]
    : [{ tit: '', lista: pasan }];
  const nombrePaso = paso ? opciones.find((o) => o.id === paso)?.nombre ?? '' : '';
  const lleno = opciones.every((o) => o.motivo === `Hasta ${MAX_CONTROLES}`);

  return (
    <>
      <button ref={btn} type="button" className={clase} aria-haspopup="dialog" aria-expanded={!!ancla} onClick={abrir}
        title={lleno ? `Hasta ${MAX_CONTROLES} por ${enHoja ? 'página' : 'gráfico'}` : undefined}>
        <IconoMenu nombre="agregar" size={14} /> <span>{texto}</span>
      </button>
      {ancla && (
        <Popover ancla={ancla} etiqueta={texto} ancho={280} onCerrar={cerrar}>
          {!paso ? (
            <>
              <div className="bc-pop-cab"><span className="bc-pop-tit">{enHoja ? 'Agregar un filtro' : 'Agregar un control'}</span></div>
              <div className="bc-cuerpo">
                {opciones.map((o) => (
                  <button key={o.id} type="button" className="bc-opcion bc-opcion--alta" disabled={!!o.motivo}
                    onClick={() => (o.id === 'lista' || o.id === 'texto' ? setPaso(o.id) : agregar(o.id, null))}>
                    <span className="bc-marca"><IconoMenu nombre={ICONO[o.id]} size={15} /></span>
                    <span className="bc-opcion-txt">
                      <span>{o.nombre}</span>
                      <span className="bc-linea">{o.linea}</span>
                    </span>
                    {o.motivo && <span className="bc-dim">{o.motivo}</span>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="bc-pop-cab">
                <button type="button" className="bc-volver" onClick={() => setPaso(null)} aria-label="Volver a los tipos">
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 6-6 6 6 6" /></svg>
                </button>
                <span className="bc-pop-tit">{nombrePaso}: elige el campo</span>
              </div>
              <div className="bc-cuerpo">
                <div className="bc-buscar">
                  <IconoMenu nombre="buscar" size={14} />
                  <input ref={buscador} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un campo" aria-label="Buscar un campo" />
                </div>
                {grupos.map((gr) => gr.lista.length > 0 && (
                  <div key={gr.tit || 'todos'}>
                    {gr.tit && <div className="bc-grupo">{gr.tit}</div>}
                    {gr.lista.map((c) => (
                      <button key={c.id} type="button" className="bc-opcion" disabled={c.usado} onClick={() => agregar(paso, c.id)}>
                        <span className="bc-opcion-txt">{c.nombre}</span>
                        <span className="bc-dim">{c.usado ? 'Ya está' : enHoja && c.graficos > 0 ? `${c.graficos} ${c.graficos === 1 ? 'gráfico' : 'gráficos'}` : ''}</span>
                      </button>
                    ))}
                  </div>
                ))}
                {!pasan.length && <div className="bc-estado">Ningún campo se llama así.</div>}
              </div>
            </>
          )}
        </Popover>
      )}
    </>
  );
}

// ── Las tres piezas que se exportan ─────────────────────────────────────────────────────────

/**
 * La fila de controles de la página. Lo elegido llama `onVista` (no se guarda); «＋ Filtro» llama
 * `onAgregar` (eso SÍ cambia el informe, y sólo se ofrece si se puede guardar); «Restablecer» limpia la
 * vista. Editando, cada control suma «Lo que muestra de entrada» (`onCambiar`) y «Quitar» (`onQuitar`).
 * La pantalla la pega arriba del lienzo (sticky) y le pone el fondo: esto es sólo la fila.
 */
export function BarraControles({ hoja, vista, editando, guardable, hoy, onVista, onAgregar, onCambiar, onQuitar, onRestablecer }: {
  hoja: Hoja;
  vista: VistaValores;
  editando: boolean;
  guardable: boolean;
  hoy: string;
  onVista: (id: string, valor: ValorControl) => void;
  onAgregar: (c: ControlVista) => void;
  onCambiar: (id: string, parche: Partial<ControlVista>) => void;
  onQuitar: (id: string) => void;
  onRestablecer: () => void;
}) {
  const [abrirId, setAbrirId] = useState<string | null>(null);
  const soltarAbrir = useCallback(() => setAbrirId(null), []);
  const elegido = hayVistaElegida(hoja, vista);
  if (!hoja.controles.length && !guardable && !elegido) return null;
  const rango = periodoDePagina(hoja, vista, hoy);
  return (
    <div className="bc-barra" role="toolbar" aria-label="Filtros de la página" data-bc="">
      <EstilosControles />
      {hoja.controles.map((c) => (
        <BotonControl key={c.id} c={c} vista={vista} hoy={hoy}
          ctx={{ desde: rango.desde, hasta: rango.hasta, fuentes: c.campo ? fuentesDelCampoEnHoja(hoja, c.campo) : undefined }}
          editando={editando && guardable} onVista={onVista} onCambiar={onCambiar} onQuitar={onQuitar}
          autoAbrir={abrirId === c.id} onAutoAbierto={soltarAbrir} />
      ))}
      {guardable && (
        <MenuAgregar nivel={{ nivel: 'hoja', hoja }} texto="Filtro" clase="bc-btn bc-agregar"
          onAgregar={(c) => { onAgregar(c); setAbrirId(c.id); }} />
      )}
      {elegido && (
        <button type="button" className="bc-btn bc-reset" title="Volver a lo que muestra de entrada" onClick={onRestablecer}>
          <IconoMenu nombre="restaurar" size={14} /> <span>Restablecer</span>
        </button>
      )}
    </div>
  );
}

/**
 * En la cabecera de una tarjeta: los controles PROPIOS del gráfico (chips chicos, el mismo popover), un
 * aviso tenue «Período propio» si el gráfico mira sus fechas sin un control que lo diga, y un «No filtra
 * por X» por cada filtro de la página que su conjunto no puede aplicar. Sin nada que decir, no dibuja
 * nada (un contenedor vacío en la cabecera se ve como un hueco).
 */
export function ChipsControles({ comp, vista, efectivo, hoy, editando, onVista, onCambiarComp }: {
  comp: Grafico | Bloque;
  /** La hoja de la tarjeta (el contrato la pasa; hoy los chips no la necesitan: `efectivo` ya la resolvió). */
  hoja: Hoja;
  vista: VistaValores;
  efectivo: Efectivo;
  hoy: string;
  editando: boolean;
  onVista: (id: string, valor: ValorControl) => void;
  onCambiarComp: (parche: { controles: ControlVista[] }) => void;
}) {
  const propios = comp.controles;
  const periodoPropio = efectivo.propio.periodo && !propios.some((c) => c.tipo === 'periodo');
  if (!propios.length && !periodoPropio && !efectivo.noAplica.length) return null;
  const fuentes = comp.clase === 'grafico' ? [comp.fuente] : undefined;
  const cambiar = (id: string, parche: Partial<ControlVista>) => onCambiarComp({ controles: propios.map((x) => (x.id === id ? { ...x, ...parche } : x)) });
  const quitar = (id: string) => onCambiarComp({ controles: propios.filter((x) => x.id !== id) });
  return (
    <div className="bc-chips" data-bc="" onMouseDown={parar} onPointerDown={parar} onTouchStart={parar} onClick={parar}>
      <EstilosControles />
      {propios.map((c) => (
        <BotonControl key={c.id} chico c={c} vista={vista} hoy={hoy} ctx={{ desde: efectivo.desde, hasta: efectivo.hasta, fuentes }}
          editando={editando} onVista={onVista} onCambiar={cambiar} onQuitar={quitar} />
      ))}
      {periodoPropio && (
        <span className="bc-tenue" title={`Este gráfico mira sus propias fechas (${rangoCorto(efectivo.desde, efectivo.hasta, hoy)}), no el período de la página.`}>
          <IconoMenu nombre="calendario" size={11} /> Período propio
        </span>
      )}
      {efectivo.noAplica.map((n) => (
        <span key={n} className="bc-tenue" title={`Sus datos no tienen ${n}: este gráfico no se filtra por eso.`}>No filtra por {n}</span>
      ))}
    </div>
  );
}

/**
 * Para el panel de propiedades: los controles propios del gráfico (o del bloque) y «Agregar control a
 * este gráfico». Acá todo es «de entrada»: cambia el informe, por `onCambiarComp`. `hoy` es opcional
 * (el contrato no lo pasa): sin él, el de Tijuana, que es el mismo con el que el server acota las fechas.
 */
export function EditorControlesComp({ comp, hoja, onCambiarComp, hoy: hoyDado }: {
  comp: Grafico | Bloque;
  hoja: Hoja;
  onCambiarComp: (parche: { controles: ControlVista[] }) => void;
  hoy?: string;
}) {
  const [abrirId, setAbrirId] = useState<string | null>(null);
  const soltarAbrir = useCallback(() => setAbrirId(null), []);
  const hoy = hoyDado ?? hoyEnTijuana();
  const cosa = comp.clase === 'bloque' ? 'bloque' : 'gráfico';
  const efectivo = efectivoDe(comp, hoja, {}, hoy);
  const fuentes = comp.clase === 'grafico' ? [comp.fuente] : undefined;
  const cambiar = (id: string, parche: Partial<ControlVista>) => onCambiarComp({ controles: comp.controles.map((x) => (x.id === id ? { ...x, ...parche } : x)) });
  const quitar = (id: string) => onCambiarComp({ controles: comp.controles.filter((x) => x.id !== id) });
  return (
    <div className="bc-editor" data-bc="">
      <EstilosControles />
      <div className="bc-editor-tit">Controles de este {cosa}</div>
      {comp.controles.length ? (
        <div className="bc-editor-lista">
          {comp.controles.map((c) => (
            <div key={c.id} className="bc-editor-fila">
              <BotonControl c={c} vista={{}} hoy={hoy} ctx={{ desde: efectivo.desde, hasta: efectivo.hasta, fuentes }}
                editando soloEntrada onCambiar={cambiar} onQuitar={quitar} autoAbrir={abrirId === c.id} onAutoAbierto={soltarAbrir} />
              <BotonBorrar talla="sm" title={`Quitar «${tituloControl(c)}»`} onClick={() => quitar(c.id)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="bc-editor-vacio">Ninguno: sigue a la página.</div>
      )}
      <MenuAgregar nivel={{ nivel: 'componente', comp, hoja }} texto={`Agregar control a este ${cosa}`} clase="bc-btn bc-agregar bc-agregar--ancho"
        onAgregar={(c) => { onCambiarComp({ controles: [...comp.controles, c] }); setAbrirId(c.id); }} />
      <div className="bc-editor-regla">Gana sobre el de la hoja en el mismo campo.</div>
    </div>
  );
}

// ── Estilos ─────────────────────────────────────────────────────────────────────────────────
// Sólo tokens de la app: con `html[data-tema="oscuro"]` se dan vuelta solos. Un `<style>` con `href`
// y `precedence`: React lo sube al head UNA vez aunque lo dibujen diez tarjetas.

function EstilosControles() {
  return <style href="bc-controles" precedence="medium">{CSS}</style>;
}

const CSS = `
.bc-barra { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; font-size: var(--fs-sm); color: var(--ink); }
.bc-chips { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; min-width: 0; }
.bc-btn { display: inline-flex; align-items: center; gap: 6px; height: 30px; max-width: 280px; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-sm); line-height: 1; cursor: pointer; white-space: nowrap; transition: background .14s ease, border-color .14s ease, color .14s ease; }
.bc-btn:hover { background: var(--surface-2); border-color: var(--faint); }
.bc-btn:focus-visible, .bc-opcion:focus-visible, .bc-pie-btn:focus-visible, .bc-solo:focus-visible, .bc-link:focus-visible, .bc-volver:focus-visible, .bc-x:focus-visible, .bc-aplicar:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.bc-btn[aria-expanded="true"] { border-color: var(--primary); }
.bc-btn[data-activo] { background: var(--primary-bg); border-color: var(--primary-weak); color: var(--primary-strong); }
.bc-btn[data-activo]:hover { border-color: var(--primary); }
.bc-btn > svg { flex: none; color: var(--dim); }
.bc-btn[data-activo] > svg { color: inherit; }
.bc-btn-txt { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.bc-rango { flex: none; color: var(--faint); font-size: var(--fs-meta); }
.bc-punto { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--primary); }
.bc-chev { flex: none; color: var(--faint); }
.bc-btn--chico { height: 22px; max-width: 200px; gap: 4px; padding: 0 7px; font-size: var(--fs-meta); border-radius: 6px; }
.bc-agregar { border-style: dashed; color: var(--dim); }
.bc-agregar:hover { color: var(--ink); }
.bc-agregar--ancho { width: 100%; max-width: none; justify-content: center; }
.bc-reset { border-color: transparent; background: transparent; color: var(--dim); }
.bc-reset:hover { color: var(--ink); }
.bc-tenue { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 7px; border: 1px dashed var(--border-strong); border-radius: 999px; color: var(--faint); font-size: var(--fs-meta); line-height: 1; white-space: nowrap; cursor: help; }

.bc-pop { position: fixed; z-index: 600; display: flex; flex-direction: column; max-width: calc(100vw - 16px); overflow: hidden; background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: var(--r-md); box-shadow: ${shadow.pop}; font-size: var(--fs-sm); line-height: 1.35; }
.bc-pop-cab { flex: none; display: flex; align-items: center; gap: 8px; padding: 10px 12px 6px; }
.bc-pop-tit { flex: 1 1 auto; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-pop-modo { flex: none; padding: 2px 7px; border-radius: 999px; background: var(--mako-bg); color: var(--mako-ink); font-size: var(--fs-meta); font-weight: 600; }
.bc-cuerpo { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 0 0 6px; }
.bc-pop-pie { flex: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; border-top: 1px solid var(--border); }
.bc-pie-btn { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 9px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-meta); cursor: pointer; }
.bc-pie-btn:hover { background: var(--surface-2); }
.bc-quitar { margin-left: auto; color: var(--bad); border-color: var(--bad); }
.bc-quitar:hover { background: var(--bad-bg); }

.bc-opcion { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 32px; padding: 6px 12px; border: 0; background: transparent; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.bc-opcion:hover:not(:disabled) { background: var(--surface-2); }
.bc-opcion[aria-checked="true"], .bc-opcion[data-actual] { color: var(--primary-strong); font-weight: 600; }
.bc-opcion:disabled { color: var(--faint); cursor: default; }
.bc-opcion--alta { align-items: flex-start; }
.bc-opcion-txt { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; overflow: hidden; text-overflow: ellipsis; }
.bc-linea { color: var(--faint); font-size: var(--fs-meta); font-weight: 400; }
.bc-marca { flex: none; display: inline-flex; width: 16px; justify-content: center; color: var(--primary); }
.bc-dim { flex: none; color: var(--faint); font-size: var(--fs-meta); font-weight: 400; white-space: nowrap; }
.bc-grupo { padding: 8px 12px 3px; color: var(--faint); font-size: var(--fs-meta); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
.bc-nota { padding: 6px 12px; color: var(--faint); font-size: var(--fs-meta); }
.bc-nota--arriba { padding-top: 0; }
.bc-nota--aviso { color: var(--warn); }
.bc-estado { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 8px 12px; color: var(--dim); }
.bc-estado--error { color: var(--bad); }
.bc-link { padding: 0; border: 0; background: transparent; color: var(--primary); font: inherit; text-decoration: underline; cursor: pointer; }

.bc-buscar { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; padding: 2px 10px 6px; background: var(--surface); }
.bc-buscar > svg { position: absolute; left: 19px; color: var(--faint); pointer-events: none; }
.bc-buscar input { width: 100%; height: 32px; padding: 0 30px 0 30px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font: inherit; }
.bc-buscar input::placeholder { color: var(--faint); }
.bc-buscar input:focus { outline: none; border-color: var(--primary); box-shadow: var(--focus-ring); }
.bc-x { position: absolute; right: 15px; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--dim); cursor: pointer; }
.bc-x:hover { background: var(--surface-2); color: var(--ink); }

.bc-fila { display: flex; align-items: center; gap: 8px; min-height: 30px; padding: 3px 12px; cursor: pointer; }
.bc-fila:hover { background: var(--surface-2); }
.bc-fila input[type="checkbox"] { flex: none; width: 15px; height: 15px; margin: 0; accent-color: var(--primary); cursor: pointer; }
.bc-fila-lbl { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 8px; cursor: pointer; }
.bc-fila-txt { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-cuenta { flex: none; min-width: 28px; text-align: right; color: var(--faint); font-size: var(--fs-meta); font-variant-numeric: tabular-nums; }
.bc-solo { flex: none; padding: 2px 6px; border: 0; border-radius: 6px; background: transparent; color: var(--primary); font: inherit; font-size: var(--fs-meta); cursor: pointer; opacity: 0; }
.bc-fila:hover .bc-solo, .bc-solo:focus-visible { opacity: 1; }
.bc-solo:hover { background: var(--primary-bg); }
@media (hover: none) { .bc-solo { opacity: 1; } }

.bc-fechas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 4px 12px 8px 36px; }
.bc-fecha { display: flex; flex-direction: column; gap: 3px; color: var(--dim); font-size: var(--fs-meta); }
.bc-fecha input { height: 30px; padding: 0 6px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-sm); color-scheme: light; }
html[data-tema="oscuro"] .bc-fecha input { color-scheme: dark; }
.bc-fecha input:focus { outline: none; border-color: var(--primary); }
.bc-aplicar { grid-column: 1 / -1; justify-self: end; height: 30px; padding: 0 14px; border: 0; border-radius: var(--r-sm); background: var(--primary); color: var(--on-primary); font: inherit; font-weight: 600; cursor: pointer; }
.bc-aplicar:hover:not(:disabled) { background: var(--primary-strong); }
.bc-aplicar:disabled { opacity: .5; cursor: default; }
.bc-volver { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--dim); cursor: pointer; }
.bc-volver:hover { background: var(--surface-2); color: var(--ink); }

.bc-editor { display: flex; flex-direction: column; gap: 8px; font-size: var(--fs-sm); color: var(--ink); }
.bc-editor-tit { color: var(--dim); font-size: var(--fs-meta); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
.bc-editor-lista { display: flex; flex-direction: column; gap: 6px; }
.bc-editor-fila { display: flex; align-items: center; gap: 6px; }
.bc-editor-fila > .bc-btn { flex: 1 1 auto; max-width: none; }
.bc-editor-vacio, .bc-editor-regla { color: var(--faint); font-size: var(--fs-meta); }
`;
