# Hallazgos — Conocimiento (el portal de cursos y la ingesta de clases)

El material de formación y cómo entra: `app/conocimientos/` (el portal de cursos que se
mira), `app/conocimiento/ConocimientoView.tsx` (la puerta por la que sube una clase),
`app/api/mako/knowledge/transcribe/route.ts` + `lib/transcribe.ts` (el que la convierte en
texto) y `public/cono-tx/` (donde aterriza).

Ojo con los dos nombres, que se confunden a cada rato: **`/conocimientos`** (plural) es el
portal de cursos con video; **`/conocimiento`** (singular) es el RAG de MaKo. Son dos
pantallas distintas y solo la segunda escribe en `mako_knowledge`.

## Lo que más muerde acá

1. **El diagnóstico obvio era el equivocado, y costó horas: «Google nos bloquea la IP» era
   un bug del parser.** [→](#google-no-bloqueaba-nada-el-token-de-confirmación-viene-en-un-formulario)
2. **El portal NO guarda un solo video.** Si buscás un `.mp4` en el repo no hay ninguno, y
   eso es a propósito. [→](#el-portal-no-guarda-video-iframe-de-drive--transcripción-estática)
3. **Que la CARPETA de Drive sea pública no alcanza**, y el fallo llega como HTTP 200 con
   una página de login. [→](#una-carpeta-pública-de-drive-no-hace-públicos-sus-archivos)
4. **Drive tiene un tope de descarga POR ARCHIVO que no se puede saltear.** Reintentar es
   tiempo tirado. [→](#el-tope-de-drive-es-por-archivo-y-no-hay-forma-de-saltearlo)
5. **El código que resolvió todo lo de arriba se perdió**, por vivir en `scratchpad/` sin
   versionar. [→](#el-pipeline-de-la-corrida-anterior-se-perdió-por-no-estar-versionado)
6. **`--cookies-from-browser chrome` no puede funcionar en Windows hoy**, y el síntoma dice
   «0 cookies» en vez de fallar. [→](#reusar-la-sesión-del-navegador-lo-que-no-funciona-en-esta-máquina)
7. **Y el remate: las cookies no hacían falta para nada, y eran lo único que rompía la
   descarga.** Probá sin la credencial antes de construir alrededor de ella.
   [→](#el-diagnóstico-obvio-era-el-equivocado-las-cookies-no-hacían-falta-y-encima-rompían-la-descarga)
8. **⚠️ Drive te da un id antes de subir el archivo, y el script reportó «20/20 OK» con
   cero archivos arriba.** Un fallo que se presenta como éxito.
   [→](#️-drive-te-da-un-id-antes-de-subir-el-archivo-y-no-es-el-id-que-sirve)
9. **El pre-push verde no significa que un script corra**: `tsx` compila a CJS y el
   `await` de nivel superior falla recién al ejecutar.
   [→](#npx-tsx-compila-a-cjs-un-await-de-nivel-superior-explota-en-ejecución)
10. **⚠️ Un link compartido que da 404 con `0 visitas` NO es el token: es el catálogo.** El
    portal y el link compartido tenían dos listas de cursos distintas, y cada curso nuevo
    nacía con el link roto sin ningún síntoma del lado del admin.
    [→](#️-el-link-compartido-de-un-curso-daba-404-porque-el-catálogo-estaba-escrito-dos-veces)
11. **⚠️ «No apareció ningún PDF» era un ZIP que SÍ estaba pasando por la red.** Tres
    suposiciones de formato cableadas en el script, cada una descartando en silencio.
    [→](#️-no-apareció-ningún-pdf-era-un-zip-el-formato-es-un-hecho-del-archivo-no-una-suposición-del-script)
12. **⚠️ Quedarse con «la respuesta más grande» costó DOS diagnósticos equivocados.** La
    llamada anónima traía 92 filas inservibles y la buena 41 útiles. Tamaño ≠ corrección.
    [→](#️-quedarse-con-la-respuesta-más-grande-dos-diagnósticos-equivocados)
13. **⚠️ Un curso de 116 clases se enumeró como CERO**, y el mensaje de error señalaba el
    lugar equivocado. La misma heurística rota servía para dos cosas distintas.
    [→](#️-no-encontré-ninguna-clase-en-un-curso-de-116-la-duración-no-puede-ser-el-requisito)
14. **La página publica cuántas lecciones tiene** (`0/11` en cada módulo): ese número es
    ajeno a nuestra heurística y por eso sirve de patrón. Ahora se aborta si no da.
    [→](#la-página-publica-cuántas-lecciones-tiene-úsalo-como-patrón)
15. **⚠️ `.al-chip` estaba escrito dos veces en la misma hoja** y el segundo pisaba al
    primero sin ningún aviso. [→](#️-al-chip-estaba-definido-dos-veces-y-el-segundo-ganaba-en-silencio)
16. **⚠️ Un curso con SUBMÓDULOS no se enumera por el DOM.** Cinco hipótesis, cuatro
    refutadas con evidencia; la salida fue cambiar de fuente, no insistir.
    [→](#️-un-curso-con-submódulos-no-se-puede-enumerar-por-el-dom-cinco-hipótesis-cuatro-refutadas)
17. **Los tres desajustes entre `/vip/` y `/curso/` fallan TODOS en silencio**: otro nombre
    de campo, el id adentro de la URL, y una duración ausente que marcaba 210 clases sanas
    como rotas. [→](#los-tres-desajustes-entre-vip-y-curso-que-fallan-todos-en-silencio)
18. **Antes de bajar un curso, fijate si ya está en Drive.** Éste estaba: 211 de 242.
    Y al cruzar, no uses un `Set` — los títulos se repiten.
    [→](#antes-de-bajar-un-curso-fijate-si-ya-está-en-drive)
19. **⚠️ Un reintento que consulta un id PERSISTIDO no es un reintento.** ScreenApp aceptó
    un archivo y no lo transcribió nunca; los reintentos poleteaban el mismo trabajo
    muerto. [→](#️-un-reintento-que-consulta-un-id-persistido-no-es-un-reintento)
20. **⚠️ La plataforma puede tener el curso cargado DOS VECES**, y ni los ids únicos ni
    los títulos únicos lo ven: la señal es la duración idéntica.
    [→](#️-la-plataforma-puede-tener-el-curso-cargado-dos-veces-y-ningún-chequeo-de-unicidad-lo-ve)
21. **⚠️ Las transcripciones estaban rotas en TODO link compartido** y del lado del admin
    se veían bien: el `matcher` del middleware excluye assets por extensión y `.json` no
    estaba. [→](#️-las-transcripciones-estaban-rotas-en-todo-link-compartido-y-del-lado-del-admin-se-veían-bien)
22. **⚠️ La portada no es la imagen más GRANDE de la tarjeta**: el avatar del autor gana
    por área. La proporción es la que separa una tapa de una foto de perfil.
    [→](#️-la-portada-del-curso-no-es-la-imagen-más-grande-de-la-tarjeta)

---

## El portal

### El portal no guarda video: iframe de Drive + transcripción estática

**Síntoma.** Se busca dónde están los videos de los cursos para reprocesarlos y no aparece
ninguno. Da la impresión de que falta una carpeta o que algo no se subió.

**Causa.** No falta nada: el video **nunca** está en el repo. `CursoPortal.tsx` lo embebe
con `<iframe src={DRIVE_PREVIEW(c.videoId)}>`, donde `videoId` es el id del archivo de
Google Drive. Lo único que aterriza acá son las **transcripciones**, como JSON estático en
`public/cono-tx/<videoId>.json` (438 archivos), que `TranscriptLazy` baja perezosamente al
abrir la clase para no meter 1,6 MB en el bundle.

Y el catálogo es un archivo **auto-generado de 1,6 MB**: `app/conocimientos/curso.ts`

> ⚠️ **CORRECCIÓN 22/08/2026: «auto-generado» es FALSO para `curso.ts`.** Ningún script
> del repo lo escribe — la única escritura de `.ts` es `curso-a-portal.mjs`, con destino
> `curso-<slug>.ts`, y `gen-curso.mjs` nunca existió (0 hits en 1755 commits). El archivo
> **se edita a mano y las ediciones sobreviven**. La premisa importa porque GOBIERNA
> decisiones: `PORTADA`, `AUTOR` y `REEMPLAZADOS` viven en `catalogo.ts` justificándose en
> una regeneración que no ocurre. Para los `curso-<slug>.ts` la regeneración **sí** ocurre,
> así que la corrección no se aplica con brocha ancha. Detalle al final del documento.
exporta `CURSOS: Curso[]`, con `videoId: string | null`, `hasTx?: boolean` (que gatea el
fetch a `/cono-tx`) y un `transcripcion: string[]` que va **vacío a propósito**. Los
módulos escritos a mano viven aparte y se suman en `app/conocimientos/catalogo.ts`, que es
la fuente única de la lista (ver la entrada de abajo sobre el link compartido).

**Regla.** Para sumar material al portal, lo que se produce es una **transcripción con el
nombre del `videoId`**, no un archivo de video. Y no se edita `curso.ts` a mano: está
generado. El mismo portal lo consume `/compartido/[token]/CursoCompartido.tsx`, así que
cualquier cambio de forma se ve en dos lugares.

**Vive en:** `app/conocimientos/curso.ts` · `app/conocimientos/CursoPortal.tsx:171,203` ·
`public/cono-tx/`

### ⚠️ El link compartido de un curso daba 404 porque el catálogo estaba escrito DOS veces

**Síntoma.** Se comparte un curso desde `/conocimientos` con «Cualquiera con el enlace», el
modal dice «Listo» y muestra el link, la fila del share queda viva y con `0 visitas` — y el
link abre un **404 de Next**. Desde el lado del admin no hay ningún síntoma: nada falla,
nada se loguea.

El diagnóstico obvio es el equivocado tres veces seguidas. El 404 **no** era un token mal
copiado, **no** era el share revocado o vencido, y **no** era el gate de `proxy.ts`: era el
`notFound()` del final de la búsqueda del curso, adentro de una página que ya había
resuelto el token bien. Y el contador de visitas lo confirma sin ambigüedad —
`registrarVisita()` corre **después** de encontrar el curso, así que **`0 visitas` + 404
significa que el token resolvió y lo que no se encontró fue el material**. Con `resolverToken`
fallando no habría fila que mirar.

**Causa.** El catálogo de cursos estaba armado en dos lugares con dos listas distintas:
`Conocimientos.tsx` juntaba seis fuentes, y `app/compartido/[token]/page.tsx` armaba la suya,
`[...CURSOS, CURSO_VSL]`. Los cursos que viven en archivo propio —«Curso de Claude AI -
Rodrigo Rojo» y «Construir la app»— aparecían en el portal, se podían compartir desde la UI,
y su link no resolvía. **Cada curso nuevo nacía con el link roto**, porque el archivo que
había que tocar no era ninguno de los dos que se tocan al agregarlo.

**Regla.** Es «Una cosa, un lugar» (AGENTS.md) con el agravante de que el segundo lugar es
**invisible desde donde se agrega el dato**. La lista vive en `app/conocimientos/catalogo.ts`
y la importan los dos lados; los slugs de los dos cursos con vista propia —el Análisis de
Negocio, que es un formulario, y Branding, que se comparte por su propio `recurso='branding'`—
se nombran ahí y no sueltos en cada `if`.

Y la que sirve para cualquier feature con dos caras: **una pantalla pública que refleja una
privada no se verifica mirando la privada.** El portal del admin funcionó perfecto todo el
tiempo. Lo que hay que abrir es el link, como invitado.

**Vive en:** `app/conocimientos/catalogo.ts` · `app/compartido/[token]/page.tsx:40` ·
`app/conocimientos/Conocimientos.tsx` (corrida del 2026-08-12)

### La puerta de entrada a la ingesta YA existe — no hay que escribir pipeline nuevo

**Síntoma.** Se planifica «armar el pipeline de ingesta al RAG» como si no existiera.

**Causa.** Existe y funciona de punta a punta: `app/conocimiento/ConocimientoView.tsx`
(subís el video o el audio de una clase y lo revisás antes de guardar) → `POST
app/api/mako/knowledge/transcribe/route.ts` (admin-only vía `getSesionAdmin`; acepta por
MIME `audio/*` o `video/*`, o por extensión) → `lib/transcribe.ts`
`transcribeMediaBuffer()` → el guardado va a `mako_knowledge`, que es la tabla que lee el
RAG de MaKo.

**Regla.** Un archivo bajado no necesita pipeline: necesita **entrar por esa puerta**. Lo
que falta es solo el paso de *conseguirlo* y el de *achicarlo* (abajo).

⚠️ **El tope de 25 MB rebota TODA clase de curso**, y no tiene troceado en ningún lado
(`lib/transcribe.ts:13` → status `muy_grande` → HTTP 413; y la cascada barata corta aún
antes, a 14 MB inline). Un video de 40 minutos pesa cientos de MB. **Hay que extraer el
audio con ffmpeg antes** — mono y bitrate bajo. El detalle de ese tope y de los dos STT
hardcodeados a `whisper-1` vive en [hallazgos-ia.md](hallazgos-ia.md) → «dos STT
hardcodeados», que es donde vive ese código; no se copia acá.

Y **ffmpeg ya está en disco**, no hace falta instalarlo: el build GPL completo está en
`C:/Users/marti/AppData/Local/ffmpeg-full/ffmpeg-master-latest-win64-gpl/bin/` (con
`ffprobe`). No está en el PATH, así que se invoca por ruta absoluta.

**Regla de formato:** si se produce un archivo, que salga **mp4**. La familia de video
aceptada la fija `lib/formatos-archivo.ts:46` y es fuente única — `mkv` está excluido a
propósito porque Gemini no lo toma.

**Vive en:** `app/api/mako/knowledge/transcribe/route.ts` · `lib/transcribe.ts:13` ·
`lib/formatos-archivo.ts:46`

---

## Lo que sale mal se ve PUBLICADO, no en el JSON

**2026-08-17.** El curso de AvatarHype se publicó con módulos llamados **«1», «3.1»,
«3.2»** y un encabezado que decía **«30 CLASES · 30 CLASES»**. Los tres bugs habían pasado
por typecheck, por 1022 tests y por mi propia lectura del `plan.json`, donde se leen
perfecto: `"modulo": "1"` es un string válido y plausible.

**Los tres, y el patrón que comparten:**

| Se veía | Era |
|---|---|
| Módulos «1», «3.1» | el plan guardaba el **código de la lección** (`4.1.1`) como nombre del módulo |
| «30 CLASES · 30 CLASES» | el portal pinta `N clases · <volumen>` y el pipeline emitía `volumen: '30 clases'` |
| Tarjetas « · Parte 1» | `cardDesc` unía duración y módulo con un `·` fijo, y ese curso no publica duraciones |

Los dos últimos **afectaban a todos los cursos del pipeline** y llevaban semanas ahí.

**La regla: un dato que solo se mira en su JSON no está verificado.** Un identificador
puesto donde va un nombre es sintácticamente perfecto, y un separador sin su segunda mitad
no rompe nada. Lo que los delata es la pantalla. Antes de dar por publicado un curso, hay
que **abrirlo**.

**Los corolarios, que valen para cualquier generador:**

- **Un separador va entre DOS cosas o no va.** Se arma con `filter(Boolean).join(' · ')`,
  nunca concatenando con el separador escrito en el template.
- **Un campo libre al lado de un conteo no es el conteo otra vez.** `volumen` está para lo
  que el conteo NO dice — acá, la duración total.
- **Y el que no tiene el dato, corta.** Si `avatarhype-plan.mjs` no puede leer los nombres
  de los módulos, ahora sale con error en vez de escribir números: publicar «1» como nombre
  de módulo es peor que no publicar.

⚠️ **Y arreglar los nombres hizo aparecer dos clases.** Con el módulo bien resuelto, el
recorrido llegó al módulo 5 (la extensión de clonación): el curso tiene **27 lecciones y 32
videos**, no 25 y 30. O sea que el bug de presentación estaba tapando uno de contenido —
lo publicado tenía dos clases de menos.

**Vive en:** `scripts/avatarhype-plan.mjs` · `scripts/curso-a-portal.mjs` ·
`app/conocimientos/CursoPortal.tsx`

### ⚠️ Replicar una PANTALLA ajena: el contenedor no es decoración

**2026-08-17, replicando el curso de Avatar Hype con su propia interfaz.** Tres fallas
seguidas, y las tres se veían igual desde el navegador: la pantalla mal. Ninguna era
del componente.

**1. Faltaba un `div`, y con él el 99% del CSS.** El origen monta
`.ugc > .ugc-shell`; el componente montaba `.ahdoc > .ugc-shell`. Medido sobre el
archivo generado: **593 reglas están escritas bajo `.ugc` y solo 5 aplican sin él**. El
síntoma es traicionero porque parece que el CSS no cargó —portadas a pantalla completa
apiladas, texto crudo— cuando en realidad cargó entero y no matchea nada.

> **Antes de escribir el componente, contá cuántas reglas cuelgan de cada contenedor
> del origen.** Un `grep` del selector padre en la hoja capturada contesta en un
> segundo si ese div es decorativo o es la mitad del diseño.

**2. Las variables de tipografía viven en el MISMO elemento que el scope.** Next.js
emite clases `__variable_a4bae9 { --font-bricolage: … }` y las pone en el div de la
app. Al rescopear quedaron como `.ahdoc .__variable_a4bae9`, o sea apuntando a un
elemento que acá no existe: las **440** referencias a `--font-*` resolvieron en vacío y
el navegador cayó a la fuente de sistema. La pantalla «se parecía» y no era.
Y sus `@font-face` apuntan a archivos self-hosteados en el dominio del origen: no
sirven. Las 7 familias son de Google y se piden ahí.

**3. Rescopear CSS con un reemplazo global rompe lo que tiene estructura.** Dos bugs
en la misma función:

- `body .algo { display:none }` se **colapsó** a `.ahdoc { display:none }` —el prefijo
  reemplazaba el selector entero en vez de su primer token— y escondió el curso.
  El DOM estaba completo: 33 tarjetas montadas, CSS cargado, **cero excepciones**, y la
  pantalla en blanco.
- A los `@media` se les pegó el prefijo adelante (`.ahdoc @media (max-width: 1000px)`),
  que no es CSS válido: el navegador descarta el bloque entero. Eran 15.

**La regla: el CSS se procesa REGLA POR REGLA.** El `cssText` de cada regla es una
línea; los at-rules se tratan aparte (se rescopean los selectores de adentro, nunca la
condición).

**Y el chequeo que cierra las tres, porque se hace sobre el archivo y tarda un
segundo:**

```
grep -c '^\.ahdoc\(, *\.ahdoc\)* *{[^}]*display: *none'   → 0
grep -c '\.ahdoc *@media'                                  → 0
grep -c '\.ahdoc \.<contenedor> '                          → cuántas dependen del wrapper
```

**Vive en:** `scripts/avatarhype-css.mjs` (el rescopeo) ·
`app/conocimientos/CursoReplica.tsx` (los dos contenedores)

### ⚠️ Bajar el MATERIAL de un curso, no solo su video: las tres trampas

**2026-08-17, replicando el curso de Avatar Hype entero** (documentos, prompts,
imágenes y links, no solo las clases). Las tres se ven igual desde afuera —«no baja»—
y tienen causas distintas.

**1. El origen sirve según el DESTINO de la request, no según la sesión.** La misma URL
de `/api/doc-media/…` devuelve la imagen a un `<img src>` (medido: 1152×2048) y falla a
un `fetch()` — relativo, absoluto y con `credentials:'include'`, las tres formas. Los
107 archivos fallaron idénticos con **«TypeError: Failed to fetch»**, que no es 401 ni
403: es la request que no llega a hacerse, así que no hay status que leer ni log que
mirar.

**La salida no es pedirlas mejor: es no pedirlas.** Se deja que la página cargue lo
suyo y se cosechan los bytes de la capa de red con `Network.getResponseBody`. Son los
bytes ORIGINALES — un `<canvas>` también funcionaría para imágenes, pero recodifica, y
para un mp4 no sirve.

**2. Y cosechar de la red tiene un punto ciego que va al revés de la intuición: cuantas
más veces se corre, MENOS baja.** Lo que el navegador ya tiene cacheado no genera
request, así que no hay nada que cosechar. Va `Network.setCacheDisabled` antes de
navegar.

**3. Lo que está detrás de una tab no existe hasta que se la clickea.** Las 5 imágenes
que quedaron afuera de la primera corrida vivían en los paneles «Biblioteca» y
«Recursos», que la app no monta hasta que se los abre. Recorrer la lección no alcanza:
hay que recorrer sus TABS. Vale igual para capturar el contenido.

**Y para los videos del documento la cosecha de red no sirve:** un mp4 que el navegador
reproduce en streaming devuelve un pedazo o nada. Pero el reproductor los pide a
`…b-cdn.net/ugc-docs/<archivo>?token=…` —la misma firma que las clases— y **esa URL sí
se baja desde node, sin sesión**. Se anota la firmada al pasar por la red y se bajan
aparte.

**Vive en:** `scripts/avatarhype-media.mjs` (la cosecha) · `scripts/avatarhype-doc.mjs`
(la captura del contenido) · `scripts/avatarhype-doc-portal.mjs` (el pasaje al portal)

### La pestaña del navegador se cuelga, y CDP no lo dice

Un `Runtime.evaluate` que no vuelve **nunca** se ve igual que un script lento. Medido: el
WebSocket de CDP **abría normal** y ni `Runtime.enable` contestaba — el hilo de esa pestaña
estaba bloqueado después de horas de navegaciones y reproducciones.

- **Todo comando de CDP va con timeout.** Sin él el script espera para siempre y no imprime
  una línea, así que no hay ni con qué diagnosticar. `curso-plan.mjs` ya lo tenía (25 s);
  `avatarhype-plan.mjs` no, y por eso el síntoma duró veinte minutos.
- **El arreglo es cerrar la pestaña y abrir una nueva** (`/json/close/<id>` y `/json/new`),
  no reiniciar Chrome entero.
- **La prueba que lo aísla en 15 segundos:** abrir el socket y pedir `Runtime.enable`. Si
  eso no vuelve, no es tu script.

## La secuencia completa de un curso, y las tres etapas que se saltean solas

**Escrito el 2026-08-16 porque me las salteé.** El pipeline tiene CINCO etapas y no
estaban en ningún lado como *secuencia*: hay que deducirlas leyendo cinco scripts. Bajar y
transcribir un curso **no lo publica**, y el que no lo sabe entrega la mitad creyendo que
entregó todo. El dueño lo reportó como *«no veo aún nada de cambios en MaKo»*, que es
exactamente cómo se ve esto.

```
1. <plataforma>-plan.mjs   → plan.json          (qué clases hay y dónde vive cada video)
2. <plataforma>-bajar.mjs  → video/             (los archivos)
3. curso-pipeline.mjs --drive                   (audio + transcripción + COPIA A DRIVE por ronda)
4. curso-a-drive.mjs       → drive.json         (el videoId REAL de cada clase)
5. curso-a-portal.mjs      → public/cono-tx/*.json + app/conocimientos/curso-<slug>.ts
   …+ UN paso a mano: sumarlo a CURSOS_TODOS en app/conocimientos/catalogo.ts
```

Las tres que se saltean, y qué pasa con cada una:

- ⚠️ **`--drive` en el paso 3.** Sin el flag, la subida a Drive no arranca hasta que
  termina todo lo demás. **El diseño es que las cuatro cosas se solapen** —baja, convierte,
  transcribe y sube al mismo tiempo—, y sin eso el curso tarda el doble sin que nada falle:
  no hay error, solo lentitud, que es el modo de falla más difícil de notar.
- ⚠️ **El paso 4 no es opcional aunque «ya esté en Drive».** `--solo-copiar` (lo que hace
  el paso 3) copia pero **no resuelve los ids**, y `drive.json` es lo que come el paso 5.
- ⚠️ **El paso 5 termina en `catalogo.ts`, a mano.** El script lo dice al terminar, pero es
  un `console.log` al final de una corrida larga: si nadie lo lee, los archivos quedan
  escritos y el curso **no existe** para el portal.

**La regla que queda: «bajado» no es «entregado».** Un curso está entregado cuando se ve en
`/conocimientos`, y entre una cosa y la otra hay tres pasos que no fallan si faltan —
simplemente no pasan. Cuando un pipeline tiene etapas que se pueden omitir sin error,
la secuencia se escribe entera en un lugar, que es esto.

**Vive en:** `scripts/curso-pipeline.mjs` (`--drive`) · `scripts/curso-a-drive.mjs` ·
`scripts/curso-a-portal.mjs` · `app/conocimientos/catalogo.ts` (`CURSOS_TODOS`)

---

## Conseguir el material de origen: las trampas de Google Drive

Todo lo que sigue se pagó en una corrida anterior y **no estaba escrito en ningún
`hallazgos-*.md`**: sobrevivía solo como prosa en
`docs/chats/chat-conocimientos-cursos-e8ba820e.md`.

### Google no bloqueaba nada: el token de confirmación viene en un FORMULARIO

**Síntoma.** Las descargas empiezan a fallar en tanda. La lectura natural es que Google
está limitando por IP porque vamos muy rápido.

**Causa.** Era un **bug del parser**. Para un archivo grande, Drive devuelve un
interstitial HTML y el token de confirmación viene en un `<form>` (`name="confirm"
value="t"` más un uuid), **no en un link**. El parser buscaba un link, no lo encontraba, y
el fallo se leía como bloqueo remoto.

**Lo caro no fue el bug:** fueron las horas invertidas en throttle, reintentos y cooldowns
para un problema que no existía.

**Regla.** Antes de culpar al servidor remoto, **imprimí el body real de la respuesta**. Un
HTTP 200 con HTML es una pista de parser, no de rate limit.

**Vive en:** `docs/chats/chat-conocimientos-cursos-e8ba820e.md:6236`

### Una carpeta pública de Drive no hace públicos sus archivos

**Síntoma.** La carpeta está compartida como «cualquiera con el link», y la descarga
igual falla. Peor: devuelve **HTTP 200**, así que un chequeo por status code lo da por
bueno.

**Causa.** El endpoint de descarga **no respeta la herencia de permisos** de la carpeta.
Sin permiso a nivel **archivo**, contesta una página de **login** con status 200 y cuerpo
HTML. Y el conector de Drive, aparte, corta en 10 MB.

**Regla.** El permiso se pide por archivo, y la verificación es por **Content-Type y por el
cuerpo**, nunca por el status.

**Vive en:** `docs/chats/chat-conocimientos-cursos-e8ba820e.md:3080-3084`

### El tope de Drive es POR ARCHIVO, y no hay forma de saltearlo

**Síntoma.** `Too many users have viewed or downloaded this file recently`. Se lee como
rate limit propio y se responde bajando concurrencia.

**Causa.** Es un límite **del archivo**, no de la IP ni de la cuenta, y se dispara en
archivos muy compartidos. Bajar concurrencia, reintentar y cambiar el flujo **ya se
probaron y fallaron**: 104 rechazos en una sola pasada. Solo se destraba con ~24 h.

**Regla.** Ante ese mensaje, la única acción correcta es **anotar el archivo y seguir con
los demás**. Un reintento agresivo acá es tiempo tirado.

### Una descarga automatizada no llega a `Downloads`

**Síntoma.** El archivo «no se descargó»: no está en `C:/Users/marti/Downloads` con el
nombre esperado.

**Causa.** Las descargas disparadas por un navegador automatizado quedan como archivo
`.tmp` en otra carpeta, con otro nombre.

**Regla.** Buscar por `.tmp` reciente ordenando por fecha de modificación, no por nombre.
Y si se usa la extensión del navegador a mano, **fijar la carpeta destino antes** de bajar
en lote: `Downloads` tiene 683 archivos y ahí se pierde cualquier cosa.

**Vive en:** `docs/chats/chat-conocimientos-cursos-e8ba820e.md:1481-1489`

### El pipeline de la corrida anterior se perdió por no estar versionado

**Síntoma.** El chat documenta con detalle un `scratchpad/sa-batch.mjs` que ya resolvía
todo esto —`download(id,dest)` con streaming a disco (`Readable.fromWeb` + `pipeline`),
manejo del interstitial, retry con esperas `[30,60,120,240]s`, upload multiparte,
`pollTranscript`, guardado a `mh-m6-tx/<id>.json`—. **No existe.** No hay carpeta
`scratchpad/`, ni `sa-batch*`, ni `mh-m6*`.

**Causa.** Vivía en `scratchpad/`, que no se versiona. Y su aprendizaje nunca se cosechó:
el grep de `drive|descarga|download` en `docs/hallazgos.md` daba **cero**.

**Regla.** Un script que resolvió un problema real **va a `scripts/`, versionado**, o su
diseño se cosecha acá el mismo día. Si el próximo intento arranca de cero, el costo no es
el código: son las cuatro trampas de arriba, redescubiertas de a una.

**Vive en:** `docs/chats/chat-conocimientos-cursos-e8ba820e.md:3658` (léelo antes de
reescribir nada) · patrones reusables ya versionados: `scripts/probe-video.mjs` (mide un
mp4 remoto con HEAD y cae a `Range: bytes=0-0` leyendo `content-range`),
`scripts/backfill-transcripts.ts` (backfill incremental sobre `lib/transcribe`),
`scripts/test-transcribe.mjs`

---

## Reusar la sesión del navegador: lo que NO funciona en esta máquina

Medido el **2026-08-11**. Todo esto es del entorno, no del código, así que caduca: si
alguien lo relee dentro de unos meses, verificar antes de actuar.

### `--cookies-from-browser chrome` no puede funcionar hoy en Windows

**Síntoma.** `Extracted 0 cookies from chrome (N could not be decrypted)`. No es un error:
es un `logger.info`, así que el comando «anda» y no baja nada.

**Causa.** Chrome escribe cookies **v20** (App-Bound Encryption) y `yt_dlp/cookies.py` solo
bifurca `v10` / DPAPI: no existe rama `v20` ni manejo de `app_bound_encrypted_key`. El
issue está **cerrado como pregunta**, no implementado.

**Regla.** El gate de ABE es por **user-data-dir**, no por perfil: los 10 perfiles del dir
por defecto están todos afectados. Un perfil lanzado con `--user-data-dir` no estándar
escribe `v10` y sí se descifra — pero es un perfil nuevo, o sea **volver a loguearse**.
Firefox no tiene ABE y funcionaría; en esta máquina **no hay Firefox instalado**.

### No se puede prender CDP en un Chrome que ya está corriendo

**Síntoma.** El plan dice «ya estoy logueado a mano, atacá esa sesión». No es realizable
como está escrito.

**Causa.** Dos, independientes, y cualquiera alcanza: (a) desde **Chrome 136**
`--remote-debugging-port` se **ignora** sobre el directorio de datos por defecto y exige un
`--user-data-dir` no estándar (documentado por Google); (b) el **singleton de Windows** se
detecta por una ventana de mensajes oculta asociada al user-data-dir, así que el segundo
proceso reenvía la línea de comandos y termina, **descartando los flags**.

⚠️ Y hoy hay **47 procesos de Chrome** vivos sobre ese directorio. Apuntar Playwright ahí
falla o abre pestañas en la instancia del usuario; habilitar CDP le cierra las 47 pestañas.

**Corolario que se refutó en la misma corrida:** excluir `Singleton*` al copiar un perfil
con robocopy es **folclore de Linux**. Esos archivos son POSIX; en Windows el singleton es
una ventana de mensajes. El `/XF` es inocuo pero el diagnóstico manda a mirar donde no es:
si un perfil copiado no arranca, mirá **procesos**, no archivos.

### El diagnóstico obvio era el equivocado: las cookies no hacían falta, y encima rompían la descarga

**Síntoma.** `ERROR: Could not copy Chrome cookie database` (issue 7271 de yt-dlp) en la
primera clase, con el perfil dedicado bien armado y la sesión abierta y válida.

**Causa.** Dos capas, y la segunda es la que importa:

1. El DB de cookies está **lockeado** mientras el Chrome dedicado corre. Y ese Chrome tiene
   que estar corriendo, porque es el que expone CDP para enumerar las clases.
2. Pero el hallazgo de fondo es que **las cookies nunca hicieron falta**. La privacidad
   «solo en estos dominios» de Vimeo se valida por el header **Referer**, no por sesión.
   Verificado: `yt-dlp <embed> --referer <dominio>` sin ninguna cookie lista los 12
   formatos hasta 1080p y baja perfecto.

**Lo que esto costó.** Todo el diseño previo giró alrededor de extraer cookies: el perfil
dedicado existe para esquivar App-Bound Encryption, y la sintaxis de
`--cookies-from-browser` con el subdirectorio se investigó y verificó en detalle. Nada de
eso era necesario para este caso, y el flag que iba a «asegurar» la autenticación era
**exactamente lo único que hacía fallar la descarga**.

**Regla.** Antes de construir alrededor de una credencial, **probá sin ella**. Un
`-F` (listar formatos) cuesta 3 segundos y dice si la autenticación hace falta. Vale para
cualquier recurso embebido: primero Referer, después Origin, y solo al final cookies.

⚠️ El perfil dedicado **sigue siendo necesario** — pero por CDP (Chrome 136+ no depura el
directorio por defecto), no por las cookies. Dos motivos distintos para la misma pieza, y
solo uno resultó real.

**Vive en:** `scripts/curso-bajar.mjs` (el flag `--cookies`, apagado por default)

### Lo que sí está instalado y corre dentro de la sesión legítima

`Profile 1` (Martin) ya tiene **Video Download Helper** y **FetchV** (m3u8/HLS), con el
CoApp real en `C:/Program Files/DownloadHelper CoApp/` (que trae su propio ffmpeg y
ffprobe, y es lo que le permite remuxar a mp4). Corren **dentro** del perfil logueado, así
que no hay que extraer cookies ni relanzar nada — que es justo lo que las dos entradas de
arriba vuelven imposible.

**Del lado del código no hay nada:** `yt-dlp`, `youtube-dl`, `streamlink`, `aria2c`,
`N_m3u8DL-RE` y `whisper` no existen ni en PATH ni en disco; el npm global está vacío; y
Python tiene 4 paquetes (pillow, pip, pymupdf, pypdf) — es un entorno de PDF, no de media.
Hay un Chromium de Playwright en `ms-playwright/chromium-1234` **huérfano**: el binario
está, el paquete que lo maneja no.

### Tres falsos negativos del entorno Windows

Los tres hacen concluir «no está instalado» cuando sí está:

1. **`Get-Command curl` devuelve vacío** y el binario existe en
   `C:/Windows/System32/curl.exe` (8.21.0). Lo mismo con **ffmpeg**: no está en PATH pero
   hay 3 builds en disco.
2. **`Get-ChildItem -Recurse -Include "x.exe"` sin `-File` devuelve DIRECTORIOS** que
   matchean el nombre y oculta los archivos. Una primera pasada «no encontró» ffmpeg y
   había 8. Usar `-File -Filter`.
3. **El repo vive en OneDrive.** Bajar archivos grandes dentro del árbol del proyecto los
   mete en la cola de sincronización. Cualquier descarga cruda va al scratchpad de sesión o
   fuera de OneDrive.

---

## Subir a Drive y traer el videoId

### ⚠️ Drive te da un id ANTES de subir el archivo, y no es el id que sirve

**Síntoma.** El script reportó **«20/20 clases con videoId de Drive»** y escribió un
`drive.json` completo. Cero archivos estaban subidos.

**Causa.** Drive for Desktop crea la fila en su `metadata_sqlite_db` en cuanto el archivo
aparece en `G:`, con un id **placeholder** de la forma `local-46973` y `file_size = 0`. El
id de verdad —25+ caracteres alfanuméricos, como `1mSs6d7ROi7AJyjXqMQ93MwmQx-dfuOrl`—
aparece recién cuando el archivo existe del lado del servidor. El polling tomaba
«¿hay id?» como «ya está arriba», que son dos preguntas distintas.

**Por qué es peor de lo que parece.** `DRIVE_PREVIEW('local-46973')` no tira error: pinta
un iframe muerto. Y el fallo se presentó como **éxito**, o sea el modo de falla más caro:
nadie va a revisar un 20/20.

**Regla.** El id se valida por FORMA, explícitamente, y la validación no se deriva de
otra condición: `!id.startsWith('local-') && /^[A-Za-z0-9_-]{20,}$/.test(id)`. Y se
distingue en el reporte «Drive todavía no lo vio» de «lo registró y está subiendo»: el
segundo es progreso.

**El casi-accidente, que es la parte que hay que recordar.** La guarda de `--liberar`
(borrar el local con la subida confirmada) **no borró nada**, pero no por la condición del
id: se salvó porque además exigía `file_size == tamaño local`, y el placeholder trae 0. O
sea que una guarda de cuatro condiciones se sostuvo por una sola. Si esa cuarta no hubiera
estado, se borraban 2,2 GB de descargas buenas creyendo que estaban a salvo en la nube.
**Una guarda destructiva no se apoya en que alguna de sus condiciones tape a las otras:
cada una se escribe explícita, aunque parezca redundante.**

**Vive en:** `scripts/curso-a-drive.mjs` (`esIdReal`)

### `npx tsx` compila a CJS: un `await` de nivel superior explota en ejecución

**Síntoma.** `ERROR: Top-level await is currently not supported with the "cjs" output
format`, con el typecheck del pre-push **en verde**.

**Causa.** El error es de **transform** (esbuild), no de tipos. `tsc --noEmit` no lo ve
porque el `await` de nivel superior es TypeScript válido; lo rechaza el compilador de tsx
al emitir CJS.

**Regla.** Todo script de `scripts/*.ts` que use `await` envuelve su cuerpo en
`async function main()` y cierra con `main().catch(...)`. Ya estaba resuelto así en
`scripts/backfill-transcripts.ts` — el patrón existía y no lo copié.

**Y la lección general:** el pre-push verde **no** significa que un script corra. Los
scripts no se ejecutan en el typecheck. Un script nuevo se prueba corriéndolo, aunque sea
con un caso de uno.

**Vive en:** `scripts/curso-transcribir.ts` · el patrón: `scripts/backfill-transcripts.ts:29`

### Un fetch anónimo a `/conocimientos` NO prueba que un curso falte

**Síntoma.** Se cablea un curso nuevo, se pega `curl http://localhost:3000/conocimientos`,
vuelve **HTTP 200** y el curso no está en el HTML. Conclusión tentadora: el cableado
está roto.

**Causa.** La ruta está detrás del gate de sesión, y en local también —`AUTH_SECRET` está
en `.env.local`, así que `gateConfigurado()` es true y el middleware corta. El 200 es la
pantalla de login, no el portal.

**La comprobación que lo desarma en un segundo:** grepear el HTML por un curso que YA
existía. Si **AVATARHYPE tampoco aparece**, no falta tu curso: falta la sesión. Es el mismo
principio que ya está escrito para los 401 en `hallazgos-infra.md` — hay que mirar QUÉ
contestó, no el status.

**Regla.** Para verificar el portal hace falta sesión: navegador logueado, o
`?curso=<slug>` con la cookie puesta. Un `curl` pelado da un falso negativo, y el modo de
falla es el caro: manda a «arreglar» algo que estaba bien.

**Vive en:** `app/conocimientos/Conocimientos.tsx` · el gate: `lib/rutas-publicas.ts`

### `duration: "00:00"` en la API significa «el video no existe», y avisa ANTES de fallar

**Síntoma.** 461 líneas de `ERROR` en el log del descargador, con `HTTP Error 410:
Gone` reintentando fragmentos una y otra vez. Leído por encima, parece que el
descargador está roto o que las URLs firmadas de Vimeo caducan.

**Causa.** De 249 clases, exactamente **2 fallaban**, y eran exactamente las 2 que el
RPC de la plataforma reportaba con `duration: "00:00"`. Probadas sueltas:
`HTTP Error 404: Not Found` en Vimeo. Los videos no existen — borrados o nunca
subidos. El 410 en fragmentos era un síntoma derivado, no la causa.

**Lo que costó.** Nada de contenido (247 de 249 bajaron bien), pero cada una de esas 2
gastó **10 reintentos × ~300 fragmentos** antes de rendirse, y llenó el log de errores
que después hacen dudar de todo lo demás. El diagnóstico obvio —«caducan las URLs
firmadas»— manda a tocar timeouts y reintentos, que es exactamente lo que no era.

**Regla.** El plan marca `sinFuente: true` cuando la duración es cero o falta el
`video_id`, y el descargador **las saltea** con un aviso explícito (`--incluir-vacias`
para forzar). La metadata de la fuente ya sabía que iban a fallar: leerla es gratis y
reintentar no.

**Y el corolario general:** cuando un lote falla, contá **cuántos** fallaron antes de
mirar *por qué*. 2 de 249 es un dato de la fuente; 249 de 249 es un bug propio. El
número dice dónde buscar, y se saca en un minuto contando huecos contra el plan.

**Vive en:** `scripts/curso-plan-vip.mjs` (`sinFuente`) · `scripts/curso-bajar.mjs`

### El log de un proceso largo necesita hora LOCAL, o se lee un problema que no existe

**Síntoma.** En el log de la cola aparecen dos rondas consecutivas separadas por
**5 horas y 40 minutos**. Conclusión inmediata y equivocada: «la descarga se colgó».

**Causa.** Dos cosas a la vez, y ninguna era una falla: la máquina estuvo **dormida**
de madrugada, y los timestamps del log salían de `toISOString()` — o sea **UTC**,
mientras todo lo demás que se mira (procesos, archivos) está en hora local. Con
UTC−3, `06:46` del log eran las `03:46` reales. El hueco era el sueño de la máquina.

**Regla.** Un proceso que corre horas escribe hora **local** en cada línea, y su
duración total no se estima por reloj de pared: la máquina se duerme. Para saber si
algo sigue vivo se mira el **proceso**, no el último timestamp del log.

**Vive en:** `scripts/curso-pipeline.mjs`

### El nombre de la carpeta en Drive lleva el AUTOR, y la API no lo trae

**Síntoma.** La carpeta del curso quedó `Aumenta tu valor y ATV ADVANTAGE`, y
desentonaba con todas las demás. El dueño lo marcó.

**Causa.** La convención de `MARKETING KONCEPT\CURSOS` es **`<Curso> - <Autor>`**, y la
cumplen **36 de 39** carpetas (33 con guión normal, 3 con guión largo; las 3 sin
separador son dos históricas y la que generamos nosotros). Pero el RPC
`get_vip_lessons_secure` **no trae el autor**: `vip_courses` tiene `id`, `title`,
`slug` y `description` (vacío). El autor solo aparece en la tarjeta del catálogo.

**Regla.** El autor entra por `--autor` en `curso-plan-vip.mjs` y viaja en el
`plan.json`; `curso-a-drive.mjs` arma `<Curso> - <Autor>`. Y si falta, **los dos
scripts avisan fuerte** en vez de generar la carpeta a medias en silencio — que es
exactamente lo que pasó. Separador: guión normal, el de los 33.

Renombrar la carpeta ya subida es seguro y **no re-sube nada**: Drive lo trata como
cambio de metadata, y `curso-a-drive.mjs` reconoció los 194 archivos ya presentes en
la carpeta nueva (medido).

**Vive en:** `scripts/curso-plan-vip.mjs` (`--autor`) · `scripts/curso-a-drive.mjs`

### `Set-Content -Encoding utf8` de PowerShell 5.1 escribe BOM, y Node no lo tolera

**Síntoma.** Después de agregar un campo al `plan.json` desde PowerShell, todos los
scripts murieron con `SyntaxError: Unexpected token '﻿', "﻿{ "c"... is not valid JSON`.

**Causa.** En **PowerShell 5.1**, `-Encoding utf8` significa UTF-8 **con BOM**. El
`JSON.parse` de Node no acepta el BOM. Dos archivos quedaron rotos de una sola
edición aparentemente inocua. Ya está avisado en las notas del entorno
(«`Set-Content`/`Add-Content` defaultean al codepage ANSI, pasá `-Encoding utf8`
explícito») — el detalle que faltaba es que ese `utf8` explícito **agrega BOM**.

**Regla.** Para escribir JSON que Node va a leer, **escribilo con Node**
(`JSON.stringify` + `writeFileSync`), no con PowerShell. Y los lectores se defienden
igual: los nueve `JSON.parse(readFileSync(...))` de `scripts/curso-*` llevan
`.replace(/^﻿/, '')`, porque el BOM va a volver.

**Vive en:** los nueve `JSON.parse` de `scripts/curso-*.mjs`

### Los cursos de `/vip/` tienen 71 recursos que el plan no bajaba, y nada lo avisaba

**Síntoma.** El curso quedó «completo» con 247 videos y **cero PDFs**. Ninguna señal.

**Causa.** `curso-plan-vip.mjs` saca las lecciones del RPC `get_vip_lessons_secure` y
deja `pdfs: []`. Pero el material de apoyo vive en otros dos endpoints, y hacen falta
los **dos**: `vip_course_resources` (título, módulo, `file_type`, `file_size`) y
`rpc/get_vip_resource_urls` (la URL **firmada** de cada archivo). Se juntan por `id`.
En ATV Advantage son **71 archivos** (47 pdf, 9 link, 6 xlsx, 2 docx).

**Regla.** `scripts/curso-recursos-vip.mjs`. Las URLs firmadas no piden sesión pero
**caducan**, así que se capturan y se usan en la misma corrida.

### ⚠️ Tercera vez que un contador miente: 71 «bajados» y 64 archivos en disco

**Síntoma.** `71 bajado(s) · 0 con error`. En disco había **64**.

**Causa.** Los títulos de los recursos **no son únicos**: 7 recursos distintos se
llaman «Miro» dentro del mismo módulo. El nombre de archivo se armaba con
`<módulo> - <título>.<ext>`, así que los 7 escribieron sobre el mismo archivo. El
contador sumaba **intentos**, no resultados, y el error se presentó como éxito.

**Regla, y ya van tres del mismo molde** (el id placeholder de Drive, el «20/20 OK»
sin archivos arriba, y este): **un contador que suma dentro del bucle no es una
verificación.** El resumen se calcula contra el destino real —`readdirSync` del
directorio— y si no coincide con lo esperado, se dice en el propio resumen.

Y la mitad que hace falta igual: el nombre se hace único de forma **determinista**
(`sort_order` y, si aún choca, los 6 primeros del `id`), no con un contador de
iteración. Si no, la segunda corrida genera otros nombres y el «ya estaba» deja de
funcionar: se re-baja todo y se duplica.

**Vive en:** `scripts/curso-recursos-vip.mjs` (`nombreUnico`, y el conteo contra disco)

### Las 2 clases que faltan de ATV no se pueden bajar, y la fuente lo dice de tres formas

**Pregunta que aparece sola:** ¿quedó el curso incompleto por culpa del método?

**No.** Las clases 78 y 125 (de 249) apuntan a videos de Vimeo que **no existen**, y
la propia plataforma lo declara:

1. `duration: "00:00"` en su base — su ingesta nunca tuvo un video con duración.
2. `player.vimeo.com/video/<id>` → **HTTP 404**, que es la MISMA URL que embebe su
   iframe. No es un problema de nuestra ruta.
3. Un 404 **no** es un fallo de permisos: los otros 247 dieron 200 con el mismo
   Referer y sin cookies. Si fuera acceso, serían 401/403.

Los registros son estructuralmente idénticos a los sanos (mismo curso, módulo válido,
`is_free: false`): es una **referencia rota en la base de la plataforma**.

**Regla.** No se reintenta lo que la fuente declara vacío, y la clase igual entra al
portal: `Clase.videoId` acepta `null`, así que queda con su título y el espacio de
apuntes. Lo único que destraba esas dos es que la plataforma re-suba el video.

⚠️ Y el contraste que importa: la clase **193** falló en la misma corrida y **sí** se
recuperó reintentando (33:39, resuelve m3u8 y MPD). Duración cero = muerta;
duración real que falla = transitoria. La metadata distingue los dos casos.

### La guarda que protegía de leer a medio bajar salteaba 3 clases terminadas, en silencio

**Síntoma.** 247 videos en disco y solo 244 audios. Nada falló, nada se reportó. La
única pista era una línea del propio script: «salteo 3 archivo/s».

**Dos causas distintas, y las dos son de la guarda, no de los datos:**

**1. Un temporal viejo bloquea un archivo terminado para siempre.** Del primer intento
fallido de la clase 193 quedó un `193 - … .fhls-fastly_skyfire-1278.mp4.part-Frag293.part`
de 170 KB. La guarda derivaba de ahí el prefijo de la clase y descartaba su `.mp4`
**completo, de 265 MB**, como «sigue bajando». El `.part` era basura de un intento
anterior, no una descarga en curso — y esa distinción no existía en el código.

**2. La allowlist por NOMBRE COMPLETO era un salteo silencioso.** Comparar el nombre
entero contra el `archivo` del plan parecía lo más estricto. Pero el descargador no
siempre produce exactamente ese nombre: el plan decía
`212 - 1. No pares de hacer $$$` y en disco quedó `… hacer $$` — **un `$` menos**. Las
clases 212 y 215 se descartaron sin una línea de aviso.

**Regla.** La clave es el **número de clase** (`^(\d{1,3}) - `), que es lo que usa todo
el pipeline aguas abajo, no el nombre completo. Y «en curso» se define contra las
clases que **no** tienen todavía su archivo final: si el final existe, cualquier
temporal de esa clase es basura y se ignora.

**Y la regla general, que es la que más ahorra:** una guarda que descarta **dice qué
descartó y por qué**. Las tres versiones anteriores contaban los salteos en un número
—«salteo 3 archivo/s»— y ese número no alcanza para notar que está mal. Ahora imprime
el archivo y el motivo, uno por línea.

**Vive en:** `scripts/curso-audio.mjs` (el bloque de `descartes`)

### ⚠️ `.temp.mp4` es el intermedio que MÁS engaña, y faltaba en `esIntermedio`

**2026-08-16, «Trilogía de BRIAN TRACY».** La clase 11 (Seminario Fénix) viene en pistas
separadas: yt-dlp bajó **4,6 GB de video** y **955 MB de audio** y se puso a unirlos en
`11 - … .temp.mp4`. Ese archivo **crece hasta pesar casi lo mismo que el final y tiene la
extensión del final**, así que no se parece en nada a un temporal — a diferencia de un
`.part` o de un `.fhls-….mp4`, que se delatan solos.

`esIntermedio` no lo conocía, y el mismo agujero pegó en dos lugares a la vez:

- **`curso-audio.mjs`** intentó convertir el merge a medio hacer → `✖ 11 - Seminario
  Fénix… .temp`. Justo la guarda cuyo trabajo es «no tocar un video a medio bajar».
- **`curso-pipeline.mjs`** lo contó como clase terminada: **11/11**, anunció *«sin
  progreso 12 rondas y la descarga ya terminó»* y se fue — con ffmpeg escribiendo a
  **253 MB cada 15 s**. Quedó una clase sin audio y sin transcribir.

**Es la misma trampa que la de «100M money Models», por el otro lado.** Allá un contador
QUIETO se leyó como «el descargador murió»; acá uno de MÁS se leyó como «ya terminó». Las
dos veces la conclusión fue *abandonar*, y las dos veces el proceso estaba sano.

**La regla:** qué es un intermedio lo decide **`esIntermedio` y nada más**. El contador
del pipeline tenía su propia copia del regex (`!/\.f[^.]*\.mp4$/`) — la tercera copia de
esta función, después de las tres que motivaron crear `curso-comun.mjs`. Ahora lo importa.
Y el corolario: **el peso de un archivo no dice que esté terminado.** Un merge al 90% pesa
un 90%, y con la extensión definitiva.

**Vive en:** `scripts/curso-comun.mjs` (`esIntermedio`) · `scripts/curso-pipeline.mjs`
(`bajados`)

### ⚠️ Copiar un directorio que otro proceso escribe deja basura PERMANENTE en el destino

**Síntoma.** En la carpeta del curso en Drive aparecieron 3 archivos de más, 500 MB en
total, con nombres tipo `193 - M1 - Cap 1.fhls-fastly_skyfire-1278.mp4` **al lado** del
`193 - M1 - Cap 1.mp4` correcto. Son intermedios de yt-dlp: tienen solo la pista de
**video**, sin audio.

**Causa, dos capas.** La copia incremental (`--solo-copiar`, que corre en paralelo con
la descarga a propósito) capturó archivos **transitorios** del descargador. Después
yt-dlp los mergeó y los borró **en local** — pero las copias del destino
**sobrevivieron**. El origen se limpia solo; el destino no.

Y lo que decidió *cuál* se copiaba: `readdirSync(...).filter(f => f.startsWith(c.archivo))`
tomando `cand[0]`. Alfabéticamente `.fhls-…mp4` **gana** a `.mp4`, así que para esas
tres clases se subió el intermedio *además* del bueno.

**El mismo desajuste de nombre, otra vez.** `startsWith(c.archivo)` también **falló** con
las clases 212 y 215, cuyo archivo real quedó `… hacer $$` contra el `… hacer $$$` del
plan: no se copiaron a Drive durante toda la corrida, en silencio. Es el mismo bug que
ya había salteado su audio — **la misma causa raíz, en dos scripts distintos**.

**Regla.** El archivo de una clase se busca **por número** (`^(\d{1,3}) - `) y
excluyendo intermedios (`\.f[^.]*\.(mp4|…)$`). Y el filtro tiene que estar en **los dos**
scripts que leen `video/` — `curso-audio.mjs` y `curso-a-drive.mjs`. Ponerlo en uno solo
fue exactamente lo que pasó, y el segundo tardó mucho más en aparecer porque su síntoma
vive en Drive y no en disco.

**Vive en:** `scripts/curso-a-drive.mjs` (`videoDeClase`) · `scripts/curso-audio.mjs`

### ⚠️ Un m4a interrumpido queda con nombre final y es ILEGIBLE: el `moov atom` va al final

**Síntoma.** La clase 196 tenía su `.m4a` de 2,8 MB, con el nombre correcto, y ScreenApp
lo aceptaba con HTTP 200 — pero la transcripción **nunca llegaba**. Re-subirla no
cambió nada.

**Causa.** El archivo estaba **corrupto**: `ffprobe` dice `moov atom not found` ·
`Invalid data found`. En un MP4/M4A el `moov atom` (el índice) se escribe **al final**,
así que un ffmpeg muerto a mitad deja un archivo de tamaño creíble, con el nombre
definitivo, y sin nada decodificable. Acá lo mató el corte del loop con `TaskStop`.

**Por qué sobrevivió tanto:** el script salteaba «lo que ya existe», y el archivo
existía. ScreenApp no da error porque recibe bytes válidos *como archivo*. Los dos
extremos daban verde y en el medio no había audio.

**Regla, y aplica a cualquier salida de un proceso externo:** se escribe a un
**`.parcial`**, se **verifica que decodifique** (`ffmpeg -v error -i x -f null -`), y
recién entonces se renombra al nombre final. Un corte deja un `.parcial` que el filtro
de entrada no mira, en vez de un `.m4a` mentiroso.

Y la otra mitad, para lo que ya está en disco: **«existe» no es «está bien»**. Al
saltear un archivo previo se valida; si no decodifica, se rehace. Sin eso, un archivo
envenenado de una corrida vieja no se arregla nunca solo.

**Vive en:** `scripts/curso-audio.mjs` (`valido`, `PARCIAL`)

### ScreenApp puede aceptar un archivo y no transcribirlo nunca, sin error

**Síntoma.** La clase 196 tenía audio y `fileId`, y `GET /files/{id}` devolvía **HTTP
200** — con `transcript` ausente y `jobs` **vacío**. Ni error, ni estado «procesando».

**Regla.** El `fileId` persistido en `sa-fileids.json` es lo que hace reanudable la
transcripción, pero también **fija un upload que quedó colgado**: mientras el id esté
ahí, el script poletea para siempre un archivo que nunca va a tener transcripción. Se
destraba borrando esa entrada del mapa para forzar un upload nuevo.

Lo que falta y conviene: si un `fileId` lleva más de N minutos con `jobs` vacío,
tratarlo como colgado y re-subir solo, en vez de esperar a que alguien lo note.

**Vive en:** `scripts/curso-transcribir-sa.mjs` (`esperar`) · el mapa: `sa-fileids.json`

### Al pasar a subcarpetas, todo lo que mira el NOMBRE tiene que mirar el basename

**Síntoma.** Se organizó el curso local en `video/<NN Módulo>/` y el paso de audio
descartó **los 247 videos**, uno por uno, con «sin número de clase al principio».

**Causa.** El listado pasó a devolver rutas **relativas**
(`01 1. START HERE\001 - ….mp4`), y el regex de la clave (`^(\d{1,3}) - `) se seguía
aplicando a la ruta completa: el número dejó de estar al principio. Lo mismo valía para
la detección de intermedios.

**Regla.** Cuando un listado devuelve rutas relativas, **la ruta sirve para abrir el
archivo y el `basename` para decidir sobre él**. Todo predicado sobre el nombre —clave,
extensión, intermedio— va sobre `basename(f)`.

**Lo que hizo que apareciera en un segundo, y es el punto:** la regla de la entrada
anterior («una guarda que descarta dice qué descartó y por qué») estaba puesta. El
script imprimió las 247 líneas con el motivo exacto. La versión que solo contaba
—«salteo 247 archivo/s»— habría mandado a buscar el problema a los datos.

**Vive en:** `scripts/curso-audio.mjs` · el layout: `scripts/curso-organizar.mjs`

### Un recurso de tipo `link` no es un archivo: bajarlo te da el HTML de la landing

**Síntoma.** Entre los 71 recursos de un curso de `/vip/` había 16 «archivos» `.link`
de 98 KB cada uno, y uno de **1,1 MB**. Todos con nombres como `Miro`, `YouTube`,
`Loom`.

**Causa.** La plataforma marca esos recursos con `file_type: 'link'`, y su `file_url`
**es la URL de destino**, no un archivo firmado. El descargador la trataba igual que a
un PDF: le hacía `fetch` y guardaba **el HTML de la página de Miro** como si fuera el
recurso. El de 1,1 MB era el HTML de YouTube.

**Regla.** Si `file_type === 'link'`, lo que se guarda es la **URL** — no se descarga
nada. Y en el portal se emite como `tipo: 'bank'` con un `item`, que es el único tipo
que renderiza un link **externo** clickeable: `notion` pondría un botón «Ver en Notion»
sobre un tablero de Miro, y `pdf` abriría un visor de Drive que para un link no existe.

⚠️ Y el conteo: los enlaces **no son archivos**, así que se descuentan del total
esperado en disco. Sin eso el verificador dice «faltan 16» sobre un curso completo —
un falso negativo que hace desconfiar de todo el resto.

**Vive en:** `scripts/curso-recursos-vip.mjs` · `scripts/curso-a-portal.mjs`

### El vínculo recurso ↔ clase existe, pero pasa por el MÓDULO

**Síntoma.** Los recursos aparecían en la sección del curso y no en ninguna clase.

**Causa.** La plataforma asocia cada recurso a un **módulo** (`vip_module_id`), nunca a
una lección. El pipeline no arrastraba ese dato: `recursos.json` guardaba el título del
módulo raíz y se perdía ahí.

**Regla.** Se arrastra el módulo **hoja** además del raíz, y el recurso se cuelga de
**todas las clases de su módulo**, prefiriendo la hoja: el material de «1. Setting» va
a sus 25 clases, no a las 38 del raíz «6. SALES». Medido: 64 de 71 recursos quedaron
colgados, y 91 clases con material propio.

Lo que **no** se hace es adivinar *una* clase dentro del módulo. El dato no existe, y
un recurso puesto en la clase equivocada es peor que uno a nivel de módulo.

**Vive en:** `scripts/curso-a-portal.mjs` (`construirRecursos`)

### `slice(-2,-1)` sobre una URL: funcionó de casualidad y puso la portada de otro curso

**Síntoma.** La tarjeta del curso de Claude mostraba la portada de «Hackeando la
Edición — Guille Collado». Dos intentos seguidos con la portada equivocada.

**Causa.** El slug de la plataforma se sacaba con
`pagina.split('/').filter(Boolean).slice(-2,-1)[0]` — el **penúltimo** segmento. Para
el patrón VIP `/vip/course/<slug>/watch` eso da el slug y funcionaba; para
`/curso/<slug>` da literalmente **`curso`**, que aparece en el href de **todas** las
tarjetas del catálogo. El emparejamiento por `href.includes('curso')` matcheaba las
152 y la heurística de frecuencia elegía cualquiera.

**Lo que lo hizo durar dos intentos:** el script instalaba y reportaba «✓ 25 KB · jpg»
sin comprobar **de qué** era la imagen. Un tamaño y una extensión no dicen nada sobre
el contenido, y una portada equivocada no se nota hasta que alguien la mira.

**Regla, dos capas.** El slug sale del **último** segmento útil, filtrando `curso`,
`course`, `vip`, `watch` y el host — no de una posición fija, que es una suposición
sobre la forma de la URL. Y antes de instalar se **verifica**: el texto de la tarjeta
elegida tiene que mencionar palabras del título del curso, o no se instala nada.

**Y la que vale para cualquier archivo que se baje «del que corresponde»:** emparejar
por URL y no comprobar el contenido es confiar en la parte del sistema que justo se
está tocando. Acá alcanzaba con **mirar la imagen** — que es lo que finalmente la
confirmó (`Read` sobre el archivo), y lo que no se hizo las dos primeras veces.

**Vive en:** `scripts/curso-portada.mjs`

### Dos trampas de Windows al reorganizar en carpetas, y las dos dicen «EPERM»

Aparecieron juntas al organizar el segundo curso, y el mensaje de error apunta al
lugar equivocado en las dos.

**1. Renombrar el DIRECTORIO falla aunque nada lo tenga como cwd.** `renameSync` sobre
la raíz del curso daba `EPERM: operation not permitted`, con cero procesos de node o
python referenciándola. Lo agarran **Drive for Desktop**, el indexador o el antivirus,
y no hay a quién esperar.

**La salida:** mover los **hijos**. El lock es del handle del directorio, no de su
contenido — se crea el destino, se mueve cada entrada y se borra el cascarón. Y si el
cascarón tampoco se puede borrar, se avisa en vez de fallar: queda una carpeta vacía,
que es inofensivo.

**2. `copyFileSync` sobre una carpeta también dice `EPERM`.** El copiado de material a
Drive trataba cada entrada de `texto/` como archivo, y después de organizar hay
**subcarpetas de módulo**. El error no dice «es un directorio»: dice «operation not
permitted», que manda a revisar permisos de Drive durante un rato.

**Regla.** Cualquier bucle que copie el contenido de un directorio usa
`readdirSync(d, { withFileTypes: true })` y decide por `isDirectory()`. Y ante un
`EPERM` en una operación de archivos, **la primera pregunta es «¿esto es un
directorio?»**, no «¿tengo permisos?».

**Vive en:** `scripts/curso-organizar.mjs` (el fallback del rename) ·
`scripts/curso-a-drive.mjs` (el copiado de material)

### ⚠️ `G:` no reporta la cuota de Drive: reporta el disco físico

**2026-08-14.** Antes de bajar PROGRAMA RAIO (201 clases, 54,4 h) se midió el espacio y
`Get-PSDrive G` dijo **22,2 GB libres**. Leído como cuota de Google Drive, la conclusión
era «no entra, hay que comprar más almacenamiento» — una decisión de plata, tomada sobre
un dato que no era el que parecía.

**La pista que lo desarma: `C:` y `G:` reportaban el MISMO total, 454,1 GB.** `G:` es un
montaje virtual de Drive for Desktop y espeja las cifras del volumen que lo hospeda, así
que su «libre» es el libre de `C:` y **la cuota real de Drive no se puede leer desde acá**.
Dos números idénticos en dos unidades que no tienen por qué parecerse es la señal.

Es el caso de [AGENTS.md → «Un total solo se puede sumar si el recurso se puede MOVER DE
LUGAR»](../AGENTS.md) visto del otro lado: ahí el error era sumar tanques que no se
trasvasan; acá es **contar dos veces el mismo tanque** porque dos etiquetas distintas lo
nombran. La regla común: antes de leer un total, preguntá **de qué es**.

**La regla que queda:** el espacio que gobierna la descarga es el de `C:` —ahí se baja, se
mergea y se extrae el audio—, y se mide con `C:`. Para la cuota de Drive no hay lectura
local: se mira en `drive.google.com/settings/storage`.

**Y el corolario que resolvió el freno:** `C:\cursos\<curso>\video\` es material
**intermedio**. La copia que vale —y la que reproduce el portal— es la de Drive. Al medir,
114 GB locales tenían **108,4 GB ya subidos**, y liberarlos dejó el disco en 131,8 GB sin
tocar nada del pipeline (`plan.json`, `audio/` y `texto/` se conservan). Conviene hacerlo
al cerrar cada curso en vez de acumular.

⚠️ **La verificación es por TAMAÑO EXACTO archivo por archivo, nunca por conteo.** Es la
misma trampa que ya costó cuatro diagnósticos en este documento: `ls | wc -l` contaba
`.part` como clases. Y la carpeta local **no siempre se llama igual** que la de Drive
(`vender-por-fb-e-ig-ads` → `ADS - Felipe Vergara`), así que el matcheo elige la carpeta
de Drive que más archivos cubre y **exige cubrirlos todos**: si falta uno, ese curso se
saltea entero y se reporta. Se borra permanente y no a la papelera a propósito — la
papelera no libera el disco, que es lo único que hacía falta.

**Vive en:** `scripts/curso-bajar.mjs` (el destino) · `scripts/curso-a-drive.mjs` (la
copia buena)

#### ⚠️ Proyectar el peso de un curso: la métrica importa, y la MUESTRA importa más

«Instituto de Comunicación», 158 clases y 206,5 h. Tres proyecciones del mismo curso, en
orden cronológico:

| momento | método | proyección |
|---|---|---|
| 9 clases bajadas | GB ÷ clases × 158 | **26 GB** |
| 9 clases bajadas | GB ÷ horas × 206,5 | **173 GB** |
| 98 clases bajadas | GB ÷ horas × 206,5 | **97 GB** ← el real |

**Las dos primeras están mal, y por razones distintas.** Vale la pena separarlas porque la
segunda se escribió acá como «la buena» y no lo era.

**1. La métrica.** Un promedio por ítem sobre una población que va de 1 minuto a 3h49 no
proyecta nada: las 9 primeras son intros de la Fase 0 (12 min) y el curso entero promedia
78 min, porque más de la mitad son directos. Hay que proyectar sobre la magnitud que
EXPLICA el costo —la duración, que es lo que el bitrate multiplica—, no sobre la que es más
fácil de contar. Eso llevó de 26 GB a 173.

**2. La muestra.** Pero 173 también erró, ×1,8 de más, porque midió `0,836 GB/h` sobre esas
mismas 9 intros. Con 98 clases la tasa real es **`0,469 GB/h`**: un directo de cámara fija
pesa por hora la mitad que una lección producida con cortes y gráfica. **Arreglar la
métrica no arregla la muestra** — las primeras N de un curso ordenado por módulo nunca son
representativas, ni en duración ni en bitrate.

**La regla, entonces, es de dos partes:** proyectar por la magnitud que explica el costo, y
**volver a medir cuando la muestra crece**. Una proyección hecha con el 6% del curso es una
hipótesis; con el 62%, un dato. Re-medir cuesta un script de diez líneas y acá cambió la
decisión: con 173 GB había que subir y liberar por tandas contra reloj, con 97 GB entraba
entero en el disco y no hacía falta tocar nada.

**Y el corolario sobre el sesgo, que es lo que engaña:** de las dos primeras, la que da el
número TRANQUILIZADOR era la peor (26 GB entran cómodos en 115 libres). Cuando dos métodos
difieran, el sospechoso es el que te deja seguir sin hacer nada — pero eso no convierte al
alarmista en correcto, que es exactamente el error que se cometió acá al escribir 173 como
verdad. **Ninguno de los dos es un dato hasta que la muestra lo sostiene.**

**El plan que salió de eso, y ya estaba escrito en la herramienta:** `curso-a-drive.mjs`
tiene `--min-libre-gb`, que sube y libera por tandas con cuatro condiciones en positivo —
dentro de `video/`, id real de Drive, copia en `G:` idéntica en bytes, y **Drive reportando
ese mismo tamaño**. Esa última es la que importa: un archivo copiado a `G:` todavía no está
subido, y borrarlo ahí lo pierde. El umbral de disparo va más alto que el de liberado, para
empezar con margen: copiar a `G:` es instantáneo y la subida real tarda.

## Los descargables de una clase

### ⚠️ «No apareció ningún PDF» era un ZIP: el formato es un HECHO del archivo, no una suposición del script

**2026-08-13, «Inteligencia Viral 2026».** `curso-pdfs.mjs` informó `0/3 PDF(s)` con el
mensaje «no apareció ningún PDF en 25s». Los tres archivos **estaban pasando por la red**
en ese mismo momento: eran `application/zip` servidos desde un bucket R2. El curso habría
quedado publicado con `recursos: []` y nada lo habría avisado.

El script cableaba PDF en **tres lugares distintos**, y cada uno descartaba en silencio:

| Dónde | Qué asumía |
|---|---|
| El filtro de red | `application/pdf\|octet-stream` |
| El nombre del archivo | `.pdf`, puesto **antes** de saber qué llegaba |
| La validación | primeros bytes `=== '%PDF-'` |

**La regla que queda:** la extensión sale del `Content-Disposition` → mime → URL, **en ese
orden y recién cuando el archivo llegó** (la URL es lo menos confiable: las de R2 terminan
en un id sin extensión). Se valida por FAMILIA (`PK` para zip/docx/xlsx, `%PDF-` para pdf,
y para lo desconocido solo se rechaza HTML disfrazado de 200). Y el nombre se arma sin
extensión hasta que hay un hecho que la determine.

**Y lo que hace la diferencia entre perder una hora y perder tres:** un descarte silencioso
es indistinguible de «no había nada». Ahora imprime **qué** vio y **por qué** lo tiró
(`descartado: application/zip 0B → no valida como .zip`) — ese renglón fue el que señaló el
problema siguiente en un minuto.

### CDP devuelve el cuerpo VACÍO para lo que Chrome trata como descarga, y no falla

Con el filtro ya arreglado, los tres seguían sin bajar: `Network.getResponseBody` devolvía
**0 bytes sin error**. Es la limitación de siempre — el renderer no retiene en el buffer lo
que va a disco como descarga.

La salida no es pelearse con CDP: **la sesión hacía falta para AVERIGUAR la URL, no para
leerla.** El bucket (`pub-*.r2.dev`) es público, así que con la URL ya resuelta alcanza un
`fetch` pelado. Quedan los dos caminos, en orden: cuerpo por CDP y, si viene vacío,
descarga directa de la URL con el `referer` y el `user-agent` del plan. Mismo patrón que ya
había ganado con Vimeo: **lo que autentica es el Referer, no la cookie.**

### ⚠️ Quedarse con la respuesta MÁS GRANDE: dos diagnósticos equivocados

La página llama al mismo endpoint **más de una vez** —antes y después de resolver la
sesión— y las respuestas no son equivalentes. En este curso, la llamada anónima devolvía
**92 filas sin `video_id`** y la buena **41 con**. El capturador se quedaba con las 92 «por
ser más completas» y el plan salía con 1/41 clases resolubles.

Eso disparó dos diagnósticos que la evidencia después desmintió: «el curso está bloqueado»
(`membership: monthly/active`, `check_course_access: true`) y «hay una sola sesión activa»
(`deviceSessionId === active_session_id`). No era ninguno de los dos: era el capturador
eligiendo mal, más un `--espera` demasiado corto (con 20 s: 41/41).

**La regla:** se puntúa por **utilidad** —cuántas filas traen el campo sin el cual el
pipeline no puede hacer nada (`video_id`, `file_url`)— y el tamaño **solo desempata**.
Está en `CAMPO_UTIL` de `curso-plan-vip.mjs` y `curso-recursos-vip.mjs`, y ahora avisa
cuando se queda con un lote parcial. **Tamaño ≠ corrección.**

### Drive no previsualiza un ZIP, y el default era mentir

`Recurso.tipo` distingue ahora `pdf` (lo que Drive **sabe** dibujar en un iframe: pdf, doc,
docx, xls, xlsx) de `file` (todo lo demás → tarjeta de descarga a `DRIVE_VIEW`). El bug de
fondo no era el ZIP sino el **default**: `TIPO_POR_EXT[ext] ?? 'pdf'` hacía que **cualquier
extensión desconocida** se declarara PDF y el portal dibujara un visor con «sin vista
previa». El default ahora es `file`, que es el que no miente cuando no se sabe.

### Un recurso colgado de la clase «equivocada» puede ser fiel a la fuente

El ZIP llamado `Leccion_4_descargable_Composicion_de_Motion_Graphics_basica` quedó en la
clase 34 («Lección 5 … Avanzada»), no en la 33 («Lección 4 … Básica»). Parecía un
off-by-one del recorrido por orden de documento. **No lo era:** en la plataforma el propio
creador lo colgó de la lección 5. Se comprobó leyendo el DOM, no razonando sobre el nombre.

**La regla:** antes de «arreglar» una asociación que se ve rara, mirar la fuente. El
pipeline replica lo que hay; inventar una corrección lo desincroniza del original y nadie
se entera hasta que el dueño abre las dos pantallas al lado.

## Enumerar las clases de un curso

### ⚠️ «No encontré ninguna clase» en un curso de 116: la duración no puede ser el requisito

**2026-08-13, «M5 -95» (Juan ADS).** El enumerador cortó con *«ronda 1: 0 → 0 clases
visibles (18 cabeceras, 0 abierta/s)»* y el mensaje *«Abrí la página del curso (no el
catálogo)»* — estando en la página del curso, con los 18 módulos bien detectados.

La causa: `curso-plan.mjs` reconocía una clase por tener una duración `mm:ss`. Este curso
no la muestra: sus lecciones se rotulan **`02 1. Introducción Preparación`** y nada más.
Cero clases detectadas, y el mensaje de error apuntaba al lugar equivocado.

Y había un segundo efecto, peor, porque el mismo detector roto se usaba para otra cosa:
**la señal de «este click ABRIÓ el acordeón» era “¿crecieron las clases visibles?”**. Con
el detector en cero, abrir los 18 módulos se leía como no haber abierto ninguno. Un bug
tapando al otro.

Los tres arreglos, y por qué cada uno:

| Qué | Antes | Ahora |
|---|---|---|
| Señal de abrir/cerrar | contaba *clases* (depende del formato) | cuenta **botones** (no depende de nada) |
| Reconocer una clase | exigía duración | duración **o** número de orden |
| Duración ausente | — | se emite `''`, no `'00:00'` |

**La regla que queda:** cuando una heurística sirve para dos cosas, su falla se propaga a
las dos y el síntoma aparece en la que menos se parece a la causa. La señal mecánica
(«¿cambió el DOM?») tiene que ser independiente de la señal semántica («¿esto es una
clase?»).

### La página publica cuántas lecciones tiene: úsalo como patrón

Cada cabecera de módulo muestra su progreso, `0/11`. **Ese denominador es la cuenta de la
plataforma, ajena a nuestra heurística**, y sumarlo da el total real del curso. Ahora
`curso-plan.mjs` compara lo enumerado contra esa suma y **aborta si queda corto por más
del 10%**, en vez de escribir un plan a medias.

Es la misma lección que ya costó cara con Julián (41 de 92) y con los recursos de ATV:
**un contador que se suma a sí mismo no verifica nada.** Hay que medir contra algo que
venga de afuera — el disco, Drive, o como acá, el número que la propia fuente publica.

⚠️ **CORRECCIÓN (2026-08-16): esa suma NO es ajena a la heurística, y por eso falló.**
Los `0/N` salen de las cabeceras **que están en el DOM**, así que con un acordeón plegado
bajan al mismo tiempo que lo enumerado y el chequeo se compara contra sí mismo. Medido en
«Trilogía de BRIAN TRACY»: una segunda corrida sobre la misma pestaña detectó **3 clases
de 11** y anunció, tan tranquila, *«3 clases detectadas (la página dice 3)»*.
El total de verdad lo publica la **ficha** del curso («11 lecciones»), arriba y fuera del
acordeón. Ahora se toma el mayor de los dos, y **la comparación decisiva se hace AL FINAL**,
contra `plan.length` — ver la entrada de abajo.

### El curso de Brian Tracy: cuatro supuestos rotos de una vez

**2026-08-16, «Trilogía de BRIAN TRACY» (11 lecciones).** Primera corrida: 4 de 11, con
siete *«no pude re-encontrar el botón»* seguidos. Ninguna de las cuatro causas era la que
parecía, y todas viven en `scripts/curso-plan.mjs`.

**1. Los acordeones son MUTUAMENTE EXCLUYENTES: abrir «Parte 2» cierra «Parte 1».**
Entonces **no existe ningún instante en que las 11 lecciones estén en el DOM**, y enumerar
de una sola pasada es enumerar de menos por diseño. La enumeración pasó a ser una
**travesía** —se recorre cabecera por cabecera y se acumula por texto— en vez de una foto.

**2. La lección que el script clickeaba primero no era una lección: era la cabecera del
módulo.** «1. BRIAN TRACY en las Ventas» no lleva progreso —lo llevan sus submódulos
«Parte N 0/2»—, así que el filtro «numerada y sin `0/N`» la tomaba por lección. Clickearla
**colapsaba el módulo entero**, y de ahí el bloque de siete fallos: parecía un problema de
marcas caducadas y era haber clickeado lo que no era.

⚠️ **Y el discriminador NO puede ser «cambió la cantidad de botones».** Se probó, y marcó
como cabeceras a **cuatro clases legítimas** —dos ya resueltas con su id de Vimeo en la
corrida anterior—, porque elegir una clase de otro módulo también pliega el anterior. El
que sí distingue estaba a mano: **una clase carga un video y una cabecera no.** Primero se
espera el iframe; recién si NO hubo video se mira si además se movió el árbol.

**3. El click de cabecera es un TOGGLE, así que «abrir su módulo» a ciegas lo cierra la
mitad de las veces.** El síntoma fue un zigzag perfecto: 04 ✓, 05 ✖, 06 ✓, 07 ✖. No hay
`aria-expanded` que consultar, así que no se razona sobre el estado: se toca una cabecera,
se **verifica** si la lección apareció, y si no, se deshace el toggle y se sigue.

**4. La lección EN CURSO se rotula sin número y sin duración**, o sea que no cumple
ninguna de las dos señales de texto y se perdía — y era la lección **1 de 11**. Tampoco
sirve la clase CSS: la resaltada tiene otra (`bg-[#FFD43B]/10`). Lo que la identifica es la
**estructura**: cuelga del mismo padre que sus hermanas. Medido: por padre directo entra
ella sola; por abuelo se cuela «2.BONOS EXCLUSIVOS».

**Y el que ata todo: dos errores que se tapaban entre sí daban un total correcto.** 10
clases + 1 cabecera colada = 11, que es justo el total del curso, y el resumen imprimía
**«10/10 clases con video»** — un pleno perfecto al que le faltaba una lección. Por eso la
comparación final va contra la ficha y **después** de saber cuáles eran cabeceras.

Dos cosas más que salieron de la misma corrida:

- **`--url <parte-de-la-url>`**, nuevo. El script elegía «la primera pestaña que matchee
  `/curso/`», y el Chrome dedicado acumula pestañas de los cursos ya bajados: el plan sale
  completo, con las clases de OTRO curso, y no se ve hasta que alguien abre la carpeta.
- **Se recarga la página antes de enumerar, siempre.** El recorrido clickea decenas de
  botones y deja el árbol en cualquier estado; correr el script dos veces seguidas sobre la
  misma pestaña enumeraba lo que había quedado a la vista.

**Vive en:** `scripts/curso-plan.mjs`

### GOTCHA: `| head` mata el script a mitad y el resumen final miente

Corrí `node scripts/curso-plan.mjs … | head -30` para no llenar la consola. Se vieron las
primeras clases resolviéndose bien… y `plan.json` **nunca se escribió**. `head` cierra el
pipe al llegar a su límite, el productor recibe SIGPIPE y muere — pero lo que quedó en
pantalla parecía una corrida sana.

**Nunca canalizar a `head` un script que produce un archivo.** Redirigir a un `.log` y
leer el archivo después, o correrlo en background.

### ⚠️ Un curso con SUBMÓDULOS no se puede enumerar por el DOM. Cinco hipótesis, cuatro refutadas

**2026-08-13, «Vender Por FB E IG ADS» (Felipe Vergara, 242 lecciones).** El DOM rinde
**154** y las otras **88 no aparecen por ningún camino**. El guard de la sección anterior
lo frenó antes de bajar un curso a medias — hizo exactamente su trabajo.

Lo que se probó y **quedó descartado con evidencia**, para que nadie lo repita:

| Hipótesis | Cómo se refutó |
|---|---|
| El acordeón tarda más de 130 ms en renderizar | Con 600 ms: idéntico |
| Faltaba clickear los módulos padre (sin contador `0/N`) | Se incluyeron: siguen sin abrir |
| La lista está virtualizada | Se scrollearon los 9.700 px de página: las mismas 154 |
| El bucle corta antes de tiempo | 5 rondas seguidas: siempre 220 botones |
| El `.click()` sintético no dispara el handler | **No se pudo testear**: el elemento no entra al viewport |

La causa real es estructural: este curso tiene **52 módulos en dos niveles**
(módulo → submódulo → clase) y 40 de sus cabeceras simplemente no responden al click
programático.

**La salida no fue insistir con el DOM, fue cambiar de fuente.** La página pide la lista
completa a `get_course_lessons_secure` en UNA llamada. Se lee con
`Network.getResponseBody` — **no se le pega a la API**: es el cuerpo que el navegador ya
descargó al abrir el curso, o sea cero requests extra contra la plataforma.

`curso-plan-vip.mjs` (cuyo `-vip` ahora **miente por historia**) sirve para las dos áreas:
sus `PATRONES` aceptan los endpoints con y sin el prefijo `vip_`.

**La señal para cambiar de script:** `curso-plan.mjs` aborta diciendo cuántas lecciones
publica la página y cuántas detectó. Si la brecha es grande, es este caso.

### Los tres desajustes entre /vip/ y /curso/, que fallan TODOS en silencio

Al reusar el script para el área pública, cada dato salió vacío sin un solo error:

1. **`vip_module_id` vs `module_id`.** Las 242 clases salieron con `modulo: null` — o sea
   sin carpetas por módulo en Drive.
2. **`video_id` viene NULL en las 242, y el id está dentro de `video_url`**
   (`https://vimeo.com/1192759004`). Mirando solo `video_id`, el plan concluía que
   *ninguna* clase tenía video. Peor: el puntaje de «filas útiles» —el que existe para
   elegir la respuesta correcta— daba **0/242** en la respuesta perfecta. Por eso ahora
   `CAMPO_UTIL` es una FUNCIÓN y no un nombre de campo.
3. **`sinFuente: segundos === 0`** marcaba como rotas 210 clases sanas. Este curso publica
   la duración de solo **32 de 242**, así que «sin duración» no prueba nada acá. Lo único
   que prueba que no hay fuente es no tener id.

**La regla:** el mismo dato con dos nombres se resuelve en UN lugar (`modIdDe`,
`videoIdDe`, `ordenDe`), no con un `??` repetido en cinco líneas. Y un heurístico que
funciona en un área es una suposición en la otra hasta que se mide.

### La mejor forma de verificar «este curso no tiene recursos» es el campo `resources` del RPC

Verificar los descargables rastreando links en el DOM funciona, pero es frágil: depende de
que todos los módulos estén ABIERTOS y de reconocer el patrón del link. En M5 -95 hubo que
abrir los 18 módulos y buscar por tres vías distintas para poder afirmar «0 recursos».

`get_course_lessons_secure` trae un campo **`resources` por lección**. Una sola lectura
contesta la pregunta para el curso entero, sin abrir nada y sin heurísticas:

```
lecciones: 242 · CON recursos: 0
```

Es la fuente, no una inferencia sobre lo que la fuente dibujó. **Cuando el plan salga por
esta vía, ese es el chequeo de recursos que vale.**

### Antes de bajar un curso, fijate si ya está en Drive

«Vender Por FB E IG ADS» **ya estaba**: 211 archivos, 9,0 GB. Bajar las 242 habría
duplicado ~210 videos contra los ~370 GB libres que son el cuello real
(ver docs/hallazgos-infra y la memoria de Drive vs Panda).

Cruzando el plan de 242 contra el disco: **210 ya estaban y faltaban 32**, todas
contiguas (n=211..242) — el módulo de IA que agregaron después, más el examen final.

Dos cosas del cruce que valen para la próxima:

- **Matchear por TÍTULO, no por número.** La numeración de las carpetas de Drive no tiene
  por qué coincidir con el orden global de la plataforma.
- **⚠️ No usar un `Set`.** Los títulos se repiten: hay nueve «Introducción al Módulo» y
  cuatro «Presentación». Con un Set, nueve clases distintas se tapan con una sola. Hay que
  contar copias e irlas consumiendo.
- Que las faltantes salgan **contiguas** es la señal de que el cruce anduvo: un error de
  matcheo produce faltantes dispersos, no un bloque perfecto al final.

Lo hace `scripts/curso-drive-fusionar.mjs`: copia solo lo que falta respetando la
nomenclatura de la carpeta que ya existe, y resuelve el id de Drive de TODAS las clases.

### ⚠️ Emparejar por título: las tres formas de colgar el video EQUIVOCADO de una clase

El riesgo de este cruce no es no encontrar un archivo — es encontrar el que no era. Eso
sale al portal como una lección que reproduce otra cosa, y nadie lo ve hasta que la abre.
Las tres, en el mismo curso, y cada una redujo las ambigüedades del paso anterior:

| # | Síntoma | Causa | Arreglo |
|---|---|---|---|
| 1 | 32 clases sin desempate | El módulo se comparaba por **igualdad**, y los títulos del plan vienen truncados a ~31 chars mientras la carpeta de Drive tiene el nombre entero | Comparar por **prefijo** |
| 2 | «Paso #2»…«Paso #6» colapsaban en uno (6 candidatos) | La clave usa las **primeras 7 palabras** y el `#N` que los distingue queda afuera del corte | Título completo como desempate |
| 3 | «6. 4. Ascensión» vs «7. 4. Ascensión», mismo submódulo | El normalizador **borra el número inicial** —dos veces, por nombres tipo «02 1. Título»— y los dejaba idénticos | Un normalizador **estricto** que conserva los números, con el puntaje más alto |

De 32 ambigüedades a 7, de 7 a 1, y de 1 a cero.

**Y la guarda que queda por si algo se escapa:** antes de escribir `drive.json` se chequea
que ningún id de Drive aparezca en dos clases. Si pasa, **no se escribe nada** — dos
lecciones apuntando al mismo video es peor que una lección sin video.

### GOTCHA: Drive for Desktop tira `ECANCELED` y una excepción suelta mata la fusión

Copiando a `G:` Drive devolvió `ECANCELED` en un archivo (su filesystem virtual cancela
mientras sincroniza). Sin manejo, el script murió con **12 de 31 copiadas y cero ids
resueltos** — y el error no dice nada sobre reintentar.

Ahora reintenta tres veces con espera creciente y, lo que igual falle, lo **reporta al
final** en vez de abortar. Volver a correr retoma donde quedó, así que un fallo cuesta un
reintento y no la corrida entera.

### Los títulos de módulo vienen CORTADOS de origen (y no hay nada mejor que sacar)

En «M5 -95», 4 de los 18 módulos llegan truncados a ~31 caracteres: *«Módulo 3 ¿Estratega
o Creador de»*, *«Modulo 9 FAST 5-95 Gana tus prim»*. Se verificó que **no es culpa de
`innerText`**: `textContent` —que ignora el CSS— devuelve exactamente lo mismo, así que el
corte está en el markup de la plataforma.

Se dejan como están. Completar el título adivinando el final produciría un nombre de
carpeta en Drive que no existe en ningún lado; el nombre cortado, al menos, es fiel y
sigue siendo único. Si algún día hace falta el título entero, sale del RPC de módulos, no
del DOM.

### ⚠️ 316 filas para un curso de 158, y el guard acertaba el número por el motivo equivocado

**2026-08-15, «Instituto de Comunicación» (Adria Sola Pastor).** El catálogo anuncia **316
lecciones**; la RPC devuelve 316 filas; el deduplicador por título+duración marcó **158**
como repetidas y dejó 158. El número final era **correcto**. La causa que le atribuía, no —
y esa es toda la entrada.

**Las dos explicaciones obvias, las dos falsas:**

1. *«Mi captura mezcló dos respuestas de la misma RPC.»* No: el capturador se queda con
   UNA respuesta, nunca fusiona.
2. *«Es un JOIN devolviendo la misma fila dos veces.»* No: las 316 filas tienen **316 `id`
   distintos**, cero repetidos, cero pares idénticos byte a byte.

**La causa real:** las 316 filas son 158 pares que **apuntan al mismo `video_url`**, y los
158 sobrantes cuelgan de nueve `module_id` que **la API no devuelve en `modules`** (18 ids
de módulo en uso, 9 módulos vivos). Es una copia fantasma de la estructura del curso: la UI
la filtra al hacer el join contra los módulos visibles, y la API no.

**Lo que hay que ver, y es lo caro:** un guard que llega al número correcto por una señal
que no es la causa es **peor que uno que falla**, porque nadie lo vuelve a mirar. El dedup
por título+duración habría (a) perdido una lección en un curso con dos clases legítimamente
homónimas y de igual duración —cosa que existe: «Misión 1» aparece en más de una fase— y
(b) dejado pasar el curso fantasma entero si sus títulos hubieran diferido en un carácter.
Acertó por correlación.

**El filtro correcto es estructural:** se queda con las lecciones que cuelgan de un módulo
**vivo**. Va en POSITIVO (la regla de `AGENTS.md`) y solo se aplica cuando hay módulos y
cuando dejaría algo en pie — un curso sin módulos, o uno donde ninguna lección matchea, se
procesa entero. Con el filtro puesto, el aviso de duplicados **desaparece**: los 158 eran
exactamente las huérfanas, y dos métodos independientes dan el mismo 158.

**Y la verificación que lo cerró son los contadores de la PROPIA plataforma.** Los nueve
`N/M` que la página dibuja por módulo suman `4+10+22+20+12+13+31+14+32 = 158`, exacto. Es
la única fuente que no comparte el bug con el extractor: el catálogo dice 316 (cuenta
filas), la API dice 316, y solo el contador de la UI dice la verdad.

⚠️ **Contar duraciones en `innerText` NO es contar lecciones.** El primer intento midió
«160 filas con duración» con un `\d{1,3}:\d{2}` sobre el texto y se llevó dos duraciones de
encabezado. Dos de más sobre 158 alcanzaron para inventar un hueco que no existía — la misma
trampa que ya costó cuatro diagnósticos en este documento: **el dato estaba bien y el
instrumento mal.** Los contadores del sitio son un dato; una regex sobre el texto es una
estimación.

**Herramienta que quedó:** `--crudo <archivo>` en `curso-plan-vip.mjs` vuelca la respuesta
de la RPC **antes** de tocarla. Sin eso la pregunta «¿son la misma fila o filas distintas?»
no se puede contestar: para cuando el plan está escrito, lo que sobraba ya se descartó.

**Vive en:** `scripts/curso-plan-vip.mjs` (el filtro de huérfanas y `--crudo`)

### ⚠️ El dedup comparaba en TODO el curso y borró una clase real en el curso siguiente

**2026-08-16, «Bigseo Academy» (Romuald Fons).** La entrada de arriba cerraba diciendo que
el dedup por título+duración «habría perdido una lección en un curso con dos clases
legítimamente homónimas y de igual duración». **Pasó al día siguiente, en el curso
siguiente.** El catálogo anuncia 77 lecciones y el plan salió con **76**.

Bigseo tiene una **«01. Introducción» por módulo** —doce en total, cada una su propio
video— y dos de ellas duran `01:26` por casualidad:

| módulo | video |
|---|---|
| `Modulo 00 - Bienvenida` | `1199300008` |
| `Modulo 02 - Keyword Research` | `1199301577` |

El dedup agrupaba por título base en **todo el curso**, las vio con la misma duración y
tiró una. **Y no dejaba ningún rastro**: las 77 filas tenían módulo vivo, 77 ids y 77
videos distintos; no había error, ni hueco de numeración, ni id repetido. La única señal
era el conteo del catálogo, que en este curso resulta fiable y en otros no.

**El arreglo: comparar DENTRO DE UN MISMO MÓDULO.** Un curso legítimamente repite un
título entre módulos; lo que no hace es repetir la misma clase, con la misma duración,
dentro del mismo módulo. Con eso Bigseo da 77/77 y el aviso de duplicados desaparece.

**Por qué el módulo y no «mismo video», que parece más directo:** en «Jaque Blue» el
archivo se **re-subió**, así que cada copia tiene su propio `video_id` y comparar videos no
habría detectado nada — que es justamente el caso que este guard vino a resolver. Lo que sí
comparten esas copias es el módulo. La señal correcta es la que cubre los dos casos.

**Lo que hay que aprender de la secuencia, más que del bug:** el riesgo estaba
**identificado y escrito** —con esas palabras— y aun así se shippeó. Escribir «esto podría
romperse» no es un control; es una nota. Cuando un análisis produce la frase «habría
perdido X si Y», Y ya es un caso de prueba: o se arregla ahí, o se busca un curso con esa
forma antes de seguir. Es la misma regla de `AGENTS.md` sobre umbrales —correlo contra los
datos que ya tenés— aplicada a un guard en vez de a un número.

**Y el corolario sobre los conteos del catálogo:** `77 vs 76` delató esto, pero el mismo
conteo miente en cuatro cursos (Jaque Blue 40/20, Claude AI 40/20, Inteligencia Viral
92/41, Instituto 316/158) porque cuenta FILAS de la API, incluidas las fantasma. Sirve como
**alarma**, nunca como veredicto: obliga a mirar el crudo, no a corregir el plan.

**Vive en:** `scripts/curso-plan-vip.mjs` (la clave de agrupación del dedup)

### ⚠️ Un `| grep` se comió el código de salida y el lote armó planes de otro curso

**2026-08-16.** Auditando los 15 cursos publicados —para ver si el dedup viejo había
borrado clases— dos de ellos, «Hackeando la Edición» (64 clases) y «Master Marca Personal
5.0» (92), devolvieron **los mismos 888 registros** de un curso de dropshipping que nadie
había pedido.

**El diagnóstico obvio era el equivocado, dos veces:**

1. *«La captura devolvió una respuesta vieja del buffer.»* No. La captura era **coherente
   consigo misma**: la URL de la pestaña, el objeto `course` y el `course_id` de las 888
   filas decían todos el mismo curso ajeno. No había nada inconsistente que detectar, y la
   guarda que se había escrito para eso —comparar lecciones contra curso— no podía saltar.
2. *«`curso-abrir.mjs` no avisa que falló.»* Tampoco. Avisa bien **y sale con código 3**.

**La causa real:** el script del lote invocaba `curso-abrir.mjs … | grep …`, y en un
pipeline el código que sobrevive es el del **último** comando. El `grep` devolvía 0, el
lote siguió como si hubiera navegado, y el generador capturó la pestaña que había quedado
de la iteración anterior. La herramienta se negó a adivinar entre dos coincidencias
—«Hackeando la Edición» y «Hackeando el Algoritmo»— exactamente como debía, y esa negativa
se perdió en la cañería.

Es la regla de [AGENTS.md](../AGENTS.md) «un `console.warn` no es un control» con una
vuelta más: **acá el control SÍ existía y estaba bien hecho; lo que falló fue el que lo
llamaba.** Un `exit 3` que nadie mira es tan inútil como un warn.

**Las dos cosas que quedan:**

- **En un lote, el código de salida se chequea explícitamente**, y nunca detrás de un pipe
  (`cmd > log; cod=$?` y recién después el `grep` sobre el log). Un lote que ignora un
  fallo no procesa 14 de 15: procesa 15, y dos con datos de otro.
- **`--esperado <fragmento>` en `curso-plan-vip.mjs`.** El script captura «la pestaña de
  cursoselite que haya», sin ninguna noción de qué curso se quería; con el flag, verifica
  que la URL lo contenga y aborta con código 5 si no. Es la única guarda posible acá,
  porque el dato correcto —la INTENCIÓN— no está en ningún lado de la captura.

**Y el resultado de la auditoría, que era el objetivo:** de los 15 cursos publicados,
ninguno perdió clases. El único donde las dos reglas difieren es «Aumenta tu valor y ATV
ADVANTAGE» (la vieja habría tirado una de las dos «2. Cambiando tu ralidad», 29:54, en los
módulos 1 y 9), y su plan conserva las dos porque se armó antes de que el dedup existiera.

**Vive en:** `scripts/curso-plan-vip.mjs` (`--esperado`) · `scripts/curso-abrir.mjs` (el
`exit 3` que ya estaba bien)

### ⚠️ Una bandera `i` escondió 4 clases: `.Funciones` no es un formato de yt-dlp

**2026-08-16, «Bigseo Academy».** El subidor reportó cuatro veces «no está bajado todavía»
sobre archivos que **estaban en disco, con el nombre exacto que esperaba**:

```
13 - 09.Funciones del Keyword Planner.mp4
42 - 07.Formatos para Contenidos.mp4
61 - 02.Funciones.mp4
73 - 02.Funcionamiento de los datos estructurados.mp4
```

**El diagnóstico obvio era el equivocado:** «el subidor corrió mientras el descargador
todavía escribía». Se descarta solo — al reintentar con la descarga cerrada y los 77 `.mp4`
en disco, fallaron **los mismos cuatro**. Cuatro de setenta y siete no es una carrera.

**Lo que tienen en común es la letra.** El filtro de intermedios era:

```js
const esIntermedio = (f) => /\.f[^.]*\.(mp4|mkv|webm|m4v)$/i.test(f);
```

La bandera **`i`** hace que `\.f` matchee `.F`, así que **cualquier título que después de un
punto empiece con «F»** se tomaba por archivo transitorio de yt-dlp. `Funciones`,
`Formatos`, `Funcionamiento` — todos y solo los que empiezan con F.

La distinción real: yt-dlp escribe `f` **minúscula** seguida de un id de formato, numérico
(`f614`) o un protocolo (`fhls-…`, `fdash-…`). Un título humano no tiene esa forma. El
filtro ahora es sensible a mayúsculas **y** exige la forma del id, en vez de aceptar
cualquier cosa después de la `f`.

**Por qué duele especialmente:** el falso positivo de este filtro es **mudo**. El archivo
no llega a Drive, no se transcribe, y el único rastro es una línea entre setenta y siete.
No hay error, no hay conteo que no cierre en el plan, y el curso se publica con menos
clases de las que tiene. Cuando un filtro decide qué NO procesar, su falso positivo cuesta
mucho más que su falso negativo — un intermedio que se cuela se ve (pesa 500 MB y no tiene
audio); una clase que se pierde, no.

**Alcance, medido y no supuesto:** seis clases en dos cursos. Las cuatro de Bigseo (que aún
no estaba publicado) y dos de «M5 -95» —`068 - 1.Fast M5-95` y `113 - 4.Fórmulas
personalizadas y secretas`—, que **se salvaron por casualidad**: ese curso se procesó antes
de que el filtro existiera, y su `drive.json` tiene las 116. Ningún curso publicado perdió
nada.

**Y la regla que estaba rota de antes:** `esIntermedio` estaba **copiado en tres archivos**
—`curso-a-drive.mjs`, `curso-audio.mjs`, `curso-organizar.mjs`— con el mismo bug en los
tres. Es «una cosa, un lugar» de [AGENTS.md](../AGENTS.md): las copias no habían divergido,
pero arreglarlo exigía acordarse de las tres, y la que se olvidara habría dejado el bug
vivo en su camino — el de `curso-audio.mjs` es el que decide qué se transcribe. Ahora vive
en `scripts/curso-comun.mjs`.

**La red:** `tests/curso-intermedios.test.ts`, con **nombres reales** de los cursos del
portal —los seis que se perdían y los intermedios de verdad— y un caso que aísla el bug: si
alguien vuelve a poner la bandera `i`, falla.

**Vive en:** `scripts/curso-comun.mjs` (la regla) · `tests/curso-intermedios.test.ts` (la red)

### ⚠️ Drive for Desktop se queda con la COLA DEL FINAL sin subir, y no avisa

**2026-08-16/17, dos veces la misma noche.** Al terminar de copiar un curso, los últimos
3-4 archivos se quedan sin subir **para siempre**: `curso-a-drive.mjs` espera sus 20
minutos y sale con «1 sin id todavía — Drive sigue subiendo». Y no está subiendo.

**Cómo se distingue de «está lento», que es lo que parece:** la fila existe en la base de
Drive con un id `local-…` (los reales son alfanuméricos largos) y **`file_size = 0` del
lado del servidor**. Con eso se cuentan los pendientes de toda la cuenta:

```sql
SELECT local_title FROM items WHERE id LIKE 'local-%' AND is_folder = 0 AND trashed = 0
```

Las dos veces dieron 3 y 4 filas, todas del final del lote. Y **no hay ningún error** que
lo explique: ni cuota, ni permisos, ni el nombre con acentos —se descartaron los tres—, y
la tabla `operations` tenía las 6 operaciones encoladas y limpias. Drive las aceptó y dejó
de procesarlas.

**Lo que lo destraba es reiniciar Drive** (`Stop-Process GoogleDriveFS` + volver a
lanzarlo). Las dos veces subió todo en segundos. `G:` se desmonta unos segundos y vuelve.

⚠️ **Y el efecto río abajo es la truncación silenciosa de siempre:** la clase sin id no
queda en `drive.json` *sin* id — **desaparece del índice**. La primera vez quedó un
`drive.json` de 29 entradas para 30 clases, y publicarlo habría dado un curso al que le
falta una clase, sin una sola línea de aviso.

**Vive en:** `scripts/curso-a-drive.mjs` (la espera y el índice)

### ⚠️ `drive.json` se REESCRIBE desde lo local, y liberar local lo trunca en silencio

**2026-08-16, «Instituto de Comunicación».** Con las 158 clases ya subidas, correr
`curso-a-drive.mjs` una última vez dejó un `drive.json` de **32 clases**. Las otras 126
—que estaban perfectamente en Drive, con sus ids resueltos en corridas anteriores—
desaparecieron del índice.

**La causa es una interacción, no un bug de una pieza.** `curso-a-drive.mjs` arma su lista
recorriendo `video/` **local**, y escribe `drive.json` completo con lo que encontró. Eso
estaba bien mientras el local fuera la copia de trabajo. Dejó de estarlo cuando se sumó el
liberado por tandas (`--liberar`): a esa altura sólo quedaban 32 `.mp4` en disco, y el
script hizo exactamente lo que dice hacer.

Las dos piezas son correctas por separado. Lo que nadie escribió es que **una borra la
entrada de la otra.**

**Lo que se pierde es el ÍNDICE, no el material** — los 158 archivos siguen en Drive—, pero
`drive.json` es lo que come `curso-a-portal.mjs`: publicado así, el curso sale con 32
clases y las otras 126 no existen para el portal. Silencioso de punta a punta: el script
termina con «32/32 clases con videoId de Drive», que es verdad y suena a éxito.

⚠️ **`--solo-ids` NO lo recupera.** Trabaja sobre lo que ya está en `drive.json`, así que
sobre uno truncado devuelve «32/32» otra vez, confirmando el número equivocado.

**La reconstrucción es `curso-drive-fusionar.mjs`**, que es la única que arma el índice
desde la CARPETA DE DRIVE y no desde el local: cruza el plan con lo que hay allá por título
y resuelve los ids por ruta. `--plan … --carpeta "<Curso> - <Autor>" --aplicar` → 158/158.

**Las reglas que quedan:**

- **Un archivo de índice que se REESCRIBE entero necesita saber si su fuente está
  completa.** Si `curso-a-drive.mjs` encuentra menos clases locales que las que ya figuran
  en el `drive.json` que va a pisar, eso no es una corrida normal: o fusiona, o avisa.
- **Y la regla general: cuando una optimización borra el insumo de otro paso, el orden deja
  de ser libre.** El liberado por tandas es correcto y hay que dejarlo; lo que hay que
  escribir es que después de liberar, el índice se reconstruye contra Drive y nunca contra
  el disco.

**Vive en:** `scripts/curso-a-drive.mjs` (el que reescribe) · `scripts/curso-drive-fusionar.mjs`
(el que reconstruye)

## El portal

### ⚠️ `.al-chip` estaba definido DOS veces y el segundo ganaba en silencio

Los chips del filtro de categorías declaraban `border-radius:999px`, tipografía monoespaciada
y borde tenue. **Nunca se vieron así.** Más abajo en la misma hoja, la sección «Chips»
define otro `.cono .al-chip` —el de las herramientas de un recurso— con la misma
especificidad y posterior en el archivo, así que ganaba él: radio 9px, sin mono, borde
sólido.

Dos usos distintos con el mismo nombre de clase en una hoja de 300 líneas. No hay error, no
hay warning, y leer el bloque de arriba te convence de que el estilo es el que dice.
**Antes de dar por buena una regla CSS, buscá el selector en TODO el archivo.**

(El filtro pasó a ser un desplegable, así que ese bloque ya no existe. Queda el aviso donde
estaba.)

### ⚠️ Las transcripciones estaban ROTAS en todo link compartido, y del lado del admin se veían bien

**2026-08-14.** El dueño abre un `/compartido/<token>` y una clase dice **«No se pudo
cargar la transcripción»**. El archivo existía en disco, estaba commiteado y estaba
desplegado.

Pidiéndolo directo a producción: **HTTP 307**. Las transcripciones son estáticos en
`public/cono-tx/<videoId>.json`, y el `matcher` del middleware excluye assets **por
extensión** — `png|jpe?g|svg|webp|gif|ico|css|js|woff2?` — y **`.json` no está en esa
lista**. Así que cada pedido de transcripción entraba a la puerta de auth y, sin sesión,
se iba a `/inicio`.

**Por qué sobrevivió tanto:** en `/conocimientos`, con sesión de admin, las
transcripciones se ven perfectas. Fallaban SOLO en el link compartido, que es justo el
que uno no mira. Es el mismo patrón que AGENTS.md ya documenta para las rutas con auth
propia: *«en local esto NO se ve»* — acá la variante es «con sesión esto no se ve».

Se excluye **por RUTA** (`cono-tx/`) y no agregando `json` a la lista de extensiones:
hay endpoints que sí tienen que estar gateados, y abrir todos los `.json` para arreglar
un directorio de assets es más de lo que hace falta.

**La regla:** un asset estático nuevo con una extensión que no está en el `matcher` es
invisible en local y con sesión. Al agregar un tipo de archivo a `public/`, probalo
**sin cookies** — `curl` pelado contra producción — antes de darlo por servido.

### ⚠️ La portada del curso no es la imagen más GRANDE de la tarjeta

> ⚠️ **Este diagnóstico es correcto y la fuente era la equivocada.** Toda esta
> heurística —frecuencia, proporción, área— existía para raspar la tarjeta del
> catálogo, que sirve la miniatura de 456x256. La tapa real vive en la columna
> `cover_image` de la tabla `courses`. Ver «Las miniaturas del portal — 2026-08-24» al
> final de este documento.

El seleccionador de portadas ordenaba por área y se trajo la **foto de perfil de Alex
Hormozi** en vez de la tapa del curso. No fue un bug del slug: la tarjeta trae las dos
imágenes y el avatar **gana por área** — 450×450 = 202.500 px contra 456×256 = 116.736
de la tapa.

Una tapa de curso es **apaisada** y un avatar es cuadrado o vertical, así que la
proporción las separa mucho mejor que el tamaño. Ahora ordena por `ratio >= 1.4` y el
área queda de último desempate, entre imágenes que ya son apaisadas.

### El badge de la clase no puede pelear con la numeración del autor

La tarjeta decía **«CLASE 09 · 5.3 ROBA COMO ARTISTA»**: dos números distintos para la
misma lección. El badge mostraba la posición real y el título la numeración del creador,
que no coinciden porque a «Jaque Blue» le faltan las lecciones 9, 12, 13 y 14 en el
origen.

Gana el del autor: es el que él menciona hablando y el que está en sus materiales. Si el
título ya empieza con su número, el badge dice solo «Clase». Se decide **por título**, no
por curso: hay cursos donde conviven clases numeradas y sin numerar (en «Vender Por FB E
IG ADS», 240 de 242 se numeran solas), y a las segundas el número sí les sirve.

### ⚠️ La plataforma puede tener el curso cargado DOS VECES, y ningún chequeo de unicidad lo ve

**2026-08-14.** «Jaque Blue - Creacion de Contenido» publica **40 lecciones que en
realidad son 20**: cada una aparece con su nombre y otra vez con el sufijo ` (1)` del
archivo re-subido. El pipeline las bajó, las subió a Drive y las transcribió todas. El
duplicado apareció recién en el portal y lo vio el dueño.

**Por qué no lo agarró ninguna guarda.** Se chequeaban ids únicos y títulos únicos, y las
dos cosas daban bien: cada copia es una subida distinta a Vimeo (otro `video_id`) y el
` (1)` hace que el título difiera. **Las dos comprobaciones eran correctas y las dos eran
irrelevantes.**

La señal que sí sirve es la **DURACIÓN idéntica sobre el mismo título base**: dos videos
distintos no duran lo mismo al décimo de segundo. Medido en los 20 pares: misma duración
exacta, y tamaños iguales o con pocos KB de diferencia (jitter de dos subidas del mismo
material).

Ahora `curso-plan-vip.mjs` lo detecta y descarta la copia, renumerando. **Sin duración no
descarta nada: solo avisa** — un curso puede tener legítimamente una «Parte (1)».

Costo de no haberlo visto antes: 1,06 GB bajados de más, 20 archivos de más en Drive y 20
transcripciones gastadas al pepe. Y el corolario para el resto del pipeline: **la
aritmética delata.** El curso reportaba 8,9 h y quedó en 4,5 — exactamente la mitad. Un
total que se parte al medio al deduplicar es la confirmación más barata que hay.

### ⚠️ Un reintento que consulta un id PERSISTIDO no es un reintento

**2026-08-14.** Una clase de 242 se resistió a transcribirse. Dos intentos, mismo
resultado exacto: *«no llegó la transcripción en 25 min»*. Se leía como lentitud.

Preguntándole a ScreenApp por ese `fileId`: **HTTP 200**, el archivo estaba allá con su
nombre y su duración al milisegundo… y **sin campo `transcript`, sin campo de estado y sin
error**. Aceptó el archivo y no lo transcribió nunca. El audio estaba sano (9m25s, aac
16 kHz mono) y en el mismo curso hay clases mucho más largas que pasaron bien.

**El bug era nuestro, y es el que importa.** El `fileId` se persiste en `sa-fileids.json`
para que una corrida cortada poletee en vez de re-subir — correcto para ese caso. Pero
cuando el trabajo del otro lado está muerto, **cada reintento vuelve a consultar el mismo
cadáver**: no podía funcionar nunca, y el síntoma era idéntico al de «tarda mucho».

El arreglo: si vence la espera, se SUELTA el id persistido. El próximo intento sube una
copia nueva. Soltándolo, la clase salió **a la primera** — que es la prueba de que el
diagnóstico era ése y no el archivo.

**La regla, que vale para cualquier trabajo asíncrono con id guardado:** un identificador
persistido es una optimización para reanudar, **no** un hecho permanente. Si la espera
vence, el id es sospechoso y hay que soltarlo, o los reintentos son teatro. Y el corolario
de siempre: un proveedor que devuelve **200 con el recurso a medias** es peor que uno que
falla — no hay error que loguear y el único síntoma es un timeout, que apunta al lado
equivocado.

### ⚠️ Las portadas se muestran ENTERAS, nunca recortadas

**2026-08-14.** El banner de un curso tenía ancho 100%, tope de alto 340px y
`object-fit: cover`. **9 de las 11 tapas son 16:9**, así que en una columna de ~1040px
necesitaban 585px de alto y el recorte se comía el **40%** — justo donde está la cara de
quien dicta el curso. El dueño lo vio antes que nosotros: «hay muchas portadas que las
recortas mal y se corta el rostro».

**El primer arreglo fue el equivocado, y conviene que quede escrito por qué.** Se pasó a
mostrar la tapa ENTERA (caja 16:9, tope de ancho, `object-fit: contain`). Técnicamente no
perdía un pixel… y el dueño lo rechazó: *«me gustaba como estaba antes, más largas. Solo
quería que ajustes las imágenes a la cara del creador»*. El formato banner es una decisión
de diseño, no un accidente; el problema nunca fue que recortara sino **desde dónde**.

**El arreglo que quedó:** banner igual que antes (ancho completo, alto acotado, `cover`)
con **`object-position: center 28%`**. En una tapa de curso la persona está arriba —o
arriba a la derecha— y lo prescindible son los íconos y el logo del pie. Verificado sobre
cuatro tapas de composición distinta: en las cuatro el rostro entra completo y lo que se
pierde es la franja de abajo.

No se usa el valor `top` a secas porque varias tapas tienen un badge («LIVE», «CURSO
COMPLETO») pegado al margen superior que quedaría contra el borde.

**La lección que sirve para la próxima:** «no se pierde información» no es lo mismo que
«se ve bien». Antes de reemplazar un tratamiento visual, preguntarse si es un defecto o
una decisión.

### El CSS del portal es un template literal: un backtick lo parte al medio

`export const CSS = \`…\`` son ~300 líneas dentro de un template literal. Un comentario que
citaba un nombre de clase con backticks cerró la cadena y produjo cuatro errores de tipos
crípticos (`Property 'al' does not exist on type '"\n.cono.ahc {…'`) que no mencionan la
causa por ningún lado. En ese bloque, los nombres de clase van sin backticks.

**⚠️ Volvió a pasar el mismo día, en el mismo archivo, con el aviso ya escrito arriba** —
esta vez citando `width:100%` y `object-fit:cover` en un comentario. Escribir la nota no
alcanza; lo que lo agarra es el chequeo:

- **`npm run typecheck` inmediatamente después de tocar ese bloque**, antes de seguir con
  otra cosa. Lo detecta en segundos y con el número de línea correcto.
- Y un detalle que no es obvio: **rompe el dev server de la OTRA sesión**. Toda la app
  empieza a tirar 500 con un mensaje que apunta a la línea del comentario. Si aparece un
  500 global de la nada, mirá si alguien acaba de tocar un template literal grande.

### ⚠️ «Volver» se arregló tres veces porque las tres se apoyó en el historial

**2026-08-13/14.** El mismo botón, reportado roto por el dueño tres veces, con un síntoma
distinto cada vez:

1. Desde una **clase**, «Volver» devolvía a la clase ANTERIOR. Causa: Anterior/Siguiente
   apilaban una entrada por clase leída. Se arregló pasándolos a `replace`.
2. **Seguía devolviendo a la clase anterior.** Se hizo explícito el «Volver» de la clase
   (navega al índice, sin `back()`).
3. Desde el **hub** —la vista de módulos— devolvía a la clase. Causa: el rótulo del curso
   de arriba a la derecha hace `push` de una entrada de hub **encima** de la clase, así que
   el `router.back()` del hub tenía la clase justo debajo.

**Lo que hay que ver:** los arreglos 1 y 2 eran correctos y no alcanzaron, porque los tres
compartían la premisa equivocada — que el historial sabe a dónde volver. El historial sabe
de dónde VINISTE, que es otra cosa. Cada camino nuevo a la misma pantalla (un botón de
marca, un rótulo, un deep-link, el Atrás del navegador) es una forma más de que no
coincidan, y aparece semanas después como «el botón anda mal» sin nada que lo explique.

**La regla que queda: el destino de «Volver» es una propiedad de la PANTALLA, no del camino
que hiciste para llegar.** Se declara por nivel —recurso → clase → índice → cursos— y se
navega explícitamente. `router.back()` no se usa más en el portal.

**La excepción, y cómo se trata:** el RECURSO sí depende de dónde veniste, porque se abre
desde el índice o desde adentro de una clase. Eso **no** justifica volver al historial: el
origen viaja en la vista (`?curso=…&r=…&de=N`), así que sobrevive a un reload y a un link
copiado, que es justo lo que el historial no hace. Cuando el destino de verdad depende del
contexto, el contexto se hace **dato**, no se deduce.

⚠️ **Y el «Volver» del hub es OPCIONAL** (`salir`): en un share de UN curso no existe el
nivel de arriba, y ahí el botón no se dibuja. Un botón que no lleva a ningún lado es peor
que no tenerlo.

**Cómo se verificó, que es la parte que faltó las dos veces anteriores:** Playwright contra
el dev server, recorriendo los cuatro caminos —incluido el del rótulo, que es el que lo
rompía— y comparando la URL resultante. Dos gotchas del test, los dos capaces de dar un
verde falso: `waitUntil:'networkidle'` **nunca resuelve** en una clase (el iframe de Drive
no queda ocioso), y las tarjetas de un `<details>` cerrado existen en el DOM pero no se
pueden clickear. Y esperar con `waitForTimeout` en vez de esperar el cambio de URL hizo que
la primera corrida midiera la pantalla equivocada y reportara un fallo que no existía.

**Vive en:** `app/conocimientos/CursoPortal.tsx` (los tres destinos y el porqué) ·
`app/conocimientos/Conocimientos.tsx` (`de` en la URL) ·
`app/compartido/[token]/PortalCompartido.tsx` y `CursoCompartido.tsx` (`salir`)

## Decisiones

### La FUENTE del material entra en el criterio, no solo el formato

**2026-08-11.** Se pidió automatizar la descarga en lote del catálogo de
`cursoselite.com.mx` para ingestarlo al RAG. **No se construyó.** El sitio cobra US$27/mes
por «+70 cursos premium valorados en más de US$55.800», y el catálogo son cursos de autores
identificados con nombre y apellido, cada uno vendiendo el suyo por US$450-690; el propio
sitio compara «un curso de marketing $497 / acá incluido». Es un tercero revendiendo el
catálogo de 70 creadores al 1% del precio, con 3 cursos nuevos por semana.

**La regla que queda:** antes de armar un extractor, la pregunta no es «¿se puede bajar?»
sino **«¿de quién es esto?»**. Que la plataforma le cobre al usuario no le transfiere el
derecho a redistribuir, y el material ingestado al RAG se le sirve a **clientes que pagan**
— o sea que el riesgo aterriza en MaKo, no en la plataforma de origen. Las fuentes limpias
para esta ingesta son: material propio (AVATARHYPE, lo que vive en Panda), cursos comprados
**directo al creador**, las llamadas de Fathom, y lo que genera la fábrica de creativos.

**Y el límite técnico que no se cruza en ningún caso:** si el player pide un manifiesto
`.mpd` o el network muestra `requestMediaKeySystemAccess` / EME / un license server, el
contenido está protegido con DRM y ahí se **frena y se avisa**. Un `.m3u8` en claro (o con
AES-128 estándar, que no es DRM) es otra cosa.

## Lo que quedó sin hacer

- **No existe el paso de extraer audio antes de transcribir**, que es el único que hace
  falta para que una clase entera entre por la puerta que ya existe. Vive donde se escriba:
  `scripts/` + `lib/transcribe.ts`.
- **No hay ingesta por lote al portal**: `ConocimientoView` sube de a una clase a mano.
- **Un fallo de transcripción no debe quedar como estado terminal.** En el cron de anuncios
  ya pasó lo peor: una credencial a medio hidratar guardaba la fila con status `error` y eso
  **contaba como ya transcrito**, dejando 9 anuncios sin texto para siempre
  (2026-07-29 → 08-03, comentado in extenso en `lib/transcribe.ts` → `asegurarCreds`). Si se
  agrega un backfill de clases, ese es el molde a no repetir.
- **El entorno de graphify no está verificado.** Existe `graphify-out/` (corrió alguna vez)
  y su `references/transcribe.md` llama a `transcribe_all()` con Whisper de Python, pero el
  Python del sistema no tiene whisper: usa su propio intérprete (`.graphify_python`), que no
  se probó. Si se piensa transcribir con graphify, probarlo antes de contar con él.
- **`skills.sh` no tiene ninguna skill que sirva para esto** y la más cercana es
  YouTube-céntrica. El detalle del registro y de qué skills existen quedó en el chat de esta
  sesión; si se decide escribir una propia, publicar es trivial (un `SKILL.md` en un repo).
  ⚠️ Y las skills de este proyecto se cargan desde
  **`dashboard-marketing/.claude/skills/`**, un nivel más abajo que la raíz del clon: una
  skill puesta al nivel del cwd **no se carga y falla en silencio**.

---

*Producido por la corrida `wf_9a9e9993-6c6` (5 agentes, 2026-08-11), más la relectura de
`docs/chats/chat-conocimientos-cursos-e8ba820e.md`, que era el único lugar donde vivía la
mitad de este documento.*

## AvatarHype: lo descubierto, y por dónde seguir

**2026-08-16.** El portal tiene AvatarHype con **6 clases y 13 recursos**. La academia viva
tiene **27 lecciones en 3 cursos**. Está muy desactualizado y falta un curso entero.

### La plataforma

`app.avatarhype.online` es una **tercera plataforma**, distinta de cursoselite y de Hotmart:
un **Next.js con RSC**. No expone una API de contenido — se verificó: en los 167 KB del HTML
de `/academy` no hay `lessons`, ni `slug`, ni `m3u8`, ni `videoUrl`. El contenido se arma en
el cliente, así que hay que recorrer las rutas.

**Las rutas, sacadas de los prefetch `?_rsc=` que la propia app dispara:**

```
/academy/ugc              Creativos UGC Realistas   25 lecciones · 4 recursos
/academy/animados         Creativos Animados         2 lecciones · 2 recursos   ← NO está en el portal
/academy/clonacion-voz    Clonación y control de voz (extensión, 7 US$)
/academy/<curso>/<slug>   una lección, p. ej. /academy/ugc/ugc-sin-producto
```

⚠️ **La app NO RENDERIZA si `document.visibilityState` no es `visible`.** La pantalla se
queda en «Cargando…» para siempre y los botones resuelven en `(0,0)`, que es la firma.
Costó tres intentos y dos diagnósticos equivocados («no cargó la ruta», «el click no
llega»). Es el mismo gotcha que ya había aparecido clickeando en Hotmart.

**⚠️ Y `Page.bringToFront` NO es el arreglo — es lo que hacía que pareciera intermitente.**
*(Corregido el 2026-08-16, sobre lo que decía este mismo documento.)* Trae la pestaña al
frente **dentro de su ventana**: si la ventana de Chrome está minimizada o tapada, la
pestaña queda al frente y `visibilityState` **sigue en `hidden`**. Medido: con
`bringToFront` puesto, `document.hasFocus()` daba `true` y `visibilityState` `hidden` al
mismo tiempo, y la pantalla no montaba nunca. Por eso «funcionaba» según dónde estuviera la
ventana, que es la peor forma de fallar: parece un problema de tiempos.

El arreglo es **`Emulation.setFocusEmulationEnabled({ enabled: true })`**. La página se cree
visible y activa, renderiza en ~1 s, sobrevive a que la ventana esté minimizada, y **no hay
que robarle el escritorio al usuario** durante los ~4 minutos que tarda un recorrido.

```js
await cmd('Emulation.setFocusEmulationEnabled', { enabled: true });
if ((await ev('document.visibilityState')) !== 'visible') { /* frenar: nada va a renderizar */ }
```

⚠️ **Y el cascarón SÍ renderiza mientras el cuerpo está en «Cargando…».** Esa es la parte
que produjo un dato falso. Con la lección sin montar hay igual **13 `<a>`** —la barra
lateral entera, y hasta el «Siguiente →»— sobre un `body.innerText` de 264 caracteres. O
sea: **cualquier espera del tipo «hay más de N links» da verde sobre una página que no
cargó**. El primer recorrido esperaba así, salió con **exit 0** y reportó «25 lecciones
recorridas · 0 con video · DRM: no» — las tres cosas falsas, y con la forma de un resultado
bueno. Una lección que no renderiza es indistinguible de una lección sin video, así que la
espera va contra **contenido propio de la lección** (el contador `n/25`, el código `4.1.1`)
y la falta de render **corta el script**, nunca se anota como un cero.

### Estructura de «Creativos UGC Realistas» (25 lecciones)

| # | módulo | lecciones |
|---|---|---|
| 1 | Onboarding | 11 · 18 min |
| 2 | Catálogo de modelos IA | tabla (recurso, no lecciones) |
| 3 | Fundamentos del método | 5 · 28 min |
| 4 | Formatos | 9 · 71 min · **1 «próximamente»** |
| 5 | Definir voz y clonación | **extensión aparte, 7 US$** |

11 + 5 + 9 = 25, que cuadra con el «15/25» del panel. **Hoy son 24 bajables**: una de
Formatos todavía no existe. Y el módulo 5 puede estar bloqueado si no está comprado — se
detecta al enumerar y se saltea avisando, nunca se inventa.

### Las 25 lecciones, en orden (2026-08-16)

Se sacan recorriendo la cadena `← Anterior` / `Siguiente →`, que la propia app publica
como dos `<a>` con href. **No se sacan del menú lateral:** ahí los módulos son plegables y
su texto está partido en nodos («1», «Onboarding», «10/11 · 18 min»), así que engancharlo
pide un selector frágil — y encima el `.click()` de JS no los abre. La cadena, además, ya
trae el ORDEN, que es lo que hay que saber para numerar.

| # | código | slug | # | código | slug |
|---|---|---|---|---|---|
| 1 | 1.1 | `bienvenida` | 14 | 3.3.1 | `las-palancas` |
| 2 | 1.2 | `lo-basico` | 15 | 3.3.2 | `niveles-de-conciencia` |
| 3 | 1.3.1 | `intro-herramientas` | 16 | 3.3.3 | `el-estratega` |
| 4 | 1.3.2 | `recomendacion-actual` | 17 | 4.1.1 | `ugc-sin-producto` |
| 5 | 1.3.3 | `apimart` | 18 | 4.1.2 | `ugc-con-producto` |
| 6 | 1.3.4 | `kie` | 19 | 4.1.3 | `ejemplo-moda`* |
| 7 | 1.3.5 | `edicion-capcut` | 20 | 4.1.4 | `ejemplo-app-entrenamiento`* |
| 8 | 1.4.1 | `biblioteca-prompts` | 21 | 4.2 | `formato-podcast` |
| 9 | 1.4.2 | `quitar-marca-de-agua` | 22 | 4.3 | `formato-voz-en-off` |
| 10 | 1.4.3 | `musica-efectos` | 23 | 4.4 | `formato-dualcast` |
| 11 | 1.4.4 | `agentes` | 24 | 4.5 | `trends-virales` |
| 12 | 3.1 | `realismo-e-ia` | 25 | 4.6 | `imagenes-estaticas` |
| 13 | 3.2 | `agente-6c-imagenes` | | | |

El módulo 2 («Catálogo de modelos IA») **no tiene lecciones**: es una tabla. 11 + 5 + 9 =
25, que cuadra con el contador de la app.

⚠️ **El slug NO se deduce del título.** La 4.5 se llama «Formato Trends virales» y su slug
es `trends-virales`, no `formato-trends` — mientras que la 4.2 y la 4.3 sí llevan el
prefijo. Sobre 7 títulos con forma de patrón, 6 lo siguen y 1 no, que es la proporción
exacta que hace que una regla inventada parezca correcta. Salen del `href`, siempre.

La portada de cada lección es predecible: `/covers/ugc-v9/<código>.webp` (`1.1.webp`).

### ⚠️ Hay DOS sistemas de video distintos en el mismo curso

Es lo que rompe el molde de Hotmart, donde una clase = un video.

| Qué | Dónde | Cómo se pide |
|---|---|---|
| **El video de la lección** | Bunny **Stream** (`iframe.mediadelivery.net`, librería `683445`) | `/api/video/<id>` → embed con token · el manifiesto es `https://vz-e3242c91-fe8.b-cdn.net/<guid>/playlist.m3u8` |
| **Los clips del documento** | Bunny **Storage** (`avatarhype-audio.b-cdn.net`) | MP4 directo por `/api/doc-media/<carpeta>/<id>-<hash>.mp4` |

Los del documento son muchos: **95 MP4 distintos** en las 8 lecciones del módulo 4 (de 5 a
28 por lección), y **cero** en las otras 17. Eso no es que no tengan video: es que el video
de la lección **no se pide hasta el play** — el `<video>` ni existe en el DOM hasta
entonces. Contar requests al cargar dice «17 lecciones sin video», y es falso.

**Cómo se resuelve el video de una lección:** apretar el póster
(`button.ugc-vposter[aria-label="Reproducir la lección"]`) dispara `/api/video/<id>`, que
contesta `{ url, kind: 'iframe', expiresAt, ttlSeconds: 3600 }`. Lo estable es el **id de
lección** y el **guid** del embed; el token dura **1 hora**, así que —igual que en Hotmart—
el plan guarda el id y el guid, **nunca la URL firmada**.

⚠️ **El `.click()` de JS no despierta al reproductor.** Se hizo sobre el botón correcto y a
los 6 s no había ni `<video>` ni una sola request. Hay que mandar un click de verdad con
`Input.dispatchMouseEvent` (mousePressed + mouseReleased) en el centro del póster, leído
del `getBoundingClientRect()` — nunca coordenadas fijas: el panel es redimensionable.

⚠️ **Y el iframe es OTRO target de CDP.** Con `Network.enable` solo en la página no se ve
NADA de lo que pide el reproductor, y ese vacío se lee como «no hay DRM» — la conclusión
que no hay que sacar sin mirar. Hay que `Target.setAutoAttach({ flatten: true })` y
habilitar la red **por sesión** en el target que se engancha.

### NO hay DRM, y está verificado de punta a punta

Medido el 2026-08-16 sobre `1.1 Bienvenida`:

- El master trae **5 calidades hasta 1080p real** (1664×1080) y **ningún `EXT-X-KEY`**: los
  segmentos `.ts` van en claro. Cero `.mpd`, cero license server, ni en la página ni dentro
  del iframe.
- La única puerta es el **Referer**: `playlist.m3u8` da **403** pelado y **200** con
  `Referer: https://iframe.mediadelivery.net/`. Es el mismo patrón que Hotmart.
- **Bajado de verdad:** `yt-dlp --referer "https://iframe.mediadelivery.net/" <playlist>` →
  10,45 MB, 19 fragmentos, 6 segundos. **La bajada no necesita navegador**; el navegador
  hace falta solo para RESOLVER qué video es cada lección.

### El plan, resuelto: 25 lecciones → 30 archivos de video

`scripts/avatarhype-plan.mjs` recorre la cadena, clickea cada parte y escribe el
`plan.json` con el formato de siempre. Corrida del 2026-08-16: **30 clases, las 30 con
guid resuelto, 1,9 h** — que cuadra con los 18 + 28 + 71 min que declara la app.

- **7 lecciones vienen en dos partes** (`Producción` + `Edición`), así que 25 lecciones son
  30 archivos. Una entrada de `clases[]` por ARCHIVO, que es lo que consume el pipeline;
  `lecciones[]` conserva la unidad pedagógica.
- ⚠️ **Las partes comparten el id de lección pero NO el guid.** `ugc-con-producto` es
  `id:92` en las dos partes, y sus guid son `2eda142a…` y `df27b1be…`. El guid de la parte 2
  **no se puede deducir** del de la parte 1: hay que clickear cada chip y leer qué pide la
  red. Los 30 guid son distintos entre sí.
- **`musica-efectos` (1.4.3) y `agentes` (1.4.4) son de solo texto**: sin `.ugc-vcard`, sin
  póster y sin duración. Verificado contra un control (`biblioteca-prompts` sí tiene, 5:10).
  El script las marca `sinVideo`, que es un campo distinto de `sinFuente`: **«no tiene
  video» y «no lo pude resolver» son dos preguntas**, y juntarlas hacía que el informe
  pidiera revisar a mano dos lecciones que no tenían nada que revisar.

Dos errores propios del script que conviene no repetir, porque los dos daban un CERO
creíble:

- **El conteo de clips daba 0** en lecciones que piden 28. La causa: `red` se vacía en cada
  vuelta del bucle de partes, y los clips se leían DESPUÉS. Un bucket que se vacía y se lee
  después no contesta «no había», contesta «ya no está». Se leen antes de tocar nada.
- **La parte 2 quedaba sin guid** porque el póster **desaparece después del primer play**
  —lo reemplaza el reproductor— y el script clickeaba un botón que ya no existía usando el
  estado leído al entrar. El estado del DOM se vuelve a mirar en cada vuelta.

Y el conteo de clips del documento (68) es un **piso, no un total**: cargan por lazy-load y
el plan no baja la página. El script lo dice («68 o más»), porque un número sin esa
aclaración se lee como completo.

### Lo que falta
3. **Decidir qué se hace con los 95 clips del documento.** No son clases; son ejemplos
   embebidos en el texto. Si el portal solo quiere las clases, no se bajan — pero entonces
   el documento del módulo 4 queda con agujeros, porque el texto los referencia.
4. **Los recursos:** aparecen `/academy/resources/biblioteca-prompts` y
   `/academy/resources/audio`. El portal dice 13 recursos y la academia declara 4 en UGC:
   falta enumerarlos bien.
5. **Repetir para `/academy/animados`** (2 lecciones, curso que no existe en el portal).

**Vive en:** `scripts/avatarhype-plan.mjs` (el plan, hecho) · `scripts/hotmart-plan.mjs` y
`scripts/hotmart-bajar.mjs` (el molde; falta `avatarhype-bajar.mjs`) ·
`app/conocimientos/curso.ts` (el curso en el portal, hoy con 6 clases)

## Replicar la pantalla de OTRA plataforma: las cinco trampas que costaron cinco rondas

**2026-08-17.** El curso de AvatarHype se replica con su propio CSS (2457 reglas
re-scopeadas a `.ahdoc`) montado dentro del portal de MaKo. El dueño reportó la misma
pantalla rota cinco veces seguidas. Ninguna de las cinco causas era la que parecía.

### 1. La barra de scroll horizontal NO se arregla peleando con el ancho

El CSS de origen espera ser la página entera; adentro del portal vive en un contenedor
centrado con `max-width`. Para que se vea de borde a borde hay que romper la caja, y el
truco estándar es `margin-inline: calc(50% - 50vw)`.

**El problema: `50vw` incluye el ancho de la barra de scroll VERTICAL.** Con una página
que scrollea, el breakout siempre sobra unos pixeles y aparece una barra horizontal. Se
intentó corregir el ancho **dos veces** —una con `width: 100vw`, que además corrió la barra
lateral a `x = -284`— y las dos veces la barra siguió.

Se mata donde se crea, en el documento:

    html:has(.ahdoc), body:has(.ahdoc) { overflow-x: hidden !important; }
    .ahdoc { width: auto !important; overflow-x: clip !important; }

**La regla:** un desborde de unos pocos pixeles producido por una unidad de viewport no se
corrige ajustando esa unidad. Se recorta en el contenedor que scrollea.

### 2. Una barra que no llega arriba puede tener el alto correcto

Síntoma: «la sidebar no está a la altura TOTAL de la página», reportado dos veces. La
barra medía **900 px de alto en una ventana de 900** — el alto estaba bien. Lo que estaba
mal era el origen: arrancaba en **y = 84**, porque arriba vivían el header del portal
compartido (`.al-top`, 60 px) y los 24 px de `padding-top` de `.cono-wrap`. Subirle el
alto no podía arreglarlo nunca; había que sacar lo que la empujaba.

Y el header de afuera era **chrome duplicado**: la réplica ya trae su marca y su «Volver a
los cursos» en la propia barra. Es el mismo contenedor que se reportó tres veces como «la
caja que tapa el papel».

**La regla, para cualquier «no llega hasta el borde»: medí el ALTO y el ORIGEN por
separado.** Son dos causas distintas y el síntoma es el mismo.

### 3. Y el mismo elemento estaba bien en una pantalla y mal en la otra

Después de sacar el chrome, el índice quedó en `y = 0` y la lección seguía en `y = 64`.
Causa: `.ugc-side` es `position: sticky` con el `top: 64px` del origen, donde había un
header de plataforma de 64 px que acá no existe.

**Por qué solo se veía en una:** el índice mide justo 900 px, y **sticky sin scroll
disponible no se despega**. La regla rota estaba en las dos pantallas desde el primer día;
solo la que scrollea la mostraba. Si una medición sale bien, probala en una pantalla más
alta que la ventana antes de darla por buena.

### 4. El F5 volvía al índice con la URL correcta en la barra de direcciones

El síntoma no se parecía al bug: la barra de direcciones decía
`#curso=creativos-ugc-realistas&clase=15` y la pantalla mostraba el índice del curso. Las
dos eran consistentes con su propia lectura, que es por qué no se veía.

**Dos causas apiladas, las dos sobre el mismo hash compartido:**

1. `CursoReplica` escribía el hash arrancando de un `URLSearchParams` vacío — o sea, lo
   **reemplazaba**. En `/conocimientos` daba igual, pero en un link compartido ese hash lo
   comparte con `PortalCompartido`, que guarda ahí el `curso=`. Abrir una clase lo borraba:
   medido en producción, `#curso=creativos-ugc-realistas` pasaba a `#clase=1`.
2. Arreglado eso, el hash sobrevivía **y la pantalla seguía mostrando el índice**. Los dos
   efectos del padre corren en el mismo commit, y el que ESCRIBE lo hace con el `paso` del
   render viejo —todavía vacío—, así que dejaba la URL pelada y recién en el render
   siguiente ponía el curso y la clase. En el medio monta el hijo, y **los efectos del hijo
   corren ANTES que los del padre**: la réplica leía el hash justo en la ventana en que
   estaba vacío.

**Las dos reglas:** el que escribe una clave de un estado compartido **parte de lo que
hay**, nunca de vacío. Y un efecto que RESTAURA de la URL y otro que ESCRIBE a la URL
necesitan un orden explícito — el que escribe espera a que el que lee haya pasado.

### 5. Un pipe que filtra la salida filtra también el error

Un commit salió verde con la mitad adentro. El bloque de reglas del generador vive dentro
de un **template literal**, y el comentario que se agregó traía una comilla invertida: la
cerraba, y el archivo dejaba de parsear. El generador tiraba `SyntaxError`, el
`| Select-String "reglas"` no imprimía nada, y el `git add` del CSS no encontraba ningún
cambio. Se detectó porque el commit dijo **«1 file changed»** donde tenían que ser dos.

**La regla: después de un comando que genera un archivo, verificá el ARCHIVO, no la salida
del comando.** Y si filtrás la salida con un pipe, el filtro tiene que dejar pasar los
errores.

### Lo que gobierna esto de acá en adelante

- El typecheck y los 1025 tests pasan con la barra rota, el video colapsado y la búsqueda
  encima del resto. **En una pantalla replicada lo único que verifica es el DOM medido**,
  y con el número al lado: sin número no es una verificación, es una opinión.
- **Y la verificación tiene que llegar por el camino del usuario.** El primer script de
  prueba escribía `location.hash = 'clase=15'` a mano, lo que borraba el `curso=` — o sea,
  la prueba reproducía el bug que venía a verificar y lo reportaba como fallo después de
  arreglado. Navegando con clicks, dio bien.
- Un byte `NUL` crudo se coló en la clase de saneo del nombre de archivo. Con ese byte
  adentro la búsqueda declara binario el archivo y **no devuelve ni una línea**: contesta
  vacío, y el vacío parece una respuesta. Está en `AGENTS.md`; acá se pagó igual.

**Vive en:** `app/conocimientos/CursoReplica.tsx` (la vista) ·
`app/compartido/[token]/PortalCompartido.tsx` (la carrera del hash) ·
`scripts/avatarhype-css.mjs` (el bloque de cola, que es donde van las reglas nuevas;
regenera `public/cono-doc/ugc.css`).

**Lo que quedó SIN hacer:** el filtro por módulo se muestra escribiendo el nombre del
módulo en el campo de búsqueda — funciona y se entiende, pero no es lo que hace el origen.
Vive en el `setQ(m.nombre)` de `app/conocimientos/CursoReplica.tsx`.

## Cuando la pagina deja de scrollear: la cadena de arreglos que se causaban entre si

**2026-08-17, segunda vuelta.** El dueño reporto «abajo de la tab aun se rompe». La causa
no era un resto de la ronda anterior: **era el arreglo de la ronda anterior**.

### 1. `overflow-x: hidden` no deja el otro eje quieto, y eso mata cualquier `sticky` de adentro

Para matar la barra horizontal se puso `overflow-x: hidden` en `html` y `body`. Funciono.
Pero **cuando un eje es `hidden` y el otro `visible`, el valor USADO del segundo pasa a
`auto`**: `body` se convirtio en un contenedor de scroll. Un `position: sticky` se
posiciona contra su ancestro que scrollea, y ese ancestro pasaba a ser un `body` que no
scrollea — asi que la barra dejo de pegarse **del todo**.

Medido a 1920x880 con `scrollY=302`: `.ugc-side` en `y=-302`, con su `top: 0` puesto.

**Y por eso las cinco verificaciones anteriores daban verde: todas median con
`scrollY = 0`, que es el unico estado en que un sticky roto se ve igual que uno sano.**
Cualquier chequeo de posicion pegajosa que no scrollee no esta verificando nada.

### 2. La salida fue sacar el sticky de la ecuacion, no parchearlo otra vez

La replica es ahora una **app de 100vh**: el shell mide la ventana, la barra es un bloque
normal de alto completo —sin sticky no hay nada de que despegarse— y lo que scrollea es el
contenido; en la leccion, cada columna la suya. De paso la barra horizontal desaparece
sola: **sin scroll de pagina no hay barra vertical, y sin barra vertical no sobra el
ancho** — que era el problema original, con lo cual se cierran los dos con una decision.

### 3. La «cola» del CSS generado iba ANTES del origen

`scripts/avatarhype-css.mjs` armaba el archivo como `cabecera + origen`, con **todas** las
reglas propias adentro de la cabecera. Su propio comentario decia, textual, «ESTAS VAN AL
FINAL Y CON !important». Con la misma especificidad gana la ultima, asi que cada regla
propia perdia contra la del origen, y el sintoma se repitio durante meses: *le pongo
`!important` y no pasa nada*.

Al ordenarlo aparecieron **tres pares de reglas propias peleandose entre si**, donde
siempre ganaba la de mas abajo sin que nadie lo supiera:

| Arriba decia | Abajo decia | Ganaba |
|---|---|---|
| `.ahdoc { overflow: hidden }` | `.ahdoc { overflow: visible !important }` | la de abajo — y con eso se caia la app de 100vh |
| `.ugc-side { position: static !important }` | `.ugc-side { position: sticky !important }` | la de abajo — la barra volvia a despegarse |
| `.ugc-shell { min-height: 0 !important }` | `.ugc-shell { min-height: 100vh !important }` | la de abajo |

**La regla: en una hoja generada, lo escrito a mano va DESPUES de lo importado, y una
regla vive en un solo lugar.** Si aparece dos veces, la de abajo gana en silencio y la de
arriba miente — con el agravante de que la de arriba suele ser la que tiene el comentario
que explica el porque.

### 4. Y habia 4 segundos de curso crudo que se veian igual que una pantalla rota

La hoja del origen son 333 KB y se pedian **recien al montar el componente**. Medido a
1440x900 con la cache apagada: durante mas de 4 segundos el shell renderiza con
`display: block` y la barra queda en `y=984` midiendo 120x984.

No es solo feo: **es el mismo cuadro que el dueño reporto tres veces como «no se ve nada»
y «se ve igual que antes»**. Una pantalla a medio vestir y una pantalla rota son
indistinguibles desde afuera. Ahora el curso no se dibuja hasta que la hoja cargo; si
falla, se muestra sin estilo, porque quedarse en blanco es lo unico inaceptable.

### 5. Lo que aparecio DESPUES, por haber cambiado quien scrollea

Cambiar el scroll de la pagina al contenido rompe cosas que dependian de que scrolleara la
pagina, y ninguna se ve hasta que se prueba el gesto:

- **Las tabs del documento se iban con el scroll** (de `y=102` a `y=-2898`): para pasar de
  Documento a Transcripcion habia que devolver 8000 px de papel. Antes eran parte del
  recorrido normal. **Una barra de navegacion que vive adentro de lo que navega deja de ser
  una barra**; va `sticky` al techo de su columna, y con fondo propio o el papel pasa por
  debajo y queda ilegible.
- **«Volver a los cursos» devolvia al tope de la lista**, con la tarjeta del curso recien
  cerrado en `y=1879`. En una lista de 20 cursos eso no se lee como «volvi» sino como «me
  saco a otro lado». El destino de Volver es una propiedad de la pantalla, si — **pero el
  indice tiene un LUGAR**, y volver sin el lugar es volver a medias.
- **⚠️ Y el `scrollTo(0)` del padre GANA.** Los efectos del hijo corren antes que los del
  padre, asi que el `scrollIntoView` del selector se ejecutaba y el padre lo deshacia un
  instante despues: se veia exactamente igual que si el foco no estuviera implementado.
- **Un `hashchange` no recarga.** Pegar el link de una clase en una pestaña donde el portal
  YA esta abierto dispara `hashchange` y nada mas; el portal solo leia el hash al montar,
  asi que la URL cambiaba y la pantalla se quedaba. El link parecia roto **justo cuando
  alguien lo comparte por segunda vez**.

### 6. Lo que enseño la corrida de 24 agentes

Se midio la pagina desplegada en 7 combinaciones de ventana x vista x gesto, con un
verificador adversarial por hallazgo. 10 confirmados, 52 chequeos en verde. Lo util no
fueron solo los hallazgos:

- **3 de los 10 ya estaban arreglados** en un commit posterior al deploy que midieron, y
  **un verificador lo detecto solo**: «la causa real no es que falte el reset, es que el
  arreglo no esta desplegado». Es la version practica de «un agente no distingue *nunca
  estuvo roto* de *se arreglo hace una hora*»: si se lanza una corrida contra produccion,
  hay que decirle **que commit esta sirviendo**, o parte de lo que devuelve es arqueologia.
- **1 de los 10 no se reproduce.** Dos agentes reportaron que los rotulos de los clips
  quedaban cortados; medidos los 58 rotulos de 5 clases en 2 ventanas, **cero cortados**.
  Lo mas probable es que midieran durante los 4 segundos de FOUC del punto 4 — o sea que un
  bug real de carga se disfrazo de dos bugs de layout que no existen.
- **Una espera fija produce rojos falsos.** Mis propios scripts esperaban N segundos y
  median pantallas a medio montar; dos veces estuve por reportar como bug del producto algo
  que era del arnes. **Se espera a una CONDICION del DOM** —que exista la tarjeta, que el
  documento pase de 3000 px— nunca a un reloj.
- **Y la prueba tiene que llegar por el camino del usuario.** Un script escribia
  `location.hash = 'clase=15'` a mano, lo que borra el `curso=`: reproducia el bug que venia
  a verificar y lo reportaba como fallo despues de arreglado.

### El estado, medido en tres ventanas

A 1920x880, 1280x720 y 1024x680: sin barra horizontal, la pagina no scrollea en ningun
eje, la barra en `y=0` con el alto exacto de la ventana, las dos columnas terminando a la
par, el documento con su scroll propio (7300-10200 px de contenido), el modulo activo
marcado, y F5 conservando la clase.

**Vive en:** `scripts/avatarhype-css.mjs` (el generador; la COLA es donde va todo lo
escrito a mano) · `public/cono-doc/ugc.css` (generado, no se edita) ·
`app/conocimientos/CursoReplica.tsx` · `app/conocimientos/CursoPortal.tsx` (el `foco` del
Selector) · `app/compartido/[token]/PortalCompartido.tsx`.

**Lo que quedo SIN hacer:** en 1280x720 la columna del video gasta el 40% de su alto
(241 de 594 px) en los botones de navegacion y el titulo antes de llegar al reproductor.
Vive en `.ugc-lecnav` + `.ugc-ltitle`, en la COLA de `scripts/avatarhype-css.mjs`.

---

## ⚠️ El portal renumera las clases, y con eso TAPA lo que no se bajó

**Síntoma:** el dueño, mirando el portal a ojo: *«puede ser que en el de Guille falte el
módulo 5»* y *«del primer módulo falta la clase 10 y 28»*. Tenía razón en las tres cosas.
Nada en la app lo decía: la tarjeta anunciaba **«64 clases, 6 módulos»** y el número
cerraba solo.

**Causa:** `n` es una numeración PROPIA, corrida de 1 a N sobre lo que se logró bajar. De
las 66 clases del origen entraron 64 y `n` igual fue 1..64 **sin un solo salto**. El hueco
no se disimula: deja de existir.

Y el campo `modulo` hace exactamente lo mismo. En `curso-hackeando-la-edicion.ts` va 1..6
corrido mientras las ETIQUETAS dicen 1, 2, 3, 4, **6**, 7:

| `modulo:` | `grupo:` |
|---|---|
| 4 | `Módulo 4 - Bonus 1 - Trucos para` |
| 5 | `Módulo 6 - Bonus 3 - Checklist d` ← el 5 del autor no está |
| 6 | `Módulo 7 - Bonus 4 - Sesiones Q&` |

**El único testigo del origen es el TÍTULO**, que se guardó con el número del autor
adentro («10. Cortes en J y L»). Es un accidente afortunado: nadie lo puso ahí para esto.

**La regla que queda:** cuando se ingiere de una fuente ajena, **el identificador del
origen se guarda como dato**, no se reemplaza por uno propio. Una numeración generada no
puede detectar su propia pérdida — es el cuarto contador de esta área que cuenta lo que
hay en vez de lo que debería haber.

**Vive en:** `scripts/curso-huecos.mjs` (el verificador) · `app/conocimientos/curso-*.ts`

**Lo medido, 2026-08-18** — `node scripts/curso-huecos.mjs`, 23 cursos:

- **hackeando-la-edicion** — el verificador marcó el **Módulo 5** y las clases **10 y 28**.
  **VERIFICADO CONTRA LA FUENTE y es un FALSO POSITIVO** — ver abajo.
- **creator-club** — falta el **Módulo 2**. · **m5-95** — falta el **Módulo 8**.
- **avatarhype** — falta el **Módulo 7** y 17 bloques con clases sueltas (las Sesiones
  Semanales son las más agujereadas).
- **master-marca-personal-5-0** — falta la clase 2 de «Cómo hacer contenido viral».
- **5 cursos NO SE PUEDEN EVALUAR** (100m-money-models, aumenta-tu-valor, instituto-de-
  comunicacion, jaque-blue, vender-por-fb-e-ig-ads): anidan submódulos que reinician la
  numeración y ese anidamiento no viaja en ningún campo que se pueda leer.

**Y el gotcha del propio verificador, que es la mitad del valor:** la primera versión
reportaba «REPETIDAS» y «faltan» en esos 5, dando **8 cursos con huecos inventados**.
Números repetidos dentro de un grupo no son duplicados: son la prueba de que la agrupación
es más gruesa que la del origen — y entonces sus «faltan» tampoco valen. Se saltea el grupo
entero y se dice cuántos quedaron sin mirar. Un curso donde TODO quedó sin evaluar se
imprime igual, con `— SIN EVALUAR`: **un contador que se calla no dice «no hay huecos»,
dice «no miré»**, y esa confusión es la que trajo el problema de arriba.

**Lo que queda SIN hacer:** bajar lo que falta. El módulo 5 de Guille y las dos clases
salen con el pipeline que ya está (`curso-perfil.ps1` → `curso-plan.mjs` → `curso-bajar.mjs`);
para los 5 sin evaluar hay que enumerar de nuevo contra la fuente, no contra el `.ts`.

### ⚠️ Y el hueco del curso de Guille NO era nuestro: el diagnóstico obvio era el equivocado

Escrito una hora después de la entrada de arriba, y la corrige.

El verificador dijo «falta el Módulo 5 y las clases 10 y 28», y sonaba redondo: encajaba
con lo que el dueño había visto a ojo y con una causa técnica real (nuestra renumeración).
**Las dos cosas eran ciertas y la conclusión igual era falsa.**

Se fue a preguntarle a la plataforma: Chrome dedicado (`curso-perfil.ps1`) sobre
`https://cursoselite.com.mx/curso/hackeando-la-edici-n` y `curso-plan-vip.mjs`, que captura
la respuesta del RPC `get_vip_lessons_secure` que la propia página pidió. El resultado:

    Clases  : 64          ← las mismas 64
    Módulos : 7 raíz · 11 en total
    en el NUEVO y no en el viejo: ninguna
    en el VIEJO y no en el nuevo: ninguna

**El origen tiene exactamente lo mismo.** El Módulo 5 (Bonus 2) EXISTE en la plataforma y
está **vacío** —por eso el RPC cuenta 7 raíz y solo 6 traen clases—, y las clases 10 y 28
del Módulo 1 no existen: el autor saltea esos números. Nunca se perdió nada bajando.

**La regla:** un hueco en la numeración del autor prueba que **el autor no numera corrido**,
no que nos falte algo. Son dos afirmaciones distintas y la segunda cuesta una hora de
descargas. El verificador SEÑALA dónde mirar; lo que decide es volver a la fuente.

**Y el resultado de esa verificación es un HECHO que no se puede perder.** Vive en
`VERIFICADOS`, adentro de `scripts/curso-huecos.mjs`: sin eso, el mismo curso se investiga
de cero cada vez que alguien corre el script, y a la tercera vez nadie lo corre más.

**Corolario para los otros cuatro** (creator-club Módulo 2, m5-95 Módulo 8, avatarhype
Módulo 7, master-marca-personal clase 2): **están sin verificar**, y después de esto la
apuesta razonable es que varios sean lo mismo. Antes de bajar nada, el RPC.

### ⚠️⚠️ Y la corrección de la corrección: «el módulo está vacío» era mirar por el endpoint que no lo ve

Lo escrito arriba —«el Módulo 5 EXISTE y está vacío»— **es falso**, y lo vio el dueño
mandando una captura de la plataforma: el módulo se llama **«Bonus 2 - Mis LUTs»** y tiene
**ocho archivos `.CUBE`** adentro (LUT Guille 1, 3, 4, 5, 6, 7, 8 y «65 Point Cube_2»).

**Lo que no tiene son LECCIONES**, y el RPC contra el que verifiqué —`get_vip_lessons_secure`—
devuelve lecciones. Contestó cero y lo leí como «no hay nada». **Un endpoint que no puede ver
una cosa no es evidencia de que esa cosa no exista**, y esa frase es toda la lección: verifiqué
con la herramienta equivocada y canté victoria con más confianza que la primera vez.

**Y al ir a mirar por qué, el agujero es del tamaño de la videoteca entera:**

`scripts/curso-plan-vip.mjs` —el que enumera los cursos con submódulos— **no lee `resources`
en ninguna línea** (0 menciones en el archivo). Todo curso enumerado con él nace con
`pdfs: []`, tenga el material que tenga. `curso-plan.mjs` sí los busca, pero solo los del DOM
de la clase abierta (`a[href*="Reader?type=resource"]`), así que el material colgado de un
MÓDULO —como los LUTs— tampoco entra por ahí.

Y el bajador de recursos, `curso-recursos-vip.mjs`, exige una pestaña **`/watch`**, que es del
área `/vip/`. Medido sobre los 31 planes de `C:\cursos`: **26 son de `/curso/`**, 4 de `/vip/`
y 1 de Hotmart. Para el 84% de los cursos ese script nunca pudo correr.

**El resultado, contado en el portal:** de 23 cursos, **19 tienen CERO recursos**. Los cuatro
que tienen son ATV Advantage (71), Sell Your Knowledge (39), el de Claude de Rodrigo Rojo (20)
e Inteligencia Viral (3) — los dos primeros de `/vip/`, los otros dos bajados por el camino de
`curso-pdfs.mjs`.

**La regla que queda:** «verificado contra la fuente» tiene que decir **contra qué fuente y qué
puede ver esa fuente**. Un chequeo que solo mira una de las dos cosas que tiene un curso
—video y material— y contesta «completo» es peor que no tener chequeo: da permiso para dejar
de buscar. En `VERIFICADOS` ahora dice explícitamente «ninguna clase de VIDEO falta».

**Lo que queda SIN hacer, y es lo grande:** enseñarle al pipeline a ver los recursos de
`/curso/` y de MÓDULO, y después pasarlos por los 19 cursos. Vive en
`scripts/curso-plan-vip.mjs` (leer `resources` del RPC), `scripts/curso-recursos-vip.mjs`
(aceptar la pestaña `/curso/`, no solo `/watch`) y `scripts/curso-huecos.mjs` (contar también
recursos, no solo clases).

### El endpoint de los recursos de `/curso/`, y el árbol de TRES niveles que nadie había visto

Capturado con `scripts/curso-api-sniff.mjs` sobre «Hackeando la Edición», 2026-08-18.
El área `/curso/` no usa nada de lo que el pipeline conocía:

| qué | endpoint |
|---|---|
| lecciones | `rest/v1/rpc/get_course_lessons_secure` (¡no el `_vip_`!) |
| **recursos** | `rest/v1/course_resources?select=id,course_id,module_id,title,description,file_type,file_size,is_free,"order",created_at&course_id=eq.<uuid>` |
| **módulos** | `rest/v1/modules?select=*&course_id=eq.<uuid>&is_deleted=eq.false&order=order.asc` |
| ya descargados | `rest/v1/resource_downloads?select=resource_id&user_email=eq.<mail>` |
| el `course_id` | `rest/v1/courses?select=*&slug=eq.<slug>&is_deleted=eq.false` |

**Lo que devolvió para ese curso: 28 recursos.** 16 `.cube`, 4 `.txt`, 4 `.png`, 3 `.pdf`,
1 `.zip`. En el portal tenemos **cero**.

**Y el hallazgo estructural: `modules` tiene TRES niveles.** 7 raíz + 4 con
`parent_module_id`, y de esos 4 hay tres que son nietos:

    Módulo 5 - Bonus 2 - Mis LUTs        propios=0
        └ LUTS                            propios=0
            └ 2a Capa Color Guille        ← acá viven los .cube
            └ Básicos Guille              ← y acá

Por eso el módulo padre marca cero recursos **y también cero lecciones**: todo lo suyo está
dos niveles más abajo. Sumando por módulo raíz solo aparecen 12 de los 28; los otros 16
cuelgan de los nietos.

**La regla:** contar los hijos de un nodo no es contar su subárbol. Cualquier chequeo de
completitud sobre esta plataforma tiene que recorrer `parent_module_id` hasta el fondo —
preguntar «¿este módulo tiene algo?» mirando un solo nivel contesta «no» sobre un módulo
lleno, y eso es exactamente lo que pasó.

**Dos gotchas del capturador, los dos ya resueltos en el script:**

1. **`Network.getResponseBody` en el evento devuelve «No resource with given identifier
   found»** — el cuerpo todavía se está recibiendo. Se piden todos DESPUÉS de la ventana de
   captura. En la salida se ve clarísimo: la misma URL aparece dos veces, una con 53 bytes
   de error y otra con los 8.627 reales.
2. **Un acordeón cerrado no pide nada.** Sin desplegar los módulos, capturar «al cargar» es
   el falso negativo garantizado de esta pantalla. El script hace cuatro rondas de clicks
   —abrir un módulo revela submódulos que también hay que abrir— y espera 6 s antes de la
   primera, porque un React que no montó todavía no tiene los handlers puestos y los clicks
   se pierden sin ruido.

**Vive en:** `scripts/curso-api-sniff.mjs`

---

## El deep research de «que no falte nada»: 401 recursos, 1 curso con clases perdidas, y cinco formas de contar mal

**Disparador:** el dueño, a ojo: *«el curso de inglés le falta el módulo 1, 9 y 12»*. Es
**PROGRAMA RAIO** y `curso-huecos.mjs` contestaba «los cursos revisados están completos».

**El resultado, medido con `scripts/curso-inventario.mjs` + `scripts/curso-faltantes.mjs`:**

    RECURSOS   401 faltan, en 10 cursos. RAIO solo tiene 263.
    LECCIONES  1 curso con clases realmente perdidas: bigseo-academy (136 → 79).
    CATÁLOGO   la plataforma tiene 82 cursos; el portal, 18.

### Las CINCO formas de contar mal que hubo que cerrar para llegar a ese número

Todas produjeron un número creíble y equivocado, y todas son la misma familia: **un
chequeo que no puede ver lo que busca contesta «no hay» en vez de «no sé»**.

1. **El regex del módulo exigía la palabra «módulo».** RAIO llama a los suyos «002.
   INTRODUCTION», «003. CHAPTER 1». Sin la palabra, el chequeo se salteaba ENTERO y daba
   verde. → leer también el número que abre la etiqueta.
2. **Mirar entre el mínimo y el máximo no ve un hueco al principio**, y por construcción
   nunca lo va a ver: si falta el 1, el mínimo pasa a ser 2. Arreglado (1), seguía sin ver
   el módulo 001. → `huecos()` devuelve los del medio (hecho) y el arranque tardío
   (sospecha), separados.
3. **Elegir «la respuesta más grande»** entre varias del mismo endpoint. La página los
   llama antes y después de resolver la sesión. → no se elige: se UNEN por id, con candado
   de `course_id` para no mezclar cursos al navegar.
4. **Rondas fijas de expansión.** La página pide las lecciones A MEDIDA que se despliegan
   los módulos, así que 4 rondas fijas medían el reloj: el mismo curso dio 92, 0 y 30. → se
   itera hasta CONVERGER (dos rondas sin respuestas nuevas), y si se toca el tope se dice
   que el número es un PISO.
5. **Contar filas donde la plataforma tiene el material DOS VECES.** Inflaba 634 contra 407
   reales. El duplicado se marca de tres formas distintas —`(1)`, `Copy of`, `Copia de`— y
   contemplar solo la primera daba 86 lecciones «faltantes» que están todas publicadas.

### Y dos reglas que valen para cualquier inventario, no solo para éste

**Una copia solo es copia si existe el original.** `social-funnel` tiene sus ONCE lecciones
nombradas «Copy of …» —así las subió el autor— y el filtro las borraba todas, dejando el
curso en 0 lecciones en la fuente. Se descarta la copia solo si su gemela sin marca está en
la misma lista.

**El veredicto se apoya en el CONTEO, no en los títulos.** El pipeline REESCRIBE los
títulos al ingerir (limpia, corrige mayúsculas, saca prefijos), así que cruzar por título
produce huecos que no existen: «AS BAJO LA MANGA» y «Haz Bajo La manga» son la misma clase.
De ahí salían 86 faltantes. Si el portal tiene tantas o más que la fuente, no se perdió
ninguna, digan lo que digan los títulos.

### Lo que quedó SIN medir, y por qué importa decirlo

`instituto-de-comunicacion` **no se pudo capturar** ni con esperas largas: su URL cae en el
catálogo, no en el curso. Los otros cinco (`creativos-ugc-realistas`, `creator-club`,
`producto-app`, `ugc-recursos`, `vsl`) no tienen `plan.json` con página, o están en otra
plataforma. **`avatarhype` vive en `app.avatarhype.online`** y necesita capturar sus
endpoints desde cero — su auditoría no está hecha.

**Vive en:** `scripts/curso-inventario.mjs` · `scripts/curso-faltantes.mjs` ·
`scripts/curso-huecos.mjs` · `C:\cursos\<slug>\inventario.json` ·
`C:\cursos\catalogo-plataforma.json`

---

## Avatarhype: otra plataforma, sin API, y un curso ENTERO que el portal no tiene

Medido el 2026-08-19 con el Chrome dedicado sobre `app.avatarhype.online`.

**No hay API que capturar.** `curso-api-sniff.mjs` apuntado ahí devolvió CUATRO llamadas y
las cuatro eran de Sentry. No es que la página no pida datos: es que es un **Next.js que
renderiza en el server** y manda su contenido en el HTML (`self.__next_f`), no en XHR a
`/api/`. El filtro del sniffer tenía una lista blanca escrita contra Cursos Élite
(`/rest/v1/`, `/rpc/`, `supabase`) — y una lista blanca contesta **«no hay API»** sobre una
plataforma que no conoce, que es el mismo cero-ambiguo de siempre. Por eso ahora tiene
`--todo`, que la apaga y ordena por tamaño: lo que trae los datos casi siempre es lo más
pesado que no es un asset. Con eso apareció el documento de 157 KB.

**Pero ese documento es el diccionario de traducciones, no el curso.** El contenido real lo
monta el cliente después de hidratar.

**Lo que SÍ quedó verificado, leyendo el DOM:**

- La academia tiene **DOS cursos**: `/academy/ugc` («Creativos UGC Realistas») y
  `/academy/animados` («Creativos Animados»).
- **`Creativos Animados` NO ESTÁ EN EL PORTAL.** Ni el curso, ni sus módulos, ni sus
  recursos. Confirmado contra `app/conocimientos/`: los únicos parientes son
  `curso-creativos-ugc-realistas.ts` (el otro curso) y `curso.ts` («Curso AVATARHYPE», la
  estructura vieja de 447 clases).
- De su estructura se alcanzó a ver: el módulo `sistema-8-prompts` («El curso completo de
  Ads Animados»), la lección `bienvenida`, y que existe una ruta de recursos aparte,
  `/academy/resources/<slug>?from=<curso>`.

**Lo que NO se pudo medir, y es la mitad del trabajo:** el conteo de lecciones y recursos
de los dos cursos. El cuerpo de la página se queda en «Cargando…» durante toda la sonda
—incluidos 30 s de espera activa— así que del DOM solo se saca la cáscara del SSR:
encabezados y los pocos links que ya vienen renderizados. **Sin ese número no se puede
decir cuánto falta de avatarhype**, solo que falta un curso entero.

Por dónde seguir, en orden de probabilidad: mirar por qué no hidrata (¿un chunk que no
resuelve en un Chrome con CDP?, ¿un gate de suscripción?), o atacar el payload RSC
(`self.__next_f`) parseándolo en vez de esperar al DOM — es el mismo dato, servido antes.

**Vive en:** `scripts/curso-api-sniff.mjs` (`--todo`, `--url`)

---

## ⚠️ Las dos clases de Clonación estaban bajadas, transcriptas y SUBIDAS, y el portal publicaba 30 de 32

**Síntoma:** el dueño, mirando el portal: *«no está toda la parte de clonación en MaKo»*.

**La cadena, verificada eslabón por eslabón:**

| paso | Clonación P1 y P2 |
|---|---|
| en el plan (`sinFuente: false`) | ✅ la plataforma las tiene |
| `video/*.mp4` bajado | ✅ |
| `audio/*.m4a` | ✅ |
| `texto/*.md` transcripto | ✅ |
| **subido a Drive** | ✅ (carpeta «Definir voz y clonación») |
| **`drive.json`** | ❌ **solo tenía n=1..30** |
| portal | ❌ 30 de 32 |

**Todo el trabajo estaba hecho. Lo único que faltaba era el ID.** `drive.json` se había
escrito antes de que Drive terminara de indexar esos dos —la «cola del final» que ya está
documentada más arriba— y nunca se refrescó. Se arregla con
`curso-a-drive.mjs --plan … --solo-ids`, que releyó los 32 sin re-copiar nada.

**Y con la clase se iban sus otros insumos.** El `continue` que la descartaba corre ANTES
de que el código pregunte por el documento replicado, así que
`public/cono-doc/clonacion-parte-1.json` y `-2.json` estaban **commiteados en el repo y sin
ninguna pantalla que los pudiera abrir**. Al republicar, sus `docSlug` volvieron solos.

### La causa raíz: «no tiene id de Drive» ≠ «no existe del otro lado»

El generador trataba las dos igual, y encima **afirmaba la causa que no había verificado**:
imprimía «el video no existe del otro lado» sobre clases cuyo plan dice `sinFuente: false`.
El campo que las distingue existe desde siempre y `curso-a-portal.mjs` **no lo leía en
ninguna línea**.

Ahora:

- `sinFuente: true` → la fuente no lo tiene. Se omite y se dice, como antes.
- `sinFuente: false` sin id → **se ABORTA la emisión**, con el comando para arreglarlo. No
  es un aviso: un `console.log` entre veinte líneas no lo lee nadie, y la ficha salía igual
  con menos clases de las que el curso tiene. Es la misma decisión que ya se había tomado
  con los recursos.

### Barrido: a cuántos más les pasa

`plan.json` contra `drive.json`, los 32 cursos con plan:

    100M money Models          35 → 33    n=1, n=35    sinFuente: true  → correcto
    ATV ADVANTAGE             249 → 247   n=78, n=125  sinFuente: SIN DECLARAR → ⚠ sospecha
    Creator Club               64 → 62    n=2, n=52    sinFuente: true  → correcto
    Mateo Maffia BYF           34 → 33    n=30         sinFuente: true  → correcto
    Creativos UGC Realistas    32 → 32    ✅ arreglado

**5 de las 7 son legítimas** (links, packs de recursos, brutos sin publicar). **Las 2 de ATV
Advantage quedan como sospecha real**: `sinFuente` sin declarar y sin copia local, así que
no se puede afirmar ni que falten ni que no existan. Hay que mirarlas contra la fuente.

**Vive en:** `scripts/curso-a-portal.mjs` · `scripts/curso-a-drive.mjs` (`--solo-ids`) ·
`C:\cursos\<slug>\drive.json`

---

## ⚠️ La transcripción estaba impecable, y era media clase

**Síntoma:** ninguno. La ficha del curso se ve completa, la clase tiene su transcripción,
el texto está bien escrito y bien puntuado. Simplemente termina antes que la clase.

Medido en **Creator Club: 50 de 62 audios cortados**, uno al **2 %** —1,7 minutos de habla
para una clase de 69— y los 50 publicados en el portal. Cuatro clases más en **ATV
Advantage** (167-170), que cortan a mitad de palabra: *«…yo puse si la persona me escribe
de, de mensaje-»*.

**Causa raíz — una carrera:** el audio se extrajo mientras `yt-dlp` todavía estaba
escribiendo el `.mp4`, así que ffmpeg copió lo que había hasta ese momento. El guard de
`.part` que existe en `curso-audio.mjs` cubre el caso en que el temporal sobrevive; cuando
no queda ninguno, no hay nada que delate el corte.

**Y por qué siguió pasando después de arreglarse solo:** `valido()` contesta si el archivo
**decodifica**. Se lo estaba usando para contestar si está **completo**, que es otra
pregunta. Un audio de 4 minutos de una clase de 24 decodifica perfecto, así que la
reanudación decía «ya estaba» corrida tras corrida y el archivo malo era permanente.

> **La regla:** cuando un paso deriva un archivo de otro, lo que se verifica es que llegue
> hasta el **final de la fuente**. La integridad se mide contra el original, nunca contra
> sí mismo. `valido()` (decodifica) y `completo()` (dura lo que tiene que durar) son dos
> funciones a propósito.

### La vara que funciona cuando el video ya no está

`curso-audios-cortos.mjs` compara duraciones, pero **solo puede ver los cursos que todavía
tienen el video en disco** — y el video se libera al subir a Drive. Barrió 3 de 18 cursos y
decir «solo creator-club tiene el problema» habría sido, otra vez, un chequeo que no puede
ver algo contestando «no hay».

Lo que sí sobrevive es lo publicado: cada clase lleva su duración en `cardDesc` y su texto
en `public/cono-tx/<videoId>.json`. Con eso se miden **palabras por minuto**, y el umbral se
calibró contra las **1.306 clases** del portal:

    curso sano            mediana 158-207 wpm     clases bajo 40 wpm: 0
    creator-club          mediana  41 wpm         clases bajo 40 wpm: 31
    ATV Advantage         mediana 181 wpm         clases bajo 40 wpm: 4  ← 167-170

**Cero falsos positivos en 1.306 clases**, y los 4 de ATV se verificaron uno por uno: los
tres leídos cortan a mitad de frase. El margen es enorme (40 contra una mediana sana de
~170), pero es un proxy: una clase legítimamente callada —un screencast sin voz— caería
adentro. Por eso el veredicto se confirma leyendo el final del texto, que es lo que
distingue «clase callada» de «corte».

**Vive en:** `scripts/curso-audio.mjs` (`completo`, `TOLERANCIA`) ·
`scripts/curso-audios-cortos.mjs` · `public/cono-tx/<videoId>.json`

---

## Cien de los 283 recursos de RAIO eran metadata del Finder

Cuando alguien sube una carpeta desde una Mac, el Finder mete un hermano `._<nombre>` por
cada archivo: el *resource fork* (AppleDouble), ~1,8 KB, que no abre con nada. La
plataforma los ingirió como recursos más, así que **la API los declara igual que a los
buenos** — mismo `file_type`, mismo módulo, `file_size` propio.

En «Programa RAIO» son **100 de 283**: el 35 % de la corrida (~43 minutos de descarga a 26
s por archivo) y, publicados, cien filas en «Recursos» que al hacer clic no muestran nada.
El filtro va en la **descarga**, no en el portal: lo que no se baja no se sube a Drive, no
se indexa y no se publica.

### Y el bug que los volvió peores: un tamaño que no matchea se guardaba igual

Los 45 que alcanzaron a bajarse pesaban **todos exactamente 17.576 B** —un solo hash para
los 45— cuando la metadata declaraba 1.836. Era el mismo asset de la página guardado 45
veces con 45 nombres distintos.

`porLector()` elige entre los candidatos que llegaron por el que coincide con el
`file_size` declarado. Cuando ninguno coincidía, escribía el motivo en `descartes`
—una variable que **solo se lee en la rama de error**— y devolvía el candidato igual:

```js
if (mejor) {
  if (bytesEsperados) descartes.push(`ninguno pesa los ${bytesEsperados}B declarados…`);
  return mejor;                                   // ⛔ detecta, anota, y sigue
}
```

Es el `console.warn` que no frena nada de `AGENTS.md`, pero sin llegar siquiera a un log.

> **La regla:** si se declaró un tamaño y ningún candidato lo tiene, **eso es un fallo**.
> `file_size` existe justamente para identificar cuál de los candidatos es el archivo;
> ignorarlo cuando no coincide es tirar el único dato que lo distingue. Y **un archivo
> equivocado es peor que un archivo que falta**: el que falta se vuelve a intentar, el
> equivocado se publica.

### Repetido no es duplicado: el criterio incluye el MÓDULO

La plataforma tiene material cargado más de una vez. El mismo `.xlsx` está **seis veces en
el módulo 3** de «Vender por FB e IG Ads»; el mismo `.txt` de 464 B, **siete veces** en
RAIO. Los nombres no coinciden —el numerito de orden («2.», «3.», «5.») lo pone la
plataforma y es distinto en cada copia—, así que se compara por hash.

**Pero deduplicar por contenido a secas rompe el caso legítimo:** `atajos apple.pdf` está
colgado del módulo 0 **y** del 4 de Guille, y eso lo hizo el autor a propósito — sacarlo
del segundo le saca al lector el material de ese módulo. Lo que sobra es la copia que cae
en el **mismo lugar** que otra.

**Vive en:** `scripts/curso-recursos-vip.mjs` (`esFinderJunk`, `porLector`, el bloque de
dedup por `moduloId + hash`)

### Lo que quedó pendiente de esto

- **Las 4 clases de ATV Advantage (167-170)** hay que volver a bajarlas de la fuente: el
  video local ya no está, así que no alcanza con re-extraer el audio.
- **`curso-recursos-todos.mjs` sigue midiendo «lo que falta» con `recursosUnicos`**, que
  cuenta los `._` y las copias intra-módulo. Después de esta limpieza el número de la
  fuente siempre va a ser mayor que el del portal, así que el listado de pendientes marca
  cursos que ya están completos. Es cosmético (las corridas ahora saltean lo que ya está),
  pero el conteo miente.

---

## El módulo 2 de AvatarHype no era una ausencia: era una TABLA

**El síntoma que reportó el dueño:** «¿por qué aparece módulo 1, 3, 4, 5? ¿Falta un 2?».

No faltaba: el módulo 2 de «Creativos UGC Realistas» **no son vídeos-lección**, es el
«Catálogo de modelos IA» — una tabla que la propia academia rotula `tabla` en vez de
`n/m · min`. El pipeline enumera LECCIONES, así que un módulo sin lecciones no produce
ninguna entrada y desaparece del portal sin dejar hueco. Es el mismo modo de falla que el
«Módulo 5 vacío» de Guille (que tenía 8 `.CUBE` y ninguna clase): **un enumerador que solo
sabe contar una clase de cosa reporta cero, no «hay algo que no sé leer»**.

Y tenía **más** que la tabla: un vídeo de 2m56s detrás del botón «Ver el vídeo del
catálogo», que no está en el DOM hasta que se hace clic.

### Cómo se llega

- El módulo vive en `?view=m2`, no en una ruta propia: `/academy/ugc?view=m2`.
- El vídeo es un `iframe` de **Bunny Stream** (`iframe.mediadelivery.net/embed/683445/<guid>`)
  que aparece recién al clickear `button.ugc-catsplit-poster`. Se baja igual que el resto
  del curso: `https://vz-e3242c91-fe8.b-cdn.net/<guid>/playlist.m3u8` con
  `Referer: https://iframe.mediadelivery.net/`.
- La tabla es `.ugc-catalog`, dos bloques (`Modelos de generación de imagen` y
  `Catálogo de modelos` de vídeo), y se guarda como documento en el mismo formato que las
  otras 27 lecciones → `public/cono-doc/catalogo-modelos-ia.json`.

### ⚠️ Al sitio se le CAEN LETRAS, y no es un bug de la captura

Leyendo los links del menú volvió `Cur o`, `Propue ta`, `Editore  y creativo`; y la bajada
del módulo, `Lo  modelo  que u amo  para imagen y vídeo`. **Falta la «s», siempre la «s».**

No es encoding ni el `\`-por-`/` de la herramienta de búsqueda: es una **animación de
revelado por carácter**, leída a mitad de camino. Un texto capturado así se ve como texto
normal —bien puntuado, con sentido— y termina publicado con palabras mutiladas.

> **La regla:** en esta plataforma, cualquier texto se lee DOS VECES y se comparan; si
> difieren, la animación no terminó. Y ojo con el modo de falla contrario: un script que
> lee la página actual **sin navegar** devuelve vacío cuando el navegador quedó en otra
> ruta — y si escribe el resultado, pisa la captura buena con una vacía.

**Cómo se numeran los módulos, que es lo que permitió arreglarlo barato:** `curso-a-portal`
hace `modulos.indexOf(c.modulo) + 1` sobre el **orden de aparición en `plan.clases`**, no
sobre `n`. Insertar la entrada del Catálogo en la posición 9 del array con `n: 33` deja la
numeración en 1-2-3-4-5 —igual que la fuente— **sin tocar ningún `n` existente**.
Renumerar habría obligado a renombrar 23 archivos en `video/`, `audio/`, `texto/` y en la
carpeta de Drive.

**Vive en:** `C:\cursos\creativos-ugc-realistas\plan.json` (clase `n: 33`, módulo
«Catálogo de modelos IA») · `docs/catalogo-modelos-ia.json` · `scripts/avatarhype-*.mjs`

### «Creativos Animados»: el curso que falta, y por qué conviene esperar

`/academy/animados` existe y el portal no lo tiene: **1 módulo, 2 lecciones, 22 min**
(`/academy/animados/bienvenida` y `/academy/animados/sistema-8-prompts`). Pero la propia
academia avisa arriba de todo: *«🚧 ACTUALIZACIÓN COMPLETA EN CAMINO — estamos regrabando
desde cero todo el apartado de Ads Animados»*. Ingerirlo ahora es trabajo que se tira.
Queda anotado con su ruta para volver cuando el autor lo publique.

---

## BigSEO tenía 77 de 136 clases, y el chequeo que lo sabía salía con código 0

**Síntoma:** el curso se ve completo en el portal. 77 clases, sus transcripciones, sus
recursos. Nada roto. Le falta el **43 %** del contenido — los módulos 14 a 26 enteros.

**Causa:** `curso-plan.mjs` **ya comparaba** el plan contra el total que declara la ficha
del curso, y lo imprimía con el número exacto:

    ⚠ LA FICHA DICE 136 LECCIONES Y EL PLAN TIENE 77.

…y después `process.exit(faltan ? 3 : 0)`, donde `faltan` es **otra** variable. Salía 0.
El curso se bajó, se transcribió, se subió a Drive y se publicó, con ese aviso impreso en
una consola que nadie volvió a mirar. Es, textual, el «un `console.warn` no es un control»
de `AGENTS.md`, cometido en el primer eslabón de la cadena — donde más caro sale, porque
todo lo de abajo hereda el recorte.

> **La regla:** un chequeo que compara contra la FUENTE tiene que poder **hacer fallar** al
> script. Si solo imprime, es documentación de un problema, no un control.

⚠️ **Lo que NO está probado:** que el tope de 8 rondas de acordeones fuera la causa. Al
re-enumerar hoy la página vino con los 27 módulos desplegados desde la ronda 1. El tope
subió a 40 y ahora avisa si se agota creciendo, pero la causa del recorte original quedó
sin identificar. Lo único demostrado es que el chequeo no frenaba nada.

### El barrido: a cuántos más les pasa

Inventario (lo que dice la API) contra el plan, los 19 cursos con inventario:

    bigseo-academy                   136 fuente →  77 plan   ⚠ faltan 59
    jaque-blue-creacion-de-contenido  23 fuente →  20 plan   ⚠ faltan 3
    (los otros 17)                    cuadran

Donde el plan tiene **más** que la fuente (`vender-por-fb` 242 contra 170,
`programa-raio` 201 contra 193) no falta nada: una lección puede venir en varias partes y
el plan las aplana en una entrada por ARCHIVO. `instituto-de-comunicacion` tiene el
inventario en 0 (la captura falló) y por lo tanto **no se puede afirmar nada de él**.

### ⚠️ La plataforma REPUBLICA cursos enteros, con ids nuevos y el mismo contenido

Al re-enumerar, los `videoId` de Vimeo pasaron de `1199xxxxxx` a `1219xxxxxx` con
**intersección cero** — ni la clase 1 coincidía. La conclusión fácil («re-grabaron el
curso, hay que bajar los 136 de nuevo») era la equivocada: **las duraciones son idénticas**
clase por clase (la 1 dura 1:26 en las dos versiones, «Keywords» 21:35 en las dos). Es el
mismo material resubido, más 13 módulos nuevos.

Eso convierte «volver a correr el plan» en una operación peligrosa, porque el `n` es la
clave de todo lo que ya se hizo:

    drive.json            mapea n → videoId de Drive
    video/ audio/ texto/  los archivos empiezan por «NN - »
    public/cono-tx/       la transcripción vive bajo el videoId que sale de ese mapeo

Pisar el plan con la numeración nueva no deja un curso incompleto: deja uno **MEZCLADO**,
con la clase 50 apuntando al video de otra, y eso no se ve hasta que alguien escucha.

### Qué hace que dos entradas sean la misma clase

Se probaron cuatro criterios contra los datos reales, y tres fallan:

| criterio | resultado |
|---|---|
| `videoId` | **0 de 77** — la republicación los cambió todos |
| módulo + título | **38 de 77** — el plan viejo trae los encabezados concatenados de la clase 33 en adelante («Modulo 06 - Headings Modulo 07 - Contenidos») |
| título solo | ambiguo — «Introducción» aparece una vez por módulo, 18 veces |
| **título + duración** | **77 de 77** ✅ |

La duración es la que hace el trabajo pesado: sobrevive al reformateo del título —el
número de orden viene pegado adelante de forma inconsistente («01. Introducción»,
«02Qué es el SEO», «03.Google»)— y sobrevive a la republicación.

`scripts/curso-plan-ampliar.mjs` es eso: conserva `n` y `archivo` de la entrada vieja
(el único enganche con el disco y con Drive), **refresca el `videoId` desde el plan
nuevo** —el viejo ya no resuelve después de una republicación— y numera las nuevas
después del máximo existente. Y si una clase vieja **no** aparece en el plan nuevo,
**frena**: puede ser que el autor la sacó o puede ser que la enumeración nueva también
salió corta, y esas dos cosas se ven igual.

**Vive en:** `scripts/curso-plan.mjs` (`incompleto`, `topeAlcanzado`, el `process.exit`) ·
`scripts/curso-plan-ampliar.mjs`

---

## El día que OpenAI se quedó sin crédito a mitad de un curso

`transcribeMediaBuffer` (`lib/transcribe.ts`) era **una sola llamada a OpenAI, sin
fallback**. En medio de re-transcribir las 62 clases de «Creator Club», la cuenta se
quedó sin crédito y 7 quedaron sin transcripción — después de haber gastado el audio de
las otras 55.

Y el modo de falla es peor de lo que parece: **el `.md` viejo (truncado) seguía en disco**,
así que republicar el curso habría publicado el texto cortado igual, sin ninguna señal.
Lo único que lo evitó fue el chequeo de frescura por fecha que se había agregado horas
antes.

La cascada ahora es **gratis primero**: `whisper-large-v3-turbo` (Groq) y después
`whisper-1`. No es una degradación —el de Groq es un modelo más grande— y es la misma
regla que gobierna el chat: lo que cobra es el último recurso, no el segundo.

> ⚠️ **Y el proveedor que escuchó se escribe en la cabecera del `.md`.** «Un fallback que
> no cobra es una degradación silenciosa»: si mañana un proveedor transcribe peor, la
> única forma de enterarse es que el artefacto diga quién lo hizo. Ya sirvió — la clase 64
> dice `whisper-1` y las otras `whisper-large-v3-turbo`, que es un dato que antes no
> existía.

**Por qué no se usa la cascada de `lib/ai-cheap.ts`**, que sería «una cosa, un lugar»: ese
módulo tiene `import 'server-only'`, resuelve credenciales por workspace (`credWs`) y
registra uso en la base. Desde un script de línea de comandos son tres efectos que nadie
pidió. Lo que sí se comparte es el criterio.

**Lo que quedaba pendiente acá YA SE HIZO, y trajo su propio problema:** Gemini se sumó
como tercer escalón (`sttGemini`, por `generateContent` con `inline_data`). Sirvió para
lo que se esperaba y falló por donde nadie miró — el TAMAÑO de las piezas. Sigue abajo,
en «La cascada tenía tres proveedores y para un archivo largo tenía UNO».

**Vive en:** `lib/transcribe.ts` (`STT_CASCADA`) · `scripts/curso-transcribir.ts` (la
cabecera del `.md`)

---

---

## La cascada tenía tres proveedores y para un archivo largo tenía UNO

**Síntoma.** El bucle de transcripción de BlueHacker reportaba, corrida tras corrida,
**32 clases falladas** con el mensaje `ningún proveedor pudo transcribir`. Los tres
escalones contestaban a la vez:

| Proveedor | Qué decía |
|---|---|
| Groq `whisper-large-v3-turbo` | `Rate limit … 7200 s de audio por hora, usados 5100, pedidos 5242` |
| OpenAI `whisper-1` | `You have no credits remaining` |
| Gemini | `20.6 MB: no entra inline (tope 14 MB)` |

**El diagnóstico obvio era el equivocado.** Leído rápido, esto es «se acabaron los
recursos, hay que esperar la cuota» — y la cuenta cerraba: 40 piezas de ~5.200 s contra
7.200 s por hora son **28 horas de reloj**. La causa real no era la cuota: era que el
tercer proveedor estaba **estructuralmente excluido** de exactamente los archivos que más
lo necesitaban, y nada lo decía.

**La causa.** `curso-audio.mjs` partía el audio a **20 MB**, un número elegido contra el
tope de OpenAI y Groq (25 MB). Pero el ÚLTIMO escalón de la cascada es Gemini, que manda
el audio **INLINE dentro del request** y topea en **14 MB**. Una pieza de 20 MB no puede
llegar a Gemini nunca. Las clases cortas se partían solas por debajo del tope y tenían
sus tres escalones; las **Sesiones Semanales** de 60 a 185 minutos, que son las que más
chance tienen de encontrar a Groq sin cuota, nacían con **uno**.

Medido: de las 32 falladas, **las 32** tenían una pieza por encima de 14 MB. **Ninguna**
falló por otra causa. Y la comprobación al revés también dio limpio: clases sin texto
cuyas piezas SÍ entraban en 14 MB, cero.

**El arreglo son dos cifras y ninguna línea de lógica.** `MB_OBJETIVO` pasa de 20 a
**13** (a 32 kbps, ~56 min por pieza), que entra en los tres proveedores. Las 32 de
BlueHacker se re-partieron desde el `.m4a` que ya existía —el `.mp4` estaba liberado a
Drive— con `-c copy`: en audio todo frame es keyframe, así que cortar sin recodificar no
pierde nada. Verificando **antes de borrar el original** que la suma de las piezas nuevas
duraba lo mismo y que ninguna pasaba los 14 MB. A los 90 segundos de relanzar, el log
decía `✓ (gemini-flash-latest)`.

**La regla que queda, y no es de este script:** *un tope de tamaño elegido contra UN
proveedor apaga a los demás en silencio.* Se elige contra el **más restrictivo de todos
los que se piensa usar**, no contra el primero de la lista. Es la misma familia que «un
total solo se puede sumar si el recurso se puede MOVER DE LUGAR» de `AGENTS.md`: tener
tres proveedores configurados no es tener tres proveedores disponibles, y el indicador
—«la cascada tiene tres escalones»— afirmaba una capacidad que para media biblioteca no
existía.

**Y el corolario de cómo se detecta:** el mensaje de error estaba **completo y correcto**
desde el primer día — decía los tres motivos, con el tamaño y el tope al lado. Lo que
faltaba era que alguien **contara**: 32 de 32 con la misma marca no es una racha de mala
suerte con la cuota, es una condición. Cuando un fallo se repite, la pregunta no es «¿por
qué falló éste?» sino «¿qué comparten TODOS los que fallaron?».

**Vive en:** `scripts/curso-audio.mjs` (`MB_OBJETIVO` / `SEG_MAX`) ·
`lib/transcribe.ts` (`MAX_INLINE_GEMINI`, el tope de 14 MB) ·
`scripts/curso-transcribir.ts` (agrupa las `.parteNN` en un solo `.md`)

---

## `--liberar` sabía si el video estaba a salvo, no si ya se había usado

**Síntoma:** ninguno. Este no se rompió — se encontró leyendo el guard, y es el tipo de
agujero que aparece meses después como «esta clase no tiene transcripción y no sé por qué».

`curso-a-drive.mjs --liberar` borra el `.mp4` local y tenía cuatro condiciones, todas
correctas y todas contestando **la misma pregunta**: ¿está a salvo del otro lado? (dentro
de `video/`, con id de Drive, la copia coincide byte a byte, y Drive reporta ese mismo
tamaño). Correcta para el video **como archivo**. Incompleta para el video **como
insumo**: es la ENTRADA de `curso-audio.mjs`, y sin audio no hay transcripción nunca más.

En BlueHacker no explotó por el **orden del circuito** (mover → audio → drive `--liberar`),
no porque el guard lo supiera. Corriendo `--liberar` suelto —que es exactamente para lo
que existe la bandera— las 105 clases liberadas se habrían ido sin audio. Y el modo de
falla es silencioso: la clase se ve **completa** en el portal, con su visor de Drive
funcionando; lo único que falta es el texto, que nadie mira hasta que lo busca.

**La regla:** cuando un guard protege un borrado, enumerá **para qué sirve** lo que se
borra, no solo **dónde está copiado**. Si algo es insumo de un paso posterior, «está
respaldado» no alcanza: el respaldo no es la entrada del pipeline.

Quinta condición, en positivo como manda `AGENTS.md`: existe `audio/<archivo>.m4a` o sus
`.parteNN.m4a`.

**Vive en:** `scripts/curso-a-drive.mjs` (el bloque `if (LIBERAR)`)

---

## El shell de este entorno se come las barras invertidas

No es del proyecto, es de la herramienta, y costó tres intentos seguidos. Al pasar código
por `node -e` o por un heredoc **incluso con el delimitador citado**, una barra invertida
duplicada llega al archivo como una sola. En una regex eso convierte «un punto literal»
en «cualquier carácter», que **casi siempre da el mismo resultado** y por eso pasa
desapercibido. En un template literal, la barra sobreviviente se evapora del todo.

Es primo de «lo que devuelve la búsqueda NO es el archivo» de `AGENTS.md`: el transporte
mangló el contenido, y la verificación ingenua confirma la versión manglada.

- **Verificá los bytes con `JSON.stringify` de la línea**, no con `sed` ni leyendo el eco
  del comando.
- **O escribí el código sin barras invertidas.** `nombre.slice(0, nombre.lastIndexOf('.'))`
  dice lo mismo que la regex y no tiene nada que el shell pueda comerse; lo mismo
  `String.fromCharCode(10)` en vez de un salto de línea escrito como escape.
- Las palabras entre backticks dentro de un comentario **se ejecutan** (un
  `command not found` en medio de la salida es la firma) y dejan un hueco en el texto.
- Y un documento con tablas, backticks y comillas **no entra por heredoc**: se escribe
  como archivo y se empalma.

**Vive en:** cualquier edición hecha desde `Bash`; ya mordió en `scripts/curso-a-drive.mjs`

# Barrido de 37 agentes sobre el pipeline — 2026-08-20

Cinco lentes independientes (foto vieja · «no lo veo» = «no hay» · frescura de derivados ·
detecta-y-sigue · integridad de lo publicado), cada hallazgo con un verificador que
intentaba **refutarlo** leyendo el archivo real. 19 sobrevivieron.

## Lo que se arregló, y la regla de cada uno

**Rehacer una transcripción borraba los apuntes.** La cabecera del `.md` se arma de cero y
el script nunca leía el destino. El camino de rehacer-por-fecha que se agregó ese mismo día
—correcto y necesario— abrió la puerta a pisar el único dato del archivo que **no es
derivado** y que vive fuera de git. Y en tanda: cada audio que `completo()` detecte cortado
deja su `.md` por rehacer. Medido antes de que pasara: **0 de 1.649** `.md` tienen apuntes,
así que no se perdió ninguno.

> **La regla:** antes de agregar un camino que REESCRIBE un archivo que hasta entonces solo
> se creaba, listá qué hay adentro que nadie pueda volver a generar.

**La guarda de clases huérfanas escribía la ficha y después decía «NO emito la ficha».**
`writeFileSync` estaba ocho líneas **antes** del `process.exit(1)`, y las huérfanas se sacan
del array mucho antes: el `.ts` quedaba en disco recortado, con su `subtitulo: '33 clases'`
al lado de un array de 31. El mensaje decía exactamente lo contrario de lo que había pasado.
La guarda gemela —la de recursos, mismo espíritu y mismo texto— sí corta antes de que el
cuerpo exista: **se había copiado el mensaje y no la posición.**

> **La regla:** una guarda que dice «no emito» corre ANTES de emitir. Si el chequeo depende
> de datos que recién existen al final, se escribe a un temporal y se renombra al pasar.

**`sinFuente: !p.guid` convertía una falla nuestra en un hecho sobre el curso ajeno.**
`sinFuente` significa «la plataforma no tiene ese video» —río abajo `curso-bajar` la saltea
y `curso-a-portal` imprime «la fuente no las tiene» y publica sin ella, con exit 0— pero en
avatarhype el guid sale de **olfatear la red** con 2 intentos de 8 s. O sea: «no lo pude
capturar». Ahora es `guidNoResuelto` y hace salir 4.

> **La regla:** un campo que describe la FUENTE no se puede calcular desde el resultado de
> nuestra captura. Si el nombre del campo habla del mundo y el cálculo habla de nosotros,
> ahí hay un hecho inventado.

**El filtro de `._` se aplicaba en un extremo de la cadena y no en el otro.** El bajador
dejó de bajar la basura del Finder, y los dos consumidores del inventario siguieron
contándola como «lo que la fuente tiene»: «Programa RAIO» quedó con **«80 faltan»
permanente** —y con `--aplicar`, un lote de cuatro pasos que volvía a bajar, subir, esperar
ids 10 minutos y republicar 183 recursos para terminar donde estaba— y `curso-faltantes.mjs`
lo afirmaba bajo el rótulo «y acá el número **SÍ es duro**». `esFinderJunk` se mudó a
`curso-comun.mjs`.

> **La regla:** un cambio de política que solo se aplica en un extremo de la cadena no es un
> filtro, es una **discrepancia**. Y un pendiente que no se puede completar nunca no es un
> pendiente: es ruido que tapa a los reales.

**Un fix de generador solo vale para lo que se vuelve a generar.** Las 116 tarjetas de
«M5 -95» arrancaban con un « · » colgando — el bug que este documento ya daba por cerrado, y
que efectivamente está arreglado en `curso-a-portal.mjs` desde el 17/08. El archivo era del
13 y nunca se había regenerado. La prueba de que el fix anda estaba al lado: el curso que lo
motivó, regenerado, no lo tiene.

## Lo que quedó abierto, con el archivo donde vive

- **`bajados.txt` sobrevive a `--liberar`.** `curso-bajar.mjs` usa `--download-archive`;
  cuando `curso-a-drive.mjs --liberar` borra los `.mp4` locales, el registro sigue diciendo
  «ya bajado». Reanudar un curso liberado no baja nada y `video/` queda vacío **sin error**.
  Sin caso medido, pero va en contra de todo lo de acá arriba.
- **El `fusionar` de `drive.json` nunca borra una entrada** (`curso-a-drive.mjs`). Un recurso
  que hoy se borra por dedup sobrevive ahí con su `driveId`, y `construirRecursos` lo vuelve
  a emitir sin preguntar si el archivo sigue en disco. Hoy hay **0 fantasmas** en los 12
  cursos con recursos. El colateral caro: esas entradas inflan el conteo y **desactivan el
  guard** de «recurso sin id», porque un real sin id queda tapado por un fantasma con id.
- **20 transcripciones huérfanas en `public/cono-tx`** (259 KB) que no están en ningún
  `drive.json` (1.647 ids indexados) ni en ningún `curso-*.ts`. Antes de borrarlas hay que
  saber de qué clases son. La pregunta hermana: un `cono-tx/<videoId>.json` queda huérfano
  cada vez que un video se re-sube y Drive le da otro id.
- **632 clases publican el nombre de su módulo cortado a 32 caracteres exactos**, en 14
  cursos («Jaque Blue - Creacion de Conteni», «Modulo 06 - Headings Modulo 06 -»). **No es
  nuestro**: `crudo.json` de bigseo ya trae el título cortado desde la API, y el mismo
  endpoint devuelve títulos de 72 y 64 sin cortar para otros cursos. Del lado nuestro el
  nombre completo **no existe en ninguna respuesta**. Lo que sí se puede es detectarlo.
- **433 clases sin duración en la tarjeta**, las de los tres cursos que viven dentro del
  auto-generado `curso.ts` (anteriores al pipeline, sin carpeta en `C:\cursos`). El
  buscador y el módulo NO se ven afectados (eso lo afirmaba el hallazgo original y la
  refutación lo tumbó): falta la duración, nada más.
- **`mateo-maffia-byf` sigue listado con «2 recursos»** que la API dice que no existen: el
  inventario quedó contaminado con filas de otro curso. Se cierra re-corriendo el inventario.

## Lo que dio LIMPIO (para que nadie lo vuelva a auditar de cero)

- `hasTx` → archivo: **2.078 de 2.078**, sin faltantes, sin JSON inválido, sin vacíos, y
  tampoco el caso inverso.
- `hasDoc`/`docSlug` → archivo: 33 de 33.
- 0 recursos con slug repetido dentro de un curso · 0 clases con `n` repetido · 0
  `recursoSlugs` apuntando a un recurso inexistente · 0 `videoId` repetido entre clases.
- `catalogo.ts` ↔ archivos: los 24 `curso-*.ts` importados, no sobra ni falta ninguno.
- `public/cono-ugc`: 84 archivos validados por firma mágica y, en los webp, por el largo
  declarado en el header RIFF. 0 truncados.
- `curso-a-drive.mjs` copia comparando TAMAÑO, no existencia: ése sí se entera de un
  archivo rehecho.

## Lo que el barrido NO pudo ver

**Nada se ejecutó de punta a punta**: no arrancó Chrome, no se tocó la plataforma de origen
y no se subió nada a Drive. Toda la etapa de plan y de descarga quedó leída, no ejercitada.
**No se abrió el portal en el navegador**: los cinco hallazgos visuales están MEDIDOS sobre
el dato en disco, no MIRADOS — y la regla de este documento dice que un dato que solo se
mira en su JSON no está verificado. Y **no se verificó que los `driveId` EXISTAN** en Drive,
solo que estén bien formados: un id sintácticamente perfecto que apunta a un archivo borrado
pinta un iframe muerto sin tirar error.

---

## Ampliar un curso al que le faltaban clases: las tres trampas

Cerrando los dos gaps de contenido —**BigSEO 77 → 136** y **Jaque Blue 20 → 23**, 62
clases que existían del otro lado y el portal no tenía— aparecieron tres formas de
romper un curso al ampliarlo. Las tres tienen la misma raíz: **`n` es la clave de todo lo
que ya se hizo** (drive.json mapea `n → videoId` y los archivos empiezan por `NN - `), así
que cualquier cosa que lo desalinee no deja un curso incompleto, deja uno **MEZCLADO** —la
clase 50 apuntando al video de otra— y eso no se ve hasta que alguien escucha.

**1. El `archivo` de una clase nueva hay que renumerarlo.** Viene del plan nuevo, donde la
clase era la 16 de 23; al pasar a ser la 22 quedan **dos archivos «16 - …»** en la misma
carpeta. Todo el pipeline lee el número del basename, así que el segundo «16» se atribuye
a la clase 16. Se cazó porque los audios salieron numerados 13, 16 y 18 cuando debían ser
21, 22 y 23. En BigSEO no había pasado **de casualidad**: sus 59 nuevas caían justo en las
posiciones 78-136 del plan nuevo.

**2. La identidad «título + duración» no generaliza.** En BigSEO alcanzaba con sacarle el
número de orden al título; en Jaque Blue las dos capturas leyeron **rótulos distintos para
la misma clase** —«1- Pre INTRO» contra «PRE INTRO», «3. Haz Bajo La manga» contra «AS
BAJO LA MANGA»— y el match cayó a **2 de 20**: 18 clases ya bajadas se habrían vuelto a
bajar y a transcribir. Ahora son dos pasadas: título+duración primero (la fuerte), y lo
que quede por **duración sola** con tolerancia de 2 s, porque las dos fuentes redondean
distinto (la misma clase figura con 812 s y con 813).

> **La regla:** cuando dos capturas de la misma cosa no coinciden, la señal que vale es la
> que ninguna de las dos **inventa**. Un título lo escribe alguien; una duración se mide.

**3. `curso-bajar` no saltea lo ya bajado si la plataforma republicó.** El
`--download-archive` guarda el id del video, y tras una republicación los ids son todos
nuevos: pedirle el plan entero baja las 136, no las 59 que faltan — y peor, las 77
re-bajadas dejan su audio más nuevo que su `.md`, así que el chequeo de frescura dispara
**77 re-transcripciones** sobre una API con tope horario. Se corta con `--solo <n,n,n>`.

**Vive en:** `scripts/curso-plan-ampliar.mjs`

### El informe de faltantes afirmaba pérdidas por título

`social-funnel` decía «faltan 11 lecciones» teniendo **13 en el portal y 11 en la fuente**.
El número salía de comparar títulos normalizados, y eso no aguanta como afirmación por las
mismas tres razones de arriba. Ahora el veredicto es por **conteo** y la lista por título
queda como pista para mirar a mano.

Con eso, el informe cierra en **CERO faltantes** en los 17 cursos con inventario, y los dos
que no se pueden verificar —`instituto-de-comunicacion` y `mateo-maffia-byf`— salen como
«NO SE PUDO CAPTURAR», que es lo correcto: el inventario **se negó a escribir un cero que
no midió**, aun cuando eso deja una fila fea en el informe.

**Vive en:** `scripts/curso-faltantes.mjs` · `scripts/curso-inventario.mjs`

---

## Publicar un curso pisaba el documento de otro

**Síntoma:** ninguno en el momento. Se vio de casualidad, en un `git status` que mostró
`public/cono-doc/bienvenida.json` como **MODIFICADO** al publicar un curso que no lo había
tocado nunca.

**Causa:** `public/cono-doc/` es un espacio de nombres **plano** —`<leccion>.json`— y el
slug de una lección solo es único **dentro de su curso**. «Creativos UGC Realistas» y
«Creativos Animados» tienen los dos una lección `bienvenida`, así que publicar el segundo
reemplazó el documento del primero: esa lección de UGC pasó a mostrar el texto de
Animados. Sin error, sin conflicto y sin nada que lo dijera.

> **La regla:** un identificador que es único dentro de un contenedor **no** sirve como
> nombre de archivo en un directorio compartido. El nombre lleva el contenedor adelante
> (`<curso>__<leccion>.json`), o el segundo que llegue gana en silencio.

Y el corolario que casi cuesta caro: **al borrar los planos viejos, el chequeo tiene que
ser "¿alguien lo referencia?", no "¿tiene el formato nuevo?"**. Se verificó al revés
también —28 `docSlug` referenciados, 28 archivos, 0 faltantes— porque un archivo de más
es basura y uno de menos es una lección que no abre.

**Vive en:** `scripts/avatarhype-doc-portal.mjs` (`docSlugDe`) · `scripts/curso-a-portal.mjs`

## Una lección que NO es un video desaparecía del portal

El aplanado a clases de `avatarhype-plan.mjs` iteraba `partes`, así que una lección cuya
forma es un **documento** —`partes: []`— no producía ninguna clase. «Creativos Animados»
tiene 2 lecciones y la ficha salía con 1, sin hueco ni aviso.

Es la **tercera** aparición del mismo modo de falla en esta área, y por eso vale escribirlo
como familia y no como caso:

| lo que el enumerador contaba | lo que la lección era | cómo se veía |
|---|---|---|
| lecciones | una tabla (módulo 2 de UGC) | el módulo no existía: «1, 3, 4, 5» |
| lecciones | 8 LUTs (módulo 5 de Guille) | «el módulo está vacío» |
| partes de video | un documento (bienvenida) | la lección no existía |

> **La regla:** antes de aplanar una colección por un campo, preguntá qué pasa con el
> elemento que tiene ese campo **vacío**. Si la respuesta es «no produce nada», ese
> elemento va a desaparecer sin dejar rastro — y lo que desaparece sin rastro no se
> encuentra nunca por casualidad.

`soloTexto` **no** es `sinFuente`: el primero dice «la plataforma la tiene y no es un
video», el segundo «la plataforma no lo tiene». El portal ya sabía dibujarlas
(`CursoReplica` pinta el marco solo si hay `videoId`), así que lo único que faltaba era
emitirla.

**Vive en:** `scripts/avatarhype-plan.mjs` (el aplanado) · `scripts/curso-a-portal.mjs`
(las tres clases de «sin video»)

### Gotcha del entorno: Git Bash convierte un argumento que empieza con `/`

`--primera "/academy/animados/bienvenida"` llegó al script como
`C:/Program Files/Git/academy/animados/bienvenida`, y el script reportó «no renderizó»
sobre una URL que **nunca existió**. Se corta con `MSYS_NO_PATHCONV=1` adelante del
comando. Es la misma familia que el `\` por `/` de la herramienta de búsqueda: el valor
llega transformado y el error habla de otra cosa.

---

## ⚠️ Un audio MUDO no devuelve vacío: devuelve una INVENCIÓN

**Síntoma:** una clase sobre Calendly cuya transcripción publicada arranca así:

> *«¡Buenas tardes! Bienvenidos a una edición más de Noticias de Bolsillo. Yo soy Javier
> Pérez y el día de hoy estaremos hablando sobre las energías renovables y su impacto en
> el futuro de nuestro país…»*

Nada de eso existe. No hay un noticiero, no hay un Javier Pérez, y la clase es sobre
Calendly. **Está redactado impecable**, con puntuación y cadencia de locutor, y se publicó
sin que fallara absolutamente nada.

**Causa:** dos clases de «Master Marca Personal» tienen el video **sin pista de audio**
—medido con `volumedetect`: **−91 dB**, el piso digital, mean y max iguales—. Sobre ese
silencio:

| proveedor | qué devolvió |
|---|---|
| `whisper-large-v3-turbo` | «Thank you.» — su alucinación clásica sobre silencio |
| `gemini-flash-latest` | **un noticiero entero, inventado de cero** |

Y la mitad de Gemini es **culpa del prompt**, o sea mía: al escribir `sttGemini` en
`lib/transcribe.ts` copié el de `lib/ai-cheap.ts` pero **dejé afuera su escape hatch**
—«si no hay voz, devolvé exactamente (vacío)»— y encima agregué *«transcribí el audio
COMPLETO, de principio a fin, sin resumir»*. Un modelo al que no le das forma de decir «acá
no hay nada» y al que le exigís completitud, completa.

> **La regla:** todo prompt que pida transcribir, extraer o leer tiene que darle al modelo
> una forma EXPLÍCITA de decir «no hay nada». Sin esa salida, la instrucción de ser
> completo se convierte en licencia para inventar. Y el pedido de completitud y el escape
> hatch van **juntos**: el primero sin el segundo es peor que ninguno de los dos.

Esta es la peor forma de todo lo que este documento viene cerrando. No es una
transcripción incompleta ni vieja: es **completamente falsa**, y se lee **mejor** que las
verdaderas.

### La guarda: el bitrate efectivo, medido antes de elegirlo

El audio se genera a 32 kbps, así que un archivo muy por debajo de eso no tiene voz. Contra
las 92 clases del curso:

    clases reales    29,9 – 33,3 kbps
    las dos mudas     1,0 y 2,1 kbps

Un factor de **14** entre las dos poblaciones, así que el umbral de 8 kbps tiene todo el
aire del mundo. La guarda corre **antes** de gastar la llamada y la clase queda marcada
como MUDA, sin `.md`.

### El barrido: a cuántas más les pasó

**1.818 audios de todos los cursos. Mudos: esos 2.** El daño estaba contenido, y ahora
ninguno de los dos publica nada.

⚠️ **Y el archivo inventado sobrevive a que la clase deje de pedirlo.** Al sacarle el
`hasTx`, el portal deja de mostrarlo — pero `public/cono-tx/<videoId>.json` **sigue en
disco y servido en una URL adivinable**. Borrar el `.md` no es borrar lo publicado; hay
que sacar el JSON, comprobando antes que ninguna clase lo pida.

**Vive en:** `scripts/curso-transcribir.ts` (`kbpsDe`, `KBPS_MINIMO`) ·
`lib/transcribe.ts` (`sttGemini`)

---

# Completar un curso a medias: el cruce es el trabajo, no la descarga

**BlueHacker 2.0**: la plataforma tiene 401 lecciones y el portal 233. Antes de bajar
113 horas hay que contestar *cuáles* — y esa pregunta costó cinco correcciones, cada una
descubierta porque el número no cerraba.

## La clave de identidad no es del proyecto: es del PAR de fuentes

Hubo que cruzar **dos veces**, y cada cruce necesitó una clave distinta:

| cruce | señal fuerte | por qué |
|---|---|---|
| API ↔ lo publicado | **número + título** | lo publicado no tiene duración (`cardDesc` vacío) |
| API ↔ el plan | **título + duración** | el plan enumera clickeando y ahí los títulos NO llevan número |

Usar la clave del primer cruce en el segundo dio **6 de 171**. El guard de «si no cierra
exacto no bajo nada» fue lo único que impidió bajar 113 h de la mitad equivocada.

> **La regla:** antes de elegir cómo emparejar dos listas, mirá qué campos existen **en
> las dos**. La señal más fuerte de un cruce puede no existir en el otro.

## Las cinco trampas, en orden de aparición

**1. Entidades HTML.** `6. Secuencias &amp; Broadcast` contra `6. Secuencias & Broadcast`:
2 lecciones que se habrían bajado repetidas.

**2. El número de adelante a veces ES la clase.** «1. Conversión de desconocidos a
clientes» (10:24) y «5. Conversión…» (12:04) son DOS lecciones distintas; lo mismo
«10. 23-11-24 Ventas» (24:11) y «11. …» (21:46). Normalizando sin el número colapsan, y
emparejar la nuestra con la equivocada **baja una que ya tenemos y saltea la que falta**
— sin que ningún conteo lo delate, porque los totales dan igual.

**3. El regex que saca el número se come la FECHA.** `^\d{1,3}\s*[.)\-]` convierte
«23-07-21 Setters» en «07-21 Setters», mientras que la misma clase del otro lado
(«6. 23-07-21 Setters») conserva la suya. **36 lecciones** dadas por ausentes. Solo se
saca `N.` o `N - ` **con espacios**: una fecha no lleva espacios alrededor del guión.

**4. La numeración tiene DOS niveles de un lado y uno del otro.** La API dice
«5.2. Funnels y Copywriting» y el plan «2. Funnels y Copywriting» para la misma clase.
Sacar un solo nivel deja «2funnels…» contra «funnels…». Se saca en bucle.

**5. Y el bug que estaba en el pipeline, no en el cruce.** ⚠️ Ver abajo.

## ⚠️ Una clase de más de 99 minutos perdía su duración, y se le pegaba al título

`curso-plan.mjs` detectaba una clase por `\b\d{1,2}:\d{2}\b` en el texto del botón. Una
duración de **tres dígitos de minutos** —«185:16», que en este curso son 58 de 401
clases— no matchea ese patrón: la clase quedaba con `duracion: ''` y el título absorbía
los dígitos sobrantes (`«Tráfico Pago 23-08-07 - Sesiones Semanales 185»`).

No rompe nada visible: el plan sale con sus 401 clases y el conteo cierra. Lo que se
pierde es **el dato con el que después se compara**, y encima el título queda contaminado
para cualquier cruce futuro. El patrón ahora es `\d{1,3}:\d{2}(?::\d{2})?` en los cuatro
lugares donde vivía, y con eso las 401 tienen duración y el cruce pasó de 153 a 168.

> **La regla:** un cuantificador `{1,2}` sobre una unidad de tiempo es una apuesta a que
> nada dure más de 99 de esa unidad. Las sesiones semanales duran tres horas.

**Vive en:** `scripts/curso-plan.mjs` (`contarClases`, `esCabecera`, `dur`)

## El cierre que habilita a bajar

    401 de la plataforma
    233 publicadas  =  230 que matchean  +  3 que el autor SACÓ del curso
    171 a bajar
    ──────────────────────────────────────
    230 + 171 = 401  ✓

Y de las 171, tres comparten título con una nuestra: las tres tienen **otra duración**
(10:24 vs 12:04 · 16:17 vs 57:12 · 57:17 vs 19:47), o sea que son lecciones distintas y
corresponde bajarlas.

---

# Auditoría de 43 agentes sobre el portal — 2026-08-22

Ocho dimensiones en paralelo (cursos, transcripciones, truncado, documentos, catálogo,
Drive vs portal, el legado de `curso.ts`, BlueHacker), cada hallazgo pasado por un
verificador adversario cuyo trabajo era refutarlo. El informe completo quedó en
`C:\cursos\auditoria-portal.md`; acá va lo que sobrevive al olvido.

## El estado medido, con el universo que cubre cada número

| Qué | Número | NO cubre |
|---|---|---|
| Cursos publicados | **29** (27 con clases, 2 con vista propia) | `avatarhype`, excluido por `REEMPLAZADOS` |
| Clases totales | **2200** | las 6 de `avatarhype` |
| — con `videoId` | **2143**, y **2143 únicos** | que el id resuelva en Drive: nadie llamó a la API |
| — sin `videoId` | **57**, de las cuales 54 traen `resumen` y 3 traen documento → **clases huecas: 0** | — |
| Con transcripción | **2141**, y las 2141 tienen su `.json` → **faltantes: 0** | la CALIDAD: se midió largo y wpm, no contenido |
| Truncadas (por lo bajo) | **0** sobre **1933 clases medibles** (817,6 h) | 205 con transcripción y sin duración persistida |
| Documentos | **30**, con **0 rotos, 0 huérfanos, 0 vacíos**; 187 `<img>`, las 187 existen | son de UN solo curso: 37 de 2200 clases = 1,68% |
| Video en Drive | **4670** archivos en 58 carpetas | **2342 sin publicar (50,1%)** |

**Lo que hay que retener del formato de esa tabla, más que de los números:** cada fila
dice **qué universo cubre y cuál no**. Un conteo sin su universo es el error que ya se
cometió acá dos veces —«0 faltantes» sobre los cursos que tenían carpeta local, y «todo
verificado» sin haber mirado masteryhaus— y las dos veces lo cazó el dueño, no el chequeo.

## ⚠️ Un link COMPARTIDO llevaba cinco días dando 404, y ninguna métrica lo iba a decir

`REEMPLAZADOS` (`app/conocimientos/catalogo.ts`) era un `Set`. Sacar `avatarhype` de la
grilla estaba bien y estaba razonado: el curso se rehízo, dejar los dos cortes hace que
alguien abra el viejo creyendo que es el bueno. Lo que el `Set` no contesta es la otra
pregunta: **¿y el que YA está apuntando ahí?**

Medido contra la base de producción: **share id=4, ws 1, modo invitados, sin revocar, 13
visitas**, apuntando a `avatarhype`. Roto desde el deploy del 17/08 17:11Z.

**Y el contador de visitas nunca lo iba a delatar:** `registrarVisita()` corre **después**
del `notFound()` en `app/compartido/[token]/page.tsx`, así que un golpe al 404 no suma.
Las 13 visitas son todas anteriores al quiebre. **Un link roto y un link que nadie abrió
se ven exactamente igual desde la métrica.** Cualquier instrumentación puesta después del
early-return mide solo el camino feliz — es la misma forma que «un `console.warn` no es un
control», aplicada a la observabilidad en vez de a la validación.

**La regla: reemplazar es REDIRIGIR, no borrar.** El catálogo pasa a
`Map<viejo, nuevo>` y `buscarCurso` resuelve el salto, en UN solo lugar — el único por el
que pasan la grilla, el link compartido y el `?curso=` de la URL. Y el corolario
operativo: **antes de sacar cualquier cosa que se pueda compartir, preguntá si hay un
share apuntándole.** Ese chequeo no existe en ningún lado del repo; el script que lo
contesta quedó en `scratchpad/shares.mjs`.

## Un enumerador que fusiona cinco cursos en uno no solo no revisa: BORRA evidencia

`scripts/curso-huecos.mjs` hacía `archivos.unshift('curso.ts')` y bautizaba `avatarhype` a
los CINCO cursos que ese archivo tiene adentro. Dos consecuencias, y la segunda es peor:

1. `--curso bluehacker`, `--curso masteryhaus`, `--curso anuncio-ganador` y
   `--curso 100ads-analisis` contestaban los cuatro **«Los 0 cursos revisados están
   completos»**. Cero revisados, y el texto decía «completos». El propio archivo advierte
   veinte líneas más arriba que *«un falso "todo bien" es el peor resultado que puede dar
   un verificador: apaga la búsqueda»* — y el enumerador lo servía igual. **La advertencia
   estaba escrita en el archivo equivocado del archivo correcto.**
2. Al concatenar los cinco, **los módulos de uno rellenan los huecos del otro**. bluehacker
   acusa que le faltan los módulos 4 y 7; fusionado acusaba solo el 7, porque el módulo 4
   de masteryhaus tapaba el agujero.

**La regla: la unidad de un chequeo es la ENTIDAD, no el archivo que la contiene.** Y su
identidad sale del CONTENIDO: el slug derivado del nombre de archivo no encontraba 7 de
los 29 cursos (`curso-producto-app.ts` es `construir-app`, `curso-avatar-app.ts` es
`avatares-que-se-parecen`). Además, pedir un curso que no existe ahora sale con código 2 y
lista los válidos, en vez de contestar «0 revisados, todo completo».

**Vive en:** `scripts/curso-huecos.mjs` · el mismo patrón está en
`scripts/curso-faltantes.mjs`, que promete enumerar lo que no pudo mirar y omite 3 cursos
reales mientras nombra uno que ya no está en el portal.

## «`curso.ts` es AUTO-GENERADO» es una premisa FALSA que gobierna decisiones

Ningún script del repo lo escribe. La única escritura de `.ts` es
`scripts/curso-a-portal.mjs`, con destino `curso-<slug>.ts`. `gen-curso.mjs` nunca existió
(`git log --all --diff-filter=A` sobre 1755 commits: cero). Y el archivo **se edita a mano
y las ediciones sobreviven**: el commit `5804e12a` hizo un search & replace adentro de dos
`resumen` y los strings siguen en HEAD.

Importa porque la premisa **sostiene decisiones**: `PORTADA`, `AUTOR` y `REEMPLAZADOS`
viven en `catalogo.ts` y no en `curso.ts` justificándose en que allá «se pierde en la
próxima regeneración» — una regeneración que no ocurre. Está afirmada en
`app/admin/docs/page.tsx`, en 21 de los 24 `curso-*.ts`, en
`app/admin/dev/conocimientos/bitacora.ts` y —al revés— en este mismo documento
(«Y no se edita curso.ts a mano: está generado»).

⚠️ **Cuidado al corregirla:** para los `curso-<slug>.ts` la regeneración **sí ocurre**, en
cada corrida. El mito es falso **solo** para `curso.ts`. Una corrección con la brocha
demasiado ancha rompe la razón real por la que los cursos del pipeline no llevan datos
escritos a mano.

## Tres formas de contar mal el mismo pozo de Drive

Los tres números de «videos sin publicar» que aparecieron —**2342 / 2343 / 2466**— son
correctos y miden cosas distintas: por nombre de carpeta, según el censo de anoche, y
archivo por archivo contra los títulos publicados. El tercero es más alto porque **hay
video sin publicar DENTRO de carpetas que figuran como publicadas**: una carpeta con dueño
no es una carpeta completa.

Y el detector de duplicados falla **en las dos direcciones** (`curso-drive-censo.mjs`):
compara nombres normalizados, y `norm` borra todo lo no alfanumérico, así que `1.mp4` y
`8..mp4` emparejan cursos sin relación — de los 61 «archivos en común» que reporta, 42
coinciden en bytes y **19 son ruido**. Al mismo tiempo se pierde entero el caso de
«Seel Your Knowlegde», donde 4 archivos son la misma clase publicada con **0 nombres en
común**. **Comparar por tamaño en bytes mata los 19 y conserva los 42**; comparar por
duración con ffprobe acierta 4 de 4 en el caso del typo.

Duplicación medida, y es un **piso**: 5,05 GiB (Otálora ↔ Fórmula Ventas Ilimitadas, 38/38
idénticos, archivos separados que se pagan dos veces) + 1,40 GB + 2,10 GB.

## Una transcripción puede estar INFLADA, y las dos guardas miran el lado equivocado

`master-marca-personal-5-0` #84: **252 palabras sobre 43,4 segundos = 348 wpm**, único caso
por encima de 260 en todo el portal (mediana 169,4). El video no está cortado: el plan
declara 43 segundos. Medición acústica sobre las 25 clases cortas del curso: el ratio
núcleos silábicos / sílabas tiene mediana 1,02 y mínimo 0,82 en las otras 24; la 84 da
**0,66**. El audio soporta ~163 palabras y el `.json` publica 252. El proveedor, según la
cabecera del `.md`: `gemini-flash-latest`.

Es la falla de «un audio MUDO no devuelve vacío: devuelve una INVENCIÓN» en su forma
**parcial**: no fabrica desde el silencio, **infla audio real**. Las dos guardas existentes
no la ven — la de 8 kbps porque este audio tiene 32,6, y el umbral de 40 wpm porque
**mira el lado bajo de la distribución**. Falta la guarda del lado alto: wpm por encima de
~2 desvíos de la mediana del curso.

**La regla: un umbral puesto contra un modo de falla protege de ese modo y de ninguno
más.** Truncado e invención son la misma métrica en direcciones opuestas, y el chequeo
nació mirando una sola.

## Lo que dio LIMPIO — no volver a auditar

Con el método, para que la próxima sesión no lo rehaga:

- **`videoId` duplicados: 0** dentro de un curso y 0 entre cursos. Dos métodos
  independientes (2143 publicados/2143 únicos; 2149 literales en disco/2149 únicos).
- **`hasTx` sin archivo: 0** sobre 2141. `hasTx` con `videoId: null`: 0.
- **Transcripciones vacías, inválidas o bajo 200 chars: 0** sobre 2146. **Huérfanas: 0**,
  confirmado con AST **y** con las dos formas de comilla por separado — cubrir solo comilla
  simple habría reportado **438** huérfanas y solo comilla doble **1708**, los dos
  inventados. Es el mismo error que una vez casi borra 12 MB de transcripciones vivas.
- **Truncado por lo bajo: 0** sobre 1933 clases medibles. Las 2 bajo 60 wpm se leyeron: son
  falsos positivos, terminan con despedida.
- **`docSlug` rotos: 0 · huérfanos: 0 · vacíos: 0.** 187 `<img>` embebidas, las 187
  existen, 0 hotlinks. Documentos capturados que se perdieron camino al repo: **0**.
- **`recursoSlugs`: 1837 usos, 557 recursos declarados, 0 referencias rotas.**
- **Catálogo: 0 slugs duplicados, 0 títulos duplicados** (ni normalizando acentos), 24
  archivos en disco y 24 importados, 23 portadas declaradas y 0 faltantes.
- **20 de los 21 cursos con carpeta local dan diferencia CERO por videoId.** El único con
  diferencia es bluehacker, que se está completando.

Y **una hipótesis que se persiguió y es FALSA, para no volver a levantarla:** «el campo
`modulo` renumera contiguo y borra la evidencia de un módulo perdido». El generador emite
`grupo` con la etiqueta del autor verbatim en el mismo objeto (`modulo:8` → `grupo "Modulo
9 FAST 5-95"`): **el testigo viaja en el campo hermano.**

## Lo que quedó SIN hacer, con el archivo donde vive

- ~~**BlueHacker: 233 de 404 publicadas.**~~ **HECHO el 22/08/2026**: las 404 están
  publicadas en `curso-bluehacker.ts`. El detalle de las cuatro trampas del último paso,
  al final de este documento. El riesgo de «regenerar a ciegas desde `drive.json`» se
  cerró midiendo: eran **2** clases, no 231, y se resolvieron rescatando el id.

## Lo NO verificable — que no es «está bien», es «no se sabe»

- **8 de los 29 cursos no tienen carpeta en `C:\cursos`**, así que su integridad no se
  contrastó contra nada: masteryhaus (194), anuncio-ganador (6), 100ads-analisis (8),
  vsl-landing (11), analisis-negocio, branding-mako, construir-app (12),
  avatares-que-se-parecen (23). **masteryhaus y anuncio-ganador pueden tener el mismo
  agujero que bluehacker y este chequeo no lo vería.** Matiz nuevo: sus videos **sí** están
  en `G:`, así que duración y truncado sí son medibles con ffprobe — lo que falta es el
  inventario contra el cual comparar.
- **738 de las 2200 clases (33,5%) no tienen hoy ningún chequeo de módulo faltante**,
  porque la numeración se reinicia adentro en submódulos que no viajan en ningún campo.
- **Si los `videoId` resuelven.** Ni Drive ni Vimeo ni Panda fueron consultados: existen
  como strings, no se probó que reproduzcan.
- **La CALIDAD de las 2146 transcripciones.** Un `.json` de 12 KB alucinado, en el idioma
  equivocado, o con el audio de otra clase, pasa los dos filtros que se corrieron. Quedan
  **152 con un 8-grama repetido 5 o más veces** cuyo contenido no se leyó.
- **El peso en GB del pozo de Drive**: se contaron archivos, no bytes. Y la premisa de que
  `du` se cuelga puede estar vieja — el re-conteo completo tardó 3,3 s.

---

## Publicar BlueHacker: las cuatro trampas del último paso

De 233 a 404 clases. Bajar fue lo barato; **el cruce fue el trabajo**, otra vez.

### 1. Dos clases ya estaban en Drive y el matcher no las veía

`n=111` y `n=305` figuraban como «sin bajar» y estaban arriba desde hacía meses: el
proveedor les cambió el **prefijo numérico del título** (`13.3. Funnels…` → `3. Funnels…`,
`5. Conversión…` → `Conversión…`) y el matcher de la ampliación compara título.

**Bajarlas de nuevo era el error caro**, y es silencioso en cadena: nace un duplicado en
Drive → el id nuevo pisa al viejo en `drive.json` (una entrada por `n`) → la transcripción
**ya publicada** bajo el id viejo queda huérfana → la clase se ve completa, con su visor
funcionando, y sin texto.

**Cómo se decide bien: por DURACIÓN, no por título.** El nombre del archivo sale de la
SQLite de Drive por id, se lo encuentra montado en `G:` y se lo mide con `ffprobe`. Las dos
dieron **0,2 s** de diferencia contra lo que declara el plan. «Los títulos se parecen» no
es prueba; dos videos que duran lo mismo al décimo de segundo, sí. El script quedó en
`scratchpad/bh-rescatar.mjs` y **verifica antes de escribir**.

### 2. `curso-a-portal` pone `hasTx` SOLO si existe el `.md` local

Las dos rescatadas nunca pasaron por el pipeline local, así que no tenían `.md` — y
regenerar les habría **borrado la transcripción** a dos clases que ya la tenían publicada.
Se recuperan de `public/cono-tx/<videoId>.json`, que es el mismo material del mismo lado
del circuito.

⚠️ **Y acá me comí una: el campo `archivo` de `drive.json` tiene DOS convenciones.** Las
233 entradas viejas lo traen **con** la extensión (`01 - Proceso General.mp4`) y las de la
ampliación **sin** ella (`305 - Conversión…`). Mi recuperador concatenó `.md` a secas y
escribió **231 archivos `<nombre>.mp4.md`** que no sirven para nada. No pisó nada —solo
escribía si el destino no existía— pero el conteo («recuperados: 233» cuando esperaba 2) es
lo único que lo delató. **Cuando un script te devuelve un número dos órdenes de magnitud
mayor que el esperado, es un bug, no un hallazgo.**

### 3. Reescribir 233 transcripciones publicadas: verificar que el viaje no pierde nada

Regenerar reescribe los `cono-tx` de las clases que ya estaban. El viaje es
`.json → .md → .json`, y hay que probar que es idempotente **antes** de aceptarlo:
comparar el texto plano de cada archivo contra `git show HEAD:<ruta>`, ignorando el corte
de párrafos. Resultado: **8.878.852 caracteres antes y después, 0 archivos con texto
distinto.** Sin esa medición, un diff de 233 archivos es imposible de revisar y se acepta
a ciegas.

### 4. ⚠️ El generador fundía dos módulos distintos en un solo acordeón

`curso-a-portal.mjs` derivaba `grupo` quitándole el ordinal al módulo
(`3. Ponencias Especiales` → `Ponencias Especiales`). **El ordinal se reinicia en cada
sección del curso**, así que `3. Ponencias Especiales` (bajo Transmutación de Identidad) y
`2. Ponencias Especiales` (bajo Facebook Ads) pasaban a llamarse igual — y el Hub abre un
`<details>` por **valor** de `grupo`. Las clases de las dos secciones caían en la misma
caja. El plan trae **40** módulos y el archivo emitía **38**.

**El síntoma no se parece a un bug:** se ve un curso con dos módulos menos y un acordeón un
poco más largo. **Nadie cuenta los acordeones.** Lo cazó comparar el conteo del origen
contra el del destino, que es el único chequeo que lo puede ver.

El arreglo: se quita el ordinal **solo cuando quitarlo no genera choque** (dejarlo siempre
ensucia los 20 cursos que no lo necesitan). Vale para cualquier otro curso con la misma
forma: si tenía el problema, se le arregla en su próxima regeneración.

**Vive en:** `scripts/curso-a-portal.mjs` (`nombreGrupo` / `choques`)

### Y el resultado, medido

404 clases · **404 videoId únicos** · 404 transcripciones · 0 clases sin texto ·
**0 `cono-tx` huérfanos en todo el portal** (2320 ids referenciados, 2317 archivos) ·
40 acordeones para 40 módulos · `curso.ts` de 1,61 MB a 890 KB.

Y lo que ya no aplica: la advertencia de que **regenerar desde `drive.json` es peligroso**
se cerró midiendo — el impacto real eran **2** clases, no 231, y las dos se resolvieron
rescatando el id en vez de re-bajando.

---

# Los recursos de un curso — 2026-08-22

El dueño lo reportó como «en el de bluehackers dentro de MaKo no veo ningún recurso», y
detrás de esa frase había **cuatro** problemas distintos encadenados. Vale la pena el
detalle porque cada uno se ve bien desde afuera.

## ⚠️ El primer arreglo fue el equivocado: restaurar 8 cuando había 92

Ante «no veo ningún recurso» el diagnóstico natural fue «mi regeneración borró los que
estaban». Era cierto y era **incompleto**: la ficha publicaba 8, y la plataforma tiene
**92**. Restaurar los 8 dejaba el agujero de 84 tapado y **con cara de arreglado** — con
su commit, su verificación en pantalla y todo.

**La regla: antes de restaurar lo que había, preguntá cuánto DEBERÍA haber.** Un arreglo
que devuelve el estado anterior solo es correcto si el estado anterior era correcto, y eso
es una hipótesis, no un dato.

Medido por dos caminos independientes: el plan de origen declara 92 y la tabla
`course_resources` devuelve 92, con los 92 ids coincidiendo uno a uno.

## ⚠️ Un generador que emite `recursos: []` borra sin fallar

`curso-a-portal.mjs` arma la lista de recursos mirando la carpeta LOCAL del curso. Cuando
esa carpeta está vacía —porque los archivos viven solo en Drive— emite `recursos: []` y
**pisa lo que la ficha publicaba**. No falla, no avisa: la sección «Recursos» deja de
dibujarse, porque el portal la muestra solo si `recursos.length > 0`.

Y se perdieron **dos** cosas, no una. La segunda es la que no se ve: los `recursoSlugs` de
**56 clases**, o sea el link de cada clase a su material. Un curso puede tener la sección
del curso llena y todas las clases sin nada.

**Y lo que hace que nadie lo note:** el commit decía «404 clases publicadas» y era cierto.
**Una regeneración que AGREGA 171 clases y RESTA 8 recursos se lee como una ganancia
neta.** Ningún test ni ningún chequeo del pipeline miraba los recursos.

Ahora el generador **aborta** (código 4) si va a escribir una ficha con cero recursos sobre
una que tenía. Salida explícita: `--sin-recursos`. Se ganó el sueldo el mismo día: cuatro
cursos abortaron con «hay 25 recursos en disco y solo 0 con id de Drive» en vez de publicar
una ficha incompleta.

## ⚠️ La carpeta decide el NIVEL, y equivocarse cuelga el material de la clase que no es

`curso-a-drive.mjs` lee `pdfs/` como **nivel clase** y `recursos/` como **nivel módulo**.
Para los de clase, `curso-a-portal.mjs` deduce a cuál por el prefijo `NN - ` del nombre de
archivo.

Se bajaron los 91 de BlueHacker a `pdfs/`. Resultado: se publicaron, aparecían en 53
clases, y **51 de esas 53 estaban mal** — la clase 116 («Mentalidad 23-06-15») mostraba el
material de «Ventas 23-09-15», porque ese `NN` venía de otra numeración.

La causa de fondo no era el número: **estos recursos son de MÓDULO**. La plataforma los
modela así (`course_resources.module_id`) y el pipeline ya tenía el camino. Se remapearon
los 91 corrigiendo `drive.json` —no renombrando archivos: renombrar era volver a subir 133
MB y duplicar los 91 en Drive—. Quedó en 173 clases con material.

**El olfato:** si un recurso aparece en una clase y su nombre menciona OTRA clase, no es un
detalle cosmético del label — es el mapeo. (Y el label también se arregló: ahora sale el
título real de la plataforma, no el nombre de archivo.)

## ⚠️ El censo casi miente dos veces, en direcciones opuestas

**Por lo bajo — el tope de 1000 filas.** Pedir `course_resources?limit=20000` devolvió
**exactamente 1000**. Un número redondo contradiciendo una medición que ya se sabía buena
(92 para BlueHacker, que ahí aparecía con 7). Es el tope de PostgREST **cortando en
silencio**. Paginado da **3107**. *Un número redondo es una hipótesis de truncamiento hasta
que se demuestre lo contrario.*

**Por lo alto — comparar cantidades en vez de cruzar por clave.** El censo decía «RAIO:
portal 183, plataforma 283 → faltan 100». No falta ninguno: los 283 títulos están los 283
entre los 183 archivos, porque varias filas comparten título (el mismo material colgado de
varios módulos). **Contar filas no es contar archivos**, y casi se bajan 100 que ya
estaban.

Y el error espejo: BlueHacker figuraba con «39 faltantes» estando bajados, porque 39
archivos se llaman `recurso-NN` (el descargador no pudo inferirles título) y ningún cruce
por nombre los encuentra. **El id es una clave; el título es un parecido.**

Números finales, cruzados por id: faltaban **37** recursos reales en 5 cursos, no 184.

## El camino bueno para bajar: la URL pública de storage

Las imágenes y los `.txt` no bajan por el lector. Tres diagnósticos descartados, en orden:

1. **«Faltan permisos»** — no. `file_url` y `file_path` **existen** en la tabla y contestan
   `permission denied` (a diferencia de una columna inexistente, que contesta otra cosa —
   la diferencia entre los dos mensajes es el dato). Pero el archivo no está cerrado.
2. **«El lector no previsualiza imágenes»** — cierto y da igual.
3. **«El botón Descargar no funciona»** — el botón **sí** arranca la descarga: arma un
   **blob** y Chrome la **cancela** bajo automatización (`Browser.downloadProgress:
   canceled`). Mirar la carpeta de descargas y concluir «no bajó» tapaba esa distinción:
   nunca se sabía si no arrancaba o si arrancaba y moría. **Escuchá el evento, no mires la
   carpeta.**

Lo que sí funciona: la página, **al cargar y sin tocar nada**, pide
`storage/v1/object/public/media/course-resources/<uuid>`, y ese bucket es **PÚBLICO**. Se
captura esa URL del tráfico y se baja con un `fetch` pelado. Sirve para todos los tipos.

⚠️ El uuid de storage **no** es el id del recurso, así que no se puede construir: hay que
verlo pasar. Por eso sigue haciendo falta el navegador, pero **solo para mirar**.

**Vive en:** `scratchpad/ce-bajar2.mjs` (el patrón) · `scripts/curso-pdfs.mjs` (el camino
viejo, que sirve para todo lo que no sea imagen ni txt)

## Cómo se le pregunta a la plataforma

La anon key de Supabase **no** está en `localStorage` ni en los dos scripts de nivel
superior (vive en chunks importados). Buscarla en el bundle es una pérdida de tiempo: viaja
en el header `apikey` de cada request, así que se le pide al navegador con
`Network.requestWillBeSent` y se termina en veinte segundos.

Con eso: `courses`, `course_resources` y `modules` se consultan directo, paginando de a
1000. El token de sesión sale de `localStorage` (`sb-<ref>-auth-token`).

## Lo que quedó SIN hacer

- **1 recurso de BlueHacker** (un PNG de 179 KB, «1. Fundamentos de la atracción
  orgánica»): se intentó por lector, por click y por gestor de descargas antes de encontrar
  la ruta de storage. **Se puede recuperar con el método nuevo** y no se reintentó.
- **3 de creator-club** declaran `file_size: 0` en la API: están vacíos en el origen.
- **Los 8 recursos originales de BlueHacker quedaron DUPLICADOS en Drive** (mismo
  contenido, id nuevo, nombre distinto). Son 8 archivos huérfanos; no se borraron.
- **Los cursos del área `/vip/`** (`aumenta-tu-valor`, `hackeando-la-edicion`) usan
  `vip_course_resources`, otra tabla: el censo de `course_resources` **no los cubre** y su
  completitud sigue sin medirse.
- **3 cursos publican recursos sin asociar a ninguna clase** (RAIO 183, master-marca 34,
  bigseo 33). No es un bug: esa plataforma los cuelga del módulo y el dato de clase no
  existe en el origen. Se ven en la sección del curso.

---

# MasteryHaus: una plataforma nueva (Circle) — 2026-08-22/24

El curso pasó de **194 clases y 24 recursos** a **253 y 62**. Pero lo que hay que guardar
no es el número: es que MasteryHaus **no es un curso, son 30**, y que vive en una
plataforma que el repo no conocía.

## Cómo se le pregunta a Circle

`circle.masteryhaus.com` es **Circle.so**. Su API interna es `/internal_api/` y responde
con las cookies de sesión del navegador — no hace falta token ni reconstruir nada.

| Qué | Dónde |
|---|---|
| Los cursos | `/internal_api/spaces` → los que tienen `post_type: "course"` |
| El índice de un curso | `/internal_api/spaces/<id>` → trae `course_sections[].lessons[]` |
| El contenido de una lección | `/internal_api/courses/<space>/sections/<sec>/lessons/<id>` |
| Los archivos de una lección | `/internal_api/courses/<space>/lessons/<id>/files` |
| Los posts de un space | `/internal_api/spaces/<id>/posts?per_page=100&page=N` |

El video sale de `featured_media_embed` (Vimeo) y el texto de `rich_text_body`, que es un
árbol ProseMirror y hay que caminarlo.

⚠️ **Adivinar el endpoint no sirve: se sniffea.** Se probaron nueve rutas plausibles para
el contenido de una lección y las nueve dieron 404. La buena apareció capturando lo que la
propia página pide al abrir una lección. Media hora tirada por no empezar por ahí.

## ⚠️ Filtrar por el tipo que uno espera deja material afuera sin avisar

El censo filtró `post_type === 'course'` y con eso ignoró **11 spaces**, uno con el slug
literal `recursos-referencias`. Adentro había **1.216 posts**.

Medido después: casi no hay video ahí (1 Vimeo en 1.216) y de **334 URLs distintas solo 14
son material** — el resto es conversación de foro (78 redes sociales, 69 videos sueltos,
19 Spotify y **16 ubicaciones de Google Maps, que son los estacionamientos** de los eventos
presenciales). O sea: la exclusión resultó casi inocua **y eso no se sabía al filtrar**.

**La regla: un filtro por tipo es una hipótesis sobre dónde vive el contenido.** Se
verifica mirando lo excluido una vez, no se asume.

## ⚠️ «No tengo acceso» y «no hay» son cosas distintas, y hay que PROBARLAS

De las 418 lecciones del catálogo, **154 devuelven HTTP 401** en 18 cursos (los grupos
MASTERY U, GROWTH y OS). No se dedujo de un flag: el extractor **pide lección por lección
y guarda el status**. Y hacía falta, porque el flag `policies.can_leave_space` sugería una
cosa y **el sidebar mostraba varios de esos spaces como si fueran accesibles**.

Corolario incómodo: **las 194 clases que el portal ya publicaba incluyen material que esta
cuenta YA NO alcanza.** Cruzando por título solo 57 de 264 coinciden. El ingest anterior
tenía más permisos que el de ahora.

## ⚠️ Los recursos no estaban donde la plataforma los documenta

El endpoint `/files` de Circle devuelve `count: 0` **de verdad** — la comunidad no lo usa.
Los materiales viven como **links dentro del cuerpo** de cada lección: 871 apariciones, 70
URLs únicas. Buscarlos solo en el lugar oficial habría dado un cero correcto sobre la
pregunta equivocada.

De esas 70: 32 se bajan con un GET simple y 8 daban 401. El diagnóstico obvio —«falta
sesión de Google»— era el equivocado: **el dueño deshabilitó la descarga** en esos
documentos, y eso no lo arregla ninguna cookie. Pero `/mobilebasic` los devuelve **enteros**
(uno tiene 223.807 caracteres): lo que estaba cerrado era el botón, no el contenido.

⚠️ En el medio se intentó imprimirlos a PDF con `Page.printToPDF` y salieron de **882
bytes: una página en blanco** que pesaba, abría, y se habría publicado como si fuera el
material. Lo cazó comparar el tamaño con lo que declaraba la API.

## ⚠️ Vimeo: dos errores apilados, y el de arriba tapaba al de abajo

7 de 227 clases fallaban con *«This request has been blocked due to its TLS fingerprint»*.
No era el referer, ni la sesión, ni la IP: **el handshake de yt-dlp no se parece al de un
navegador**. Se arregla con `--impersonate chrome`, que necesita `curl_cffi` **y un yt-dlp
reciente** — con la librería instalada y el yt-dlp de julio los targets seguían figurando
«unavailable», que se lee como «falta la dependencia» cuando lo que faltaba era actualizar.

Resuelto eso aparecieron **403**: son videos **privados** y les faltaba el hash. Circle lo
publica en DOS formas —`vimeo.com/<id>/<hash>` en `content` y `?h=<hash>` en el `html`— y
el extractor reconocía solo la segunda. **24 clases lo tenían y se estaba perdiendo**, no
las 7 que fallaron: las otras 17 funcionaron por casualidad porque no tenían la protección
encendida. Se recuperaron releyendo el JSON crudo de cada lección, sin volver a pedirle
nada a la plataforma — **por eso se guarda el crudo**.

Quedaron 3 con 403 real: dan 403 también con `curl` y el referer correcto, y el navegador
ni les pide el player. Están rotos en el origen.

## ⚠️ La duración es la única clave de identidad que sobrevive a un renombre

Los 194 videos publicados están en Drive con nombres del ingest anterior: «004 - Sesión
Maestría - Mayo 2024» es **«Sesiones de Maestria Mastery Haus-03.mp4»**. Cruzar por título
encuentra 57 de 264; cruzar por **duración** encontró los 7 duplicados entre los primeros
30 bajados y evitó re-subir 5 GB.

Es el mismo método que rescató `n=111` y `n=305` de BlueHacker. **Dos videos que duran lo
mismo al décimo de segundo son el mismo video.**

## El circuito no es una optimización: es lo que decide si se puede terminar

Estos videos pesan de 0,5 a **11 GB**. La primera corrida acumuló **77 GB con 30 archivos**
y el disco llegó a **2,4 GB libres** — se rompió todo y hubo que parar a apagar el
incendio. La segunda, con el circuito (mover → audio → Drive → liberar) cada 4 minutos,
bajó 190 videos más y **el disco terminó en 79 GB**.

Y el orden importa: **el audio se extrae ANTES de liberar**, porque el audio es lo
irrecuperable. Un video se puede volver a bajar; una transcripción sin su audio, no.

## Lo que quedó SIN hacer

- **23 videos en una carpeta de Drive duplicada por un acento** (`MasteryHaus - Sofía
  Contreras` vs `- Sofia`). El bug está arreglado en `curso-a-drive.mjs`, pero mover esos
  60 GB es una decisión del dueño.
- **11 clases de las 264 no se publicaron**, y las 11 están explicadas: 7 «Sesión Maestría»
  que **están vacías en la plataforma** (sin embed, cuerpo de 2 caracteres), 3 videos con
  403 en el origen, 1 encuesta de feedback.
- **154 lecciones en 18 cursos** siguen fuera por permisos (401).
- **Los 14 recursos útiles de los spaces que no son cursos** no se publicaron: son 14
  links ajenos al curso y ensucian más de lo que aportan. Están en
  `C:\cursos\masteryhaus\urls-material.json`.
- **Tres spaces contestaron vacío** (`Pack Negocios Sólidos`, `Sesiones Grupales`, `Clases
  en vivo | Growth`) y no se distinguió si no tienen nada o no hay acceso.

## Y dos del pipeline que este curso destapó

Los dos con el mismo síntoma: **la ficha sale bien y el material no aparece.**

1. `curso-a-drive` no arrastraba el campo `clases` del índice de recursos, así que el link
   de cada recurso a sus lecciones se perdía en el camino.
2. `curso-a-portal` **adivinaba** la clase de un recurso por el prefijo `NN - ` del nombre
   de archivo. Es una heurística que solo funciona con los nombres que pone el descargador
   del repo; el material de Circle son links de Google sin prefijo. Resultado: **62
   recursos publicados y CERO clases con material**. Ahora el dato explícito le gana a la
   heurística — **de 0 a 160 clases con material**.

**Vive en:** `scratchpad/mh-api.mjs` (el cliente de Circle) · `mh-censo.mjs` ·
`mh-plan2.mjs` (el extractor, guarda el crudo) · `mh-dedup.mjs` (cruce por duración) ·
`mh-hash.mjs` (los hashes de Vimeo) · `scripts/curso-bajar.mjs` (`--impersonate`) ·
`scripts/curso-a-drive.mjs` (carpeta sin acentos, `clases`, `nivel`) ·
`scripts/curso-a-portal.mjs` (`clases` explícitas)

---

# Agregar un curso de cursoselite: la receta, y las tres trampas que trae siempre

Tres cursos seguidos el 24/08/2026 —Stories Master (22), Claude Academy 2026 (18), Cursos
HeyGen (14)— con el mismo método. Toma ~20 minutos por curso y las tres trampas aparecen
**todas las veces**.

## La receta

1. **Ubicarlo**: `C:\cursos\cursoselite-recursos.json` tiene los 130 cursos con su slug y
   su conteo de recursos.
2. **Capturar el índice**: `scratchpad/sniff.mjs --url https://cursoselite.com.mx/curso/<slug>
   --filtro "get_course_lessons_secure|course_resources|modules"`. Las tres respuestas que
   hacen falta salen de una sola carga de página. **No se adivina el endpoint** — nueve
   candidatas plausibles dieron 404 el día que lo intenté.
3. **Armar el plan** desde esas tres respuestas (ver `scratchpad/sm-plan.mjs`).
4. `curso-bajar` → `curso-pdfs` → `curso-audio` → `curso-transcribir` → `curso-a-drive` →
   `curso-a-portal`, y sumarlo a `catalogo.ts`.

El autor sale de `courses.instructor`, y es lo que nombra la carpeta de Drive.

## ⚠️ Trampa 1: el RPC no devuelve las clases en orden

Llegan Módulo 1, 7, 2, 8, 3… y **el portal numera por orden de aparición en el array**.
Publicado tal cual, el curso queda con la secuencia hecha un desastre — y cada clase
individual se ve perfecta, así que no hay nada que delate el problema hasta que alguien
intenta seguirlo.

Se ordena por `(orden del módulo, orden de la lección)`.

## ⚠️ Trampa 2: el título de un recurso NO es una clave

Tres variantes del mismo problema, una por curso:

| Curso | Qué pasaba |
|---|---|
| BlueHacker | el prefijo `NN - ` del nombre venía de otra numeración → 51 de 53 en la clase equivocada |
| MasteryHaus | el ingest viejo renombró todo → cruzando por título coincidían 57 de 264 |
| Claude Academy | los 14 se llaman «N.1 Descripción» y **seis comparten el texto exacto** → seis archivos mapeados al mismo registro |

**Lo que sí sirve, en orden de preferencia:** el **uuid** (cuando el nombre lo trae o la
posición en `plan.pdfs` lo da), el **tamaño en bytes**, y la **duración** para videos. Los
tres son claves; el título es un parecido.

⚠️ Y antes de usar el tamaño como clave, **verificá que sea único** — el script lo chequea
y avisa en vez de elegir por su cuenta.

## ⚠️ Trampa 3: la duración viene en 00:00 y el video existe igual

Pasó en 3 de 18 clases de Claude Academy y en 4 de 14 de HeyGen. La plataforma deja
`duration: "00:00"` y `duration_seconds: null` en lecciones que **sí tienen video**. Sin
duración la clase sale sin ese dato en la tarjeta **y queda fuera del chequeo de
transcripción truncada**, que la necesita para calcular palabras por minuto.

Se saca del archivo con `ffprobe` después de bajar.

## Y lo que quedó CERRADO sobre los recursos

Los recursos de esta plataforma se cuelgan de **MÓDULOS, nunca de lecciones**. Verificado
por dos caminos en HeyGen: `course_resources` solo tiene `module_id` (no hay campo de
lección), y el campo `resources` que traen las lecciones está **vacío en las 14**.

O sea que el mapeo por módulo que se viene usando desde BlueHacker **no es una aproximación
por falta de datos: es el único dato que existe.** No hay que volver a dudarlo ni buscar
una asociación más fina que no está.

**Vive en:** `scratchpad/sniff.mjs` · `sm-plan.mjs` (el molde del plan, se copia y se
cambian tres rutas) · `ca-recursos2.mjs` (el cruce por bytes, con la verificación de
unicidad)

---

# Las miniaturas del portal — 2026-08-24

El dueño: *«Revisá bien las miniaturas de todo, no las estás trayendo»*. Auditoría de las
cinco superficies del portal que dibujan una imagen (33 agentes, 13 hallazgos confirmados
de 28 propuestos — casi la mitad se cayeron al verificarlos, y eso también se cuenta).

## ⚠️ La tapa se estaba raspando de la GRILLA, teniendo la de verdad en una columna

**Síntoma.** «No se están trayendo las miniaturas». Parecía que faltaban tres cursos.

**Medido.** De los 21 cursos del portal que existen en cursoselite, **DIECIOCHO** tenían
como portada la miniatura de la grilla, de **456x256** — contra los **1536x1024** que la
plataforma servía al lado. **13,5 veces menos píxeles.** En la tarjeta chica no se nota;
arriba del título, estirada a 1200 px, se ve el pixelado.

**La causa NO era que faltara el paso.** `scripts/curso-portada.mjs` existía y corría. Lo
que raspaba era el `<img>` de la tarjeta del catálogo. La tabla `courses` tiene una columna
`cover_image` con la tapa real, poblada en las **130 filas**, en storage PÚBLICO: una sola
request, sin navegador y sin sesión.

**Y esto es lo que más cuesta ver: el camino equivocado estaba BIEN ARGUMENTADO.** El
comentario que vivía en ese archivo decía, con toda la razón, que «la imagen más grande de
la landing» sería una heurística que agarra cualquier cosa — y concluía que el `<img>` de
la tarjeta cuyo `<a>` apunta a este curso era **«un dato»**. No lo es: es otra heurística,
con **tres capas de desempate** encima (frecuencia para descartar el logo del sitio,
proporción para descartar el avatar del autor, área para el resto). Cada capa se agregó
arreglando una portada equivocada de verdad — la corona del sitio, la foto de Alex Hormozi
(ver «La portada del curso no es la imagen más GRANDE de la tarjeta», más arriba: ese
diagnóstico era correcto **dentro** de la fuente equivocada).

> **La regla, y sirve para cualquier extracción: si hay que desempatar, todavía estás
> adivinando.** Un dato es una columna con la URL adentro. Todo andamiaje de scoring sobre
> el DOM de una página es la señal de que la fuente está mal elegida — y como cada capa
> arregla un caso real, el andamiaje se siente cada vez más sólido mientras se aleja más
> del dato.

**Vive en:** `scripts/curso-portada.mjs` (ahora pregunta a la API y cae al catálogo solo si
ahí no hay nada)

## ⚠️ Quién decide si una tapa trae marca de agua es el BUCKET, no el curso

Al traer las tapas buenas entró un problema nuevo: **el escudo dorado «CURSOS ELITE»**
estampado en el pixel, que se ve en la grilla y viaja al link que se reparte a clientes.

La correlación es perfecta, 22 de 22 sin una excepción:

| Bucket del `cover_image` | Filas | Marca de agua |
|---|---|---|
| `storage/…/public/media/courses/` | 81 | **sí**, escudo + león en mosaico |
| `storage/…/public/library/courses/` | 49 | no |

Y `library/courses` tiene **141 objetos** cuando solo 49 están referenciados: los ~92
sobrantes son **las gemelas limpias**, más grandes y sin estampar. Nadie las apunta desde
`courses`.

**Cómo se cruzan, que es la parte reutilizable.** No hay nombre: los objetos de `library`
se llaman `0.6215427889678296.png`. Se cruza por la IMAGEN, con una firma de **12x12 en
gris** sacada de la mitad derecha-inferior — o sea **tirando la esquina donde vive el
escudo**. ⚠️ Comparar la imagen entera es lo natural y es exactamente lo que no funciona:
el propio escudo separa a la marcada de su gemela, que es al revés de lo que se busca. Con
la esquina afuera, la gemela verdadera queda en `d≈11-25` con el segundo candidato bien
lejos; donde no hay gemela, el primero y el segundo empatan (`d=53,1` vs `53,1`) y eso
mismo es la señal de que no hay que tocar nada.

Dos métodos independientes (la firma, y un agente mirándolas de a una) dieron **los mismos
7**. Igual se miraron una por una antes de aplicar: una portada equivocada es peor que una
con marca de agua, y en este repo ya pasó dos veces.

**Y el número honesto:** el escudo no lo introdujo la migración. De las 24 tapas
anteriores, **5 ya lo tenían**. La corrida lo llevó de 5 a 15 y las gemelas lo bajaron a 8.
Contar el «antes» antes de escribir el «después» es lo que evita reportar como regresión
algo que ya estaba.

**Vive en:** `scratchpad/gemelos-limpios.mjs` · `public/cono-portadas/`

## ⚠️ `existsSync(<codigo>.webp)` no es un cruce: es una coincidencia de nombre

**Síntoma.** En «Creativos UGC Realistas», la clase «Biblioteca de prompts» mostraba una
placa que dice, con letras grandes, **«Introducción a las herramientas»**. «Quitar marca de
agua» mostraba «La recomendación actual». «Agentes» mostraba «ApiMart». El título está
escrito DENTRO de la imagen, así que no es un parecido: es otra clase.

**Causa.** `curso-a-portal.mjs:345` engancha la portada con
`existsSync(public/cono-ugc/${c.codigo}.webp)`. Los `.webp` se generaron con la numeración
del ORIGEN (3er nivel `1.4.x` / `1.5.x`) y el curso usa `1.3.x` / `1.4.x`. El `existsSync`
da **verdadero** y el desfase entra sin un solo ruido: 3 clases con la portada de otra y 5
sin portada teniendo la suya en `public/` bajo el nombre corrido.

Es «un nombre derivado de datos es una CLAVE» (AGENTS.md) en su forma más barata: acá el
nombre de archivo no se compara con nada, **se pregunta si existe**. Una comprobación de
existencia se lee como una validación y no valida nada.

**Arreglado en la causa**, no en el síntoma: los 7 archivos se renombraron al código del
CURSO, así que la próxima regeneración los vuelve a enganchar bien. `portadaClase` pasó de
26 a 30 declaraciones, con 0 mal asignadas.

**El desfase era SOLO del módulo 1** — se verificó módulo por módulo antes de renombrar
nada, cruzando qué clases no tienen archivo contra qué archivos no tiene ninguna clase. Los
otros módulos tienen huecos, pero huecos limpios: ningún archivo huérfano al lado.

**Vive en:** `scripts/curso-a-portal.mjs:345` · `public/cono-ugc/`

## ⚠️ Una URL que se CONSTRUYE nunca se comprueba

`CursoReplica.tsx` arma la tapa de cada módulo como `` `/cono-ugc/m${n}.webp` ``. El módulo
«Creativos Animados» sale con `n=6` —sus clases no tienen `codigo`, así que el número cae
al índice del array— y **m6.webp nunca existió**: un 404 en CADA carga del índice del
curso, dibujando el ícono de imagen rota del navegador.

El generador ya tenía la regla escrita para la portada del curso: *«se declara SOLO si el
archivo existe: un `portada` apuntando a un 404 pinta una tarjeta con la imagen rota, que
es peor que una tarjeta sin imagen»*. Lo que faltaba era la mitad del navegador, que es
donde se puede saber si la URL contestó.

## ⚠️ Ninguna imagen tenía `onError`: «no está» y «está» se veían iguales

Ni una de las 6 superficies. Un 404 no dejaba log, ni pantalla distinta, ni nada que un
chequeo pudiera mirar — dejaba el ícono roto y listo. Nueva primitive
`app/conocimientos/Miniatura.tsx`: si la imagen falla se saca del DOM, y `onFalta` avisa a
quien la dibuja para que saque también el marco (`.al-portada` tiene borde, sombra y fondo
propios: vacío pinta una caja de nada).

## ⚠️ Y la trampa de MEDIRLO: 18 «rotas» que no estaban rotas

Primera medición en el navegador: **26 portadas, 18 con `naturalWidth: 0`**. Cero de ellas
estaba rota. Las 26 son `loading="lazy"` y las de abajo del pliegue **todavía no habían
pedido su imagen**.

> **La regla: antes de medir imágenes en una página, scrolleala entera y esperá los
> `load`.** Un `naturalWidth` de 0 dice «no cargada», no «rota», y las dos cosas se ven
> idénticas desde el script. Es la gemela de «verificalo SCROLLEANDO» que ya está escrita
> para los `sticky`: con `scrollY = 0` media pantalla miente.

## Lo que NO existía: la miniatura del link compartido

Un link de un curso pegado en WhatsApp se previsualizaba con el título «Material
compartido» —el mismo para los 32— y sin imagen. **No era un defecto de esa página: no
había un solo `openGraph` en todo `app/`**, ni en la landing pública. Nunca existió.

Dos cosas que no son obvias:

- **Sin `metadataBase` una imagen declarada como ruta relativa NO SE MANDA.** Next la
  necesita para volverla absoluta; sin ella la deja afuera del `<head>` con un warning de
  build que nadie mira. Sale de `APP_BASE_URL`, nunca de un literal.
- **El peso importa.** WhatsApp descarta previews grandes. La captura cruda a @2x pesaba
  620 KB; la tarjeta final son 35 KB.

**Y la regla de privacidad, que es lo que decide el alcance:** la tarjeta la arma el
scraper de la plataforma **sin que nadie haga click**, y `robots: noindex` no lo frena
porque no es un buscador. Así que lo que se declare ahí lo lee cualquiera que vea el
mensaje. Solo `curso` se nombra; `tarea-cs` NO (el share apunta a un lead: el título
llevaría el nombre de una persona a cada chat donde se reenvíe) y `branding` tampoco (es la
galería privada de un workspace). **La lista es BLANCA**: un `recurso` nuevo no se nombra
hasta que alguien lo decida.

⚠️ Y el título genérico **no era un descuido**: está puesto a propósito y documentado dos
veces («sin nombre de la casa: es lo primero que ve —y lo que copia al reenviar— quien
recibe el link»). Lo que se agrega es el nombre del CURSO, que no es el nombre de la casa.
Antes de «arreglar» algo que parece olvidado, buscá si hay un comentario defendiéndolo.

**Vive en:** `app/layout.tsx` · `app/compartido/[token]/page.tsx` · `public/og-mako.jpg`

## Lo que quedó CERRADO

- **Las lecciones de cursoselite traen un campo `thumbnail` y está NULL siempre.** Medido
  sobre **530 lecciones de 5 cursos** (BlueHacker 401, Fukuda 75, Stories Master 22, Claude
  Academy 18, HeyGen 14): cero pobladas. No hay miniatura por clase para traer de ahí; la
  única imagen que la plataforma tiene por curso es `cover_image`.
- **Los 6 cursos sin portada son los 6 de la categoría propia de MaKo**, y esos **no son
  compartibles** (`CURSOS_COMPARTIBLES` los filtra). O sea que los 26 que sí se comparten
  tienen todos su tapa.

## Lo que quedó SIN hacer

- **8 tapas siguen con el escudo «CURSOS ELITE»** y no tienen gemela limpia en `library`
  (se revisó el mejor candidato de cada una: en las 8 el arte es de otro curso). Son
  claude-academy-2026, claude-ai-rodrigo-rojo, cursos-heygen, hackeando-la-edicion,
  jaque-blue, master-marca-personal-5-0, social-funnel y stories-master. **De esas, 4 ya lo
  tenían antes.** Las opciones son recortar la cuña superior izquierda (se pierde arte) o
  pedir la tapa original. **Vive en:** `public/cono-portadas/`
- **`creativos-ugc-realistas` usa el logo de AVATARHYPE en 225x225** como tapa de un
  formato 16:9. Es la identidad correcta del curso y no hay una versión más grande en
  ningún lado del repo. NO se reemplaza por una placa de clase: las 84 de `public/cono-ugc`
  son títulos («Bienvenida · MÓDULO 1 · ONBOARDING»), o sea que servirían de portada
  diciendo el nombre de otra cosa.
- **`public/cono-portadas/avatarhype.jpg`** quedó huérfana (es la tapa del curso que
  `REEMPLAZADOS` redirige). 6 KB, no molesta.
- **7 clases de `creativos-ugc-realistas` siguen sin `portadaClase`** (1.4.3, 1.4.4, 2.1,
  4.6, 5.2 y las dos sin código). Para 1.4.4 «Agentes» no existe la placa en ningún lado:
  la que tenía era la de ApiMart.
- **Los 6 cursos propios de MaKo no tienen tapa en la grilla.** No afecta al compartido
  (no son compartibles), pero la tarjeta sale sin imagen. Habría que diseñarlas.

---

# Iman Gadzhi: tres bugs del pipeline y un curso que no era el que decía — 2026-08-24

Ingesta rutinaria de un curso más (26 clases, 9,2 h, 38 recursos) que destapó **material
equivocado publicado en producción desde hacía semanas**. Vale por los bugs, no por el
curso.

## ⚠️ El id de Drive se buscaba por nombre GLOBAL: 4 recursos abrían el PDF de otro curso

`curso-a-drive.mjs` resolvía el `driveId` de cada archivo así:

```sql
SELECT id, local_title, file_size FROM items
WHERE local_title = ? AND is_folder = 0 AND trashed = 0
```

**Sin acotar por carpeta.** Y cuando la plataforma no da un título en el nombre, los
recursos caen en `recurso-01.pdf` — un nombre que existe **cinco veces** en el Drive.

El código incluso DETECTABA la ambigüedad (`if (reales.length > 1) out.set(n, { ambiguo:
reales.length, id: reales[0].id })`) y se quedaba igual con el primero. Detectar y no
actuar es lo mismo que no detectar, con la diferencia de que parece cubierto.

**Medido sobre los 703 recursos con `driveId` de los 22 cursos publicados: CUATRO
apuntaban a la carpeta de otro curso.** Tres de los cuatro al mismo archivo —el
`recurso-01.pdf` de BlueHacker— colado en Curso de Claude AI, Mateo Maffia y Cursos HeyGen.

> **Por qué nadie lo vio: no hay síntoma.** El recurso tiene su título correcto, su tamaño
> plausible, y abre un PDF de verdad. Solo que es el de otro curso. No hay 404, no hay
> imagen rota, no hay error. La única forma de encontrarlo es preguntar **de qué carpeta
> cuelga el id**, que es una pregunta que a nadie se le ocurre hacer.

**El arreglo:** la metadata de Drive tiene `stable_parents (item_stable_id,
parent_stable_id)`. Con eso se camina desde la carpeta del curso hacia abajo y el match por
nombre se hace **solo dentro de ese conjunto**. Los 3 de Iman que colisionaban pasan a
resolver a un único candidato, y el tamaño coincide **al byte** con el archivo local: 38/38.

⚠️ Y el filtro por carpeta va **antes** del de «id real», no después. Al revés, un homónimo
de otro curso con id bueno le gana al propio con id placeholder — y el resultado es un
recurso que apunta a otro lado, en vez de un «todavía subiendo» que la próxima corrida
arregla sola.

**Cómo verificarlo de nuevo:** `scratchpad/auditar-ids-v2.ts` recorre `CURSOS_TODOS`,
resuelve de qué carpeta cuelga cada `driveId` y compara con la mayoritaria del curso.

**Vive en:** `scripts/curso-a-drive.mjs` (`descendientesDe`, `idsDeDrive`)

## ⚠️ El prompt de Gemini ordenaba TRADUCIR, y eso costó media clase

`lib/transcribe.ts`, dentro de `sttGemini`, decía:

```js
'Transcribí este audio en español.',
```

Escrito cuando todos los cursos eran en español, donde no cambiaba nada. **El primer curso
en inglés salió con 3 de sus 26 clases traducidas al español y 22 en inglés** — Gemini
obedeció unas veces y no otras, así que es una moneda al aire y volver a correrlo no lo
arregla.

**Y no salió gratis en contenido.** Traducir y transcribir literal son dos tareas que
compiten, y en la clase 020 el modelo resolvió el conflicto **resumiendo**:

| | palabras | wpm |
|---|---|---|
| 020, con la orden de traducir | 3.162 | **95** |
| mediana de las 23 en inglés | — | 215 |
| 020, retranscripta sin la orden | **7.026** | 212 |

Se había perdido **más de la mitad** de la clase. El principio y el final eran verbatim
—o sea que ninguna guarda de truncado lo iba a ver— y el medio degeneraba en apuntes
sueltos: «Formulario de admisión.», «Tamaños de audiencia.», «Intuición.». Nadie habla así.

Es «un tope elegido contra UN proveedor apaga a los demás» (AGENTS.md) aplicada al
**idioma**: un valor elegido cuando el universo era homogéneo pasa a gobernar al primero
que no lo es, y nadie vuelve a mirarlo.

**Vive en:** `lib/transcribe.ts` → `sttGemini`

### Y el corolario para la guarda de wpm

El chequeo de transcripción inflada/truncada mide palabras sobre **duración de pared**, y
con eso no puede separar las dos poblaciones: una clase sana con 45% de silencio da 125
wpm, y la clase comprimida daba 96. Cualquier piso que deje pasar a la primera deja pasar
a la segunda. La métrica que sí las separa es **wpm sobre tiempo de VOZ** (`ffmpeg
silencedetect`): ahí la sana sube a ~230 y la comprimida se queda en ~96.

⚠️ Segundo corolario, del mismo chequeo: **el umbral tampoco sirve con denominadores
chicos.** Dos clases de 30 segundos de Fukuda dieron 246 wpm y son habla real. Un piso de
duración (~2 min) es obligatorio o marca clips cortos para siempre.

## ⚠️ `tituloReal` no llegaba al generador: 38 recursos publicados como «recurso-01»

`curso-a-drive.mjs` armaba cada recurso con `archivo, nivel, clases, driveId, modulo,
submodulo` — y `tituloReal` no estaba en la lista. El generador ya tenía
`if (r.tituloReal) label = r.tituloReal`, o sea que sabía qué hacer con él: lo que faltaba
era que llegara.

**Lo que hace que valga la pena escribirlo:** es la MISMA línea donde ese mismo día se
habían agregado `nivel` y `clases`. Se arreglaron dos campos de la terna y el tercero quedó
con el bug intacto — y con cara de arreglado, que es peor.

> **La regla: cuando un dato tiene que cruzar tres archivos, agregar un campo al índice no
> alcanza. Hay que seguirlo hasta el final.** El índice (`recursos.json`) tenía el título
> desde el principio; el consumidor lo sabía usar; el transporte del medio lo tiraba.

## ⚠️ El curso no era el que decía su nombre

La plataforma lo publica como **«Agency Navigator»**. En los videos el propio Iman Gadzhi
dice **«Agency Incubator»** — 34 veces, en 22 de las 26 clases. «Agency Navigator» no
aparece **ni una vez**. Son dos productos distintos de la misma persona.

**Y eso desarma un diagnóstico que yo ya había dado por cerrado.** La numeración del autor
llega a ~40 y hay 26, con huecos sistemáticos al principio de cada módulo; yo lo verifiqué
contra la tabla `lessons` (26 filas, `is_deleted = 0`) y concluí «la plataforma tiene el
curso incompleto». La medición era correcta y la conclusión no: no es un Navigator
mutilado, es **otro curso**.

> Lo que faltaba era una pregunta que no cuesta nada: **¿qué dice el material de sí mismo?**
> Un `grep` sobre las transcripciones lo contesta en un segundo, y ninguna consulta a la
> base lo iba a contestar nunca — la base repite la etiqueta, no el contenido.

Se publica con el nombre que dice el material (mapa `TITULO` de `catalogo.ts`). El slug se
deja: es el de la plataforma y cambiarlo rompería cualquier link ya dado.

## Un curso puede existir, dar acceso `true` y estar VACÍO

«Hablar en público» (Fernando Miralles Coll, `hablar-en-publico`): la página carga, la
sesión está viva, `rpc/check_course_access` devuelve **`true`**… y `get_course_lessons_secure`
**nunca se llama**. Contra la base: **0 lecciones, 0 módulos, 0 recursos**, con
`is_draft: true`.

Es un cascarón: título, tapa e instructor, sin nada adentro. No figura tampoco en
`course_lesson_counts` (un RPC que devuelve el conteo de los 155 cursos que sí tienen
lecciones — buen atajo para saber si vale la pena abrir un curso antes de sniffearlo).

> **La regla, que ya está escrita y volvió a pagar: «no encontré nada» y «no hay nada» son
> respuestas distintas.** Cero capturas en el sniffer es una PREGUNTA, no un resultado.
> Acá el camino fue: filtro amplio → ver qué pidió la página → notar la llamada que falta →
> preguntarle a la tabla. Tres pasos, y el primero es no creerle al cero.

## Lo que quedó SIN hacer

- **4 de los 38 recursos de Iman son cáscaras**: capturas de pantalla (FireShot) de una
  franja con un botón que linkea a un Google Drive ajeno. El material de verdad no se bajó.
  **Vive en:** `C:/cursos/iman-agency-navigator/pdfs/`
- **22 de los 26 PDFs de Iman traen la marca de agua de `getwsodo.com`**, que además se
  cuela en el texto extraíble de las 81 páginas. Es marca de un tercero, igual que el
  escudo «CURSOS ELITE» de las tapas.
- **7 recursos que son de UNA clase se cuelgan de todas las clases de su módulo.** El
  índice de recursos solo sabe de módulos; la asociación fina no está en la API.
- **La guarda de wpm sigue midiendo sobre duración de pared**, sin piso de duración y sin
  normalizar por tiempo de voz. Las dos correcciones están arriba y ninguna está escrita en
  código. **Vive en:** el chequeo ad-hoc del pipeline, todavía sin script propio.

## Un control que tarda una tarde es un control que no se corre

**2026-08-25.** Al cerrar la Certificación en Marketing Digital (153 clases) aparecieron
tres cosas del pipeline mismo, y ninguna fallaba: las tres terminaban en verde.

### 1. `curso-verificar` tardaba 5,6 horas y podía tardar 5 minutos

Le pasaba el **video** a ffmpeg para medir el tiempo de voz:

    ffmpeg -hide_banner -i <clase.mp4> -af silencedetect=… -f null -

Sin `-vn`, ffmpeg **decodifica el stream de video entero para tirarlo**. Medido sobre una
clase de 28:55 en 1080p: **159 s sin `-vn` contra 2 s con él, con el resultado idéntico**
—los mismos 12 tramos de silencio—. Sobre las 153 clases del curso, 5,6 h contra 301 s.

**Y el costo no son las horas.** Este script existe porque los cinco controles se venían
haciendo a mano y salteándose; dejarlo a 5,6 h garantizaba que se siguiera salteando, con
el agravante de que ahora *parece* que hay red. Cuando escribas un gate, medí cuánto tarda
la primera corrida real: si no entra en el ritmo de trabajo de quien lo tiene que correr,
no es un gate, es un adorno.

**Vive en:** `scripts/curso-verificar.mjs` → `segundosDeVoz`.

### 2. Los recursos se publican con nombre genérico y la corrida no falla

`curso-pdfs.mjs` nombra cada archivo con lo que lee del **DOM del curso**, y para eso
necesita una pestaña abierta EN la página con los módulos desplegados. Si no está —o está
con los acordeones cerrados— la asociación sale vacía, el script avisa
«Asocié 0 archivo(s) a su clase» **y sigue**: los 130 caen al nombre de respaldo,
`recurso-01`…`recurso-130`. Termina en verde y el curso se publica numerado.

Ya había pasado con los 38 de Iman Gadzhi. Las dos veces los títulos de verdad estaban a
mano todo el tiempo, en el volcado de la API que el propio pipeline guarda al lado
(`recursos-api.json`, con `title`, `module_id` y `file_size`).

**`scripts/curso-recursos-indice.mjs`** los cruza y emite el `recursos.json` que
`curso-a-drive` y `curso-a-portal` ya sabían consumir. **El cruce no se adivina, se
verifica:** `recurso-NN` codifica la POSICIÓN en `plan.pdfs` y la API declara el
`file_size`, así que se exige que el tamaño en disco coincida. En este curso dieron 106 de
106. Un índice que mezcla dos recursos es peor que uno incompleto — el archivo se abre y el
título dice otra cosa, y eso no lo audita nadie después.

**El aviso que ya existía no alcanzaba.** «Asocié 0 archivo(s)» se imprime al ARRANQUE de
una corrida de 130 descargas: para cuando termina, está a 130 líneas de scroll de distancia.
Un aviso que no frena nada y que además queda sepultado es un aviso que no existe.

### 3. Medir densidad de transcripción sobre el reloj da falsos positivos, y me lo comí

Corrí mi propio chequeo de palabras por minuto **de reloj** sobre las 153 clases y marqué
una como transcripción resumida: 28:55 con 1712 palabras = 59 ppm contra una mediana de 173.

Era falso. Esa clase tiene **66% de silencio**: 584 s de voz sobre 1735 de reloj. Sobre
tiempo de voz da **181 ppm**, que es sano. Lo confirmó una segunda transcripción con otro
modelo (whisper) que devolvió el mismo conteo y cortó en el mismo punto — más 38 «Thank
you» alucinados sobre el silencio final, que es el otro modo de falla y por eso se conservó
la primera.

Lo importante: **el propio `curso-verificar.mjs` tiene escrito, en un comentario de nueve
líneas, exactamente por qué la medida es sobre VOZ y no sobre reloj**, y aun así rehíce el
chequeo por el camino equivocado. La regla ya estaba; lo que faltó fue leerla antes de
escribir el atajo. Si vas a medir densidad de transcripción, la fórmula es
`palabras / minutos_de_voz`, y el silencio se mide con `silencedetect` — nunca contra la
duración del archivo.

### Lo que quedó SIN hacer

**CERRADO el 2026-08-25: los 130 están.** (Lo que sigue se conserva porque el diagnóstico era el equivocado y eso es lo que ahorra tiempo después.) Se creía que faltaban 24 por la sesión: No es un bug del pipeline: la sesión
de `cursoselite.com.mx` caducó y el servidor contesta
`permission denied for function get_document_url`. Necesita un login a mano, UNA vez, en el
Chrome del perfil `C:\cursos\perfil`; después alcanza con
`curso-pdfs` → `curso-recursos-indice --escribir` → `curso-a-drive --solo-ids` →
`curso-a-portal`, que son idempotentes.

⚠️ **Y ojo con cómo se comprueba si la sesión vive.** Mi primer chequeo dio «sesión viva» en
falso: buscaba /iniciar|login|acceder/ en el `innerText` del body, el body todavía estaba
VACÍO, el regex no encontró nada y el vacío se leyó como buena señal. Un chequeo de estado
tiene que exigir la señal POSITIVA —el nombre del usuario, un 200 del endpoint— y no la
ausencia de la negativa.

**Y el backlog de fondo:** `C:\cursos\_nunca-bajados.json` lista **99 cursos vivos con
8.300 clases** que nunca se bajaron. Los cuatro más grandes son TikTok Ads Génesis (508),
NUEVO Organic Ecom 3.0 (453), Organic Ecom (319) y Libertad Inmobiliaria (313 clases + 384
recursos).

## Los dos recursos que no eran un problema de sesión

**2026-08-25, cierre de la Certificación.** De los 130 recursos, 24 no bajaban. El error
decía «nada descargable en 25s» y el servidor contestaba `permission denied for function
get_document_url`, así que se persiguió la sesión durante una tanda entera. La sesión ERA
un problema —caducó dos veces— pero no era EL problema.

### La copia inline que se quedó vieja, con la advertencia escrita al lado

`curso-pdfs.mjs` tenía una copia inline de `puedeSerArchivo`. La cabecera del propio
archivo explica que esas funciones se movieron a `curso-descarga.mjs` justo para que no
hubiera una segunda copia — y la copia se quedó igual. La compartida fue sumando
extensiones (`png`, `jpe?g`, `cube`, `txt`) y la inline se quedó con la lista del día que
se escribió.

Resultado: **los dos únicos recursos de imagen del curso no se bajaron nunca.** Y el modo
de falla es el peor posible — «nada descargable» sobre archivos que SÍ estaban pasando por
la red, que es exactamente el síntoma que la misma cabecera describe para el caso de los
ZIP de «Inteligencia Viral». El mismo bug, la misma frase, dos años de distancia.

**La señal para reconocerlo:** cuando falla un subconjunto pequeño y homogéneo —2 de 130—
la pregunta no es «¿por qué falla?» sino **«¿qué comparten los que fallan?»**. Bastó mirar
su `file_type` en la API: eran los dos únicos `jpg`/`png`.

### Y aceptar imágenes abrió la trampa de al lado

Con las imágenes aceptadas, los dos bajaron… **con la miniatura de la portada del curso**:
19.424 B los dos, mime `image/webp`, cuando la API declaraba 118.052 y 92.839. Se ve como
un éxito —tilde verde, un JPG que abre— y sólo lo delata cruzar el peso.

Es «si hay que desempatar, todavía estás adivinando» en su versión de red: **una página
trae decenas de respuestas que pasan el filtro de “esto puede ser un archivo”, empezando
por las portadas, que son imágenes de verdad.** Quedarse con la primera es elegir por orden
de llegada.

Ahora **el peso declarado decide**: `curso-pdfs.mjs` lee `recursos-api.json` y descarta
cualquier candidato cuyo tamaño no coincida. Con eso los dos entraron con su tamaño exacto.
Y el desempate no cuesta nada donde no hay dato: sin `recursos-api.json` el script se
comporta como antes.

### El script se muere sola, en puntos distintos

`curso-pdfs.mjs` terminó sin error y sin código en el 13, en el 28 y en el 114 de la misma
tanda. No es un recurso concreto: es que en algún momento se le cae el WebSocket de CDP y el
proceso sale en silencio.

**No se diagnosticó: se hizo idempotente y se insiste.** Con el salto arreglado, cada ronda
arranca donde murió la anterior; el bucle corta al llegar al total o tras dos rondas sin
sumar nada — sin ese segundo freno, un recurso que la plataforma nunca sirve deja el bucle
girando para siempre. Fueron 3 rondas para 119 → 128.

### Cómo se comprueba una sesión, y cómo NO

Tres chequeos, dos malos:

| Chequeo | Veredicto |
|---|---|
| Buscar «Iniciar Sesión» en el `innerText` | ✖ dio VERDE con el body todavía vacío |
| Que el título de la página cargue | ✖ la portada del curso es pública |
| `localStorage` → `sb-*-auth-token` | ✓ está o no está |

**Un chequeo de estado exige la señal POSITIVA, no la ausencia de la negativa.** Y el
control que separó de verdad las causas fue **probar un recurso QUE YA HABÍA BAJADO**: al
fallar también, quedó descartado que fueran esos 24 en particular.

⚠️ **Y la trampa del perfil:** los scripts usan un Chrome aparte (`C:\cursos\perfil`, ver
`scripts/curso-perfil.ps1`). Entrar en el Chrome de siempre **no sirve**: es otro perfil y
no comparte sesión. La forma de verlo sin ambigüedad es el token, no la pantalla.

**Vive en:** `scripts/curso-pdfs.mjs` · `scripts/curso-descarga.mjs` (`puedeSerArchivo`,
el único lugar donde se decide qué respuesta es un archivo) · `scripts/curso-recursos-indice.mjs`.

**Estado final:** `curso-verificar` da «TODO BIEN, el curso se puede publicar». 153/153
videos, 152/153 transcripciones (la restante es una placa muda de 11,6 s sin pista de
audio), 130/130 recursos con el peso exacto que declara la API y con su título real, y los
dos que costaron renderizando en producción.

## Una noche entera sin transcribir, y el aviso estaba en el stderr del hijo

**2026-08-26, bajando «NUEVO Organic Ecom 3.0» (453 clases).** La descarga terminó bien y
la transcripción no produjo NADA en 135 rondas. Todo lo de abajo salió de esa noche.

### El filtro del resumen tapaba los crashes

`curso-pipeline.mjs` resume la salida de cada etapa quedándose con las líneas que
matchean `/convertido|transcripta|fallad|✖/`. Son palabras que **sólo existen cuando el
script termina bien**. Un stack trace no tiene ninguna, así que el resumen salía vacío y la
ronda se imprimía como `texto 0/453` — indistinguible de «todavía no hay audio listo». El
código de salida se devolvía y no lo miraba nadie.

Abajo, ScreenApp contestaba `401 Authentication error` en cada una de las 135 rondas.

**La regla: un aviso que no llega adonde alguien mira no existe** — pero acá en su forma
más cara, porque **el aviso EXISTÍA** y lo filtró el padre. Cuando resumas la salida de un
proceso hijo, el filtro es para el camino feliz; el código de salida distinto de cero se
imprime SIEMPRE, con las primeras líneas de causa.

### El respaldo existía sólo de nombre

La cabecera de `curso-transcribir-sa.mjs` dice, textual, que `curso-transcribir.ts` «queda
como respaldo». Nunca se usaba: nadie miraba el fallo, así que no había desde dónde caer.
Cableado el fallback, la transcripción pasó de **67 a 452 en dos rondas**.

Y se **anuncia**: los dos caminos producen un `.md` que se ve igual, así que un respaldo
silencioso deja el curso transcripto por el camino B y al próximo que compare timestamps
con el curso de al lado no le cierra nada.

### Una condición de fin que no se puede cumplir deja el bucle girando

`if (ahora >= total)` no se cumple nunca si el ORIGEN no puede servir una clase. La 240
apunta a un Vimeo que devuelve **500 tres veces, con su vecino en 200** — o sea que la
plataforma tampoco la puede reproducir. Con la condición vieja el circuito iba a girar
hasta el tope de 20 h **sin publicar**, con el curso entero bajado y transcripto al lado.

Ahora el alcanzable es lo BAJADO, y el hueco **se nombra**: se listan las clases que no
entran y por qué. Un total que se alcanza escondiendo lo que falta es peor que uno que no
se alcanza.

⚠️ **Y para descartar una clase hay que ir a la fuente, no al plan.** El id del plan era el
MISMO que sirve la plataforma hoy (verificado clickeando la clase y leyendo el iframe), así
que no era un id viejo del enumerador. Sin ese chequeo, «no baja» se lee como bug propio.

### El gate cazó una transcripción inventada, y el barrido cerró la pregunta

`curso-verificar` marcó **n=116 con 449 palabras por minuto de VOZ**; un hispanohablante
rápido llega a ~230. Medido: el **73% de sus ventanas de 12 palabras estaban repetidas** —el
texto entero dos veces— y además el modelo había copiado el propio prompt adentro de la
transcripción («Transcribe literally everything…»). Rehecha: 2327 palabras contra 4792, 0%
duplicado, 213 wpm.

**Lo que convierte el hallazgo en una respuesta es el barrido.** Se pasaron las 452 buscando
las DOS marcas —prompt copiado y duplicación por encima del 35%— y era la única. Sin eso,
arreglar la que el gate señaló deja abierta la pregunta de cuántas más hay por debajo del
umbral. Es la contracara de «un umbral protege del modo de falla contra el que se escribió»:
el umbral encuentra UNA, el barrido cuenta TODAS.

### Tres cosas del descargador de recursos

- **El piso de 64 bytes de `valido()` rechaza archivos legítimamente diminutos.** El recurso
  «4- enlace» son **32 bytes** con una URL adentro: existe, la API declara sus 32 bytes, y el
  script lo informaba como «nada descargable en 30s». Ahora, si la plataforma DECLARA el
  tamaño y el buffer coincide exacto, eso le gana al piso — **un dato le gana a una
  heurística**, que es la misma regla de «si hay que desempatar, todavía estás adivinando».
- **El salto de «ya está bajado» no cubría `txt`** (ni jpeg/gif/webp/mp4/mp3), así que cada
  corrida rebajaba los .txt. Reanudable a medias es no reanudable.
- **`curso-a-portal` sin `--categoria` cae al bucket genérico.** El pipeline lo llama sin
  categoría, así que el curso publicado por el circuito siempre sale como «Cursos externos»
  hasta que alguien la pasa a mano.

### Y dos del enumerador

- **El relleno del número salía de un 2 fijo.** Con 453 clases eso numera `01…99` y después
  `100…453`, y todo listado por nombre pone la 100 antes que la 99. El pipeline no se entera
  —`nDeArchivo` parsea igual—, así que el daño es **sólo visual, en Drive**, que es justo
  donde una persona recorre el curso. Sale del total.
- **111 de 453 títulos eran el nombre del archivo subido** («1_ Bienvenida_mp4», «3 -
  Creación de logo - Organic Ecom - 1920x1080 459K_ts»). Varias plataformas usan el filename
  como título cuando el creador no puso uno. Se limpia en el ENUMERADOR y no al publicar,
  porque el nombre en disco se deriva del título: limpiarlo después obliga a renombrar
  cientos de archivos que ya viajaron a Drive.

  `tituloLimpio` es conservador a propósito: tres formas, las tres ancladas a un extremo, y
  un `_` en medio de una frase NO se toca. Medido antes de aplicarlo: 112 títulos cambiados,
  cero que pierdan más del 60% de su largo, y los 453 nombres siguen únicos.

### Lo que producía nadie

`modulos-api.json` y `recursos-api.json` los leen **tres** scripts —`curso-recursos-indice`,
`curso-pdfs` y `curso-verificar`— y no los escribía ninguno: existían porque alguien los
armó a mano para un curso. El siguiente arrancaba sin ellos y **sin que nada lo dijera**:
los recursos salen con nombre genérico, el desempate por peso no puede correr, y el
verificador se saltea entero su chequeo de recursos. Todo en verde.

Ahora los produce `curso-api --volcar <dir>`. **Lo que tres consumidores necesitan lo
produce un productor, no la memoria de quien pasó por acá antes.**

**Vive en:** `scripts/curso-pipeline.mjs` · `scripts/curso-plan.mjs` (`tituloLimpio`, el
relleno) · `scripts/curso-descarga.mjs` (`valido`) · `scripts/curso-pdfs.mjs` ·
`scripts/curso-api.mjs` (`--volcar`).

**Estado:** 452/453 clases publicadas, 19/19 recursos con su título real y su peso exacto,
portada puesta, categoría «Orgánico». Verificado en la página desplegada.

**Lo que quedó SIN hacer:** la credencial de ScreenApp está caída (401). Se transcribe por
la cascada, que es gratis igual, pero pierde los `segments[]` con timestamps naturales — los
párrafos salen de una heurística en vez de la fuente. Vive en
`scripts/curso-transcribir-sa.mjs`.

## La lista de recursos sale de la API, y 503 no es 500

**2026-08-26, bajando «AMORir» (60 clases, 9 recursos).** Dos cosas cortas y las dos
valen para cualquier ingesta.

### El scrape de la página no es el inventario

`plan.pdfs` se arma raspando los `a[href*="Reader?type=resource"]` del curso, así que
depende de que cada módulo esté desplegado y de que la plataforma renderice el enlace. La
API, en cambio, **declara** los que existen.

En AMORir la página linkea **8** y la API declara **9**: falta «2.Una ingeniería emocional
del cuerpo». Iterando solo la página ese recurso no se baja nunca, y como el descargador
termina sin errores, el curso se publica con 8 de 9 **y nada lo dice**. Es «antes de
restaurar lo que había, preguntá cuánto DEBERÍA haber» aplicado a la ingesta.

⚠️ **Y por eso `enlacesDeRecursos` vive en `curso-comun.mjs`:** la usan DOS scripts —el que
baja y el que arma el índice— y **los dos numeran por POSICIÓN en esa lista**. Si cada uno
la derivara por su cuenta, `recurso-09` sería un archivo distinto en cada script y el cruce
quedaría corrido sin que nada falle. El orden es estable a propósito: primero los de la
página en su orden, después los que solo conoce la API.

### 503 y 500 son respuestas distintas, y la diferencia es información

Dos clases fallaron con **HTTP 503** de Vimeo. El reflejo, después del caso de Organic Ecom
—donde un **500** resultó ser un video que la fuente no puede servir— es darlas por
perdidas. Son cosas distintas: 503 es sobrecarga pasajera.

**El chequeo cuesta dos segundos y decide el diagnóstico:** pedir el mismo id un par de
veces con `curl`. Los dos de AMORir devolvieron **200** y entraron al reintentar sin tocar
nada; el de Organic Ecom devolvió **500 tres veces con su vecino en 200**, y ése sí es del
origen.

Es el mismo criterio que ya está escrito para las APIs —`permission denied` no es
`column does not exist`— aplicado al HTTP: **antes de anotar algo como «la fuente no lo
tiene», preguntale a la fuente otra vez.**

**Vive en:** `scripts/curso-comun.mjs` (`enlacesDeRecursos`) · `scripts/curso-pdfs.mjs` ·
`scripts/curso-recursos-indice.mjs`.

**Estado:** AMORir publicado con 60/60 clases, 60/60 transcripciones y 9/9 recursos con el
peso exacto que declara la API. `curso-verificar` pasó limpio a la primera.

### Y el chequeo de sesión daba un falso NEGATIVO

El vigía lee el token de Supabase del `localStorage`, y **para eso necesita una pestaña
abierta en ese origen**. Con el Chrome dedicado cerrado no hay ninguna, así que reportaba
«sin token» sobre una sesión perfectamente sana — y con eso se pidió un login que no hacía
falta.

**Un chequeo que necesita un contexto para poder leer el dato tiene que CREAR ese contexto
antes de concluir**, o su respuesta negativa no distingue «no está» de «no pude mirar». Es
el mismo tercer estado de «no pude leer» que ya está escrito para las páginas ajenas. Vive
en `scratchpad/esperar-login.mjs` (abrir la home del origen antes de leer).

## La misma vista vive en DOS rutas y cada una la direcciona distinto

**2026-08-26, poniendo la réplica en todos los cursos.** `CursoReplica` se monta desde dos
lados, y por eso el curso NO viaja igual en los dos:

| Ruta | Cómo se elige el curso |
|---|---|
| `/conocimientos` | `?curso=<slug>` — query, leída por `Conocimientos.tsx` |
| `/compartido/<token>` | `#curso=<slug>` — hash, leído por `PortalCompartido.tsx` |

Y adentro de la vista, la CLASE viaja siempre en el hash (`#clase=N`), porque es lo único
que no depende de cuál de las dos rutas la montó.

**Lo caro no fue el dato: fue lo que reportó el chequeo.** Un script de verificación que
navegaba a `/conocimientos#curso=amorir` se quedaba en la grilla —el hash ahí no lo lee
nadie, y no hay error— y su `waitFor('.ahdoc .ugc-side')` vencía. La salida decía, sobre
los cuatro cursos: **«⛔ la réplica NUNCA se dibujó»**. La app estaba perfecta.

**La regla: un chequeo que espera un elemento y no lo encuentra sabe UNA cosa —que no
apareció—, y no puede afirmar por qué.** «No se dibujó» es una conclusión; el dato es «no
apareció en N segundos». Cuando el timeout venza, el mensaje tiene que traer **dónde estaba
parado** (la URL final y las primeras palabras del `innerText`): con eso, «me quedé en la
grilla» se distingue de «entré y la vista está rota» a la primera lectura en vez de a la
tercera. Un verificador que colapsa las dos en la misma frase manda a arreglar la pantalla
que funciona.

### Y el dev server local puede renderizar y NO hidratar, sin decir nada

Mismo día, cazado persiguiendo lo de arriba: en `localhost:3000` la réplica se quedaba
para siempre en «Abriendo el curso…» —el estado de `useCssDelOrigen` mientras la hoja no
cargó—, con la hoja contestando **200 en 21 ms** por `curl`. La causa no era la hoja: era
que **el `useEffect` no corría**, porque la página nunca hidrató.

Cómo se mide, que es lo que sirve la próxima vez:

```js
[...document.querySelectorAll('body *')]
  .filter((el) => Object.keys(el).some((k) => k.startsWith('__reactFiber$'))).length
```

Cero fibras con los chunks de Next cargados y la consola limpia = el HTML lo pintó el
server y el navegador nunca lo tomó. **La firma es un componente que RENDERIZA su estado
inicial y nunca sale de él**: cualquier estado que dependa de un efecto queda congelado en
su valor de arranque, y desde afuera se lee como «mi feature está rota».

Ya está en `AGENTS.md` que un `export` a medias de la otra sesión rompe el bundle entero;
lo que faltaba era **cómo se comprueba en 5 segundos** y que el síntoma puede ser un
spinner eterno y no una pantalla muerta. El camino que sí cerró la verificación fue
producción — que es lo que ya dice la memoria `verificar-en-navegador`.

**Vive en:** `app/conocimientos/Conocimientos.tsx` · `app/compartido/[token]/PortalCompartido.tsx` ·
`app/conocimientos/CursoReplica.tsx`.

**Estado:** la réplica es la vista de TODOS los cursos desde `098d66c4`. Verificado en
producción sobre cuatro formas —con documentos y tapas de módulo (AvatarHype), sin ninguna
de las dos (AMORir), 47 módulos (Organic Ecom) y 153 clases con 130 recursos
(Certificación)—: la página no scrollea en ninguna, la sidebar mide 900/900, el módulo
activo se pinta, no hay barra horizontal, y el scroll propio aparece donde tiene que
aparecer (`ugc-pcol` con una clase larga abierta, `ugc-nav` con 47 módulos).

⚠️ **Lo que NO se resolvió y hay que mirar:** las tapas por módulo las tiene un solo curso
(`portadasModulo`, y `portadaClase` igual), así que en los otros veintipico las tarjetas de
módulo caen todas al degradé con su número. Es el fallback previsto y se ve deliberado,
pero si se quiere la pantalla de AvatarHype completa, lo que falta es **bajar las tapas de
módulo**, no tocar el componente.
