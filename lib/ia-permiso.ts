// =============================================================================
// ia-permiso — sin el permiso de la persona, la app de iPhone no le manda nada a una IA (Apple 5.1.2(i), 3/11/2026)
// =============================================================================
// `exigirPermisoIa` va en las PUERTAS de la capa de IA, no en cada pantalla: una pantalla nueva lo hereda sin acordarse. Las puertas
// las enumera tests/ia-permiso.test.ts, y falla si una deja de llamarla:
//   · lib/anthropic.ts (chatClaude, chatClaudeTools);
//   · lib/ai-cheap.ts (la cascada, las herramientas, leer documentos y escuchar audio);
//   · lib/embeddings.ts (ahí vale como «sin con qué»: se busca por palabras);
//   · lib/elevenlabs.ts, en lo que le manda voz o texto, y NO en la clave: quien retiró el permiso tiene que poder borrar su voz clonada;
//   · lib/mako-turno-app.ts: el turno puede salir por la PC del cliente, que no pasa por ninguna de las de arriba.
//
// Sin pedido en curso (`headers()` tira: un cron, un webhook, un script) no hay persona que pueda dar permiso: sigue. Con pedido y sin
// la marca de la app, también. Con la marca, y sin poder confirmar el permiso (sin sesión, la base caída), NO SIGUE: ahí un
// «no sé» no puede ser un sí.
//
// ⚠️ UNA LECTURA POR PEDIDO: el turno pasa por varias puertas. La memoria se ata al objeto de los headers de ese pedido.
// =============================================================================

import { esAppIos } from './tienda';
import { CLAVE_PERMISO_IA, SinPermisoIa, VERSION_PERMISO_IA, faltaPreguntarIa, leerPermisoIa, tienePermisoIa, type DecisionIa } from './ia-permiso-reglas';

const memoria = new WeakMap<object, Promise<boolean>>();

async function perfilDeLaSesion(): Promise<{ id: number; perfil: Record<string, unknown> } | null> {
  const [{ getUsuarioActual }, { getSupabaseServer }] = await Promise.all([import('./auth'), import('./supabase')]);
  const s = await getUsuarioActual();
  if (!s || !/^\d+$/.test(String(s.sub))) return null;
  const { data, error } = await getSupabaseServer().from('usuarios').select('id, perfil').eq('id', Number(s.sub)).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const f = data as { id: number; perfil: unknown };
  return { id: f.id, perfil: (f.perfil && typeof f.perfil === 'object' ? f.perfil : {}) as Record<string, unknown> };
}

/** Tira `SinPermisoIa` si este pedido viene de la app de iPhone y su persona no dio permiso. Nunca toca la red si no. */
export async function exigirPermisoIa(): Promise<void> {
  let pedido: { get(nombre: string): string | null };
  try {
    const { headers } = await import('next/headers');
    pedido = await headers();
  } catch {
    return; // Sin pedido: un cron, un webhook, un script. Ver la cabecera.
  }
  if (!esAppIos(pedido.get('user-agent'))) return;
  let leido = memoria.get(pedido);
  if (!leido) {
    leido = perfilDeLaSesion().then((f) => !!f && tienePermisoIa(f.perfil), () => false);
    memoria.set(pedido, leido);
  }
  if (!(await leido)) throw new SinPermisoIa();
}

/** Lo que pregunta la hoja de la app. Con `null`, esta sesión no tiene a quién preguntarle. */
export async function estadoPermisoIa(): Promise<{ preguntar: boolean; permitido: boolean } | null> {
  const f = await perfilDeLaSesion();
  return f ? { preguntar: faltaPreguntarIa(f.perfil), permitido: tienePermisoIa(f.perfil) } : null;
}

/** Guarda la decisión de la persona, en SU fila. Se relee y se mezcla: en `perfil` viven otras cosas (lib/perfil.ts, setPerfil). */
export async function guardarPermisoIa(decision: DecisionIa): Promise<boolean> {
  const f = await perfilDeLaSesion();
  if (!f) return false;
  const { getSupabaseServer } = await import('./supabase');
  const perfil = { ...f.perfil, [CLAVE_PERMISO_IA]: { decision, at: new Date().toISOString(), version: VERSION_PERMISO_IA } };
  const { error } = await getSupabaseServer().from('usuarios').update({ perfil, updated_at: new Date().toISOString() }).eq('id', f.id);
  if (error) throw new Error(error.message);
  return leerPermisoIa(perfil)?.decision === decision;
}
