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
