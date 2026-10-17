// =============================================================================
// cobrado-lead — «$X cobrado de $Y»: lo cobrado de UN lead, en una función pura
// =============================================================================
// El bloque `cobrado` de docs/diseno-ficha-bloques.md §3 Pagos (también en el Resumen y en Customer Success) y la
// lectura `cobranza_lead` de la API de MaKo cuentan lo MISMO con esta función. Hasta el 14/10/2026 la cuenta vivía
// adentro de DealDetailsCard.tsx (:348-359), y tenía tres mentiras medidas en el código:
//
//   1. Una MENSUALIDAD ACTIVA con todo lo registrado cobrado decía «Pagado por completo», en verde: la suma de las
//      cuotas era el total. Una suscripción no se termina de pagar; está al día o no. Acá dice «Al día · próxima el …».
//   2. Una RENOVACIÓN RECHAZADA se pintaba en verde: el rechazo de una renovación queda en `cobros.motivo` de un
//      cobro que sigue «Pagado» (lib/cobros.ts, `aplicarPagoFallido`), y la tarjeta sólo miraba las cuotas.
//   3. Un pago único SIN cuotas decía «Al corriente» en verde: no había nada que estuviera al corriente.
//
// Y las dos reglas de siempre: la plata de una suscripción se lee con `suscripcionDeFila` y la de un cierre con
// `montoDeTarjeta` (lib/venta-tipo.ts), nunca `monto_cierre_usd` pelado (en ws11 eso infló el MRR un 85%,
// docs/hallazgos-crm.md); y un becado no tiene cobrado (`seDibuja: false`).
//
// Sin `server-only`: lo importan los bloques (navegador), la API de MaKo y los tests, que la EJECUTAN.
// =============================================================================

import { montoDeTarjeta, suscripcionDeFila, ventaTipoDe, VENTA_SIN_COBRO, type VentaTipo } from './venta-tipo';
import type { EstadoCobro, TipoCobro } from './cobros-tipos';

/**
 * El comienzo del `motivo` que `aplicarPagoFallido` (lib/cobros.ts) escribe cuando falla la RENOVACIÓN de una
 * suscripción ya pagada. Lo escribe y lo lee el mismo texto: si uno cambia, el otro también.
 * `aplicarPagoAprobado` lo borra cuando una renovación posterior entra.
 */
export const PREFIJO_RENOVACION_FALLIDA = 'Falló el cobro de la renovación';
export const esRenovacionFallida = (motivo: string | null | undefined): boolean =>
  typeof motivo === 'string' && motivo.startsWith(PREFIJO_RENOVACION_FALLIDA);

/** Lo que la función necesita de una cuota (`pagos`). Acepta la fila tal cual llega de la base. */
export type CuotaParaCobrado = {
  id?: number | null;
  monto_usd: number | string;
  pagado: boolean;
  fecha_esperada: string | null;
  fecha_pago?: string | null;
  moneda?: string | null;
  monto_original?: number | string | null;
  proveedor?: string | null;
  cobro_id?: number | null;
  /** El cliente se dio de baja (mig 0307): impaga, no es deuda. `baja_vencia` es el vencimiento que tenía. */
  baja_at?: string | null;
  baja_vencia?: string | null;
};

/** Lo que necesita de un cobro de la pasarela (`cobros`, o el `CobroVisible` de la ficha). */
export type CobroParaCobrado = {
  tipo: TipoCobro;
  estado: EstadoCobro;
  suscripcion_estado?: 'activa' | 'cancelada' | null;
  motivo?: string | null;
};

export type EntradaCobrado = {
  ventaTipo: string | null | undefined;
  montoCierreUsd: number | string | null | undefined;
  suscripcionMontoUsd: number | string | null | undefined;
  suscripcionMeses: number | string | null | undefined;
  fechaCierre: string | null | undefined;
  /** La cancelación de una suscripción MANUAL (`leads.suscripcion_cancelada_at`, mig 0292). */
  suscripcionCanceladaAt?: string | null;
  pagos: readonly CuotaParaCobrado[];
  cobros?: readonly CobroParaCobrado[];
  /** YYYY-MM-DD de hoy en la zona del NEGOCIO (`hoyEnWorkspace`), no la del server. */
  hoy: string;
};

export type Tono = 'verde' | 'ambar' | 'rojo' | 'gris';

export type EstadoSuscripcion = 'activa' | 'cancelada' | 'terminada';

export type Cobrado = {
  /** false = el bloque no se dibuja: un becado, o un lead sin venta ni cuotas. */
  seDibuja: boolean;
  tipo: VentaTipo;
  cobradoUsd: number;
  /** El «de $Y». null = no hay un total: una suscripción mes a mes, o nada cargado. */
  totalUsd: number | null;
  pendienteUsd: number;
  vencidoUsd: number;
  /** 0-100, o null sin total. */
  pct: number | null;
  /** «$1,200 cobrado de $3,000» · «$800 cobrado». */
  texto: string;
  semaforo: { tono: Tono; texto: string };
  proxima: { pagoId: number | null; fecha: string; montoUsd: number } | null;
  cuotas: { total: number; cobradas: number; vencidas: number; porVencer: number };
  suscripcion: null | {
    estado: EstadoSuscripcion;
    /** «$800/mes» (montoDeTarjeta). */
    mensualidadTexto: string;
    mensualidadUsd: number | null;
    meses: number | null;
    /** YYYY-MM-DD en que termina el plazo fijo; null = mes a mes. */
    finPlazo: string | null;
    proximaRenovacion: string | null;
    /** El motivo si la última renovación de la pasarela falló y no entró otra después. */
    renovacionFallida: string | null;
    /** 'pasarela' si la cobra Stripe o Mercado Pago; 'manual' si se registran las cobradas a mano. */
    fuente: 'pasarela' | 'manual';
    /** Meses que ya tendrían que estar registrados y no lo están (sólo la manual). */
    sinRegistrar: number;
  };
  /** Lo cobrado en su moneda ORIGINAL, donde no fue en dólares (`pagos.moneda` + `monto_original`). */
  monedas: Array<{ moneda: string; monto: number }>;
  /** Sólo un pago único con cuotas y monto de cierre: si el plan suma lo mismo que el cierre. */
  cuadra: null | { cuadra: boolean; diferenciaUsd: number };
  /** El cliente se dio de baja (#871): lo que quedó sin cobrar y cuándo. null si no hay cuotas de baja. */
  baja: null | { usd: number; at: string | null };
};

const redondo = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const usd = (n: number): string => '$' + redondo(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
/** «14/11» de «2026-11-14». */
export const ddmm = (iso: string): string => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };

function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T12:00:00Z`);
  const b = Date.parse(`${hasta}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** La fecha `meses` después de `iso`, con el día capado al último del mes (31/01 + 1 = 28/02 o 29/02). */
export function sumarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + meses, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

/**
 * ¿Es una cuota DEVUELTA? Un reembolso de la pasarela la deja impaga, sin vencimiento y con su proveedor
 * (`desmarcarCobroDeProveedor`, lib/pagos.ts): queda en la tabla para el historial y no es deuda.
 */
export const esCuotaDevuelta = (q: Pick<CuotaParaCobrado, 'pagado' | 'fecha_esperada' | 'proveedor' | 'cobro_id'>): boolean =>
  !q.pagado && !q.fecha_esperada && (!!q.proveedor || q.cobro_id != null);

/**
 * ¿Es una cuota de un cliente que se DIO DE BAJA (#871, mig 0307)? Impaga, con `baja_at`: lo que no pagó deja de ser
 * deuda y queda en la tabla para el historial (lib/pagos-baja.ts). Cobrada, ya no es «de baja»: el cliente volvió y
 * pagó esa cuota.
 */
export const esCuotaDeBaja = (q: Pick<CuotaParaCobrado, 'pagado' | 'baja_at'>): boolean => !q.pagado && !!q.baja_at;

/**
 * ¿La cuota QUEDA FUERA de la deuda? La devuelta por un reembolso y la de un cliente dado de baja. Toda lectura que
 * suma lo que falta cobrar sobre filas sin vencimiento usa ESTA y no `esCuotaDevuelta`: las dos quedan impagas y sin
 * fecha, y la que sólo mira la devuelta vuelve a contar a quien se fue (tests/pagos-baja.test.ts lo barre).
 */
export const noEsDeuda = (q: Pick<CuotaParaCobrado, 'pagado' | 'fecha_esperada' | 'proveedor' | 'cobro_id' | 'baja_at'>): boolean =>
  esCuotaDevuelta(q) || esCuotaDeBaja(q);

export function cobradoDelLead(e: EntradaCobrado): Cobrado {
  const tipo = ventaTipoDe(e.ventaTipo);
  const hoy = e.hoy;
  const cuotas = e.pagos.filter((q) => !noEsDeuda(q));
  // Lo que quedó sin cobrar de un cliente que se dio de baja (#871): no es deuda, pero se dice.
  const deBaja = e.pagos.filter(esCuotaDeBaja);
  const baja = deBaja.length
    ? { usd: redondo(deBaja.reduce((s, q) => s + num(q.monto_usd), 0)), at: deBaja.map((q) => q.baja_at as string).sort().pop() ?? null }
    : null;
  const cobradas = cuotas.filter((q) => q.pagado);
  const impagas = cuotas.filter((q) => !q.pagado);
  const cobradoUsd = redondo(cobradas.reduce((s, q) => s + num(q.monto_usd), 0));
  const pendienteUsd = redondo(impagas.reduce((s, q) => s + num(q.monto_usd), 0));
  const vencidas = impagas.filter((q) => q.fecha_esperada && q.fecha_esperada < hoy);
  const porVencer = impagas.filter((q) => q.fecha_esperada && q.fecha_esperada >= hoy && diasEntre(hoy, q.fecha_esperada) <= 14);
  const vencidoUsd = redondo(vencidas.reduce((s, q) => s + num(q.monto_usd), 0));
  const siguiente = impagas.filter((q) => q.fecha_esperada).sort((a, b) => String(a.fecha_esperada).localeCompare(String(b.fecha_esperada)))[0];
  const proxima = siguiente ? { pagoId: siguiente.id ?? null, fecha: siguiente.fecha_esperada as string, montoUsd: redondo(num(siguiente.monto_usd)) } : null;

  const porMoneda = new Map<string, number>();
  for (const q of cobradas) {
    const m = (q.moneda ?? '').toUpperCase();
    if (!m || m === 'USD' || q.monto_original == null) continue;
    porMoneda.set(m, redondo((porMoneda.get(m) ?? 0) + num(q.monto_original)));
  }
  const monedas = [...porMoneda].map(([moneda, monto]) => ({ moneda, monto }));
  const conteo = { total: cuotas.length, cobradas: cobradas.length, vencidas: vencidas.length, porVencer: porVencer.length };
  const base = { tipo, cobradoUsd, pendienteUsd, vencidoUsd, proxima, cuotas: conteo, monedas, baja };

  // ── Becado: no tiene cobrado ──
  if (tipo === VENTA_SIN_COBRO) {
    return { ...base, seDibuja: false, totalUsd: null, pct: null, texto: 'Sin cobro', semaforo: { tono: 'gris', texto: 'Sin cobro' }, suscripcion: null, cuadra: null };
  }

  // ── Suscripción ──
  if (tipo === 'suscripcion') {
    const { suscripcionMonto, suscripcionMeses } = suscripcionDeFila({ venta_tipo: tipo, suscripcion_monto_usd: e.suscripcionMontoUsd ?? null, suscripcion_meses: e.suscripcionMeses ?? null });
    const fechaCierre = e.fechaCierre && /^\d{4}-\d{2}-\d{2}/.test(e.fechaCierre) ? e.fechaCierre.slice(0, 10) : null;
    const finPlazo = fechaCierre && suscripcionMeses ? sumarMeses(fechaCierre, suscripcionMeses) : null;
    const susCobros = (e.cobros ?? []).filter((c) => c.tipo === 'suscripcion');
    const activaPasarela = susCobros.find((c) => c.estado === 'pagado' && c.suscripcion_estado !== 'cancelada');
    const canceladaPasarela = !activaPasarela && susCobros.some((c) => c.suscripcion_estado === 'cancelada');
    const fuente: 'pasarela' | 'manual' = activaPasarela || canceladaPasarela ? 'pasarela' : 'manual';
    // ⚠️ UNA SUSCRIPCIÓN DE LA PASARELA ACTIVA LE GANA A LA MANUAL CANCELADA (revisión del 14/10/2026): el cliente que
    // volvió y paga por Stripe se pintaba «Cancelada» en gris, y una renovación que fallara tampoco se veía roja.
    const estado: EstadoSuscripcion = (e.suscripcionCanceladaAt && !activaPasarela) || canceladaPasarela
      ? 'cancelada'
      : finPlazo && finPlazo <= hoy ? 'terminada' : 'activa';
    const renovacionFallida = estado === 'activa' && activaPasarela && esRenovacionFallida(activaPasarela.motivo) ? (activaPasarela.motivo as string) : null;

    // La próxima: la cuota impaga que vence primero, o la renovación que toca (el día del cierre, mes a mes).
    let proximaRenovacion: string | null = null;
    if (estado === 'activa' && fechaCierre) {
      let k = 1;
      let f = sumarMeses(fechaCierre, k);
      while (f < hoy && k < 1200) { k++; f = sumarMeses(fechaCierre, k); }
      proximaRenovacion = finPlazo && f >= finPlazo ? null : f;
    }
    // Una manual se registra mes a mes: los meses que ya empezaron y no tienen su cobrada, avisan.
    let sinRegistrar = 0;
    if (fuente === 'manual' && estado === 'activa' && fechaCierre && fechaCierre <= hoy) {
      let esperadas = 1;
      while (sumarMeses(fechaCierre, esperadas) <= hoy && esperadas < 1200) esperadas++;
      if (suscripcionMeses) esperadas = Math.min(esperadas, suscripcionMeses);
      sinRegistrar = Math.max(0, esperadas - cobradas.length);
    }
    const totalUsd = suscripcionMonto && suscripcionMeses ? redondo(suscripcionMonto * suscripcionMeses) : null;
    const pct = totalUsd ? Math.min(100, Math.round((cobradoUsd / totalUsd) * 100)) : null;
    const cuando = proxima?.fecha ?? proximaRenovacion;
    const semaforo: Cobrado['semaforo'] =
      estado === 'cancelada' ? { tono: 'gris', texto: 'Cancelada' }
      : renovacionFallida ? { tono: 'rojo', texto: 'Falló la renovación' }
      : vencidas.length ? { tono: 'rojo', texto: 'Cuota vencida' }
      : estado === 'terminada' ? { tono: 'gris', texto: `Terminó el ${ddmm(finPlazo as string)}` }
      : cobradas.length === 0 && impagas.length === 0 ? { tono: 'gris', texto: 'Sin cobros registrados' }
      : sinRegistrar > 0 ? { tono: 'ambar', texto: sinRegistrar === 1 ? 'Falta registrar 1 mes' : `Falta registrar ${sinRegistrar} meses` }
      : { tono: 'verde', texto: cuando ? `Al día · próxima el ${ddmm(cuando)}` : 'Al día' };
    return {
      ...base,
      seDibuja: true,
      totalUsd,
      pct,
      texto: totalUsd ? `${usd(cobradoUsd)} cobrado de ${usd(totalUsd)}` : `${usd(cobradoUsd)} cobrado`,
      semaforo,
      suscripcion: {
        estado,
        mensualidadTexto: montoDeTarjeta({ ventaTipo: tipo, monto: null, suscripcionMonto }).texto,
        mensualidadUsd: suscripcionMonto,
        meses: suscripcionMeses,
        finPlazo,
        proximaRenovacion,
        renovacionFallida,
        fuente,
        sinRegistrar,
      },
      cuadra: null,
    };
  }

  // ── Pago único ──
  const cierre = montoDeTarjeta({ ventaTipo: tipo, monto: e.montoCierreUsd == null ? null : num(e.montoCierreUsd), suscripcionMonto: null }).valor;
  const sumaCuotas = redondo(cobradoUsd + pendienteUsd);
  // ⚠️ El total es lo VENDIDO cuando el plan suma menos: un link de US$1.000 cobrado sobre un cierre de US$3.000,
  // sin más cuotas, no está «pagado por completo» (decía eso: el total eran sólo las cuotas).
  const totalUsd = sumaCuotas > 0 ? Math.max(sumaCuotas, cierre) : cierre > 0 ? cierre : null;
  const sinCuota = cierre > 0 && cuotas.length > 0 ? redondo(cierre - sumaCuotas) : 0;
  const pct = totalUsd ? Math.min(100, Math.round((cobradoUsd / totalUsd) * 100)) : null;
  const seDibuja = cuotas.length > 0 || cierre > 0 || !!baja;
  const semaforo: Cobrado['semaforo'] =
    !seDibuja ? { tono: 'gris', texto: 'Sin venta' }
    : vencidas.length ? { tono: 'rojo', texto: 'Cuota vencida' }
    // Se fue y no queda nada vivo por cobrar: ni «falta cargar el resto» (lo que no pagó no es un resto) ni verde.
    : baja && pendienteUsd <= 0 ? { tono: 'gris', texto: 'Se dio de baja' }
    : cuotas.length === 0 ? { tono: 'ambar', texto: 'Sin cuotas cargadas' }
    : pendienteUsd <= 0 && sinCuota > 0.5 ? { tono: 'ambar', texto: 'Falta cargar el resto' }
    : pendienteUsd <= 0 && cobradoUsd > 0 ? { tono: 'verde', texto: 'Pagado por completo' }
    : porVencer.length ? { tono: 'ambar', texto: 'Cuota por vencer' }
    : { tono: 'verde', texto: 'Al corriente' };
  const cuadra = cuotas.length > 0 && cierre > 0 ? { diferenciaUsd: redondo(sumaCuotas - cierre), cuadra: Math.abs(sumaCuotas - cierre) < 0.5 } : null;
  return {
    ...base,
    seDibuja,
    totalUsd,
    pct,
    texto: totalUsd ? `${usd(cobradoUsd)} cobrado de ${usd(totalUsd)}` : `${usd(cobradoUsd)} cobrado`,
    semaforo,
    suscripcion: null,
    cuadra,
  };
}
