// =============================================================================
// datos-comercial — lo PURO de los bloques de Comercial: los payloads y las cuentas
// =============================================================================
// Martín, 11/10/2026 (punto 5): «En Comercial está diferente la parte de "A quién cobrarle", antes
// era un desplegable... Estoy seguro de que había otro dato de lo cobrado total... Y con las opciones
// de "Marcar como cobrada"». Los seis bloques vuelven a ser los de la tab vieja (app/comercial/page.tsx
// hasta 7527b8c2) con sus mismas lecturas; este archivo tiene lo que comparten el server que los LEE
// (lib/graficos-bloques.ts) y la pantalla que los DIBUJA (./CuerpoBloque.tsx).
//
// ⚠️ SIN `server-only` a propósito: lo importan el server, la pantalla y el test
//    (tests/graficos-bloques.test.ts). Los tipos de lib/pagos y lib/queries entran con `import type`,
//    que se borra al compilar: ningún valor de un módulo del server cruza al navegador.
//
// Las CUENTAS de cada número (Sold, Cash, Outstanding, madurez, tramos) NO viven acá: siguen en
// lib/queries.ts y lib/pagos.ts, que son las mismas que leen los runners de MaKo. Acá sólo se ARMA lo
// que ya se leyó: el orden de «A quién cobrarle», la ventana del Outstanding, qué cohortes entran en el
// período y qué leads cuelgan de cada una.

import type { OutstandingLead, RevItem } from '@/lib/pagos';
import type {
  CACAcumulado, CohorteMes, CohorteSemana, FunnelLeadItem, FunnelMadurasLeads, MrrResumen,
  ResumenComercialMaduras, SCL, SCLLeadItem, TramosSCL,
} from '@/lib/queries';
import { finDeMesDeFecha, fmtDDMMYYYY, lunesDeFecha } from '@/lib/date-utils';
import { rangoDe } from '@/lib/graficos-catalogo';

// ── Cuáles son los de Comercial ──────────────────────────────────────────────────────────────

/** Los seis bloques de la tab vieja de Comercial. El resto (los de Analysts) los hace lib/graficos-bloques-extra.ts. */
export const BLOQUES_COMERCIAL = ['revenue', 'cobranza', 'funnel_maduro', 'scl', 'cohortes_mes', 'cohortes_semana'] as const;
export type BloqueComercial = (typeof BLOQUES_COMERCIAL)[number];
export const esBloqueComercial = (id: string): id is BloqueComercial => (BLOQUES_COMERCIAL as readonly string[]).includes(id);

/**
 * Parte los pedidos: los de Comercial los lee este módulo y el resto se DELEGA entero a
 * `datosDeBloquesExtra`. En positivo («es de los seis»), no «todo menos los de Analysts»: un bloque nuevo
 * de la otra corrida cae solo del lado de quien lo sabe leer, sin que nadie toque esta lista.
 */
export function repartirPedidos<P extends { bloque: string }>(pedidos: readonly P[]): { propios: P[]; extra: P[] } {
  const propios: P[] = [];
  const extra: P[] = [];
  for (const p of pedidos) (esBloqueComercial(p.bloque) ? propios : extra).push(p);
  return { propios, extra };
}

// ── El período ──────────────────────────────────────────────────────────────────────────────

/** Una ventana de vencimientos; `null` en las dos puntas = todo el pipeline (incluidas las cuotas sin fecha). */
export type Ventana = { desde: string | null; hasta: string | null };

/** El `desde` del preset «Todo» del catálogo (sale de `rangoDe`, no se copia: con dos constantes, una se queda vieja). */
export const DESDE_TODO = rangoDe('todo', '2000-01-01').desde;

/**
 * La ventana del Outstanding y de «A quién cobrarle», la MISMA que la tab vieja: mira hacia ADELANTE
 * («lo que falta cobrar»), desde el inicio del período hasta el FIN DE MES de su último día. Con «Todo»
 * (o un inicio igual o anterior), el pipeline entero: cuotas futuras y sin fecha incluidas.
 *
 * ⚠️ Por esto las fechas de los bloques llegan SIN acotar a hoy (app/api/graficos/route.ts): con los
 *    presets que terminan en hoy y el recorte de la ruta, el Outstanding de «Últimos 30 días» contaba
 *    sólo lo ya vencido, y una cuota que vence el viernes no figuraba en ningún lado.
 * ⚠️ La vieja decidía «todo» con `desde <= 2025-11-01` (el inicio de operación del primer cliente).
 *    Acá se decide con el «Todo» del catálogo: con aquella vara, «Últimos 12 meses» (que hoy arranca el
 *    1/11/2025) contaba como todo el pipeline.
 */
export function ventanaOutstanding(desde: string, hasta: string): Ventana {
  if (desde <= DESDE_TODO) return { desde: null, hasta: null };
  return { desde, hasta: finDeMesDeFecha(hasta) };
}

/** La ventana como se lee en pantalla: «dd/mm/aaaa → dd/mm/aaaa», o «todo el pipeline». */
export function textoVentana(v: Ventana): string {
  return v.desde && v.hasta ? `${fmtDDMMYYYY(v.desde)} → ${fmtDDMMYYYY(v.hasta)}` : 'todo el pipeline';
}

/** Lo vendido y lo cobrado se miden hasta HOY: un período que termina después se acota (como la vieja y la ruta). */
export function hastaHoy(desde: string, hasta: string, hoy: string): string {
  if (hasta <= hoy) return hasta;
  return hoy < desde ? desde : hoy;
}

// ── Revenue ─────────────────────────────────────────────────────────────────────────────────

export type DatosRevenue = {
  bloque: 'revenue';
  /** El período de Sold y Cash (ya acotado a hoy). */
  periodo: { desde: string; hasta: string };
  sold: number;
  cash: number;
  /** El total de la MISMA lectura que «A quién cobrarle» (getOutstandingDetalle), con su ventana. */
  outstanding: number;
  ventana: Ventana;
  cierres: number;
  primerosPagos: number;
  soldItems: RevItem[];
  cashItems: RevItem[];
  /** Una fila por CUOTA sin pagar de la ventana, la que vence primero arriba. */
  outItems: RevItem[];
  mrr: MrrResumen;
};

/**
 * La barra cobrado / pendiente: el % de lo cobrado sobre cobrado + pendiente (los dos suman 100).
 * Sin nada de los dos lados devuelve null y la pantalla dibuja la barra vacía: la vieja pintaba un
 * «100%» rojo sobre un negocio sin un peso, o sea una deuda que no existe.
 */
export function partesBarra(cash: number, outstanding: number): { cash: number; out: number } | null {
  const c = Math.max(0, cash || 0);
  const o = Math.max(0, outstanding || 0);
  if (c + o <= 0) return null;
  const pc = Math.round((c / (c + o)) * 100);
  return { cash: pc, out: 100 - pc };
}

// ── A quién cobrarle ────────────────────────────────────────────────────────────────────────

/** `vencida` = el vencimiento ya pasó (la fila va en rojo con URGENTE); `pronto` = vence en 5 días o menos. */
export type Urgencia = 'vencida' | 'pronto' | null;
export const DIAS_PRONTO = 5;

export type FilaCobro = {
  leadId: number;
  nombre: string;
  /** Lo vendido al lead (su monto de cierre). */
  vendido: number | null;
  /** Lo cobrado TOTAL del lead, sin ventana: el «otro dato de lo cobrado» que pidió Martín. */
  cobrado: number;
  /** Lo que falta cobrarle dentro de la ventana. */
  pendiente: number;
  /** La próxima cuota sin pagar: la que se marca con «Marcar cobrado». */
  cuota: { pagoId: number; numero: number; monto: number; vence: string | null } | null;
  /** Días hasta el vencimiento (negativo = vencida hace N días). */
  dias: number | null;
  urgencia: Urgencia;
};

export type DatosCobranza = {
  bloque: 'cobranza';
  filas: FilaCobro[];
  total: number;
  ventana: Ventana;
  /** La zona del negocio: la fecha de pago de «Marcar cobrado» es HOY en ella, calculado al hacer clic. */
  tz: string;
};

/** Días calendario de `hoy` a `iso` (los dos 'YYYY-MM-DD'); en UTC para no tropezar con el horario de verano. */
export function diasHasta(iso: string | null, hoy: string): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const [hy, hm, hd] = hoy.split('-').map(Number);
  if (![y, m, d, hy, hm, hd].every(Number.isFinite)) return null;
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86_400_000);
}

export function urgenciaDe(dias: number | null): Urgencia {
  if (dias == null) return null;
  if (dias < 0) return 'vencida';
  return dias <= DIAS_PRONTO ? 'pronto' : null;
}

/** El nombre de una cuota como lo escribe lib/pagos.ts: la 0 es el cobro inicial. */
export const nombreCuota = (n: number) => (n === 0 ? 'cobro inicial' : `cuota ${n}`);

/**
 * Las filas de «A quién cobrarle», como la tabla vieja (app/comercial/CobrarTable.tsx): ordenadas por
 * el vencimiento MÁS CERCANO arriba (lo vencido hace más tiempo primero, las sin fecha al final), con su
 * urgencia y el total pendiente. Los empates van por lo que más se debe y después por nombre, para que
 * el orden no dependa de cómo vino la lectura.
 *
 * El total se suma de las MISMAS filas que se dibujan: así el pie «Total pendiente» y el «N leads ·
 * $X pendiente» del desplegable no pueden contar distinto que la tabla.
 */
export function armarCobranza(items: readonly OutstandingLead[], hoy: string): { filas: FilaCobro[]; total: number } {
  const filas: FilaCobro[] = items.map((it) => {
    const c = it.proxima_cuota;
    const dias = diasHasta(c?.fecha_esperada ?? null, hoy);
    return {
      leadId: it.lead_id,
      nombre: it.lead_nombre,
      vendido: it.vendido_usd,
      cobrado: Number(it.cobrado_usd) || 0,
      pendiente: Number(it.pendiente_usd) || 0,
      cuota: c ? { pagoId: c.pago_id, numero: c.numero, monto: Number(c.monto_usd) || 0, vence: c.fecha_esperada } : null,
      dias,
      urgencia: urgenciaDe(dias),
    };
  });
  filas.sort((a, b) => {
    const fa = a.cuota?.vence ?? null;
    const fb = b.cuota?.vence ?? null;
    if (fa !== fb) {
      if (!fa) return 1;
      if (!fb) return -1;
      return fa < fb ? -1 : 1;
    }
    if (a.pendiente !== b.pendiente) return b.pendiente - a.pendiente;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
  const total = filas.reduce((s, f) => s + f.pendiente, 0);
  return { filas, total };
}

// ── Salud del funnel comercial ──────────────────────────────────────────────────────────────

export type DatosFunnel = {
  bloque: 'funnel_maduro';
  maduras: ResumenComercialMaduras;
  leads: FunnelMadurasLeads;
  /** null = no se pudo leer el gasto (la KPI lo dice; el embudo se dibuja igual). */
  cac: CACAcumulado | null;
};

/** Las conversiones entre etapas y el no-show, sobre las cohortes maduras (las de la tab vieja). */
export function conversiones(m: ResumenComercialMaduras): {
  asisten: number | null; califican: number | null; cierran: number | null; noShow: number | null;
} {
  return {
    asisten: m.total_j1 > 0 ? (m.asistencias / m.total_j1) * 100 : null,
    califican: m.asistencias > 0 ? (m.limpias / m.asistencias) * 100 : null,
    cierran: m.limpias > 0 ? (m.cierres / m.limpias) * 100 : null,
    noShow: m.total_j1 > 0 ? ((m.total_j1 - m.asistencias) / m.total_j1) * 100 : null,
  };
}

// ── SCL ─────────────────────────────────────────────────────────────────────────────────────

export type DatosScl = { bloque: 'scl'; scl: SCL; tramos: TramosSCL; leads: SCLLeadItem[] };

/** Los nodos de la línea de tiempo: el origen del primer tramo y el destino de cada uno. */
export function nodosDeTramos(t: TramosSCL): string[] {
  const l = t.tramos;
  if (!l.length) return [];
  const partes = (s: string) => s.split('→').map((x) => x.trim());
  return [partes(l[0].label)[0], ...l.map((x) => partes(x.label)[1] ?? x.label)];
}

// ── Cohortes ────────────────────────────────────────────────────────────────────────────────

export type TipoCohorte = 'mes' | 'semana';
export type Cohorte = CohorteMes | CohorteSemana;

export type DatosCohortes = {
  bloque: 'cohortes_mes' | 'cohortes_semana';
  cohortes: Cohorte[];
  /** Los leads de cada cohorte, por su clave (`claveCohorte`): el «ver leads →» de cada fila. */
  leads: Record<string, FunnelLeadItem[]>;
};

/** Cuántas se dibujan, como la tab vieja: las últimas 6 mensuales y las últimas 8 semanales. */
export const COHORTES_VISIBLES: Record<TipoCohorte, number> = { mes: 6, semana: 8 };

export const inicioDe = (c: Cohorte): string => ('semana_inicio' in c ? c.semana_inicio : c.mes_inicio).slice(0, 10);

/** La clave de una cohorte: el lunes de la semana, o el 'YYYY-MM' del mes. */
export function claveCohorte(fecha: string, tipo: TipoCohorte): string {
  const f = fecha.slice(0, 10);
  return tipo === 'semana' ? lunesDeFecha(f) : f.slice(0, 7);
}

/**
 * ¿La cohorte toca el período? Es la intersección de su lapso de reuniones con el período: un mes entra
 * si empieza antes del fin y no termina antes del inicio; una semana, si su lunes cae entre el lunes del
 * inicio y el fin. (La vieja medía las semanas contra el día 1 del mes del inicio, así que «Últimos 7
 * días» traía las semanas del mes entero.)
 */
export function cohorteEnRango(inicio: string, tipo: TipoCohorte, desde: string, hasta: string): boolean {
  const i = inicio.slice(0, 10);
  if (i > hasta) return false;
  const piso = tipo === 'semana' ? lunesDeFecha(desde) : `${desde.slice(0, 7)}-01`;
  return i >= piso;
}

/** Las cohortes del período, las más recientes primero, hasta las que se dibujan. */
export function cohortesDelPeriodo<C extends Cohorte>(lista: readonly C[], tipo: TipoCohorte, desde: string, hasta: string): C[] {
  return [...lista]
    .filter((c) => cohorteEnRango(inicioDe(c), tipo, desde, hasta))
    .sort((a, b) => (inicioDe(a) < inicioDe(b) ? 1 : inicioDe(a) > inicioDe(b) ? -1 : 0))
    .slice(0, COHORTES_VISIBLES[tipo]);
}

/** Los leads con reunión 1 agrupados por cohorte; sólo los de las cohortes que se dibujan. */
export function agruparLeadsPorCohorte(leads: readonly FunnelLeadItem[], cohortes: readonly Cohorte[], tipo: TipoCohorte): Record<string, FunnelLeadItem[]> {
  const claves = new Set(cohortes.map((c) => claveCohorte(inicioDe(c), tipo)));
  const out: Record<string, FunnelLeadItem[]> = {};
  for (const l of leads) {
    if (!l.fechaJ1) continue;
    const k = claveCohorte(l.fechaJ1, tipo);
    if (!claves.has(k)) continue;
    (out[k] ??= []).push(l);
  }
  return out;
}

/** La tasa de cierre de una cohorte: cierres ÷ calificadas (la «ratio joya» de la vista). */
export const tasaCierre = (cierres: number, limpias: number): number | null => (limpias > 0 ? (cierres / limpias) * 100 : null);

// ── El payload, del lado de la pantalla ─────────────────────────────────────────────────────

export type DatosComercial = DatosRevenue | DatosCobranza | DatosFunnel | DatosScl | DatosCohortes;

/** Lo que llegó por la red es `unknown`: se usa sólo si es el payload de ESE bloque. */
export function payloadDe(datos: unknown, bloque: BloqueComercial): DatosComercial | null {
  if (!datos || typeof datos !== 'object') return null;
  return (datos as { bloque?: unknown }).bloque === bloque ? (datos as DatosComercial) : null;
}
