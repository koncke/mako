// =============================================================================
// Cómo se llega a MaKo desde afuera — una sola fuente de verdad
// =============================================================================
// Dos cosas: la URL base y la dirección de correo. Las dos contestan la misma
// pregunta —«¿por dónde nos encuentra alguien que está afuera?»— y las dos se
// mudan juntas el día que cambie el dominio, así que viven juntas.
// =============================================================================
// Con esto se arman los links absolutos que salen de la app: URLs de webhook
// que le registramos a Evolution, links de WhatsApp del doer, el
// unsubscribe de los emails y el beacon del VSL. Muchos de esos se generan
// desde crons, donde no hay request del que sacar el origin.
//
// Antes cada archivo repetía el literal del dominio de turno (primero
// dashboard-marketing-six.vercel.app, después makodigital.app) como fallback. Un
// env faltante te mandaba EN SILENCIO al dominio viejo. Ahora el fallback vive acá.
//
// Orden: APP_BASE_URL (la que se setea en Vercel) → NEXT_PUBLIC_APP_URL (la que
// también necesita el cliente) → el dominio de producción.
//
// ── CHECKLIST DE UNA MUDANZA DE DOMINIO ──────────────────────────────────────
// En el código y la infra (rápido, todo verificable):
//   1. El fallback de acá abajo.
//   2. HOST_CANONICO en proxy.ts.
//   3. APP_BASE_URL y NEXT_PUBLIC_APP_URL en Vercel (production + preview) + deploy.
//      Ojo: NEXT_PUBLIC_* se inlinea en BUILD — sin redeploy queda el valor viejo.
//   4. El dominio agregado al proyecto de Vercel + su DNS.
//   4b. El dominio VIEJO (y el nuevo) en `DOMINIOS_DE_MAKO` (lib/editor-landing/dominios-reglas.ts):
//      un host que no está ahí lo trata proxy.ts como el dominio propio de una landing de un
//      cliente, y la app entera contesta 404 en ese host.
//   4c. Las landings NO se mudan con la app: viven en hola-mako.site (`baseLandings`, abajo), y una
//      foto publicada trae sus enlaces absolutos a esa base. Si cambia el dominio de la APP, la vieja
//      `<app>/l/<slug>` sigue en `basesLandingsPara` para reconocer lo que se compartió antes.
// Afuera (lo que se olvida y falla EN SILENCIO):
//   5. Los webhooks REGISTRADOS en cada servicio: cada instancia de
//      Evolution (incluida la de voz, que ningún botón de la UI alcanza), Calendly,
//      Fathom, Meta Lead Ads, Resend. Ninguno se entera solo del cambio.
//   6. El snippet de tracking pegado en la landing de CADA cliente: se copia con la
//      URL congelada del día, así que sigue apuntando al dominio viejo para siempre.
//   7. Las redirect URIs del cliente OAuth en Google Cloud Console (si no, no se
//      puede entrar: Error 400 redirect_uri_mismatch).
//   8. EMAIL_MAKO acá abajo, el dominio verificado en Resend, y el REENVÍO de esa
//      casilla en el registrador. Los tres, y el tercero es el que se olvida: el
//      dominio nuevo puede firmar y mandar perfecto y no recibir NADA.
// Los puntos 5-8 no rompen de inmediato SOLO porque proxy.ts exime /api/webhooks
// y /api/track del 410 de mudanza. Esa red se saca recién cuando están hechos.
// =============================================================================

import { conWs } from './ws-tab';
import { baseLandingsPara, basesLandingsPara, urlLandingEn, urlVistaEn } from './editor-landing/origen-landings';

export const APP_BASE_URL = (
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://hola-mako.com'
).replace(/\/+$/, '');

// ── Las LANDINGS publicadas: hola-mako.site (tanda 4, 14/10/2026) ─────────────
// Decisión de Martín: «Las landings enteras, como gamma.site». En producción una landing vive en
// `https://hola-mako.site/<slug>`; en local y en los previews, en `<APP_BASE_URL>/l/<slug>` (un preview
// no tiene el dominio). Lo puro —el host, cómo se arma una URL con una base, qué contesta el proxy—
// vive en lib/editor-landing/origen-landings.ts; acá sólo lo que depende del ENTORNO.
//
// ⚠️ SÓLO EN EL SERVER. `VERCEL_ENV` no llega al navegador (Next inlinea sólo `NEXT_PUBLIC_*`): un
// componente cliente que llamara a esto calcularía la base de LOCAL en producción, en silencio. Por
// eso tira en el navegador; la pantalla recibe la base del server (`LandingCompleta.baseLandings`,
// la prop `bases` del Panel). Mudar el dominio de las landings es pisar `HOST_LANDINGS` allá, sumar el
// dominio al proyecto de Vercel con su DNS, y dejar el viejo en `basesLandingsPara` (lo que ya se
// compartió sigue siendo de su landing).

function entornoLandings(): { produccion: boolean; appBaseUrl: string } {
  if (typeof window !== 'undefined') {
    throw new Error('La dirección de las landings se calcula en el server: en el navegador no se sabe el entorno (llega por props).');
  }
  return { produccion: process.env.VERCEL_ENV === 'production', appBaseUrl: APP_BASE_URL };
}

/** La base VIGENTE de las landings (lo que va antes del slug): `https://hola-mako.site` en producción. */
export function baseLandings(): string {
  return baseLandingsPara(entornoLandings());
}

/** Todas las bases donde una landing se pudo ver, la vigente primero (para reconocer y medir). */
export function basesLandings(): string[] {
  return basesLandingsPara(entornoLandings());
}

/** LA URL pública de una landing (`ruta` '' = la de inicio). Todo lo que la muestra, la copia o la manda pasa por acá. */
export function urlPublicaLanding(slug: string, ruta = ''): string {
  return urlLandingEn(baseLandings(), slug, ruta);
}

/** El link privado al BORRADOR de una landing (`ruta` '' = la de inicio). */
export function urlVistaLanding(token: string, ruta = ''): string {
  return urlVistaEn(baseLandings(), token, ruta);
}

/**
 * La dirección de correo de MaKo. **UNA SOLA**, y de acá salen las tres cosas que tienen
 * que coincidir sí o sí en cualquier mail de la plataforma: quién lo firma, a dónde va si
 * le dan «Responder», y a dónde se le dice a la persona que escriba si algo falla.
 *
 * ⚠️ ES LO PRIMERO QUE DERIVA, y ya derivó una vez: durante la mudanza de dominio el
 * remitente fue `hola@hola-mako.com` y hoy el que está configurado es `equipo@`. Con la
 * dirección escrita en cada archivo que la necesita, la mitad se queda en la vieja y los
 * mails empiezan a pedir que les respondan a un buzón que nadie mira. Por eso vive acá,
 * al lado de la URL: son la misma pregunta.
 *
 * ⚠️⚠️ Y QUE EL DOMINIO MANDE NO SIGNIFICA QUE RECIBA — Y TENER MX TAMPOCO LO PRUEBA.
 * Mandar lo hace Resend con DKIM/SPF sobre `send.hola-mako.com`. Recibir depende de los MX
 * del apex, que son `fwd1/fwd2.porkbun.com`: **reenvío**, que entrega ALIAS POR ALIAS y
 * solo para los que estén dados de alta a mano en el panel. Un alias que no existe se
 * descarta y el dominio sigue mandando perfecto.
 *
 * Y esto no es una hipótesis prolija: el MX **ya estaba** el 2026-08-05, y al día
 * siguiente la sesión de la mudanza escribió, textual, *«lo que sí falta es recibir: si
 * alguien responde uno de esos mails hoy, escribe a un buzón que no existe»*
 * (`docs/chats/chat-dominio-makodigital-app-en-mako-*.md`). Nada escrito después dice que
 * se haya creado, y la API de Porkbun no expone las reglas de reenvío — se ven en el panel
 * y en ningún otro lado. **Si mirás el MX y concluís «entonces recibe», estás reproduciendo
 * exactamente el día en que el MX estaba y el buzón no.**
 *
 * La regla: antes de poner esta dirección en un lugar nuevo donde le pedimos a alguien que
 * escriba, mandá un mail A esta casilla y confirmá que aparece en una bandeja.
 */
// Las DOS variables, igual que APP_BASE_URL arriba y por el mismo motivo: esto lo lee
// también un client component (`GCAL_MSG` en app/configuraciones/GoogleCalendarPanel.tsx),
// y Next inlinea en el bundle SOLO las `NEXT_PUBLIC_*`. Con una sola, el día que se
// configure el override el server usaría el nuevo y la pantalla seguiría mostrando el
// viejo — la misma dirección diciendo dos cosas distintas, que es justo lo que esta
// constante existe para impedir.
export const EMAIL_MAKO = validarEmailMako(
  (process.env.MAKO_EMAIL || process.env.NEXT_PUBLIC_MAKO_EMAIL || '').trim() || 'equipo@hola-mako.com',
);

/**
 * Quién firma los mails de la PLATAFORMA: los accesos (lib/invitaciones.ts) y las alarmas
 * (lib/canal-vigilante.ts). La dirección es `EMAIL_MAKO`: la misma que firma, a la que vuelve
 * un «Responder» y la que el cuerpo le da a la persona para pedir ayuda. Tienen que coincidir,
 * y la única forma de que no diverjan es que salgan de un solo lugar.
 *
 * ⚠️ NUNCA el remitente de un workspace. `sendEmail` sin `from` lee el `resend_from` del
 * workspace actual, y el único configurado es el del workspace 1 —`OWNER_WS`—, que **es
 * Mauricio, un CLIENTE**: el día que cambie su remitente, los mails de la plataforma salen
 * firmados por el negocio de otro. Nada de eso rompe nada visible; por eso la identidad de la
 * plataforma se resuelve acá, sin preguntarle a ningún workspace.
 *
 * `EMAIL_MAKO` va PELADA y el remitente se arma acá: un override mal escrito no puede dejar el
 * cuerpo de un mail diciendo «escríbenos a MaKo <equipo@…>». «MaKo» es fijo: la marca no es
 * configuración.
 */
export const REMITENTE_MAKO = `MaKo <${EMAIL_MAKO}>`;

/**
 * ⚠️ ESTO NO ES PARANOIA DE FORMATO: es la regla de la casa de que un contrato escrito solo
 * en un comentario no es un contrato. Acá arriba dice «la dirección va PELADA», y con un
 * `MAKO_EMAIL='MaKo <equipo@…>'` el remitente quedaba `MaKo <MaKo <equipo@…>>` y el cuerpo
 * del mail le pedía a la persona que le escribiera a `MaKo <equipo@…>`. Peor: el preflight
 * de sandbox ancla con `$` contra la dirección pelada, así que un
 * `MAKO_EMAIL='MaKo <onboarding@resend.dev>'` **pasaba el control** — el que terminaba
 * protegiendo era Resend rechazando el `from`, o sea el proveedor en vez del preflight.
 *
 * Falla al ARRANCAR y no en el envío: una dirección rota no tiene degradación razonable, y
 * enterarse en el primer alta de un cliente es enterarse tarde.
 */
function validarEmailMako(v: string): string {
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(v)) {
    throw new Error(
      `MAKO_EMAIL tiene que ser una dirección pelada (ej. equipo@hola-mako.com), sin "Nombre <…>". Vino: ${JSON.stringify(v)}`,
    );
  }
  return v;
}

/**
 * Un link a una pantalla del producto que se MANDA AFUERA (WhatsApp, email, un aviso).
 *
 * ⚠️ SIEMPRE lleva el `?ws=`, y por eso existe. Un aviso viaja hasta el teléfono de alguien
 * que puede estar mirando OTRO workspace cuando lo toca: sin el parámetro, el link abre la
 * pantalla en el workspace de la pestaña y la app contesta «este lead no es de esta cuenta»
 * sobre un lead que sí es suyo. Medido el 05/10/2026 con un aviso de agendado: se lee como
 * una fuga entre clientes y es un link al que le falta el destino.
 *
 * Es la misma regla que AGENTS.md ya tiene para la navegación de adentro («las cuatro formas
 * llevan el ?ws=»), aplicada a la quinta: la que sale por mensaje.
 */
export function linkApp(ruta: string, ws: number | null): string {
  return `${APP_BASE_URL}${conWs(ruta, ws)}`;
}
