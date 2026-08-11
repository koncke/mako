'use server';

// =============================================================================
// Confirmar o descartar un lead propuesto
// =============================================================================
// Acá se aplica la propuesta: es el ÚNICO lugar donde un lead que vino de un canal
// entra de verdad al CRM, y pasa por una persona.
//
// El applier vive acá y no en `lib/propuestas.ts` a propósito: ese módulo es genérico
// (guarda `tipo` + `datos`) y meterle un `import { createLead }` lo ataría al CRM. El
// que sabe cómo se aplica un `tipo` es el dominio de ese tipo.
// =============================================================================

import { revalidatePath } from 'next/cache';
import { getPropuesta, marcarAplicada, descartarPropuesta } from '@/lib/propuestas';
import { createLead, findLeadByContacto, logLeadEvent } from '@/lib/leads';
import { getUsuarioActual } from '@/lib/auth';

const txt = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

export type ResultadoConfirmar = { ok: true; leadId: number; yaEstaba: boolean } | { ok: false; error: string };

/**
 * Crea el lead con lo que el usuario CONFIRMÓ (que puede no ser lo que llegó: el
 * formulario es editable, y ese es el punto de toda la pantalla).
 */
export async function confirmarLeadAction(id: string, editado: {
  nombre: string; email: string; telefono: string; empresa: string;
}): Promise<ResultadoConfirmar> {
  if (!(await getUsuarioActual())) return { ok: false, error: 'sin sesión' };

  const prop = await getPropuesta(id);
  if (!prop) return { ok: false, error: 'esa propuesta no existe' };
  if (prop.estado !== 'pendiente') return { ok: false, error: 'esa propuesta ya se resolvió' };

  const nombre = txt(editado.nombre);
  if (!nombre) return { ok: false, error: 'el nombre no puede quedar vacío' };
  const email = txt(editado.email)?.toLowerCase() ?? null;
  const telefono = txt(editado.telefono);
  if (!email && !telefono) return { ok: false, error: 'hace falta un mail o un teléfono' };

  // Puede haber entrado por otro lado entre que se propuso y que se confirma —un
  // instant form, un Calendly, alguien cargándolo a mano—. Se devuelve ese en vez de
  // duplicar, y la propuesta igual queda cerrada.
  const yaEsta = await findLeadByContacto(email, telefono);
  if (yaEsta) {
    await marcarAplicada(id, { lead_id: yaEsta.id, ya_estaba: true });
    revalidatePath('/crm');
    return { ok: true, leadId: yaEsta.id, yaEstaba: true };
  }

  const lead = await createLead({
    nombre,
    email,
    telefono,
    empresa: txt(editado.empresa),
    utm_source: txt(prop.datos.utm_source),
    utm_medium: txt(prop.datos.utm_medium),
    utm_campaign: txt(prop.datos.utm_campaign),
    utm_content: txt(prop.datos.utm_content),
  });

  // ⚠️ El estado se marca DESPUÉS de crear, y con la guarda de `pendiente` adentro: dos
  // pestañas abiertas o un doble click crean UN solo lead. Si `marcarAplicada` devuelve
  // false es que otro la ganó — pero el lead ya está creado, así que no es un error que
  // el usuario tenga que ver.
  await marcarAplicada(id, { lead_id: lead.id });

  const origen = txt(prop.datos.origen) ?? 'un canal externo';
  await logLeadEvent(lead.id, 'Alta', `Propuesto por Claude desde ${origen} y confirmado en MaKo`, 'Claude').catch(() => {});

  revalidatePath('/crm');
  return { ok: true, leadId: lead.id, yaEstaba: false };
}

export async function descartarLeadAction(id: string): Promise<{ ok: boolean }> {
  if (!(await getUsuarioActual())) return { ok: false };
  await descartarPropuesta(id);
  return { ok: true };
}
