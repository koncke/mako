// =============================================================================
// binance-sin-captura-reglas — el pago de una agencia que entró por Binance Pay SIN que mande la captura al grupo (20/11/2026)
// =============================================================================
// Martín (20/11/2026): «si ya pagan por Binance debería ser todo automático si ya tienes la API de Binance para ver cuándo entran
// pagos». Hasta hoy la activación sola arrancaba SÓLO con la captura en el grupo (lib/agencia-mes-comprobante.ts): si la agencia pagaba
// y no la mandaba, nadie miraba la cuenta. Esta vuelta (la corre el cron de cobros cada media hora, lib/binance-sin-captura.ts) lee los
// pagos RECIBIDOS de las últimas horas y los calza contra lo que debe cada agencia con la mensualidad prendida.
//
// EL CALCE, las cuatro cosas a la vez (la regla de la memoria «verificar-pagos-contra-la-cuenta»):
//   · QUIÉN PAGA: el Binance ID (o, si Binance no lo da, el nombre) de alguien que YA le pagó a MaKo por esa agencia. Se aprende de las
//     órdenes del libro de la agencia (las que entraron con captura o con el «aprobado» de Martín) y se guarda. Un pago de alguien que
//     no se conoce NO es de nadie: no se toca (puede ser cualquier otro cobro por Binance; la captura, si llega, lo resuelve).
//   · MONTO EXACTO: `asignarPago` tiene que dar «cubre» (exacto con lo que se debe, o con una sola combinación). Parcial, de más,
//     nada pendiente o dos combinaciones posibles → a Martín.
//   · VENTANA: entró en las últimas `VENTANA_HORAS`, y hace más de `GRACIA_MIN` (la captura puede venir en camino: si llega, la resuelve
//     ese camino, con su texto).
//   · NO USADO: el mismo registro de «usado» que el camino con captura (los libros de todas las agencias y los recibos, con los números
//     mal copiados adentro: `numerosUsados`). Y la orden se anota con compare-and-set (`aplicarPagoDeAgencia`): dos corridas a la vez
//     aplican UNA.
// Dos candidatos (el que pagó le pagó antes por dos agencias, o dos pagos de la misma agencia para lo mismo) → a Martín, una sola vez
// por orden. El pago del que habla un comprobante del grupo SIN CERRAR (leído y no aplicado: el mismo número, con un dígito de diferencia,
// o el mismo monto) no se toca: lo resuelve ese camino (la espera, o Martín con la pendiente).
// ⚠️ «Sin cerrar» NO bloquea a la agencia entera (medido el 20/11 en Código): los comprobantes que Martín cerró a mano quedan con
// `aplicado_a` vacío para siempre, y uno de hoy (US$ 23,5, sin número) la habría frenado 72 h por cualquier pago.
//
// Puro (sin base ni red): la vuelta recibe sus lecturas y escrituras de afuera (`DepsSinCaptura`). Lo prueba
// tests/binance-sin-captura.test.ts con un mundo de mentira que corre la vuelta dos veces.
// =============================================================================

import { difiereEnUnDigito, esDolarBinance, mismoMonto, numerosUsados, type MovimientoBinance } from './binance-pay-reglas';
import { asignarPago, usd, type Pendiente } from './agencia-mes-reglas';

/** Cuánto para atrás se miran los pagos que entraron (el cron corre cada media hora: con 48 h, un cron caído un día no pierde nada). */
export const VENTANA_HORAS = 48;
/** Un pago más nuevo que esto todavía no se toca: la captura puede estar en camino (y con ella, su texto en el grupo). */
export const GRACIA_MIN = 15;
/** Cuánto se lee de la cuenta para saber quién le pagó antes a MaKo por cada agencia (Binance guarda 90 días). */
export const DIAS_DE_HISTORIA = 89;

/** Quién paga por una agencia: lo que se aprendió (y se guarda en `binance.pagadores.<agencia>`). */
export type Pagadores = { ids: string[]; nombres: string[] };
export const SIN_PAGADORES: Pagadores = { ids: [], nombres: [] };

/** Un nombre de Binance comparable: sin tildes, en minúscula, un espacio. Menos de 3 letras no identifica a nadie. */
export function nombreComparable(s: string | null | undefined): string | null {
  const n = String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  return n.length >= 3 ? n : null;
}

export function leerPagadores(v: string | null | undefined): Pagadores {
  try {
    const o = JSON.parse(v ?? '') as Record<string, unknown>;
    const lista = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim()) : []);
    return { ids: lista(o.ids), nombres: lista(o.nombres) };
  } catch { return { ids: [], nombres: [] }; }
}

/** Lo que la vuelta necesita saber de cada agencia con la mensualidad prendida. */
export type AgenciaVista = {
  agenciaWs: number;
  nombre: string;
  pendientes: readonly Pendiente[];
  /** Las órdenes de SU libro (`agencia.mensualidad.<ws>.orden.<N>`). */
  ordenes: readonly string[];
  /** Lo guardado de quién paga por ella. */
  guardados: Pagadores;
  /**
   * Los comprobantes que mandó al grupo y no se cerraron (leídos, sin aplicar, ni repetidos), de los últimos días: el pago del que habla
   * cada uno lo resuelve ese camino. null = no se pudo leer: entonces ningún pago de la agencia se toca.
   */
  comprobantesSinCerrar: ReadonlyArray<{ operacion: string | null; monto: number | null }> | null;
};

/**
 * ¿Es éste el pago del que habla un comprobante del grupo sin cerrar? El mismo número (o con un dígito de diferencia), o el mismo monto. Un
 * comprobante cuyo número YA está usado (`usadas`) está cerrado aunque diga lo contrario: Martín lo marcó a mano y `aplicado_a` quedó vacío.
 */
export function loTieneUnaCaptura(m: MovimientoBinance, cs: AgenciaVista['comprobantesSinCerrar'], usadas: ReadonlySet<string> = new Set()): boolean {
  if (cs == null) return true;
  const cerrado = (op: string) => usadas.has(op) || [...usadas].some((u) => difiereEnUnDigito(op, u));
  return cs.some((c) => {
    const op = c.operacion?.trim().toUpperCase() || null;
    if (op && cerrado(op)) return false;
    return (op ? difiereEnUnDigito(op, m.orderId) : false) || (c.monto != null && mismoMonto(c.monto, m.monto));
  });
}

/** Lo que pasa con cada pago de la ventana (también es el informe en seco). */
export type Estado =
  | 'aplicar'
  | 'a-martin'
  /** Ya se le avisó a Martín de esta orden: no se repite. */
  | 'ya-avisado'
  /** Usado: ya está en un libro o un recibo (lo aplicó la captura, el «aprobado» o una corrida anterior). */
  | 'usado'
  /** De alguien que no le pagó antes a MaKo por ninguna agencia: no se toca. */
  | 'ajeno'
  /** Todavía no: entró hace menos de `GRACIA_MIN`, o la agencia tiene un comprobante del grupo sin cerrar. */
  | 'espera';

export type Fila = {
  mov: MovimientoBinance;
  estado: Estado;
  /** La agencia (si se sabe de quién es); para «usado», la del libro donde está anotada. */
  agenciaWs: number | null;
  porque: string;
  /** Para «aplicar»: a qué va. */
  claves?: string[];
};

export type Decision = {
  filas: Fila[];
  /** Lo aprendido de quién paga por cada agencia; `cambio`: hay algo nuevo que guardar. */
  aprendidos: Array<{ agenciaWs: number; pagadores: Pagadores; cambio: boolean }>;
};

/** El porqué de una asignación que no es «cubre», en una frase para Martín. */
export function porqueNoCierra(monto: number, ps: readonly Pendiente[]): string {
  const a = asignarPago(monto, ps);
  const total = Math.round(ps.reduce((s, p) => s + p.debeUsd, 0) * 100) / 100;
  if (a.tipo === 'nada-pendiente') return 'no debía nada';
  if (a.tipo === 'de-mas') return `es más de lo que debía (${usd(a.debeUsd)})`;
  if (a.tipo === 'ambiguo') return `calza exacto con más de una cosa (${a.opciones.map((o) => o.join(' + ')).join(' o ')})`;
  if (a.tipo === 'parcial') return `${usd(monto)} no cierra con lo que debe (${usd(total)}): sin la captura no se aplica a cuenta`;
  return '';
}

/**
 * DECIDE qué hacer con cada pago que entró a la cuenta en la ventana. `anotadas`: los números de todos los libros y recibos (el registro
 * de «usado»); `avisados`: las órdenes de las que ya se le avisó a Martín. Puro.
 */
export function decidirSinCaptura(p: {
  movs: readonly MovimientoBinance[];
  anotadas: Iterable<string>;
  agencias: readonly AgenciaVista[];
  ahora: number;
  avisados: ReadonlySet<string>;
  /** Desde cuándo se miran los pagos (ms). Por defecto, `VENTANA_HORAS` para atrás. */
  desde?: number;
}): Decision {
  const todas = [...p.anotadas, ...p.agencias.flatMap((a) => a.ordenes)];
  const usadas = numerosUsados(todas, p.movs);

  // QUIÉN PAGA POR CADA AGENCIA: lo guardado + lo que muestran sus órdenes en la cuenta.
  const quien = new Map<number, { ids: Set<string>; nombres: Set<string> }>();
  const aprendidos: Decision['aprendidos'] = [];
  const duenoDeLaOrden = new Map<string, number>();
  for (const a of p.agencias) {
    const propias = numerosUsados(a.ordenes, p.movs);
    for (const o of propias) duenoDeLaOrden.set(o, a.agenciaWs);
    const ids = new Set(a.guardados.ids);
    const nombres = new Set(a.guardados.nombres.map(nombreComparable).filter((s): s is string => !!s));
    for (const m of p.movs) {
      if (!propias.has(m.orderId)) continue;
      if (m.pagadorId) ids.add(m.pagadorId);
      const n = nombreComparable(m.pagadorNombre);
      if (n) nombres.add(n);
    }
    quien.set(a.agenciaWs, { ids, nombres });
    const cambio = [...ids].some((x) => !a.guardados.ids.includes(x)) || [...nombres].some((x) => !a.guardados.nombres.map(nombreComparable).includes(x));
    aprendidos.push({ agenciaWs: a.agenciaWs, pagadores: { ids: [...ids].sort(), nombres: [...nombres].sort() }, cambio });
  }
  /** Las agencias de quien pagó: por el Binance ID si alguna lo conoce; si no, por el nombre. */
  const duenos = (m: MovimientoBinance): AgenciaVista[] => {
    const porId = m.pagadorId ? p.agencias.filter((a) => quien.get(a.agenciaWs)!.ids.has(m.pagadorId!)) : [];
    if (porId.length) return porId;
    const n = nombreComparable(m.pagadorNombre);
    return n ? p.agencias.filter((a) => quien.get(a.agenciaWs)!.nombres.has(n)) : [];
  };

  const desde = p.desde ?? p.ahora - VENTANA_HORAS * 3_600_000;
  const gracia = p.ahora - GRACIA_MIN * 60_000;
  const filas: Fila[] = [];
  for (const m of [...p.movs].sort((a, b) => a.at - b.at)) {
    if (m.at < desde || m.at > p.ahora) continue;
    if (usadas.has(m.orderId)) { filas.push({ mov: m, estado: 'usado', agenciaWs: duenoDeLaOrden.get(m.orderId) ?? null, porque: 'ya está anotada' }); continue; }
    const ds = duenos(m);
    if (!ds.length) { filas.push({ mov: m, estado: 'ajeno', agenciaWs: null, porque: 'quien pagó no le pagó antes a MaKo por ninguna agencia' }); continue; }
    if (ds.length > 1) {
      filas.push({ mov: m, estado: 'a-martin', agenciaWs: null, porque: `quien pagó ya le pagó a MaKo por más de una agencia (${ds.map((a) => a.nombre).join(' y ')}): no sé de cuál es` });
      continue;
    }
    const a = ds[0];
    if (m.at > gracia) { filas.push({ mov: m, estado: 'espera', agenciaWs: a.agenciaWs, porque: `entró hace menos de ${GRACIA_MIN} min: la captura puede venir en camino` }); continue; }
    if (loTieneUnaCaptura(m, a.comprobantesSinCerrar, usadas)) {
      filas.push({ mov: m, estado: 'espera', agenciaWs: a.agenciaWs, porque: a.comprobantesSinCerrar == null ? 'no pude leer los comprobantes del grupo' : 'hay un comprobante del grupo sin cerrar de este pago: lo resuelve ese camino' });
      continue;
    }
    if (!esDolarBinance(m.moneda)) { filas.push({ mov: m, estado: 'a-martin', agenciaWs: a.agenciaWs, porque: `entró en ${m.moneda}, no en dólares` }); continue; }
    const asig = asignarPago(m.monto, a.pendientes);
    if (asig.tipo !== 'cubre') { filas.push({ mov: m, estado: 'a-martin', agenciaWs: a.agenciaWs, porque: porqueNoCierra(m.monto, a.pendientes) }); continue; }
    filas.push({ mov: m, estado: 'aplicar', agenciaWs: a.agenciaWs, porque: `cubre exacto: ${asig.claves.join(', ')}`, claves: asig.claves });
  }

  // DOS PAGOS DE LA MISMA AGENCIA PARA LO MISMO (dos de US$97 con un solo mes de 97): ninguno se aplica solo.
  // Primero se miran TODOS los choques y después se marcan (marcando sobre la marcha, el segundo ya no veía a qué iba el primero).
  const aplicar = filas.filter((f) => f.estado === 'aplicar');
  const chocan = aplicar.filter((f) => aplicar.some((g) => g !== f && g.agenciaWs === f.agenciaWs && g.claves!.some((c) => f.claves!.includes(c))));
  for (const f of chocan) { f.estado = 'a-martin'; f.porque = `hay más de un pago de la agencia que cubre lo mismo (${f.claves!.join(', ')}): no sé cuál es`; delete f.claves; }
  for (const f of filas) if (f.estado === 'a-martin' && p.avisados.has(f.mov.orderId)) f.estado = 'ya-avisado';
  return { filas, aprendidos };
}

// ── La vuelta ────────────────────────────────────────────────────────────────────────────────────────────────────

export type LecturaDeLaCuenta = { ok: true; movs: MovimientoBinance[] } | { ok: false; error: string; sinClave?: boolean };

/** Lo que la vuelta lee y escribe afuera (en el servidor, lib/binance-sin-captura.ts; en el test, un mundo de mentira). */
export type DepsSinCaptura = {
  leerCuenta(desde: number, hasta: number): Promise<LecturaDeLaCuenta>;
  /** Los números de todos los libros y recibos; null = no se pudo leer (entonces no se aplica nada). */
  ordenesAnotadas(): Promise<Set<string> | null>;
  agencias(ahora: number): Promise<{ vistas: AgenciaVista[]; errores: number }>;
  avisados(): Promise<Set<string>>;
  guardarPagadores(agenciaWs: number, p: Pagadores): Promise<void>;
  /** Aplica el pago (relee lo que se debe AHORA y anota la orden con compare-and-set). */
  aplicar(a: { agenciaWs: number; mov: MovimientoBinance }): Promise<{ tipo: 'aplicado' | 'repetido' | 'nada'; que: string } | { tipo: 'revisar'; porque: string }>;
  /** Anota que de esta orden ya se le avisó a Martín. true = es el primero (y entonces se avisa); false = otro ya lo hizo. */
  marcarAvisado(orderId: string, porque: string): Promise<boolean>;
  avisarAMartin(a: { agenciaWs: number | null; mov: MovimientoBinance; porque: string }): Promise<void>;
};

export type ResumenSinCaptura = {
  enVentana: number; usados: number; ajenos: number; esperando: number; aplicadas: number; aMartin: number; yaAvisados: number; errores: number;
  aprendidos: number; filas: Fila[]; error?: string;
};

/**
 * LA VUELTA: lee la cuenta, decide y, si no es en seco, aprende quién paga, aplica lo que calza y le avisa a Martín lo demás (una vez
 * por orden). En seco no escribe NADA: sólo devuelve las filas. Nunca tira.
 */
export async function vueltaSinCaptura(d: DepsSinCaptura, o: { ahora?: number; enSeco?: boolean; desde?: number } = {}): Promise<ResumenSinCaptura> {
  const ahora = o.ahora ?? Date.now();
  const out: ResumenSinCaptura = { enVentana: 0, usados: 0, ajenos: 0, esperando: 0, aplicadas: 0, aMartin: 0, yaAvisados: 0, errores: 0, aprendidos: 0, filas: [] };
  try {
    const lec = await d.leerCuenta(ahora - DIAS_DE_HISTORIA * 86_400_000, ahora);
    if (!lec.ok) return { ...out, errores: 1, error: lec.error };
    const anotadas = await d.ordenesAnotadas();
    if (anotadas == null) return { ...out, errores: 1, error: 'no pude leer las órdenes ya anotadas' };
    const { vistas, errores } = await d.agencias(ahora);
    out.errores += errores;
    const avisados = await d.avisados();
    const dec = decidirSinCaptura({ movs: lec.movs, anotadas, agencias: vistas, ahora, avisados, desde: o.desde });
    out.filas = dec.filas;
    out.enVentana = dec.filas.length;
    for (const f of dec.filas) {
      if (f.estado === 'usado') out.usados++;
      else if (f.estado === 'ajeno') out.ajenos++;
      else if (f.estado === 'espera') out.esperando++;
      else if (f.estado === 'ya-avisado') out.yaAvisados++;
    }
    out.aprendidos = dec.aprendidos.filter((x) => x.cambio).length;
    if (o.enSeco) {
      out.aplicadas = dec.filas.filter((f) => f.estado === 'aplicar').length;
      out.aMartin = dec.filas.filter((f) => f.estado === 'a-martin').length;
      return out;
    }
    for (const x of dec.aprendidos) {
      if (!x.cambio) continue;
      await d.guardarPagadores(x.agenciaWs, x.pagadores).catch(() => { out.errores++; });
    }
    const aMartin = async (f: Fila, porque: string) => {
      if (!(await d.marcarAvisado(f.mov.orderId, porque).catch(() => false))) { out.yaAvisados++; return; }
      await d.avisarAMartin({ agenciaWs: f.agenciaWs, mov: f.mov, porque });
      out.aMartin++;
    };
    for (const f of dec.filas) {
      try {
        if (f.estado === 'aplicar') {
          const r = await d.aplicar({ agenciaWs: f.agenciaWs!, mov: f.mov });
          if (r.tipo === 'aplicado') out.aplicadas++;
          else if (r.tipo === 'revisar') await aMartin(f, r.porque);
        } else if (f.estado === 'a-martin') await aMartin(f, f.porque);
      } catch {
        out.errores++;
      }
    }
    return out;
  } catch (e) {
    return { ...out, errores: out.errores + 1, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Una línea por pago, para el informe en seco y los logs. */
export const lineaDeFila = (f: Fila): string =>
  `${new Date(f.mov.at).toISOString().slice(0, 16)} · ${f.mov.orderId} · ${f.mov.monto} ${f.mov.moneda} · ${f.mov.pagadorNombre ?? 'sin nombre'} (${f.mov.pagadorId ?? 'sin id'}) → ${f.estado}${f.agenciaWs ? ` [ws ${f.agenciaWs}]` : ''}: ${f.porque}`;

