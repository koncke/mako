'use client';

// =============================================================================
// piezas-gma — el chrome de Gamma que comparten los paneles y diálogos del paquete I1
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Los paneles de Tema y
// estilo de sección y los diálogos de Publicar, Compartir, Exportar y Configuración se
// dibujan con los componentes de Gamma 5 (Chakra con su tema: píldoras, pestañas de fondo
// azul claro, menús de radio 16), NO con los de app/_ui (memoria «Copiar una app TAL
// CUAL»). Diseño: docs/diseno-editor-landing.md (D3: el chrome vive bajo `.gma`).
//
// Medidas y colores: los MEDIDOS en gamma-tokens.md §9 y gamma-ui.md §1 (titanium para
// los grises, deepocean para el azul): botón primario #0540AD alto 32 radio 24, pestaña
// 600 14px #002253 con activo #D0E6FE, menú de radio 16 con ítems de 28 px y radio 6,
// título de modal 22px/700 deepocean-950. La fuente de la UI de Gamma (PP Mori) no está
// en Google Fonts: se hereda la de `.gma` (la decide gamma.css, paquete H) y, si no hay,
// Inter/la del sistema.
//
// Por qué este archivo y no gamma.css: los siete componentes del paquete se portalean
// al <body> (un panel adentro del lienzo queda recortado por su overflow), así que no
// heredan nada de la raíz `.gma` del armazón. Cada raíz lleva `gma gmp` y la hoja de
// acá se monta con `<style href precedence>` (React 19 la sube al <head> UNA vez aunque
// la pidan siete componentes). Prefijo propio `gmp-` para no chocar con las clases de H.
//
// Reglas de la casa que viven acá para que ningún diálogo del paquete las olvide:
//   · Cada caja se REGISTRA en la pila de modales (`useCapaModal`): Escape cierra sólo la
//     de arriba, y la de abajo se esconde sin desmontarse.
//   · `onCerrar` se guarda en un ref: la identidad que pase quien monta no re-ejecuta el
//     efecto del foco (AGENTS.md, «Todo <Modal> recibe un onCerrar de identidad FIJA»: con
//     una flecha nueva por tecla, el campo perdía el foco con cada letra).
//   · El foco inicial espera a que la caja SE VEA: el primer render es `display:none`.
//   · Los `fetch` van con `AbortSignal.timeout` (un tope que vive en la ruta no protege al
//     cliente) y leen `ok` del CUERPO, no del status (`res.ok` no es «salió bien»).
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';
import type { ConfigLanding } from '@/lib/editor-landing/api-tipos';
import { useEditorLanding } from '../contexto';

// ─────────────────────────────────────────────────────────────────────────────
// Pedidos a /api/landing-generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/landing-generator con un `accion` de `PedidoDocs`. Vive en ../../cliente (una sola
 * copia: había cuatro); `pedir` es el nombre con que la importan los componentes de este paquete.
 * Nunca tira: una caída de red, un plazo vencido o un cuerpo que no es JSON vuelven como
 * `{ ok: false, error }` con el texto corto que la pantalla puede mostrar tal cual.
 */
export { pedirDocs as pedir } from '../../cliente';

/** Copia al portapapeles; false si el navegador no dejó (sin permiso, contexto no seguro). */
export function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// La configuración, siempre a partir de la ÚLTIMA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `setConfig` del contexto reemplaza la configuración ENTERA. Dos cambios en el mismo tic
 * (un interruptor que toca dos campos, un «Restablecer» que llama dos veces) armados sobre el
 * `config` del render caerían uno encima del otro: el segundo pisa al primero con un objeto
 * que no lo tiene. Este hook guarda la última que se mandó en un ref y cada cambio parte de
 * ahí (AGENTS.md: «dos componentes que llaman al mismo setter de un objeto completo son un
 * bug esperando»). El ref se re-sincroniza con cada render: si otro (la IA, deshacer) cambió
 * la configuración, se parte de la nueva.
 */
export function useConfigViva(): { config: ConfigLanding; cambiar: (f: (c: ConfigLanding) => ConfigLanding) => void } {
  const { config, setConfig } = useEditorLanding();
  const ultima = useRef(config);
  useLayoutEffect(() => { ultima.current = config; }, [config]);
  const setRef = useRef(setConfig);
  useLayoutEffect(() => { setRef.current = setConfig; }, [setConfig]);
  const cambiar = useCallback((f: (c: ConfigLanding) => ConfigLanding) => {
    const nueva = f(ultima.current);
    ultima.current = nueva;
    setRef.current(nueva);
  }, []);
  return { config, cambiar };
}

/** Lo mismo para `config.sitio`, que es lo que más se toca. */
export function cambiarSitio(c: ConfigLanding, parcial: Partial<ConfigLanding['sitio']>): ConfigLanding {
  return { ...c, sitio: { ...c.sitio, ...parcial } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Íconos (trazos propios a 24×24, al estilo de los de Font Awesome que usa Gamma)
// ─────────────────────────────────────────────────────────────────────────────

const TRAZOS: Record<string, ReactNode> = {
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  mas: <path d="M12 5v14M5 12h14" />,
  buscar: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  copiar: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>,
  abrir: <><path d="M14 4.5h5.5V10" /><path d="M19.5 4.5L11 13" /><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></>,
  descargar: <><path d="M12 4v11" /><path d="M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19.5h14" /></>,
  subir: <><path d="M12 15.5V4.5" /><path d="M7.5 9L12 4.5 16.5 9" /><path d="M5 19.5h14" /></>,
  imagen: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M20 15.5l-4.5-4.5L7 19" /></>,
  globo: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c2.4 2.3 3.6 5 3.6 8s-1.2 5.7-3.6 8c-2.4-2.3-3.6-5-3.6-8s1.2-5.7 3.6-8z" /></>,
  aleatorio: <><path d="M16 4.5h3.5V8" /><path d="M4.5 18.5L19.5 4.5" /><path d="M16 19.5h3.5V16" /><path d="M14.5 14.5l5 5" /><path d="M4.5 5.5l5 5" /></>,
  lapiz: <><path d="M15.5 5.5l3 3L9 18H6v-3z" /><path d="M13.5 7.5l3 3" /></>,
  puntos: <><circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" /></>,
  flecha: <path d="M7 10l5 5 5-5" />,
  enlace: <><path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1-1" /></>,
  usuarios: <><circle cx="9" cy="9" r="3" /><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.6c2.3.1 4 1.5 4.5 4.4" /></>,
  grafico: <><path d="M5 19.5V11M10 19.5V6M15 19.5v-6M20 19.5V9" /></>,
  compartir: <><circle cx="17" cy="6" r="2.3" /><circle cx="7" cy="12" r="2.3" /><circle cx="17" cy="18" r="2.3" /><path d="M9 11l6-3.8M9 13l6 3.8" /></>,
  engrane: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6" /></>,
  navegacion: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M3.5 9h17" /></>,
  ojo: <><path d="M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="2.6" /></>,
  paleta: <><path d="M12 4a8 8 0 1 0 0 16c1.2 0 1.6-.8 1.3-1.7-.4-1.2.4-2.3 1.7-2.3H17a3 3 0 0 0 3-3c0-5-3.6-9-8-9z" /><circle cx="8" cy="11" r="1" /><circle cx="11" cy="7.8" r="1" /><circle cx="15.3" cy="8.6" r="1" /></>,
  fuente: <><path d="M4.5 18.5L9.5 5.5h1l5 13" /><path d="M6.5 14h7" /><path d="M16.5 12.5c.6-.7 1.4-1 2.3-1 1.4 0 2.2.8 2.2 2.2v4.8M21 15.5c-2.6 0-4.5.6-4.5 1.9 0 .9.7 1.3 1.6 1.3 1.6 0 2.9-1.2 2.9-3.2" /></>,
  diseno: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M10 10v10" /></>,
  ajustes: <><path d="M5 7h9M18 7h1M5 17h3M12 17h7" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  marca: <><rect x="4.5" y="4.5" width="15" height="15" rx="3" /><path d="M8.5 15.5V9l3.5 4 3.5-4v6.5" /></>,
  pagina: <><path d="M7 3.5h7l4 4v13H7z" /><path d="M14 3.5v4h4" /></>,
  fondo: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 15l5-5 4 4 2-2 5 5" /></>,
  secciones: <><rect x="4" y="4.5" width="16" height="6" rx="1.5" /><rect x="4" y="13.5" width="16" height="6" rx="1.5" /></>,
  rayo: <path d="M13 3.5L5.5 13.5H12l-1 7 7.5-10H12z" />,
  restablecer: <><path d="M5 12a7 7 0 1 0 2.05-4.95" /><path d="M4.5 4.5v4h4" /></>,
  tema: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><rect x="6.5" y="8" width="11" height="8" rx="1.5" /></>,
};

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, tam = 16, grosor = 1.8, style }: { nombre: string; tam?: number; grosor?: number; style?: CSSProperties }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" style={{ flex: 'none', display: 'block', ...style }}>
      {TRAZOS[nombre] ?? TRAZOS.puntos}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// La hoja
// ─────────────────────────────────────────────────────────────────────────────
// Un string sin backticks a propósito: se sirve tal cual dentro de un <style>.

export const CSS_GMP = [
  // Tokens. `:where` deja la especificidad en cero: si gamma.css (paquete H) define la
  // fuente de `.gma`, gana la suya.
  ':where(.gmp){font-family:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
  '.gmp{--gmp-fondo:#ffffff;--gmp-elevado:#ffffff;--gmp-suave:#f5f5f6;--gmp-hover:#ececed;--gmp-borde:#dfdfe0;--gmp-borde-fuerte:#cacacb;' +
    '--gmp-tinta:#252527;--gmp-texto:#4d4d51;--gmp-tenue:#8b8b90;--gmp-titulo:#002253;--gmp-azul:#0540ad;--gmp-azul-hover:#0740df;' +
    '--gmp-sobre-azul:#ffffff;--gmp-azul-claro:#d0e6fe;--gmp-sobre-azul-claro:#002253;--gmp-azul-linea:#2c88f7;--gmp-ok:#2c8c2c;--gmp-error:#dc2626;' +
    '--gmp-velo:rgba(19,19,20,.48);--gmp-sombra-menu:0 8px 16px rgba(0,0,0,.15);' +
    '--gmp-sombra-caja:0 20px 25px -5px rgba(0,0,0,.12),0 10px 10px -5px rgba(0,0,0,.05);color:var(--gmp-texto);font-size:14px;line-height:1.45;' +
    '-webkit-font-smoothing:antialiased}',
  // Modo oscuro de MaKo: las superficies «elevation» medidas de Gamma.
  '[data-tema="oscuro"] .gmp{--gmp-fondo:#1d1f22;--gmp-elevado:#212327;--gmp-suave:#2f3339;--gmp-hover:#3d444c;--gmp-borde:#3d444c;--gmp-borde-fuerte:#515c68;' +
    '--gmp-tinta:#f5f5f6;--gmp-texto:#dfdfe0;--gmp-tenue:#aeaeb2;--gmp-titulo:#f5f5f6;--gmp-azul:#84c1fa;--gmp-azul-hover:#aad5fe;--gmp-sobre-azul:#002253;' +
    '--gmp-azul-claro:rgba(132,193,250,.18);--gmp-sobre-azul-claro:#d0e6fe;--gmp-velo:rgba(0,0,0,.62);--gmp-sombra-menu:0 8px 16px rgba(0,0,0,.45)}',
  '.gmp *,.gmp *::before,.gmp *::after{box-sizing:border-box}',
  '.gmp button{font-family:inherit}',
  '.gmp :focus-visible{outline:2px solid var(--gmp-azul-linea);outline-offset:2px}',

  // Caja modal
  '.gmp-velo{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--gmp-velo)}',
  '.gmp-modal{display:flex;flex-direction:column;width:100%;max-height:min(90vh,880px);background:var(--gmp-fondo);border-radius:16px;box-shadow:var(--gmp-sombra-caja);overflow:hidden;outline:none}',
  '.gmp-modal-cab{display:flex;align-items:center;gap:10px;padding:20px 24px 12px}',
  '.gmp-modal-tit{flex:1;min-width:0;margin:0;font-size:22px;font-weight:700;line-height:1.25;color:var(--gmp-titulo);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.gmp-modal-cuerpo{flex:1;min-height:0;overflow-y:auto;padding:4px 24px 20px}',
  '.gmp-modal-pie{display:flex;align-items:center;gap:8px;padding:12px 24px 16px;border-top:1px solid var(--gmp-borde)}',
  '.gmp-x{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex:none;border:0;border-radius:50%;background:transparent;color:var(--gmp-texto);cursor:pointer}',
  '.gmp-x:hover{background:var(--gmp-hover)}',

  // Botones (todos píldora, como Chakra con borderRadius full)
  '.gmp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 14px;border:1px solid transparent;border-radius:999px;font-size:14px;font-weight:600;line-height:1;white-space:nowrap;cursor:pointer;text-decoration:none;transition:background .12s,border-color .12s}',
  '.gmp-btn:disabled{opacity:.5;cursor:not-allowed}',
  '.gmp-btn-primario{background:var(--gmp-azul);color:var(--gmp-sobre-azul)}',
  '.gmp-btn-primario:not(:disabled):hover{background:var(--gmp-azul-hover)}',
  '.gmp-btn-secundario{background:var(--gmp-azul-claro);color:var(--gmp-sobre-azul-claro)}',
  '.gmp-btn-contorno{background:transparent;border-color:var(--gmp-borde-fuerte);color:var(--gmp-tinta)}',
  '.gmp-btn-contorno:not(:disabled):hover,.gmp-btn-fantasma:not(:disabled):hover{background:var(--gmp-hover)}',
  '.gmp-btn-fantasma{background:transparent;color:var(--gmp-texto)}',
  '.gmp-btn-peligro{background:transparent;border-color:var(--gmp-error);color:var(--gmp-error)}',
  '.gmp-btn-ancho{width:100%;height:40px}',
  '.gmp-btn-chico{height:28px;padding:0 10px;font-size:13px}',
  '.gmp-icono-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex:none;border:1px solid var(--gmp-borde);border-radius:8px;background:var(--gmp-fondo);color:var(--gmp-texto);cursor:pointer}',
  '.gmp-icono-btn:hover{background:var(--gmp-hover)}',

  // Pestañas y segmentados
  '.gmp-pestanas{display:flex;flex-wrap:wrap;gap:4px}',
  '.gmp-pestana{display:inline-flex;align-items:center;gap:6px;height:32px;padding:4px 16px;border:0;border-radius:8px;background:transparent;color:var(--gmp-titulo);font-size:14px;font-weight:600;cursor:pointer}',
  '.gmp-pestana:hover{background:var(--gmp-hover)}',
  '.gmp-pestana[aria-selected="true"]{background:var(--gmp-azul-claro);color:var(--gmp-sobre-azul-claro)}',
  '.gmp-seg{display:inline-flex;flex-wrap:wrap;gap:2px;padding:3px;border-radius:10px;background:var(--gmp-suave)}',
  '.gmp-seg button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:28px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:var(--gmp-texto);font-size:13px;font-weight:500;cursor:pointer}',
  '.gmp-seg button[aria-pressed="true"]{background:var(--gmp-azul-claro);color:var(--gmp-sobre-azul-claro);font-weight:600}',
  '.gmp-seg-ancho{display:flex}',
  '.gmp-seg-ancho button{flex:1}',
  '.gmp-chip{display:inline-flex;align-items:center;height:28px;padding:0 12px;border:0;border-radius:999px;background:var(--gmp-suave);color:var(--gmp-texto);font-size:13px;font-weight:500;cursor:pointer}',
  '.gmp-chip[aria-pressed="true"]{background:var(--gmp-azul-claro);color:var(--gmp-sobre-azul-claro)}',

  // Interruptor
  '.gmp-sw{position:relative;width:36px;height:20px;flex:none;border:0;border-radius:999px;background:var(--gmp-borde-fuerte);cursor:pointer;transition:background .15s}',
  '.gmp-sw::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}',
  '.gmp-sw[aria-checked="true"]{background:var(--gmp-azul)}',
  '.gmp-sw[aria-checked="true"]::after{transform:translateX(16px)}',
  '.gmp-sw:disabled{opacity:.5;cursor:not-allowed}',

  // Campos
  '.gmp-campo{display:grid;gap:6px;margin:0 0 16px}',
  '.gmp-etq{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0;font-size:13px;font-weight:600;color:var(--gmp-tinta)}',
  '.gmp-contador{font-weight:500;color:var(--gmp-tenue);font-variant-numeric:tabular-nums}',
  '.gmp-contador[data-excede]{color:var(--gmp-error)}',
  '.gmp-ayuda{margin:0;font-size:12px;color:var(--gmp-tenue)}',
  '.gmp-error{margin:0;font-size:12px;color:var(--gmp-error)}',
  '.gmp-ok{margin:0;font-size:12px;color:var(--gmp-ok)}',
  '.gmp-input{width:100%;height:36px;padding:0 12px;border:1px solid var(--gmp-borde);border-radius:6px;background:var(--gmp-fondo);color:var(--gmp-tinta);font:inherit;font-size:14px}',
  '.gmp-input::placeholder{color:var(--gmp-tenue)}',
  '.gmp-input:focus{outline:none;border-color:var(--gmp-azul-linea);box-shadow:0 0 0 1px var(--gmp-azul-linea)}',
  'textarea.gmp-input{height:auto;min-height:76px;padding:8px 12px;resize:vertical;line-height:1.45}',
  '.gmp-fila{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0}',
  '.gmp-fila-texto{display:grid;gap:2px;min-width:0}',
  '.gmp-fila-tit{font-size:14px;font-weight:600;color:var(--gmp-tinta)}',
  '.gmp-sep{height:1px;margin:12px 0;border:0;background:var(--gmp-borde)}',
  '.gmp-grupo-tit{margin:18px 0 10px;font-size:13px;font-weight:700;color:var(--gmp-tinta)}',
  '.gmp-grupo-tit:first-child{margin-top:4px}',

  // Menú (radio 16, ítems de 28 px con radio 6)
  '.gmp-menu{position:fixed;min-width:200px;max-width:min(360px,calc(100vw - 16px));max-height:min(360px,70vh);overflow-y:auto;padding:8px;border:1px solid var(--gmp-borde);border-radius:16px;background:var(--gmp-elevado);box-shadow:var(--gmp-sombra-menu)}',
  '.gmp-menu-item{display:flex;align-items:center;gap:8px;width:100%;min-height:28px;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:var(--gmp-tinta);font-size:14px;font-weight:500;line-height:21px;text-align:left;cursor:pointer}',
  '.gmp-menu-item:hover,.gmp-menu-item[data-activo]{background:var(--gmp-hover)}',
  '.gmp-menu-item[aria-disabled="true"]{opacity:.5;cursor:not-allowed}',
  '.gmp-menu-item-peligro{color:var(--gmp-error)}',
  '.gmp-menu-grupo{padding:8px 8px 4px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--gmp-tenue)}',
  '.gmp-menu-sub{margin-left:auto;font-size:12px;color:var(--gmp-tenue);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45%}',
  '.gmp-selector{display:inline-flex;align-items:center;justify-content:space-between;gap:8px;height:36px;padding:0 10px 0 12px;border:1px solid var(--gmp-borde);border-radius:6px;background:var(--gmp-fondo);color:var(--gmp-tinta);font-size:14px;cursor:pointer;min-width:0}',
  '.gmp-selector>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',

  // Cajón derecho (panel de Tema)
  '.gmp-cajon{position:fixed;top:var(--gma-alto-barra,49px);right:0;bottom:0;display:flex;flex-direction:column;width:360px;max-width:100vw;background:var(--gmp-fondo);border-left:1px solid var(--gmp-borde);box-shadow:-12px 0 32px rgba(0,0,0,.08)}',
  '.gmp-cajon-cab{display:flex;align-items:center;gap:8px;padding:18px 16px 8px 20px}',
  '.gmp-cajon-tit{flex:1;margin:0;font-size:24px;font-weight:700;color:var(--gmp-titulo)}',
  '.gmp-cajon-cuerpo{flex:1;min-height:0;overflow-y:auto;padding:4px 20px 24px}',

  // Popover anclado (estilo de sección)
  '.gmp-pop{position:fixed;width:320px;max-width:calc(100vw - 16px);max-height:min(82vh,680px);overflow-y:auto;padding:14px 14px 16px;border:1px solid var(--gmp-borde);border-radius:12px;background:var(--gmp-elevado);box-shadow:var(--gmp-sombra-caja);outline:none}',
  '.gmp-pop-cab{display:flex;align-items:center;gap:8px;margin-bottom:4px}',
  '.gmp-pop-tit{flex:1;margin:0;font-size:15px;font-weight:700;color:var(--gmp-titulo)}',
  '.gmp-sub{margin:14px 0 8px;font-size:12px;font-weight:600;color:var(--gmp-tenue)}',

  // Muestras de color
  '.gmp-colores{display:flex;flex-wrap:wrap;gap:6px}',
  '.gmp-color{width:28px;height:28px;flex:none;padding:0;border:1px solid rgba(0,0,0,.14);border-radius:50%;cursor:pointer}',
  '.gmp-color[aria-pressed="true"]{box-shadow:0 0 0 2px var(--gmp-elevado),0 0 0 4px var(--gmp-azul-linea)}',
  '.gmp-color-hex{display:flex;align-items:center;gap:8px}',
  '.gmp-color-hex input[type="color"]{width:36px;height:36px;flex:none;padding:2px;border:1px solid var(--gmp-borde);border-radius:6px;background:var(--gmp-fondo);cursor:pointer}',

  // Confirmación
  '.gmp-confirma p{margin:0 0 4px;color:var(--gmp-texto)}',

  // Vacío / cargando
  '.gmp-vacio{padding:24px 8px;text-align:center;color:var(--gmp-tenue);font-size:13px}',
  '.gmp-barra{height:4px;border-radius:999px;background:var(--gmp-hover);overflow:hidden}',
  '.gmp-barra>i{display:block;height:100%;background:var(--gmp-azul);transition:width .2s}',
  '.gmp-giro{width:20px;height:20px;margin:24px auto;border-radius:50%;border:2px solid var(--gmp-borde);border-top-color:var(--gmp-azul);animation:gmp-giro .8s linear infinite}',
  '.gmp-giro-chico{width:14px;height:14px;margin:0;border-width:2px}',
  '@keyframes gmp-giro{to{transform:rotate(360deg)}}',
  '.gmp-campo-img{display:flex;align-items:center;gap:10px}',
  '.gmp-campo-img-vista{display:inline-flex;align-items:center;justify-content:center;flex:none;border:1px solid var(--gmp-borde);border-radius:8px;background:var(--gmp-suave) center/cover no-repeat;color:var(--gmp-tenue)}',
  '@media (max-width:640px){.gmp-modal-cab{padding:16px 16px 10px}.gmp-modal-cuerpo{padding:4px 16px 16px}.gmp-modal-pie{padding:12px 16px}}',
  '@media (prefers-reduced-motion:reduce){.gmp *{transition:none!important}}',
].join('\n');

/** Monta la hoja del paquete. React 19 la deduplica por `href`: la pueden pedir todos. */
export function EstilosGmp({ extra }: { extra?: { href: string; css: string } }) {
  return (
    <>
      <style href="gmp-paneles" precedence="medium">{CSS_GMP}</style>
      {extra && <style href={extra.href} precedence="medium">{extra.css}</style>}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Foco y cierre
// ─────────────────────────────────────────────────────────────────────────────

const FOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Un callback con identidad fija que siempre llama a la última versión del que se pasó. */
export function useFijo<A extends unknown[]>(f: (...a: A) => void): (...a: A) => void {
  const ref = useRef(f);
  useLayoutEffect(() => { ref.current = f; });
  return useCallback((...a: A) => ref.current(...a), []);
}

/**
 * Enfoca `selector` (o la caja) adentro de `caja` cuando la caja YA SE VE, una vez. Con
 * `setTimeout` y no con un cuadro de animación (molde: `useFocoInicial` de
 * app/customer-success/curso/dialogo-foco.ts).
 */
function useFocoAlVerse(caja: RefObject<HTMLElement | null>, selector = '[data-autofoco]') {
  useEffect(() => {
    let intentos = 0;
    let t = 0;
    const intentar = () => {
      const el = caja.current;
      if (el && el.getClientRects().length > 0) {
        const destino = el.querySelector<HTMLElement>(selector) ?? el;
        destino.focus({ preventScroll: true });
        return;
      }
      if (++intentos < 60) t = window.setTimeout(intentar, 16);
    };
    t = window.setTimeout(intentar, 0);
    return () => window.clearTimeout(t);
  }, [caja, selector]);
}

/** El ciclo del Tab adentro de la caja (un modal del que se sale con Tab no es modal). */
function cicloTab(e: KeyboardEvent, caja: HTMLElement | null) {
  if (e.key !== 'Tab' || !caja) return;
  const focables = Array.from(caja.querySelectorAll<HTMLElement>(FOCABLES)).filter((x) => x.getClientRects().length > 0);
  if (!focables.length) return;
  const primero = focables[0];
  const ultimo = focables[focables.length - 1];
  if (e.shiftKey && (document.activeElement === primero || document.activeElement === caja)) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
}

const enCliente = () => typeof document !== 'undefined';

// ─────────────────────────────────────────────────────────────────────────────
// ModalGma: la caja de los diálogos de Gamma (Compartir, Publicar, Configuración…)
// ─────────────────────────────────────────────────────────────────────────────

export function ModalGma({
  titulo, icono, onCerrar, ancho = 640, alto, children, pie, cabecera, etiqueta, anidada = false, ocupado = false,
}: {
  titulo: ReactNode;
  icono?: ReactNode;
  onCerrar: () => void;
  ancho?: number;
  /** Alto FIJO (un valor CSS): para una caja con pestañas que no puede saltar al cambiar de pestaña. */
  alto?: string;
  children: ReactNode;
  pie?: ReactNode;
  /** Lo que va a la derecha del título, antes de la ✕ (el «Publicar en el sitio…» de Compartir). */
  cabecera?: ReactNode;
  etiqueta?: string;
  anidada?: boolean;
  /** Mientras algo corre (una exportación), ni Escape ni el fondo la cierran. */
  ocupado?: boolean;
}) {
  const capa = useCapaModal(true, { anidada });
  const cajaRef = useRef<HTMLDivElement>(null);
  const cerrar = useFijo(() => { if (!ocupado) onCerrar(); });
  const arriba = capa.esElDeArriba;
  useFocoAlVerse(cajaRef);

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (!arriba()) return;
      if (e.key === 'Escape') { e.stopImmediatePropagation(); cerrar(); return; }
      cicloTab(e, cajaRef.current);
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); previo?.focus?.({ preventScroll: true }); };
  }, [arriba, cerrar]);

  if (!enCliente()) return null;
  return createPortal(
    <div className="gma gmp gmp-velo" style={{ zIndex: capa.z, display: capa.visible ? 'flex' : 'none' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <EstilosGmp />
      <div ref={cajaRef} className="gmp-modal" role="dialog" aria-modal="true" aria-label={etiqueta ?? (typeof titulo === 'string' ? titulo : undefined)}
        tabIndex={-1} style={{ maxWidth: ancho, ...(alto ? { height: alto } : null) }}>
        <div className="gmp-modal-cab">
          {icono}
          <h2 className="gmp-modal-tit">{titulo}</h2>
          {cabecera}
          <button type="button" className="gmp-x" onClick={cerrar} aria-label="Cerrar" title="Cerrar"><Icono nombre="cerrar" tam={18} /></button>
        </div>
        <div className="gmp-modal-cuerpo" ref={capa.refScroll}>{children}</div>
        {pie && <div className="gmp-modal-pie">{pie}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirmación (la de Gamma: una frase y dos botones)
// ─────────────────────────────────────────────────────────────────────────────

type PedidoConfirma = { titulo: string; texto: string; boton: string; peligro: boolean; resolver: (v: boolean) => void };

/** `const { confirmar, nodoConfirma } = useConfirmaGma()`; `await confirmar({...})` → true/false. */
export function useConfirmaGma() {
  const [pend, setPend] = useState<PedidoConfirma | null>(null);
  const confirmar = useCallback((p: { titulo: string; texto: string; boton: string; peligro?: boolean }) =>
    new Promise<boolean>((resolver) => setPend({ ...p, peligro: p.peligro !== false, resolver })), []);
  const responder = useFijo((v: boolean) => { pend?.resolver(v); setPend(null); });
  const nodoConfirma = pend ? (
    <ModalGma titulo={pend.titulo} onCerrar={() => responder(false)} ancho={440} anidada
      pie={<>
        <span style={{ flex: 1 }} />
        <button type="button" className="gmp-btn gmp-btn-contorno" onClick={() => responder(false)}>Cancelar</button>
        <button type="button" data-autofoco className={`gmp-btn ${pend.peligro ? 'gmp-btn-peligro' : 'gmp-btn-primario'}`} onClick={() => responder(true)}>{pend.boton}</button>
      </>}>
      <div className="gmp-confirma"><p>{pend.texto}</p></div>
    </ModalGma>
  ) : null;
  return { confirmar, nodoConfirma };
}

// ─────────────────────────────────────────────────────────────────────────────
// Controles
// ─────────────────────────────────────────────────────────────────────────────

export function Interruptor({ activo, onCambiar, etiqueta, deshabilitado }: { activo: boolean; onCambiar: (v: boolean) => void; etiqueta: string; deshabilitado?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} title={etiqueta} className="gmp-sw"
      disabled={deshabilitado} onClick={() => onCambiar(!activo)} />
  );
}

/** Una fila de ajuste: título (y una línea opcional) a la izquierda, el control a la derecha. */
export function FilaAjuste({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <div className="gmp-fila">
      <div className="gmp-fila-texto">
        <span className="gmp-fila-tit">{titulo}</span>
        {ayuda && <p className="gmp-ayuda">{ayuda}</p>}
      </div>
      {children}
    </div>
  );
}

export type OpcionSeg<T extends string> = { valor: T; texto: ReactNode; titulo?: string };

export function Segmentado<T extends string>({ valor, opciones, onCambiar, ancho, etiqueta }: {
  valor: T | null; opciones: readonly OpcionSeg<T>[]; onCambiar: (v: T) => void; ancho?: boolean; etiqueta: string;
}) {
  return (
    <div className={`gmp-seg${ancho ? ' gmp-seg-ancho' : ''}`} role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" aria-pressed={valor === o.valor} title={o.titulo} onClick={() => onCambiar(o.valor)}>{o.texto}</button>
      ))}
    </div>
  );
}

export function Pestanas<T extends string>({ valor, opciones, onCambiar, etiqueta }: {
  valor: T; opciones: readonly { valor: T; texto: string; icono?: string }[]; onCambiar: (v: T) => void; etiqueta: string;
}) {
  return (
    <div className="gmp-pestanas" role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" role="tab" aria-selected={valor === o.valor} className="gmp-pestana" onClick={() => onCambiar(o.valor)}>
          {o.icono && <Icono nombre={o.icono} tam={15} />}{o.texto}
        </button>
      ))}
    </div>
  );
}

export function Campo({ etiqueta, contador, tope, ayuda, error, children, htmlFor }: {
  etiqueta: string; contador?: number; tope?: number; ayuda?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string;
}) {
  return (
    <div className="gmp-campo">
      <label className="gmp-etq" htmlFor={htmlFor}>
        <span>{etiqueta}</span>
        {typeof contador === 'number' && typeof tope === 'number' && (
          <span className="gmp-contador" data-excede={contador > tope ? '' : undefined}>{contador}/{tope}</span>
        )}
      </label>
      {children}
      {error ? <p className="gmp-error">{error}</p> : ayuda ? <p className="gmp-ayuda">{ayuda}</p> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Menú anclado (portaleado y en la pila, como un popover de Chakra)
// ─────────────────────────────────────────────────────────────────────────────

/** Dónde abrir una caja de `ancho`×`alto` junto a `r` sin salirse de la ventana. */
export function posicionJunto(r: DOMRect, ancho: number, alto: number, lado: 'abajo' | 'derecha' = 'abajo'): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const m = 8;
  let left: number;
  let top: number;
  if (lado === 'derecha') {
    left = r.right + m;
    if (left + ancho > vw - m) left = r.left - ancho - m;
    top = r.top;
  } else {
    left = r.left;
    top = r.bottom + 4;
    if (top + alto > vh - m && r.top - alto - 4 > m) top = r.top - alto - 4;
  }
  left = Math.max(m, Math.min(left, vw - ancho - m));
  top = Math.max(m, Math.min(top, vh - Math.min(alto, vh - 2 * m) - m));
  return { left, top };
}

export function MenuGma({ ancla, onCerrar, children, ancho = 240, etiqueta }: {
  ancla: HTMLElement | null; onCerrar: () => void; children: ReactNode; ancho?: number; etiqueta?: string;
}) {
  const capa = useCapaModal(true, { anidada: true });
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = useFijo(onCerrar);
  const arriba = capa.esElDeArriba;
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // El buscador (si hay) recibe el foco cuando el menú ya se ve: `autoFocus` cae sobre
  // algo con `display:none` en el primer render y no llega.
  useFocoAlVerse(ref);

  useLayoutEffect(() => {
    if (!ancla) return;
    const medir = () => {
      const alto = ref.current?.offsetHeight ?? 200;
      setPos(posicionJunto(ancla.getBoundingClientRect(), Math.max(ancho, ancla.offsetWidth), alto));
    };
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => { window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); };
  }, [ancla, ancho]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && arriba()) { e.stopImmediatePropagation(); cerrar(); } };
    // Afuera = ni el menú ni el botón que lo abrió (el botón lo cierra solo con su clic).
    const onAbajo = (e: PointerEvent) => {
      if (!arriba()) return;
      const t = e.target as Node;
      if (ref.current?.contains(t) || ancla?.contains(t)) return;
      cerrar();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onAbajo, true);
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onAbajo, true); };
  }, [ancla, arriba, cerrar]);

  if (!enCliente()) return null;
  return createPortal(
    <div ref={ref} role="menu" aria-label={etiqueta} className="gma gmp gmp-menu"
      style={{ zIndex: capa.z, minWidth: Math.max(ancho, ancla?.offsetWidth ?? 0), left: pos?.left ?? -9999, top: pos?.top ?? -9999, display: capa.visible ? 'block' : 'none' }}>
      <EstilosGmp />
      {children}
    </div>,
    document.body,
  );
}

export type OpcionSelector<T extends string> = { valor: T; texto: string; sub?: string; grupo?: string; estilo?: CSSProperties };

/** El «select» de Gamma: botón con el valor y un menú. Con más de 7 opciones lleva buscador. */
export function SelectorGma<T extends string>({ valor, opciones, onCambiar, etiqueta, ancho, placeholder = 'Elegir', id }: {
  valor: T | null; opciones: readonly OpcionSelector<T>[]; onCambiar: (v: T) => void; etiqueta: string; ancho?: number | string; placeholder?: string; id?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const btn = useRef<HTMLButtonElement>(null);
  const actual = opciones.find((o) => o.valor === valor);
  const conBuscador = opciones.length > 7;
  const visibles = q ? opciones.filter((o) => sinAcentos(o.texto + ' ' + (o.sub ?? '')).includes(sinAcentos(q))) : opciones;
  let grupoPrevio: string | undefined;
  return (
    <>
      <button ref={btn} id={id} type="button" className="gmp-selector" aria-haspopup="menu" aria-expanded={abierto} aria-label={etiqueta}
        style={{ width: ancho ?? '100%' }} onClick={() => { setQ(''); setAbierto((v) => !v); }}>
        <span style={actual?.estilo}>{actual?.texto ?? placeholder}</span>
        <Icono nombre="flecha" tam={14} />
      </button>
      {abierto && (
        <MenuGma ancla={btn.current} onCerrar={() => setAbierto(false)} etiqueta={etiqueta}>
          {conBuscador && (
            <input className="gmp-input" data-autofoco placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)}
              style={{ marginBottom: 6, height: 32 }} />
          )}
          {visibles.map((o) => {
            const cab = o.grupo && o.grupo !== grupoPrevio ? <div className="gmp-menu-grupo">{o.grupo}</div> : null;
            grupoPrevio = o.grupo;
            return (
              <div key={o.valor}>
                {cab}
                <button type="button" role="menuitemradio" aria-checked={o.valor === valor} className="gmp-menu-item"
                  data-activo={o.valor === valor ? '' : undefined} onClick={() => { onCambiar(o.valor); setAbierto(false); }}>
                  <span style={{ width: 16, display: 'inline-flex' }}>{o.valor === valor && <Icono nombre="check" tam={14} />}</span>
                  <span style={o.estilo}>{o.texto}</span>
                  {o.sub && <span className="gmp-menu-sub">{o.sub}</span>}
                </button>
              </div>
            );
          })}
          {!visibles.length && <div className="gmp-vacio">Sin resultados</div>}
        </MenuGma>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Color: muestra + selector nativo de color + hex escrito
// ─────────────────────────────────────────────────────────────────────────────

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Un #rrggbb escrito a mano: acepta sin «#» y en mayúsculas; null si todavía no es uno. */
export function hexEscrito(v: string): string | null {
  const t = v.trim().replace(/^#?/, '#').toLowerCase();
  return HEX.test(t) ? t : null;
}

export function EntradaColor({ valor, onCambiar, etiqueta }: { valor: string; onCambiar: (hex: string) => void; etiqueta: string }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => { setTexto(valor); }, [valor]);
  return (
    <div className="gmp-color-hex">
      <input type="color" aria-label={etiqueta} value={HEX.test(valor) ? valor : '#000000'} onChange={(e) => onCambiar(e.target.value.toLowerCase())} />
      <input className="gmp-input" aria-label={`${etiqueta} (hex)`} value={texto} maxLength={7} spellCheck={false}
        onChange={(e) => { setTexto(e.target.value); const h = hexEscrito(e.target.value); if (h) onCambiar(h); }}
        onBlur={() => setTexto(valor)} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
    </div>
  );
}

/**
 * Un campo de imagen (favicon, logotipo, imagen para compartir, fondo): la vista, «Subir» o
 * «Cambiar» por el selector del editor (Subir · Buscar · Enlace · Biblioteca) y una ✕ para
 * quitarla. Es una ✕ y no el tacho: el archivo sigue en la biblioteca, sólo deja de usarse acá.
 */
export function CampoImagen({ etiqueta, valor, onCambiar, ayuda, ancho = 56, proporcion = '1 / 1' }: {
  etiqueta: string; valor: string | null; onCambiar: (url: string | null) => void; ayuda?: ReactNode; ancho?: number; proporcion?: string;
}) {
  const { elegirImagen } = useEditorLanding();
  const elegir = async () => {
    const url = await elegirImagen({ modo: 'imagen' });
    if (url) onCambiar(url);
  };
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      <div className="gmp-campo-img">
        <span className="gmp-campo-img-vista" style={{ width: ancho, aspectRatio: proporcion, ...(valor ? { backgroundImage: `url("${valor}")` } : null) }}>
          {!valor && <Icono nombre="imagen" tam={18} />}
        </span>
        <button type="button" className="gmp-btn gmp-btn-contorno gmp-btn-chico" onClick={() => void elegir()}>
          <Icono nombre="subir" tam={14} />{valor ? 'Cambiar' : 'Subir'}
        </button>
        {valor && (
          <button type="button" className="gmp-x" aria-label={`Quitar: ${etiqueta}`} title="Quitar" onClick={() => onCambiar(null)}>
            <Icono nombre="cerrar" tam={15} />
          </button>
        )}
      </div>
    </Campo>
  );
}

/** El giro de «cargando» (un texto que dice «Cargando…» no es un loader). */
export function Giro({ chico, etiqueta = 'Cargando' }: { chico?: boolean; etiqueta?: string }) {
  return <span className={`gmp-giro${chico ? ' gmp-giro-chico' : ''}`} role="status" aria-label={etiqueta} style={chico ? { display: 'inline-block' } : { display: 'block' }} />;
}

/** Lo que tarda en dejar de tipear para preguntarle algo al server (el slug). */
export function useRebote<T>(valor: T, ms: number): T {
  const [v, setV] = useState(valor);
  useEffect(() => { const t = window.setTimeout(() => setV(valor), ms); return () => window.clearTimeout(t); }, [valor, ms]);
  return v;
}
