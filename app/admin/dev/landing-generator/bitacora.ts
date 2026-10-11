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
  { titulo: 'El JavaScript del HTML personalizado en la publicada', detalle: 'El iframe srcdoc hereda la política estricta de la página: en el editor corre, publicado no (la pantalla lo dice) · servirlo desde su propia URL choca con el X-Frame-Options DENY de toda la app (next.config.ts)', estado: 'cola' },
  { titulo: 'Lo de Gamma que no entró', detalle: 'Dominio propio, edición en tiempo real, controles de columnas, «Copiar en…» y «Exportar sección», Formato libre, Google Slides', estado: 'cola' },
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
];
