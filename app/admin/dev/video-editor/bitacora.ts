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
  {
    fecha: '13 oct', hora: '—', chat: 'Puente a Flow / Content Machine', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Implementar completo el feedback de las tres reuniones',
    pedido: 'Ahora pasale todos los feedback de las 3 reuniones a los chats y diles que lo implementen completo... De punta a punta',
    puntos: [
      'Llegó por el chat «Estrategia 3 CUENTAS», que repartió el feedback por área. Al editor le tocaron cuatro tareas de la reunión 858545195, que son extracción de Fathom y no palabras literales: el botón de borrar silencios (@94:33), los subtítulos automáticos sincronizados (@96:11), que la barra lateral no desaparezca mientras se edita (@96:17) y los nombres descriptivos de los B-rolls (@97:08).',
      'La barra lateral contradecía el §9 del diseño (pantalla completa como CapCut). Se le preguntó a Martín y la decisión fue que la barra se queda.',
    ],
  },
  {
    fecha: '14 oct', hora: '00:05', chat: 'Puente a Flow / Content Machine', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'La barra lateral de MaKo se queda mientras se edita',
    puntos: [
      'El editor dejó de ser una vista sin chrome y dejó de ir fixed encima de todo: se dibuja adentro de Pagina, con el alto que queda bajo la barra de secciones, igual que el inicio.',
      'Un test cuida las tres cosas, porque cualquiera de ellas sola alcanza para volver a tapar la barra.',
    ],
    commits: [
      { sha: 'e1523b2f', msg: 'Video Editor: la barra lateral de MaKo se queda mientras se edita', lineas: 68, archivos: 5 },
    ],
  },
  {
    fecha: '14 oct', hora: '00:05', chat: 'Puente a Flow / Content Machine', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: '«Borrar silencios»: un botón en la barra de la línea de tiempo',
    puntos: [
      'Un solo comando, un solo Deshacer, que usa Dividir y Eliminar de la casa: así los fundidos, las animaciones y la transición se reparten igual que al cortar a mano.',
      'El umbral se adapta al clip, para que una grabación bajita no sea «toda silencio». Un clip que es todo silencio no se borra: se avisa.',
      'Se armó de cero: OpenCut classic no lo tiene y en CapCut es «Identificar y eliminar muletillas» (Pro). Martín pidió después que eso se avise ANTES de construir.',
    ],
    commits: [
      { sha: '923120b4', msg: 'Video Editor: «Borrar silencios», un botón que los saca solo', lineas: 823, archivos: 8 },
    ],
    archivos: [
      'app/video-editor/_opencut/audio/dsp/silencios.ts — la detección, pura',
      'app/video-editor/_opencut/audio/silencios-plan.ts — de la fuente a la línea: cortes y lugares',
      'app/video-editor/_opencut/commands/timeline/element/borrar-silencios.ts — el comando',
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: 'Puente a Flow / Content Machine', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'La pestaña «Avatar de IA» de CapCut, con lo que MaKo ya genera',
    pedido: 'E implementa lo que ya tenemos en MaKo para la generación de videos con esa tab que tiene Capcut de "Avatar de IA"',
    puntos: [
      'Mandó la captura de CapCut: «Elige el avatar» → «Agregar voz», la columna con Biblioteca de avatares, De foto a avatar y las demás, y la grilla con «Crear».',
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: 'Puente a Flow / Content Machine', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Antes de crear algo, revisar la fuente; si no está, avisar',
    pedido: 'Lo de "borrar silencios" está bien, solo te pido que no crees cosas de 0, que siempre vuelvas a la inspiración que te pasé al momento de crear esta tab, tenias un repo en Githut para copiar, o no se de donde lo copiaste... Pero si ya esta eso, podrías simplemente copiar esa funcionalidad en lugar de crearla de 0. Siempre haz eso, como regla, primero revisar y en caso de que no esté para inspirarte o copiar me lo dices',
    puntos: [
      'Quedó como regla en la memoria y en el diseño del editor: primero el relevamiento de CapCut y el de OpenCut (docs/editor-video/), después construir.',
    ],
  },
  {
    fecha: '14 oct', hora: '00:25', chat: 'Puente a Flow / Content Machine', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: '«Avatar de IA»: la pantalla de CapCut, la generación del Video Generator',
    puntos: [
      'Un avatar es un escenario confirmado del historial del Video Generator: la persona con su cara en su lugar, que es lo que se anima para filmar.',
      '«Generar» arma el plan con el guion literal (generarPlanAction) y filma toma por toma con las acciones del Video Generator, en serie y sin reintento. Cada toma que llega va a la línea, una detrás de la otra.',
      'Lo único nuevo en lo compartido es un piso de tomas: con el rango del formato, una frase dicha por el avatar se cobraba como un anuncio de 7 tomas.',
      'Llega de punta a punta cuando el puente lea el video del Flow nuevo: hoy el clip se genera en Google y MaKo todavía no lo puede traer.',
    ],
    commits: [
      { sha: '98e8ea36', msg: 'Video Editor: la pestaña «Avatar de IA» de CapCut, generando con el Video Generator', lineas: 890, archivos: 15 },
    ],
    archivos: [
      'app/video-editor/avatar/ — qué es un avatar y las server actions',
      'app/video-editor/_opencut/avatar/ — la pestaña y la generación toma por toma',
    ],
  },
  {
    fecha: '15 oct', hora: '—', chat: 'Video Editor', cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Un chat al costado para editar con prompt, todo a la API de MaKo, y animaciones tipo Lottie',
    pedido: 'Puedes pasarle esto al video editor y a landing generator. https://www.instagram.com/p/DeOxisYD6ap/?img_index=8&psln=MWZpZ29heDVicXI5Yg== Es para crear animaciones... Y en ese caso son tipo Lottie, muy utilizado en landing. Pero puede investigar otras skills o investigar otras animaciones... Y es importante que video editor tenga, como landing, un chat al costado donde pueda ir editando todo con prompt. Ambos, tienen que pasarle absolutamente todos los botones. Todas las funciones a la API de MaKo.',
    puntos: [
      'Llegó por «Estrategia 3 cuentas». El modelo del chat lo decidió ese chat: el mismo del Landing, gratis y sin Claude.',
      'La API espera una decisión: los proyectos viven en el navegador y la API corre en el servidor (Ticketera, «video-proyecto-donde-vive»).',
    ],
  },
  {
    fecha: '15 oct', hora: '00:47', chat: 'Video Editor', cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: '«Editar con IA»: el chat del Landing, al costado del editor',
    puntos: [
      'Un botón en la barra de arriba abre una columna a la derecha; los cuatro paneles de CapCut sólo se angostan.',
      'Se pide en el chat y MaKo propone: la revisión muestra «Original | Modificado», y se acepta o se descarta entero. Aceptar guarda primero; «Restaurar» lo deshace.',
      'Por ahora sabe agregar y cambiar textos, borrar, mover, alargar, cortar, cambiar el volumen, silenciar y ocultar. Sobre todo el video o sobre lo elegido.',
      'Corre con el Gemini del cliente y nunca paga. Lo que cuesta plata (Avatar de IA, Texto a voz) no lo puede pedir.',
      'No se miró en un navegador: la ventana de Chrome estaba oculta.',
    ],
    commits: [
      { sha: '901786601', msg: 'Video Editor: el chat «Editar con IA» al costado, copiado del Landing', lineas: 1752, archivos: 13 },
    ],
    archivos: [
      'lib/editor-video/chat-catalogo.ts — lo que el chat puede pedir y su validación',
      'lib/editor-video/ia.ts + app/api/video-editor/ia/route.ts — la llamada a la IA',
      'app/video-editor/_opencut/chat/ — la vista para la IA, la revisión, aplicar y el panel',
    ],
  },
  {
    fecha: '15 oct', hora: '—', chat: 'Video Editor', cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Primero terminar la copia de CapCut, empezando por los subtítulos',
    pedido: 'Es importante implementar la función de subtítulos que ya de por sí tiene CapCut... Creo que Video Editor no terminó de copiar todo lo que debía copiar de CapCut, tal vez que termine eso primero.',
    puntos: [
      'Llegó por «Estrategia 3 cuentas». Salió el inventario: de 158 funciones de CapCut, 74 escritas, 26 a medias, 42 por copiar y 16 fuera con su motivo.',
      'Los subtítulos automáticos ya existían (Whisper en el navegador, gratis). Faltaba guardar el tiempo de cada palabra.',
    ],
  },
  {
    fecha: '15 oct', hora: '01:34', chat: 'Video Editor', cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Subtítulos: el tiempo de cada palabra, dividir, combinar y buscar y reemplazar',
    puntos: [
      'Cada subtítulo guarda cuándo se dijo cada palabra, y sigue valiendo al dividirlo o moverlo. Si alguien reescribe el texto, deja de valer.',
      'En el panel, los atajos de CapCut: Enter en el medio divide donde empieza la palabra, Retroceso al principio y Supr al final combinan, y Ctrl+Enter es un salto de línea.',
      '«Buscar y reemplazar», con «Sustituir» y «Reemplazar todo».',
      'El chat ya puede subtitular todo el video y reemplazar una palabra en todos los subtítulos.',
      'No se miró en un navegador.',
    ],
    commits: [
      { sha: '7ef765fcc', msg: 'Video Editor: los subtítulos guardan el tiempo de cada palabra, y se dividen, combinan y reemplazan como en CapCut', lineas: 1091, archivos: 14 },
    ],
    archivos: [
      'app/video-editor/_opencut/subtitles/palabras.ts — guardar, leer y cotejar las palabras; dividir y combinar',
      'app/video-editor/_opencut/subtitles/editar.ts — dividir, combinar y reemplazar en la línea de tiempo',
      'docs/editor-video/inventario-copia-capcut.md — el inventario de la copia',
    ],
  },
];
