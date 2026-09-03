# Hallazgos de Ads

Lo que hay que saber antes de tocar `lib/meta-ads.ts`, `lib/meta-ads-create.ts`,
`lib/meta-write.ts`, `lib/ads-analyst.ts`, `lib/script-analyst.ts`, `lib/experimentos.ts`,
`app/ads-manager/*` y todo lo que lee `marketing_metrics_daily`. **No es un changelog.**

⚠️ **Mucho de esto es material de segunda mano.** Sale de la cosecha retroactiva de los
journals de las 261 corridas multi-agente de junio a agosto de 2026 (134 de 260 nunca
habían escrito nada en el repo), no de una relectura del código de hoy. Cada entrada
cierra con la corrida y la fecha de la que viene: **antes de actuar sobre una, verificá
contra el código** — varias ya están arregladas, y donde el rescate lo sabía, lo dice. El
registro completo de las corridas está en [corridas-multiagente.md](corridas-multiagente.md).

**Lo que más muerde acá:**

- Meta contesta los errores con HTTP 200 y sus POST **reemplazan el objeto entero**: creés
  que escribiste y borraste → [Escrituras y creación de campañas](#escrituras-y-creación-de-campañas).
- El nombre de una campaña es un **snapshot por día**: un rename escondió el 59,5% del
  gasto del rollup de ws1 → [Nomenclatura y renombrado](#nomenclatura-y-renombrado).
- Lo que el cliente carga en /integraciones **no llega a Meta**: las escrituras leen
  `process.env`, que solo tiene al dueño → [Credenciales y multi-tenant](#credenciales-y-multi-tenant-de-meta).
- En `marketing_metrics_daily` hay una fila por anuncio **y por día**: paginar por una
  columna con empates saltea anuncios enteros → [Lecturas y métricas](#lecturas-y-métricas-de-meta).
- El corazón de /experimentos compara una ventana **parcial** contra un baseline completo:
  la señal está invertida y pintada de rojo → [Experimentos y medición](#experimentos-y-medición).
- Fuera del workspace dueño, «Regenerar transcript» devuelve la forma del éxito sin hacer
  nada → [Análisis de creativos, guiones y diagnóstico](#análisis-de-creativos-guiones-y-diagnóstico).

---

## Lecturas y métricas de Meta

### ⚠️ El mapa de México no pinta cero: pinta el estado equivocado

**Síntoma:** Mauricio reportó que «el mapa marca cero en Ciudad de México cuando debería
haber datos».

**Causa — y el diagnóstico obvio es el equivocado.** No es que falte el dato: es que se lo
está llevando otro estado. `valueFor()` en `app/marketing/ad-charts.tsx:514-519` matchea el
nombre del GeoJSON contra el de Meta con `norm()` (`:60`), que **solo saca acentos y baja a
minúsculas**. Cuando la igualdad falla hay un fallback bidireccional:

```ts
for (const [k, val] of valByNorm) if (k.startsWith(n) || n.startsWith(k)) return val;
return 0;
```

Con el GeoJSON de `mexicoHigh.json` (`:48`) eso produce **dos fallas a la vez**:

- La feature `Ciudad de México` (`n = "ciudad de mexico"`) no matchea la clave de Meta
  `"mexico city"` ni por igualdad ni por prefijo → cae en el `return 0`.
- La feature `México` —el Estado de México, `n = "mexico"`— **sí** matchea, porque
  `"mexico city".startsWith("mexico")` es `true` → **se queda con el valor de CDMX**.

O sea: el número no desapareció, se mudó al estado de al lado. Un cero pintado y un falso
positivo, los dos en silencio. Es el mismo antipatrón que
[hallazgos-landing.md](hallazgos-landing.md) ya tiene escrito: **sin avance positivo el
resultado es «no medido», jamás 0**.

**Regla:** un match por `startsWith` entre dos catálogos de nombres propios **no es un
match**: es una colisión esperando el nombre más corto. Donde dos fuentes nombran la misma
entidad, va un **diccionario explícito**, y lo que no está en el diccionario devuelve `null`
—«sin dato»— nunca `0`. El tooltip y la escala tienen que distinguir las dos cosas.

**Sin verificar:** los nombres exactos que devuelve la API de Meta con `breakdowns:'region'`
para México. El diccionario hay que armarlo mirando una respuesta real, no de memoria.
Aparte: `GEOURL` es un `fetch` a `raw.githubusercontent.com` desde un componente cliente —
conviene bajar el GeoJSON al repo.

**Vive en:** `app/marketing/ad-charts.tsx:48,60,512-519,547-549` ·
`app/ads-manager/EntityDetalle.tsx:156` (el otro consumidor de `regiones`).

*(Corrida `wf_bf78bf97-f34`, 2026-08-11. Reportado por Mauricio en la reunión del 08/07
`[01:42:50]`; mecanismo reverificado a mano sobre el código de hoy.)*

### ⚠️ La retención del VSL es un promedio de promedios: no está ponderada por plays

**Síntoma:** el número que la app llama «retención del VSL» no representa lo que la gente
mira.

**Causa:** sale de `retSum / retN`, donde `retN` cuenta FILAS (un video × un día), no
reproducciones. Con dos videos, un video de prueba con 3 plays al 80% pesa exactamente
igual que el VSL real con 2.000 plays al 35%. Y con un solo video tampoco está bien: un día
con 2 plays pesa igual que uno con 500. O sea que el dato ya es incorrecto aunque nunca
hagas un A/B. Está copiado en dos lugares.

**Regla:** toda tasa que se promedia entre filas se pondera por su denominador — acá
Σ(retención × plays) / Σ(plays).

**Vive en:** lib/queries.ts:1963 (getVslSerie) y :2992 (getTendencias) · *2026-07-16 ~multi-vsl-panda-y-baja-de-auth-cookie*

### ⚠️ El A/B del VSL ya está en los datos y nadie lo lee; y el tutorial pide el ID equivocado

**Síntoma:** en pantalla A y B aparecen mezclados, y hay videos que quedan en 0 sin que
nadie se entere.

**Causa:** el cron de Panda guarda una fila por video por día con `video_id` y
`video_variant` desde el día uno —así que el A/B se puede reconstruir hacia atrás sin
re-ingestar nada—, pero `video_variant` es write-only: cero SELECT, cero GROUP BY, cero UI;
solo la migración 0010, el check de migraciones y la escritura del cron. Las dos lecturas
del VSL filtran por `plataforma='panda'` y suman todo junto. Aparte, el catálogo se
contradice sobre qué ID pegar: dos lugares dicen «el ID está en la URL de cada video» y el
tutorial correcto dice que es el UUID que va después de `?v=` en el código del player, «no
el ID interno». El código matchea por `video_external_id`: si el usuario sigue el copy
equivocado, el cron tira «No se encontró video interno», eso va a `console.error` y ESE
video queda en 0.

**Regla:** un error de ingesta que solo va a `console.error` es un dato faltante invisible;
si una fila no matchea, tiene que verse en la UI del cliente, no en los logs.

**Vive en:** app/api/cron/panda-daily/route.ts:68 y :91 · lib/queries.ts:1935-1963 · lib/metodo-catalogo.ts:402 y :411 contra :735 · *2026-07-16 ~multi-vsl-panda-y-baja-de-auth-cookie*

### Un `ORDER BY ad_id` a secas no es un orden: hay una fila por anuncio y por día

**Síntoma:** el contador de cobertura decía que faltaban analizar anuncios que ya estaban
analizados (o al revés).

**Causa:** `getAllMetaAdIds` paginaba ordenando por `ad_id`, que en esta tabla se repite
tantas veces como días tenga el anuncio. Con empates masivos el reparto entre páginas no
está garantizado y se **salteaban ad_ids enteros**. Tenía `ORDER BY`, así que la revisión
rápida lo daba por bueno.

**Regla:** el orden de un bucle paginado tiene que ser **único**. Acá se desempata siempre
por `id`: `[{col:'ad_id'},{col:'id'}]`. Aplica igual a las otras lecturas del módulo, que
ordenaban por `(fecha, ad_id)` o `(ad_id, fecha)` — tampoco son únicas por sí solas. La
trampa completa, en [hallazgos-infra.md](hallazgos-infra.md) §1.

**Vive en:** lib/queries.ts (getAllMetaAdIds y las lecturas paginadas de `marketing_metrics_daily`) · *2026-08 unificación del paginado*

### Un año de 200 anuncios son ~73.000 filas para un `Map` de 200 claves

**Causa:** por eso `getScriptMetrics`, `getAdNames`, `getCierresByAd` y `getAllMetaAdIds`
usan `leerPorPaginas` y no `leerTodo`: de cada fila sobrevive un contador, así que la página
se agrega al `Map` y se tira. `leerTodo` materializaría el año entero en memoria para
descartarlo.

**Regla:** la pregunta no es cuántas filas hay, es **cuánto sobrevive de cada fila**.

**Vive en:** lib/queries.ts (getScriptMetrics, getAdNames, getCierresByAd, getAllMetaAdIds) · *2026-08 unificación del paginado*

### Los chunks de 200 `ad_id` no son un tope: adentro de cada chunk hay que paginar igual

**Causa:** `getCierresByAd` parte los ids en chunks de 200 para el `.in()`, y **dentro de
cada chunk igual pagina**: son leads `ganado`, que crecen con el tiempo. Un chunk de 200 no
garantiza menos de 1000 filas.

**Regla:** el tamaño del chunk acota los ids del filtro, no las filas de la respuesta.

**Vive en:** lib/queries.ts (getCierresByAd) · *2026-08 unificación del paginado*

### El cron de Meta borra el día antes de reinsertarlo: hay una ventana donde el día no existe

**Síntoma:** una lectura reporta «sin datos» para un día que sí tiene datos, y no como error.

**Causa:** `upsertMetrics` no hace UPSERT: hace DELETE + INSERT de la fila del día, porque
un índice de expresión impide el ON CONFLICT. Queda una ventana de milisegundos donde el
día simplemente no existe. Es tolerable para un cron diario, pero cualquier escritor
concurrente o cualquier lectura que caiga justo ahí ve el día vacío.

**Regla:** ese es el modo de falla más difícil de rastrear después — vacío en vez de error.
Si vas a escribir otro proceso que toque esa tabla, no asumas que el día está ahí.

**Vive en:** lib/meta-ads.ts (upsertMetrics) · *2026-07-19 ~landing-24-features-auditoria*

### Pendiente: el Ads Manager no trae anuncios de imagen, solo videos

La vista de anuncios se quedó en los videos. Los anuncios de imagen de la cuenta no
aparecen.

**Vive en:** app/ads-manager/ · *pedido del dueño, 2026-06-29*

### Pendiente: el semáforo rojo tiene que disparar por más motivos, y con razonamiento de IA

Hoy son reglas fijas. Faltan los motivos que realmente frenan la cuenta: inhabilitada por
falta de pago, tarjeta rechazada y demás urgencias. El caso real: «hace días que la cuenta
está INHABILITADA por falta de pago… Eso y otras razones urgentes se debe poder ver»
(2026-06-24).

**Vive en:** la vista general (semáforo) · *pedido del dueño, 2026-06-24*

### Decisión: la inversión SIEMPRE se pide y se muestra en dólares

Sin importar la moneda del usuario; la conversión a moneda local se hace internamente
contra Meta. **Por qué:** unifica métricas y comparaciones entre clientes. *(2026-06-30)*

### Decisión: el rendimiento vive dentro de Marketing con 3 sub-tabs, no en una vista aparte

Campañas · Conjuntos · Anuncios, lo más parecido a Meta que se pueda; «Estado de Meta» es
una tab del perfil. **Por qué:** «No quiero tener redundancias en la app y que de pronto 2
vistas sean casi iguales». La ventaja de la app no es repetir Meta, es cruzar esos datos
con los que Meta no tiene. *(2026-06-24)*

---

## Escrituras y creación de campañas

Las cuatro trampas de escribir en la Graph API, resumidas para tener en la cabeza antes de
abrir cualquier archivo de esta sección: **1)** el error viene con HTTP 200; **2)** activar
una campaña no entrega (hay que cascadear), pausar sí es una sola llamada a la raíz;
**3)** un POST de targeting reemplaza el objeto entero; **4)** el `instagram_user_id` va a
NIVEL del adcreative (`instagram_actor_id` está deprecado en v25) y el error 3858258 «no se
descargó la imagen» es una data: URL de canvas en `video_data.image_url`. Cada una, con su
caso real, abajo. *(resumen de 2026-08-07 contexto-mako-md)*

### ⚠️ Un 504 de Vercel devuelve texto, no JSON, y se lleva puesta toda la recuperación de parciales

**Síntoma:** un lote se publica a medias, el usuario reintenta y los anuncios ya creados se
duplican en pausa.

**Causa:** `publicar()` hace `await r.json()` y TODA la recuperación de un lote parcial
(leer `j.created`, recortar el spec, avisar) vive después del parseo. Si el lote pasa
`maxDuration=300`, Vercel mata la función: el catch del route nunca corre, el body es texto
plano (FUNCTION_INVOCATION_TIMEOUT), `r.json()` lanza SyntaxError y el catch del cliente
vuelve a 'revision' con el spec COMPLETO intacto. `addAdToAdset` no tiene idempotencia ni
dedup por nombre (Meta permite nombres repetidos). El server SÍ persiste los `meta_ad_ids`
en `meta_campaign_drafts` tras cada anuncio, pero ningún código de la UI lee ese draft, así
que la información de parciales es irrecuperable desde el cliente. El mismo camino se
dispara con cualquier 502/HTML de proxy o corte de red.

**Regla:** el rescate de un lote parcial no puede vivir después de un `r.json()`. Parseá
defensivo y leé lo ya persistido antes de reintentar.

**Vive en:** app/ads-manager/NuevaCampanaModal.tsx:508-531 · app/api/ads-manager/ad-add/route.ts:23 · lib/meta-ads-create.ts:824 · *2026-07-31 ~review-wizard-campana-existente*

### ⚠️ En modo «campaña existente» el copy que el usuario edita se descarta en silencio

**Síntoma:** el usuario escribe un texto nuevo, ve la landing nueva en la card, agrega el
anuncio en pausa, lo activa — y gasta plata con el creativo viejo.

**Causa:** la revisión muestra los campos del anuncio ganador con `InlineCopy` editable, la
leyenda «Tocá cualquier texto para editarlo» y una línea «▸ CTA · URL/formulario» con el
destino nuevo. Pero `publicar()` reduce todo creativo con `source:'existing'` a
`{source, source_ad_id}`, y `createAdCreative` reusa el post original vía `object_story_id`
ignorando cualquier copy.

**Regla:** un creativo reusado se muestra en solo-lectura con «reusa su post original», no
editable. Un campo editable que no viaja es peor que no tenerlo.

**Vive en:** app/ads-manager/NuevaCampanaModal.tsx:457-471, :491 y :973-975 · lib/meta-ads-create.ts:631-635 · *2026-07-31 ~review-wizard-campana-existente*

### ⚠️ `meta_campaign_drafts` se escribe, no la lee nadie, y no está scopeada por workspace

**Síntoma:** una campaña creada-pero-fallida no aparece en ninguna pantalla.

**Causa:** la tabla se pensó como el registro local de lo que se publicó en Meta (spec, ids
creados, error, costo en tokens) y como red de seguridad para las publicaciones a medias.
Pero en todo el repo solo hay INSERTs y UPDATEs (campaign-create y ad-add): no existe un
solo `.select()`. La tabla del Ads Manager se sirve de `/api/meta-health`, una lectura viva
de Meta. Peor: la mig 0045 es anterior a la 0054 y esta última no la tocó — no tiene columna
`workspace_id` y no está en TENANT_TABLES, así que se escribe con `getSupabaseServer()` sin
scope. Es un registro global sin dueño y sin lector.

**Regla:** antes de usarla como señal de avance (o de mostrarla) hace falta migración con
`workspace_id` + backfill + alta en TENANT_TABLES.

**Vive en:** supabase/migrations/0045_meta_campaign_drafts.sql · app/api/ads-manager/campaign-create/route.ts:53,62 · app/api/ads-manager/ad-add/route.ts:98,112 · lib/workspace.ts:43-57 · *2026-08-06 senales-de-avance (lo levantó antes la revisión adversarial del 2026-06-30)*

### Meta contesta los errores con HTTP 200

**Síntoma:** la escritura «sale bien» y no pasó nada.

**Causa:** la Graph API devuelve 200 con un `error` en el body (por ejemplo subcode 4841013
de permisos). Si chequeás `res.ok` creés que la escritura salió.

**Regla:** para cualquier write a Meta, mirar SIEMPRE `body.error`, nunca el status. Vale
para renombrar, presupuesto, status y delete.

**Vive en:** app/api/meta-write/route.ts y lib/meta-ads-create.ts (graphPost) · *2026-07-14 · mako-doer-discovery*

### El POST de targeting REEMPLAZA el objeto entero: parsear con lista blanca es borrar en silencio

**Síntoma:** un conjunto segmentado por ciudad se expandía a TODO México con solo tocar el
género en el modal de público.

**Causa:** no era el emisor sino el LECTOR. `parseMetaTargeting` leía una lista blanca
estrecha (solo `geo_locations.countries`) y todo lo que no leía se caía de `base`; como
`POST /{adset_id}` con `targeting` reemplaza el objeto completo y no hace merge, Meta
borraba lo ausente. La asimetría lo delataba: `buildTargeting` SÍ emitía `locales` pero el
parser nunca lo leía. Se perdían también regions/cities, excluded_geo_locations,
behaviors/demographics/life_events dentro de flexible_spec y las `exclusions` top-level — y
la copy del modal prometía justo lo contrario («los intereses que ya tenía el conjunto se
conservan»).

**Regla:** contra un endpoint que reemplaza, no parsees a un tipo propio — devolvé el objeto
CRUDO del proveedor y superponé solo lo que el editor toca. Así está hoy en
`getAdsetTargeting`/`updateAdsetTargeting`.

**Vive en:** lib/meta-ads-create.ts (getAdsetTargeting/updateAdsetTargeting ~797-816) + app/ads-manager/EditarPublicoModal.tsx · *2026-06-30 ~auditoria-ads-manager-editar-publico*

### Reconstruir un creativo de Meta pierde todo lo que Meta no devuelve en `object_story_spec`

**Síntoma:** el creativo nuevo salía SIN imagen y el anuncio quedaba roto, en silencio.

**Causa:** editar los textos de un anuncio implica leer el creativo y crear uno nuevo — y
ahí Meta no te devuelve las cosas donde vos las escribís. El `image_hash` NO viene dentro de
`object_story_spec.link_data` al leer (ahí viene `picture`, una URL): vive en
`creative.image_hash` de nivel superior o en `asset_feed_spec.images[].hash`. Lo mismo con
la miniatura custom de un video (viene como `video_data.image_hash`, no como `image_url`) y
con los anuncios click-to-message, que guardan el destino en `value.app_destination` /
`value.whatsapp_number`, no en `value.link`.

**Regla:** antes de reconstruir un objeto de Meta, verificá campo por campo qué devuelve la
lectura — no asumas simetría entre lo que escribís y lo que leés.

**Vive en:** lib/meta-ads-create.ts (getAdForEdit ~:711-755, buildObjectStorySpec ~:180-246); los probes scripts/probe-adimg2.mjs y probe-creative.mjs ya lo sabían · *2026-06-30 · ~review-editar-textos-anuncio*

### La miniatura del video viaja como data: URL hasta Meta y solo Threads lo denuncia

**Síntoma:** «#3858258 No se descargó la imagen» al elegir la ubicación Threads de un
anuncio de video, en la previa y en el publicado.

**Causa:** el diagnóstico obvio («es Threads») es el equivocado. `makeThumb` dibuja un frame
en un canvas y hace `canvas.toDataURL('image/jpeg')`; el server devuelve
`thumbnail_url: null` para video pero el cliente resuelve `x.thumbnail_url ?? j.thumbnail_url`,
así que la data URL sobrevive hasta `video_data.image_url`. Meta no descarga data: URLs —
Threads valida el `image_url` más estricto que Feed/Reels, por eso ahí explota y en el resto
pasa.

**Regla:** setear `image_url` solo si es http(s) descargable; si no, omitirlo y dejar que
Meta genere la miniatura automática, válida en todos los placements.

**Vive en:** lib/meta-ads-create.ts:189 (buildObjectStorySpec, rama video), app/ads-manager/NuevaCampanaModal.tsx:87-107 · *2026-06-30 nueva-campana-4fixes-investigate*

### Sin la cuenta de Instagram en el creativo, las campañas nuevas corren solo en Facebook

**Síntoma:** Meta bloquea la publicación pidiendo seleccionar la cuenta de Instagram, y el
anuncio entrega solo en FB. Encima el síntoma llega como «solo se ve la previa de Facebook».

**Causa:** el diagnóstico obvio es «falta el paso de ubicaciones en el wizard», y agregarlo
no alcanza: `buildObjectStorySpec` devuelve `{page_id, video_data|link_data}` sin
`instagram_actor_id`, y `createAdCreative` postea a /adcreatives sin `instagram_user_id`. El
helper `getInstagramActorId()` YA existe en el archivo pero es privado y solo lo usa
`createCustomAudience`. Y `generatePreviews` omite el formato INSTAGRAM con un catch
silencioso, así que el error se disfraza de previa faltante.

**Regla:** sin actor de IG en el creativo ningún placement de Instagram/Threads entrega,
aunque `publisher_platforms` los incluya. El id va a NIVEL del adcreative como
`instagram_user_id` — `instagram_actor_id` dentro del `object_story_spec` está deprecado en
v25.

**Vive en:** lib/meta-ads-create.ts:180-209 (buildObjectStorySpec), :257-275 (getInstagramActorId), :507-517 (createAdCreative), :552-577 (generatePreviews) · *2026-06-30 nueva-campana-4fixes-investigate*

### Activar una campaña en Meta no activa sus hijos; pausarla sí los frena

**Síntoma:** se reactiva la campaña y no entrega.

**Causa:** el toggle hace un solo POST de status sobre la entidad tocada. En Meta
`configured_status` y `effective_status` son independientes por nivel: al pausar la campaña
los hijos pasan a CAMPAIGN_PAUSED/ADSET_PAUSED solos —no hace falta cascada hacia abajo—,
pero al reactivarla los conjuntos y anuncios que tengan su PROPIO status en PAUSED siguen
pausados. La asimetría es del API, no del código.

**Regla:** activar cascadea hacia arriba (padres) y hacia abajo (hijos); pausar no. Y hay
que avisar que activar el árbol enciende también los anuncios que se habían pausado a
propósito. La jerarquía completa (ids + parentId) ya está en el cliente en
`health.adsets`/`health.ads`: no hace falta pedírsela a Meta.

**Vive en:** app/ads-manager/CampanasBrowser.tsx:257-266 (writeStatus), app/api/meta-write/route.ts:60-65 · *2026-06-30 nueva-campana-4fixes-investigate*

### El default del objetivo no es la optimización real de la campaña

**Síntoma:** al agregar un conjunto a una campaña existente, el conjunto nuevo salía con
formulario instantáneo y sin heredar el pixel, incoherente con sus hermanos.

**Causa:** `getCampaignBasics` derivaba `optimization` del default del objetivo
(`objetivoDef(objective).optimization_goal`) en vez de leerlo de un conjunto hermano. En una
campaña OUTCOME_LEADS que optimiza por conversión web eso daba LEAD_GENERATION →
`needsConv` en false. Lo delator: el `promoted_object` SÍ se leía del adset real en la misma
función; solo la decisión de optimización no.

**Regla:** si ya estás consultando `{campaignId}/adsets`, leé de ahí TODO lo que define la
forma del hijo (optimization_goal, billing_event) y usá el default del objetivo solo cuando
la campaña no tiene conjuntos.

**Vive en:** lib/meta-ads-create.ts getCampaignBasics (~844-870) + app/ads-manager/AgregarConjuntoModal.tsx · *2026-06-30 ~auditoria-ads-manager-editar-publico*

### `/{pixel_id}/stats` sin ventana de tiempo devuelve vacío, no error

**Síntoma:** en el paso destino, TODAS las opciones de evento muestran «Verificá que esté
activo» — o sea que la detección de eventos activos siempre cae al fallback.

**Causa:** dos sumadas. La llamada pide `aggregation=event` sin `start_time`/`end_time`, y
sin ventana Meta devuelve `data: []` —no un error— porque la actividad agregada por evento
es una serie temporal. Y aunque hubiera ventana, el parser mira `row.value` cuando el
desglose vive en `row.data[]` (cada bucket de tiempo trae su propio array `{value, count}`).

**Regla:** contra la Graph API un array vacío es casi siempre un filtro mal armado, no «no
hay datos», y hay que parsear todas las formas posibles porque varían por versión.

**Vive en:** lib/meta-ads-create.ts:351-379 (listPixelEvents), app/ads-manager/NuevaCampanaModal.tsx:786 (ConversionPicker) · *2026-06-30 nueva-campana-4fixes-investigate*

### Pendiente: Meta no deja publicar desde MaKo sin pasar por su UI

Hoy hay que entrar al anuncio en Meta, aceptar un mensaje de seguridad y publicarlo a mano.
Quedó pedido investigar si se puede resolver por API e implementarlo. *(2026-07-31)*

### Pendiente: instant forms, UTMs y públicos que el wizard todavía no cubre

Cuatro cosas pedidas y sin cerrar, todas sobre el wizard de campaña y la vista de públicos:

- Listar los instant forms disponibles, permitir crear uno nuevo desde ahí, y que el instant
  form sea **opcional**, no obligatorio. *(2026-06-30)*
- UTMs automáticos al crear un ad. *(2026-06-30)*
- Crear públicos nuevos desde la vista, sin entrar a Meta. *(2026-06-30)*
- Públicos personalizados incompletos: faltan los que vieron los anuncios (con % de
  retención, como en Meta) y los que rellenaron el instant form; y permitir más de 180 días,
  «lo máximo posible». Regla del dueño que aplica acá: **no poner límites arbitrarios** — el
  tope lo pone la API, no nosotros. *(2026-06-30)*
- Conectar Drive para que MaKo tome los creativos del link que manda el dueño y publique la
  campaña en pausa. *(2026-07-14)*

**Vive en:** app/ads-manager/NuevaCampanaModal.tsx · lib/meta-ads-create.ts (createCustomAudience, UTM_TAGS)

### Decisión: el wizard va por FASES, una pregunta grande por pantalla, con preview en vivo

Minimalismo al extremo y la previa de cómo va quedando al costado. **Por qué:** «pareciera
un software complejo de usar. Quiero justamente que sea simple». Del mismo lote: todo se
configura con prompts y botones, nada de configuración manual — el usuario no tiene que
aprender a configurar un software. *(2026-06-30)*

### Decisión: primero el pixel, después el evento, y solo eventos activos

**Por qué:** «El evento tiene que estar en Active events. Si selecciono uno de los que está
en gris, en inactivo, podría perjudicar enormemente la campaña». Conecta directo con el bug
de `/{pixel_id}/stats` de más arriba: si la detección de activos falla, esta decisión queda
sin efecto. *(2026-06-30)*

### Regla: toda acción irreversible o generada por IA pasa por un modal que PREVISUALIZA

Antes de publicar un lote, mandar tareas a evaluar o cualquier cosa que no se pueda deshacer,
el usuario tiene que ver exactamente qué va a pasar. **Por qué:** «de lo contrario, se van a
crear muchas tareas que pueden estar mal» *(2026-07-17)*.

### Regla: las escrituras a Meta se prueban a mano, no se declaran hechas

Cambiar el nombre de una campaña pausada, mover un lead y devolverlo, mandar el mensaje: lo
prueba el agente, no el dueño. «No funciona… Por favor, prueba tú» *(2026-07-20)*. Y no
declarar hecho lo que no se ve en la app: hay permiso permanente de preview y de Claude in
Chrome justamente para eso.

---

## Nomenclatura y renombrado

### ⚠️ El nombre es un snapshot por día, y el que gana lo decide el orden que devuelva Postgres

**Síntoma:** una campaña renombrada aparece partida en dos en el rollup, o el nombre que
muestra la app cambia entre recargas.

**Causa:** dos que se suman. **(1)** `getSenalesRecon` acumula por `ad_id` con first-wins:
`porAd.get(r.ad_id) ?? { ad_name: r.ad_name, campana: r.campaign_name, … }` — se queda con
el nombre de la PRIMERA fila que aparezca, y la query no tiene ningún `.order()`. La misma
función SÍ toma la fila más reciente para el thumbnail (`if (r.fecha >= a.lastFecha)`), así
que la asimetría es un olvido, no una decisión. Con historial mixto el resultado no es
«viejo»: es NO DETERMINÍSTICO. **(2)** El cron nunca reescribe historia: `upsertMetrics` es
DELETE+INSERT acotado a UNA fecha, así que un rename hecho FUERA de la app (directo en el
Ads Manager de Meta) deja las filas históricas con el nombre viejo para siempre — no se cura
recargando ni esperando al cron. **Medido en ws1:** 2 campañas y 4 conjuntos partidos en dos
nombres escondían MX$94.170 de MX$158.286 (59,5%) del gasto en el rollup por campaña.

**Reglas:** renombrar SIEMPRE desde la app (`metaWrite` propaga por id); si ya se renombró
en Meta, la reparación es re-ingerir con `scripts/backfill-meta.ts` sobre el rango (la
Insights API devuelve el nombre ACTUAL), no un UPDATE a mano; y cualquier agregación por
nombre tiene que cruzar por `campaign_id`/`adset_id`.

**Vive en:** lib/queries.ts:1514-1526 (adsQuery sin order) y :1578-1583 (porAd first-wins) · lib/meta-ads.ts:441-479 (upsertMetrics) · app/ads-manager/CampanasBrowser.tsx:194-205 (byCamp/byAdset keyeados por nombre) · *2026-07-31 · ~nomenclatura-meta-ads*

### ⚠️ El código `NNN.SS.x` se re-parsea del nombre: cambiar el formato rompe «+ anuncio» en silencio

**Síntoma:** anuncios nuevos con nombres basura, y correlativos repetidos.

**Causa:** no hay ninguna tabla con el código: se extrae del propio string del nombre cada
vez que hace falta (`codigoPadre` con regex, `proximaLetra`/`nextSuffix` tomando el primer
token y su sufijo de letras, más tres `split(/\s+/)[0]` sueltos). Consecuencias verificadas:
sobre un conjunto sin código («Conversiones / Ganadores…») el anuncio nuevo sale
«Conversiones.a Anuncio»; sobre un conjunto con anuncios nombrados a mano («Video 5
Proactividad») `letraANum('video')` da 10.214.505 y la próxima letra es basura; y el guard
más estricto tampoco alcanza («EL TECHO INVISIBLE…» → 'el' = 142 → salta a 'em'). Segundo
defecto del mismo generador: el correlativo global sale del CONTEO de campañas vivas
(`health.campaigns.length + 1`), no del máximo prefijo en uso — archivar una campaña hace
que la próxima reuse un número ya emitido; y en el renombrado masivo el correlativo es
`{ n: i + 1 }` sobre el subconjunto filtrado, así que renombrar con filtro de fechas arranca
de nuevo en 001 y pisa nombres buenos.

**Regla:** cualquier nomenclatura nueva tiene que conservar `NNN.SS.x ` como primer token
terminado en espacio, o hay que sacar el código del nombre y guardarlo aparte.

**Vive en:** app/ads-manager/CampanasBrowser.tsx:40-52,479-489,1003-1011,1237,654 · app/ads-manager/NuevaCampanaModal.tsx:457,468,1192-1219 · app/ads-manager/AgregarConjuntoModal.tsx:74-85 · *2026-07-31 · ~nomenclatura-meta-ads*

### ⚠️ El backfill del rename a los leads toca 5 de 649: filtra por una columna que casi siempre está NULL

**Síntoma:** se renombra la campaña, el update devuelve ok, y las fichas de lead siguen con
el nombre viejo para siempre.

**Causa:** `propagarRename` en el nivel `campaign` hace
`db.from('leads').update({ meta_campaign_name }).eq('utm_campaign', id)` — compara el ID
numérico de Meta contra `utm_campaign`. **Medido en prod:** 643 de los 649 leads con
atribución tienen `utm_campaign` NULL porque vienen del formulario instantáneo, que escribe
`meta_campaign_name` y nunca el utm; y los que sí traen utm de un anuncio creado por MaKo
guardan el NOMBRE, no el id (`UTM_TAGS` manda `utm_campaign={{campaign.name}}`). El update
matchea ~0,8% de las filas, devuelve ok (0 filas no es error) y `upsertLeadFromMeta` usa
`setIfEmpty`, así que nunca pisa atribución ya cargada. Además el nivel `adset` no toca
`leads` en absoluto y no existe columna con el id del conjunto (`leads.adset_id_origen` está
en la migración 0001 y nadie la escribe nunca).

**Regla:** propagar por `meta_ad_id ∈ (anuncios de esa campaña)`, conservando el
`utm_campaign` numérico para los leads de Calendly. Y ojo: 0 filas afectadas no es un error
que Supabase te vaya a avisar.

**Vive en:** lib/meta-write.ts:120-140 (propagarRename, la rama campaign en :130) · lib/meta-ads-create.ts (UTM_TAGS) · *2026-07-31 · ~nomenclatura-meta-ads*

### Decisión: la nomenclatura se genera sola desde el análisis del anuncio, y se renombra lo ya publicado

Campañas, conjuntos y anuncios toman su nombre del análisis/transcripción del anuncio —
también al agregar un ad a una campaña existente— y hay que renombrar todo lo que ya está
publicado. **Por qué:** «Hoy solo se pone nomenclatura difícil de entender» *(2026-07-31)*.
Cualquier generador nuevo choca de frente con los dos bugs de arriba: leelos antes.

---

## Credenciales y multi-tenant de Meta

### ⚠️ `META_PAGE_ACCESS_TOKEN` figura como opcional y sin él no entra un solo lead

**Síntoma:** el cliente «conectó Meta», todo se pinta listo, y la tabla `leads` queda vacía —
lo que apaga en cascada el CRM, /comercial, el hero de /general y medio Funnel. Es LA causa
raíz del desierto del cliente conectado.

**Causa:** en el catálogo está con `opcional: true` y en el wizard se rotula «Token de la
página (opcional)». Pero `jobAplica('meta_leads')` lo exige: sin él, el job de extracción
queda 'skipped'. Se suma una trampa de soporte: hay dos identificadores casi homónimos, el
setting `meta_page_id` (el que lee `jobAplica`, el que pide el wizard) y la credencial
`META_PAGE_ID` del catálogo (que solo rutea webhooks); cargar el segundo NO destraba
`meta_leads`. Y un hueco sistémico: no hay una sola referencia a `subscribed_apps` en el
repo — ningún código suscribe la página del cliente a la app, pero la fila de
`webhook_routing` se crea sola al pegar el token, así que todo se pinta «listo» y los
formularios no van a llegar nunca.

**Regla:** si un job lo exige, la credencial no es opcional en el catálogo. Y el estado de
una conexión se muestra vivo (¿llegó algo?), no por «tiene el campo cargado».

**Vive en:** lib/metodo-catalogo.ts:61 y :64; lib/onboarding-extract.ts:62-67; lib/webhook-routing.ts:37 · *2026-07-16 · mako-onboarding-solo-meta*

### ⚠️ Las escrituras a Meta siguen leyendo `process.env`: lo que carga el cliente no llega al creador de campañas

**Síntoma:** el cliente ve el píxel cargado y en verde en /integraciones, y igual recibe
«configurá META_PIXEL_ID» — o peor, crea la campaña con el píxel de la agencia.

**Causa:** `process.env` solo se hidrata con las credenciales de OWNER_WS, así que todo
call-site que la lea directo está atado al dueño. Siguen así el píxel en
`lib/meta-ads-create.ts:199` y `:351`, el gate de
`app/api/ads-manager/campaign-create/route.ts:40` y el token de `lib/meta-write.ts`.

**Regla:** es la misma clase de mentira que la key de IA que se pinta conectada y no se usa,
y no la arregla el autodescubrimiento por workspace: hay que pasar esos cuatro lugares a
`credWs`.

**Vive en:** lib/meta-ads-create.ts:199 y :351, lib/meta-write.ts:32, app/api/ads-manager/campaign-create/route.ts:40 · *2026-07-31 mapa-integraciones-meta*

### ⚠️ `_igActorId` es un memo GLOBAL de proceso: el segundo cliente publicaría con el Instagram del primero

**Síntoma:** ninguno hoy — está dormido, pero armado.

**Causa:** `getInstagramActorId()` memoiza el id de la cuenta de Instagram en una variable de
módulo (`let _igActorId`), que en serverless vive por proceso y no por request. Ese valor se
adjunta como `instagram_user_id` en cada creativo. Hoy no explota porque las 10 rutas de
ads-manager están gateadas al workspace dueño, pero el día que Ads Manager se abra a
clientes el PRIMER workspace que resuelva gana para todo el proceso: los anuncios del
cliente B saldrían con la cuenta de Instagram del cliente A. Sobrevive a cualquier recableo
que solo toque credenciales, porque además resuelve contra `META_PAGE_ID`, que sigue siendo
un literal hardcodeado en lib/config.ts y no pasa por `credWs`.

**Regla:** keyear el memo por workspace (`Map<number, string|null>`) sin cachear el fallo
transitorio, y resolver la página por `credWs('META_PAGE_ID')`. **Ojo con el orden:**
`hidratarCredenciales` mete el token y la cuenta del DUEÑO en `process.env` global, así que
el día que se abra el gate una escritura de cliente no reventaría con «Env var no definida»
— tendría éxito EN SILENCIO contra la cuenta del dueño. La hidratación borró la red de
seguridad accidental.

**Vive en:** lib/meta-ads-create.ts:294-308 (`_igActorId` / `getInstagramActorId`), :312 (usa el literal META_PAGE_ID) · lib/config.ts:46 · lib/credenciales.ts (hidratarCredenciales, solo OWNER_WS) · *2026-07-17 · ~verificacion-tareas-seguridad*

### Auto-descubrir la cuenta publicitaria de Meta: lo derivable es la LISTA, no la elección

**Tentación recurrente:** cambiar el input de texto de `META_AD_ACCOUNT_ID` por un
desplegable con `/me/adaccounts` (mismo `ads_read` que ya se pide). No alcanza, por dos
razones fuertes. **(1)** `/me/adaccounts` no existe para un token de PÁGINA, y el comentario
de app/api/meta-recommendations/route.ts:9 dice que el token de esta cuenta hoy es de
página: el descubrimiento devolvería vacío y hay que dejar el ingreso manual como respaldo.
**(2)** La credencial es un ESCALAR y ~20 call-sites arman `${GRAPH}/${ver}/${acct}/…` sin
ningún concepto de «cuál»: con N>1 (lo normal en el system user de una agencia) elegir la
primera significa reportar gasto, crear campañas y cobrar en la cuenta equivocada, en
silencio y con plata de por medio.

**Regla:** solo N=1 es auto-resoluble sin preguntar; con N>1 hay que preguntar y **persistir
la elección** (no resolverla por request: si mañana le asignan otra cuenta al token, la
elección cambiaría sola). El patrón correcto ya está escrito en el repo para el píxel:
`listPixels()` lista, y el wizard auto-elige SOLO si hay uno.

**Vive en:** lib/meta-ads-create.ts (listPixels 379-387, acct() 38) + app/ads-manager/NuevaCampanaModal.tsx:231-233 + lib/metodo-catalogo.ts:417 · *2026-07-31 auditoria-tokens-meta*

### Regla de la casa: nada es solo para el dueño

Todo lo que se construye para el super admin se construye para los clientes **en la misma
pasada**, y la pantalla es la MISMA. «los cambios que hacemos tienen que impactar siempre
para clientes también. Nunca razones que es solo para el dueño» *(2026-07-22)*; «no entiendo
porque la vista de superadmin y cliente son diferentes» *(2026-07-13)*. Que las 10 rutas de
ads-manager estén gateadas a OWNER_WS es **deuda**, no diseño: los tres hallazgos de arriba
son lo que hay que resolver antes de abrir el gate.

---

## Análisis de creativos, guiones y diagnóstico

### ⚠️ El botón «Regenerar transcript» devuelve éxito falso fuera del workspace dueño

**Síntoma:** el cliente aprieta el botón, no pasa nada y el modal no muestra ningún error.

**Causa:** si no es el ws dueño, `/api/regenerate-transcript` responde
`{status:'sin_video', transcript:null, error:null}` sin tocar Meta, ni OpenAI, ni la base —
exactamente la misma forma que una respuesta exitosa, y con `error: null` a propósito «para
no romper el modal». Para todo cliente el botón es decorativo y el modal no tiene forma de
saberlo. Sigue vivo.

**Regla:** un permiso denegado se contesta como denegado. Devolver la forma del éxito para no
romper la UI convierte un guard en un placebo que nadie va a poder depurar.

**Vive en:** app/api/regenerate-transcript/route.ts:39-40 · *2026-07-09 ~mapa-app-doer*

### ⚠️ Los cuatro prompts de la Content Machine no están en el registro: son invisibles y no editables

**Síntoma:** los prompts que gobiernan TODA la Content Machine no aparecen en
/configuraciones.

**Causa:** lib/razones.ts llama a `renderPrompt()` con las claves 'razones.system',
'razones.user', 'razones.sugerir' y 'razones.guion'. `renderPrompt` sí lee el store de
overrides, así que técnicamente son pisables — pero ninguna de las cuatro está registrada en
lib/prompt-registry.ts, que es lo único que alimenta la UI. Incluye la regla de las
preguntas cerradas, la que el dueño más quiere tocar. Es una falla silenciosa: el compilador
no la ve. **Verificado el 2026-08-07:** `grep -c razones lib/prompt-registry.ts` sigue dando 0.

**Regla:** todo prompt nuevo se registra en el mismo commit; hay skill para auditarlo
(`verify-prompt-registry-sync`).

**Vive en:** lib/prompt-registry.ts (faltan 4 entradas) · call-sites en lib/razones.ts:176, 177, 357, 497 · *2026-08-07 · ideas-content-machine*

### ⚠️ El valorador de guion nuevo: `dur` nunca viaja, el rango se puede invertir y paga el dashboard entero

Tres pendientes de la auditoría del valorador que no quedaron escritos. **(1)** El cliente
POSTea solo `{ guion }`, así que `valorarGuion` recibe `dur=undefined` y `sanitizeBeats`
corre con techo Infinity: el plumbing de duración existe entero en la lib y en el route, y
está muerto — los t0 estimados no tienen tope. **(2)** `rng()` clampa `min` y `max` a 0-100
por separado y nunca fuerza `min<=max`: si Claude devuelve un rango invertido o parcial, la
UI pinta un chip «30–0%» en una feature cuyo punto entero es dar rangos calibrados.
**(3)** `buildAccountProfile` llama a `getScriptAnalystView()` completo (varios scans
paginados de cierres y cobertura que después no usa), así que cada valoración de guion nuevo
paga el costo de queries del dashboard entero. El hallazgo hermano de esa misma corrida
—patrones que disparaban con n=1— SÍ se aplicó: hoy hay floors de muestra ≥2.

**Vive en:** app/script-analyst/ScriptsBrowser.tsx:358 (valorar); lib/script-analyst.ts (rng ~916, buildAccountProfile ~910) · *2026-06-25 ~audit-script-analyst-valorador*

### Una idea rinde muchas piezas por ÁNGULO, no por canal — y los 14 ángulos no son de contenido

Si una idea produce 5 piezas cambiando «escribilo como reel / como email / como carrusel»,
son la misma cosa reformateada: el canal es envase. Un reel y un email con el MISMO ángulo
son una pieza en dos envases; dos guiones con ángulos distintos son dos piezas. El producto
ya sabe esto en su propio prompt de nutrición («cada paso cambia de ÁNGULO; ninguno repite
al anterior») y el contra-ejemplo también está escrito: `lib/secuencias-variantes.ts` genera
4 formas de decir LO MISMO y su propósito declarado es antibaneo de WhatsApp, no variedad.
**Consecuencia:** multiplicar ángulos dentro de un formato da variedad genuina sin backend
nuevo; multiplicar formatos cuesta N generadores con N parsers.

**Trampa aparte:** los 14 ángulos de lib/guion-angulos.ts están escritos para tráfico frío
de Meta (retargeting presupone que ya vio un anuncio, oferta-directa es urgencia comercial)
— reusarlos tal cual para contenido orgánico produce piezas que suenan a anuncio. Lo
reusable es el MECANISMO (requisitos + gate de honestidad + anti-repetición), no el catálogo.

**Vive en:** lib/guion-angulos.ts · lib/guion-estructuras.ts · lib/secuencias-variantes.ts:26-40 · lib/nutricion-generator.ts:154 · *2026-08-07 · ideas-content-machine*

### Regla: lo que produce MaKo para el cliente va en español plano y sin jerga interna

El acento argentino es para ASESORAR. Todo lo que sale hacia afuera —guiones, copy de
anuncios, textos de la app, onboarding— va en español plano: «Está bien que MaKo tenga el
acento Argentino al asesorar, pero no al crear cosas para el cliente, como guiones o textos
que van en los anuncios» *(2026-06-30)*. Y nada de nombres internos ni tecnicismos en lo que
ve el cliente: nada de «La fábrica de creativos», nada de «la matriz 3x3», y «"Vieron tus
videos", nuevamente no se entiende. ¿Qué videos? mis reels? mis ads? Sería, vieron tus
anuncios». Si el nombre no se entiende solo, se cambia.

### Regla: una pieza, un concepto — y el feedback no se pierde en el chat

Un anuncio/guion/video no mezcla entregable + dolor + acciones: «Un anuncio tiene que tener
un solo objetivo, menos es más» *(2026-07-30)*. Y todo el feedback y los aprendizajes se
guardan para reusarlos en las próximas piezas **y en todos los orígenes**: «Tienes que ir
guardando todos estos feedback para que nos sea más fácil crear los próximos»
*(2026-07-22)*.

### Decisión: la fábrica de creativos separa Ángulos de Razones y suma el Gancho

Los «Ángulos» van por formato (imagen vs video) y se separan de las «Razones»; la matriz es
una tabla real clickeable con pop-up; y se agrega una sección **Gancho**. **Por qué:** el
Gancho es el elemento TANGIBLE de la oferta (un dashboard, un excel, una metodología) que
hace que se entienda rápido y genera FOMO en el anuncio. *(2026-07-28)*

### Decisión: los avatares tienen que ser segmentables en Meta, no descripciones ambiguas

Rubro, tamaño de empresa, ubicación. **Por qué:** «si tuviésemos que hacer una campaña de
escalo horizontal por cada avatar que propuso ¿Cómo se diferencia uno del otro? ¿Cómo lo
segmentaríamos en Meta?» *(2026-07-28)*

### Decisión: los ángulos de guion se desglosan en partes, y las estructuras viven en la tab «Guiones»

Cada ángulo lleva ejemplos de hook, cuerpo, CTA, qué hacer siempre, qué NUNCA, requisitos
para elegirlo y preguntas al usuario. Un ángulo puede contarse con varias estructuras, y las
estructuras viven aparte. **Por qué:** «Los ángulos están muy pobres, no solo tiene que
tener una instrucción en texto para la IA» *(2026-07-31)*.

### Decisión: la estructura del guion la elige el caso, y el CTA lo define el paso siguiente del funnel

No siempre GANCHO-HISTORIA-CTA. El CTA sale del funnel: VSL Funnel manda al video, mensajes
manda a WhatsApp, webinar manda a registrarse. **Por qué:** «no está mal el CTA de agenda
llamada, también se utiliza, pero no siempre» *(2026-07-31)*.

### Decisión: el onboarding incorpora un paso de TONO / PERSONALIDAD

Directo vs formal, muletillas, ejemplos, voseo vs tuteo; y a futuro se alimenta
transcribiendo los anuncios reales desde Meta. **Por qué:** «va a HUMANIZAR a los guiones y
los anuncios, hará que realmente parezcan del creador» — sin eso, a un argentino le escribía
de 'tú'. *(2026-07-31)*

### Decisión: en «Guiones» la vista por defecto vuelve a ser cards con preview del anuncio

Con opción de cambiar a tabla. Esa vista existía antes de Scripts Analyst y la quiere de
vuelta con todo: filtros, preview, todo. *(2026-06-29)*

### Decisión: el diagnóstico tiene que cubrir el caso real — casi nunca hay un ganador

Si son todos perdedores, la recomendación es armar una campaña de testing, no solo pausar. Y
ante gasto↑ / resultados↓ hay que mirar primero el **escalado** y la cantidad de cambios de
golpe (dentro y fuera de Meta), no el creativo: «muy posiblemente es por eso… dejaron de
invertir en su creativo/campaña ganadora… eso hace que Meta literalmente tenga que aprender
de 0» *(2026-07-11)*.

### Pendientes del análisis de creativos

- CRUD de ángulos y de avatares editable (con descripción), enchufado al onboarding del
  cliente y editable desde Script Analyst. *(2026-06-29)*
- Guardar la transcripción del anuncio en el momento de cargarlo a MaKo, para no volver a
  transcribir después. *(2026-07-31)*
- En la fábrica de creativos quedaron sin salir el **ENTREGABLE** y la capa de **Personas**.
  *(2026-07-29)*
- Ruta propia (deep link) para cada entidad que hoy vive en sub-tabs — acá: cada anuncio
  ganador y cada guion analizado. Quedó pedido mapear todo lo que se está quedando sin ruta.
  *(2026-07-15)*
- Traer la IA de Meta (el «Analizar» con sus recomendaciones) a la app: preguntó «¿Se
  puede?» y quedó sin respuesta cerrada. *(2026-06-24)*

---

## Experimentos y medición

### ⚠️ El experimento compara una ventana parcial contra un baseline de ventana completa: la señal está invertida

**Síntoma:** el experimento se pinta en rojo «en contra» con sparkline desde el día 1 hasta
el último, con colores de confianza.

**Causa:** `medir()` calcula el actual sobre [fecha_inicio, ayer] —parcial mientras el
experimento corre— mientras el baseline guardado se midió SIEMPRE sobre la ventana COMPLETA
anterior. Para las 7 métricas acumulativas de 17 (impressions, landing_page_views,
leads_count, agendamientos, vsl_views, cierres, spend_usd) una suma de 3 días contra un
baseline de 14 da `delta_pct` fuertemente negativo y `va_bien=false`. Al revés, `spend_usd`
con objetivo 'bajar' da `va_bien=true` falso: un gasto parcial siempre es menor que uno
completo. Las tasas y costos (cpl, cpc, ctr, cac, cpa) no sufren esto porque son ratios.
`dias_corridos` y `dias_total` están calculados dos líneas arriba y nadie los usa.

**Regla:** comparar ventanas del mismo largo, o normalizar por día. Es el corazón de la
feature dando una señal direccional sistemáticamente falsa.

**Vive en:** lib/experimentos.ts medir():254-274 y baseline en :374-408 · app/experimentos/ExperimentosBrowser.tsx:426-444 · *2026-06-30 ~experimentos-medicion-y-ui*

### Todos los experimentos miden el funnel global: no existe medición por anuncio ni por cohorte

**Causa:** el catálogo de 17 métricas (cpl, cpa, cac, ctr, tasa_agenda, cierres…) se extrae
entero de `getMarketingWindow(start,end)`, que es el agregado de TODA la cuenta. No hay
filtro por ad_id, adset, campaña ni segmento — la columna `config` jsonb existe pero no
filtra nada. Un experimento del tipo «cambiar el hook del ad X» se cierra contra el CPL
global, contaminado por todo el resto de la cuenta, y el veredicto validada/refutada se
apoya en ese número.

**Regla:** es un techo de diseño, no un bug. Sabelo antes de confiar en un aprendizaje de
/experimentos sobre un cambio acotado.

**Vive en:** lib/experimentos.ts (METRICAS → getMarketingWindow, lib/queries.ts) · *2026-07-09 ~mapa-app-doer*

### Decisión: el presupuesto se maneja guiado, con testeo y feedback a las 24-48h

Total mensual partido entre campañas ganadoras y de testeo, con parámetros de test definidos
y una decisión a las 24-48h (apagar / seguir invirtiendo). Basado en Ads RECON de Jan, pero
simplificado. **Por qué:** «siento que el proceso de Jan está bien, pero lo veo un poco
complejo… lo de Claudio es fácil, se entiende rápido. Recuerda el espíritu DOER de MaKo,
tiene que ser simple» *(2026-07-26)*.

### Decisión: Experiments se estructura en Retro → Experiments → Conclusions / Planning

Con MaKo leyendo todas las demás tabs para generar la Retro. **Por qué:** replicar el método
SIMPLE de «Nueva campaña»; «hoy parece una app barata y mal desarrollada» *(2026-07-01)*.

### Decisión: el objetivo propio es vender 10k con 1000 USD de inversión

Repartidos entre encontrar el anuncio ganador y escalarlo. El webinar se cancela por ahora;
se corren campañas de mensajes por Meta más prospección en frío por Instagram. **Por qué:**
«No quiero ganar 2.5k, quiero apuntar a vender 10k como mínimo, haz la matemática»
*(2026-07-28)*.

### Regla: las pruebas que salen hacia afuera van siempre al mismo destino

martinkoncke@gmail.com y +5493764673479. «prefiero que todas las pruebas siempre se hagan
a:» *(2026-07-14)*.

---

## Meta dejó de devolver `source` de los videos — y lo hace en SILENCIO

`getAdVideo` (`lib/transcribe.ts:67-89`) baja el video de un anuncio en dos saltos:
`ad → creative.video_data.video_id`, y después `GET /{video_id}?fields=source`. El
segundo salto **dejó de devolver `source`**.

**El modo de falla es el peor posible: no hay error.** La respuesta llega 200 con el
resto de los campos y `source` simplemente ausente:

```
GET /v21.0/1066305813011996?fields=source,length
→ {"length":108.766,"status":{...},"id":"1066305813011996"}     ← sin "source"
```

El código hace `if (vb.error || !vb.source) return null;` — o sea que devuelve `null`,
que el llamador lee como «este anuncio no tiene video». No como «no pude bajarlo».

**Descartado con medición, no por intuición:**

- No es rate limiting: `x-app-usage` daba `call_count: 9`.
- No es el token: `debug_token` lo da `is_valid: true`, tipo `SYSTEM_USER`, con
  `ads_management`, `ads_read`, `business_management`, `pages_read_engagement`.
- No es la versión de la API: pasa igual en v21.0 y en v25.0 (la del env).
- No es un video puntual: probado en 4 videos distintos, todos sin `source`.
- **No es permanente ni fue siempre así:** ese mismo video se bajó con éxito por esta
  misma ruta unas horas antes, el mismo día.

**Qué significa para el producto:** cualquier función que dependa de bajar el video del
anuncio (transcripción de creativos, Ads Analyst, Scripts Analyst) puede quedarse sin
material sin que nada lo reporte. Los anuncios simplemente «no tienen video» y el
análisis sale vacío o incompleto.

**La regla:** `getAdVideo` devolviendo `null` NO puede seguir significando dos cosas
distintas. Hay que separar «el creativo no tiene video» de «tiene video pero Meta no me
dio la URL», y que el segundo caso quede registrado y visible. Un contador de creativos
sin video que sube de golpe es la señal de que esto volvió a pasar.

**No verificado:** por qué se cortó. Las hipótesis abiertas son un cambio de política de
Meta sobre `source` (el campo viene siendo restringido hace tiempo), o que requiera token
de Página en vez de System User. No se probó con token de Página.

---

## Ocho getters de `/marketing` truncan a 1000 filas — y tres ya lo estaban haciendo en producción

**Vive en:** `lib/queries.ts` · **Encontrado:** 02/09/2026, armando el reporte por período
para el agente. **ARREGLADO el 02/09/2026**: los ocho pasan por `leerTodo`/`leerPorPaginas`
con `ORDEN_METRICAS` (la constante nueva del propio archivo).

**Síntoma.** Ninguno. Por eso vivió meses.

**La causa.** `marketing_metrics_daily` tiene **una fila por ANUNCIO y por DÍA** (level=ad
desde la mig 0009), y estos ocho la leían con un `.select()` pelado:

`getMarketingWindow` · `getCACAcumulado` · `listCACMensual` · `getRevenueMensual` ·
`getFunnelSeries` · `getSenalesRecon` · `getFatigaAdsets` · `getTendencias`

PostgREST corta en **1000 filas y no avisa** — no hay error, no hay flag, la respuesta
viene corta (está documentado en la cabecera de `lib/supabase-paginado.ts`, y `queries.ts`
**importaba `leerTodo` y lo usaba más abajo**, así que la casa ya sabía: éstos quedaron del
lado viejo).

⚠️ **EL PRIMER DIAGNÓSTICO —«está latente, no vivo»— ERA EL EQUIVOCADO, y la medición que
lo respaldaba estaba bien hecha.** Se midió el trimestre (jun–ago 2026 = 838 filas contra
1.000) y se concluyó que quedaban 162 filas de margen. Cierto para los cinco getters que
llevan rango de fechas. Pero **tres de los ocho no tienen filtro de fecha ninguno**:

| Getter | Qué lee | Filas (ws1, 02/09/2026) |
|---|---|---|
| `getCACAcumulado` | todo el histórico | **1.614 → cortaba** |
| `listCACMensual` | todo el histórico | **1.614 → cortaba** |
| `getRevenueMensual` | 18 meses (= todo) | **1.614 → cortaba** |
| `getFunnelSeries` | 84 días | 767 |
| `getMarketingWindow` | 30 días (default) | 334 |
| `getSenalesRecon` | 30 días | 334 |
| `getFatigaAdsets` | 28 días | 316 |
| `getTendencias` | el rango que le pidan | 334 a 30 días |

O sea: el CAC acumulado del dashboard se venía calculando con **el 62% del gasto**, la serie
de CAC mensual perdía meses enteros, y el gráfico de ingresos-vs-inversión pintaba el spend
de los meses que entraran en las primeras 1.000 filas — **sin `ORDER BY`, cuáles entraban ni
siquiera estaba definido**. Todo hacia abajo: menos inversión de la real, así que el ROAS y
el CAC salían *mejores*. La dirección que no hace sospechar.

**La regla que queda, y es la que costó:** medir el caso típico contesta por el caso típico.
**El techo se mide contra la lectura MÁS GRANDE de cada getter, y la más grande casi siempre
es la que no tiene filtro** — que es justo la que no se ve al escanear el código buscando
`.gte(`. Un `.select().eq()` sin fechas se lee más inofensivo que uno con rango, y es el
peligroso. Contá los getters por su FILTRO, no por su forma.

**Y la trampa de al lado:** el orden del paginado va con **tres columnas** (`fecha`,
`ad_id`, `id`). Ni `fecha` ni `ad_id` son únicos, y un orden con empates hace que el
`.range()` de la página 2 se aplique sobre otro reparto — filas repetidas y salteadas, otra
vez sin error. El molde correcto ya estaba en `lib/ads-analyst.ts` (`ORDEN_METRICAS_CRONO`)
y en `lib/metricas-negocio.ts` (`ORDEN_META`).

**Cómo se midió, para repetirlo:** un script de `count: 'exact', head: true` por getter,
reproduciendo su filtro exacto contra producción. Cuesta un minuto y contesta lo único que
importa. **Y el propio script se pisó con el mismo bug**: su primera consulta pedía 5.000
filas para contar por workspace y devolvió **exactamente 1.000** — el número redondo es la
firma, y ahí estaba otra vez.

**Lo que quedó SIN hacer** (mismo archivo, mismo defecto, medido el 02/09/2026):

- ⚠️ **`getCampaignNameMap` (:3113) y `getAdNameMap` (:3153) TRUNCAN HOY**: leen la tabla
  entera sin filtro de fecha (1.614 filas en ws1) para armar el mapa `id → nombre`. No
  corrompen números —fallan a «Campaña 123 (sin nombre)»—, así que el daño es visible, pero
  el mapa se usa en las pantallas de leads y del CRM. Van con `leerPorPaginas` + orden
  `[fecha desc, ad_id, id]` (el first-wins de adentro depende del orden por fecha).
- `getAgendasComparador` (:1745) y el spend de `getRevenuePeriodo` (:832): rango de fechas,
  ~334 filas hoy. Latentes de verdad.
- `getVslSerie` (:1966 y :1973): 56 días de YouTube y Panda, cardinalidad baja (287 y 80
  filas en un trimestre). El último de la fila.

**Y dos nombres que mienten, en el mismo archivo:**

- `MarketingWindow.agendamientos` estaba documentado como «count leads con `fecha_agenda` en
  rango» y la query filtra por **`fecha_junta_1`**. No son agendamientos: son **reuniones
  cuya fecha cae en el período**, incluidas las futuras. Las dos preguntas son legítimas y
  distintas («cuántos reservaron en el trimestre» vs «cuántas reuniones hubo»), y hoy nadie
  cuenta la primera: `fecha_agenda` no lo usa ninguna query del repo. **Renombrado a
  `reuniones_en_ventana` el 02/09/2026** (hace juego con el `cierres_en_ventana` de al lado),
  junto con sus cinco consumidores. Lo que NO se tocó es la `key: 'agendamientos'` del
  catálogo de `lib/experimentos.ts`: viaja a la columna `experimentos.metrica` (mig 0047) y
  renombrarla deja huérfano todo experimento guardado. Sí se corrigió su `desc`, que es lo
  único que MaKo lee para elegir la métrica y decía «fecha de agenda».
- `listar_campanas_meta` (`lib/mako-doer-acciones.ts`) sumaba `spend` —que está en **MXN**—
  y lo devolvía en un campo llamado `gasto_reciente_usd`: **17,3× inflado**, en la única tool
  que le da números de Meta a MaKo por WhatsApp. Y su `.limit(600)` sobre filas a nivel anuncio
  cubría ~50 días con 12 anuncios y 6 con 100, sin decir que recortó. **Arreglado el 02/09** —
  tiene sección propia al final de este documento, porque la regla que deja no es la del techo
  de 1000 sino la de qué sabe un modelo cuando lee el resultado de una tool.

**Y el corolario del cierre, que hace que dos pantallas no coincidan:** conviven **tres
definiciones** de «cerró» (`cerro = true`, `estado_lead = 'ganado'`, `fecha_cierre NOT NULL`)
y no siempre concuerdan. `getMarketingWindow` cuenta por `cerro`; `getTendencias` y
`getFunnelEtapas`, por `estado_lead`. Si el motor del CRM movió la etapa y nadie tocó
`cerro`, el CAC del dashboard y el de la serie discuten entre sí y ninguno avisa.
`lib/metricas-negocio.ts` usa `cerro = true` a propósito: es la misma que
`v_cohortes_mensuales`, para reconciliar con /comercial en vez de agregar una cuarta.

---

## `listar_campanas_meta` le decía dólares a los pesos, y «reciente» a una ventana que no conocía

**Vive en:** `lib/mako-doer-acciones.ts` (case `listar_campanas_meta`) · **Encontrado:**
02/09/2026, como corolario de la auditoría de los siete getters de arriba. **Arreglado el
mismo día.**

**Síntoma.** Ninguno visible. La tool contestaba números redondos y creíbles.

**La causa, dos veces el mismo error de fondo.**

1. **La moneda.** `spend` llega de Meta en la **moneda de la cuenta publicitaria** — MXN en
   las nuestras. La tool lo sumaba y lo devolvía en un campo llamado `gasto_reciente_usd`:
   pesos con etiqueta de dólares, **17,3× inflado**. El resto del repo sí divide
   (`lib/queries.ts`, `lib/ads-analyst.ts`), así que no era un supuesto de la casa: era este
   call-site.
2. **La ventana.** `.limit(600)` sin filtro de fecha, ordenado por `fecha` desc, sobre una
   tabla con **una fila por ANUNCIO por día**. Cuántos días entraban en el «gasto reciente»
   lo decidía cuántos anuncios estuvieran corriendo: ~50 días con 12 anuncios, **~6 días con
   100**. La tool no sabía qué período estaba sumando y no avisaba que había recortado.

**Por qué pesa más que un bug de pantalla.** Es la **única** tool que le da números de Meta a
MaKo por WhatsApp. Una pantalla pone la unidad en el encabezado de la columna y el período en
el selector de rango; el chat no tiene ni encabezado ni selector, y el que lee es el dueño.
Un número mal etiquetado ahí no tiene nada al lado que lo contradiga.

**Qué quedó.** La tool devuelve `gasto_mxn` y `gasto_usd` por separado, más un bloque
`moneda` que dice que el USD es un derivado de un tipo de cambio FIJO de `lib/config.ts` —el
mismo contrato que ya usaba el reporte de métricas (`lib/metricas-modelo.ts`:
`meta_inversion` + `meta_inversion_usd` + `moneda`)— y un bloque `ventana` con
`{ desde, hasta, dias: 30 }` que MaKo tiene instrucción de repetir cuando diga un monto. La
lectura pasó a `leerPorPaginas` (era el noveno lector de esa tabla que ignoraba el techo de
1000 de PostgREST), así que la ventana de 30 días entra **entera** por más anuncios que haya.

**Y el vacío no es un cero:** con ventana puesta, «no hay filas» puede ser «no corrió nada» o
«la sincronización está parada». La respuesta vacía lo dice y le prohíbe a MaKo contestar que
el negocio no invirtió.

**La regla:** ver «Lo que le devuelve una tool a un modelo es TODO lo que el modelo sabe» en
`AGENTS.md`. En corto: **la unidad va en el nombre del campo, no en la descripción de la
tool**, y **un adjetivo de tiempo («reciente», «último») no es un recorte** — si el nombre
del campo trae uno, la ventana no está definida en ningún lado.

**Lo que NO se tocó:** los siete getters de `lib/queries.ts` de la sección de arriba siguen
sin paginar; este arreglo cerró el octavo, no esa lista. Y `MarketingWindow.agendamientos`
sigue contando por `fecha_junta_1`.
