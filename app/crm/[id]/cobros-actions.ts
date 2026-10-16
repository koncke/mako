'use server';

// =============================================================================
// Server actions de los COBROS de la ficha del lead (Stripe y Mercado Pago)
// =============================================================================
// La tab Pagos de la ficha —que se monta por TRES puertas: /crm/[id], el modal del tablero
// (app/crm/LeadSheet.tsx) y Customer Success— cobra con un link y lista los cobros del lead. Todo lo
// que escribe pasa por lib/cobros.ts, el ÚNICO escritor de `cobros`; acá sólo se decide QUIÉN y en
// QUÉ workspace (el contrato entero: docs/diseno-pasarela-pagos.md §4.7).
//
// Lo que no se ve en el código y muerde:
//   · EL WORKSPACE SALE DE LA SESIÓN (`getWorkspaceActual`, que respeta el `?ws=` del super admin) y
//     NUNCA del cliente. Sin sesión o sin workspace, NADA (fail-closed): caer al ws1 sería cobrarle con
//     la Stripe de Mauricio, que es un CLIENTE. Los ids que llegan (lead, cobro) se buscan ADENTRO de
//     ese workspace (`getTenantDb` filtra por él): un id de otro negocio contesta «no encontré».
//   · DEVOLVER PLATA Y CANCELAR UNA SUSCRIPCIÓN ES SÓLO DEL ADMIN DEL WORKSPACE (`adminDeWorkspaceActual`,
//     que también deja pasar al super admin parado en ese ws). NUNCA `resolverWsAdmin` (lib/archivero.ts):
//     cae al ws1 cuando la sesión no resuelve, que es justo el agujero de arriba.
//   · Lo que mueve plata ajena NO se reintenta acá (AGENTS.md «Un default que cobra…»): las claves de
//     idempotencia de lib/cobros-reglas.ts son por cobro, así que un segundo clic de la persona no
//     devuelve dos veces — pero ese clic lo decide ella.
//   · La pantalla nunca ve el token ni la URL del proveedor: `CobroVisible` (lib/cobros-tipos.ts) lleva
//     el link de MaKo (/pagar/<token>), y sólo de los que todavía se pueden pagar.
//
// ⚠️ 'use server': sólo funciones async (y tipos). Ver AGENTS.md «En un archivo 'use server' SOLO se
// exportan funciones async» y tests/campana-producto.test.ts.

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getUsuarioActual } from '@/lib/auth';
import { adminDeWorkspaceActual, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { credDelCliente } from '@/lib/credenciales';
import { listProductos } from '@/lib/productos';
import {
  anularCobro, cancelarSuscripcionCobro, crearCobro, getCobro, linkDelCobro, listarCobros, pasarelasConectadas, reembolsarCobro,
} from '@/lib/cobros';
import { leerCuentaStripe } from '@/lib/stripe-api';
import { leerCuentaMp } from '@/lib/mercadopago-api';
import { normalizarMoneda } from '@/lib/pasarela-moneda';
import { esPasarela, type Cobro, type CobroVisible, type Pasarela, type TipoCobro } from '@/lib/cobros-tipos';

// La mutación ya ocurrió: si la invalidación fallara, la caché vence sola por su TTL (molde de
// deal-actions.ts). Nunca rompe lo que ya se escribió.
function bust(...tags: string[]) {
  try {
    for (const t of tags) updateTag(t);
  } catch {
    /* no-op: la caché vence por TTL */
  }
}

function revalidarLead(leadId: number | null | undefined, plata = false) {
  if (leadId) revalidatePath(`/crm/${leadId}`);
  revalidatePath('/crm');
  // Un reembolso desmarca la cuota: el cash del dashboard cambia.
  if (plata) {
    revalidatePath('/dashboard');
    revalidatePath('/general');
  }
}

/** Quién y dónde. null = sin sesión o sin workspace: no se hace nada (fail-closed). */
async function sesionDelWs(): Promise<{ ws: number; autor: string } | null> {
  const s = await getUsuarioActual().catch(() => null);
  if (!s) return null;
  const ws = await getWorkspaceActual();
  if (ws == null) return null;
  // El autor del historial, igual que `autorActual` de deal-actions.ts: el email, o 'CRM'.
  return { ws, autor: s.email?.trim() || 'CRM' };
}

/** ¿Administra ESTE workspace? (el admin del ws, o el super admin parado en él). */
async function esAdminDe(ws: number): Promise<boolean> {
  return (await adminDeWorkspaceActual().catch(() => null)) === ws;
}

const idValido = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;
const positivo = (n: unknown): number | null => {
  const v = Number(n);
  return n != null && n !== '' && Number.isFinite(v) && v > 0 ? v : null;
};
const textoCorto = (s: unknown, max: number): string | null => {
  const t = typeof s === 'string' ? s.trim() : '';
  return t ? t.slice(0, max) : null;
};
const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const SIN_SESION = 'Tu sesión no está activa en este negocio. Recarga la página.';

// ─────────────────────────────────────────────────────────────────────────────
// Lecturas
// ─────────────────────────────────────────────────────────────────────────────

export type ProductoCobrable = { id: number; nombre: string; tipo: TipoCobro; monto_usd: number | null };

export type OpcionesCobro =
  | { ok: true; pasarelas: Pasarela[]; productos: ProductoCobrable[]; esAdmin: boolean }
  | { ok: false; error: string };

/**
 * Con qué se le puede cobrar a ESTE lead: las pasarelas conectadas, los productos activos del
 * catálogo y si quien mira administra el negocio. Barato (sólo la base): lo pide la tarjeta al montar.
 * «No pude leer» vuelve como error, NO como «no hay pasarelas»: la pantalla diría «conecta Stripe» a
 * un negocio que ya lo conectó.
 */
export async function opcionesCobroAction(leadId: number): Promise<OpcionesCobro> {
  if (!idValido(leadId)) return { ok: false, error: 'Lead inválido.' };
  const ctx = await sesionDelWs();
  if (!ctx) return { ok: false, error: SIN_SESION };
  try {
    const [pasarelas, productos, esAdmin] = await Promise.all([
      pasarelasConectadas(ctx.ws),
      runWithWorkspace(ctx.ws, () => listProductos(true)),
      esAdminDe(ctx.ws),
    ]);
    return {
      ok: true,
      pasarelas,
      esAdmin,
      productos: productos.map((p) => ({
        id: p.id, nombre: p.nombre, tipo: p.tipo === 'suscripcion' ? 'suscripcion' : 'unico',
        monto_usd: p.monto_usd != null && Number(p.monto_usd) > 0 ? Number(p.monto_usd) : null,
      })),
    };
  } catch (e) {
    return { ok: false, error: `No pude leer cómo cobrar: ${mensaje(e)}` };
  }
}

/** La moneda de la CUENTA de cada pasarela conectada (null = no se pudo leer). */
export type MonedasCobro = Partial<Record<Pasarela, string | null>>;

/**
 * La moneda en la que cobra cada cuenta. Le pregunta a la PASARELA, no a una constante (AGENTS.md
 * «Un campo con una moneda en el NOMBRE…»): Mercado Pago cobra en la moneda del sitio de su cuenta
 * (una cuenta argentina, en ARS), y la de Stripe es su moneda por defecto. Habla con la red, así que
 * NO va al montar la ficha: lo pide el asistente al abrirse.
 */
export async function monedasCobroAction(): Promise<MonedasCobro> {
  const ctx = await sesionDelWs();
  if (!ctx) return {};
  const [keyStripe, tokenMp] = await Promise.all([
    credDelCliente('STRIPE_SECRET_KEY', ctx.ws).catch(() => null),
    credDelCliente('MERCADOPAGO_ACCESS_TOKEN', ctx.ws).catch(() => null),
  ]);
  const [stripe, mp] = await Promise.all([
    keyStripe ? leerCuentaStripe(keyStripe).catch(() => null) : Promise.resolve(undefined),
    tokenMp ? leerCuentaMp(tokenMp).catch(() => null) : Promise.resolve(undefined),
  ]);
  const out: MonedasCobro = {};
  if (stripe !== undefined) out.stripe = stripe && stripe.ok ? normalizarMoneda(stripe.moneda) : null;
  if (mp !== undefined) out.mercadopago = mp && mp.ok ? normalizarMoneda(mp.moneda) : null;
  return out;
}

/** Lo que la pantalla puede ver de un cobro: sin token ni URL del proveedor. */
function visible(c: Cobro): CobroVisible {
  return {
    id: c.id, lead_id: c.lead_id, proveedor: c.proveedor, modo: c.modo, tipo: c.tipo, concepto: c.concepto,
    monto: c.monto, moneda: c.moneda, monto_usd: c.monto_usd, estado: c.estado, suscripcion_estado: c.suscripcion_estado,
    created_at: c.created_at, pagado_at: c.pagado_at, reembolsado_at: c.reembolsado_at, motivo: c.motivo,
    // El link se puede seguir mandando mientras se pueda pagar: pendiente, o rechazado (la persona
    // reintenta con otra tarjeta y `urlParaPagar` lo acepta). El resto no lleva link.
    link: c.estado === 'pendiente' || c.estado === 'fallido' ? linkDelCobro(c.token) : null,
  };
}

/** Los cobros del lead, del más nuevo al más viejo. Tira si no pudo leer (la lista dice «no pude»). */
export async function cobrosDelLeadAction(leadId: number): Promise<CobroVisible[]> {
  if (!idValido(leadId)) return [];
  const ctx = await sesionDelWs();
  if (!ctx) throw new Error(SIN_SESION);
  const cobros = await listarCobros(ctx.ws, { leadId, limite: 50 });
  return cobros.map(visible);
}

/**
 * Lo que decide si la ficha dibuja la tab Pagos por el lado de la pasarela (lib/muestra-pagos.ts):
 * si el negocio puede cobrar con un link y si el lead ya tiene cobros. La leen la ruta /crm/[id] y
 * `getLeadFullAction` (el modal), para que las dos puertas usen los MISMOS datos.
 * NUNCA tira: una falla acá apaga la tab, no la ficha.
 */
export async function senalesDeCobroAction(leadId: number): Promise<{ pasarelaConectada: boolean; hayCobros: boolean }> {
  const nada = { pasarelaConectada: false, hayCobros: false };
  if (!idValido(leadId)) return nada;
  const ctx = await sesionDelWs().catch(() => null);
  if (!ctx) return nada;
  const [pasarelas, cobros] = await Promise.all([
    pasarelasConectadas(ctx.ws).catch(() => [] as Pasarela[]),
    listarCobros(ctx.ws, { leadId, limite: 1 }).catch(() => [] as Cobro[]),
  ]);
  return { pasarelaConectada: pasarelas.length > 0, hayCobros: cobros.length > 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Escrituras
// ─────────────────────────────────────────────────────────────────────────────

export type DatosCobro = {
  pasarela?: Pasarela | null;
  productoId?: number | null;
  concepto?: string | null;
  monto?: number | null;
  moneda?: string | null;
  /** El valor en USD que declaró la persona, cuando cobra en otra moneda y no hay producto con precio. */
  montoUsd?: number | null;
  tipo?: TipoCobro | null;
  /** Sólo si el lead no tiene email y la pasarela lo exige (suscripción de Mercado Pago). */
  email?: string | null;
  /** La CUOTA del CRM que salda el link (`pagos.id`): el «cobrar una cuota con link» del bloque `cuotas`. */
  pagoId?: number | null;
};

export type ResultadoCobrar =
  | { ok: true; link: string; prueba: boolean; yaEstaba?: true }
  | { ok: false; error: string; faltan?: string[] };

/**
 * Crea el link de pago. Lo que llega del navegador se re-valida acá (es entrada de afuera) y lo demás
 * —qué pasarela, qué moneda, el valor en USD— lo decide `crearCobro` con `decidirCobro`.
 *
 * `pagoId` (14/10/2026): el link que salda UNA cuota. Hasta hoy se rechazaba a propósito porque
 * `registrarCobroDeProveedor` marcaba la cuota por su id sin mirar de qué lead era; eso se cerró el 11/10
 * (`.eq('lead_id', p.leadId)`) y se abre con tres cortes más, en lib/cobros.ts y lib/pagos.ts:
 *   · `crearCobro` valida la cuota adentro del workspace del cobro (de ESTE lead, impaga, sin pasarela) y si
 *     ya tiene un link vivo devuelve ése (`yaEstaba`);
 *   · el link cobra la cuota: su valor en dólares ES el de la cuota, y en USD el monto tiene que coincidir;
 *   · al pagarse, `registrarCobroDeProveedor` la salda por id SÓLO si sigue impaga y por el mismo monto, y
 *     `marcarPago` corta su cobranza (`cerrarCorridasDeCuota`). Si no coincide, entra como cuota nueva.
 */
export async function crearCobroAction(leadId: number, datos: DatosCobro): Promise<ResultadoCobrar> {
  if (!idValido(leadId)) return { ok: false, error: 'Lead inválido.' };
  const ctx = await sesionDelWs();
  if (!ctx) return { ok: false, error: SIN_SESION };
  const d = datos ?? {};
  const email = textoCorto(d.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Ese email no es válido.', faltan: ['email'] };
  if (d.pagoId != null && !idValido(d.pagoId)) return { ok: false, error: 'Cuota inválida.' };
  try {
    const r = await crearCobro(ctx.ws, {
      leadId,
      pasarela: esPasarela(d.pasarela) ? d.pasarela : null,
      productoId: idValido(d.productoId) ? d.productoId : null,
      pagoId: idValido(d.pagoId) ? d.pagoId : null,
      concepto: textoCorto(d.concepto, 200),
      monto: positivo(d.monto),
      moneda: d.moneda ? normalizarMoneda(d.moneda) : null,
      montoUsd: positivo(d.montoUsd),
      tipo: d.tipo === 'suscripcion' || d.tipo === 'unico' ? d.tipo : null,
      email,
      creadoPor: ctx.autor,
    });
    if (!r.ok) return { ok: false, error: r.error, ...(r.faltan ? { faltan: r.faltan } : {}) };
    bust(TAG.pagos, TAG.leads);
    revalidarLead(leadId);
    return { ok: true, link: r.link, prueba: r.cobro.modo === 'prueba', ...(r.yaEstaba ? { yaEstaba: true as const } : {}) };
  } catch (e) {
    return { ok: false, error: `No pude crear el link: ${mensaje(e)}` };
  }
}

/** Anula un link que todavía no se pagó. Cualquiera de la ficha (no mueve plata). */
export async function anularCobroAction(cobroId: number): Promise<{ ok: boolean; error?: string }> {
  if (!idValido(cobroId)) return { ok: false, error: 'Cobro inválido.' };
  const ctx = await sesionDelWs();
  if (!ctx) return { ok: false, error: SIN_SESION };
  try {
    const c = await getCobro(ctx.ws, cobroId);
    if (!c) return { ok: false, error: 'No encontré ese cobro.' };
    const r = await anularCobro(ctx.ws, cobroId, ctx.autor);
    if (r.ok) {
      bust(TAG.pagos, TAG.leads);
      revalidarLead(c.lead_id);
    }
    return r;
  } catch (e) {
    return { ok: false, error: `No pude anular el link: ${mensaje(e)}` };
  }
}

/**
 * Devuelve el pago ENTERO por la pasarela. Mueve plata real y no se deshace: sólo un admin del
 * workspace, y la pantalla lo confirma antes. No se reintenta solo.
 */
export async function reembolsarCobroAction(cobroId: number, motivo?: string | null): Promise<{ ok: boolean; resumen: string }> {
  if (!idValido(cobroId)) return { ok: false, resumen: 'Cobro inválido.' };
  const ctx = await sesionDelWs();
  if (!ctx) return { ok: false, resumen: SIN_SESION };
  if (!(await esAdminDe(ctx.ws))) return { ok: false, resumen: 'Sólo un administrador de este negocio puede devolver un pago.' };
  try {
    const c = await getCobro(ctx.ws, cobroId);
    if (!c) return { ok: false, resumen: 'No encontré ese cobro.' };
    const r = await reembolsarCobro(ctx.ws, cobroId, ctx.autor, textoCorto(motivo, 280));
    if (r.ok) {
      bust(TAG.pagos, TAG.leads);
      revalidarLead(c.lead_id, true);
    }
    return r;
  } catch (e) {
    // Puede haber salido de la pasarela y fallado al asentarlo: la clave de idempotencia es por cobro,
    // así que volver a apretar NO devuelve dos veces (y si ya quedó, dice «ya estaba reembolsado»).
    bust(TAG.pagos, TAG.leads);
    return { ok: false, resumen: `No pude terminar la devolución: ${mensaje(e)}. Volver a intentarlo no devuelve dos veces.` };
  }
}

/** Cancela la suscripción en la pasarela EN EL ACTO. Irreversible: sólo un admin del workspace. */
export async function cancelarSuscripcionAction(cobroId: number): Promise<{ ok: boolean; resumen: string }> {
  if (!idValido(cobroId)) return { ok: false, resumen: 'Cobro inválido.' };
  const ctx = await sesionDelWs();
  if (!ctx) return { ok: false, resumen: SIN_SESION };
  if (!(await esAdminDe(ctx.ws))) return { ok: false, resumen: 'Sólo un administrador de este negocio puede cancelar una suscripción.' };
  try {
    const c = await getCobro(ctx.ws, cobroId);
    if (!c) return { ok: false, resumen: 'No encontré ese cobro.' };
    const r = await cancelarSuscripcionCobro(ctx.ws, cobroId, ctx.autor);
    if (r.ok) {
      bust(TAG.pagos, TAG.leads);
      revalidarLead(c.lead_id, true);
    }
    return r;
  } catch (e) {
    bust(TAG.pagos, TAG.leads);
    return { ok: false, resumen: `No pude terminar la cancelación: ${mensaje(e)}` };
  }
}
