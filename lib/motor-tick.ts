// =============================================================================
// motor-tick — qué negocios mira el tick de cada minuto, y el TURNO del motor (puro)
// =============================================================================
// Sexta tanda (09/10/2026): «las esperas se cumplen a la hora exacta, de día o de noche». El motor
// de nutrición corría una vez por hora y sólo de 15 a 23 UTC; ahora lo despierta un tick por minuto
// (app/api/cron/nutricion-tick) que hace lo MÍNIMO:
//
//   1. UNA consulta para todos los negocios: ¿qué inscripción venció en los últimos
//      `VENTANA_FRESCA_MIN` minutos? Sin ninguna, termina ahí (el 99% de los minutos).
//   2. Para los negocios con horario de envío, si el horario ACABA DE ABRIR: ésos se barren enteros
//      (lo que venció de noche sale al abrir: `acabaDeAbrir`, lib/horario-envio.ts).
//   3. Por cada negocio que quedó, el motor de siempre (`procesarEnvios`) con el TURNO tomado.
//
// ⚠️ EL TURNO ES LO QUE IMPIDE MANDAR DOS VECES. Un mensaje del motor no se reclama antes de salir
// (lo cuida el anti-ban, que se lee por lote): dos corridas que leen la misma fila vencida a la vez
// la mandan las dos. Con una corrida por hora eso casi no pasaba; con un tick por minuto, una
// corrida que tarda más de un minuto (manda varios WhatsApps, duerme una espera corta) se pisa con
// la siguiente. El turno es una fila de `app_settings` por negocio con «tomado hasta», escrita con
// compare-and-set (`cambiarSettingSi`): de dos corridas, entra UNA; la otra saltea ese negocio, y lo
// que venció lo toma la que tiene el turno o el tick siguiente. La vía rápida de un lead también lo
// toma, sin esperarlo (lib/motor-turno.ts): sin él, se pisaba con el tick.
//
// ⚠️ El turno VENCE solo (`TURNO_MS`, más que el `maxDuration` de las rutas): una función que Vercel
// mata a la mitad no deja al negocio trabado.
//
// Sin `server-only`: tests/motor-tick.test.ts lo ejecuta. La lectura y la escritura viven en
// lib/motor-turno.ts.
// =============================================================================

// Los tres, puros y sin `server-only` (el saneo de una acción, el modelo del flujo y el canal social).
import { esPasoAccion } from './nutricion-paso-accion';
import { esNodoMensaje, type PasoGrafo } from './flujo-grafo';
import { esCanalSocial } from './canal-social';
// La lista de CRON de una automatización, la MISMA que lee el motor (el primero es el de las columnas). Pura.
import { disparadoresDe, type FilaDisparadores } from './disparadores';

/**
 * ¿Este paso tiene algo que correr con WhatsApp y email APAGADOS en el negocio? Lo preguntan las DOS
 * rutas del cron antes de decir 'off' (la de cada hora y el tick), con esta misma función.
 *
 *   · Un paso «⚡ Acción»: no es un mensaje y el canal apagado no le aplica.
 *   · Un MENSAJE por Instagram o Messenger (revisión de la sexta tanda, 10/10/2026): no tienen
 *     interruptor del negocio — el motor los trata como siempre prendidos (`canalOn`,
 *     lib/nutricion.ts). Sin esto, un negocio que usa sólo Instagram (sin `envio_whatsapp_enabled` ni
 *     `envio_email_enabled`, como el ws13) mandaba el primer DM por la vía rápida y el segundo, el que
 *     viene después de «Esperar 1 día», no lo corría nadie: las dos puertas devolvían 'off' sin un
 *     error, y se perdía la ventana de Meta.
 *
 * Por la CLASE del nodo y no sólo por el campo `canal`: una espera o una condición llevan un `canal`
 * (el de relleno, `RELLENO_CONTROL`, o el que le quedó de cuando era un mensaje) y no mandan nada. Y
 * el motor corre SIN `simularApagados`, así que un WhatsApp o un email de esas secuencias sigue
 * esperando u omitiéndose como siempre.
 */
export function correSinCanales(p: PasoGrafo): boolean {
  return esPasoAccion(p) || (esNodoMensaje(p) && esCanalSocial(p.canal));
}

/** La clave del turno en `app_settings` (por workspace). */
export const KEY_TURNO_MOTOR = 'mako.nutricion.turno';

/** Cuánto dura un turno tomado: el `maxDuration` de las rutas (300 s) y un minuto de margen. */
export const TURNO_MS = 6 * 60_000;

/** ¿El turno guardado sigue tomado a esta hora? Un valor que no se entiende cuenta como libre. */
export function turnoTomado(valor: string | null | undefined, ahoraMs: number): boolean {
  if (!valor) return false;
  const hasta = Date.parse(valor);
  return Number.isFinite(hasta) && hasta > ahoraMs;
}

/** El valor que se escribe al tomarlo: «tomado hasta». */
export function valorDeTurno(ahoraMs: number): string {
  return new Date(ahoraMs + TURNO_MS).toISOString();
}

/**
 * Por qué el tick corre un negocio: lo que acaba de vencer, el horario que acaba de abrir, o un RECURRENTE que acaba de
 * llegar a su hora (y entonces primero se inscribe su cohorte).
 */
export type MotivoTick = 'vencio' | 'abrio' | 'recurrente';

/** Lo que el tick lee de cada automatización activa para saber si un Recurrente llegó a su hora. */
export type FilaRecurrente = FilaDisparadores & { workspace_id: number | string | null };

/**
 * LOS NEGOCIOS CON UN RECURRENTE QUE ACABA DE LLEGAR A SU HORA (20/10/2026). El d2 de #284 del ws11 era «martes 16:15»
 * (21:15Z) y el tick no lo reclamaba: inscribir por cohorte era sólo de la corrida de cada hora, así que salía a las
 * 22:00. Ahora un Recurrente sale a su minuto.
 *
 * Mira TODOS los CRON de cada automatización (`disparadoresDe`, la lista del motor: el primero en las columnas, los demás
 * en `disparadores`, mig 0241) y sólo lo FRESCO: una ocurrencia vencida entre `desdeMs` y `ahoraMs`. Una vieja que nadie
 * reclamó (un CRON que el barrido no inscribe) correría ese negocio cada minuto; ésa la sigue mirando la corrida de cada
 * hora. Sin `cron_proxima_at` no hay ocurrencia que reclamar: la siembra la corrida de cada hora (sembrar no dispara).
 */
export function negociosConRecurrenteVencido(filas: readonly FilaRecurrente[], ahoraMs: number, desdeMs: number): number[] {
  const out = new Set<number>();
  for (const f of filas) {
    const ws = Number(f.workspace_id);
    if (!Number.isInteger(ws) || ws <= 0 || out.has(ws)) continue;
    const vence = disparadoresDe(f).some((d) => {
      if (!d.cron || !d.cron_proxima_at) return false;
      const t = Date.parse(d.cron_proxima_at);
      return Number.isFinite(t) && t <= ahoraMs && t >= desdeMs;
    });
    if (vence) out.add(ws);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Los negocios que corre el tick, y cómo. Recibe lo que ya se leyó: los negocios ACTIVOS, los que
 * tienen algo vencido hace poco y los que tienen un horario que acaba de abrir (con algo vencido,
 * de cualquier antigüedad). Un negocio pausado no se corre aunque tenga filas.
 *
 * `abrio` gana sobre `vencio`: barrer entero cubre lo fresco.
 */
export function negociosDelTick(p: {
  activos: ReadonlySet<number>;
  conVencidoFresco: Iterable<number>;
  abrieronConVencido: Iterable<number>;
  /** Los que tienen un Recurrente que acaba de llegar a su hora (`negociosConRecurrenteVencido`). */
  conRecurrente?: Iterable<number>;
}): Array<{ ws: number; motivo: MotivoTick; recurrente?: true }> {
  const out = new Map<number, MotivoTick>();
  for (const ws of p.conVencidoFresco) if (p.activos.has(ws)) out.set(ws, 'vencio');
  for (const ws of p.abrieronConVencido) if (p.activos.has(ws)) out.set(ws, 'abrio');
  // El Recurrente NO pisa el motivo: inscribe antes y después corre lo de su motivo (`abrio` barre entero, `vencio` y
  // `recurrente` sólo lo fresco, que es donde caen los que se acaban de inscribir).
  const conRec = new Set<number>();
  for (const ws of p.conRecurrente ?? []) if (p.activos.has(ws)) { conRec.add(ws); if (!out.has(ws)) out.set(ws, 'recurrente'); }
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([ws, motivo]) => ({ ws, motivo, ...(conRec.has(ws) ? { recurrente: true as const } : {}) }));
}
