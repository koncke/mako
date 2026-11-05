'use server';

// =============================================================================
// suscripcion-actions — lo que escribe la tab Pagos de una SUSCRIPCIÓN (5/11/2026)
// =============================================================================
// El pedido de Martín y lo que se copió: docs/investigacion-suscripciones.md. Cambiar el monto desde un mes, cortar y
// retomar (sólo el admin, como cancelarla hasta hoy) y registrar un pago con su mes y su medio (cualquiera con sesión,
// como «Registrar el pago»). La implementación es UNA, la misma de la API de MaKo: lib/suscripcion-cambios.ts.
// ⚠️ Una suscripción que cobra la pasarela no se cambia desde acá: su monto es el de su cobro.
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { listarCobros } from '@/lib/cobros';
import { laCobraLaPasarela } from '@/lib/cobros-reglas';
import { cambiarSuscripcion, deshacerCambioSuscripcion, registrarPagoDeSuscripcion, type CambioSuscripcion, type PagoDeSuscripcionNuevo } from '@/lib/suscripcion-cambios';

async function haySesion(): Promise<boolean> {
  try { return Boolean(await getUsuarioActual()); } catch { return false; }
}
async function autor(): Promise<string> {
  try { return (await getUsuarioActual())?.email?.trim() || 'CRM'; } catch { return 'CRM'; }
}
async function esAdmin(): Promise<boolean> {
  try { return (await getRolWsEfectivo()) === 'admin'; } catch { return false; }
}

const SIN_SESION = 'Tu sesión no está activa en este negocio. Recarga la página.';
const SOLO_ADMIN = 'Sólo el administrador de este negocio puede cambiar la suscripción.';
const idValido = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;
const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e));
type Fallo = { ok: false; error: string };

function refrescar(leadId: number) {
  try { updateTag(TAG.pagos); updateTag(TAG.leads); } catch { /* vence por TTL */ }
  revalidatePath(`/crm/${leadId}`);
  revalidatePath('/dashboard');
  revalidatePath('/general');
}

/** ¿La cobra la pasarela? Entonces no se cambia desde acá. null = se puede. */
async function laCobraStripeOMp(leadId: number): Promise<string | null> {
  const ws = await getWorkspaceActual();
  if (ws == null) return SIN_SESION;
  const cobros = await listarCobros(ws, { leadId, limite: 50 }).catch(() => null);
  if (cobros == null) return 'No pude leer los cobros de la pasarela: no se sabe si la cobra ella. Prueba de nuevo en un rato.';
  return laCobraLaPasarela(cobros) ? 'Esta suscripción la cobra la pasarela: su monto y su corte se cambian desde su cobro, en Links de pago.' : null;
}

/** Cambiar el monto desde un mes, cortarla o retomarla. Devuelve los ids para el Deshacer. */
export async function cambiarSuscripcionAction(leadId: number, cambio: CambioSuscripcion): Promise<{ ok: true; ids: number[]; resumen: string; yaEstaba: boolean } | Fallo> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
    if (!idValido(leadId)) return { ok: false, error: 'Pedido inválido.' };
    const pasarela = await laCobraStripeOMp(leadId);
    if (pasarela) return { ok: false, error: pasarela };
    const r = await cambiarSuscripcion(leadId, cambio, await autor());
    if (!r.ok) return { ok: false, error: r.error };
    if (r.ids.length) refrescar(leadId);
    return { ok: true, ids: r.ids, resumen: r.resumen, yaEstaba: !!r.yaEstaba };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/** El «Deshacer» de lo recién cambiado: sólo esos ids, y de este lead. */
export async function deshacerCambioSuscripcionAction(leadId: number, ids: number[]): Promise<{ ok: true } | Fallo> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
    if (!idValido(leadId) || !Array.isArray(ids) || !ids.every(idValido)) return { ok: false, error: 'Pedido inválido.' };
    const r = await deshacerCambioSuscripcion(leadId, ids, await autor());
    if (!r.ok) return { ok: false, error: r.error ?? 'No pude deshacerlo.' };
    refrescar(leadId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/** Registrar un pago: el mes que paga (o un ajuste), con su medio y su moneda. */
export async function registrarPagoSuscripcionAction(leadId: number, datos: PagoDeSuscripcionNuevo): Promise<{ ok: true; pagoId: number; mesGuardado: boolean; texto: string } | Fallo> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId)) return { ok: false, error: 'Pedido inválido.' };
    if (!(Number(datos?.monto) > 0)) return { ok: false, error: 'Falta el monto.' };
    if (!datos.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) return { ok: false, error: 'Falta la fecha del pago.' };
    const r = await registrarPagoDeSuscripcion(leadId, datos, await autor());
    refrescar(leadId);
    return { ok: true, pagoId: r.pagoId, mesGuardado: r.mesGuardado, texto: r.texto };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}
