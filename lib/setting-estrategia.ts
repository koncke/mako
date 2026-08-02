// =============================================================================
// setting-estrategia — la ESTRATEGIA de una secuencia de nutrición (tab /setting)
// =============================================================================
// Vive en nutricion_secuencias.estrategia (jsonb, mig 0107). null = sin secuencia.
// Parser TOLERANTE (patrón getSettingNum): basura → null, parciales → defaults.
// Sin 'server-only': lo importan los tests y los tipos del client.

// 'preparar' salió de la reunión del 31/07: es el objetivo que Mauricio declaró
// como EL más importante del setter ("número dos, preparar para la llamada"),
// por encima de cualificar. Sin él no era representable.
export type Objetivo = 'agendar' | 'preparar' | 'reactivar' | 'cualificar' | 'confirmar_pago';

/**
 * Cómo se opera la secuencia de mensajes cuando el lead RESPONDE (reunión 31/07):
 *  · 'asistido'   → el motor manda los primeros toques; al primer entrante frena,
 *                   avisa al dueño y deja un borrador redactado por MaKo para
 *                   aprobar con un clic. Es el arranque acordado ("aunque no esté
 *                   perfecto"), sin esperar al Setter IA.
 *  · 'automatico' → solo pausa la secuencia (comportamiento histórico); la
 *                   conversación la sigue un humano por su cuenta.
 */
export type ModoRespuesta = 'asistido' | 'automatico';

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

/**
 * Cuándo TERMINA la secuencia, y con qué resultado.
 *
 * Sin esto una secuencia no sabía parar: seguía mandando pasos hasta quedarse
 * sin pasos. Y "reactivación" y "seguimiento" son trabajos distintos que
 * empiezan donde termina el anterior — sin un desenlace no hay forma de
 * encadenarlos, ni de saber si una secuencia sirve para algo.
 *
 * `logrado` es lo que la secuencia buscaba; `fallo` es haberlo intentado sin
 * conseguirlo. Los dos CIERRAN la inscripción: la diferencia es a dónde va el
 * lead después.
 */
export type Desenlace = {
  /** Qué cuenta como objetivo cumplido. */
  logrado: 'respondio' | 'agendo' | 'pago' | 'ninguno';
  /** A qué etapa se mueve el lead si se logró. null = se queda donde está. */
  logradoEtapa: string | null;
  /** Días sin novedades tras el último paso para darla por fallida. 0 = nunca. */
  falloDias: number;
  /** A qué etapa se mueve el lead si falló. null = se queda donde está. */
  falloEtapa: string | null;
};

export const DESENLACE_VACIO: Desenlace = { logrado: 'respondio', logradoEtapa: null, falloDias: 0, falloEtapa: null };

const LOGRADO_SET = new Set<string>(['respondio', 'agendo', 'pago', 'ninguno']);

export type Estrategia = {
  /**
   * String y no solo el union: el dueño puede escribir el suyo con la opción
   * "Otro" cuando ninguno de los cinco describe lo que busca. Los del catálogo
   * siguen teniendo significado para el motor; uno custom es descriptivo y lo
   * usa MaKo al redactar.
   */
  objetivo: Objetivo | string;
  gancho: string | null;
  lead_magnet_id: string | null; // id del Entregable de la fábrica de creativos (lib/entregable.ts — ids string)
  /** false → la secuencia no manda ningún lead magnet y sus pasos no se preguntan. */
  usa_lead_magnet: boolean;
  preguntas: string[];           // cualificación — las hereda el Setter IA (fase 2)
  criterio: CriterioCalificacion;
  desenlace: Desenlace;
  modo: ModoRespuesta;
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

/** Desenlace tolerante: basura → el vacío (la secuencia no cierra sola). */
export function parseDesenlace(raw: unknown): Desenlace {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DESENLACE_VACIO };
  const r = raw as Record<string, unknown>;
  const dias = Number(r.falloDias);
  return {
    logrado: typeof r.logrado === 'string' && LOGRADO_SET.has(r.logrado) ? (r.logrado as Desenlace['logrado']) : 'respondio',
    logradoEtapa: typeof r.logradoEtapa === 'string' && r.logradoEtapa.trim() ? r.logradoEtapa.trim() : null,
    falloDias: Number.isFinite(dias) && dias > 0 ? Math.min(Math.round(dias), 365) : 0,
    falloEtapa: typeof r.falloEtapa === 'string' && r.falloEtapa.trim() ? r.falloEtapa.trim() : null,
  };
}

export function parseEstrategia(raw: unknown): Estrategia | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  // El objetivo puede ser uno del catálogo O uno que el dueño escribió con
  // "Otro". Antes CUALQUIER valor fuera del catálogo devolvía null y se perdía
  // la estrategia entera, así que un objetivo propio era irrepresentable.
  if (typeof r.objetivo !== 'string' || !r.objetivo.trim()) return null;
  const objetivo = r.objetivo.trim().slice(0, 120);
  return {
    objetivo: OBJ_SET.has(objetivo) ? (objetivo as Objetivo) : objetivo,
    gancho: typeof r.gancho === 'string' && r.gancho.trim() ? r.gancho.trim() : null,
    lead_magnet_id: (typeof r.lead_magnet_id === 'string' && r.lead_magnet_id.trim()) || (typeof r.lead_magnet_id === 'number' && Number.isFinite(r.lead_magnet_id))
      ? String(r.lead_magnet_id).trim()
      : null,
    // Default true solo si hay uno elegido: una secuencia vieja sin el campo no
    // pasa a "usa lead magnet" por omisión.
    usa_lead_magnet: typeof r.usa_lead_magnet === 'boolean' ? r.usa_lead_magnet : Boolean(r.lead_magnet_id),
    preguntas: Array.isArray(r.preguntas)
      ? r.preguntas.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      : [],
    criterio: parseCriterio(r.criterio),
    desenlace: parseDesenlace(r.desenlace),
    // Default 'asistido': lo acordado para arrancar es semi-automático.
    modo: r.modo === 'automatico' ? 'automatico' : 'asistido',
    notas: typeof r.notas === 'string' && r.notas.trim() ? r.notas.trim() : null,
    probada_at: typeof r.probada_at === 'string' ? r.probada_at : null,
  };
}

/** Etiqueta legible de un objetivo, sea del catálogo o escrito por el dueño. */
export const labelObjetivo = (o: string): string => OBJETIVOS.find((x) => x.value === o)?.label ?? o;

const listaStrings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim()) : [];

/** Criterio tolerante: cualquier basura → listas vacías (secuencia sin criterio aún). */
export function parseCriterio(raw: unknown): CriterioCalificacion {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { califica: [], descalifica: [] };
  const r = raw as Record<string, unknown>;
  return { califica: listaStrings(r.califica), descalifica: listaStrings(r.descalifica) };
}
