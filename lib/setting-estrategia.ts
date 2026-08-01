// =============================================================================
// setting-estrategia — la JUGADA de una secuencia de nutrición (tab /setting)
// =============================================================================
// Vive en nutricion_secuencias.estrategia (jsonb, mig 0107). null = sin jugada.
// Parser TOLERANTE (patrón getSettingNum): basura → null, parciales → defaults.
// Sin 'server-only': lo importan los tests y los tipos del client.

export type Objetivo = 'agendar' | 'reactivar' | 'cualificar' | 'confirmar_pago';

/**
 * Cómo se opera la jugada cuando el lead RESPONDE (reunión 31/07):
 *  · 'asistido'   → el motor manda los primeros toques; al primer entrante frena,
 *                   avisa al dueño y deja un borrador redactado por MaKo para
 *                   aprobar con un clic. Es el arranque acordado ("aunque no esté
 *                   perfecto"), sin esperar al Setter IA.
 *  · 'automatico' → solo pausa la secuencia (comportamiento histórico); la
 *                   conversación la sigue un humano por su cuenta.
 */
export type ModoJugada = 'asistido' | 'automatico';

export type Estrategia = {
  objetivo: Objetivo;
  gancho: string | null;
  lead_magnet_id: string | null; // id del Entregable de la fábrica de creativos (lib/entregable.ts — ids string)
  preguntas: string[];           // cualificación — las hereda el Setter IA (fase 2)
  modo: ModoJugada;
  notas: string | null;
  probada_at: string | null;     // última prueba en vivo OK
};

export const OBJETIVOS: Array<{ value: Objetivo; label: string }> = [
  { value: 'agendar', label: 'Agendar una reunión' },
  { value: 'reactivar', label: 'Reactivar (con gancho / lead magnet)' },
  { value: 'cualificar', label: 'Cualificar con preguntas' },
  { value: 'confirmar_pago', label: 'Confirmar el pago' },
];

const OBJ_SET = new Set<string>(OBJETIVOS.map((o) => o.value));

export function parseEstrategia(raw: unknown): Estrategia | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.objetivo !== 'string' || !OBJ_SET.has(r.objetivo)) return null;
  return {
    objetivo: r.objetivo as Objetivo,
    gancho: typeof r.gancho === 'string' && r.gancho.trim() ? r.gancho.trim() : null,
    lead_magnet_id: (typeof r.lead_magnet_id === 'string' && r.lead_magnet_id.trim()) || (typeof r.lead_magnet_id === 'number' && Number.isFinite(r.lead_magnet_id))
      ? String(r.lead_magnet_id).trim()
      : null,
    preguntas: Array.isArray(r.preguntas)
      ? r.preguntas.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      : [],
    // Default 'asistido': lo acordado para arrancar es semi-automático.
    modo: r.modo === 'automatico' ? 'automatico' : 'asistido',
    notas: typeof r.notas === 'string' && r.notas.trim() ? r.notas.trim() : null,
    probada_at: typeof r.probada_at === 'string' ? r.probada_at : null,
  };
}
