// =============================================================================
// Image Editor — el registro de construcción de la copia de Canva
// =============================================================================
// ESTO NO ES UN CHANGELOG. El changelog está en `git log`. Acá va lo que git no guarda: qué
// pidió Martín con sus palabras y por qué se resolvió así. El plano está en
// docs/diseno-editor-imagen.md; lo aprendido, en docs/hallazgos-editor-imagen.md.
//
// Las horas de los prompts son las del chat (no del commit); las de la implementación, las del
// commit. Se agrega AL FINAL del array (orden cronológico). La pantalla lo lee al revés.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'Image Editor (Canva)';

/** Las fases del área y en qué anda cada una. */
export const PARTES: Parte[] = [
  { titulo: 'Doory adentro de MaKo', detalle: 'El editor de Doory (fabric.js 7) portado, con el crédito que pide su licencia, guardado local por workspace y sólo para el super admin', estado: 'hecha' },
  { titulo: 'El re-vestido de Canva', detalle: 'Barra superior, riel izquierdo con su panel, barra del objeto, barra inferior e inicio de Canva, con la paleta y las proporciones medidas', estado: 'hecha' },
  { titulo: 'Guardar en Supabase', detalle: 'Diseños, «Subidos» y miniaturas en la base y el bucket del workspace; lo que estaba en el navegador sube solo', estado: 'hecha' },
  { titulo: 'Marca, versiones, compartir y comentarios', detalle: 'Las herramientas de Canva que piden tablas propias; hoy el editor las esconde', estado: 'cola' },
  { titulo: 'El catálogo propio', detalle: 'Fuentes alojadas, íconos y emoji con licencia libre, formas propias, plantillas y fotos de Unsplash', estado: 'cola' },
  { titulo: 'Lo que a Doory le falta de Canva', detalle: 'Texto en formas, tablas, cuadrículas, dibujar, copiar estilo, efectos de texto, quitar fondo de objetos', estado: 'cola' },
  { titulo: 'Abrirlo a todos los negocios', detalle: 'Visible y abierto en todos los workspaces con la pregunta de toda tab; el crédito de Doory lo ve cada negocio', estado: 'hecha' },
  { titulo: 'API de MaKo', detalle: 'El área imagen: listar, ver textos, plantillas, crear, cambiar textos, copiar y eliminar, también por WhatsApp', estado: 'hecha' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '14 oct', hora: '—', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Un Canva dentro de MaKo, en la tab Image',
    pedido: 'Quiero que implementes end to end un "Canva" dentro de MaKo, tal cual, copialo todo, tanto en diseño como funcionalidades. Revisa si hay algún repo que nos ahorre trabajo. Dejalo en "Content Machine" en una tab que sea "Image"',
    puntos: [
      'Se relevaron los repos: Doory (el único Canva completo sobre fabric.js 7, licencia de atribución), Tela y fabritor (sólo piezas), los clones del tutorial de Next + fabric, vue-fabric-editor (Vue). Polotno y LayerHub quedan afuera (SDK pago / repos borrados).',
      'Se relevó Canva desde fuentes públicas (el Chrome no tenía sesión): paleta, proporciones, rótulos, inicio, diálogos y atajos.',
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'La base: Doory, para ir trabajando',
    pedido: 'Copia a Doory, y luego lo modificamos completamente para que sea original de MaKo, pero quiero la plantilla para ir trabajando',
    puntos: [
      'Doory exige mostrar el crédito del autor cada vez que se abre el editor; modificarlo no saca la obligación. Queda el cartel puesto y el editor sólo para el super admin hasta resolverlo (permiso escrito del autor, o reescribirlo sin su código).',
    ],
  },
  {
    fecha: '14 oct', hora: '06:01', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Doory corriendo en /image-editor',
    puntos: [
      'El frontend de Doory portado a app/image-editor/_doory (sin tests ni su app), con los imports reescritos, sus tokens prefijados --cv- y limitados a .cv, y los textos en español neutro.',
      'Guarda en IndexedDB, una base por workspace, con el adaptador de invitado de Doory en modo cuenta; fuentes de Google Fonts por Fontsource.',
      'La tab Image apunta al editor y es su primera sección; el guard es por persona (sólo el super admin).',
      'La paleta de Canva medida ya está en los tokens; el armazón todavía es el de Doory.',
    ],
    commits: [
      { sha: '7c82507d', msg: 'Image Editor (tanda 1): Doory portado como base del Canva de MaKo, en la tab Image', lineas: 69698, archivos: 531 },
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Que se termine',
    pedido: 'No se pusheo? Avanza y termina',
    puntos: [
      'Lo contestó la tanda 2 (el armazón de Canva y el catálogo propio), que salió en el push integrado del orquestador.',
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'El editor con el armazón de Canva y el catálogo propio',
    puntos: [
      'Barra superior con el degradado de Canva (Inicio, Archivo, Redimensionar, deshacer, guardado, título con medidas, Presentar, Compartir); riel izquierdo Diseño · Elementos · Texto · Marca · Subidos · Herramientas · Proyectos · Apps con su panel flotante; barra del objeto flotante; barra inferior con Notas, zoom, Páginas y pantalla completa; inicio de Canva.',
      'Catálogo: ~60 fuentes de Google Fonts con sus pesos reales, las 10 plantillas de Doory, íconos y emoji de Iconify con licencia libre.',
      'Sin verificar en el navegador: el dev server local no aguanta compilar el editor con la máquina llena.',
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Cerrar lo pendiente (por el chat orquestador)',
    pedido: 'Martín quiere cerrar lo pendiente al 100%. Lo que NO depende de esa decisión, cerralo; y armame en una línea las opciones de lo que sí depende, para que él elija rápido.',
    puntos: [
      'Lo que no dependía de él: verlo andar, el presentador roto y la tanda 3 (guardar en la base). Lo que sí: Image mirando un cliente, la licencia de Doory, las fotos con key y la API mientras sea sólo suyo.',
    ],
  },
  {
    fecha: '14 oct', hora: '16:12', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El editor visto andando, y la vista del presentador',
    puntos: [
      'Sin dev server (pasa los 5 GB): un banco con esbuild y Chrome sin ventana. Crear, texto, plantilla, imagen soltada, guardar y reabrir, PNG y PDF: todo anduvo, sin errores en la consola.',
      '«Vista de presentador» abría una página de Vite que no existe en MaKo; ahora abre /image-editor/presentador y se conecta con el editor.',
    ],
    commits: [
      { sha: 'c7a77fcb', msg: 'Image Editor: «Vista de presentador» abre una ventana que existe', lineas: 135, archivos: 9 },
    ],
  },
  {
    fecha: '14 oct', hora: '16:49', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Los diseños pasan a la base',
    puntos: [
      'Diseños, «Subidos» y miniaturas en Supabase (mig 0278, aplicada): se ven desde otra máquina y la API y las Estrellas tienen de dónde leer.',
      'Dos pestañas sobre el mismo diseño no se pisan: la segunda ofrece recargar o guardar una copia.',
      'Lo que estaba guardado en el navegador sube solo la primera vez que se abre el editor, con su mismo enlace.',
      'Probado contra la base real en el Cliente de Prueba y en el banco: guardar, subir una imagen, descargarla en PNG con la imagen adentro, eliminar.',
    ],
    commits: [
      { sha: '5136c1ce', msg: 'Image Editor: los diseños y «Subidos» pasan a la base (tanda 3)', lineas: 1485, archivos: 21 },
    ],
  },
  {
    fecha: '15 oct', hora: '—', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Image en todos los workspaces (por el chat orquestador)',
    pedido: 'Que Image aparezca en todos los workspace.',
    puntos: [
      'Antes se midió por qué no la veía: con Content Machine plegada la fila no existe, y mirando un cliente o como admin de un cliente estaba escondida a propósito (adminOnly).',
    ],
  },
  {
    fecha: '15 oct', hora: '—', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Image abierta a todos los negocios',
    puntos: [
      'La tab Image se ve en todos los workspaces (salvo la capa pm, que no tiene Content Machine) y el editor deja entrar a cualquier admin del negocio, como el Video Editor.',
      'Image Generator y Thumbnails siguen diciendo «pronto», ahora también en la barra de secciones de arriba.',
      'Cada negocio ve el crédito de Doory al pie del editor: lo pide la licencia.',
    ],
  },
  {
    fecha: '15 oct', hora: '—', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El editor en la API de MaKo',
    puntos: [
      'MaKo, la skill y quien tenga un token pueden listar los diseños, ver sus textos, crear uno en blanco o desde una plantilla, cambiarle los textos, copiarlo y eliminarlo, con el permiso de la tab.',
      'Por WhatsApp, «creame un flyer…» llega con las herramientas del editor (antes se anotaba como tarea).',
      'Lo que no hace: dibujar ni descargar. Devuelve el link para abrirlo en el editor.',
    ],
  },
];
