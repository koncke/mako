// =============================================================================
// URL base de la app — una sola fuente de verdad
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
// Los puntos 5-7 no rompen de inmediato SOLO porque proxy.ts exime /api/webhooks
// y /api/track del 410 de mudanza. Esa red se saca recién cuando están hechos.
// =============================================================================

export const APP_BASE_URL = (
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://hola-mako.com'
).replace(/\/+$/, '');
