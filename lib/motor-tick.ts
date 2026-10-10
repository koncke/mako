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

/** Por qué el tick corre un negocio: lo que acaba de vencer, o el horario que acaba de abrir. */
export type MotivoTick = 'vencio' | 'abrio';

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
}): Array<{ ws: number; motivo: MotivoTick }> {
  const out = new Map<number, MotivoTick>();
  for (const ws of p.conVencidoFresco) if (p.activos.has(ws)) out.set(ws, 'vencio');
  for (const ws of p.abrieronConVencido) if (p.activos.has(ws)) out.set(ws, 'abrio');
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([ws, motivo]) => ({ ws, motivo }));
}
