// =============================================================================
// mako-tools — registro de herramientas del "doer" de MaKo (v1: solo LECTURA)
// =============================================================================
// Define los ToolDef (el esquema que ve Claude) + un runTool que rutea cada
// herramienta a la lib correspondiente. TODO lo de esta v1 es de LECTURA y pasa
// por getTenantDb (scopeado al workspace del usuario), así que es SEGURO: MaKo
// puede *consultar* datos reales (leads, WhatsApp, reuniones, conocimiento,
// experimentos) para responder con hechos en vez de inventar — pero no puede
// enviar ni escribir nada. Los tools de "proponer" (borradores) se agregan en la
// próxima fase, y ahí sí van gateados (envio-flags / dueño / cola de borradores).
//
// Importante (del relevamiento del doer): los primitivos send/write de las libs
// NO se auto-gatean. Por eso acá SOLO enganchamos funciones de lectura; cuando
// sumemos escrituras irán por los callers ya gateados, nunca por el send* pelado.

import 'server-only';
import { getTenantDb, getWorkspaceActual, getWorkspace } from './workspace';
import type { ToolDef, ToolRunner } from './anthropic';
import { listCategorias, listTareas } from './todo';
import { estaPendiente } from './todo-estados';
import {
  listLeads, getLead, getLeadRespuestas, estadoMadurezLead, labelMadurez,
  normalizarTelefono, type Lead,
} from './leads';
import { getFunnelDefault } from './funnels';
import { searchKnowledge, formatKnowledge } from './mako-knowledge';
import { resumenExperimentos } from './experimentos';
import { contactoIdPorTelefono, contactoEnInboxWA, getContactMessages } from './chatwoot';
import { buscarReunionesAutomatico } from './auto-reuniones';
import { tzActual } from './timezone';
import { analisisNegocio } from './analisis-negocio';
import { analisisAMarkdown } from './analisis-modelo';
import { reporteMetricas, metricasAMarkdown } from './metricas-negocio';
import { linkApp } from './app-url';
import { tableroDeCapa } from './tablero-de-capa';

// ── helpers de entrada ────────────────────────────────────────────────────────

function num(input: Record<string, unknown>, key: string): number | null {
  const v = input[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}
function str(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === 'string' ? v : '';
}

async function requireLead(input: Record<string, unknown>): Promise<Lead> {
  const id = num(input, 'leadId');
  if (id == null) throw new Error('Falta leadId (número). Primero usa buscar_leads para ubicarlo.');
  const lead = await getLead(id);
  if (!lead) throw new Error(`No existe un lead con id ${id} en este workspace.`);
  return lead;
}

/** Resumen compacto de un lead (para no gastar tokens de más en el tool_result). */
function resumenLead(l: Lead) {
  return {
    id: l.id, nombre: l.nombre, empresa: l.empresa, telefono: l.telefono, email: l.email,
    estado: l.estado_lead, etapa: l.pipeline_stage ?? null,
    madurez: labelMadurez(estadoMadurezLead(l)).label,
    fecha_agenda: l.fecha_agenda, fecha_junta_1: l.fecha_junta_1, fecha_junta_2: l.fecha_junta_2,
    asistio_j1: l.asistio_j1, asistio_j2: l.asistio_j2, calificado: l.calificado,
    fecha_cierre: l.fecha_cierre, monto_cierre_usd: l.monto_cierre_usd, motivo_perdida: l.motivo_perdida,
    origen: l.meta_campaign_name ?? l.utm_campaign ?? l.origen_lead ?? null,
    closer: l.closer ?? null, setter: l.setter ?? null,
  };
}

// ── esquema de las herramientas (lo que ve Claude) ────────────────────────────

export const MAKO_TOOLS: ToolDef[] = [
  {
    name: 'buscar_leads',
    description: 'Busca leads del negocio por nombre, teléfono, email o empresa. Devuelve una lista compacta (id, nombre, estado, etapa). Usa el id que devuelve con las otras herramientas.',
    input_schema: {
      type: 'object',
      properties: { texto: { type: 'string', description: 'Texto a buscar en nombre / teléfono / email / empresa.' } },
      required: ['texto'],
    },
  },
  {
    name: 'ficha_lead',
    description: 'Ficha 360 de un lead: datos, estado comercial, fechas de reuniones y sus respuestas de calificación (R1/R2).',
    input_schema: {
      type: 'object',
      properties: { leadId: { type: 'number', description: 'id del lead (de buscar_leads).' } },
      required: ['leadId'],
    },
  },
  {
    name: 'historial_whatsapp',
    description: 'Últimos mensajes de WhatsApp (oficial) con un lead. Sirve para entender el tono real de la conversación, las objeciones y por qué se enfrió.',
    input_schema: {
      type: 'object',
      properties: {
        leadId: { type: 'number', description: 'id del lead (de buscar_leads).' },
        limite: { type: 'number', description: 'cuántos mensajes traer (default 25, máx 80).' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'reuniones_lead',
    description: 'Reuniones/llamadas encontradas automáticamente para el lead (Calendly y grabaciones de Fathom de la R1/R2). NO incluye la agenda de Google: si el negocio agenda en Google, lo muestra reuniones_agenda_lead.',
    input_schema: {
      type: 'object',
      properties: { leadId: { type: 'number', description: 'id del lead (de buscar_leads).' } },
      required: ['leadId'],
    },
  },
  {
    name: 'buscar_tutorial',
    description: 'Busca un tutorial EN VIDEO (YouTube) sobre algo que está FUERA de MaKo: instalar el píxel de Meta en su propia web, configurar Vercel/WordPress, crear un Business Manager, etc. Úsala SIEMPRE que te pidan un "cómo se hace" de una herramienta de terceros, en vez de escribir el paso a paso tú. Devuelve título, canal, año y link — pásaselos tal cual, no reescribas el link.',
    input_schema: {
      type: 'object',
      properties: { tema: { type: 'string', description: 'Qué tutorial buscar, en español y concreto. Ej: "instalar pixel de meta en landing page".' } },
      required: ['tema'],
    },
  },
  {
    name: 'buscar_conocimiento',
    description: 'Busca en la metodología y el conocimiento cargado de MaKo (RAG). Úsalo antes de dar una recomendación para apoyarte en el método real del negocio, no en generalidades.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Qué buscar en el conocimiento.' },
        area: { type: 'string', enum: ['mensajes', 'ads', 'general'], description: 'Opcional, para acotar el área.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'estado_experimentos',
    description: 'Verdades ya validadas por los experimentos del negocio (que MaKo SÍ puede afirmar) y lo que sigue en prueba. No requiere parámetros.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'ver_funnel',
    description: 'La estructura del funnel / proceso comercial del negocio (etapas configuradas en /funnel): el pipeline activo en orden, más las etapas de nutrición y de descarte. Úsalo para razonar con las etapas reales del negocio (no un embudo genérico) antes de opinar sobre en qué etapa está un lead o cómo debería avanzar. No requiere parámetros.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'reuniones_recientes',
    description: 'Las reuniones (R1/R2) más recientes del negocio, ordenadas por fecha, con el lead, si asistió y si ya tiene la grabación de Fathom cargada. Úsalo cuando te pregunten por "la última llamada/reunión" o "cómo me fue" SIN darte un nombre: identificas la reunión, sacas el leadId y después miras el detalle con ficha_lead / reuniones_lead. También sirve para ver qué reunión pasada le falta cargar el Fathom.',
    input_schema: {
      type: 'object',
      properties: { dias: { type: 'number', description: 'ventana hacia atrás en días (default 21, máx 90).' } },
    },
  },
  {
    name: 'metricas_negocio',
    description: 'Los NÚMEROS del negocio por período: inversión e impresiones de Meta, visitas al landing, plays del VSL, leads nuevos, agendas, reuniones 1 y 2 (programadas, realizadas, no-show y sin marcar), cierres e ingreso — agregados por día, semana o mes. Úsalo SIEMPRE que te pregunten cómo va el negocio, si algo mejoró o empeoró, cuánto se invirtió, o te pidan comparar dos períodos. NUNCA contestes de memoria una pregunta sobre resultados: los números están aquí.',
    input_schema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'YYYY-MM-DD. Si no lo pasas, son los últimos 90 días.' },
        hasta: { type: 'string', description: 'YYYY-MM-DD. Si no lo pasas, es hoy.' },
        grano: { type: 'string', enum: ['dia', 'semana', 'mes'], description: 'Cómo agrupar. Default: mes.' },
      },
    },
  },
  {
    name: 'analisis_negocio',
    description: 'EL ANÁLISIS COMPLETO de un período, no solo los números: la cascada de costos (cuánto cuesta una agenda, una asistencia, un calificado y un cliente), las tasas de cada escalón, cuántos de los que asistieron ni siquiera calificaban y qué contestaron, el ranking de creativos por costo y cuáles esconde el ranking por cantidad, y —si le pasas una meta de cierres— cuántas agendas y cuánta inversión hacen falta. Úsalo cuando te pidan un diagnóstico, una revisión del período, «cómo venimos», o antes de recomendar dónde poner el presupuesto. Trae sus propias advertencias: léelas y pásalas, porque dicen qué números NO son confiables todavía.',
    input_schema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'YYYY-MM-DD. Default: últimos 90 días.' },
        hasta: { type: 'string', description: 'YYYY-MM-DD. Default: hoy.' },
        cierres_objetivo: { type: 'number', description: 'Cuántos cierres al mes quiere el dueño. Solo si te lo dijo: es una DECISIÓN suya, no la deduzcas.' },
        presupuesto_propuesto: { type: 'number', description: 'El presupuesto que se está proponiendo, en la moneda de la cuenta. Sirve para detectar si el plan se contradice.' },
      },
    },
  },
  {
    name: 'ver_plan',
    description: 'Muestra el PLAN/tablero del negocio: los proyectos y las tareas ABIERTAS (con su id). Úsalo ANTES de agregar tareas al plan (proponer_tareas_plan) para: (1) asignar cada tarea a un proyecto que YA existe en vez de preguntar; (2) crear un proyecto nuevo solo si de verdad no encaja ninguno; (3) DETECTAR si una tarea que te piden YA existe (título parecido) → NO la dupliques: avisa que ya está, pasa su id y ofrece enriquecerla. No requiere parámetros.',
    input_schema: { type: 'object', properties: {} },
  },
];

// ── ejecutor: enruta cada herramienta a su lib (todo lectura, tenant-scoped) ───

export const runMakoTool: ToolRunner = async (name, input) => {
  switch (name) {
    case 'buscar_leads': {
      const q = str(input, 'texto').trim().toLowerCase();
      if (!q) return 'Pasa un texto para buscar.';
      const leads = await listLeads();
      const hits = leads
        .filter((l) => `${l.nombre ?? ''} ${l.email ?? ''} ${l.empresa ?? ''} ${l.telefono ?? ''} ${l.telefono_normalizado ?? ''}`.toLowerCase().includes(q))
        .slice(0, 20)
        .map(resumenLead);
      return JSON.stringify({ encontrados: hits.length, leads: hits });
    }

    case 'ficha_lead': {
      const lead = await requireLead(input);
      const respuestas = await getLeadRespuestas(lead).catch(() => ({ R1: [], R2: [] }));
      return JSON.stringify({ lead: resumenLead(lead), respuestas });
    }

    case 'historial_whatsapp': {
      const lead = await requireLead(input);
      const tel = normalizarTelefono(lead.telefono);
      if (!tel) return `El lead ${lead.nombre} no tiene teléfono cargado.`;
      const contactId = await contactoIdPorTelefono(tel);
      if (contactId == null) return `No encontré una conversación de WhatsApp para ${lead.nombre} (${tel}).`;
      if (!(await contactoEnInboxWA(contactId))) return 'Ese contacto no está en el inbox de WhatsApp de este workspace.';
      const limite = Math.max(1, Math.min(80, num(input, 'limite') ?? 25));
      const mensajes = (await getContactMessages(contactId))
        .filter((m) => m.messageType === 0 || m.messageType === 1 || m.messageType === 3)
        .slice(-limite)
        .map((m) => ({
          // messageType 3 es una PLANTILLA, y la manda el negocio: con `saliente`
          // (solo el 1) salían como del lead las plantillas de la nutrición.
          de: m.messageType === 0 ? 'lead' : m.messageType === 3 ? 'negocio (plantilla)' : 'negocio',
          texto: m.texto ?? (m.adjuntos.length ? '(adjunto)' : ''),
          estado: m.status,
        }));
      return JSON.stringify({ lead: lead.nombre, telefono: tel, mensajes });
    }

    case 'reuniones_lead': {
      const lead = await requireLead(input);
      // Sin Google Calendar: esto lo lee un modelo (lib/agenda-sin-ia.ts).
      const r = await buscarReunionesAutomatico(lead, { conGoogle: false }).catch(() => null);
      // Llamadas analizadas por Closing Analyst → su recording_id sirve para el deep
      // link /closing?call=<id> (MaKo puede mandar el link al análisis completo).
      let analisis: Array<Record<string, unknown>> = [];
      try {
        const db = await getTenantDb();
        const q = await db.from('closing_analyses')
          .select('recording_id, tipo, score, outcome_tone')
          .eq('lead_id', lead.id).eq('category', 'venta').order('started_at', { ascending: true });
        analisis = (q.data ?? []) as Array<Record<string, unknown>>;
      } catch { /* noop */ }
      if (!r && !analisis.length) return `No pude buscar reuniones para ${lead.nombre} en este momento.`;
      return JSON.stringify({ ...(r ?? {}), analisis_llamadas: analisis });
    }

    case 'buscar_tutorial': {
      const tema = str(input, 'tema').trim();
      if (!tema) return 'Pasa el tema del tutorial.';
      const { buscarTutorial, textoTutorial } = await import('./tutorial-video');
      const vids = await buscarTutorial(tema);
      // El texto lo arma el CÓDIGO: el link de un video son 11 caracteres al azar
      // y ya sabemos cómo termina un dato exacto que pasa por un modelo. Va con
      // canal y año a propósito — MaKo no vio ese video y no puede presentarlo
      // como oficial; decir de quién es le deja al cliente con qué juzgarlo.
      return textoTutorial(vids, tema);
    }

    case 'buscar_conocimiento': {
      const query = str(input, 'query').trim();
      if (!query) return 'Pasa una consulta.';
      const area = str(input, 'area').trim();
      const items = await searchKnowledge(query, 5, area ? { area } : {});
      return formatKnowledge(items) || 'No encontré nada relevante en el conocimiento cargado.';
    }

    case 'estado_experimentos': {
      const t = await resumenExperimentos().catch(() => '');
      return t || 'No hay experimentos registrados todavía.';
    }

    case 'ver_funnel': {
      // DEFAULT: la herramienta pinta el funnel DEL NEGOCIO. Con varios va a tener
      // que listar los N y decir cuál es el default, nunca elegir por índice.
      const funnel = await getFunnelDefault().catch(() => null);
      if (!funnel?.stages?.length) return 'No hay un funnel configurado todavía.';
      const banda = (b: 'pipeline' | 'nutricion' | 'salidas') => funnel.stages
        .filter((s) => (s.band ?? 'pipeline') === b)
        .sort((a, c) => (a.col ?? 0) - (c.col ?? 0))
        .map((s) => (b === 'pipeline' && s.kind ? { key: s.key, label: s.label, tipo: s.kind } : { key: s.key, label: s.label }));
      return JSON.stringify({ activo: banda('pipeline'), nutricion: banda('nutricion'), descartado: banda('salidas') });
    }

    case 'reuniones_recientes': {
      const dias = Math.max(1, Math.min(90, num(input, 'dias') ?? 21));
      const desde = Date.now() - dias * 86_400_000;
      const hasta = Date.now() + 7 * 86_400_000; // incluye las próximas 1 semana
      const leads = await listLeads();
      // La hora va en la zona del WORKSPACE, no en la del dueño: MaKo le repite
      // este dato al cliente por WhatsApp, y con Tijuana fijo a un negocio en
      // Montevideo le anunciaba su reunión 4 h antes. Se resuelve UNA vez para
      // todo el listado, no por fila.
      const tz = await tzActual();
      type R = { leadId: number; nombre: string | null; empresa: string | null; reunion: 'R1' | 'R2'; fecha: string; hora: string | null; asistio: boolean | null; ya_paso: boolean; tiene_fathom: boolean };
      const rs: R[] = [];
      for (const l of leads) {
        const juntas: Array<{ r: 'R1' | 'R2'; fecha: string | null; at: string | null; asis: boolean | null }> = [
          { r: 'R1', fecha: l.fecha_junta_1, at: l.junta_1_at, asis: l.asistio_j1 },
          { r: 'R2', fecha: l.fecha_junta_2, at: l.junta_2_at, asis: l.asistio_j2 },
        ];
        const fathom = ((l.fathom_links ?? []) as Array<{ url?: string }>).some((f) => f.url);
        for (const j of juntas) {
          if (!j.fecha) continue;
          const ms = j.at ? Date.parse(j.at) : Date.parse(`${j.fecha}T12:00:00`);
          if (!Number.isFinite(ms) || ms < desde || ms > hasta) continue;
          rs.push({
            leadId: l.id, nombre: l.nombre, empresa: l.empresa, reunion: j.r, fecha: j.fecha,
            hora: j.at ? new Date(j.at).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: tz }) : null,
            asistio: j.asis, ya_paso: Number.isFinite(ms) ? Date.now() >= ms + 60 * 60_000 : false,
            tiene_fathom: fathom,
          });
        }
      }
      rs.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
      if (!rs.length) return `No encontré reuniones en los últimos ${dias} días ni en la próxima semana.`;
      return JSON.stringify(rs.slice(0, 15));
    }

    case 'metricas_negocio': {
      const r = await reporteMetricas({
        desde: str(input, 'desde') || null,
        hasta: str(input, 'hasta') || null,
        grano: (str(input, 'grano') || 'mes') as 'dia' | 'semana' | 'mes',
      });
      // Markdown y no JSON: es lo que el modelo lee mejor y cuesta menos tokens
      // que las llaves. Y las advertencias viajan con la tabla, que es el punto.
      return metricasAMarkdown(r);
    }

    case 'analisis_negocio': {
      const a = await analisisNegocio({
        desde: str(input, 'desde') || null,
        hasta: str(input, 'hasta') || null,
        cierresObjetivo: num(input, 'cierres_objetivo'),
        presupuestoPropuesto: num(input, 'presupuesto_propuesto'),
      });
      return analisisAMarkdown(a);
    }

    case 'ver_plan': {
      // El super-admin tiene el board de la agencia (plan_tareas) y sus links van a
      // /plan/agencia. Los clientes van a la base (todo.ts) y sus links a /plan.
      // Incluimos el link armado para que MaKo lo copie tal cual.
      // ⚠️ Se decide por CAPA, no por número: OWNER_WS (1) es Mauricio, un CLIENTE, y
      // con `ws === OWNER_WS` el ws 1 leía un plan_tareas vacío con links que lo
      // redirigían, mientras el super-admin (capa 'superadmin', hoy el 9) leía la base
      // de tareas de cliente.
      const ws = await getWorkspaceActual();
      const esDueno = ws != null && tableroDeCapa((await getWorkspace(ws))?.capa) === 'dueno';
      const rutaPlan = esDueno ? '/plan/agencia' : '/plan';
      // Con el `ws` de dos líneas arriba: estos dos links los pega MaKo en un WhatsApp y
      // abren el tablero, que es una pantalla de inquilino.
      const linkTarea = (id: string) => linkApp(`${rutaPlan}?tarea=${id}`, ws);
      const linkProy = (id: string) => linkApp(`${rutaPlan}?proyecto=${id}`, ws);
      if (esDueno) {
        // El board del dueño ya vive en la DB (mig 0093), no en la foto de localStorage:
        // leemos plan_tareas EN VIVO. Los `id` son los reales del board → sirven para
        // deep-links y para proponer eliminar/enriquecer sin ambigüedad.
        const { listPlanBoard } = await import('@/lib/plan-board');
        const b = await listPlanBoard();
        const abiertas = b.tareas.filter((t) => t.progress < 100);
        if (!b.proyectos.length && !abiertas.length) return 'El plan del dueño está vacío todavía. No veo proyectos: propón uno y crea la tarea ahí.';
        const nombreProy = new Map(b.proyectos.map((p) => [p.id, p.name]));
        return JSON.stringify({
          proyectos: b.proyectos.map((p) => ({ id: p.id, nombre: p.name, link: linkProy(p.id) })),
          tareas_abiertas: abiertas.slice(0, 300).map((t) => ({ id: t.id, num: t.num, titulo: t.title, proyecto: nombreProy.get(t.labels[0]) ?? '', link: linkTarea(t.id) })),
        });
      }
      const [cats, tareas] = await Promise.all([listCategorias().catch(() => []), listTareas().catch(() => [])]);
      const catById = new Map(cats.map((c) => [c.id, c.nombre]));
      return JSON.stringify({
        proyectos: cats.map((c) => ({ id: String(c.id), nombre: c.nombre, link: linkProy(String(c.id)) })),
        tareas_abiertas: tareas.filter((t) => estaPendiente(t.estado)).slice(0, 300).map((t) => ({ id: String(t.id), titulo: t.titulo, proyecto: catById.get(t.categorias[0]) ?? '', link: linkTarea(String(t.id)) })),
      });
    }

    default:
      return { content: `Herramienta desconocida: ${name}`, isError: true };
  }
};
