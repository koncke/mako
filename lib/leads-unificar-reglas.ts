// =============================================================================
// leads-unificar-reglas — unir dos fichas del MISMO negocio que son la misma persona: lo puro (23/10/2026)
// =============================================================================
// Martín (23/10/2026): «En el CRM si me dice "Hay otra ficha parecida", que me de la opción ahí mismo de unificarlas».
// Hasta hoy no existía: `createLead` fusiona un contacto que ENTRA con un lead que ya está (lib/leads.ts, `avisarFusion`),
// pero dos fichas que ya existen no se podían unir (docs/diseno-ficha-bloques.md, `posibles-duplicados`).
// La escritura vive en lib/leads-unificar.ts (server-only); acá lo que se decide con lo leído, ejecutado por
// tests/ficha-unificar.test.ts.
//
// LAS REGLAS (la referencia es «Merge» de HubSpot: un registro principal, y de cada propiedad queda la del principal
// salvo que esté vacía):
//   1. QUÉ FICHA QUEDA: la que elige la persona. De entrada, la que tiene la venta (ganado, monto o cobros), y si ninguna
//      o las dos, la más VIEJA: es la que las respuestas de WhatsApp ya encuentran (`matchLeadPorTelefono` ordena por id),
//      y la que tiene la historia más larga.
//   2. LOS DATOS: de cada campo queda el de la que queda; si está vacío, lo trae de la otra. Nunca se pisa un valor.
//   3. LOS CRM: la que queda conserva su casa; la casa de la otra pasa a ser un CRM donde está agregada, con la etapa que
//      tenía ahí (`lead_funnel`). Si las dos están en el mismo CRM, queda la etapa que va MÁS ADELANTE en ese embudo.
//   4. LO QUE CUELGA DE LA OTRA se muda a la que queda (mensajes, historial, notas, automatizaciones, pagos, etiquetas…).
//      Donde las dos tienen lo mismo y sólo puede haber uno (una automatización, una etiqueta, un CRM), queda uno.
// =============================================================================

/** Lo que hace falta de una ficha para decidir. */
export type FichaParaUnificar = {
  id: number; nombre: string | null; created_at: string | null;
  estado_lead?: string | null; monto_cierre_usd?: number | null; cobros?: number;
  [campo: string]: unknown;
};

/** Los campos que se completan de la otra si la que queda los tiene vacíos (regla 2), con su nombre para la previa. */
export const CAMPOS_QUE_SE_COMPLETAN: ReadonlyArray<{ campo: string; nombre: string }> = [
  { campo: 'nombre', nombre: 'Nombre' }, { campo: 'email', nombre: 'Email' }, { campo: 'telefono', nombre: 'Teléfono' },
  { campo: 'empresa', nombre: 'Empresa' }, { campo: 'instagram', nombre: 'Instagram' }, { campo: 'web', nombre: 'Web' },
  { campo: 'linkedin', nombre: 'LinkedIn' }, { campo: 'youtube', nombre: 'YouTube' }, { campo: 'direccion', nombre: 'Dirección' },
  { campo: 'sexo', nombre: 'Sexo' }, { campo: 'setter', nombre: 'Setter' }, { campo: 'closer', nombre: 'Closer' },
  { campo: 'ingreso_estimado', nombre: 'Ingreso estimado' }, { campo: 'calificado', nombre: 'Calificado' },
  { campo: 'origen_lead', nombre: 'Origen' }, { campo: 'visitor_id', nombre: 'Visitas a la página' },
  { campo: 'pagina_registro', nombre: 'Página de registro' },
];

const vacio = (v: unknown): boolean => v == null || (typeof v === 'string' && !v.trim());
const conVenta = (f: FichaParaUnificar): boolean => f.estado_lead === 'ganado' || (Number(f.monto_cierre_usd) > 0) || (f.cobros ?? 0) > 0;

/** Regla 1: cuál queda si la persona no eligió. */
export function cualQueda(a: FichaParaUnificar, b: FichaParaUnificar): { queda: FichaParaUnificar; seVa: FichaParaUnificar; porque: string } {
  if (conVenta(a) !== conVenta(b)) {
    const queda = conVenta(a) ? a : b;
    return { queda, seVa: queda === a ? b : a, porque: 'tiene la venta' };
  }
  const queda = a.id < b.id ? a : b;
  return { queda, seVa: queda === a ? b : a, porque: 'es la más vieja' };
}

/** Regla 2: los campos que la que queda trae de la otra (sólo donde está vacía), y los que conserva distintos. */
export function camposDeLaUnion(queda: FichaParaUnificar, seVa: FichaParaUnificar): {
  trae: Record<string, unknown>;
  lineas: Array<{ campo: string; nombre: string; valor: string; de: 'queda' | 'otra' }>;
} {
  const trae: Record<string, unknown> = {};
  const lineas: Array<{ campo: string; nombre: string; valor: string; de: 'queda' | 'otra' }> = [];
  for (const { campo, nombre } of CAMPOS_QUE_SE_COMPLETAN) {
    const q = queda[campo];
    const o = seVa[campo];
    if (vacio(q) && !vacio(o)) {
      trae[campo] = o;
      lineas.push({ campo, nombre, valor: mostrar(o), de: 'otra' });
    } else if (!vacio(q) && !vacio(o) && mostrar(q) !== mostrar(o)) {
      lineas.push({ campo, nombre, valor: mostrar(q), de: 'queda' });
    }
  }
  // El teléfono normalizado viaja con el teléfono (lo usa el que busca a quién es una respuesta de WhatsApp).
  if ('telefono' in trae && !vacio(seVa.telefono_normalizado)) trae.telefono_normalizado = seVa.telefono_normalizado;
  return { trae, lineas };
}

const mostrar = (v: unknown): string => (v === true ? 'Sí' : v === false ? 'No' : String(v ?? '').trim());

/** Un CRM donde está una de las dos, con su etapa (la key) y el orden de esa etapa en su embudo. */
export type EnCrm = { funnelId: number; crm: string; etapa: string | null; etapaNombre: string | null; orden: number; casa: boolean };

/**
 * Regla 3: en qué CRM queda la ficha unida y con qué etapa. La casa es la de la que queda; las demás, agregadas. En un CRM
 * donde están las dos, la etapa que va más adelante (`orden` mayor); empatadas, la de la que queda.
 */
export function crmsDeLaUnion(queda: readonly EnCrm[], seVa: readonly EnCrm[]): Array<EnCrm & { de: 'queda' | 'otra' | 'las dos' }> {
  const out = new Map<number, EnCrm & { de: 'queda' | 'otra' | 'las dos' }>();
  for (const c of queda) out.set(c.funnelId, { ...c, de: 'queda' });
  for (const c of seVa) {
    const ya = out.get(c.funnelId);
    if (!ya) { out.set(c.funnelId, { ...c, casa: false, de: 'otra' }); continue; }
    out.set(c.funnelId, c.orden > ya.orden ? { ...c, casa: ya.casa, de: 'las dos' } : { ...ya, de: 'las dos' });
  }
  return [...out.values()].sort((x, y) => Number(y.casa) - Number(x.casa));
}

/** Lo que se muda de la otra ficha: «3 mensajes de WhatsApp» (`uno`: «1 mensaje de WhatsApp»). Los que dan 0 no se dicen. */
export type LoQueSeMueve = { que: string; uno?: string; n: number };

/** La previa que ve la persona antes de confirmar. */
export type PreviaUnificar = {
  queda: { id: number; nombre: string; desde: string | null; porque: string };
  seVa: { id: number; nombre: string; desde: string | null };
  datos: Array<{ nombre: string; valor: string; de: 'queda' | 'otra' }>;
  crms: Array<{ crm: string; etapa: string | null; casa: boolean; de: 'queda' | 'otra' | 'las dos' }>;
  mueve: LoQueSeMueve[];
  /** Lo que choca y cómo se resuelve, dicho («Las dos están en «X»: queda la de «Martín», que va en el paso 2»). */
  choques: string[];
  /** `updated_at` de las dos al armar la previa: si alguna cambió, no se unifica (se vuelve a mirar). */
  version: { queda: string | null; seVa: string | null };
};

type Linea = { texto: string; tono?: 'otra' | 'choque' };

/** La previa en palabras: título, bajada, una sección por tema y el aviso de que no se deshace. */
export function textoDeLaPrevia(p: PreviaUnificar): { titulo: string; bajada: string; secciones: Array<{ titulo: string; lineas: Linea[] }>; aviso: string } {
  const secciones: Array<{ titulo: string; lineas: Linea[] }> = [];
  if (p.datos.length) {
    secciones.push({
      titulo: 'Los datos',
      lineas: p.datos.map((d) => ({ texto: `${d.nombre}: ${d.valor}${d.de === 'otra' ? ` (de «${p.seVa.nombre}»)` : ''}`, ...(d.de === 'otra' ? { tono: 'otra' as const } : {}) })),
    });
  }
  if (p.crms.length) {
    secciones.push({
      titulo: 'Dónde queda',
      lineas: p.crms.map((c) => ({ texto: `${c.crm}${c.etapa ? ` › ${c.etapa}` : ''}${c.casa ? ' (su CRM)' : ''}${c.de === 'otra' ? ` (de «${p.seVa.nombre}»)` : ''}` })),
    });
  }
  const mueve = p.mueve.filter((m) => m.n > 0);
  if (mueve.length) secciones.push({ titulo: `Lo que se trae de «${p.seVa.nombre}»`, lineas: mueve.map((m) => ({ texto: `${m.n} ${m.n === 1 && m.uno ? m.uno : m.que}` })) });
  if (p.choques.length) secciones.push({ titulo: 'Lo que las dos tenían', lineas: p.choques.map((c) => ({ texto: c, tono: 'choque' as const })) });
  return {
    titulo: `Queda «${p.queda.nombre}» (#${p.queda.id}) y se va «${p.seVa.nombre}» (#${p.seVa.id})`,
    bajada: `Queda ésa porque ${p.queda.porque}. De cada dato queda el suyo; lo que le falta lo trae de la otra.`,
    secciones,
    aviso: `No se deshace: «${p.seVa.nombre}» (#${p.seVa.id}) deja de existir y todo lo suyo pasa a «${p.queda.nombre}».`,
  };
}

// ── El PLAN: de lo leído (`LecturaUnificar`, lib/leads-unificar.ts) a la previa y a las operaciones ────────────────────
// Puro: lo ejecuta el test con lecturas de mentira y el script en seco con la de producción (sin escribir nada).
//
// ⚠️ EL INVENTARIO (23/10/2026, ~45 columnas que apuntan a un lead; docs/hallazgos-crm.md, «Unificar dos fichas»): lo
//    que no tiene índice único se MUDA de una (`TABLAS_QUE_SE_MUDAN`); lo que sí, se resuelve uno por uno abajo; y lo que
//    hace a una ficha CLIENTE (pagos, Customer Success, curso, comunidad) todavía no se une: el plan lo dice y no hace nada.

/** Las tablas que se mudan enteras (sin índice único con el lead): tabla, columna y cómo se dice en la previa. */
export const TABLAS_QUE_SE_MUDAN: ReadonlyArray<{ tabla: string; col: string; que: string; uno: string }> = [
  { tabla: 'lead_audit', col: 'lead_id', que: 'líneas del historial (con las notas)', uno: 'línea del historial (con las notas)' },
  { tabla: 'wa_mensajes', col: 'lead_id', que: 'mensajes de WhatsApp', uno: 'mensaje de WhatsApp' },
  { tabla: 'wa_borradores', col: 'lead_id', que: 'mensajes listos sin mandar', uno: 'mensaje listo sin mandar' },
  { tabla: 'nutricion_envios', col: 'lead_id', que: 'envíos de automatizaciones', uno: 'envío de automatizaciones' },
  { tabla: 'ig_conversaciones', col: 'lead_id', que: 'charlas de Instagram', uno: 'charla de Instagram' },
  { tabla: 'email_mensajes', col: 'lead_id', que: 'emails', uno: 'email' },
  { tabla: 'email_entrantes', col: 'lead_id', que: 'emails que llegaron', uno: 'email que llegó' },
  { tabla: 'email_broadcast_envios', col: 'lead_id', que: 'envíos de campañas de email', uno: 'envío de campañas de email' },
  { tabla: 'lead_respuestas', col: 'lead_id', que: 'respuestas de formularios y agenda', uno: 'respuesta de formularios y agenda' },
  { tabla: 'lead_insights', col: 'lead_id', que: 'análisis de llamadas', uno: 'análisis de llamada' },
  { tabla: 'closing_analyses', col: 'lead_id', que: 'grabaciones analizadas', uno: 'grabación analizada' },
  // Las grabadas desde MaKo (mig 0390): sin índice único con el lead, se mudan.
  { tabla: 'llamadas_grabadas', col: 'lead_id', que: 'llamadas grabadas en MaKo', uno: 'llamada grabada en MaKo' },
  { tabla: 'chat_agent_handoffs', col: 'lead_id', que: 'pases a una persona', uno: 'pase a una persona' },
  { tabla: 'insistencias', col: 'lead_id', que: 'insistencias', uno: 'insistencia' },
  { tabla: 'cobros', col: 'lead_id', que: 'cobros', uno: 'cobro' },
  { tabla: 'prospectos', col: 'lead_id', que: 'prospectos', uno: 'prospecto' },
  { tabla: 'wa_bloqueados', col: 'lead_id', que: 'bloqueos de WhatsApp', uno: 'bloqueo de WhatsApp' },
  { tabla: 'wa_ocultos', col: 'lead_id', que: 'charlas ocultas', uno: 'charla oculta' },
  { tabla: 'curso_sesiones', col: 'lead_id', que: 'sesiones del curso', uno: 'sesión del curso' },
  { tabla: 'experimento_tareas', col: 'cliente_lead_id', que: 'tareas de experimentos', uno: 'tarea de experimentos' },
  { tabla: 'plan_propuestas', col: 'cliente_lead_id', que: 'propuestas del Plan', uno: 'propuesta del Plan' },
  { tabla: 'plan_tareas', col: 'cliente_lead_id', que: 'tareas del Plan', uno: 'tarea del Plan' },
  { tabla: 'plan_proyectos', col: 'cliente_lead_id', que: 'proyectos del Plan', uno: 'proyecto del Plan' },
  { tabla: 'tarea_categorias', col: 'cliente_lead_id', que: 'categorías de tareas', uno: 'categoría de tareas' },
];

/** Lo que hace a una ficha CLIENTE: si la que se va tiene algo de esto, la v1 no une (lo dice y no hace nada). */
export const TABLAS_DE_CLIENTE: ReadonlyArray<{ tabla: string; col: string; que: string }> = [
  { tabla: 'pagos', col: 'lead_id', que: 'cuotas' },
  { tabla: 'cs_clientes', col: 'lead_id', que: 'Clients' },
  { tabla: 'cs_respuestas', col: 'lead_id', que: 'respuestas de Clients' },
  { tabla: 'cliente_entrega', col: 'lead_id', que: 'entregas del servicio' },
  { tabla: 'cliente_entrega_fuera', col: 'lead_id', que: 'entregas del servicio' },
  { tabla: 'curso_progreso', col: 'lead_id', que: 'avance en el curso' },
  { tabla: 'curso_accesos', col: 'lead_id', que: 'accesos al curso' },
  { tabla: 'curso_desbloqueos', col: 'lead_id', que: 'desbloqueos del curso' },
  { tabla: 'comunidad_posts', col: 'lead_id', que: 'posts en la comunidad' },
  { tabla: 'comunidad_comentarios', col: 'lead_id', que: 'comentarios en la comunidad' },
  { tabla: 'comunidad_likes', col: 'lead_id', que: 'me gusta en la comunidad' },
  { tabla: 'comunidad_votos', col: 'lead_id', que: 'votos en la comunidad' },
  { tabla: 'comunidad_perfiles', col: 'lead_id', que: 'perfil en la comunidad' },
  { tabla: 'comunidad_seguimientos', col: 'lead_id', que: 'seguimientos en la comunidad' },
  { tabla: 'comunidad_baneos', col: 'lead_id', que: 'baneos en la comunidad' },
];

const VIVAS: readonly string[] = ['activa', 'respondio', 'pendiente', 'pausada', 'handoff'];

/** Una inscripción a una automatización, lo que el plan necesita de ella. */
export type InscripcionLeida = { id: number; secuencia_id: number; estado: string; nombre: string };
/** Una fila de `lead_funnel` (un CRM donde está agregado). */
export type FilaCrmLeida = { id: number; funnel_id: number; etapa: string };
/** Lo que se lee de cada ficha y de cada tabla para armar el plan. */
export type LecturaUnificar = {
  ws: number;
  a: FichaParaUnificar & { updated_at: string | null; funnel_id: number | null; meta_lead_id?: string | null };
  b: FichaParaUnificar & { updated_at: string | null; funnel_id: number | null; meta_lead_id?: string | null };
  /** Por id de ficha: sus inscripciones, sus filas de CRM, sus etiquetas, etc. */
  de: Record<number, {
    inscripciones: InscripcionLeida[];
    crm: EnCrm[];
    filasCrm: FilaCrmLeida[];
    etiquetas: Array<{ id: number; etiqueta_id: number }>;
    closingJobs: number[];
    makoPendientes: Array<{ id: number; clave: string }>;
    borradoresSetter: number[];
    chatEstado: boolean;
    chatLeidos: Array<{ usuario_id: string }>;
    conteos: Record<string, number>;
    deCliente: Record<string, number>;
    arreglos: Array<{ tabla: string; id: number; lead_ids: number[] }>;
    flujos: Array<{ id: number; ctx: Record<string, unknown> }>;
    notificaciones: number;
  }>;
};

/** Una operación del plan, en el orden en que se aplica. Todas valen dos veces (si se corta, se vuelve a correr). */
export type OpUnificar =
  | { op: 'borrar'; tabla: string; ids: number[] }
  /** Borrar por una columna (las tablas sin `id`, o todo lo que colgaba de algo que se va). */
  | { op: 'borrar-donde'; tabla: string; col: string; valor: number | string }
  | { op: 'mover'; tabla: string; col: string; de: number | string; a: number | string }
  | { op: 'actualizar'; tabla: string; id: number; valores: Record<string, unknown> }
  | { op: 'insertar'; tabla: string; fila: Record<string, unknown> }
  | { op: 'chat-leidos'; deClave: string; aClave: string; usuarios: string[] }
  | { op: 'arreglo'; tabla: string; id: number; lead_ids: number[] }
  | { op: 'flujo'; id: number; ctx: Record<string, unknown> }
  | { op: 'notificaciones'; de: number; a: number }
  | { op: 'historial'; texto: string }
  | { op: 'borrar-ficha' };

export type PlanUnificar =
  | { ok: true; previa: PreviaUnificar; ops: OpUnificar[]; queda: number; seVa: number }
  | { ok: false; error: string };

/** El orden de una etapa en su embudo (para «la que va más adelante»); -1 si no está. */
export type OrdenDeEtapa = (funnelId: number, etapa: string | null) => number;

/**
 * EL PLAN ENTERO. `quedaElegida` es la que eligió la persona (null = la regla 1). Si la que se va es cliente, o si
 * ninguna es de este negocio, no hay plan: el error lo dice.
 */
export function planDeUnificar(l: LecturaUnificar, quedaElegida: number | null): PlanUnificar {
  if (l.a.id === l.b.id) return { ok: false, error: 'Es la misma ficha.' };
  const deA = l.de[l.a.id], deB = l.de[l.b.id];
  if (!deA || !deB) return { ok: false, error: 'No pude leer las dos fichas.' };
  const conCliente = (id: number) => Object.values(l.de[id].deCliente).some((n) => n > 0);
  // La regla 1 con «es cliente»: queda la que es cliente, para que lo de cliente no tenga que mudarse.
  const auto = conCliente(l.a.id) !== conCliente(l.b.id)
    ? { queda: conCliente(l.a.id) ? l.a : l.b, porque: 'ya es cliente' }
    : (() => { const r = cualQueda({ ...l.a, cobros: deA.conteos.cobros ?? 0 }, { ...l.b, cobros: deB.conteos.cobros ?? 0 }); return { queda: r.queda.id === l.a.id ? l.a : l.b, porque: r.porque }; })();
  const queda = quedaElegida === l.a.id ? l.a : quedaElegida === l.b.id ? l.b : auto.queda;
  const seVa = queda === l.a ? l.b : l.a;
  const porque = quedaElegida != null ? 'la elegiste' : auto.porque;
  const q = l.de[queda.id], s = l.de[seVa.id];
  const bloqueo = TABLAS_DE_CLIENTE.filter((t) => (s.deCliente[t.tabla] ?? 0) > 0).map((t) => t.que);
  if (bloqueo.length) {
    return { ok: false, error: `«${nombreDe(seVa)}» ya es cliente (${[...new Set(bloqueo)].join(', ')}): eso todavía no se une desde aquí. Quédate con ésa, o escríbele a soporte.` };
  }

  const ops: OpUnificar[] = [];
  const choques: string[] = [];

  // Las automatizaciones: una por automatización. Viva le gana a terminada; empatadas, la de la que queda.
  for (const so of s.inscripciones) {
    const qo = q.inscripciones.find((x) => x.secuencia_id === so.secuencia_id);
    if (!qo) { ops.push({ op: 'actualizar', tabla: 'nutricion_inscripciones', id: so.id, valores: { lead_id: queda.id } }); continue; }
    const ganaLaOtra = VIVAS.includes(so.estado) && !VIVAS.includes(qo.estado);
    const [sigue, sale] = ganaLaOtra ? [so, qo] : [qo, so];
    // Sus envíos pasan a la que sigue (son historia); sus borradores se tiran (un borrador de una corrida que ya no existe
    // no se manda, y mudarlo chocaría con `(inscripcion_id, paso)`). Después, la que sale se borra.
    ops.push({ op: 'mover', tabla: 'nutricion_envios', col: 'inscripcion_id', de: sale.id, a: sigue.id });
    ops.push({ op: 'borrar-donde', tabla: 'wa_borradores', col: 'inscripcion_id', valor: sale.id });
    ops.push({ op: 'borrar', tabla: 'nutricion_inscripciones', ids: [sale.id] });
    if (ganaLaOtra) ops.push({ op: 'actualizar', tabla: 'nutricion_inscripciones', id: so.id, valores: { lead_id: queda.id } });
    choques.push(`Las dos estaban en «${so.nombre}»: queda la de «${nombreDe(ganaLaOtra ? seVa : queda)}» (${ganaLaOtra ? 'sigue corriendo' : 'la de la ficha que queda'}).`);
  }

  // Los CRM (regla 3): la casa de la que se va pasa a ser un CRM agregado; en uno compartido, la etapa más adelantada.
  const crms = crmsDeLaUnion(q.crm, s.crm);
  for (const c of crms) {
    const deQ = q.crm.find((x) => x.funnelId === c.funnelId);
    const deS = s.crm.find((x) => x.funnelId === c.funnelId);
    const filaS = s.filasCrm.find((f) => f.funnel_id === c.funnelId);
    if (deS && !deQ) {
      // Sólo la otra está: su fila se muda; si era su casa, se crea la fila en la que queda.
      if (filaS) ops.push({ op: 'actualizar', tabla: 'lead_funnel', id: filaS.id, valores: { lead_id: queda.id } });
      else ops.push({ op: 'insertar', tabla: 'lead_funnel', fila: { lead_id: queda.id, funnel_id: c.funnelId, etapa: deS.etapa ?? '', por: 'Unificar' } });
      continue;
    }
    if (deS && deQ) {
      if (c.de === 'las dos' && deS.orden > deQ.orden && deS.etapa) {
        // Va más adelante en la otra: la que queda toma esa etapa en ese CRM (sin mover a nadie: no dispara automatizaciones).
        const filaQ = q.filasCrm.find((f) => f.funnel_id === c.funnelId);
        if (deQ.casa) ops.push({ op: 'actualizar', tabla: 'leads', id: queda.id, valores: { pipeline_stage: deS.etapa } });
        else if (filaQ) ops.push({ op: 'actualizar', tabla: 'lead_funnel', id: filaQ.id, valores: { etapa: deS.etapa } });
        choques.push(`Las dos estaban en ${c.crm}: queda en «${deS.etapaNombre ?? deS.etapa}», la que iba más adelante.`);
      }
      if (filaS) ops.push({ op: 'borrar', tabla: 'lead_funnel', ids: [filaS.id] });
    }
  }

  // Las etiquetas: la unión (una vez cada una).
  const yaTiene = new Set(q.etiquetas.map((e) => e.etiqueta_id));
  const repetidas = s.etiquetas.filter((e) => yaTiene.has(e.etiqueta_id)).map((e) => e.id);
  if (repetidas.length) ops.push({ op: 'borrar', tabla: 'crm_lead_etiquetas', ids: repetidas });
  for (const e of s.etiquetas.filter((x) => !yaTiene.has(x.etiqueta_id))) ops.push({ op: 'actualizar', tabla: 'crm_lead_etiquetas', id: e.id, valores: { lead_id: queda.id } });

  // Lo que sólo puede haber uno: el análisis de llamadas en cola, una confirmación pendiente por clave, un borrador del
  // setter pendiente. Si la que queda ya lo tiene, el de la otra se borra; si no, se muda (abajo o acá).
  if (q.closingJobs.length && s.closingJobs.length) ops.push({ op: 'borrar', tabla: 'closing_jobs', ids: s.closingJobs });
  else if (s.closingJobs.length) ops.push({ op: 'mover', tabla: 'closing_jobs', col: 'lead_id', de: seVa.id, a: queda.id });
  const clavesQ = new Set(q.makoPendientes.map((m) => m.clave));
  const makoRepetidas = s.makoPendientes.filter((m) => clavesQ.has(m.clave)).map((m) => m.id);
  if (makoRepetidas.length) ops.push({ op: 'borrar', tabla: 'mako_confirmaciones', ids: makoRepetidas });
  ops.push({ op: 'mover', tabla: 'mako_confirmaciones', col: 'lead_id', de: seVa.id, a: queda.id });
  if (q.borradoresSetter.length && s.borradoresSetter.length) {
    ops.push({ op: 'borrar', tabla: 'wa_borradores', ids: s.borradoresSetter });
  }

  // Todo lo demás se muda (sólo donde hay algo: una tabla vacía no se toca).
  for (const t of TABLAS_QUE_SE_MUDAN) if ((s.conteos[t.tabla] ?? 0) > 0) ops.push({ op: 'mover', tabla: t.tabla, col: t.col, de: seVa.id, a: queda.id });

  // La charla en la tab Chats (`lead:<id>`): su estado, si la que queda no tiene; su «leído», por persona.
  if (s.chatEstado && !q.chatEstado) ops.push({ op: 'mover', tabla: 'chat_estado', col: 'clave', de: `lead:${seVa.id}`, a: `lead:${queda.id}` });
  else if (s.chatEstado) ops.push({ op: 'borrar-donde', tabla: 'chat_estado', col: 'clave', valor: `lead:${seVa.id}` });
  if (s.chatLeidos.length) {
    const ya = new Set(q.chatLeidos.map((x) => x.usuario_id));
    ops.push({ op: 'chat-leidos', deClave: `lead:${seVa.id}`, aClave: `lead:${queda.id}`, usuarios: s.chatLeidos.map((x) => x.usuario_id).filter((u) => !ya.has(u)) });
    // Lo que quedó (la persona ya tenía su «leído» en la que queda) se borra.
    ops.push({ op: 'borrar-donde', tabla: 'chat_leidos', col: 'clave', valor: `lead:${seVa.id}` });
  }
  ops.push({ op: 'mover', tabla: 'chat_eventos', col: 'clave', de: `lead:${seVa.id}`, a: `lead:${queda.id}` });

  // El orden manual de las columnas (arreglos de ids), las corridas de flujos y los avisos.
  for (const r of s.arreglos) ops.push({ op: 'arreglo', tabla: r.tabla, id: r.id, lead_ids: [...new Set(r.lead_ids.map((x) => (x === seVa.id ? queda.id : x)))] });
  for (const f of s.flujos) ops.push({ op: 'flujo', id: f.id, ctx: { ...f.ctx, leadId: queda.id } });
  if (s.notificaciones) ops.push({ op: 'notificaciones', de: seVa.id, a: queda.id });

  // Los datos de la ficha (regla 2). El id de Meta es único: primero se le saca a la que se va.
  const { trae, lineas } = camposDeLaUnion(queda, seVa);
  if (!queda.meta_lead_id && seVa.meta_lead_id) {
    ops.push({ op: 'actualizar', tabla: 'leads', id: seVa.id, valores: { meta_lead_id: null } });
    trae.meta_lead_id = seVa.meta_lead_id;
  }
  if (Object.keys(trae).length) ops.push({ op: 'actualizar', tabla: 'leads', id: queda.id, valores: trae });
  if (queda.visitor_id && seVa.visitor_id && queda.visitor_id !== seVa.visitor_id) {
    choques.push(`Las visitas a la página de «${nombreDe(seVa)}» no se juntan: cada ficha guarda una sola, y queda la de «${nombreDe(queda)}».`);
  }

  ops.push({ op: 'historial', texto: `Se unió con «${nombreDe(seVa)}» (#${seVa.id}): sus datos, mensajes, historial y automatizaciones pasaron a esta ficha.` });
  ops.push({ op: 'borrar-ficha' });

  const mueve: LoQueSeMueve[] = [
    { que: 'automatizaciones', uno: 'automatización', n: s.inscripciones.length },
    ...TABLAS_QUE_SE_MUDAN.map((t) => ({ que: t.que, uno: t.uno, n: s.conteos[t.tabla] ?? 0 })),
    { que: 'etiquetas', uno: 'etiqueta', n: s.etiquetas.length - repetidas.length },
  ].filter((m) => m.n > 0);
  const previa: PreviaUnificar = {
    queda: { id: queda.id, nombre: nombreDe(queda), desde: queda.created_at, porque },
    seVa: { id: seVa.id, nombre: nombreDe(seVa), desde: seVa.created_at },
    datos: lineas.map((x) => ({ nombre: x.nombre, valor: x.valor, de: x.de })),
    crms: crms.map((c) => ({ crm: c.crm, etapa: c.etapaNombre ?? c.etapa, casa: c.casa, de: c.de })),
    mueve, choques,
    version: { queda: queda.updated_at, seVa: seVa.updated_at },
  };
  return { ok: true, previa, ops, queda: queda.id, seVa: seVa.id };
}

const nombreDe = (f: Pick<FichaParaUnificar, 'id' | 'nombre'>): string => f.nombre?.trim() || `Lead ${f.id}`;
