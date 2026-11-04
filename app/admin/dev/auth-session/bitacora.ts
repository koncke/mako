// =============================================================================
// Auth & Session — registro de construcción
// =============================================================================
// El login de MaKo: Google, el token firmado, el paso intermedio y el segundo factor.
// Nace el 13/10/2026 con el 2FA; lo anterior (el login con Google, la cookie compartida
// que se fue) está contado en docs/hallazgos-seguridad.md.
//
// Qué va acá y qué no: el motivo y la trampa, no el changelog. Los tipos, en
// ../_registro/tipos.ts.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'Admin';
const CIBER = 'Ciberseguridad';

export const PARTES: Parte[] = [
  { titulo: 'Login con Google y token firmado', detalle: 'Google decide quién es; `verificarToken` (proxy, sin base) y `getUsuarioActual` (con base) deciden si entra', estado: 'hecha' },
  { titulo: 'El segundo paso al entrar', detalle: 'App de autenticación y huella/Face ID · obligatorio para el super admin, opcional para el resto · en la rama 2fa-tanda1, se despliega con Martín presente', estado: 'hecha' },
  { titulo: 'Código por WhatsApp y por otro correo', detalle: 'Sale por una automatización del SuperAdmin, nunca por un emisor propio · el motor todavía no le escribe a una persona de `usuarios`', estado: 'cola' },
  { titulo: 'Códigos de recuperación y dispositivos recordados', detalle: '10 códigos de un uso; «recordar este dispositivo» 30 días, revocable desde el perfil', estado: 'hecha' },
  { titulo: 'Volver a pedir el segundo paso para lo sensible', detalle: 'Quitar un método o regenerar códigos hoy sólo pide la sesión completa, no un código fresco', estado: 'cola' },
  { titulo: 'El 2FA de las cuentas externas', detalle: 'Google, GitHub, Vercel, Supabase, Meta, Railway, Porkbun · lo activa Martín con el checklist de docs/2fa-cuentas-externas.md', estado: 'sigue' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '13 oct', hora: '21:55', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: '2FA en todos lados',
    pedido: 'Activar 2FA en todos lados... Si me llegan a entrar en la cuenta de email, toda la app está en riesgo. Activar 2FA de varias maneras... App de Auth, mensaje de WhatsApp, codigo en correo, preguntas de verificación, 2FA rápido para dispositivos seguros, como huella o face id, etc...',
    puntos: [
      'Llegó por la sesión «Estrategia 3 CUENTAS», que repartió el feedback de las tres reuniones con su segundo pedido textual: «Ahora pasale todos los feedback de las 3 reuniones a los chats y diles que lo implementen completo... De punta a punta». Fuente: mako-feedback-y-tareas.md, punto 2.',
      '**Las preguntas de verificación NO son un factor**: se sacan de las redes. Quedaron afuera a propósito; si Martín insiste, sólo para recuperar la cuenta.',
      'Las cuentas externas (Google, GitHub, Vercel, Supabase, Meta, Railway, el correo) las activa él: va un checklist con el link de cada una.',
    ],
  },
  {
    fecha: '13 oct', hora: '23:30', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'El segundo paso del login',
    puntos: [
      '**UN solo punto de control, en el token.** `verificarToken` rechaza un token de admin sin `mfa`: así lo cortan el proxy (sin base) y el server, y toda sesión de admin anterior quedó inválida (vuelve a entrar con el segundo paso). `getUsuarioActual` agrega la capa con la base: quien activó el 2FA después de entrar, o a quien ascendieron, tampoco sigue con la cookie vieja.',
      '**El paso intermedio es otro token** (`p1.`, firmado con el prefijo `preauth:`, 15 minutos): no sirve como sesión ni una sesión sirve como él. `/api/auth/2fa` es pública por prefijo, así que lee SÓLO esa cookie y chequea el Origin ella misma, exigiendo que esté.',
      '**El correo de respaldo no puede ser el de Google**: el login ES esa cuenta, y un código a la misma casilla no protege de lo que Martín temía.',
      '⚠️ **Activar el 2FA desde el perfil reemite la sesión.** Desde que `mfa_activo` pasa a true la cookie sin `mfa` deja de valer: sin reemitirla, activar el segundo paso echaba a la persona de la app en el request siguiente.',
      '⚠️ **El respaldo con la base caída ya no abre la puerta.** El callback de Google tenía un admin de emergencia (id 0) para cuando la base no contesta; con 2FA eso es un admin sin segundo factor, así que ahora contesta «no se pudo comprobar tu segundo paso».',
      'El super admin sin ningún método activa el primero en el mismo login (no hay otra forma de bootstrap). **Hay que hacerlo apenas se despliega**: hasta entonces, quien tenga la cuenta de Google puede enrolar el suyo.',
    ],
    archivos: [
      'lib/mfa-reglas.ts — las reglas puras (TOTP RFC 6238, códigos, quién necesita 2FA, dominio de las passkeys)',
      'lib/mfa.ts — todo lo que lee o escribe la base (secreto TOTP cifrado, códigos con HMAC, freno de fuerza bruta)',
      'lib/auth-session.ts — `mfa` en el token y el paso intermedio',
      'app/api/auth/callback/google/route.ts — decide sesión, segundo paso o bloqueo',
      'app/api/auth/2fa/route.ts y app/login/2fa/ — el segundo paso',
      'app/api/perfil/seguridad/route.ts y app/perfil/seguridad/ — administrar métodos',
      'supabase/migrations/0266_segundo_factor.sql',
      'tests/mfa.test.ts — 11 tests, cada uno probado rompiéndolo',
      'docs/2fa-cuentas-externas.md — el checklist de Martín',
    ],
  },
  {
    fecha: '14 oct', hora: '16:05', chat: CIBER, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'El 2FA, como Google, con todos los medios',
    pedido: 'Tu prioridad número uno es el 2FA, replicando cómo lo hace Google... App de autenticación (TOTP). Códigos por WhatsApp. Códigos por email, aprovechando Automations del SuperAdmin... Entrada rápida con huella o FaceID una vez que ya pasaste el 2FA (passkeys / WebAuthn). Códigos de recuperación. Que se sienta como Google: elegir método, método preferido, «confiar en este dispositivo», y una salida cuando perdés el teléfono.',
    puntos: [
      'Llegó por «Estrategia 3 cuentas», que lo pasó «textual en lo que importa»: no es la frase entera de Martín.',
      'Se partió en tandas: la 1 (app, huella, códigos, recordar) sale sola; WhatsApp y correo esperan a que el motor de Automations le pueda escribir a una persona de `usuarios`.',
    ],
  },
  {
    fecha: '14 oct', hora: '17:05', chat: CIBER, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Tanda 1: el WIP del 13/10, terminado y probado',
    puntos: [
      '**WhatsApp y correo APAGADOS** (`CANALES_CODIGO` vacío): se sacó el emisor propio del WIP, que además le mandaba el WhatsApp a OTRO número en AR y MX (Evolution le saca un dígito a los 13 dígitos que empiezan con 52/54).',
      '**/perfil/seguridad para todos los roles**: el `requireRolWs([])` del WIP echaba a closers y setters.',
      'Probado de punta a punta en localhost con un super admin descartable, borrado al terminar: activar la app, códigos, entrar con la app (el código ya usado no vale), recordar, código de recuperación (no dos veces), crear y usar una llave, y no poder sacar el último método.',
    ],
    commits: [{ sha: '07fb7cfdd', msg: '2FA del login, tanda 1: app de autenticación, llave de acceso y códigos de recuperación', lineas: 2660, archivos: 27 }],
  },
  {
    fecha: '14 oct', hora: '17:34', chat: CIBER, cuenta: 'claude1', actor: 'claude', tipo: 'correccion',
    titulo: 'La revisión de seguridad: el freno se salteaba en paralelo',
    puntos: [
      '⚠️ **El freno contaba primero y anotaba el fallo después**: 500 pedidos en paralelo leían «0 fallos» y probaban 500 códigos. Con la cuenta de Google del super admin, eso es ~13% por día de adivinar la app. Ahora cada intento se ANOTA antes de contar (`intentar`), fail-closed en las dos puntas. Medido contra la base: 30 en paralelo, pasó 1.',
      '**El freno ya no corta las llaves de acceso ni lo defensivo**: puesto para todo, quien tiene la cuenta de Google le bloqueaba al dueño hasta la huella y el «olvidar dispositivo».',
      '**El login cuenta los factores de verdad** (`mfaActivoReal`) y no sólo `usuarios.mfa_activo`: son dos escrituras, y con la segunda caída el 2FA de esa persona quedaba apagado sin aviso.',
      'Queda para la tanda 3, con el «pedir un código fresco»: dos «quitar» simultáneos pueden dejar al super admin sin métodos (hace falta ya tener su sesión).',
    ],
  },
  {
    fecha: '14 oct', hora: '19:10', chat: CIBER, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Al enrolar: la huella es del celular, y los códigos se descargan',
    pedido: 'La huella / Face ID no se ofrece en escritorio... es justamente un método rápido de entrar con el celu [y sólo después de haber pasado el auth con la app]. Los códigos de recuperación se tienen que poder DESCARGAR. Falta login con correo y contraseña, con su recuperación. Esperaba poder elegir también código por Gmail y por WhatsApp, y tener varias formas activas en la misma cuenta.',
    puntos: [
      'Llegó por «Estrategia 3 cuentas» después de que Martín enroló con la app (22:09 UTC), resumido en cuatro puntos: no es su frase entera.',
      'Lo del correo y la contraseña es estructural: hoy los códigos recuperan el SEGUNDO factor, no la cuenta; sin Google no hay por dónde entrar. Se diseña antes de construir.',
      'WhatsApp y correo son la tanda 2 (por Automations del SuperAdmin), que sube de prioridad. Varias formas a la vez ya estaba soportado.',
    ],
  },
  {
    fecha: '14 oct', hora: '19:18', chat: CIBER, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'La huella sólo en el teléfono, y los códigos en un .txt',
    puntos: [
      '**La huella deja de ser un primer método**: el alta ofrece la app (con un solo método, va directo a ella) y el server rechaza crear una llave sin sesión. Después de entrar, en el teléfono, aparece «Entra más rápido» y la llave se crea con la sesión completa; «Ahora no» no se vuelve a ofrecer en ese teléfono.',
      '**En la compu no se usa ni se activa** (`esTelefono`, regla de PRODUCTO: el user-agent lo escribe el navegador; lo que protege es la firma). /perfil/seguridad lista las llaves que hay para poder quitarlas y dice «Se activa desde el celular».',
      '**«Descargar»** en el alta y en /perfil/seguridad: un .txt con la cuenta, la fecha y los diez códigos. El texto vive en lib/mfa-texto.ts, aparte de lib/mfa-reglas.ts, porque aquél importa node:crypto y no puede llegar al navegador.',
    ],
  },
  {
    fecha: '1 nov', hora: '22:53', chat: CIBER, sesion: 'cli_9b7bccde-0049-5493-a2f1-0d684f2c4409', cuenta: 'nube', actor: 'martin', tipo: 'prompt',
    titulo: 'Blindar MaKo entera: claves, sesiones, dominios, integraciones y el VPS',
    pedido: 'analiza lo que es la aplicación de Mac básicamente, para poder promover lo que sería todas las medidas de seguridad que hay que ingresar a esta aplicación, literalmente todas, para que esta aplicación sea lo más segura posible en todos los sentidos, literalmente en todos los sentidos, tanto en lo que tiene que ver con seguridad para los usuarios y seguridad propia mía a nivel de credenciales, contraseñas, hackeos, literalmente todo. Tiene que estar hiper mega ultra blindada. También revísalo con los dominios, las sesiones del VPS. Hay cosas muy delicadas, como API keys, claves, centralizar todo. A nivel de diseño también quiero blindar todo lo que tiene que ver con la configuración de integraciones, configuración de credenciales, seguridad de usuarios. Blindar todo lo que tiene que ver con posibles hackeos de información. Entrar por otros lugares, revisar si no hay claves filtradas.',
    puntos: [
      '«La aplicación de Mac» es MaKo (lo confirmó Martín al elegir «MaKo entera»). Pidió primero el informe y después: «todo lo que se pueda ejecutar sin que dependa de mí, tienes permiso para ejecutarlo».',
      'Relevo con tres lectores (claves en la historia de git de los tres repos, sesiones y headers, escritorio + extensión + VPS); los hallazgos centrales verificados a mano.',
    ],
  },
  {
    fecha: '2 nov', hora: '01:53', chat: CIBER, sesion: 'cli_9b7bccde-0049-5493-a2f1-0d684f2c4409', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: 'Sesiones que se cierran, claves que no viajan y la extensión que sólo atiende a MaKo',
    puntos: [
      '**En Vercel, un token sin fila no vale** (`verificarToken`): el dev-login firmaba `sub:\'dev\'` + `mfa:\'dev\'`, y con un AUTH_SECRET de producción en una `.env.local` eso era super admin por 30 días sin revocación.',
      '**Cambiar o restablecer la contraseña anota el corte de las otras sesiones** (`usuarios.sesiones_desde`, mig 0366, `revocarSesiones`), y Seguridad suma la acción `sesiones-cerrar`. ⚠️ Anotar no cierra: lo tendría que respetar `leerSesion`.',
      '**`leerSesion` quedó como estaba** (el Cerebro, 3 de noviembre): la «falla cerrada» de la nube invertía una decisión escrita a propósito (con un bache de Supabase todos los clientes quedan sin sesión) y sumaba una consulta por pedido. Por eso el corte todavía no se lee.',
      '**El descifrado exige el tag GCM de 16 bytes**: con el de antes, un criptograma con 4 bytes de tag abría (medido).',
      '**La hidratación del entorno es una lista de lo PERMITIDO** (el catálogo de integraciones, las keys de IA y sus rótulos): una fila zombie ya no pisa un secreto de la plataforma.',
      '**SSRF cerrado** en «crear anuncio desde un link» (cada redirect se valida), el verify token de Meta en tiempo constante, y `/api/…/x.png` vuelve a pasar por el proxy.',
      '**Headers**: `Permissions-Policy` y HSTS con `preload` en los hosts de MaKo; `mako_email` HttpOnly; Google exige `email_verified === true`.',
      '**Extensión 0.74.5**: el puente no corre en `/api/` ni `/l/` de hola-mako.com, y los pedidos de WhatsApp sólo se atienden desde la app (localhost sólo con la extensión de desarrollo).',
      '**Guarda nueva en el push** (`scripts/claves-en-el-diff.mjs`): frena una línea con forma de clave real en lo que se publica.',
      'Lo que queda (Calendly sin clave propia, rol vacío = admin, firma y hash de los binarios, CSP con nonce, COOP, límites durables) y lo que depende de Martín (rotar claves, 2FA en proveedores, DNS): docs/hallazgos-seguridad.md, «Auditoría del 01/11/2026».',
    ],
    archivos: [
      'lib/auth-session.ts — el token sin fila',
      'lib/sesiones-revocadas.ts, lib/sesiones-revocadas-reglas.ts, supabase/migrations/0366_sesiones_desde.sql — anotar el corte',
      'lib/cripto-credenciales.ts, lib/credenciales.ts — el tag y la hidratación',
      'proxy.ts, next.config.ts — el matcher y los headers',
      'extension/background.js, extension/manifest.json — el corte por origen',
      'scripts/claves-en-el-diff.mjs, scripts/guardas-push.sh — la guarda de claves',
    ],
  },
  {
    fecha: '4 nov', hora: '09:40', chat: 'Tiendas: cuenta de revisión', sesion: 'cli_d2b72179-90a8-55cc-b44f-a49a80e160ba', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: 'La cuenta de revisión de las tiendas escribe sólo lo permitido y vive en su propio negocio',
    puntos: [
      '**Lista de lo PERMITIDO en el proxy, páginas incluidas**: la sesión de revisión lee todo y escribe sólo en MaKo, el permiso de IA, denunciar, eliminar la cuenta y sus avisos. Las server actions quedan afuera.',
      '**La guarda de envío** en `sendEmail` y en los tres envíos de WhatsApp: en revisión sólo sale un correo al equipo, también desde un cron de su negocio o con la base caída.',
      '**Su negocio es propio** (`WS_REVISION`, 900001), fuera de los de prueba. La entrada exige 0 líneas, 0 credenciales y 0 cartera, y no mira otro negocio por la agencia.',
      '**Sus tickets se guardan sin despacho**, y el Runner y `scripts/tickets.ts` los saltean. No conecta una computadora, Google la rechaza y el «olvidé mi contraseña» no la toca.',
      'Cada entrada y cada intento fallido avisan a equipo@ con la IP. El script crea su negocio, nunca pisa el archivo de la contraseña y `--rotar` limpia la computadora y los avisos.',
      '**Cómo se prueba:** después de correr el script (docs/relevo/nube-tiendas.md), entrar con esa cuenta en el teléfono y probar mover un lead (no deja) y hablar con MaKo (sí).',
    ],
    archivos: [
      'lib/cuenta-revision-reglas.ts — quién es, qué escribe y qué manda (puro)',
      'lib/revision-guarda.ts, lib/resend.ts, lib/evolution.ts — la guarda de envío',
      'proxy.ts — la lista de lo permitido',
      'lib/cuenta-revision.ts, app/api/auth/contrasena/route.ts — el negocio limpio antes de dar la sesión',
      'lib/tickets-db.ts, lib/tickets-runner.ts, scripts/tickets.ts — sin despacho',
      'scripts/tiendas-cuenta-revision.mts — crea su negocio y su contraseña',
      'tests/cuenta-revision.test.ts, tests/cuenta-revision-escrituras.test.ts, tests/cuenta-revision-tienda.test.ts — probado rompiéndolo',
    ],
    revisar: '/crm',
  },
];
