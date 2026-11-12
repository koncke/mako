'use client';

// =============================================================================
// PanelAgente — «Edición con IA»: el panel izquierdo de Gamma 5, con el chat del agente
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing Generator" un
// editor de landing tipo GAMMA. Replica por completo a Gamma, que se pueda hacer todo lo que
// ahí se hace.» Diseño: docs/diseno-editor-landing.md (D5, D8; paquete I2). Lo que se copia
// de Gamma 5 (relevo gamma-ui §5.1 y §5.11):
//   · header: ⌂ en un círculo + título + ⇤ colapsar;
//   · mensajes del agente en burbuja gris (#f5f5f6) y del usuario en burbuja azul clara
//     (#ebf3fe), a la derecha;
//   · sugerencias en píldoras celestes; input al pie «Envía un mensaje al agente…» con el
//     botón enviar redondo (gris → azul cuando hay texto);
//   · mientras la IA trabaja el input se bloquea con «Espera a que la IA termine» (Gamma §8);
//   · la respuesta es un CAMBIO PROPUESTO con el toggle «Original | Modificado» y se acepta o
//     se descarta entera; después de aceptar, «Restaurar» la vuelve atrás.
// Lo que NO se copia: «Abrir archivos», la lista de chats guardados del agente y la búsqueda en la
// web. La charla de cada landing SÍ se guarda desde el 22/10/2026 (antes vivía sólo en la memoria
// de la pestaña): cada turno va a la base con la clave `landing:<id>` y se ve en el Ops Center
// (../hilo-agente.ts, lib/hilo-de-tab-reglas.ts).
//
// ADJUNTAR (⊕), desde el 20/10/2026. El 11/10 no se copió a propósito; en el onboarding de Florencia
// (llamada de Fathom 864249059, 18/10) ella no pudo darle su documento y el PDF «Lo que vendes» al chat
// («No me permite») y Martín: «es un error… no te está permitiendo juntar documentos, yo lo voy a
// solucionar». Son las piezas del Ops Center (un solo chat en toda la app, regla del 18/10): desde el
// 22/10/2026 (TB3) la caja ES la única (`CajaChat`, con su «+», sus miniaturas y pegar) y el hilo es
// `HiloMako`, los dos en ./ChatAgente.tsx. Desde el 23/10/2026 todo va adentro del panel único (`PanelAgenteChat`, PanelDeChat):
// la cabecera con la estrella de MaKo, y soltar es del panel (lo adjuntado de la caja).
// La propuesta, las burbujas de pedidos y los errores entran por el hueco `enMensaje` del hilo
// (`enMensaje`, abajo). Cada archivo se LEE al entrar (la ruta de Importar) y su
// texto viaja con el pedido a «editar», que lo pone en el contexto como datos
// (lib/editor-landing/adjuntos.ts). Si el onboarding dejó «Lo que vendes» en El Archivero, se ofrece
// como chip. Lo puro (qué entra, qué se avisa, cuándo se manda) está en ../adjuntos-agente.ts.
// Las piezas toman los colores del editor: CSS_AGENTE redefine sus tokens (--surface, --border…)
// bajo `.gma-ag` (AGENTS.md, «Una pantalla oscura se hace redefiniendo TOKENS»).
// ⚠️ ESTE ARCHIVO NO CARGA CSS. Lo importan módulos que cargan los tests (DialogoAnalitica, AskAgent…) y en
//    node un `.css` no carga: tiró abajo tests/editor-landing-agente.test.ts (20/10/2026). Por eso el hilo y
//    la caja (./ChatAgente.tsx, que trae las piezas con su CSS) entran con `next/dynamic`, y soltar viene de
//    pegar.ts (sin CSS).
//
// Además de la pantalla, este archivo EXPORTA lo que comparte con el popover de una sección
// (AskAgent.tsx) y con el historial y el modo Presentar: el pedido a las rutas, la revisión
// «Original | Modificado», aceptar/restaurar y la miniatura de una sección. Una sola copia: si
// el flujo de aceptar viviera en los dos, el segundo se quedaría viejo (AGENTS.md, «Una cosa,
// un lugar»).
//
// ⚠️ ACEPTAR GUARDA LA VERSIÓN ANTES DE TOCAR EL DOCUMENTO (D8). Primero lo pendiente
//    (`guardarAhora`: la versión la arma el server desde lo GUARDADO), después
//    `guardarVersion` con el motivo «Antes de un cambio de IA», y recién ahí
//    `reemplazarTarjetas`/`insertarTarjetas`. Si la versión no se guardó, NO se aplica: la
//    tarjeta ofrece «Aplicar igual» (lo deshace Ctrl+Z igual). Lo fija
//    tests/editor-landing-agente.test.ts leyendo `aceptarPropuesta`.
// ⚠️ UNA PROPUESTA ES DE SU PÁGINA. El editor es uno solo y cambiar de página es `setContent`
//    de la otra: aplicar al volver la respuesta podría reemplazar secciones de OTRA página. Se
//    compara la página de la propuesta con la viva (por un getter: el `ctx` de un render viejo
//    miente después de un `await`).
//
// LOS PEDIDOS SUELTOS (Martín, 16/10/2026, textual en docs/diseno-mako-pedidos.md: «Feedback sobre lo
// actual... Y luego y también quiero que me crees otra landing para mi otro producto...»). Antes de
// «editar», el mensaje pasa por POST /api/mako/pedidos (`pedirPedidos`, con su plazo): lo de la
// landing abierta sigue a «editar» como siempre y lo demás queda en el hilo como burbujas de MaKo
// con sus botones (crear otra landing, mandar OTRA a la Papelera, abrir otra, ir a otra tab). Lo
// que se dibuja y lo que hace cada botón es puro: ../pedidos-chat.ts, con test. Si la ruta falla o
// tarda, el mensaje ENTERO va a «editar»: el chat hace lo de antes. Las sugerencias son pedidos
// NUESTROS, de edición: no se interpretan.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import dynamic from 'next/dynamic';
import Link, { useRouter, useWs } from '@/app/_ui/Link';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import type { EnMensaje } from '@/app/_chat/HiloMako';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { instruccionConAdjuntos, type AdjuntoEditar } from '@/lib/editor-landing/adjuntos';
import { useEditorLanding, type CtxEditorLanding } from '../contexto';
import { MUCHO_PARA_EDITAR, esPresentacion, formatoDe, terminoTarjeta, type ConfigLanding } from '@/lib/editor-landing/api-tipos';
import { SelectorIntencion, useIntencion } from '@/app/_chat/SelectorIntencion';
import { armarConCita, separarCita, type Cita, type MensajeWA } from '@/lib/centro-mensajes';
import type { JsonNodo } from '@/lib/editor-landing/doc';
import {
  PLAZO_PEDIDOS_MS, bajarDelArchivero, cortadoPorUsuario, leerArchivo, pedirDocs, pedirIA, pedirLoQueVendes, pedirPedidos, type DocDelArchivero,
} from '../../cliente';
import { avisoDeAdjuntos, conLectura, ofreceDoc, paraEnviar, puedeMandar, queSumar, tipoDeAdjunto, type AdjuntoAgente } from '../adjuntos-agente';
import {
  CLAVE_CAJA, RUTA_CREAR, alTerminar, alVolver, burbujasDe, cajaParaCrear, cuerpoPedidos, interpretacionDe, pulsar, sinTerminar,
  textoActual, trasNoAbrir, trasPapelera, trasRestaurar, vistaDeBurbuja, type BurbujaPedido, type EfectoPedido,
} from '../pedidos-chat';
import { filasDeAgente, mensajesDeFilas, tituloDeLanding } from '../hilo-agente';
import { guardarEnHiloDeTab, leerHiloDeTab } from '@/lib/hilo-de-tab-cliente';
import { claveDeLanding } from '@/lib/hilo-de-tab-reglas';
import { urlFuentes, type Tema } from '@/lib/editor-landing/temas';
import { htmlDeTarjeta } from '@/lib/editor-landing/render';
import { rangosACompletar } from '@/lib/editor-landing/especificacion';
import { CSS_CONTENIDO } from '@/lib/editor-landing/css';
import { svgIcono } from '@/lib/editor-landing/iconos';
import {
  MOTIVO_ANTES_DE_IA, anclasResueltas, diffTarjetas, idDe, planDeAplicacion, resumenDeCambios, tarjetasDelDoc, tocadasDesde,
  type CambioSeccion,
} from '../diff-tarjetas';
import { trQuitarYOrdenar } from '../insertar';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';
import { useNotaEnElActo } from '@/app/_chat/useNotaEnElActo';
import { RecomendacionesDeMako } from '@/app/_chat/RecomendacionesDeMako';

// ─────────────────────────────────────────────────────────────────────────────
// Pedidos a las rutas: viven en ../../cliente (una sola copia; había cuatro). Se re-exportan
// para los paneles B que ya los importaban de acá.
// ─────────────────────────────────────────────────────────────────────────────

export {
  PLAZO_IA_MS, PLAZO_DOCS_MS, PLAZO_IMAGENES_MS, cortadoPorUsuario, postJson, pedirDocs, pedirIA, pedirImagenes,
  type FallaPedido,
} from '../../cliente';

// ─────────────────────────────────────────────────────────────────────────────
// Estilos: los tokens del chrome de Gamma para los paneles B, y la hoja del contenido
// ─────────────────────────────────────────────────────────────────────────────
// La hoja del chrome (app/web-generator/gamma.css) es del armazón; estos paneles traen la
// suya, limitada a `.gma-pb`, y sus tokens SALEN de los de esa hoja (`--gma-superficie`,
// `--gma-borde`, `--gma-primario`…: los valores MEDIDOS de Gamma, titanium y deepocean), con el
// mismo valor de respaldo por si se monta afuera. Toda raíz de estos paneles lleva también la
// clase `gma`: los que se portalean al body (el popover, Presentar) quedan fuera del árbol del
// editor y sin ella no heredarían ni los tokens ni su modo oscuro (que gamma.css redefine bajo
// `[data-tema="oscuro"] .gma`, AGENTS.md «Una pantalla oscura se hace redefiniendo TOKENS»). Lo
// que gamma.css no tiene (el azul más claro de las burbujas, el verde, el ámbar) se define acá.

const CSS_PANELES_B = `
.gma-pb{--pb-fondo:var(--gma-superficie,#ffffff);--pb-sup:var(--gma-superficie-2,#f5f5f6);--pb-sup2:var(--gma-superficie-3,#ececed);--pb-borde:var(--gma-borde,#dfdfe0);--pb-texto:var(--gma-texto-fuerte,#38383c);--pb-tenue:var(--gma-texto,#4d4d51);--pb-suave:var(--gma-tenue,#8b8b90);--pb-titulo:#121826;--pb-azul:var(--gma-primario,#0540ad);--pb-azul-hover:var(--gma-primario-hover,#0740df);--pb-azul-txt:var(--gma-sobre-primario,#ffffff);--pb-vivo:var(--gma-seleccion,#2c88f7);--pb-celeste:var(--gma-b50,#ebf3fe);--pb-celeste2:var(--gma-secundario,#d0e6fe);--pb-tinta:var(--gma-sobre-secundario,#002253);--pb-ok:#176a3d;--pb-ok-bg:#1d7a481f;--pb-mal:var(--gma-rojo,#b91c1c);--pb-mal-bg:var(--gma-rojo-fondo,#fef2f2);--pb-ambar:#8a5a00;--pb-ambar-bg:#c98a142b;--pb-sombra:var(--gma-sombra-menu,0 8px 16px rgba(0,0,0,.15));font-family:var(--gma-fuente,'Geist',system-ui,sans-serif);color:var(--pb-texto);font-size:14px;line-height:1.45;font-weight:500;-webkit-font-smoothing:antialiased}
[data-tema="oscuro"] .gma-pb{--pb-titulo:#e8ecf3;--pb-celeste:#6e98ff24;--pb-tinta:#9ab7ff;--pb-ok:#6fcf97;--pb-ok-bg:#6fcf9724;--pb-ambar:#e6b45c;--pb-ambar-bg:#e6b45c24;--pb-sombra:0 2px 6px #0006,0 30px 70px -24px #000c}
[data-tema="oscuro"] .gma-pb:not(.gma){--pb-fondo:#151a22;--pb-sup:#11151c;--pb-sup2:#232a37;--pb-borde:#e8ecf329;--pb-texto:#e8ecf3;--pb-tenue:#c6ccd7;--pb-suave:#99a2b3;--pb-azul:#6e98ff;--pb-azul-hover:#8eafff;--pb-azul-txt:#0b1222;--pb-vivo:#6e98ff;--pb-celeste2:#6e98ff24;--pb-mal:#f2877b;--pb-mal-bg:#f2877b24}
.gma-pb *,.gma-pb *::before,.gma-pb *::after{box-sizing:border-box}
.gma-pb-ico{display:inline-flex;flex:none;align-items:center;justify-content:center;line-height:0}
.gma-pb-ico svg{display:block}
.gma-pb-boton{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 14px;border-radius:999px;border:1px solid transparent;background:var(--pb-sup2);color:var(--pb-texto);font:inherit;font-size:13px;font-weight:600;white-space:nowrap;cursor:pointer;transition:background .15s ease,color .15s ease,border-color .15s ease}
.gma-pb-boton:hover:not(:disabled){background:var(--pb-borde)}
.gma-pb-boton:disabled{opacity:.55;cursor:default}
.gma-pb-boton[data-v="primario"]{background:var(--pb-azul);color:var(--pb-azul-txt)}
.gma-pb-boton[data-v="primario"]:hover:not(:disabled){background:var(--pb-azul-hover)}
.gma-pb-boton[data-v="secundario"]{background:var(--pb-celeste2);color:var(--pb-tinta)}
.gma-pb-boton[data-v="secundario"]:hover:not(:disabled){background:var(--pb-celeste)}
.gma-pb-boton[data-v="contorno"]{background:transparent;border-color:var(--pb-borde)}
.gma-pb-boton[data-v="contorno"]:hover:not(:disabled){background:var(--pb-sup)}
.gma-pb-boton[data-v="fantasma"]{background:transparent;color:var(--pb-tenue)}
.gma-pb-boton[data-v="fantasma"]:hover:not(:disabled){background:var(--pb-sup);color:var(--pb-texto)}
.gma-pb-boton[data-t="s"]{height:28px;padding:0 11px;font-size:12.5px}
.gma-pb-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:none;border:0;border-radius:6px;background:transparent;color:var(--pb-tenue);cursor:pointer;padding:0}
.gma-pb-iconbtn:hover:not(:disabled){background:var(--pb-sup);color:var(--pb-texto)}
.gma-pb-iconbtn:disabled{opacity:.45;cursor:default}
.gma-pb-iconbtn:focus-visible,.gma-pb-boton:focus-visible{outline:2px solid var(--pb-vivo);outline-offset:2px}
.gma-pb-giro{display:inline-block;width:14px;height:14px;flex:none;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:gmaPbGiro .7s linear infinite;opacity:.8}
@keyframes gmaPbGiro{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.gma-pb-giro{animation-duration:2.4s}}
.gma-pb-mini{position:relative;display:block;width:100%;overflow:hidden;border-radius:8px;box-shadow:0 0 0 1px var(--pb-borde);pointer-events:none;user-select:none;background:var(--pb-sup)}
.gma-pb-mini[data-tope]::after{content:"";position:absolute;left:0;right:0;bottom:0;height:28px;background:linear-gradient(to bottom,transparent,rgba(0,0,0,.08))}
.gma-pb-segmento{display:inline-flex;padding:2px;border-radius:999px;background:var(--pb-sup2);gap:2px}
.gma-pb-segmento>button{height:26px;padding:0 11px;border:0;border-radius:999px;background:transparent;color:var(--pb-tenue);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.gma-pb-segmento>button[aria-pressed="true"]{background:var(--pb-fondo);color:var(--pb-texto);box-shadow:0 1px 2px rgba(0,0,0,.12)}
.gma-rv{display:grid;gap:10px;padding:12px;border-radius:14px;background:var(--pb-fondo);box-shadow:0 0 0 1px var(--pb-borde)}
.gma-rv-cab{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.gma-rv-resumen{font-size:13px;font-weight:600;color:var(--pb-texto)}
.gma-rv-lista{display:grid;gap:12px;margin:0;padding:0;list-style:none}
.gma-rv-fila{display:grid;gap:6px}
.gma-rv-tit{display:flex;align-items:center;gap:6px;min-width:0;font-size:13px}
.gma-rv-tit b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.gma-rv-tag{flex:none;padding:1px 7px;border-radius:6px;font-size:11px;font-weight:700;background:var(--pb-celeste2);color:var(--pb-tinta)}
.gma-rv-tag[data-t="agrega"]{background:var(--pb-ok-bg);color:var(--pb-ok)}
.gma-rv-tag[data-t="quita"]{background:var(--pb-mal-bg);color:var(--pb-mal)}
.gma-rv-frag{margin:0;font-size:12.5px;line-height:1.45;color:var(--pb-tenue)}
.gma-rv-frag[data-lado="antes"]{text-decoration:line-through;text-decoration-color:var(--pb-suave)}
.gma-rv-vacia{display:grid;place-items:center;height:64px;border-radius:8px;border:1px dashed var(--pb-borde);color:var(--pb-suave);font-size:12px}
.gma-rv-mas{font-size:12px;color:var(--pb-tenue)}
.gma-rv-aviso{margin:0;padding:6px 10px;border-radius:8px;background:var(--pb-ambar-bg);color:var(--pb-ambar);font-size:12.5px}
.gma-rv-error{margin:0;padding:6px 10px;border-radius:8px;background:var(--pb-mal-bg);color:var(--pb-mal);font-size:12.5px}
.gma-rv-acciones{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.gma-rv-hecho{display:inline-flex;align-items:center;gap:6px;margin-right:auto;font-size:12.5px;font-weight:600;color:var(--pb-tenue)}
`;

/** Los tokens y las piezas comunes de los paneles B. React 19 la sube al <head> y la deduplica por `href`. */
export function EstilosPanelesB() {
  return <style href="gma-paneles-b" precedence="medium">{CSS_PANELES_B}</style>;
}

/**
 * La hoja del CONTENIDO (la misma del editor y de la página publicada) y las fuentes del tema, para
 * dibujar una sección fuera del editor (miniaturas, una versión vieja, Presentar). `href` igual al que
 * use el armazón = una sola copia en la página.
 */
export function EstilosContenido({ tema }: { tema: Tema }) {
  const fuentes = useMemo(() => { try { return urlFuentes([tema]); } catch { return ''; } }, [tema]);
  return (
    <>
      <style href="gm-contenido" precedence="medium">{CSS_CONTENIDO}</style>
      {fuentes ? <link rel="stylesheet" href={fuentes} precedence="medium" /> : null}
    </>
  );
}

/** Un ícono del catálogo de la landing (Phosphor, lib/editor-landing/iconos.ts). */
export function Ico({ n, t = 16 }: { n: string; t?: number }) {
  return <span className="gma-pb-ico" aria-hidden dangerouslySetInnerHTML={{ __html: svgIcono(n, t) }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// La miniatura de una sección
// ─────────────────────────────────────────────────────────────────────────────

/** El ancho de un elemento, vivo (ResizeObserver). 0 hasta la primera medida. */
export function useAncho(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setW(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/**
 * Una sección dibujada con el render público en modo 'miniatura' (sin iframes ni videos), a la
 * escala del cuadro: la sección mide 64.5em y `--gm-base` = ancho / 64.5 (contrato de css.ts).
 * Hasta medir no se ve: con la base por defecto (15-18 px) asomaría gigante un cuadro.
 */
export function Miniatura({ tarjeta, tema, alto }: { tarjeta: JsonNodo; tema: Tema; alto?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const ancho = useAncho(ref);
  const html = useMemo(() => {
    // Con MARCADORES (render.ts): el Agente muestra la sección que se está editando (la original y la
    // que propone), y el VSL vacío tiene que verse como el hueco del editor, no desaparecer.
    try { return htmlDeTarjeta(tarjeta, tema, { modo: 'miniatura', incluirOcultas: true, marcadores: true }); } catch { return ''; }
  }, [tarjeta, tema]);
  const estilo = {
    ['--gm-base' as string]: ancho ? `${ancho / 64.5}px` : undefined,
    visibility: ancho ? 'visible' : 'hidden',
    maxHeight: alto,
  } as CSSProperties;
  return <div ref={ref} className="gma-pb-mini" data-tope={alto ? '' : undefined} style={estilo} aria-hidden inert dangerouslySetInnerHTML={{ __html: html }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// La propuesta de la IA: revisar, aceptar, restaurar
// ─────────────────────────────────────────────────────────────────────────────

type DocPM = Editor['state']['doc'];

/** Lo que propuso la IA, con lo que se le mandó (la vista «Original»). */
export type Propuesta = {
  /** La página del editor en la que se pidió (la propuesta sólo se aplica en ésa). */
  paginaId: string;
  /** Las secciones que se mandaron, como estaban al mandarlas. */
  enviadas: JsonNodo[];
  /** Lo que volvió: las que cambian (mismo id) y las nuevas (id nuevo). */
  tarjetas: JsonNodo[];
  /** Después de cuál va una nueva si en la respuesta no la precede ninguna existente. */
  anclaNuevas: string | null;
  /** Lo que cambia de la LISTA (28/10/2026, `EdicionIA`): las que se sacan, el orden nuevo y las copias. */
  quitar?: string[];
  orden?: string[];
  copias?: Record<string, string>;
};

/** Las opciones de `planDeAplicacion` que salen de una propuesta. */
export const opcionesDePlan = (p: Propuesta) => ({ anclaNuevas: p.anclaNuevas, quitar: p.quitar, orden: p.orden, copias: p.copias });

/** ¿La respuesta de «editar» propone algo? Además de tarjetas, puede sacar secciones o reordenarlas. */
export const proponeAlgo = (r: { tarjetas: JsonNodo[]; quitar?: string[]; orden?: string[] }) => r.tarjetas.length > 0 || !!r.quitar?.length || !!r.orden?.length;

/** Lo de la LISTA que trae la respuesta de «editar», para la propuesta. */
export const listaDeRespuesta = (r: { quitar?: string[]; orden?: string[]; copias?: Record<string, string> }) => ({
  ...(r.quitar?.length ? { quitar: r.quitar } : {}),
  ...(r.orden?.length ? { orden: r.orden } : {}),
  ...(r.copias && Object.keys(r.copias).length ? { copias: r.copias } : {}),
});

export type EstadoPropuesta = 'pendiente' | 'aplicando' | 'sin-version' | 'aplicada' | 'descartada' | 'restaurada';

/** Lo necesario para deshacer un cambio aplicado (ver `deshacerPropuesta`). */
export type Aplicada = { docAntes: DocPM; docDespues: DocPM; pasos: number };

export type ResultadoAceptar = { ok: true; aplicada: Aplicada } | { ok: false; error: string; sinVersion?: boolean };

type CtxAceptar = Pick<CtxEditorLanding, 'docId' | 'editor' | 'paginaActual' | 'guardarAhora' | 'reemplazarTarjetas' | 'insertarTarjetas'>;

/**
 * ACEPTAR un cambio de la IA. El orden es el contrato (ver la cabecera): lo pendiente, la versión
 * «Antes de un cambio de IA», y RECIÉN AHÍ el documento. `ctxVivo` devuelve el contexto del último
 * render: el de antes del `await` puede tener otra página abierta.
 */
export async function aceptarPropuesta(ctxVivo: () => CtxAceptar, propuesta: Propuesta, op: { sinVersion?: boolean } = {}): Promise<ResultadoAceptar> {
  const antes = ctxVivo();
  if (!antes.editor || antes.editor.isDestroyed) return { ok: false, error: 'El editor no está listo' };
  if (antes.paginaActual !== propuesta.paginaId) return { ok: false, error: 'Es de otra página' };

  // 1. La versión de respaldo, con lo último que escribió la persona ya guardado.
  if (!op.sinVersion) {
    await antes.guardarAhora();
    const v = await pedirDocs({ accion: 'guardarVersion', id: antes.docId, motivo: MOTIVO_ANTES_DE_IA });
    if (!v.ok) return { ok: false, error: 'No se guardó la versión', sinVersion: true };
  }

  // 2. Recién ahí, el documento: reemplazos por id y las nuevas en su lugar.
  const ctx = ctxVivo();
  const editor = ctx.editor;
  if (!editor || editor.isDestroyed) return { ok: false, error: 'El editor no está listo' };
  if (ctx.paginaActual !== propuesta.paginaId) return { ok: false, error: 'Es de otra página' };
  const docAntes = editor.state.doc;
  const actuales = tarjetasDelDoc(editor.getJSON());
  // Las anclas pendientes de la IA (`#t-formulario`, `#t-seccion-N`) se resuelven contra la página
  // que va a quedar, no contra la sección suelta que se convirtió en el server.
  const tarjetas = anclasResueltas(propuesta.tarjetas, propuesta.enviadas, actuales);
  const plan = planDeAplicacion(actuales, tarjetas, opcionesDePlan(propuesta));
  // UN paso de deshacer cuando se puede: `reemplazarTarjetas` (EditorLanding.tsx) hace todo en una
  // transacción y pone lo que trae un id desconocido «después de la última reemplazada». Si todas
  // las nuevas van justo ahí, va todo en esa llamada; si no, una llamada por lugar (cada una es su
  // transacción: Ctrl+Z las deshace de a una, y «Restaurar» las deshace todas).
  const nuevas = plan.inserciones.flatMap((g) => g.tarjetas);
  const ultimaReemplazada = plan.reemplazos.length ? idDe(plan.reemplazos[plan.reemplazos.length - 1]) : null;
  let pasos: number;
  if (ultimaReemplazada && plan.inserciones.every((g) => g.despuesDe === ultimaReemplazada)) {
    ctx.reemplazarTarjetas([...plan.reemplazos, ...nuevas]);
    pasos = 1;
  } else {
    if (plan.reemplazos.length) ctx.reemplazarTarjetas(plan.reemplazos);
    for (const g of plan.inserciones) ctx.insertarTarjetas(g.tarjetas, g.despuesDe);
    pasos = (plan.reemplazos.length ? 1 : 0) + plan.inserciones.length;
  }
  // Lo que cambia de la LISTA (sacar, reordenar), con todo lo de arriba ya puesto: un paso más.
  if (plan.quitadas.length || plan.reordenada) {
    const tr = trQuitarYOrdenar(editor.state, plan.quitadas, plan.reordenada ? plan.resultado.map(idDe) : null);
    if (tr) { editor.view.dispatch(tr); pasos++; }
  }
  // Si el documento no cambió, no se aplicó (el armazón no aplica en medio de un cambio de página,
  // o el esquema rechazó una sección): decir «Aplicado» sería mentir.
  if (editor.state.doc === docAntes) return { ok: false, error: 'No se aplicó el cambio' };
  return { ok: true, aplicada: { docAntes, docDespues: editor.state.doc, pasos } };
}

/**
 * «Restaurar» un cambio aplicado con el deshacer del editor, SÓLO si nadie tocó el documento
 * después (es el mismo nodo inmutable que dejó el cambio). Deshace de a un paso hasta volver al
 * documento de antes; si se pasa —el historial juntó el cambio con una edición anterior— rehace
 * todo y devuelve false: entonces la vuelta es la versión «Antes de un cambio de IA» del historial.
 */
export function deshacerPropuesta(editor: Editor | null, a: Aplicada): boolean {
  if (!editor || editor.isDestroyed || editor.state.doc !== a.docDespues) return false;
  const cmds = editor.commands as unknown as { undo?: () => boolean; redo?: () => boolean };
  if (typeof cmds.undo !== 'function') return false;
  let n = 0;
  while (n < a.pasos + 1 && !editor.state.doc.eq(a.docAntes)) {
    if (!cmds.undo()) break;
    n++;
  }
  if (editor.state.doc.eq(a.docAntes)) return true;
  for (let i = 0; i < n; i++) cmds.redo?.();
  return false;
}

const ETIQUETA_CAMBIO: Record<CambioSeccion['tipo'], string> = { cambia: 'Cambia', agrega: 'Nueva', quita: 'Se quita' };
const MAX_FILAS = 6;

/**
 * La revisión de una propuesta: «Original | Modificado» (Gamma 5), qué secciones cambian con un
 * pedazo del texto de antes y de después, y los botones según el estado.
 */
export function RevisionPropuesta({ propuesta, estado, aviso, onAceptar, onAplicarIgual, onDescartar, onRestaurar }: {
  propuesta: Propuesta;
  estado: EstadoPropuesta;
  aviso?: string;
  onAceptar: () => void;
  onAplicarIgual: () => void;
  onDescartar: () => void;
  onRestaurar?: () => void;
}) {
  const { tema, editor, config } = useEditorLanding();
  const [vista, setVista] = useState<'original' | 'modificado'>('modificado');
  const plan = useMemo(() => planDeAplicacion(propuesta.enviadas, propuesta.tarjetas, opcionesDePlan(propuesta)), [propuesta]);
  const diff = useMemo(() => diffTarjetas(propuesta.enviadas, plan.resultado), [propuesta, plan]);
  const antesPorId = useMemo(() => new Map(propuesta.enviadas.map((t) => [idDe(t), t] as const)), [propuesta]);
  const despuesPorId = useMemo(() => new Map(plan.resultado.map((t) => [idDe(t), t] as const)), [plan]);
  // Lo que se tocó en el documento DESPUÉS de mandarlo: aceptar pisa esa edición. Se recalcula
  // sólo si el documento cambió (el nodo es inmutable): `getJSON` en cada render pesa.
  const docVivo = estado === 'pendiente' && editor && !editor.isDestroyed ? editor.state.doc : null;
  const tocadas = useMemo(
    () => (docVivo && editor
      ? tocadasDesde(propuesta.enviadas, tarjetasDelDoc(editor.getJSON()), diff.cambios.filter((c) => c.tipo === 'cambia').map((c) => c.id))
      : []),
    [docVivo, editor, propuesta, diff],
  );
  const filas = diff.cambios.slice(0, MAX_FILAS);

  return (
    <div className="gma-rv">
      <div className="gma-rv-cab">
        <span className="gma-rv-resumen">{resumenDeCambios(diff) || 'Sin cambios'}</span>
        <div className="gma-pb-segmento" role="group" aria-label="Comparar">
          <button type="button" aria-pressed={vista === 'original'} onClick={() => setVista('original')}>Original</button>
          <button type="button" aria-pressed={vista === 'modificado'} onClick={() => setVista('modificado')}>Modificado</button>
        </div>
      </div>
      <ul className="gma-rv-lista">
        {filas.map((c) => {
          const antes = antesPorId.get(c.id);
          const despues = despuesPorId.get(c.id);
          const mostrar = vista === 'original' ? (c.tipo === 'agrega' ? null : antes) : (c.tipo === 'quita' ? null : despues);
          return (
            <li key={`${c.tipo}:${c.id}`} className="gma-rv-fila">
              <div className="gma-rv-tit">
                <span className="gma-rv-tag" data-t={c.tipo}>{ETIQUETA_CAMBIO[c.tipo]}</span>
                <b>{c.titulo}</b>
              </div>
              {c.tipo === 'cambia' && (c.soloDiseno
                ? <p className="gma-rv-frag">Mismo texto, otro diseño</p>
                : <p className="gma-rv-frag" data-lado={vista === 'original' ? 'antes' : undefined}>{vista === 'original' ? c.antes : c.despues}</p>)}
              {mostrar ? <Miniatura tarjeta={mostrar} tema={tema} alto={240} /> : <div className="gma-rv-vacia">{c.tipo === 'agrega' ? 'No existía' : 'Se quita'}</div>}
            </li>
          );
        })}
      </ul>
      {diff.cambios.length > MAX_FILAS && <span className="gma-rv-mas">y {diff.cambios.length - MAX_FILAS} más</span>}
      {tocadas.length > 0 && <p className="gma-rv-aviso">{tocadas.length === 1 ? `Editaste esa ${terminoTarjeta(config)} mientras tanto.` : `Editaste ${tocadas.length} de esas ${terminoTarjeta(config, { plural: true })} mientras tanto.`}</p>}
      {aviso && <p className="gma-rv-error" role="alert">{aviso}<ReportarASoporte /></p>}
      <div className="gma-rv-acciones">
        {estado === 'pendiente' && (
          <>
            <button type="button" className="gma-pb-boton" data-v="fantasma" data-t="s" onClick={onDescartar}>Descartar</button>
            <button type="button" className="gma-pb-boton" data-v="primario" data-t="s" onClick={onAceptar}>Aceptar</button>
          </>
        )}
        {estado === 'aplicando' && <span className="gma-rv-hecho"><span className="gma-pb-giro" aria-label="Aplicando" /></span>}
        {estado === 'sin-version' && (
          <>
            <button type="button" className="gma-pb-boton" data-v="fantasma" data-t="s" onClick={onDescartar}>Descartar</button>
            <button type="button" className="gma-pb-boton" data-v="secundario" data-t="s" onClick={onAplicarIgual}>Aplicar igual</button>
          </>
        )}
        {estado === 'aplicada' && (
          <>
            <span className="gma-rv-hecho"><Ico n="check" t={14} /> Aplicado</span>
            {onRestaurar && <button type="button" className="gma-pb-boton" data-v="contorno" data-t="s" onClick={onRestaurar}>Restaurar</button>}
          </>
        )}
        {estado === 'descartada' && <span className="gma-rv-hecho">Descartado</span>}
        {estado === 'restaurada' && <span className="gma-rv-hecho"><Ico n="deshacer" t={14} /> Restaurado</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El chat: en la memoria de la pestaña, por landing, y guardado en la base
// ─────────────────────────────────────────────────────────────────────────────
// Un store de módulo y no un estado del componente: el panel se colapsa (⇤) y se desmonta, y
// la respuesta de un pedido largo tiene que caer en el chat aunque el panel no esté abierto
// cuando llega. Desde el 22/10/2026 cada turno se guarda en la base al terminar (`terminar`), y
// una landing que la pestaña todavía no trajo trae su charla guardada (`traerHilo`): recargar
// ya no la pierde.

type Mensaje =
  /** `adjuntos`: los nombres de los archivos que viajaron con el mensaje (se ven como chips en la burbuja). */
  | { id: number; de: 'yo'; texto: string; seccion: string | null; adjuntos?: string[] }
  | { id: number; de: 'mako'; texto: string; error?: boolean; propuesta?: Propuesta; estado?: EstadoPropuesta; aviso?: string; aplicada?: Aplicada }
  /** Un pedido que NO es de la landing abierta (../pedidos-chat.ts): una burbuja de MaKo con sus botones. */
  | { id: number; de: 'pedido'; burbuja: BurbujaPedido };

type Hilo = { mensajes: Mensaje[]; corriendo: boolean };
const HILO_VACIO: Hilo = { mensajes: [], corriendo: false };
const hilos = new Map<number, Hilo>();
const cortes = new Map<number, AbortController>();
const oyentes = new Set<() => void>();
let ultimoId = 0;

function cambiarHilo(docId: number, f: (h: Hilo) => Hilo) {
  hilos.set(docId, f(hilos.get(docId) ?? HILO_VACIO));
  for (const o of oyentes) o();
}
function cambiarMensaje(docId: number, id: number, cambio: Partial<Extract<Mensaje, { de: 'mako' }>>) {
  cambiarHilo(docId, (h) => ({ ...h, mensajes: h.mensajes.map((m) => (m.id === id && m.de === 'mako' ? { ...m, ...cambio } : m)) }));
}
function cambiarBurbuja(docId: number, id: number, f: (b: BurbujaPedido) => BurbujaPedido) {
  cambiarHilo(docId, (h) => ({ ...h, mensajes: h.mensajes.map((m) => (m.id === id && m.de === 'pedido' ? { ...m, burbuja: f(m.burbuja) } : m)) }));
}
const comoMensajes = (bs: readonly BurbujaPedido[]): Mensaje[] => bs.map((burbuja) => ({ id: ++ultimoId, de: 'pedido', burbuja }));

/**
 * Un clic en un botón de una burbuja de pedido. Lee la burbuja del STORE, no la del render: el cambio de estado
 * es sincrónico, así que un segundo clic (aunque llegue antes de dibujar) ya la ve apagada y no repite la acción.
 */
function pulsarEnHilo(docId: number, id: number, boton: string): EfectoPedido | null {
  const mensajes = hilos.get(docId)?.mensajes ?? [];
  const m = mensajes.find((x) => x.id === id);
  if (!m || m.de !== 'pedido') return null;
  // «¿Terminamos esto y después…?» → «Sí» con un cambio sin aceptar ni descartar: la creación espera a que termine.
  const r = pulsar(m.burbuja, boton, docId, { sinTerminar: mensajes.some((x) => x.de === 'mako' && sinTerminar(x.estado)) });
  if (r.burbuja !== m.burbuja) cambiarBurbuja(docId, id, () => r.burbuja);
  if (r.efecto?.tipo === 'agregar') {
    const nueva = r.efecto.burbuja;
    cambiarHilo(docId, (h) => ({ ...h, mensajes: [...h.mensajes, ...comoMensajes([nueva])] }));
  }
  return r.efecto;
}

/** Las landings cuya charla guardada ya se pidió en esta pestaña (una vez: después, la del store es la verdad). */
const traidos = new Set<number>();
/** La charla guardada de una landing, ANTES de lo que se haya escrito mientras llegaba. */
function traerHilo(docId: number) {
  if (traidos.has(docId)) return;
  traidos.add(docId);
  void leerHiloDeTab(claveDeLanding(docId)).then((filas) => {
    if (!filas) { traidos.delete(docId); return; }
    const guardados = mensajesDeFilas(filas).map((m): Mensaje => ({ ...m, id: ++ultimoId }));
    if (guardados.length) cambiarHilo(docId, (h) => ({ ...h, mensajes: [...guardados, ...h.mensajes] }));
  });
}

const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };
function useHilo(docId: number): Hilo {
  return useSyncExternalStore(suscribir, () => hilos.get(docId) ?? HILO_VACIO, () => HILO_VACIO);
}

/** El título de una sección del documento VIVO (sin `getJSON`, que en cada render pesa). */
export function tituloVivo(editor: Editor | null, id: string | null): string | null {
  if (!editor || editor.isDestroyed || !id) return null;
  let titulo: string | null = null;
  editor.state.doc.forEach((n) => {
    if (titulo !== null || n.attrs?.id !== id) return;
    let h = '';
    n.forEach((b) => { if (!h && b.type.name === 'heading') h = b.textContent; });
    titulo = (h || n.textContent).trim().slice(0, 60) || 'Sin título';
  });
  return titulo;
}

/**
 * Manda una instrucción al agente. Corre afuera del componente: su respuesta cae en el store.
 *
 * Primero QUÉ se pide (`pedirPedidos`, mientras el hilo dice «Pensando» como siempre): lo de esta landing va a
 * «editar» con su texto; lo demás, como burbujas debajo de la respuesta («se contesta lo actual y se propone lo
 * otro»). Sin nada de esta landing, no se llama a «editar». `interpretar: false` = un pedido NUESTRO (una
 * sugerencia), que es de edición por definición y no gasta la vuelta.
 *
 * `adjuntos`: los archivos de la caja, ya leídos. Viajan a «editar» como contexto (lib/editor-landing/adjuntos.ts). Sin
 * nada escrito, la instrucción es la nuestra (`instruccionConAdjuntos`) y no se interpreta.
 */
async function pedirEdicion(ctx: CtxEditorLanding, instruccion: string, alcance: 'landing' | 'seccion', op: { interpretar?: boolean; adjuntos?: readonly AdjuntoEditar[] } = {}): Promise<void> {
  const docId = ctx.docId;
  const editor = ctx.editor;
  const adjuntos = op.adjuntos ?? [];
  const escrito = instruccion.trim();
  const texto = instruccionConAdjuntos(escrito, adjuntos.length);
  if (!texto || !editor || editor.isDestroyed || (hilos.get(docId)?.corriendo)) return;
  // Lo que se manda se toma AHORA, con la página de ahora: la propuesta es de su página (cabecera).
  const todas = tarjetasDelDoc(editor.getJSON());
  const activa = alcance === 'seccion' ? todas.find((t) => idDe(t) === ctx.tarjetaActiva) ?? null : null;
  const enviadas = activa ? [activa] : todas;
  const yo: Mensaje = {
    id: ++ultimoId, de: 'yo', texto: escrito, seccion: activa ? tituloVivo(editor, idDe(activa)) : null,
    ...(adjuntos.length ? { adjuntos: adjuntos.map((a) => a.nombre) } : {}),
  };
  cambiarHilo(docId, (h) => ({ corriendo: true, mensajes: [...h.mensajes, yo] }));
  const corte = new AbortController();
  cortes.set(docId, corte);
  const titulo = ctx.titulo;
  const terminar = (...msgs: Mensaje[]) => {
    cortes.delete(docId);
    cambiarHilo(docId, (h) => ({ corriendo: false, mensajes: [...h.mensajes, ...msgs] }));
    // El turno entero a la base (../hilo-agente.ts): lo pedido y lo que contestó MaKo, sin las burbujas de pedidos.
    void guardarEnHiloDeTab(claveDeLanding(docId), tituloDeLanding(titulo), filasDeAgente([yo, ...msgs]));
  };

  let paraEditar: string | null = texto;
  let burbujas: Mensaje[] = [];
  if (op.interpretar !== false && escrito) {
    const { pedido: lemos, conCita } = separarCita(texto);
    const ri = await pedirPedidos(cuerpoPedidos(lemos, docId, ctx.titulo), { ms: PLAZO_PEDIDOS_MS, signal: corte.signal });
    // «Detener» mientras se interpretaba: no se sigue con nada.
    if (!ri.ok && cortadoPorUsuario(ri)) { terminar({ id: ++ultimoId, de: 'mako', texto: ri.error }); return; }
    // Falló o tardó: `interpretacionDe` devuelve lo de siempre (el mensaje entero a «editar»).
    const interp = interpretacionDe(ri, lemos);
    paraEditar = conCita(textoActual(interp));
    burbujas = comoMensajes(burbujasDe(interp, docId));
  }
  if (!paraEditar) { terminar(...burbujas); return; }
  if (!enviadas.length) {
    terminar({ id: ++ultimoId, de: 'mako', texto: `Esta página no tiene ${terminoTarjeta(ctx.config, { plural: true })}.`, error: true }, ...burbujas);
    return;
  }
  // T3: con una presentación, la IA edita diapositivas (ia.ts lee `params.formato` del pedido crudo).
  const conAdjuntos = adjuntos.length ? { adjuntos: [...adjuntos] } : {};
  // TODA LA LANDING lleva la sección con el cursor como PISTA (24/10/2026: sin los chips «Toda la landing / <sección>», la IA
  // decide qué toca y «esta sección» es ésa). Si la página entera no entra de una vez (`MUCHO_PARA_EDITAR`), se vuelve a
  // pedir SÓLO la sección con el cursor, y la respuesta lo dice. Un solo lugar que llama a «editar».
  const enFoco = activa ? null : todas.find((t) => idDe(t) === ctx.tarjetaActiva) ?? null;
  let deUna: JsonNodo | null = activa;
  let r: Awaited<ReturnType<typeof pedirIA>>;
  for (;;) {
    const mandadas = deUna ? [deUna] : enviadas;
    r = await pedirIA({ accion: 'editar', instruccion: paraEditar, tarjetas: mandadas, alcance: deUna ? 'seccion' : 'landing', enFoco: deUna ? null : ctx.tarjetaActiva, ...conAdjuntos, params: { formato: formatoDe(ctx.config) } }, { signal: corte.signal });
    if (!deUna && enFoco && !r.ok && r.error === MUCHO_PARA_EDITAR) { deUna = enFoco; continue; }
    break;
  }
  const soloFoco = !activa && !!deUna;
  const aviso = soloFoco ? 'La landing es muy larga para cambiarla entera de una vez: cambié la sección donde tienes el cursor. ' : '';
  let msg: Mensaje;
  if (!r.ok) {
    msg = { id: ++ultimoId, de: 'mako', texto: r.error === MUCHO_PARA_EDITAR ? MUCHO_SIN_FOCO : r.error, error: !cortadoPorUsuario(r) };
  } else if ('tarjetas' in r) {
    msg = proponeAlgo(r)
      ? { id: ++ultimoId, de: 'mako', texto: aviso + (r.resumen || 'Listo.'), estado: 'pendiente', propuesta: { paginaId: ctx.paginaActual, enviadas: deUna ? [deUna] : enviadas, tarjetas: r.tarjetas, anclaNuevas: deUna ? idDe(deUna) : null, ...listaDeRespuesta(r) } }
      : { id: ++ultimoId, de: 'mako', texto: aviso + (r.resumen || 'Sin cambios.') };
  } else msg = { id: ++ultimoId, de: 'mako', texto: 'Respuesta inválida', error: true };
  terminar(msg, ...burbujas);
}

/** La landing no entra de una vez y no hay una sección con el cursor para pedir sólo ésa. */
const MUCHO_SIN_FOCO = 'La landing es muy larga para cambiarla entera de una vez: toca la sección que quieres cambiar y vuelve a pedírmelo.';

/**
 * «DISCUTIR» (24/10/2026, Martín: «pon los botones de "Discutir, editar"»; el par de Automations): MaKo contesta y sugiere
 * SIN tocar la página. Viaja el texto de la página abierta, la sección con el cursor como pista, los archivos de la caja y
 * lo último de la charla (sin eso, «como te dije» no existe: la lección de Automations). Vuelve una burbuja de texto, sin
 * propuesta, y el turno se guarda en la base como cualquier otro.
 */
async function pedirDiscusion(ctx: CtxEditorLanding, pregunta: string, op: { adjuntos?: readonly AdjuntoEditar[] } = {}): Promise<void> {
  const docId = ctx.docId;
  const editor = ctx.editor;
  const adjuntos = op.adjuntos ?? [];
  const escrito = pregunta.trim();
  if ((!escrito && !adjuntos.length) || !editor || editor.isDestroyed || (hilos.get(docId)?.corriendo)) return;
  const charla = (hilos.get(docId)?.mensajes ?? [])
    .flatMap((m) => ((m.de === 'yo' || m.de === 'mako') && m.texto.trim() ? [{ de: m.de, texto: m.texto }] : []))
    .slice(-8);
  const yo: Mensaje = { id: ++ultimoId, de: 'yo', texto: escrito, seccion: null, ...(adjuntos.length ? { adjuntos: adjuntos.map((a) => a.nombre) } : {}) };
  cambiarHilo(docId, (h) => ({ corriendo: true, mensajes: [...h.mensajes, yo] }));
  const corte = new AbortController();
  cortes.set(docId, corte);
  const titulo = ctx.titulo;
  const r = await pedirIA({
    accion: 'discutir', pregunta: escrito || 'Mira lo que te adjunto: ¿qué cambiarías de la landing con esto?',
    tarjetas: tarjetasDelDoc(editor.getJSON()), enFoco: ctx.tarjetaActiva, charla, ...(adjuntos.length ? { adjuntos: [...adjuntos] } : {}),
  }, { signal: corte.signal });
  const msg: Mensaje = !r.ok
    ? { id: ++ultimoId, de: 'mako', texto: r.error, error: !cortadoPorUsuario(r) }
    : 'respuesta' in r ? { id: ++ultimoId, de: 'mako', texto: r.respuesta } : { id: ++ultimoId, de: 'mako', texto: 'Respuesta inválida', error: true };
  cortes.delete(docId);
  cambiarHilo(docId, (h) => ({ corriendo: false, mensajes: [...h.mensajes, msg] }));
  void guardarEnHiloDeTab(claveDeLanding(docId), tituloDeLanding(titulo), filasDeAgente([yo, msg]));
}

// ─────────────────────────────────────────────────────────────────────────────
// La pantalla
// ─────────────────────────────────────────────────────────────────────────────

/** Las sugerencias del panel (Gamma 5): el rótulo es lo que se ve; `instruccion`, lo que se pide. */
type Sugerencia = { rotulo: string; instruccion?: string; rellenar?: string; enfocar?: boolean };
const SUGERENCIAS: Sugerencia[] = [
  { rotulo: 'Mejorar la escritura', instruccion: 'Mejora la escritura. Conserva lo que dice y la estructura.' },
  { rotulo: 'Acortar', instruccion: 'Acorta el texto a lo esencial, sin perder lo importante.' },
  { rotulo: 'Traducir…', rellenar: 'Traduce al ' },
  { rotulo: 'Hazlo más visual', instruccion: 'Hazlo más visual: usa diseños optimizados, íconos o imágenes donde ayuden. Conserva el texto.' },
  { rotulo: 'Agregar una sección de preguntas frecuentes', instruccion: 'Agrega una sección de preguntas frecuentes, con un desplegable por pregunta. Usa lo que la landing ya dice y no inventes datos.' },
  { rotulo: 'Edita todas las secciones con IA', enfocar: true },
];

/** En «Discutir» las sugerencias son PREGUNTAS (se mandan tal cual, por su rótulo): pensar la página, no cambiarla. */
const SUGERENCIAS_DISCUTIR: Sugerencia[] = [
  { rotulo: '¿Qué mejorarías de esta landing?' },
  { rotulo: '¿Se entiende qué vendo y a quién?' },
  { rotulo: '¿Qué le falta para que más personas agenden o compren?' },
];

/**
 * Las sugerencias según el formato (T3). En una presentación no se ofrecen preguntas frecuentes
 * (los desplegables no van en una diapositiva: REGLAS_DIAPOSITIVAS_*) y se dice «diapositivas».
 */
function sugerenciasDe(config: ConfigLanding): Sugerencia[] {
  if (!esPresentacion(config)) return SUGERENCIAS;
  return SUGERENCIAS
    .filter((s) => !s.rotulo.startsWith('Agregar una sección de preguntas'))
    .map((s) => (s.enfocar ? { ...s, rotulo: `Edita todas las ${terminoTarjeta(config, { plural: true })} con IA` } : s));
}

/**
 * Una burbuja de MaKo para un pedido que no es de la landing abierta: el texto, los botones (el usado queda
 * apagado y marcado) y los links. Los links van por el `Link` de app/_ui/Link (el ?ws= de la pestaña); su
 * texto dice a dónde llevan.
 */
function BurbujaDePedido({ burbuja, onBoton }: { burbuja: BurbujaPedido; onBoton: (boton: string) => void }) {
  const v = vistaDeBurbuja(burbuja);
  return (
    <div className="gma-ag-mako">
      <div className="gma-ag-burbuja" data-de="mako">{v.texto}</div>
      {(v.botones.length > 0 || v.links.length > 0 || v.nota) && (
        <div className="gma-ag-acciones">
          {v.botones.map((b) => (
            <button key={b.id} type="button" className="gma-pb-boton" data-v={b.v} data-t="s" disabled={b.apagado} data-elegido={b.elegido ? '' : undefined} onClick={() => onBoton(b.id)}>
              {b.elegido ? <Ico n="check" t={13} /> : b.icono && <Ico n={b.icono} t={14} />}{b.texto}
            </button>
          ))}
          {v.links.map((l) => (
            <Link key={l.href} href={l.href} className="gma-pb-boton gma-ag-link" data-v="contorno" data-t="s">{l.texto}</Link>
          ))}
          {v.nota && (
            <span className="gma-ag-nota" data-error={v.error ? '' : undefined} role={v.error ? 'alert' : undefined}>
              {v.ocupado && <span className="gma-pb-giro" aria-hidden />}{v.nota}
              <ReportarASoporte />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

let ultimoAdjunto = 0;

/** El hilo y la caja únicos del Ops Center, sin cargar su CSS en el import de este módulo (ver la cabecera). */
const HiloAgente = dynamic(() => import('./ChatAgente').then((m) => m.HiloAgente));
const CajaAgente = dynamic(() => import('./ChatAgente').then((m) => m.CajaAgente));
const PanelAgenteChat = dynamic(() => import('./ChatAgente').then((m) => m.PanelAgenteChat));
const CitaAgente = dynamic(() => import('./ChatAgente').then((m) => m.CitaAgente));
const AperturaAgente = dynamic(() => import('./ChatAgente').then((m) => m.AperturaAgente));

/** Un archivo del pedido, en el hilo (no se abre desde ahí: viajó su texto, no se guardó). */
const archivoDe = (nombre: string) => ({ nombre, tipo: /\.(png|jpe?g|webp|gif|avif)$/i.test(nombre) ? 'image' as const : 'document' as const, sinAbrir: true });

/**
 * El «Lo que vendes» del negocio (GET /api/landing-generator/importar), pedido UNA vez por negocio en la pestaña: el
 * panel se colapsa y se vuelve a montar, y el documento no cambia mientras se edita. Por `ws`: el super admin cambia de
 * negocio sin recargar y no tiene que ver el chip del otro. Si no vino, se vuelve a pedir la próxima.
 */
const loQueVendes = new Map<number | null, Promise<DocDelArchivero | null>>();
function traerLoQueVendes(ws: number | null): Promise<DocDelArchivero | null> {
  let p = loQueVendes.get(ws);
  if (!p) {
    p = pedirLoQueVendes().then((d) => { if (!d) loQueVendes.delete(ws); return d; });
    loQueVendes.set(ws, p);
  }
  return p;
}

/**
 * Cuántos textos «[a completar]» quedan en la página abierta (lib/editor-landing/especificacion.ts): mientras haya alguno, MaKo
 * no pregunta si está lista para que la vean (lib/aperturas/web.ts, 10/11/2026). Se mide al abrir y al cambiar el documento,
 * con una pausa corta, y sólo mientras la apertura puede hablar (`activo`: la charla vacía). null = todavía sin medir.
 */
function useACompletar(editor: Editor | null, activo: boolean): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!editor || !activo) return;
    let reloj: ReturnType<typeof setTimeout> | null = null;
    const medir = () => {
      if (editor.isDestroyed) return;
      const d = editor.state.doc;
      setN(rangosACompletar(d.textBetween(0, d.content.size, '\n', '\n')).length);
    };
    const programar = (ms: number) => { if (reloj) clearTimeout(reloj); reloj = setTimeout(medir, ms); };
    const alCambiar = () => programar(400);
    programar(0);
    editor.on('update', alCambiar);
    return () => { if (reloj) clearTimeout(reloj); editor.off('update', alCambiar); };
  }, [editor, activo]);
  return n;
}

/** El chat de la tarjeta de la izquierda. No se cierra ni se pliega (24/10/2026, Martín: «La sidebar del chat de MaKo NO se
 *  debe poder cerrar nunca. Elimina el boton de plegar»): su «←» lleva a la lista de landings, en la misma tarjeta. */
export function PanelAgente() {
  const ctx = useEditorLanding();
  const ctxRef = useRef(ctx);
  useLayoutEffect(() => { ctxRef.current = ctx; });
  const ctxVivo = useCallback(() => ctxRef.current, []);
  const { docId, titulo, editor, setPanelIzq, avisar, setPanelDer } = ctx;
  const router = useRouter();
  const ws = useWs();
  const hilo = useHilo(docId);
  // MAKO TOMA LA INICIATIVA (5/11/2026, docs/mako-iniciativa/plan.md T13): con la página sin publicar y la charla vacía pregunta
  // «¿Ya está lista para que la vean?»; «Sí, ya está» abre «Publicar» (el diálogo mira la dirección, el tope del plan y el cobro).
  // La pieza vive en ./ChatAgente.tsx (`AperturaAgente`, con `next/dynamic`: trae el CSS del hilo); acá sólo se sabe si habla,
  // para esconder el saludo y las sugerencias mientras tanto: un paso por pantalla.
  const [aperturaHabla, setAperturaHabla] = useState(false);
  // Dos hechos más de la apertura (lib/aperturas/web.ts, 10/11/2026): los textos «[…]» que quedan, y si la página estuvo
  // publicada en esta visita (recién anulada la publicación, no se vuelve a preguntar si está lista). Sin medir todavía, cuenta
  // como si quedara uno: no pregunta antes de saberlo (si no, asomaba un instante al abrir).
  const aCompletar = useACompletar(editor, hilo.mensajes.length === 0);
  const pagina = docId != null ? String(docId) : null;
  const [vistaPublicada, setVistaPublicada] = useState<string | null>(null);
  if (ctx.urlPublica != null && pagina != null && vistaPublicada !== pagina) setVistaPublicada(pagina);
  const publicada = ctx.urlPublica != null || (pagina != null && vistaPublicada === pagina);
  // Recién recargada (u otra computadora): la charla guardada de esta landing.
  useEffect(() => { traerHilo(docId); }, [docId]);
  const [texto, setTexto] = useState('');
  // Sin la app de escritorio no se escribe (25/10/2026, Martín: «En ningun chat, no solo en Ops Center»): app/_chat/useAppDeEscritorio.tsx.
  const appEscritorio = useAppDeEscritorio();
  // «Discutir» o «Editar», recordado (el mismo de Automations: app/_chat/SelectorIntencion.tsx). Reemplaza a los chips
  // «Toda la landing / <la sección>» (24/10/2026, Martín: «Tampoco pongas los botones de "toda la landing, sin titulo"»):
  // «Editar» manda la landing entera con la sección del cursor como pista (`pedirEdicion`).
  const [intencion, elegirIntencion] = useIntencion();
  // «Responder» desde el clic derecho de un mensaje (24/10/2026, P5): la cita queda arriba de la caja y sale con lo escrito
  // (`armarConCita`, la del Ops Center): MaKo sabe a qué le contestan, y la burbuja la muestra.
  const [cita, setCita] = useState<Cita | null>(null);
  const citar = useCallback((m: MensajeWA) => {
    setCita({ de: m.de, texto: m.texto, id: m.id });
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);
  const sugerencias = intencion === 'discutir' ? SUGERENCIAS_DISCUTIR : sugerenciasDe(ctx.config);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hiloRef = useRef<HTMLDivElement>(null);

  // ── Los archivos de la caja (../adjuntos-agente.ts) ───────────────────────
  // `caja` es la verdad (se lee sincrónico al sumar y al mandar); el estado, lo que se dibuja. Es UN objeto que no
  // cambia de identidad: la limpieza al desmontar ve lo último sin leer un `ref.current` viejo.
  const caja = useRef({ items: [] as AdjuntoAgente[], lecturas: new Map<string, AbortController>() });
  const [adjuntos, setAdjuntos] = useState<AdjuntoAgente[]>([]);
  const poner = useCallback((f: (xs: AdjuntoAgente[]) => AdjuntoAgente[]) => {
    caja.current.items = f(caja.current.items);
    setAdjuntos(caja.current.items);
  }, []);
  const [doc, setDoc] = useState<DocDelArchivero | null>(null);
  const [trayendo, setTrayendo] = useState(false);
  useEffect(() => {
    let vivo = true;
    void traerLoQueVendes(ws).then((d) => { if (vivo) setDoc(d); });
    return () => { vivo = false; };
  }, [ws]);
  useEffect(() => {
    const c = caja.current;
    return () => {
      for (const l of c.lecturas.values()) l.abort();
      for (const x of c.items) URL.revokeObjectURL(x.url);
    };
  }, []);

  // (Acá estaba el alcance de los chips: lo elegido para una sección, o la sección tocada con la IA prendida. Desde el
  // 24/10/2026 «Editar» manda siempre la landing entera, con la sección del cursor como pista: `pedirEdicion`.)

  // El chat baja solo con cada mensaje nuevo.
  useEffect(() => {
    const el = hiloRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hilo.mensajes.length, hilo.corriendo]);

  const enviar = (instruccion: string, op: { interpretar?: boolean } = {}) => {
    if (hilo.corriendo || !instruccion.trim() || appEscritorio.bloqueada) return;
    void pedirEdicion(ctxRef.current, instruccion, 'landing', op);
    setTexto('');
  };

  // La nota de voz sale en el acto (28/10/2026): se dibuja ya, se pasa a texto por detrás (app/_chat/useNotaEnElActo.ts) y sale
  // con la intención elegida, como lo escrito. Lo que la persona esté escribiendo mientras tanto (y sus archivos) queda en la caja.
  const nota = useNotaEnElActo({
    clave: `agente:${docId}`, puede: !hilo.corriendo && !!editor && !appEscritorio.bloqueada,
    mandar: (t) => { if (intencion === 'discutir') void pedirDiscusion(ctxRef.current, t); else void pedirEdicion(ctxRef.current, t, 'landing'); },
  });

  /** Entran archivos (el «+», soltados o pegados): cada uno se LEE ya, para que al mandar esté su texto. */
  const sumar = (fs: File[]) => {
    const { tomar, aviso } = queSumar(caja.current.items, fs);
    if (aviso) avisar(aviso);
    if (!tomar.length) return;
    const nuevos = tomar.map((file): AdjuntoAgente => ({ id: `a${++ultimoAdjunto}`, file, tipo: tipoDeAdjunto(file), url: URL.createObjectURL(file), estado: 'leyendo' }));
    poner((xs) => [...xs, ...nuevos]);
    for (const n of nuevos) {
      const ac = new AbortController();
      caja.current.lecturas.set(n.id, ac);
      void leerArchivo(n.file, ac.signal).then((r) => {
        if (ac.signal.aborted) return;
        caja.current.lecturas.delete(n.id);
        poner((xs) => conLectura(xs, n.id, r));
      });
    }
  };
  /** Después de mandar: la caja queda vacía (lo que viajó ya está en la burbuja). */
  const soltarTodos = () => {
    for (const l of caja.current.lecturas.values()) l.abort();
    caja.current.lecturas.clear();
    for (const x of caja.current.items) URL.revokeObjectURL(x.url);
    poner(() => []);
  };
  const quitar = (id: string) => {
    caja.current.lecturas.get(id)?.abort();
    caja.current.lecturas.delete(id);
    const x = caja.current.items.find((a) => a.id === id);
    if (x) URL.revokeObjectURL(x.url);
    poner((xs) => xs.filter((a) => a.id !== id));
  };
  const adj: AdjuntosDeCaja = {
    items: adjuntos, puede: !hilo.corriendo && !!editor, onSumar: sumar, onQuitar: quitar,
    onNoPuede: () => avisar('Espera a que la IA termine'),
  };
  const avisoAdj = avisoDeAdjuntos(adjuntos);

  /** El chip de «Lo que vendes»: baja el PDF de El Archivero y entra como cualquier otro archivo. */
  const traerDoc = async () => {
    if (!doc || trayendo) return;
    setTrayendo(true);
    const f = await bajarDelArchivero(doc);
    setTrayendo(false);
    if (!f) { avisar('No pude traer «Lo que vendes»'); return; }
    sumar([f]);
  };

  /** El ↑ (o Enter) de la caja: lo escrito y los archivos leídos. Lo que se ve en la caja es lo que viaja. */
  const mandar = () => {
    const items = caja.current.items;
    if (hilo.corriendo || !editor || !puedeMandar(texto, items) || appEscritorio.bloqueada) return;
    const conCita = armarConCita(cita, texto);
    if (intencion === 'discutir') void pedirDiscusion(ctxRef.current, conCita, { adjuntos: paraEnviar(items) });
    else void pedirEdicion(ctxRef.current, conCita, 'landing', { adjuntos: paraEnviar(items) });
    setTexto('');
    setCita(null);
    soltarTodos();
  };

  const sugerir = (s: Sugerencia) => {
    // En «Discutir», una sugerencia es una PREGUNTA nuestra: se manda tal cual, sin tocar la página.
    if (intencion === 'discutir') { if (!hilo.corriendo && !appEscritorio.bloqueada) void pedirDiscusion(ctxRef.current, s.rotulo); return; }
    // Una sugerencia es una edición escrita por nosotros: va directo a «editar», sin interpretarla.
    if (s.instruccion) { enviar(s.instruccion, { interpretar: false }); return; }
    if (s.rellenar) setTexto(s.rellenar);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const aceptar = async (m: Extract<Mensaje, { de: 'mako' }>, sinVersion = false) => {
    if (!m.propuesta) return;
    cambiarMensaje(docId, m.id, { estado: 'aplicando', aviso: undefined });
    const r = await aceptarPropuesta(ctxVivo, m.propuesta, { sinVersion });
    if (!r.ok) { cambiarMensaje(docId, m.id, { estado: r.sinVersion ? 'sin-version' : 'pendiente', aviso: r.error }); return; }
    cambiarMensaje(docId, m.id, { estado: 'aplicada', aplicada: r.aplicada });
    avisar('Cambio aplicado');
  };

  const restaurar = (m: Extract<Mensaje, { de: 'mako' }>) => {
    if (!m.aplicada) return;
    if (deshacerPropuesta(ctxRef.current.editor, m.aplicada)) {
      cambiarMensaje(docId, m.id, { estado: 'restaurada' });
      avisar('Cambio deshecho');
      return;
    }
    // Se editó después: la vuelta es la versión «Antes de un cambio de IA».
    setPanelDer('historial');
    avisar('Restáuralo del historial');
  };

  const detener = () => cortes.get(docId)?.abort();

  // El hilo del Ops Center: lo de la persona con su sección («desde …») y sus archivos; lo de MaKo, con lo suyo en el hueco.
  const items = useMemo((): ItemHilo[] => hilo.mensajes.map((m): ItemHilo => (m.de === 'yo'
    ? { k: 'msg', id: String(m.id), role: 'user', texto: m.texto, at: null, ...(m.seccion ? { desde: m.seccion } : {}), ...(m.adjuntos?.length ? { archivos: m.adjuntos.map(archivoDe) } : {}) }
    : { k: 'msg', id: String(m.id), role: 'assistant', texto: m.de === 'mako' && !m.error ? m.texto : '', at: null })), [hilo.mensajes]);
  const enMensaje = (x: Extract<ItemHilo, { k: 'msg' }>): EnMensaje | null => {
    const m = hilo.mensajes.find((y) => String(y.id) === x.id);
    if (!m || m.de === 'yo') return null;
    if (m.de === 'pedido') return { arriba: <BurbujaDePedido burbuja={m.burbuja} onBoton={(b) => alBoton(m.id, b)} /> };
    return {
      arriba: m.error ? <div className="gma-ag-burbuja" data-de="mako" data-error="">{m.texto}</div> : null,
      abajo: m.propuesta && m.estado ? (
        <RevisionPropuesta
          propuesta={m.propuesta}
          estado={m.estado}
          aviso={m.aviso}
          onAceptar={() => void aceptar(m)}
          onAplicarIgual={() => void aceptar(m, true)}
          onDescartar={() => cambiarMensaje(docId, m.id, { estado: 'descartada', aviso: undefined })}
          onRestaurar={() => restaurar(m)}
        />
      ) : null,
    };
  };

  // ── Los botones de las burbujas de pedidos (../pedidos-chat.ts) ──────────

  // De vuelta en esta landing: una creación que quedó «Abriendo…» ya se abrió (el hilo sobrevive a navegar).
  useEffect(() => {
    if ((hilos.get(docId)?.mensajes ?? []).some((m) => m.de === 'pedido' && alVolver(m.burbuja) !== m.burbuja)) {
      cambiarHilo(docId, (h) => ({ ...h, mensajes: h.mensajes.map((m) => (m.de === 'pedido' ? { ...m, burbuja: alVolver(m.burbuja) } : m)) }));
    }
  }, [docId]);

  /**
   * «Sí» / «Crear ahora»: la creación del Panel con el pedido escrito. Lo del editor se guarda primero (como al
   * salir por ⌂), el pedido va a sessionStorage para `tomarCaja` y se navega a Crear con IA, que lo muestra arriba
   * mientras escribe el plan: se ve por qué se cambió de pantalla. Mientras tanto la burbuja dice «Abriendo…».
   */
  const abrirCreacion = async (id: number, pedido: string) => {
    await ctxRef.current.guardarAhora();
    try {
      window.sessionStorage.setItem(CLAVE_CAJA, cajaParaCrear(pedido, Date.now()));
    } catch {
      // Sin sessionStorage el Panel abriría la caja VACÍA: un botón que parece roto. Se queda acá y lo dice.
      cambiarBurbuja(docId, id, trasNoAbrir);
      return;
    }
    router.push(RUTA_CREAR);
  };

  // El cambio de la landing abierta terminó (aceptado o descartado): la creación que esperaba su «Sí» se abre. Una
  // sola: abrir navega.
  useEffect(() => {
    if (hilo.mensajes.some((m) => m.de === 'mako' && sinTerminar(m.estado))) return;
    for (const m of hilo.mensajes) {
      if (m.de !== 'pedido') continue;
      const r = alTerminar(m.burbuja);
      if (r.efecto?.tipo !== 'crear') continue;
      cambiarBurbuja(docId, m.id, () => r.burbuja);
      void abrirCreacion(m.id, r.efecto.pedido);
      return;
    }
  }, [hilo.mensajes, docId]);

  /** «Deshacer» del aviso: la MISMA landing vuelve de la Papelera (como en el Panel). */
  const sacarDePapelera = async (id: number, landing: number) => {
    const r = await pedirDocs({ accion: 'restaurar', id: landing });
    if (!r.ok) { avisar('No se pudo restaurar'); console.error('[agente] restaurar', r.error); return; }
    cambiarBurbuja(docId, id, (b) => trasRestaurar(b, true));
  };

  /**
   * «Sí, a la Papelera»: la MISMA acción que «Archivar» en el ⋯ del Panel (Inicio.tsx). Se restaura; nunca borra
   * para siempre. Y nunca la landing abierta: la burbuja no la ofrece y acá se vuelve a mirar.
   */
  const mandarAPapelera = async (id: number, landing: number) => {
    if (landing === ctxRef.current.docId) { cambiarBurbuja(docId, id, (b) => trasPapelera(b, false)); return; }
    const r = await pedirDocs({ accion: 'papelera', id: landing });
    if (!r.ok) { cambiarBurbuja(docId, id, (b) => trasPapelera(b, false)); console.error('[agente] papelera', r.error); return; }
    cambiarBurbuja(docId, id, (b) => trasPapelera(b, true));
    avisar('Archivada', () => void sacarDePapelera(id, landing));
  };

  const alBoton = (id: number, boton: string) => {
    const efecto = pulsarEnHilo(docId, id, boton);
    if (efecto?.tipo === 'crear') void abrirCreacion(id, efecto.pedido);
    else if (efecto?.tipo === 'papelera') void mandarAPapelera(id, efecto.id);
  };

  return (
    // Un <section> y no un <aside>: con la barra de la agencia, `[data-barra-agencia] aside` (app/globals.css) le fuerza a todo <aside> el alto de la ventana, y la caja quedaba fuera de la vista (medido el 22/10/2026).
    <section
      role="complementary"
      className="gma gma-pb gma-ag"
      aria-label="Edición con IA"
    >
      <EstilosPanelesB />
      <style href="gma-agente" precedence="medium">{CSS_AGENTE}</style>
      {/* EL PANEL ÚNICO (./ChatAgente.tsx → PanelDeChat, 23/10/2026): la cabecera con la estrella de MaKo, la «←» a la lista
          antes y el cerrar al final; el arrastrar y soltar es del panel (lo adjuntado de la caja).
          ⚠️ La cabecera dice «MaKo», no el título de la landing (24/10/2026, Martín: «2 veces el titulo, no tiene sentido»):
          el título vive en la barra. Y la «←» va a la LISTA de la misma tarjeta sin navegar («que no me redirija, que solo
          se vaya para atras la sidebar del chat, tal cual como en Automations»): era una casa que llevaba al Panel. */}
      <PanelAgenteChat hilo={hiloRef} adjuntos={adj}
        cabecera={{
          clave: `agente:${docId}`, titulo: 'MaKo', criatura: 'MaKo', aspecto: ASPECTO_MAKO, animo: hilo.corriendo ? 'trabajando' : 'despierto',
          antes: <button type="button" className="gma-pb-iconbtn gma-ag-volver" onClick={() => setPanelIzq('landings')} title="Ver tus landings" aria-label="Ver tus landings">←</button>,
          // Sin «Cerrar el panel» (el «⇤» de plegar): el chat no se cierra nunca.
          acciones: <span className="gma-ag-estado">{hilo.corriendo ? 'escribiendo…' : 'en línea'}</span>,
        }}
        caja={<div className="gma-ag-pie">
        {/* «Discutir | Editar», el de Automations (24/10/2026, Martín: «Tampoco pongas los botones de "toda la landing, sin
            titulo" pon los botones de "Discutir, editar"»). «Sin título» era el chip de la sección con el cursor. */}
        <SelectorIntencion valor={intencion} onCambio={elegirIntencion} deshabilitado={hilo.corriendo} />
        {doc && ofreceDoc(doc, adjuntos) && (
          <div className="gma-ag-docs">
            <button type="button" className="gma-ag-chip gma-ag-chip-doc" onClick={() => void traerDoc()} disabled={trayendo || !adj.puede} title={`Adjuntar ${doc.nombre}`}>
              {trayendo ? <span className="gma-pb-giro" aria-hidden /> : <Ico n="mas" t={12} />} Lo que vendes (PDF)
            </button>
          </div>
        )}
        {/* La caja única (./ChatAgente.tsx): el «+», las miniaturas, pegar, los emojis y el micrófono que dicta.
            El placeholder entra en UN renglón (24/10/2026, Martín: «mira como se bugea el placeholder del chat con un salto de
            linea»: «Envía un mensaje al / agente…» no cabía al lado del «+», los emojis y el micrófono). Es el del Ops Center,
            «Escribe a <quién>». */}
        {/* Lo que MaKo recomienda sobre las páginas con sus visitas y lo que dice la gente (26/10/2026): el bloque, plegado. */}
        <RecomendacionesDeMako superficie="landing" alPedir={setTexto} />
        <CajaAgente campo={inputRef} texto={texto} onTexto={setTexto} onMandar={mandar} adjuntos={adj} ocupado={hilo.corriendo || nota.pendientes}
          apagado={!editor} placeholder="Escribe a MaKo" tituloMandar="Enviar" enterManda bloqueo={appEscritorio.bloqueo} onGrabada={nota.onGrabada}
          arriba={cita ? <CitaAgente cita={cita} onQuitar={() => setCita(null)} /> : null} />
        {avisoAdj && <p className="gma-ag-aviso-adj" data-error={avisoAdj.error ? '' : undefined} role={avisoAdj.error ? 'alert' : 'status'}>{avisoAdj.texto}<ReportarASoporte /></p>}
        </div>}>
          {hilo.mensajes.length === 0 && (
            <AperturaAgente hechos={{ pagina, publicada, charlaVacia: true, aCompletar: aCompletar ?? 1 }} libre={!hilo.corriendo}
              onPublicar={() => ctx.setDialogo('publicar')} onHabla={setAperturaHabla} />
          )}
          {hilo.mensajes.length === 0 && !aperturaHabla && (
            <>
              {/* Sin la burbuja que explicaba cómo usar el chat (12/11/2026, Martín: «un texto que es innecesario»): los botones. */}
              <div className="gma-ag-pildoras">
                {sugerencias.map((s) => (
                  <button key={s.rotulo} type="button" className="gma-ag-pildora" onClick={() => sugerir(s)} disabled={hilo.corriendo || !editor}>{s.rotulo}</button>
                ))}
              </div>
            </>
          )}
          <HiloAgente items={nota.conNotas(items)} corriendo={hilo.corriendo} enMensaje={enMensaje} onCitar={citar}
            onReintentar={nota.reintentar(() => {})} onDescartar={nota.descartar} />
          {hilo.corriendo && <button type="button" className="gma-pb-boton" data-v="fantasma" data-t="s" onClick={detener}>Detener generación</button>}
          {hilo.mensajes.length > 0 && !hilo.corriendo && (
            <div className="gma-ag-pildoras">
              {sugerencias.slice(0, 4).map((s) => (
                <button key={s.rotulo} type="button" className="gma-ag-pildora" onClick={() => sugerir(s)} disabled={!editor}>{s.rotulo}</button>
              ))}
            </div>
          )}
      </PanelAgenteChat>
    </section>
  );
}

export default PanelAgente;

// Medidas del video de Gamma 5 (gamma-ui §5.1, aproximadas): panel ~330 px, burbujas de radio ~14
// y padding ~14, texto 13-14 px, input en tarjeta de borde suave con el enviar redondo abajo a la
// derecha.
// Sin la app de escritorio (app/_chat/useAppDeEscritorio.tsx) la caja lleva «Instala MaKo para escribir» en el campo y el botón
// «Instalar MaKo» donde va el micrófono. En este panel de ~330 px no entraban en un renglón: se leía «Instala MaKo para» (prueba
// en producción del 10/11/2026; a 375 px, «Instala /»). El texto sigue en UN renglón (24/10/2026, Martín: «mira como se bugea el
// placeholder del chat con un salto de linea»): lo que baja es el botón, a su propio renglón, a la derecha.
const CSS_AGENTE = `
.gma-ag{display:flex;flex-direction:column;width:336px;max-width:100%;height:100%;min-height:0;background:var(--pb-fondo);border-right:1px solid var(--pb-borde)}
.gma-ag{--surface:var(--pb-fondo);--surface-2:var(--pb-sup);--border:var(--pb-borde);--border-strong:var(--pb-borde);--ink:var(--pb-texto);--dim:var(--pb-tenue);--faint:var(--pb-suave);--velo-hover:var(--pb-sup);--focus-ring:0 0 0 2px var(--pb-vivo)}
.gma-ag-cab{display:flex;align-items:center;gap:8px;height:48px;flex:none;padding:0 8px 0 12px}
.gma-ag-casa{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex:none;border-radius:50%;box-shadow:inset 0 0 0 1px var(--pb-borde);color:var(--pb-tenue);text-decoration:none}
.gma-ag-casa:hover{color:var(--pb-texto);background:var(--pb-sup)}
.gma-ag-titulo{flex:1;min-width:0;font-size:13px;font-weight:500;color:var(--pb-texto);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gma-ag > .co-panel{flex:1;min-height:0;background:transparent}
.gma-ag .co-cab{min-height:48px;padding:0 8px 0 12px;gap:8px}
.gma-ag .co-hilo{padding:8px 12px 12px}
.gma-ag .co-caja-wrap{padding:0}
.gma-ag .co-hilo__col{gap:10px}
.gma-ag{--primary:var(--pb-azul);--primary-weak:var(--pb-vivo);--on-primary:var(--pb-azul-txt);--bg:var(--pb-fondo)}
.gma-ag-mako{display:grid;gap:8px}
.gma-ag-burbuja{max-width:100%;padding:10px 14px;border-radius:14px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
.gma-ag-burbuja[data-de="mako"]{align-self:flex-start;background:var(--pb-sup);color:var(--pb-texto)}
.gma-ag-burbuja[data-de="mako"][data-error]{background:var(--pb-mal-bg);color:var(--pb-mal)}
.gma-ag-burbuja[data-de="yo"]{align-self:flex-end;max-width:88%;background:var(--pb-celeste);color:var(--pb-tinta)}
.gma-ag-pensando{display:inline-flex;align-items:center;gap:8px;color:var(--pb-tenue)}
.gma-ag-chip-msg{display:flex;align-items:center;gap:4px;margin-bottom:4px;font-size:11.5px;font-weight:600;opacity:.8}
.gma-ag-pildoras{display:flex;flex-wrap:wrap;gap:6px}
.gma-ag-pildora{padding:6px 12px;border:0;border-radius:999px;background:var(--pb-celeste);color:var(--pb-tinta);font:inherit;font-size:12.5px;font-weight:500;text-align:left;cursor:pointer;transition:background .15s ease}
.gma-ag-pildora:hover:not(:disabled){background:var(--pb-celeste2)}
.gma-ag-pildora:disabled{opacity:.5;cursor:default}
.gma-ag-pie{display:grid;gap:8px;padding:8px 12px 12px}
.gma-ag-chip{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:100%;height:26px;padding:0 10px;border:1px solid var(--pb-borde);border-radius:999px;background:var(--pb-fondo);color:var(--pb-tenue);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.gma-ag-chip[aria-pressed="true"]{border-color:var(--pb-celeste2);background:var(--pb-celeste);color:var(--pb-tinta)}
.gma-ag-caja{display:grid;gap:4px;padding:10px 10px 8px 12px;border-radius:14px;background:var(--pb-fondo);box-shadow:0 0 0 1px var(--pb-borde),0 1px 2px rgba(0,0,0,.05);transition:box-shadow .15s ease}
.gma-ag-caja:focus-within{box-shadow:0 0 0 1.5px var(--pb-vivo)}
.gma-ag-caja[data-ocupada]{background:var(--pb-sup)}
.gma-ag-input{width:100%;min-height:40px;max-height:160px;resize:none;border:0;outline:none;background:transparent;color:var(--pb-texto);font:inherit;font-size:13.5px;line-height:1.45;padding:0}
.gma-ag-input::placeholder{color:var(--pb-suave)}
.gma-ag .co-caja textarea::placeholder{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gma-ag .co-caja__fila:has(.co-instalar){flex-wrap:wrap;row-gap:6px}
.gma-ag .co-caja__fila:has(.co-instalar)>.co-caja__campo{flex-basis:calc(100% - 48px)}
.gma-ag .co-caja__fila:has(.co-instalar)>:is(.co-instalar,:has(.co-instalar)){margin-left:auto}
.gma-ag-caja-pie{display:flex;align-items:flex-end;justify-content:space-between;gap:8px}
.gma-ag-caja-pie .ch-adjuntar{width:30px;height:30px}
.gma-ag-caja>.co-miniaturas{margin:0 0 4px}
.gma-ag .co-miniatura[data-estado="leyendo"] .co-miniatura__ver{opacity:.55}
.gma-ag .co-miniatura[data-estado="leyendo"]::after{content:"";position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:2px solid var(--pb-azul);border-right-color:transparent;animation:gmaPbGiro .7s linear infinite;pointer-events:none}
.gma-ag .co-miniatura[data-estado="error"] .co-miniatura__ver{box-shadow:0 0 0 1.5px var(--pb-mal);border-color:var(--pb-mal)}
.gma-ag-docs{display:flex;flex-wrap:wrap;gap:6px}
.gma-ag-chip-doc{border-style:dashed}
.gma-ag-chip-doc:hover:not(:disabled){border-color:var(--pb-celeste2);background:var(--pb-celeste);color:var(--pb-tinta)}
.gma-ag-chip-doc:disabled{opacity:.6;cursor:default}
.gma-ag-aviso-adj{margin:0;font-size:12px;color:var(--pb-tenue)}
.gma-ag-aviso-adj[data-error]{color:var(--pb-mal)}
.gma-ag-enviar{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:0;border-radius:50%;background:var(--pb-borde);color:var(--pb-fondo);cursor:pointer;transition:background .15s ease}
.gma-ag-enviar[data-listo],.gma-ag-enviar[data-detener]{background:var(--pb-azul);color:var(--pb-azul-txt)}
.gma-ag-enviar:disabled{cursor:default}
.gma-ag-cuadro{display:block;width:10px;height:10px;border-radius:2px;background:currentColor}
.gma-ag-acciones{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
.gma-ag-acciones>.gma-pb-boton{max-width:100%;overflow:hidden;text-overflow:ellipsis}
.gma-ag-acciones>.gma-pb-boton[data-elegido]:disabled{opacity:1}
.gma-ag-link{text-decoration:none}
.gma-ag-nota{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--pb-tenue)}
.gma-ag-nota[data-error]{color:var(--pb-mal)}
`;
