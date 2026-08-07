// =============================================================================
// Contactos del WhatsApp no oficial: nombre + foto de perfil, del evento
// contacts.upsert/update de Evolution. Evita pedir fetchProfilePictureUrl en vivo
// (que suele venir null para no-agendados) y da un nombre confiable del contacto.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { leerTodo } from '@/lib/supabase-paginado';
import { jidToNumero } from '@/lib/evolution';
import { normalizarTelefono } from '@/lib/leads';

const digs = (s: string | null) => (s || '').replace(/\D/g, '');

// Upsert desde contacts.upsert. Solo pisamos con valores no vacíos (el evento a
// veces trae solo el nombre o solo la foto).
export async function upsertContacto(remoteJid: string, nombre: string | null, fotoUrl: string | null): Promise<void> {
  // @lid es un alias interno de Meta para contactos no agendados (Android), NO
  // un número: jidToNumero() le pela el "@lid" igual que a cualquier otro jid, y
  // ese ID de 15 dígitos quedaba guardado como si fuera el teléfono — así
  // aparecían "contactos" con un número que no existe y que ninguna búsqueda por
  // teléfono real iba a encontrar nunca. Sin numero real, no hay fila que guardar.
  if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.startsWith('status@') || remoteJid.endsWith('@lid')) return;
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
    if (!c.remoteJid || c.remoteJid.endsWith('@g.us') || c.remoteJid.startsWith('status@') || c.remoteJid.endsWith('@lid')) continue;
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

/** La foto guardada de UN teléfono (últimos 10 dígitos). */
export async function getFotoContacto(telefono: string): Promise<string | null> {
  const k = digs(telefono).slice(-10);
  if (!k) return null;
  const supabase = await getTenantDb();
  const { data } = await supabase
    .from('evolution_contactos').select('telefono, foto_url')
    .not('foto_url', 'is', null)
    .like('telefono', `%${k}`)
    .limit(1);
  const fila = ((data ?? []) as Array<{ foto_url: string | null }>)[0];
  return fila?.foto_url ?? null;
}

/** Teléfonos (últimos 10) que TIENEN foto de perfil guardada. */
export async function getFotosContacto(): Promise<Set<string>> {
  const out = new Set<string>();
  const filas = await leerTodo<{ telefono: string; foto_url: string | null }>(
    await getTenantDb(), 'evolution_contactos', 'telefono, foto_url',
    { filtros: (q) => q.not('foto_url', 'is', null) },
  );
  for (const r of filas) { const k = digs(r.telefono).slice(-10); if (k) out.add(k); }
  return out;
}

// Nombres de contacto por últimos-10 dígitos (para enriquecer la lista).
export async function getNombresContacto(): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  // Paginado: sin él PostgREST devuelve como mucho 1000 filas, y una agenda de
  // WhatsApp pasa las 2000 fácil. El síntoma era mudo — la mitad de los
  // contactos aparecía con el número crudo, como si no tuvieran nombre.
  //
  // El bucle que había acá paginaba SIN ORDER BY, que es la otra mitad del bug y
  // no la arreglaba: con dos requests sin orden garantizado, la página 2 podía
  // repetir contactos de la 1 y saltearse otros — los salteados volvían a
  // aparecer con el número crudo, exactamente el síntoma que se creía resuelto.
  // El helper ordena por `id` (PK de evolution_contactos) en todas las páginas.
  const filas = await leerTodo<{ telefono: string; nombre: string | null }>(
    await getTenantDb(), 'evolution_contactos', 'telefono, nombre',
    { filtros: (q) => q.not('nombre', 'is', null) },
  );
  for (const r of filas) {
    const k = digs(r.telefono).slice(-10);
    if (k && r.nombre && !m.has(k)) m.set(k, r.nombre);
  }
  return m;
}
