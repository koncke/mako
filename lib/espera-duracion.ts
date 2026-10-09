// =============================================================================
// espera-duracion — cuánto espera un DELAY (en segundos) y qué precisión tiene DE VERDAD
// =============================================================================
// Quinta tanda, punto 3 (literal de Martín): «En Delay, falta la opción de minutos y segundos...».
// Hasta acá el DELAY ofrecía horas y días, con su porqué escrito en el editor: «el motor corre una
// vez por hora, así que ofrecer minutos sería prometer una precisión que no existe». Las dos cosas
// siguen siendo ciertas, y por eso este módulo trae las DOS mitades juntas:
//
//   · la UNIDAD: segundos, minutos, horas y días, con la conversión de ida y vuelta al dato;
//   · la PRECISIÓN: qué espera se cumple adentro de la misma corrida del motor (≤ 120 s, si la ruta
//     le da tiempo: `esperaEnLaCorrida`) y cuál depende de la cadencia del cron (`sinPrecision`), que
//     es la que la pantalla tiene que decir (AGENTS.md: «Un número tuyo por encima del suyo no
//     protege: promete»).
//
// ⚠️ EL DATO SIGUE SIENDO `espera.minutos` (lib/flujo-grafo.ts), CON DECIMALES PARA LOS SEGUNDOS:
// 10 s = 1/6 min. Se eligió contra un campo `segundos` nuevo porque el tipo `Espera`, `validarGrafo`
// (minutos > 0), el motor (`ahora + minutos × 60 000`), el simulador y el conversor ya leen minutos
// como número: con decimales, todo lo guardado sigue igual y nada nuevo pasa por las cinco puertas.
// Lo único que había que tocar es lo que REDONDEABA a minutos enteros —el saneo de
// `setSecuenciaPasos` (`sanearEspera`, lib/nutricion-grafo-motor.ts) y el texto de la píldora
// (`textoEspera`, lib/flujo-grafo.ts)—: redondeado, «10 s» se guardaba como 0 y la espera
// desaparecía en el primer guardado, sin error.
//
// ⚠️ PURO, SIN DEPENDENCIAS Y SIN `server-only`: lo importan el editor del lienzo (cliente), el
// motor y el modelo del flujo. Con una dependencia, el editor arrastraría al navegador lo que ésta
// importe (AGENTS.md, `'use client'` es una frontera de DATOS).
// =============================================================================

export type UnidadEspera = 's' | 'min' | 'h' | 'dias';

/** Las unidades, en el orden en que se ofrecen. */
export const UNIDADES_ESPERA: readonly UnidadEspera[] = ['s', 'min', 'h', 'dias'];

export const SEGUNDOS_DE: Readonly<Record<UnidadEspera, number>> = { s: 1, min: 60, h: 3600, dias: 86400 };

/** Singular y plural de cada unidad. La más larga es «segundos»: con ésa se mide el ancho. */
const NOMBRE: Readonly<Record<UnidadEspera, readonly [string, string]>> = {
  s: ['segundo', 'segundos'], min: ['minuto', 'minutos'], h: ['hora', 'horas'], dias: ['día', 'días'],
};

/** El nombre de la unidad para `n` de ella («1 día», «2 días»). */
export function rotuloUnidad(u: UnidadEspera, n: number): string {
  return NOMBRE[u][n === 1 ? 0 : 1];
}

/** Los segundos de una espera guardada en minutos (con decimales), redondeados al segundo. 0 = nada. */
export function segundosDeMinutos(minutos: unknown): number {
  const n = Number(minutos);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : 0;
}

/**
 * Los minutos (con decimales) que se GUARDAN para N segundos. Un número entero de minutos vuelve
 * exacto (86 400 / 60 = 1440): lo de siempre no cambia ni en un decimal.
 */
export function minutosDeSegundos(segundos: number): number {
  const s = Math.round(Number(segundos));
  return Number.isFinite(s) && s > 0 ? s / 60 : 0;
}

/** La unidad más grande que la expresa entera: 86 400 s → días, 90 s → segundos, 120 s → minutos. */
export function unidadDe(segundos: number): UnidadEspera {
  const s = Math.max(0, Math.round(segundos));
  if (s > 0 && s % SEGUNDOS_DE.dias === 0) return 'dias';
  if (s > 0 && s % SEGUNDOS_DE.h === 0) return 'h';
  if (s > 0 && s % SEGUNDOS_DE.min === 0) return 'min';
  return 's';
}

/**
 * La unidad que se MUESTRA: la que eligió la persona si la expresa entera; si no, la natural.
 *
 * ⚠️ SIN ESTO LA UNIDAD SALTABA MIENTRAS SE TIPEA: con «segundos» elegido, tipear «120» guardaba
 * 2 min, y al volver a dibujarse la unidad se volvía «minutos» con un «2» en el número, con el
 * cursor todavía adentro. La preferencia manda mientras el valor entre en ella.
 */
export function unidadMostrada(segundos: number, preferida: UnidadEspera | null | undefined): UnidadEspera {
  const s = Math.max(0, Math.round(segundos));
  if (preferida && s > 0 && s % SEGUNDOS_DE[preferida] === 0) return preferida;
  return unidadDe(s);
}

/**
 * La duración en texto corto, para la píldora y «Probar»: «10 s», «90 min», «2 h», «1 día», «3 días».
 * Para un número entero de minutos da EXACTAMENTE lo que daba `textoEspera` antes de los segundos.
 */
export function textoDuracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s % 60 !== 0) return `${s} s`;
  const m = s / 60;
  if (m >= 1440 && m % 1440 === 0) return `${m / 1440} ${m === 1440 ? 'día' : 'días'}`;
  if (m > 0 && m % 60 === 0) return `${m / 60} h`;
  return `${m} min`;
}

// ── La precisión de verdad ─────────────────────────────────────────────────────────────

/**
 * Hasta cuánto se espera ADENTRO de la corrida del motor (`procesarEnvios` duerme y sigue con el
 * paso siguiente en la misma corrida). Más que esto, la espera se agenda al segundo exacto y la
 * cumple la corrida del cron que venga después.
 */
export const ESPERA_EN_CORRIDA_MAX_S = 120;

/**
 * El tope de la corrida del cron para que una espera corta TERMINE, contado desde que empezó la
 * ruta. `app/api/cron/nutricion/route.ts` tiene `maxDuration = 300` y recorre los workspaces de a
 * uno: esperar más tarde que esto le come el tiempo a los workspaces que faltan. Lo pasa la ruta
 * (`procesarEnvios({ esperarHastaMs })`); sin ese dato, el motor no duerme nunca (la vía rápida de
 * un evento corre adentro de un webhook, que no puede quedarse dos minutos colgado).
 */
export const ESPERA_CORRIDA_HASTA_MS = 150_000;

/**
 * CADA CUÁNTO CORRE EL MOTOR, en minutos: `"0 15-23 * * *"` en vercel.json (una vez por hora, de 15
 * a 23 UTC). Lo fija tests/espera-duracion.test.ts leyendo vercel.json: si se cambia la cadencia,
 * el test frena hasta que esto diga lo mismo — y con esto, lo que la pantalla promete.
 */
export const CADENCIA_MOTOR_MIN = 60;

/**
 * ¿Esta espera se cumple ADENTRO de la corrida? Devuelve cuántos ms dormir (0 si ya venció), o null
 * si no: más larga que `ESPERA_EN_CORRIDA_MAX_S`, o termina después de `hastaMs` (el tope que dio la
 * ruta), o no hay tope (null = el que llama no puede esperar).
 */
export function esperaEnLaCorrida(proximoMs: number, ahoraMs: number, hastaMs: number | null | undefined): number | null {
  if (hastaMs == null || !Number.isFinite(hastaMs) || !Number.isFinite(proximoMs)) return null;
  const faltan = proximoMs - ahoraMs;
  if (faltan <= 0) return 0;
  if (faltan > ESPERA_EN_CORRIDA_MAX_S * 1000) return null;
  if (proximoMs > hastaMs) return null;
  return faltan;
}

/**
 * ¿La pantalla tiene que avisar que esta espera puede salir más tarde? Sí para lo que no cabe en la
 * corrida y es más corto que la cadencia del cron (2 min a 59 min): ahí el atraso posible (hasta una
 * vuelta del cron) es más grande que la espera misma. Las de horas y días no: una hora de más sobre
 * un día no cambia lo que se eligió.
 */
export function sinPrecision(segundos: number): boolean {
  return segundos > ESPERA_EN_CORRIDA_MAX_S && segundos < CADENCIA_MOTOR_MIN * 60;
}

/** Lo que dice la pantalla en ese caso. Corto, y con la cadencia de verdad. */
export function avisoDePrecision(): string {
  return CADENCIA_MOTOR_MIN % 60 === 0
    ? `Puede salir hasta ${CADENCIA_MOTOR_MIN / 60} h después`
    : `Puede salir hasta ${CADENCIA_MOTOR_MIN} min después`;
}
