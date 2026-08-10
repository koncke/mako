// =============================================================================
// Qué rutas NO exigen sesión de navegador
// =============================================================================
// Vive en `lib/` y no adentro de `proxy.ts` por la regla de la casa: la condición
// que gobierna algo delicado va en un módulo SIN `server-only`, para que se pueda
// testear. Un middleware no lo importa ningún test, y esta lista ya dejó afuera
// una integración entera sin que nada avisara.
//
// EL CASO QUE LO MOTIVÓ, para que no vuelva a pasar: las rutas del agente
// (`/api/agente/plan`, `/api/agente/contexto`, `/api/agente/telemetria`) se
// autentican con un Bearer y NO estaban acá, así que el middleware las cortaba con
// «no autenticado» antes de que nadie mirara el token. La integración con Claude
// nunca funcionó desde afuera. Y no se notó porque en local `gateConfigurado()` es
// false y el middleware hace no-op: contra `localhost` andaba perfecto y fallaba
// solo en producción.
//
// La pista que lo desenmascara en un segundo, y sirve para cualquier ruta con auth
// propia: pegarle con un token INVÁLIDO y mirar el TEXTO del 401.
//   · «no autenticado»            → contesta el middleware, la ruta ni se ejecutó.
//   · «token inválido o revocado» → contesta la ruta; ahí sí el problema es el token.
// Los dos son 401 y desde afuera se ven iguales.
//
// ⚠️ QUÉ SIGNIFICA ESTAR ACÁ: que la ruta se hace cargo de su propia autenticación
// (firma, secreto o bearer) Y que no se apoya en la cookie de sesión para nada. Una
// ruta que lea la cookie y esté en esta lista queda expuesta a CSRF, porque el
// early-return se saltea el chequeo de Origin. Las del agente cumplen las dos: el
// bearer es fail-closed contra el setting vigente del workspace, y el navegador
// nunca manda ese header solo — que es justamente lo que hace imposible el CSRF.
// =============================================================================

/** Prefijos que no requieren login. Se matchea la ruta exacta o `prefijo + '/'`. */
export const PUBLICOS = [
  '/api/webhooks',
  '/api/track',
  '/api/cron',
  '/api/email/unsubscribe',
  '/login',
  '/api/auth',
  '/vsl',
  '/vsl-assets',
  '/compartido',
  '/api/compartido',
  // ── El agente (Claude) ──────────────────────────────────────────────────
  // Se listan UNA POR UNA y no como `/api/agente`, en positivo, porque en esa
  // carpeta conviven dos clases de ruta: éstas tres hablan por bearer desde la
  // máquina del cliente, y `/api/agente/token` y `/api/agente/hook` exigen sesión
  // de navegador (acuñar la credencial y bajar el hook son cosas que hace una
  // persona logueada, no el agente). Un prefijo suelto abriría esas dos también.
  '/api/agente/plan',
  '/api/agente/contexto',
  '/api/agente/telemetria',
] as const;

/** Los públicos que solo deben responder a LECTURA. El early-return se saltea el
 *  chequeo CSRF de Origin, así que una ruta pública que acepte POST quedaría
 *  expuesta si además se autenticara por cookie. */
export const PUBLICOS_SOLO_LECTURA = ['/compartido', '/api/compartido'] as const;

const matchea = (lista: readonly string[], pathname: string) =>
  lista.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export const esPublica = (pathname: string) => matchea(PUBLICOS, pathname);
export const esPublicaSoloLectura = (pathname: string) => matchea(PUBLICOS_SOLO_LECTURA, pathname);
