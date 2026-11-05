// =============================================================================
// suscripcion-meses — una suscripción MES A MES: cuánto tocaba, cuánto pagó y qué cambió (puro)
// =============================================================================
// Pedido de Martín (5/11/2026): «la suscripción es suben, bajan… en otros casos se mantienen, otros casos hay cortes…
// la pestaña de pagos dentro de lo que sería una venta de suscripción es algo que quisiera cambiarlo completamente».
// El diseño se copió de Chargebee (cada período junta sus pagos, también varios y parciales; el monto cambia desde una
// fecha; cortar y retomar) con las palabras de ChartMogul para lo que se mueve (nuevo, sube, baja, se corta, vuelve).
// La investigación: docs/investigacion-suscripciones.md.
//
// Hasta acá una suscripción era UN monto (`leads.suscripcion_monto_usd`) y cada pago registrado contaba un mes. Con
// Código Inmobiliario eso mentía tres veces: su mensualidad cambia mes a mes (146, 238, 426), noviembre lo pagó en DOS
// pagos (que contaban como dos meses: «adelantado»), y su monto vacío daba MRR 0 con pagos hechos.
//
// LAS REGLAS:
//   · Los meses son meses de CALENDARIO desde el de la venta (`inicio` = fecha de cierre). Cada uno vence el día de
//     cobro (el de la venta, o el que fije un cambio), con el tope de fin de mes; el primero vence el día de la venta.
//   · El monto de un mes es el del último cambio (`monto` o una `vuelta` con monto) desde ese mes o antes. Un cambio
//     NUEVO no toca los meses de antes: no se reescribe el pasado (la acción guarda el monto de antes la primera vez).
//     Sin ningún cambio guardado, todos los meses valen el monto del lead (lo de siempre).
//   · Un `corte` deja sin cobrar desde su mes, y una `vuelta` lo retoma. La cancelación vieja (`suscripcion_cancelada_at`)
//     cuenta como un corte si no hay ninguno guardado: desde el primer mes que vence después de cancelarse.
//   · Cada pago va a UN mes (o se reparte entre varios), y un mes puede tener varios pagos:
//       - el que dice su mes (`suscripcion_mes`, lo que se registra desde la pantalla nueva) va a ése;
//       - una cuota del plan va al mes de su vencimiento;
//       - un ajuste (`suscripcion_ajuste`: el diferencial, un prorrateo) no paga ningún mes: suma a lo cobrado y nada más;
//       - lo demás, al mes más viejo que falte completar (como se aplica un pago a la factura más vieja). Una mensualidad
//         registrada va ENTERA a un mes; un pago suelto o de la pasarela primero completa un mes a medias y después cubre
//         MESES ENTEROS por su plata (`mesesDePlata`: un adelanto de 1.500 son 3 de 500). ⚠️ Cada pago por separado, nunca
//         la suma: sumando, 10 × 550 eran 11 meses (la quinta revisión, docs/hallazgos-pagos.md).
//   · ⚠️ COMPATIBILIDAD: sin ningún cambio de monto guardado (los datos de antes), una mensualidad registrada sin mes
//     vale UN mes, sea del monto que sea, y un pago suelto vale al menos un mes (la regla de `mesesDeUnaCobrada`,
//     lib/cobrado-lead.ts): con el monto de hoy escrito encima del de antes, contarlos por plata inventaba deuda.
//   · Un mes está pagado con lo que toca menos un 10% (el tipo de cambio de un cobro en otra moneda).
//
// Sin `server-only` ni `'use client'`: lo usan la ficha, la API de MaKo, el MRR y los tests, que lo EJECUTAN.
// =============================================================================

import { esCuotaDelPlan, mesesDePlata, noEsDeuda, type CuotaParaCobrado } from './cobrado-lead';

/** Los cambios de una suscripción (tabla `suscripcion_movimientos`, mig 0401). */
export const TIPOS_MOVIMIENTO = ['monto', 'corte', 'vuelta'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];
export const esTipoMovimiento = (v: unknown): v is TipoMovimiento => typeof v === 'string' && (TIPOS_MOVIMIENTO as readonly string[]).includes(v);

export type MovimientoSuscripcion = {
  id?: number | null;
  tipo: TipoMovimiento;
  /** YYYY-MM-DD: vale desde el MES de esta fecha. */
  desde: string;
  /** `monto`: la mensualidad nueva. `vuelta`: con cuánto vuelve (sin él, con la de antes del corte). */
  montoUsd?: number | null;
  /** El día de cobro desde ese mes (1-31; con el tope de fin de mes). Sin él, el de antes. */
  dia?: number | null;
  nota?: string | null;
  created_at?: string | null;
};

/** Lo que el modelo necesita de un pago: lo de `cobradoDelLead` más a qué mes va y si es un ajuste. */
export type PagoDeSuscripcion = CuotaParaCobrado & {
  /** El mes que paga (YYYY-MM-01), si se dijo al registrarlo (mig 0401). null: el más viejo que falte. */
  suscripcion_mes?: string | null;
  /** No paga ningún mes: un diferencial o un prorrateo (mig 0401). Suma a lo cobrado. */
  suscripcion_ajuste?: boolean | null;
  metodo?: string | null;
  concepto?: string | null;
  comprobante_path?: string | null;
  comprobante_nombre?: string | null;
};

export type EntradaSuscripcion = {
  /** La fecha de la venta (`fecha_cierre`). Sin ella, el primer pago cobrado. */
  inicio: string | null | undefined;
  /** `leads.suscripcion_monto_usd`: el monto de cuando no hay cambios guardados. */
  montoUsd: number | string | null | undefined;
  /** El plazo en meses (null = indefinida). */
  plazoMeses: number | string | null | undefined;
  /** La cancelación vieja, si no hay cortes guardados (`suscripcion_cancelada_at`). */
  canceladaAt?: string | null;
  movimientos?: readonly MovimientoSuscripcion[];
  pagos: readonly PagoDeSuscripcion[];
  /** YYYY-MM-DD de hoy en la zona del negocio. */
  hoy: string;
};

export type EstadoMes = 'pagado' | 'parcial' | 'vencido' | 'vence-hoy' | 'por-cobrar' | 'proximo' | 'cortado';
/** Lo que se movió en un mes, con las palabras de ChartMogul (New, Expansion, Contraction, Churn, Reactivation). */
export type CambioDelMes = 'empezo' | 'subio' | 'bajo' | 'se-corto' | 'volvio';

export type PagoEnElMes = {
  id: number | null;
  /** Lo que de este pago va a este mes (un adelanto se reparte). */
  montoUsd: number;
  /** El monto entero del pago, si se repartió entre varios meses. */
  totalUsd: number | null;
  fecha: string | null;
  metodo: string | null;
  concepto: string | null;
  moneda: string | null;
  montoOriginal: number | null;
  proveedor: string | null;
  comprobante: boolean;
  /** Va a este mes porque se dijo al registrarlo (no por orden). */
  elegido: boolean;
};

export type MesSuscripcion = {
  /** YYYY-MM */
  mes: string;
  /** YYYY-MM-DD */
  vence: string;
  /** null: no se sabe cuánto tocaba (nadie lo cargó). */
  esperadoUsd: number | null;
  pagadoUsd: number;
  /** Lo que falta para completarlo (0 si está pagado; null sin monto). */
  faltaUsd: number | null;
  estado: EstadoMes;
  cambio: CambioDelMes | null;
  /** El monto del mes anterior con cobro, cuando cambió (para «sube de 146 a 238»). */
  antesUsd: number | null;
  pagos: PagoEnElMes[];
  /** Los ajustes cobrados en este mes: suman a lo cobrado, no completan el mes. */
  ajustes: PagoEnElMes[];
  /** Cuotas del plan sin cobrar que vencen en este mes. */
  programado: Array<{ id: number | null; montoUsd: number; vence: string | null }>;
  /** Pagado de más (con monto conocido). */
  deMasUsd: number;
};

export type HistoriaSuscripcion = {
  /** Del más viejo al más nuevo: hasta el mes que viene (si sigue) o el último con un pago. */
  meses: MesSuscripcion[];
  /** Lo que paga hoy: el monto de este mes; sin él, el último mes pagado (`montoInferido`). */
  montoHoyUsd: number | null;
  montoInferido: boolean;
  diaDeCobro: number | null;
  /** El primer mes que falta completar: el que vence (o venció) primero. null si no queda nada. */
  proximo: { mes: string; vence: string; faltaUsd: number | null; vencido: boolean } | null;
  /** El próximo vencimiento de hoy en adelante (lo que dice «próxima el …»). */
  proximaFecha: string | null;
  /** Lo cobrado en total: los meses y los ajustes. */
  totalPagadoUsd: number;
  ajustesUsd: number;
  /** Cortada hoy: desde qué mes (YYYY-MM). */
  cortadaDesde: string | null;
  /** El plazo fijo terminó. */
  terminada: boolean;
  /** Meses que ya vencieron (hoy incluido) y no están completos: sin nada y con una parte. */
  mesesSinPagar: number;
  mesesParciales: number;
  /** Lo que falta de esos meses, con monto conocido. */
  deudaUsd: number;
  mesesPagados: number;
  /** Hay cambios de monto guardados: los montos de cada mes son de verdad, no el de hoy repetido. */
  conHistoria: boolean;
};

const redondo = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : 0);
const positivo = (v: unknown): number | null => (v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
const esFecha = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s);
/** La tolerancia de «pagado»: un 10% de lo que toca. */
export const TOLERANCIA = 0.1;

export const mesDe = (iso: string): string => iso.slice(0, 7);
export function sumarAlMes(mes: string, n: number): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
/** El día `dia` del mes, con el tope del último día. */
export function diaDelMes(mes: string, dia: number): string {
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${mes}-${String(Math.min(Math.max(1, Math.round(dia)), ultimo)).padStart(2, '0')}`;
}

/** Los cambios, en el orden en que valen (por su mes, y en el mismo mes el último que se guardó). */
export function ordenarMovimientos(movs: readonly MovimientoSuscripcion[]): MovimientoSuscripcion[] {
  return movs
    .filter((m) => esTipoMovimiento(m.tipo) && esFecha(m.desde))
    .map((m, i) => ({ m, i }))
    .sort((a, b) => mesDe(a.m.desde).localeCompare(mesDe(b.m.desde))
      || String(a.m.created_at ?? '').localeCompare(String(b.m.created_at ?? ''))
      || (a.m.id ?? 0) - (b.m.id ?? 0) || a.i - b.i)
    .map((x) => x.m);
}

/**
 * EL MONTO QUE VALE en un mes: el del último cambio con monto hasta ese mes; sin cambios, el del lead. Con cambios
 * guardados y ninguno antes de ese mes: null (no se sabe, no se inventa con el de hoy).
 */
export function montoDelMes(mes: string, montoLead: number | null, movs: readonly MovimientoSuscripcion[]): number | null {
  const conMonto = movs.filter((m) => (m.tipo === 'monto' || m.tipo === 'vuelta') && positivo(m.montoUsd) != null);
  if (!conMonto.length) return montoLead;
  let v: number | null = null;
  for (const m of conMonto) if (mesDe(m.desde) <= mes) v = positivo(m.montoUsd);
  return v;
}

/** LA MENSUALIDAD VIGENTE HOY (el MRR de este lead): el monto de este mes, o el del lead sin cambios. */
export function montoVigente(montoLead: number | string | null | undefined, movs: readonly MovimientoSuscripcion[], hoy: string): number | null {
  return montoDelMes(mesDe(hoy), positivo(montoLead), ordenarMovimientos(movs));
}

/**
 * EL MRR DE UNA SUSCRIPCIÓN cuando el monto no está cargado: lo cobrado en el último mes con pagos de mensualidad
 * (sin ajustes ni devoluciones). Pedido del encargo: «`suscripcion_monto_usd` en null no puede dar MRR 0 cuando hay
 * pagos». Es una estimación, y quien la muestre lo dice (`montoInferido`).
 */
export function montoPorLoPagado(pagos: readonly PagoDeSuscripcion[]): number | null {
  const porMes = new Map<string, number>();
  for (const q of pagos) {
    if (!q.pagado || noEsDeuda(q) || q.suscripcion_ajuste) continue;
    const f = q.suscripcion_mes ?? q.fecha_pago ?? q.fecha_esperada;
    if (!esFecha(f)) continue;
    porMes.set(mesDe(f), (porMes.get(mesDe(f)) ?? 0) + num(q.monto_usd));
  }
  const ultimo = [...porMes.keys()].sort().at(-1);
  return ultimo ? redondo(porMes.get(ultimo) as number) : null;
}

type Slot = MesSuscripcion & { activo: boolean; cubierto: boolean };

/**
 * LA SUSCRIPCIÓN MES A MES. Ver las reglas arriba. Sin inicio ni pagos, vacía.
 */
export function historiaDeSuscripcion(e: EntradaSuscripcion): HistoriaSuscripcion {
  const hoy = e.hoy.slice(0, 10);
  const mesHoy = mesDe(hoy);
  const movs = ordenarMovimientos(e.movimientos ?? []);
  const montoLead = positivo(e.montoUsd);
  const plazo = positivo(e.plazoMeses) != null ? Math.round(num(e.plazoMeses)) : null;
  const conHistoria = movs.some((m) => (m.tipo === 'monto' || m.tipo === 'vuelta') && positivo(m.montoUsd) != null);

  const vivas = e.pagos.filter((q) => !noEsDeuda(q));
  const cobradas = vivas.filter((q) => q.pagado);
  const fechaDe = (q: PagoDeSuscripcion): string | null => (esFecha(q.fecha_pago) ? q.fecha_pago.slice(0, 10) : esFecha(q.fecha_esperada) ? q.fecha_esperada.slice(0, 10) : null);
  const inicio = esFecha(e.inicio)
    ? e.inicio.slice(0, 10)
    : cobradas.map(fechaDe).filter((f): f is string => !!f).sort()[0] ?? null;

  const vacia: HistoriaSuscripcion = {
    meses: [], montoHoyUsd: montoLead ?? montoPorLoPagado(e.pagos), montoInferido: montoLead == null && montoPorLoPagado(e.pagos) != null, diaDeCobro: null,
    proximo: null, proximaFecha: null, totalPagadoUsd: redondo(cobradas.reduce((s, q) => s + num(q.monto_usd), 0)), ajustesUsd: 0,
    cortadaDesde: null, terminada: false, mesesSinPagar: 0, mesesParciales: 0, deudaUsd: 0, mesesPagados: 0, conHistoria,
  };
  if (!inicio) return vacia;
  const mesInicio = mesDe(inicio);
  const diaInicio = Number(inicio.slice(8, 10));

  const diaPara = (mes: string): number => {
    let d = diaInicio;
    for (const m of movs) if (m.dia != null && Number.isFinite(Number(m.dia)) && mesDe(m.desde) <= mes) d = Math.min(31, Math.max(1, Math.round(Number(m.dia))));
    return d;
  };
  const venceDe = (mes: string): string => (mes === mesInicio ? inicio : diaDelMes(mes, diaPara(mes)));

  // Los cortes y las vueltas. La cancelación vieja cuenta como un corte sólo si no hay ninguno guardado.
  const cortes = movs.filter((m) => m.tipo === 'corte' || m.tipo === 'vuelta');
  if (!movs.some((m) => m.tipo === 'corte') && esFecha(e.canceladaAt)) {
    const dia = e.canceladaAt.slice(0, 10);
    let mesCorte = mesDe(dia);
    if (mesCorte < mesInicio) mesCorte = mesInicio;
    if (venceDe(mesCorte) <= dia) mesCorte = sumarAlMes(mesCorte, 1);
    // Antes de una vuelta guardada, para que el orden siga valiendo.
    cortes.push({ tipo: 'corte', desde: `${mesCorte}-01` });
    cortes.sort((a, b) => mesDe(a.desde).localeCompare(mesDe(b.desde)));
  }
  const cortado = (mes: string): boolean => {
    let c = false;
    for (const m of cortes) if (mesDe(m.desde) <= mes) c = m.tipo === 'corte';
    return c;
  };

  const mesFin = plazo ? sumarAlMes(mesInicio, plazo - 1) : null;
  const dentro = (mes: string) => mes >= mesInicio && (!mesFin || mes <= mesFin);
  const slotDe = new Map<string, Slot>();
  const crear = (mes: string): Slot | null => {
    if (!dentro(mes)) return null;
    const ya = slotDe.get(mes);
    if (ya) return ya;
    const s: Slot = {
      mes, vence: venceDe(mes), esperadoUsd: montoDelMes(mes, montoLead, movs), pagadoUsd: 0, faltaUsd: null, estado: 'proximo',
      cambio: null, antesUsd: null, pagos: [], ajustes: [], programado: [], deMasUsd: 0, activo: !cortado(mes), cubierto: false,
    };
    slotDe.set(mes, s);
    return s;
  };
  // Los meses hasta el que viene (o hasta el fin del plazo).
  const tope = mesFin && mesFin < sumarAlMes(mesHoy, 1) ? mesFin : sumarAlMes(mesHoy, 1);
  for (let m = mesInicio, i = 0; m <= tope && i < 600; m = sumarAlMes(m, 1), i++) crear(m);
  const mesAcotado = (mes: string): string => (mes < mesInicio ? mesInicio : mesFin && mes > mesFin ? mesFin : mes);

  const enMes = (q: PagoDeSuscripcion, monto: number, elegido: boolean, total: number | null): PagoEnElMes => ({
    id: q.id ?? null, montoUsd: redondo(monto), totalUsd: total, fecha: fechaDe(q), metodo: q.metodo ?? null, concepto: q.concepto ?? null,
    moneda: q.moneda ?? null, montoOriginal: q.monto_original == null ? null : num(q.monto_original), proveedor: q.proveedor ?? null,
    comprobante: !!q.comprobante_path, elegido,
  });
  const umbral = (s: Slot) => (s.esperadoUsd == null ? 0 : s.esperadoUsd * (1 - TOLERANCIA));
  const completo = (s: Slot): boolean => s.cubierto || (s.esperadoUsd == null ? s.pagadoUsd > 0 : s.pagadoUsd >= umbral(s) - 0.005);

  // 1 · Lo que tiene su mes: el elegido, las cuotas del plan y los ajustes. Y las cuotas impagas, como programadas.
  const porOrden: PagoDeSuscripcion[] = [];
  for (const q of vivas) {
    const elegido = esFecha(q.suscripcion_mes) ? mesDe(q.suscripcion_mes) : null;
    const cuota = esCuotaDelPlan(q) && esFecha(q.fecha_esperada) ? mesDe(q.fecha_esperada) : null;
    if (!q.pagado) {
      if (cuota) { const s = crear(mesAcotado(cuota)); s?.programado.push({ id: q.id ?? null, montoUsd: redondo(num(q.monto_usd)), vence: q.fecha_esperada ?? null }); }
      continue;
    }
    if (q.suscripcion_ajuste) {
      const f = elegido ?? (fechaDe(q) ? mesDe(fechaDe(q) as string) : mesInicio);
      const s = crear(mesAcotado(f));
      s?.ajustes.push(enMes(q, num(q.monto_usd), !!elegido, null));
      continue;
    }
    const fijo = elegido ?? cuota;
    if (fijo) {
      const s = crear(mesAcotado(fijo));
      if (s) { s.pagos.push(enMes(q, num(q.monto_usd), !!elegido, null)); s.pagadoUsd = redondo(s.pagadoUsd + num(q.monto_usd)); }
      continue;
    }
    porOrden.push(q);
  }

  // 2 · Lo demás, por fecha, al mes más viejo que falte completar.
  porOrden.sort((a, b) => String(fechaDe(a) ?? '').localeCompare(String(fechaDe(b) ?? '')) || (a.id ?? 0) - (b.id ?? 0));
  const siguienteIncompleto = (desde: string): Slot | null => {
    for (let m = desde, i = 0; i < 600; m = sumarAlMes(m, 1), i++) {
      const s = crear(m);
      if (!s) return null;
      if (s.activo && !completo(s)) return s;
    }
    return null;
  };
  const ultimoActivo = (): Slot | null => [...slotDe.values()].filter((s) => s.activo).sort((a, b) => a.mes.localeCompare(b.mes)).at(-1) ?? null;
  for (const q of porOrden) {
    const monto = num(q.monto_usd);
    const unidad = !!q.es_mensualidad;
    if (unidad) {
      const s = siguienteIncompleto(mesInicio) ?? ultimoActivo() ?? crear(mesInicio);
      if (!s) continue;
      s.pagos.push(enMes(q, monto, false, null));
      s.pagadoUsd = redondo(s.pagadoUsd + monto);
      // Sin historia de montos, una mensualidad registrada vale un mes (la regla de antes).
      if (!conHistoria) s.cubierto = true;
      continue;
    }
    // Plata suelta o de la pasarela: primero completa un mes a medias, después cubre meses ENTEROS por su plata.
    let resto = monto;
    const partes: Array<{ s: Slot; m: number }> = [];
    const poner = (s: Slot, m: number) => { partes.push({ s, m }); s.pagadoUsd = redondo(s.pagadoUsd + m); resto = redondo(resto - m); };
    let s = siguienteIncompleto(mesInicio);
    if (s && s.pagadoUsd > 0 && s.esperadoUsd != null) {
      poner(s, Math.min(resto, Math.max(0, s.esperadoUsd - s.pagadoUsd)));
      if (completo(s)) s = siguienteIncompleto(sumarAlMes(s.mes, 1));
    }
    if (resto > 0.005 && s) {
      if (s.esperadoUsd == null) poner(s, resto);
      else {
        const r = mesesDePlata(resto, s.esperadoUsd);
        // Meses enteros (con el 10%), o los que llega a cubrir. Sin historia, al menos uno (la regla de antes).
        const k = r.enteros || conHistoria ? r.meses : Math.max(1, r.meses);
        const parte = k > 0 ? (r.enteros || !conHistoria ? resto / k : s.esperadoUsd) : 0;
        for (let i = 0; i < k && s; i++) {
          const actual: Slot = s;
          poner(actual, i === k - 1 && (r.enteros || !conHistoria) ? resto : redondo(parte));
          actual.cubierto = true;
          s = siguienteIncompleto(sumarAlMes(actual.mes, 1));
        }
        // Con historia, lo que no llega a un mes entero queda a medias en el siguiente.
        if (resto > 0.005 && s) poner(s, resto);
      }
    }
    if (resto > 0.005) {
      const ult = partes.at(-1)?.s ?? ultimoActivo() ?? crear(mesInicio);
      if (ult) poner(ult, resto);
    }
    for (const p of partes) p.s.pagos.push(enMes(q, p.m, false, partes.length > 1 ? redondo(monto) : null));
  }

  // 3 · Los meses en orden, con su estado y lo que cambió.
  const meses = [...slotDe.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  // Se muestran hasta el mes que viene, o el último con algo adentro.
  const ultimoConAlgo = meses.filter((s) => s.pagos.length || s.ajustes.length || s.programado.length).map((s) => s.mes).at(-1) ?? mesInicio;
  const hasta = [sumarAlMes(mesHoy, 1), ultimoConAlgo].sort().at(-1) as string;
  const visibles = meses.filter((s) => s.mes <= hasta);
  let antes: number | null = null;
  let estabaActivo = false;
  for (const s of visibles) {
    const lleno = completo(s);
    s.faltaUsd = s.esperadoUsd == null ? (s.pagadoUsd > 0 ? 0 : null) : lleno ? 0 : redondo(Math.max(0, s.esperadoUsd - s.pagadoUsd));
    s.deMasUsd = s.esperadoUsd != null && !s.cubierto ? redondo(Math.max(0, s.pagadoUsd - s.esperadoUsd)) : 0;
    if (!s.activo) s.estado = 'cortado';
    else if (lleno) s.estado = 'pagado';
    else if (s.pagadoUsd > 0) s.estado = 'parcial';
    else if (s.vence < hoy) s.estado = 'vencido';
    else if (s.vence === hoy) s.estado = 'vence-hoy';
    else s.estado = s.mes <= mesHoy ? 'por-cobrar' : 'proximo';
    // Lo que se movió (ChartMogul: New, Expansion, Contraction, Churn, Reactivation).
    if (!s.activo) {
      if (estabaActivo) s.cambio = 'se-corto';
    } else if (!estabaActivo) {
      s.cambio = antes == null && s.mes === visibles.find((x) => x.activo)?.mes ? 'empezo' : 'volvio';
      if (s.cambio === 'volvio' && antes != null && s.esperadoUsd != null && s.esperadoUsd !== antes) s.antesUsd = antes;
    } else if (antes != null && s.esperadoUsd != null && Math.abs(s.esperadoUsd - antes) >= 0.01) {
      s.cambio = s.esperadoUsd > antes ? 'subio' : 'bajo';
      s.antesUsd = antes;
    }
    if (s.activo && s.esperadoUsd != null) antes = s.esperadoUsd;
    estabaActivo = s.activo;
  }

  const actual = visibles.find((s) => s.mes === mesHoy) ?? null;
  const cortadaDesde = (() => {
    if (!cortado(mesHoy) && !(mesFin && mesHoy > mesFin && cortado(mesFin))) return null;
    let desde: string | null = null;
    for (const m of cortes) if (mesDe(m.desde) <= mesHoy) desde = m.tipo === 'corte' ? mesDe(m.desde) : null;
    return desde;
  })();
  const terminada = !!mesFin && mesHoy > mesFin;
  const debidos = visibles.filter((s) => s.activo && s.vence <= hoy && s.estado !== 'pagado');
  const montoEsteMes = actual && actual.activo ? actual.esperadoUsd : montoDelMes(mesHoy, montoLead, movs);
  const inferido = montoEsteMes == null ? montoPorLoPagado(e.pagos) : null;
  const pendientes = visibles.filter((s) => s.activo && s.estado !== 'pagado');
  const prox = pendientes[0] ?? null;
  const proxFutura = visibles.find((s) => s.activo && s.estado !== 'pagado' && s.vence >= hoy) ?? null;
  const ajustesUsd = redondo(visibles.reduce((t, s) => t + s.ajustes.reduce((u, a) => u + a.montoUsd, 0), 0));

  return {
    meses: visibles.map(({ activo: _a, cubierto: _c, ...s }) => s),
    montoHoyUsd: cortadaDesde || terminada ? null : montoEsteMes ?? inferido,
    montoInferido: !cortadaDesde && !terminada && montoEsteMes == null && inferido != null,
    diaDeCobro: diaPara(mesHoy),
    proximo: cortadaDesde || terminada || !prox ? null : { mes: prox.mes, vence: prox.vence, faltaUsd: prox.faltaUsd, vencido: prox.vence < hoy },
    proximaFecha: cortadaDesde || terminada ? null : proxFutura?.vence ?? null,
    totalPagadoUsd: redondo(cobradas.reduce((t, q) => t + num(q.monto_usd), 0)),
    ajustesUsd,
    cortadaDesde,
    terminada,
    mesesSinPagar: debidos.filter((s) => s.pagadoUsd <= 0).length,
    mesesParciales: debidos.filter((s) => s.pagadoUsd > 0).length,
    deudaUsd: redondo(debidos.reduce((t, s) => t + (s.faltaUsd ?? 0), 0)),
    mesesPagados: visibles.filter((s) => s.estado === 'pagado').length,
    conHistoria,
  };
}

/** «noviembre 2026» de «2026-11» (con el año sólo si no es el de `hoy`). */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function nombreDelMes(mes: string, hoy?: string | null): string {
  const [y, m] = mes.split('-').map(Number);
  const nombre = MESES[m - 1] ?? mes;
  return hoy && Number(hoy.slice(0, 4)) === y ? nombre : `${nombre} ${y}`;
}

/** El rótulo corto de lo que se movió en un mes. */
export const ROTULO_CAMBIO: Readonly<Record<CambioDelMes, string>> = {
  empezo: 'Empezó', subio: 'Subió', bajo: 'Bajó', 'se-corto': 'Se cortó', volvio: 'Volvió',
};

/** El rótulo corto del estado de un mes. */
export const ROTULO_ESTADO_MES: Readonly<Record<EstadoMes, string>> = {
  pagado: 'Pagado', parcial: 'Parcial', vencido: 'Vencido', 'vence-hoy': 'Vence hoy', 'por-cobrar': 'Por cobrar', proximo: 'Próximo', cortado: 'Cortada',
};

/** Los meses que se pueden elegir al registrar un pago: los que no están cortados, del más viejo sin completar al que viene. */
export function mesesParaRegistrar(h: HistoriaSuscripcion): Array<{ mes: string; faltaUsd: number | null; estado: EstadoMes }> {
  return h.meses.filter((s) => s.estado !== 'cortado').map((s) => ({ mes: s.mes, faltaUsd: s.faltaUsd, estado: s.estado }));
}

/** El mes que conviene proponer al registrar un pago: el más viejo que falta completar, o el actual. */
export function mesSugerido(h: HistoriaSuscripcion, hoy: string): string {
  const abiertos = h.meses.filter((s) => s.estado !== 'cortado');
  return abiertos.find((s) => s.estado !== 'pagado')?.mes ?? abiertos.map((s) => s.mes).filter((m) => m <= mesDe(hoy)).at(-1) ?? mesDe(hoy);
}

/**
 * EL MRR DE UNA SUSCRIPCIÓN (lo usa `getMrrActivo`, lib/queries.ts): la mensualidad de este mes con los cambios guardados;
 * cortada hoy, nada; sin monto cargado, lo pagado el último mes (`estimado`). Pedido del encargo: «`suscripcion_monto_usd`
 * en null no puede dar MRR 0 cuando hay pagos». El plazo y la cancelación vieja los mira quien llama, como siempre.
 */
export function mrrDeSuscripcion(e: { montoUsd: number | string | null | undefined; movimientos?: readonly MovimientoSuscripcion[]; pagos?: readonly PagoDeSuscripcion[]; hoy: string }): { usd: number | null; estimado: boolean } {
  const movs = ordenarMovimientos(e.movimientos ?? []);
  const mes = mesDe(e.hoy);
  let cortada = false;
  for (const m of movs) if ((m.tipo === 'corte' || m.tipo === 'vuelta') && mesDe(m.desde) <= mes) cortada = m.tipo === 'corte';
  if (cortada) return { usd: null, estimado: false };
  const v = montoDelMes(mes, positivo(e.montoUsd), movs);
  if (v != null) return { usd: v, estimado: false };
  const p = montoPorLoPagado(e.pagos ?? []);
  return { usd: p, estimado: p != null };
}
