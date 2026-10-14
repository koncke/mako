# 2FA en las cuentas externas — checklist para Martín

Lo activás vos: son tus cuentas y cada una pide tu contraseña, tu celular o una llave.
El login de MaKo ya tiene su segundo paso (ver `docs/hallazgos-seguridad.md` → «El segundo
paso del login»); esto es todo lo que está AFUERA de MaKo y que, si alguien entra, entra a MaKo
por la puerta de atrás.

**El orden importa: primero el correo.** Todas las demás cuentas recuperan la contraseña por
mail, así que quien tenga tu correo resetea todo lo demás. Por eso va primero, y con dos métodos
(app + llave/passkey), no sólo SMS.

Para cada una: activá **app de autenticación** (Google Authenticator, Authy, 1Password) o
**passkey**, guardá los **códigos de recuperación** fuera del celular, y evitá el SMS como único
método (se roba con un cambio de SIM).

| # | Cuenta | Dónde | Hecho |
|---|---|---|---|
| 1 | **Google — martinkoncke@gmail.com** (con ésta entrás a MaKo) | https://myaccount.google.com/signinoptions/twosv · passkeys: https://myaccount.google.com/signinoptions/passkeys | ☐ |
| 2 | **Google — hola.mako.app@gmail.com** | los mismos dos links, logueado con esa cuenta | ☐ |
| 3 | **Correo de hola-mako.com** (Porkbun: dominio y reenvíos) | https://porkbun.com/account → Account Settings → Two-Factor Authentication | ☐ |
| 4 | **GitHub** (el código de MaKo) | https://github.com/settings/security | ☐ |
| 5 | **Vercel** (el deploy) | https://vercel.com/account/settings/authentication · y en el equipo: Team Settings → Security → «Require two-factor authentication» | ☐ |
| 6 | **Supabase** (la base: todos los datos de todos los clientes) | https://supabase.com/dashboard/account/security | ☐ |
| 7 | **Meta** (Facebook personal + Business Manager de MaKo) | https://accountscenter.facebook.com/password_and_security/two_factor · y exigirlo a todo el equipo: https://business.facebook.com/settings/security | ☐ |
| 8 | **Railway** (hoy corre Evolution, el WhatsApp) | https://railway.com/account/security | ☐ |
| 9 | **Resend** (los correos que manda MaKo) | https://resend.com → Settings → Account → Two-factor | ☐ |
| 10 | **Stripe y Mercado Pago** (la pasarela de cobro) | Stripe: https://dashboard.stripe.com/settings/user → Two-step authentication · Mercado Pago: Tu perfil → Seguridad → Verificación en dos pasos | ☐ |

Si un link no abre (las plataformas los mueven), el camino es siempre el que va al lado.

⚠️ **El equipo de Vercel y varias credenciales del ws1 están a nombre de Mauricio**, que es un
cliente (ver AGENTS.md → «Quién es quién»). Exigir 2FA en el equipo de Vercel lo cubre a él
también; lo que esté sólo en su cuenta personal lo tiene que activar él.

## En MaKo, apenas se despliegue

1. Entrá a MaKo con Google: te va a pedir **activar el segundo paso** (el super admin no entra
   sin uno). Elegí la app de autenticación o la huella.
2. **Guardá los 10 códigos de recuperación** que te muestra: son la única salida si perdés el
   celular.
3. En **Perfil → Segundo paso al entrar** sumá un segundo método (huella en la compu + app en el
   celular), así perder uno no te deja afuera.

⚠️ Hasta que hagas el paso 1, quien tenga tu cuenta de Google puede activar SU método en tu
lugar. Por eso va apenas se despliega, y por eso Google es el punto 1 de la tabla.
