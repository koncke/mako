// =============================================================================
// setting-estrategia — la JUGADA de una secuencia de nutrición (tab /setting)
// =============================================================================
// Vive en nutricion_secuencias.estrategia (jsonb, mig 0107). null = sin jugada.
// Parser TOLERANTE (patrón getSettingNum): basura → null, parciales → defaults.
// Sin 'server-only': lo importan los tests y los tipos del client.

// 'preparar' salió de la reunión del 31/07: es el objetivo que Mauricio declaró
// como EL más importante del setter ("número dos, preparar para la llamada"),
// por encima de cualificar. Sin él no era representable.
export type Objetivo = 'agendar' | 'preparar' | 'reactivar' | 'cualificar' | 'confirmar_pago';

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

/**
 * Reglas de decisión de la cualificación (reunión 31/07). Las `preguntas` dicen
 * QUÉ preguntar; esto dice QUÉ HACER con la respuesta — sin esto, "cancelamos
 * las llamadas de los que no califican" no es ejecutable por nadie más que
 * Mauricio. MaKo lo propone leyendo los leads ya calificados del CRM.
 */
export type CriterioCalificacion = {
  califica: string[];      // señales de cliente ideal
  descalifica: string[];   // señales que cancelan la llamada
};

export type Estrategia = {
  objetivo: Objetivo;
  gancho: string | null;
  lead_magnet_id: string | null; // id del Entregable de la fábrica de creativos (lib/entregable.ts — ids string)
  preguntas: string[];           // cualificación — las hereda el Setter IA (fase 2)
  criterio: CriterioCalificacion;
  modo: ModoJugada;
  notas: string | null;
  probada_at: string | null;     // última prueba en vivo OK
};

export const OBJETIVOS: Array<{ value: Objetivo; label: string }> = [
  { value: 'agendar', label: 'Agendar una reunión' },
  { value: 'preparar', label: 'Preparar para la llamada (que llegue y llegue listo)' },
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
    criterio: parseCriterio(r.criterio),
    // Default 'asistido': lo acordado para arrancar es semi-automático.
    modo: r.modo === 'automatico' ? 'automatico' : 'asistido',
    notas: typeof r.notas === 'string' && r.notas.trim() ? r.notas.trim() : null,
    probada_at: typeof r.probada_at === 'string' ? r.probada_at : null,
  };
}

const listaStrings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim()) : [];

/** Criterio tolerante: cualquier basura → listas vacías (jugada sin criterio aún). */
export function parseCriterio(raw: unknown): CriterioCalificacion {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { califica: [], descalifica: [] };
  const r = raw as Record<string, unknown>;
  return { califica: listaStrings(r.califica), descalifica: listaStrings(r.descalifica) };
}
