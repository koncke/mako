// =============================================================================
// Landing Generator — el registro de construcción del área
// =============================================================================
// Alcance: desde el 11/10/2026 la tab es un editor de landings copiado de Gamma 5 (Panel, «Crear con
// IA» en dos pasos, edición por secciones y bloques en TipTap, temas, comentarios, historial,
// exportar, y publicar como foto en hola-mako.com/l/<slug>). Diseño y contratos:
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
  { titulo: 'Temas, hoja e íconos', detalle: '34 temas (18 medidos de Gamma, 16 aproximados de captura), una hoja de contenido de ~94 KB en em relativos a la sección y 251 íconos de Phosphor (MIT)', estado: 'hecha' },
  { titulo: 'Crear con IA en dos pasos', detalle: 'Esquema que se edita → secciones en tandas de 3 · la IA escribe bloques simples y el código los convierte (ia-bloques.ts) · prompts en el registro editable · IA gratis (Gemini), Claude vetado', estado: 'hecha' },
  { titulo: 'El editor', detalle: 'Un TipTap por página: menú «/», barra de formato, asa de bloques, 52 diseños optimizados, NodeViews de imagen, video, insertado, formulario, gráfico y HTML · autoguardado con concurrencia optimista', estado: 'hecha' },
  { titulo: 'Paneles y diálogos', detalle: 'Tema y editor de tema, estilo de sección, Edición con IA (Original/Modificado, aceptar/restaurar), comentarios, historial, análisis, Presentar, compartir, publicar y exportar (PDF, PNG, PPTX, HTML)', estado: 'hecha' },
  { titulo: 'Publicar en /l/<slug>', detalle: 'Foto de lo GUARDADO, multipágina, con el Pixel de MaKo y el Píxel de Meta · vista previa privada por token (también las otras páginas) · 404 igual para «no existe» y «apagado»', estado: 'hecha' },
  { titulo: 'Verlo andar en un navegador', detalle: 'Ningún paquete pudo levantar el dev server: faltan el arrastre de bloques y de la tira, la barra flotante, el «/», el cambio de página y una página publicada con el Píxel de Meta (consola sin violaciones de la política)', estado: 'sigue' },
  { titulo: '«Generar imagen con IA» por Google Flow', detalle: 'Decisión de Martín (D5): el puente de la extensión con la cuenta del cliente · asíncrono, y la URL de Flow vence: se copia al bucket antes de ponerla en el documento', estado: 'cola' },
  { titulo: 'Publicar y listar desde la API de MaKo', detalle: 'lib/api-mako/areas/landing.* sigue leyendo landing_drafts (el generador anterior): un agente no puede listar ni publicar las landings del editor nuevo', estado: 'cola' },
  { titulo: 'El JavaScript del HTML personalizado en la publicada', detalle: 'Tanda 2 (T6): cada bloque se sirve desde /l/html/<docId>/<bloque> con la política sandbox (next.config.ts le pone sus cabeceras DESPUÉS de las globales) y el iframe toma el alto por postMessage · «Replicar» una landing de afuera arma secciones así cuando los bloques no alcanzan', estado: 'hecha' },
  { titulo: 'El Panel como Gamma y crear landing o presentación', detalle: 'Tanda 2 (T1, T4): una barra de documentos con su «⋯» (abrir, diagnóstico, renombrar, duplicar, archivar, eliminar), «+ Nueva landing» primero, sin vistas ni carpetas · la caja «¿Qué vas a crear hoy?» con dictado y las plantillas de cada tipo', estado: 'hecha' },
  { titulo: 'Presentaciones', detalle: 'Tanda 2 (T3): formato presentación con diapositivas 16:9 o 4:3 y guía de desbordamiento, Presentar como acción principal, 12 plantillas, la IA escribe diapositivas · y una landing se ve como una PÁGINA continua (secciones a sangre), no como tarjetas', estado: 'hecha' },
  { titulo: 'Diagnóstico como recorrido', detalle: 'Tanda 2 (T2, T5): a la derecha del Panel, la pantalla se oscurece y señala el bloque de cada comentario, los comentarios quedan guardados (mig 0264, aplicada el 12/10) con «Solucionar con IA» o «Replicar» · falta verlo con clics y con un análisis real', estado: 'sigue' },
  { titulo: 'Dominio propio', detalle: 'Tanda 2 (T7): la pestaña «Dominios» de Publicar, registros DNS más un TXT _mako que prueba quién lo conectó, y proxy.ts sirve sólo la landing en ese host · la mig 0263 ya está aplicada; faltan VERCEL_API_TOKEN / VERCEL_TEAM_SLUG en producción (decide Martín qué token) y que las redirecciones y los archivos de public/ no se sirvan en el dominio del cliente', estado: 'sigue' },
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
];
