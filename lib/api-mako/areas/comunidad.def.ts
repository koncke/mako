// =============================================================================
// api-mako / comunidad — la comunidad de cada producto (posts, comentarios, eventos)
// =============================================================================
// Pedido de Martín (08/10/2026): «También falta la comunidad…» — lo que la tab
// /customer-success/comunidad deja hacer, para que un Claude con un token lo haga por la API.
//
// SÓLO POR HTTP, como el área «curso»: lo que se publica lo leen los alumnos de un producto, así
// que no hay un «sí» de WhatsApp en el medio que tenga sentido.
//
// Decisiones, y por qué:
//   · LO QUE SE PUBLICA SALE FIRMADO POR UNA PERSONA DEL EQUIPO, nunca por «MaKo»: la columna `miembro`
//     sólo acepta `u:N` / `l:N` (CHECK de la 0217) y un post sin cara sería un autor inventado. Firma la
//     persona que confirma en la bandeja o en /mako/revisar, o la que creó el token detallado (cuando el
//     registro la pase en el Ctx). Sin persona, esas acciones fallan con el motivo: no inventan una.
//   · LEER, MODERAR Y CONFIGURAR NO NECESITAN PERSONA: corren con un actor neutral del equipo
//     (`CLAVE_API`, comunidad.helpers.ts) que no figura en ningún lado y no puede quedar escrito.
//   · LOS HILOS DE UNA CLASE (mig 0227) son de esta área (su código vive en lib/comunidad-datos.ts):
//     se leen con ver_comentarios_clase_comunidad y se contestan con las de post y comentario.
//   · NINGUNA LECTURA DEVUELVE UNA URL FIRMADA de un adjunto, ni lo que es de quien mira (meGusta, puedo*).
//   · NO SE EXPONEN: subir un adjunto (pide un PUT del navegador al bucket), prender los comentarios de las
//     clases (es un ajuste del CURSO) ni nada del portal del alumno.
//   · `-` VACÍA un campo opcional al editar: el validador trata "" como «no vino».
//
// SIN `server-only` y sin importar valores de módulos con `server-only` (AGENTS.md, regla 6 de la API):
// los topes salen de los módulos PUROS de la comunidad, los mismos que usa la pantalla. El del motivo de
// un baneo es privado de lib/comunidad-moderacion.ts (server-only): va copiado, y el test lo compara.
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';
import {
  TOPE_TITULO, TOPE_CUERPO, TOPE_COMENTARIO, TOPE_OPCION, MIN_OPCIONES, MAX_OPCIONES, TOPE_CATEGORIA,
  MAX_CATEGORIAS, MAX_FIJADOS, MAX_MENCIONES, TOPE_BIO, TOPE_UBICACION, TOPE_LINK, TOPE_DESCRIPCION_CORTA,
  TOPE_NOMBRE_COMUNIDAD, TOPE_ABOUT, TOPE_REGLAS, PAGINA_FEED, MIN_BUSQUEDA, ORDENES_FEED, REDES,
} from '@/lib/comunidad-reglas';
import { NIVEL_MAX, TOPE_NOMBRE_NIVEL } from '@/lib/comunidad-niveles';
import {
  TOPE_TITULO_EVENTO, TOPE_DESCRIPCION_EVENTO, TOPE_LUGAR, TOPE_DIRECCION, DURACION_MIN, DURACION_MAX,
  CADA_MAX_EVENTO, VECES_MAX, FRECUENCIAS,
} from '@/lib/comunidad-eventos';
import { VACIAR } from './comunidad.helpers';

const HTTP = ['http'] as const;
/** La tab vive en Customer Success: la misma capa que pide la página (`requireCapa('customer-success')`). */
const GATING = { tab: 'customer-success' } as const;
/** Configurar la comunidad (categorías, niveles, ajustes) es de un admin: `puedeConfigurar`. */
const GATING_ADMIN = { tab: 'customer-success', rolMinimo: 'admin' } as const;

/** El motivo de un baneo: el tope de lib/comunidad-moderacion.ts (privado ahí; el test lo compara). */
export const TOPE_MOTIVO_API = 300;
/** Lo que dura un evento si no se dice (la vista lo lee así de una fila sin duración). */
export const DURACION_DEFAULT_API = 60;

const FIRMA = 'Se publica FIRMADO por la persona del equipo que lo confirma en MaKo (o la que creó el token): sin una persona, no se publica.';

// ── Parámetros que se repiten ─────────────────────────────────────────────────────

const productoId: Parametro = {
  nombre: 'productoId', tipo: 'number', obligatorio: true, entero: true, minimo: 1,
  descripcion: 'id del producto cuya comunidad se toca (de listar_comunidades).',
};
const postId: Parametro = {
  nombre: 'postId', tipo: 'number', obligatorio: true, entero: true, minimo: 1,
  descripcion: 'id del post (de listar_posts_comunidad, buscar_en_comunidad o ver_comentarios_clase_comunidad).',
};
const comentarioId: Parametro = {
  nombre: 'comentarioId', tipo: 'number', obligatorio: true, entero: true, minimo: 1,
  descripcion: 'id del comentario (de ver_post_comunidad o ver_comentarios_clase_comunidad).',
};
const claseId: Parametro = {
  nombre: 'claseId', tipo: 'number', obligatorio: true, entero: true, minimo: 1,
  descripcion: 'id de la clase del curso (de ver_curso).',
};
const categoriaIdObligatorio: Parametro = {
  nombre: 'categoriaId', tipo: 'number', obligatorio: true, entero: true, minimo: 1,
  descripcion: 'id de la categoría (de ver_comunidad: `categorias[].id`).',
};
const eventoId: Parametro = {
  nombre: 'eventoId', tipo: 'number', obligatorio: true, entero: true, minimo: 1,
  descripcion: 'id del evento (de ver_calendario_comunidad: `eventos[].id`).',
};
const leadId: Parametro = {
  nombre: 'leadId', tipo: 'number', obligatorio: true, entero: true, minimo: 1,
  descripcion: 'el número de la clave `l:N` del alumno (de listar_miembros_comunidad o listar_sacados_comunidad).',
};
const menciones: Parametro = {
  nombre: 'menciones', tipo: 'string[]', max: MAX_MENCIONES,
  descripcion: 'las claves (`u:N` o `l:N`, de listar_miembros_comunidad) de quienes el texto nombra como `@Nombre`. Solo cuentan (y reciben aviso) los miembros que el texto nombra de verdad.',
};
const orden: Parametro = {
  nombre: 'ordenDefault', tipo: 'string', enum: ORDENES_FEED,
  descripcion: 'cómo se ordena el feed al elegir la categoría: default (actividad reciente), nuevos, top_semana o top_mes.',
};
const alcanceEvento: Parametro = {
  nombre: 'alcance', tipo: 'string', enum: ['este', 'siguientes', 'todos'],
  descripcion: 'sólo en una SERIE: este (sólo la ocurrencia), siguientes (esta y las que siguen) o todos (la serie entera; es el default). Con este o siguientes, `ocurrencia` es obligatoria.',
};
const ocurrencia: Parametro = {
  nombre: 'ocurrencia', tipo: 'string', max: 10,
  descripcion: 'la fecha YYYY-MM-DD de la ocurrencia elegida (de ver_calendario_comunidad: `ocurrencias[].fecha`).',
};

/** Los campos de un evento. Al crear, título, fecha y hora son obligatorios; al editar, ninguno. */
function camposEvento(crear: boolean): Parametro[] {
  return [
    { nombre: 'titulo', tipo: 'string', obligatorio: crear || undefined, max: TOPE_TITULO_EVENTO, descripcion: `el título (hasta ${TOPE_TITULO_EVENTO} letras).` },
    { nombre: 'descripcion', tipo: 'string', max: TOPE_DESCRIPCION_EVENTO, descripcion: `qué es y qué hay que llevar, en texto plano (hasta ${TOPE_DESCRIPCION_EVENTO} letras).${crear ? '' : ` «${VACIAR}» la vacía.`}` },
    {
      nombre: 'fecha', tipo: 'string', obligatorio: crear || undefined, max: 10,
      descripcion: crear
        ? 'la fecha de la primera vez, YYYY-MM-DD, en la zona del evento.'
        : 'la fecha nueva, YYYY-MM-DD. En una serie, sin esto queda la de la ocurrencia elegida; con alcance todos, mover la fecha corre la serie entera los mismos días.',
    },
    { nombre: 'hora', tipo: 'string', obligatorio: crear || undefined, max: 5, descripcion: 'la hora de inicio HH:MM (24 h), en la zona del evento.' },
    { nombre: 'zona', tipo: 'string', max: 60, descripcion: `la zona horaria IANA (America/Mexico_City, America/Argentina/Buenos_Aires).${crear ? ' Sin esto, la de la comunidad (o la del negocio).' : ''}` },
    { nombre: 'duracionMin', tipo: 'number', entero: true, minimo: DURACION_MIN, maximo: DURACION_MAX, descripcion: `cuánto dura, en minutos (${DURACION_MIN} a ${DURACION_MAX}).${crear ? ` Sin esto, ${DURACION_DEFAULT_API}.` : ''}` },
    { nombre: 'lugarTipo', tipo: 'string', enum: ['link', 'direccion'], descripcion: 'link (una videollamada) o direccion (un lugar físico). Por default, link.' },
    { nombre: 'lugar', tipo: 'string', max: TOPE_LUGAR, descripcion: `el link de la llamada (https) o la dirección (hasta ${TOPE_DIRECCION} letras). Sólo lo ven los alumnos que entran al evento.${crear ? '' : ` «${VACIAR}» lo saca.`}` },
    { nombre: 'portada', tipo: 'string', max: 600, descripcion: `la portada: un degradado del catálogo (\`grad:<id>\`) o el link https de una imagen de un origen permitido. Una que no va se rechaza.${crear ? '' : ` «${VACIAR}» la saca.`}` },
    {
      nombre: 'acceso', tipo: 'object',
      descripcion: `quién entra (los demás ven el título y la hora, no el lugar). Por default, todos.${crear ? '' : ' Si se pasa, REEMPLAZA la regla entera.'}`,
      campos: [
        { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: ['todos', 'nivel', 'modulo'], descripcion: 'todos, desde un nivel de la comunidad, o quien tiene un módulo del curso.' },
        { nombre: 'nivel', tipo: 'number', entero: true, minimo: 2, maximo: NIVEL_MAX, descripcion: `con tipo nivel: desde qué nivel (2 a ${NIVEL_MAX}).` },
        { nombre: 'clave', tipo: 'string', max: 120, descripcion: 'con tipo modulo: la clave del módulo (de ver_calendario_comunidad: `opciones.modulos[].clave`).' },
      ],
    },
    {
      nombre: 'recurrencia', tipo: 'object',
      descripcion: crear
        ? 'si se repite. Sin esto, es un evento suelto.'
        : 'la repetición. Si se pasa, REEMPLAZA la regla entera; frecuencia «nunca» deja de repetir.',
      campos: [
        { nombre: 'frecuencia', tipo: 'string', obligatorio: true, enum: crear ? FRECUENCIAS : [...FRECUENCIAS, 'nunca'], descripcion: `cada cuánto: ${FRECUENCIAS.join(', ')}${crear ? '' : ', o nunca'}.` },
        { nombre: 'cada', tipo: 'number', entero: true, minimo: 1, maximo: CADA_MAX_EVENTO, descripcion: `cada cuántos días, semanas o meses (1 a ${CADA_MAX_EVENTO}). Por default, 1.` },
        { nombre: 'dias', tipo: 'string[]', max: 7, enum: ['0', '1', '2', '3', '4', '5', '6'], descripcion: 'semanal: qué días, como textos ("1" = lunes … "0" = domingo). El día de la fecha se suma solo.' },
        {
          nombre: 'fin', tipo: 'object', descripcion: 'cuándo termina. Por default, nunca.',
          campos: [
            { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: ['nunca', 'fecha', 'veces'], descripcion: 'nunca, en una fecha, o después de N veces.' },
            { nombre: 'fecha', tipo: 'string', max: 10, descripcion: 'con tipo fecha: la última fecha, YYYY-MM-DD.' },
            { nombre: 'veces', tipo: 'number', entero: true, minimo: 1, maximo: VECES_MAX, descripcion: `con tipo veces: cuántas (1 a ${VECES_MAX}).` },
          ],
        },
      ],
    },
  ];
}

export const DEFS: readonly OperacionDef[] = [
  // ── La comunidad ────────────────────────────────────────────────────────────────
  {
    id: 'listar_comunidades', area: 'comunidad', tipo: 'lectura',
    titulo: 'Listar las comunidades',
    descripcion: 'Los productos de Customer Success de este negocio (los mismos del selector de la tab Comunidad), cada uno con su productoId y el nombre de su comunidad. Empieza por aquí para conseguir el productoId. Un producto con `error` no está vacío: no se pudo leer.',
    parametros: [],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'ver_comunidad', area: 'comunidad', tipo: 'lectura',
    titulo: 'Ver una comunidad',
    descripcion: 'La cabecera y el About de la comunidad de un producto: nombre, descripción corta, texto del About, reglas, categorías (id, nombre, quién publica, orden por defecto), desde qué nivel publican los alumnos, la zona del calendario, los nombres de los 9 niveles, cuántos miembros hay (y en línea, y del equipo) y el top 5 de los últimos 30 días. Un conteo en null es «no se pudo leer», no cero.',
    parametros: [productoId],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'estado_onboarding_comunidad', area: 'comunidad', tipo: 'lectura',
    titulo: 'Onboarding de la Comunidad',
    descripcion: 'Los pasos del onboarding de la tab Comunidad (las categorías, el primer post, que un alumno participe): cuáles están marcados y cuándo, qué dicen los datos de cada uno (null = no se pudo leer), cuáles faltan y si la línea del onboarding sigue a la vista. Es del negocio entero (todas sus comunidades). No escribe nada.',
    parametros: [],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },

  // ── Posts: leer ─────────────────────────────────────────────────────────────────
  {
    id: 'listar_posts_comunidad', area: 'comunidad', tipo: 'lectura',
    titulo: 'Listar los posts del feed',
    descripcion: `Una página del feed de una comunidad (${PAGINA_FEED} posts): en la página 0 van primero los fijados. Cada post trae su id, título, extracto, autor (clave, nombre, nivel, si es del equipo), categoría, fecha, likes, cuántos comentarios, si está cerrado, el video, la encuesta con sus resultados y el adjunto (nombre y tipo, sin link). Filtra por categoría y ordena como el feed. hayMas dice si hay otra página.`,
    parametros: [
      productoId,
      { nombre: 'categoriaId', tipo: 'number', entero: true, minimo: 1, descripcion: 'sólo los de esta categoría (de ver_comunidad).' },
      { nombre: 'orden', tipo: 'string', enum: ORDENES_FEED, descripcion: 'default (actividad reciente: el post o su último comentario), nuevos, top_semana o top_mes (por likes).' },
      { nombre: 'pagina', tipo: 'number', entero: true, minimo: 0, maximo: 500, descripcion: 'desde 0.' },
    ],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'ver_post_comunidad', area: 'comunidad', tipo: 'lectura',
    titulo: 'Ver un post y sus comentarios',
    descripcion: 'Un post entero (el texto, a quién menciona, el video, la encuesta con los ids de sus opciones `o1`…`o10`, el adjunto sin link) y su hilo de comentarios en dos niveles (id, a quién responde, autor, texto, fecha, likes, respuestas). Sirve también para el hilo de una clase: su postId lo da ver_comentarios_clase_comunidad (y `claseId` dice de qué clase es).',
    parametros: [postId],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'buscar_en_comunidad', area: 'comunidad', tipo: 'lectura',
    titulo: 'Buscar en la comunidad',
    descripcion: `Busca un texto en el título y el cuerpo de los posts (sin mayúsculas ni acentos; hasta 20, los más nuevos primero; sin los hilos de las clases) y en los nombres de los miembros (hasta 8). Con menos de ${MIN_BUSQUEDA} letras no busca. Mira los 200 posts más nuevos que coinciden: en una búsqueda muy común, lo más viejo no aparece.`,
    parametros: [productoId, { nombre: 'q', tipo: 'string', obligatorio: true, max: 60, descripcion: 'lo que se busca.' }],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },

  // ── Posts: escribir ─────────────────────────────────────────────────────────────
  {
    id: 'publicar_post_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Publicar un post',
    descripcion: `Publica un post en el feed de una comunidad: título, texto, y si se quiere un video (YouTube, Vimeo o Loom) y una encuesta de ${MIN_OPCIONES} a ${MAX_OPCIONES} opciones (que después no se edita). Si la comunidad tiene categorías, la categoría es obligatoria. Avisa a los mencionados y el autor queda siguiendo el post. ${FIRMA} Devuelve el id del post en \`datos.postId\`.`,
    parametros: [
      productoId,
      { nombre: 'titulo', tipo: 'string', obligatorio: true, max: TOPE_TITULO, descripcion: `el título (hasta ${TOPE_TITULO} letras).` },
      { nombre: 'cuerpo', tipo: 'string', max: TOPE_CUERPO, descripcion: `el texto, plano (hasta ${TOPE_CUERPO} letras). Los links se vuelven clicables; para nombrar a alguien, \`@Nombre\` más su clave en menciones.` },
      { nombre: 'categoriaId', tipo: 'number', entero: true, minimo: 1, descripcion: 'la categoría (de ver_comunidad). Obligatoria si la comunidad tiene categorías.' },
      { nombre: 'videoUrl', tipo: 'string', max: 600, descripcion: 'el link de un video de YouTube, Vimeo o Loom.' },
      menciones,
      { nombre: 'encuesta', tipo: 'string[]', max: MAX_OPCIONES, descripcion: `las opciones de una encuesta, de ${MIN_OPCIONES} a ${MAX_OPCIONES}, cada una hasta ${TOPE_OPCION} letras y sin repetir. La pregunta va en el título o el texto.` },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    escribe: 'un post en la comunidad (comunidad_posts), que el autor sigue (comunidad_seguimientos), y los avisos a los mencionados (comunidad_notificaciones)',
  },
  {
    id: 'editar_post_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Editar un post propio',
    descripcion: `Cambia el título, el texto, la categoría, el video o las menciones de un post. Sólo lo edita quien lo escribió (la persona que firma tiene que ser la autora). La encuesta y el adjunto no se editan, ni el hilo de una clase. Lo que no se pasa queda igual; «${VACIAR}» en cuerpo o videoUrl lo vacía. Avisa sólo a las menciones nuevas.`,
    parametros: [
      postId,
      { nombre: 'titulo', tipo: 'string', max: TOPE_TITULO, descripcion: `el título nuevo (hasta ${TOPE_TITULO} letras).` },
      { nombre: 'cuerpo', tipo: 'string', max: TOPE_CUERPO, descripcion: `el texto nuevo (hasta ${TOPE_CUERPO} letras). «${VACIAR}» lo vacía.` },
      { nombre: 'categoriaId', tipo: 'number', entero: true, minimo: 1, descripcion: 'la categoría nueva (de ver_comunidad).' },
      { nombre: 'videoUrl', tipo: 'string', max: 600, descripcion: `el video nuevo (YouTube, Vimeo o Loom). «${VACIAR}» lo saca.` },
      { ...menciones, vaciaEsValor: true, descripcion: `${menciones.descripcion} Si se pasa, REEMPLAZA la lista; [] las saca todas.` },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    escribe: 'el título, el texto, la categoría, el video y las menciones del post (comunidad_posts), y los avisos a las menciones nuevas',
  },
  {
    id: 'borrar_post_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Borrar un post',
    descripcion: 'Moderación: borra un post de cualquiera, con sus comentarios, likes y votos (esos puntos se les van a sus autores) y su adjunto. No se puede deshacer. El hilo de una clase no se borra entero: se borran sus comentarios uno por uno (borrar_comentario_comunidad) o se cierran.',
    parametros: [postId],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    escribe: 'borra el post (comunidad_posts) y, en cascada, sus comentarios, likes y votos; y su archivo del bucket',
  },
  {
    id: 'fijar_post_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Fijar o soltar un post',
    descripcion: `Fija un post arriba del feed (hasta ${MAX_FIJADOS} por comunidad) o lo suelta. Con los ${MAX_FIJADOS} lugares ocupados, dice cuáles están fijados para soltar uno antes. El hilo de una clase no se fija.`,
    parametros: [postId, { nombre: 'fijado', tipo: 'boolean', obligatorio: true, descripcion: 'true fija, false suelta.' }],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'fija o suelta el post (comunidad_posts.fijado_at)',
  },
  {
    id: 'cerrar_comentarios_post_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Cerrar o abrir los comentarios',
    descripcion: 'Moderación: cierra los comentarios de un post o del hilo de una clase (lo que ya está se sigue viendo; no comenta nadie, tampoco el equipo) o los vuelve a abrir.',
    parametros: [postId, { nombre: 'cerrados', tipo: 'boolean', obligatorio: true, descripcion: 'true cierra, false abre.' }],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'cierra o abre los comentarios del post (comunidad_posts.comentarios_cerrados_at)',
  },
  {
    id: 'seguir_post_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Seguir o dejar un post',
    descripcion: 'La persona del equipo que firma empieza a seguir un post o el hilo de una clase (le llegan a su campana los comentarios nuevos) o lo deja de seguir. Necesita una persona: la que confirma en MaKo o la que creó el token.',
    parametros: [postId, { nombre: 'seguir', tipo: 'boolean', obligatorio: true, descripcion: 'true sigue, false deja de seguir.' }],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'anota o borra el seguimiento de esa persona (comunidad_seguimientos)',
  },
  {
    id: 'votar_encuesta_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Votar en una encuesta',
    descripcion: 'La persona del equipo que firma vota (o cambia su voto) en la encuesta de un post. La opción es su id (`o1`…`o10`, de ver_post_comunidad). Ojo: el voto del equipo cuenta en el resultado que ven los alumnos.',
    parametros: [postId, { nombre: 'opcion', tipo: 'string', obligatorio: true, max: 3, descripcion: 'el id de la opción (o1, o2…).' }],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'el voto de esa persona en la encuesta (comunidad_votos)',
  },
  {
    id: 'cambiar_like_post_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Dar o sacar like a un post',
    descripcion: 'La persona del equipo que firma da o saca su like a un post (nunca a uno propio). Un like es un punto para el autor, y el nivel de un alumno puede abrirle clases del curso: úsala sólo si te lo piden. Avisa al autor sólo con un like nuevo.',
    parametros: [postId, { nombre: 'meGusta', tipo: 'boolean', obligatorio: true, descripcion: 'true da el like, false lo saca.' }],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'el like de esa persona (comunidad_likes) y, si es nuevo, el aviso al autor',
  },

  // ── Comentarios ─────────────────────────────────────────────────────────────────
  {
    id: 'comentar_post_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Comentar o responder',
    descripcion: `Comenta un post o responde a un comentario (dos niveles: responder a una respuesta la cuelga del mismo hilo). Sirve para contestar dentro del hilo de una clase con su postId. Avisa a quien se le contestó, a los mencionados y a quienes siguen el post, y lo sube en «Recientes». ${FIRMA} Devuelve el id en \`datos.comentarioId\`.`,
    parametros: [
      postId,
      { nombre: 'cuerpo', tipo: 'string', obligatorio: true, max: TOPE_COMENTARIO, descripcion: `el texto (hasta ${TOPE_COMENTARIO} letras).` },
      { nombre: 'responderA', tipo: 'number', entero: true, minimo: 1, descripcion: 'el id del comentario al que responde (de ver_post_comunidad). Sin esto, comenta en el primer nivel.' },
      menciones,
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'un comentario (comunidad_comentarios), la actividad del post y los avisos (comunidad_notificaciones)',
  },
  {
    id: 'editar_comentario_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Editar un comentario propio',
    descripcion: 'Cambia el texto (y las menciones) de un comentario. Sólo lo edita quien lo escribió: la persona que firma tiene que ser la autora. Avisa sólo a las menciones nuevas.',
    parametros: [
      comentarioId,
      { nombre: 'cuerpo', tipo: 'string', obligatorio: true, max: TOPE_COMENTARIO, descripcion: `el texto nuevo (hasta ${TOPE_COMENTARIO} letras).` },
      { ...menciones, vaciaEsValor: true, descripcion: `${menciones.descripcion} Si se pasa, REEMPLAZA la lista; [] las saca todas. Sin esto quedan las que tenía.` },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'el texto y las menciones del comentario (comunidad_comentarios)',
  },
  {
    id: 'borrar_comentario_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Borrar un comentario',
    descripcion: 'Moderación: borra un comentario de cualquiera, con sus respuestas (también en el hilo de una clase). No se puede deshacer.',
    parametros: [comentarioId],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    escribe: 'borra el comentario (comunidad_comentarios) y, en cascada, sus respuestas y sus likes',
  },
  {
    id: 'cambiar_like_comentario_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Dar o sacar like a un comentario',
    descripcion: 'La persona del equipo que firma da o saca su like a un comentario (nunca a uno propio), también en el hilo de una clase. Un like es un punto para el autor, y el nivel de un alumno puede abrirle clases del curso: úsala sólo si te lo piden.',
    parametros: [comentarioId, { nombre: 'meGusta', tipo: 'boolean', obligatorio: true, descripcion: 'true da el like, false lo saca.' }],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'el like de esa persona (comunidad_likes) y, si es nuevo, el aviso al autor',
  },

  // ── Los comentarios de una clase ────────────────────────────────────────────────
  {
    id: 'ver_comentarios_clase_comunidad', area: 'comunidad', tipo: 'lectura',
    titulo: 'Ver los comentarios de una clase',
    descripcion: 'El hilo de comentarios de una clase del curso (dos niveles), si está cerrado, su postId (null = nadie comentó todavía) y si el curso tiene los comentarios de las clases prendidos (apagados, los alumnos no los ven). Para responder, likear, editar o borrar dentro del hilo se usan las de post y comentario con ese postId.',
    parametros: [claseId],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'comentar_clase_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Comentar una clase',
    descripcion: `Comenta una clase del curso en el primer nivel: si es el primer comentario abre su hilo (y quien lo abre lo sigue). Para responder dentro del hilo, comentar_post_comunidad con su postId y responderA. Con los comentarios de las clases apagados se comenta igual y ningún alumno lo ve. ${FIRMA} Devuelve \`datos.comentarioId\` y \`datos.postId\`.`,
    parametros: [
      claseId,
      { nombre: 'cuerpo', tipo: 'string', obligatorio: true, max: TOPE_COMENTARIO, descripcion: `el texto (hasta ${TOPE_COMENTARIO} letras).` },
      menciones,
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'el hilo de la clase si no existía (comunidad_posts con clase_id), el comentario (comunidad_comentarios) y los avisos',
  },

  // ── Configurar: categorías, niveles, About y ajustes ────────────────────────────
  {
    id: 'crear_categoria_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Crear una categoría',
    descripcion: `Agrega una categoría al final de los chips del feed: nombre (hasta ${TOPE_CATEGORIA} letras, sin repetir otra), quién publica ahí y su orden por defecto. Hasta ${MAX_CATEGORIAS} por comunidad. Ojo: con la PRIMERA categoría, publicar pasa a exigir una. Devuelve el id en \`datos.categoriaId\`.`,
    parametros: [
      productoId,
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: TOPE_CATEGORIA, descripcion: `el nombre (hasta ${TOPE_CATEGORIA} letras).` },
      { nombre: 'permiso', tipo: 'string', enum: ['todos', 'equipo'], descripcion: 'quién publica: todos (default) o sólo el equipo.' },
      orden,
    ],
    canales: HTTP, costo: 'gratis', gating: GATING_ADMIN,
    confirmacion: 'chat', reversible: true,
    escribe: 'una categoría al final de la lista (comunidad_categorias)',
  },
  {
    id: 'editar_categoria_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Editar una categoría',
    descripcion: 'Cambia el nombre, quién publica o el orden por defecto de una categoría. Lo que no se pasa queda igual. Pasarla a «equipo» deja a los alumnos sin publicar ahí.',
    parametros: [
      productoId, categoriaIdObligatorio,
      { nombre: 'nombre', tipo: 'string', max: TOPE_CATEGORIA, descripcion: `el nombre nuevo (hasta ${TOPE_CATEGORIA} letras).` },
      { nombre: 'permiso', tipo: 'string', enum: ['todos', 'equipo'], descripcion: 'quién publica: todos o sólo el equipo.' },
      orden,
    ],
    canales: HTTP, costo: 'gratis', gating: GATING_ADMIN,
    confirmacion: 'chat', reversible: true,
    escribe: 'el nombre, el permiso o el orden por defecto de la categoría (comunidad_categorias)',
  },
  {
    id: 'borrar_categoria_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Borrar una categoría',
    descripcion: 'Borra una categoría. Sus posts NO se borran: quedan sin categoría, y volver a crearla no los devuelve a ella.',
    parametros: [productoId, categoriaIdObligatorio],
    canales: HTTP, costo: 'gratis', gating: GATING_ADMIN,
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    escribe: 'borra la categoría (comunidad_categorias); sus posts quedan sin categoría',
  },
  {
    id: 'ordenar_categorias_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Ordenar las categorías',
    descripcion: 'Pone los chips de las categorías en el orden que se pasa: la lista ENTERA de ids, cada una una vez, como textos (["3","1","2"]).',
    parametros: [
      productoId,
      { nombre: 'categoriaIds', tipo: 'string[]', obligatorio: true, max: MAX_CATEGORIAS, descripcion: 'todos los ids de las categorías (de ver_comunidad), como textos, en el orden nuevo.', ejemplo: ['3', '1', '2'] },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING_ADMIN,
    confirmacion: 'chat', reversible: true,
    escribe: 'el orden de las categorías (comunidad_categorias.orden)',
  },
  {
    id: 'nombrar_niveles_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Nombrar los niveles',
    descripcion: `Cambia el nombre de uno o más de los ${NIVEL_MAX} niveles de la comunidad (los demás quedan como están). «${VACIAR}» devuelve un nivel a «Nivel N».`,
    parametros: [
      productoId,
      {
        nombre: 'niveles', tipo: 'object[]', obligatorio: true, max: NIVEL_MAX,
        descripcion: 'qué nivel y su nombre nuevo, uno por ítem.',
        campos: [
          { nombre: 'nivel', tipo: 'number', obligatorio: true, entero: true, minimo: 1, maximo: NIVEL_MAX, descripcion: `el nivel (1 a ${NIVEL_MAX}).` },
          { nombre: 'nombre', tipo: 'string', obligatorio: true, max: TOPE_NOMBRE_NIVEL, descripcion: `el nombre (hasta ${TOPE_NOMBRE_NIVEL} letras); «${VACIAR}» = «Nivel N».` },
        ],
      },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING_ADMIN,
    confirmacion: 'chat', reversible: true,
    escribe: 'los nombres de los niveles (comunidad_ajustes.nombres_nivel)',
  },
  {
    id: 'editar_about_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Editar el About',
    descripcion: `Cambia la portada que leen los alumnos: el nombre de la comunidad, la descripción corta, el texto del About y las reglas, en texto plano. Lo que no se pasa queda igual; «${VACIAR}» en nombre vuelve al del producto, y en los demás los vacía. Lo que había vuelve en \`datos.antes\`.`,
    parametros: [
      productoId,
      { nombre: 'nombre', tipo: 'string', max: TOPE_NOMBRE_COMUNIDAD, descripcion: `el nombre de la comunidad (hasta ${TOPE_NOMBRE_COMUNIDAD} letras).` },
      { nombre: 'descripcion', tipo: 'string', max: TOPE_DESCRIPCION_CORTA, descripcion: `la descripción corta, en una línea (hasta ${TOPE_DESCRIPCION_CORTA} letras).` },
      { nombre: 'texto', tipo: 'string', max: TOPE_ABOUT, descripcion: `el texto del About (hasta ${TOPE_ABOUT} letras).` },
      { nombre: 'reglas', tipo: 'string', max: TOPE_REGLAS, descripcion: `las reglas (hasta ${TOPE_REGLAS} letras).` },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    escribe: 'el nombre, la descripción, el texto y las reglas de la comunidad (comunidad_ajustes)',
  },
  {
    id: 'ajustar_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Ajustar la comunidad',
    descripcion: `Desde qué nivel publican los alumnos (1 = todos; el equipo publica siempre) y la zona horaria por defecto del calendario («${VACIAR}» = la del negocio). Al menos uno de los dos. Subir el nivel deja sin publicar a los alumnos que no llegan.`,
    parametros: [
      productoId,
      { nombre: 'nivelParaPostear', tipo: 'number', entero: true, minimo: 1, maximo: NIVEL_MAX, descripcion: `desde qué nivel publica un alumno (1 a ${NIVEL_MAX}).` },
      { nombre: 'zona', tipo: 'string', max: 60, descripcion: 'la zona IANA del calendario (America/Mexico_City).' },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING_ADMIN,
    confirmacion: 'chat', reversible: true,
    escribe: 'el nivel para publicar y la zona del calendario (comunidad_ajustes)',
  },

  // ── Miembros, ranking y moderación ──────────────────────────────────────────────
  {
    id: 'ver_ranking_comunidad', area: 'comunidad', tipo: 'lectura',
    titulo: 'Ver el ranking',
    descripcion: `Los ${NIVEL_MAX} niveles de una comunidad con su nombre, qué porcentaje de los alumnos está en cada uno y qué abre cada nivel en el curso, y las tablas de los últimos 7 días, 30 días y de siempre (puesto, miembro, puntos). El equipo no figura en el ranking.`,
    parametros: [productoId],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'listar_miembros_comunidad', area: 'comunidad', tipo: 'lectura',
    titulo: 'Listar los miembros',
    descripcion: 'El directorio de una comunidad: el equipo y los alumnos (clave `u:N` o `l:N`, nombre, foto, nivel, si es del equipo, bio, si está en línea, última actividad, desde cuándo), filtrable y buscable por nombre; hasta 300, de la actividad más reciente a la más vieja, con los conteos de la comunidad entera. Da las claves para menciones y ver_miembro_comunidad; en un alumno, el número de `l:N` es su leadId.',
    parametros: [
      productoId,
      { nombre: 'filtro', tipo: 'string', enum: ['todos', 'equipo', 'en_linea'], descripcion: 'todos (default), sólo el equipo o sólo los que están en línea.' },
      { nombre: 'q', tipo: 'string', max: 60, descripcion: 'un pedazo del nombre.' },
    ],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'ver_miembro_comunidad', area: 'comunidad', tipo: 'lectura',
    titulo: 'Ver el perfil de un miembro',
    descripcion: 'El perfil de un miembro de esta comunidad: nombre, nivel y su nombre, puntos, bio, los links que eligió publicar, ubicación, si está en línea y desde cuándo es miembro. Si no es miembro (o lo sacaron), lo dice.',
    parametros: [productoId, { nombre: 'clave', tipo: 'string', obligatorio: true, max: 24, descripcion: 'la clave `u:N` o `l:N` (de listar_miembros_comunidad).' }],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'listar_sacados_comunidad', area: 'comunidad', tipo: 'lectura',
    titulo: 'Listar a quién se sacó',
    descripcion: 'Los alumnos que están fuera de una comunidad (no la ven ni escriben; siguen con su curso), del más reciente al más viejo, con el motivo, desde cuándo y quién lo hizo. Hasta 300.',
    parametros: [productoId],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'sacar_alumno_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Sacar a un alumno',
    descripcion: 'Saca a un alumno de la comunidad, con un motivo: deja de verla y de escribir, pero NO pierde el curso. Con borrarContenido, además borra sus posts y comentarios de los últimos 7 días, sin vuelta atrás (los hilos de las clases no se borran enteros: sólo sus comentarios). Al equipo no se lo saca.',
    parametros: [
      productoId, leadId,
      { nombre: 'motivo', tipo: 'string', max: TOPE_MOTIVO_API, descripcion: `el motivo (hasta ${TOPE_MOTIVO_API} letras). Lo ve el equipo, no el alumno.` },
      { nombre: 'borrarContenido', tipo: 'boolean', descripcion: 'true borra lo que escribió en los últimos 7 días. No se puede deshacer.' },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    escribe: 'el baneo del alumno en la comunidad (comunidad_baneos) y, con borrarContenido, borra sus posts y comentarios de 7 días',
  },
  {
    id: 'admitir_alumno_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Volver a admitir a un alumno',
    descripcion: 'Vuelve a dejar entrar a la comunidad a un alumno que se había sacado (lo que se borró al sacarlo no vuelve).',
    parametros: [productoId, leadId],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'levanta el baneo (comunidad_baneos.levantado_at); la fila se conserva con su fecha',
  },

  // ── El calendario ───────────────────────────────────────────────────────────────
  {
    id: 'ver_calendario_comunidad', area: 'comunidad', tipo: 'lectura',
    titulo: 'Ver el calendario',
    descripcion: 'Los eventos de una comunidad y sus ocurrencias en un rango (hasta 130 días; sin rango, de 7 días atrás a 35 adelante): título, descripción, zona, duración, inicio, fecha y hora locales, la repetición (en texto y la regla), el lugar (link o dirección), la portada, quién entra y si es una ocurrencia movida. Trae además `opciones`: los módulos del curso y la zona por defecto, para crear un evento.',
    parametros: [
      productoId,
      { nombre: 'desde', tipo: 'string', max: 30, descripcion: 'el inicio del rango: YYYY-MM-DD (00:00 UTC) o una fecha ISO.' },
      { nombre: 'hasta', tipo: 'string', max: 30, descripcion: 'el fin del rango (no incluido), igual que desde.' },
    ],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'exportar_evento_ics_comunidad', area: 'comunidad', tipo: 'lectura',
    titulo: 'Exportar un evento (.ics)',
    descripcion: 'El archivo .ics de un evento para un calendario (Google, Outlook, Apple): una ocurrencia (la de `fecha`, o la primera) o la serie entera. Es lo mismo que «Agregar a mi calendario» de la pantalla.',
    parametros: [
      productoId, eventoId,
      { nombre: 'fecha', tipo: 'string', max: 10, descripcion: 'la ocurrencia, YYYY-MM-DD. Sin esto, la primera.' },
      { nombre: 'serie', tipo: 'boolean', descripcion: 'true = la serie entera (si se repite).' },
    ],
    salida: 'texto', canales: HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'crear_evento_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Crear un evento',
    descripcion: 'Crea un evento en el calendario de una comunidad, suelto o que se repite: título, fecha y hora (de pared, en su zona), duración, lugar, portada, quién entra y la repetición. Les aparece a los alumnos y les avisa en la campana 24 h antes. Devuelve el id en `datos.eventoId`.',
    parametros: [productoId, ...camposEvento(true)],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    escribe: 'un evento del calendario (comunidad_eventos)',
  },
  {
    id: 'editar_evento_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Editar un evento',
    descripcion: 'Edita un evento: lo que no se pasa queda igual. En una SERIE, `alcance` dice qué se edita desde la ocurrencia elegida: este (nace un evento suelto que la reemplaza), siguientes (la serie se parte) o todos. Con este o siguientes nace un evento NUEVO: su id vuelve en `datos.eventoId`.',
    parametros: [productoId, eventoId, alcanceEvento, ocurrencia, ...camposEvento(false)],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    escribe: 'el evento (comunidad_eventos); con una serie, puede partirla o crear el reemplazo de una ocurrencia',
  },
  {
    id: 'borrar_evento_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Borrar un evento',
    descripcion: 'Borra un evento del calendario. En una SERIE, `alcance` dice qué se borra desde la ocurrencia elegida: este, siguientes o todos. No se puede deshacer.',
    parametros: [productoId, eventoId, alcanceEvento, ocurrencia],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    escribe: 'borra el evento o parte de la serie (comunidad_eventos)',
  },

  // ── La campana y el perfil de quien firma ───────────────────────────────────────
  {
    id: 'ver_avisos_comunidad', area: 'comunidad', tipo: 'lectura',
    titulo: 'Ver los avisos de la campana',
    descripcion: 'La campana de la persona del equipo que firma, en una comunidad: likes, comentarios, respuestas, menciones y eventos que empiezan en 24 h, agrupados (hasta 40 renglones, con los ids de cada uno) y cuántos sin leer. Necesita una persona (la que creó el token). Al leerla se anotan los avisos de los eventos próximos, como al abrir la campana en MaKo.',
    parametros: [productoId],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'marcar_avisos_leidos_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Marcar avisos leídos',
    descripcion: 'Marca leídos los avisos de la campana de la persona del equipo que firma: los ids de un renglón (de ver_avisos_comunidad, como textos) o todos. Uno de los dos.',
    parametros: [
      productoId,
      { nombre: 'ids', tipo: 'string[]', max: 200, descripcion: 'los ids de los avisos, como textos (["12","13"]).' },
      { nombre: 'todas', tipo: 'boolean', descripcion: 'true marca todos.' },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: false,
    escribe: 'marca leídos los avisos de esa persona (comunidad_notificaciones.leida_at)',
  },
  {
    id: 'editar_perfil_comunidad', area: 'comunidad', tipo: 'accion',
    titulo: 'Editar el perfil propio',
    descripcion: `Cambia la bio, la ubicación y los links públicos de la persona del equipo que firma (el perfil vale en todas las comunidades del negocio). Nadie edita el perfil de otro. Lo que no se pasa queda igual; «${VACIAR}» vacía un campo o saca un link.`,
    parametros: [
      productoId,
      { nombre: 'bio', tipo: 'string', max: TOPE_BIO, descripcion: `la bio (hasta ${TOPE_BIO} letras).` },
      { nombre: 'ubicacion', tipo: 'string', max: TOPE_UBICACION, descripcion: `la ubicación (hasta ${TOPE_UBICACION} letras).` },
      {
        nombre: 'links', tipo: 'object', descripcion: 'los links públicos (http o https). Los que no se pasan quedan como están.',
        campos: REDES.map((red): Parametro => ({ nombre: red, tipo: 'string', max: TOPE_LINK, descripcion: `el link de ${red}.` })),
      },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'el perfil de esa persona en la comunidad (comunidad_perfiles)',
  },
];
