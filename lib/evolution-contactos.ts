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

/**
 * La agenda entera en UN upsert. Uno por contacto era una request por fila: con
 * una libreta de 500 la sincronización se iba a varios minutos.
 */
export async function upsertContactosLote(
  contactos: Array<{ remoteJid: string; nombre: string | null; fotoUrl: string | null }>,
): Promise<number> {
  const ahora = new Date().toISOString();
  const porTel = new Map<string, Record<string, unknown>>();
  for (const c of contactos) {
    if (!c.remoteJid || c.remoteJid.endsWith('@g.us') || c.remoteJid.startsWith('status@')) continue;
    const tel = digs(normalizarTelefono(jidToNumero(c.remoteJid)) || jidToNumero(c.remoteJid));
    if (!tel) continue;
    const nom = c.nombre && c.nombre !== 'Você' ? c.nombre : null;
    if (!nom && !c.fotoUrl) continue;
    // Una fila por teléfono: el upsert falla si el lote trae la misma clave dos veces.
    const prev = porTel.get(tel) ?? { telefono: tel, updated_at: ahora };
    if (nom) prev.nombre = nom;
    if (c.fotoUrl) prev.foto_url = c.fotoUrl;
    porTel.set(tel, prev);
  }
  const filas = [...porTel.values()];
  if (!filas.length) return 0;
  const supabase = await getTenantDb();
  for (let i = 0; i < filas.length; i += 500) {
    await supabase.from('evolution_contactos').upsert(filas.slice(i, i + 500), { onConflict: 'workspace_id,telefono' });
  }
  return filas.length;
}

// Nombres de contacto por últimos-10 dígitos (para enriquecer la lista).
export async function getNombresContacto(): Promise<Map<string, string>> {
  const supabase = await getTenantDb();
  const m = new Map<string, string>();
  // Paginado a mano: sin `range` PostgREST devuelve como mucho 1000 filas, y una
  // agenda de WhatsApp pasa las 2000 fácil. El síntoma era mudo — la mitad de
  // los contactos aparecía con el número crudo, como si no tuvieran nombre.
  for (let desde = 0; desde < 20000; desde += 1000) {
    const { data } = await supabase
      .from('evolution_contactos').select('telefono, nombre')
      .not('nombre', 'is', null)
      .range(desde, desde + 999);
    const filas = (data ?? []) as Array<{ telefono: string; nombre: string | null }>;
    for (const r of filas) {
      const k = digs(r.telefono).slice(-10);
      if (k && r.nombre && !m.has(k)) m.set(k, r.nombre);
    }
    if (filas.length < 1000) break;
  }
  return m;
}
