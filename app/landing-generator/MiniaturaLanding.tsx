'use client';

// =============================================================================
// MiniaturaLanding — la miniatura de una landing, y lo COMÚN del Panel y de Crear
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md.
//
// Lo que vive acá y por qué junto: el Panel (Inicio.tsx) y Crear (crear/*) dibujan
// lo mismo —miniaturas de secciones, muestras de tema, los menús y diálogos con la
// cara de Gamma, el toast— y hablan con las mismas rutas. Este archivo es el único
// que importan los dos, así que es donde no se duplica.
//
// LA MINIATURA ES EL RENDER PÚBLICO, no un dibujo aparte: `htmlDeTarjeta` (render.ts,
// la única fábrica de HTML) con el tema inline en su `.gm-doc`, y la hoja del contenido
// (`CSS_CONTENIDO`) la pone la página una sola vez. Lo que se ve en el Panel es lo que
// se publica (AGENTS.md, «la previsualización no puede resolver un token que el motor
// no resuelve»).
//
// ⚠️ LA ESCALA VA POR `--gm-base`, NUNCA POR `transform: scale()`. La hoja mide todo en
// `em` relativos a la sección (64.5em de ancho, como Gamma): con `--gm-base =
// ancho/64.5` la sección entra exacta en el cuadro y las medidas que se leen con
// getBoundingClientRect son las que se ven (AGENTS.md, «una medida en píxeles adentro
// de una capa con transform: scale(k) no es la que vas a ver»). El ancho sale de
// `100cqw` del cuadro (container-type en `.gp-mini`, que tiene ancho propio: la trampa
// del ancho 0 que cuenta css.ts es de un `.gm-doc` suelto en una fila flex, no de esto).
// En celular la media query de la hoja aplica el diseño móvil a la miniatura: por eso
// `--gm-base-movil` lleva el mismo valor; si no, la sección se dibuja a 16px en un
// cuadro de 160 y se ve un pedazo.
//
// El chrome de Gamma (botones píldora, menús, diálogos) va con componentes propios
// DENTRO de `.gma` y con su hoja (`CSS_GP`, más abajo), no con los de app/_ui: la
// regla de copia de Martín es «igual», y los de la casa tienen otra cara. Los tokens
// son los medidos de Gamma (gamma-tokens.md §9-§10: titanium, deepocean/trueblue,
// aurora) y el modo oscuro se hace redefiniendo TOKENS bajo `[data-tema="oscuro"]`
// (AGENTS.md, «una pantalla oscura se hace redefiniendo tokens»).
//
// Lo que NO se copia: los íconos de Gamma son Font Awesome Pro (pago); acá van los de
// Phosphor de lib/editor-landing/iconos.ts (MIT), que ya viajan con el render.
// =============================================================================

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { conWs } from '@/lib/ws-tab';
import { useCapaModal } from '@/app/_components/pila-modales';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { htmlDeTarjeta } from '@/lib/editor-landing/render';
import { svgIcono } from '@/lib/editor-landing/iconos';
import { varsDeTema, type Tema } from '@/lib/editor-landing/temas';
import { parrafo, tarjeta, titulo, type JsonNodo } from '@/lib/editor-landing/doc';
import type { FormatoDoc, Proporcion } from '@/lib/editor-landing/api-tipos';
import type { BorradorViejo } from '@/lib/editor-landing/server';
import { pedirDocs, marcarReciente } from './cliente';
// Los pedidos a las rutas, los plazos, la letra del chrome y lo que se recuerda en el navegador
// viven en ./cliente (un módulo SIN 'use client': cuatro copias divergían). Se re-exportan para
// que el Panel y Crear sigan importando de acá.
export { pedirDocs, pedirIA, leerLocal, guardarLocal, leerRecientes, marcarReciente, URL_FUENTE_CHROME } from './cliente';

/**
 * Navega DURO (recarga entera) llevando el `?ws=`. Para cuando lo que cambió es QUÉ
 * EXISTE —una landing recién creada—: `router.push` + `refresh` llega un paso tarde
 * (AGENTS.md, «si lo que cambió es QUÉ EXISTE, se navega DURO»), y sin `conWs` el super
 * admin que mira a un cliente termina en su propia cuenta.
 */
export function irDuro(ruta: string, ws: number | null): void {
  window.location.href = conWs(ruta, ws);
}

/**
 * «hace 3 días», como el «Editado hace {x}» de Gamma. `ahora` viene de afuera (el server lo
 * pasa en el primer render): con `Date.now()` adentro, el HTML del server y el del
 * navegador difieren por segundos y React se queja de la hidratación.
 */
export function haceCuanto(fecha: string | number, ahora: number): string {
  const t = typeof fecha === 'number' ? fecha : Date.parse(fecha);
  if (!Number.isFinite(t)) return '';
  const seg = Math.max(0, Math.round((ahora - t) / 1000));
  if (seg < 60) return 'justo ahora';
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  const meses = Math.floor(d / 30);
  if (meses < 12) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const a = Math.floor(d / 365);
  return `hace ${a} ${a === 1 ? 'año' : 'años'}`;
}

// El host y la ruta de una URL, sin «www.», para nombrar una landing analizada. Vive en
// ./panel-reglas (un módulo puro: lo usan también la barra lateral del Panel y su test).
export { hostDe } from './panel-reglas';

/**
 * La caja «¿Qué quieres crear?» del Panel le pasa el pedido a Crear por sessionStorage y no
 * por la URL: el pedido puede ser largo y trae datos del negocio, y una URL queda en el
 * historial y en los logs de cada request. Se consume UNA vez (se borra al leer) y vence a
 * los 10 minutos: un F5 en Crear no vuelve a disparar una generación.
 */
const CLAVE_CAJA = 'gp.crear.caja';
const VIDA_CAJA_MS = 10 * 60_000;
export type PedidoCaja = { prompt: string; modo: 'plan' | 'express' };

export function dejarCaja(p: PedidoCaja): boolean {
  try {
    window.sessionStorage.setItem(CLAVE_CAJA, JSON.stringify({ ...p, t: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function tomarCaja(): PedidoCaja | null {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_CAJA);
    window.sessionStorage.removeItem(CLAVE_CAJA);
    if (!crudo) return null;
    const j = JSON.parse(crudo) as { prompt?: unknown; modo?: unknown; t?: unknown };
    if (typeof j.prompt !== 'string' || !j.prompt.trim()) return null;
    if (typeof j.t !== 'number' || Date.now() - j.t > VIDA_CAJA_MS) return null;
    return { prompt: j.prompt, modo: j.modo === 'express' ? 'express' : 'plan' };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Miniaturas
// ─────────────────────────────────────────────────────────────────────────────

/** Una sección vacía con id FIJO: un id al azar haría distinto el HTML del server y el del navegador. */
const TARJETA_VACIA: JsonNodo = tarjeta([titulo('', 1), parrafo()], { id: 'tvacia' });

/**
 * La primera sección de una landing (o la que se le pase) dibujada con el render público,
 * en un cuadro de la proporción dada. `entera` = sin cuadro: la sección con su alto real
 * (la vista de generación en vivo). Es decorativa: `aria-hidden` e `inert`, sin enlaces
 * que se puedan tocar.
 *
 * T3 (tanda 2): con `formato: 'presentacion'` la miniatura es la DIAPOSITIVA, con la forma de
 * su `proporcion` (16:9 o 4:3; «Fluido» se dibuja 16:9: una miniatura necesita un cuadro). El
 * formato lo declara el PADRE DIRECTO del `.gm-doc` (`data-formato`/`data-proporcion`):
 * `htmlDeTarjeta` no conoce la configuración, y css.ts («15b. Presentaciones») lee el
 * envoltorio. `aspecto` es el cuadro de una PÁGINA (16 / 10 por default).
 */
export function MiniaturaLanding({ tarjeta: t, tema, formato = 'pagina', proporcion = '16:9', aspecto = '16 / 10', entera = false }: {
  tarjeta: JsonNodo | null;
  tema: Tema;
  formato?: FormatoDoc;
  proporcion?: Proporcion;
  aspecto?: string;
  entera?: boolean;
}) {
  const html = useMemo(() => htmlDeTarjeta(t ?? TARJETA_VACIA, tema, { modo: 'miniatura', incluirOcultas: true }), [t, tema]);
  const diapo = formato === 'presentacion';
  const prop: Proporcion = proporcion === '4:3' ? '4:3' : '16:9';
  const cuadro = diapo ? (prop === '4:3' ? '4 / 3' : '16 / 9') : aspecto;
  return (
    <div className="gp-mini" data-entera={entera ? 'si' : undefined} style={entera ? undefined : { aspectRatio: cuadro }} aria-hidden="true" inert>
      <div
        className="gp-mini-lienzo"
        data-formato={diapo ? 'presentacion' : undefined}
        data-proporcion={diapo ? prop : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/**
 * La muestra de un tema como la galería de Gamma: el fondo de la página con una tarjeta
 * redondeada adentro que dice «Título» y «Cuerpo y enlace» (el enlace subrayado en su
 * color). Lee las MISMAS variables que la hoja del contenido (`varsDeTema`), así que la
 * muestra no puede mentir sobre el tema.
 */
export function MuestraTema({ tema, grande = false }: { tema: Tema; grande?: boolean }) {
  const vars = useMemo(() => varsDeTema(tema) as CSSProperties, [tema]);
  return (
    <div className="gp-muestra" data-grande={grande ? 'si' : undefined} style={vars} aria-hidden="true">
      <div className="gp-muestra-tarjeta">
        <div className="gp-muestra-titulo">Título</div>
        <div className="gp-muestra-cuerpo">Cuerpo y <span className="gp-muestra-enlace">enlace</span></div>
      </div>
    </div>
  );
}

/**
 * Una tarjeta de la galería de temas (Panel → Temas y Crear → «Temas»): la muestra, el
 * nombre abajo y, la elegida, borde azul y «✓ Nombre» como en Gamma. `sugerido` agrega el
 * chip «Sugerencia» (el texto de Gamma para el tema que propone).
 */
export function TileTema({ tema, activo = false, sugerido = false, onClick, etiqueta }: {
  tema: Tema;
  activo?: boolean;
  sugerido?: boolean;
  onClick: () => void;
  /** Lo que dice el lector de pantalla además del nombre («Usar tema», «Elegir tema»). */
  etiqueta?: string;
}) {
  return (
    <button
      type="button"
      className="gp-tema"
      data-activo={activo ? 'si' : undefined}
      aria-pressed={activo}
      aria-label={etiqueta ? `${etiqueta}: ${tema.nombre}` : tema.nombre}
      onClick={onClick}
    >
      <MuestraTema tema={tema} />
      <span className="gp-tema-pie">
        {activo && <Ico n="check" t={14} />}
        <span className="gp-tema-nombre">{tema.nombre}</span>
        {sugerido && <span className="gp-chip">Sugerencia</span>}
      </span>
    </button>
  );
}

/** Los chips de filtro de Gamma (Todo · Claro · Oscuro…): el activo con fondo azul claro. */
export function Filtros<T extends string>({ valor, opciones, onCambio, etiqueta }: {
  valor: T;
  opciones: readonly { valor: T; texto: string }[];
  onCambio: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div className="gp-filtros" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" className="gp-filtro" aria-pressed={o.valor === valor} onClick={() => onCambio(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Piezas del chrome de Gamma
// ─────────────────────────────────────────────────────────────────────────────

/** Un ícono del catálogo de la landing (Phosphor), del color del texto. */
export function Ico({ n, t = 16 }: { n: string; t?: number }) {
  const html = useMemo(() => svgIcono(n, t), [n, t]);
  return <span className="gp-ico" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Un callback que no cambia de identidad y siempre llama a la versión de ahora. */
function useFijo<A extends unknown[]>(fn: (...a: A) => void): (...a: A) => void {
  const ref = useRef(fn);
  useLayoutEffect(() => { ref.current = fn; });
  return useCallback((...a: A) => ref.current(...a), []);
}

/**
 * Un menú desplegable de Gamma (fondo blanco, radio 16px, sombra 0 8px 16px), PORTALEADO
 * al body y registrado en la pila como capa anidada: un menú adentro de una tarjeta con
 * `overflow: hidden` se cortaría, y el Escape tiene que cerrar sólo lo de arriba
 * (`esElDeArriba`). El portal lleva su propio `.gma .gp`: afuera del árbol no hereda
 * el scope de la hoja.
 */
export function MenuFlotante({ ancla, onCerrar, children, ancho = 240, alinear = 'izquierda' }: {
  ancla: HTMLElement | null;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: number;
  alinear?: 'izquierda' | 'derecha';
}) {
  // Desarmado: `refScroll` se llama como un ref y el linter de React tiñe el objeto entero.
  const { z, esElDeArriba: esArriba } = useCapaModal(true, { anidada: true });
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const cerrar = useFijo(onCerrar);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!ancla || !el) return;
    const r = ancla.getBoundingClientRect();
    const alto = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = alinear === 'derecha' ? r.right - ancho : r.left;
    left = Math.max(8, Math.min(left, vw - ancho - 8));
    // Si abajo no entra y arriba sí, se abre para arriba.
    let top = r.bottom + 6;
    if (top + alto > vh - 8 && r.top - 6 - alto > 8) top = r.top - 6 - alto;
    setPos({ top: Math.max(8, top), left });
  }, [ancla, ancho, alinear]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || ancla?.contains(t)) return;
      cerrar();
    };
    // Escape en document y en captura, como todos los de la casa; el de arriba FRENA con
    // stopImmediatePropagation: `esElDeArriba` sólo dice si me toca, no impide que el
    // listener hermano de un diálogo de abajo también cierre (AGENTS.md, pila de modales).
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !esArriba()) return;
      e.stopImmediatePropagation();
      cerrar();
    };
    const mover = (e: Event) => { if (!(e.target instanceof Node && ref.current?.contains(e.target))) cerrar(); };
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    window.addEventListener('resize', cerrar);
    window.addEventListener('scroll', mover, true);
    return () => {
      document.removeEventListener('mousedown', fuera, true);
      document.removeEventListener('keydown', tecla, true);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('scroll', mover, true);
    };
  }, [ancla, esArriba, cerrar]);

  return createPortal(
    <div className="gma gp gp-capa">
      <div
        ref={ref}
        role="menu"
        className="gp-menu"
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: ancho, zIndex: z + 1, visibility: pos ? 'visible' : 'hidden' }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Una fila de un menú. `peligro` = una acción de borrar: va con el tacho ROJO de la casa
 * (`IconoBorrar`), no con un ícono propio — «siempre el ícono de borrar sea rojo», en todos
 * lados, también adentro del chrome de Gamma (AGENTS.md, «Borrar es UN tacho, rojo»).
 */
export function ItemMenu({ icono, texto, sub, onClick, peligro, activo, deshabilitado }: {
  icono?: string;
  texto: string;
  sub?: string;
  onClick: () => void;
  peligro?: boolean;
  activo?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="gp-menu-item"
      data-peligro={peligro ? 'si' : undefined}
      data-activo={activo ? 'si' : undefined}
      data-sub={sub ? 'si' : undefined}
      disabled={deshabilitado}
      onClick={onClick}
    >
      {peligro ? <IconoBorrar size={16} /> : icono && <Ico n={icono} />}
      <span className="gp-menu-textos">
        <span className="gp-menu-texto">{texto}</span>
        {sub && <span className="gp-menu-sub">{sub}</span>}
      </span>
      {activo && <span className="gp-menu-check"><Ico n="check" /></span>}
    </button>
  );
}

export const SeparadorMenu = () => <div className="gp-menu-sep" role="separator" />;

export type OpcionDesplegable<T extends string> = { valor: T; texto: string; sub?: string; icono?: string; etiqueta?: string };

/**
 * El reemplazo del `<select>` con la cara de Gamma: una píldora «[ícono texto ▾]» que abre
 * un MenuFlotante con las opciones (la elegida con ✓). Nada de select nativo (regla de
 * la casa), y tampoco el Dropdown de app/components: adentro de `.gma` va el de Gamma.
 */
export function Desplegable<T extends string>({ valor, opciones, onCambio, icono, ancho = 260, etiqueta, deshabilitado, alinear }: {
  valor: T;
  opciones: readonly OpcionDesplegable<T>[];
  onCambio: (v: T) => void;
  icono?: string;
  ancho?: number;
  /** Para lectores de pantalla: qué se elige. */
  etiqueta: string;
  deshabilitado?: boolean;
  alinear?: 'izquierda' | 'derecha';
}) {
  const [ancla, setAncla] = useState<HTMLButtonElement | null>(null);
  const actual = opciones.find((o) => o.valor === valor) ?? opciones[0];
  const cerrar = useCallback(() => setAncla(null), []);
  return (
    <>
      <button
        type="button"
        className="gp-pildora"
        aria-label={`${etiqueta}: ${actual?.texto ?? ''}`}
        aria-haspopup="menu"
        aria-expanded={!!ancla}
        disabled={deshabilitado}
        onClick={(e) => setAncla(ancla ? null : e.currentTarget)}
      >
        {(icono || actual?.icono) && <Ico n={icono ?? actual?.icono ?? ''} />}
        <span className="gp-pildora-texto">{actual?.texto}</span>
        <Ico n="chevron-abajo" t={12} />
      </button>
      {ancla && (
        <MenuFlotante ancla={ancla} onCerrar={cerrar} ancho={ancho} alinear={alinear}>
          {opciones.map((o) => (
            <ItemMenu
              key={o.valor}
              icono={o.icono}
              texto={o.etiqueta ? `${o.texto} · ${o.etiqueta}` : o.texto}
              sub={o.sub}
              activo={o.valor === valor}
              onClick={() => { onCambio(o.valor); setAncla(null); }}
            />
          ))}
        </MenuFlotante>
      )}
    </>
  );
}

/**
 * Un diálogo con la cara de Gamma (radio 16, sombra xl, píldoras abajo), portaleado y en la
 * pila de modales: si se abre otro encima, éste se esconde sin desmontarse y vuelve igual.
 * `onCerrar` se guarda en un ref (identidad fija): un cierre que cambia en cada render
 * re-registra los listeners y hace saltar el foco (AGENTS.md, «todo Modal recibe un onCerrar
 * de identidad fija»). `autoFocus` no llega en el primer pintado: el foco inicial lo pone
 * un efecto sobre `[data-foco]`.
 */
export function DialogoGamma({ titulo: tit, children, pie, onCerrar, ancho = 440, cerrable = true }: {
  titulo: string;
  children: ReactNode;
  pie?: ReactNode;
  onCerrar: () => void;
  ancho?: number;
  /** false mientras algo está en vuelo: ni Escape ni el fondo lo cierran. */
  cerrable?: boolean;
}) {
  const { z, visible, refScroll, esElDeArriba: esArriba } = useCapaModal(true);
  const caja = useRef<HTMLDivElement>(null);
  const cerrableRef = useRef(cerrable);
  useLayoutEffect(() => { cerrableRef.current = cerrable; });
  const cerrar = useFijo(() => { if (cerrableRef.current) onCerrar(); });

  // El foco vuelve a donde estaba al cerrar (se anota al montar, una vez).
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    return () => { previo?.focus?.(); };
  }, []);

  // El foco inicial espera a que la capa SE VEA: el primer render es `display:none`
  // (la pila todavía no registró el diálogo) y un focus ahí no llega.
  useEffect(() => {
    if (!visible) return;
    const id = requestAnimationFrame(() => {
      const el = caja.current?.querySelector<HTMLElement>('[data-foco]') ?? caja.current;
      el?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [visible]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !esArriba()) return;
      e.stopImmediatePropagation();
      cerrar();
    };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [esArriba, cerrar]);

  return createPortal(
    <div className="gma gp gp-capa">
      <div
        className="gp-velo"
        style={{ zIndex: z, display: visible ? undefined : 'none' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}
      >
        <div ref={caja} role="dialog" aria-modal="true" aria-label={tit} tabIndex={-1} className="gp-dialogo" style={{ width: ancho }}>
          <div className="gp-dialogo-cabeza">
            <h2 className="gp-dialogo-titulo">{tit}</h2>
            <button type="button" className="gp-icono-btn" aria-label="Cerrar" onClick={cerrar} disabled={!cerrable}><Ico n="cerrar" /></button>
          </div>
          <div ref={refScroll} className="gp-dialogo-cuerpo">{children}</div>
          {pie && <div className="gp-dialogo-pie">{pie}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * El toast (3-4 palabras, abajo al centro, como los de Gamma), con «Deshacer» sólo cuando
 * hay un deshacer real. Se va solo a los 5 segundos.
 */
export function useAviso(): { avisar: (texto: string, deshacer?: () => void) => void; nodo: ReactNode } {
  const [aviso, setAviso] = useState<{ texto: string; deshacer?: () => void; n: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const avisar = useCallback((texto: string, deshacer?: () => void) => {
    window.clearTimeout(timer.current);
    setAviso((a) => ({ texto, deshacer, n: (a?.n ?? 0) + 1 }));
    timer.current = window.setTimeout(() => setAviso(null), 5_000);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const nodo = aviso ? (
    <div className="gp-aviso" role="status" key={aviso.n}>
      <span>{aviso.texto}</span>
      {aviso.deshacer && (
        <button type="button" className="gp-aviso-deshacer" onClick={() => { aviso.deshacer?.(); setAviso(null); }}>Deshacer</button>
      )}
    </div>
  ) : null;
  return { avisar, nodo };
}

/**
 * «Del generador anterior»: los borradores de landing_drafts, convertidos (specADoc, del lado
 * del server) al abrirlos. Vivía en el Panel detrás de «Importar ▾»; la tanda 2 sacó esa fila de
 * botones (T1: «Muchos botones a la derecha»), así que se ofrece desde la caja de crear (el «+»)
 * y vive acá, en lo común del Panel y de Crear.
 */
export function DialogoBorradores({ onCerrar, ws, ahora }: { onCerrar: () => void; ws: number | null; ahora: number }) {
  const [borradores, setBorradores] = useState<BorradorViejo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    const r = await pedirDocs({ accion: 'borradoresViejos' });
    if (!r.ok) { setError(r.error); return; }
    setBorradores(r.borradores);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const importar = async (b: BorradorViejo) => {
    setImportando(b.id);
    setError(null);
    const r = await pedirDocs({ accion: 'importarBorrador', draftId: b.id }, 60_000);
    if (!r.ok) { setImportando(null); setError(r.error); return; }
    marcarReciente(r.doc.id);
    irDuro(`/landing-generator/${r.doc.id}`, ws);
  };

  return (
    <DialogoGamma titulo="Del generador anterior" ancho={600} onCerrar={onCerrar} cerrable={importando === null}>
      {error && (
        <div className="gp-error" role="alert">
          <span>{error}</span>
          {!borradores && <button type="button" className="gp-btn gp-btn-contorno" onClick={() => { setError(null); void cargar(); }}>Reintentar</button>}
        </div>
      )}
      {!borradores && !error && <div className="gp-esperando-centro"><span className="gp-giro" /></div>}
      {borradores && !borradores.length && <p className="gp-vacio">No hay borradores del generador anterior.</p>}
      {borradores && borradores.length > 0 && (
        <ul className="gp-borradores">
          {borradores.map((b) => (
            <li key={b.id}>
              <button type="button" className="gp-borrador" disabled={importando !== null} onClick={() => void importar(b)}>
                <span className="gp-borrador-textos">
                  <span className="gp-borrador-titulo">{b.titulo}</span>
                  <span className="gp-borrador-sub">{b.pedido.slice(0, 110) || 'Sin pedido'} · {haceCuanto(b.creado, ahora)}</span>
                </span>
                {importando === b.id ? <span className="gp-giro" /> : <Ico n="chevron-derecha" t={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </DialogoGamma>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// La hoja del chrome (tokens medidos de Gamma)
// ─────────────────────────────────────────────────────────────────────────────
// Todo bajo `.gp` (que va en el MISMO nodo que `.gma`): no toca nada de la app ni del
// contenido `.gm-*`. La tipografía la hereda de `.gma` (gamma.css: PP Mori no está en
// Google Fonts y la sustituta, Instrument Sans, la decide esa hoja). Los neutros, el
// primario y los menús LEEN los tokens `--gma-*` de gamma.css (una cosa, un lugar: si el
// chrome del editor cambia de gris, el Panel lo sigue, y su modo oscuro también); cada uno
// con el valor medido de Gamma como respaldo, porque un var() inexistente no falla:
// hereda. Lo que gamma.css no tiene (el azul activo del Panel, la columna lila del
// esquema, el cielo de Crear) es propio. Sin `--fs-*` de la casa: es otra app.


export const CSS_GP = `
.gp {
  --gp-azul-50: #ebf3fe; --gp-azul-100: #d0e6fe; --gp-azul-200: #aad5fe; --gp-azul-300: #84c1fa;
  --gp-azul-500: #2c88f7; --gp-azul-600: #0858f7; --gp-azul-800: #0540ad; --gp-azul-950: #002253;
  --gp-fondo: var(--gma-fondo-app, #f5f5f6);
  --gp-superficie: var(--gma-superficie, #ffffff);
  --gp-superficie-2: var(--gma-superficie-2, #f5f5f6);
  --gp-borde: var(--gma-borde, #dfdfe0);
  --gp-borde-suave: var(--gma-superficie-3, #ececed);
  --gp-hover: var(--gma-hover, #ececed);
  --gp-texto: var(--gma-texto-fuerte, #38383c);
  --gp-tenue: #66666b; --gp-debil: #8b8b90; --gp-titulo: #002253;
  --gp-activo-fondo: #ebf3fe; --gp-activo-texto: #0858f7;
  --gp-primario: var(--gma-primario, #0540ad);
  --gp-primario-hover: var(--gma-primario-hover, #0740df);
  --gp-primario-texto: var(--gma-sobre-primario, #ffffff);
  --gp-secundario: var(--gma-secundario, #d0e6fe);
  --gp-secundario-texto: var(--gma-sobre-secundario, #002253);
  --gp-peligro: var(--gma-rojo, #dc2626);
  --gp-peligro-fondo: var(--gma-rojo-fondo, #fef2f2);
  --gp-exito: var(--gma-verde, #2c8c2c); --gp-dorado: #fec500;
  --gp-lila-fondo: #f2ecff; --gp-lila-num: #8a9cef;
  --gp-menu-fondo: var(--gma-menu, #ffffff);
  --gp-menu-texto: var(--gma-sobre-menu, #38383c);
  --gp-sombra-menu: var(--gma-sombra-menu, 0 8px 16px rgba(0,0,0,.15));
  --gp-sombra-tarjeta: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06);
  --gp-sombra-xl: var(--gma-sombra-xl, 0 20px 25px -5px rgba(0,0,0,.1), 0 10px 10px -5px rgba(0,0,0,.04));
  --gp-cielo: linear-gradient(0deg, #FFFFFF 4%, #AFE7FC 48%, #A8D1FF 71%, #CDDAFA 85%, #FFFBF2 100%);
  color: var(--gp-texto);
}
/* Oscuro: lo que lee de --gma-* ya se da vuelta solo (gamma.css); acá van los tokens propios. */
[data-tema="oscuro"] .gp {
  --gp-tenue: #aeaeb2; --gp-debil: #8b8b90; --gp-titulo: #f5f5f6;
  --gp-activo-fondo: #0b2e79; --gp-activo-texto: #aad5fe;
  --gp-peligro: #f87171;
  --gp-lila-fondo: #2a2346; --gp-lila-num: #acbef5;
  --gp-cielo: linear-gradient(0deg, #131314 4%, #0b2e79 62%, #002253 100%);
}
.gp, .gp * { box-sizing: border-box; }
.gp button { font: inherit; color: inherit; }
.gp .gp-ico { display: inline-flex; flex: none; line-height: 0; }
.gp .gp-ico svg { display: block; }

/* Botones: todos píldora (Chakra borderRadius full). sm = 32px de alto, 14px. */
.gp .gp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 32px; padding: 0 14px; border-radius: 9999px; border: 1px solid transparent; font-size: 14px; font-weight: 600; line-height: 1; cursor: pointer; white-space: nowrap; transition: background-color .15s, border-color .15s, box-shadow .15s; }
.gp .gp-btn:disabled { opacity: .5; cursor: not-allowed; }
.gp .gp-btn[data-tam="lg"] { height: 40px; padding: 0 20px; font-size: 15px; }
.gp .gp-btn-primario { background: var(--gp-primario); color: var(--gp-primario-texto); }
.gp .gp-btn-primario:hover:not(:disabled) { background: var(--gp-primario-hover); }
.gp .gp-btn-secundario { background: var(--gp-secundario); color: var(--gp-secundario-texto); }
.gp .gp-btn-contorno { background: var(--gp-superficie); border-color: var(--gp-borde); color: var(--gp-texto); }
.gp .gp-btn-contorno:hover:not(:disabled) { background: var(--gp-hover); }
.gp .gp-btn-fantasma { background: transparent; color: var(--gp-texto); }
.gp .gp-btn-fantasma:hover:not(:disabled) { background: var(--gp-hover); }
.gp .gp-btn-peligro { background: var(--gp-peligro); color: #fff; }
.gp .gp-btn-ia { background: var(--gp-primario); color: var(--gp-primario-texto); }
.gp .gp-insignia-ia { display: inline-flex; align-items: center; height: 16px; padding: 0 5px; border-radius: 4px; background: rgba(255,255,255,.22); font-size: 10px; font-weight: 700; letter-spacing: .04em; }
.gp .gp-icono-btn { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 9999px; border: 0; background: transparent; color: var(--gp-tenue); cursor: pointer; }
.gp .gp-icono-btn:hover:not(:disabled) { background: var(--gp-hover); color: var(--gp-texto); }
.gp .gp-pildora { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 9999px; border: 1px solid var(--gp-borde); background: var(--gp-superficie); color: var(--gp-texto); font-size: 13px; font-weight: 500; cursor: pointer; max-width: 100%; }
.gp .gp-pildora:hover:not(:disabled) { background: var(--gp-hover); }
.gp .gp-pildora-texto { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp .gp-chip { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 8px; border-radius: 9999px; background: var(--gp-azul-100); color: var(--gp-azul-800); font-size: 11.5px; font-weight: 600; white-space: nowrap; }
[data-tema="oscuro"] .gp .gp-chip { background: #0b2e79; color: #aad5fe; }
.gp .gp-campo { width: 100%; height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--gp-borde); background: var(--gp-superficie); color: var(--gp-texto); font: inherit; font-size: 14px; outline: none; }
.gp textarea.gp-campo { height: auto; padding: 10px 12px; resize: vertical; line-height: 1.5; }
.gp .gp-campo:focus { border-color: var(--gp-azul-500); box-shadow: 0 0 0 3px rgba(44,136,247,.18); }
.gp .gp-campo::placeholder { color: var(--gp-debil); }
.gp .gp-error { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: var(--gp-peligro); font-size: 13.5px; font-weight: 500; }
.gp .gp-error .gp-btn { height: 28px; }
.gp :focus-visible { outline: 2px solid var(--gp-azul-500); outline-offset: 2px; }

/* Menú (medido: padding 8, radio 16, ítems 500 14px, padding 6px 8px, radio 6). */
.gp .gp-menu { position: fixed; padding: 8px; border-radius: 16px; background: var(--gp-menu-fondo); color: var(--gp-menu-texto); box-shadow: var(--gp-sombra-menu); border: 1px solid var(--gp-borde-suave); max-height: min(70vh, 520px); overflow-y: auto; }
.gp .gp-menu-item { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 32px; padding: 6px 8px; border: 0; border-radius: 6px; background: transparent; color: inherit; font-size: 14px; font-weight: 500; text-align: left; cursor: pointer; }
.gp .gp-menu-item[data-sub="si"] { align-items: flex-start; }
.gp .gp-menu-item[data-sub="si"] .gp-ico { margin-top: 2px; }
.gp .gp-menu-item:hover:not(:disabled), .gp .gp-menu-item:focus-visible { background: var(--gp-hover); outline: none; }
.gp .gp-menu-item:disabled { opacity: .45; cursor: default; }
.gp .gp-menu-item[data-peligro="si"] { color: var(--gp-peligro); }
.gp .gp-menu-item[data-activo="si"] { color: var(--gp-activo-texto); }
.gp .gp-menu-textos { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.gp .gp-menu-texto { overflow: hidden; text-overflow: ellipsis; }
.gp .gp-menu-sub { color: var(--gp-tenue); font-size: 12.5px; font-weight: 400; line-height: 1.35; white-space: normal; }
.gp .gp-menu-check { margin-left: auto; color: var(--gp-activo-texto); }
.gp .gp-menu-sep { height: 1px; margin: 6px 4px; background: var(--gp-borde-suave); }

/* Diálogo */
.gp .gp-velo { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(19,19,20,.48); }
.gp .gp-dialogo { max-width: 100%; max-height: calc(100vh - 32px); display: flex; flex-direction: column; border-radius: 16px; background: var(--gp-superficie); color: var(--gp-texto); box-shadow: var(--gp-sombra-xl); outline: none; }
.gp .gp-dialogo-cabeza { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 16px 4px 24px; }
.gp .gp-dialogo-titulo { margin: 0; font-size: 20px; font-weight: 600; color: var(--gp-titulo); line-height: 1.25; }
.gp .gp-dialogo-cuerpo { padding: 8px 24px 16px; overflow-y: auto; font-size: 14px; line-height: 1.5; }
.gp .gp-dialogo-pie { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 24px 20px; flex-wrap: wrap; }

/* Toast (Chakra: titanium-800, radio 8). */
.gp .gp-aviso { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 3400; display: flex; align-items: center; gap: 14px; max-width: calc(100vw - 32px); padding: 10px 16px; border-radius: 8px; background: #38383c; color: #f5f5f6; font-size: 14px; font-weight: 500; box-shadow: var(--gp-sombra-menu); animation: gp-sube .2s ease-out; }
.gp .gp-aviso-deshacer { border: 0; background: transparent; color: #84c1fa; font-weight: 600; cursor: pointer; padding: 0; }
@keyframes gp-sube { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* Miniatura: el render público escalado por --gm-base (ver la cabecera del archivo). */
.gp .gp-mini { position: relative; width: 100%; overflow: hidden; container-type: inline-size; border-radius: 8px; background: var(--gp-borde-suave); isolation: isolate; }
.gp .gp-mini[data-entera="si"] { overflow: visible; border-radius: 0; background: transparent; }
.gp .gp-mini-lienzo { height: 100%; pointer-events: none; user-select: none; }
.gp .gp-mini .gm-doc { --gm-base: calc(100cqw / 64.5); --gm-base-movil: calc(100cqw / 64.5); height: 100%; }
.gp .gp-mini .gm-fondo { height: 100%; }
.gp .gp-mini[data-entera="si"] .gm-doc, .gp .gp-mini[data-entera="si"] .gm-fondo { height: auto; }

/* Muestra de tema (la tarjeta «Título / Cuerpo y enlace» de la galería de Gamma). */
.gp .gp-muestra { display: flex; align-items: center; justify-content: center; aspect-ratio: 16 / 10; padding: 10% 12%; border-radius: 8px; background: var(--gm-fondo); background-size: cover; background-position: center; overflow: hidden; font-size: 13px; }
.gp .gp-muestra[data-grande="si"] { font-size: 22px; }
.gp .gp-muestra-tarjeta { width: 100%; padding: .8em 1em; border-radius: min(var(--gm-radio-tarjeta, .6em), 1.2em); background: var(--gm-tarjeta-fondo); backdrop-filter: var(--gm-tarjeta-filtro); -webkit-backdrop-filter: var(--gm-tarjeta-filtro); box-shadow: var(--gm-tarjeta-borde), var(--gm-tarjeta-sombra); text-align: left; }
.gp .gp-muestra-titulo { font-family: var(--gm-fuente-titulo); font-weight: var(--gm-peso-titulo); font-size: 1.45em; line-height: 1.15; letter-spacing: var(--gm-tracking-titulos); color: var(--gm-titulo-relleno, var(--gm-titulo)); background: var(--gm-titulo-degradado); -webkit-background-clip: text; background-clip: text; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gp .gp-muestra-cuerpo { margin-top: .3em; font-family: var(--gm-fuente-cuerpo); font-weight: var(--gm-peso-cuerpo); font-size: .95em; color: var(--gm-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gp .gp-muestra-enlace { color: var(--gm-enlace); text-decoration: underline; text-underline-offset: .15em; }

/* Bloques de pantalla, rótulos, vacío y el giro (un «Cargando…» escrito no es un loader). */
.gp .gp-etiqueta { font-size: 13px; font-weight: 600; color: var(--gp-texto); }
.gp .gp-bloque { display: flex; flex-direction: column; gap: 14px; }
.gp .gp-bloque-cabeza { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.gp .gp-bloque-titulo { margin: 0; font-size: 17px; font-weight: 600; color: var(--gp-titulo); }
.gp .gp-bloque-sub { margin: 4px 0 0; font-size: 13.5px; color: var(--gp-tenue); }
.gp .gp-vacio { margin: 0; padding: 32px 0; text-align: center; color: var(--gp-tenue); font-size: 14px; }
.gp .gp-giro { display: inline-block; width: 16px; height: 16px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: gp-gira .7s linear infinite; flex: none; }
@keyframes gp-gira { to { transform: rotate(360deg); } }
.gp .gp-brillo { background: linear-gradient(90deg, var(--gp-borde-suave) 0%, var(--gp-superficie-2) 50%, var(--gp-borde-suave) 100%); background-size: 200% 100%; animation: gp-brilla 1.4s ease-in-out infinite; border-radius: 6px; }
@keyframes gp-brilla { from { background-position: 100% 0; } to { background-position: -100% 0; } }

/* Galería de temas y chips de filtro. */
.gp .gp-tema-grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
.gp .gp-tema { display: flex; flex-direction: column; gap: 8px; padding: 6px; border: 2px solid transparent; border-radius: 12px; background: transparent; text-align: left; cursor: pointer; transition: border-color .15s, background-color .15s; }
.gp .gp-tema:hover { background: var(--gp-hover); }
.gp .gp-tema[data-activo="si"] { border-color: var(--gp-azul-600); background: var(--gp-activo-fondo); }
.gp .gp-tema .gp-muestra { box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
.gp .gp-tema-pie { display: flex; align-items: center; gap: 6px; min-height: 20px; padding: 0 2px; font-size: 13.5px; font-weight: 600; color: var(--gp-texto); }
.gp .gp-tema[data-activo="si"] .gp-tema-pie { color: var(--gp-activo-texto); }
.gp .gp-tema-nombre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp .gp-tema-pie .gp-chip { margin-left: auto; }
.gp .gp-filtros { display: flex; flex-wrap: wrap; gap: 8px; }
.gp .gp-filtro { height: 30px; padding: 0 12px; border: 0; border-radius: 9999px; background: var(--gp-borde-suave); color: var(--gp-texto); font-size: 13px; font-weight: 500; cursor: pointer; }
.gp .gp-filtro:hover { background: var(--gp-borde); }
.gp .gp-filtro[aria-pressed="true"] { background: var(--gp-activo-fondo); color: var(--gp-activo-texto); }

/* «Del generador anterior» (DialogoBorradores). */
.gp .gp-borradores { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.gp .gp-borrador { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border: 1px solid var(--gp-borde-suave); border-radius: 10px; background: var(--gp-superficie); text-align: left; cursor: pointer; color: var(--gp-tenue); }
.gp .gp-borrador:hover:not(:disabled) { border-color: var(--gp-azul-300); }
.gp .gp-objetivo > .gp-ico:first-child { flex: none; color: var(--gp-azul-600); }
.gp .gp-borrador-textos { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.gp .gp-borrador-titulo { color: var(--gp-titulo); font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp .gp-borrador-sub { font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp .gp-esperando-centro { display: flex; justify-content: center; padding: 24px; color: var(--gp-tenue); }

@media (prefers-reduced-motion: reduce) { .gp *, .gp *::before, .gp *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
`;
