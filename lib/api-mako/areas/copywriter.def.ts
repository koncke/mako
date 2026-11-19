// =============================================================================
// api-mako/areas/copywriter.def — los guiones del Copywriter en la API de MaKo (definiciones; área `contenido`)
// =============================================================================
// Martín (25/10/2026): «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API». El
// Copywriter (docs/diseno-copywriter.md, D8) copia el juego de herramientas del servidor MCP de mila.gg sobre sus
// documentos: list_documents → listar, get_document → leer, create_document → crear, append_to_document → agregar,
// update_document → reemplazar y renombrar, delete_document → Papelera (con su restaurar: reversible EN la API).
//
// Del área `contenido` y en su propio archivo (como el editor del Dashboard en `metricas`): va AL FINAL del área, y sus
// ids, títulos y descripciones usan «documento» y «Copywriter», nunca «guion de anuncio», para no sacarle el lugar a
// las del Ads Writer en el turno de WhatsApp (AGENTS.md, «Una operación nueva va AL FINAL de su área…»).
//
// Decisiones:
//   · Escribir CON IA (29/10/2026, «Copywriter = Notion», D13): `editar_documento_copywriter` hace por la API lo MISMO
//     que «Editar» en el chat de la página: MaKo lee la página y devuelve sus herramientas (lib/copywriter/operaciones.ts).
//     Se prepara con la IA (la propuesta se ve en el resumen) y al confirmar se aplica sobre lo de AHORA, por id: lo que
//     se borró en el medio se descarta. El TEXTO que trae el agente sigue entrando por crear/agregar/reemplazar.
//   · «Nueva» con templates (D12): `listar_plantillas_copywriter` y `plantillaId` al crear.
//   · Reemplazar el contenido entero es `pantalla` (texto libre largo que pisa la versión anterior, como
//     editar_texto_guion_anuncio) y exige la `version` que se leyó: si alguien lo cambió en el medio, no se aplica.
//   · Mientras el Copywriter sea sólo del super admin, la API también: cada runner pregunta la puerta de la tab
//     (lib/copywriter/puerta-api.ts, `veCopywriterEnApi`). Se abre junto con la de la pantalla (app/copywriter/acceso.ts).
// SIN server-only y sin importar valores de módulos que lo tengan (lo importan los tests y el generador de la referencia).
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';
import { TIPOS_GUION } from '@/lib/copywriter/tipos';
import { TIPOS_PEGADO, TOPE_PEGADO } from '@/lib/copywriter/pegado';

const TODOS = ['whatsapp', 'app', 'http'] as const;
const TIPOS = TIPOS_GUION.join(', ');
const G = { tab: 'copywriter', rolMinimo: 'admin' } as const;

const DOC: Parametro = { nombre: 'documentoId', tipo: 'string', obligatorio: true, max: 20, descripcion: 'id del documento del Copywriter («g» + letras y números). Sale de listar_documentos_copywriter.', ejemplo: 'gk3h9s0a2bq' };
const TEXTO: Parametro = {
  nombre: 'texto', tipo: 'string', obligatorio: true, max: 20000,
  descripcion: 'El texto del guion. Cada etiqueta de sección en MAYÚSCULA en su propio renglón abre esa sección (GANCHO, PROBLEMA, CTA…); «- » es una viñeta, «1. » una numerada, «# » un encabezado.',
  ejemplo: 'GANCHO\nSi cada lunes arrancas sin saber de dónde sale tu próximo cliente…\nCTA\nToca el botón y agenda.',
};

export const DEFS: readonly OperacionDef[] = [
  {
    id: 'listar_documentos_copywriter', area: 'contenido', tipo: 'lectura',
    titulo: 'Documentos del Copywriter',
    descripcion: 'Los documentos del Copywriter del negocio (cada documento es una página, como en Notion: guiones de anuncios, reels, stories, YouTube y VSL, emails, posts o páginas en blanco): id, título, tipo, de qué documento cuelga y cuándo se tocó. Úsalo para encontrar el documentoId antes de leer o escribir en uno. Los de la Papelera no vienen salvo que se pidan.',
    parametros: [
      { nombre: 'tipo', tipo: 'string', enum: TIPOS_GUION, descripcion: `Sólo los de ese tipo (${TIPOS}).` },
      { nombre: 'conPapelera', tipo: 'boolean', descripcion: 'true incluye los de la Papelera (marcados).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G,
  },
  {
    id: 'leer_documento_copywriter', area: 'contenido', tipo: 'lectura',
    titulo: 'Leer un documento del Copywriter',
    descripcion: 'Un documento del Copywriter entero: título, propiedades (tipo, ángulo, estructura, duración), su versión, el texto con las etiquetas de sección y cada bloque con su id. La versión se copia tal cual para reemplazar_documento_copywriter.',
    parametros: [DOC],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G,
  },
  {
    id: 'crear_documento_copywriter', area: 'contenido', tipo: 'accion',
    titulo: 'Crear un documento en el Copywriter',
    descripcion: 'Crea un documento nuevo en el Copywriter (una página): con su título y, si se pasa, el texto ya escrito, un template de «Nueva» (listar_plantillas_copywriter: arma sus secciones) o la estructura de la biblioteca. Puede colgar de otro documento. Devuelve su id. Queda pendiente hasta que la persona confirme.',
    parametros: [
      { nombre: 'titulo', tipo: 'string', obligatorio: true, max: 200, descripcion: 'El título del documento.' },
      { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: TIPOS_GUION, descripcion: `${TIPOS}. Con plantillaId, manda el del template.` },
      { nombre: 'plantillaId', tipo: 'string', max: 60, descripcion: 'id de un template de «Nueva» (listar_plantillas_copywriter): la página nace con su tipo, su estructura y sus secciones si no viene texto.' },
      { nombre: 'estructuraId', tipo: 'string', max: 60, descripcion: 'id de una estructura de la biblioteca (catalogo_estructuras_guion): arma sus secciones vacías si no viene texto.' },
      { ...TEXTO, obligatorio: false },
      { nombre: 'padreId', tipo: 'string', max: 20, descripcion: 'documentoId del documento del que cuelga (opcional).' },
    ],
    confirmacion: 'chat', reversible: true,
    escribe: 'agrega un documento al Copywriter (app_settings mako.copywriter.indice y mako.copywriter.doc.<id>)',
    canales: TODOS, costo: 'gratis', gating: G,
  },
  {
    id: 'agregar_al_documento_copywriter', area: 'contenido', tipo: 'accion',
    titulo: 'Agregar al documento del Copywriter',
    descripcion: 'Agrega texto AL FINAL de un documento del Copywriter, sin tocar lo que ya tiene (las etiquetas de sección en MAYÚSCULA abren secciones nuevas). Para cambiar lo escrito, reemplazar_documento_copywriter. Queda pendiente hasta que la persona confirme.',
    parametros: [DOC, TEXTO],
    confirmacion: 'chat', reversible: false,
    escribe: 'agrega bloques al final del documento (app_settings mako.copywriter.doc.<id>)',
    canales: TODOS, costo: 'gratis', gating: G,
  },
  {
    id: 'reemplazar_documento_copywriter', area: 'contenido', tipo: 'accion',
    titulo: 'Reemplazar un documento del Copywriter',
    descripcion: 'Reemplaza TODO el texto de un documento del Copywriter por el que se pasa. La versión anterior se pierde. Exige la versión que se leyó (leer_documento_copywriter): si el documento cambió desde entonces, no se aplica. Deja un link para revisar y confirmar.',
    parametros: [DOC, { nombre: 'version', tipo: 'number', entero: true, obligatorio: true, minimo: 1, descripcion: 'La versión del documento tal como se leyó (leer_documento_copywriter).' }, TEXTO],
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    escribe: 'reemplaza el contenido del documento (app_settings mako.copywriter.doc.<id>)',
    canales: TODOS, costo: 'gratis', gating: G,
  },
  {
    id: 'renombrar_documento_copywriter', area: 'contenido', tipo: 'accion',
    titulo: 'Renombrar un documento del Copywriter',
    descripcion: 'Le cambia el título a un documento del Copywriter. Se puede volver a cambiar. Queda pendiente hasta que la persona confirme.',
    parametros: [DOC, { nombre: 'titulo', tipo: 'string', obligatorio: true, max: 200, descripcion: 'El título nuevo.' }],
    confirmacion: 'chat', reversible: true,
    escribe: 'cambia el título en el índice del Copywriter (app_settings mako.copywriter.indice)',
    canales: TODOS, costo: 'gratis', gating: G,
  },
  {
    id: 'papelera_documento_copywriter', area: 'contenido', tipo: 'accion',
    titulo: 'Documento del Copywriter a Papelera',
    descripcion: 'Manda un documento del Copywriter a la Papelera (con lo que cuelga de él, que deja de verse). No se borra: vuelve con restaurar_documento_copywriter. Queda pendiente hasta que la persona confirme.',
    parametros: [DOC],
    confirmacion: 'chat', reversible: true,
    escribe: 'marca el documento como en la Papelera en el índice del Copywriter',
    canales: TODOS, costo: 'gratis', gating: G,
  },
  {
    id: 'restaurar_documento_copywriter', area: 'contenido', tipo: 'accion',
    titulo: 'Restaurar un documento del Copywriter',
    descripcion: 'Saca un documento del Copywriter de la Papelera: vuelve a su lugar, o al principio si el documento del que colgaba ya no está. Queda pendiente hasta que la persona confirme.',
    parametros: [DOC],
    confirmacion: 'chat', reversible: true,
    escribe: 'saca la marca de Papelera en el índice del Copywriter',
    canales: TODOS, costo: 'gratis', gating: G,
  },
  // ── Compartir para editar (28/10/2026, docs/diseno-copywriter.md, D9): leer los links, crear uno, revocarlo ──
  // Por la API se crea el link ABIERTO (el que se pega en un chat); invitar por mail queda en la pantalla.
  {
    id: 'enlaces_documento_copywriter', area: 'contenido', tipo: 'lectura',
    titulo: 'Links para editar un documento',
    descripcion: 'Los links que dejan EDITAR un documento del Copywriter sin cuenta: id del link, si es abierto o de invitados (con sus emails), cuántas veces se abrió y la última, y si está revocado. El link en sí no se puede volver a leer: se ve en la pantalla («Compartir para editar») o se crea otro.',
    parametros: [DOC],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G,
  },
  {
    id: 'compartir_documento_copywriter', area: 'contenido', tipo: 'accion',
    titulo: 'Compartir un documento para editar',
    descripcion: 'Crea un link que deja EDITAR un documento del Copywriter sin cuenta (el cliente entra y lo corrige): cualquiera con el link escribe en el documento, y lo que guarda queda marcado con su nombre en «Última edición». Devuelve el link. Se corta con revocar_enlace_copywriter. Queda pendiente hasta que la persona confirme.',
    parametros: [DOC],
    confirmacion: 'chat', reversible: true,
    escribe: 'crea un link para editar el documento (tabla shares, recurso copywriter, permiso editar)',
    canales: TODOS, costo: 'gratis', gating: G,
  },
  {
    id: 'revocar_enlace_copywriter', area: 'contenido', tipo: 'accion',
    titulo: 'Revocar un link del Copywriter',
    descripcion: 'Corta un link para editar un documento del Copywriter (el id sale de enlaces_documento_copywriter): deja de abrir al instante, también para quien ya lo tenía abierto. No se puede deshacer; para volver a compartir se crea otro. Queda pendiente hasta que la persona confirme.',
    parametros: [{ nombre: 'enlaceId', tipo: 'number', entero: true, obligatorio: true, minimo: 1, descripcion: 'id del link (de enlaces_documento_copywriter).' }],
    confirmacion: 'chat', reversible: false,
    escribe: 'marca el link como revocado (tabla shares)',
    canales: TODOS, costo: 'gratis', gating: G,
  },
  // ── «Copywriter = Notion» (29/10/2026, D12 y D13): los templates de «Nueva» y MaKo escribiendo EN la página ──
  {
    id: 'listar_plantillas_copywriter', area: 'contenido', tipo: 'lectura',
    titulo: 'Templates del Copywriter',
    descripcion: 'Los templates de «Nueva» del Copywriter («¿Qué vas a crear hoy?»): anuncio a cámara, testimonio, copy para Meta con 3 ángulos, 10 ganchos, Reel, stories, carrusel, email de cierre, 5 emails tras una descarga, VSL, clase gratuita, YouTube de 12 minutos y página en blanco. Cada uno con su id, tipo, cuándo usarlo, qué secciones arma y su ejemplo (de un negocio ficticio: muestra la forma, sus datos no se usan). El id va en plantillaId de crear_documento_copywriter, que crea las secciones vacías.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G,
  },
  {
    id: 'editar_documento_copywriter', area: 'contenido', tipo: 'accion',
    titulo: 'MaKo escribe en un documento del Copywriter',
    descripcion: 'MaKo escribe o edita EN un documento del Copywriter lo que se le pide («mejora el gancho», «agrega una sección de preguntas frecuentes», «acórtalo»), como «Editar» en el chat de la página: lee el documento, escribe con la voz y el método del negocio, y la propuesta se ve en el resumen. Al confirmar se aplica sobre lo de AHORA (lo que se borró en el medio se descarta). Para pegar un texto ya escrito, agregar_al_documento_copywriter o reemplazar_documento_copywriter. Queda pendiente hasta que la persona confirme.',
    parametros: [DOC, { nombre: 'instruccion', tipo: 'string', obligatorio: true, max: 4000, descripcion: 'Qué escribir o cambiar, en las palabras de la persona.', ejemplo: 'Mejora el gancho y agrega una sección de preguntas frecuentes.' }],
    confirmacion: 'chat', reversible: false,
    escribe: 'cambia los bloques del documento (app_settings mako.copywriter.doc.<id>) y, si MaKo lo propone, el título o las propiedades',
    canales: TODOS, costo: 'ia', gating: G, lenta: true,
  },
  // ── Los outliers de copy (11/11/2026, docs/diseno-copywriter.md D18): leerlos y replicar uno ──
  {
    id: 'outliers_copywriter', area: 'contenido', tipo: 'lectura',
    titulo: 'Outliers de copy para replicar',
    descripcion: 'Los anuncios, reels, carruseles y videos de YouTube que mejor funcionaron de las cuentas que el negocio sigue en Competitors Spy (y de la biblioteca de carruseles de MaKo), con su texto: el guion si ya se transcribió, si no el pie, la descripción o el copy del anuncio. Cada uno con su gancho, cuántas veces superó a su cuenta (el «×») o sus días al aire, su link, de qué tema habla, en qué idioma está y si es del tema del negocio (temaDelNegocio dice cuál es). El outlierId va a replicar_outlier_copywriter. No lee nada nuevo ni gasta: es lo que Spy ya trajo.',
    parametros: [
      { nombre: 'formato', tipo: 'string', enum: ['anuncio', 'reel', 'carrusel', 'youtube'], descripcion: 'Sólo los de ese formato.' },
      { nombre: 'buscar', tipo: 'string', max: 120, descripcion: 'Texto o @creador a buscar en el gancho y el texto.' },
      { nombre: 'deTuTema', tipo: 'boolean', descripcion: 'true = sólo los del tema del negocio (o de uno vecino), como «De tu tema» de la portada. Lo del idioma del negocio va primero y lo que está en inglés, después.' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 50, descripcion: 'Cuántos devolver (default 12, del que más superó a su cuenta al que menos).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G,
  },
  {
    id: 'replicar_outlier_copywriter', area: 'contenido', tipo: 'accion',
    titulo: 'Replicar un outlier en el Copywriter',
    descripcion: 'Crea en el Copywriter una página para replicar un outlier de copy (de outliers_copywriter): del tipo del original (anuncio, reel, post o YouTube), vacía y atada al original. Al abrirla, MaKo transcribe el original si es un video, pregunta para qué oferta (y lo que le falte a esa oferta, que guarda en ella) y, si el tema no tiene que ver, cómo usarlo; después la escribe entera con la estructura, el tipo de gancho y el ritmo del original, nunca con sus frases. Devuelve el documentoId y su link. Queda pendiente hasta que la persona confirme.',
    parametros: [{ nombre: 'outlierId', tipo: 'string', obligatorio: true, max: 40, descripcion: 'El id del outlier («spy:123» o «biblioteca:-45»), de outliers_copywriter.', ejemplo: 'spy:1234' }],
    confirmacion: 'chat', reversible: true,
    escribe: 'agrega un documento al Copywriter (app_settings mako.copywriter.indice y mako.copywriter.doc.<id>)',
    canales: TODOS, costo: 'gratis', gating: G,
  },
  // ── Replicar lo que TRAE la persona: un link o un texto (14/11/2026, lib/copywriter/pegado.ts) ──
  {
    id: 'replicar_link_o_texto_copywriter', area: 'contenido', tipo: 'accion',
    titulo: 'Replicar un link o texto',
    descripcion: 'Como replicar_outlier_copywriter, pero con lo que trae la persona: un link de YouTube (se transcribe con el Gemini del negocio), el link de una landing (su texto y, si su VSL está en YouTube, lo que se dice en él; si está en Panda, Vimeo o Wistia, se replica con el texto de la página y se dice) o el texto pegado (un guion, una secuencia de historias). De Instagram no se trae el video desde el link: hay que pasar su texto. Crea la página vacía del tipo elegido, atada a ese original; al abrirla MaKo pregunta para qué oferta y la escribe entera. Devuelve el documentoId y su link. Queda pendiente hasta que la persona confirme.',
    parametros: [
      { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: TIPOS_PEGADO, descripcion: 'Qué es: reel, story (una secuencia de historias), youtube, vsl, ad (anuncio) o post (carrusel). Es la página en que se replica.' },
      { nombre: 'texto', tipo: 'string', obligatorio: true, max: TOPE_PEGADO, descripcion: 'Un link SOLO (YouTube o la landing de un VSL) o el texto a replicar.', ejemplo: 'https://www.youtube.com/watch?v=t7-__IAeEu8' },
    ],
    confirmacion: 'chat', reversible: true,
    escribe: 'guarda el original (app_settings mako.copywriter.original.<n>) y agrega un documento al Copywriter (mako.copywriter.indice y mako.copywriter.doc.<id>)',
    canales: TODOS, costo: 'gratis', gating: G, lenta: true,
  },
];
