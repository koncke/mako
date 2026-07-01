# Usuarios, roles y credenciales

Cómo funciona el acceso al dashboard desde la migración 0053, y cómo se da de
alta un usuario/cliente nuevo sin tocar Vercel.

## El modelo

- **`usuarios`** (tabla): quién puede entrar y con qué rol.
  - `admin` — ve **/admin** (gestión de cuentas) además de todo lo demás.
  - `usuario` — usa el dashboard completo, menos /admin.
  - Estados: `invitado` (agregado desde /admin, nunca entró) → `activo`
    (hizo su primer login con Google) → `suspendido` (bloqueado).
- **`credenciales`** (tabla): los tokens de integraciones cargados desde
  **/metodo**, cifrados con AES-256-GCM (nunca en claro en la base).

## Login

1. **Google (principal)**: el callback resuelve el email contra `usuarios`.
   - Existe y no está suspendido → sesión firmada con su rol.
   - No existe pero está en `AUTH_ALLOWED_EMAILS` → se auto-crea como **admin
     activo** (bootstrap de los dueños actuales del deploy).
   - No existe, sin allowlist y la tabla vacía → el primer login se vuelve
     admin (bootstrap de una instancia nueva).
   - Cualquier otro email → `no-autorizado`. Los usuarios nuevos se agregan
     desde /admin.
2. **Contraseña maestra (respaldo)**: `DASHBOARD_PASSWORD` abre una sesión
   admin sin tocar la base. Es la salida de emergencia (Google caído, DB caída,
   instancia recién creada).

La sesión es un token firmado (HMAC-SHA256) en la cookie `mako_session`
(`lib/auth-session.ts`); el gate vive en `proxy.ts` (Next 16 renombró
middleware → proxy, corre en runtime Node). La cookie compartida vieja
(`mako_auth`) se sigue aceptando para no desloguear a nadie; desaparece sola a
los 30 días o al cerrar sesión.

## Alta de un usuario nuevo (flujo completo)

1. Un admin entra a **/admin** → "Agregar usuario" (email + rol).
2. Le pasa el link del dashboard. El usuario entra con **Google** usando ese
   email → la cuenta pasa de `invitado` a `activo` sola.
3. El usuario completa **/onboarding** (perfil del negocio) y **/metodo**
   (pega sus tokens de Meta, Chatwoot, Resend, Anthropic, etc. — cada uno con
   tutorial paso a paso y botón "Probar conexión").

## Credenciales: quién gana

`instrumentation.ts` corre al arranque de cada instancia y vuelca las
credenciales de la base a `process.env` — así las ~70 libs que leen env siguen
funcionando sin refactor. Regla: **la env de Vercel gana**; lo cargado en
/metodo solo aplica donde la env no está seteada. En una instancia nueva sin
envs, todo sale de /metodo. Al guardar desde la UI, la instancia que atendió el
request lo aplica al instante; el resto lo toma en su próximo cold start
(minutos).

Secret de cifrado: `CREDENCIALES_SECRET` → `AUTH_COOKIE_VALUE` →
`SUPABASE_SERVICE_ROLE_KEY` (el primero que exista). Si rota, lo guardado queda
ilegible y /metodo lo marca para re-pegar.

## Env vars de auth

| Env | Rol |
| --- | --- |
| `DASHBOARD_PASSWORD` | Contraseña maestra (login de respaldo → admin). |
| `AUTH_COOKIE_VALUE` | Valor de la cookie legacy + secret de firma de sesión (fallback). |
| `AUTH_SECRET` | (opcional) secret de firma dedicado; si no está, se usa `AUTH_COOKIE_VALUE`. |
| `AUTH_ALLOWED_EMAILS` | Bootstrap: estos emails se auto-crean como admin al entrar con Google. Una vez creados los usuarios, se puede vaciar. |
| `CREDENCIALES_SECRET` | (opcional) secret de cifrado dedicado para la tabla credenciales. |

## Aplicar la migración

```bash
node scripts/apply-migration.mjs supabase/migrations/0053_usuarios_credenciales.sql
```

(Necesita `DATABASE_URL` en `.env.local`; si no, pegar el SQL en el editor de
Supabase.)
