// =============================================================================
// plan-acceso-reglas — ¿este negocio sigue pagando su lugar en MaKo? (lo puro)
// =============================================================================
// «Quien deja de pagar sigue entrando» (docs/hallazgos-planes-y-cobro.md): darse de baja cortaba el COBRO pero no
// el ACCESO, y una renovación de agencia sin autorizar tampoco cortaba nada. No existía el estado de suscripción por
// negocio. Estas reglas lo DERIVAN de los cobros de la plataforma, sin una tabla nueva: lo que MaKo cobra por el lugar
// de un negocio vive en `cobros` del ws de la plataforma, atado al negocio por `alta_ws` (un plan vendido con el
// alta automática) o por `cliente_ws` (el lugar de un cliente de agencia, mig 0308).
//
// LA COBERTURA (23/10/2026, pedido de Martín del 22/10: «si alguien no paga que se le expulse de la app... le tiene que
// quedar una deuda pendiente... apenas tenés plata en tu cuenta ya te lo cobran de manera automática»). Hasta este día
// una suscripción «activa y pagada» daba al día PARA SIEMPRE: una renovación rechazada no cortaba nada. Ahora cada MES
// COBRADO (una cuota pagada del cobro; un cobro único de deuda vale `meses`) extiende lo cubierto un mes:
//   · Un pago que llega antes de que se termine lo cubierto, o hasta TOLERANCIA_DIAS después (un reintento de la
//     tarjeta, una deuda que se paga tarde), paga el período QUE SE DEBÍA: extiende desde el fin, sin correr la fecha.
//     Uno que llega después es alguien que vuelve: empieza de nuevo desde su fecha.
//   · Con la suscripción ACTIVA (la pasarela sigue cobrando) y lo cubierto terminado: MORA. Se sigue entrando, con el
//     aviso de la deuda, y la pasarela reintenta sola (Stripe con sus Smart Retries, Mercado Pago 4 veces en 10 días).
//     A los DIAS_PARA_SUSPENDER del fin: VENCIDO por impago, y el negocio se pausa (los datos no se tocan nunca).
//   · La DEUDA son los ciclos que la pasarela tenía que cobrar y no cobró, a la mensualidad del cobro.
//   · Antes de pausar por impago, lib/plan-acceso.ts le pregunta a la pasarela (un aviso perdido no deja afuera a
//     quien pagó).
//
// LO QUE SE DECIDIÓ (17/10/2026, sin Martín, con la vara de AGENTS.md: se copia lo que hacen Stripe y Paddle):
//   · Sólo se corta a quien MaKo le vendió el acceso POR LA PASARELA. Un negocio sin un cobro de la plataforma (el ws1,
//     los clientes con un acuerdo a mano) no tiene nada que vencer: nunca se corta.
//   · Quien pagó el mes lo usa hasta el final (Stripe y Paddle programan la baja al fin del período pagado). El corte
//     llega a los GRACIA_DIAS de que se terminó lo pagado.
//   · Un pago devuelto (reembolsado) no cubre nada. Pero con la suscripción ACTIVA, un reembolso no corta: lo que corta
//     es que no pague (revisión del 17/10: «un primer pago devuelto con la suscripción activa pausa a quien paga»).
//   · Una renovación de agencia que la agencia no autorizó: lo pagado termina el día que la renovación tenía que
//     empezar a cobrar (`inicio_at`, que es «un mes después del fin del onboarding»). El cliente de agencia sigue con
//     sus reglas de siempre (`vigenciaDeClienteDeAgencia`): su mes corre desde el fin del onboarding, no desde el pago.
//   · Los planes son MENSUALES. Un plan anual pediría `meses` en su cobro.
// =============================================================================

import { esBajaPedida } from './cobros-reglas';
import { esPruebaDePlan } from './prueba-plan-reglas';
import { PREFIJO_RENOVACION_FALLIDA } from './cobrado-lead';

/** ¿La pasarela avisó que la renovación de esta suscripción FALLÓ? (el motivo que deja `aplicarPagoFallido` y borra la renovación que entra). */
const renovacionFallida = (m: string | null | undefined): boolean => typeof m === 'string' && m.startsWith(PREFIJO_RENOVACION_FALLIDA);

/**
 * ⚠️ EL CORTE DE ACCESO. APAGADO desde la revisión adversarial del 17/10/2026; los defectos (el cron sólo veía `alta_ws`,
 * un primer pago devuelto con la suscripción activa pausaba a quien paga, las cuotas sin paginar) se arreglaron el
 * 23/10/2026 con la cobertura de arriba y lib/plan-acceso.ts. Se prende con su revisión adversarial.
 * Con esto en false: el cron no pausa ni reabre nada y un negocio pausado se abre como siempre.
 */
export const CORTE_DE_ACCESO_PRENDIDO: boolean = false;

/** Días entre que se termina lo pagado (una baja, una devolución) y que se corta el acceso. */
export const GRACIA_DIAS = 5;
/** Días de mora (la renovación no entró y la pasarela reintenta) antes de suspender. */
export const DIAS_PARA_SUSPENDER = 7;
/** Días después del fin de lo cubierto en que una renovación todavía «está llegando» (el aviso tarda): sin aviso de deuda. */
export const DIAS_SIN_AVISO = 2;
/** Hasta cuántos días tarde un pago paga el período que se debía (y no empieza uno nuevo). */
export const TOLERANCIA_DIAS = 62;
const DIA_MS = 86_400_000;

/** Lo que estas reglas necesitan de un cobro de la plataforma (un subconjunto de `Cobro` + las columnas de 0308/0330). */
export type CobroDelLugar = {
  id: number;
  tipo: 'unico' | 'suscripcion';
  estado: 'pendiente' | 'pagado' | 'fallido' | 'anulado' | 'reembolsado';
  suscripcion_estado: 'activa' | 'cancelada' | null;
  pagado_at: string | null;
  reembolsado_at: string | null;
  inicio_at?: string | null;
  created_at: string;
  /** El lugar de un cliente de agencia (mig 0308): sus reglas son otras. */
  cliente_ws?: number | null;
  /** Meses que paga un cobro único (mig 0330; null = 1). */
  meses?: number | null;
  monto?: number | null;
  moneda?: string | null;
  monto_usd?: number | null;
  /** Para saber si la baja ya está pedida (la suscripción sigue «activa» hasta el fin del período en Stripe). */
  motivo?: string | null;
  /** Para reconocer la PRUEBA GRATIS (lib/prueba-plan-reglas.ts, `esPruebaDePlan`). */
  creado_por?: string | null;
  alta_capa?: string | null;
};

/** Una cuota cobrada de ese cobro (las renovaciones son una cuota por mes, con `cobro_id`). */
export type PagoDelLugar = { cobro_id: number; pagado: boolean; fecha_pago: string | null };

/** Lo que se debe: los ciclos que la pasarela no cobró, a la mensualidad del cobro que los cobra. */
export type Deuda = { cobroId: number; ciclos: number; monto: number | null; moneda: string | null; montoUsd: number | null; desde: string };

export type Vigencia =
  | { estado: 'sin-pasarela' }
  | { estado: 'al-dia'; cobroId: number; hasta?: string }
  | { estado: 'mora'; cobroId: number; hasta: string; deuda: Deuda }
  | { estado: 'cubierto'; cobroId: number; hasta: string; motivo: MotivoCorte }
  | { estado: 'vencido'; cobroId: number; hasta: string; motivo: MotivoCorte; deuda?: Deuda };

/** `sin-agencia` (29/10/2026, lib/agencia-baja.ts): la agencia dio de baja la cuenta de su cliente; la reabre SÓLO su propio plan. */
export type MotivoCorte = 'baja' | 'devuelto' | 'renovacion-sin-autorizar' | 'impago' | 'sin-agencia';

/** N meses después de la fecha (YYYY-MM-DD o ISO), con el día capado al último del mes. Devuelve YYYY-MM-DD. */
export function mesesDespuesDe(fecha: string, n: number): string {
  const [a, m, d] = fecha.slice(0, 10).split('-').map(Number);
  const total = (m - 1) + n;
  const anio = a + Math.floor(total / 12);
  const mes = (total % 12 + 12) % 12 + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

/** Un mes después de la fecha (YYYY-MM-DD o ISO), con el día capado al último del mes. Devuelve YYYY-MM-DD. */
export const unMesDespuesDe = (fecha: string): string => mesesDespuesDe(fecha, 1);

const dia = (iso: string | null | undefined): string | null => (iso ? iso.slice(0, 10) : null);
const ms = (d: string): number => Date.parse(`${d}T00:00:00Z`);
const masDias = (d: string, n: number): number => ms(d) + n * DIA_MS;

/** ¿La pasarela SIGUE cobrando esta suscripción? Activa y sin la baja pedida (en Stripe la baja corre al fin del período). */
const cobra = (c: CobroDelLugar): boolean =>
  c.tipo === 'suscripcion' && c.suscripcion_estado === 'activa' && (c.estado === 'pagado' || c.estado === 'reembolsado') && !esBajaPedida(c.motivo);

/**
 * Los meses cobrados del lugar, en orden: cada cuota pagada (un cobro único de deuda vale `meses`). Un cobro pagado SIN
 * ninguna cuota (no se pudo asentar en el CRM: sin valor en USD, sin lead) cuenta su pago igual: un asiento que faltó no
 * es una deuda. Y con la suscripción ACTIVA, su primer pago devuelto cuenta (un reembolso no corta a quien sigue pagando).
 */
/** Meses cubiertos SIN cobro (la pausa de un mes gratis de la retención, lib/retencion-reglas.ts): no son una deuda. */
export type MesSinCobro = { fecha: string; meses: number };

function mesesCobrados(cobros: readonly CobroDelLugar[], pagos: readonly PagoDelLugar[], extras: readonly MesSinCobro[] = []): Array<{ fecha: string; meses: number; cobroId: number }> {
  const out: Array<{ fecha: string; meses: number; cobroId: number }> = extras.map((e) => ({ fecha: e.fecha.slice(0, 10), meses: Math.max(1, Math.min(3, Math.floor(e.meses) || 1)), cobroId: 0 }));
  for (const c of cobros) {
    const suyas = pagos.filter((p) => p.cobro_id === c.id && p.pagado && p.fecha_pago).map((p) => p.fecha_pago!.slice(0, 10));
    const meses = c.tipo === 'unico' ? Math.max(1, Math.min(24, Math.floor(Number(c.meses) || 1))) : 1;
    if (suyas.length) { for (const f of suyas) out.push({ fecha: f, meses, cobroId: c.id }); continue; }
    const pagado = dia(c.pagado_at);
    if (!pagado) continue;
    if (c.estado === 'pagado' || (c.estado === 'reembolsado' && cobra(c))) out.push({ fecha: pagado, meses, cobroId: c.id });
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.cobroId - b.cobroId));
}

/** Hasta qué día cubre lo cobrado (YYYY-MM-DD), con la regla de la tolerancia. null si no se cobró nada. */
export function finDeLoCubierto(cobros: readonly CobroDelLugar[], pagos: readonly PagoDelLugar[], extras: readonly MesSinCobro[] = []): { hasta: string; cobroId: number } | null {
  let fin: string | null = null;
  let cobroId = 0;
  for (const m of mesesCobrados(cobros, pagos, extras)) {
    const inicio: string = fin && ms(m.fecha) <= masDias(fin, TOLERANCIA_DIAS) ? fin : m.fecha;
    const nuevo = mesesDespuesDe(inicio, m.meses);
    if (!fin || nuevo > fin) { fin = nuevo; cobroId = m.cobroId || cobroId; }
  }
  return fin ? { hasta: fin, cobroId } : null;
}

/** Cuántos ciclos empezaron desde `desde` hasta `ahora` (el primero, el día mismo del fin). */
export function ciclosDesde(desde: string, ahoraMs: number): number {
  let n = 0;
  while (n < 120 && ms(mesesDespuesDe(desde, n)) <= ahoraMs) n++;
  return n;
}

/** La vigencia del lugar de UN negocio. `ahoraMs` es el reloj (se pasa, no se lee: las reglas son puras). */
/**
 * Desde cuándo se debe con una suscripción que la pasarela sigue cobrando: un mes después del ÚLTIMO pago de ESA
 * suscripción (su ancla real, no la cadena de cobertura), corrido por los meses pagados aparte después de ese pago (la
 * deuda en un cobro único) y por la pausa de la retención.
 */
export function proximoCobro(cobrando: CobroDelLugar, cobros: readonly CobroDelLugar[], pagos: readonly PagoDelLugar[], extras: readonly MesSinCobro[] = []): string | null {
  const suyas = pagos.filter((p) => p.cobro_id === cobrando.id && p.pagado && p.fecha_pago).map((p) => p.fecha_pago!.slice(0, 10));
  const ultimo = [...suyas, dia(cobrando.pagado_at)].filter((x): x is string => !!x).sort().at(-1);
  if (!ultimo) return null;
  let desde = unMesDespuesDe(ultimo);
  for (const c of cobros) {
    if (c.tipo !== 'unico' || c.id === cobrando.id) continue;
    const m = Math.max(1, Math.min(24, Math.floor(Number(c.meses) || 1)));
    for (const p of pagos) if (p.cobro_id === c.id && p.pagado && p.fecha_pago && p.fecha_pago.slice(0, 10) >= ultimo) desde = mesesDespuesDe(desde, m);
  }
  for (const e of extras) if (e.fecha.slice(0, 10) >= ultimo) desde = mesesDespuesDe(desde, Math.max(1, Math.min(3, Math.floor(e.meses) || 1)));
  return desde;
}

export function vigenciaDelLugar(cobros: readonly CobroDelLugar[], pagos: readonly PagoDelLugar[], ahoraMs: number, extras: readonly MesSinCobro[] = []): Vigencia {
  if (!cobros.length) return { estado: 'sin-pasarela' };
  // El cliente de agencia, y un negocio SIN ninguna suscripción (los planes de pago único de /admin/cobros, que nunca
  // vencían: revisión del 23/10), siguen con las reglas del 17/10.
  if (cobros.some((c) => c.cliente_ws != null) || !cobros.some((c) => c.tipo === 'suscripcion')) return vigenciaDeClienteDeAgencia(cobros, pagos, ahoraMs);

  const cubierto = finDeLoCubierto(cobros, pagos, extras);
  const cobrando = cobros.filter(cobra).sort((a, b) => (dia(b.pagado_at) ?? '').localeCompare(dia(a.pagado_at) ?? '') || b.id - a.id)[0] ?? null;

  if (cobrando) {
    // ⚠️ LA MORA LA DICE LA PASARELA, NO EL CALENDARIO (revisión adversarial del 23/10, altas 2, 3 y 4): la cobertura
    // encadenada se corría con los días 29-31, con un mes devuelto o con una reactivación, y le daba mora a quien pagaba.
    // Hay mora SÓLO si la pasarela avisó que la renovación falló; desde un mes después del último pago de ESA suscripción.
    const desde = proximoCobro(cobrando, cobros, pagos, extras);
    if (!renovacionFallida(cobrando.motivo) || !desde || ahoraMs < ms(desde)) return { estado: 'al-dia', cobroId: cobrando.id, ...(desde ? { hasta: desde } : {}) };
    const ciclos = Math.max(1, ciclosDesde(desde, ahoraMs));
    const monto = Number(cobrando.monto);
    const usd = Number(cobrando.monto_usd);
    const deuda: Deuda = {
      cobroId: cobrando.id, ciclos, desde,
      monto: Number.isFinite(monto) && monto > 0 ? Math.round(monto * ciclos * 100) / 100 : null,
      moneda: cobrando.moneda ?? null,
      montoUsd: Number.isFinite(usd) && usd > 0 ? Math.round(usd * ciclos * 100) / 100 : null,
    };
    if (ahoraMs < masDias(desde, DIAS_PARA_SUSPENDER)) return { estado: 'mora', cobroId: cobrando.id, hasta: desde, deuda };
    return { estado: 'vencido', cobroId: cobrando.id, hasta: desde, motivo: 'impago', deuda };
  }

  // LA PRUEBA GRATIS (25/10/2026): sin nada cobrado todavía, la prueba autorizada cubre hasta el día de su primer cobro.
  // Sin esto, un negocio en prueba era «sin pasarela» (nunca se corta): cancelaba y seguía para siempre.
  const prueba = cubierto ? null : pruebaDelLugar(cobros);
  if (prueba) return vigenciaDeLaPrueba(prueba, ahoraMs);

  // Nadie cobra: lo pagado llega hasta donde llega. Sin nada cobrado, un plan devuelto corta desde la devolución.
  let fin: { hasta: string; cobroId: number; motivo: MotivoCorte } | null = cubierto ? { ...cubierto, motivo: 'baja' } : null;
  if (!fin) {
    const devueltos = cobros.filter((c) => c.estado === 'reembolsado').map((c) => ({ c, d: dia(c.reembolsado_at) ?? dia(c.pagado_at) })).filter((x): x is { c: CobroDelLugar; d: string } => !!x.d);
    const ultimo = devueltos.sort((a, b) => (a.d < b.d ? 1 : -1))[0];
    if (ultimo) fin = { hasta: ultimo.d, cobroId: ultimo.c.id, motivo: 'devuelto' };
  } else {
    // Lo último que pasó con el lugar fue una devolución: el corte lo dice así.
    const devuelto = cobros.find((c) => c.id === fin!.cobroId && c.estado === 'reembolsado');
    if (devuelto) fin = { ...fin, motivo: 'devuelto' };
  }
  if (!fin) return { estado: 'sin-pasarela' };
  // La pasarela la dio de baja por falta de pago (la renovación fallida quedó dicha): es un impago, con su deuda (un ciclo:
  // sin la fecha de la baja no se cuentan más, mejor de menos que de más).
  const ultimaSus = cobros.filter((c) => c.tipo === 'suscripcion').sort((a, b) => b.id - a.id)[0];
  if (ultimaSus && renovacionFallida(ultimaSus.motivo)) {
    const monto = Number(ultimaSus.monto), usd = Number(ultimaSus.monto_usd);
    const deuda: Deuda = { cobroId: ultimaSus.id, ciclos: 1, desde: fin.hasta, monto: monto > 0 ? monto : null, moneda: ultimaSus.moneda ?? null, montoUsd: usd > 0 ? usd : null };
    return ahoraMs >= masDias(fin.hasta, DIAS_PARA_SUSPENDER) ? { estado: 'vencido', cobroId: ultimaSus.id, hasta: fin.hasta, motivo: 'impago', deuda } : { estado: 'mora', cobroId: ultimaSus.id, hasta: fin.hasta, deuda };
  }
  return ahoraMs >= masDias(fin.hasta, GRACIA_DIAS) ? { estado: 'vencido', ...fin } : { estado: 'cubierto', ...fin };
}

/** La prueba gratis del lugar que la persona AUTORIZÓ y que todavía no se cobró (la última, si hubiera más). */
export function pruebaDelLugar(cobros: readonly CobroDelLugar[]): (CobroDelLugar & { inicio_at: string }) | null {
  const vivas = cobros.filter((c): c is CobroDelLugar & { inicio_at: string } =>
    esPruebaDePlan(c) && c.estado === 'pendiente' && c.suscripcion_estado != null && !!c.inicio_at && !!dia(c.inicio_at));
  return vivas.sort((a, b) => b.id - a.id)[0] ?? null;
}

/**
 * La vigencia de un lugar en prueba. Autorizada: al día hasta el día del cobro; si ese día pasó y Mercado Pago no cobró, se
 * debe el primer período (mora y después vencido, como una renovación que no entró). Cancelada desde «Tu plan»: cubierta hasta
 * el día del cobro y vencida desde ese día, sin la gracia de un plan pagado (la prueba ya fue gratis).
 */
function vigenciaDeLaPrueba(p: CobroDelLugar & { inicio_at: string }, ahoraMs: number): Vigencia {
  const hasta = dia(p.inicio_at)!;
  if (p.suscripcion_estado === 'cancelada') {
    return ahoraMs >= ms(hasta) ? { estado: 'vencido', cobroId: p.id, hasta, motivo: 'baja' } : { estado: 'cubierto', cobroId: p.id, hasta, motivo: 'baja' };
  }
  if (ahoraMs < ms(hasta)) return { estado: 'al-dia', cobroId: p.id, hasta };
  const monto = Number(p.monto), usd = Number(p.monto_usd);
  const deuda: Deuda = { cobroId: p.id, ciclos: 1, desde: hasta, monto: monto > 0 ? monto : null, moneda: p.moneda ?? null, montoUsd: usd > 0 ? usd : null };
  return ahoraMs >= masDias(hasta, DIAS_PARA_SUSPENDER) ? { estado: 'vencido', cobroId: p.id, hasta, motivo: 'impago', deuda } : { estado: 'mora', cobroId: p.id, hasta, deuda };
}

// ─────────────────────────────────────────────────────────────────────────────
// El cliente de una agencia (#866/#867, 17/10/2026): su mes corre desde el fin del onboarding, no desde el pago
// ─────────────────────────────────────────────────────────────────────────────

/** Hasta qué día cubre lo pagado de UN cobro de agencia, y por qué termina; null si ese cobro no dice nada. */
function finDeLoPagadoDeAgencia(c: CobroDelLugar, pagos: readonly PagoDelLugar[]): { hasta: string; motivo: MotivoCorte } | null {
  if (c.estado === 'reembolsado') {
    const d = dia(c.reembolsado_at) ?? dia(c.pagado_at);
    return d ? { hasta: d, motivo: 'devuelto' } : null;
  }
  if (c.tipo !== 'suscripcion') return null;
  // La renovación de un cliente de agencia que nadie autorizó ni cobró: lo pagado (el primer mes) termina el día que
  // ella tenía que empezar a cobrar. Autorizada (`activa`), Mercado Pago la cobra ese día: no se corta antes.
  if ((c.estado === 'pendiente' || c.estado === 'fallido') && c.suscripcion_estado !== 'activa' && c.inicio_at) {
    return { hasta: dia(c.inicio_at)!, motivo: 'renovacion-sin-autorizar' };
  }
  if (c.estado === 'pagado' && c.suscripcion_estado === 'cancelada') {
    const ultimas = pagos.filter((p) => p.cobro_id === c.id && p.pagado && p.fecha_pago).map((p) => p.fecha_pago!.slice(0, 10));
    const ultimo = [...ultimas, dia(c.pagado_at)].filter((x): x is string => !!x).sort().at(-1);
    return ultimo ? { hasta: unMesDespuesDe(ultimo), motivo: 'baja' } : null;
  }
  return null;
}

/** Las reglas del 17/10 para el lugar de un cliente de agencia (cobros con `cliente_ws`), sin cambios. */
export function vigenciaDeClienteDeAgencia(cobros: readonly CobroDelLugar[], pagos: readonly PagoDelLugar[], ahoraMs: number): Vigencia {
  const activa = cobros.find((c) => c.tipo === 'suscripcion' && c.estado === 'pagado' && c.suscripcion_estado !== 'cancelada');
  if (activa) return { estado: 'al-dia', cobroId: activa.id };
  const autorizada = cobros.find((c) => c.tipo === 'suscripcion' && (c.estado === 'pendiente' || c.estado === 'fallido') && c.suscripcion_estado === 'activa');
  if (autorizada) return { estado: 'al-dia', cobroId: autorizada.id };
  let mejor: { cobroId: number; hasta: string; motivo: MotivoCorte } | null = null;
  for (const c of cobros) {
    const f = finDeLoPagadoDeAgencia(c, pagos);
    if (f && (!mejor || f.hasta > mejor.hasta)) mejor = { cobroId: c.id, ...f };
  }
  if (!mejor) return { estado: 'sin-pasarela' };
  return ahoraMs >= masDias(mejor.hasta, GRACIA_DIAS) ? { estado: 'vencido', ...mejor } : { estado: 'cubierto', ...mejor };
}

// ─────────────────────────────────────────────────────────────────────────────
// El corte guardado y el paso
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que se guarda al cortar (app_settings `plan.corte_por_pago` del negocio): por qué, por cuál cobro, y si el corte
 * sigue en pie (`vigente`). Queda guardado aunque se reabra: es lo que impide volver a cortar por el MISMO vencimiento
 * a un negocio que alguien reactivó a mano. Con impago, la deuda de ese momento.
 */
export type CorteGuardado = { cobroId: number; hasta: string; motivo: MotivoCorte; desde: string; vigente: boolean; deuda?: Deuda | null };

export const CLAVE_CORTE = 'plan.corte_por_pago';

export function leerCorte(crudo: string | null | undefined): CorteGuardado | null {
  if (!crudo) return null;
  try {
    const v = JSON.parse(crudo) as Partial<CorteGuardado>;
    if (typeof v.cobroId !== 'number' || typeof v.hasta !== 'string' || typeof v.motivo !== 'string') return null;
    const d = v.deuda;
    const deuda = d && typeof d === 'object' && typeof d.cobroId === 'number' && typeof d.ciclos === 'number' ? d : null;
    return { cobroId: v.cobroId, hasta: v.hasta, motivo: v.motivo as MotivoCorte, desde: String(v.desde ?? ''), vigente: v.vigente !== false, deuda };
  } catch { return null; }
}

/**
 * Qué hacer con el acceso de un negocio, con lo que dice la pasarela, cómo está el negocio y el último corte guardado.
 *   · `cortar`: pausarlo y guardar el corte (vigente).
 *   · `reabrir`: activarlo y dejar el corte como no vigente (pagó de nuevo).
 *   · `soltar`: el corte guardado dice vigente pero el negocio ya está activo: alguien lo reactivó a mano. Se anota, para
 *     que una pausa A MANO posterior no la «reabra» el cobro.
 */
export type Paso =
  | { tipo: 'nada' }
  | { tipo: 'cortar'; corte: Omit<CorteGuardado, 'desde' | 'vigente'> }
  | { tipo: 'reabrir' }
  | { tipo: 'soltar' };

export function pasoDeAcceso(v: Vigencia, estadoWs: 'activo' | 'pausado', corte: CorteGuardado | null): Paso {
  const vigente = !!corte?.vigente;
  if (v.estado === 'vencido') {
    if (estadoWs === 'pausado') return { tipo: 'nada' };
    // ⚠️ YA SE CORTÓ POR ESTE MISMO VENCIMIENTO y alguien lo volvió a activar a mano (/admin): se respeta. Un corte
    // nuevo pide un vencimiento NUEVO (otro cobro, u otro fin de lo pagado).
    if (corte && corte.cobroId === v.cobroId && corte.hasta === v.hasta) return vigente ? { tipo: 'soltar' } : { tipo: 'nada' };
    return { tipo: 'cortar', corte: { cobroId: v.cobroId, hasta: v.hasta, motivo: v.motivo, ...(v.deuda ? { deuda: v.deuda } : {}) } };
  }
  // En mora se sigue entrando: no es un corte.
  // Pagó de nuevo (o ya no hay nada que vencer): se reabre SÓLO lo que cortó el cobro. Una pausa a mano no la toca.
  // ⚠️ La cuenta que una agencia dio de baja la reabre SÓLO un plan que el cliente paga (al día): el mes que la agencia ya había
  // pagado queda «cubierto» y, sin esto, la reabría sola (29/10/2026).
  // `cubierto` también (verificación independiente, H5): pagó su plan pero el aviso de Mercado Pago llegó sin el id del
  // preapproval y la suscripción no quedó `activa`. Se mide con SUS cobros (lib/plan-acceso.ts), así que lo que cubre es suyo.
  if (corte?.motivo === 'sin-agencia' && v.estado !== 'al-dia' && v.estado !== 'cubierto') return { tipo: 'nada' };
  if (vigente && estadoWs === 'pausado') return { tipo: 'reabrir' };
  if (vigente && estadoWs === 'activo') return { tipo: 'soltar' };
  return { tipo: 'nada' };
}

const fechaCorta = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** El texto de la pantalla del negocio cortado. Corto, y dice qué hacer. */
export function textoDelCorte(c: CorteGuardado | null, opts: { paraAgencia?: boolean; pagaSuAgencia?: boolean } = {}): { titulo: string; detalle: string } {
  if (!c) return { titulo: opts.paraAgencia ? 'Este cliente está pausado' : 'Tu cuenta está pausada', detalle: 'Si crees que es un error, escríbenos y lo vemos.' };
  const fecha = fechaCorta(c.hasta);
  if (c.motivo === 'renovacion-sin-autorizar') {
    // La agencia que mira a su cliente es la que tiene que activarla (desde MaKo Partners, «Activar renovación»).
    return opts.paraAgencia
      ? { titulo: 'Falta activar su renovación', detalle: `El mes pagado de este cliente terminó el ${fecha}. Actívala desde MaKo Partners para que vuelva a entrar.` }
      : { titulo: 'Falta activar la renovación', detalle: `El mes pagado terminó el ${fecha}. Tu agencia tiene que activar la renovación para volver a entrar.` };
  }
  // La cuenta que paga la agencia (31/10/2026, ticket #37): el cliente no debe nada, y a la agencia hay que decirle dónde resolverlo.
  if (opts.pagaSuAgencia && c.motivo !== 'sin-agencia') return { titulo: 'Tu cuenta está pausada', detalle: 'Tu agencia tiene que regularizar el pago para que vuelvas a entrar. Tus datos están guardados.' };
  if (opts.paraAgencia && (c.motivo === 'impago' || c.motivo === 'baja')) return { titulo: 'Este cliente está pausado', detalle: `Lo pagado cubría hasta el ${fecha}. Sus datos están guardados.` };
  if (c.motivo === 'impago') {
    return { titulo: 'Tu pago no entró', detalle: `Tu plan está pagado hasta el ${fecha} y la renovación no se pudo cobrar. Tus datos están guardados: paga y vuelves a entrar en el acto.` };
  }
  if (c.motivo === 'sin-agencia') return { titulo: 'Tu agencia dejó de administrar tu cuenta', detalle: 'Tus datos están guardados. Si quieres seguir usando MaKo, elige tu plan y vuelves a entrar en el acto.' };
  if (c.motivo === 'devuelto') return { titulo: 'Tu plan se devolvió', detalle: 'El pago de tu plan se devolvió. Para volver a entrar, escríbenos.' };
  return { titulo: 'Tu plan terminó', detalle: `Lo pagado cubría hasta el ${fecha}. Tus datos están guardados: renueva tu plan y vuelves a entrar.` };
}

/**
 * ¿/cuenta-pausada le ofrece pagar? Sólo a quien debe lo suyo. ⚠️ `no-se` (no se pudo leer quién paga) tampoco: esa deuda puede ser
 * de su agencia, y le queda «escríbenos» (31/10/2026, ticket #37). Una pausa a mano, sin corte, igual.
 */
export function leOfrecePagar(p: { esAgencia: boolean; corte: Pick<CorteGuardado, 'vigente' | 'motivo'> | null; quienPaga: 'agencia' | 'cliente' | 'no-se' | null }): boolean {
  if (p.esAgencia || !p.corte?.vigente || p.quienPaga === 'agencia' || p.quienPaga === 'no-se') return false;
  return p.corte.motivo !== 'renovacion-sin-autorizar' && p.corte.motivo !== 'devuelto';
}

/** El aviso de la mora (dentro de la app, mientras todavía se entra). */
export function textoDeLaMora(d: Deuda, suspendeEl: string): string {
  return `Tu renovación no se pudo cobrar. Lo reintentamos solos; si no entra, el ${fechaCorta(suspendeEl)} se pausa tu cuenta.`;
}

/** El día en que la mora pasa a suspensión. */
export const diaDeSuspension = (hasta: string): string => new Date(masDias(hasta, DIAS_PARA_SUSPENDER)).toISOString().slice(0, 10);
