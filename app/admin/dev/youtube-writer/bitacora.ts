// =============================================================================
// YouTube Writer — el registro de construcción del área
// =============================================================================
// Alcance: escribir el guion de un video largo de YouTube para el cliente
// (estructura, gancho y CTA). Hoy es un <ComingSoon> de 8 líneas, sin backend.
// Vive en: app/youtube-writer/page.tsx, la fila del desplegable «YouTube» de
// nav.ts, el proyecto del catálogo (lib/plan-proyectos-catalogo.ts) y el bloque
// de los cinco formatos de docs/preguntas-para-llenar-proyectos.md.
//
// De dónde salió esto: el `pedido` del 7 de agosto es textual, del chat «Rediseño:
// sidebar y nueva navegación» (docs/chats.md); el resto, de los mensajes de commit
// —que en este repo explican el porqué—, de docs/dev-tabs-mapa.md (el relevamiento
// que le puso alcance) y de app/admin/dev/pricing/modelo.ts (el precio, medido
// aunque la feature no exista). Fechas y horas, de `git log`.
//
// ⚠️ ANTES DE BUSCAR NADA POR NOMBRE: en este repo «youtube» son DOS cosas sin
// relación. Esta área es la TAB DEL PRODUCTO, que todavía no existe. Todo lo que
// aparece en `lib/youtube.ts`, `lib/youtube-analytics.ts`, la ruta de cron
// `youtube-daily` y `scripts/backfill-youtube-analytics.ts` es el CANAL PROPIO de
// la agencia y pertenece al área `gtm-youtube`. Un `grep youtube` devuelve el canal
// y hace creer que esta área tiene código. No tiene.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'La tab en la barra', detalle: 'Content Machine · desplegable «YouTube», con Thumbnails · chip «pronto» · 8 líneas de ComingSoon', estado: 'hecha' },
  { titulo: 'El proyecto en el catálogo', detalle: 'Existe ANTES que la primera tarea, para que el ruteo no la mande al formato más parecido', estado: 'hecha' },
  { titulo: 'El precio, medido sin que exista', detalle: 'US$0,0295 por guion · es texto, así que entra en el cupo; lo caro del desplegable es Thumbnails', estado: 'hecha' },
  { titulo: 'La capa de arriba: Content Machine', detalle: 'La estrategia del contenido ya tiene proyecto propio, así que el formato deja de comerse tareas ajenas', estado: 'hecha' },
  { titulo: 'Cuál de los cinco formatos arranca', detalle: 'La pregunta está escrita y sin contestar; los cinco tienen CERO tareas', estado: 'sigue' },
  { titulo: 'De dónde sale el tema', detalle: '¿De Ideas, del ángulo de la fábrica, o se lo dicta el cliente? Sin eso no hay backend que escribir', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── 7 de agosto: nace adentro de un desplegable ────────────────────────────
  {
    fecha: '7 ago', hora: '02:17', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Content Machine como sección propia, y YouTube como uno de sus tres canales',
    pedido: '3. Quiero que "Content Machine" sea otra sección más, dentro tendrá "Ideas" luego un desplegable llamado "Ads" que contenga "Ads Writer" - "Image Generator" - "Video Generator". Luego otro desplegable llamado "Instagram" con "Reels" - "Carousels" - "Stories". Por último uno que sea "YouTube" con "YouTube Writer" - "Thumbnails". Los 3 desplegables con los logos reales, utiliza el de Meta para el caso de Ads. Y bueno para Ideas un foco o algo así.',
    puntos: [
      'El área nace **agrupada por CANAL, no por formato**: la unidad no es «escribir un guion», es «publicar en YouTube», y por eso Writer y Thumbnails viven juntos. Esa decisión define el producto tanto como el nombre — el día que se construya, el guion y la miniatura del mismo video tienen que salir del mismo lugar.',
      'El pedido llega con «Ideas» **afuera** de los tres desplegables. Ideas es el copiloto de idea→guion y los desplegables son los canales; la capa que faltaba —la ESTRATEGIA del contenido, arriba de los formatos— tardó cinco días más en aparecer y llegó por otro camino (ver 12 de agosto).',
    ],
  },
  {
    fecha: '7 ago', hora: '02:31', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab existe, y son ocho líneas',
    puntos: [
      'El stub sale con el chip «pronto», que es la política escrita del lote: *prometer un canal que no existe es peor que no tenerlo*. Ocho líneas —`ComingSoon` + `requireRolWs([], { nav: \'youtube-writer\' })`— y nada más. Acá el guard sí coincide con la barra (la fila no declara `rolesWs`, así que la tab es del admin del cliente), a diferencia de lo que pasó en Sales Machine con Closing Script.',
      '⚠️ **La tab tiene dos íconos distintos según desde dónde la mires.** `app/_components/nav.ts:270` la dibuja con `escribir` (el lápiz) y `app/youtube-writer/page.tsx:7` la dibuja con `youtube` (el logo). No rompe nada y por eso lleva meses así: el que la abre desde la barra ve cambiar el símbolo al aterrizar. Vale la pena decidirlo cuando se construya, porque el desplegable YA se llama «YouTube» con su logo — repetirlo adentro es ruido, y el lápiz es lo que distingue al Writer de Thumbnails.',
      'El commit que la creó era, en realidad, la corrección de otra cosa: el hover de las tabs no se veía porque un `style` en línea le ganaba a la regla de la hoja. La regla que quedó de ahí gobierna cualquier pantalla que se escriba después acá: **el `style` en línea lleva solo geometría**; color, fondo y estado de activo viven en la clase.',
    ],
    commits: [
      { sha: '72984b8f', msg: 'Rediseño · el hover roto, Content Machine como sección y tus tres íconos', lineas: 202, archivos: 12 },
    ],
    archivos: [
      'app/youtube-writer/page.tsx — las 8 líneas, con `icon="youtube"`',
      'app/_components/nav.ts:268-271 — el grupo `yt-formatos`, con la fila en `icon: \'escribir\'`',
    ],
  },

  // ── 8-9 de agosto: las preguntas, el relevamiento y el `vive[]` corto ───────
  {
    fecha: '8 ago', hora: '14:48', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Los cinco formatos están en cero, y la primera pregunta es cuál arranca',
    puntos: [
      'De los 68 proyectos del tablero, 9 estaban en cero tareas: **los cinco formatos de la Content Machine son cinco de esos nueve**, y se trataron como un solo bloque a propósito. El diagnóstico escrito: *no es que no haya trabajo, es que hoy nadie sabe qué hay que construir*.',
      'Las preguntas están redactadas para que **la respuesta SEA la tarea**, y la primera es la que ordena todo lo demás: **¿cuál de los cinco arranca primero y por qué ése?** — con el permiso explícito de que el resto quede «a futuro». Después: ¿qué tiene que devolver exactamente (un guion, una estructura, las placas con su copy, un archivo listo para subir)? ¿de dónde saca el tema: de Ideas, del ángulo de la fábrica, o se lo dicta el cliente? ¿hay alguna cuenta o referente cuyo formato querés copiar? ¿sirve algo de lo que ya existe —los ángulos, los guiones de ads— o arranca de cero?',
      'La penúltima es la que más ahorra si se contesta bien: la fábrica de creativos ya produce ángulos y guiones de video ads. Un YouTube Writer que arranque de ahí y uno que arranque de cero son dos features distintas, y la diferencia no es código — es una decisión que sigue sin tomarse.',
    ],
    commits: [
      { sha: '3497fefd', msg: 'Las preguntas para llenar los 24 proyectos flacos, y la cosecha del catálogo', lineas: 181, archivos: 2 },
    ],
    archivos: [
      'docs/preguntas-para-llenar-proyectos.md — bloque «🎬 Reels · 🎠 Carousels · ⭕ Stories · 🖼️ Thumbnails · ▶️ YouTube Writer»',
      'lib/plan-proyectos-catalogo.ts:126 — «YouTube Writer · ▶️ · El guion de los videos largos de YouTube para el cliente»',
    ],
  },
  {
    fecha: '9 ago', hora: '01:33', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El alcance salió de leer el código — y el `vive[]` nació corto',
    puntos: [
      'El relevamiento de 208 piezas fijó la regla que le dio alcance a esta área: **ninguna pieza «por construir» sale de la nada**, cada una cita el `comingSoon`, la tarea del plan o el comentario del código de donde viene. Por eso el alcance de acá es corto y honesto («ComingSoon sin backend») en vez de una promesa.',
      'De 6 áreas a 121, con el Roadmap saliendo del plan y el Change History de `git log` sobre las rutas de `vive`: *un registro inventado de antemano es peor que ninguno*.',
      '⚠️ **La trampa que este archivo viene a tapar.** El `vive[]` eran dos rutas: el stub —que tiene **un** commit en toda su vida— y `app/_components/nav.ts`, que tiene **68**. Resultado medido: el Change History automático del área muestra 12 commits y **ninguno habla de YouTube Writer** (son la barra del super admin, `/admin/docs`, el sistema de diseño). Es el gemelo de «una ruta que apunta a la nada»: una ruta que apunta a TODO tapa el área igual de bien, y encima el panel parece lleno. Se amplió con el catálogo, las preguntas, el mapa de tabs y el modelo de precios.',
      'El otro punto ciego del área no es una ruta sino un nombre: **`gtm-youtube` y `youtube-writer` se buscan igual y no comparten nada.** La nota está escrita en `areas.ts` para el área hermana (misma homonimia que Instagram) y aplica en los dos sentidos.',
    ],
    commits: [
      { sha: '74d40781', msg: 'Mapa de /admin/dev: las 208 piezas relevadas contra el código', lineas: 731, archivos: 1 },
      { sha: '93cde614', msg: 'Las 121 áreas del producto, con su Roadmap y su Change History derivados', lineas: 2453, archivos: 5 },
    ],
    archivos: [
      'docs/dev-tabs-mapa.md:521 — la ficha relevada del área',
      'app/admin/dev/areas.ts — el alcance, el `vive[]` y la nota de homonimia en `gtm-youtube`',
    ],
  },

  // ── 9 de agosto: tarifado sin existir ──────────────────────────────────────
  {
    fecha: '9 ago', hora: '03:39', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'US$0,0295 el guion — y lo caro del desplegable es la miniatura',
    puntos: [
      'El costo está **medido antes de que la feature exista**, y no a ojo: la tarifa salió de 2.249 llamadas reales, con el hallazgo de método que movió todos los números — **el estadístico correcto no es la mediana ni el p90, es la MEDIA**, porque la distribución de tokens de salida es asimétrica a la derecha (media 1,9x a 3x la mediana). Por mediana se subcobra y la cola se come el margen; por p90 se sobrecobra al 90 % de los usuarios.',
      '**El dato que cambia la prioridad del desplegable:** el guion es texto y sale US$0,0295; su vecino Thumbnails sale US$0,068 por dos variantes y el resto de la Content Machine se dispara (un reel de 15 s, US$2,445). O sea que **el YouTube Writer es de lo más barato que falta construir**, y el que tiene en espera al plan Growth es el bloque de medios, no éste. La regla: un ComingSoon de texto se puede prometer dentro de un plan que ya existe; uno de medios define un plan entero.',
      '⚠️ Figura en `FUERA_DE_GRILLA.porConstruir` de `modelo.ts` para que nadie lo venda por error. La nota del mismo bloque avisa de las áreas PEORES que un ComingSoon —las que figuran «listo» o «parcial» y se venderían sin querer—, que es el modo de falla que un área bien marcada «por construir» no tiene.',
    ],
    commits: [
      { sha: 'c4099abc', msg: 'pricing: paso 2 — el costo del producto completo', lineas: 183, archivos: 3 },
      { sha: 'e19a03e3', msg: 'pricing: la tarifa de MaKo Tokens, operación por operación', lineas: 207, archivos: 2 },
      { sha: '2f3d31e9', msg: 'pricing: la grilla de 4 columnas y el respaldo de los pasos 3 y 4', lineas: 265, archivos: 2 },
    ],
    archivos: [
      'app/admin/dev/pricing/modelo.ts — `ACCIONES_NUEVAS` (`yt-writer`, US$0,0295) y `FUERA_DE_GRILLA.porConstruir`',
    ],
  },

  // ── 12 de agosto: aparece la capa que faltaba arriba ───────────────────────
  {
    fecha: '12 ago', hora: '13:09', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La capa de arriba existe, y el formato deja de comerse tareas ajenas',
    puntos: [
      '**El síntoma:** «Definir la escalera de contenidos estilo podcast» se ruteó a «Feature: Reels» **por parecido de palabra**. No era un error del modelo: la escalera de contenidos no es un formato, es la capa de ESTRATEGIA arriba de los cinco —y esa capa no tenía destino en el catálogo. Con «Ideas» tampoco encajaba, porque Ideas dice con todas las letras que no es un repositorio de temas.',
      'Ahora «Content Machine» es un proyecto de verdad —la escalera, los pilares, el banco de historias, el calendario— y su descripción nombra explícitamente que **NO es ninguno de los formatos**: Reels, Carousels, Stories, Thumbnails y YouTube Writer son tabs propias. Para esta área eso significa que sus tareas van a ser sobre el guion y nada más; lo de «qué contar» ya tiene dónde vivir.',
      'La decisión de diseño que hay que no perder: el modelo **no puede** inventar un proyecto con nombre de familia del sidebar, pero nosotros sí podemos sumar esa familia al catálogo. Funciona porque `puedeSerProyectoNuevo` consulta el catálogo **antes** que la lista de familias, y ese orden es la regla entera — hay un test que lo fija justamente ahí.',
    ],
    commits: [
      { sha: '5efa59db', msg: '«Content Machine» es un proyecto de verdad, y los otros cuatro se fueron', lineas: 207, archivos: 3 },
    ],
    archivos: [
      'lib/plan-proyectos-catalogo.ts:119 — «Content Machine», con la lista de lo que NO es',
    ],
  },
];
