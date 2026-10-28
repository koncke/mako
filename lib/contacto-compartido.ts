// =============================================================================
// contacto-compartido — un contacto que se comparte en el grupo se busca POR TELÉFONO antes de proponer un lead (27/10/2026, P6)
// =============================================================================
// Leila compartió un contacto y terminó en un lead NUEVO en vez de encontrar el que ya tenía: `buscar_leads` compara el texto
// tal cual («+54 9 11 5555-5555» contra «5491155555555» no coincide). El código lo busca por el teléfono NORMALIZADO
// (`telefono_normalizado`, los últimos 10 dígitos, como el espejo de WhatsApp en lib/evolution-mensajes.ts) y le dice al
// modelo qué encontró, antes de que proponga nada.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { normalizarTelefono } from './leads';
import { bloqueDelContacto, type LeadDelTelefono } from './contacto-compartido-reglas';

/** Los leads cuyo teléfono normalizado termina como el del contacto (hasta 3). null = no se pudo leer. */
export async function leadsDelTelefono(telefono: string | null | undefined): Promise<LeadDelTelefono[] | null> {
  const norm = normalizarTelefono(telefono ?? null);
  if (!norm || norm.length < 8) return [];
  const { data, error } = await (await getTenantDb()).from('leads').select('id, nombre').like('telefono_normalizado', `%${norm.slice(-10)}`)
    .order('id', { ascending: false }).limit(3);
  return error ? null : ((data ?? []) as LeadDelTelefono[]);
}

/** El bloque del system para un mensaje con contactos compartidos (los primeros 3). */
export async function contextoDeContactos(contactos: ReadonlyArray<{ nombre: string; telefono?: string | null }>): Promise<string> {
  const filas = await Promise.all(contactos.slice(0, 3).map(async (c) => ({ contacto: c, leads: await leadsDelTelefono(c.telefono).catch(() => null) })));
  return bloqueDelContacto(filas);
}
