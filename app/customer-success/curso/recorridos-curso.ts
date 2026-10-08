// =============================================================================
// recorridos-curso — los DOS recorridos de la tab Curso: el del curso y el de una clase
// =============================================================================
// Pedido de Martín (08/10/2026), sobre el recorrido que reemplazó a «Configura tu curso»:
//   · item 1: «El tutorial también debe estar al ingresar a editar una clase, allí, al ingresar
//     debería saltar otro tutorial».
//   · item 19: «Revisa que los tutoriales faltó explicar muchas cosas».
//
// Son DATOS PUROS (sin React): los monta ./CursoApp.tsx con app/_ui/Recorrido.tsx, y
// tests/curso-recorridos.test.ts comprueba que cada `objetivo` sea un `data-recorrido` que existe en el
// fuente. Un paso cuyo objetivo no está EN PANTALLA se saltea solo (lib/recorridos.ts): el del curso
// se escribe para la pantalla llena, y en el índice no muestra los pasos de las clases (no hay una
// abierta) ni en un módulo los del índice. Por eso el «?» cuenta lo que hay donde se lo aprieta.
//
// Quién pone cada objetivo en la pantalla (si uno falta, su paso se saltea y nada se rompe):
//   · el dibujo (app/_cursos/CursoUgc.tsx): marca, titulo, portada, nuevo-modulo, modulo
//   · esta tab (./CursoApp.tsx, la barra de arriba): vista-alumno, invitar, ayuda
//   · el editor de la estructura: menu-modulo, menu-clase, barra-modulos, nueva-clase
//   · la clase (./LeccionEditable.tsx, ./TareaEditor.tsx y el dibujo): leccion-titulo, leccion-video,
//     leccion-disposicion, leccion-descripcion, leccion-tarea, leccion-nuevo-campo, leccion-campo,
//     leccion-guardar (la barra de «Guardar», audio del 08/10/2026)
//   · el editor rico (app/_ui/EditorRico.tsx): editor-barra, editor-imagen, editor-tabla,
//     editor-adjuntar, editor-insertar, editor-mas
//
// ⚠️ TEXTOS CORTOS (una o dos frases) y de TÚ: es texto de pantalla (AGENTS.md). El porqué de cada
//    control va en su código, no en la tarjeta.
// ⚠️ LOS IDS SON LA CLAVE DE «YA LO VIO», por persona (`/api/recorridos`): no se cambian. El del curso
//    sigue siendo `cs-curso` aunque creció: quien ya lo vio lo vuelve a abrir con el «?».

import type { PasoRecorrido } from '@/lib/recorridos';

export const RECORRIDO_CURSO = 'cs-curso';
export const RECORRIDO_LECCION = 'cs-curso-leccion';

/** El paso del «?», el último de los dos: cómo volver a verlo es lo que queda al cerrarlo. */
const PASO_AYUDA: PasoRecorrido = { objetivo: 'ayuda', titulo: 'Vuelve a verla', texto: 'Esta guía está siempre en el ?.' };

/**
 * EL DEL CURSO: lo que hay en la tab, en el orden en que se recorre la pantalla (la marca, la barra de
 * arriba, la portada, los módulos, la barra de módulos y, adentro de uno, sus clases).
 */
export const PASOS_RECORRIDO: PasoRecorrido[] = [
  // Desde el audio del 08/10/2026 el menú de la marca también crea un producto (item 17) y prende los
  // comentarios de las clases (item 13): se nombran acá, que es el único paso que apunta a ese menú.
  { objetivo: 'marca', titulo: 'Tu curso', texto: 'Cambia de curso o crea otro, su color, su fuente y los comentarios.', lado: 'derecha' },
  { objetivo: 'vista-alumno', titulo: 'Vista del alumno', texto: 'Mira el curso como lo ve tu cliente.' },
  { objetivo: 'invitar', titulo: 'Invita alumnos', texto: 'Tus clientes o alguien nuevo.' },
  { objetivo: 'titulo', titulo: 'El nombre del curso', texto: 'Haz clic para cambiarlo.' },
  { objetivo: 'portada', titulo: 'La portada', texto: 'Cambia su imagen con el botón Portada.' },
  { objetivo: 'nuevo-modulo', titulo: 'Nuevo módulo', texto: 'Escribe su nombre. Por defecto crea su etapa en el kanban.' },
  { objetivo: 'modulo', titulo: 'Tus módulos', texto: 'Arrástralos para ordenarlos. Clic en el nombre para renombrar.', lado: 'derecha' },
  { objetivo: 'menu-modulo', titulo: 'Opciones del módulo', texto: 'Portada, acceso público o privado, etapa del kanban y eliminar.' },
  { objetivo: 'barra-modulos', titulo: 'La barra de módulos', texto: 'Suelta una clase sobre un módulo para moverla ahí.', lado: 'derecha' },
  { objetivo: 'nueva-clase', titulo: 'Nueva clase', texto: 'Créala y edítala en su lugar.' },
  { objetivo: 'menu-clase', titulo: 'Opciones de la clase', texto: 'Renombrar, portada, mover, acceso y si es obligatoria.' },
  PASO_AYUDA,
];

/**
 * EL DE UNA CLASE: se abre la primera vez que alguien entra a editar una, y con el «?» desde adentro de
 * una clase. De arriba abajo: el título, el video, dónde va el texto, la descripción con su barra, la
 * tarea con sus campos, y el menú de la clase.
 */
export const PASOS_RECORRIDO_LECCION: PasoRecorrido[] = [
  { objetivo: 'leccion-titulo', titulo: 'El título', texto: 'Haz clic para cambiarlo.' },
  // «El link o el código»: Panda se pega con su código (item 14 del 08/10/2026, lib/embeds.ts).
  { objetivo: 'leccion-video', titulo: 'El video', texto: 'Haz clic y pega el link o el código.' },
  { objetivo: 'leccion-disposicion', titulo: 'Dónde va el texto', texto: 'Al costado del video o abajo, en todo el curso.' },
  { objetivo: 'leccion-descripcion', titulo: 'La descripción', texto: 'Escribe como en un documento.' },
  { objetivo: 'editor-barra', titulo: 'El formato', texto: 'Títulos, negritas, listas y enlaces.' },
  { objetivo: 'editor-imagen', titulo: 'Imágenes', texto: 'Súbelas y ajusta su tamaño.' },
  { objetivo: 'editor-tabla', titulo: 'Tablas', texto: 'Agrega una tabla al texto.' },
  { objetivo: 'editor-adjuntar', titulo: 'Archivos', texto: 'Adjunta un PDF u otro archivo.' },
  // «Insertar» (item 15 del audio del 08/10/2026, 24:30: «que lo pueda embeber cosas como… el Calendar»):
  // un video o una agenda adentro del texto, por link o por su código (app/_ui/EditorRico.tsx, lib/embeds.ts).
  // El botón estaba en la pantalla y sin paso: la pista VIDEO lo dejó anotado y lo enchufó la revisión final.
  { objetivo: 'editor-insertar', titulo: 'Insertar', texto: 'Un video o una agenda, con su link o su código.' },
  // Con el texto al costado del video (lo de siempre), Imagen, Tabla, Archivos e Insertar no entran en la
  // barra y sus pasos se saltean (no están en la pantalla): éste es el único que los nombra (revisión final
  // del editor). Condicional a propósito: con la barra ancha también es cierto.
  { objetivo: 'editor-mas', titulo: 'Más opciones', texto: 'Si no ves Imagen, Tabla o Insertar, están aquí.' },
  { objetivo: 'leccion-tarea', titulo: 'La tarea', texto: 'Lo que completa el alumno, debajo de la descripción.' },
  { objetivo: 'leccion-nuevo-campo', titulo: 'Nuevo campo', texto: 'Agrega una pregunta y elige su tipo, también de la comunidad.' },
  // El texto de ejemplo (item 5) es nuevo y no se ve hasta escribirlo: se nombra acá (revisión final).
  { objetivo: 'leccion-campo', titulo: 'Cada pregunta', texto: 'Arriba la pregunta y abajo un ejemplo opcional. Arrástrala para ordenarla.' },
  // ⚠️ La clase se GUARDA A MANO desde el audio del 08/10/2026 (item 1, 14:30: «prefiero que haya un botón que
  //    me obligue a guardar de forma manual»): el paso de la barra, el último antes del menú, porque es lo que
  //    cierra lo que se hizo arriba. Y «Obligatoria» ya no es un paso de la tarea: vive en el menú «…» de la
  //    clase (item 7, 13:00), así que lo nombra el paso del menú.
  { objetivo: 'leccion-guardar', titulo: 'Guardar', texto: 'Los cambios se guardan con este botón. Ctrl+Z deshace.' },
  { objetivo: 'menu-clase', titulo: 'Opciones de la clase', texto: 'Renombrar, portada, mover, acceso y si es obligatoria.' },
  PASO_AYUDA,
];
