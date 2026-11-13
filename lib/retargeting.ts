// =============================================================================
// El retargeting de los funnels sin VSL: lo que toca la base, la IA del negocio, las etiquetas y Meta (13/11/2026).
// =============================================================================
// Los PUERTOS del motor (lib/retargeting-motor.ts) para un negocio de verdad, y lo que usan el cron de los lunes
// (app/api/cron/retargeting-semanal) y la API de MaKo (ver_retargeting, revisar_retargeting, configurar_retargeting,
// pasar_chats_al_crm). Todo se llama ADENTRO de `runWithWorkspace(ws, …)`: la base, los ajustes y la IA son los del negocio.
//
// ⚠️ Lo que NO hace, a propósito (el Cerebro, 13/11/2026):
//   · no crea leads de las charlas que no tienen: las cuenta, y las pasa al CRM sólo cuando el dueño lo pide (`pasarChatsAlCrm`);
//   · no toca Meta sin el interruptor del negocio (`retargeting.config` → `publicosMeta`), apagado por defecto;
//   · no mueve etapas: pone etiquetas sin etapa vinculada, con el lote que no dispara automatizaciones (`ponerEtiquetaLote`).
// =============================================================================

import { getTenantDb, runWithWorkspace } from './workspace';
import { getSetting, setSetting } from './settings';
import { MAKO_SETTER } from './pipeline';
import { revisarCon, vistaDe, type ConfigRT, type EstadoRT, type PuertosRT, type ResultadoRT, type ViaMeta, type VistaRT } from './retargeting-motor';
import { ETIQUETAS, type ChatRT, type LeadRT, type MensajeRT, type SegmentoConEtiqueta } from './retargeting-reglas';
import { crearPorToken, crearPorZernio, idsDeZernio, personasPorToken, personasPorZernio, type Pedido } from './retargeting-meta-pedidos';

export const CLAVE_ESTADO = 'retargeting.estado';
export const CLAVE_CONFIG = 'retargeting.config';
/** Cuánto para atrás se leen las charlas: lo que se movió hace más queda como lo dejó la última revisión. */
const DIAS_DE_CHARLA = 120;
const PAGINA = 1000;
const DIA = 86_400_000;

type Fila = Record<string, unknown>;
const num = (x: unknown): number | null => (x == null || x === '' ? null : Number.isFinite(Number(x)) ? Number(x) : null);
const txt = (x: unknown): string | null => (typeof x === 'string' && x.trim() ? x.trim() : null);
const ultimos10 = (t: unknown) => String(t ?? '').replace(/\D/g, '').slice(-10);

/** Todas las filas de una consulta, de a mil (PostgREST corta en mil sin avisar). */
async function todas(armar: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Fila[]> {
  const out: Fila[] = [];
  for (let desde = 0; desde < 200_000; desde += PAGINA) {
    const { data, error } = await armar(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    const filas = (data ?? []) as Fila[];
    out.push(...filas);
    if (filas.length < PAGINA) break;
  }
  return out;
}

export async function leerConfig(): Promise<ConfigRT> {
  try { const c = JSON.parse((await getSetting(CLAVE_CONFIG)) ?? '{}') as Partial<ConfigRT>; return { publicosMeta: c.publicosMeta === true }; } catch { return { publicosMeta: false }; }
}
async function leerEstado(): Promise<EstadoRT | null> {
  try { const e = JSON.parse((await getSetting(CLAVE_ESTADO)) ?? 'null') as EstadoRT | null; return e?.v === 1 ? e : null; } catch { return null; }
}

/** Los ids de los funnels con VSL: su retargeting es por el píxel, no por la charla. */
async function funnelsVsl(): Promise<Set<number>> {
  const db = await getTenantDb();
  const { data, error } = await db.from('funnels').select('id, canal, plantilla');
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as Fila[]).filter((f) => f.plantilla === 'vsl' || f.canal === 'vsl').map((f) => Number(f.id)));
}

async function leerLeads(): Promise<LeadRT[]> {
  const db = await getTenantDb();
  const vsl = await funnelsVsl();
  const filas = await todas((d, h) => db.from('leads')
    .select('id, nombre, telefono, telefono_normalizado, email, cerro, pipeline_stage, fecha_agenda, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at, total_cobrado_usd, monto_primer_pago, funnel_id')
    .order('id').range(d, h));
  const enVsl = new Set<number>();
  if (vsl.size) {
    const lf = await todas((d, h) => db.from('lead_funnel').select('lead_id, funnel_id').in('funnel_id', [...vsl]).order('id').range(d, h));
    for (const r of lf) enVsl.add(Number(r.lead_id));
  }
  return filas.map((l): LeadRT => {
    const fechas = [l.junta_2_at, l.fecha_junta_2, l.junta_1_at, l.fecha_junta_1, l.fecha_agenda].map(txt).filter((x): x is string => !!x);
    const agenda = fechas.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
    return {
      id: Number(l.id), nombre: txt(l.nombre) ?? '', telefono: txt(l.telefono_normalizado) ?? txt(l.telefono), email: txt(l.email),
      cerro: l.cerro === true ? true : l.cerro === false ? false : null, etapa: txt(l.pipeline_stage),
      cobrado: Math.max(num(l.total_cobrado_usd) ?? 0, num(l.monto_primer_pago) ?? 0) || null, agenda,
      enVsl: enVsl.has(Number(l.id)) || (l.funnel_id != null && vsl.has(Number(l.funnel_id))),
    };
  });
}

const aMensaje = (r: Fila): MensajeRT => ({
  id: Number(r.id), deNegocio: r.from_me === true, at: String(r.wa_timestamp ?? r.created_at ?? ''),
  texto: txt(r.texto) ?? (r.tipo && r.tipo !== 'text' ? `(${String(r.tipo)})` : ''),
});

/** Las charlas de los leads: por `lead_id`, y las que no se enlazaron, por el teléfono. Sin grupos. */
async function leerChats(leads: ReadonlyArray<LeadRT>, ids: number[]): Promise<Map<number, ChatRT>> {
  const db = await getTenantDb();
  const desde = new Date(Date.now() - DIAS_DE_CHARLA * DIA).toISOString();
  const cols = 'id, lead_id, telefono, chat_jid, from_me, tipo, texto, wa_timestamp';
  const porLead = new Map<number, MensajeRT[]>();
  const sumar = (id: number, r: Fila) => { if (String(r.chat_jid ?? '').endsWith('@g.us')) return; porLead.set(id, [...(porLead.get(id) ?? []), aMensaje(r)]); };
  for (let i = 0; i < ids.length; i += 200) {
    const parte = ids.slice(i, i + 200);
    const filas = await todas((d, h) => db.from('wa_mensajes').select(cols).in('lead_id', parte).gt('wa_timestamp', desde).order('id').range(d, h));
    for (const r of filas) sumar(Number(r.lead_id), r);
  }
  // Los que no tienen nada enlazado: por el teléfono (lo que el espejo guardó sin `lead_id`).
  const porTel = new Map<string, number>();
  for (const l of leads) if (ids.includes(l.id) && !porLead.has(l.id) && l.telefono) porTel.set(String(l.telefono).replace(/\D/g, ''), l.id);
  const tels = [...porTel.keys()].filter((t) => t.length >= 8);
  for (let i = 0; i < tels.length; i += 100) {
    const parte = tels.slice(i, i + 100);
    const filas = await todas((d, h) => db.from('wa_mensajes').select(cols).is('lead_id', null).in('telefono', parte).gt('wa_timestamp', desde).order('id').range(d, h));
    for (const r of filas) { const id = porTel.get(String(r.telefono ?? '').replace(/\D/g, '')); if (id != null) sumar(id, r); }
  }
  const out = new Map<number, ChatRT>();
  for (const [id, ms] of porLead) out.set(id, { leadId: id, mensajes: ms.sort((a, b) => a.id - b.id) });
  return out;
}

/** Las charlas de una persona (no grupo) con movimiento en 7 días que no son de ningún lead, con su teléfono y su nombre. */
async function charlasSinLead(): Promise<Array<{ chat: string; telefono: string; nombre: string | null }>> {
  const db = await getTenantDb();
  const desde = new Date(Date.now() - 7 * DIA).toISOString();
  const filas = await todas((d, h) => db.from('wa_mensajes').select('id, chat_jid, telefono, push_name, from_me').is('lead_id', null).gt('wa_timestamp', desde).order('id').range(d, h));
  const leads = await todas((d, h) => db.from('leads').select('id, telefono, telefono_normalizado').order('id').range(d, h));
  const conLead = new Set(leads.flatMap((l) => [ultimos10(l.telefono_normalizado), ultimos10(l.telefono)]).filter((x) => x.length >= 8));
  const out = new Map<string, { chat: string; telefono: string; nombre: string | null }>();
  for (const r of filas) {
    const chat = String(r.chat_jid ?? '');
    if (!chat || chat.endsWith('@g.us') || chat.endsWith('@broadcast') || chat.endsWith('@newsletter')) continue;
    const tel = String(r.telefono ?? '').replace(/\D/g, '') || chat.split('@')[0].replace(/\D/g, '');
    if (tel.length < 8 || conLead.has(ultimos10(tel))) continue;
    const previo = out.get(chat);
    const nombre = r.from_me === true ? null : txt(r.push_name);
    out.set(chat, { chat, telefono: tel, nombre: previo?.nombre ?? nombre });
  }
  return [...out.values()];
}

// ── Las etiquetas ───────────────────────────────────────────────────────────────────────────────────────────────

async function etiquetasPuertos(): Promise<PuertosRT['etiquetas']> {
  const { listarEtiquetas, crearEtiqueta, ponerEtiquetaLote, sacarEtiquetaLote } = await import('./etiquetas');
  const ids = new Map<SegmentoConEtiqueta, number>();
  return {
    asegurar: async (s) => {
      const ya = ids.get(s);
      if (ya) return ya;
      const e = ETIQUETAS[s];
      const existente = (await listarEtiquetas({ incluirArchivadas: true })).find((x) => x.nombre.trim().toLowerCase() === e.nombre.toLowerCase());
      if (existente?.archivada_at) throw new Error(`«${e.nombre}» está archivada en el CRM: desarchívala para que MaKo la use.`);
      const id = existente?.id ?? (await crearEtiqueta({ nombre: e.nombre, color: e.color, emoji: e.emoji, vinculo: null })).etiqueta.id;
      ids.set(s, id);
      return id;
    },
    poner: async (leadIds, etiquetaId) => { const r = await ponerEtiquetaLote(leadIds, etiquetaId, { autor: MAKO_SETTER }); if (!r.ok) throw new Error(r.error); },
    sacar: async (leadIds, etiquetaId) => { const r = await sacarEtiquetaLote(leadIds, etiquetaId, { autor: MAKO_SETTER }); if (!r.ok) throw new Error(r.error); },
  };
}

// ── Meta ────────────────────────────────────────────────────────────────────────────────────────────────────────

async function mandar(p: Pedido): Promise<unknown> {
  const res = await fetch(p.url, { ...p.init, signal: AbortSignal.timeout(60_000) });
  const texto = await res.text();
  let cuerpo: unknown = null;
  try { cuerpo = texto ? JSON.parse(texto) : null; } catch { cuerpo = null; }
  if (!res.ok) {
    const e = (cuerpo ?? {}) as { error?: { message?: string } | string; message?: string };
    const m = typeof e.error === 'string' ? e.error : e.error?.message ?? e.message ?? texto.slice(0, 200);
    throw new Error(`${res.status}: ${m}`);
  }
  return cuerpo;
}

function metaPuertos(ws: number): PuertosRT['meta'] {
  const canal = async () => (await import('./meta-via')).canalMeta(ws);
  return {
    via: async () => (await canal()).via as ViaMeta,
    freno: async () => (await import('./meta-via')).frenoDelTokenMeta(ws),
    crear: async (cual) => {
      const c = await canal();
      if (c.via === 'zernio') {
        const ids = idsDeZernio(await mandar(crearPorZernio(c, cual)));
        if (!ids.zernioId) throw new Error('Zernio creó el público sin devolver su id.');
        // Sin el id de Meta en la respuesta, se lee el público (`GET /ads/audiences/{id}`): sin él, el piloto no lo puede usar.
        const metaId = ids.metaId ?? idsDeZernio(await (await import('./meta-via')).zernioGet(c, `/ads/audiences/${encodeURIComponent(ids.zernioId)}`)).metaId;
        if (!metaId) throw new Error('Zernio no dijo el id del público en Meta.');
        return { metaId, zernioId: ids.zernioId };
      }
      if (c.via === 'token') {
        const r = (await mandar(crearPorToken(c, cual))) as { id?: unknown };
        if (!r?.id) throw new Error('Meta no devolvió el id del público.');
        return { metaId: String(r.id), zernioId: null };
      }
      throw new Error('El negocio no tiene Meta conectado.');
    },
    agregar: async (pub, personas) => { await personasA(await canal(), pub, personas, false); },
    sacar: async (pub, personas) => { await personasA(await canal(), pub, personas, true); },
  };
}

async function personasA(c: Awaited<ReturnType<typeof import('./meta-via').canalMeta>>, pub: { metaId: string; zernioId: string | null; via: string }, personas: Parameters<typeof personasPorToken>[2], quitar: boolean): Promise<void> {
  if (c.via !== pub.via) throw new Error('La conexión de Meta del negocio cambió desde que se creó el público.');
  if (c.via === 'zernio') {
    if (!pub.zernioId) throw new Error('Falta el id de Zernio del público.');
    await mandar(personasPorZernio(c, pub.zernioId, personas, quitar));
  } else if (c.via === 'token') await mandar(personasPorToken(c, pub.metaId, personas, quitar));
  else throw new Error('El negocio no tiene Meta conectado.');
}

// ── Los puertos y lo que se exporta ─────────────────────────────────────────────────────────────────────────────

export async function puertosDelNegocio(ws: number): Promise<PuertosRT> {
  let leadsLeidos: LeadRT[] = [];
  return {
    ahora: () => new Date(),
    leads: async () => (leadsLeidos = await leerLeads()),
    chats: (ids) => leerChats(leadsLeidos, ids),
    chatsSinLead: async () => (await charlasSinLead()).length,
    estado: leerEstado,
    guardarEstado: (e) => setSetting(CLAVE_ESTADO, JSON.stringify(e)),
    config: leerConfig,
    ia: async (system, user) => {
      const { chatCheap } = await import('./ai-cheap');
      return chatCheap({ system, user, json: true, maxTokens: 1500, temperature: 0, feature: 'retargeting-semanal', motivo: 'revisión semanal de las charlas con leads' });
    },
    etiquetas: await etiquetasPuertos(),
    historial: async (filas) => {
      const db = await getTenantDb();
      for (let i = 0; i < filas.length; i += 200) {
        const { error } = await db.from('lead_audit').insert(filas.slice(i, i + 200).map((f) => ({ lead_id: f.leadId, campo: 'Retargeting', valor_anterior: null, valor_nuevo: f.texto, autor: MAKO_SETTER })));
        if (error) throw new Error(error.message);
      }
    },
    meta: metaPuertos(ws),
  };
}

// ── LO QUE SE LLAMA DE AFUERA (el cron, la API de MaKo y la página del CoPilot) ───────────────────────────────────────
// ⚠️ Cada una corre en el negocio que RECIBE, no en el del pedido: el CoPilot las llama con la ws de `wsDeAdsManager()`, que
// puede ser el super admin mirando a un cliente. La base, los ajustes y la IA se resuelven por el contexto (`getTenantDb`,
// `getSetting`), así que sin `runWithWorkspace(ws, …)` adentro leerían y escribirían en el negocio de quien mira.

/** La revisión de UN negocio. */
export async function revisarRetargeting(ws: number, opts: { enSeco: boolean }): Promise<ResultadoRT> {
  return runWithWorkspace(ws, async () => revisarCon(await puertosDelNegocio(ws), opts));
}

/** Lo que ve el CoPilot, sin revisar nada. */
export async function verRetargeting(ws: number): Promise<VistaRT> {
  return runWithWorkspace(ws, async () => {
    const [estado, config, via] = await Promise.all([leerEstado(), leerConfig(), metaPuertos(ws).via().catch(() => 'ninguna' as ViaMeta)]);
    return vistaDe(estado, config, via);
  });
}

/** El interruptor del piloto: con los públicos de Meta prendidos, la próxima revisión los crea y los mantiene. */
export async function configurarRetargeting(ws: number, publicosMeta: boolean): Promise<VistaRT> {
  await runWithWorkspace(ws, () => setSetting(CLAVE_CONFIG, JSON.stringify({ publicosMeta })));
  return verRetargeting(ws);
}

/**
 * «Pasarlas al CRM» (el botón del CoPilot): crea el lead de cada charla sin lead, con la MISMA alta de una charla de /chats
 * (`crearLeadDesdeWhatsappAction`: el nombre de la agenda, el funnel de destino y el tope del plan). Lo pide el dueño; nunca solo.
 */
export async function pasarChatsAlCrm(ws: number, funnelId: number | null = null): Promise<{ creados: number; yaEstaban: number; elegir?: Array<{ id: number; nombre: string }>; error?: string }> {
  return runWithWorkspace(ws, () => pasarChatsAlCrmEnElNegocio(ws, funnelId));
}

async function pasarChatsAlCrmEnElNegocio(ws: number, funnelId: number | null): Promise<{ creados: number; yaEstaban: number; elegir?: Array<{ id: number; nombre: string }>; error?: string }> {
  const [{ destinoDelAlta }, { leerFunnels }, { frenarAltaPorTope, TopeDelPlanError }, { createLead }, { LeadDuplicadoError }, { ORIGEN_LEAD }, { getNombreContacto }, { nombreParaAlta }] = await Promise.all([
    import('./lead-funnel-reglas'), import('./funnels'), import('./topes-crm'), import('./leads'), import('./leads-duplicados'), import('@/app/crm/origen-lead'), import('./evolution-contactos'), import('./contacto-lead'),
  ]);
  const destino = destinoDelAlta(await leerFunnels(), funnelId);
  if ('error' in destino) return { creados: 0, yaEstaban: 0, error: destino.error, ...(destino.elegir ? { elegir: destino.elegir.map((p) => ({ id: p.id, nombre: p.nombre })) } : {}) };
  let creados = 0, yaEstaban = 0;
  for (const c of await charlasSinLead()) {
    try {
      await frenarAltaPorTope(ws, 'crm.leads');
      const agenda = await getNombreContacto(c.telefono).catch(() => null);
      await createLead({ nombre: nombreParaAlta({ agenda, pantalla: c.nombre, telefono: c.telefono }), telefono: c.telefono, origen_lead: ORIGEN_LEAD.chat_whatsapp.id, funnel_id: destino.casa, nombreOpcional: true });
      creados++;
    } catch (e) {
      if (e instanceof LeadDuplicadoError) { yaEstaban++; continue; }
      if (e instanceof TopeDelPlanError) return { creados, yaEstaban, error: e.message };
      return { creados, yaEstaban, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { creados, yaEstaban };
}
