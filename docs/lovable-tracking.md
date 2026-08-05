# Snippet de tracking para la landing

> **El snippet ya no se copia de acá.** Vive en la app, con el token de cada
> workspace embebido: **/integraciones → Landing / VSL → "Copiar código"**.
> Pegalo antes de `</body>` en tu landing (Lovable, Framer, Webflow, WordPress,
> HTML plano — da igual). Este documento explica cómo funciona por dentro.

## Por qué hay un token

El beacon (`POST /api/track/vsl`) llega **sin sesión**: es un `<script>` en una
página pública. La única pista de a qué cliente pertenece cada evento es un
identificador en claro dentro del payload. Ese identificador es el campo `t`:
el **token público de landing** del workspace (`mko_` + 32 hex).

- Se guarda en `app_settings.landing_token` (por workspace) y se espeja a
  `webhook_routing('landing', <token>, <ws>)` — el mismo índice de plataforma
  que usan los webhooks de Meta / Chatwoot / Calendly / Fathom.
- El beacon resuelve `wsPorIdentificador('landing', t)` y escribe **todo**
  (`landing_visits`, `vsl_events`, el stamp del Camino 1) dentro de
  `runWithWorkspace(ws)`.
- **NO es un secreto**: viaja en el HTML de una página pública, como cualquier
  pixel. Solo *identifica* al workspace; no autoriza a leer nada.

## Fail-closed

Un beacon **sin token**, o con un token que no resuelve, **no escribe nada**:
responde `200 {ok:true, ignored:'sin workspace'}` y loguea un `console.warn`.
Responde 200 a propósito — un fallo de tracking nunca debe romper la landing del
cliente.

Antes de esto, el beacon caía a `getTenantDb()` sin sesión → workspace del dueño
(ws 1), y con más de un cliente la analítica de landing de **todos** se mezclaba
ahí. Un token que no resuelve **nunca** cae al dueño: sería exactamente el
misrouteo que esto vino a arreglar.

### Migración de una landing con el snippet viejo

El snippet anterior (el que estaba en este documento) **no manda `t`** → con
fail-closed sus eventos se descartan. Para migrar: copiá el código nuevo de
/integraciones → Landing y reemplazá el bloque viejo.

No hay flags ni variables de entorno para esto: el camino es el mismo para el
dueño que para cualquier cliente nuevo — pegar el código. Mientras el snippet
viejo siga puesto, sus eventos se descartan (queda el warning en el log), así
que conviene hacer el cambio apenas deployás.

## Contrato del payload

| Evento | Payload |
| --- | --- |
| Visita | `{ t, visitor_id, tipo_evento:'pageview', landing_url, referrer }` |
| Play | `{ t, visitor_id, tipo_evento:'play', porcentaje:0, segundos:0, video_id, vsl_titulo }` |
| Retención | `{ t, visitor_id, tipo_evento:'p05'…'p100', porcentaje, segundos, video_id, vsl_titulo }` |
| Retención por tiempo | `{ t, visitor_id, tipo_evento:'s15'…'s2400', segundos, video_id, vsl_titulo }` |
| Abandono | `{ t, visitor_id, tipo_evento:'exit', porcentaje, segundos, video_id, vsl_titulo }` |

### Por qué `segundos` y por qué los hitos `sNN` (2026-08-05)

El reproductor de Panda emite `panda_timeupdate`, pero su payload trae **solo**
`{ message, video, currentTime, isMutedIndicator, isPreviousProgressLoaded }`:
**no trae `duration`**. El snippet viejo hacía `if (!dur) return;` y por eso
salía en *todos* los eventos — cero hitos de retención y el `exit` siempre en 0%.
Fue la causa exacta del apagón del 15/jul al 5/ago de 2026.

La duración solo llega por `panda_allData` (`playerData.duration`), que el player
emite por su cuenta y que **no se le puede pedir**: los mensajes que acepta del
padre son `play`, `pause`, `currentTime`, `volume`, `speed`, `colors` y
`fullscreen` — ninguno de lectura.

Por eso el navegador dejó de ser la autoridad del porcentaje:

- manda **siempre** `segundos` (el `currentTime`, que Panda sí da siempre);
- manda `pNN` cada 5% **si** llegó a conocer la duración;
- y si no la conoce, marca por tiempo con `sNN` (15s, 30s, 60s, 120s, 180s,
  300s, 420s, 600s, 900s, 1200s, 1800s, 2400s).

El servidor deriva el % con la duración que ya trae la API de Panda
(`lib/panda.ts` → `fetchPandaRetention`). Es retroactivo: los eventos guardados
se pueden volver a porcentuar sin haber perdido nada.

⚠️ Un `exit` sin `porcentaje` se guarda **NULL**, no 0. «No medido» y «no miró»
son cosas distintas: confundirlas es lo que hizo que 18 días sin instrumentación
parecieran 18 días de gente que abandonaba en el segundo cero.

- `visitor_id`: UUID anónimo de la cookie `nqe_visitor_id` (1 año). El mismo UUID
  llega como `utm_term` al agendar en Calendly → así se cruza comportamiento por
  persona.
- `l` (opcional): Camino 1 — el `meta_lead_id` que el link de WhatsApp pega como
  `?l=…`. Cose el `visitor_id` anónimo al lead conocido en el acto.
- El token también se acepta como `ws_token` en el body o `?t=` en la query.

## CORS

`Access-Control-Allow-Origin: *`, sin credenciales: cada cliente sirve su landing
desde **su** dominio, así que no hay allowlist de origins que valga para todos.
El token es lo único que identifica al workspace.

No hay `VSL_ALLOWED_ORIGINS` ni ninguna otra allowlist por env — se quitó del
código y este doc afirmaba lo contrario. Ver el comentario de
`app/api/track/vsl/route.ts`: nada de esto se configura en el servidor.

## Al cambiar el dominio de la app

⚠️ **El snippet queda congelado con la URL del día que se copió.** Es HTML pegado
en una propiedad de un tercero: no se entera nunca de una mudanza de dominio, y
hay que re-pegarlo en la landing de **cada** cliente.

Falla en silencio y de la peor forma: el beacon hace `fetch(...).catch(function(){})`
y el receptor devuelve 200 aunque descarte el evento, así que no hay ni un error en
consola. Precedente medido: **18 días de tracking muerto** (2026-07-15 → 08-03) con
anuncios corriendo, sin que ninguna señal de negocio lo detectara.

Pasos: `/integraciones` → tarjeta **Landing / VSL** → **Copiar código** → reemplazar
el bloque `<script>` en la landing → publicar → verificar que entran filas nuevas
(`SELECT max(created_at) FROM landing_visits WHERE workspace_id = <ws>`), no dar por
hecho que anduvo. El `TOKEN` del snippet **no cambia** con la mudanza: mapea el
workspace en `webhook_routing` y es independiente del dominio.
