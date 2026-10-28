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
//   · Escribir CON IA no entra acá: lo hace el chat de la tab, que muestra la propuesta antes de aceptarla. Por la API
//     se escribe el TEXTO que trae el agente (con las etiquetas de sección en MAYÚSCULA, el contrato de la casa).
//   · Reemplazar el contenido entero es `pantalla` (texto libre largo que pisa la versión anterior, como
//     editar_texto_guion_anuncio) y exige la `version` que se leyó: si alguien lo cambió en el medio, no se aplica.
//   · Mientras el Copywriter sea sólo del super admin, la API también: cada runner pregunta la puerta de la tab
//     (lib/copywriter/puerta-api.ts, `veCopywriterEnApi`). Se abre junto con la de la pantalla (app/copywriter/acceso.ts).
// SIN server-only y sin importar valores de módulos que lo tengan (lo importan los tests y el generador de la referencia).
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';
import { TIPOS_GUION } from '@/lib/copywriter/tipos';

const TODOS = ['whatsapp', 'app', 'http'] as const;
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
    descripcion: 'Los documentos del Copywriter del negocio (un documento por guion de ad, reel, story o YouTube): id, título, tipo, de qué documento cuelga y cuándo se tocó. Úsalo para encontrar el documentoId antes de leer o escribir en uno. Los de la Papelera no vienen salvo que se pidan.',
    parametros: [
      { nombre: 'tipo', tipo: 'string', enum: TIPOS_GUION, descripcion: 'Sólo los de ese tipo (ad, reel, story, youtube).' },
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
    descripcion: 'Crea un documento nuevo en el Copywriter: un guion de ad, reel, story o YouTube, con su título y, si se pasa, el texto ya escrito o la estructura de la biblioteca (que arma sus secciones vacías). Puede colgar de otro documento. Devuelve su id. Queda pendiente hasta que la persona confirme.',
    parametros: [
      { nombre: 'titulo', tipo: 'string', obligatorio: true, max: 200, descripcion: 'El título del documento.' },
      { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: TIPOS_GUION, descripcion: 'ad, reel, story o youtube.' },
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
];
