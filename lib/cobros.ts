// =============================================================================
// cobros — la pasarela de pagos (Stripe, Mercado Pago y Creem): el ÚNICO escritor de `cobros`
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
import { actualizarWorkspace, getTenantDb, getWorkspace, runWithWorkspace, wsSuperAdmin } from './workspace';
import { buscarUsuarioPorEmail } from './usuarios';
import { credDelCliente } from './credenciales';
import { APP_BASE_URL, EMAIL_MAKO } from './app-url';
import { avisarDePlataforma } from './invitaciones';
import { createLead, enriquecerLead, findLeadByContacto, getLead, logLeadEvent, setPipelineStage } from './leads';
import { anotarParaLlamar } from './compra-plan-llamada';
import { getPipelineStagesDeLead } from './funnels';
import { etapaDeGanado } from './pipeline';
import { listProductos } from './productos';
import {
  TratoEnCursoError, cobroDelProducto, cuentasDelVinculoDelProducto, ganarEnElCrm, marcarBajaPorReembolso, otroCobroPagadoDelProducto, planesDadosDeBajaDelLead,
  planesDevueltosDelLead, prepararTratoDelPago, productosParaCobrar, vinculosDelNegocio, type TratoDelPago,
} from './cobro-etapa-server';
import { decidirBajaDelPlan, mismoCentavo, type PlanCongelado } from './cobro-etapa';
import { getPagosByLead, registrarCobroDeProveedor, desmarcarCobroDeProveedor, remarcarCobroDeProveedor } from './pagos';
import { hoyEnWorkspace } from './timezone';
import { capaDef, type CapaId } from './capas';
import { darDeAltaCliente, esCapaVendible } from './alta-cliente';
import { habilitarClienteDeAgencia } from './agencia-habilitar';
import { revisarAccesosPorPago } from './plan-acceso';
import { CAPACIDADES_PASARELA, COLS_COBRO, NOMBRE_PASARELA, PASARELAS, cobroDeFila, esTokenCobro, idDeSuscripcion, type Cobro, type EstadoAlta, type EstadoCobro, type Pasarela, type TipoCobro } from './cobros-tipos';
import { valoresDelPago } from './variables-del-lead';
import {
  avisoPagoPorLinkAnulado, codigoDeBaja, decidirCobro, esBajaPedida, textoBajaPedida, esRenovacion, finDelPlazo, idemAnular, idemBaja, idemCancelarFallida, idemCobro, idemReembolso, mesesTranscurridos, tocaCerrarElPlazo,
  esDevolucionFallida, montoUsdDeLaCuota, montoUsdDelCobro, pasaAPagado, textoDevolucionFallida, textoPagoRegistrado, urlPorVencer, ESTADOS_QUE_PASAN_A_PAGADO,
  mailDeAccesoNoSalio, PREFIJO_MAIL_NO_SALIO, cerrarCheckoutDelCobro,
} from './cobros-reglas';
import { formatoMonto } from './pasarela-moneda';
import { esCuotaDeBaja, esCuotaDevuelta, esRenovacionFallida, PREFIJO_RENOVACION_FALLIDA } from './cobrado-lead';
import { motivoSinDatos, primerCobroDeLaPrueba, renovacionesQueFaltan, sesionDelCobro, suscripcionMpCancelada, type FaseContracargo } from './cobros-eventos';
import { leerTodo } from './supabase-paginado';
import { avisarRenovacionVieja, avisarSesionQueNoCuadra } from './cobro-sesion-ajena';
import { emitirDelCatalogo } from './avisos';
import { linkResumenLead } from './lead-resumen';
import { enrolarPorPago, type SubtipoPago } from './pago-entrante';
import {
  asegurarEventosStripe, cancelarSuscripcionStripe, programarBajaStripe, crearCheckoutStripe, expirarCheckoutStripe, facturasPagadasStripe, leerCheckoutStripe, leerFacturaStripe, leerPruebaStripe, leerSuscripcionStripe, modoDeClaveStripe, programarFinSuscripcionStripe, reembolsarStripe,
} from './stripe-api';
import { urlAvisoCreem, urlAvisoStripe } from './cobros-conexion';
import { CUENTA_PRINCIPAL, claveDeCuenta, cuentaSinElegir, partirIdDeCuenta } from './cuentas-integracion';
import { credCreemDe, credMpDe, credStripeDe, cuentaDeIdentificador, cuentasDePago } from './cuentas-pago-server';
import { guardarOrigenDeAlta, guardarWhatsappDelPago } from './origen-cuenta-server';
import { buscarPagosMp, cancelarSuscripcionMp, crearPreferenciaMp, crearSuscripcionMp, instanteMp, leerCuentaMp, leerPagoMp, leerSuscripcionMp, reembolsarMp, vencerPreferenciaMp } from './mercadopago-api';
import {
  buscarTransaccionesCreem, cancelarSuscripcionCreem, crearCheckoutCreem as crearCheckoutCreemAPI, crearDescuentoDeEntradaCreem,
  crearProductoCreem, leerCheckoutCreem, leerSuscripcionCreem, leerTransaccionCreem, modoDeClaveCreem, repararAvisoCreem,
} from './creem-api';
import { compartenHuella, diaDelCobro, esPruebaDePlan, FILTRO_SUSCRIPCION_DE_MAKO, huellaCreem, huellaMp, huellaStripe, partesDeHuella, PREFIJO_PRUEBA_RECHAZADA, pruebaDeEmpezarYa, transaccionQueCobra } from './prueba-plan-reglas';
import { PRUEBA_DIAS } from './planes-mako';
import { montoDelPrimerPago, pctDelPrimerMes, usdDelPrimerPago } from './primer-mes-reglas';
import { volverAlPrecioLleno } from './primer-mes';
import { productoDeMako } from './stripe-catalogo-reglas';
import { esCobroExterno, PREFIJO_EXTERNO, type FilaVentaExterna } from './cobros-externos-reglas';
import { compraExternaQueFalto } from './cobros-externos-meta';

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

type CredStripe = { pasarela: 'stripe'; key: string; acct: string; cuenta: string };
type CredMp = { pasarela: 'mercadopago'; token: string; userId: string; cuenta: string };
type CredCreem = { pasarela: 'creem'; key: string; webhookId: string; secretoAviso: string; cuenta: string };

/**
 * Las claves de UNA cuenta de la pasarela (varias por proveedor, 22/10/2026, lib/cuentas-pago-server.ts). Sin la cuenta,
 * la principal. En Stripe, «conectada» es la clave, el id de la cuenta Y el secreto del aviso: sin los dos últimos, un
 * cobro se crearía bien y su pago NUNCA volvería al CRM.
 */
const credStripe = (ws: number, cuenta: string | null = CUENTA_PRINCIPAL): Promise<CredStripe | null> => (cuenta == null ? Promise.resolve(null) : credStripeDe(ws, cuenta));
const credMp = (ws: number, cuenta: string | null = CUENTA_PRINCIPAL): Promise<CredMp | null> => (cuenta == null ? Promise.resolve(null) : credMpDe(ws, cuenta));
const credCreem = (ws: number, cuenta: string | null = CUENTA_PRINCIPAL): Promise<CredCreem | null> => (cuenta == null ? Promise.resolve(null) : credCreemDe(ws, cuenta));

/**
 * La cuenta del negocio que tiene HOY el cobro (mig 0328). Manda su id en el proveedor (`cuenta_ref`): si esa cuenta se
 * desconectó y volvió con otro sufijo, sigue siendo la suya (revisión de plata del 22/10/2026: por el sufijo, sus avisos
 * se ignoraban y no se podía devolver ni cancelar). null = esa cuenta ya no está conectada. Un cobro de antes, sin
 * `cuenta_ref`, es de su sufijo (NULL = la principal), como siempre. Tira si no puede leer.
 */
async function cuentaVivaDelCobro(ws: number, c: Pick<Cobro, 'proveedor' | 'cuenta' | 'cuenta_ref'>): Promise<string | null> {
  if (c.cuenta_ref) return cuentaDeIdentificador(ws, c.proveedor, c.cuenta_ref);
  return c.cuenta ?? CUENTA_PRINCIPAL;
}

/** La cuenta con la que cobra una pasarela si nadie elige: la principal si cobra, si no la primera que cobre. null = ninguna. */
async function cuentaPorDefecto(ws: number, pasarela: Pasarela): Promise<string | null> {
  const cs = (await cuentasDePago(ws, pasarela)).filter((x) => x.conectada);
  return (cs.find((x) => x.principal) ?? cs[0])?.cuenta ?? null;
}

/**
 * Con qué cuenta de esa pasarela se cobraría HOY: la pedida (si es de esa pasarela), o sin pedir la de siempre o la del
 * vínculo del producto (`cuentaSinElegir`, lib/cuentas-integracion.ts). null = ninguna que cobre.
 */
async function cuentaParaCobrar(ws: number, pas: Pasarela, pedida: { proveedor: Pasarela; cuenta: string } | null, delVinculo: readonly string[]): Promise<string | null> {
  if (pedida) return pedida.proveedor === pas ? pedida.cuenta : null;
  const cobran = (await cuentasDePago(ws, pas)).filter((x) => x.conectada);
  const porDefecto = (cobran.find((x) => x.principal) ?? cobran[0])?.cuenta ?? null;
  return cuentaSinElegir(pas, porDefecto, delVinculo, cobran.map((x) => x.cuenta));
}

/**
 * El id EN EL PROVEEDOR de la cuenta con que se cobraría hoy ese producto por esa pasarela (sin cuenta elegida, como un
 * link de landing). Lo usa la landing para no reusar un pendiente de OTRA cuenta (revisión de plata del 22/10/2026).
 * null = ninguna que cobre.
 */
export async function refParaCobrar(ws: number, pasarela: Pasarela, productoId: number | null): Promise<string | null> {
  return runWithWorkspace(ws, async () => {
    const delVinculo = productoId ? await cuentasDelVinculoDelProducto(productoId) : [];
    const cuenta = await cuentaParaCobrar(ws, pasarela, null, delVinculo);
    if (!cuenta) return null;
    // Por pasarela, no `stripe ? … : mp` (31/10/2026): Creem caía en Mercado Pago y devolvía su `user_id`, con lo
    // cual la landing creía que el pendiente de otra cuenta era de ésta.
    switch (pasarela) {
      case 'stripe': return (await credStripe(ws, cuenta))?.acct ?? null;
      case 'mercadopago': return (await credMp(ws, cuenta))?.userId ?? null;
      case 'creem': return (await credCreem(ws, cuenta))?.webhookId ?? null;
      default: { const _x: never = pasarela; return null; }
    }
  });
}

/**
 * El modo (real o prueba) con que cobraría HOY esa pasarela del negocio: el de su clave de Stripe, o el de su cuenta de
 * Mercado Pago (una consulta a su API). null si no está conectada o la cuenta no contesta. Es la MISMA regla que usa
 * `crearCobro` para anotar el `modo` de un cobro nuevo (17/10/2026): la landing la usa para no reusar un pendiente de
 * PRUEBA después de pasar a claves reales (lib/editor-landing/pago-pedido.ts, `cobroReusable`).
 */
export async function modoDeLaPasarela(ws: number, pasarela: Pasarela, productoId?: number | null): Promise<'real' | 'prueba' | null> {
  // Con el producto, el de la cuenta que lo cobraría (la de su vínculo): la landing compara este modo con el id de ESA
  // cuenta (`refParaCobrar`); con el de la principal, reusaba el pendiente de prueba de la otra (revisión del 22/10/2026).
  const cuenta = productoId
    ? await runWithWorkspace(ws, async () => cuentaParaCobrar(ws, pasarela, null, await cuentasDelVinculoDelProducto(productoId)))
    : await cuentaPorDefecto(ws, pasarela);
  if (!cuenta) return null;
  if (pasarela === 'stripe') {
    const s = await credStripe(ws, cuenta);
    return s ? (modoDeClaveStripe(s.key) ?? 'real') : null;
  }
  const m = await credMp(ws, cuenta);
  if (!m) return null;
  const c = await leerCuentaMp(m.token);
  return c.ok ? c.modo : null;
}

/**
 * Las pasarelas con las que ESTE workspace puede cobrar hoy (todas, algunas o ninguna): con ALGUNA cuenta que cobre.
 *
 * ⚠️ VA POR `PASARELAS`, NUNCA POR UNA LISTA A MANO. Hasta el 31/10/2026 acá había `['stripe', 'mercadopago']` escrito
 * literal, y ese literal es asignable a `Pasarela[]`: al agregar la tercera pasarela el compilador no decía nada y una
 * Creem conectada y cobrando se reportaba como «no hay pasarela» en TODOS sus llamadores (el checkout de /planes, la
 * ficha del lead, la API de MaKo y el cron). Una pasarela nueva se ofrece sola al sumarse a la constante.
 */
export async function pasarelasConectadas(ws: number): Promise<Pasarela[]> {
  const cs = (await cuentasDePago(ws)).filter((x) => x.conectada);
  return PASARELAS.filter((p) => cs.some((x) => x.proveedor === p));
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

async function actualizar(ws: number, id: number, patch: Record<string, unknown>, soloSi?: { estado?: readonly EstadoCobro[]; ref?: string | null }): Promise<Cobro | null> {
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
    // La sesión del proveedor que se leyó (`ref`): si otro pedido armó una nueva en el medio, no se escribe sobre ésa.
    if (soloSi && 'ref' in soloSi) q = soloSi.ref == null ? q.is('proveedor_ref', null) : q.eq('proveedor_ref', soloSi.ref);
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
  // `*`: `baja_at` (mig 0307) se lee si existe; con la lista, una base sin la migración rompía todo link de cuota.
  const { data, error } = await db.from('pagos').select('*').eq('id', pagoId).eq('lead_id', leadId).maybeSingle();
  if (error) return { ok: false, error: `No pude leer la cuota: ${error.message}` };
  if (!data) return { ok: false, error: 'Esa cuota no es de este lead.' };
  const q = data as { id: number; numero: number; monto_usd: number; pagado: boolean; proveedor_pago_id: string | null; proveedor: string | null; cobro_id: number | null; fecha_esperada: string | null; baja_at?: string | null };
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
  /**
   * SÓLO la plataforma (#866, 17/10/2026): el cobro paga el lugar de un CLIENTE de una agencia. Al pagarse el primer mes,
   * el cliente queda habilitado solo (`habilitarClienteDeAgencia`, lib/agencia-habilitar.ts). En otro workspace se rechaza.
   */
  paraCliente?: { agenciaWs: number; clienteWs: number } | null;
  /** Una suscripción que empieza a cobrar más adelante (#867): sólo con Mercado Pago, que lo recibe al crearla (`start_date`). */
  inicioAt?: string | null;
  /**
   * La CUENTA que cobra (mig 0328, varias por proveedor): un id de lib/cuentas-integracion.ts (`stripe:c2`). Sin ella, la
   * principal de la pasarela (o la primera que cobre). Fija la pasarela.
   */
  cuenta?: string | null;
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
  // El lugar de un cliente de agencia lo cobra la PLATAFORMA, en positivo como el alta: un negocio que vende con su Mercado
  // Pago no habilita cuentas de MaKo aunque mande el par.
  let paraCliente: { agenciaWs: number; clienteWs: number } | null = null;
  if (p.paraCliente) {
    if (ws !== (await wsSuperAdmin())) return { ok: false, error: 'Sólo la cuenta de MaKo cobra el lugar de un cliente de agencia.' };
    if (altaCapa) return { ok: false, error: 'Un cobro da de alta una cuenta o paga la de un cliente de agencia, no las dos cosas.' };
    const { agenciaWs, clienteWs } = p.paraCliente;
    if (!Number.isInteger(agenciaWs) || !Number.isInteger(clienteWs) || agenciaWs <= 0 || clienteWs <= 0 || agenciaWs === clienteWs) return { ok: false, error: 'Agencia o cliente inválidos.' };
    paraCliente = { agenciaWs, clienteWs };
  }
  // Un primer cobro diferido: donde la pasarela acepta una fecha (`start_date` de Mercado Pago), o la PRUEBA GRATIS de un plan de
  // MaKo donde los días de prueba los pone el proveedor (`trial_period_days` de Stripe y de Creem, que arma el checkout al ver la
  // prueba). ⚠️ Decía `p.pasarela === 'stripe'`, así que la prueba de Creem NI SE CREABA: /planes le mandaba su `inicioAt` y esto la
  // rechazaba, y le decía «no pudimos» a quien venía a darse de alta (31/10/2026).
  const inicioAt = p.inicioAt ?? null;
  const capacidades = p.pasarela ? CAPACIDADES_PASARELA[p.pasarela] : null;
  const pruebaPorDias = !!capacidades?.pruebaConTarjeta && esPruebaDePlan({ tipo: p.tipo ?? '', alta_capa: altaCapa, creado_por: p.creadoPor });
  if (inicioAt && (p.tipo !== 'suscripcion' || (!capacidades?.difiereElPrimerCobro && !pruebaPorDias) || !Number.isFinite(Date.parse(inicioAt)))) {
    return { ok: false, error: 'Sólo una suscripción de Mercado Pago (o la prueba de un plan de MaKo) empieza a cobrar más adelante.' };
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

    // La CUENTA (mig 0328): la pedida, o la de cada pasarela por defecto (la principal si cobra, si no la primera).
    const pedida = p.cuenta ? partirIdDeCuenta(p.cuenta) : null;
    if (p.cuenta && !pedida) return { ok: false, error: 'Esa cuenta de cobro no existe.' };
    if (pedida && p.pasarela && pedida.proveedor !== p.pasarela) return { ok: false, error: `Esa cuenta no es de ${NOMBRE_PASARELA[p.pasarela]}.` };
    // Sin cuenta pedida, un producto vinculado a un CRM («Vincular cobro») cobra por una cuenta de SU vínculo: la de siempre
    // si está en él, si no la primera del vínculo que cobre. Así su pago encuentra el vínculo (`vinculoDelPago`).
    const delVinculo = !pedida && p.productoId ? await cuentasDelVinculoDelProducto(p.productoId) : [];
    const [conStripe, conMp, conCreem] = await Promise.all([
      cuentaParaCobrar(ws, 'stripe', pedida, delVinculo),
      cuentaParaCobrar(ws, 'mercadopago', pedida, delVinculo),
      cuentaParaCobrar(ws, 'creem', pedida, delVinculo),
    ]);
    const [stripe, mp, creem] = await Promise.all([
      conStripe ? credStripe(ws, conStripe) : Promise.resolve(null),
      conMp ? credMp(ws, conMp) : Promise.resolve(null),
      conCreem ? credCreem(ws, conCreem) : Promise.resolve(null),
    ]);
    /**
     * Lo que cada pasarela aporta a la FILA del cobro, en una sola forma. ⚠️ Antes esto eran tres ternarios
     * `d.pasarela === 'stripe' ? stripe?.x : mp?.y` (el modo, el sufijo de cuenta y `cuenta_ref`), y con una tercera
     * pasarela los tres leían Mercado Pago: un cobro de Creem quedaba guardado con el sufijo de la cuenta de MP y con
     * el `user_id` de MP en `cuenta_ref`. Y `cuenta_ref` es justo lo que después ENCUENTRA la cuenta de un cobro
     * (`cuentaVivaDelCobro`, mig 0328), así que el cobro quedaba apuntando para siempre a la cuenta equivocada: no se
     * podía releer, ni devolver, ni cancelar.
     */
    const porPasarela: Readonly<Record<Pasarela, { cred: { cuenta: string } | null; ref: string | null }>> = {
      stripe: { cred: stripe, ref: stripe?.acct ?? null },
      mercadopago: { cred: mp, ref: mp?.userId ?? null },
      creem: { cred: creem, ref: creem?.webhookId ?? null },
    };
    if (pedida && !porPasarela[pedida.proveedor].cred) return { ok: false, error: 'Esa cuenta de cobro no está conectada.' };
    const conectadas: Pasarela[] = PASARELAS.filter((p) => porPasarela[p].cred);

    let producto: { id: number; nombre: string; tipo: TipoCobro; monto_usd: number | null } | null = null;
    let congelado: PlanCongelado | null = null;
    if (p.productoId) {
      const prod = (await listProductos(true)).find((x) => x.id === p.productoId);
      if (!prod) return { ok: false, error: 'Ese producto no está activo en el catálogo.' };
      // UN PRODUCTO EN CUOTAS (mig 0326) cobra su PRIMER pago: el resto es el plan que se arma al pagarse
      // (`prepararTratoDelPago`, lib/cobro-etapa-server.ts). Sin cuotas, su precio, como siempre.
      // El plan se CONGELA en el cobro (`plan_producto`): el trato del pago sale de lo que se cobró, no del producto de hoy.
      let primero: number | null;
      try {
        const cp = prod.tipo === 'suscripcion' ? null : await cobroDelProducto(prod.id);
        primero = cp?.primerPagoUsd ?? null;
        congelado = cp?.congelado ?? null;
      } catch (e) {
        return { ok: false, error: `No pude leer el producto: ${e instanceof Error ? e.message : String(e)}` };
      }
      producto = { id: prod.id, nombre: prod.nombre, tipo: prod.tipo === 'suscripcion' ? 'suscripcion' : 'unico', monto_usd: primero ?? prod.monto_usd };
    }
    const tipo: TipoCobro = p.tipo ?? producto?.tipo ?? 'unico';
    const email = (p.email ?? lead.email ?? '').trim().toLowerCase() || null;
    const nombre = (p.nombre ?? lead.nombre ?? '').trim() || null;
    if (altaCapa && !email) return { ok: false, error: 'Para dar de alta la cuenta hace falta el email de quien paga.', faltan: ['email'] };

    // Mercado Pago cobra en la moneda del sitio de SU cuenta: se le pregunta a la cuenta, no a una constante.
    const elegida = p.pasarela ?? pedida?.proveedor ?? (conectadas.length === 1 ? conectadas[0] : null);
    let cuentaMp: { moneda: string | null; modo: 'real' | 'prueba' } | null = null;
    if (elegida === 'mercadopago' && mp) {
      const c = await leerCuentaMp(mp.token);
      if (!c.ok) return { ok: false, error: `Mercado Pago: ${c.error}` };
      cuentaMp = { moneda: c.moneda, modo: c.modo };
    }

    const d = decidirCobro({
      pasarela: p.pasarela ?? pedida?.proveedor ?? null, conectadas, monto: p.monto, moneda: p.moneda,
      productoMontoUsd: cuota?.monto_usd ?? producto?.monto_usd ?? null, monedaDeLaCuenta: cuentaMp?.moneda ?? null, tipo, email,
    });
    if (!d.ok) return d;
    // ⚠️ EL VALOR EN DÓLARES DE UN LINK DE CUOTA ES EL DE LA CUOTA, no uno declarado aparte: al pagarse la marca
    // pagada por su monto (`registrarCobroDeProveedor` exige que coincidan). En dólares, el link cobra exactamente
    // la cuota; en otra moneda, la persona dice cuánto es en esa moneda y la cuota pone los dólares.
    if (cuota && d.moneda === 'USD' && !mismoCentavo(d.monto, cuota.monto_usd)) {
      return { ok: false, error: `El link de esta cuota cobra US$ ${cuota.monto_usd}. Para otro monto, edita la cuota primero.`, faltan: ['monto'] };
    }

    const montoUsd = cuota ? cuota.monto_usd : montoUsdDelCobro({ monto: d.monto, moneda: d.moneda, montoUsdDeclarado: p.montoUsd, productoMontoUsd: producto?.monto_usd });
    // Sin valor en USD el pago no podría asentarse en el CRM (pagos.monto_usd es NOT NULL) y el CRON «Pagos»
    // saldría sin `fecha_primer_pago`: se pide antes de crear el link, no después de cobrar.
    if (montoUsd == null) return { ok: false, error: `¿Cuánto es en dólares? Hace falta para tus reportes (se cobra en ${d.moneda}).`, faltan: ['montoUsd'] };
    const concepto = (p.concepto ?? '').trim() || (cuota ? (cuota.numero === 0 ? 'Cobro inicial' : `Cuota ${cuota.numero}`) : '') || producto?.nombre || (altaCapa ? `MaKo · plan ${capaDef(altaCapa).nombre}` : 'Pago');
    // El MODO (real o prueba) va aparte de la tabla de arriba porque el de Mercado Pago sale de `cuentaMp`, que se lee
    // más abajo con una consulta a su API. Igual por pasarela, nunca `stripe ? … : mp`.
    const modoPorPasarela: Readonly<Record<Pasarela, 'real' | 'prueba' | null>> = {
      stripe: stripe ? modoDeClaveStripe(stripe.key) : null,
      mercadopago: cuentaMp?.modo ?? null,
      creem: creem ? modoDeClaveCreem(creem.key) : null,
    };
    const modo = modoPorPasarela[d.pasarela] ?? 'real';
    const token = nuevoTokenCobro();
    const cuentaUsada = porPasarela[d.pasarela].cred?.cuenta ?? CUENTA_PRINCIPAL;

    const db = await getTenantDb();
    const { data: fila, error } = await db.from('cobros').insert({
      token, lead_id: lead.id, pago_id: cuota?.id ?? null, producto_id: producto?.id ?? null,
      proveedor: d.pasarela, modo, tipo, concepto: concepto.slice(0, 200), monto: d.monto, moneda: d.moneda,
      monto_usd: montoUsd, email, nombre: nombre?.slice(0, 200) ?? null, estado: 'pendiente',
      alta_capa: altaCapa, creado_por: p.creadoPor,
      // Mig 0308: sólo en el cobro de un cliente de agencia. Fuera de él no se mandan, así una base sin la migración no
      // rompe ningún otro cobro.
      ...(paraCliente ? { agencia_ws: paraCliente.agenciaWs, cliente_ws: paraCliente.clienteWs } : {}),
      ...(inicioAt ? { inicio_at: inicioAt } : {}),
      // Mig 0326: sólo con un producto con precio. Sin él no se manda (un cobro sin producto no la necesita).
      ...(congelado ? { plan_producto: congelado } : {}),
      // Mig 0328: el sufijo sólo si no es la principal (NULL es la principal: todo cobro de antes), y SIEMPRE el id de la
      // cuenta en el proveedor: es lo que la encuentra después aunque vuelva a conectarse con otro sufijo.
      ...(cuentaUsada !== CUENTA_PRINCIPAL ? { cuenta: cuentaUsada } : {}),
      cuenta_ref: porPasarela[d.pasarela].ref,
    }).select(COLS_COBRO).single();
    // ⚠️ DOS PEDIDOS A LA VEZ PARA LA MISMA CUOTA (mig 0295): el segundo choca con `cobros_un_link_vivo_por_cuota` y
    // se devuelve el link que ganó, como cuando ya existía (`yaEstaba`). Dos links vivos eran dos cobros de la misma plata.
    if (error && cuota && error.code === '23505' && /cobros_un_link_vivo_por_cuota/.test(error.message ?? '')) {
      const otra = await cuotaParaLink(lead.id, cuota.id);
      if (otra.ok && otra.pendiente) return { ok: true, cobro: otra.pendiente, link: linkDelCobro(otra.pendiente.token), yaEstaba: true };
    }
    // ⚠️ DOS PEDIDOS A LA VEZ PARA EL MISMO CLIENTE DE AGENCIA (mig 0308): el segundo choca con
    // `cobros_un_vivo_por_cliente_de_agencia` y se devuelve el cobro que ganó. Dos links vivos eran dos meses cobrados.
    if (error && paraCliente && error.code === '23505' && /cobros_un_vivo_por_cliente_de_agencia/.test(error.message ?? '')) {
      const { data: vivo } = await db.from('cobros').select(COLS_COBRO).eq('cliente_ws', paraCliente.clienteWs).eq('tipo', tipo)
        .in('estado', ['pendiente', 'fallido', 'pagado']).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (vivo) { const v = cobroDeFila(vivo as Record<string, unknown>); return { ok: true, cobro: v, link: linkDelCobro(v.token), yaEstaba: true }; }
    }
    if (error || !fila) return { ok: false, error: `No pude guardar el cobro: ${error?.message ?? 'sin respuesta'}` };
    const cobro = cobroDeFila(fila as Record<string, unknown>);

    // Lo que sigue NO tira (`cerrarCheckoutDelCobro`, lib/cobros-reglas.ts): una base que falla al guardar el link no pierde su ref.
    const cerrado = await cerrarCheckoutDelCobro({
      checkout: await crearCheckout(cobro, { stripe, mp, creem }, 0, { inicioAt }),
      guardar: (r) => actualizar(ws, cobro.id, { proveedor_ref: r.ref, url_proveedor: r.url, url_vence_at: r.venceAt }),
      // `soloSi`: un pago que se asentó en el medio no se pisa con «anulado». Con un ref, el link que no se pudo guardar también se
      // cierra en la pasarela (aunque la base no deje anular la fila), para que nadie lo pueda pagar.
      anular: async (a) => {
        try {
          return await actualizar(ws, cobro.id, { estado: 'anulado', motivo: a.motivo, ...(a.ref ? { proveedor_ref: a.ref, url_proveedor: a.url } : {}) }, { estado: ['pendiente', 'fallido'] });
        } finally {
          if (a.ref) await cerrarLinkEnLaPasarela(ws, { ...cobro, proveedor_ref: a.ref });
        }
      },
    });
    if (!cerrado.ok) return { ok: false, error: motivoSinDatos(cerrado.deLaPasarela ? `${NOMBRE_PASARELA[d.pasarela]}: ${cerrado.error}` : cerrado.error) };
    const listo = cerrado.guardado;
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

/**
 * EL CHECKOUT DE CREEM, que no se parece al de los otros dos y por eso vive aparte.
 *
 * ⚠️ CREEM NO COBRA SIN UN PRODUCTO. No existe el precio en línea de Stripe (`price_data`) ni el `unit_price` de una
 * preferencia de Mercado Pago: `POST /v1/checkouts` sólo acepta un `product_id`. Así que cada cobro CREA su producto
 * primero. Los dos POST llevan `Idempotency-Key` derivada del cobro y de la vuelta, que es lo que evita que un
 * reintento deje la cuenta del negocio llena de productos duplicados (la doc: «makes retries return the originally
 * created product instead of creating a duplicate»).
 *
 * EL 50% DEL PRIMER MES sale distinto que en las otras dos. Creem tiene descuento de UN SOLO ciclo de verdad
 * (`duration: 'once'`), así que la suscripción nace al precio LLENO con un código aplicado al primer pago, y el
 * segundo mes vuelve solo. Mercado Pago no tiene eso: allá la suscripción nace rebajada y lib/primer-mes.ts le sube el
 * monto a mano al entrar el primer pago. Un cobro de Creem NO necesita ese remiendo, y pasarlo por él lo rompería.
 */
async function crearCheckoutCreem(
  c: Cobro,
  cred: CredCreem,
  vuelta: number,
  extra: { inicioAt?: string | null },
): Promise<{ ok: true; ref: string; url: string; venceAt: string | null } | { ok: false; error: string }> {
  // ⚠️ EXPLÍCITO, NO EN SILENCIO: Creem no documenta ningún `start_date` al crear la suscripción (la prueba gratis se
  // hace con `trial_period_days`, que es otra cosa: son días desde HOY, no «empezá a cobrar el día X»). Un cobro de
  // agencia con primer cobro diferido caía antes en la rama de Mercado Pago y arrancaba a cobrar en el acto, un mes
  // antes, encima del mes ya pagado. Mejor no abrirlo y que se vea.
  // La prueba SÍ lleva `inicioAt`: es el día que MaKo anuncia, y lo difiere el `trial_period_days` del producto, de acá abajo.
  if (extra.inicioAt && !CAPACIDADES_PASARELA.creem.difiereElPrimerCobro && !esPruebaDePlan(c)) {
    return { ok: false, error: 'Creem no puede empezar a cobrar en una fecha futura. Usa Stripe o Mercado Pago para este cobro.' };
  }
  const recurrente = c.tipo === 'suscripcion';
  const idem = idemCobro(c.id, vuelta);
  const prod = await crearProductoCreem(cred.key, {
    idem: `prod-${idem}`, nombre: c.concepto, monto: c.monto, moneda: c.moneda, recurrente,
    diasDePrueba: recurrente && esPruebaDePlan(c) ? PRUEBA_DIAS : null,
  });
  if (!prod.ok) return { ok: false, error: prod.error };

  // El descuento de entrada, si este cobro lo lleva. Si Creem lo rechaza NO se sigue sin él: se le prometió la mitad.
  let codigoDescuento: string | null = null;
  const pct = pctDelPrimerMes(c.creado_por);
  if (pct) {
    const d = await crearDescuentoDeEntradaCreem(cred.key, {
      idem: `desc-${idem}`, codigo: `MAKO${c.id}${vuelta ? `V${vuelta}` : ''}`.toUpperCase(),
      nombre: `MaKo · ${pct}% del primer mes`, pct, productoId: prod.id,
    });
    if (!d.ok) return { ok: false, error: `No pude aplicar el descuento del primer mes: ${d.error}` };
    codigoDescuento = d.codigo;
  }

  const r = await crearCheckoutCreemAPI(cred.key, {
    idem, productoId: prod.id, token: c.token, email: c.email, nombre: c.nombre,
    successUrl: linkDeRetorno(c.token), codigoDescuento,
  });
  // El link de Creem no vence (no hay campo de vencimiento en el checkout): `venceAt` null, y `urlParaPagar` devuelve
  // el guardado sin rehacer nada.
  return r.ok ? { ok: true, ref: r.id, url: r.url, venceAt: null } : { ok: false, error: r.error };
}

async function crearCheckout(
  c: Cobro,
  cred: { stripe: CredStripe | null; mp: CredMp | null; creem: CredCreem | null },
  vuelta: number,
  extra: { inicioAt?: string | null } = {},
): Promise<{ ok: true; ref: string; url: string; venceAt: string | null } | { ok: false; error: string }> {
  // ⚠️ ESTE `if` ERA EL BUG MÁS CARO DE TODA LA PASARELA (31/10/2026). Era `if (c.proveedor === 'stripe') { … }` y
  // después, SIN else, caía a Mercado Pago. Con dos pasarelas eso es correcto; con tres, un cobro de Creem en un
  // negocio con Mercado Pago conectado le creaba una suscripción REAL en Mercado Pago, en la moneda de ESA cuenta, y
  // guardaba su id en el cobro de Creem. Se le cobraba plata a una persona por el proveedor equivocado sin un solo
  // error. Ahora es un `switch` y el `default` con `never` hace que la pasarela #4 no compile hasta tener su rama.
  switch (c.proveedor) {
    case 'creem': {
      if (!cred.creem) return { ok: false, error: 'Creem no está conectado.' };
      return crearCheckoutCreem(c, cred.creem, vuelta, extra);
    }
    case 'stripe':
    case 'mercadopago':
      break;
    default: {
      const _x: never = c.proveedor;
      return { ok: false, error: `Esa pasarela no sabe cobrar: ${String(_x)}` };
    }
  }
  if (c.proveedor === 'stripe') {
    if (!cred.stripe) return { ok: false, error: 'Stripe no está conectado.' };
    const r = await crearCheckoutStripe(cred.stripe.key, {
      idem: idemCobro(c.id, vuelta), tipo: c.tipo, concepto: c.concepto, monto: c.monto, moneda: c.moneda,
      email: c.email, token: c.token, ws: c.workspace_id, cobroId: c.id,
      successUrl: linkDeRetorno(c.token), cancelUrl: `${linkDeRetorno(c.token)}?cancelado=1`,
      // LA PRUEBA GRATIS (27/10/2026): sale del COBRO y no del pedido, así la sesión que se rehace al vencer (`urlParaPagar`)
      // también la trae. Sin esto, abrir el link al día siguiente cobraba el primer mes en el acto.
      diasDePrueba: esPruebaDePlan(c) ? PRUEBA_DIAS : null,
      // EL 50% DEL PRIMER MES (30/10/2026): también sale del COBRO, así la sesión que se rehace al vencer lo conserva.
      descuentoPct: pctDelPrimerMes(c.creado_por),
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
      // Con el 50% del primer mes nace rebajada, y se sube al entrar el primer pago (lib/primer-mes.ts): MP no tiene descuento de un cobro.
      idem: idemCobro(c.id, vuelta), concepto: c.concepto, monto: montoDelPrimerPago(c), moneda: c.moneda, email: c.email,
      token: c.token, volverUrl: linkDeRetorno(c.token), finAt: meses ? instanteMp(finDelPlazo(Date.now(), meses) - 86_400_000) : null,
      inicioAt: extra.inicioAt ? instanteMp(Date.parse(extra.inicioAt)) : null,
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
export async function urlParaPagar(c: Cobro): Promise<{ url: string } | { error: 'ya_pagado' | 'no_disponible' | 'pasarela' | 'desconectada'; detalle?: string }> {
  if (c.estado === 'pagado') return { error: 'ya_pagado' };
  if (c.estado !== 'pendiente' && c.estado !== 'fallido') return { error: 'no_disponible' };
  // La cuenta que lo cobra HOY (mig 0328). Desconectada, el link no abre aunque su URL siga viva en el proveedor: el pago
  // entraría a una cuenta de la que MaKo ya no se entera (revisión de plata del 22/10/2026; antes, Mercado Pago abría igual).
  const cuenta = await cuentaVivaDelCobro(c.workspace_id, c);
  if (c.proveedor === 'mercadopago') {
    if (!(await credMp(c.workspace_id, cuenta))) return { error: 'desconectada' };
    return c.url_proveedor ? { url: c.url_proveedor } : { error: 'no_disponible' };
  }
  if (c.proveedor === 'creem') {
    // ⚠️ SIN ESTA RAMA, UN COBRO DE CREEM CAÍA A STRIPE (31/10/2026): se le pedían las credenciales de Stripe y, con
    // Stripe conectado, se llegaba a `leerCheckoutStripe` con una ref de Creem (`ch_…` de otro proveedor) y se podía
    // terminar ARMANDO UNA SESIÓN DE STRIPE para un cobro de Creem.
    // El link de Creem no vence (su checkout no tiene vencimiento), así que no hay nada que rehacer: se devuelve el
    // guardado, como en Mercado Pago.
    if (!(await credCreem(c.workspace_id, cuenta))) return { error: 'desconectada' };
    return c.url_proveedor ? { url: c.url_proveedor } : { error: 'no_disponible' };
  }
  const stripe = await credStripe(c.workspace_id, cuenta);
  if (!stripe) return { error: 'desconectada' };
  // ⚠️ UNA PRUEBA DE STRIPE YA EMPEZADA (27/10/2026) sigue `pendiente` hasta el primer cobro: rehacer su sesión vencida abría
  // una SEGUNDA suscripción con otra prueba. Activada, o con la sesión ya completa (la vuelta la activa), va a /listo.
  if (esPruebaDePlan(c) && c.suscripcion_estado) return { error: 'ya_pagado' };
  if (c.url_proveedor && !urlPorVencer(c.url_vence_at, Date.now())) return { url: c.url_proveedor };
  // ⚠️ LA SESIÓN ANTERIOR, ANTES DE ARMAR OTRA (28/10/2026, la verificación de 3ca2d8328): se rehace a 5 minutos de vencer, y la
  // vieja seguía ABIERTA. Pagada en la pestaña vieja, la prueba no se activaba (se leía la nueva) y, si después pagaba también
  // la nueva, quedaban DOS suscripciones cobrando todos los meses; en un pago único, dos cobros. Completa, va a /listo;
  // abierta, se expira primero, y si no se pudo cerrar no se arma otra. Si no se puede LEER, tampoco (no se sabe si sigue
  // abierta); una que Stripe no tiene (404) no traba nada.
  if (c.proveedor_ref) {
    const s = await leerCheckoutStripe(stripe.key, c.proveedor_ref);
    if (!s.ok && s.status !== 404) {
      const viva = !!c.url_proveedor && Date.parse(c.url_vence_at ?? '') > Date.now();
      return viva ? { url: c.url_proveedor! } : { error: 'pasarela', detalle: s.error };
    }
    // ⚠️ UN PAGO DIFERIDO QUE FALLÓ (OXXO, Boleto, SEPA; la verificación de a196d5a93): su sesión queda `complete` SIN pagar y el
    // cobro `fallido`, y /listo ofrece «Volver a intentar». Ahí se arma otra; antes era un bucle /pagar → /listo para siempre.
    // Con el voucher todavía EN CURSO (el cobro sigue pendiente) no: se podría pagar dos veces.
    if (s.ok && s.estado === 'complete' && !(c.estado === 'fallido' && s.pagoEstado === 'unpaid')) return { error: 'ya_pagado' };
    // ⚠️ LA SUSCRIPCIÓN DE LA SESIÓN QUE FALLÓ SE CANCELA ANTES DE ARMAR OTRA (29/10/2026, la verificación de ddfa645d4): un SEPA que
    //    no se cobró deja la suscripción A VIVA con su primera factura abierta. Si Stripe la reintentaba y entraba, quedaban dos
    //    suscripciones cobrando todos los meses. Si no se puede cancelar (ni confirmar que ya lo está), no se arma otra.
    if (s.ok && s.estado === 'complete' && s.subscription) {
      const x = await cancelarSuscripcionStripe(stripe.key, s.subscription, idemCancelarFallida(c.id, s.id));
      if (!x.ok && x.status !== 404) {
        const sub = await leerSuscripcionStripe(stripe.key, s.subscription);
        if (!(sub.ok && sub.estado === 'canceled')) return { error: 'pasarela', detalle: x.error };
      }
    }
    if (s.ok && s.estado === 'open') {
      const x = await expirarCheckoutStripe(stripe.key, c.proveedor_ref);
      if (!x.ok) {
        const otra = await leerCheckoutStripe(stripe.key, c.proveedor_ref);
        if (otra.ok && otra.estado === 'complete') return { error: 'ya_pagado' };
        return c.url_proveedor ? { url: c.url_proveedor } : { error: 'pasarela', detalle: x.error };
      }
    }
  }
  const vuelta = Math.max(1, Math.floor((Date.parse(c.url_vence_at ?? '') || 0) / 60_000));
  const r = await crearCheckout(c, { stripe, mp: null, creem: null }, vuelta);
  if (!r.ok) return { error: 'pasarela', detalle: r.error };
  // ⚠️ La sesión nueva VUELVE el cobro a pendiente (la verificación de e6fd6d88d): si seguía `fallido` por el voucher anterior,
  // un SEGUNDO voucher en curso en ésta se leía como «falló» y se armaba otra más; pagadas las dos, dos cuotas.
  await actualizar(c.workspace_id, c.id, { proveedor_ref: r.ref, url_proveedor: r.url, url_vence_at: r.venceAt, estado: 'pendiente', motivo: null }, { estado: ['pendiente', 'fallido'] });
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
  /**
   * LO QUE COBRÓ la pasarela, para el RECIBO (5/11/2026, lib/recibos.ts): con impuesto en Creem (`amount_paid`), el monto real de
   * Mercado Pago. NO cambia lo que se asienta (la cuota sigue con `monto`). Sin él, el recibo lo relee a la pasarela
   * (`cobradoEnLaPasarela`): nunca imprime el precio de lista de un pago con cupón.
   */
  cobrado?: { monto: number | null; moneda?: string | null; impuesto?: number | null } | null;
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
    // Lo que se pagó en ESTE cobro. El primero puede tener el 50% (`cobro.monto` es la mensualidad: lib/primer-mes-reglas.ts).
    const montoDeEstePago = renovacion && p.monto != null ? p.monto : montoDelPrimerPago(actual);
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

    // 1c. ⚠️ EL RECIBO (5/11/2026, lib/recibos.ts): ANTES del CRM, que puede tirar (:856, :896) y cortaría acá. Sólo pagos reales
    //     de la PLATAFORMA, y nunca frena el pago (`.catch`): si no se puede armar, lo emite la red del cron. Se manda al final.
    const reciboId = await reciboDeEstePago(actual, p, renovacion)
      .catch((e) => { console.error(`[cobros] no pude emitir el recibo del cobro ${c.id}:`, e instanceof Error ? e.message : String(e)); return null; });

    // 2a. ⚠️ EL PLAZO de un producto con fin (15/10/2026). En Stripe se programa ACÁ (Checkout no acepta un fin); en Mercado
    //     Pago nació con él. ⚠️ ANTES DEL TRATO (revisión de plata del 22/10/2026, media 1): no depende de él, y si el aviso que
    //     ganó el pago (`nuevo`) perdía el reclamo del trato, se cortaba antes de programar el fin y la tarjeta se seguía
    //     cobrando pasado el mes 6 (el otro aviso no es `nuevo`). Y el lead que se GANA con este pago lo lleva (su `fecha_cierre` es hoy), así el MRR deja de
    //     contarla cuando se cumple. Hasta este día un producto «6 meses» se cobraba para siempre. Best effort: la plata
    //     ya entró; si falla, queda dicho (en el cobro, o en el log si no se pudo ni leer el plazo).
    //     El PLAZO se lee en todo primer pago, no sólo en el `nuevo` (segunda revisión de plata): el otro aviso es el que
    //     suele ganar al lead, y sin él escribía `suscripcion_meses = null` (el MRR la contaba sin fin). Programarlo en
    //     Stripe sí, sólo el `nuevo` (es idempotente igual).
    const plazo = actual.tipo === 'suscripcion' && !renovacion
      ? await plazoDelCobro(actual).catch((e) => { console.error(`[cobros] no pude leer el plazo del cobro ${c.id}:`, e instanceof Error ? e.message : String(e)); return null; })
      : null;
    if (plazo && nuevo && actual.proveedor === 'stripe' && actual.proveedor_suscripcion_id) actual = await programarPlazoStripe(actual, plazo);
    // Creem no sabe «terminá el día X»: se mira en CADA pago, primero o renovación, si éste fue el último ciclo del plazo.
    if (actual.proveedor === 'creem' && actual.tipo === 'suscripcion') actual = await programarPlazoCreem(actual);

    // 2b. Una suscripción NUEVA de la pasarela sobre un lead que ya era suscripción: la cancelada o con plazo vuelve a
    //     activa y sin fin (`reabrirSuscripcionDelLead`). Va antes de ganar, que no la toca si el lead ya ganó.
    if (actual.lead_id && actual.tipo === 'suscripcion' && nuevo && !renovacion) await reabrirSuscripcionDelLead(actual, autor);

    // 1b. ⚠️ EL TRATO DEL PAGO (mig 0326, «Vincular cobro»): un producto vinculado a la etapa Ganado de un CRM entra en el
    //     trato de ESE CRM, con su plan si va en cuotas; uno en cuotas sin vínculo arma su plan en la casa. null = el camino
    //     de siempre. Si falla, como el CRM de abajo: queda dicho en el cobro y el próximo aviso lo completa (se repite sin
    //     pisar nada: lib/cobro-etapa-server.ts).
    let trato: TratoDelPago | null = null;
    if (actual.lead_id && !renovacion) {
      try {
        trato = await prepararTratoDelPago(actual, { renovacion, fecha });
      } catch (e) {
        // Otro aviso del mismo pago lo está armando: no es una falla y no va al `motivo` (revisión de plata, baja 1). Si este
        // es el `nuevo` de un link anulado, su aviso (4b, abajo) se dice ACÁ: el otro aviso no lo dice (segunda revisión).
        if (!(e instanceof TratoEnCursoError)) {
          await actualizar(ws, c.id, { motivo: `El pago entró pero no pude prepararlo en su CRM: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) });
        } else if (porLinkAnulado && nuevo) {
          await logLeadEvent(actual.lead_id, 'Pago por un link anulado', avisoPagoPorLinkAnulado(false), autor);
        }
        throw e;
      }
      // Lo que el trato tiene que dejar dicho (un CRM archivado, una venta que ya estaba): una vez, al armarse.
      if (trato?.aviso && trato.nuevo) await logLeadEvent(actual.lead_id, 'Pago registrado', trato.aviso, autor);
      // Y las cuotas que quedaron sin armar, también en el cobro, para que alguien las cargue (revisión de plata, media 3).
      if (trato?.pendiente && trato.nuevo) {
        await logLeadEvent(actual.lead_id, 'Pago registrado', trato.pendiente, autor);
        actual = (await actualizar(ws, c.id, { motivo: trato.pendiente.slice(0, 300) })) ?? actual;
      }
    }

    // 2. El CRM: la cuota. Idempotente por (workspace, proveedor, proveedor_pago_id).
    let cuotaNueva = false;
    let cuotaAsentada = false;
    // Lo que vale ESTA cuota en dólares: lo que entra al cash y lo que dice el historial (revisión del 23/10/2026: el
    // historial decía el USD de lista de una renovación con descuento, y el cash otro).
    const montoUsd = renovacion
      ? montoUsdDeLaCuota({ montoCuota: p.monto, monedaCuota: p.moneda ?? actual.moneda, cobroMontoUsd: actual.monto_usd, cobroMonto: actual.monto, cobroMoneda: actual.moneda })
      : usdDelPrimerPago(actual);
    // Una cuota de cero (saldo a favor, cupón del 100%) queda asentada, pero no es «entró un pago»: ni el aviso al
    // equipo ni las automatizaciones de «Pagos» al lead.
    const enCero = renovacion && p.monto != null && Number(p.monto) === 0;
    if (actual.lead_id) {
      if (montoUsd == null) {
        // Sin valor en dólares no hay cuota (pagos.monto_usd es NOT NULL y nunca se inventa una tasa).
        // El cobro igual queda pagado y lo dice.
        await actualizar(ws, c.id, { motivo: `Pagado en ${actual.moneda} sin valor en USD: no entra al cash del CRM.` });
      } else {
        try {
          const r = await registrarCobroDeProveedor({
            leadId: actual.lead_id, cobroId: actual.id, pagoId: renovacion ? null : (actual.pago_id ?? trato?.pagoId ?? null), crm: trato?.pagoEn ?? null,
            proveedor: actual.proveedor, proveedorPagoId: p.proveedorPagoId, montoUsd,
            montoOriginal: montoDeEstePago, moneda: (renovacion && p.moneda) || actual.moneda, fechaPago: fecha,
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

    // 3. Ganar el lead (sólo si no está ganado): por setPipelineStage y la etapa de SU embudo,
    //    nunca escribiendo estado_lead a mano (tests/crm-curso-al-ganar.test.ts). Esto es lo que
    //    evita que el CRM automático le escriba «no agendaste» a quien pagó (docs/proyeccion-04oct.md §4.6).
    //    Con un vínculo (mig 0326): en el CRM del vínculo, y la casa sólo si el pago es suyo (una suscripción, o el vínculo
    //    es la casa misma). Un producto en cuotas gana por su PRECIO, no por el primer pago.
    if (actual.lead_id && (!trato || trato.ganaEnCasa)) await ganarLead(actual, autor, plazo, trato?.montoVenta ?? null);
    if (actual.lead_id && trato?.ganaEnCrm) await ganarEnSuCrm(actual, trato.ganaEnCrm, autor);

    // 4. El historial: una línea por cuota nueva, firmada por la pasarela.
    if (actual.lead_id && cuotaNueva) {
      await logLeadEvent(actual.lead_id, 'Pago registrado', textoPagoRegistrado({
        concepto: actual.concepto, monto: montoDeEstePago, moneda: (renovacion && p.moneda) || actual.moneda,
        montoUsd, pasarela: actual.proveedor, prueba, renovacion,
      }), autor);
    }

    // 4b. ⚠️ UN PAGO POR UN LINK ANULADO (15/10/2026): la plata entró y se registró arriba, pero se DICE, en el cobro y
    //     en el historial. Si la cuota del link ya estaba cobrada por otro lado, el pago entró como otra cuota: la plata
    //     entró dos veces. Antes entraba como una cuota cobrada más y nadie se enteraba. Sólo la corrida que ganó la
    //     transición (`nuevo`): un reintento no repite el aviso.
    // La pasarela que no puede cerrar el link (Creem): pagó uno anulado, y su suscripción cobraría TODOS los meses. Se corta acá.
    if (porLinkAnulado && nuevo && actual.tipo === 'suscripcion' && !CAPACIDADES_PASARELA[actual.proveedor].cierraElCheckout) {
      const corte = await cancelarSuscripcionCobro(ws, c.id, autor).catch((e) => ({ ok: false, resumen: e instanceof Error ? e.message : String(e) }));
      if (!corte.ok) console.error(`[cobros] el cobro ${c.id} se pagó por un link anulado y no pude cortar su suscripción: ${corte.resumen}`);
    }
    if (porLinkAnulado && nuevo) {
      const dosVeces = !!actual.pago_id && await cuotaCobradaPorOtroLado(actual.pago_id, p.proveedorPagoId);
      const aviso = avisoPagoPorLinkAnulado(dosVeces);
      if (dosVeces) actual = (await actualizar(ws, c.id, { motivo: aviso })) ?? actual;
      if (actual.lead_id) await logLeadEvent(actual.lead_id, 'Pago por un link anulado', aviso, autor);
    }

    // 5. La plataforma: el alta automática de MaKo (decisión de Martín, 11/10/2026).
    await altaSiCorresponde(actual);
    // 5b. La plataforma: el primer mes de un CLIENTE DE AGENCIA lo habilita solo (#866, 17/10/2026). No tira.
    if (!renovacion) await habilitarClienteDeAgencia(actual);
    // 5d. «Empezar mi plan ya» (25/10/2026): el plan desde hoy ya se cobró, la prueba que reemplaza se cancela. No tira.
    if (!renovacion) await cerrarPruebaAlEmpezarYa(actual);
    // 5e. La plataforma: quien pagó su plan queda en la lista de llamadas (30/10/2026, lib/compra-plan-llamada.ts). No tira.
    if (!renovacion) await anotarParaLlamar(actual);
    // Mercado Pago no vuelve solo al precio lleno. Si esto falla, lo reintenta el cron (`conciliarPrimerMes`): la plata ya entró.
    if (nuevo && !renovacion && actual.proveedor === 'mercadopago' && pctDelPrimerMes(actual.creado_por) != null) {
      await volverAlPrecioLleno(actual).catch((e) => console.error(`[cobros] no pude volver al precio lleno el cobro ${actual.id}:`, e instanceof Error ? e.message : String(e)));
    }
    // 5c. El negocio que se había PAUSADO por falta de pago y acaba de pagar su plan vuelve a entrar en el acto, sin
    //     esperar al cron (lib/plan-acceso.ts, 17/10/2026). Best effort: el cron lo vuelve a mirar en media hora.
    if (actual.alta_ws != null) {
      await revisarAccesosPorPago({ soloWs: actual.alta_ws }).catch((e) => console.warn(`[cobros] no pude revisar el acceso del negocio ${actual.alta_ws}:`, e instanceof Error ? e.message : String(e)));
    }

    // 6. Automations, DESPUÉS del CRM (con `fecha_primer_pago` ya escrita, el WhatsApp al lead sale solo y no
    //    como borrador, y la condición «Pagó» da bien): el aviso «Entró un pago» al grupo del equipo (un Evento
    //    de MaKo: sale sólo si el negocio agregó «Aviso de pago recibido» de la galería) y el CRON «Pagos» del
    //    lead. ⚠️ Atado a que la cuota ESTÉ, no a que ESTE intento la haya escrito (revisión del 11/10/2026): si
    //    un intento la insertó y se cortó antes de avisar, el reintento la encuentra «ya estaba» y antes no
    //    avisaba nunca. Repetir es seguro: el aviso deduplica por el pago del proveedor (3 días, lo que reintenta
    //    Stripe; un evento ya PROCESADO no vuelve a entrar por `pasarela_eventos`) y la inscripción es única.
    if (actual.lead_id && (nuevo || cuotaAsentada) && !enCero) {
      await avisarPagoRecibido(actual, { proveedorPagoId: p.proveedorPagoId, renovacion, monto: montoDeEstePago, moneda: (renovacion && p.moneda) || actual.moneda });
      await alCron(actual, 'aprobado');
    }

    // 7. EL RECIBO SALE (correo y WhatsApp) AL FINAL, después del aviso y del CRON: si Resend se cuelga, eso ya pasó (agujero 7).
    //    Nunca tira; el correo corta a los 15 s. Si no sale ahora, lo despacha la red del cron.
    if (reciboId) {
      const { despacharRecibo } = await import('./recibos');
      await despacharRecibo(reciboId);
    }

    return { nuevo, renovacion };
  });
}

/**
 * El recibo de ESTE pago (lib/recibos.ts). null si no corresponde (otro negocio, prueba) o si no se pudo armar todavía. Lo que
 * cobró la pasarela viene en `p.cobrado`, o se relee (`cobradoEnLaPasarela`). El valor en dólares es DECLARADO (el del cobro, o
 * el de la cuota de la renovación): nunca se calcula una tasa.
 */
async function reciboDeEstePago(c: Cobro, p: Parameters<typeof aplicarPagoAprobado>[1], renovacion: boolean): Promise<number | null> {
  if (c.modo !== 'real') return null;
  if (c.workspace_id !== (await wsSuperAdmin())) return null;
  const { reciboDelPago } = await import('./recibos');
  const montoUsd = renovacion
    ? montoUsdDeLaCuota({ montoCuota: p.monto, monedaCuota: p.moneda ?? c.moneda, cobroMontoUsd: c.monto_usd, cobroMonto: c.monto, cobroMoneda: c.moneda })
    : usdDelPrimerPago(c);
  const cobrado = p.cobrado?.monto != null && Number.isFinite(Number(p.cobrado.monto))
    ? { monto: Number(p.cobrado.monto), moneda: String(p.cobrado.moneda || p.moneda || c.moneda).toUpperCase(), impuesto: p.cobrado.impuesto ?? null, fecha: p.pagadoAt ?? null, montoUsd }
    : null;
  const r = await reciboDelPago(c, {
    proveedorPagoId: p.proveedorPagoId, cobrado, renovacion,
    releer: async () => { const x = await cobradoEnLaPasarela(c, p.proveedorPagoId); return x ? { ...x, fecha: x.fecha ?? p.pagadoAt ?? null, montoUsd } : null; },
  });
  return r?.id ?? null;
}

/**
 * LO QUE COBRÓ la pasarela por UN pago, releído con la clave de la cuenta del cobro (5/11/2026, los recibos). null = ese pago no
 * se encontró o todavía no trae el monto. TIRA si la pasarela no contesta: quien llama lo deja para la próxima vuelta.
 *   · Mercado Pago: `transaction_amount` del pago.
 *   · Creem: `amount_paid` de la transacción (CON impuesto, que va aparte en `impuesto`).
 *   · Stripe: lo pagado de la factura (`in_…`), o el total de la sesión del cobro si el pago es su payment intent.
 */
export async function cobradoEnLaPasarela(c: Cobro, proveedorPagoId: string): Promise<{ monto: number; moneda: string; impuesto: number | null; fecha: string | null } | null> {
  const { stripe, mp, creem } = await credsPorCuenta(c.workspace_id)(c);
  switch (c.proveedor) {
    case 'mercadopago': {
      if (!mp) return null;
      const x = await leerPagoMp(mp.token, proveedorPagoId);
      if (!x.ok) throw new Error(`Mercado Pago no contestó por el pago ${proveedorPagoId}: ${x.error}`);
      return x.monto != null && x.moneda ? { monto: x.monto, moneda: x.moneda, impuesto: null, fecha: x.fecha } : null;
    }
    case 'creem': {
      if (!creem) return null;
      const x = await leerTransaccionCreem(creem.key, proveedorPagoId);
      if (!x.ok) throw new Error(`Creem no contestó por la transacción ${proveedorPagoId}: ${x.error}`);
      const monto = x.montoPagado ?? x.monto;
      return monto != null && x.moneda ? { monto, moneda: x.moneda, impuesto: x.impuesto, fecha: x.fecha } : null;
    }
    case 'stripe': {
      if (!stripe) return null;
      if (proveedorPagoId.startsWith('in_')) {
        const f = await leerFacturaStripe(stripe.key, proveedorPagoId);
        if (!f.ok) throw new Error(`Stripe no contestó por la factura ${proveedorPagoId}: ${f.error}`);
        return f.montoPagado != null && f.moneda ? { monto: f.montoPagado, moneda: f.moneda, impuesto: null, fecha: null } : null;
      }
      if (!c.proveedor_ref) return null;
      const s = await leerCheckoutStripe(stripe.key, c.proveedor_ref);
      if (!s.ok) throw new Error(`Stripe no contestó por la sesión del cobro ${c.id}: ${s.error}`);
      return s.paymentIntent === proveedorPagoId && s.monto != null && s.moneda ? { monto: s.monto, moneda: s.moneda, impuesto: null, fecha: null } : null;
    }
    default: { const _x: never = c.proveedor; void _x; return null; }
  }
}

/**
 * Lo que un reembolso, una devolución fallida o un contracargo le hacen al RECIBO de ese pago (lib/recibos.ts). Sólo en la
 * PLATAFORMA (barrera en positivo) y NUNCA tira: esto corre en la devolución de cualquier negocio, y un recibo no la puede romper.
 */
async function conElReciboDelPago(c: Cobro, fn: (r: typeof import('./recibos')) => Promise<void>): Promise<void> {
  try {
    if (c.modo !== 'real' || c.workspace_id !== (await wsSuperAdmin())) return;
    await fn(await import('./recibos'));
  } catch (e) {
    console.error(`[cobros] el recibo del cobro ${c.id} no se pudo actualizar:`, e instanceof Error ? e.message : String(e));
  }
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
    const { estado: alta, sinMail } = await altaDelPago(c);
    const cuenta = lineaDelAlta(c, alta, sinMail);
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
        renovacion: p.renovacion, modo: c.modo, alta, altaSinMail: sinMail,
      }),
    });
  } catch (e) {
    console.error(`[cobros] no pude avisar el pago del cobro ${c.id}:`, e instanceof Error ? e.message : String(e));
  }
}

/**
 * En una venta de MaKo, cómo quedó el alta (relee el cobro: el alta corre al lado del pago), y si el mail de acceso NO
 * salió. estado null fuera de una venta de MaKo.
 */
async function altaDelPago(c: Cobro): Promise<{ estado: EstadoAlta | null; sinMail: boolean }> {
  if (!c.alta_capa) return { estado: null, sinMail: false };
  const fresco = await getCobro(c.workspace_id, c.id).catch(() => null);
  return { estado: fresco?.alta_estado ?? c.alta_estado, sinMail: mailDeAccesoNoSalio(fresco?.alta_motivo ?? c.alta_motivo) };
}

/**
 * En una venta de MaKo, cómo quedó el alta (para el aviso al super admin), con lo que leyó `altaDelPago`.
 *
 * ⚠️ «LE LLEGÓ EL ACCESO» SÓLO SI EL MAIL SALIÓ (revisión del 23/10/2026): con Resend caído el alta queda 'hecha' y el
 * fallo vive en `alta_motivo`; el aviso decía igual que le llegó, y nadie le pasaba el acceso a mano.
 */
function lineaDelAlta(c: Cobro, estado: EstadoAlta | null, sinMail = false): string {
  if (!c.alta_capa) return '';
  if (estado === 'hecha' && sinMail) return ` ⚠️ Su cuenta de MaKo (plan ${capaDef(c.alta_capa).nombre}) ya está creada, pero el mail de acceso NO salió: pásale el link de entrada a mano.`;
  if (estado === 'hecha') return ` Su cuenta de MaKo (plan ${capaDef(c.alta_capa).nombre}) ya está creada y le llegó el acceso.`;
  if (estado === 'ya_tenia_cuenta') return ' Ese email ya tenía una cuenta de MaKo: el plan NO se cambió solo, revísalo en Admin › Sales.';
  if (estado === 'error') return ' ⚠️ El alta de su cuenta falló: revísalo en Admin › Sales.';
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
/** Las claves de Creem con las que se cobró ESTE cobro. Lo que cambia un plan o una oferta va por acá, no por la cuenta principal. */
export async function credCreemDelCobro(c: Pick<Cobro, 'workspace_id' | 'proveedor' | 'cuenta' | 'cuenta_ref'>): Promise<CredCreem | null> {
  return credCreem(c.workspace_id, await cuentaVivaDelCobro(c.workspace_id, c));
}

const PREFIJO_PLAZO_CREEM = 'No pude programar en Creem el fin';

/**
 * EL PLAZO EN CREEM (31/10/2026). Mercado Pago nace con su fin y Stripe lo programa con una fecha; Creem no tiene ninguna de
 * las dos, y por eso una suscripción de 6 meses seguía cobrando el séptimo mientras MaKo la mostraba terminada. Lo único que sabe
 * es «baja al fin del período en curso», así que se agenda cuando el período que acaba de pagarse es el ÚLTIMO
 * (`tocaCerrarElPlazo`). Lo llaman cada pago y, una vez por día, `asegurarPlazosCreem` (un aviso perdido no agrega un mes).
 * Idempotente: una ya agendada no está `active`. Best effort, como la de Stripe: la plata ya entró.
 */
async function programarPlazoCreem(c: Cobro): Promise<Cobro> {
  try {
    const meses = await plazoDelCobro(c);
    if (!meses || !c.proveedor_suscripcion_id) return c;
    const decir = async (por: string) =>
      (await actualizar(c.workspace_id, c.id, { motivo: `${PREFIJO_PLAZO_CREEM} de los ${meses} meses: cancélala a mano al cumplirse (${por}).`.slice(0, 300) })) ?? c;
    const creem = await credCreemDelCobro(c);
    if (!creem) return decir('Creem no está conectado');
    const s = await leerSuscripcionCreem(creem.key, c.proveedor_suscripcion_id);
    if (!s.ok) throw new Error(s.error);
    // Desde que nació la suscripción: `pagado_at` es cuándo lo PROCESÓ MaKo, y un aviso atrasado correría el plazo un ciclo.
    const inicioMs = Date.parse(s.creadaAt ?? c.pagado_at ?? '');
    if (!tocaCerrarElPlazo({ inicioMs, meses, finDelPeriodo: s.finDelPeriodo, estado: s.estado })) return c;
    const r = await cancelarSuscripcionCreem(creem.key, c.proveedor_suscripcion_id, `${idemBaja(c.id)}-plazo`, true);
    if (!r.ok) return decir(r.error);
    return c.motivo?.startsWith(PREFIJO_PLAZO_CREEM) ? (await actualizar(c.workspace_id, c.id, { motivo: null })) ?? c : c;
  } catch (e) {
    console.error(`[cobros] no pude programar el fin del plazo del cobro ${c.id} en Creem:`, e instanceof Error ? e.message : String(e));
    return c;
  }
}

/** La red de `programarPlazoCreem`: las suscripciones de Creem vivas con producto. Una vez por día, desde el cron. Nunca tira. */
export async function asegurarPlazosCreem(ws: number): Promise<void> {
  const { data, error } = await getSupabaseServer().from('cobros').select(COLS_COBRO)
    .eq('workspace_id', ws).eq('proveedor', 'creem').eq('tipo', 'suscripcion').eq('suscripcion_estado', 'activa').eq('estado', 'pagado')
    .not('producto_id', 'is', null).limit(500);
  if (error) { console.warn(`[cobros] no pude leer los plazos de Creem del ws ${ws}: ${error.message}`); return; }
  // Con el negocio fijado: el plazo se lee del catálogo de ESE negocio, y sin esto `getTenantDb` no sabe de cuál.
  await runWithWorkspace(ws, async () => {
    for (const f of data ?? []) await programarPlazoCreem(cobroDeFila(f as Record<string, unknown>));
  });
}

async function programarPlazoStripe(c: Cobro, meses: number): Promise<Cobro> {
  try {
    const stripe = await credStripe(c.workspace_id, await cuentaVivaDelCobro(c.workspace_id, c));
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

async function ganarLead(c: Cobro, autor: string, plazo: number | null = null, montoVenta: number | null = null): Promise<void> {
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
      monto: c.tipo === 'unico' ? (montoVenta ?? c.monto_usd) : null,
      requisitos: { omitir: `Pago confirmado por ${NOMBRE_PASARELA[c.proveedor]}` },
    });
  } catch (e) {
    // Mover nunca puede tumbar el registro del pago: queda dicho en el cobro y en los logs.
    console.error(`[cobros] no pude pasar a Ganado el lead ${lead.id}:`, e instanceof Error ? e.message : String(e));
    await actualizar(c.workspace_id, c.id, { motivo: `Pagado, pero no pude pasarlo a Ganado: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) });
  }
}

/**
 * Gana al lead en el CRM del vínculo de su producto (mig 0326). Como `ganarLead`: mover nunca tumba el registro del pago,
 * queda dicho en el cobro y en los logs.
 */
async function ganarEnSuCrm(c: Cobro, g: { crm: number; etapa: string }, autor: string): Promise<void> {
  if (!c.lead_id) return;
  try {
    await ganarEnElCrm(c.lead_id, g, autor);
  } catch (e) {
    console.error(`[cobros] no pude pasar a Ganado el lead ${c.lead_id} en el CRM ${g.crm}:`, e instanceof Error ? e.message : String(e));
    await actualizar(c.workspace_id, c.id, { motivo: `Pagado, pero no pude pasarlo a Ganado en su CRM: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) });
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
  // La PRUEBA GRATIS (25/10/2026) da de alta al AUTORIZARLA (la tarjeta quedó cargada): su primer pago llega el día 8.
  const pruebaAutorizada = esPruebaDePlan(c) && c.estado === 'pendiente' && c.suscripcion_estado === 'activa';
  if (!c.alta_capa || (c.estado !== 'pagado' && !pruebaAutorizada)) return;
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
    await asentarAlta(c, plataforma, r.workspace, r.invitacion.enviado ? null : `${PREFIJO_MAIL_NO_SALIO}: ${r.invitacion.error ?? 'sin detalle'}`,
      pruebaAutorizada ? 'Alta por la prueba gratis' : undefined);
  } else if (r.yaExiste) {
    // ⚠️ ¿LA CUENTA LA CREÓ ESTE MISMO COBRO, en un intento que se cortó? (revisión del 23/10/2026). Si la función murió entre
    // crear al usuario y anotar «hecha», el reintento encontraba el email y lo daba por «ya tenía cuenta»: el comprador nuevo
    // quedaba sin el plan atado, sin origen y sin «Darme de baja». Se termina el alta con esa cuenta. El mail pudo no haber
    // salido: se dice, y la persona se lo pasa a mano.
    const propia = await cuentaDeUnAltaCortada(c, plataforma).catch(() => null);
    if (propia) {
      await asentarAlta(c, plataforma, propia, `${PREFIJO_MAIL_NO_SALIO}: el alta se cortó y se terminó en un reintento, no sé si el mail llegó`);
      return;
    }
    // Ya es usuario (un upgrade, o alguien de otro negocio): NO se le toca la capa a ciegas. Lo
    // resuelve una persona desde /admin/cobros.
    await actualizar(plataforma, c.id, { alta_estado: 'ya_tenia_cuenta', alta_motivo: 'Ese email ya tiene una cuenta de MaKo: el plan no se cambió solo.' });
  } else {
    await actualizar(plataforma, c.id, { alta_estado: 'error', alta_motivo: r.error.slice(0, 300) });
  }
}

/**
 * Anota el alta HECHA en el cobro y ata el lead del comprador (en el CRM de la plataforma) a su cuenta: así lo lista
 * Customer Success (molde: crearCuentaMakoAction, app/customer-success/actions.ts). `motivo`: lo que la persona tiene que
 * saber (que el mail de acceso no salió), o null.
 */
async function asentarAlta(c: Cobro, plataforma: number, cuenta: { id: number; nombre: string }, motivo: string | null, como = 'Alta automática por el pago'): Promise<void> {
  await actualizar(plataforma, c.id, { alta_estado: 'hecha', alta_ws: cuenta.id, alta_motivo: motivo ? motivo.slice(0, 300) : null });
  if (!c.lead_id || !c.alta_capa) return;
  const db = await getTenantDb();
  const { error: e2 } = await db.from('leads').update({ cliente_ws: cuenta.id }).eq('id', c.lead_id);
  if (e2) console.error(`[cobros] no pude atar el lead ${c.lead_id} a su cuenta ${cuenta.id}: ${e2.message}`);
  await logLeadEvent(c.lead_id, 'Cuenta de MaKo', `${como}: «${cuenta.nombre}», plan ${capaDef(c.alta_capa).nombre}`, NOMBRE_PASARELA[c.proveedor]);
  // El ORIGEN de la cuenta (de qué landing / funnel de MaKo vino) para su onboarding: lib/origen-cuenta.ts.
  // Accesorio: la cuenta ya existe.
  try { await guardarOrigenDeAlta(cuenta.id, c.lead_id, c.id); } catch (e) { console.error(`[cobros] origen de la cuenta ${cuenta.id}: ${e instanceof Error ? e.message : String(e)}`); }
  try { await guardarWhatsappDelPago(cuenta.id, c.lead_id, c.id); } catch (e) { console.error(`[cobros] WhatsApp de la cuenta ${cuenta.id}: ${e instanceof Error ? e.message : String(e)}`); }
}

/**
 * La cuenta que creó un intento CORTADO de esta misma alta, o null. Es la del usuario de ese email si: la creó un pago de
 * esta pasarela (`invitado_por = pago:<pasarela>`), es el admin de un negocio, nació después del cobro, y ningún OTRO cobro
 * de la plataforma la tiene como suya (así una segunda compra con el mismo email sigue siendo «Ya tenía cuenta»).
 */
async function cuentaDeUnAltaCortada(c: Cobro, plataforma: number): Promise<{ id: number; nombre: string } | null> {
  if (!c.email) return null;
  const u = await buscarUsuarioPorEmail(c.email);
  if (!u || u.invitado_por !== `pago:${c.proveedor}` || u.workspace_id == null || u.rol_ws !== 'admin') return null;
  if (!(Date.parse(u.created_at) >= Date.parse(c.created_at))) return null;
  const { data, error } = await getSupabaseServer().from('cobros').select('id')
    .eq('workspace_id', plataforma).eq('alta_ws', u.workspace_id).neq('id', c.id).limit(1);
  if (error || (data ?? []).length) return null;
  const w = await getWorkspace(u.workspace_id);
  return w ? { id: w.id, nombre: w.nombre } : null;
}

/**
 * «Darle el plan a su cuenta»: un cobro «Ya tenía cuenta» (quien pagó ya era usuario de MaKo) queda atado a ESA cuenta y
 * el negocio pasa a la capa del plan que pagó. Lo decide una persona desde /admin/cobros: el alta no le cambia la capa a
 * nadie a ciegas (`altaSiCorresponde`), pero sin esto el comprador quedaba pagando sin su plan y no había cómo atarlo
 * (revisión del 23/10/2026). Sólo si el email es el ADMIN de un negocio que ningún otro cobro tiene como suyo.
 */
export async function atarCobroASuCuenta(ws: number, id: number, autor: string): Promise<{ ok: boolean; resumen: string }> {
  const plataforma = await wsSuperAdmin();
  if (ws !== plataforma) return { ok: false, resumen: 'Sólo los cobros de MaKo se atan a una cuenta.' };
  const c = await getCobro(ws, id);
  if (!c) return { ok: false, resumen: 'No encontré ese cobro.' };
  if (c.estado !== 'pagado' || c.alta_estado !== 'ya_tenia_cuenta' || !c.alta_capa || !c.email) {
    return { ok: false, resumen: 'Sólo se ata un cobro pagado que quedó en «Ya tenía cuenta».' };
  }
  if (!esCapaVendible(c.alta_capa)) return { ok: false, resumen: 'Ese plan no se puede asignar.' };
  const u = await buscarUsuarioPorEmail(c.email);
  if (!u || u.workspace_id == null) return { ok: false, resumen: 'No encontré una cuenta de MaKo con ese email.' };
  if (u.workspace_id === plataforma) return { ok: false, resumen: 'Ese email es del equipo de MaKo: no se le asigna un plan.' };
  if (u.rol_ws !== 'admin') return { ok: false, resumen: 'Ese email es del equipo de otro negocio, no su dueño: no lo ato solo.' };
  const { data: otro, error } = await getSupabaseServer().from('cobros').select('id')
    .eq('workspace_id', plataforma).eq('alta_ws', u.workspace_id).neq('id', c.id)
    // Sólo lo que TODAVÍA cobra (la lectura de «suscripción viva» de /admin/cobros): cortar uno de verdad destraba, y una
    // suscripción devuelta pero viva sí traba (revisión del diff, 23/10/2026).
    .eq('tipo', 'suscripcion').in('estado', ['pagado', 'reembolsado']).or('suscripcion_estado.is.null,suscripcion_estado.neq.cancelada').limit(1);
  if (error) throw new Error(`No pude revisar los cobros de esa cuenta: ${error.message}`);
  if ((otro ?? []).length) return { ok: false, resumen: 'Esa cuenta ya tiene otra suscripción de MaKo que se sigue cobrando: córtala primero.' };
  const w = await getWorkspace(u.workspace_id);
  if (!w) return { ok: false, resumen: 'Esa cuenta ya no existe.' };
  if (w.capa !== c.alta_capa) await actualizarWorkspace(w.id, { capa: c.alta_capa });
  await asentarAlta(c, plataforma, { id: w.id, nombre: w.nombre }, null, `Atado a mano a su cuenta por ${autor}`);
  return { ok: true, resumen: `Listo: «${w.nombre}» queda con el plan ${capaDef(c.alta_capa).nombre} y este cobro.` };
}

/**
 * Un pago rechazado. Un cobro ya pagado NO vuelve atrás: es la renovación la que falló, y lo dice el historial.
 * ⚠️ SÓLO SOBRE LA SESIÓN QUE SE LEYÓ (29/10/2026, la verificación de ddfa645d4): si entre la lectura y esta escritura «Volver a
 *    intentar» armó otra (`urlParaPagar` cambia `proveedor_ref` y vuelve el cobro a `pendiente`), el fallo de la anterior no la toca.
 */
const rechazoALaAgencia = (cobroId: number): Promise<void> => import('./plan-deuda').then((m) => m.avisarRechazoALaAgencia(cobroId));

export async function aplicarPagoFallido(c: Cobro, motivo: string): Promise<void> {
  await runWithWorkspace(c.workspace_id, async () => {
    // ⚠️ EL COBRO DEL DÍA 8 DE UNA PRUEBA AUTORIZADA QUE SE RECHAZA NO LA SACA DE «PENDIENTE» (31/10/2026). En `fallido` dejaba de ser
    // su plan: `suscripcionDeMakoDe` daba null («tu plan no se cobra por la pasarela», sin baja) y la vigencia, «sin pasarela», o
    // sea acceso sin deuda y sin corte, mientras la pasarela reintentaba con la tarjeta guardada. Sigue en prueba, y
    // `vigenciaDeLaPrueba` da la mora desde ese día, que es lo que ya dice para una prueba que no se cobró.
    if (c.estado === 'pendiente' && esPruebaDePlan(c) && c.suscripcion_estado) {
      await actualizar(c.workspace_id, c.id, { motivo: motivo.slice(0, 300) }, { estado: ['pendiente'] });
      if (c.lead_id) {
        await logLeadEvent(c.lead_id, 'Pago rechazado', `${c.concepto}: ${motivo}`.slice(0, 300), NOMBRE_PASARELA[c.proveedor]);
        await alCron(c, 'rechazado');
      }
      return;
    }
    if (c.estado === 'pendiente') {
      const r = await actualizar(c.workspace_id, c.id, { estado: 'fallido', motivo: motivo.slice(0, 300) }, { estado: ['pendiente'], ref: c.proveedor_ref });
      if (r && c.lead_id) {
        await logLeadEvent(c.lead_id, 'Pago rechazado', `${c.concepto}: ${motivo}`.slice(0, 300), NOMBRE_PASARELA[c.proveedor]);
        await alCron(c, 'rechazado');
      }
      // La suscripción autorizada de un cliente de agencia todavía no cobró, y la primera renovación que rechazan pasa por acá (ticket
      // #37). Sin autorizar (`null`), la está pagando ella en pantalla y no hay ningún reintento que anunciarle.
      if (r && c.tipo === 'suscripcion' && c.suscripcion_estado === 'activa') await rechazoALaAgencia(c.id);
      return;
    }
    if (c.estado === 'pagado' && c.tipo === 'suscripcion' && c.lead_id) {
      // El prefijo lo LEE `cobradoDelLead` (lib/cobrado-lead.ts): es lo que pinta en rojo una renovación rechazada
      // de un cobro que sigue «Pagado». Y lo borra la próxima renovación que entre (`aplicarPagoAprobado`).
      await actualizar(c.workspace_id, c.id, { motivo: `${PREFIJO_RENOVACION_FALLIDA}: ${motivo}`.slice(0, 300) });
      await logLeadEvent(c.lead_id, 'Pago rechazado', `Renovación de ${c.concepto}: ${motivo}`.slice(0, 300), NOMBRE_PASARELA[c.proveedor]);
      await alCron(c, 'rechazado');
      // Una vez por período: la pasarela reintenta varias veces, y la próxima renovación que entre borra este motivo.
      if (!esRenovacionFallida(c.motivo)) await rechazoALaAgencia(c.id);
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
    // EL RECIBO de ese pago queda devuelto (5/11/2026, lib/recibos.ts): ANTES del `return` del parcial. Sólo la plataforma, y
    // nunca tira (esto corre en todos los negocios).
    await conElReciboDelPago(c, async (r) => r.marcarDevolucionDeRecibo(c.proveedor, pagoId, { total: p.total }));
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
      // ⚠️ EL PLAN QUE ARMÓ ESTE PAGO (mig 0326, revisión adversarial, media 5): devuelto el primer pago, las cuotas que
      // quedaban de ese plan dejan de ser deuda (de baja, con su historial), en vez de seguir recordándole a quien le
      // devolvieron la plata. Best effort: el reembolso ya está; si falla, queda en el log.
      // En CADA reembolso total del lead, no sólo el del primer pago (segunda revisión de plata): devolver primero el
      // primer pago y después la cuota 1 dejaba la cuota 2 como deuda.
      try {
        for (const plan of await planesDevueltosDelLead(c.lead_id)) {
          // ⚠️ La decisión es `decidirBajaDelPlan` (lib/cobro-etapa.ts, con test de comportamiento): sólo si nada sigue
          // pagando ESTA compra (una cuota del plan, u otro cobro pagado del mismo producto), y la baja es SÓLO de las
          // cuotas del plan, por id: nunca la deuda de otra compra del mismo trato (tercera revisión de plata).
          const otroPago = plan.productoId != null && await otroCobroPagadoDelProducto(c.lead_id, plan.productoId, plan.cobroId);
          const d = decidirBajaDelPlan({ cuotasPlan: plan.cuotasPlan, cuotasDelTrato: await getPagosByLead(c.lead_id, plan.pagoEn), otroPagoDelProducto: otroPago });
          if (d.accion === 'sostiene') {
            if (plan.cobroId === c.id) {
              await logLeadEvent(c.lead_id, 'Pago reembolsado', d.por === 'otro-pago'
                ? 'Se devolvió el primer pago del plan, pero hay otro pago del mismo producto: sus cuotas siguen como deuda. Revísalas en Pagos.'
                : 'Se devolvió el primer pago del plan, pero quedan cuotas de ese plan cobradas: las demás siguen como deuda. Si se devuelven también, se dan de baja solas.', NOMBRE_PASARELA[c.proveedor]);
            }
            continue;
          }
          // Nada que dar de baja: el plan queda cerrado, para que un reembolso de otra cosa no vuelva a pasar por él.
          if (d.accion === 'cerrar') { await marcarBajaPorReembolso(plan.cobroId, true, null); continue; }
          const { darDeBajaCliente } = await import('./pagos-baja');
          const r = await darDeBajaCliente(c.lead_id, NOMBRE_PASARELA[c.proveedor], plan.pagoEn, { soloIds: d.ids });
          if (r.ok) await marcarBajaPorReembolso(plan.cobroId, true, c.id, r.ids ?? d.ids, r.bajaAt ?? null);
        }
      } catch (e) {
        console.error(`[cobros] no pude revisar los planes devueltos del lead ${c.lead_id}:`, e instanceof Error ? e.message : String(e));
      }
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
    // El recibo vuelve a «emitido» si la plata volvió (sin correo). Sólo la plataforma; nunca tira.
    await conElReciboDelPago(c, async (r) => r.marcarDevolucionFallidaDeRecibo(c.proveedor, pagoId, { sigueDevuelto: p.sigueDevuelto }));
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
      // La baja del plan que hizo el reembolso, deshecha (revisión de plata, baja 2): la plata volvió al negocio, así que
      // las cuotas vuelven a ser deuda. Best effort, como el reembolso.
      // ⚠️ SE VUELVE A DECIDIR CON LO DE HOY (cuarta revisión de plata): cada plan del lead que un reembolso dio de baja,
      // con la misma regla que lo dio de baja (`decidirBajaDelPlan`). Si ahora algo lo sostiene (la cuota que esta
      // devolución fallida volvió a cobrar, u otro pago del producto), se deshace. Mirar sólo «quién disparó la baja»
      // dejaba de baja la cuota 2 cuando fallaba la devolución del primer pago y la baja la había disparado la cuota 1.
      // El deshacer devuelve SÓLO lo que dio de baja ese reembolso (`bajaIds`), no lo que un closer dio de baja a mano.
      if (c.lead_id) {
        try {
          for (const plan of await planesDadosDeBajaDelLead(c.lead_id)) {
            // Sólo lo pagado ANTES de la baja: una recompra posterior es otra compra (quinta revisión de plata).
            const otroPago = plan.productoId != null && await otroCobroPagadoDelProducto(c.lead_id, plan.productoId, plan.cobroId, { antesDe: plan.bajaAt });
            const d = decidirBajaDelPlan({ cuotasPlan: plan.cuotasPlan, cuotasDelTrato: await getPagosByLead(c.lead_id, plan.pagoEn), otroPagoDelProducto: otroPago });
            if (d.accion !== 'sostiene') continue;
            const { deshacerBajaCliente } = await import('./pagos-baja');
            const r = await deshacerBajaCliente(c.lead_id, NOMBRE_PASARELA[c.proveedor], plan.pagoEn, { soloIds: plan.bajaIds.length ? plan.bajaIds : plan.cuotasPlan, bajaAt: plan.bajaAt ?? undefined });
            if (r.ok) await marcarBajaPorReembolso(plan.cobroId, false);
          }
        } catch (e) {
          console.error(`[cobros] no pude deshacer la baja del plan del cobro ${c.id}:`, e instanceof Error ? e.message : String(e));
        }
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
    // El recibo lo dice (lo ve sólo SuperAdmin): nunca sale un correo ni un WhatsApp por un contracargo. Nunca tira.
    await conElReciboDelPago(c, async (r) => r.marcarDisputaDeRecibo(c.proveedor, pagoId, { texto: p.texto, plataAfuera: p.plataAfuera }));
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
  // Cada cuenta de Stripe que cobra tiene su aviso (varias por proveedor, 22/10/2026).
  for (const x of (await cuentasDePago(ws, 'stripe')).filter((y) => y.conectada)) {
    const stripe = await credStripe(ws, x.cuenta);
    if (stripe) await asegurarEventosDelAviso(ws, stripe.key, x.cuenta);
  }
}

/**
 * Que el aviso de cada cuenta de Creem llegue con su id (`repararAvisoCreem`). Lo llama el cron en CADA vuelta y no una vez por día:
 * mientras esté roto, cada pago rebota con 401, y es sólo un GET cuando ya está bien. Nunca tira: una cuenta no frena a las otras.
 */
export async function mantenerAvisosCreem(ws: number): Promise<void> {
  for (const x of (await cuentasDePago(ws, 'creem')).filter((y) => y.conectada)) {
    const creem = await credCreem(ws, x.cuenta);
    if (!creem) continue;
    const r = await repararAvisoCreem(creem.key, creem.webhookId, urlAvisoCreem());
    if (!r.ok) console.error(`[cobros] el aviso de Creem de la cuenta ${x.cuenta} del ws ${ws} no se pudo revisar: ${r.error}`);
    else if (r.reparado) console.warn(`[cobros] el aviso de Creem de la cuenta ${x.cuenta} del ws ${ws} no llevaba su id: reparado`);
  }
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
  await cerrarLinkEnLaPasarela(ws, c);
  if (c.lead_id) await runWithWorkspace(ws, () => logLeadEvent(c.lead_id!, 'Link de pago', `Anulado: ${c.concepto}`, autor));
  return { ok: true };
}

/**
 * El link se CIERRA también del lado de la pasarela: Stripe expira la sesión; Mercado Pago vence la preferencia
 * (`vencerPreferenciaMp`) o cancela la suscripción que nadie autorizó todavía. Hasta el 15/10/2026 MP quedaba
 * abierto. Si el cierre falla (o MP lo ignora), un pago que igual entre se registra CON su aviso
 * (`avisoPagoPorLinkAnulado`, en aplicarPagoAprobado). Lo comparten `anularCobro` y `crearCobro` (el link que se creó y no se pudo guardar).
 * ⚠️ NUNCA TIRA: el cobro YA está anulado. Buscar su cuenta (mig 0328) puede tirar si la base no contesta, y cortar acá
 * decía «No pude anular» de algo anulado, y `anularLinksDeCuota` dejaba vivos los otros links de una cuota ya pagada.
 */
async function cerrarLinkEnLaPasarela(ws: number, c: Cobro): Promise<void> {
  try {
    if (c.proveedor === 'stripe' && c.proveedor_ref) {
      const stripe = await credStripe(ws, await cuentaVivaDelCobro(ws, c));
      if (stripe) {
        const e = await expirarCheckoutStripe(stripe.key, c.proveedor_ref);
        if (!e.ok) console.warn(`[cobros] no pude expirar la sesión ${c.proveedor_ref}: ${e.error}`);
      }
    } else if (c.proveedor === 'creem' && c.proveedor_ref) {
      // ⚠️ EL `if/else if` NO TENÍA else Y CREEM SE CAÍA POR EL HUECO (31/10/2026): un link de Creem anulado en MaKo
      // quedaba ABIERTO y pagable en Creem, sin un solo aviso. Lo llaman `anularCobro` y `anularLinksDeCuota` (la cuota
      // que ya se cobró por otro lado), así que el agujero es exactamente un DOBLE COBRO.
      // Un checkout de Creem no se puede cerrar (no hay endpoint, y el link no vence); lo que sí se corta es la
      // SUSCRIPCIÓN, que es lo que seguiría cobrando todos los meses. Un pago único de Creem queda pagable: eso NO se
      // puede arreglar desde acá, y la red es el aviso de `aplicarPagoAprobado` sobre un cobro anulado.
      const creem = await credCreem(ws, await cuentaVivaDelCobro(ws, c));
      if (creem) {
        if (c.tipo === 'suscripcion') {
          // El `proveedor_ref` de Creem es el CHECKOUT: cancelar con ese id no cortaba nada. La suscripción sale de él, si ya se pagó.
          let susId = idDeSuscripcion(c);
          if (!susId && c.proveedor_ref) {
            const ch = await leerCheckoutCreem(creem.key, c.proveedor_ref);
            susId = ch.ok ? ch.suscripcionId : null;
          }
          if (susId) {
            const e = await cancelarSuscripcionCreem(creem.key, susId, idemAnular(c.id), false);
            if (!e.ok) console.warn(`[cobros] no pude cancelar la suscripción ${susId} en Creem: ${e.error}`);
          } else {
            console.warn(`[cobros] el cobro ${c.id} quedó anulado, pero su checkout de Creem (${c.proveedor_ref}) no se puede cerrar. Si lo pagan, su suscripción se corta al entrar el pago.`);
          }
        } else {
          console.warn(`[cobros] el cobro ${c.id} quedó anulado, pero su checkout de Creem (${c.proveedor_ref}) no se puede cerrar: Creem no tiene endpoint para expirarlo. Si lo pagan, el aviso lo marca como pago de un link anulado.`);
        }
      }
    } else if (c.proveedor === 'mercadopago' && c.proveedor_ref) {
      const mp = await credMp(ws, await cuentaVivaDelCobro(ws, c));
      if (mp) {
        const e = c.tipo === 'suscripcion'
          ? await cancelarSuscripcionMp(mp.token, c.proveedor_ref, idemAnular(c.id))
          : await vencerPreferenciaMp(mp.token, c.proveedor_ref, idemAnular(c.id));
        if (!e.ok) console.warn(`[cobros] no pude cerrar el link ${c.proveedor_ref} en Mercado Pago: ${e.error}`);
      }
    }
  } catch (e) {
    console.warn(`[cobros] el cobro ${c.id} quedó anulado, pero no pude cerrar su link en la pasarela: ${e instanceof Error ? e.message : String(e)}`);
  }
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
async function asegurarEventosDelAviso(ws: number, key: string, cuenta: string = CUENTA_PRINCIPAL): Promise<void> {
  try {
    const acct = await credDelCliente(claveDeCuenta('STRIPE_ACCOUNT_ID', cuenta), ws);
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
  // Una venta de un link de pago armado en SU Stripe (MAU-10): MaKo no la cobró y no la devuelve; si Stripe la devuelve, el aviso
  // la encuentra igual (por el pago) y la marca reembolsada.
  if (esCobroExterno(c)) return { ok: false, resumen: 'Esta venta entró por un link de pago de tu Stripe: se reembolsa desde Stripe.' };
  // `pending` cuenta como hecha, como la cuenta Stripe (el cargo ya figura devuelto); si después falla, entra `refund.failed`.
  let enCurso = false;
  if (c.proveedor === 'stripe') {
    const stripe = await credStripe(ws, await cuentaVivaDelCobro(ws, c));
    if (!stripe) return { ok: false, resumen: 'Stripe no está conectado.' };
    // Que el aviso escuche `refund.failed` ANTES de pedirla: si la devolución falla después, es por ahí que se sabe.
    await asegurarEventosDelAviso(ws, stripe.key, stripe.cuenta);
    const pid = c.proveedor_pago_id;
    const idem = idemReembolso(c.id, esDevolucionFallida(c.motivo) ? String(Date.parse(c.updated_at)) : null);
    const r = await reembolsarStripe(stripe.key, { idem, paymentIntent: pid.startsWith('pi_') ? pid : null, invoice: pid.startsWith('in_') ? pid : null });
    if (!r.ok) return { ok: false, resumen: `Stripe no hizo el reembolso: ${r.error}` };
    // Creada pero ya fallida: no se devolvió nada (antes se daba por hecha igual).
    if (r.estado === 'failed' || r.estado === 'canceled') return { ok: false, resumen: 'Stripe no pudo hacer la devolución: la plata sigue cobrada.' };
    enCurso = r.estado !== 'succeeded';
  } else if (c.proveedor === 'creem') {
    // ⚠️ NO HAY ENDPOINT DE REEMBOLSO VERIFICADO en la API de Creem (31/10/2026): la doc tiene el EVENTO
    // `refund.created` (o sea que los reembolsos existen y avisan), pero no se encontró el endpoint para PEDIRLO. Un
    // reembolso se hace desde el panel de Creem. Antes esto caía en la rama de Mercado Pago y le pedía a MP devolver un
    // pago que no es suyo: fallaba con un mensaje que culpaba a MP, y lo que es peor, `aplicarReembolso` NO corría, así
    // que un reembolso hecho a mano en Creem nunca se asentaba. Se dice lo que hay que hacer, y el evento del webhook
    // lo asienta cuando llegue.
    return { ok: false, resumen: 'La devolución de un cobro de Creem se hace desde el panel de Creem. Cuando la hagas, MaKo la registra sola con el aviso de Creem.' };
  } else {
    const mp = await credMp(ws, await cuentaVivaDelCobro(ws, c));
    if (!mp) return { ok: false, resumen: 'Mercado Pago no está conectado.' };
    const r = await reembolsarMp(mp.token, c.proveedor_pago_id, idemReembolso(c.id));
    if (!r.ok) return { ok: false, resumen: `Mercado Pago no hizo el reembolso: ${r.error}` };
  }
  await aplicarReembolso(c, { proveedorPagoId: c.proveedor_pago_id, total: true });
  if (motivo && c.lead_id) await runWithWorkspace(ws, () => logLeadEvent(c.lead_id!, 'Pago reembolsado', `Motivo: ${motivo}`.slice(0, 300), autor));
  return { ok: true, resumen: `Listo: ${c.concepto} (${formatoMonto(c.monto, c.moneda)}) devuelto por ${NOMBRE_PASARELA[c.proveedor]}${enCurso ? ' (Stripe todavía la está procesando)' : ''}.` };
}

/**
 * ¿Quien paga ya AUTORIZÓ una suscripción de Mercado Pago que empieza a cobrar más adelante? (#867, la renovación de un
 * cliente de agencia). Hasta su primer cobro el cobro sigue `pendiente`: el aviso del preapproval autorizado no se aplica
 * (el pago llega en su propia notificación). Esto lo lee y lo anota: `suscripcion_estado: 'activa'` con el cobro todavía
 * pendiente, que el MRR no cuenta (pide `pagado`). Lo llama el cron; compare-and-set sobre `pendiente`. Nunca tira.
 */
export async function anotarAutorizacionMp(c: Cobro): Promise<boolean> {
  if (c.proveedor !== 'mercadopago' || c.tipo !== 'suscripcion' || c.estado !== 'pendiente' || c.suscripcion_estado || !c.proveedor_ref) return false;
  try {
    const mp = await credMp(c.workspace_id, await cuentaVivaDelCobro(c.workspace_id, c));
    if (!mp) return false;
    const s = await leerSuscripcionMp(mp.token, c.proveedor_ref);
    if (!s.ok || s.estado !== 'authorized' || s.cobradorId !== mp.userId || s.referencia !== c.token) return false;
    const r = await actualizar(c.workspace_id, c.id, { suscripcion_estado: 'activa', proveedor_suscripcion_id: s.id }, { estado: ['pendiente'] });
    return !!r;
  } catch (e) {
    console.error(`[cobros] no pude leer la autorización de la suscripción del cobro ${c.id}:`, e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** El día del primer cobro de una prueba (`inicio_at`, mig 0308): no está en `COLS_COBRO`, así que se lee aparte. */
export async function inicioDeLaPrueba(c: Pick<Cobro, 'id' | 'workspace_id'>): Promise<string | null> {
  const { data, error } = await getSupabaseServer().from('cobros').select('inicio_at').eq('id', c.id).eq('workspace_id', c.workspace_id).maybeSingle();
  if (error) throw new Error(`No pude leer el inicio del cobro ${c.id}: ${error.message}`);
  return (data as { inicio_at?: string | null } | null)?.inicio_at ?? null;
}

/** ¿Otra prueba ya usó esta huella (la misma cuenta que paga o la misma tarjeta)? Sin la mig 0334, no se sabe: false, y al log. */
async function huellaYaUsada(plataforma: number, cobroId: number, huella: string): Promise<boolean> {
  const { cuenta, tarjeta } = partesDeHuella(huella);
  // `*:` y no `mp:`: la cuenta que paga también la da Creem (`cr:`), y con el prefijo a mano esa huella no se encontraba nunca.
  const ors = [cuenta ? `prueba_huella.like.*:${cuenta}|*` : null, tarjeta ? `prueba_huella.like.*|card:${tarjeta}` : null].filter(Boolean).join(',');
  if (!ors) return false;
  const { data, error } = await getSupabaseServer().from('cobros').select('id, prueba_huella')
    .eq('workspace_id', plataforma).neq('id', cobroId).not('prueba_huella', 'is', null).or(ors).limit(5);
  if (error) {
    console.warn(`[cobros] no pude mirar si la huella de la prueba ${cobroId} ya se usó (¿falta la mig 0334?): ${error.message}`);
    return false;
  }
  return (data ?? []).some((x) => compartenHuella((x as { prueba_huella: string | null }).prueba_huella, huella));
}

/**
 * LA PRUEBA GRATIS, AL AUTORIZARLA (25/10/2026; Stripe desde el 27/10): la persona cargó la tarjeta y la suscripción quedó
 * autorizada sin cobrar nada (`pruebaAutorizadaMp` / `pruebaAutorizadaStripe`). Se anota la suscripción activa y su huella, y
 * se da de alta la cuenta en ese momento. Si esa cuenta de MP o esa tarjeta ya usó una prueba, se CANCELA la suscripción en el
 * acto (no se cobra nada) y el cobro queda anulado con el motivo. La llaman la página de vuelta del pago y el cron. Nunca tira.
 */
export async function activarPruebaSiAutorizo(c: Cobro): Promise<'activada' | 'rechazada' | null> {
  if (!esPruebaDePlan(c) || c.estado !== 'pendiente' || c.suscripcion_estado || !c.proveedor_ref) return null;
  try {
    const plataforma = await wsSuperAdmin();
    if (c.workspace_id !== plataforma) return null;
    const s = await pruebaAutorizada(c, plataforma);
    if (!s) return null;
    const pasarela = NOMBRE_PASARELA[c.proveedor];
    const huella = s.huella;
    if (huella && await huellaYaUsada(plataforma, c.id, huella)) {
      // Primero se corta el cobro en la pasarela: si no se pudo, no se anula nada y el cron lo vuelve a intentar.
      const corte = await s.cancelar();
      if (!corte.ok) {
        console.error(`[cobros] prueba repetida ${c.id}: ${pasarela} no canceló la suscripción: ${corte.error}`);
        return null;
      }
      await actualizar(plataforma, c.id, {
        estado: 'anulado', suscripcion_estado: 'cancelada', proveedor_suscripcion_id: s.id,
        motivo: `${PREFIJO_PRUEBA_RECHAZADA} ${s.quien} ya usó su prueba gratis.`,
      }, { estado: ['pendiente'] });
      if (c.lead_id) await runWithWorkspace(plataforma, () => logLeadEvent(c.lead_id!, 'Prueba gratis', `Rechazada: ${s.quien} ya había usado su prueba. No se le cobró nada.`, pasarela)).catch(() => {});
      return 'rechazada';
    }
    // El día del primer cobro que dice Stripe (cuenta desde que completó el checkout, no desde que se armó el link) es el
    // `inicio_at` de verdad: el aviso de 2 días antes, «Tu plan» y la vigencia lo leen de ahí. MP no lo dice: queda el de crearlo.
    const r = await actualizar(plataforma, c.id, { suscripcion_estado: 'activa', proveedor_suscripcion_id: s.id, ...(s.finPrueba ? { inicio_at: s.finPrueba } : {}) }, { estado: ['pendiente'] });
    if (!r) return null;
    if (huella) {
      const { error } = await getSupabaseServer().from('cobros').update({ prueba_huella: huella }).eq('id', c.id).eq('workspace_id', plataforma);
      if (error) console.warn(`[cobros] no pude anotar la huella de la prueba ${c.id} (¿falta la mig 0334?): ${error.message}`);
    }
    await runWithWorkspace(plataforma, () => altaSiCorresponde(r));
    const inicio = await inicioDeLaPrueba(c).catch(() => null);
    if (c.lead_id) {
      await runWithWorkspace(plataforma, () => logLeadEvent(c.lead_id!, 'Prueba gratis',
        `Empezó su prueba de ${c.concepto}: ${inicio ? `se le cobra ${formatoMonto(c.monto, c.moneda)} el ${diaDelCobro(inicio)}` : `${pasarela} le cobra al terminar`}.`, pasarela)).catch(() => {});
    }
    return 'activada';
  } catch (e) {
    console.error(`[cobros] no pude activar la prueba del cobro ${c.id}:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * ¿La pasarela de ESTE cobro dice que la prueba quedó autorizada? ⚠️ Era `stripe ? … : Mercado Pago`: la prueba de Creem se le
 * preguntaba a Mercado Pago, que no la conoce. La tarjeta quedaba cargada y el día 8 Creem cobraba, sin cuenta entregada.
 */
async function pruebaAutorizada(c: Cobro, plataforma: number): Promise<PruebaAutorizada | null> {
  switch (c.proveedor) {
    case 'stripe': return pruebaAutorizadaStripe(c, plataforma);
    case 'mercadopago': return pruebaAutorizadaMp(c, plataforma);
    case 'creem': return pruebaAutorizadaCreem(c, plataforma);
    default: {
      const _x: never = c.proveedor;
      throw new Error(`Esa pasarela no sabe de pruebas: ${String(_x)}`);
    }
  }
}

/** Una prueba autorizada en la pasarela: su suscripción, la huella de quien la autorizó y cómo cortarla si es repetida. */
type PruebaAutorizada = {
  id: string; huella: string | null; finPrueba: string | null;
  /** Quién ya la usó, como se dice en el motivo y en el historial: «esa tarjeta». */
  quien: string;
  cancelar: () => Promise<{ ok: true } | { ok: false; error: string }>;
};

/** Mercado Pago: la suscripción `authorized`, de la cuenta de MaKo y de ESTE cobro, con el primer cobro el día 8 (`start_date`). */
async function pruebaAutorizadaMp(c: Cobro, plataforma: number): Promise<PruebaAutorizada | null> {
  const mp = await credMp(plataforma, await cuentaVivaDelCobro(plataforma, c));
  if (!mp || !c.proveedor_ref) return null;
  const s = await leerSuscripcionMp(mp.token, c.proveedor_ref);
  if (!s.ok || s.estado !== 'authorized' || s.cobradorId !== mp.userId || s.referencia !== c.token) return null;
  return {
    id: s.id, huella: huellaMp({ pagadorId: s.pagadorId, tarjetaId: s.tarjetaId }), finPrueba: null,
    quien: 'esa cuenta de Mercado Pago o esa tarjeta', cancelar: () => cancelarSuscripcionMp(mp.token, s.id, idemBaja(c.id)),
  };
}

/**
 * Stripe (27/10/2026): el checkout de ESTE cobro, COMPLETO, y su suscripción en `trialing` (la tarjeta cargada, nada cobrado).
 * El checkout completo sin pago (`no_payment_required`) el webhook lo ignora a propósito: no hay plata que asentar, y la
 * factura en cero del inicio tampoco cuenta (`confirmarFactura`, lib/cobros-eventos.ts). La prueba entra por acá, como la de
 * Mercado Pago, y el primer cobro (el día 8) por `invoice.paid` como cualquier factura de la suscripción.
 */
async function pruebaAutorizadaStripe(c: Cobro, plataforma: number): Promise<PruebaAutorizada | null> {
  const stripe = await credStripe(plataforma, await cuentaVivaDelCobro(plataforma, c));
  if (!stripe || !c.proveedor_ref) return null;
  const s = await leerCheckoutStripe(stripe.key, c.proveedor_ref);
  if (!s.ok || s.estado !== 'complete' || s.referencia !== c.token || !s.subscription) return null;
  const sub = await leerPruebaStripe(stripe.key, s.subscription);
  if (!sub.ok || sub.estado !== 'trialing' || (sub.referencia != null && sub.referencia !== c.token)) return null;
  return {
    id: sub.id, huella: huellaStripe(sub.huella), finPrueba: sub.finPrueba,
    quien: 'esa tarjeta', cancelar: () => cancelarSuscripcionStripe(stripe.key, sub.id, idemBaja(c.id)),
  };
}

/**
 * Creem (31/10/2026): el checkout de ESTE cobro, COMPLETO, y su suscripción en `trialing` («the customer's card is verified
 * and saved for the first payment»). El primer cobro entra por `subscription.paid`. La huella es sólo su cliente: ver
 * `huellaCreem`. Sin medir con una clave de verdad: el orden de los avisos y de los estados sale de su doc.
 */
async function pruebaAutorizadaCreem(c: Cobro, plataforma: number): Promise<PruebaAutorizada | null> {
  const creem = await credCreem(plataforma, await cuentaVivaDelCobro(plataforma, c));
  if (!creem || !c.proveedor_ref) return null;
  const ch = await leerCheckoutCreem(creem.key, c.proveedor_ref);
  if (!ch.ok || ch.estado !== 'completed' || ch.referencia !== c.token || !ch.suscripcionId) return null;
  const sub = await leerSuscripcionCreem(creem.key, ch.suscripcionId);
  if (!sub.ok || sub.estado !== 'trialing' || (sub.referencia != null && sub.referencia !== c.token)) return null;
  return {
    id: sub.id, huella: huellaCreem(sub.clienteId), finPrueba: sub.proximoCobro,
    quien: 'ese cliente de Creem', cancelar: () => cancelarSuscripcionCreem(creem.key, sub.id, idemBaja(c.id), false),
  };
}

/**
 * «EMPEZAR MI PLAN YA» (25/10/2026, lib/empezar-plan.ts): cuando se cobra el plan desde hoy, la PRUEBA que reemplaza se
 * cancela en la pasarela (así el día 8 no vuelve a cobrar) y queda anulada (el negocio deja de estar en prueba). Si la prueba
 * YA se había cobrado (el día 8 llegó antes que este pago), es un mes cobrado dos veces: se cancela ESTA suscripción nueva y se
 * avisa al equipo para devolver uno. La llaman `aplicarPagoAprobado` y el cron. Idempotente; nunca tira.
 */
export async function cerrarPruebaAlEmpezarYa(c: Cobro): Promise<void> {
  const pruebaId = pruebaDeEmpezarYa(c.creado_por);
  if (pruebaId == null || c.estado !== 'pagado' || c.tipo !== 'suscripcion') return;
  try {
    const plataforma = await wsSuperAdmin();
    if (c.workspace_id !== plataforma) return;
    const prueba = await getCobro(plataforma, pruebaId);
    if (!prueba || !esPruebaDePlan(prueba) || prueba.alta_ws !== c.alta_ws) return;
    if (prueba.estado === 'pendiente') {
      if (prueba.suscripcion_estado !== 'cancelada') {
        const r = await cancelarSuscripcionCobro(plataforma, prueba.id, 'Empezó su plan antes de terminar la prueba');
        if (!r.ok) { console.error(`[cobros] empezar ya ${c.id}: no pude cancelar la prueba ${prueba.id}: ${r.resumen}`); return; }
      }
      await actualizar(plataforma, prueba.id, { estado: 'anulado', motivo: 'Empezó su plan antes de terminar la prueba.' }, { estado: ['pendiente'] });
      return;
    }
    if (prueba.estado === 'pagado' && c.suscripcion_estado !== 'cancelada') {
      const r = await cancelarSuscripcionCobro(plataforma, c.id, 'Cobro doble del primer mes');
      const texto = `${c.nombre ?? c.email ?? 'Un negocio'} pagó «empezar mi plan ya» después de que su prueba ya se cobró: el primer mes entró dos veces. ${r.ok ? 'Cancelé la suscripción nueva.' : `No pude cancelar la suscripción nueva: ${r.resumen}`} Hay que devolver uno.`;
      console.error(`[cobros] ${texto}`);
      if (c.lead_id) await runWithWorkspace(plataforma, () => logLeadEvent(c.lead_id!, 'Cobro doble', texto, NOMBRE_PASARELA[c.proveedor])).catch(() => {});
      await avisarDePlataforma({ to: EMAIL_MAKO, tag: 'cobro-doble', asunto: 'Un primer mes de MaKo entró dos veces', preheader: 'Hay que devolver uno.', cuerpo: texto }).catch(() => {});
    }
  } catch (e) {
    console.error(`[cobros] no pude cerrar la prueba del cobro ${c.id}:`, e instanceof Error ? e.message : String(e));
  }
}

/** Cancela la suscripción en la pasarela EN EL ACTO (deja de cobrar). Irreversible en Mercado Pago. */
export async function cancelarSuscripcionCobro(ws: number, id: number, autor: string): Promise<{ ok: boolean; resumen: string }> {
  const c = await getCobro(ws, id);
  if (!c) return { ok: false, resumen: 'No encontré ese cobro.' };
  // En MP el id del preapproval ES el `proveedor_ref` del cobro: a veces el aviso no llena `proveedor_suscripcion_id`.
  const susId = c.proveedor_suscripcion_id ?? (c.proveedor === 'mercadopago' && c.tipo === 'suscripcion' ? c.proveedor_ref : null);
  if (c.tipo !== 'suscripcion' || !susId) return { ok: false, resumen: 'Ese cobro no es una suscripción activa.' };
  if (c.suscripcion_estado === 'cancelada') return { ok: false, resumen: 'Esa suscripción ya estaba cancelada.' };
  if (esCobroExterno(c)) return { ok: false, resumen: 'Esta suscripción entró por un link de pago de tu Stripe: se cancela desde Stripe.' };
  // ⚠️ YA CANCELADA EN LA PASARELA **ES** CANCELADA, y sin esto la baja se frenaba entera (P14, 30/10/2026). El caso:
  //    la suscripción se canceló por fuera (a mano en Stripe, o una corrida anterior que murió entre la pasarela y la
  //    base) y acá la fila todavía dice `activa`. La pasarela contesta 404 —o un «already canceled»— que es un error,
  //    así que se salía por `ok: false` y `aplicarSuscripcionCancelada` NO corría: la base quedaba `activa` para
  //    siempre y la baja no se podía terminar NUNCA, ni reintentando. El estado del mundo ya era el que se pedía y lo
  //    único que faltaba era asentarlo.
  // ⚠️ Es el MISMO criterio que ya usa `reusarOCrearCheckout` en este archivo (el 404 pasa; cualquier otro error se
  //    chequea releyendo la suscripción y vale si está cancelada): acá se copia, no se inventa. La diferencia de las
  //    dos pasarelas es el nombre del estado — Stripe dice `canceled` y MP dice `cancelled` al leer y `canceled` al
  //    cancelar, y por eso del lado de MP se pregunta con `suscripcionMpCancelada` y no con un string a mano.
  if (c.proveedor === 'stripe') {
    const stripe = await credStripe(ws, await cuentaVivaDelCobro(ws, c));
    if (!stripe) return { ok: false, resumen: 'Stripe no está conectado.' };
    const r = await cancelarSuscripcionStripe(stripe.key, susId, idemBaja(c.id));
    if (!r.ok && r.status !== 404) {
      const sub = await leerSuscripcionStripe(stripe.key, susId);
      if (!(sub.ok && sub.estado === 'canceled')) return { ok: false, resumen: `Stripe no canceló la suscripción: ${r.error}` };
    }
  } else if (c.proveedor === 'creem') {
    // ⚠️ ESTA RAMA NO EXISTÍA Y ERA EL BUG MÁS GRAVE DE LA PASARELA (31/10/2026). Un cobro de Creem caía en el `else`
    // de Mercado Pago: MP contestaba 404 por un id que no es suyo, el `r.status !== 404` de abajo se comía el error
    // como si fuera «ya estaba cancelada», y corría `aplicarSuscripcionCancelada`. Resultado: la base decía
    // «cancelada», el cliente veía su baja hecha, y CREEM LE SEGUÍA COBRANDO TODOS LOS MESES. Sin error, sin log, sin
    // ticket — la clase de fuga que sólo aparece en el resumen de la tarjeta del cliente.
    const creem = await credCreem(ws, await cuentaVivaDelCobro(ws, c));
    if (!creem) return { ok: false, resumen: 'Creem no está conectado.' };
    // `alFinDelPeriodo: false` = `{ mode: 'immediate' }`. Es lo que hace esta función («deja de cobrarle cada mes,
    // desde ahora. No devuelve nada»); la baja del propio plan, que sí respeta el mes pagado, va por `darDeBajaMiPlan`.
    const r = await cancelarSuscripcionCreem(creem.key, susId, idemBaja(c.id), false);
    if (!r.ok && r.status !== 404) {
      // El mismo criterio que las otras dos: si no se pudo cancelar, se RELEE, y sólo vale si ya está cancelada.
      const sub = await leerSuscripcionCreem(creem.key, susId);
      if (!(sub.ok && sub.estado === 'canceled')) return { ok: false, resumen: `Creem no canceló la suscripción: ${r.error}` };
    }
  } else {
    const mp = await credMp(ws, await cuentaVivaDelCobro(ws, c));
    if (!mp) return { ok: false, resumen: 'Mercado Pago no está conectado.' };
    const r = await cancelarSuscripcionMp(mp.token, susId, idemBaja(c.id));
    if (!r.ok && r.status !== 404) {
      const sub = await leerSuscripcionMp(mp.token, susId);
      if (!(sub.ok && suscripcionMpCancelada(sub.estado))) return { ok: false, resumen: `Mercado Pago no canceló la suscripción: ${r.error}` };
    }
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
  // ⚠️ LA PRUEBA GRATIS TAMBIÉN (25/10/2026): un negocio en prueba no pagó todavía, y sin ella quedaba sin los topes de su plan
  // (los miran todos por acá), sin «Darme de baja» y sin plan en «Tu plan». La pagada primero (`pagado_at` vacío al final).
  // La MISMA condición (`FILTRO_SUSCRIPCION_DE_MAKO`) la usa lib/plan-esencial.ts; tests/prueba-plan.test.ts las ata.
  const { data, error } = await getSupabaseServer().from('cobros').select(COLS_COBRO)
    .eq('workspace_id', plataforma).eq('alta_ws', ws).eq('tipo', 'suscripcion').or(FILTRO_SUSCRIPCION_DE_MAKO)
    .order('pagado_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).limit(1).maybeSingle();
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
  // EN LA PRUEBA (25/10/2026): se cancela la suscripción en el acto, así el día 8 no se cobra nada, y usa MaKo hasta ese día.
  if (esPruebaDePlan(c) && c.estado === 'pendiente') {
    const r = await cancelarSuscripcionCobro(c.workspace_id, c.id, autor);
    if (!r.ok) return { ok: false, resumen: r.resumen };
    const hasta = await inicioDeLaPrueba(c).catch(() => null);
    const texto = textoBajaPedida({ codigo, pedida, finAt: hasta });
    await actualizar(c.workspace_id, c.id, { motivo: texto });
    if (c.lead_id) await runWithWorkspace(c.workspace_id, () => logLeadEvent(c.lead_id!, 'Baja del plan', `Dio de baja su prueba gratis: no se le cobra nada. ${texto} Pedida por ${autor}.`.slice(0, 300), autor));
    const resumen = `Listo: diste de baja tu prueba y no se te cobra nada.${hasta ? ` Puedes usar MaKo hasta el ${diaDelCobro(hasta)}.` : ''} Código de baja: ${codigo}.`;
    return { ok: true, resumen, codigo, finAt: hasta };
  }
  if (c.proveedor === 'stripe') {
    const stripe = await credStripe(c.workspace_id, await cuentaVivaDelCobro(c.workspace_id, c));
    if (!stripe || !c.proveedor_suscripcion_id) return { ok: false, resumen: `No pudimos darte de baja. Escríbenos a ${EMAIL_MAKO}.` };
    // Su propia clave: la de `idemBaja` es la de cancelar EN EL ACTO (DELETE), y una clave repetida con otro pedido dentro
    // de las 24 h Stripe la rechaza (si el super admin la cancela del todo el mismo día).
    const r = await programarBajaStripe(stripe.key, c.proveedor_suscripcion_id, `${idemBaja(c.id)}-al-fin`);
    if (!r.ok) return { ok: false, resumen: `Stripe no tomó la baja: ${motivoSinDatos(r.error)}` };
    finAt = r.finAt;
  } else if (c.proveedor === 'creem') {
    // Como Stripe, y no como Mercado Pago: sigue activa hasta el fin de lo que ya pagó (`bajaAlFinDelPeriodo`). Por el `else` se
    // cancelaba en el acto, y la pantalla le prometía el período pagado a alguien cuya suscripción ya no existía.
    const creem = await credCreem(c.workspace_id, await cuentaVivaDelCobro(c.workspace_id, c));
    if (!creem || !c.proveedor_suscripcion_id) return { ok: false, resumen: `No pudimos darte de baja. Escríbenos a ${EMAIL_MAKO}.` };
    const r = await cancelarSuscripcionCreem(creem.key, c.proveedor_suscripcion_id, `${idemBaja(c.id)}-al-fin`, true);
    if (!r.ok) return { ok: false, resumen: `Creem no tomó la baja: ${motivoSinDatos(r.error)}` };
    finAt = r.finDelPeriodo;
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

/** Un seguro para la lectura de las pruebas (`reconciliarCobros`), no un tope de trabajo: si se llega, el cron lo dice. */
const TOPE_DE_PRUEBAS = 500;

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
export async function reconciliarCobros(ws: number, opts: { dias?: number; hasta?: number } = {}): Promise<{ revisados: number; cambiados: number; errores: number }> {
  // `hasta` (ms): cuándo dejar de mirar cobros (la verificación de a196d5a93: con cientos de pruebas, cada una son dos lecturas
  // a Stripe en serie, y la vuelta se pasaba del `maxDuration` del cron). Lo que no entró sigue en la próxima vuelta.
  const sinTiempo = () => opts.hasta != null && Date.now() > opts.hasta;
  const desde = new Date(Date.now() - (opts.dias ?? 14) * 86_400_000).toISOString();
  const db = getSupabaseServer();
  // ⚠️ LAS PRUEBAS DE UN PLAN, APARTE Y SIN EL TOPE DE 50 (28/10/2026, la verificación de 3ca2d8328): cada compra abierta en
  // /planes crea un cobro pendiente que nadie anula, y toda compra de Stripe arranca como prueba. Con 50 compras más nuevas, una
  // prueba quedaba fuera de la lista: no se ACTIVABA, y si el aviso del día 8 se perdía la plata entraba en Stripe y MaKo no la
  // acreditaba nunca. Las ACTIVADAS (esperan el cobro del día 8, que puede llegar tarde: 45 días) y las de los últimos 2 días
  // sin activar (la persona cerró la pestaña antes de volver; una de hace más, abandonada, la activa su `invoice.paid`).
  const pruebaActivaDesde = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const pruebaSinActivarDesde = new Date(Date.now() - 2 * 86_400_000).toISOString();
  // (La verificación de a196d5a93.) La ACTIVADA también puede estar `fallido`: la tarjeta se rechazó el día 8 y el reintento de
  // Stripe la cobró después, con su aviso perdido. Y se leen de la más VIEJA a la más nueva: la que espera el día 8 es la vieja;
  // con más que el seguro, la que espera es la que todavía está en su prueba.
  const pruebas = (activada: boolean) => {
    const q = db.from('cobros').select(COLS_COBRO).eq('workspace_id', ws)
      .eq('tipo', 'suscripcion').like('creado_por', 'planes:%:prueba')
      .gte('updated_at', activada ? pruebaActivaDesde : pruebaSinActivarDesde);
    return (activada
      ? q.in('estado', ['pendiente', 'fallido']).eq('suscripcion_estado', 'activa').order('updated_at', { ascending: true })
      : q.eq('estado', 'pendiente').is('suscripcion_estado', null).order('updated_at', { ascending: false })
    ).limit(TOPE_DE_PRUEBAS);
  };
  const [pend, pag, anul, pruebasActivas, pruebasSinActivar] = await Promise.all([
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
    pruebas(true),
    pruebas(false),
  ]);
  if (pend.error) throw new Error(`No pude leer los cobros pendientes a reconciliar: ${pend.error.message}`);
  if (pag.error) throw new Error(`No pude leer los cobros pagados a reparar: ${pag.error.message}`);
  if (anul.error) throw new Error(`No pude leer los cobros anulados a reconciliar: ${anul.error.message}`);
  if (pruebasActivas.error) throw new Error(`No pude leer las pruebas activadas a reconciliar: ${pruebasActivas.error.message}`);
  if (pruebasSinActivar.error) throw new Error(`No pude leer las pruebas sin activar a reconciliar: ${pruebasSinActivar.error.message}`);
  for (const [r, cuales] of [[pruebasActivas, 'activadas'], [pruebasSinActivar, 'sin activar']] as const) {
    // El tope es un seguro, no un corte: si se llega, se dice (una lista que corta en silencio fue el problema de arriba).
    if ((r.data ?? []).length >= TOPE_DE_PRUEBAS) console.error(`[cobros] reconciliar ws ${ws}: ${TOPE_DE_PRUEBAS} pruebas ${cuales} o más; las que no entraron esperan a que se resuelvan éstas`);
  }
  // Sin repetir: una prueba puede venir en dos lecturas.
  const vistos = new Set<number>();
  const pendientes = [...(pend.data ?? []), ...(anul.data ?? []), ...(pruebasActivas.data ?? []), ...(pruebasSinActivar.data ?? [])]
    .map((x) => cobroDeFila(x as Record<string, unknown>))
    .filter((c) => !vistos.has(c.id) && (vistos.add(c.id), true));
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
  const credsDe = credsPorCuenta(ws);

  let cortado = false;
  for (const c of pagados) {
    if (sinTiempo()) { cortado = true; break; }
    // El cliente de agencia que pagó y quedó sin habilitar (el aviso se cortó después del pago): compare-and-set, no tira.
    await habilitarClienteDeAgencia(c);
    // «Empezar mi plan ya» que se cobró y cuyo aviso se cortó antes de cerrar la prueba: idempotente, no tira.
    await cerrarPruebaAlEmpezarYa(c);
    const faltaCuota = !!c.lead_id && c.monto_usd != null && !!c.proveedor_pago_id && !conCuota.has(c.id);
    const faltaAlta = !!c.alta_capa && c.alta_estado !== 'hecha' && c.alta_estado !== 'ya_tenia_cuenta';
    // La compra a Meta de una VENTA EXTERNA que no salió (28/10/2026, la verificación de 3ca2d8328): el aviso la mandaba recién
    // al final, y una venta cortada en la cuota la perdía aunque este cron reparara la cuota. No depende de la cuota (la plata
    // ya está asentada en el cobro), así que va antes del `continue`. Una vez por venta; nunca tira. ⚠️ No si el cobro cambió
    // hace menos de 10 minutos (la verificación de a196d5a93): el aviso puede estar mandándola en ese momento, y salían DOS.
    if (esCobroExterno(c) && !avisoTrabajando(c)) await compraExternaQueFalto(c);
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
    if (cortado || sinTiempo()) { cortado = true; break; }
    // La PRUEBA autorizada y no vista (la persona cerró la pestaña antes de volver): se activa acá. Sin pago que buscar.
    if (esPruebaDePlan(c) && c.estado === 'pendiente' && !c.suscripcion_estado) {
      if (await activarPruebaSiAutorizo(c)) cambiados++;
      continue;
    }
    try {
      const { stripe, mp, creem } = await credsDe(c);
      const pago = await pagoDelLinkEnLaPasarela(c, stripe, mp, creem);
      if (pago) {
        const r = await aplicarPagoAprobado(c, pago);
        if (r.nuevo) cambiados++;
      }
    } catch (e) {
      errores++;
      console.error(`[cobros] reconciliar cobro ${c.id}:`, e instanceof Error ? e.message : String(e));
    }
  }
  if (cortado) console.warn(`[cobros] reconciliar ws ${ws}: se acabó el tiempo de la vuelta; lo que faltó sigue en la próxima`);
  return { revisados: pendientes.length + pagados.length, cambiados, errores };
}

/** Una suscripción con una cuota de hace menos que esto no se le pregunta a Stripe: su próxima renovación todavía no tocó. */
const DIAS_SIN_RENOVAR = 25;
/** De a cuántos cobros se leen sus cuotas (los ids van en la URL del pedido). */
const TANDA_CUOTAS = 150;

/**
 * LA RED DE LAS RENOVACIONES DE STRIPE (6/11/2026, docs/hallazgos-pagos.md). El mes 2 en adelante de una suscripción entra
 * SÓLO por su `invoice.paid`; `reconciliarCobros` mira la sesión del checkout, que ya está pagada. Si ese aviso se perdía, la
 * plata entraba en Stripe y MaKo no asentaba la cuota: ni la ganancia del partner (el 2º mes), ni la cuota que mira el corte
 * por falta de pago. Una vez por día (el cron), las suscripciones activas de Stripe CON LEAD cuya última cuota tiene más de
 * `DIAS_SIN_RENOVAR` días: se listan sus facturas pagadas y se asientan las que faltan, de entre 4 y 14 días
 * (`renovacionesQueFaltan`), con el MISMO camino y el mismo id que el aviso (`aplicarPagoAprobado` con la factura): si el aviso
 * llega después, es la misma. Las más viejas quedan en un ticket (`avisarRenovacionVieja`), una por factura.
 * ⚠️ SÓLO CON LEAD: lo que dice «esta renovación ya está» es su cuota en `pagos`; sin lead no hay cuota, y volver a aplicar
 * una renovación ya aplicada repite el aviso al equipo (su dedup dura 3 días). Nunca tira por un cobro: lo cuenta.
 * ⚠️ TODAS, Y EMPEZANDO POR OTRA CADA DÍA (la revisión del 6/11/2026): con un tope antes del filtro, las de id más alto (las más
 * nuevas, justo las del 2º mes) no se miraban nunca; y con el mismo orden cada día, las que el tiempo dejaba afuera, tampoco.
 */
export async function renovacionesPerdidasStripe(ws: number, opts: { hasta?: number; ahoraMs?: number } = {}): Promise<{ revisadas: number; asentadas: number; errores: number }> {
  const sinTiempo = () => opts.hasta != null && Date.now() > opts.hasta;
  const ahoraMs = opts.ahoraMs ?? Date.now();
  const db = getSupabaseServer();
  // `reembolsado` también: la RENOVACIÓN de una suscripción cuyo primer pago se devolvió sigue siendo plata que entra
  // (`aplicarPagoAprobado`, el corte de la reentrega de lo devuelto).
  const filas = await leerTodo<Record<string, unknown>>(db, 'cobros', COLS_COBRO, {
    eq: { workspace_id: ws, proveedor: 'stripe', tipo: 'suscripcion', suscripcion_estado: 'activa' },
    filtros: (q) => q.in('estado', ['pagado', 'reembolsado']).not('lead_id', 'is', null).not('proveedor_suscripcion_id', 'is', null),
    orden: 'id',
  });
  const cobros = filas.map((x) => cobroDeFila(x));
  if (!cobros.length) return { revisadas: 0, asentadas: 0, errores: 0 };

  // Las cuotas de cada una, enteras (una suscripción de un año son 12): sus ids son lo que «ya está», y su fecha la última.
  const deCadaUno = new Map<number, { ids: Set<string>; ultima: number }>();
  for (let i = 0; i < cobros.length; i += TANDA_CUOTAS) {
    const ids = cobros.slice(i, i + TANDA_CUOTAS).map((c) => c.id);
    const cuotas = await leerTodo<{ cobro_id: number; proveedor_pago_id: string | null; fecha_pago: string | null }>(
      db, 'pagos', 'id, cobro_id, proveedor_pago_id, fecha_pago',
      { eq: { workspace_id: ws }, filtros: (q) => q.in('cobro_id', ids), orden: 'id' },
    );
    for (const q of cuotas) {
      const k = Number(q.cobro_id);
      const e = deCadaUno.get(k) ?? { ids: new Set<string>(), ultima: 0 };
      if (q.proveedor_pago_id) e.ids.add(q.proveedor_pago_id);
      const f = q.fecha_pago ? Date.parse(q.fecha_pago) : NaN;
      if (Number.isFinite(f)) e.ultima = Math.max(e.ultima, f);
      deCadaUno.set(k, e);
    }
  }
  // Las que tocan (su última cuota tiene más de 25 días), y cada día se arranca por otra.
  const tocan = cobros.filter((c) => {
    const propias = deCadaUno.get(c.id);
    const pagadoEn = c.pagado_at ? Date.parse(c.pagado_at) : NaN;
    const ultima = Math.max(propias?.ultima ?? 0, Number.isFinite(pagadoEn) ? pagadoEn : 0);
    return ahoraMs - ultima >= DIAS_SIN_RENOVAR * 86_400_000;
  });
  const giro = tocan.length ? Math.floor(ahoraMs / 86_400_000) % tocan.length : 0;
  const orden = [...tocan.slice(giro), ...tocan.slice(0, giro)];

  const credsDe = credsPorCuenta(ws);
  let revisadas = 0;
  let asentadas = 0;
  let errores = 0;
  for (const c of orden) {
    if (sinTiempo()) { console.warn(`[cobros] renovaciones ws ${ws}: se acabó el tiempo; mañana se arranca por otra`); break; }
    try {
      const { stripe } = await credsDe(c);
      if (!stripe || !c.proveedor_suscripcion_id) continue;
      revisadas++;
      const fs = await facturasPagadasStripe(stripe.key, c.proveedor_suscripcion_id);
      if (!fs.ok) throw new Error(`Stripe no contestó por las facturas de la suscripción: ${fs.error}`);
      const { asentar, viejas } = renovacionesQueFaltan(fs.facturas, {
        token: c.token, suscripcion: c.proveedor_suscripcion_id, primera: c.proveedor_pago_id,
        conocidas: deCadaUno.get(c.id)?.ids ?? new Set<string>(), ahoraMs, cobro: c,
      });
      // Una perdida de hace más de 14 días no se asienta sola (le escribiría hoy al lead por un pago viejo): queda un ticket.
      for (const f of viejas) await avisarRenovacionVieja(ws, c, f);
      for (const r of asentar) {
        const x = await aplicarPagoAprobado(c, r);
        if (x.renovacion) asentadas++;
      }
    } catch (e) {
      errores++;
      console.error(`[cobros] renovaciones del cobro ${c.id}:`, e instanceof Error ? e.message : String(e));
    }
  }
  if (asentadas) console.log(`[cobros] renovaciones ws ${ws}: ${asentadas} renovación(es) de Stripe que no habían entrado por su aviso`);
  return { revisadas, asentadas, errores };
}

/** La venta externa que el aviso puede estar asentando ahora mismo: su cobro cambió hace menos de 10 minutos. */
const AVISO_TRABAJANDO_MS = 10 * 60_000;
const avisoTrabajando = (c: Pick<Cobro, 'created_at' | 'updated_at'>): boolean =>
  Date.now() - Math.max(Date.parse(c.created_at) || 0, Date.parse(c.updated_at) || 0) < AVISO_TRABAJANDO_MS;

type PagoDeLaPasarela = Parameters<typeof aplicarPagoAprobado>[1];

/**
 * Las claves de la cuenta de CADA cobro, leídas una vez por cuenta (varias por proveedor, 22/10/2026): un barrido que
 * leía las de la principal miraba en Stripe el link de la segunda cuenta con la clave equivocada (404, «no está»).
 */
type CredsDelCobro = { stripe: CredStripe | null; mp: CredMp | null; creem: CredCreem | null };

function credsPorCuenta(ws: number): (c: Cobro) => Promise<CredsDelCobro> {
  const memo = new Map<string, Promise<CredsDelCobro>>();
  return (c) => {
    // Por su cuenta en el proveedor (`cuenta_ref`) si la tiene; si no, por su sufijo.
    const llave = c.cuenta_ref ? `${c.proveedor}|${c.cuenta_ref}` : `sufijo|${c.cuenta ?? CUENTA_PRINCIPAL}`;
    if (!memo.has(llave)) {
      memo.set(llave, cuentaVivaDelCobro(ws, c)
        .then((cuenta) => Promise.all([credStripe(ws, cuenta), credMp(ws, cuenta), credCreem(ws, cuenta)]))
        .then(([stripe, mp, creem]) => ({ stripe, mp, creem })));
    }
    return memo.get(llave)!;
  };
}

/**
 * ¿La pasarela COBRÓ este link? Lo que se le pasa a `aplicarPagoAprobado`, o null si no (o si todavía no se puede
 * asentar). Lo usan el cron (`reconciliarCobros`) y el «marcar a mano» (`asentarLinkPagadoDeCuota`). Tira si la
 * pasarela no contesta: quien llama decide qué hace con eso.
 */
async function pagoDelLinkEnLaPasarela(c: Cobro, stripe: CredStripe | null, mp: CredMp | null, creem: CredCreem | null = null): Promise<PagoDeLaPasarela | null> {
  if (c.proveedor === 'stripe' && stripe && c.proveedor_ref) {
    const s = await leerCheckoutStripe(stripe.key, c.proveedor_ref);
    if (!s.ok) throw new Error(`Stripe no contestó por el link ${c.id}: ${s.error}`);
    // ⚠️ LA PRUEBA GRATIS (28/10/2026): su sesión queda `no_payment_required` para siempre, y lo que cobra el día 8 es una
    // FACTURA de la suscripción. Si su `invoice.paid` se perdía, la plata entraba y el cobro seguía pendiente. Se busca la
    // factura con el mismo id que usa el aviso (lib/cobros-eventos.ts, `primerCobroDeLaPrueba`).
    if (s.estado === 'complete' && s.referencia === c.token) {
      if (s.pagoEstado === 'no_payment_required' && esPruebaDePlan(c) && c.tipo === 'suscripcion' && s.subscription) {
        const facturas = await facturasPagadasStripe(stripe.key, s.subscription);
        if (!facturas.ok) throw new Error(`Stripe no contestó por las facturas del link ${c.id}: ${facturas.error}`);
        return primerCobroDeLaPrueba(facturas.facturas, c.token);
      }
    }
    if (s.estado === 'complete' && s.pagoEstado === 'paid' && s.referencia === c.token) {
      // ⚠️ EL MISMO id QUE USA EL WEBHOOK, o la primera cuota se duplica: en una suscripción es la
      // FACTURA (después llega `invoice.paid` con ese mismo id), en un pago único el payment intent.
      // Sin factura todavía, no se aplica: entra por `invoice.paid` o en la próxima vuelta. Usar el
      // id de la sesión acá hacía que la factura se leyera después como una RENOVACIÓN.
      // ⚠️ Y LA MISMA REGLA QUE EL AVISO (`sesionDelCobro`, la verificación de a196d5a93): lo que el aviso no asienta (una sesión
      // ajena, o que cobró menos) el cron tampoco; antes lo asentaba media hora después. Queda el ticket, uno por sesión.
      const deEste = sesionDelCobro(c, s, 'aprobado');
      if (!deEste.ok) {
        await avisarSesionQueNoCuadra(c.workspace_id, c, s, deEste.motivo);
        return null;
      }
      const pagoId = c.tipo === 'suscripcion' ? s.invoice : s.paymentIntent;
      if (pagoId) return { proveedorPagoId: pagoId, suscripcionId: s.subscription };
    }
    return null;
  }
  if (c.proveedor === 'mercadopago' && mp) {
    const b = await buscarPagosMp(mp.token, c.token);
    if (!b.ok) throw new Error(`Mercado Pago no contestó por el link ${c.id}: ${b.error}`);
    const aprobado = b.pagos.find((x) => x.estado === 'approved' && x.cobradorId === mp.userId && x.referencia === c.token);
    return aprobado ? { proveedorPagoId: aprobado.id, monto: aprobado.monto, moneda: aprobado.moneda, suscripcionId: aprobado.preapprovalId, pagadoAt: aprobado.fecha } : null;
  }
  if (c.proveedor === 'creem' && creem && c.proveedor_ref) {
    // ⚠️ SIN ESTO EL CRON ERA CIEGO A CREEM (31/10/2026): los dos `if` de arriba son positivos y la función caía al
    // `return null` del final, o sea «la pasarela no cobró este link». Y este cron es la RED: lo que el aviso perdió
    // (Creem reintenta 5 veces y a las 24 h abandona) lo recoge él. Sin esta rama, un aviso perdido es plata cobrada en
    // Creem que MaKo no acredita NUNCA — ni el alta, ni la cuota en el CRM, ni el lead a Ganado.
    const ch = await leerCheckoutCreem(creem.key, c.proveedor_ref);
    if (!ch.ok) throw new Error(`Creem no contestó por el link ${c.id}: ${ch.error}`);
    // La referencia tiene que ser la de ESTE cobro: `request_id` (o el `metadata.mako_cobro`) lleva su token.
    if (ch.estado !== 'completed' || ch.referencia !== c.token) return null;
    // En una suscripción, el id del pago es el de la TRANSACCIÓN (hay una por mes y el webhook usa la misma),
    // no el del checkout: con el del checkout, la renovación del mes siguiente se leería como el primer pago.
    if (c.tipo === 'suscripcion') {
      if (!ch.suscripcionId) return null;
      const tx = await buscarTransaccionesCreem(creem.key, ch.suscripcionId);
      if (!tx.ok) throw new Error(`Creem no contestó por las transacciones del link ${c.id}: ${tx.error}`);
      const pagada = tx.transacciones.filter((x) => transaccionQueCobra(c, x)).sort((a, b) => Date.parse(a.fecha ?? '') - Date.parse(b.fecha ?? ''))[0];
      // `monto` es SIN impuesto: es lo que cobra el plan. El impuesto lo cobra y lo remite Creem (merchant of record).
      return pagada ? { proveedorPagoId: pagada.id, monto: pagada.monto ?? undefined, moneda: pagada.moneda ?? undefined, suscripcionId: ch.suscripcionId, pagadoAt: pagada.fecha ?? undefined } : null;
    }
    return ch.transaccionId
      ? { proveedorPagoId: ch.transaccionId, monto: ch.monto ?? undefined, moneda: ch.moneda ?? undefined, suscripcionId: null }
      : null;
  }
  return null;
}

/** Lo que pasó al mirar los links de una cuota antes de marcarla a mano. */
export type LinkDeCuota =
  | { asentado: true; pasarela: Pasarela }
  | { asentado: false; sinLeer: number };

/**
 * ANTES DE MARCAR A MANO UNA CUOTA (17/10/2026): ¿alguno de sus links ya se pagó y todavía no se asentó? Si sí, se
 * asienta ACÁ por el camino de la pasarela (`aplicarPagoAprobado`: la cuota queda cobrada con ESE pago) y la marca a
 * mano no se hace.
 *
 * ⚠️ POR QUÉ: entre que el cliente paga el link y que el aviso o el cron lo asientan, la cuota sigue impaga. Si el
 * closer la marcaba a mano en ese rato, `marcarPago` anulaba el link (ya pagado) y, cuando llegaba el aviso, el pago
 * entraba como OTRA cuota cobrada: lo cobrado se contaba dos veces (docs/hallazgos-pagos.md §4). Frenar la marca no
 * servía: si el pago entró por otro monto, la cuota quedaba trabada para siempre. Preguntarle a la pasarela no traba
 * nada: si no cobró, se marca como siempre.
 *
 * Mira dos cosas: el link `pagado` en MaKo cuya cuota no se asentó (el aviso se cortó a la mitad; no hace falta red)
 * y el link vivo (`pendiente`/`fallido`) que la pasarela ya cobró. Si la pasarela no contesta, sigue (`sinLeer`): la
 * marca a mano no se traba, y si el pago entra después, `aplicarPagoAprobado` lo dice («la plata entró dos veces»).
 */
export async function asentarLinkPagadoDeCuota(ws: number, pagoId: number): Promise<LinkDeCuota> {
  const { data, error } = await getSupabaseServer().from('cobros').select(COLS_COBRO)
    .eq('workspace_id', ws).eq('pago_id', pagoId).in('estado', ['pendiente', 'fallido', 'pagado']);
  if (error) throw new Error(`No pude leer los links de la cuota ${pagoId}: ${error.message}`);
  const links = (data ?? []).map((x) => cobroDeFila(x as Record<string, unknown>));
  if (!links.length) return { asentado: false, sinLeer: 0 };

  // 1. Pagado en MaKo y sin su cuota: se repara como lo repara el cron (es idempotente).
  for (const c of links) {
    if (c.estado !== 'pagado' || !c.proveedor_pago_id || !c.lead_id || c.monto_usd == null) continue;
    await aplicarPagoAprobado(c, { proveedorPagoId: c.proveedor_pago_id, pagadoAt: c.pagado_at });
    return { asentado: true, pasarela: c.proveedor };
  }
  // 2. Vivo en MaKo: se le pregunta a la pasarela.
  const vivos = links.filter((c) => c.estado === 'pendiente' || c.estado === 'fallido');
  if (!vivos.length) return { asentado: false, sinLeer: 0 };
  const credsDe = credsPorCuenta(ws);
  let sinLeer = 0;
  for (const c of vivos) {
    let pago: PagoDeLaPasarela | null;
    try {
      const { stripe, mp, creem } = await credsDe(c);
      pago = await pagoDelLinkEnLaPasarela(c, stripe, mp, creem);
    } catch (e) {
      sinLeer++;
      console.warn(`[cobros] no pude mirar el link ${c.id} antes de marcar a mano la cuota ${pagoId}:`, e instanceof Error ? e.message : String(e));
      continue;
    }
    if (!pago) continue;
    await aplicarPagoAprobado(c, pago);
    return { asentado: true, pasarela: c.proveedor };
  }
  return { asentado: false, sinLeer };
}

/** Los workspaces con alguna pasarela conectada (para el cron). Lee la tabla de ruteo, que es en claro. */
export async function workspacesConPasarela(): Promise<number[]> {
  const { data, error } = await getSupabaseServer().from('webhook_routing').select('workspace_id').in('servicio', [...PASARELAS]);
  if (error) throw new Error(`No pude leer los workspaces con pasarela: ${error.message}`);
  return [...new Set((data ?? []).map((r) => Number((r as { workspace_id: number }).workspace_id)).filter((n) => Number.isFinite(n)))];
}

// ─────────────────────────────────────────────────────────────────────────────
// La venta de un Payment Link PROPIO del negocio (MAU-10, 27/10/2026, docs/diseno-venta-externa-stripe.md)
// ─────────────────────────────────────────────────────────────────────────────

export type VentaExterna = {
  /** La fila del cobro (lib/cobros-externos-reglas.ts, `filaDeVentaExterna`): sin token, lead ni producto. */
  fila: FilaVentaExterna;
  /** El comprador, como lo dejó en el checkout. */
  contacto: { email: string | null; telefono: string | null; nombre: string | null };
  /** El primer ítem, para reconocer el producto de MaKo: por el nombre y el precio de LISTA (con descuento no daría el mismo). */
  item: { nombre: string; montoUsdLista: number | null; tipo: TipoCobro } | null;
};

/** Cuánto espera un aviso que perdió el reclamo antes de tomar como abandonada una venta reclamada sin lead. */
const RECLAMO_DE_VENTA_MS = 2 * 60_000;

/**
 * Asienta una venta de un Payment Link propio como un cobro EXTERNO ya pagado (el diseño, §2 a §4), en este orden:
 *   1. se RECLAMA la venta insertando el cobro con su `cs_` (`cobros_ref_uk`): un segundo aviso, el cron o el script chocan acá
 *      y no crean un segundo lead (`createLead` no es atómico: leads no tiene único por email);
 *   2. el lead: el del EMAIL del recibo, si no el del teléfono, si no uno nuevo con casa = el CRM del vínculo del producto (así
 *      `ganarLead` lo gana en el mismo pedido). ⚠️ El comprador más probable YA EXISTE: se completa lo vacío, nada más;
 *   3. `aplicarPagoAprobado`: el trato del vínculo, la cuota, ganar al lead, el aviso «Entró un pago». Idempotente.
 * Cada paso sigue desde lo que falte: un reintento con el cobro reclamado y sin lead, lo completa. ⚠️ NUNCA escribe en Stripe:
 * la fila entra `pagado`, así `aplicarPagoAprobado` no la ve `nuevo` y no programa el plazo ni reabre nada.
 */
export async function registrarVentaExterna(ws: number, v: VentaExterna): Promise<{ cobro: Cobro; leadId: number | null; aviso: string | null }> {
  if (ws === (await wsSuperAdmin())) throw new Error('La cuenta de MaKo no registra ventas externas.');
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const autor = NOMBRE_PASARELA.stripe;

    // 1. El reclamo. El producto se busca ANTES: si no se puede leer el catálogo, tira y Stripe reintenta sin nada escrito.
    const productoId = v.item
      ? productoDeMako({ nombre: v.item.nombre, montoUsd: v.item.montoUsdLista, tipo: v.item.tipo }, await productosParaCobrar()).id
      : null;
    let cobro: Cobro;
    const ins = await db.from('cobros').insert({ ...v.fila, token: nuevoTokenCobro(), lead_id: null, producto_id: productoId }).select(COLS_COBRO).single();
    if (ins.data) cobro = cobroDeFila(ins.data as Record<string, unknown>);
    else if (ins.error?.code === '23505') {
      const { data: ya, error: eYa } = await db.from('cobros').select(COLS_COBRO).eq('proveedor', 'stripe').eq('proveedor_ref', v.fila.proveedor_ref).maybeSingle();
      // ⚠️ Los dos «todavía no» de abajo van con status 503 (28/10/2026, la verificación de 3ca2d8328): sin status,
      // `esErrorTransitorio` los daba por definitivos, la ruta contestaba 200 y Stripe no volvía NUNCA. El reintento enseguida de
      // un aviso cortado (un «Reenviar» desde el panel de Stripe, o su primer reintento) dejaba la venta sin lead para siempre.
      if (eYa || !ya) throw Object.assign(new Error(`La venta ya estaba reclamada y no la pude releer: ${eYa?.message ?? 'sin fila'}`), { status: 503 });
      cobro = cobroDeFila(ya as Record<string, unknown>);
      // Un cobro de MaKo con ese `cs_` no se toca (no debería existir: `cobroDelAviso` lo habría encontrado antes).
      if (!esCobroExterno(cobro)) return { cobro, leadId: cobro.lead_id, aviso: 'la sesión ya es de un cobro de MaKo' };
      // Otro aviso la reclamó hace un momento y todavía no tiene lead: lo está creando. Éste vuelve después (503: Stripe reintenta).
      if (cobro.lead_id == null && Date.now() - Date.parse(cobro.created_at) < RECLAMO_DE_VENTA_MS) {
        throw Object.assign(new Error('Otro aviso está registrando esta venta: se completa en el próximo intento.'), { status: 503 });
      }
    } else throw new Error(`No pude guardar la venta: ${ins.error?.message ?? 'sin respuesta'}`);

    // 2. El lead.
    let aviso: string | null = null;
    if (cobro.lead_id == null) {
      const { email, telefono, nombre } = v.contacto;
      if (!email && !telefono) {
        aviso = 'sin email ni teléfono del comprador: la venta quedó sin lead';
        cobro = (await actualizar(ws, cobro.id, { motivo: 'Venta por un link de pago sin email ni teléfono del comprador: quedó sin lead.' })) ?? cobro;
      } else {
        const porEmail = email ? await findLeadByContacto(email, null) : null;
        const porTel = !porEmail && telefono ? await findLeadByContacto(null, telefono) : null;
        let leadId = porEmail?.id ?? porTel?.id ?? null;
        if (leadId != null) {
          // Lo cargado gana: sólo se completa lo vacío (`camposParaCompletar`, lib/leads-duplicados.ts).
          const id = leadId;
          await enriquecerLead(id, { nombre, email, telefono }, autor).catch((e) => console.warn(`[cobros] no pude completar el lead ${id} de la venta ${cobro.id}:`, e instanceof Error ? e.message : String(e)));
        } else {
          const casa = productoId != null ? (await vinculosDelNegocio()).find((x) => x.productoId === productoId)?.funnelId ?? null : null;
          const nuevo = await createLead({
            nombre: nombre || email?.split('@')[0] || telefono || 'Comprador', email, telefono, origen_lead: 'stripe', funnel_id: casa,
            // Ya se buscó por email y por teléfono: un parecido por nombre no puede frenar una venta cobrada.
            permitirDuplicado: true,
          });
          leadId = nuevo.id;
          await logLeadEvent(leadId, 'Alta', `Compró por un link de pago de Stripe (${v.fila.creado_por.slice(PREFIJO_EXTERNO.length)}).`, autor);
        }
        // Atado sólo si nadie lo ató antes: con dos avisos a la vez, gana uno.
        const { data: atado, error: eAt } = await db.from('cobros').update({ lead_id: leadId }).eq('id', cobro.id).is('lead_id', null).select(COLS_COBRO).maybeSingle();
        if (eAt) throw new Error(`No pude atar la venta ${cobro.id} a su lead: ${eAt.message}`);
        cobro = atado ? cobroDeFila(atado as Record<string, unknown>) : ((await getCobro(ws, cobro.id)) ?? cobro);
      }
    }

    // 3. El pago: el trato, la cuota y ganar al lead. Sin lead, la fila queda pagada y dicha (no hay cuota sin lead).
    if (cobro.lead_id != null) {
      await aplicarPagoAprobado(cobro, {
        proveedorPagoId: v.fila.proveedor_pago_id, suscripcionId: v.fila.proveedor_suscripcion_id, pagadoAt: v.fila.pagado_at, autor,
      });
      cobro = (await getCobro(ws, cobro.id)) ?? cobro;
    }
    return { cobro, leadId: cobro.lead_id, aviso };
  });
}
