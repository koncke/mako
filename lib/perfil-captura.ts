// =============================================================================
// «Guardar en MaKo» desde la extensión — lo que se entiende de un perfil de Instagram o de LinkedIn (PURO: lo prueban los tests)
// =============================================================================
// Lo prometido a la agencia de Thiago (docs/promesas/2910-llamada-thiago.md): sobre el perfil abierto de Instagram o de LinkedIn,
// un botón que guarda a esa persona como lead del CRM, de a uno y con el toque de la persona. La extensión NO interpreta
// (extension/perfil-leer.js lee el título, las etiquetas «og:» y los encabezados y los manda tal cual): lo de acá decide qué es
// el usuario, el nombre y la foto. Instagram y LinkedIn cambian su página sin avisar, y un arreglo acá sale con un deploy.
//
// ⚠️ EL USUARIO Y EL PERFIL SALEN DE LA DIRECCIÓN, NUNCA DEL TEXTO DE LA PÁGINA. El título lo escribe quien tiene la cuenta (un
//    nombre puede decir «(@otro)»), así que el texto sólo da el NOMBRE, y si no coincide con el usuario de la dirección, ni eso.
// ⚠️ LINKEDIN NO ES UN CANAL DE CONTACTO (lib/contacto-minimo.ts): MaKo no escribe por ahí. Un lead guardado desde LinkedIn nace
//    con su perfil en `leads.linkedin` (mig 0274) y sin email ni teléfono: «un lead sin teléfono es un lead al que todavía no le
//    escribiste». Sumarlo a los canales son los seis lugares de AGENTS.md, y es otra decisión.
//
// Sin `server-only` y sin imports de valores con estado: lo usan la ruta (app/api/crm/extension/route.ts) y los tests.
// =============================================================================

import { esFotoDeInstagram } from './foto-instagram-reglas';

export type RedDePerfil = 'instagram' | 'linkedin';

/** Lo que manda extension/perfil-leer.js, sin creerle nada. */
export type CapturaPerfil = {
  red: RedDePerfil;
  url: string;
  titulo: string;
  ogTitulo: string;
  ogDescripcion: string;
  ogImagen: string;
  encabezados: string[];
};

/** Lo que MaKo entendió del perfil. */
export type PerfilLeido = {
  red: RedDePerfil;
  /** El usuario de Instagram sin la @, o el identificador del perfil de LinkedIn (lo que sigue a «/in/»). */
  id: string;
  /** La dirección del perfil, con una sola forma. */
  url: string;
  /** El nombre que se ve en el perfil, o null si no se pudo leer (la persona lo escribe). */
  nombre: string | null;
  /** La foto de perfil de Instagram (CDN de Meta), para copiarla a nuestro bucket. LinkedIn: null. */
  foto: string | null;
};

const NO_ES_PERFIL_IG = new Set([
  'p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts', 'direct', 'about', 'legal', 'developer',
  'web', 'challenge', 'emails', 'privacy', 'session', 'oauth', 'api', 'graphql', 'static', 'ar', 'data', 'help', 'press',
]);
const PESTANAS_IG = new Set(['reels', 'tagged', 'saved', 'followers', 'following', 'guide', 'guides']);
const USUARIO_IG = /^[A-Za-z0-9._]{1,30}$/;
const SLUG_LI = /^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/;
/** El tope del nombre de un lead que escribe la persona en el desplegable. */
export const TOPE_NOMBRE_PERFIL = 120;

const texto = (v: unknown, n: number): string => (typeof v === 'string' ? Array.from(v.replace(/[\s\p{Cf}]+/gu, ' ').trim()).slice(0, n).join('') : '');
const hostDe = (u: URL) => u.hostname.toLowerCase().replace(/^(www|m)\./, '');

/**
 * El perfil que nombra una dirección: la MISMA regla que `queHay` de extension/perfil-reglas.js (lo que ofrece el desplegable),
 * escrita dos veces porque aquélla es un script clásico de Chrome. Que no se separen lo fija tests/perfil-extension.test.ts.
 */
export function perfilDeDireccion(url: unknown): { red: RedDePerfil; id: string; url: string } | null {
  if (typeof url !== 'string' || url.length > 2000) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = hostDe(u);
  const partes = u.pathname.split('/').filter(Boolean);
  if (host === 'instagram.com') {
    const [usuario, pestana, ...resto] = partes;
    if (!usuario || resto.length || !USUARIO_IG.test(usuario) || NO_ES_PERFIL_IG.has(usuario.toLowerCase())) return null;
    if (pestana && !PESTANAS_IG.has(pestana.toLowerCase())) return null;
    const id = usuario.toLowerCase();
    return { red: 'instagram', id, url: `https://www.instagram.com/${id}/` };
  }
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    if (partes[0] !== 'in' || !partes[1]) return null;
    let slug: string;
    try { slug = decodeURIComponent(partes[1]); } catch { return null; }
    if (!SLUG_LI.test(slug)) return null;
    const id = slug.toLowerCase();
    return { red: 'linkedin', id, url: `https://www.linkedin.com/in/${id}/` };
  }
  return null;
}

/** Lo que llega del navegador, con la forma que corresponde, o null. Lo demás no se usa. */
export function leerCapturaPerfil(v: unknown): CapturaPerfil | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.modo !== 'perfil' || (o.red !== 'instagram' && o.red !== 'linkedin')) return null;
  const encabezados = Array.isArray(o.encabezados) ? o.encabezados.slice(0, 6).map((e) => texto(e, 200)).filter(Boolean) : [];
  return {
    red: o.red,
    url: typeof o.url === 'string' ? o.url.slice(0, 2000) : '',
    titulo: texto(o.titulo, 300),
    ogTitulo: texto(o.ogTitulo, 600),
    ogDescripcion: texto(o.ogDescripcion, 600),
    ogImagen: typeof o.ogImagen === 'string' ? o.ogImagen.trim().slice(0, 2000) : '',
    encabezados,
  };
}

/** Un nombre que se puede guardar: con letras, sin el contador de notificaciones de LinkedIn («(3) »), y sin ser la red. */
function nombreUsable(s: string): string | null {
  const n = texto(s.replace(/^\(\d+\+?\)\s*/, ''), TOPE_NOMBRE_PERFIL);
  if (!n || !/\p{L}/u.test(n) || /^(instagram|linkedin)$/i.test(n)) return null;
  return n;
}

/**
 * El nombre de un perfil de Instagram: «Ana López (@ana.lopez) • Instagram photos and videos» (y en castellano, «• Fotos y videos
 * de Instagram»; la descripción dice «… from Ana López (@ana.lopez)»). Sólo si lo que está entre paréntesis es EL USUARIO de la
 * dirección: un perfil puede llamarse «Ana (@otra)».
 */
export function nombreDeInstagram(c: Pick<CapturaPerfil, 'titulo' | 'ogTitulo' | 'ogDescripcion'>, usuario: string): string | null {
  // El título: lo que va antes del PRIMER «(@…)». Si ese usuario no es el de la dirección, este título no da nombre.
  for (const fuente of [c.ogTitulo, c.titulo]) {
    const m = fuente.match(/^(.*?)\s*\(@([A-Za-z0-9._]{1,30})\)/);
    if (m && m[2].toLowerCase() === usuario) {
      const n = nombreUsable(m[1]);
      if (n) return n;
    }
  }
  // La descripción: «… videos from Ana (@ana)» o «Ver fotos y videos de Instagram de Ana (@ana)». Lo que sigue al ÚLTIMO «from» o
  // «Instagram de» (un nombre puede llevar «de», como «María de la Cruz»).
  const d = c.ogDescripcion;
  const i = d.toLowerCase().indexOf(`(@${usuario})`);
  if (i > 0) {
    const antes = d.slice(0, i);
    const cortes = [...antes.matchAll(/\b(?:from|Instagram de)\s+/gi)];
    const ultimo = cortes.at(-1);
    if (ultimo?.index != null) return nombreUsable(antes.slice(ultimo.index + ultimo[0].length));
  }
  return null;
}

const comparable = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * El nombre de un perfil de LinkedIn. El título es «(2) Ana López | LinkedIn» con sesión y «Ana López - Fundadora - ACME |
 * LinkedIn» sin ella; el nombre es el primer encabezado de la página. Se toma del título, y si uno de los encabezados es ése, gana
 * el encabezado (trae las tildes como las escribió la persona); sin título, el primer encabezado.
 */
export function nombreDeLinkedin(c: Pick<CapturaPerfil, 'titulo' | 'ogTitulo' | 'encabezados'>): string | null {
  const delTitulo = (t: string) => nombreUsable(t.replace(/\s*\|\s*LinkedIn\s*$/i, '').split(/\s+[-–|]\s+/)[0] ?? '');
  const candidato = delTitulo(c.titulo) ?? delTitulo(c.ogTitulo);
  if (candidato) {
    const igual = c.encabezados.find((e) => comparable(e) === comparable(candidato));
    return (igual && nombreUsable(igual)) || candidato;
  }
  for (const e of c.encabezados) {
    const n = nombreUsable(e);
    if (n) return n;
  }
  return null;
}

/** Lo que MaKo entiende de la captura: el perfil de la DIRECCIÓN, su nombre y (en Instagram) su foto. null = no es un perfil. */
export function leerPerfil(c: CapturaPerfil): PerfilLeido | null {
  const p = perfilDeDireccion(c.url);
  if (!p || p.red !== c.red) return null;
  if (p.red === 'instagram') {
    return { ...p, nombre: nombreDeInstagram(c, p.id), foto: esFotoDeInstagram(c.ogImagen) ? c.ogImagen : null };
  }
  return { ...p, nombre: nombreDeLinkedin(c), foto: null };
}

/** El nombre con el que se guarda: el que escribió la persona en el desplegable, o el leído. null = no hay ninguno. */
export function nombreParaGuardar(escrito: unknown, leido: string | null): string | null {
  return nombreUsable(typeof escrito === 'string' ? escrito : '') ?? leido;
}

/** El identificador de LinkedIn de lo GUARDADO en `leads.linkedin`, venga el link como venga. null = no es un perfil. */
export function linkedinComparable(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const m = v.trim().match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/in\/([^/?#\s]+)/i);
  if (!m) return null;
  let slug: string;
  try { slug = decodeURIComponent(m[1]); } catch { return null; }
  return SLUG_LI.test(slug) ? slug.toLowerCase() : null;
}

/** El patrón `ilike` que TRAE los leads cuyo `linkedin` contiene ese perfil, con `\`, `%` y `_` escapados (el `_` es comodín). */
export function patronDeLinkedin(slug: string): string {
  return `%/in/${slug.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

/** Cómo se nombra el perfil en el desplegable. */
export function rotuloDePerfil(p: Pick<PerfilLeido, 'red' | 'id'>): string {
  return p.red === 'instagram' ? `@${p.id}` : `linkedin.com/in/${p.id}`;
}
