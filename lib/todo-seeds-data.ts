// =============================================================================
// todo-seeds-data — DATOS puros del seed del board de cliente (sin server-only)
// =============================================================================
// Los DATOS del seed y los builders de filas; el insert tenant-scoped vive en
// lib/todo-seeds.ts. Acá NO se toca la DB: solo datos puros (los `import type` se
// borran al compilar, así que no arrastran server-only).
//
// Cada tarea declara DOS cosas además de su contenido: con qué SEÑAL del negocio
// ya se puede dar por hecha (lib/plan-senales.ts) y a qué CANALES de venta le
// aplica. Con eso el board de un cliente nuevo nace personalizado en vez de traerle
// 34 tareas iguales para todos, varias de cosas que ya resolvió en el onboarding.
// =============================================================================

import type { SenalId } from './plan-senales';
import type { CanalId } from './fase-diagnostico';

export type Prio = 'alta' | 'media' | 'baja' | 'futuro';
type Actor = 'user' | 'ia';
export type HistEntry = { id: string; ts: number; actor: Actor; text: string };
export type ChecklistItem = { id: string; text: string; done: boolean };

/** Un proyecto del seed. `faseMin`/`faseMax` acotan en qué fase del negocio tiene
 *  sentido: "Escalar la campaña ganadora" no le va a alguien de fase 1 que todavía
 *  no encontró un ganador (su propia fase le dice, textual, que NO escale). */
export type SeedProy = {
  key: string; nombre: string; emoji: string; color: string; prioridad: number; deadlineDias: number; scoreRazon: string; detalle: string;
  faseMin?: number; faseMax?: number;
};

/** Una tarea del seed.
 *  `listo`  = señales que, si están TODAS, significan que ya está hecha (nace completada).
 *  `canales`= canales de venta a los que aplica (sin esto, aplica a todos). */
export type SeedTarea = { cat: string; titulo: string; detalle: string; prio: Prio; cl: string[]; listo?: SenalId[]; canales?: CanalId[] };

// ── Proyectos FINITOS de un negocio que vende con ads + funnel ────────────────
// prioridad DISTINTA (sin empatar); la más alta = Objetivo Principal (arrancar).
export const SEED_CATEGORIAS: SeedProy[] = [
  { key: 'setup', nombre: 'Setup inicial de MaKo', emoji: '🚀', color: '#D0504A', prioridad: 95, deadlineDias: 14,
    scoreRazon: 'Es lo primero: hasta que MaKo no está enchufado a tus fuentes, no ve tu negocio.',
    detalle: 'Dejar MaKo conectado a todas tus fuentes: Meta Ads, Calendly, el CRM/ficha del lead, WhatsApp y Fathom. Es el arranque — sin esto MaKo no ve tu negocio. Se termina cuando cada integración está conectada y probada.' },
  { key: 'ganador', nombre: 'Encontrar el primer anuncio ganador', emoji: '🎯', color: '#2F6FED', prioridad: 85, deadlineDias: 30, faseMax: 3,
    scoreRazon: 'Es el motor: sin un creativo que baje el CPL de forma estable, escalar es tirar plata.',
    detalle: 'Testear ángulos y creativos hasta dar con el anuncio que baja el costo por lead de forma consistente. Es el motor de todo. Se termina cuando hay un creativo con CPL estable por debajo de tu objetivo.' },
  { key: 'clientes', nombre: 'Cerrar los primeros 10 clientes', emoji: '🤝', color: '#0E9B8E', prioridad: 72, deadlineDias: 75, faseMax: 2,
    scoreRazon: 'La meta comercial de arranque: valida que el sistema entero convierte en plata.',
    detalle: 'Llevar el sistema hasta los primeros 10 cierres, afinando oferta, guiones y manejo de objeciones. Se termina cuando hay 10 clientes cerrados y un proceso de venta repetible.' },
  { key: 'funnel', nombre: 'Validar el funnel completo (VSL → agenda → cierre)', emoji: '🔁', color: '#7C5CFB', prioridad: 62, deadlineDias: 45, faseMax: 4,
    scoreRazon: 'Es donde el tráfico se transforma en plata; una fuga acá arruina toda la pauta.',
    detalle: 'Que el camino del lead convierta punta a punta: mira el VSL, agenda, se presenta (R1), avanza (R2) y cierra. Se termina cuando cada paso tiene su número medido y sin fugas grandes.' },
  { key: 'seguimiento', nombre: 'Montar el seguimiento por WhatsApp', emoji: '💬', color: '#C8870C', prioridad: 50, deadlineDias: 35,
    scoreRazon: 'Recupera plata que hoy se pierde: recordatorios de junta y reactivación de no-shows.',
    detalle: 'Los mensajes que mantienen vivo al lead: recordatorios antes de la junta y reactivación de los que no se presentaron o se enfriaron. Se termina cuando las dos secuencias corren solas y se mide su impacto.' },
  { key: 'escalar', nombre: 'Escalar la campaña ganadora', emoji: '📈', color: '#D6489B', prioridad: 38, deadlineDias: 60, faseMin: 3,
    scoreRazon: 'Va después del ganador: escalar sin ganador rompe el CPA y quema presupuesto.',
    detalle: 'Una vez que hay un ganador, subirlo sin romper el CPA: decidir si el escalado es vertical (más presupuesto) u horizontal (más públicos/ubicaciones). Se termina cuando el ganador corre a mayor gasto manteniendo el costo por cierre.' },
  { key: 'contenido', nombre: 'Construir el banco de creativos y contenido', emoji: '✍️', color: '#1E9E57', prioridad: 26, deadlineDias: 40,
    scoreRazon: 'Munición para no quemar la audiencia; importa, pero después de tener un ganador.',
    detalle: 'La materia prima para no quemar la audiencia: VSL, ángulos nuevos de ads y testimonios. Se termina cuando hay un pipeline que produce creativos nuevos cada mes.' },
  { key: 'tablero', nombre: 'Montar el tablero de números (fuente de verdad)', emoji: '⚙️', color: '#98A0AC', prioridad: 14, deadlineDias: 21,
    scoreRazon: 'Para decidir con datos, no con sensaciones; transversal y de menor urgencia.',
    detalle: 'Un solo lugar con las métricas norte del negocio: gasto, CPL, CPA, cierres, ROAS. Se termina cuando el tablero se actualiza solo y el equipo lo mira semana a semana.' },
];

export const SEED_TAREAS: SeedTarea[] = [
  // 🚀 Setup inicial
  { cat: 'setup', titulo: 'Conectar la cuenta de Meta Ads', detalle: 'Dar acceso a la cuenta publicitaria para que MaKo lea campañas, gasto y métricas.', prio: 'alta', cl: ['Dar acceso a la cuenta publicitaria', 'Conectar el pixel', 'Verificar el dominio en Meta'], listo: ['meta-conectado'] },
  { cat: 'setup', titulo: 'Conectar la agenda (Calendly)', detalle: 'Que cada junta agendada caiga al CRM con su tracking de origen.', prio: 'alta', cl: ['Conectar Calendly', 'UTM / tracking del agendamiento', 'Probar un agendamiento'], listo: ['calendly-conectado'], canales: ['llamadas', 'webinar'] },
  { cat: 'setup', titulo: 'Configurar el CRM y la ficha del lead', detalle: 'Definir las etapas del funnel y los campos de la ficha para seguir a cada lead.', prio: 'alta', cl: ['Definir las etapas del funnel', 'Campos de la ficha', 'Importar los leads actuales'], listo: ['crm-con-leads', 'funnel-cargado'] },
  { cat: 'setup', titulo: 'Conectar WhatsApp', detalle: 'El canal principal para hablar con el lead entre el primer contacto y el cierre.', prio: 'media', cl: ['Conectar el número', 'Verificar en Meta', 'Probar un envío'], listo: ['whatsapp-conectado'] },
  { cat: 'setup', titulo: 'Conectar Fathom (grabación de llamadas)', detalle: 'Grabar R1/R2 para que el Closing Analyst aprenda de los cierres.', prio: 'media', cl: ['Conectar Fathom', 'Grabar una R1/R2', 'Ver el análisis'], listo: ['fathom-conectado'], canales: ['llamadas', 'webinar'] },
  { cat: 'setup', titulo: 'Cargar el funnel del negocio en MaKo', detalle: 'El funnel es la fuente de verdad que alimenta métricas, SLAs y automatizaciones.', prio: 'media', cl: ['Definir las etapas', 'Cargar metas por etapa', 'Confirmar la fuente de verdad'], listo: ['funnel-cargado'] },
  // 🎯 Primer anuncio ganador
  { cat: 'ganador', titulo: 'Definir 3 ángulos para testear', detalle: 'Distintos dolores/promesas para descubrir cuál conecta con el mercado.', prio: 'alta', cl: ['Investigar los dolores del cliente', 'Redactar 3 ángulos', 'Validarlos con el método'], listo: ['avatares-definidos', 'razones-definidas'] },
  { cat: 'ganador', titulo: 'Producir los creativos del test', detalle: 'Los anuncios de cada ángulo, listos para subir.', prio: 'media', cl: ['Bocetar', 'Producir', 'Aprobar'] },
  { cat: 'ganador', titulo: 'Lanzar el test A/B de creativos', detalle: 'Estructura limpia para comparar ángulos sin contaminar los resultados.', prio: 'alta', cl: ['Armar la estructura de test', 'Presupuesto por variante', 'Publicar'] },
  { cat: 'ganador', titulo: 'Medir CPL/CTR por creativo', detalle: 'Leer los números a 3-4 días y matar a los perdedores sin culpa.', prio: 'media', cl: ['Definir el umbral de CPL', 'Leer los resultados', 'Descartar los perdedores'] },
  { cat: 'ganador', titulo: 'Declarar el ganador y documentarlo', detalle: 'Dejar el ganador como base y entender POR QUÉ ganó.', prio: 'media', cl: ['Elegir el ganador', 'Documentar por qué ganó', 'Dejarlo como base'] },
  // 🤝 Primeros 10 clientes
  { cat: 'clientes', titulo: 'Definir la oferta y el precio', detalle: 'La oferta clara y el precio que sostiene el margen.', prio: 'alta', cl: ['Armar la oferta', 'Definir el precio', 'Validar con datos'], listo: ['oferta-definida'] },
  { cat: 'clientes', titulo: 'Guion del setter (R1)', detalle: 'Estandarizar la primera llamada: calificar y agendar la R2.', prio: 'media', cl: ['Escribir el guion', 'Objeciones comunes', 'Entrenar al equipo'], canales: ['llamadas', 'webinar'] },
  { cat: 'clientes', titulo: 'Guion del closer (R2)', detalle: 'La llamada de cierre: presentación de la oferta y manejo de precio.', prio: 'media', cl: ['Escribir el guion', 'Manejo de precio', 'Entrenar al equipo'], canales: ['llamadas', 'webinar'] },
  { cat: 'clientes', titulo: 'Registrar y analizar cada llamada', detalle: 'Grabar todo y pasarlo por el Closing Analyst para mejorar cada semana.', prio: 'media', cl: ['Grabar todas las llamadas', 'Analizar con el Closing Analyst', 'Ajustar el guion'], listo: ['llamadas-analizadas'], canales: ['llamadas', 'webinar'] },
  { cat: 'clientes', titulo: 'Documentar las objeciones recurrentes', detalle: 'Las objeciones que matan cierres, con su respuesta estándar.', prio: 'baja', cl: ['Listar las objeciones', 'Respuestas estándar', 'Entrenar al equipo'], canales: ['llamadas', 'webinar', 'conversaciones'] },
  // 🔁 Validar el funnel
  { cat: 'funnel', titulo: 'Medir la retención del VSL', detalle: 'Dónde se caen los que miran el video: el punto exacto a arreglar.', prio: 'alta', cl: ['Instrumentar el VSL', 'Leer la curva de retención', 'Detectar la caída'], canales: ['llamadas', 'webinar', 'carrito'] },
  { cat: 'funnel', titulo: 'Optimizar la tasa de agenda', detalle: 'De los que ven el VSL, cuántos agendan — y cómo subirlo.', prio: 'media', cl: ['Medir visita → agenda', 'Probar mejoras en la CTA'], canales: ['llamadas', 'webinar'] },
  { cat: 'funnel', titulo: 'Medir el show-rate de la R1', detalle: 'De los que agendan, cuántos se presentan.', prio: 'media', cl: ['Medir agendados vs presentados', 'Recordatorios para subirlo'], canales: ['llamadas', 'webinar'] },
  { cat: 'funnel', titulo: 'Medir el cierre en la R2', detalle: 'De los que llegan a la R2, cuántos cierran y por qué no los demás.', prio: 'media', cl: ['Medir R2 → cierre', 'Analizar objeciones'], canales: ['llamadas'] },
  { cat: 'funnel', titulo: 'Cerrar las fugas del funnel', detalle: 'Atacar primero el paso más flojo — el que más plata deja en la mesa.', prio: 'media', cl: ['Identificar el paso más flojo', 'Atacarlo primero'] },
  // 💬 Seguimiento por WhatsApp
  { cat: 'seguimiento', titulo: 'Aprobar las plantillas de WhatsApp', detalle: 'Mensajes aprobados por Meta para poder iniciar conversación.', prio: 'media', cl: ['Redactar', 'Enviar a aprobación de Meta', 'Confirmar aprobadas'] },
  { cat: 'seguimiento', titulo: 'Secuencia de recordatorios de junta (24h/1h)', detalle: 'Avisos automáticos antes de la R1/R2 para bajar el no-show.', prio: 'media', cl: ['Definir los tiempos', 'Redactar los mensajes', 'Activar'], listo: ['nutricion-activa'], canales: ['llamadas', 'webinar'] },
  { cat: 'seguimiento', titulo: 'Secuencia de reactivación de no-shows', detalle: 'Recuperar a los que no se presentaron o se enfriaron.', prio: 'media', cl: ['Definir el disparador', 'Redactar los mensajes', 'Activar'], listo: ['nutricion-activa'], canales: ['llamadas', 'webinar'] },
  { cat: 'seguimiento', titulo: 'Medir el impacto en el show-rate', detalle: 'Confirmar que las secuencias mueven la aguja, no solo mandan mensajes.', prio: 'baja', cl: ['Comparar antes/después', 'Ajustar'], canales: ['llamadas', 'webinar'] },
  // 📈 Escalar la ganadora
  { cat: 'escalar', titulo: 'Analizar el ganador antes de escalar', detalle: 'Ver si el creativo aguanta más gasto sin saturar.', prio: 'media', cl: ['Revisar CPA y frecuencia', 'Ver saturación del público'] },
  { cat: 'escalar', titulo: 'Decidir escalado horizontal vs vertical', detalle: 'Más presupuesto al mismo público (vertical) o más públicos/ubicaciones (horizontal).', prio: 'media', cl: ['Evaluar el margen', 'Decidir la estrategia', 'Documentar la decisión'] },
  { cat: 'escalar', titulo: 'Subir el presupuesto de forma controlada (20%)', detalle: 'Subir de a poco para no disparar el reaprendizaje.', prio: 'media', cl: ['Subir 20%', 'Esperar el reaprendizaje', 'Medir el CPA'] },
  { cat: 'escalar', titulo: 'Duplicar a públicos/ubicaciones nuevas', detalle: 'Escalado horizontal: abrir frentes nuevos con el ganador.', prio: 'baja', cl: ['Elegir públicos nuevos', 'Duplicar', 'Medir'] },
  { cat: 'escalar', titulo: 'Monitorear el CPA mientras se escala', detalle: 'Cortar lo que no aguanta el costo por cierre.', prio: 'baja', cl: ['Alerta si el CPA sube', 'Cortar lo que no aguanta'] },
  // ✍️ Banco de creativos
  { cat: 'contenido', titulo: 'Escribir el guion del VSL', detalle: 'El video de ventas que hace el trabajo pesado del funnel.', prio: 'media', cl: ['Estructura del guion', 'Promesa + oferta', 'Revisar'], listo: ['vsl-con-visitas'], canales: ['llamadas', 'webinar', 'carrito'] },
  { cat: 'contenido', titulo: 'Grabar y editar el VSL', detalle: 'Producción del video y publicación en la landing.', prio: 'media', cl: ['Grabar', 'Editar', 'Publicar en la landing'], listo: ['vsl-con-visitas'], canales: ['llamadas', 'webinar', 'carrito'] },
  { cat: 'contenido', titulo: 'Producir 3 ángulos nuevos por mes', detalle: 'Munición fresca para que Adquisición no se quede sin qué testear.', prio: 'baja', cl: ['Definir los ángulos', 'Producir', 'Testear'] },
  { cat: 'contenido', titulo: 'Armar el banco de testimonios', detalle: 'Prueba social para ads, landing y llamadas.', prio: 'baja', cl: ['Juntar testimonios', 'Editar', 'Publicar'] },
  // ⚙️ Tablero de números
  { cat: 'tablero', titulo: 'Definir las métricas norte', detalle: 'Las 5-7 métricas que de verdad importan, con su fórmula.', prio: 'media', cl: ['Elegir 5-7 métricas clave', 'Definir cómo se calculan'], listo: ['funnel-cargado'] },
  { cat: 'tablero', titulo: 'Conectar las fuentes de datos', detalle: 'Meta, CRM y pagos cruzados en un solo lugar.', prio: 'media', cl: ['Conectar Meta', 'Conectar el CRM y pagos', 'Cruzarlas'], listo: ['metricas-meta', 'crm-con-leads'] },
  { cat: 'tablero', titulo: 'Publicar el tablero y darle rutina', detalle: 'Que se actualice solo y que el equipo lo mire cada semana.', prio: 'baja', cl: ['Publicar', 'Revisión semanal'] },
];

export const SCORE_PRIO: Record<Prio, number> = { alta: 85, media: 62, baja: 37, futuro: 12 };
export const estadoDe = (p: number): 'por_hacer' | 'en_curso' | 'hecho' => (p >= 100 ? 'hecho' : p > 0 ? 'en_curso' : 'por_hacer');
export const fechaOffset = (base: number, dias: number): string => new Date(base + dias * 86400000).toISOString().slice(0, 10);

export type CatRow = { nombre: string; color: string; emoji: string; prioridad: number; score_razon: string; deadline: string; detalle: string; historial: HistEntry[] };
export type TarRow = {
  titulo: string; detalle: string; estado: string; prioridad: Prio; progreso: number; deadline: string | null;
  categorias: number[]; checklist: ChecklistItem[]; historial: HistEntry[]; en_prioridad: boolean; score: number;
  score_razon: string | null; origen: string; experimento_id: null; retro_id: null; orden: number; hecho_at: string | null; updated_at: string;
};

// ── Qué le toca a ESTE negocio ───────────────────────────────────────────────

/** La evidencia con la que MaKo justifica haber marcado una tarea como hecha. Va
 *  al historial de la tarjeta: nada se da por hecho sin decir por qué. */
export const EVIDENCIA_SENAL: Record<SenalId, string> = {
  'meta-conectado': 'tu cuenta de Meta Ads ya está conectada',
  'calendly-conectado': 'tu agenda ya está conectada',
  'whatsapp-conectado': 'tu WhatsApp ya está conectado',
  'fathom-conectado': 'Fathom ya está conectado',
  'funnel-cargado': 'tu funnel ya está cargado en MaKo',
  'crm-con-leads': 'ya hay leads cargados en el CRM',
  'llamadas-analizadas': 'ya hay llamadas analizadas por el Closing Analyst',
  'metricas-meta': 'ya entran métricas de Meta todos los días',
  'avatares-definidos': 'ya definiste tus avatares',
  'razones-definidas': 'ya definiste tus razones de compra',
  'oferta-definida': 'ya definiste tu oferta',
  'vsl-con-visitas': 'tu VSL ya está publicado y recibiendo visitas',
  'nutricion-activa': 'MaKo ya te dejó las secuencias armadas en Nutrición',
};

export type CtxSeed = { fase: number | null; canal: CanalId | null };
export type SenalesSeed = Partial<Record<SenalId, boolean>>;

/** ¿Esta tarea le aplica al canal de venta del negocio? Sin canal declarado (o sin
 *  diagnóstico todavía) aplica todo: no se recorta lo que no se sabe. */
const aplicaCanal = (t: SeedTarea, canal: CanalId | null): boolean => !t.canales || !canal || t.canales.includes(canal);

/** ¿Están TODAS las señales que dan la tarea por hecha? (sin señales, nunca). */
export const senalesCumplidas = (t: SeedTarea, s: SenalesSeed): boolean => !!t.listo?.length && t.listo.every((k) => s[k]);

/**
 * El subconjunto del seed que le toca a este negocio: proyectos de su fase (la que
 * se MUESTRA, 1 a 5) y tareas de su canal. Un proyecto que se queda sin tareas no se
 * crea. Si el recorte se lleva todo, se devuelve el seed completo: un board vacío es
 * peor que uno genérico, y significaría que el contexto vino mal.
 */
export function seedRelevante(ctx: CtxSeed): { proyectos: SeedProy[]; tareas: SeedTarea[] } {
  const enFase = (p: SeedProy) => ctx.fase == null || (ctx.fase >= (p.faseMin ?? 1) && ctx.fase <= (p.faseMax ?? 5));
  const tareas = SEED_TAREAS.filter((t) => aplicaCanal(t, ctx.canal));
  const conTareas = new Set(tareas.map((t) => t.cat));
  const proyectos = SEED_CATEGORIAS.filter((p) => enFase(p) && conTareas.has(p.key));
  if (!proyectos.length) return { proyectos: SEED_CATEGORIAS, tareas: SEED_TAREAS };
  const keys = new Set(proyectos.map((p) => p.key));
  return { proyectos, tareas: tareas.filter((t) => keys.has(t.cat)) };
}

/**
 * Filas de proyectos (sin workspace_id) + el mapa key→deadline. `yaHechos` son los
 * proyectos cuyas tareas nacen TODAS completadas: siguen visibles (con la evidencia
 * a la vista) pero bajan de prioridad, para que el Objetivo Principal sea trabajo
 * de verdad y no una carpeta con todo tildado.
 */
export function buildCatRows(now: number, proyectos: SeedProy[] = SEED_CATEGORIAS, yaHechos = new Set<string>()): { filas: CatRow[]; deadlinePorKey: Map<string, string> } {
  const histCat: HistEntry[] = [{ id: 'seedcat', ts: now, actor: 'ia', text: 'MaKo creó el proyecto' }];
  const deadlinePorKey = new Map(proyectos.map((c) => [c.key, fechaOffset(now, c.deadlineDias)] as const));
  const filas = proyectos.map((c, i) => {
    const hecho = yaHechos.has(c.key);
    return {
      nombre: c.nombre, color: c.color, emoji: c.emoji,
      prioridad: hecho ? Math.max(1, 10 - i) : c.prioridad,
      score_razon: hecho ? 'Ya estaba resuelto cuando entraste: MaKo lo dio por completo y lo bajó de prioridad.' : c.scoreRazon,
      deadline: deadlinePorKey.get(c.key)!, detalle: c.detalle,
      historial: hecho ? [{ id: `seedcatd${i}`, ts: now, actor: 'ia' as const, text: 'MaKo lo creó ya completo: todas sus tareas estaban resueltas' }] : histCat,
    };
  });
  return { filas, deadlinePorKey };
}

/** Filas de tareas (sin workspace_id), linkeadas por id de proyecto. Las que sus
 *  señales dan por resueltas nacen completadas, con la evidencia en el historial. */
export function buildTarRows(now: number, idPorKey: Map<string, number>, deadlinePorKey: Map<string, string>, tareas: SeedTarea[] = SEED_TAREAS, senales: SenalesSeed = {}): TarRow[] {
  const n = tareas.length;
  // score VARIADO (no todas el mismo número): parte del band representativo y le suma
  // un pequeño jitter por índice, sin cambiar la columna. Con 34+ proyectos el guardián
  // reparte fino, pero de arranque ya no se repite un único valor por banda.
  const jitter = (i: number) => ((i * 7) % 9) - 4; // -4..+4, determinístico
  return tareas.map((t, i) => {
    const catId = idPorKey.get(t.cat);
    const hecho = senalesCumplidas(t, senales);
    const progreso = hecho ? 100 : 0;
    const checklist: ChecklistItem[] = t.cl.map((text, k) => ({ id: `sc${i}_${k}`, text, done: hecho }));
    const hist: HistEntry[] = [{ id: `seedt${i}`, ts: now, actor: 'ia', text: 'MaKo creó la tarjeta' }];
    if (hecho) {
      const porQue = (t.listo ?? []).map((k) => EVIDENCIA_SENAL[k]).join(' y ');
      hist.unshift({ id: `seedd${i}`, ts: now, actor: 'ia', text: `MaKo la marcó hecha: ${porQue}` });
    }
    return {
      titulo: t.titulo, detalle: t.detalle, estado: estadoDe(progreso), prioridad: t.prio,
      progreso, deadline: deadlinePorKey.get(t.cat) ?? null, categorias: catId != null ? [catId] : [], checklist, historial: hist,
      en_prioridad: false, score: Math.max(1, Math.min(100, SCORE_PRIO[t.prio] + jitter(i))), score_razon: null, origen: 'mako', experimento_id: null, retro_id: null,
      orden: i - n, hecho_at: hecho ? new Date(now).toISOString() : null, updated_at: new Date(now).toISOString(),
    };
  });
}
