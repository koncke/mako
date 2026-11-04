// =============================================================================
// diseno-elementos — qué elemento de un «Diseño editable» se eligió con un clic, y cómo se le cambia lo suyo (25/10/2026)
// =============================================================================
// Martín (25/10, ~15:10): «en las landing de MaKo, quiero que TODO sea editable, cada botón, cada video, cada cosa que
// hay... Para eso ya tenemos casi todo construido de funcionalidades dentro del editor». Cada elemento se edita con el
// control que el editor YA tiene para ese tipo, como si fuera un bloque:
//   · un botón o un enlace (`a`): a dónde lleva, con `SelectorDestino` (el del botón de un bloque);
//   · una imagen (`img`): el selector de imágenes de siempre (`ctx.elegirImagen`);
//   · un video: si es `<video>`, el mismo selector en modo video (el del bloque Video); si es un reproductor (`iframe`
//     de Panda, YouTube…) o la agenda (`[data-calendly]`), el panel «Pegar una URL» del bloque Insertar (`embedDe`);
//   · un ícono (`svg`): el selector de íconos (`SelectorIcono`) y `svgIcono`, con el tamaño y la clase del que estaba.
// El texto se escribe directo (el documento es `contentEditable`).
//
// ⚠️ Un `iframe` o un `video` del diseño no recibe el clic en el editor (`pointer-events: none` adentro del documento,
//    HtmlEditableVista.tsx): si no, el clic se lo traga el reproductor. Por eso se eligen por su CAJA: el que contiene
//    el punto del clic.
// ⚠️ Sin `window` ni `document` globales: todo llega por parámetro (el documento es el del iframe). Lo prueba
//    tests/diseno-elementos.test.ts.
// =============================================================================

export type TipoElemento = 'enlace' | 'imagen' | 'video' | 'icono';

/** El tipo de un elemento del diseño por su etiqueta, o null si no tiene control propio (el texto se escribe directo). */
export function tipoDeElemento(el: { tagName?: string; getAttribute?: (n: string) => string | null } | null | undefined): TipoElemento | null {
  // La agenda de un diseño (`[data-calendly]`, una caja que la página publicada llena con Calendly) se cambia con el
  // mismo control que un reproductor: «Video», pegando el enlace.
  if (el?.getAttribute?.('data-calendly') != null) return 'video';
  // Un `<button>` (o algo con `role="button"`) es un botón para la persona (28/10/2026, la réplica editable): se le cambia
  // el texto, los colores y a dónde lleva (al ponerle destino pasa a ser un `<a>`: diseno-elemento-acciones.ts → comoEnlace).
  if (el?.getAttribute?.('role') === 'button') return 'enlace';
  switch (String(el?.tagName ?? '').toLowerCase()) {
    case 'a': case 'button': return 'enlace';
    case 'img': return 'imagen';
    case 'iframe': case 'video': return 'video';
    case 'svg': return 'icono';
    default: return null;
  }
}

type Caja = { left: number; right: number; top: number; bottom: number };
type ElementoMin = { tagName?: string; getAttribute?: (n: string) => string | null; closest?: (sel: string) => ElementoMin | null; getBoundingClientRect?: () => Caja };
type DocumentoMin = { querySelectorAll: (sel: string) => ArrayLike<ElementoMin> };

/**
 * El elemento que eligió un clic en (x, y) del documento del diseño: el ícono, la imagen o el enlace más cercano hacia
 * arriba desde lo tocado (un ícono adentro de un botón elige el ícono; el texto del botón, el botón), o el video cuya caja
 * contiene el punto. null = texto suelto.
 */
export function elementoEnPunto(doc: DocumentoMin, tocado: ElementoMin | null, x: number, y: number): ElementoMin | null {
  // La agenda primero: su ficha del editor (vista-embeds.ts) trae un ícono que, si no, se elegiría como ícono.
  const agenda = tocado?.closest?.('[data-calendly]') ?? null;
  if (agenda) return agenda;
  const directo = tocado?.closest?.('svg, img, a, button, [role="button"]') ?? null;
  if (directo) return directo;
  const videos = doc.querySelectorAll('iframe, video');
  for (let i = 0; i < videos.length; i++) {
    const r = videos[i].getBoundingClientRect?.();
    if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return videos[i];
  }
  return null;
}

/** Lo que dice el aviso cuando se toca un control sin haber elegido su elemento. */
export const PIDE_ELEGIR: Readonly<Record<TipoElemento, string>> = {
  enlace: 'Elige un botón o un enlace',
  imagen: 'Elige una imagen',
  video: 'Elige un video',
  icono: 'Elige un ícono',
};
