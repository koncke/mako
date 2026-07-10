// =============================================================================
// Bloqueo de contactos del WhatsApp no oficial (F4) — a nivel app/CRM.
// Evolution v2.3.7 no expone endpoint de bloqueo, así que bloqueamos por teléfono
// en wa_bloqueados: el motor de nutrición NO le manda y el inbox lo muestra.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';

const norm = (t: string) => (t || '').replace(/\D/g, '');

export async function bloquearContacto(telefono: string, opts: { leadId?: number | null; motivo?: string; por?: string } = {}): Promise<void> {
  const tel = norm(telefono);
  if (!tel) return;
  const supabase = await getTenantDb();
  await supabase.from('wa_bloqueados').upsert(
    { telefono: tel, lead_id: opts.leadId ?? null, motivo: opts.motivo ?? null, created_by: opts.por ?? null },
    { onConflict: 'workspace_id,telefono', ignoreDuplicates: true },
  );
}

export async function desbloquearContacto(telefono: string): Promise<void> {
  const tel = norm(telefono);
  if (!tel) return;
  await (await getTenantDb()).from('wa_bloqueados').delete().eq('telefono', tel);
}

export async function estaBloqueado(telefono: string): Promise<boolean> {
  const tel = norm(telefono);
  if (!tel) return false;
  const { count } = await (await getTenantDb()).from('wa_bloqueados').select('id', { count: 'exact', head: true }).eq('telefono', tel);
  return (count ?? 0) > 0;
}

// Set de teléfonos bloqueados del workspace (para marcar la lista de una).
export async function telefonosBloqueados(): Promise<Set<string>> {
  const { data } = await (await getTenantDb()).from('wa_bloqueados').select('telefono');
  return new Set(((data ?? []) as Array<{ telefono: string }>).map((r) => r.telefono));
}
