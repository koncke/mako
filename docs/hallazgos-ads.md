# Hallazgos de Ads

Lo que hay que saber antes de tocar `lib/ads-analyst.ts` y todo lo que lee
`marketing_metrics_daily`. **No es un changelog.**

Origen: corrida multi-agente de 08/2026 (unificación del paginado). Regla de la cosecha en
`AGENTS.md`.

---

## 1. En `marketing_metrics_daily` hay una fila por anuncio **y por día**

Es el dato que hay que tener en la cabeza antes de escribir cualquier lectura de esa tabla,
y explica dos cosas distintas.

### Un `ORDER BY ad_id` a secas no es un orden

**Síntoma:** el contador de cobertura decía que faltaban analizar anuncios que ya estaban
analizados (o al revés).

**Causa:** `getAllMetaAdIds` paginaba ordenando por `ad_id`, que en esta tabla se repite
tantas veces como días tenga el anuncio. Con empates masivos el reparto entre páginas no
está garantizado y se **salteaban ad_ids enteros**. Tenía `ORDER BY`, así que la revisión
rápida lo daba por bueno.

**Regla:** el orden de un bucle paginado tiene que ser **único**. Acá se desempata siempre
por `id`: `[{col:'ad_id'},{col:'id'}]`. La trampa completa, en
[hallazgos-infra.md](hallazgos-infra.md) §1. Aplica igual a las otras lecturas del módulo,
que ordenaban por `(fecha, ad_id)` o `(ad_id, fecha)` — tampoco son únicas por sí solas.

### Un año de 200 anuncios son ~73.000 filas para un `Map` de 200 claves

Por eso `getScriptMetrics`, `getAdNames`, `getCierresByAd` y `getAllMetaAdIds` usan
`leerPorPaginas` y no `leerTodo`: de cada fila sobrevive un contador, así que la página se
agrega al `Map` y se tira. `leerTodo` materializaría el año entero en memoria para
descartarlo.

**Regla:** la pregunta no es cuántas filas hay, es **cuánto sobrevive de cada fila**.

## 2. Los chunks de 200 `ad_id` no son un tope

`getCierresByAd` parte los ids en chunks de 200 para el `.in()`, y **dentro de cada chunk
igual pagina**: son leads `ganado`, que crecen con el tiempo. Un chunk de 200 no garantiza
menos de 1000 filas.

---

## Cosecha retroactiva (2026-08-07)

Rescatado de los journals de las 261 corridas multi-agente de junio a agosto de 2026:
**134 de 260 nunca habían escrito nada en el repo**. El registro completo de las corridas
está en [corridas-multiagente.md](corridas-multiagente.md).

⚠️ **Es material de segunda mano.** Sale de lo que devolvieron los subagentes en su
momento, no de una relectura del código de hoy. Cada entrada dice de qué corrida y de qué
fecha viene. **Antes de actuar sobre una, verificá contra el código**: varias ya están
arregladas, y donde el rescate lo sabía, lo dice.

### Trampas: el diagnóstico obvio era el equivocado

#### El cron de Meta borra el día antes de reinsertarlo

`upsertMetrics` no hace UPSERT: hace DELETE + INSERT de la fila del día, porque un índice de expresión impide el ON CONFLICT. Queda una ventana de milisegundos donde el día simplemente no existe. Es tolerable para un cron diario, pero cualquier escritor concurrente o cualquier lectura que caiga justo ahí ve el día vacío y lo reporta como «sin datos», no como error — que es exactamente el modo de falla más difícil de rastrear después.

**Vive en:** lib/meta-ads.ts (upsertMetrics) · *2026-07-19 ~landing-24-features-auditoria*

#### Meta contesta los errores con HTTP 200

La Graph API devuelve 200 con un `error` en el body (por ejemplo subcode 4841013 de permisos). Si chequeás `res.ok` creés que la escritura salió y no salió. Regla para cualquier write a Meta: mirar SIEMPRE `body.error`, nunca el status. Vale para renombrar, presupuesto, status y delete.

**Vive en:** app/api/meta-write/route.ts y lib/meta-ads-create.ts (graphPost) · *2026-07-14 · mako-doer-discovery*

#### Reconstruir un creativo de Meta pierde todo lo que Meta no devuelve en object_story_spec

Editar los textos de un anuncio implica leer el creativo y crear uno nuevo — y ahí Meta no te devuelve las cosas donde vos las escribís. El `image_hash` NO viene dentro de `object_story_spec.link_data` al leer (ahí viene `picture`, una URL): vive en `creative.image_hash` de nivel superior o en `asset_feed_spec.images[].hash`. Sin el hash, el creativo nuevo salía SIN imagen y el anuncio quedaba roto, en silencio. Lo mismo con la miniatura custom de un video (viene como `video_data.image_hash`, no como `image_url`) y con los anuncios click-to-message, que guardan el destino en `value.app_destination` / `value.whatsapp_number`, no en `value.link`. Regla: antes de reconstruir un objeto de Meta, verificá campo por campo qué devuelve la lectura — no asumas simetría entre lo que escribís y lo que leés.

**Vive en:** lib/meta-ads-create.ts (getAdForEdit ~:711-755, buildObjectStorySpec ~:180-246); los probes scripts/probe-adimg2.mjs y probe-creative.mjs ya lo sabían · *2026-06-30 · ~review-editar-textos-anuncio*

#### META_PAGE_ACCESS_TOKEN figura como opcional y sin él no entra un solo lead

En el catálogo está con `opcional: true` y en el wizard se rotula «Token de la página (opcional)». Pero `jobAplica('meta_leads')` lo exige: sin él, el job de extracción queda 'skipped' y la tabla `leads` queda VACÍA — y eso apaga en cascada el CRM, /comercial, el hero de /general y medio Funnel. Es LA causa raíz del desierto del cliente que «conectó Meta». Trampa de soporte que se suma: hay dos identificadores casi homónimos, el setting `meta_page_id` (el que lee jobAplica, el que pide el wizard) y la credencial `META_PAGE_ID` del catálogo (que solo rutea webhooks); cargar el segundo NO destraba `meta_leads`. Y otro hueco sistémico: no hay una sola referencia a `subscribed_apps` en el repo — ningún código suscribe la página del cliente a la app, pero la fila de `webhook_routing` se crea sola al pegar el token, así que todo se pinta «listo» y los formularios no van a llegar nunca.

**Vive en:** lib/metodo-catalogo.ts:61 y :64; lib/onboarding-extract.ts:62-67; lib/webhook-routing.ts:37 · *2026-07-16 · mako-onboarding-solo-meta*

#### El botón «Regenerar transcript» devuelve éxito falso fuera del workspace dueño

Si no es el ws dueño, `/api/regenerate-transcript` responde `{status:'sin_video', transcript:null, error:null}` sin tocar Meta, ni OpenAI, ni la base — exactamente la misma forma que una respuesta exitosa, y con `error: null` a propósito «para no romper el modal». Para todo cliente el botón es decorativo y el modal no tiene forma de saberlo. Regla: un permiso denegado se contesta como denegado; devolver la forma del éxito para no romper la UI convierte un guard en un placebo que nadie va a poder depurar. Sigue vivo.

**Vive en:** app/api/regenerate-transcript/route.ts:39-40 · *2026-07-09 ~mapa-app-doer*

#### Todos los experimentos miden el funnel global: no existe medición por anuncio ni por cohorte

El catálogo de 17 métricas (cpl, cpa, cac, ctr, tasa_agenda, cierres…) se extrae entero de `getMarketingWindow(start,end)`, que es el agregado de TODA la cuenta. No hay filtro por ad_id, adset, campaña ni segmento — la columna `config` jsonb existe pero no filtra nada. O sea que un experimento del tipo «cambiar el hook del ad X» se cierra contra el CPL global, contaminado por todo el resto de la cuenta, y el veredicto validada/refutada se apoya en ese número. Es un techo de diseño, no un bug: conviene saberlo antes de confiar en un aprendizaje de /experimentos sobre un cambio acotado.

**Vive en:** lib/experimentos.ts (METRICAS → getMarketingWindow, lib/queries.ts) · *2026-07-09 ~mapa-app-doer*

#### El POST de targeting REEMPLAZA el objeto entero: parsear con lista blanca es borrar en silencio

Síntoma: un conjunto segmentado por ciudad se expandía a TODO México con sólo tocar el género en el modal de público. La causa no era el emisor sino el LECTOR: `parseMetaTargeting` leía una lista blanca estrecha (sólo `geo_locations.countries`) y todo lo que no leía se caía de `base`; como `POST /{adset_id}` con `targeting` reemplaza el objeto completo y no hace merge, Meta borraba lo ausente. La asimetría lo delataba: `buildTargeting` SÍ emitía `locales` pero el parser nunca lo leía. Se perdían también regions/cities, excluded_geo_locations, behaviors/demographics/life_events dentro de flexible_spec y las `exclusions` top-level — y la copy del modal prometía justo lo contrario («los intereses que ya tenía el conjunto se conservan»). La regla: contra un endpoint que reemplaza, no parsees a un tipo propio — devolvé el objeto CRUDO del proveedor y superponé sólo lo que el editor toca. Así está hoy en `getAdsetTargeting`/`updateAdsetTargeting`.

**Vive en:** lib/meta-ads-create.ts (getAdsetTargeting/updateAdsetTargeting ~797-816) + app/ads-manager/EditarPublicoModal.tsx · *2026-06-30 ~auditoria-ads-manager-editar-publico*

#### El default del objetivo no es la optimización real de la campaña

Al agregar un conjunto a una campaña existente, `getCampaignBasics` derivaba `optimization` del default del objetivo (`objetivoDef(objective).optimization_goal`) en vez de leerlo de un conjunto hermano. En una campaña OUTCOME_LEADS que optimiza por conversión web, eso daba LEAD_GENERATION → el conjunto nuevo salía con formulario instantáneo, `needsConv` en false y sin heredar el pixel, incoherente con sus hermanos. Lo delator: el `promoted_object` SÍ se leía del adset real en la misma función; sólo la decisión de optimización no. La regla: si ya estás consultando `{campaignId}/adsets`, leé de ahí TODO lo que define la forma del hijo (optimization_goal, billing_event) y usá el default del objetivo sólo cuando la campaña no tiene conjuntos.

**Vive en:** lib/meta-ads-create.ts getCampaignBasics (~844-870) + app/ads-manager/AgregarConjuntoModal.tsx · *2026-06-30 ~auditoria-ads-manager-editar-publico*

#### La miniatura del video viaja como data: URL hasta Meta y solo Threads lo denuncia

Síntoma: "#3858258 No se descargó la imagen" al elegir la ubicación Threads de un anuncio de video, en la previa y en el publicado. El diagnóstico obvio ("es Threads") es el equivocado: `makeThumb` dibuja un frame en un canvas y hace `canvas.toDataURL('image/jpeg')`, el server devuelve `thumbnail_url: null` para video pero el cliente resuelve `x.thumbnail_url ?? j.thumbnail_url`, así que la data URL sobrevive hasta `video_data.image_url`. Meta no descarga data: URLs — Threads valida el image_url más estricto que Feed/Reels, por eso ahí explota y en el resto pasa. Regla: setear `image_url` solo si es http(s) descargable; si no, omitirlo y dejar que Meta genere la miniatura automática, válida en todos los placements.

**Vive en:** lib/meta-ads-create.ts:189 (buildObjectStorySpec, rama video), app/ads-manager/NuevaCampanaModal.tsx:87-107 · *2026-06-30 nueva-campana-4fixes-investigate*

#### Activar una campaña en Meta no activa sus hijos; pausarla sí los frena

El toggle hace un solo POST de status sobre la entidad tocada. En Meta `configured_status` y `effective_status` son independientes por nivel: al pausar la campaña los hijos pasan a CAMPAIGN_PAUSED/ADSET_PAUSED solos —no hace falta cascada hacia abajo—, pero al reactivarla los conjuntos y anuncios que tengan su PROPIO status en PAUSED siguen pausados y la campaña no entrega. La asimetría es del API, no del código. Regla: activar cascadea hacia arriba (padres) y hacia abajo (hijos), pausar no; y avisar que activar el árbol enciende también los anuncios que se habían pausado a propósito. La jerarquía completa (ids + parentId) ya está en el cliente en `health.adsets`/`health.ads`: no hace falta pedírsela a Meta.

**Vive en:** app/ads-manager/CampanasBrowser.tsx:257-266 (writeStatus), app/api/meta-write/route.ts:60-65 · *2026-06-30 nueva-campana-4fixes-investigate*

#### `/{pixel_id}/stats` sin ventana de tiempo devuelve vacío, no error

Síntoma: en el paso destino, TODAS las opciones de evento muestran "Verificá que esté activo", o sea que la detección de eventos activos siempre cae al fallback. Son dos causas sumadas: la llamada pide `aggregation=event` sin `start_time`/`end_time`, y sin ventana Meta devuelve `data: []` —no un error— porque la actividad agregada por evento es una serie temporal; y aunque hubiera ventana, el parser mira `row.value` cuando el desglose vive en `row.data[]` (cada bucket de tiempo trae su propio array `{value, count}`). Regla: contra la Graph API un array vacío es casi siempre un filtro mal armado, no "no hay datos", y hay que parsear todas las formas posibles porque varían por versión.

**Vive en:** lib/meta-ads-create.ts:351-379 (listPixelEvents), app/ads-manager/NuevaCampanaModal.tsx:786 (ConversionPicker) · *2026-06-30 nueva-campana-4fixes-investigate*

#### Las campañas nuevas corren solo en Facebook porque el creativo no lleva la cuenta de Instagram

Meta bloquea la publicación pidiendo seleccionar la cuenta de Instagram y el anuncio entrega solo en FB. El diagnóstico obvio es "falta el paso de ubicaciones en el wizard", y agregarlo no alcanza: `buildObjectStorySpec` devuelve `{page_id, video_data|link_data}` sin `instagram_actor_id`, y `createAdCreative` postea a /adcreatives sin `instagram_user_id`. El helper `getInstagramActorId()` YA existe en el archivo pero es privado y solo lo usa createCustomAudience. Encima `generatePreviews` omite el formato INSTAGRAM con un catch silencioso, así que el síntoma llega como "solo se ve la previa de Facebook" y no como un error. Regla: sin actor de IG en el creativo ningún placement de Instagram/Threads entrega, aunque publisher_platforms los incluya.

**Vive en:** lib/meta-ads-create.ts:180-209 (buildObjectStorySpec), :257-275 (getInstagramActorId), :507-517 (createAdCreative), :552-577 (generatePreviews) · *2026-06-30 nueva-campana-4fixes-investigate*

#### meta_campaign_drafts se escribe, no la lee nadie, y no está scopeada por workspace

La tabla se pensó como el registro local de lo que se publicó en Meta (spec, ids creados, error, costo en tokens) y como red de seguridad para las publicaciones a medias. Pero en todo el repo solo hay INSERTs y UPDATEs (campaign-create y ad-add): no existe un solo `.select()`. La tabla del Ads Manager se sirve de `/api/meta-health`, una lectura viva de Meta, así que una campaña creada-pero-fallida queda registrada únicamente en una tabla que ninguna pantalla renderiza. Peor: la mig 0045 es anterior a la 0054 y esta última no la tocó — no tiene columna `workspace_id` y no está en TENANT_TABLES, así que se escribe con `getSupabaseServer()` sin scope. Es un registro global sin dueño y sin lector. Antes de usarla como señal de avance (o de mostrarla), hace falta migración con workspace_id + backfill + alta en TENANT_TABLES.

**Vive en:** supabase/migrations/0045_meta_campaign_drafts.sql · app/api/ads-manager/campaign-create/route.ts:53,62 · app/api/ads-manager/ad-add/route.ts:98,112 · lib/workspace.ts:43-57 · *2026-08-06 senales-de-avance (lo levantó antes la revisión adversarial del 2026-06-30)*

#### En `marketing_metrics_daily` el nombre es un snapshot por día, y el que gana lo decide el orden que devuelva Postgres

Síntoma: una campaña renombrada aparece partida en dos en el rollup, o el nombre que muestra la app cambia entre recargas. Dos causas que se suman. (1) `getSenalesRecon` acumula por `ad_id` con first-wins: `porAd.get(r.ad_id) ?? { ad_name: r.ad_name, campana: r.campaign_name, … }` — se queda con el nombre de la PRIMERA fila que aparezca, y la query no tiene ningún `.order()`. La misma función SÍ toma la fila más reciente para el thumbnail (`if (r.fecha >= a.lastFecha)`), así que la asimetría es un olvido, no una decisión. Con historial mixto (unos días nombre viejo, otros nuevo) el resultado no es «viejo», es NO DETERMINÍSTICO. (2) El cron nunca reescribe historia: `upsertMetrics` es DELETE+INSERT acotado a UNA fecha, así que un rename hecho FUERA de la app (directo en el Ads Manager de Meta) deja las filas históricas con el nombre viejo para siempre — no se cura recargando ni esperando al cron. Medido en ws1: 2 campañas y 4 conjuntos partidos en dos nombres escondían MX$94.170 de MX$158.286 (59,5%) del gasto en el rollup por campaña. Reglas: renombrar SIEMPRE desde la app (metaWrite propaga por id); si ya se renombró en Meta, la reparación es re-ingerir con `scripts/backfill-meta.ts` sobre el rango (la Insights API devuelve el nombre ACTUAL), no un UPDATE a mano; y cualquier agregación por nombre tiene que cruzar por `campaign_id`/`adset_id`.

**Vive en:** lib/queries.ts:1514-1526 (adsQuery sin order) y :1578-1583 (porAd first-wins) · lib/meta-ads.ts:441-479 (upsertMetrics) · app/ads-manager/CampanasBrowser.tsx:194-205 (byCamp/byAdset keyeados por nombre) · *2026-07-31 · ~nomenclatura-meta-ads*

#### `_igActorId` es un memo GLOBAL de proceso sin clave de workspace: el segundo cliente publicaría con el Instagram del primero

`getInstagramActorId()` memoiza el id de la cuenta de Instagram en una variable de módulo (`let _igActorId`), que en serverless vive por proceso y no por request. Ese valor se adjunta como `instagram_user_id` en cada creativo que se crea. Hoy está dormido porque las 10 rutas de ads-manager están gateadas al workspace dueño, pero el día que Ads Manager se abra a clientes el PRIMER workspace que resuelva gana para todo el proceso: los anuncios del cliente B saldrían con la cuenta de Instagram del cliente A. Sobrevive a cualquier recableo que solo toque credenciales, porque además resuelve contra `META_PAGE_ID`, que sigue siendo un literal hardcodeado en lib/config.ts y no pasa por `credWs`. Fix: keyear el memo por workspace (`Map<number, string|null>`) sin cachear el fallo transitorio, y resolver la página por `credWs('META_PAGE_ID')`. Ojo con el orden: `hidratarCredenciales` mete el token y la cuenta del DUEÑO en `process.env` global, así que el día que se abra el gate una escritura de cliente no reventaría con «Env var no definida» — tendría éxito EN SILENCIO contra la cuenta del dueño. La hidratación borró la red de seguridad accidental.

**Vive en:** lib/meta-ads-create.ts:294-308 (`_igActorId` / `getInstagramActorId`), :312 (usa el literal META_PAGE_ID) · lib/config.ts:46 · lib/credenciales.ts (hidratarCredenciales, solo OWNER_WS) · *2026-07-17 · ~verificacion-tareas-seguridad*

#### La retención del VSL es un promedio de promedios: no está ponderada por plays

El número que la app llama «retención del VSL» sale de `retSum / retN`, donde `retN` cuenta FILAS (un video × un día), no reproducciones. Con dos videos, un video de prueba con 3 plays al 80% pesa exactamente igual que el VSL real con 2.000 plays al 35%. Y con un solo video tampoco está bien: un día con 2 plays pesa igual que uno con 500. O sea que el dato ya es incorrecto aunque nunca hagas un A/B. Está copiado en dos lugares. La regla: toda tasa que se promedia entre filas se pondera por su denominador — acá Σ(retención × plays) / Σ(plays).

**Vive en:** lib/queries.ts:1963 (getVslSerie) y :2992 (getTendencias) · *2026-07-16 ~multi-vsl-panda-y-baja-de-auth-cookie*

#### El experimento compara una ventana parcial contra un baseline de ventana completa: la señal está invertida

`medir()` calcula el actual sobre [fecha_inicio, ayer] —parcial mientras el experimento corre— mientras el baseline guardado se midió SIEMPRE sobre la ventana COMPLETA anterior. Para las 7 métricas acumulativas de 17 (impressions, landing_page_views, leads_count, agendamientos, vsl_views, cierres, spend_usd) una suma de 3 días contra un baseline de 14 da `delta_pct` fuertemente negativo y `va_bien=false` desde el día 1 hasta el último, y la UI lo pinta como pill rojo «en contra» con sparkline. Al revés, `spend_usd` con objetivo 'bajar' da `va_bien=true` falso: un gasto parcial siempre es menor que uno completo. Las tasas y costos (cpl, cpc, ctr, cac, cpa) no sufren esto porque son ratios. `dias_corridos` y `dias_total` están calculados dos líneas arriba y nadie los usa. Es el corazón de la feature dando una señal direccional sistemáticamente falsa, con colores de confianza.

**Vive en:** lib/experimentos.ts medir():254-274 y baseline en :374-408 · app/experimentos/ExperimentosBrowser.tsx:426-444 · *2026-06-30 ~experimentos-medicion-y-ui*

#### Un 504 de Vercel devuelve texto, no JSON, y se lleva puesta toda la recuperación de parciales

`publicar()` hace `await r.json()` y TODA la recuperación de un lote parcial (leer `j.created`, recortar el spec, avisar) vive después del parseo. Si el lote pasa `maxDuration=300`, Vercel mata la función: el catch del route nunca corre, el body es texto plano (FUNCTION_INVOCATION_TIMEOUT), `r.json()` lanza SyntaxError y el catch del cliente vuelve a 'revision' con el spec COMPLETO intacto. Reintentar re-crea todo, y `addAdToAdset` no tiene idempotencia ni dedup por nombre (Meta permite nombres repetidos): los anuncios ya creados se duplican en pausa. El server SÍ persiste los `meta_ad_ids` en `meta_campaign_drafts` tras cada anuncio, pero ningún código de la UI lee ese draft, así que la información de parciales es irrecuperable desde el cliente. El mismo camino se dispara con cualquier 502/HTML de proxy o corte de red.

**Vive en:** app/ads-manager/NuevaCampanaModal.tsx:508-531 · app/api/ads-manager/ad-add/route.ts:23 · lib/meta-ads-create.ts:824 · *2026-07-31 ~review-wizard-campana-existente*

#### En modo «campaña existente» el copy que el usuario edita se descarta en silencio

La revisión muestra los campos del anuncio ganador con `InlineCopy` editable, la leyenda «Tocá cualquier texto para editarlo» y una línea «▸ CTA · URL/formulario» con el destino nuevo. Pero `publicar()` reduce todo creativo con `source:'existing'` a `{source, source_ad_id}`, y `createAdCreative` reusa el post original vía `object_story_id` ignorando cualquier copy. El usuario escribe un texto nuevo, ve la landing nueva en la card, agrega el anuncio en pausa y después lo activa creyendo que lleva su copy y su URL: gasta plata con el creativo viejo. Un creativo reusado se muestra en solo-lectura con «reusa su post original», no editable.

**Vive en:** app/ads-manager/NuevaCampanaModal.tsx:457-471, :491 y :973-975 · lib/meta-ads-create.ts:631-635 · *2026-07-31 ~review-wizard-campana-existente*

#### Las cuatro trampas de escribir en la Graph API de Meta

1) Meta manda el error con HTTP 200: hay que inspeccionar `body.error`, el status no dice nada. 2) Activar una campaña no entrega: los adsets y ads conservan su propio `configured_status` PAUSED, así que activar tiene que cascadear a todo el subárbol (pausar sí es una sola llamada a la raíz). 3) Un POST de targeting a un adset REEMPLAZA el objeto entero: hay que leer el targeting CRUDO y superponer solo lo que se toca — reconstruirlo desde una lista blanca pierde geo por ciudad/región, locales/idioma, behaviors/demographics y exclusiones. 4) El `instagram_user_id` va a NIVEL del adcreative, no dentro de `object_story_spec` (`instagram_actor_id` está deprecado en v25), y el error 3858258 «no se descargó la imagen» es haber mandado una data: URL de canvas en `video_data.image_url`, que Meta no puede bajar.

**Vive en:** app/api/meta-write/route.ts · lib/meta-ads-create.ts (getAdsetTargeting, getInstagramActorId, buildObjectStorySpec) · app/ads-manager/CampanasBrowser.tsx (writeStatus/statusCascadeIds) · *2026-08-07 contexto-mako-md*


### Reglas que quedan

#### El código de nomenclatura de Meta se re-PARSEA del nombre: cambiar el formato rompe «+ anuncio» en silencio

No hay ninguna tabla con el código `NNN.SS.x`: se extrae del propio string del nombre cada vez que hace falta (`codigoPadre` con regex, `proximaLetra`/`nextSuffix` tomando el primer token y su sufijo de letras, más tres `split(/\s+/)[0]` sueltos). Consecuencias verificadas: sobre un conjunto sin código («Conversiones / Ganadores…») el anuncio nuevo sale «Conversiones.a Anuncio»; sobre un conjunto con anuncios nombrados a mano («Video 5 Proactividad») `letraANum('video')` da 10.214.505 y la próxima letra es basura; y el guard más estricto tampoco alcanza («EL TECHO INVISIBLE…» → 'el' = 142 → salta a 'em'). Regla: cualquier nomenclatura nueva tiene que conservar `NNN.SS.x ` como primer token terminado en espacio, o hay que sacar el código del nombre y guardarlo aparte. Segundo defecto del mismo generador: el correlativo global sale del CONTEO de campañas vivas (`health.campaigns.length + 1`), no del máximo prefijo en uso — archivar una campaña hace que la próxima reuse un número ya emitido, y en el renombrado masivo el correlativo es `{ n: i + 1 }` sobre el subconjunto filtrado, así que renombrar con filtro de fechas arranca de nuevo en 001 y pisa nombres buenos.

**Vive en:** app/ads-manager/CampanasBrowser.tsx:40-52,479-489,1003-1011,1237,654 · app/ads-manager/NuevaCampanaModal.tsx:457,468,1192-1219 · app/ads-manager/AgregarConjuntoModal.tsx:74-85 · *2026-07-31 · ~nomenclatura-meta-ads*


### Decisiones tomadas, y por qué

#### Una idea rinde muchas piezas por ÁNGULO, no por canal — y los 14 ángulos no son de contenido

Si una idea produce 5 piezas cambiando «escribilo como reel / como email / como carrusel», son la misma cosa reformateada: el canal es envase. Un reel y un email con el MISMO ángulo son una pieza en dos envases; dos guiones con ángulos distintos son dos piezas. El producto ya sabe esto en su propio prompt de nutrición («cada paso cambia de ÁNGULO; ninguno repite al anterior») y el contra-ejemplo también está escrito: lib/secuencias-variantes.ts genera 4 formas de decir LO MISMO y su propósito declarado es antibaneo de WhatsApp, no variedad. Consecuencia: multiplicar ángulos dentro de un formato da variedad genuina sin backend nuevo; multiplicar formatos cuesta N generadores con N parsers. Trampa aparte: los 14 ángulos de lib/guion-angulos.ts están escritos para tráfico frío de Meta (retargeting presupone que ya vio un anuncio, oferta-directa es urgencia comercial) — reusarlos tal cual para contenido orgánico produce piezas que suenan a anuncio. Lo reusable es el MECANISMO (requisitos + gate de honestidad + anti-repetición), no el catálogo.

**Vive en:** lib/guion-angulos.ts · lib/guion-estructuras.ts · lib/secuencias-variantes.ts:26-40 · lib/nutricion-generator.ts:154 · *2026-08-07 · ideas-content-machine*

#### Auto-descubrir la cuenta publicitaria de Meta: lo derivable es la LISTA, no la elección

Tentación recurrente: cambiar el input de texto de META_AD_ACCOUNT_ID por un desplegable con `/me/adaccounts` (mismo `ads_read` que ya se pide). No alcanza, por dos razones fuertes. (1) `/me/adaccounts` no existe para un token de PÁGINA, y el comentario de app/api/meta-recommendations/route.ts:9 dice que el token de esta cuenta hoy es de página: el descubrimiento devolvería vacío y hay que dejar el ingreso manual como respaldo. (2) La credencial es un ESCALAR y ~20 call-sites arman `${GRAPH}/${ver}/${acct}/…` sin ningún concepto de «cuál»: con N>1 (lo normal en el system user de una agencia) elegir la primera significa reportar gasto, crear campañas y cobrar en la cuenta equivocada, en silencio y con plata de por medio. Solo N=1 es auto-resoluble sin preguntar; con N>1 hay que preguntar y persistir la elección (no resolverla por request: si mañana le asignan otra cuenta al token, la elección cambiaría sola). El patrón correcto ya está escrito en el repo para el píxel: `listPixels()` lista, y el wizard auto-elige SOLO si hay uno.

**Vive en:** dashboard-marketing/lib/meta-ads-create.ts (listPixels 379-387, acct() 38) + app/ads-manager/NuevaCampanaModal.tsx:231-233 + lib/metodo-catalogo.ts:417 · *2026-07-31 auditoria-tokens-meta*


### Lo que quedó sin hacer

#### El valorador de guion nuevo: `dur` nunca viaja y el rango se puede invertir

Tres pendientes de la auditoría del valorador que no quedaron escritos. (1) El cliente POSTea solo `{ guion }`, así que `valorarGuion` recibe `dur=undefined` y `sanitizeBeats` corre con techo Infinity: el plumbing de duración existe entero en la lib y en el route, y está muerto — los t0 estimados no tienen tope. (2) `rng()` clampa `min` y `max` a 0-100 por separado y nunca fuerza `min<=max`: si Claude devuelve un rango invertido o parcial, la UI pinta un chip «30–0%» en una feature cuyo punto entero es dar rangos calibrados. (3) `buildAccountProfile` llama a `getScriptAnalystView()` completo (varios scans paginados de cierres y cobertura que después no usa), así que cada valoración de guion nuevo paga el costo de queries del dashboard entero. El hallazgo hermano de esa misma corrida — patrones que disparaban con n=1 — SÍ se aplicó: hoy hay floors de muestra ≥2.

**Vive en:** app/script-analyst/ScriptsBrowser.tsx:358 (valorar); lib/script-analyst.ts (rng ~916, buildAccountProfile ~910) · *2026-06-25 ~audit-script-analyst-valorador*

#### Los cuatro prompts de la Content Machine no están en el registro: son invisibles y no editables

lib/razones.ts llama a renderPrompt() con las claves 'razones.system', 'razones.user', 'razones.sugerir' y 'razones.guion'. renderPrompt sí lee el store de overrides, así que técnicamente son pisables — pero ninguna de las cuatro está registrada en lib/prompt-registry.ts, que es lo único que alimenta la UI de /configuraciones. Resultado: los prompts que gobiernan TODA la Content Machine (incluida la regla de las preguntas cerradas, la que el dueño más quiere tocar) son mudos a la edición del usuario. Es una falla silenciosa: el compilador no la ve y en la app simplemente no aparecen. Verificado el 2026-08-07: `grep -c razones lib/prompt-registry.ts` sigue dando 0.

**Vive en:** lib/prompt-registry.ts (faltan 4 entradas) · call-sites en lib/razones.ts:176, 177, 357, 497 · hay skill para auditarlo: verify-prompt-registry-sync · *2026-08-07 · ideas-content-machine*

#### Las escrituras a Meta siguen leyendo process.env: lo que carga el cliente no llega al creador de campañas

`process.env` solo se hidrata con las credenciales de OWNER_WS, así que todo call-site que la lea directo está atado al dueño. Siguen así el píxel en `lib/meta-ads-create.ts:199` y `:351`, el gate de `app/api/ads-manager/campaign-create/route.ts:40` y el token de `lib/meta-write.ts`. Consecuencia concreta para un cliente: o crea la campaña con el píxel de la agencia, o recibe «configurá META_PIXEL_ID» teniéndolo cargado y en verde en /integraciones. Es la misma clase de mentira que la key de IA que se pinta conectada y no se usa, y no la arregla el autodescubrimiento por workspace: hay que pasar esos cuatro lugares a `credWs`.

**Vive en:** lib/meta-ads-create.ts:199 y :351, lib/meta-write.ts:32, app/api/ads-manager/campaign-create/route.ts:40 · *2026-07-31 mapa-integraciones-meta*

#### El backfill del rename de campaña a los leads toca 5 de 649: filtra por una columna que casi siempre está NULL

`propagarRename` en el nivel `campaign` hace `db.from('leads').update({ meta_campaign_name }).eq('utm_campaign', id)` — compara el ID numérico de Meta contra `utm_campaign`. Medido en prod: 643 de los 649 leads con atribución tienen `utm_campaign` NULL porque vienen del formulario instantáneo, que escribe `meta_campaign_name` y nunca el utm; y los que sí traen utm de un anuncio creado por MaKo guardan el NOMBRE, no el id (`UTM_TAGS` manda `utm_campaign={{campaign.name}}`). Resultado: el update matchea ~0,8% de las filas, devuelve ok (0 filas no es error) y 649 fichas de lead se quedan con el nombre viejo para siempre, porque `upsertLeadFromMeta` usa `setIfEmpty` y nunca pisa atribución ya cargada. El camino correcto es propagar por `meta_ad_id ∈ (anuncios de esa campaña)`, conservando el `utm_campaign` numérico para los leads de Calendly. Además el nivel `adset` no toca `leads` en absoluto y no existe columna con el id del conjunto (`leads.adset_id_origen` está en la migración 0001 y nadie la escribe nunca).

**Vive en:** lib/meta-write.ts:120-140 (propagarRename, la rama campaign en :130) · lib/meta-ads-create.ts (UTM_TAGS) · *2026-07-31 · ~nomenclatura-meta-ads*

#### El A/B de VSL ya está en los datos y nadie lo lee; y el tutorial pide el ID equivocado

El cron de Panda guarda una fila por video por día con `video_id` y `video_variant` desde el día uno, así que el A/B se puede reconstruir hacia atrás sin re-ingestar nada. Pero `video_variant` es write-only: cero SELECT, cero GROUP BY, cero UI — solo la migración 0010, el check de migraciones y la escritura del cron. Las dos lecturas del VSL filtran por `plataforma='panda'` y suman todo junto, así que en pantalla A y B están mezclados. Aparte, el catálogo se contradice sobre qué ID pegar: dos lugares dicen «el ID está en la URL de cada video» y el tutorial correcto dice que es el UUID que va después de `?v=` en el código del player, «no el ID interno». El código matchea por `video_external_id`: si el usuario sigue el copy equivocado, el cron tira «No se encontró video interno», eso va a console.error y ESE video queda en 0 sin que nadie se entere.

**Vive en:** app/api/cron/panda-daily/route.ts:68 y :91 · lib/queries.ts:1935-1963 · lib/metodo-catalogo.ts:402 y :411 contra :735 · *2026-07-16 ~multi-vsl-panda-y-baja-de-auth-cookie*

