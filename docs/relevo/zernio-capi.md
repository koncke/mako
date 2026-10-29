# Relevo — Zernio y CAPI (Meta por la Zernio del negocio, el token de Meta deprecado)

**Escrito el 25/10/2026 por el chat «Zernio y CAPI» (cuenta 5, `claude5`).** Rama `zernio-2510` (worktree
`C:/dev/wt-zernio-2510`). La sube el Cerebro en el tren; este chat no pushea.

## ESTADO DE LA CUENTA `claude4` (28/10/2026, noche) — para seguir con un «Continua»

Rama `zernio-2510`, worktree `C:/dev/wt-zernio-2510`. Nada pusheado: sube el Cerebro.

**Lo pedido, con sus palabras:**
1. El Cerebro (27/10, relevo docs/relevo/zernio-nube-2710.md): terminar MAU-10, «la venta de un Payment Link propio de Mauricio
   entra como cobro pagado al CRM», con su Purchase a Meta (`purchase:<cs_>`).
2. La verificación de 3ca2d8328 (C:/dev/revisiones/2810-verificacion-3ca2d8328.md): el reintento cortado de una venta externa
   (MEDIO) y la compra a Meta tras un corte en la cuota (BAJO). El cruce del `client_reference_id` (ALTO) lo hizo Planes.
3. Martín a Teo, por el Cerebro (C:/dev/revisiones/2810-promesas-teo.md): «fíjate todas las cosas que yo le dije que ya tiene
   MaKo y que realmente no lo tiene para implementarlo... lo del calendario que se puede hacer publicaciones directamente del
   calendar». En orden: publicar desde el Calendar; la fuente de Instagram orgánico y su lectura por WhatsApp; conectar Instagram
   y Facebook sin pegar una clave de Zernio; la prueba real de Instagram.

**Lo hecho (commit, rama `zernio-2510`):**
- MAU-10: `5a27268bc` (la venta externa, apagada, probada de punta a punta). Mezclado por Planes en `planes-2710`.
- Verificación 3ca2d8328: `042e10323` (merge con Planes) y `5e7d316eb` (503 del reclamo, compra a Meta desde el cron). En el tren
  de Planes (`a27348240`), que manda el VERDE.
- Publicar desde el Calendar: `3a7e5198d` + `3ea0de07f` (mig 0342, `programar_publicacion`, el modal, en serie).
- Instagram orgánico: `addf0aea8` (`ver_rendimiento_redes`) + `bef5bfcd3` (el aviso de Analytics dice cómo prenderlo).
- Zernio sin clave: `7495db12d` (la cuenta de la plataforma con un perfil por negocio, APAGADA detrás de
  `zernio.cuenta_de_la_plataforma`).
- Todos con tests rojo-verde, probados rompiendo y tsc acotado sin errores propios; VERDE mandados al Cerebro, que verifica
  `3ea0de07f` + `addf0aea8` + `7495db12d` + `bef5bfcd3` juntos.

**A medias (y dónde):**
- La pantalla de la cuenta de la plataforma: el modal de Zernio en /integraciones pide la key (`ConectarRedes`,
  app/integraciones/ServicioConfigForm.tsx) y su nota dice «Zernio te cobra a ti»; el paso del onboarding no existe
  (tests/sin-instagram.test.ts prohíbe un paso que nombre Instagram). Espera que Martín decida prenderla.
- Las plantillas de Instagram del Dashboard y el reporte de agencia sobre la fuente orgánica (lib/zernio-organico.ts): sin hacer.

**Falta verificar:**
- La verificación del Cerebro de los cuatro commits de arriba, y su deploy.
- La prueba real con Fiesta Music (negocio 10, Leandro), plan APROBADO por el Cerebro: A lecturas; B una historia que Leandro
  igual iba a subir + programar y cancelar otra; C «pruebafm» desde @aliensfilms y @martin.koncke. NO tocar su negocio hasta el
  aviso del Cerebro (después del deploy y de la 0342).
- El cuerpo del post para TikTok y YouTube no se midió con una cuenta real.

**Espera a Martín:**
- Aplicar la migración 0342 (la pide el Cerebro).
- Prender `zernio.cuenta_de_la_plataforma`: quién paga cada cuenta conectada y el complemento de Analytics con la cuenta de la
  plataforma («espera la decisión de Martín al prender»).
- MAU-10: conectar el Stripe de Mauricio (ws1) y prender `cobros.ventas_externas` ahí; que el Payment Link del Sprint vuelva a
  la página de gracias con `?session_id={CHECKOUT_SESSION_ID}` (en SU Stripe); la prueba en el ws 3 con una clave `sk_test`.

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

## Varias claves de Zernio en un negocio (pedido del 27/10) — DESCARTADO el 29/10

**Martín, 29/10, por el Cerebro: NO.** Cada negocio con SU cuenta de Zernio; si necesita más de 2 redes, paga su plan. Los términos
(zernio.com/tos) dicen «Abuse of the API may result in immediate suspension», y una suspensión le corta las publicaciones al
cliente. No se arma ni se vuelve a preguntar. Lo de abajo queda como historia del diseño.

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

## Las promesas a Teo (28/10/2026, el Cerebro: C:/dev/revisiones/2810-promesas-teo.md)

1. **Publicar desde el Calendar: HECHO, con la mig 0342 sin aplicar.** Detalle y trampas en docs/hallazgos-calendario.md («Una
   Publicación se programa en la red, por Zernio»). Antes de usarlo en un cliente: aplicar la 0342 y una primera publicación
   real que confirme el Cerebro (el cuerpo para TikTok y YouTube no se midió con una cuenta real).
2. La fuente de Instagram orgánico y la lectura por WhatsApp (`ver_rendimiento_redes`): HECHO; pide el complemento PAGO de Analytics de Zernio. Las plantillas del Dashboard y el reporte de agencia, SIN HACER (docs/hallazgos-integraciones.md, «Instagram orgánico por Zernio»).
3. Conectar Instagram y Facebook sin pegar la clave de Zernio: HECHO el núcleo (`cfg` cae a la cuenta de la plataforma con un perfil
   por negocio), APAGADO detrás de `zernio.cuenta_de_la_plataforma`: prenderlo es plata de MaKo y lo decide Martín. Falta la pantalla
   (el modal de /integraciones pide la key) y el paso del onboarding (docs/hallazgos-integraciones.md, «Conectar … sin pegar»).
4. La prueba de punta a punta con un Instagram real: hace falta una cuenta (la pide el Cerebro a Martín).

## Rojos que no son de esta rama

`tests/zernio-conectar-redes.test.ts` → «la pantalla: la ventana se abre EN el clic…»: la regex no encuentra
`if (errorDeVentana) { fallar(…) }` en `app/_components/ConectarViaZernio.tsx`, que esta rama no toca (rojo de main).

## RELEVO 28/10 noche (claude4, cortó por cuota): arreglos de la verificación 2810-verificacion-zernio-bef5bfcd3.md

Informe: C:/dev/revisiones/2810-verificacion-zernio-bef5bfcd3.md. El Cerebro: «Cada arreglo, con su test probado rompiéndolo.
Cuando esté, mandame VERDE sin tipos con el sha». NADA de esto está commiteado (sólo este relevo): el código vive SIN COMMITEAR
en C:/dev/wt-zernio-2510 (git status lo muestra). No se corrió ningún test ni tsc de esta ronda.

HECHO en código (sin probar):
- 0342: publicacion_intento, publicacion_clave, estado 'dudosa'.
- lib/calendario-publicar-reglas.ts: dudosa, esFallaDudosa (status 0 o >=500), huellaParaConfirmar, TOPE_TITULO_YOUTUBE.
- lib/calendario-publicar.ts (reescrito): cuenta validada contra las del negocio (guardar y programar); timeout/5xx -> 'dudosa'
  (no 'fallo'); reintento con el MISMO requestId si fue hace <4 min; 'programando' trabado >10 min -> dudosa; publicacion_clave
  (huella de la apiKey) y cancelar con clave distinta -> error, no «cancelado»; noQuedoProgramada; huellas del «sí» de la API.
- lib/calendario.ts: mover/tildar/borrar con la condición EN la escritura (sinPublicacionEnCurso); el Deshacer no devuelve la cuenta.
- app/calendario: actions (error de tildar/borrar, noQuedoProgramadaAction), CalendarioApp, PublicarEnRed (bloque dudosa).
- lib/api-mako/areas/calendario.run.ts: resumen con la cuenta y payload.huellas; ejecutar pasa { huellas }.
- lib/api-mako/rest.ts: POST /calendario/publicaciones/programaciones y GET /contenido/rendimiento-redes; recursos.ts título.
- Orgánico: organico-reglas (diaLocal, noEntregadasDe, sinMetricas por syncStatus pending/unavailable — enum de la doc de
  Zernio: synced|pending|partial|unavailable —, textoOrganico de la casa); zernio-organico (cuenta nombrada que no está = error
  con las conectadas; faltan con no entregadas y sin sincronizar; textos con byok false); contenido.run.ts fecha con diaLocal(tz).
- lib/zernio-conectar.ts: esDeLaCasa(ws, usada) = ws1 o byok false (la cuenta prestada), en fallo() y conexionesViaZernio.

AL VOLVER (21:30, cuota nueva) — HECHO además:
- tests/_calendario-publicar-hijo.ts reescrito: Zernio de mentira con cuentas POR PERFIL (acc_ig_otro es de prof_ws13),
  x-request-id idempotente y posts por clave. Casos k (cuenta ajena, lo primero), l/l2 (dudosa, mismo pedido, «No quedó
  programada»), m (trabado), n (clave cambiada), o (carrera, `antesDeEscribir`), p (Deshacer sin cuenta), q (YouTube), i2
  (huellas del «sí»). Corrido el hijo a mano: todo da lo esperado. (d) ahora es un 400 (un 500 es «dudosa»).
- tests/calendario-publicar.test.ts, tests/organico.test.ts, tests/organico-reglas.test.ts y tests/_organico-hijo.ts con los
  casos nuevos (h fecha de noche, i sin sincronizar, j unavailableMetrics, k cuenta mal tipeada, l ws1 y prestada, m Conectar).
- contenido.run.ts: cada post sin métricas dice `sin_metricas`.
- docs/api-mako.md regenerado; cosecha escrita (hallazgos-calendario: la línea del 409 corregida y los ⚠️ nuevos;
  hallazgos-integraciones: orgánico y la regla «de la casa»; índice docs/hallazgos.md).
- El script de roturas: <scratchpad>/romper-2810.mjs (19 roturas, restaura cada una; correrlo ENTERO con con-turno).

FALTA: correr calendario-publicar y organico (estaban en la cola de con-turno), romper-2810.mjs, tsc acotado, tests afectados
de a uno (api-mako-rest, sin-instagram, calendario, m-calendario, integracion-sin-salir, puente-panel-copy,
confirmacion-terceros, zernio-*), anotar las roturas en la cabecera de los tests, commit por ruta y VERDE al Cerebro.

## PEDIDO NUEVO (28/10 ~23:40, Martín por el Cerebro): los límites de Zernio, dichos al conectar — DESPUÉS de la verificación

Textual de Martín: «Super importante advertir en la conexión de Zernio las limitaciones, como que hasta 2 redes sociales es
gratis. Por lo tanto, si quieren conectar más, tal como hacemos en gemini u otros, le habilitamos para que peguen otras API
KEY de otras cuentas de google, entonces pueden tener más sin incurrir en gastos. Y la misma advertencia cuando estén por
conectar o "logearse" dentro de mako a su 3ra red social de lo que sea...».

En orden (el Cerebro):
1. Los límites en la tarjeta y el modal de Zernio, con zernio.com/pricing leído el 28/10 23:40: 2 cuentas gratis (página,
   Instagram y anuncios cuentan UNA cada una), de la 3.ª a la 10.ª US$6/mes cada una; 10.000 mensajes ENVIADOS gratis por mes
   (recibidos gratis; sin tarjeta se frenan los envíos hasta el mes siguiente; con tarjeta US$1 cada 10.000); comentarios y
   reseñas gratis sin contar; 500 anuncios gestionados gratis. ⚠️ La página dice que Analytics viene INCLUIDO y nosotros
   medimos un 402 que pedía el complemento: VOLVER A MEDIR antes de escribir nada de Analytics (el texto `sin-analytics` de
   lib/organico-reglas.ts depende de esto).
2. El aviso antes de la 3.ª red ya existe (`cobro` con «Conectar igual», `avisoDeCobroZernio`/`textoAvisoCobro`): sumarle la
   salida gratis «Conecta otra cuenta de Zernio (de otro email) y sigue sin pagar».
3. Varias claves de Zernio en un negocio (como las keys de Gemini): GRANDE. Con la cuenta al 91%: dejarlo DISEÑADO y medido
   aquí para la próxima cuenta (ver la sección «Varias claves de Zernio en un negocio»: cada clave es otro equipo, con su
   webhook y su secreto). Los términos de Zernio no se encontraron (zernio.com/terms da 404): si prohíben varias cuentas
   gratis para lo mismo, avisar al Cerebro ANTES.
4. El aviso antes del tope de 10.000 enviados (Leandro, audio 19:24: «que no se pare la automatización… y que Maco no me
   avise nada»): MaKo avisa en el grupo del negocio con tiempo (p. ej. al 80%), una vez por mes. Coordinar con Automations,
   que tiene el tope social (c6f78deb4 y 0c121ab4b): que no queden dos avisos.

Avisos del token (03/11) y ws21: hechos y mandados al Cerebro (nota zernio-avisos-token-0311-y-ws21.md en la carpeta de
notas del Cerebro). P2P (ws14) no tiene grupo de WhatsApp: por eso nunca le llegó el aviso del 27/10.

### Estado 28/10 ~23:20 (claude4, 92%)
- Roturas: <scratchpad>/romper-2810.mjs, 19 roturas y 19 ROJO; base publicar 25/0, orgánico 21/0, REST 8/0. Están anotadas
  en las cabeceras de tests/calendario-publicar.test.ts y tests/organico.test.ts.
- tsc acotado: la única falla propia era lib/calendario.ts (TS2589 en `conCondicion<T>`). Arreglada con un cast estructural.
  Lo demás son los 14 de _opencut (ruido conocido).
- app/m/calendario/CalendarioM.tsx: el teléfono tomaba el `{ error }` de tildar o borrar como un éxito. Arreglado: muestra el
  motivo y la tarjeta vuelve.
- Corriendo: el tsc de nuevo y los 28 tests afectados (<scratchpad>/afectados-2810.mjs). Después: commit por ruta y VERDE.
- 23:40: 28 tests afectados de a uno: 320 pases. Los únicos rojos eran puente-panel-copy (lib/cobros-webhook.ts:95 «Mirá»,
  que es de Planes: a5f61f0c8 entró con el merge 042e10323, NO está en origin/main y Planes lo corrigió en su rama; no se
  toca) y zernio-conectar-redes, que fijaba `motivoDeError(e, ws === OWNER_WS)`: ahora fija `esDeLaCasa` y da 24/0.
  tsc acotado: 0 propios (sólo los 14 de _opencut). Commiteado en el commit «verificación del 28/10» de esta rama.

### Los límites de Zernio: diseñado para la próxima cuenta (claude4 cortó al 92%, 28/10 ~23:50)
- ⚠️ **El punto 2 depende del 3.** Hoy MaKo usa UNA clave de Zernio por negocio (`cfg(ws)`, la fila `ZERNIO_API_KEY`):
  «Conecta otra cuenta de Zernio (de otro email) y sigue sin pagar» sería falso en producción; pegar otra clave reemplaza a
  la anterior y las redes conectadas en la cuenta vieja dejan de verse. La salida gratis se escribe CUANDO existan varias
  claves (punto 3). Avisado al Cerebro.
- Punto 1, dónde va: la nota del campo de la clave (lib/metodo-catalogo.ts:277, hoy «Zernio te cobra a ti. Cada red cuenta
  aparte (página, Instagram, anuncios): 2 gratis, desde la 3.ª se paga.») y un bloque «Lo que Zernio da gratis» en el modal
  (app/_components/ConectarViaZernio.tsx, junto al aviso `cobro`, línea ~213). Copy propuesto (tú, corto, de zernio.com/pricing
  del 28/10 23:40): «Gratis en Zernio: 2 cuentas (página, Instagram y anuncios cuentan una cada una), 10.000 mensajes enviados
  por mes (los recibidos no cuentan), comentarios y reseñas sin límite y 500 anuncios. Desde la 3.ª cuenta, US$6 por mes cada
  una. Sin tarjeta, al llegar a los 10.000 se frenan los envíos hasta el mes siguiente.» Los números en constantes junto a
  `CUENTAS_GRATIS_ZERNIO` (lib/zernio-redes.ts:115), con su test en tests/zernio-aviso-cobro.test.ts. NADA sobre Analytics hasta
  medirlo de nuevo (la página dice «incluido»; medimos un 402 que pedía el complemento).
- Punto 4 (aviso al 80% de los 10.000 enviados, una vez por mes, en el grupo): coordinar ANTES con Automations (tope social,
  c6f78deb4 y 0c121ab4b), que no queden dos avisos. Falta saber de dónde se lee el conteo de enviados del mes (¿Zernio lo da
  por API, o se cuenta en MaKo?): medirlo primero.
- Punto 3 (varias claves): el diseño de 4 pasos está en la sección «Varias claves de Zernio en un negocio» de este relevo
  (en main). Antes de arrancarlo: los términos de Zernio (zernio.com/terms dio 404) — si prohíben varias cuentas gratis para
  lo mismo, avisar al Cerebro.
- 29/10 ~00:00: punto 2, la parte que es CIERTA hoy: el aviso de la 3.ª red (`textoAvisoCobro`, lib/zernio-redes.ts) suma «Para
  no pagar, desconecta en zernio.com una que ya no uses y vuelve a intentarlo» (Zernio cobra sólo las ACTIVAS). La de «otra
  cuenta de Zernio» espera a varias claves; el test fija que no aparezca. Probado rompiéndolo (12/1 → 11/2; el 1 es el «Mirá»
  de Planes), tsc 0. Falta: punto 1 (los límites en la nota y el modal, con Analytics MEDIDO de nuevo), punto 4 y punto 3.

## ESTADO 29/10 madrugada (claude3, el «Continúa» después del corte de claude4)

**La segunda verificación** (C:/dev/revisiones/2910-verificacion-zernio-254856316-planes-ddfa645d4.md, llegó después del corte):
cinco MAL de publicar desde el Calendario, ARREGLADOS en el commit «Calendario: los arreglos de la segunda verificación…» de esta rama:
- N1 (media): la ventana del mismo x-request-id se cuenta desde el PRIMER envío (`anotarIntento` → `<uuid>@<ms>` en
  `publicacion_intento`, sin migración nueva: entra en el CHECK de 80); la relectura de un trabado borra el intento; la anotación
  de «programada» se reintenta una vez.
- N2: en el reintento sólo el post resuelve; un 429/422 deja `dudosa` con su intento.
- N3 y N7: «Ya lo resolví en Zernio» (`resolverEnZernio`, en la pantalla) suelta una `dudosa` o una programada con OTRA clave: sin
  programar y SIN la cuenta (no vuelve a «Programar las listas»). Tildar, mover y borrar dicen el porqué de su estado
  (`textoDeBloqueo`; `marcarEvento` devuelve `{ bloqueo }` y borrar tira `BloqueadaEnLaRed`).
- N6: el reclamo exige el `updated_at` leído. N5: el «Deshacer» doble (23505) no escribe la publicación.
Probado rompiéndolo: 11 roturas, 11 ROJO (base 37/0), anotadas en la cabecera de tests/calendario-publicar.test.ts.
Afectados de a uno: 36 archivos verdes; los rojos NO son de esta rama: `puente-panel-copy` (el «Mirá» de Planes, lo arregla
a196d5a93) y `cobro-lanzamiento` («una pasarela en modo prueba no se ofrece en /planes»: ROJO también en 254856316 limpio, entró con
el merge de Planes).

**Los límites de Zernio, punto 1: HECHO** (mismo commit): `textoGratisZernio` en el modal (ConectarRedes, abajo de la línea de las
cuentas). La nota de la key NO cambia (tope de una línea y la fija zernio-sin-respaldo). Sin Analytics (test).
**Punto 4, medido a medias:** `GET /v1/usage?range=cycle&granularity=total` y `/v1/billing` andan (200) con la clave de la
plataforma, pero esa cuenta no manda nada: `lineItems` vacío. Falta medirlo con la clave de un negocio que mande mensajes (ws10 o
ws13) con el sí del Cerebro. Detalle: docs/hallazgos-integraciones.md, «Los límites de Zernio, dichos al conectar…».
**Punto 3 (varias claves): DESCARTADO** (Martín, 29/10, por el Cerebro: una cuenta de Zernio por negocio; zernio.com/tos avisa
suspensión por «abuso»).
**Punto 4, medido con el ws10 (sí del Cerebro, sólo lectura):** su ciclo va del 12/10 al 01/11 y `lineItems` no trae `messages`, pero
el ws10 no mandó nada, y MaKo no mandó NINGÚN mensaje por redes desde el 01/09 en ningún negocio: no hay con qué medir y nadie está
cerca del tope. El aviso al 80% lo arma Automations (local_7f005343…, «Automations: Instagram de Leandro, Leila y Mauricio», en
aut-2510, cuando zernio-2510 esté en main); el CONTEO es de este chat: `usoZernioDelCiclo(ws)` en lib/zernio-uso.ts (no en
zernio-redes, que lo importa el navegador), con tests/zernio-uso.test.ts. Ya se lo pasé con el sha.
