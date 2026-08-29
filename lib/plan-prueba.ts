// =============================================================================
// plan-prueba — LA CARGA DE LA PRUEBA para cambiar una prioridad a mano
// =============================================================================
// El dueño pidió que el Perro «sea muy estricto y tenga la capacidad de rechazar una
// re-priorización si los argumentos no son fuertes». El problema de dejar eso en manos del
// modelo es el de siempre: **una regla en un prompt no es una regla**. Un modelo al que se
// le pide ser duro cede ante la insistencia, y encima cobra tokens para ceder.
//
// Así que acá «argumento fuerte» deja de ser un adjetivo y pasa a ser un TIPO DE DATO. La
// exigencia se calcula con aritmética —cuánto se pide subir, desde dónde, y si toca el
// norte— y se cumple trayendo PRUEBAS: un proyecto que se traba, un cliente con nombre, una
// fecha real, un número de plata, un escalón de la escalera. Nada de eso lo puede inventar
// el que argumenta: todo se resuelve contra la base antes de que el modelo vea nada.
//
// LO QUE ESTO COMPRA, Y ES LA MITAD DEL DISEÑO: **el rechazo más frecuente no lo hace el
// modelo**. «Me parece importante» no llega a la llamada — el botón queda apagado y la
// pantalla dice qué falta. Cero tokens, cero espera, y un no que no se puede negociar
// porque no hay nadie del otro lado a quien insistirle.
//
// SIN `server-only` a propósito, como `metodologia.ts` y `preguntas-contrato.ts`: la
// exigencia se dibuja EN VIVO en el modal mientras el dueño mueve el slider (si solo la
// supiera el server, se enteraría después de argumentar, que es tarde) y el test la importa.
// El RESOLVEDOR de las pruebas contra la base sí es server-only y vive aparte.
// =============================================================================

/** De qué está hecha una prueba. Cada clase se resuelve contra una tabla distinta. */
export type ClasePrueba = 'proyecto' | 'tarea' | 'cliente' | 'fecha' | 'plata' | 'escalon';

export type Prueba = {
  clase: ClasePrueba;
  /** el id crudo tal como lo eligió el dueño (uuid, id de lead, ISO de fecha, número, 1-5) */
  ref: string;
  /** cómo se llama de verdad. Lo escribe el RESOLVEDOR desde la base, nunca el que argumenta. */
  etiqueta: string;
  nota?: string;
  /** lo pone SOLO el resolvedor. `undefined` = todavía no se resolvió. */
  estado?: 'ok' | 'no-existe' | 'formato';
};

export type Nivel = 'norte' | 'sube-banda' | 'sube-dentro' | 'baja' | 'baja-norte';

export type Exigencia = {
  nivel: Nivel;
  /** cuántas pruebas hacen falta como mínimo */
  minimo: number;
  /** grupos-O: hay que cumplir TODOS los grupos, y cada grupo con CUALQUIERA de sus clases */
  clases: ClasePrueba[][];
  /** la frase que se le muestra al dueño, en su idioma, ANTES de que argumente */
  texto: string;
};

const BANDA = (s: number): number => (s >= 75 ? 3 : s >= 50 ? 2 : s >= 25 ? 1 : 0);
const NOMBRE_BANDA = ['A futuro', 'Baja', 'Media', 'Alta'];

export const NOMBRE_CLASE: Record<ClasePrueba, string> = {
  proyecto: 'un proyecto',
  tarea: 'una tarea',
  cliente: 'un cliente',
  fecha: 'una fecha comprometida',
  plata: 'un número de plata',
  escalon: 'un escalón de la escalera del dinero',
};

const frase = (g: ClasePrueba[]): string => g.map((c) => NOMBRE_CLASE[c]).join(' o ');

/**
 * Cuánto hay que traer para pedir este movimiento.
 *
 * La asimetría es deliberada y sale de la metodología del Perro: **BAJAR es barato y SUBIR
 * es caro.** El sesgo que el Perro existe para corregir es que todo parece urgente —«el
 * dueño exagera y no sabe priorizar» está escrito en su prompt—, así que sacarle prioridad a
 * algo casi siempre es la decisión correcta y no hay por qué cobrarle peaje. Lo que se paga
 * es inflar.
 *
 * Y el caso más caro tiene nombre: pedir el NORTE (95-100). Solo puede haber uno, así que
 * pedirlo no es subir un proyecto — es **bajar el que hoy lo es**, aunque el que lo pide no
 * lo esté diciendo. Por eso ahí la prueba obligatoria es nombrar cuál deja de serlo: si no
 * puede, no estaba pidiendo el norte, estaba diciendo que le importa.
 */
export function exigenciaDe(
  entidad: 'proyecto' | 'tarea',
  scoreActual: number,
  scorePedido: number,
  esNorteHoy: boolean,
): Exigencia {
  const cosa = entidad === 'proyecto' ? 'este proyecto' : 'esta tarea';
  // ── BAJAR ──
  if (scorePedido < scoreActual) {
    if (esNorteHoy) {
      return {
        nivel: 'baja-norte',
        minimo: 1,
        clases: [['proyecto', 'tarea']],
        texto: 'Estás bajando el norte de hoy. Dime qué pasa a serlo en su lugar: un plan sin norte no es un plan con uno menos, es un plan sin foco.',
      };
    }
    return {
      nivel: 'baja',
      minimo: 0,
      clases: [],
      texto: 'Bajar no me lo tienes que probar: sacar cosas de arriba casi siempre es la decisión correcta. Cuéntame en una línea por qué y listo.',
    };
  }
  // ── SUBIR AL NORTE ──
  if (scorePedido >= 95) {
    return {
      nivel: 'norte',
      minimo: 2,
      clases: [['proyecto', 'tarea'], ['cliente', 'fecha', 'plata']],
      texto: `Estás pidiendo el Objetivo Principal, y hay uno solo: para que ${cosa} lo sea, otro deja de serlo. Necesito dos cosas — cuál deja de ser el norte, y algo de afuera de tu cabeza (un cliente esperando, una fecha comprometida o un número de plata).`,
    };
  }
  // ── SUBIR CRUZANDO DE BANDA ──
  if (BANDA(scorePedido) > BANDA(scoreActual)) {
    const grupo: ClasePrueba[] = ['cliente', 'fecha', 'plata', 'proyecto'];
    return {
      nivel: 'sube-banda',
      minimo: 1,
      clases: [grupo],
      texto: `Lo estás sacando de ${NOMBRE_BANDA[BANDA(scoreActual)]} y metiendo en ${NOMBRE_BANDA[BANDA(scorePedido)]}. Para eso necesito un hecho que no esté solo en tu cabeza: ${frase(grupo)} que se destraba con esto.`,
    };
  }
  // ── SUBIR DENTRO DE LA MISMA BANDA ──
  return {
    nivel: 'sube-dentro',
    minimo: 0,
    clases: [],
    texto: 'Es un ajuste fino dentro de la misma banda. Cuéntame por qué y lo miro.',
  };
}

/**
 * ¿La carga está cumplida? Determinista, sin modelo, sin red.
 *
 * Una prueba que el resolvedor marcó `no-existe` o `formato` NO cuenta. Eso importa más de
 * lo que parece: si contara, la carga se cumpliría escribiendo cualquier cosa, que es
 * exactamente el «argumento fuerte» de mentira que esto viene a evitar.
 */
export function cumpleLaCarga(ex: Exigencia, pruebas: Prueba[]): { ok: boolean; faltan: ClasePrueba[][]; detalle: string } {
  const validas = pruebas.filter((p) => p.estado === undefined || p.estado === 'ok');
  const faltan = ex.clases.filter((grupo) => !validas.some((p) => grupo.includes(p.clase)));
  const pocas = validas.length < ex.minimo;
  const partes: string[] = [];
  for (const g of faltan) partes.push(`falta ${frase(g)}`);
  if (pocas && !faltan.length) partes.push(`hacen falta ${ex.minimo} pruebas y trajiste ${validas.length}`);
  const rotas = pruebas.filter((p) => p.estado === 'no-existe' || p.estado === 'formato');
  if (rotas.length) partes.push(`${rotas.length} de las que trajiste no se pudieron verificar`);
  return { ok: faltan.length === 0 && !pocas, faltan, detalle: partes.join(' · ') };
}

/** Huella de las pruebas, para no pagarle al modelo dos veces el mismo reclamo. */
export function huellaDePruebas(pruebas: Prueba[]): string {
  return pruebas.map((p) => `${p.clase}:${p.ref}`).sort().join('|');
}

/**
 * La pregunta que sale del CÓDIGO cuando falta una prueba.
 *
 * No la elige el modelo: si la carga no está cumplida, ya sabemos exactamente qué falta, y
 * gastar una llamada para que alguien lo redacte es pagar por algo que ya está decidido.
 * Cada plantilla sale con la forma que `sanearPregunta` acepta —el tipo y las opciones
 * coherentes— porque el bug original de las preguntas del Perro fue justo ese: «¿cuál es el
 * deadline?» con botones del 1 al 5.
 */
export function preguntaPorFaltante(
  grupo: ClasePrueba[],
  ctx: { norteActual?: string; segundo?: string; enDebate: string },
): { pregunta: string; tipo: string; opciones: string[]; sobre: string[] } | null {
  if (grupo.includes('proyecto') && grupo.includes('tarea')) {
    const ops = [ctx.norteActual, ctx.segundo].filter(Boolean) as string[];
    // `comparacion` exige EXACTAMENTE dos opciones (preguntas-contrato). Con una sola, el
    // saneo la degradaría — así que acá se degrada a mano, a algo que sí se puede contestar.
    if (ops.length === 2) return { pregunta: 'Si esto pasa a ser lo primero, ¿cuál deja de serlo?', tipo: 'comparacion', opciones: ops, sobre: [ctx.enDebate] };
    return { pregunta: '¿Qué proyecto deja de ser lo primero para que este lo sea?', tipo: 'texto', opciones: [], sobre: [ctx.enDebate] };
  }
  if (grupo.includes('cliente')) return { pregunta: '¿Qué cliente está esperando esto?', tipo: 'opcion', opciones: [], sobre: [ctx.enDebate] };
  if (grupo.includes('fecha')) return { pregunta: '¿Hay una fecha comprometida con alguien de afuera?', tipo: 'fecha', opciones: [], sobre: [ctx.enDebate] };
  if (grupo.includes('escalon')) {
    return {
      pregunta: '¿En qué escalón de la escalera del dinero cae esto?',
      tipo: 'opcion',
      opciones: ['1 · Cobrar lo que ya se vendió', '2 · Traer una conversación nueva', '3 · No perder un cliente de adentro', '4 · Convertir mejor lo que ya entra', '5 · Construir una capacidad'],
      sobre: [ctx.enDebate],
    };
  }
  return null;
}
