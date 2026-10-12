'use client';

// =============================================================================
// MenuFiltro — UN botón «Filtro» (embudo + número) y su desplegable, en la topbar y en cada tarjeta
// =============================================================================
// Tanda v5 (12/10/2026), puntos 1, 4 y 14 del pedido de Martín (el texto literal está en
// app/admin/dev/dashboard/bitacora.ts) y la decisión del contrato (docs/relevo/dashboard-v5.md):
// «Un solo botón "Filtro" (embudo + número de filtros activos) en la topbar y en cada tarjeta, con
// desplegable de navegación como el del Plan. El PERÍODO entra adentro como primer renglón (con su resumen
// "Últimos 30 días")… Una hoja sin filtros muestra igual el botón; mirando dice "Esta hoja no tiene
// filtros".»
//
// Hasta v4 cada control era un botón suelto en la topbar y un CHIP en la tarjeta, con otro tamaño y otra
// cara, y en una tarjeta angosta el chip se cortaba («Reunión · Llamadas de…», punto 1). Ahora:
//   · LA RAÍZ del desplegable: un renglón por control (lo que es a la izquierda, lo que tiene puesto a la
//     derecha, ›), el período primero. En una tarjeta, además, dos renglones que sólo INFORMAN: «Período
//     propio» y «No filtra por X» (un número sin filtrar que se lee como filtrado es peor que ningún filtro:
//     el aviso no se puede perder, por eso el embudo además se tiñe de aviso).
//   · ADENTRO de cada renglón, los paneles de siempre (`PanelPeriodo`, `PanelLista`, `PanelTexto`,
//     `PanelAgrupar`), que sólo ELIGEN. A dónde va lo elegido lo decide el modo: mirando, a la VISTA
//     (`onVista`, no se guarda); con «Lo que muestra de entrada», al informe.
//   · EDITANDO, «＋ Agregar filtro» al final de la raíz y, en cada control, «Lo que muestra de entrada» y
//     «Quitar». Mirando NO se agregan filtros (tanda de la topbar, punto 7).
//   · Al pie, sutil, «Restablecer» (lo elegido mirando vuelve a lo de entrada).
//
// ⚠️ LOS FIJOS NO SE DIBUJAN NUNCA (`controlesQueSeVen`, lib/graficos-controles-texto.ts): un filtro de
//    DEFINICIÓN (R1 es R1, «Gasto sin retorno» es sin agendas) decide igual (`efectivoDe`) y se edita en el
//    panel de propiedades. Pero al ESCRIBIR, la lista que se manda es la ENTERA (`todos`, con los fijos): el
//    que la aplica la reemplaza, y un fijo que se pierda acá cambia el número de la tarjeta sin que nadie lo
//    pida. Por la misma razón agregar SUMA a la lista, nunca la reemplaza (hallazgo de la ola 1: desde v5 el
//    período propio de antes vive en `controles`).
// ⚠️ LA BARRA DE UNA TABLA (`tabla.buscar`) es un control `texto` propio que se dibuja como input en la
//    cabecera (./BuscarEnHoja.tsx, `BuscarEnTabla`): no va también acá (dos lugares para el mismo control
//    son dos lugares que se contradicen).
// ⚠️ EL DESPLEGABLE SE PORTALEA al body (`Popover`): una tarjeta recorta (`overflow: hidden`) y un portal de
//    React sigue BURBUJEANDO por el árbol de React, así que el panel frena el mousedown y el click (si no, un
//    clic en una casilla arrastraba la tarjeta de atrás: react-grid-layout escucha el mousedown).
// ⚠️ EN UN INFORME COMPARTIDO (`compartido`, el link sin sesión) los valores de una lista se piden por la
//    ruta del link con el token, la hoja y el control (./valores.ts → ./lectura-compartida.ts).

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as KeyboardEventReact, type ReactNode, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { Spinner, shadow } from '@/app/_ui';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { Icon } from '@/app/_components/icons';
import { useCapaModal } from '@/app/_components/pila-modales';
import { esFechaValida } from '@/lib/date-utils';
import {
  AGRUPAR, MAX_VALORES, PRESETS, conVista, rangoDe,
  type Bloque, type ControlVista, type Efectivo, type Grafico, type Hoja, type TipoControl, type ValorControl, type VistaValores,
} from '@/lib/graficos-catalogo';
import {
  alternarValor, camposParaComp, camposParaHoja, controlesQueSeVen, distintoDeEntrada, fuentesDelCampoEnHoja, hayVistaElegida,
  nuevoControlPara, opcionesAgregar, opcionesDeLista, parcheDeEntrada, periodoDePagina, pintaActivo, rangoCorto, rangoDelControl,
  resumenControl, tituloControl, TOPE_VALORES_RUTA, type Nivel, type OpcionAgregar,
} from '@/lib/graficos-controles-texto';
import { campoDeBusqueda, motivoSinBusqueda, parcheBuscarEnTabla } from '@/lib/graficos-buscar';
import { idBusquedaDe } from './exportar';
import { useValoresCampo, type LecturaLink } from './valores';
import type { Compartido } from './lectura-compartida';

/** Mirando (va a la vista) o «Lo que muestra de entrada» (va al informe). */
export type Modo = 'vista' | 'entrada';
/** De dónde lee una lista en un informe compartido: el link, la hoja y (si es de una tarjeta) el componente. */
export type LecturaLista = { compartido: Compartido; hojaId: string; componenteId?: string };
/** Lo que una lista necesita para pedir sus valores: el período que mira, en qué conjuntos contar y, compartido, de dónde. */
export type Contexto = { desde: string; hasta: string; fuentes?: string[]; lectura?: LecturaLista };

export const ICONO: Record<TipoControl, NombreIconoMenu> = { periodo: 'calendario', lista: 'filtro', texto: 'buscar', agrupar: 'grafico' };
/**
 * El nombre del TIPO en el menú de agregar. La búsqueda de un campo se llama «Contiene…» (punto 4): «Búsqueda»
 * se confundía con la barra de búsqueda de la hoja, que busca en lo DIBUJADO y no filtra datos.
 * ⚠️ El nombre del catálogo (`TIPOS_CONTROL`, lib/graficos-catalogo.ts) todavía dice «Búsqueda»: queda en los
 *    pendientes moverlo allá, así lo dice igual la API de MaKo.
 */
const nombreTipo = (o: Pick<OpcionAgregar, 'id' | 'nombre'>) => (o.id === 'texto' ? 'Contiene…' : o.nombre);
const norm = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Frena el evento en el árbol de React (ver la cabecera: el portal burbujea hasta la tarjeta). */
export const parar = (e: SyntheticEvent) => e.stopPropagation();

// ── Lo que dice cada renglón (puro: lo ejecuta tests/dashboard-controles.test.ts) ─────────────────

/** Cuántos filtros de los que SE VEN están filtrando algo ahora (una lista con valores, un «Contiene…» escrito). */
export function filtrosActivos(controles: readonly ControlVista[], vista: VistaValores): number {
  return controlesQueSeVen(controles).filter((c) => pintaActivo(conVista(c, vista))).length;
}

/** Los renglones en el orden del desplegable: el PERÍODO primero (contrato v5), el resto como están. */
export function ordenFilas(controles: readonly ControlVista[]): ControlVista[] {
  return [...controles.filter((c) => c.tipo === 'periodo'), ...controles.filter((c) => c.tipo !== 'periodo')];
}

/**
 * Los renglones del desplegable: los que SE VEN (sin los fijos), el período primero, y sin el control que es la
 * barra de búsqueda de una tabla (ése se dibuja en la cabecera de la tarjeta).
 */
export function controlesDelMenu(todos: readonly ControlVista[], idBarra?: string | null): ControlVista[] {
  return ordenFilas(controlesQueSeVen(todos).filter((c) => c.id !== idBarra));
}

/**
 * Lo que tiene puesto un control, a la derecha de su renglón (el nombre ya va a la izquierda). Se le pasa el
 * control con la vista encima. Una lista en «todos» dice «Todo» (neutro: el género del campo no se sabe).
 */
export function valorDeFila(c: ControlVista, hoy: string): string {
  switch (c.tipo) {
    case 'periodo': return resumenControl(c, hoy);
    case 'lista': {
      const v = c.valores ?? [];
      return !v.length ? 'Todo' : v.length === 1 ? v[0] : `${v.length} valores`;
    }
    case 'texto': return c.texto.trim() ? `«${c.texto.trim()}»` : 'Todo';
    case 'agrupar': return AGRUPAR.find((a) => a.id === c.agrupar)?.nombre ?? c.agrupar;
  }
}

/** Lo de entrada de un control como un valor de la vista: ponerlo en la vista es «Restablecer» ese control. */
export const valorDeEntrada = (c: ControlVista): ValorControl => ({ preset: c.preset, desde: c.desde, hasta: c.hasta, valores: c.valores, texto: c.texto, agrupar: c.agrupar });

// ── El popover ──────────────────────────────────────────────────────────────────────────────

type Pos = { left: number; top?: number; bottom?: number; alto: number };
const mismaPos = (a: Pos | null, b: Pos) => !!a && a.left === b.left && a.top === b.top && a.bottom === b.bottom && a.alto === b.alto;

/**
 * Un panel anclado a un botón (el molde es `Flotante` de ./Galeria.tsx), con tres cosas más:
 *   · Se registra en la pila de capas (`anidada`: no tapa lo de abajo) y el Escape lo escucha en `window` EN
 *     CAPTURA con `stopImmediatePropagation`: `esElDeArriba()` dice si le toca contestar, no impide que
 *     conteste otro, y todos los Escape de la casa viven en `document` (AGENTS.md). `onEscape` deja que el
 *     contenido lo use primero (volver a la raíz del desplegable); si devuelve false, cierra.
 *   · Las teclas que nacen adentro no llegan a los atajos del editor: un Suprimir con el foco en una opción
 *     borraba el gráfico elegido. React despacha desde `document`, que registró su listener antes que el
 *     editor, así que `stopImmediatePropagation` adentro del handler lo frena.
 *   · Arriba o abajo del botón según dónde haya lugar; arriba se ancla por `bottom`, así crece hacia arriba
 *     sin tener que adivinar su alto.
 */
export function Popover({ ancla, etiqueta, ancho, onCerrar, onEscape, children }: {
  ancla: HTMLElement; etiqueta: string; ancho: number; onCerrar: () => void; onEscape?: () => boolean; children: ReactNode;
}) {
  const capa = useCapaModal(true, { anidada: true });
  const esArriba = capa.esElDeArriba;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const cerrar = useRef(onCerrar);
  const escape = useRef(onEscape);
  useEffect(() => { cerrar.current = onCerrar; escape.current = onEscape; }, [onCerrar, onEscape]);

  useLayoutEffect(() => {
    const ubicar = () => {
      const p = ref.current;
      if (!p) return;
      if (!ancla.isConnected) { cerrar.current(); return; }
      const a = ancla.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Alineado al borde DERECHO del botón cuando el botón está en la mitad derecha (la topbar, la esquina de
      // una tarjeta): abierto hacia la izquierda no se sale de la ventana ni tapa la tarjeta de al lado.
      const izq = a.left + a.width / 2 > vw / 2 ? a.right - p.offsetWidth : a.left;
      const left = Math.round(Math.min(Math.max(8, izq), Math.max(8, vw - p.offsetWidth - 8)));
      const libreAbajo = Math.round(vh - a.bottom - 14);
      const libreArriba = Math.round(a.top - 14);
      const nueva: Pos = libreAbajo >= 300 || libreAbajo >= libreArriba
        ? { left, top: Math.round(a.bottom + 6), alto: Math.max(140, libreAbajo) }
        : { left, bottom: Math.round(vh - a.top + 6), alto: Math.max(140, libreArriba) };
      setPos((x) => (mismaPos(x, nueva) ? x : nueva));
    };
    ubicar();
    // El panel cambia de ancho y de alto al navegar adentro (raíz → un control) y al llegar los valores.
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
      if (escape.current?.()) return;
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

export function Chevron({ lado = 'abajo' }: { lado?: 'abajo' | 'derecha' }) {
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="bc-chev">
      <path d={lado === 'abajo' ? 'm6 9 6 6 6-6' : 'm9 6 6 6-6 6'} />
    </svg>
  );
}
function Marca({ si }: { si: boolean }) {
  return <span className="bc-marca">{si && <IconoMenu nombre="check" size={14} />}</span>;
}
/** «‹» de volver, en la cabecera de un panel del desplegable. */
export function Volver({ onClick, etiqueta }: { onClick: () => void; etiqueta: string }) {
  return (
    <button type="button" className="bc-volver" onClick={onClick} aria-label={etiqueta} title={etiqueta}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 6-6 6 6 6" /></svg>
    </button>
  );
}

// ── Los paneles: cada uno sólo ELIGE. A dónde va lo elegido lo decide quien lo monta ──────────────

/**
 * El período, con el diseño de FechaFiltro (el de las tabs viejas, tanda de la topbar, punto 7): los presets
 * como pastillas en dos columnas —el rango de cada uno va en su `title`: una columna de fechas al lado de cada
 * nombre era lo «muy confuso»— y abajo, siempre a la vista, «Personalizado» con Desde → Hasta y «Aplicar rango».
 */
export function PanelPeriodo({ c, hoy, onElegir, onListo }: { c: ControlVista; hoy: string; onElegir: (v: ValorControl) => void; onListo: () => void }) {
  const r = rangoDelControl(c, hoy);
  const [desde, setDesde] = useState(r.desde);
  const [hasta, setHasta] = useState(r.hasta);
  const valido = esFechaValida(desde) && esFechaValida(hasta) && desde <= hasta;
  const esPers = c.preset === 'personalizado';
  return (
    <div className="bc-cuerpo bc-periodo">
      <div className="bc-presets" role="radiogroup" aria-label="Período">
        {PRESETS.filter((p) => p.id !== 'personalizado').map((p) => {
          const rp = rangoDe(p.id, hoy);
          const actual = c.preset === p.id;
          return (
            <button key={p.id} type="button" role="radio" aria-checked={actual} className="bc-preset" data-foco={actual || undefined}
              title={rangoCorto(rp.desde, rp.hasta, hoy)}
              onClick={() => { onElegir({ preset: p.id, desde: null, hasta: null }); onListo(); }}>
              {p.nombre}
            </button>
          );
        })}
      </div>
      <div className="bc-pers" data-actual={esPers || undefined}>
        <div className="bc-pers-tit">Personalizado</div>
        <div className="bc-pers-fila">
          {/* Sin `max` en hoy: «Este mes completo» y «Próximos 30 días» miran hacia adelante (v5). */}
          <input type="date" aria-label="Desde" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} data-foco={esPers || undefined} />
          <span aria-hidden className="bc-pers-flecha">→</span>
          <input type="date" aria-label="Hasta" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <button type="button" className="bc-aplicar" disabled={!valido} onClick={() => { onElegir({ preset: 'personalizado', desde, hasta }); onListo(); }}>Aplicar rango</button>
      </div>
    </div>
  );
}

export function PanelLista({ c, ctx, onElegir }: { c: ControlVista; ctx: Contexto; onElegir: (v: ValorControl) => void }) {
  const [q, setQ] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  // En un link, la ruta del link con el control de ESTA lista; con sesión, la de siempre (./valores.ts).
  const link: LecturaLink | null = ctx.lectura ? { ...ctx.lectura, controlId: c.id } : null;
  const est = useValoresCampo(c.campo, ctx.desde, ctx.hasta, ctx.fuentes, link);
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
 * «Contiene…»: se aplica sola a los 300 ms de dejar de tipear (un pedido de datos por tecla serían diez por
 * palabra), con Enter al instante, y al cerrar se aplica lo que quedó pendiente: cerrar el desplegable no
 * puede tirar lo que se escribió.
 */
export function PanelTexto({ c, onElegir, onListo }: { c: ControlVista; onElegir: (v: ValorControl) => void; onListo: () => void }) {
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
  const tipear = (v: string) => {
    setT(v);
    pendiente.current = v;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(soltar, 300);
  };
  return (
    <div className="bc-cuerpo">
      <div className="bc-buscar">
        <IconoMenu nombre="buscar" size={14} />
        <input data-foco="" value={t} maxLength={80} placeholder="Contiene…" aria-label={`Filtrar ${tituloControl(c)}`}
          onChange={(e) => tipear(e.target.value)}
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

export function PanelAgrupar({ c, onElegir, onListo }: { c: ControlVista; onElegir: (v: ValorControl) => void; onListo: () => void }) {
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

/** El panel de un control, por su tipo. `key={modo}`: al cambiar de modo arranca de nuevo (otro valor de partida). */
export function PanelDe({ c, modo, hoy, ctx, onElegir, onListo }: { c: ControlVista; modo: Modo; hoy: string; ctx: Contexto; onElegir: (v: ValorControl) => void; onListo: () => void }) {
  switch (c.tipo) {
    case 'periodo': return <PanelPeriodo key={modo} c={c} hoy={hoy} onElegir={onElegir} onListo={onListo} />;
    case 'lista': return <PanelLista key={modo} c={c} ctx={ctx} onElegir={onElegir} />;
    case 'texto': return <PanelTexto key={modo} c={c} onElegir={onElegir} onListo={onListo} />;
    case 'agrupar': return <PanelAgrupar key={modo} c={c} onElegir={onElegir} onListo={onListo} />;
  }
}

/** Una opción de más en el menú de agregar (la barra de búsqueda de una tabla), con su motivo si no se puede. */
export type ExtraAgregar = { nombre: string; linea: string; icono: NombreIconoMenu; motivo: string | null; onElegir: () => void };

/**
 * «Agregar filtro»: primero el TIPO (con su motivo si no se puede: un tipo apagado dice que existe y por qué
 * acá no) y, para una lista o un «Contiene…», el CAMPO (los que filtran algún gráfico de la página primero).
 * Lo usan el desplegable de la topbar, el de una tarjeta y el panel de propiedades (./BarraControles.tsx).
 */
export function PanelAgregar({ nivel, onAgregar, onVolver, extra }: { nivel: Nivel; onAgregar: (c: ControlVista) => void; onVolver?: () => void; extra?: ExtraAgregar | null }) {
  const [paso, setPaso] = useState<'lista' | 'texto' | null>(null);
  const [q, setQ] = useState('');
  const opciones = opcionesAgregar(nivel);
  const agregar = (tipo: TipoControl, campo: string | null) => {
    const nuevo = nuevoControlPara(tipo, campo, nivel);
    if (nuevo) onAgregar(nuevo);
  };
  // Al pasar a elegir el campo, el foco va al buscador: el del desplegable ya se usó al abrir.
  const buscador = useRef<HTMLInputElement>(null);
  useEffect(() => { if (paso) buscador.current?.focus({ preventScroll: true }); }, [paso]);
  const enHoja = nivel.nivel === 'hoja';
  const campos = !paso ? [] : nivel.nivel === 'hoja' ? camposParaHoja(nivel.hoja) : camposParaComp(nivel.comp);
  const busca = norm(q.trim());
  const pasan = campos.filter((c) => !busca || norm(c.nombre).includes(busca));
  const grupos = enHoja
    ? [{ tit: 'En esta página', lista: pasan.filter((c) => c.graficos > 0) }, { tit: 'Otros campos', lista: pasan.filter((c) => c.graficos === 0) }]
    : [{ tit: '', lista: pasan }];
  const nombrePaso = paso ? nombreTipo(opciones.find((o) => o.id === paso) ?? { id: paso, nombre: '' }) : '';

  if (!paso) {
    return (
      <>
        <div className="bc-pop-cab">
          {onVolver && <Volver onClick={onVolver} etiqueta="Volver a los filtros" />}
          <span className="bc-pop-tit">Agregar filtro</span>
        </div>
        <div className="bc-cuerpo">
          {opciones.map((o) => (
            <button key={o.id} type="button" className="bc-opcion bc-opcion--alta" disabled={!!o.motivo}
              onClick={() => (o.id === 'lista' || o.id === 'texto' ? setPaso(o.id) : agregar(o.id, null))}>
              <span className="bc-marca"><IconoMenu nombre={ICONO[o.id]} size={15} /></span>
              <span className="bc-opcion-txt">
                <span>{nombreTipo(o)}</span>
                <span className="bc-linea">{o.linea}</span>
              </span>
              {o.motivo && <span className="bc-dim">{o.motivo}</span>}
            </button>
          ))}
          {extra && (
            <button type="button" className="bc-opcion bc-opcion--alta" disabled={!!extra.motivo} onClick={extra.onElegir}>
              <span className="bc-marca"><IconoMenu nombre={extra.icono} size={15} /></span>
              <span className="bc-opcion-txt">
                <span>{extra.nombre}</span>
                <span className="bc-linea">{extra.linea}</span>
              </span>
              {extra.motivo && <span className="bc-dim">{extra.motivo}</span>}
            </button>
          )}
        </div>
      </>
    );
  }
  return (
    <>
      <div className="bc-pop-cab">
        <Volver onClick={() => setPaso(null)} etiqueta="Volver a los tipos" />
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
  );
}

// ── El botón «Filtro» y su desplegable ───────────────────────────────────────────────────────

/** Lo que una tarjeta escribe: la lista ENTERA de sus controles (con los fijos) y, si cambia, su `tabla`. */
export type ParcheComp = { controles: ControlVista[]; tabla?: Grafico['tabla'] };

type Comun = {
  vista: VistaValores;
  hoy: string;
  /** Editando el informe: suma «＋ Agregar filtro» y, en cada control, «Lo que muestra de entrada» y «Quitar». */
  editando: boolean;
  /** Lo elegido MIRANDO: estado de la vista, no se guarda. */
  onVista: (id: string, valor: ValorControl) => void;
  /** El link sin sesión: los valores de una lista se leen por su ruta. */
  compartido?: Compartido | null;
};
/** El de la TOPBAR: los filtros de la hoja. */
export type PropsFiltroHoja = Comun & {
  modo: 'hoja';
  hoja: Hoja;
  /** Se puede guardar (no es el closer, ni un link, ni una lectura caída): sin esto, editar no agrega nada. */
  guardable: boolean;
  onAgregar: (c: ControlVista) => void;
  onCambiar: (id: string, parche: Partial<ControlVista>) => void;
  onQuitar: (id: string) => void;
  onRestablecer: () => void;
};
/** El de una TARJETA: los controles propios del gráfico y lo que su conjunto no puede aplicar. */
export type PropsFiltroTarjeta = Comun & {
  modo: 'tarjeta';
  /** (Un bloque ya no existe desde v5 —los migra el saneo—; se acepta para no romper a quien todavía lo nombre.) */
  comp: Grafico | Bloque;
  hoja: Hoja;
  /** Lo que el componente mira de verdad (`efectivoDe`): de acá salen «Período propio» y «No filtra por X». */
  efectivo: Efectivo;
  onCambiarComp: (parche: ParcheComp) => void;
};
export type PropsMenuFiltro = PropsFiltroHoja | PropsFiltroTarjeta;

type Pantalla = { tipo: 'raiz' } | { tipo: 'control'; id: string; modo: Modo } | { tipo: 'agregar' };

/**
 * El botón «Filtro» y su desplegable de navegación (raíz → un control → su panel), en la topbar
 * (`modo="hoja"`, dentro de ./BarraControles.tsx) y en la cabecera de cada tarjeta (`modo="tarjeta"`, en
 * `.lk-comp-acciones`: lo monta app/dashboard/EditorInforme.tsx, interfaz I1 del contrato v5).
 * En una tarjeta sin nada que decir (ni filtros propios, ni un período propio, ni un «no filtra por», y sin
 * estar editando) no dibuja nada: un embudo en cada tarjeta que abre un panel vacío es ruido.
 */
export function MenuFiltro(props: PropsMenuFiltro) {
  const { vista, hoy, editando, onVista, compartido = null } = props;
  const btn = useRef<HTMLButtonElement>(null);
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const [pantalla, setPantalla] = useState<Pantalla>({ tipo: 'raiz' });
  const cerrar = useCallback(() => setAncla(null), []);
  // Escape adentro de un control (o de «Agregar») vuelve a la raíz; en la raíz, cierra.
  const alEscape = useCallback(() => {
    if (pantalla.tipo === 'raiz') return false;
    setPantalla({ tipo: 'raiz' });
    return true;
  }, [pantalla.tipo]);

  const enTarjeta = props.modo === 'tarjeta';
  const hoja = props.hoja;
  const comp = props.modo === 'tarjeta' ? props.comp : null;
  const grafico = comp && comp.clase === 'grafico' ? comp : null;
  // TODOS (con los fijos) para escribir; los que SE VEN para dibujar. La barra de una tabla va en su cabecera.
  const todos = comp ? comp.controles : hoja.controles;
  // El control de la barra de una tabla (`idBusquedaDe`, ./exportar.ts): si es uno guardado, no va también acá.
  const idBarra = grafico?.tabla?.buscar ? idBusquedaDe(grafico) : null;
  const visibles = controlesDelMenu(todos, idBarra);
  const agrega = props.modo === 'tarjeta' ? editando : editando && props.guardable;
  const efectivo = props.modo === 'tarjeta' ? props.efectivo : null;
  const periodoPropio = !!efectivo && efectivo.propio.periodo && !visibles.some((c) => c.tipo === 'periodo');
  const noAplica = efectivo?.noAplica ?? [];
  const n = filtrosActivos(visibles, vista);
  const restablecer = props.modo === 'hoja' ? hayVistaElegida(hoja, vista) : visibles.some((c) => distintoDeEntrada(c, vista));

  if (enTarjeta && !visibles.length && !periodoPropio && !noAplica.length && !agrega) return null;

  // ── A dónde va lo que se escribe ──
  const cambiar = (id: string, parche: Partial<ControlVista>) => {
    if (props.modo === 'hoja') props.onCambiar(id, parche);
    else props.onCambiarComp({ controles: todos.map((x) => (x.id === id ? { ...x, ...parche } : x)) });
  };
  const quitar = (id: string) => {
    if (props.modo === 'hoja') props.onQuitar(id);
    else props.onCambiarComp({ controles: todos.filter((x) => x.id !== id) });
  };
  // Agregar SUMA: nunca `controles: [nuevo]` (se llevaría el período propio, que desde v5 es un control fijo).
  const agregar = (c: ControlVista) => {
    if (props.modo === 'hoja') props.onAgregar(c);
    else props.onCambiarComp({ controles: [...todos, c] });
    setPantalla({ tipo: 'control', id: c.id, modo: 'vista' });
  };
  const deVuelta = () => {
    if (props.modo === 'hoja') { props.onRestablecer(); return; }
    for (const c of visibles) if (distintoDeEntrada(c, vista)) onVista(c.id, valorDeEntrada(c));
  };

  // ── De dónde leen sus valores las listas ──
  const lectura: LecturaLista | undefined = compartido ? { compartido, hojaId: hoja.id, ...(comp ? { componenteId: comp.id } : {}) } : undefined;
  const rangoHoja = periodoDePagina(hoja, vista, hoy);
  const ctxDe = (c: ControlVista): Contexto => (efectivo
    ? { desde: efectivo.desde, hasta: efectivo.hasta, fuentes: grafico ? [grafico.fuente] : undefined, lectura }
    : { desde: rangoHoja.desde, hasta: rangoHoja.hasta, fuentes: c.campo ? fuentesDelCampoEnHoja(hoja, c.campo) : undefined, lectura });

  const abrir = () => {
    setPantalla({ tipo: 'raiz' });
    setAncla((a) => (a ? null : btn.current));
  };

  // ── La barra de búsqueda de una tabla, como una opción más de «Agregar» (sólo en una tarjeta de tabla) ──
  const extra: ExtraAgregar | null = grafico && campoDeBusqueda(grafico) && !grafico.tabla?.buscar ? {
    nombre: 'Barra de búsqueda', linea: 'Arriba de la tabla', icono: 'buscar', motivo: motivoSinBusqueda(grafico, idBusquedaDe(grafico)),
    onElegir: () => {
      if (props.modo === 'tarjeta') props.onCambiarComp(parcheBuscarEnTabla(grafico, true));
      cerrar();
    },
  } : null;

  // ── Lo que se dibuja adentro ──
  const control = pantalla.tipo === 'control' ? visibles.find((c) => c.id === pantalla.id) ?? null : null;
  const raiz = (
    <>
      <div className="mf-lista">
        {visibles.map((c) => {
          const visto = conVista(c, vista);
          return (
            <button key={c.id} type="button" className="mf-fila" onClick={() => setPantalla({ tipo: 'control', id: c.id, modo: 'vista' })}
              title={tituloControl(c)}>
              <IconoMenu nombre={ICONO[c.tipo]} size={15} />
              <span className="mf-fila-nom">{tituloControl(c)}</span>
              <span className="mf-fila-val" data-activo={pintaActivo(visto) || undefined}>{valorDeFila(visto, hoy)}</span>
              {distintoDeEntrada(c, vista) && <span className="bc-punto" aria-hidden title="Distinto de lo que muestra de entrada" />}
              <Chevron lado="derecha" />
            </button>
          );
        })}
        {periodoPropio && efectivo && (
          <div className="mf-info" title="Este gráfico mira sus propias fechas, no las de la página.">
            <IconoMenu nombre="calendario" size={15} />
            <span className="mf-fila-nom">Período propio</span>
            <span className="mf-fila-val">{rangoCorto(efectivo.desde, efectivo.hasta, hoy)}</span>
          </div>
        )}
        {noAplica.map((nom) => (
          <div key={nom} className="mf-info mf-info--aviso" title={`Sus datos no tienen ${nom}: este gráfico no se filtra por eso.`}>
            <IconoMenu nombre="filtro" size={15} />
            <span className="mf-fila-nom">No filtra por {nom}</span>
          </div>
        ))}
        {!enTarjeta && !visibles.length && !agrega && <div className="mf-vacio">Esta hoja no tiene filtros</div>}
        {agrega && (
          <button type="button" className="mf-fila mf-agregar" onClick={() => setPantalla({ tipo: 'agregar' })}>
            <IconoMenu nombre="agregar" size={15} />
            <span className="mf-fila-nom">Agregar filtro</span>
          </button>
        )}
      </div>
      {restablecer && (
        <div className="mf-pie">
          <button type="button" className="mf-pie-btn" onClick={deVuelta} title="Volver a lo que muestra de entrada">Restablecer</button>
        </div>
      )}
    </>
  );

  let adentro: ReactNode = raiz;
  if (pantalla.tipo === 'agregar' && agrega) {
    const nivel: Nivel = comp ? { nivel: 'componente', comp, hoja } : { nivel: 'hoja', hoja };
    adentro = <PanelAgregar nivel={nivel} onAgregar={agregar} onVolver={() => setPantalla({ tipo: 'raiz' })} extra={extra} />;
  } else if (control && pantalla.tipo === 'control') {
    const modo = agrega ? pantalla.modo : 'vista';
    const visto = conVista(control, vista);
    const enPanel = modo === 'vista' ? visto : control;
    // ⚠️ MIRANDO, lo elegido va a la VISTA y NO se guarda. Sólo «Lo que muestra de entrada» toca el informe,
    //    y de paso alinea la vista: si no, una elección vieja seguiría tapando lo que se acaba de guardar y
    //    parecería que no se guardó.
    const elegirMirando = (v: ValorControl) => onVista(control.id, v);
    const elegirDeEntrada = (v: ValorControl) => { cambiar(control.id, parcheDeEntrada(control.tipo, v)); onVista(control.id, v); };
    const onElegir = modo === 'vista' ? elegirMirando : elegirDeEntrada;
    adentro = (
      <>
        <div className="bc-pop-cab">
          <Volver onClick={() => setPantalla({ tipo: 'raiz' })} etiqueta="Volver a los filtros" />
          <span className="bc-pop-tit">{tituloControl(control)}</span>
          {control.tipo === 'periodo' && (() => { const r = rangoDelControl(enPanel, hoy); return <span className="bc-dim">{rangoCorto(r.desde, r.hasta, hoy)}</span>; })()}
          {modo === 'entrada' && <span className="bc-pop-modo">De entrada</span>}
        </div>
        <PanelDe c={enPanel} modo={modo} hoy={hoy} ctx={ctxDe(control)} onElegir={onElegir} onListo={cerrar} />
        {agrega && (
          <div className="bc-pop-pie">
            {modo === 'vista'
              ? <button type="button" className="bc-pie-btn" onClick={() => setPantalla({ tipo: 'control', id: control.id, modo: 'entrada' })}>Lo que muestra de entrada</button>
              : <button type="button" className="bc-pie-btn" onClick={() => setPantalla({ tipo: 'control', id: control.id, modo: 'vista' })}>Volver a lo que ves</button>}
            <button type="button" className="bc-pie-btn bc-quitar" onClick={() => { setPantalla({ tipo: 'raiz' }); quitar(control.id); }}>
              <IconoMenu nombre="borrar" size={14} /> Quitar
            </button>
          </div>
        )}
      </>
    );
  }

  const ancho = control?.tipo === 'periodo' ? 320 : 300;
  const aviso = noAplica.length ? `No filtra por ${noAplica.join(', ')}` : null;
  const etiqueta = n > 0 ? `Filtro (${n} ${n === 1 ? 'activo' : 'activos'})` : 'Filtro';
  const boton = (
    <button ref={btn} type="button" className={enTarjeta ? 'mf-btn mf-btn--chico' : 'mf-btn'} data-activo={n > 0 || undefined} data-aviso={aviso ? '' : undefined}
      aria-haspopup="dialog" aria-expanded={!!ancla} aria-label={etiqueta} title={aviso ?? (enTarjeta ? etiqueta : undefined)}
      // El paso de la guía «Agregar un filtro» apunta a ESTE botón editando: ningún paso puede señalar adentro
      // de un menú cerrado (tests/dashboard-recorridos.test.ts).
      data-recorrido={!enTarjeta && agrega ? 'dash-filtro' : undefined}
      onClick={abrir}>
      <Icon name="funnel" size={enTarjeta ? 14 : 16} />
      {!enTarjeta && <span className="mf-btn-txt">Filtro</span>}
      {/* `aria-hidden`: el número ya lo dice el nombre del botón. */}
      {n > 0 && <span className="mf-num" aria-hidden>{n}</span>}
    </button>
  );
  return (
    <span className={enTarjeta ? 'mf mf--chico lk-no-arrastrar' : 'mf'} data-bc=""
      // En una tarjeta, el botón no arrastra la tarjeta ni la elige (react-grid-layout escucha el mousedown).
      {...(enTarjeta ? { onMouseDown: parar, onPointerDown: parar, onTouchStart: parar, onClick: parar } : {})}>
      <EstilosControles />
      {boton}
      {ancla && (
        <Popover ancla={ancla} etiqueta="Filtro" ancho={ancho} onCerrar={cerrar} onEscape={alEscape}>
          {adentro}
        </Popover>
      )}
    </span>
  );
}

// ── Estilos ─────────────────────────────────────────────────────────────────────────────────
// Sólo tokens de la app: con `html[data-tema="oscuro"]` se dan vuelta solos. Un `<style>` con `href` y
// `precedence`: React lo sube al head UNA vez aunque lo dibujen diez tarjetas.
// ⚠️ PISO DE LETRA 13 px (tanda v5, área C del relevo: «todo lo que se dibuja, mínimo 13»): nada de
//    `var(--fs-meta)` (12 px) acá; lo chico va en `var(--fs-sm)`.

export function EstilosControles() {
  return <style href="bc-controles" precedence="medium">{CSS_CONTROLES}</style>;
}

export const CSS_CONTROLES = `
.mf { position: relative; display: inline-flex; flex: none; }
.mf-btn { position: relative; display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px 0 12px; border: 1px solid var(--border-strong); border-radius: 18px; background: var(--surface); color: var(--ink); font: inherit; font-size: 13.5px; font-weight: 600; line-height: 1; cursor: pointer; white-space: nowrap; transition: background .14s ease, border-color .14s ease, color .14s ease; }
.mf-btn:hover { background: var(--surface-2); }
.mf-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.mf-btn > svg { color: var(--dim); }
.mf-btn[aria-expanded="true"] { border-color: var(--primary); }
.mf-btn[data-activo] { color: var(--primary-strong); border-color: var(--primary-weak); background: var(--primary-bg); }
.mf-btn[data-activo] > svg { color: inherit; }
.mf-btn--chico { width: 28px; height: 28px; padding: 0; justify-content: center; border-radius: 8px; border-color: var(--border); }
.mf-btn--chico[data-aviso] > svg { color: var(--warn); }
.mf-num { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 4px; box-sizing: border-box; border-radius: 999px; border: 2px solid var(--surface); background: var(--primary); color: var(--on-primary); font-size: 11px; font-weight: 700; line-height: 14px; text-align: center; pointer-events: none; }
.mf-lista { display: flex; flex-direction: column; padding: 6px 0; }
.mf-fila, .mf-info { display: flex; align-items: center; gap: 9px; width: 100%; min-height: 38px; padding: 7px 12px 7px 14px; box-sizing: border-box; border: 0; background: transparent; color: var(--ink); font: inherit; font-size: var(--fs-sm); text-align: left; }
.mf-fila { cursor: pointer; }
.mf-fila:hover, .mf-fila:focus-visible { background: var(--velo-hover); outline: none; }
.mf-fila > svg:first-child, .mf-info > svg:first-child { flex: none; color: var(--dim); }
.mf-fila-nom { flex: 1 1 auto; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mf-fila-val { flex: 0 1 auto; min-width: 0; max-width: 55%; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mf-fila-val[data-activo] { color: var(--primary-strong); font-weight: 600; }
.mf-info { color: var(--dim); cursor: default; }
.mf-info .mf-fila-nom { font-weight: 500; }
.mf-info--aviso, .mf-info--aviso > svg:first-child { color: var(--warn); }
.mf-agregar { color: var(--primary-strong); }
.mf-agregar > svg:first-child { color: inherit; }
.mf-vacio { padding: 12px 14px; color: var(--dim); font-size: var(--fs-sm); }
.mf-pie { display: flex; justify-content: flex-end; padding: 4px 8px 8px; border-top: 1px solid var(--border); }
.mf-pie-btn { padding: 6px 8px; border: 0; border-radius: var(--r-sm); background: transparent; color: var(--dim); font: inherit; font-size: var(--fs-sm); cursor: pointer; }
.mf-pie-btn:hover { color: var(--ink); background: var(--velo-hover); }

.bc-punto { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--primary); }
.bc-chev { flex: none; color: var(--faint); }
.bc-btn { display: inline-flex; align-items: center; gap: 7px; height: 34px; max-width: 260px; padding: 0 12px; border: 1px solid var(--border-strong); border-radius: 10px; background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-sm); font-weight: 500; line-height: 1; cursor: pointer; white-space: nowrap; transition: background .14s ease, border-color .14s ease, color .14s ease; }
.bc-btn:hover { background: var(--surface-2); border-color: var(--faint); }
.bc-btn:focus-visible, .bc-opcion:focus-visible, .bc-pie-btn:focus-visible, .bc-solo:focus-visible, .bc-link:focus-visible, .bc-volver:focus-visible, .bc-x:focus-visible, .bc-aplicar:focus-visible, .mf-pie-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.bc-btn[aria-expanded="true"] { border-color: var(--primary); }
.bc-btn > svg { flex: none; color: var(--dim); }
.bc-btn-txt { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.bc-agregar { border-style: dashed; color: var(--dim); }
.bc-agregar:hover { color: var(--ink); }
.bc-agregar--ancho { width: 100%; max-width: none; justify-content: center; }

.bc-pop { position: fixed; z-index: 600; display: flex; flex-direction: column; max-width: calc(100vw - 16px); overflow: hidden; background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: var(--r-md); box-shadow: ${shadow.pop}; font-size: var(--fs-sm); line-height: 1.35; }
.bc-pop > .mf-lista { overflow-y: auto; }
.bc-pop-cab { flex: none; display: flex; align-items: center; gap: 8px; padding: 10px 12px 6px; }
.bc-pop-tit { flex: 1 1 auto; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-pop-modo { flex: none; padding: 2px 7px; border-radius: 999px; background: var(--mako-bg); color: var(--mako-ink); font-size: var(--fs-sm); font-weight: 600; }
.bc-cuerpo { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 0 0 6px; }
.bc-pop-pie { flex: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; border-top: 1px solid var(--border); }
.bc-pie-btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-sm); cursor: pointer; }
.bc-pie-btn:hover { background: var(--surface-2); }
.bc-quitar { margin-left: auto; color: var(--bad); border-color: var(--bad); }
.bc-quitar:hover { background: var(--bad-bg); }

.bc-opcion { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 34px; padding: 6px 12px; border: 0; background: transparent; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.bc-opcion:hover:not(:disabled) { background: var(--surface-2); }
.bc-opcion[aria-checked="true"], .bc-opcion[data-actual] { color: var(--primary-strong); font-weight: 600; }
.bc-opcion:disabled { color: var(--faint); cursor: default; }
.bc-opcion--alta { align-items: flex-start; }
.bc-opcion-txt { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; overflow: hidden; text-overflow: ellipsis; }
.bc-linea { color: var(--faint); font-size: var(--fs-sm); font-weight: 400; }
.bc-marca { flex: none; display: inline-flex; width: 16px; justify-content: center; color: var(--primary); }
.bc-dim { flex: none; color: var(--faint); font-size: var(--fs-sm); font-weight: 400; white-space: nowrap; }
.bc-grupo { padding: 8px 12px 3px; color: var(--faint); font-size: var(--fs-sm); font-weight: 600; }
.bc-nota { padding: 6px 12px; color: var(--faint); font-size: var(--fs-sm); }
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
.bc-cuenta { flex: none; min-width: 28px; text-align: right; color: var(--faint); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
.bc-solo { flex: none; padding: 2px 6px; border: 0; border-radius: 6px; background: transparent; color: var(--primary); font: inherit; font-size: var(--fs-sm); cursor: pointer; opacity: 0; }
.bc-fila:hover .bc-solo, .bc-solo:focus-visible { opacity: 1; }
.bc-solo:hover { background: var(--primary-bg); }
@media (hover: none) { .bc-solo { opacity: 1; } }

/* El período con el diseño de FechaFiltro (app/_components/FechaFiltro.tsx): pastillas en dos columnas y
   «Personalizado» abajo, separado por un filete. */
.bc-periodo { padding: 2px 12px 12px; }
.bc-presets { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.bc-preset { min-height: 34px; padding: 7px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); color: var(--ink); font: inherit; font-size: var(--fs-sm); text-align: left; cursor: pointer; transition: border-color .14s ease, background .14s ease; }
.bc-preset:hover { border-color: var(--border-strong); }
.bc-preset[aria-checked="true"] { border-color: var(--primary); background: var(--primary-bg); color: var(--primary-strong); font-weight: 600; }
.bc-preset:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.bc-pers { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
.bc-pers-tit { margin-bottom: 8px; color: var(--dim); font-size: var(--fs-sm); font-weight: 600; }
.bc-pers[data-actual] .bc-pers-tit { color: var(--primary-strong); }
.bc-pers-fila { display: flex; align-items: center; gap: 8px; }
.bc-pers-fila input { flex: 1 1 0; min-width: 0; height: 34px; padding: 0 8px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface-2); color: var(--ink); font: inherit; font-size: var(--fs-sm); color-scheme: light; }
html[data-tema="oscuro"] .bc-pers-fila input { color-scheme: dark; }
.bc-pers-fila input:focus { outline: none; border-color: var(--primary); }
.bc-pers-flecha { flex: none; color: var(--faint); }
.bc-aplicar { display: block; width: 100%; height: 36px; margin-top: 8px; padding: 0 14px; border: 0; border-radius: 9px; background: var(--primary); color: var(--on-primary); font: inherit; font-weight: 600; cursor: pointer; }
.bc-aplicar:hover:not(:disabled) { background: var(--primary-strong); }
.bc-aplicar:disabled { opacity: .45; cursor: default; }
.bc-volver { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--dim); cursor: pointer; }
.bc-volver:hover { background: var(--surface-2); color: var(--ink); }

.bc-barra { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; font-size: var(--fs-sm); color: var(--ink); }
.bc-editor { display: flex; flex-direction: column; gap: 8px; font-size: var(--fs-sm); color: var(--ink); }
.bc-editor-lista { display: flex; flex-direction: column; gap: 6px; }
.bc-editor-fila { display: flex; align-items: center; gap: 6px; }
.bc-editor-fila > .bc-btn { flex: 1 1 auto; max-width: none; }
.bc-editor-vacio, .bc-editor-regla { color: var(--faint); font-size: var(--fs-sm); }
`;

