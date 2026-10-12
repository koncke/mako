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
  // Los términos del servicio. Google los EXIGE junto con la política para
  // verificar la app OAuth de Calendar, y su revisor los abre sin cuenta.
  '/terminos',
  // La política de reembolsos (11/10/2026, con la pasarela de pagos). Stripe y Mercado Pago la
  // piden para aprobar la cuenta ANTES del primer cobro, y la lee quien está por pagar: las dos
  // la abren sin cuenta de MaKo. Es una página: sólo GET (`esPublicaSoloLeer`).
  '/reembolsos',
  // ── El comprador de un link de pago (11/10/2026) ──────────────────────────────
  // `/pagar/<token>` (route handler: redirige al checkout de Stripe o Mercado Pago) y
  // `/pagar/<token>/listo` (adonde vuelve desde la pasarela). Las abre un COMPRADOR, que no tiene
  // ni va a tener sesión de MaKo: el cliente de un negocio que le mandó el link, o alguien que está
  // comprando un plan de MaKo y todavía no tiene cuenta. Se autentican con el token de la URL (32
  // caracteres al azar, lib/cobros-reglas.ts) y NO leen ninguna cookie. Va como PREFIJO porque el
  // token es un segmento de la ruta; abajo de `/pagar` no vive nada más, y por no ser `/api/` es
  // sólo GET/HEAD/OPTIONS (`esPublicaSoloLeer`): lo que escribe va por `/api/pagar/email`.
  '/pagar',
  // Lo único que ESCRIBE del comprador: cambiar el email con el que va a entrar a MaKo después de
  // pagar un plan (el login es sólo Google, y paga con el email que tenga a mano). Exacta, no
  // `/api/pagar`. Se autentica con el token del cobro en el CUERPO —la misma credencial que el
  // link— y no lee la cookie: sin el token no escribe nada, así que el Origin que el early-return
  // saltea no protegía nada. Las condiciones (pagado, alta hecha, nunca entró, menos de 3 cambios)
  // viven en app/pagar/cambio-email.ts, con test.
  '/api/pagar/email',
  // El robots.txt (app/robots.ts). Sin esto el gate lo mandaba a /login: un crawler que
  // pedía reglas recibía una página de login.
  '/robots.txt',
  // El cargador del Pixel (app/m.js/route.ts, 09/10/2026): la línea que el cliente pega
  // en SU página, así que lo pide el navegador de un VISITANTE, sin sesión de MaKo. Lee
  // un token público del query y devuelve JavaScript: no lee ninguna cookie. Hoy el proxy
  // ni la ve —su matcher excluye todo camino que termina en `.js`—, y está acá igual para
  // que un cambio del matcher no apague el Pixel de todos los clientes con un 401. No es
  // /api/, así que `esPublicaSoloLeer` la deja sólo en GET/HEAD/OPTIONS.
  '/m.js',
  // El service worker de MaKo Mobile (public/sw.js, 11/10/2026): lo pide el NAVEGADOR al
  // registrarlo y al buscar actualizaciones, y no tiene que depender de la sesión (una sesión
  // vencida no puede dejar al teléfono sin el código que muestra los avisos). Es un archivo
  // estático sin datos de nadie. Mismo caso que '/m.js': el matcher del proxy ya excluye todo
  // camino que termina en `.js`, y está acá por si eso cambia. Sólo GET/HEAD/OPTIONS.
  '/sw.js',
  '/api/og',
  '/vsl',
  '/vsl-assets',
  // La geometría de los mapas del Dashboard (public/geo/v1, Natural Earth, dominio público; v5, 12/10/2026):
  // la pide también quien abre un informe COMPARTIDO, sin sesión. El matcher del proxy excluye png, js y css
  // pero no `.json`, así que sin esta línea el link compartido decía «No pude cargar el mapa». Estáticos sin
  // datos de nadie; no es /api/, así que `esPublicaSoloLeer` la deja sólo en GET/HEAD/OPTIONS.
  '/geo',
  '/compartido',
  '/api/compartido',
  // ── Las landings publicadas con el editor (11/10/2026, docs/diseno-editor-landing.md D4) ──
  // `/l/<slug>`, `/l/<slug>/<ruta>` y `/l/vista/<token>` (el borrador por el link privado). Y desde
  // la tanda 2, `/l/html/<docId>/<bloque>`: el «HTML personalizado» de una landing, servido aislado
  // (CSP sandbox) para que su JavaScript corra en la publicada. También sólo GET/HEAD/OPTIONS.
  // Las abre un VISITANTE, sin cuenta de MaKo: detrás del gate se leerían como una página de
  // login. Son route handlers que leen la foto por slug o por token con el cliente crudo y
  // NO miran la cookie de sesión para nada (sin cookie, `getTenantDb` caería al ws1).
  //
  // Va como PREFIJO, como `/compartido` y `/api/v1`: la carpeta `app/l` es pública POR
  // CONSTRUCCIÓN, y tests/editor-landing-publica.test.ts enumera en positivo los route.ts que
  // puede tener (una ruta nueva ahí falla hasta que alguien decide que también es pública).
  // No es /api/, así que `esPublicaSoloLeer` la deja sólo en GET/HEAD/OPTIONS: los
  // formularios de la landing no postean acá — el opt-in lo manda el Pixel a /api/track/optin.
  '/l',
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
  // `metricas` y `consultar` son las primeras rutas del agente que devuelven DATOS
  // VIVOS del negocio —inversión de Meta, visitas del landing, reuniones hechas,
  // leads con su etapa— y no configuración. Entran por el mismo motivo que las
  // otras (bearer propio, cero cookie) y las dos son de SOLO LECTURA: no tienen
  // POST, y por eso no están en PUBLICOS_DE_ESCRITURA.
  '/api/agente/metricas',
  '/api/agente/consultar',
  // ── El alumno del curso: entrar con su email (07/10/2026) ─────────────────
  // «Soy alumno: entrar con mi email» en /login. Las DOS se autentican solas y NO leen ninguna
  // cookie: `link` recibe un email y, si tiene una invitación vigente, le manda un link (contesta lo
  // mismo exista o no); `entrar` recibe el token firmado de ese link en el CUERPO (un POST del botón
  // de /login), lo gasta y ESCRIBE la cookie del alumno. Sin estar acá, el proxy las cortaría con
  // 401 antes de correr. Exactas y una por una, como las del agente: `/api/alumno` es una carpeta
  // donde mañana puede vivir algo que sí lea una cookie.
  '/api/alumno/link',
  '/api/alumno/entrar',
  // ── La API de MaKo (lib/api-mako, app/api/v1) ─────────────────────────────
  // Va como PREFIJO, y es la única carpeta que puede: bajo /api/v1 hay UNA ruta
  // dinámica (`[area]/[operacion]`), el catálogo y la referencia, y las tres se
  // autentican por bearer sin leer la cookie. La regla «rutas exactas, nunca
  // prefijo» existe porque en /api/agente conviven bearer y navegador; acá no hay
  // mezcla POR CONSTRUCCIÓN, y tests/api-mako-registro.test.ts enumera en positivo
  // los route.ts permitidos bajo esa carpeta y falla si aparece otro.
  '/api/v1',
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
 * que el navegador NO manda solo. Las dos del portal del alumno
 * (`/api/compartido/curso/progreso` y `/api/compartido/curso/tarea`) se
 * autentican con el token firmado de su link (lib/curso-acceso.ts), que viaja
 * en el CUERPO del request: una página ajena puede mandarles un POST, pero sin
 * el token no escriben nada, y el token es la credencial entera. No hay
 * autoridad ambiente que abusar, que es exactamente lo que el chequeo de
 * Origin protege y acá no aplica. Y ninguna de las dos lee la cookie de sesión.
 *
 * Es lo mismo que hace `/api/agente/*` con su bearer, dicho arriba.
 *
 * ⚠️ `/api/compartido/tarea` SE FUE de esta lista el 06/10/2026: la ruta se
 * borró el 26/09 con el programa viejo (07d07139) y la entrada había quedado
 * abriendo a POST una ruta que no existe. Una excepción de escritura sin
 * dueño es la que hereda la próxima ruta que alguien cree con ese nombre.
 */
export const PUBLICOS_ESCRITURA = [
  '/api/compartido/curso/progreso',
  '/api/compartido/curso/tarea',
  // Las dos del curso tipo Skool (07/10/2026), con el mismo token del portal en el CUERPO: la que
  // firma la subida de lo que entrega el alumno en una tarea (mig 0218) y la de la comunidad
  // (mig 0217: una sola ruta, también para leer, así el token no queda en la URL).
  '/api/compartido/curso/entrega',
  '/api/compartido/comunidad',
  // Los datos de un informe del Dashboard compartido por link (11/10/2026). NO escribe: es POST para que el
  // token del link viaje en el CUERPO y no en la URL, igual que la comunidad. La credencial entera es ese
  // token (revalidado contra la fila viva en cada pedido) y la ruta no lee la cookie de sesión.
  '/api/compartido/graficos',
  '/api/agente/lead',
  // El comprador cambia el email de su acceso a MaKo (11/10/2026): el token del cobro viaja en el
  // CUERPO y es la credencial entera (ver su entrada en PUBLICOS).
  '/api/pagar/email',
] as const;

const matchea = (lista: readonly string[], pathname: string) =>
  lista.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export const esPublica = (pathname: string) => matchea(PUBLICOS, pathname);

/** Match EXACTO: `/api/compartido/curso/tarea/loquesea` no hereda el permiso. */
export const esPublicaDeEscritura = (pathname: string) =>
  (PUBLICOS_ESCRITURA as readonly string[]).includes(pathname);

export const esPublicaSoloLectura = (pathname: string) =>
  matchea(PUBLICOS_SOLO_LECTURA, pathname) && !esPublicaDeEscritura(pathname);

// ── El alumno del curso: UNA ruta, exacta, y fuera de PUBLICOS ──────────────────
// «Invitar al cliente a MaKo para que tenga acceso al curso» (Martín, 06/10/2026). El alumno
// NUNCA recibe `mako_session` (el porqué, medido, en lib/alumno-sesion.ts): tiene su cookie
// `mako_alumno`, que el proxy no toma por sesión, así que todo lo interno le sigue dando 401 o
// «a /login» por construcción. Lo único que se le abre es `/mi-curso`, que se autentica sola.
//
// ⚠️ NO VA EN PUBLICOS, y no es un detalle: estar ahí significa «no lee cookie», y el early-return
// se saltea el chequeo de Origin. Esta página SÍ lee una cookie. Por eso es una rama aparte del
// proxy, en POSITIVO y con match EXACTO (`/mi-curso/x` no hereda nada), y sólo de LECTURA.
//
// ⚠️ Y SÓLO GET/HEAD: cortar el header `next-action` NO alcanza. Next 16 trata como acción del
// servidor también un POST multipart o urlencoded SIN ese header (`getServerActionRequestMetadata`,
// node_modules/next/dist/server/lib/server-action-request-meta.js: isMultipartAction), y si la
// acción no vive en el worker de esta página la reenvía al que la tenga. Las pantallas del alumno
// escriben por route handlers (/api/compartido/curso/*), así que acá no hay nada que postear.

/** La pantalla del alumno. Una sola, exacta. */
export const RUTA_ALUMNO = '/mi-curso';

/**
 * Qué hace el proxy con un pedido a la ruta del alumno. `null` = no es esa ruta (sigue el gate de
 * siempre); `'pasa'` = se deja pasar SIN `mako_session` (la página mira su cookie); `'prohibido'` =
 * 403 (una acción del servidor o cualquier método que no sea leer).
 */
export function decidirRutaAlumno(pathname: string, metodo: string, conAccion: boolean): 'pasa' | 'prohibido' | null {
  if (pathname !== RUTA_ALUMNO) return null;
  if (conAccion) return 'prohibido';
  const m = metodo.toUpperCase();
  return m === 'GET' || m === 'HEAD' ? 'pasa' : 'prohibido';
}

/**
 * ¿Esta ruta pública sólo se puede LEER (GET/HEAD/OPTIONS)? Las de la lista de sólo lectura,
 * y además TODA PÁGINA pública (lo que no es `/api/`).
 *
 * ⚠️ UNA PÁGINA PÚBLICA QUE ACEPTA POST EJECUTA SERVER ACTIONS SIN SESIÓN. Medido el 06/10/2026
 * en local: un POST a `/login` (y a `/privacidad`, `/terminos`, `/vsl`) con el header
 * `next-action` de `listConfirmacionesAction`, SIN cookie y SIN Origin, contestó 200 con las
 * confirmaciones pendientes del CRM del ws1 — nombres de leads, cambios y el `revert` para
 * deshacerlos. Tres cosas se suman: el early-return de abajo se saltea el chequeo de Origin;
 * Next REENVÍA la acción a cualquier worker que la tenga (o sea que por esa puerta entra
 * CUALQUIER server action de la app, no sólo las del layout); y sin cookie
 * `getWorkspaceActual()` cae al dueño (el ws1, un cliente).
 *
 * Y no alcanza con cortar el header `next-action`: Next también procesa una acción que llega
 * como POST de formulario (multipart o urlencoded) con el id en el CUERPO, sin header — es el
 * camino de los formularios sin JavaScript. Ése no se midió ejecutándolo (una acción de
 * lectura no devuelve su resultado por ahí: Next re-dibuja la página), y el corte lo cubre
 * igual: una página pública no acepta otro método que leer. Después del arreglo, las seis
 * páginas públicas contestan 405 por los dos caminos y el GET sigue en 200. Ninguna lo
 * necesita: lo que escribe sin sesión son route handlers bajo `/api/` (webhooks, track, el
 * portal del alumno), que no procesan acciones. Si alguna vez una página pública necesita un
 * POST, se agrega acá por nombre y con su porqué — nunca abriendo el método para todas.
 */
export const esPublicaSoloLeer = (pathname: string) =>
  esPublicaSoloLectura(pathname) || (esPublica(pathname) && !pathname.startsWith('/api/'));
