// =============================================================================
// Landing Generator — el registro de construcción del área
// =============================================================================
// Alcance: desde el 11/10/2026 la tab es un editor de landings copiado de Gamma 5 (Panel, «Crear con
// IA» en dos pasos, edición por secciones y bloques en TipTap, temas, comentarios, historial,
// exportar, y publicar como foto en hola-mako.site/<slug> desde el 14/10; antes, hola-mako.com/l/<slug>). Diseño y contratos:
// docs/diseno-editor-landing.md; lo aprendido: docs/hallazgos-editor-landing.md.
// Vive en: app/landing-generator/, app/api/landing-generator/, app/l/, lib/editor-landing/,
// lib/imagenes-stock.ts, supabase/migrations/0246_editor_landing.sql.
//
// De dónde salió esto: los dos `pedido` son textuales, de la sesión «Landing Generator» (cuenta 3,
// la de Martín); la hora de los prompts es el sello de la transcripción pasado a -03. La
// construcción todavía no tiene commits: al commitear, el sha va en `commits[]` del hito de
// implementación (y la hora pasa a ser la del commit).
//
// NO es un changelog. Va el motivo, la trampa, y lo que quedó SIN hacer.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El documento y su único render', detalle: 'JSON de ProseMirror (doc.ts) → render.ts, la ÚNICA fábrica de HTML público: lo usan la publicación, la vista previa, las miniaturas, exportar y Presentar · el saneo (validar.ts) descarta con motivo', estado: 'hecha' },
  { titulo: 'Temas, hoja e íconos', detalle: '35 temas (18 medidos de Gamma, 16 aproximados de captura y el de MaKo), una hoja de contenido de ~94 KB en em relativos a la sección y 251 íconos de Phosphor (MIT)', estado: 'hecha' },
  { titulo: 'Crear con IA en dos pasos', detalle: 'Esquema que se edita → secciones en tandas de 3 · la IA escribe bloques simples y el código los convierte (ia-bloques.ts) · prompts en el registro editable · IA gratis (Gemini), Claude vetado', estado: 'hecha' },
  { titulo: 'El editor', detalle: 'Un TipTap por página: menú «/», barra de formato, asa de bloques, 52 diseños optimizados, NodeViews de imagen, video, insertado, formulario, gráfico y HTML · autoguardado con concurrencia optimista', estado: 'hecha' },
  { titulo: 'Paneles y diálogos', detalle: 'Tema y editor de tema, estilo de sección, Edición con IA (Original/Modificado, aceptar/restaurar), comentarios, historial, análisis, Presentar, compartir, publicar y exportar (PDF, PNG, PPTX, HTML)', estado: 'hecha' },
  { titulo: 'Publicar en /l/<slug>', detalle: 'Foto de lo GUARDADO, multipágina, con el Pixel de MaKo y el Píxel de Meta · vista previa privada por token (también las otras páginas) · 404 igual para «no existe» y «apagado»', estado: 'hecha' },
  { titulo: 'Verlo andar en un navegador', detalle: 'Ningún paquete pudo levantar el dev server: faltan el arrastre de bloques y de la tira, la barra flotante, el «/», el cambio de página y una página publicada con el Píxel de Meta (consola sin violaciones de la política)', estado: 'sigue' },
  { titulo: '«Generar imagen con IA» por Google Flow', detalle: 'Decisión de Martín (D5): el puente de la extensión con la cuenta del cliente · asíncrono, y la URL de Flow vence: se copia al bucket antes de ponerla en el documento', estado: 'cola' },
  { titulo: 'Publicar y listar desde la API de MaKo', detalle: 'Tanda 4 (14/10): listar, leer, crear desde un diseño, publicar y despublicar · tanda 6: el puntaje del Diagnóstico, los rechazos del pago, Aplicar y Deshacer (listar/restaurar versiones), replicar en 3 formatos', estado: 'hecha' },
  { titulo: 'El JavaScript del HTML personalizado en la publicada', detalle: 'Tanda 2 (T6): cada bloque se sirve desde /l/html/<docId>/<bloque> con la política sandbox (next.config.ts le pone sus cabeceras DESPUÉS de las globales) y el iframe toma el alto por postMessage · «Replicar» una landing de afuera arma secciones así cuando los bloques no alcanzan', estado: 'hecha' },
  { titulo: 'El Panel como Gamma y crear landing o presentación', detalle: 'Tanda 2 (T1, T4): una barra de documentos con su «⋯» (abrir, diagnóstico, renombrar, duplicar, archivar, eliminar), «+ Nueva landing» primero, sin vistas ni carpetas · la caja «¿Qué vas a crear hoy?» con dictado y las plantillas de cada tipo', estado: 'hecha' },
  { titulo: 'Presentaciones', detalle: 'Tanda 2 (T3): formato presentación con diapositivas 16:9 o 4:3 y guía de desbordamiento, Presentar como acción principal, 12 plantillas, la IA escribe diapositivas · y una landing se ve como una PÁGINA continua (secciones a sangre), no como tarjetas', estado: 'hecha' },
  { titulo: 'Diagnóstico como recorrido', detalle: 'Tanda 2 (T2, T5) · tanda 6: «Aplicar» de un clic con Deshacer, «Aplicar todos», «Preguntar a MaKo», todas las páginas de una landing nuestra en un lienzo y el puntaje guardado (mig 0281) · falta verlo con clics', estado: 'sigue' },
  { titulo: 'Dominio propio', detalle: 'Tanda 2 (T7): la pestaña «Dominios», el TXT _mako y proxy.ts · tanda 4: el token de Vercel en producción y las redirecciones sólo en la app · tanda 6: el paso de pago EN el dominio y el aviso de la reserva vencida · falta (decide Martín) el www automático y los estáticos de MaKo en el dominio', estado: 'sigue' },
  { titulo: 'Leer una landing armada en el navegador', detalle: 'Tanda 6: el extractor lee div/span y los acordeones; si la página se arma con JavaScript, la lee el navegador de la persona (con el Pixel o en una ventana aislada, firmada por el server) y con las emergentes bloqueadas se ve el aviso con flecha', estado: 'hecha' },
  { titulo: 'Crear con IA en la tab y el chat con links', detalle: 'Tanda 6: Pegar texto · Generar · Importar · Analizar · Replicar (Presentación / Landing / Página web, copiando colores, fuentes e imágenes) en /landing-generator; el «+» sólo adjunta; el link pegado sale en azul · falta en MaKo Mobile (/m/landing)', estado: 'hecha' },
  { titulo: 'Animaciones y video de fondo', detalle: 'Relevado el 14/10 (docs/hallazgos-editor-landing.md → «Animaciones»): CSS nativo + nuestro script (GSAP prohibido por licencia), presets por sección, replicar las de una web, y el video IA de fondo cuando el puente a Flow lo haga · el parpadeo del hero, arreglado en landing-parpadeo, espera la respuesta de Martín', estado: 'cola' },
  { titulo: 'Lo de Gamma que no entró', detalle: 'Edición en tiempo real, controles de columnas, «Copiar en…» y «Exportar sección», Formato libre, Google Slides', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '11 oct', hora: '01:15', chat: 'Landing Generator', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Un editor de landings copiado de Gamma, con todo lo que Gamma hace',
    pedido: 'Quiero que implementes en la tab de "Landing Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se pueda hacer todo lo que ahí se hace.',
    puntos: [
      '**«Replica por completo» se leyó con la regla de la casa «Copiar una app TAL CUAL»**: el layout, los nombres como Gamma los dice en español y los colores van iguales, con su CSS en un scope propio (`.gma` para el chrome, `.gm-` para el contenido) que NO se «arregla» a los componentes de `app/_ui`. Lo que no se copia se dice en el comentario de cada archivo.',
      'En una página web Gamma llama **«sección»** a la tarjeta (en presentaciones, «diapositiva»): acá siempre «sección».',
      'La key del nav siguió siendo `landing-writer`: está escrita en la base (onboarding, capas). Lo que cambió son las rutas: `/landing-generator` (Panel), `/landing-generator/crear` y `/landing-generator/<id>` (el editor a pantalla completa).',
    ],
  },
  {
    fecha: '11 oct', hora: '01:20', chat: 'Landing Generator', cuenta: 'claude3',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El relevo: seis lectores antes de escribir una línea',
    puntos: [
      'Seis informes de sólo lectura: la interfaz de Gamma 5 pantalla por pantalla, su catálogo de funciones (en/es), los tokens visuales medidos, el mapa de integración en MaKo, qué se reusa de `EditorRico` (29 trampas ya resueltas) y qué se reusa de Presenton. De ahí salió `docs/diseno-editor-landing.md`: nueve decisiones (D1-D9) y los contratos entre doce paquetes.',
      '**La decisión que gobierna todo: UN renderizador y UNA hoja.** Lo que se edita es lo que se publica porque los NodeViews del editor y la página publicada salen de la misma función por nodo (`especificacion.ts`). Dos fábricas de HTML habrían divergido en la primera semana.',
      '**Sin dependencias de TipTap nuevas**: el menú «/», la barra flotante, el asa y los ids únicos se escribieron a mano (los paquetes de suggestion, drag-handle y unique-id no están instalados).',
      '**Nada de JavaScript de terceros en hola-mako.com**: la sesión de MaKo es una cookie del mismo origen. Por eso no se copian «código personalizado» ni Google Tag Manager; sí el Píxel de Meta, armado por el server con un id de sólo dígitos.',
    ],
  },
  {
    fecha: '11 oct', hora: '01:57', chat: 'Landing Generator', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Presenton como cantera de recursos',
    pedido: 'También puedes apoyarte de esto: https://github.com/presenton/presenton\nCreo que te dará muchos recursos y te ahorrará tiempo en funcionalidades',
    puntos: [
      'Se tomó la idea de los **dos pasos** (esquema rápido → secciones en tandas) y las reglas de prompt de su generador; `lib/editor-landing/ia-reglas.ts` lleva el aviso de derivación Apache-2.0.',
      '**Lo que NO se copió, a propósito: los reintentos.** Presenton reintenta hasta 12 veces; acá hay UN paso de reparación del JSON por la cascada barata y, si igual no sale, error con la salida cruda en el log (AGENTS.md, «Nunca más de un reintento propio»).',
    ],
  },
  {
    fecha: '11 oct', hora: '04:33', chat: 'Landing Generator', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Doce paquetes en paralelo y una integración',
    puntos: [
      'Doce agentes, cada uno dueño único de sus archivos (núcleo, visual, contenido, server, IA, página pública, motor del editor, menús, armazón, dos tandas de paneles y Panel/Crear), y una integración que aplicó los pedidos cruzados: montar el menú «/», el ⌘K del enlace, el Ask Agent de cada sección, la hoja de contenido UNA sola vez (eran 94 KB duplicados), un solo módulo de pedidos (`app/landing-generator/cliente.ts`: había cuatro copias con cuatro plazos), la base absoluta de la foto publicada y el tacho de comentarios que exige ser el autor.',
      '⚠️ **Repartir por archivo garantiza salidas huérfanas, y pasó**: el menú «/» se abría y no se dibujaba nada (nadie montaba `MenuBarra`), el ⌘K no abría nada y el Ask Agent no tenía call site. Cada paquete lo declaró como PEDIDO y lo cerró la integración: es la regla de AGENTS.md («el que CIERRA la corrida grepea cada prop nueva»).',
      '⚠️ **TipTap abre un documento VACÍO sin error si el JSON no cumple el esquema**, y el autoguardado lo escribiría encima. Por eso el saneo exporta su modelo de contenido, el esquema del editor lo usa tal cual, y el armazón valida cada página con `nodeFromJSON(...).check()` antes de darla por abierta: una página que no entra queda de sólo lectura y se guarda como estaba.',
      'Se retiró la pantalla vieja (`LandingWriterApp.tsx`) y su única ruta (`/api/landing-writer`): un grep en app, lib, tests, scripts, la API de MaKo y sus docs no encontró otro llamador. `/landing-writer` redirige con la query entera y el botón del Landing Analyst abre «Crear» con esa landing de base.',
      'La migración 0246 (tres tablas y el bucket público `landing-imagenes`, sin SVG) se aplicó ANTES del deploy: el código nuevo la lee.',
    ],
    commits: [],
    archivos: [
      'lib/editor-landing/render.ts — la única fábrica de HTML público (publicación, vista previa, miniaturas, exportar)',
      'lib/editor-landing/especificacion.ts — la forma HTML de cada nodo; la usan render.ts y las extensiones del editor',
      'lib/editor-landing/validar.ts — el saneo con descartes con motivo; su modelo de contenido es el esquema de TipTap',
      'app/landing-generator/editor/EditorLanding.tsx — el armazón y único dueño del documento (autoguardado, páginas, contexto)',
      'lib/editor-landing/publicar.ts + app/l/** — la foto publicada y las rutas públicas',
      'lib/editor-landing/ia.ts + ia-reglas.ts + ia-bloques.ts — la IA: prompts, tandas y la gramática de bloques',
    ],
  },
  {
    fecha: '11 oct', hora: '18:11', chat: 'Landing Generator', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La tanda 2: el Panel como Gamma, presentaciones, diagnóstico como recorrido, HTML libre y dominio propio',
    pedido: '1. Aún no se ve igual... Muchos botones a la derecha.\n2. "Diagnóstico" no debería ser otra ruta, debería abrirse ahí a la derecha.\n3. Elimina las tab de "Recientes, creadas por mi, publicadas y favoritas". También elimina la tab de "landings", que en la sidebar aparezcan las landings creadas/analizadas con el nombre de las mismas... Y también elimina el botón de "diagnostico" de la sidebar, en su lugar que esté dentro de los 3 puntos que debe tener cada landing, junto a otros botones como renombrar, eliminar, archivar, duplicar, etc... También elimina la funcionalidad de "carpetas".\n4. También agrega el botón de "Nueva landing" como placeholder en el primer puesto arriba de las demás landing.\n5. Falta la funcionalidad de crear presentaciones, no solo landings... Diapositivas, tal cual como lo hace gamma.\n6. Al momento de crear nuevo tengo que elegir si crear landing, presentación... Sería bueno que ahí aparezcan los templates (deberías hacer más templates de presentaciones)... Y también quiero ahí mismo agregar la funcionalidad que tenemos en "nueva automatización", donde le escribo a la IA o le mando un audio, pero me gusta el formato que hiciste de "¿Qué vas a crear hoy?", solo falta agregar la funcionalidad de dictarle con audio, como lo tenemos en donde te mencioné.\n7. También quiero que al analizar una landing sea como un "tutorial" de los que tenemos en MaKo, que se ponga opaco y señale el lugar donde se esta haciendo el comentario, y luego que queden guardados todos los comentarios y sugerencias y claro, la opción de solucionarlo allí mismo con IA.\n8. También si traigo una landing de afuera, tiene que funcionar el paso anterior, se tiene que previsualizar y comenzar con los "comentarios"... Y me gustaría si es una landing de afuera tener la opción de replicarla con nuestro editor.\n9. Si se tiene que poder editar libremente con "HTML personalizado", esto permitirá copiar otras landing...\n10. Y claro, falta la opción de publicar, ya sea con una URL creada por MaKo, como lo hace Gamma, o la opción de traer tu dominio.',
    puntos: [
      'Llegó con dos capturas del Panel en producción. Las decisiones T1-T7 están en docs/diseno-editor-landing.md («Tanda 2»). La hora es la del commit que lo dejó escrito en el diseño (67fb4f26): el pedido es de esa tarde.',
    ],
  },
  {
    fecha: '12 oct', hora: '02:40', chat: 'Landing Generator', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El feedback de la prueba con Fiesta Music: una landing que salió como diapositivas y la tira de miniaturas que falla',
    pedido: 'Te paso feedback, implementalo\n…pidieron una landing page… y te lo creó tipo presentación diapositiva, no te lo creó como si fuera una landing. Entonces también está mal\n…se buguea cuando estoy en la vista de editar… en el sidebar de secciones, principalmente en la vista que dice tira de imágenes... en la vista de lista no',
    puntos: [
      'La prueba fue con Fiesta Music, un cliente. Fragmentos textuales tal como los pasó la orquestación de la integración; los «…» son cortes de ese relevo, no del mensaje.',
      '**Las dos causas no eran las obvias**: la landing «tipo diapositivas» no era la IA sino la hoja (dibujaba el modo documento de Gamma), y la tira temblaba por la barra de scroll de Windows realimentando un ResizeObserver. El detalle, en docs/hallazgos-editor-landing.md → «Tanda 2».',
    ],
  },
  {
    fecha: '12 oct', hora: '02:40', chat: 'Landing Generator', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Tanda 2 en seis paquetes y una integración (con el feedback de la prueba)',
    puntos: [
      'Seis paquetes en paralelo (Panel, crear, presentaciones, diagnóstico, HTML libre, dominio) y una integración que aplicó los pedidos cruzados: las cabeceras del iframe en next.config.ts (el «HTML personalizado» en /l/html y la página de afuera del Diagnóstico), el formato en cada pedido de edición a la IA, «sección»/«diapositiva» en la tira, el menú de la sección y el agente, el dominio propio soltado de Vercel al borrar una landing o vaciar un workspace, y el corte de /l/html en el dominio de un cliente (sólo los bloques de SU landing).',
      '⚠️ **Una landing se veía como diapositivas porque la hoja dibujaba el modo DOCUMENTO de Gamma**: tarjetas flotantes con aire entre ellas. Una landing es ahora una página continua, como un sitio publicado de Gamma (secciones a sangre, sin radio ni sombra, una pegada a la otra; el «Ancho» elige el ancho del CONTENIDO): css.ts, bloque 15c. Las tarjetas con aire y proporción quedan sólo para las presentaciones. Y la IA en modo landing recibe que es una página de corrido, no diapositivas (`REGLAS_PAGINA`).',
      '⚠️ **La tira de miniaturas temblaba y la lista no**: el alto de cada miniatura sale de su ancho, y en Windows la barra de scroll (~15 px) aparecía y desaparecía con el alto total — un ResizeObserver en bucle. `scrollbar-gutter: stable` y conservar el alto mientras una imagen se decodifica. Falta verlo en el navegador.',
      'Se fueron con el Panel nuevo: «Añadir a favoritos» del menú del documento y las acciones `favorito`/`carpeta` del server (no las llamaba nadie). Las columnas quedan en la tabla.',
      'Migraciones 0263 (dominio) y 0264 (sugerencias del diagnóstico), escritas como 0258/0259 y renumeradas antes de aplicarse (la 0258 la tenía la sesión del CRM en su worktree; las 0260-0262, la de Graphics): aplicadas el 12/10 ANTES del deploy, porque el código nuevo las lee.',
    ],
    commits: [],
    archivos: [
      'lib/editor-landing/css.ts — bloque 15c: la página a sangre (el default); 15b: la diapositiva',
      'app/landing-generator/editor/TiraSecciones.tsx — la tira: el alto de la miniatura sin realimentación',
      'app/landing-generator/Inicio.tsx + panel-reglas.ts — el Panel: barra de documentos, «⋯», la derecha',
      'app/landing-generator/CajaCrear.tsx + crear/tipo.ts — crear landing o presentación, con dictado y plantillas',
      'app/landing-generator/diagnostico/* + lib/editor-landing/diagnostico*.ts — el diagnóstico como recorrido',
      'lib/editor-landing/html-libre.ts + app/l/html/** — el «HTML personalizado» servido aislado',
      'lib/editor-landing/dominios*.ts + proxy.ts + app/api/landing-generator/dominio — el dominio propio',
    ],
  },
  {
    fecha: '12 oct', hora: '08:00', chat: 'Landing Generator', cuenta: 'claude3',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La revisión adversarial de la tanda 2: el dominio de otro, el DELETE en negativo, el HSTS del cliente y el phishing',
    puntos: [
      '**Reservar el dominio de otro para siempre**: el índice único valía también para los pendientes. Ahora un pendiente vence a las 72 h, quien carga SU TXT `_mako` se lo quita antes, y un negocio no tiene más de 5 sin verificar (`reclamar`, `motivoParaQuitarReclamo`).',
      '**El guard que suelta dominios de Vercel pasó a POSITIVO**: sólo lo que MaKo agregó, con la marca `dominio_agregado_por_mako` (2xx a nuestro POST, después de leer que no estaba). Un 409 «ya está en el proyecto» ya no habilita el DELETE.',
      '**HSTS sólo en los hosts de MaKo** (`has: host` con `PATRON_HOSTS_DE_MAKO`): en el dominio raíz de un cliente forzaba HTTPS dos años a todos sus subdominios.',
      '**Un login copiado no se copia, no se publica y no se sirve** (`pideContrasena`): es un freno; lo de fondo —un dominio aparte para el contenido de usuarios— queda pendiente.',
      'De las BAJA, las de una línea: la página del dominio compara el `docId` (la caché host → slug podía servir otra landing), borrar suelta el dominio ANTES de borrar la fila y no lee a ciegas, y el error de la base ya no llega crudo a la pantalla. Quedan las redirecciones y los archivos de public/ en el dominio del cliente.',
    ],
    commits: [],
    archivos: [
      'lib/editor-landing/dominios-reglas.ts — lo puro: la marca, el reclamo que vence, el tope, el patrón de hosts',
      'lib/editor-landing/dominios.ts — reclamar, quitar el reclamo ajeno (compare-and-set), agregar con marca',
      'supabase/migrations/0263_landing_dominios.sql — dominio_reclamado_at y dominio_agregado_por_mako en el CHECK',
      'next.config.ts — el HSTS en su propio bloque con has: host',
      'lib/editor-landing/html-libre.ts + replicar-reglas.ts + publicar.ts — el freno del formulario de contraseña',
    ],
  },
  {
    fecha: '12 oct', hora: '11:13', chat: 'Landing Generator', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La barra «agregar sección» tapada, las herramientas de MaKo y el diseño separado del copy',
    pedido: '1. Revisa que entre las secciones, donde dice "agregar sección", está mal... Se oculta y no se ven los botones.\n2. Es muy importante que aproveches las herramientas que tenemos dentro de MaKo, como por ejemplo, embed de calendly, de cal, de stripe, de mercado pago, del VSL ya sea en YouTube, Panda, Vimeo, etc...\n3. Quiero que integres todo esto a las plantillas que construiste, y sobre todo, veo que en las plantillas confundiste la plantilla de DISEÑO, con el COPY... En el panel principal, se tienen que ver plantillas del diseño, y al darle a una, puede salir un pop-up o algo así que te pregunte de que quieres crearla, y ahí las opciones de "Agendar llamada, webinar, lead magnet, y todas las opciones que pusiste"\nEstos son cambios simples, hazlo ahora por más que estemos al limite semanal y no utilices multiagente, ya que no es tan complejo',
    puntos: ['Llegó con una captura del editor (la barra de la sección activa cortada por la sección de abajo).'],
  },
  {
    fecha: '12 oct', hora: '11:20', chat: 'Landing Generator', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Sin «Edición manual / Edición con IA»: el agente abierto siempre, y una sola cabecera',
    pedido: 'También no entiendo los botones de "Edición manual y edición con IA", si mientras estoy en edición con IA puedo editar tanquilamente de manera manaul...\nNo deberían existir esos botones, por defecto el editor de IA siempre abierto. Y de ultima que se pueda plegar. También revisa que hay 2 botones para plegarlo y 2 títulos iguales...\nSoluciona esto, tambien no es un cambio grande',
    puntos: ['Llegó con una captura del editor mientras se trabajaba el pedido anterior; se hizo en la misma tanda.'],
  },
  {
    fecha: '12 oct', hora: '11:40', chat: 'Landing Generator', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Tanda 3, sin agentes: diseños × objetivos, «Herramientas de MaKo» y el agente siempre abierto',
    puntos: [
      '⚠️ **La barra no se escondía por su z-index sino por el contexto de apilamiento**: cada sección lleva `isolation: isolate`, así que el `z-index: 6` de la barra se resolvía adentro de su sección y la de abajo, que se pinta después, la tapaba. Va adentro de la activa y la activa sube de capa.',
      'Las plantillas de landing pasaron a ser DISEÑOS (tema + hero + zigzag) y el copy se elige en «¿De qué quieres crearla?», desde la caja de crear y desde la galería del Panel. Las presentaciones no cambian.',
      'Agenda (Calendly o Cal.com), VSL (YouTube, Panda, Vimeo, Wistia) y botón de pago (link de Stripe o Mercado Pago): entran solos en los objetivos que los usan y como categoría «Herramientas de MaKo» del menú de bloques. El botón no arma el link desde la pasarela de MaKo (queda anotado).',
      'Sin el conmutador «Edición manual / Edición con IA»: el agente arranca abierto, se pliega con su « y vuelve con ✨ en la barra o Ctrl/⌘+E; cerrar Páginas vuelve al agente salvo que se haya plegado. La cabecera de afuera (casa, título, plegar) se sacó: la del agente es la única.',
    ],
    commits: [],
    archivos: [
      'lib/editor-landing/disenos-landing.ts — los diseños, los objetivos y el cruce (landingDesde)',
      'app/landing-generator/crear/DialogoObjetivo.tsx — el pop-up del objetivo (lo montan la caja y el Panel)',
      'app/landing-generator/editor/extensiones/estilos-nodos.ts — la barra de la sección activa',
      'lib/editor-landing/catalogo-bloques.ts + editor/insertar.ts — «Herramientas de MaKo»',
      'app/landing-generator/editor/EditorLanding.tsx — el agente abierto por defecto, sin conmutador ni cabecera doble',
      'tests/editor-landing-disenos.test.ts — los 80 cruces pasan el saneo; los bloques de MaKo donde van',
    ],
  },
  {
    fecha: '14 oct', hora: '04:24', chat: 'Landing Generator', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Las landings en hola-mako.site, y terminar lo pendiente menos las imágenes',
    pedido: 'Ya compré: hola-mako.site\nImplementalo allí y termina todo lo pendiente\n\nMenos el tema de las imagenes\n\n(a «¿Qué va en hola-mako.site?») Las landings enteras, como gamma.site',
    puntos: [
      'Antes había decidido: el botón de pago pide nombre y email antes del checkout, y «Dominios» usa el token de Vercel que está en .env.local.',
    ],
  },
  {
    fecha: '14 oct', hora: '04:49', chat: 'Landing Generator', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Que la mayoría de los diseños lleven un video (VSL Funnel)',
    pedido: 'Por favor, que la mayoría de las plantillas sean con un VIDEO, porque deberían ser tipo VSL Funnel... Puedes inspirarte en otras plantillas de VSL Funnel e incluso en la misma plantilla de MaKo.',
    puntos: [
      'Llegó con una captura de la grilla «Diseños» de Nueva landing: ninguna miniatura mostraba un video.',
    ],
  },
  {
    fecha: '14 oct', hora: '07:01', chat: 'Landing Generator', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Diseños con video: 8 de 9, «MaKo» primero, y la barra de la agencia',
    puntos: [
      'El VSL pasó a ser del DISEÑO (`video: centro | costado | null`): entra en el hero para cualquier objetivo, una sola vez. Sin video queda sólo Minimal. «MaKo» (tema propio, Geist, video al costado como app/vsl) va primero.',
      'La miniatura dibuja el video vacío como un 16:9 con ▶ sólo cuando quien dibuja lo pide (`marcadores`): la vista del teléfono (/m/landing) y la publicada no lo muestran. Una columna que queda vacía en la publicada se omite.',
      'La API (listar_disenos_landing) dice qué diseño trae video, y Publicar avisa «Falta el enlace del video».',
      'La barra «Estás viendo el dashboard de…» tapaba la de arriba del editor (Publicar incluido): los altos de pantalla completa descuentan --barra-agencia.',
    ],
    commits: [
      { sha: 'abfedd970', msg: 'Landing Generator: la mayoría de los diseños llevan un VSL en el hero', lineas: 457, archivos: 14 },
      { sha: '222cab435', msg: 'Landing Generator: sin hueco del VSL en la publicada, marcadores sólo donde se piden', lineas: 272, archivos: 15 },
      { sha: '142da25e1', msg: 'Landing Generator: la barra de la agencia ya no tapa el editor ni el Panel', lineas: 62, archivos: 4 },
      { sha: '7f5b5b080', msg: 'API de MaKo (landing): listar_disenos_landing dice qué diseño trae video', lineas: 24, archivos: 4 },
      { sha: '179efda44', msg: 'Publicar avisa «Falta el enlace del video» cuando el VSL del diseño quedó vacío', lineas: 134, archivos: 6 },
    ],
    archivos: [
      'lib/editor-landing/disenos-landing.ts',
      'lib/editor-landing/render.ts',
      'lib/editor-landing/temas.ts',
      'app/landing-generator/gamma.css',
      'docs/hallazgos-editor-landing.md — «Diseños con video»',
    ],
  },
  {
    fecha: '14 oct', hora: '10:54', chat: 'Landing Generator', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Tanda 4 integrada: pago, hola-mako.site y la API',
    puntos: [
      'El «Botón de pago» cobra por la pasarela de MaKo: paso de nombre y email, POST con candado por email (mig 0276, aplicada) y propuesta cuando no se puede cobrar.',
      'Las landings publicadas viven en hola-mako.site/<slug>; /l/… en la app es un 308; una página declarada con la dirección de antes sigue siendo la misma.',
      'El área landing de la API de MaKo maneja el editor: listar, leer, crear desde un diseño, publicar y despublicar.',
    ],
    commits: [
      { sha: 'f820ae2ea', msg: 'Merge de landing-api: el área landing de la API de MaKo maneja el Landing Generator', lineas: 1202, archivos: 10 },
      { sha: 'c3688ca84', msg: 'Merge de landing-dom: las landings publicadas viven en hola-mako.site', lineas: 1727, archivos: 27 },
      { sha: '207c1a6b0', msg: 'Merge de gamma-editor: el «Botón de pago» de las landings cobra por la pasarela de MaKo', lineas: 2639, archivos: 28 },
      { sha: 'd0c6214bd', msg: 'API de MaKo (landing): la dirección que devuelve es la de hola-mako.site, la misma que ve Publicar', lineas: 57, archivos: 2 },
      { sha: 'c03ef3da7', msg: 'Pago desde la landing en hola-mako.site: el botón lleva al paso y su POST pasa sólo con el Origin del host', lineas: 285, archivos: 9 },
      { sha: 'fd1c5abb4', msg: 'Landings declaradas, gracias y Diagnóstico: la dirección de antes de hola-mako.site es la misma landing', lineas: 171, archivos: 7 },
    ],
    archivos: [
      'lib/editor-landing/origen-landings.ts',
      'proxy.ts',
      'lib/editor-landing/pago-pedido.ts',
      'lib/api-mako/areas/landing.def.ts',
    ],
  },
  {
    fecha: '14 oct', hora: '11:49', chat: 'Landing Generator', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Leer la landing con el Pixel o con una ventana emergente, y avisar si están bloqueadas',
    pedido: 'Tal vez no es necesario la extensión de MaKo... Piensa como es mejor, pienso en algo como el pixel de MaKo, que se abre otra tab y una pestaña al lado.\nPero bueno, tal vez sea más cómodo con el pixel.\n\nHaz ambas opciones disponibles, si detecta que tenes el pixel instalado, que lo haga desde allí y sino desde la ventana emergente. Y previo a abrir la página, es muy importante que si el usuario no tiene la opción de \"habilitar ventanas emergentes\" de Chrome, no continue, no abra la página, sino que indique dentro de MaKo que lo tiene que habilitar. Me imagino como el mensaje que tenemso en Video Generator que es una flecha apuntando arriba con el mensaje.\nEsto para ambos, para esto y para el pixel hazlo.\n\nY quiero que en Landing Generator, si la landing del usuario está alojado, que se instale siempre por defecto el pixel y que se actualice solo siempre.',
    puntos: [
      'Respuesta a las decisiones del feedback de las reuniones: Aplicar = un clic + Deshacer; Replicar con 3 formatos; al replicar se copia el estilo. Queda para la próxima tanda (docs/relevo/landing-generator.md).',
      'Lo último ya era así: la publicada lleva el cargador de una línea del Pixel (/m.js), que sirve siempre la versión actual (pagina-publica.ts, tests/editor-landing-publica.test.ts).',
    ],
  },
  {
    fecha: '14 oct', hora: '13:30', chat: 'Landing Generator', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: '«No pude leer el texto de esa página», Crear con IA en la tab y las plantillas en tarjetas',
    pedido: '1. El mimso error que nos saltaba con Mauricio "No pude leer el texto de esa página.". Soluciona eso...\n2. La sección de "Importar con IA" no debería ser otra ruta, todo siempre en la misma ruta.\n3. La sección de "Crear con IA", le faltan las opciones de "Analizar Landing" y "Replicar Landing". Y que el botón de "Importar" que solo sea importar, no que sea con URL, para eso ya las otras opciones que te dije... Y esta sección de "Crear con IA" debería estar en la tab principal de landing generator, en la sección de "¿Qué vas a crear hoy?".\n4. Como vamos a tener esa sección, elimina todas las opciones actuales dentro del "+" en el cuadro del chat. Y que en ese + solo quede la opción de importar archivo y otras opciones así, para subir imagen y esas cosas...\n5. En el chat, si yo pego un link, me debería aparecer pintado de azul y que diga "Analiza esta landing" y que se pueda cambiar a "Replica esta landing".\n6. Las miniaturas y el título de abajo en las plantillas, deberían estar englobadas en un contendor, para que se entienda que ese título corresponde a esa miniatura... Elimina los subtitulos de cada plantilla. Y me gustaría que esos bloques tengan como una sombra, que se separe del fondo. También quiero que los [] que el usuario debe completar, se queden como de otro color o algo diferencial, y que eso se vea también en la miniatura, así se entiende mejor.',
    puntos: [
      'Se construye con el workflow wf_8f7c15cf-56d en la rama landing-t6; la cuenta 2 llega al límite a mitad de la pantalla y lo retoma la cuenta 1 (wf_2247d576-3c7).',
    ],
  },
  {
    fecha: '14 oct', hora: '23:10', chat: 'Landing Generator', cuenta: 'claude1',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Animaciones: el video de Motion Sites, qué se replica de una web ajena y el video de fondo, medidos',
    puntos: [
      'Pedido de Martín (por «Estrategia 3 cuentas»): animaciones de punta a punta a partir del video «Páginas Web ANIMADAS de $10,000 con Claude Design» («estoy seguro de que hay muchos otros»), más plantillas que las tengan, y replicar las de una web al copiarla. Eligió «las dos cosas»: el video IA de fondo y las animaciones de la página.',
      'Encontró un bug vivo: el interruptor «Animaciones» hace parpadear el hero de toda landing publicada y lleva el LCP de 236-404 ms a 1.428-3.004 ms en el teléfono. El arreglo (la primera sección quieta) está listo en la rama landing-parpadeo y espera la respuesta de Martín.',
      'GSAP queda fuera por su licencia (prohíbe editores visuales de animación); CSS nativo + nuestro script. De una web ajena se copia fiel lo de CSS, AOS, Framer appear, Webflow IX2 y GSAP simple; no lo de canvas/WebGL ni los archivos ajenos.',
      'El puente a Flow todavía no puede hacer el video de fondo; un hero de 8 s pesa 0,3-1 MB en el teléfono. Siete decisiones en la Ticketera (refs landing-anim-*, landing-video-*, landing-replicar-scroll).',
    ],
    commits: [
      { sha: '82c58360c', msg: 'docs(hallazgos): el video de fondo del hero, medido — el puente todavía no puede, cuánto pesa en 4G y el VP9 que era la medición', lineas: 88, archivos: 2 },
      { sha: 'ff9b68109', msg: 'docs(hallazgos): animaciones de página y replicarlas — el parpadeo del hero de hoy, GSAP fuera por licencia, qué se copia de una web ajena', lineas: 90, archivos: 2 },
    ],
    archivos: [
      'docs/hallazgos-editor-landing.md — «Animaciones: el video de fondo del hero» y «Animaciones: las de la página y replicarlas»',
    ],
  },
  {
    fecha: '15 oct', hora: '00:07', chat: 'Landing Generator', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Tanda 6: leer en el navegador, Crear con IA en la tab, «Aplicar» con Deshacer, copiar el estilo y el backlog',
    puntos: [
      '«No pude leer el texto» no era la red: el extractor no leía div/span y la landing del caso es una app de Vite. Ahora el server lee lo que perdía y, si la página se arma en el navegador, la lee el navegador de la persona (con el Pixel o en una ventana, con el aviso con flecha si las emergentes están bloqueadas).',
      'Crear con IA vive en la tab (Pegar texto · Generar · Importar · Analizar · Replicar en 3 formatos), el «+» sólo adjunta, el link pegado sale en azul y las plantillas son tarjetas con sombra; los [ ] se ven resaltados en el editor y en la miniatura.',
      '«Aplicar» de un clic con Deshacer, «Aplicar todos» y «Preguntar a MaKo»; Replicar copia colores, fuentes e imágenes de la original; el Diagnóstico lee todas las páginas y guarda el puntaje (mig 0281); el pago se sirve en el dominio propio y cuenta sus rechazos (mig 0282); el PDF de una presentación sale horizontal.',
      'La verificación encontró dos agujeros de seguridad en la ventana de lectura (phishing bajo nuestro dominio y reverse tabnabbing): cerrados con una firma del server (AGENTS.md).',
      'Sin hacer y decisiones de Martín: docs/hallazgos-editor-landing.md → «Tanda 6» → «Lo que quedó sin hacer».',
    ],
    commits: [
      { sha: '8be4a7da4', msg: 'fix(landing): «Conectar Stripe» abre el modal de /integraciones ahí mismo, no otra pestaña (el rojo de main, pasado solo)', lineas: 68, archivos: 3 },
      { sha: '0be209e23', msg: 'fix(landing): el panel flotante del editor no se cierra con un clic adentro del modal que tiene encima', lineas: 3, archivos: 1 },
      { sha: 'ab069c67f', msg: 'Landing Generator: los [ ] que hay que completar se ven resaltados en el editor y en la miniatura', lineas: 577, archivos: 6 },
      { sha: 'a2f6b377b', msg: 'Landing Generator: MaKo lee la landing en el navegador de la persona (con el Pixel o en una ventana), y el aviso con flecha cuando las ventanas emergentes están bloqueadas', lineas: 2326, archivos: 13 },
      { sha: '44c1fc628', msg: 'Landing Generator (tanda 6): el server lee lo que perdía, contesta «léela en tu navegador» y Replicar con 3 formatos', lineas: 1714, archivos: 19 },
      { sha: '43fd45487', msg: 'Landing Generator (tanda 6, pantalla): «Crear con IA» en la tab con Analizar y Replicar, el «+» sólo adjunta, el link pegado en el chat y las plantillas en tarjetas', lineas: 2018, archivos: 19 },
      { sha: '8e2a6f0c8', msg: 'Landing Generator (tanda 6, d): Replicar copia el estilo de la original — sus colores y fuentes en un tema propio y sus imágenes en nuestro bucket', lineas: 2214, archivos: 9 },
      { sha: 'feb0a0dff', msg: 'Landing Generator (tanda 6, c): «Aplicar» de un clic con «Deshacer», «Aplicar todos», «Preguntar a MaKo», y lo que el triage dejó para la pantalla y la API', lineas: 2850, archivos: 24 },
      { sha: '790c9fb78', msg: 'Landing Generator (tanda 6, motor): el Diagnóstico de una landing nuestra lee TODAS sus páginas, guarda su puntaje y usa la lectura del navegador', lineas: 526, archivos: 4 },
      { sha: 'aa970508b', msg: 'Landing Generator (tanda 6, motor): una sola marca para los desplegables y `bloqueada` en null cuando la leyó el navegador', lineas: 185, archivos: 4 },
      { sha: 'c55565d32', msg: 'Landing Analyst: analyze, sync y pulso son sólo del admin, como view y mapa', lineas: 114, archivos: 4 },
      { sha: '81544a847', msg: 'Landing Generator (tanda 6, motor): «Probar nuevo diseño» recibe el formato y en una presentación propone diapositivas', lineas: 61, archivos: 4 },
      { sha: '87298ad53', msg: 'Landing Generator (tanda 6, paquete 2): el paso de pago se sirve EN el dominio propio, «Dominios» avisa la reserva vencida y despublicar sabe del dominio', lineas: 528, archivos: 8 },
      { sha: 'd5fc19976', msg: 'Landing Generator (tanda 6, paquete 3): el pago poda sus pedidos viejos, cuenta sus rechazos por landing y día, y el lead que paga nace con su campaña', lineas: 837, archivos: 6 },
      { sha: 'a9cd561ff', msg: 'Landing Generator (tanda 6, paquete 4): el PDF de una presentación sale horizontal, el video al costado en el teléfono, la gracias con su video y la copia de una app crece con su contenido', lineas: 535, archivos: 14 },
      { sha: 'bfa25c88b', msg: 'Landing Generator (tanda 6, verificación): la ventana de lectura sólo con la firma del server, el Pixel sólo en una landing del negocio, y el typecheck de la rama en verde', lineas: 372, archivos: 7 },
      { sha: 'a184fb818', msg: 'Landing Generator (tanda 6, verificación): el alto de la copia de una app no se desboca con un hero de 100vh', lineas: 46, archivos: 2 },
      { sha: '59dd291b1', msg: 'Landing Generator (tanda 6, verificación): el Diagnóstico muestra todas las páginas y usa la copia que ya existe, la API dice el puntaje, los rechazos, el dominio al despublicar y cómo deshacer', lineas: 931, archivos: 28 },
      { sha: 'af8a5aca7', msg: 'Probar el tracking: la pestaña de la landing sólo navega a una dirección http(s) validada (un javascript: corría con el origen de MaKo)', lineas: 92, archivos: 4 },
      { sha: 'c592b559d', msg: 'Landing Generator: el link de la caja sale sólo si es todo lo escrito, conserva su «)» y tipeado con Enter también', lineas: 127, archivos: 3 },
      { sha: '6644fb39d', msg: 'Replicar como «Página web» una app de Vite o Lovable propone «Landing» con un botón', lineas: 168, archivos: 8 },
      { sha: '4cb3c543b', msg: 'Dominios: «Reserva vencida» dice lo que la pestaña de verdad ofrece (eliminarlo y añadirlo de nuevo)', lineas: 40, archivos: 2 },
      { sha: 'c545adb22', msg: 'Diagnóstico: «Aplicar» devuelve la versión que escribió su guardado, no la de una relectura posterior', lineas: 45, archivos: 3 },
      { sha: '7cbfe9479', msg: 'docs: cosecha de la tanda 6 del Landing Generator — lo aprendido, por área, y dos reglas en AGENTS.md', lineas: 218, archivos: 6 },
    ],
    archivos: [
      'lib/landing-extraer.ts — el extractor puro (div/span, preguntas por contención, nav fuera)',
      'lib/editor-landing/lector-script.ts, lector.ts, lector-pagina.ts, lector-firma.ts — leer en el navegador',
      'app/landing-generator/Inicio.tsx, CajaCrear.tsx, panel-reglas.ts — Crear con IA en la tab',
      'lib/editor-landing/estilo-original.ts, estilo-aplicar.ts — copiar el estilo',
      'lib/editor-landing/diagnostico-aplicar.ts, diagnostico-guardado.ts — Aplicar y el puntaje',
      'supabase/migrations/0281_landing_docs_diagnostico.sql, 0282_landing_pago_rechazos.sql',
    ],
  },
];
