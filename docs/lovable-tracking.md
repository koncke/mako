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

No cambió, salvo el agregado de `t`:

| Evento | Payload |
| --- | --- |
| Visita | `{ t, visitor_id, tipo_evento:'pageview', landing_url, referrer }` |
| Play | `{ t, visitor_id, tipo_evento:'play', porcentaje:0, video_id, vsl_titulo }` |
| Retención | `{ t, visitor_id, tipo_evento:'p05'…'p100', porcentaje, video_id, vsl_titulo }` |
| Abandono | `{ t, visitor_id, tipo_evento:'exit', porcentaje, video_id, vsl_titulo }` |

- `visitor_id`: UUID anónimo de la cookie `nqe_visitor_id` (1 año). El mismo UUID
  llega como `utm_term` al agendar en Calendly → así se cruza comportamiento por
  persona.
- `l` (opcional): Camino 1 — el `meta_lead_id` que el link de WhatsApp pega como
  `?l=…`. Cose el `visitor_id` anónimo al lead conocido en el acto.
- El token también se acepta como `ws_token` en el body o `?t=` en la query.

## CORS

`Access-Control-Allow-Origin: *`, sin credenciales: cada cliente sirve su landing
desde **su** dominio, así que no hay allowlist de origins que valga para todos.
El token es el que identifica al workspace. `VSL_ALLOWED_ORIGINS` sigue
existiendo pero **solo aplica a los beacons legacy sin token** (ver arriba):
aplicárselo a un beacon con token bloquearía a todos los clientes.
