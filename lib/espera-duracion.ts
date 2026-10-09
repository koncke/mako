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
// ⚠️ LA DECISIÓN, CON UN DELAY DE 30 s (lo que la pantalla promete es lo que el motor hace):
//   · Se agenda SIEMPRE al segundo exacto en `proximo_envio_at` (`resolverControl`). Si nadie lo
//     cumple antes, lo toma la corrida del cron que sigue: tarde, nunca perdido.
//   · Hasta `ESPERA_EN_CORRIDA_MAX_S` (120 s) se cumple EN LA MISMA EJECUCIÓN que llegó al DELAY,
//     durmiendo. Hay dos ejecuciones que llegan a un DELAY, y las dos lo hacen:
//       - la corrida del cron (app/api/cron/nutricion/route.ts) le da a `procesarEnvios` su tope
//         (`esperarHastaMs`) y la corrida duerme al final de la vuelta (`dormirEsperaCorta`);
//       - la VÍA RÁPIDA de un evento («Nuevo lead → esperar 30 s → WhatsApp», el caso típico) corre
//         adentro de un webhook o de una server action que tiene que contestar YA: no duerme ahí.
//         Sigue DESPUÉS de contestar, con `after()` de Next (`seguirDespuesDeResponder`,
//         lib/nutricion.ts): duerme lo que falta y vuelve a correr ese lead con su tope.
//     Sin la segunda, los 30 s eran «la corrida que viene»: hasta una hora, o la mañana siguiente.
//   · Más de 120 s depende del cron, que corre a la hora en punto y SÓLO de 15 a 23 UTC: 5 min puede
//     salir hasta una hora tarde, y de noche a la mañana siguiente. La pantalla lo dice con las horas
//     de quien mira (`avisoDePrecision`), para TODA espera que no se cumple adentro de la corrida —
//     también las de horas y días, que de noche se corren igual—.
//   · Lo que NO es de la espera y la pantalla no promete: el anti-ban de 20 h por canal (un segundo
//     WhatsApp al mismo lead espera 20 h aunque el DELAY diga 10 s) y la ventana horaria del negocio.
//   · «Probar» (lib/simulador-grafo.ts) no espera: dice «⏳ Esperar 30 s» y sigue.
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
 * El tope para que una espera corta TERMINE, contado desde que empezó la ejecución que duerme.
 *   · La corrida del cron: `app/api/cron/nutricion/route.ts` tiene `maxDuration = 300` y recorre los
 *     workspaces de a uno; el tope es UNO para toda la ruta (desde que arrancó), así que entre todos
 *     los workspaces no se duermen más de 150 s y a los que faltan les quedan ≥ 150.
 *   · La vía rápida, después de contestar (`seguirDespuesDeResponder`, lib/nutricion.ts): desde que
 *     vuelve a correr el lead, para las esperas cortas que vengan encadenadas detrás.
 * Sin tope (`esperarHastaMs` ausente) `procesarEnvios` no duerme nunca: la vía rápida corre adentro
 * de un webhook, y dos minutos colgado ahí es un reintento del proveedor.
 */
export const ESPERA_CORRIDA_HASTA_MS = 150_000;

/**
 * CADA CUÁNTO CORRE EL MOTOR, en minutos: `"0 15-23 * * *"` en vercel.json (una vez por hora, de 15
 * a 23 UTC). Lo fija tests/espera-duracion.test.ts leyendo vercel.json: si se cambia la cadencia,
 * el test frena hasta que esto diga lo mismo — y con esto, lo que la pantalla promete.
 */
export const CADENCIA_MOTOR_MIN = 60;

/**
 * LAS HORAS EN QUE CORRE EL MOTOR, en UTC: el `15-23` de `"0 15-23 * * *"` (vercel.json). Fuera de
 * esa franja no hay corrida: una espera que vence a las 23:30 UTC sigue a las 15:00 UTC del día
 * siguiente. Lo fija el mismo test que la cadencia.
 */
export const HORAS_MOTOR_UTC = { desde: 15, hasta: 23 } as const;

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
 * ¿La pantalla tiene que avisar cuándo sigue de verdad esta espera? Sí para TODA la que no se cumple
 * adentro de la corrida (más de `ESPERA_EN_CORRIDA_MAX_S`): ésas dependen del cron.
 *
 * ⚠️ ERA «sólo de 2 a 59 min», con el porqué de que «una hora de más sobre un día no cambia lo que se
 * eligió». Eso es cierto de día y falso de noche: el cron corre sólo de 15 a 23 UTC
 * (`HORAS_MOTOR_UTC`), así que «Esperar 2 horas» desde las 22:30 UTC sigue a las 15:00 del día
 * siguiente — 16 h y media, sin que la pantalla dijera nada. Y «Puede salir hasta 1 h después», el
 * aviso de antes, era falso dos tercios del día por lo mismo.
 */
export function sinPrecision(segundos: number): boolean {
  return segundos > ESPERA_EN_CORRIDA_MAX_S;
}

/** «9» o «20:30»: la hora local de una hora UTC, con el desvío de `Date#getTimezoneOffset`. */
function horaLocal(horaUtc: number, offsetMin: number): string {
  const m = (((horaUtc * 60 - offsetMin) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}:${String(mm).padStart(2, '0')}` : String(h);
}

/**
 * Lo que dice la pantalla debajo de una espera que depende del cron: CUÁNDO sigue de verdad, en una
 * línea («Sigue a la hora en punto (9 a 17 h)» para quien mira desde Ciudad de México).
 *
 * `offsetMin` es el de `new Date().getTimezoneOffset()` de quien MIRA (UTC − local, en minutos: 360
 * en Ciudad de México): las horas del cron dichas en UTC no las entiende nadie. Es la zona del
 * navegador y no la del negocio a propósito: el que lee el aviso es el que lo tiene que poder usar.
 * El editor no se dibuja en el server (el panel sólo existe con una tarjeta tocada), así que no hay
 * dos zonas que hidratar.
 */
export function avisoDePrecision(offsetMin = 0): string {
  const cadencia = CADENCIA_MOTOR_MIN === 60 ? 'Sigue a la hora en punto' : `Sigue cada ${CADENCIA_MOTOR_MIN} min`;
  const { desde, hasta } = HORAS_MOTOR_UTC;
  // Las 24 horas: no hay franja que decir.
  if (hasta - desde >= 23) return cadencia;
  const off = Number.isFinite(offsetMin) ? Math.round(offsetMin) : 0;
  return `${cadencia} (${horaLocal(desde, off)} a ${horaLocal(hasta, off)} h)`;
}
