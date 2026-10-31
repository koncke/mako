# Hallazgos — Competitors Spy (y las APIs de afuera que mira)

Lo que se aprendió relevando las fuentes de la tab el **31/10/2026**, antes de escribir una línea.
Es sólo-lectura: la tab es `ComingSoon` (`app/competitor-spy/page.tsx`, nav key `market-an`). El plan
está en [diseno-competitors-spy.md](diseno-competitors-spy.md); acá van **las trampas**, que es lo que
se pierde si queda sólo en el plan.

Casi todas son del mismo tipo: **una API que devuelve otra cosa en vez de un error.**

---

## El diagnóstico obvio era el equivocado

### `ad_type=ALL` de la Ad Library no significa «todos los anuncios»

El enum de `ad_type` es **temático** (`ALL, EMPLOYMENT_ADS, FINANCIAL_PRODUCTS_AND_SERVICES_ADS,
HOUSING_ADS, POLITICAL_AND_ISSUE_ADS`); la cobertura **geográfica** es un filtro aparte y fijo que no se
puede cambiar. Fuera de la UE y el Reino Unido, la API devuelve **sólo anuncios de política y temas
sociales** — y para un competidor comercial argentino devuelve **una lista vacía con HTTP 200**, no un
error. Textual en `facebook.com/ads/library/api/`, en la nota de `ad_reached_countries`: *«Ads that did
not reach any location in the EU will only return if they are about social issues, elections or
politics»*.

**Es la trampa que hace construir media tab antes de descubrirlo.** Y la web pública de la Biblioteca
replica exactamente la misma asimetría (verificado deslogueado el 31/10: el detalle de un anuncio de
Argentina no tiene gasto ni alcance; el mismo tipo de anuncio en España trae la sección «Transparency
by location → European Union»). **No hay atajo por la UI.**

**Regla:** antes de prometer datos de anuncios de un país, probar `ads_archive` con ESE país y
`ad_type=ALL`. Si vuelve vacío, no es un bug.

### `search.list` de YouTube ya no cuesta 100 unidades: tiene balde propio de 100 LLAMADAS/día

Cambio del **1/6/2026** (`developers.google.com/youtube/v3/revision_history`), hoy en
`/determine_quota_cost`: *«a default quota allocation of 100 search.list calls, 100 videos.insert calls,
and 10,000 units per day combined for all other endpoints»*. **El costo por llamada bajó a 1, pero el
tope es de 100 llamadas por día para TODA la app**, no por usuario ni por workspace.

Todo tutorial, todo blog y toda memoria de modelo anteriores a junio de 2026 dicen «search.list cuesta
100 de 10.000» — y de ahí se deduce «100 búsquedas por día, me alcanza». **La cuenta da lo mismo y la
conclusión es otra:** con el sistema viejo las búsquedas competían con el resto y se podían priorizar;
con el nuevo el tope es duro y no se amplía gastando menos en otra cosa. **Cualquier feature con forma
de buscador está muerta a escala.**

**Regla:** el camino es `channels.list` → `contentDetails.relatedPlaylists.uploads` →
`playlistItems.list` → `videos.list` en lotes de 50 (≈0,04 unidades por video hidratado, ~250.000
videos/día de techo). El playlist de subidas **se lee de la API**, no se deriva cambiando `UC`→`UU`.

### `tags` de un video ajeno SÍ vienen — pero sólo por `videos.list`

El síntoma es «la API no devuelve las etiquetas de videos de otros canales», y la causa es el
**endpoint**: `search.list` nunca trae `snippet.tags`; `videos.list?part=snippet` sí. La única
deprecación de `tags` del revision history (12/5/2021) es la de **playlists**, no la de videos, y es la
fuente de la confusión. Verificado además en vivo: los tags de un video de otro canal están públicos en
el `<meta name="keywords">` de la propia página de YouTube.

**Regla:** si los tags vienen vacíos, mirar de qué endpoint salió el video antes de concluir que la API
no los da.

### Derivar «vistas por hora» está prohibido por DEFECTO, y la solución no es técnica

Developer Policies **III.E.4.h**: *«Your API Clients must not… access or use API Data to create new or
derived data or metrics»*, y nombra el caso: *«a score that factors in likes, total views, or any other
API Data»*. O sea: **el VPH, el score de SEO y el ranking de competidores — el producto entero de
vidIQ — están explícitamente prohibidos.** Y **III.E.4.b** pone el tope: los datos de un tercero son
*«Non-Authorized Data»* y **no se guardan más de 30 días**.

**Nadie busca la solución donde está:** no es una excepción técnica, es la política **III.L**, nueva
desde el **1/6/2026** (`developers.google.com/youtube/terms/derived-metrics-policy`), que se habilita
aceptando la enmienda **«Section 5: Use Cases → Analytics & Reporting»** dentro del pedido de
ampliación de cuota. Con ella quedan permitidos, textualmente, los scores propios, los leaderboards de
*«Top YouTuber by View Growth»*, las curvas de 36 meses, el análisis de sentimiento y la estimación de
ingresos (con leyenda prominente de que es estimación de un tercero).

**Regla:** la enmienda se acepta **antes** de escribir el primer snapshot. Sin ella, la sanción
declarada es *«quota reduction or termination of your API access»*, y esa key es la misma que usa
`lib/youtube.ts` en producción.

### El scraping de Instagram sin login viola los ToS igual que con login — **y tampoco da el dato**

Terms of Use de Instagram, **§4.2** (`help.instagram.com/581066165581870`): prohíbe recolectar
información *«in an automated way without our express permission, **regardless of whether such automated
access or collection is undertaken while logged-in to an Instagram account**»*. El argumento «pero es
público sin login» no existe. Y en la misma sección: *«You can't sell, license, or purchase any account
or data obtained from us»* — **comprar datos raspados también está cubierto**.

Y lo útil, medido el 31/10 en un perfil público sin sesión: se ven nombre, bio, seguidores y los
**primeros ~12 posts**, y **no se ve ni un like ni una vista**, ni en la grilla ni en el post
individual. El muro de login cae en el primer «Show more posts» — no son «unos scrolls». **El camino
ilegal tampoco funciona:** `business_discovery` es a la vez el único legal y el más completo (da
`like_count` y el `view_count` de reels, que la página pública no muestra).

### GitHub miente sobre la licencia, y el buscador no encuentra el repo bueno

- **`NOASSERTION` no significa nada.** `subzeroid/instagrapi` y `thp/urlwatch` figuran así y sus
  `LICENSE` son **MIT** y **BSD-3-Clause**; `facebookresearch/Ad-Library-API-Script-Repository` figura
  igual y ahí sí es una **licencia propietaria de Meta** que ata el uso a sus APIs. Hay que abrir el
  archivo y leerlo.
- **Lo que rankea primero en Google no es lo que sirve.** Buscando «ad spy open source» sube
  `nimrodyar/AdsLab`: 0 stars, sin descripción y **sin licencia**. El candidato bueno
  (`athm793/meta-ads-scraper`, Apache-2.0, Next.js 16) **no aparece en ninguna búsqueda web**: se
  encuentra entrando a `github.com/topics/ad-library`. **Las páginas de topics de GitHub rankean los
  repos de nicho mejor que cualquier buscador.**
- **Los directorios de alternativas (AlternativeTo, SaaSHub) no sirven para licencias:** no detectaron
  ni una de las cuatro AGPL-3.0 del relevamiento.
- **Y stars altas no son señal de calidad en la familia Instagram:** la búsqueda por stars devuelve
  malware mezclado con herramientas legítimas (un ladrón de cookies con 446★, uno que promete ver posts
  privados con 1.105★). Leer la descripción antes de abrir el repo.

---

## Topes y vacíos del entorno que no dan error

| Fuente | Qué hace en vez de fallar |
|---|---|
| **`ads_archive` con un país no-UE** | HTTP 200 con lista vacía. No dice «esta fuente no cubre tu país». |
| **`spend` e `impressions` de la Ad Library** | **Devuelve tramos de TEXTO** (`<100`, `1K-5K`, `>1M`), no números. Un parser que espera `number` recibe un string y, si lo coacciona, produce `NaN` o un 1 — un número inventado. Y la doc de Meta **se saltea el tramo 500K–1M**. |
| **`instagram_business_account` en la Graph API** | Si la página no tiene un Instagram vinculado, Meta **omite el campo**. No da error. Ya medido en casa el 22/10 y escrito en `lib/instagram-perfil.ts`: así se descubrió que el token de la plataforma (ws9) no tiene **ningún** permiso de Instagram y la página «Hola MaKo» no tiene Instagram. |
| **Contadores de Instagram ocultos por el dueño** | El dueño puede ocultar likes, comentarios, vistas, reposts y compartidos **uno por uno**, y entonces **el campo no viene**. Un `?? 0` muestra «0 likes» sobre un post con miles. **Todos nullable de verdad.** |
| **`dislikeCount` de YouTube** | Privado desde el 13/12/2021: **no devuelve 0, no devuelve el campo.** Mismo `?? 0`, mismo dato inventado. |
| **`viewCount` de YouTube** | **Cambió de definición el 24/8/2026**: cuenta la vista en el momento en que el video empieza a reproducirse. Toda serie histórica que cruce esa fecha tiene un **salto artificial** que se lee como un despegue. Hay que marcar el corte en el gráfico. |
| **`media_url` de Instagram** | Se **omite** en videos con audio con copyright o reels con descargas desactivadas. La doc de Meta dice textual que hay que tratarlo como opcional y caer a `permalink` o `thumbnail_url`. |
| **`profile_picture_url` de Instagram** | Es una URL del CDN de Meta que **vence**. Sirve para dibujar una lista, **nunca para guardar**: persistirla produce avatares rotos semanas después. Ya está escrito en `lib/instagram-perfil.ts`. |
| **Paginación del edge `/media`** | Trae cursores `before`/`after` pero **sin** campos `next`/`previous`: las query strings se arman a mano. Y **no soporta ordenar**. |
| **`captions.download` sobre un video ajeno** | `forbidden`: *«requires the user to have permission to edit the video»*. `captions.list` (50 unidades) sólo dice que las pistas existen. **No hay vía legal para transcribir el video de un competidor.** |
| **Rate limits de `ads_archive`** | **Meta no los publica.** Las cifras de «200 llamadas/hora» que circulan en blogs de vendors **no están en la doc**. Existe el error `613` documentado y el límite genérico de plataforma. No tratarlo como medido. |
| **Ampliar la cuota de YouTube** | No es un formulario: exige un **API Compliance Audit** con el caso de uso declarado. |

---

## Lo que gobierna código nuevo

1. **Son DOS permisos, no uno.** La **licencia** (copyright) habilita a copiar el código; los **términos
   del proveedor** (contrato) habilitan a usar el dato. MIT no autoriza a raspar Meta. Está en
   AGENTS.md porque es la confusión que hace que alguien integre un scraper «porque la licencia es MIT».
2. **Dos retenciones distintas en la misma tabla, separadas desde la primera migración.** YouTube: las
   **métricas** (views, likes, subs, comments y sus snapshots) hasta **36 meses** con la enmienda III.L;
   **títulos, descripciones, nombres de creadores y texto de comentarios, 30 días siempre** — se
   refrescan o se borran. Si nacen en la misma columna, después es una migración.
3. **Un contador ausente no es cero.** Vale para Instagram y para YouTube, y es la misma distinción que
   este repo ya pagó cara con el 0% de retención. `landing-vigilancia.ts` lo tiene escrito en su
   cabecera: *una lectura que falló es «NO SÉ», jamás «lo sacaron»*.
4. **Un rango se dice rango.** Nunca un tramo (`1K-5K`) convertido en un punto de un eje.
5. **Nada de «vs» ni de duelos en la UI.** La política III.L prohíbe explícitamente enmarcar una
   comparación como *«war»*, *«battle»* o una rivalidad que incite hostigamiento. La tab se llama Spy;
   la pantalla mira el mercado, no ataca a una persona.
6. **Ni cara, ni nombre, ni @ de un gurú real en la galería pública** (decisión de Martín, 29/10).
   Arquetipos de estilo. Dentro del análisis privado de un negocio, el competidor que *ese* negocio
   eligió sí se ve como fuente.

---

## Lo que quedó SIN hacer

- **La tab entera.** Es `ComingSoon`; el plan por etapas está en
  [diseno-competitors-spy.md](diseno-competitors-spy.md) §6. **Vive en:**
  `app/competitor-spy/page.tsx`, `app/_components/nav.ts` (`market-an`, `comingSoon: true`).
- **Los dos trámites de la Etapa 0, que bloquean y tardan días:** aceptar la enmienda III.L de YouTube,
  y conseguir que Business Discovery ande (vincular un Instagram profesional a la página de la
  plataforma y pedir `instagram_basic` para el token de ws9 — medido el 22/10: hoy no hay ninguno).
- **Ampliar los campos de Business Discovery.** Hoy `CAMPOS_PERFIL` pide
  `caption,timestamp,media_type` de 6 publicaciones. Faltan
  `like_count,comments_count,view_count,media_product_type,media_audio_type,permalink,thumbnail_url`.
  **Vive en:** `lib/instagram-perfil.ts` (`CAMPOS_PERFIL`, `POSTS_A_LEER`).
- **El lector de YouTube por canal no existe.** `lib/youtube.ts` resuelve la clave y lee métricas de
  videos propios; falta `channels.list` → playlist de subidas → `playlistItems` → lotes de
  `videos.list`. **Vive en:** `lib/youtube.ts`.
- **Generalizar la vigilancia a páginas de terceros.** `lib/landing-vigilancia.ts` y
  `lib/landing-snapshot.ts` ya hacen «mirá, acordate y decí qué cambió» con la regla correcta, pero
  sobre la landing **del negocio**.
- **Dos decisiones de Martín, en [diseno-competitors-spy.md](diseno-competitors-spy.md) §9:** si los
  anuncios de Meta van por el recorrido a la vista con la extensión (riesgo de ToS, mismo que ya aceptó
  para WhatsApp pero esta vez el dato se le muestra a un cliente que paga), y si Apify se usa para los
  perfiles de Instagram de competidores.
- **Sin verificar**, para que nadie lo tome como medido: si `playlistItems` tiene tope de paginación por
  playlist; si `videos.list?id=` acepta más de 50 ids (la doc no declara un máximo, 50 es el batch de
  facto de las client libraries); si la **Unified Login** de Instagram soporta `business_discovery` (el
  overview no lo lista y la referencia sigue diciendo Facebook Login — si lo soporta, se ahorra el
  requisito de la Página de Facebook); y si `paidProductPlacementDetails` es público para videos ajenos
  (no figura entre las partes restringidas al dueño; si lo es, detecta qué videos del competidor
  declaran promoción paga).
