// =============================================================================
// publicacion-cron — ELEGIR LA PUBLICACIÓN O EL REEL del CRON de comentario (ticket #25 de Leandro, 29/10/2026)
// =============================================================================
// Leandro (Fiesta Music, ws10): «que el flujo arranque solo cuando el comentario contiene una palabra… y, si se puede,
// elegir en qué publicación o Reel». Las palabras clave ya estaban (#17, lib/palabras-clave.ts); faltaba la publicación.
// Como ManyChat: «Cualquier publicación» por defecto, o una de las últimas.
//
// DE DÓNDE SALE CADA ID (OpenAPI de Zernio v1.416.0, leída el 29/10/2026):
//   · el comentario trae `comment.platformPostId`, el id NATIVO de la publicación (lib/canal-social.ts lo lee como
//     `postId`, y la conversación lo guarda en `comentario_post_id`);
//   · la lista sale de GET /v1/accounts/{accountId}/posts: «the 25 most recent posts that exist on the platform…
//     including posts that were never created through Zernio», con `id` = «The platform's own post id». El MISMO.
// Se guarda el id y un texto corto (el comienzo del texto de la publicación) para que la tarjeta y el resumen digan cuál
// sin volver a preguntarle a Zernio.
//
// Puro: lo usan el disparador, el motor, la pantalla, la API de MaKo y los tests.
// =============================================================================

/** Lo que guarda el CRON: el id nativo de la publicación y cómo se la nombra. */
export type PublicacionCron = { id: string; texto?: string };

/** Una publicación de la cuenta, como la muestra el selector. */
export type PublicacionDeLaCuenta = {
  id: string;
  /** El comienzo de su texto, en una línea ('' sin texto). */
  texto: string;
  fecha: string | null;
  link: string | null;
  imagen: string | null;
  /** 'reel', 'video', 'image', 'carousel_album'… lo que diga la plataforma. */
  tipo: string | null;
};

/** Cuánto del texto de la publicación se guarda y se muestra. */
export const TOPE_TEXTO_PUBLICACION = 80;

/** Un id de publicación: el de Instagram es numérico; el de Facebook, «página_publicación». */
const ID_PUBLICACION = /^[A-Za-z0-9_.:-]{1,120}$/;

const unaLinea = (s: string): string => s.replace(/\s+/g, ' ').trim();

const recortar = (s: string, n: number): string => {
  const t = unaLinea(s);
  if (t.length <= n) return t;
  const corte = t.slice(0, n - 1);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > n * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
};

/** La publicación de lo que llegue (la base, la pantalla, la API): un id solo, o `{ id, texto }`. null = cualquiera. */
export function sanearPublicacion(raw: unknown): PublicacionCron | null {
  const id = typeof raw === 'string' ? raw.trim()
    : raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as { id?: unknown }).id === 'string' ? (raw as { id: string }).id.trim() : '';
  if (!ID_PUBLICACION.test(id)) return null;
  const t = raw && typeof raw === 'object' ? (raw as { texto?: unknown }).texto : undefined;
  const texto = typeof t === 'string' ? recortar(t, TOPE_TEXTO_PUBLICACION) : '';
  return texto ? { id, texto } : { id };
}

/**
 * ¿ESTE COMENTARIO es de la publicación del CRON? Sin publicación elegida, cualquiera (lo de siempre). Con una, sólo un
 * comentario que dice de qué publicación es y es ésa: uno que no lo dice no puede caer en «entonces todos».
 */
export function publicacionDispara(elegida: PublicacionCron | null | undefined, postDelComentario: string | null | undefined): boolean {
  if (!elegida) return true;
  const p = (postDelComentario ?? '').trim();
  return !!p && p === elegida.id;
}

/** La respuesta de GET /v1/accounts/{id}/posts, en lo que muestra el selector. Lo que no se entiende se saltea. */
export function publicacionesDeZernio(r: unknown): PublicacionDeLaCuenta[] {
  const posts = r && typeof r === 'object' && Array.isArray((r as { posts?: unknown }).posts) ? (r as { posts: unknown[] }).posts : [];
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const out: PublicacionDeLaCuenta[] = [];
  for (const x of posts) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const id = str(o.id);
    if (!id || !ID_PUBLICACION.test(id)) continue;
    out.push({
      id, texto: recortar(str(o.message) ?? '', TOPE_TEXTO_PUBLICACION),
      fecha: str(o.createdTime), link: str(o.permalink), imagen: str(o.picture), tipo: str(o.mediaType)?.toLowerCase() ?? null,
    });
  }
  return out;
}

/** Las de varias cuentas, juntas: la más nueva primero, sin repetir. */
export function juntarPublicaciones(listas: ReadonlyArray<readonly PublicacionDeLaCuenta[]>): PublicacionDeLaCuenta[] {
  const vistas = new Set<string>();
  const todas = listas.flat().filter((p) => (vistas.has(p.id) ? false : (vistas.add(p.id), true)));
  return todas.sort((a, b) => (Date.parse(b.fecha ?? '') || 0) - (Date.parse(a.fecha ?? '') || 0));
}

export const esLinkDePublicacion = (v: string): boolean => /^https?:\/\//i.test(v.trim());

/** El código de una publicación de Instagram en su link («/reel/DAbc123/» → «DAbc123»). */
const codigoDeLink = (v: string): string | null => /instagram\.com\/(?:[^/?#]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i.exec(v)?.[1] ?? null;

/** Un link comparable: sin protocolo, «www.», consulta, ancla ni barra final. */
const linkComparable = (v: string): string => v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');

/**
 * LA PUBLICACIÓN QUE NOMBRÓ alguien que pegó su id o su LINK (la API de MaKo: «el Reel de la guía es éste»), entre las de
 * la cuenta. El link de un Reel y el de la misma publicación como «/p/» son la misma: se compara el código.
 */
export function buscarPublicacion(valor: string, lista: readonly PublicacionDeLaCuenta[]): PublicacionDeLaCuenta | null {
  const v = valor.trim();
  if (!v) return null;
  if (!esLinkDePublicacion(v)) return lista.find((p) => p.id === v) ?? null;
  const codigo = codigoDeLink(v);
  const comparable = linkComparable(v);
  return lista.find((p) => p.link && ((codigo && codigoDeLink(p.link) === codigo) || linkComparable(p.link) === comparable)) ?? null;
}

/** Cómo la nombra la tarjeta y el resumen: «la publicación «Te dejo la guía…»». */
export function textoDePublicacion(p: PublicacionCron | null | undefined): string {
  if (!p) return '';
  return p.texto ? `«${recortar(p.texto, 40)}»` : 'una publicación elegida';
}

/** Una fila del selector: «28/10 · Reel · Te dejo la guía…». */
export function rotuloDePublicacion(p: PublicacionDeLaCuenta): string {
  const f = p.fecha ? new Date(p.fecha) : null;
  const fecha = f && !Number.isNaN(f.getTime()) ? `${String(f.getUTCDate()).padStart(2, '0')}/${String(f.getUTCMonth() + 1).padStart(2, '0')}` : '';
  const tipo = p.tipo === 'reel' || p.tipo === 'reels' || p.tipo === 'video' ? 'Reel' : p.tipo === 'carousel_album' ? 'Carrusel' : p.tipo ? 'Publicación' : '';
  return [fecha, tipo, p.texto || 'Sin texto'].filter(Boolean).join(' · ');
}
