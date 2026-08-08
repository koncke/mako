# Registrar y verificar el webhook de Chatwoot desde la app

`2026-07-31 15:00` → `2026-07-31 15:15` · 4 mensajes de Martín · 8 respuestas de Claude · sesión `d015d583`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-07-31 15:00`

En C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing: implementar el registro programático + verificación de salud del webhook de Chatwoot (canal oficial de WhatsApp), punto sc46_2 de la tarea #46 del board /plan. Hoy el webhook de Chatwoot se configura A MANO en la UI de Chatwoot (comentario en app/api/webhooks/chatwoot/route.ts:8-10), se rutea por account_id vía webhook_routing, y NO tiene ni registro automático ni chequeo de salud — el patrón a replicar es el de Evolution: estadoWebhook/repararWebhook en lib/evolution.ts:319-351 (ping E2E al propio receiver + comparación de config + botón "Reparar"), que nació de un fallo silencioso del espejo. La API de Chatwoot expone GET/POST /api/v1/accounts/{id}/webhooks. Colgarlo del arranque de la tab /whatsapp (app/whatsapp/page.tsx gate de activación) y/o de EvolutionConnect como referencia de UI. Ojo multi-tenant: credenciales por workspace vía credWs ('add-provider-integration' y 'tenant-safe-query' skills del repo), y el CHATWOOT_WEBHOOK_SECRET debe ir en la URL registrada (en prod el receiver rechaza todo sin él — tarea #11 del board).

### Claude

Voy a implementar el registro programático + chequeo de salud del webhook de Chatwoot replicando el patrón de Evolution. Primero leo el código existente y los skills del repo.

### Claude

Los skills del repo aparecieron. Cargo los tres relevantes (integración de proveedor, aislamiento multi-tenant, convenciones de Next 16) y en paralelo miro el código existente.


---

## Martín

`2026-07-31 15:00`

Base directory for this skill: C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\.claude\skills\add-provider-integration

# Agregar una integración de proveedor

Cada proveedor es una lib cliente + su registro en DOS catálogos. Las credenciales
son **por-workspace** (cifradas), no env sueltas.

## La lib cliente (`lib/<provider>.ts`)

```ts
import 'server-only';
import { credWs } from './credenciales';

// Resolver de config: per-cliente por credWs(); global (plataforma agencia) por env.
async function cfg() {
  const token = await credWs('MIPROV_API_TOKEN');   // MISMA key que el catálogo
  if (!token) throw new Error('MiProv no configurado');
  return { token };
}
export async function miProvConfigurado(): Promise<boolean> {
  return Boolean(await credWs('MIPROV_API_TOKEN'));  // NO lanza (lo usa integraciones)
}
async function mpFetch(path: string, init?: RequestInit) {
  const { token } = await cfg();
  const res = await fetch(`https://api.miprov.com${path}`, {
    ...init, headers: { authorization: `Bearer ${token}`, ...init?.headers },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false as const, error: `MiProv ${res.status}: ${text.slice(0, 200)}` };
  try { return { ok: true as const, data: JSON.parse(text) }; }
  catch { return { ok: false as const, error: 'respuesta no-JSON' }; }
}
```

## Reglas de credenciales (multi-tenant)

- **Per-cliente → `credWs('CLAVE')`** (`lib/credenciales.ts`): dueño usa env de
  Vercel, cliente su fila cifrada. NUNCA `process.env` directo para servicios
  per-cliente.
- **Servicio global de la agencia** (Google/Anthropic/OpenAI/Supabase):
  ese sí lee `process.env`; marcalo `global: true` en `integraciones.ts`.
- **Placeholder `PENDING…`** cuenta como NO configurado (`esValorReal` lo filtra).
- **Excepción documentada**: una key compartida de una cuenta única de la agencia
  (Resend/Evolution Opción A) puede caer al env global, pero el remitente/dominio
  sigue siendo por-workspace. Dejalo comentado.

## Registrar en los DOS catálogos (el paso que se olvida)

1. **`lib/metodo-catalogo.ts` → `SERVICIOS_METODO`**: agregá un `ServicioMetodo` con
   `campos: [{ env, label, secreto?, opcional?, placeholder?, nota?, host? }]` y un
   `tutorial`. **El `env` de cada campo ES la key de `credWs` Y de `process.env`** —
   si no coincide EXACTO con lo que lee la lib, `credWs` devuelve null sin error.
   `integracionConectada` exige todos los campos no-`opcional`.
2. **`lib/integraciones.ts` → `DEFS`**: agregá `{ key, nombre, categoria, descripcion,
   envs: [...], global? }`. Los `envs` deben ser las mismas keys. `global:true` solo
   para plataforma de la agencia.

## Verificar

`npx tsc --noEmit`. Confirmá que las 3 listas de keys (lib, metodo-catalogo,
integraciones) sean idénticas. Plantillas a copiar: `lib/chatwoot.ts` /
`lib/meta-ads.ts` (per-cliente, con backoff y errores tipados). Relacionado:
`lib/credenciales.ts` (credWs/integracionConectada/esValorReal), skill
`tenant-safe-query`. Para webhooks entrantes de este proveedor → `add-webhook-receiver`.


---

## Martín

`2026-07-31 15:00`

Base directory for this skill: C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\.claude\skills\tenant-safe-query

# Tenant-safe queries (multi-inquilino)

La app es multi-tenant: cada cliente = un `workspace_id`. El service_role bypassa
RLS, así que **la frontera de aislamiento es la app**, no la base. Regla de oro:
si una tabla está en `TENANT_TABLES` (`lib/workspace.ts`), sus queries DEBEN ir
scopeadas por workspace — o filtrás datos de un cliente a otro.

## Las 3 formas de acceder a la base

1. **`getTenantDb()`** (de `@/lib/workspace`) — cliente Supabase que AUTO-scopea:
   filtra `SELECT/UPDATE/DELETE` y estampa `INSERT/UPSERT` con el `workspace_id`
   del request. **Este es el default** para todo lo por-cliente.
2. **`getSupabaseServer()`** (de `@/lib/supabase`) — cliente CRUDO, sin scope.
   Solo para: tablas NO-tenant (workspaces, usuarios), o lookups deliberados por
   una clave global única (ver Webhooks).
3. **`getSetting/setSetting`** (de `@/lib/settings`) y **`credWs`** (de
   `@/lib/credenciales`) — ya scopean por su cuenta (app_settings, credenciales).

## Reglas duras

- **Toda lib de datos por-cliente usa `getTenantDb()`.** Nunca `getSupabaseServer()`
  para leads/nutrición/wa_*/email_*/evolution_*.
- **Al crear una tabla nueva por-cliente**: (a) la migración le agrega
  `workspace_id bigint not null default 1 references workspaces(id)`; (b) agregala
  al set `TENANT_TABLES` en `lib/workspace.ts` (si no, el proxy no la scopea).
- **Crons**: iterá los workspaces activos con `runWithWorkspace(ws.id, fn)`
  (`lib/workspace.ts` / patrón en `lib/cron-workspaces.ts`). Adentro, `getTenantDb`
  y `getSetting` resuelven ese ws. Un ws que falla no corta a los demás; si TODOS
  fallan, devolvé 500 (que el monitoreo del cron lo vea).
- **Webhooks (sin sesión)**: `getWorkspaceActual()` cae a `OWNER_WS` (dueño). NO
  uses `getTenantDb` a ciegas — resolvé el workspace desde el payload (ej.
  `instance_name`/`proveedor_id` que son claves GLOBALES únicas) con
  `getSupabaseServer()`, y después `runWithWorkspace(ws, fn)` para escribir con
  scope. Fail-CLOSED: sin secret configurado → 401 (nunca `if (secret && ...)`,
  siempre `if (!secret || ...)`).
- **Contexto sin sesión (funciones invocadas fuera de un request)**: no uses
  `?? OWNER_WS` como fallback silencioso en operaciones de escritura — un admin
  de agencia SIN impersonar tiene `getWorkspaceActual() === null`. Cortá con
  error (patrón `wsEstricto()` en `lib/evolution.ts`) o dejá que `getTenantDb`
  falle-cerrado (ws null → id -1 → 0 filas / FK error).
- **Excepción legítima a `credWs`** (que jamás da env a un cliente): la key
  compartida de una cuenta única de la agencia (ej. Resend/Evolution Opción A)
  cae al env global a propósito — pero el REMITENTE/dominio/instancia sigue siendo
  por-workspace. Documentá la excepción en el código.

## Antes de dar por terminado

- ¿La tabla nueva está en `TENANT_TABLES`? (grep `TENANT_TABLES` en `lib/workspace.ts`)
- ¿Algún `getSupabaseServer()` que debería ser `getTenantDb()`?
- ¿El webhook mapea payload→workspace y corre con `runWithWorkspace`?
- ¿Un guard de rol donde corresponde? (`getRolWsEfectivo()`, `requireRolWs`,
  `esWorkspaceDueno`) para acciones outward-facing (enviar, escribir a Meta).
- ¿Una query con `.like('%'+algo)` sin `.order` estable? → match no determinista.

Verificalo con una lectura adversarial de tus rutas nuevas antes de pushear.
Relacionado: `lib/workspace.ts` (getTenantDb/TENANT_TABLES/runWithWorkspace),
`lib/settings.ts`, `lib/credenciales.ts`.


---

## Martín

`2026-07-31 15:00`

Base directory for this skill: C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\.claude\skills\nextjs16-conventions

# Convenciones Next.js 16 del repo

AGENTS.md: "This is NOT the Next.js you know" — APIs y convenciones difieren de tu
training. Ante la duda, leé `node_modules/next/dist/docs/01-app/...` antes de
escribir. Abajo, los patrones que YA usa el repo (imitalos).

## Route handlers (`app/api/**/route.ts`)

- `export const dynamic = 'force-dynamic';` casi siempre (no cachear).
- `export async function GET/POST/PATCH/DELETE(req: NextRequest)`.
- Respuesta SIEMPRE `Response.json({ ok, error?, ...datos }, { status })`. Nunca
  devolver datos crudos. Helper típico: `const msg = (e) => e instanceof Error ? e.message : String(e)`.
- Parseo del body con try/catch → 400 `{ok:false, error:'body inválido'}`.
- **Integraciones externas fallan SIN lanzar**: log + `return {ok:false, error}`;
  las excepciones son solo para validación de config. (Patrón chatwoot/meta/resend.)
- `maxDuration = 300` para rutas pesadas (crons, extracción).
- **maxDuration + llamadas HTTP bloqueantes**: poné timeout a los fetch externos
  (`AbortSignal.timeout(ms)`) para no colgar la función hasta el límite.

## Pages (`app/**/page.tsx`) — Server Components async

- Cada page de negocio es `async` con `export const dynamic='force-dynamic'` y su
  PRIMERA línea es el guard: `await requireRolWs([permitidos], opts?)` (de
  `lib/tab-access.ts`). `[]` = solo admin-cliente; `['setter']` = setter+admin.
- `requireRolWs` además gatea el onboarding salvo `{gateOnboarding:false}`.
  Páginas del whitelist de closer/setter usan `await guardOnboarding()` suelto.
- El componente cliente pesado va en un `XApp.tsx` aparte con `'use client'`; la
  page es el wrapper server que aplica el guard y renderiza `<XApp/>`.

## Gating de acciones outward-facing

Enviar emails/WhatsApp o escribir a Meta = acciones sensibles: además del gating
de la tab, chequeá el rol en el route (`getRolWsEfectivo() === 'admin'`) donde
corresponda. Middleware: rutas públicas (webhooks, unsubscribe, cron) van en
`PUBLICOS` de `middleware.ts` (si no, el gate de login las bloquea 401).

## No romper el estilo

Sin `<select>` nativo → usar `app/components/Dropdown.tsx`. Reuniones = R1/R2 en
la UI (nunca J1/J2). Tokens CSS de `app/globals.css` (--ink/--accent/--surface/…),
nunca colores hardcodeados salvo en emails (inline).

### Claude

Ahora la ruta API interna, calcada del guard de la de Evolution:

### Claude

Ahora el chip con auto-registro, que reemplaza al chip verde estático:

### Claude

Verifico tipos. `IconWrench` ya existe (lo usa EvolutionConnect del mismo directorio). Corro el typecheck:

### Claude

El proceso del server no quedó registrado. Reintento:

### Claude

Solo mis cambios. Commiteo los 4 archivos y pusheo:

### Claude

Listo — el punto sc46_2 de la tarea #46 quedó implementado, verificado de punta a punta y pusheado a main (`e1b7b3e`). Y hubo un hallazgo importante en el camino.

**Lo más relevante: producción estaba rota y ya quedó arreglada.** El chequeo de salud detectó que el webhook configurado a mano en Chatwoot apuntaba al receiver correcto pero **sin el `?secret=` en la URL**, así que el receiver fail-closed de prod venía rechazando con 401 cada mensaje entrante real: la nutrición no se pausaba cuando un lead respondía, en silencio (exactamente el pendiente que quedó anotado en la auditoría de seguridad). La reparación ya se ejecutó contra el Chatwoot real: el webhook quedó con la URL canónica con secret, suscripto a `message_created`, y el ruteo `account_id → workspace` verificado. Re-chequeo final: `ok`.

**Qué se implementó**, replicando el patrón de Evolution:

- [lib/chatwoot.ts](dashboard-marketing/lib/chatwoot.ts): `estadoWebhookChatwoot()` hace la verificación E2E en tres pasos — ping real al propio receiver con el secret vigente (detecta drift de env en Vercel y dominio caído), comparación del webhook registrado en la cuenta de Chatwoot contra la URL **exacta** (secret incluido, así un secret viejo cuenta como roto) y, extra que Evolution no necesita, chequeo de que el `account_id` esté mapeado a este workspace en `webhook_routing` (sin esa fila el receiver descarta todo aunque el webhook exista). `repararWebhookChatwoot()` crea o actualiza el webhook vía `POST/PATCH /api/v1/accounts/{id}/webhooks`, borra duplicados que apunten al receiver (evita avisos dobles), reclama el ruteo (primer reclamante gana, nunca pisa a otro cliente) y re-verifica.
- [app/api/whatsapp/chatwoot/route.ts](dashboard-marketing/app/api/whatsapp/chatwoot/route.ts): GET estado / POST reparar, con guard de admin del workspace igual que la ruta de Evolution.
- [ChatwootWebhookChip.tsx](dashboard-marketing/app/whatsapp/ChatwootWebhookChip.tsx): reemplaza el span verde fijo "API Oficial" del header de /whatsapp (que decía verde aunque el webhook no existiera). Al montar la tab chequea la salud y, si el problema es reparable, **lo registra solo** — ese es el registro programático colgado del arranque de la tab. Solo si no puede (secret de plataforma faltante, env desalineado, cuenta ocupada por otro cliente) muestra el chip en ámbar con un modal que explica y deja reintentar. Setter/closer siguen viendo el chip plano de siempre.

**Verificación**: typecheck y `npm run build` en verde, y prueba E2E real por `curl` contra el dev server (login dev → GET dio `no_registrado`, POST reparar → `ok`, GET final → `ok`). No pude levantar mi propio server para ver el chip en el browser porque Next bloquea un segundo dev server en el mismo directorio y el candado lo tiene el de la otra sesión — la prueba E2E corrió contra ese server, que compila en caliente estos mismos archivos, así que el código nuevo es el que se ejercitó.

Dos cosas más: actualicé la memoria de la auditoría marcando resuelta la acción pendiente del webhook, y dejé un chip de tarea aparte por el trade-off que quedó a la vista — el `CHATWOOT_WEBHOOK_SECRET` es único para toda la plataforma y queda visible en el Chatwoot de cada cliente, con lo cual un cliente podría forjar eventos de otro; la propuesta es pasar a un secret por workspace (aplica igual a Evolution).

