// =============================================================================
// «Editar en el editor»: de un anuncio de MaKo a un proyecto del Video Editor
// =============================================================================
// Video Generator abre `/video-editor/nuevo?desde=<ref>`. La ref NOMBRA el video,
// no lo trae: la url la arma el server desde los datos del workspace de la sesión
// (./resolver.ts) y al navegador baja sólo lo que hace falta para dibujarlo. Es
// la misma regla que el selector de creativos de Ads Manager (lib/creativo-mako.ts,
// «LA URL SE DERIVA, NO SE VALIDA CONTRA UN PREFIJO»): el bucket es público y su
// ruta no lleva el workspace, así que aceptar una url del navegador dejaría abrir
// el anuncio de otro cliente.
//
// Las refs que se aceptan:
//   · `montaje:<id>` y `toma:<plan>:<n>:<op>` — las de lib/creativo-mako.ts, tal
//     cual (leerRefCreativo), resueltas con el MISMO resolvedor que Ads Manager;
//   · `anuncio:<id>` — una fila de «Anuncios terminados» de Video Generator
//     (app/video-generator/anuncios-datos.ts), que no son montajes: son los
//     cargados a mano en el setting del workspace.
//
// SIN `server-only` a propósito: lo importan la page (server), el botón de Video
// Generator (cliente) y los tests.
// =============================================================================

import { leerRefCreativo, refDeCreativo } from '@/lib/creativo-mako';

/** Lo que la page del editor le pasa al cliente: SÓLO esto (frontera de datos). */
export type DesdeEditor =
  | {
    estado: 'listo';
    /** La ref ya normalizada: la usa el cliente para no importar dos veces lo mismo. */
    ref: string;
    /** El nombre del proyecto nuevo. */
    titulo: string;
    /** El nombre del archivo en la biblioteca (Multimedia). */
    archivo: string;
    /** De dónde se baja el mp4. La armó el server; el navegador no la elige. */
    url: string;
  }
  /** La ref tiene forma pero no hay nada con ese nombre en este workspace. */
  | { estado: 'no-esta' }
  /** No se pudo leer la base: no es «no existe», y se dice distinto. */
  | { estado: 'error' };

/** El id de una fila de «Anuncios terminados». Acotado: viaja por la URL. */
const ANUNCIO_OK = /^anuncio:([A-Za-z0-9_-]{1,64})$/;

export type RefDesde =
  | { origen: 'anuncio'; id: string }
  | { origen: 'creativo'; ref: NonNullable<ReturnType<typeof leerRefCreativo>> };

/** Lee el `?desde=`. null = no tiene la forma de ninguna ref. */
export function leerRefDesde(v: unknown): RefDesde | null {
  if (typeof v !== 'string' || v.length > 256) return null;
  const a = ANUNCIO_OK.exec(v);
  if (a) return { origen: 'anuncio', id: a[1] };
  const ref = leerRefCreativo(v);
  return ref ? { origen: 'creativo', ref } : null;
}

/** La ref, escrita de vuelta (la forma canónica). */
export function refDesdeTexto(r: RefDesde): string {
  return r.origen === 'anuncio' ? `anuncio:${r.id}` : refDeCreativo(r.ref);
}

/** La ruta que abre el editor con ese video. El `?ws=` lo pega el Link de la casa. */
export function rutaEditarEnEditor(ref: string): string {
  return `/video-editor/nuevo?desde=${encodeURIComponent(ref)}`;
}
