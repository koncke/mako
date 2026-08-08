# Arreglar el page id partido en dos (cron de leads roto)

`2026-07-31 14:56` → `2026-07-31 15:08` · 1 mensajes de Martín · 31 respuestas de Claude · sesión `aca2b6d2`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-07-31 14:56`

En dashboard-marketing hay un mismatch de almacenamiento del ID de página de Meta que rompe el cron de respaldo de Lead Ads para todo workspace que no sea el dueño (OWNER_WS).

Evidencia verificada:
- lib/meta-leads.ts:107 lee el token con `credWs('META_PAGE_ACCESS_TOKEN')` (la credencial del catálogo, que el cliente carga en /integraciones).
- lib/meta-leads.ts:114 lee el page id con `configWs('meta_page_id', ...)` — una SETTING distinta, no la credencial `META_PAGE_ID` del mismo catálogo (lib/metodo-catalogo.ts:458).
- La setting `meta_page_id` solo aparece en app/api/onboarding/route.ts (líneas 43, 95, 133); verificar si alguna UI la escribe realmente. El cliente sí carga `META_PAGE_ID` como credencial.
- Resultado: el cliente completa el campo en /integraciones, el webhook (que usa webhook_routing) funciona, pero `pollMetaLeads` tira "meta_page_id no configurado para este workspace" todos los días.

Tarea: unificar en una sola fuente de verdad. Ojo: la escritura tiene que seguir pasando por `guardarCredencial()` (lib/credenciales.ts) porque reclama el ruteo fail-closed en la tabla `webhook_routing` y lanza IdentificadorOcupadoError; `setSetting` llama a upsertRouting pero IGNORA el resultado (un "ocupado" se traga en silencio). Ver la memoria "auditoria-rutas-bundle-api-fila" sobre secuestro de webhooks entre inquilinos.

Verificar el fix impersonando a un cliente (no al dueño), porque con OWNER_WS el fallback al env tapa el bug.

### Claude

I'll start by verifying the evidence in the actual code before changing anything.

### Claude

Neither file exists at that path. Let me check what's actually in the working directory.

### Claude

The repo is nested one level deeper. Let me read the actual files.

### Claude

Evidence confirmed on both files. Now let me verify the rest of the claims — the catalog entry, `configWs`/`setSetting`, and every reader/writer of both identifiers.

### Claude

Now the two write paths — `settings.ts` (which swallows the "ocupado") and the routing index.

### Claude

Every claim checks out. Let me look at the one place that writes the setting, plus the catalog entry.

### Claude

Let me confirm whether any UI actually writes the `meta_page_id` setting, and how the webhook resolves the workspace.

### Claude

One line in the webhook grep looks malformed (`\ Fail-CLOSED:` instead of a comment). Let me check that it's a grep artifact and not real.

### Claude

The webhook file is fine — that was a grep artifact. Now let me check the real data state in the DB before deciding whether a backfill is needed.

### Claude

Now let me query the real DB (read-only) to see the actual state of both stores.

### Claude

Module resolution needs the script inside the repo. Let me run it from there.

### Claude

Decisive: **zero** rows in `app_settings['meta_page_id']` — the setting is written by nobody, so no backfill is needed. And ws 3 has the Meta token but no page id, which is exactly the failing case. Let me check the cron and the catalog's meta service.

### Claude

Full picture confirmed. Let me check one adjacent detail before editing — the other setting that shares the swallow-the-conflict path.

### Claude

`landing_token` is server-minted (deterministic HMAC), so its routing claim can't realistically collide — the swallow only matters for user-pasted identifiers like the page id. Now the fix.

### Claude

Now close the second store so nothing can write it again.

### Claude

Now the typecheck, then live verification impersonating a client.

### Claude

Typecheck is clean. Now let me verify against a real client workspace. First, how workspace context resolves outside a request.

### Claude

`runWithWorkspace` sets an AsyncLocalStorage that bypasses cookies, so I can exercise the real code path as a client outside a request. Let me write the verification.

### Claude

`next/headers` needs extension resolution outside Next. A small resolve hook fixes that without touching the repo.

### Claude

Extensionless TS relative imports too. Let me generalize the hook.

### Claude

Node's strip-only mode can't handle parameter properties. Enabling full transform.

### Claude

All 12 checks pass under a **client** workspace. Let me clean up and confirm the client-facing write path is the same one.

### Claude

DB is back to its pre-test state, no residue. Final check that no reference to the dead setting remains.

### Claude

One stale comment now points at the wrong pattern. Fixing it.

### Claude

Other files are modified by a parallel session. Let me check whether their work touches my fix before committing only mine.

### Claude

The parallel session is auto-filling `META_PAGE_ID` from the main token — same source of truth my fix reads. Let me confirm their writer uses the fail-closed path.

### Claude

Their discovery targets the same credential — my fix composes with their work. Committing only my files.

### Claude

The commit message picked up a stray `@` from PowerShell here-string syntax I shouldn't have used in Bash. Let me check and fix.

### Claude

The pre-push hook blocked it — but those errors are in a file the parallel session is editing right now (it wasn't even modified when I checked minutes ago). Let me confirm none of them are mine.

### Claude

The parallel session finished their edit — the tree typechecks clean now. Retrying the push.

### Claude

Pushed to `main` (`cecf6f0`), typecheck green.

## Qué encontré

Tu diagnóstico era correcto, y la base lo confirmó de forma contundente: **`app_settings['meta_page_id']` tiene 0 filas en todos los workspaces**. No es que la UI escribiera en el lugar equivocado — es que *nadie* escribía esa setting. El único escritor posible era la whitelist del wizard en [route.ts:43](dashboard-marketing/app/api/onboarding/route.ts:43), y ninguna UI mandaba esa key. Así que `pollMetaLeads` fallaba para todo workspace que no fuera el dueño, con el campo completo y el webhook funcionando.

El caso vivo es el ws 3 ("Cliente de Prueba"): tiene `META_PAGE_ACCESS_TOKEN` cargado y ningún page id, así que entraba al loop del cron y reventaba a diario.

## El fix

Unifiqué en la credencial `META_PAGE_ID`, no en la setting — porque escribirla pasa por `guardarCredencial()`, que reclama el identificador y falla cerrado con `IdentificadorOcupadoError`:

- [lib/meta-leads.ts:120](dashboard-marketing/lib/meta-leads.ts:120) — `credWs('META_PAGE_ID')`, conservando el fallback al literal solo para el dueño.
- [app/api/onboarding/route.ts:42](dashboard-marketing/app/api/onboarding/route.ts:42) — saqué `meta_page_id` de la whitelist, para que no pueda volver a nacer el segundo almacén.
- [lib/settings.ts:63](dashboard-marketing/lib/settings.ts:63) — saqué `meta_page_id` del espejo de routing. Queda solo `landing_token`, y ahí dejé anotado por qué es el único que puede estar: lo acuña el server (HMAC por ws), nadie lo elige, así que el "ocupado" que `setSetting` se traga no es explotable. Los identificadores que pega el usuario van todos por `guardarCredencial()`.

## Verificación (ws 3, no el dueño)

Ejecuté el código real bajo `runWithWorkspace(3, …)` — el mismo mecanismo que usa `correrPorWorkspace`. 12 chequeos, todos verdes:

- La setting vieja vacía → el camino viejo **siempre** fallaba.
- Guardar el page id del dueño desde ws 3 → `IdentificadorOcupadoError`, y el routing de ws 1 intacto (sin secuestro).
- Con su propio page id: `credWs` lo resuelve y `webhook_routing` lo mapea a ws 3.
- `pollMetaLeads` pasa el chequeo y llega hasta Meta: `Graph error (100)` por el id de prueba, en vez de "no configurado". Esa es la prueba del fix.
- ws 1 sigue resolviendo su page id real.

Borré el artefacto de prueba y reconfirmé contra la base que quedó como estaba (1 credencial y 1 fila de routing, ambas de ws 1).

**Dos cosas que vale que sepas:**

Hay otra sesión de Claude trabajando en este repo ahora mismo. Está construyendo `lib/meta-descubrir.ts`, que autocompleta `META_PAGE_ID` desde el token principal ("Lo completa MaKo al pegar el token") — o sea que apunta a la misma credencial que ahora lee el cron. Los cambios componen bien. Commiteé **solo mis 5 archivos**; el resto de su trabajo quedó sin tocar.

El primer push lo bloqueó el hook de pre-push por errores de tipos en `app/api/integraciones/credencial/route.ts`, un archivo de esa otra sesión que estaba a medio escribir (ni siquiera figuraba como modificado minutos antes). No lo toqué; terminaron su edición y el segundo push pasó limpio.

