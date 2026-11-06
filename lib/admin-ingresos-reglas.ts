// =============================================================================
// admin-ingresos-reglas — lo que entra a MaKo: MRR, sus movimientos y lo cobrado por cliente (5/11/2026)
// =============================================================================
// Martín: «en SuperAdmin yo no estoy pudiendo ver... la cantidad de ingresos para suscripciones. ¿Cuánto es lo que me
// pagaron totalmente? ¿Cuánto me van pagando mes a mes?». Lo lee la sección Revenue de la tab Admin (app/admin) y la API
// (`ver_ingresos_de_mako`). El lector de la base es lib/admin-ingresos.ts; acá sólo las cuentas, para que los tests las
// EJECUTEN (sin `server-only`).
//
// COPIADO DE CHARTMOGUL Y BAREMETRICS (docs/investigacion-admin.md, «Revenue»): el MRR sale de lo FACTURADO (acá, de lo
// COBRADO), no del precio del plan; cada cobro de una suscripción cubre un período; y el cambio del MRR de un mes a otro se
// parte en cinco movimientos — nuevo, sube (expansion), baja (contraction), corte (churn) y vuelve (reactivation) — que
// suman exacto: MRR del mes = MRR del anterior + nuevo + vuelve + sube − baja − corte.
//
// POR QUÉ DE LOS PAGOS Y NO DEL LEAD (medido en producción el 5/11/2026, docs/relevo/admin-encargo.md): todo lo que Martín
// cobró hasta hoy entró A MANO (transferencia, Binance) y vive en `pagos` del CRM de la plataforma; `cobros` (la pasarela)
// tiene 2 filas pendientes y el `suscripcion_monto_usd` del lead está vacío en los tres clientes. Así que el monto de cada
// mes es lo que de verdad PAGÓ, y un dato faltante en el lead no deja el MRR en cero.
//
// LAS TRES REGLAS QUE NO SE VEN:
//   · PAGOS QUE SE JUNTAN: dos pagos de la misma suscripción a menos de `VENTANA_JUNTAR_DIAS` días son UN cobro (Código pagó
//     noviembre en dos, 94 el 4/11 y 144 el 5/11: es UNA mensualidad de 238, no dos meses).
//   · CADA COBRO CUBRE UN MES desde su primer pago, y uno nuevo REEMPLAZA al anterior desde su fecha (cambia el monto: sube
//     o baja). No se suman dos períodos que se pisan.
//   · LA GRACIA: quien paga tarde no se corta. Un período vencido sigue contando (atrasado) hasta `GRACIA_DIAS` días; si
//     renueva adentro de la gracia es la misma suscripción, sin corte ni «vuelve». Pasada la gracia sin pagar, el corte se
//     anota el día que venció. ⚠️ Por eso la historia se puede reescribir: un atrasado cuenta en el MRR de su mes hasta que
//     se confirma el corte (igual que ChartMogul, que recalcula desde las facturas).
//
// Un pago SIN su valor en dólares (`usd: null`) no se convierte con una tasa inventada (AGENTS.md): no suma y se cuenta en
// `sinDolares`. Un pago con fecha posterior a hoy no entra (todavía no pasó).
// =============================================================================

import { sumarMeses } from './cobrado-lead';
import type { HistoriaSuscripcion } from './suscripcion-meses';

/** Dos pagos de la misma suscripción a menos de estos días son UN cobro (completar el mes en dos pagos). */
export const VENTANA_JUNTAR_DIAS = 7;
/** Días después del vencimiento en que un período impago todavía cuenta (atrasado), antes de darlo por cortado. */
export const GRACIA_DIAS = 15;
/** Días antes del vencimiento en que una suscripción pasa a «Por vencer». */
export const AVISO_PROXIMO_DIAS = 5;

/** Un pago que ENTRÓ, ya normalizado por el lector. */
export type PagoIngreso = {
  /** Único y estable (`p:<id de pagos>`, `c:<id de cobros>`). */
  id: string;
  /** La clave del cliente que pagó (`ws:<n>` si tiene cuenta, `lead:<id>` si no). */
  cliente: string;
  /** A qué suscripción corresponde (`lead:<id>:<crm>`). `null` = un pago único o suelto: es cash, no MRR. */
  suscripcion: string | null;
  /** YYYY-MM-DD, el día que entró. */
  fecha: string;
  /** En dólares. `null` = sin su valor en dólares: no se suma. */
  usd: number | null;
  /** Cómo entró: «transferencia», «stripe»… `null` = no se sabe. */
  medio: string | null;
  concepto: string | null;
  /**
   * El cobro de la pasarela que lo asentó (`pagos.cobro_id`, o el cobro mismo), si salió por la pasarela. Lo usa Admin › Sales ›
   * Orders para atar el pago a su RECIBO (`recibos.cobro_id`): sin él, el pago y su recibo serían dos renglones del mismo pago.
   */
  cobroId?: number | null;
};

/** Quién es cada cliente, para dibujarlo. */
export type ClienteIngreso = {
  clave: string;
  nombre: string;
  /** Su cuenta de MaKo, si tiene. */
  ws: number | null;
  /** Su ficha en el CRM de la plataforma, si tiene. */
  leadId: number | null;
};

const DIA_MS = 86_400_000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const diaMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** `iso` + `dias` días. */
export const masDias = (iso: string, dias: number): string => new Date(diaMs(iso) + dias * DIA_MS).toISOString().slice(0, 10);
/** Días de `a` a `b` (b − a). */
export const diasEntre = (a: string, b: string): number => Math.round((diaMs(b) - diaMs(a)) / DIA_MS);
const esFecha = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(diaMs(s));
const usdDe = (v: number | null): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ── Los cobros (períodos) ──────────────────────────────────────────────────────────────────────────────────────────

/** Un cobro de una suscripción: uno o varios pagos juntos, que cubren un mes desde `inicio`. */
export type Periodo = {
  suscripcion: string;
  cliente: string;
  inicio: string;
  /** El día que vence (un mes después de `inicio`). */
  fin: string;
  usd: number;
  pagos: string[];
};

/** Los pagos que valen: con fecha válida, de hoy o antes. */
const pagosValidos = (pagos: readonly PagoIngreso[], hoy: string) => pagos.filter((p) => esFecha(p.fecha) && p.fecha <= hoy);

/**
 * Los cobros de cada suscripción: los pagos recurrentes ordenados por fecha, y juntos los que caen a menos de
 * `VENTANA_JUNTAR_DIAS` del primero del grupo.
 */
export function periodosDe(pagos: readonly PagoIngreso[], hoy: string): Periodo[] {
  const porSub = new Map<string, PagoIngreso[]>();
  for (const p of pagosValidos(pagos, hoy)) {
    if (!p.suscripcion) continue;
    const l = porSub.get(p.suscripcion) ?? [];
    l.push(p);
    porSub.set(p.suscripcion, l);
  }
  const out: Periodo[] = [];
  for (const [suscripcion, lista] of porSub) {
    lista.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id.localeCompare(b.id)));
    let actual: Periodo | null = null;
    for (const p of lista) {
      if (actual && diasEntre(actual.inicio, p.fecha) < VENTANA_JUNTAR_DIAS) {
        actual.usd = r2(actual.usd + (usdDe(p.usd) ?? 0));
        actual.pagos.push(p.id);
        continue;
      }
      actual = { suscripcion, cliente: p.cliente, inicio: p.fecha, fin: sumarMeses(p.fecha, 1), usd: r2(usdDe(p.usd) ?? 0), pagos: [p.id] };
      out.push(actual);
    }
  }
  return out;
}

// ── Los tramos: lo que una suscripción estuvo viva sin cortarse ────────────────────────────────────────────────────

/** Un tramo seguido de una suscripción, con los cambios de monto adentro. */
export type Tramo = {
  suscripcion: string;
  cliente: string;
  inicio: string;
  /** El día que se cortó. `null` = sigue viva (incluso atrasada, adentro de la gracia). */
  fin: string | null;
  /** Cuándo vence el último cobro (el próximo pago esperado). */
  vence: string;
  /** El monto desde cada fecha. El primero es el de `inicio`. */
  cambios: Array<{ fecha: string; usd: number }>;
};

export function tramosDe(periodos: readonly Periodo[], hoy: string): Tramo[] {
  const porSub = new Map<string, Periodo[]>();
  for (const p of periodos) {
    const l = porSub.get(p.suscripcion) ?? [];
    l.push(p);
    porSub.set(p.suscripcion, l);
  }
  const out: Tramo[] = [];
  for (const lista of porSub.values()) {
    lista.sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
    let t: Tramo | null = null;
    let ultimo: Periodo | null = null;
    for (const p of lista) {
      if (t && ultimo && p.inicio <= masDias(ultimo.fin, GRACIA_DIAS)) {
        t.cambios.push({ fecha: p.inicio, usd: p.usd });
        t.vence = p.fin;
      } else {
        if (t && ultimo) t.fin = ultimo.fin;
        t = { suscripcion: p.suscripcion, cliente: p.cliente, inicio: p.inicio, fin: null, vence: p.fin, cambios: [{ fecha: p.inicio, usd: p.usd }] };
        out.push(t);
      }
      ultimo = p;
    }
    // El último: cortado si pasó la gracia sin pagar (el corte se anota el día que venció); si no, sigue vivo.
    if (t && ultimo && hoy >= masDias(ultimo.fin, GRACIA_DIAS)) t.fin = ultimo.fin;
  }
  return out;
}

/** El monto de un tramo en `fecha` (0 si no estaba vivo). Intervalo medio abierto: el día del corte ya no cuenta. */
export function montoEn(t: Tramo, fecha: string): number {
  if (fecha < t.inicio) return 0;
  if (t.fin != null && fecha >= t.fin) return 0;
  let usd = 0;
  for (const c of t.cambios) if (c.fecha <= fecha) usd = c.usd;
  return usd;
}

/** El MRR de cada cliente en `fecha`. */
export function mrrPorClienteEn(tramos: readonly Tramo[], fecha: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of tramos) {
    const v = montoEn(t, fecha);
    if (v > 0) out.set(t.cliente, r2((out.get(t.cliente) ?? 0) + v));
  }
  return out;
}

const sumaDe = (m: ReadonlyMap<string, number>) => r2([...m.values()].reduce((a, b) => a + b, 0));

// ── Los movimientos ────────────────────────────────────────────────────────────────────────────────────────────────

export const TIPOS_MOVIMIENTO = ['nuevo', 'vuelve', 'sube', 'baja', 'corte'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

/** Rótulo y tono de cada movimiento, como lo dibuja la pantalla (Baremetrics: verde lo que suma, rojo lo que resta). */
export const ROTULO_MOVIMIENTO: Record<TipoMovimiento, { rotulo: string; tono: 'good' | 'bad' | 'info' }> = {
  nuevo: { rotulo: 'Nuevo', tono: 'good' },
  vuelve: { rotulo: 'Volvió', tono: 'good' },
  sube: { rotulo: 'Subió', tono: 'good' },
  baja: { rotulo: 'Bajó', tono: 'bad' },
  corte: { rotulo: 'Se cortó', tono: 'bad' },
};

export type Movimiento = { fecha: string; cliente: string; tipo: TipoMovimiento; /** Con signo. */ delta: number; antes: number; despues: number };

/**
 * Los movimientos de cada CLIENTE (no de cada suscripción: un lugar más de una agencia que ya pagaba es «sube», no
 * «nuevo»), en cada fecha en que cambió su MRR, comparando con el valor de justo antes.
 */
export function movimientosDe(tramos: readonly Tramo[]): Movimiento[] {
  const porCliente = new Map<string, Tramo[]>();
  for (const t of tramos) {
    const l = porCliente.get(t.cliente) ?? [];
    l.push(t);
    porCliente.set(t.cliente, l);
  }
  const out: Movimiento[] = [];
  for (const [cliente, lista] of porCliente) {
    const fechas = new Set<string>();
    for (const t of lista) {
      fechas.add(t.inicio);
      for (const c of t.cambios) fechas.add(c.fecha);
      if (t.fin) fechas.add(t.fin);
    }
    let antes = 0;
    let tuvo = false;
    for (const f of [...fechas].sort()) {
      const despues = r2(lista.reduce((a, t) => a + montoEn(t, f), 0));
      if (despues === antes) continue;
      const tipo: TipoMovimiento = antes === 0 ? (tuvo ? 'vuelve' : 'nuevo') : despues === 0 ? 'corte' : despues > antes ? 'sube' : 'baja';
      out.push({ fecha: f, cliente, tipo, delta: r2(despues - antes), antes, despues });
      if (despues > 0) tuvo = true;
      antes = despues;
    }
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.cliente.localeCompare(b.cliente)));
}

// ── Los meses ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type MesIngresos = {
  /** YYYY-MM. */
  mes: string;
  /** Lo que ENTRÓ ese mes, recurrente o no (el cash). */
  cobrado: number;
  /** El MRR al cierre del mes (al día de hoy, si es el mes en curso). */
  mrr: number;
  /** Los movimientos del mes, cada uno en positivo (el `corte` y la `baja` restan). */
  nuevo: number; vuelve: number; sube: number; baja: number; corte: number;
  /** Si es el mes en curso (a medias). */
  enCurso: boolean;
};

/** Los últimos `n` meses hasta el de `hoy`, el más viejo primero (YYYY-MM). */
export function ultimosMeses(hoy: string, n: number): string[] {
  const [y, m] = hoy.split('-').map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
  return out;
}

/** El último día del mes `mes` (YYYY-MM). */
const ultimoDia = (mes: string) => {
  const [y, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

export function mesesDe(pagos: readonly PagoIngreso[], tramos: readonly Tramo[], movimientos: readonly Movimiento[], hoy: string, n = 12): MesIngresos[] {
  const meses = ultimosMeses(hoy, n);
  const fila = new Map<string, MesIngresos>(meses.map((mes) => [mes, { mes, cobrado: 0, mrr: 0, nuevo: 0, vuelve: 0, sube: 0, baja: 0, corte: 0, enCurso: mes === hoy.slice(0, 7) }]));
  for (const p of pagosValidos(pagos, hoy)) {
    const f = fila.get(p.fecha.slice(0, 7));
    const v = usdDe(p.usd);
    if (f && v != null) f.cobrado = r2(f.cobrado + v);
  }
  for (const mv of movimientos) {
    const f = fila.get(mv.fecha.slice(0, 7));
    if (f) f[mv.tipo] = r2(f[mv.tipo] + Math.abs(mv.delta));
  }
  for (const f of fila.values()) f.mrr = sumaDe(mrrPorClienteEn(tramos, f.enCurso ? hoy : ultimoDia(f.mes)));
  return meses.map((m) => fila.get(m)!);
}

// ── Cada cliente ───────────────────────────────────────────────────────────────────────────────────────────────────

export const ESTADOS_CLIENTE = ['atrasado', 'por-vencer', 'al-dia', 'cortado', 'pago-unico'] as const;
export type EstadoClienteIngreso = (typeof ESTADOS_CLIENTE)[number];

export const ROTULO_ESTADO_CLIENTE: Record<EstadoClienteIngreso, { rotulo: string; tono: 'bad' | 'warn' | 'good' | 'neutral' | 'info' }> = {
  atrasado: { rotulo: 'Atrasado', tono: 'bad' },
  'por-vencer': { rotulo: 'Por vencer', tono: 'warn' },
  'al-dia': { rotulo: 'Al día', tono: 'good' },
  cortado: { rotulo: 'Se cortó', tono: 'neutral' },
  'pago-unico': { rotulo: 'Pago único', tono: 'info' },
};

export type ClienteResumen = ClienteIngreso & {
  /** Lo que pagó en total, desde siempre (en dólares). */
  total: number;
  /** Pagos sin su valor en dólares (no se suman). */
  sinDolares: number;
  pagos: number;
  primerPago: string | null;
  ultimoPago: string | null;
  /** Lo que paga por mes hoy. */
  mrr: number;
  estado: EstadoClienteIngreso;
  /** El próximo pago esperado (el vencimiento más cercano de sus suscripciones vivas). */
  proximo: string | null;
  /** Días de atraso (si `estado` es atrasado). */
  diasAtraso: number | null;
};

export function clientesDe(pagos: readonly PagoIngreso[], tramos: readonly Tramo[], quien: ReadonlyMap<string, ClienteIngreso>, hoy: string): ClienteResumen[] {
  const out = new Map<string, ClienteResumen>();
  const base = (clave: string): ClienteResumen => {
    const q = quien.get(clave);
    return {
      clave, nombre: q?.nombre ?? clave, ws: q?.ws ?? null, leadId: q?.leadId ?? null,
      total: 0, sinDolares: 0, pagos: 0, primerPago: null, ultimoPago: null, mrr: 0, estado: 'pago-unico', proximo: null, diasAtraso: null,
    };
  };
  for (const p of pagosValidos(pagos, hoy)) {
    const c = out.get(p.cliente) ?? base(p.cliente);
    const v = usdDe(p.usd);
    if (v == null) c.sinDolares += 1; else c.total = r2(c.total + v);
    c.pagos += 1;
    if (!c.primerPago || p.fecha < c.primerPago) c.primerPago = p.fecha;
    if (!c.ultimoPago || p.fecha > c.ultimoPago) c.ultimoPago = p.fecha;
    out.set(p.cliente, c);
  }
  const hoyMrr = mrrPorClienteEn(tramos, hoy);
  for (const c of out.values()) {
    const suyos = tramos.filter((t) => t.cliente === c.clave);
    c.mrr = hoyMrr.get(c.clave) ?? 0;
    const vivos = suyos.filter((t) => t.fin == null);
    if (vivos.length) {
      const vence = vivos.map((t) => t.vence).sort()[0];
      c.proximo = vence;
      const dias = diasEntre(hoy, vence);
      if (dias <= 0) { c.estado = 'atrasado'; c.diasAtraso = -dias; }
      else c.estado = dias <= AVISO_PROXIMO_DIAS ? 'por-vencer' : 'al-dia';
    } else if (suyos.length) c.estado = 'cortado';
  }
  const peso = (e: EstadoClienteIngreso) => ESTADOS_CLIENTE.indexOf(e);
  return [...out.values()].sort((a, b) => b.mrr - a.mrr || peso(a.estado) - peso(b.estado) || b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'));
}

// ── Lo que viene ───────────────────────────────────────────────────────────────────────────────────────────────────

export type PorCobrar = { cliente: string; fecha: string; usd: number; atrasado: boolean };

/**
 * Lo que la SUSCRIPCIÓN MES A MES (lib/suscripcion-meses.ts, la misma cuenta que la ficha del lead y la tab Pagos) dice de lo
 * que viene. `sinCobro`: cortada con un corte guardado, o terminado su plazo: no se espera nada más.
 */
export type ProximoDeSuscripcion = {
  sinCobro: boolean;
  /** Lo que ya venció (hoy incluido) y no está completo: desde el mes más viejo, por lo que falta de todos. */
  atrasado: { fecha: string; usd: number } | null;
  /** El próximo vencimiento de mañana en adelante, por lo que falta de ESE mes (su mensualidad, si no tiene nada pagado). */
  siguiente: { fecha: string; usd: number } | null;
};

/**
 * ⚠️ EL PRÓXIMO COBRO DE UNA SUSCRIPCIÓN SALE DE SU HISTORIA, NO DEL ÚLTIMO PAGO MÁS UN MES (6/11/2026, Admin › Sales). Con la
 * regla de los tramos, una suscripción que vence el día 5 y cuyo último mes se pagó el 4 decía «vence el 4», y con el monto de
 * ese último pago; cuando la mensualidad cambia de un mes a otro (un cambio guardado, mig 0401), el monto también mentía. Acá:
 * la fecha es `proximaFecha` (el vencimiento de su mes, con su día de cobro) y el monto lo que falta de ese mes, que sale de
 * `montoDelMes` (con los cambios guardados); sin monto conocido, la mensualidad de hoy (`montoHoyUsd`).
 */
export function proximoDeHistoria(h: Pick<HistoriaSuscripcion, 'cortadaDesde' | 'terminada' | 'montoHoyUsd' | 'proximo' | 'proximaFecha' | 'deudaUsd' | 'meses'>, hoy: string): ProximoDeSuscripcion {
  if (h.cortadaDesde || h.terminada) return { sinCobro: true, atrasado: null, siguiente: null };
  const mensual = h.montoHoyUsd ?? 0;
  const atrasado = h.proximo && h.proximo.vence <= hoy
    ? { fecha: h.proximo.vence, usd: r2(h.deudaUsd > 0 ? h.deudaUsd : h.proximo.faltaUsd ?? mensual) }
    : null;
  let siguiente: ProximoDeSuscripcion['siguiente'] = null;
  // `proximaFecha` es «de hoy en adelante»: el que vence HOY ya está en lo atrasado (como `atrasado: vence <= hoy` de siempre).
  if (h.proximaFecha && h.proximaFecha > hoy) {
    const mes = h.meses.find((m) => m.vence === h.proximaFecha && m.estado !== 'pagado' && m.estado !== 'cortado');
    siguiente = { fecha: h.proximaFecha, usd: r2(mes ? mes.faltaUsd ?? mes.esperadoUsd ?? mensual : mensual) };
  }
  return { sinCobro: false, atrasado, siguiente };
}

/**
 * Lo que se espera cobrar: cada suscripción viva con su vencimiento (atrasada o en los próximos `dias`), lo más cercano primero.
 * `proximos` (por clave de suscripción, `lead:<id>:<crm>`): las que tienen su historia mes a mes la usan (fecha y monto); las
 * demás —la pasarela, o sin historia— siguen con la regla de los tramos (el último cobro más un mes). Viva o cortada lo siguen
 * diciendo los tramos, como el MRR: la historia sólo pone CUÁNDO y CUÁNTO.
 */
export function porCobrarDe(tramos: readonly Tramo[], hoy: string, dias = 31, proximos?: ReadonlyMap<string, ProximoDeSuscripcion>): PorCobrar[] {
  const hasta = masDias(hoy, dias);
  const out: PorCobrar[] = [];
  // Dos claves de la misma suscripción (pagos con y sin su CRM) apuntan a la MISMA historia: se cuenta una vez.
  const usadas = new Set<ProximoDeSuscripcion>();
  for (const t of tramos) {
    if (t.fin != null) continue;
    const p = proximos?.get(t.suscripcion);
    if (p) {
      if (usadas.has(p)) continue;
      usadas.add(p);
      if (p.sinCobro) continue;
      if (p.atrasado) out.push({ cliente: t.cliente, fecha: p.atrasado.fecha, usd: p.atrasado.usd, atrasado: true });
      if (p.siguiente && p.siguiente.fecha <= hasta) out.push({ cliente: t.cliente, fecha: p.siguiente.fecha, usd: p.siguiente.usd, atrasado: false });
      continue;
    }
    if (t.vence > hasta) continue;
    const usd = t.cambios[t.cambios.length - 1]?.usd ?? 0;
    out.push({ cliente: t.cliente, fecha: t.vence, usd, atrasado: t.vence <= hoy });
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.cliente.localeCompare(b.cliente)));
}

// ── Todo junto ─────────────────────────────────────────────────────────────────────────────────────────────────────

export type Ingresos = {
  hoy: string;
  /** Lo que pagan por mes hoy, sumado. */
  mrr: number;
  /** El MRR al cierre del mes pasado (para el «desde»). */
  mrrMesPasado: number;
  /** Lo que entró desde siempre. */
  cobradoTotal: number;
  cobradoEsteMes: number;
  cobradoMesPasado: number;
  /** Clientes con MRR hoy. */
  pagando: number;
  /** El promedio por cliente que paga (MRR / pagando). `null` sin clientes. */
  arpu: number | null;
  /** Pagos sin su valor en dólares (no suman en nada). */
  sinDolares: number;
  meses: MesIngresos[];
  movimientos: Movimiento[];
  clientes: ClienteResumen[];
  porCobrar: PorCobrar[];
  /** Los últimos pagos que entraron, el más nuevo primero (como «Payments» de Stripe). */
  pagos: PagoReciente[];
  /** Todo lo que entró, un renglón por pago (Admin › Billing reparte y dibuja desde acá). */
  entradas: Entrada[];
};

/**
 * Un pago que entró, sin más que lo que hace falta para repartirlo: cuándo, cuánto en dólares, por dónde y de quién.
 * `id` y `cliente` (la clave de `PagoIngreso`) los suma Admin › Analytics › Events, que muestra cada pago como un evento con el
 * link a su negocio (`ws:<n>`): por el nombre solo no se puede, dos clientes pueden llamarse igual. Opcionales para quien arma
 * una `Entrada` a mano (los ejemplos de las pantallas); `entradasDe` los pone siempre. `concepto` y `cobroId` los suma Admin ›
 * Sales › Orders (el renglón del pago y su recibo).
 */
export type Entrada = { fecha: string; usd: number | null; medio: string | null; recurrente: boolean; nombre: string; id?: string; cliente?: string; concepto?: string | null; cobroId?: number | null };

/** Los pagos válidos (con fecha y hasta hoy), el más viejo primero. `usd` null = sin su valor en dólares: no suma. */
export function entradasDe(pagos: readonly PagoIngreso[], quien: ReadonlyMap<string, ClienteIngreso>, hoy: string): Entrada[] {
  return pagosValidos(pagos, hoy)
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id.localeCompare(b.id)))
    .map((p) => ({ fecha: p.fecha, usd: usdDe(p.usd), medio: p.medio, recurrente: p.suscripcion != null, nombre: quien.get(p.cliente)?.nombre ?? p.cliente, id: p.id, cliente: p.cliente, concepto: p.concepto, cobroId: p.cobroId ?? null }));
}

export type PagoReciente = PagoIngreso & { nombre: string; recurrente: boolean };

/** Los últimos `n` pagos válidos, el más nuevo primero, con el nombre del cliente. */
export function pagosRecientes(pagos: readonly PagoIngreso[], quien: ReadonlyMap<string, ClienteIngreso>, hoy: string, n = 25): PagoReciente[] {
  return pagosValidos(pagos, hoy)
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id.localeCompare(a.id)))
    .slice(0, n)
    .map((p) => ({ ...p, nombre: quien.get(p.cliente)?.nombre ?? p.cliente, recurrente: p.suscripcion != null }));
}

/**
 * `proximos`: lo que la historia mes a mes de cada suscripción dice de su próximo cobro (`proximoDeHistoria`), por la clave de
 * la suscripción. Lo arma el lector (lib/admin-ingresos.ts); sin él, lo que viene sale de los tramos.
 */
export function calcularIngresos(pagos: readonly PagoIngreso[], quien: ReadonlyMap<string, ClienteIngreso>, hoy: string, n = 12, proximos?: ReadonlyMap<string, ProximoDeSuscripcion>): Ingresos {
  const periodos = periodosDe(pagos, hoy);
  const tramos = tramosDe(periodos, hoy);
  const movimientos = movimientosDe(tramos);
  const meses = mesesDe(pagos, tramos, movimientos, hoy, n);
  const clientes = clientesDe(pagos, tramos, quien, hoy);
  const mrrHoy = mrrPorClienteEn(tramos, hoy);
  const mrr = sumaDe(mrrHoy);
  const pagando = mrrHoy.size;
  const esteMes = meses[meses.length - 1];
  const mesPasado = meses[meses.length - 2];
  const validos = pagosValidos(pagos, hoy);
  return {
    hoy,
    mrr,
    mrrMesPasado: mesPasado?.mrr ?? 0,
    cobradoTotal: r2(validos.reduce((a, p) => a + (usdDe(p.usd) ?? 0), 0)),
    cobradoEsteMes: esteMes?.cobrado ?? 0,
    cobradoMesPasado: mesPasado?.cobrado ?? 0,
    pagando,
    arpu: pagando ? r2(mrr / pagando) : null,
    sinDolares: validos.filter((p) => usdDe(p.usd) == null).length,
    meses,
    movimientos,
    clientes,
    porCobrar: porCobrarDe(tramos, hoy, 31, proximos),
    pagos: pagosRecientes(pagos, quien, hoy),
    entradas: entradasDe(pagos, quien, hoy),
  };
}

// ── Cómo se dice ───────────────────────────────────────────────────────────────────────────────────────────────────

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
/** «nov 2026» (o «nov» si es del año de `hoy`). */
export function mesTxt(mes: string, hoy?: string): string {
  const [y, m] = mes.split('-').map(Number);
  const corto = MES_CORTO[m - 1] ?? mes;
  return hoy && hoy.slice(0, 4) === String(y) ? corto : `${corto} ${y}`;
}
/** «5 nov» (o «5 nov 2025» si no es del año de `hoy`). */
export function diaTxt(iso: string, hoy?: string): string {
  if (!esFecha(iso)) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MES_CORTO[m - 1]}${hoy && hoy.slice(0, 4) === String(y) ? '' : ` ${y}`}`;
}
/** «US$ 1.234» (sin decimales si es entero). */
export const usd = (n: number): string => `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
/** «+US$ 92» / «−US$ 97». */
export const usdConSigno = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${usd(Math.abs(n))}`;

/** Cómo se lee el medio de un pago («transferencia» → «Transferencia», «mercadopago» → «Mercado Pago»). */
export function medioTxt(medio: string | null): string {
  if (!medio) return '—';
  const m = medio.trim().toLowerCase();
  const conocidos: Record<string, string> = {
    transferencia: 'Transferencia', efectivo: 'Efectivo', tarjeta: 'Tarjeta', deposito: 'Depósito', cheque: 'Cheque', otro: 'Otro',
    binance: 'Binance', stripe: 'Stripe', mercadopago: 'Mercado Pago', creem: 'Creem', paypal: 'PayPal',
  };
  return conocidos[m] ?? medio.charAt(0).toUpperCase() + medio.slice(1);
}
