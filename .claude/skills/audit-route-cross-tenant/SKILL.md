---
name: audit-route-cross-tenant
description: >
  Auditar un route handler, page, webhook, cron o lib para CAZAR fugas
  cross-tenant e IDOR antes de mergear. Usar cuando el pedido es "revisá X por
  seguridad / aislamiento", antes de mergear una ruta que toca Supabase, o en un
  barrido de seguridad sobre app/api. Produce hallazgos rankeados (H/M/L + OWASP
  + exploit + fix). Complemento de `tenant-safe-query` (aquel enseña a ESCRIBIR
  seguro; este REVISA y encuentra lo ya roto).
---

# Auditar aislamiento cross-tenant (caza de leaks)

La frontera de aislamiento es la app (service_role bypassa RLS). Estas mismas
fallas ya se shipearon y se parchearon de forma reactiva — la auditoría busca la
próxima antes de que llegue a prod. Para el "cómo escribir bien", ver el skill
`tenant-safe-query`; acá el foco es DETECTAR.

## Clases de bug a buscar (las que ya mordieron)

1. **Cliente crudo sobre tabla tenant.** `getSupabaseServer()` usado sobre una
   tabla de `TENANT_TABLES` FUERA de `lib/workspace.ts`. → lee/escribe datos de
   todos los workspaces. (Fue H-1: `/api/whatsapp/conversations` filtraba PII de
   leads de otros clientes.)
2. **Tabla con `workspace_id` pero NO en `TENANT_TABLES`.** `getTenantDb()` la
   trata como no-tenant y hace *passthrough SIN filtrar* — silencioso, no tira
   error. (Fue la mig 0071: `meta_health_history` y `mako_knowledge` quedaron
   afuera del set.) Cruzá: toda tabla con columna `workspace_id` debería estar en
   el set, salvo las excepciones deliberadas (`app_settings`, `funnel_config`,
   `credenciales`, que scopean a mano en su lib).
3. **IDOR por id del request.** Un `leadId`/`ad_id`/`id` que viene del body o del
   query se usa para leer/mutar sin re-chequear pertenencia. Con `getTenantDb()`
   un UPDATE scopeado no rompe (no-opea), pero un SELECT crudo o un `.from()` no
   scopeado SÍ filtra. (Fue H-2: `/api/ad-insights` IDOR sobre `ad_transcripts`.)
   Regla: cargá el recurso con `getTenantDb()` y verificá que exista/pertenezca
   ANTES de actuar.
4. **Storage / RPC fuera del proxy.** El proxy de `getTenantDb` solo envuelve
   `.from()`. `.storage` y `.rpc()` NO se scopean → los paths de Storage deben ir
   prefijados con `<workspace_id>/…` a mano y servirse con URL firmada.
5. **Beacons/webhooks públicos sin scope.** Rutas en `PUBLICOS` (`/api/track/*`,
   `/api/webhooks/*`, unsubscribe) que escriben tablas tenant sin resolver el
   workspace desde el payload, sin verificar firma/secret, o sin rate-limit.

## Guards que deben estar (según el tipo de ruta)

- `/api/admin/*` → `getSesionAdmin()` (rol GLOBAL admin).
- Ruta de cliente que muta → `getRolWsEfectivo() === 'admin'` **y**
  `getWorkspaceActual()` no-null (un admin de agencia sin impersonar da `null`).
- Integración EN VIVO solo-dueño (WhatsApp, insights de Meta) → `esWorkspaceDueno()`.
- Page de negocio → primera línea `await requireRolWs([...])` (`lib/tab-access.ts`).
- Webhook → fail-CLOSED: `if (!secret || !timingSafeEqual(...)) return 401`
  (nunca `if (secret && ...)`), y raw body ANTES de parsear para el HMAC.

## Cómo reportar

Un hallazgo por ítem, rankeado, en el formato del doc de auditoría del repo
(`AUDITORIA-SEGURIDAD-PERFORMANCE.md` si existe):

- **Severidad** H / M / L + tag OWASP (ej. A01 Broken Access Control).
- **Ubicación** `archivo:línea`.
- **Exploit** concreto: qué request lo dispara y qué datos de otro tenant expone.
- **Fix** mínimo: normalmente `getSupabaseServer()` crudo → `getTenantDb()`, o
  agregar la tabla a `TENANT_TABLES`, o el re-chequeo de pertenencia.

## Barrido rápido (grep de arranque)

- `getSupabaseServer(` fuera de `lib/workspace.ts`, `lib/supabase.ts`, y las libs
  de excepción → candidatos a leak (clase 1).
- Tablas nuevas: grep de `workspace_id` en migraciones recientes vs el set
  `TENANT_TABLES` → detecta la clase 2.
- En `app/api/**`: ids leídos de `body`/`searchParams` usados en `.eq('id', …)`
  o en `.from()` crudo → candidatos a IDOR (clase 3).
- `.storage`/`.rpc(` en libs por-cliente → clase 4.

## Antes de dar por terminado

Leé la ruta de forma ADVERSARIAL: "si soy el workspace B, ¿puedo ver/tocar algo
del workspace A con este endpoint?". Si la respuesta no es un no rotundo,
reportalo. Relacionado: `lib/workspace.ts` (getTenantDb/TENANT_TABLES/guards),
skill `tenant-safe-query` (cómo escribirlo bien), `lib/tab-access.ts`.
