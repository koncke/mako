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

### ⚠️ Los leads de Instant Form no llegan: la página no está suscrita, y el lead NUNCA SALE de Meta

**Síntoma:** una agencia reporta que los leads de las campañas de **Clientes Potenciales**
de Meta no aparecen en el CRM. Las campañas las corren los clientes DE ELLOS (inmobiliarias),
no la agencia — esa cadena de tres es lo que hace el caso distinto de todo lo demás.

**Causa, medida contra la Graph API:** `GET /v24.0/{page-id}/subscribed_apps` devuelve
`{"data":[]}` — **la página no está suscrita a ninguna app**, así que Meta nunca dispara el
webhook `leadgen`. El lead no se pierde en el camino: no sale.

El control lo cierra: la página del workspace que SÍ recibe devuelve su app con
`subscribed_fields:["leadgen"]` y tiene 1.031 leads `instant_form`; el que no, tiene **0, y
nunca tuvo ninguno**.

**Y lo que NO era, que es la mitad del valor de haberlo medido:** no es permisos (el token
tiene `leads_retrieval` y de hecho LEE el lead de prueba), no es ruteo (la página está
mapeada al workspace desde el 21/08) y no es que lo descartemos nosotros.

⚠️ **Y aunque suscribieran la página, la entrega tampoco llegaría:** el webhook valida la
firma contra un ÚNICO `META_APP_SECRET` global, y el token de ese cliente lo emitió una app
de TERCEROS. Suscribir la página a la app ajena no alcanza — tienen que estar en la app de
MaKo. Es la misma decisión del 11/09 que ya bloquea la publicación de anuncios de ese mismo
cliente, apareciendo por otra puerta.

⚠️ **Y el cron de respaldo habría encontrado el lead y no dejó rastro de por qué no lo trajo.**
No existe ninguna tabla que registre corridas de cron, y la ruta sólo hace `console.log`: «no
corrió» y «corrió y falló» son el mismo silencio. Lo mismo el webhook — el rechazo por firma
y el rechazo por página sin workspace escriben un `console.warn` y nada más, así que no se
puede contar cuántos POST llegaron. Es «una política puede RECHAZAR; no puede no dejar
rastro», y queda ABIERTO.

**La regla para diagnosticar esta familia:** antes de revisar permisos, ruteo o nuestro
código, preguntá **de quién es la página** y **si está suscrita**. Son dos llamadas GET y
descartan las tres capas de abajo.

**Vive en:** `app/api/webhooks/meta-leads/` · `app/api/cron/meta-leads-poll/` ·
`lib/meta-leads.ts` · `lib/meta-leads-poll-reglas.ts`

#### 08/10/2026: Brigitte (ws15) cae en esta familia, y el poll pasó a correr cada 10 minutos

Joan: «Llegó un nuevo lead form de Brigitte pero no se cargó en el CRM». El diagnóstico
obvio, «el webhook está roto», era el equivocado: el webhook anda, y los leads de ws1 entran
en 6 a 11 s. La página de ws15 (102044152117181) devuelve `subscribed_apps` = `[]`, y su
token es de la app de la clienta («Bri App»). El único camino era el poll de las 13:30 UTC.
Los cuatro leads que habían entrado tardaron 10,05 h, 10,62 h, 10,96 h y 19,29 h, y Nicolas
y Jose seguían afuera. El ruteo está bien: `webhook_routing` apunta a ws15 desde el 30/09.

- **El poll corre cada 10 minutos** (`*/10`). Repasa 1 día, y la corrida de las 13:30 repasa
  la semana, que era la red de antes. Costo medido: 17 llamadas a Graph por pasada entre las
  4 páginas, y seis llamadas seguidas a la misma página dejan el uso de `leadgen` en el 1 %.
- ⚠️ **El poll NO toma un lead de menos de 5 minutos.** Si lo lee antes que el webhook, el
  webhook lo encuentra por `meta_lead_id`, recibe `created:false` y se saltea **en
  silencio** todo lo que sólo hace con un lead nuevo: el alta del chat, el aviso, los flujos
  y la nutrición inmediata. No da error y el lead está, así que nadie lo nota. En ws1 le
  pasaría a ~1 de cada 60 leads.
- ⚠️ **ws11 no tiene NINGÚN camino**, ni webhook ni poll. Su token («Lidermente_Agent») no
  tiene `leads_retrieval` ni `pages_manage_ads`, y listar los formularios devuelve «(#200)
  Requires pages_manage_ads». Subir la frecuencia no lo arregla: hace falta un token nuevo.
- En ws15, a Joan no le faltó ningún aviso: `lead-formulario-meta` está apagado, no hay
  secuencias y ningún flujo escucha `lead.form_meta`. Lo único que de verdad no sale por el
  poll es el evento `Lead` de CAPI, y eso es a propósito (`tests/meta-capi-lead-id.test.ts`).

**Lo que quedó SIN hacer:**

- **Suscribir la página de ws15** a la app 954456647632371, la del `META_APP_SECRET`, con un
  token de página con `pages_manage_metadata`. Es un paso de Meta que hace un admin de la
  página, no código. Hasta entonces, sus leads tardan hasta 10 minutos.
- **ws11: token nuevo** con `leads_retrieval` y `pages_manage_ads`.
- **El poll no dispara lo inmediato** (aviso, flujos, nutrición, CAPI) para una página sin
  suscribir. La nutrición la levanta igual la cohorte `instant_form_sin_agenda` del cron. El
  día que un cliente sin suscribir prenda el aviso, no le va a llegar. Arreglarlo necesita un
  tope de antigüedad, porque el poll también hace pasadas de 90 días.
*08/10/2026 — diagnóstico y refutación con subagentes, sólo lectura (scratchpad
`wf2-refuta-lead-brigitte/`). Commit `e869a24e`. **Verificado en producción:** el deploy
quedó listo a las 16:40 UTC, y la pasada de las 16:50 trajo a Jose (#2621) y a Nicolas
(#2622) al embudo 17 «Captacion Forms», con sus 5 campos. Nadie escribió nada a mano.*

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

### ⚠️ Las ventanas de /marketing no son las que dicen: Tendencias estira a períodos completos y la fatiga «7d / 28d» lee 8 y 29 días

**Síntoma:** una tendencia de dos meses suma días anteriores a `desde`, y la barra del
período en curso ya trae «agendas» de reuniones que todavía no pasaron. Un conjunto
«fatigado en 7 días» se midió sobre 8.

**Causa — Tendencias.** `_getTendencias` elige la granularidad por el LARGO del rango
(hasta 31 días diario, hasta 180 semanal, más mensual; `lib/queries.ts:2909-2910`) y arma
períodos completos: en semanal el primero arranca el lunes anterior a `desde` y el último
termina el domingo; en mensual van del día 1 al fin de mes (`:2913-2924`). **Todas** las
lecturas usan ese rango ampliado (`rangoInicio`/`rangoFin`, `:2926-2937`). El recorte a
«ayer» (`:2898-2899`) mueve `end` ANTES de armar los períodos, así que el último igual se
estira al domingo o al fin de mes; y «agendas» cuenta leads por `fecha_junta_1` (`:2993`),
incluidas las reuniones ya agendadas a futuro. Ese «ayer», además, es `ayerEnTijuana()`
para todo workspace.

**Causa — fatiga.** `getFatigaAdsets` filtra `fecha >= hoy−7` y `fecha >= hoy−28`, los dos
inclusive (`:2761-2762`, `:2770`, `:2784`): son 8 y 29 días, en campos que se llaman
`frequency_7d`, `cpl_7d_usd` y `cpl_28d_usd`. Y `hoy` por defecto es la fecha UTC del
server (`:2758`).

**Regla:** una lectura que agrega por períodos devuelve la ventana que DE VERDAD sumó, y el
nombre de una ventana dice los días que lee. `Tendencias` no la devuelve (`:2868-2873`), así
que la API de MaKo la **recalcula copiando la lógica** (`lib/api-mako/areas/metricas.run.ts:262-273`)
y, si su granularidad no coincide con la de la lib, contesta `ventana_leida: null` en vez de
inventarla (`:284`, `:292`). La fatiga la expone como `ventana_corta`/`ventana_larga` con
los días reales (`:315-319`).

**Sin hacer:** que `_getTendencias` devuelva `rangoInicio`/`rangoFin` y el runner deje de
copiar; hoy, si la lib cambia la granularidad, la copia lo detecta y devuelve null, no lo
arregla. La fatiga **no** se corrigió en la lib a propósito: pasar a 7 y 28 días cambia el
semáforo que ya leen `/general` (`app/general/page.tsx:122`), el reporte
(`lib/reportes.ts:123`), las retros (`lib/retro-datos.ts:454`, `lib/retro-fuentes.ts:135`)
y el aviso de `lib/avisos-catalogo.ts:277`. Es una decisión pendiente, no un typo.

**Vive en:** lib/queries.ts (`_getTendencias` :2885, `_getFatigaAdsets` :2757) ·
lib/api-mako/areas/metricas.run.ts (`ver_tendencias`, `detectar_fatiga_adsets`) ·
*2026-09-16 api-mako-areas*

### ⚠️ `dias_con_datos` cuenta días de YouTube y Panda: con Meta vacío, los ceros se leen «no invertiste» y el CAC sale $0

**Síntoma:** la ventana de marketing de un workspace con Panda sincronizando y Meta sin
filas devuelve `dias_con_datos > 0`, gasto 0, impresiones 0 y, si hubo cierres, **CAC = 0**.

**Causa:** `_getMarketingWindow` junta en un solo `Set` las fechas de Meta, YouTube y Panda
(`lib/queries.ts:278-282`) y lo devuelve como `dias_con_datos` (`:308`). Los agregados de
Meta son `sum()` de una lista vacía: 0, no null (`:232-245`). Y el CAC es
`cierres > 0 ? safeDiv(spend_usd, cierres) : null` (`:323`); `safeDiv` solo devuelve null
con denominador 0 (`:144-147`), así que 0 dólares ÷ 3 cierres da un CAC de $0: el mejor CAC
posible, inventado por la falta de datos.

**Regla:** «¿hay datos de X?» se pregunta contando filas de X, nunca con un contador que
mezcla fuentes. La API de MaKo lo hace por fuera: cuenta las filas de Meta con un `count`
exacto y, si da 0, los campos de Meta y el CAC salen `null` con la nota «no hay datos, no
"no hubo inversión"» (`lib/api-mako/areas/metricas.run.ts:160-173`).

**Sin hacer:** la lib no expone días ni filas por fuente, así que todo consumidor de
`getMarketingWindow` (las pantallas, los reportes, `lib/experimentos.ts`) hereda la trampa.

**Vive en:** lib/queries.ts (`_getMarketingWindow` :153) · lib/api-mako/areas/metricas.run.ts
(`resumir_marketing_periodo`) · *2026-09-16 api-mako-areas*

### ⚠️ Los números de /marketing tienen hasta 10 minutos, y cruzar uno cacheado con uno fresco inventa un faltante

**Síntoma:** la API de MaKo avisó «la lista está incompleta (la lectura de leads no
pagina)» sobre una lista completa.

**Causa:** la mayoría de los getters de `lib/queries.ts` pasan por `cachedRead`
(`unstable_cache` por workspace, `lib/cache.ts:46-62`) con `TTL = { cron: 600, user: 60 }`
(`:37`). Van a 10 minutos `getMarketingWindow` (:152), `getCACAcumulado` (:689),
`getFunnelSeries` (:1406), `getSenalesRecon` (:1548), `getVslSerie` (:1954),
`getFatigaAdsets` (:2756) y `getTendencias` (:2884); a 1 minuto
`getResumenComercialMaduras` (:442), `getRevenuePeriod` (:807) y `getRevenueMensual`
(:1109). Ninguna salida dice su edad. Invalidan antes de tiempo solo las server actions de
/crm (`app/crm/actions.ts:24`, `app/crm/[id]/deal-actions.ts:25`) y las escrituras de la API
de MaKo (`lib/api-mako/areas/crm.helpers.ts:37`): un webhook, un cron o la ingesta de Meta
no. `listar_leads_embudo_maduro` compara `getFunnelMadurasLeads` (sin caché, :550) con
`getResumenComercialMaduras` (cacheada): cuando un lead cambia por un camino que no
invalida, los dos totales difieren hasta un minuto, y la nota del runner arranca por el
truncado (`lib/api-mako/areas/metricas.run.ts:674-676`).

**Regla:** un cruce que deduce «falta algo» compara dos lecturas del mismo lado de la
caché. Y un número que sale de caché no se presenta como «ahora».

**Vive en:** lib/cache.ts · lib/queries.ts (los `cachedRead` de arriba) ·
lib/api-mako/areas/metricas.run.ts (`listar_leads_embudo_maduro`) · *2026-09-16 api-mako-areas*

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

**(16/09) Y el tipo promete lo mismo que la pantalla.** `Creative` dice «Copy del anuncio
(para upload; en 'existing' opcional para override)» (`lib/campaign-types.ts:131`), y
`createAdCreative` con `source: 'existing'` manda solo `object_story_id` + `url_tags`
(`lib/meta-ads-create.ts:1055-1059`): `primary_text`, `headline`, `cta_type` y
`destination_url` no llegan a Meta. Cualquier llamador nuevo que se guíe por el tipo pierde
los textos en silencio, igual que el wizard.

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

### ⚠️ El árbol de Meta que leen las guardas puede tener CUALQUIER edad, y `metaWrite` no lo invalida NUNCA

(Hasta el 07/10/2026 este título decía «tiene hasta 2 minutos». Era falso: ver el
párrafo fechado 07/10 de abajo, «El `revalidate: 120` no es un techo».)

**Síntoma:** ninguno visible. Una guarda «solo se borra lo pausado» que decida con el árbol
puede dejar pasar el borrado de algo que se activó hace un minuto, y lo mismo al
re-preparar en la confirmación, que vuelve a leer la misma caché.

**Causa, y la lectura obvia es la equivocada.** `getMetaHealth` es `cachedRead` con
`revalidate: 120` (`lib/meta-health.ts:492`). Leyendo `metaWrite` parece que al menos el
rename invalida: `propagarRename` llama `updateTag(TAG.leads)` y `updateTag(TAG.marketing)`
(`lib/meta-write.ts:137`). **No invalida nada.** `updateTag` solo corre dentro de una server
action, y a `metaWrite` la llaman una ruta (`app/api/meta-write/route.ts:29`), el runner de
la API (`lib/api-mako/areas/ads.run.ts:94`) y el doer (`lib/mako-doer-acciones.ts:162`):
lanza, el `catch { /* la caché vence sola por TTL */ }` se lo traga, y lo único que corre es
el TTL. Estado, presupuesto y borrado ni lo intentan. La trampa general de `updateTag`, en
[hallazgos-api-mako.md](hallazgos-api-mako.md).

**(16/09/2026) Y en el rename SÍ hay síntoma.** `propagarRename` escribe el nombre nuevo en
`leads` y en `marketing_metrics_daily` ANTES de esa línea, así que la base queda bien y lo que
no se entera es la caché: la lista de leads (`listLeads`, `TAG.leads`, 60 s) y los nombres
que salen de las métricas (`getCampaignNameMap`, `getAdNameMap`, `getSenalesRecon`:
`TAG.marketing` con `TTL.cron`, 10 min; los leen el CRM, /marketing, /general y la ficha del
anuncio) siguen mostrando el nombre viejo hasta que vencen. Se lee como «el
rename no se propagó» y no hay nada que re-ingerir: se espera o se invalida bien. El molde fuera
de una server action ya existe: `invalidar()` en `lib/api-mako/areas/crm.helpers.ts:36-38`.

**Regla:** lo que decide una escritura destructiva se lee EN VIVO justo antes
(`cache: 'no-store'`, mirando `body.error`), nunca del árbol cacheado. Molde: `estadoVivoMeta`
(`lib/api-mako/areas/ads.helpers.ts:147-164`), que corre antes del DELETE
(`ads.run.ts:724-730`). Desde el 07/10/2026 lee con `credWs(ws)` y recibe el MISMO `ctx.ws` que
borra (antes usaba `envCred`, la cuenta del ws1, igual que `metaWrite`).

**Sin hacer:** `updateTag` → `revalidateTag(tag, { expire: 0 })` en `lib/meta-write.ts:137`,
y extenderlo a toda escritura, no solo al rename. Y exportar la lectura viva desde
`lib/meta-write.ts`: hoy vive en un área.

⚠️ **(07/10) Y no es una línea: `TAG.marketing` NO es por cliente.** La clave de la caché
lleva el workspace (`lib/cache.ts`), el tag no. Invalidarlo al escribir un presupuesto
expira el árbol de Meta **y las 12 lecturas de `lib/queries.ts` que lo llevan** (CAC,
ingresos, embudo, tendencias, los mapas de nombres…) de TODOS los workspaces. Por eso la revisión
de la #349 no lo hizo y arregló la tabla del lado de la pantalla. La cura limpia es un tag
propio del árbol por workspace (`metaHealth:ws:N`) que una escritura pueda invalidar sola.
Y aun invalidando queda una carrera: una lectura que arrancó antes de la escritura y
termina después se guarda en la caché con la hora nueva y el monto viejo.

**(07/10) Y en la tabla del Ads Manager SÍ había síntoma**, del lado del presupuesto: cada
pausa, activación, renombre o borrado llama a `cargar()`, que soltaba TODOS los valores
optimistas y pintaba el árbol cacheado. Cambiar un presupuesto y pausar algo devolvía la
fila al monto VIEJO — se lee como «no se aplicó», y el «viejo» del próximo cartel salía
vencido. Parche del lado de la pantalla, no la cura: `presupuestosVigentes`
(lib/presupuesto-cambio.ts) conserva lo escrito desde la pestaña hasta que llega una
lectura que **empezó** después de la escritura (o que ya trae ese monto).

⚠️ **(07/10, revisión de la #349) El `revalidate: 120` no es un techo.** La primera versión
de ese parche soltaba lo escrito a los 120 s, suponiendo que la caché nunca sirve algo más
viejo. `unstable_cache` es **stale-while-revalidate** (Next 16.2.6,
`node_modules/next/dist/server/web/spec-extension/unstable-cache.js`, la rama `isStale`:
«we're doing background revalidation - return stale immediately»): la primera lectura
DESPUÉS de vencer devuelve la entrada vieja y recién ahí revalida de fondo. Si nadie pide el
árbol durante diez minutos, lo que se sirve tiene diez minutos. Escenario medido sobre el
código: caché en t0 con 500, escribir 1000 a los 10 s, pausar otra fila a los 3 min → la
fila volvía a 500, el editor abría en 29 USD y el cartel siguiente calculaba el ×5 contra
500. **La prueba del navegador dio verde porque su `/api/meta-health` simulado no tenía
caché y la prueba entró en la ventana.** Ahora `_getMetaHealth` anota `inicioLecturaISO`
ANTES del primer pedido a Meta, la escritura toma su hora del header `Date` de
`/api/meta-write` (reloj del servidor contra reloj del servidor, con un segundo de grano
porque `Date` trunca), y el optimista se suelta con la primera lectura posterior, traiga lo
que traiga. Contra `fetchedAtISO` no sirve: se pone al FINAL, y una lectura que arrancó
antes de la escritura y terminó después trae el monto viejo con una hora posterior.

**Regla:** la edad de lo que sirve una caché no la acota su `revalidate`. Para decidir si
una lectura ya ve una escritura, se compara la hora en que la lectura EMPEZÓ —escrita
adentro del valor cacheado— contra la hora de la escritura, las dos del servidor. Un reloj
del lado del cliente («pasaron N segundos») no contesta esa pregunta.

**Vive en:** lib/meta-health.ts (`getMetaHealth`, `inicioLecturaISO` en `_getMetaHealth`) ·
lib/meta-write.ts:154 (`propagarRename`) · lib/presupuesto-cambio.ts (`presupuestosVigentes`,
`horaDeEscritura`) · lib/api-mako/areas/ads.helpers.ts (`estadoVivoMeta`) ·
*2026-09-16 api-mako-areas · 2026-10-07 revisión de la #349*

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

⚠️ **(16/09) Pero la superposición NO vive en la lib ni en la ruta: vive en el navegador.**
`EditarPublicoModal` arma el targeting sobre el crudo y pisa sus campos —`{ ...base }` hasta la
#715; desde el 07/10, `{ ...aplicarLugares(base, lectura, lugares) }`—
(`app/ads-manager/EditarPublicoModal.tsx:90-120`, `guardar`). `POST /api/ads-manager/adset-targeting`
acepta cualquier objeto y lo reenvía (`route.ts:34-36`), y `updateAdsetTargeting` también
(`lib/meta-ads-create.ts:1324-1326`). O sea que **todo llamador de server que mande un
targeting parcial borra la segmentación**, con la ruta en verde. Por eso la API de MaKo no
expone «editar público de un conjunto»; y la cabecera de `lib/api-mako/areas/ads.def.ts:35-37`
dice que «la ruta adset-targeting mergea antes», que es falso: el que lo lea va a creer que
la ruta lo protege. Tampoco quedaron en la API, por motivos vecinos: crear campaña, subir
creativos, analizar, sugerir o previsualizar (la orquestación vive solo en
`app/api/ads-manager/*`, o gasta IA al proponer), ni agregar un conjunto
(`addAdsetToCampaign`, `lib/meta-ads-create.ts:1388`, sí es reutilizable pero pide un
`AdSetSpec` entero y falta decidir cómo se declara ese parámetro). La lista está en
`ads.def.ts:29-43`.

**Sin hacer:** una función en la lib que reciba SOLO los cambios, lea el crudo y superponga
en el server; recién ahí la ruta y la API pueden aceptar un parámetro parcial.

*(07/10, #715)* La cabecera de `ads.def.ts` ya dice que la ruta NO mergea. Y los LUGARES ahora
se editan en el modal, sobre el mismo crudo, por `aplicarLugares` (`lib/meta-geo.ts`): el geo
se toca sólo si cambió, y nunca si el crudo trae algo que no se entiende — ver «Dónde se muestra
un conjunto que ya corre».

**Vive en:** lib/meta-ads-create.ts (getAdsetTargeting/updateAdsetTargeting :1313-1326) + app/ads-manager/EditarPublicoModal.tsx:90-120 · app/api/ads-manager/adset-targeting/route.ts · *2026-06-30 ~auditoria-ads-manager-editar-publico · 2026-09-16 api-mako-areas*

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

**Regla:** setear `image_url` solo si es http(s) descargable. ⚠️ **Corregido el 07/10/2026
(tarea #59):** esta regla seguía «si no, omitirlo y dejar que Meta genere la miniatura
automática», y eso es FALSO para publicar: Meta EXIGE `image_hash` o `image_url` en
`video_data` y sin ninguna rechaza el creativo con «Your ad needs a video thumbnail» — lo
midió be1dc1ee el 30/06 a las 21:58. El comentario que decía lo contrario en
`buildObjectStorySpec` llegó 39 minutos después (049e7e50, otra tarea), y esta regla se
escribió en la cosecha retroactiva del 07/08 (f315269e) con la versión equivocada.
Lo que hace el código hoy: `withVideoThumb` le pide a Meta la miniatura que generó del video
(http, válida en todos los placements); si todavía no la generó, la PREVIA se dibuja igual y
`createAdCreative` corta ANTES de crear el creativo (`conMiniaturaParaPublicar`).

**Vive en:** lib/meta-ads-create.ts (buildObjectStorySpec rama video, withVideoThumb, conMiniaturaParaPublicar), lib/campana-videos.ts (`faltaMiniatura`), app/ads-manager/creativeUpload.ts (`makeThumb`) · *2026-06-30 nueva-campana-4fixes-investigate · 2026-10-07 tarea #59*

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
  tope lo pone la API, no nosotros. *(2026-06-30)* ⚠️ **(16/09) Y el tope de la API es POR
  TIPO:** `createCustomAudience` topea `dias` en 365 para todos (`lib/meta-ads-create.ts:735`,
  con el JSDoc de `:732` diciendo todavía «1..180»), pero Meta limita a 180 días la retención
  de un público de sitio web (tipo `pixel`): ese caso pasa todas nuestras validaciones y
  falla recién al crear.
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

### ⚠️ El presupuesto de tiempo del análisis de guiones no acota una llamada: supone rutas de 300 s

**Síntoma:** corrido síncrono desde la ruta v1 de la API, la función moría después de
reclamar la pendiente y la dejaba `confirmada` para siempre (lo documenta el runner,
`lib/api-mako/areas/ads.run.ts:99-110`).

**Causa:** `DEFAULT_TIME_BUDGET_MS = 150_000` con el comentario «maxDuration de las rutas =
300s; reservamos ~150s para que la ÚLTIMA llamada a Claude (Opus high) termine»
(`lib/ads-analyst.ts:506-508`). O sea que el número supone una función de 300 s. Y
`timeBudget` se mira solo antes de ARRANCAR cada análisis (`:568`): acota cuántos se empiezan,
no cuánto dura el último, y una sola llamada (thinking + effort high) puede tardar hasta
~150 s. Llamado desde `app/api/v1/[area]/[operacion]/route.ts` (`maxDuration = 60`, `:34`),
un único análisis ya pasa el tope; pasarle un `timeBudgetMs` chico no cambia nada. Lo que
salva los datos: `processCandidate` escribe la fila recién al final (`:511-520`), así que
un corte no deja un análisis a medias.

**Regla:** un presupuesto de tiempo chequeado entre iteraciones no es un timeout; el techo
real es el `maxDuration` de quien llama, y hay que elegir el tamaño del lote contra ese
techo. La API de MaKo analiza de a UNO y en `after()` (`lib/api-mako/areas/ads.run.ts:851-863`,
`enSegundoPlano` :111-116), y el techo sigue siendo el de la función que confirmó — el
detalle de las pendientes colgadas, en [hallazgos-api-mako.md](hallazgos-api-mako.md).

**Vive en:** lib/ads-analyst.ts (`syncScriptAnalyses` :522-579) · lib/api-mako/areas/ads.run.ts
(`proponer_sincronizar_guiones`, `proponer_reanalizar_guion`) · *2026-09-16 api-mako-areas*

### ⚠️ Los umbrales del veredicto de un guion viven copiados en tres lugares

**Síntoma:** ninguno todavía. El día que alguien mueva el corte de gancho del 28% en la
pantalla, el cuadrante de /ads-analyst, el perfil de cuenta con el que Claude valora un
guion nuevo y lo que contesta la API de MaKo van a clasificar el mismo anuncio distinto.

**Causa:** el veredicto (escalar / reescribir / mejorar / repensar / validar) son
`verdictFromVals` y `confFromImpr`, funciones PRIVADAS de un componente cliente
(`app/ads-analyst/ScriptsBrowser.tsx:77`, `:93`, `:99-103`), con 28 / 10 / 8000 / 25000
escritos ahí. `lib/ads-analyst.ts` repite los números a mano —`HOOK_BENCH = 28, HOLD_BENCH
= 10; // mismos umbrales que el veredicto de la vista` (`:876`), y 8000 y 25000 adentro de
`buildAccountProfile` (`:904`, `:935`)— y la API de MaKo los copió una tercera vez
(`lib/api-mako/areas/ads.run.ts:545-551`). Ninguna importa de otra porque no hay de dónde.

**Regla:** «una cosa, un lugar» (AGENTS.md). El veredicto es una función pura y va en un
módulo propio **sin `server-only`**: `lib/ads-analyst.ts` lo tiene (`:27`), así que la
pantalla no podría importarla de ahí.

**Sin hacer:** exportar `veredictoCuadrante` y sus umbrales desde ese módulo, y que lo
importen los tres. La corrida no lo hizo porque toca la lib y la pantalla, fuera del área.

**Vive en:** app/ads-analyst/ScriptsBrowser.tsx:77-104 · lib/ads-analyst.ts:876,904,935 ·
lib/api-mako/areas/ads.run.ts (`ver_cuadrante_retencion`) · *2026-09-16 api-mako-areas*

### ⚠️ `counts.sinTranscript` no cuenta anuncios sin transcript

**Causa:** `getScriptAnalystView` lo calcula como los anuncios con métricas de Meta que NO
tienen fila en `script_analyses` (`lib/ads-analyst.ts:792`): un anuncio con transcript que
todavía no pasó por el análisis cae ahí. Los que tienen el transcript vacío quedan
`descartada` con motivo «sin transcript» (`:553-556`), o sea en OTRO contador.

**Regla:** el nombre del campo es lo único que lee un modelo (AGENTS.md → «Lo que le
devuelve una tool a un modelo»): con este nombre va a decir «no tienen transcript». La API
de MaKo lo aclara con una nota (`lib/api-mako/areas/ads.run.ts:536`); la lib sigue igual.

**Sin hacer:** renombrarlo (`sinAnalizar`) en la lib y en /ads-analyst.

**Vive en:** lib/ads-analyst.ts:787-795 · *2026-09-16 api-mako-areas*

### ⚠️ `getAngles` devuelve los 5 ángulos de fábrica ante cualquier falla: sirve para mostrar, no para escribir encima

**Causa:** `getAngles` cae a `DEFAULT_ANGLES` en cuatro casos que para quien lee son el
mismo: no hay fila, la fila queda vacía al sanearla, el JSON está roto, o la lectura falló
(`lib/script-angles.ts:46-55`) — y `getSetting` ya convierte un error de Supabase en `null`.
`getAvatares` hace lo mismo con `[]` (`lib/script-avatares.ts:40-48`). Mostrar los de
fábrica está bien. Editar a partir de ahí, no: el vocabulario se guarda como lista ENTERA,
así que un «agregar uno» que lea en un mal momento guarda los 5 de fábrica + el nuevo y la
lista del cliente desaparece sin error. El editor de /ads-analyst parte de esa misma lectura
(`app/ads-analyst/page.tsx:53-55`, con un `catch` más que también cae a los de fábrica), y
`TaxonomyManager` postea las DOS listas enteras al guardar
(`app/components/TaxonomyManager.tsx:57-58`).

**Regla:** para escribir encima de una lista se lee ESTRICTO (`getSettingEstricto`) y, si no
se pudo leer, no se escribe. Pero la fila vacía-al-sanear sí se trata como los de fábrica,
porque eso es lo que la pantalla MUESTRA: escribir sobre `[]` reemplazaría los 5 visibles
por uno. Molde: `vocabularioParaEscribir` (`lib/api-mako/areas/ads.helpers.ts:114-134`).

**Sin hacer:** esa lectura estricta vive en el área y no en `lib/script-angles.ts`; la
pantalla sigue partiendo de la tolerante.

**Vive en:** lib/script-angles.ts:46-55 · lib/script-avatares.ts:40-48 ·
app/components/TaxonomyManager.tsx · *2026-09-16 api-mako-areas*

### ⚠️ La biblioteca de ángulos y estructuras de guion de TODOS los clientes vive en los settings de un cliente

**Causa:** `getAngulosGuion` / `setAngulosGuion` / `resetAngulosGuion`
(`lib/guion-angulos-store.ts:17-38`) y su par de estructuras (`lib/guion-estructuras-store.ts:15-34`)
leen y escriben el override con `runWithWorkspace(OWNER_WS, …)`. El comentario lo justifica
«igual que la voz de MaKo (mako.voz.instancia)», pero `OWNER_WS` es el ws1, Mauricio: la
biblioteca con la que cada cliente escribe guiones (`lib/razones.ts`, `lib/guion-estructurar.ts`,
el área `contenido` de la API) cuelga de una fila de un inquilino. Y el precedente que cita no
lo justifica: `instanciaVoz` (`lib/mako-grupo.ts:38-47`) tiene el mismo defecto.

**Y es la trampa de `getAngles`, la entrada de arriba, en la biblioteca global.** `getSetting`
convierte un error de lectura en `null` y el store cae al catálogo de fábrica sin decirlo. El
editor de `/admin/guiones` arranca de ese GET y postea la lista ENTERA
(`app/admin/guiones/GuionesAdminView.tsx:62-78`): guardar después de una lectura caída pisa el
override con los de fábrica más la edición, y la pantalla contesta «Guardado — ya está vivo
para todos los clientes».

**Regla:** lo de la plataforma va en `wsSuperAdmin()` (AGENTS.md → «`OWNER_WS` NO es la
plataforma»), y lo que se lee para escribir encima se lee con `getSettingEstricto`.

**Sin hacer:** mudar `mako.guion_angulos` y `mako.guion_estructuras` al workspace del
super-admin, migrando el valor actual, y que el GET del editor falle en vez de mostrar los de
fábrica.

**Vive en:** lib/guion-angulos-store.ts · lib/guion-estructuras-store.ts ·
app/api/admin/guion-angulos/route.ts · app/api/admin/guion-estructuras/route.ts ·
app/admin/guiones/GuionesAdminView.tsx · *2026-09-16 api-mako-areas*

### ⚠️ El parser de bloques de un guion está dos veces, y las dos copias YA parten distinto

**Causa:** `parsearSecciones` (una línea sola en MAYÚSCULA es un rótulo) vive en
`app/components/SeccionCard.tsx`, que es `'use client'`: importarla desde el server da una
referencia de cliente, no la función (AGENTS.md → «'use client' es una frontera de DATOS»). La
API de MaKo la necesitaba en el server y copió la regla en `bloquesDeGuion`
(`lib/api-mako/areas/contenido.helpers.ts:180-206`).

**Lo obvio era «el día que cambie una, se van a desincronizar». Ya lo están**, sobre el mismo
guion. Las pantallas de guiones llaman `parsearSecciones(texto, undefined, 20)`
(`app/ads-writer/GuionLector.tsx:50`, `GuionCard.tsx:49`, `app/onboarding/MatrizView.tsx:651`,
`app/video-generator/VideoGeneratorApp.tsx:290`):

| | La pantalla | La API |
|---|---|---|
| Largo máximo de un rótulo | 20 | 48 |
| Frase corta en mayúscula adentro de un bloque | abre otra tarjeta | no, si se conocen las etiquetas de la estructura |
| Texto antes del primer rótulo | se tira | bloque «SIN RÓTULO» |
| Viñeta `-` `•` `·` al principio de una línea | se saca | queda |

O sea que los `bloques` que lee el modelo (`contenido.run.ts:272`) no son las tarjetas que ve la
persona.

**Sin hacer:** mudar la función a un `.ts` sin `'use client'`, decidir UNA regla para esas
cuatro filas, y que `SeccionCard` y el helper la importen.

**Vive en:** app/components/SeccionCard.tsx:18-50 · lib/api-mako/areas/contenido.helpers.ts:180-206 ·
*2026-09-16 api-mako-areas*

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

- ~~`getCampaignNameMap` y `getAdNameMap` truncan hoy~~ **ARREGLADO el 17/09/2026**, y no
  como decía esta línea. Ordenaban por `fecha` desc y se quedaban con la PRIMERA fila de cada
  id: pasado el corte, las campañas y anuncios que dejaron de correr **desaparecían del mapa
  enteros** y la UI mostraba «Campaña 120210… (sin nombre)» o el `meta_ad_name` viejo. Paginar
  con `[fecha desc, ad_id, id]` y first-wins habría funcionado, pero ata el resultado al
  orden. Quedó al revés: `leerPorPaginas` con `ORDEN_METRICAS` **ascendente**, cada fila pisa a
  la anterior, y la más reciente gana sola.
- ~~`getAgendasComparador` y el spend de `getRevenuePeriodo`~~ **ARREGLADOS el 17/09/2026**
  (`leerTodo` + `ORDEN_METRICAS`). No eran tan latentes: ws1 llega a 28 filas por día, así que
  un rango de más de ~5 meses ya cortaba el spend, y CAC y ROAS salían mejores que la
  realidad.
- **`getSenalesRecon` paginaba los anuncios y se olvidó de los presupuestos, en el mismo
  `Promise.all`.** `adset_budget_daily` tiene 47 adsets × 1 fila por día (4.059 filas en 88
  días en ws1): todo rango de 22 días o más volvía con 1.000, y la señal de ritmo comparaba
  gasto real contra un presupuesto incompleto. ARREGLADO el 17/09 con `leerTodo` ordenado por
  `[fecha, adset_id]`, que es la clave única de la tabla por inquilino. Y la lectura hermana de
  leads por `meta_ad_id` (955 de 1000 en ws1) también pagina.
- **Transcripción de anuncios (`app/api/cron/transcribe-ads/route.ts` y `jobTranscripts` en
  `lib/onboarding-extract.ts`), ARREGLADO el 17/09.** Leían `ad_id` de `marketing_metrics_daily`
  sin fecha (1.714 filas meta en ws1): los ads que caían del corte **nunca entraban al set de
  pendientes**, así que nunca se transcribían, y el job igual reportaba «N creativos
  transcriptos» como terminado. Y `ad_transcripts` es el set de «ya resueltos»: cortado, se
  vuelve a pagar la transcripción en OpenAI. Los dos paginan, y las miniaturas se piden solo de
  los anuncios que procesa cada corrida.
- `getVslSerie` (:1966 y :1973): 56 días de YouTube y Panda, cardinalidad baja (287 y 80
  filas en un trimestre). El último de la fila.
- ⚠️ **(16/09) El paginado del 02/09 cubrió el GASTO, no los leads.** *(17/09: sigue abierto,
  hoy en `:2989`; da 52 filas a 90 días y 121 a un año, así que es deuda y no bug vivo.)*
  `getTendencias` pagina
  sus cuatro lecturas de métricas y deja pelada la de leads (`:2961`): un
  `.or(fecha_agenda.gte, fecha_junta_1.gte, fecha_cierre.gte)` **sin tope superior** (trae
  también todo lo agendado a futuro), sin orden y sin paginar. Pasadas las 1000 filas,
  agendas, asistencias, cierres y CAC de Tendencias salen cortos, y qué leads se caen no
  está definido; pinta igual en /marketing. Los `pagos` de `:2962` van acotados por rango
  pero pelados. `listCACMensual` lee los leads con `fecha_primer_pago` también pelados
  (`:1057-1060`). Mientras tanto la API de MaKo cuenta las filas con un `count` exacto y
  pone la salvedad adentro de la respuesta (`contarFilas` + `avisoRecorte`,
  `lib/api-mako/areas/metricas.helpers.ts`); la cura es `leerTodo` en la lib. Las otras
  lecturas de leads y pagos que siguen peladas (el embudo de /marketing, el ciclo y el
  Outstanding de /comercial, las cuotas de /general) están en
  [hallazgos-crm.md](hallazgos-crm.md) → «Las lecturas de leads y pagos del embudo, el ciclo y
  la cobranza no paginan».
- ⚠️ **Y al revés: `docs/api-mako-inventario.md:1224` todavía dice que `getMarketingWindow`
  NO pagina.** Pagina desde el 02/09 (`:192-211`). Poner una salvedad de truncado ahí era el
  diagnóstico obvio y el equivocado: antes de agregar un aviso de recorte, abrí la función;
  un inventario se queda viejo solo.

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

**(16/09) Y con el CAC pasa lo mismo, tres veces.** `getMarketingWindow` divide el gasto por
los leads con `cerro` en la ventana (`:323`); `getRevenuePeriod` lo divide por los
**primeros pagos** del período (`:867-868`) y `listCACMensual` agrupa por mes de
`fecha_primer_pago`; `getCACAcumulado` divide TODO el gasto histórico por todos los `cerro`
(`:708-722`). Del lado de `estado_lead = 'ganado'` están `getFunnelEtapas` (`:1248`),
`getFunnelSeries` (`:1476`), `getTendencias` (`:2995`) y `getMrrActivo` (`:789`). **Si dos
números de cierres o de CAC no coinciden entre pantallas o entre operaciones de la API, casi
siempre es esto, no un bug:** antes de depurar, mirá qué definición usa cada uno.

---

## `listar_campanas_meta` le decía dólares a los pesos, y «reciente» a una ventana que no conocía

**Vive en:** `lib/mako-doer-acciones.ts` (case `listar_campanas_meta`) · **Encontrado:**
02/09/2026, como corolario de la auditoría de los ocho getters de arriba. **Arreglado el
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

**Lo que quedó de la lista de arriba:** nada, y no por este arreglo. Los ocho getters de
`lib/queries.ts` los paginó la otra sesión el mismo día (`07c632ee`), y ahí mismo se corrigió
el veredicto «latente, no vivo» de la sección anterior: **tres de los ocho no tenían filtro de
fecha ninguno**, así que estaban truncando en producción. `MarketingWindow.agendamientos` pasó
a `reuniones_en_ventana` en el mismo commit. Esta tool era el **noveno** lector de esa tabla
que ignoraba el techo, no el octavo.

---

## La tijera de Ads Manager: la pantalla es de todos, los endpoints son de dos

**Síntoma reportado (05/09/2026):** el wizard «Nueva campaña» en el paso *destino*, con el
`<select>` de pixel diciendo **«No hay pixel en la cuenta»**, un texto rojo sobre públicos
debajo de una pantalla de pixel, y **«Siguiente» gris para siempre**. Se reportó como «no me
deja publicar», que es lo único que se podía ver.

**La causa:** `app/api/ads-manager/targeting/route.ts:20` corre `guardAdsDueno()` **antes** de
leer `kind` (línea 21), así que un solo 403 tapa los seis kinds — públicos, pixeles,
conversiones, formularios y eventos. El predicado es `esDuenoAdmin()`: rol GLOBAL `admin`
(que ni mira el workspace) **o** estar parado en `OWNER_WS`=1 con `rol_ws` admin.

**Medido contra la base de producción**, que es lo que convierte esto en un problema de
producto y no en un tropiezo de sesión — de 8 usuarios, **pasan 2**:

| Cuenta | rol global | ws | pasa |
|---|---|---|---|
| martinkoncke@gmail.com | admin | 9 | **sí** (admin de plataforma) |
| mbustos@elevate.com.mx | usuario | 1 | **sí** (admin del ws1) |
| Leila, Código Inmobiliario, P2P, Ananda, Leandro, prueba | usuario | 5·10·11·13·14·3 | **no** |

Los **seis clientes reales** ven la tab, entran, cargan creativos, eligen objetivo,
presupuesto, estrategia, público y ubicaciones — siete pasos — y recién en el octavo chocan
con un 403 disfrazado. `app/ads-manager/AdsManagerView.tsx:33` gatea con `requireRolWs([], {
nav:'ads-manager' })`, y `lib/tab-access.ts:102-104` dice **textual** que `[]` no significa
«solo la agencia»: el admin-cliente de cada workspace devuelve `'admin'` y pasa.
`app/_components/nav.ts:139` tampoco tiene `adminOnly` ni `rolesWs`.

### Por qué el diagnóstico obvio era el equivocado

Tres trampas, y las tres cuestan tiempo en direcciones distintas:

1. **La pantalla AFIRMABA un hecho falso sobre la cuenta del cliente.** «No hay pixel en la
   cuenta» manda a Meta, a revisar el Business Manager, a mirar credenciales — todo el lugar
   equivocado. La cuenta tiene pixeles.
2. **«Abrir el guard» no funciona, y además es el arreglo incorrecto.** Hay **tres** candados
   en serie sobre el mismo cableado: `guardAdsDueno` en targeting, el guard de
   `campaign-create`, y `assertCuentaDelDueno()` (`lib/meta-ads-create.ts:92-100`, primera
   línea de `graphPost` y `graphGet`). Aflojar el primero llena el select, habilita
   «Siguiente» y **mueve la falla al final**, después de que MaKo escribió la campaña entera.
   Y aflojar los tres sin recablear credenciales pone a un cliente a crear campañas sobre la
   página y la cuenta de Mauricio, con plata real.
3. **«Es admin, entonces el guard está roto» se invierte al leer el código.**
   `getSesionAdmin()` (`lib/auth.ts:76-79`) no mira el workspace, así que un admin de
   plataforma pasa aunque esté impersonando el ws 10. **Que ese texto aparezca PRUEBA que la
   sesión no era de admin de plataforma** — el guard funcionó.

### La regla que quedó: tres estados, no dos

`j.ok ? j.items : []` colapsa **«no pude preguntar»** en **«pregunté y no hay»**. De las 9
llamadas a `/targeting`, **8 lo hacían**: solo la de públicos mostraba el error. Y la regla
ya estaba escrita **dos veces en este mismo repo** — «un permiso denegado se contesta como
denegado; devolver la forma del éxito convierte un guard en un placebo» (más arriba, sobre
`regenerate-transcript`) y el 403 pintado como «0 operaciones» en `hallazgos-ia.md`. Se violó
igual, porque estaba escrita como anécdota y no como regla de código.

Arreglado: `traerTargeting()` en `NuevaCampanaModal.tsx` devuelve `null` cuando no se pudo
preguntar y deja el porqué en `metaDenegado`; `sinPixeles` exige además que no haya denegación,
así que el placeholder ya no miente. Igual en `AgregarConjuntoModal`, `AgregarAnuncioModal` y
`EditarPublicoModal`. **Esto no habilita el botón** —con el 403 no hay pixeles, se muestre como
se muestre—: lo que compra es que el próximo diagnóstico arranque en el lugar correcto.

### De paso: tres rutas de IA sin ningún guard

`analyze-creatives`, `campaign-suggest` y `rename-suggest` no tenían **nada**. `campaign-suggest`
dispara `chatClaude` con thinking y 16k tokens; `analyze-creatives` resuelve la key con
`envCred('OPENAI_API_KEY')`, o sea **la key de la plataforma**. Cualquier usuario logueado
quemaba IA por ahí, sin poder usar el resto del área. Cerradas con `guardAdsDueno()`.

Y los tres guards inline (`campaign-create`, `creative-signurl`, `creative-upload`) repetían
el mismo predicado con **otra redacción** («…en el workspace principal por ahora»), así que
quien depuraba creía estar ante dos problemas. Unificados en `guardAdsDueno()`, cuyo texto
ahora nombra las dos vías que lo abren y dice **por qué** — «no es un problema de tu cuenta de
Meta ni de tu pixel», que es exactamente la conclusión equivocada a la que empujaba.

### Lo que quedó SIN hacer

- **La tijera sigue abierta.** La tab se le ofrece a seis clientes que no la pueden usar.
  Cerrarla es una decisión de producto: o se gatea la vista con el mismo predicado (choca con
  «nada es solo para el dueño», más arriba), o se deja visible con un estado explícito y el
  botón «Nueva campaña» deshabilitado con el porqué. **Vive en:**
  `app/ads-manager/AdsManagerView.tsx:33`, `app/_components/nav.ts:139`,
  `app/ads-manager/CampanasBrowser.tsx:552`.
- **Tarea #170 sigue siendo lo único que abre Ads Manager de verdad.** `getEnv()`
  (`lib/meta-ads-create.ts:37-47`, `process.env` crudo y síncrono) tiene que pasar a
  `credWs` asíncrono, como ya hicieron `meta-ads.ts:59`, `meta-health.ts:48` y
  `meta-write.ts:37`; `META_PAGE_ID` deja de ser literal (`lib/config.ts:46`) en sus 6 usos;
  se limpian los `process.env.META_PIXEL_ID` sueltos (`meta-ads-create.ts:199` y `:351`,
  `campaign-create/route.ts:40`) y se keyea por workspace el memo global `_igActorId`.
  **Recién después** el gate pasa de `esDuenoAdmin()` a `adminDeWorkspaceActual()` — que
  pregunta «¿administrás ESTE workspace?» en vez de «¿sos la agencia?». Nunca a
  `esWorkspaceDueno()` a secas ni a sacar el guard: en cuanto sea per-workspace, el rol es lo
  único que separa a un closer/setter de **borrar campañas con plata**.
- **`campaign-preview` está gateada y no la llama nadie** (cero fetch en `app/ads-manager/`).
  Sigue expuesta por HTTP y ejecuta `generatePreviews` contra la cuenta del dueño.
- **`lib/capas.ts:268-269`**: `tabEnCapa = navEnCapa || userNavEnCapa` anula cualquier
  `navKeys` restringido cuando `userNavKeys` es null — hoy deja el gate de la capa
  `superadmin` **inerte**. ⚠️ El arreglo **no** es cambiar el `||` por `&&`: rompe `/perfil`
  para la capa `pm`.

**Vive en:** lib/ads-guard.ts · app/api/ads-manager/targeting/route.ts:20 ·
app/ads-manager/NuevaCampanaModal.tsx (traerTargeting, ConversionPicker) ·
app/ads-manager/{AgregarConjunto,AgregarAnuncio,EditarPublico}Modal.tsx ·
lib/workspace.ts:149-173 · app/ads-manager/AdsManagerView.tsx:33 · app/_components/nav.ts:139
· *2026-09-05 ads-manager-403-publicar (144 agentes)*

---

## Tarea #170 CERRADA: Ads Manager escribe sobre la cuenta de CADA cliente

Cierra la tijera de la sección anterior, y por el lado correcto: en vez de esconderle
la tab a los seis clientes, se recableó el lib para que cada uno cree sobre SU cuenta.

**Lo que cambió:** `lib/meta-ads-create.ts` resolvía token, cuenta, página y pixel de
`process.env` (más `META_PAGE_ID` como literal de `lib/config.ts`). Ahora salen de
`credWs(clave, ws)`. El gate pasó de `esDuenoAdmin()` («¿sos la agencia?») a
`adminDeWorkspaceActual()` («¿administrás ESTE workspace?»).

**El precedente estaba escrito y era exactamente este bug.** El docblock de
`adminDeWorkspaceActual` (lib/workspace.ts:176-191) dice, textual, que gatear con el
guard de la agencia «es lo que le devolvía un 403 a todo cliente que apretaba
"Conectar Google Calendar" (ws13, Código Inmobiliario)». La misma equivocación —una
acción DEL CLIENTE gateada con el guard DE LA AGENCIA— ya se había encontrado y
arreglado en otra tab, y en Ads Manager quedó viva. **Cuando encuentres un guard que
rechaza a alguien que debería pasar, buscá si el predicado correcto ya existe: acá
estaba escrito, probado en producción y con el porqué al lado.**

### Por qué se BORRAN los wrappers en vez de volverlos async

`ver()`, `acct()` y `token()` no se convirtieron en async: se **borraron**, y el
typecheck enumeró los 60 call-sites. El motivo es que **36 de ellos viven dentro de
template literals**. Ahí un `await` olvidado no rompe nada: interpola `[object
Promise]`, la URL sale mal y Meta contesta un error que no se parece en nada a la
causa. Ni `tsc` ni el eslint del repo lo agarran — no hay `restrict-template-expressions`.
Borrando el identificador, los 60 se vuelven «Cannot find name» y no queda ni una mina.

**La regla: cuando una función sincrónica se vuelve async y sus llamadores la
interpolan en strings, borrala y dejá que el compilador te la reclame. Cambiarle el
tipo in-place deja verdes exactamente los call-sites que fallan en runtime.**

### Los tres acoplamientos que el candado tapaba

`assertCuentaDelDueno()` gritaba si se llamaba al lib desde otro workspace, así que
mientras existió, estos tres no podían hacer daño. Sacarlo sin arreglarlos los habría
convertido de minas dormidas en vivas, y **ninguno de los tres falla ruidoso**:

1. **El memo de Instagram era un `let` de módulo.** `_igActorId` se comparte entre
   TODOS los workspaces del proceso, y su valor viaja como `instagram_user_id` al
   crear el creativo. El anuncio del cliente B publicado en el Instagram del A, con
   Meta aceptándolo y «listo» en la pantalla. Ahora es un `Map` keyeado por
   `page:acct` — la **identidad resuelta**, no el ws: con `Map<ws,…>`, un cliente que
   cambia su página desde /integraciones seguiría viendo el IG de la página vieja
   hasta que Vercel recicle el lambda.
2. **El pixel salía de `process.env.META_PIXEL_ID`.** Un cliente le habría atribuido
   SUS conversiones al medidor de Mauricio, y la campaña habría optimizado contra él.
3. **`buildObjectStorySpec` era síncrona y exportada**, con el `page_id` del dueño
   adentro. Sus dos llamadores ya estaban en contexto async, así que el costo fue cero
   — pero es el tipo de función que obliga a elegir entre volver async media cadena o
   pasar la credencial por parámetro.

### El falso precedente que compila, pasa los tests y no arregla nada

`lib/meta-write.ts:37` usa `envCred('META_ACCESS_TOKEN')` y parece el molde a copiar:
es del área, es de Meta, y es una escritura. **No lo es.** `envCred` resuelve SIEMPRE
contra `OWNER_WS` (lib/credenciales.ts:204-215). Copiarla acá habría dejado el archivo
cableado al dueño **con el candado ya sacado** — el peor estado posible, y con los 1924
tests en verde. Los precedentes buenos son `lib/meta-ads.ts:59` y `lib/meta-health.ts`.

Y `credWs` va siempre con sus **dos** argumentos: la forma de un argumento pasa por
`wsDefault` y termina en `?? OWNER_WS`, que es Mauricio, un CLIENTE. Las hermanas la
usan con uno porque solo LEEN; acá se crea y se borra con plata.

**Verificado antes de tocar nada:** para el ws1, los cinco valores efectivos son
idénticos leídos por `process.env`/constante o por `credWs(clave, 1)`. El recableado es
no-op para Mauricio. Ese contraste es el paso que hay que correr **antes** de cualquier
migración de credenciales, y son diez minutos.

### ⚠️ Cambio de comportamiento para el admin de plataforma

Martín tiene workspace propio (ws9), así que `getWorkspaceActual()` le devuelve 9 y Ads
Manager le va a resolver las credenciales de ws9 — que no tiene ninguna. **Para operar
la cuenta de Mauricio ahora hay que entrar al ws1**, como en cualquier otra tab. Es el
contrato correcto, y es una sorpresa la primera vez. El único `null` que sigue mapeando
a OWNER_WS es el del admin de agencia SIN workspace propio.

### El arnés, y por qué son asserts sobre el fuente

`tests/ads-manager-credenciales.test.ts`. Los dos libs llevan `server-only`, así que
ningún test de node:test los puede importar; el precedente del repo es el mismo. Cada
assert fija una regresión **que compila y pasa los otros 1931 tests**: `credWs` de un
argumento, `envCred`, un `process.env` que no sea `META_API_VERSION`, el page id del
dueño sin acotar, un `let` de módulo, el gate volviendo a `esWorkspaceDueno`, y una
ruta de ads-manager sin guard. Probado por mutación: cada una de las tres mutaciones
que se intentaron falla **solo** en el test que le corresponde.

### Lo que quedó SIN hacer

- ~~**`lib/meta-write.ts` sigue en `envCred` y su ruta en `esDuenoAdmin`.**~~ **HECHO el
  07/10/2026** — ver «Pausar, represupuestar, renombrar y borrar: ahora con la cuenta de
  cada cliente», al final de este documento.
- **`deleteEntity` (lib/meta-ads-create.ts) no mira `body.error`**, y la cabecera del
  propio archivo documenta que Meta manda errores con HTTP 200. Con credenciales por
  workspace, el rollback de un árbol a medio crear va a reportar éxito y dejar campañas
  huérfanas **en la cuenta del cliente**.
- **El tipo de cambio 17.30 y la moneda.** El presupuesto se pide en MXN y se manda en
  centavos de la moneda DE LA CUENTA. Para un cliente que no factura en MXN eso ya está
  mal hoy en el camino de LECTURA (lib/meta-ads.ts y el cron ya corren por workspace).
  **Vive en:** lib/config.ts:19, app/ads-manager/NuevaCampanaModal.tsx:37, lib/ads-analyst.ts:634.
  **(07/10) La mitad de ESCRITURA está hecha:** los cuatro lugares donde se tipea un
  presupuesto (el wizard, «Agregar conjunto», la celda y la barra de lote de la tabla)
  convierten con la moneda de la cuenta por `lib/presupuesto-cambio.ts`. La de LECTURA
  (lib/ads-analyst.ts y lo que asume pesos al leer métricas) sigue igual.
- **El geo default `'MX'`** (lib/meta-ads-create.ts) y las fechas en zona de Tijuana
  (app/ads-manager/AdsManagerView.tsx): un cliente colombiano publica segmentando
  México sin que nada se lo diga.
- **Las tres rutas de IA y la transcripción** queman la key de la PLATAFORMA vía
  `envCred`. Con el gate abierto, el wizard de cada cliente gasta IA de la agencia. Es
  una decisión de producto (quién paga), no del recableado.
- **`META_PAGE_ID` y `META_PIXEL_ID` figuran `opcional: true`** en el catálogo BYOK
  (lib/metodo-catalogo.ts). Para Ads Manager el page id NO es opcional: es la raíz de
  todo creativo. Un cliente puede ver «Meta Ads conectado» en verde y no poder crear
  ni un anuncio.
- **`meta_campaign_drafts` no está en `TENANT_TABLES`** (lib/workspace.ts), así que el
  borrador completo —copy, targeting, presupuestos— sigue siendo global. Cambiar los
  escritores a `getTenantDb` SIN agregar la tabla al Set es un **no-op silencioso**: el
  proxy corta en seco para toda tabla que no esté en el Set.

**Vive en:** lib/meta-ads-create.ts · lib/ads-guard.ts · las 14 rutas de
app/api/ads-manager/ · tests/ads-manager-credenciales.test.ts ·
*2026-09-05 tarea-170-meta-por-workspace*

---

## Seis credenciales de Meta compartidas entre workspaces: el guard cubría 1 de 4 claves

Medido contra producción el 05/09/2026, descifrando la tabla `credenciales`:

| Par | Qué comparten |
|---|---|
| ws1 (Mauricio) + ws4 (Cliente de Diseño) | token, cuenta publicitaria y pixel |
| ws13 (Código Inmobiliario) + ws14 (P2P Consulting) | token, cuenta publicitaria y pixel |

**No es una fuga entre personas** — Martín confirmó que ws13 y ws14 son dos negocios
del MISMO dueño, con una cuenta cada uno en MaKo. Pero sí es un problema de datos: con
la misma cuenta publicitaria en las dos filas, el General de P2P muestra el gasto y las
campañas de Código Inmobiliario, y MaKo los presenta como si fueran de cada negocio.

**La causa, y es la parte que vale:** `guardarCredencial` reclama el identificador solo
para las claves de `ROUTING_CREDS` (lib/webhook-routing.ts), que responde **«¿qué clave
rutea webhooks entrantes?»**. `META_PAGE_ID` está ahí porque rutea leads; la cuenta
publicitaria no rutea nada, así que nadie la reclama. Y el bucle de
`app/api/integraciones/credencial/route.ts:360` guarda campo por campo, cazando el
`IdentificadorOcupadoError` para que un identificador ajeno «no tumbe TODO el
descubrimiento» — correcto en intención, y el efecto es que las otras tres pasan.

**La prueba de que ésa es la causa y no una coincidencia: `META_PAGE_ID` es la ÚNICA
clave sin duplicados en toda la tabla.** El guard funciona; cubre una clave de cuatro.

**La regla: «qué clave rutea webhooks» y «qué clave identifica a un inquilino» son dos
conjuntos distintos, y usar el primero como si fuera el segundo deja pasar justo lo que
más importa.** Un identificador de cuenta ajena no hace falta robarlo: son públicos, y
se pegan sin querer al copiar un token de un workspace a otro.

**Y el corolario del autocompletado:** pegar UN token dispara `descubrirMeta`, que
escribe cuatro credenciales derivadas. Un solo pegado en el workspace equivocado
propaga la identidad entera de otro inquilino. Donde un campo autocompleta a otros, el
guard va sobre **todos** los derivados, no sobre el que se pegó.

**Vive en:** lib/credenciales.ts (guardarCredencial) · lib/webhook-routing.ts
(ROUTING_CREDS) · app/api/integraciones/credencial/route.ts:360 ·
*2026-09-05 tarea-170-meta-por-workspace*

---

## Tres cosas que Ads Manager afirmaba sin haberlas mirado (08/09)

Las tres tenían la misma forma: **un valor escrito de antemano ocupando el lugar de un
dato que nunca se pidió.** Ninguna fallaba: las tres entregaban, con la cara del éxito.

### «Analizar (Meta)» leía una forma que Meta no devuelve

**Síntoma:** con el token correcto y la cuenta al día, el modal decía *«Meta no devuelve
recomendaciones por API… el bloqueo restante suele ser la cuenta restringida por pago
(account_status=3) y/o la 2FA obligatoria»*. Sobre Código Inmobiliario (ws13), que está
`account_status=1`, `disable_reason=0` y con `ads_management` + `ads_read` +
`business_management` concedidos.

**Causa 1 — la forma.** El edge de CUENTA `act_<id>/recommendations` y el campo
`recommendations` de un NODO (campaña/conjunto/anuncio) se llaman igual y **no devuelven
lo mismo**. El de nodo trae `title` / `message` / `importance`. El de cuenta trae:

```
{ "data": [ { "recommendations": [ { "type": "PIXEL_OPTIMIZATION_HIE",
    "recommendation_content": { "body": "…", "lift_estimate": "Costo por compra 14% más bajo",
                                "opportunity_score_lift": "8" },
    "object_ids": [...], "url": "https://adsmanager.facebook.com/…" } ] } ] }
```

Sin título, sin `message`, sin `importance`, y **anidado un nivel**. El código leía la
forma de nodo sobre la respuesta de cuenta. Medido contra `act_564003520636790` (ws1) el
2026-09-08: Meta devolvía **5 recomendaciones reales y opportunity_score 81**, y la
pantalla pintaba **una tarjeta vacía titulada «Recomendación de Meta»**. Por eso nadie lo
vio como un bug: no daba cero, daba una fila en blanco.

**Causa 2 — el motivo hardcodeado, y es la peor.** Cuando venía vacío, la respuesta traía
un párrafo FIJO culpando al token de página, al `account_status=3` y a la 2FA. Eran
verdades **de la cuenta del dueño en junio**, congeladas en un `reason:` literal. Para
cualquier otra cuenta el texto era una acusación falsa que mandaba a arreglar una factura
que no existe. El vacío de ws13 es real y aburrido: **Meta no tiene recomendaciones para
esa cuenta todavía** (cuenta nueva, poco gasto), y `opportunity_score` ni siquiera viene
en la respuesta.

**Regla:** *si el motivo no sale de la respuesta que acabás de recibir, es una adivinanza
con cara de dato.* El motivo ahora se arma con el `account_status` / `disable_reason` que
Meta contestó en la misma llamada (`app/api/meta-recommendations/route.ts`), y hay tres
ramas explícitas: cuenta frenada (dice cuál y por qué), cuenta activa (dice que no es un
problema de configuración) y no-pude-leer (lo admite en vez de rellenar).

**Ojo — el mismo parser mal usado estaba en `lib/meta-health.ts:fetchAccountRecommendations`,**
que alimenta las recomendaciones del semáforo de `/marketing/salud`. Mismo edge, misma
lista de tarjetas vacías. El parser correcto vive ahora en `lib/meta-recos-cuenta.ts` y
acepta las DOS formas; `parseRecosMeta` sigue siendo la de NODO y ahí está bien.

### `{ countries: ['MX'] }` cableado en cuatro archivos

**Síntoma:** un cliente argentino crea una campaña y Meta la segmenta en México. No hay
pantalla donde cambiarlo.

**Causa:** el país no se preguntaba **en ningún paso del wizard**. Estaba escrito a mano
en `NuevaCampanaModal` (las TRES ramas de estrategia), en `AgregarConjuntoModal`, en el
fallback de `buildTargeting` y en el `?? ['MX']` de `coerceTargeting`. Cuatro archivos, un
solo síntoma, y el fallback **no fallaba: entregaba** — en el país equivocado, en silencio
y con plata puesta.

**Y el diagnóstico obvio para el default es el equivocado.** Lo natural es sacar el país
de `business_country_code` de la cuenta. Sobre ws13 eso da **`US`**: la cuenta es
«P2P Consulting LLC», una LLC estadounidense. Ese campo es el país **fiscal**, no el del
público. El que acierta es `timezone_name` = `America/Argentina/Buenos_Aires` → `AR`: es
la zona que se eligió para OPERAR la cuenta. Manda la zona horaria, el país fiscal queda
de respaldo (`lib/meta-pais.ts`), y **el wizard pregunta igual** — adivinar bien no
reemplaza a poder editar. El catálogo de países sale de Meta (`search?type=adgeolocation`,
247 países con nombre en español), no de una lista nuestra.

### Y de paso: el presupuesto se multiplicaba por 17,3 en cuentas que no cobran en pesos

No lo reportó nadie; apareció al tocar el mismo modal. `daily_budget_mxn` termina en
`mxnACentavos`, que hace **centavos de la moneda de la cuenta, sea cual sea**. Los dos
modales convertían USD→MXN *siempre*. La cuenta de ws13 cobra **en USD**: escribir «$1/día»
creaba la campaña con `daily_budget = 1700` = **US$17/día, 17× lo tipeado**. En pausa, sí
— y lista para gastarlo al primer toggle. Ahora se convierte con la moneda real de la
cuenta (`usdACuenta`), y para una moneda sin tasa conocida **no se inventa una**: el monto
va tal cual y la pantalla lo dice.

⚠️ **(16/09) Y la moneda de la cuenta también tiene su default inventado:** `cuentaMeta()`
devuelve `currency: 'USD'` cuando Meta no manda el campo (`lib/meta-ads-create.ts:575`).
Quien la lea no distingue «la cuenta cobra en dólares» de «no sé en qué cobra», y justo esa
función existe para dejar de adivinar la moneda (su comentario, `:560-564`).

⚠️ **(07/10) Y no eran dos lugares: eran TRES.** La celda de presupuesto de la tabla del
Ads Manager (`BudgetEditor` en `app/ads-manager/CampanasBrowser.tsx`) multiplicaba SIEMPRE
por `TIPO_DE_CAMBIO_USD_MXN`, y lo que MOSTRABA dividía siempre por 17,3. Esa tercera vez
no mordía a nadie mientras sólo el ws1 (MXN) podía escribir: `db7b7682` abrió la escritura a
todos los workspaces, y desde ese commit una cuenta en USD escribía 865 USD/día al tipear 50.
Se cerró en la tarea #349 — ver «Cambiar un presupuesto pasa por un cartel» al final.

**La barra de lote NO tenía este bug** (lo corrigió la revisión de la #349: la primera
versión de este párrafo la contaba como «la cuarta vez»). Mandaba el número tipeado CRUDO
en la moneda de la cuenta (`Number(monto.replace(',', '.'))`, sin tasa), que es correcto
en cualquier moneda: no hay escrituras infladas hechas desde el lote que buscar. Su defecto
era otro: tipeaba en una unidad distinta de la celda (el mismo «50» eran 50 MXN en la
barra y 865 en la celda, en la misma pantalla) y leía «1.500» como 1,5. Desde la #349 el
lote tipea en dólares como la celda, así que **para el ws1 el mismo número tipeado en el
lote vale ahora 17,3 veces más que antes**: quien tipeaba pesos ahí ahora tipea dólares (el
placeholder y el cartel lo dicen).

⚠️ **(08/10) Y la LECTURA no se había arreglado nunca: el gasto de Meta se pasaba a dólares como si
toda cuenta cobrara en pesos.** Las tres veces de arriba eran escrituras y se cerraron con
`cuentaAUsd` / `usdACuenta` (`lib/presupuesto-cambio.ts`). Lo que se MOSTRABA seguía dividiendo por
`TIPO_DE_CAMBIO_USD_MXN` para todos: 44 usos en 13 archivos, empezando por `lib/queries.ts`
(«Meta devuelve spend en MXN (la cuenta está en MXN)»), que alimenta el dashboard, el CAC, los
experimentos y el estructurador de campañas. Medido contra Meta: **ws1, ws4 y ws11 cobran en MXN;
ws13, ws14 y ws15 en USD**, y para esos tres todo gasto en dólares salía 17,3 veces más chico (MaKo
decía «1.336 MXN ≈ 77 USD» sobre 1.336 dólares). La salud de la cuenta, además, le ponía «MXN» al
saldo de una cuenta en dólares.

**Arreglado el mismo día, en un solo lugar.** `conversorGastoMeta()` (`lib/moneda-meta.ts`) da el
conversor del workspace en curso, y la regla de qué hacer con cada moneda es `conversorDeGasto`
(`lib/presupuesto-cambio.ts`, pura y con test): USD tal cual, MXN con la tasa del código, una moneda
sin tasa NO se convierte, y una moneda desconocida va vacía donde la salida puede decir «no sé» (las
métricas de MaKo, la tool del doer, el KPI de inversión) y como antes —con un aviso— sólo en los
tableros cuyo tipo no admite vacío. La moneda se guarda en `meta.moneda_cuenta`: la escribe el
sincronizador (`fetchMetaInsights` pide `account_currency` en el mismo pedido) y, si falta o es de
otra cuenta, se le pregunta a Meta una vez. La tool del doer nombra el campo con la moneda real
(`gasto_usd`, `gasto_mxn`). `tests/moneda-meta.test.ts` barre `lib/` y `app/`: un lector nuevo que
vuelva a dividir por `TIPO_DE_CAMBIO_USD_MXN` no pasa.

⚠️ **Lo que NO cambió, a propósito:** los nombres `spend` / `*Mxn` / `balanceMxn` de la base y de los
tipos siguen así aunque signifiquen «en la moneda de la cuenta» (renombrarlos es una migración y
toca decenas de pantallas), y `META_BALANCE_ALERTA_MXN` vale 1, que funciona igual en cualquier
moneda. Si ese umbral sube, hay que hacerlo por moneda.

**Regla que queda, y es la de las tres:** un campo con el nombre de una moneda o de un país
adentro (`daily_budget_mxn`, `countries: ['MX']`) es una constante disfrazada de dato. Lo
que decide la moneda y el país es **la cuenta publicitaria**, y hay que ir a preguntárselo:
`/api/ads-manager/targeting?kind=cuenta` devuelve `{ currency, country }` y
`kind=paises` el catálogo.

**Sin hacer:** `daily_budget_mxn` sigue llamándose así en `lib/campaign-types.ts` y en el
JSON que se le pide a MaKo (`CAMPAIGN_JSON_SHAPE`), aunque hace rato signifique «monto en
la moneda de la cuenta». El nombre es la próxima trampa. Y el selector de país es por
PAÍS: no hay ciudades ni radios, aunque `Targeting.geo_locations` ya los tipa y
`cleanGeo` ya los sabe mandar.

---

## Los lugares de Meta: qué acepta, qué rechaza, y dos endpoints que contestan distinto (11/09)

**Síntoma:** el paso nuevo de país dejaba elegir sólo países. Martín: «debería poder
seleccionarse lo que sea, provincia, estado, ciudad, localidad o incluso código postal…
que coincida con Meta». Y el país elegido colgaba del pie del wizard (con un 📍) en todas
las pantallas.

**Lo que Meta acepta, medido con `execution_options=["validate_only"]` al crear un
conjunto** (valida sin crear nada) sobre la cuenta del dueño:

| Clave en `geo_locations` | Ejemplo real | |
|---|---|---|
| `countries` | `AR` | ✔ |
| `regions` | `97` Provincia de Buenos Aires | ✔ |
| `cities` | `84740` Ciudad de Córdoba — sin radio, o 17–80 km | ✔ (5 km ✖ `1487110`) |
| `zips` | `AR:C1425` | ✔ |
| `neighborhoods` / `subcities` | `2871807` Alta Córdoba | ✔ |
| `medium_geo_areas` | `82782` Partido de Morón | ✔ |
| `geo_markets` | `COMSCORE_MARKET:2017` Miami | ✔ |
| `custom_locations` | `address_string` + radio ≥ 1 km | ✔ (0,5 km ✖ `1487940`; dirección que no geocodifica ✖ `1487855`) |

**Incluir dos lugares donde uno contiene al otro es un rechazo de la campaña entera**
(`1487756`, «Some locations conflict»): país+ciudad, provincia+ciudad, país+pin,
ciudad+código postal. Es el caso de todos los días —el país de la cuenta viene precargado
y el usuario busca su ciudad—, así que `agregarLugar` saca el más grande y lo dice.
Excluir adentro de lo incluido sí vale (Argentina menos CABA ✔).

⚠️ **Y lo que parece un choque y NO lo es:** ciudad+barrio y provincia+partido Meta los
acepta juntos. `contiene()` devuelve false a propósito; sacarle uno al usuario sería
inventar una regla que Meta no tiene.

### ⚠️ `delivery_estimate` devuelve CERO donde `reachestimate` devuelve el rechazo

El diagnóstico obvio para validar una segmentación sin campaña era `delivery_estimate`.
Es el equivocado: para el choque país+ciudad, el radio de 5 km y el pin de 0,5 km
contesta **`0–0` personas, sin error**. Se lee como «público chico». `act_<id>/reachestimate`
devuelve **el mismo subcode que la creación real**, en los 8 casos medidos, y tampoco
necesita campaña. Por eso el paso 'lugar' mide el alcance con ése y no avanza si Meta
rechaza. El único choque que el selector no puede deducir por id —una dirección adentro de
un país incluido— lo frena ese chequeo antes de publicar.

### ⚠️ La búsqueda mundial esconde lo local

`search?type=adgeolocation` con todos los tipos y `limit=15`, para «Córdoba»: la
**Provincia de Córdoba no aparece** y la Ciudad de Córdoba sale 12ª, detrás de Colombia y
España. Para «Morón», el partido no aparece. Subir el límite no lo arregla: el orden de Meta
**cambia con el límite** (la ciudad es 2ª con 50 y 5ª con 100). Con `country_code=AR` la
ciudad sale 1ª y el partido 2º. `searchLugares` hace las dos consultas en paralelo y
`ordenarLugares` las junta: primero lo local, después cuánto se parece el nombre (por
palabra entera: «Córdoba» no matchea «Cordobesa»), después el tamaño del lugar.

### Y `cleanGeo` tenía dos bugs que la UI de sólo-países tapaba

- **Toda ciudad salía con +17 km** (`radius: c.radius ?? 17`): un público más grande que
  el elegido, sin preguntar. Sin radio, Meta segmenta la ciudad sola (validate_only ✔).
- **`tieneGeo` contaba sólo países, regiones y ciudades.** Una campaña segmentada SOLO por
  código postal «no tenía geo» y caía al país de la cuenta: el país entero en vez del barrio.
  Las claves que no estaban en `cleanGeo` tampoco llegaban a Meta, sin error.

**Vive en:** `lib/meta-geo.ts` (modelo puro, reglas medidas y orden de búsqueda) ·
`app/ads-manager/LugarPicker.tsx` · `lib/meta-ads-create.ts` (`cleanGeo`, `searchLugares`,
`alcanceGeo`) · `app/api/ads-manager/targeting/route.ts` (`kind=lugares`, `kind=alcance`).

**Sin hacer:**
- **Pin en el mapa** (latitud/longitud): sólo dirección escrita. `cleanGeo` ya sabe mandar
  lat/long; falta la pantalla. *(07/10: un pin YA se lee, se ve y se le cambia el radio en un
  conjunto que corre — ver la entrada de abajo. Lo que sigue sin hacer es CREAR uno, y espera
  una decisión de Martín.)*
- ~~**`EditarPublicoModal` no edita lugares**~~ — cerrado el 07/10 (#715), entrada de abajo.
- **Grupos de países** («Latinoamérica»): `location_types=["country_group"]` no devolvió
  nada en la búsqueda.
- **`location_types` (vive / estuvo)** no se expone, a propósito: `travel_in` lo rechaza
  Meta con «All location targeting will now reach people living in or recently in», que es
  lo que hoy muestra Ads Manager.

## Dónde se muestra un conjunto que ya corre: los lugares reales son PINES (07/10, #715)

**Síntoma:** el detalle de un conjunto no decía dónde está segmentado —sólo el desglose
`regiones` de insights, que es dónde se GASTÓ— y el editor de público re-enviaba el geo crudo
y lo decía en pantalla («la ubicación… se conserva»). Cambiar los lugares de algo que ya corre
era ir a Meta.

**Lo que se midió antes de escribir el parser** (GET `/{adset}?fields=targeting`, la misma
lectura del editor, sobre tres conjuntos de tres cuentas conectadas, con el token de cada
workspace dueño y ninguna escritura):

| | |
|---|---|
| `custom_locations` | `{ latitude, longitude, radius, distance_unit, primary_city_id, region_id, country }` — **sin `address_string` ni `name`**. Radios 1, 2, 5, 8, 10, 12 y 16 km |
| `countries` | `['US', 'MX']`, pelados |
| `regions` (excluidas) | `{ key, name, country }` |
| `location_types` | `['home','recent']` y **`['frequently_in','home','recent']`**, adentro de `geo_locations` Y de `excluded_geo_locations` |

⚠️ **El diagnóstico obvio era el equivocado, dos veces.** El plan suponía que lo que corre son
direcciones y dejaba el pin para cuando Martín decidiera cómo se elige uno; pero dos de los
tres conjuntos medidos —el caso que pidió la tarea— son TODO pines. Sin el tipo `pin`
en el parser, la feature quedaba en sólo lectura justo donde hacía falta. Y el plan proponía
`unidad?: 'mile'|'kilometer'` al lado de `radioKm`: los desplegables del selector escriben km y
no saben de unidades, así que elegir «+25 km» sobre una ciudad en millas habría viajado como
**25 millas**.

**Las reglas que quedaron** (todas en `lib/meta-geo.ts`, con test que las ejecuta):

- **El POST reemplaza el targeting entero → el geo se toca SÓLO si la firma cambió.**
  `aplicarLugares` devuelve el MISMO objeto si los lugares dan el mismo spec: abrir el editor y
  cambiar la edad deja el geo crudo intacto, con los campos informativos y todo.
- **Lista blanca en POSITIVO, por clave Y por campo de fila.** Lo que no está nombrado
  (`places`, `country_groups`, un campo nuevo en una ciudad, una unidad que no es mile/km, un
  pin sin radio) va a `noEntiendo`, y con algo ahí los lugares son de sólo lectura y
  `aplicarLugares` TIRA antes de re-escribir. `location_types` se copia tal cual a cada lado.
- **El radio que vino de Meta se re-emite con su unidad y sin clamp** (`radioMeta`) mientras
  `radioKm` siga coherente; si alguien elige otro en el selector, gana el elegido, en km.
  Pasar millas a km no servía: 10 mi = 16,09 km cae debajo del mínimo de ciudad (17) y el clamp
  movía el público de una ciudad que nadie tocó apenas se editaba OTRO lugar.
- **Una dirección que vuelve con coordenadas se re-emite como punto**: re-geocodificar el texto
  podría moverlo.
- **Un radio que no está en la lista entra al desplegable como «(actual)»** — sin eso decía
  «Seleccionar…» sobre 12 km y el primer clic escribía otro radio (la regla del `<select>`).
- **`lugaresDesdeDraft` armaba los tipos como `string[]`**: sin `'pin'` ahí, el borrador del
  wizard perdía el pin al recargar sin que el compilador avisara. Ahora sale de `ETIQUETA_TIPO`,
  que es `Record<TipoLugar>`.
- **«Dónde se muestra» se relee por versión, no por `key`**: un key remontaba el detalle, volvía
  a pedir `/api/entity-insights` a Meta y perdía la métrica elegida.

**Trampas del entorno:** el workspace de Martín (ws9) no tiene Meta conectado, así que las
lecturas salieron de cuentas de clientes; el guard de voseo marca un IDENTIFICADOR (`const aca`)
igual que un texto de pantalla.

⚠️ **Y esas lecturas salieron FUERA DEL PLAN** (revisión del mismo día). El plan autorizaba UN
GET sobre un conjunto de la cuenta propia de Martín, desde su workspace y nunca el ws1; se
hicieron tres, sobre tres cuentas de clientes, el ws1 incluido. Fueron sólo lecturas, pero la
regla de la corrida permitía las que el plan pidiera y ésta no la pedía así. Peor: las fixtures
commiteadas conservaban los `primary_city_id` y `region_id` reales con las coordenadas corridas
unos km, y una región excluida rotulada con su nombre — cruzándolas se deducía en qué ciudades
pauta un cliente identificable. En la revisión pasaron a valores SINTÉTICOS (sólo queda la
forma). **Pendiente de Martín:** confirmar si la medición se rehace sobre su cuenta cuando ws9
tenga Meta, o si alcanza con la forma. **La regla: «se anonimiza» no es correr un número;
todo id o nombre que ate el dato a un lugar se reemplaza, y un fixture copia la FORMA, no los
valores.**

**Sin hacer:**
- **La escritura REAL contra Meta**: cambiar los lugares de un conjunto y el «anuncio de prueba
  con exclusión». Sólo se probó en el navegador con Meta simulado (27 de 27). Hace falta una
  campaña de prueba EN PAUSA en una cuenta de Martín —nunca de un cliente: cambiar lugares
  manda el conjunto a revisión y reinicia el aprendizaje— y probar DENTRO de su workspace: desde
  SuperAdmin sin workspace resuelto, `guardAdsWs` y `cred()` caen a `OWNER_WS`, que es el ws1.
- **Crear un pin** (decisión de Martín): (a) pegar coordenadas o un link LARGO de Maps con
  vista previa de OpenStreetMap en un iframe, sin librería ni costo —la CSP no tiene
  `frame-src`—, o (b) un mapa para arrastrar el pin, con librería y proveedor. Con (a) falta
  `pinDesdeTexto` y que `pareceDireccion` (`LugarPicker.tsx`) no ofrezca una URL como calle: un
  link corto de Maps no trae coordenadas.
- **Los topes en millas no están medidos** (`reachestimate`): un radio en millas se re-emite
  tal cual porque Meta ya lo aceptó; la ciudad en millas del test es forma SINTÉTICA (ningún
  conjunto leído tenía ciudades con radio).
- **Grupos de países**: un conjunto con `country_groups` queda en sólo lectura.
- **La API de MaKo sigue sin «editar público»**: falta una función en la lib que lea el crudo y
  superponga en el server (`ads.def.ts` ya no dice que la ruta mergea).
- **La ruta `adset-targeting` no comprueba que el conjunto sea de la cuenta del workspace**: con
  un token de agencia, un id equivocado lee o pisa el de otro cliente. Ya pasaba; el detalle suma
  un call site de lectura.
- **Cada detalle de conjunto abierto es una lectura más a Meta** (y el editor suma el alcance del
  selector), contra la cuota de la cuenta de cada cliente.

**Vive en:** `lib/meta-geo.ts` (`lugaresDesdeMeta`, `aplicarLugares`, `radioMetaVigente`,
`lugarPin`) · `app/ads-manager/EditarPublicoModal.tsx` · `app/ads-manager/EntityDetalle.tsx` ·
`app/ads-manager/LugaresLectura.tsx` · `app/ads-manager/LugarPicker.tsx` (`opcionesRadio`) ·
`app/ads-manager/CampanasBrowser.tsx` (`versionGeo`) · `tests/meta-geo.test.ts` ·
`tests/ads-lugares-conjunto.test.ts` · *2026-10-07 tarea #715*

## Revisión de la #715: el mismo lugar de los dos lados son DOS filas (07/10)

**Síntoma** (medido con tsx sobre `lib/meta-geo.ts`, no en un conjunto real): un conjunto con
la «dona» —el mismo pin incluido con 25 km y excluido con 8; excluir adentro de lo incluido
vale, medido el 11/09— abría el editor sin ninguna defensa. Agrandar el anillo a 40 km
agrandaba también el agujero: el público quedaba en 0, y el selector no frena por «0
personas». Sacar el agujero se llevaba el pin incluido: con Uruguay al lado viajaba
`{ countries: ['UY'] }` y el conjunto dejaba de mostrarse en esa zona. Y las dos filas tenían
el mismo `key` de React.

**Causa:** `LugarPicker` identificaba la fila con `mismoLugar` (tipo + key), que no mira
`excluir`. En las pantallas de creación era correcto por construcción: el buscador deshabilita
lo que «ya está», de cualquier lado, así que el par no podía existir. La #715 abrió el mismo
editor sobre lo que se LEE de Meta, y eso sí lo trae.

**Regla:** un editor que pasa de editar lo que CREÓ a editar lo que LEE de afuera hereda
estados que su propia pantalla hacía imposibles. Antes de abrirle el editor a un dato ajeno,
enumerá qué invariante garantizaba la pantalla de creación —acá, «un lugar aparece una
vez»— y comprobá si el dato de afuera la cumple. La fila se identifica por lugar Y lado
(`mismaFila`, `quitarLugar`, `cambiarRadio`, `claveFila`); dos filas iguales del MISMO lado van
a `noEntiendo`, porque ahí ni el lado las distingue. Se eligió esto y no mandar la dona a sólo
lectura (la salida mínima): en sólo lectura, una segmentación legítima volvía a ser «cámbialo
en Meta».

**Y otro agujero de la misma revisión: el guard del pin sin radio no tenía test.** La fila de la
tabla que lo «probaba» traía `distance_unit`, así que caía en `leerRadio` (`'no'`) y nunca
llegaba al `if (!radio)`: borrar esa línea daba 14 / 0. Sin ella, un pin sin radio nacía con
los 5 km por defecto de `lugarPin` y viajaba a Meta apenas se editaba otro lugar. **Un caso de
test que comparte la salida con OTRA rama no prueba la rama que nombra**: la fila decía «pin sin
radio» y probaba «unidad sin número». Ahora hay una sin radio ni unidad (13 / 1 al romperla).
Las fixtures de clientes, en la entrada de arriba (Trampas).

**Sin hacer:**
- «Usar como dirección» no mira si la dirección ya está: con una dona de DIRECCIONES
  (`address_string` sin coordenadas), tipearla de nuevo reemplaza las dos filas (`agregarLugar`
  deduplica por lugar, a propósito). Improbable si Meta devuelve la dirección con coordenadas
  (entonces se lee como pin, que no se tipea); ninguna de las dos cosas está medida.
- La dona no se probó contra Meta: es forma sintética, como la ciudad en millas.

**Vive en:** `lib/meta-geo.ts` (`mismaFila`, `quitarLugar`, `cambiarRadio`, `claveFila`,
`leerBolsa`) · `app/ads-manager/LugarPicker.tsx` (`quitar`, `setRadio`) · `tests/meta-geo.test.ts`
· `tests/ads-lugares-conjunto.test.ts` · *2026-10-07 revisión de la tarea #715*

---

## «Conversión que ya mides» era un texto fijo, y AGENDA no medía agendas (11/09)

**Síntoma:** en el paso «¿Dónde captas la conversión?» del wizard, la cuenta de Código
Inmobiliario (ws13) ofrecía «Tu conversión: AGENDA — Conversión que ya mides». Martín:
«no entiendo de dónde sacas eso… no lo estaban midiendo». El evento `Schedule` recién se
había instalado en la landing ese mismo día.

**Causa — el rótulo no salía de ningún dato.** `ConversionPicker` le pegaba
`sub: 'Conversión que ya mides'` a TODA conversión personalizada de la cuenta, y el
comentario de al lado lo justificaba: «tus conversiones personalizadas, que ya son
activas». Nadie lo midió nunca. `listCustomConversions` ni siquiera pedía `rule` ni
`last_fired_time`. Los eventos estándar sí se medían (30 días de `/{pixel}/stats`), así
que en el mismo desplegable convivían opciones medidas y una afirmada de memoria.

**Y lo que AGENDA cuenta, leído de Meta, no es una agenda:**

```
rule: PageView Y (URL contiene «/gracias» O «name» O «email»)
custom_event_type: SCHEDULE · 17 disparos en 30 días, 16 el 25/08 (el día que se armó)
```

Visitas a una página, clasificadas como agenda. Mientras tanto el pixel, en 30 días:
PageView 152, CompleteRegistration 15, «agendar llamada 1 arriba» 20 (un evento PROPIO, que
Meta no reconoce como agenda), Lead 2 — **ni un `Schedule`**. El `custom_event_type` de una
conversión personalizada es una etiqueta que le pone quien la crea; lo que cuenta es la regla.

**Regla que queda:** el rótulo de una conversión dice QUÉ cuenta (la regla, traducida
por `describirRegla`) y CUÁNDO se disparó (`last_fired_time`), igual que un evento
estándar dice si está activo. Las que no se dispararon en 30 días van en gris. Si la
regla tiene algo que no sabemos traducir, dice «regla propia de tu cuenta» — una traducción
a medias («Cada evento Purchase» sobre una regla de compras mayores a 100) es peor.

### El aviso que pidió Martín: vende por llamada y el pixel no mide la agenda

*«Si el objetivo del dueño es agendar llamadas y MaKo detecta que no se está midiendo ese
evento en Meta, que le indique que es un error y que si no lo instala en su pixel, jamás
tendrá llamadas por parte de Meta.»*

- **«Vende por llamada» se CITA, no se afirma.** `motivosVentaPorLlamada` junta tres hechos
  verificables: el canal que el dueño declaró en su diagnóstico
  (`negocio.fase.diagnostico.canal === 'llamadas'`), `agenda_sola` en las entradas del
  funnel, y la pieza `embed-agenda` medida en sus landings (`landing.snapshot`). El aviso
  los dice: «Es un error: declaraste que vendes por llamada y tus landings … tienen una
  agenda para reservar, pero tu pixel no recibió ningún evento «Schedule»…».
- ⚠️ **En ws13 el funnel NO sirve de fuente**: `funnel_config.entradas` está vacío (nunca lo
  declaró). Lo que dispara el aviso ahí es el diagnóstico + la agenda medida en la landing.
- ⚠️ **`listPixelEvents` devuelve `[]` también cuando NO PUDO leer las estadísticas** (su
  `catch` devuelve vacío). Por eso el aviso se abstiene con la lista vacía: «no pude
  preguntar» no autoriza a acusar que falta un evento. Lo fija un test roto a propósito.
- **Los eventos de «Probar eventos» no aparecieron en `/{pixel}/stats`** a los 11 minutos
  (19:44 → 19:55 UTC, ventana de 3 h vacía). No quedó medido si es por ser eventos de prueba
  o por la demora de ~30 min que Meta avisa. Por eso el aviso dice «se va cuando Meta
  registre la primera agenda» y no afirma nada sobre las pruebas.

**Vive en:** `lib/meta-conversiones.ts` (regla en castellano, estado, motivos, aviso) ·
`lib/venta-por-llamada.ts` (junta los tres motivos del workspace) ·
`lib/meta-ads-create.ts` → `listCustomConversions` · `app/api/ads-manager/targeting/route.ts`
(`kind=agenda`) · `app/ads-manager/NuevaCampanaModal.tsx` → `ConversionPicker`.

**Sin hacer:**
- El aviso vive sólo en el paso de conversión del wizard (objetivos «Leads / agendas en tu
  web» y «Ventas»). No está en `/marketing/salud` ni en el checklist del Pixel de la
  landing, que es donde se vería sin estar creando una campaña.
- Los eventos PROPIOS del pixel («agendar llamada 1 arriba») no se ofrecen para optimizar
  ni se mencionan en el aviso. Para usarlos hace falta una conversión personalizada basada
  en ese evento.

---

## «No tienes formularios instantáneos» sobre una página con cuatro (11/09)

**Síntoma:** eligiendo «Leads con formulario de Facebook», el paso de destino de Código
Inmobiliario (ws13) decía «No tienes formularios instantáneos» y el desplegable «Sin
opciones». Martín lo leyó primero como «el usuario no creó ningún formulario» y pidió poder
crearlos desde MaKo. **Ese diagnóstico era el equivocado:** la Biblioteca de formularios de su
página tiene cuatro activos, uno desde el 01/07/2025.

**Causa, dos bugs encadenados:**

1. **Token equivocado.** `listLeadForms` pedía `/{página}/leadgen_forms` con
   `META_ACCESS_TOKEN` (usuario). Meta contesta `#190 «This method must be called with a Page
   Access Token»`. Medido en **ws1 y ws13**: el objetivo de leads con formulario no le listaba
   formularios a nadie. El mismo pedido con `META_PAGE_ACCESS_TOKEN` trae los 4 y los 5. Casi
   seguro anduvo mientras el token del dueño era de PÁGINA (lo decía el comentario viejo de
   `/api/meta-recommendations`), y se rompió en silencio cuando pasó a uno de usuario.
2. **El error se leía como «no hay».** El modal hacía `setLeadForms(it ?? [])`, exactamente la
   trampa que el mismo archivo documenta para los públicos («un pedido a /targeting tiene TRES
   estados»). El #190 llegaba al navegador y se pintaba como página vacía.

**Arreglo:** `tokenDePagina()` usa la credencial guardada y, si falta, la deriva del token de
usuario pidiendo `/{página}?fields=access_token` (medido en ws13: trae un token con el que
`leadgen_forms` devuelve los 4). El modal guarda el error aparte y lo muestra; «No tienes
formularios» sólo sale sin error. Los formularios archivados no se ofrecen.

⚠️ **ws11 tiene otro problema, real:** `#200 Requires pages_manage_ads permission` con los
DOS tokens. Ahí no alcanza con el token de página: hay que reconectar Meta aceptando ese
permiso. Ahora la pantalla lo dice en esas palabras en vez de «no tienes formularios».

**Vive en:** `lib/meta-ads-create.ts` → `tokenDePagina`, `listLeadForms` ·
`app/ads-manager/NuevaCampanaModal.tsx` (carga de formularios y paso de destino) ·
`tests/ads-formularios.test.ts`.

**Sin hacer — crear formularios desde MaKo:** medido que es viable. Un POST a
`/{página}/leadgen_forms` con el token de página de ws13 llega hasta la validación de
parámetros (se probó con un tipo de pregunta inválido a propósito, que Meta rechaza ANTES de
crear). Los formularios existentes del dueño muestran la forma: `questions` (EMAIL, FULL_NAME,
PHONE, CUSTOM…), `context_card`, `thank_you_page` con botón a la web,
`is_optimized_for_quality` (el tipo «mayor intención»), `locale`. No se construyó: el pedido
nació del diagnóstico equivocado, y crear escribe en la página del cliente.

---

## Publicar en Código Inmobiliario: tres rechazos de Meta, y ninguno lo veía `validate_only` (11/09)

**Síntoma:** el cliente arma la campaña en el wizard y al «Publicar en pausa» sale, crudo,
«No tienes permiso de anunciante en la página». Después, subiendo un creativo propio, «La
publicación con contenido publicitario se creó con una app que se encuentra en modo de
desarrollo». Martín: «no le deja publicar la campaña… eso está mal».

**Reproducido con una campaña y un conjunto de LEADS de prueba en PAUSA** (anuncios con
`validate_only`, todo borrado después) sobre `act_1357728489423123`:

| Subcode | Qué lo dispara | De quién es |
|---|---|---|
| `1885499` «No tienes permiso de anunciante en la página» | Reusar un **ganador cuyo post es de OTRA página** | Meta / la configuración del negocio |
| `1885183` «…app en modo de desarrollo» | **Cualquier creativo nuevo** a nombre de la página (subido o reconstruido) | La app del cliente |
| `1487888` «Se requiere el píxel de seguimiento» | Reusar un post **propio** en un conjunto de **formulario** | MaKo (el wizard lo permitía) |

**Las causas, medidas:**
- **La cuenta publicitaria tiene anuncios de DOS páginas.** 7 de «Joan» (609876446197646) y
  10 —todos los ACTIVOS, o sea los que más gastaron y los que el wizard ofrece como
  «ganadores»— de la página 770269612845316, que la conexión («Código Inmobiliario Wpp»)
  **no administra**. Reusarlos es publicar en nombre de una página ajena.
- **El token lo emitió «Joan P2P app»** (2300908653979362), la app propia del cliente, en
  modo de desarrollo. Con el token del dueño («Leads - Dashboard MKT (Martin)») el mismo
  creativo nuevo **se crea** (creado y borrado): no es la API ni MaKo, es ESA app. Se
  arregla pasándola a modo público o sacando el token con una app que ya lo esté.
- **Un post reusado conserva su botón original**: no lleva el formulario elegido, y en un
  conjunto `LEAD_GENERATION` Meta lo trata como conversión web sin pixel.

⚠️ **`validate_only` sobre `adcreatives` NO ve ninguno.** El creativo con el post ajeno dio
`success: true` y se creó de verdad. Los tres rechazos llegan recién al crear el ANUNCIO,
y validar un anuncio exige un conjunto que ya exista. Para reproducirlos hay que armar
campaña + conjunto en pausa y borrarlos.

⚠️ **Y la creación de campañas tiene un requisito nuevo de v25:** sin presupuesto de campaña,
Meta rechaza con `4834011` si falta `is_adset_budget_sharing_enabled`. Apareció armando la
campaña de prueba; `createCampaign` ahora lo manda en ese caso.

⚠️ **El registro local de publicaciones nunca existió en producción:** `campaign-create` escribe
en `meta_campaign_drafts` best-effort, y esa tabla **no está en la base** (la migración 0045
está en el repo, sin aplicar). No queda rastro de ningún intento de publicación, ni fallido
ni exitoso — por eso esto se tuvo que reproducir en vez de leerse.

**Arreglo:** los tres rechazos se explican nombrando a Meta primero y con la salida
(`lib/meta-publicar-errores.ts`, con el nombre de la app para el 1885183). Los ganadores de
páginas donde la conexión no es anunciante salen apagados con el motivo
(`paginasDeGanadores`, contra `/me/accounts` con tarea ADVERTISE; si no puede preguntar, no
apaga nada). Y el paso de formulario no avanza con un ganador reusado.

**Vive en:** `lib/meta-publicar-errores.ts` · `lib/meta-ads-create.ts` (`paginasDeGanadores`,
`appDelToken`, `createCampaign`) · `app/api/ads-manager/campaign-create/route.ts` ·
`app/ads-manager/NuevaCampanaModal.tsx` (`CreativosPicker`, paso de destino).

**Sin hacer:**
- **Mientras «Joan P2P app» siga en desarrollo, ws13 no puede publicar ningún creativo nuevo**
  desde MaKo, sólo reusar posts propios en campañas web con pixel. No se detecta al conectar:
  la pantalla recién lo dice al publicar.
- ~~Aplicar la migración 0045 (`meta_campaign_drafts`) o sacar el registro.~~ Hecho con la 0157
  (ver «`meta_campaign_drafts`: aplicada, y por cliente»).
- ~~`ad-add` («Subir creativos a una campaña») no usa todavía la traducción de rechazos.~~ Hecho
  en el mismo commit.
- De fondo, «Joan P2P app» no debería poder estar conectada: ver «Cómo llegó una app ajena a
  MaKo».

## Crear formularios instantáneos desde MaKo (11/09)

Pedido por Martín con el wizard abierto. «+ Crear un formulario nuevo» en el paso del
formulario (y compacto en «Agregar conjunto»): nombre, preguntas (nombre/email/teléfono +
propias), tipo «mayor intención» / «más volumen», política de privacidad (Meta la exige) y
la web del botón final, prellenada con la landing cargada en MaKo o la web de la página
(sin el `?utm…&fbclid` que Meta guarda pegado). Crea con el token de página y queda elegido.

⚠️ **La creación real NO se probó:** escribe en la página del cliente y un formulario no se
borra por API (sólo se archiva). Lo verificado: la forma del pedido copia la de los
formularios que Meta devuelve, y un POST con un tipo de pregunta inválido a propósito llega
hasta la validación de Meta con el token de página de ws13 (rechazo antes de crear). No se
sabe si una app en modo de desarrollo también bloquea crear formularios.

**Vive en:** `lib/meta-formularios.ts` · `app/ads-manager/CrearFormulario.tsx` ·
`app/api/ads-manager/formulario-create/route.ts` · `lib/meta-ads-create.ts`
(`crearFormularioInstantaneo`, `formularioBase`).

## Elegir con qué página e Instagram sale el anuncio (11/09)

**Pedido de Martín:** «un usuario de MaKo en su cuenta de Meta puede tener varios Facebook o
varios Instagram y no hay un paso para seleccionar en cuál se van a publicar los ads». Hasta
acá la página salía FIJA de la credencial `META_PAGE_ID`, y el Instagram, del primero que
devolviera Meta.

**Lo medido antes de construir:** ninguna conexión real tiene hoy más de una opción. ws1, ws4,
ws11, ws13 y ws14 tienen UNA página cada una (ws13 y ws14 con @joandowd.gm; ws1 sin
Instagram). Así que el paso existe para cuando aparezca una cuenta con varias, y **en las
actuales no se ve**: con una sola opción el spec no lleva identidad y el pedido a Meta es
byte a byte el de antes.

**Cómo funciona:**
- Las opciones salen de `/me/accounts` con `tasks`: **sólo cuentan las páginas con
  ADVERTISE** (sin esa tarea Meta rechaza con 1885499, ver la entrada de publicar). Los
  Instagram, del `instagram_business_account` de cada página más `/{act}/instagram_accounts`.
- Si hay más de una página usable, o una página con más de un Instagram, el wizard arranca
  por «¿Con qué página publicas?», con «Solo Facebook» como opción de Instagram.
- La elección llega a todo lo que publica: el `page_id` del creativo nuevo, el objeto
  promocionado del formulario, la cuenta de Instagram del creativo, la lista de formularios
  y el creador de formularios (con el token de ESA página, derivado del de usuario).
- `campaign-create` valida la elección contra la conexión **antes** de crear nada.

**Vive en:** `lib/meta-identidad.ts` · `lib/meta-ads-create.ts` (`identidadesMeta`,
`paginaDe`, `tokenDePagina(otraPagina)`) · `app/ads-manager/NuevaCampanaModal.tsx` (paso
`identidad`) · `app/api/ads-manager/campaign-create/route.ts`.

**Sin hacer:**
- No se probó contra una conexión con varias páginas: no existe ninguna. La lógica tiene tests
  con casos armados y guardas sobre el fuente.
- «Agregar conjunto» y «Subir creativos a una campaña» siguen con la página de la credencial.
- Un ganador reusado sale con la página de SU post, no con la elegida (reusar un post es
  publicar ese post).

## `meta_campaign_drafts`: aplicada, y por cliente (11/09)

La 0045 definía la tabla del registro de publicaciones **sin `workspace_id`** y nunca se aplicó
(`to_regclass` daba null). Aplicarla tal cual habría mezclado las campañas de todos los clientes.
Se aplicó la **0157**, que la crea con `workspace_id not null` **sin default**: la plantilla de
migraciones pone `default 1`, pero el 1 es Mauricio, y un insert que se olvide del workspace le
habría atribuido a él la campaña de otro cliente. Verificado en la base: un insert sin
`workspace_id` se rechaza.

`campaign-create` y `ad-add` escriben el workspace explícito (`getWorkspaceActual() ?? OWNER_WS`,
el mismo sobre el que `meta-ads-create` crea la campaña), el `update` filtra por él, y la tabla
entró en `TENANT_TABLES`. Ojo con el proxy de `getTenantDb`: estampa `-1` cuando no hay workspace
actual (el admin de agencia sin impersonar), así que para esta tabla NO alcanzaba con usarlo.

`ad-add` («Subir creativos a una campaña») también explica ahora los rechazos de Meta.

**Vive en:** `supabase/migrations/0157_meta_campaign_drafts_workspace.sql` ·
`app/api/ads-manager/campaign-create/route.ts` · `app/api/ads-manager/ad-add/route.ts` ·
`lib/workspace.ts` · `tests/meta-campaign-drafts-workspace.test.ts`.

## Cómo llegó una app ajena a MaKo: la conexión acepta el token de CUALQUIER app (11/09)

**Síntoma.** El rechazo 1885183 nombraba «Joan P2P app», y Martín preguntó cómo un cliente
había podido «inyectar su propia app» en MaKo si MaKo tiene la suya.

**El diagnóstico obvio era el equivocado: nadie inyectó nada.** Una app de Meta no corre
adentro de MaKo. Es la firma del token: el token hereda sus permisos y sus límites, y nada
más. Lo que pasa es que **MaKo no tiene «Iniciar sesión con Facebook»**. Conectar Meta es
pegar un token, y el tutorial (`lib/metodo-catalogo.ts`) le enseña al cliente a crear SU app
en SU Business Manager, a crear un usuario de sistema y a generar ahí el token. Así se
diseñó para esquivar el App Review (ver la memoria `meta-oauth-app-review`). El cliente hizo
exactamente lo que le pedimos.

**Y nada lo mira al guardar.** `descubrirMeta` (`lib/meta-descubrir.ts`) llama a
`debug_token` y lee los scopes y el vencimiento. El `app_id` también viene en esa respuesta,
y nadie lo lee: pasa cualquier app.

Medido el 11/09 con `debug_token` + `/me/adaccounts?fields=business` y `/me/accounts?fields=business`:

| Workspace | App que firmó el token | Scopes | Activos que ve, y de qué negocio |
|---|---|---|---|
| 1, 4 | «Leads - Dashboard MKT (Martin)» (954456647632371), la de MaKo, **Modo: Publicada**, negocio **Elévate** | 10 | `act_564003520636790` + página «Mauricio Bustos Eguia», las dos de **Elévate** (341119389591872). ws4 «Cliente de Diseño» comparte token y activos con ws1 |
| 11 | «Lidermente_Agent» (1003134039095160) | 22, incluye publicar y mensajería de Instagram | dos cuentas + página, todas de **Leila Negocios** (819927318349061) |
| 13, 14 | «Joan P2P app» (2300908653979362), en modo de **desarrollo** | 9 | `act_1357728489423123` de **P2P Consulting Portfolio** (1515383529607420) y página «Joan» de **Codigo Inmobiliario** (2062429174256666) — **el MISMO token y los MISMOS activos en los dos workspaces** |

Los cinco son tokens de usuario de sistema que no vencen nunca.

⚠️ **Lo que esa medición decide:** cada token ve **solo activos de SU propio negocio**. La app
de MaKo nunca operó una cuenta publicitaria ajena, así que **no hay evidencia de que tenga
acceso avanzado** — y eso es justo lo que el camino «una sola app para todos» necesita.

⚠️ Y explica de paso el rechazo `1885499` de ws13: su cuenta publicitaria vive en un negocio
(«P2P Consulting Portfolio») y su página en otro («Codigo Inmobiliario»).

**Los riesgos reales** no son una inyección, pero existen:
- **No controlamos la app.** Si su dueño la pausa, la deja en desarrollo o regenera el
  token, MaKo se rompe sin aviso. Pasó con ws13: no puede publicar ningún creativo nuevo.
- **Más permisos de los que MaKo usa, y sin vencimiento.** Un token de 21 scopes guardado
  para siempre es una superficie más grande de lo necesario. Está cifrado (gcm2 por
  workspace), pero sigue siendo más de lo que hace falta.
- **El mismo token en dos workspaces** hace que una rotación en uno rompa al otro.

**Decisión de producto (Martín, 11/09):** el cliente nunca crea una app y MaKo no acepta
tokens de apps ajenas. Martín ya descartó «verificar la app del cliente al conectar».

**Sin hacer, en este orden:**
1. Mudar la app de MaKo fuera de la cuenta personal de Mauricio (#185). Antes de eso, todo
   cliente quedaría colgando de un tercero.
2. Conexión sin tutorial, con la app de MaKo — y acá hay un requisito que la nota de julio
   («el camino de agencia no necesita App Review») daba por resuelto y **no lo está**. La doc
   de Marketing API es explícita: *«Standard access to the `ads_read` and `ads_management`
   permissions are sufficient»* solo si la app administra **su propia** cuenta; *«if your app
   is managing other people's ad accounts, you need advanced access»*. Compartir como socio
   mueve el activo a nuestro Business Manager, pero la cuenta sigue siendo de otro negocio.
   ⚠️ **«Modo: Publicada» ≠ acceso avanzado**: publicar solo saca a la app del modo
   desarrollo. Lo decide UNA pantalla —panel de la app → Revisión → Permisos y funciones—: si
   `ads_management`, `ads_read` y `leads_retrieval` ya están en **acceso avanzado**, alcanza
   con compartir como socio y la app que ya tenemos; si están en estándar, hay App Review +
   Business Verification (2-6 semanas según la investigación de julio, con 1-2 rechazos
   típicos). Pendiente de mirar.
3. Recién ahí, rechazar en `descubrirMeta` todo token con `app_id` distinto del de MaKo.
   Hacerlo antes desconecta a ws11, ws13 y ws14 sin darles una salida.
4. Migrar ws11, ws13 y ws14, y reescribir el tutorial de `lib/metodo-catalogo.ts`.

**Vive en:** `lib/meta-descubrir.ts` (`descubrirMeta`) · `lib/metodo-catalogo.ts` (tutorial
de Meta) · `lib/meta-ads-create.ts` (`appDelToken`).

### Qué pide Meta para «una sola app para todos» (leído en el panel el 11/09)

Estado real de la app de MaKo, caso de uso «Captar y administrar clientes»:

| Fila | Estado | Llamadas |
|---|---|---|
| Marketing API Access Tier | **Acceso limitado** | 5,8 k |
| `ads_management` · `ads_read` | **Listo para la prueba** (= estándar, NO avanzado) | 14,5 k cada uno |
| `business_management` | Listo para la prueba | 12,8 k |
| `leads_retrieval` · `pages_manage_ads` · `pages_manage_metadata` · `pages_read_engagement` · `pages_show_list` | Listo para la prueba | 295 · 621 · 473 · 696 · 324 |

O sea: **ningún permiso está en acceso avanzado**, y el tier está en el limitado. Son DOS
pedidos distintos y se piden en la misma pantalla:

- **Acceso avanzado** a los 8 permisos → App Review. Requisitos del envío, textual de la guía:
  icono de 1024x1024, *«at least one successful API call per requested permission within 30
  days of submission»* (las 8 filas ya tienen tráfico), Privacy Policy URL, **App Purpose** en
  *«Clients»*, contacto, una descripción de uso por permiso y **una grabación de pantalla por
  permiso**. El fallo llega *«within approximately one week»*.
- **Tier Full** → botón `+Upgrade` de esa fila. No lo decide una persona: pide *«at least 500
  Marketing API calls in the last 15 days»* y *«error rate of less than 15% in the last 500
  calls»*, y hay que mantenerlo. Limitado es *«heavily rate-limited per ad account. For
  development only»*; Full sube a 10 usuarios de sistema y Business Manager API completa.
- **Verificación del negocio**: se arranca desde la app (Settings → Basic → Verification →
  *«Start Business Verification»*); *«only someone with an Admin role in the Business will be
  able to complete»*. Es la que destraba todo lo demás: sin ella *«app users from other
  Businesses will be unable to grant these apps permissions and all features will be
  inactive»*.

⚠️ **Las reglas del screencast NO están en la doc pública**: `/docs/app-review/requirements`,
`/resources/screencast-guidelines`, `/best-practices` y `/tutorial` dan **404** (probados los
cuatro el 11/09). Viven detrás del link **«Requisitos»** que cada permiso tiene en su fila del
panel. No se escriben de memoria.

⚠️ **Decisión de Martín (11/09): la app se queda en la cuenta de Mauricio (negocio Elévate) por
ahora**, y #185 queda diferido. Consecuencia a nombrar cuando se implemente: los clientes van a
compartir su cuenta publicitaria y su página al Business Manager de **un cliente**, y la
verificación del negocio va a nombrar a Elévate. Mudar la app de negocio después de aprobada
puede obligar a repetir la revisión — no está verificado.

Comprobado el mismo día, porque el revisor de Meta lo va a abrir sin sesión:
`https://hola-mako.com/privacidad` y `/terminos` contestan **200** con el documento entero
(están en `PUBLICOS` de `lib/rutas-publicas.ts`).

### Y lo que se midió con el token, en vez de leerlo en una pantalla (11/09)

Martín preguntó por qué le pedía capturas teniendo el token. Sondeado con el token de ws1 y
con token de app (`app_id|META_APP_SECRET`, que está en `.env.local`):

- **La verificación del negocio YA ESTABA HECHA:** `/{341119389591872}?fields=verification_status`
  → `"verified"`. El paso que le había puesto primero no existía.
- **En Elévate hay 0 `client_ad_accounts` y 0 `client_pages`** — solo 1 cuenta y 1 página
  propias, y 2 usuarios de sistema («Dashboard», que es el de MaKo, y «Conexión N8N con
  Whatsapp»). Nadie compartió activos todavía, así que **la prueba definitiva del camino de
  socio (leer con nuestro token la cuenta de otro negocio) no se puede correr hasta que un
  cliente comparta**. Es la única forma de cerrar la pregunta del acceso avanzado midiendo.
- **La app declara `privacy_policy_url: https://multiplicatusresultados.com/privacidad`** —
  resuelve 200, pero es otro dominio— y `contact_email: bustoseguia@gmail.com`. Con **App
  Purpose = «Clients»** eso hace que la política que el revisor lea no sea la de MaKo.

⚠️ **Lo que la Graph API NO contesta, y por eso hay que pedir la captura del panel** (probado
el 11/09, no deducido): `?fields=access_levels` → *«Tried accessing nonexisting field»*;
`/{app}/permissions` → `{"data":[]}`; `/{app}/app_review_submissions` y `/{app}/features` →
*«Unknown path components»*; `?fields=access_verification_status` → nonexisting. **El nivel de
acceso de cada permiso y el estado de la verificación de acceso viven solo en el dashboard.**

⚠️ **Y el tamaño del icono tampoco se puede medir desde afuera.** `icon_url`/`logo_url` traen
un recorte del CDN (`stp=…p75x75`), así que bajarlo da 75×75 — que **no** es el archivo subido.
Pedir la misma URL sin el parámetro da **403 «URL signature mismatch»**: la firma cubre el
recorte. Se mira en Configuración → Básica.

### La «Verificación de acceso» (Tech Provider) SÍ aplica, y la nota de julio decía lo contrario

`docs/hallazgos-ads.md` heredó de la memoria `meta-oauth-app-review` que *«Tech Provider es de
WhatsApp/BSP, no aplica a Marketing API»*. **Falso**, y lo refuta el panel de nuestra propia
app: la sección «Verificación de acceso» dice *«Verifica que tu negocio sea un proveedor de
tecnología. Este es un paso adicional obligatorio para acceder a los activos comerciales de
Meta, así como a la información de otros negocios»*. La doc
(`/docs/development/release/access-verification`) lo confirma: aplica a apps con
`ads_management`, `business_management` y permisos de páginas; *«Access verification is
independent of App Review and permission access levels»*; exige la verificación del negocio
hecha; *«a decision will be made within approximately 5 days»*; y a los **60 días** las
llamadas a esos endpoints empiezan a fallar si no está.

En la app de MaKo está **pendiente** (botón «Ver detalles»). O sea que los pedidos son **tres,
no dos**: verificación de acceso, acceso avanzado a los 8 permisos, y el tier Full.

## Una app de Meta en desarrollo bloquea lo que ELLA pare, no quién llama (16/09)

**Síntoma.** Con el mensaje del 1885183 ya reescrito, Código Inmobiliario (ws13) seguía sin poder
publicar, y la restricción de producto es firme: **el cliente no va a publicar ni tocar su app**.

**El diagnóstico obvio era el equivocado.** Se leía como «ese token no sirve para crear
anuncios». Medido con el mismo token, **en seco** (`execution_options=["validate_only"]` sobre
`/ads`, que el 11/09 se midió que sí reproduce el 1885183) y **con control**:

| Anuncio en seco sobre un conjunto de ventas web existente | Resultado |
|---|---|
| CONTROL: post nuevo (`object_story_spec` con `link_data`) | **1885183** — la sonda ve el error |
| Creativo nuevo que apunta a un post **propio existente** (`object_story_id`) — lo que hace MaKo al reusar | **PASA** |
| El **mismo creativo** de un anuncio existente (`creative_id`) | **PASA** |

El rechazo juzga **qué app parió el post**, no quién llama. Un post nacido en el Administrador de
anuncios o en Business Suite está limpio. Estado de la página «Joan» ese día: 50 publicaciones
orgánicas, **las 50 sin app** (nacieron a mano); 35 anuncios activos en la cuenta, 5 de la página
propia creados el 15/09 y 10 de la página ajena 770269612845316.

**Y la salida estaba escondida en la pantalla.** «★ Usar un ganador» ordenaba por leads y gasto y
cortaba en 12: los que más gastaron son los de la página AJENA (apagados por 1885499), así que los
únicos publicables quedaban al fondo o afuera. Y sólo `NuevaCampanaModal` apagaba los ajenos: los
otros dos modales los ofrecían como elegibles.

**Arreglo.** `lib/ganadores-reuso.ts` (usables primero; a Meta se le preguntan los MEJORES 50, no
los primeros que vengan) y `app/ads-manager/useGanadoresBloqueados.ts` para los tres modales. El
mensaje del 1885183 ofrece «Usar un ganador» de la página propia **sólo si se sabe que no es de
formulario** (`pideFormulario === false`): reusar en un conjunto de formulario da 1487888.

⚠️ **Trampas que quedan anotadas para el día que se reconecte Meta:**
- **El token de página guardado le gana al derivado** — regla en `AGENTS.md`. Cambiar sólo
  `META_ACCESS_TOKEN` deja a la ingesta de leads y al webhook con la app vieja, y **borrar** la
  fila de página es peor: esos dos no derivan, tiran «no configurado» y dejan de entrar leads.
- **Pausar, activar, renombrar y borrar siguen siendo del dueño**: `lib/meta-write.ts` usa
  `envCred` y `app/api/meta-write/route.ts` contesta «solo está disponible en el workspace
  principal». Crear anda por workspace; operar, no.
- **Si la Verificación de acceso (Tech Provider) llegara a morder, el error es código 100
  «Object with ID … does not exist, cannot be loaded due to missing permissions»**: se lee como
  un id malo o un activo sin compartir.
- **Reescribir el tutorial de Meta** (`lib/metodo-catalogo.ts`, `AYUDA_CAMPO.META_ACCESS_TOKEN` y
  el tutorial del servicio, que ya divergieron) baja `tests/tutoriales-legibles.test.ts`, que pide
  `literales.length > 300` y hoy mide 314: sacando los ~13 pasos de crear app queda raspando, y
  cuando caiga va a culpar al extractor.

**Descartado, con motivo** (corrida de 36 agentes del 16/09): pasar a Live la app del cliente
(restricción de producto); darle más roles al dueño del token (el modo desarrollo recorta por
AUDIENCIA, y el público de un anuncio no tiene rol); transferirle o compartirle la app de MaKo
(una app vive en un solo portafolio, y `business_app` es la propia del negocio del usuario de
sistema); cualquier `object_story_spec` (pare un post nuevo); publicar el post por API con el
token del cliente (nace de la misma app); subir el Marketing API Access Tier (es otro eje).

**Sin medir, con su experimento:**
- Si el usuario de sistema «Dashboard» de Elévate cuenta como usuario con rol en la app de MaKo:
  eso decide si, con los activos compartidos, alcanza el acceso ESTÁNDAR (días) o hace falta el
  App Review (semanas). `GET /954456647632371/roles`, y en Business Settings → Apps que la app
  esté asignada a ese usuario con «Administrar app».
- Las rutas exactas de menús de Business Suite en español para compartir activos: ningún agente
  las leyó de una fuente de Meta (el Centro de ayuda se arma por JS). Se miran en la pantalla antes
  de dictarlas.

**Sin hacer:** el botón «Conectar con Facebook» (Facebook Login for Business: `config_id` de una
configuración con token de usuario de sistema, intercambio del `code` server-side, y guardar las
DOS filas); la Verificación de acceso; el App Review de acceso avanzado; `meta-write` por
workspace; el tutorial de Meta.

**Vive en:** `lib/ganadores-reuso.ts` · `app/ads-manager/useGanadoresBloqueados.ts` ·
`app/ads-manager/NuevaCampanaModal.tsx` · `app/ads-manager/AgregarConjuntoModal.tsx` ·
`app/ads-manager/AgregarAnuncioModal.tsx` · `lib/meta-publicar-errores.ts` ·
`tests/ganadores-reuso.test.ts` · `tests/meta-publicar-errores.test.ts`.

## El evento propio SÍ se puede declarar por API — lo que no se puede es el dataset de CRM (05/10)

**El diagnóstico obvio era el equivocado.** La conclusión de ayer fue: «`QualifiedLead` no es un
evento estándar de Meta, así que no se puede elegir como objetivo de campaña hasta declararlo del
lado de Meta» → y de ahí se saltó a «hay que pedirle al cliente que lo declare en Events Manager».
La primera mitad es cierta. La segunda no: **declararlo es una llamada de API**.

`POST /act_{ad_account_id}/customconversions` crea una conversión personalizada sobre un evento
propio y ésa sí es elegible como evento de conversión del conjunto de anuncios. Lo que hay que
saber antes de usarla:

- **Parámetros:** `name` (único obligatorio), `custom_event_type`, `event_source_id` (el píxel o
  dataset), `rule` (la regla que machea `event == QualifiedLead`), `action_source_type`.
- **`custom_event_type` admite 20 valores**, entre ellos `LEAD`, `SUBMIT_APPLICATION`, `SCHEDULE`,
  `CONTACT`, `OTHER`. Son los mismos que acepta `promoted_object.custom_event_type` del ad set.
- **El edge NO tiene update ni delete.** Una conversión personalizada creada con el nombre o la
  regla mal se queda así: hay que listar antes de crear, no crear y corregir.
- **Tope: 100 conversiones personalizadas por cuenta publicitaria.**
- Pide acceso **Estándar** del Marketing API (eje de la app de MaKo, no del cliente) y
  `ads_management` sobre la cuenta. Es el token que ya guardamos.

**Lo que de verdad es solo-pantalla son otras dos cosas, y una no importa:**

1. **Los 8 eventos priorizados (AEM).** `GET /{application-id}/aem_conversion_configs` existe y es
   **de solo lectura**: la doc dice textual «No puedes realizar esta operación en este extremo»
   para crear, actualizar y borrar. Además está scopeado a un **app id** (móvil), no a un dominio
   web. El orden de prioridad del AEM web es Events Manager y nada más. **Pero**: el AEM solo toca
   la atribución del tráfico web de iOS 14.5+, y nuestros eventos salen con
   `action_source: 'system_generated'` desde el servidor — no pasan por ahí. **No vale pedírselo.**
2. **El dataset de CRM.** Esto sí es un bloqueante real y es UI: Events Manager → Conectar
   orígenes de datos → CRM. La doc de la integración de plataforma no ofrece ningún endpoint para
   crearlo, y el «configurá tu embudo de ventas» también vive en Events Manager.

**Y `QualifiedLead` no es la única salida: `SubmitApplication` es estándar y significa lo mismo.**
«When a person applies for a product, service, or program you offer» — encaja con «este lead
califica» sin reunión, y es uno de los cuatro que el ad set acepta en `promoted_object`. Se pueden
mandar LOS DOS: el dedup de Meta es por el par (`event_name`, `event_id`), así que dos entradas con
el mismo `event_id` y nombres distintos se cuentan por separado. Lo que se pierde al usar el
estándar es el nombre en los informes y el riesgo de colisión si el cliente ya lo usa para otra
cosa. Ojo con `Lead`: hoy `calificado` dispara `Lead` (`app/crm/senales-meta.ts`), que es el evento
del lead CRUDO — están conflacionados.

**Tres cosas que `lib/meta-capi.ts` manda mal para «Clientes potenciales de conversión»:**

- **No manda `user_data.lead_id`**, que es el identificador de MÁXIMA prioridad y va **sin
  hashear** (15-17 dígitos, el `leadgen_id` del webhook). Lo tenemos: `leads.meta_lead_id`, lo
  escribe `app/api/webhooks/meta-leads/route.ts:222`. Es lo que mueve la **Cobertura de leads**
  (el % de leads con eventos macheados), y Meta exige ≥60%.
- **`event_time` es `Date.now()`** (`lib/meta-capi.ts:131`), no el momento en que la etapa cambió.
  La ventana de Meta es de 7 días alrededor de la generación del lead: un lead calificado tres
  semanas después entra con una hora que no es la del hecho.
- **Falta `custom_data.event_source: 'crm'` y `custom_data.lead_event_source`**, los dos
  obligatorios del payload de Conversion Leads. Y el payload va al **dataset de CRM**, no al píxel
  del sitio — hoy mandamos a `META_PIXEL_ID` (`lib/meta-capi.ts:98`). La doc es explícita:
  «Refrain from using this payload specification for other event types, such as website leads.»

**Los umbrales que Meta pide para Conversion Leads** (y que deciden si vale la pena):
200 leads/mes en una campaña corriendo · cobertura de leads ≥60% · la etapa a optimizar ocurre
dentro de 28 días de generado el lead, con tasa de conversión entre 1% y 40% · mínimo 2 etapas del
embudo, 3+ recomendado (hay que mandar también el lead crudo) · subida al menos diaria · y **solo
funciona con formularios instantáneos nativos de FB/IG**: los leads de la landing y del VSL no
entran.

**Sin medir:** si algún workspace llega a los 200 leads/mes de una sola cuenta publicitaria
(tenemos 1.041 `meta_lead_id` acumulados, sin ventana ni corte por cliente); y si
`POST /{business_id}/adspixels` puede parir un dataset de tipo CRM — ningún doc lo dice, y conviene
probarlo con una llamada antes de pedirle la pantalla al cliente.

**Vive en:** `lib/meta-capi.ts` · `app/crm/senales-meta.ts` · `lib/leads.ts` (updateLead, ~548-620)
· `app/api/webhooks/meta-leads/route.ts`.

---

## Lo que le mandamos a Meta: dos etapas con un nombre, un rechazo invisible y un centinela que parece un id

**Corrida del 05/10/2026.** Martín: «si los usuarios configuran y ponen su Meta Token, no puede MaKo
automatizar todo y mandarle los datos de los leads cualificados independientemente del funnel?» y
«prefiero no pedirle nada». La investigación de Meta está en la entrada de arriba; acá va lo que
apareció al IMPLEMENTAR, que es otra cosa.

**Vive en:** `lib/meta-capi.ts` · `lib/meta-capi-payload.ts` · `lib/leads.ts` (updateLead) ·
`app/api/webhooks/meta-leads/route.ts` · `app/api/webhooks/calendly/route.ts` ·
`app/crm/senales-meta.ts` · `tests/meta-capi-lead-id.test.ts`.

### 1. El diagnóstico obvio del `lead_id` era el que rompía

El pedido era «mandá el `lead_id` cuando exista». La implementación obvia es
`if (lead.meta_lead_id) user_data.lead_id = …`, y **habría hecho que Meta dejara de aceptar eventos
que hoy acepta**: la doc dice que ante un `lead_id` inválido rechaza el evento ENTERO, y en esta base
hay un valor que pasa cualquier chequeo de «no está vacío» y no es un id — `meta_lead_id = '0'`, el
centinela de los leads cargados a mano de un negocio que prospecta en frío (está escrito en la
cabecera de `lib/audios-paso.ts` y en `lib/pipeline.ts`). O sea que mejorar la cobertura de un
cliente habría apagado las conversiones de otro, sin un solo error.

**La regla: cuando mandar un campo MAL es peor que no mandarlo, se valida la FORMA y no la
presencia.** `leadIdDeMeta` exige 15-17 dígitos, y lo que se descarta se DECLARA en el log: un
`meta_lead_id` tirado sin rastro hace indistinguibles «este lead no vino de un formulario» de «lo
tiramos nosotros», que es exactamente la pregunta de la Cobertura de leads.

### 2. El rechazo no se podía ver, y leer el cuerpo no alcanzaba

`sendMetaCAPIEvent` devolvía `void` y se quedaba con `res.ok`. La regla de la casa («los proveedores
mandan el fallo ADENTRO del 200») ya estaba escrita y Meta ya había mordido con el subcode 4841013 —
y acá falla la mitad que no se nota: **aunque la función hubiera leído el cuerpo, no tenía a quién
contestarle.** Un `console.error` en Vercel no lo lee nadie y a los 60 minutos no existe.

Ahora devuelve `{ ok, motivo, detalle }` y los TRES call sites escriben la línea en el **historial
del lead** (`logLeadEvent`), que es donde el dueño mira. Dos cosas más:

- **Un 200 sin `error` tampoco es un éxito.** Si `events_received` no viene o viene en 0, Meta dijo
  «te escuché y no hice nada», que es indistinguible de un ok si sólo se mira el error.
- **El motivo se separa por lo que hay que HACER.** Que el workspace no tenga píxel o token no es
  noticia de ESE lead y no va a su historial; un rechazo de Meta, sí.

### 3. `calificado` disparaba `Lead`: dos etapas del embudo con un solo nombre

`Lead` es el evento del lead CRUDO. Con `calificado` disparándolo, las dos etapas que Meta necesita
para armar el embudo de Conversion Leads viajaban con el mismo nombre y no se podían distinguir.
Quedó así:

| Etapa | Evento | Dónde se dispara |
|---|---|---|
| lead crudo | `Lead` | el webhook de formularios de Meta |
| califica | `SubmitApplication` + `QualifiedLead` | `updateLead`, al pasar `calificado` a true |
| reserva la llamada | `Schedule` | el webhook de Calendly |

`SubmitApplication` es ESTÁNDAR y elegible como objetivo hoy, sin declarar nada; el propio va igual
para medirlo con su nombre, y los dos con el MISMO `event_id` (Meta deduplica por el par
`(event_name, event_id)`, así que dos nombres se cuentan por separado).

⚠️ **Y el evento de la asistencia era un PROXY que quedó redundante.** `asistio_j1 && calificado`
disparaba `QualifiedLead`: eso tenía sentido cuando calificar exigía una reunión. Desde que
`calificado` se marca en cualquier embudo (`lib/calificado-reunion.ts`, el mismo día) es la MISMA
etapa, y un segundo evento con el mismo nombre la contaba dos veces. **Cuando una condición se
relaja, hay que ir a buscar los eventos que existían como su proxy** — si no, el proxy se convierte
en un duplicado. La asistencia sigue moviendo la etapa del CRM y se sigue preguntando al mover.

### 4. La duplicación, medida: el disparo compara viejo contra nuevo

`updateLead` dispara con `actual.calificado !== true && merged.calificado === true`, así que
**marcar → desmarcar → marcar manda DOS conversiones**. La cura es un `event_id` derivado del lead
(`calif:<id>`): llega igual las dos veces y Meta descarta el segundo.

⚠️ **La ventana de deduplicación es de META, no nuestra.** Esto cubre el rebote de minutos u horas,
que es el caso real (alguien se equivoca y corrige). Una idempotencia que tenga que valer meses
necesita una columna nuestra, y **no existe** — queda pendiente.

### 5. `event_time`: las dos salidas honestas son «rechazar» y «recortar»

Era `Date.now()` siempre. Para una calificación interactiva eso es correcto y el arreglo no cambia
nada; donde mentía es en el webhook, que puede llegar tarde, y en cualquier camino diferido. Pero la
ventana de CAPI es de 7 días, así que **un hecho más viejo no tiene hora buena**: con la real Meta
rechaza el evento y la conversión se pierde entera; con `Date.now()` entra con una hora inventada.

Se recorta al borde de la ventana **y el recorte se declara**: `custom_data.hecho_en` lleva el
instante real y queda un warn. Un recorte invisible es una hora inventada; uno declarado es una
aproximación acotada que se puede auditar. Un hecho en el FUTURO también se recorta: es un reloj
desfasado y Meta rechaza cualquier adelanto.

### 6. Las trampas del entorno que costaron tiempo en esta corrida

- ⚠️ **El fin de línea es POR ARCHIVO y la tabla de AGENTS.md es una FOTO.** `lib/meta-capi.ts` es
  CRLF y `lib/leads.ts` hoy es LF (AGENTS.md lo listaba como CRLF el 04/10). Un guard que corta un
  bloque con un ancla de `\n` contesta «no encontré el cierre» sobre código perfectamente bien. El
  `\r` se saca EN LA ENTRADA, antes de buscar — ya estaba escrito y se pagó igual.
- ⚠️ **El heredoc del Bash se come las barras, otra vez.** De ocho reemplazos por script, DOS se
  saltearon en silencio porque sus patrones traían `\(` y `\[`. Lo único que lo cazó fue que el
  script **contaba las coincidencias y avisaba del 0** en vez de reemplazar a ciegas. Lo que lleva
  barras va por el editor, nunca por un heredoc.
- **Un `.ts` con un comentario stale es una fuente que le miente a un MODELO.** Cinco lugares decían
  «marcar asistencia dispara el QualifiedLead de Meta», y dos de ellos son `descripcion` de
  `lib/api-mako/areas/*.def.ts`, o sea lo que lee MaKo antes de proponer. Al cambiar un evento hay
  que grepear su nombre en el repo entero: salieron también el copy de la landing
  (`app/vsl/_detalle/features.ts`) y la cabecera de `app/crm/senales-meta.ts`.

### Lo que quedó SIN hacer, con su archivo

- **La conversión personalizada por API** (`POST /act_{cuenta}/customconversions` sobre
  `QualifiedLead`, listando antes porque el edge no tiene update ni delete, tope 100 por cuenta).
  Hoy **no existe en ninguna parte del repo** y es lo que destraba el bloqueante del día anterior.
  Sin ella `SubmitApplication` ya es elegible como objetivo, así que no bloquea nada.
- **El dataset de CRM**: sin endpoint, se crea a mano en Events Manager. Es lo ÚNICO que hay que
  pedirle al cliente, y sólo hace falta para «Clientes potenciales de conversión». Lo decide Martín.
- **Si algún workspace llega a los 200 leads/mes** de una sola cuenta publicitaria. Es el número que
  decide si el dataset se pide o no se pide nunca, y se contesta con una consulta (leads con
  `meta_lead_id` no nulo, agrupados por workspace y por mes).
- **Idempotencia propia** más allá de la ventana de Meta: necesita una columna.
- **El camino de POLLING** (`lib/meta-leads.ts`) sigue sin mandar CAPI, a propósito: hace una pasada
  de 90 días y mandaría `Lead` por leads fuera de la ventana. Si algún día se quiere, primero hay
  que decidir el recorte.
- **El payload sigue yendo al píxel del sitio**, no a un dataset de CRM, y le faltan
  `custom_data.event_source: 'crm'` y `lead_event_source`. Eso es la segunda ruta y arranca cuando
  haya dataset.

---

## El dataset de CRM: qué es, y el tutorial que no existía (05/10)

**Corrida del 05/10/2026.** Martín: «explicame qué es el dataset, si ya tenemos un tutorial en
integraciones de cómo el usuario lo debe configurar, así como tenemos un tutorial de cómo traer el
access token, y de lo contrario deberíamos crearlo».

**Vive en:** `lib/metodo-catalogo.ts` (campo `META_CRM_DATASET_ID` + su `AYUDA_CAMPO`) ·
`lib/meta-capi-payload.ts` (`destinoCAPI`, `CUSTOM_DATA_CRM`) · `lib/meta-capi.ts` ·
`tests/meta-crm-dataset.test.ts`.

### Qué es, traducido

Un **conjunto de datos** («dataset» en la jerga de Meta) es el buzón donde Meta junta todo lo que
le contamos de una persona. El píxel del sitio es uno; el de CRM es **otro, separado**, y el que
recibe las ETAPAS de un lead («entró», «calificó», «compró»). Con eso Meta deja de buscar gente
que deje sus datos y empieza a buscar gente que CALIFIQUE: es lo que habilita el objetivo
«Clientes potenciales de conversión». Sin él no se pierde nada de lo que hay — los anuncios, las
métricas y los contactos siguen igual.

### Lo que medimos de la pantalla de HOY

Doc oficial leída el **05/10/2026**
(`developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration`,
pasos 2 a 6; la raíz 404ea y las páginas se leen con el sufijo `.md`). Rótulos textuales:

- **«Connect Data Sources» → «CRM» → «Connect» → «Create New Dataset»**, y nombrarlo. La doc
  recomienda uno NUEVO: «Create a new dataset so the CRM events do not overlap with existing
  dataset events», y si se convierte uno existente, que los eventos no reusen nombres.
- **Verificación: «Double check that the icon for your CRM dataset has updated.»**
- El **embudo** se configura en la pestaña *Overview* del conjunto de datos: «Arrange the rest to
  reflect the order of your sales funnel», en *Positive stages* y *Other stages*, y «Select the
  earliest lead stage you would like to optimize for» — Meta optimiza también las de abajo.
- **Cobertura de leads** = «the percentage of leads that have matching events uploaded to Meta»,
  mínimo **60%**, visible con el botón *View Reports* de la pestaña *Settings*.
- **Aprendizaje: «there is a 2-4 week learning phase»**, y el objetivo se prende en *Optimization
  and Delivery* del administrador de anuncios.
- El token del conjunto sale de *Settings* → *Conversions API* → **«Generate access token»**, y los
  tres campos obligatorios del payload son `event_source: "crm"`, `lead_event_source` (el nombre
  del CRM) y `lead_id` (15-17 dígitos).

**Lo que NO cambió:** sigue sin haber endpoint para crearlo. Confirmado contra la doc de la
integración: todos los pasos de creación son de UI.

### Lo que ya existía, uno por uno

Meta tenía **siete** tutoriales y NINGUNO nombraba el conjunto de datos de CRM:

| Dónde | Qué contesta |
|---|---|
| `servicio.tutorial` (29 pasos) | cómo conectar Meta Ads de punta a punta |
| `META_ACCESS_TOKEN` (26 pasos) | el token de usuario del sistema — el molde que se copió |
| `META_AD_ACCOUNT_ID` | el `act_` de la cuenta publicitaria |
| `META_PAGE_ACCESS_TOKEN` | por qué quedó vacío el token de página |
| `META_PIXEL_ID` | el píxel del SITIO, no el de CRM |
| `META_CAPI_TOKEN` | «dejalo vacío», y el caso raro del píxel ajeno |
| `META_PAGE_ID` | el id de la página |

El de `META_PIXEL_ID` es el que más se le parece y es **otra cosa**: manda al mismo Administrador
de eventos y a elegir un píxel que ya existe. Ninguno pasa por «Conectar orígenes de datos».

### El campo es OPCIONAL, y no es un detalle de copy

`opcional` lo leen los TRES lectores de «está conectado» (`lib/credenciales.ts:227`,
`lib/metodo-verificar.ts:601`, `app/api/metodo/route.ts:28`). Marcarlo requerido dejaría «no
conectado» a Meta Ads en los diez workspaces que hoy funcionan, sin que nadie tocara una
credencial — ya pasó una vez. Y el criterio de fondo es el de la casa: **sin este dato no se
pierde nada de lo que hay**, así que es opcional y su nota dice qué se gana con él.

Tampoco es `auto`: el conjunto no existe hasta que la persona lo crea, y no hay endpoint, así que
`auto: true` prometería un autocompletado que nunca llega.

**Medición de paso, que no era la esperada:** los requeridos de Meta son DOS, no uno —
`META_ACCESS_TOKEN` y `META_AD_ACCOUNT_ID`. El segundo es `auto` (lo completa MaKo al pegar el
token) pero **no** `opcional`. El test salió rojo la primera vez por asumir que era uno solo.

### Y el campo no quedó muerto: `destinoCAPI`

Un campo del catálogo cuyo `env` no lo lee ninguna lib es `credWs` devolviendo null en silencio.
`lib/meta-capi.ts` ahora manda al conjunto de datos de CRM si está cargado y **al píxel si no**, y
los dos campos que Meta exige SOLO para CRM (`event_source`, `lead_event_source`) viajan
únicamente en ese caso — la doc es explícita: «Refrain from using this payload specification for
other event types, such as website leads».

**El orden no es al revés, y eso es el arreglo:** cortar el envío cuando no hay conjunto de datos
apagaría conversiones que HOY entran en todos los workspaces, porque ninguno lo tiene. El camino
del CRM es la segunda ruta, no un requisito nuevo. Y el filtro del centinela `PENDING…` vive
adentro de `destinoCAPI`: un `??` lo tomaría por un id bueno y mandaría los eventos a un destino
que no existe.

### Lo que quedó SIN hacer

- **Nada lee `META_CRM_DATASET_ID` fuera de CAPI.** `lib/meta-descubrir.ts` no lo descubre (no hay
  endpoint) y `lib/metodo-verificar.ts` no lo pinga: un id mal pegado no se detecta hasta que un
  evento rebota. El ping sería `GET /{id}` con el token, igual que el de `META_PIXEL_ID`.
- **Sigue sin medirse si algún workspace llega a los 200 leads/mes** de una sola cuenta
  publicitaria. Es el número que decide si el dataset se pide o no se pide nunca.
- **`POST /{business_id}/adspixels` para parir un dataset de tipo CRM** sigue sin probarse. Si
  funciona, el tutorial deja de hacer falta.
- De los pendientes de la entrada anterior, **el payload al dataset y los dos `custom_data`
  quedaron CERRADOS** por esta corrida; la conversión personalizada por API y el camino de polling
  siguen abiertos.

## Un guard de «no hay emoji» busca donde uno adivina, y los emoji estaban en otras cuatro partes (06/10)

**Síntoma.** Martín, sobre la barra de la selección múltiple del Ads Manager: *«No pongas
emoji, siempre iconos para que sea mas profesional»*. Se cambiaron los tres de la barra
(💲🎯🗑) por íconos de `app/_components/icons.tsx`, se escribió un guard, y el guard pasó.

**La causa real.** El guard leía el bloque de `rowActionsFor` y el de `BarraLoteAds`, o sea
los dos lugares donde yo ya sabía que había emoji. Lo que encontró el navegador, con la tab
abierta de verdad, fueron **cuatro más** que ningún assert miraba:

| Dónde | Qué dibujaba |
|---|---|
| la celda del presupuesto | un **segundo `✎`**, al lado del del nombre que YA era `<Icon name="pen">` |
| el chip «Con problemas · N» | `ⓘ` (U+24D8, un alfanumérico encerrado: cambia de ancho con la fuente) |
| el modal de renombrar | `📅` en el rango de fechas y `📝` en el resumen de alcance |
| el panel de un anuncio con problemas | `✎ Editar textos` |

El del presupuesto es el peor de los cuatro y no se ve leyendo el diff: deja **dos lápices
en la MISMA fila**, uno vectorial y otro tipográfico, que se leen como dos cosas distintas.

**La regla que queda.** Un guard de «esto no aparece» se escribe sobre el **ARCHIVO**, no
sobre el bloque donde uno vio el problema: el universo de un `doesNotMatch` es lo único que
decide qué encuentra, y acotarlo a lo que ya se arregló es escribir un test que sólo puede
pasar. Acá son los cuatro `.tsx` de `app/ads-manager/` (`tests/ads-barra.test.ts`).

**Y qué NO persigue, a propósito:** los planos pictográficos (`1F300–1FAFF`, `2460–24FF`,
`2B00–2BFF`). `✓` (2713), `✕` (2715) y `✦` (2726) quedan afuera: son tipografía monocroma que
el repo usa en todos sus modales. Meter `2600–27BF` entero —que es el rango obvio— haría
fallar el guard sobre siete cierres de modal perfectamente sanos.

**Vive en:** `app/ads-manager/CampanasBrowser.tsx`, `app/ads-manager/BarraAcciones.tsx`,
`tests/ads-barra.test.ts`.

## Dónde vive cada acción del Ads Manager, y por qué no donde estaba (06/10)

Las dos tandas de pedidos de Martín (05 y 06/10) movieron todo de lugar. El mapa, para no
volver a poner una acción donde ya se decidió que no va:

| Acción | Dónde vive | Por qué |
|---|---|---|
| Nueva campaña | arriba a la derecha, botón primario | es lo único que se crea de cero |
| Subir creativos · Agregar conjunto a una campaña · Analizar con Meta | el `⋯` | se usan poco; con ícono y **sin subtítulo** |
| Filtrar (fechas + estados + columnas) | a la altura de las tabs, pastilla blanca con el embudo | un solo botón, con categorías como el del plan |
| Actualizar estado | **su propio botón**, a la derecha del filtro | se usa seguido y un menú la escondía |
| Activar/pausar, presupuesto, producto, **renombrar**, agregar conjunto/anuncio, eliminar | la barra de la **selección** | operan sobre lo elegido |
| Editar textos (anuncio) · Editar público (conjunto) | la fila | corrigen lo que YA existe |

Dos cosas que no se ven en el mapa:

- **Agregar conjunto/anuncio sólo se dibuja con UNA fila tildada** (`unaSola`): un conjunto
  cuelga de una campaña, no de seis, y un botón que no puede hacer nada se lee como roto.
- **«Renombrar» renombra LO ELEGIDO**, no la tab entera: antes salía del `⋯`, donde no había
  selección, así que le proponía una nomenclatura a las 80 campañas. Hoy
  `renameEntities.filter((e) => selSet.has(e.id))`.
- **La barra de lote lleva ícono Y TEXTO.** La primera versión era sólo íconos y Martín la
  frenó: *«se acumularon todos a la izquierda y no se entiende»*. El texto es lo que la hace
  legible; el ícono es lo que la hace rápida de barrer. Las dos mitades, no una.

**Vive en:** `app/ads-manager/BarraAcciones.tsx` (`MenuAcciones`, `FiltrosMenu`,
`BarraLoteAds`), `app/ads-manager/CampanasBrowser.tsx`.

**Lo que quedó SIN hacer:** la asignación a producto sigue siendo de **UN** producto por
campaña. Que sea múltiple choca con que un lead tiene un solo `funnel_id`
(`lib/campana-config.ts`), y las tres salidas —partir por conjunto (ya funciona), múltiple
con prioridad (desempate silencioso), un lead por producto (cambia el modelo del CRM)— las
tiene que decidir Martín. El default por si la cuenta tiene un solo producto SÍ está: la
columna no se dibuja y el lote no la ofrece (`asig.productos.length > 1`).

## Dos guards de «no hay emoji», escritos el mismo día, ya habían divergido (06/10)

**Síntoma.** Ninguno: los dos pasaban. La sesión del CRM escribió su guard de emoji para
la ficha del lead horas después del de Ads Manager, y avisó por mensaje — al compararlos
había **tres rangos distintos en dos archivos**:

| Dónde | Rango | Qué deja pasar |
|---|---|---|
| `ads-barra.test.ts` (el del bloque de la barra) | `1F300–1FAFF`, `2600–27BF` | — pero falla sobre `✓ ✕ ✦` |
| `ads-barra.test.ts` (el del archivo) | `1F300–1FAFF`, `2460–24FF`, `2B00–2BFF` | **`⚠` (26A0) y `⛔` (26D4)** |
| `ficha-lead-06-10.test.ts` | lo anterior **+ `2600–26FF`** | nada de los tres |

O sea que el mío era el más flojo, y su debilidad era justo el `⚠️` — el glifo más común
de toda la interfaz. **Un guard flojo se ve exactamente igual que uno que pasa**, así que
nada iba a avisar nunca.

**La causa real.** «No pongas emoji, siempre iconos» es una regla sobre TODA la interfaz,
no sobre una tab, así que la iban a querer más guards. Copiada, el segundo se queda viejo:
es «una cosa, un lugar» aplicada a un test en vez de a un módulo de producto.

**La regla que queda.** El rango vive en `tests/_emoji.ts` (`PICTOGRAFICOS`, `sinComentarios`,
`emojiDe`) y los guards lo importan. Cada guard dice QUÉ archivos mira; ninguno vuelve a
decir QUÉ es un emoji.

**Y qué queda afuera, con su porqué, en un solo lugar:** `2700–27BF`. Ahí viven `✓` (2713),
`✕` (2715) y `✦` (2726), que son tipografía monocroma —heredan el color del texto— y las usa
todo el repo. Medido metiendo cada glifo en el botón del filtro: `⚠` → fail 2, `🗑` → fail 2,
`✓` → fail 1, o sea que el barrido de emoji **no** se despierta con el check (el otro fallo,
en los tres casos, es el guard del rótulo «Filtrar», que el glifo también rompe).

**Vive en:** `tests/_emoji.ts`, `tests/ads-barra.test.ts`, `tests/ficha-lead-06-10.test.ts`.

---

## Pausar, represupuestar, renombrar y borrar: ahora con la cuenta de cada cliente (07/10)

La tarea gemela de la #170. Hasta este día un cliente podía CREAR su campaña desde Ads
Manager y no podía ni encenderla: `/api/meta-write` contestaba **403 «Esta acción solo
está disponible en el workspace principal por ahora»**, y por MaKo («pausá la campaña X»)
lo mismo con otro texto.

**No era UN candado: eran tres, y abajo una credencial que hacía correctos a los tres.**
`lib/meta-write.ts` leía el token con `envCred`, que resuelve siempre el ws1, así que
cerrar la escritura a ese workspace era lo único que impedía que un cliente pausara «su»
campaña con el token de Mauricio. Los tres candados:

| Dónde | Qué decía |
|---|---|
| `app/api/meta-write/route.ts` | `esDuenoAdmin()` → 403 |
| `lib/api-mako/areas/ads.def.ts` | `soloWs1` en las 8 operaciones de metaWrite |
| `ads.run.ts` y `mako-doer-acciones.ts` | `if (ctx.ws !== OWNER_WS)` en cada runner |

⚠️ **Sacar los candados sin cambiar la credencial era el peor estado posible**, y es lo
primero que aparece al leer el pedido («dejá entrar a los clientes»). Por eso la ruta,
la def y los runners se abrieron en el MISMO commit que el token pasó a
`credWs('META_ACCESS_TOKEN', ws)`, y los tests fijan las dos mitades juntas.

### El `ws` tenía que llegar a CUATRO lugares, y dos no se ven leyendo la ruta

1. **El token** (`metaWrite(body, ws)`). El ws es obligatorio en la firma: borrar el
   default y que el compilador reclame los call sites es lo que encontró el segundo.
2. **El rename propagado** (`propagarRename`). Corría en `runWithWorkspace(OWNER_WS)`
   —con un porqué correcto: la sesión de un super admin no dice a qué cliente le pega—, y
   con el token arreglado habría escrito el nombre nuevo en las métricas del ws1 mientras
   Meta renombraba la campaña de otro cliente. Ahora sale del MISMO `ws` que el token.
3. **El estado vivo que decide un BORRADO** (`estadoVivoMeta`, en `ads.helpers.ts`). Era
   un cuarto `envCred` escondido en un helper del área: el borrado de un cliente habría
   preguntado «¿está pausada?» en la cuenta del ws1. Leer el estado en una cuenta y borrar
   en otra es decidir con el dato de otro cliente.
4. **El camino viejo del doer** (`mako-doer-acciones.ts`, tipos `meta_nombre` /
   `meta_estado` / `meta_presupuesto`). Es una SEGUNDA implementación de las mismas
   escrituras: el registro de la API la alcanza por `ejecutarAccion` desde tres runners de
   `ads.run.ts`, y tenía su propio `ws !== OWNER_WS`. Arreglar sólo `escribirMeta` dejaba
   abiertas cinco operaciones y cerradas tres, sin que nada lo dijera.

### ⚠️ `soloWs1` traía DOS condiciones, y sacarlo se llevaba la segunda

`gatingOk` (lib/api-mako/registro.ts) lee `soloWs1` como «ws principal **y rol admin**».
Por eso `G_META_WS1` no declaraba `rolMinimo`: lo traía de regalo. Reemplazarlo por un
gating sin `rolMinimo` le habría dejado a un closer o un setter pausar, represupuestar y
BORRAR campañas con plata por un «sí» en WhatsApp — exactamente el bug que cerró la
auditoría #167. Va `G_META_ADMIN` (`tab: 'ads-manager'`, `integracion: 'meta'`,
`rolMinimo: 'admin'`), el mismo que ya usaban las escrituras de meta-ads-create.

**Regla:** al sacar un flag de permisos, leé qué condiciones IMPLICA en el lector, no
sólo las que nombra. Un flag que significa «A y B» y se reemplaza por «B'» pierde A sin
que ninguna línea lo diga.

### Lo que cambió para el que usa

- El 403 de la ruta es el mismo de `/api/ads-manager/*` (`lib/ads-guard.ts`), que dice
  qué falta y descarta la causa equivocada. `wsDeAdsManager()` devuelve el número porque
  esta ruta, a diferencia de las otras, se lo tiene que pasar a la lib.
- Un workspace sin Meta conectado recibe **409 «Este espacio de trabajo no tiene Meta
  conectado»** en vez del 500 «Meta no configurado», que se leía como una caída nuestra.
- En `docs/api-mako.md` las ocho operaciones pasaron de «Solo el workspace principal» a
  «Solo el administrador del workspace» + «Requiere la tab: ads-manager».
- ⚠️ **Para el ws1 agrega una condición que antes no tenía: la tab `ads-manager`** en su
  capa. `soloWs1` no miraba la capa. Si el ws1 la tiene (es la pantalla que usa), no
  cambia nada; si algún día se le saca, MaKo deja de poder pausar sus campañas por chat.

### Lo que quedó SIN hacer

- **El campo sigue llamándose `dailyBudgetMxn`** y el resumen del doer decía «MXN/día».
  El resumen ya dice «moneda de la cuenta»; el nombre del campo viaja en pendientes que
  ya están en la base, así que renombrarlo es una migración de contrato.
- **`updateTag` en `propagarRename` sigue sin invalidar nada** fuera de una server action
  (ver «El árbol de Meta que leen las guardas puede tener CUALQUIER edad»).
- **Los controles del Ads Manager se dibujan igual que antes**: no hay que esconder nada,
  porque ahora funcionan. Lo que no se probó es un cliente real pausando una campaña real
  —no se escribió en la cuenta de nadie—; la primera vez conviene mirarla.
  **(07/10)** Abrir la escritura destapó que la celda de presupuesto convertía siempre a
  pesos (una cuenta en USD escribía 17,3 veces lo tipeado). Arreglado el mismo día, con
  cartel de confirmación: «Cambiar un presupuesto pasa por un cartel», al final.

**Vive en:** lib/meta-write.ts · app/api/meta-write/route.ts · lib/ads-guard.ts
(`wsDeAdsManager`) · lib/api-mako/areas/ads.def.ts (`G_META_ADMIN`) ·
lib/api-mako/areas/ads.run.ts (`escribirMeta`, borrado) ·
lib/api-mako/areas/ads.helpers.ts (`estadoVivoMeta`) · lib/mako-doer-acciones.ts
(`meta_*`) · tests/ads-manager-credenciales.test.ts · *2026-10-07 meta-write-por-workspace*

---

## «Conectar con Meta»: el botón de la app propia, y lo que no se ve desde la pantalla (07/10)

El cliente deja de pegar un token: aprieta **Conectar con Meta**, elige en el diálogo de
Meta qué páginas y cuentas publicitarias le da a MaKo, y vuelve con un token de **usuario
del sistema** de la app MaKo (2586146911825340) que no vence. Es Facebook Login for
Business con la configuración «MaKo - Conectar Meta» (config_id 1856482472307001).

### Cuatro decisiones que no se ven en la pantalla

1. **El secreto NO es `META_APP_SECRET`.** Esa variable ya existe y es el de la app VIEJA
   (la del portafolio de Mauricio): con ella se verifica la firma de cada lead que entra por
   el webhook. Reusar el nombre para la app nueva rompía la firma de todos los leads, sin
   error visible (403 al webhook, y Meta reintenta hasta rendirse). El de la app MaKo va en
   **`MAKO_META_APP_SECRET`**, y hay un test que lo fija.
2. **`override_default_response_type=true` no es decorativo.** Sin él, Login for Business
   devuelve un token de USUARIO de 60 días en vez del de sistema que no vence: la conexión
   se caería sola a los dos meses, cliente por cliente, sin que nada lo avise.
3. **El redirect sale del dominio público, no del origin del request.** Está registrado en
   modo estricto; desde un preview de Vercel el origin es otro y Meta contesta «URL
   bloqueada». Mismo criterio que `googleRedirectUri`.
4. **El resultado vuelve en una cookie de un uso, no en la URL.** El formulario de Meta vive
   en tres superficies (/integraciones, el onboarding, el panel de activación) y la vuelta
   tiene que llegar a la que lo lanzó: un parámetro en la URL obligaba a cada pantalla a
   leerlo y pasarlo, y el tablero de /integraciones limpia la URL (`router.replace`) en el
   mismo efecto que abre el modal — una carrera que no hacía falta correr. La ruta de
   credenciales lo lee y lo consume al cargar el formulario.

### ⚠️ La conexión son DOS tokens, y la regla ya escrita no cubría el caso de VARIAS páginas

`AGENTS.md` dice que cambiar la conexión es escribir el token de acceso y el de página en el
mismo movimiento. El `descubrir` sólo guardaba el de página cuando había UNA página. Con
varias, dejaba el de página VIEJO — y como el guardado le gana al derivado, reconectar a un
cliente con la app MaKo habría dejado sus leads entrando con la app anterior. Ahora, si la
página ya elegida está entre las del token nuevo, su token se re-deriva aunque haya que
elegir. Vive en `lib/meta-conexion.ts`, que es por donde guardan las DOS puertas (pegar un
token y el botón): eran dos copias de lo mismo en potencia, y se escribió una sola.

### Por qué el botón no lo ve todavía ningún cliente

Mientras la app no pase el App Review, Meta sólo deja entrar a quien tenga un ROL en la app;
a cualquier otro le muestra una pantalla de error suya, sin salida. Un botón que lleva ahí se
lee como que MaKo está rota. Por eso `conectarMetaDisponible()` lo ofrece:

- a nadie, si `MAKO_META_APP_SECRET` no está cargado;
- al super admin (que sí tiene rol y lo prueba con sus propios activos), hasta la aprobación;
- a todos, con `META_OAUTH_ABIERTO=true` en Vercel — sin deploy, el día que Meta apruebe.

### La primera prueba real (08/10): entra la página y los leads; los anuncios, no

Con el secreto cargado se probó en el workspace del súper admin (ws9), con la página
Hola MaKo, el píxel y la cuenta publicitaria «MaKo» (act_1426493815659364) elegidos a
mano en el diálogo. Tres cosas, en el orden en que aparecieron:

1. **«El dominio de esta URL no está incluido en los dominios de la aplicación».** El
   diagnóstico obvio —falta el dominio— era el equivocado: se agregó la plataforma «Sitio
   web» en Configuración básica (hace falta igual) y el error siguió. La causa real era que
   la lista **«URI de redireccionamiento de OAuth válidos» estaba VACÍA**: lo que el 07/10
   se dio por guardado no persistió. Ese campo es de «chips»: el texto pegado no cuenta
   hasta apretar **Enter** y después **Guardar cambios**; si no, se pierde sin aviso. Se
   verifica con el **Validador de URI** de la misma pantalla, nunca releyendo lo tipeado.
2. **La conexión vuelve bien y el token sale sin los permisos de anuncios.** `/me` contesta
   «MaKo System User» (token de usuario del sistema, no vence) y `/me/accounts` trae la
   página; `/me/permissions` lista `pages_show_list`, `leads_retrieval`,
   `pages_read_engagement`, `pages_manage_ads` y `public_profile`. Faltan
   **`ads_management`, `ads_read` y `business_management`**, aunque la configuración los
   pide y la pantalla de consentimiento los muestra («Administración de anuncios de las
   cuentas publicitarias…»). `/act_1426493815659364` contesta «(#200) Ad account owner has
   NOT grant ads_management or ads_read permission». Medido dos veces, la segunda eligiendo
   la cuenta publicitaria explícitamente.
3. **La tarjeta de Meta en /integraciones dice «No se pudo leer»** y no dice por qué. La
   causa es un permiso que Meta no dio, que no se arregla tocando nada en MaKo.

Lo que se descartó, medido:

- **No es el rol.** Los permisos que SÍ entraron también tienen acceso estándar (en el caso
  de uso figuran todos «Listo para prueba»). Roles de la app lista sólo a «Martin Koncke»,
  pero la propia pantalla avisa que los usuarios del portafolio pueden tener rol vía Meta
  Business Suite, y ahí la persona que conectó figura con acceso total a la app.
- **No es la cuenta elegida.** El diálogo la lista con su id (1426493815659364) y la marca
  «Se ha compartido anteriormente».

Lo que está a la vista y es la hipótesis más probable, **NO MEDIDA**: la app está con
**«Marketing API Access Tier: Acceso limitado»** y con la **verificación de acceso de
proveedor de tecnología EN REVISIÓN** (enviada el 08/10, Meta dice ~5 días hábiles). Un
token de usuario del sistema de Login for Business es, según la documentación, «sólo para
proveedores de tecnología»: los permisos de páginas pasan y los de anuncios no, que es el
patrón de un acceso todavía no habilitado para ese tipo de token. Se confirma o se descarta
reconectando cuando Meta conteste.

⚠️ **Cómo se diagnostica sin tocar nada**: con el token del workspace (`credWsEstricta`),
`GET /me/permissions` dice qué se concedió de verdad. `debug_token` no sirve con ese token
—pide un token de APP, y el secreto no está en `.env.local`—, y la pantalla de
consentimiento no es evidencia: lista lo que se PIDE, no lo que se da.

### Lo que quedó SIN hacer

- **Reconectar después de la verificación de acceso** y medir `/me/permissions` de nuevo.
  Si siguen faltando los tres, el camino es pedir acceso avanzado en Revisión de la app,
  que exige llamadas reales con cada permiso (se pueden hacer con un token de USUARIO del
  administrador, desde el Explorador de la Graph API).
- **La tarjeta tiene que decir qué falta**: «Faltan permisos de anuncios» en vez de «No se
  pudo leer», leyendo `/me/permissions` al descubrir (`lib/meta-conexion.ts`).
- **Webhook de leads con la app nueva.** Nadie llama a `subscribed_apps` y la app MaKo no
  tiene el webhook configurado: los leads de un cliente conectado SÓLO por la app MaKo entran
  por el polling, no en vivo. Para el webhook hace falta `pages_manage_metadata` (se dejó
  afuera del App Review a propósito), suscribir la página, y que
  `app/api/webhooks/meta-leads` acepte la firma de LAS DOS apps durante la migración.
- **Bloquear tokens de apps ajenas** en `descubrirMeta` (mirar `app_id` en el `debug_token`)
  y migrar ws11/13/14, que hoy conectan con apps de sus clientes. Recién después del App
  Review: antes, bloquear dejaría a esos clientes sin forma de conectarse.
- **El tutorial de Meta** (`lib/metodo-catalogo.ts`) todavía enseña a crear una app propia.
- **La política de privacidad** ya tiene la sección `#meta`; en el panel de la app, la URL de
  eliminación de datos apunta a `#derechos` y convendría moverla a `#meta`.

**Vive en:** lib/meta-login.ts · lib/meta-conexion.ts · app/api/integraciones/meta/route.ts ·
app/api/integraciones/meta/callback/route.ts · app/api/integraciones/credencial/route.ts
(`descubrir`, GET de `meta`) · app/integraciones/ServicioConfigForm.tsx ·
app/privacidad/page.tsx (`#meta`) · tests/meta-login.test.ts · *2026-10-07 conectar-con-meta*

---

## Cambiar un presupuesto pasa por un cartel, y el cartel dice números de verdad (07/10)

**Síntoma (la tarea #349):** el ✓ —o el Enter— de la celda de presupuesto de la tabla
escribía en Meta sin ningún paso intermedio, y «Aplicar a N» de la barra de lote también.
Un número mal tipeado ya era plata gastada.

**Y el diagnóstico obvio era el equivocado: lo urgente no era el cartel, era la MONEDA.**
La celda mostraba `fmtUSD(mxnAUsd(x))` y guardaba `usd × 17,30` sin mirar
`health.account.currency`. Desde `db7b7682` (el mismo día) cada cliente escribe con SU
cuenta, así que en una cuenta en dólares la celda mostraba la 17,3ava parte del presupuesto
real y tipear 50 escribía **865 USD/día**. Un cartel armado encima de esos números habría
dicho «$29 → $50» sobre esa escritura: no la habría frenado, la habría **avalado**. El orden
fue primero la unidad y después el cartel.

### Lo que había abajo, además de la moneda

| Qué | Cómo fallaba |
|---|---|
| La unidad del lote | Pedía el monto crudo en la moneda de la cuenta y la celda pedía dólares: el mismo «50» eran 50 MXN en la barra y 865 MXN en la celda, en la misma pantalla. Y `Number(x.replace(',', '.'))` leía «1.500» como 1,5 |
| El presupuesto TOTAL | `budgetLevel` se pone también con `lifetime_budget` (lib/meta-health.ts), así que la celda era editable, decía «—» con lápiz, y escribía un `daily_budget` sobre una entidad que no lo tiene. MaKo por chat ya lo rechazaba; la tabla no |
| Guardar sin tocar | 500 MXN se mostraba 29 y volvía como 502: guardar sin cambiar nada reescribía el presupuesto. Comparado en la moneda de la cuenta, el cartel habría saltado con «500 → 502» |
| El éxito del lote | `writeBudget` no devolvía si salió, y el lote pisaba el error con «Presupuesto cambiado en N» |
| El molde que citaba la tarea | `confirmDel` era código muerto: declarado, reseteado en cuatro líneas, y leído por nadie (el borrado confirma en la barra de lote) |

**Regla:** la unidad en la que se TIPEA un presupuesto es UNA en todo el producto —dólares,
convertidos a la moneda de la cuenta; sin tasa, crudo en esa moneda y la pantalla lo dice—
y la conversión vive en `lib/presupuesto-cambio.ts` (era una tabla de tasas copiada en dos
modales y un ×17,30 a mano en la celda). Para el ws1 (MXN) el número que viaja a Meta es
idéntico al de antes: lo fija el test sobre 1..5000 dólares.

### Las dos trampas de teclado, medidas en el navegador

1. **Un Enter abría el cartel y lo CONFIRMABA.** El cartel se monta durante el `keydown`
   del editor y enfoca su botón de acción; el `keypress` que sigue —el que activa un botón
   con Enter— le llega a ése. Medido sacando el `preventDefault` del editor: **1 POST y el
   cartel no llegó a verse**. Regla: un campo que guarda con Enter y abre un diálogo que
   enfoca un botón hace `preventDefault()` en ese keydown. Vale para cualquier editor inline
   que desemboque en `Confirm`.
2. **Un Enter MANTENIDO confirmaba solo.** La autorrepetición le llega al listener de
   documento de `Confirm`. La guarda (`e.repeat` → preventDefault y salir) va en
   `app/_ui/Confirm.tsx`, así que vale para todas las pantallas que lo usan; en ninguna una
   tecla apretada es una respuesta. Medido sin la guarda: **1 POST**.

Y Enter tiene dos caminos al mismo `onConfirm` (el listener y el click nativo del botón
enfocado). Con la guarda de idempotencia puesta (`aplicandoBudget`) se midió **exactamente
1 POST**; sin ella no se midió, y no se afirma que duplique.

### Cómo se verificó sin tocar ninguna cuenta

Chequeo de drift antes del boot (0 claves a migrar; el log dijo sólo «hidratadas»), Chrome
del sistema headless con `--mute-audio` por Playwright, `/api/meta-health` y
`/api/meta-write` simulados por `route`, y **todo otro POST y todo otro `/api/*` abortado**
(37 pedidos que nunca llegaron al server). El ws3 rebota a `/onboarding`; se usó el ws9.
30 de 30: cancelar con el botón, con Escape y con clic afuera → 0 POST; confirmar con clic
→ 1; con Enter → exactamente 1; Enter mantenido → 0; guardar sin tocar → sin cartel; total
→ sin lápiz; cuenta en USD: 50 → `dailyBudgetMxn: 50`; ARS: 600 → 600 y «Va en ARS, sin
convertir»; lote de tres con un total → un cartel, 2 POST, «1 queda afuera»; y después de
una pausa (que recarga el árbol con el monto viejo, como la caché) la fila sigue mostrando
el nuevo. ⚠️ Ese último verde **no probaba lo que parecía**: el `/api/meta-health` simulado
no tenía caché y la prueba entró en los primeros 120 s. Ver la revisión, abajo.

### La revisión del mismo día: cinco cosas que el commit afirmaba y no hacía (07/10)

Dos revisores leyeron `025f44ec` contra el código. Todas se verificaron antes de tocarlas.

**1. El optimista se soltaba por reloj, y la caché sirve lo vencido.** Síntoma (escenario
sobre el código, no visto en una cuenta): escribir 500 → 1000, no mirar nada, pausar otra
fila a los 3 minutos → la fila vuelve a 500 con Meta en 1000, y el cartel siguiente calcula
el ×5 contra 500. Es el MISMO caso que el commit decía cerrar, pasados 2 minutos. Causa:
`unstable_cache` es stale-while-revalidate; el detalle y la regla, en «El árbol de Meta que
leen las guardas puede tener CUALQUIER edad». Y el test que lo «fijaba» comparaba
`VENTANA_CACHE_HEALTH_MS` con el `revalidate` de la caché, **que es la propiedad
equivocada**: los dos números eran iguales y el bug estaba en suponer que uno acota al
otro. Se reemplazó por uno con una lectura vencida servida después de la ventana.

**2. Un `cargar()` en el medio se llevaba el optimista de una escritura en vuelo.** `writeBudget`
anotaba en `escritos` recién al volver OK, y `cargar()` reemplaza el mapa optimista entero
con lo que hay en `escritos`. Pausar la fila B mientras viaja el presupuesto de A → la fila
de A vuelve al viejo, el aviso dice «Presupuesto cambiado», y nadie repone el monto. Ahora se
anota ANTES del POST (en vuelo, sin hora) y se repone al volver.

**3. Un fallo borraba el optimista sin mirar lo escrito antes.** Con 1000 confirmado (y sin
recarga, por diseño) y un 3000 rechazado, `clearOpt` dejaba la fila en el 500 del árbol
cargado: un monto que Meta ya no tenía. Ahora vuelve a lo que la fila mostraba antes.

**4. Agregar conjunto trataba «no pude leer la moneda» como «cobra en dólares».**
`usdACuenta(budgetUsd, cuenta?.currency ?? 'USD')`, con la lectura de la cuenta en un
`catch` mudo y sin el respaldo de la moneda del árbol que el wizard sí tiene. En el ws1 un
error transitorio de Meta creaba el conjunto con 50 MXN/día sobre un «50» tipeado bajo el
rótulo «USD»: 17,3 veces menos, sin aviso. Era previo a la #349, pero el commit afirmaba que
los cuatro lugares convertían. Ahora toma la moneda del árbol de respaldo y, sin ninguna, no
crea y lo dice. Y el rótulo decía «USD → ARS» sobre un monto que viajaba sin convertir.

**5. Tres guards seguían verdes con lo que su nombre dice fijar, roto.** Medido con
mutaciones: sacar el `return` de la rama de fallo del lote (el «Presupuesto cambiado en N»
vuelve a tapar el error), dejar la guarda de `e.repeat` de `Confirm` sin su `return` (el
Enter repetido sigue hasta `onConfirm()`) y mandar `onPresupuesto(Number(monto))` desde la
barra (50 en vez de 865 en el ws1): las tres daban **13 / 0**. Los asserts buscaban que la
llamada EXISTIERA —`avisarFallos(`, `e.preventDefault();`, `tipeadoACuenta(monto, moneda)`,
que estaba en el `disabled`— y no la línea que decide.

**Regla, y vale para cualquier guard sobre el fuente:** se fija la línea que DECIDE —la rama
que corta con su `return`, el valor que se MANDA—, no que la llamada aparezca en el bloque.
La pregunta antes de dar un guard por bueno: «¿qué mutación de una palabra deja esto verde
con el bug adentro?». Y una prueba en el navegador con el backend simulado prueba el código
de la pantalla, nunca la caché: si lo que se cuida ES la caché, el simulado tiene que
servir una entrada vieja a propósito.

Y la cosecha también tenía un error: contaba a la barra de lote como «la cuarta vez» del
×17,3, y el lote nunca multiplicó (corregido en «Y de paso: el presupuesto se multiplicaba
por 17,3»).

**Sin hacer, de la revisión:**
- **Invalidar el árbol al escribir**: `TAG.marketing` es global y lo comparten 12 lecturas de
  `lib/queries.ts`; hace falta un tag propio por workspace (ver la entrada de la caché).
- **`inicioLecturaISO` falta en las entradas de caché escritas antes del deploy**: sin él la
  tabla mantiene lo escrito hasta la primera lectura nueva. Se va solo con la primera
  revalidación.
- **El rótulo de agregar conjunto no se miró en el navegador**: el cambio es de texto y de
  `disabled`, verificado con typecheck y el guard.

### Lo que quedó SIN hacer

- **La primera prueba real** —escribir en una cuenta de verdad— no se hizo. Conviene una
  campaña en pausa, mirando.
- **El offset de centavos de Meta, NO verificado.** `lib/meta-write.ts` multiplica por 100 y
  `lib/meta-health.ts` divide por 100. Por lo que se sabe de la tabla de monedas de Meta,
  algunas (COP, CLP, JPY, KRW, TWD, entre otras) no usan centavos; si un cliente cobra en una
  de ésas, la celda, el cartel y el wizard quedan 100× corridos. Comprobarlo contra la tabla
  de Meta antes de afirmar montos fuera de MXN y USD.
- **`app/ads-manager/EntityDetalle.tsx:87`** escribe «MXN» a mano junto a `presupuestoMxn` en
  el resumen que se le pasa a MaKo, también en cuentas que cobran en dólares.
- **Dos defaults para la misma moneda:** `computeAccountHealth` inventa `'MXN'` si Meta no
  manda `currency`, y `HEALTH_SIN_CONEXION` también; el wizard cae a `'USD'`. Riesgo bajo
  (el campo se pide explícito), pero el cartel no puede distinguir una moneda medida de un
  default.
- **El lote escribe en paralelo** (`Promise.allSettled`, como la pausa en lote). Con muchas
  filas puede chocar con el rate limit de Meta; no se midió.
- **Lo que significa un número en la barra de lote CAMBIÓ:** quien tipeaba pesos ahí ahora
  tipea dólares. El placeholder («Diario, en USD») y el cartel lo dicen; Martín se entera.
- **La invalidación de la caché** al escribir (ver «El árbol de Meta que leen las guardas
  puede tener CUALQUIER edad»): la tabla tiene un parche, no la cura.

**Vive en:** lib/presupuesto-cambio.ts (`presupuestosVigentes`, `horaDeEscritura`) ·
app/ads-manager/CampanasBrowser.tsx (`pideBudget`, `pedirPresupuesto`, `bulkPresupuesto`,
`aplicarPresupuesto`, `writeBudget`, `optimistasQueSiguen`, `BudgetCell`, `BudgetEditor`,
`MensajePresupuesto`) · app/ads-manager/BarraAcciones.tsx (`BarraLoteAds`) ·
app/_ui/Confirm.tsx · app/ads-manager/NuevaCampanaModal.tsx ·
app/ads-manager/AgregarConjuntoModal.tsx (`moneda`, `monedaRespaldo`) ·
lib/meta-health.ts (`inicioLecturaISO`) · lib/meta-health-ui.ts (`MetaHealth`) ·
lib/api-mako/areas/ads.run.ts (`saltoPresupuesto`) · tests/ads-presupuesto-confirma.test.ts ·
*2026-10-07 tarea-349-cartel-presupuesto · 2026-10-07 revisión de la #349*

## Un video se daba por listo antes de que Meta lo procesara, y un reintento publicaba dos veces (07/10, tarea #59)

**Síntoma (medido contra el código; en una cuenta no se vio nunca):** un video que Meta
tardaba en procesar entraba a la bandeja del wizard como LISTO; al publicar, Meta rechazaba el
creativo con la campaña y el conjunto ya creados, y todo terminaba en rollback. Y si la
respuesta de una publicación se perdía —504 a los 300 s, la pestaña cerrada—, el borrador
seguía en localStorage, se reabría en «revisión» y el segundo clic creaba OTRA campaña.

**El diagnóstico obvio era el equivocado, dos veces.**

1. El bug del 25/09 se anotó como «candidato a ser la causa del A41» (el botón Publicar
   trabado). No lo era: los 16 videos que ws1 publicó entre el 20 y el 30/09 llevaban un
   `thumbnail_url` data: en el spec, pasaron por `withVideoThumb` y ninguno fue rechazado; los
   14 fracasos de ws13 (11-17/09) son todos 1885183 —la app del cliente en modo desarrollo— en
   el PRIMER creativo. El bug era real y latente: aparece sólo cuando Meta tarda más que la
   espera del POST.
2. La #797 decía que mandar el video por URL «destraba los videos pesados». creative-upload YA
   lo mandaba por `file_url`; lo que frenaba eran los 150 s de espera adentro de la función y
   una transcripción que bajaba el archivo ENTERO para descubrir que pesaba de más.

**Causa, en cuatro lugares:**

| Dónde | Qué pasaba |
|---|---|
| `SubidoCreativo` y los TRES modales | La ruta devolvía `processing` y `video_status`; el tipo no los declaraba y los modales escribían `processing: false`. El tercero (Agregar anuncio) no estaba en la medición del 25/09, y Nueva campaña tenía su PROPIA copia de la subida |
| creative-upload, POST | `video_status: 'error'` contestaba `ok: true`. Y esperaba 150 s en un `Promise.all` con la transcripción, que no tiene tope, bajo `maxDuration = 300`: un 504 borraba el ítem de la bandeja con el video ya en Meta |
| campaign-create, ad-add, adset-add | Ninguna preguntaba por los videos antes de crear |
| La idempotencia | No existía (la nombraba un comentario). adset-add y el modo simple de ad-add ni siquiera dejaban registro, y adset-add no hace rollback |

**Trampas que no se ven leyendo el código:**

- **`after()` no saca nada de los 300 s** (la doc de Next: corre «por la duración máxima de
  la ruta»). Lo único que gana es la respuesta temprana; por eso la espera del POST bajó a 25 s
  y el resto lo pregunta el navegador por GET, con un tope de 15 minutos.
- **El staging no se puede borrar «después de transcribir»**: Meta lo baja del `file_url`
  firmado, y borrarlo antes deja el video en 'error'. Se borra sólo con 'ready' o 'error'. Y
  nada más limpiaba ese bucket (`lib/reset-workspace.ts` sólo lo nombra) — desde la revisión,
  cada subida barre lo que tiene más de 6 h (entrada siguiente).
- **`withVideoThumb` la usa también la PREVIA** (`generatePreviews`): hacerla tirar rompía el
  paso de revisión de todo video sin miniatura todavía. La versión estricta va sólo en
  `createAdCreative`.
- **La tarjeta dibuja `(progress ?? 0) < 100 ? 'N%' : 'Procesando'`**: con
  `processing: r.processing` y `progress` en undefined, un video que Meta procesa decía «0%».
- **ad-add escribe al insertar el `meta_campaign_id` de la campaña que YA existía.** Con la
  regla de la campaña («error con campaña y sin revertir = a medias»), un lote que falló con 0
  anuncios quedaba trabado para siempre. Son dos reglas (`lib/meta-idempotencia.ts`).
- **La misma clave después de un parcial conocido pierde anuncios**: el cliente recorta los N
  que entraron y reintenta; el server contestaría «creados N» desde la fila vieja y se
  recortarían N más. La clave sale de la FIRMA del payload.
- **El chequeo de videos va ANTES de abrir el registro**: un 409 dejaría una fila en 'creando'
  y el reintento legítimo esperaría 6 minutos.
- **Un guard de orden («videos antes de crear») pasaba de gratis** mientras recortaba desde el
  principio del archivo: el helper `sinProcesar` está definido arriba del POST. Lo destapó
  romperlo. ⚠️ **Y el arreglo cubrió sólo el modo simple**: recortando desde el POST, el lote
  de ad-add siguió pasando de gratis hasta la revisión (ver la entrada siguiente).

**Regla:** un creativo se usa cuando Meta dice 'ready', y lo que lo decide es lo que Meta
contestó —nunca un `false` escrito a mano—; el server vuelve a preguntar antes de crear, y
«no pude leer» no bloquea. Y todo lo que crea afuera y puede perder su respuesta lleva una
clave que sale de la firma de lo que se manda (la regla general quedó en AGENTS.md).

**Una decisión distinta del plan, y por qué:** con la columna `idem_key` faltando, la ruta
NO devuelve 503: publica por el camino viejo y lo loguea. En un clon compartido cualquier
sesión puede pushear este commit antes de que alguien aplique la 0215, y un 503 a todas las
publicaciones de todos los clientes es peor que una protección que hasta hoy no existía. El
costo, dicho: mientras falte, el «Reintentar es seguro» que ve la persona es falso. Por eso la
cabecera de la migración dice ANTES del deploy. La base que no contesta sí da 503.

**Cómo se verificó:** typecheck en 0; `npm test` 4510 de 4510; diecisiete roturas a propósito,
todas cazadas (los números van en cada test); y en el navegador —dev server con
`ZERNIO_API_KEY= ELEVENLABS_API_KEY=`, el log dijo sólo «hidratadas», ws9, con la subida y
campaign-create simulados y todo otro POST abortado: ninguno llegó a una ruta real— 20 de 20:
la tarjeta dice «Procesando» y no «0%», Siguiente queda apagado hasta 'ready', el borrador
retoma la espera de SU video y descarta el ítem cortado, un borrador viejo sin clave publica,
el reintento después de una respuesta perdida manda la MISMA clave, y editar el nombre en la
revisión la cambia.

**Sin hacer:**

- **Aplicar la 0215**, antes del deploy.
- **Publicar de verdad** (lo hace Martín, mirando): ws1 es un cliente con plata real. Con la
  app MaKo nueva (2586146911825340) Meta rechazaría todo creativo con 1885183 mientras esté en
  modo desarrollo, y eso se destraba pasándola a «Publicada», no con el App Review. En qué modo
  está hoy no está escrito en ningún lado.
- **Crear un formulario desde cero** contra una página real: es irreversible (sólo se archiva).
  Martín elige la página.
- **Un video de 300-500 MB**: cuánto tarda Meta en procesarlo y si `file_url` lo acepta. El
  tope de 15 minutos del navegador no está medido contra nada.
- **Qué ve la persona cuando un reintento encuentra una publicación a medias** (decisión de
  Martín). Hoy: «Quedó a medias en Meta… revísalo en la tabla», y la misma clave sigue
  contestando eso hasta que algo del spec cambie. (Desde la revisión, un conjunto de
  adset-add que quedó VACÍO se borra y no llega a «a medias».)
- **Confirmar con una publicación real** que con el video 'ready' la miniatura de Meta siempre
  llega: si no, la versión estricta frena algo que antes Meta habría aceptado.
- **after() en Vercel**: si no corriera, la transcripción gratuita se pierde y la paga el cron.
  No medido.
- **Una carrera chica**: el GET puede borrar el staging mientras la bajada para transcribir
  todavía corre (arranca al principio del POST; la ventana es un video de hasta 25 MB que tarde
  más de ~30 s en bajar).
- **Un lote cortado entre crear un anuncio y anotarlo** deja uno sin contar: el «a medias»
  dice N y eran N+1.
- **La API de MaKo** (`proponer_agregar_anuncio`, lib/api-mako/areas/ads.run.ts) no pregunta
  por el video antes de proponer; lo frena la miniatura estricta antes del creativo.
- **campaign-create mira `process.env.META_PIXEL_ID`** (el del entorno) y no el pixel del
  workspace (`pixelDelWs`). Casi sin efecto: el wizard exige `pixel_id`.
- **`permMsg`** (app/ads-manager/CampanasBrowser.tsx:409) es un diagnóstico escrito a mano
  —«el token ya es System User… 2FA»— que es falso para los clientes con otros tokens. No es de
  la #59.
- **Los dos modales chicos no se miraron en el navegador**: son el mismo molde y los fija
  tests/ads-video-procesando.test.ts.

**Vive en:** app/ads-manager/creativeUpload.ts (`subirCreativo`, `esperarVideoListo`,
`postConTope`) · app/ads-manager/NuevaCampanaModal.tsx (`subir`, `seguirProcesando`,
`loadDraft`, `publicar`) · app/ads-manager/AgregarAnuncioModal.tsx ·
app/ads-manager/AgregarConjuntoModal.tsx · app/api/ads-manager/creative-upload/route.ts (POST
y GET) · app/api/ads-manager/campaign-create/route.ts · app/api/ads-manager/ad-add/route.ts ·
app/api/ads-manager/adset-add/route.ts · lib/meta-ads-create.ts (`estadoVideo`,
`videosSinProcesar`, `conMiniaturaParaPublicar`, `addAdsetToCampaign`) · lib/campana-videos.ts ·
lib/meta-idempotencia.ts · supabase/migrations/0215_meta_campaign_drafts_idem.sql ·
tests/ads-video-procesando.test.ts · tests/campana-videos.test.ts ·
tests/meta-idempotencia.test.ts · *2026-10-07 tarea #59*

## La revisión de la #59: la firma sola duplicaba, y la fila decía menos de lo que había en Meta (07/10)

**Síntoma (medido contra el código; nada de esto se vio en una cuenta):** ocho reportes de dos
revisores sobre f6ed4c33. Los ocho eran reales. Los que importan:

1. **«Reintentar es seguro: no se duplica» era falso apenas se tocaba algo.** Después de una
   respuesta perdida la pantalla vuelve a «revisión» con el nombre y el copy editables. Corregir
   una palabra cambiaba la firma, salía otra clave, el server no tenía fila para ella y creaba una
   SEGUNDA campaña con la primera ya en Meta. Y en Agregar anuncio / Agregar conjunto la clave
   vivía en un ref: cerrar y reabrir el modal la perdía, así que hasta el MISMO anuncio salía dos
   veces.
2. **La fila del registro —lo único que lee un reintento— decía menos de lo que existía.** Los
   `persist` intermedios tragan su error y los terminales no reescribían lo que estaba en memoria:
   en campaign-create el de éxito no llevaba `meta_campaign_id` (una fila 'publicada' sin campaña
   devolvía `campaign_id: null`, y el cliente le asignaba el producto a la campaña «null»); en el
   lote de ad-add un intermedio perdido dejaba «creados 2» sobre 4 y el reintento recortaba 2 y
   volvía a crear el 3 y el 4; en adset-add el id del conjunto vivía sólo en el avance. Y
   `deleteEntity` no leía la respuesta del DELETE: «(revertido)» sin que Meta lo confirmara.
3. **adset-add quedaba «a medias» para siempre con un texto que mandaba a reintentar.** La
   miniatura se exigía al crear el creativo, o sea con el conjunto ya creado: «Espera unos
   minutos y vuelve a intentar», y el reintento contestaba 409 en cada clic. La única salida era
   tocar un campo — otra clave, un SEGUNDO conjunto con presupuesto.
4. **Dos guards en verde sobre lo que existían para cazar** (medido sobre una copia de HEAD,
   código y tests: pass 11 / fail 0 en los tres casos). El de «videos antes de crear» recortaba
   desde el POST, y en ad-add ese tramo incluye al modo simple: sin el chequeo del LOTE, el
   `lastIndexOf` encontraba el del simple. El del workspace leía sólo el PRIMER insert del
   archivo, y desde que el modo simple registra, ése es el del simple: el insert y el persist del
   lote quedaron sin red (y sin el workspace, con la clave puesta, es un 503 a toda publicación
   del lote).
5. **«No pude leer» terminaba como un veredicto de Meta.** A los 15 minutos `esperarVideoListo`
   devolvía 'tope' igual con Meta diciendo 'processing' que con un 401, un `ok:false` o la red
   caída, y los tres modales descartaban la tarjeta con «Meta no terminó de procesar… Súbelo de
   nuevo»: otro video en Meta y otro archivo en el staging.
6. **Un default que afirma.** `objective` tiene default `'OUTCOME_LEADS'` (0157): el modo simple
   de ad-add nunca lo escribía y adset-add lo corregía sólo si la lectura de la campaña contestaba.
   `listar_publicaciones_mako_meta` le decía al dueño que publicó un anuncio de Leads en una
   campaña de Tráfico.
7. **El staging pasó a depender de la pestaña.** Con la espera del POST en 25 s, un video casi
   nunca llega a 'ready' adentro del POST, y su archivo lo borraba sólo el GET del navegador:
   cerrar el modal lo dejaba en el bucket para siempre.

**El diagnóstico obvio era el equivocado en el 1:** «que la edición no cambie la clave» suena a
congelar la firma, y eso reabre el bug que la firma vino a cerrar (después de un parcial conocido
el cliente recorta y NECESITA otra clave). Lo que distingue los dos casos no es el payload: es si
el server ya contestó por esa clave.

**Regla:**

- **La clave de un pedido sin respuesta queda ABIERTA y manda sobre la firma hasta que el server
  la cierre** (un ok, un 'a-medias' o un parcial con `created`; todo lo demás la deja abierta,
  incluido un 409 de videos, que ni miró la clave). Mandarla con otro payload es seguro: el server
  contesta desde la fila si algo se creó, y publica lo que llega si no. Pero esa respuesta puede
  hablar del payload de ANTES (`deAntes`): no se pinta como el éxito de lo que está en pantalla
  ni se le recorta su `created`. Y vive fuera del componente (localStorage + memoria, por destino
  y por `?ws=`).
- **Los persist terminales reescriben todo lo que hay en memoria**, y un rollback cuenta sólo si
  el proveedor CONFIRMÓ el borrado (`{ success: true }`).
- **Lo que puede fallar sin crear nada va ANTES de crear** (la miniatura, la lectura de la
  campaña), y un conjunto que quedó vacío se borra: un «a medias» que no tiene nada adentro no le
  sirve a nadie y traba la clave.
- **Un guard sobre una ruta con dos modos recorta desde el modo de CADA creador**, y uno que
  revisa «el insert» los revisa TODOS (con la cantidad esperada, para que el próximo se note).
- **«No pude leer» no descarta nada**: la tarjeta se queda y se sigue preguntando, más espaciado.

**Cómo se verificó:** typecheck en 0; `npm test` 4538 de 4538; dieciocho roturas a propósito,
todas cazadas, con el número en cada test (y las tres del lote, reproducidas primero en verde
sobre una copia de HEAD). **No** se miró en el navegador ni se publicó nada: la clave abierta y
el `deAntes` se probaron como funciones puras, la espera con un `fetch` simulado, y el resto con
guards sobre el fuente.

**Sin hacer:**

- **El barrido del staging no está medido contra el storage real**: `list('nueva', …)` ordenado
  por nombre (los primeros son los más viejos porque empiezan con la hora en ms) y de a 100 por
  subida. Si la carpeta tiene miles de sobrantes, se limpian de a poco. Lo de antes de este
  commit también lo barre, porque el formato del nombre no cambió.
- **`deleteEntity` lee `{ success: true }` sin una medición propia**: es la respuesta documentada
  del DELETE de la Graph API. Si Meta contestara otra forma, el rollback de campaign-create y el
  borrado del conjunto vacío quedarían como «a medias» — el lado seguro, no un duplicado.
- **Un `deAntes` no refresca la tabla en los dos modales chicos** (no tienen cómo sin cerrarse):
  el texto manda a mirarla. En Nueva campaña sí refresca.
- **El objetivo del modo simple sale del árbol de la tabla**: si la tabla no lo tiene (un árbol
  sin la campaña), la fila dice 'DESCONOCIDO', no Leads.
- **Una clave abierta de un destino al que no se vuelve** queda en localStorage para siempre. No
  molesta: la próxima publicación a ese destino la resuelve.

**Vive en:** lib/meta-idempotencia.ts (`claveAMandar`, `trasRespuesta`, `decidirReintentoCampana`)
· app/ads-manager/creativeUpload.ts (`claveAbierta`, `anotarClaveAbierta`, `esperarVideoListo`,
`ANTERIOR_PUBLICADA`) · app/ads-manager/NuevaCampanaModal.tsx (`publicar`, `seguirProcesando`) ·
app/ads-manager/AgregarAnuncioModal.tsx · app/ads-manager/AgregarConjuntoModal.tsx ·
app/ads-manager/CampanasBrowser.tsx (`addAnuncioAdset`) · app/api/ads-manager/campaign-create/route.ts
· app/api/ads-manager/ad-add/route.ts (`objetivoDelBody`) · app/api/ads-manager/adset-add/route.ts
· app/api/ads-manager/creative-upload/route.ts (`barrerStagingViejo`) ·
app/api/ads-manager/creative-signurl/route.ts · lib/ads-staging.ts · lib/meta-ads-create.ts
(`deleteEntity`, `addAdsetToCampaign`) · tests/meta-idempotencia.test.ts ·
tests/ads-video-procesando.test.ts · tests/meta-campaign-drafts-workspace.test.ts ·
tests/ads-publicar-registro.test.ts · tests/ads-staging.test.ts · *2026-10-07 revisión de la #59*

## Usar un video de MaKo al armar el anuncio, sin bajarlo y volverlo a subir (07/10, tarea #797)

**Síntoma:** para publicar un anuncio hecho en /video-generator había que bajar el .mp4,
buscarlo en el explorador y volver a subirlo. En `app/ads-manager` no había una sola referencia
al bucket `video-clips` ni a `montaje_trabajos`.

**Lo que se midió antes de escribir (SELECT de sólo lectura, 07/10):**

- **En producción no hay NI UN montaje 'listo'.** `montaje_trabajos` tiene 2 filas, las dos
  'pendiente' con `intentos` 0 (ws1 y ws11): el worker de montaje nunca tomó un trabajo
  (docs/hallazgos-generativa.md: «El worker de montaje sigue sin contenedor»). Con el anuncio
  montado como única fuente, el selector salía vacío para todos los clientes. Por eso van las
  DOS fuentes: los montados primero y las tomas sueltas después, cada grupo rotulado.
- **Las tomas sí existen: 31 con url** (14 en ws1, 17 en ws11), y las 31 son EXACTAMENTE
  `getPublicUrl('video-generator/<plan>/toma-<n>-<mediaId>.mp4')` (en las 31, `mediaId` es igual
  a `operacion`). ws9, el de Martín, no tiene historial del generador ni Meta conectada.
- **El bucket contesta `Access-Control-Allow-Origin: *`** (un GET con Range y el preflight sobre
  una toma real): un `<video crossOrigin="anonymous">` dibuja en un canvas sin «taint», así que
  la miniatura se puede hacer en el navegador.

**Las trampas, y cada una quedó con su guard:**

1. **La url no puede viajar del navegador, ni validarse con un prefijo.** El bucket es público y
   la ruta no lleva el workspace (docs/hallazgos-generativa.md: «`video-clips` es un bucket
   PÚBLICO»): con la url en el body, un admin del ws A publicaría el video del ws B; y
   `urlEsPropia` (`includes('/storage/v1/object/public/video-clips/')`) aceptaría cualquier toma
   de cualquier cliente. El navegador manda sólo una `ref` (`montaje:<id>` / `toma:<plan>:<n>:<op>`,
   con el clip desde la revisión de abajo);
   el server la resuelve en el workspace de la sesión, ARMA la url con la misma ruta que la
   escribió (el worker de montaje y `guardarClip`) y exige que lo guardado sea exactamente eso; y
   antes de dársela a Meta mira el origen con `new URL`. Medido contra el server local: con la
   sesión de ws9, la `ref` de una toma de ws1 contesta 404 sin tocar Meta.
2. **La rama nueva no borra nada.** `creative-upload` borra el staging (`ads-creatives`) cuando
   Meta da su veredicto; ese borrado sobre `video-clips` se lleva el anuncio montado, que es la
   ÚNICA copia (el worker sube con upsert sobre la misma ruta). Tampoco se guarda el guion como
   transcripción: una fila en `creative_transcripts` pasa a `ad_transcripts` y el cron
   transcribe-ads se saltea ese anuncio para siempre — y el generador dice palabras distintas
   del guion.
3. **La miniatura es una data: o nada.** Una url http del .mp4 en `thumbnail_url` viaja como
   `video_data.image_url` (`buildObjectStorySpec`), y `faltaMiniatura` la da por buena porque es
   http, así que la de Meta no la reemplaza: Meta rechaza el creativo. La data: no viaja (sólo se
   reenvía http), la miniatura de Meta llega al publicar, y es lo único que «MaKo mira los
   creativos» sabe leer.
4. **El workspace que lee tiene que ser el que escribe.** `getTenantDb()` con ws null lee con el
   id imposible -1 y `cred()` cae a OWNER_WS. Sin `runWithWorkspace(wsDeAdsManager(), …)` en las
   dos rutas, el admin de agencia sin workspace veía la lista vacía y subía al ws1.

**El diagnóstico obvio era el equivocado, dos veces:**

- El detalle de la tarea prometía un «regalo de arrastre» para la #59: que por url dejaba de
  aplicar el límite de body y se destrababan los videos pesados. Falso: el video del disco YA
  viajaba a Meta por `file_url` firmado (el navegador sube directo al storage y los bytes nunca
  pasaron por la función). Lo que frena a un video pesado es la espera a Meta, no el body.
- «¿Sólo el montado, o también las tomas?» se había anotado como una decisión de producto que no
  bloquea. Con cero montajes listos, era la decisión de si la feature mostraba algo.

**De paso, en Nueva campaña:** `promptDeRespuestas` indexaba el análisis de MaKo (`an[i]`) sobre
todos los creativos, y el análisis viene indexado sólo por los que tienen miniatura data:. Un
ganador —o un video de MaKo cuyo frame no se pudo dibujar— corría las descripciones al anuncio
equivocado. Ahora se busca por SU miniatura (`analisisDe`, como ya hacía `promptExistente`) y un
video de MaKo sin análisis se describe con el título de su anuncio.

**Regla:**

- **La url de un archivo de un bucket público cuya ruta no lleva el workspace se DERIVA en el
  server desde ids del workspace; nunca se acepta del navegador ni se valida por prefijo.** Lo
  que no coincide con la derivación no se ofrece.
- **Una rama nueva sobre una ruta que limpia temporales no hereda la limpieza:** el que borra
  tiene que saber que lo que borra es una copia.
- **El video de MaKo entra por la MISMA subida y la MISMA espera** en los tres modales
  (`subir({ file } | { mako })`, `procesarEnMeta` → `subidoDeRespuesta`): dos caminos para lo
  mismo era justo lo que la #59 vino a sacar.

**Cómo se verificó:** typecheck en 0; `npm test` 4554 de 4554 (16 nuevos); quince roturas a
propósito, todas cazadas (pass 7 / fail 1 en cada archivo nuevo, pass 9 / fail 1 en el de la
#59), restaurando de memoria. `npm run build` en 0, y el código del server no aparece en el
bundle. En el navegador (Playwright, Chrome sin ventana y mudo; meta-health, creative-upload,
ad-add, adset-add y targeting simulados; todo otro POST abortado): 17 de 17 — el vacío REAL de
ws9 con su link a `/video-generator?ws=9`, montados antes que tomas, el POST con SÓLO
`{ mako }` en los tres modales, «Procesando» y no «0%», la miniatura data: dibujada desde el
bucket real, y el mismo video no entra dos veces. La ruta real, por GET, contesta 14 tomas en
ws1 y 17 en ws11, 0 montados. **No** se creó ningún anuncio ni se llamó a Meta.

**Sin hacer:**

- **El «Listo cuando» de punta a punta** —crear el anuncio en pausa en una cuenta real— lo hace
  Martín, mirando, porque deja un video en la biblioteca de la cuenta. Antes: conectar Meta en
  ws9 (hoy no tiene token, ni cuenta, ni página), tener ahí un anuncio generado (gasta créditos de
  Flow) y, para probar el montado, desplegar el contenedor del worker (`MONTAJE_WORKER_TOKEN`):
  sin eso los dos montajes pendientes, que son de clientes, no se mueven.
- **La imagen.** `CreativoMako.media_type` ya admite 'image' y la rama de creative-upload la
  rechaza («Por ahora, sólo videos.»). No hay de dónde sacarla: /image-generator es ComingSoon
  (#298) y las imágenes de escena del generador son urls de Flow que vencen a las ~6 h.
- **Cada elección sube otro video a la biblioteca de la cuenta**: Meta no deduplica por url.
  Nueva campaña no deja el mismo video dos veces en la bandeja; entre publicaciones no hay caché
  `ref → video_id` por cuenta.
- **Las tomas de un anuncio que el tope de 10 sacó del historial** siguen en el bucket y no se
  ofrecen: no queda de dónde saber de quién son.
- `motivoFinEspera` dice «Prueba con otro archivo» / «Súbelo de nuevo» también para un video de
  MaKo.

**Vive en:** lib/creativo-mako.ts (`creativosDeMontajes`, `creativosDeTomas`, `leerRefCreativo`,
`mismoOrigen`) · lib/creativo-mako-fuentes.ts (`resolverCreativoMako`) ·
app/api/ads-manager/mis-creativos/route.ts · app/api/ads-manager/creative-upload/route.ts
(`subirCreativoMako`) · app/ads-manager/creativeUpload.ts (`usarCreativoMako`, `procesarEnMeta`,
`subidoDeRespuesta`, `makeThumbDeUrl`, `listarCreativosMako`) · app/ads-manager/MisCreativosMako.tsx
· app/ads-manager/AgregarAnuncioModal.tsx · app/ads-manager/AgregarConjuntoModal.tsx ·
app/ads-manager/NuevaCampanaModal.tsx (`subir`, `CreativosPicker`, `analisisDe`) ·
tests/creativo-mako.test.ts · tests/ads-creativo-mako.test.ts · tests/ads-video-procesando.test.ts
· *2026-10-07 tarea #797*

## La revisión de la #797: la ref de una toma nombraba el casillero y no el clip, y dos guards daban verde sobre lo que cazaban (07/10)

**Síntoma (lo encontró la revisión, no un cliente):** con «Mis creativos» abierto, si la toma 3
se volvía a filmar en otra pestaña, el clic en la tarjeta «Toma 3» —que seguía mostrando el clip
A— subía a Meta el clip B. La miniatura de la bandeja, el texto que escribe MaKo (analyze-creatives
mira esa miniatura) y la vista previa eran de A; el anuncio salía con el `video_id` de B. Nada
fallaba ni avisaba. Y el filtro de duplicados por `mako_ref` de Nueva campaña no dejaba elegir la
versión nueva mientras la vieja siguiera en la bandeja: tenían la misma ref.

**Causa:** la ref `toma:<plan>:<n>` nombraba el NÚMERO de toma. El server la resolvía con lo que
esa toma tuviera guardado AL HACER CLIC —`guardarClip` sube `toma-<n>-<op nueva>.mp4` y
`guardarMarca` mueve `video[n]` a él (app/video-generator/video-action.ts)—, mientras todo lo que
la persona vio salía de la url que vino en la lista. El mismo dato leído en dos momentos.

**Arreglo:** la ref lleva el clip: `toma:<plan>:<n>:<op>`, con la op que ARMA la url y no la
primera con forma válida (mientras se filma, `operacion` ya es la nueva y `url`/`mediaId` siguen
siendo del clip anterior). `tomaPedida` compara contra lo que se ofrece HOY con la MISMA
`creativosDeTomas` que armó la lista: si la toma guarda otro clip, **409 «Esa toma cambió. Vuelve
a elegirla.»**; si ya no se ofrece, 404. La forma vieja (sin el clip) no se acepta. El montado no
lo necesita: cada montaje es una fila nueva con su id.

⚠️ **Y un 409 que dice «vuelve a elegirla» necesita que se PUEDA.** En Nueva campaña el panel
queda abierto (entran varios) y la lista se pedía una sola vez, al montarlo: la tarjeta seguía con
la ref del clip viejo y elegirla de nuevo daba el mismo 409 para siempre. Ahora cada fallo de un
video de MaKo vuelve a montar el panel (`key={vueltaMako}`) y la lista se pide de nuevo. En los dos
modales chicos el panel se cierra al elegir, y reabrirlo ya la pide.

**Dos guards daban verde sobre lo que existían para cazar** (medido corriendo el test de HEAD sobre
cada rotura: 1 pass / 0 fail en los dos):

- «El workspace que LEE es el que ESCRIBE» miraba el ORDEN —`wsDeAdsManager()` antes de
  `runWithWorkspace`— y no que la lectura CORRIERA adentro. Un `Promise.all([montados…(),
  tomas…()])` armado antes del wrapper y esperado adentro lee con el id -1 (lista vacía) mientras
  `cred()` escribe en OWNER_WS: el bug exacto que el guard nombra. Ahora se corta el callback hasta
  SU llave de cierre y la lectura tiene que estar adentro y no afuera, en las dos rutas.
- «No pude leer no es no tienes videos» contaba los `if (error) throw` y exigía el literal
  `leerHistorialEstricto()`: un `try { … } catch { return []; }` alrededor deja las dos cosas en
  pie. Ahora lib/creativo-mako-fuentes.ts no puede tener `catch`, `allSettled` ni `.then(` —no
  tiene ninguno legítimo—.

**Regla:**

- **Lo que una persona aprueba mirando se identifica por lo que VIO, no por el casillero donde
  estaba.** Una ref que nombra un lugar (la toma 3) se resuelve con lo que haya en ese lugar al
  hacer clic. Es «lo que una persona aprueba por id no cambia bajo ese id» (AGENTS.md) del lado de
  un archivo, y la prueba es la misma: ¿qué pasa si el lugar cambia entre el render y el clic?
- **Un guard sobre un contexto fija dónde CORRE la llamada, no dónde aparece el wrapper.** Y uno
  de «no se traga el error» prohíbe la FORMA de tragarlo; exigir el literal estricto no alcanza.

**Cómo se verificó:** typecheck en 0, `npm test` en verde, y diecisiete roturas cazadas
(restaurando de memoria, con el md5 de cada archivo comparado al final): las cuatro de la ref en
tests/creativo-mako.test.ts, las seis nuevas y las siete viejas re-contadas en
tests/ads-creativo-mako.test.ts — cada una con su número en el comentario del test. **No** se abrió
el navegador ni se llamó a Meta.

**Sin hacer:**

- Una pestaña con «Mis creativos» abierto desde ANTES del deploy manda la ref vieja y recibe 400
  «Ese video no es válido.»; se arregla reabriendo el panel.
- Lo de la entrada anterior sigue igual: la prueba de punta a punta en una cuenta real la hace
  Martín, y el montado espera el contenedor del worker.

**Vive en:** lib/creativo-mako.ts (`refDeCreativo`, `leerRefCreativo`, `creativosDeTomas`,
`tomaPedida`) · lib/creativo-mako-fuentes.ts (`resolverCreativoMako`) ·
app/api/ads-manager/creative-upload/route.ts (`subirCreativoMako`, el 409) ·
app/ads-manager/NuevaCampanaModal.tsx (`subir`, `CreativosPicker`, `vueltaMako`) ·
tests/creativo-mako.test.ts · tests/ads-creativo-mako.test.ts · *2026-10-07 revisión de la #797*

---

## Varias cuentas publicitarias en un workspace (#799): medido, y por qué espera una decisión (07/10/2026)

**La pregunta previa no es técnica.** La tarea nació de «hoy cada cuenta de cada cliente de
una agencia necesitaría un workspace entero». Desde el 28/09 esa es justamente la salida
diseñada: la **cartera de agencia** (migs 0175-0178, `lib/agencia-cartera.ts`,
`lib/agencia-altas.ts`), donde cada cliente de la agencia es su propio workspace con su propia
cuenta. Varias cuentas DENTRO de un workspace compite con ese modelo, es prioridad baja y no
cierra la fase: lo decide Martín antes de escribir una línea. Si la respuesta es «alcanza con
la cartera», la tarea se cierra con esta nota.

**Si se hace, son cinco cosas que no se ven en el pedido, y cuatro tocan plata o datos:**

- **El modo de falla es crear en la cuenta equivocada sin un error.** `META_AD_ACCOUNT_ID` se
  resuelve solo en ~18 lugares de `lib/meta-ads-create.ts` (vía `cred()`). Si una ruta se
  olvida de pasar la cuenta elegida y cae a la de por defecto, la persona eligió B y gasta en A.
  La cuenta tiene que ir EXPLÍCITA en las funciones que crean (tipando `cred` sin esa clave
  para que el compilador marque cada lugar), y una cuenta pedida que no es del workspace NO cae
  a la de por defecto — el molde es `elegirLinea` de las líneas de WhatsApp.
- **`upsertMetrics` borra TODAS las filas de Meta de la fecha** (`lib/meta-ads.ts`, el borrado
  previo al insert). Sincronizar una segunda cuenta sin acotar ese borrado por cuenta se lleva
  puesto el rendimiento de la primera, y se lee como «no gastó». Además las métricas se juntan
  por NOMBRE de campaña y mezclarían dos cuentas.
- **Las alertas miran una cuenta**: el índice único de `service_incidents` y la deduplicación de
  `lib/alerta-critica.ts` quedarían ciegos a la segunda, y cambiarlos es una migración de ORDEN
  (columna e índice antes del deploy) con tres escritores que reconcilian incidentes.
- **La salud de Meta está cacheada** (`getMetaHealth`, 120 s): si la cuenta no entra como
  argumento de la función cacheada, se sirve la de otra cuenta.
- **Dos monedas en un workspace**: hoy todo el tablero supone una sola.

Lo que SÍ está bien y no hay que tocar: el token ya es por workspace, y la normalización del id
(`normalizarCuentaMeta`) está resuelta.

Probarlo exige un token que alcance DOS cuentas reales en el workspace de Martín: ni ws1
(Mauricio, un cliente) ni ws3 (que apunta a la cuenta de Mauricio).

**Vive en:** lib/meta-ads-create.ts (`cred`) · lib/meta-ads.ts (`upsertMetrics`) ·
lib/alerta-critica.ts · lib/meta-health.ts · lib/agencia-cartera.ts · *2026-10-07 tareas-ads-manager*

---

## Pautar MaKo desde Argentina: la moneda de la cuenta y cómo se paga (08/10/2026)

Para que Martín empiece a hacer anuncios de MaKo se armó la cuenta del lado de Meta, y el
pedido traía una premisa a medir: que con la tarjeta Global de ARQ (DolarApp) «se evitan los
impuestos». Lo que quedó creado, en el portafolio MaKo (493711571134922):

- **Cuenta publicitaria «MaKo» `act_1426493815659364`, en USD y con zona horaria de Buenos
  Aires.** Sin medio de pago todavía: lo carga Martín.
- **Conjunto de datos «MaKo» `1869323014511830`**, conectado a esa cuenta y puesto en la landing
  (ver `docs/hallazgos-landing.md` → «El píxel de Meta de MaKo en su propia landing»).
- **Identidad de los anuncios: la página «Hola MaKo»** (1315098941694049).
- Decisiones de Martín: **nadie más como admin por ahora, sólo él**, y **el doble factor va al
  final**, antes de correr anuncios.

Las trampas, medidas por una corrida de investigación con fuentes fechadas. No es
asesoramiento contable: lo marcado «sin confirmar» se confirma con un contador.

- **La moneda se elige al CREAR la cuenta, y cambiarla es crear otra.** Según la ayuda de Meta
  leída el 08/10, cambiar la moneda crea una cuenta publicitaria nueva (una vez cada 60 días y
  sin saldo pendiente), y los medios manuales en pesos (Mercado Pago, Rapipago) sólo se eligen
  al crearla. Por eso se decidió antes de crear, no después.
- **El 30% (RG 5617) sólo se percibe sobre lo que se paga en PESOS.** El art. 1 lo dice
  textual: «en la medida y la proporción que se abonen en pesos». Con la cuenta en USD y una
  tarjeta de banco argentino, pagar el resumen con dólares propios lo evita legalmente, y
  comprar esos dólares al oficial ya no lleva percepción (RG 5672). Queda el 21% de IVA
  (RG 4240), que percibe el banco: **unos USD 121 por cada 100 de pauta**. Un cargo de Meta en
  una cuenta en ARS es un cargo en pesos y no se puede saldar con dólares, así que con la cuenta
  en pesos el 30% es inevitable.
- **El error más fácil: un débito automático en pesos se lleva el 30%.** Se paga el saldo en
  USD antes del vencimiento, con stop debit si hay débito automático, o se debita de una caja
  en dólares.
- **«ARQ Global sin el 21% ni el 30%» significa que nadie te PERCIBE el IVA, no que no se
  deba.** Si no interviene un agente argentino, la RG 4240 (arts. 7 y 8) y la Ley de IVA
  (art. 4 inc. i) ponen a quien contrata a pagarlo por VEP (impuesto 030, concepto 699) antes
  de fin de mes. No pagarlo es omisión de impuesto, no ahorro. El 30% ya lo evita cualquier
  tarjeta pagada con dólares propios, así que lo único que «ahorra» ARQ es el IVA que hay que
  pagar igual. Y hoy sale más caro: el 08/10 ARQ vendía el USDC a $1.608 contra $1.540 del
  oficial BNA (CriptoYa, una sola medición), un 4,4% más si se fondea con pesos. Su propia
  ayuda se contradice (Meta Ads dice que la Global no tiene cargos extra; Impuestos dice que la
  tarjeta paga IVA, 30% e IIBB), con los dos artículos fechados el 01/10/2026.
- **La tarjeta tiene que ser de quien gasta, y la provincia de la sucursal emisora suma.** Con
  la de Leandro (sucursal en Olivos, PBA) se agregan ~2% de IIBB de PBA y ~1,2% de sellos, y el
  gasto queda a nombre de un monotributista de categoría A (tope ≈ $12 M al año). IIBB y sellos
  de Misiones, sin confirmar.
- **Trampa de las fuentes:** la noticia «desde el 2/1/2026 se elimina el 30%» fue una broma del
  Día de los Inocentes (Infoviajera, 28/12/2025) que otros medios repitieron; el 30% se sigue
  cobrando (Cronista, 16/09/2026). Y los encabezados de iProfesional muestran la fecha de
  navegación, no la de publicación: hay notas de 2018 que aparecen como de 2026. Se fecha por el
  cuerpo de la nota.

**Lo que quedó sin hacer, y lo hace Martín:** asignarse control total en la cuenta publicitaria
(asignar permisos lo frena el clasificador de Claude), cargar la tarjeta y los datos de
facturación (Claude no ingresa números de tarjeta ni datos fiscales), y el doble factor al
final. Para el contador: el encuadre de Martín (como Responsable Inscripto el IVA de Meta pasa a
ser crédito fiscal), IIBB y sellos de Misiones, y la retención de Ganancias a beneficiarios del
exterior.

**Vive en:** el portafolio de Meta de MaKo (493711571134922) · lib/meta-pixel-mako.ts ·
*2026-10-08 publicitar-mako*

---

## La verificación del negocio de MaKo: lo que Meta rechaza no es el documento (07-08/10/2026)

El portafolio MaKo (493711571134922) se verifica a nombre de **Tejado Gonzalvez Leandro
Martin** (monotributo). Meta lo rechazó dos veces, y ninguna de las dos fue por el documento:
fue porque un dato del formulario no aparecía, tal cual, en otro lado.

- **Primer intento (07/10), tres desajustes.** El nombre legal decía «MaKo» (va el nombre TAL
  CUAL el documento, apellido primero como en ARCA, y «MaKo» en «Nombre alternativo»); la
  dirección no figuraba en ningún documento, y el teléfono tampoco. Se resolvió confirmando por
  correo (pide un documento con razón social más dirección O teléfono: la constancia de
  monotributo alcanza sola).
- **Segundo rechazo (08/10): «la razón social de la empresa debe aparecer en el sitio web».**
  hola-mako.com decía «MaKo» en todos lados y el nombre legal en ninguno: ni en la landing ni
  como responsable en /privacidad y /terminos. Ahora sale de una constante
  (`lib/titular-mako.ts`) que usan el pie de la landing y las dos páginas legales.

⚠️ **Y tiene que estar en el HTML que sirve el server.** El pie de la landing es JSX que se
renderiza en el server; casi todo lo demás de esa página se agrega en el `useEffect`, y un
verificador que no ejecuta JavaScript no lo ve. Es el mismo motivo por el que los enlaces
legales ya estaban ahí (Google exige poder llegar a la política desde la página principal).
`tests/razon-social-sitio.test.ts` renderiza con `renderToStaticMarkup`, que no corre efectos.

⚠️ **Y ESTAR EN EL HTML NO ALCANZABA: estaba OCULTO.** El envío siguiente (08/10, confirmado
por «Verificación del dominio», sin código) se rechazó con el mismo texto en ~25 minutos,
con el nombre ya publicado. Toda la portada viajaba adentro de un `<div hidden>` del streaming
de React y sin JavaScript se leía vacía: la causa y el arreglo están en
`docs/hallazgos-landing.md` → «La portada viajaba VACÍA para quien no ejecuta JavaScript».

✅ **VERIFICADA el 08/10/2026 (~04:00), al tercer envío.** Salió a las 03:35 con el mismo
método (dominio), el mismo documento y los mismos datos; lo único distinto era el sitio. Meta lo
leyó a las 03:45:31 y 03:46:07 (el patrón de siempre, ~10 min después) y esta vez encontró la
razón social visible sin JavaScript. **El arreglo que la destrabó fue sacar el nombre del bloque
oculto**, no ponerlo en el sitio: eso ya estaba hecho y había fallado.

**Cómo saber qué leyó Meta, la próxima vez.** Las dos veces, 11-20 minutos después del envío,
llegó desde la red de Meta (AS32934) un GET `/` con user agent de Chrome, referer
`www.facebook.com` y un `fbclid`, y ~35 s después facebookexternalhit con el mismo `fbclid`. En
el log de Vercel eso dice qué versión del sitio se evaluó. No desplegar mientras está en revisión.

**La regla:** cada dato que se le declara a Meta en la verificación (nombre legal, dirección,
teléfono, sitio) tiene que aparecer **escrito igual** en algún lugar que Meta pueda mirar: el
documento o el sitio. Antes de mandar, se busca cada uno.

**Vive en:** lib/titular-mako.ts · app/vsl/Landing.tsx (`PieLegal`) · app/privacidad/page.tsx ·
app/terminos/page.tsx · app/page.tsx · app/vsl/PortadaSinJs.tsx ·
tests/razon-social-sitio.test.ts · *2026-10-08 publicitar-mako*

## Sumar Instagram y Messenger a la app MaKo: lo que cambia en la revisión (09/10)

El detalle está en `hallazgos-comunicacion.md` → «Instagram y Messenger con la app MaKo: qué
se puede sin Zernio». Lo que toca a la app, en cuatro renglones:

- **Una app usa Facebook Login O Instagram Login para los permisos de Instagram, no las
  dos** (doc de App Review de Instagram, 30/06/2026). La MaKo ya usa Facebook Login for
  Business, así que Instagram entra por ahí y exige página vinculada; «entrar con usuario de
  Instagram» sería una segunda app.
- **La verificación de acceso en curso ya cubre Instagram**: es una por negocio, y su lista
  incluye `instagram_basic` y `instagram_business_basic`.
- **`pages_manage_metadata` no puede seguir afuera del App Review**: lo exige TODA
  suscripción de webhook de página — DM de Messenger, comentarios, y el de leads en vivo.
- Los productos que faltan en la app: **Messenger** (con su parte de Instagram) e
  **Instagram → API setup with Facebook login**.

*09/10/2026 — investigación, sin tocar código.*

## `/comercial` ignora un rango que termina después de hoy, y el CAC acumulado no tiene «desde» (10/10/2026)

- **El rango con fin futuro se descarta en silencio.** `filtroActivo` exige `hastaParam <= hoyReal`
  (`app/comercial/page.tsx:164-170`); si no se cumple, la página vuelve a los últimos 30 días SIN
  AVISAR. Un rango de campaña con fecha de cierre (la ventana 1/11-15/12) no anda hasta que
  termina, y lo que se ve es otro período con cara del pedido.
- **El CAC acumulado es de todo el histórico.** `getCACAcumulado(hastaFecha?)` no recibe `desde`
  (`lib/queries.ts:701`): divide toda la pauta por todos los `cerro=true`. Un workspace con
  ganados que no vinieron por anuncios (ws9: 3 clientes cargados a mano, 0 pauta) muestra **CAC
  US$0** como dato. Y no saca los sin cobro, a diferencia de `lib/objectives-fuentes.ts`.

**Vive en:** `app/comercial/page.tsx:164-177,215` · `lib/queries.ts:701-739`.
*Corrida `wf_01c22b1b-91a`, 10/10/2026.*
