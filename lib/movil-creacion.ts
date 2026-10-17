// =============================================================================
// MaKo Mobile — las tabs de CREACIÓN en el teléfono (17/10/2026)
// =============================================================================
// Pedido de Martín (17/10/2026, desde el Centro de Operaciones): «Implementa completamente MaKo Mobile en todas
// las tabs, porque hay muchas que aun no se pueden acceder… Siempre copia de otras apps que ya lo hacen bien».
// Hasta ese día, un teléfono que abría /video-editor, /image-editor, /reels, /stories, /carousels o /ai-avatar veía
// la cubierta «Esta pantalla se usa en la computadora». (Las «Coming soon» tienen la pantalla de «Mobile 2»,
// /m/pronto/<key>: no son de acá.)
//
// Una cosa, un lugar: acá vive QUÉ pantallas de creación tiene el teléfono y su ida y vuelta con escritorio.
// lib/movil-rutas.ts lo suma a su mapa (SECCIONES_MAS, `rutaMovil`, `rutaEscritorio`) con una línea cada uno.
//
// ⚠️ LA CARPETA DE app/m SE LLAMA COMO LA RUTA DE ESCRITORIO (/reels ↔ app/m/reels): la ida y la vuelta son
// sacar o poner «/m», y una pantalla nueva es una entrada en `RUTAS_CREACION` y su carpeta. El único nombre que
// no es su ruta es la fila «Image» de More (la tab unificada), que abre su Editor (/m/image-editor).
//
// ⚠️ SIN IMPORTS DE VALORES DE ./movil-rutas: ese módulo importa ÉSTE al cargarse (sus SECCIONES_MAS esparcen
// `SECCIONES_CREACION`), y un import de vuelta deja la lista en `undefined` según quién cargue primero. Lo que
// necesita las dos cosas (la barra de secciones de cada tab) vive en app/m/_creacion/secciones.ts.
// =============================================================================

import type { DefSeccionMas } from './movil-rutas';

/** Las pantallas de creación del teléfono con fila en SECCIONES_MAS (OCULTA, menos «image», que es fila de More). */
export type IdCreacion = 'image' | 'video-editor' | 'reels' | 'stories' | 'carousels';

/**
 * Las filas OCULTAS de More (`oculta: true`): no son filas ni suben a la barra, pero le dan a cada pantalla su
 * cabecera (el nombre, «‹ More»), el título de la pestaña y la puerta de su `page.tsx` (`requireMovil({ navKey })`
 * con la key EXACTA de nav.ts que pide su página de escritorio). En el orden de la sidebar de escritorio.
 *
 * Por qué ninguna es fila de More: Video Editor y Reels son secciones de la tab Video (la fila «Video» de More),
 * Carousels de la fila «Image», y Stories de «Copywriting»; se alcanzan desde la barra de secciones de arriba de su
 * tab (app/m/_ui/SeccionesTabM.tsx), como en escritorio.
 *
 * ⚠️ AI AVATAR NO TIENE FILA ACÁ, A PROPÓSITO: es `adminOnly` (sólo el super admin) y `puedeVerKey` no mira eso. More
 * (`masCompleto`, lib/movil-rutas.ts) le arma su fila desde la sidebar con la regla de la sidebar, por su ruta
 * (`rutaMovil('/ai-avatar')`), y una fila oculta con su key se la BORRARÍA («tiene sección en el teléfono»). Su
 * cabecera la pone cada page (`<CabeceraM>`).
 *
 * Las «Coming soon» (Image Generator, Thumbnails, Ideas, YouTube Writer, VSL Generator…) tampoco: tienen la pantalla
 * de «Mobile 2» (/m/pronto/<key>), que se deriva de nav.ts, y la barra de secciones las lleva ahí.
 */
export const SECCIONES_CREACION: readonly DefSeccionMas[] = [
  // Video (tab unificada): Editor · Create with AI (la fila «Video», /m/video) · Reels.
  { id: 'video-editor', label: 'Video Editor', href: '/m/video-editor', icon: 'tijera', navKey: 'video-editor', familia: null, oculta: true },
  { id: 'reels', label: 'Reels', href: '/m/reels', icon: 'videogen', navKey: 'reels', familia: null, oculta: true },
  // Image (tab unificada; su Editor es la fila «Image» de More): Carousels.
  { id: 'carousels', label: 'Carousels', href: '/m/carousels', icon: 'carousel', navKey: 'carousels', familia: null, oculta: true },
  // Copywriting (tab unificada; su Ads Writer es la fila «Copywriting»): Stories.
  { id: 'stories', label: 'Stories', href: '/m/stories', icon: 'stories', navKey: 'stories', familia: null, oculta: true },
];

/**
 * Las rutas de ESCRITORIO de creación que tienen pantalla en el teléfono, con lo que cada una lee de la query (y
 * que por eso viaja al llevar un link al teléfono: un push vuelve a la computadora por `rutaEscritorio`).
 *   · `sub`: las subrutas que también tienen pantalla. `'*'` = un segmento cualquiera (el id de un proyecto o de un
 *     diseño), salvo los de `noSub` (el presentador del Image Editor es una ventana de escritorio).
 *   · `alias`: rutas viejas que en escritorio sólo redirigen (hoy ninguna; /vsl-writer era de las «pronto»).
 */
type RutaCreacion = {
  base: string;
  query?: readonly string[];
  sub?: '*' | readonly string[];
  noSub?: readonly string[];
  /** La query que lee cada subruta, si no es la de la base (`/ai-avatar/avatares?plantilla=`). */
  querySub?: Readonly<Record<string, readonly string[]>>;
  alias?: readonly string[];
};

export const RUTAS_CREACION: readonly RutaCreacion[] = [
  // `?desde=` = «Editar en el editor» de Video Generator y de AI Avatar; `?plantilla=` = «Utilizar plantilla»
  // (app/video-editor/[proyecto]/page.tsx).
  { base: '/video-editor', sub: '*', querySub: { '*': ['desde', 'plantilla'] } },
  // /image-editor/presentador es la ventana del presentador: se queda en la computadora.
  { base: '/image-editor', sub: '*', noSub: ['presentador'] },
  // app/ai-avatar/page.tsx lee `avatar` y `plantilla`; avatares/page.tsx, `plantilla`.
  { base: '/ai-avatar', query: ['avatar', 'plantilla'], sub: ['avatares', 'voces', 'plantillas'], querySub: { avatares: ['plantilla'] } },
  { base: '/reels' },
  { base: '/stories' },
  { base: '/carousels' },
  // Copy Method (Copywriting › Method), la herramienta del super admin: su carpeta es app/m/admin/copywriting.
  { base: '/admin/copywriting' },
];

const conQuery = (path: string, q: URLSearchParams, claves: readonly string[] | undefined): string => {
  const out = new URLSearchParams();
  for (const k of claves ?? []) {
    const v = q.get(k);
    if (v != null && v !== '') out.set(k, v);
  }
  const s = out.toString();
  return s ? `${path}?${s}` : path;
};

/**
 * El equivalente MÓVIL de una ruta de escritorio de creación (`/reels` → `/m/reels`), con la query que su página
 * de escritorio lee; null si no es de creación o esa subruta no tiene pantalla en el teléfono. Recibe el path ya
 * limpio (sin barra final, sin query) y la query aparte: lo llama `rutaMovil` (lib/movil-rutas.ts).
 */
export function rutaMovilCreacion(p: string, q: URLSearchParams): string | null {
  for (const r of RUTAS_CREACION) {
    const alias = (r.alias ?? []).find((a) => p === a || p.startsWith(a + '/'));
    if (alias) return conQuery(`/m${r.base}`, q, r.query);
    if (p === r.base) return conQuery(`/m${r.base}`, q, r.query);
    if (!p.startsWith(r.base + '/') || !r.sub) continue;
    const resto = p.slice(r.base.length + 1);
    if (!resto || resto.includes('/') || (r.noSub ?? []).includes(resto)) return null;
    if (r.sub === '*') return conQuery(`/m${p}`, q, r.querySub?.['*']);
    if (r.sub.includes(resto)) return conQuery(`/m${p}`, q, r.querySub?.[resto]);
    return null;
  }
  return null;
}

/**
 * La ruta de ESCRITORIO de una pantalla de creación del teléfono (`/m/reels` → `/reels`), sin query (la de la
 * URL viaja tal cual: la pone `rutaEscritorio`); null si no es de creación.
 */
export function rutaEscritorioCreacion(p: string): string | null {
  if (!p.startsWith('/m/')) return null;
  const desktop = p.slice('/m'.length);
  const r = RUTAS_CREACION.find((x) => desktop === x.base || desktop.startsWith(x.base + '/'));
  if (!r) return null;
  // La vuelta acepta exactamente lo que acepta la ida: así una ruta /m inventada no se «traduce» a otra.
  return rutaMovilCreacion(desktop, new URLSearchParams()) === p ? desktop : null;
}
