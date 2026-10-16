'use server';

// =============================================================================
// ficha/pagos/documento-actions — «Leer con IA»: lo que un documento llena en el deal (sólo lo vacío)
// =============================================================================
// Los bloques `contrato` y `datos-fiscales` suben el archivo a su ruta de siempre (/api/extract-contract,
// /api/extract-deal-fiscal), que lo guarda y devuelve lo que leyó. Hasta el 16/10/2026 eso llenaba el BORRADOR de
// «Editar deal» y se guardaba con su botón, que reemplazaba los jsonb enteros. Acá se escribe campo por campo con
// los mismos escritores que la tab (lib/pagos.ts, `escribirCampoDeal` y `escribirObligacion`): cada campo con su
// merge y su línea en el historial, y SÓLO los vacíos (`loQueLlenaElDocumento`, lib/pagos-vistazo.ts).
//
// ⚠️ Sin sesión, nada (tests/acciones-sin-sesion.test.ts): sin cookie el workspace cae al ws1, un cliente. Y el
//    lead tiene que ser del negocio de la sesión antes de escribir (`asegurarLeadDelNegocio`).
// ⚠️ Lo que vuelve del navegador es lo que la ruta leyó, pero es entrada de afuera: se limpia y se acota igual.
// ⚠️ 'use server': sólo funciones async (y tipos).
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getUsuarioActual } from '@/lib/auth';
import { getLead } from '@/lib/leads';
import { asegurarLeadDelNegocio, escribirCampoDeal, escribirObligacion } from '@/lib/pagos';
import { loQueLlenaElDocumento, type DocumentoLeido } from '@/lib/pagos-vistazo';

async function haySesion(): Promise<boolean> {
  try { return Boolean(await getUsuarioActual()); } catch { return false; }
}
async function autor(): Promise<string> {
  try { return (await getUsuarioActual())?.email?.trim() || 'CRM'; } catch { return 'CRM'; }
}

/** Lo que el documento llenó, dicho para la pantalla («Se completó: servicio, promesa»), y lo que no se pudo. */
export async function completarConDocumentoAction(leadId: number, leido: DocumentoLeido): Promise<{ ok: true; secciones: string[]; fallaron: number } | { ok: false; error: string }> {
  try {
    if (!(await haySesion())) return { ok: false, error: 'Tu sesión no está activa en este negocio. Recarga la página.' };
    if (!Number.isInteger(leadId) || leadId <= 0 || !leido || typeof leido !== 'object') return { ok: false, error: 'Pedido inválido.' };
    await asegurarLeadDelNegocio(leadId);
    const lead = await getLead(leadId);
    if (!lead) return { ok: false, error: 'No encontré ese lead en este negocio.' };
    const plan = loQueLlenaElDocumento(lead, leido);
    const quien = await autor();
    let fallaron = 0;
    for (const c of plan.campos) {
      const r = await escribirCampoDeal(leadId, c, quien);
      if (!r.ok) fallaron++;
    }
    for (const o of plan.obligaciones) {
      const r = await escribirObligacion(leadId, { accion: 'agregar', parte: o.parte, texto: o.texto }, quien);
      if (!r.ok) fallaron++;
    }
    if (plan.campos.length || plan.obligaciones.length) {
      try { updateTag(TAG.leads); } catch { /* vence por TTL */ }
      revalidatePath(`/crm/${leadId}`);
      revalidatePath('/customer-success');
    }
    return { ok: true, secciones: plan.secciones, fallaron };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
