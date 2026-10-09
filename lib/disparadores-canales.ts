// =============================================================================
// disparadores-canales — ¿están conectados Instagram, Messenger y el email? (para el CRON)
// =============================================================================
// Sexta tanda del Chatbot (09/10/2026): los eventos de Instagram, Messenger y Email se ofrecen en el
// CRON «con los que ManyChat apaga apagados, y todos apagados con su motivo si el canal no está
// conectado». Un evento de un canal que no puede llegar es una automatización que no arranca nunca,
// sin un error: por eso la pantalla pregunta antes de ofrecerlo.
//
// ⚠️ ES UNA LECTURA, Y «NO PUDE LEER» NO ES «NO ESTÁ»: `conectado: null` cuando la consulta (o Meta)
// falla. La pantalla lo dice así y tampoco ofrece los eventos, pero no le dice al dueño que conecte
// algo que puede estar perfectamente conectado.
//
// Las tres preguntas, y lo que contestan HOY (09/10/2026):
//   · Messenger: la PÁGINA de Facebook conectada (`META_PAGE_ID` + `META_PAGE_ACCESS_TOKEN`, las que
//     escribe `guardarConexionMeta`). Es la condición necesaria; que los eventos lleguen depende además
//     del webhook de Messenger, que es de la parte «canales».
//   · Instagram: la página conectada Y una cuenta de Instagram profesional vinculada a ella
//     (`instagram_business_account`, Graph). Instagram se había sacado del producto el 06/10/2026
//     (tests/sin-instagram.test.ts) y vuelve por pedido de Martín (CRON puntos 2 y 6); la conexión por
//     la app de Meta está en verificación.
//   · Email: el remitente PROPIO del negocio conectado (`emailConectado`, lib/resend.ts). Recibir un
//     email necesita además el buzón de entrada, que es de la parte «canales».
//
// INTEGRACIÓN: si la parte «canales» guarda otra señal de conexión (un webhook suscripto, un buzón),
// esta función es el lugar donde se suma — no una segunda lectura en otra pantalla.

import 'server-only';
import { credWs } from './credenciales';
import { emailConectado } from './resend';
import type { EstadoCanal, EstadoCanales } from './disparadores';

const GRAPH = 'https://graph.facebook.com';
const ver = () => process.env.META_API_VERSION || 'v24.0';
const real = (v: string | null): v is string => !!v && !v.startsWith('PENDING');

const MOTIVO_FACEBOOK = 'Conecta tu página de Facebook';
const MOTIVO_INSTAGRAM = 'Conecta tu Instagram';
const MOTIVO_EMAIL = 'Conecta tu email';
const MOTIVO_NO_SE = 'No pude comprobarlo';

/** La cuenta de Instagram profesional de la página, o null si no tiene. Tira si Meta no contesta. */
async function instagramDeLaPagina(pagina: string, token: string): Promise<string | null> {
  const url = new URL(`${GRAPH}/${ver()}/${pagina}`);
  url.searchParams.set('fields', 'instagram_business_account{id,username}');
  url.searchParams.set('access_token', token);
  const r = await fetch(url, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
  const j = (await r.json().catch(() => null)) as { error?: { message?: string }; instagram_business_account?: { id?: string; username?: string } } | null;
  // Meta manda el fallo ADENTRO de un 200 (AGENTS.md): se mira `error` antes que el dato.
  if (!r.ok || !j || j.error) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
  const ig = j.instagram_business_account;
  return ig?.id ? (ig.username ? `@${ig.username}` : ig.id) : null;
}

export async function estadoCanalesDisparo(): Promise<EstadoCanales> {
  let messenger: EstadoCanal;
  let instagram: EstadoCanal;
  let pagina: string | null = null;
  let token: string | null = null;
  try {
    [pagina, token] = await Promise.all([credWs('META_PAGE_ID'), credWs('META_PAGE_ACCESS_TOKEN')]);
    messenger = real(pagina) && real(token) ? { conectado: true, cuenta: null } : { conectado: false, motivo: MOTIVO_FACEBOOK };
  } catch (e) {
    console.error('[disparadores-canales] la página de Facebook:', e instanceof Error ? e.message : String(e));
    messenger = { conectado: null, motivo: MOTIVO_NO_SE };
  }
  if (messenger.conectado !== true || !real(pagina) || !real(token)) {
    instagram = messenger.conectado === null ? { conectado: null, motivo: MOTIVO_NO_SE } : { conectado: false, motivo: MOTIVO_INSTAGRAM };
  } else {
    try {
      const cuenta = await instagramDeLaPagina(pagina, token);
      instagram = cuenta ? { conectado: true, cuenta } : { conectado: false, motivo: MOTIVO_INSTAGRAM };
    } catch (e) {
      console.error('[disparadores-canales] Instagram de la página:', e instanceof Error ? e.message : String(e));
      instagram = { conectado: null, motivo: MOTIVO_NO_SE };
    }
  }
  let email: EstadoCanal;
  try {
    email = (await emailConectado()) ? { conectado: true } : { conectado: false, motivo: MOTIVO_EMAIL };
  } catch (e) {
    console.error('[disparadores-canales] el email:', e instanceof Error ? e.message : String(e));
    email = { conectado: null, motivo: MOTIVO_NO_SE };
  }
  return { instagram, messenger, email };
}
