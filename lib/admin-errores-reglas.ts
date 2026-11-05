// =============================================================================
// admin-errores-reglas — Admin › Errors: los errores de la app agrupados, como la lista de problemas de Sentry (5/11/2026)
// =============================================================================
// Martín: «cuándo la app se crashea o los bugs que tienen, el reporte». MaKo ya agrupa cada error por su huella
// (`errores_app`, lib/errores-app.ts, mig 0313) y le abre un ticket de bug: esta pantalla los muestra y nada más. Copiado de la
// lista de Sentry (sus docs en GitHub; el código, FSL, sólo se miró) y de la fila de GlitchTip (MIT, `issues-page.html`): el
// título y en una segunda línea «hace N días · visto hace X», las veces y a cuántos negocios les pasó. Los estados son los de
// Sentry (docs/investigacion-admin.md, «Errors»). Sin `server-only`: lo ejecutan los tests.
//
// ⚠️ «VOLVIÓ» ES LA MISMA REGLA QUE ABRE EL TICKET NUEVO (lib/errores-app.ts): un ticket `resuelto` con su `resuelto_at`, y el
//    error que pasa otra vez más de `MARGEN_REGRESION_MS` después. Con dos reglas, la pantalla diría «resuelto» de algo que ya
//    tiene un ticket nuevo abierto.
// =============================================================================

import { MARGEN_REGRESION_MS } from './errores-app-reglas';

export const DIAS_NUEVO = 7;
const DIA_MS = 86_400_000;

export const ESTADOS_ERROR = ['nuevo', 'volvio', 'sin-resolver', 'resuelto'] as const;
export type EstadoError = (typeof ESTADOS_ERROR)[number];

export const ROTULO_ESTADO_ERROR: Record<EstadoError, { rotulo: string; tono: 'bad' | 'warn' | 'neutral' | 'good' }> = {
  nuevo: { rotulo: 'Nuevo', tono: 'bad' },
  volvio: { rotulo: 'Volvió', tono: 'bad' },
  'sin-resolver': { rotulo: 'Sin resolver', tono: 'warn' },
  resuelto: { rotulo: 'Resuelto', tono: 'good' },
};

/** Los estados del ticket que cierran un error (lo arreglado sin desplegar todavía no está resuelto). */
const CERRADO = new Set(['resuelto', 'rechazado', 'duplicado']);

export type FilaError = {
  id: number;
  titulo: string;
  origen: string;
  veces: number;
  primeraVez: string;
  ultimaVez: string;
  /** La pantalla donde pasó la última vez (sin ids). */
  ruta: string | null;
  mensaje: string | null;
  stack: string | null;
  navegador: string | null;
  /** Los negocios a los que les pasó (sin repetir) y cuántas personas. */
  negocios: number[];
  personas: number;
  ticketId: number | null;
  ticketEstado: string | null;
  ticketResueltoAt: string | null;
};

export function estadoDeError(e: Pick<FilaError, 'primeraVez' | 'ultimaVez' | 'ticketEstado' | 'ticketResueltoAt'>, ahoraMs: number): EstadoError {
  const ult = Date.parse(e.ultimaVez);
  if (e.ticketEstado === 'resuelto' && e.ticketResueltoAt) {
    const res = Date.parse(e.ticketResueltoAt);
    if (Number.isFinite(res) && Number.isFinite(ult) && ult - res > MARGEN_REGRESION_MS) return 'volvio';
  }
  if (e.ticketEstado && CERRADO.has(e.ticketEstado)) return 'resuelto';
  const pri = Date.parse(e.primeraVez);
  if (Number.isFinite(pri) && ahoraMs - pri <= DIAS_NUEVO * DIA_MS) return 'nuevo';
  return 'sin-resolver';
}

/** Las pestañas de Sentry: «Sin resolver» incluye a los nuevos y a los que volvieron. */
export const VISTAS_ERROR = ['abiertos', 'nuevo', 'volvio', 'resuelto'] as const;
export type VistaError = (typeof VISTAS_ERROR)[number];
export const ROTULO_VISTA_ERROR: Record<VistaError, string> = { abiertos: 'Sin resolver', nuevo: 'Nuevos', volvio: 'Volvieron', resuelto: 'Resueltos' };

const enVista = (v: VistaError, e: EstadoError): boolean => (v === 'abiertos' ? e !== 'resuelto' : v === e);

export function conteosDeErrores(filas: readonly FilaError[], ahoraMs: number): Record<VistaError, number> {
  const out: Record<VistaError, number> = { abiertos: 0, nuevo: 0, volvio: 0, resuelto: 0 };
  for (const f of filas) {
    const e = estadoDeError(f, ahoraMs);
    for (const v of VISTAS_ERROR) if (enVista(v, e)) out[v] += 1;
  }
  return out;
}

/** Los de una vista, el visto más reciente primero (el «Last Seen» de Sentry). */
export function erroresVisibles(filas: readonly FilaError[], v: VistaError, ahoraMs: number): FilaError[] {
  return filas.filter((f) => enVista(v, estadoDeError(f, ahoraMs)))
    .slice().sort((a, b) => Date.parse(b.ultimaVez) - Date.parse(a.ultimaVez) || b.veces - a.veces);
}

/** «En el navegador», «En el servidor», «En MaKo». */
export const origenTxt = (o: string): string => ({ navegador: 'En el navegador', servidor: 'En el servidor', mako: 'En MaKo' }[o] ?? o);

/** «hace 3 h», «hace 2 días», «hace 1 mes». */
export function haceTxtCorto(iso: string, ahoraMs: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const min = Math.max(0, Math.floor((ahoraMs - t) / 60_000));
  if (min < 60) return min <= 1 ? 'hace un momento' : `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return d === 1 ? 'hace 1 día' : `hace ${d} días`;
  const m = Math.floor(d / 30);
  return m === 1 ? 'hace 1 mes' : `hace ${m} meses`;
}

/** Lo que dice el estado de un ticket, para el renglón («Ticket #12 · En curso»). */
export const ESTADO_TICKET_TXT: Record<string, string> = {
  nuevo: 'Nuevo', esperando_decision: 'Espera una decisión', esperando_cliente: 'Espera al cliente', en_curso: 'En curso',
  arreglado: 'Arreglado, sin desplegar', resuelto: 'Resuelto', rechazado: 'No era un bug', duplicado: 'Duplicado',
};

/** Lo que guarda `errores_app.ejemplo` y `afectados`, leído con cuidado (son jsonb que escribió el reportador). */
export function filaDeError(r: {
  id: number; titulo: string; origen: string; veces: number; primera_vez: string; ultima_vez: string;
  ejemplo: unknown; afectados: unknown; ticket_id: number | null;
}, ticket: { estado: string; resuelto_at: string | null } | null): FilaError {
  const ej = (r.ejemplo && typeof r.ejemplo === 'object' ? r.ejemplo : {}) as Record<string, unknown>;
  const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  const lista = Array.isArray(r.afectados) ? (r.afectados as Array<{ ws?: unknown; email?: unknown }>) : [];
  const negocios = [...new Set(lista.map((a) => Number(a.ws)).filter((n) => Number.isInteger(n) && n > 0))];
  const personas = new Set(lista.map((a) => (typeof a.email === 'string' ? a.email.toLowerCase() : '')).filter(Boolean)).size;
  return {
    id: Number(r.id), titulo: r.titulo, origen: r.origen, veces: Number(r.veces) || 1,
    primeraVez: r.primera_vez, ultimaVez: r.ultima_vez,
    ruta: txt(ej.ruta), mensaje: txt(ej.mensaje), stack: txt(ej.stack), navegador: txt(ej.navegador),
    negocios, personas,
    ticketId: r.ticket_id == null ? null : Number(r.ticket_id),
    ticketEstado: ticket?.estado ?? null, ticketResueltoAt: ticket?.resuelto_at ?? null,
  };
}
