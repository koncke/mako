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

import { laminasDe, medioDeInstagram } from './spy-medio';
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

/**
 * Una publicación con sus NÚMEROS, para Competitors Spy (31/10/2026). Es lo que la lectura normal no
 * trae: `posts` sirve para que la IA entienda de qué va la cuenta, y esto para decir qué le funciona.
 *
 * ⚠️ TODOS LOS CONTADORES SON `null` DE VERDAD. El dueño de la cuenta puede ocultar likes,
 * comentarios, vistas, reposts y compartidos UNO POR UNO, y entonces Meta **omite el campo**: no da
 * error. Un `?? 0` acá muestra «0 me gusta» sobre una publicación con miles. Se dibujan con
 * `dibujarContador` (lib/spy-reglas.ts), que distingue «no lo publica» de «cero».
 *
 * `vistas` es el `view_count` de los reels, que la referencia de Meta marca como «Available for
 * Business Discovery API only»: es el dato que la página pública de Instagram NO muestra, y por eso
 * el camino legal es también el más completo.
 */
export type PiezaInstagram = {
  /** El shortcode del permalink: la identidad de la publicación en su fuente. */
  ref: string;
  fecha: string;
  /** IMAGE · VIDEO · CAROUSEL_ALBUM. */
  tipo: string;
  /** AD · FEED · STORY · REELS: con esto se sabe si el competidor está pautando esa pieza. */
  formato: string | null;
  /** MUSIC (audio de catálogo) u ORIGINAL_SOUND: sirve para detectar audios en tendencia. */
  audio: string | null;
  texto: string;
  permalink: string | null;
  /** La miniatura: se dibuja, no se guarda (es una URL del CDN de Meta y vence). */
  miniatura: string | null;
  vistas: number | null;
  megusta: number | null;
  comentarios: number | null;
  /** Cuántas láminas trae un carrusel (Apify: `childPosts`/`images`; Meta no las da). null = no se sabe (lib/spy-medio.ts). */
  laminas?: number | null;
};

/** Lo que se lee de un perfil. */
export type PerfilInstagram = {
  usuario: string; nombre: string | null; bio: string; web: string | null; seguidores: number | null; publicaciones: number | null;
  /** La foto de perfil: una URL del CDN de Meta que VENCE (para mostrarla en una lista, nunca para guardarla). */
  foto: string | null;
  posts: Array<{ fecha: string; tipo: string; texto: string }>;
  /**
   * Las publicaciones con sus números. Sólo viene cuando se pidió el juego ancho de campos
   * (`CAMPOS_PERFIL_PIEZAS`): `undefined` es «no se preguntó», que no es «no tiene».
   */
  piezas?: PiezaInstagram[];
};
/** Por qué no se pudo leer. */
export type MotivoInstagram = 'sin-conexion' | 'sin-cuenta' | 'sin-permiso' | 'no-esta' | 'limite' | 'error';
export type LecturaInstagram = { ok: true; perfil: PerfilInstagram } | { ok: false; motivo: MotivoInstagram; detalle: string };

/** Cuántas publicaciones se piden: las últimas dicen de qué se trata la cuenta, no hace falta el archivo entero. */
export const POSTS_A_LEER = 6;
/** Los campos de Business Discovery que se piden. */
export const CAMPOS_PERFIL = `username,name,profile_picture_url,biography,website,followers_count,media_count,media.limit(${POSTS_A_LEER}){caption,timestamp,media_type}`;

/**
 * Cuántas publicaciones le pide Competitors Spy A META, en el `media.limit()` de Business Discovery.
 *
 * ⚠️ NO SE SUBE SIN PODER MEDIRLO. En la Graph API un campo o un límite que Meta no acepte hace
 * fallar la consulta ENTERA, y Business Discovery no tiene credencial desde el 22/10/2026: sólo
 * una conexión de cliente (ws11) la tiene y hoy le funciona. Subir este número a ciegas es apostar
 * la lectura de ese cliente a una corazonada.
 */
export const PIEZAS_A_LEER = 25;

/**
 * Cuántas publicaciones se quedan del camino de APIFY, que es otra cosa y por eso es otro número.
 *
 * ⚠️ ACÁ NO SE PIDE NADA MÁS: el actor YA DEVUELVE todas las que trajo, y lo único que hacíamos
 * era tirar a la basura lo que pasaba de 25 — que es por lo que Martín veía doce o veinticinco
 * piezas y nunca más (2/11/2026: «veo que no trae más de 50 publicaciones»). Subirlo no gasta una
 * llamada más ni un crédito más de Apify: aprovecha lo que ya se pagó.
 *
 * El tope sigue existiendo porque cada pieza se guarda, se le baja la miniatura y se dibuja: sin
 * ninguno, un perfil con miles de publicaciones haría trabajar a la lectura sin que nadie lo mire.
 */
export const PIEZAS_DE_APIFY = 100;

/**
 * El juego ANCHO de campos, para Competitors Spy: el de arriba más los contadores, el permalink, la
 * miniatura, el formato y el tipo de audio (31/10/2026, docs/diseno-competitors-spy.md §4.2).
 *
 * ⚠️ ES UNA CONSTANTE APARTE Y NO UNA AMPLIACIÓN DE `CAMPOS_PERFIL`, a propósito. En la Graph API,
 * **un solo campo que Meta no reconozca hace fallar la consulta ENTERA** con un 400 («Tried
 * accessing nonexisting field»), así que ampliar el juego que ya está en producción significa
 * apostar la lectura de @ de Offer y del alta de un lead a que los siete campos nuevos existen en la
 * versión de Graph que tenga cada cliente. Y eso NO SE PUEDE MEDIR DESDE ACÁ: Business Discovery no
 * tiene credencial desde el 22/10/2026 (el token de la plataforma no tiene ningún permiso de
 * Instagram), pero 1 de las 11 conexiones de clientes —la de ws11— sí la tiene y hoy le funciona.
 * Romperle eso a un cliente real para ahorrar una constante no es un intercambio que valga.
 *
 * Quien pide este juego ancho se banca el fallo: `leerPerfilInstagram({ conPiezas: true })` reintenta
 * con `CAMPOS_PERFIL` si Meta rechaza un campo, así que la tab degrada a «sin números» en vez de
 * quedarse sin perfil. El día que alguien confirme el juego ancho con una credencial de verdad, las
 * dos constantes se pueden unir — y ese día se anota la fecha en docs/hallazgos-competitors-spy.md.
 */
export const CAMPOS_PERFIL_PIEZAS = `username,name,profile_picture_url,biography,website,followers_count,media_count,media.limit(${PIEZAS_A_LEER}){caption,timestamp,media_type,media_product_type,media_audio_type,permalink,thumbnail_url,like_count,comments_count,view_count}`;

/**
 * ¿Meta rechazó la consulta porque no conoce un campo? Es el 400 que hay que distinguir de todos los
 * demás: con éste conviene reintentar con menos campos; con cualquier otro, no.
 */
export function campoDesconocido(cuerpo: unknown): boolean {
  const e = esObj(cuerpo) && esObj(cuerpo.error) ? cuerpo.error : null;
  if (!e) return false;
  return /nonexisting field|Unknown field|unsupported get request/i.test(str(e.message));
}

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
  const items = media.filter(esObj);
  // ¿Vino el juego ancho? Se decide por si ALGUNA publicación trae un campo que sólo pide
  // `CAMPOS_PERFIL_PIEZAS`. No se puede decidir por si los contadores tienen valor: un dueño que
  // oculta los likes de todas sus publicaciones devuelve lo mismo que una consulta angosta, y ahí
  // «no se preguntó» y «las oculta» son dos datos distintos.
  const anchoPedido = items.some((m) => 'permalink' in m || 'media_product_type' in m || 'thumbnail_url' in m);
  return {
    ok: true,
    perfil: {
      usuario: base.perfil.usuario, nombre: base.perfil.nombre, foto: base.perfil.foto, bio: str(bd.biography),
      web: str(bd.website) || null, seguidores: num(bd.followers_count), publicaciones: num(bd.media_count),
      posts: items.map((m) => ({ fecha: str(m.timestamp).slice(0, 10), tipo: str(m.media_type), texto: str(m.caption) }))
        .filter((m) => m.texto).slice(0, POSTS_A_LEER),
      ...(anchoPedido ? { piezas: items.map(piezaDeMedia).filter((p) => p.ref).slice(0, PIEZAS_A_LEER) } : {}),
    },
  };
}

/** El shortcode de un permalink de Instagram (`/p/<code>/`, `/reel/<code>/`): la identidad de la pieza. */
export function refDePermalink(permalink: string): string {
  const m = (permalink ?? '').match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : '';
}

/**
 * Una publicación de Business Discovery con sus números. Cada contador pasa por `num`, que devuelve
 * `null` cuando el campo no vino: un dueño puede ocultar likes, comentarios y vistas uno por uno y
 * Meta omite el campo sin dar error.
 */
function piezaDeMedia(m: Record<string, unknown>): PiezaInstagram {
  const permalink = str(m.permalink);
  return {
    ref: refDePermalink(permalink) || str(m.id),
    fecha: str(m.timestamp).slice(0, 10),
    tipo: str(m.media_type),
    formato: str(m.media_product_type) || null,
    audio: str(m.media_audio_type) || null,
    texto: str(m.caption),
    permalink: /^https:\/\//.test(permalink) ? permalink : null,
    // ⚠️ `media_url` se OMITE en videos con audio con copyright o reels con descargas desactivadas:
    // la doc de Meta dice textual que hay que tratarlo como opcional. Acá se usa `thumbnail_url` y,
    // si tampoco vino, no hay miniatura — y la pantalla no deja el hueco en blanco.
    miniatura: /^https:\/\//.test(str(m.thumbnail_url)) ? str(m.thumbnail_url) : null,
    vistas: num(m.view_count),
    megusta: num(m.like_count),
    comentarios: num(m.comments_count),
    // Sin `saved_count` ni `shares_count`: la doc de Meta dice textual «Not accessible through
    // Business Discovery». No hay columna para ellos y no se estiman.
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
/**
 * Cuántas lecturas por día gasta un negocio con SU clave de Spy (`APIFY_CLAVE_DE_SPY`), separado del tope de arriba.
 *
 * ⚠️ SUBIÓ DE 40 A 150 EL 4/11/2026, y no es un descuido: Martín pidió que buscar por nombre traiga «los mejores
 * resultados» con sus seguidores, y eso se completa leyendo las primeras filas (`leerPerfilesEnLote`, una corrida
 * para las cinco). Con 40 —compartidas con las búsquedas— alcanzaba para tres búsquedas por día. Lo que cuesta,
 * con el precio de la tienda de Apify (no medido desde la nube): ~US$2,60 cada 1.000 perfiles, o sea **~US$0,39 por
 * día en el peor caso**, que paga el negocio con su clave. El techo por corrida sigue en `APIFY_TOPE_USD`.
 */
export const TOPE_LECTURAS_SPY_POR_DIA = 150;
/**
 * Cuántas CORRIDAS de búsqueda por día y por negocio. Una búsqueda por nombre gasta dos: Google (dos páginas,
 * US$0,009) y el buscador de Instagram (US$0,012), medidos el 3/11/2026. **60 corridas = 30 búsquedas, peor caso
 * US$0,65 por día.** Va aparte de las lecturas: si compartieran el cupo, buscar dejaría al negocio sin poder agregar
 * a nadie.
 */
export const TOPE_BUSQUEDAS_SPY_POR_DIA = 60;
/** Desde cuántas letras un @ se le pregunta a Apify: «@flo» trae a cualquiera y se paga igual. */
export const APIFY_MIN_LETRAS = 5;
/**
 * LA CLAVE DE COMPETITORS SPY (1/11/2026, Martín: «conectar Apify para que Spy pueda leer Instagram»). Es otra que `APIFY_TOKEN` a propósito:
 * ésa quedó dormida con el retiro del Leads Scraper (tests/leads-scraper-retirado.test.ts), y si esta fuera la misma, pegarla despertaría también
 * el buscador del alta del CRM y Offer, que preguntan mientras se escribe. Ésta la paga el negocio que la pegó y sólo la lee Spy.
 */
export const APIFY_CLAVE_DE_SPY = 'APIFY_INSTAGRAM_TOKEN';

/**
 * Lo que devuelve el actor (`run-sync-get-dataset-items`: una lista, un ítem por perfil). Una lista vacía o un ítem sin
 * `username` es que la cuenta no existe; uno con `error` (el actor lo pone así) también. Una cuenta PRIVADA trae la bio pero
 * no las publicaciones.
 */
export function leerPerfilDeApify(usuario: string, items: unknown, conPiezas = false): LecturaInstagram {
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
      ...(conPiezas ? { piezas: posts.map(piezaDeApify).filter((m) => m.ref).slice(0, PIEZAS_DE_APIFY) } : {}),
    },
  };
}

/** Un número del actor. ⚠️ Con los «me gusta» ocultos el actor manda -1: eso es «no se sabe», nunca un número. */
const contadorDeApify = (v: unknown): number | null => { const n = num(v); return n != null && n >= 0 ? n : null; };

/**
 * Las publicaciones que devuelve `apify~instagram-scraper` con `resultsType: posts` (la corrida larga de Competitors Spy,
 * lib/spy-todo.ts): son ítems con la misma forma que `latestPosts` del lector de perfiles. Sin un código, no es una pieza.
 */
export function piezasDeApify(items: unknown): PiezaInstagram[] {
  return (Array.isArray(items) ? items.filter(esObj) : []).map(piezaDeApify).filter((m) => m.ref);
}

/** Una publicación del actor, con la misma forma que las de Business Discovery: Competitors Spy no distingue de dónde vino. */
function piezaDeApify(m: Record<string, unknown>): PiezaInstagram {
  const permalink = str(m.url);
  const esReel = str(m.productType) === 'clips' || str(m.type) === 'Video';
  return {
    ref: str(m.shortCode) || refDePermalink(permalink),
    fecha: str(m.timestamp).slice(0, 10),
    tipo: str(m.type),
    formato: esReel ? 'REELS' : 'FEED',
    audio: null,
    texto: str(m.caption),
    permalink: /^https:\/\//.test(permalink) ? permalink : null,
    miniatura: /^https:\/\//.test(str(m.displayUrl)) ? str(m.displayUrl) : null,
    vistas: contadorDeApify(m.videoViewCount ?? m.videoPlayCount),
    megusta: contadorDeApify(m.likesCount),
    comentarios: contadorDeApify(m.commentsCount),
    // Las láminas de un carrusel (`Sidecar`): el actor las da en `childPosts` o en `images` (lib/spy-medio.ts).
    laminas: medioDeInstagram(str(m.type)) === 'carrusel' ? laminasDe(m.childPosts, m.images) : null,
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
