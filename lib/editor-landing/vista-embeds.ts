// =============================================================================
// vista-embeds — lo que el editor MUESTRA en lugar de un embed que adentro de él no puede correr (25/10/2026)
// =============================================================================
// Martín (25/10, sobre la #36): «toda esta sección en blanco, realmente copiaste muy mal a las landing de MaKo... Eso
// significa que no funciona bien el editor web». Medido: una sección de diseño se dibuja en un iframe SIN scripts, así
// que lo que la página publicada arma con JavaScript ahí queda vacío:
//   · la agenda (`[data-calendly]`, la caja blanca de 700 px): en hola-mako.site la llena SCRIPT_DISENO con Calendly;
//   · un reproductor (`iframe` de Panda, YouTube…): adentro de un iframe sin scripts, una caja negra o en blanco.
// En el editor cada uno muestra una FICHA: qué es, su ícono y su enlace, y se cambia con el control de video/agenda.
// ⚠️ La ficha es sólo del editor: la vista la marca (`data-gmx-ui`, el `srcdoc` del iframe) y la saca al guardar
//    (HtmlEditableVista, `leer`). El saneo del server igual borra todo `srcdoc` (html-editable-seguro.ts).
// ⚠️ PURO: lo prueba tests/vista-embeds.test.ts.
// =============================================================================

import { claseDeProveedor, embedDe, nombreDeProveedor } from '../embeds';
import { svgIcono } from './iconos';

export type FichaEmbed = { tipo: 'agenda' | 'video' | 'embed'; nombre: string; enlace: string };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** El enlace como se lee: sin https:// ni la query. */
const corto = (u: string): string => u.replace(/^https?:\/\//, '').replace(/[?#].*$/, '').slice(0, 60);

/** Qué es un embed por su `src`: un video (y de quién), una agenda o algo insertado. */
export function fichaDeEmbed(src: string): FichaEmbed {
  const e = src ? embedDe(src) : null;
  const clase = e ? claseDeProveedor(e.proveedor) : null;
  const de = e ? nombreDeProveedor(e.proveedor) : null;
  if (clase === 'agenda') return { tipo: 'agenda', nombre: `Agenda de ${de ?? 'tu calendario'}`, enlace: corto(src) };
  if (clase === 'video') return { tipo: 'video', nombre: `Video de ${de ?? 'tu reproductor'}`, enlace: corto(src) };
  // El reproductor de Panda de los diseños (`player-vz-…tv.pandavideo.com/embed/`) no lo reconoce `embedDe`, y el saneo lo
  // deja pasar por dominio (DOMINIOS_IFRAME): es el VSL de las páginas de MaKo.
  let host = '';
  try { host = new URL(src).hostname; } catch { host = ''; }
  if (/(^|\.)pandavideo\.com(\.br)?$/i.test(host)) return { tipo: 'video', nombre: 'Video de Panda', enlace: corto(src) };
  return { tipo: 'embed', nombre: de ? `Insertado de ${de}` : 'Contenido insertado', enlace: corto(src) };
}

const ICONO: Record<FichaEmbed['tipo'], string> = { agenda: 'calendario-check', video: 'play-relleno', embed: 'insertar' };

/** El cuerpo de la ficha: ícono, qué es, su enlace y de dónde sale (todo con estilos en línea: va en cualquier diseño). */
function cuerpo(f: FichaEmbed): string {
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100%;min-height:160px;box-sizing:border-box;padding:24px;border-radius:12px;background:#f4f6fb;border:1.5px dashed #b9c3d6;color:#1f2a3d;font:500 15px/1.4 system-ui,sans-serif;text-align:center">`
    + `<span style="display:inline-flex;width:52px;height:52px;align-items:center;justify-content:center;border-radius:50%;background:#2F6FED;color:#fff">${svgIcono(ICONO[f.tipo], 26)}</span>`
    + `<b style="font-size:16px">${esc(f.nombre)}</b>`
    + (f.enlace ? `<span style="color:#5b6472;font-size:13px">${esc(f.enlace)}</span>` : '')
    + `<span style="color:#7a8494;font-size:12px">En la página publicada se ve ${f.tipo === 'agenda' ? 'la agenda' : f.tipo === 'video' ? 'el video' : 'el contenido'}. Para cambiarlo: «Video» en la barrita.</span>`
    + '</div>';
}

/** El `srcdoc` para el iframe de un reproductor en el editor: la ficha, del tamaño del iframe. */
export function srcdocDeFicha(f: FichaEmbed): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%}svg{fill:currentColor}</style></head><body>${cuerpo(f)}</body></html>`;
}

/** La ficha que va ADENTRO de una agenda vacía (`[data-calendly]`), marcada para no guardarse. */
export function fichaDeAgenda(url: string): string {
  return `<div data-gmx-ui="agenda" contenteditable="false" style="height:100%;min-height:200px">${cuerpo({ tipo: 'agenda', nombre: 'Agenda de Calendly', enlace: corto(url) })}</div>`;
}

/** El enlace de Calendly que se guarda en `data-calendly`: la página de la agenda, sin la query del embed. null si no es de Calendly. */
export function enlaceDeCalendly(src: string): string | null {
  try {
    const u = new URL(src);
    if (!/(^|\.)calendly\.com$/i.test(u.hostname)) return null;
    u.search = '';
    u.hash = '';
    return u.href.replace(/\/$/, '');
  } catch { return null; }
}
