import 'server-only';

// =============================================================================
// origen-cuenta-server — guarda y lee el ORIGEN de una cuenta de MaKo (contrato: lib/origen-cuenta.ts)
// =============================================================================
// Lo llama el alta que sale de un cobro (lib/cobros.ts, `altaSiCorresponde`) con el lead del comprador en el CRM
// de la plataforma. Es ACCESORIO al alta: si falla, la cuenta ya existe y se anota en el log, nada más.
// =============================================================================

import { getSupabaseServer } from './supabase';
import { getWorkspaceActual, wsSuperAdmin } from './workspace';
import { CLAVE_ORIGEN_CUENTA, CLAVE_WHATSAPP_DEL_PAGO, leerOrigen, origenDe, origenDeCheckout, whatsappDelPago, type OrigenCuenta } from './origen-cuenta';

/** El origen de un lead de la plataforma: sus UTM, su visitante y su primera visita a una landing de MaKo. */
export async function origenDeLeadMako(leadId: number): Promise<OrigenCuenta | null> {
  const db = getSupabaseServer();
  const ws = await wsSuperAdmin();
  const { data: lead, error } = await db.from('leads')
    .select('id, utm_source, utm_medium, utm_campaign, utm_content, visitor_id, pagina_registro')
    .eq('workspace_id', ws).eq('id', leadId).maybeSingle();
  if (error || !lead) return null;
  const visitor = typeof lead.visitor_id === 'string' && lead.visitor_id ? lead.visitor_id : null;
  let visitas: { landing_url?: unknown; created_at?: unknown }[] = [];
  if (visitor) {
    const { data } = await db.from('landing_visits').select('landing_url, created_at')
      .eq('workspace_id', ws).eq('visitor_id', visitor).order('created_at', { ascending: true }).limit(50);
    visitas = data ?? [];
  }
  return origenDe(lead as never, visitas, new Date().toISOString());
}

/** Guarda el origen en la cuenta NUEVA (app_settings, `cuenta.origen`). No pisa uno que ya esté. */
export async function guardarOrigenCuenta(ws: number, origen: OrigenCuenta): Promise<void> {
  const db = getSupabaseServer();
  const { data } = await db.from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_ORIGEN_CUENTA).maybeSingle();
  if (leerOrigen((data as { value?: unknown } | null)?.value)) return;
  const { error } = await db.from('app_settings').upsert({ workspace_id: ws, key: CLAVE_ORIGEN_CUENTA, value: JSON.stringify(origen) }, { onConflict: 'workspace_id,key' });
  if (error) throw new Error(`cuenta.origen de ${ws}: ${error.message}`);
}

/**
 * Para el alta: el origen EXPLÍCITO del cobro (`cobros.origen`, el link a /planes) si lo trae; si no, el que se
 * reconstruye del lead del comprador (primer toque). Lo guarda en la cuenta nueva. Sin ninguno de los dos, nada.
 * `cobros.origen` puede no existir todavía en la base (mig 0330 de otra rama): un error al leerlo se ignora.
 */
export async function guardarOrigenDeAlta(wsNuevo: number, leadId: number | null, cobroId?: number | null): Promise<OrigenCuenta | null> {
  let explicito: unknown = null;
  if (cobroId) {
    try {
      const { data, error } = await getSupabaseServer().from('cobros').select('origen').eq('id', cobroId).maybeSingle();
      if (!error) explicito = (data as { origen?: unknown } | null)?.origen ?? null;
    } catch { /* sin la columna: el primer toque */ }
  }
  const delLead = leadId ? await origenDeLeadMako(leadId) : null;
  const origen = origenDeCheckout(explicito, delLead ? { id: delLead.leadId, visitor_id: delLead.visitorId } : null, new Date().toISOString()) ?? delLead;
  if (origen) await guardarOrigenCuenta(wsNuevo, origen);
  return origen;
}

/**
 * Para el alta: el WhatsApp del comprador en su cuenta nueva (`CLAVE_WHATSAPP_DEL_PAGO`). No pisa uno que ya esté: un reintento del alta
 * no cambia lo que el onboarding ya le ofreció. Accesorio, como el origen.
 */
export async function guardarWhatsappDelPago(wsNuevo: number, leadId: number | null, cobroId: number): Promise<void> {
  const db = getSupabaseServer();
  const plataforma = await wsSuperAdmin();
  // `cobros.origen` puede no existir todavía (mig 0330): sin la columna, el de la ficha.
  const { data: cobro, error: eCobro } = await db.from('cobros').select('origen').eq('workspace_id', plataforma).eq('id', cobroId).maybeSingle();
  const { data: lead } = leadId ? await db.from('leads').select('telefono_normalizado').eq('workspace_id', plataforma).eq('id', leadId).maybeSingle() : { data: null };
  const numero = whatsappDelPago(eCobro ? null : (cobro as { origen?: unknown } | null)?.origen, (lead as { telefono_normalizado?: unknown } | null)?.telefono_normalizado);
  if (!numero) return;
  const { error } = await db.from('app_settings').upsert({ workspace_id: wsNuevo, key: CLAVE_WHATSAPP_DEL_PAGO, value: numero }, { onConflict: 'workspace_id,key', ignoreDuplicates: true });
  if (error) throw new Error(`${CLAVE_WHATSAPP_DEL_PAGO} de ${wsNuevo}: ${error.message}`);
}

/** El origen de la cuenta abierta (o de `ws`): lo lee el onboarding. null = no se sabe. */
export async function leerOrigenCuenta(ws?: number): Promise<OrigenCuenta | null> {
  const id = ws ?? (await getWorkspaceActual());
  if (!id) return null;
  const { data } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', id).eq('key', CLAVE_ORIGEN_CUENTA).maybeSingle();
  return leerOrigen((data as { value?: unknown } | null)?.value);
}
