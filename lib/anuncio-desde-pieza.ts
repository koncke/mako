// =============================================================================
// «Usar en un anuncio» — de una pieza de Create a la propuesta de una campaña (PURO: lo prueban los tests)
// =============================================================================
// Lo prometido a la agencia de Thiago (llamada del 29/10/2026, docs/promesas/2910-llamada-thiago.md, [30:17] y [31:25]): «crea,
// publica y optimiza solo» y «anuncios hechos con el avatar del cliente». Al lado de «Publicar en redes» (que lleva la pieza al
// Calendario), los editores (Video, Image, Copywriter) y el AI Avatar tienen «Usar en un anuncio»: la pieza va a la página
// /anuncio/nuevo, que arma la campaña y la PROPONE por la API de MaKo (`proponer_crear_campana`). Lanzarla sigue pidiendo la
// confirmación de una persona en /mako/revisar: este camino no crea nada en Meta por su cuenta.
//
// La pieza viaja en la dirección (como «Publicar» lleva su evento abierto): no hay un borrador guardado aparte.
//   · un archivo exportado en el navegador → subido al staging de anuncios (el mismo de «Subir creativos»): `archivo` + `media`;
//   · un video que MaKo ya generó → su referencia de lib/creativo-mako.ts (`ref`), o el plan y la toma del AI Avatar (`plan`,
//     `toma`), que la página resuelve a la ref del clip de HOY y lo muestra: lo que se ve es lo que sale;
//   · el texto (el guion del Copywriter, lo que dice el avatar) → el texto principal, que la persona corrige antes de proponer.
// Nada de esto se cree: la página lo vuelve a resolver en el negocio de la sesión, y la API lo vuelve a validar al proponer y
// al confirmar.
//
// Sin `server-only` y sin imports de valores con estado: lo usan la página, el cliente de los editores y los tests.
// =============================================================================

import { esPathDeStaging } from './ads-staging';
import { leerRefCreativo } from './creativo-mako';

/** De dónde sale la pieza (el rótulo de la página y el nombre por defecto de la campaña). */
export const ORIGENES_PIEZA = ['copywriter', 'image', 'video', 'avatar'] as const;
export type OrigenPieza = (typeof ORIGENES_PIEZA)[number];
export const NOMBRE_ORIGEN: Record<OrigenPieza, string> = { copywriter: 'Copywriter', image: 'Image Editor', video: 'Video Editor', avatar: 'AI Avatar' };

/** El tope del texto principal en la API (`proponer_crear_campana.texto`). */
export const TOPE_TEXTO_ANUNCIO = 2000;
/** El nombre de una campaña (`proponer_crear_campana.nombre`). */
const TOPE_NOMBRE = 200;

/** El creativo de la pieza, como lo entiende la página. */
export type CreativoDePieza =
  | { tipo: 'archivo'; path: string; media: 'imagen' | 'video' }
  | { tipo: 'generado'; ref: string }
  /** Una toma del AI Avatar: la página la resuelve al clip de hoy (y a su ref). */
  | { tipo: 'toma'; plan: string; toma: number };

export type PiezaParaAnuncio = {
  origen: OrigenPieza;
  titulo: string;
  texto: string;
  creativo: CreativoDePieza | null;
};

const PLAN_OK = /^[A-Za-z0-9-]{1,64}$/;
const una = (v: string | string[] | undefined | null): string => (Array.isArray(v) ? v[0] ?? '' : v ?? '');
const recortar = (s: string, max: number): string => Array.from(s.trim()).slice(0, max).join('');

/**
 * La pieza que pide la dirección de /anuncio/nuevo. Lo que no tiene la forma que corresponde se descarta (un path que no es
 * del staging, una ref inventada, un plan con barras): la página dice entonces que falta el creativo, nunca usa lo de afuera.
 */
export function leerPieza(q: Record<string, string | string[] | undefined>): PiezaParaAnuncio {
  const o = una(q.origen);
  const origen = (ORIGENES_PIEZA as readonly string[]).includes(o) ? (o as OrigenPieza) : 'video';
  const archivo = una(q.archivo);
  const ref = una(q.ref);
  const plan = una(q.plan);
  const toma = Number(una(q.toma));
  let creativo: CreativoDePieza | null = null;
  if (archivo && esPathDeStaging(archivo)) creativo = { tipo: 'archivo', path: archivo, media: una(q.media) === 'video' ? 'video' : 'imagen' };
  else if (ref && leerRefCreativo(ref)) creativo = { tipo: 'generado', ref };
  else if (plan && PLAN_OK.test(plan) && Number.isInteger(toma) && toma > 0 && toma <= 999) creativo = { tipo: 'toma', plan, toma };
  return { origen, titulo: recortar(una(q.titulo), 120), texto: recortar(una(q.texto), TOPE_TEXTO_ANUNCIO), creativo };
}

/** La dirección de /anuncio/nuevo para una pieza (la arman los editores al tocar «Usar en un anuncio»). */
export function rutaUsarEnAnuncio(p: { origen: OrigenPieza; titulo?: string | null; texto?: string | null; creativo?: CreativoDePieza | null }): string {
  const u = new URLSearchParams({ origen: p.origen });
  if (p.titulo?.trim()) u.set('titulo', recortar(p.titulo, 120));
  if (p.texto?.trim()) u.set('texto', recortar(p.texto, TOPE_TEXTO_ANUNCIO));
  const c = p.creativo;
  if (c?.tipo === 'archivo') { u.set('archivo', c.path); u.set('media', c.media); }
  else if (c?.tipo === 'generado') u.set('ref', c.ref);
  else if (c?.tipo === 'toma') { u.set('plan', c.plan); u.set('toma', String(c.toma)); }
  return `/anuncio/nuevo?${u.toString()}`;
}

/** El nombre de la campaña de partida: el de la pieza, o de dónde salió. La persona lo cambia. */
export function nombreSugerido(p: Pick<PiezaParaAnuncio, 'origen' | 'titulo'>): string {
  return recortar(p.titulo || `Anuncio desde ${NOMBRE_ORIGEN[p.origen]}`, TOPE_NOMBRE);
}

/** Lo que la persona completa en la página. Los montos y los ids vienen como los escribió o eligió. */
export type FormularioCampana = {
  nombre: string;
  objetivo: string;
  presupuestoDia: number | null;
  formularioId: string;
  pixelId: string;
  evento: string;
  url: string;
  hasta: string;
  lugares: unknown[];
  texto: string;
  titulo: string;
  boton: string;
};

/**
 * La entrada de `proponer_crear_campana` (sus parámetros planos, los mismos que pinta /mako/revisar). Sólo con un creativo ya
 * resuelto (`archivo` o `generado`): una toma sin resolver no se propone.
 */
export function entradaParaProponer(f: FormularioCampana, c: Exclude<CreativoDePieza, { tipo: 'toma' }>): Record<string, unknown> {
  const v = (s: string) => (s.trim() ? s.trim() : undefined);
  const e: Record<string, unknown> = {
    nombre: recortar(f.nombre, TOPE_NOMBRE), objetivo: f.objetivo, presupuestoDia: f.presupuestoDia ?? undefined,
    texto: recortar(f.texto, TOPE_TEXTO_ANUNCIO), titulo: v(f.titulo), boton: v(f.boton), url: v(f.url), hasta: v(f.hasta),
    lugares: Array.isArray(f.lugares) ? f.lugares : [],
  };
  if (f.objetivo === 'formulario') e.formularioId = v(f.formularioId);
  if (f.objetivo === 'web' || f.objetivo === 'compras') e.pixelId = v(f.pixelId);
  if (f.objetivo === 'web') e.evento = v(f.evento);
  if (c.tipo === 'archivo') Object.assign(e, { creativoTipo: 'archivo', archivoPath: c.path, archivoMedia: c.media });
  else Object.assign(e, { creativoTipo: 'generado', creativoRef: c.ref });
  for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k];
  return e;
}

/**
 * Lo que la página dice de publicar por Zernio mientras no está probado con una cuenta real (`ZERNIO_ANUNCIOS_PROBADO`,
 * lib/zernio-ads-cuerpo.ts): una frase, o nada. La bandera la prende la prueba de Martín, no esta pantalla.
 */
export function avisoDeZernio(probado: boolean): string | null {
  return probado ? null : 'Publicar por Zernio todavía no se probó con una cuenta real: la campaña nace en pausa y Meta puede rechazar el anuncio.';
}
