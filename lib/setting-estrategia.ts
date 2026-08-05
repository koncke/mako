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
  /**
   * La CLAVE de la secuencia que arranca cuando se logra el objetivo.
   *
   * Es lo que convierte una secuencia suelta en una cadena: «Reactivación»
   * solo busca que el lead conteste algo, y en cuanto contesta el trabajo que
   * sigue es otro («Cualificación»). Antes esto se intentaba por ETAPA, que es
   * indirecto: si dos secuencias cubrían la etapa, o ninguna, el lead quedaba
   * en el limbo sin que nadie avisara.
   */
  logradoSecuencia: string | null;
  /**
   * HORAS sin respuesta tras el último paso para darla por fallida. 0 = nunca.
   *
   * Estaba en DÍAS y no alcanzaba: no es lo mismo no contestar en 10 minutos
   * que en 24 horas, y «confirmá la reunión de mañana» y «reactivación de un
   * lead de hace tres meses» no pueden compartir umbral. Lo viejo se convierte
   * solo (días × 24) al leerlo, así que ninguna secuencia guardada se rompe.
   */
  falloHoras: number;
  /** A qué etapa se mueve el lead si falló. null = se queda donde está. */
  falloEtapa: string | null;
  /** La CLAVE de la secuencia que arranca cuando se da por fallida. */
  falloSecuencia: string | null;
};

export const DESENLACE_VACIO: Desenlace = {
  logrado: 'respondio', logradoEtapa: null, logradoSecuencia: null,
  falloHoras: 0, falloEtapa: null, falloSecuencia: null,
};

/**
 * Cuántas horas de silencio dan por fallida una secuencia, según su objetivo.
 * Son el DEFAULT al crearla: el dueño lo ajusta solo si quiere. Salen de la
 * urgencia real de cada trabajo — a quien tiene una reunión mañana se le
 * pregunta de nuevo al otro día; a un lead frío de hace meses, no.
 */
export const HORAS_SIN_RESPUESTA: Record<Objetivo, number> = {
  agendar: 24,
  preparar: 12,
  reactivar: 72,
  cualificar: 24,
  confirmar_pago: 12,
};

/** El default de horas para un objetivo, incluidos los que escribió el dueño. */
export const horasSinRespuestaDe = (objetivo: string): number =>
  HORAS_SIN_RESPUESTA[objetivo as Objetivo] ?? 24;

/**
 * Un caso previsto: qué puede contestar el lead y cómo se le responde.
 *
 * Es lo que hace posible el hand-off. Si el mensaje del lead encaja en un
 * escenario, MaKo sabe qué hacer. Si NO encaja en ninguno, es justamente la
 * señal de que no debería improvisar: se calla, avisa, y el dueño enseña el
 * caso nuevo. El sistema aprende agregando escenarios, no inventando.
 */
export type EscenarioSecuencia = {
  /** Cómo se llama el caso: "Pregunta el precio", "Dice que ahora no puede". */
  titulo: string;
  /** Cuándo aplica, en las palabras del negocio. Es lo que lee el clasificador. */
  cuando: string;
  /** Qué contestar. Es la guía del borrador, no el texto literal. */
  comoResponder: string;
};

const escenariosDe = (raw: unknown): EscenarioSecuencia[] => {
  if (!Array.isArray(raw)) return [];
  const out: EscenarioSecuencia[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const titulo = typeof o.titulo === 'string' ? o.titulo.trim() : '';
    const cuando = typeof o.cuando === 'string' ? o.cuando.trim() : '';
    const comoResponder = typeof o.comoResponder === 'string' ? o.comoResponder.trim() : '';
    if (titulo && cuando) out.push({ titulo, cuando, comoResponder });
  }
  return out.slice(0, 30);
};

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
  /** Los casos previstos. Un mensaje que no encaja en ninguno dispara el hand-off. */
  escenarios: EscenarioSecuencia[];
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
  // Compatibilidad con lo guardado antes de pasar a horas: si viene el campo
  // viejo en días y no el nuevo, se convierte. Sin esto, cada secuencia ya
  // configurada volvería a "nunca falla" en silencio.
  const horas = Number(r.falloHoras);
  const dias = Number(r.falloDias);
  const horasFinal = Number.isFinite(horas) && horas > 0
    ? horas
    : (Number.isFinite(dias) && dias > 0 ? dias * 24 : 0);
  const clave = (x: unknown): string | null =>
    typeof x === 'string' && x.trim() ? x.trim().slice(0, 120) : null;
  return {
    logrado: typeof r.logrado === 'string' && LOGRADO_SET.has(r.logrado) ? (r.logrado as Desenlace['logrado']) : 'respondio',
    logradoEtapa: clave(r.logradoEtapa),
    logradoSecuencia: clave(r.logradoSecuencia),
    // Tope de un año, igual que antes, pero contado en horas.
    falloHoras: horasFinal > 0 ? Math.min(Math.round(horasFinal), 365 * 24) : 0,
    falloEtapa: clave(r.falloEtapa),
    falloSecuencia: clave(r.falloSecuencia),
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
    escenarios: escenariosDe(r.escenarios),
    desenlace: parseDesenlace(r.desenlace),
    // Default 'asistido': lo acordado para arrancar es semi-automático.
    modo: r.modo === 'automatico' ? 'automatico' : 'asistido',
    notas: typeof r.notas === 'string' && r.notas.trim() ? r.notas.trim() : null,
    probada_at: typeof r.probada_at === 'string' ? r.probada_at : null,
  };
}

/**
 * ¿El lead YA tiene hecho el trabajo que busca esta secuencia?
 *
 * Es lo que evita el error caro de encadenar: si la reactivación despierta a
 * alguien que hace tres meses YA se cualificó, mandarlo de nuevo a Cualificación
 * es hacerle repetir preguntas que ya contestó — y el lead lo lee como que nadie
 * le prestó atención.
 *
 * El hito se DERIVA del CRM y no se guarda aparte a propósito: `leads` ya es la
 * fuente de verdad y un status paralelo se despega en cuanto alguien edita la
 * ficha a mano.
 *
 * `null` = no se puede saber (el objetivo no tiene un dato que lo represente).
 * Ante la duda NO se saltea: es peor perderse una secuencia que repetirla.
 */
export function hitoYaHecho(objetivo: string, lead: Record<string, unknown>): boolean | null {
  switch (objetivo) {
    case 'cualificar':
      // `calificado` es booleano en el CRM: true o false son los DOS un hito
      // hecho — «descalificado» también es una respuesta, y volver a
      // cualificarlo sería no haber escuchado.
      return typeof lead.calificado === 'boolean' ? true : false;
    case 'agendar':
      return Boolean(lead.fecha_junta_1 || lead.junta_1_at || lead.fecha_agenda);
    case 'confirmar_pago':
      return Boolean(lead.fecha_primer_pago) || lead.cerro === true;
    default:
      // reactivar, preparar y los objetivos que escribió el dueño no tienen
      // un dato del CRM que diga "esto ya se hizo".
      return null;
  }
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
