import 'server-only';

// =============================================================================
// todo-seeds — board /plan por defecto para clientes nuevos (G4, "Ambos")
// =============================================================================
// Un cliente que recién arranca ya no ve el board vacío: le sembramos los 6
// PROYECTOS base + un set de TAREAS de arranque (con checklist) pensadas para un
// negocio que corre ads + funnel con MaKo. Todas nacen SIN empezar.
//   • Template genérico  → cualquier cliente nuevo (nada pre-hecho).
//   • Mauricio (slug 'mauricio') → además marca HECHO lo que ya tiene armado
//     (Meta conectada, Calendly, CRM/ficha, WhatsApp, VSL, Fathom, tablero).
//
// El super-admin (PlanBoard, localStorage) tiene su propio SEED aparte; esto es
// solo para el board de cliente (tenant-scoped por DB). Idempotente: solo siembra
// si el cliente todavía no tiene ni proyectos ni tareas.
// =============================================================================

import { getTenantDb } from './workspace';
import type { Categoria, HistEntry, ChecklistItem } from './todo';

type SeedProy = { key: string; nombre: string; emoji: string; color: string; prioridad: number; detalle: string };

// Prioridades DISTINTAS (sin empatar) — el orden = qué mueve más la aguja de un
// negocio que vende con ads. El guardián después las re-puntúa si el cliente arma
// su plan, pero de arranque quedan ordenadas con criterio.
export const SEED_CATEGORIAS: SeedProy[] = [
  { key: 'adq', nombre: 'Adquisición & Ads', emoji: '🎯', color: '#D0504A', prioridad: 9, detalle: 'Todo lo que trae leads nuevos: campañas, creativos, presupuesto y optimización de la pauta. Es la boca del embudo — sin esto no entra nadie.' },
  { key: 'ventas', nombre: 'Seguimiento & Ventas', emoji: '📞', color: '#2F6FED', prioridad: 8, detalle: 'Setters y closers: agendar, presentarse, cerrar. El CRM y el estado de cada lead viven acá. Es donde el tráfico se transforma en plata.' },
  { key: 'nutri', nombre: 'Nutrición & Mensajería', emoji: '💬', color: '#7C5CFB', prioridad: 6, detalle: 'WhatsApp, email y los recordatorios que mantienen vivo al lead entre el primer contacto y el cierre. Recupera lo que se enfría.' },
  { key: 'contenido', nombre: 'Contenido & Creativos', emoji: '✍️', color: '#0E9B8E', prioridad: 5, detalle: 'La materia prima de los ads y del funnel: guiones, VSL, imágenes, copys. Alimenta a Adquisición con ángulos nuevos.' },
  { key: 'retencion', nombre: 'Clientes & Retención', emoji: '🤝', color: '#C8870C', prioridad: 4, detalle: 'Onboarding, cumplimiento y que el cliente se quede (y refiera). Cuidar la cartera cuesta menos que salir a buscar leads nuevos.' },
  { key: 'ops', nombre: 'Operación & Métricas', emoji: '⚙️', color: '#98A0AC', prioridad: 2, detalle: 'La trastienda: procesos, cobranzas, tablero de números y todo lo administrativo que sostiene al resto sin ser la punta de lanza.' },
];

type Prio = 'alta' | 'media' | 'baja' | 'futuro';
type SeedTarea = { cat: string; titulo: string; detalle: string; prio: Prio; cl: string[]; mDone?: boolean };

// Tareas de arranque. `mDone` = las que Mauricio ya tiene armadas (se marcan hechas
// solo en su workspace). El resto de los clientes las ven sin empezar.
const SEED_TAREAS: SeedTarea[] = [
  // 🎯 Adquisición & Ads
  { cat: 'adq', titulo: 'Conectar la cuenta de Meta Ads', detalle: 'Dar acceso a la cuenta publicitaria para que MaKo lea campañas y métricas.', prio: 'alta', cl: ['Dar acceso a la cuenta publicitaria', 'Conectar el pixel', 'Verificar el dominio en Meta'], mDone: true },
  { cat: 'adq', titulo: 'Configurar el Pixel + CAPI', detalle: 'Medición del lado del servidor para no perder conversiones por el navegador.', prio: 'alta', cl: ['Instalar el pixel', 'Activar CAPI (server-side)', 'Verificar los eventos'] },
  { cat: 'adq', titulo: 'Cargar los primeros creativos', detalle: 'Subir los anuncios iniciales con sus copys para arrancar a testear.', prio: 'media', cl: ['Subir 3 creativos', 'Escribir los copys', 'Aprobar con el cliente'] },
  { cat: 'adq', titulo: 'Lanzar la primera campaña', detalle: 'Estructura mínima para empezar a traer leads y validar el CPL.', prio: 'alta', cl: ['Definir presupuesto', 'Armar los públicos', 'Publicar en pausa', 'Activar'] },
  { cat: 'adq', titulo: 'Revisión semanal de métricas (CPL/CPA/ROAS)', detalle: 'Rutina para leer los números y decidir qué escalar o cortar.', prio: 'media', cl: ['Definir los KPIs', 'Armar el reporte', 'Rutina semanal'] },
  // 📞 Seguimiento & Ventas
  { cat: 'ventas', titulo: 'Conectar la agenda (Calendly)', detalle: 'Que las juntas agendadas caigan al CRM con su tracking.', prio: 'alta', cl: ['Conectar Calendly', 'UTM / tracking del agendamiento', 'Probar un agendamiento'], mDone: true },
  { cat: 'ventas', titulo: 'Configurar el CRM y la ficha del lead', detalle: 'Etapas del funnel y campos de la ficha para seguir a cada lead.', prio: 'alta', cl: ['Definir las etapas del funnel', 'Campos de la ficha', 'Importar los leads actuales'], mDone: true },
  { cat: 'ventas', titulo: 'Guion del setter (R1)', detalle: 'Estandarizar la primera llamada: calificar y agendar la R2.', prio: 'media', cl: ['Escribir el guion', 'Objeciones comunes', 'Entrenar al equipo'] },
  { cat: 'ventas', titulo: 'Guion del closer (R2)', detalle: 'La llamada de cierre: presentación de la oferta y manejo de precio.', prio: 'media', cl: ['Escribir el guion', 'Manejo de precio', 'Entrenar al equipo'] },
  { cat: 'ventas', titulo: 'Registrar cada llamada (Fathom)', detalle: 'Grabar R1/R2 para que el Closing Analyst aprenda de los cierres.', prio: 'media', cl: ['Conectar Fathom', 'Grabar R1/R2', 'Analizar los cierres'], mDone: true },
  { cat: 'ventas', titulo: 'Reporte de cierres semanal', detalle: 'Cuántas juntas, cuántos cierres, ticket promedio.', prio: 'baja', cl: ['Definir métricas de cierre', 'Automatizar el reporte'] },
  // 💬 Nutrición & Mensajería
  { cat: 'nutri', titulo: 'Conectar WhatsApp', detalle: 'El canal principal para hablar con el lead entre el contacto y el cierre.', prio: 'alta', cl: ['Conectar el número', 'Verificar en Meta', 'Probar un envío'], mDone: true },
  { cat: 'nutri', titulo: 'Aprobar plantillas de WhatsApp', detalle: 'Mensajes aprobados por Meta para poder iniciar conversación.', prio: 'media', cl: ['Redactar las plantillas', 'Enviar a aprobación', 'Confirmar aprobadas'] },
  { cat: 'nutri', titulo: 'Secuencia de recordatorios de junta', detalle: 'Avisos automáticos antes de la R1/R2 para bajar el no-show.', prio: 'media', cl: ['Definir los tiempos', 'Redactar los mensajes', 'Activar'] },
  { cat: 'nutri', titulo: 'Secuencia de reactivación de no-shows', detalle: 'Recuperar a los que no se presentaron o se enfriaron.', prio: 'media', cl: ['Definir el disparador', 'Redactar los mensajes', 'Activar'] },
  { cat: 'nutri', titulo: 'Conectar el email de nutrición', detalle: 'Canal secundario para secuencias más largas.', prio: 'baja', cl: ['Configurar el dominio', 'Conectar Resend', 'Primer envío'] },
  // ✍️ Contenido & Creativos
  { cat: 'contenido', titulo: 'Escribir el guion del VSL', detalle: 'El video de ventas que hace el trabajo pesado del funnel.', prio: 'alta', cl: ['Estructura del guion', 'Promesa + oferta', 'Revisar'], mDone: true },
  { cat: 'contenido', titulo: 'Grabar y editar el VSL', detalle: 'Producción del video y publicación en la landing.', prio: 'media', cl: ['Grabar', 'Editar', 'Publicar en la landing'], mDone: true },
  { cat: 'contenido', titulo: '3 ángulos de creativo para ads', detalle: 'Variedad de ángulos para no quemar a la audiencia.', prio: 'media', cl: ['Definir los ángulos', 'Producir', 'Testear'] },
  { cat: 'contenido', titulo: 'Banco de testimonios', detalle: 'Prueba social para ads, landing y llamadas.', prio: 'baja', cl: ['Juntar testimonios', 'Editar', 'Publicar'] },
  { cat: 'contenido', titulo: 'Calendario de contenidos', detalle: 'Contenido orgánico que sostiene la marca en el tiempo.', prio: 'futuro', cl: ['Definir la frecuencia', 'Armar el calendario'] },
  // 🤝 Clientes & Retención
  { cat: 'retencion', titulo: 'Onboarding del cliente nuevo', detalle: 'El arranque que define la experiencia y el cumplimiento.', prio: 'media', cl: ['Checklist de alta', 'Kickoff', 'Accesos'] },
  { cat: 'retencion', titulo: 'Checklist de cumplimiento/entrega', detalle: 'Qué se entrega y cuándo, para que nada se caiga.', prio: 'media', cl: ['Definir los entregables', 'Seguimiento', 'QA'] },
  { cat: 'retencion', titulo: 'Encuesta de satisfacción', detalle: 'Medir cómo la está pasando el cliente antes de que se vaya.', prio: 'baja', cl: ['Diseñar la encuesta', 'Enviar', 'Analizar'] },
  { cat: 'retencion', titulo: 'Programa de referidos', detalle: 'Convertir clientes contentos en leads nuevos.', prio: 'futuro', cl: ['Diseñar el incentivo', 'Comunicar'] },
  // ⚙️ Operación & Métricas
  { cat: 'ops', titulo: 'Tablero de números (fuente de verdad)', detalle: 'Un solo lugar con las métricas norte del negocio.', prio: 'media', cl: ['Definir las métricas norte', 'Conectar las fuentes', 'Publicar el tablero'], mDone: true },
  { cat: 'ops', titulo: 'Proceso de cobranza', detalle: 'Que la plata entre en tiempo y forma, sin perseguir.', prio: 'baja', cl: ['Definir el flujo', 'Automatizar recordatorios'] },
  { cat: 'ops', titulo: 'Definir SLAs internos', detalle: 'Tiempos de respuesta acordados por proceso.', prio: 'futuro', cl: ['Listar los procesos', 'Definir los tiempos'] },
  { cat: 'ops', titulo: 'Accesos y backups', detalle: 'Inventario de accesos y respaldos, para no depender de una sola persona.', prio: 'baja', cl: ['Inventario de accesos', 'Backups programados'] },
];

const SCORE_PRIO: Record<Prio, number> = { alta: 85, media: 62, baja: 37, futuro: 12 };
const estadoDe = (p: number): 'por_hacer' | 'en_curso' | 'hecho' => (p >= 100 ? 'hecho' : p > 0 ? 'en_curso' : 'por_hacer');

/**
 * Siembra el board por defecto (proyectos + tareas) SOLO si el cliente todavía no
 * tiene ninguno. Idempotente: re-chequea antes de insertar. Si `esMauricio`, marca
 * hechas las tareas que él ya tiene armadas. Devuelve las categorías creadas.
 */
export async function seedTodoBoardSiVacio(esMauricio = false): Promise<Categoria[]> {
  const supabase = await getTenantDb();
  const [{ data: cats0, error: e1 }, { data: tar0, error: e2 }] = await Promise.all([
    supabase.from('tarea_categorias').select('id').limit(1),
    supabase.from('experimento_tareas').select('id').limit(1),
  ]);
  if (e1) throw new Error(`seedTodoBoard(select cat): ${e1.message}`);
  if (e2) throw new Error(`seedTodoBoard(select tar): ${e2.message}`);
  if ((cats0 && cats0.length) || (tar0 && tar0.length)) return []; // ya arrancó su plan → no tocar

  // 1) Proyectos (categorías).
  const now = Date.now();
  const histCat: HistEntry[] = [{ id: 'seedcat', ts: now, actor: 'ia', text: 'MaKo creó el proyecto' }];
  const filasCat = SEED_CATEGORIAS.map((c) => ({ nombre: c.nombre, color: c.color, emoji: c.emoji, prioridad: c.prioridad, detalle: c.detalle, historial: histCat }));
  const { data: catsIns, error: eIns } = await supabase.from('tarea_categorias').insert(filasCat).select('*');
  if (eIns) throw new Error(`seedTodoBoard(insert cat): ${eIns.message}`);
  const creadas = (catsIns ?? []) as unknown as Categoria[];
  // key → id (mismo orden de inserción que SEED_CATEGORIAS).
  const idPorKey = new Map<string, number>();
  SEED_CATEGORIAS.forEach((c, i) => { const row = creadas[i]; if (row) idPorKey.set(c.key, row.id); });

  // 2) Tareas de arranque. Las nuevas entran arriba (orden negativo, item 0 el más arriba).
  const n = SEED_TAREAS.length;
  const filasTar = SEED_TAREAS.map((t, i) => {
    const catId = idPorKey.get(t.cat);
    const hecho = !!(esMauricio && t.mDone);
    const progreso = hecho ? 100 : 0;
    const checklist: ChecklistItem[] = t.cl.map((text, k) => ({ id: `sc${i}_${k}`, text, done: hecho }));
    const hist: HistEntry[] = [{ id: `seedt${i}`, ts: now, actor: 'ia', text: 'MaKo creó la tarjeta' }];
    if (hecho) hist.unshift({ id: `seedd${i}`, ts: now, actor: 'ia', text: 'Marcada como completada (ya estaba hecha)' });
    return {
      titulo: t.titulo, detalle: t.detalle, estado: estadoDe(progreso), prioridad: t.prio,
      progreso, deadline: null, categorias: catId != null ? [catId] : [], checklist, historial: hist,
      en_prioridad: false, score: SCORE_PRIO[t.prio], origen: 'mako', retro_id: null, experimento_id: null,
      orden: i - n, hecho_at: hecho ? new Date(now).toISOString() : null, updated_at: new Date(now).toISOString(),
    };
  });
  const { error: eTar } = await supabase.from('experimento_tareas').insert(filasTar);
  if (eTar) throw new Error(`seedTodoBoard(insert tar): ${eTar.message}`);

  return creadas;
}
