'use server';

// =============================================================================
// cobro-etapa-actions — «Vincular cobro» en el ⋯ de la etapa Ganado (22/10/2026, mig 0326)
// =============================================================================
// Las puertas del modal que dibuja el CRM (el ⋯ de la columna Ganado, como «Asignar evento»). El contrato es el de
// contrato-cobro-en-ganado.md (las notas del Cerebro): estas firmas no cambian sin avisar. Las reglas viven en
// lib/cobro-etapa.ts y la base en lib/cobro-etapa-server.ts. Acá sólo: quién puede (leer, cualquiera con sesión;
// escribir, el admin del negocio, el mismo corte que `editarEtapaAction`) y qué se devuelve.
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (y tipos). Ver AGENTS.md.
// =============================================================================

import { revalidatePath } from 'next/cache';
import { getRolWsEfectivo, wsObligatorio } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { exigirSesion } from '@/lib/sesion-accion';
import { pasarelasConectadas } from '@/lib/cobros';
import { cuentasDePasarelas, type CuentaPago, type FotoCobroEtapa, type ProductoCobro, type ProductoCobroInput, type ResCobro, type VinculoCobro } from '@/lib/cobro-etapa';
import { cambiarCuentas, desvincular, guardarProducto, productosParaCobrar, vincular, vinculosDeEtapa } from '@/lib/cobro-etapa-server';

export type { CuentaPago, FotoCobroEtapa, ProductoCobro, ProductoCobroInput, ResCobro, VinculoCobro } from '@/lib/cobro-etapa';

const SOLO_ADMIN = 'Solo el administrador del negocio puede vincular cobros.';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function esAdmin(): Promise<boolean> {
  return (await getRolWsEfectivo()) === 'admin';
}

async function autorActual(): Promise<string> {
  try {
    return (await getUsuarioActual())?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}

/** Las cuentas conectadas del negocio en curso. */
async function cuentasConectadas(): Promise<CuentaPago[]> {
  return cuentasDePasarelas(await pasarelasConectadas(await wsObligatorio()));
}

/** Lo que el modal necesita de una vez: las cuentas, los productos activos, los vínculos de ESTA etapa y si puede editar. */
export async function leerCobroDeEtapaAction(funnelId: number, etapa: string): Promise<ResCobro<{ foto: FotoCobroEtapa }>> {
  await exigirSesion();
  try {
    const [cuentas, productos, vinculos, puedeEditar] = await Promise.all([
      cuentasConectadas(), productosParaCobrar(), vinculosDeEtapa(Number(funnelId), String(etapa)), esAdmin(),
    ]);
    return { ok: true, foto: { cuentas, productos, vinculos, puedeEditar } };
  } catch (e) {
    console.error('[cobro-etapa] leer:', msg(e));
    return { ok: false, error: `No pude leer los cobros de esta etapa: ${msg(e)}` };
  }
}

/** Vincula un producto a la etapa Ganado de un CRM, cobrable por esas cuentas. Un producto cobra en UN CRM. */
export async function vincularProductoAEtapaAction(p: { funnelId: number; etapa: string; productoId: number; cuentas: string[] }): Promise<ResCobro<{ vinculo: VinculoCobro }>> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  try {
    const r = await vincular(p, await cuentasConectadas(), await autorActual());
    if (r.ok) revalidatePath('/crm');
    return r;
  } catch (e) {
    console.error('[cobro-etapa] vincular:', msg(e));
    return { ok: false, error: `No se pudo vincular: ${msg(e)}` };
  }
}

/** Cambia las cuentas por las que se cobra un vínculo (al menos una). */
export async function cambiarCuentasDelVinculoAction(vinculoId: number, cuentas: string[]): Promise<ResCobro<{ vinculo: VinculoCobro }>> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  try {
    return await cambiarCuentas(Number(vinculoId), Array.isArray(cuentas) ? cuentas : [], await cuentasConectadas());
  } catch (e) {
    console.error('[cobro-etapa] cuentas:', msg(e));
    return { ok: false, error: `No se pudieron cambiar las cuentas: ${msg(e)}` };
  }
}

/** Quita un vínculo; devuelve con qué volver a vincularlo (el Deshacer). */
export async function desvincularProductoAction(vinculoId: number): Promise<ResCobro<{ deshacer: { funnelId: number; etapa: string; productoId: number; cuentas: string[] } }>> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  try {
    const r = await desvincular(Number(vinculoId));
    if (r.ok) revalidatePath('/crm');
    return r;
  } catch (e) {
    console.error('[cobro-etapa] desvincular:', msg(e));
    return { ok: false, error: `No se pudo quitar: ${msg(e)}` };
  }
}

/** Crea un producto (sin `id`) o edita el nombre, el tipo, el precio, el plazo y las cuotas de uno (con `id`). */
export async function guardarProductoCobroAction(input: ProductoCobroInput, id?: number): Promise<ResCobro<{ producto: ProductoCobro }>> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  try {
    return await guardarProducto(input, id == null ? undefined : Number(id));
  } catch (e) {
    console.error('[cobro-etapa] producto:', msg(e));
    return { ok: false, error: `No se pudo guardar el producto: ${msg(e)}` };
  }
}

/**
 * El link para pegar en una landing o un mensaje. TODAVÍA NO (22/10/2026): un link sin lead necesita su propia página de
 * pago (la de la landing pide nombre y email antes de cobrar). Mientras, el producto se cobra con el Botón de pago de una
 * landing o con un link desde la ficha del lead, y al pagarse pasa a Ganado igual.
 */
export async function linkDelVinculoAction(vinculoId: number, cuentaId: string): Promise<ResCobro<{ url: string }>> {
  await exigirSesion();
  void vinculoId; void cuentaId;
  return { ok: false, error: 'Cóbralo con el Botón de pago de una landing o con un link desde la ficha del lead: al pagarse, pasa a Ganado aquí.' };
}
