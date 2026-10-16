// =============================================================================
// api-mako/areas/imagen.def — las operaciones del área `imagen` (el Image Editor, definiciones)
// =============================================================================
// El Image Editor (la copia de Canva, tab Content Machine › Image). Declarado el 15/10/2026, el día que se abrió
// a todos los workspaces: mientras era sólo del super admin, declararlo con el permiso de siempre lo habría abierto
// por token a cualquier cliente (docs/editor-imagen/relevamiento-integracion-mako.md §6.2).
//
// Lo que la API NO puede hacer: dibujar. El render (PNG, PDF) vive en el navegador y no hay renderer de server;
// las operaciones devuelven el LINK al editor. Tampoco sube imágenes: eso pide el navegador (firmar → subir).
//
// Todas llevan `tab: 'image-editor'` y `rolMinimo: 'admin'`: es el requireRolWs([], { nav: 'image-editor' }) de la
// página (app/image-editor/acceso.ts). SIN server-only: lo importan los tests y el generador de la referencia.
// Español neutro (lo lee el cliente).
// =============================================================================

import type { OperacionDef, Gating } from '../tipos';
import { TAMANOS_API } from '@/lib/image-editor/tamanos';

const GATING: Gating = { tab: 'image-editor', rolMinimo: 'admin' };
const TODOS = ['whatsapp', 'app', 'http'] as const;
const ID = { nombre: 'disenoId', tipo: 'string', obligatorio: true, max: 36, descripcion: 'El id del diseño (de listar_disenos_imagen).', ejemplo: '0b9e5f4c-1a2b-4c3d-8e9f-0a1b2c3d4e5f' } as const;

export const DEFS: readonly OperacionDef[] = [
  {
    id: 'listar_disenos_imagen', area: 'imagen', tipo: 'lectura',
    titulo: 'Ver los diseños del Image Editor',
    descripcion: 'Lista los diseños del Image Editor del negocio (lo que en Canva sería «Proyectos»), del más nuevo al más viejo: título, tamaño, páginas, cuándo se editó y el link para abrirlo. Úsala cuando pregunten por sus diseños o antes de cambiar uno.',
    parametros: [
      { nombre: 'buscar', tipo: 'string', max: 80, descripcion: 'Una palabra del título, para filtrar.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'ver_diseno_imagen', area: 'imagen', tipo: 'lectura',
    titulo: 'Ver los textos de un diseño',
    descripcion: 'Un diseño del Image Editor: título, tamaño y los TEXTOS de cada página, en orden (sin estilos ni posiciones), más el link para abrirlo. Úsala antes de cambiar_textos_diseno_imagen, para pasar los textos tal como están.',
    parametros: [ID],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'listar_plantillas_imagen', area: 'imagen', tipo: 'lectura',
    titulo: 'Ver las plantillas del Image Editor',
    descripcion: 'Las plantillas del Image Editor: slug, título, categoría, tamaño y páginas, primero las sugeridas para este negocio (con su porqué en "sugerida"). Un diseño nuevo puede empezar de una (crear_diseno_imagen con `plantilla`).',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'crear_diseno_imagen', area: 'imagen', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear un diseño en el Image Editor',
    descripcion: 'Propone crear un diseño en el Image Editor: en blanco, de un tamaño con nombre o a medida, o a partir de una plantilla (con sus textos de ejemplo; después se cambian con cambiar_textos_diseno_imagen). Devuelve el link para abrirlo. No dibuja ni descarga: eso se hace en el editor.',
    parametros: [
      { nombre: 'titulo', tipo: 'string', max: 200, descripcion: 'El título del diseño. Si se omite, «Diseño sin título».' },
      { nombre: 'plantilla', tipo: 'string', max: 80, descripcion: 'El slug de una plantilla (listar_plantillas_imagen). Si viene, manda sobre el tamaño.' },
      { nombre: 'tamano', tipo: 'string', enum: Object.keys(TAMANOS_API), descripcion: 'Un tamaño con nombre. Si no viene ni plantilla ni ancho y alto, publicacion_instagram.' },
      { nombre: 'ancho', tipo: 'number', entero: true, minimo: 16, maximo: 8000, descripcion: 'Ancho a medida, en px (con alto).' },
      { nombre: 'alto', tipo: 'number', entero: true, minimo: 16, maximo: 8000, descripcion: 'Alto a medida, en px (con ancho).' },
    ],
    canales: TODOS, costo: 'gratis', gating: GATING,
    reversible: true,
    escribe: 'insert en image_disenos',
  },
  {
    id: 'cambiar_textos_diseno_imagen', area: 'imagen', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Cambiar textos de un diseño',
    descripcion: 'Propone reemplazar textos de un diseño del Image Editor: cada texto `actual` (tal como lo devuelve ver_diseno_imagen; no distingue mayúsculas) pasa a ser `nuevo`, en todas las páginas, conservando su estilo. Si un texto no está, lo dice y no inventa dónde ponerlo.',
    parametros: [
      ID,
      {
        nombre: 'cambios', tipo: 'object[]', obligatorio: true, max: 50, descripcion: 'Los reemplazos.',
        campos: [
          { nombre: 'actual', tipo: 'string', obligatorio: true, max: 2000, descripcion: 'El texto que está hoy.' },
          { nombre: 'nuevo', tipo: 'string', obligatorio: true, max: 2000, descripcion: 'El texto que va.' },
        ],
      },
    ],
    canales: TODOS, costo: 'gratis', gating: GATING,
    reversible: true,
    escribe: 'update del doc de image_disenos (compare-and-set por versión)',
  },
  {
    id: 'duplicar_diseno_imagen', area: 'imagen', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Hacer una copia de un diseño',
    descripcion: 'Propone hacer una copia de un diseño del Image Editor, con «(copia)» en el título. Devuelve el link de la copia.',
    parametros: [ID],
    canales: TODOS, costo: 'gratis', gating: GATING,
    reversible: true,
    escribe: 'insert en image_disenos',
  },
  {
    id: 'borrar_diseno_imagen', area: 'imagen', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Eliminar un diseño',
    descripcion: 'Propone eliminar un diseño del Image Editor: sale de la lista del editor y de esta API. Se confirma en pantalla.',
    parametros: [ID],
    canales: TODOS, costo: 'gratis', gating: GATING,
    reversible: false,
    escribe: 'marca borrado_at en image_disenos',
  },
];
