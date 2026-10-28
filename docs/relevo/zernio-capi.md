# Relevo — Zernio y CAPI (Meta por la Zernio del negocio, el token de Meta deprecado)

**Escrito el 25/10/2026 por el chat «Zernio y CAPI» (cuenta 5, `claude5`).** Rama `zernio-2510` (worktree
`C:/dev/wt-zernio-2510`). La sube el Cerebro en el tren; este chat no pushea.

Martín, 25/10: «implementa zernio y depreca la conexión con API de Meta... Y también revisa el tema de CAPI y alimentar al
pixel, como lo hariamos y deja un tutorial de como hacerlo en caso de que requiera una integración aparte».

## Lo que quedó (tanda 1)

- **La vía, en un lugar:** `canalMeta(ws)` (lib/meta-via.ts). Zernio primero si el negocio tiene su conexión `metaads`
  (`META_ZERNIO_CUENTA`) y su cuenta publicitaria; el `META_ACCESS_TOKEN` de antes, de respaldo para LEER.
- **Por Zernio ya leen:** el cron diario de métricas (insights, creativos con permalink, presupuestos de conjuntos), la
  salud de la cuenta (tarjeta de Meta en /integraciones y el Semáforo de /general), el modal del anuncio (Ads Analyst, Script
  Analyst, Dashboard), los desgloses de audiencia del Dashboard y la transcripción de los anuncios (el video sale de
  `GET /v1/ads/{adId}/media`, la salida al `source` que Meta dejó de devolver).
- **CAPI:** por Zernio (`POST /v1/ads/conversions`, la misma conexión, sin pegar nada); si Zernio no tiene permiso sobre el
  píxel, por la Graph API con el token del píxel (`META_CAPI_TOKEN`, ahora visible como «Token del píxel»); el token de Meta,
  último. Los cuatro eventos y sus `event_id` no cambian.
- **La pantalla:** «Conectar con Facebook» arriba del modal de Meta (`ConectarMetaZernio`), con la elección de cuenta y de
  píxel; con Zernio activo, el token no se pide y el que lo tenía lo ve plegado como «conexión anterior».
- **«Meta conectada»** acepta la conexión de Zernio en los tres lectores (`metaConectadaConCampos`): el cron, el chat de
  arranque (que posterga el paso de integraciones) y el medidor ven a un negocio conectado sólo por Zernio.
- **El tutorial:** en la app, el «?» de «Token del píxel» (pasos numerados) y una línea de deduplicación en el del píxel; entero,
  con el `eventID` y el Schedule doble de Mauricio, en `docs/tutorial-capi-pixel.md`.
- **Prendido para todos el 25/10** (`ZERNIO_META_PROBADO = true`, lib/zernio-meta-cuerpo.ts) con la prueba pasada primero en el
  negocio de la plataforma. Un negocio cambia de camino recién cuando conecta («Conectar con Facebook»); el que no conecta sigue
  con su token hasta el corte (`CORTE_TOKEN_META`, que se fija el día del aviso).

## La prueba en la cuenta de MaKo (25/10/2026)

- **Clic 1 (12:38): sin conexión** (0 cuentas en la Zernio de la plataforma). **Clic 2 (12:44), con `pageId` fijo: conectada**
  (`6ade25185b6c93612b7cc6a1`, ve `act_1426493815659364` «MaKo», USD, activa, y el píxel «MaKo (MaKo)» `1869323014511830`).
  La causa: varias páginas sin `pageId`. El botón de los clientes tenía el mismo hueco: ahora manda la página que MaKo conoce,
  pregunta si hay varias, y si la ventana vuelve sin conexión pide la página y reintenta (`paginaParaConectar`).
- **`leer` (sin guardar nada en producción): anda.** Insights, creativos, conjuntos en vivo, cuenta y finanzas contestan con la
  forma esperada; la cuenta nunca gastó, así que no hay filas que comparar con Meta directo.
- **`guardar --si`: HECHO después del deploy** (main 9c684f88c, 14:54). El negocio de MaKo quedó con la conexión, la cuenta
  `act_1426493815659364` y el píxel `1869323014511830`; los crons de Meta ya corren para él por Zernio (medido con las funciones
  reales: Meta conectada, lecturas sin errores, salud en verde, CAPI por la conexión de Facebook).
- **El nivel anuncio, medido con la tarjeta (25/10):** sobre la campaña de prueba del Media Buyer (en pausa), Zernio da el
  conjunto con presupuesto 1 USD en unidades, el anuncio con imagen, miniatura y post, y las finanzas con la tarjeta.
- **CAPI: PROBADO (~20:35 UTC) con TEST96217** — dos Lead de prueba (el script y `probar_capi_meta`), `eventsReceived: 1` cada
  uno. Con eso `ZERNIO_META_PROBADO = true`: Meta por Zernio queda prendido para todos los negocios que conecten.
- **Lo que falta ver con datos reales:** filas de insights (la cuenta de MaKo no gasta): en el primer cron de un negocio que
  gaste y conecte (Código Inmobiliario ya tiene clave de Zernio).
- **La vuelta sin sesión perdía la query** (`/login?…&next=%2Fintegraciones`): arreglado en `proxy.ts` (`denegar`), con test.

## La deprecación del token de Meta (pedido de Martín, 25/10 ~15:40)

«manda un aviso a todos los clientes que conecten Zernio y si no conectan dentro de 1 semana ya no podrán administrar anuncios en
MaKo». El orden lo decidió el Cerebro: (1) medir quién usa el token, (2) prender Meta por Zernio para clientes con CAPI y el nivel
anuncio probados, (3) recién ahí el aviso, (4) el nombre y el logo.

- **(1) Medido** (sólo lectura): 5 negocios usan el token hoy, 4 lo tienen sin uso. Lista y texto del aviso: en la carpeta de
  notas del Cerebro (`zernio-aviso-token-meta-25-10.md`), con los montos; acá no van.
- **El corte, listo y apagado:** `CORTE_TOKEN_META` (lib/zernio-meta-cuerpo.ts, hoy `null`). Con una fecha, pasado ese día un
  negocio SIN la conexión de Zernio no escribe con el token (`escribirEnMeta` y las puertas de `meta-ads-create`: crear, subir,
  formulario, borrar) y ve «Desde el DD/MM MaKo administra tus anuncios sólo con tu conexión de Zernio…». Leer métricas sigue.
  Se fija el día que sale el aviso: una semana después.
- **La conexión se guarda venga del botón que venga** (`conectada-meta` en la pieza común): conectar «Anuncios de Meta» desde la
  tarjeta de Zernio (el link del aviso, `?abrir=zernio`) o desde el Media Buyer ahora deja la conexión guardada en el negocio.
  Antes sólo lo hacía el modal de Meta.
- **(4) Hecho:** la tarjeta se llama «Zernio» y lleva su logo oficial (la marca blanca de zernio.com/icon.svg sobre #EB3514; el
  violeta de antes no era el suyo). La revisión de los demás logos la hace Settings.

## En la API de MaKo (área integraciones)

| Operación | Tipo | Ruta | Qué |
|---|---|---|---|
| `ver_conexion_meta` | lectura | GET /integraciones/meta/conexion | la vía, las cuentas, los píxeles, la página y por dónde sale CAPI (sin tokens) |
| `elegir_cuenta_meta` | acción con «sí» | PUT /integraciones/meta/cuenta | la cuenta publicitaria, entre las que ve la conexión |
| `elegir_pixel_meta` | acción con «sí» | PUT /integraciones/meta/pixel | el píxel de las conversiones |
| `elegir_pagina_meta` | acción con «sí» | PUT /integraciones/meta/pagina | la página de los anuncios (antes de conectar, o en la conexión) |
| `probar_capi_meta` | lectura | GET /integraciones/meta/prueba-capi | un Lead de prueba con el código de «Probar eventos» |

Conectar en sí («Conectar con Facebook») es un clic de una persona: por la API sale el link.

## Lo que es de Martín (en orden)

1. **El clic de permisos en Facebook.** `node --env-file=<clon>/.env.local --conditions=react-server --import tsx
   scripts/prueba-zernio-meta.mts conectar` imprime el link (vence a los 30 min: pedirlo con Martín enfrente). Pide «Control
   total» (`full`) sobre `act_1426493815659364`: cubre también la prueba del Media Buyer (que pide `advertise`). Un solo clic
   para las dos.
2. Después, sin Martín: `… guardar --si` (guarda la conexión en el negocio de MaKo), `… leer` (insights, conjuntos y salud por
   Zernio) y `… capi --si --codigo=TEST…` (el código de «Probar eventos» del píxel de MaKo: un Lead de prueba que no ensucia el
   píxel).
3. Con las tres en verde y su resultado escrito en `docs/hallazgos-integraciones.md`: prender `ZERNIO_META_PROBADO`. Desde ahí
   un negocio nuevo conecta Meta sólo con «Conectar con Facebook».

## El reclamo a Zernio: `testCode` de CAPI no llega a Meta (ENVIADO, no reenviar)

Zernio no reenvía el `testCode` de `POST /v1/ads/conversions` (medido el 25/10/2026: los Lead de prueba entraron al píxel de MaKo
como eventos reales; por eso las pruebas mandan `PruebaMaKo`). El reclamo SALIÓ el 26/10/2026 a las 10:25 (13:25 UTC): lo mandó el
Cerebro por mail, con el sí de Martín, desde MaKo <equipo@hola-mako.com> (Resend, reply-to equipo@) a support@zernio.com, con el
borrador de las notas tal cual (sólo la cuenta, el píxel y los traceId de MaKo). Id de Resend: `01a17862-f17d-7398-bef6-a9ac5a522643`.
La respuesta llega a equipo@hola-mako.com (lo reenvía Porkbun). **No mandarlo otra vez** (ni por mail ni por su API de soporte,
«Ana»): si Zernio contesta que lo arregló, se prueba con `probar_capi_meta` y un código de «Probar eventos» antes de volver a
mandar un Lead de prueba.

## El inventario: lo que MaKo hace con el token de Meta y lo que cubre Zernio

Medido en el código el 25/10/2026 (un agente de lectura, archivo por archivo) y en la OpenAPI de Zernio v1.356.1. `permiso`:
lo que pide la conexión (`advertise` = «Administrar campañas»; `full` = «Control total»). «Sin medir» = leído, no probado.

| Qué | Hoy, por el token | Zernio | Permiso | En esta rama |
|---|---|---|---|---|
| Insights diarios (cron) | `fetchMetaInsights` lib/meta-ads.ts | `GET /v1/ads/insights` (paso directo) | advertise | **Por Zernio** |
| Creativos del cron | `fetchAdCreatives` | `GET /v1/ads/tree` (`creative`, permalink) | advertise | **Por Zernio** |
| Presupuestos de conjuntos | `fetchAdsetBudgets` | `GET /v1/ads/accounts/live?level=adSet` | advertise | **Por Zernio** |
| Salud de la cuenta / Semáforo | `fetchAccountRaw` lib/meta-health.ts | `GET /v1/ads/accounts` + `/accounts/finance` | advertise (las finanzas: sin medir) | **Por Zernio** |
| Modal del anuncio (Ads/Script Analyst, Dashboard) | app/api/ad-insights/route.ts | `GET /v1/ads/insights?objectId=<ad>` | advertise | **Por Zernio** |
| Desgloses de audiencia | lib/meta-desgloses.ts | `GET /v1/ads/insights` con `breakdowns` | advertise | **Por Zernio** |
| CAPI (Lead, calificado, Schedule) | lib/meta-capi.ts | `POST /v1/ads/conversions` | **sin medir** (full seguro) | **Por Zernio**, token del píxel de respaldo |
| Píxeles de la conexión | `listPixels` | `/v1/accounts/{id}/conversion-destinations`, `tracking-tags` | advertise | Al conectar (lib/meta-conexion-zernio.ts); el selector de campañas, no |
| Árbol (campañas, conjuntos, anuncios) | `_getMetaHealth`, `campanasYConjuntos` | `/v1/ads/accounts/live` + `/v1/ads` (la lista) | advertise | **Por Zernio** (26/10, medido) |
| Escrituras (pausar, presupuesto, nombre, borrar) | lib/meta-write.ts | `PUT …/status`, `PUT /ads/campaigns|ad-sets/{id}`, `PUT /ads/{id}`, `DELETE` | advertise | **Por Zernio** (26/10, medido en los 3 niveles; lib/meta-escribir-zernio.ts) |
| Crear campañas y anuncios | lib/meta-ads-create.ts | `POST /v1/ads/create`, `/ads/images`, `/ads/videos` | advertise | El ANUNCIO en un conjunto, **por Zernio** (26/10, medido: con imagen y reusando un post); campaña y conjunto nuevos, **no**. Ninguna pantalla crea campañas |
| Leer y cambiar textos, datos de campaña y conjunto, público (lectura), cuenta, píxeles | `getAdForEdit`, `updateAdCopy`, `getCampaignBasics`, `getAdsetForAdd`, `getAdsetTargeting`, `cuentaMeta`, `listPixels` | paso directo `GET /ads/campaigns|ad-sets|creatives/{id}`, `/ads/{id}`, `/ads/accounts`, `conversion-destinations` | advertise | **Por Zernio** (26/10, medido) |
| Públicos personalizados | `listCustomAudiences` / `createCustomAudience` | `GET/POST /v1/ads/audiences` | advertise | Listar, **por Zernio** (la cuenta de MaKo no tiene: forma sin medir con datos); crear, **no** |
| Editar el público | `editarPublicoConjunto` | `PUT /ads/ad-sets/{id}` con `TargetingSpec` (otra forma) | advertise | **No** (sin token lo dice) |
| Formularios de leads | `listLeadForms` / `crearFormularioInstantaneo` | `GET/POST /v1/ads/lead-forms` | página con leads | **Por Zernio** listar y crear (26/10, medido; el de prueba quedó archivado) |
| Leads de formularios | webhook de Meta + `pollMetaLeads` | `lead.received` (hecho) + `GET /v1/ads/leads?since=` | página con leads | Webhook sí (23/10); el barrido, **no** |
| Video del anuncio (transcripción) | lib/transcribe.ts | `GET /v1/ads/{adId}/media`: links directos y firmados de cada video e imagen del anuncio | advertise | **Por Zernio** (los tres llamadores piden `accesoDeMeta`) — y es la salida al `source` que Meta dejó de dar (hallazgos-ads, «Meta dejó de devolver `source`»): sin medir con un video real |
| Reproductor del anuncio | app/api/anuncios/video/route.ts | `GET /v1/ads/{adId}/preview` (un `<iframe>` por ubicación) o `/media` | advertise | **No** |
| Perfil de Instagram (@ de un lead) | lib/instagram-perfil-server.ts, instagram-buscar | — (Business Discovery no está en Zernio) | — | **No hay salida simple** |
| Recomendaciones de la cuenta | `fetchAccountRecommendations` | — (`/v1/ads/recommendations` es sólo de Google) | — | **No hay salida**: sin token quedan las sugerencias propias de MaKo |
| Onboarding | no pide Meta desde el 16/10 (chat de arranque) | — | — | La regla de «conectada» ya ve Zernio |

## Sin token: leer, editar, borrar y crear anuncios (26/10/2026, pedido del Cerebro antes del corte del 03/11)

Hecho y medido en la cuenta de MaKo (`scripts/prueba-zernio-escribir.mts`: `crear`, `arbol`, `editar`, `anuncios`, `formulario`,
`borrar`, `borrar-niveles`; cada paso que escribe pide `--si`, todo en pausa, gasto 0). El detalle y las trampas, en
docs/hallazgos-ads.md → «Un negocio SIN token administra sus campañas por Zernio».

**La tanda C (lo que sigue por el token), en el orden de valor y con lo que ya se sabe:**
1. Editar el público (`editarPublicoConjunto`): `PUT /ads/ad-sets/{id}` con `targeting` en la forma de Zernio (`TargetingSpec`,
   fusiona claves). Hace falta un traductor del crudo de Meta a esa forma que no pierda lo que el editor no maneja.
2. Crear campaña y conjunto: no hay pantalla que lo pida (decisión de producto, del Cerebro con el Media Buyer). Por Zernio sería
   `POST /ads/create` (forma «legacy», o `existingCampaignId`); recordar que nacen prendidos el conjunto y el anuncio.
3. El barrido de leads (`pollMetaLeads`): `GET /ads/leads?accountId&since=` sale del caché de Zernio, que se llena con SU webhook;
   la forma del REST NO es la del webhook (lib/zernio-lead.ts lo avisa): medir con un lead de prueba
   (`POST /ads/lead-forms/{id}/test-leads`) sabiendo que un lead en el negocio de MaKo dispara sus avisos.
4. El reproductor: `/ads/{adId}/media` da el .mp4; la pantalla (app/dashboard/graficos/ReproductorAnuncio.tsx) dibuja el plugin de
   facebook.com del `embed_html`. Cambia lo que dibuja: coordinar con quien tenga el Dashboard.
5. Crear públicos (`POST /ads/audiences`), el alcance (`/ads/targeting/reach-estimate`; buscar intereses y lugares ya va por
   `/ads/targeting/search`, 26/10, medido), conversiones y eventos del
   píxel, `getInstagramActorId` y `paginasDeGanadores`, aprobación (`/ads/{id}/review`). Las identidades (`identidadesMeta`) ya
   van por `/ads/instagram-accounts` (26/10, medido).

## Varias claves de Zernio en un negocio (pedido del 27/10, SIN HACER)

Leila (876470842-23): «se pueden cargar varias claves de Zernio (de distintos emails) eligiendo cuál usa cada red». Hecho el 27/10:
el aviso antes de conectar la cuenta que se paga. Lo de varias claves, no, porque cada clave es OTRO equipo de Zernio:
1. El catálogo: `ZERNIO_API_KEY` con cuentas (el mecanismo `slot` + email de las claves de IA, lib/metodo-catalogo.ts) y un ajuste
   `zernio.clave_por_red` (red → número de cuenta).
2. Quién pide la clave tiene que saber la red: `cfg(ws)` (lib/zernio.ts, el canal), `claveZernioAnuncios(ws)` (lib/zernio-ads.ts,
   del Media Buyer, y `canalMeta`), `contexto(ws)` (lib/zernio-conectar.ts).
3. Cada equipo tiene su perfil, su webhook y su secreto de firma: `asegurarWebhook` por clave, y el webhook
   (app/api/webhooks/zernio/route.ts) tiene que probar la firma con el secreto del equipo que manda (hoy uno por negocio), y el ruteo
   por perfil (`RUTEO_PERFIL`) ya admite varios perfiles por negocio.
4. Medir con dos cuentas de Zernio reales antes de prenderlo (nunca primero en un cliente).

## Lo que no se puede (o no tiene salida simple)

- **Business Discovery de Instagram** (leer el perfil público de un @ que no es tuyo): Zernio no lo expone.
  `lib/instagram-perfil-server.ts` y `app/api/crm/instagram-buscar/route.ts` siguen con el token de Meta (el del negocio, y en
  `porMeta` también el de la plataforma).
- **Las recomendaciones de Meta de la cuenta** (`fetchAccountRecommendations`): `/v1/ads/recommendations` de Zernio es sólo de
  Google. Sin token quedan las sugerencias que deriva MaKo (`sugerenciasMako`).
- **El botón para la cuenta de MaKo:** el negocio de la plataforma (ws9) no tiene Zernio propia, y `<ConectarViaZernio>` usa la
  clave DEL NEGOCIO: para MaKo la conexión sale por el script, no por el botón.

## Para el Media Buyer (avisado por mensaje)

`GET /v1/ads/accounts/live` trae el interruptor propio (`configuredStatus`) de campañas y conjuntos: lo que su entrada anotó que
el árbol no tiene.

## MAU-10: la venta de un Payment Link propio (estado al 28/10/2026, `claude4` en la PC)

- **Hecho, con el interruptor `cobros.ventas_externas` APAGADO en todos:** la venta de un Payment Link de SU Stripe entra
  como cobro externo ya pagado, con su lead, su cuota y la compra a Meta (`purchase:<cs_>`, al píxel del sitio). La compra
  va sólo al píxel y nunca en modo prueba (761061085). Lo de punta a punta lo prueba tests/venta-externa.test.ts. Detalle y
  trampas: docs/hallazgos-pagos.md («La venta de un Payment Link propio ya entra…») y docs/diseno-venta-externa-stripe.md §8.
- **Para el Cerebro / Martín (no lo hace este chat):**
  1. La prueba en el ws 3 con Stripe en modo prueba: no hay claves `sk_test` en el proyecto. Hace falta conectar una
     cuenta de Stripe de prueba al ws 3, prender el interruptor ahí y pagar un Payment Link de prueba.
  2. Conectar el Stripe de Mauricio (ws1) y prender el interruptor en el ws1: el sí de Martín.
  3. Que el Payment Link del Sprint de Mauricio vuelva a la página de gracias con `?session_id={CHECKOUT_SESSION_ID}`: se
     cambia en SU Stripe («Después del pago»), no en el código.
- **Pixel v28:** origin/main ya está en v28 (`SNIPPET_VERSION = 28`); esta rama no lo vuelve a tocar.
- **La verificación de la rama unida con Planes (3ca2d8328, 28/10):** el cruce del `client_reference_id` (un Payment Link con
  el token de un cobro de MaKo lo marcaba pagado; era anterior a MAU-10 y estaba en producción) lo arregló Planes (a5f61f0c8).
  Este chat: el reintento enseguida de una venta cortada (era un 200, ahora 503) y la compra a Meta de una venta cortada en la
  cuota (la manda el cron). Sigue sin
  hacer: completar una venta externa pagada SIN lead que terminó en 200 (el cron sólo repara pagados con lead).

## Rojos que no son de esta rama

`tests/zernio-conectar-redes.test.ts` → «la pantalla: la ventana se abre EN el clic…»: la regex no encuentra
`if (errorDeVentana) { fallar(…) }` en `app/_components/ConectarViaZernio.tsx`, que esta rama no toca (rojo de main).
