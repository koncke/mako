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
// Lo que NO se copia: adjuntar archivos al chat (⊕), «Abrir archivos» y los chats guardados
// del agente (Gamma guarda el historial del chat; acá vive en la memoria de la pestaña, como
// pidió el diseño: no hay tabla para eso), y la búsqueda en la web.
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
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import Link from '@/app/_ui/Link';
import { useEditorLanding, type CtxEditorLanding } from '../contexto';
import type { JsonNodo } from '@/lib/editor-landing/doc';
import { cortadoPorUsuario, pedirDocs, pedirIA } from '../../cliente';
import { urlFuentes, type Tema } from '@/lib/editor-landing/temas';
import { htmlDeTarjeta } from '@/lib/editor-landing/render';
import { CSS_CONTENIDO } from '@/lib/editor-landing/css';
import { svgIcono } from '@/lib/editor-landing/iconos';
import {
  MOTIVO_ANTES_DE_IA, anclasResueltas, diffTarjetas, idDe, planDeAplicacion, resumenDeCambios, tarjetasDelDoc, tocadasDesde,
  type CambioSeccion,
} from '../diff-tarjetas';

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
// La hoja del chrome (app/landing-generator/gamma.css) es del armazón; estos paneles traen la
// suya, limitada a `.gma-pb`, y sus tokens SALEN de los de esa hoja (`--gma-superficie`,
// `--gma-borde`, `--gma-primario`…: los valores MEDIDOS de Gamma, titanium y deepocean), con el
// mismo valor de respaldo por si se monta afuera. Toda raíz de estos paneles lleva también la
// clase `gma`: los que se portalean al body (el popover, Presentar) quedan fuera del árbol del
// editor y sin ella no heredarían ni los tokens ni su modo oscuro (que gamma.css redefine bajo
// `[data-tema="oscuro"] .gma`, AGENTS.md «Una pantalla oscura se hace redefiniendo TOKENS»). Lo
// que gamma.css no tiene (el azul más claro de las burbujas, el verde, el ámbar) se define acá.

const CSS_PANELES_B = `
.gma-pb{--pb-fondo:var(--gma-superficie,#ffffff);--pb-sup:var(--gma-superficie-2,#f5f5f6);--pb-sup2:var(--gma-superficie-3,#ececed);--pb-borde:var(--gma-borde,#dfdfe0);--pb-texto:var(--gma-texto-fuerte,#38383c);--pb-tenue:var(--gma-texto,#4d4d51);--pb-suave:var(--gma-tenue,#8b8b90);--pb-titulo:#002253;--pb-azul:var(--gma-primario,#0540ad);--pb-azul-hover:var(--gma-primario-hover,#0740df);--pb-azul-txt:var(--gma-sobre-primario,#ffffff);--pb-vivo:var(--gma-seleccion,#2c88f7);--pb-celeste:var(--gma-b50,#ebf3fe);--pb-celeste2:var(--gma-secundario,#d0e6fe);--pb-tinta:var(--gma-sobre-secundario,#002253);--pb-ok:#266d28;--pb-ok-bg:#e2f7e1;--pb-mal:var(--gma-rojo,#b91c1c);--pb-mal-bg:var(--gma-rojo-fondo,#fef2f2);--pb-ambar:#9b5500;--pb-ambar-bg:#fff3c6;--pb-sombra:var(--gma-sombra-menu,0 8px 16px rgba(0,0,0,.15));font-family:var(--gma-fuente,'Geist',system-ui,sans-serif);color:var(--pb-texto);font-size:14px;line-height:1.45;font-weight:400;-webkit-font-smoothing:antialiased}
[data-tema="oscuro"] .gma-pb{--pb-titulo:#f5f5f6;--pb-celeste:#0b2e79;--pb-tinta:#d0e6fe;--pb-ok:#96e096;--pb-ok-bg:#1a561c;--pb-ambar:#fec500;--pb-ambar-bg:#4a3500;--pb-sombra:0 8px 16px rgba(0,0,0,.45)}
[data-tema="oscuro"] .gma-pb:not(.gma){--pb-fondo:#1d1f22;--pb-sup:#212327;--pb-sup2:#2f3339;--pb-borde:#3d444c;--pb-texto:#dfdfe0;--pb-tenue:#cacacb;--pb-suave:#aeaeb2;--pb-azul:#84c1fa;--pb-azul-hover:#aad5fe;--pb-azul-txt:#002253;--pb-vivo:#63acf7;--pb-celeste2:#3d444c;--pb-mal:#fca5a5;--pb-mal-bg:#450a0a}
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
    try { return htmlDeTarjeta(tarjeta, tema, { modo: 'miniatura', incluirOcultas: true }); } catch { return ''; }
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
};

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
  const plan = planDeAplicacion(actuales, tarjetas, { anclaNuevas: propuesta.anclaNuevas });
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
  const { tema, editor } = useEditorLanding();
  const [vista, setVista] = useState<'original' | 'modificado'>('modificado');
  const plan = useMemo(() => planDeAplicacion(propuesta.enviadas, propuesta.tarjetas, { anclaNuevas: propuesta.anclaNuevas }), [propuesta]);
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
      {tocadas.length > 0 && <p className="gma-rv-aviso">{tocadas.length === 1 ? 'Editaste esa sección mientras tanto.' : `Editaste ${tocadas.length} de esas secciones mientras tanto.`}</p>}
      {aviso && <p className="gma-rv-error" role="alert">{aviso}</p>}
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
// El chat: vive en la memoria de la pestaña, por landing
// ─────────────────────────────────────────────────────────────────────────────
// Un store de módulo y no un estado del componente: el panel se colapsa (⇤) y se desmonta, y
// la respuesta de un pedido largo tiene que caer en el chat aunque el panel no esté abierto
// cuando llega. Se pierde al recargar la pestaña, como pidió el diseño.

type Mensaje =
  | { id: number; de: 'yo'; texto: string; seccion: string | null }
  | { id: number; de: 'mako'; texto: string; error?: boolean; propuesta?: Propuesta; estado?: EstadoPropuesta; aviso?: string; aplicada?: Aplicada };

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

/** Manda una instrucción al agente. Corre afuera del componente: su respuesta cae en el store. */
async function pedirEdicion(ctx: CtxEditorLanding, instruccion: string, alcance: 'landing' | 'seccion'): Promise<void> {
  const docId = ctx.docId;
  const editor = ctx.editor;
  const texto = instruccion.trim();
  if (!texto || !editor || editor.isDestroyed || (hilos.get(docId)?.corriendo)) return;
  const todas = tarjetasDelDoc(editor.getJSON());
  const activa = alcance === 'seccion' ? todas.find((t) => idDe(t) === ctx.tarjetaActiva) ?? null : null;
  const enviadas = activa ? [activa] : todas;
  cambiarHilo(docId, (h) => ({
    corriendo: true,
    mensajes: [...h.mensajes, { id: ++ultimoId, de: 'yo', texto, seccion: activa ? tituloVivo(editor, idDe(activa)) : null }],
  }));
  if (!enviadas.length) {
    cambiarHilo(docId, (h) => ({ corriendo: false, mensajes: [...h.mensajes, { id: ++ultimoId, de: 'mako', texto: 'Esta página no tiene secciones.', error: true }] }));
    return;
  }
  const corte = new AbortController();
  cortes.set(docId, corte);
  const r = await pedirIA({ accion: 'editar', instruccion: texto, tarjetas: enviadas, alcance: activa ? 'seccion' : 'landing' }, { signal: corte.signal });
  cortes.delete(docId);
  let msg: Mensaje;
  if (!r.ok) msg = { id: ++ultimoId, de: 'mako', texto: r.error, error: !cortadoPorUsuario(r) };
  else if ('tarjetas' in r) {
    msg = r.tarjetas.length
      ? { id: ++ultimoId, de: 'mako', texto: r.resumen || 'Listo.', estado: 'pendiente', propuesta: { paginaId: ctx.paginaActual, enviadas, tarjetas: r.tarjetas, anclaNuevas: activa ? idDe(activa) : null } }
      : { id: ++ultimoId, de: 'mako', texto: r.resumen || 'Sin cambios.' };
  } else msg = { id: ++ultimoId, de: 'mako', texto: 'Respuesta inválida', error: true };
  cambiarHilo(docId, (h) => ({ corriendo: false, mensajes: [...h.mensajes, msg] }));
}

// ─────────────────────────────────────────────────────────────────────────────
// La pantalla
// ─────────────────────────────────────────────────────────────────────────────

/** Las sugerencias del panel (Gamma 5): el rótulo es lo que se ve; `instruccion`, lo que se pide. */
const SUGERENCIAS: { rotulo: string; instruccion?: string; alcance?: 'landing'; rellenar?: string; enfocar?: boolean }[] = [
  { rotulo: 'Mejorar la escritura', instruccion: 'Mejora la escritura. Conserva lo que dice y la estructura.' },
  { rotulo: 'Acortar', instruccion: 'Acorta el texto a lo esencial, sin perder lo importante.' },
  { rotulo: 'Traducir…', rellenar: 'Traduce al ' },
  { rotulo: 'Hazlo más visual', instruccion: 'Hazlo más visual: usa diseños optimizados, íconos o imágenes donde ayuden. Conserva el texto.' },
  { rotulo: 'Agregar una sección de preguntas frecuentes', alcance: 'landing', instruccion: 'Agrega una sección de preguntas frecuentes, con un desplegable por pregunta. Usa lo que la landing ya dice y no inventes datos.' },
  { rotulo: 'Edita todas las secciones con IA', alcance: 'landing', enfocar: true },
];

/** `onCerrar`: quien lo monta puede cerrarlo a su manera; si no, el panel se colapsa por el contexto. */
export function PanelAgente({ onCerrar }: { onCerrar?: () => void } = {}) {
  const ctx = useEditorLanding();
  const ctxRef = useRef(ctx);
  useLayoutEffect(() => { ctxRef.current = ctx; });
  const ctxVivo = useCallback(() => ctxRef.current, []);
  const { docId, titulo, editor, tarjetaActiva, modoIA, setPanelIzq, avisar, setPanelDer } = ctx;
  const hilo = useHilo(docId);
  const [texto, setTexto] = useState('');
  // El alcance que eligió la persona, y para qué sección lo eligió.
  const [eleccion, setEleccion] = useState<{ alcance: 'landing' | 'seccion'; tarjeta: string | null } | null>(null);
  const setAlcance = (a: 'landing' | 'seccion') => setEleccion({ alcance: a, tarjeta: tarjetaActiva });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hiloRef = useRef<HTMLDivElement>(null);
  const seccionActiva = tituloVivo(editor, tarjetaActiva);

  // Gamma 5: con «Edición con IA» prendida, tocar una sección la vuelve el chip del chat. Se
  // CALCULA (no se dispara con un efecto): lo elegido vale para la sección en la que se eligió;
  // en otra sección, con la IA prendida, manda la sección.
  const alcance: 'landing' | 'seccion' = eleccion && eleccion.tarjeta === tarjetaActiva
    ? eleccion.alcance
    : modoIA && tarjetaActiva ? 'seccion' : eleccion?.alcance ?? 'landing';
  // Sin sección activa no hay alcance de sección.
  const alcanceReal: 'landing' | 'seccion' = alcance === 'seccion' && seccionActiva ? 'seccion' : 'landing';

  // El chat baja solo con cada mensaje nuevo.
  useEffect(() => {
    const el = hiloRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hilo.mensajes.length, hilo.corriendo]);

  const enviar = (instruccion: string, alc: 'landing' | 'seccion' = alcanceReal) => {
    if (hilo.corriendo || !instruccion.trim()) return;
    void pedirEdicion(ctxRef.current, instruccion, alc);
    setTexto('');
  };

  const sugerir = (s: (typeof SUGERENCIAS)[number]) => {
    if (s.alcance) setAlcance(s.alcance);
    if (s.instruccion) { enviar(s.instruccion, s.alcance ?? alcanceReal); return; }
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

  return (
    <aside className="gma gma-pb gma-ag" aria-label="Edición con IA">
      <EstilosPanelesB />
      <style href="gma-agente" precedence="medium">{CSS_AGENTE}</style>
      <header className="gma-ag-cab">
        <Link href="/landing-generator" className="gma-ag-casa" title="Ir al Panel" aria-label="Ir al Panel"><Ico n="casa" t={13} /></Link>
        <span className="gma-ag-titulo" title={titulo}>{titulo || 'Sin título'}</span>
        <button type="button" className="gma-pb-iconbtn" onClick={() => (onCerrar ? onCerrar() : setPanelIzq(null))} title="Cerrar el panel" aria-label="Cerrar el panel">
          <Ico n="chevron-doble-izquierda" t={16} />
        </button>
      </header>

      <div className="gma-ag-hilo" ref={hiloRef} aria-live="polite">
        {hilo.mensajes.length === 0 && (
          <>
            <div className="gma-ag-burbuja" data-de="mako">Pídeme que edite, cree o diseñe lo que quieras.</div>
            <div className="gma-ag-pildoras">
              {SUGERENCIAS.map((s) => (
                <button key={s.rotulo} type="button" className="gma-ag-pildora" onClick={() => sugerir(s)} disabled={hilo.corriendo || !editor}>{s.rotulo}</button>
              ))}
            </div>
          </>
        )}
        {hilo.mensajes.map((m) => (m.de === 'yo'
          ? (
            <div key={m.id} className="gma-ag-burbuja" data-de="yo">
              {m.seccion && <span className="gma-ag-chip-msg"><Ico n="diseno" t={12} /> {m.seccion}</span>}
              {m.texto}
            </div>
          )
          : (
            <div key={m.id} className="gma-ag-mako">
              <div className="gma-ag-burbuja" data-de="mako" data-error={m.error ? '' : undefined}>{m.texto}</div>
              {m.propuesta && m.estado && (
                <RevisionPropuesta
                  propuesta={m.propuesta}
                  estado={m.estado}
                  aviso={m.aviso}
                  onAceptar={() => void aceptar(m)}
                  onAplicarIgual={() => void aceptar(m, true)}
                  onDescartar={() => cambiarMensaje(docId, m.id, { estado: 'descartada', aviso: undefined })}
                  onRestaurar={() => restaurar(m)}
                />
              )}
            </div>
          )))}
        {hilo.corriendo && <div className="gma-ag-burbuja gma-ag-pensando" data-de="mako"><span className="gma-pb-giro" aria-hidden /> Pensando</div>}
        {hilo.mensajes.length > 0 && !hilo.corriendo && (
          <div className="gma-ag-pildoras">
            {SUGERENCIAS.slice(0, 4).map((s) => (
              <button key={s.rotulo} type="button" className="gma-ag-pildora" onClick={() => sugerir(s)} disabled={!editor}>{s.rotulo}</button>
            ))}
          </div>
        )}
      </div>

      <footer className="gma-ag-pie">
        <div className="gma-ag-alcance" role="group" aria-label="Alcance">
          <button type="button" className="gma-ag-chip" aria-pressed={alcanceReal === 'landing'} onClick={() => setAlcance('landing')}>
            <Ico n="paginas" t={13} /> Toda la landing
          </button>
          {seccionActiva && (
            <button type="button" className="gma-ag-chip" aria-pressed={alcanceReal === 'seccion'} onClick={() => setAlcance('seccion')} title={seccionActiva}>
              <Ico n="diseno" t={13} /> <span className="gma-ag-chip-txt">{seccionActiva}</span>
            </button>
          )}
        </div>
        <div className="gma-ag-caja" data-ocupada={hilo.corriendo ? '' : undefined}>
          <textarea
            ref={inputRef}
            className="gma-ag-input"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviar(texto); }
            }}
            placeholder={hilo.corriendo ? 'Espera a que la IA termine' : 'Envía un mensaje al agente…'}
            disabled={hilo.corriendo || !editor}
            rows={2}
            aria-label="Mensaje al agente"
          />
          <div className="gma-ag-caja-pie">
            {hilo.corriendo
              ? <button type="button" className="gma-ag-enviar" data-detener="" onClick={detener} title="Detener generación" aria-label="Detener generación"><span className="gma-ag-cuadro" /></button>
              : <button type="button" className="gma-ag-enviar" data-listo={texto.trim() ? '' : undefined} onClick={() => enviar(texto)} disabled={!texto.trim() || !editor} title="Enviar" aria-label="Enviar"><Ico n="flecha-arriba" t={15} /></button>}
          </div>
        </div>
      </footer>
    </aside>
  );
}

export default PanelAgente;

// Medidas del video de Gamma 5 (gamma-ui §5.1, aproximadas): panel ~330 px, burbujas de radio ~14
// y padding ~14, texto 13-14 px, input en tarjeta de borde suave con el enviar redondo abajo a la
// derecha.
const CSS_AGENTE = `
.gma-ag{display:flex;flex-direction:column;width:336px;max-width:100%;height:100%;min-height:0;background:var(--pb-fondo);border-right:1px solid var(--pb-borde)}
.gma-ag-cab{display:flex;align-items:center;gap:8px;height:48px;flex:none;padding:0 8px 0 12px}
.gma-ag-casa{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex:none;border-radius:50%;box-shadow:inset 0 0 0 1px var(--pb-borde);color:var(--pb-tenue);text-decoration:none}
.gma-ag-casa:hover{color:var(--pb-texto);background:var(--pb-sup)}
.gma-ag-titulo{flex:1;min-width:0;font-size:13px;font-weight:500;color:var(--pb-texto);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gma-ag-hilo{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:8px 12px 12px}
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
.gma-ag-pie{flex:none;display:grid;gap:8px;padding:8px 12px 12px}
.gma-ag-alcance{display:flex;gap:6px;min-width:0}
.gma-ag-chip{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:100%;height:26px;padding:0 10px;border:1px solid var(--pb-borde);border-radius:999px;background:var(--pb-fondo);color:var(--pb-tenue);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.gma-ag-chip[aria-pressed="true"]{border-color:var(--pb-celeste2);background:var(--pb-celeste);color:var(--pb-tinta)}
.gma-ag-chip-txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.gma-ag-caja{display:grid;gap:4px;padding:10px 10px 8px 12px;border-radius:14px;background:var(--pb-fondo);box-shadow:0 0 0 1px var(--pb-borde),0 1px 2px rgba(0,0,0,.05);transition:box-shadow .15s ease}
.gma-ag-caja:focus-within{box-shadow:0 0 0 1.5px var(--pb-vivo)}
.gma-ag-caja[data-ocupada]{background:var(--pb-sup)}
.gma-ag-input{width:100%;min-height:40px;max-height:160px;resize:none;border:0;outline:none;background:transparent;color:var(--pb-texto);font:inherit;font-size:13.5px;line-height:1.45;padding:0}
.gma-ag-input::placeholder{color:var(--pb-suave)}
.gma-ag-caja-pie{display:flex;justify-content:flex-end}
.gma-ag-enviar{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:0;border-radius:50%;background:var(--pb-borde);color:var(--pb-fondo);cursor:pointer;transition:background .15s ease}
.gma-ag-enviar[data-listo],.gma-ag-enviar[data-detener]{background:var(--pb-azul);color:var(--pb-azul-txt)}
.gma-ag-enviar:disabled{cursor:default}
.gma-ag-cuadro{display:block;width:10px;height:10px;border-radius:2px;background:currentColor}
`;
