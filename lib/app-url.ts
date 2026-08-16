// =============================================================================
// Cómo se llega a MaKo desde afuera — una sola fuente de verdad
// =============================================================================
// Dos cosas: la URL base y la dirección de correo. Las dos contestan la misma
// pregunta —«¿por dónde nos encuentra alguien que está afuera?»— y las dos se
// mudan juntas el día que cambie el dominio, así que viven juntas.
// =============================================================================
// Con esto se arman los links absolutos que salen de la app: URLs de webhook
// que le registramos a Chatwoot/Evolution, links de WhatsApp del doer, el
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
// Afuera (lo que se olvida y falla EN SILENCIO):
//   5. Los webhooks REGISTRADOS en cada servicio: Chatwoot, cada instancia de
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

export const APP_BASE_URL = (
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://hola-mako.com'
).replace(/\/+$/, '');

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
 * ⚠️ Y QUE EL DOMINIO MANDE NO SIGNIFICA QUE RECIBA. Son dos caminos distintos: mandar lo
 * hace Resend con DKIM/SPF; recibir depende de los MX y de que exista un REENVÍO para
 * ESTE alias en el registrador. Hoy los MX de hola-mako.com son `fwd1/fwd2.porkbun.com`
 * —o sea reenvío, que funciona solo para los alias dados de alta a mano— y en
 * `docs/chats/chat-dominio-makodigital-app-en-mako-*.md` el circuito de vuelta quedó
 * planeado y SIN confirmar. Antes de poner esta dirección en un lugar nuevo donde le
 * pedimos a un cliente que escriba, mandale un mail y verificá que llegue.
 */
export const EMAIL_MAKO = (process.env.MAKO_EMAIL || '').trim() || 'equipo@hola-mako.com';
