// =============================================================================
// api-mako / curso — el curso de cada producto (Customer Success › Curso), por la API
// =============================================================================
// Pedido de Martín (08/10/2026, audio de feedback del curso, ~05:30): alguien con su curso en
// Panda preguntó «si esto lo puedo conectar por medio de API para que mi Claude lo pueda subir de
// forma automática… si yo tengo que pasar cada uno de estos videos… me va a tardar como una hora y
// media… acá manual me pego un tiro». Martín: «No están las acciones dentro de curso, como agregar
// nueva clase, agregar nuevo lo que sea… tengo que agregar el tema de curso en la API».
//
// Lo que un Claude con un token detallado («Curso: Lectura y escritura») necesita para armar un
// curso entero: leer los cursos, sus módulos y sus clases; crear y ordenar módulos; crear una clase
// con su título, su video por link y su descripción; editarla, moverla y borrarla.
//
// Decisiones, y por qué:
//   · SÓLO POR HTTP. Es la puerta de la migración; por WhatsApp nadie arma un curso de cien clases,
//     y sumarlo al doer es otra decisión. (Salvo las dos lecturas de la estructura, que también salen
//     por la app desde la sexta tanda: ver `LECTURA_APP`.)
//   · UN ÁREA PROPIA y no `cs`: un token para migrar un curso no tiene por qué ver la cartera de
//     clientes. El permiso «Curso» se da solo.
//   · LOS MÓDULOS NUEVOS NACEN SUELTOS. Un módulo VINCULADO es una etapa del kanban de clientes:
//     crearlo agrega una columna (no mueve a nadie), así que va sólo si el pedido lo dice.
//   · NO SE EXPONEN vincular ni borrar módulos, ni mover clientes de etapa: mueven clientes en el
//     kanban, y eso dispara mensajes (la secuencia por etapa del ws1 manda WhatsApp). Pedido del
//     chat de Customer Success (08/10/2026).
//   · LA TAREA Y EL VIDEO POR CÓDIGO EMBED (la misma tarde, cuando el chat de Customer Success subió el
//     modelo nuevo, `dbae4da9`): `videoUrl` acepta también el código `<iframe>` (Panda, Wistia, Bunny),
//     y `tareas` arma la tarea principal y las demás (las `seccion` del modelo). Se escribe por
//     `guardarLeccion`, el mismo camino del botón «Guardar» del editor.
//   · UNA CLASE NUEVA VA AL FINAL de su módulo (el editor la pone al principio, a propósito: la abre
//     para editar). Por la API se crean en orden, y al principio quedarían al revés.
//
// SIN `server-only` y sin importar valores de módulos con `server-only` (AGENTS.md, regla 6 de la
// API). Los topes de abajo son los de lib/html-seguro.ts y de la tab: tests/api-mako-curso.test.ts
// fija que coincidan.
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';

const HTTP = ['http'] as const;
/**
 * LAS DOS LECTURAS DE LA ESTRUCTURA, TAMBIÉN POR LA APP (segunda pasada de la sexta tanda, 09/10/2026):
 * el ✦ de MaKo que redacta un mensaje en el lienzo (lib/mako-redacta.ts, `LECTURAS_REDACTA`) pide
 * `listar_cursos` para escribir sobre el curso, y por la app contestaba 404 y se salteaba. Son lecturas
 * SIN DATOS DE PERSONAS —el nombre del producto, cuántos módulos y clases, los títulos y los links de
 * los videos—: ni alumnos, ni avance, ni accesos (eso es del área `cs`). Por WhatsApp, no: sumarlo al
 * doer es otra decisión. Escribir el curso sigue SÓLO por HTTP.
 */
const LECTURA_APP = ['app', 'http'] as const;
/** La tab del curso vive en Customer Success: la misma capa. Y editar el curso es del admin. */
const GATING = { tab: 'customer-success', rolMinimo: 'admin' } as const;

/** Topes: los mismos que la tab (tests/api-mako-curso.test.ts los compara con su fuente). */
export const TOPE_TITULO_CLASE = 200;
export const TOPE_NOMBRE_MODULO = 40;
export const TOPE_DESCRIPCION_HTML = 100_000;
export const TOPE_DESCRIPCION_TEXTO = 20_000;
/** Los topes de la tarea (lib/curso.ts: MAX_TAREAS, TOPE_TITULO_TAREA, TOPE_PREGUNTA, TOPE_CAMPOS). */
export const MAX_TAREAS_API = 10;
export const TOPE_TITULO_TAREA_API = 140;
export const TOPE_PREGUNTA_API = 400;
export const TOPE_CAMPOS_API = 60;

const productoId: Parametro = {
  nombre: 'productoId', tipo: 'number', obligatorio: true, entero: true, minimo: 1,
  descripcion: 'id del producto cuyo curso se toca (de listar_cursos).',
};
const claseId: Parametro = {
  nombre: 'claseId', tipo: 'number', obligatorio: true, entero: true, minimo: 1,
  descripcion: 'id de la clase (de ver_curso).',
};
const moduloClave: Parametro = {
  nombre: 'moduloClave', tipo: 'string', obligatorio: true, max: 60,
  descripcion: 'la clave del módulo (de ver_curso: `modulos[].clave`), no su nombre.',
};
const videoUrl: Parametro = {
  nombre: 'videoUrl', tipo: 'string', max: 5000,
  descripcion: 'el video: un link (YouTube, Vimeo, Loom, Google Drive, un archivo .mp4/.webm) o el CÓDIGO para insertar que da la plataforma, el `<iframe …>` entero (Panda, Wistia, Bunny y los mismos de antes). Vacío ("") saca el video.',
  ejemplo: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
};
const tareas: Parametro = {
  nombre: 'tareas', tipo: 'object[]', max: MAX_TAREAS_API, vaciaEsValor: true,
  descripcion: 'las tareas de la clase, en orden. La PRIMERA es la principal y va SIN título; cada una de las siguientes lleva `titulo`. Cada tarea tiene su consigna (`consignaHtml` o `consigna` en texto) y sus campos (lo que contesta el alumno). Al editar, REEMPLAZA todas las tareas: pasa la lista entera (ver_clase_curso la devuelve en esta misma forma, con los `id` de los campos; mandarlos conserva las respuestas de los alumnos). Una lista vacía saca la tarea.',
  campos: [
    { nombre: 'titulo', tipo: 'string', max: TOPE_TITULO_TAREA_API, descripcion: 'el título de la tarea (no va en la primera).' },
    { nombre: 'consignaHtml', tipo: 'string', max: TOPE_DESCRIPCION_TEXTO, descripcion: 'qué tiene que hacer el alumno, en HTML.' },
    { nombre: 'consigna', tipo: 'string', max: TOPE_DESCRIPCION_TEXTO, descripcion: 'lo mismo en texto plano (una línea en blanco separa párrafos).' },
    {
      nombre: 'campos', tipo: 'object[]', max: TOPE_CAMPOS_API,
      descripcion: 'lo que contesta el alumno, en orden.',
      campos: [
        { nombre: 'id', tipo: 'string', max: 80, descripcion: 'el id del campo, si ya existía (de ver_clase_curso). Sin id, se reusa el de un campo con la misma pregunta y el mismo tipo, o nace uno.' },
        {
          nombre: 'tipo', tipo: 'string', obligatorio: true,
          enum: ['texto', 'linea', 'numero', 'eleccion', 'checks', 'tabla', 'archivo', 'audio', 'video', 'link', 'escala', 'checklist', 'agenda', 'confirmacion'],
          descripcion: 'texto (párrafo), linea (una línea), numero, eleccion (una opción), checks (varias), tabla, archivo, audio, video, link, escala, checklist (acciones para tildar), agenda (agendar una llamada), confirmacion (un «lo hice»). El quiz y los de la comunidad se arman en MaKo.',
        },
        { nombre: 'label', tipo: 'string', obligatorio: true, max: TOPE_PREGUNTA_API, descripcion: 'la pregunta.' },
        { nombre: 'obligatorio', tipo: 'boolean', descripcion: 'true si hay que contestarlo para enviar.' },
        { nombre: 'ayuda', tipo: 'string', max: 1000, descripcion: 'una aclaración debajo de la pregunta.' },
        { nombre: 'placeholder', tipo: 'string', max: 200, descripcion: 'el texto de ejemplo dentro del cuadro (no la pregunta).' },
        { nombre: 'opciones', tipo: 'string[]', max: 50, descripcion: 'eleccion y checks: las opciones; checklist: las acciones.' },
        { nombre: 'columnas', tipo: 'string[]', max: 20, descripcion: 'tabla: las columnas.' },
        { nombre: 'url', tipo: 'string', max: 2000, descripcion: 'agenda: el link para agendar (Calendly, Cal.com…).' },
        {
          nombre: 'escala', tipo: 'object', descripcion: 'escala: el rango y qué quiere decir cada punta.',
          campos: [
            { nombre: 'min', tipo: 'number', entero: true, minimo: 0, maximo: 1, descripcion: '0 o 1.' },
            { nombre: 'max', tipo: 'number', entero: true, descripcion: '5 o 10.' },
            { nombre: 'bajo', tipo: 'string', max: 60, descripcion: 'qué quiere decir el mínimo.' },
            { nombre: 'alto', tipo: 'string', max: 60, descripcion: 'qué quiere decir el máximo.' },
            { nombre: 'estilo', tipo: 'string', enum: ['numeros', 'deslizador', 'estrellas'], descripcion: 'cómo se contesta (por default, números).' },
          ],
        },
      ],
    },
  ],
};
const descripcionHtml: Parametro = {
  nombre: 'descripcionHtml', tipo: 'string', max: TOPE_DESCRIPCION_HTML,
  descripcion: 'la descripción en HTML (negrita, listas, links, títulos). Se sanea: lo que no es formato se descarta. Usa esto O `descripcion`, no los dos.',
  ejemplo: '<p>En esta clase vas a ver <strong>cómo armar tu oferta</strong>.</p>',
};
const descripcion: Parametro = {
  nombre: 'descripcion', tipo: 'string', max: TOPE_DESCRIPCION_TEXTO,
  descripcion: 'la descripción en texto plano: cada línea en blanco separa un párrafo. Usa esto O `descripcionHtml`, no los dos.',
};
const minutos: Parametro = {
  nombre: 'minutos', tipo: 'number', entero: true, minimo: 0, maximo: 600,
  descripcion: 'cuánto dura la clase, en minutos (0 a 600). Si no lo pasas, lo mide el editor cuando alguien abre el video.',
};

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas ────────────────────────────────────────────────────────────────
  {
    id: 'listar_cursos', area: 'curso', tipo: 'lectura',
    titulo: 'Listar los cursos',
    descripcion: 'Los productos de este negocio que pueden tener curso (los mismos que muestra Customer Success › Curso), con cuántos módulos y clases tiene cada uno. Empieza por aquí para conseguir el productoId.',
    parametros: [],
    salida: 'json', canales: LECTURA_APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'ver_curso', area: 'curso', tipo: 'lectura',
    titulo: 'Ver un curso',
    descripcion: 'El curso de un producto: sus módulos en orden (clave, nombre, si es una etapa del kanban de clientes) y, adentro de cada uno, sus clases en orden (id, título, video, minutos, si tiene descripción y tarea). Las clases sin módulo vienen aparte. Para la descripción entera de una clase, ver_clase_curso.',
    parametros: [productoId],
    salida: 'json', canales: LECTURA_APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'ver_clase_curso', area: 'curso', tipo: 'lectura',
    titulo: 'Ver una clase',
    descripcion: 'Una clase entera: módulo, título, video, minutos, la descripción (HTML y texto plano) y sus tareas, en la misma forma que reciben crear_clase_curso y editar_clase_curso (con los `id` de los campos, para editarlas sin perder las respuestas).',
    parametros: [claseId],
    salida: 'json', canales: HTTP, costo: 'gratis', gating: GATING,
  },

  // ── Módulos ─────────────────────────────────────────────────────────────────
  {
    id: 'crear_modulo_curso', area: 'curso', tipo: 'accion',
    titulo: 'Crear un módulo',
    descripcion: 'Crea un módulo en el curso de un producto, después del módulo `despuesDe` (sin él, al final). Nace SUELTO: una sección del curso que no toca el kanban de clientes. Con vinculado: true es además una etapa nueva del kanban de clientes (no mueve a nadie); úsalo sólo si te lo piden. Devuelve la clave del módulo nuevo en `datos.clave`.',
    parametros: [
      productoId,
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: TOPE_NOMBRE_MODULO, descripcion: `el nombre del módulo (hasta ${TOPE_NOMBRE_MODULO} letras).`, ejemplo: 'Módulo 1: Fundamentos' },
      { nombre: 'despuesDe', tipo: 'string', max: 60, descripcion: 'la clave del módulo después del cual va. Sin esto, al final del curso.' },
      { nombre: 'vinculado', tipo: 'boolean', descripcion: 'true = además es una etapa del kanban de clientes. Por default, false.' },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'agrega un módulo al curso (curso_modulos; si es vinculado, una etapa a la entrega del producto)',
  },
  {
    id: 'renombrar_modulo_curso', area: 'curso', tipo: 'accion',
    titulo: 'Renombrar un módulo',
    descripcion: 'Le cambia el nombre a un módulo. Si el módulo es una etapa del kanban de clientes, la etapa también se renombra (es la misma cosa).',
    parametros: [
      productoId, { ...moduloClave, nombre: 'clave', descripcion: 'la clave del módulo (de ver_curso).' },
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: TOPE_NOMBRE_MODULO, descripcion: `el nombre nuevo (hasta ${TOPE_NOMBRE_MODULO} letras).` },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'cambia el nombre del módulo (o de la etapa del kanban, si es vinculado)',
  },
  {
    id: 'ordenar_modulos_curso', area: 'curso', tipo: 'accion',
    titulo: 'Ordenar los módulos',
    descripcion: 'Pone los módulos del curso en el orden que se pasa: la lista ENTERA de claves, en el orden nuevo. Los vinculados reordenan también el kanban de clientes (sin mover a nadie), y la primera etapa del kanban no se puede mover. Devuelve el orden como quedó.',
    parametros: [
      productoId,
      { nombre: 'claves', tipo: 'string[]', obligatorio: true, max: 200, descripcion: 'todas las claves de los módulos del curso, en el orden nuevo.' },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'reordena los módulos del curso (y el kanban de clientes, si hay vinculados)',
  },

  // ── Clases ──────────────────────────────────────────────────────────────────
  {
    id: 'crear_clase_curso', area: 'curso', tipo: 'accion',
    titulo: 'Crear una clase',
    descripcion: 'Crea una clase AL FINAL de un módulo, con su título y, si los pasas, su video (link o código para insertar), su descripción, sus minutos y sus tareas. Todo se valida antes de crear: si algo no va, no se crea nada. Devuelve el id de la clase en `datos.claseId`. Para migrar un curso, crea las clases en el orden en que tienen que quedar.',
    parametros: [
      productoId, moduloClave,
      { nombre: 'titulo', tipo: 'string', obligatorio: true, max: TOPE_TITULO_CLASE, descripcion: `el título de la clase (hasta ${TOPE_TITULO_CLASE} letras).`, ejemplo: 'Clase 1: Bienvenida' },
      videoUrl, descripcionHtml, descripcion, minutos, tareas,
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'agrega una clase al final del módulo (curso_clases) con su título, video, descripción, minutos y tareas',
  },
  {
    id: 'editar_clase_curso', area: 'curso', tipo: 'accion',
    titulo: 'Editar una clase',
    descripcion: 'Cambia lo que se pase de una clase: título, video (link o código para insertar), descripción, minutos o tareas. Lo que no se pasa queda igual; `tareas` reemplaza TODAS las tareas. Todo se valida antes de escribir, y se escribe de una vez: si otra persona cambió la clase en el medio, se vuelve a leer y se reintenta una vez.',
    parametros: [
      claseId,
      { nombre: 'titulo', tipo: 'string', max: TOPE_TITULO_CLASE, descripcion: `el título nuevo (hasta ${TOPE_TITULO_CLASE} letras).` },
      videoUrl, descripcionHtml, descripcion, minutos, tareas,
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'cambia el título, el video, la descripción, los minutos o las tareas de la clase (curso_clases)',
  },
  {
    id: 'mover_clase_curso', area: 'curso', tipo: 'accion',
    titulo: 'Mover una clase',
    descripcion: 'Lleva una clase a un módulo (el mismo u otro), antes de la clase `antesDe`; sin `antesDe`, al final. Devuelve el orden del módulo como quedó.',
    parametros: [
      claseId, moduloClave,
      { nombre: 'antesDe', tipo: 'number', entero: true, minimo: 1, descripcion: 'id de la clase antes de la cual va. Sin esto, al final del módulo.' },
    ],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'cambia el módulo y el orden de la clase y renumera su módulo (curso_clases)',
  },
  {
    id: 'borrar_clase_curso', area: 'curso', tipo: 'accion',
    titulo: 'Borrar una clase',
    descripcion: 'Manda una clase a la papelera: deja de verse en el curso y en el portal de los alumnos. A los 7 días se borra de verdad, con su avance; hasta entonces restaurar_clase_curso la devuelve como estaba.',
    parametros: [claseId],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'marca la clase como borrada (curso_clases.borrada_at); la purga diaria la borra a los 7 días',
  },
  {
    id: 'restaurar_clase_curso', area: 'curso', tipo: 'accion',
    titulo: 'Restaurar una clase borrada',
    descripcion: 'Saca de la papelera una clase borrada (con borrar_clase_curso o desde MaKo) y la devuelve como estaba, con su video y su lugar. Sólo dentro de los 7 días.',
    parametros: [claseId],
    canales: HTTP, costo: 'gratis', gating: GATING,
    confirmacion: 'chat', reversible: true,
    escribe: 'limpia curso_clases.borrada_at de la clase',
  },
];
