// =============================================================================
// api-mako/areas/creaciones.def — las creaciones publicadas y sus estrellas (definiciones)
// =============================================================================
// Una entrada por operación. SIN server-only y sin importar valores de módulos que lo tengan (lo importan los tests y
// el generador de la referencia). Los cuerpos van en creaciones.run.ts. Español neutro (lo lee el cliente).
//
// Pedido de Martín (13/10/2026, punto 10), textual: «Quiero implementar el sistema de "estrellas" de github en todo
// MaKo... para que los usuarios hagan sus creaciones y otros usuarios puedan puntuarles.» Lo que un negocio crea en
// MaKo (una automatización hoy; un dashboard y los formatos de video e imagen cuando sus pantallas se enchufen,
// lib/creaciones-enchufes.ts) se PUBLICA para todos, los demás le dan una ESTRELLA y la USAN en su negocio.
//
// Las decisiones de esta área:
//   · ÁREA PROPIA, no la de cada feature: un token detallado con escritura en Automations no publica en la galería de
//     todos, y uno de sólo lectura en «creaciones» lee lo publicado sin tocar las automatizaciones del negocio.
//   · Se publica la DEFINICIÓN, nunca los datos del negocio: la arma el código desde la base (sin ids, personas ni
//     cuentas), nunca un JSON que mande quien llama. Por eso publicar_creacion pide el id de la COSA, no su contenido.
//   · Todo es sólo del ADMIN (`rolMinimo`): la pantalla /creaciones hace `requireRolWs([])`. Y ninguna mueve dinero.
//   · Las acciones van por CHAT: son de UNA entidad ya identificada por id, y reversibles (una estrella se saca, una
//     publicación se retira, lo usado nace apagado y se borra). Con un token detallado, en el acto.
// =============================================================================

import type { Gating, OperacionDef, Parametro } from '../tipos';
import { ENCHUFADOS, ORDENES_CREACIONES, TIPOS_CREACION, TOPE_AUTOR_CREACION, TOPE_DESCRIPCION_CREACION, TOPE_TITULO_CREACION } from '../../creaciones-reglas';

const TODOS = ['whatsapp', 'app', 'http'] as const;
const G_ADMIN: Gating = { rolMinimo: 'admin' };

const creacionId = (desc = 'id de la creación (de listar_creaciones o mis_creaciones).'): Parametro =>
  ({ nombre: 'creacionId', rotulo: 'Creación', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: desc });

export const DEFS: readonly OperacionDef[] = [
  {
    id: 'listar_creaciones', area: 'creaciones', tipo: 'lectura',
    titulo: 'Creaciones de la comunidad',
    descripcion: 'La galería de lo que los negocios de MaKo publicaron para los demás (automatizaciones, dashboards, formatos de video y de imagen), con sus estrellas y cuántos negocios la usaron: id, tipo, título, descripción, autor (o «MaKo» si es una plantilla de la plataforma), estrellas, usos, si ya le diste tu estrella, si es tuya y si ya se puede usar. NO trae la definición (eso es ver_creacion) ni datos de ningún negocio. De a 24, la más valorada primero.',
    parametros: [
      { nombre: 'tipo', rotulo: 'Tipo', tipo: 'string', enum: TIPOS_CREACION, descripcion: 'filtra por tipo.' },
      { nombre: 'orden', rotulo: 'Orden', tipo: 'string', enum: ORDENES_CREACIONES, descripcion: 'estrellas (default), usos o recientes.' },
      { nombre: 'q', rotulo: 'Buscar', tipo: 'string', max: 80, descripcion: 'busca en el título y la descripción.' },
      { nombre: 'pagina', rotulo: 'Página', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'la página (de a 24; default 1).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'ver_creacion', area: 'creaciones', tipo: 'lectura',
    titulo: 'Detalle de una creación',
    descripcion: 'UNA creación publicada por su id: tipo, título, descripción, autor, estrellas, usos, si ya le diste tu estrella, si es tuya, y un resumen de lo que trae (su nombre y cuántas tarjetas). Una creación retirada sólo la ve quien la publicó.',
    parametros: [creacionId()],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'mis_creaciones', area: 'creaciones', tipo: 'lectura',
    titulo: 'Lo que publicó tu negocio',
    descripcion: 'Las creaciones que publicó este negocio, publicadas y retiradas, con sus estrellas y sus usos.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'dar_estrella', area: 'creaciones', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Darle una estrella a una creación',
    descripcion: 'PROPONE darle la estrella de este negocio a una creación de otro (como las estrellas de GitHub). Una por negocio: darla dos veces no suma dos. Las tuyas no se pueden puntuar. Se saca con quitar_estrella.',
    escribe: 'agrega la estrella del negocio en `creacion_estrellas` y suma 1 a las estrellas de la creación',
    parametros: [creacionId()],
    canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'quitar_estrella', area: 'creaciones', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Quitarle la estrella a una creación',
    descripcion: 'PROPONE sacarle a una creación la estrella que le dio este negocio.',
    escribe: 'borra la estrella del negocio de `creacion_estrellas` y resta 1 a las estrellas de la creación',
    parametros: [creacionId()],
    canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'publicar_creacion', area: 'creaciones', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Publicar una creación',
    descripcion: `PROPONE publicar para todos los negocios de MaKo algo que creó este negocio. Hoy se publican: ${ENCHUFADOS.join(', ')} (una automatización de Automations, por su id de listar_secuencias_nutricion). Se publica la DEFINICIÓN, sin los datos del negocio: las tarjetas y sus textos (tal cual: que no lleven datos de una persona), sin audios propios (pasan a texto con su guion), archivos, etiquetas, líneas de WhatsApp, emails ni teléfonos. Volver a publicar la misma automatización la ACTUALIZA y conserva sus estrellas. Se retira con retirar_creacion.`,
    escribe: 'crea (o actualiza) la fila de la creación en `creaciones`, visible para todos los negocios',
    parametros: [
      { nombre: 'tipo', rotulo: 'Tipo', tipo: 'string', obligatorio: true, enum: TIPOS_CREACION, descripcion: 'qué se publica. Hoy sólo «automatizacion» se puede publicar.' },
      { nombre: 'origenId', rotulo: 'Qué publicar', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'el id de la cosa en este negocio (una automatización: su id de listar_secuencias_nutricion).' },
      { nombre: 'titulo', rotulo: 'Título', tipo: 'string', max: TOPE_TITULO_CREACION, descripcion: 'cómo se llama en la galería. Sin valor, el nombre de la automatización.' },
      { nombre: 'descripcion', rotulo: 'Descripción', tipo: 'string', max: TOPE_DESCRIPCION_CREACION, descripcion: 'para qué sirve, en una o dos frases.' },
      { nombre: 'autorNombre', rotulo: 'Autor', tipo: 'string', max: TOPE_AUTOR_CREACION, descripcion: 'el nombre con que firma (el del negocio, o el de una persona). Sin valor, «Un negocio de MaKo».' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'retirar_creacion', area: 'creaciones', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Retirar una creación de la galería',
    descripcion: 'PROPONE sacar de la galería una creación que publicó este negocio. No la borra: los negocios que ya la usaron conservan su copia, y volver a publicarla la devuelve. Sólo la retira quien la publicó.',
    escribe: 'marca la creación «retirada» en `creaciones`',
    parametros: [creacionId('id de la creación (de mis_creaciones).')],
    canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'usar_creacion', area: 'creaciones', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Usar una creación en este negocio',
    descripcion: 'PROPONE crear en este negocio una copia de una creación publicada (hoy, una automatización), APAGADA: nace en Automations para revisarla y prenderla. Si su disparador apunta a una etapa que este negocio no tiene, nace sin disparador y lo dice. Cuenta un uso de la creación (uno por negocio).',
    escribe: 'crea la automatización en `nutricion_secuencias` (apagada) y anota el uso en `creacion_usos`',
    parametros: [creacionId()],
    canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
];
