# Competitors Spy: el plan (31/10/2026)

> **La pantalla de este plan (lista + ficha por bloques + onboarding) se rechazó el mismo 31/10 y se
> rehízo.** Las fuentes, las reglas y las etapas de datos siguen valiendo; la forma de la pantalla, no.
> Ver `docs/hallazgos-competitors-spy.md`.

> **Pedido de Martín, textual (31/10/2026):** «para competitors spy, quiero algo que mire biblioteca
> de anuncios, instagram, youtube como vidIQ, etc… Y analice todo de la competencia, incluso con la
> funcionalidad de replicar landing, el scraper y todo lo que tenemos en mako, podriamos construir un
> competitors spy muy completo. Como siempre, copia de otro repo o app que ya exista».
>
> Y lo que ya había pedido el 29/10 (memoria `lead-magnets-y-competitor-spy`): «ver de los gurús qué
> anuncios, qué reels, qué YouTube, cómo es su funnel, su landing replicada; los reels más virales,
> los anuncios que más la pegan, los ángulos, las miniaturas y los títulos… lo de vidIQ entra en esta
> tab… plantillas al estilo de un gurú», más las tendencias del nicho.

Esto es **el plan**, no el changelog: nada de esto está construido. La tab existe como `ComingSoon`
(`app/competitor-spy/page.tsx`, nav key `market-an`, sólo super admin desde el 12/10). Las fuentes se
verificaron el **31/10/2026** entrando a las APIs y a los repos; lo que no se pudo verificar está
marcado. Las trampas de cada fuente —las que hacen perder una tarde— están aparte, en
[hallazgos-competitors-spy.md](hallazgos-competitors-spy.md).

---

## 1. La respuesta corta, en siete líneas

1. **Tres de las cuatro fuentes ya están escritas en MaKo.** Instagram (`lib/instagram-perfil-server.ts`,
   Business Discovery + Apify), YouTube (`lib/youtube.ts`, Data API v3) y Replicar landing
   (`lib/editor-landing/replicar-reglas.ts`). La tab puede nacer sin escribir un conector.
2. **La cuarta —los anuncios de Meta— no tiene camino automático legal en LATAM, y hay que decirlo.**
   La Ad Library API oficial, fuera de la UE y el Reino Unido, **sólo devuelve anuncios de política y
   temas sociales**. Para un competidor comercial argentino devuelve vacío. Y la web pública, que sí se
   ve sin login, está prohibida de recolectar por `robots.txt` (`Disallow: /`) y por los Automated Data
   Collection Terms de Meta. Lo que sí se puede está en §4.1: **lo trae la persona, no un crawler**.
3. **No hay ningún repo que valga copiar entero.** El único que está en nuestro stack exacto
   (`athm793/meta-ads-scraper`, Apache-2.0, Next.js 16 + TS + Tailwind + shadcn) tiene **la galería y
   el análisis que queremos y un camino de datos que no podemos usar**: maneja un Playwright contra
   facebook.com. Se le copia la pantalla y el clasificador; no el scraper. Detalle en §5.
4. **Lo que MaKo agrega sobre abrir la Biblioteca de Anuncios a mano es UNA cosa, y es la historia.**
   A mano ves qué corre hoy. MaKo guarda una foto por día y entonces puede decir **desde cuándo**: un
   anuncio que lleva 90 días es el que le funciona, uno de ayer es un test. Ese dato no existe en
   ninguna pantalla de Meta —hay que haberlo estado mirando— y es el que decide qué copiar.
5. **El orden: la ficha del competidor primero, los anuncios último.** Etapa 1 (ficha + lista +
   onboarding) ya entrega valor con Instagram, YouTube y la landing replicada, y no depende de que los
   anuncios lleguen nunca. §6.
6. **La regla del producto manda sobre el gancho de marketing:** si no tenemos el dato, no se muestra
   la afirmación; un rango se dice rango; y la galería de plantillas va con **arquetipos sin cara ni
   nombre**. §7.
7. **Y no se cobra un dato que no tenemos.** vidIQ vende «vistas por hora» y un «score de SEO» que son
   fórmulas propias que no publica. Nosotros podemos calcular lo mismo —y la política de YouTube nos
   **obliga** a decir que es nuestro, no de YouTube. Esa honestidad acá no cuesta: es el diferencial.

---

## 2. Qué ve el usuario, pantalla por pantalla

Cuatro pantallas. Una cosa por pantalla (AGENTS.md → «Un paso por pantalla»), y las cuatro en el
teléfono igual que en la computadora (§8).

### 2.1 Competidores — la lista

La portada de la tab. Una fila por competidor, con lo mínimo que distingue una fila de otra:
el nombre que le puso el negocio, sus canales conectados (chips: Instagram · YouTube · Landing ·
Anuncios), **cuándo se lo miró por última vez**, y un número que cambia: «3 piezas nuevas».

- **Vacía, es el onboarding** (skill `tab-onboarding`, las tres etapas Conectar → Contexto → Ensayo).
  No un cartel: una pregunta. MaKo toma la iniciativa (memoria `mako-toma-la-iniciativa`) y arranca con
  lo que ya sabe del negocio por el Second Brain: *«Vi que vendés mentorías de tesis. ¿Querés que mire
  a @x y @y, que aparecen en tu nicho?»* — y si el negocio no tiene oferta cargada, pregunta por un @.
- **Agregar un competidor es UN campo**, no un formulario: se pega un @ de Instagram, un link de
  YouTube, un link de su landing o el nombre de su página. MaKo resuelve el resto y dice qué encontró
  y qué no. Es el mismo patrón del link pegado del Landing Generator (`panel-reglas.ts`, `sacarLink`).
- Lo que **no** va acá: un buscador de competidores por nicho. Lo pidió Martín («un motor de búsqueda
  de competidores por Instagram, LinkedIn, Google Maps, YouTube»), y hay que decir que **de las cuatro,
  LinkedIn está descartado** (§4.5) y que la búsqueda en YouTube tiene un techo de **100 llamadas por
  día para toda la app** (§4.3): no se puede ofrecer «buscá tu nicho» como una caja de búsqueda. Entra
  en Etapa 5 como **sugerencias** de MaKo, pocas y escritas, no como un buscador.

### 2.2 Ficha del competidor — por bloques

El molde ya existe y está decidido: la ficha por bloques del CRM
([diseno-ficha-bloques.md](diseno-ficha-bloques.md), memoria `ficha-por-bloques-decisiones`). Un bloque
por canal, cada uno **se pliega**, y **un bloque sin dato dice por qué, nunca «0»**:

| Bloque | Qué muestra | De dónde sale |
|---|---|---|
| **Instagram** | Seguidores, bio, web, y las últimas publicaciones con **vistas de reel, likes y comentarios** · el tipo (reel / feed) y si el audio es original o de catálogo | Business Discovery (ya escrito, hay que ampliar los campos: §4.2) |
| **YouTube** | Los videos recientes con vistas, likes, comentarios, duración, **etiquetas** y miniatura · y el **outlier**: qué video rindió muy por encima del promedio de ese canal | `lib/youtube.ts` + `playlistItems` (§4.3) |
| **Landing** | La captura, qué piezas tiene (VSL, formulario, agenda, botón de WhatsApp), el copy en el orden en que se lee, y **«Replicar»** | `landing-analisis.ts`, `landing-extraer.ts`, `replicar-reglas.ts` (ya escrito) |
| **Anuncios** | El creativo, el copy, el CTA, el dominio de destino, las plataformas, y **desde cuándo corre** | §4.1 — el bloque que más cuesta |
| **Oferta** | Qué promete, a quién, con qué precio si lo publica, y **qué objeción ataca** | El analista (§6, Etapa 3) sobre la landing + el copy de los anuncios |

El bloque **Oferta** es el que justifica la tab. Los otros cuatro son datos; éste es la conclusión, y
es lo único que no se puede sacar abriendo cuatro pestañas a mano.

Y arriba de los bloques, **una línea de tiempo**: cuándo apareció cada pieza. Es la vista que convierte
cinco listas en una historia, y la que no existe en ninguna herramienta de Meta.

### 2.3 Hallazgos — lo que MaKo concluyó

No un reporte: **una lista corta de afirmaciones con su fuente al lado**, cada una con un botón que
hace algo. El cruce que ninguna herramienta externa puede hacer, porque necesita conocer el negocio:

> «Tres de los catorce anuncios de @x atacan "no tengo tiempo". Tu landing no lo menciona.»
> → **Escribir ese bloque** (abre el Landing Generator con el pedido escrito)
>
> «El reel de @y con más vistas de los últimos 30 días abre con una pregunta a cámara, 2 segundos.»
> → **Hacer uno así** (abre el Video Editor con la plantilla)

El Second Brain sabe la oferta, el avatar y la promesa del negocio
([hallazgos-second-brain.md](hallazgos-second-brain.md)); el analista los cruza. **Sin eso, la tab es
la Biblioteca de Anuncios con otro CSS** — y eso no vale, es exactamente lo que el pedido descarta.

### 2.4 Plantillas y tendencias

La galería. Una plantilla es **estructura + «Ver ejemplo»**, nunca el ejemplo adentro
(memoria `plantilla-estructura-y-ver-ejemplo`), y las miniaturas nunca en blanco.

⚠️ **Y acá vive la regla más dura de la tab, ya decidida por Martín (29/10):** en la galería van
**arquetipos de estilo sin nombre y sin cara**. Nunca la foto, el nombre ni el @ de una persona real:
se lee como que esa persona respalda MaKo, y la imagen de alguien necesita su consentimiento. Lo que
se copia es el **estilo** (la estructura del guion, el tipo de gancho, el ritmo de edición), no la
identidad.

**La distinción que hace que la tab funcione igual:** dentro del **análisis privado** de un negocio, el
competidor que *ese* negocio eligió sí se ve como fuente —su avatar público, su @, como hace vidIQ— y de
ahí sale una plantilla **privada** de ese workspace. Lo público (la galería que ve todo el mundo) va sin
identidad; lo privado (la ficha de mi competidor) la lleva. Son dos lugares distintos y no se mezclan.

⚠️ **Y la foto de perfil de Instagram no se guarda.** `profile_picture_url` es una URL del CDN de Meta
que **vence**: sirve para dibujar una lista, nunca para persistir
(`lib/instagram-perfil.ts` ya lo dice: *«una URL del CDN de Meta que VENCE»*). Guardarla produce
avatares rotos semanas después, que es el defecto que Martín ya marcó dos veces.

**Tendencias** es la otra mitad del pedido del 29/10: «que MaKo busque las temáticas más hot o los
trendings del nicho de la persona según su oferta y su mercado… y eso se transforme en un reel, un
anuncio o el eje de un newsletter». Sale de cruzar lo que ya tenemos guardado de los competidores de
ese nicho —qué ángulos se repiten, qué audios vuelven, qué formatos crecen— **no de una API de
tendencias**, que no existe para esto. Es decir: la tendencia es un subproducto de la historia, y por
eso la Etapa 2 (los snapshots) tiene que ir antes.

---

## 3. Qué se reusa y qué hay que construir de verdad

### Se reusa (ya está escrito y medido)

| Pieza | Dónde vive | Qué aporta a esta tab |
|---|---|---|
| **Instagram por @** | `lib/instagram-perfil-server.ts`, `lib/instagram-perfil.ts`, `lib/instagram-buscar.ts` | Business Discovery + Apify, con caché por negocio y por @, tope por día, y los seis motivos de fallo tipados. **La fuente de Instagram ya está: hay que ampliarle los campos.** |
| **Replicar landing** | `lib/editor-landing/replicar-reglas.ts`, `lib/landing-fetch.ts` (guarda anti-SSRF), `lib/landing-extraer.ts` | Copiar la landing del competidor y dejarla editable, en tres formatos. Ya le saca los rastreadores del dueño original (su Píxel, su GTM) — que es justo lo que no queremos heredar. |
| **Qué tiene una landing** | `lib/landing-analisis.ts` | Detecta VSL, formulario, agenda embebida, botón de WhatsApp, píxeles. Es el bloque Landing de la ficha, gratis. |
| **Vigilar una landing** | `lib/landing-vigilancia.ts`, `lib/landing-snapshot.ts` | **El motor de la Etapa 2 ya existe.** Mira una página, se acuerda de lo que vio y dice qué cambió — con la regla correcta ya escrita: *«una lectura que falló es "NO SÉ", jamás "lo sacaron"»*. Hay que generalizarlo de «mi landing» a «la landing de un tercero». |
| **YouTube Data API** | `lib/youtube.ts` (`claveDeYoutube`: la del negocio, si no la de la plataforma) | La clave ya se resuelve, y ya está decidido que las vistas de un video son públicas y las paga la plataforma. |
| **El analista** | skill `scaffold-mako-analyst`, molde `lib/closing.ts` | El patrón «lee una fuente → Claude devuelve JSON → una fila por entidad por workspace → sync batcheado». **Competitors Spy es exactamente eso.** No se inventa un patrón nuevo. |
| **El scraper a la vista** | `extension/wa-recorrer.js` (0.72, 26/10) | El molde del recorrido **en el navegador de la persona, a ritmo humano, con un cartel que dice qué está haciendo**, que frena entre paso y paso y nunca escribe. Es la única vía viable para los anuncios (§4.1) y el patrón ya está probado. |
| **Ads Analyst** | `lib/ads-analyst-patrones.ts`, `lib/ads-analyst.ts` | Ya sabe leer patrones de anuncios *nuestros*. Los vocabularios de ángulo y gancho se comparten en vez de duplicarse. |
| **Ficha por bloques** | `diseno-ficha-bloques.md` + los componentes del CRM | La pantalla 2.2 no se diseña: se arma con el molde que ya se aprobó. |

### Hay que construir

1. **El modelo de datos**: `spy_competidores` (uno por workspace, con sus canales) y
   `spy_piezas` (un anuncio / reel / video / versión de landing, con `visto_primera_vez` y
   `visto_ultima_vez`). Las dos a `TENANT_TABLES` (skill `tenant-safe-query`), migración numerada
   por el Cerebro (skill `author-numbered-migration`).
   ⚠️ **Y las dos retenciones van separadas desde el día uno** (§7.3): las métricas y el texto no se
   pueden guardar el mismo tiempo. Si nacen en la misma columna, después es una migración.
2. **El cron de snapshots** (skill `add-cron-job`): es lo que produce la historia. Escalonado desde el
   principio —competidores calientes todos los días, fríos una vez por semana— porque la cuota de
   YouTube no aguanta todo diario (§4.3).
3. **El analista** `lib/spy.ts` con el scaffold, y sus prompts en `lib/prompt-registry.ts`
   (skill `add-editable-prompt`: **si no se registran, quedan mudos a la edición del usuario**).
4. **La ampliación de los campos de Instagram**: hoy se piden
   `caption,timestamp,media_type` de las últimas 6 publicaciones (`CAMPOS_PERFIL`). Faltan
   `like_count,comments_count,view_count,media_product_type,media_audio_type,permalink,thumbnail_url`.
   Todos **nullable de verdad** (§7.2).
5. **El lector de YouTube por canal**, que hoy no existe: `channels.list` → el playlist de subidas →
   `playlistItems` → `videos.list` en lotes de 50. **Nunca `search.list`** (§4.3).
6. **La galería y el detalle de anuncios**: la pantalla. Es lo que se copia de
   `athm793/meta-ads-scraper` (§5).
7. **El onboarding de la tab** (skill `tab-onboarding`) y **el registro de capacidades de la API**
   (AGENTS.md → «Una capacidad nueva de MaKo se DECLARA en el registro de la API»), porque esta tab
   tiene que ser contestable desde WhatsApp: *«¿qué está haciendo @x?»*.

---

## 4. Qué fuente da qué dato, y cuál no se puede

### 4.1 Biblioteca de Anuncios de Meta — **la más valiosa y la más trabada**

**La API oficial no sirve para LATAM.** Verificado el 31/10/2026 en
`facebook.com/ads/library/api/`, que lo dice textual: la API cubre anuncios de temas sociales,
elecciones o política **de cualquier parte del mundo**, y anuncios **de cualquier tipo** sólo si se
entregaron **en la UE o el Reino Unido**. Y en la nota del parámetro `ad_reached_countries`: *«Ads that
did not reach any location in the EU will only return if they are about social issues, elections or
politics»*.

⚠️ **La trampa:** `ad_type=ALL` **no significa «todos los anuncios»**. El enum es temático
(`ALL, EMPLOYMENT_ADS, FINANCIAL_PRODUCTS_AND_SERVICES_ADS, HOUSING_ADS, POLITICAL_AND_ISSUE_ADS`) y la
cobertura geográfica es un filtro aparte y fijo. Una consulta por Argentina con `ad_type=ALL` devuelve
**sólo política**: cero anuncios comerciales, sin error. Es el tipo de vacío que hace construir media
tab antes de darse cuenta.

| Consulta | Qué devuelve |
|---|---|
| `ad_reached_countries=['AR']`, `ad_type=ALL` | Sólo política y temas sociales. Nada comercial. |
| `ad_reached_countries=['ES']` o `['GB']` | Todo, incluidos comerciales, últimos ~12 meses |
| `ad_reached_countries=['US']` | Sólo política y temas sociales |

**Lo que da, cuando da:** `ad_creative_bodies`, `ad_creative_link_titles/captions/descriptions`,
`ad_delivery_start_time` / `stop_time`, `ad_snapshot_url`, `page_name`, `page_id`,
`publisher_platforms`, `languages`. Y sólo para políticos: `impressions`, `spend`, `currency`,
`demographic_distribution`, `estimated_audience_size`. Sólo UE: `eu_total_reach`,
`beneficiary_payers`. Sólo UE y Reino Unido: `target_ages`, `target_gender`, `target_locations`.

⚠️ **`spend` e `impressions` NO son números, son tramos de texto** (`<100`, `100-499`, `1K-5K`,
`10K-50K`, `>1M`…). No se pueden sumar ni promediar, y si se muestran, se muestran como rango. Ver §7.1.

**El acceso:** no hay app review, pero sí **verificación de identidad** en `facebook.com/ID` (el mismo
trámite que para pautar política; Meta dice *«a few days»*). Alguien —Martín o el cliente— tiene que
mandar documento. **No es un permiso que se pida por OAuth por cliente.**

**Rate limits:** Meta **no los publica** para `ads_archive`. Existe el error `613` documentado y el
límite genérico de plataforma; las cifras de «200 llamadas/hora» que circulan en blogs de vendors **no
están en la doc de Meta** → no verificado. Paginación por cursores, hasta 5.000 anuncios por página.

**La web pública sí se ve sin login.** Verificado deslogueado el 31/10: `facebook.com/ads/library/` con
`country=AR&q=zapatillas` da ~6.200 resultados, sin muro y **sin captcha**, y cada tarjeta trae el badge
Active/Inactive, el Library ID, **«Started running on …»**, las plataformas, «This ad has multiple
versions», el creativo completo, el copy, el dominio y el CTA. Para no-UE **no muestra** gasto,
impresiones, alcance ni segmentación: la web replica exactamente la asimetría de la API. **No hay atajo
por la UI.**

⚠️ **Y recolectarla automáticamente está prohibido, sin vueltas.** Dos fuentes de Meta, las dos leídas
el 31/10:
- `facebook.com/robots.txt`, encabezado: *«Collection of data on Facebook through automated means is
  prohibited unless you have express written permission from Facebook»*. Y la regla catch-all:
  `User-agent: * / Disallow: /`. **Sin excepción para `/ads/library/`.**
- `facebook.com/legal/automated_data_collection_terms`, cláusula 4: prohíbe *«transferring, selling,
  licensing or sublicensing Collected Data… to any third party»*. **Eso describe el modelo de MaKo**:
  recolectar y mostrárselo a un cliente que paga.

**Entonces: un crawler nuestro queda descartado, y comprar el dato raspado también.** Apify
(~US$3,40–5,80 por 1.000 anuncios) y ScrapeCreators (~US$0,99–1,88 por 1.000) existen y son baratos,
pero quien vende ese dato está en infracción de la cláusula 4, y comprarlo es ponerse del otro lado del
mismo contrato. No es una nota al pie: es el motivo por el que esta fuente va última en el orden.

**Lo que SÍ se puede, y es lo que propongo:** las dos vías que no son un crawler.

- **(a) El anuncio que trae la persona.** Pega el link de un anuncio de la Biblioteca (o su Library ID)
  y MaKo lo guarda, lo analiza y lo pone en la ficha de ese competidor. Es un pedido explícito de un
  usuario sobre un dato público que él está mirando. Cuesta un campo y entrega el bloque Anuncios de
  entrada, sin ningún riesgo.
- **(b) El recorrido a la vista en SU navegador, con la extensión.** El mismo patrón que Martín ya
  decidió y ya está construido para WhatsApp (`extension/wa-recorrer.js`, y la regla de
  `enriquecer-base-sin-apify`: *«en goteo… desde su navegador, a ritmo humano, y frenando ante un
  captcha (nunca resolverlo)»*). La extensión lo lleva a la pestaña de la Biblioteca, se ve que está
  trabajando, lee las tarjetas que la página ya le dibujó a él, y para.

  ⚠️ **Y hay que decir lo incómodo:** por la letra de los Automated Data Collection Terms, **un
  recorrido guiado sigue siendo recolección automatizada**, aunque corra en el navegador de la persona,
  con su sesión y a ritmo humano. Es más defendible que un crawler de servidor (no hay cuenta
  nuestra, no hay volumen, el dato no sale de su máquina hasta que él lo guarda) pero **no es
  "permitido"**. Es exactamente el mismo riesgo que Martín ya aceptó a sabiendas para WhatsApp. **La
  decisión es suya, no del que construye**, y la pantalla tiene que decir de dónde salió cada anuncio.
  La vía (a) no tiene este problema y por eso va primero.

### 4.2 Instagram — **ya está escrito, y da más de lo que parece**

`business_discovery` de la Graph API. **Ya existe en el repo** (`lib/instagram-perfil-server.ts`), con
tres fuentes en orden: la conexión de Meta del negocio → la de la plataforma → Apify.

**Qué da de una cuenta ajena:** `followers_count`, `media_count`, `biography`, `username`, `website`,
`profile_picture_url`, y por cada publicación `caption`, `timestamp`, `media_type`, `permalink`,
`comments_count`, `like_count` y —esto es lo bueno— **`view_count` de reels**, que la referencia de
Meta marca como *«Available for Business Discovery API only»*. Más `media_product_type` (AD / FEED /
STORY / REELS) y `media_audio_type` (MUSIC / ORIGINAL_SOUND), que sirven para detectar formato y audios
en tendencia.

**Qué NO da:** `saved_count` y `shares_count` (la doc dice textual *«Not accessible through Business
Discovery»*), alcance e impresiones de otra cuenta, stories, demografía, cuentas **personales** (sólo
Business y Creator) y cuentas con restricción de edad.

⚠️ **Y el estado real hoy, medido el 22/10/2026 y escrito en `lib/instagram-perfil.ts`: Business
Discovery NO ANDA.** El token de la plataforma (MaKo System User, ws9) no tiene **ningún** permiso de
Instagram, y la página «Hola MaKo» no tiene un Instagram vinculado — **y Meta no da error: omite el
campo `instagram_business_account`**. De 11 conexiones de Meta de clientes, **sólo la de ws11** tiene
permisos de Instagram. Es decir: la fuente está programada y la credencial no está. Eso es un trabajo
de integración, no de código, y va en la Etapa 1.

**Apify, el matiz que importa:** Martín descartó Apify el 24/10 — pero **para enriquecer la base de
leads**, por costo: *«no voy a gastar 5 USD por 200 leads cuando tengo grupos con miles»*
(`enriquecer-base-sin-apify`). Competitors Spy es el caso opuesto: **cinco competidores por negocio, no
miles de leads**, y leer un perfil por @ exacto cuesta «centésimos de centavo», que es lo que el repo ya
hace y ya acepta (`APIFY_ACTOR_PERFIL`, con tope por corrida y tope por negocio por día). **No es la
decisión que él revirtió.** Aun así, Apify sobre Instagram choca con §4.2 de los Términos de Instagram
(*«can't sell, license, or purchase any account or data obtained from us»*), igual que en Meta: la vía
limpia es Business Discovery y la credencial.

**El scraping de Instagram queda descartado, y conviene saber por qué dos veces.** Primero, los
Términos (§4.2) prohíben la recolección automatizada *«regardless of whether such automated access or
collection is undertaken while logged-in»* — o sea que «es público sin login» no es una defensa.
Segundo, y esto es lo útil: **sin login tampoco da el dato**. Verificado el 31/10 en un perfil público
sin sesión: se ven nombre, bio, seguidores y los primeros ~12 posts, y **no se ve ni un like ni una
vista**, ni en la grilla ni en el post. El muro de login cae en el primer «Show more posts». El camino
ilegal tampoco funciona: `business_discovery` es a la vez el único legal y el más completo.

### 4.3 YouTube — **el lado fuerte, con dos trampas de 2026**

**Trampa 1, la que rompe el diseño obvio: `search.list` ya no cuesta 100 unidades — tiene su propio
balde de 100 LLAMADAS por día.** Cambio del 1/6/2026, verificado en
`developers.google.com/youtube/v3/determine_quota_cost`: *«a default quota allocation of 100
search.list calls, 100 videos.insert calls, and 10,000 units per day combined for all other
endpoints»*. **Son 100 búsquedas por día para TODA la app**, no por usuario. Cualquier feature con
forma de buscador («buscá competidores de tu nicho») está muerta a escala, y todo tutorial anterior a
junio dice otra cosa.

**El camino que sí escala** (0,04 unidades por video hidratado, ~250.000 videos/día de techo teórico):

1. `channels.list?part=contentDetails,statistics,snippet&id=<50 ids>` → 1 unidad por **50 canales**.
   De ahí sale `contentDetails.relatedPlaylists.uploads`. **Leerlo de la API, no derivarlo cambiando
   `UC`→`UU` a mano.**
2. `playlistItems.list?playlistId=UU…&maxResults=50` → 1 unidad por **50 videos**.
3. `videos.list?part=snippet,statistics,contentDetails&id=<50 ids>` → 1 unidad por **50 videos**.

Con 4.000 canales vigilados y refresco diario de las 50 subidas más nuevas: ~8.080 de 10.000 unidades.
Entra, con 19% de aire. **A 5.000 revienta** → el refresco escalonado va desde el día uno, no después.
Ampliar la cuota exige un **API Compliance Audit**, no un formulario.

**Qué da de cualquier canal, con API key:** `viewCount`, `likeCount`, `commentCount`, `publishedAt`,
`duration`, `thumbnails`, **`tags`**, `title`, `description`, `categoryId`, `defaultAudioLanguage`.

⚠️ **`tags` de videos ajenos SÍ vienen, pero sólo por `videos.list`, nunca por `search.list`.** El
síntoma (etiquetas vacías) se diagnostica como «la API no da tags de otros»; la causa es el endpoint.
La deprecación de 2021 que todos citan era de **playlists**, no de videos.

**Lo que NO da:** `dislikeCount` (privado desde el 13/12/2021 — y **no devuelve 0, no devuelve el
campo**: un `?? 0` acá inventa un dato); el **texto** de los subtítulos de un video ajeno
(`captions.download` *«requires the user to have permission to edit the video»*; `captions.list` sólo
dice que existen); alcance, retención, CTR, impresiones; y el volumen de búsqueda de keywords, que
YouTube no expone por ninguna API.

**Trampa 2, la que cambia el producto: derivar «vistas por hora» está prohibido POR DEFECTO.** Los
Developer Policies, III.E.4.h, dicen textual que no se puede *«access or use API Data to create new or
derived data or metrics»*, y nombran el caso: *«a score that factors in likes, total views, or any
other API Data»*. Y III.E.4.b pone el tope de almacenamiento: los datos de un tercero son
*«Non-Authorized Data»* y **no se guardan más de 30 días**.

**La salida existe y es nueva: la política III.L, del 1/6/2026**
(`developers.google.com/youtube/terms/derived-metrics-policy`). Para *«audited developers with analytics
use cases that have explicitly applied for permission»*, aceptando la enmienda **«Section 5 → Analytics
& Reporting»** en el pedido de ampliación de cuota, se habilita explícitamente:

- scores y ratios propios («Creator Influence Score», leaderboards de **«Top YouTuber by View Growth»**,
  curvas de 36 meses) — **o sea, exactamente el VPH y el outlier**;
- estimación de ingresos, *«clearly presented as third-party estimates and not as YouTube approved or
  published data»*;
- etiquetas propias, declaradas como propias;
- análisis de sentimiento sobre comentarios;
- y **retención de métricas (views, likes, subs, comments) hasta 36 meses**.

Con un límite que no se mueve: *«Other data (such as video titles, creator names, descriptions, and
comment text) must still follow the 30-day refresh and deletion policy»*. §7.3.

**Lo que esto decide:** antes de construir el bloque de YouTube hay que **aceptar la enmienda**. Sin
ella, el VPH y el histórico son violación de política, con *«quota reduction or termination of your API
access»* como sanción declarada — y esa key sostiene también a `lib/youtube.ts`, que ya está en
producción. **Es un trámite, y va en la Etapa 0.**

⚠️ **Y un corte en la serie histórica:** la definición de `viewCount` cambió el **24/8/2026** (cuenta la
vista en el momento en que el video empieza a reproducirse). Toda serie que cruce esa fecha tiene un
salto artificial. Si se grafica el crecimiento de un competidor a 12 o 36 meses, **se marca el corte** o
se muestra un despegue que no ocurrió.

**Y lo de vidIQ, con honestidad.** Nada de lo que vende vidIQ como dato es dato de YouTube: VPH y
velocity son polling propio dividido por un reloj; el SEO score es una fórmula propietaria que no
publica; el volumen de keywords lo admite como estimación (*«vidIQ estimates the monthly searches»*) y
avisa que sus rangos son gruesos; la estimación de ingresos es views × un CPM supuesto. **De todo su
tablero, lo único medido son views, likes y comentarios.** Podemos calcular lo mismo que ellos —y
decirlo, que es lo que la política nos obliga. Ver §7.1.

### 4.4 Landings de la competencia — **ya está, es Replicar**

Lo único que hay que hacer es apuntar lo que ya existe a una URL ajena en vez de a la propia:
`landing-fetch.ts` la baja con su guarda anti-SSRF, `landing-extraer.ts` saca el copy en el orden en que
lo lee un visitante, `landing-analisis.ts` dice qué piezas tiene, y `replicar-reglas.ts` la deja
editable en tres formatos — **sacándole los rastreadores del dueño original**, que es precisamente lo que
no queremos heredar.

Y `landing-vigilancia.ts` + `landing-snapshot.ts` dan el «qué cambió» con la regla correcta ya escrita:
*una lectura que falló es «NO SÉ», jamás «lo sacaron»*. Esa frase es la Etapa 2 entera.

Dos límites ya medidos, que hay que decir en la pantalla y no descubrir de nuevo:
- **Replicar no trae las imágenes como archivos**: la copia fiel carga los assets desde el origen con un
  `<base href>`. Si el competidor cambia su sitio, la copia se rompe. Y la copia **no puede depender de
  `<base>`** en el editor (un `<iframe srcdoc>` hereda `base-uri 'self'`): las direcciones se escriben
  absolutas al copiar (`absolutizarUrls`, `cssAbsoluto`).
- **Una app de Vite/Lovable/React no se lee desde el servidor**: el HTML trae `<div id="root"></div>` y
  el texto lo arma el JavaScript. Contesta 422 y propone el otro formato. Para esas páginas el camino es
  el lector en el navegador de la persona. No es un bug que se pueda arreglar.

### 4.5 Lo que NO se puede, y por eso no está en el plan

| Fuente | Por qué no |
|---|---|
| **LinkedIn** | Ya relevado el 14/10 ([diseno-tiktok-linkedin.md](diseno-tiktok-linkedin.md)): prohíbe usar datos de personas *«to create leads, to enhance customer data in a CRM»*, el perfil se cachea 24 h y un comentario 48 h, y prohíbe la IA que genere a partir de contenido de terceros. **Mirar competidores en LinkedIn y guardarlos choca con las tres.** |
| **Google Maps / Places** | Posible (es la cuarta que pidió Martín el 29/10) pero no aporta a «qué anuncios y qué reels hace»: da fichas y reseñas. Queda fuera de alcance de esta tab; si entra, es por Places con la clave del cliente, y merece su propio plan. |
| **Transcripciones de videos ajenos** | `captions.download` exige permiso de edición. `youtube-transcript-api` y `YouTube.js` las dan y violan los ToS (III.E.6, III.I.14). **No hay vía legal**, y era la pieza más tentadora para «el guion al estilo de». La alternativa honesta: analizar título, descripción, etiquetas y miniatura, y decir que el guion no se leyó. |
| **Guardados y compartidos de Instagram** | La doc de Meta lo dice textual: *«Not accessible through Business Discovery»*. |
| **Gasto e impresiones de un competidor comercial de LATAM** | No existe en ningún producto de Meta. Ni API, ni web, ni pago. **Si alguien lo muestra, lo está estimando.** |

---

## 5. Qué repo copiar

### La recomendación: `athm793/meta-ads-scraper`, **la pantalla sí, el scraper no**

- **URL:** `github.com/athm793/meta-ads-scraper` · **Licencia: Apache-2.0** (verificada entrando al
  repo el 31/10: tiene `LICENSE` y `NOTICE`, y el commit dice *«Relicense under Apache-2.0 and
  open-source the project»*) · 62 stars, 21 forks, último commit 2026-08-01 · **un solo autor**.
- **Stack: Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + shadcn.** Es el único
  candidato de todo el relevamiento que está en **nuestro stack exacto**.

**Qué se copia:**
- `src/components/ads/` — **`AdGrid`, `AdModal`, `FiltersPanel`, `HookExtractor`**: la galería con
  filtros laterales y la vista de detalle, en shadcn, ya resuelta para anuncios de verdad (visor de
  carrusel y multi-video, variantes de copy, descarga por archivo). Es la pantalla 2.2 del bloque
  Anuncios.
- **`hooks.ts` — el clasificador**: tipa cada gancho como Pregunta / Dato / Cómo-hacer / Oferta /
  Urgencia / Curiosidad / Prueba social / Emoji / Afirmación, y la **etapa de tendencia** por
  antigüedad: *probado (30d+) · ganando tracción (14–30d) · test nuevo (<14d)*. **Esa es la idea
  central de la tab puesta en código**, y coincide con lo que pidió Martín («los anuncios que más la
  pegan, los ángulos»). Los vocabularios se unifican con los de `lib/ads-analyst-patrones.ts`.
- `parser.ts` como **especificación de forma**, no como código: qué campos tiene un anuncio
  (`advertiser`, `started_running`, `ads_using_creative`, `landing_url` + `landing_domain`
  desenrollado del redirect de `l.facebook.com`, `cta`, `link_text`, `body`, `creative_image`).
- `exportCsv.ts`, y su idea de `webhook.ts` con firma HMAC (el repo ya hace lo que
  `add-webhook-receiver` pide).

**Qué se le tira, y no es negociable:**
- **El scraper.** Su README lo dice él mismo: *«No API key. No access token. No account. It drives a
  real headless browser (Playwright) against the public Ad Library»*. Eso es exactamente lo que
  `robots.txt` y los Automated Data Collection Terms prohíben (§4.1). **Se copia la pantalla, no el
  camino de datos.** Los datos entran por la vía (a) o (b) de §4.1.
- `better-sqlite3` y `src/lib/db.ts` → Supabase con `workspace_id` en cada tabla. El repo es
  mono-usuario: **no tiene noción de inquilino**.
- **La ausencia de auth.** El README admite que bindea a `127.0.0.1` y que toda ruta está abierta. Cada
  route handler lleva `requireRolWs` (skill `nextjs16-conventions`).
- Playwright en el request: no entra en una función de Vercel, y su propio README lo dice.

**Y el riesgo que hay que saber:** replica el GraphQL **interno** de Meta, que Meta rota. El repo expone
un `/api/health/meta` justamente para detectar cuándo se rompió. Otro motivo para no heredar esa mitad.

### Lo segundo y lo tercero

- **`pandich93/youtube-niche-finder` — MIT** (verificada en el repo el 31/10) · 23 stars · último commit
  2026-10-30 · Python + FastAPI + **PostgreSQL** · **usa la Data API v3 oficial** (sin problema de ToS).
  Se copia **la fórmula de detección de outliers** (un video muy por encima del promedio de su canal,
  que es el «reel más viral» del pedido) y **el esquema de Postgres**, que migra casi directo a
  Supabase. Se tira el dashboard en JS vanilla y FastAPI.
- **`crawlseo/crawlseo` — MIT** (verificada el 31/10) · 659 stars · 2026-10-27 · **Next.js 16 + TS +
  Prisma + shadcn**. Se copia **el patrón de monitoreo recurrente**: crawls programados + snapshots
  históricos + alertas, en nuestro mismo framework. Es la mitad que a `meta-ads-scraper` le falta
  (es on-demand, no vigila). No se copia su comparación de competidores, que es on-demand y depende de
  DataForSEO.
- **`dgtlmoon/changedetection.io` — Apache-2.0** · 35.410 stars · commit de hoy. **No lo recomiendo acá**,
  aunque sea el proyecto más maduro del relevamiento: es Python/Flask, y **nosotros ya tenemos nuestro
  detector de cambios** (`landing-vigilancia.ts` + `landing-snapshot.ts`), con la regla del «NO SÉ» ya
  escrita y ya pagada. Sumar un sidecar en otro lenguaje para algo que existe es ir contra «Una cosa, un
  lugar». Queda anotado por si la vigilancia de páginas crece más allá de landings.

### Lo que hay que decir: **no hay nada que copiar entero**

- **Para YouTube no existe un vidIQ self-hosted serio.** Se barrió GitHub: lo mejor tiene 23 stars, y
  lo que falta siempre es lo mismo — el volumen de búsqueda de keywords, que la API no entrega y vidIQ
  infiere con data propia. **Esa parte se escribe de cero o no se hace.**
- **Para Instagram, el camino open source es íntegramente contra-ToS.** `instaloader` (MIT, 13.7k
  stars, vivo), `instagrapi` (MIT, 7k, API privada), `instagram_private_api` (muerto desde 2019),
  Apify: los cuatro violan §4.2. **La licencia no es el problema; el acceso lo es.** Y como está medido
  en §4.2, el camino ilegal tampoco da el dato.
- **Descartados por licencia, nombrados para que nadie los proponga de nuevo:**
  `soxoj/AdsLibrary` (la mejor idea del relevamiento —un normalizador para seis bibliotecas de
  anuncios— y **sin licencia: no copiable**), `nimrodyar/AdsLab` (sin licencia, 0 stars),
  `Helvitiss/facebook-ad-library-scraper` y `Lejo1/facebook_ad_library` (sin licencia),
  `facebookresearch/Ad-Library-API-Script-Repository` (**no es OSS**: la licencia de plataforma de Meta
  ata el uso a sus APIs). Y **cuatro AGPL-3.0 que son veneno para un SaaS cerrado**:
  `rankme.fast`, `bisibility`, `searchmirror`, `kavanah-analytics` — de ésos no se copia ni se mira el
  código de cerca.
- **Y la referencia de pantalla, que es otra cosa que la licencia** (AGENTS.md → «NINGUNA pantalla se
  diseña de cero»): para la galería de anuncios, el Hook Lab de `meta-ads-scraper`, que se abre y se
  mira porque es público. Para el bloque de YouTube, **vidIQ**, con el reparo del punto 2 de esa regla:
  su producto real pide login y es de pago, así que lo que se copia es lo que se ve en su
  documentación pública y en su extensión, **y se dice que es eso**. Para la lista y la ficha, no se
  busca referencia afuera: el molde es la **ficha por bloques del CRM**, que ya se aprobó en casa.

---

## 6. El orden: qué entra primero

El criterio es el de siempre: **cada etapa tiene que servir aunque la siguiente no llegue nunca.**

### Etapa 0 — Los dos trámites (no es código, y bloquea)

1. **Aceptar la enmienda III.L de YouTube** («Analytics & Reporting» en el pedido de ampliación de
   cuota). Sin esto, el VPH y guardar más de 30 días son violación de política, y la sanción declarada
   alcanza a la key que ya usa `lib/youtube.ts` en producción.
2. **Conseguir que Business Discovery ande**: vincular un Instagram profesional a la página de la
   plataforma y pedir `instagram_basic` para el token de ws9. Hoy, medido, no hay ninguno (§4.2).

Los dos son de Martín o del Cerebro, no de un agente, y conviene arrancarlos **antes** de la Etapa 1
porque tardan días.

### Etapa 1 — La ficha del competidor (el valor de entrada)

La lista, la ficha por bloques, el onboarding, y **tres de los cuatro bloques con dato real**:
Instagram (la fuente ya existe, hay que ampliarle los campos), YouTube (el lector por canal es nuevo,
la clave ya se resuelve) y Landing (Replicar y el análisis de piezas ya existen). El bloque Anuncios
entra con la vía (a): **pegá el link del anuncio**.

**Por qué sirve sola:** un negocio puede agregar tres competidores y ver, con números medidos, qué
reels y qué videos les están funcionando, y replicar su landing de un clic. Eso ya no lo tiene hoy, y no
depende de resolver nada de Meta.

### Etapa 2 — La historia (el diferencial)

El cron escalonado + los snapshots + la línea de tiempo. Es lo que convierte cinco listas en «esto
lleva 90 días corriendo» y «esto apareció ayer». **Es el único dato que no se puede obtener a mano**, y
por eso es la etapa que justifica la tab.

Se generaliza `landing-vigilancia.ts` de «mi landing» a «la de un tercero», con su regla intacta.

### Etapa 3 — El analista

`lib/spy.ts` con el scaffold (`scaffold-mako-analyst`), sus prompts registrados, y el bloque **Oferta**
+ la pantalla **Hallazgos**: los ángulos, los ganchos, las miniaturas, los títulos, y el cruce contra la
oferta del negocio que sale del Second Brain. Acá aparece el valor que ninguna herramienta externa
puede dar, porque ninguna conoce el negocio.

### Etapa 4 — Los anuncios de Meta en serio

La vía (b): el recorrido a la vista con la extensión. **Va última a propósito**, porque es la única que
necesita una decisión de Martín sobre el riesgo (§4.1), y porque las tres etapas anteriores ya
entregaron una tab que funciona. Si la decisión es «no», la tab no se cae: queda con la vía (a).

### Etapa 5 — Plantillas y tendencias

La galería de arquetipos (sin cara ni nombre), las plantillas privadas por competidor, y las tendencias
del nicho como subproducto de la historia acumulada en la Etapa 2. Y las **sugerencias** de competidores
—pocas, escritas por MaKo— en lugar del buscador que la cuota de YouTube no permite.

---

## 7. Qué NO mostrar

En una herramienta de espionaje la tentación es inventar métricas que parecen medidas. La regla del
producto es la que ya gobierna el repo: **si no tenemos el dato, no se muestra la afirmación** — y jamás
un número estimado presentado como real.

### 7.1 Lo medido, lo derivado y lo inventado son tres cosas

| Se puede mostrar como dato | Se puede mostrar **diciendo que es nuestro** | **No se muestra** |
|---|---|---|
| YouTube: views, likes, comentarios, fecha, duración, etiquetas, título | VPH, outlier, score, crecimiento — **con la enmienda III.L aceptada y la leyenda que exige** | Dislikes · CTR · retención · impresiones · volumen de búsqueda de una keyword |
| Instagram: vistas de reel, likes, comentarios, fecha, tipo, audio | Un ranking propio de «qué les funciona» | Guardados · compartidos · alcance · demografía |
| Anuncios: creativo, copy, CTA, dominio, plataformas, **desde cuándo** | «Probado / ganando tracción / test nuevo» (es la antigüedad, declarada como criterio nuestro) | **Gasto e impresiones de un competidor comercial de LATAM: no existen.** Ni estimados. |
| Landing: qué piezas tiene, el copy | «Ataca esta objeción» (es una lectura de la IA, y se dice) | Conversión, visitas o facturación del competidor |

**La estimación de ingresos queda fuera.** La política III.L la permite con leyenda, pero es views × un
CPM supuesto: el número más vendible y el más falso de todo vidIQ. No entra.

### 7.2 Un contador ausente no es cero

Dos trampas del entorno que producen datos inventados sin que nada dé error:

- **Instagram:** el dueño de una cuenta puede ocultar likes, comentarios, vistas, reposts y compartidos
  **uno por uno**, y el campo entonces **no viene**. Un `?? 0` muestra «0 likes» sobre un post con
  miles.
- **YouTube:** `dislikeCount` **no devuelve 0, no devuelve el campo**. Lo mismo.

**La regla:** todo contador es nullable de verdad, y la pantalla distingue **«no lo publica»** de
**«cero»**. Es la misma distinción que este repo ya pagó cara con el 0% de retención, y que
`landing-vigilancia.ts` tiene escrita en su cabecera: *«no medimos» y «dio cero» no son el mismo dato*.

### 7.3 Un rango se dice rango, y los plazos van separados

- **`spend` e `impressions` de la Ad Library son tramos de texto** (`1K-5K`, `>1M`), no números. No se
  suman, no se promedian, y se muestran como tramo. Un eje con «3.000» donde la fuente dijo «1K-5K» es
  un número inventado.
- **Las dos retenciones de YouTube van en columnas separadas desde la primera migración:** métricas
  (views, likes, subs, comments y sus snapshots) **36 meses** con la enmienda; **títulos,
  descripciones, nombres y texto de comentarios, 30 días siempre** — se refrescan o se borran. Si nacen
  juntas, después es una migración.
- **Y la serie de YouTube lleva marcado el corte del 24/8/2026**, cuando cambió la definición de
  `viewCount`.

### 7.4 Y lo que no se muestra de una persona

- En la galería pública: **ni cara, ni nombre, ni @ de un gurú real.** Arquetipos de estilo.
- La foto de perfil de Instagram **se dibuja, no se guarda** (la URL del CDN vence).
- Y el nombre de la tab es «Spy», pero la pantalla no: la política III.L de YouTube prohíbe
  explícitamente enmarcar una comparación como *«war», «battle»* o una rivalidad que incite
  hostigamiento. **Nada de «vs» ni de duelos en la UI.** Se mira el mercado, no se ataca a una persona.

---

## 8. Teléfono y computadora

Las dos, siempre (AGENTS.md → «La app se adapta al tamaño de la pantalla, SIEMPRE»; memoria
`disenar-escritorio-y-celular`).

- **Computadora:** la ficha es dos columnas — los bloques a la izquierda, la línea de tiempo a la
  derecha. La galería de anuncios es grilla + riel de filtros plegable (el riel es de
  `meta-ads-scraper`, que ya lo resolvió así).
- **Teléfono:** la ruta se reescribe en `lib/movil-rutas.ts` como hacen las demás
  (`/landing-generator` → `/m/landing`). La ficha pasa a **un bloque por pantalla, plegados**; la
  galería a una columna; los filtros a una hoja que sube desde abajo. La línea de tiempo es una lista
  vertical, no un gráfico apaisado.
- **Lo que no va al teléfono:** replicar una landing (es el editor) y el recorrido con la extensión (es
  Chrome de escritorio). Las dos **se dicen**, no desaparecen sin explicación.
- Los reels y los videos son verticales: la miniatura manda el alto, y **una miniatura nunca va en
  blanco** mientras carga (memoria `plantilla-estructura-y-ver-ejemplo`).

---

## 9. Lo que queda SIN decidir (para Martín)

1. **Los anuncios de Meta: DECIDIDO el 3/11/2026, «Sí, con un clic»** (Martín, sabiendo que los términos
   de Meta piden permiso escrito y pueden cortar el uso de sus productos). Se construyó como «Guardar en
   Spy» en la extensión, y es menos que la vía (b) de §4.1: no recorre nada.
   - **Lo que hace:** la persona abre los anuncios o el sitio del competidor y toca el ícono de MaKo. Con
     sólo `activeTab`, la extensión lee una vez lo que esa pestaña ya dibujó (`extension/spy-leer.js`, en
     el mundo aislado). El servidor lo interpreta (`lib/spy-captura.ts`): si cambia el diseño, se arregla
     con un deploy.
   - **Lo que no hace:** recorrer solo con scroll; bajar videos; barras dentro de la página ajena; ningún
     permiso de sitios ni content script nuevo; valores de formularios, cookies o almacenamiento. Lo leído
     de Meta **no** entra en `spy_lecturas_canal`: no se comparte entre negocios. Una lectura no marca
     nada como «ya no se ve» salvo que la Biblioteca diga la fecha en que terminó.
   - **Lo que se dice:** `app/privacidad/extension/page.tsx` y la ficha de la tienda; cada pieza lleva
     `fuente: 'recorrido'` y la pantalla dice «Lo guardaste desde tu navegador».
   - **Lo medido antes de subir** (Chrome 156, 3/11/2026): `performance` ve desde el mundo aislado lo mismo
     que la página (117 de 117 recursos en un sitio, 216 de 216 en la Biblioteca), y las variables de la
     página no (`dataLayer` da `undefined`). `chrome.action.openPopup` abre el desplegable y **no otorga
     `activeTab`**: hace falta el clic de la persona, y sin él el botón no aparece. El HTML de la Biblioteca
     y sus textos en inglés, español y portugués: docs/hallazgos-competitors-spy.md.
2. **¿Apify para los perfiles de Instagram de competidores?** El repo ya lo usa para leer un @ y lo paga
   la plataforma por centésimos de centavo. No es el caso que él revirtió (eso era enriquecer miles de
   leads), pero choca con §4.2 de los términos de Instagram. La alternativa es esperar la credencial de
   Business Discovery, que cubre sólo cuentas de empresa y creador.
3. **¿La galería pública de plantillas existe desde el día uno?** Se le explicó la regla de las caras el
   29/10 y quedó para que decida. Si la galería arranca sólo con plantillas **privadas por workspace**,
   el problema de la identidad no aparece, y la Etapa 5 se simplifica.
4. **¿Google Maps entra?** Lo pidió el 29/10. No aporta a «qué anuncios y qué reels», y merece su propio
   plan.

---

## 10. De dónde salió esto

- **El árbol:** `origin/integracion` en `ab8ffe806` (31/10/2026 02:57). ⚠️ El clon compartido de
  `dashboard-marketing/` estaba **4.592 commits atrás** — todo lo que dice este documento sobre el
  código se leyó en el tip, no ahí.
- **Las fuentes web:** consultadas el **31/10/2026**, entrando a la doc de Meta
  (`facebook.com/ads/library/api/`, `developers.facebook.com/docs/instagram-platform/…`,
  `facebook.com/robots.txt`, `facebook.com/legal/automated_data_collection_terms`), a la de Google
  (`developers.google.com/youtube/v3/determine_quota_cost`, `/revision_history`,
  `/youtube/terms/developer-policies`, `/youtube/terms/derived-metrics-policy`), a los Términos de
  Instagram (`help.instagram.com/581066165581870`), a la web pública de la Biblioteca de Anuncios
  deslogueado, y a los repos candidatos. Las licencias de `meta-ads-scraper`,
  `youtube-niche-finder` y `crawlseo` se verificaron abriendo el repo.
- **Lo que ya estaba en casa:** la memoria `lead-magnets-y-competitor-spy` (29/10, el pedido y la regla
  de las caras), `enriquecer-base-sin-apify` (24/10), `scraper-puede-marcar-leido` (26/10),
  [como-venden-otros.md](como-venden-otros.md) (el relevamiento de 80 productos del 25/10),
  [diseno-tiktok-linkedin.md](diseno-tiktok-linkedin.md) (14/10, por qué LinkedIn no),
  [hallazgos-editor-landing.md](hallazgos-editor-landing.md) (Replicar) y el relevamiento de tabs de
  [dev-tabs-mapa.md](dev-tabs-mapa.md).
- **Lo no verificado**, dicho para que nadie lo tome como medido: los rate limits de `ads_archive`
  (Meta no los publica); si `playlistItems` tiene tope de paginación por playlist; si
  `videos.list?id=` acepta más de 50 ids (la doc no declara un máximo); si la Unified Login de
  Instagram soporta `business_discovery` (el overview no lo lista y la referencia sigue diciendo
  Facebook Login); si `paidProductPlacementDetails` es público para videos ajenos; y el precio de
  suscripción de plataforma de Apify aparte del pay-per-result.

---

## 11. La búsqueda por red (4/11/2026)

> Martín, 4/11: «La barra principal de búsqueda debería funcionar igual que cuando le doy al "+", solo que ahí
> debería estar diferenciado las redes, Instagram, YouTube, Sitio Web... Si busco solo nombre, y tarda en buscar,
> debería ir diciéndome "Esto puede tardar 20 segundos"... Y si busco solo el nombre TAMBIÉN debería buscar en
> YouTube... me buscó Instagram con muy poquitos seguidores... no me trajo ni 1 solo de las cuentas grandes de
> victor heras.»

**Qué hace hoy:** la barra de arriba y el «+» abren el MISMO buscador (`app/competitor-spy/BuscadorAlta.tsx`), con un
grupo por red y su logo: Instagram, YouTube, TikTok, Sitio web. Qué se busca lo decide `planDeBusqueda`
(`lib/spy-buscar-reglas.ts`), y los pedidos salen EN PARALELO a `/api/competitor-spy/buscar`: lo rápido no espera a lo
lento, y cada grupo se llena cuando llega lo suyo, con una línea que dice cuánto puede tardar.

**Por qué Google para el nombre, y no otro actor de Instagram.** El buscador de Instagram ordena por relevancia con la
sesión de quien busca; un scraper sin sesión sólo empareja texto, y «Víctor Heras» empareja igual con una cuenta de 14
seguidores que con una de 492 mil. Google ordena por popularidad sin sesión y escribe los seguidores en la descripción
del resultado («492K Followers…»), así que con UNA corrida de dos páginas (`site:instagram.com` y `site:youtube.com`)
salen los perfiles grandes y los canales, y se ordenan por seguidores. El buscador de Instagram corre igual, al lado,
para las cuentas que Google todavía no conoce. Las primeras cinco filas se completan con su foto y sus seguidores en UNA
corrida del lector de perfiles (antes eran cinco).

**YouTube nunca usa `search.list`** (§4.3: 100 llamadas por día para toda la app). Por nombre sale de Google; un enlace
o un @ se leen con `channels.list` (1 unidad), que ahora también trae la foto del canal. Esa foto es la cara del
competidor cuando no tiene Instagram (`mirarCompetidor`).

**Lo que cuesta, por negocio y con SU clave de Spy** (precios de la tienda de Apify; los de Google y el buscador de
Instagram, medidos el 3/11/2026; el del lector de perfiles, de la tienda, sin medir desde la nube):

| Qué | Cuánto | Cupo por día | Peor día |
|---|---|---|---|
| Una búsqueda por nombre: Google (2 páginas) + el buscador de Instagram | US$0,0215 | 60 corridas = 30 búsquedas (`TOPE_BUSQUEDAS_SPY_POR_DIA`) | US$0,65 |
| Leer un perfil (el @ exacto, completar filas, la confirmación) | ~US$0,0026 | 150 lecturas (`TOPE_LECTURAS_SPY_POR_DIA`), 30 reservadas para agregar | ~US$0,39 |
| Un canal de YouTube | 1 unidad de cuota (gratis) | — | — |

El cupo de lecturas era 40 y lo compartían las búsquedas: alcanzaba para tres búsquedas por día. Se separó y se subió
porque completar las filas es lo que permite ordenar «los mejores resultados». El techo por corrida sigue siendo
`APIFY_TOPE_USD` (US$0,02 por perfil).

**Lo que se decidió sin preguntar** (con criterio, para no frenar):
- Con «@» se lee sólo ese @ (y su canal de YouTube con el mismo @, 1 unidad): quien escribe la arroba sabe a quién
  busca. Sin «@», una palabra que puede ser un usuario («den.borgg») se lee como @ Y se busca como nombre.
- «algo.xx» es un sitio sólo si «xx» es un dominio de verdad (`esDominio`); «den.borgg» era la página https://den.borgg.
- El @ que sale de pegar un nombre («Víctor Heras» → @victorheras) se prueba, pero NO va primero: compite por seguidores.
- «Si tienes el @ exacto es inmediato» no se escribió así: el @ se lee por Apify y tarda unos segundos. Dice «Con su @
  exacto es más rápido».

## 12. La ficha: automática y sin lo que no se entiende (4/11/2026)

> Martín, 4/11 (puntos 5, 6, 11, 13 y 14): «elimina textos innecesarios… Lo de "Buscar sus otras redes" debe ser
> automático, no un botón… "Con qué abre" no se entiende… la IA ya debería analizar por sí sola todo, sin pedirlo…
> "Sigue a la vista" y "Probado" no se entiende qué hacen… Si encuentra la web, que la analice automáticamente… Donde
> sale MaKo, previo a la animación, no debería haber absolutamente nada más en pantalla».

**Sus otras redes, solas** (`/api/competitor-spy/redes`, `buscarOtrasRedes`). Se buscan al abrir la ficha de alguien a
quien le falta una red, DESPUÉS de la primera lectura, y una vez por semana por competidor y por negocio
(`redes-recordar.ts`): cada búsqueda es una corrida de Google (US$0,00455) más leer a los candidatos, y lo paga el
negocio. El criterio (`veredictoDe`):

| Evidencia | Qué pasa |
|---|---|
| Se enlazan entre ellos (su bio nombra el @ o el canal, o al revés, o el mismo sitio) | Se suma solo, con «Deshacer» |
| Misma foto (dHash de 64 bits a ≤10 bits) **y** mismo nombre | Se suma solo, con «Deshacer» |
| Sólo la foto, o sólo el nombre | Se pregunta: «¿Son suyas?», con su foto y el porqué |
| Nada en común | No se muestra |

Si con el nombre no aparece una segura, se busca otra vez por su @ («que vaya buscando hasta encontrar»). **No hay IA
en este paso, a propósito:** comparar fotos y enlaces es medible y gratis; una IA que «razona» sobre dos perfiles
públicos costaría en cada ficha y no puede verificar más que esto. Si hace falta más criterio, el siguiente paso es
mandarle las dos fotos a la IA DEL NEGOCIO sólo para los casos «quizás».

**La IA lee sola** (`/api/competitor-spy/analizar` → `analizarCompetidor(…, { soloPendientes })`). Después de cada
lectura, la pantalla la llama y NO espera: el trabajo sigue en un `after()` del servidor, de a 30 piezas
(`PIEZAS_POR_ANALISIS`, las de más vistas primero) y hasta 3 tandas por pedido. Las tarjetas sin análisis dicen
«Analizando…» y la pantalla vuelve a pedir las piezas cada 5 s. **La IA es la del negocio** (`chatCheapCascade`: su
Claude, después su GPT o su Gemini); antes caía a `chatClaude`, que es la de la plataforma (el veto la frenaba porque
`spy` no está en `CLAUDE_PERMITIDO`). Sin IA conectada no se dibuja «Analizando»: se ve lo que hay. «Con qué abre» y el
menú «Qué vende y qué ataca» se fueron: el gancho es el título de cada tarjeta y la oferta sale del mismo análisis.

**Qué ver:** un desplegable de tipos —Todo · Reels · Carruseles e imágenes · Videos de YouTube · Shorts— con cuántas tiene
cada uno, y al final «Agregar su Instagram» / «Agregar su YouTube» si le falta. Reemplaza a los chips de canal, «Sigue a
la vista» y «Probado». El orden es «Más vistas» o «Más reciente». La tarjeta dice «Hace N d» (lo orgánico) o «N d al
aire» (un anuncio): la etapa (Test nuevo · Ganando tracción · Probado) ya no se dibuja.

**Miniaturas** (pedido del 4/11 por el Cerebro: «un apartado exclusivo para las miniaturas de YT junto a los
titulares»): una pestaña con cada video de YouTube como en YouTube —miniatura 16:9, título y vistas—, de la más vista a
la menos.

**Su sitio, solo:** se toma de la descripción de su canal o de su bio de Instagram (`sitioDelTexto`: el primer enlace
que no es una red, un acortador, un Linktree ni un correo) y se lee con su funnel en la misma lectura. El botón que
quedaba es el de copiarlo: «Copiar su sitio» (abre el Web Generator con `?analizar=`).

**La animación:** mientras se lee y mientras se bajan las miniaturas, en la pantalla está SÓLO `CargandoMako` (la pieza
común). La animación arranca con todas las miniaturas ya bajadas (o a los 8 s: las que no llegaron entran con su
texto), y la miga, las pestañas y sus redes aparecen recién al terminar. Las carpetas son los tipos de contenido, no
«Videos · Probado».

## 13. La caricatura, sola (4/11/2026)

> Martín, 4/11 (por el Cerebro): «me traje a @den.borgg y no me hizo la caricatura como habíamos quedado... Eso debe
> hacerse en segundo plano de manera automática».

La pantalla le pide a `/api/competitor-spy/caricatura` un paso por vez para cada competidor sin caricatura, de a uno y
cada 15 s mientras esté en marcha (`lib/spy-caricatura-auto.ts`, con los pasos en `lib/spy-caricatura-reglas.ts`):

1. **Rasgos:** la IA DEL NEGOCIO mira su foto y dice en una línea, en inglés, qué distingue su cabeza (pelo, barba,
   lentes…). Es lo único que cambia por persona en el prompt aprobado (`promptDeCaricatura`). Sin una cara, no se insiste.
2. **Cara:** la foto sube a Flow (`caraDelCompetidor`).
3. **Pedido:** `generar_imagen` por la cola de Flow, con una ruta que la cola le firma al puente (`rutaDeSubida`), así la
   imagen vuelve a nuestro Storage y no como la url de Flow, que vence en una hora.
4. **Lista:** se copia al bucket de Spy y se anota en `spy.caricaturas` (app_settings del negocio; sin migración). La
   tarjeta la usa antes que la caricatura dibujada de un referente y que la foto.

**No se hace** para un referente (sus 22 están dibujadas y aprobadas), sin foto, en la prueba gratis (gastaría una de sus
imágenes sin pedirlo) ni sin el puente de Flow listo (el pedido quedaría en la cola para siempre). Un pedido que nadie
toma en 15 minutos se cierra; dos fallos de Flow y se queda con su foto.

**Lo que cuesta:** la imagen, 0 créditos de Flow (`TOPE_CREDITOS.imagen`); los rasgos, una lectura de una foto con la IA
del negocio.

**Lo que hace falta para que corra en un negocio:** la extensión de MaKo conectada y Google Flow abierto en ese
navegador (el mismo requisito que el AI Avatar). Sin eso la tarjeta sigue con la foto, sin aviso.

## 14. Traer todo: sus publicaciones, sus videos y sus anuncios (4/11/2026)

> Martín, 4/11 (puntos 8 y 10): «que no traiga solo 50 reels o videos, que traiga muchos más, si puede, todos
> directamente» y «falta todo lo de ADS en Competitors Spy, todos los anuncios de la biblioteca de anuncios... Que los
> traiga para analizarlos».

**Corridas largas que no se esperan** (`lib/spy-todo.ts`, `/api/competitor-spy/todo`). Cien publicaciones tardan uno o
dos minutos en Apify: esperar adentro de «Revisar ahora» la cortaría a los 60 s. El servidor EMPIEZA una corrida
(`/acts/…/runs`, contesta en el acto), anota su id en `spy.todo` (app_settings del negocio, sin migración), y la ficha
pregunta cada 20 s; cuando termina, se guarda con el mismo camino que la lectura de siempre y la IA del negocio la lee
sola (§12). Si se cierra la pestaña, la corrida termina en Apify y la próxima apertura la recoge.

| Qué | Cuánto | Cada cuánto | Cuesta (clave de Spy del negocio) |
|---|---|---|---|
| Sus publicaciones de Instagram (`apify~instagram-scraper`, `resultsType: posts`) | 300 la primera vez; después lo nuevo (hasta 40) | 1 vez por semana por competidor | US$2,30 por mil (tienda): ~US$0,69 la primera, ~US$0,09 después; techo por corrida |
| Sus videos de YouTube (`channels.list` + `playlistItems` + `videos.list`) | 500 la primera vez (10 páginas); después, los últimos | en cada lectura | 20 unidades la primera, 8 después, de la cuota de la plataforma (10.000/día) |
| Sus anuncios (`apify~facebook-ads-scraper`) | 200 por corrida, activos y viejos | 1 vez por semana por competidor | sin medir: techo de US$0,006 por anuncio (US$1,20 por corrida) |

Tope de corridas largas por negocio: 6 por día (`CORRIDAS_LARGAS_POR_DIA`); el peor día, ~US$4,14 si son seis primeras
corridas de Instagram. La ficha dibuja de a 60 tarjetas («Ver más») y lee hasta 2.000 piezas por competidor.

**Lo que se arregló al traer todo:** la lectura de siempre marcaba como «borrada» toda pieza que no venía en ella. Con el
historial completo, cada «Revisar ahora» habría marcado años de publicaciones. Ahora sólo cuenta lo que esa lectura podía
ver: lo publicado desde lo más viejo que trajo (`seFueron`).

**Los anuncios: los caminos, con su riesgo** (lo posterior manda: el 3/11 fue «Sí, con un clic» desde la extensión; el
4/11, «todos»):

| Camino | Riesgo para las cuentas del cliente | Otros | Elegido |
|---|---|---|---|
| (a) La API oficial de la Biblioteca | Ninguno | Fuera de la UE y el Reino Unido sólo devuelve anuncios políticos: para un competidor de LATAM, nada | No |
| (b) La extensión recorriendo la Biblioteca entera (scroll solo) | **Alto:** automatiza la sesión de Facebook DEL CLIENTE, que es lo que Meta detecta y castiga | Recorrer páginas ajenas pide más permisos y otra revisión de la tienda | No |
| (c) «Guardar en Spy» con un clic (lo del 3/11) | Bajo: lee una vez lo que la persona ya abrió | Trae sólo lo que se dibujó en esa pestaña, no «todos» | Sigue, como respaldo |
| (d) Un actor de Apify sobre la Biblioteca pública | **Ninguno:** corre en los servidores de Apify, sin la sesión de nadie | Va contra los términos de Meta (recolección automatizada); lo paga el negocio con su clave de Spy, como Instagram | **Sí** |

Se eligió (d), el mismo criterio que Martín ya tomó para Instagram en Spy. **Queda APAGADO hasta medir el actor**
(`ANUNCIOS_POR_APIFY = false`): la nube no llega a apify.com y la forma de su respuesta no se pudo leer. Para prenderlo:
`node --env-file=… scripts/probar-anuncios-apify.mjs <ws> <id de su Página o su nombre>` una vez desde la PC; si
«entendidos» es la mayoría y el costo cabe en el techo, se cambia la constante a `true`.

## 15. El detalle de cada competidor: todo en un gráfico, y «Copiar estructura» (4/11/2026)

> Martín, 4/11 (puntos 7 y 9): «Quiero que analices este video… y quiero que eso sea el Detail de cada competidor… como va
> poniendo todos sus contenidos en un gráfico… uno para contenido corto, otro para contenido largo, de sus carruseles o
> imágenes, y luego el análisis de su web» y «si se selecciona un reel, un YT, un carrusel, o una web, debería fácilmente
> estar el botón de "Copiar estructura", y que lo procese en todas las herramientas que ya tenemos en MaKo».

### Lo que muestra el video (la base, mirada cuadro por cuadro por el Cerebro)

El video (39,9 s, cuenta buildingwithharsit, la herramienta «Creators · Foundable»). Se copia la FUNCIÓN y la idea del
movimiento, no los textos ni la marca.

1. **Arriba, tarjetas de números**: creadores, videos (420), vistas (3,6M), mediana (5k), CPM y gasto. La tarjeta elegida va
   en negro y la destacada, en azul. Debajo, un filtro por red con su cantidad: Todos, TikTok, Instagram y YouTube.
2. **La animación principal**: una columna a la izquierda con las mejores miniaturas, que vuelan desenfocadas hacia un
   gráfico de dispersión. Cada punto ES la miniatura del video: X = el día en que se publicó (1 a 30), Y = sus vistas en
   escala logarítmica (100 a 100k). Rótulo: «Cada miniatura es un video».
3. **Tocar una miniatura**: su título, «#51 de 420», sus números, la «Anatomía del guion» (una barra de colores por tramo
   —gancho, planteo, producto, prueba, CTA— con cada frase, su minuto, su etiqueta y las palabras clave resaltadas), la curva
   de «siguen mirando» y la miniatura con el logo de su red.
4. **«¿Qué formatos ganan?»**: barras horizontales por formato (POV, Storytime, Antes y después, Reseña honesta, Unboxing),
   que se abren en filas: en cada una, sus miniaturas ubicadas por sus vistas y una línea negra en la mediana del formato. A
   la izquierda, el nombre, cuántos y el mejor gancho. Encima, una tarjeta oscura con la lectura: «X y Y tienen 2,3x y 1,6x
   la mediana; evitaría Z».
5. **El modal de un video de un formato ganador**: el reproductor a la izquierda (vistas, formato) y, a la derecha, la cuenta
   y sus seguidores, el título, los hashtags y el «Guion completo» con su barra de colores y sus frases.

### Cómo se adapta a Spy

- **El detalle es esta pantalla**: la pestaña «Gráfico», la primera de la ficha, con el riel de siempre a la derecha
  (`app/competitor-spy/GraficoSpy.tsx`; las cuentas, puras y con test, en `lib/spy-detalle.ts`).
- **Un desplegable cambia el gráfico**: Contenido corto (reels y shorts), Contenido largo (YouTube), Carruseles e imágenes,
  Anuncios y Su web (que lleva a su pestaña: una web no es un gráfico). Ahí mismo se agrega la red que le falta.
- **Arriba**: piezas, vistas (o «me gusta»), la mediana y «Le funciona» (el formato que más rinde, si hay uno). El filtro de
  redes, con su logo y su cantidad, sólo si el gráfico tiene más de una.
- **Ejes**: X = el día en que se publicó; Y = vistas en escala logarítmica. Donde la mayoría no tiene vistas (Instagram las
  da sólo en los reels), «me gusta»; en los anuncios, los días al aire. Lo que no tiene número no se dibuja en cero.
- **Antes de la animación, sólo la criatura**; se bajan TODAS las miniaturas que se van a dibujar (`precarga.ts`, la misma
  pieza que la película del orden) y recién ahí entran volando. Hasta 180 miniaturas por gráfico (90 en el teléfono): las
  de más arriba y una muestra pareja del resto en el tiempo, y el pie dice «se ven 180 de 2.000».
- **Tocar una miniatura** abre su detalle (`DetallePieza.tsx`): el video de YouTube (o la imagen de Instagram), «#51 de
  420», sus números, su estructura (gancho, ángulo, formato) con «Analizando…» mientras la IA del negocio no la leyó, sus
  hashtags y «Copiar estructura». Las tarjetas de «Lo que publica» y de «Anuncios» abren el mismo detalle.
- **Los formatos se llenan solos**: la IA del negocio le pone a cada pieza su formato al analizarla (POV, Storytime, Antes y
  después, Tutorial, Lista o tips, Opinión, Reseña, Testimonio, Detrás de escena, Entrevista), sin que nadie lo pida. Lo
  analizado antes del formato se lee UNA vez más, después de lo que nunca se leyó. Un formato necesita dos piezas para
  tener fila, y la lectura de arriba la escribe el CÓDIGO con medianas (`lecturaDeFormatos`), no una IA.
- **Lo que NO va, a propósito**: la «Anatomía del guion» y la curva de «siguen mirando». La retención no la publica nadie, y
  partir el guion en tramos pediría otra lectura de la IA. Un bloque sin datos no se dibuja y no dice «falta».
- **El guion completo SÍ va desde el 4/11/2026, en los reels de Instagram** (Martín: «En cada uno de los videos cuando entro
  no estás trayendo la transcripción»): al abrir el detalle se pide su video fresco a Apify (UNA publicación, con la clave de
  Spy del negocio y un tope de 40 por día) y lo escucha la IA del negocio, con «Transcribiendo…» mientras tanto
  (lib/spy-transcripcion.ts). Un video de YouTube sigue sin forma permitida (`captions.download` pide ser su dueño, y
  bajarlo va contra sus términos): ahí va su descripción. Si se quiere, es una decisión de Martín (docs/relevo/nube-spy.md).
- **El detalle se rehízo el 4/11/2026**: quién lo publicó con su foto y sus seguidores, sus números con «frente a su
  mediana» (vidIQ), su estructura en filas de etiqueta y valor (Linear), su guion y su texto. «Copiar estructura» pasó a
  ser «Hacer uno así», con la estrella de MaKo, en el pie que no scrollea.

### «Copiar estructura»

`/api/competitor-spy/copiar` arma una página del **Copywriter** del tipo que corresponde (un reel o un short → Reel; un
video largo → YouTube; un anuncio → Anuncio; una publicación → Post) con de dónde viene, su estructura (gancho, ángulo,
formato) y su texto CITADO («> »: una línea suya en MAYÚSCULA no abre una sección del guion), y la pantalla la abre. Ahí el
chat de MaKo la escribe con la oferta y la voz del negocio. Quien no tiene el Copywriter (hoy lo ve sólo el super admin) se
lleva el mismo texto copiado al portapapeles. Una web va al **Web Generator** con «Copiar su sitio» (`?analizar=`). Ninguna
IA corre al copiar.
