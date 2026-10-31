// =============================================================================
// cobros-tipos — el vocabulario de la pasarela de pagos (Stripe, Mercado Pago y Creem)
// =============================================================================
// Puro y SIN `server-only` a propósito: lo importan los tests y los componentes 'use client' de la
// ficha (la lista de cobros dibuja el estado con estos rótulos). El contrato entero está en
// docs/diseno-pasarela-pagos.md.
//
// ⚠️ TRAMPA DE NOMBRE: un COBRO no es un PAGO. `pagos` (lib/pagos.ts, mig 0014) son las CUOTAS del
// CRM y `pagoId` es el id de una cuota (así lo rotula el lienzo de Automations). Un cobro es lo que
// se le pide a una pasarela (tabla `cobros`, mig 0255), y su id es `cobroId`.

export type Pasarela = 'stripe' | 'mercadopago' | 'creem';
export const PASARELAS: readonly Pasarela[] = ['stripe', 'mercadopago', 'creem'];
export const NOMBRE_PASARELA: Readonly<Record<Pasarela, string>> = { stripe: 'Stripe', mercadopago: 'Mercado Pago', creem: 'Creem' };

export const esPasarela = (v: unknown): v is Pasarela => PASARELAS.includes(v as Pasarela);

/**
 * LO QUE CADA PASARELA SABE HACER (31/10/2026, al entrar Creem). Se declara UNA vez, acá, y las decisiones se leen de
 * esta tabla.
 *
 * ⚠️ EL PORQUÉ, que es lo que importa: hasta hoy había DOS pasarelas, y todo el código preguntaba `=== 'stripe' ? A : B`.
 * Con dos valores ese ternario es correcto; con tres, la rama `B` se traga al tercero EN SILENCIO — ni el compilador ni
 * un test lo ven, porque `B` es código válido que corre contra el proveedor equivocado. La auditoría al agregar Creem
 * encontró 53 lugares así, y los peores no eran rótulos: `crearCheckout` le creaba al cobro de Creem una suscripción
 * REAL en Mercado Pago, y `cancelarSuscripcionCobro` cancelaba contra Mercado Pago, se comía el 404 («ya estaba
 * cancelada») y dejaba la base diciendo «cancelada» mientras Creem le seguía cobrando todos los meses al cliente.
 *
 * LA REGLA QUE QUEDA: una diferencia entre pasarelas NO se escribe con un ternario de dos ramas. Va como campo de esta
 * tabla (que es un `Record<Pasarela, …>` TOTAL: la pasarela #4 no compila hasta que alguien decida qué hace), o como un
 * `switch` con `default: { const _x: never = p; }`.
 */
export type CapacidadesPasarela = {
  /** La moneda en la que cobra, si es fija. null = la de su cuenta (hay que preguntársela al proveedor). */
  monedaFija: string | null;
  /** Necesita el email de quien paga para abrir una SUSCRIPCIÓN. */
  emailParaSuscripcion: boolean;
  /** Acepta diferir el PRIMER cobro al crear la suscripción (el `start_date` de Mercado Pago). */
  difiereElPrimerCobro: boolean;
  /** Hace la prueba gratis con tarjeta guardada (los días de prueba los pone el proveedor). */
  pruebaConTarjeta: boolean;
  /**
   * Sabe hacer un descuento de UN SOLO ciclo que después vuelve solo al precio lleno. false = la suscripción nace
   * rebajada y MaKo le sube el monto al entrar el primer pago (lib/primer-mes.ts).
   */
  descuentoDeUnCiclo: boolean;
  /** La baja se puede programar para el fin del período ya pagado (en vez de cortar en el acto). */
  bajaAlFinDelPeriodo: boolean;
  /** Es merchant of record: cobra y remite el impuesto de cada país, y MaKo no informa impuestos. */
  merchantOfRecord: boolean;
  /**
   * Sólo le cobra a quien está en el país de SU cuenta. Mercado Pago rechaza al de afuera («la cuenta del vendedor es de
   * otro país»); Stripe y Creem cobran en todo el mundo. Lo pregunta quien tiene que elegir una pasarela SIN saber el
   * país de quien paga, y existe porque esa pregunta se escribía `=== 'mercadopago'`: con dos pasarelas «el otro» era
   * Stripe, con tres son dos, y con cuatro no se sabe (31/10/2026).
   */
  soloEnSuPais: boolean;
};

export const CAPACIDADES_PASARELA: Readonly<Record<Pasarela, CapacidadesPasarela>> = {
  stripe: {
    monedaFija: 'USD', emailParaSuscripcion: false, difiereElPrimerCobro: false, pruebaConTarjeta: true,
    descuentoDeUnCiclo: true, bajaAlFinDelPeriodo: true, merchantOfRecord: false, soloEnSuPais: false,
  },
  mercadopago: {
    // Mercado Pago cobra en la moneda del sitio de SU cuenta (ARS, MXN…): hay que preguntarle cuál es.
    monedaFija: null, emailParaSuscripcion: true, difiereElPrimerCobro: true, pruebaConTarjeta: true,
    descuentoDeUnCiclo: false, bajaAlFinDelPeriodo: false, merchantOfRecord: false,
    // Le cobra SÓLO a quien está en el país de su cuenta: al de afuera le contesta «la cuenta del vendedor es de otro país».
    soloEnSuPais: true,
  },
  creem: {
    // Creem fija el precio del producto en USD o EUR (enum cerrado del OpenAPI). MaKo cobra en USD.
    monedaFija: 'USD',
    // El checkout precarga `customer.email`, pero no lo exige.
    emailParaSuscripcion: false,
    // ⚠️ NO está documentado ningún `start_date` al crear la suscripción. La prueba gratis se hace con
    // `trial_period_days` en el producto, que es otra cosa: no sirve para «empezá a cobrar el día X».
    difiereElPrimerCobro: false,
    pruebaConTarjeta: true,
    // `duration: 'once'` — «Applies only to the first payment», y el ejemplo de la doc es literal «50% off your first
    // month». El segundo mes vuelve al precio lleno sin que MaKo toque nada.
    descuentoDeUnCiclo: true,
    // `{ mode: 'scheduled' }` deja la suscripción activa hasta `current_period_end_date`.
    bajaAlFinDelPeriodo: true,
    merchantOfRecord: true,
    // Cobra en todo el mundo (es justamente lo que lo hace la pasarela de LatAm): no está atada al país del vendedor.
    soloEnSuPais: false,
  },
};

/** La comisión de cada pasarela, para mostrar el costo REAL de un ticket (nunca sólo el porcentaje). */
export const COMISION_PASARELA: Readonly<Record<Pasarela, { pct: number; fijoUsd: number } | null>> = {
  // Las de Stripe y Mercado Pago dependen del país y del plan comercial de cada cuenta: no se inventan.
  stripe: null,
  mercadopago: null,
  // creem.io/pricing: «3.9% + 40¢ per successful transaction». ⚠️ Y la doc de payouts aclara lo que la página de
  // precios no dice: el porcentaje pega sobre el TOTAL CON IMPUESTO, no sobre el precio (su ejemplo: US$20 + US$4 de
  // IVA → US$1,33, no US$1,18). Sobre el ticket de US$47 de MaKo el cargo fijo manda: 3,9% + 0,40 = US$2,23 = 4,74%
  // del precio, y más con el impuesto encima. Decir «3,9%» sería mentir en un ticket chico.
  creem: { pct: 3.9, fijoUsd: 0.4 },
};

/** Lo que de verdad se lleva la pasarela de un cobro, en la moneda del cobro. null = no está medida. */
export function comisionDeLaPasarela(p: Pasarela, monto: number): number | null {
  const c = COMISION_PASARELA[p];
  if (!c || !(monto > 0)) return null;
  return Math.round((monto * (c.pct / 100) + c.fijoUsd) * 100) / 100;
}

export type EstadoCobro = 'pendiente' | 'pagado' | 'fallido' | 'reembolsado' | 'anulado';
export const ESTADOS_COBRO: readonly EstadoCobro[] = ['pendiente', 'pagado', 'fallido', 'reembolsado', 'anulado'];
export type TipoCobro = 'unico' | 'suscripcion';
export type ModoCobro = 'real' | 'prueba';
export type EstadoAlta = 'pendiente' | 'hecha' | 'ya_tenia_cuenta' | 'error';

/** Una fila de `cobros`, tal como la devuelve la base (los numeric de Postgres llegan como number). */
export type Cobro = {
  id: number;
  workspace_id: number;
  /**
   * La cuenta de la pasarela que lo cobró (mig 0328, varias por proveedor): null = la principal (todo cobro de antes);
   * 'c2', 'c3'… = las demás. Releerlo, devolverlo o cancelarlo va con las claves de ESA cuenta.
   */
  cuenta: string | null;
  /**
   * El id de esa cuenta EN EL PROVEEDOR (mig 0328): `acct_…` de Stripe, `user_id` de Mercado Pago. Manda sobre `cuenta`:
   * una cuenta que se desconectó y volvió con otro sufijo sigue siendo la de este cobro. null en los cobros de antes.
   */
  cuenta_ref: string | null;
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
  'id, workspace_id, token, lead_id, pago_id, producto_id, proveedor, cuenta, cuenta_ref, modo, tipo, concepto, monto, moneda, monto_usd, email, nombre, estado, suscripcion_estado, proveedor_ref, proveedor_pago_id, proveedor_suscripcion_id, url_proveedor, url_vence_at, alta_capa, alta_ws, alta_estado, alta_motivo, alta_email_cambios, motivo, creado_por, created_at, updated_at, pagado_at, reembolsado_at';

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
