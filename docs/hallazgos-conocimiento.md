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
módulos escritos a mano viven aparte y se suman en `Conocimientos.tsx`:
`[...CURSOS, CURSO_VSL, CURSO_ANALISIS, CURSO_BRANDING, CURSO_PRODUCTO_APP]`.

**Regla.** Para sumar material al portal, lo que se produce es una **transcripción con el
nombre del `videoId`**, no un archivo de video. Y no se edita `curso.ts` a mano: está
generado. El mismo portal lo consume `/compartido/[token]/CursoCompartido.tsx`, así que
cualquier cambio de forma se ve en dos lugares.

**Vive en:** `app/conocimientos/curso.ts` · `app/conocimientos/CursoPortal.tsx:171,203` ·
`public/cono-tx/`

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
