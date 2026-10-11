// =============================================================================
// cobros-tipos — el vocabulario de la pasarela de pagos (Stripe y Mercado Pago)
// =============================================================================
// Puro y SIN `server-only` a propósito: lo importan los tests y los componentes 'use client' de la
// ficha (la lista de cobros dibuja el estado con estos rótulos). El contrato entero está en
// docs/diseno-pasarela-pagos.md.
//
// ⚠️ TRAMPA DE NOMBRE: un COBRO no es un PAGO. `pagos` (lib/pagos.ts, mig 0014) son las CUOTAS del
// CRM y `pagoId` es el id de una cuota (así lo rotula el lienzo de Automations). Un cobro es lo que
// se le pide a una pasarela (tabla `cobros`, mig 0250), y su id es `cobroId`.

export type Pasarela = 'stripe' | 'mercadopago';
export const PASARELAS: readonly Pasarela[] = ['stripe', 'mercadopago'];
export const NOMBRE_PASARELA: Readonly<Record<Pasarela, string>> = { stripe: 'Stripe', mercadopago: 'Mercado Pago' };

export const esPasarela = (v: unknown): v is Pasarela => v === 'stripe' || v === 'mercadopago';

export type EstadoCobro = 'pendiente' | 'pagado' | 'fallido' | 'reembolsado' | 'anulado';
export const ESTADOS_COBRO: readonly EstadoCobro[] = ['pendiente', 'pagado', 'fallido', 'reembolsado', 'anulado'];
export type TipoCobro = 'unico' | 'suscripcion';
export type ModoCobro = 'real' | 'prueba';
export type EstadoAlta = 'pendiente' | 'hecha' | 'ya_tenia_cuenta' | 'error';

/** Una fila de `cobros`, tal como la devuelve la base (los numeric de Postgres llegan como number). */
export type Cobro = {
  id: number;
  workspace_id: number;
  token: string;
  lead_id: number | null;
  pago_id: number | null;
  producto_id: number | null;
  proveedor: Pasarela;
  modo: ModoCobro;
  tipo: TipoCobro;
  concepto: string;
  monto: number;
  moneda: string;
  monto_usd: number | null;
  email: string | null;
  nombre: string | null;
  estado: EstadoCobro;
  suscripcion_estado: 'activa' | 'cancelada' | null;
  proveedor_ref: string | null;
  proveedor_pago_id: string | null;
  proveedor_suscripcion_id: string | null;
  url_proveedor: string | null;
  url_vence_at: string | null;
  alta_capa: string | null;
  alta_ws: number | null;
  alta_estado: EstadoAlta | null;
  alta_motivo: string | null;
  alta_email_cambios: number;
  motivo: string | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
  pagado_at: string | null;
  reembolsado_at: string | null;
};

/** Las columnas de `cobros`, para los `select` (un select con una columna que no existe rechaza la consulta ENTERA). */
export const COLS_COBRO =
  'id, workspace_id, token, lead_id, pago_id, producto_id, proveedor, modo, tipo, concepto, monto, moneda, monto_usd, email, nombre, estado, suscripcion_estado, proveedor_ref, proveedor_pago_id, proveedor_suscripcion_id, url_proveedor, url_vence_at, alta_capa, alta_ws, alta_estado, alta_motivo, alta_email_cambios, motivo, creado_por, created_at, updated_at, pagado_at, reembolsado_at';

/** Lo que se le puede mostrar a cualquiera de la ficha (sin el token ni la URL del proveedor). */
export type CobroVisible = Pick<
  Cobro,
  'id' | 'lead_id' | 'proveedor' | 'modo' | 'tipo' | 'concepto' | 'monto' | 'moneda' | 'monto_usd' | 'estado' | 'suscripcion_estado' | 'created_at' | 'pagado_at' | 'reembolsado_at' | 'motivo'
> & { link: string | null };

const ROTULOS: Readonly<Record<EstadoCobro, string>> = {
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  fallido: 'Rechazado',
  reembolsado: 'Reembolsado',
  anulado: 'Anulado',
};

export const rotuloEstado = (e: EstadoCobro): string => ROTULOS[e] ?? e;

/** El formato del token público (/pagar/<token>): 32 caracteres base64url. Se valida ANTES de ir a la base. */
export const TOKEN_COBRO_RE = /^[A-Za-z0-9_-]{32}$/;
export const esTokenCobro = (t: unknown): t is string => typeof t === 'string' && TOKEN_COBRO_RE.test(t);

/** Normaliza una fila cruda de la base (los numeric pueden llegar como string según el driver). */
export function cobroDeFila(f: Record<string, unknown>): Cobro {
  const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
  return {
    ...(f as unknown as Cobro),
    id: Number(f.id),
    workspace_id: Number(f.workspace_id),
    lead_id: num(f.lead_id),
    pago_id: num(f.pago_id),
    producto_id: num(f.producto_id),
    monto: Number(f.monto),
    monto_usd: num(f.monto_usd),
    alta_ws: num(f.alta_ws),
    alta_email_cambios: Number(f.alta_email_cambios ?? 0),
  };
}
