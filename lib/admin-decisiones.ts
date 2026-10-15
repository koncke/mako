// =============================================================================
// El tablero de decisiones del super admin — lectura y escritura de admin_decisiones
// =============================================================================
// La tabla es de la PLATAFORMA (mig 0277, sin workspace_id): sólo la toca el super admin,
// por eso va con el cliente de service role y no con getTenantDb (no está en
// TENANT_TABLES a propósito). El guard de quién puede llamar esto vive en quien lo llama:
// la página (getSesionAdmin) y la acción (app/admin/runway/acciones.ts).
//
// ⚠️ «No pude leer» y «no hay nada» son dos respuestas (AGENTS.md): sin la tabla o con la
// base caída la pantalla lo DICE, no dibuja un tablero vacío que se lee «no hay decisiones».

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { filaADecision, motivoRespuestaInvalida, OTRA, RESUELTA, type LecturaDecisiones } from '@/app/admin/runway/decisiones';

const FALTA_TABLA = new Set(['42P01', 'PGRST205']);

export async function leerDecisiones(): Promise<LecturaDecisiones> {
  const { data, error } = await getSupabaseServer()
    .from('admin_decisiones')
    .select('*')
    .is('archivada_at', null)
    .order('id', { ascending: true })
    .limit(500);
  if (error) return { ok: false, faltaTabla: FALTA_TABLA.has(String(error.code)), error: error.message };
  return { ok: true, decisiones: (data ?? []).map((f) => filaADecision(f as Record<string, unknown>)) };
}

/**
 * Guarda la respuesta de Martín. Relee la decisión antes de validar: la clave tiene que
 * ser una de SUS opciones (o «otra» con texto), nunca lo que diga el formulario.
 * Cambiar una respuesta la vuelve «nueva» para el chat (`recogida_at` a null).
 */
export async function guardarRespuesta(id: number, clave: string, texto: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Decisión inválida' };
  const db = getSupabaseServer();
  const { data, error } = await db.from('admin_decisiones').select('*').eq('id', id).maybeSingle();
  if (error) return { ok: false, error: 'No se pudo leer. Prueba de nuevo.' };
  if (!data || data.archivada_at) return { ok: false, error: 'Ya no está en el tablero' };
  const d = filaADecision(data as Record<string, unknown>);
  // Sin opciones, la única respuesta es la de texto (o «Resuelta», que no elige nada).
  const claveFinal = clave === RESUELTA ? RESUELTA : d.opciones.length === 0 ? OTRA : clave;
  const motivo = motivoRespuestaInvalida(d, claveFinal, texto);
  if (motivo) return { ok: false, error: motivo };
  const { error: e2 } = await db
    .from('admin_decisiones')
    .update({
      respuesta: claveFinal,
      respuesta_texto: texto.trim() || null,
      respondida_at: new Date().toISOString(),
      recogida_at: null,
    })
    .eq('id', id);
  if (e2) return { ok: false, error: 'No se pudo guardar. Prueba de nuevo.' };
  return { ok: true };
}
