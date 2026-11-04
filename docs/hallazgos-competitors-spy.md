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

### Seis rojos que la compuerta habría elegido, y dos frases que prometían de más (31/10, al integrar)

**El diagnóstico obvio era el equivocado: no los trajo la mezcla.** Aparecieron al integrar y la primera lectura
fue «un verde de la rama no vale en el tren». Pero las causas ya estaban en `bb93f81f2`, la punta entregada, y los
seis tests los elegía `scripts/tests-afectados.mjs` sobre esa misma punta (medido: 830 elegidos con 32 archivos
cambiados). La regla y la trampa de esa medición están en [hallazgos-infra.md](hallazgos-infra.md). De los 11 rojos
de la mezcla con Knowledge, 6 eran de Spy, 3 de Knowledge ([hallazgos-conocimiento.md](hallazgos-conocimiento.md))
y 2 del propio arreglo de la integración: `tests/doer-falla` fija como texto la llamada que se había cambiado.

El sexto es `tests/api-mako-cobros`: `spy` tenía que ir antes de `cobros` en las áreas de la API
([hallazgos-api-mako.md](hallazgos-api-mako.md)). Y hubo uno más que **sólo aparece después de arreglar otro**:
al darle a `market-an` su entrada en el catálogo, `tests/funciones-mako` (test 6) pide sumar Competitor Spy a la
lista de lo que sólo ve el super admin. Tapado por el primero, no estaba entre los 11.

Salir de `ComingSoon` no sólo toca la nav y las capas (la sección de arriba): la key entra en **tres listas
más**. `lib/funciones-mako.ts` (toda key viva es de una función) y `tests/guia-catalogo.test.ts`
(`SIN_GUIA_TODAVIA`) dan rojo recién en la batería completa; `app/admin/dev/areas.ts` no da rojo, pero seguía
diciendo «Hoy es ComingSoon». Los otros dos rojos: `tests/integracion-sin-salir` (el onboarding mandaba a
`/integraciones`: la regla de Martín es no salir nunca de la tab) y `tests/offer-instagram`, que fijaba el
texto de la consulta de Business Discovery que Spy parametrizó. Y `tests/sin-instagram`: ningún paso de un
onboarding puede nombrar a Instagram, porque esa tab se retiró. El paso se llama «Conectar Meta», que además es
lo que abre: el modal de Meta. Instagram sigue explicado en el texto de adentro.

Y el onboarding prometía dos cosas que no son. **«YouTube pide una clave de su API»:** desde el 27/10 no se
pide (`lib/metodo-catalogo.ts`; `claveDeYoutube` cae en la de la plataforma). **«Desde hoy guarda una foto por
día»:** el cron es la Etapa 2 y no existe; la historia avanza sólo con «Revisar ahora». Cuando entre el cron,
esa frase puede volver.

**Regla:** al sacar una tab de `ComingSoon`, correr `tests/funciones-mako`, `tests/guia-catalogo` y
`tests/integracion-sin-salir` y `tests/sin-instagram` antes de entregar. Y `'market-an'` queda en `SIN_GUIA_TODAVIA`: esa lista sólo
se achica, pero esta tab nació sin guía y la escribe su tanda.

---

### La pantalla era la ausencia de datos, y el diagnóstico obvio («falta el cron») era el equivocado (31/10, Martín la abrió)

**Síntoma.** Martín abrió la tab en producción: «Que carajos es este diseño, ve y hazlo todo de nuevo... Copia de una app». Una tarjeta «Sin revisar» y cuatro acordeones diciendo que no había nada, detrás de un wizard que él ya había pedido no poner.

**La causa no era falta de datos.** Yo mismo había escrito en esta tab que «no revisa sola» como lo que le faltaba. Falso: `mirarCompetidor` ya leía todo en una pasada, y las fechas con las que se arma el tiempo las declara LA FUENTE (`timestamp` de Instagram, `publishedAt` de YouTube), así que llegan en la primera lectura. Lo que faltaba era llamarla al agregar. Se había copiado **nuestra** ficha del CRM en vez de una app de la categoría, y se dio el límite legal sobre el DATO por permiso para diseñar la pantalla de cero: son dos preguntas distintas.

**Y el cron tampoco da lo que parece.** «Desde cuándo corre este anuncio» no lo trae una foto diaria en América Latina: la Ad Library devuelve vacío con HTTP 200 y los anuncios entran pegados a mano, sin nada que volver a leer. El cron sólo sumaría deltas y «dejó de verse» entre visitas de Instagram, YouTube y la landing. Por eso no se dibuja nada que pida dos mediciones.

**De dónde salió lo nuevo**, midiendo once productos con el navegador: ninguno tiene lista a la izquierda con detalle a la derecha, ninguno secciona por canal con acordeones, ninguno tapa la pantalla con un wizard. Foreplay Spyder da la estructura (de sus capturas: no se entró a la app viva), Meta y Google el buscador fijo y el vacío único, Atria y TikTok la tarjeta, Semrush la sección que se borra. El detalle de cada pieza está en los comentarios de `app/competitor-spy/SpyApp.tsx` y `TarjetaPieza.tsx`.

**Reglas que quedan para cualquier ranura sin dato** (valen para toda la app):
- **Cargando y vacío son dos estados.** TikTok afirma «No search results found» un segundo antes de mostrar sus tarjetas; nuestra pantalla hacía eso para siempre. `estadoDeResultados` (`lib/spy-vista.ts`) lo decide y se puede probar.
- **El motivo de una lectura no se guarda en ningún lado**, y por eso sin la lectura en la mano no se afirma nada: se vuelve a leer al abrir (`debeLeerAlAbrir`, una vez por sesión, para no gastar cuota en bucle con un perfil ilegible).
- **Instagram contesta `ok` con cero piezas cuando la conexión no entrega números.** Eso no es «no publica nada»: `esLecturaRecortada` lo manda a «no pude», con «Conectar Meta» ahí mismo. Es el estado más frecuente: de 11 conexiones, sólo una tiene permisos.
- **El control apagado de Meta**: su filtro de idioma se ve deshabilitado y dice adentro por qué. Un canal sin cargar es un chip que dice «Agregar», no una caja vacía.
- **El cero se imprime cuando es un hecho contado y se saca cuando no se midió** (Meta, Google, SimilarWeb). Y un `null` tampoco es siempre «no lo publica»: si lo tachó la poda de los 30 días, decirlo le atribuye algo al dueño de la cuenta (`contadorDeTarjeta` dice «Sin leer»).
- **Un dominio derivado de un texto de YouTube se calcula al dibujar y no se guarda**: el texto vive 30 días, y una columna sobreviviría a su fuente.

**El mensaje del tope mandaba a hacer algo imposible.** «Quita uno antes de agregar otro» no tenía cómo hacerse hasta esta vuelta: no existía quitar, ni en la pantalla ni en la API. Ahora están «Dejar de mirarlo» y `dejar_de_mirar`.

## Lo que quedó SIN hacer

Actualizado el **31/10/2026**, al rehacer la pantalla: la lista, la ficha por bloques y el onboarding de
la Etapa 1 ya no existen. La 0359 **está aplicada** (la aplicó el Cerebro y la verificó contra el
catálogo), así que el punto de abajo que dice lo contrario es viejo. Lo que sigue abierto:

- **Lo que el relevamiento mostró y esta vuelta no hizo.** Vive en `app/competitor-spy/SpyApp.tsx`:
  la pantalla del teléfono (`app/m/competitor-spy/page.tsx`, y `market-an` sigue en `EN_CAMINO` de
  `lib/movil-rutas.ts`; el mismo componente ya se adapta a 375 px); el chip de país de la barra (nadie
  escribe `pais` todavía); «Seguir a este» desde una pieza; la captura de su sitio; la ilustración
  propia del vacío; el avatar real y la miniatura de Instagram, que vencen y no tienen columna a propósito.

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

## La animación de «Sort my footage» era un video, no un componente (1/11/2026)

**Pedido** (Martín): copiar de yanny.space/studio la animación de «Sort my footage» a Competitors Spy.

- ⚠️ **En esa página no hay ninguna animación que leer: es un MP4 de 13 s** (`assets/sort/sort.mp4`). No hay código ni valores: se miró cuadro por cuadro,
  cada 2 segundos, y se reconstruyó. Las miniaturas entran desde afuera y forman una bola, aparecen las carpetas, cada una vuela a la suya y sube la
  cuenta, y el cierre es todo desenfocado con la frase escrita encima.
- **Lo que no se copió: los números de mentira.** Ahí son 1.065 archivos de un demo. Acá son las piezas que se acaban de leer, y sin piezas no se monta.
  Las carpetas salen de lo que Spy sabe de una pieza: canal, formato y etapa.
- **Se dispara en una lectura pedida o en la primera de una ficha vacía.** La relectura sola de una ficha que ya tiene piezas va callada: si no, entrar a mirar
  costaba seis segundos de animación. «Saltar» la corta, y con «reducir movimiento» no corre.
- **140 miniaturas como tope de dibujo:** con más, una computadora normal se traba. El número que se lee sigue siendo el real (`repartirMiniaturas`).

**Sin hacer:** las de Instagram no tienen imagen: la del CDN de Meta vence y no se guarda (0359), así que su miniatura es su texto. Para tener la foto en
la animación habría que pasar la URL viva desde la lectura sin guardarla. Y no se probó con una lectura real: el arnés usa datos falsos.

**Vive en:** lib/spy-orden.ts · app/competitor-spy/OrdenSpy.tsx · tests/spy-orden.test.ts.

## Apify para leer Instagram: una clave nueva, no la vuelta del scraper (1/11/2026)

**Pedido** (Martín): conectar Apify para que Spy lea Instagram.

- ⚠️ **Lo que se retiró el 25/10 fue el Leads Scraper, no «Apify».** Por eso es otra clave (`APIFY_INSTAGRAM_TOKEN`) y otra fuente (`apify-spy`), que sólo pide lib/spy.ts. Reusar `APIFY_TOKEN` habría despertado también el buscador del alta del CRM y Offer, que preguntan mientras se escribe y lo pagaría quien pegó la clave. `tests/leads-scraper-retirado.test.ts` sigue prohibiendo el scraper y ahora fija este límite.
- ⚠️ **Spy leía Instagram sin decir de qué negocio era** (`leerPerfilInstagram` sin `ws`): nunca usó la Meta del cliente, siempre la de la plataforma. Por eso el error decía «la página no tiene un Instagram vinculado» aunque el cliente tuviera el suyo.
- ⚠️ **Un fallo se cachea 10 minutos.** Sin meter en la clave si hay clave de Spy, pegarla y tocar «Revisar ahora» seguía diciendo «no pude».
- **El actor manda `likesCount: -1` con los «me gusta» ocultos.** Es «no se sabe», nunca un número.
- ⚠️ **Dos permisos (docs/funnel-coach.md §5):** Apify lee perfiles públicos sin pasar por la API de Meta, lo que va contra los términos de Instagram. Lo decidió Martín, corre con la clave de cada negocio y con tope de 40 por día; la vía oficial sigue primero. La memoria del 29/10 («fuentes sólo legales, nada de scraping masivo») no cambió para el resto.

**Sin probar contra Apify de verdad:** no hay clave todavía. La forma de `latestPosts` está tomada del código del 22/10 y de la documentación del actor.

**Vive en:** lib/instagram-perfil-server.ts · lib/instagram-perfil.ts · lib/spy.ts · lib/metodo-catalogo.ts (`apify-instagram`).

---

## El diagnóstico obvio era el equivocado: «copiar una referencia» no es «mejorar lo que hay» (1/11/2026)

**El síntoma.** Martín pidió cuatro veces lo mismo —«rediseñá toda la tab siguiendo una
referencia»— y cuatro veces recibió otra cosa. Las tres primeras vueltas **sí tocaron la tab**: una
reordenó las filas (7 → 5), otra cambió los radios, los tamaños y la sombra por los tokens medidos.
Las dos se midieron, las dos dieron números mejores (462 px → 229 px hasta la primera pieza) y las
dos se rechazaron en el acto: «se ve horrible otra vez», «es la cuarta vez que te lo pido».

**La causa, y es de método.** Las tres vueltas empezaron abriendo `SpyApp.tsx`. Partiendo de la
pantalla propia, lo único que se puede hacer es cambiarle la superficie: mover cajas y reemplazar
valores. El esqueleto —qué hay, en qué orden, en qué columnas— sobrevive intacto, porque nunca se
puso en duda. Y el esqueleto es justamente lo que se ve.

**La regla que queda:** *copiar una referencia es empezar por la referencia.* Abrirla en el
navegador, medirle el árbol y las reglas, escribir el esqueleto, y recién entonces preguntarse qué
de lo nuestro entra ahí. **Si el primer archivo que abriste es el tuyo, no estás copiando: estás
mejorando, que es lo que te pidieron no hacer.** Medir el resultado no lo arregla — las dos vueltas
malas tenían mejores números que la pantalla original.

**El corolario que ahorra tiempo:** la referencia no se elige por el rubro, se elige por la FORMA.
Spy es «un catálogo que se filtra», así que la referencia útil no fue ningún producto de espionaje
de anuncios: fue **una tienda de ropa** (`fitlo /shop`), que tiene exactamente esa forma. Y como el
análisis no entra en un catálogo, el riel salió de otra plantilla (`merrin`). Dos referencias, una
por pieza, en vez de forzar una sola.

**Qué cambió de esqueleto** (medidas y reglas en `docs/diseno/referencia-spy.md`):

- El análisis dejó de ser una banda plegada **arriba** de las piezas y pasó a un **riel de 336 px a
  la derecha**. Por eso ahora puede estar siempre abierto: dejó de competir con el catálogo. La
  banda arrancaba plegada justamente porque competía — el síntoma estaba visible y se trató como un
  problema de altura.
- Las seis píldoras grises de la identidad se fueron: los números son **celdas pastel de datos** en
  el riel y la frescura es una línea gris debajo del título.
- La tarjeta **no tiene borde, tiene un tinte**, y el tinte dice de qué canal es la pieza. Con eso
  desaparece la fila «ícono + nombre del canal» que llevaba arriba de cada tarjeta.

**Vive en:** app/competitor-spy/SpyApp.tsx · app/competitor-spy/TarjetaPieza.tsx ·
docs/diseno/referencia-spy.md

---

## Un guard que busca un identificador encuentra la declaración, no el uso (2/11/2026)

**Pasó dos veces en una hora**, con dos guards distintos, y las dos veces el test pasó en VERDE
sobre código que yo acababa de romper a propósito:

1. `tests/spy-youtube-largos.test.ts` comprobaba que existiera `PAGINAS_MAX`. Con
   `PAGINAS_MAX = 1` —que es exactamente el bug que el guard existe para frenar— pasó en verde.
2. `tests/spy-alta-duplicados.test.ts` comprobaba que apareciera `nombreComparable(`. Con la
   comparación cambiada a `x.nombre === nombre` pasó en verde, porque la función seguía
   existiendo una línea más arriba, en `const buscado = nombreComparable(nombre)`.

**La regla:** un guard que mira el código **no busca un identificador, busca la FORMA DEL USO**.
`/PAGINAS_MAX/` no sirve; `/const PAGINAS_MAX = (\d+);/` y después `Number(...) > 1` sí.
`/nombreComparable\(/` no sirve; `/nombreComparable\(x\.nombre\)\s*===/` sí.

**Y el corolario, que es el que hace que se note:** un guard nuevo **se prueba rompiendo lo que
vigila**, antes de confiar en él. Los dos de arriba se escribieron, dieron verde, y recién al
romper el código a propósito se vio que no servían. Un guard que no se pone rojo cuando la cosa
está rota es peor que no tener guard: da permiso para seguir.

**Vive en:** tests/spy-youtube-largos.test.ts · tests/spy-alta-duplicados.test.ts

---

## Una caché no la rompe la caché: la rompe lo que le pasa quien la llama (2/11/2026)

Dos bugs seguidos la misma noche, los dos en código que acababa de escribir y los dos invisibles
desde adentro de la función.

**El primero.** `guardarMiniaturas` baja imágenes y las sube a nuestro bucket. Corre ADENTRO de
`guardarVistas`, que corre adentro de la acción que dispara el usuario con «Revisar ahora». Con 50
piezas, de a 6 y hasta 8 s cada una, el peor caso eran **72 segundos sólo de imágenes**, y Spy no
declara `maxDuration`: la lectura entera —la que trae los datos— se habría caído por culpa de las
fotos. **Lo que hace lento a algo no es su propio código, es dónde está enchufado.**

**El segundo, y es el que enseña más.** Con el presupuesto puesto, la función era correcta y aun
así no servía: `esNuestra(v.miniatura)` daba `false` para TODAS, siempre. Porque lo que le llega de
la API es **la URL fresca del CDN**, nunca la nuestra — la nuestra está en la base, y la función
nunca la veía. Resultado: el presupuesto se gastaba cada vez en las PRIMERAS imágenes y nunca
llegaba a las que faltaban. Se podía tocar «Revisar ahora» diez veces y las últimas treinta
miniaturas no se bajaban jamás. La función estaba bien; **el dato que le pasaban estaba mal**.

**La regla que queda:** cuando agregues una caché o un «si ya lo tengo, no lo hago», **mirá qué le
pasa quien la llama, no sólo cómo está escrita por dentro**. Si la clave con la que decide viene de
afuera y se regenera en cada vuelta, la caché nunca acierta y no se nota: no falla, sólo no sirve.
Y la segunda: **medí el peor caso en TIEMPO de lo que agregaste, y comparalo con el tope de donde
corre.** 50 × 8 s no es «un poco más lento», es otra cosa.

**Cómo se ven, porque ninguna de las dos da error:** la primera, un «Revisar ahora» que se cae con
muchas piezas y anda con pocas. La segunda, algo que converge para los primeros elementos y nunca
para los últimos. Las dos pasan todos los tests que no midan el tiempo ni cuenten las llamadas.

**Vive en:** lib/spy-miniaturas.ts (`PRESUPUESTO_MS`) · lib/spy.ts (`yaBajada`) ·
tests/spy-miniaturas.test.ts

## El dato más barato es el que ya pagaste y estás tirando (2/11/2026)

**El pedido:** Martín, ítem 10 — «con un dato, traer todas sus redes», más la landing o el funnel que
tenga en la bio. Yo lo tenía anotado como trabado: hace falta un actor de BÚSQUEDA de Apify, que es
otro costo y otra decisión suya.

**Era trabado a medias.** La vista previa del alta ya lee el perfil con Apify y devuelve `web`, el
link de la bio. La pantalla incluso lo MUESTRA («Su sitio: acme.com»). Y al confirmar,
`agregarCompetidor` guardaba sólo el canal que se pegó: **`lib/spy.ts` no mencionaba `perfil.web` en
ninguna línea.** O sea que el dato llegaba, se dibujaba y se tiraba.

**La regla que queda, y es la que vale más que el arreglo:** antes de declarar trabado un pedido de
«traer más datos», mirá qué datos YA te devuelve la llamada que estás haciendo. Una lectura de perfil
trae nombre, foto, seguidores, bio y el link de la bio; si la pantalla muestra un campo que la base
no guarda, ahí hay una mitad gratis. **Lo que se ve y lo que se guarda son dos cosas distintas** —es
el mismo hallazgo que las miniaturas de YouTube, que se dibujaban desde una URL ajena y no estaban
archivadas en ningún lado.

⚠️ **El link viaja desde la PANTALLA, no se vuelve a leer en el servidor.** Releer el perfil dentro
de `agregarCompetidor` habría sido pagar dos veces el mismo dato y gastar del tope diario
(`APIFY_TOPE_POR_DIA`), que es exactamente lo que deja al negocio sin poder agregar a nadie el resto
del día.

⚠️ **Y SE CLASIFICA CON `queEs`, no con una expresión nueva.** Tres casos que una regex propia habría
dejado pasar: una bio que enlaza a otra cuenta de Instagram (guardaría instagram.com como su «página
de venta»), una bio con texto en vez de link, y una bio que repite el canal que ya se pegó. `queEs`
los distingue solo, y además ya tiene el tope de 500 caracteres y el `https://` para un dominio
pelado.

⚠️ **La decisión vive en `lib/spy-reglas.ts` y no en `lib/spy.ts` por una razón concreta:** `spy.ts`
importa `server-only` y ningún test puede importarlo. Una regla metida ahí sólo se puede cuidar
emparejando el archivo como texto, que es cómo dos guards de esta semana pasaron en verde sobre
código roto.

### Y una trampa del test, que es el hallazgo de método

El primer test rechazaba la bio de Instagram con `canalDeLaBio(otraIg, 'instagram')`. **Sacarle la
lista blanca de campos al código dejaba el test en 7 / 0**: el descarte del «mismo campo» devolvía
`null` igual y tapaba el agujero. El caso que vale es con OTRO canal pegado —
`canalDeLaBio(otraIg, 'youtube_id')`— porque ahí la lista blanca es lo ÚNICO que impide guardar
instagram.com como landing.

**La regla:** un test que prueba un rechazo tiene que elegir el caso donde **esa** regla es la única
que puede rechazar. Si otra guarda del mismo camino devuelve lo mismo, el test pasa con el código
roto y no te enterás. Probarlo rompiéndolo es lo que lo mostró.

**Vive en:** lib/spy-reglas.ts (`canalDeLaBio`) · lib/spy.ts (`agregarCompetidor`, `queEs`) ·
app/competitor-spy/SpyApp.tsx (`ModalAlta` → `onPegar`) · app/competitor-spy/actions.ts ·
tests/spy-canal-de-la-bio.test.ts

## Sus otras redes por búsqueda: el costo medido apurado sale 100 veces más bajo (3/11/2026)

**Síntoma:** al medir el actor de búsqueda (`apify~google-search-scraper`) la corrida decía
**US$0,00005**. Parecía gratis.
**Causa real:** es un actor PAY_PER_EVENT y el evento de la página («search-page-scraped»,
US$0,0045) se asienta DESPUÉS de que la corrida termina. Leído a los 4 s sólo figuraba el
arranque. Asentado: **US$0,00455 por búsqueda**. `scripts/probar-otras-redes-apify.mjs` espera 15 s
y suma evento por precio; **`usageTotalUsd` solo no es lo que se paga** en un actor por eventos.

**Otras trampas del mismo actor, medidas:**
- **Exige `maxTotalChargeUsd` ≥ US$0,50** (con 0,02, como los de Instagram, contesta 400
  `max-total-charge-usd-below-minimum`). Es un techo, no un cobro: `TECHO_USD_POR_CORRIDA_REDES`.
- **Buscar por nombre trae a otras personas, y se vio en la primera prueba:** «Sofia Contreras»
  devolvió CINCO Instagram distintos. Por eso la búsqueda devuelve candidatos y **no escribe**
  (`lib/spy-otras-redes.ts` no importa la base; un test lo vigila) y sólo el «Sí, es esta persona»
  guarda, por el mismo camino que pegarlo a mano.
- **El `/c/<alias>` de YouTube es su canal pero no se ofrece:** ningún endpoint lo resuelve, y
  convertirlo en `@alias` es adivinar — un `@` adivinado puede ser el canal de otro.

**Lo que estaba roto sin que nadie lo viera:** un link a su **TikTok en la bio se guardaba como su
LANDING** — `queEs` clasificaba tiktok.com como un sitio cualquiera. Ahora TikTok es un campo
(migración 0365) y `queEs` lo reconoce con la misma `redDeUrl` que lee los resultados.

**Regla:** de una red que el competidor YA tiene no se ofrece nada. El que está lo eligió el
negocio; los demás con su nombre son otra gente.

## El modal de Spy: copiar es elegir la pieza por lo que HACE (3/11/2026)

**Síntoma:** Martín, 3/11 — «No se mejoró ni el modal, sigue horrible el diseño... Y no tiene sentido que tenga 2
tabs». El #8 figuraba HECHO: se había arreglado cómo FUNCIONA y no cómo se VE.

**Lo medido en producción antes de tocar nada:** la caja medía 480×254 con **`padding: 0`**. `ModalShell` no pone aire
y `.spy-modal` tampoco: el texto iba pegado a los bordes en TODOS los modales de la tab. Era un bug, no un gusto. Y el
campo gris no era nuestro: venía de `campo` en `InstagramBuscador.tsx`, que en el alta del CRM combina con el formulario.

**El diagnóstico obvio era el equivocado:** «copiar un modal» manda a copiar el modal de `merrin` («New customer»), que
es un formulario, y un formulario es lo que había. La pieza que hace lo mismo que esto —escribir, ver filas, elegir— es
**su buscador de ⌘K (`.finder`)**, y ése no se llama modal en ningún lado. Medidas en
[diseno/referencia-spy.md](diseno/referencia-spy.md). **Regla: la referencia se elige por lo que hace, no por cómo se
llama** (es el mismo hallazgo de fitlo, una tienda de ropa, un nivel más abajo).

### Cuatro cosas que gastaban del tope sin que nadie lo viera

El tope (`APIFY_TOPE_POR_DIA`, 40) es lo que deja a un negocio sin poder agregar a nadie, y ninguna de estas da error:

- ⚠️ **La búsqueda por nombre no contaba.** La cabecera de `lib/instagram-buscar-apify.ts` decía que el tope la cubría
  («peor caso US$0,48 por día»), pero sólo `leerPerfilInstagram` contaba. Escribir nombres no tenía techo. Ahora pasa por
  `gastarBusquedaDeSpy`, y sin cupo la pantalla lo dice en vez de «no encontré a nadie» (`limite`).
- ⚠️ **La misma persona se pagaba dos veces.** La clave de la caché lleva la lista de fuentes, y el buscador y la vista
  previa piden listas distintas: escribir su @ gastaba una lectura y confirmarla, otra. `claveLeido` comparte lo leído bien
  entre todos. Lleva el ancho (`anchas`/`angostas`): una lectura sin piezas no puede contestarle a quien pide piezas, o
  diría «no publica sus me gusta» de quien sí los publica.
- ⚠️ **Un tope con reserva habría tapado a la vista previa.** `reservaApify` hace fallar antes a lo que nadie pidió con un
  clic, y ese fallo se cachea 10 minutos. Con la misma clave, la fila que no se completó le contestaba «no pude» a quien
  la elegía. La reserva entra en la clave.
- ⚠️ **Un link de su perfil se buscaba como un NOMBRE.** `usuarioDeTexto` no acepta enlaces, así que la ruta gastaba 20 s de
  búsqueda en un texto que ya decía quién es. `queSeHace` manda `@usuario`, y a quien ya se mira no se lo busca.

### Y dos más que no son de plata

- ⚠️ **La vista previa no podía leer con la clave de Spy.** Llamaba con las fuentes por defecto, que no incluyen `apify-spy`,
  y con sólo esa clave contestaba «no pude leer» habiendo con qué. El mismo bug que el CRM arregló el 2/11: **una lista de
  fuentes por defecto es un lector distinto en cada llamada**. Ahora hay `leerPerfilParaElAlta`, y la lista vive ahí.
- ⚠️ **Completar va por una ruta, no por una server action.** Next pone en FILA las actions de una pantalla: cinco lecturas
  de ~10 s habrían dejado esperando el «Sí, agregar», sin nada que lo explique. Un `fetch` no hace fila y se cancela.

### Y la búsqueda no trae a quien buscás

Medido en producción con «leila hormozi»: Apify trajo @leila.hormozi.1368, @leihormoz, @leillahormozi y
@leila_hormozi63, sin una sola foto, y **a la verdadera no**. @leilahormozi existe y se lee en 5 s. Por eso con un nombre se
prueba además su @ pegado (`usuarioDelNombre`), y esa fila sale sólo si la cuenta existe: lo dice la lectura, no una suposición.

**Lo que NO se pudo medir:** qué negocios tienen cada clave de Apify, porque leer `credenciales` lo frenó el permiso de
la sesión; el código pide las dos. `spy_lecturas_canal` estaba en **0 filas** el 3/11: la poda todavía no tiene qué borrar, y
`anotarAhorro` tampoco tiene con qué medirse.

**Vive en:** app/competitor-spy/BuscadorAlta.tsx · lib/spy-alta-reglas.ts · lib/spy-que-es.ts ·
lib/instagram-perfil-server.ts · app/api/competitor-spy/perfil · app/api/cron/spy-poda · tests/spy-buscador-alta.test.ts

**Probado rompiéndolo:** 39 roturas, una por vez y restaurada, y las 39 dieron rojo (`tests/spy-buscador-alta.test.ts` y `tests/instagram-perfil-fuentes.test.ts`, más
`tests/cron-registrado.test.ts` para la agenda). Sacarle a `cualesCompletar` el tope, que lea lo ya completo o que repita lo
pedido; la foto directa al CDN en las dos pantallas; el proxy abierto o que siga una redirección; el campo gris; la barra que
guarda sin confirmar; la búsqueda sin contar; el cron caído que contesta 200.

## Unfunnelizer: qué copiar para Spy, y lo que Spy ya guarda y tira (03/11/2026, Cerebro)

Martín: «investiga esto para copiarlo en la extension de MaKo» y «Obvio que esto va para la funcionalidad de Competitors Spy». Se investigó sin instalarla: ficha, documentos y el código de MaKo. Se copia la función, nunca su código, textos ni imágenes.

**Lo que se encontró en casa:**
- ⚠️ Los píxeles ya se leen y se tiran: `pixelesMetaDe` (`lib/landing-analisis.ts:389`) guarda `meta-px:` en `etiquetas`, y `nombresDe` los descarta al dibujar.
- ⚠️ Las columnas de anuncios están y nadie las llena: `diasCorriendo` y `etapaDeTendencia` existen, pero `guardarAnuncioPegado` (`lib/spy.ts:691`) sólo guarda enlace y copy, y `pagina_anuncios` no la escribe nadie.
- ⚠️ La poda de YouTube alcanza a todos los canales: `podarVencido` borraría a los 30 días lo leído de la Biblioteca, que no se relee. Y por eso `etiquetas` no sirve para datos nuevos: hace falta una columna propia.
- `RE_CHECKOUT` (`lib/landing-conversion.ts:50`) ya reconoce Stripe, Hotmart y Mercado Pago, pero Spy no lo usa. VTurb y Vidalytics no aparecen en ningún lado.
- ⚠️ No tocar `HOSTS_VIDEO` para esto: es el flujo del Pixel de los clientes, y esa cabecera avisa del riesgo de mandarles avisos falsos.

**La regla que queda:**
- Lo que se lee con la extensión se interpreta en el SERVIDOR: si cambia el diseño de un sitio, se arregla con un deploy y no con otra revisión de Chrome.
- `activeTab` no muestra advertencia, así que no debería desactivar la extensión a los clientes al actualizar (deducido de la documentación de Chrome, sin medir). Un permiso de sitios sí.
- Lo leído de Meta NO entra en `spy_lecturas_canal`: compartirlo entre negocios sería justo la transferencia a terceros que prohíben sus términos.

**Qué NO se copia:** la descarga de VSL, el «fetch-relay» contra el hotlink, el modo Brute y la página desbloqueada. La política de Chrome prohíbe facilitar esa descarga y eludir muros, y reincidir puede cerrar la cuenta que distribuye la extensión a los clientes que pagan.

**Sin hacer:**
- Tanda A, en el servidor: hecha, ver la entrada siguiente.
- Tanda B, «Guardar en Spy» en la extensión: hecha, y lo que estaba sin comprobar se midió. Ver «Guardar en Spy», abajo.

## Sus píxeles, su checkout y su video: lo que se midió construyéndolo (03/11/2026)

**Vive en:** `lib/spy-funnel.ts`, `spy_piezas.funnel` (0373), `app/competitor-spy/SuFunnel.tsx`.

**El diagnóstico obvio era el equivocado:**
- ⚠️ «Ver sus anuncios» buscando el dominio abre y miente. Con `keyword_unordered`, `acquisition.com` se parte en dos palabras: ~24.000 anuncios de cualquiera, el primero de Naukri.com, sin error. Con `keyword_exact_phrase` y el dominio entre comillas salen los de Alex Hormozi.
- ⚠️ Una lectura más completa no puede pisar a la anterior. El servidor no ve lo que carga Tag Manager; el navegador no ve lo que frena un bloqueador. Si una reemplazara a la otra, los píxeles aparecerían y desaparecerían según quién leyó último. Por eso son dos lugares (`pagina` y `navegador`) y se dibuja la unión.

**Medido con páginas de verdad, sin escribir nada:**
- acquisition.com: Google Analytics, Tag Manager, Google Ads, TikTok y Vidalytics. **El píxel de Meta no se ve desde el servidor**, y es el caso común: lo carga Tag Manager. Por eso la pantalla dice «Tag Manager puede cargar más» y nunca «no tiene».
- skool.com, con 455 KB de HTML y 2 MB de scripts propios: nada. Es un «no se ve desde afuera», que no es «no tiene».
- vidalytics.com contestó 429 al servidor: una lectura que falló, y no escribe nada.

**La regla que queda:**
- Un id se ancla en la forma de cargarlo (`gtm.js?id=`, `fbq('init',`, `gtag('config',`), nunca en el texto suelto: un artículo que enseña a instalar un píxel no es un píxel. Se descartan los comentarios, `<pre>`, `<code>` y los rellenos (`GTM-XXXXXX`, `123456789`).
- Lo que viene de la columna se vuelve a validar: sólo `https://`, porque termina en un `href`.
- `guardarFunnel` va aparte de `guardarVistas` y no tira: sin la columna, un upsert con `funnel` adentro perdería la lectura entera de la landing.

**Sin hacer:**
- La columna se agregó en producción el 4/11/2026, con el sí de Martín en el chat del Cerebro.
- Lectura real en el negocio de prueba (4/11/2026, Acquisition.com, ws3): Vidalytics, Google Analytics, Tag Manager, Google Ads y TikTok quedaron en `spy_piezas.funnel`, sin ninguna fila en otro negocio. Falta mirar la pestaña en la pantalla, una vez desplegada.
- Los videos que el analizador dice ver en un bundle (`reBundle`) pueden ser una librería que nadie monta (react-player trae las URL de YouTube y Vimeo). Se hereda tal cual de `analizarHtml`.

## «Guardar en Spy»: lo medido en la Biblioteca real, con la extensión de verdad (03/11/2026)

**Vive en:** `extension/spy-leer.js`, `extension/spy-reglas.js`, `extension/popup.js`; `lib/spy-captura.ts`, `lib/spy-captura-db.ts`; `app/api/competitor-spy/extension/route.ts`. La decisión de Martín («Sí, con un clic»): `docs/diseno-competitors-spy.md` §9.1.

**El diagnóstico obvio era el equivocado:**
- ⚠️ `chrome.action.openPopup` abre el desplegable y **no otorga `activeTab`** (Chrome 156: «Cannot access contents of the page» antes y después, y `tab.url` no viene). Hace falta el clic en el ícono. Por eso, sin `tab.url` el botón no aparece: cuando el worker abre el desplegable durante una extracción, no se ofrece nada.
- ⚠️ Buscar el dominio en la Biblioteca trae anuncios de otros aunque sea frase exacta: de 28 tarjetas de `"acquisition.com"`, 19 eran de Alex Hormozi y 9 de otros anunciantes que nombran ese dominio. Guardar «lo que se ve» habría llenado su ficha de ajenos. Entran sólo los que coinciden por Página, nombre o dominio de destino, y el desplegable dice cuántos quedaron afuera.
- ⚠️ El navegador ve más que el servidor, pero no todo. En acquisition.com vio tres cuentas de Google Analytics contra una, y **el servidor** vio Vidalytics, que el navegador todavía no había cargado. Ninguno de los dos vio el píxel de Meta. Por eso una lectura no reemplaza a la otra.

**Medido el 3/11/2026:**
- `performance` desde el mundo aislado ve lo mismo que la página: 117 de 117 recursos en un sitio, 216 de 216 en la Biblioteca. Las variables de la página no: `dataLayer` da `undefined`. Un píxel cargado por Tag Manager se ve por la dirección que pidió.
- Las direcciones alcanzan sin la consulta: `gtm.js?id=`, `g/collect?tid=`, `ccm/collect?tid=AW-`, `events.js?sdkid=`, `tr?id=`. Del resto de la consulta sale el correo del visitante y su identificador: `spy-leer.js` deja sólo `id`, `tid`, `sdkid`, `u` y `view_all_page_id`.
- La Biblioteca, sin sesión, con ~95 KB por 28 tarjetas. El id se dice «Library ID:», «Identificador de la biblioteca:» o «Identificação da biblioteca:»; la fecha, «Started running on Jul 29, 2026», «En circulación desde el 29 jul 2026» o «Veiculação iniciada em 29 de jul de 2026»; un anuncio inactivo trae el rango («30 jun 2026 - 11 ago 2026»).
- ⚠️ **Las plataformas son íconos sin texto** y el **id de la Página no está en lo dibujado**: sólo en la dirección, si se abrió por `view_all_page_id`. Por eso `plataformas` queda vacía y `pagina_anuncios` puede ser un nombre (`ahormozi`); con un nombre, «Ver sus anuncios» busca por frase exacta.
- Punta a punta, con la extensión real y sin tocar producción: en acquisition.com dijo «Guardar en la ficha de…» y guardó Analytics, Tag Manager, Google Ads y TikTok; en la Biblioteca dijo «Agregar como competidor» y sacó 19 anuncios de Alex Hormozi con sus fechas, destino e imagen.

**La regla que queda:**
- Lo que se lee con `activeTab` se interpreta en el servidor. El lector no sabe qué es un anuncio.
- Lo dibujado en una pestaña no dice lo que falta: `marcarDejadas` no se llama nunca desde acá. «Dejó de verse» sólo si la Biblioteca dice la fecha en que terminó.
- De un sitio sólo salen direcciones y su título. La persona puede tocar el botón con una sesión abierta, y lo que ese sitio le muestra a ella no es asunto de MaKo.
- Abrir el desplegable no cuenta qué sitio se está mirando: la lista de competidores viene entera y se compara en el navegador.
- La miniatura sólo puede ser del CDN de Meta: la baja el servidor, y si no, un token cualquiera le hace pedir lo que quiera.

**Sin hacer:**
- ⚠️ **Falta verlo escrito de verdad.** Guardar en el ws3 lo frenó el clasificador de permisos, `lib/spy-captura-db.ts` y la ruta se probaron con una base de mentira y capturas reales (`tests/spy-captura-db.test.ts`). Falta correrlo contra producción, en el ws3.
- Publicar la 0.75.0 lo decide el Cerebro: la 0.74.5 sigue en revisión. **Al subir esta parte a main**, `EXTENSION_VERSION` pasa a 0.75.0 y la tienda queda atrás (`EXTENSION_EN_TIENDA`), así que la app vuelve a ofrecer el zip.
- Sin medir: que `activeTab` no desactive la extensión al actualizar desde la tienda (deducido de la documentación). El clic se midió con `Extensions.triggerAction`, no con una persona.
- **La miniatura que no se llega a bajar se pierde:** `guardarMiniaturas` tiene 9 s de presupuesto, y un anuncio no se relee solo. La que no entró queda apuntando al CDN, que vence, hasta que se vuelva a guardar esa pestaña.
- La imagen se guarda en `spy/anuncios/<id>`, sin el negocio: dos negocios con el mismo anuncio reusan el archivo. No es la lectura compartida (no hay manera de ver el de otro), pero el archivo es uno.
- Cuando la 0.75.0 esté publicada, «Tag Manager puede cargar más» (`SuFunnel.tsx`) debería decir cómo verlo: abrir su sitio y tocar el ícono de MaKo.

## El buscador traía cuentas chicas: el diagnóstico obvio («otro actor de Apify») era el equivocado (4/11/2026)

**Síntoma:** Martín buscó «Víctor Heras» y vinieron @victorheras (5,2 mil), @victoria.herasymchukk (59),
@victor.heras.167 (14)… y ninguna de las grandes que el buscador del propio Instagram muestra primero
(victorherasemprendedor, 492 mil; herasmedia, 248 mil).

**El diagnóstico obvio era el equivocado:** «el actor de Apify busca mal, hay que buscar uno mejor». Pero el buscador de
Instagram ordena por relevancia CON la sesión de quien busca (a quién sigue, quién es grande, qué buscó otra gente); un
scraper sin sesión sólo puede emparejar texto, y ahí 14 seguidores y 492 mil empatan. Ningún actor sin sesión arregla eso.
Lo que ordena por popularidad sin sesión es Google, y además escribe los seguidores en la descripción del resultado:
con eso se ordena sin leer cada perfil. **Regla: cuando un proveedor ordena «mal», preguntá primero con qué dato ordena
el que ordena bien, y si ese dato se puede tener sin su sesión.**

**Otros tres del mismo pedido, ninguno daba error:**
- ⚠️ **La barra principal no buscaba: filtraba.** Sólo comparaba contra los competidores que ya se miran; con un nombre
  nuevo mostraba un cartel con otro botón. Para Martín «no hace nada». Ahora abre el mismo buscador que el «+».
- ⚠️ **«den.borgg» era un SITIO.** `queEs` tomaba cualquier «algo.algo» por un dominio pelado: el @ escrito sin la arroba
  se ofrecía como la página https://den.borgg y nunca se leía. Y «instagram.com/herasmedia» sin https caía en la misma
  regla y se guardaba como su landing. Un sitio ahora pide un dominio de primer nivel de verdad (`esDominio`).
- ⚠️ **El link de un canal de YouTube no traía la foto** aunque `channels.list` la devuelve en la misma respuesta que ya
  se pagaba (`snippet.thumbnails`): se tiraba. Ahora la confirmación y la ficha la usan.

**Y el @ exacto tardaba porque se preguntaba en fila:** la Meta del negocio (hasta 12 s), la de la plataforma, Google y
recién Apify. De once negocios con Meta, uno tiene permisos de Instagram: las esperas de adelante casi nunca traían nada.
Con la clave de Spy, Apify va primero (`leerExacto`). El actor en sí sigue tardando unos segundos: eso no se arregla
desde acá, y por eso la pantalla no promete «inmediato».

**Sin probar contra el servicio de verdad** (la nube no llega a Apify ni a Google): la forma de la descripción de Google
(«492K Followers» en inglés, «492 mil seguidores» en español: el lector entiende las dos), cuánto tarda una corrida de dos
páginas, y que el lector de perfiles acepte cinco usuarios en una corrida con `maxItems` 5.

**Vive en:** lib/spy-buscar-reglas.ts · lib/spy-buscar.ts · app/api/competitor-spy/buscar/route.ts ·
app/competitor-spy/BuscadorAlta.tsx · lib/instagram-perfil-server.ts (`leerPerfilesEnLote`) · lib/spy-que-es.ts ·
lib/spy-youtube.ts (`leerCanalCorto`) · tests/spy-buscar.test.ts · tests/instagram-perfil-fuentes.test.ts

## La ficha automática: lo que no daba error (4/11/2026)

> Martín, 4/11: «la IA ya debería analizar por sí sola todo, sin pedirlo… muchas veces aparecen tarjetas vacías sin la
> miniatura, y segundos después, cuando la animación ya empezó, ahí aparece la miniatura».

**El diagnóstico obvio era el equivocado, dos veces:**
- ⚠️ **Las tarjetas vacías de la animación no eran miniaturas rotas: eran miniaturas que todavía no habían llegado.** La
  película esperaba 700 ms a que se pudieran pintar, y empezaba igual. Las de Instagram vienen del CDN de Meta y tardan
  más que eso. Ahora se bajan TODAS antes de arrancar (`new Image()` con el mismo `referrerPolicy` que la `<img>`, si no el
  CDN contesta 403), hasta 8 s, y la que no llegó entra con su texto. Mientras tanto se ve sólo la criatura.
- ⚠️ **Sospeché que un avatar PNG con transparencia rompía la comparación de fotos** (`grayscale().raw()` con dos canales,
  144 bytes, y `dHash` en null). Lo medí antes de escribirlo como hallazgo: con esta versión de sharp sale un solo canal.
  Quedó el test con un PNG con alfa, como red, y no la afirmación.

**Tres que callaban:**
- ⚠️ **El análisis «a pedido» caía a la IA de la plataforma.** Sin la clave de Claude del negocio, `analizarCompetidor`
  llamaba a `chatClaude`; no se gastaba porque el veto frena `spy`, pero el negocio con sólo su Gemini no podía analizar
  nada. Ahora es `chatCheapCascade` (su Claude, su GPT, su Gemini) y sin ninguna dice «Conecta tu…».
- ⚠️ **Mandar siempre «las primeras 40» repetía y pagaba lo ya leído**, y una pieza que la IA no devolvía quedaba
  pendiente para siempre (cada lectura la volvía a mandar). Ahora van sólo las pendientes, y lo que no volvió se marca
  leído sin datos (`ANALISIS_SIN_DATOS`). Y el ref se busca sin mayúsculas: un modelo que lo devuelve en minúsculas no
  encontraba la fila con `.eq('ref', …)`.
- ⚠️ **Una tanda que no dice qué promete borraba la oferta.** El análisis de 30 reels de una charla devuelve `promete`
  vacío, y se escribía encima del que había. `ofertaQueQueda` sólo pisa con una que trae algo.

**Regla:** lo que corre solo y en segundo plano necesita una marca de «ya lo hice» que no dependa de que la IA conteste
bien; si no, lo que falla una vez se paga en cada vuelta.

**Sin probar contra el servicio de verdad:** que el análisis automático con la IA de un negocio real termine en los 300 s
de la ruta (3 tandas de 30), y la búsqueda de redes completa contra Google y Apify (los dobles salen de las respuestas
medidas el 3/11).

**Vive en:** lib/spy-analisis-reglas.ts · lib/spy.ts (`analizarCompetidor`, `guardarAnalisis`, el sitio de la bio) ·
app/api/competitor-spy/analizar/route.ts · app/api/competitor-spy/redes/route.ts · lib/spy-otras-redes.ts ·
lib/spy-otras-redes-reglas.ts · lib/spy-foto-hash.ts · app/competitor-spy/redes-recordar.ts ·
app/competitor-spy/OrdenSpy.tsx · app/competitor-spy/SpyApp.tsx · tests/spy-analisis.test.ts · tests/spy-otras-redes.test.ts

## «No me hizo la caricatura»: no fallaba la generación, nadie la pedía (4/11/2026)

> Martín (por el Cerebro): «me traje a @den.borgg y no me hizo la caricatura como habíamos quedado».

**El diagnóstico obvio era el equivocado:** «falla Flow». `pedirCaricatura` (lib/spy-caricatura-flow.ts) estaba escrita
desde el 3/11 con su prompt aprobado, y **no tenía un solo llamador**: compilaba, tenía sus comentarios y nunca corría. Le
faltaban dos cosas que nadie tenía: los `rasgos` que el prompt exige y quién la disparara.

**Y debajo había otro que tampoco daba error:** el pedido iba con una ruta propia (`spy/caricaturas/…`) para guardarla en
el bucket de Spy, pero la cola sólo le firma la subida al puente si la ruta pasa `RUTA_SUBIDA` (`firmarSubidas`,
lib/flow-cola.ts). Con la propia, el puente no subía nada y lo único que volvía era la url de Flow, que vence en una
hora. Ahora va con `rutaDeSubida` y el servidor la copia al bucket de Spy.

**Regla:** una función que hace algo caro y lo hace bien no está terminada hasta que alguien la llama; antes de dar por
«ya existe» una pieza, `grep` de sus llamadores.

**Sin probar contra el servicio de verdad:** la caricatura entera (la IA mirando la foto, el puente de Flow tomando el
pedido). La nube no llega a ninguno de los dos.

**Vive en:** lib/spy-caricatura-auto.ts · lib/spy-caricatura-reglas.ts · lib/spy-caricatura-flow.ts ·
app/api/competitor-spy/caricatura/route.ts · lib/spy.ts (`listarCompetidores`) · app/competitor-spy/SpyApp.tsx ·
tests/spy-caricatura-auto.test.ts

## Traer todo: la lectura de siempre iba a borrar el historial (4/11/2026)

> Martín, 4/11: «que no traiga solo 50 reels o videos, que traiga muchos más, si puede, todos directamente».

**El diagnóstico obvio era el equivocado:** «sube el número». Subir los 50 a 500 en la lectura de siempre se cae a los
60 s de la ruta (cien publicaciones tardan uno o dos minutos en Apify), y además rompe otra cosa que no daba error.

⚠️ **`marcarDejadas` marcaba como «borrada» toda pieza que no viniera en la lectura**, sin mirar hasta dónde llegaba esa
lectura. Con una lectura que trae lo último y una corrida larga que trae años, cada «Revisar ahora» habría marcado todo el
historial como «borradas» (y ya pasaba en YouTube: un canal que publica Shorts a diario sacaba de la ventana videos que
seguían ahí). Ahora cuenta sólo lo publicado desde lo más viejo que trajo la lectura, y una pieza sin fecha no se marca
(`seFueron`).

**Y dos que callaban:** `listarPiezas` cortaba en 200 con un `.limit` (con todo lo traído, la ficha mostraba una parte
sin decirlo), y la lectura de YouTube dejaba de paginar al tener 20 largos: «todos» nunca habría pasado de ahí.

**Regla:** lo que marca algo como «se fue» tiene que saber hasta dónde miró. Una ausencia sólo es evidencia dentro de la
ventana que se leyó.

**Sin probar contra el servicio de verdad:** las corridas largas de Apify (empezar, mirar, leer el dataset) y el actor
de anuncios entero, que queda apagado hasta medirlo con `scripts/probar-anuncios-apify.mjs`.

**Vive en:** lib/spy-todo-reglas.ts · lib/spy-todo.ts · app/api/competitor-spy/todo/route.ts · lib/spy.ts
(`marcarDejadas`, `listarPiezas`, `vistaDeInstagram`) · lib/spy-youtube.ts (`PAGINAS_COMPLETAS`) ·
lib/instagram-perfil.ts (`piezasDeApify`) · scripts/probar-anuncios-apify.mjs · tests/spy-todo.test.ts

## El detalle en un gráfico: los formatos no se iban a llenar nunca (4/11/2026)

> Martín, 4/11 (puntos 7 y 9): «quiero que eso sea el Detail de cada competidor… como va poniendo todos sus contenidos en un
> gráfico» y «debería fácilmente estar el botón de "Copiar estructura"». La especificación, en el diseño §15.

⚠️ **«¿Qué formatos le funcionan?» habría quedado vacío para todo competidor que ya existía.** La IA del negocio le pone el
formato a cada pieza al analizarla, y una pieza ya analizada no se vuelve a mandar (`faltaAnalisis` miraba sólo «¿hay un
análisis?»). Sin nada que lo dijera: la sección no se dibuja cuando no hay formatos, que es lo correcto para un competidor
nuevo y una mentira para uno viejo. Ahora un análisis sin formato cuenta como pendiente UNA vez (`guardarAnalisis` escribe
siempre un formato, `otro` si la IA no lo vio, y `ANALISIS_SIN_DATOS` también lo trae), y va DESPUÉS de lo que nunca se leyó.

**Una escala logarítmica con el tope en una potencia de 10 exacta sumaba una década vacía.** El techo se calculaba con
`ceil(log10(max) + 1e-9)`: con 10.000 de máximo daba 10^5, y todo el gráfico quedaba aplastado en la parte de abajo. Lo cazó
el test que pide que 100, 1.000 y 10.000 queden a la misma distancia; va `- 1e-9`.

**«Corto» ya estaba definido:** la primera versión de `tipoParaCopiar` decidía un short con su propia expresión (hasta 60 s)
y el resto de Spy usa `esShort` (hasta 180 s, la regla de YouTube desde 2024): un video de dos minutos era un short en la
ficha y un video largo al copiarlo. Ahora los dos preguntan `tipoDeContenido`.

⚠️ **Cruzar el ancho del teléfono reiniciaba el gráfico entero.** La primera versión volvía a la criatura (`bajadas = null`) cada vez
que cambiaba lo que se dibuja, y la muestra depende del ancho (180 miniaturas en la computadora, 90 en el teléfono): rotar una
tableta o achicar la ventana volvía a bajar todo y a correr la animación desde cero. No lo mostraba ningún test: lo mostró una
captura de página entera en Chromium, que cambia el tamaño de la vista, con las 89 animaciones otra vez en su primer cuadro. Ahora
cada miniatura se pide UNA vez y lo bajado se acumula, y la animación corre una vez por gráfico (su tipo y su red); un cambio a mitad
de camino la corta y deja cada una en su lugar.

**La precarga de las miniaturas era una copia por animación.** La película del orden ya la tenía escrita adentro; el gráfico
la necesitaba igual. Se mudó a `app/competitor-spy/precarga.ts` y la usan las dos.

**«Copiar estructura» no abre una tab que a quien mira no le corresponde:** la ruta de Spy pregunta la puerta del Copywriter
(`esAdminDeTab('copywriter')` + `veCopywriter()`), y sin ella devuelve el texto para el portapapeles. Una tarjeta que abre el
detalle es un `div` con rol de botón, no un `<button>`: adentro van bloques.

**Lo que no va, a propósito:** la «Anatomía del guion» y la curva de «siguen mirando» del video. No hay guion de un video
ajeno ni retención pública: un bloque sin datos no se dibuja.

**Sin probar contra el servicio de verdad:** que la IA del negocio devuelva el formato con la forma pedida (se lee por valor o
por nombre, con o sin tildes), el gráfico en pantalla con un competidor real, y la página nueva del Copywriter.

**Vive en:** lib/spy-detalle.ts · app/competitor-spy/GraficoSpy.tsx · app/competitor-spy/DetallePieza.tsx ·
app/competitor-spy/precarga.ts · app/api/competitor-spy/copiar/route.ts · lib/spy-analisis-reglas.ts (`faltaAnalisis`) ·
lib/spy.ts (`leerAnalisis`, `guardarAnalisis`, `leerPieza`) · tests/spy-detalle.test.ts

## «Pongo un espacio y sólo me trae Instagram»: YouTube tiraba los videos de Google (4/11/2026)

> Martín, 4/11: «pongo un espacio… solamente me trae Instagram. Es como que directamente ya no busca a usuarios de
> YouTube… debería buscarlos, tanto por nombre de usuario, por arroba, por link».

**La causa, medida en el código:** con un nombre de varias palabras, YouTube salía SÓLO de Google (`"nombre"
site:youtube.com`), y `canalesDeGoogle` tiraba todo resultado que fuera un video (`/watch`, `/shorts`, `youtu.be`)
porque «un video no dice de qué canal es sin leerlo». Es casi todo lo que Google devuelve para esa consulta: el grupo de
YouTube quedaba vacío. Y dos más que lo empeoraban: el nombre pegado se probaba como @ en Instagram y no en YouTube, y
sin la clave de la YouTube Data API la lectura de un canal devolvía `null` igual que «no existe», así que la lista se veía
completa sin serlo.

**Lo que quedó:** los videos de Google se leen con `videos.list` (1 unidad por todos, sin `search.list`) y se ofrece el
canal de cada uno; un nombre prueba también su @ en YouTube; y el grupo de YouTube dice qué pasó cuando no trae a nadie
(«Ningún canal con ese nombre», «No pude buscar en YouTube», «Conecta Apify…»).

**Regla:** un filtro que tira lo que no entiende tiene que medirse contra lo que la fuente devuelve de verdad. «Un video no
es un canal» era cierto y dejaba la fuente vacía.

**Sin probar contra el servicio:** que Google traiga videos con esa forma para un nombre real, y la lectura de
`videos.list` con la clave de la plataforma.

**Vive en:** lib/spy-buscar-reglas.ts (`planDeBusqueda`, `videoDeUrl`, `videosDeGoogle`, `youtubeEstado`) ·
lib/spy-buscar.ts (`leerCanalHallado`, `canalesDeLosVideos`) · lib/spy-youtube.ts (`canalesDeVideos`,
`leerCanalesDeVideos`) · app/api/competitor-spy/buscar/route.ts · app/competitor-spy/BuscadorAlta.tsx · tests/spy-buscar.test.ts

## «12 publicaciones de 500, y no buscó su YouTube ni su web»: la traída larga callaba, y su web era su página de enlaces (4/11/2026)

> Martín, 4/11: «tampoco está haciendo el ejercicio de buscar en YouTube y también buscar su web… Yo busqué literalmente el
> usuario exacto y ya me apareció el primer resultado… y en correlación mirar las biografías para traer sus webs».

**Lo que midió el Cerebro en producción:** Den Borg (ws 9, competidor 17) llegó a 255 publicaciones con la traída larga: la
traída SÍ anda cuando se la empuja. El de 12 es OTRO competidor (id 13, ws 11). El 17 tenía `youtube_id` vacío y su «web»
era `beacons.page/denborg`, una página de ENLACES.

**Las causas, medidas en el código (ninguna da error):**
- **La traída larga sólo avanzaba con la ficha abierta.** La pantalla pregunta cada 20 s y deja de preguntar a los 15
  minutos; sin nadie mirando, una corrida terminada no se recogía nunca. → Cron de cada hora (`/api/cron/spy-todo`).
- **Una corrida que terminaba SIN NADA contaba como la de la semana.** Apify contesta «terminé» también cuando Instagram no le
  dio nada (los ítems vienen como `{ error, errorDescription }`): el competidor quedaba siete días con lo de la lectura de
  siempre (12), sin una línea que lo dijera. → Se anota para mañana, y la pantalla lo dice.
- **El `porque` de la traída se calculaba y no se mostraba.** «Sin clave», «sin cupo» o «Apify no trajo nada» llegaban a la
  pantalla y no se dibujaban. → Una línea suave debajo del competidor (`avisoDeTraida`).
- **Sus otras redes salían sólo de Google, y Google trae videos** (el mismo bug de la búsqueda: se tiraban). Y nadie probaba
  su MISMO usuario en la otra red, que es lo primero que hizo Martín a mano.
- **Una página de enlaces (beacons, linktr.ee…) se guardaba como su web**, y su web de verdad estaba adentro, sin leer.

**Lo que quedó: `cadenaDeRedes` (lib/spy-cadena.ts), de lo más barato a lo más caro, sin escribir nada:** (1) lo que él
enlaza en su bio y lo que enlaza su página de enlaces (se ABRE con `fetchSeguro`; los enlaces que la página dibuja con
JavaScript se leen de sus datos) — eso es seguro; (2) su mismo usuario en la red que falta (`@den.borgg` y `@denborgg`, 1
unidad de YouTube) — entra solo con su mismo nombre o su misma foto, si no se pregunta; (3) Google, SÓLO si todavía le falta
Instagram o YouTube, y los videos se leen como su canal. La bio de Instagram ya viaja en la lectura compartida (`perfil.bio`,
`perfil.web`), así que la cadena no vuelve a pedir el perfil. Su web se guarda sólo si no tenía o la que tenía era su página de
enlaces (`ponerWebEncontrada`, compare-and-set).

**Y uno que apareció al poner el cron: el tope de 6 corridas largas por día vivía en la MEMORIA del proceso.** Con la ficha
abierta, todas las preguntas caían en la misma instancia y alcanzaba; con un cron de cada hora, cada vuelta puede caer en una
instancia nueva que arranca en cero, y el tope dejaba de topear sobre la clave del negocio. Ahora se reserva en la base
(`spy.todo.dia`, compare-and-set) ANTES de empezar la corrida.

**Regla:** un contador que protege plata vive donde lo ven todas las instancias. Uno en memoria sirve mientras un solo
proceso hace el trabajo, y deja de servir en silencio el día que se le suma un cron.

**Sin probar contra el servicio:** que beacons.page sirva sus enlaces sin JavaScript (se probó con una página armada con las
dos formas), que Apify devuelva los ítems de error con esa forma, y el cron en Vercel.

**Vive en:** lib/spy-cadena.ts (`cadenaDeRedes`) · lib/spy-otras-redes.ts (`buscarOtrasRedes`) · lib/spy-otras-redes-reglas.ts
(`esAgregador`, `enlacesDeHtml`, `loQueEnlaza`, `usuariosParaProbar`, `veredictoDe`) · lib/spy.ts (`ponerWebEncontrada`) ·
lib/spy-reglas.ts (`canalDeLaBio`) · lib/spy-todo.ts (`reservarCorrida`) · lib/spy-todo-reglas.ts (`usadasHoy`,
`avisoDeTraida`) · app/api/cron/spy-todo/route.ts · app/api/competitor-spy/redes/route.ts · app/competitor-spy/SpyApp.tsx ·
tests/spy-cadena.test.ts

## La caricatura por cola: la hace el Runner con Canva, y el camino de Flow se borró (4/11/2026)

> Martín, 4/11 (por el Cerebro): «cada vez que se genere un nuevo competidor, hacer una especie de levantar un ticket
> para generar esa imagen y ya con eso se pone la imagen ahí».

**Por qué se cambió de camino:** el de antes (la IA del negocio describía la cara y el puente de Google Flow la generaba)
no salió **ni una vez** en producción: el Cerebro midió que todos los puentes estaban sin sesión, así que la pantalla lo
pedía, se rendía callada y la tarjeta quedaba con la foto. Y le cobraba al negocio dos veces. Se borró entero (motor, ruta
y el bucle de la pantalla), para no dejar dos caminos vivos.

**Lo que quedó:** al leer un competidor con su foto ya en NUESTRO Storage, queda pendiente en `spy.caricaturas`; el Runner
la lista (`spy-caricaturas-pendientes.mjs`: sólo ws, id y la URL de la foto) y la guarda (`spy-caricatura-guardar.mjs`). El
contrato, en docs/relevo/nube-spy.md. Una sola lógica para el servidor y los scripts: lib/spy-caricatura-cola.ts, sin
`server-only` y con lo que habla con la base inyectado, así el test corre la cadena entera.

**Tres decisiones que no se ven en el código:**
- **Una caricatura por PERSONA, no por negocio.** Se guarda por su cuenta (`spy/caricatura/instagram-den_borgg.png`) y se
  marca lista en todo competidor con la misma red y el mismo usuario; los que comparten una cuenta son un grupo (también
  encadenado: A y B comparten Instagram, B y C YouTube) y el grupo se lista una vez. Lo único que cruza negocios es la
  imagen: nunca quién mira a quién.
- **Los fallos se juntan en UNO.** La primera versión elegía «el que entró primero a la cola»: con el fallo anotado en el
  competidor del negocio del lado, la próxima vez se le pedía al otro, que arrancaba en cero — tres intentos por negocio
  en vez de tres por persona. Ahora se elige primero al que ya falló (lo cazó el test 5b, escrito porque esa rotura daba
  verde).
- **«No hay Canva» no es un fallo.** Canva depende de la cuenta de Claude del Runner: sin él no se anota nada y la
  pendiente espera. Lo que lo delata es `masVieja` (la fecha de la pendiente más vieja) creciendo en la lista del super
  admin; la pantalla no dice nada.

**La receta, medida por el Cerebro con Den Borg (~30 s):** `upload-asset-from-url` → `generate-image` con
`imageReferences` y `SQUARE_1_1` → `get-generate-image-job` hasta `SUCCESS` → `get-assets`. **El conector entrega una vista
de 200 × 200 aunque el original mida 1264**: el tamaño se LEE del archivo (`medidasDeImagen`) y no se supone. Y **el prompt
aprobado dice «the man»**: Den Borg es una mujer, así que el género y los rasgos los completa el Runner mirando la foto,
nunca un texto fijo.

**Regla:** cuando un proveedor entrega «una vista» de un archivo, el tamaño se lee de los bytes que llegaron, no del
original que se pidió.

**Sin probar contra el servicio:** los scripts contra la base de producción (la primera prueba es Den Borg, ws 9,
competidor 17) y la búsqueda por prefijo del Storage (`caricaturaGuardada`).

**Vive en:** lib/spy-caricatura-reglas.ts (`estadoEnCola`, `colaDeCaricaturas`, `mismaPersona`, `medidasDeImagen`,
`caraDeTarjeta`) · lib/spy-caricatura-cola.ts (`encolarCaricatura`, `listarCola`, `guardarCaricatura`, `anotarFallo`) ·
lib/spy-caricatura-servidor.ts (`encolarAlLeer`) · lib/spy-miniaturas.ts (`caricaturaGuardada`) · lib/spy.ts
(`mirarCompetidor`) · scripts/spy-caricaturas-pendientes.mjs · scripts/spy-caricatura-guardar.mjs ·
scripts/spy-caricatura-base.mjs · app/competitor-spy/SpyApp.tsx · tests/spy-caricatura-cola.test.ts

## «Sugeridos»: los competidores de la plataforma en todos los negocios, sin cobrarle a nadie (4/11/2026)

> Pedido de Martín (por el Cerebro, 4/11): los que carga el negocio de la plataforma aparecen en todos los negocios como
> catálogo «Sugeridos», sin cobrarle al cliente; se suman a su lista sin duplicarlos, y nunca se ven los de otro cliente.

**Lo que quedó:** un bloque «Sugeridos» debajo de los competidores (también cuando el negocio todavía no mira a nadie), con
la misma tarjeta y «Sumar». Sumarlo COPIA lo que la plataforma ya leyó (sus publicaciones vivas, su foto, sus números y su
caricatura si ya está hecha) y deja anotada la traída larga como hecha hoy: no se le pide nada a Apify ni a YouTube con la
clave del negocio. Lo nuevo, después, sigue las reglas de siempre (la lectura compartida primero). En la API de MaKo:
`ver_sugeridos` y `sumar_sugerido`, por el mismo camino que la pantalla.

**Tres cosas que no se ven en el código:**
- **Sólo la plataforma, y por capa.** El negocio de la plataforma sale de `wsSuperAdmin()` (capa `superadmin`), nunca de
  un 9 escrito; y cada fila se vuelve a mirar contra ese negocio (`soloDeLaPlataforma`), así una consulta mal filtrada no
  alcanza para que se cuele a quién mira otro cliente. El test lo prueba con una base que devuelve filas de todos.
- **Los anuncios no se copian.** Lo traído de la Biblioteca de Anuncios no se le pasa a un tercero (los términos de Meta
  no dejan transferir lo recolectado): el cliente trae los suyos con su propia lectura. Tampoco viaja la `oferta`: está
  escrita contra el negocio de la plataforma, no contra el del cliente.
- **Lo borrado no se copia como vivo.** Una pieza que la plataforma vio desaparecer (`dejo_de_verse_en`) no entra:
  copiada por `guardarVistas`, nacería como «a la vista».

**Lo que se resigna:** la fecha de «visto por primera vez» de lo copiado es la de hoy (la escribe sólo el insert de
`guardarVistas`, a propósito); la fecha de publicación sí viaja.

**Sin probar contra el servicio ni en pantalla:** el bloque no se dibujó con datos (la pantalla entera trae las actions
del servidor y no entra en el banco de prueba); usa las mismas clases que la tarjeta de los competidores.

**Vive en:** lib/spy-sugeridos.ts (`listarSugeridos`, `agregarSugerido`, `soloDeLaPlataforma`, `piezasACopiar`,
`esLaMismaPersona`) · lib/spy-sugeridos-server.ts · lib/spy-todo.ts (`marcarTraidaHoy`) · app/competitor-spy/actions.ts
(`sugeridosAction`, `sumarSugeridoAction`) · app/competitor-spy/page.tsx · app/competitor-spy/SpyApp.tsx
(`RejillaSugeridos`) · lib/api-mako/areas/spy.def.ts y spy.run.ts (`ver_sugeridos`, `sumar_sugerido`) ·
tests/spy-sugeridos.test.ts

## Los logos de cada red, uno solo en toda la tab, y «¿En qué publica?» por red y por formato (4/11/2026)

> Pedido de Martín (por el Cerebro, 4/11): los mismos logos de Instagram y YouTube que el buscador, en todos lados donde
> se ve la red de una pieza; y «¿En qué publica?» de verdad, sin «100% videos».

**La causa del «100% videos»:** el reparto contaba por el tipo GUARDADO, y todo lo de YouTube se guarda como `video`
(shorts y largos por igual): un canal de YouTube daba «100% videos» aunque la mitad fueran shorts. Ahora sale de
`tipoDeContenido` (reels, carruseles e imágenes, shorts, videos largos, anuncios), y por red con su logo
(`repartoDePublicaciones`). Su web no es una publicación: no entra al total.

**Los logos:** `LogoRed` vivía adentro del buscador y el resto dibujaba íconos genéricos. Ahora es una pieza
(app/competitor-spy/LogoRed.tsx) que usan el buscador, las miniaturas del gráfico (en la esquina), sus filtros, el
detalle de una pieza y «¿En qué publica?». ⚠️ Los logos de marca se dibujan con los `<symbol>` de `<BrandDefs>`: la
pantalla lo monta una vez, y el detalle también (va por portal). Sin eso, el logo sale vacío y sin error.

**De paso:** «Cada miniatura es un video» se fue (narraba lo que ya se ve); queda «Se ven N de M» sólo cuando hay más
piezas que miniaturas.

**Vive en:** app/competitor-spy/LogoRed.tsx · lib/spy-detalle.ts (`repartoDePublicaciones`) · app/competitor-spy/GraficoSpy.tsx
· app/competitor-spy/DetallePieza.tsx · app/competitor-spy/SpyApp.tsx (`RielAnalisis`, `CajaMix`) ·
app/competitor-spy/BuscadorAlta.tsx · tests/spy-logos.test.ts

## «Contenido» y «Funnel»: dos pestañas, el selector adentro del gráfico y cada miniatura con su proporción (4/11/2026)

> Pedido de Martín (por el Cerebro, 4/11), mirando la ficha en producción: sólo dos pestañas; el selector y los filtros
> adentro de la tarjeta del gráfico; cada miniatura con su proporción real; sin «Revisar ahora»; sin textos que narran
> lo que ya se ve; y la criatura de MaKo sin la tarjeta blanca detrás mientras analiza.

**Lo que quedó:**
- **Dos pestañas.** «Contenido» = el gráfico, sus piezas y sus anuncios debajo, con el riel al costado. «Funnel» = su web
  (con su funnel y «Copiar su sitio») y lo que se leyó de su oferta. «Miniaturas» se fue: las tarjetas de YouTube ya
  llevan su miniatura apaisada y su título.
- **El selector y los filtros de red van adentro de la tarjeta del gráfico**, arriba del dibujo.
- **Proporción real** (`proporcionDe`, `medidaEnElGrafico`): reel y short 9:16, publicación y anuncio 1:1, video largo y
  web 16:9. En el gráfico el lado más largo mide lo mismo para todas (un video apaisado no ocupa más lugar); en las
  tarjetas, el `aspect-ratio` de la imagen.
- **Sin «Revisar ahora».** Queda «Probar de nuevo» sólo cuando una lectura FALLÓ; «no encontré publicaciones» ya no
  ofrece releer.
- **Mientras carga, la tarjeta del gráfico no se dibuja** (`data-cargando`): la criatura queda sobre el gris de la página.

**Una trampa que no se ve:** un test (spy-orden, el 5) contaba DOS botones de releer apagados durante la película —
«Revisar ahora» y «Revisar de nuevo»—; sacar uno lo ponía rojo. Lo que cuidaba no era el número sino que ninguno se
pueda tocar mientras corre la animación: ahora afirma eso sobre el que queda.

**Sin hacer todavía:** el detalle de una pieza rediseñado con su transcripción (#10). «Funnel» con el analizador de
ofertas quedó en la entrada de abajo.

**Vive en:** app/competitor-spy/SpyApp.tsx (`Pestana`, el panel «Contenido») · app/competitor-spy/GraficoSpy.tsx ·
app/competitor-spy/TarjetaPieza.tsx · lib/spy-detalle.ts (`proporcionDe`, `medidaEnElGrafico`) · tests/spy-contenido.test.ts

## «Su oferta» con el analista de Offer: el mismo analista hablaba de «tú» y podía pagarlo MaKo (4/11/2026)

> Pedido de Martín (por el Cerebro, 4/11): «en "Su Funnel" debe "exponer" su OFERTA con el analizador de oferta que ya
> tenemos construido, y debe traer automáticamente sus web para analizarlas». Y del encargo: «IA: cada negocio paga la suya,
> y el crédito de Claude de la plataforma no se usa acá».

**Lo que quedó:** la pestaña «Funnel» dibuja, debajo de su web, el diagnóstico de Offer (`VistaDiagnostico`, las 9 notas
con su porqué, la tesis, lo que ya hace bien) y el puntaje que calcula el código. Lo trae sola la ruta
/api/competitor-spy/oferta al abrir un competidor con web: contesta en el acto, el trabajo sigue en un `after()` y la
pantalla pregunta cada 8 s mientras dice «leyendo», con la criatura. Sin botón. En la API, `su_oferta_con_notas` (lectura).

**Tres cosas que no se ven en el código:**
- **El analista de Offer escribe de «tú» al «dueño».** Su prompt es para diagnosticar la oferta PROPIA, y la regla de idioma
  dice «lo lee el dueño». Con la web de un competidor, el texto salía «tu promesa no dice…»: leído por otro negocio, parece
  hablar de la suya. No se armó otro analista: `bloqueOfertaDeOtro` (lib/offer-reglas.ts) se pega al system YA RENDERIZADO
  (si fuera un slot del template, un prompt editado en /configuraciones no lo tendría) y pide tercera persona y citas de su
  web. Los consejos para el dueño de esa oferta («Para subirla», «Lo primero que cambiaría», los avisos, lo que le falta
  para estar lista) no se dibujan: `VistaDiagnostico` con `deOtro`.
- **`pedir` de Offer prueba el crédito de Claude de la plataforma y la red de plataforma** cuando las claves del negocio no
  contestan, y con el onboarding en curso el crédito está habilitado para la feature `offer`. Sin un corte, un negocio
  recién llegado le pagaba a MaKo el diagnóstico de la oferta de un competidor. `soloDelNegocio` corta antes de los dos.
- **La landing que guarda Spy no tiene su texto** (`spy_piezas` canal `landing` guarda sus piezas y su funnel, no el
  copy). Su web se vuelve a bajar con la puerta de Offer: `extraerLanding(url, { talCual: true })` y, si un antibots frena
  a los servidores o casi no hay texto, el lector de afuera. No hay otro `fetch` de URLs.

**Se lee una vez y listo:** la huella del texto de sus webs (`huellaDe`) decide. A la semana se baja otra vez (no cuesta
IA) y sólo si cambió se diagnostica de nuevo; una web nueva se lee sola. Un fallo deja el motivo y el diagnóstico de antes,
y espera un día (una semana, a los 3 seguidos). Cada escritura es compare-and-set contra lo que escribió ESE trabajo:
un diagnóstico pesa 5-8 KB, así que `cambiarSettingSi` compara por `updated_at` y no por el valor en la URL.

**Sin probar contra el servicio:** que el modelo de un negocio real cumpla la tercera persona (es una instrucción en el
prompt: no hay un chequeo en el código que la corrija), y lo que trae la web de un competidor de verdad (un
constructor de páginas que arma todo con JavaScript cae al lector de afuera).

**Vive en:** lib/spy-oferta.ts · lib/spy-oferta-servidor.ts · app/api/competitor-spy/oferta/route.ts ·
app/competitor-spy/SuOferta.tsx · lib/offer-reglas.ts (`bloqueOfertaDeOtro`) · lib/offer-ia.ts (`deOtro`,
`soloDelNegocio`) · app/offer/Conclusion.tsx (`VistaDiagnostico`, `deOtro`) · tests/spy-oferta.test.ts

## «No estás trayendo la transcripción»: no había transcripción, y el video de cada reel se tiraba al leerlo (4/11/2026)

> Pedido de Martín (por el Cerebro, 4/11): «En cada uno de los videos cuando entro no estás trayendo la transcripción, y
> tampoco me gusta el modal que hiciste, rediseñalo bien… Tampoco me gusta el botón de copiar estructura».

**Medido en el código, por qué no llegaba:** no había un camino de transcripción. El detalle decía, en su cabecera, «el guion
de un video ajeno no se lee (no hay forma legal de transcribirlo)», y el dato que hacía falta se tiraba: Apify trae
`videoUrl` en cada reel y `piezaDeApify` (lib/instagram-perfil.ts) no lo copiaba. Guardarlo tampoco servía: el enlace del
CDN de Instagram VENCE en días.

**Lo que quedó:** al abrir el detalle de un reel, /api/competitor-spy/transcribir pide su video fresco a Apify (UNA
publicación, `videoDeUnaPublicacion` en lib/spy-todo.ts —el único archivo que puede tener la clave de Spy junto con los de
siempre—, con un tope de 40 por día contado en la base), lo baja por la puerta SSRF-segura y lo escucha la IA del negocio
(`transcribirAudio` con `pii` y `sinGroq`, como el audio de un anuncio). Mientras, «Transcribiendo…»; el guion queda en
`spy.transcripcion.<competidor>.<pieza>` y no se vuelve a pagar hasta que vence a los 30 días (el reloj del texto de una
pieza). Un reel sin voz queda dicho («es sólo música o imagen») y tampoco se vuelve a pagar.

**Tres trampas:**
- **Un mp4 cortado no se puede escuchar.** `pedirClavado` corta en su techo y devuelve lo leído (está bien para una web).
  Para un video, se pide un byte más que el tope y, si lo pasa, «pesa demasiado»: nunca se escucha medio archivo.
- **`.mk-btn` sin tamaño queda chico.** El botón de antes era `mk-btn mk-btn--primary` sin `--md` ni `--lg`: con la hoja
  real de la casa mide unos 20 px de alto, y eso era parte del «no me gusta». Ahora `mk-btn--lg`.
- **Un pedido que no contestó no es «transcribiendo».** Si la ruta falla, el bloque no se dibuja: un punto latiendo para
  siempre se lee como que algo está pasando.

**Lo que NO se hizo, y por qué:** el guion de YouTube. `captions.download` pide ser el dueño del canal (OAuth) y bajar el video
va contra sus términos; Martín decidió Apify «sólo para Spy» sobre Instagram. Queda como decisión suya (docs/relevo/nube-spy.md).

**Sin probar contra el servicio:** que el actor devuelva `videoUrl` para un enlace de reel (`directUrls` con un solo
enlace), cuánto pesa un reel de verdad y que la IA de un negocio escuche un mp4 de Instagram.

**Vive en:** lib/spy-transcripcion.ts · lib/spy-transcripcion-servidor.ts · app/api/competitor-spy/transcribir/route.ts ·
lib/spy-todo.ts (`videoDeUnaPublicacion`, `tieneClaveDeSpy`) · lib/spy-todo-reglas.ts · app/competitor-spy/DetallePieza.tsx ·
lib/spy-detalle.ts (`vecesSuMediana`) · tests/spy-guion.test.ts

## Tercera vuelta (Martín revisó con Den Borg, 4/11/2026): lo que el Cerebro midió desde la PC

**Vive en:** `app/competitor-spy/BuscadorAlta.tsx`, `lib/spy-otras-redes.ts`, `lib/spy-google-corrida.ts`, `lib/spy-cadena.ts`,
`lib/spy-todo.ts`, `lib/spy-todo-reglas.ts`, `app/competitor-spy/SpyApp.tsx`.

- **«Escribí tal cual @herasmedia y no me trajo al perfil».** La fila «Usar @x · Tal como lo escribiste» confirmaba sin leer: la
  tarjeta salía con una letra «H». No era Apify (40 de 40 corridas `SUCCEEDED`, el perfil se lee en 10 s): era el `elegir` del
  buscador. Ahora va por `elegirPerfil`, el mismo camino de un perfil hallado. Lo fija `tests/spy-buscador-alta.test.ts`.
- **«No pude buscar sus otras redes ahora».** El actor de Google tardó 57 y 48 s (las dos `SUCCEEDED`) y nosotros cortábamos a
  los 45: Apify terminaba y cobraba, y el resultado pagado se tiraba. Ahora la corrida se EMPIEZA asíncrona y se sigue 35 s; si no
  terminó, queda anotada en el negocio (`spy.google.<huella>`, sin el texto buscado) y el pedido siguiente la RETOMA sin pagar
  otra. La pantalla vuelve a pedir sola, sin texto. ⚠️ El cupo del día se gasta al EMPEZAR, no al retomar: por eso `gastar` pasó
  de la cadena a la búsqueda. Lo fija `tests/spy-google-corrida.test.ts`.
  - **La regla que queda:** con un proveedor que cobra por corrida, un `run-sync` con un timeout nuestro tira lo pagado cuando
    tarda más. Se empieza asíncrona y se anota el `run` antes de esperarla.
- **El crédito de Apify del negocio.** Plan FREE: US$5 por mes; una traída larga de 300 publicaciones costó US$0,69. La traída
  larga ahora lee `GET /v2/users/me/limits` y se achica a un cuarto de lo que queda por encima de una reserva de US$2 (lo de todos
  los días: leer, dar de alta, transcribir); si no alcanza, espera. Un 402 al empezar también es «sin crédito». Se le dice sólo al
  admin y sin cartel de error. Sin poder leer el crédito, sigue como siempre (no es «sin crédito»). Lo fija `tests/spy-todo.test.ts`.
- **La caricatura de Den Borg.** El camino de la tarjeta está bien y tiene su test de punta a punta. El hueco era otro: si la
  imagen no cargaba, la tarjeta quedaba sin cara. Ahora cae a su foto de perfil (`caerAFoto`).

## Tercera vuelta: la ficha de un competidor rediseñada (4/11/2026)

**Vive en:** `app/competitor-spy/SpyApp.tsx`, `app/competitor-spy/GrillaPiezas.tsx`, `app/competitor-spy/MejoresPiezas.tsx`,
`app/competitor-spy/BuscadorAlta.tsx`, `app/competitor-spy/GraficoSpy.tsx`, `app/competitor-spy/page.tsx`, `app/competitor-spy/precarga.ts`,
`lib/spy-vista.ts`, `lib/spy-detalle.ts`, `lib/spy-buscar-reglas.ts`.

Martín, con Den Borg en producción. Lo que se hizo, pedido por pedido (lo fija `tests/spy-ficha-tercera.test.ts`):

- **«Agregar YouTube» abría un campo con un botón.** Ahora es el MISMO buscador del alta (`BuscadorAlta` con `para`): arranca con
  su nombre sin lo que va después de « - » (`nombreParaBuscar`) y muestra sólo la red pedida (`gruposPermitidos`); desde el menú,
  sólo sus redes, sin «Ya los miras» ni «Sin redes».
- **Volver a todos los competidores** era una miga de 18 px en gris. Ahora es un botón con la flecha y las caras de los demás, y al
  lado el cambio directo a otro (copiado del «←» de la cabecera de un ítem en Shopify y Linear).
- **El ⋯ del perfil, arriba a la derecha.** ⚠️ El `Dropdown` de la casa toma `width` para el BOTÓN: con `width={210}` el ⋯ quedaba
  encima del texto. Va `width={40}` y `menuMinAncho={210}`.
- **La grilla de sus piezas: a todo el ancho y por páginas** (`GrillaPiezas`). Antes vivía al lado del riel y crecía de a 60: con
  160 piezas, 13.600 px de página. Ahora una página son filas enteras (`columnasQueEntran` × 3), y el paginador nunca esconde
  una sola página detrás de «…» (`botonesDePaginas`).
- **«Lo que mejor le fue», al lado de los formatos.** Cierra el riel y se estira hasta donde terminan los formatos; si el riel es
  más alto, se estiran los formatos. ⚠️ Para que la caja se estire sin empujar la grilla, la tarjeta va en `position: absolute`
  dentro de una caja `flex: 1`: en flujo normal le sumaría su alto a la columna y nunca «llegaría» al final. Se ordena por cuántas
  veces la mediana de SU grupo hizo cada pieza (`mejoresPiezas`): un short y un video largo no se comparan en vistas crudas.
- **Los anuncios, dentro de Contenido**, como un formato más del desplegable (`tipoEnLaGrilla`). `tipoDeContenido` no los nombra a
  propósito: lo usan los gráficos, que los agrupan aparte.
- **La entrada:** las miniaturas se acomodan en una grilla en el centro, de la mejor a la peor, y cada una vuela a su lugar en el
  gráfico (~1,6 s, el mismo gesto de antes con otro origen). La película de «ordenar» (6 s) sigue sólo después de una lectura pedida.
- **En el teléfono**, el riel con `flex-wrap: wrap` en columna hacía que la base de 280 px fuera un ALTO: las tarjetas quedaban con
  un hueco abajo (los seguidores, 223 px para 107 de contenido). Va `nowrap`.

### La velocidad, medida (vista de prueba, no producción)

Con la misma vista de la ficha (`SpyApp` con 166 piezas de Den Borg inventadas), con una demora simulada de 700 ms para traer las
piezas y miniaturas que tardan entre 0,2 y 2,8 s, en Chromium a 1440 px, 3 vueltas cada una:

| | Gráfico dibujado | Elementos en la página | Tarjetas en la grilla |
|---|---|---|---|
| Antes | 3,84 – 3,99 s | 2.369 | 66 |
| Después | 3,17 – 3,22 s | 1.664 | 15 |

Lo que bajó: las piezas del competidor abierto llegan con la página (antes se pedían por una action DESPUÉS de hidratar, y las
actions hacen fila), las cuatro lecturas del server van en paralelo, y la grilla dibuja una página y no 60 tarjetas. Lo que NO
mide esta vista: la red real del CDN de Meta. Por eso el tope de espera de las miniaturas bajó de 8 a 3 s (las que no llegan entran
con su texto, sin cajas vacías). ⚠️ En producción hay que medir lo mismo con un competidor real: es lo que pidió el Cerebro.
