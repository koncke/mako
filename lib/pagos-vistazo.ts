// =============================================================================
// pagos-vistazo — la tab Pagos DE UN VISTAZO: qué debe, qué pagó y qué hago ahora (puro)
// =============================================================================
// Pedido de Martín (16/10/2026, por Cerebro): «la tab de PAGOS que está un desastre también en funcionalidad, no se
// entiende». Y el criterio: «que se entienda de un vistazo: qué debe este lead, qué pagó, qué hago ahora (un botón
// claro por acción)». El relevamiento de lo que no se entendía está en docs/hallazgos-pagos.md §1.
//
// Lo que vive acá son las TRES lecturas que dibujan los bloques de Pagos (app/crm/lead-view/ficha/registro-pagos.tsx),
// la ficha del teléfono (app/m/crm/ficha-bloques.ts) y la API de MaKo. Se escriben una vez y los tests las EJECUTAN:
//   1. `estadoDeCuenta`: el titular del bloque `cobrado` («Debe $500», «Al día», «Pagó todo»), una línea de detalle
//      y LA acción que toca. Una sola: es la respuesta a «qué hago ahora». Las demás acciones viven en su bloque.
//   2. `renglonDeCuota`: cómo se lee una cuota y qué botón lleva. ⚠️ UNA CUOTA DEVUELTA NO ES DEUDA: la tarjeta de
//      antes la dibujaba «vence —» con «Marcar pagada» y la sumaba al pendiente (hallazgos-pagos.md §1, punto 3).
//   3. `movimientosDelLead`: todo lo que movió plata, del más nuevo al más viejo (cobros a mano y de la pasarela,
//      rechazos y devoluciones), más los AVISOS que hoy quedaban en letra chica (contracargo, devolución fallida…).
//   4. `loQueLlenaElDocumento`: lo que «Leer con IA» (el contrato o el documento fiscal) escribe. SÓLO LO VACÍO, como
//      hacía «Completar con IA», pero campo por campo (un campo que alguien ya cargó no se pisa nunca).
//
// ⚠️ LO COBRADO SALE DE `cobradoDelLead` (lib/cobrado-lead.ts) y de ningún otro lado: es la misma cuenta que la API
//    de MaKo (`cobranza_lead`). Acá sólo se ELIGE QUÉ DECIR con ese resultado.
//
// Sin `server-only`: lo importan los bloques (navegador), la API de MaKo y los tests.
// =============================================================================

import { ddmm, esCuotaDevuelta, esRenovacionFallida, type Cobrado, type CuotaParaCobrado, type Tono } from './cobrado-lead';
import { avisoPagoPorLinkAnulado, esDevolucionFallida, esTextoDeContracargo } from './cobros-reglas';
import { NOMBRE_PASARELA, esPasarela, type EstadoCobro, type Pasarela, type TipoCobro } from './cobros-tipos';
import { CAMPOS_DEAL, MAX_OBLIGACIONES, MAX_TEXTO_DEAL, MAX_TEXTO_OBLIGACION, esMetodoPago, nombreCuota, ROTULO_METODO, type ParteObligacion, type SeccionDeal } from './pagos-campo';
import { formatoMonto } from './pasarela-moneda';

const redondo = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
/** «$1,200» (el mismo formato que `cobradoDelLead`, para que el titular y la barra digan lo mismo). */
export const usd = (n: number): string => '$' + redondo(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta.slice(0, 10)}T12:00:00Z`) - Date.parse(`${desde.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
}
const dias = (n: number): string => (n === 1 ? '1 día' : `${n} días`);

/** «la cuota 2» · «el inicial»: para un botón («Cobrar la cuota 2») o una frase. */
export const cuotaEnFrase = (numero: number): string => (numero === 0 ? 'el inicial' : `la cuota ${numero}`);

/** Una cuota tal como llega de la base, con su número. */
export type CuotaDelLead = CuotaParaCobrado & { id: number; numero: number };

// ─────────────────────────────────────────────────────────────────────────────
// 1 · El estado de cuenta: qué debe, qué pagó y qué hago ahora
// ─────────────────────────────────────────────────────────────────────────────

/** LA acción que toca, con el texto de su botón. El bloque sabe qué abrir con cada `tipo`. */
export type AccionDeCobro =
  /** Una cuota vencida o que vence en 14 días: cobrarla (marcarla pagada o mandarle el link). */
  | { tipo: 'cobrar-cuota'; pagoId: number; numero: number; montoUsd: number; vencida: boolean; boton: string }
  /** Un pago único vendido sin pagos ni cuotas: registrar lo que pagó. */
  | { tipo: 'registrar-pago'; boton: string }
  /** Una suscripción manual: registrar la mensualidad que se cobró. */
  | { tipo: 'registrar-mes'; boton: string }
  /** Las cuotas suman menos que la venta y no queda ninguna por cobrar: falta la cuota del resto. */
  | { tipo: 'agregar-cuota'; faltaUsd: number; boton: string }
  /** Un ganado sin monto (la página de gracias gana sin monto): cargar cuánto se vendió. */
  | { tipo: 'cargar-venta'; boton: string };

export type EstadoDeCuenta = {
  /** Lo primero que se lee, y lo único en la vista épica: «Debe $500» · «Al día» · «Pagó todo». */
  titular: string;
  tono: Tono;
  /** Una línea: cuándo venció, cuándo es la próxima, o qué falta. */
  detalle: string | null;
  /** «$1,200 cobrado de $3,000», y la barra. null sin un total contra el que medir. */
  barra: { texto: string; pct: number | null } | null;
  /** Lo que falta cobrar en total (vencido y por vencer). */
  faltaUsd: number;
  accion: AccionDeCobro | null;
  /** Lo cobrado en su moneda original, donde no fue en dólares: «ARS 50.000». */
  monedas: string[];
};

/**
 * El titular del bloque `cobrado` («Estado de cuenta»). null = el bloque se calla: un becado, o un lead sin venta ni
 * cuotas (a ése le toca «Cobrar con link», que es otro bloque).
 */
export function estadoDeCuenta(e: { cobrado: Cobrado; pagos: readonly CuotaDelLead[]; ganado: boolean; hoy: string }): EstadoDeCuenta | null {
  const { cobrado: c, hoy } = e;
  const impagas = e.pagos.filter((q) => !q.pagado && !esCuotaDevuelta(q) && q.fecha_esperada)
    .sort((a, b) => String(a.fecha_esperada).localeCompare(String(b.fecha_esperada)));
  const vencidas = impagas.filter((q) => (q.fecha_esperada as string) < hoy);
  const proxima = impagas.find((q) => (q.fecha_esperada as string) >= hoy) ?? null;
  const monedas = c.monedas.map((m) => formatoMonto(m.monto, m.moneda));
  const barra = c.totalUsd ? { texto: c.texto, pct: c.pct } : c.cobradoUsd > 0 ? { texto: c.texto, pct: null } : null;
  const base = { barra, faltaUsd: c.pendienteUsd, monedas };

  const cobrarCuota = (q: CuotaDelLead, vencida: boolean): AccionDeCobro =>
    ({ tipo: 'cobrar-cuota', pagoId: q.id, numero: q.numero, montoUsd: redondo(num(q.monto_usd)), vencida, boton: `Cobrar ${cuotaEnFrase(q.numero)}` });
  const deudaVencida = (): EstadoDeCuenta => {
    const primera = vencidas[0];
    const hace = diasEntre(primera.fecha_esperada as string, hoy);
    return {
      ...base,
      titular: `Debe ${usd(c.vencidoUsd)}`,
      tono: 'rojo',
      detalle: vencidas.length === 1
        ? `${nombreCuota(primera.numero)} venció el ${ddmm(primera.fecha_esperada as string)} · hace ${dias(hace)}`
        : `${vencidas.length} cuotas vencidas · la primera, hace ${dias(hace)}`,
      accion: cobrarCuota(primera, true),
    };
  };
  const proximaFrase = (q: CuotaDelLead): string => {
    const en = diasEntre(hoy, q.fecha_esperada as string);
    return `Próxima: ${usd(num(q.monto_usd))} el ${ddmm(q.fecha_esperada as string)}${en === 0 ? ' · hoy' : en <= 14 ? ` · en ${dias(en)}` : ''}`;
  };
  /** La próxima, con su botón sólo si vence en 14 días o menos: más lejos no es «ahora». */
  const accionDeProxima = (q: CuotaDelLead | null): AccionDeCobro | null =>
    q && diasEntre(hoy, q.fecha_esperada as string) <= 14 ? cobrarCuota(q, false) : null;

  // ── Suscripción ──
  if (c.suscripcion) {
    const s = c.suscripcion;
    if (s.estado === 'cancelada') return { ...base, titular: 'Cancelada', tono: 'gris', detalle: `Era de ${s.mensualidadTexto}`, accion: null };
    if (s.renovacionFallida) return { ...base, titular: 'Falló la renovación', tono: 'rojo', detalle: s.renovacionFallida, accion: null };
    if (vencidas.length) return deudaVencida();
    if (s.estado === 'terminada') return { ...base, titular: 'Terminó', tono: 'gris', detalle: s.finPlazo ? `El plazo terminó el ${ddmm(s.finPlazo)}` : null, accion: null };
    if (s.fuente === 'manual' && c.cuotas.cobradas === 0 && impagas.length === 0) {
      return { ...base, titular: 'Sin cobros registrados', tono: 'gris', detalle: s.mensualidadTexto, accion: { tipo: 'registrar-mes', boton: 'Registrar el primer mes' } };
    }
    if (s.sinRegistrar > 0) {
      return {
        ...base,
        titular: s.sinRegistrar === 1 ? 'Falta registrar 1 mes' : `Falta registrar ${s.sinRegistrar} meses`,
        tono: 'ambar',
        detalle: s.mensualidadTexto,
        accion: { tipo: 'registrar-mes', boton: 'Registrar el mes cobrado' },
      };
    }
    const cuando = proxima?.fecha_esperada ?? s.proximaRenovacion;
    return { ...base, titular: 'Al día', tono: 'verde', detalle: `${s.mensualidadTexto}${cuando ? ` · próxima el ${ddmm(cuando)}` : ''}`, accion: accionDeProxima(proxima) };
  }

  // ── Becado, o nada vendido ──
  if (!c.seDibuja) {
    if (c.tipo === 'sin_cobro' || !e.ganado) return null;
    return { ...base, titular: 'Sin monto', tono: 'ambar', detalle: 'La venta no tiene monto cargado.', accion: { tipo: 'cargar-venta', boton: 'Cargar el monto' } };
  }

  // ── Pago único ──
  if (vencidas.length) return deudaVencida();
  if (c.cuotas.total === 0) {
    const devuelto = redondo(e.pagos.filter((q) => esCuotaDevuelta(q)).reduce((s, q) => s + num(q.monto_usd), 0));
    if (devuelto > 0) return { ...base, titular: 'Devuelto', tono: 'gris', detalle: `Se le devolvió ${usd(devuelto)}`, accion: null };
    return { ...base, titular: `Vendido en ${usd(c.totalUsd ?? 0)}`, tono: 'ambar', detalle: 'Todavía no hay pagos ni cuotas.', accion: { tipo: 'registrar-pago', boton: 'Registrar el pago' } };
  }
  if (c.pendienteUsd <= 0 && c.cuadra && c.cuadra.diferenciaUsd < -0.5) {
    const falta = redondo(-c.cuadra.diferenciaUsd);
    return { ...base, faltaUsd: falta, titular: `Faltan ${usd(falta)}`, tono: 'ambar', detalle: 'Lo que falta no tiene cuota.', accion: { tipo: 'agregar-cuota', faltaUsd: falta, boton: 'Agregar la cuota' } };
  }
  if (c.pendienteUsd <= 0) {
    const ultima = e.pagos.filter((q) => q.pagado && q.fecha_pago).map((q) => q.fecha_pago as string).sort().pop();
    return { ...base, titular: 'Pagó todo', tono: 'verde', detalle: ultima ? `Último pago el ${ddmm(ultima.slice(0, 10))}` : null, accion: null };
  }
  const porVencer = proxima != null && diasEntre(hoy, proxima.fecha_esperada as string) <= 14;
  return {
    ...base,
    titular: 'Al día',
    tono: porVencer ? 'ambar' : 'verde',
    detalle: proxima ? proximaFrase(proxima) : `Falta cobrar ${usd(c.pendienteUsd)}`,
    accion: accionDeProxima(proxima),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · El renglón de una cuota
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoCuota = 'cobrada' | 'vencida' | 'por-vencer' | 'futura' | 'sin-fecha' | 'devuelta';

export type RenglonCuota = {
  nombre: string;
  estado: EstadoCuota;
  /** «$500» o «ARS 50.000 · $50». */
  montoTexto: string;
  /** «cobrada el 02/10 · por Stripe» · «venció el 02/10 · hace 14 días» · «vence el 14/11 · en 3 días». */
  cuando: string;
  tono: Tono;
  /**
   * El botón del renglón. `marcar`: «Marcar pagada» (y, con pasarela, «Cobrar con link» al lado). `deshacer`: la
   * cobrada a mano. `ninguna`: la cobró la pasarela (se revierte con «Devolver», en el cobro) o está devuelta.
   */
  accion: 'marcar' | 'deshacer' | 'ninguna';
  /** Se puede cambiar el monto o la fecha (`editarCuotaAction`): sólo una impaga que no pasó por la pasarela. */
  editable: boolean;
};

const DE_PASARELA = (q: Pick<CuotaParaCobrado, 'proveedor'>): Pasarela | null => (esPasarela(q.proveedor) ? q.proveedor : null);

/** Cómo se lee una cuota y qué botón lleva. */
export function renglonDeCuota(q: CuotaDelLead & { concepto?: string | null; metodo?: string | null }, hoy: string): RenglonCuota {
  const nombre = q.concepto?.trim() || nombreCuota(q.numero);
  const montoTexto = montoDeCuota(q);
  const pasarela = DE_PASARELA(q);
  if (esCuotaDevuelta(q)) {
    return { nombre, estado: 'devuelta', montoTexto, cuando: pasarela ? `devuelta por ${NOMBRE_PASARELA[pasarela]}` : 'devuelta', tono: 'gris', accion: 'ninguna', editable: false };
  }
  if (q.pagado) {
    const via = pasarela ? `por ${NOMBRE_PASARELA[pasarela]}` : esMetodoPago(q.metodo) ? ROTULO_METODO[q.metodo].toLowerCase() : null;
    const cuando = `cobrada${q.fecha_pago ? ` el ${ddmm(q.fecha_pago.slice(0, 10))}` : ''}${via ? ` · ${via}` : ''}`;
    return { nombre, estado: 'cobrada', montoTexto, cuando, tono: 'verde', accion: pasarela ? 'ninguna' : 'deshacer', editable: false };
  }
  if (!q.fecha_esperada) return { nombre, estado: 'sin-fecha', montoTexto, cuando: 'sin fecha', tono: 'gris', accion: 'marcar', editable: true };
  const en = diasEntre(hoy, q.fecha_esperada);
  if (en < 0) return { nombre, estado: 'vencida', montoTexto, cuando: `venció el ${ddmm(q.fecha_esperada)} · hace ${dias(-en)}`, tono: 'rojo', accion: 'marcar', editable: true };
  if (en <= 14) return { nombre, estado: 'por-vencer', montoTexto, cuando: `vence el ${ddmm(q.fecha_esperada)} · ${en === 0 ? 'hoy' : `en ${dias(en)}`}`, tono: 'ambar', accion: 'marcar', editable: true };
  return { nombre, estado: 'futura', montoTexto, cuando: `vence el ${ddmm(q.fecha_esperada)}`, tono: 'gris', accion: 'marcar', editable: true };
}

function montoDeCuota(q: Pick<CuotaParaCobrado, 'monto_usd' | 'moneda' | 'monto_original'>): string {
  const m = (q.moneda ?? '').toUpperCase();
  return m && m !== 'USD' && q.monto_original != null ? `${formatoMonto(num(q.monto_original), m)} · ${usd(num(q.monto_usd))}` : usd(num(q.monto_usd));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · Los movimientos: todo lo que movió plata, y los avisos
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que hace falta de un cobro de la pasarela (`CobroVisible`). */
export type CobroParaMovimientos = {
  id: number;
  proveedor: Pasarela;
  tipo: TipoCobro;
  concepto: string | null;
  monto: number;
  moneda: string;
  estado: EstadoCobro;
  created_at: string;
  pagado_at: string | null;
  reembolsado_at: string | null;
  motivo: string | null;
};

export type Movimiento = {
  clave: string;
  /** AAAA-MM-DD, lo que se dibuja. */
  fecha: string;
  tipo: 'cobro' | 'rechazo' | 'devolucion';
  titulo: string;
  montoTexto: string;
  /** «por Stripe» · «transferencia» · «a mano». */
  via: string;
  tono: Tono;
  /** El motivo del rechazo, si la pasarela lo dijo. */
  detalle: string | null;
  pagoId: number | null;
  cobroId: number | null;
};

export type AvisoDeCobro = { cobroId: number; tono: 'rojo' | 'ambar'; texto: string };

/**
 * Los movimientos, del más nuevo al más viejo, y los avisos de los cobros.
 * ⚠️ UN COBRO PAGADO NO SE CUENTA DOS VECES: si una cuota cobrada ya lo representa (`cobro_id`), va la cuota. Va el
 *    cobro cuando ninguna cuota cobrada lo hace: la plata en otra moneda sin valor en dólares (no suma al cash) y el
 *    pago que después se devolvió (la devolución deja la cuota impaga, y sin esto el cobro original desaparecía).
 */
export function movimientosDelLead(e: {
  pagos: readonly (CuotaDelLead & { concepto?: string | null; metodo?: string | null })[];
  cobros: readonly CobroParaMovimientos[];
}): { movimientos: Movimiento[]; avisos: AvisoDeCobro[] } {
  const out: Array<Movimiento & { orden: string }> = [];
  const representados = new Set<number>();
  for (const q of e.pagos) {
    if (!q.pagado || !q.fecha_pago) continue;
    if (q.cobro_id != null) representados.add(q.cobro_id);
    const pasarela = DE_PASARELA(q);
    out.push({
      clave: `p${q.id}`, orden: `${q.fecha_pago.slice(0, 10)}T12:00`, fecha: q.fecha_pago.slice(0, 10), tipo: 'cobro',
      titulo: q.concepto?.trim() || nombreCuota(q.numero), montoTexto: montoDeCuota(q),
      via: pasarela ? `por ${NOMBRE_PASARELA[pasarela]}` : esMetodoPago(q.metodo) ? ROTULO_METODO[q.metodo].toLowerCase() : 'a mano',
      tono: 'verde', detalle: null, pagoId: q.id, cobroId: q.cobro_id ?? null,
    });
  }
  const avisos: AvisoDeCobro[] = [];
  for (const c of e.cobros) {
    const via = `por ${NOMBRE_PASARELA[c.proveedor]}`;
    const monto = formatoMonto(num(c.monto), c.moneda);
    const titulo = c.concepto?.trim() || (c.tipo === 'suscripcion' ? 'Suscripción' : 'Pago con link');
    if ((c.estado === 'pagado' || c.estado === 'reembolsado') && c.pagado_at && !representados.has(c.id)) {
      out.push({ clave: `c${c.id}`, orden: c.pagado_at, fecha: c.pagado_at.slice(0, 10), tipo: 'cobro', titulo, montoTexto: monto, via, tono: 'verde', detalle: null, pagoId: null, cobroId: c.id });
    }
    if (c.estado === 'reembolsado' && c.reembolsado_at) {
      out.push({ clave: `d${c.id}`, orden: c.reembolsado_at, fecha: c.reembolsado_at.slice(0, 10), tipo: 'devolucion', titulo: 'Devolución', montoTexto: monto, via, tono: 'ambar', detalle: null, pagoId: null, cobroId: c.id });
    }
    if (c.estado === 'fallido') {
      out.push({ clave: `r${c.id}`, orden: c.created_at, fecha: c.created_at.slice(0, 10), tipo: 'rechazo', titulo: 'Pago rechazado', montoTexto: monto, via, tono: 'rojo', detalle: c.motivo?.trim() || null, pagoId: null, cobroId: c.id });
    }
    const aviso = avisoDelCobro(c.motivo);
    if (aviso) avisos.push({ cobroId: c.id, ...aviso });
  }
  out.sort((a, b) => b.orden.localeCompare(a.orden) || a.clave.localeCompare(b.clave));
  return { movimientos: out.map(({ orden: _o, ...m }) => m), avisos };
}

/**
 * Lo que en un cobro es un AVISO y no un detalle: lo que pide que alguien haga algo. Un contracargo, una devolución
 * que falló, una renovación rechazada y un pago por un link anulado. El resto del `motivo` (por qué se rechazó una
 * tarjeta) va en el renglón del rechazo.
 */
export function avisoDelCobro(motivo: string | null | undefined): { tono: 'rojo' | 'ambar'; texto: string } | null {
  const m = motivo?.trim();
  if (!m) return null;
  if (esTextoDeContracargo(m)) return { tono: 'rojo', texto: m };
  if (esRenovacionFallida(m)) return { tono: 'rojo', texto: m };
  if (m === avisoPagoPorLinkAnulado(true) || m === avisoPagoPorLinkAnulado(false)) return { tono: 'rojo', texto: m };
  if (esDevolucionFallida(m)) return { tono: 'ambar', texto: m };
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Lo que llena un documento leído por IA: sólo lo vacío
// ─────────────────────────────────────────────────────────────────────────────

type Texto = string | null | undefined;
/** Lo que devuelven /api/extract-contract (las cuatro secciones) y /api/extract-deal-fiscal (sólo `fiscal`). */
export type DocumentoLeido = {
  fiscal?: Partial<Record<keyof typeof CAMPOS_DEAL.fiscal, Texto>> | null;
  servicio?: Partial<Record<keyof typeof CAMPOS_DEAL.servicio, Texto>> | null;
  promesa?: Partial<Record<keyof typeof CAMPOS_DEAL.promesa, Texto>> | null;
  obligaciones?: { cliente?: Texto[] | null; prestador?: Texto[] | null } | null;
};
type DealDelLead = {
  deal_fiscal?: Record<string, unknown> | null;
  deal_servicio?: Record<string, unknown> | null;
  deal_promesa?: Record<string, unknown> | null;
  deal_obligaciones?: { cliente?: unknown; prestador?: unknown } | null;
};

const limpio = (v: unknown, max: number): string | null => {
  const t = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  return t ? t.slice(0, max) : null;
};

/**
 * Los campos y los renglones que el documento llena: los que el documento trae y el lead tiene VACÍOS. Una lista de
 * obligaciones se llena sólo si la de esa parte está vacía entera (mezclar renglones de la IA con los de una persona
 * arma una lista que nadie escribió). `secciones` es lo que se le dice a la persona: «Se completó: servicio, promesa».
 */
export function loQueLlenaElDocumento(lead: DealDelLead, doc: DocumentoLeido): {
  campos: Array<{ seccion: SeccionDeal; campo: string; valor: string }>;
  obligaciones: Array<{ parte: ParteObligacion; texto: string }>;
  secciones: string[];
} {
  const campos: Array<{ seccion: SeccionDeal; campo: string; valor: string }> = [];
  const secciones = new Set<string>();
  const NOMBRE: Record<SeccionDeal | 'obligaciones', string> = { fiscal: 'datos fiscales', servicio: 'servicio', promesa: 'promesa', obligaciones: 'obligaciones' };
  const actual: Record<SeccionDeal, Record<string, unknown> | null | undefined> = { fiscal: lead.deal_fiscal, servicio: lead.deal_servicio, promesa: lead.deal_promesa };
  for (const seccion of ['fiscal', 'servicio', 'promesa'] as const) {
    const leido = (doc[seccion] ?? {}) as Record<string, unknown>;
    for (const campo of Object.keys(CAMPOS_DEAL[seccion])) {
      const valor = limpio(leido[campo], MAX_TEXTO_DEAL);
      if (!valor || limpio(actual[seccion]?.[campo], MAX_TEXTO_DEAL)) continue;
      campos.push({ seccion, campo, valor });
      secciones.add(NOMBRE[seccion]);
    }
  }
  const obligaciones: Array<{ parte: ParteObligacion; texto: string }> = [];
  for (const parte of ['cliente', 'prestador'] as const) {
    const tiene = lead.deal_obligaciones?.[parte];
    if (Array.isArray(tiene) && tiene.some((x) => limpio(x, MAX_TEXTO_OBLIGACION))) continue;
    const nuevas = (doc.obligaciones?.[parte] ?? []).map((x) => limpio(x, MAX_TEXTO_OBLIGACION)).filter((x): x is string => !!x).slice(0, MAX_OBLIGACIONES);
    for (const texto of nuevas) obligaciones.push({ parte, texto });
    if (nuevas.length) secciones.add(NOMBRE.obligaciones);
  }
  return { campos, obligaciones, secciones: [...secciones] };
}
