// =============================================================================
// cobros — la pasarela de pagos (Stripe y Mercado Pago): el ÚNICO escritor de `cobros`
// =============================================================================
// Pedido de Martín (11/10/2026): «implementes end-to-end la integración con Mercado Pago y con
// Stripe, tipo pasarela de pagos... Lo voy a utilizar yo como superadmin para vender MaKo, pero
// también los usuarios pueden alojarlo». El contrato entero (vocabulario, datos, firmas, rutas) está
// en docs/diseno-pasarela-pagos.md; lo que decide sin base vive en lib/cobros-reglas.ts.
//
// QUIÉN LLAMA: la ficha del lead (app/crm/[id]/cobros-actions.ts), la API de MaKo
// (lib/api-mako/areas/cobros.run.ts), el super admin (app/admin/cobros/actions.ts), las rutas
// públicas (/pagar/<token>), los webhooks y el cron de reconciliación.
//
// ⚠️ LAS CLAVES SE LEEN CON `credDelCliente(clave, ws)` Y CON NADA MÁS. `credWs`/`credWsEstricta`
// caen a process.env cuando el ws es OWNER_WS (el 1, Mauricio, un cliente), y `envCred` resuelve
// contra el mismo ws1: cualquiera de las tres le cobraría a la cuenta equivocada. La de MaKo es la
// del workspace `wsSuperAdmin()`, guardada desde /integraciones como la de cualquier cliente.
// tests/pasarela-sin-env.test.ts lo barre.
//
// ⚠️ TODO lo que escribe corre adentro de `runWithWorkspace(ws, …)` con el ws del COBRO: un webhook,
// el cron y /pagar no tienen sesión, y sin el contexto getTenantDb/setSetting/getLead caen al ws1.

import 'server-only';
import crypto from 'node:crypto';
import { getSupabaseServer } from './supabase';
import { getTenantDb, runWithWorkspace, wsSuperAdmin } from './workspace';
import { credDelCliente } from './credenciales';
import { APP_BASE_URL, EMAIL_MAKO } from './app-url';
import { getLead, logLeadEvent, setPipelineStage } from './leads';
import { getPipelineStagesDeLead } from './funnels';
import { etapaDeGanado } from './pipeline';
import { listProductos } from './productos';
import { registrarCobroDeProveedor, desmarcarCobroDeProveedor, remarcarCobroDeProveedor } from './pagos';
import { hoyEnWorkspace } from './timezone';
import { capaDef, type CapaId } from './capas';
import { darDeAltaCliente, esCapaVendible } from './alta-cliente';
import { COLS_COBRO, NOMBRE_PASARELA, cobroDeFila, esTokenCobro, type Cobro, type EstadoAlta, type EstadoCobro, type Pasarela, type TipoCobro } from './cobros-tipos';
import { valoresDelPago } from './variables-del-lead';
import {
  avisoPagoPorLinkAnulado, codigoDeBaja, decidirCobro, esBajaPedida, textoBajaPedida, esRenovacion, finDelPlazo, idemAnular, idemBaja, idemCobro, idemReembolso, mesesTranscurridos,
  esDevolucionFallida, montoUsdDeLaCuota, montoUsdDelCobro, pasaAPagado, textoDevolucionFallida, textoPagoRegistrado, urlPorVencer, ESTADOS_QUE_PASAN_A_PAGADO,
} from './cobros-reglas';
import { formatoMonto } from './pasarela-moneda';
import { esCuotaDeBaja, esCuotaDevuelta, esRenovacionFallida, PREFIJO_RENOVACION_FALLIDA } from './cobrado-lead';
import { motivoSinDatos, type FaseContracargo } from './cobros-eventos';
import { emitirDelCatalogo } from './avisos';
import { linkResumenLead } from './lead-resumen';
import { enrolarPorPago, type SubtipoPago } from './pago-entrante';
import {
  asegurarEventosStripe, cancelarSuscripcionStripe, programarBajaStripe, crearCheckoutStripe, expirarCheckoutStripe, leerCheckoutStripe, modoDeClaveStripe, programarFinSuscripcionStripe, reembolsarStripe,
} from './stripe-api';
import { urlAvisoStripe } from './cobros-conexion';
import { buscarPagosMp, cancelarSuscripcionMp, crearPreferenciaMp, crearSuscripcionMp, instanteMp, leerCuentaMp, reembolsarMp, vencerPreferenciaMp } from './mercadopago-api';

// ─────────────────────────────────────────────────────────────────────────────
// Links y credenciales
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El link que se MANDA (WhatsApp, email, la API): /pagar/<token>, de MaKo y no del proveedor. Es
 * estable: la sesión de Stripe vence a las 24 h como mucho, y este link crea otra al abrirse
 * (`urlParaPagar`). Sin `?ws=` a propósito: lo abre un comprador sin sesión (la excepción está
 * escrita en tests/link-con-workspace.test.ts).
 */
export const linkDelCobro = (token: string): string => `${APP_BASE_URL}/pagar/${token}`;
/** Adonde vuelve la persona desde la pasarela (pagó, quedó pendiente o canceló). */
export const linkDeRetorno = (token: string): string => `${linkDelCobro(token)}/listo`;

/** 32 caracteres base64url (192 bits): el token público de /pagar/<token>. No se adivina ni se enumera. */
export const nuevoTokenCobro = (): string => crypto.randomBytes(24).toString('base64url');

type CredStripe = { pasarela: 'stripe'; key: string };
type CredMp = { pasarela: 'mercadopago'; token: string; userId: string };

async function credStripe(ws: number): Promise<CredStripe | null> {
  const [key, acct, secreto] = await Promise.all([
    credDelCliente('STRIPE_SECRET_KEY', ws),
    credDelCliente('STRIPE_ACCOUNT_ID', ws),
    credDelCliente('STRIPE_WEBHOOK_SECRET', ws),
  ]);
  // Sin la cuenta y el secreto del aviso, un cobro se crearía bien y su pago NUNCA volvería al CRM:
  // «conectado» es las tres, no la clave sola.
  return key && acct && secreto ? { pasarela: 'stripe', key } : null;
}

async function credMp(ws: number): Promise<CredMp | null> {
  const [token, userId] = await Promise.all([
    credDelCliente('MERCADOPAGO_ACCESS_TOKEN', ws),
    credDelCliente('MERCADOPAGO_USER_ID', ws),
  ]);
  return token && userId ? { pasarela: 'mercadopago', token, userId } : null;
}

/** Las pasarelas con las que ESTE workspace puede cobrar hoy (las dos, una o ninguna). */
export async function pasarelasConectadas(ws: number): Promise<Pasarela[]> {
  const [s, m] = await Promise.all([credStripe(ws), credMp(ws)]);
  return [...(s ? (['stripe'] as const) : []), ...(m ? (['mercadopago'] as const) : [])];
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecturas
// ─────────────────────────────────────────────────────────────────────────────

export async function listarCobros(ws: number, f: { leadId?: number | null; estado?: EstadoCobro | null; limite?: number } = {}): Promise<Cobro[]> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    let q = db.from('cobros').select(COLS_COBRO).order('created_at', { ascending: false }).order('id', { ascending: false });
    if (f.leadId) q = q.eq('lead_id', f.leadId);
    if (f.estado) q = q.eq('estado', f.estado);
    const { data, error } = await q.limit(Math.min(Math.max(f.limite ?? 50, 1), 200));
    if (error) throw new Error(`No pude leer los cobros: ${error.message}`);
    return (data ?? []).map((x) => cobroDeFila(x as Record<string, unknown>));
  });
}

export async function getCobro(ws: number, id: number): Promise<Cobro | null> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data, error } = await db.from('cobros').select(COLS_COBRO).eq('id', id).maybeSingle();
    if (error) throw new Error(`No pude leer el cobro ${id}: ${error.message}`);
    return data ? cobroDeFila(data as Record<string, unknown>) : null;
  });
}

/**
 * Para las rutas PÚBLICAS (/pagar/<token>): sin sesión ni workspace, con el cliente de servicio. El
 * token se valida ANTES de ir a la base (un id de 20 KB no hace una consulta).
 */
export async function getCobroPorToken(token: string): Promise<Cobro | null> {
  if (!esTokenCobro(token)) return null;
  const { data, error } = await getSupabaseServer().from('cobros').select(COLS_COBRO).eq('token', token).maybeSingle();
  if (error) throw new Error(`No pude leer el cobro: ${error.message}`);
  return data ? cobroDeFila(data as Record<string, unknown>) : null;
}

/**
 * El cobro al que se refiere un aviso de la pasarela, SIEMPRE dentro del workspace al que el aviso
 * ya fue ruteado (y verificado por firma o por relectura). Un token o una referencia de OTRO negocio
 * no aparece acá: es el corte que impide que la cuenta de un cliente marque pagado el cobro de otro.
 */
export async function cobroDelAviso(
  ws: number,
  q: { proveedor: Pasarela; token?: string | null; ref?: string | null; pagoId?: string | null; suscripcionId?: string | null },
): Promise<Cobro | null> {
  const db = getSupabaseServer();
  const base = () => db.from('cobros').select(COLS_COBRO).eq('workspace_id', ws).eq('proveedor', q.proveedor);
  const intentos: Array<() => PromiseLike<{ data: unknown; error: { message: string } | null }>> = [];
  if (q.token && esTokenCobro(q.token)) intentos.push(() => base().eq('token', q.token!).maybeSingle());
  if (q.ref) intentos.push(() => base().eq('proveedor_ref', q.ref!).maybeSingle());
  if (q.suscripcionId) intentos.push(() => base().eq('proveedor_suscripcion_id', q.suscripcionId!).limit(1).maybeSingle());
  if (q.pagoId) intentos.push(() => base().eq('proveedor_pago_id', q.pagoId!).limit(1).maybeSingle());
  for (const i of intentos) {
    const { data, error } = await i();
    if (error) throw new Error(`No pude buscar el cobro: ${error.message}`);
    if (data) return cobroDeFila(data as Record<string, unknown>);
  }
  return null;
}

/** El cobro PENDIENTE más nuevo de un lead (lo resuelve {{link_pago}}; cero proveedores). */
export async function cobroPendienteDelLead(ws: number, leadId: number): Promise<Cobro | null> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data, error } = await db.from('cobros').select(COLS_COBRO)
      .eq('lead_id', leadId).eq('estado', 'pendiente')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(`No pude leer el cobro pendiente del lead ${leadId}: ${error.message}`);
    return data ? cobroDeFila(data as Record<string, unknown>) : null;
  });
}

async function actualizar(ws: number, id: number, patch: Record<string, unknown>, soloSi?: { estado?: readonly EstadoCobro[] }): Promise<Cobro | null> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    // Todo motivo que se escribe pasa por `motivoSinDatos`: los errores de los proveedores traen pedazos de
    // claves y emails, y `motivo` lo ve cualquiera de la ficha y lo lee el modelo (revisión del 11/10/2026).
    const limpio: Record<string, unknown> = { ...patch };
    for (const k of ['motivo', 'alta_motivo'] as const) {
      if (typeof limpio[k] === 'string') limpio[k] = motivoSinDatos(limpio[k] as string).slice(0, 300);
    }
    let q = db.from('cobros').update({ ...limpio, updated_at: new Date().toISOString() }).eq('id', id);
    if (soloSi?.estado) q = q.in('estado', [...soloSi.estado]);
    const { data, error } = await q.select(COLS_COBRO).maybeSingle();
    if (error) throw new Error(`No pude actualizar el cobro ${id}: ${error.message}`);
    return data ? cobroDeFila(data as Record<string, unknown>) : null;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear
// ─────────────────────────────────────────────────────────────────────────────

export type ResultadoCrearCobro = { ok: true; cobro: Cobro; link: string; yaEstaba?: true } | { ok: false; error: string; faltan?: string[] };

type CuotaDelLink = { id: number; numero: number; monto_usd: number };

/**
 * La cuota que va a saldar un link (el «cobrar una cuota con link» del bloque `cuotas`, 14/10/2026). Se valida
 * ANTES de crear nada, adentro del workspace del cobro:
 *   · de ESTE lead (el id llega del navegador o de la API);
 *   · impaga y sin pasarela: una cobrada no se cobra dos veces, y una devuelta no es deuda;
 *   · y si ya tiene un link que todavía se puede pagar (pendiente o rechazado), se devuelve ÉSE: dos links para la
 *     misma cuota son dos cobros posibles de la misma plata.
 * Al pagarse, `aplicarPagoAprobado` → `registrarCobroDeProveedor` la marca por su id (si sigue impaga y por el
 * MISMO monto) y `marcarPago` corta su cobranza (`cerrarCorridasDeCuota`).
 */
async function cuotaParaLink(leadId: number, pagoId: number): Promise<{ ok: true; cuota: CuotaDelLink; pendiente: Cobro | null } | { ok: false; error: string }> {
  const db = await getTenantDb();
  const { data, error } = await db.from('pagos').select('id, numero, monto_usd, pagado, proveedor_pago_id, proveedor, cobro_id, fecha_esperada, baja_at').eq('id', pagoId).eq('lead_id', leadId).maybeSingle();
  if (error) return { ok: false, error: `No pude leer la cuota: ${error.message}` };
  if (!data) return { ok: false, error: 'Esa cuota no es de este lead.' };
  const q = data as { id: number; numero: number; monto_usd: number; pagado: boolean; proveedor_pago_id: string | null; proveedor: string | null; cobro_id: number | null; fecha_esperada: string | null; baja_at: string | null };
  if (q.pagado) return { ok: false, error: 'Esa cuota ya está cobrada.' };
  if (esCuotaDeBaja(q)) return { ok: false, error: 'El cliente se dio de baja: deshaz la baja para cobrarle esa cuota.' };
  if (q.proveedor_pago_id || esCuotaDevuelta(q)) return { ok: false, error: 'Esa cuota ya pasó por la pasarela.' };
  const montoUsd = Number(q.monto_usd);
  if (!Number.isFinite(montoUsd) || montoUsd <= 0) return { ok: false, error: 'Esa cuota no tiene monto.' };
  const { data: links, error: e2 } = await db.from('cobros').select(COLS_COBRO)
    .eq('lead_id', leadId).eq('pago_id', pagoId).in('estado', ['pendiente', 'fallido'])
    .order('created_at', { ascending: false }).limit(1);
  if (e2) return { ok: false, error: `No pude revisar los links de la cuota: ${e2.message}` };
  const pendiente = (links ?? [])[0] ? cobroDeFila((links as Record<string, unknown>[])[0]) : null;
  // ⚠️ UN LINK YA PAGADO CUYO PAGO TODAVÍA NO SE ASENTÓ (revisión del 16/10/2026): la cuota sigue impaga hasta que el
  // aviso se reintenta o pasa el cron, y otro link para ella era otro cobro posible de la misma plata.
  const { data: pagados, error: e3 } = await db.from('cobros').select('id').eq('lead_id', leadId).eq('pago_id', pagoId).eq('estado', 'pagado').limit(1);
  if (e3) return { ok: false, error: `No pude revisar los links de la cuota: ${e3.message}` };
  if ((pagados ?? []).length) return { ok: false, error: 'Esa cuota ya se pagó con un link: se marca sola en unos minutos.' };
  return { ok: true, cuota: { id: Number(q.id), numero: Number(q.numero), monto_usd: montoUsd }, pendiente };
}

/**
 * Crea el cobro y su checkout en la pasarela. La FILA se escribe ANTES de llamar al proveedor (con
 * `Idempotency-Key = mako-cobro-<id>`): si la función se corta entre las dos cosas, queda el rastro
 * y un reintento no crea un segundo checkout. Si el proveedor rechaza, la fila queda `anulado` con
 * el motivo (no se borra).
 */
export async function crearCobro(ws: number, p: {
  leadId: number;
  pasarela?: Pasarela | null;
  productoId?: number | null;
  pagoId?: number | null;
  concepto?: string | null;
  monto?: number | null;
  moneda?: string | null;
  montoUsd?: number | null;
  tipo?: TipoCobro | null;
  email?: string | null;
  nombre?: string | null;
  /** SÓLO la plataforma: al pagar, alta de MaKo con esta capa. En otro workspace se rechaza. */
  altaCapa?: string | null;
  creadoPor: string;
}): Promise<ResultadoCrearCobro> {
  // Un inquilino no crea inquilinos (AGENTS.md «Un permiso de UN inquilino sobre OTRO»): la pregunta
  // va por el WORKSPACE, en positivo, y se rechaza en vez de ignorarse en silencio.
  let altaCapa: CapaId | null = null;
  if (p.altaCapa) {
    const plataforma = await wsSuperAdmin();
    if (ws !== plataforma) return { ok: false, error: 'Sólo la cuenta de MaKo puede dar de alta clientes al cobrar.' };
    if (!esCapaVendible(p.altaCapa)) return { ok: false, error: 'Ese plan no se vende.' };
    altaCapa = p.altaCapa;
  }

  return runWithWorkspace(ws, async () => {
    const lead = await getLead(p.leadId);
    if (!lead) return { ok: false, error: 'No encontré ese lead en este negocio.' };

    // El link de UNA cuota: cobra esa cuota, en un pago único y sin producto (su precio es el de la cuota).
    let cuota: CuotaDelLink | null = null;
    if (p.pagoId != null) {
      if (p.productoId) return { ok: false, error: 'El link de una cuota cobra la cuota: sin producto.' };
      if (p.tipo === 'suscripcion') return { ok: false, error: 'Una cuota se cobra con un pago único, no con una suscripción.' };
      if (altaCapa) return { ok: false, error: 'El link de una cuota no da de alta una cuenta.' };
      const v = await cuotaParaLink(lead.id, p.pagoId);
      if (!v.ok) return { ok: false, error: v.error };
      if (v.pendiente) return { ok: true, cobro: v.pendiente, link: linkDelCobro(v.pendiente.token), yaEstaba: true };
      cuota = v.cuota;
    }

    const [stripe, mp] = await Promise.all([credStripe(ws), credMp(ws)]);
    const conectadas: Pasarela[] = [...(stripe ? (['stripe'] as const) : []), ...(mp ? (['mercadopago'] as const) : [])];

    let producto: { id: number; nombre: string; tipo: TipoCobro; monto_usd: number | null } | null = null;
    if (p.productoId) {
      const prod = (await listProductos(true)).find((x) => x.id === p.productoId);
      if (!prod) return { ok: false, error: 'Ese producto no está activo en el catálogo.' };
      producto = { id: prod.id, nombre: prod.nombre, tipo: prod.tipo === 'suscripcion' ? 'suscripcion' : 'unico', monto_usd: prod.monto_usd };
    }
    const tipo: TipoCobro = p.tipo ?? producto?.tipo ?? 'unico';
    const email = (p.email ?? lead.email ?? '').trim().toLowerCase() || null;
    const nombre = (p.nombre ?? lead.nombre ?? '').trim() || null;
    if (altaCapa && !email) return { ok: false, error: 'Para dar de alta la cuenta hace falta el email de quien paga.', faltan: ['email'] };

    // Mercado Pago cobra en la moneda del sitio de SU cuenta: se le pregunta a la cuenta, no a una constante.
    const elegida = p.pasarela ?? (conectadas.length === 1 ? conectadas[0] : null);
    let cuentaMp: { moneda: string | null; modo: 'real' | 'prueba' } | null = null;
    if (elegida === 'mercadopago' && mp) {
      const c = await leerCuentaMp(mp.token);
      if (!c.ok) return { ok: false, error: `Mercado Pago: ${c.error}` };
      cuentaMp = { moneda: c.moneda, modo: c.modo };
    }

    const d = decidirCobro({
      pasarela: p.pasarela ?? null, conectadas, monto: p.monto, moneda: p.moneda,
      productoMontoUsd: cuota?.monto_usd ?? producto?.monto_usd ?? null, monedaDeLaCuenta: cuentaMp?.moneda ?? null, tipo, email,
    });
    if (!d.ok) return d;
    // ⚠️ EL VALOR EN DÓLARES DE UN LINK DE CUOTA ES EL DE LA CUOTA, no uno declarado aparte: al pagarse la marca
    // pagada por su monto (`registrarCobroDeProveedor` exige que coincidan). En dólares, el link cobra exactamente
    // la cuota; en otra moneda, la persona dice cuánto es en esa moneda y la cuota pone los dólares.
    if (cuota && d.moneda === 'USD' && Math.abs(d.monto - cuota.monto_usd) >= 0.01) {
      return { ok: false, error: `El link de esta cuota cobra US$ ${cuota.monto_usd}. Para otro monto, edita la cuota primero.`, faltan: ['monto'] };
    }

    const montoUsd = cuota ? cuota.monto_usd : montoUsdDelCobro({ monto: d.monto, moneda: d.moneda, montoUsdDeclarado: p.montoUsd, productoMontoUsd: producto?.monto_usd });
    // Sin valor en USD el pago no podría asentarse en el CRM (pagos.monto_usd es NOT NULL) y el CRON «Pagos»
    // saldría sin `fecha_primer_pago`: se pide antes de crear el link, no después de cobrar.
    if (montoUsd == null) return { ok: false, error: `¿Cuánto es en dólares? Hace falta para tus reportes (se cobra en ${d.moneda}).`, faltan: ['montoUsd'] };
    const concepto = (p.concepto ?? '').trim() || (cuota ? (cuota.numero === 0 ? 'Cobro inicial' : `Cuota ${cuota.numero}`) : '') || producto?.nombre || (altaCapa ? `MaKo · plan ${capaDef(altaCapa).nombre}` : 'Pago');
    const modo = d.pasarela === 'stripe' ? (modoDeClaveStripe(stripe?.key) ?? 'real') : (cuentaMp?.modo ?? 'real');
    const token = nuevoTokenCobro();

    const db = await getTenantDb();
    const { data: fila, error } = await db.from('cobros').insert({
      token, lead_id: lead.id, pago_id: cuota?.id ?? null, producto_id: producto?.id ?? null,
      proveedor: d.pasarela, modo, tipo, concepto: concepto.slice(0, 200), monto: d.monto, moneda: d.moneda,
      monto_usd: montoUsd, email, nombre: nombre?.slice(0, 200) ?? null, estado: 'pendiente',
      alta_capa: altaCapa, creado_por: p.creadoPor,
    }).select(COLS_COBRO).single();
    // ⚠️ DOS PEDIDOS A LA VEZ PARA LA MISMA CUOTA (mig 0295): el segundo choca con `cobros_un_link_vivo_por_cuota` y
    // se devuelve el link que ganó, como cuando ya existía (`yaEstaba`). Dos links vivos eran dos cobros de la misma plata.
    if (error && cuota && error.code === '23505' && /cobros_un_link_vivo_por_cuota/.test(error.message ?? '')) {
      const otra = await cuotaParaLink(lead.id, cuota.id);
      if (otra.ok && otra.pendiente) return { ok: true, cobro: otra.pendiente, link: linkDelCobro(otra.pendiente.token), yaEstaba: true };
    }
    if (error || !fila) return { ok: false, error: `No pude guardar el cobro: ${error?.message ?? 'sin respuesta'}` };
    const cobro = cobroDeFila(fila as Record<string, unknown>);

    const checkout = await crearCheckout(cobro, { stripe, mp }, 0);
    if (!checkout.ok) {
      await actualizar(ws, cobro.id, { estado: 'anulado', motivo: checkout.error.slice(0, 300) });
      return { ok: false, error: motivoSinDatos(`${NOMBRE_PASARELA[d.pasarela]}: ${checkout.error}`) };
    }
    const listo = await actualizar(ws, cobro.id, {
      proveedor_ref: checkout.ref, url_proveedor: checkout.url, url_vence_at: checkout.venceAt,
    });
    await logLeadEvent(lead.id, 'Link de pago', `${concepto}: ${formatoMonto(d.monto, d.moneda)} por ${NOMBRE_PASARELA[d.pasarela]}${modo === 'prueba' ? ' (prueba)' : ''}`, p.creadoPor);
    return { ok: true, cobro: listo ?? cobro, link: linkDelCobro(cobro.token) };
  });
}

/**
 * El PLAZO de una suscripción (15/10/2026): los meses del producto del catálogo, si tiene (`suscripcion_meses`). Sin
 * producto, o indefinido, null: se cobra hasta que alguien la cancele. Se lee del producto aunque esté inactivo.
 */
async function plazoDelCobro(c: Cobro): Promise<number | null> {
  if (c.tipo !== 'suscripcion' || !c.producto_id) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from('productos').select('suscripcion_meses').eq('id', c.producto_id).maybeSingle();
  if (error) throw new Error(`No pude leer el plazo del producto ${c.producto_id}: ${error.message}`);
  const n = Number((data as { suscripcion_meses: number | null } | null)?.suscripcion_meses);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function crearCheckout(
  c: Cobro,
  cred: { stripe: CredStripe | null; mp: CredMp | null },
  vuelta: number,
): Promise<{ ok: true; ref: string; url: string; venceAt: string | null } | { ok: false; error: string }> {
  if (c.proveedor === 'stripe') {
    if (!cred.stripe) return { ok: false, error: 'Stripe no está conectado.' };
    const r = await crearCheckoutStripe(cred.stripe.key, {
      idem: idemCobro(c.id, vuelta), tipo: c.tipo, concepto: c.concepto, monto: c.monto, moneda: c.moneda,
      email: c.email, token: c.token, ws: c.workspace_id, cobroId: c.id,
      successUrl: linkDeRetorno(c.token), cancelUrl: `${linkDeRetorno(c.token)}?cancelado=1`,
    });
    return r.ok ? { ok: true, ref: r.id, url: r.url, venceAt: r.venceAt } : { ok: false, error: r.error };
  }
  if (!cred.mp) return { ok: false, error: 'Mercado Pago no está conectado.' };
  if (c.tipo === 'suscripcion') {
    if (!c.email) return { ok: false, error: 'Falta el email de quien paga.' };
    // El PLAZO del producto (15/10/2026): la suscripción nace con fin. Un día ANTES del fin del período N, porque MP cobra
    // desde que la persona la autoriza: si lo hace tarde, se pierde la última mensualidad en vez de cobrar una de más.
    // Sin poder leer el plazo NO se crea: una suscripción sin fin es justo lo que esto evita.
    const meses = await plazoDelCobro(c).catch(() => undefined);
    if (meses === undefined) return { ok: false, error: 'No pude leer el plazo del producto.' };
    const r = await crearSuscripcionMp(cred.mp.token, {
      idem: idemCobro(c.id, vuelta), concepto: c.concepto, monto: c.monto, moneda: c.moneda, email: c.email,
      token: c.token, volverUrl: linkDeRetorno(c.token), finAt: meses ? instanteMp(finDelPlazo(Date.now(), meses) - 86_400_000) : null,
    });
    return r.ok ? { ok: true, ref: r.id, url: r.url, venceAt: null } : { ok: false, error: r.error };
  }
  const r = await crearPreferenciaMp(cred.mp.token, {
    idem: idemCobro(c.id, vuelta), concepto: c.concepto, monto: c.monto, moneda: c.moneda, email: c.email,
    token: c.token,
    // El aviso de ESTE cobro lleva el user_id de la cuenta: rutea aunque el cuerpo no lo traiga. Va
    // bajo /api/, así que puede armarse con APP_BASE_URL (tests/link-con-workspace.test.ts).
    notificationUrl: `${APP_BASE_URL}/api/webhooks/mercadopago?u=${encodeURIComponent(cred.mp.userId)}`,
    volverUrl: linkDeRetorno(c.token),
  });
  return r.ok ? { ok: true, ref: r.id, url: r.url, venceAt: null } : { ok: false, error: r.error };
}

/**
 * La URL VIVA del checkout, para /pagar/<token>. La de Stripe vence: si le quedan menos de 5 minutos
 * (o ya venció), crea otra sesión — con una clave de idempotencia atada al vencimiento anterior, así
 * dos clics simultáneos sobre un link vencido no crean dos sesiones.
 */
export async function urlParaPagar(c: Cobro): Promise<{ url: string } | { error: 'ya_pagado' | 'no_disponible' | 'pasarela'; detalle?: string }> {
  if (c.estado === 'pagado') return { error: 'ya_pagado' };
  if (c.estado !== 'pendiente' && c.estado !== 'fallido') return { error: 'no_disponible' };
  if (c.proveedor === 'mercadopago') return c.url_proveedor ? { url: c.url_proveedor } : { error: 'no_disponible' };
  if (c.url_proveedor && !urlPorVencer(c.url_vence_at, Date.now())) return { url: c.url_proveedor };
  const stripe = await credStripe(c.workspace_id);
  if (!stripe) return { error: 'pasarela', detalle: 'Stripe ya no está conectado en este negocio.' };
  const vuelta = Math.max(1, Math.floor((Date.parse(c.url_vence_at ?? '') || 0) / 60_000));
  const r = await crearCheckout(c, { stripe, mp: null }, vuelta);
  if (!r.ok) return { error: 'pasarela', detalle: r.error };
  await actualizar(c.workspace_id, c.id, { proveedor_ref: r.ref, url_proveedor: r.url, url_vence_at: r.venceAt }, { estado: ['pendiente', 'fallido'] });
  return { url: r.url };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que confirma la pasarela (webhook y cron). Idempotente y AUTO-REPARABLE: cada paso mira su
// propio estado, así que un aviso repetido no duplica nada y uno que llega después de una corrida
// cortada a la mitad completa lo que faltó.
// ─────────────────────────────────────────────────────────────────────────────

export async function aplicarPagoAprobado(c: Cobro, p: {
  proveedorPagoId: string;
  monto?: number | null;
  moneda?: string | null;
  suscripcionId?: string | null;
  autor?: string;
  /** Cuándo se PAGÓ, según la pasarela (15/10/2026): la cuota lleva esa fecha y no la de hoy. Sin ella, hoy. */
  pagadoAt?: string | null;
}): Promise<{ nuevo: boolean; renovacion: boolean }> {
  const ws = c.workspace_id;
  const autor = p.autor ?? NOMBRE_PASARELA[c.proveedor];
  return runWithWorkspace(ws, async () => {
    // 1. La transición, con compare-and-set: de dos avisos simultáneos, uno solo la gana. Un link ANULADO que igual se
    //    pagó entra con el aviso en el `motivo` (ver 4b), no con el motivo borrado.
    let actual = c;
    let nuevo = false;
    const porLinkAnulado = c.estado === 'anulado';
    if (pasaAPagado(c.estado)) {
      const ganada = await actualizar(ws, c.id, {
        estado: 'pagado', pagado_at: new Date().toISOString(), proveedor_pago_id: p.proveedorPagoId,
        motivo: porLinkAnulado ? avisoPagoPorLinkAnulado(false) : null,
        ...(p.suscripcionId ? { proveedor_suscripcion_id: p.suscripcionId, suscripcion_estado: 'activa' } : {}),
      }, { estado: ESTADOS_QUE_PASAN_A_PAGADO });
      if (ganada) { actual = ganada; nuevo = true; }
      else actual = (await getCobro(ws, c.id)) ?? c;
    }
    // Un «aprobado» del pago que se DEVOLVIÓ es una reentrega vieja. Pero la RENOVACIÓN de una suscripción cuyo
    // primer pago se reembolsó sigue siendo plata que entra (revisión del 11/10/2026: se perdía).
    if (actual.estado === 'reembolsado' && (!actual.proveedor_pago_id || actual.proveedor_pago_id === p.proveedorPagoId)) {
      return { nuevo: false, renovacion: false };
    }
    if (!actual.proveedor_suscripcion_id && p.suscripcionId) {
      actual = (await actualizar(ws, c.id, { proveedor_suscripcion_id: p.suscripcionId, suscripcion_estado: 'activa' })) ?? actual;
    }
    const renovacion = esRenovacion(actual, p.proveedorPagoId);
    // ⚠️ LA FECHA DE LA CUOTA ES LA DEL PAGO, no la de hoy (15/10/2026): un aviso reintentado, o el cron que repara días
    // después, asentaba la cuota el día que la procesó, y un pago del 31 caía en el mes siguiente del cash.
    const cuando = p.pagadoAt ? Date.parse(p.pagadoAt) : NaN;
    const fecha = await hoyEnWorkspace(Number.isFinite(cuando) ? new Date(cuando) : new Date());
    const prueba = actual.modo === 'prueba';
    // ⚠️ UNA RENOVACIÓN QUE ENTRA BORRA EL RECHAZO DE LA ANTERIOR (14/10/2026). El cobro de una suscripción ya
    // está «Pagado», así que el paso 1 no lo vuelve a tocar y el `motivo` del rechazo quedaba para siempre: la
    // ficha la pintaba «Falló la renovación» después de que la tarjeta volvió a pasar. Sólo ese motivo: otro (un
    // pago que no se pudo asentar) lo sigue diciendo hasta que alguien lo resuelva.
    if (renovacion && esRenovacionFallida(actual.motivo)) {
      actual = (await actualizar(ws, c.id, { motivo: null })) ?? actual;
    }

    // 2. El CRM: la cuota. Idempotente por (workspace, proveedor, proveedor_pago_id).
    let cuotaNueva = false;
    let cuotaAsentada = false;
    if (actual.lead_id) {
      const montoUsd = renovacion
        ? montoUsdDeLaCuota({ montoCuota: p.monto, monedaCuota: p.moneda ?? actual.moneda, cobroMontoUsd: actual.monto_usd })
        : actual.monto_usd;
      if (montoUsd == null) {
        // Sin valor en dólares no hay cuota (pagos.monto_usd es NOT NULL y nunca se inventa una tasa).
        // El cobro igual queda pagado y lo dice.
        await actualizar(ws, c.id, { motivo: `Pagado en ${actual.moneda} sin valor en USD: no entra al cash del CRM.` });
      } else {
        try {
          const r = await registrarCobroDeProveedor({
            leadId: actual.lead_id, cobroId: actual.id, pagoId: renovacion ? null : actual.pago_id,
            proveedor: actual.proveedor, proveedorPagoId: p.proveedorPagoId, montoUsd,
            montoOriginal: renovacion && p.monto ? p.monto : actual.monto, moneda: (renovacion && p.moneda) || actual.moneda, fechaPago: fecha,
          });
          cuotaNueva = !r.yaEstaba;
          cuotaAsentada = true;
        } catch (e) {
          // Que falle el CRM no deshace el cobro (la plata entró): queda escrito y el próximo aviso
          // o el cron lo completan, porque este paso es idempotente.
          await actualizar(ws, c.id, { motivo: `El pago entró pero no pude asentarlo en el CRM: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) });
          throw e;
        }
      }
    }

    // 2a. ⚠️ EL PLAZO de un producto con fin (15/10/2026). En Stripe se programa ACÁ (Checkout no acepta un fin); en Mercado
    //     Pago nació con él. Y el lead que se GANA con este pago lo lleva (su `fecha_cierre` es hoy), así el MRR deja de
    //     contarla cuando se cumple. Hasta este día un producto «6 meses» se cobraba para siempre. Best effort: la plata
    //     ya entró; si falla, queda dicho (en el cobro, o en el log si no se pudo ni leer el plazo).
    const plazo = actual.tipo === 'suscripcion' && nuevo && !renovacion
      ? await plazoDelCobro(actual).catch((e) => { console.error(`[cobros] no pude leer el plazo del cobro ${c.id}:`, e instanceof Error ? e.message : String(e)); return null; })
      : null;
    if (plazo && actual.proveedor === 'stripe' && actual.proveedor_suscripcion_id) actual = await programarPlazoStripe(actual, plazo);

    // 2b. Una suscripción NUEVA de la pasarela sobre un lead que ya era suscripción: la cancelada o con plazo vuelve a
    //     activa y sin fin (`reabrirSuscripcionDelLead`). Va antes de ganar, que no la toca si el lead ya ganó.
    if (actual.lead_id && actual.tipo === 'suscripcion' && nuevo && !renovacion) await reabrirSuscripcionDelLead(actual, autor);

    // 3. Ganar el lead (sólo si no está ganado): por setPipelineStage y la etapa de SU embudo,
    //    nunca escribiendo estado_lead a mano (tests/crm-curso-al-ganar.test.ts). Esto es lo que
    //    evita que el CRM automático le escriba «no agendaste» a quien pagó (docs/proyeccion-04oct.md §4.6).
    if (actual.lead_id) await ganarLead(actual, autor, plazo);

    // 4. El historial: una línea por cuota nueva, firmada por la pasarela.
    if (actual.lead_id && cuotaNueva) {
      await logLeadEvent(actual.lead_id, 'Pago registrado', textoPagoRegistrado({
        concepto: actual.concepto, monto: renovacion && p.monto ? p.monto : actual.monto, moneda: (renovacion && p.moneda) || actual.moneda,
        montoUsd: actual.monto_usd, pasarela: actual.proveedor, prueba, renovacion,
      }), autor);
    }

    // 4b. ⚠️ UN PAGO POR UN LINK ANULADO (15/10/2026): la plata entró y se registró arriba, pero se DICE, en el cobro y
    //     en el historial. Si la cuota del link ya estaba cobrada por otro lado, el pago entró como otra cuota: la plata
    //     entró dos veces. Antes entraba como una cuota cobrada más y nadie se enteraba. Sólo la corrida que ganó la
    //     transición (`nuevo`): un reintento no repite el aviso.
    if (porLinkAnulado && nuevo) {
      const dosVeces = !!actual.pago_id && await cuotaCobradaPorOtroLado(actual.pago_id, p.proveedorPagoId);
      const aviso = avisoPagoPorLinkAnulado(dosVeces);
      if (dosVeces) actual = (await actualizar(ws, c.id, { motivo: aviso })) ?? actual;
      if (actual.lead_id) await logLeadEvent(actual.lead_id, 'Pago por un link anulado', aviso, autor);
    }

    // 5. La plataforma: el alta automática de MaKo (decisión de Martín, 11/10/2026).
    await altaSiCorresponde(actual);

    // 6. Automations, DESPUÉS del CRM (con `fecha_primer_pago` ya escrita, el WhatsApp al lead sale solo y no
    //    como borrador, y la condición «Pagó» da bien): el aviso «Entró un pago» al grupo del equipo (un Evento
    //    de MaKo: sale sólo si el negocio agregó «Aviso de pago recibido» de la galería) y el CRON «Pagos» del
    //    lead. ⚠️ Atado a que la cuota ESTÉ, no a que ESTE intento la haya escrito (revisión del 11/10/2026): si
    //    un intento la insertó y se cortó antes de avisar, el reintento la encuentra «ya estaba» y antes no
    //    avisaba nunca. Repetir es seguro: el aviso deduplica por el pago del proveedor (3 días, lo que reintenta
    //    Stripe; un evento ya PROCESADO no vuelve a entrar por `pasarela_eventos`) y la inscripción es única.
    if (actual.lead_id && (nuevo || cuotaAsentada)) {
      await avisarPagoRecibido(actual, { proveedorPagoId: p.proveedorPagoId, renovacion, monto: renovacion && p.monto ? p.monto : actual.monto, moneda: (renovacion && p.moneda) || actual.moneda });
      await alCron(actual, 'aprobado');
    }

    return { nuevo, renovacion };
  });
}

/** ¿La cuota de un link ya estaba cobrada por OTRO pago (a mano, u otro link)? Si no se puede leer, se dice el aviso genérico. */
async function cuotaCobradaPorOtroLado(pagoId: number, proveedorPagoId: string): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db.from('pagos').select('pagado, proveedor_pago_id').eq('id', pagoId).maybeSingle();
  if (error || !data) return false;
  const q = data as { pagado: boolean | null; proveedor_pago_id: string | null };
  return !!q.pagado && q.proveedor_pago_id !== proveedorPagoId;
}

/**
 * El aviso «Entró un pago» (pago-recibido, un Evento de MaKo: `pago_recibido`). El texto lo arma el código
 * (`textoDelCodigo` en el catálogo). Dedup por el pago del proveedor: Stripe y Mercado Pago reentregan.
 * Nunca tumba la aplicación del pago: la plata ya está asentada.
 */
async function avisarPagoRecibido(c: Cobro, p: { proveedorPagoId: string; renovacion: boolean; monto: number; moneda: string }): Promise<void> {
  if (!c.lead_id) return;
  try {
    const lead = await getLead(c.lead_id);
    const nombre = lead?.nombre || c.nombre || 'Un cliente';
    const prueba = c.modo === 'prueba' ? ' — es un pago de PRUEBA' : '';
    const que = p.renovacion ? `renovó *${c.concepto}*` : `pagó *${formatoMonto(p.monto, p.moneda)}*`;
    const detalle = p.renovacion ? ` (${formatoMonto(p.monto, p.moneda)})` : ` (${c.concepto})`;
    // UNA lectura del alta para las dos salidas: el renglón del texto de siempre y el dato `{{pago_alta}}`.
    const alta = await estadoDelAlta(c);
    const cuenta = lineaDelAlta(c, alta);
    await emitirDelCatalogo('pago-recibido', {
      ws: c.workspace_id,
      dedupTtlMin: 4320,
      dedupKey: `${c.proveedor}:${p.proveedorPagoId}`,
      // El texto de siempre se queda por compatibilidad (`{{mensaje_mako}}` de las filas vivas, hasta la limpieza:
      // docs/diseno-undecima-tanda.md §8.7). Lo que se CITA son los datos de abajo.
      texto: `💰 *Entró un pago*: ${nombre} ${que} por ${NOMBRE_PASARELA[c.proveedor]}${detalle}${prueba}.${cuenta}\n\n👉 Mira su ficha:\n${linkResumenLead(c.lead_id, c.workspace_id)}\n\n— MaKo`,
      lead: { id: c.lead_id, nombre },
      // LOS DATOS DEL PAGO (undécima tanda, 11/10/2026, punto 4): `{{pago_monto}}`, `{{pago_concepto}}`… por
      // CÓDIGO, como la cobranza pasa los de la cuota. Un monto que pasa por un modelo deja de ser exacto.
      datos: valoresDelPago({
        monto: p.monto, moneda: p.moneda, concepto: c.concepto, proveedor: c.proveedor,
        renovacion: p.renovacion, modo: c.modo, alta,
      }),
    });
  } catch (e) {
    console.error(`[cobros] no pude avisar el pago del cobro ${c.id}:`, e instanceof Error ? e.message : String(e));
  }
}

/** En una venta de MaKo, cómo quedó el alta (relee el cobro: el alta corre al lado del pago). null fuera de una venta de MaKo. */
async function estadoDelAlta(c: Cobro): Promise<EstadoAlta | null> {
  if (!c.alta_capa) return null;
  const fresco = await getCobro(c.workspace_id, c.id).catch(() => null);
  return fresco?.alta_estado ?? c.alta_estado;
}

/** En una venta de MaKo, cómo quedó el alta (para el aviso al super admin), con lo que leyó `estadoDelAlta`. */
function lineaDelAlta(c: Cobro, estado: EstadoAlta | null): string {
  if (!c.alta_capa) return '';
  if (estado === 'hecha') return ` Su cuenta de MaKo (plan ${capaDef(c.alta_capa).nombre}) ya está creada y le llegó el acceso.`;
  if (estado === 'ya_tenia_cuenta') return ' Ese email ya tenía una cuenta de MaKo: el plan NO se cambió solo, revísalo en /admin/cobros.';
  if (estado === 'error') return ' ⚠️ El alta de su cuenta falló: revísalo en /admin/cobros.';
  return '';
}

/** El CRON «Pagos» del lead (lib/pago-entrante.ts). Nunca tumba lo que ya se asentó. */
async function alCron(c: Cobro, subtipo: SubtipoPago): Promise<void> {
  if (!c.lead_id) return;
  try {
    await enrolarPorPago(c.lead_id, subtipo);
  } catch (e) {
    console.error(`[cobros] no pude disparar el CRON «Pagos» (${subtipo}) del cobro ${c.id}:`, e instanceof Error ? e.message : String(e));
  }
}

/** Programa el fin del plazo en Stripe (`programarFinSuscripcionStripe`). Nunca tira: la plata ya entró. Si falla, lo dice el cobro. */
async function programarPlazoStripe(c: Cobro, meses: number): Promise<Cobro> {
  try {
    const stripe = await credStripe(c.workspace_id);
    const r = stripe && c.proveedor_suscripcion_id ? await programarFinSuscripcionStripe(stripe.key, c.proveedor_suscripcion_id, meses) : null;
    if (r?.ok) return c;
    const por = r && !r.ok ? r.error : 'Stripe no está conectado';
    console.error(`[cobros] no pude programar el fin del plazo del cobro ${c.id}: ${por}`);
    return (await actualizar(c.workspace_id, c.id, { motivo: `No pude programar en Stripe el fin de los ${meses} meses: cancélala a mano al cumplirse (${por}).` })) ?? c;
  } catch (e) {
    console.error(`[cobros] no pude programar el fin del plazo del cobro ${c.id}:`, e instanceof Error ? e.message : String(e));
    return c;
  }
}

/**
 * ⚠️ UNA SUSCRIPCIÓN NUEVA POR LA PASARELA REABRE LA DEL LEAD (revisión del 14/10/2026). Una manual cancelada en marzo,
 * y el cliente vuelve en octubre pagando un link de suscripción: `ganarLead` no corre (el lead ya estaba ganado), así
 * que `suscripcion_cancelada_at` y el plazo congelado (los meses transcurridos al cancelar, también los de una baja
 * de la pasarela) quedaban: la ficha decía «Cancelada» y el MRR no la contaba mientras Stripe cobraba todos los meses.
 * Una de la pasarela es sin fin (`suscripcion_meses` null) y su mensualidad es la del cobro: aunque su producto tenga
 * plazo, el plazo del LEAD se cuenta desde su `fecha_cierre` (la de hace meses) y la daría por vencida antes de tiempo. El
 * fin lo marca la pasarela al cancelarla (`aplicarSuscripcionCancelada`). No tira: la plata ya
 * entró; si falla queda dicho en los logs (sin la migración 0292, el select de la columna falla y no se toca nada).
 */
async function reabrirSuscripcionDelLead(c: Cobro, autor: string): Promise<void> {
  if (!c.lead_id) return;
  try {
    const db = await getTenantDb();
    const { data: fila, error: eLeer } = await db.from('leads').select('venta_tipo, suscripcion_meses, suscripcion_cancelada_at').eq('id', c.lead_id).maybeSingle();
    if (eLeer) { console.error(`[cobros] no pude leer la suscripción del lead ${c.lead_id}: ${eLeer.message}`); return; }
    const f = fila as { venta_tipo: string | null; suscripcion_meses: number | null; suscripcion_cancelada_at: string | null } | null;
    if (!f || f.venta_tipo !== 'suscripcion' || (f.suscripcion_meses == null && !f.suscripcion_cancelada_at)) return;
    const { error } = await db.from('leads').update({
      suscripcion_cancelada_at: null, suscripcion_meses_antes: null, suscripcion_meses: null,
      ...(c.monto_usd != null ? { suscripcion_monto_usd: c.monto_usd } : {}),
    }).eq('id', c.lead_id).eq('venta_tipo', 'suscripcion');
    if (error) { console.error(`[cobros] no pude reabrir la suscripción del lead ${c.lead_id}: ${error.message}`); return; }
    await logLeadEvent(c.lead_id, 'Suscripción', `Activa otra vez: la cobra ${NOMBRE_PASARELA[c.proveedor]} (${c.concepto})`, autor);
  } catch (e) {
    console.error(`[cobros] reabrir la suscripción del lead ${c.lead_id}:`, e instanceof Error ? e.message : String(e));
  }
}

async function ganarLead(c: Cobro, autor: string, plazo: number | null = null): Promise<void> {
  if (!c.lead_id) return;
  const lead = await getLead(c.lead_id);
  if (!lead || lead.estado_lead === 'ganado') return;
  try {
    // La suscripción se escribe ANTES de mover (como el wizard Ganado, app/crm/actions.ts): una
    // suscripción NO tiene monto_cierre_usd, su plata es suscripcion_monto_usd (lib/venta-tipo.ts).
    if (c.tipo === 'suscripcion' && c.monto_usd != null) {
      const db = await getTenantDb();
      const { error } = await db.from('leads').update({ venta_tipo: 'suscripcion', suscripcion_monto_usd: c.monto_usd, suscripcion_meses: plazo }).eq('id', lead.id);
      if (error) console.error(`[cobros] no pude marcar la suscripción del lead ${lead.id}: ${error.message}`);
    }
    const etapa = etapaDeGanado(await getPipelineStagesDeLead(lead));
    if (!etapa) {
      await logLeadEvent(lead.id, 'Pago registrado', `Pagó, pero su embudo no tiene una etapa de venta: quedó donde estaba.`, autor);
      return;
    }
    await setPipelineStage(lead.id, etapa, {
      autor,
      monto: c.tipo === 'unico' ? c.monto_usd : null,
      requisitos: { omitir: `Pago confirmado por ${NOMBRE_PASARELA[c.proveedor]}` },
    });
  } catch (e) {
    // Mover nunca puede tumbar el registro del pago: queda dicho en el cobro y en los logs.
    console.error(`[cobros] no pude pasar a Ganado el lead ${lead.id}:`, e instanceof Error ? e.message : String(e));
    await actualizar(c.workspace_id, c.id, { motivo: `Pagado, pero no pude pasarlo a Ganado: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) });
  }
}

/**
 * El alta automática de un plan de MaKo. Corre SÓLO si el cobro es del workspace de la plataforma
 * (escrito en POSITIVO: un cliente que conecta su Stripe y vende NO crea inquilinos en MaKo, aunque
 * su fila trajera `alta_capa`) y está pagado. Se RECLAMA antes de crear (`alta_estado` null|error →
 * pendiente, compare-and-set): dos avisos simultáneos no dan dos altas. Un `pendiente` de hace más
 * de 10 minutos es una corrida que se murió, y se puede volver a reclamar.
 */
async function altaSiCorresponde(c: Cobro): Promise<void> {
  if (!c.alta_capa || c.estado !== 'pagado') return;
  if (c.alta_estado === 'hecha' || c.alta_estado === 'ya_tenia_cuenta') return;
  const plataforma = await wsSuperAdmin();
  if (c.workspace_id !== plataforma) return;
  if (!c.email) {
    await actualizar(c.workspace_id, c.id, { alta_estado: 'error', alta_motivo: 'Falta el email de quien pagó.' });
    return;
  }
  const hace10 = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: reclamo, error } = await getSupabaseServer().from('cobros')
    .update({ alta_estado: 'pendiente', updated_at: new Date().toISOString() })
    .eq('id', c.id).eq('workspace_id', plataforma)
    .or(`alta_estado.is.null,alta_estado.eq.error,and(alta_estado.eq.pendiente,updated_at.lt.${hace10})`)
    .select('id').maybeSingle();
  if (error) throw new Error(`No pude reclamar el alta del cobro ${c.id}: ${error.message}`);
  if (!reclamo) return; // otro aviso la está haciendo, o ya la hizo

  const r = await darDeAltaCliente({
    nombre: c.nombre || c.email.split('@')[0],
    capa: c.alta_capa,
    adminEmail: c.email,
    adminNombre: c.nombre,
    invitadoPor: `pago:${c.proveedor}`,
  });
  if (r.ok) {
    await actualizar(plataforma, c.id, { alta_estado: 'hecha', alta_ws: r.workspace.id, alta_motivo: r.invitacion.enviado ? null : `El mail de acceso no salió: ${r.invitacion.error ?? 'sin detalle'}`.slice(0, 300) });
    // El lead del comprador (en el CRM de la plataforma) apunta a su cuenta: así lo lista Customer
    // Success (molde: crearCuentaMakoAction, app/customer-success/actions.ts).
    if (c.lead_id) {
      const db = await getTenantDb();
      const { error: e2 } = await db.from('leads').update({ cliente_ws: r.workspace.id }).eq('id', c.lead_id);
      if (e2) console.error(`[cobros] no pude atar el lead ${c.lead_id} a su cuenta ${r.workspace.id}: ${e2.message}`);
      await logLeadEvent(c.lead_id, 'Cuenta de MaKo', `Alta automática por el pago: «${r.workspace.nombre}», plan ${capaDef(c.alta_capa).nombre}`, NOMBRE_PASARELA[c.proveedor]);
    }
  } else if (r.yaExiste) {
    // Ya es usuario (un upgrade, o alguien de otro negocio): NO se le toca la capa a ciegas. Lo
    // resuelve una persona desde /admin/cobros.
    await actualizar(plataforma, c.id, { alta_estado: 'ya_tenia_cuenta', alta_motivo: 'Ese email ya tiene una cuenta de MaKo: el plan no se cambió solo.' });
  } else {
    await actualizar(plataforma, c.id, { alta_estado: 'error', alta_motivo: r.error.slice(0, 300) });
  }
}

/** Un pago rechazado. Un cobro ya pagado NO vuelve atrás: es la renovación la que falló, y lo dice el historial. */
export async function aplicarPagoFallido(c: Cobro, motivo: string): Promise<void> {
  await runWithWorkspace(c.workspace_id, async () => {
    if (c.estado === 'pendiente') {
      const r = await actualizar(c.workspace_id, c.id, { estado: 'fallido', motivo: motivo.slice(0, 300) }, { estado: ['pendiente'] });
      if (r && c.lead_id) {
        await logLeadEvent(c.lead_id, 'Pago rechazado', `${c.concepto}: ${motivo}`.slice(0, 300), NOMBRE_PASARELA[c.proveedor]);
        await alCron(c, 'rechazado');
      }
      return;
    }
    if (c.estado === 'pagado' && c.tipo === 'suscripcion' && c.lead_id) {
      // El prefijo lo LEE `cobradoDelLead` (lib/cobrado-lead.ts): es lo que pinta en rojo una renovación rechazada
      // de un cobro que sigue «Pagado». Y lo borra la próxima renovación que entre (`aplicarPagoAprobado`).
      await actualizar(c.workspace_id, c.id, { motivo: `${PREFIJO_RENOVACION_FALLIDA}: ${motivo}`.slice(0, 300) });
      await logLeadEvent(c.lead_id, 'Pago rechazado', `Renovación de ${c.concepto}: ${motivo}`.slice(0, 300), NOMBRE_PASARELA[c.proveedor]);
      await alCron(c, 'rechazado');
    }
  });
}

/**
 * Un reembolso. El del PRIMER pago deja el cobro `reembolsado`; el de una renovación sólo desmarca
 * esa cuota. Un parcial no desmarca nada (la cuota no se puede partir): queda en el historial.
 */
export async function aplicarReembolso(c: Cobro, p: { proveedorPagoId: string | null; total: boolean }): Promise<void> {
  await runWithWorkspace(c.workspace_id, async () => {
    const pagoId = p.proveedorPagoId ?? c.proveedor_pago_id;
    if (!p.total) {
      if (c.lead_id) await logLeadEvent(c.lead_id, 'Pago reembolsado', `Devolución parcial de ${c.concepto} por ${NOMBRE_PASARELA[c.proveedor]}`, NOMBRE_PASARELA[c.proveedor]);
      return;
    }
    const esElPrimero = !pagoId || pagoId === c.proveedor_pago_id;
    let cambio = false;
    if (esElPrimero && c.estado === 'pagado') {
      // El motivo de una devolución anterior que FALLÓ se va: ésta salió.
      cambio = !!(await actualizar(c.workspace_id, c.id, {
        estado: 'reembolsado', reembolsado_at: new Date().toISOString(), ...(esDevolucionFallida(c.motivo) ? { motivo: null } : {}),
      }, { estado: ['pagado'] }));
    }
    if (c.lead_id && pagoId) {
      const r = await desmarcarCobroDeProveedor({ leadId: c.lead_id, proveedor: c.proveedor, proveedorPagoId: pagoId });
      cambio = cambio || r.desmarcado;
    }
    if (cambio && c.lead_id) {
      await logLeadEvent(c.lead_id, 'Pago reembolsado', `${esElPrimero ? '' : 'Renovación de '}${c.concepto}: devuelto por ${NOMBRE_PASARELA[c.proveedor]}`, NOMBRE_PASARELA[c.proveedor]);
      await alCron(c, 'reembolsado');
    }
  });
}

/**
 * ⚠️ UNA DEVOLUCIÓN QUE FALLÓ (Stripe, `refund.failed`; 15/10/2026). Stripe devuelve la plata al saldo del negocio y el
 * cargo vuelve a estar cobrado: lo que `aplicarReembolso` deshizo se rehace. El cobro de un primer pago vuelve de
 * `reembolsado` a `pagado` (compare-and-set) y la cuota se vuelve a marcar con la fecha del CARGO. Si el cargo sigue
 * devuelto por otra devolución (`sigueDevuelto`), no se revierte nada. Siempre queda dicho en el historial.
 */
export async function aplicarReembolsoFallido(c: Cobro, p: { proveedorPagoId: string | null; sigueDevuelto: boolean; razon: string | null; fechaCargo: string | null }): Promise<void> {
  await runWithWorkspace(c.workspace_id, async () => {
    const texto = textoDevolucionFallida({ razon: p.razon, sigueDevuelto: p.sigueDevuelto });
    const pagoId = p.proveedorPagoId ?? c.proveedor_pago_id;
    const esElPrimero = !pagoId || pagoId === c.proveedor_pago_id;
    if (!p.sigueDevuelto) {
      if (esElPrimero && c.estado === 'reembolsado') {
        await actualizar(c.workspace_id, c.id, { estado: 'pagado', reembolsado_at: null, motivo: texto }, { estado: ['reembolsado'] });
      } else {
        await actualizar(c.workspace_id, c.id, { motivo: texto });
      }
      if (c.lead_id && pagoId) {
        const fecha = await hoyEnWorkspace(p.fechaCargo ? new Date(p.fechaCargo) : new Date());
        await remarcarCobroDeProveedor({ leadId: c.lead_id, proveedor: c.proveedor, proveedorPagoId: pagoId, fechaPago: fecha });
      }
    }
    if (c.lead_id) {
      await logLeadEvent(c.lead_id, 'Devolución fallida', `${esElPrimero ? '' : 'Renovación de '}${c.concepto}: ${texto}`.slice(0, 300), NOMBRE_PASARELA[c.proveedor]);
    }
  });
}

/**
 * ⚠️ UN CONTRACARGO (15/10/2026). Se CUENTA siempre: el historial del lead y el motivo del cobro (antes quedaba sólo en una
 * fila de `pasarela_eventos`). La cuota se mueve sólo con `plataAfuera` (lo decide quien llama, con lo que dice la
 * pasarela): `true` la desmarca como un reembolso (impaga y sin vencimiento: no es deuda), `false` la vuelve a marcar con
 * la fecha del cargo, `null` no la toca (Mercado Pago, o un contracargo PARCIAL: la cuota no se parte). Las dos son
 * idempotentes, así que un aviso repetido o desordenado no la mueve dos veces. El cobro sigue «Pagado».
 */
export async function aplicarContracargo(c: Cobro, p: { fase: FaseContracargo; texto: string; plataAfuera: boolean | null; proveedorPagoId: string | null; fechaCargo: string | null }): Promise<void> {
  await runWithWorkspace(c.workspace_id, async () => {
    const pagoId = p.proveedorPagoId ?? c.proveedor_pago_id;
    if (c.lead_id && pagoId && p.plataAfuera != null) {
      if (p.plataAfuera) await desmarcarCobroDeProveedor({ leadId: c.lead_id, proveedor: c.proveedor, proveedorPagoId: pagoId });
      else {
        const fecha = await hoyEnWorkspace(p.fechaCargo ? new Date(p.fechaCargo) : new Date());
        await remarcarCobroDeProveedor({ leadId: c.lead_id, proveedor: c.proveedor, proveedorPagoId: pagoId, fechaPago: fecha });
      }
    }
    await actualizar(c.workspace_id, c.id, { motivo: p.texto });
    if (c.lead_id) await logLeadEvent(c.lead_id, 'Contracargo', p.texto.slice(0, 300), NOMBRE_PASARELA[c.proveedor]);
  });
}

/**
 * Una vez por día (el cron de cobros, `esLaVueltaDelDia`): que el aviso de Stripe de este negocio escuche la lista de HOY.
 * Un contracargo llega sin que MaKo haga nada, así que no alcanza con ponerlo al día al reembolsar (15/10/2026).
 */
export async function mantenerAvisosStripe(ws: number): Promise<void> {
  const stripe = await credStripe(ws);
  if (stripe) await asegurarEventosDelAviso(ws, stripe.key);
}

/**
 * La suscripción se canceló (en MaKo o en el panel de la pasarela). El lead pasa a PLAZO FIJO hasta
 * hoy (`suscripcion_meses` = meses transcurridos): el MRR deja de contarla sin columna nueva, y su
 * historia de cobros queda intacta.
 */
/** Cuántas mensualidades cobró un cobro (sus cuotas pagadas). Si no se puede leer, 0: se usan los meses transcurridos. */
async function cuotasPagadasDelCobro(cobroId: number): Promise<number> {
  const db = await getTenantDb();
  const { count, error } = await db.from('pagos').select('id', { count: 'exact', head: true }).eq('cobro_id', cobroId).eq('pagado', true);
  return error ? 0 : count ?? 0;
}

export async function aplicarSuscripcionCancelada(c: Cobro): Promise<void> {
  await runWithWorkspace(c.workspace_id, async () => {
    if (c.suscripcion_estado === 'cancelada') return;
    const r = await actualizar(c.workspace_id, c.id, { suscripcion_estado: 'cancelada' });
    if (!r || !c.lead_id) return;
    const lead = await getLead(c.lead_id);
    let termino = false;
    if (lead && lead.venta_tipo === 'suscripcion') {
      // ⚠️ CANCELADA CON FECHA, como la manual (15/10/2026): el MRR deja de contarla EN EL ACTO (`getMrrActivo` mira
      // `suscripcion_cancelada_at`). Con sólo «plazo = meses transcurridos, mínimo 1», una cancelada en el primer mes se
      // seguía contando hasta cumplirlo. Y los meses que DURÓ son las mensualidades que cobró ESTE cobro (cada factura
      // es una cuota); sin cuotas, los transcurridos. El plazo de antes queda guardado, como al cancelar a mano.
      const hoy = await hoyEnWorkspace();
      const pagadas = await cuotasPagadasDelCobro(c.id);
      // Una con plazo que ya cobró TODAS sus mensualidades no se canceló: TERMINÓ (la pasarela la cierra sola al cumplirse,
      // `programarPlazoStripe`). Ahí no se toca nada: el plazo ya la saca del MRR, y la ficha dice «terminó», no «cancelada».
      termino = lead.suscripcion_meses != null && lead.suscripcion_meses > 0 && pagadas >= lead.suscripcion_meses;
      const meses = Math.max(1, pagadas || mesesTranscurridos(lead.fecha_cierre, hoy));
      const db = await getTenantDb();
      const { error } = termino ? { error: null } : await db.from('leads').update({
        suscripcion_meses: meses, suscripcion_cancelada_at: `${hoy}T12:00:00Z`, suscripcion_meses_antes: lead.suscripcion_meses ?? null,
      }).eq('id', lead.id);
      if (error) console.error(`[cobros] no pude cerrar la suscripción del lead ${lead.id}: ${error.message}`);
    }
    await logLeadEvent(c.lead_id, termino ? 'Suscripción terminada' : 'Suscripción cancelada',
      termino ? `${c.concepto}: cumplió su plazo y ${NOMBRE_PASARELA[c.proveedor]} dejó de cobrarla` : `${c.concepto}: se dejó de cobrar en ${NOMBRE_PASARELA[c.proveedor]}`,
      NOMBRE_PASARELA[c.proveedor]);
    await alCron(c, 'suscripcion_cancelada');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que pide una persona (la ficha, la API, el super admin)
// ─────────────────────────────────────────────────────────────────────────────

export async function anularCobro(ws: number, id: number, autor: string): Promise<{ ok: boolean; error?: string }> {
  const c = await getCobro(ws, id);
  if (!c) return { ok: false, error: 'No encontré ese cobro.' };
  if (c.estado !== 'pendiente' && c.estado !== 'fallido') return { ok: false, error: 'Sólo se anula un link que todavía no se pagó.' };
  const r = await actualizar(ws, id, { estado: 'anulado', motivo: `Anulado por ${autor}`.slice(0, 300) }, { estado: ['pendiente', 'fallido'] });
  if (!r) return { ok: false, error: 'El cobro cambió mientras tanto: recarga.' };
  // El link se CIERRA también del lado de la pasarela: Stripe expira la sesión; Mercado Pago vence la preferencia
  // (`vencerPreferenciaMp`) o cancela la suscripción que nadie autorizó todavía. Hasta el 15/10/2026 MP quedaba
  // abierto. Si el cierre falla (o MP lo ignora), un pago que igual entre se registra CON su aviso
  // (`avisoPagoPorLinkAnulado`, en aplicarPagoAprobado).
  if (c.proveedor === 'stripe' && c.proveedor_ref) {
    const stripe = await credStripe(ws);
    if (stripe) {
      const e = await expirarCheckoutStripe(stripe.key, c.proveedor_ref);
      if (!e.ok) console.warn(`[cobros] no pude expirar la sesión ${c.proveedor_ref}: ${e.error}`);
    }
  } else if (c.proveedor === 'mercadopago' && c.proveedor_ref) {
    const mp = await credMp(ws);
    if (mp) {
      const e = c.tipo === 'suscripcion'
        ? await cancelarSuscripcionMp(mp.token, c.proveedor_ref, idemAnular(c.id))
        : await vencerPreferenciaMp(mp.token, c.proveedor_ref, idemAnular(c.id));
      if (!e.ok) console.warn(`[cobros] no pude cerrar el link ${c.proveedor_ref} en Mercado Pago: ${e.error}`);
    }
  }
  if (c.lead_id) await runWithWorkspace(ws, () => logLeadEvent(c.lead_id!, 'Link de pago', `Anulado: ${c.concepto}`, autor));
  return { ok: true };
}

/**
 * Anula los links SIN PAGAR que saldan una cuota que se acaba de cobrar por otro lado (a mano, o con otro link).
 * Lo llama `marcarPago` (lib/pagos.ts) al marcarla pagada. Devuelve cuántos anuló.
 *
 * ⚠️ UN LINK VIVO DE UNA CUOTA YA COBRADA SE PUEDE PAGAR OTRA VEZ (revisión del 14/10/2026). Se mandaba el link de
 * la cuota 2, el cliente pagaba por transferencia y el closer la marcaba pagada; días después el cliente abría el
 * link del WhatsApp y pagaba: la pasarela le cobraba de nuevo y el CRM sumaba una cuota cobrada más. Stripe
 * expira la sesión al anular; Mercado Pago no puede cerrar una preferencia abierta, y si igual la pagan, el pago
 * entra como cuota nueva cobrada (`registrarCobroDeProveedor`): la plata entró dos veces y se ve.
 *
 * `exceptoCobroId`: el cobro que la está saldando (si la salda la pasarela), que a esa altura ya está pagado.
 */
export async function anularLinksDeCuota(ws: number, pagoId: number, autor: string, exceptoCobroId?: number | null): Promise<number> {
  const ids = await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data, error } = await db.from('cobros').select('id').eq('pago_id', pagoId).in('estado', ['pendiente', 'fallido']);
    if (error) throw new Error(`No pude leer los links de la cuota ${pagoId}: ${error.message}`);
    return ((data ?? []) as Array<{ id: number }>).map((r) => Number(r.id)).filter((id) => id !== exceptoCobroId);
  });
  let anulados = 0;
  for (const id of ids) {
    const r = await anularCobro(ws, id, autor);
    if (r.ok) anulados++;
    else console.warn(`[cobros] no pude anular el link ${id} de la cuota ${pagoId}: ${r.error}`);
  }
  return anulados;
}

/** Best effort: que el aviso de Stripe de este negocio escuche la lista de HOY (`asegurarEventosStripe`). */
async function asegurarEventosDelAviso(ws: number, key: string): Promise<void> {
  try {
    const acct = await credDelCliente('STRIPE_ACCOUNT_ID', ws);
    if (!acct) return;
    const r = await asegurarEventosStripe(key, urlAvisoStripe(acct));
    if (!r.ok) console.warn(`[cobros] no pude poner al día los eventos del aviso de Stripe (ws ${ws}): ${r.error}`);
  } catch (e) {
    console.warn(`[cobros] no pude poner al día los eventos del aviso de Stripe (ws ${ws}):`, e instanceof Error ? e.name : 'error');
  }
}

/**
 * Devuelve el pago ENTERO. Mueve plata real: lo pide una persona desde una PANTALLA (la ficha, con
 * confirmación, o /mako/revisar por la API) y sólo un admin. La clave de idempotencia es
 * determinística por cobro: una confirmación repetida no devuelve dos veces. Y NO se reintenta solo.
 */
export async function reembolsarCobro(ws: number, id: number, autor: string, motivo?: string | null): Promise<{ ok: boolean; resumen: string }> {
  const c = await getCobro(ws, id);
  if (!c) return { ok: false, resumen: 'No encontré ese cobro.' };
  if (c.estado === 'reembolsado') return { ok: false, resumen: 'Ese cobro ya estaba reembolsado.' };
  if (c.estado !== 'pagado' || !c.proveedor_pago_id) return { ok: false, resumen: 'Sólo se reembolsa un cobro pagado.' };
  // `pending` cuenta como hecha, como la cuenta Stripe (el cargo ya figura devuelto); si después falla, entra `refund.failed`.
  let enCurso = false;
  if (c.proveedor === 'stripe') {
    const stripe = await credStripe(ws);
    if (!stripe) return { ok: false, resumen: 'Stripe no está conectado.' };
    // Que el aviso escuche `refund.failed` ANTES de pedirla: si la devolución falla después, es por ahí que se sabe.
    await asegurarEventosDelAviso(ws, stripe.key);
    const pid = c.proveedor_pago_id;
    const idem = idemReembolso(c.id, esDevolucionFallida(c.motivo) ? String(Date.parse(c.updated_at)) : null);
    const r = await reembolsarStripe(stripe.key, { idem, paymentIntent: pid.startsWith('pi_') ? pid : null, invoice: pid.startsWith('in_') ? pid : null });
    if (!r.ok) return { ok: false, resumen: `Stripe no hizo el reembolso: ${r.error}` };
    // Creada pero ya fallida: no se devolvió nada (antes se daba por hecha igual).
    if (r.estado === 'failed' || r.estado === 'canceled') return { ok: false, resumen: 'Stripe no pudo hacer la devolución: la plata sigue cobrada.' };
    enCurso = r.estado !== 'succeeded';
  } else {
    const mp = await credMp(ws);
    if (!mp) return { ok: false, resumen: 'Mercado Pago no está conectado.' };
    const r = await reembolsarMp(mp.token, c.proveedor_pago_id, idemReembolso(c.id));
    if (!r.ok) return { ok: false, resumen: `Mercado Pago no hizo el reembolso: ${r.error}` };
  }
  await aplicarReembolso(c, { proveedorPagoId: c.proveedor_pago_id, total: true });
  if (motivo && c.lead_id) await runWithWorkspace(ws, () => logLeadEvent(c.lead_id!, 'Pago reembolsado', `Motivo: ${motivo}`.slice(0, 300), autor));
  return { ok: true, resumen: `Listo: ${c.concepto} (${formatoMonto(c.monto, c.moneda)}) devuelto por ${NOMBRE_PASARELA[c.proveedor]}${enCurso ? ' (Stripe todavía la está procesando)' : ''}.` };
}

/** Cancela la suscripción en la pasarela EN EL ACTO (deja de cobrar). Irreversible en Mercado Pago. */
export async function cancelarSuscripcionCobro(ws: number, id: number, autor: string): Promise<{ ok: boolean; resumen: string }> {
  const c = await getCobro(ws, id);
  if (!c) return { ok: false, resumen: 'No encontré ese cobro.' };
  // En MP el id del preapproval ES el `proveedor_ref` del cobro: a veces el aviso no llena `proveedor_suscripcion_id`.
  const susId = c.proveedor_suscripcion_id ?? (c.proveedor === 'mercadopago' && c.tipo === 'suscripcion' ? c.proveedor_ref : null);
  if (c.tipo !== 'suscripcion' || !susId) return { ok: false, resumen: 'Ese cobro no es una suscripción activa.' };
  if (c.suscripcion_estado === 'cancelada') return { ok: false, resumen: 'Esa suscripción ya estaba cancelada.' };
  if (c.proveedor === 'stripe') {
    const stripe = await credStripe(ws);
    if (!stripe) return { ok: false, resumen: 'Stripe no está conectado.' };
    const r = await cancelarSuscripcionStripe(stripe.key, susId, idemBaja(c.id));
    if (!r.ok) return { ok: false, resumen: `Stripe no canceló la suscripción: ${r.error}` };
  } else {
    const mp = await credMp(ws);
    if (!mp) return { ok: false, resumen: 'Mercado Pago no está conectado.' };
    const r = await cancelarSuscripcionMp(mp.token, susId, idemBaja(c.id));
    if (!r.ok) return { ok: false, resumen: `Mercado Pago no canceló la suscripción: ${r.error}` };
  }
  await aplicarSuscripcionCancelada(c);
  if (c.lead_id) await runWithWorkspace(ws, () => logLeadEvent(c.lead_id!, 'Suscripción cancelada', `Pedido por ${autor}`, autor));
  return { ok: true, resumen: `Listo: la suscripción ${c.concepto} no se cobra más.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// El plan de MaKo de un negocio (lo que le cobra la PLATAFORMA): «Configuración del negocio → Tu plan»
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La suscripción con la que la PLATAFORMA le cobra MaKo a este negocio (15/10/2026, «cancelar uno mismo»): el cobro del
 * workspace de MaKo cuya alta creó ESTE workspace (`alta_ws`), de suscripción y pagado; el más reciente. Se lee con el
 * cliente de servicio porque el cobro es de OTRO inquilino (la plataforma), y por eso SÓLO por `alta_ws = ws`: un negocio
 * ve su plan y nunca el de otro. null = a este negocio MaKo no se le cobra por la pasarela (se acordó a mano, o es la
 * plataforma misma).
 */
export async function suscripcionDeMakoDe(ws: number): Promise<Cobro | null> {
  const plataforma = await wsSuperAdmin();
  if (ws === plataforma) return null;
  const { data, error } = await getSupabaseServer().from('cobros').select(COLS_COBRO)
    .eq('workspace_id', plataforma).eq('alta_ws', ws).eq('tipo', 'suscripcion').eq('estado', 'pagado')
    .order('pagado_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`No pude leer el plan de MaKo del negocio ${ws}: ${error.message}`);
  return data ? cobroDeFila(data as Record<string, unknown>) : null;
}

export type ResultadoBaja = { ok: true; resumen: string; codigo: string; finAt: string | null } | { ok: false; resumen: string };

/**
 * «DARME DE BAJA» (15/10/2026, lo decidió Estrategia: un botón propio, que cubre las dos pasarelas). Se copia a los SaaS
 * y a las pasarelas (Stripe y Paddle programan la baja al FINAL del período pagado): en Stripe, `cancel_at_period_end` y
 * se usa hasta esa fecha; Mercado Pago no tiene «al final del período» y se cancela en el acto (no hay más cobros). Las
 * dos dejan el CÓDIGO de baja en el cobro, en el historial del lead del comprador en el CRM de MaKo, y quien llama lo
 * manda por email. Pedirla dos veces devuelve la misma: el primer código, sin otra llamada a la pasarela.
 */
export async function darDeBajaMiPlan(ws: number, autor: string): Promise<ResultadoBaja> {
  const c = await suscripcionDeMakoDe(ws);
  if (!c) return { ok: false, resumen: `Tu plan no se cobra por la pasarela: escríbenos a ${EMAIL_MAKO} para darte de baja.` };
  const codigo = codigoDeBaja(c.id);
  if (c.suscripcion_estado === 'cancelada') return { ok: false, resumen: `Tu plan ya estaba dado de baja (código ${codigo}).` };
  if (esBajaPedida(c.motivo)) return { ok: true, resumen: c.motivo ?? '', codigo, finAt: null };
  const pedida = new Date().toISOString();
  let finAt: string | null = null;
  if (c.proveedor === 'stripe') {
    const stripe = await credStripe(c.workspace_id);
    if (!stripe || !c.proveedor_suscripcion_id) return { ok: false, resumen: `No pudimos darte de baja. Escríbenos a ${EMAIL_MAKO}.` };
    // Su propia clave: la de `idemBaja` es la de cancelar EN EL ACTO (DELETE), y una clave repetida con otro pedido dentro
    // de las 24 h Stripe la rechaza (si el super admin la cancela del todo el mismo día).
    const r = await programarBajaStripe(stripe.key, c.proveedor_suscripcion_id, `${idemBaja(c.id)}-al-fin`);
    if (!r.ok) return { ok: false, resumen: `Stripe no tomó la baja: ${motivoSinDatos(r.error)}` };
    finAt = r.finAt;
  } else {
    const r = await cancelarSuscripcionCobro(c.workspace_id, c.id, autor);
    if (!r.ok) return { ok: false, resumen: r.resumen };
  }
  const texto = textoBajaPedida({ codigo, pedida, finAt });
  await actualizar(c.workspace_id, c.id, { motivo: texto });
  if (c.lead_id) await runWithWorkspace(c.workspace_id, () => logLeadEvent(c.lead_id!, 'Baja del plan', `${texto} Pedida por ${autor}.`.slice(0, 300), autor));
  return { ok: true, resumen: texto, codigo, finAt };
}

// ─────────────────────────────────────────────────────────────────────────────
// Red de seguridad: el cron relee al proveedor lo que quedó pendiente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un aviso se puede perder (un deploy, un 5xx de nuestro lado que el proveedor dejó de reintentar), y
 * los pagos de PRUEBA de Mercado Pago no mandan aviso a la notification_url. El cron hace tres cosas:
 *   · relee al proveedor los cobros PENDIENTES con movimiento en los últimos días y aplica lo que la
 *     pasarela ya confirmó. La ventana cuenta desde `updated_at`, no desde que se creó: la preferencia de
 *     MP no vence y el link de Stripe crea otra sesión al abrirse (revisión del 11/10/2026);
 *   · REPARA los cobros «pagados a medias» (revisión del 11/10/2026, la grave): el cobro pasa a pagado
 *     primero y después se asienta la cuota, se gana el lead y se da el alta. Si eso se corta después de
 *     que el proveedor ya recibió su 200 (el resto iba en `after()`), nadie lo reintentaba. Un pagado sin su
 *     cuota en el CRM, o con el alta sin terminar, vuelve a pasar por `aplicarPagoAprobado`, que es
 *     idempotente paso por paso.
 *   · Mira también los ANULADOS que llegaron a la pasarela: uno que igual se pagó y cuyo aviso se perdió entra con
 *     su aviso (`avisoPagoPorLinkAnulado`), no queda escondido (15/10/2026).
 * Tope por corrida: 50 de cada tipo (20 de los anulados).
 */
export async function reconciliarCobros(ws: number, opts: { dias?: number } = {}): Promise<{ revisados: number; cambiados: number; errores: number }> {
  const desde = new Date(Date.now() - (opts.dias ?? 14) * 86_400_000).toISOString();
  const db = getSupabaseServer();
  const [pend, pag, anul] = await Promise.all([
    db.from('cobros').select(COLS_COBRO).eq('workspace_id', ws)
      .in('estado', ['pendiente', 'fallido']).gte('updated_at', desde)
      .order('updated_at', { ascending: false }).limit(50),
    db.from('cobros').select(COLS_COBRO).eq('workspace_id', ws).eq('estado', 'pagado')
      // Los pagados recientes (para ver si les falta la cuota) y las altas sin terminar, de cuando sea.
      .or(`pagado_at.gte.${desde},alta_estado.in.(error,pendiente),and(alta_capa.not.is.null,alta_estado.is.null)`)
      .order('pagado_at', { ascending: false }).limit(50),
    // Los ANULADOS que llegaron a la pasarela (con `proveedor_ref`; uno que falló al crearse no tiene): si igual los
    // pagaron y el aviso se perdió, la plata entró y nadie lo sabría (15/10/2026). Aparte y con su tope, para que no
    // le quiten lugar a los pendientes.
    db.from('cobros').select(COLS_COBRO).eq('workspace_id', ws)
      .eq('estado', 'anulado').not('proveedor_ref', 'is', null).gte('updated_at', desde)
      .order('updated_at', { ascending: false }).limit(20),
  ]);
  if (pend.error) throw new Error(`No pude leer los cobros pendientes a reconciliar: ${pend.error.message}`);
  if (pag.error) throw new Error(`No pude leer los cobros pagados a reparar: ${pag.error.message}`);
  if (anul.error) throw new Error(`No pude leer los cobros anulados a reconciliar: ${anul.error.message}`);
  const pendientes = [...(pend.data ?? []), ...(anul.data ?? [])].map((x) => cobroDeFila(x as Record<string, unknown>));
  const pagados = (pag.data ?? []).map((x) => cobroDeFila(x as Record<string, unknown>));

  // Qué pagados ya tienen su cuota en el CRM (una sola lectura).
  const conCuota = new Set<number>();
  if (pagados.length) {
    const { data, error } = await db.from('pagos').select('cobro_id').eq('workspace_id', ws).in('cobro_id', pagados.map((c) => c.id));
    if (error) throw new Error(`No pude leer las cuotas de los cobros: ${error.message}`);
    for (const r of data ?? []) conCuota.add(Number((r as { cobro_id: number }).cobro_id));
  }

  let cambiados = 0;
  let errores = 0;
  const [stripe, mp] = await Promise.all([credStripe(ws), credMp(ws)]);

  for (const c of pagados) {
    const faltaCuota = !!c.lead_id && c.monto_usd != null && !!c.proveedor_pago_id && !conCuota.has(c.id);
    const faltaAlta = !!c.alta_capa && c.alta_estado !== 'hecha' && c.alta_estado !== 'ya_tenia_cuenta';
    if (!faltaCuota && !faltaAlta) continue;
    try {
      if (c.proveedor_pago_id) await aplicarPagoAprobado(c, { proveedorPagoId: c.proveedor_pago_id, pagadoAt: c.pagado_at });
      else await runWithWorkspace(ws, () => altaSiCorresponde(c));
      cambiados++;
    } catch (e) {
      errores++;
      console.error(`[cobros] reparar cobro ${c.id}:`, e instanceof Error ? e.message : String(e));
    }
  }

  for (const c of pendientes) {
    try {
      if (c.proveedor === 'stripe' && stripe && c.proveedor_ref) {
        const s = await leerCheckoutStripe(stripe.key, c.proveedor_ref);
        if (s.ok && s.estado === 'complete' && s.pagoEstado === 'paid' && s.referencia === c.token) {
          // ⚠️ EL MISMO id QUE USA EL WEBHOOK, o la primera cuota se duplica: en una suscripción es la
          // FACTURA (después llega `invoice.paid` con ese mismo id), en un pago único el payment intent.
          // Sin factura todavía, no se aplica: entra por `invoice.paid` o en la próxima vuelta. Usar el
          // id de la sesión acá hacía que la factura se leyera después como una RENOVACIÓN.
          const pagoId = c.tipo === 'suscripcion' ? s.invoice : s.paymentIntent;
          if (pagoId) {
            const r = await aplicarPagoAprobado(c, { proveedorPagoId: pagoId, suscripcionId: s.subscription });
            if (r.nuevo) cambiados++;
          }
        }
      } else if (c.proveedor === 'mercadopago' && mp) {
        const b = await buscarPagosMp(mp.token, c.token);
        const aprobado = b.ok ? b.pagos.find((x) => x.estado === 'approved' && x.cobradorId === mp.userId && x.referencia === c.token) : undefined;
        if (aprobado) {
          const r = await aplicarPagoAprobado(c, { proveedorPagoId: aprobado.id, monto: aprobado.monto, moneda: aprobado.moneda, suscripcionId: aprobado.preapprovalId, pagadoAt: aprobado.fecha });
          if (r.nuevo) cambiados++;
        }
      }
    } catch (e) {
      errores++;
      console.error(`[cobros] reconciliar cobro ${c.id}:`, e instanceof Error ? e.message : String(e));
    }
  }
  return { revisados: pendientes.length + pagados.length, cambiados, errores };
}

/** Los workspaces con alguna pasarela conectada (para el cron). Lee la tabla de ruteo, que es en claro. */
export async function workspacesConPasarela(): Promise<number[]> {
  const { data, error } = await getSupabaseServer().from('webhook_routing').select('workspace_id').in('servicio', ['stripe', 'mercadopago']);
  if (error) throw new Error(`No pude leer los workspaces con pasarela: ${error.message}`);
  return [...new Set((data ?? []).map((r) => Number((r as { workspace_id: number }).workspace_id)).filter((n) => Number.isFinite(n)))];
}
