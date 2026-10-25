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
- **Todo APAGADO detrás de la prueba:** `ZERNIO_META_PROBADO = false` (lib/zernio-meta-cuerpo.ts). Mientras tanto Zernio corre
  SÓLO en el negocio de la plataforma (el de MaKo). Ningún cliente cambia de camino.

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
- **`capi --si --codigo=TEST…`: espera el código** de «Probar eventos» del píxel `1869323014511830`.
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
| Árbol (campañas, conjuntos, anuncios) | `_getMetaHealth` | `/v1/ads/accounts/live` + `/v1/ads/tree` | advertise | **No** (las ramas fallan suave: `parcial`) |
| Escrituras (pausar, presupuesto, nombre, borrar) | lib/meta-write.ts | `PUT …/status`, `PUT /ads/campaigns|ad-sets/{id}`, `DELETE` | advertise | Sólo el Media Buyer (lib/media-buyer/ejecutar.ts) |
| Crear campañas y anuncios | lib/meta-ads-create.ts | `POST /v1/ads/create` | advertise | Media Buyer; el resto apagado (`ZERNIO_ANUNCIOS_PROBADO`) |
| Formularios de leads | `listLeadForms` / `crearFormularioInstantaneo` | `GET/POST /v1/ads/lead-forms` | página con leads | **No** |
| Leads de formularios | webhook de Meta + `pollMetaLeads` | `lead.received` (hecho) + `GET /v1/ads/leads?since=` | página con leads | Webhook sí (23/10); el barrido, **no** |
| Video del anuncio (transcripción) | lib/transcribe.ts | `GET /v1/ads/{adId}/media`: links directos y firmados de cada video e imagen del anuncio | advertise | **Por Zernio** (los tres llamadores piden `accesoDeMeta`) — y es la salida al `source` que Meta dejó de dar (hallazgos-ads, «Meta dejó de devolver `source`»): sin medir con un video real |
| Reproductor del anuncio | app/api/anuncios/video/route.ts | `GET /v1/ads/{adId}/preview` (un `<iframe>` por ubicación) o `/media` | advertise | **No** |
| Perfil de Instagram (@ de un lead) | lib/instagram-perfil-server.ts, instagram-buscar | — (Business Discovery no está en Zernio) | — | **No hay salida simple** |
| Recomendaciones de la cuenta | `fetchAccountRecommendations` | — (`/v1/ads/recommendations` es sólo de Google) | — | **No hay salida**: sin token quedan las sugerencias propias de MaKo |
| Onboarding | no pide Meta desde el 16/10 (chat de arranque) | — | — | La regla de «conectada» ya ve Zernio |

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

## Rojos que no son de esta rama

`tests/zernio-conectar-redes.test.ts` → «la pantalla: la ventana se abre EN el clic…»: la regex no encuentra
`if (errorDeVentana) { fallar(…) }` en `app/_components/ConectarViaZernio.tsx`, que esta rama no toca (rojo de main).
