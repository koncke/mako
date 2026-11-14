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

## Lo prometido a Thiago: variar el botón, pausar el original y los videos de MaKo como anuncio (6/11/2026, nube)

**Vive en:** `lib/media-buyer/motor.ts` (`relevos`, `previaDeDecision`), `lib/media-buyer/variacion-boton.ts`,
`lib/media-buyer/variaciones.ts`, `lib/media-buyer/subir.ts`, `lib/media-buyer/creativos.ts`, `lib/media-buyer/campana.ts`
(`datosParaNuevaCampana`), `lib/anuncio-desde-pieza.ts`, `app/anuncio/nuevo/`, `app/api/anuncio-desde-pieza/route.ts`,
`app/_crear/usar-en-anuncio.ts`, `lib/api-mako/areas/ads.*`. Lo prometido, en docs/promesas/2910-llamada-thiago.md; el relevo,
en docs/relevo/nube-thiago-anuncios.md.

- **El relevo del original no es una táctica nueva, a propósito.** `app/ads-manager/mb-modelo.ts` tiene un
  `Record<Tactica, …>`: sumar una táctica rompe el tsc en una pantalla que esta tanda no podía tocar (la rehace el chat
  Marketing CoPilot). Vive en `ganador` con `tipo: 'pausar'` y `tactica: 'ganador'`. ⚠️ **La pantalla rotula esa decisión con
  los textos del ganador** («Anuncio ganador», «probar textos nuevos…»): hasta que Marketing CoPilot le dé su rótulo, la
  tarjeta dice una cosa y hace otra. El título y el porqué de la decisión sí dicen «Pausar el original…».
- **El relevo cuenta desde que se LANZÓ la variación, no desde que existe el anuncio.** Lo que lo sabe es la decisión aplicada
  con `creados` y `anuncioBase`, y la corrida y el vigía armaban su «previa» a mano SIN esos dos campos: el motor no podía ver
  ninguna variación lanzada. Ahora la previa sale de UNA función (`previaDeDecision`). Espera 7 días y 3 resultados de la
  variación, y gana con 20 % menos de costo por resultado que el original; si el original no tiene ninguno, gana si el original
  ya gastó su objetivo. No vuelve a proponer si después del lanzamiento ya se decidió (aplicada, deshecha o descartada) una
  pausa o un ganador sobre ese original, y Revive saltea lo que pausó el relevo: si no, lo vuelve a prender al otro día.
- **Variar el botón es una tabla, no la IA.** `variacionDeBoton` toma el botón del ganador y propone UNO: con formulario,
  «Registrarte» ↔ «Postularte»; a una página, «Más información» ↔ «Registrarte». Nunca WhatsApp ni «sin botón» (cambian a dónde
  va la gente, no cómo se le pide). ⚠️ `Autopilot.tsx` no pinta `v.cta`: la descripción va en `gancho`, que sí se ve. Los hooks
  de video saltean esa variación (es el mismo texto). Por Zernio, `cta_type` → `callToAction` del duplicado; sigue detrás de
  `ZERNIO_ANUNCIOS_PROBADO` (false hasta la prueba de Martín).
- **Un video de MaKo en «Subir creativos» viaja por su `ref`, nunca por su URL.** La URL pública del bucket `video-clips` la
  resuelve el servidor en el negocio (`resolverCreativoMako`), y se saca del payload de la pendiente antes de guardarla (un
  `url:` en el payload rompía `tests/media-buyer-subir-api.test.ts`, que lee sus claves, y además es lo que no se confirma). La
  clave de idempotencia es la ref (`mb-subir:<ws>:<decisión>:<ref>`): el path de un archivo de MaKo es vacío. `original` (el
  anuncio que el creativo viene a relevar) tiene que estar en el MISMO conjunto, y la API lo deja fijo al revisar.
- **«Usar en un anuncio» es una página (/anuncio/nuevo) y no un modal**, por dos fronteras: el diálogo de exportar del Image
  Editor NO es `'use client'` (no puede importar un valor de uno: tests/frontera-use-client.test.ts) y «Nueva campaña» vive en
  `app/ads-manager`. La ruta nueva `/api/anuncio-desde-pieza` NO va en `TAB_DE_API`: la llaman los editores, que no son la tab
  del Media Buyer, y `/api/media-buyer` sí está ahí (lib/api-tab.ts) y frena a quien la llame desde otra tab. Lo que la página
  manda es una PROPUESTA (`proponer_crear_campana`): lanzarla se confirma en /mako/revisar.
- **Un archivo del staging vence a las 6 horas** (el barrido de `firmarSubidaDeStaging`). Una propuesta con un archivo lo dice en
  su resumen («Confírmala antes de 6 horas»): confirmada después, Meta no encuentra el video.
- **No medido**: nada de esto se publicó en Meta desde la nube (no ve producción ni claves). Los tests corren el motor, la
  validación de la API y la ruta con dobles.

## El motor escribe «no trajo ningún agenda» y «de el conjunto»: los textos no conocen el género ni contraen (14/11/2026, SIN HACER)

- **Vive en** `lib/media-buyer/motor.ts` (Stop Loss, Sunsetting, Surf y el original contra su variación): `ningún ${nom.uno}`,
  `un ${nom.uno}`, `sin un solo ${nom.uno}` y `… cada uno.`. Con el KPI en agendas o ventas sale «no trajo ningún agenda», «lo que
  te cuesta un agenda en promedio», «trajo 9 agendas a US$ 31 cada uno». Con leads está bien, y por eso no saltó. Es lo que se lee en
  «Espera tu OK» y «Lo que hice» del Marketing CoPilot y en las tarjetas del Media Buyer.
- **Y «de el»:** Surf y Sunsetting arman el título con `de ${que}` (`Subir el presupuesto de`, `Bajar el presupuesto de`) y `que = 'el conjunto'`
  (`motor.ts`, ~563 y ~590): sale «Subir el presupuesto de el conjunto «Frío · Testimonio»». Es el TÍTULO de la decisión, lo
  primero que se lee en «Espera tu OK». Con una campaña («de la campaña») está bien.
- **La regla que falta:** `NOMBRE_RESULTADO` lleva el género (o el artículo) y los textos lo usan. El test: armar la propuesta de cada
  táctica con los tres KPIs y los dos niveles, y buscar «ningún agenda», «un venta», «de el» y «cada uno» después de un plural femenino.
- **Visto** armando la animación de la portada: el banco escribe esas frases a mano, ya en femenino. No es lo que sale hoy.

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
- ~~**El poll no dispara lo inmediato**~~ **HECHO el 17/10/2026 (tarjeta #868, Brigitte):** las dos puertas llaman a
  `alNacerLeadDeMeta` (lib/meta-lead-nuevo.ts: aviso, flujos y automatizaciones, por partes); el poll sólo con un lead
  creado en las últimas 24 h (`esNuevoParaElNegocio`). CAPI sigue sin salir por el poll, a propósito.
  ⚠️ **«La nutrición la levanta igual la cohorte del cron» era cierto sólo para los triggers de antes.** Una automatización
  de hoy cuelga de la ETAPA («Un Lead Entró» → «Lead entrante»), y su barrido toma a todo lead abierto de esa etapa con
  actividad en 90 días: no es «el lead nuevo». Medido el 17/10 en ws15: 16 leads en 14 días y CERO inscripciones en toda
  su historia (la de la etapa estaba pausada, y la que armó Joan en la llamada quedó en «manual», ver
  docs/hallazgos-chatbot.md).
*08/10/2026 — diagnóstico y refutación con subagentes, sólo lectura (scratchpad
`wf2-refuta-lead-brigitte/`). Commit `e869a24e`. **Verificado en producción:** el deploy
quedó listo a las 16:40 UTC, y la pasada de las 16:50 trajo a Jose (#2621) y a Nicolas
(#2622) al embudo 17 «Captacion Forms», con sus 5 campos. Nadie escribió nada a mano.*

### ⚠️ El mapa de México no pinta cero: pinta el estado equivocado — ARREGLADO el 11/10/2026

> **Corrección medida (11/10/2026, Graph v25.0, cuenta del ws1, 33 filas):** el mecanismo de abajo
> suponía que Meta manda «Mexico City», y en esta cuenta **no lo manda**: manda **«Distrito
> Federal»** y **«State of Mexico»**. Con el `startsWith` viejo los DOS quedaban en **CERO** (no se
> mudaba el valor al vecino), y son los estados con más impresiones de la cuenta (36.817 y 45.415).
> «Coahuila de Zaragoza», «Michoacán de Ocampo» y «Querétaro Arteaga» calzaban de casualidad por el
> prefijo; también llegan «San Luis Potosi» (sin tilde) y «Unknown». Y con `breakdowns=region` Meta
> **no manda ninguna conversión de afuera** (ni la agenda ni `landing_page_view`, 0 de 33 filas): la
> pestaña «Agendas» del mapa siempre pintó México vacío por eso, no por los nombres.
> Arreglado con un diccionario explícito nombre → código ISO (`MX-CMX`…) e igualdad exacta; lo que no
> se ubica se cuenta aparte. «Mexico City» quedó igual como alias. **Ahora vive en:**
> `app/dashboard/MapaMexico.tsx` (`ESTADOS`, `ALIAS`, `ubicarRegiones`), que montan el Dashboard y
> `app/marketing/ad-charts.tsx`. El detalle, en [hallazgos-graficos.md](hallazgos-graficos.md) → «La
> audiencia de Meta». Lo de abajo queda como el diagnóstico de agosto.

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

**Medido el 11/10/2026** (ver la corrección de arriba): los nombres salieron de una respuesta
real. Sigue pendiente: `GEOURL` es un `fetch` a `raw.githubusercontent.com` desde un componente
cliente — conviene bajar el GeoJSON (184.555 bytes) a `public/`.

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

### La biblioteca de estructuras era «de anuncios» sin decirlo, y un override la pisa entera (28/10/2026)

**Síntoma posible:** sumar a `ESTRUCTURAS_GUION_DEFAULT` las estructuras de reel y story del Copywriter las ponía en la
matriz del Ads Writer, en su API y en el estructurador de guiones pegados; y un negocio con la biblioteca ya editada en
/admin/guiones no las iba a ver nunca.

**Causa:** `getEstructurasGuion` lo leen cuatro lugares que suponen «estructura = anuncio» (lib/razones.ts,
lib/guion-estructurar.ts, la API de MaKo de contenido y el onboarding de razones). Y el override de
`mako.guion_estructuras` PISA los defaults por completo: lo que se suma de fábrica después de guardarlo no llega.

**Cómo quedó:** `EstructuraGuion.tipos` (sin el campo = anuncio). `getEstructurasGuion` devuelve `soloDeAnuncios`;
`getEstructurasTodas` es para el Copywriter y el editor del super admin. Al override se le suman al final las de orgánico
de fábrica que no conoce (`conLasDeOrganicoNuevas`); las de anuncios no, porque el super admin pudo borrar una a
propósito. Para sacar una de orgánico, se apaga.

**Regla:** un catálogo con override que pisa todo necesita una regla para lo NUEVO de fábrica. Y si un catálogo pasa a
servir a otra cosa, el getter de siempre sigue devolviendo lo de antes y lo nuevo va con otro nombre.

**Vive en:** lib/guion-estructuras-store.ts · lib/guion-estructuras.ts (`soloDeAnuncios`) · tests/copywriter-tipos.test.ts ·
*2026-10-28 copywriter*

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
| dueno@negocio-uno.com | usuario | 1 | **sí** (admin del ws1) |
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
ws11, ws13 y ws14 tienen UNA página cada una (ws13 y ws14 con @cuenta.ws13.demo; ws1 sin
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
| 1, 4 | «Leads - Dashboard MKT (Martin)» (954456647632371), la de MaKo, **Modo: Publicada**, negocio **Elévate** | 10 | `act_564003520636790` + página «Mauricio», las dos de **Elévate** (341119389591872). ws4 «Cliente de Diseño» comparte token y activos con ws1 |
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
  resuelve 200, pero es otro dominio— y `contact_email: ejemplo.ws1.mako@gmail.com`. Con **App
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

### Medido el 14/10/2026: a dónde va hoy «¿Era calificado?», y dos cuentas donde no iba a ningún lado

Lo pidió Martín al mover «¿Era calificado?» a Resumen (13/10): *«¿Cómo el usuario alimenta X pixel, o
X evento del pixel? Tal vez deberíamos hacer configurable esto»*. Medido en la base (sólo lectura):

- **Ningún workspace tiene `META_CRM_DATASET_ID`**, así que todo va al píxel del sitio, como
  `SubmitApplication` (estándar: Meta optimiza sin que nadie declare nada) y `QualifiedLead` (el
  nombre propio, para medirlo), con el mismo `event_id` y `action_source: system_generated`.
  Lo hacen ws1, ws4, ws13, ws14 y ws15.
- **ws9 y ws11 tienen el token y NINGÚN píxel** (`META_PIXEL_ID` es `auto`, y para ellos MaKo no
  encontró uno). Lo que se marcaba ahí —ws11, 3 cambios de «calificado» en 30 días— **no salía**, y
  no quedaba rastro: `sin_pixel` no va al historial de cada lead a propósito (no es noticia de ESE
  lead). Mientras tanto la tarjeta afirmaba *«Meta aprende de esto para traerte leads parecidos»*.
- **Ningún rechazo de Meta registrado** (`lead_audit`, campo `Meta`): lo que sale, entra.

**La regla que queda: lo que la pantalla afirma sobre un envío sale de la MISMA función que decide
el envío.** `destinoYToken` lo leen `sendMetaCAPIEvent` y `adondeVaLaCalificacion`, y el veredicto
es `adondeDe` (puro, con test). Con la base caída la ficha no acusa a nadie: una sonda estricta
devuelve null y la tarjeta dice lo de siempre.

**Lo que NO se hizo, y es de Martín:** elegir el evento a mano. El nombre del evento no es lo que
mueve la aguja: lo que hace que Meta busque leads que califiquen en un formulario instantáneo es el
**conjunto de datos de CRM** («Conversion leads»), y no lo tiene nadie. Si se hace configurable algo,
es «a qué conjunto de datos», y eso ya es un campo de Integraciones → Meta.
**Vive en:** `lib/meta-capi.ts` · `lib/meta-capi-payload.ts` · `app/crm/lead-view/CalificacionCard.tsx` ·
`tests/calificacion-adonde-va.test.ts`

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
tiene que decidir Martín.

⚠️ **Corrección del 14/10/2026: el choque ya no existe.** El mismo 06/10, horas después
(`f26c0a94`, migración 0207), un lead pasó a poder estar en VARIOS productos: su casa en
`leads.funnel_id` y una fila de `lead_funnel` por cada otro (`agregarAProducto`,
`lib/lead-funnel.ts`). Lo que sigue siendo cierto es que la entrada de leads de Meta resuelve
UN producto (`funnelIdDeCampana`) y no llama a `agregarAProducto`: «múltiple» ya no cambia el
modelo del CRM, sólo esa entrada. La decisión sigue siendo de Martín. El default por si la cuenta tiene un solo producto SÍ está: la
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

> **Actualización del 13/10/2026:** la 0215 **está aplicada** (columna `idem_key` e índice
> `uq_meta_campaign_drafts_idem` en producción, medido el 10 y el 13/10), así que el «Reintentar
> es seguro» ya es cierto. Lo que sí sigue: **0 de 19 borradores tienen clave**, o sea que
> todavía no pasó una publicación real por ese camino.

**Cómo se verificó:** typecheck en 0; `npm test` 4510 de 4510; diecisiete roturas a propósito,
todas cazadas (los números van en cada test); y en el navegador —dev server con
`ZERNIO_API_KEY= ELEVENLABS_API_KEY=`, el log dijo sólo «hidratadas», ws9, con la subida y
campaign-create simulados y todo otro POST abortado: ninguno llegó a una ruta real— 20 de 20:
la tarjeta dice «Procesando» y no «0%», Siguiente queda apagado hasta 'ready', el borrador
retoma la espera de SU video y descarta el ítem cortado, un borrador viejo sin clave publica,
el reintento después de una respuesta perdida manda la MISMA clave, y editar el nombre en la
revisión la cambia.

**Sin hacer:**

- ~~**Aplicar la 0215**, antes del deploy.~~ Aplicada (medido el 10 y el 13/10/2026).
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

**Arreglado el 11/10/2026 en `/comercial` y `/marketing`** (la misma condición estaba en las dos):
un `hasta` posterior a hoy se ACOTA a hoy, con el mismo criterio que `/graficos`. Medido con
`?desde=2026-10-01&hasta=2026-12-15` en el ws1: las dos pantallas dibujan desde el 01/10 y ya no
vuelven a 30 días. **Sigue igual:** `app/ads-manager/AdsManagerView.tsx` (misma condición
`hastaParam <= hoyReal`) y el CAC acumulado sin «desde».

## Ads Analyst se mudó a Ads Writer: `force` no es «reintentar» (11/10/2026)

**Vive en:** `lib/ads-analyst.ts:522-575` (con `getVideoTranscripts`, que ordena por `ad_id`, :468),
`app/ads-writer/AnalizarGuion.tsx`

- **Con `force`, todos los transcripts pasan a candidatos y se corren los primeros 6 por `ad_id`:
  siempre los mismos seis, cobrando cada vez.** Los pendientes pueden no tocarse nunca, y reclasificar con
  ángulos nuevos no llega al resto. Sin `force` ya se reintentan los que tienen error o están pendientes.
  En la tab, el «Actualizar igual» del caso «recién sincronizado» mandaba `force`. Ahora sólo lo manda con
  todo al día y sin errores, y avisa que gasta IA. **SIN HACER:** que `force` avance más allá de los seis
  (la lib no es de ningún paquete).
- **La copia de `verdictFromVals` en `lib/api-mako/areas/ads.run.ts` no se puede cambiar por el import**
  de `lib/ads-analyst-patrones` como sugiere su cabecera: las claves son distintas (`reescribir` contra
  `reescribir_cuerpo`) y rompería lo que ya lee la API.
- **Una vista que el server manda sólo cuando su `?tab=` la pide se desmonta al cambiar de vista** y se
  pierde lo escrito, salvo que el cliente guarde el último nodo que llegó.
- **Quedaron sin montar** el componente `ScriptsBrowser` y `GuionesFull` (`app/ads-analyst/`). El
  archivo no se puede borrar entero: `app/marketing/ad-charts.tsx` importa de ahí `FunnelModal`,
  `applyAngles` y `applyAvatares`. Mudar eso y borrar el resto es una decisión aparte.

*11/10/2026, chat «Graphics», paquete P3 de la tanda v4 del Dashboard (commit `6e85d8d7`).*

## El Autopilot: lo que el relevamiento encontró antes de dejar que una IA mueva plata (14/10/2026)

**Vive en:** `lib/queries.ts` · `lib/meta-write.ts` · `lib/meta-health.ts` · `lib/api-mako/areas/ads.run.ts` · `lib/api-mako/flujo.ts` · `app/api/cron/meta-daily/route.ts` · `app/video-generator/video-action.ts`

El punto 18 del feedback del 13/10 (la IA que maneja el Ads Manager sola) se diseñó en
[diseno-ads-autopilot.md](diseno-ads-autopilot.md). Antes de escribirlo, un relevamiento de 6
lectores midió con qué datos se podía decidir y por dónde se escribía. Esto es lo que sirve
después, y la mitad es lo contrario de lo que se suponía.

**Lo que se creía y no era:**

- **«El veredicto Recon ya dice qué escalar.»** No en una cuenta con presupuesto de campaña
  (CBO): el conjunto tiene `adset_budget_daily` en NULL, se lee como 0, y el ritmo da
  ✗ siempre. Así, todo anuncio con 10 leads o más sale «falso positivo» y nunca «validada»
  (`lib/queries.ts:1718`, `:1785`, `:1801`; `lib/meta-ads.ts:543-547`). Una IA que escale lo
  «validado» no escala nunca en CBO.
- **«La herramienta de rendimiento de la API de MaKo trae los leads del CRM.»** Trae
  `leads_meta` = la CONSTANTE 10 (`RECON_LEADS_VALIDACION`) y `leads_crm` = los leads de Meta
  (`lib/api-mako/areas/ads.run.ts:381` sobre `lib/queries.ts:1813-1814`). Un modelo que decide
  con eso decide con un campo inventado. **Bug vivo, sin arreglar al escribir esto.**
- **«Hay datos para un tope de gasto por día.»** No hay un solo dato de hoy en la base:
  `meta-daily` corre una vez (13:00 UTC), trae AYER en Tijuana para todas las cuentas y nunca
  vuelve sobre días anteriores (`app/api/cron/meta-daily/route.ts:55`). Lo de hoy sólo se lee
  en vivo (`app/api/entity-insights/route.ts`). Por eso el tope del Autopilot es un techo de lo
  PRESUPUESTADO, no de lo gastado.
- **«Pausar lo que gasta sin leads es seguro.»** Sólo si «leads» incluye el CRM: los leads de
  una landing no traen `meta_ad_id` (9 de 114 agendados del ws1 lo tienen), y el cruce por
  `utm_content` (`adIdDeLead`, `lib/atribucion-url.ts`) no lo usa `getSenalesRecon`. La regla
  vieja de «apagar» apagaría el anuncio que trae las reuniones.
- **«validate_only valida.»** Sobre `adcreatives` dio success para algo que el anuncio rechazó
  después (`docs/hallazgos-ads.md`, la medición del 1885499), y sobre una ACTUALIZACIÓN de
  status o presupuesto no hay ninguna medición. El Autopilot lo usa para FRENAR, nunca como
  prueba de que la escritura va a pasar.
- **«Prender o apagar no es plata.»** Activar está declarado `costo: 'externo'` aunque enciende
  gasto (`lib/api-mako/areas/ads.def.ts:384-411`), así que un token detallado lo escribe en el
  acto. Y un paso «⚡ Acción» de un flujo puede correr `proponer_presupuesto_*` sin un «sí» y
  sin tope (`lib/api-mako/flujo.ts`: `aplicarEnElActo` no mira el costo). Es del núcleo de la
  API, ya anotado en `docs/hallazgos-planes-y-cobro.md`.
- **«Las variaciones de hook se generan solas.»** No desde el servidor: el que filma es el
  navegador del cliente (extensión + pestaña de Flow abierta), las acciones de video exigen
  sesión (`ctxAdmin` en `app/video-generator/video-action.ts`), avanzar una toma lo hace la
  PANTALLA cada pocos segundos, el historial del generador topea en 10 planes, y el worker de
  montaje nunca corrió (2 trabajos pendientes con 0 intentos). «Content Machine» es el nombre
  de la familia del sidebar, no un pipeline.

**Las trampas para quien escriba un motor que mueve plata acá:**

- **El presupuesto «actual» del árbol cacheado puede tener cualquier edad** (stale-while-revalidate
  y `metaWrite` no lo invalida). El `antes` de una decisión se lee EN VIVO, y se vuelve a leer
  antes de escribir: si cambió, la decisión vence.
- **`aUsdNum` devuelve el monto crudo con etiqueta USD** si la moneda no tiene tasa, y divide por
  17,3 si es desconocida (`lib/presupuesto-cambio.ts:93-101`). Para decidir, `aUsd` (null sin
  tasa) y abstenerse. Sólo USD y MXN tienen tasa.
- **Una propuesta de `propuestas` no vence nunca** y su `resumen` se corta a 300 caracteres; el
  `reversible: true` del presupuesto es una promesa sin el valor anterior guardado. Por eso el
  Autopilot tiene su propia tabla con `antes`, `despues`, `porque` y `vence_at`.
- **Lo que propone un cron por el canal `app` no dispara push** (`lib/mako-pendientes.ts:86`,
  `lib/propuestas.ts:149`): sin un aviso propio, una propuesta de madrugada espera sin que nadie
  se entere.
- **Si `listarWorkspaces` falla, `correrRonda` corre sólo el ws1** (`lib/cron-workspaces.ts:93-97`),
  que es un cliente. Un motor que escribe exige su propia config por workspace para no actuar ahí.
- **El ws3 llegó a tener la misma cuenta publicitaria que el ws1** (commit `5b3ad721`, 13/08). Un
  motor por workspace actuaría dos veces sobre la misma cuenta con los parámetros del cliente de
  prueba: el cron saltea las cuentas repetidas.
- **`/api/cron/plan-recurvar` no tiene autenticación** (es la única ruta de `app/api/cron` sin
  `checkCronAuth`), y todo `/api/cron` es público por prefijo. Quedó como tarea aparte.

*14/10/2026, cuenta 2 (claude2), chat «Ads Manager», relevamiento `wf_2c9a91f5-f46`.*

## El pop-up del anuncio con el período «Todo»: Meta guarda 37 meses y un `since` más viejo es un ERROR (17/10/2026)

**Síntoma (#876, llamada Mau <> Martín del 16/10, 53:01):** Martín crea la hoja Ads Analyst en el ws1, abre un anuncio
ganador de la portada y dice que algunos datos los trae y otros no los está leyendo. El video y el guion
estaban; los números, el diario y la audiencia, no.

**Lo obvio era mirar la hoja, y la hoja estaba bien:** medidos los 13 gráficos de la plantilla contra el ws1 con el lector
de verdad, todos traen dato (89 guiones, hook rate 32 %, costo por agenda US$76). Lo que fallaba era el POP-UP: lee a
Meta en vivo (`/api/ad-insights`) con el período del gráfico que lo abrió, y Ads Analyst va con «Todo», que arranca el
2020-01-01. Meta contesta `#3018 The start date of the time range cannot be beyond 37 months` (medido el 17/10 con un
anuncio del ws1: desde 2023-09-18 contesta, desde 2023-09-16 no). El creativo y el guion salen de nuestra base: por eso
«algunos datos sí».

- La regla ya existía para los gráficos de audiencia (`desdeQueGuardaMeta`, desde el 11/10), pero vivía adentro de
  lib/graficos-audiencia.ts y las otras tres lecturas con período libre la ignoraban: /api/ad-insights,
  /api/entity-insights (campaña o conjunto) y lib/meta-desgloses.ts (los desgloses de la cuenta del Ads Manager).
- Ahora vive en **lib/meta-rango.ts** (`timeRangeMeta`) y tests/meta-rango.test.ts barre TODO `time_range` del repo:
  uno armado a mano falla. La única excepción es la sincronización diaria (lib/meta-ads.ts pide un día).
- El total con «Todo» es el de lo que Meta guarda (37 meses), no el histórico: más atrás no hay nada que traer.

**Nadie lo miró en pantalla.** Después del deploy: ws1, una hoja Ads Analyst, clic en un anuncio de «Tus anuncios
ganadores»: tienen que aparecer los números, el diario y la audiencia.
**Vive en:** lib/meta-rango.ts · app/api/ad-insights/route.ts · app/api/entity-insights/route.ts · lib/meta-desgloses.ts.
*17/10/2026, claude4 (chat Dashboard).*

## ¿Se puede corregir una calificación que ya viajó a Meta? No: lo que se manda por CAPI no se borra ni se edita (#856, 17/10/2026)

**La pregunta (revisión del 16/10):** el CRM daba por hecho que «no se deshace» (docs/api-mako-inventario.md), sin
fuente. Se buscaron las tres salidas posibles en la documentación OFICIAL de Meta, y ninguna corrige:

- **Borrar o editar el evento:** la API no lo ofrece. Ni «Using the API», ni los parámetros del evento de servidor, ni
  los de `custom_data` mencionan borrar, actualizar o corregir un evento ya enviado.
- **Otro evento («Lead descalificado»):** en Conversion Leads el `event_name` es libre («Free form field to capture
  the stages you use within your CRM») y piden mandar cada etapa cuando cambia. Mandar una etapa nueva SUMA una señal;
  no resta la anterior, y la página no dice nada de un lead que vuelve para atrás.
- **Un valor negativo:** `value` es «A numeric value associated with the event. This must represent a monetary
  amount», obligatorio para compras y optimización por valor. No hay ninguna mención de valores negativos ni de
  reembolsos; no es un mecanismo de corrección.
- **El dedup por `event_id`:** sólo descarta un DUPLICADO del mismo par (`event_name`, `event_id`), y se queda con el
  PRIMERO («we only consider the first one»). Reenviar con el mismo id no pisa nada: se descarta el nuevo.

**La trampa que sale de esto (lo que corrige un comentario del código):** la ventana del dedup es de **48 horas**
(«events are only deduplicated if they are received within 48 hours»). `eventIdCalificado` (lib/meta-capi-payload.ts)
cubre marcar → desmarcar → marcar dentro de esas 48 h; pasado ese plazo, volver a marcar a un lead es una SEGUNDA
conversión. Y la página de deduplicación describe el `event_id` para el par navegador + servidor; para dos eventos de
servidor sólo dice, en el método por FBP, «If you send us two consecutive server events with the same information, we
do not discard either». O sea: el dedup entre dos envíos nuestros es lo esperable, no una garantía escrita.

**La regla que queda:** lo que viaja a Meta es definitivo. El «Deshacer» del CRM vuelve la ficha atrás, pero la
conversión ya contó. **Hecho el 17/10 (chat «Pendientes B2»):** el envío espera 8 s (el toast del «Deshacer» dura 5), relee el lead
y manda sólo si sigue calificado; la marca de «ya se mandó» es una línea del historial del lead, sin columna (detalle en
docs/hallazgos-crm.md, «Los pendientes del CRM del 17/10», punto 7).

**Fuentes (Meta for Developers, leídas el 17/10/2026):**
[Deduplicación](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events) ·
[Parámetros del evento de servidor](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event) ·
[custom_data](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/custom-data) ·
[Conversion Leads: payload](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/payload-specification) ·
[Using the API](https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api)

*17/10/2026, chat «CRM» (claude4).*

## Reproducir un anuncio sin salir de la hoja: la vista previa de Meta NO sirve, el `embed_html` del video sí (17/10/2026)

**El pedido (#860, revisión del 16/10, 1:14:00):** en «Los anuncios que más te traen» la miniatura cortaba la cara (iba
4:3 y los anuncios son verticales) y «debería poder reproducirse ahí mismo» en vez de abrir Meta en otra pestaña.

**Lo medido contra Meta (un anuncio del ws1, sólo lectura):**

- `GET /{video_id}?fields=source` sigue sin `source` (la entrada de arriba): no hay un .mp4 propio que poner en un `<video>`.
- **La vista previa del anuncio parecía lo obvio y es la equivocada:** `/{ad_id}/previews?ad_format=INSTAGRAM_REELS`
  devuelve un iframe de `business.facebook.com/ads/api/preview_iframe.php` que, SIN sesión de Facebook, contesta **400** y
  **`X-Frame-Options: DENY`**. En Ads Manager anda porque quien mira está logueado; a un cliente no le carga.
- **`embed_html` del video** es un iframe de `www.facebook.com/plugins/video.php` que sin sesión contesta 200, **sin**
  `X-Frame-Options`, y trae las URLs del .mp4 adentro (`sd_src`/`hd_src`). Ojo: el HTML contiene «Unavailable…» (es el
  nombre de un recurso de su JS, `UnavailableResources`), y buscar «unavailable» da un falso «no disponible».
- Los formatos del video confirman el vertical: `native:1080x1920`.

**Cómo quedó:** /api/anuncios/video (la puerta de Ads, el token del workspace) devuelve el src del plugin, validado por
host y ruta (`srcDelReproductor`, lib/anuncio-video.ts: sale de una respuesta de un tercero y va a un iframe de la app).
Las tarjetas de anuncios llevan un ▶ que lo abre en una ventana vertical (app/dashboard/graficos/ReproductorAnuncio.tsx),
sólo con sesión y mirando; en un link compartido no hay ▶ (la ruta pide sesión). La miniatura de la portada es un póster
9:16 de alto fijo.

**Nadie lo miró en pantalla:** que el plugin REPRODUZCA dentro del iframe se dedujo de la respuesta (200, sin
`X-Frame-Options`, con los .mp4), no se vio en un navegador. Después del deploy: ws1, General con la plantilla «Anuncios»,
▶ en un anuncio. Si no reproduce, el siguiente intento es bajar el .mp4 de `sd_src` del lado del server.
**Vive en:** lib/anuncio-video.ts · app/api/anuncios/video/route.ts · app/dashboard/graficos/ReproductorAnuncio.tsx ·
app/dashboard/graficos/Tarjetas.tsx · app/dashboard/editor-css.ts.
*17/10/2026, claude4 (chat Dashboard).*

---

## Los pendientes del 17/10 (B4): lo que no se ve leyendo el código

*Corrida «Implemente todos los pendientes al 100%», agente B4 (Ads y plata), 17/10/2026, rama `pend-b4-1710`.*

### «meta_leads» es la META de leads, no «los leads de Meta»: MaKo le inventaba el dato al cliente

- **Síntoma.** `ver_rendimiento_anuncios` (la API de MaKo) devolvía `leads_meta: 10` en TODOS los anuncios, y
  `leads_crm` igual a lo que reportaba Meta. Un cliente que le preguntaba a MaKo por sus anuncios recibía un número fijo.
- **El diagnóstico obvio era el equivocado: «la sincronización de leads de Meta está rota».** No: `SenalRecon.meta_leads`
  es la **meta** (la vara `RECON_LEADS_VALIDACION` con la que un anuncio se da por validado; las tarjetas la pintan
  «leads / meta»), y `SenalRecon.leads` es el `leads_count` que reporta Meta. La API leyó la palabra «meta» como Meta.
- **La regla.** El renglón lo arma `filaDeRendimiento` (lib/ads-rendimiento.ts, puro): `leads_meta` = lo que reporta Meta,
  `leads_crm` = los que ENTRARON al CRM desde ese anuncio en el rango (`bajadaCrmPorAnuncio`, por `created_at` en UTC), y
  la vara va aparte como `meta_leads_para_validar`. Las agendas se llaman `agendas_meta` (son las de Meta).
- **Vive en:** lib/ads-rendimiento.ts · lib/queries.ts (`getSenalesRecon`) · lib/api-mako/areas/ads.run.ts ·
  tests/ads-rendimiento-leads.test.ts.

### Sin un negocio elegido, el super admin operaba la cuenta de Mauricio

- **Síntoma.** Abrir /ads-manager sin el `?ws=` y pausar, represupuestar o borrar tocaba las campañas del ws1.
- **Causa.** `wsQuePuedeOperar` (lib/ads-guard.ts) caía a `OWNER_WS` cuando el super admin no tenía negocio resuelto: «la
  agencia sin workspace opera el ws1, como siempre». Ese contrato es de cuando MaKo era el dashboard de su agencia. Y
  `credWs` sin workspace también cae al ws1, así que la LECTURA mostraba su cuenta como «la» cuenta.
- **La regla.** Sin negocio no se opera ninguna cuenta: las rutas contestan 409 «Elige primero el negocio» y la página lo
  dice antes de leer Meta. No se cae a la plataforma (ws9) tampoco: elegir es explícito.
- **Vive en:** lib/ads-guard.ts (`SIN_NEGOCIO`, `adsSinNegocio`) · app/ads-manager/AdsManagerView.tsx ·
  tests/ads-guard-sin-negocio.test.ts.

### Código Inmobiliario, P2P y Leila: medido el 17/10, nadie reconectó

Leído con `debug_token` (sólo lectura, sin imprimir tokens): **ws13 y ws14 siguen con «Joan P2P app»
(2300908653979362)**, la misma app de los 14 rechazos 1885183 del 11-17/09 (tokens guardados el 18/08 y el 04/09), y
**ws11 con «Lidermente_Agent» (1003134039095160)**, guardado el 31/07; los tres SYSTEM_USER, válidos y sin vencimiento.
`meta_campaign_drafts`: el último intento de ws13 es del 17/09 (error) y ws11/ws14 nunca publicaron desde MaKo.
**Conclusión:** un creativo NUEVO (`object_story_spec`) sigue dando 1885183 hasta que esa app pase a «Publicada» o
conecten con la app de MaKo (que espera el App Review); **reusar un post existente sí pasa** (la salida de «Usar un
ganador»). Qué modo tiene la app de un cliente no lo dice `debug_token`: lo dice una corrida en seco
(`validate_only`) sobre SU cuenta, y eso lo decide Martín.

**Medido de nuevo el 23/10 (sólo lectura), igual que el 17/10:** ws13 y ws14 con «Joan P2P app», válido y sin
vencimiento, el mismo token (guardado 18/08 y 04/09) sobre la misma `act_1357728489423123`. El último intento de
publicar desde MaKo sigue siendo del 17/09 (error); ws14 nunca intentó. Mientras tanto, Joan armó campañas **en Meta
directo** (la última, «P2P | TEST CALIDAD | OCT26», el 15/10). El token del botón «Conectar con Meta» de MaKo sigue sin
permisos de anuncios (vigía de las 15:49 del 23/10: «ninguno»), así que **reconectar con la app de MaKo todavía no
arregla publicar**. Lo más corto a probar es que Joan pase «Joan P2P app» a modo Activo, pero **es dudoso que alcance**
(ver «Meta mientras se aprueba la app de MaKo», 23/10).

### Editar el público por la API: la superposición tenía que vivir en el SERVER

- **Qué faltaba.** `POST /{adset}` con `targeting` REEMPLAZA el objeto entero y la superposición vivía sólo en el
  navegador, así que la API no podía editar un público (un parámetro parcial borraba intereses, idiomas y lugares).
- **La regla.** Una sola función pura, `aplicarCambiosDePublico` (lib/publico-cambios.ts): lo que no viene NO se toca,
  `null` lo saca, y Advantage+ en 0 sin ninguna señal fina va en 1 (Meta lo rechaza). La usan el editor del navegador y
  `editarPublicoConjunto` (lib/meta-ads-create.ts), que lee el crudo con la cuenta comprobada. La API es
  `proponer_editar_publico_conjunto`, con confirmación en PANTALLA y el conjunto fijo al revisar.
- **El pin (decisión 2 del relevo, tomada: la opción (a)).** Se pegan coordenadas o el link LARGO de Google Maps
  (`pinDesdeTexto`, lib/meta-geo.ts: `!3d…!4d…` le gana a `@lat,lng`); el link corto (maps.app.goo.gl) no trae el punto y
  se dice, en vez de ofrecerlo como una calle. Sin librería, sin proveedor y sin tocar la CSP: no hay vista previa del
  mapa. Por la API, `pinLat`/`pinLng`/`pinRadioKm` SUMAN un punto a los lugares que ya tenía.
- **Vive en:** lib/publico-cambios.ts · lib/meta-geo.ts (`pinDesdeTexto`, `esLinkSinCoordenadas`) ·
  lib/meta-ads-create.ts · app/ads-manager/EditarPublicoModal.tsx · app/ads-manager/LugarPicker.tsx ·
  lib/api-mako/areas/ads.{def,run}.ts · tests/publico-api.test.ts.

### El árbol de Meta: un tag POR NEGOCIO, y la escritura lo expira

- **La cura que estaba anotada** («El árbol de Meta que leen las guardas puede tener CUALQUIER edad»): `getMetaHealth` ahora
  lleva, además de `TAG.marketing`, `metaHealth:ws:N` (`tagArbolMeta`), y `metaWrite` lo expira con
  `revalidateTag(…, { expire: 0 })` después de una escritura que salió bien (`expirarArbolMeta`). La clave de la caché es
  la misma: no se pierde nada cacheado. `presupuestosVigentes` sigue: una lectura que arrancó antes de escribir puede
  terminar después.
- **Vive en:** lib/meta-health.ts · lib/meta-write.ts · tests/ads-arbol-cache.test.ts.

### «Conectar con Meta» avisa al conectar si faltan los permisos de anuncios

El callback lee `/me/permissions` después de guardar la conexión; sin `ads_read` o `ads_management` vuelve con
`sin-permisos` y el formulario lo dice. Best effort: si Meta no contesta, «Conectado» como siempre.
**Vive en:** app/api/integraciones/meta/callback/route.ts · lib/meta-permisos.ts (`permisosDeAnunciosFaltantes`) ·
lib/meta-login.ts · tests/meta-permisos-conectar.test.ts.

### Las decisiones 4 a 6 del relevo, tomadas (no se re-preguntan)

- **La barra de lote queda OSCURA.** Martín pidió radio y orden, no color; pasarla a clara es reestilar sus controles
  sin poder mirarlos, y una barra que aparece al seleccionar marca el cambio de modo.
- **El ícono de ojo del chip «Con problemas» queda** (la regla de no usar emoji).
- **La publicación a medias** sigue diciendo «Quedó a medias en Meta… revísalo en la tabla»: la tabla es donde se ve qué
  quedó, y la misma clave contesta igual hasta que cambie el pedido.

## La revisión de la app MaKo nunca se envió, y por qué todavía no se puede (21/10/2026)

- **Síntoma:** Martín creía que Meta tardaba en aprobar la app MaKo (2586146911825340). En el panel, la Revisión de la
  app dice **«Sin enviar»**. Lo que está en la cola de Meta es otra cosa: la **verificación de acceso** (proveedor de
  tecnología), enviada el 08/10 a las 04:23, sin pedidos de Meta y con plazo hasta el **20/12/2026** (antes decía 07/12).
- **Qué traba el envío:** cada permiso pide una descripción, un video (7 de los 9 lo piden) y al menos una llamada exitosa
  a la API en los últimos 30 días. El 21/10, en Revisión → Tests, `business_management`, `ads_read` y `ads_management`
  estaban en **0 de 1**.
- **Por qué las llamadas no salían del producto:** el token del botón «Conectar con Meta» (inicio de sesión para
  empresas, usuario del sistema) sigue saliendo **sin** esos tres permisos. Medido de nuevo el 21/10 en el ws9 con
  `/me/permissions`.
- **Lo que destrabó las llamadas:** en el **Explorador de la API Graph**, con la app MaKo elegida y un token de USUARIO de
  Martín, Meta sí concede los tres. Cinco GET de lectura (`me/adaccounts`, `act_…/campaigns`, `me/businesses`,
  `act_…/insights`) cuentan como las llamadas de prueba. Tardan hasta 24 h en verse y valen 30 días. El diálogo de
  Facebook que abre el Explorador es un popup fuera del grupo de pestañas de Claude: lo acepta Martín.
- **Lo que esto dice de la hipótesis del 08/10:** la app puede dar los permisos de anuncios. Lo que no los da es el token
  de usuario del sistema del inicio de sesión para empresas. Sigue siendo lo más probable que lo destrabe la
  verificación de acceso, pero ya no es la única explicación posible.
  **Medido otra vez el 21/10 a las 12:50:** reconexión nueva del ws9 con «Conectar con Meta» (portafolio MaKo, página
  Hola MaKo, cuenta publicitaria MaKo). El token sale otra vez con páginas y leads, y sin `ads_management`, `ads_read`
  ni `business_management`. La tarjeta dice «Conectó sin permisos de anuncios. Reconecta y acéptalos», pero reconectar
  no lo arregla: con la verificación de acceso en revisión, Meta no los da a este tipo de token. Por eso los videos
  de los permisos de anuncios no se pueden grabar con el producto hasta que Meta conteste.
- **La regla:** «en revisión» se mira permiso por permiso en el panel (Revisión → Tests y Revisión de la app), no en la
  memoria. Un borrador sin enviar se ve igual que una revisión en curso si nadie entra a mirar.
- **Una revisión en curso BLOQUEA la siguiente (medido el 23/10).** Con la primera tanda «Revisión en curso», «Añadir a
  la revisión de la aplicación» sobre `ads_management` contesta: «Esta solicitud ya está pendiente de revisión… puedes
  cancelar la solicitud y enviar una nueva o esperar hasta que se complete la actual». Partir los permisos en tandas
  no adelanta nada: la segunda espera a que se resuelva la primera, o se cancela la primera y van juntos.
- **Lo que quedó SIN hacer:** los videos y textos de cada permiso (los de anuncios necesitan el botón dando los
  permisos), «Tratamiento de datos» e «Instrucciones para revisores», y el envío, que **no se edita ni se cancela**. Si
  la verificación de acceso no se mueve, el camino es un caso en Meta Business Support con la fecha y el ID de la app.
  Mientras tanto, cada cliente nuevo conecta con una app propia: ya son seis (ws11, 13, 14, 15, 18, 19).
- **La revisión entra por el ws3 («Cliente de Prueba»).** El botón «Conectar con Meta» se le mostraba sólo al super
  admin, y el revisor de Meta entra con una cuenta de prueba de MaKo: no lo habría visto. Ahora
  `WORKSPACES_DE_REVISION = [3]` (lib/meta-login.ts) lo ofrece en ese negocio a cualquier admin del negocio. La regla
  es pura (`botonMetaVisible`) y `conectarMetaDisponible` le pasa el negocio activo. El resto del camino no tenía otra
  guarda de super admin: el paso 1 pide admin del negocio, el callback acepta admin del negocio
  (`puedeEscribirAgenda`) y elegir la cuenta y guardar van por negocio.
- **Cuando la app quede aprobada, la constante SE DEJA.** Con `META_OAUTH_ABIERTO=true` no cambia nada, y cada permiso
  nuevo (Instagram, Messenger, `pages_manage_metadata`) es otra revisión que va a entrar por el mismo negocio. La
  cuenta del revisor la crea Martín, adentro del ws3: sumada desde el negocio de la plataforma queda super admin, y el
  super admin pide 2FA siempre.
- **El negocio de revisión tiene que tener el onboarding terminado.** Con el onboarding pendiente, `/integraciones?ws=3`
  redirigía al chat de onboarding («¿cómo te llamas?»): el revisor de Meta y el de Google entraban y no llegaban ni a
  Integraciones ni al CRM. El 21/10 se terminó por la interfaz, como lo haría un cliente, con datos de prueba (nombre
  y negocio «Cliente de Prueba», «Mentoría de prueba, USD 100, pago único», «Ahora no» al WhatsApp). Desde ahí
  /integraciones y /crm abren directo. Quedó un lead de prueba (`lead.prueba@example.com`, sin teléfono) en «Agenda R1»
  con reunión del 20/10. Si alguien resetea el ws3 («Reset» de la barra de agencia), hay que repetirlo antes de
  cualquier revisión: el reset deja el negocio en el onboarding.
- **Sin confirmar:** el clic exacto que abre «Reagendar» con ese lead. Sale en «¿Qué hacer ahora?» de una reunión
  pasada (`abrirQueHacer`, app/crm/CrmBoard.tsx) y puede necesitar una agenda conectada en el ws3.
- **Un falso positivo que no hay que repetir:** el Explorador de la Graph API puede tener cargado un token de USUARIO
  aunque el desplegable diga «System User Token». Antes de sacar conclusiones de `/me/permissions`, mirar `/me`: un
  token del botón responde «MaKo System User», uno de usuario responde el nombre de la persona.
- ⚠️ **El token del botón tampoco LEE los leads, y Meta no da error: devuelve la lista vacía** (medido el 21/10 a las
  16:57 UTC). Se armó la «primera tanda» de la revisión (páginas y leads, sin anuncios). En la página Hola MaKo se creó
  el formulario «Formulario de prueba MaKo» (4674559882869456) y se le mandó un lead con la herramienta de prueba de
  Meta. `leadgen_forms?fields=leads_count` dice **1**; `/{formulario}/leads` devuelve `{"data":[]}` con el token de
  página **y** con el del usuario del sistema, y siguió vacío durante más de 5 minutos.
  - **Lo que NO es:** el acceso a clientes potenciales de la página está en el valor predeterminado (no personalizado),
    el usuario del sistema tiene `MANAGE_LEADS`, `ADVERTISE` y `MANAGE` sobre la página, y `/me/permissions` trae
    `leads_retrieval`.
  - **Lo más probable:** la documentación de Meta pone `ads_management` entre los permisos para leer leads. Si es eso,
    es el MISMO bloqueo que los permisos de anuncios. Pendiente de confirmar: con un token de usuario que sí tenga
    `ads_management`, ¿se lee el lead?
  - **Qué implica:** hoy «Conectar con Meta» no trae ningún lead al CRM. El poll no avisa nada: ve el formulario y
    0 leads, sin error. Tampoco hay webhook: suscribir la página (`subscribed_apps`) pide `pages_manage_metadata`, que
    la configuración no pide y no está en la revisión. «La página seleccionada no tiene ninguna app asociada», en la
    herramienta de prueba, quiere decir eso mismo.
  - **La regla:** para saber si un token lee leads, compará `leads_count` del formulario con lo que devuelve `/leads`.
    Una lista vacía no quiere decir «no hay leads».
  - **Lo que quedó SIN hacer:** la primera tanda no se puede mostrar con leads entrando al CRM. El formulario de prueba
    y su lead quedan en la página para la próxima grabación. `pages_manage_metadata` no está pedido en ningún lado.
  - **Cómo se grabó igual el video de leads (21/10, https://youtu.be/ZUJDwSo_IWg, oculto):** con la página de Mauricio
    (ws1, 282881742134130), que SÍ está suscripta, pero a la app VIEJA 954456647632371 «Leads - Dashboard MKT
    (Martin)». La herramienta de prueba de Meta muestra ese id en pantalla. El lead entró en segundos por el webhook.
    Muestra la función, pero no prueba que la app en revisión lea leads: el revisor que pruebe con la cuenta del ws3 va
    a chocar con la lista vacía.
- **No hay a quién reclamarle la demora de la verificación de acceso (probado el 21/10).** Meta dice que decide «en aproximadamente 5 días», y la nuestra llevaba 13. Ningún canal sirve: el reporte de errores, con la opción «El proceso de revisión o verificación de mi aplicación está tardando demasiado», contesta que no consulta casos concretos y manda al foro; el chat de soporte para empresas (IA de Meta) no deriva a una persona ni abre un caso por mail. Todo pasa por el panel de la app y el correo de contacto. No volver a buscar ese canal: se espera, y el vigía avisa (`vigia-revisiones/`, en la carpeta del proyecto).
- **Tres trampas al grabar un video de revisión con la extensión de Chrome:**
  - La extensión trabaja sobre pestañas en segundo plano sin traerlas al frente. Lo que graba `gdigrab` es la pestaña
    VISIBLE: se pierde todo lo que se hizo en otra. Todo el recorrido va en UNA pestaña, navegando.
  - El lead de la herramienta de prueba trae `test@meta.com`. Si ya hay uno con ese email, MaKo lo FUNDE en el lead
    viejo (en el ws1, el #250 del 15/06), y la ficha dice «creado 15/06». Hay que usar un formulario que no pida email:
    el de diciembre de 2023 de Mauricio creó el lead #2767, nuevo, en «Lead entrante».
  - En los desplegables del diálogo de Facebook (página, píxel, cuenta) aparecen los activos de OTROS clientes. En el
    video del 21/10 se cortaron esos 7 segundos, y la columna «Agenda R1» del CRM del ws1 va borroneada.

**Vive en:** lib/meta-login.ts (`config_id`, `WORKSPACES_DE_REVISION`, `botonMetaVisible`) · lib/meta-conexion.ts · app/api/integraciones/meta/ · tests/meta-login.test.ts · panel de la app 2586146911825340

## «Calcular presupuesto»: cuántos ángulos se testean con lo que hay (23/10/2026)

Pedido de Martín (22/10): con US$2.000, «¿cuántas funcionalidades y cuántos avatares ataco?». Vive en
`lib/calculadora-presupuesto-ads.ts` (pura), el modal `app/ads-manager/CalculadoraPresupuesto.tsx` (⋯ → «Calcular
presupuesto») y la capacidad `calcular_presupuesto_anuncios` de la API (sin HTTP).

- **El diagnóstico obvio era el equivocado: «50 conversiones por ángulo».** Eso es el aprendizaje de Meta, y es por
  CONJUNTO en 7 días, no por anuncio. Pedido por ángulo, con US$2.000 a US$2,50 alcanza para 8 y a US$8 para 2: la
  respuesta sería siempre «una sola dimensión». Los dos criterios van cada uno donde corresponde: el TESTEO usa el
  mínimo para decidir (un conjunto por ángulo, si no Meta le da todo a uno) y la ESCALA del ganador, los 50 en 7 días.
- **El mínimo para decidir ya existía: `RECON_LEADS_VALIDACION` (lib/config.ts, hoy 10, la vara de Jan del panel
  Recon).** La primera versión usaba 20 por su cuenta: el plan habría dicho «alcanza» y la tabla «sin validar» con los
  mismos números. Ahora la calculadora importa esa constante (lo fija el test).
- **Probar menos para que el ganador salga de aprendizaje.** La opción se elige por: (1) que compare algo, (2) que la
  escala salga de aprendizaje, (3) cuántos avatares + funcionalidades prueba, (4) la más corta. A US$6 por resultado la
  matriz 3 × 3 entra pero ahoga la escala; la cuenta prueba menos. Tope de 3 por dimensión (la matriz de Jan): sin él,
  con 24 funcionalidades proponía probar 15.
- **La respuesta para Martín (US$2.000, 45 días, US$2,50 por conversación como en Strategy):** 3 avatares × 3
  funcionalidades en UNA semana (9 anuncios, US$3,57 por día cada uno, US$225), y US$46,71 por día durante 38 días al
  ganador, que sale de aprendizaje. Hasta ~US$5,50 por resultado sigue entrando la matriz; arriba de ~US$6,20 ni sin
  testear sale de aprendizaje. Optimizando a una agenda de US$125 no alcanza para comparar nada.
- **El Ads Manager no tenía la estrella de MaKo.** Se montó `MakoEnLaTab` (modo analizar, encima de los modales) y el
  `<main>` deja el lugar con `--ancho-panel-mako`.

- **Estaba escondida justo del que la necesita (24/10/2026, medido por el Cerebro).** Vivía en el ⋯ de la tabla, y el
  Ads Manager abre en su wizard de onboarding mientras falte la cuenta, la página o la primera campaña
  (`AdsManagerView` → `OnboardingAdsManager`): el que todavía no pauta sólo llegaba dando la vuelta por «Lo configuro
  después». Martín tampoco la veía (a su negocio le falta el ID de la cuenta publicitaria). Ahora el pie del wizard la
  abre en sus tres pasos. **Se queda en el Ads Manager, a propósito:** calcula el presupuesto de las campañas de Meta,
  que se crean ahí, y el wizard ES la puerta de quien no pauta. No necesita la cuenta: pide números y devuelve números.
- **Usa los anuncios del negocio, sin inventar** (`deTusAnuncios`): de las mismas señales que pinta la tabla
  (`getSenalesRecon`, el gasto ya en dólares) propone el costo por lead si hay al menos RESULTADOS_PARA_DECIDIR leads,
  y cuántos compran de cada 100 si hay esos leads en el CRM y al menos una venta. Debajo del campo dice «De tus anuncios
  del 1/10 al 23/10». Lo medido llena sólo un campo VACÍO, deja de serlo cuando la persona lo toca, se saca con
  «Optimizas a: Venta» (es por LEAD) y no se guarda en el navegador. El ticket NO se deduce: lo cobrado puede ser una cuota.
- **La clave del navegador no llevaba el negocio** (`mako.calculadora-presupuesto`): el super admin que abre dos clientes
  veía en uno lo que tipeó en el otro. Ahora lleva el negocio, que baja del server (ver «Un estado de pantalla guardado
  sin el negocio», más abajo).
- **El `Modal` de la casa no va por portal:** montado adentro del pie del WizardShell podía quedar recortado. Va como
  hermano del wizard.

**Sin hacer:** verlo en pantalla con un negocio sin cuenta de Meta (el 24/10 no entraba un servidor local: 2 GB libres
con 8 chats); el wizard del teléfono (`app/m/ads`) no la ofrece.

**Vive en:** lib/calculadora-presupuesto-ads.ts (`deTusAnuncios`, `completarConLoMedido`, `cambiarCampo`) ·
app/ads-manager/CalculadoraPresupuesto.tsx · app/ads-manager/OnboardingAdsManager.tsx · app/ads-manager/CampanasBrowser.tsx ·
lib/api-mako/areas/ads.def.ts · tests/calculadora-presupuesto-ads.test.ts · tests/calculadora-sin-cuenta.test.ts

## «Creé la campaña en Meta y no me aparece en MaKo»: medir primero si Meta la tiene en la cuenta CONECTADA (23/10/2026)

Pedido de Mauricio (ws1, audio del 23/10): las campañas que creó en el Administrador de anuncios de Meta para tres
clientes nuevos (ws20 Sergio Arriata, ws21 Florencia Ayelen Carballo, ws22 Patricia Contreras) no aparecen en
/ads-manager para vincularlas al CRM.

- **El diagnóstico obvio era el equivocado: «MaKo las filtra».** /ads-manager no filtra nada (el filtro de estado
  arranca en «Todos» y la tabla lista lo que devuelve `act_<id>/campaigns`); el selector del CRM
  (`campanasYConjuntos`) lee la misma edge. Medido con el token de CADA negocio: ws20 lee `act_4171287933095795` (16
  campañas, la última de 2023) y la otra cuenta de su BM `act_702839088096495` (0); ws22 lee `act_1551449682972756`
  (5, la última del 07/08/2026) y `act_351188227049325` (la última de 2025). **Ninguna campaña creada en septiembre u
  octubre en ninguna cuenta a la que llegan sus tokens**, ni pidiendo todos los estados. ws21 no tiene Meta conectado
  (cero claves). Y la cuenta del ws1 tampoco las tiene (la última, «030.», del 30/09). La causa es de configuración o
  de Meta, no de código: o quedaron como BORRADOR sin publicar, o están en una cuenta publicitaria que no es la
  conectada a ese negocio.
- **Cómo se mide, y en este orden:** `credWs('META_AD_ACCOUNT_ID'|'META_ACCESS_TOKEN', ws)` → `debug_token` (app,
  tipo, scopes) → `me/adaccounts` → `act_<id>{business}` → `<bm>/owned_ad_accounts` → `act_<id>/campaigns` con
  `filtering=[{field:'effective_status',operator:'IN',value:[…todos, ARCHIVED y DELETED incluidos]}]`. Sin el
  `filtering`, Meta deja afuera lo archivado y lo borrado.
- **Trampas medidas:** (1) los borradores del Administrador de anuncios **no existen para la API** (`act_<id>/addrafts`
  da #100 «nonexisting field»): una campaña sin «Publicar» no la ve nadie, tampoco MaKo. (2) `act_<id>/activities`
  devuelve `[]` con HTTP 200 al usuario del sistema de un cliente (ws20, ws22), aunque con el del ws1 trae eventos:
  vacío ahí NO es «nadie tocó la cuenta». (3) `me/adaccounts` del token de ws20 listó una sola cuenta, pero el token
  leyó también la otra del BM (`[]` sin error), mientras el token del ws1 contra esa misma cuenta da `#200 Ad account
  owner has NOT grant ads_management` dentro de un 200: un `[]` sin `error` es acceso real.
- **Regla:** ante «no me aparece», antes de tocar código se pide el número de cuenta que muestra Meta arriba a la
  izquierda en esa campaña y si está publicada; se compara con el `META_AD_ACCOUNT_ID` del negocio.

- **Lo que quedó (mismo día):** /ads-manager y el selector de campañas del CRM dicen al lado del título «Cuenta
  Nombre · número», como Meta la muestra arriba a la izquierda, y si la cuenta no tiene campañas creadas en los
  últimos 30 días, una frase que manda a publicar o a revisar la cuenta (lib/meta-cuenta-leida.ts). Sólo con Meta
  CONTESTANDO y con cuenta: el health «Sin conexión» de /api/meta-health trae `campaigns: []`, y sin ese corte decía
  «esta cuenta no tiene campañas» a quien no conectó nada. El `created_time` se compara como FECHA: Meta lo manda con
  el offset de cada cuenta (`-0700`, `-0300`, `+0000`) y ordenar el texto elige mal.
- **Medido en producción después del deploy (3e8462653):** las funciones de producción con los datos reales dan ws20
  «Cuenta 4171287933095795» + la frase, ws22 «Cuenta Patricia Contreras · 1551449682972756» + la frase, ws1 sin frase.
  Y el ws1 decía **«Cuenta Cuenta 2 · 564003520636790»**: su cuenta se llama «Cuenta 2» y el prefijo lo ponía cada
  pantalla. Ahora lo pone `etiquetaCuentaMeta` y no lo repite si el nombre ya empieza con «Cuenta».

- **Al conectar se ofrecen también las cuentas de los portafolios** (`lib/meta-cuentas-portafolio.ts`, el uso real de
  `business_management` para la segunda tanda del App Review): `/me/adaccounts` no trae una cuenta del portafolio que
  nadie asignó al usuario del sistema. **Trampa medida:** para un usuario del sistema `/me/businesses` devuelve `[]`
  SIN error; el portafolio sale del campo `business` de sus cuentas, en un pedido aparte (si a un token sin el permiso
  le fallara, no se lleva la lista de cuentas). Cada cuenta nueva se prueba con un GET antes de ofrecerla. Medido con
  los tokens reales: ws20 suma `act_702839088096495` y ws22 `act_351188227049325`; ws1 y ws13, nada.

- **27/10, MK-03: volvió el «no las veo», y esta vez la causa SÍ era de MaKo.** Son clientes de Joan (el pedido del 23/10
  se anotó como de Mauricio), en el grupo Makito. **El diagnóstico obvio era el equivocado: «ya lo explicó la medición del
  23/10».** El 25/10 el Media Buyer reemplazó /ads-manager y se borró `CampanasBrowser.tsx`, que era donde se decía la
  cuenta: la pestaña Campañas (`Lienzo.tsx`) volvió a dibujar el árbol sin decir QUÉ cuenta leía ni la frase de «sin
  campañas nuevas», y con la cuenta vacía el pie decía «Toca una campaña…». Sólo el selector del CRM lo conservó. Ahora el
  pie dice «Cuenta Nombre · número» (`etiquetaCuentaMeta`), la frase cuando no hay campañas nuevas (sólo con el árbol
  ENTERO: con `parcial` no se sabe si hay) y «Revisar y publicar en Meta ↗» a las campañas de ESA cuenta
  (`linkCampanasEnMeta`). MaKo en el chat (`ver_campanas_media_buyer`) recibe lo mismo.
- **Borradores: no se puede mostrar uno por nombre.** El pedido del Cerebro (Natalia, ws19: «Revisar y publicar (19)» en
  su Administrador) era dibujarlos como «Borrador en Meta: falta publicar». Un borrador del Administrador no existe para la
  API (el 23/10, `addrafts` dio #100 con el token de cada cliente en v24.0; la doc de Meta lista `act_<id>/addrafts` en
  v25.0, sin campos y sin decir si son los del Administrador: **sin medir con v25**). Lo que Meta SÍ devuelve sin publicar
  es lo RETENIDO por la aprobación de pares (`issues_info` 2446984, ver «Retiene anuncios»): esa campaña dice «Retenida en
  Meta: falta publicar» con «Publicar ↗» a su fila del Administrador, y gana a los cambios de MaKo (no entrega). Sólo por
  el token: por Zernio no llegan los `issues_info`.
- **Trampa del entorno:** re-medir por negocio desde una sesión de Claude (la base o la Graph con el token del cliente,
  aunque sea sólo lectura) lo frena el clasificador como «Production Reads». No se esquiva: la medición la corre quien
  tenga el permiso, en el orden de arriba. Lo que se necesita de Joan para cerrar sin medir: el número de cuenta que ve
  arriba a la izquierda en esas campañas y si están publicadas (o en «Revisar y publicar»).

**Sin hacer:** conectar Meta en ws21 (paso de Martín o de la clienta). Re-medir ws20 y ws22 al 27/10 (bloqueado arriba).
Probar `addrafts` con v25.0 en sólo lectura con un token permitido: si trae los del Administrador, el borrador SÍ se puede
dibujar por nombre (lib/meta-cuenta-leida.ts). **Verlo dibujado** con un negocio con Meta: el Chrome de esta PC está
logueado como ws10 (sin Meta, muestra el onboarding) y no puede entrar a otro negocio; lo mira un super admin en la
pestaña Campañas de `/ads-manager` del ws20.

**Vive en:** lib/meta-health.ts (`edgeUrl`, `campanasYConjuntos`, `_getMetaHealth`) · lib/credenciales.ts (`credWs`) ·
lib/meta-cuenta-leida.ts (`linkCampanasEnMeta`) · app/ads-manager/Lienzo.tsx (el pie y la tarjeta retenida) ·
lib/media-buyer/vista.ts (`lienzoMediaBuyer`: `cuenta`, `aviso`) · lib/media-buyer/productos.ts (`campanasRetenidas`) ·
lib/media-buyer/datos.ts (`arbolDeMeta`: `retenido`, `cuentaNombre`) · tests/media-buyer-borradores.test.ts ·
app/ads-manager/CampanasBrowser.tsx (borrado el 25/10) ·
app/crm/CampanasModal.tsx · app/crm/campanas-actions.ts (`cuentaMeta`) · tests/meta-cuenta-leida.test.ts

## Meta mientras se aprueba la app de MaKo: qué puentes existen y cuáles no (23/10/2026)

Investigación del Cerebro el 23/10: 5 investigadores web y un escéptico contrastando todo contra la documentación de
Meta. El informe entero, con los enlaces: `C:/dev/cerebro-herramientas/meta-mientras-tanto-23-10.md` (fuera del repo).
La pregunta: cómo operan los clientes con Meta (anuncios, leads, páginas, mensajes) mientras la app MaKo
(2586146911825340) no tiene los permisos de anuncios.

- **El diagnóstico obvio era el equivocado: «compartimos los activos del cliente con el portafolio de MaKo y operamos
  con un usuario del sistema».** Está REFUTADO: el nivel de acceso «Limited» que tiene una app sin revisión es, según
  Meta, sólo para desarrollo y no para anunciantes reales (developers.facebook.com/docs/marketing-api/get-started/
  authorization). Sumar a los clientes como testers de la app es lo mismo y además pone en riesgo la app que está en
  revisión.
- **Zernio (antes «Late») es el ÚNICO intermediario que dice cubrir todo**: anuncios, formularios de leads con aviso,
  métricas, páginas y mensajes; el cliente toca «Conectar» sin registrarse ahí. Lo paga MaKo por cuenta conectada (2
  gratis, US$6 de la 3 a la 10, US$3 de la 11 a la 100). **Su aprobación de Meta («No Meta App Review») la dice sólo el
  vendedor: no está verificada.** Además, en la ventana de Facebook el cliente probablemente ve «Zernio», si Zernio cae
  caen todos, al aprobarse la app de MaKo hay que reconectar a cada cliente, y las Condiciones de Meta (5.b.ii) exigen
  que cada anunciante sea cliente formal de Zernio. Antes de un piloto (con una cuenta de prueba de MaKo, nunca de un
  cliente), pedirles por escrito de quién es su app, qué permisos tienen con acceso completo y qué ve el cliente.
- **Dudoso: que Joan pase su app a Live destrabe el 1885183.** Meta dice que para la cuenta propia alcanza el acceso
  básico, pero otra página suya dice que en Live sólo se piden permisos aprobados por revisión. Es gratis y se sabe
  probándolo con el OK de Joan. Sirve para él, no para todos.
- **(RETIRADO el mismo 23/10: ver `hallazgos-integraciones.md`, «El puente de leads… se RETIRÓ»)** **Para leads hay un puente que anda en días: Zapier o Make** mandándole el lead a MaKo. Le exige al cliente una cuenta
  paga (Zapier Professional ronda US$20–30 por mes, sin verificar; Make sin verificar) y asignar Zapier como CRM en
  Leads Access, que es el paso que más falla. A MaKo le pide un receptor por cliente, una guía y una alerta de «hace X
  horas que no entra un lead»: si el cliente deja de pagar, los leads dejan de llegar sin que nadie se entere. Que la
  app de Zapier sirva para páginas de terceros está deducido, no documentado: se prueba con un cliente real. De
  emergencia, el CSV de Leads Center se importa hoy al CRM.
- **Descartes:**
  - Ayrshare: sólo impulsa posts, no maneja leads.
  - Outstand, bundle.social, Upload-Post: publican, sin anuncios ni leads.
  - Unipile: pide la contraseña de Instagram y no es socio de Meta.
  - Nango, Paragon, Pipedream, Composio: usan NUESTRA app, el mismo cuello de botella.
  - n8n: exige que cada cliente tenga su propia app activa y verificada.
  - La conexión de CRM nativa de Meta: MaKo no aparece hasta que se apruebe `leads_retrieval`.
  - Unified.to: pide la app propia para producción y cuesta US$750 o más por mes (corregido el 23/10: decía «sin precio público»).
- **Lo que falta del lado de MaKo:** la SEGUNDA tanda de App Review (`ads_management`, `ads_read`,
  `business_management`), que no se envió. Pedir el acceso completo abre la verificación de MaKo como proveedor de
  tecnología (unos 5 días), y subir de nivel exige 500 llamadas en 15 días con menos de 15% de error, que se pueden ir
  generando desde las cuentas propias.

**Sin hacer:** todo lo de arriba es una recomendación; nada se construyó ni se contrató. El receptor de leads de
Zapier, el mail a Zernio y la prueba de Joan en Live esperan la decisión de Martín.

**Vive en:** fuera del código: el panel de la app MaKo en Meta, `vigia-revisiones/` (si el botón ya trae permisos de
anuncios) · memoria `meta-oauth-app-review` · lib/meta-publicar-errores.ts (cómo se muestra el 1885183).

## Conectar con tu propia app de Meta: qué le anda HOY a cada negocio (23/10/2026)

Pregunta de Martín: «¿Cómo es posible que Código y otros ya han podido conectar sus cuentas de Meta? ¿No hay una forma
más fácil?». Medido en sólo lectura sobre los 11 negocios con token de Meta: todos son tokens de usuario del sistema,
válidos y sin vencimiento.

| Negocio | App que firmó el token | Métricas | Leads de Meta (30 días) | Anuncios desde MaKo |
|---|---|---|---|---|
| ws1 Mauricio (y ws4, mismo token) | «Leads - Dashboard MKT (Martin)», ACTIVA | ok | 34, último 21/10 | 5 de 5 |
| ws11 Leila | «Lidermente_Agent» | ok | 0 | nunca |
| ws13 Código (y ws14, mismo token) | «Joan P2P app», en desarrollo | ok | 0 | 0 de 14 (1885183) |
| ws15 Brigitte | «Bri App» | ok | 28, último 23/10 | nunca |
| ws18 Pablo, ws20 Sergio, ws22 Patricia | apps propias | ok | 0 | nunca |
| ws19 Natalia | «Natalia app» | ok | 73, último 23/10 | nunca |
| ws9 MaKo | app MaKo (el botón) | sin permisos de anuncios | 0 | — |

- **El diagnóstico obvio era el equivocado: «para leads hace falta Zapier o Make».** Con la app propia los leads ya
  entran solos (Brigitte, Natalia) por la consulta periódica de MaKo (lib/meta-leads.ts), aunque NINGUNA de esas páginas
  esté suscripta a su app (`subscribed_apps` vacío): no hace falta el webhook. Los que tienen 0 puede ser que no corran
  formularios; no se distingue desde acá.
- **Publicar anuncios anduvo sólo con una app ACTIVA que opera la cuenta de su propio portafolio** (ws1). La de ws13, en
  desarrollo, rebotó todo creativo nuevo. Así que pasar la app del cliente a activa es casi seguro lo que destraba el
  1885183 (la entrada de Meta mientras tanto lo dejaba «dudoso»; esta medición lo vuelve muy probable).
- **Trampa: si una app está en desarrollo o activa NO se lee por la API** con el token del cliente: se sabe recién al
  publicar (el rechazo 1885183 nombra la app).
- **Lo que se hizo:** el tutorial de Meta del modal de /integraciones (`lib/metodo-catalogo.ts`) ahora dice crear la
  app tipo «Negocio» con los casos de uso de anuncios y de leads. **NO dice que la pasen a activa, a propósito:** es la
  regla de Martín del 16/09 («no me menciones más que el cliente tenga que publicar su app, esa no es opción»,
  lib/meta-publicar-errores.ts). Un paso así entró en 942492a83 y salió antes de llegar a main: se cruzó la evidencia
  («sólo anduvo con la app activa») con la decisión de producto. Publicar con creativo nuevo va por la Zernio del
  negocio. Lo fija `tests/meta-tutorial-app-propia.test.ts` (ningún paso pide publicar ni activar la app).

**Vive en:** lib/metodo-catalogo.ts (`SERVICIOS_METODO` → meta → `tutorial`) · lib/meta-leads.ts (la consulta
periódica) · lib/meta-publicar-errores.ts · tests/meta-tutorial-app-propia.test.ts

## Publicar y editar por Zernio, con la Zernio de cada negocio (23/10/2026)

Decisión de Martín (23/10): «Vamos por Zernio directo… que cada usuario traiga su API de Zernio», para lo único que no
anda: «publicar o editar campañas». Investigación del Cerebro (6 agentes, contra fuentes oficiales) + lo medido acá.

- **La causa, precisa (y el diagnóstico obvio era el equivocado: «no podemos publicar NI editar»).** Con el token de la
  app propia del cliente (casi siempre en desarrollo) Meta deja crear campañas y conjuntos y deja borrarlos. Lo único que
  rechaza es un anuncio con creativo NUEVO (`object_story_spec`, lib/meta-ads-create.ts): el post nace de ESA app → 1885183.
  Cambiar textos o creativo de un anuncio vivo crea otro creativo (`updateAdCopy`) y choca igual. Pausar, presupuesto,
  renombrar y borrar van por lib/meta-write.ts con el token del cliente y no crean posts: **probablemente andan, NO está
  medido** (hace falta una edición inocua y reversible en la cuenta de un cliente con app en desarrollo que lo autorice;
  la de MaKo no sirve, su token del botón no tiene permisos de anuncios). «Usar un ganador» (`object_story_id`) pasa hoy.
- **El «(revertido)» anterior a c5a5c9331 (07/10) no probaba nada** (la respuesta del DELETE no se leía). Medido hoy en
  Meta con el token de ws13: las 14 campañas de los intentos del 11-17/09 existen como **DELETED** y sus conjuntos
  también. El rollback sí había borrado: no hay huérfanos en `act_1357728489423123`.
- **Zernio, según su doc** (docs.zernio.com/platforms/meta-ads, /ad-campaigns/create-standalone-ad, /ad-campaigns/update-ad,
  /ad-accounts/list-ad-accounts, leídas el 23/10): `POST /v1/ads/create` crea campaña + conjunto + anuncio con creativo
  nuevo, o UN anuncio dentro de un conjunto que ya existe (`adSetId`, hereda presupuesto y público; `bidStrategy` ahí da
  400); `PUT /v1/ads/{adId}` con `creative` cambia textos o media de un anuncio vivo (crea un creativo nuevo, como Meta;
  acepta el id de Meta o el de Zernio); formularios por `POST /v1/ads/lead-forms`. Scopes: `ads_management`, `ads_read`,
  `leads_retrieval`, `pages_manage_ads`, `instagram_basic`. El cliente conecta una vez con el OAuth de Zernio
  (`GET /v1/connect/facebook/ads?loginMode=business`, crea una conexión `metaads`): **la ventana dice «Zernio» y no usa
  el token que el cliente pegó**. Una imagen va por URL (`imageUrl`): no documenta recibir el `image_hash` de Meta. El
  error trae el de Meta en `platformError` (con `error_subcode`).
- **Precio:** por cuenta conectada, y **la cuenta publicitaria cuenta aparte** de la página y de Instagram (2 gratis,
  US$6 de la 3 a la 10, US$3 de la 11 a la 100); anuncios gratis hasta 500 activos, sin porcentaje del gasto.
- **Sin verificar:** que la app de Meta de Zernio esté activa con `ads_management` AVANZADO lo dice sólo Zernio («No Meta
  App Review»); la cita «approved Meta Marketing Partner» que trajo una búsqueda NO está en su página. **Lo decide una
  prueba real, en pausa** (el `validate_only` de Meta no ve el 1885183): scripts/prueba-zernio-anuncio.mts, sobre la
  cuenta de MaKo, con el OAuth que hace Martín botón por botón. Hasta entonces `ZERNIO_ANUNCIOS_PROBADO = false`.
- **Lo construido:** Zernio SÓLO para lo que falla. `crearAnuncioEnConjunto` (lib/meta-ads-create.ts) manda a Zernio el
  anuncio con creativo nuevo si el negocio tiene su conexión de anuncios de Zernio (forma `adSetId`, en pausa); la
  campaña y el conjunto siguen por Meta. `updateAdCopy` cambia textos por Zernio con esa conexión. Si Zernio no contesta,
  se publica por Meta como antes (lo que se cae es sólo publicar). **La clave es la del negocio** (`credDelCliente`;
  la de la plataforma sólo en el negocio de la plataforma): lib/zernio-ads.ts, lib/zernio-ads-cuerpo.ts. Un rechazo que
  vuelve por Zernio nombra a Zernio y conserva el subcode de Meta.
- **Descartes:** Pipeboard (US$99-199 por mes, modelo agencia, «for the Customer's exclusive use»), AdManage (£999,99 por
  10 cuentas; la API sólo en planes caros), Adspirer (sin precio ni app conocida), Composio y Nango (usan la app propia),
  **Unified.to (SÍ publica precio: US$750 o más por mes; la entrada «Meta mientras se aprueba» decía que no), y también
  pide la app propia**, Ayrshare (sólo impulsa posts), Metricool y Madgicx (no crean anuncios desde afuera).

**Sin hacer:** la prueba (espera el OK y el clic de Martín); con la prueba pasada, prender `ZERNIO_ANUNCIOS_PROBADO` y
que el modal ofrezca «Conectar Zernio para publicar» sin salir de la tab, con el link de `urlConectarAnunciosZernio`;
medir editar (pausa, presupuesto, nombre) en una cuenta de cliente con app en desarrollo; mandar el mail a Zernio
(C:/dev/cerebro-herramientas/mail-zernio-borrador.md, lo decide Martín).

**Vive en:** lib/zernio-ads.ts · lib/zernio-ads-cuerpo.ts · lib/meta-ads-create.ts (`crearAnuncioEnConjunto`,
`updateAdCopy`) · app/api/ads-manager/campaign-create/route.ts · scripts/prueba-zernio-anuncio.mts ·
tests/zernio-anuncios.test.ts

## Un estado de pantalla guardado sin el negocio adentro se filtra entre clientes (24/10/2026)

**Vive en:** `app/ads-manager/CalculadoraPresupuesto.tsx` · `app/ads-manager/NuevaCampanaModal.tsx` ·
`app/ads-manager/AdsManagerView.tsx` (de donde sale el negocio) · `tests/navegador-por-negocio.test.ts` ·
`tests/calculadora-sin-cuenta.test.ts`

- **Síntoma:** el super admin abre dos clientes en el mismo navegador y ve en uno lo que escribió en el otro. Sin error: se
  lee como un borrador cualquiera. En la calculadora eran números; en el borrador de «Nueva campaña» eran el presupuesto,
  los lugares, la PÁGINA, las audiencias, el destino y la clave de idempotencia del otro cliente.
- **Causa:** `localStorage` es por ORIGEN, y las dos claves eran fijas (`mako.calculadora-presupuesto`,
  `mako.nuevaCampana.draft.v2`). La regla ya estaba en AGENTS.md por el Video Editor, y no alcanzó.
- **El diagnóstico obvio era a medias: no alcanza con el `?ws=` de la pestaña.** El primer arreglo lo leía de la URL (como
  ya hacían las claves abiertas de `creativeUpload.ts`), y AGENTS.md pide que el negocio salga del server: una persona con
  dos negocios que cambia por cookie no tiene `?ws=` y sus claves chocaban igual. Ahora `AdsManagerView` lee
  `getWorkspaceActual()` y lo baja por props. El borrador viejo (sin negocio) se borra, no se migra.
- **Sin hacer, con su archivo** (de 58 escrituras a `localStorage` en `app/`, las que guardan algo escrito para un negocio
  con una clave fija): el borrador de proyecto y de tarea del Plan (`app/plan/board/CrearProyecto.tsx`,
  `CrearTareaModal.tsx`), los borradores del inbox de WhatsApp (`app/whatsapp/EmpresaInbox.tsx`), el editor de
  plantillas (`app/whatsapp/PlantillasPanel.tsx`) y la URL de prueba del Pixel (`app/integraciones/ProbarTracking.tsx`).
  Y `app/ads-manager/creativeUpload.ts` sigue leyendo el negocio del `?ws=`. Un guard que barra las claves necesita su
  lista de preferencias (una pestaña recordada no lleva negocio, y está bien).

- **Por CAPI salen sólo cuatro cosas, de cuatro lugares:** Lead (formularios de Meta y de Zernio), SubmitApplication +
  QualifiedLead (marcar «calificado» en el CRM) y Schedule (una reserva de Calendly). **Purchase no sale por ningún
  camino**, Cal.com no manda Schedule, y el opt-in de una landing no manda Lead. MaKo no carga `fbq`: el píxel del
  navegador lo pega el negocio.
- ⚠️ **VIVO: el Schedule se cuenta DOS veces en el píxel de Mauricio.** Su landing dispara `fbq('track','Schedule')` sin
  `eventID` al reservar en Calendly, y MaKo manda Schedule por CAPI al MISMO píxel (el `META_PIXEL_ID` del ws1 coincide
  con el `fbq('init')` de la página) con `event_id` `schedule:<email>:<inicio>`. Sin un `event_id` común (ni `fbp`, que
  MaKo no guarda) Meta no deduplica. (Corregido el mismo día, medido por hora contra Calendly: de 8 reservas en 30 días, 3 se
  contaron dos veces; MaKo además manda DOS Schedule por reserva en 3 de 4, lo probable un reintento de Calendly, y hay un
  tercer emisor de servidor que espeja al navegador.) **El diagnóstico obvio («ya
  existe, está bien») era el equivocado:** que MaKo mande un evento es correcto sólo si la página no lo manda ya. La salida
  es por página o por funnel: MaKo no manda por CAPI lo que el píxel de la página ya manda (o la página deja de mandarlo),
  y eso es parte de «qué mide este funnel» (docs/hallazgos-landing.md, misma fecha). Además, ese `event_id` lleva el email
  en claro.
- **La regla que queda (general, en AGENTS.md):** si la página ya manda un evento desde el navegador, MaKo no lo manda por
  CAPI al mismo píxel sin un `eventID` compartido; con dos ids distintos Meta no deduplica y cuenta doble. Todo evento
  nuevo por CAPI (Purchase de una venta externa, Lead del opt-in) se pregunta antes si la página ya lo dispara. Decidido
  por el Cerebro el 24/10: el arreglo del Schedule doble va al CRM después del lanzamiento, dentro del diseño de «qué
  eventos manda MaKo a Meta» por funnel.
- **Arreglado el mismo día (5b77a50d4, Martín: «Es error de mako»):** un solo id para las dos puntas,
  `schedule:<uuid del evento de Calendly>` (`eventIdSchedule`, lib/meta-capi-payload.ts), que las páginas de MaKo mandan
  como `eventID` y, sin la URI, no mandan; y si la página donde se reservó ya dispara Schedule sin id al mismo píxel, MaKo
  no lo repite por CAPI y lo deja dicho en el historial (`repiteScheduleDeLaPagina`; la página sale del `agendo` o la
  visita del visitante, lib/meta-schedule-pagina.ts; el analizador lo detecta como `meta-schedule` / `meta-px:<id>`).
  Test: tests/meta-schedule-id.test.ts (falla si un `fbq` Schedule del repo queda sin `eventID`).
- ⚠️ **El diagnóstico obvio del pedido era el equivocado en una mitad:** se pensó que el Schedule sin id que duplicaba era
  el de `app/vsl/Landing.tsx` y el de `SCRIPT_DISENO` («`fbq('track',…)` sin id va a TODOS los píxeles iniciados»). Es
  cierto que va a todos los INICIADOS, pero esas dos páginas sólo inician el píxel de MaKo (`PIXEL_META_MAKO`) o el del
  documento: nunca el de Mauricio. El que duplicaba es el del bundle de SU página. Arreglar sólo el id compartido habría
  dejado el doble igual; hacía falta también que MaKo no repita lo que la página ya manda.
- **Hasta que el vigilante relea la página** (cron `tracking-vigilante`, 13:50 UTC) el snapshot de multiplicatusresultados.com
  no trae `meta-schedule` y MaKo sigue mandando: el doble para recién con la primera lectura después del deploy. Se
  verifica con `/{pixel}/stats?aggregation=event_source&event=Schedule`: el de servidor tiene que quedar en el del espejo,
  no en el doble.
- **«MaKo no ve gasto del ws1 desde el 15/10»: no era ceguera.** La cuenta la frenó Meta por saldo impago (la entrada de
  abajo).
- ~~El ws4 «Cliente de Diseño» tiene el MISMO píxel y el mismo token que Mauricio~~ **RESUELTO el 24/10/2026 a las 21:20**
  (Martín: «"Cliente de Diseño", simplemente quitalos... No es dificil»). Eran 26 credenciales, TODAS copias de las de
  Mauricio que hizo «datos-mau» el 16/08 (Meta con píxel y token de conversiones, Calendly, Fathom, Whop, YouTube, Resend y
  las claves de IA): un envío por CAPI desde el ws4 caía en el píxel real de Mauricio, y sus crons gastaban las keys de él. Se
  quitaron con `eliminarDatosDelDueno` de cada ámbito de credenciales (lib/datos-mau.ts), que borra exactamente lo copiado y
  su fila de ruteo. Medido: el ws4 quedó con 0 credenciales y el ws1 con sus 38, idénticas. El ws4 NO se borró (sin usuarios,
  sigue siendo el taller de temas de `app/admin/ui/Temas.tsx`, con sus 300 leads copiados); si alguna vez hace falta que tenga
  integraciones, se vuelven a copiar desde su panel, sabiendo que copian las de un cliente. El diseño de qué manda MaKo a
  Meta, por funnel y por página: docs/diseno-eventos-meta-por-funnel.md.

## Un día sin filas de Meta no es «sin sincronizar»: la cuenta del ws1 la frenó Meta por saldo impago (24/10/2026)

Medido con el workflow `wf_d253310f-574` (GETs de sólo lectura a la Graph API con la credencial del ws1, y la base), y
re-medido por un verificador independiente. Lo pidió el Cerebro: «nueve días sin gasto significa que ningún costo por lead
de ese cliente sirve».

**Vive en:** `lib/meta-ads.ts:452` (`upsertMetrics`: `if (metrics.length === 0) return 0;`) ·
`app/api/cron/meta-daily/route.ts:70-82` · `lib/sources.ts:84` · `lib/queries.ts:1496` ·
`lib/api-mako/areas/metricas.run.ts:171-176` · `lib/retro-fuentes.ts:307`

- **La pauta se apagó, y la apagó Meta:** la «Cuenta 2» del ws1 pasó de Active a «Payment Needed» el 15/10 a las 08:18:47
  UTC (account_status=3, saldo impago de 8.743,59 MXN). La campaña 030 sigue ACTIVE (400 MXN/día) y no entrega: 5,52 el 15/10
  y 0 después, según Meta. Nadie la pausó; no se mudó a otra cuenta (el token ve una sola). Es el 6.º episodio de saldo
  impago de esa cuenta desde agosto y el más largo.
- **El diagnóstico obvio era el equivocado en los dos sentidos.** «MaKo está ciego» es falso: el cron corrió todos los días
  (lo prueba `adset_budget_daily`, que escribe el mismo callback DESPUÉS de los insights) y Meta devolvió 0 filas. Y «ningún
  costo por lead sirve» también: el gasto de MaKo coincide con el de Meta al centavo, y el 0 de después es real. ⚠️ La prueba
  que usó la auditoría («la sincronización corrió hoy a las 13:45») era una fila de PANDA, no de Meta.
- **Lo que sí está mal es el rótulo:** un día leído sin entrega no deja ninguna fila, y entonces `sources.ts` pone Meta en
  'off' («Último día con datos: 2026-10-15»), `queries.ts` marca `fuente_pendiente` en Impresión→Click, Click→Formulario y
  Click→Landing, la Retro dice «sin fuente (pendiente)» y `resumir_marketing_periodo` dice «integración sin conectar o sin
  sincronizar» con gasto y CAC null: lo contrario de lo cierto («no hubo inversión: la cuenta tiene saldo impago»).
- **Regla que queda:** antes de concluir «sin sincronizar», mirar si hay un incidente de Meta abierto con entrega frenada
  (`service_incidents`) y si `adset_budget_daily` siguió escribiéndose; un día leído sin entrega es un 0 confirmado, no un
  hueco. Y la fila con el `updated_at` más nuevo de `marketing_metrics_daily` puede ser de otra plataforma: se filtra por
  `plataforma`.
- **Menor:** el cron nunca relee los días pasados, así que pierde los ajustes tardíos de Meta (la base queda 0,3 a 1,2 % por
  debajo). Y «ws13 y ws14 tienen datos» es la MISMA cuenta contada dos veces (ya estaba en «Seis credenciales de Meta
  compartidas»).
- **SIN hacer (de Ads/Métricas, no lo arreglé):** que el cron guarde «leído sin entrega» por día cuando Meta devuelve [] sin
  error, y que las cuatro lecturas de arriba digan «sin inversión» (con el incidente abierto) y den gasto 0 en vez de null.
  Lo urgente no es código: que Mauricio pague o cambie el medio de pago. Que MaKo dejó de avisarle está en
  docs/hallazgos-comunicacion.md, misma fecha.

*24/10/2026, chat «Ventas de MaKo» (`claude1`).*

## El Media Buyer reemplaza al Ads Manager: lo que se midió antes de dejar que un agente mueva plata (25/10/2026)

**Vive en:** `lib/media-buyer/*` (motor, topes, datos, ejecutar, corrida, variaciones) · `lib/zernio-ads.ts` ·
`app/ads-manager/MediaBuyer.tsx` · `app/m/ads/MediaBuyerM.tsx` · `supabase/migrations/0332_media_buyer.sql` ·
`lib/api-mako/areas/ads.def.ts` (las siete del Media Buyer) · `docs/media-buyer/referencia.md`

Martín, 25/10: borrar la réplica de Meta Ads Manager y que la tab sea «una app de IA, como un media buyer de MaKo»,
copiada de una app que ya exista. La referencia es Madgicx · AI Marketer (capturas reales en
`docs/media-buyer/referencias/madgicx/`). Esto es lo que sirve después, no el changelog.

- **El diagnóstico obvio era el equivocado: «hay que diseñar el agente».** Ya estaba diseñado: el Autopilot del 13-14/10
  (`docs/diseno-ads-autopilot.md`, nunca implementado) con su encuadre validado por Martín. Se tomaron sus trampas
  (apagado por defecto, abstenerse con datos viejos, con la lectura de Meta `parcial` o con una moneda sin tasa, deshacer
  sólo si nadie lo tocó después, una cuenta compartida por dos negocios se maneja una vez) y se descartó su pantalla (un
  modal dentro de la tabla): el pedido nuevo es que la tab ENTERA sea el media buyer. Antes de diseñar algo que «nadie
  hizo», buscar `docs/diseno-*` del área.
- **Zernio cubre todo lo que el agente escribe, medido en su OpenAPI v1.353.0 (25/10):** prender/pausar campaña, conjunto
  y anuncio (`PUT …/status`, leen el interruptor EN VIVO y si ya estaba así contestan `skipped: 1` sin escribir),
  presupuesto diario (`PUT /ads/campaigns/{id}` para CBO —en ABO da 409— y `PUT /ads/ad-sets/{id}` para ABO), duplicar
  un anuncio en pausa y cambiarle el creativo por parche (conserva la media y el `url_tags`), borrar, y el árbol con
  métricas y desglose diario por anuncio (`/ads/tree?timeIncrement=1&dailyLevel=ad`). ⚠️ **El presupuesto de Zernio va
  en UNIDADES de la moneda de la cuenta, no en centavos** como el `daily_budget` de Meta (`aUnidadMeta`): mezclarlos
  multiplica por 100.
- **La cuenta de Zernio de la plataforma tiene CERO cuentas conectadas** (GET /accounts, 25/10): ningún anuncio de MaKo
  pasó nunca por Zernio. El link para conectar la cuenta publicitaria de MaKo (`act_1426493815659364`) se genera bien
  (`GET /connect/facebook/ads?loginMode=business&permissionLevel=advertise&adAccountId=…`, contesta la ventana de
  Facebook de la app 712341431446535): lo que falta es el clic de Martín en esa ventana. `permissionLevel=advertise`
  (Administrar campañas) alcanza para campañas, conjuntos, creativos y anuncios; `full` sólo hace falta para píxeles.
- ⚠️ **El árbol de Zernio (`/ads/tree`) no trae el interruptor PROPIO de una campaña ni de un conjunto**, sólo la entrega
  (la campaña trae `effective_status`; el conjunto, un estado derivado de sus anuncios). Lo trae otro endpoint: `GET
  /ads/accounts/live` (OpenAPI v1.356+, `configuredStatus`, más el presupuesto de hoy, una llamada a Meta por pedido; el
  dato lo pasó el chat «Zernio y CAPI»). `conInterruptorEnVivo` (lib/media-buyer/senales.ts) lo pone sobre el árbol; si
  no contesta, queda la entrega como interruptor —un conjunto que no entrega se trata como apagado: errar para el lado de
  no tocar— y va un aviso.
- ⚠️ **Un padre que no vino en la lectura es «no sé», y «no sé» es «no está prendido».** La primera versión de
  `prendido()` cortaba el recorrido al no encontrar al padre y devolvía `true`: con la página de campañas caída
  (`parcial`), el motor habría subido el presupuesto de conjuntos cuya campaña podía estar apagada. Lo fija un test.
- **El anuncio de un lead no es sólo `meta_ad_id`**: los de landing lo traen en `utm_content` (id o nombre). El agente
  atribuye con `adIdDeLead` (lib/atribucion-url.ts), la misma regla del resto de MaKo; sin eso el Stop Loss apagaba el
  anuncio que trae las reuniones (ya medido el 14/10: 9 de 114 agendados del ws1 tenían `meta_ad_id`).
- **El CRM se cuenta por COHORTE** (los leads que entraron en la ventana, y de ésos cuántos agendaron o compraron), no con
  `bajadaCrmPorAnuncio`, que suma las ventas de TODOS los leads del anuncio de cualquier fecha: contra el gasto de 3 días,
  eso hace parecer barato a un anuncio que vendió hace un año.
- **Las palabras de una descripción de la API roban pedidos de OTRA área.** La primera versión de `topes_media_buyer`
  decía «lead, agenda o venta» y «dólares»: «editá la venta de Juan: 1500 dólares» dejó de traer `editar_venta_lead`
  (tests/ops-center-clasificador-app.test.ts). Se reescribió sin esas raíces. Ya estaba en AGENTS.md para los ids; vale
  igual para la descripción.
- **«Lo que mueve plata no puede salir por HTTP» era el diagnóstico equivocado** (Martín, 25/10: «todo MaKo se debe poder
  utilizar por API»). Lanzar, deshacer, el modo, los topes y las tácticas habían quedado `SIN_HTTP` por miedo a que un
  token escribiera solo. No hacía falta: `lib/api-mako/rutas-http.ts` ya trata `costo: 'dinero'` como PROPUESTA aun con
  un token detallado (devuelve el link a la pantalla). Ahora todo el Media Buyer sale por HTTP con su URL REST, y
  `tests/media-buyer-api.test.ts` fija que cada `op` de `/api/media-buyer` tenga su operación (o su porqué en `FALTA`) y
  que cada campo de la config se pueda cambiar por la API. Lo único afuera: subir creativos (los archivos los sube el
  navegador al staging).
- **Las dos tablas nuevas van en `TABLAS_DE_INQUILINO` y la 0332 tiene que estar ANTES del deploy**: el reset del cliente
  de prueba borra de cada tabla de esa lista y una que no existe da error. Hasta que se aplique, el código las tolera
  (PGRST205) y la pantalla dice que el registro no está.

- ⚠️ **El botón de conectar no sirve para la cuenta de MaKo.** `<ConectarViaZernio>` arma el link con la clave de Zernio
  DEL NEGOCIO, y el negocio de la plataforma (ws9) no tiene una propia: la de la plataforma no se puede guardar como suya
  (`KeyDePlataformaError`). El link de MaKo sale por `scripts/media-buyer-medir-zernio.mts conectar`, que también mide
  crear · editar · borrar en pausa. Y la cuenta de MaKo no tiene `META_AD_ACCOUNT_ID`: el Media Buyer la toma de su
  Ajuste «Cuenta publicitaria» (`media_buyer_config.cuenta_publicitaria`).
- **Filmar un hook NO es del servidor.** El Video Generator filma con la extensión y una pestaña de Flow en el navegador
  del cliente. Lo que el Media Buyer sí hace: cada hook elegido, pegado al cuerpo del video ganador (su transcripción
  menos la primera frase), entra como guion con los rótulos GANCHO / HISTORIA —el contrato que la app usa para cortarlo
  en tomas— en la celda «Hooks del Media Buyer» (`lib/media-buyer/hooks-video.ts`), sin duplicar por `huellaGuion`.
- **Subir un video por Zernio tarda** (`POST /ads/create` con `video.url` espera a que Meta lo procese): con el timeout
  de 90 s de las otras llamadas, cortar no deshace lo creado y MaKo no se entera. Para video van 240 s y una
  `Idempotency-Key` por archivo, para que un reintento no publique dos veces. Sin medir todavía con un video real (la
  cuenta de MaKo no está conectada). La ruta `creative-signurl` del Ads Manager viejo
  SIGUE en uso: es la subida al staging del Media Buyer.

- **El Media Buyer en MaKo Esencial (el Cerebro, 25/10): 2 recomendaciones por día y sin piloto automático.** El número no
  vive en el Media Buyer: es `ads.recomendaciones_dia` de la tabla de topes de Planes (`lib/topes-plan.ts`), y se aplica
  SÓLO al Esencial que MaKo cobra por la pasarela (`esEsencialDe`). Tres cosas que no eran obvias: el cupo se mira ANTES de
  escribir las variaciones (si no, la IA del negocio escribe textos de propuestas que no se van a guardar); el piloto se
  niega en UNA puerta (`guardarConfig`) y la corrida lanza con el modo que VALE (`modoEfectivo`), porque un negocio que baja
  de Pro a Esencial queda con `modo = 'piloto'` guardado; y con el cupo lleno entra primero lo que cuida la plata (Stop
  Loss, Calidad, Sunsetting) y no lo que la sube. ⚠️ **El candado de la tab le gana al cupo:** `NAV_SOLO_PRO`
  (lib/plan-esencial-reglas.ts) todavía tiene 'ads-manager', así que el Esencial de la pasarela rebota a
  /no-esta-en-tu-plan y nunca ve sus 2 recomendaciones. Es de Planes (avisado al Cerebro el 25/10).

- **Para Martín, «copialo tal cual» es la ESTRUCTURA, la limpieza y TODAS las funciones; los colores son los de MaKo
  (25/10, dos vueltas el mismo día).** La primera pantalla (estructura de Madgicx con lo nuestro encima: el piloto en la
  cabecera, dos banners, tres pestañas, dos botones sueltos) la rechazó: «se vea así de fea, con tantos botones, no se
  entiende... Copiala tal cual». La segunda copió también los colores de Madgicx y la corrigió: «no quiero copiar tal
  cual los colores, adaptarlos un poco a MaKo... Pero si quiero que tenga todas las funcionalidades». O sea: lo que se
  rechazó la primera vez no eran los colores sino el RUIDO; cada cosa nuestra va DENTRO de un lugar que la app copiada ya
  tiene (su tuerca, su «Ask AI Marketer to Do More», su tarjeta de saludo), y las medidas se toman de la captura (PIL),
  no a ojo. La regla de AGENTS.md (punto 3: estructura sí, colores de la casa) era la correcta.
- ⚠️ **La imagen de la landing de Madgicx NO es su app (medido el 25/10 entrando con la cuenta de Martín).** La landing
  muestra un AI Marketer oscuro con UN chip «All recommendations» y «Launch» en cada fila; la app por dentro es clara, con
  el saludo en un globo, una franja con la mascota («2 recommendations are waiting for you»), las pestañas Open · Completed ·
  Dismissed, «See details» en cada fila (el botón que lanza va en el pie del detalle) y los ajustes en una PÁGINA
  («AI Marketer settings»). Dos versiones del Media Buyer se armaron sobre la imagen de la landing y las dos hubo que
  rehacerlas. **Regla: se copia la app con una sesión adentro** (capturas `vivo-*.jpg`); la landing sirve para el tono, no
  para la estructura. Si no se puede entrar, se dice que la fuente es la landing.
- **Las capturas de la landing no alcanzan para copiar FUNCIONES.** Muestran la pantalla principal y poco más; el
  inventario de lo que hace la app (el detalle de cada recomendación, las tácticas, los reportes, los ajustes) sale de
  recorrerla por dentro con una cuenta (Martín abrió la suya de Madgicx para eso, 25/10).

### La medición que escribe, en la cuenta de MaKo (25/10/2026)

En `act_1426493815659364`, por la Zernio del negocio de MaKo y con el Media Buyer en «propone» (nunca piloto). El
script es `scripts/media-buyer-medir-zernio.mts` (cada paso que escribe pide `--si`; el estado queda fuera del repo).

- ⚠️ **Sin método de pago, Meta no deja crear un anuncio, ni en pausa** (code 100, subcode 1359188 «No hay ningún método
  de pago», en la etapa `ad` de `POST /ads/create`). Zernio deshace solo lo que había creado (campaña, conjunto,
  creativo) y deja la imagen subida. **El diagnóstico obvio era el equivocado:** parecía un permiso de la conexión de
  Zernio, y es la cuenta publicitaria. Lo que sí se puede crear sin pago es una campaña VACÍA (`POST /ads/campaigns`).
- ⚠️ **El árbol de Zernio (`/ads/tree`) se arma desde los ANUNCIOS:** una campaña o un conjunto sin anuncios no aparece,
  y `lanzar` no la encontraba («ya no está en la cuenta»). `GET /ads/accounts/live` sí la trae (con nombre, interruptor y
  presupuesto): `conInterruptorEnVivo` ahora suma al árbol lo que sólo vino en vivo. Lo fija un test.
- ⚠️ **A una campaña vacía, `PUT /ads/campaigns/{id}` le da 404 «Campaign not found» si no va `accountId`** (la OpenAPI
  lo pide «sólo para una campaña vacía»). Con `accountId`, el presupuesto 1 → 2 → 1 se leyó en vivo cada vez. El de
  conjuntos no lo declara: se manda sólo en el de campañas.
- ⚠️ **`PUT …/status` también da 404 en una campaña vacía, y ese endpoint NO acepta `accountId`** (sólo `status` y
  `platform`): prender o pausar una campaña sin anuncios no se puede por Zernio. Con anuncios anda. No hay arreglo
  nuestro: queda anotado en `cambiarEstadoPorZernio`.
- **La moneda de una cuenta sin anuncios no viene en el árbol**, y sin moneda la corrida se abstiene (`moneda_sin_tasa`).
  La trae `/ads/accounts/live` (`currency`): `leerDatosCuenta` la toma de ahí si falta.
- **Un token de Meta sin `META_AD_ACCOUNT_ID` no es una cuenta para operar.** El negocio de MaKo tiene el token del
  dueño pero su cuenta sólo en los Ajustes del Media Buyer: `leerDatosCuenta` tiraba `SinCuentaParaOperar` en vez de
  ir por Zernio. Ahora el token se usa sólo si está la cuenta en Integraciones.
- **Lo que se midió de punta a punta:** una decisión real (`subir_presupuesto`, de la táctica manual) se guardó, se lanzó
  por Zernio y **los topes la recortaron** de 2 a 1,2 («Recortado a 20% por día, tu tope.»), se leyó 1,2 en vivo, se
  deshizo (estado `deshecha`) y se leyó 1 en vivo. La corrida entera en `soloProponer` dio `ok`, fuente Zernio, USD, 0
  propuestas (la cuenta no tiene entrega). La campaña de prueba se borró y se verificó que ya no está.

- ⚠️ **`billingStatus: ok` de Zernio NO quiere decir que Meta deje crear un anuncio.** Segunda prueba, el mismo 25/10, en
  la «Cuenta 1» de Elévate (Mauricio; Martín: «hazlo en la cuenta de Mauricio, que si tiene metodo de pago»): activa,
  `billingStatus: ok`, y Meta igual frenó el anuncio con el mismo 1359188 («Update payment method»). La ventana de Facebook
  ya lo avisaba con un botón «Añadir método de pago». **El diagnóstico obvio («esta cuenta sí tiene pago, ahí anda») era el
  equivocado:** la única prueba de que una cuenta deja crear anuncios es crear uno (en pausa).
- ⚠️ **Lo que Zernio deshace al fallar no incluye la imagen:** queda en la biblioteca de la cuenta («ad_image.jpg»), y
  Zernio no tiene cómo borrar imágenes (`/ads/images` sólo lista y sube). En una cuenta de cliente hay que avisar para que
  la quite a mano. Para probar sin dejar nada, comparar la cuenta antes y después (`foto` / `comparar` del script: el
  interruptor y el presupuesto de cada campaña y conjunto, en vivo).

- **A nivel ANUNCIO, medido de punta a punta en la cuenta de MaKo** (Martín cargó la tarjeta el 25/10): el anuncio de prueba
  se creó en pausa; el Media Buyer lo prendió, lo pausó y deshizo, cada paso leído en Meta; las variaciones de texto y de
  hook se lanzaron (una de dos elegida) y su deshacer las borró (`DELETED` en Meta). La campaña se borró y la cuenta quedó
  como en la foto de antes. Gasto 0 e impresiones 0: el árbol de Zernio guarda lo borrado con sus métricas, y eso lo prueba.
- ⚠️ **El árbol de Zernio tiene el interruptor de los ANUNCIOS con hasta una hora de atraso.** Recién pausado por el Media
  Buyer, el árbol seguía diciendo «prendido», y «prender» se frenó con «Ya estaba prendido en Meta» (y la decisión quedó
  vencida). **El diagnóstico obvio («ya estaba prendido») era el equivocado:** Meta decía pausado. Zernio lo documenta («los
  estados son los que guardó; se refrescan en 15 a 60 minutos; quien actúa sobre un interruptor pase `live=true`»). Ahora
  `lanzar` y `deshacer` releen el anuncio con `GET /ads/{adId}?live=true` antes de decidir (`conAnuncioEnVivo`, con test);
  campañas y conjuntos ya venían en vivo. Lo que el motor PROPONE sobre un anuncio sigue saliendo del árbol: puede proponer
  algo que ya se hizo, y al lanzar se ve y queda vencida.
- ⚠️ **`POST /ads/create` con `status: PAUSED` pausa sólo la CAMPAÑA:** el conjunto y el anuncio nacen prendidos. No entrega
  (la campaña manda), pero para dejar todo en pausa hay que pausar el conjunto aparte.
- **`billingStatus` tampoco se actualiza al cargar la tarjeta:** siguió diciendo `missing` con la tarjeta ya cargada y Meta
  dejando crear. Es un dato guardado, no una lectura: no sirve para decidir en ningún sentido.
- ⚠️ **Un anuncio BORRADO trae `configuredStatus: ACTIVE`** (lo vio el chat «Zernio y CAPI» en los de esta prueba): lo borrado
  se queda en el árbol (`status: cancelled`) y, leyendo sólo el interruptor, contaba como PRENDIDO (Stop Loss o Ganador lo
  podían tomar). Marcarlo «pausado» tampoco sirve: Revive propondría prenderlo. Ahora `arbolDesdeZernio` lo deja como
  `DELETED` (ni prendido ni pausado, y sigue en el árbol para que su gasto de antes sume), y la lectura en vivo del anuncio
  mira `status` y la entrega antes que el interruptor. Con test, roto a propósito.
- ⚠️ **Zernio contesta 200 al pausar un anuncio BORRADO** (medido por el chat «Zernio y CAPI», 26/10/2026), sin error. Marcarlo
  `DELETED` no alcanzaba: `lanzar` y `deshacer` seguían hasta escribir y la decisión quedaba «aplicada» sobre algo que ya no
  existe (una acción propuesta cuando estaba prendido y borrada a mano antes de lanzarla). **El diagnóstico obvio («ya lo
  marcamos borrado, no se toca») era el equivocado**: la marca sólo se leía para el interruptor. Ahora los dos se frenan ante
  `DELETED` antes de escribir (`lanzar` la cierra como vencida, «Se borró en Meta»); lo fija `tests/media-buyer-senales.test.ts`.
- **Con la MISMA `Idempotency-Key`, Zernio devuelve lo creado la primera vez aunque ya esté borrado** (el mismo chat, 26/10).
  Al Media Buyer no le pega: sus claves son `mb:<decisión>:<variación>` y `mb-subir:<ws>:<path>`, y una decisión deshecha no
  se relanza (reabrir toma sólo descartadas o vencidas) y cada subida tiene un path nuevo. Quien arme una clave con el NOMBRE
  del anuncio (`crearAnuncioEnConjunto`, `mako:<conjunto>:<nombre>`) recrea uno borrado: el chat de Zernio le puso una ventana.

**Sin hacer, con su archivo:** filmar SÓLO el gancho nuevo (hoy queda como guion en el Video Generator y se filma desde
ahí; depende del puente a Flow, `docs/diseno-ads-autopilot.md` → «Material»); la API de MaKo para «subir creativos»
(`FALTA` en `tests/media-buyer-api.test.ts`); `validate_only` antes de
escribir por el token de Meta (`lib/meta-write.ts` no lo soporta); el Stop Loss intradía (hecho el 29/10: el vigía del día, abajo; antes decidía con el día de ayer
cerrado); las rutas viejas de `app/api/ads-manager/*` que sólo usaba la vista borrada (quedan sin pantalla).

*25/10/2026, chat «Media Buyer» (`claude5`).*

### El rediseño con la estructura de AdAmigo (25/10/2026, tarde)

Martín, textual: «Me gusta el de "AdAmigo" implementalo de punta en punta, revisa si es que tienen funcionalidades que nos
faltan... en el onboarding, me imagino a la calculadora... todo con el chat de MaKo, como Offer... en el lienzo, recuerda
que tenemos varios CRM, varios productos, se debe poder interactuar... Lo que más me interesa es que en diseño se vea muy
bien». La pantalla pasó de Madgicx a AdAmigo (`app/ads-manager/aa.css`, todo token de la casa): Resumen · Autopilot ·
Campañas (por producto) · Biblioteca, el panel «N activos» de los agentes, y el arranque como charla de Offer.

- ⚠️ **Un reset `.aa button { … }` le gana a `.mk-btn`** (una clase y un elemento pesan más que una clase): los botones de la
  casa salían sin fondo dentro de la pantalla nueva. **El diagnóstico obvio («falta importar ui.css») era el equivocado.**
  El reset va con especificidad cero, `:where(.aa) :where(button)`, y entonces cualquier clase de la casa le gana.
- ⚠️ **Los números del lienzo y de la Biblioteca se cruzan por el NOMBRE de la campaña**, no por su id: `getSenalesRecon`
  trae `campana` (el nombre) y no el id de Meta. Una campaña renombrada este mes parte sus números en dos (la vieja queda
  sin producto). La regla: `norm()` del nombre en las dos puntas (`lib/media-buyer/productos.ts`); el arreglo de fondo es
  sumar el id de campaña a las señales, y queda SIN hacer.
- **El producto de una campaña** es el de SU asignación del CRM; si no tiene, el de su primer conjunto asignado
  (`CampanaAsignada.campanaId`); si tampoco, «Sin producto». Una asignación sin funnel va al default; la de un funnel que
  ya no existe queda «Sin producto»: nunca se inventa uno.
- ⚠️ **La tabla de decisiones tiene un CHECK sobre `tactica`** (`surf … manual`): un agente propio no puede guardar
  `tactica: 'propio'`. Va como `manual` con la clave `propia:<id>:<nivel>:<entidad>:<día>` (`agenteDeClave` la lee), y la
  corrida NUNCA lanza sola una `manual`: lo que la IA del negocio entendió de una regla espera siempre a una persona.
  La IA no puede inventar entidades: sólo ids que están en la cuenta, con su nivel, y ±50% de presupuesto por paso.
- **Un agente de MaKo no tiene estado propio: es el de sus tácticas** (`lib/media-buyer/agentes.ts`). Pausarlo apaga todas;
  «automático» si alguna lanza sola. Así no hay dos verdades (el panel de agentes y la página de Automatizaciones).
- **Las alertas de Protect no tienen tabla**: salen en cada corrida (rechazado, gasto que se dispara, leads de Meta que no
  llegan al CRM, tope de la cuenta) y se guardan en `ultimaCorridaInfo.alertas`; las graves, además, en una notificación.
  «Se disparó el gasto» es el gasto diario de 3 días por encima de 1,8 veces el de 7 días, y de US$ 20 para arriba.
- **Un solo formato de plata: `fmtDinero` (`lib/format.ts`)**, con dos decimales debajo de 100 («US$ 7.80») y sin
  decimales arriba. La pantalla mezclaba «US$ 7.8», «$7.80» y «7,80 USD» (el Cerebro lo marcó en la captura).
- **Las pestañas en el teléfono entran sin íconos y repartidas** (`justify-content: space-between`, sin `overflow`): con
  ícono, una pestaña salía cortada («Bloqu») a 390 px y no se veía que corría.
- **Para mirar la pantalla sin servidor**, se renderiza estática con `renderToStaticMarkup` y hooks de módulo que cambian
  `next/navigation`, el chat de la tab y las server actions por stubs: una server action importada en un componente de
  cliente arrastra `server-only` y la carga revienta.
- **Por la API**: `modo_agente_media_buyer` (mueve plata: pantalla, `dinero`, `NO_EN_FLUJOS`), `agente_media_buyer` y
  `borrar_agente_media_buyer` (gratis, se confirman en el chat), `ver_biblioteca_media_buyer`, y `ver_media_buyer` /
  `ver_campanas_media_buyer` ahora traen agentes, alertas y las campañas por producto.

**Sin hacer, con su archivo:** sin piloto en la prueba gratis y la `<FranjaPrueba>` (esperan a que `planes-2510` esté en
main; el cambio está escrito en las notas del Cerebro, `media-buyer-prueba-gratis.py`); el id de campaña en las señales
(`lib/queries.ts` → `getSenalesRecon`); Ajustes y Automatizaciones siguen con la estética de Madgicx
(`app/ads-manager/mb.css`); la Biblioteca muestra el texto de las variaciones, no la imagen del anuncio que generarían.

*25/10/2026, chat «Media Buyer» (`claude5`).*

### La segunda vuelta: la captura 04, no la pantalla Autopilot (25/10/2026, noche)

Martín, al ver la primera versión «AdAmigo»: «Lo que me pasaste de media buyer no me gusta... Una cantidad de botones y texto
impresionante... Te pedí mucho atención al diseño» y «Y la captura que me habias pasado de Adamigo no se parece en nada».

- ⚠️ **El diagnóstico obvio («hay que achicar la tarjeta y sacar botones») era el equivocado.** Martín había elegido UNA
  captura, la 04 (`docs/media-buyer/referencias/otras-apps/04-adamigo-aplicado-y-deshacer.png`: la orden en el chat, una
  pastilla, un árbol de tarjetas chicas y un mensaje al pie), y se copió OTRA pantalla de la misma app (Autopilot, con Qué ·
  Por qué · Impacto y cinco botones por tarjeta). La regla: se copia la captura elegida, no el resto de la app de donde sale,
  y antes de mostrarla se pone AL LADO de la referencia, a la misma altura (las comparaciones quedan en las notas del Cerebro,
  `media-buyer-adamigo/`). Es el segundo rechazo por lo mismo (el de las 14:10, a la de Madgicx).
- **HOY es la 04** (`app/ads-manager/Arbol.tsx`, `Hoy.tsx`): la caja del chat arriba, «MaKo · N cambios para hoy», las ramas
  por producto del CRM y una tarjeta chica por cambio (el producto, «Meta · la campaña», «Aplicar» o «Aplicado», un rótulo,
  la entidad y «$30 → $36 / día +20%»). El porqué va en UNA línea al pie y en el detalle que se abre al tocar la tarjeta (la
  tarjeta entera de antes, en una hoja). Una cuenta nueva y un día sin cambios ven la captura 2: «¿En qué te ayudo hoy?» con
  cuatro sugerencias; «Lanzar una campaña» abre el arranque con la calculadora. Fuera de la primera pantalla: la tabla del mes,
  la columna derecha, las subpestañas, «N activos», «Ajustar IA» y la barra (los agentes cuelgan de la tuerca; lo hecho, de
  «Actividad»). Lo fija `tests/media-buyer-hoy.test.ts`, que renderiza la tarjeta y cuenta UN botón a la vista (roto tres
  veces a propósito: otro botón, el porqué en la tarjeta, «Aplicar los N» con uno solo).
- **Las ramas del árbol sin medir nada:** el hueco entre columnas va en % del ancho (`column-gap: 2.4%`), así el centro de
  cada columna se calcula exacto y el abanico es un SVG con `preserveAspectRatio="none"` y `vector-effect: non-scaling-stroke`
  (la línea queda de 1,5 px a cualquier ancho). Con el hueco en px habría que medir: a 1.000 px de ancho y 24 px de hueco, el
  centro de una columna de costado se corre 8 px.
- **Toda la tarjeta abre el detalle sin anidar botones:** un botón invisible que la cubre, debajo de «Aplicar»; lo demás va
  con `pointer-events: none`. Un `role="button"` en la tarjeta con «Aplicar» adentro sería un botón dentro de otro.
- **La caja nueva tiene que nombrar el hook como la casa:** `tests/app-de-escritorio-todos-los-chats.test.ts` busca
  literalmente `const appEscritorio = useAppDeEscritorio()` y `bloqueo={appEscritorio.bloqueo}`; con otro nombre de variable
  da rojo aunque la caja se bloquee bien.

- **Campañas y Biblioteca, con el MISMO árbol** (`Ramas` y `TarjetaRama` en `Arbol.tsx`): en Campañas las ramas son los
  productos (con «Sin producto» como una rama más) y cada tarjeta, una campaña con su gasto, sus resultados del CRM y su costo;
  su único botón es «Asignar» o «N cambios», y al tocarla se abre la hoja con `ProductoCelda` (la del CRM). En Biblioteca, cada
  tarjeta es uno de los anuncios que más trajeron, con «Variaciones». Lo nuevo para revisar ya está en Hoy y lo lanzado, en
  Actividad: no se repite.
- ⚠️ **Cuatro columnas no entran en el ancho de la 04** (1.040 px): con tres productos y «Sin producto», el nombre de la
  campaña se cortaba. Quedan tres columnas; la cuarta rama baja de fila con su rótulo y sin el punto de la rama.

**Sin hacer, con su archivo:** Ajustes y Automatizaciones, con `mb.css`; las alertas de Protect son una línea arriba del árbol
y su hoja; «Aplicar los N» lanza de a uno desde el navegador (no hay una operación «lanzar varias» en `/api/media-buyer`).

*25/10/2026, chat «Media Buyer» (`claude5`).*

### La revisión adversarial de tren-l: diez fallas, con su test (26/10/2026)

El detalle (escenario, por qué no se pudo refutar) está en las notas del Cerebro, `revision-tren-l-2.md`, hallazgos 0 a 9. Lo
fija `tests/media-buyer-revision-l.test.ts`, roto una vez por falla. Lo que queda como regla:

- ⚠️ **Lo que la IA escribe para el público sale sólo LEÍDO (falla 0).** Copiar el «Applied» de la 04 puso «Aplicar» en cada
  tarjeta, también en las de textos nuevos: la IA publicaba y prendía copy que nadie leyó (y la hoja mostraba 2 de 4 y lanzaba
  las 4). **El diagnóstico obvio («el botón es el de la referencia») era el equivocado:** en la 04 el botón cambia
  presupuestos; un texto nuevo es otra cosa. Ahora esa tarjeta dice «Ver textos», «Aplicar los N» no cuenta variaciones, la hoja
  muestra todas, y el servidor no lanza textos de una persona sin `elegidas` explícitas (la API los lista en la confirmación).
- ⚠️ **La pantalla escribe «1,250» y el campo leía la coma como decimal (falla 4):** «1,500» salía 1,5 por día, y bajar no pasa
  por ningún tope. `leerMonto` (mb-modelo.ts) entiende los separadores de miles, y el servidor no escribe un salto de 5 veces
  o más (`saltoPresupuesto`, el que ya usaba el chat).
- **«El mismo porcentaje sobre el de hoy» compone (falla 1):** dos bajas abiertas sobre la misma entidad (el motor de dos días,
  o el motor y un agente propio) dejaban −36% con dos de −20%. Si otra decisión ya cambió el presupuesto después de proponerse
  ésta, se cierra como vencida (`presupuestoYaCambiado`, topes.ts); el lote dice lo que se ajustó o se frenó.
- **Una config JSON se guarda MEZCLANDO (falla 2):** el panel de agentes mandaba todas las tácticas con la copia de cuando se
  abrió la página y podía volver a poner en automático algo que otro apagó. El servidor mezcla táctica por táctica
  (`mezclarTacticas`) y cada pantalla manda sólo la que tocó; pasaba igual con Automatizaciones, ya en producción.
- ⚠️ **`getSetting` devuelve null cuando Supabase falla (falla 3):** una lista de agentes leída como vacía se escribía encima
  (editar uno durante un error pasajero dejaba ése solo). Lo que escribe lee estricto y guarda con compare-and-set por
  `updated_at`: comparar el JSON entero viaja en la URL y se rompe pasados unos KB (`docs/hallazgos-infra.md`).
- **Monedas mezcladas en lo que lee la IA (falla 5):** el gasto en dólares y el presupuesto en pesos, los dos con «$». Ahora el
  presupuesto va en la moneda de la cuenta con su equivalente al lado.
- **El arranque ofrecía el piloto a quien no lo tiene (falla 6):** el guardado se cortaba entero y la charla quedaba en «listo»
  con el Media Buyer apagado. El arranque conoce el plan, y un guardado fallido vuelve a preguntar el modo.
- ⚠️ **Protect pasaba a dólares lo que ya estaba en dólares (falla 7):** en una cuenta en pesos la alerta de gasto no saltaba
  nunca. **El test pasaba porque usaba una conversión que no convierte;** el nuevo usa la tasa de verdad.
- **Deshacer mientras se crean las variaciones (falla 8):** quedaba «deshecha» con los anuncios prendidos. No se deshace una con
  `creados` vacío, y lo creado tarde se guarda sólo si sigue «aplicada» (si no, se borra).
- **El cupo de Esencial no contaba lo de los agentes propios (falla 9):** cada «Analizar» de más dejaba otras tantas.

**La verificación de tren-m** cerró 9 de 10 y encontró lo que el arreglo dejó abierto:
- **«Lo que se tilda es lo que sale» no incluía el TÍTULO:** la IA también escribe el headline del anuncio, y ni la hoja ni la
  confirmación del chat lo mostraban (la del chat, además, cortaba el gancho a 120 caracteres). Ahora salen enteros.
- ⚠️ **El mismo «1,500 → 1,5» vivía en dos lugares más:** el arranque (sus pastillas salen de `fmtDinero`: «$1,000 al mes» se
  leía 1 y quedaba un tope de 1 por día) y los Ajustes, ya en producción (un objetivo «1,500» quedaba en 1,5 y el Stop Loss se
  disparaba con US$3). **Arreglar el campo que se vio no alcanzaba:** se buscó toda lectura de monto del área. `leerMonto` y
  `montoDelTexto` viven ahora en `lib/media-buyer/monto.ts`; código nuevo que lea un monto escrito pasa por ahí.
- **Una guarda sin tiempo es una trampa:** «aplicada» con `creados` vacío quedaba trabada para siempre (una subida de creativos
  reintentada por el camino equivocado, o un lanzamiento cortado). `seEstaCreando` vence a los 10 minutos, y `lanzar` ya no
  toma una subida de creativos.

*26/10/2026, chat «Media Buyer» (`claude5`).*

## Las lecturas de Meta del cron, de la salud y del modal del anuncio, por Zernio; y CAPI por la misma conexión (25/10/2026)

**Vive en:** `lib/meta-ads.ts` (`fetchMetaInsights`, `fetchAdCreatives`, `fetchAdsetBudgets`) · `lib/meta-health.ts`
(`fetchAccountRaw`) · `lib/meta-desgloses.ts` · `app/api/ad-insights/route.ts` · `lib/meta-capi.ts` · la vía, en
`lib/meta-via.ts`. El contexto entero (por qué, lo medido, lo que falta): `docs/hallazgos-integraciones.md` → «Meta entero por
la Zernio del negocio».

- **El camino es UNO para todas las lecturas: `canalMeta()`.** Zernio primero si el negocio tiene su conexión (y Zernio está
  activo para él); el token de Meta de siempre, de respaldo. Una lectura que falla por Zernio vuelve a intentar por el token SÓLO
  si el negocio lo conserva (`canal.respaldo`); nunca para escribir. Código nuevo que lea Meta con el token del negocio pasa por
  `canalMeta` (AGENTS.md).
- **El paso directo de insights hace que no haga falta otro parser**: las filas son las de Meta, con los mismos campos
  (`CAMPOS_INSIGHTS`, compartidos por las dos ramas del cron). Lo que cambia son los NOMBRES de la query (`actionBreakdowns`,
  `fromDate`/`toDate`, cursor `after`) y el tope: 500 filas por página.
- ⚠️ **Presupuesto y saldo vienen en UNIDADES por Zernio, en la unidad mínima por Meta.** El cron guarda el de Zernio tal cual
  (sin `desdeUnidadMeta`); la salud lo vuelve a la mínima (`aUnidadMeta`) porque `computeAccountHealth` divide.
- **El creativo por Zernio sale de UN árbol del día** (`/ads/tree?hasDelivery=true`), no de un pedido por anuncio, y trae el
  permalink (`instagramPermalinkUrl` primero, si no `effectiveObjectStoryId`): la misma regla que con el token.
- **Para el Media Buyer (avisado):** `GET /v1/ads/accounts/live` trae el interruptor PROPIO de campañas y conjuntos
  (`configuredStatus`) además de la entrega (`platformCampaignStatus` / `platformAdSetStatus`). Es lo que la entrada del Media
  Buyer anotó que el árbol no tiene (`arbolDesdeZernio` toma la entrega como interruptor).
- **CAPI:** sale primero por Zernio (`POST /v1/ads/conversions`, la identidad EN CLARO, `eventId` obligatorio); si Zernio no
  tiene permiso sobre el píxel, por la Graph API con el token del píxel (`META_CAPI_TOKEN`); el `META_ACCESS_TOKEN` de antes,
  último. El `custom_data` (los campos de CRM del conjunto de datos, `hecho_en`) es el MISMO en los dos caminos: va por
  `platformData`, que Zernio mezcla en `custom_data`. Los cuatro eventos y sus `event_id` no cambian (entrada «Por CAPI salen
  sólo cuatro cosas», arriba). Tutorial para el cliente: `docs/tutorial-capi-pixel.md`.

- **La transcripción por Zernio** (`lib/transcribe.ts`): el video y la imagen salen de `GET /v1/ads/{adId}/media`, los links
  directos que Zernio lee en vivo de Meta. Es la salida a «Meta dejó de devolver `source`» (arriba), SIN MEDIR con un video
  real. ⚠️ Con la clave de Zernio y sin token, un fallo NO cae al `META_ACCESS_TOKEN` del entorno (sería el de otro negocio):
  los tres llamadores piden `accesoDeMeta` y cortan sin acceso. Los links vencen (imagen ~24 h, video ~12 días): se bajan en
  el momento.

- **El nivel anuncio, medido el 25/10 en la cuenta de MaKo** (con la tarjeta cargada; la campaña de prueba del Media Buyer, en
  pausa): el conjunto en vivo da presupuesto diario **1** (USD en unidades: la conversión no multiplica ni divide), y el anuncio
  en pausa trae imagen, miniatura y su post (`effectiveObjectStoryId` sobre la página «Hola MaKo»), así que el permalink sale
  igual que con el token; las finanzas traen el medio de pago. ⚠️ **Un anuncio BORRADO sale en `/ads/tree` con `status:
  cancelled` y `configuredStatus: ACTIVE`**: leer sólo el interruptor propio da por prendido a un anuncio que ya no existe
  (avisado al Media Buyer). Sin entrega, los insights siguen vacíos: las filas reales recién con un negocio que gaste.

**Sin hacer:** el reproductor del anuncio, `monedaDesdeMeta` (con Zernio la moneda sale de la fila de insights,
`account_currency`, o de la cuenta) y `lib/meta-ads-create.ts`. El árbol, el selector del CRM y las escrituras de
`lib/meta-write.ts` se hicieron el 26/10 (la entrada de abajo).

*25/10/2026, chat «Zernio y CAPI» (`claude5`).*

## Un negocio SIN token administra sus campañas por Zernio: primero el árbol, después las escrituras (26/10/2026)

**Vive en:** `lib/meta-escribir-zernio.ts` (las escrituras) · `lib/meta-write.ts` (`escribirEnMeta`, la rama) ·
`lib/meta-via.ts` (`arbolPorZernio`) · `lib/meta-health.ts` (`edgesPorZernio`, `campanasYConjuntosCrudos`) ·
`lib/api-mako/areas/ads.helpers.ts` (`estadoVivoMeta`) · lo puro, en `lib/zernio-meta-cuerpo.ts` · la prueba,
`scripts/prueba-zernio-escribir.mts`.

- ⚠️ **El diagnóstico obvio («faltan las escrituras por Zernio») era la mitad.** Un negocio conectado sólo por Zernio tenía el
  árbol de la salud VACÍO: las tres edges (`campaigns`, `adsets`, `ads`) pedían el token, fallaban suave y el árbol salía
  `parcial`. Toda propuesta de la API (`proponer_estado_*`, `_presupuesto_*`, `_renombrar_*`, `_eliminar_*`) busca la entidad
  en ese árbol antes de escribir: contestaba «No encuentro esa campaña» aunque `metaWrite` hubiera sabido escribir. Primero el
  árbol, después la escritura.
- **El árbol por Zernio se arma de DOS lecturas** (no hay una sola que lo traiga): campañas y conjuntos EN VIVO de
  `GET /v1/ads/accounts/live` (con su interruptor propio y su presupuesto) y los anuncios de la lista SINCRONIZADA `GET /v1/ads`
  (Zernio no lee en vivo los anuncios de una cuenta). La lista guarda lo borrado (`status: cancelled`, a veces con
  `configuredStatus: ACTIVE`): un anuncio entra sólo si su conjunto está vivo. Lo que no hay por Zernio: el `created_time` de
  campañas y conjuntos, y las recomendaciones de Meta (su `/ads/recommendations` es sólo de Google). El aprendizaje sale de un
  pedido por conjunto (`GET /ads/ad-sets/{id}?fields=learning_stage_info`), sólo de los que entregan, hasta 20.
- **De quién es un id, por Zernio:** `GET /ads/campaigns/{id}` y `/ads/ad-sets/{id}` son el paso directo de Meta (`fields=
  account_id,configured_status,effective_status`, con `accountId`); un anuncio, `GET /ads/{id}?live=true`
  (`platformAdAccountId`). Una campaña que la conexión no ve vuelve como el **400** de Meta, no como un 404: para el negocio, no
  existe. Medido: un id ajeno rebotó con 404 sin escribir.
- ⚠️ **Zernio contesta 200 al pausar un anuncio BORRADO** (medido el 26/10 en la cuenta de MaKo): con el token, Meta lo
  rechazaba. Antes de escribir se mira si la entidad está borrada (`siYaEstaBorrada`): borrarla otra vez ya está hecho;
  cualquier otra escritura rebota.
- ⚠️ **Borrar el ÚLTIMO anuncio de un conjunto que creó Zernio se lleva el conjunto y la campaña** (su OpenAPI lo dice; medido
  el 26/10: el anuncio, el conjunto y la campaña quedaron `DELETED` con un solo DELETE). Con el token no pasaba. La API lo avisa
  en el resumen antes del «sí».
- ⚠️ **La `Idempotency-Key` devuelve la respuesta ORIGINAL aunque lo creado ya no exista.** El script de prueba usaba una clave
  por día: la segunda vuelta recibió los ids de la campaña de la primera, ya borrada, y no creó nada. La clave protege el
  reintento de UNA creación; dos creaciones a propósito llevan dos claves.
  Lo mismo al crear un ANUNCIO (revisión del tren-m): crear, borrar y volver a pedir lo mismo dentro del tramo de 10 minutos de la
  clave devolvía el borrado y MaKo decía «creado». Ahora se relee en vivo y, si vino borrado (`cancelled` o entrega `DELETED`;
  el interruptor no sirve, vuelve `ACTIVE`), se pide UNA vez más con otra clave (`vinoBorrado`, lib/zernio-meta-cuerpo.ts).
- **Una campaña «vacía» se puede pausar por Zernio si alguna vez tuvo anuncios** (Zernio la encuentra por sus anuncios
  guardados). El 404 que midió el Media Buyer es de la campaña que NACIÓ vacía (`POST /ads/campaigns`); ahí el texto propio
  dice que se le agregue un anuncio o se borre.
- **El tope de anuncios activos gratis de Zernio** (`ads_allowance_exceeded`, por cuenta de Zernio sin medio de pago) frena
  prender y subir presupuesto: el error dice que se cargue el medio de pago en Zernio. No es de Meta.
- **Medido de punta a punta el 26/10 en `act_1426493815659364`, gasto 0:** crear (campaña, conjunto y anuncio en pausa; el
  conjunto y el anuncio nacen prendidos y se pausaron en el acto por `metaWrite`), el árbol y el selector de campañas por
  Zernio (presupuesto 1 USD leído como 1), renombrar los tres niveles, presupuesto 1 → 2 → 1, prender y pausar la campaña y el
  anuncio, y borrar el conjunto, la campaña vacía y el anuncio; por `metaWrite` y por los runners de la API de MaKo y el doer.
  La cuenta quedó con 0 campañas y 0 conjuntos.
- ⚠️ **Para correr la API de MaKo en un script** (fuera de Next), `getMetaHealth` pide dos cosas que pone el servidor:
  `globalThis.__incrementalCache` (una vacía alcanza) y `globalThis.AsyncLocalStorage` (el de `node:async_hooks`). Sin ellas,
  «incrementalCache missing» o «AsyncLocalStorage accessed in runtime where it is not available»: no es el código.
- **`lib/meta-ads-create.ts` por Zernio, sin otro parser:** `GET /ads/campaigns/{id}`, `/ads/ad-sets/{id}` y
  `/ads/creatives/{id}` son el paso directo de Meta con `fields` tal cual, ANIDADOS incluidos (`adsets.limit(10){…}` en una
  campaña): una sola puerta (`leerObjetoMeta`) elige la vía y devuelve la forma de la Graph API. El anuncio sale del guardado de
  Zernio (`/ads/{id}?live=true`: cuenta, nombre, entrega, el id del creativo) más su creativo por el paso directo. Medido el 26/10
  en la cuenta de MaKo: la cuenta, los píxeles, los datos de campaña y conjunto, el público (lectura), leer y cambiar los textos
  del anuncio (releído cambiado), y agregar un anuncio con la imagen de otro y otro reusando su post, los dos nacidos en pausa.
- ⚠️ **`GET /ads/images` corta en 100 por página** (`limit=200` → 400 «Too big»). Un `catch(() => null)` lo convertía en «la
  imagen no tiene dirección pública»: **el diagnóstico obvio era el equivocado**, la imagen estaba. Un fallo de Zernio sube tal
  cual.
- ⚠️ **La misma `Idempotency-Key` con OTRO cuerpo** contesta «already used with a different request». La clave por nombre de
  anuncio chocaba en cuanto cambiaba el creativo del original; ahora sale del cuerpo entero y una ventana de 10 minutos.
- **Formularios por Zernio:** `GET /ads/lead-forms` lista los de la página de la conexión (la OpenAPI no declara la forma de cada
  uno: vino el crudo de Meta, `id`, `name`, `status`); `POST /ads/lead-forms` los crea con el contenido en
  `platformSpecificData`, que se arma DESDE `paramsFormulario` (mismas preguntas y pantalla final, sin una segunda copia de la
  regla); `DELETE /ads/lead-forms/{id}` los archiva. Zernio parsea estricto: un campo con el nombre de la Graph API es un 400.
- **(29/10: hecho para los cambios de la API, ver «DÓNDE, HASTA…» abajo; el crudo entero de la ruta `adset-targeting` sigue sin camino.) Editar el público por Zernio NO estaba hecho:** `PUT /ads/ad-sets/{id}` recibe SU forma de segmentación (`TargetingSpec`,
  con fusión de claves), no el crudo de Meta que arma `editarPublicoConjunto`. Sin token, se dice así (`sinPublicoPorZernio`).
- **Un negocio sin token ya no oye «configura META_ACCESS_TOKEN»:** el token está deprecado y no se pide. Lo que todavía no
  tiene camino por Zernio dice eso y manda al Administrador de anuncios (`cred`, lib/meta-ads-create.ts).
- **(29/10: ya la tiene, «Nueva campaña» por Zernio: ver «DÓNDE, HASTA…» abajo.) «Crear una campaña» no tenía pantalla, ni con token ni con Zernio.** El asistente se borró con la vista vieja del Ads
  Manager (25/10); las rutas `campaign-create`, `adset-add`, `ad-add` y `ad-edit` no las llama ninguna pantalla, y la API de
  MaKo no declara crear campañas. Lo único que crea desde la app es «Subir creativos» del Media Buyer (un anuncio por archivo
  en un conjunto que ya existe, por Zernio).

**Sin hacer (con dónde vive):** lo de `lib/meta-ads-create.ts` que sigue con el token: crear campaña y conjunto
(`createCampaign`, `createAdSet`, `addAdsetToCampaign`; el anuncio en un conjunto YA va por Zernio) y las subidas
(`uploadAdImage`/`uploadAdVideo`, la ruta `creative-upload`), editar el público (`editarPublicoConjunto`), `formularioBase` (la web
de la página; listar y CREAR formularios ya van por Zernio, medidos en la página de MaKo: el de prueba quedó ARCHIVADO, porque un
formulario no se borra; una página distinta de la de la conexión no tiene camino por Zernio), crear públicos (`createCustomAudience`; LISTARLOS ya va por Zernio, `GET /ads/audiences` con el id de Meta, pero la cuenta de
MaKo no tiene ninguno: la forma de cada fila sale de la OpenAPI, SIN medir con datos), los eventos del píxel y las
conversiones (`listPixelEvents`, `listCustomConversions`; los píxeles ya van por Zernio), el alcance (`alcanceGeo`; BUSCAR intereses y lugares ya va por Zernio, `/ads/targeting/search`, con los ids de Meta y el
mismo `lugarDesdeBusqueda` y `ordenarLugares`, medido con «Córdoba» y «marketing digital»),
identidades (`paginasDeGanadores`, `getInstagramActorId`; `identidadesMeta` ya va por Zernio, `GET /ads/instagram-accounts`,
medido con la conexión de MaKo: la identidad `page_backed` es la página usada como Instagram, no una cuenta, y queda afuera), `getAdsAprobacionPendiente` y `generatePreviews`.
Zernio tiene endpoint para cada una (`/ads/images`, `/ads/videos`, `/ads/lead-forms`, `/ads/audiences`, `/ads/interests`,
`/ads/targeting/*`, `/ads/preview`). Fuera de ese archivo: el barrido de leads (`pollMetaLeads`, lib/meta-leads.ts →
`GET /v1/ads/leads`) y el reproductor (`app/api/anuncios/video/route.ts`: dibuja el plugin de video de facebook.com que sale del `embed_html`, y
Zernio no lo da; su `/ads/{adId}/media` trae el .mp4 directo, así que hacerlo por Zernio cambia lo que dibuja la pantalla,
app/dashboard/graficos/ReproductorAnuncio.tsx). Duplicar campañas y
conjuntos tampoco existe en MaKo (con token, en ningún lado; el Media Buyer duplica anuncios por Zernio).

*26/10/2026, chat «Zernio y CAPI» (`claude5`).*

## Las fallas que quedaban de tren-m, la pantalla como Hoy, las rutas viejas y subir creativos por la API (27/10/2026)

**Vive en:** `lib/media-buyer/topes.ts` (`presupuestoCambioDesdeLaPropuesta`) · `lib/media-buyer/ejecutar.ts` ·
`lib/media-buyer/monto.ts` (`revisarMontoEditado`) · `lib/media-buyer/tacticas.ts` (`mezclarTacticas`) ·
`lib/media-buyer/agentes.ts` (`cambioDeAgente`) · `lib/media-buyer/plan.ts` (`lugaresParaPropios`) · `lib/media-buyer/corrida.ts` ·
`app/ads-manager/Ajustes.tsx` · `Automatizaciones.tsx` · `Autopilot.tsx` (`AlertasProtect`) · `aa.css` ·
`app/api/ads-manager/creative-signurl/route.ts` · `lib/ads-staging-firma.ts` · `lib/media-buyer/subir.ts` (`revisarSubida`) ·
`lib/media-buyer/creativos.ts` (`leerPedidoDeSubida`) · `lib/api-mako/validar.ts` (`distintoAlRevisar`). Lo hizo una sesión en la
nube; tests: `tests/media-buyer-verificacion-m.test.ts`, `media-buyer-pantalla-m.test.ts` y `media-buyer-subir-api.test.ts`, cada
pieza probada rompiéndola.

- **Falla 1, el presupuesto que cambió por otro lado.** `presupuestoYaCambiado` mira sólo las decisiones del Media Buyer: un
  cambio a mano, por chat (`proponer_presupuesto_*`) o desde el Administrador no se veía, y «el mismo % sobre el de hoy» componía.
  Ahora, al lanzar, el presupuesto en vivo se compara con el de cuando se propuso (`antes.presupuesto`, tolerancia 1%): si cambió,
  la decisión **vence** con el motivo y la corrida de mañana la vuelve a mirar. No se escala: un número que alguien movió a
  propósito no se sabe si se movió por la misma razón.
- **Falla 2, la mezcla de tácticas.** `mezclarTacticas` mezclaba por táctica: una pestaña vieja que cambiaba el estado de un
  agente mandaba la táctica entera y pisaba los umbrales o las campañas que otra había cambiado. Ahora mezcla campo por campo
  (los umbrales, por id; `campanas: null` es «toda la cuenta») y el panel de agentes y la API mandan sólo `{ estado }`.
- **Falla 9, la IA que se gastaba de más.** Con el cupo del Esencial lleno por el motor, a cada agente propio se le preguntaba en
  cada corrida y su respuesta se descartaba. `lugaresParaPropios` (cupo − lo de hoy − lo nuevo del motor) se calcula antes, y con
  0 no se llama a la IA.
- **La baja de 80% o más.** El freno de ×5 de la falla 4 también frenaba una baja deliberada, y el mensaje culpaba al separador
  de miles. Ahora `revisarMontoEditado` separa: subir 5 veces o más no sale (eso SÍ suele ser un separador mal leído); bajar 5
  veces o más pide una confirmación que lo dice («Bajarlo de $100 a $15 por día es 85% menos») con «Bajar a $15 por día» y «No
  bajar». Por la API, `lanzar_decision_media_buyer` pone el aviso en el resumen que se confirma (`confirmarBaja` en el payload).
- ⚠️ **Ajustes BORRABA un monto que no entendía.** La versión de Madgicx mandaba `Number.NaN` «para que lo rechace el servidor»,
  y `JSON.stringify(NaN)` es `null`: el servidor recibía «sin tope» y lo guardaba. Ahora el monto ilegible no sale y lo dice un
  aviso (`conMonto`). La regla: un valor que se quiere rechazar no se codifica como un valor que JSON no tiene.
- **La pantalla.** Ajustes y Automatizaciones con el molde de Settings de la casa (`app/_ui/Ajustes.tsx`: nombre a la izquierda,
  control a la derecha, guarda al instante); Automatizaciones, una fila por táctica con su estado y su detalle (el interruptor
  vive en el detalle, y `?t=surf` lo abre: antes el link del lápiz no abría nada). Protect como la lista de Actividad (un punto,
  el título y un botón). Campañas y Biblioteca con la caja del chat arriba, como Hoy, y los números del mes en una línea del pie
  del árbol (`lineaDelMes`). `mb.css` y `mb-paleta.css` borrados: el modal de subir creativos usaba clases de `mb.css` que en
  `/ads-manager` no se cargaban (sólo las subpáginas la importaban), así que se veía sin estilos. Pasó a `aa.css`.
- **Las quince rutas viejas de `app/api/ads-manager`, borradas** (las usaba sólo el Ads Manager borrado el 25/10; queda
  `creative-signurl`). ⚠️ **El diagnóstico obvio («nadie las llama, se borran») era la mitad:** `creative-upload` era la que
  BARRÍA el staging en cada subida, y sin ella nada limpiaba el bucket. El barrido pasó a la firma (cada subida empieza
  firmando). Quedaron sin call site `estadoVideo` y `generatePreviews` de `lib/meta-ads-create.ts` y `montadosDelWorkspace` /
  `tomasDelWorkspace` de `lib/creativo-mako-fuentes.ts`: no se borraron (el último lo sigue leyendo el Video Editor para resolver
  una referencia). Después de borrar rutas, en una PC: `npx next typegen`.
- **Subir creativos por la API de MaKo.** Estaba en `FALTA` («por la API no hay cómo mandar un video»). Entró en los dos pasos de
  la pantalla: `preparar_subida_media_buyer` (lectura, sólo HTTP: los conjuntos, los textos de partida del conjunto y una URL
  firmada por archivo para un PUT) y `subir_creativos_media_buyer` (acción de plata, confirmada en `/mako/revisar`). La firma
  (`lib/ads-staging-firma.ts`), el pedido (`leerPedidoDeSubida`) y la revisión (`revisarSubida`) son las MISMAS funciones que usa
  la pantalla. Al proponer se mira que cada archivo esté en el staging (`faltanEnStaging`, de a uno por su nombre: la carpeta
  es de todos los negocios y no se lista entera).
- ⚠️ **`fijoAlRevisar` no protegía una lista de objetos.** `aplicarPropuestaGenerica` comparaba con `String()`, y
  `String([{…}])` es «[object Object]» para cualquier lista del mismo largo: los archivos de una subida se podían cambiar al
  revisar bajo el resumen de otros. `distintoAlRevisar` compara una lista de objetos (o un objeto) entera; lo demás, como siempre.
- ⚠️ **La firma de una sesión en la nube NO va en `CUENTAS`** (`app/admin/dev/_registro/tipos.ts`). Para firmar el hito se sumó
  una fila «nube» y el Uso del Ops Center pasó a listar SEIS cuentas: `lib/centro-uso.ts` toma cada fila de esa tabla como una
  cuenta con su cuota. Lo cazaron dos tests de `tests/centro-uso.test.ts` en la corrida contra la base; la firma vive aparte
  (`FIRMA_NUBE`, `cuentaDeHito`). Una tabla que se usa para dos cosas no se amplía por una sola.
- **Lo que queda sin hacer:** un video tarda minutos en Zernio y la confirmación de `/mako/revisar` tiene 300 s, igual que la
  pantalla (`/api/media-buyer`): con varios videos en una subida se puede cortar a mitad (lo creado queda registrado y se
  deshace). El path del staging no lleva el negocio (es `nueva/<ms>-<azar>-<nombre>`): lo protege el azar, no un dueño. No se
  midió contra una cuenta real (las escrituras las mide el Cerebro en la PC).

## DÓNDE, HASTA, «lánzame una campaña» y el Stop Loss del día: lo prometido a la agencia de Thiago (29/10/2026)

**Vive en:** `lib/media-buyer/zona.ts` (la regla pura: zona y fecha de fin) · `lib/media-buyer/publico.ts` (el público en vivo y
los lugares confirmados contra Meta) · `lib/media-buyer/campana-reglas.ts` + `campana.ts` (la campaña nueva) · `del-dia.ts` +
`vigia.ts` + `app/api/cron/media-buyer-vigia/route.ts` (cada dos horas) · `lib/zernio-publico.ts` (el público en la forma de
Zernio) · `app/ads-manager/NuevaCampana.tsx`, `ElegirLugares.tsx` · `supabase/migrations/0350_media_buyer_donde_hasta.sql` ·
`tests/media-buyer-donde-hasta.test.ts`, `tests/media-buyer-del-dia-y-campana.test.ts`. La lista de promesas:
`docs/promesas/2910-llamada-thiago.md` (los items 3 y 4 de «no existe», y 12:19 y 29:15 de «a medias»).

- ⚠️ **El diagnóstico obvio de la zona («filtrar por el país del conjunto en el árbol») era el equivocado: el árbol no trae el
  público.** Ni el de Meta ni `/ads/tree` de Zernio. Se lee en vivo por conjunto (`GET /ads/ad-sets/{id}?fields=targeting`, el
  paso directo) y SÓLO de lo que se va a prender o subir: unas pocas lecturas por corrida. La corrida filtra antes del cupo, y
  `lanzar` y `deshacer` lo vuelven a mirar al escribir (`frenoDeZonaYFecha`, ejecutar.ts): entre proponer y lanzar alguien pudo
  cambiar el público.
- **«No sé» es FUERA, y una ciudad con radio es «no sé».** Un punto sin país, un `country_groups`, un geo que meta-geo no
  entiende o un conjunto que no se pudo leer no se prenden ni se suben. «Madrid +80 km» llega a Toledo: con radio, sólo un PAÍS
  de la zona lo contiene (revisión adversarial, hallazgo 6). Para la demo: con zona «Madrid», un conjunto «Madrid +17 km» no se
  escala; con zona «España», sí.
- ⚠️ **Una pausa con clave SIN día que no salió la primera vez no salía nunca** (revisión adversarial, hallazgo 1). La clave de la
  pausa por fecha es `hasta:campaign:<id>:<fecha>` (una vez por fecha: si una persona la vuelve a prender, gana la persona) y
  `guardarPropuestas` ignora los duplicados. Si Zernio fallaba, la corrida se cortaba o un «mirá la cuenta» por chat sólo
  proponía, la fila quedaba abierta y la campaña gastaba pasada su fecha para siempre. Ahora se relanza lo guardado
  (`pausasPendientes`), la pausa por fecha no vence, sale también con `soloProponer`, y el vigía la lanza PRIMERO, antes de lo
  que puede fallar. **Regla:** una decisión automática deduplicada por una clave sin día se relanza desde la fila guardada.
- ⚠️ **Zernio IGNORA EN SILENCIO el `endDate` de un conjunto de Meta** (OpenAPI v1.416.0): el de arriba del cuerpo es «Reddit
  only… every other platform ignores it: nothing is written and no error». En Meta va en `platformSpecificData.endDate`. Por eso
  la fecha de fin de lo que ya corre la hace cumplir MaKo (corrida y vigía), y sólo la campaña NUEVA lleva `endDate` al crearse.
- **El público por Zernio, leído sólo en la OpenAPI (SIN medir con una cuenta):** «only the keys you send change», pero «setting
  any location replaces every location list». Un lugar que Zernio no recibe (barrio, localidad, partido, una dirección sin
  coordenadas), algo que meta-geo no entendió o un `location_types` distinto de `home,recent` frenan el cambio de lugares ENTERO:
  mandar los otros borraría ése y el público crecería. Advantage+ no tiene campo al editar (sólo al crear). `placements`
  reemplaza el set: se reenvían las posiciones de cada plataforma que queda. Con Zernio se escribe SIEMPRE por Zernio, aunque el
  negocio conserve el token de antes (antes, con respaldo, escribía por el token).
- **Los lugares que manda quien llama no deciden nada** (hallazgo 3): una ciudad con el id de Rosario y el nombre «Madrid» pasaba
  por adentro de una zona «Madrid», y la confirmación decía «Madrid». `resolverLugares` busca cada nombre en Meta y exige el
  mismo id; vale lo que dice Meta.
- **Crear una campaña: el registro va ANTES** (con la entidad en 0, se completa al volver Zernio): sin la 0350 el CHECK de `tipo`
  rechaza la fila y no se crea nada sin su Deshacer. ⚠️ **La clave de idempotencia sale de lo PEDIDO, no del cuerpo:** un archivo
  subido se firma de nuevo en cada pedido, y con la clave del cuerpo dos clics eran dos campañas. La clave cuenta las veces que la
  misma se deshizo o se rechazó (con la misma clave Zernio devuelve la respuesta de la primera vez, aunque esté borrada), y un
  corte por tiempo o un 5xx queda `CREACION_INCIERTA`: la misma campaña no se vuelve a crear hasta que alguien mire la cuenta
  (hallazgo 2). `status: PAUSED` sólo pausa lo de arriba: «en pausa» manda los cuatro estados.
- **El Stop Loss del día sólo existe por Zernio:** el cron de Meta trae el día de ayer; el gasto de HOY lo da `/ads/tree` con
  hoy. Un negocio sólo con el token (deprecado) no lo tiene, y el vigía lo dice. No pausa lo que viene rindiendo (la semana
  dentro del objetivo) ni lo que MaKo tocó en 24 h, y su objetivo es el del resultado de HOY: el de la última corrida pudo
  calcularse con otro (hallazgo 5).
- **Un campo de fecha que guarda en cada tecla manda `0002-11-05` mientras se escribe el año** (hallazgo 4): existe, y pausaba la
  campaña en la próxima vuelta del vigía. Se guarda al salir del campo, `fechaValida` pide un año entre 2020 y 2100 y el servidor
  no acepta una fecha que ya pasó.
- **Lo guardado se lee entrada por entrada** (hallazgo 8): una fecha rota ya no se lleva las otras 299, y una zona ilegible no se
  lee como «sin zona» (que sería subir en todos lados) sino como una zona que no contiene nada.

- **Lo que crea plata sin medir nace en PAUSA, y se RELEE** (revisión de plata de Integración, 29/10: «entra con bajas»; su informe,
  C:/dev/revisiones/2910-revision-plata-media-buyer-a2b0088a3.md, lo cosecha Integración). Hasta medir `POST /ads/create`, toda
  campaña nueva nace en pausa (`CAMPANA_PRENDIDA_MEDIDA = false`, campana-reglas.ts) y, al volver Zernio, se lee lo que guardó Meta
  contra lo pedido (`releerCreada` → `diferenciasDeLaCreada`): lugares de más o de menos, fuera de la zona, sin `end_time`, y la
  campaña PRENDIDA si se pidió en pausa (se pausa en el acto). Lo distinto se muestra antes de volver al Media Buyer. **Regla:** una
  escritura que gasta y no se midió nace apagada y se relee; se prende con la medición, no con la OpenAPI.
- **La fecha de fin se cumple con el Media Buyer APAGADO** (M1): apagado es como arranca todo negocio, y una campaña creada «hasta el
  30» no la cuidaba nadie. El vigía mira sólo las fechas, y `lanzar` deja salir sólo la pausa por fecha (sin topes ni interruptor).
- **El candado de una creación es la clave de su fila** (M6): `manual:campana:<huella>:<día>:<intento>`, sin la hora: dos pedidos
  iguales a la vez chocan en `unique(workspace_id, clave)`. Y la fila nace marcada «no sé si se creó», con un techo propio de 270 s
  debajo del de la ruta (M5): si la función muere en medio del POST, queda la marca y no una «aplicada» sin id.

**Sin hacer, con su archivo:**
- **Medir en la cuenta de MaKo** (con el OK de Martín: escribe en una cuenta real, en pausa y con gasto 0): `PUT /ads/ad-sets/{id}`
  con `targeting` y con `placements`, y `POST /ads/create` con `endDate`, `promotedObject`, `leadGenFormId`, `existingCreativeId`
  y los cuatro estados en pausa. El patrón está en `scripts/media-buyer-medir-zernio.mts`. Nada de esto se probó contra Zernio. Con la
  prueba pasada, `CAMPANA_PRENDIDA_MEDIDA = true` (campana-reglas.ts) vuelve a dejar elegir «prendida».
- **La fecha de fin escrita en Meta** (`platformSpecificData.endDate` en cada conjunto): hoy la cumple MaKo; si MaKo no corre,
  Meta no corta sola.
- **MaKo Mobile** (`app/m/ads/MediaBuyerM.tsx`): no tiene Dónde, Hasta ni «Nueva campaña».
- **El merge de `hasta_campanas` no es atómico** (`guardarConfig`, store.ts: lee, mezcla y escribe): una campaña nueva y un
  cambio en Campañas al mismo tiempo pueden perder una fecha. Pide un `update` en SQL.
- **La zona no se mira al editar el público por la API** (`proponer_editar_publico_conjunto`): agregar un pin fuera de la zona a
  un conjunto vivo es una acción de la persona, confirmada en /mako/revisar; después, Surf no lo escala.
- **«Lanzar una campaña» de Hoy** (`app/ads-manager/Hoy.tsx`) sigue abriendo el arranque con la calculadora; «Nueva campaña» se
  abre desde la cabecera del Media Buyer.

*29/10/2026, chat «Media Buyer de Thiago» (`claude3`).*

## La revisión de plata del Media Buyer de Thiago, y la guarda que el tren encontró (29/10/2026, Integración)

El informe está en `C:/dev/revisiones/2910-revision-plata-media-buyer-a2b0088a3.md`, y la sonda en el scratchpad de Integración
(`sonda-plata-mb.test.mts`). Veredicto: «entra con bajas», sin ALTA. Ninguna campaña sale sin la confirmación de un admin, no se
cruzan cuentas de anuncios, el vigía no usa IA y cada negocio escribe con su clave dueña (`cfgDeCuenta`). La baja (nacer en pausa
y releer) y M1, M5 y M6 quedaron hechas en `b4ee3c411`: ver la entrada de arriba.

- ⚠️ **Una acción NUEVA que gasta y se confirma en /mako/revisar nace con el agujero si no marca un id fijo.**
  - `tests/revisar-fijo.test.ts` (el BARRIDO) dio rojo en el tren-af: `proponer_crear_campana` tenía `formularioId`, `pixelId`,
    `videoId` y `anuncioId` editables al revisar.
  - El título que se confirma es el de la propuesta. Cambiar el píxel o el video ahí lanzaba otra campaña bajo ese título.
  - Integración los marcó `fijoAlRevisar` (`c9d23904c`), porque el chat de Ads estaba archivado.
  - **Regla:** al sumar una acción con `costo: dinero` y `confirmacion: pantalla`, correr ese test ANTES del VERDE. Los tests
    del área no lo llaman.
- **Abierto (MEDIA):**
  - **M3:** con una cuenta de anuncios compartida entre dos negocios (ws13 y ws14), sólo cuenta la configuración del de id más
    chico. La zona y la fecha del otro no se aplican nunca (`vigia.ts`, `ordenRotado`).
  - **M4:** si la función se corta entre reclamar la decisión y escribir en Zernio, la pausa por fecha queda «aplicada» sin
    haberse escrito y no se relanza (`ejecutar.ts`, `zona.ts`, `store.ts`). Probado con S6.
  - **M2, en parte:** el cuerpo de `POST /ads/create` sigue sin medirse. La relectura de `b4ee3c411` avisa lo distinto, pero
    la zona no frena una campaña ya creada.
- **Abierto (BAJA, entre otras del informe):** dentro de una automatización no hay ninguna guarda al ejecutar
  `proponer_crear_campana`; sólo el editor la saca de la lista.

## «Hoy no hay cambios — Todo anda dentro de tu objetivo»: el cartel que le decía que estaba todo bien a quien no había empezado (30/10/2026)

**Síntoma.** El Media Buyer sin cambios para hoy mostraba *«Hoy no hay cambios — Todo anda
dentro de tu objetivo. Vuelvo a mirar mañana.»* Una cuenta recién conectada, **sin una sola
campaña y sin haber gastado un peso**, leía que todo andaba dentro de su objetivo. No
fallaba nada: entregaba, con la cara del éxito, el peor cartel posible.

**Causa — no era la frase, era con qué se elegía.** La condición mira **dos** cosas: que
`hoy.length === 0` y que `config.encendido` sea `true`. Nunca pregunta si el negocio tiene
campañas. Y el diagnóstico obvio —«pasale las campañas a la pantalla»— era el equivocado:
**esa pantalla no tiene las campañas y no las puede pedir.** `app/ads-manager/page.tsx`
carga config, decisiones, metas del mes, token y cupo; el árbol de la cuenta **en vivo** lo
trae `lienzoMediaBuyer`, y a propósito sólo cuando se abre la pestaña Campañas, porque lee
Meta. Pedirlo en «Hoy» es una llamada a Meta en cada carga de la tab.

El dato que **sí** llega es el resumen de la última corrida (`ultima_corrida_info`, el mismo
canal por el que ya viajan las alertas de Protect para dibujarse sin releer Meta). Ahí no
estaban las campañas: `ResumenCorrida` guardaba propuestas, lanzadas y alertas, pero no
**qué había en la cuenta**. Contarlas del `datos.arbol` con que el agente YA decidió no
cuesta ninguna lectura más.

**Tres trampas del dato, que es donde se pierde el tiempo:**

- **Un resumen de abstención no tiene números.** La corrida vuelve temprano con `parcial`,
  `datos_viejos`, `moneda_sin_tasa`, `cuenta_compartida`, `apagado` o `sin_tabla`. Si los
  contadores se ponen en cualquiera de esos returns, la pantalla afirma «no tienes campañas»
  sobre una cuenta que **no se vio entera**. Van **sólo** en el return de `ok`.
- **`marcarCorrida` hace upsert: el resumen de hoy borra el de ayer.** Apagar el agente deja
  `{estado:'apagado'}` y con eso se pierden los contadores de la última corrida buena. Es
  correcto que se pierdan —no sabemos qué hay ahora— y por eso apagado dice «estoy apagado»
  y no inventa el estado de las campañas.
- **Un resumen VIEJO dice `ok` y no trae los números.** Todo negocio que ya corrió antes de
  este cambio cae ahí hasta su próxima corrida. No alcanza para afirmar nada: `estado === 'ok'`
  **y** `activas > 0` es la única combinación que habilita «no hay nada que mover».

**Orden de los estados: el del próximo paso, no el del dato.** Sin cuenta no hay nada más
que decir. Con la cuenta **vacía** o con **todo en pausa**, prender el agente no mueve un
peso: esos dos van **antes** del interruptor. Y la frase medida va última.

**Regla.** *Un estado vacío es una afirmación: si no sale de algo que medimos, no se
escribe.* Es la misma de [Tres cosas que Ads Manager afirmaba sin haberlas
mirado](#tres-cosas-que-ads-manager-afirmaba-sin-haberlas-mirado-0809) («si el motivo no
sale de la respuesta que acabás de recibir, es una adivinanza con cara de dato»), aplicada
al cartel de una pantalla en vez de a un modal. Y la que la sostiene: **la decisión de qué
dice un estado vacío va en un módulo puro, fuera de las pantallas.** Acá eran dos pantallas
(computadora y teléfono) con la misma frase escrita a mano dos veces, y una rama que
reescribía la pantalla sin tocar la falla.

**Cómo se prueba que sigue arreglado.** `tests/media-buyer-cartel-hoy.test.ts` cubre los
siete estados, y además **lee las dos pantallas** y falla si alguna vuelve a escribir
`Todo anda dentro de tu objetivo` o a fijar el título sin mirar si hay campañas. Esa guarda
atrapa el regreso por merge, que es como la falla volvería.

**Lo que quedó SIN hacer:**

- **El teléfono no sabe si la cuenta está conectada.** `app/m/ads/page.tsx` manda
  `conectada: token ? true : null`: con token es `true`, y sin token queda en «no sé», porque
  preguntarle a Zernio sería una llamada al abrir la pantalla. Un negocio **sin token y sin
  Zernio** cae en el estado del interruptor o en «todavía no sé cómo vienes», no en «conecta
  tu cuenta». Se arregla el día que haya un estado de conexión cacheado por negocio.
- **El otro cartel de la misma pantalla no se tocó:** la rama `nueva` de `MediaBuyer.tsx`
  (`¿En qué te ayudo hoy? — Muevo tu presupuesto de Meta hacia lo que vende`) es una promesa,
  no una afirmación sobre la cuenta, así que no miente; pero tampoco dice en qué estado está
  el negocio.
- **Nada de esto se vio dibujado:** no hay sesión de navegador en la máquina donde se hizo.
  El botón del próximo paso en `NuevoChat` usa `Button`/`ButtonLink` con `marginTop: 18`
  inline, sin clase nueva en `aa.css` (que la rama `nube/media-buyer-2710` reescribe), y en
  el teléfono el paso es un `<p className="aa-m-nota">`. **No verificado en pantalla.**

**Vive en:** `lib/media-buyer/cartel-hoy.ts` (puro, el criterio y los siete textos),
`lib/media-buyer/corrida.ts` (`ResumenCorrida.campanas` / `.activas`, contadas del árbol en
el return de `ok`), `app/ads-manager/MediaBuyer.tsx` y `app/m/ads/MediaBuyerM.tsx` (las dos
pantallas), `app/ads-manager/Hoy.tsx` (`NuevoChat` acepta `accion`), `app/m/ads/page.tsx`
(`conectada`), `tests/media-buyer-cartel-hoy.test.ts`.
- **Falla 1, el presupuesto que cambió por otro lado.** `presupuestoYaCambiado` mira sólo las decisiones del Media Buyer: un
  cambio a mano, por chat (`proponer_presupuesto_*`) o desde el Administrador no se veía, y «el mismo % sobre el de hoy» componía.
  Ahora, al lanzar, el presupuesto en vivo se compara con el de cuando se propuso (`antes.presupuesto`, tolerancia 1%): si cambió,
  la decisión **vence** con el motivo y la corrida de mañana la vuelve a mirar. No se escala: un número que alguien movió a
  propósito no se sabe si se movió por la misma razón.
- **Falla 2, la mezcla de tácticas.** `mezclarTacticas` mezclaba por táctica: una pestaña vieja que cambiaba el estado de un
  agente mandaba la táctica entera y pisaba los umbrales o las campañas que otra había cambiado. Ahora mezcla campo por campo
  (los umbrales, por id; `campanas: null` es «toda la cuenta») y el panel de agentes y la API mandan sólo `{ estado }`.
- **Falla 9, la IA que se gastaba de más.** Con el cupo del Esencial lleno por el motor, a cada agente propio se le preguntaba en
  cada corrida y su respuesta se descartaba. `lugaresParaPropios` (cupo − lo de hoy − lo nuevo del motor) se calcula antes, y con
  0 no se llama a la IA.
- **La baja de 80% o más.** El freno de ×5 de la falla 4 también frenaba una baja deliberada, y el mensaje culpaba al separador
  de miles. Ahora `revisarMontoEditado` separa: subir 5 veces o más no sale (eso SÍ suele ser un separador mal leído); bajar 5
  veces o más pide una confirmación que lo dice («Bajarlo de $100 a $15 por día es 85% menos») con «Bajar a $15 por día» y «No
  bajar». Por la API, `lanzar_decision_media_buyer` pone el aviso en el resumen que se confirma (`confirmarBaja` en el payload).
- ⚠️ **Ajustes BORRABA un monto que no entendía.** La versión de Madgicx mandaba `Number.NaN` «para que lo rechace el servidor»,
  y `JSON.stringify(NaN)` es `null`: el servidor recibía «sin tope» y lo guardaba. Ahora el monto ilegible no sale y lo dice un
  aviso (`conMonto`). La regla: un valor que se quiere rechazar no se codifica como un valor que JSON no tiene.
- **La pantalla.** Ajustes y Automatizaciones con el molde de Settings de la casa (`app/_ui/Ajustes.tsx`: nombre a la izquierda,
  control a la derecha, guarda al instante); Automatizaciones, una fila por táctica con su estado y su detalle (el interruptor
  vive en el detalle, y `?t=surf` lo abre: antes el link del lápiz no abría nada). Protect como la lista de Actividad (un punto,
  el título y un botón). Campañas y Biblioteca con la caja del chat arriba, como Hoy, y los números del mes en una línea del pie
  del árbol (`lineaDelMes`). `mb.css` y `mb-paleta.css` borrados: el modal de subir creativos usaba clases de `mb.css` que en
  `/ads-manager` no se cargaban (sólo las subpáginas la importaban), así que se veía sin estilos. Pasó a `aa.css`.
- **Las quince rutas viejas de `app/api/ads-manager`, borradas** (las usaba sólo el Ads Manager borrado el 25/10; queda
  `creative-signurl`). ⚠️ **El diagnóstico obvio («nadie las llama, se borran») era la mitad:** `creative-upload` era la que
  BARRÍA el staging en cada subida, y sin ella nada limpiaba el bucket. El barrido pasó a la firma (cada subida empieza
  firmando). Quedaron sin call site `estadoVideo` y `generatePreviews` de `lib/meta-ads-create.ts` y `montadosDelWorkspace` /
  `tomasDelWorkspace` de `lib/creativo-mako-fuentes.ts`: no se borraron (el último lo sigue leyendo el Video Editor para resolver
  una referencia). Después de borrar rutas, en una PC: `npx next typegen`.
- **Subir creativos por la API de MaKo.** Estaba en `FALTA` («por la API no hay cómo mandar un video»). Entró en los dos pasos de
  la pantalla: `preparar_subida_media_buyer` (lectura, sólo HTTP: los conjuntos, los textos de partida del conjunto y una URL
  firmada por archivo para un PUT) y `subir_creativos_media_buyer` (acción de plata, confirmada en `/mako/revisar`). La firma
  (`lib/ads-staging-firma.ts`), el pedido (`leerPedidoDeSubida`) y la revisión (`revisarSubida`) son las MISMAS funciones que usa
  la pantalla. Al proponer se mira que cada archivo esté en el staging (`faltanEnStaging`, de a uno por su nombre: la carpeta
  es de todos los negocios y no se lista entera).
- ⚠️ **`fijoAlRevisar` no protegía una lista de objetos.** `aplicarPropuestaGenerica` comparaba con `String()`, y
  `String([{…}])` es «[object Object]» para cualquier lista del mismo largo: los archivos de una subida se podían cambiar al
  revisar bajo el resumen de otros. `distintoAlRevisar` compara una lista de objetos (o un objeto) entera; lo demás, como siempre.
- ⚠️ **La firma de una sesión en la nube NO va en `CUENTAS`** (`app/admin/dev/_registro/tipos.ts`). Para firmar el hito se sumó
  una fila «nube» y el Uso del Ops Center pasó a listar SEIS cuentas: `lib/centro-uso.ts` toma cada fila de esa tabla como una
  cuenta con su cuota. Lo cazaron dos tests de `tests/centro-uso.test.ts` en la corrida contra la base; la firma vive aparte
  (`FIRMA_NUBE`, `cuentaDeHito`). Una tabla que se usa para dos cosas no se amplía por una sola.
- **Lo que queda sin hacer:** un video tarda minutos en Zernio y la confirmación de `/mako/revisar` tiene 300 s, igual que la
  pantalla (`/api/media-buyer`): con varios videos en una subida se puede cortar a mitad (lo creado queda registrado y se
  deshace). El path del staging no lleva el negocio (es `nueva/<ms>-<azar>-<nombre>`): lo protege el azar, no un dueño. No se
  midió contra una cuenta real (las escrituras las mide el Cerebro en la PC).

## Qué se rompe cuando una rama queda TRES DÍAS sin subir: el rescate de `nube/media-buyer-2710` (30/10/2026)

**Vive en:** `app/ads-manager/Ajustes.tsx`, `Lienzo.tsx`, `MediaBuyer.tsx`, `mb.css`, `mb-paleta.css` ·
`lib/api-mako/flujo.ts`, `rest.ts`, `areas/ads.def.ts`, `areas/ads.run.ts` · `lib/media-buyer/corrida.ts`, `ejecutar.ts` ·
`docs/api-mako.md` (GENERADO: `scripts/generar-api-doc.mjs`) · `docs/hallazgos.md`. La rama tenía 2 commits del 27/10 y 81
archivos; nunca entró a un tren. Se rescató en `nube/media-buyer-rescate`.

- ⚠️ **La lista de conflictos NO es la lista de riesgos: lo que se borra en silencio no conflictúa.** La rama borró
  `mb.css` **y** `mb-paleta.css` a propósito (sus tres pantallas se mudaron a `aa.css` + el molde de Settings: borrado CON
  reemplazo, dicho en sus propios comentarios). Pero `main` agregó el 29/10 un CUARTO consumidor que la rama nunca vio:
  `app/ads-manager/nueva/page.tsx` (la campaña nueva de Thiago) importa los DOS archivos. `mb.css` apareció como
  «modify/delete» sólo porque `main` lo había tocado; **`mb-paleta.css` no dio ningún conflicto** —la rama lo borró y `main`
  no lo tocó— así que git lo borró sin preguntar y quedaba un import colgado (y los 28 tokens `--mbx-*` sin definir) en un
  archivo que nadie iba a mirar. **Regla:** cuando una rama borra un archivo, buscar quién lo importa EN EL RESULTADO del
  merge (`grep` del import sobre el árbol mergeado), no en la rama ni en el lado de `main`. Un borrado con reemplazo sigue
  siendo correcto sólo para los consumidores que existían cuando se borró.
- ⚠️ **El diagnóstico obvio equivocado, dos veces, y las dos por lo mismo: la dependencia estaba FUERA del conflicto.**
  - `lib/media-buyer/corrida.ts`: parecía «main metió el filtro de zona, la rama reacomodó el cupo; es la misma región, va
    el más nuevo». Son dos cosas independientes y las dos valen (no gastar IA preguntándole a un agente propio sin lugar en
    el cupo · no proponer nada fuera de la zona). Y elegir el lado de la rama **no compila**: `fueraDeZona` se devuelve 100
    líneas más abajo, en código que git auto-mergeó sin marcar.
  - `lib/media-buyer/ejecutar.ts`: dos listas de imports enfrentadas. Los cuatro símbolos de los dos lados se usan en el
    cuerpo ya mergeado (`borrarCampanaPorZernio` 2, `saltoPresupuesto` 1, `presupuestoCambioDesdeLaPropuesta` 2,
    `revisarMontoEditado` 3). **Regla:** antes de elegir un lado, `grep` de cada símbolo que ese lado declara sobre el
    cuerpo YA MERGEADO. Los marcadores muestran el solapamiento, no la dependencia.
- ⚠️ **«Los dos lados le agregaron entradas a una lista» es la forma más peligrosa de conflicto, porque elegir un lado
  compila.** `NO_EN_FLUJOS` (flujo.ts) y `MUEVEN_PLATA` (tests/media-buyer-api.test.ts) son la lista de lo que NO puede
  correr como paso de una automatización: quedarse con un lado deja una operación que mueve plata corriendo sin que la
  confirme una persona. Es un agujero, no un detalle de estilo. Lo mismo en `rest.ts` y `ads.def.ts`/`ads.run.ts`: las
  cinco operaciones (`zona_media_buyer`, `hasta_media_buyer`, `proponer_crear_campana`, `preparar_subida_media_buyer`,
  `subir_creativos_media_buyer`) van unidas. **Lo bueno:** acá hay red. `tests/api-mako-registro.test.ts` compara el
  conjunto COMPLETO de operaciones HTTP contra `tests/api-mako-http.snapshot.txt`, y el snapshot auto-mergeado ya nombraba
  las cinco: faltar una es rojo, no una sorpresa en producción.
- ⚠️ **`docs/api-mako.md` NO se mergea a mano: se regenera.** Daba 7 conflictos, y uno era un CONTEO
  («40 lecturas · 42 acciones» de un lado, «41 · 40» del otro). Ninguno de los dos es el número del merge: regenerado es
  **41 · 43**. Hand-mergear un archivo generado es garantizar rojo en `tests/api-mako-registro.test.ts` («la referencia
  generada está al día»). **Regla:** ante un conflicto en `docs/api-mako.md` o en `tests/api-mako-http.snapshot.txt`,
  correr `node --import tsx scripts/generar-api-doc.mjs` y no leer los marcadores.
- ⚠️ **Medir los conflictos contra una punta que no es `origin/main` da un número que miente.** El pedido traía 6 conflictos
  medidos contra `b2b8adf05`, que vive sólo en ramas locales (`tren-ai`, `planes-y-regalo-3010`, `recorrido-web-3010`) y no
  es ancestro ni de `main` ni de `integracion`. Contra `origin/main` eran **14**, y los 8 que faltaban eran justo los que
  importaban (`lib/api-mako/*`, `lib/media-buyer/*`: la plata). También decía «main se movió 91 commits»: desde el
  merge-base real son **782**. **Y `origin/integracion` estaba 455 commits DETRÁS de `main`, contenida entera en ella**
  (0 commits propios): arrancar el rescate ahí era rescatar sobre una punta muerta. **Regla:** la punta se re-mide en el
  momento, con `git rev-list --left-right --count origin/main...<rama>` y `git merge-base`, nunca se hereda del pedido.
- **`docs/hallazgos.md` (el índice) se duplica solo:** `main` llegó con CUATRO filas `| Ads |` (el merge-base y la rama
  tienen UNA), y dos de ellas eran supersets anidadas de la otra —la misma cola de 29.000 caracteres repetida. Es deriva de
  merges anteriores, no de este. Las dos que caían dentro del conflicto se juntaron en una sin perder entradas (las colas
  eran idénticas, así que la unión es exacta); quedan 3, dos fuera del conflicto. **Regla:** al tocar el índice, contar las
  filas de tu área (`grep -c "^| <Área> |"`) antes y después: tiene que ser UNA.
- **Abierto, para quien gobierne Ads:** `subir_creativos_media_buyer` (de la rama) pasa el BARRIDO de
  `tests/revisar-fijo.test.ts` porque su `adsetId` es `fijoAlRevisar`, pero su `link` y su `formularioId` quedan editables al
  revisar. Son el DESTINO del anuncio, y el 29/10 Integración fijó justo esos cuatro ids en `proponer_crear_campana` por la
  misma razón (el título que se confirma es el de la propuesta). El barrido sólo exige UN id fijo por acción, así que no lo
  caza. No se tocó acá —rescatar no es rediseñar— pero es la misma familia de agujero.
- ⚠️ **Y el ancla valió más que el arreglo: dejar el lugar marcado con el NOMBRE de la otra rama.** El cartel vacío no se
  tocó acá a propósito (lo estaba arreglando `nube/media-buyer-cartel-falso`), pero la condición se dejó en UN solo ternario
  con un comentario que nombraba esa rama. Cuando el tren trajo el arreglo (`fccdc3c30`, el cartel ahora vive en
  `lib/media-buyer/cartel-hoy.ts` con cinco estados y su test), el choque fue de CINCO archivos con los marcadores justo
  donde tenía que estar, y se resolvió llamando al módulo nuevo desde la pantalla nueva. Sin el ancla, los dos lados habrían
  editado la misma bajada por su cuenta y el ganador se la llevaba en silencio: un cartel que miente no da conflicto, da un
  cliente que cree que está todo bien. **Regla:** cuando no te toca arreglar algo que toca TU archivo, no lo esquives —
  dejalo en un solo lugar y nombrá en el comentario la rama que lo arregla.
- ⚠️ **Una fixture VIEJA de un test cazó un bug de verdad, no un falso rojo.** Al portar «Dónde y hasta cuándo» a la pantalla
  nueva, el código hacía `useState(inicial.zona)` — y `ElegirLugares` hace `elegidos.length`. El `CONFIG` de
  `tests/media-buyer-pantalla-m.test.ts` es del 27/10 y no tiene `zona`, así que el render tiró
  `TypeError: Cannot read properties of undefined (reading 'length')`. La tentación es «la fixture está vieja, le agrego el
  campo». **Era un bug real:** la migración 0350 (zona y fechas) NO está aplicada en todos los entornos, y una config sin
  ella llega exactamente así. Se arregló el código (`inicial.zona ?? []`) y la fixture se dejó SIN el campo a propósito,
  para que siga cubriendo ese caso; probado rompiéndolo (sin el `?? []`: 4 pases y 1 fallo; con él, 5 y 0).
  **Regla:** cuando un campo que agregó `main` viene de una migración que todavía no corrió en todas las bases, leerlo con
  un default en la pantalla; y antes de «actualizar» una fixture que da rojo, preguntarse si esa forma vieja existe en
  producción. Si existe, el rojo es del código.
- **Lo que queda SIN hacer:** las dos filas `| Ads |` duplicadas de `main` que caen fuera del conflicto siguen ahí. El
  `mb.css` restaurado va a sobrar el día que «Nueva campaña» adopte `aa.css`: ahí sí se borra, con sus dos archivos, el
  import de `nueva/page.tsx` y la excepción de `tests/media-buyer-pantalla-m.test.ts`. Nada de esto se vio en pantalla, y
  el `tsc` acotado NO se pudo correr en esta máquina (134/99, que no es verde): los tipos los corre Actions.
---

## La calculadora de presupuesto YA EXISTÍA, y la base local estaba 4.431 commits atrás (30/10/2026)

**Síntoma:** un chat arrancó a construir «la calculadora de presupuesto de anuncios» con el
encuadre de que **no existía**, la construyó entera —módulo puro, pantalla propia en
`/ads-manager/presupuesto`, operación en la API de MaKo, 16 tests con ocho roturas— y al ir a
pushear descubrió que `lib/calculadora-presupuesto-ads.ts` existe desde el 22/10, que la
pantalla vive adentro del arranque del Media Buyer (`ArranqueMediaBuyer.tsx`) y que su propio
docblock cita a Martín pidiéndola: «en el onboarding, me imagino a la calculadora que hicimos
para saber cuanto invertir, todo con el chat de MaKo, como Offer».

**La causa real no fue el encuadre: fue el ÁRBOL.** El `main` del clon compartido estaba
**4.431 commits detrás de `origin/main`** (y 12 adelante con trabajo local de otras sesiones).
En ese árbol:

- `app/ads-manager/` todavía era la réplica de Meta Ads Manager (`AdsManagerView.tsx`,
  `CampanasBrowser.tsx`, `OnboardingAdsManager.tsx`), borrada el 25/10 cuando la tab pasó a ser
  el Media Buyer de IA.
- `docs/estrategia-lanzamiento-low-to-high.md` **no estaba en el árbol de trabajo**: vive en
  `origin/integracion`, y el chat lo leyó con `git show a4c4d35dd:…` sin preguntarse por qué no
  estaba en disco. **Ésa era la señal, y se la pasó por alto.** Un documento que el brief nombra
  y que no está en el árbol significa que el árbol no es la rama del brief.

Y el trabajo nuevo no choca contra nada hasta el final: el módulo nuevo era puro, los tests
pasaban, el typecheck acotado daba 0, las defs de la API auto-mergearon. Lo único que delató la
divergencia fue el `cherry-pick`, con dos conflictos `DU` (**deleted by us, modified by them**)
sobre `AdsManagerView.tsx` y `OnboardingAdsManager.tsx`.

**La regla que queda, y es barata:** antes de construir una feature, **medir el árbol contra la
rama del brief**, no contra lo que esté checkouteado:

```sh
git fetch origin integracion main
git rev-list --count HEAD..origin/integracion     # cuánto te falta
git log --oneline -5 origin/integracion -- <la carpeta que vas a tocar>
grep -rln "<el nombre de la feature>" lib/ app/   # ¿ya existe?
```

⚠️ **Y «no existe» en un brief es una HIPÓTESIS, no un dato.** Un `grep` de «calculadora» sobre
`lib/` en la rama correcta la encontraba en un segundo. Es «antes de construir una máquina
nueva, buscá qué pantalla del producto ya hace algo parecido», aplicado a la rama en vez de a la
pantalla: ahí el aviso era que el control de al lado ya hacía el trabajo; acá, que el documento
del brief no estaba en el disco.

### Lo que SÍ faltaba, y es lo que quedó

De la llamada del 30/10 la calculadora del 22/10 no tiene **las LANDINGS**: reparte ángulos
entre avatares y funcionalidades con la vara del Recon (`RESULTADOS_PARA_DECIDIR`), pero no
contesta «¿cuántas landings pruebo?», que es el número que Martín dio. Se agregó al MISMO módulo
(`PISO_LANDING`, `landingsDelPresupuesto`, el campo `landings` del plan y su renglón en la
tarjeta del arranque y en el texto que lee MaKo), nunca como un segundo módulo: dos cuentas del
mismo presupuesto se desincronizan y la pantalla y el chat dirían números distintos.

El piso (US$500) es un **CRITERIO con su cita**, no una medición: con menos, la respuesta es
«te alcanza para MENOS landings» —y en el borde, «no te alcanza ni para una», con lo que falta—,
nunca «repártelo entre más». Lo fija el test con los dos números de Martín y con un presupuesto
que no alcanza, probado con seis roturas.

### Dos cosas más que se midieron de paso

- **Una guarda del pre-push de la familia «lee el DISCO, no lo que se publica» sigue viva:**
  `scripts/sync-puede-filmar.mjs --check` hace `readFileSync` del destino, así que un
  `extension/puede-filmar.js` **ajeno y sin commitear** bloqueó un push que no lo tocaba. Las
  cinco hermanas ya se arreglaron leyendo de HEAD (`git ls-tree` + `git show`); ésta no.
  Mientras siga así, un push desde el clon compartido depende de que el vecino no tenga ese
  archivo a medias — y la salida es el worktree limpio, que cuesta un `git worktree add` más un
  junction a `node_modules`.
- ⚠️ **`origin/integracion` tiene un rojo de tipos que NO es de esta tanda:** `lib/nutricion.ts`
  importa `TRIGGER_AVISO_MAKO` **dos veces en el mismo `import`** (líneas 66 y 67 de
  `0b9d35027`) → TS2300 «Duplicate identifier». Es una línea y la caza el `tsc` completo, o sea
  el run de Actions que avanza `main`. Se midió de rebote con el acotado y queda avisado acá
  porque no es de este chat; el otro rojo que apareció en la misma corrida
  (`lib/api-mako/areas/crm.run.ts:1513`, TS2322: una lectura que devuelve un objeto donde el
  tipo pide `SalidaLectura`) tampoco. **Vive en:** `lib/nutricion.ts`, `lib/api-mako/areas/crm.run.ts`.
- **`presupuesto` dice «en la moneda de la cuenta» y todo el módulo lo escribe con `usd()`**
  (`textoParaMako`, `titularDelPlan`, la tarjeta). Para una cuenta que no cobra en dólares las
  dos cosas no pueden ser ciertas, y el piso de US$500 hereda la ambigüedad. No se tocó en esta
  tanda: es una decisión (¿la calculadora habla en USD y convierte, o habla en la moneda de la
  cuenta y el piso también?). **Vive en:** `lib/calculadora-presupuesto-ads.ts`.

### Lo que quedó SIN hacer

- **No verificado en pantalla.** La guardia de RAM no dejó levantar el `next dev` en esta
  ventana: la tarjeta del arranque con el renglón de las landings no se abrió en un navegador.
- **El resto de lo construido sobre el árbol viejo se descartó a propósito**: la pantalla
  `/ads-manager/presupuesto`, el módulo `lib/presupuesto-anuncios.ts` y una operación
  `ver_presupuesto_anuncios` de la API — que además ya existe como `calcular_presupuesto_anuncios`
  (`lib/api-mako/areas/ads.run.ts`), y como es `SIN_HTTP` no aparece en `docs/api-mako.md`, así
  que agregarle las landings a su descripción no mueve la referencia.
- **Y una pantalla propia NO hace falta**, medido: la charla del arranque con la calculadora no
  es sólo del primer ingreso — la vuelve a abrir el botón «Lanzar una campaña»
  (`app/ads-manager/MediaBuyer.tsx`, `arrancando`), y vuelve sola si quedó a medias. Una ruta
  hermana habría sido un segundo lugar para la misma pregunta. Si algún día hace falta, quedó
  medido que `/ads-manager/nueva` y `/ads-manager/ajustes` son el molde y que
  `app/ads-manager/layout.tsx` sólo desvía `/ads-manager/<dígitos>` a `/anuncio/<id>`.

*30/10/2026, cuenta 1 (claude1), chat «Ads Manager · Presupuesto».*
