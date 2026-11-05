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

import { fechaEnPalabras } from './date-utils';
import { montoDeTarjeta, suscripcionDeFila, ventaTipoDe, VENTA_SIN_COBRO, type VentaTipo } from './venta-tipo';
import type { EstadoCobro, TipoCobro } from './cobros-tipos';
import { historiaDeSuscripcion, type HistoriaSuscripcion, type MovimientoSuscripcion, type PagoDeSuscripcion } from './suscripcion-meses';

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
  /** Nació cobrada (un pago suelto, una mensualidad a mano, el cobro de un link sin cuota): no es del plan (`esCuotaDelPlan`). */
  nacio_cobrada?: boolean | null;
  /** La diferencia de un cobro por menos: el id de la cuota de la que salió (la escribe `cobrar_cuota_con_resto`). */
  resto_de?: number | null;
  /** Se registró COMO la mensualidad («Registrar el mes cobrado», mig 0323): vale un mes, sea del monto que sea. */
  es_mensualidad?: boolean | null;
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
  pagos: readonly (CuotaParaCobrado & Partial<Pick<PagoDeSuscripcion, 'suscripcion_mes' | 'suscripcion_ajuste' | 'metodo' | 'concepto' | 'comprobante_path'>>)[];
  cobros?: readonly CobroParaCobrado[];
  /**
   * Los cambios de una suscripción (mig 0401, lib/suscripcion-meses.ts): los montos desde una fecha, los cortes y las
   * vueltas. Sin ellos (o sin la migración), el monto del lead vale para todos los meses, como siempre.
   */
  movimientos?: readonly MovimientoSuscripcion[];
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
    /** Los meses que cubre lo cobrado, de a una cobrada (`mesesDeUnaCobrada`): una mensualidad, uno; un adelanto, sus meses.
     *  Es con lo que se cuenta `sinRegistrar`, y desde dónde vence el primer mes sin registrar («A quién cobrar»). */
    mesesCubiertos: number;
    /** Una manual sin fecha de cierre: no hay desde cuándo contar los meses, y `sinRegistrar` en 0 no quiere decir «al día». */
    sinCierre: boolean;
    /** (5/11/2026) La mensualidad no está cargada y `mensualidadUsd` sale de lo pagado el último mes: una estimación. */
    mensualidadInferida: boolean;
    /** El primer mes que falta completar (lib/suscripcion-meses.ts), o null. */
    proximoMes: HistoriaSuscripcion['proximo'];
    /** La suscripción mes a mes (lib/suscripcion-meses.ts): la misma cuenta que dibuja la tab Pagos. */
    historia: HistoriaSuscripcion;
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
/**
 * «14 de noviembre» de «2026-11-14» (22/10/2026: era «14/11», y un cliente no sabía si «01/04» era el 1 de abril o el 4
 * de enero). Con `hoy` de otro año lleva el año; sin `hoy`, se da por el año en curso (como el «14/11» de antes).
 */
export const ddmm = (iso: string, hoy?: string | null): string => fechaEnPalabras(iso, hoy ?? iso);

function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T12:00:00Z`);
  const b = Date.parse(`${hasta}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * ⚠️ CUÁNTOS MESES ENTEROS SON `plata` DE UNA MENSUALIDAD (21/10/2026, quinta revisión): lo cobrado suelto en una
 * suscripción se cuenta por plata, no por filas. Contando filas, un adelanto de 3 meses en UN pago cubría un mes (el
 * asistente armaba cuotas por meses pagados, y la ficha decía «Falta registrar» para siempre) y una seña de US$100
 * cubría un mes entero. Un 10% por mes de tolerancia: el tipo de cambio de un cobro en otra moneda. `enteros`: si da
 * meses enteros; si no, `meses` son los que llega a cubrir (la seña, 0). La usan `cobradoDelLead` y el asistente de
 * Ganado (`planDelAsistente`, lib/pagos-campo.ts), así los dos cuentan igual.
 *
 * ⚠️ LA TOLERANCIA ES FIJA, UN 10% DE UNA MENSUALIDAD (revisión de f2ec0c948, medio): multiplicada por los meses, las
 * ventanas se pisaban desde 4,5 mensualidades y TODO monto daba «meses enteros». Un año prepagado a −5% de cambio
 * (US$5.700) contaba 11 meses y la cobranza le reclamaba uno a quien pagó el año; 6 meses con 10% de descuento (US$2.700)
 * contaban 5. Lo que no cae cerca de un número entero de mensualidades no son meses enteros: el asistente no arma y lo dice.
 */
export function mesesDePlata(plata: number, mensualidad: number): { meses: number; enteros: boolean } {
  if (!(mensualidad > 0) || !(plata > 0)) return { meses: 0, enteros: !(plata > 0) };
  const k = Math.round(plata / mensualidad);
  const enteros = k >= 1 && Math.abs(plata - k * mensualidad) <= 0.1 * mensualidad;
  return { meses: enteros ? k : Math.floor(plata / mensualidad), enteros };
}

/**
 * ⚠️ ¿ES UNA CUOTA DEL PLAN? UNA sola regla (revisión de 7524ec1c9, alta) para el lugar de una cuota en el plan uniforme
 * (`reconciliarCuotas` en 'slots', lib/pagos-campo.ts), para la plata suelta (`esPlataSuelta`: la ficha y el asistente)
 * y para `avisoPlanUniforme`. Con tres reglas, la seña cobrada por LINK era plata suelta para el aviso y la cuota 1 para
 * el lugar (el plan quedaba US$200 corto al cambiar la cuota), y la diferencia de un cobro por menos tomaba el lugar de
 * la cuota siguiente (US$600 de deuda fantasma al crecer el plan). No es del plan lo que nació fuera de él, y la fila lo
 * dice desde que se inserta:
 * - `nacio_cobrada`: un pago suelto, una mensualidad a mano, y el cobro de un link que no saldaba ninguna cuota
 *   (`registrarCobroDeProveedor` la marca desde el 21/10/2026; antes, 0 filas de la pasarela en producción);
 * - `resto_de`: la diferencia de un cobro por menos (la escribe `cobrar_cuota_con_resto`).
 * Una cuota del plan cobrada por link SIGUE siendo del plan: tiene proveedor, pero no nació cobrada. Por eso la pasarela
 * no entra en la regla (antes `proveedor` hacía suelta cualquier cobrada por link).
 */
export const esCuotaDelPlan = (q: { nacio_cobrada?: boolean | null; resto_de?: number | null }): boolean =>
  !q.nacio_cobrada && q.resto_de == null;

/** Plata suelta: lo cobrado que no es una cuota del plan (`esCuotaDelPlan`). La ficha y el asistente cuentan con ésta. */
export const esPlataSuelta = (q: { pagado?: boolean | null; nacio_cobrada?: boolean | null; resto_de?: number | null }): boolean =>
  !!q.pagado && !esCuotaDelPlan(q);

/**
 * ⚠️ CUÁNTOS MESES CUBRE UNA COBRADA DE UNA SUSCRIPCIÓN, DE A UNA (revisión de 7524ec1c9, alta). Sumando todas las
 * sueltas y pasando el total por `mesesDePlata`, el desvío se acumulaba: 6 × 490 daba 5 meses («Falta registrar 1 mes»
 * y US$500 reclamados a un cliente al día) y 10 × 550 daba 11 (escondía al que debe el mes 11).
 * ⚠️ LO QUE SE REGISTRÓ COMO LA MENSUALIDAD VALE UN MES, SIEMPRE (revisión de e19a5196f, medio). Contada por plata, una
 * BAJA de precio escondía deuda: 6 mensualidades de 1.000 con la mensualidad ya en 500 eran 12 meses («Al día», fuera de
 * «A quién cobrar»; producción decía «Falta registrar 5 meses»). Cómo se registró lo dice la fila (`es_mensualidad`,
 * mig 0323), no su monto.
 * - Una cuota del plan, o una cobrada registrada como la mensualidad: 1.
 * - La diferencia de un cobro por menos: 0, completa el mes de su cuota.
 * - Un pago suelto (a mano con «Registrar un pago», o el cobro de un link sin cuota): `max(1, mesesDePlata(su monto))`.
 *   Lo que cubre varios meses cuenta por plata (un adelanto de 1.500 = 3); uno chico, un mes, como producción. La
 *   pasarela igual que la mano: contado por plata sin el mínimo, un link de un mes al tipo de cambio del día valía 0.
 * `enteros`: si su monto son meses enteros. El asistente no arma si alguno no lo es (ninguna seña se descuenta de un plan).
 */
export function mesesDeUnaCobrada(
  q: { monto_usd?: number | string | null; nacio_cobrada?: boolean | null; resto_de?: number | null; es_mensualidad?: boolean | null },
  mensualidad: number | null,
): { meses: number; enteros: boolean } {
  if (q.resto_de != null) return { meses: 0, enteros: true };
  if (esCuotaDelPlan(q) || q.es_mensualidad || !mensualidad) return { meses: 1, enteros: true };
  const r = mesesDePlata(num(q.monto_usd), mensualidad);
  return { meses: Math.max(1, r.meses), enteros: r.enteros };
}

/** La fecha `meses` después de `iso`, con el día capado al último del mes (31/01 + 1 = 28/02 o 29/02). */
export function sumarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + meses, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

/**
 * ⚠️ La fecha que propone «+ Agregar cuota» en el asistente del CRM (21/10/2026, revisión adversarial): la ÚLTIMA cuota
 * más un mes, en el día PACTADO, que es el de la primera mensualidad (la segunda cuota: la primera suele ser el
 * anticipo), con el tope de fin de mes. Contar desde la primera por posición ignoraba el día elegido (anticipo el 21,
 * mensualidades el 05: proponía el 21/12) y, al quitar una del medio, repetía una fecha que ya estaba.
 */
export function siguienteFechaDeCuota(fechas: ReadonlyArray<string | null | undefined>, hoy: string): string {
  const validas = fechas.filter((f): f is string => !!f && /^\d{4}-\d{2}-\d{2}$/.test(f));
  if (!validas.length) return hoy;
  const diaDe = (iso: string) => Number(iso.slice(8, 10));
  const esFinDeMes = (iso: string) => diaDe(iso) === new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).getUTCDate();
  // Un 30/11 que vino de un 31: el pactado es el 31 (la primera lo dice), no el 30.
  const mensual = validas[1] ?? validas[0];
  const dia = validas.length > 1 && esFinDeMes(mensual) && diaDe(validas[0]) > diaDe(mensual) ? diaDe(validas[0]) : diaDe(mensual);
  // Desde la MÁS TARDÍA (no la última de la lista): el mes siguiente a todas no puede repetir ninguna.
  const ultima = [...validas].sort().at(-1) as string;
  return sumarMeses(`${ultima.slice(0, 8)}${String(dia).padStart(2, '0')}`, 1);
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

    // La próxima: la cuota impaga que vence primero, o la renovación que toca, mes a mes desde su ANCLA.
    // ⚠️ EL ANCLA DE UNA SUSCRIPCIÓN DE LA PASARELA ES SU ÚLTIMO COBRO, no el cierre (17/10/2026): Stripe y Mercado Pago
    // cobran el día en que se autorizó (y una renovación que se reintenta corre la fecha), así que proyectar desde
    // `fecha_cierre` decía «próxima el 05» de una que cobra el 12. Sin un cobro de la pasarela asentado, el cierre.
    const ultimoDeLaPasarela = fuente === 'pasarela'
      ? cobradas.filter((q) => q.proveedor && q.fecha_pago).map((q) => String(q.fecha_pago).slice(0, 10)).sort().at(-1) ?? null
      : null;
    const ancla = ultimoDeLaPasarela ?? fechaCierre;
    let proximaRenovacion: string | null = null;
    if (estado === 'activa' && ancla) {
      let k = 1;
      let f = sumarMeses(ancla, k);
      while (f < hoy && k < 1200) { k++; f = sumarMeses(ancla, k); }
      proximaRenovacion = finPlazo && f >= finPlazo ? null : f;
    }
    // ⚠️ LOS MESES SALEN DE LA SUSCRIPCIÓN MES A MES (5/11/2026, lib/suscripcion-meses.ts), la misma cuenta que dibuja la
    // tab Pagos. Hasta acá cada cobrada contaba un mes (`mesesDeUnaCobrada`): noviembre de Código Inmobiliario, pagado en
    // DOS pagos, contaba como dos meses y lo daba por adelantado; y el monto, uno solo para todos los meses, no podía
    // decir que octubre valía 146 y noviembre 238. Sin cambios guardados, una mensualidad registrada sigue valiendo un mes.
    const historia = historiaDeSuscripcion({
      inicio: fechaCierre, montoUsd: e.suscripcionMontoUsd ?? null, plazoMeses: suscripcionMeses,
      canceladaAt: e.suscripcionCanceladaAt ?? null, movimientos: e.movimientos ?? [], pagos: e.pagos as readonly PagoDeSuscripcion[], hoy,
    });
    const cortadaManual = fuente === 'manual' && !!historia.cortadaDesde;
    const estadoFinal: EstadoSuscripcion = estado === 'activa' && cortadaManual ? 'cancelada' : estado;
    if (estadoFinal !== 'activa') proximaRenovacion = null;
    else if (fuente === 'manual') proximaRenovacion = historia.proximaFecha;
    const mesesCubiertos = historia.mesesPagados;
    // Una manual se registra mes a mes: los meses que ya vencieron y no están completos, avisan.
    let sinRegistrar = 0;
    if (fuente === 'manual' && estadoFinal === 'activa' && fechaCierre && fechaCierre <= hoy) {
      sinRegistrar = historia.mesesSinPagar + historia.mesesParciales;
    }
    const soloParcial = sinRegistrar > 0 && historia.mesesSinPagar === 0;
    // ⚠️ SIN CIERRE NO HAY MESES QUE CONTAR, Y «AL DÍA» NO ES EL VALOR POR DEFECTO (ticket #53, Leila, 04/11/2026). Sacar a un
    // cliente de Ganado borra su `fecha_cierre` (lib/lead-desenlace.ts: la venta sólo vive con `cerro`). `sinRegistrar` quedaba
    // en 0 porque no se contaba, y la cuenta caía al último renglón: un cliente que decía «Falta registrar 2 meses» pasó a
    // «Al día», en verde, en el mismo clic que lo sacó de Ganado. Una cuota con fecha sí se puede medir: ésa no entra acá.
    const sinCierre = fuente === 'manual' && estadoFinal === 'activa' && !fechaCierre;
    // La mensualidad de HOY: la de este mes con los cambios guardados; sin monto cargado, lo pagado el último mes (una
    // estimación, `mensualidadInferida`). Pedido del encargo: un monto vacío no puede dar MRR 0 con pagos hechos.
    const mensualidad = fuente === 'manual' ? historia.montoHoyUsd ?? suscripcionMonto : suscripcionMonto;
    const totalUsd = suscripcionMonto && suscripcionMeses ? redondo(suscripcionMonto * suscripcionMeses) : null;
    const pct = totalUsd ? Math.min(100, Math.round((cobradoUsd / totalUsd) * 100)) : null;
    const cuando = proxima?.fecha ?? proximaRenovacion;
    const semaforo: Cobrado['semaforo'] =
      estadoFinal === 'cancelada' ? { tono: 'gris', texto: 'Cancelada' }
      : renovacionFallida ? { tono: 'rojo', texto: 'Falló la renovación' }
      : vencidas.length ? { tono: 'rojo', texto: 'Cuota vencida' }
      : estadoFinal === 'terminada' ? { tono: 'gris', texto: `Terminó el ${ddmm(finPlazo as string, hoy)}` }
      : cobradas.length === 0 && impagas.length === 0 ? { tono: 'gris', texto: 'Sin cobros registrados' }
      : soloParcial ? { tono: 'ambar', texto: sinRegistrar === 1 ? 'Pago parcial' : `${sinRegistrar} meses con pago parcial` }
      : sinRegistrar > 0 ? { tono: 'ambar', texto: sinRegistrar === 1 ? 'Falta registrar 1 mes' : `Falta registrar ${sinRegistrar} meses` }
      : sinCierre && !proxima ? { tono: 'gris', texto: 'Sin fecha de cierre' }
      : { tono: 'verde', texto: cuando ? `Al día · próxima el ${ddmm(cuando, hoy)}` : 'Al día' };
    return {
      ...base,
      seDibuja: true,
      totalUsd,
      pct,
      texto: totalUsd ? `${usd(cobradoUsd)} cobrado de ${usd(totalUsd)}` : `${usd(cobradoUsd)} cobrado`,
      semaforo,
      suscripcion: {
        estado: estadoFinal,
        mensualidadTexto: montoDeTarjeta({ ventaTipo: tipo, monto: null, suscripcionMonto: mensualidad }).texto,
        mensualidadUsd: mensualidad,
        meses: suscripcionMeses,
        finPlazo,
        proximaRenovacion,
        renovacionFallida,
        fuente,
        sinRegistrar,
        mesesCubiertos,
        sinCierre,
        mensualidadInferida: fuente === 'manual' && historia.montoInferido,
        proximoMes: estadoFinal === 'activa' ? historia.proximo : null,
        historia,
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
