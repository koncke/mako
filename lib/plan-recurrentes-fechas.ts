// =============================================================================
// plan-recurrentes-fechas — CUÁNDO toca la próxima vez (#813)
// =============================================================================
// La 0167 guardó la recurrencia como una RRULE de RFC 5545 y dejó escrito, con todas
// las letras, lo que faltaba: «Nada en este producto calcula la próxima ocurrencia: el
// día es una ETIQUETA, no dispara ni el reparto diario ni un aviso ni un recordatorio.»
// Esto es eso.
//
// Sin `server-only` a propósito: acá vive la decisión y una decisión sin test es una
// afirmación. No toca la base, no lee la hora del sistema y no sabe de zonas.
//
// ── POR QUÉ FECHAS Y NO INSTANTES ────────────────────────────────────────────
// La ocurrencia de una tarea es un DÍA, no una hora: lo que nace es una instancia con
// su `deadline`, que es `YYYY-MM-DD`. Trabajar en fechas hace que la zona horaria no
// entre en la cuenta — y con eso desaparece toda la familia de bugs del horario de
// verano que `lib/cron-aviso.ts` tuvo que resolver con dos pasadas. La zona se
// pregunta UNA vez, afuera, para saber qué día es hoy en el negocio (`hoyEnWorkspace`).
//
// ── POR QUÉ SE CAMINA DÍA POR DÍA Y NO SE CALCULA ────────────────────────────
// Un salto directo («sumá 2 meses y buscá el segundo martes») es cuatro fórmulas, una
// por `freq`, cada una con sus bordes: el 31 en febrero, el quinto martes que no
// existe, la semana que cruza el año. Caminar es UNA regla —«¿este día calza?»— que se
// lee de un vistazo y que se puede probar día por día contra un calendario de verdad.
// Cuesta unos milisegundos y corre una vez por plantilla por día.
//
// ── EL ANCLA ─────────────────────────────────────────────────────────────────
// ⚠️ Toda la serie cuelga del ANCLA, que es la ocurrencia anterior — nunca `hoy`. Es la
// regla que AGENTS.md tiene escrita para los horarios que se repiten: anclado en `now()`
// un «cada 2 semanas» se corre un día cada vez que el cron llega tarde, y a los seis
// meses la reunión de los miércoles cae en jueves sin que nadie haya tocado nada.
// =============================================================================

import { leerRRule, type Repeticion, type Dia } from './plan-recurrentes';

/** El orden de RFC 5545 para `getUTCDay()`: 0 es domingo. */
const DOW: Dia[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const MS_DIA = 86_400_000;

/** `YYYY-MM-DD` → el mediodía UTC de ese día. Mediodía y no medianoche: así ningún
 *  redondeo ni ninguna zona puede correr la fecha un día para atrás. */
export function aFecha(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return Number.isFinite(d.getTime()) && d.getUTCDate() === Number(m[3]) ? d : null;
}

/** Al revés: el día que es, en `YYYY-MM-DD`. */
export const aISO = (d: Date): string => d.toISOString().slice(0, 10);

const diasEntre = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / MS_DIA);
const mesesEntre = (a: Date, b: Date): number =>
  (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());

/** El lunes de la semana de `d`. WKST=MO es el default de RFC 5545 y el de Google. */
function lunesDe(d: Date): Date {
  const x = new Date(d.getTime());
  const desdeLunes = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - desdeLunes);
  return x;
}

/** Los días del MES de `d` que caen en alguno de `byday`, en orden. */
function diasDelMesQueCalzan(d: Date, byday: Dia[]): number[] {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const ultimo = new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();
  const out: number[] = [];
  for (let i = 1; i <= ultimo; i++) {
    if (byday.includes(DOW[new Date(Date.UTC(y, m, i, 12)).getUTCDay()])) out.push(i);
  }
  return out;
}

/**
 * ¿ESTE DÍA CALZA con la repetición, contada desde el ancla?
 *
 * Exportada porque es la regla entera y el test la prueba día por día contra un
 * calendario: envuelta adentro del bucle, lo único testeable sería el resultado final y
 * un borde mal resuelto se vería como «devolvió otra fecha».
 */
export function calza(r: Repeticion, dia: Date, ancla: Date): boolean {
  const dow = DOW[dia.getUTCDay()];
  switch (r.freq) {
    case 'DAILY':
      return diasEntre(ancla, dia) % r.interval === 0;

    case 'WEEKLY': {
      // Sin días elegidos, la serie es «cada N semanas, el mismo día que el ancla».
      if (!r.byday.length) return diasEntre(ancla, dia) % (7 * r.interval) === 0;
      if (!r.byday.includes(dow)) return false;
      // ⚠️ EL INTERVALO SE CUENTA EN SEMANAS ENTERAS, no en días. «Cada 2 semanas, lunes
      // y viernes» son los dos días de UNA semana sí y otra no; contando días, el lunes
      // y el viernes de la misma semana caerían en paridades distintas y saldría uno de
      // cada semana, que es otra repetición.
      const semanas = Math.round(diasEntre(lunesDe(ancla), lunesDe(dia)) / 7);
      return semanas % r.interval === 0;
    }

    case 'MONTHLY': {
      if (mesesEntre(ancla, dia) % r.interval !== 0) return false;
      if (r.bymonthday) {
        // ⚠️ SE SALTEA EL MES QUE NO TIENE ESE DÍA, no se corre al último. «El 31 de cada
        // mes» en febrero: las dos salidas —saltear o correr al 28— son decisiones de
        // producto, y la 0167 dejó escrito que nadie la tomó. Saltear es la única que no
        // MIENTE sobre la fecha; correrlo pone la tarea un día que nadie eligió, y en
        // silencio. Si algún día se decide lo otro, se decide acá y con su comentario.
        return dia.getUTCDate() === r.bymonthday;
      }
      if (r.byday.length) {
        if (!r.byday.includes(dow)) return false;
        if (!r.bysetpos) return true;  // «Cada mes, los martes» = todos los martes
        const lista = diasDelMesQueCalzan(dia, r.byday);
        // -1 es «el último». El quinto martes de un mes que no lo tiene simplemente no
        // existe y ese mes no produce ocurrencia, que es lo que hace Google.
        const elegido = r.bysetpos === -1 ? lista[lista.length - 1] : lista[r.bysetpos - 1];
        return elegido === dia.getUTCDate();
      }
      // «Cada N meses» a secas: el mismo día del mes que el ancla.
      return dia.getUTCDate() === ancla.getUTCDate();
    }

    case 'YEARLY': {
      if ((dia.getUTCFullYear() - ancla.getUTCFullYear()) % r.interval !== 0) return false;
      // Sin BYMONTH, RFC 5545 saca el mes del arranque de la serie: el del ancla.
      if (dia.getUTCMonth() !== ancla.getUTCMonth()) return false;
      return dia.getUTCDate() === (r.bymonthday ?? ancla.getUTCDate());
    }

    default:
      return false;
  }
}

/**
 * Cuántos días se caminan como mucho. 99 años (el `INTERVALO_MAX` de una anual) más un
 * bisiesto de sobra. Es un BACKSTOP, no un límite de producto: con una regla legible,
 * la próxima ocurrencia aparece en los primeros días. Si se agota, algo no calza nunca
 * —un 30 de febrero, un quinto viernes pedido en una anual— y la respuesta honesta es
 * `null`, que quien llama registra y no convierte en una fecha inventada.
 */
export const TOPE_BUSQUEDA = 99 * 366 + 1;

/**
 * LA PRÓXIMA FECHA, estrictamente después de `desde`.
 *
 * `ancla` es dónde arranca la serie (la primera ocurrencia, o el día en que se creó la
 * plantilla). `desde` es hasta dónde ya se llegó. Casi siempre son el mismo día; se
 * separan cuando hay que recuperar una serie atrasada sin perder la grilla.
 *
 * `null` = la regla no se puede leer, o no hay ninguna fecha que calce.
 */
export function proximaFecha(rrule: unknown, desde: string, ancla: string = desde): string | null {
  const r = leerRRule(rrule);
  const d0 = aFecha(desde);
  const a0 = aFecha(ancla) ?? d0;
  if (!r || !d0 || !a0) return null;
  const x = new Date(d0.getTime());
  for (let i = 0; i < TOPE_BUSQUEDA; i++) {
    x.setUTCDate(x.getUTCDate() + 1);
    if (calza(r, x, a0)) return aISO(x);
  }
  return null;
}

/**
 * TODAS las ocurrencias de `desde` (exclusivo) a `hasta` (inclusivo), en orden.
 *
 * La usa el generador para saber si se perdió alguna, y la pantalla para «las próximas
 * cinco». Topada en `max` porque un «todos los días» sobre un año son 365 fechas y quien
 * la llama casi siempre quiere las primeras.
 */
export function ocurrenciasEntre(rrule: unknown, desde: string, hasta: string, ancla: string = desde, max = 50): string[] {
  const out: string[] = [];
  let cursor = desde;
  for (let i = 0; i < max; i++) {
    const p = proximaFecha(rrule, cursor, ancla);
    if (!p || p > hasta) break;
    out.push(p);
    cursor = p;
  }
  return out;
}


// ── QUÉ GENERAR HOY (#813) ───────────────────────────────────────────────────

export type QueGenerar =
  /** Nace una instancia con esta fecha. `salteadas` son las vencidas que se dejan pasar. */
  | { crear: string; salteadas: number }
  /** No nace nada, y por qué. Los tres motivos son decisiones, no fallas. */
  | { crear: null; motivo: 'sin-regla' | 'no-toca' | 'hay-una-abierta'; salteadas: 0 };

/**
 * LAS TRES DECISIONES DEL GENERADOR, en una función pura.
 *
 * Vive acá y no adentro de `plan-recurrentes-generar.ts` —que tiene `server-only`— por
 * la regla de la casa: una condición que decide qué se ESCRIBE necesita test, y un
 * módulo con `server-only` no lo puede importar ninguno.
 *
 * 1. UNA INSTANCIA ABIERTA POR VEZ. Si la del miércoles pasado sigue sin hacerse, el
 *    miércoles que viene no nace otra. Doce «grabar contenido» apiladas son el tablero
 *    que nadie mira que esta feature vino a evitar — y el trabajo pendiente ya está a
 *    la vista en la tarjeta que quedó abierta.
 *
 * 2. SE SALTEAN LAS PERDIDAS. Con el cron caído tres días, un «todos los días» crea UNA
 *    y sigue en su grilla, no tres de golpe. Se devuelve cuántas se saltearon porque un
 *    descarte sin rastro hace indistinguibles «no había» de «las tiramos nosotros».
 *
 * 3. NADA HACIA ADELANTE. Una instancia nace el día que toca y ni un día antes: el
 *    «Listo cuando» dice «aparece sola cuando toca», y una tarea con fecha futura vuelve
 *    a llenar el tablero de trabajo que todavía no es.
 */
export function queGenerar(p: {
  /** la RRULE de la plantilla. `null`/ilegible = «se repite y nadie dijo cada cuánto». */
  rrule: unknown;
  /** dónde arranca la serie: de esto depende la FASE («cada 2 semanas» ¿cuál semana?). */
  ancla: string;
  /** hasta dónde llegó: la fecha de la última instancia, o el ancla si no hubo ninguna. */
  cursor: string;
  /** ¿quedó alguna sin completar? */
  hayAbierta: boolean;
  /** hoy, en la zona del NEGOCIO. */
  hoy: string;
}): QueGenerar {
  if (p.hayAbierta) return { crear: null, motivo: 'hay-una-abierta', salteadas: 0 };
  // Se pregunta DESPUÉS de la abierta a propósito: una plantilla a la que le borraron la
  // regla pero que tiene trabajo abierto no es «sin regla», es «hay una abierta». El
  // motivo que se reporta tiene que ser el que explica la pantalla que se ve.
  const vencidas = ocurrenciasEntre(p.rrule, p.cursor, p.hoy, p.ancla, 400);
  if (!vencidas.length) return { crear: null, motivo: proximaFecha(p.rrule, p.cursor, p.ancla) ? 'no-toca' : 'sin-regla', salteadas: 0 };
  return { crear: vencidas[vencidas.length - 1], salteadas: vencidas.length - 1 };
}
