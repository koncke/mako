# Usuarios, roles y credenciales

> **Multi-inquilino (migración 0054):** cada usuario ve solo su propio
> **workspace**; los datos de hoy son el workspace 1 (Mauricio). El admin tiene
> un panel de gestión propio y puede "entrar como" cualquier cliente. Ver la
> sección **Workspaces (multi-inquilino)** al final.


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
funcionando sin refactor. Regla: **la base gana**; todo se configura desde la
app. El env del server es solo el **respaldo de arranque del dueño**: en el
mismo boot, `migrarEnvACredenciales()` copia a la base cifrada toda clave del
catálogo que esté en el entorno y no tenga fila todavía (solo rellena huecos,
nunca pisa la base). Después de esa primera corrida el dueño puede borrar las
envs del server y gestionar todo desde /integraciones, como cualquier cliente.
Al guardar desde la UI, la instancia que atendió el request lo aplica al
instante; el resto lo toma en su próximo cold start (minutos).

Excepción: la infra de la plataforma (`NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, y los secrets de cifrado) NO es configurable desde
la app ni vive en el catálogo — sin ella no se puede leer/descifrar la propia
tabla de credenciales.

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
node scripts/apply-migration.mjs supabase/migrations/0054_workspaces.sql
```

(Necesita `DATABASE_URL` en `.env.local`; si no, pegar el SQL en el editor de
Supabase.)

---

## Workspaces (multi-inquilino)

Desde la migración **0054**, cada usuario ve solo su **workspace**. Un cliente =
un workspace; los datos previos a la migración son el **workspace 1 (Mauricio,
dueño)**.

- **Aislamiento**: cada tabla de datos tiene `workspace_id` (default 1). El
  scoping lo hace la app en `lib/workspace.ts` (`getTenantDb()` filtra y estampa
  por workspace) porque el `service_role` bypassa RLS. Un usuario nuevo arranca
  con el dashboard **vacío**, nunca ve datos de otro.
- **Admin**: el rol `admin` ve un **panel de gestión propio** (`/admin`, sin
  tabs de marketing) — Clientes y Usuarios — y puede **"Entrar como"** cualquier
  cliente para ver/operar su dashboard (con un banner de aviso). Los usuarios se
  asignan a un workspace desde /admin.

### Fases

- **Fase 1 (hecha):** aislamiento de los datos de la base + panel admin +
  impersonación.
- **Fase 2 (hecha):** credenciales e integraciones **en vivo por cliente**. Cada
  cliente carga sus propios tokens (Meta, Chatwoot, Resend, Fathom, Panda,
  YouTube) en **/metodo** y ve sus datos en vivo con ellos (su inbox de WhatsApp,
  su salud/insights de Meta, su Closing). El resolver `credWs` (`lib/credenciales.ts`)
  devuelve la fila cifrada del workspace; para el **dueño** (workspace 1), si esa
  fila todavía no existe, cae al env del server como respaldo de arranque. Un
  **cliente** solo ve su fila — nunca el token del dueño. Anthropic/OpenAI/
  Telegram siguen compartidos (los provee la agencia).
- **Fase 2b (pendiente):** **ingesta automática por cliente** — los 12 crons
  iterando por workspace + config por-workspace (qué video es el VSL, page id,
  flags de envío). Hasta 2b, los crons corren solo para el dueño, así que un
  cliente nuevo ve sus vistas en vivo pero su dashboard histórico
  (marketing_metrics_daily) recién se llena cuando corra su propia ingesta.

### Operativa tras el deploy

Las cuentas que eran admin (por `AUTH_ALLOWED_EMAILS`) ahora ven el **panel
admin**, no el dashboard de marketing. Para ver los datos de Mauricio: **Entrar
como → Mauricio Bustos**. Si Mauricio necesita su propio login como usuario
normal, creá un usuario asignado al **workspace 1** desde /admin.
