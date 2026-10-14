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

export const PARTES: Parte[] = [
  { titulo: 'Login con Google y token firmado', detalle: 'Google decide quién es; `verificarToken` (proxy, sin base) y `getUsuarioActual` (con base) deciden si entra', estado: 'hecha' },
  { titulo: 'El segundo paso al entrar', detalle: 'App de autenticación, huella/Face ID, código por WhatsApp o por otro correo · obligatorio para el super admin, opcional para el resto', estado: 'hecha' },
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
];
