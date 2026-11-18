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

import { CUENTAS } from '../app/admin/dev/_registro/tipos';

export type Ventana = { pct: number; reinicia: string | null };
/**
 * La cuota de una cuenta como la sube su Runner. `plan` («Max», «Pro»): lo que la PC sepa del plan de la cuenta (17/10/2026,
 * Martín: «no sale qué plan tiene»). ⚠️ Sin `plan` la clave NO existe (no `plan: null`): la PC (cartero.mjs) arma la cuota
 * sin esa clave y tests/centro-uso.test.ts compara las dos lecturas con deepEqual. Se lee siempre con `cuota.plan ?? null`.
 */
export type Cuota = { cinco: Ventana | null; semana: Ventana | null; medido: string; plan?: string | null };

const ISO = (v: unknown): string | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);

/** Lo más largo que mide el plan en pantalla («Max 20x», «Enterprise»). */
export const PLAN_MAX = 24;
/**
 * El plan que sube una PC, saneado: texto corto con letras, números, espacio, punto, «+» y «-» (nada de etiquetas ni
 * símbolos raros: se dibuja en un chip). null = no vino o quedó vacío.
 */
export function sanearPlan(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const t = x.normalize('NFC').replace(/[^\p{L}\p{N} .+-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, PLAN_MAX).trim();
  return t || null;
}

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
  const plan = sanearPlan(o.plan);
  return plan ? { cinco, semana, medido, plan } : { cinco, semana, medido };
}

/**
 * ¿La semana de esta cuota es de OTRA cuenta? (20/10/2026, la segunda vez que el Uso mostró los números de una cuenta en
 * otra.) Cada cuenta reinicia su semana siempre a la misma hora: si el reinicio coincide (±5 min) con el de otra cuenta que
 * todavía no venció, la medición es de ésa, y no se guarda. Es la misma huella que mira la PC antes de anotar (cartero
 * 1.16.1 → problemaDeHuella); acá frena también a un cartero de antes. Devuelve la cuenta dueña, o null.
 */
export function cuentaDeLaSemana(
  cuenta: string, cuota: Pick<Cuota, 'semana'> | null, otras: ReadonlyArray<{ cuenta: string; cuota: Pick<Cuota, 'semana'> | null }>, ahora: number,
): string | null {
  const t = Date.parse(cuota?.semana?.reinicia ?? '');
  if (!Number.isFinite(t)) return null;
  for (const o of otras) {
    if (o.cuenta === cuenta) continue;
    const r = Date.parse(o.cuota?.semana?.reinicia ?? '');
    if (Number.isFinite(r) && r > ahora && Math.abs(r - t) <= 5 * 60_000) return o.cuenta;
  }
  return null;
}

/** Una medición de hace más que esto lleva su edad al lado. */
export const USO_VIEJO_MS = 30 * 60 * 1000;
/**
 * Una medición de hace más que esto ya NO es un dato para DECIDIR (17/10/2026, Martín: «el Uso de una cuenta muestra datos
 * viejos»): el botón no la usa. Lo obvio era «el número está mal», y el número era el de otra cuenta en su archivo (lo
 * corrigió el Cerebro); lo que faltaba es que una medición vieja no se lea como de ahora.
 * ⚠️ Desde el 22/10/2026 la TARJETA no la apaga: muestra el último número en gris con su edad («99% · medido hace 14 h»).
 * Apagarla («Sin medir hace X», barras vacías) escondía justo lo que Martín necesita ver: qué cuenta ya no tiene lugar.
 */
export const USO_VENCIDO_MS = 6 * 3_600_000;

/**
 * `pct`: lo que VALE ahora (null pasado el reinicio): lo leen el botón, «Automático» y el aviso de la cuota, que deciden con él.
 * `ultimo`: lo que dijo la última medición, haya pasado o no el reinicio. Lo dibuja la tarjeta (22/10/2026, Martín: «Cuando no
 * mide hace mucho tiempo no debería desaparecer los % de uso que tenía la última vez... esa cuenta ya estaba al 99% semanal, y
 * ahora ya no aparece»), siempre con su edad al lado; nunca decide nada.
 */
export type UsoVentana = { pct: number | null; ultimo: number; reinicia: number | null; reinicio: boolean };
/** `vencido`: la medición tiene más de `USO_VENCIDO_MS` (o no hay): sus porcentajes no se muestran como vigentes. */
export type UsoDeCuenta = { cinco: UsoVentana | null; semana: UsoVentana | null; medido: number | null; viejo: boolean; vencido: boolean };

/** Cómo se lee la cuota de una cuenta ahora: pasado el reinicio, el porcentaje ya no vale. */
export function usoDeCuenta(c: Cuota | null | undefined, ahora: number): UsoDeCuenta {
  const medido = c ? Date.parse(c.medido) : NaN;
  const leer = (v: Ventana | null | undefined): UsoVentana | null => {
    if (!v) return null;
    const r = v.reinicia ? Date.parse(v.reinicia) : NaN;
    const reinicio = Number.isFinite(r) && r <= ahora;
    return { pct: reinicio ? null : v.pct, ultimo: v.pct, reinicia: Number.isFinite(r) ? r : null, reinicio };
  };
  return {
    cinco: leer(c?.cinco), semana: leer(c?.semana),
    medido: Number.isFinite(medido) ? medido : null,
    viejo: !Number.isFinite(medido) || ahora - medido > USO_VIEJO_MS,
    vencido: !Number.isFinite(medido) || ahora - medido > USO_VENCIDO_MS,
  };
}

/**
 * El número del botón, siempre a la vista: LA CUENTA EN USO, la medida más recientemente, con su nombre al lado.
 * ⚠️ HASTA EL 30/10/2026 ERA LA MÁS USADA (16/10: «la que se va a terminar primero»). Con las cuentas de a una, eso mostraba «95% ·
 * Cuenta 3» trabajando en la 1, con un número que no se movía con nada. Martín: «aun en ops center no se mide el uso». Lo que le
 * queda a las otras está en el modal. `medido` es cuándo cambió la cuota, o sea cuándo se usó la cuenta.
 * Una medición vencida no cuenta; una vieja lleva su edad (`viejo`). null = ninguna midió hace poco.
 */
export type UsoPrincipal = { cuenta: string; pct: number; viejo: boolean; medido: number | null };
export function usoPrincipal(cuotas: readonly { cuenta: string; cuota: Cuota | null }[], ahora: number): UsoPrincipal | null {
  let enUso: UsoPrincipal | null = null;
  for (const { cuenta, cuota } of cuotas) {
    const u = usoDeCuenta(cuota, ahora);
    const pct = u.semana?.pct;
    // Una medición vencida no es un dato: el botón dice «—» antes que un número de hace un día.
    if (pct == null || u.vencido || u.medido == null) continue;
    if (!enUso || u.medido > (enUso.medido ?? 0)) enUso = { cuenta, pct, viejo: u.viejo, medido: u.medido };
  }
  return enUso;
}

/** Una cuenta en el desplegable del Uso: su Runner (visto_at) y su cuota; sin Runner, `vistoAt: null, cuota: null`. */
export type CuentaDeUso = { cuenta: string; vistoAt: string | null; cuota: Cuota | null };

/**
 * TODAS LAS CUENTAS (hoy cinco), SIEMPRE, en orden (17/10/2026, Martín: «Tampoco sale el uso de las otras 2 cuentas»). La lista del
 * Uso salía de los carteros, o sea de las cuentas con un Runner declarado: una cuenta sin Runner no aparecía, y parecía
 * que no existía. Ahora se parte del registro de cuentas (app/admin/dev/_registro/tipos.ts → CUENTAS) y a cada una se le
 * pone su Runner si lo tiene; la que no, queda `vistoAt: null, cuota: null` («Sin Runner todavía»). Un Runner de una
 * cuenta que el registro no conoce no se pierde: va al final, por número.
 * `cuentas` por parámetro para que el test no dependa del registro.
 */
export function cuentasDeUso(
  carteros: readonly { cuenta: string; vistoAt: string | null; cuota?: Cuota | null }[],
  cuentas: readonly string[] = Object.keys(CUENTAS),
): CuentaDeUso[] {
  const porCuenta = new Map(carteros.map((k) => [k.cuenta, { cuenta: k.cuenta, vistoAt: k.vistoAt ?? null, cuota: k.cuota ?? null }] as const));
  const conocidas = new Set(cuentas);
  const extra = [...porCuenta.keys()].filter((c) => !conocidas.has(c)).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  return [...cuentas, ...extra].map((c) => porCuenta.get(c) ?? { cuenta: c, vistoAt: null, cuota: null });
}

/**
 * El Runner de una cuenta, como lo ve el Uso: `mide` = se midió hace poco; `sin_terminal` = la cuenta da vueltas (otro Runner la
 * recorre: `visto_at` lo refresca la vuelta para TODAS) pero no se mide ahora; `apagado` = nadie la recorre.
 * ⚠️ Con sólo `visto_at`, una cuenta cerrada hace días salía «Runner activo» con punto verde al lado de «78% · medido hace 6 días»
 * (la misma trampa del 16/10, y volvió el 30/10): un dato viejo con fecha nueva.
 */
export type EstadoRunnerUso = 'mide' | 'sin_terminal' | 'apagado';
export function estadoRunnerUso(vivo: boolean, cuota: Cuota | null | undefined, ahora: number): EstadoRunnerUso {
  if (!vivo) return 'apagado';
  return usoDeCuenta(cuota, ahora).viejo ? 'sin_terminal' : 'mide';
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

/** Un reinicio que ya pasó: «hoy a las 06:00», «ayer a las 22:59» o «el lun 20 a las 06:00», con el reloj de Martín. */
export function textoReinicioPasado(t: number, ahora: number): string {
  const hora = new Date(t).toLocaleTimeString('es-AR', { timeZone: AR, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const d = diaAR(ahora) - diaAR(t);
  if (d <= 0) return `hoy a las ${hora}`;
  if (d === 1) return `ayer a las ${hora}`;
  const dia = new Date(t).toLocaleDateString('es-AR', { timeZone: AR, weekday: 'short', day: 'numeric' }).replace('.', '').replace(',', '');
  return `el ${dia} a las ${hora}`;
}

// ── El consumo de un trabajo, por fase (18/11/2026) ───────────────────────────────────────────────────────────────────
// Pedido de Aaron por Martín (ticket 876825880-11): «Sonnet para explorar, Opus para ejecutar, midiendo el consumo antes y
// después». Lo que se mide es lo de ARRIBA, la cuota de la CUENTA: la PC anota la cuota al entregar el trabajo, al pasar a
// ejecutar (`cartero.mjs fase <id> ejecutar`) y al cerrarlo (`cierre`), y el cierre sube con esas fotos (`consumo`).
// ⚠️ ES EL USO DE LA CUENTA, NO DEL CHAT: con otros chats trabajando en la misma cuenta, la diferencia incluye lo de ellos.
//    La cuota no se mide por chat en ningún lado (ni la barra de estado ni get_usage lo dan): por eso cada número va con la
//    nota de qué mide. Y es en puntos ENTEROS de la ventana (la cuota se guarda redondeada).
// ⚠️ UNA DIFERENCIA SÓLO VALE ENTRE DOS MEDICIONES DE LA MISMA VENTANA: si entre las dos se reinició (otro `reinicia`), o la
//    del final no es más nueva que la del principio (nadie midió en el medio), no hay número: se dice por qué.

/** Las fases de un trabajo: `explorar` y `ejecutar` con «Automático» por fase; `todo`, un trabajo sin fases. */
export const FASES = ['explorar', 'ejecutar', 'todo'] as const;
export type Fase = (typeof FASES)[number];
/** Cómo corrió: por fase, con el modelo que eligió Martín, o sin tocar el modelo del chat. */
export const MODOS_CONSUMO = ['por_fase', 'elegido', 'sin_tocar'] as const;
export type ModoConsumo = (typeof MODOS_CONSUMO)[number];
/** Una fase con la cuota de su cuenta cuando arrancó. `modelo`: la familia que se le pidió al Runner (null = sin tocar). */
export type FaseMedida = { fase: Fase; modelo: string | null; desde: string; cuota: Cuota | null };
/** Lo que sube el cierre de un trabajo: sus fases y la cuota al cerrarlo. Lo sanea `sanearConsumo` (lib/operaciones-reglas.ts). */
export type Consumo = { modo: ModoConsumo; fases: FaseMedida[]; fin: { at: string; cuota: Cuota | null } };

/** Lo que gastó una fase, en puntos de cada ventana. null = no se puede decir; `motivo` dice por qué en la de 5 horas. */
export type GastoDeFase = { fase: Fase; modelo: string | null; minutos: number | null; cinco: number | null; semana: number | null; motivo: string | null };

/** La diferencia de UNA ventana entre dos fotos de la cuota, o el motivo por el que no hay número. */
function diferencia(a: Cuota | null, b: Cuota | null, cual: 'cinco' | 'semana'): { puntos: number | null; motivo: string | null } {
  const va = a?.[cual];
  const vb = b?.[cual];
  if (!a || !b || !va || !vb) return { puntos: null, motivo: 'sin medir' };
  // Sin una medición nueva en el medio, la foto del final es la misma del principio: un 0 sería inventado.
  if (!(Date.parse(b.medido) > Date.parse(a.medido))) return { puntos: null, motivo: 'nadie midió en el medio' };
  const ra = Date.parse(va.reinicia ?? '');
  const rb = Date.parse(vb.reinicia ?? '');
  if (Number.isFinite(ra) && Number.isFinite(rb) && Math.abs(ra - rb) > 5 * 60_000) return { puntos: null, motivo: 'se reinició la ventana' };
  const puntos = vb.pct - va.pct;
  return puntos < 0 ? { puntos: null, motivo: 'se reinició la ventana' } : { puntos, motivo: null };
}

/** Lo que gastó cada fase: de la foto con que arrancó a la de la fase siguiente (o la del cierre). */
export function gastoPorFase(c: Consumo): GastoDeFase[] {
  return c.fases.map((f, i) => {
    const sig = c.fases[i + 1];
    const fin = sig ? { at: sig.desde, cuota: sig.cuota } : c.fin;
    const cinco = diferencia(f.cuota, fin.cuota, 'cinco');
    const semana = diferencia(f.cuota, fin.cuota, 'semana');
    const t0 = Date.parse(f.desde);
    const t1 = Date.parse(fin.at);
    const minutos = Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0 ? Math.round((t1 - t0) / 60_000) : null;
    // El motivo es el de la ventana de 5 horas, la que se compara: en un solo trabajo, la semanal casi no se mueve.
    return { fase: f.fase, modelo: f.modelo, minutos, cinco: cinco.puntos, semana: semana.puntos, motivo: cinco.motivo };
  });
}

/**
 * Para COMPARAR (el «antes y después» del pedido): por modo y por fase, cuántos trabajos tienen número y el promedio de puntos
 * de la ventana de 5 horas. Lo que no tiene número no entra al promedio, pero se cuenta (`sinNumero`): un promedio de 1 de 9
 * no se lee como el de 9.
 */
/** Lo que acompaña cada número de consumo, donde se muestre (la API de MaKo lo devuelve al lado). */
export const NOTA_CONSUMO = 'Es lo que subió el uso de la CUENTA entre que empezó y terminó cada fase, en puntos de la ventana de 5 horas (y de la semana): si otros chats trabajaban en la misma cuenta, incluye lo de ellos. Sin número cuando nadie midió en el medio o la ventana se reinició.';
export type FilaComparacion = { modo: ModoConsumo; fase: Fase; modelo: string | null; trabajos: number; sinNumero: number; promedioCinco: number | null };
export function compararConsumo(lista: readonly Consumo[]): FilaComparacion[] {
  const filas = new Map<string, FilaComparacion & { suma: number }>();
  for (const c of lista) {
    for (const g of gastoPorFase(c)) {
      const k = `${c.modo}|${g.fase}|${g.modelo ?? ''}`;
      const f = filas.get(k) ?? { modo: c.modo, fase: g.fase, modelo: g.modelo, trabajos: 0, sinNumero: 0, promedioCinco: null, suma: 0 };
      if (g.cinco == null) f.sinNumero++;
      else { f.trabajos++; f.suma += g.cinco; }
      filas.set(k, f);
    }
  }
  return [...filas.values()].map(({ suma, ...f }) => ({ ...f, promedioCinco: f.trabajos ? Math.round((suma / f.trabajos) * 10) / 10 : null }));
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
