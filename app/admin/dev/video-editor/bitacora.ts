// =============================================================================
// Video Editor — el registro de construcción de la copia de CapCut
// =============================================================================
// ESTO NO ES UN CHANGELOG. El changelog está en `git log`. Acá va lo que git no guarda: qué
// pidió Martín con sus palabras y por qué se resolvió así. El plano está en
// docs/diseno-editor-video.md; lo aprendido, en docs/hallazgos-video-editor.md.
//
// Las horas de los prompts son las del chat (no del commit); las de la implementación, las del
// commit. Se agrega AL FINAL del array (orden cronológico). La pantalla lo lee al revés.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'Video Editor';

/** Las fases del área y en qué anda cada una. */
export const PARTES: Parte[] = [
  { titulo: 'El motor de OpenCut adentro de MaKo', detalle: 'OpenCut classic portado (MIT): línea de tiempo, keyframes, render WebGPU, exportar con WebCodecs. Proyectos locales separados por workspace', estado: 'hecha' },
  { titulo: 'La cáscara de CapCut', detalle: 'Barra superior, biblioteca, panel derecho, línea de tiempo, reproductor y Exportar, con las proporciones y la paleta medidas de CapCut 9.3', estado: 'hecha' },
  { titulo: 'Integración con MaKo', detalle: 'Sólo el super admin hasta validarlo, el registro de /admin/dev y «Editar en el editor» desde Video Generator', estado: 'hecha' },
  { titulo: 'Las funciones de CapCut', detalle: 'Color, transiciones, animaciones, operaciones de clip, audio, subtítulos automáticos y eliminar fondo, enchufadas por ranuras', estado: 'sigue' },
  { titulo: 'Abrirlo a los clientes', detalle: 'Cuando Martín lo valide: sacar el candado del super admin y decidir en qué capas aparece', estado: 'cola' },
  { titulo: 'La vuelta a Ads Manager', detalle: 'Que el video exportado se suba al bucket del workspace y aparezca en «Mis creativos» para publicarlo', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '11 oct', hora: '—', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Un editor de video idéntico a CapCut',
    pedido: 'Quiero que implementes un editor de vídeo end-to-end replicando a Capcut... Que sea identico con todas sus funcionalidades... Puedes investigarlo o incluso ayudarte de repositorios para ahorrate trabajo, como este: https://github.com/opencut-app/opencut',
    puntos: [
      'La referencia es CapCut Desktop 9.3 de Windows, tema oscuro: la que tiene instalada, de la que hay textos exactos y la más completa (la Web tiene otra distribución).',
      'Se copia la estructura, las proporciones, los nombres en español y los colores medidos; no se copian los binarios de ByteDance (íconos, logo, fuente, miniaturas, música).',
    ],
  },
  {
    fecha: '11 oct', hora: '11:18', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'El motor de OpenCut classic corriendo en /video-editor',
    puntos: [
      'Se portó OpenCut classic en vez de escribir un editor: trae línea de tiempo, keyframes, máscaras, render WebGPU, exportar con WebCodecs y Whisper local, en el mismo Next 16 + React 19 de MaKo.',
      'Sus tokens de shadcn chocaban con los de MaKo en tres nombres y su :root pisaba la barra lateral: el tema quedó encerrado en `.ce`.',
      'IndexedDB y OPFS son por ORIGEN: cada base lleva el prefijo del workspace, porque el super admin mira varios clientes en el mismo navegador.',
      'Sin la API de Freesound: sus condiciones prohíben usarla dentro de un SaaS.',
    ],
    commits: [
      { sha: '7a2cf162', msg: 'Video Editor (base): el motor de OpenCut classic corriendo en /video-editor', lineas: 106204, archivos: 907 },
    ],
  },
  {
    fecha: '11 oct', hora: '11:28', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'Ranuras y ganchos para enchufar cada función sin pisarse',
    puntos: [
      'El panel derecho, la biblioteca y la barra de la línea de tiempo DIBUJAN lo registrado; cada función de CapCut se registra desde su archivo. Es lo que deja trabajar a varios agentes a la vez.',
      'Filtros, Ajustar y croma corren como shaders WebGL2 desde TypeScript: el compositor de OpenCut es Rust→WASM con un solo shader, y sumarle otros exigía Rust en el build.',
    ],
    commits: [
      { sha: '31b22bd7', msg: 'Video Editor: ranuras y ganchos para enchufar cada función de CapCut sin pisarse', lineas: 701, archivos: 12 },
    ],
  },
  {
    fecha: '11 oct', hora: '11:42', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'investigacion',
    titulo: 'El plano: diez decisiones, trece paquetes y sus contratos',
    puntos: [
      'Los textos salen del es-LA.po de la instalación de CapCut, no de su web: las páginas en español están traducidas a máquina y no coinciden con la app.',
      'Local primero: el tope del storage de Supabase no está medido (5 GiB o 100 GB según quién lo midió) y el video crudo pesa. Exportar es descargar el archivo.',
      'IA sin costo por default: subtítulos con Whisper en el navegador; texto a voz sólo con la clave de ElevenLabs del cliente y con botón explícito.',
    ],
    commits: [
      { sha: '21281447', msg: 'Video Editor: el diseño (decisiones, ranuras, contratos) y los relevamientos', lineas: 2289, archivos: 7 },
    ],
    archivos: [
      'docs/diseno-editor-video.md — el plano: decisiones, arquitectura, reglas y paquetes',
      'docs/editor-video/ — los cuatro relevamientos (armazón y funciones de CapCut, OpenCut, integración con MaKo)',
    ],
  },
  {
    fecha: '11 oct', hora: '13:08', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'La cáscara de CapCut: barra, biblioteca, panel derecho, línea de tiempo, reproductor y Exportar',
    puntos: [
      'Cinco paquetes en paralelo sobre las ranuras: la distribución medida de CapCut, el Inicio con «Crear proyecto», el diálogo Exportar completo, las nueve pestañas de la biblioteca y los atajos del preset de CapCut.',
      'Música y Efectos de sonido quedan vacíos hasta tener licencia: una pista sin licencia es un reclamo de copyright sobre la campaña del cliente.',
    ],
    commits: [
      { sha: 'd830b28f', msg: 'Video Editor, tanda 1: la cáscara de CapCut (barra, biblioteca, panel derecho, línea de tiempo, reproductor, Exportar)', lineas: 22882, archivos: 166 },
    ],
  },
  {
    fecha: '11 oct', hora: '—', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'Integración con MaKo: sólo el super admin, y «Editar en el editor» desde Video Generator',
    puntos: [
      'Hasta que Martín lo valide, el editor lo abre sólo el super admin, también adentro de un cliente con el ?ws=. El candado está en el server: esconder la tab de la barra no cierra la URL, y la page no cierra la API (la ruta de texto a voz pregunta lo mismo).',
      '«Editar en el editor» abre un proyecto nuevo con el anuncio en la pista principal. El botón manda una referencia y el server del editor arma la url: el bucket es público y su ruta no lleva el workspace.',
      'El anuncio se baja directo del bucket: medido, responde con CORS abierto, así que no hizo falta una ruta intermedia.',
    ],
    archivos: [
      'app/video-editor/acceso.ts — quién puede abrir el editor (una pregunta, un lugar)',
      'app/video-editor/desde/ — la referencia, su resolución en el server y la importación en el navegador',
      'app/video-generator/editor-video.tsx — el botón, que se ofrece con la misma pregunta que el guard',
    ],
  },
];
