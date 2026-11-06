// =============================================================================
// plantillas-propias — QUIÉN comparte: lo que identifica a un negocio, para sacarlo de lo que comparte (6/11/2026)
// =============================================================================
// Lo puro (qué se reemplaza y la red), en ./plantillas-propias-reglas.ts. Acá se lee de la base lo que identifica al
// negocio: el nombre de su workspace y los nombres de su gente (usuarios). Lo demás (emails, teléfonos, links, @,
// precios) se reconoce por su forma, sin leer nada.
// ⚠️ La lectura es ESTRICTA: «no pude leer los nombres» no puede ser «no hay nombres» (AGENTS.md, una lectura que cae al
// default sirve para dibujar, nunca para decidir), porque con la lista vacía el nombre del negocio saldría a todos.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getWorkspace } from './workspace';
import type { NegocioQueComparte } from './plantillas-propias-reglas';

export async function negocioQueComparte(ws: number): Promise<NegocioQueComparte> {
  const [w, gente] = await Promise.all([
    getWorkspace(ws),
    getSupabaseServer().from('usuarios').select('nombre').eq('workspace_id', ws).limit(200),
  ]);
  if (!w) throw new Error('No pude leer el negocio que comparte.');
  if (gente.error) throw new Error(`No pude leer el equipo del negocio: ${gente.error.message}`);
  const nombres = [w.nombre].filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  const personas = ((gente.data ?? []) as Array<{ nombre: string | null }>)
    .map((u) => (u.nombre ?? '').trim()).filter(Boolean);
  return { nombres, personas };
}
