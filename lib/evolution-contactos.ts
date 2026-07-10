// =============================================================================
// Contactos del WhatsApp no oficial: nombre + foto de perfil, del evento
// contacts.upsert/update de Evolution. Evita pedir fetchProfilePictureUrl en vivo
// (que suele venir null para no-agendados) y da un nombre confiable del contacto.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { jidToNumero } from '@/lib/evolution';
import { normalizarTelefono } from '@/lib/leads';

const digs = (s: string | null) => (s || '').replace(/\D/g, '');

// Upsert desde contacts.upsert. Solo pisamos con valores no vacíos (el evento a
// veces trae solo el nombre o solo la foto).
export async function upsertContacto(remoteJid: string, nombre: string | null, fotoUrl: string | null): Promise<void> {
  if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.startsWith('status@')) return;
  const tel = digs(normalizarTelefono(jidToNumero(remoteJid)) || jidToNumero(remoteJid));
  if (!tel) return;
  const nom = nombre && nombre !== 'Você' ? nombre : null;
  if (!nom && !fotoUrl) return;
  const supabase = await getTenantDb();
  const patch: Record<string, unknown> = { telefono: tel, updated_at: new Date().toISOString() };
  if (nom) patch.nombre = nom;
  if (fotoUrl) patch.foto_url = fotoUrl;
  await supabase.from('evolution_contactos').upsert(patch, { onConflict: 'workspace_id,telefono' });
}

// Nombres de contacto por últimos-10 dígitos (para enriquecer la lista).
export async function getNombresContacto(): Promise<Map<string, string>> {
  const supabase = await getTenantDb();
  const { data } = await supabase.from('evolution_contactos').select('telefono, nombre').not('nombre', 'is', null);
  const m = new Map<string, string>();
  for (const r of (data ?? []) as Array<{ telefono: string; nombre: string | null }>) {
    const k = digs(r.telefono).slice(-10);
    if (k && r.nombre && !m.has(k)) m.set(k, r.nombre);
  }
  return m;
}
