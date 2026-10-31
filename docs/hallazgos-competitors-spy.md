# Hallazgos — Competitors Spy (y las APIs de afuera que mira)

Dos tandas, las dos del **31/10/2026**: primero lo que se aprendió **relevando** las cuatro fuentes de
afuera antes de escribir una línea, y después lo que apareció **construyendo la Etapa 1** (la lista, la
ficha por bloques, el onboarding y el área `spy` de la API — etiqueta `nube/competitors-spy-3110`). La
tab ya no es `ComingSoon`: vive en `app/competitor-spy/`, con la nav key `market-an`, y el plan por
etapas sigue en [diseno-competitors-spy.md](diseno-competitors-spy.md). Acá van **las trampas**, que es
lo que se pierde si queda sólo en el plan.

Casi todas las de la primera tanda son del mismo tipo: **una API que devuelve otra cosa en vez de un
error.** Casi todas las de la segunda son del tipo opuesto: **un guard o una regla nuestra que marca
de más, y manda a arreglar algo que estaba bien.**

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

---

## Lo que se aprendió CONSTRUYENDO la Etapa 1 (31/10, después del relevamiento)

Lo de arriba se midió **antes** de escribir código, leyendo las APIs. Lo de acá apareció **al
escribirlo**, y ninguna se deduce leyendo el código que quedó.

### Un vocabulario que tiene que compartirse no puede vivir en un módulo con `server-only`

El plan decía «los vocabularios de ángulo y gancho se comparten en vez de duplicarse», y eso era
**imposible de cumplir**: `HOOK_TYPES`, `BEAT_KINDS`, `TAG_VOCAB` y `ANGLES` vivían dentro de
`lib/ads-analyst.ts`, que lleva `import 'server-only'` porque llama a Claude. Y una definición de
área de la API (`lib/api-mako/areas/*.def.ts`) **no puede importar un VALOR de un módulo con
`server-only`** — lo exige `tests/api-mako-registro.test.ts`, que sigue los imports transitivamente.

El síntoma no es un error claro: es que la salida barata (copiar la lista) funciona perfecto y deja
**dos vocabularios que se separan solos**. Y cuando se separan, «lo que hace la competencia» y «lo
que hacemos nosotros» dejan de ser comparables, que es justo para lo que sirve la tab.

**Regla:** una lista con la que más de un lugar tiene que estar de acuerdo va en un módulo PURO, sin
`server-only` y sin imports. Las cuatro se mudaron a `lib/ads-analyst-vocabulario.ts`, y
`lib/ads-analyst.ts` las vuelve a exportar, así que ningún importador de antes cambió.

### Dos guards propios se pusieron ROJOS contra código correcto, los dos por buscar una palabra

Las dos veces el guard encontraba **su propia explicación**:

- el que mira que la migración no tenga columna para la foto leía el `.sql` con el stripper de
  comentarios de **TypeScript**, que saca `//` y los bloques y **no saca los `--` de un `.sql`**:
  encontraba la frase «sin `no_megusta`, que YouTube no devuelve» de la propia cabecera;
- el que mira que no se use `search.list` buscaba ese texto, y encontraba la constante
  `ENDPOINT_PROHIBIDO = 'search.list'` que lo documentaba, en el mismo archivo.

**Regla:** un guard que lee fuente afirma **lo que el código HACE** —las columnas declaradas, las
rutas que se llaman— y no si alguien escribió una palabra. El de las rutas quedó enumerando lo que
pasa por `traer()` y comparándolo contra `RUTAS_PERMITIDAS`; el de la migración, con un stripper de
`--`. Es la misma clase de error que «una verificación equivocada sale más cara que no verificar»:
los dos marcaban de más, y los dos mandaban a arreglar algo que estaba bien.

### El número de la próxima migración NO se lee del relevo: está 51 números atrasado

`docs/relevo/nube.md` dice «la próxima libre es la **0306**» y en disco el número más alto es el
**0357** (348 archivos). Y hay huecos —0304, 0315, 0329, 0344, 0345, 0346, 0351, 0355— que **no se
rellenan**: el repo ya tiene colisiones históricas (0024, 0025, 0039, 0060, 0061, 0069 duplicados) y
sumar otra cuesta más que saltearse un número.

**Regla:** el número sale de listar el directorio y mirar el más alto, nunca de un documento. Un
documento con un número adentro envejece el día que alguien más pushea.

### Ampliar un juego de campos de la Graph API no es aditivo: UN campo desconocido tira la consulta ENTERA

El plan pedía «ampliar `CAMPOS_PERFIL`» con siete campos (`like_count`, `view_count`, …). Hacerlo
literalmente **apuesta la lectura de @ que ya está en producción** (Offer y el alta de un lead) a que
los siete existen en la versión de Graph de cada cliente: en la Graph API, un campo que Meta no
reconoce devuelve un **400 para toda la consulta** («Tried accessing nonexisting field»), no una
respuesta sin ese campo.

Y **no se puede medir desde la nube**: Business Discovery no tiene credencial desde el 22/10 (el
token de la plataforma no tiene ningún permiso de Instagram), pero **1 de las 11 conexiones de
clientes —la de ws11— sí la tiene y hoy le funciona**. O sea que el riesgo no es teórico y la
comprobación no está disponible.

**Lo que se hizo, y la regla:** el juego ancho quedó en una constante aparte
(`CAMPOS_PERFIL_PIEZAS`), y quien la pide se banca el fallo —`leerPerfilInstagram({ conPiezas: true })`
reintenta UNA vez con el juego de siempre si Meta rechaza un campo—, así que la ficha degrada a «sin
números» en vez de quedarse sin perfil. **Un juego de campos que ya está en producción crece detrás
de un fallback, no en el lugar.** El día que alguien lo confirme con una credencial de verdad, las
dos constantes se pueden unir, y ese día se anota acá.

⚠️ Y `conPiezas` **entra en la clave de la caché** de `leerPerfilInstagram`. Sin eso, una lectura
angosta de hace un rato le contesta a la tab sin los números, y la ficha diría «no publica sus me
gusta» sobre una cuenta que sí los publica: un dato inventado por una caché.

### «No pude leer la landing» ya está resuelto en casa, y el campo que lo dice no es la lista vacía

`mirarLanding` (lib/landing-vigilancia.ts) devuelve `analisis.ok` y `analisis.error`. El código obvio
—«si hay piezas las guardo, si no digo que no tiene nada»— escribe **«esta landing no tiene nada»
sobre una página que no se pudo leer**, y la vuelta siguiente la línea de tiempo dice que el
competidor le sacó el video y el formulario. Y hay un detalle que lo hace más fácil de pisar:
**`AnalisisLanding.piezas` es un `Set`, no un array**, así que `.length` es `undefined` —falsy, sin
error— y el ternario se cae del lado equivocado solo.

**Regla:** antes de guardar lo que devolvió una lectura se pregunta si la lectura SALIÓ BIEN, y eso se
lee del campo que lo dice, no de que la lista venga vacía.

### `visto_primera_vez` hay que EXCLUIRLO de la mitad que actualiza el upsert

Es el único dato de la tab que no se puede conseguir mirando a mano, y un upsert de una sola pasada
lo reescribe en cada vuelta: todas las piezas quedan «vistas por primera vez: hoy» y la tab pierde su
razón de existir, sin dar ningún error. Por eso `guardarVistas` (lib/spy.ts) **parte el upsert en
dos**: las piezas que ya estaban se actualizan sin tocar esa columna, y las nuevas se insertan con
ella.

### Lo que gasta el presupuesto de 12.000 caracteres son las PALABRAS del área, no la cantidad de operaciones

Medido el 31/10 con `tests/ops-center-clasificador-app.test.ts`: el peor turno pesa **15.325 de
15.500** caracteres (margen **175**), y es «mandá un mail a todos mis leads con la promo». Sumar un
área **entera de seis operaciones no movió ese número ni un carácter**.

El motivo: el registro se corta en 12.000 ordenando por puntaje contra el pedido, así que una
operación nueva **le saca el lugar a otra** en vez de sumar; lo que sí suma son las lecturas del área
que el clasificador ANCLA al turno. Y eso lo decide `AREA_KEYWORDS` (lib/mako-intencion.ts), no el
tamaño del área: una palabra como `anuncio` o `campaña` ahí habría metido las seis operaciones del
spy en los turnos más pesados del repo y habría roto ese test.

**Regla:** al declarar un área nueva, lo que hay que escribir corto no es la lista de operaciones —es
el regex de `AREA_KEYWORDS`, y con palabras que no signifiquen otra cosa en MaKo.

### Dos cosas que hay que tocar para que una tab deje de ser «Coming soon», y el compilador no ve ninguna

1. **`lib/capas.ts`.** `navEnCapa` es fail-OPEN para las capas con `navKeys: null`, pero dos capas
   tienen lista explícita, y la del **super admin es una de ellas**. Una tab que no esté en esa lista
   **redirige** — o sea que el síntoma es que el super admin no puede entrar a la tab que acaba de
   construir, en su propio workspace, que es desde donde Martín la abre. (El comentario de
   `lib/capas.ts:295` ya registra este mismo bug pasando antes.)
2. **`lib/movil-rutas.ts`.** La ruta del teléfono de una tab «Coming soon» **se DERIVA de la marca
   `comingSoon`**: `rutaMovil` cae a `/m/pronto/<key>`. Al sacar la marca, la tab **pierde su pantalla
   de teléfono en la misma edición**, y `tests/movil-toda-tab.test.ts` exige entonces una decisión
   escrita: su pantalla, `SOLO_ESCRITORIO` con el motivo, o `EN_CAMINO` con quién la escribe. Graduar
   una tab y mandarla al teléfono son el mismo commit, o una decisión explícita.

### Un deep link a otra tab se escribe LEYENDO su contrato, no de memoria

El botón «Replicar su sitio» de la ficha salió apuntando a `/web-generator?replicar=<url>`, que es lo
que uno escribe de memoria porque la función se llama así. El Web Generator entiende
**`?analizar=<url>`** (`derechaDeQuery`, `app/web-generator/panel-reglas.ts`), y `replicar` es un
valor de **otro** parámetro (`?vista=plantillas|temas|papelera|replicar`).

Con el parámetro inventado la query **se ignora en silencio**: la pantalla abre en su vista por
omisión y el botón parece andar. No hay error, no hay 404, y nadie lo nota hasta que alguien dice
«le di a replicar y no pasó nada». Es la versión barata de «una ruta que apunta a la nada no rompe
nada, y por eso es cara».

**Regla:** antes de escribir un link a otra tab, leer qué parámetros acepta su página. Los nombres de
las funciones y los de la query no son el mismo vocabulario.

### El plan de esta tab no está en `main`

El commit del plan (`b4d7726d1`) y los dos documentos viven en `origin/integracion` y en
`origin/nube/diseno-competitors-spy`, **no en `origin/main`**. Una sesión que clone y se pare en
`main` no encuentra `docs/hallazgos-competitors-spy.md` ni `docs/diseno-competitors-spy.md` y
concluye que la investigación no existe. Se trabaja desde `integracion`.

### Cuatro rojos que el informe de la Etapa 1 no nombró, y dos frases que prometían de más (31/10, al integrar)

Salir de `ComingSoon` no sólo toca la nav y las capas (la sección de arriba): la key entra en **tres listas
más**. `lib/funciones-mako.ts` (toda key viva es de una función) y `tests/guia-catalogo.test.ts`
(`SIN_GUIA_TODAVIA`) dan rojo recién en la batería completa; `app/admin/dev/areas.ts` no da rojo, pero seguía
diciendo «Hoy es ComingSoon». Los otros dos rojos: `tests/integracion-sin-salir` (el onboarding mandaba a
`/integraciones`: la regla de Martín es no salir nunca de la tab) y `tests/offer-instagram`, que fijaba el
texto de la consulta de Business Discovery que Spy parametrizó.

Y el onboarding prometía dos cosas que no son. **«YouTube pide una clave de su API»:** desde el 27/10 no se
pide (`lib/metodo-catalogo.ts`; `claveDeYoutube` cae en la de la plataforma). **«Desde hoy guarda una foto por
día»:** el cron es la Etapa 2 y no existe; la historia avanza sólo con «Revisar ahora». Cuando entre el cron,
esa frase puede volver.

**Regla:** al sacar una tab de `ComingSoon`, correr `tests/funciones-mako`, `tests/guia-catalogo` y
`tests/integracion-sin-salir` antes de entregar. Y `'market-an'` queda en `SIN_GUIA_TODAVIA`: esa lista sólo
se achica, pero esta tab nació sin guía y la escribe su tanda.

---

## Lo que quedó SIN hacer

Actualizado el **31/10/2026**, al entregar la **Etapa 1** (etiqueta `nube/competitors-spy-3110`): la
lista, la ficha por bloques, el onboarding, el área `spy` de la API de MaKo, y la lectura de verdad
de Instagram, YouTube y la landing del competidor. Lo que sigue abierto:

- **Los dos trámites de la Etapa 0, que bloquean y tardan días. Son de Martín o del Cerebro.**
  1. **Aceptar la enmienda III.L de YouTube** («Section 5: Use Cases → Analytics & Reporting», en el
     pedido de ampliación de cuota). Hasta que esté, el VPH y el outlier **devuelven `null` por
     código**: el interruptor es `ENMIENDA_III_L` en `lib/spy-reglas.ts`, y la pantalla dice que falta
     un trámite en vez de mostrar un cero. **Vive en:** `lib/spy-reglas.ts` (`ENMIENDA_III_L`,
     `vistasPorHora`, `multiploDelCanal`). Al aceptarla se cambia a `true`, se anota la fecha acá, y
     recién entonces la retención de métricas pasa de 30 días a 36 meses.
  2. **Conseguir que Business Discovery ande:** vincular un Instagram profesional a la página de la
     plataforma y pedir `instagram_basic` para el token de ws9 (medido el 22/10: hoy no hay ninguno;
     de 11 conexiones de clientes, sólo ws11 tiene permisos de Instagram). Sin esto el bloque de
     Instagram dice que la conexión no entrega los números, y los demás bloques funcionan igual.
- **Aplicar la migración `0359_competitors_spy.sql`.** La nube no tiene `.env.local` ni acceso a la
  base: la migración está escrita y **sin aplicar**. El código la tolera ausente (`lib/spy.ts`
  detecta el `42P01` de Postgres y la pantalla dice que la tab todavía no está lista). La aplica una
  sesión local con `node scripts/apply-migration.mjs supabase/migrations/0359_competitors_spy.sql`.
- **El cron de snapshots (la Etapa 2, y es la que justifica la tab).** Hoy la historia sólo avanza
  cuando alguien aprieta «Revisar ahora»: `visto_primera_vez` ya se guarda bien, pero sin una pasada
  diaria la línea de tiempo tiene agujeros. Falta `app/api/cron/spy-snapshots/route.ts` con
  `correrRonda` (`lib/cron-workspaces.ts`), escalonado desde el día uno —competidores calientes
  diario, fríos semanal— porque la cuota de YouTube no aguanta todo diario (≈8.080 de 10.000 unidades
  con 4.000 canales; a 5.000 revienta). **No se escribió a propósito:** el cron tiene que declararse
  en `vercel.json` (`{ "path": "/api/cron/spy-snapshots", "schedule": "<UTC>" }`, lo exige
  `tests/cron-registrado.test.ts`) y **la regla del repo prohíbe tocar `vercel.json` desde un
  worktree** — lo agrega quien integra. Entra entero en el commit que lo registre.
- **La pantalla del teléfono.** `market-an` quedó anotada en `EN_CAMINO` (`lib/movil-rutas.ts`): en
  More se ve como «En la computadora». El diseño ya está decidido en
  [diseno-competitors-spy.md](diseno-competitors-spy.md) §8 — un bloque por pantalla, plegados; la
  galería a una columna; los filtros en una hoja que sube desde abajo— y lo que **no** va al teléfono
  se dice en vez de desaparecer: replicar el sitio (es el editor) y el recorrido con la extensión (es
  Chrome de escritorio). **Vive en:** `lib/movil-rutas.ts` (`EN_CAMINO`, `SECCIONES_MAS`, `rutaMovil`)
  y la página nueva `app/m/competitor-spy/page.tsx`, que va en el MISMO deploy que su fila.
- **La galería de anuncios de `athm793/meta-ads-scraper`** (Apache-2.0): `AdGrid`, `AdModal`,
  `FiltersPanel` y el clasificador de `hooks.ts`. Hoy los anuncios se ven como una lista en el bloque
  de la ficha; la galería con riel de filtros es lo que se copia cuando haya volumen de anuncios que
  justifique una pantalla propia. **Su scraper de Playwright no se copia nunca** (§4.1 del plan).
- **La galería pública de plantillas y las tendencias del nicho (Etapa 5).** No existe, y con ella
  entra la regla de Martín del 29/10: **ni cara, ni nombre, ni @ de un gurú real; arquetipos de
  estilo**. Hoy sólo existe la ficha PRIVADA, donde el @ del competidor que ese negocio eligió sí se
  ve — la distinción está escrita en `lib/spy-reglas.ts`. Las tendencias son un subproducto de la
  historia acumulada por el cron, así que van después de la Etapa 2.
- **Dos decisiones de Martín, en [diseno-competitors-spy.md](diseno-competitors-spy.md) §9:** si los
  anuncios de Meta van por el recorrido a la vista con la extensión (riesgo de ToS, el mismo que ya
  aceptó para WhatsApp, pero esta vez el dato se le muestra a un cliente que paga, que es justo lo que
  nombra la cláusula 4), y si Apify se usa para los perfiles de Instagram de competidores. **Mientras
  no decida, la tab funciona:** los anuncios entran por la vía que no tiene problema de términos —los
  pega la persona— y eso ya está construido (`guardarAnuncioPegado`, `lib/spy.ts`).
- **Unir `CAMPOS_PERFIL_PIEZAS` con `CAMPOS_PERFIL`** el día que alguien confirme el juego ancho con
  una credencial de verdad. Hoy son dos constantes y un reintento, por el 400 que tira toda la
  consulta (ver arriba). **Vive en:** `lib/instagram-perfil.ts`, `lib/instagram-perfil-server.ts`.
- **El `?? 0` que quedó en el video estudio**, que no es de esta tab pero pone en rojo un guard
  compartido: `lib/api-mako/areas/video-estudio.run.ts:528` devuelve un `No pude…` sin `falla: true`,
  así que `tests/guarda-por-defecto.test.ts` está rojo desde el 27/10 (commit `9012f6070`) y ese «no
  pude» de MaKo **no abre ticket solo**. Es una línea; se dejó para el chat del video, que es el dueño
  del archivo.
- **Sin verificar**, para que nadie lo tome como medido: si `playlistItems` tiene tope de paginación por
  playlist; si `videos.list?id=` acepta más de 50 ids (la doc no declara un máximo, 50 es el batch de
  facto de las client libraries); si la **Unified Login** de Instagram soporta `business_discovery` (el
  overview no lo lista y la referencia sigue diciendo Facebook Login — si lo soporta, se ahorra el
  requisito de la Página de Facebook); si `paidProductPlacementDetails` es público para videos ajenos
  (no figura entre las partes restringidas al dueño; si lo es, detecta qué videos del competidor
  declaran promoción paga); y **si los siete campos de `CAMPOS_PERFIL_PIEZAS` existen de verdad en
  Business Discovery** — están documentados, pero sin credencial no se probó ni uno.
