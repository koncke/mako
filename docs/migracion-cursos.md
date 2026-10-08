# Migrar cursos desde otras plataformas: qué se puede, cómo y por dónde empezar

Item 20 del audio del 08/10/2026 (`docs/feedback-curso-08oct.md`). Investigación sin código.

El pedido, de Martín (04:40): «Todos los servicios de SaaS… tengan una opción de migración
automática o de migración en lote, de otras plataformas que sean muy conocidas… averiguar cuáles
son esas plataformas… si tienen API… Skool no tiene API… se podría a través de la extensión de
MaKo… que ya descarga videos». Y del que probaba el curso: «yo tengo todo en Panda… si yo tengo que
pasar cada uno de estos vídeos de Panda me va a tardar como una hora y media… acá manual me pegó un
tiro». Antes, en el 02:20, el caso que lo dispara: a Juan Francisco le propusieron llevar su Skool
a MaKo y contestó que «tiene cientos de clases» y que pasarlo a mano no lo va a hacer nunca.

Cada afirmación sobre una plataforma lleva su fuente entre corchetes; la lista está al final, con
la URL y la fecha de lectura. **Todas las fuentes se leyeron el 08/10/2026.** Donde la fuente
oficial no respondió y se usó una secundaria, se dice.

---

## Resumen para Martín (una pantalla)

**Lo que hay:**

- **Las plataformas con API buena para migrar son pocas: Teachable, Whop, Memberkit, Circle,
  GoHighLevel y Mighty Networks** dejan leer la estructura, el texto de la clase y (casi todas)
  los adjuntos y el video. Kajabi, Kiwify, Eduzz, Systeme.io, ClickFunnels y Thinkific sólo dejan
  leer la estructura (nombres de módulos y clases), no el contenido. Podia y Skool no tienen API.
- **Hotmart, la más usada en LatAm, deja leer módulos, nombres de clase, alumnos y avance, pero
  no el texto ni el video.** El contenido sólo sale desde la sesión del área de miembros: ya lo
  hicimos así en agosto con scripts propios (sin DRM).
- **Panda Video es lo más barato de todo: MaKo ya tiene la key de Panda del cliente** (la
  integración del VSL) y la API lista carpetas y videos con su reproductor. Carpeta = módulo,
  video = clase. Ojo: si el cliente tiene «Dominios permitidos» prendido en Panda, el video no
  se reproduce en MaKo hasta que agregue el dominio.
- **Skool no tiene API ni exportación**: su «course key» sólo copia de un grupo de Skool a otro,
  y sus términos prohíben extraer contenido con «extraction software» o procesos automáticos. Con
  la extensión es técnicamente posible (lo hacen herramientas de terceros y GoHighLevel hace lo
  mismo con Kajabi), pero el riesgo cae sobre la cuenta de Skool del cliente y sobre la
  extensión de MaKo en la tienda de Chrome, que es la misma que mueve el Video Generator.
- **El problema de fondo no es leer: es dónde quedan los videos.** Copiarlos a MaKo choca con el
  tope de Storage (el código dice 5 GiB para toda la plataforma) y cobra egress por alumno. Lo
  sano es EMBEBER desde donde ya están; el caso difícil es el video nativo de Skool, que no se
  puede embeber afuera y hay que mudarlo a un host del cliente.

**Lo que recomiendo, en orden:**

1. **El camino genérico primero**: las acciones de curso en la API de MaKo (las está haciendo el
   chat de la API) + una receta para que el Claude del cliente lea su plataforma y escriba en
   MaKo. Cubre a todas las que tienen API sin escribir un importador por plataforma.
2. **Un botón «Traer de Panda»**, porque la key ya está y el que probaba lo pidió con nombre.
3. **Skool y Hotmart como migración ASISTIDA** (la hace el equipo desde el Chrome del dueño, con
   los scripts que ya existen), para Juan Francisco primero. Recién con demanda medida, una
   función de producto.

**Lo que tienes que decidir:**

- **A. Videos**: ¿se embeben desde donde están (recomendado) o se copian a MaKo? Y para el video
  nativo de Skool, ¿a qué host van (Vimeo, Bunny o Panda del cliente)?
- **B. Skool**: ¿migración asistida por el equipo, o función de la extensión? Y si es de la
  extensión, ¿la misma «MaKo» o una aparte, para no arriesgar el Video Generator?
- **C. Alumnos**: ¿se importan? Si se importan, ¿entran callados o se les manda la invitación?
  (Importar 500 alumnos con la invitación automática prendida son 500 mails.)
- **D. Avance**: ¿se trae lo que cada alumno ya completó, o arrancan de cero en MaKo?
- **E. ¿La migración asistida se cobra** como servicio aparte (LearnWorlds ofrece «migration
  services» [L1]) o va incluida?

---

## 1. Lo que MaKo ya tiene, y que condiciona todo

- **El molde de destino.** Un curso es un producto con módulos (etapas del kanban o sueltos) y
  clases. Una clase tiene título, video (un link de YouTube, Vimeo, Loom, Drive, una URL, o un
  archivo subido al bucket `curso-videos`), descripción con formato (`descripcionHtml`, con los
  adjuntos por referencia `mako-adjunto:<id>`) y tareas con campos (`lib/curso.ts`, tipos
  `VideoTipo` y `Clase`). Un alumno es un cliente del CRM con un acceso (`curso_accesos`). Todo
  lo que se importe tiene que caer en eso.
- **Panda ya está conectado.** La credencial `PANDA_API_KEY` vive en Integraciones
  (`lib/metodo-catalogo.ts`), `catalogoPanda()` (`lib/panda.ts:273`) ya lista los videos con su
  `video_player`, y la API de MaKo ya expone `listar_videos_panda`
  (`GET /api/v1/landing/panda/videos`, `docs/api-mako.md`).
  ⚠️ `catalogoPanda()` corta en 20 páginas de 100 videos SIN decirlo (`pages++ < 20`): un
  importador no puede reusarla tal cual, o una cuenta con más de 2.000 videos se importa a medias
  en silencio.
- **Storage no es un lugar para una videoteca.** Los comentarios de `lib/curso-admin.ts:314`
  hablan de «5 GiB de tope para TODA la plataforma»; `docs/hallazgos-customer-success.md`
  (07/10/2026) mide que Supabase Pro trae 100 GB y 250 GB de egress, que una clase pesa ~26 MB por
  minuto, y que no hay streaming adaptativo (cada alumno baja el archivo entero). Cuál es el tope
  real no está medido. Con cualquiera de los dos números, un Skool de «cientos de clases» no
  entra, y la videoteca propia de MaKo son 780 GB (memoria `cursos-drive-vs-panda`).
- **Ya se migraron cursos de otras plataformas, a mano y con scripts.** `scripts/hotmart-plan.mjs`
  y `hotmart-bajar.mjs` (Hotmart Club), `scripts/avatarhype-plan.mjs` (Bunny Stream) y el pipeline
  `scripts/curso-*.mjs` (bajar, transcribir, Drive, ficha) leen desde una pestaña de Chrome con
  sesión, por CDP. Lo medido está en `docs/hallazgos-conocimiento.md`: Hotmart y AvatarHype **sin
  DRM**, con el `Referer` como única puerta, y «el plan guarda el id, nunca la URL firmada».
- **La regla que ya está escrita para esto** (`docs/hallazgos-conocimiento.md`, «La FUENTE del
  material entra en el criterio»): antes de armar un extractor, la pregunta es «¿de quién es
  esto?», y si el player pide DRM (EME, `.mpd`, license server) se frena y se avisa. Migrar el
  curso PROPIO del cliente desde SU cuenta pasa la primera pregunta; la segunda se mide por
  plataforma.
- **La extensión de MaKo hoy** (`extension/manifest.json`, v0.68.0): permisos `storage`,
  `alarms`, `webRequest`, `scripting`, y hosts sólo de `hola-mako.com`, `labs.google`,
  `flow.google.com` y `aisandbox-pa.googleapis.com`. Funciona como una cola: el service worker le
  pide trabajos a MaKo, los ejecuta con la sesión de Google del cliente (un script en el mundo de
  la página de Flow) y devuelve el resultado. **No descarga archivos**: para un video provoca la
  carga con un `<video>`, lee con `webRequest` a qué URL firmada redirigió, y le manda esa URL a
  MaKo, que baja el archivo desde el servidor (`extension/background.js:975-1009`). O sea que «ya
  descarga videos» es cierto a medias: sabe conseguir un enlace firmado, no bajar gigas.

---

## 2. Plataformas de cursos

**Leyenda:** E = estructura (módulos/clases), T = texto de la clase, V = video, A = adjuntos,
U = alumnos, P = avance. ✓ sí · ~ parcial · ✗ no · ? no verificado.

| Plataforma | API pública | E | T | V | A | U | P | Auth · plan · límites | Fuentes |
|---|---|---|---|---|---|---|---|---|---|
| **Skool** | ✗ (sólo Zapier) | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | Zapier sólo en Pro (US$99/mes): 2 disparadores (nuevo miembro pago, respuestas de ingreso) y 2 acciones (invitar, abrir un curso a un miembro) | [S1][S4][S5] |
| **Hotmart (Club)** | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | OAuth client credentials; 500 req/min (secundaria) | [H1][H2][H3] |
| **Kiwify** | ✓ (ventas) | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | OAuth con `client_secret` (Apps › API), token de 96 h, 100 req/min | [K1][K2] |
| **Eduzz** | ✓ (sin contenido) | ✗ | ✗ | ✗ | ✗ | ~ | ~ | OAuth; el área de miembros (Nutror) sólo por webhooks | [E1][E2] |
| **Kajabi** | ✓ | ~ | ✗ | ✗ | ✗ | ✓ | ✗ | Bearer (client credentials); Pro actual, o add-on de US$25/mes en Pro viejo; sólo Owner/Subowner crea keys | [KJ1][KJ2] |
| **Teachable** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Header `apiKey`; plan Growth o superior; 100 req/min por escuela | [T1][T2][T3][T4] |
| **Thinkific** | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | API key u OAuth; Grow o superior, 120 req/min y 10 en vuelo (secundarias) | [TH1][TH2][TH3] |
| **Circle** | ✓ | ✓ | ✓ | ~ | ? | ✓ | ~ | Token en Developers › Tokens; Business: 5.000 req/mes; 2.000 req cada 5 min por IP | [C1][C2][C3] |
| **Mighty Networks** | ✓ | ✓ | ✓ | ✗ | ? | ✓ | ~ | Bearer; Business o superior; Scale: 5.000 req/mes + US$0,002 c/u | [M1][M2][M3] |
| **Podia** | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | Sin API ni webhooks; Zapier y exportar contactos en CSV | [P1][P2] |
| **LearnWorlds** | ✓ | ✓ | ? | ? | ? | ✓ | ✓ | OAuth2 client credentials + header `Lw-Client`; Learning Center o superior (secundaria) | [L1][L2] |
| **Systeme.io** | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | Header `X-API-Key`; límite con cabeceras, número no publicado | [SY1][SY2] |
| **Whop** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Account API key; 600 req/min por operación y credencial | [W1][W2] |
| **GoHighLevel** | ✓ | ✓ | ✓ | ~ | ? | ✓ | ✓ | OAuth o Private Integration Token, scope `courses.readonly` | [G1][G2][G3] |
| **ClickFunnels 2.0** | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | Límite «dinámico y generoso», sin número | [CF1][CF2][CF3] |
| **Memberkit** | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | ~ | `api_key` en la URL; 120 req/min | [MK1][MK2] |

### Notas por plataforma (lo que la tabla no dice)

- **Skool.** Sin API oficial: lo dice una implementación no oficial (que la sigue por ingeniería
  inversa contra `api2.skool.com`, con la cookie de la sesión) [S9], y lo confirma que la única
  integración oficial sea Zapier, con dos disparadores y dos acciones, ninguna de contenido [S1].
  Ver la sección 4.
- **Hotmart.** La API del Club lista módulos (`name`, `sequence`, `is_extra`…), páginas
  (`name`, `type`, `has_media`, `published`), alumnos (`email`, `progress_completed_percentage`,
  fechas de acceso) y el avance clase por clase (`is_completed`, `completed_date`) [H1]. **No trae
  el contenido de la página ni el video.** La documentación oficial (`developers.hotmart.com`)
  contestó 403 de CloudFront a todos los pedidos de esta investigación [H3]; los campos salen de
  dos fuentes secundarias que coinciden [H1][H2]. El contenido sí sale desde la sesión del área de
  miembros, y está medido en casa: `/v1/navigation` → `/v1/lesson/<hash>` → `mediasSrc` (un embed
  firmado con un JWT que dice `playDrm:false`), y el `.m3u8` pide `Referer` de hotmart.com
  (`scripts/hotmart-plan.mjs`, cabecera). yt-dlp no tiene extractor de Hotmart.
- **Kiwify.** ⚠️ La documentación tiene objetos `all_courses`, `module`, `lesson` y
  `lesson_user_data` que parecen una API y **no lo son**: son variables Liquid para armar el TEMA
  del área de miembros [K2]. La API REST real (`public-api.kiwify.com`) es de productos, ventas,
  saques, afiliados y webhooks [K1]. Y aun dentro del tema, una `lesson` tiene id, nombre,
  miniaturas y avance, sin video ni texto [K2].
- **Eduzz.** El portal de desarrolladores documenta webhooks del área de miembros (Nutror) con
  eventos de avance, no endpoints de contenido [E1]; la API v2 de Alpaclass gestiona escuelas y
  alumnos [E2].
- **Kajabi.** La API (`api.kajabi.com/v1`, especificación descargada) tiene `/v1/courses` con
  título, descripción, miniatura y estado, más contactos, ofertas, compras y formularios — **no
  hay módulos, lecciones ni avance** [KJ1]. El video se baja a mano, de a una lección, desde
  «Video Actions › Download Video» [KJ3]; la única exportación es la «Course Template» [KJ4].
  Precedente útil: GoHighLevel importa cursos de Kajabi **entrando con el email y la contraseña
  de una cuenta de ALUMNO y raspando** — trae videos, imágenes y texto de las lecciones
  publicadas; no trae tareas, quizzes, alumnos ni avance [G3].
- **Teachable.** La mejor API de la lista para migrar. Curso → secciones → lecciones →
  adjuntos con `kind` (texto, video, pdf, imagen, quiz…), `text` para los de texto y `url` para
  los archivos; el video da un `.m3u8` firmado **servido por el CDN de Hotmart**
  (`vod-akm.play.hotmart.com`) que pide `Referer` [T1][T2] — el mismo patrón que ya bajan los
  scripts de casa. Inscripciones con avance y avance por curso [T1]. ⚠️ La página de límites dice
  100 req/min, y el ejemplo de la misma página muestra `RateLimit-Limit: 360` [T4]: medir antes
  de fijar un ritmo.
- **Thinkific.** `Contents` devuelve metadatos (`chapter_id`, `contentable_type`, `free`, `name`,
  `position`), no el cuerpo de la lección [TH2]. Las páginas oficiales de soporte para
  desarrolladores contestaron con el desafío de Cloudflare; plan y límites salen de resúmenes de
  búsqueda [TH3]. Si su GraphQL expone el contenido: no verificado.
- **Circle.** Especificación v2 descargada: `course_sections`, `course_lessons` con `body_html`
  y `featured_media` (un objeto sin esquema documentado) y `is_featured_media_download_enabled`
  [C3]. El avance sólo se ESCRIBE (`PUT /course_lesson_progress`); no se encontró cómo leerlo
  [C3]. La cuota es por MES (5.000 en Business) [C2]: un curso grande la come.
- **Mighty Networks.** `courseworks` (lecciones, quizzes, secciones) con `title`, `description`
  (el cuerpo), `completion_criteria` y `unlocking_criteria`; **sin campo de video** en el esquema
  [M3]. El avance llega por webhooks (`course.progress_updated`, `course.completed`) [M2].
- **Systeme.io.** Lee cursos, módulos y `modules-with-lectures`; una clase trae nombre, posición,
  si está activa y el goteo en días — **sin cuerpo ni video** [SY2].
- **Whop.** Lección con `content` en Markdown, `attachments` y `main_pdf` con `url`, embed de
  YouTube o Loom (`embed_type`, `embed_id`), y el video propio en **Mux** (`playback_id`,
  `signed_playback_id`) [W1]. Alumnos (`course-students`) y avance
  (`course-lesson-interactions`) [W2].
- **GoHighLevel.** ⚠️ **El diagnóstico obvio está viejo**: la primera fuente que aparece dice que
  su API de cursos «sólo importa». El pedido de CRUD completo figura «complete» desde el
  30/09/2026 [G4] y la v3 tiene 42 endpoints de cursos: categorías, lecciones (`contentType`
  video/audio/quiz, `contentId`, `description`), inscripciones, avance por producto y por
  categoría, y lecciones completadas [G1][G2]. La URL del video no aparece en el esquema de la
  lección (sólo `contentId`) [G2].
- **ClickFunnels 2.0.** Cursos, secciones, lecciones, inscripciones y lecciones completadas [CF1].
  El cuerpo de la lección se ESCRIBE en Markdown al crearla, pero el esquema de «Fetch Lesson» no
  lo devuelve (medido sobre la ficha de la referencia) [CF3].
- **Memberkit.** Una lección trae `content`, `video` (`uid`, `source`, `duration`, `image`) y
  `files` (`url`, `byte_size`, `content_type`); además miembros, actividades y quizzes [MK1][MK2].
  `source` sugiere que el video vive en un host externo; cuál, no verificado.

---

## 3. Plataformas de video

| Host | API | Listar lo del cliente | Bajar el original | Embeber en MaKo | Fuentes |
|---|---|---|---|---|---|
| **Panda Video** | ✓ (key en `Authorization`, sin «Bearer») | carpetas y videos (`folder_id`), con `video_player`, `video_hls`, miniatura y duración | ✓ endpoint de descarga (sincrónico y asincrónico); **consume ancho de banda** igual que una reproducción | ✓ — salvo que «Dominios permitidos» esté prendido: ahí el video **no se reproduce** en un dominio fuera de la lista (va por `Referer`) | [PV1][PV2][PV3][PV4] |
| **Vimeo** | ✓ | ✓ | ✓ con los scopes `public private video_files`; los links de descarga vencen a las 24 h; plan Standard o superior según la página (no medido con una cuenta) | ✓ (el plan gratis no deja embeber, `docs/hallazgos-customer-success.md`) | [V1] |
| **YouTube** | ✓ Data API v3 | ✓ (10.000 unidades/día; un listado cuesta 1) | ✗ — sus políticas prohíben «download, import, backup, cache, or store copies» sin permiso escrito (III.E.1.a) | ⚠️ técnicamente sí; pero las políticas prohíben **cobrar por ver en un reproductor embebido** (III.F.3, actualizadas el 14/09/2026) | [Y1][Y2] |
| **Wistia** | ✓ | ✓ medias y proyectos | ✓ el asset `OriginalFile` trae su `url` | ✓ (HLS en `fast.wistia.com`) | [WI1][WI2] |
| **Bunny Stream** | ✓ | ✓ librerías y colecciones | sólo si la librería tiene «Keep original files»; el MP4 de respaldo sólo existe para lo subido después de prenderlo | ✓ `player.mediadelivery.net/embed/{librería}/{video}` | [B1][B2] |
| **Vturb** | ~ (analítica) | players, sesiones, eventos (120 req/min en Pro, fuente secundaria) | ? | ? — es un reproductor de VSL, no un host de cursos | [VT1] |
| **Mux** (lo usan Skool y Whop) | — | — | — | sólo si el `playback_id` es público; los de Whop vienen también firmados | [S8][W1] |

**Para Panda, lo que importa al importar** (y al VIDEO de esta tanda): el link «compartir» de
Panda no es el del reproductor; el que sirve es `video_player` [PV3]. Y si el cliente tiene
«Dominios permitidos» prendido, el video queda negro en MaKo aunque el link esté bien [PV4]. Que
«el de Panda no me lo toma» (22:40) sea por una de esas dos cosas es una **hipótesis, no medida**.

---

## 4. Skool en detalle

### Exportación oficial: no hay

- La «course key» copia un curso **sólo a otro grupo de Skool**: la comparte el dueño, la importa
  un dueño o admin de otro grupo [S3].
- Zapier (sólo plan Pro) no toca el contenido: dos disparadores y dos acciones de miembros [S1].
- El botón «Export» de la pestaña de miembros exporta las RESPUESTAS a las preguntas de ingreso
  [S7]. Que también traiga emails u otros datos: no verificado.
- El classroom tiene páginas con video, links, archivos subidos (PDF, planillas) y
  transcripciones [S6]. El video puede ser nativo o de YouTube, Vimeo, Loom y Wistia [S2]; el
  nativo corre sobre Mux, es gratis en los dos planes y, según Mux, ya es «la forma predominante
  de video» en Skool [S8]. **O sea que en la mayoría de los cursos el video es nativo**, que es el
  único caso que no se puede resolver con un link.

### Lo que dicen sus términos

- «You will not … access the Services manually or with any robot, spider, web crawler,
  extraction software, automated process and/or device to scrape, copy or monitor any portion of
  the Services or any content on the Services» [S4].
- «copy or distribute any content displayed through the Services» y armar compilaciones del
  contenido salvo para uso personal no comercial, también prohibido [S4].
- El creador conserva la propiedad de lo que sube; Skool tiene una licencia para operar el
  servicio [S4]. **El contenido es del cliente; el método de sacarlo es lo que el contrato
  prohíbe.**

### Factibilidad con la extensión de MaKo

Lo técnico, desde la sesión del dueño del grupo:

1. **La estructura y el texto: factible.** Una implementación no oficial ya lee el árbol del
   classroom (cursos, carpetas, páginas), el cuerpo de cada página, el id del video y los
   recursos, con la cookie de la sesión contra `api2.skool.com` [S9]. Desde la extensión sería un
   script en la pestaña de Skool que lee eso y se lo manda a MaKo, igual que hoy con Flow. No
   medido por nosotros.
2. **Los videos de YouTube, Vimeo, Loom y Wistia: factibles sin bajar nada**, se pasan como link.
3. **El video nativo (Mux): el caso caro.** Si el `playback_id` fuera público, MaKo podría bajar
   el HLS desde el servidor, como hace con el enlace firmado de Flow; si está firmado o atado a la
   sesión, lo tiene que bajar la extensión, y un service worker de Manifest V3 no está hecho para
   mover gigas. Cuál de los dos es Skool: **no medido**. Y bajado, igual hay que subirlo a un host
   del cliente (decisión A).
4. **Permisos.** Hoy la extensión no tiene permiso sobre `skool.com`. Agregarlo como permiso fijo
   **deshabilita la extensión a TODOS los clientes hasta que acepten el permiso nuevo** [CH1], o
   sea que apagaría el Video Generator de todos por una función que usan pocos. Va como permiso
   opcional pedido en el momento [CH1].

Los riesgos, y sobre quién caen:

- **La cuenta de Skool del cliente.** Si Skool lo detecta y lo sanciona, pierde su comunidad, que
  es su negocio. Es el riesgo más caro y no es de MaKo: es de él. Mitigación: sólo grupos donde
  la sesión sea dueña o admin, sólo lectura, una sola vez, a ritmo de persona (como el puente a
  Flow: sin telemetría inventada, sin disimular nada).
- **La extensión en la Chrome Web Store.** Sus políticas prohíben «facilitate unauthorized access
  to content on websites, such as circumventing paywalls or login restrictions» y «encourage,
  facilitate, or enable the unauthorized access, download, or streaming of copyrighted content
  or media» [CH2]. Bajar el curso PROPIO con el permiso del dueño no es «unauthorized», pero un
  revisor ve una extensión que baja videos de detrás de un login. Según la memoria
  `puente-flow-extension` (30/08, no re-medido), la tienda tiene una versión vieja aprobada y a
  los clientes se les sirve el ZIP, así que el riesgo inmediato es bajo; el día que se suba a
  revisión una versión con esto, no.
- **El Video Generator.** Es la misma extensión. Si la tienda la baja por la función de Skool, se
  cae también el puente a Flow. Por eso la decisión B pregunta si va aparte.
- **El precedente de la industria** existe: GoHighLevel raspa Kajabi con credenciales de un
  alumno [G3], y hay extensiones de terceros que bajan videos de Skool [S10]. Que lo hagan otros
  no cambia los términos de Skool.

**Mi recomendación para Skool:** migración ASISTIDA primero. La hace el equipo con el Chrome del
dueño y su permiso escrito, con el pipeline de `scripts/` que ya existe (como Hotmart en agosto),
para Juan Francisco. Eso mide lo que falta medir (si el video nativo es descargable, cuánto pesa
un curso real, cuánto tarda) sin poner en riesgo la extensión. Si después hay demanda, se decide
la función de producto con números.

---

## 5. Qué importar primero

Sin datos de cuántos clientes de MaKo usan cada plataforma: el orden de abajo combina lo que se
sabe de los clientes (el que probaba tiene todo en Panda; Juan Francisco, Skool; los clientes
conocidos están en México y Argentina y el producto habla español) con el peso de cada
plataforma en el mercado. De Hotmart, por ejemplo, más de la mitad de las transacciones ya
cruzan fronteras dentro de Latinoamérica [MX1]. **Es una estimación**: lo que la confirmaría es
preguntarlo (ver «Lo que no se pudo verificar»).

| # | Qué | Latino | Anglo | Costo | Por qué en ese lugar |
|---|---|---|---|---|---|
| 1 | **Camino genérico: API de MaKo + Claude del cliente** | alto | alto | bajo: las acciones de curso ya están en camino; falta la receta y la idempotencia | cubre TODA plataforma con API (Teachable, Whop, Memberkit, Circle, GHL, Mighty, LearnWorlds) y los hosts de video, sin un importador por plataforma |
| 2 | **Botón «Traer de Panda»** | alto | bajo | muy bajo: la key ya está, falta leer carpetas | lo pidió el que probaba; Panda es el host de los infoproductores de la región |
| 3 | **Hotmart, asistido** | muy alto | bajo | medio: estructura, alumnos y avance por API; contenido por la sesión (scripts existentes) | la plataforma más usada de la región; el contenido no sale por API |
| 4 | **Skool, asistido** | medio | alto | medio-alto: video nativo a mudar | el caso de Juan Francisco; sin API; riesgo de términos |
| 5 | Vimeo, YouTube, Wistia, Bunny como «biblioteca → curso» | medio | medio | bajo | mismo molde que Panda; YouTube con la advertencia de cursos pagos |
| 6 | Botones dedicados para Teachable, Whop, Memberkit, GHL | bajo-medio | medio | medio c/u | ya los cubre el camino 1; sólo si la demanda lo pide |
| 7 | Kajabi, Kiwify, Eduzz, Systeme.io, ClickFunnels, Thinkific, Podia | medio (Kiwify, Eduzz) | medio (Kajabi) | alto | la API no da el contenido: sólo raspando o a mano |

---

## 6. El camino genérico: la API de MaKo y el Claude del cliente

La idea del audio (07:00): «le pasas la API como variable en torno a Claude y te lo haces», y
para el que no es técnico, «un pequeño tutorial de copia tu token de API, pásalo a Claude y dile
que te haga tal». El Claude del cliente lee la API de origen (con la key que el cliente saca de
SU plataforma) y escribe en MaKo con un token detallado. MaKo no guarda la key de origen ni paga
la IA: corre en la cuenta del cliente (regla «el Plan nunca paga IA»).

Lo que eso le pide a la API de MaKo (para el chat de la API, que es quien lo enchufa):

1. **Crear módulo y crear clase** (título, orden, descripción con formato, video por link) y
   **agregar un adjunto a una clase**. Con un token con escritura en el área, escribe directo
   (decisión del 08/10: «como GitHub»).
2. **Idempotencia por origen.** Cada módulo y clase importados llevan `origen` (plataforma + id
   de origen) y una segunda corrida con el mismo origen ACTUALIZA, no duplica. Un Claude que se
   corta a la mitad y se relanza es el caso normal, no el raro. Es la regla de la casa: «una clave
   de idempotencia sale de la firma de lo que se manda».
3. **Un modo «plan»** que devuelva lo que se va a crear sin crearlo, para que la persona vea
   «12 módulos, 140 clases, 3 sin video» antes de confirmar.
4. **El video se valida con el mismo `embedDe` del editor** (`lib/embeds.ts`, pista VIDEO): un
   link que el editor no aceptaría tampoco entra por la API. Lo que no pasa se informa por clase
   («sin video: el link de origen no es de un host admitido»), nunca se descarta en silencio.
5. **Los adjuntos por URL los baja el SERVIDOR**, con tope de tamaño y sólo de hosts conocidos:
   una acción que baja cualquier URL que le pase un token es una puerta a pedidos internos.
6. **Importar alumnos NO invita por default.** Crear un cliente ganado hoy puede disparar la
   invitación automática del CRM; la acción de importar tiene que poder apagarla explícitamente
   (decisión C). Toca al CRM: es del chat del CRM.
7. **Un ritmo.** Un curso de 300 clases son 300+ llamadas; la API tiene que aguantarlo o decir su
   límite en la respuesta.

Y del lado del cliente, una receta por plataforma (Teachable, Whop, Memberkit, Circle, Panda,
Vimeo): qué key sacar y dónde, qué endpoints leer, cómo mapear (sección → módulo, lección →
clase, adjunto → adjunto, video → link). Va en la guía de la tab `/api-mako` y en la skill de
Claude del cliente, no en un `.md` suelto.

---

## 7. Alumnos y avance

| Plataforma | Alumnos | Avance |
|---|---|---|
| Teachable | inscripciones | por curso y por alumno |
| Hotmart | alumnos del Club | clase por clase |
| Whop | `course-students` | `course-lesson-interactions` |
| GoHighLevel | inscripciones | por producto, por categoría y lecciones completadas |
| Memberkit | miembros y actividades | actividades (no verificado qué incluye) |
| Thinkific | inscripciones | `percentage_completed` |
| LearnWorlds | usuarios | por curso |
| Circle, Mighty | miembros | Circle sólo escribe; Mighty por webhooks |
| Kajabi, Kiwify, Eduzz, Systeme.io, ClickFunnels | contactos o inscripciones | no |
| Skool, Podia | no (Podia: contactos en CSV) | no |

En MaKo un alumno es un cliente del CRM con acceso, y «completó» una clase es «envió su tarea, la
marcó como hecha o vio el 90%» (`docs/diseno-curso-skool.md`, D2). Un avance importado no es
ninguna de las tres: hace falta un concepto nuevo (por ejemplo, un desbloqueo manual por clase,
que ya existe en `curso_desbloqueos`). Por eso la decisión D.

---

## 8. Lo que no se pudo verificar

- **Cuántos clientes de MaKo usan cada plataforma.** Nadie lo midió. Dos formas baratas: contar en
  `credenciales` los workspaces con la clave `PANDA_API_KEY`, y sumar la pregunta «¿dónde tienes
  hoy tu curso?» al onboarding del curso.
- **La documentación oficial de Hotmart** contestó 403 (CloudFront) a todos los pedidos; el 500
  req/min y los campos del Club salen de fuentes secundarias [H1][H2].
- **Thinkific**: las páginas de soporte para desarrolladores no abrieron (Cloudflare); plan y
  límites son de resúmenes de búsqueda [TH3]. Su GraphQL, sin mirar.
- **LearnWorlds**: si `GET /courses/{id}/contents` trae el cuerpo y el video de cada unidad, sin
  mirar; el plan sale de una fuente secundaria.
- **Skool**: si el video nativo usa un `playback_id` público o firmado; si los recursos se bajan
  sin sesión; si el «Export» de miembros trae emails; si el admin tiene un botón de descarga.
- **Vimeo**: qué plan exacto da los links de descarga (la página lo dice al lado de otra función).
- **Vturb**: si tiene API de videos o sólo de analítica (la fuente es un servidor MCP de un
  tercero); cómo se embebe.
- **Memberkit**: qué host de video está detrás de `source`.
- **GoHighLevel**: dónde está la URL del video de una lección (el esquema sólo trae `contentId`).
- **El tope real del Storage de MaKo** (5 GiB en el código contra 100 GB del plan Pro).
- Ninguna API se probó con credenciales reales: todo lo de arriba es lectura de documentación.

---

## Fuentes (todas leídas el 08/10/2026)

- [S1] Zapier, «How to get started with Skool on Zapier» — https://help.zapier.com/hc/en-us/articles/10458381459341-How-to-get-started-with-Skool-on-Zapier
- [S2] Skool, «How to add videos» — https://help.skool.com/article/58-video
- [S3] Skool, «How to duplicate a course?» — https://help.skool.com/article/199-how-to-duplicate-a-course-to-another-group
- [S4] Skool, Terms & Conditions — https://www.skool.com/legal?t=terms
- [S5] Skool, precios — https://www.skool.com/pricing
- [S6] Skool, «What is Classroom?» — https://help.skool.com/article/166-what-is-classroom
- [S7] Skool, respuestas a las preguntas de ingreso — https://help.skool.com/article/148-where-can-i-find-members-answers-to-membership-questions
- [S8] Mux, caso Skool — https://mux.com/case-studies/skool
- [S9] API no oficial de Skool (secundaria) — https://skool-api.cristiantala.com/ y https://skool-api.cristiantala.com/docs/classroom/
- [S10] Extensión de terceros para bajar videos de Skool (secundaria) — https://github.com/serpapps/skool-downloader
- [H1] Kondado, conector de Hotmart (campos del Club) — https://kondado.io/wiki/en/a/hotmart
- [H2] APIs.io, Hotmart (auth y límite) — https://apis.io/providers/hotmart/
- [H3] Hotmart Developers (contestó 403) — https://developers.hotmart.com/docs/en/v1/club/modules/
- [K1] Kiwify, información general de la API — https://docs.kiwify.com.br/api-reference/general.md y el índice https://docs.kiwify.com.br/llms.txt
- [K2] Kiwify, objeto `lesson` del tema — https://docs.kiwify.com.br/members-area/reference/objects/lesson.md
- [E1] Eduzz Developers — https://developers.eduzz.com/
- [E2] Jentic, API pública de Eduzz v2 (secundaria) — https://jentic.com/apis/eduzz.com/eduzz.md
- [KJ1] Kajabi, especificación OpenAPI — https://developers.kajabi.com/openapi.yaml
- [KJ2] Kajabi, «Using Kajabi's Public API» — https://help.kajabi.com/en/articles/12696419-using-kajabi-s-public-api
- [KJ3] Kajabi, «Download videos from Courses or Pages» — https://help.kajabi.com/en/articles/12695185-download-videos-from-courses-or-pages
- [KJ4] Kajabi, «Can I export a digital Course…?» — https://help.kajabi.com/articles/products/courses/can-i-export-my-digital-course-including-the-product-details-in-xlsx-or-json-for-analysis
- [T1] Teachable, índice de la API — https://docs.teachable.com/llms.txt
- [T2] Teachable, «Access a video asset url» — https://docs.teachable.com/recipes/access-a-video-asset-url.md
- [T3] Teachable, Quickstart (plan Growth) — https://docs.teachable.com/docs/quickstart-guide.md
- [T4] Teachable, Rate Limits — https://docs.teachable.com/docs/rate-limits.md
- [TH1] Thinkific, Admin API — https://developers.thinkific.com/api/api-documentation/
- [TH2] APIs.io, Thinkific Contents (secundaria) — https://apis.io/apis/thinkific/thinkific-contents-api/
- [TH3] Thinkific, REST API Rate Limits (no abrió; dato de búsqueda) — https://support.thinkific.dev/hc/en-us/articles/4422684774935-REST-API-Rate-Limits
- [C1] Circle, Admin API — https://api.circle.so/apis/admin-api.md
- [C2] Circle, Usage and limits — https://api.circle.so/apis/admin-api/usage-and-limits.md
- [C3] Circle, especificación Admin API v2 — https://api-headless.circle.so/api/admin/v2/swagger.yaml
- [M1] Mighty Networks, Admin API — https://docs.mightynetworks.com/admin-api.md
- [M2] Mighty Networks, changelog — https://docs.mightynetworks.com/admin-api-changelog.md
- [M3] Mighty Networks, coursework — https://docs.mightynetworks.com/api-reference/courseworks/returns-a-single-coursework-item-by-id.md
- [P1] Podia, «Does Podia have a public API or webhooks?» — https://help.podia.com/en/articles/11371075-does-podia-have-a-public-api-or-webhooks
- [P2] Podia, «Exporting your contacts» — https://help.podia.com/en/articles/11370285-exporting-your-audience-customer-list
- [L1] LearnWorlds, «How to Request your API Keys» (y el menú «Migrate to LearnWorlds») — https://support.learnworlds.com/support/solutions/articles/12000080177-how-to-request-your-api-keys-and-access-tokens
- [L2] APIs.io, LearnWorlds Courses (secundaria) — https://apis.io/apis/learnworlds/learnworlds-courses-api/
- [SY1] Systeme.io, índice de la API — https://developer.systeme.io/llms.txt
- [SY2] Systeme.io, «Retrieves a Lecture resource» — https://developer.systeme.io/reference/api_schoollectures_lectureid_get.md
- [W1] Whop, «Retrieve course lesson» — https://docs.whop.com/api-reference/course-lessons/retrieve-course-lesson.md
- [W2] Whop, referencia completa (endpoints de cursos y límites) — https://docs.whop.com/llms-full.txt
- [G1] HighLevel, índice v3 (cursos) — https://marketplace.gohighlevel.com/docs/llms/v3/llms.txt
- [G2] HighLevel, «Get Lesson» — https://marketplace.gohighlevel.com/docs/ghl/courses/get-lesson.md
- [G3] HighLevel, «Kajabi Importer» — https://help.gohighlevel.com/support/solutions/articles/155000001725
- [G4] HighLevel Ideas, «Full Public API Support for Courses» — https://ideas.gohighlevel.com/memberships/p/full-public-api-support-for-courses-memberships-products
- [CF1] ClickFunnels, índice de la API — https://developers.myclickfunnels.com/llms.txt
- [CF2] ClickFunnels, Rate Limiting — https://developers.myclickfunnels.com/docs/rate-limiting.md
- [CF3] ClickFunnels, «Fetch Lesson» — https://developers.myclickfunnels.com/reference/getcourseslessons.md
- [MK1] Memberkit, introducción a la API — https://ajuda.memberkit.com.br/referencia-api/introducao.md
- [MK2] Memberkit, «Retorna uma aula» — https://ajuda.memberkit.com.br/referencia-api/get-lesson.md
- [PV1] Panda Video, índice de la API — https://docs.pandavideo.com/llms.txt
- [PV2] Panda Video, «Download video» — https://docs.pandavideo.com/reference/download-video.md
- [PV3] Panda Video, «Get video properties» — https://docs.pandavideo.com/reference/get-video-properties.md
- [PV4] Panda Video, verificación de dominio — https://help.pandavideo.com/en-us/article/1h1lwrl/
- [V1] Vimeo, «About video file download links from the API» — https://help.vimeo.com/hc/en-us/articles/12427806914577-About-video-file-download-links-from-the-API
- [Y1] YouTube Data API, cuota — https://developers.google.com/youtube/v3/getting-started
- [Y2] YouTube API Services, Developer Policies (III.E.1.a y III.F.3) — https://developers.google.com/youtube/terms/developer-policies
- [WI1] Wistia, «Making API Requests» (600 req/min) — https://docs.wistia.com/docs/making-api-requests.md
- [WI2] Wistia, «Show Media» (assets) — https://docs.wistia.com/reference/get_medias-mediahashedid.md
- [B1] Bunny Stream, estructura de URLs — https://docs.bunny.net/stream/storage-structure.md
- [B2] Bunny Stream, MP4 Fallback — https://docs.bunny.net/stream/mp4-downloads.md
- [VT1] Servidor MCP de vTurb (secundaria) — https://glama.ai/mcp/servers/hiperbold/vturb-mcp
- [CH1] Chrome, «Permission warning guidelines» — https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings
- [CH2] Chrome Web Store, «Malicious and Prohibited Products» — https://developer.chrome.com/docs/webstore/program-policies/malicious-and-prohibited
- [MX1] Que.es, «Latam es el epicentro de la economía de creadores…» (19/06/2026) — https://www.que.es/2026/06/19/economia-creadores-latam-hotmart/
