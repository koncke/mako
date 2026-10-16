// =============================================================================
// El Uso de cada cuenta de Claude, siempre a la vista en el Centro (16/10/2026; puro, con test)
// =============================================================================
// Martín (16/10/2026): «El "Uso" debe ser visible siempre, me imagino como un desplegable donde hoy está "Cartero". Y
// que "Cartero" (que ya no debería llamarse así), sea también el mismo desplegable... Que ahí se vean ambas cosas». Y
// mirándolo en producción: «Falta el poder visualizar el USO».
//
// DE DÓNDE SALE (medido en el CLI 2.1.299 de esta PC, 16/10/2026): la barra de estado de Claude Code recibe, en cada
// cuenta, `rate_limits.five_hour` y `rate_limits.seven_day` con `used_percentage` y `resets_at` (segundos unix). El Runner
// de cada terminal se abre con esa barra (`cartero.mjs uso`, lib/runner.ts), que anota la cuota de SU cuenta; la vuelta
// la sube a MaKo (`operaciones_carteros.cuota`, mig 0285, sin usar hasta hoy). La app de escritorio no tiene barra de
// estado: de su cuenta se usa la medición de `get_usage` que ya guarda ~/.claude/uso-semanal.txt (sólo la semanal).
//
// ⚠️ UN NÚMERO VIEJO NO SE MUESTRA COMO DE AHORA: pasado el reinicio de una ventana, su porcentaje ya no vale (se dice
// «se reinició»), y una medición de hace más de 30 minutos lleva su edad.
// ⚠️ SIN `server-only`: lo usan el servidor (al guardar) y la pantalla (al dibujar).

export type Ventana = { pct: number; reinicia: string | null };
/** La cuota de una cuenta como la sube su Runner. */
export type Cuota = { cinco: Ventana | null; semana: Ventana | null; medido: string };

const ISO = (v: unknown): string | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);

function ventana(x: unknown): Ventana | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const pct = typeof o.pct === 'number' && Number.isFinite(o.pct) ? Math.min(100, Math.max(0, Math.round(o.pct))) : null;
  if (pct == null) return null;
  return { pct, reinicia: ISO(o.reinicia) };
}

/** Lo que guarda MaKo de lo que sube un Runner: dos ventanas acotadas y cuándo se midió. null = no subió nada que valga. */
export function sanearCuota(x: unknown): Cuota | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const medido = ISO(o.medido);
  const cinco = ventana(o.cinco);
  const semana = ventana(o.semana);
  if (!medido || (!cinco && !semana)) return null;
  return { cinco, semana, medido };
}

/** Una medición de hace más que esto lleva su edad al lado. */
export const USO_VIEJO_MS = 30 * 60 * 1000;

export type UsoVentana = { pct: number | null; reinicia: number | null; reinicio: boolean };
export type UsoDeCuenta = { cinco: UsoVentana | null; semana: UsoVentana | null; medido: number | null; viejo: boolean };

/** Cómo se lee la cuota de una cuenta ahora: pasado el reinicio, el porcentaje ya no vale. */
export function usoDeCuenta(c: Cuota | null | undefined, ahora: number): UsoDeCuenta {
  const medido = c ? Date.parse(c.medido) : NaN;
  const leer = (v: Ventana | null | undefined): UsoVentana | null => {
    if (!v) return null;
    const r = v.reinicia ? Date.parse(v.reinicia) : NaN;
    const reinicio = Number.isFinite(r) && r <= ahora;
    return { pct: reinicio ? null : v.pct, reinicia: Number.isFinite(r) ? r : null, reinicio };
  };
  return {
    cinco: leer(c?.cinco), semana: leer(c?.semana),
    medido: Number.isFinite(medido) ? medido : null,
    viejo: !Number.isFinite(medido) || ahora - medido > USO_VIEJO_MS,
  };
}

/**
 * El número del botón, siempre a la vista: la semana MÁS usada entre las cuentas medidas hace poco (es la que se va a
 * terminar primero). Si ninguna se midió hace poco, la más usada de las viejas, con su edad (`viejo`): un número de hace
 * días no se muestra como de ahora (revisión adversarial, 16/10/2026). null = ninguna cuenta midió todavía.
 */
export type UsoPrincipal = { cuenta: string; pct: number; viejo: boolean; medido: number | null };
export function usoPrincipal(cuotas: readonly { cuenta: string; cuota: Cuota | null }[], ahora: number): UsoPrincipal | null {
  let fresco: UsoPrincipal | null = null;
  let viejo: UsoPrincipal | null = null;
  for (const { cuenta, cuota } of cuotas) {
    const u = usoDeCuenta(cuota, ahora);
    const pct = u.semana?.pct;
    if (pct == null) continue;
    const este = { cuenta, pct, viejo: u.viejo, medido: u.medido };
    if (!u.viejo) { if (!fresco || pct > fresco.pct) fresco = este; } else if (!viejo || pct > viejo.pct) viejo = este;
  }
  return fresco ?? viejo;
}

/**
 * El Runner de una cuenta, como lo ve el Uso: `mide` = su Runner de terminal está abierto y midiendo (una cuota de 5 h
 * medida hace poco: la de la app sólo trae la semanal); `sin_terminal` = la cuenta da vueltas (otro Runner la recorre,
 * como el de ~/.claude, que pasa por las tres) pero la terminal de ESTA cuenta no tiene el suyo; `apagado` = nadie la
 * recorre. ⚠️ Con sólo `visto_at`, la cuenta 2 salía «activa» aunque su terminal no tuviera Runner (revisión, 16/10/2026).
 */
export type EstadoRunnerUso = 'mide' | 'sin_terminal' | 'apagado';
export function estadoRunnerUso(vivo: boolean, cuota: Cuota | null | undefined, ahora: number): EstadoRunnerUso {
  if (!vivo) return 'apagado';
  const u = usoDeCuenta(cuota, ahora);
  return !u.viejo && cuota?.cinco ? 'mide' : 'sin_terminal';
}

const AR = 'America/Argentina/Buenos_Aires';
const diaAR = (t: number) => Math.floor((t - 3 * 3_600_000) / 86_400_000);
/** «a las 14:00» hoy, «mañana a las 06:00», o «el mar 21 a las 06:00»: con el reloj de Martín. */
export function textoReinicio(t: number | null, ahora: number): string {
  if (t == null) return '';
  const hora = new Date(t).toLocaleTimeString('es-AR', { timeZone: AR, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const d = diaAR(t) - diaAR(ahora);
  if (d <= 0) return `a las ${hora}`;
  if (d === 1) return `mañana a las ${hora}`;
  const dia = new Date(t).toLocaleDateString('es-AR', { timeZone: AR, weekday: 'short', day: 'numeric' }).replace('.', '').replace(',', '');
  return `el ${dia} a las ${hora}`;
}

/**
 * Lo que la barra de estado de Claude Code le pasa a su comando (stdin), reducido a la cuota (cartero.mjs `uso` la anota
 * con esta misma forma). `resets_at` viene en SEGUNDOS unix. null = esa sesión no trae cuota (una clave de API, o un
 * Claude Code de antes).
 */
export function cuotaDeBarraDeEstado(x: unknown, ahora: number): Cuota | null {
  const rl = (x as { rate_limits?: Record<string, { used_percentage?: unknown; resets_at?: unknown } | null> } | null)?.rate_limits;
  if (!rl || typeof rl !== 'object') return null;
  const v = (w: { used_percentage?: unknown; resets_at?: unknown } | null | undefined): Ventana | null => {
    if (!w || typeof w.used_percentage !== 'number' || !Number.isFinite(w.used_percentage)) return null;
    const s = typeof w.resets_at === 'number' && Number.isFinite(w.resets_at) ? new Date(w.resets_at * 1000).toISOString() : null;
    return { pct: Math.min(100, Math.max(0, Math.round(w.used_percentage))), reinicia: s };
  };
  return sanearCuota({ cinco: v(rl.five_hour), semana: v(rl.seven_day), medido: new Date(ahora).toISOString() });
}
