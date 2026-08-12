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
