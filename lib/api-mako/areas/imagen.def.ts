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
import { IDS_TIPO_CARRUSEL, ORDENES_CARRUSEL, ORIGENES_CARRUSEL, OUTLIER_MINIMOS, PERIODOS_CARRUSEL, QUE_VER_CARRUSEL, VISTAS_CARRUSEL } from '@/lib/carruseles/opciones';

const GATING: Gating = { tab: 'image-editor', rolMinimo: 'admin' };
/** La biblioteca de ejemplos la edita el admin del negocio de la plataforma (lib/carruseles/biblioteca-servidor.ts). */
const GATING_PLATAFORMA: Gating = { tab: 'image-editor', rolMinimo: 'admin', soloPlataforma: true };
const TODOS = ['whatsapp', 'app', 'http'] as const;
/**
 * Los carruseles que funcionan (4/11/2026) salen de Competitors Spy: dicen a QUIÉN sigue el negocio. Mismo criterio que el
 * área `spy` (lib/api-mako/areas/spy.def.ts): por la app y WhatsApp, SIN `'http'` (un bearer vive en la máquina de un tercero).
 */
const SIN_HTTP = ['whatsapp', 'app'] as const;
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
    descripcion: 'Las plantillas del Image Editor. En "reales", las de MaKo con su ejemplo lleno (los textos de un negocio ficticio); en "plantillas", las de diseño libre, primero las sugeridas para este negocio. Un diseño nuevo puede empezar de una (crear_diseno_imagen con `plantilla`: el id o el slug).',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'crear_diseno_imagen', area: 'imagen', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear un diseño en el Image Editor',
    descripcion: 'Propone crear un diseño en el Image Editor: en blanco, de un tamaño con nombre o a medida, o a partir de una plantilla (con sus textos de ejemplo; después se cambian con cambiar_textos_diseno_imagen). Devuelve el link para abrirlo. No dibuja ni descarga: eso se hace en el editor.',
    parametros: [
      { nombre: 'titulo', tipo: 'string', max: 200, descripcion: 'El título del diseño. Si se omite, «Diseño sin título».' },
      { nombre: 'plantilla', tipo: 'string', max: 80, descripcion: 'El id de una plantilla real o el slug de una de diseño libre (listar_plantillas_imagen). Si viene, manda sobre el tamaño.' },
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
  // ── Los carruseles que funcionan (4/11/2026): al FINAL del área, y sin las palabras de las de arriba (AGENTS.md). ──
  {
    id: 'estado_carruseles', area: 'imagen', tipo: 'lectura',
    titulo: 'En qué paso están los carruseles que funcionan',
    descripcion: 'Cuántas cuentas sigue el negocio en Competitors Spy, cuántas con Instagram y cuántos carruseles hay para mirar; si falta algo, qué hacer ahora y dónde. Úsala antes de buscar_carruseles si no sabes si hay.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'buscar_carruseles', area: 'imagen', tipo: 'lectura',
    titulo: 'Buscar carruseles que funcionan',
    descripcion: 'Los carruseles públicos de las cuentas que el negocio sigue en Competitors Spy y de la biblioteca de ejemplos, con su creador, el link al original y su outlier (cuántas veces lo que suele hacer su cuenta). Busca por tema o por @cuenta. Con que=anuncios, los anuncios que Spy trajo de esas cuentas (con sus días al aire). Con cta, sólo los que piden comentar una palabra.',
    parametros: [
      { nombre: 'buscar', tipo: 'string', max: 120, descripcion: 'Palabras del tema, o un @cuenta.' },
      { nombre: 'outlierMinimo', tipo: 'number', minimo: 0, maximo: 10, descripcion: `El piso del outlier (2 = el doble de lo que suele hacer su cuenta). Se redondea a uno de: ${OUTLIER_MINIMOS.join(', ')}.` },
      { nombre: 'periodo', tipo: 'string', enum: PERIODOS_CARRUSEL.map((x) => x.value), descripcion: 'Publicados en los últimos N días, o cuando sea.' },
      { nombre: 'orden', tipo: 'string', enum: ORDENES_CARRUSEL.map((x) => x.value), descripcion: 'outlier (por defecto), nuevos, viejos, interaccion, traidos o aire (los anuncios que más días llevan).' },
      { nombre: 'vista', tipo: 'string', enum: VISTAS_CARRUSEL.map((x) => x.value), descripcion: 'todos o guardados (semana = publicados en los últimos 7 días).' },
      { nombre: 'que', tipo: 'string', enum: QUE_VER_CARRUSEL.map((x) => x.value), descripcion: 'carruseles (por defecto) o anuncios.' },
      { nombre: 'cta', tipo: 'boolean', descripcion: 'true = sólo los que piden comentar (o mandar por mensaje) una palabra, los que publican los dueños de negocio.' },
      { nombre: 'origen', tipo: 'string', enum: ORIGENES_CARRUSEL.map((x) => x.value), descripcion: 'cuentas (las que sigue), biblioteca (los ejemplos) o todos.' },
      { nombre: 'tope', tipo: 'number', entero: true, minimo: 1, maximo: 30, descripcion: 'Cuántos devolver (10 por defecto).' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'guardar_carrusel', area: 'imagen', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Guardar un carrusel como referencia',
    descripcion: 'Guarda (o saca) un carrusel de buscar_carruseles en las referencias guardadas del negocio.',
    parametros: [
      { nombre: 'carruselId', tipo: 'number', entero: true, obligatorio: true, descripcion: 'El id que dio buscar_carruseles (negativo = de la biblioteca).' },
      { nombre: 'guardar', tipo: 'boolean', descripcion: 'false = sacarlo de los guardados. Por defecto, guardarlo.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: GATING,
    reversible: true,
    escribe: 'app_settings carruseles.guardados (compare-and-set)',
  },
  {
    id: 'crear_carrusel_desde_referencia', area: 'imagen', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear un carrusel desde una referencia',
    descripcion: 'Crea un diseño nuevo con la ESTRUCTURA de un carrusel de buscar_carruseles (tipo, láminas, con qué abre y qué pide al final), nunca sus palabras: cada lámina trae una guía.',
    parametros: [
      { nombre: 'carruselId', tipo: 'number', entero: true, obligatorio: true, descripcion: 'El id que dio buscar_carruseles (negativo = de la biblioteca).' },
      { nombre: 'tipo', tipo: 'string', enum: [...IDS_TIPO_CARRUSEL], descripcion: 'Sin esto, el que se entendió de la referencia. Si no encaja con ninguno, pregúntalo.' },
      { nombre: 'laminas', tipo: 'number', entero: true, minimo: 3, maximo: 12, descripcion: 'Sin esto, las de la referencia (dentro del rango del tipo).' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: GATING,
    reversible: true,
    escribe: 'insert en image_disenos',
  },
  // ── La biblioteca de ejemplos (4/11/2026): la edita sólo el negocio de la plataforma; la ven todos. ──
  {
    id: 'ver_biblioteca_carruseles', area: 'imagen', tipo: 'lectura',
    titulo: 'Ver la biblioteca de ejemplos',
    descripcion: 'Sólo la plataforma: las cuentas de la lista (y las que salieron, con su motivo), los temas (hashtags) y cuántas publicaciones trajo cada uno.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: GATING_PLATAFORMA,
  },
  {
    id: 'cambiar_biblioteca_carruseles', area: 'imagen', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Cambiar la biblioteca de ejemplos',
    descripcion: 'Sólo la plataforma: suma, saca o vuelve a sumar una cuenta (@) o un tema (#). Sacar una cuenta («lo pidió») borra sus publicaciones de todos los negocios.',
    parametros: [
      { nombre: 'que', tipo: 'string', enum: ['cuenta', 'tema'], obligatorio: true, descripcion: 'cuenta (un @) o tema (un #).' },
      { nombre: 'accion', tipo: 'string', enum: ['sumar', 'sacar', 'volver'], obligatorio: true, descripcion: 'sumar, sacar o volver a sumar.' },
      { nombre: 'valor', tipo: 'string', obligatorio: true, max: 80, descripcion: 'El @usuario o el #hashtag.' },
      { nombre: 'nombre', tipo: 'string', max: 120, descripcion: 'Al sumar: cómo se lo nombra.' },
      { nombre: 'motivo', tipo: 'string', max: 300, descripcion: 'Al sacar una cuenta: por qué (por ejemplo, «lo pidió»).' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: GATING_PLATAFORMA,
    reversible: true,
    escribe: 'carruseles_biblioteca_cuentas / _temas (y borra las publicaciones de una cuenta que sale)',
  },
  // ── «Editar» un ejemplo (6/11/2026): al FINAL del área (AGENTS.md: una operación nueva no le saca el lugar a otra). La IA del
  //    negocio replica el diseño con sus textos (lib/carruseles/replica-servidor.ts); sin su IA, sale con guías. ──
  {
    id: 'editar_ejemplo_carrusel', area: 'imagen', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Tu versión editable de un ejemplo',
    descripcion: 'Arma un diseño EDITABLE copiando el diseño de un ejemplo de buscar_carruseles (dónde va cada texto, colores, cuántas láminas) con los textos escritos para el negocio por su propia IA, y su foto donde había una persona. Sus palabras no se copian. Tarda hasta 2 minutos.',
    parametros: [
      { nombre: 'carruselId', tipo: 'number', entero: true, obligatorio: true, descripcion: 'El id que dio buscar_carruseles (negativo = de la biblioteca; también un anuncio).' },
      { nombre: 'pedido', tipo: 'string', max: 400, descripcion: 'Lo que el dueño quiere en especial («sobre mi curso de X»), si lo dijo.' },
    ],
    canales: SIN_HTTP, costo: 'ia', gating: GATING,
    reversible: true,
    escribe: 'insert en image_disenos (y su foto en image_subidos)',
  },
];
