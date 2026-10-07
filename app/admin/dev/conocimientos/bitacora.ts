// =============================================================================
// Conocimientos / CURSOS — el registro de construcción del área
// =============================================================================
// Alcance: el portal de formación interna (`/conocimientos`, 24 cursos) **y** el
// pipeline que los mete adentro — bajar la clase de la plataforma de origen,
// sacarle el audio, transcribirla, subirla a Drive y generar la ficha del curso.
// Más los links compartidos (`/compartido/<token>`) y la réplica de la pantalla
// de AvatarHype.
//
// ⚠️ El grueso del trabajo NO vive en `app/conocimientos/`: vive en
// `scripts/curso-*` y `scripts/avatarhype-*`, y los artefactos en `public/cono-tx`
// (transcripciones), `public/cono-doc` (documentos + CSS del origen),
// `public/cono-ugc` (imágenes) y `public/cono-portadas`. El `vive[]` del área
// declaraba cinco archivos de la pantalla y por eso su historial veía **11 de 68
// commits**: un barrido de «qué se trabajó y no quedó anotado» dio el área por
// tranquila cuando era la más movida del mes. Corregido el 17/8; es el caso
// testigo de «Una ruta que apunta a la nada» en AGENTS.md.
//
// De dónde salió esto: fecha, hora, commits y el porqué, de `git log` sobre TODAS
// esas rutas —los mensajes de este repo son largos y explican la causa, así que
// son la fuente principal—; las trampas y lo que quedó sin hacer, de
// `docs/hallazgos-conocimiento.md` (2.333 líneas, con su índice «Lo que más muerde
// acá»). El campo `chat` va en «—» de la mitad de agosto en adelante: `docs/chats.md`
// llega hasta el 2026-08-08 y un título inventado es peor que ninguno.
//
// NO es un changelog. Lo que git ya guarda no se repite: va el motivo, la trampa y
// —sobre todo— cuándo el diagnóstico obvio era el equivocado, que en esta área pasó
// tantas veces que tiene sección propia en el documento de hallazgos.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El pipeline de ingesta', detalle: 'Perfil de Chrome con CDP → sniffer del player → plan.json → yt-dlp → audio → transcripción · las cinco etapas reanudables y ninguna con estado terminal', estado: 'hecha' },
  { titulo: 'Drive como almacén de video', detalle: 'El repo no guarda un solo .mp4 · copiar dentro de G: ES la subida, y el file id sale de la SQLite local de Drive for Desktop', estado: 'hecha' },
  { titulo: 'La ficha del curso, generada', detalle: 'plan.json + drive.json + texto/ → curso-<slug>.ts + public/cono-tx · el catálogo es UNO (catalogo.ts) porque el portal y el link compartido leen el mismo', estado: 'hecha' },
  { titulo: 'El portal que se mira', detalle: 'Buscador sin acentos, secciones por lo que el que busca tiene en la cabeza, portadas reales, recursos plegables y navegación entre clases', estado: 'hecha' },
  { titulo: 'Compartir por link', detalle: 'Un curso suelto o la tab entera · sin marca de MaKo y sin la sección propia · copiar es copiar, no rotar (mig 0131)', estado: 'hecha' },
  { titulo: 'Las guardas del enumerado', detalle: 'Contra el DISCO y contra el número que publica la propia página · dedup por módulo, --esperado, huérfanas, intermedios de yt-dlp', estado: 'hecha' },
  { titulo: 'Los 24 cursos cargados', detalle: '~1.900 clases con video, transcripción y recursos, entre el 11 y el 17 de agosto · cada curso rompió una guarda distinta', estado: 'hecha' },
  { titulo: 'La réplica de la pantalla de origen', detalle: 'AvatarHype se ve como en AvatarHype: su shell, sus 598 reglas de CSS, su material · `replica: true` es un atributo del curso, no un caso especial', estado: 'sigue' },
  { titulo: 'Barrer los cursos publicados con la guarda vieja de transcripción', detalle: 'El piso de 400 B/s rechazó diez clases sanas antes de corregirse a 60 B/s + 64 KB, y corrió sobre TODOS · falso positivo mudo: la clase se publica sin texto y nadie se entera', estado: 'cola' },
  { titulo: 'Los apuntes del dueño y la ingesta por lote al RAG', detalle: 'El `resumen` de cada clase sale del bloque «## Apuntes» del .md y hoy está vacío en los 24 cursos · `ConocimientoView` sigue subiendo de a una', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── 11 de agosto: nace el pipeline ─────────────────────────────────────────
  {
    fecha: '11 ago', hora: '01:54', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La ingesta nace versionada, y las cookies eran lo único que rompía la descarga',
    puntos: [
      'Las cuatro piezas van a `scripts/` **versionadas a propósito**: la corrida anterior resolvió lo mismo en `scratchpad/` y se perdió entera. Es el hallazgo #5 del documento del área y la razón de que este pipeline exista dos veces.',
      '⚠️ **El diagnóstico obvio era el equivocado, y todo el diseño giraba alrededor de él.** El perfil dedicado de Chrome nació para esquivar App-Bound Encryption y poder extraer las cookies; resultó que la privacidad por dominio de Vimeo se valida por el header **Referer**, no por sesión. Peor: con el Chrome dedicado abierto la base de cookies queda lockeada, así que el flag que iba a «asegurar» la autenticación era **lo único que hacía fallar la descarga**. La regla que queda: antes de construir alrededor de una credencial, probá sin ella — un `-F` cuesta tres segundos. El perfil dedicado sigue haciendo falta, pero por CDP.',
      'Dos trampas del entorno que fallan **en silencio**, las dos escritas: `--cookies-from-browser chrome` reporta «0 cookies» en vez de fallar (las v20 del perfil por defecto yt-dlp no las descifra), y `Network.enable` sobre la página de arriba no ve las requests del player porque vive en un iframe cross-origin — reporta «no capturé nada» con el video andando delante. Se resuelve con `Target.setAutoAttach` con `flatten`.',
      'El PDF de una clase no se pide con cookies: se navega en el Chrome ya logueado y se sacan los bytes con `Network.getResponseBody`. El navegador ya autenticó y **tiene** los bytes. Mismo patrón que después resolvería las imágenes de la réplica.',
      '`--liberar` (borrar el local ya subido) se escribió con la guarda **en positivo**, cuatro condiciones, y la cuarta es la que importa: Drive te da el id **antes** de terminar de subir, así que hay que comprobar que su metadata reporte el tamaño completo o se pierde una descarga buena.',
    ],
    commits: [
      { sha: 'adbf217e', msg: 'Ingesta de clases: perfil dedicado, sniffer de player, audio y transcripción', lineas: 620, archivos: 4 },
      { sha: '2f69f6a9', msg: 'Curso completo en una corrida: inspect, plan y descarga por lote', lineas: 628, archivos: 3 },
      { sha: 'd0004be0', msg: 'PDFs por CDP, subida a Drive con videoId, y las cookies que no hacían falta', lineas: 423, archivos: 4 },
      { sha: 'e5923e8a', msg: 'curso-a-drive: liberar el local solo con la subida confirmada', lineas: 74, archivos: 1 },
    ],
    archivos: [
      'scripts/curso-perfil.ps1 — Chrome con perfil aparte + CDP. Un `--user-data-dir` no estándar resuelve dos bloqueos con un flag',
      'scripts/curso-sniff.mjs — qué hay abajo del player y con qué headers. Sale con código 2 si detecta EME (DRM)',
      'scripts/curso-plan.mjs — clickea las clases (son `<button>`, no links) y arma plan.json. Marca cada botón con `data-cx` porque React re-renderiza los nodos entre clicks',
      'scripts/curso-bajar.mjs · curso-audio.mjs · curso-a-drive.mjs — descarga, m4a mono 16 kHz, y el id de Drive desde su SQLite local',
    ],
  },
  {
    fecha: '11 ago', hora: '19:46', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Del disco al portal: el primer curso publicado, y transcribir a US$0',
    puntos: [
      '`curso-a-portal.mjs` cierra el circuito: `plan.json` (títulos y módulos) + `drive.json` (el videoId real) + `texto/<clase>.md` → `public/cono-tx/<videoId>.json` y `app/conocimientos/curso-<slug>.ts`.',
      '**El módulo del curso va en archivo PROPIO, nunca dentro de `curso.ts`.** Ese archivo es auto-generado y todo lo escrito ahí se pierde en la próxima corrida, en silencio. Es la misma razón por la que después la CATEGORÍA, la PORTADA, el AUTOR, la exclusión del AvatarHype viejo y `replica: true` viven en `catalogo.ts`.',
      '**El `resumen` de cada clase sale del bloque «## Apuntes» del .md, no de la transcripción.** El bucle que pidió el dueño es: él escribe apuntes en el .md, se vuelve a correr el generador, aparecen. Hoy está vacío en los 24 cursos — la mitad de la feature existe y nadie la usó todavía.',
      'La transcripción pasó a **ScreenApp** (ya pagado) en vez de whisper-1: 249 clases × 13,7 min son US$20 con OpenAI y US$0 acá. Dos ventajas aparte del precio: `transcript.segments[]` trae los cortes con timestamps, así que **los párrafos salen de la fuente y no de una heurística**, y no hay tope de 25 MB.',
      '⚠️ **`curso-audio.mjs` leía archivos que otro proceso estaba escribiendo.** Agarró un intermedio de yt-dlp de 170 MB con solo la pista de video, ya completa, mientras el audio seguía en `.part`; ffmpeg falló con «Invalid argument» y **el diagnóstico aparentaba ser de ffmpeg cuando era una carrera de escritura**. Dos filtros, y el primero en positivo: se aceptan solo los nombres que el plan declara.',
      '⚠️ **Un fetch anónimo a `/conocimientos` devuelve HTTP 200 con la pantalla de login**, también en local. El curso nuevo «no aparece» y el cableado está bien. Lo desarma en un segundo grepear por un curso que ya existía: si AVATARHYPE tampoco aparece, falta la sesión, no el curso.',
    ],
    commits: [
      { sha: '0896a2d8', msg: 'Curso de Claude AI en /conocimientos: generador de ficha + transcripciones', lineas: 502, archivos: 13 },
      { sha: 'cc40ea75', msg: 'Transcribir con ScreenApp (gratis) y no leer una carpeta que otro proceso escribe', lineas: 280, archivos: 2 },
      { sha: 'b5c95cc8', msg: 'Las 20 clases con transcripción: pasada final del generador', lineas: 41, archivos: 12 },
      { sha: 'bd44efd9', msg: 'curso-pipeline: correr la cola audio→transcripción mientras baja el curso', lineas: 91, archivos: 1 },
    ],
    archivos: [
      'scripts/curso-a-portal.mjs — el generador de la ficha. Es el que corta con exit 4 si falta material',
      'scripts/curso-pipeline.mjs — el loop. Termina por TRES caminos, y el tercero (descarga estancada) es el que evita que un descargador caído deje el loop girando 12 horas en silencio',
    ],
  },

  // ── 12 de agosto: el portal se vuelve producto ─────────────────────────────
  {
    fecha: '12 ago', hora: '11:10', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El catálogo estaba escrito dos veces: cada curso nuevo nacía con el link en 404',
    puntos: [
      '**Sin ningún síntoma del lado del admin.** El portal juntaba seis fuentes de cursos y `/compartido/[token]` armaba la suya con dos, así que los cursos que viven en archivo propio se listaban, se podían compartir desde la UI, y su link abría un 404 de Next. El share se creaba bien y la fila quedaba viva; el 404 salía del `notFound()` **con el token ya resuelto**, por eso el share mostraba «0 visitas» — se registran después.',
      'La regla que queda: **un link compartido que da 404 con 0 visitas NO es el token, es el catálogo.** La lista pasa a `app/conocimientos/catalogo.ts` y la importan los dos lados.',
      'La otra mitad, y es la que impide que vuelva: el generador cerraba diciendo «sumalo al array TODOS de `Conocimientos.tsx`», instrucción que quedó vieja con el refactor. **Seguir la instrucción vieja reintroduce exactamente el bug que el refactor cerró.** Ahora el script nombra `catalogo.ts`, el array `CURSOS_TODOS`, y dice por qué es el único lugar.',
      'Después se apoyaron ahí las tres decisiones que no pueden vivir en el archivo del curso: `CATEGORIA`, `PORTADA` y `AUTOR` (que reescribe el pipeline), la exclusión del AvatarHype viejo (borrarlo del auto-generado vuelve solo), y `CURSOS_COMPARTIBLES`, calculado por **exclusión de sección** y nunca por lista de incluidos — una lista de incluidos deja afuera en silencio todo lo que nadie se acordó de sumar.',
    ],
    commits: [
      { sha: 'dc5c2318', msg: 'Los links de /conocimientos daban 404: el catálogo estaba escrito dos veces', lineas: 126, archivos: 4 },
      { sha: 'ccce6eb8', msg: 'curso-a-portal apunta a catalogo.ts, no a Conocimientos.tsx', lineas: 11, archivos: 1 },
    ],
    archivos: ['app/conocimientos/catalogo.ts — el único lugar donde se suma un curso. Los comentarios de arriba explican por qué cada decisión vive ahí y no en el archivo del curso'],
  },
  {
    fecha: '12 ago', hora: '12:18', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Los 71 recursos que se bajaban y nadie veía, y la guarda que mira el DISCO',
    pedido: 'eso lo tienes que hacer bien SIEMPRE, con todos los cursos',
    puntos: [
      'El dueño reportó que en el curso de Claude no aparecía **ningún** recurso. Los 20 PDFs estaban bajados y subidos a Drive, pero el generador emitía `recursos: []` y el portal dibuja esa sección solo si `recursos.length > 0`. **Trabajo hecho, invisible.** El gemelo del mismo hilo: `recursos/` no estaba en la lista de directorios que se copian a Drive, así que los 71 archivos de ATV se bajaban, se contaban como completos y **nunca subían** — el síntoma aparecía dos pasos después.',
      '⚠️ **Tercera vez que un contador miente**, y por eso quedó la regla: reportó «71 bajado(s) · 0 con error» con 64 archivos en disco, porque siete recursos distintos se llaman «Miro» en el mismo módulo y escribieron sobre el mismo archivo. **Un contador que suma dentro del bucle no es una verificación**; el resumen se calcula contra el destino real (`readdirSync`). Y el nombre único es determinista (`sort_order`, y si choca 6 chars del id), no un contador de iteración: si no, la segunda corrida genera otros nombres y se duplica todo.',
      'De ahí sale la guarda que cierra el molde entero: `curso-a-portal.mjs` **CORTA con exit 4** si hay material en `pdfs/` o `recursos/` y la ficha sale con menos recursos que archivos en disco. El chequeo se hace **contra el disco, que es la fuente**, no contra lo que se acaba de emitir — un contador que se mira a sí mismo no verifica nada. Y el mensaje de error dice los cuatro pasos para arreglarlo, no solo que falló.',
      'Decisión de alcance que se repite: los recursos de ATV quedan a **nivel curso** y no colgados de cada clase, porque la plataforma los agrupa por MÓDULO. Colgarlos de «la clase N» sería inventar el dato.',
      'Y queda documentado por qué dos clases de ATV no se pueden bajar nunca: la fuente lo declara de tres formas (`duration 00:00`, 404 en la misma URL que embebe su iframe, y 404 no es 401/403 cuando las otras 247 dieron 200 con el mismo Referer). El contraste que separa: **duración cero = muerta; duración real que falla = transitoria.**',
    ],
    commits: [
      { sha: '84e00eb3', msg: 'Los 71 recursos que /vip/ tenía y no bajábamos, y el contador que mintió otra vez', lineas: 263, archivos: 2 },
      { sha: 'c9929eab', msg: 'ATV Advantage entra a /conocimientos: 247 clases con video y transcripción', lineas: 3762, archivos: 249 },
      { sha: '173c6e1c', msg: 'Los recursos existían en Drive y el portal no los mostraba: recursos: [] vacío', lineas: 296, archivos: 4 },
      { sha: '25b2580f', msg: 'Guarda: no se emite la ficha si hay material en disco que no llegó a la ficha', lineas: 526, archivos: 2 },
    ],
  },
  {
    fecha: '12 ago', hora: '22:35', chat: '—', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Compartir la tab entera, y lo que un link repartido NO muestra',
    pedido: 'estoy queriendo copiarlo, no rotar el link',
    puntos: [
      'Hasta acá se compartía UN curso; ahora también el portal completo. La lista se resuelve **en cada carga**: un curso que se suma después aparece en los links ya repartidos. **Es la tab, no una foto.**',
      '⚠️ «Copiar link» preguntaba si emitir uno nuevo y **mataba el anterior** — era la única salida posible mientras del token solo se guardara el `sha256`. Ahora el token se guarda también cifrado (AES-256-GCM v2, el mismo de las credenciales: clave HKDF por fila, sal propia y AAD que lo ata a SU fila) y copiar lee y descifra. **No se tira la propiedad que motivó el hash:** quien resuelve un token entrante sigue mirando `token_hash` y nada más, y un dump de la base sigue sin entregar links vivos. La rotación sobrevive solo para las filas anteriores a la migración, y ahí dice por qué.',
      'Pedido del dueño: en lo que se reparte afuera no va nada de MaKo. No hace falta rotar ningún link — **es lo que se dibuja, el token no se toca**. El rótulo pasa a «Conocimientos / Formación» y el eyebrow sale por un booleano `sinMarca` y no por el texto, así los dos rótulos viven en un archivo y ninguna pantalla puede escribir un tercero.',
      '**Y `CURSOS_COMPARTIBLES` deja de ser «todos menos Branding» para ser «todos menos la sección propia»**, que además cubre a Branding. La sección se nombra en `CATEGORIA_PROPIA` porque la leen el mapa de categorías y el filtro: un literal repetido en los dos se desincroniza el día que alguien la renombre, y el mapa quedaría bien mientras el filtro **deja de excluir nada, en silencio**.',
      'El hub del curso era la única de las tres vistas sin «Volver»: se entraba a un curso y la única salida era el botón del navegador. Y desde un link de la tab entera el botón decía «Volver» a secas, que no dice a dónde va — pasó a decir «Todos los cursos». Un segundo botón habrían sido dos salidas al mismo lugar.',
    ],
    commits: [
      { sha: 'e8902ffa', msg: 'Compartir la tab entera de Conocimientos por link', lineas: 222, archivos: 7 },
      { sha: '78534c7a', msg: 'El hub del curso no tenía botón de Volver: se entraba y no había salida', lineas: 8, archivos: 1 },
      { sha: '4dfa3b2d', msg: 'Copiar un link es copiarlo, no rotarlo (mig 0131)', lineas: 261, archivos: 6 },
      { sha: '8e084c36', msg: 'Los links compartidos salen sin marca y sin la seccion propia', lineas: 91, archivos: 8 },
    ],
  },
  {
    fecha: '12 ago', hora: '22:58', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La portada de un curso no es la imagen más grande de su tarjeta',
    puntos: [
      '**Elegir «la primera imagen de la tarjeta» agarra el chrome del sitio:** la miniatura del curso de Claude era el LOGO de la plataforma. La señal que los distingue es la **frecuencia** — un logo aparece en las 152 imágenes del catálogo y una portada solo en la suya. Y si la menos repetida igual aparece en varias, **no se pone portada**: mejor ninguna que el logo en todos los cursos.',
      '⚠️ Segundo criterio, aprendido después con Hormozi: **elegir por área agarra el avatar del autor.** 450×450 = 202.500 px le gana a una tapa de 456×256. Lo que separa una tapa de una foto de perfil es la **proporción** (>= 1.4); el área queda de último desempate.',
      '⚠️ **`slice(-2,-1)` sobre la URL funcionó de casualidad y puso la tapa de otro curso, dos veces.** Para `/vip/course/<slug>/watch` el penúltimo segmento da el slug; para `/curso/<slug>` da literalmente «curso», que está en el href de las 152 tarjetas. **Lo que lo hizo durar dos intentos es más importante que el bug:** el script instalaba y reportaba «✓ 25 KB · jpg» sin comprobar DE QUÉ era la imagen. Un tamaño y una extensión no dicen nada del contenido. Ahora el slug sale del último segmento útil y antes de instalar se verifica que el texto de la tarjeta mencione palabras del título.',
      '⚠️ **«No se pierde información» no es lo mismo que «se ve bien».** Se cambió el banner por una caja 16:9 con `contain` para no recortar nada, y era el arreglo equivocado: el formato banner es una **decisión de diseño**, no un accidente. Lo que había que corregir era el ancla del recorte (`object-position: center 28%`), porque en una tapa de curso la persona está arriba y lo prescindible son los íconos del pie. Antes de reemplazar un tratamiento visual, preguntarse si es un defecto o una decisión.',
      'La extensión de una portada sale de los **BYTES**, no del nombre: «Bluehackers.webp» era webp de verdad, pero el nombre miente seguido. Y para las tres tapas que no existen en ningún lado se genera una tipográfica con la marca de la casa: **no se busca en un buscador** — una imagen que no se puede verificar como la tapa real dice algo falso sobre el curso, aparte del problema de derechos.',
      'Y una pieza que existe por una limitación del canal: el dueño pasa las portadas **pegándolas en el chat**, y de ahí no hay bytes que escribir a un archivo. `curso-portada-manual.mjs` es la bandeja: él las suelta en una carpeta y el script las instala validando por bytes, aceptando alias por nombre del curso y reemplazando la anterior aunque tenga otra extensión (si quedan dos, la que gana depende del orden de lectura del directorio, que es un bug esperando).',
    ],
    commits: [
      { sha: '2365fead', msg: 'Conocimientos: secciones, recursos plegables, portadas y el autor en el título', lineas: 340, archivos: 13 },
      { sha: '58cf102f', msg: 'Bandeja para instalar portadas a mano (una imagen del chat no llega al disco)', lineas: 119, archivos: 1 },
      { sha: 'f50bbbf6', msg: 'Las portadas reales, y el slug que ponía la de otro curso', lineas: 112, archivos: 12 },
      { sha: '65e4e6be', msg: 'Las portadas se mostraban recortadas y les cortaban la cara', lineas: 191, archivos: 6 },
      { sha: '30c0ec1f', msg: 'La portada vuelve a ser banner: el problema no era que recortara, era desde dónde', lineas: 47, archivos: 2 },
    ],
  },

  // ── 13 de agosto: el portal se puede navegar, y los enumeradores mienten ────
  {
    fecha: '13 ago', hora: '13:00', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Un curso de 116 clases enumerado como CERO, y un ZIP que no era un PDF que falló',
    puntos: [
      '⚠️ **La misma heurística rota servía para dos cosas, y un bug tapaba al otro.** `curso-plan.mjs` reconocía una clase por tener duración `mm:ss`, y «M5 -95» no la muestra: cortó con «no encontré ninguna clase» estando en la página correcta. El efecto peor era el segundo: la señal de «este click ABRIÓ el acordeón» era «¿crecieron las clases visibles?», así que con el detector en cero abrir los 18 módulos se leía como no haber abierto ninguno — **el síntoma apareció en la parte que menos se parecía a la causa.**',
      'Lo que evita el próximo fallo silencioso: **cada cabecera publica su progreso «0/11», o sea que la PÁGINA dice cuántas lecciones tiene.** Ese número es ajeno a nuestra heurística, así que se compara contra él y se ABORTA si el enumerado queda corto más del 10%, en vez de escribir un plan a medias.',
      '⚠️ **«No apareció ningún PDF» eran tres ZIP que estaban pasando por la red en ese momento.** El script cableaba «PDF» en TRES lugares —el filtro de mime, la extensión puesta antes de saber qué llegaba, y la validación contra `%PDF-`— y cada uno descartaba en silencio. El curso se habría publicado con `recursos: []`. Y el bug de fondo en el portal no era el ZIP sino el **default**: `TIPO_POR_EXT[ext] ?? \'pdf\'` declaraba PDF cualquier extensión desconocida y dibujaba un visor con «sin vista previa». El default ahora es `file`, que es el que no miente cuando no se sabe.',
      '⚠️ **CDP devuelve el cuerpo VACÍO —0 bytes, sin error— para lo que Chrome trata como descarga.** La salida no fue pelearse con CDP sino ver que **la sesión hacía falta para AVERIGUAR la URL, no para leerla**: el bucket es público. Mismo patrón que con Vimeo, donde lo que autentica es el Referer.',
      '⚠️ **Quedarse con «la respuesta más grande» costó dos diagnósticos equivocados.** La página llama al mismo endpoint antes y después de resolver la sesión: la anónima devolvía 92 filas SIN `video_id` y la buena 41 CON, y el capturador se quedaba con las 92 «por ser más completas». Eso hizo pensar primero que el curso estaba bloqueado y después que había una sola sesión activa. Ahora se puntúa por **utilidad** (filas que traen el campo sin el cual el pipeline no puede hacer nada) y el tamaño solo desempata. **Tamaño ≠ corrección.**',
      '⚠️ Y un gemelo de CSS: **`.al-chip` estaba definido DOS veces en la misma hoja.** Los chips del filtro declaraban radio 999px y monoespaciada y nunca se vieron así, porque más abajo otra regla con la misma especificidad ganaba. Sin error y sin warning — el mismo molde que cuatro días después costaría tres pares de reglas peleándose en la réplica.',
      'Del lado que se mira: buscador **sin acentos y sin mayúsculas** (uno que exige tildes es uno que no se usa), cada término por separado y todos presentes, contadores que ignoran la categoría elegida (si no, al filtrar por una las demás muestran 0 y no se puede saltar sin limpiar), y los chips **envuelven, nunca scroll lateral** — una categoría detrás de un gesto es una categoría que no existe.',
    ],
    commits: [
      { sha: 'fc41e638', msg: 'Conocimientos: buscador y filtro por categoría, y dos secciones nuevas', lineas: 125, archivos: 3 },
      { sha: '4d38cc59', msg: 'Un ZIP no es un PDF que falló: el downloader de recursos daba éxito por vacío', lineas: 1089, archivos: 50 },
      { sha: 'f9076d18', msg: 'Un curso de 116 clases se enumeraba como CERO, y el filtro pasa a desplegable', lineas: 290, archivos: 4 },
    ],
    archivos: [
      '⚠️ `| head` mata el script productor con SIGPIPE y el resumen en pantalla igual parece sano (plan.json nunca se escribió). Vuelve a morder dos veces el 16 y el 17 de agosto',
      '⚠️ El CSS del portal es un template literal: un backtick adentro lo parte al medio y tira errores de tipos que no mencionan la causa',
    ],
  },

  // ── 13 al 16 de agosto: 24 cursos, y cada uno rompió una guarda distinta ────
  {
    fecha: '13 ago', hora: '22:55', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La carga en serie: cada curso rompió algo distinto, y nada hizo ruido',
    puntos: [
      '⚠️ **Las transcripciones estaban rotas en TODO link compartido, y con sesión se veían bien.** El archivo existía, estaba commiteado y desplegado; pidiéndolo directo a producción, **HTTP 307**: son estáticos en `public/cono-tx/<videoId>.json` y el `matcher` del middleware excluye assets **por extensión** —`png|jpe?g|svg|webp|gif|ico|css|js|woff2?`— y `.json` no está. Cada pedido entraba a la puerta de auth y sin sesión se iba a `/inicio`. **Por qué sobrevivió tanto: en `/conocimientos`, con sesión de admin, se ven perfectas.** Es la variante de «en local esto no se ve» que AGENTS.md documenta para las rutas con auth propia; acá es **«con sesión esto no se ve»**. Se excluye por RUTA y no agregando `json` a la lista: hay endpoints que sí tienen que estar gateados.',
      '⚠️ **Un curso puede estar cargado DOS VECES en la plataforma, y ni los ids únicos ni los títulos únicos lo ven.** Jaque Blue publica 40 lecciones que son 20: cada una aparece otra vez con el sufijo « (1)» del archivo re-subido, o sea otra subida a Vimeo (otro id) y otro título. **Las dos comprobaciones eran correctas y las dos eran irrelevantes.** La señal que sirve es la **duración idéntica** sobre el mismo título base — dos videos distintos no duran lo mismo al décimo de segundo. Y el corolario más barato: el curso reportaba 8,9 h y quedó en 4,5, exactamente la mitad. **Un total que se parte al medio al deduplicar es la confirmación más barata que hay.**',
      '⚠️ **Y el mismo dedup borró una clase real en el curso siguiente.** Bigseo tiene una «01. Introducción» por módulo (doce, cada una con su video) y dos duran 01:26 por casualidad. No dejó rastro: 77 filas con módulo vivo, 77 ids, 77 videos distintos, ni error ni hueco de numeración. Ahora se compara **dentro de un mismo módulo**. Lo peor de la secuencia: el riesgo estaba escrito con esas palabras en el hallazgo del día anterior y se shippeó igual — **«esto podría romperse» no es un control, es una nota; cuando un análisis produce «habría perdido X si Y», Y ya es un caso de prueba.**',
      '⚠️ **Un guard que llega al número correcto por una señal que no es la causa es peor que uno que falla, porque nadie lo vuelve a mirar.** «Instituto de Comunicación» devuelve 316 filas para un curso de 158 y el dedup por título+duración ya daba 158 — ese era el problema. Las 158 de más cuelgan de nueve `module_id` que la API no devuelve: una copia fantasma que la UI filtra al hacer el join. El filtro nuevo es estructural y va **en positivo** (se queda con las que cuelgan de un módulo vivo), y se verifica contra la única fuente que no comparte el bug con el extractor: los contadores que la propia página dibuja.',
      '⚠️ **Una bandera `i` escondió toda clase cuyo título empezara con F.** `/\\.f[^.]*\\.(mp4|...)$/i` tomaba «09.Funciones» por un intermedio de yt-dlp. **El falso positivo de este filtro es MUDO**: el archivo no llega a Drive, no se transcribe, y el único rastro es una línea entre setenta y siete. Cuando un filtro decide qué NO procesar, su falso positivo cuesta mucho más que su falso negativo. La regla estaba copiada en tres archivos con el mismo bug; ahora vive en `scripts/curso-comun.mjs` con un test que falla si alguien vuelve a poner la `i`.',
      '⚠️ **Un `| grep` se comió el código de salida y el lote armó planes de otro curso.** `curso-abrir.mjs` se negó a elegir entre «Hackeando la Edición» y «Hackeando el Algoritmo» **exactamente como debía** —avisa y sale con código 3— y esa negativa se perdió en la cañería: en un pipeline sobrevive el código del ÚLTIMO comando. Es «un `console.warn` no es un control» con una vuelta más: acá el control existía y estaba bien hecho, y **falló el que lo llamaba**. Se suma `--esperado`, que es la única guarda posible porque el dato correcto —la INTENCIÓN— no está en ningún lado de la captura.',
      '⚠️ **Un reintento que consulta un id PERSISTIDO no es un reintento.** ScreenApp aceptó un archivo, no lo transcribió nunca y contestó HTTP 200 sin `transcript`, sin estado y sin error; cada reintento volvía a consultar el mismo cadáver, con el síntoma idéntico a «tarda mucho». Un identificador persistido es una **optimización para reanudar, no un hecho permanente**: si la espera vence, se suelta.',
      'Una clase **sin id de Drive ya no entra a la ficha**: antes se emitía con `videoId: null` y quedaba una lección que no reproduce nada, que es lo que el dueño reporta como «clases rotas». Y se implementó de verdad la regla que el comentario ya prometía —la duración en cero delata un video muerto **solo cuando el curso publica duraciones**—, con el umbral (60%) medido contra los cuatro cursos en disco antes de dejarlo.',
      '⚠️ **Cuatro supuestos rotos de una vez en Brian Tracy**, y el que ata todo: dos errores que se tapaban entre sí daban el total correcto (10 clases + 1 cabecera colada = 11) y el resumen imprimía «10/10 clases con video» — **un pleno perfecto al que le faltaba una lección**. Los acordeones son mutuamente excluyentes, así que no existe ningún instante en que las 11 estén en el DOM: **la lista de clases es una travesía, no una foto.**',
      'Y `curso-drive-fusionar.mjs`, para cuando el material ya está en Drive: 211 de 242 clases estaban, y bajar el curso entero habría duplicado ~9 GB sobre el cuello real del proyecto. El emparejado tardó tres correcciones y **las tres eran maneras distintas de colgar el video equivocado de una clase**. La guarda que queda: antes de escribir `drive.json` se chequea que ningún id aparezca en dos clases, y si pasa no se escribe nada — **dos lecciones apuntando al mismo video es peor que una lección sin video.**',
    ],
    commits: [
      { sha: '512b5994', msg: 'Fusionar un curso con la carpeta de Drive que ya existía: las 242 de Felipe Vergara', lineas: 3987, archivos: 38 },
      { sha: '4d7aa838', msg: 'Un reintento que consulta un id persistido no es un reintento', lineas: 465, archivos: 213 },
      { sha: 'cd3dd12e', msg: 'Jaque Blue tenía el curso cargado dos veces, y ningún chequeo de unicidad lo vio', lineas: 450, archivos: 4 },
      { sha: '722b7ea6', msg: 'Una clase sin video no entra a la ficha, y dos cursos tienen huecos en el origen', lineas: 637, archivos: 39 },
      { sha: 'd533df3f', msg: 'Filtrar lecciones huérfanas: el guard acertaba el número por el motivo equivocado', lineas: 91, archivos: 2 },
      { sha: '1999ec24', msg: 'El dedup comparaba en todo el curso y borró una clase real', lineas: 58, archivos: 2 },
      { sha: '36e00e25', msg: 'Guarda --esperado: un pipe se comió el exit code y el lote capturó otro curso', lineas: 103, archivos: 2 },
      { sha: '7e6d344d', msg: 'Una bandera `i` escondía toda clase cuyo título empezara con F', lineas: 201, archivos: 6 },
      { sha: '94e141c8', msg: 'La lista de clases es una travesía, no una foto', lineas: 387, archivos: 2 },
      { sha: '2895045a', msg: 'El merge a medio hacer pesa un 90% y se llama .mp4', lineas: 54, archivos: 3 },
      { sha: '5702f936', msg: 'Las transcripciones estaban rotas en TODO link compartido', lineas: 120, archivos: 7 },
    ],
    archivos: [
      'scripts/curso-comun.mjs — `esIntermedio` y el filtro de nombres: fuente única, con test de nombres reales. Nació de tener la misma regla copiada en tres archivos con el mismo bug',
      '⚠️ El badge de la clase no puede pelear con la numeración del autor: la tarjeta decía «CLASE 09 · 5.3 ROBA COMO ARTISTA» porque a Jaque Blue le faltan lecciones **en el origen**. Gana el del autor —es el que él menciona hablando— y se decide POR TÍTULO, no por curso',
    ],
  },
  {
    fecha: '14 ago', hora: '21:04', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: '«Volver» se arregló TRES veces, y los dos primeros arreglos eran correctos',
    pedido: 'si estoy dentro de los modulos y le doy volver, me vuelve a la clase',
    puntos: [
      '**Lo que importa no es la tercera causa, sino que las dos primeras correcciones eran CORRECTAS y no alcanzaron.** Compartían la premisa de que el historial sabe a dónde volver. Sabe **de dónde viniste**, que es otra cosa — y mientras haya un solo camino a la pantalla las dos coinciden, así que envejece cada vez que se agrega un camino nuevo, semanas después y sin nada que lo explique.',
      'Las tres causas, en orden: Anterior/Siguiente navegaban con `push` y cada salto dejaba una entrada que «Volver» recorría una por una; después, el rótulo del curso arriba a la derecha **apilaba** una entrada de hub encima de la clase; y el hub era el último que seguía llamando a `router.back()`.',
      'La regla, que subió a AGENTS.md porque gobierna cualquier botón de volver nuevo: **el destino de «Volver» es una propiedad de la PANTALLA, no del camino.** Cada nivel declara el suyo y se navega explícitamente. Si el nivel de arriba no existe (un share de UN curso), el botón **no se dibuja**: uno que no lleva a ningún lado es peor que no tenerlo.',
      'La excepción es el RECURSO, y es la que el dueño marcó como correcta: ahí sí depende de si entraste desde el índice o desde una clase. **Ese contexto se hace DATO** (`?…&de=N`) y no se deduce del historial, así sobrevive a un reload y a un link copiado — que es justo lo que el historial no hace.',
      '⚠️ De la misma tanda, dos trampas de proceso: se coló un **byte NUL crudo** dentro de un regex del archivo y `grep` empezó a tratar `CursoPortal.tsx` como binario (no lo agarra el typecheck: es un carácter válido dentro de un string). Y anterior/siguiente salen de la **posición en el array**, nunca de `n ± 1`: el `n` es el número de la clase y puede no ser contiguo cuando la plataforma tiene huecos.',
      '⚠️ Y el hallazgo caro de la misma corrida: **`G:` no reporta la cuota de Drive, reporta el disco físico.** Leído mal, la conclusión era «hay que comprar almacenamiento». La pista que lo desarma es que `C:` y `G:` daban el MISMO total (454,1 GB).',
    ],
    commits: [
      { sha: 'be305f8c', msg: 'Transcripción: copiar y descargar. Y navegación entre clases', lineas: 115, archivos: 1 },
      { sha: 'be85c669', msg: 'Volver deja de desandar clase por clase, y la navegación se va abajo del video', lineas: 133, archivos: 3 },
      { sha: '12db4183', msg: 'El «Volver» de una clase deja de depender del historial del navegador', lineas: 32, archivos: 5 },
      { sha: '5ce89db4', msg: 'El «Volver» del hub ya no depende del historial', lineas: 85, archivos: 4 },
      { sha: 'd24ee7e9', msg: 'Cosecha: el «Volver» del historial y la cuota de Drive que no era', lineas: 106, archivos: 2 },
    ],
    archivos: [
      'app/conocimientos/CursoPortal.tsx — las tres vistas (hub, clase, recurso) y sus tres destinos explícitos',
      '⚠️ Dos gotchas al verificar con Playwright: `networkidle` no resuelve en una clase con iframe de Drive, y las tarjetas de un `<details>` cerrado no se pueden clickear',
    ],
  },
  {
    fecha: '16 ago', hora: '08:57', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'cosecha',
    titulo: '«Bajado» no es «entregado»: las tres etapas que se saltean sin error',
    puntos: [
      'El dueño lo reportó como **«no veo aún nada de cambios en MaKo»**, que es exactamente cómo se ve esto. El pipeline de un curso tiene CINCO etapas y no estaban escritas como secuencia en ningún lado: había que deducirlas leyendo cinco scripts. Se corrieron tres y se entregó la mitad creyendo que estaba completo.',
      'Las tres que se saltean solas, y las tres **sin fallar**: `--drive` en `curso-pipeline` (sin el flag la subida no se solapa y el curso tarda el doble, sin un error, que es el modo de falla más difícil de notar); `curso-a-drive` con «ya está en Drive» (porque `--solo-copiar` copia pero no resuelve los ids, y `drive.json` es lo que come el paso siguiente); y el paso a mano en `catalogo.ts`, que el script avisa **en un `console.log` al final de una corrida larga**. La regla: cuando un pipeline tiene etapas que se pueden omitir sin error, la secuencia se escribe entera en un lugar.',
      '⚠️ **Una optimización borró el insumo de otro paso.** Con las 158 clases ya en Drive, correr `curso-a-drive.mjs` una vez más dejó un `drive.json` de 32: el script arma su lista recorriendo el **local**, y liberar por tandas dejó de hacerlo la copia de trabajo. Publicado así, el curso sale con 32 clases, y termina diciendo «32/32 clases con videoId», que es verdad y suena a éxito. `--solo-ids` **confirma el número equivocado**. Se reconstruye contra Drive, nunca contra el disco.',
      '⚠️ **Un proxy no se rompe cuando aparece un dato malo: se rompe cuando aparece un dato BUENO que nunca vio.** El piso de 400 B/s del transcriptor rechazó DIEZ clases sanas de hasta 87 minutos (tutoriales de pantalla a bitrate bajísimo, una da 104 B/s). El clip mudo que motivó la guarda daba 129 B/s, o sea que **está por encima de diez clases perfectamente buenas**: la tasa dejó de separar. Lo que separa es el tamaño absoluto. El piso de tasa baja a 60 B/s y el de bytes sube a 64 KB. **⚠️ Falta barrer los cursos ya publicados: esa guarda corrió sobre todos, y su falso positivo es mudo.**',
      '⚠️ **El intermedio que más engaña**: `<clase>.temp.mp4` crece hasta pesar casi lo mismo que el final y tiene la extensión del final, así que no se parece a un temporal. Pegó en dos lados a la vez — `curso-audio` intentó convertirlo y el contador del pipeline lo contó como clase lista, anunció «la descarga ya terminó» y se fue con ffmpeg escribiendo a 253 MB cada 15 s. **Es la misma trampa que «100M money Models» por el otro lado: allá un contador quieto se leyó como «el descargador murió», acá uno de más se leyó como «ya terminó». Las dos veces la conclusión fue abandonar y las dos veces el proceso estaba sano.**',
      'Decisión del dueño sobre secciones, y queda escrita porque el criterio es mejor que el que se había usado: «Instituto de Comunicación» va a «Desarrollo personal» y «Bigseo» a «SEO», no a Orgánico. **Una sección se nombra por lo que el que busca tiene en la cabeza, no por la propiedad que comparten sus cursos.** Y un curso publicado no se mueve de sección si no se pidió: cambia dónde lo encuentra alguien que ya sabía dónde estaba.',
    ],
    commits: [
      { sha: '44189d55', msg: 'Creator Club entra por Hotmart: 62 clases, 31,6 h', lineas: 980, archivos: 66 },
      { sha: 'fe215d05', msg: 'Cosecha: liberar el local trunca drive.json en silencio', lineas: 41, archivos: 1 },
      { sha: 'fba1b436', msg: '«Bajado» no es «entregado»: la secuencia entera, en un solo lugar', lineas: 39, archivos: 1 },
      { sha: '55bf9bea', msg: 'Cosecha: proyectar por horas, no por cantidad de clases', lineas: 30, archivos: 1 },
    ],
    archivos: [
      'docs/hallazgos-conocimiento.md §«La secuencia completa de un curso» — las cinco etapas, escritas porque me las salteé',
      '⚠️ Al estimar, proyectar por HORAS y no por cantidad de clases: con 9 de 158, los mismos bytes daban 26 GB o 173 GB. El método malo daba el número TRANQUILIZADOR — cuando dos estimaciones difieren, el sospechoso es la que te deja seguir sin hacer nada',
    ],
  },

  // ── 17 de agosto: replicar la pantalla de AvatarHype ────────────────────────
  {
    fecha: '17 ago', hora: '00:14', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'AvatarHype rehecho, y el MATERIAL de la clase, no solo su video',
    puntos: [
      'El curso se rehizo desde la academia y pasó de 6 clases a 30: son el mismo curso con dos cortes distintos, así que dejar los dos hacía que alguien abriera el desactualizado creyendo que era el bueno. **La exclusión va en `catalogo.ts` y no borrándolo del auto-generado**, y está pegada a la inyección de sus 13 recursos a propósito: si se saca una sin la otra, los recursos aparecen DUPLICADOS.',
      '⚠️ **Lo que sale mal se ve PUBLICADO, no en el JSON.** Tres bugs pasaron typecheck, 1022 tests y la lectura del plan, donde `modulo: "1"` es un string perfectamente válido: los módulos se llamaban «1», «3.1», «3.2» (se guardaba el CÓDIGO de la lección como nombre), el portal decía «30 CLASES · 30 CLASES», y otro curso decía « · Parte 1» con el punto abriendo la línea. **Y el corolario que más importa: el bug de presentación tapaba uno de contenido** — al arreglar los nombres la cadena llegó al módulo 5 y aparecieron dos clases que faltaban.',
      'El material entra como **HTML y no como texto plano porque la ESTRUCTURA es contenido**: qué parte de un prompt es la cámara y cuál el guion vive en las clases del marcado, y eso es la mitad de lo que el curso enseña. Aplanarlo lo perdería. Van 346 KB de documento a `public/cono-doc/`, 8,8 MB de imágenes a `public/cono-ugc/` y los 51 clips a Drive — cargados al abrir la clase, mismo motivo y mismo mecanismo que la transcripción.',
      '⚠️ **El origen sirve según el DESTINO de la request, no según la sesión.** La misma URL devuelve la imagen a un `<img src>` y falla a un `fetch()` —relativa, absoluta y con `credentials:\'include\'`, las tres— con **«TypeError: Failed to fetch», que no es 401 ni 403**: la request no llega a hacerse, así que no hay status que leer ni log que mirar. La salida no es pedirlas mejor: es **no pedirlas** y cosechar los bytes de la capa de red con `Network.getResponseBody`.',
      '⚠️ Y cosechar de la red va **al revés de la intuición: cuantas más veces corrés, menos baja** — lo cacheado no genera request, así que no hay nada que cosechar. Va `Network.setCacheDisabled` antes de navegar. Tercera trampa del mismo trío: **lo que vive detrás de una tab no existe hasta clickearla**; ahí estaban 5 de las 56 imágenes.',
      '⚠️ **La pestaña de CDP se cuelga y CDP no lo dice.** El WebSocket abre normal y ni `Runtime.enable` contesta. Sin timeout el script espera para siempre **y no imprime una línea**, así que no hay ni con qué diagnosticar: parece que tarda y está muerto. El arreglo es cerrar la pestaña, no reiniciar Chrome; la prueba que lo aísla en 15 segundos es pedir `Runtime.enable`.',
      '⚠️ Y de la ronda anterior, que costó tres intentos: **la app de origen no renderiza si `document.visibilityState` no es `visible`**, y `Page.bringToFront` **NO es el arreglo** — trae la pestaña al frente dentro de su ventana, así que con la ventana minimizada `hasFocus()` da `true` y `visibilityState` sigue en `hidden` **al mismo tiempo**. Por eso «funcionaba» según dónde estuviera la ventana, que es la peor forma de fallar. Va `Emulation.setFocusEmulationEnabled`.',
    ],
    commits: [
      { sha: 'a42b68ce', msg: 'El AvatarHype viejo sale de la grilla, y sus 13 recursos se mudan al nuevo', lineas: 825, archivos: 2 },
      { sha: 'b417a0bd', msg: 'Los módulos tenían por nombre su número, y el portal repetía el conteo', lineas: 121, archivos: 4 },
      { sha: '104cc7c2', msg: 'AvatarHype con los módulos que se llaman como se llaman', lineas: 235, archivos: 2 },
      { sha: 'ed058799', msg: 'El curso de AvatarHype replicado: documentos, prompts, imágenes y clips', lineas: 1289, archivos: 93 },
    ],
    archivos: [
      'scripts/avatarhype-media.mjs — la cosecha de bytes desde la capa de red · avatarhype-doc.mjs — la captura del contenido · avatarhype-doc-portal.mjs — el pasaje al portal',
      '⚠️ El saneo del HTML (fuera `<script>`, `on*=` y `javascript:`) va **donde el dato entra**, no en cada render. Y una imagen sin archivo local queda como hueco marcado, nunca apuntando al origen: un `src` que solo carga para quien tiene sesión allá es la peor forma de «funciona»',
      '⚠️ Van 30 de 32 clases: las dos de «Definir voz y clonación» están bajadas y transcriptas, pero **Drive dejó de subir** (id `local-…` y `file_size 0` en su SQLite, medido con un archivo de 30 bytes que a los 5 minutos ni aparecía)',
    ],
  },
  {
    fecha: '17 ago', hora: '10:25', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Faltaba un div, y con él el 99% del CSS: 593 reglas de 598 no matcheaban',
    puntos: [
      'El pedido era que el curso **se viera como en AvatarHype**, no colgado adentro de la grilla de MaKo. Se montó su shell con el molde capturado del DOM del origen y sus 550 reglas rescopeadas. Es un atributo del CURSO (`replica: true` en `catalogo.ts`, no en el archivo que el pipeline reescribe), no un caso especial escrito en el portal: el día que haya un segundo curso así se marca y ya está.',
      '⚠️ **Tres fallas seguidas, las tres se veían igual desde el navegador —la pantalla mal— y ninguna era del componente.** (1) El origen monta `.ugc > .ugc-shell` y el componente montaba `.ahdoc > .ugc-shell`: medido, **593 de 598 reglas cuelgan de `.ugc` y solo 5 aplican sin él**. El síntoma es traicionero porque parece que el CSS no cargó, cuando cargó entero y no matchea nada. La pregunta que lo evita, y cuesta un `grep`: **antes de escribir el componente, contá cuántas reglas cuelgan de cada contenedor del origen.**',
      '(2) **Las variables de tipografía viven en el MISMO elemento que el scope.** Next emite clases `__variable_*` con los `--font-*` en el div de la app; al rescopear quedaron apuntando a un elemento inexistente y las **440** referencias resolvieron en vacío. La pantalla «se parecía» y no era. Y sus `@font-face` apuntan a archivos self-hosteados en el dominio del origen: no sirven, las 7 familias se piden a Google.',
      '(3) **Rescopear con un reemplazo global rompe lo que tiene estructura.** `body .algo { display:none }` se **colapsó** a `.ahdoc { display:none }` y escondió el curso entero: el DOM completo, 33 tarjetas montadas, CSS cargado, **cero excepciones y la pantalla en blanco**. Y a 15 `@media` se les pegó el prefijo adelante, que no es CSS válido y el navegador tira el bloque entero. El CSS se procesa **regla por regla** y los at-rules aparte.',
      '⚠️ **Un reemplazo hecho con PowerShell rompió la codificación del archivo y COMPILA igual.** `Get-Content` de PS 5.1 lee con la ANSI del sistema, así que cada acento quedó convertido dos veces: 126 caracteres, «lección» leyéndose «lecciAn» y las flechas como rombos negros. **Ni el typecheck ni los tests lo ven** — se descubre mirando la pantalla. Al revertirlo, el BOM se había vuelto un carácter de reemplazo y TypeScript declaró el archivo binario.',
      '⚠️ **Y una regla del PROPIO origen se llevó puesto el layout:** `.ugc-shell` trae `margin: calc(50% - 50vw)`, o sea que se sale de su caja a propósito para ocupar la ventana. Allá funciona porque su caja ES la ventana; acá vive dentro del contenedor del portal. Se neutraliza ese margen — el intento de agregar otro ancho mandó la barra a `x = -284`.',
      'Lo que NO se replica, y queda escrito en el componente: la barra de SU plataforma (Comunicados, Propuestas, Recomienda y gana, el chat de Ayuda, el Tour). Son features de su producto; acá serían **botones que no llevan a ningún lado, que es peor que no estar**.',
    ],
    commits: [
      { sha: '40852f52', msg: 'AvatarHype se ve como en AvatarHype: su pantalla, no la grilla del portal', lineas: 424, archivos: 35 },
      { sha: '81104760', msg: 'El rescopeo del CSS escondía el curso entero: .ahdoc quedaba en display:none', lineas: 1981, archivos: 2 },
      { sha: '17a1d987', msg: 'Faltaba el contenedor .ugc: 593 reglas de 598 no matcheaban', lineas: 55, archivos: 3 },
      { sha: '9580959f', msg: 'El texto ilegible era codificacion rota, y la barra tapaba por un margen del origen', lineas: 223, archivos: 3 },
    ],
    archivos: [
      'scripts/avatarhype-css.mjs — el rescopeo · app/conocimientos/CursoReplica.tsx — los dos contenedores',
      'El chequeo que cierra las tres sobre el archivo generado y tarda un segundo: `grep -c \'\\.ahdoc *@media\'` → 0 · `grep -c \'^\\.ahdoc.*display: *none\'` → 0 · `grep -c \'\\.ahdoc \\.<contenedor> \'` → cuántas dependen del wrapper',
    ],
  },
  {
    fecha: '17 ago', hora: '14:10', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La barra falló CINCO veces, y las cinco verificaciones anteriores daban bien',
    puntos: [
      '⚠️ **La barra horizontal no se arregla peleando con el ancho.** El breakout necesita `50vw` sí o sí, y `50vw` **incluye el ancho de la barra vertical**, así que siempre iban a sobrar unos píxeles. Dos intentos corrigiendo el ancho antes de matarla donde se crea.',
      '⚠️ **Y ese arreglo mató el sticky.** `overflow-x: hidden` con `overflow-y: visible` NO deja el eje Y quieto: su valor **usado** pasa a `auto`, `body` se vuelve un contenedor de scroll, y todo `position: sticky` de adentro **deja de pegarse DEL TODO — no se degrada, desaparece.** Medido a 1920×880 con `scrollY = 302`: la barra en `y = -302`, con su `top: 0` puesto. **Las cinco verificaciones anteriores midieron con `scrollY = 0`, que es el único estado en que un sticky roto se ve igual que uno sano.** La regla subió a AGENTS.md: verificalo SCROLLEANDO.',
      '⚠️ **Una barra puede tener el alto CORRECTO y no llegar arriba.** Medía 900 en una ventana de 900 y arrancaba en `y = 84`: el header de afuera mide 60 y el wrap pone 24 de padding. **Alto y origen son dos causas distintas**, y subirle el alto no podía arreglarlo. El header sobraba: la réplica ya trae su marca y su Volver, era chrome DUPLICADO — el mismo contenedor que se reportó tres veces como «la caja que tapa el papel».',
      '⚠️ **El mismo elemento bien en una pantalla y mal en la otra.** El sticky del origen trae `top: 64px` por un header de plataforma que acá no existe; en el índice no se notaba porque mide justo 900 y **sin scroll disponible un sticky no se despega**. Si una medición sale bien, probala donde haya scroll.',
      '⚠️ **En una hoja GENERADA, lo escrito a mano va al FINAL.** El generador armaba `cabecera + origen` con todas las reglas propias adentro de la cabecera, y con la misma especificidad gana la última: **el síntoma se repitió meses como «le pongo `!important` y no pasa nada».** Al pasarlo a `cabecera + origen + COLA` aparecieron **tres pares de reglas propias peleándose entre sí**, ganando siempre la de más abajo, y la de arriba —la que tenía el comentario explicando el porqué— mintiendo.',
      '⚠️ **Dos causas apiladas sobre el mismo hash, y el F5 volvía al índice CON la URL correcta en la barra de direcciones.** Una: la réplica escribía el hash arrancando de un `URLSearchParams` vacío, o sea lo REEMPLAZABA, y en un link compartido ese hash lo comparte con el portal. Dos: una carrera entre el efecto que restaura y el que escribe — **los efectos del hijo corren ANTES que los del padre**, así que la réplica leía el hash justo en la ventana en que estaba vacío. El mismo orden mordió después con `scrollTo(0)` del padre ganándole al `scrollIntoView` del hijo.',
      '⚠️ **Había 4 segundos de curso crudo antes de que llegara el CSS.** La hoja son 333 KB y se pedía al montar. **Una pantalla a medio vestir y una pantalla rota son indistinguibles desde afuera** — es el mismo cuadro que se reportó tres veces como «no se ve nada». Ahora el curso no se dibuja hasta que la hoja cargó, y si la hoja falla se muestra igual sin estilo: lo único inaceptable es quedarse en blanco. Eso explicó además dos rojos de la verificación anterior: **no eran del producto, eran de medir una pantalla a medio montar.**',
      '⚠️ **Un pipe que filtra la salida filtra también el error, y el commit salió verde con la mitad adentro.** Un backtick en un comentario cerró el template literal del CSS, el generador tiró `SyntaxError`, el `Select-String` no imprimió nada y el `git add` del css no encontró cambios. **Se verifica el ARCHIVO, no la salida del comando.** Es la tercera vez que un pipe muerde en esta área.',
      '**Y la regla que gobierna toda la tanda: typecheck y 1025 tests pasan con la pantalla rota.** En una vista replicada lo único que verifica es el DOM medido, con el número al lado, y llegando **por el camino del usuario** — el primer script de prueba escribía el hash a mano y con eso reproducía el bug que venía a verificar.',
    ],
    commits: [
      { sha: 'f1a4f02a', msg: 'Los seis defectos de la replica: URL, transcripcion, recursos, flechas, botones y ancho', lineas: 385, archivos: 3 },
      { sha: 'd820646c', msg: 'El curso sale de la caja: pegado al papel, sidebar al borde y clases en grilla', lineas: 65, archivos: 3 },
      { sha: '9edc85a4', msg: 'El link compartido recuerda donde estabas: el lugar viaja en la URL', lineas: 32, archivos: 1 },
      { sha: '28e35010', msg: 'Fuera el scroll horizontal, el fondo se ve, y el indice deja de contradecir a la barra', lineas: 71, archivos: 3 },
      { sha: 'd4b2d1aa', msg: 'La barra horizontal se mata en el documento, no peleando con el ancho', lineas: 35, archivos: 3 },
      { sha: '361ef504', msg: 'La barra no llegaba arriba porque algo la empujaba, no porque le faltara alto', lineas: 47, archivos: 3 },
      { sha: '991077c2', msg: 'El portal borraba el hash un instante antes de restaurarlo', lineas: 19, archivos: 1 },
      { sha: '8f730eb8', msg: 'La barra se despegaba del techo en la leccion, no en el indice', lineas: 7, archivos: 1 },
      { sha: '237cb915', msg: 'El commit anterior no llevaba el CSS: el generador reventaba y el pipe lo tapo', lineas: 9, archivos: 2 },
      { sha: '323c3018', msg: 'La barra se iba con la pagina: mi propio arreglo de la barra horizontal mato el sticky', lineas: 182, archivos: 2 },
      { sha: 'e2f22612', msg: 'La cola del CSS no era una cola: iba ANTES del origen', lineas: 509, archivos: 2 },
      { sha: '1041d512', msg: 'Habia 4 segundos de curso crudo antes de que llegara el CSS', lineas: 37, archivos: 1 },
      { sha: '6e2e9c25', msg: 'Tres cosas que aparecieron al hacer que scrollee el contenido y no la pagina', lineas: 101, archivos: 4 },
    ],
    archivos: [
      'app/conocimientos/CursoReplica.tsx — el shell mide exactamente la ventana, la barra es un bloque normal de alto completo (sin sticky no hay de qué despegarse) y lo que scrollea es el contenido. Así funciona la barra de MaKo, que es lo que se pidió',
      '⚠️ Nada de flechas unicode sueltas en ese archivo: el editor las muestra bien y COMPILA, así que ni el typecheck ni los tests las ven',
    ],
  },
  {
    fecha: '17 ago', hora: '17:00', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'Lo que este área dejó escrito, y lo que sigue abierto',
    puntos: [
      '**La familia de trampas que más vale de acá, y ninguna la ve el compilador:** un contador que se suma a sí mismo no verifica nada (tres veces); un pipe se come el exit code y un `| head` mata el productor con SIGPIPE (tres veces); un guard que llega al número correcto por la señal equivocada es peor que uno que falla; y el falso positivo de un filtro que decide qué NO procesar es **mudo** y cuesta mucho más que su falso negativo.',
      '**El diagnóstico obvio fue el equivocado tantas veces que tiene índice propio** en `docs/hallazgos-conocimiento.md` («Lo que más muerde acá», 22 entradas): «Google nos bloquea la IP» era un bug del parser; las cookies eran lo único que rompía la descarga; «no apareció ningún PDF» era un ZIP pasando por la red en ese momento; la respuesta más grande era la inservible; y el link compartido que daba 404 no era el token, era el catálogo.',
      '**Verificar una vista replicada no es medir una propiedad.** Se midieron opacidades, clases y posiciones cinco veces y las cinco dieron bien, porque las cinco medían con `scrollY = 0` o sobre una pantalla a medio montar. Lo único que verifica es el DOM medido **con el número al lado**, llegando por el camino del usuario, y esperando una **condición del DOM** y nunca un tiempo fijo.',
      '⚠️ **Lo que quedó abierto, con su archivo:** barrer los cursos publicados con la guarda vieja de transcripción (`scripts/curso-transcribir-sa.mjs`, el piso de 400 B/s corrió sobre todos y su falla es muda); las dos clases de AvatarHype que Drive dejó de subir; el bloque «## Apuntes» de cada `.md`, que es la mitad de una feature que existe y nadie usó todavía; y la ingesta por lote al RAG — `ConocimientoView` sigue subiendo de a una clase a mano.',
      '⚠️ **Y una decisión de producto que no se toca:** la fuente del material entra en el criterio, no solo el formato. Un tercero revendiendo el catálogo de 70 creadores al 1% del precio no transfiere el derecho a redistribuir, y lo que se ingesta al RAG **se le sirve a clientes que pagan** — el riesgo aterriza en MaKo. Las fuentes limpias son material propio, cursos comprados directo al creador, las llamadas de Fathom y lo que genera la fábrica de creativos. Y el límite técnico que no se cruza en ningún caso: si el player pide un `.mpd` o el network muestra EME, es DRM y ahí **se frena y se avisa**.',
    ],
    commits: [
      { sha: 'd3aa7fdd', msg: 'Cosecha: replicar una pantalla ajena, y el push que no genera build', lineas: 90, archivos: 2 },
      { sha: '6333dd99', msg: 'Cosecha: replicar la pantalla de otra plataforma, y por que fallo cinco veces', lineas: 110, archivos: 2 },
      { sha: '0d6141c2', msg: 'Cosecha: un eje en hidden convierte el otro en auto, y con eso mata el sticky', lineas: 151, archivos: 2 },
    ],
    archivos: [
      'docs/hallazgos-conocimiento.md — 2.333 líneas. El índice de arriba es el atajo: no se abre entero (~17.000 tokens), se grepea la ruta del archivo que vas a tocar',
      'AGENTS.md §«Un eje en `hidden` convierte el otro en `auto`» y §«En una hoja GENERADA, lo escrito a mano va al final» — las dos reglas de esta área que gobiernan código nuevo',
      'docs/hallazgos-infra.md — el push que NO genera build: `vercel ls` no lo detecta (su primera fila decía Ready por el deploy de otro commit). La pregunta correcta no es «¿el último deploy está listo?» sino «¿producción sirve MI byte?», y se contesta con un curl contra el archivo que cambiaste',
    ],
  },
  {
    fecha: '6 oct', hora: '20:40', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Compartir por link CADA curso, no solo todos los cursos',
    pedido: 'Me falta el botón de compartir con link cada curso, no solo todos los cursos',
    puntos: [
      'El botón que había compartía la tab ENTERA (`recurso: conocimientos`, alcance `todo`). Para repartir un curso suelto no había ninguno — ni en la grilla ni adentro del curso.',
    ],
  },
  {
    fecha: '6 oct', hora: '21:20', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El botón por curso, en los dos lugares — y su call site viejo era código muerto',
    puntos: [
      '**En la grilla**, uno por tarjeta (`compartirDe` en `Selector`), y **adentro del curso**, en la barra de arriba al lado del nombre. Los dos usan el MISMO `Compartir` con el mismo `recurso`/`recursoId`, así que los dos enlaces caen en la misma lista de «quién tiene acceso»; lo único que cambia es el tamaño del disparador (`compacto`).',
      '⚠️ **El diagnóstico obvio era el equivocado, y decía que ya estaba.** `Hub` dibuja `{compartir}` en su hero y `Conocimientos.tsx` se lo pasa a `CursoPortal`: leer ese camino contesta «adentro de cada curso ya está». Lo que no nombra a `compartir` en ninguna línea es el `return` de 30 líneas más arriba — `if (curso.replica) return <CursoReplica …/>` — y `replica: true` lo pone el CATÁLOGO para todos los cursos, no curso por curso. O sea que el hub no se alcanza nunca y su call site era **código muerto**: la capacidad estaba escrita y adentro de un curso no había forma de usarla.',
      '**Lo encontró el navegador, no el archivo:** abrir un curso y contar los nodos de `.al-hero-top` → **0**. Y un `grep -n compartir CursoPortal.tsx` lo delataba antes de razonar (lista el 985 del hub y no el 956 de la réplica). La regla de la casa «grepeá el call site» tiene su espejo: **un call site que existe puede no ejecutarse, y eso no se ve en el grep — hay que mirar qué rama corta antes.**',
      '⚠️ **Y el modal se iba DETRÁS de las tarjetas.** `.cmp-ov` es `fixed; inset: 0; z-index: 120` y eso promete la ventana entera, pero se lo come cualquier ancestro posicionado: con `z-index` le clampea el 120 contra SU nivel, y con `transform` pasa a ser el bloque contenedor del `fixed`. Los dos ancestros nuevos los tienen (el de la tarjeta es un span absolute que se mueve en el hover; la barra del curso es `sticky; z-index: 20`). Medido: el navegador decía que «Cerrar» estaba visible y habilitado y el clic no le llegaba nunca. Va con `createPortal` al `body`.',
      '**El control es HERMANO de la tarjeta, nunca un hijo:** `Card` ES un `<button>`, y uno adentro de otro no recibe clicks. Y el lift del hover lo escucha el ENVOLTORIO, o pasar el cursor por el botón no levanta la tarjeta y las dos piezas se despegan a mitad del gesto.',
      '**Medido en el navegador:** 132 tarjetas / 132 botones; el modal abre con el curso correcto, cuelga de `<BODY>`, mide 1440x900 en una ventana de 1440x900, cierra, y la URL no cambia (el clic no cae en la tarjeta). Adentro del curso, 1 botón con el mismo comportamiento. Cero errores de página. 0 errores de tipos y 4100 tests en verde.',
    ],
    archivos: [
      'app/conocimientos/CursoPortal.tsx — `compartirDe` en `Selector`, el `.al-rescard-wrap` que apoya el control sobre la tarjeta, y el `compartir` que ahora SÍ baja a `CursoReplica`',
      'app/conocimientos/CursoReplica.tsx — lo dibuja en `.ugc-topbar`, al lado del nombre del curso. El estilo va en línea a propósito: `public/cono-doc/ugc.css` es una hoja GENERADA del origen y una regla escrita ahí se la come la próxima regeneración',
      'app/conocimientos/Compartir.tsx — el prop `compacto` (mismo componente, otro tamaño) y el overlay por `createPortal(…, document.body)`',
      'tests/conocimientos-compartir.test.ts — 6 guards, probados rompiéndolos: cada rotura tumba SU test y sólo el suyo (5/1 las seis veces)',
      'docs/hallazgos-conocimiento.md — la entrada con las tres trampas y lo medido',
    ],
  },
  {
    fecha: '6 oct', hora: '22:10', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Cada fila de «quién tiene acceso» tiene que decir QUÉ comparte',
    pedido: 'Donde dice "Cualquiera con el enlace" debería decir también el título de lo que estoy compartiendo si es todos los cursos o uno en específico',
    puntos: [
      'Mandó la captura del modal de un curso con DOS filas idénticas («Cualquiera con el enlace · <prefijo>» / «N visitas»): desde la pantalla no había forma de saber qué repartía cada una.',
    ],
  },
  {
    fecha: '6 oct', hora: '23:05', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La fila nombra lo que comparte — y apareció un enlace vivo que ninguna pantalla listaba',
    puntos: [
      'Cada fila dice ahora QUÉ comparte en su segundo renglón: «Todos los cursos · 673 visitas» en el modal de la tab, «Curso de Claude AI - Rodrigo Rojo · 15 visitas» en el de un curso. Va abajo y no arriba porque el h3 del modal ya dice ese mismo nombre y la API filtra la lista por recurso_id: en negrita y primero, la lista serían N copias del encabezado tapando lo único que distingue una fila de otra.',
      '⚠️ **El nombre NO sale de `shares.etiqueta`.** Esa columna se escribe una sola vez en el insert y ningún update la vuelve a tocar: es la foto del día en que se emitió el link. Medido sobre las 40 filas de producción, **ya divergió**: el share id=4 dice «Curso AVATARHYPE» y ese curso hoy se llama «AvatarHype». El id es la clave, el título es el parecido — así que el nombre se DERIVA (`nombreDeShare`, lib/share-nombre.ts) y la etiqueta queda de respaldo.',
      '⚠️ **Y ESE MISMO SHARE ESTABA VIVO Y NO LO LISTABA NINGÚN MODAL.** Esto no se pidió: salió de medir. El filtro del GET comparaba el id crudo (`s.recurso_id === recursoId`), y `avatarhype` se había reemplazado por `creativos-ugc-realistas`, así que ninguna pantalla podía pasar ese id. Resultado: tres filas con ese recurso_id, **una VIVA, de invitados, con 13 visitas y el link funcionando**, que no se podía ver ni revocar desde la app. No da error: la lista contesta con lo que encuentra, y «no hay más enlaces» es indistinguible de «hay uno que no sé buscar». Ahora el filtro resuelve el slug canónico por los DOS lados.',
      '⚠️ **El tercer lector de la etiqueta es un MAIL que sale a un tercero.** «Sumar gente a un enlace que ya existe» le pasaba `share.etiqueta` a `invitar()`, que la interpola en el asunto y el cuerpo: invitar a alguien al share id=4 mandaba «Te compartieron: Curso AVATARHYPE». Arreglar sólo la pantalla habría dejado el modal y el mail diciendo cosas distintas de la MISMA fila. Los dos leen ahora la misma función.',
      '**Por eso se deriva en el SERVER y no en el navegador**, aunque el catálogo ya viaje al cliente en esta ruta: Compartir.tsx también viaja en /compartido/[token] —atarlo al catálogo se lo mandaría a cualquier pantalla que lo monte— y con dos resolvedores el modal y el mail se desincronizan.',
      '**El ancho, medido:** el título más largo del catálogo son 82 caracteres y pide 431 px sobre un renglón de 285. Cede el título (ellipsis, con el nombre entero en el tooltip) y las visitas van enteras. Verificado forzando ese título en una fila real: recorta, el renglón sigue en 17 px, la fila no creció y los botones no se movieron. De paso se arregló un defecto que se ve en la captura de Martín: `.cmp-item-in` no tenía `flex`, así que el space-between repartía 114 px sobrantes en dos huecos y uno quedaba ENTRE los dos botones. Ahora son los 10 px del gap.',
      '**Cómo se midió:** una corrida de 10 agentes (5 lectores con su refutador) sobre de dónde sale el título, más una consulta propia de sólo lectura a las 40 filas de `shares` en producción para confirmar el enlace invisible antes de tocar el filtro.',
      '⚠️ **Y dos guards dieron VERDE sobre su propio bug**, los dos porque el universo del assert era más chico que la pregunta: el de «ningún backtick en la hoja de estilos» leía el fuente SIN comentarios —y lo prohibido vive justo ahí—, y arreglado eso seguía mirando UNA de las dos hojas `<style jsx>` del archivo. El backtick no es hipotético: mordió escribiendo este mismo cambio, con la regla ya en AGENTS.md.',
    ],
    archivos: [
      'lib/share-nombre.ts — cómo se nombra un share. Recibe el resolvedor por parámetro para poder testearse sin cargar 132 fichas, y sin server-only para que el test lo pueda importar',
      'app/api/compartir/route.ts — el `titulo` derivado por fila, el filtro por slug canónico (`canonico`) y el mail leyendo la misma función',
      'app/conocimientos/Compartir.tsx — el segundo renglón de la fila y quién cede en el ancho',
      'tests/conocimientos-compartir.test.ts — 12 guards, probados rompiéndolos: cada rotura tumba SU test (11/1 las catorce veces)',
      'docs/hallazgos-conocimiento.md — el enlace invisible, los tres lectores de la etiqueta y los dos guards que daban verde',
      'ABIERTO: branding sigue nombrándose por la etiqueta guardada — su recurso_id es `grupo || sec` (dos namespaces en un campo) y el mapa id→rótulo vive en BrandingMaKo.tsx, que importa Compartir: importarlo de vuelta es un ciclo. Y su share vivo id=6 apunta a una sección con alcance de grupo, o sea un link que abre en 404',
    ],
  },
];
