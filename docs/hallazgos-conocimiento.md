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
