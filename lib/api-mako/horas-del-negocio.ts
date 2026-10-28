// =============================================================================
// Lo que una LECTURA le da al MODELO: las horas en la zona del negocio, y cada fecha con su día de la semana (28/10/2026)
// =============================================================================
// El diagnóstico de MaKo en WhatsApp (C:/dev/revisiones/2810-diagnostico-mako-whatsapp.md, F3): en Código Inmobiliario, el
// 26/10, MaKo dijo «Francisco Piñeiro Negri - Horario: 20:00 hs» cuando era a las 17:00, y «lunes 27/10» cuando era martes.
// `reuniones_proximas` le daba la hora como el instante de Calendly en UTC (crm.run.ts) y las fechas sin el día: el modelo
// convertía mal o no convertía, y calculaba el día de la semana a mano.
// La regla, para TODAS las lecturas de la API de MaKo y no una por una: lo que lee el modelo (runnerDelRegistro, ejecutar.ts)
// pasa por acá. Un instante con zona («…T20:00:00.000Z», «…-03:00») sale como «2026-10-27 17:00» en la hora del negocio, y
// toda fecha o instante suma al lado su día de la semana (`<campo>_dia_semana`). La fecha sola («2026-10-27») NO cambia: el
// modelo la puede pasar tal cual a otra herramienta. La API HTTP (un programa, no un modelo) recibe los datos crudos.
// ⚠️ PURO: sin server-only, lo prueba tests/horas-del-negocio.test.ts.
// =============================================================================

const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** El día de la semana de una fecha de calendario («2026-10-27» → «martes»). null si no es una fecha. */
export function diaDeLaSemana(fecha: string): string | null {
  const m = FECHA.exec(fecha);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(m[3]) ? null : DIAS[d.getUTCDay()];
}

/** Un instante en la zona del negocio: la fecha, la hora (HH:MM, 24 h) y su día. null si no es un instante con zona. */
export function enLaZona(iso: string, tz: string): { fecha: string; hora: string; dia: string } | null {
  if (!INSTANTE.test(iso)) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  let partes: Intl.DateTimeFormatPart[];
  try {
    partes = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(t);
  } catch { return null; }
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? '';
  const fecha = `${p('year')}-${p('month')}-${p('day')}`;
  const dia = diaDeLaSemana(fecha);
  return dia ? { fecha, hora: `${p('hour')}:${p('minute')}`, dia } : null;
}

/** Lo que se le dice al modelo cuando hubo horas o fechas en la lectura. */
export const NOTA_HORAS = (tz: string) =>
  `Las horas ya están en la hora del negocio (${tz}) y cada fecha trae su día de la semana (*_dia_semana): úsalas tal cual. No conviertas la hora ni calcules el día.`;

/**
 * La salida de una lectura (un JSON en texto) con las horas en la zona del negocio y el día de cada fecha. Un texto que no es
 * JSON, o un JSON sin fechas, vuelve igual.
 */
export function conHorasDelNegocio(salida: string, tz: string): string {
  let j: unknown;
  try { j = JSON.parse(salida); } catch { return salida; }
  let cambio = false;
  const andar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(andar);
    if (!v || typeof v !== 'object') return v;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (typeof x === 'string') {
        const z = enLaZona(x, tz);
        if (z) { out[k] = `${z.fecha} ${z.hora}`; out[`${k}_dia_semana`] = z.dia; cambio = true; continue; }
        const dia = diaDeLaSemana(x);
        if (dia) { out[k] = x; out[`${k}_dia_semana`] = dia; cambio = true; continue; }
        out[k] = x;
        continue;
      }
      out[k] = andar(x);
    }
    return out;
  };
  const nuevo = andar(j);
  if (!cambio) return salida;
  const conNota = nuevo && typeof nuevo === 'object' && !Array.isArray(nuevo)
    ? { ...(nuevo as Record<string, unknown>), zona_horaria: tz, nota_horas: NOTA_HORAS(tz) }
    : nuevo;
  return JSON.stringify(conNota);
}
