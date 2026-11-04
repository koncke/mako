// =============================================================================
// spy-alta-reglas — lo PURO del buscador de «Mirar a alguien más» (3/11/2026)
// =============================================================================
// Martín, 3/11: «No se mejoró ni el modal, sigue horrible el diseño... Y no tiene sentido que tenga 2
// tabs... La tab de "pegar un dato" no tiene sentido, eliminala». Queda UN campo. Lo que se escribe decide
// qué se ofrece, y esa decisión vive acá porque es lo que se puede ejecutar en un test: la pantalla
// (app/competitor-spy/BuscadorAlta.tsx) sólo dibuja.
//
// ⚠️ TODO LO DE ACÁ CUIDA UN TOPE. Cada búsqueda y cada perfil leído gastan de `APIFY_TOPE_POR_DIA`, y si se
// agota nadie del negocio puede agregar a nadie hasta mañana.
// =============================================================================

import { usuarioDeTexto, alcanzaParaBuscar, usuariosCandidatos, type PerfilIg } from './instagram-buscar';
import { queEs } from './spy-que-es';
import { dominioComparable, nombreComparable } from './spy-reglas';

/** Cuántas filas se completan solas con su foto y su nombre. Las que siguen muestran su @. */
export const PRIMERAS_QUE_SE_COMPLETAN = 5;

/**
 * Las lecturas del tope diario que el completar solo NO puede tocar: quedan para quien aprieta «agregar».
 * Con el tope de 40 y una búsqueda que gasta hasta 6 (ella y sus 5 filas), alcanza para unas cuatro búsquedas
 * completas por día; después las filas muestran el @ y agregar sigue andando.
 */
export const RESERVA_DEL_ALTA = 15;

/** La espera antes de completar: quien sigue escribiendo no gasta lecturas en una lista que ya no mira. */
export const ESPERA_COMPLETAR_MS = 700;

export type CampoDirecto = 'youtube_id' | 'tiktok' | 'landing_url';

/** Lo que se ofrece sin buscar: un enlace ya dice qué es. */
export type OpcionDirecta = { campo: CampoDirecto; valor: string; grupo: string; titulo: string; detalle: string };

export type QueSeHace =
  | { que: 'nada' }
  /**
   * Un nombre o un @: se busca en Instagram. `consulta` es lo que viaja: un link de su perfil se manda como su @. Mandado
   * tal cual, la ruta lo tomaba por un NOMBRE y gastaba una búsqueda de 20 s en un enlace que ya decía quién es.
   */
  | { que: 'buscar'; consulta: string }
  /** Un canal de YouTube, un TikTok o un sitio. `tambienUsuario`: «acme.com» también puede ser el @ de alguien. */
  | { que: 'directo'; opcion: OpcionDirecta; tambienUsuario: string | null }
  /** Un enlace que no se puede resolver (un `/c/<alias>` de YouTube no tiene endpoint). */
  | { que: 'no-reconocido' };

const sinProtocolo = (s: string) => s.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

/**
 * Qué hacer con lo escrito. UN SOLO CAMINO: un canal de YouTube o un sitio van por el mismo campo que un nombre
 * y por la misma confirmación, y no gastan una búsqueda de Instagram que no los puede encontrar.
 */
export function queSeHace(texto: string): QueSeHace {
  const t = (texto ?? '').trim();
  if (!t) return { que: 'nada' };
  const l = queEs(t);
  if (!l) return { que: 'no-reconocido' };
  if (l.campo === 'instagram' || l.campo === 'nombre') {
    const consulta = l.campo === 'instagram' ? `@${l.valor}` : t;
    return alcanzaParaBuscar(consulta) ? { que: 'buscar', consulta } : { que: 'nada' };
  }
  const tambienUsuario = /^https?:\/\//i.test(t) ? null : usuarioDeTexto(t);
  if (l.campo === 'youtube_id') {
    return { que: 'directo', tambienUsuario: null, opcion: { campo: l.campo, valor: l.valor, grupo: 'YouTube', titulo: 'Su canal de YouTube', detalle: sinProtocolo(t) } };
  }
  if (l.campo === 'tiktok') {
    return { que: 'directo', tambienUsuario: null, opcion: { campo: l.campo, valor: l.valor, grupo: 'TikTok', titulo: `@${l.valor}`, detalle: 'Su TikTok' } };
  }
  return { que: 'directo', tambienUsuario, opcion: { campo: l.campo, valor: l.valor, grupo: 'Sitio', titulo: sinProtocolo(l.valor), detalle: 'Su sitio' } };
}

/**
 * El @ que sale de pegar el nombre («Leila Hormozi» → leilahormozi), si lo escrito es un nombre.
 *
 * ⚠️ MEDIDO EL 3/11/2026 EN PRODUCCIÓN: buscando «leila hormozi» Apify trajo @leila.hormozi.1368, @leihormoz,
 * @leillahormozi y @leila_hormozi63, y a la verdadera NO. @leilahormozi existe y se lee en 5 s. No se inventa nada:
 * la fila aparece sólo si esa cuenta existe, y la persona igual la confirma.
 */
export function usuarioDelNombre(texto: string): string | null {
  if (usuarioDeTexto(texto)) return null;
  return usuariosCandidatos(texto)[0] ?? null;
}

/**
 * Qué filas se mandan a completar: las primeras que no tienen foto o nombre y que todavía no se pidieron.
 *
 * ⚠️ `yaPedidos` ES LO QUE EVITA PAGAR DOS VECES: sin esto, borrar una letra y volver a escribirla gasta otra
 * tanda entera. Y lo que ya vino con foto y nombre no se lee: no hay nada que completar.
 */
export function cualesCompletar(perfiles: readonly PerfilIg[], yaPedidos: ReadonlySet<string>, delNombre: string | null = null): string[] {
  const faltan = perfiles.slice(0, PRIMERAS_QUE_SE_COMPLETAN).filter((p) => !p.foto || !p.nombre).map((p) => p.usuario);
  const conNombre = delNombre && !perfiles.some((p) => p.usuario === delNombre) ? [delNombre, ...faltan] : faltan;
  return conNombre.filter((u) => !yaPedidos.has(u)).slice(0, PRIMERAS_QUE_SE_COMPLETAN);
}

type Mirado = { nombre: string; instagram?: string | null; youtube_id?: string | null; tiktok?: string | null; landing_url?: string | null };

/**
 * ¿Lo escrito en la barra de arriba es este competidor? Por su nombre, o por cualquiera de sus canales pegado entero.
 * `titulo` = el nombre que muestra su tarjeta, que puede no ser el guardado (`nombreDeTarjeta`): se busca lo que se ve.
 */
export function coincideCompetidor(c: Mirado, texto: string, titulo?: string): boolean {
  const n = nombreComparable(texto);
  if (!n) return !texto.trim();
  if ([c.nombre, titulo ?? '', c.instagram ?? '', c.tiktok ?? ''].some((x) => nombreComparable(x).includes(n))) return true;
  const l = queEs(texto);
  if (l?.campo === 'instagram') return (c.instagram ?? '').toLowerCase() === l.valor;
  if (l?.campo === 'tiktok') return (c.tiktok ?? '').toLowerCase() === l.valor.toLowerCase();
  if (l?.campo === 'youtube_id') return c.youtube_id === l.valor;
  if (l?.campo === 'landing_url') return !!c.landing_url && dominioComparable(c.landing_url) === dominioComparable(l.valor);
  return false;
}
