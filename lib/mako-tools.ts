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
import type { ToolDef, ToolRunner } from './anthropic';
import {
  listLeads, getLead, getLeadRespuestas, estadoMadurezLead, labelMadurez,
  normalizarTelefono, getFunnel, type Lead,
} from './leads';
import { searchKnowledge, formatKnowledge } from './mako-knowledge';
import { resumenExperimentos } from './experimentos';
import { contactoIdPorTelefono, contactoEnInboxWA, getContactMessages } from './chatwoot';
import { buscarReunionesAutomatico } from './auto-reuniones';

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
  if (id == null) throw new Error('Falta leadId (número). Primero usá buscar_leads para ubicarlo.');
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
    description: 'Busca leads del negocio por nombre, teléfono, email o empresa. Devuelve una lista compacta (id, nombre, estado, etapa). Usá el id que devuelve con las otras herramientas.',
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
    description: 'Reuniones/llamadas encontradas automáticamente para el lead (Calendly, Google Calendar y grabaciones de Fathom de la R1/R2).',
    input_schema: {
      type: 'object',
      properties: { leadId: { type: 'number', description: 'id del lead (de buscar_leads).' } },
      required: ['leadId'],
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
];

// ── ejecutor: enruta cada herramienta a su lib (todo lectura, tenant-scoped) ───

export const runMakoTool: ToolRunner = async (name, input) => {
  switch (name) {
    case 'buscar_leads': {
      const q = str(input, 'texto').trim().toLowerCase();
      if (!q) return 'Pasá un texto para buscar.';
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
          de: m.saliente ? 'negocio' : 'lead',
          texto: m.texto ?? (m.adjuntos.length ? '(adjunto)' : ''),
          estado: m.status,
        }));
      return JSON.stringify({ lead: lead.nombre, telefono: tel, mensajes });
    }

    case 'reuniones_lead': {
      const lead = await requireLead(input);
      const r = await buscarReunionesAutomatico(lead).catch(() => null);
      if (!r) return `No pude buscar reuniones para ${lead.nombre} en este momento.`;
      return JSON.stringify(r);
    }

    case 'buscar_conocimiento': {
      const query = str(input, 'query').trim();
      if (!query) return 'Pasá una consulta.';
      const area = str(input, 'area').trim();
      const items = await searchKnowledge(query, 5, area ? { area } : {});
      return formatKnowledge(items) || 'No encontré nada relevante en el conocimiento cargado.';
    }

    case 'estado_experimentos': {
      const t = await resumenExperimentos().catch(() => '');
      return t || 'No hay experimentos registrados todavía.';
    }

    case 'ver_funnel': {
      const funnel = await getFunnel().catch(() => null);
      if (!funnel?.stages?.length) return 'No hay un funnel configurado todavía.';
      const banda = (b: 'pipeline' | 'nutricion' | 'salidas') => funnel.stages
        .filter((s) => (s.band ?? 'pipeline') === b)
        .sort((a, c) => (a.col ?? 0) - (c.col ?? 0))
        .map((s) => (b === 'pipeline' && s.kind ? { key: s.key, label: s.label, tipo: s.kind } : { key: s.key, label: s.label }));
      return JSON.stringify({ activo: banda('pipeline'), nutricion: banda('nutricion'), descartado: banda('salidas') });
    }

    default:
      return { content: `Herramienta desconocida: ${name}`, isError: true };
  }
};
