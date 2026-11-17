// =============================================================================
// pagos-bloques-lead — lo PURO de tres bloques de la tab Pagos que estaban en el catálogo sin componente
// =============================================================================
// P28 (pendientes verificados del 17/11/2026, «Toca la plata»): `confirmacion-de-pago`, `recordatorios-de-cobro` y
// `excepciones` estaban en lib/ficha/catalogo.ts y en las plantillas, y no tenían componente, así que la ficha los saltaba
// callada. Lo que dice cada uno está en docs/diseno-ficha-bloques.md (la tabla de Pagos). Aquí va lo que decide QUÉ se
// dibuja, sin React ni server-only, para que tests/ficha-pagos-bloques-nuevos.test.ts lo ejecute. Los componentes están en
// app/crm/lead-view/ficha/pagos/bloques-seguimiento.tsx; las lecturas y escrituras, en sus actions.
//
//   · Confirmación de pago: cuándo dijo que compra (`fecha_confirmacion`, mig 0004) contra el primer pago
//     (`fecha_primer_pago`, que deriva `sincronizarTotalCobrado`, lib/pagos.ts). «Confirmó hace N días y no pagó».
//   · Excepciones: lo que se eximió al mover la etapa (migs 0064 y 0069), con su motivo si quedó en el historial.
//   · Recordatorios de cobro: las corridas de cobranza VIVAS de sus cuotas sin cobrar (`flujo_corridas`, mig 0186).
//
// ⚠️ LOS RECORDATORIOS SALEN AL GRUPO DE MAKO, NUNCA AL CLIENTE (la decisión del 06/10/2026, «C: nada al cliente»: está en
// el `cuota-vencida` de lib/avisos-catalogo.ts). El diseño decía «MaKo le recuerda la cuota 3»; el texto dice «MaKo avisa»,
// porque «le recuerda» se lee como que le escribe al cliente, y eso no pasa.
// =============================================================================

import { fechaEnPalabras } from './date-utils';

export type TonoBloque = 'verde' | 'ambar' | 'rojo' | 'gris';

/** Días de calendario de `desde` a `hasta` (AAAA-MM-DD): a mediodía UTC, así un cambio de horario no corre un día. */
function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${hasta.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirmación de pago
// ─────────────────────────────────────────────────────────────────────────────

/** Desde cuántos días sin el primer pago la alerta pasa de ámbar a rojo. */
export const DIAS_CONFIRMADO_EN_ROJO = 7;

export type ConfirmacionDePago = {
  /** AAAA-MM-DD, o null si nadie la cargó (el bloque dibuja «—» para llenarla). */
  fecha: string | null;
  /** La línea de abajo: «Confirmó hace 3 días y no pagó», «Pagó 2 días después». null = nada que decir. */
  linea: string | null;
  tono: TonoBloque;
  /** Hay que cobrarle: se ofrece «Cobrar con link» al lado. */
  cobrar: boolean;
};

const dia = (v: string | null | undefined): string | null => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/**
 * Lo que dice el bloque. `sinCobro`: una venta becada (VENTA_SIN_COBRO) no tiene primer pago que esperar, así que no hay
 * alerta. Un primer pago ANTERIOR a la confirmación (se cargó la fecha después) no es «pagó -3 días después»: es «ya pagó».
 */
export function confirmacionDePago(e: { fechaConfirmacion: string | null | undefined; fechaPrimerPago: string | null | undefined; sinCobro: boolean; hoy: string }): ConfirmacionDePago {
  const fecha = dia(e.fechaConfirmacion);
  const pago = dia(e.fechaPrimerPago);
  if (!fecha) return { fecha: null, linea: pago ? `Pagó el ${fechaEnPalabras(pago, e.hoy)}` : null, tono: pago ? 'verde' : 'gris', cobrar: false };
  if (pago) {
    const d = diasEntre(fecha, pago);
    const linea = d <= 0 ? 'Ya pagó' : d === 1 ? 'Pagó al día siguiente' : `Pagó ${d} días después`;
    return { fecha, linea, tono: 'verde', cobrar: false };
  }
  if (e.sinCobro) return { fecha, linea: 'Sin cobro: no hay pago que esperar', tono: 'gris', cobrar: false };
  const d = diasEntre(fecha, e.hoy);
  if (d < 0) return { fecha, linea: `Confirmó para el ${fechaEnPalabras(fecha, e.hoy)}`, tono: 'gris', cobrar: true };
  if (d === 0) return { fecha, linea: 'Confirmó hoy y todavía no pagó', tono: 'ambar', cobrar: true };
  return {
    fecha, linea: d === 1 ? 'Confirmó ayer y no pagó' : `Confirmó hace ${d} días y no pagó`,
    tono: d >= DIAS_CONFIRMADO_EN_ROJO ? 'rojo' : 'ambar', cobrar: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Excepciones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las excepciones que se declaran al mover la etapa (`completeStageMoveAction`, app/crm/actions.ts) y quedan en el lead
 * para que no se vuelvan a exigir. `evento` es la línea que esa misma acción deja en el historial con el motivo; las dos
 * omisiones de la 0069 no dejan ninguna, así que no tienen motivo que mostrar.
 */
export const EXCEPCIONES = [
  { id: 'sin_r1', rotulo: 'Cerró sin R1', evento: 'Cierre sin R1' },
  { id: 'sin_r2', rotulo: 'Cerró sin R2', evento: 'Cierre sin R2' },
  { id: 'fathom_omitido', rotulo: 'Reunión sin grabar', evento: 'Reunión sin grabación' },
  { id: 'deal_fiscal_doc_omitido', rotulo: 'Sin documento fiscal', evento: null },
  { id: 'comprobante_omitido', rotulo: 'Sin comprobantes', evento: null },
  // La única que es un texto: el motivo ES el valor.
  { id: 'r2_agenda_externa_motivo', rotulo: 'R2 agendada por fuera', evento: 'Agendada fuera de Calendly' },
] as const;

export type IdExcepcion = (typeof EXCEPCIONES)[number]['id'];
export const IDS_EXCEPCION: readonly IdExcepcion[] = EXCEPCIONES.map((x) => x.id);
export const esIdExcepcion = (v: unknown): v is IdExcepcion => typeof v === 'string' && (IDS_EXCEPCION as readonly string[]).includes(v);
/** Los eventos del historial que traen el motivo (lo que lee `motivosDeExcepcionesAction`). */
export const EVENTOS_DE_EXCEPCION: readonly string[] = EXCEPCIONES.map((x) => x.evento).filter((x): x is NonNullable<typeof x> => !!x);

export type ExcepcionDelLead = { id: IdExcepcion; rotulo: string; motivo: string | null };

/** Lo que el lead tiene puesto (las columnas tal como vienen en `Lead`). */
export type LeadConExcepciones = Partial<Record<Exclude<IdExcepcion, 'r2_agenda_externa_motivo'>, boolean | null>> & { r2_agenda_externa_motivo?: string | null };

/** ¿Tiene alguna? Es lo que calla el bloque (`sinDatos: 'se-calla'`): sin ninguna, no se dibuja. */
export function tieneExcepciones(l: LeadConExcepciones): boolean {
  return excepcionesDelLead(l, {}).length > 0;
}

/**
 * Las que tiene el lead, en el orden del catálogo. `motivos`: por evento del historial, el ÚLTIMO texto que dejó (el R2
 * por fuera lo trae «R2 · <motivo>»: se le saca el prefijo). Sin motivo leído, null: el bloque no inventa uno.
 */
export function excepcionesDelLead(l: LeadConExcepciones, motivos: Readonly<Record<string, string | null | undefined>>): ExcepcionDelLead[] {
  const out: ExcepcionDelLead[] = [];
  for (const x of EXCEPCIONES) {
    if (x.id === 'r2_agenda_externa_motivo') {
      const m = l.r2_agenda_externa_motivo?.trim();
      if (m) out.push({ id: x.id, rotulo: x.rotulo, motivo: m });
      continue;
    }
    if (l[x.id] !== true) continue;
    const m = x.evento ? motivos[x.evento]?.trim() || null : null;
    out.push({ id: x.id, rotulo: x.rotulo, motivo: m });
  }
  return out;
}

/** Lo que se escribe para quitar una (y lo que se escribe para deshacer: el valor de antes). */
export function valorAlQuitar(id: IdExcepcion): boolean | null {
  return id === 'r2_agenda_externa_motivo' ? null : false;
}

export const rotuloDeExcepcion = (id: IdExcepcion): string => EXCEPCIONES.find((e) => e.id === id)?.rotulo ?? id;

/** La línea del historial al quitarla: dice qué vuelve a pedirse, que es lo que cambia para quien mira. */
export const lineaAlQuitar = (id: IdExcepcion): string => `Se quitó «${rotuloDeExcepcion(id)}»: el dato se vuelve a pedir`;
/** Y la del Deshacer. */
export const lineaAlVolver = (id: IdExcepcion): string => `Se deshizo: vuelve «${rotuloDeExcepcion(id)}»`;

// ─────────────────────────────────────────────────────────────────────────────
// Recordatorios de cobro
// ─────────────────────────────────────────────────────────────────────────────

/** Una corrida de cobranza VIVA, como la trae la lectura (`recordatoriosDelLead`, lib/pagos.ts). */
export type CorridaDeCobro = {
  id: number;
  /** De qué cuota habla (`ctx.cuotaId`): la clave con la que se corta al marcar el pago. */
  pagoId: number;
  /** El nombre de la automatización (`ctx.aviso.titulo`, el que le puso el negocio) o el del catálogo. */
  titulo: string | null;
  /** Cuándo sale lo próximo. null = en la próxima vuelta del drenador (no está durmiendo). */
  proximaAt: string | null;
};

export type CuotaParaRecordatorio = { id: number; numero: number; monto_usd: number | string | null; fecha_esperada: string | null; pagado: boolean };

export type RecordatorioDeCuota = {
  pagoId: number;
  numero: number;
  montoUsd: number | null;
  vence: string | null;
  /** Lo que la cuota tiene corriendo, del que sale antes al que sale después. */
  corridas: Array<{ id: number; titulo: string | null; proximaAt: string | null }>;
  /** El primero en salir (null = en la próxima vuelta). */
  proximaAt: string | null;
};

/**
 * Las cuotas SIN COBRAR que tienen un recordatorio corriendo, por la que vence primero. Una corrida de una cuota que no
 * está (ya cobrada, o de otro lead) se ignora: el corte de `marcarPago` debió cerrarla, y mostrarla sería decir que se le
 * recuerda algo que ya pagó.
 */
export function recordatoriosPorCuota(corridas: readonly CorridaDeCobro[], cuotas: readonly CuotaParaRecordatorio[]): RecordatorioDeCuota[] {
  const impagas = new Map(cuotas.filter((q) => !q.pagado).map((q) => [q.id, q]));
  const porCuota = new Map<number, RecordatorioDeCuota>();
  // null («en la próxima vuelta») sale antes que cualquier hora.
  const antes = (a: string | null, b: string | null) => (a == null ? -1 : b == null ? 1 : a.localeCompare(b));
  for (const c of corridas) {
    const q = impagas.get(c.pagoId);
    if (!q) continue;
    const r = porCuota.get(q.id) ?? {
      pagoId: q.id, numero: q.numero, montoUsd: q.monto_usd == null || q.monto_usd === '' ? null : Number(q.monto_usd),
      vence: dia(q.fecha_esperada), corridas: [], proximaAt: null,
    };
    r.corridas.push({ id: c.id, titulo: c.titulo?.trim() || null, proximaAt: c.proximaAt });
    porCuota.set(q.id, r);
  }
  const out = [...porCuota.values()];
  for (const r of out) {
    r.corridas.sort((a, b) => antes(a.proximaAt, b.proximaAt));
    r.proximaAt = r.corridas[0]?.proximaAt ?? null;
  }
  return out.sort((a, b) => (a.vence ?? '9999').localeCompare(b.vence ?? '9999') || a.numero - b.numero);
}

/** «de la cuota 3», «del cobro inicial» (la 0 es el cobro inicial: `nombreCuota`, lib/pagos-campo.ts). */
export const deLaCuota = (numero: number): string => (numero === 0 ? 'del cobro inicial' : `de la cuota ${numero}`);

/** El renglón del diseño corto: «MaKo avisa de la cuota 3 · jue 20 nov, 09:00», o con varias, cuántas y el próximo. */
export function renglonDeRecordatorios(rs: readonly RecordatorioDeCuota[], cuando: (iso: string | null) => string): string | null {
  if (!rs.length) return null;
  const primero = [...rs].sort((a, b) => (a.proximaAt == null ? -1 : b.proximaAt == null ? 1 : a.proximaAt.localeCompare(b.proximaAt)))[0];
  return rs.length === 1
    ? `MaKo avisa ${deLaCuota(primero.numero)} · ${cuando(primero.proximaAt)}`
    : `MaKo avisa de ${rs.length} cuotas · la próxima, ${deLaCuota(primero.numero).replace(/^de la |^del /, '')} ${cuando(primero.proximaAt)}`;
}
