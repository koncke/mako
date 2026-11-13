// =============================================================================
// Las RECETAS de los patrones de edición: cómo se edita y cómo se graba un reel así (PURO; 11/11/2026)
// =============================================================================
// Martín, 11/11/2026: «De la misma manera que hicimos el proceso del video de los pistachos, tener criterio para armar la
// creación, tanto en edición como en grabación, ya sea con avatar de IA o con las instrucciones de grabación para otra persona,
// eligiendo los formatos». Una receta sale de los MEJORES reels de una familia de edición (lib/video-outliers.ts →
// FAMILIAS_EDICION; la clasificación en lib/video-outliers-criterio.ts) y dice tres cosas:
//   · la ESTRUCTURA (los bloques, con sus tiempos medidos en el reel de referencia);
//   · la EDICIÓN, con lo que el editor de MaKo ya hace (subtítulos y sus plantillas, texto, recortes, B-roll, velocidad);
//   · la GRABACIÓN, de dos formas: con el avatar de IA (el método de docs/manual-video-mako.md: imagen → video → voz) o con las
//     instrucciones para que grabe otra persona.
// El modelo es la plantilla «Mensaje para…» (lib/video-plantillas/mensaje-para.ts, el proceso de los pistachos). Una receta todavía
// NO tiene su guía paso a paso en el chat como esa: se lee en la caja del reel (app/video-editor/VerReel.tsx).
// =============================================================================

import type { FamiliaEdicion } from './video-outliers';

export type BloqueReceta = { nombre: string; desde: number; hasta: number; que: string };

/**
 * Lo que el editor de MaKo APLICA de una receta (12/11/2026). Probando la tab Video entera, la «Edición automática» de un
 * proyecto replicado puso sus subtítulos de siempre (claves en lima, del mismo tamaño) y no los de la receta, porque la
 * receta era sólo texto. Esto lo leen la Edición automática (enjambre/plan.ts → decidirPaso) y el chat (lo dice el texto de
 * la receta, `textoDeReceta`).
 */
export type EdicionDeReceta = {
  /** El estilo de los subtítulos: un id de la galería de Subtítulos (app/video-editor/_opencut/subtitles/estilos.ts). */
  subtitulos?: string;
  /** La receta va sin subtítulos: la Edición automática no los genera. */
  sinSubtitulos?: true;
  /** Las palabras clave: su tamaño en % (100–300, el tope del editor) y su color. */
  claves?: { tamano: number; color: string };
  /** La pausa más corta que se borra, en segundos. */
  pausaMinima?: number;
};

export type Receta = {
  id: string;
  familia: FamiliaEdicion;
  nombre: string;
  /** Por qué funciona, en una frase. */
  porque: string;
  /** El reel de referencia (código de Instagram) y su cuenta: de donde salen los tiempos. */
  referencia: { codigo: string; cuenta: string };
  duracionS: number;
  estructura: readonly BloqueReceta[];
  /** Lo que hace el editor de MaKo, en orden. */
  edicion: readonly string[];
  /** Lo que el editor aplica solo (ver `EdicionDeReceta`). */
  editor?: EdicionDeReceta;
  grabacion: {
    /** Con el avatar de IA del usuario. */
    avatar: readonly string[];
    /** Instrucciones para que grabe otra persona. */
    persona: readonly string[];
  };
};

// Las tres primeras (11/11/2026): de las familias cuyos mejores reels más superaron a su cuenta en los negocios de Martín, una
// de cada tipo de grabación (dos personajes, una charla, un podcast). Cada referencia se bajó y se midió como la de los
// pistachos: duración, tomas (ffmpeg `select='gt(scene,0.28)'`) y un cuadro por segundo para leer el texto en pantalla
// (docs/hallazgos-video-outliers.md → «Las recetas»).
export const RECETAS: readonly Receta[] = [
  {
    id: 'novato-experto',
    familia: 'etiquetas-de-contraste',
    nombre: 'Novato vs. experto',
    porque: 'La misma persona hace de los dos: el que lo hace mal y el que lo hace bien. Quien mira se reconoce en uno y se queda a ver qué hace el otro.',
    referencia: { codigo: 'DefbM6gK909', cuenta: 'julioiero' },
    duracionS: 100,
    estructura: [
      { nombre: 'Los dos, con su rótulo', desde: 0, hasta: 3, que: 'Sentados uno al lado del otro; arriba de cada uno, su rótulo («Vendedor experto», «Vendedor novato»).' },
      { nombre: 'El contraste', desde: 3, hasta: 95, que: 'Se van turnando: el novato dice lo que hace mal en una situación real; el experto, lo que hace él. Una sola toma, sin cortes: el ritmo lo da el ida y vuelta.' },
      { nombre: 'La pregunta', desde: 95, hasta: 100, que: 'Arriba aparece una tarjeta con la pregunta para comentar («¿A cuál se parece más tu equipo?»).' },
    ],
    edicion: [
      'Dos pistas de video: arriba la toma del experto, abajo la del novato, las dos con la cámara en el mismo lugar.',
      'En la de arriba, la Máscara de sus propiedades: una línea vertical al medio, para que de cada toma se vea sólo su lado. Muévela hasta que el corte caiga en algo recto del fondo y no se note.',
      'Dos textos con caja amarilla y letra negra, arriba de cada uno, todo el video: «Vendedor experto» y «Vendedor novato».',
      'Sin subtítulos ni música: lo que engancha es la conversación. Si los usas, chicos y abajo, para no tapar los rótulos.',
      'Los últimos 5 s, una tarjeta blanca arriba con la pregunta para comentar.',
    ],
    editor: { sinSubtitulos: true },
    grabacion: {
      avatar: [
        'Parte de TU personaje aprobado. Primero el fondo solo (la sala, los dos sillones) al 100 %; después, la persona.',
        'Dos imágenes del mismo personaje en el mismo fondo, una edición por vez: «tal cual pero sentado a la izquierda con buzo oscuro» y «tal cual pero sentado a la derecha con buzo gris».',
        'Un video por bloque de diálogo en cada lado, mirando hacia el otro (no a cámara); la duración sale de contar las palabras de cada frase.',
        'La voz, la tuya (el clon), en las dos: el contraste lo hacen la ropa, el rótulo y lo que dice cada uno.',
      ],
      persona: [
        'Trípode fijo y no lo muevas entre tomas; la misma luz de principio a fin.',
        'Primero graba todo el diálogo como el experto, sentado a la izquierda, dejando un silencio donde contesta el otro.',
        'Cámbiate de ropa (que se note: oscuro / claro) y graba al novato a la derecha, contestando en esos silencios.',
        'Mira hacia donde está el otro, no a la cámara. De 1 a 2 minutos en total.',
      ],
    },
  },
  {
    id: 'palabra-gigante',
    familia: 'palabra-resaltada',
    nombre: 'La palabra clave gigante',
    porque: 'Los subtítulos van chicos y, una vez por frase, la palabra que importa aparece enorme: se lee aunque el video esté sin sonido y marca el golpe.',
    referencia: { codigo: 'DPUxQ8_DiVY', cuenta: 'den.borgg' },
    duracionS: 55,
    estructura: [
      { nombre: 'El golpe de arranque', desde: 0, hasta: 7, que: 'Primer plano y una frase que pincha («Que paga la gente que paga poco…»); la primera palabra gigante cae aquí.' },
      { nombre: 'El desarrollo', desde: 7, hasta: 19, que: 'El mismo plano; frases cortas con la palabra clave grande cada 5 a 10 s.' },
      { nombre: 'El contexto', desde: 19, hasta: 25, que: 'Plano abierto: el escenario, el público, la pantalla. Dice «esto es una charla de verdad».' },
      { nombre: 'El remate', desde: 25, hasta: 55, que: 'Dos planos más (lateral y cerrado); la idea fuerte del final y la última palabra gigante.' },
    ],
    edicion: [
      'Cortes de plano cada 6 a 19 s (en la referencia, 4 tomas en 55 s). Con una sola cámara, alterna la escala del clip (100 % y 130 %) para que parezcan dos planos.',
      'Subtítulos automáticos chicos, de 1 a 3 palabras, a la altura del pecho, en una letra con serifa blanca.',
      'Palabras clave: la palabra fuerte de cada frase en la MISMA letra pero 3 o 4 veces más grande, una por frase («te exige», «es irreal», «infumable»).',
      'Borrar silencios: que ningún hueco sin voz pase de medio segundo.',
      'Sin música, o muy baja: manda la voz.',
    ],
    // La palabra clave en blanco (la MISMA letra) y 3 veces más grande, el tope del editor (13/11/2026: el renglón le
    // reserva ancho y alto; antes topaba en 160 %).
    editor: { subtitulos: 'palabra-gigante', claves: { tamano: 300, color: '#ffffff' }, pausaMinima: 0.5 },
    grabacion: {
      avatar: [
        'Tu personaje de pie, en un escenario oscuro con una pantalla detrás; primero el fondo solo al 100 %, después la persona.',
        'Tres imágenes del mismo personaje en ese escenario, una edición por vez: plano medio de frente, plano medio de costado y plano abierto con público.',
        'Un video hablado por frase, con las manos en movimiento (como dando la charla); la duración, por las palabras.',
        'La voz, tu clon; el guion son frases cortas con una palabra fuerte cada una.',
      ],
      persona: [
        'Graba una charla real o simulala: de pie, frente a una pantalla, con micrófono de vincha.',
        'Si puedes, dos cámaras (frente y costado) y un plano abierto del lugar con gente; si no, una en 4K para recortar.',
        'Frases cortas, con pausas, cada una con una palabra que se pueda poner grande.',
        'Saca del medio una pieza de 40 a 60 s con un arranque que pinche.',
      ],
    },
  },
  {
    id: 'pregunta-sobre-podcast',
    familia: 'cita-sobre-podcast',
    nombre: 'La pregunta arriba, el podcast abajo',
    porque: 'La pregunta queda fija arriba todo el video: quien entra sabe en un segundo qué va a escuchar, y se queda hasta la respuesta.',
    referencia: { codigo: 'DfFQ_IFxo4P', cuenta: 'julioiero' },
    duracionS: 148,
    estructura: [
      { nombre: 'La pregunta y la primera frase', desde: 0, hasta: 2, que: 'Desde el primer cuadro, la pregunta arriba («¿Qué haría el dueño de Pollo Feliz si tuviera 23 años y 0 pesos?») y el invitado ya respondiendo.' },
      { nombre: 'La respuesta', desde: 2, hasta: 140, que: 'La conversación, cortada por quien habla: 17 tomas, una cada ~9 s; cuando pregunta el anfitrión, se ve su cara.' },
      { nombre: 'El cierre', desde: 140, hasta: 148, que: 'La reacción del anfitrión. Lo que se pide va en el texto del posteo («Comenta ARNOLDO1…»), no en el video.' },
    ],
    edicion: [
      'Lienzo 9:16 y el video del podcast (horizontal) centrado, en la franja del medio.',
      'El fondo: el mismo clip copiado en la pista de abajo, agrandado hasta llenar todo el lienzo, con el efecto Desenfoque.',
      'Arriba, la pregunta fija de principio a fin: texto blanco, letra sin serifa, 3 renglones, uno o dos emojis al final.',
      'Subtítulos automáticos con la plantilla «Hormozi» (mayúsculas gruesas, una o dos palabras), en el borde de abajo del video.',
      'Corta por quien habla y borra los silencios; el pedazo, de 1 a 2,5 minutos.',
    ],
    editor: { subtitulos: 'hormozi' },
    grabacion: {
      avatar: [
        'Dos personajes sentados frente a micrófonos de podcast, en el mismo estudio: tú (el que responde) y quien pregunta. Primero el estudio solo, al 100 %.',
        'Las tomas en HORIZONTAL (16:9): cada personaje en su plano, mirando hacia el otro.',
        'El guion es una pregunta fuerte y una respuesta en frases cortas; un video por frase, con la duración por las palabras.',
        'Dos voces distintas: la tuya (el clon) para las respuestas y otra para las preguntas.',
      ],
      persona: [
        'Dos cámaras horizontales, una por persona (o una sola con los dos en cuadro), y los micrófonos a la vista.',
        'Luz cálida y de costado; fondo de estudio con algo de profundidad.',
        'Graba la conversación entera y después elige el pedazo con la pregunta más fuerte y su respuesta.',
        'Esa pregunta, escrita tal cual, es el texto de arriba.',
      ],
    },
  },
];

export const recetaDe = (id: string | null | undefined): Receta | null => (id ? RECETAS.find((r) => r.id === id) ?? null : null);

/** Cómo empieza lo que dice MaKo al replicar (`textoDeReceta`): de ahí se sabe que un proyecto sigue una receta. */
const INICIO_RECETA = 'Armé este proyecto para replicar «';

/**
 * La receta de un proyecto replicado, leída del chat de ese proyecto: el primer mensaje de MaKo que es una receta. El
 * proyecto no guarda la receta aparte; el mensaje sí (se guarda con el hilo), también en los proyectos replicados antes.
 */
export function recetaDelHilo(mensajes: readonly { de: string; texto?: string }[]): Receta | null {
  for (const m of mensajes) {
    if (m.de !== 'mako' || typeof m.texto !== 'string' || !m.texto.startsWith(INICIO_RECETA)) continue;
    const nombre = m.texto.slice(INICIO_RECETA.length).split('»')[0];
    const r = RECETAS.find((x) => x.nombre === nombre);
    if (r) return r;
  }
  return null;
}

/** Lo que el editor aplica, dicho para el chat (la IA lo lee en la conversación y lo pide con sus operaciones). */
export function textoDeEdicionEnEditor(e: EdicionDeReceta): string | null {
  const partes: string[] = [];
  if (e.sinSubtitulos) partes.push('sin subtítulos');
  if (e.subtitulos) partes.push(`subtítulos con el estilo «${e.subtitulos}» de la galería de Subtítulos`);
  if (e.claves) partes.push(`palabras clave en ${e.claves.color} al ${e.claves.tamano} %`);
  if (e.pausaMinima) partes.push(`borrar los silencios de ${String(e.pausaMinima).replace('.', ',')} s o más`);
  return partes.length ? `En el editor de MaKo, todo en un pedido: ${partes.join(', ')}.` : null;
}

/**
 * Lo que dice MaKo en el chat del proyecto que arma «Replicar» de una receta (app/video-editor/VideoEditorCliente.tsx): la
 * estructura, la edición en el editor y las dos grabaciones, para seguirla paso a paso. Texto plano: el chat no dibuja markdown.
 */
export function textoDeReceta(r: Receta): string {
  const lista = (xs: readonly string[]) => xs.map((x, i) => `${i + 1}. ${x}`).join('\n');
  return [
    `Armé este proyecto para replicar «${r.nombre}» (el reel de @${r.referencia.cuenta}). ${r.porque}`,
    `La estructura (${r.duracionS} s):\n${r.estructura.map((b) => `· ${b.nombre} (${b.desde}–${b.hasta} s): ${b.que}`).join('\n')}`,
    `Para grabarlo con tu avatar de IA:\n${lista(r.grabacion.avatar)}`,
    `Si lo graba otra persona:\n${lista(r.grabacion.persona)}`,
    `Cuando tengas tus tomas, impórtalas y la edición es así:\n${lista(r.edicion)}`,
    ...(r.editor && textoDeEdicionEnEditor(r.editor) ? [textoDeEdicionEnEditor(r.editor)!] : []),
  ].join('\n\n');
}

/** La receta de una familia de edición (la primera que la tenga): todos los reels de esa familia muestran «Cómo se hace». */
export const recetaDeFamilia = (familia: string | null | undefined): Receta | null =>
  familia ? RECETAS.find((r) => r.familia === familia) ?? null : null;
