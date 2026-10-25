'use server';

// =============================================================================
// «Tu plan»: el botón «Darme de baja» del plan de MaKo (15/10/2026)
// =============================================================================
// Lo decidió Estrategia el 15/10: un botón PROPIO en MaKo (no el portal de Stripe), que cubre Stripe y Mercado Pago.
// Sólo el ADMIN de ESTE workspace (`adminDeWorkspaceActual`, que también deja pasar al super admin parado en él): el plan
// es lo que la plataforma le cobra al negocio. El cobro se busca por `alta_ws = ws` (`suscripcionDeMakoDe`, lib/cobros.ts):
// un negocio da de baja el suyo y nunca el de otro. Lo que corta plata no se reintenta acá: el segundo clic lo decide la
// persona (y pedirla dos veces devuelve el mismo código).

import { revalidatePath } from 'next/cache';
import { getUsuarioActual } from '@/lib/auth';
import { adminDeWorkspaceActual, estaImpersonando, getCapaActual } from '@/lib/workspace';
import { capaDef } from '@/lib/capas';
import { darDeBajaMiPlan, type ResultadoBaja } from '@/lib/cobros';
import { mandarCodigoDeBaja } from '@/lib/invitaciones';
import { aplicarRetencion, type OpcionRetencion } from '@/lib/retencion-plan';
import { subirAPro, type ResultadoSubida } from '@/lib/subir-plan';
import { guardarDeudaAntesDeLaBaja } from '@/lib/plan-deuda';
import { empezarPlanAhora, type ResultadoEmpezar } from '@/lib/empezar-plan';

export async function darmeDeBajaAction(): Promise<ResultadoBaja> {
  const ws = await adminDeWorkspaceActual().catch(() => null);
  if (ws == null) return { ok: false, resumen: 'Sólo quien administra el negocio puede darlo de baja.' };
  const sesion = await getUsuarioActual();
  // En plena mora, la deuda queda guardada antes de la baja (la baja pisa el aviso de la renovación fallida).
  await guardarDeudaAntesDeLaBaja(ws).catch((e) => console.warn('[plan] deuda antes de la baja:', e instanceof Error ? e.message : String(e)));
  const r = await darDeBajaMiPlan(ws, sesion?.nombre || sesion?.email || 'el negocio');
  // El comprobante, al email de quien la pidió. Si no sale, la baja igual quedó hecha (el código está en pantalla).
  if (r.ok && sesion?.email) {
    const plan = capaDef(await getCapaActual()).nombre;
    const m = await mandarCodigoDeBaja({ to: sesion.email, codigo: r.codigo, plan, finAt: r.finAt });
    if (!m.enviado) console.error(`[plan] no salió el código de baja ${r.codigo}: ${m.error ?? 'sin detalle'}`);
  }
  revalidatePath('/configuraciones/plan');
  return r;
}

/** «Quedarme con el descuento» (23/10/2026): la oferta de retención antes de la baja (lib/retencion-plan.ts). Sólo el admin, una vez. */
export async function aceptarRetencionAction(opcion: OpcionRetencion = 'descuento'): Promise<{ ok: boolean; resumen: string }> {
  const ws = await adminDeWorkspaceActual().catch(() => null);
  if (ws == null) return { ok: false, resumen: 'Sólo quien administra el negocio puede cambiar su plan.' };
  const sesion = await getUsuarioActual();
  if (opcion !== 'descuento' && opcion !== 'pausa' && opcion !== 'bajar') return { ok: false, resumen: 'Opción inválida.' };
  const r = await aplicarRetencion(ws, sesion?.nombre || sesion?.email || 'el negocio', opcion);
  revalidatePath('/configuraciones/plan');
  return r;
}

/**
 * «Pasar a Pro» (23/10/2026): adonde llevan los carteles de tope. Sólo el admin. Stripe cobra la diferencia ahora y, si no
 * pasa, no cambia nada; Mercado Pago sube desde el próximo cobro, con Pro en el acto (lib/subir-plan.ts).
 */
/**
 * «Empezar mi plan ya» (25/10/2026): a donde lleva el botón de los topes de la PRUEBA GRATIS. Sólo el dueño (quien mira otro
 * negocio no le abre un cobro a su tarjeta). Devuelve el link del pago; la prueba se cancela cuando ese pago entra.
 */
export async function empezarPlanYaAction(): Promise<ResultadoEmpezar> {
  const ws = await adminDeWorkspaceActual().catch(() => null);
  if (ws == null) return { ok: false, resumen: 'Sólo quien administra el negocio puede empezar su plan.' };
  if (await estaImpersonando().catch(() => true)) return { ok: false, resumen: 'El plan lo empieza el dueño del negocio desde su cuenta.' };
  const sesion = await getUsuarioActual();
  return empezarPlanAhora(ws, sesion?.nombre || sesion?.email || 'el negocio');
}

export async function pasarAProAction(): Promise<ResultadoSubida> {
  const ws = await adminDeWorkspaceActual().catch(() => null);
  if (ws == null) return { ok: false, resumen: 'Sólo quien administra el negocio puede cambiar su plan.' };
  // Quien MIRA otro negocio (la agencia en su cliente, el super admin) no le cobra a la tarjeta del dueño (revisión adversarial).
  if (await estaImpersonando().catch(() => true)) return { ok: false, resumen: 'El plan lo cambia el dueño del negocio desde su cuenta.' };
  const sesion = await getUsuarioActual();
  const r = await subirAPro(ws, sesion?.nombre || sesion?.email || 'el negocio');
  revalidatePath('/configuraciones/plan');
  return r;
}
