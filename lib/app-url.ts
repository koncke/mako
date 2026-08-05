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
// env faltante te mandaba EN SILENCIO al dominio viejo. Ahora el fallback vive
// acá y se cambia en un solo lugar — es lo único que hay que tocar en un cambio
// de dominio (además de las env vars de Vercel y HOST_CANONICO en proxy.ts).
//
// Orden: APP_BASE_URL (la que se setea en Vercel) → NEXT_PUBLIC_APP_URL (la que
// también necesita el cliente) → el dominio de producción.
// =============================================================================

export const APP_BASE_URL = (
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://hola-mako.com'
).replace(/\/+$/, '');
