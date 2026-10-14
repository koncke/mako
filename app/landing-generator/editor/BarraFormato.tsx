'use client';

// =============================================================================
// BarraFormato — la barra de formato de texto de Gamma (y las piezas del motor)
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer
// todo lo que ahí se hace.» Con texto seleccionado, Gamma muestra una barra con:
// estilos de texto, color, negrita/cursiva/subrayado/tachado, quitar formato,
// enlace, alineación, tamaño, etiqueta y «Editar con IA» (gamma-ui §5.9; los
// nombres son los del catálogo de traducciones de Gamma, no traducciones nuestras).
// Diseño: docs/diseno-editor-landing.md (D1).
//
// Dos modos (contrato con el armazón, paquete H):
//   · 'flotante' — sobre la selección (posToDOMRect), portaleada al body y en la pila
//     de modales. Aparece al soltar el mouse y se va cuando la selección se vacía.
//   · 'fija' — la misma barra en un renglón, para la zona contextual de la toolbar
//     del armazón (Gamma 5 integra la barra de formato a la toolbar fija).
//
// Lo que no se ve en el código y ya mordió en EditorRico (trampas heredadas):
//   · NUNCA ROBA EL FOCO: todo botón hace `onMouseDown` + `preventDefault`. Sin eso el
//     clic le saca el foco al texto y la selección se pierde antes de aplicar.
//   · Los paneles (color, enlace, IA) van portaleados y en la pila de modales
//     ANIDADA, con Escape `stopImmediatePropagation` (todos los Escape de la casa
//     viven en `document` y en captura) y ubicados con OPACIDAD, no `visibility`
//     (un campo invisible no puede recibir el foco).
//   · Un enlace que el server va a tirar no se ofrece: se valida con `hrefPermitido`
//     de especificacion.ts, la MISMA función que usa el saneo (trampa 19).
//   · Colores comparados normalizados (trampa 20): el valor del tema es un token
//     ('acento'); el hex se guarda en minúsculas.
//   · «Editar con IA» reemplaza la selección en UNA transacción y sólo si el texto
//     seleccionado sigue siendo el mismo cuando vuelve la respuesta: la posición se
//     corre con `transaction.mapping` mientras se espera (trampa 3 de EditorRico), y
//     si alguien escribió adentro del rango, no se pisa nada.
//
// Este archivo además exporta las PIEZAS que comparten los menús y los NodeViews del
// paquete G2 (el panel flotante, las filas de menú, el selector de destino, la hoja
// de estilos del chrome). Viven acá porque es el archivo que más las usa; los demás
// las importan de '../BarraFormato'.
//
// Lo que NO se copió de Gamma y por qué: el bloque de código y la ecuación (no hay
// esos nodos en doc.ts), la fuente por selección (la familia la pone el TEMA, nunca un
// nodo: trampa 10) y «Añadir comentario» (los comentarios son por sección, D8: los abre
// el armazón). El atajo ⌘K vive en un keymap de las extensiones (G1) y abre el panel de
// enlace de ESTA barra por `registrarAbrirEnlace` (ver `enchufarAbridorEnlace`).
// =============================================================================

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent as EventoTecla, type MouseEvent as EventoMouse, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useEditorState, type Editor } from '@tiptap/react';
import { posToDOMRect } from '@tiptap/core';
import { TextSelection, type Transaction } from '@tiptap/pm/state';
import { Fragment, type Node as NodoPM } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { undoDepth } from '@tiptap/pm/history';
import { useCapaModal } from '@/app/_components/pila-modales';
import { useEditorLanding } from './contexto';
import { registrarAbrirEnlace } from './extensiones/plugins';
import { pedirIA } from '../cliente';
import { svgIcono } from '@/lib/editor-landing/iconos';
import { varsDeTema } from '@/lib/editor-landing/temas';
import { hrefPermitido } from '@/lib/editor-landing/especificacion';
import { inlineAMarkdown, parsearInline } from '@/lib/editor-landing/ia-bloques';
import { COLORES_TEMA, NODO, TAMANOS_TEXTO, esHex, type ColorTema, type JsonNodo, type TamanoTexto } from '@/lib/editor-landing/doc';
import type { AccionTexto, PedidoIA } from '@/lib/editor-landing/api-tipos';

// ─────────────────────────────────────────────────────────────────────────────
// La hoja del chrome del paquete G2
// ─────────────────────────────────────────────────────────────────────────────
// Prefijo propio `gmx-` y raíz `.gmx`: los paneles van portaleados al body (fuera de la
// raíz `.gma` del armazón) y las barritas de los NodeViews viven ADENTRO del contenido
// (`.gm-doc`), que les hereda fuente, tamaño en em, color y mayúsculas del tema. Por eso
// `.gmx` resetea todo y declara sus propios tokens: no depende de gamma.css (paquete H).
// Los valores son los medidos de la UI de Gamma (gamma-tokens §9 y gamma-ui §1):
// titanium para grises, trueblue para el azul, aurora para la IA. La fuente de la UI de
// Gamma (PP Mori) no está en Google Fonts: se usa `--gma-fuente` del armazón (gamma.css) y,
// en los paneles portaleados al body (fuera de `.gma`, donde esa variable no llega), la misma
// pila escrita como respaldo, para que un panel y la barra de la que sale no tengan dos letras
// distintas. Modo oscuro: redefinición de tokens bajo
// `[data-tema="oscuro"]` (AGENTS.md: una pantalla oscura se hace redefiniendo TOKENS).
// ⚠️ Cadena entre comillas simples, sin backticks ni signos de plantilla (AGENTS.md).

export const CSS_G2: string = [
  '.gmx{--gmx-fondo:#ffffff;--gmx-fondo-2:#f5f5f6;--gmx-hover:#ececed;--gmx-borde:#dfdfe0;--gmx-texto:#38383c;--gmx-texto-2:#66666b;--gmx-tenue:#8b8b90;--gmx-azul:#0858f7;--gmx-azul-fondo:#ebf3fe;--gmx-azul-texto:#0540ad;--gmx-azul-borde:#aad5fe;--gmx-anillo:#2c88f7;--gmx-primario:#0540ad;--gmx-primario-texto:#ffffff;--gmx-ia:#8131dc;--gmx-ia-fondo:#f2ecff;--gmx-peligro:#dc2626;--gmx-sombra:0 8px 16px rgba(0,0,0,.15);--gmx-sombra-sm:0 1px 3px rgba(0,0,0,.1),0 1px 2px rgba(0,0,0,.06);font-family:var(--gma-fuente,"Instrument Sans","Geist",system-ui,-apple-system,"Segoe UI",sans-serif);font-size:14px;line-height:1.45;font-weight:500;font-style:normal;color:var(--gmx-texto);-webkit-text-fill-color:currentColor;letter-spacing:normal;text-transform:none;text-align:left;text-indent:0;white-space:normal;box-sizing:border-box}',
  '[data-tema="oscuro"] .gmx{--gmx-fondo:#1d1f22;--gmx-fondo-2:#212327;--gmx-hover:#2f3339;--gmx-borde:#3d444c;--gmx-texto:#dfdfe0;--gmx-texto-2:#aeaeb2;--gmx-tenue:#8b8b90;--gmx-azul:#63acf7;--gmx-azul-fondo:#0b2e79;--gmx-azul-texto:#d0e6fe;--gmx-azul-borde:#0540ad;--gmx-primario:#84c1fa;--gmx-primario-texto:#002253;--gmx-ia:#bd97fd;--gmx-ia-fondo:#350764;--gmx-sombra:0 8px 16px rgba(0,0,0,.5)}',
  '.gmx *,.gmx *::before,.gmx *::after{box-sizing:border-box}',
  '.gmx button{font:inherit;color:inherit;margin:0}',
  '.gmx-ico{display:inline-flex;align-items:center;justify-content:center;line-height:0;flex:none}',
  '.gmx-ico svg{display:block}',
  // Panel flotante y menú (medidos: padding 8, radio 12-16, sombra 0 8 16 .15)
  '.gmx-pop{background:var(--gmx-fondo);border:1px solid var(--gmx-borde);border-radius:12px;box-shadow:var(--gmx-sombra);padding:6px;max-height:min(72vh,560px);max-width:calc(100vw - 16px);overflow:auto;overscroll-behavior:contain}',
  '.gmx-menu{display:flex;flex-direction:column;gap:1px}',
  '.gmx-fila{display:flex;align-items:center;gap:10px;width:100%;min-height:32px;padding:5px 8px;border:0;border-radius:6px;background:transparent;text-align:left;cursor:pointer;font-size:14px;font-weight:500}',
  '.gmx-fila:hover,.gmx-fila:focus-visible{background:var(--gmx-hover);outline:none}',
  '.gmx-fila[data-activo="si"]{background:var(--gmx-azul-fondo);color:var(--gmx-azul-texto)}',
  '.gmx-fila:disabled{opacity:.45;cursor:default;background:transparent}',
  '.gmx-fila.es-peligro{color:var(--gmx-peligro)}',
  '.gmx-fila-ico{display:inline-flex;align-items:center;justify-content:center;width:18px;flex:none;color:var(--gmx-azul)}',
  '.gmx-fila.es-peligro .gmx-fila-ico{color:var(--gmx-peligro)}',
  '.gmx-fila-txt{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.gmx-fila-atajo{flex:none;font-size:12px;color:var(--gmx-tenue);font-variant-numeric:tabular-nums}',
  '.gmx-fila-check{flex:none;color:var(--gmx-azul)}',
  '.gmx-sep{flex:none;height:1px;margin:4px 2px;background:var(--gmx-borde)}',
  '.gmx-grupo{font-size:12px;font-weight:600;color:var(--gmx-tenue);padding:8px 8px 4px}',
  '.gmx-rotulo{display:block;font-size:12px;font-weight:600;color:var(--gmx-texto-2);margin:8px 2px 4px}',
  '.gmx-nota{font-size:12px;color:var(--gmx-texto-2);line-height:1.4}',
  '.gmx-vacio{padding:12px 8px;font-size:13px;color:var(--gmx-tenue)}',
  // Botones de barra
  '.gmx-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:30px;min-width:30px;padding:0 7px;border:0;border-radius:6px;background:transparent;color:var(--gmx-texto);font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;flex:none}',
  '.gmx-btn:hover{background:var(--gmx-hover)}',
  '.gmx-btn[aria-pressed="true"],.gmx-btn[aria-expanded="true"]{background:var(--gmx-azul-fondo);color:var(--gmx-azul-texto)}',
  '.gmx-btn:disabled{opacity:.4;cursor:default;background:transparent}',
  '.gmx-btn-ia{color:var(--gmx-ia)}',
  '.gmx-btn-ia:hover{background:var(--gmx-ia-fondo)}',
  '.gmx-tx{font-weight:700;font-size:13px;line-height:1}',
  '.gmx-tx sub{font-size:9px;font-weight:600}',
  '.gmx-raya{display:block;width:14px;height:3px;border-radius:2px;margin-top:1px}',
  '.gmx-primario{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 14px;border:0;border-radius:999px;background:var(--gmx-primario);color:var(--gmx-primario-texto);font-weight:600;cursor:pointer}',
  '.gmx-primario:disabled{opacity:.5;cursor:default}',
  '.gmx-chip{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 12px;border:1px solid var(--gmx-borde);border-radius:999px;background:var(--gmx-fondo);font-size:13px;cursor:pointer}',
  '.gmx-chip:hover{background:var(--gmx-hover)}',
  '.gmx-chip[aria-pressed="true"]{background:var(--gmx-azul-fondo);border-color:var(--gmx-azul-borde);color:var(--gmx-azul-texto)}',
  // La barra de formato (flotante: ~600px, radio 8, sombra; fija: un renglón sin caja)
  '.gmx-bf{display:flex;align-items:center;flex-wrap:wrap;gap:1px;padding:4px;background:var(--gmx-fondo);border:1px solid var(--gmx-borde);border-radius:8px;box-shadow:var(--gmx-sombra);max-width:calc(100vw - 16px)}',
  '.gmx-bf-fija{background:transparent;border:0;box-shadow:none;padding:0;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin}',
  '.gmx-bf-sep{flex:none;width:1px;height:20px;margin:0 4px;background:var(--gmx-borde)}',
  '.gmx-bf-error{flex-basis:100%;font-size:12px;color:var(--gmx-peligro);padding:4px 6px 2px}',
  '.gmx-giro{display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:gmx-giro .7s linear infinite;flex:none}',
  '@keyframes gmx-giro{to{transform:rotate(360deg)}}',
  '@media (prefers-reduced-motion:reduce){.gmx-giro{animation-duration:2s}}',
  // Campos
  '.gmx-campo{display:block;width:100%;height:32px;padding:0 10px;border:1px solid var(--gmx-borde);border-radius:6px;background:var(--gmx-fondo);color:var(--gmx-texto);font:inherit;font-size:13px;font-weight:400;outline:none}',
  '.gmx-campo:focus{border-color:var(--gmx-anillo);box-shadow:0 0 0 2px var(--gmx-azul-borde)}',
  'textarea.gmx-campo{height:auto;min-height:72px;padding:8px 10px;resize:vertical;line-height:1.45}',
  '.gmx-campo-error{border-color:var(--gmx-peligro)}',
  '.gmx-error{font-size:12px;color:var(--gmx-peligro);margin-top:4px}',
  '.gmx-interruptor{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:32px;padding:4px 8px;border:0;border-radius:6px;background:transparent;cursor:pointer;font-size:13px;text-align:left}',
  '.gmx-interruptor:hover{background:var(--gmx-hover)}',
  '.gmx-llave{position:relative;flex:none;width:30px;height:18px;border-radius:999px;background:var(--gmx-borde);transition:background .15s}',
  '.gmx-llave::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#ffffff;box-shadow:var(--gmx-sombra-sm);transition:transform .15s}',
  '.gmx-interruptor[aria-checked="true"] .gmx-llave{background:var(--gmx-azul)}',
  '.gmx-interruptor[aria-checked="true"] .gmx-llave::after{transform:translateX(12px)}',
  // Muestras de color (colores del tema + personalizado)
  '.gmx-muestras{display:grid;grid-template-columns:repeat(6,26px);gap:6px;padding:4px 6px}',
  '.gmx-muestra{width:26px;height:26px;padding:0;border-radius:50%;border:1px solid rgba(0,0,0,.14);cursor:pointer}',
  '.gmx-muestra[aria-pressed="true"]{box-shadow:0 0 0 2px var(--gmx-fondo),0 0 0 4px var(--gmx-anillo)}',
  '.gmx-muestra-nada{background:linear-gradient(135deg,transparent 45%,var(--gmx-peligro) 45%,var(--gmx-peligro) 55%,transparent 55%),var(--gmx-fondo)}',
  '.gmx-hex{display:flex;align-items:center;gap:6px;padding:4px 6px}',
  '.gmx-hex input[type="color"]{width:30px;height:30px;padding:0;border:1px solid var(--gmx-borde);border-radius:6px;background:none;cursor:pointer}',
  // Selector de destino
  '.gmx-destino{display:flex;flex-direction:column;gap:2px;padding:2px}',
  '.gmx-destino-actual{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;background:var(--gmx-fondo-2);font-size:12px;color:var(--gmx-texto-2)}',
  '.gmx-destino-actual b{color:var(--gmx-texto);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  // NodeViews del paquete: el marco de lo elegido, la barrita de arriba y el estado vacío.
  // (El marco no es .gmx: vive en el contenido y no le cambia la letra; por eso el azul va literal.)
  '.gmx-nv{position:relative}',
  '.gmx-nv[data-activo="si"]>.gmx-nv-marco{outline:2px solid #2c88f7;outline-offset:6px;border-radius:4px}',
  '.gmx-nv:not([data-activo="si"]) iframe{pointer-events:none}',
  '.gmx-nv-barra{position:absolute;left:0;bottom:calc(100% + 12px);z-index:6;display:flex;align-items:center;flex-wrap:wrap;gap:1px;padding:4px;background:var(--gmx-fondo);border:1px solid var(--gmx-borde);border-radius:8px;box-shadow:var(--gmx-sombra);font-size:13px;width:max-content;max-width:min(720px,calc(100vw - 32px));user-select:none;cursor:default}',
  '.gmx-nv-sep{flex:none;width:1px;height:20px;margin:0 4px;background:var(--gmx-borde)}',
  '.gmx-nv-etq{flex:none;font-size:12px;font-weight:600;color:var(--gmx-tenue);padding:0 6px}',
  '.gmx-nv-vacio{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:120px;padding:18px;border:1.5px dashed rgba(127,127,127,.45);border-radius:10px;background:rgba(127,127,127,.06);text-align:center;color:var(--gmx-texto-2);cursor:pointer}',
  '.gmx-nv-vacio .gmx-ico{color:var(--gmx-azul)}',
  // El hueco de un VIDEO (el VSL de un diseño, 14/10/2026): 16:9 como el video que va a ocupar, con un ▶.
  '.gmx-nv-vacio[data-clase="video"]{aspect-ratio:16/9;min-height:0}',
  '.gmx-nv-play{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--gmx-azul)}',
  '.gmx-nv-vacio .gmx-nv-play .gmx-ico{color:#ffffff;margin-left:3px}',
].join('\n');

/** La hoja del chrome de G2. React 19 la sube al head y la deduplica por `href`. */
export function EstilosG2() {
  return <style href="gmx-g2" precedence="medium">{CSS_G2}</style>;
}

/** Un ícono del catálogo de la landing (Phosphor), como SVG en línea. Nunca vacío. */
export function Icono({ nombre, tam = 16, clase }: { nombre: string; tam?: number; clase?: string }) {
  return <span className={clase ? 'gmx-ico ' + clase : 'gmx-ico'} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svgIcono(nombre, tam) }} />;
}

/**
 * La vista de ProseMirror si el editor ya está montado, o null. ⚠️ En TipTap 3 `editor.view` antes
 * de montar es un proxy que TIRA al leer cualquier campo que no sea `state` (medido en el dist:
 * «The editor view is not available»): con `immediatelyRender: false` hay un tramo entre que el
 * editor existe y que `EditorContent` lo monta, y un `editor.view.dom` ahí tumba la pantalla.
 */
export function vistaDe(e: Editor | null | undefined): EditorView | null {
  if (!e || e.isDestroyed) return null;
  try { return e.view.dom ? e.view : null; } catch { return null; }
}

/** El DOM del editor, re-leído cuando se monta o se desmonta (un efecto que lo lee una vez al montar, se lo pierde). */
export function useDomDelEditor(e: Editor | null | undefined): HTMLElement | null {
  const [dom, setDom] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!e) { setDom(null); return; }
    const leer = () => setDom(vistaDe(e)?.dom ?? null);
    leer();
    e.on('mount', leer);
    e.on('unmount', leer);
    e.on('create', leer);
    return () => { e.off('mount', leer); e.off('unmount', leer); e.off('create', leer); };
  }, [e]);
  return dom;
}

/** `onMouseDown` de todo control: no le saca el foco al texto, salvo que sea un campo donde se escribe. */
export function noRobaFoco(e: EventoMouse) {
  const t = e.target as HTMLElement | null;
  if (t && t.closest('input, textarea, select, [contenteditable="true"]')) return;
  e.preventDefault();
}

// ─────────────────────────────────────────────────────────────────────────────
// El panel flotante (portaleado, en la pila de modales anidada)
// ─────────────────────────────────────────────────────────────────────────────

/** A qué se ancla un panel: un elemento (un botón) o un rectángulo calculado (la selección). */
export type AnclaPanel = HTMLElement | (() => DOMRect | null);

/**
 * El molde de `Flotante` de EditorRico (trampa 5) con ancla virtual: un panel que se ubica
 * debajo (o arriba, si no entra) de su ancla, se registra en la pila de modales ANIDADA,
 * contesta Escape sólo si es el de arriba (con `stopImmediatePropagation`) y se cierra con un
 * clic afuera. Un clic en otro panel de G2 de MÁS ARRIBA (un selector abierto desde éste) no
 * lo cierra: se lee de `data-gmx-z`.
 */
export function Flotante({ ancla, onCerrar, etiqueta, ancho, children, clase, alinear = 'inicio' }: {
  ancla: AnclaPanel;
  onCerrar: () => void;
  etiqueta: string;
  ancho?: number;
  children: ReactNode;
  clase?: string;
  alinear?: 'inicio' | 'centro' | 'fin';
}) {
  const capa = useCapaModal(true, { anidada: true });
  const esElDeArriba = capa.esElDeArriba;
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const cerrarRef = useRef(onCerrar);
  const anclaRef = useRef(ancla);
  const zRef = useRef(capa.z);
  useEffect(() => { cerrarRef.current = onCerrar; }, [onCerrar]);
  useEffect(() => { anclaRef.current = ancla; }, [ancla]);
  useEffect(() => { zRef.current = capa.z; }, [capa.z]);

  // ⚠️ SIN el `montado` de otros portales, a propósito (el porqué está en EditorRico): el panel
  //    sólo existe después de un CLIC, así que `document` ya está y el efecto que lo mide lo encuentra.
  useLayoutEffect(() => {
    const ubicar = () => {
      const el = ref.current;
      if (!el) return;
      const a = anclaRef.current;
      const r = typeof a === 'function' ? a() : (a.isConnected ? a.getBoundingClientRect() : null);
      if (!r) { cerrarRef.current(); return; }
      const w = el.offsetWidth, h = el.offsetHeight;
      let top = r.bottom + 6;
      if (top + h > window.innerHeight - 8 && r.top - h - 6 >= 8) top = r.top - h - 6;
      top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
      let left = alinear === 'centro' ? r.left + r.width / 2 - w / 2 : alinear === 'fin' ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      setPos((p) => (p && Math.abs(p.top - top) < 0.5 && Math.abs(p.left - left) < 0.5 ? p : { top, left }));
    };
    ubicar();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ubicar) : null;
    if (ro && ref.current) ro.observe(ref.current);
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => { ro?.disconnect(); window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', ubicar, true); };
  }, [alinear]);

  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || !(t instanceof Element)) return;
      if (ref.current?.contains(t)) return;
      const a = anclaRef.current;
      if (typeof a !== 'function' && a.contains(t)) return;
      const otra = t.closest('[data-gmx-capa]');
      if (otra && Number(otra.getAttribute('data-gmx-z') ?? 0) > zRef.current) return;
      cerrarRef.current();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !esElDeArriba()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      cerrarRef.current();
    };
    document.addEventListener('pointerdown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('pointerdown', fuera, true); document.removeEventListener('keydown', tecla, true); };
  }, [esElDeArriba]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={etiqueta}
      className={'gmx gmx-pop' + (clase ? ' ' + clase : '')}
      data-gmx-capa=""
      data-gmx-z={capa.z}
      onMouseDown={noRobaFoco}
      style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, width: ancho, zIndex: capa.z, opacity: pos ? 1 : 0, pointerEvents: pos ? undefined : 'none' }}
    >
      <EstilosG2 />
      {children}
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NodeViews contenedores: la forma del contenido va en el contentDOM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pone los atributos de la forma pública (los de `specX` de especificacion.ts) en el contentDOM
 * de un NodeView de React. Por qué ahí y no en un div propio: la hoja del contenido (css.ts)
 * apunta con selectores de HIJO DIRECTO (`.gm-optimizado > .gm-item`, `:nth-child`), y un NodeView
 * de React mete envoltorios entre el contenedor y sus hijos. El contentDOM es el único elemento
 * cuyos hijos son exactamente los nodos de contenido, así que la clase va en él y el DOM del
 * editor queda con la MISMA forma que el HTML publicado (D3).
 *
 * ⚠️ La primera vez NO está todavía: TipTap llama a `mount()` desde el constructor del NodeView,
 *    React dibuja (flushSync) y corre este efecto, y RECIÉN DESPUÉS el constructor crea el
 *    contentDOM y lo cuelga (medido en el dist de @tiptap/react 3.31.4). Por eso, si no lo
 *    encuentra, espera con un MutationObserver al primer cambio de hijos de la caja.
 * TipTap ignora las mutaciones de ATRIBUTOS del contentDOM (`ignoreMutation`), así que esto no
 * hace que ProseMirror vuelva a leer el documento.
 */
export function useAtributosEnContenido(caja: { current: HTMLElement | null }, attrs: Record<string, string | undefined>): void {
  const firma = JSON.stringify(attrs);
  useLayoutEffect(() => {
    const aplicar = (): boolean => {
      const cont = caja.current?.querySelector<HTMLElement>(':scope > [data-node-view-content] > [data-node-view-content-react]');
      if (!cont) return false;
      const a = JSON.parse(firma) as Record<string, string | undefined>;
      cont.className = a.class ?? '';
      for (const nombre of Array.from(cont.attributes).map((x) => x.name)) {
        if (nombre.startsWith('data-') && !nombre.startsWith('data-node-view') && !(nombre in a)) cont.removeAttribute(nombre);
      }
      for (const [k, v] of Object.entries(a)) {
        if (k === 'class' || k === 'style') continue;
        if (v === undefined || v === null) cont.removeAttribute(k);
        else cont.setAttribute(k, v);
      }
      return true;
    };
    if (aplicar()) return;
    const raiz = caja.current;
    if (!raiz || typeof MutationObserver === 'undefined') return;
    const mo = new MutationObserver(() => { if (aplicar()) mo.disconnect(); });
    mo.observe(raiz, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [caja, firma]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Borrar un bloque con 5 s de «Deshacer»
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Borra el bloque que está en `pos` y ofrece «Deshacer» en el aviso del armazón. Deshacer vuelve a
 * poner EL MISMO nodo en su posición —corrida con lo que se haya escrito después— y no lo
 * duplica si un Ctrl+Z ya lo devolvió: borrar es también un paso del historial, así que se mira
 * la PROFUNDIDAD de la pila (el molde de `sacarConDeshacer` de EditorRico, item 18). Si el bloque
 * era el único hijo de algo que no puede quedar vacío (una sección, un ítem: `content: '…+'`),
 * queda un párrafo en su lugar.
 */
export function eliminarBloqueConDeshacer(e: Editor, pos: number, avisar: (texto: string, onDeshacer?: () => void) => void, texto = 'Bloque eliminado'): boolean {
  if (e.isDestroyed) return false;
  const n = e.state.doc.nodeAt(pos);
  if (!n) return false;
  const padre = e.state.doc.resolve(pos).parent;
  const p = e.schema.nodes.paragraph;
  const relleno = padre.childCount === 1 && !padre.type.validContent(Fragment.empty) && !!p && padre.type.validContent(Fragment.from(p.create()));
  const json = n.toJSON();
  const ok = e.chain().focus().command(({ tr }) => {
    if (relleno && p) tr.replaceWith(pos, pos + n.nodeSize, p.create());
    else tr.delete(pos, pos + n.nodeSize);
    return true;
  }).run();
  if (!ok) return false;
  const profundidad = undoDepth(e.state);
  let destino = pos;
  const seguir = ({ transaction }: { transaction: Transaction }) => { destino = transaction.mapping.map(destino, -1); };
  e.on('transaction', seguir);
  const soltar = setTimeout(() => e.off('transaction', seguir), 8_000);
  avisar(texto, () => {
    clearTimeout(soltar);
    e.off('transaction', seguir);
    if (e.isDestroyed || undoDepth(e.state) < profundidad) return;
    const donde = Math.max(0, Math.min(destino, e.state.doc.content.size));
    const aqui = e.state.doc.nodeAt(donde);
    const esRelleno = relleno && !!aqui && aqui.type.name === 'paragraph' && aqui.content.size === 0;
    e.chain().focus().insertContentAt(esRelleno && aqui ? { from: donde, to: donde + aqui.nodeSize } : donde, json).run();
  });
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Menús
// ─────────────────────────────────────────────────────────────────────────────

/** Un menú de filas: flechas, Inicio y Fin mueven el foco entre las opciones habilitadas. */
export function MenuFilas({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  const lista = useRef<HTMLDivElement | null>(null);
  const tecla = (e: EventoTecla<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const ops = Array.from(lista.current?.querySelectorAll<HTMLButtonElement>('.gmx-fila:not(:disabled)') ?? []);
    if (!ops.length) return;
    const i = ops.indexOf(document.activeElement as HTMLButtonElement);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? ops.length - 1 : e.key === 'ArrowDown' ? (i + 1) % ops.length : (i <= 0 ? ops.length - 1 : i - 1);
    ops[j].focus();
  };
  return <div ref={lista} role="menu" aria-label={etiqueta} className="gmx-menu" onKeyDown={tecla}>{children}</div>;
}

/** Un renglón de menú. `onClick` es obligatorio: un renglón que no hace nada no existe. */
export function FilaMenu({ nombre, icono, atajo, activo, apagado, peligro, sub, onClick, estilo, titulo }: {
  nombre: string;
  icono?: ReactNode;
  atajo?: string;
  activo?: boolean;
  apagado?: boolean;
  peligro?: boolean;
  /** Abre un submenú (dibuja la flecha a la derecha). */
  sub?: boolean;
  onClick: () => void;
  estilo?: CSSProperties;
  titulo?: string;
}) {
  return (
    <button
      type="button"
      role={activo === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={activo === undefined ? undefined : !!activo}
      className={peligro ? 'gmx-fila es-peligro' : 'gmx-fila'}
      data-activo={activo ? 'si' : undefined}
      disabled={apagado}
      title={titulo}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {icono !== undefined && <span className="gmx-fila-ico" aria-hidden="true">{icono}</span>}
      <span className="gmx-fila-txt" style={estilo}>{nombre}</span>
      {atajo && <span className="gmx-fila-atajo">{atajo}</span>}
      {sub && <Icono nombre="chevron-derecha" tam={14} clase="gmx-fila-atajo" />}
    </button>
  );
}

/** Interruptor de un renglón (Gamma: «Abrir en nueva pestaña», «Mostrar íconos»…). */
export function Interruptor({ nombre, valor, onCambio, apagado }: { nombre: string; valor: boolean; onCambio: (v: boolean) => void; apagado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      className="gmx-interruptor"
      disabled={apagado}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onCambio(!valor)}
    >
      <span>{nombre}</span>
      <span className="gmx-llave" aria-hidden="true" />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Secciones y páginas (destinos de un enlace o de un botón)
// ─────────────────────────────────────────────────────────────────────────────

/** El título de una sección para listarla: su primer encabezado, o el comienzo de su texto. */
export function tituloDeNodo(n: NodoPM): string {
  let h = '';
  n.forEach((c) => { if (!h && c.type.name === 'heading') h = c.textContent; });
  return (h || n.textContent).replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Las secciones de la página abierta, con el id que lleva su ancla (`#t-<id>`). */
export function seccionesDe(editor: Editor | null): { id: string; titulo: string }[] {
  if (!editor || editor.isDestroyed) return [];
  const out: { id: string; titulo: string }[] = [];
  let i = 0;
  editor.state.doc.forEach((n) => {
    if (n.type.name !== NODO.tarjeta) return;
    i++;
    const id = typeof n.attrs.id === 'string' ? n.attrs.id : '';
    if (id) out.push({ id, titulo: tituloDeNodo(n) || 'Sección ' + i });
  });
  return out;
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Lo que la persona escribió, como destino: un correo suelto pasa a `mailto:`, un teléfono a
 * `tel:` y el resto se valida tal cual con `hrefPermitido` (dominio suelto → https). `null` si el
 * server lo tiraría: un enlace que no se va a guardar no se ofrece (trampa 19).
 */
export function hrefDeEscrito(q: string): string | null {
  const t = q.trim();
  if (!t) return null;
  if (/^[^\s@:/]+@[^\s@]+\.[^\s@]+$/.test(t)) return hrefPermitido('mailto:' + t);
  if (/^\+?[\d\s().-]{7,}$/.test(t) && (t.match(/\d/g) ?? []).length >= 7) return hrefPermitido('tel:' + t.replace(/[^\d+]/g, ''));
  return hrefPermitido(t);
}

/** Cómo se lee un destino guardado (para mostrarlo arriba del selector). */
export function describirDestino(href: string, secciones: { id: string; titulo: string }[], paginas: { id: string; titulo: string }[]): string {
  if (href.startsWith('#t-')) return 'Sección: ' + (secciones.find((s) => '#t-' + s.id === href)?.titulo ?? 'que ya no existe');
  if (href.startsWith('pagina:')) return 'Página: ' + (paginas.find((p) => 'pagina:' + p.id === href)?.titulo ?? 'que ya no existe');
  if (href === '#') return 'Sin destino';
  if (href.startsWith('mailto:')) return href.slice(7);
  if (href.startsWith('tel:')) return href.slice(4);
  return href;
}

/**
 * «Pegar un enlace o buscar una página» (el panel de enlace y de botón de Gamma): un solo campo
 * que acepta una URL, un correo o un teléfono, y busca entre las secciones de esta página y las
 * otras páginas del sitio. «Abrir en nueva pestaña» sólo cuenta para un enlace hacia afuera.
 */
export function SelectorDestino({ valor, nuevaPestana = false, conNuevaPestana = true, onElegir, onQuitar, textoQuitar = 'Quitar enlace' }: {
  valor: string | null;
  nuevaPestana?: boolean;
  conNuevaPestana?: boolean;
  onElegir: (href: string, nuevaPestana: boolean, etiqueta: string) => void;
  onQuitar?: () => void;
  textoQuitar?: string;
}) {
  const ctx = useEditorLanding();
  const [q, setQ] = useState(valor && /^(https?:|mailto:|tel:)/i.test(valor) ? valor.replace(/^(mailto:|tel:)/i, '') : '');
  const [nueva, setNueva] = useState(nuevaPestana);
  const campo = useRef<HTMLInputElement | null>(null);
  const secciones = useMemo(() => seccionesDe(ctx.editor), [ctx.editor]);
  const paginas = useMemo(() => ctx.paginas.filter((p) => p.id !== ctx.paginaActual).map((p) => ({ id: p.id, titulo: p.titulo || 'Página' })), [ctx.paginas, ctx.paginaActual]);
  const todasLasPaginas = useMemo(() => ctx.paginas.map((p) => ({ id: p.id, titulo: p.titulo || 'Página' })), [ctx.paginas]);
  useEffect(() => {
    // Un cuadro después: el panel se ubica en el mismo commit (va con opacidad, así recibe el foco).
    const id = requestAnimationFrame(() => campo.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const n = sinAcentos(q);
  const secs = secciones.filter((s) => !n || sinAcentos(s.titulo).includes(n)).slice(0, 8);
  const pags = paginas.filter((p) => !n || sinAcentos(p.titulo).includes(n)).slice(0, 6);
  const url = hrefDeEscrito(q);
  const externo = !!url && /^https?:/i.test(url);
  const elegirUrl = () => { if (url) onElegir(url, externo && nueva, q.trim()); };

  return (
    <div className="gmx-destino">
      {valor && valor !== '#' && (
        <div className="gmx-destino-actual"><Icono nombre="enlace" tam={14} /><b>{describirDestino(valor, secciones, todasLasPaginas)}</b></div>
      )}
      <input
        ref={campo}
        className="gmx-campo"
        value={q}
        placeholder="Pegar un enlace o buscar una página"
        aria-label="Destino"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (url) elegirUrl();
          else if (secs[0]) onElegir('#t-' + secs[0].id, false, secs[0].titulo);
          else if (pags[0]) onElegir('pagina:' + pags[0].id, false, pags[0].titulo);
        }}
      />
      <MenuFilas etiqueta="Destinos">
        {url && (
          <FilaMenu
            nombre={url.startsWith('mailto:') ? 'Enviar un correo' : url.startsWith('tel:') ? 'Llamar' : 'Enlace a la URL'}
            icono={<Icono nombre={url.startsWith('mailto:') ? 'mail' : url.startsWith('tel:') ? 'telefono' : 'flecha-externa'} />}
            atajo={url.replace(/^(https?:\/\/|mailto:|tel:)/i, '').slice(0, 28)}
            onClick={elegirUrl}
          />
        )}
        {!url && q.trim() && !secs.length && !pags.length && <div className="gmx-vacio">Ese enlace no es válido.</div>}
        {secs.length > 0 && <div className="gmx-grupo">Secciones</div>}
        {secs.map((s) => (
          <FilaMenu key={s.id} nombre={s.titulo} icono={<Icono nombre="notas" />} activo={valor === '#t-' + s.id ? true : undefined} onClick={() => onElegir('#t-' + s.id, false, s.titulo)} />
        ))}
        {pags.length > 0 && <div className="gmx-grupo">Páginas</div>}
        {pags.map((p) => (
          <FilaMenu key={p.id} nombre={p.titulo} icono={<Icono nombre="paginas" />} activo={valor === 'pagina:' + p.id ? true : undefined} onClick={() => onElegir('pagina:' + p.id, false, p.titulo)} />
        ))}
        {conNuevaPestana && (
          <>
            <div className="gmx-sep" />
            <Interruptor nombre="Abrir en nueva pestaña" valor={nueva} onCambio={setNueva} />
          </>
        )}
        {onQuitar && valor && valor !== '#' && (
          <>
            <div className="gmx-sep" />
            <FilaMenu nombre={textoQuitar} icono={<Icono nombre="desenlazar" />} onClick={onQuitar} />
          </>
        )}
      </MenuFilas>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de bloque (Estilos de texto) — los comparten la barra y el asa
// ─────────────────────────────────────────────────────────────────────────────

export type TipoBloqueTexto =
  | 'parrafo' | 'titulo' | 'h1' | 'h2' | 'h3' | 'h4' | 'antetitulo' | 'grande' | 'pequeno'
  | 'vinetas' | 'numerada' | 'tareas' | 'cita';

/** Los estilos de texto de Gamma, con su vista tipográfica y su atajo markdown. */
export const TIPOS_BLOQUE: readonly { id: TipoBloqueTexto; nombre: string; icono: string; atajo?: string; muestra: CSSProperties }[] = [
  { id: 'titulo', nombre: 'Título', icono: 'texto-t', atajo: '!', muestra: { fontSize: 20, fontWeight: 700 } },
  { id: 'h1', nombre: 'Encabezado 1', icono: 'texto-h1', atajo: '#', muestra: { fontSize: 18, fontWeight: 700 } },
  { id: 'h2', nombre: 'Encabezado 2', icono: 'texto-h2', atajo: '##', muestra: { fontSize: 16, fontWeight: 700 } },
  { id: 'h3', nombre: 'Encabezado 3', icono: 'texto-h3', atajo: '###', muestra: { fontSize: 15, fontWeight: 700 } },
  { id: 'h4', nombre: 'Encabezado 4', icono: 'texto-h4', atajo: '####', muestra: { fontSize: 14, fontWeight: 700 } },
  { id: 'grande', nombre: 'Texto grande', icono: 'texto-aa', muestra: { fontSize: 16 } },
  { id: 'parrafo', nombre: 'Texto normal', icono: 'texto-parrafo', muestra: { fontSize: 14 } },
  { id: 'pequeno', nombre: 'Texto pequeño', icono: 'texto-aa', muestra: { fontSize: 12 } },
  { id: 'antetitulo', nombre: 'Antetítulo', icono: 'texto-aa', muestra: { fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' } },
  { id: 'vinetas', nombre: 'Lista con viñetas', icono: 'lista', atajo: '-', muestra: {} },
  { id: 'numerada', nombre: 'Lista numerada', icono: 'lista-numerada', atajo: '1.', muestra: {} },
  { id: 'tareas', nombre: 'Lista de tareas pendientes', icono: 'lista-check', atajo: '[]', muestra: {} },
  { id: 'cita', nombre: 'Cita en bloque', icono: 'cita', atajo: '>', muestra: { fontStyle: 'italic' } },
];

const LISTAS: Record<string, string> = { bulletList: 'listItem', orderedList: 'listItem', taskList: 'taskItem' };
const LISTA_DE_TIPO: Partial<Record<TipoBloqueTexto, string>> = { vinetas: 'bulletList', numerada: 'orderedList', tareas: 'taskList' };

/** El estilo de texto donde está el cursor (la lista o la cita que lo envuelve gana). */
export function tipoBloqueActual(e: Editor): TipoBloqueTexto | null {
  const { $from } = e.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d).type.name;
    if (n === 'bulletList') return 'vinetas';
    if (n === 'orderedList') return 'numerada';
    if (n === 'taskList') return 'tareas';
    if (n === 'blockquote') return 'cita';
  }
  const p = $from.parent;
  if (p.type.name === 'heading') return p.attrs.variante === 'titulo' ? 'titulo' : (('h' + (p.attrs.level ?? 2)) as TipoBloqueTexto);
  if (p.type.name === 'paragraph') {
    const v = p.attrs.variante;
    return v === 'antetitulo' || v === 'grande' || v === 'pequeno' ? v : 'parrafo';
  }
  return null;
}

/**
 * Convierte los bloques de la selección al estilo pedido, en UNA transacción: primero sale de la
 * lista o la cita que no sea el destino, después fija el tipo del bloque de texto, y si el
 * destino es una lista o una cita, envuelve. Sólo comandos del núcleo de TipTap (no depende de
 * qué extensiones haya montado el paquete G1); un tipo de nodo que el esquema no tiene, no se
 * ofrece (`tipoDisponible`).
 */
export function aplicarTipoBloque(e: Editor, tipo: TipoBloqueTexto): boolean {
  if (e.isDestroyed || !e.isEditable || !tipoDisponible(e, tipo)) return false;
  const nodos = e.schema.nodes;
  const actual = tipoBloqueActual(e);
  const listaDestino = LISTA_DE_TIPO[tipo];
  let c = e.chain().focus();
  // 1) Salir de lo que envuelve y no es el destino.
  const { $from } = e.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const nombre = $from.node(d).type.name;
    if (LISTAS[nombre] && nombre !== listaDestino) c = c.liftListItem(LISTAS[nombre]);
    if (nombre === 'blockquote' && tipo !== 'cita') c = c.lift('blockquote');
  }
  // 2) El bloque de texto.
  if (tipo === 'titulo') c = c.setNode('heading', { level: 1, variante: 'titulo' });
  else if (tipo === 'h1' || tipo === 'h2' || tipo === 'h3' || tipo === 'h4') c = c.setNode('heading', { level: Number(tipo.slice(1)), variante: null });
  else if (tipo === 'antetitulo' || tipo === 'grande' || tipo === 'pequeno') c = c.setNode('paragraph', { variante: tipo });
  else if (actual !== tipo && nodos.paragraph) c = c.setNode('paragraph', { variante: null });
  // 3) Envolver.
  if (listaDestino && actual !== tipo) c = c.wrapInList(listaDestino);
  if (tipo === 'cita' && actual !== 'cita') c = c.wrapIn('blockquote');
  return c.run();
}

/** ¿El esquema tiene lo que hace falta para ese estilo? */
export function tipoDisponible(e: Editor, tipo: TipoBloqueTexto): boolean {
  const n = e.schema.nodes;
  if (tipo === 'vinetas') return !!n.bulletList && !!n.listItem;
  if (tipo === 'numerada') return !!n.orderedList && !!n.listItem;
  if (tipo === 'tareas') return !!n.taskList && !!n.taskItem;
  if (tipo === 'cita') return !!n.blockquote;
  if (tipo === 'titulo' || tipo.startsWith('h')) return !!n.heading;
  return !!n.paragraph;
}

// ─────────────────────────────────────────────────────────────────────────────
// Colores, tamaños, IA (datos de la barra)
// ─────────────────────────────────────────────────────────────────────────────

/** La variable CSS del tema de cada color (las pone `varsDeTema` en la raíz `.gm-doc`). */
export const VAR_COLOR: Record<ColorTema, string> = {
  acento: '--gm-acento', texto: '--gm-texto', titulo: '--gm-titulo', tenue: '--gm-texto-tenue',
  'paleta-1': '--gm-paleta-1', 'paleta-2': '--gm-paleta-2', 'paleta-3': '--gm-paleta-3',
  'paleta-4': '--gm-paleta-4', 'paleta-5': '--gm-paleta-5', 'paleta-6': '--gm-paleta-6',
};
const NOMBRE_COLOR: Record<ColorTema, string> = {
  acento: 'Acento', texto: 'Texto', titulo: 'Título', tenue: 'Tenue',
  'paleta-1': 'Color 1', 'paleta-2': 'Color 2', 'paleta-3': 'Color 3', 'paleta-4': 'Color 4', 'paleta-5': 'Color 5', 'paleta-6': 'Color 6',
};

/** Los tamaños por selección (`TAMANOS_TEXTO`): nunca un px libre. La muestra es sólo para el menú. */
const MUESTRA_TAM: Record<TamanoTexto, number> = { xs: 11, s: 12, m: 14, l: 16, xl: 19, '2xl': 23 };
const NOMBRE_TAM: Record<TamanoTexto, string> = { xs: 'Muy pequeño', s: 'Pequeño', m: 'Mediano', l: 'Grande', xl: 'Muy grande', '2xl': 'Enorme' };

/**
 * «Editar con IA» de la barra de Gamma (los nombres son los del catálogo de Gamma en español).
 * Una fila por cada `ACCIONES_TEXTO` de api-tipos; el test del paquete comprueba que no falte
 * ninguna. «Cambiar tono» y «Traducir» abren su submenú.
 */
export const ACCIONES_IA: readonly { tipo: AccionTexto; nombre: string; icono: string; sub?: 'tono' | 'idioma' }[] = [
  { tipo: 'mejorar', nombre: 'Mejorar la escritura', icono: 'varita' },
  { tipo: 'corregir', nombre: 'Corregir la ortografía y la gramática', icono: 'check' },
  { tipo: 'acortar', nombre: 'Acortar', icono: 'menos' },
  { tipo: 'ampliar', nombre: 'Alargar', icono: 'mas' },
  { tipo: 'simplificar', nombre: 'Simplificar el lenguaje', icono: 'bombilla' },
  { tipo: 'especifico', nombre: 'Sé más específico', icono: 'objetivo' },
  { tipo: 'tono', nombre: 'Cambiar tono', icono: 'megafono', sub: 'tono' },
  { tipo: 'traducir', nombre: 'Traducir', icono: 'traducir', sub: 'idioma' },
  { tipo: 'continuar', nombre: 'Seguir escribiendo con IA', icono: 'lapiz' },
];
export const TONOS_IA: readonly string[] = ['Profesional', 'Cercano', 'Persuasivo', 'Inspirador', 'Entusiasta', 'Humor'];
export const IDIOMAS_IA: readonly string[] = ['Inglés', 'Español', 'Portugués', 'Francés', 'Alemán', 'Italiano'];

/** El tope que el server lee de una selección (ia.ts: 8.000 caracteres). */
const TOPE_SELECCION_IA = 8_000;

/** La selección como el markdown en línea de la gramática de la IA (negrita, cursiva, enlaces), bloque por bloque. */
export function markdownDeRango(doc: NodoPM, desde: number, hasta: number): string {
  const partes: string[] = [];
  doc.nodesBetween(desde, hasta, (n, pos) => {
    if (!n.isTextblock) return true;
    const ini = Math.max(desde, pos + 1) - (pos + 1);
    const fin = Math.min(hasta, pos + n.nodeSize - 1) - (pos + 1);
    if (fin > ini) partes.push(inlineAMarkdown((n.cut(ini, fin).content.toJSON() ?? []) as JsonNodo[]));
    return false;
  });
  return partes.join('\n\n');
}

/** El texto de la sección donde está `pos` (el contexto que se le pasa a la IA). */
function textoDeSeccion(doc: NodoPM, pos: number): string {
  const $p = doc.resolve(pos);
  if ($p.depth < 1) return '';
  const t = $p.node(1);
  return t.textBetween(0, t.content.size, '\n', ' ');
}

/**
 * Reemplaza el rango por lo que devolvió la IA, en UNA transacción, y deja seleccionado lo
 * nuevo (para ver qué cambió y poder pedir otra acción). Dentro de un mismo bloque, el texto
 * vuelve a marcas en línea; en varios bloques, un párrafo por bloque de texto. «Seguir
 * escribiendo» agrega después del rango. Las marcas que el esquema no tenga se caen (un
 * `nodeFromJSON` con una marca desconocida tira).
 */
export function aplicarTextoIA(e: Editor, desde: number, hasta: number, texto: string, continuar: boolean): boolean {
  const marcas = e.schema.marks;
  const limpiar = (nodos: JsonNodo[]): JsonNodo[] => nodos
    .filter((n) => n.type !== 'hardBreak' || !!e.schema.nodes.hardBreak)
    .map((n) => (n.marks ? { ...n, marks: n.marks.filter((m) => !!marcas[m.type]) } : n));
  const $a = e.state.doc.resolve(desde);
  const $b = e.state.doc.resolve(hasta);
  const sinMarcas = $a.parent.type.spec.marks === '';
  let contenido: JsonNodo[];
  let desdeReemplazo = desde;
  if (continuar) {
    const plano = ' ' + texto.replace(/\s*\n+\s*/g, ' ').trim();
    contenido = sinMarcas ? [{ type: 'text', text: plano }] : limpiar(parsearInline(plano));
    desdeReemplazo = hasta;
  } else if ($a.sameParent($b) && $a.parent.isTextblock) {
    const plano = texto.replace(/\n{2,}/g, '\n').trim();
    contenido = sinMarcas ? [{ type: 'text', text: plano.replace(/\n/g, ' ') }] : limpiar(parsearInline(plano));
  } else {
    contenido = texto.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p): JsonNodo => {
      const c = limpiar(parsearInline(p));
      return c.length ? { type: 'paragraph', content: c } : { type: 'paragraph' };
    });
  }
  if (!contenido.length) return false;
  return e.chain().focus()
    .insertContentAt(continuar ? hasta : { from: desde, to: hasta }, contenido, { updateSelection: true })
    .command(({ tr }) => {
      const fin = tr.selection.to;
      if (fin > desdeReemplazo) tr.setSelection(TextSelection.create(tr.doc, desdeReemplazo, fin));
      return true;
    })
    .run();
}

function mensajeDeFallo(err: unknown): string {
  if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) return 'MaKo tardó demasiado.';
  if (err instanceof TypeError) return 'Sin conexión.';
  const m = err instanceof Error ? err.message : String(err);
  return (m || 'No se pudo editar.').slice(0, 140);
}

// ─────────────────────────────────────────────────────────────────────────────
// La barra
// ─────────────────────────────────────────────────────────────────────────────

type Panel = { tipo: 'ia' | 'tipo' | 'color' | 'enlace' | 'alinea' | 'tam' | 'etiqueta'; ancla: HTMLElement; sub?: 'tono' | 'idioma' };

/** Un botón de la barra. `onClick` es obligatorio (el test barre el fuente buscando botones sin handler). */
function BotonBarra({ titulo, activo, apagado, expandido, onClick, children, clase }: {
  titulo: string;
  activo?: boolean;
  apagado?: boolean;
  expandido?: boolean;
  onClick: (el: HTMLButtonElement) => void;
  children: ReactNode;
  clase?: string;
}) {
  return (
    <button
      type="button"
      className={clase ? 'gmx-btn ' + clase : 'gmx-btn'}
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo === undefined ? undefined : activo}
      aria-haspopup={expandido === undefined ? undefined : 'menu'}
      aria-expanded={expandido}
      disabled={apagado}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => onClick(e.currentTarget)}
    >
      {children}
    </button>
  );
}

/** Lo que la barra lee del documento en cada transacción (con `useEditorState`: no redibuja por tecla de más). */
function leerEstado(e: Editor | null) {
  if (!e || e.isDestroyed) return null;
  const sel = e.state.selection;
  const $f = sel.$from;
  const padre = $f.parent;
  const ts = e.getAttributes('textStyle');
  const hl = e.getAttributes('highlight');
  const et = e.getAttributes('etiqueta');
  const ln = e.getAttributes('link');
  return {
    desde: sel.from,
    hasta: sel.to,
    vacia: sel.empty,
    esTexto: sel instanceof TextSelection,
    enTexto: padre.isTextblock,
    enBoton: padre.type.name === NODO.boton,
    sinMarcas: padre.type.spec.marks === '',
    foco: e.isFocused,
    editable: e.isEditable,
    negrita: e.isActive('bold'),
    cursiva: e.isActive('italic'),
    subrayado: e.isActive('underline'),
    tachado: e.isActive('strike'),
    tipo: tipoBloqueActual(e),
    alinea: (typeof padre.attrs.textAlign === 'string' ? padre.attrs.textAlign : null) as string | null,
    color: (typeof ts.color === 'string' ? ts.color : null) as string | null,
    tam: (typeof ts.tam === 'string' ? ts.tam : null) as TamanoTexto | null,
    resaltado: e.isActive('highlight') ? (typeof hl.color === 'string' ? hl.color : '') : null,
    etiqueta: e.isActive('etiqueta') ? (typeof et.color === 'string' ? et.color : '') : null,
    enlace: e.isActive('link') ? (typeof ln.href === 'string' ? ln.href : '') : null,
    enlaceNueva: ln.target === '_blank',
  };
}
type EstadoBarra = NonNullable<ReturnType<typeof leerEstado>>;

const ALINEACIONES: readonly { valor: 'left' | 'center' | 'right'; nombre: string; icono: string; atajo: string }[] = [
  { valor: 'left', nombre: 'Alinear a la izquierda', icono: 'alinear-izquierda', atajo: '⇧⌘L' },
  { valor: 'center', nombre: 'Alinear al centro', icono: 'alinear-centro', atajo: '⇧⌘E' },
  { valor: 'right', nombre: 'Alinear a la derecha', icono: 'alinear-derecha', atajo: '⇧⌘R' },
];

/**
 * ⌘K abre el panel de enlace. El keymap (extensiones/plugins.ts) tiene UN abridor por editor y
 * las barras son DOS (la flotante sobre la selección y la fija de la toolbar): cada una enchufa el
 * suyo y gana la flotante si está a la vista; si no, la fija. Cada abridor devuelve false cuando
 * su barra no puede abrir el panel (sin texto, sin la marca, barra oculta): ahí TipTap deja pasar
 * la tecla.
 */
const abridoresEnlace = new WeakMap<Editor, { fija?: () => boolean; flotante?: () => boolean }>();
function enchufarAbridorEnlace(editor: Editor, modo: 'flotante' | 'fija', fn: (() => boolean) | null): void {
  const a = abridoresEnlace.get(editor) ?? {};
  if (fn) a[modo] = fn; else delete a[modo];
  abridoresEnlace.set(editor, a);
  registrarAbrirEnlace(editor, a.fija || a.flotante ? () => (a.flotante?.() ?? false) || (a.fija?.() ?? false) : null);
}

export function BarraFormato({ editor: editorProp, modo }: { editor?: Editor | null; modo: 'flotante' | 'fija' }) {
  const ctx = useEditorLanding();
  const editor = editorProp ?? ctx.editor;
  const est = useEditorState({ editor, selector: ({ editor: e }) => leerEstado(e) });
  const [panel, setPanel] = useState<Panel | null>(null);
  const [ia, setIa] = useState<{ cargando: boolean; error: string | null }>({ cargando: false, error: null });
  const [seleccionando, setSeleccionando] = useState(false);
  const [focoAdentro, setFocoAdentro] = useState(false);
  const raiz = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const capaActiva = modo === 'flotante';
  const domEditor = useDomDelEditor(editor);

  // Mientras se arrastra el mouse para seleccionar, la barra no aparece (Gamma la muestra al soltar).
  useEffect(() => {
    if (modo !== 'flotante' || !domEditor) return;
    const abajo = () => setSeleccionando(true);
    const arriba = () => setSeleccionando(false);
    domEditor.addEventListener('mousedown', abajo);
    document.addEventListener('mouseup', arriba);
    return () => { domEditor.removeEventListener('mousedown', abajo); document.removeEventListener('mouseup', arriba); };
  }, [domEditor, modo]);

  // El error de la IA se va solo (el texto que se dibuja es corto y no se queda para siempre).
  useEffect(() => {
    if (!ia.error) return;
    const t = setTimeout(() => setIa((v) => (v.cargando ? v : { cargando: false, error: null })), 6000);
    return () => clearTimeout(t);
  }, [ia.error]);

  const conSeleccion = !!est && est.esTexto && !est.vacia && est.enTexto && !est.enBoton && est.editable;
  const visible = modo === 'fija'
    ? !!est
    : conSeleccion && !seleccionando && (est!.foco || !!panel || ia.cargando || focoAdentro || !!ia.error);

  // Si la selección se vacía con un panel abierto (la persona hizo clic en el texto), el panel se va.
  useEffect(() => {
    if (modo === 'flotante' && !conSeleccion && panel && !ia.cargando) setPanel(null);
  }, [conSeleccion, panel, ia.cargando, modo]);

  const capa = useCapaModal(capaActiva && visible, { anidada: true });

  // Ubicación sobre la selección (modo flotante).
  useLayoutEffect(() => {
    if (modo !== 'flotante' || !visible || !editor || editor.isDestroyed || !est) { setPos(null); return; }
    const ubicar = () => {
      const el = raiz.current;
      const vista = vistaDe(editor);
      if (!el || !vista) return;
      const max = editor.state.doc.content.size;
      const r = posToDOMRect(vista, Math.min(est.desde, max), Math.min(est.hasta, max));
      const w = el.offsetWidth, h = el.offsetHeight;
      let top = r.top - h - 8;
      if (top < 8) top = r.bottom + 8;
      top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
      const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
      setPos((p) => (p && Math.abs(p.top - top) < 0.5 && Math.abs(p.left - left) < 0.5 ? p : { top, left }));
    };
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => { window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', ubicar, true); };
  }, [modo, visible, editor, est?.desde, est?.hasta, est]);

  const cadena = useCallback(() => (editor && !editor.isDestroyed ? editor.chain().focus() : null), [editor]);
  const hayMarca = (n: string) => !!editor && !!editor.schema.marks[n];
  const abrir = (tipo: Panel['tipo'], ancla: HTMLElement) => setPanel((p) => (p && p.tipo === tipo ? null : { tipo, ancla }));

  // ⌘K: abre (nunca cierra) el panel de enlace anclado al botón «Enlace» de ESTA barra. Lee el
  // estado del render de la tecla por un ref (el abridor se enchufa una vez por editor).
  const abrirEnlaceVivo = useRef<() => boolean>(() => false);
  abrirEnlaceVivo.current = () => {
    if (!visible || !est || !est.enTexto || est.enBoton || est.sinMarcas || !hayMarca('link')) return false;
    const boton = raiz.current?.querySelector<HTMLElement>('button[aria-label="Enlace"]');
    if (!boton) return false;
    setPanel({ tipo: 'enlace', ancla: boton });
    return true;
  };
  useEffect(() => {
    if (!editor) return;
    enchufarAbridorEnlace(editor, modo, () => abrirEnlaceVivo.current());
    return () => enchufarAbridorEnlace(editor, modo, null);
  }, [editor, modo]);

  const marcar = (nombre: 'bold' | 'italic' | 'underline' | 'strike') => cadena()?.toggleMark(nombre).run();

  const ponerTextStyle = (cambio: { color?: string | null; tam?: TamanoTexto | null }) => {
    if (!editor || !est || !hayMarca('textStyle')) return;
    const color = cambio.color !== undefined ? cambio.color : est.color;
    const tam = cambio.tam !== undefined ? cambio.tam : est.tam;
    const c = cadena();
    if (!c) return;
    if (!color && !tam) c.unsetMark('textStyle').run();
    else c.setMark('textStyle', { color: color ?? null, tam: tam ?? null }).run();
  };
  const ponerResaltado = (color: string | null) => {
    if (!hayMarca('highlight')) return;
    if (color === null) cadena()?.unsetMark('highlight').run();
    else cadena()?.setMark('highlight', { color }).run();
  };
  const ponerEtiqueta = (color: ColorTema | null | false) => {
    if (!hayMarca('etiqueta')) return;
    if (color === false) cadena()?.unsetMark('etiqueta').run();
    else cadena()?.setMark('etiqueta', { color }).run();
  };
  const alinear = (valor: 'left' | 'center' | 'right') => {
    const v = valor === 'left' ? null : valor;
    cadena()?.updateAttributes('paragraph', { textAlign: v }).updateAttributes('heading', { textAlign: v }).run();
    setPanel(null);
  };
  const ponerEnlace = (href: string, nueva: boolean, etiqueta: string) => {
    if (!editor || !est || !hayMarca('link')) return;
    const attrs = { href, target: nueva && /^https?:/i.test(href) ? '_blank' : null };
    const c = cadena();
    if (!c) return;
    if (est.vacia && est.enlace === null) {
      // Sin texto elegido: se escribe la dirección + un espacio SIN la marca (el enlace es inclusivo).
      c.insertContent([{ type: 'text', text: etiqueta || href, marks: [{ type: 'link', attrs }] }, { type: 'text', text: ' ' }]).run();
    } else {
      c.extendMarkRange('link').setMark('link', attrs).run();
    }
    setPanel(null);
  };
  const quitarEnlace = () => { cadena()?.extendMarkRange('link').unsetMark('link').run(); setPanel(null); };

  const editarConIA = async (tipo: AccionTexto, extra: { tono?: string; idioma?: string } = {}) => {
    const e = editor;
    if (!e || e.isDestroyed || ia.cargando) return;
    const { from, to, empty } = e.state.selection;
    if (empty) return;
    const original = e.state.doc.textBetween(from, to, '\n\n', '\ufffc');
    const md = markdownDeRango(e.state.doc, from, to).slice(0, TOPE_SELECCION_IA);
    if (!md.trim()) return;
    setPanel(null);
    setIa({ cargando: true, error: null });
    // La posición se corre con lo que se escriba mientras MaKo contesta.
    const rango = { desde: from, hasta: to, vivo: true };
    const seguir = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return;
      const a = transaction.mapping.mapResult(rango.desde, 1);
      const b = transaction.mapping.mapResult(rango.hasta, -1);
      rango.desde = a.pos;
      rango.hasta = b.pos;
      if (b.pos <= a.pos) rango.vivo = false;
    };
    e.on('transaction', seguir);
    try {
      const pedido: PedidoIA = {
        accion: 'texto', tipo, texto: md,
        contexto: textoDeSeccion(e.state.doc, from).slice(0, 4_000),
        ...(extra.tono ? { tono: extra.tono } : {}),
        ...(extra.idioma ? { idioma: extra.idioma } : {}),
      };
      // El server corta a los 40 s (ia.ts, PLAZOS.texto): este tope sólo cubre una conexión que se cae.
      const j = await pedirIA(pedido, 60_000);
      if (!j.ok) throw new Error(j.error || 'No se pudo editar.');
      if (!('texto' in j) || !j.texto.trim()) throw new Error('MaKo no devolvió texto.');
      if (e.isDestroyed) return;
      if (!rango.vivo || e.state.doc.textBetween(rango.desde, rango.hasta, '\n\n', '\ufffc') !== original) throw new Error('El texto cambió.');
      if (!aplicarTextoIA(e, rango.desde, rango.hasta, j.texto, tipo === 'continuar')) throw new Error('No se pudo aplicar.');
      setIa({ cargando: false, error: null });
    } catch (err) {
      setIa({ cargando: false, error: mensajeDeFallo(err) });
    } finally {
      e.off('transaction', seguir);
    }
  };

  if (!editor || !est || !visible) return null;
  if (modo === 'flotante' && typeof document === 'undefined') return null;

  const vars = varsDeTema(ctx.tema) as CSSProperties;
  const tipoNombre = TIPOS_BLOQUE.find((t) => t.id === est.tipo)?.nombre ?? 'Texto normal';
  const sinTexto = !est.enTexto || est.enBoton;
  const alineaActual = ALINEACIONES.find((a) => a.valor === (est.alinea ?? 'left')) ?? ALINEACIONES[0];

  const barra = (
    <div
      ref={raiz}
      className={'gmx gmx-bf' + (modo === 'fija' ? ' gmx-bf-fija' : '')}
      role="toolbar"
      aria-label="Formato de texto"
      data-gmx-capa=""
      data-gmx-z={capa.z}
      onMouseDown={noRobaFoco}
      onFocus={() => setFocoAdentro(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocoAdentro(false); }}
      style={modo === 'flotante'
        ? { position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, zIndex: capa.z, opacity: pos ? 1 : 0, pointerEvents: pos ? undefined : 'none' }
        : undefined}
    >
      <EstilosG2 />
      <BotonBarra titulo="Estilos de texto" expandido={panel?.tipo === 'tipo'} apagado={sinTexto} onClick={(el) => abrir('tipo', el)}>
        <span>{tipoNombre}</span><Icono nombre="chevron-abajo" tam={12} />
      </BotonBarra>
      <BotonBarra titulo="Color del texto" expandido={panel?.tipo === 'color'} apagado={sinTexto || est.sinMarcas || !hayMarca('textStyle')} onClick={(el) => abrir('color', el)}>
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', ...vars }}>
          <Icono nombre="color-texto" tam={15} />
          <span className="gmx-raya" style={{ background: colorDeMuestra(est.color) ?? 'currentColor' }} />
        </span>
        <Icono nombre="chevron-abajo" tam={12} />
      </BotonBarra>
      <span className="gmx-bf-sep" />
      <BotonBarra titulo="Negrita ⌘B" activo={est.negrita} apagado={sinTexto || est.sinMarcas || !hayMarca('bold')} onClick={() => marcar('bold')}><Icono nombre="negrita" /></BotonBarra>
      <BotonBarra titulo="Cursiva ⌘I" activo={est.cursiva} apagado={sinTexto || est.sinMarcas || !hayMarca('italic')} onClick={() => marcar('italic')}><Icono nombre="cursiva" /></BotonBarra>
      <BotonBarra titulo="Subrayar ⌘U" activo={est.subrayado} apagado={sinTexto || est.sinMarcas || !hayMarca('underline')} onClick={() => marcar('underline')}><Icono nombre="subrayado" /></BotonBarra>
      <BotonBarra titulo="Tachado ⇧⌘X" activo={est.tachado} apagado={sinTexto || est.sinMarcas || !hayMarca('strike')} onClick={() => marcar('strike')}><Icono nombre="tachado" /></BotonBarra>
      <BotonBarra titulo="Quitar formato" apagado={sinTexto || est.vacia} onClick={() => cadena()?.unsetAllMarks().run()}><span className="gmx-tx">T<sub>x</sub></span></BotonBarra>
      <span className="gmx-bf-sep" />
      <BotonBarra titulo="Enlace" activo={est.enlace !== null} expandido={panel?.tipo === 'enlace'} apagado={sinTexto || est.sinMarcas || !hayMarca('link')} onClick={(el) => abrir('enlace', el)}><Icono nombre="enlace" /></BotonBarra>
      <BotonBarra titulo="Alinear texto" expandido={panel?.tipo === 'alinea'} apagado={sinTexto} onClick={(el) => abrir('alinea', el)}>
        <Icono nombre={alineaActual.icono} /><Icono nombre="chevron-abajo" tam={12} />
      </BotonBarra>
      <BotonBarra titulo="Tamaño de texto" activo={est.tam ? true : undefined} expandido={panel?.tipo === 'tam'} apagado={sinTexto || est.sinMarcas || !hayMarca('textStyle')} onClick={(el) => abrir('tam', el)}>
        <Icono nombre="texto-aa" /><Icono nombre="chevron-abajo" tam={12} />
      </BotonBarra>
      <BotonBarra titulo="Etiqueta" activo={est.etiqueta !== null} expandido={panel?.tipo === 'etiqueta'} apagado={sinTexto || est.sinMarcas || !hayMarca('etiqueta')} onClick={(el) => abrir('etiqueta', el)}>
        <Icono nombre="etiqueta" />
      </BotonBarra>
      <span className="gmx-bf-sep" />
      <BotonBarra titulo="Editar con IA" clase="gmx-btn-ia" expandido={panel?.tipo === 'ia'} apagado={sinTexto || est.vacia || ia.cargando} onClick={(el) => abrir('ia', el)}>
        {ia.cargando ? <span className="gmx-giro" aria-label="Editando" /> : <Icono nombre="destellos" />}
        <span>Editar con IA</span>
      </BotonBarra>
      {ia.error && <div className="gmx-bf-error" role="alert">{ia.error}</div>}

      {panel && (
        <PanelDeBarra
          panel={panel}
          est={est}
          vars={vars}
          editor={editor}
          onCerrar={() => setPanel(null)}
          onSub={(sub) => setPanel((p) => (p ? { ...p, sub } : p))}
          onTipo={(t) => { aplicarTipoBloque(editor, t); setPanel(null); }}
          onColor={(c) => ponerTextStyle({ color: c })}
          onResaltado={ponerResaltado}
          onTam={(t) => { ponerTextStyle({ tam: t }); setPanel(null); }}
          onEtiqueta={(c) => { ponerEtiqueta(c); setPanel(null); }}
          onAlinear={alinear}
          onEnlace={ponerEnlace}
          onQuitarEnlace={quitarEnlace}
          onIA={(tipo, extra) => { void editarConIA(tipo, extra); }}
        />
      )}
    </div>
  );

  return modo === 'flotante' ? createPortal(barra, document.body) : barra;
}

export default BarraFormato;

/** El color que se ve en la raya del botón: un token del tema (vía su variable) o el hex. */
function colorDeMuestra(c: string | null): string | null {
  if (!c) return null;
  if (esHex(c)) return c;
  return (COLORES_TEMA as readonly string[]).includes(c) ? 'var(' + VAR_COLOR[c as ColorTema] + ')' : null;
}

/** Los paneles que abre la barra (uno por vez). */
function PanelDeBarra({ panel, est, vars, editor, onCerrar, onSub, onTipo, onColor, onResaltado, onTam, onEtiqueta, onAlinear, onEnlace, onQuitarEnlace, onIA }: {
  panel: Panel;
  est: EstadoBarra;
  vars: CSSProperties;
  editor: Editor;
  onCerrar: () => void;
  onSub: (sub: 'tono' | 'idioma' | undefined) => void;
  onTipo: (t: TipoBloqueTexto) => void;
  onColor: (c: string | null) => void;
  onResaltado: (c: string | null) => void;
  onTam: (t: TamanoTexto | null) => void;
  onEtiqueta: (c: ColorTema | null | false) => void;
  onAlinear: (v: 'left' | 'center' | 'right') => void;
  onEnlace: (href: string, nueva: boolean, etiqueta: string) => void;
  onQuitarEnlace: () => void;
  onIA: (tipo: AccionTexto, extra?: { tono?: string; idioma?: string }) => void;
}) {
  const [hex, setHex] = useState(est.color && esHex(est.color) ? est.color : '#000000');
  if (panel.tipo === 'tipo') {
    return (
      <Flotante ancla={panel.ancla} onCerrar={onCerrar} etiqueta="Estilos de texto" ancho={260}>
        <MenuFilas etiqueta="Estilos de texto">
          {TIPOS_BLOQUE.map((t) => (
            <FilaMenu key={t.id} nombre={t.nombre} icono={<Icono nombre={t.icono} />} atajo={t.atajo} estilo={t.muestra}
              activo={est.tipo === t.id ? true : undefined} apagado={!tipoDisponible(editor, t.id)} onClick={() => onTipo(t.id)} />
          ))}
        </MenuFilas>
      </Flotante>
    );
  }
  if (panel.tipo === 'color') {
    return (
      <Flotante ancla={panel.ancla} onCerrar={onCerrar} etiqueta="Color del texto" ancho={232}>
        <div style={vars}>
          <span className="gmx-rotulo">Colores del tema</span>
          <div className="gmx-muestras">
            <button type="button" className="gmx-muestra gmx-muestra-nada" title="Predeterminado" aria-label="Predeterminado" aria-pressed={!est.color} onMouseDown={(e) => e.preventDefault()} onClick={() => onColor(null)} />
            {COLORES_TEMA.map((c) => (
              <button key={c} type="button" className="gmx-muestra" title={NOMBRE_COLOR[c]} aria-label={NOMBRE_COLOR[c]} aria-pressed={est.color === c}
                style={{ background: 'var(' + VAR_COLOR[c] + ')' }} onMouseDown={(e) => e.preventDefault()} onClick={() => onColor(c)} />
            ))}
          </div>
          <span className="gmx-rotulo">Color personalizado</span>
          <div className="gmx-hex">
            <input type="color" value={hex} aria-label="Color personalizado" onChange={(e) => { setHex(e.target.value.toLowerCase()); onColor(e.target.value.toLowerCase()); }} />
            <input className="gmx-campo" value={hex} maxLength={7} aria-label="Hex"
              onChange={(e) => { const v = e.target.value.trim().toLowerCase(); setHex(v); if (esHex(v)) onColor(v); }} />
          </div>
          <span className="gmx-rotulo">Color de resaltado</span>
          <div className="gmx-muestras">
            <button type="button" className="gmx-muestra gmx-muestra-nada" title="Quitar resaltado" aria-label="Quitar resaltado" aria-pressed={est.resaltado === null} onMouseDown={(e) => e.preventDefault()} onClick={() => onResaltado(null)} />
            {COLORES_TEMA.filter((c) => c !== 'texto' && c !== 'titulo').map((c) => (
              <button key={c} type="button" className="gmx-muestra" title={NOMBRE_COLOR[c]} aria-label={'Resaltar ' + NOMBRE_COLOR[c]} aria-pressed={est.resaltado === c}
                style={{ background: 'var(' + VAR_COLOR[c] + ')', opacity: 0.55 }} onMouseDown={(e) => e.preventDefault()} onClick={() => onResaltado(c)} />
            ))}
          </div>
        </div>
      </Flotante>
    );
  }
  if (panel.tipo === 'enlace') {
    return (
      <Flotante ancla={panel.ancla} onCerrar={onCerrar} etiqueta="Enlace" ancho={300}>
        <SelectorDestino valor={est.enlace} nuevaPestana={est.enlaceNueva} onElegir={onEnlace} onQuitar={onQuitarEnlace} />
      </Flotante>
    );
  }
  if (panel.tipo === 'alinea') {
    return (
      <Flotante ancla={panel.ancla} onCerrar={onCerrar} etiqueta="Alinear texto" ancho={240}>
        <MenuFilas etiqueta="Alinear texto">
          {ALINEACIONES.map((a) => (
            <FilaMenu key={a.valor} nombre={a.nombre} icono={<Icono nombre={a.icono} />} atajo={a.atajo} activo={(est.alinea ?? 'left') === a.valor ? true : undefined} onClick={() => onAlinear(a.valor)} />
          ))}
        </MenuFilas>
      </Flotante>
    );
  }
  if (panel.tipo === 'tam') {
    return (
      <Flotante ancla={panel.ancla} onCerrar={onCerrar} etiqueta="Tamaño de texto" ancho={200}>
        <MenuFilas etiqueta="Tamaño de texto">
          <FilaMenu nombre="Predeterminado" icono={<Icono nombre="texto-aa" />} activo={!est.tam ? true : undefined} onClick={() => onTam(null)} />
          {TAMANOS_TEXTO.map((t) => (
            <FilaMenu key={t} nombre={NOMBRE_TAM[t]} estilo={{ fontSize: MUESTRA_TAM[t] }} atajo={t.toUpperCase()} activo={est.tam === t ? true : undefined} onClick={() => onTam(t)} />
          ))}
        </MenuFilas>
      </Flotante>
    );
  }
  if (panel.tipo === 'etiqueta') {
    const colores: (ColorTema | null)[] = [null, 'tenue', 'paleta-1', 'paleta-2', 'paleta-3', 'paleta-4', 'paleta-5', 'paleta-6'];
    return (
      <Flotante ancla={panel.ancla} onCerrar={onCerrar} etiqueta="Etiqueta" ancho={220}>
        <div style={vars}>
          <span className="gmx-rotulo">Etiqueta</span>
          <div className="gmx-muestras">
            {colores.map((c) => (
              <button key={c ?? 'acento'} type="button" className="gmx-muestra" title={c ? NOMBRE_COLOR[c] : 'Acento'} aria-label={c ? NOMBRE_COLOR[c] : 'Acento'}
                aria-pressed={est.etiqueta !== null && (est.etiqueta || null) === c}
                style={{ background: c === null ? 'var(--gm-acento)' : c === 'tenue' ? 'var(--gm-superficie, #ececed)' : 'var(' + VAR_COLOR[c] + ')' }}
                onMouseDown={(e) => e.preventDefault()} onClick={() => onEtiqueta(c)} />
            ))}
          </div>
          {est.etiqueta !== null && (
            <MenuFilas etiqueta="Etiqueta">
              <div className="gmx-sep" />
              <FilaMenu nombre="Quitar etiqueta" icono={<Icono nombre="cerrar" />} onClick={() => onEtiqueta(false)} />
            </MenuFilas>
          )}
        </div>
      </Flotante>
    );
  }
  // panel.tipo === 'ia'
  if (panel.sub) {
    const lista = panel.sub === 'tono' ? TONOS_IA : IDIOMAS_IA;
    return (
      <Flotante ancla={panel.ancla} onCerrar={onCerrar} etiqueta={panel.sub === 'tono' ? 'Cambiar tono' : 'Traducir'} ancho={240}>
        <MenuFilas etiqueta={panel.sub === 'tono' ? 'Tono' : 'Idioma'}>
          <FilaMenu nombre="Volver" icono={<Icono nombre="chevron-izquierda" />} onClick={() => onSub(undefined)} />
          <div className="gmx-sep" />
          {lista.map((v) => (
            <FilaMenu key={v} nombre={v} onClick={() => onIA(panel.sub === 'tono' ? 'tono' : 'traducir', panel.sub === 'tono' ? { tono: v.toLowerCase() } : { idioma: v.toLowerCase() })} />
          ))}
        </MenuFilas>
      </Flotante>
    );
  }
  return (
    <Flotante ancla={panel.ancla} onCerrar={onCerrar} etiqueta="Editar con IA" ancho={300}>
      <MenuFilas etiqueta="Editar con IA">
        {ACCIONES_IA.map((a) => (
          <FilaMenu key={a.tipo} nombre={a.nombre} icono={<Icono nombre={a.icono} />} sub={!!a.sub}
            onClick={() => (a.sub ? onSub(a.sub) : onIA(a.tipo))} />
        ))}
      </MenuFilas>
    </Flotante>
  );
}
