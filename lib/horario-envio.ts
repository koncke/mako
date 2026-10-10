// =============================================================================
// horario-envio — el horario en que las automatizaciones le escriben a alguien (OPCIONAL)
// =============================================================================
// Decisión de Martín (09/10/2026, sexta tanda), textual sobre el DELAY: «No entiendo el texto
// "Sigue a la hora en punto", eso no tiene sentido, eliminalo... SI es que configuraste un
// "Horario de oficina" no deberías hacerlo... Eso se hace en todo caso en configuraciones, no
// aquí. No pongas esa limitación.» Y su respuesta del mismo día: «Sin límite, editable».
//
// O sea, tres cosas, y las tres viven acá:
//   · POR DEFECTO NO HAY HORARIO. Una espera se cumple a su hora exacta, de día o de noche. Hasta
//     el 09/10 el motor tenía una ventana fija de 9 a 21 (`VENTANA_INICIO`/`VENTANA_FIN` en
//     lib/nutricion.ts) que nadie podía apagar ni cambiar.
//   · CADA NEGOCIO PUEDE PONER UNO (Configuraciones › Horario). Lo guarda `mako.horario_envio` en
//     `app_settings`, por workspace y SIN herencia (lib/settings.ts no hereda nada).
//   · CON EL HORARIO PRENDIDO, LO QUE VENCE AFUERA SALE AL ABRIR: el motor no manda fuera de
//     horario (la fila queda vencida, nada se pierde) y el tick de cada minuto barre todo lo
//     vencido en el minuto en que el horario abre (`acabaDeAbrir`).
//
// ⚠️ LA HORA ES LA DEL NEGOCIO (`mako.timezone`), con el mismo default que el motor usó siempre
// (`zonaDelMotor`, Ciudad de México). No se averigua por la red: el cron no se cuelga por una zona.
//
// ⚠️ PURO, SIN `server-only` Y SIN IMPORTS: lo importan el motor, el tick, la pantalla de
// Configuraciones y su test. Con un import, la pantalla arrastraría al navegador lo que ése traiga.
// =============================================================================

/** La clave en `app_settings`. Una sola: la leen el motor, el tick y la pantalla. */
export const KEY_HORARIO_ENVIO = 'mako.horario_envio';

/** 0 = domingo … 6 = sábado (el `getDay` de JavaScript, en la zona del negocio). */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type HorarioEnvio = {
  /** false = sin límite (lo de siempre desde el 09/10). Guardado apagado conserva lo elegido. */
  activo: boolean;
  /** La hora en que abre, 0-23 (incluida). */
  desde: number;
  /** La hora en que cierra, 1-24 (excluida: «hasta las 21» manda hasta las 20:59). */
  hasta: number;
  /** Los días en que manda. Vacío no se guarda: un horario sin días es un motor apagado. */
  dias: DiaSemana[];
};

/** Lo que propone la pantalla al prenderlo: la ventana que el motor tenía fija, todos los días. */
export const HORARIO_SUGERIDO: HorarioEnvio = { activo: true, desde: 9, hasta: 21, dias: [0, 1, 2, 3, 4, 5, 6] };

const TODOS: DiaSemana[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * Lo guardado, saneado. `null` = no hay horario (nunca se guardó, está apagado o no se entiende).
 *
 * ⚠️ «NO SE ENTIENDE» CAE EN `null`, o sea sin límite. Es la decisión de Martín para un negocio que
 * no eligió nada; para uno que SÍ eligió y cuya fila se rompió, el costo es mandar de noche. Lo que
 * evita ese caso no es este saneo sino el guardado: `horarioParaGuardar` sólo escribe lo que este
 * mismo módulo entiende. Lo que no se puede LEER (la base caída) no llega acá: el motor lo trata
 * aparte y no manda (lib/nutricion.ts, `procesarEnvios`).
 */
export function sanearHorario(raw: unknown): HorarioEnvio | null {
  let v: unknown = raw;
  if (typeof v === 'string') {
    if (!v.trim()) return null;
    try { v = JSON.parse(v); } catch { return null; }
  }
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const desde = Number(o.desde);
  const hasta = Number(o.hasta);
  if (!Number.isInteger(desde) || !Number.isInteger(hasta)) return null;
  if (desde < 0 || desde > 23 || hasta < 1 || hasta > 24 || hasta <= desde) return null;
  const dias = Array.isArray(o.dias)
    ? [...new Set(o.dias.map(Number).filter((d): d is DiaSemana => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : TODOS;
  if (!dias.length) return null;
  return { activo: o.activo === true, desde, hasta, dias };
}

/** El horario que manda: sólo uno PRENDIDO. Apagado (o sin fila) es «sin límite». */
export function horarioVigente(raw: unknown): HorarioEnvio | null {
  const h = sanearHorario(raw);
  return h && h.activo ? h : null;
}

/**
 * Lo que se escribe en la base, o el motivo por el que no. Valida con las mismas reglas que lee.
 *
 * ⚠️ APAGADO SE GUARDA SIEMPRE (revisión de la sexta tanda, 10/10/2026). Prender, sacar todos los días
 * (o poner el cierre antes de la apertura) y apagar dejaba el «Guardar» habilitado —la pantalla sólo
 * valida prendido— y acá rebotaba con «Elige al menos un día», con los días escondidos. Si lo guardado
 * estaba prendido, seguía limitando los envíos que el dueño quería soltar. Con un `false` LITERAL y lo
 * elegido que no cierra, se guarda apagado con lo sugerido (9 a 21, todos los días): es lo mismo que
 * propone la pantalla sin nada guardado, y al volver a prenderlo se ve eso. Cualquier otra cosa que no
 * se entienda sigue siendo un error: un pedido roto no apaga el horario de nadie.
 */
export function horarioParaGuardar(h: unknown): { ok: true; valor: string } | { ok: false; error: string } {
  const s = sanearHorario(h);
  if (!s) {
    const o = (h ?? {}) as Record<string, unknown>;
    if (o.activo === false) return { ok: true, valor: JSON.stringify({ ...HORARIO_SUGERIDO, activo: false }) };
    if (Array.isArray(o.dias) && !o.dias.length) return { ok: false, error: 'Elige al menos un día.' };
    return { ok: false, error: 'La hora de cierre tiene que ser después de la de apertura.' };
  }
  return { ok: true, valor: JSON.stringify(s) };
}

/** La hora (0-23), el minuto y el día de la semana de un instante en una zona. */
export function relojEnZona(ahoraMs: number, tz: string): { hora: number; minuto: number; dia: DiaSemana } {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23' })
    .formatToParts(new Date(ahoraMs));
  const de = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  const DIAS: Record<string, DiaSemana> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hora: Number(de('hour')) % 24, minuto: Number(de('minute')) || 0, dia: DIAS[de('weekday')] ?? 0 };
}

/** ¿Este instante cae adentro del horario, en la zona del negocio? Sin horario, siempre. */
export function dentroDelHorario(ahoraMs: number, tz: string, h: HorarioEnvio | null): boolean {
  if (!h) return true;
  const r = relojEnZona(ahoraMs, tz);
  return h.dias.includes(r.dia) && r.hora >= h.desde && r.hora < h.hasta;
}

/**
 * ¿El horario ABRIÓ hace menos de `minutos`? Es lo que hace que «lo que vence afuera sale al abrir»
 * sea cierto: el tick de cada minuto (app/api/cron/nutricion-tick) barre ENTERO lo vencido de ese
 * negocio en esa ventana, no sólo lo que acaba de vencer. Sin horario, nunca (no hay apertura).
 *
 * `minutos` es la ventana del tick (`VENTANA_FRESCA_MIN`, lib/espera-duracion.ts): con un tick que
 * se saltee un minuto, la apertura igual se ve en el siguiente.
 */
export function acabaDeAbrir(ahoraMs: number, tz: string, h: HorarioEnvio | null, minutos: number): boolean {
  if (!h) return false;
  if (!dentroDelHorario(ahoraMs, tz, h)) return false;
  const r = relojEnZona(ahoraMs, tz);
  return r.hora === h.desde && r.minuto < Math.max(1, minutos);
}

/** «09:00» / «24:00» para la pantalla. */
export const horaTexto = (h: number): string => `${String(h).padStart(2, '0')}:00`;

/** Las iniciales de los días, en el orden en que se dibujan (lunes primero). */
export const DIAS_PANTALLA: ReadonlyArray<{ dia: DiaSemana; corto: string; nombre: string }> = [
  { dia: 1, corto: 'L', nombre: 'lunes' }, { dia: 2, corto: 'M', nombre: 'martes' }, { dia: 3, corto: 'M', nombre: 'miércoles' },
  { dia: 4, corto: 'J', nombre: 'jueves' }, { dia: 5, corto: 'V', nombre: 'viernes' }, { dia: 6, corto: 'S', nombre: 'sábado' },
  { dia: 0, corto: 'D', nombre: 'domingo' },
];
