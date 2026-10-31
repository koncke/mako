// =============================================================================
// cobro-etapa — «Vincular cobro» en el ⋯ de la etapa Ganado (22/10/2026, punto 3 del feedback de Martín)
// =============================================================================
// La etapa Ganado de un CRM se vincula a un producto del catálogo, cobrable por una o varias cuentas (Stripe y Mercado
// Pago a la vez). Cuando alguien paga ese producto por una de esas cuentas, pasa a Ganado EN ESE CRM, con el pago en el
// trato de ese CRM (los pagos por CRM de la 0324) y su plan si el producto se cobra en cuotas (mig 0326).
//
// El contrato con el CRM (que dibuja el ⋯ y el modal) está en las notas del Cerebro, contrato-cobro-en-ganado.md: los
// tipos de acá y las acciones de app/crm/cobro-etapa-actions.ts no cambian sin avisar.
//
// Puro y sin `server-only`: lo importan el modal (navegador), lib/cobro-etapa-server.ts, lib/cobros.ts y los tests
// (tests/cobro-etapa.test.ts).
// =============================================================================

import { esPasarela, NOMBRE_PASARELA, type Pasarela } from './cobros-tipos';

/**
 * ⚠️ DERIVADO DE `Pasarela`, no copiado (31/10/2026). Era `'stripe' | 'mercadopago'` escrito a mano, una de las CINCO
 * copias de la misma unión que había en el repo, y por eso «Vincular cobro» y la ficha no daban un solo error al
 * agregar la tercera pasarela: descartaban sus cuentas en silencio (`proveedorDeCuenta` devolvía null, y el pago nunca
 * encontraba su vínculo). Las copias de una unión tienen que moverse juntas, o la que se queda atrás descarta al
 * proveedor nuevo sin que nada falle.
 */
export type ProveedorPago = Pasarela;

/**
 * Una cuenta conectada de una pasarela. Puede haber VARIAS por proveedor. `id` es estable: 'stripe:principal' y
 * 'mercadopago:principal' son las de siempre (las claves que ya están guardadas). `nombre` es el alias del negocio.
 */
export type CuentaPago = { id: string; proveedor: ProveedorPago; nombre: string; principal: boolean };

/** Un producto del catálogo de MaKo con lo que cobra. `cuotas`: en cuántos pagos se cobra un pago único (null = 1). */
export type ProductoCobro = {
  id: number; nombre: string; tipo: 'unico' | 'suscripcion';
  montoUsd: number | null; suscripcionMeses: number | null; cuotas: number | null; activo: boolean;
};
export type ProductoCobroInput = {
  nombre: string; tipo: 'unico' | 'suscripcion'; montoUsd: number;
  suscripcionMeses?: number | null; cuotas?: number | null;
};

/** La etapa (Ganado) de un CRM vinculada a un producto, cobrable por UNA O VARIAS cuentas: Stripe y MP a la vez. */
export type VinculoCobro = { id: number; funnelId: number; etapa: string; productoId: number; cuentas: string[] };

/** Lo que el modal necesita de una vez. */
export type FotoCobroEtapa = {
  /** Vacío = no hay pasarela conectada: el modal ofrece conectar (el modal de /integraciones, AHÍ). */
  cuentas: CuentaPago[];
  /** Los activos del catálogo. */
  productos: ProductoCobro[];
  /** Los de ESTA etapa. */
  vinculos: VinculoCobro[];
  /** Admin del negocio. */
  puedeEditar: boolean;
};

export type ResCobro<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Lo que la pantalla dice en una línea de qué pasa al pagar. */
export const TEXTO_AL_PAGAR = 'Cuando alguien paga este producto, pasa a Ganado aquí, con su plan de pagos.';

export const NOMBRE_PROVEEDOR: Readonly<Record<ProveedorPago, string>> = NOMBRE_PASARELA;

// ─────────────────────────────────────────────────────────────────────────────
// Las cuentas
// ─────────────────────────────────────────────────────────────────────────────

/** El id de la cuenta de siempre de un proveedor: la de las claves sin sufijo. */
export const cuentaPrincipal = (p: ProveedorPago): string => `${p}:principal`;

/** La principal de cada pasarela conectada (antes de las varias cuentas; hoy el modal lee `cuentasDePago`). */
export const cuentasDePasarelas = (conectadas: readonly ProveedorPago[]): CuentaPago[] =>
  conectadas.map((p) => ({ id: cuentaPrincipal(p), proveedor: p, nombre: NOMBRE_PROVEEDOR[p], principal: true }));

/** El proveedor de un id de cuenta ('stripe:principal' → 'stripe'); null si no es de ninguno. */
export function proveedorDeCuenta(id: unknown): ProveedorPago | null {
  if (typeof id !== 'string') return null;
  const [p, resto] = id.split(':', 2);
  if (!resto || !/^[a-z0-9-]{1,40}$/.test(resto)) return null;
  return esPasarela(p) ? p : null;
}

/**
 * Las cuentas de un vínculo, limpias: sólo ids con forma, sin repetir, y sólo de las que el negocio tiene conectadas.
 * Una que se desconectó después queda afuera al guardar (no se cobra por una cuenta que no está).
 */
export function cuentasValidas(pedidas: readonly unknown[], conectadas: readonly CuentaPago[]): string[] {
  const hay = new Set(conectadas.map((c) => c.id));
  return [...new Set(pedidas.filter((x): x is string => proveedorDeCuenta(x) != null && hay.has(x as string)))];
}

/**
 * El id de la cuenta por la que se cobró un cobro. `cobros.cuenta` (mig 0328) guarda el SUFIJO (`c2`; NULL = la
 * principal), y el vínculo el id (`stripe:c2`): sin armarlo, un pago de la segunda cuenta nunca encontraba su vínculo.
 */
export const cuentaDelCobro = (c: { proveedor: ProveedorPago; cuenta?: string | null }): string =>
  c.cuenta ? `${c.proveedor}:${c.cuenta}` : cuentaPrincipal(c.proveedor);

// ─────────────────────────────────────────────────────────────────────────────
// Los productos
// ─────────────────────────────────────────────────────────────────────────────

const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * ¿Dos montos son el mismo, al centavo? (revisión de plata del 22/10/2026, baja 5): `Math.abs(a - b) < 0.01` daba por
 * iguales 333,34 y 333,33 (la resta es 0,00999…), justo la diferencia que fabrica el plan entre el inicial y las cuotas.
 */
export const mismoCentavo = (a: number | string | null | undefined, b: number | string | null | undefined): boolean =>
  a != null && b != null && Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.round(Number(a) * 100) === Math.round(Number(b) * 100);

/** Una fila de `productos` como la lee el modal (una base sin la 0326 no trae `cuotas`: un pago). */
export function productoDeFila(f: Record<string, unknown>): ProductoCobro {
  const cuotas = num(f.cuotas);
  return {
    id: Number(f.id), nombre: String(f.nombre ?? ''), tipo: f.tipo === 'suscripcion' ? 'suscripcion' : 'unico',
    montoUsd: num(f.monto_usd), suscripcionMeses: num(f.suscripcion_meses),
    cuotas: cuotas != null && cuotas > 1 ? cuotas : null, activo: f.activo !== false,
  };
}

/** Lo más que se puede partir un pago único: el primero lo cobra el link y quedan hasta 6 cuotas (el CHECK de la 0014). */
export const MAX_CUOTAS_PRODUCTO = 7;

/** Lo que se guarda de un producto desde el modal, validado. Un error dice qué campo y qué hacer. */
export function productoValido(i: ProductoCobroInput): { ok: true; fila: { nombre: string; tipo: 'unico' | 'suscripcion'; monto_usd: number; suscripcion_meses: number | null; cuotas: number | null } } | { ok: false; error: string } {
  const nombre = String(i?.nombre ?? '').replace(/\s+/g, ' ').trim();
  if (!nombre) return { ok: false, error: 'Ponle un nombre al producto.' };
  if (nombre.length > 120) return { ok: false, error: 'El nombre es muy largo (hasta 120 letras).' };
  const tipo = i.tipo === 'suscripcion' ? 'suscripcion' : i.tipo === 'unico' ? 'unico' : null;
  if (!tipo) return { ok: false, error: 'El producto es un pago único o una suscripción.' };
  const monto = Number(i.montoUsd);
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: 'El precio tiene que ser mayor que cero.' };
  if (Math.round(monto * 100) / 100 !== monto) return { ok: false, error: 'El precio va con hasta dos decimales.' };
  if (monto > 1_000_000) return { ok: false, error: 'Ese precio es demasiado alto.' };
  let meses: number | null = null;
  let cuotas: number | null = null;
  if (tipo === 'suscripcion') {
    if (i.cuotas != null && Number(i.cuotas) > 1) return { ok: false, error: 'Una suscripción se cobra cada mes: no va en cuotas.' };
    if (i.suscripcionMeses != null) {
      meses = Number(i.suscripcionMeses);
      if (!Number.isInteger(meses) || meses < 1 || meses > 60) return { ok: false, error: 'La suscripción dura de 1 a 60 meses (o sin fin).' };
    }
  } else if (i.cuotas != null) {
    const n = Number(i.cuotas);
    if (!Number.isInteger(n) || n < 1 || n > MAX_CUOTAS_PRODUCTO) return { ok: false, error: `Un pago único va en 1 a ${MAX_CUOTAS_PRODUCTO} cuotas.` };
    cuotas = n > 1 ? n : null;
  }
  return { ok: true, fila: { nombre, tipo, monto_usd: monto, suscripcion_meses: meses, cuotas } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que pasa al pagar
// ─────────────────────────────────────────────────────────────────────────────

/** El plan uniforme que deja un producto en cuotas (la forma de `PlanUniforme`, lib/pagos-campo.ts). */
export type PlanDelProducto = { cobro_inicial_usd: number; monto_cuota_usd: number; total_cuotas: number; dia_de_pago: number };

/**
 * Cuánto cobra el link de un producto y qué plan deja. Un pago único en N cuotas: el link cobra el PRIMER pago (el
 * inicial) y quedan N-1 cuotas iguales. Las cuotas se redondean para ABAJO al centavo y el inicial se lleva lo que
 * sobra: la suma da EXACTO el precio (US$1.000 en 3 = 333,34 + 2 × 333,33). Sin cuotas, o una suscripción: el link
 * cobra el precio y no hay plan. `dia`: el día del mes del pago (las cuotas vencen ese día, hasta el 28).
 */
export function planDelProducto(p: Pick<ProductoCobro, 'tipo' | 'montoUsd' | 'cuotas'>, dia: number): { primerPagoUsd: number | null; plan: PlanDelProducto | null } {
  const monto = p.montoUsd;
  if (monto == null || !(monto > 0)) return { primerPagoUsd: null, plan: null };
  const n = p.tipo === 'unico' && p.cuotas != null && p.cuotas > 1 ? Math.min(p.cuotas, MAX_CUOTAS_PRODUCTO) : 1;
  if (n === 1) return { primerPagoUsd: monto, plan: null };
  const centavos = Math.round(monto * 100);
  const cuota = Math.floor(centavos / n);
  const inicial = centavos - cuota * (n - 1);
  return {
    primerPagoUsd: inicial / 100,
    plan: { cobro_inicial_usd: inicial / 100, monto_cuota_usd: cuota / 100, total_cuotas: n - 1, dia_de_pago: Math.min(Math.max(1, Math.trunc(dia) || 1), 28) },
  };
}

/**
 * ¿A qué trato va un pago? El del vínculo de su producto, si la cuenta por la que se pagó está en el vínculo; si no,
 * null (el de siempre: la casa del lead). Sólo el PRIMER pago de un cobro (una renovación de una suscripción es plata
 * de un trato que ya existe) y sólo un cobro con producto y sin cuota (el link de una cuota ya sabe de qué trato es).
 */
export function vinculoDelPago(
  c: { producto_id: number | null; pago_id: number | null; proveedor: ProveedorPago; cuenta?: string | null },
  vinculos: readonly VinculoCobro[],
  opts: { renovacion: boolean },
): VinculoCobro | null {
  if (opts.renovacion || c.producto_id == null || c.pago_id != null) return null;
  const cuenta = cuentaDelCobro(c);
  return vinculos.find((v) => v.productoId === Number(c.producto_id) && v.cuentas.includes(cuenta)) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que se corrigió en la revisión adversarial (22/10/2026)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que se escribe al EDITAR un producto: sólo lo que vino. `suscripcionMeses` y `cuotas` son opcionales en el contrato, y
 * escribir el null de `productoValido` borraba el plazo de una suscripción «6 meses» (los links nuevos cobraban sin fin, el
 * bug del 15/10) o las cuotas de un pago único. El tipo manda: una suscripción no tiene cuotas, un pago único no tiene plazo.
 */
export function patchDeEdicion(
  i: ProductoCobroInput,
  fila: { nombre: string; tipo: 'unico' | 'suscripcion'; monto_usd: number; suscripcion_meses: number | null; cuotas: number | null },
): Record<string, unknown> {
  const patch: Record<string, unknown> = { nombre: fila.nombre, tipo: fila.tipo, monto_usd: fila.monto_usd };
  if (fila.tipo === 'suscripcion') {
    patch.cuotas = null;
    if (i.suscripcionMeses !== undefined) patch.suscripcion_meses = fila.suscripcion_meses;
  } else {
    patch.suscripcion_meses = null;
    if (i.cuotas !== undefined) patch.cuotas = fila.cuotas;
  }
  return patch;
}

/** El precio y las cuotas del producto AL CREAR el link (`cobros.plan_producto`, mig 0326). */
export type PlanCongelado = { precio: number; cuotas: number | null };

/** Lo que se guarda en el cobro al crearlo, de un producto. null = sin precio (no hay plan que congelar). */
export function congelarPlan(p: Pick<ProductoCobro, 'montoUsd' | 'cuotas'>): PlanCongelado | null {
  return p.montoUsd != null && p.montoUsd > 0 ? { precio: p.montoUsd, cuotas: p.cuotas != null && p.cuotas > 1 ? p.cuotas : null } : null;
}

/** El `plan_producto` guardado, leído con cuidado (viene de la base como jsonb). */
export function planCongeladoDe(v: unknown): PlanCongelado | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const precio = num(o.precio);
  const cuotas = num(o.cuotas);
  return precio != null && precio > 0 ? { precio, cuotas: cuotas != null && cuotas > 1 ? cuotas : null } : null;
}

/**
 * El plan y la venta de un pago, de lo que COBRÓ el link (revisión adversarial, alta 1): el plan congelado en el cobro, no el
 * producto de hoy. Si el producto se editó entre el link y el pago, el plan de hoy no es el que se cobró: con el de hoy, un
 * pago de US$1.000 armaba un plan de 3 cuotas y quedaba suelto al lado (US$1.000 de deuda que no existía). Y el plan se arma
 * SÓLO si su primer pago es lo que se cobró; si no, sin plan y la venta es lo cobrado. Un cobro de antes de la 0326 (sin
 * plan congelado) es lo que cobró: su monto, sin cuotas. El tipo es el del COBRO (una suscripción sigue siéndolo).
 */
export function planDelCobro(
  c: { tipo: 'unico' | 'suscripcion'; monto_usd: number | null },
  congelado: PlanCongelado | null,
  dia: number,
): { plan: PlanDelProducto | null; montoVenta: number | null } {
  if (c.tipo === 'suscripcion') return { plan: null, montoVenta: null };
  const base = congelado ?? (c.monto_usd != null ? { precio: c.monto_usd, cuotas: null } : null);
  if (!base) return { plan: null, montoVenta: null };
  const p = planDelProducto({ tipo: 'unico', montoUsd: base.precio, cuotas: base.cuotas }, dia);
  const coincide = mismoCentavo(p.primerPagoUsd, c.monto_usd);
  return coincide ? { plan: p.plan, montoVenta: base.precio } : { plan: null, montoVenta: c.monto_usd };
}

/**
 * Lo que dice el trato cuando el plan de un pago NO se armó (revisión de plata, media 3). null si este pago saldó la cuota 0
 * de un plan que ya estaba (`saldaInicial`): el plan existía y éste es su inicial, nada falta (tercera revisión: decía
 * «puede ser un pago repetido» a un pago legítimo, e invitaba a devolverlo). Si en el trato hay cuotas impagas del monto
 * de la cuota, NO se afirma de quién son (pueden ser de otra compra): se dice cuántas hay y qué falta en cada caso.
 */
export function pendienteDelPlan(
  plan: PlanDelProducto,
  cuotas: ReadonlyArray<{ pagado: boolean; monto_usd: number | string; fecha_esperada: string | null; baja_at?: string | null }>,
  motivo: string,
  saldaInicial = false,
): string | null {
  if (saldaInicial) return null;
  const n = plan.total_cuotas + 1;
  const c = plan.total_cuotas;
  const usd = `US$ ${plan.monto_cuota_usd.toFixed(2)}`;
  const cuotasDe = (k: number) => `${k} cuota${k === 1 ? '' : 's'}`;
  const ya = cuotas.filter((q) => !q.pagado && !q.baja_at && q.fecha_esperada != null && mismoCentavo(q.monto_usd, plan.monto_cuota_usd)).length;
  if (!ya) return `Entró el primer pago de ${n}; faltan ${cuotasDe(c)} de ${usd} (${motivo}): ${c === 1 ? 'cárgala' : 'cárgalas'} en Pagos.`;
  const siSon = ya >= c ? 'puede ser un pago repetido' : `faltan ${cuotasDe(c - ya)}`;
  return `Entró el primer pago de ${n} (${motivo}). En Pagos hay ${cuotasDe(ya)} impaga${ya === 1 ? '' : 's'} de ${usd}: si son de esta compra, ${siSon}; si no, faltan ${cuotasDe(c)}. Revísalo antes de cargar nada.`;
}

/** Una cuota del trato, lo justo para decidir la baja de un plan. */
export type CuotaParaBajaDelPlan = { id: number; pagado: boolean; fecha_esperada: string | null; baja_at?: string | null };

/**
 * Qué hacer con el plan de un pago cuyo primer pago se DEVOLVIÓ (lo llama cada reembolso total del lead, lib/cobros.ts).
 * Puro, con test de comportamiento (tests/cobro-etapa.test.ts: los casos de la tercera revisión de plata):
 *   · `sostiene`: algo sigue pagando ESTA compra (una cuota del plan cobrada, u otro cobro pagado del mismo producto: el
 *     pago repetido devuelto «al revés»). No se da de baja nada.
 *   · `baja`: las cuotas del plan que todavía son deuda, por id. Nunca otra cuota del trato (otra compra).
 *   · `cerrar`: no queda nada del plan para dar de baja (todo pago y devuelto, o ya de baja). Se marca cerrado, para que un
 *     reembolso de otra cosa, meses después, no vuelva a pasar por él.
 * Sin ids (un trato de antes de guardarlos): `sostiene` (el lado seguro: no se borra deuda que no se sabe de quién es).
 */
export function decidirBajaDelPlan(p: {
  cuotasPlan: readonly number[];
  cuotasDelTrato: readonly CuotaParaBajaDelPlan[];
  otroPagoDelProducto: boolean;
}): { accion: 'sostiene'; por: 'cuota' | 'otro-pago' | 'sin-ids' } | { accion: 'baja'; ids: number[] } | { accion: 'cerrar' } {
  if (p.otroPagoDelProducto) return { accion: 'sostiene', por: 'otro-pago' };
  if (!p.cuotasPlan.length) return { accion: 'sostiene', por: 'sin-ids' };
  const ids = new Set(p.cuotasPlan.map(Number));
  const delPlan = p.cuotasDelTrato.filter((q) => ids.has(Number(q.id)));
  if (delPlan.some((q) => q.pagado)) return { accion: 'sostiene', por: 'cuota' };
  const deuda = delPlan.filter((q) => !q.pagado && !q.baja_at && q.fecha_esperada != null).map((q) => Number(q.id));
  return deuda.length ? { accion: 'baja', ids: deuda } : { accion: 'cerrar' };
}
