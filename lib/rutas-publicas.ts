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
  // La IMAGEN de la tarjeta de WhatsApp. Tiene que ser pública porque quien la
  // pide es un crawler sin sesión — con el 401 del middleware, la preview se
  // quedaría sin imagen y volveríamos al problema que vino a resolver.
  //
  // Es segura por CONSTRUCCIÓN, no por confianza: solo acepta `?tipo=`, que es una
  // clave de un conjunto cerrado (lib/preview-links.ts), no lee la base y un tipo
  // desconocido cae al default. No hay ningún dato que pueda filtrar.
  // El puente de Google Flow: lo llama la EXTENSIÓN desde el navegador del
  // cliente, que no tiene sesión de MaKo. Se autentica con el token del puente
  // (hasheado en flow_puentes) y no mira la cookie para nada. Es la ruta EXACTA,
  // no el prefijo `/api/flow`: ahí van a convivir rutas de la app con sesión.
  '/api/flow/puente',
  // El worker de montaje: corre en un contenedor propio, no en un navegador, asi
  // que no tiene cookie de sesion. Se autentica con `MONTAJE_WORKER_TOKEN` en un
  // bearer, comparado en tiempo constante, y sin ese secreto configurado la ruta
  // contesta 404 — no se cae a «cualquiera pasa».
  //
  // ⚠️ Estar en esta lista significa DOS cosas, y la segunda se olvida: que la
  // ruta se hace cargo de su auth, y que NO lee la cookie de sesion para nada.
  // El early-return del proxy se saltea el chequeo de Origin, asi que una ruta
  // de aca que mirara la cookie seria un CSRF.
  '/api/montaje/worker',
  // La política de privacidad de la extensión. La Chrome Web Store la EXIGE como
  // URL pública y su revisor la abre sin cuenta de MaKo: detrás del login se lee
  // como que no existe, y eso es motivo de rechazo.
  '/privacidad',
  '/api/og',
  '/vsl',
  '/vsl-assets',
  '/compartido',
  '/api/compartido',
  // ── El agente (Claude) ──────────────────────────────────────────────────
  // Se listan UNA POR UNA y no como `/api/agente`, en positivo, porque en esa carpeta
  // conviven dos clases de ruta. Estas cuatro las llama el agente desde la máquina del
  // cliente con su bearer; `/api/agente/token` NO está y no puede estar — acuñar la
  // credencial es lo único que exige ser una persona logueada, y un prefijo suelto lo
  // abriría junto con el resto.
  //
  // `hook` entró después: sirve un script SIN secretos (el token lo lee en ejecución de
  // otro archivo) y la skill lo instala sola, así que pedirle sesión de navegador era
  // pedirle al agente algo que no puede tener.
  //
  // `skill` es la que faltaba para que instalarla sea lo que es en cualquier otra: se le
  // pasa a Claude la URL y la baja él. Sin ella la única forma de entregar el archivo era
  // el portapapeles, con 11.000 caracteres que el usuario tenía que ubicar a mano.
  //
  // `lead` ESCRIBE, y entra igual por la misma razón que las otras: se autentica con un
  // bearer que el navegador no manda solo, así que no hay autoridad ambiente que abusar
  // y el chequeo de Origin que el early-return saltea no la estaba protegiendo de nada.
  '/api/agente/plan',
  '/api/agente/contexto',
  '/api/agente/telemetria',
  '/api/agente/hook',
  '/api/agente/skill',
  '/api/agente/lead',
] as const;

/** Los públicos que solo deben responder a LECTURA. El early-return se saltea el
 *  chequeo CSRF de Origin, así que una ruta pública que acepte POST quedaría
 *  expuesta si además se autenticara por cookie. */
export const PUBLICOS_SOLO_LECTURA = ['/compartido', '/api/compartido'] as const;

/**
 * La excepción: rutas públicas que SÍ escriben.
 *
 * ⚠️ SE LISTAN EXACTAS, NUNCA POR PREFIJO, y por eso esta lista existe en vez de
 * sacar `/api/compartido` de la de arriba: sacarlo abriría a POST toda la
 * carpeta, incluidas las rutas que todavía no existen. Acá entra una por una y a
 * mano, que es lo que se quiere.
 *
 * QUÉ TIENE QUE CUMPLIR UNA RUTA PARA ENTRAR ACÁ: autenticarse con un secreto
 * que el navegador NO manda solo. `/api/compartido/tarea` se autentica con el
 * token del link, que viaja en el CUERPO del request: una página ajena puede
 * mandarle un POST, pero sin el token no escribe nada, y el token es la
 * credencial entera. No hay autoridad ambiente que abusar, que es exactamente
 * lo que el chequeo de Origin protege y acá no aplica.
 *
 * Es lo mismo que hace `/api/agente/*` con su bearer, dicho arriba.
 */
export const PUBLICOS_ESCRITURA = ['/api/compartido/tarea', '/api/agente/lead'] as const;

const matchea = (lista: readonly string[], pathname: string) =>
  lista.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export const esPublica = (pathname: string) => matchea(PUBLICOS, pathname);

/** Match EXACTO: `/api/compartido/tarea/loquesea` no hereda el permiso. */
export const esPublicaDeEscritura = (pathname: string) =>
  (PUBLICOS_ESCRITURA as readonly string[]).includes(pathname);

export const esPublicaSoloLectura = (pathname: string) =>
  matchea(PUBLICOS_SOLO_LECTURA, pathname) && !esPublicaDeEscritura(pathname);
