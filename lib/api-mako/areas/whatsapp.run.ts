// =============================================================================
// api-mako/areas/whatsapp.run — los cuerpos del área `whatsapp`
// =============================================================================
// Un runner por id de whatsapp.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }
// y { proponer } para la que tiene pantalla propia (el borrador → /whatsapp). Todo
// corre adentro de runWithWorkspace(ctx.ws): las libs que scopean con getTenantDb
// scopean solas. Nunca se escribe desde leer() ni desde preparar().
//
// ⚠️ EL CANAL OFICIAL SIN CONECTAR NO ES «VACÍO». Las rutas de /api/whatsapp
// contestan `{ ok:true, contactos:[] }` cuando el workspace no tiene Chatwoot, y un
// agente lo lee como «no tienes conversaciones». Aquí se contesta un error que lo dice.
//
// ⚠️ contactoEnInboxWA ES EL ÚNICO GUARD DE AISLAMIENTO DEL CANAL OFICIAL: un
// contactId llega crudo y sin ese chequeo se lee o se escribe cualquier contacto de
// la cuenta de Chatwoot (otros inboxes incluidos). Toda operación por contactId lo pasa.
// =============================================================================

import 'server-only';
import type { Ejecutado, Preparado, Runners } from '../tipos';
import { runMakoTool } from '@/lib/mako-tools';
import { APP_BASE_URL } from '@/lib/app-url';
import { integracionConectada } from '@/lib/credenciales';
import { getLead, moverLeadAuto, type Lead } from '@/lib/leads';
import {
  getContactMessages, contactoEnInboxWA, contactoIdPorTelefono, markContactRead, blockContact,
  ensureContactoWhatsapp, chatwootConfigurado, estadoWebhookChatwoot, repararWebhookChatwoot,
} from '@/lib/chatwoot';
import {
  listDrafts, getDraft, upsertDraft, deleteDraft, enviarBorradorAMeta, listMetaTemplates, editTemplate,
  markDraftPendingByName, deleteMetaTemplate, deleteDraftByName, reconcileDrafts,
  type TemplateDraft, type TemplateCategoria, type TemplateParam,
} from '@/lib/meta-templates';
import { validarPlantilla } from '@/lib/template-validator';
import { VARIABLES_LEAD, valoresVariablesLead, aplicarVariables, explicarRechazo } from '@/lib/template-vars';
import { evolutionConfigurado, getInstanciaRow, estadoWebhook, repararWebhook } from '@/lib/evolution';
import { getConversacionesNoOficial, buscarLeadsComoPlaceholders, sincronizarChat, borrarChat } from '@/lib/evolution-mensajes';
import { listBorradores, contarBorradores, crearBorrador, descartarBorrador } from '@/lib/evolution-envio';
import { bloquearContacto, desbloquearContacto, ocultarContacto, mostrarContacto } from '@/lib/evolution-block';
import { getCatalogoLabels, getMapeoEtapaLabels, setMapeoEtapaLabel, sincronizarCatalogoLabels, actualizarEtiquetaLead } from '@/lib/evolution-labels';
import { ETAPAS_FUNNEL } from '@/lib/wa-etapas';
import { insisteConLoMismo } from '@/lib/conversacion-repeticion';
import { listSessions, getSessionMessages } from '@/lib/chart-chats';
import { recomendarMensajes, redactarTemplate } from '@/lib/whatsapp-advisor';
import { envioWhatsappHabilitado, setEnvioWhatsapp } from '@/lib/envio-flags';
import {
  bandejaOficial, derivarEtapa, estadoEmpresaMedido, plantillasAprobadas, estadoEnvio, ultimos10,
  registrosPorUltimos10, leadsPorUltimos10, chatEmpresaPorUltimos10, contarParaBorrar, mensajesEspejoRecientes,
  borradorPendiente, borradorPendienteIgual, type ChatEmpresa,
} from './whatsapp.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

type In = Record<string, unknown>;

const json = (o: unknown): string => JSON.stringify(o);
const fallo = (content: string) => ({ content, isError: true });
const num = (i: In, k: string): number | null => (typeof i[k] === 'number' && Number.isFinite(i[k]) ? (i[k] as number) : null);
const str = (i: In, k: string): string => (typeof i[k] === 'string' ? (i[k] as string).trim() : '');
const corto = (s: string | null | undefined, n: number): string | null => (s == null ? null : s.length > n ? `${s.slice(0, n)}…` : s);
const isoDeEpoch = (s: number | null | undefined): string | null => (s ? new Date(s * 1000).toISOString() : null);
const digitos = (s: string): string => s.replace(/\D/g, '');

const NO_OFICIAL = 'El WhatsApp oficial (Chatwoot) no está conectado en este negocio: no es que no haya conversaciones, es que no hay canal oficial. Se conecta en Integraciones.';
const NO_EMPRESA = 'Este negocio no tiene vinculado el número de empresa (WhatsApp por QR). Se vincula en la tab WhatsApp.';
const NO_ES_DE_ESTE_INBOX = 'Ese contacto no está en el inbox de WhatsApp de este negocio.';

async function leadDeEsteWs(id: number | null): Promise<Lead | null> {
  return id == null ? null : getLead(id);
}

async function empresaVinculada(): Promise<boolean> {
  return evolutionConfigurado() && !!(await getInstanciaRow());
}

const MIN_10 = 'Pasa el teléfono con al menos 10 dígitos (con lada): con menos, los dígitos pueden coincidir con otra persona.';
const OCULTO = 'Ese chat está oculto: MaKo no lo lee.';

/** Los 10 dígitos de un chatJid o teléfono del número de empresa; null si es un @lid o tiene menos de 10. */
function ult10DeChat(entrada: string): string | null {
  const e = entrada.trim();
  if (e.endsWith('@lid')) return null;
  const d = digitos(e.split('@')[0]);
  return d.length >= 10 ? d.slice(-10) : null;
}

/** ¿Hay algún registro de oculto para esos 10 dígitos? Por sufijo, más amplio que el inbox: para lo privado, mejor de más. */
async function estaOcultoEmpresa(ult10: string): Promise<boolean> {
  return (await registrosPorUltimos10('wa_ocultos', ult10)).length > 0;
}

/**
 * Los números EXACTOS que hay que escribir en wa_bloqueados / wa_ocultos para que el
 * bloqueo o el ocultamiento surtan efecto donde se leen (ver whatsapp.helpers): el
 * `telefono` de cada lead con esos 10 dígitos (motor de nutrición), el teléfono del
 * espejo (inbox) y, para ocultar, el `telefono_normalizado` (placeholders del inbox).
 * Si no hay ni lead ni conversación, el que se pasó.
 */
async function numerosExactos(ult10: string, entrada: string, para: 'bloqueo' | 'oculto') {
  const [leads, chat] = await Promise.all([leadsPorUltimos10(ult10), chatEmpresaPorUltimos10(ult10)]);
  const set = new Set<string>();
  for (const l of leads) {
    const t = digitos(l.telefono ?? '');
    if (t.slice(-10) === ult10) set.add(t);
    const n = digitos(l.telefono_normalizado ?? '');
    if (para === 'oculto' && n.slice(-10) === ult10) set.add(n);
  }
  for (const t of chat?.telefonos ?? []) set.add(t);
  const sinDestino = set.size === 0;
  if (sinDestino) set.add(digitos(entrada));
  return { numeros: [...set], leads, chat, sinDestino };
}

type ChatResuelto = { jid: string; ult10: string | null; chat: ChatEmpresa | null };

/** Resuelve un chatJid o teléfono del número de empresa contra el espejo. `exigirChat`: falla si el espejo no tiene esa conversación. */
async function resolverChatEmpresa(entrada: string, exigirChat: boolean): Promise<ChatResuelto | { error: string }> {
  const e = entrada.trim();
  if (e.endsWith('@lid')) {
    if (exigirChat) return { error: 'Ese chat no tiene teléfono (es un @lid): pasa el teléfono con lada.' };
    return { jid: e, ult10: null, chat: null };
  }
  const ult10 = ult10DeChat(e);
  if (!ult10) return { error: MIN_10 };
  const chat = await chatEmpresaPorUltimos10(ult10);
  if (!chat && exigirChat) return { error: `No hay ninguna conversación con un teléfono terminado en ${ult10} en el espejo del número de empresa.` };
  return { jid: chat?.chatJid ?? `${digitos(e.split('@')[0])}@s.whatsapp.net`, ult10, chat };
}

/** Los campos de plantilla del input, con los defaults de la ruta de borradores. */
function plantillaDeInput(i: In, base?: TemplateDraft | null): TemplateDraft {
  const params = Array.isArray(i.params)
    ? (i.params as In[]).map((p) => ({ name: String(p.name ?? ''), example: String(p.example ?? '') })).filter((p) => p.name) as TemplateParam[]
    : (base?.params ?? []);
  return {
    id: base?.id,
    name: str(i, 'name') || base?.name || '',
    language: str(i, 'language') || base?.language || 'es_MX',
    category: (str(i, 'category') || base?.category || 'marketing') as TemplateCategoria,
    body: str(i, 'body') || base?.body || '',
    header: str(i, 'header') || base?.header || null,
    headerMedia: base?.headerMedia ?? null,
    footer: str(i, 'footer') || base?.footer || null,
    buttons: base?.buttons ?? [],
    params,
    status: base?.status ?? 'borrador',
    etapa: str(i, 'etapa') || base?.etapa || null,
  };
}

const NOMBRE_META = /^[a-z0-9_]{1,512}$/;

/** Variables del cuerpo sin su entrada en `params` (Meta rechaza una variable sin ejemplo). */
function variablesSinEjemplo(d: TemplateDraft): string[] {
  const enBody = [...new Set([...d.body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]))];
  return enBody.filter((v) => !d.params.some((p) => p.name === v && p.example.trim()));
}

// ── runners ──────────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  // ── Lecturas: oficial ──────────────────────────────────────────────────────
  historial_whatsapp: { leer: (input) => runMakoTool('historial_whatsapp', input) },

  listar_conversaciones_whatsapp_oficial: {
    leer: async (input) => {
      if (!(await integracionConectada('whatsapp'))) return fallo(NO_OFICIAL);
      const paginas = num(input, 'paginas') ?? 2;
      const limite = num(input, 'limite') ?? 30;
      const { conversacionesLeidas, grupos } = await bandejaOficial(paginas);
      let lista = grupos;
      if (input.soloSinResponder === true) lista = lista.filter((g) => g.ultimoEntrante);
      if (input.soloVentanaAbierta === true) lista = lista.filter((g) => g.ventanaAbierta);
      const ahora = Date.now() / 1000;
      const personas = lista.slice(0, limite).map((g) => {
        // La ventana vence 24 h después del último mensaje DEL LEAD. Si el último es
        // nuestro, Chatwoot no da ese momento en el listado: null, no «vence ya».
        const vence = g.ventanaAbierta && g.ultimoEntrante ? g.ultimaActividad + 86400 : null;
        const etapa = g.lead ? derivarEtapa(g.lead) : null;
        return {
          contactId: g.contactId, contacto: g.contacto, telefono: g.telefono,
          lead_id: g.lead?.id ?? null, lead_nombre: g.lead?.nombre ?? null, empresa: g.lead?.empresa ?? null,
          estado_lead: g.lead?.estado_lead ?? null, etapa_inbox: etapa?.key ?? null,
          ultimo_es_del_lead: g.ultimoEntrante, ultimo_mensaje: corto(g.ultimoMensaje, 160),
          ultima_actividad: isoDeEpoch(g.ultimaActividad),
          ventana_24h_abierta: g.ventanaAbierta, ventana_vence: vence ? isoDeEpoch(vence) : null,
          ventana_vence_en_horas: vence ? Math.round(((vence - ahora) / 3600) * 10) / 10 : null,
          bloqueado: g.bloqueado, conversaciones_en_chatwoot: g.convs,
        };
      });
      return json({
        leido: { paginas_chatwoot: paginas, conversaciones: conversacionesLeidas, personas: grupos.length },
        devueltas: personas.length, quedaron_afuera_por_limite: Math.max(0, lista.length - personas.length),
        nota: 'Solo las páginas más recientes de Chatwoot: una persona sin actividad reciente puede no estar. ventana_vence null con ventana abierta = el último mensaje es del negocio y no se sabe cuándo escribió el lead. etapa_inbox no es la etapa del funnel. No hay contador de no leídos: el de Chatwoot viene siempre en 0 en este canal y no significa nada; lo que dice si falta contestar es ultimo_es_del_lead.',
        personas,
      });
    },
  },

  hilo_contacto_whatsapp_oficial: {
    leer: async (input) => {
      if (!(await integracionConectada('whatsapp'))) return fallo(NO_OFICIAL);
      const contactId = num(input, 'contactId') ?? 0;
      if (!(await contactoEnInboxWA(contactId))) return fallo(NO_ES_DE_ESTE_INBOX);
      const limite = num(input, 'limite') ?? 40;
      // messageType, no `saliente`: las plantillas (3) y las actividades del sistema
      // (2) también son «no entrantes», y nuestro marketing no es la voz del lead.
      const utiles = (await getContactMessages(contactId)).filter((m) => m.messageType === 0 || m.messageType === 1 || m.messageType === 3);
      const mensajes = utiles.slice(-limite).map((m) => ({
        fecha: isoDeEpoch(m.fecha),
        de: m.messageType === 0 ? 'lead' : m.messageType === 3 ? 'negocio_plantilla' : 'negocio',
        texto: corto(m.texto, 1500) ?? (m.adjuntos.length ? '(adjunto)' : ''),
        plantilla: m.template, estado: m.status, error_meta: m.error,
        adjuntos: m.adjuntos.length ? m.adjuntos.map((a) => a.tipo) : undefined,
      }));
      return json({
        contactId, total: utiles.length, devueltos: mensajes.length, omitidos_mas_viejos: utiles.length - mensajes.length,
        nota: 'Junta TODAS las conversaciones del contacto en la cuenta de Chatwoot: si también escribió por otro canal (Instagram, email, web), esos mensajes vienen mezclados. No deduzcas la ventana de 24 h de aquí: está en listar_conversaciones_whatsapp_oficial.',
        mensajes,
      });
    },
  },

  contacto_chatwoot_por_telefono: {
    leer: async (input) => {
      if (!(await integracionConectada('whatsapp'))) return fallo(NO_OFICIAL);
      const tel = digitos(str(input, 'telefono'));
      if (tel.length < 8) return fallo('El teléfono necesita al menos 8 dígitos.');
      const id = await contactoIdPorTelefono(tel);
      if (id == null) return json({ encontrado: false, telefono: tel });
      if (!(await contactoEnInboxWA(id))) return json({ encontrado: false, telefono: tel, nota: 'Hay un contacto con ese teléfono en la cuenta de Chatwoot, pero no en el inbox de WhatsApp de este negocio.' });
      return json({ encontrado: true, contactId: id, telefono: tel, nota: 'No lo guardes: resuélvelo de nuevo la próxima vez.' });
    },
  },

  // ── Lecturas: plantillas ───────────────────────────────────────────────────
  listar_plantillas_aprobadas: {
    leer: async () => {
      if (!(await integracionConectada('whatsapp'))) return fallo(NO_OFICIAL);
      const r = await plantillasAprobadas();
      return json({ fuente: r.fuente, total: r.plantillas.length, plantillas: r.plantillas });
    },
  },

  listar_borradores_plantilla: {
    leer: async (input) => {
      const drafts = await listDrafts({ status: str(input, 'status') || undefined, etapa: str(input, 'etapa') || undefined });
      return json({
        total: drafts.length,
        nota: 'El estado es el guardado: se actualiza con reconciliar_plantillas. El estado en vivo está en estado_plantillas_meta.',
        borradores: drafts.map((d) => ({
          id: d.id, name: d.name, language: d.language, category: d.category, status: d.status, etapa: d.etapa ?? null,
          body: d.body, header: d.header ?? null, footer: d.footer ?? null, encabezado_multimedia: d.headerMedia?.format ?? null,
          botones: d.buttons.length, params: d.params,
          motivo_rechazo: d.status === 'rejected' ? explicarRechazo(d.rejection_reason) : null,
          meta_template_id: d.meta_template_id ?? null, actualizado: d.updated_at ?? null,
        })),
      });
    },
  },

  estado_plantillas_meta: {
    leer: async (input) => {
      if (!(await integracionConectada('whatsapp'))) return fallo(NO_OFICIAL);
      let metas;
      try { metas = await listMetaTemplates(); } catch (e) { return fallo(`Meta no respondió al listar las plantillas (${e instanceof Error ? e.message : 'error'}). Vuelve a intentarlo en unos minutos.`); }
      const st = str(input, 'status');
      const lista = st ? metas.filter((m) => m.status === st) : metas;
      return json({
        total: lista.length, tope: 'Meta devuelve hasta 200 plantillas por consulta.',
        plantillas: lista.map((m) => ({
          name: m.name, language: m.language, category: m.category, status: m.status, body: m.body,
          header: m.header, header_formato: m.headerFormat, footer: m.footer, params: m.params, botones: m.buttons.length,
          motivo_rechazo: m.status === 'rejected' ? explicarRechazo(m.rejectedReason) : null,
        })),
      });
    },
  },

  validar_plantilla: {
    leer: async (input) => {
      const id = num(input, 'id');
      let draft: TemplateDraft | null;
      if (id != null) {
        draft = await getDraft(id);
        if (!draft) return fallo(`No existe el borrador de plantilla #${id} en este negocio.`);
      } else {
        draft = plantillaDeInput(input);
        if (!draft.name || !draft.body) return json({ ok: false, error: 'Pasa el id de un borrador, o name y body de la plantilla.', faltan: ['name', 'body'].filter((k) => !str(input, k)) });
      }
      return json(await validarPlantilla(draft));
    },
  },

  variables_plantilla: {
    leer: async (input) => {
      const leadId = num(input, 'leadId');
      const lead = await leadDeEsteWs(leadId);
      if (leadId != null && !lead) return fallo(`El lead #${leadId} no existe en este negocio.`);
      const valores = lead ? valoresVariablesLead(lead) : Object.fromEntries(VARIABLES_LEAD.map((v) => [v.key, v.ejemplo]));
      const texto = str(input, 'texto');
      return json({
        variables: VARIABLES_LEAD,
        valores_con: lead ? `lead #${lead.id}` : 'ejemplos',
        valores,
        ...(texto ? { texto_rellenado: aplicarVariables(texto, valores) } : {}),
        nota: 'Solo se reemplazan {{variable}} del catálogo. Los corchetes tipo [tu link] llegan tal cual al lead.',
      });
    },
  },

  // ── Lecturas: estado de canales ────────────────────────────────────────────
  estado_envio_whatsapp: {
    leer: async () => json({ ...(await estadoEnvio()), nota: 'evolutionConectadoSegunFila es el estado guardado, que puede mentir: el dato medido está en estado_canal_whatsapp_empresa. El interruptor gobierna al motor de nutrición, no a lo que una persona manda a mano.' }),
  },

  estado_canal_whatsapp_empresa: {
    leer: async () => json(await estadoEmpresaMedido()),
  },

  salud_webhook_chatwoot: {
    leer: async () => {
      if (!(await chatwootConfigurado())) return json({ configurado: false, nota: NO_OFICIAL });
      const s = await estadoWebhookChatwoot();
      return json({
        configurado: true, estado: s.estado, url_actual: s.urlActual, url_esperada: s.urlEsperada,
        se_arregla_con_reparar_webhook_chatwoot: s.estado === 'no_registrado' || s.estado === 'sin_ruteo',
        nota: s.estado === 'ok' ? 'Las respuestas llegan.' : s.estado === 'ruteo_ocupado' ? 'La cuenta de Chatwoot ya está ruteada a otro negocio: lo resuelve el equipo técnico.' : s.estado === 'secret_prod' || s.estado === 'url_distinta' || s.estado === 'sin_secret' ? 'Es configuración de la plataforma: avisa al equipo técnico.' : 'Revisa el estado.',
      });
    },
  },

  salud_webhook_evolution: {
    leer: async () => {
      if (!(await empresaVinculada())) return json({ vinculado: false, nota: NO_EMPRESA });
      const s = await estadoWebhook();
      return json({
        vinculado: true, estado: s.estado, url_actual: s.urlActual, url_esperada: s.urlEsperada,
        se_arregla_con_reparar_webhook_evolution: s.estado === 'no_registrado',
        nota: s.estado === 'ok' ? 'El espejo recibe los mensajes.' : s.estado === 'no_registrado' ? 'La instancia no tiene el webhook: se arregla con reparar_webhook_evolution.' : 'Es configuración de la plataforma o Evolution no respondió: avisa al equipo técnico.',
      });
    },
  },

  // ── Lecturas: empresa ──────────────────────────────────────────────────────
  listar_conversaciones_whatsapp_empresa: {
    leer: async (input) => {
      const limite = num(input, 'limite') ?? 40;
      // Sin ocultos, siempre: ocultar es justamente sacar un chat personal de lo que
      // lee MaKo. (Con `true`, getConversacionesNoOficial devuelve SOLO los ocultos.)
      const todas = await getConversacionesNoOficial(600, false);
      let lista = todas;
      if (input.soloSinResponder === true) lista = lista.filter((c) => c.ultimoEntrante);
      const etapa = str(input, 'etapa');
      if (etapa) lista = lista.filter((c) => c.etapaKey === etapa);
      const conversaciones = lista.slice(0, limite).map((c) => ({
        chatJid: c.chatJid, telefono: c.telefono, nombre: c.nombre, lead_id: c.leadId, empresa: c.empresa,
        etapa_inbox: c.etapaKey, ultimo_mensaje: corto(c.ultimoTexto, 160), ultimo_tipo: c.ultimoTipo,
        ultima_fecha: c.ultimaFecha, ultimo_es_del_lead: c.ultimoEntrante, mensajes_en_espejo: c.total, bloqueado: c.bloqueado,
      }));
      return json({
        leidas: todas.length, devueltas: conversaciones.length, quedaron_afuera_por_limite: Math.max(0, lista.length - conversaciones.length),
        nota: 'Del espejo de MaKo (hasta los 20.000 mensajes más recientes y 600 conversaciones), no en vivo. etapa_inbox no es la etapa del funnel.',
        conversaciones,
      });
    },
  },

  hilo_whatsapp_empresa: {
    leer: async (input) => {
      const r = await resolverChatEmpresa(str(input, 'chatJid'), false);
      if ('error' in r) return fallo(r.error);
      if (r.ult10 && (await estaOcultoEmpresa(r.ult10))) return fallo(OCULTO);
      const limite = num(input, 'limite') ?? 50;
      // Se piden de más porque después se descartan los vacíos (reacciones sin texto).
      const { total, filas } = await mensajesEspejoRecientes(r.jid, r.ult10, limite + 50);
      const utiles = filas.filter((m) => (m.texto ?? '').trim() || (m.tipo && m.tipo !== 'text'));
      const mensajes = utiles.slice(-limite).map((m) => ({
        fecha: m.wa_timestamp, de: m.from_me ? 'negocio' : 'lead', tipo: m.tipo, texto: corto(m.texto, 1500), estado: m.status,
      }));
      return json({
        chatJid: r.jid, telefonos_en_espejo: r.chat?.telefonos ?? [], nombre: r.chat?.nombre ?? null,
        mensajes_en_espejo: total, devueltos: mensajes.length, omitidos_mas_viejos: Math.max(0, total - mensajes.length),
        ...(mensajes.length === 0 ? { nota: 'No hay mensajes en el espejo para este chat. Si debería haber, propone sincronizar_chat_whatsapp_empresa.' } : {}),
        mensajes,
      });
    },
  },

  buscar_lead_para_whatsapp_empresa: {
    leer: async (input) => {
      const q = str(input, 'q');
      if (q.length < 2) return fallo('La búsqueda necesita al menos 2 caracteres.');
      const r = await buscarLeadsComoPlaceholders(q, num(input, 'limite') ?? 10);
      return json({ total: r.length, leads: r.map((c) => ({ lead_id: c.leadId, nombre: c.nombre, empresa: c.empresa, telefono: c.telefono, chatJid: c.chatJid, etapa_inbox: c.etapaKey })) });
    },
  },

  listar_borradores_whatsapp_empresa: {
    leer: async () => {
      const [lista, pendientes] = await Promise.all([listBorradores(), contarBorradores()]);
      return json({
        pendientes, devueltos: lista.length,
        ...(pendientes > lista.length ? { advertencia: `Hay ${pendientes} pendientes y se listan los ${lista.length} más viejos.` } : {}),
        url_bandeja: `${APP_BASE_URL}/whatsapp?canal=empresa`,
        borradores: lista.map((b) => ({ id: b.id, lead_id: b.leadId, lead_nombre: b.leadNombre, telefono: b.telefono, texto: corto(b.texto, 800), origen: b.origen, secuencia_id: b.secuenciaId, paso: b.paso, creado: b.createdAt })),
      });
    },
  },

  contacto_bloqueado_whatsapp_empresa: {
    leer: async (input) => {
      const d = ultimos10(str(input, 'telefono'));
      if (d.length < 10) return fallo(MIN_10);
      const [bloq, ocul, leads, chat] = await Promise.all([
        registrosPorUltimos10('wa_bloqueados', d), registrosPorUltimos10('wa_ocultos', d), leadsPorUltimos10(d), chatEmpresaPorUltimos10(d),
      ]);
      // La MISMA regla que las lecturas: el motor mira el `telefono` EXACTO de cada lead
      // y el inbox el teléfono EXACTO del espejo. Un registro con otro formato no frena nada.
      const porLead = leads.map((l) => {
        const t = digitos(l.telefono ?? '');
        return { lead_id: l.id, nombre: l.nombre, telefono_que_mira_el_motor: t || null, nutricion_bloqueada: t ? bloq.includes(t) : null };
      });
      const conTel = porLead.filter((l) => l.nutricion_bloqueada != null);
      return json({
        telefono_ultimos10: d,
        registros_bloqueo: bloq, registros_oculto: ocul,
        bloqueado_para_nutricion: conTel.length ? conTel.every((l) => l.nutricion_bloqueada) : null,
        bloqueado_en_inbox: chat ? chat.telefonos.some((t) => bloq.includes(t)) : null,
        oculto_en_inbox: chat ? chat.telefonos.some((t) => ocul.includes(t)) : null,
        leads: porLead,
        nota: 'null = no hay lead con teléfono (la nutrición no tiene a quién escribirle) o no hay conversación en el espejo. Un registro guardado con otro formato del número no frena nada: si registros_bloqueo trae algo y bloqueado_para_nutricion es false, propone bloquear_contacto_whatsapp_empresa de nuevo.',
      });
    },
  },

  listar_etiquetas_whatsapp: {
    leer: async () => {
      const [labels, mapeo] = await Promise.all([getCatalogoLabels(), getMapeoEtapaLabels()]);
      const nombre = new Map(labels.map((l) => [l.labelId, l.name]));
      return json({
        etiquetas: labels,
        etapas: [...ETAPAS_FUNNEL, { key: 'manual', label: 'Nutrición - Manual' }].map((e) => ({ etapa: e.key, label: e.label, labelId: mapeo[e.key] ?? null, etiqueta: mapeo[e.key] ? (nombre.get(mapeo[e.key]) ?? '(no está en el catálogo)') : null })),
        nota: 'Catálogo guardado, no leído del celular: si falta una etiqueta, propone sincronizar_etiquetas_whatsapp.',
      });
    },
  },

  etapa_inbox_de_lead: {
    leer: async (input) => {
      const lead = await leadDeEsteWs(num(input, 'leadId'));
      if (!lead) return fallo(`El lead #${String(input.leadId)} no existe en este negocio.`);
      const et = lead.pipeline_stage === 'manual' ? { key: 'manual', label: 'Nutrición - Manual' } : derivarEtapa(lead);
      return json({ lead_id: lead.id, nombre: lead.nombre, etapa_inbox: et, etapa_funnel_pipeline_stage: lead.pipeline_stage ?? null, estado_lead: lead.estado_lead, nota: 'etapa_inbox es la derivación fija que muestran las bandejas de WhatsApp; la etapa del funnel es pipeline_stage (o la que calcula el CRM). Pueden no coincidir.' });
    },
  },

  lead_insiste_con_lo_mismo: {
    leer: async (input) => {
      const mensajes = Array.isArray(input.mensajesDelLead) ? (input.mensajesDelLead as string[]) : [];
      const veces = num(input, 'veces') ?? 3;
      return json({ insiste: insisteConLoMismo(mensajes, veces), umbral_veces: veces, mensajes_evaluados: mensajes.length });
    },
  },

  historial_asesoria_whatsapp: {
    leer: async (input) => {
      const d = ultimos10(str(input, 'telefono'));
      if (d.length < 10) return fallo('Pasa el teléfono con al menos 10 dígitos: la sesión se identifica por los últimos 10.');
      const [sesion] = await listSessions(`wa-advisor:p${d}`);
      if (!sesion) return json({ sesion: null, mensajes: [], nota: 'Todavía no hubo asesoría sobre este contacto.' });
      const todos = await getSessionMessages(sesion.id);
      const mensajes = todos.slice(-30).map((m) => ({ de: m.role === 'user' ? 'equipo' : 'mako', texto: corto(m.content, 2000), fecha: m.created_at ?? null }));
      return json({ sesion: { id: sesion.id, titulo: sesion.titulo, actualizada: sesion.updated_at }, total: todos.length, devueltos: mensajes.length, mensajes });
    },
  },

  recomendar_mensajes_whatsapp: {
    leer: async (input) => {
      if (!(await integracionConectada('whatsapp')) && (await getInstanciaRow().catch(() => null))?.estado !== 'conectado') {
        return fallo('WhatsApp no está conectado en este negocio (ni el oficial ni el número de empresa).');
      }
      const mensajes = (Array.isArray(input.mensajes) ? (input.mensajes as In[]) : []).map((m) => ({ saliente: m.saliente === true, texto: typeof m.texto === 'string' ? m.texto : null }));
      const r = await recomendarMensajes({
        contacto: str(input, 'contacto'), empresa: str(input, 'empresa') || null, etapaLabel: str(input, 'etapaLabel') || null,
        ventanaAbierta: input.ventanaAbierta === true, mensajes,
      });
      return json({ ...r, nota: 'Son sugerencias: nada se mandó. Para dejar una en la cola, propone crear_borrador_whatsapp_empresa.' });
    },
  },

  redactar_plantilla_con_mako: {
    leer: async (input) => json({ ...(await redactarTemplate(str(input, 'objetivo'), str(input, 'etapa'))), nota: 'No se guardó. Para guardarla propone guardar_borrador_plantilla (las variables van en params con name y example).' }),
  },

  // ── Acciones por chat ──────────────────────────────────────────────────────
  marcar_leido_whatsapp_oficial: {
    preparar: async (input): Promise<Preparado> => {
      if (!(await integracionConectada('whatsapp'))) return { error: NO_OFICIAL };
      const contactId = num(input, 'contactId') ?? 0;
      if (!(await contactoEnInboxWA(contactId))) return { error: NO_ES_DE_ESTE_INBOX };
      return { payload: { contactId }, resumen: `Marcar como leídas en Chatwoot las conversaciones del contacto #${contactId} (solo el contador interno de Chatwoot; la bandeja de la app no cambia).` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const contactId = Number(payload.contactId);
      if (!(await contactoEnInboxWA(contactId))) return { ok: false, resumen: NO_ES_DE_ESTE_INBOX };
      await markContactRead(contactId);
      return { ok: true, resumen: `Conversaciones del contacto #${contactId} marcadas como leídas.` };
    },
  },

  crear_contacto_chatwoot_lead: {
    preparar: async (input): Promise<Preparado> => {
      if (!(await integracionConectada('whatsapp'))) return { error: NO_OFICIAL };
      const lead = await leadDeEsteWs(num(input, 'leadId'));
      if (!lead) return { error: `El lead #${String(input.leadId)} no existe en este negocio.` };
      const tel = digitos(lead.telefono_normalizado ?? lead.telefono ?? '');
      if (tel.length < 8) return { error: `El lead ${lead.nombre} no tiene un teléfono válido cargado.` };
      const ya = await contactoIdPorTelefono(tel);
      if (ya != null && (await contactoEnInboxWA(ya))) return { error: `${lead.nombre} ya tiene su chat en el WhatsApp oficial (contacto #${ya}).` };
      return { payload: { leadId: lead.id, nombre: lead.nombre, telefono: tel }, resumen: `Crear el chat de ${lead.nombre} (${tel}) en la bandeja del WhatsApp oficial, sin mandarle nada.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = await ensureContactoWhatsapp(String(payload.nombre ?? ''), String(payload.telefono ?? ''));
      return id == null
        ? { ok: false, resumen: 'Chatwoot no pudo crear el contacto; revisa que el WhatsApp oficial siga conectado.' }
        : { ok: true, resumen: `${String(payload.nombre)} ya aparece en la bandeja oficial (contacto #${id}).`, datos: { contactId: id } };
    },
  },

  reparar_webhook_chatwoot: {
    preparar: async (): Promise<Preparado> => {
      if (!(await chatwootConfigurado())) return { error: NO_OFICIAL };
      const s = await estadoWebhookChatwoot();
      if (s.estado === 'ok') return { error: 'El webhook del WhatsApp oficial ya está bien: no hay nada que reparar.' };
      if (s.estado !== 'no_registrado' && s.estado !== 'sin_ruteo') return { error: `El estado es «${s.estado}» y no se arregla re-registrando: avisa al equipo técnico.` };
      return { payload: {}, resumen: `Registrar de nuevo el webhook de Chatwoot hacia MaKo (hoy: ${s.estado}).` };
    },
    ejecutar: async (): Promise<Ejecutado> => {
      const r = await repararWebhookChatwoot();
      return { ok: r.ok, resumen: r.ok ? 'Webhook del WhatsApp oficial registrado y verificado.' : `No quedó bien (${r.estado}): ${r.error ?? 'sin detalle'}.` };
    },
  },

  reparar_webhook_evolution: {
    preparar: async (): Promise<Preparado> => {
      if (!(await empresaVinculada())) return { error: NO_EMPRESA };
      const s = await estadoWebhook();
      if (s.estado === 'ok') return { error: 'El espejo del número de empresa ya está bien: no hay nada que reparar.' };
      if (s.estado !== 'no_registrado') return { error: `El estado es «${s.estado}» y no se arregla re-registrando: avisa al equipo técnico.` };
      return { payload: {}, resumen: 'Registrar de nuevo el webhook que copia los mensajes del número de empresa a MaKo.' };
    },
    ejecutar: async (): Promise<Ejecutado> => {
      const r = await repararWebhook();
      return { ok: r.ok, resumen: r.ok ? 'Espejo del número de empresa registrado y verificado.' : `No quedó bien (${r.estado}): ${r.error ?? 'sin detalle'}.` };
    },
  },

  descartar_borrador_whatsapp_empresa: {
    preparar: async (input): Promise<Preparado> => {
      const id = num(input, 'id') ?? 0;
      const b = await borradorPendiente(id);
      if (!b) return { error: `No hay un borrador pendiente #${id} en este negocio (ya se mandó, se descartó o no existe).` };
      return { payload: { id: b.id }, resumen: `Descartar el borrador #${b.id} para ${b.leadNombre ?? b.telefono}: «${corto(b.texto, 120)}».` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      // ⚠️ descartarBorrador hace un update SIN `.eq('estado','pendiente')`: esta
      // relectura achica la carrera con un envío, no la cierra (deuda de
      // lib/evolution-envio.ts). Y después se confirma que quedó descartado.
      if (!(await borradorPendiente(id))) return { ok: false, resumen: `El borrador #${id} ya no está pendiente.` };
      await descartarBorrador(id);
      if (await borradorPendiente(id)) return { ok: false, resumen: `El borrador #${id} sigue pendiente: no se pudo descartar.` };
      return { ok: true, resumen: `Borrador #${id} descartado.` };
    },
  },

  sincronizar_chat_whatsapp_empresa: {
    preparar: async (input): Promise<Preparado> => {
      if (!(await empresaVinculada())) return { error: NO_EMPRESA };
      const r = await resolverChatEmpresa(str(input, 'chatJid'), false);
      if ('error' in r) return { error: r.error };
      if (!r.ult10) return { error: 'Ese chat no tiene teléfono (es un @lid): pasa el teléfono con lada.' };
      if (await estaOcultoEmpresa(r.ult10)) return { error: OCULTO };
      const quien = r.chat ? `${r.chat.nombre ?? r.chat.telefonos[0]} (${r.chat.telefonos.join(' / ')}, ${r.chat.mensajes} mensajes ya en el espejo)` : `${r.jid.split('@')[0]} (todavía sin mensajes en el espejo)`;
      return { payload: { chatJid: r.jid }, resumen: `Traer al espejo la historia del chat de ${quien} desde el número de empresa.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const jid = String(payload.chatJid);
      const u = ult10DeChat(jid);
      if (u && (await estaOcultoEmpresa(u))) return { ok: false, resumen: OCULTO };
      const r = await sincronizarChat(jid);
      return { ok: true, resumen: r.mensajes ? `Se trajeron ${r.mensajes} mensajes (los que ya estaban no se duplican).` : 'Evolution no devolvió mensajes para ese chat.', datos: r };
    },
  },

  sincronizar_etiquetas_whatsapp: {
    preparar: async (): Promise<Preparado> => {
      if (!(await empresaVinculada())) return { error: NO_EMPRESA };
      return { payload: {}, resumen: 'Refrescar el catálogo de etiquetas desde el celular del número de empresa.' };
    },
    ejecutar: async (): Promise<Ejecutado> => {
      const labels = await sincronizarCatalogoLabels();
      return labels.length
        ? { ok: true, resumen: `Catálogo actualizado: ${labels.length} etiquetas.` }
        : { ok: false, resumen: 'No llegó ninguna etiqueta: o el celular no tiene, o Evolution no respondió (la lectura no distingue).' };
    },
  },

  mapear_etapa_etiqueta_whatsapp: {
    preparar: async (input): Promise<Preparado> => {
      const etapa = str(input, 'etapa');
      const labelId = str(input, 'labelId');
      if (!labelId) return { payload: { etapa, labelId: null }, resumen: `Quitar la etiqueta automática de la etapa «${etapa}».` };
      const label = (await getCatalogoLabels()).find((l) => l.labelId === labelId);
      if (!label) return { error: `La etiqueta «${labelId}» no está en el catálogo. Revisa listar_etiquetas_whatsapp o propone sincronizar_etiquetas_whatsapp.` };
      return { payload: { etapa, labelId }, resumen: `Poner la etiqueta «${label.name ?? labelId}» a los leads que entren en la etapa «${etapa}».` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      await setMapeoEtapaLabel(String(payload.etapa), payload.labelId ? String(payload.labelId) : null);
      return { ok: true, resumen: payload.labelId ? `Etapa «${String(payload.etapa)}» asociada a la etiqueta.` : `Etapa «${String(payload.etapa)}» sin etiqueta automática.` };
    },
  },

  aplicar_etiqueta_lead_whatsapp: {
    preparar: async (input): Promise<Preparado> => {
      if (!(await empresaVinculada())) return { error: NO_EMPRESA };
      const lead = await leadDeEsteWs(num(input, 'leadId'));
      if (!lead) return { error: `El lead #${String(input.leadId)} no existe en este negocio.` };
      if (!lead.telefono_normalizado) return { error: `${lead.nombre} no tiene teléfono cargado.` };
      if (!Object.keys(await getMapeoEtapaLabels()).length) return { error: 'No hay ninguna etapa asociada a una etiqueta: primero propone mapear_etapa_etiqueta_whatsapp.' };
      return { payload: { leadId: lead.id }, resumen: `Dejar en el chat de ${lead.nombre} la etiqueta de su etapa actual.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      await actualizarEtiquetaLead(Number(payload.leadId));
      return { ok: true, resumen: 'Pedido a WhatsApp. Es de mejor esfuerzo: si el número estaba caído, la etiqueta no cambia y no hay aviso.' };
    },
  },

  borrar_borrador_plantilla: {
    preparar: async (input): Promise<Preparado> => {
      const d = await getDraft(num(input, 'id') ?? 0);
      if (!d?.id) return { error: `No existe el borrador de plantilla #${String(input.id)} en este negocio.` };
      if (d.status !== 'borrador') return { error: `«${d.name}» ya se mandó a Meta (estado ${d.status}): borrarla es borrar_plantilla_meta, que se revisa en pantalla.` };
      return { payload: { id: d.id }, resumen: `Borrar el borrador de plantilla «${d.name}» (nunca se mandó a Meta).` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const d = await getDraft(Number(payload.id));
      if (!d) return { ok: false, resumen: 'Ese borrador ya no existe.' };
      if (d.status !== 'borrador') return { ok: false, resumen: `«${d.name}» se mandó a Meta después de proponerlo: no se borró.` };
      await deleteDraft(Number(payload.id));
      return { ok: true, resumen: `Borrador «${d.name}» borrado.` };
    },
  },

  reconciliar_plantillas: {
    preparar: async (): Promise<Preparado> => {
      if (!(await integracionConectada('whatsapp'))) return { error: NO_OFICIAL };
      return { payload: {}, resumen: 'Traer de Meta el estado real de las plantillas en revisión o rechazadas y guardarlo.' };
    },
    ejecutar: async (): Promise<Ejecutado> => {
      const cambios = await reconcileDrafts();
      return { ok: true, resumen: cambios ? `${cambios} plantillas cambiaron de estado.` : 'Ninguna cambió: el estado guardado coincide con Meta.', datos: { cambios } };
    },
  },

  // ── Acciones en pantalla ───────────────────────────────────────────────────
  crear_borrador_whatsapp_empresa: {
    proponer: async (input) => {
      if (!(await empresaVinculada())) return { error: NO_EMPRESA };
      const texto = str(input, 'texto');
      const leadId = num(input, 'leadId');
      const lead = await leadDeEsteWs(leadId);
      if (leadId != null && !lead) return { error: `El lead #${leadId} no existe en este negocio.` };
      const telLead = lead ? digitos(lead.telefono_normalizado ?? lead.telefono ?? '') : '';
      const telInput = digitos(str(input, 'telefono'));
      if (lead && telInput && telLead && telInput.slice(-10) !== telLead.slice(-10)) {
        return { error: `El teléfono que pasaste no coincide con el de ${lead.nombre} en el CRM. Pasa solo el leadId.` };
      }
      const tel = telLead || telInput;
      if (tel.length < 10) return { error: lead ? `${lead.nombre} no tiene un teléfono con lada cargado en el CRM.` : 'Falta el destinatario: pasa leadId o un teléfono con lada (al menos 10 dígitos).' };
      const u10 = tel.slice(-10);
      if ((await registrosPorUltimos10('wa_bloqueados', u10)).length) return { error: 'Ese teléfono está bloqueado en el número de empresa: no se propone mensaje.' };
      // El link NO lleva un jid inventado: si el espejo tiene la conversación, se abre
      // ESA; si no, la cola. EmpresaInbox, con un ?chat= que no está en su lista, abre
      // la primera conversación: la de OTRA persona, al lado del borrador.
      const chat = await chatEmpresaPorUltimos10(u10);
      const url = chat ? `${APP_BASE_URL}/whatsapp?canal=empresa&chat=${encodeURIComponent(chat.chatJid)}` : `${APP_BASE_URL}/whatsapp?canal=empresa`;
      // crearBorrador sin inscripción inserta a secas: un reintento apilaría el mismo
      // mensaje dos veces. Un borrador idéntico pendiente es LA propuesta.
      const igual = await borradorPendienteIgual(u10, texto);
      if (igual != null) return { id: String(igual), url, nueva: false };
      // ⚠️ crearBorrador devuelve void y se traga el error del insert (deuda de
      // lib/evolution-envio.ts): se relee, y si no está, NO se dice que quedó.
      await crearBorrador({ leadId: lead?.id ?? null, telefono: tel, texto, chatJid: chat?.chatJid ?? `${tel}@s.whatsapp.net`, origen: 'mako' });
      const creado = await borradorPendienteIgual(u10, texto);
      if (creado == null) return { error: 'No pude dejar el borrador en la cola. No se envió nada.' };
      return { id: String(creado), url, nueva: true, extra: { para: lead?.nombre ?? tel, nota: 'Quedó en la cola de borradores de /whatsapp: una persona lo manda con un clic. No se envió nada.' } };
    },
    ejecutar: async () => ({ ok: false, resumen: 'Este borrador se manda desde la cola de borradores de /whatsapp, no por aquí.' }),
  },

  bloquear_contacto_whatsapp_oficial: {
    preparar: async (input): Promise<Preparado> => {
      if (!(await integracionConectada('whatsapp'))) return { error: NO_OFICIAL };
      const contactId = num(input, 'contactId') ?? 0;
      if (!(await contactoEnInboxWA(contactId))) return { error: NO_ES_DE_ESTE_INBOX };
      const bloquear = input.bloquear === true;
      const leadId = num(input, 'leadId');
      const lead = await leadDeEsteWs(leadId);
      if (leadId != null && !lead) return { error: `El lead #${leadId} no existe en este negocio.` };
      if (lead) {
        // Sin este cruce, un leadId equivocado bloquea al contacto X y DESCALIFICA al lead Y.
        const tel = digitos(lead.telefono_normalizado ?? lead.telefono ?? '');
        const suyo = tel.length >= 10 ? await contactoIdPorTelefono(tel) : null;
        if (suyo !== contactId) return { error: `El contacto #${contactId} no es el que Chatwoot tiene para el teléfono de ${lead.nombre}${suyo != null ? ` (ese es el #${suyo})` : ''}. Resuélvelo con contacto_chatwoot_por_telefono o no pases leadId.` };
      }
      const motivo = str(input, 'motivo') || 'Bloqueado en WhatsApp';
      const efectoLead = !lead ? '' : bloquear
        ? (lead.estado_lead === 'abierto' ? ` y pasar a ${lead.nombre} a descalificado («${motivo}»)` : ` (${lead.nombre} no está abierto: su etapa no cambia)`)
        : ` (la etapa de ${lead.nombre} no cambia: si estaba descalificado por el bloqueo, se corrige a mano)`;
      return { payload: { contactId, bloquear, leadId: lead?.id ?? null, motivo }, resumen: `${bloquear ? 'Bloquear' : 'Desbloquear'} el contacto #${contactId} en el WhatsApp oficial${efectoLead}.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const contactId = Number(payload.contactId);
      const bloquear = payload.bloquear === true;
      const r = await blockContact(contactId, bloquear);
      if (!r.ok) return { ok: false, resumen: `Chatwoot no lo ${bloquear ? 'bloqueó' : 'desbloqueó'}: ${r.error}` };
      // Solo la rama de BLOQUEAR toca el lead, y solo si está abierto. La ruta de la
      // tab también «resucita» al desbloquear (abierto + borra motivo_perdida) a
      // cualquier descalificado, aunque lo hubieran descalificado por otra razón.
      let movido = false;
      if (bloquear && payload.leadId) {
        const lead = await getLead(Number(payload.leadId));
        if (lead?.estado_lead === 'abierto') movido = await moverLeadAuto(lead.id, 'descal', { canal: 'WhatsApp', motivo: String(payload.motivo ?? 'Bloqueado en WhatsApp'), ...(ctx.actor ? { autor: ctx.actor } : {}) });
      }
      return { ok: true, resumen: `Contacto #${contactId} ${bloquear ? 'bloqueado' : 'desbloqueado'}${movido ? '; el lead quedó descalificado' : ''}.` };
    },
  },

  bloquear_contacto_whatsapp_empresa: {
    preparar: async (input): Promise<Preparado> => {
      const entrada = digitos(str(input, 'telefono'));
      const leadId = num(input, 'leadId');
      const lead = await leadDeEsteWs(leadId);
      if (leadId != null && !lead) return { error: `El lead #${leadId} no existe en este negocio.` };
      const telLead = lead ? digitos(lead.telefono ?? lead.telefono_normalizado ?? '') : '';
      if (lead && telLead.length >= 10 && entrada.length >= 10 && telLead.slice(-10) !== entrada.slice(-10)) return { error: `El teléfono que pasaste no coincide con el de ${lead.nombre} en el CRM.` };
      const base = entrada.length >= 10 ? entrada : telLead;
      if (base.length < 10) return { error: MIN_10 };
      const u10 = base.slice(-10);
      const bloquear = input.bloquear === true;
      if (!bloquear) {
        const registros = await registrosPorUltimos10('wa_bloqueados', u10);
        if (!registros.length) return { error: `No hay ningún bloqueo para un teléfono terminado en ${u10}.` };
        return { payload: { ult10: u10, bloquear: false }, resumen: `Desbloquear en el número de empresa ${registros.length === 1 ? `el ${registros[0]}` : `los registros ${registros.join(', ')}`} (la nutrición vuelve a poder escribirle).` };
      }
      const { numeros, leads, chat, sinDestino } = await numerosExactos(u10, base, 'bloqueo');
      const quien = [...new Set([...leads.map((l) => l.nombre ?? `lead #${l.id}`), ...(chat?.nombre ? [chat.nombre] : [])])];
      const aviso = sinDestino ? ' No hay lead ni conversación con ese número: se guarda tal cual lo pasaste, revisa que tenga la lada correcta.' : '';
      return {
        payload: { ult10: u10, bloquear: true, numeros, leadId: lead?.id ?? leads[0]?.id ?? null, motivo: str(input, 'motivo') || null },
        resumen: `Bloquear en el número de empresa ${quien.length ? `a ${quien.join(' / ')} ` : ''}guardando ${numeros.join(' y ')} (los formatos exactos que miran la nutrición y el inbox): la nutrición deja de escribirle.${aviso}`,
      };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const u10 = String(payload.ult10);
      if (payload.bloquear === true) {
        const numeros = (payload.numeros as string[]) ?? [];
        for (const t of numeros) await bloquearContacto(t, { leadId: (payload.leadId as number | null) ?? null, motivo: (payload.motivo as string | null) ?? undefined, por: ctx.actor });
        // bloquearContacto no devuelve si escribió: se relee.
        const quedaron = await registrosPorUltimos10('wa_bloqueados', u10);
        const faltan = numeros.filter((t) => !quedaron.includes(t));
        return faltan.length
          ? { ok: false, resumen: `No quedó bloqueado ${faltan.join(', ')}: la nutrición le podría seguir escribiendo.` }
          : { ok: true, resumen: `${numeros.join(' y ')} bloqueado en el número de empresa.` };
      }
      const registros = await registrosPorUltimos10('wa_bloqueados', u10);
      for (const t of registros) await desbloquearContacto(t);
      const siguen = await registrosPorUltimos10('wa_bloqueados', u10);
      return siguen.length
        ? { ok: false, resumen: `Sigue bloqueado ${siguen.join(', ')}.` }
        : { ok: true, resumen: registros.length ? `${registros.join(' y ')} desbloqueado en el número de empresa.` : 'Ya no había ningún bloqueo para ese número.' };
    },
  },

  ocultar_contacto_whatsapp_empresa: {
    preparar: async (input): Promise<Preparado> => {
      const entrada = digitos(str(input, 'telefono'));
      const leadId = num(input, 'leadId');
      const lead = await leadDeEsteWs(leadId);
      if (leadId != null && !lead) return { error: `El lead #${leadId} no existe en este negocio.` };
      const telLead = lead ? digitos(lead.telefono_normalizado ?? lead.telefono ?? '') : '';
      if (lead && telLead.length >= 10 && entrada.length >= 10 && telLead.slice(-10) !== entrada.slice(-10)) return { error: `El teléfono que pasaste no coincide con el de ${lead.nombre} en el CRM.` };
      const base = entrada.length >= 10 ? entrada : telLead;
      if (base.length < 10) return { error: MIN_10 };
      const u10 = base.slice(-10);
      const ocultar = input.ocultar === true;
      if (!ocultar) {
        const registros = await registrosPorUltimos10('wa_ocultos', u10);
        if (!registros.length) return { error: `No hay ningún chat oculto con un teléfono terminado en ${u10}.` };
        return { payload: { ult10: u10, ocultar: false }, resumen: `Volver a mostrar en el número de empresa el chat de ${registros.join(' / ')}.` };
      }
      const { numeros, chat, sinDestino } = await numerosExactos(u10, base, 'oculto');
      const aviso = sinDestino ? ' No hay lead ni conversación con ese número: se guarda tal cual lo pasaste, revisa que tenga la lada correcta.' : '';
      return {
        payload: { ult10: u10, ocultar: true, numeros, leadId: lead?.id ?? null },
        resumen: `Ocultar en el número de empresa el chat${chat?.nombre ? ` de ${chat.nombre}` : ''} guardando ${numeros.join(' y ')} (los formatos exactos que mira el inbox).${aviso}`,
      };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const u10 = String(payload.ult10);
      if (payload.ocultar === true) {
        const numeros = (payload.numeros as string[]) ?? [];
        for (const t of numeros) await ocultarContacto(t, { leadId: (payload.leadId as number | null) ?? null, por: ctx.actor });
        const quedaron = await registrosPorUltimos10('wa_ocultos', u10);
        const faltan = numeros.filter((t) => !quedaron.includes(t));
        return faltan.length
          ? { ok: false, resumen: `No quedó oculto ${faltan.join(', ')}.` }
          : { ok: true, resumen: `Chat de ${numeros.join(' / ')} oculto.` };
      }
      const registros = await registrosPorUltimos10('wa_ocultos', u10);
      for (const t of registros) await mostrarContacto(t);
      const siguen = await registrosPorUltimos10('wa_ocultos', u10);
      return siguen.length
        ? { ok: false, resumen: `Sigue oculto ${siguen.join(', ')}.` }
        : { ok: true, resumen: registros.length ? `Chat de ${registros.join(' / ')} visible de nuevo.` : 'Ese chat ya estaba visible.' };
    },
  },

  borrar_chat_whatsapp_empresa: {
    preparar: async (input): Promise<Preparado> => {
      const r = await resolverChatEmpresa(str(input, 'chatJid'), true);
      if ('error' in r) return { error: r.error };
      if (!r.chat || !r.ult10) return { error: 'No encontré esa conversación en el espejo.' };
      const n = await contarParaBorrar(r.ult10);
      if (n.subcadena !== n.sufijo) return { error: `Hay ${n.subcadena - n.sufijo} mensajes de OTRO teléfono que contiene esos dígitos: borrar desde aquí se los llevaría. Bórralo desde la tab WhatsApp.` };
      return {
        payload: { chatJid: r.chat.chatJid, ult10: r.ult10, esperados: n.sufijo },
        resumen: `Borrar del espejo de MaKo los ${n.sufijo} mensajes del chat de ${r.chat.nombre ?? 'un contacto sin nombre'} (${r.chat.telefonos.join(' / ')}) del número de empresa. No se puede deshacer.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const u10 = String(payload.ult10);
      // Se vuelve a contar: entre la propuesta y el «sí» pudo entrar un mensaje de otro
      // teléfono que contiene esos dígitos, y borrarChat filtra por subcadena.
      const n = await contarParaBorrar(u10);
      if (n.subcadena !== n.sufijo) return { ok: false, resumen: 'Ahora hay mensajes de otro teléfono que contienen esos dígitos: no se borró nada.' };
      const borrados = await borrarChat(String(payload.chatJid));
      return { ok: true, resumen: `Se borraron ${borrados} mensajes del espejo.`, datos: { borrados, esperados: payload.esperados } };
    },
  },

  prender_envio_whatsapp: {
    preparar: async (input): Promise<Preparado> => {
      const on = input.on === true;
      const e = await estadoEnvio();
      if (e.envioHabilitado === on) return { error: `El envío real ya está ${on ? 'prendido' : 'apagado'}.` };
      if (on && !e.oficialConectado && !e.evolutionConectadoSegunFila) return { error: 'Primero conecta un número de WhatsApp (oficial o de empresa): sin transporte, prender no manda nada.' };
      return { payload: { on }, resumen: on ? 'PRENDER el envío real de WhatsApp: toda secuencia activa empieza a mandar mensajes de verdad (las plantillas oficiales las cobra Meta).' : 'Apagar el envío real de WhatsApp: el motor de nutrición pasa a simular.' };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const on = payload.on === true;
      if (on) {
        const e = await estadoEnvio();
        if (!e.oficialConectado && !e.evolutionConectadoSegunFila) return { ok: false, resumen: 'Ya no hay ningún número conectado: no se prendió.' };
      }
      await setEnvioWhatsapp(on);
      return { ok: true, resumen: `El chatbot de WhatsApp quedó ${(await envioWhatsappHabilitado()) ? 'PRENDIDO' : 'apagado'}.` };
    },
  },

  guardar_borrador_plantilla: {
    preparar: async (input): Promise<Preparado> => {
      if (!(await integracionConectada('whatsapp'))) return { error: NO_OFICIAL };
      const id = num(input, 'id');
      const base = id != null ? await getDraft(id) : null;
      if (id != null && !base) return { error: `No existe el borrador de plantilla #${id} en este negocio.` };
      if (base && base.status !== 'borrador' && base.status !== 'rejected') return { error: `«${base.name}» está en estado ${base.status} en Meta: se cambia con editar_plantilla_meta.` };
      const d = plantillaDeInput(input, base);
      if (!NOMBRE_META.test(d.name)) return { error: 'El nombre solo admite minúsculas, números y guion bajo.' };
      const sinEjemplo = variablesSinEjemplo(d);
      if (sinEjemplo.length) return { error: `Cada variable del cuerpo necesita su entrada en params con un ejemplo: falta ${sinEjemplo.join(', ')}.`, faltan: ['params'] };
      return { payload: { draft: d }, resumen: `${base ? 'Corregir' : 'Crear'} el borrador de plantilla «${d.name}» (${d.category}, ${d.language}): «${corto(d.body, 200)}».` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const d = await upsertDraft(payload.draft as TemplateDraft);
      return { ok: true, resumen: `Borrador «${d.name}» guardado (#${d.id}). Antes de mandarlo a Meta, valídalo.`, datos: { id: d.id } };
    },
  },

  enviar_plantilla_a_meta: {
    preparar: async (input): Promise<Preparado> => {
      if (!(await integracionConectada('whatsapp'))) return { error: NO_OFICIAL };
      const d = await getDraft(num(input, 'id') ?? 0);
      if (!d?.id) return { error: `No existe el borrador de plantilla #${String(input.id)} en este negocio.` };
      if (d.status !== 'borrador' && d.status !== 'rejected') return { error: `«${d.name}» ya está en estado ${d.status}: no se vuelve a mandar.` };
      return { payload: { id: d.id }, resumen: `Mandar a aprobación de Meta la plantilla «${d.name}» (${d.category}): «${corto(d.body, 200)}».` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const r = await enviarBorradorAMeta(Number(payload.id));
      return r.ok ? { ok: true, resumen: 'Plantilla enviada: queda en revisión de Meta (pending).' } : { ok: false, resumen: `Meta no la recibió: ${r.error ?? 'sin detalle'}.` };
    },
  },

  editar_plantilla_meta: {
    preparar: async (input): Promise<Preparado> => {
      if (!(await integracionConectada('whatsapp'))) return { error: NO_OFICIAL };
      const name = str(input, 'name');
      const language = str(input, 'language') || 'es_MX';
      let metas;
      try { metas = await listMetaTemplates(); } catch { return { error: 'Meta no respondió al buscar la plantilla; vuelve a intentarlo en unos minutos.' }; }
      const m = metas.find((t) => t.name === name && t.language === language);
      if (!m?.metaId) return { error: `No hay una plantilla «${name}» (${language}) entre las ${metas.length} que devolvió Meta${metas.length >= 200 ? ' (Meta devuelve hasta 200 por consulta: si tienes más, puede estar entre las que no se leyeron)' : ''}.` };
      if (m.headerFormat && m.headerFormat !== 'TEXT') return { error: `«${name}» tiene encabezado multimedia: edítala en Chatbot → Plantillas.` };
      const d = plantillaDeInput(input, { name, language, category: m.category as TemplateCategoria, body: m.body, header: m.header, footer: m.footer, buttons: m.buttons, params: [], status: 'approved' });
      const sinEjemplo = variablesSinEjemplo(d);
      if (sinEjemplo.length) return { error: `Cada variable del cuerpo necesita su entrada en params con un ejemplo: falta ${sinEjemplo.join(', ')}.`, faltan: ['params'] };
      return { payload: { metaId: m.metaId, draft: d }, resumen: `Editar en Meta la plantilla «${name}» (hoy ${m.status}); vuelve a revisión y mientras tanto no se puede enviar. Nuevo cuerpo: «${corto(d.body, 200)}».` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const d = payload.draft as TemplateDraft;
      const r = await editTemplate(String(payload.metaId), d);
      if (!r.ok) return { ok: false, resumen: `Meta no aceptó la edición: ${r.error ?? 'sin detalle'}.` };
      await markDraftPendingByName(d.name, d.language).catch(() => {});
      return { ok: true, resumen: `Plantilla «${d.name}» editada: vuelve a revisión de Meta.` };
    },
  },

  borrar_plantilla_meta: {
    preparar: async (input): Promise<Preparado> => {
      if (!(await integracionConectada('whatsapp'))) return { error: NO_OFICIAL };
      const name = str(input, 'name');
      let metas;
      try { metas = await listMetaTemplates(); } catch { return { error: 'Meta no respondió al buscar la plantilla; vuelve a intentarlo en unos minutos.' }; }
      const idiomas = metas.filter((t) => t.name === name).map((t) => `${t.language} (${t.status})`);
      if (!idiomas.length) return { error: `No hay una plantilla «${name}» entre las ${metas.length} que devolvió Meta${metas.length >= 200 ? ' (Meta devuelve hasta 200 por consulta: si tienes más, puede estar entre las que no se leyeron)' : ''}. Si es solo un borrador local, usa borrar_borrador_plantilla.` };
      return { payload: { name }, resumen: `BORRAR de Meta la plantilla «${name}» en todos sus idiomas: ${idiomas.join(', ')}. Los pasos de secuencia que la usan dejan de mandarse. No se puede deshacer.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const name = String(payload.name);
      const r = await deleteMetaTemplate(name);
      if (!r.ok) return { ok: false, resumen: `Meta no la borró: ${r.error ?? 'sin detalle'}. El borrador local no se tocó.` };
      await deleteDraftByName(name);
      return { ok: true, resumen: `Plantilla «${name}» borrada de Meta y de los borradores.` };
    },
  },
};
