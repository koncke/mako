// =============================================================================
// cuando — «hoy», «esta semana», «este Quarter»: en qué ventana cae una tarea
// =============================================================================
// Es la capa de tiempo del tablero (tarea #635). Vive acá, aparte y sin importar
// nada de React, por la razón de siempre: si estuviera adentro de las 2.680 líneas
// de `BoardShell.tsx` ningún test la podría correr — y esto decide qué ve alguien
// cuando pregunta «¿qué me toca hoy?».
//
// ⚠️ LA DIFERENCIA ENTRE `deadline` Y `quarter` NO SE COLAPSA, y es lo que hace
// útil a esta función:
//
//   · `deadline` es CUÁNDO VENCE. Lo pone el Perro, una reunión o una persona.
//   · `quarter`  es CUÁNDO SE PLANIFICÓ HACERLO. Lo pone SIEMPRE una persona.
//
// Son dos hechos distintos y por eso hay dos columnas. Derivar el Q del deadline
// —que es lo que pide el cuerpo— inventa una decisión que nadie tomó: una tarea con
// fecha para marzo no es una tarea que alguien haya puesto en el Q1.
//
// Lo que SÍ se hace es contestar la pregunta del usuario con los dos datos: una
// tarea entra en «este Quarter» si la planificaron para él **o** si vence adentro.
// La pregunta es «¿qué cae en esta ventana?», no «¿qué columna tiene puesta?».
// =============================================================================

import { quarterDe, quarterKey, rangoQuarter, parseQuarterKey } from '@/lib/objectives-modelo';

/**
 * Las ventanas, de la más cerca a la más lejos.
 *
 * `sin-fecha` NO es una ventana de tiempo: es la ausencia de una. Está en el mismo
 * enum porque el filtro tiene que poder ofrecerla —«¿qué quedó sin planificar?» es
 * la pregunta que hace que un tablero no se desborde— pero nunca se ordena entre
 * las otras como si fuera «más lejos que este Quarter».
 */
export type Cuando = 'hoy' | 'semana' | 'quarter' | 'despues' | 'sin-fecha';

export const CUANDO_LABEL: Record<Cuando, string> = {
  hoy: 'Hoy',
  semana: 'Esta semana',
  quarter: 'Este Quarter',
  despues: 'Más adelante',
  'sin-fecha': 'Sin planificar',
};

/** Suma días a un ISO `YYYY-MM-DD`, en UTC para no depender de la zona del server. */
function masDias(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export type TareaConTiempo = { deadline?: string | null; quarter?: string | null };

/**
 * En qué ventana cae una tarea.
 *
 * El orden de las preguntas importa y es de lo más cerca a lo más lejos: una tarea
 * que vence hoy Y está planificada para este Q es «hoy», porque eso es lo que
 * alguien necesita saber al abrir la pantalla.
 *
 * ⚠️ UN DEADLINE VENCIDO CUENTA COMO «HOY», no como «más adelante» ni como pasado.
 * Es lo único honesto: algo que venció ayer y sigue abierto es exactamente lo que
 * hay que hacer ahora. Mandarlo a otra ventana lo esconde justo cuando más importa.
 */
export function cuandoDe(t: TareaConTiempo, hoy: string): Cuando {
  const dl = (t.deadline ?? '').trim();
  const q = parseQuarterKey(t.quarter ?? null);

  if (dl) {
    if (dl <= hoy) return 'hoy';
    // La semana es HOY + 6 días, no «hasta el domingo». Un viernes, «esta semana»
    // con el corte del domingo son dos días — y la pregunta de quien mira un
    // tablero un viernes es qué le toca en los próximos siete.
    if (dl <= masDias(hoy, 6)) return 'semana';
    const { hasta } = rangoQuarter(quarterDe(hoy));
    if (dl <= hasta) return 'quarter';
    return 'despues';
  }

  if (q) {
    const actual = quarterDe(hoy);
    if (q.anio === actual.anio && q.q === actual.q) return 'quarter';
    // Un Q ya pasado sin deadline no es «más adelante»: quedó sin hacer y su
    // ventana venció. Va a `hoy` por la misma razón que un deadline vencido.
    const key = quarterKey(q);
    return key < quarterKey(actual) ? 'hoy' : 'despues';
  }

  return 'sin-fecha';
}

/** Cuántas tareas caen en cada ventana. Para el resumen del filtro. */
export function contarPorCuando(tareas: TareaConTiempo[], hoy: string): Record<Cuando, number> {
  const c: Record<Cuando, number> = { hoy: 0, semana: 0, quarter: 0, despues: 0, 'sin-fecha': 0 };
  for (const t of tareas) c[cuandoDe(t, hoy)]++;
  return c;
}

/**
 * Las opciones del filtro, en el orden en que se muestran.
 *
 * `despues` NO está: filtrar por «más adelante» es pedir lo que justamente no hay
 * que mirar hoy, y una opción que nadie va a usar es una opción que estorba. Se
 * llega igual dejando el filtro en «todas».
 */
export const CUANDO_OPS: Cuando[] = ['hoy', 'semana', 'quarter', 'sin-fecha'];

/**
 * El Quarter actual y los tres siguientes, para el selector de una tarea.
 *
 * ⚠️ NO OFRECE QUARTERS PASADOS. Planificar algo para un trimestre que ya terminó
 * no es una intención posible: si aparece en la lista, alguien lo va a elegir por
 * error y la tarea va a quedar en una ventana que no existe.
 */
export function quartersElegibles(hoy: string, cuantos = 4): Array<{ key: string; label: string }> {
  const actual = quarterDe(hoy);
  const out: Array<{ key: string; label: string }> = [];
  let q = actual;
  for (let i = 0; i < cuantos; i++) {
    out.push({ key: quarterKey(q), label: `Q${q.q} ${q.anio}${i === 0 ? ' (este)' : ''}` });
    q = q.q === 4 ? { anio: q.anio + 1, q: 1 } : { anio: q.anio, q: q.q + 1 };
  }
  return out;
}
