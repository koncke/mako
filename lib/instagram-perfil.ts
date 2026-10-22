// =============================================================================
// instagram-perfil — leer DE VERDAD el perfil de Instagram que da el dueño (lo puro, con test)
// =============================================================================
// Pedido de Martín (22/10/2026): «también faltaba lo de Instagram, que no estaba buscando bien a los @». En el
// onboarding de una clienta (ws21) ella pegó su Instagram y MaKo contestó «Perfecto, vi tu Instagram: ayudas a estudiantes
// con sus tesis» sin haberlo leído: lo dedujo del nombre del usuario. Cuando alguien da un @ o un link de Instagram (en
// Offer o en el onboarding, que es Offer), MaKo lee el perfil: la bio, la web y las últimas publicaciones. Si no puede,
// lo dice y pide que le cuenten.
//
// QUÉ CAMINO, MEDIDO EL 22/10/2026 con el @ público de esa clienta (sólo leyendo):
//   · Business Discovery de la Graph API (oficial): lee bio, web, seguidores y publicaciones de una cuenta de EMPRESA o
//     CREADOR por su @ exacto. Pide una cuenta de Instagram profesional vinculada a la página de Facebook de quien
//     pregunta y el permiso `instagram_basic` en su token. HOY NO ANDA: el token de la plataforma (MaKo System User, ws9)
//     no tiene NINGÚN permiso de Instagram, y la página «Hola MaKo» no tiene un Instagram vinculado (Meta no da error:
//     omite el campo `instagram_business_account`). El de Mauricio (ws1) tampoco.
//   · El lector de afuera (r.jina.ai): 403, «Anonymous access to domain www.instagram.com blocked» por abuso.
//   · La página del perfil, directo: 200 sin datos (el perfil se arma con JavaScript y pide sesión).
//   · El endpoint web de Instagram (`/api/v1/users/web_profile_info`): no es oficial, pide cabeceras de navegador y
//     bloquea a los servidores. No se usa: MaKo está en la App Review de Meta.
//   · El buscador del alta de un lead (el «punto 28», 12/10/2026) usaba Business Discovery con la Meta del NEGOCIO y
//     Google Custom Search: Google NO tiene claves en ningún negocio (tampoco en la plataforma), y de 11 conexiones de
//     Meta sólo la de ws11 tiene permisos de Instagram (con ella, la clienta sale con su bio; una cuenta personal, no).
// Entonces: LA función (lib/instagram-perfil-server.ts) prueba la Meta del negocio, la de la plataforma y Apify, que lee
// cuentas personales y se paga por resultado. Hoy no hay key de Apify en ningún negocio: el día que la plataforma la
// cargue, anda sin tocar código. Mientras, MaKo dice que no pudo.
//
// Sin `server-only`: lo leen la pantalla de Offer (el @ de un mensaje es un link a leer) y el test.
// =============================================================================

import { leerRespuestaMeta, urlDePerfil, usuarioDeTexto, usuarioDeUrlInstagram } from './instagram-buscar';

/**
 * Los @ de Instagram que nombra un texto, como links a su perfil (`https://www.instagram.com/<usuario>/`). Un @ cuenta
 * si empieza una palabra (no es el de un mail: «ana@gmail.com»); el punto final de la frase no es parte del usuario.
 */
export function instagramsDelTexto(texto: string): string[] {
  const out: string[] = [];
  for (const m of (texto ?? '').matchAll(/(?:^|[\s(«"“'¿¡:,;])@([A-Za-z0-9._]{2,30})/g)) {
    const usuario = usuarioDeTexto(m[1].replace(/\.+$/, ''));
    if (!usuario) continue;
    const link = urlDePerfil(usuario);
    // Pasa por la misma regla que un link pegado: un @ reservado («@explore») no es un perfil.
    if (usuarioDeUrlInstagram(link) && !out.includes(link)) out.push(link);
  }
  return out;
}

/** Lo que se lee de un perfil. */
export type PerfilInstagram = {
  usuario: string; nombre: string | null; bio: string; web: string | null; seguidores: number | null; publicaciones: number | null;
  /** La foto de perfil: una URL del CDN de Meta que VENCE (para mostrarla en una lista, nunca para guardarla). */
  foto: string | null;
  posts: Array<{ fecha: string; tipo: string; texto: string }>;
};
/** Por qué no se pudo leer. */
export type MotivoInstagram = 'sin-conexion' | 'sin-cuenta' | 'sin-permiso' | 'no-esta' | 'limite' | 'error';
export type LecturaInstagram = { ok: true; perfil: PerfilInstagram } | { ok: false; motivo: MotivoInstagram; detalle: string };

/** Cuántas publicaciones se piden: las últimas dicen de qué se trata la cuenta, no hace falta el archivo entero. */
export const POSTS_A_LEER = 6;
/** Los campos de Business Discovery que se piden. */
export const CAMPOS_PERFIL = `username,name,biography,website,followers_count,media_count,media.limit(${POSTS_A_LEER}){caption,timestamp,media_type}`;

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/**
 * La respuesta de Business Discovery con la bio y las publicaciones. Los fallos (y la cuenta que no existe o no es de
 * empresa) los lee `leerRespuestaMeta`, la misma regla que el buscador del CRM.
 */
export function leerPerfilDeMeta(status: number, cuerpo: unknown): LecturaInstagram {
  const base = leerRespuestaMeta(status, cuerpo);
  if (!base.ok) return { ok: false, motivo: base.motivo, detalle: base.detalle };
  const bd = (cuerpo as { business_discovery: Record<string, unknown> }).business_discovery;
  const media = esObj(bd.media) && Array.isArray(bd.media.data) ? bd.media.data : [];
  return {
    ok: true,
    perfil: {
      usuario: base.perfil.usuario, nombre: base.perfil.nombre, foto: base.perfil.foto, bio: str(bd.biography),
      web: str(bd.website) || null, seguidores: num(bd.followers_count), publicaciones: num(bd.media_count),
      posts: media.filter(esObj).map((m) => ({ fecha: str(m.timestamp).slice(0, 10), tipo: str(m.media_type), texto: str(m.caption) }))
        .filter((m) => m.texto).slice(0, POSTS_A_LEER),
    },
  };
}

// ── Apify: el scraper de perfiles, por usuario (cuentas personales también) ──────────
// Business Discovery no ve cuentas personales ni anda sin permisos de Instagram en el token (medido el 22/10/2026: sólo
// 1 de 11 conexiones de Meta los tiene). El actor `apify/instagram-profile-scraper` lee cualquier perfil PÚBLICO por su
// usuario y se paga por resultado. Lo paga la plataforma (su `APIFY_TOKEN` en el ws de la plataforma) y, si no tiene, el
// negocio con la suya; cada corrida va topeada (`maxItems` y `maxTotalChargeUsd`).

/** El actor y sus topes: UN perfil por corrida, y nunca más que este gasto. */
export const APIFY_ACTOR_PERFIL = 'apify~instagram-profile-scraper';
export const APIFY_TOPE_USD = 0.02;
/** Cuántas lecturas por Apify por negocio y por día (el buscador del alta pregunta mientras se escribe). */
export const APIFY_TOPE_POR_DIA = 40;
/** Desde cuántas letras un @ se le pregunta a Apify: «@flo» trae a cualquiera y se paga igual. */
export const APIFY_MIN_LETRAS = 5;

/**
 * Lo que devuelve el actor (`run-sync-get-dataset-items`: una lista, un ítem por perfil). Una lista vacía o un ítem sin
 * `username` es que la cuenta no existe; uno con `error` (el actor lo pone así) también. Una cuenta PRIVADA trae la bio pero
 * no las publicaciones.
 */
export function leerPerfilDeApify(usuario: string, items: unknown): LecturaInstagram {
  if (!Array.isArray(items)) return { ok: false, motivo: 'error', detalle: 'Apify no devolvió una lista' };
  const p = items.find((x): x is Record<string, unknown> => esObj(x) && str(x.username).toLowerCase() === usuario.toLowerCase());
  if (!p || p.error) return { ok: false, motivo: 'no-esta', detalle: p ? str(p.error) || 'sin el perfil' : 'sin resultados' };
  const posts = Array.isArray(p.latestPosts) ? p.latestPosts.filter(esObj) : [];
  return {
    ok: true,
    perfil: {
      usuario: str(p.username).toLowerCase(), nombre: str(p.fullName) || null, foto: /^https:\/\//.test(str(p.profilePicUrl)) ? str(p.profilePicUrl) : null,
      bio: str(p.biography), web: str(p.externalUrl) || null,
      seguidores: num(p.followersCount), publicaciones: num(p.postsCount),
      posts: posts.map((m) => ({ fecha: str(m.timestamp).slice(0, 10), tipo: str(m.type), texto: str(m.caption) })).filter((m) => m.texto).slice(0, POSTS_A_LEER),
    },
  };
}

/** El perfil como el texto de un documento de la conversación: lo que lee la IA, con su fuente arriba. */
export function textoDelPerfil(p: PerfilInstagram): string {
  const cifras = [p.seguidores != null ? `${p.seguidores} seguidores` : '', p.publicaciones != null ? `${p.publicaciones} publicaciones` : ''].filter(Boolean).join(' · ');
  return [
    // Un @ que nombra el dueño puede no ser el suyo («mi competencia es @x»): la IA no puede tomar esa bio como su negocio
    // (revisión adversarial del 22/10/2026, B6: la misma clase de error que OF3).
    `Perfil de Instagram que nombró el dueño (puede no ser el suyo: su competencia, un ejemplo): @${p.usuario}${p.nombre ? ` (${p.nombre})` : ''} — ${urlDePerfil(p.usuario)}`,
    p.bio ? `Bio: ${p.bio}` : 'Bio: (vacía)',
    p.web ? `Web: ${p.web}` : '',
    cifras,
    p.posts.length ? `Últimas publicaciones:\n${p.posts.map((x) => `- ${x.fecha || 's/f'}: ${x.texto.slice(0, 400)}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * Lo que se le dice al dueño cuando no se pudo leer: corto, sin culpar al dueño, y pidiéndole lo que se iba a sacar de
 * ahí. Una cuenta que no existe (o personal: Business Discovery no las ve) se dice distinto.
 */
export function noPudeLeerInstagram(usuario: string, motivo: MotivoInstagram): string {
  if (motivo === 'no-esta') return `No encontré el Instagram @${usuario}. Si es el tuyo, cuéntame en una frase qué hace tu negocio y a quién le vende.`;
  return `No pude leer el Instagram @${usuario}: Instagram no deja leerlo desde aquí. Si es el tuyo, cuéntame en una frase qué hace tu negocio y a quién le vende.`;
}
