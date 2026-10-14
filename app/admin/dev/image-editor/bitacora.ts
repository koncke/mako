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
  { titulo: 'Guardar en Supabase', detalle: 'Diseños e imágenes en la base y el bucket del workspace; Marca, versiones, compartir y comentarios', estado: 'cola' },
  { titulo: 'El catálogo propio', detalle: 'Fuentes alojadas, íconos y emoji con licencia libre, formas propias, plantillas y fotos de Unsplash', estado: 'cola' },
  { titulo: 'Lo que a Doory le falta de Canva', detalle: 'Texto en formas, tablas, cuadrículas, dibujar, copiar estilo, efectos de texto, quitar fondo de objetos', estado: 'cola' },
  { titulo: 'API de MaKo y abrirlo a clientes', detalle: 'Declarar el área en la API; resolver el crédito de la licencia antes de abrirlo', estado: 'cola' },
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
];
