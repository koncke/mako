// =============================================================================
// Espejo de mensajes del WhatsApp NO oficial (Evolution) — F2.2
// =============================================================================
// guardarMensajeUpsert() lo llama el webhook (dentro de runWithWorkspace, así
// getTenantDb scopea) para cada messages.upsert: parsea el payload, matchea el
// lead por teléfono, baja la multimedia (best-effort) a un bucket propio y
// guarda todo en wa_mensajes (raw incluido → respaldo total del PDF). Las
// funciones de lectura alimentan el inbox.

import 'server-only';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { OWNER_WS } from '@/lib/auth-session';
import { jidToNumero, instanceNameDeWs, fetchMensajesEvolution, fetchChatsEvolution, statusDeRecord, type EvRecord } from '@/lib/evolution';
import { normalizarTelefono } from '@/lib/leads';
import { pausarPorRespuesta } from '@/lib/nutricion';
import { MEDIA_BUCKET, subirMedia } from '@/lib/evolution-media';
import { derivarEtapa, type LeadEtapaFields } from '@/lib/wa-etapas';
import { telefonosBloqueados } from '@/lib/evolution-block';

// ── Parseo del payload de Evolution ──────────────────────────────────────────
type UpsertData = {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  pushName?: string;
  message?: Record<string, unknown> & { base64?: string };
  messageType?: string;
  messageTimestamp?: number | string;
  base64?: string;
};

type Contenido = { tipo: string; texto: string | null; mediaMime: string | null; mediaBase64: string | null; ext: string };

// Extrae tipo, texto/caption y (si hay) la multimedia en base64. Defensivo: si
// el shape cambia, cae a 'otro' y el raw igual queda guardado.
function extraerContenido(data: UpsertData): Contenido {
  const m = (data.message ?? {}) as Record<string, unknown>;
  const g = (k: string): Record<string, unknown> | null => (m[k] && typeof m[k] === 'object' ? (m[k] as Record<string, unknown>) : null);
  // Evolution con webhookBase64:true adjunta la media en base64 en alguno de estos.
  const b64 = (data.base64 as string) || (data.message?.base64 as string)
    || (g('imageMessage')?.base64 as string) || (g('audioMessage')?.base64 as string)
    || (g('videoMessage')?.base64 as string) || (g('documentMessage')?.base64 as string) || null;

  if (typeof m.conversation === 'string') return { tipo: 'text', texto: m.conversation, mediaMime: null, mediaBase64: null, ext: '' };
  const ext = g('extendedTextMessage');
  if (ext) return { tipo: 'text', texto: (ext.text as string) ?? '', mediaMime: null, mediaBase64: null, ext: '' };

  // MIME fijo por tipo (no confiamos en el mimetype del payload — un contacto
  // podría spoofearlo; lo servimos por URL firmada). Cada tipo → un mime seguro.
  const img = g('imageMessage');
  if (img) return { tipo: 'image', texto: (img.caption as string) ?? null, mediaMime: 'image/jpeg', mediaBase64: b64, ext: 'jpg' };
  const vid = g('videoMessage');
  if (vid) return { tipo: 'video', texto: (vid.caption as string) ?? null, mediaMime: 'video/mp4', mediaBase64: b64, ext: 'mp4' };
  const aud = g('audioMessage');
  if (aud) return { tipo: 'audio', texto: null, mediaMime: 'audio/ogg', mediaBase64: b64, ext: 'ogg' };
  const doc = g('documentMessage');
  if (doc) return { tipo: 'document', texto: (doc.fileName as string) ?? (doc.caption as string) ?? null, mediaMime: 'application/octet-stream', mediaBase64: b64, ext: 'bin' };
  const stk = g('stickerMessage');
  if (stk) return { tipo: 'sticker', texto: null, mediaMime: 'image/webp', mediaBase64: b64, ext: 'webp' };

  // Reacciones, ediciones y mensajes de protocolo (revoke, etc.) → 'evento': se
  // guardan (respaldo) pero no cuentan como "último mensaje" ni pausan nutrición.
  if (g('reactionMessage') || g('protocolMessage') || g('editedMessage') || g('pollUpdateMessage')) {
    return { tipo: 'evento', texto: null, mediaMime: null, mediaBase64: null, ext: '' };
  }

  return { tipo: 'otro', texto: null, mediaMime: null, mediaBase64: null, ext: '' };
}

function tsToISO(ts: number | string | undefined): string {
  const n = Number(ts);
  if (Number.isFinite(n) && n > 0) return new Date(n * 1000).toISOString();
  return new Date().toISOString();
}

// Match del lead por teléfono. Preferimos igualdad exacta del normalizado; si no,
// caemos al sufijo de 10 dígitos (como el webhook de Chatwoot) con orden estable
// para que sea determinista. Scopeado al workspace por getTenantDb.
async function matchLeadPorTelefono(telNorm: string): Promise<number | null> {
  if (telNorm.length < 8) return null;
  const supabase = await getTenantDb();
  const exacto = await supabase.from('leads').select('id').eq('telefono_normalizado', telNorm).order('id').limit(1);
  const eId = ((exacto.data ?? []) as Array<{ id: number }>)[0]?.id;
  if (eId) return eId;
  const last = telNorm.slice(-10);
  const suf = await supabase.from('leads').select('id').like('telefono_normalizado', `%${last}`).order('id').limit(1);
  return ((suf.data ?? []) as Array<{ id: number }>)[0]?.id ?? null;
}

// Guarda un messages.upsert. IDEMPOTENTE y no destructivo: Evolution reenvía el
// mismo wa_message_id (reintentos, sync 'append' de historial que a veces NO
// trae la media). Por eso: (a) si la fila ya existe, NO re-subimos media ni
// pisamos media_path/texto/lead_id con null — solo COMPLETAMOS lo que faltaba;
// (b) no re-pausamos la nutrición en re-entregas. Así el respaldo total no se
// corrompe con una re-entrega vacía.
export async function guardarMensajeUpsert(instance: string, data: UpsertData): Promise<void> {
  const key = data.key;
  if (!key?.remoteJid || !key?.id) return;
  const chatJid = key.remoteJid;
  // Ignoramos grupos y estados (además de groupsIgnore en Evolution).
  if (chatJid.endsWith('@g.us') || chatJid.startsWith('status@')) return;

  const fromMe = !!key.fromMe;
  const telefono = normalizarTelefono(jidToNumero(chatJid));
  const { tipo, texto, mediaMime, mediaBase64, ext } = extraerContenido(data);

  const supabase = await getTenantDb();
  const { data: existente } = await supabase
    .from('wa_mensajes').select('id, media_path, texto, lead_id, status')
    .eq('wa_message_id', key.id).maybeSingle();
  const prev = existente as { id: number; media_path: string | null; texto: string | null; lead_id: number | null; status: string | null } | null;

  // Match de lead solo si hace falta (no lo teníamos aún).
  const leadId = prev?.lead_id ?? (telefono ? await matchLeadPorTelefono(telefono) : null);

  // Subimos media SOLO si es fila nueva o todavía no tenía media guardada.
  let mediaPath: string | null = prev?.media_path ?? null;
  if (!mediaPath && mediaBase64 && mediaMime) {
    const ws = (await getWorkspaceActual()) ?? OWNER_WS;
    mediaPath = await subirMedia(ws, instance, key.id, mediaBase64, mediaMime, ext);
  }

  if (prev) {
    // Re-entrega: completar SOLO lo que falta, nunca pisar con null.
    const patch: Record<string, unknown> = {};
    if (!prev.media_path && mediaPath) { patch.media_path = mediaPath; patch.media_mime = mediaMime; }
    if (!prev.texto && texto) patch.texto = texto;
    if (!prev.lead_id && leadId) patch.lead_id = leadId;
    if (fromMe && !prev.status) patch.status = 'sent'; // saliente sin estado → al menos 'enviado' (ticks)
    if (Object.keys(patch).length) await supabase.from('wa_mensajes').update(patch).eq('id', prev.id);
    return; // ya existía → no re-pausar nutrición
  }

  await supabase.from('wa_mensajes').insert({
    instance_name: instance,
    chat_jid: chatJid,
    telefono,
    wa_message_id: key.id,
    from_me: fromMe,
    tipo,
    texto,
    media_path: mediaPath,
    media_mime: mediaPath ? mediaMime : null,
    status: fromMe ? 'sent' : null, // ticks: salientes arrancan en 'enviado'
    push_name: data.pushName ?? null,
    lead_id: leadId,
    wa_timestamp: tsToISO(data.messageTimestamp),
    raw: data as unknown as Record<string, unknown>,
  });

  // El lead RESPONDIÓ (mensaje entrante REAL, no reacción/protocolo) → pausar su
  // nutrición, como el webhook de Chatwoot. Solo en el insert (no re-entregas).
  if (!fromMe && leadId && tipo !== 'evento' && tipo !== 'otro') {
    try { await pausarPorRespuesta(leadId); } catch { /* no fatal */ }
  }
}

// ── Lectura para el inbox ────────────────────────────────────────────────────
// Clave de agrupación de una conversación: los últimos 10 dígitos del teléfono
// (robusto ante variaciones del jid); si no hay teléfono, el jid crudo.
function claveTel(tel: string | null, jid: string): string {
  const d = (tel || '').replace(/\D/g, '').slice(-10);
  return d.length >= 8 ? d : jid;
}

// Resuelve leadId por teléfono (últimos 10 díg.) para las convs que aún no lo
// tienen (chats traídos en vivo, o salientes sin lead_id), en UNA query acotada.
// Así el enriquecido (empresa/etapa/nombre) también cubre las convs live.
async function resolverLeadIdsPorTelefono(supabase: Awaited<ReturnType<typeof getTenantDb>>, convs: WaConversacion[]): Promise<void> {
  const sinLead = convs.filter((c) => !c.leadId && c.telefono);
  const phones = [...new Set(sinLead.map((c) => (c.telefono || '').replace(/\D/g, '').slice(-10)).filter((p) => p.length >= 8))].slice(0, 50);
  if (!phones.length) return;
  const conds = phones.map((p) => `telefono_normalizado.like.%${p}%`).join(',');
  const { data } = await supabase.from('leads').select('id, telefono_normalizado').or(conds).limit(300);
  const porTel = new Map<string, number>();
  for (const l of (data ?? []) as Array<{ id: number; telefono_normalizado: string | null }>) {
    const t10 = (l.telefono_normalizado || '').replace(/\D/g, '').slice(-10);
    if (t10 && !porTel.has(t10)) porTel.set(t10, l.id);
  }
  for (const c of sinLead) {
    const id = porTel.get((c.telefono || '').replace(/\D/g, '').slice(-10));
    if (id) c.leadId = id;
  }
}

export type WaConversacion = {
  chatJid: string; telefono: string | null; nombre: string; leadId: number | null;
  empresa: string | null; etapaKey: string | null; etapaLabel: string | null;
  ultimoTexto: string | null; ultimoTipo: string | null; ultimaFecha: string | null;
  ultimoEntrante: boolean; total: number; bloqueado: boolean;
};

// Conversaciones del canal no oficial: agrupa wa_mensajes por chat (en JS, como
// el inbox de Chatwoot). Trae los últimos N y arma un hilo por contacto.
export async function getConversacionesNoOficial(limite = 600): Promise<WaConversacion[]> {
  const supabase = await getTenantDb();
  const { data } = await supabase
    .from('wa_mensajes')
    .select('chat_jid, telefono, push_name, texto, tipo, from_me, wa_timestamp, lead_id')
    .neq('tipo', 'evento')   // reacciones/protocolo no cuentan como "último mensaje"
    .order('wa_timestamp', { ascending: false })
    .limit(limite);
  const rows = (data ?? []) as Array<{ chat_jid: string; telefono: string | null; push_name: string | null; texto: string | null; tipo: string | null; from_me: boolean; wa_timestamp: string | null; lead_id: number | null }>;

  // Agrupamos por TELÉFONO (últimos 10 dígitos), NO por chat_jid exacto: Evolution
  // guarda entrantes/salientes bajo jids que a veces difieren (9 de AR, @lid vs
  // @s.whatsapp.net, sufijo de device). Agrupar por número junta el hilo real y
  // evita el "Sin mensajes" cuando el jid del listado no coincide con el guardado.
  // rows viene desc → la 1ª fila por número es la más reciente → su chat_jid es el
  // representante (el que usa el hilo).
  const porChat = new Map<string, WaConversacion>();
  for (const r of rows) {
    const k = claveTel(r.telefono, r.chat_jid);
    const prev = porChat.get(k);
    if (!prev) {
      porChat.set(k, {
        chatJid: r.chat_jid, telefono: r.telefono, nombre: r.push_name || r.telefono || r.chat_jid.replace(/@.*/, ''),
        leadId: r.lead_id, empresa: null, etapaKey: null, etapaLabel: null,
        ultimoTexto: r.texto, ultimoTipo: r.tipo, ultimaFecha: r.wa_timestamp,
        ultimoEntrante: !r.from_me, total: 1, bloqueado: false,
      });
    } else {
      prev.total += 1;
      if (!prev.leadId && r.lead_id) prev.leadId = r.lead_id;
      if (!prev.telefono && r.telefono) prev.telefono = r.telefono;
      if ((prev.nombre === prev.telefono || prev.nombre === prev.chatJid.replace(/@.*/, '')) && r.push_name) prev.nombre = r.push_name;
    }
  }
  const convs = [...porChat.values()];

  // El inbox lista SOLO conversaciones reales (las que están en el espejo: te
  // escribieron o les escribiste, + placeholders de Nutrición-Manual). NO se
  // vuelca automáticamente toda la agenda/historial de Evolution — eso sólo pasa
  // con "Sincronizar todo" (sincronizarDesdeEvolution), que trae los chats al
  // espejo a pedido. Así no aparecen números sueltos ni el @lid duplicado.

  // Resolver leadId por teléfono para las convs sin lead (salientes viejos sin
  // lead_id) → el enriquecido de abajo les pone empresa/etapa/nombre del CRM.
  await resolverLeadIdsPorTelefono(supabase, convs);

  // Enriquecer con empresa + etapa del funnel (tarjeta de lead, filtro por etapa,
  // contexto de MaKo). Misma derivación que el inbox oficial (lib/wa-etapas). Un
  // lead marcado a mano en 'Nutrición - Manual' (pipeline_stage='manual') se
  // muestra con esa etapa, tenga o no mensajes.
  const leadIds = [...new Set(convs.map((c) => c.leadId).filter((x): x is number => x != null))];
  if (leadIds.length) {
    const { data: leads } = await supabase
      .from('leads')
      .select('id, nombre, empresa, pipeline_stage, fecha_primer_pago, fecha_confirmacion, cerro, asistio_j1, asistio_j2, fecha_junta_2, fecha_agenda, visitor_id, meta_lead_id')
      .in('id', leadIds);
    const porId = new Map(((leads ?? []) as Array<{ id: number; nombre: string | null; empresa: string | null; pipeline_stage: string | null } & LeadEtapaFields>).map((l) => [l.id, l]));
    for (const c of convs) {
      if (!c.leadId) continue;
      const l = porId.get(c.leadId);
      if (!l) continue;
      c.empresa = l.empresa ?? null;
      // Si el "nombre" quedó como el teléfono/jid (p.ej. saliente propio sin
      // push_name), usamos el nombre del CRM (así un lead buscado no se ve como
      // un número tras escribirle). Si hay push_name real, lo respetamos.
      if (l.nombre && (c.nombre === c.telefono || c.nombre === c.chatJid.replace(/@.*/, ''))) c.nombre = l.nombre;
      if (l.pipeline_stage === 'manual') { c.etapaKey = 'manual'; c.etapaLabel = 'Nutrición - Manual'; }
      else { const et = derivarEtapa(l); c.etapaKey = et.key; c.etapaLabel = et.label; }
    }
  }

  // #9: sumar los leads en 'Nutrición - Manual' que TODAVÍA no tienen mensajes,
  // como conversaciones placeholder — así se les puede escribir desde el inbox.
  const idsConConv = new Set(convs.map((c) => c.leadId).filter((x): x is number => x != null));
  const telsConConv = new Set(convs.map((c) => (c.telefono || '').replace(/\D/g, '').slice(-10)).filter(Boolean));
  const { data: manuales } = await supabase
    .from('leads')
    .select('id, nombre, empresa, telefono_normalizado')
    .eq('pipeline_stage', 'manual')
    .not('telefono_normalizado', 'is', null)
    .limit(300);
  for (const l of (manuales ?? []) as Array<{ id: number; nombre: string | null; empresa: string | null; telefono_normalizado: string | null }>) {
    if (idsConConv.has(l.id)) continue;
    const tel = (l.telefono_normalizado || '').replace(/\D/g, '');
    if (!tel) continue;
    const t10 = tel.slice(-10);
    if (t10 && telsConConv.has(t10)) continue;
    telsConConv.add(t10);
    convs.push({
      chatJid: `${tel}@s.whatsapp.net`, telefono: tel, nombre: l.nombre || tel, leadId: l.id,
      empresa: l.empresa ?? null, etapaKey: 'manual', etapaLabel: 'Nutrición - Manual',
      ultimoTexto: null, ultimoTipo: null, ultimaFecha: null, ultimoEntrante: false, total: 0, bloqueado: false,
    });
  }

  // Marcar contactos bloqueados (una sola query).
  const bloq = await telefonosBloqueados();
  if (bloq.size) for (const c of convs) if (c.telefono && bloq.has(c.telefono.replace(/\D/g, ''))) c.bloqueado = true;
  return convs;
}

// Resumen liviano para el polling GLOBAL de notificaciones (corre en toda la app
// cada ~12s): solo lo mínimo para detectar mensajes nuevos entrantes y el badge —
// una única query, SIN enriquecer con leads/etapas/bloqueos/placeholders. Para el
// inbox completo (con toda esa info) está getConversacionesNoOficial().
export type WaResumen = { chatJid: string; nombre: string; ultimaFecha: string | null; ultimoEntrante: boolean };
export async function getResumenNoOficial(limite = 600): Promise<WaResumen[]> {
  const supabase = await getTenantDb();
  const { data } = await supabase
    .from('wa_mensajes')
    .select('chat_jid, telefono, push_name, from_me, wa_timestamp')
    .neq('tipo', 'evento')
    .order('wa_timestamp', { ascending: false })
    .limit(limite);
  const rows = (data ?? []) as Array<{ chat_jid: string; telefono: string | null; push_name: string | null; from_me: boolean; wa_timestamp: string | null }>;
  const porChat = new Map<string, WaResumen>();
  for (const r of rows) {
    const k = claveTel(r.telefono, r.chat_jid); // agrupar por teléfono (mismo criterio que el inbox)
    if (porChat.has(k)) continue; // rows vienen desc → el primero es el último mensaje
    porChat.set(k, {
      chatJid: r.chat_jid,
      nombre: r.push_name || r.telefono || r.chat_jid.replace(/@.*/, ''),
      ultimaFecha: r.wa_timestamp,
      ultimoEntrante: !r.from_me,
    });
  }
  return [...porChat.values()];
}

// Búsqueda server-side de CUALQUIER lead del CRM (con teléfono) como
// conversación placeholder, para poder "traerlo" al inbox y escribirle aunque
// nunca haya habido mensajes. Habilita el buscador del inbox no oficial (#2):
// el usuario tipea un nombre/empresa/teléfono y el lead aparece; al escribirle,
// enviarYEspejar materializa el chat real. Scopeado por getTenantDb.
export async function buscarLeadsComoPlaceholders(q: string, limite = 25): Promise<WaConversacion[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const supabase = await getTenantDb();
  // Sanitizar para el filtro .or de PostgREST (las comas/paréntesis separan condiciones).
  const limpio = term.replace(/[(),%*]/g, ' ').trim();
  if (!limpio) return [];
  const digits = term.replace(/\D/g, '');
  const conds = [`nombre.ilike.%${limpio}%`, `empresa.ilike.%${limpio}%`];
  if (digits.length >= 4) conds.push(`telefono_normalizado.like.%${digits}%`);
  const { data } = await supabase
    .from('leads')
    .select('id, nombre, empresa, telefono_normalizado, pipeline_stage, fecha_primer_pago, fecha_confirmacion, cerro, asistio_j1, asistio_j2, fecha_junta_2, fecha_agenda, visitor_id, meta_lead_id')
    .not('telefono_normalizado', 'is', null)
    .or(conds.join(','))
    .limit(limite);
  const rows = (data ?? []) as Array<{ id: number; nombre: string | null; empresa: string | null; telefono_normalizado: string | null; pipeline_stage: string | null } & LeadEtapaFields>;
  const out: WaConversacion[] = [];
  for (const l of rows) {
    const tel = (l.telefono_normalizado || '').replace(/\D/g, '');
    if (!tel) continue;
    const et = l.pipeline_stage === 'manual' ? { key: 'manual', label: 'Nutrición - Manual' } : derivarEtapa(l);
    out.push({
      chatJid: `${tel}@s.whatsapp.net`, telefono: tel, nombre: l.nombre || tel, leadId: l.id,
      empresa: l.empresa ?? null, etapaKey: et.key, etapaLabel: et.label,
      ultimoTexto: null, ultimoTipo: null, ultimaFecha: null, ultimoEntrante: false, total: 0, bloqueado: false,
    });
  }
  return out;
}

export type WaMensaje = {
  id: number; fromMe: boolean; tipo: string | null; texto: string | null;
  mediaUrl: string | null; mediaMime: string | null; fecha: string | null; status: string | null;
};

// Mensajes de un chat (asc) con URLs firmadas para la multimedia. Matchea por
// TELÉFONO (últimos 10 dígitos) además del jid exacto: así el hilo aparece aunque
// Evolution haya guardado los mensajes bajo un jid distinto del que muestra el
// listado (9 de AR, @lid, sufijo de device) — antes daba "Sin mensajes".
export async function getMensajesDeChat(chatJid: string, limite = 300): Promise<WaMensaje[]> {
  const supabase = await getTenantDb();
  const last10 = (normalizarTelefono(jidToNumero(chatJid)) || '').replace(/\D/g, '').slice(-10);
  let sel = supabase
    .from('wa_mensajes')
    .select('id, wa_message_id, chat_jid, from_me, tipo, texto, media_path, media_mime, wa_timestamp, status')
    .neq('tipo', 'evento')   // no ensuciamos el hilo con reacciones/protocolo
    .order('wa_timestamp', { ascending: true })
    .limit(limite);
  // chat_jid puede traer chars raros para PostgREST .or → sólo lo usamos en el .or
  // si es "simple"; si no, caemos al match por teléfono (o jid exacto).
  const jidSimple = /^[A-Za-z0-9@._:-]+$/.test(chatJid);
  if (last10.length >= 8 && jidSimple) sel = sel.or(`chat_jid.eq.${chatJid},telefono.like.%${last10}%`);
  else if (last10.length >= 8) sel = sel.like('telefono', `%${last10}%`);
  else sel = sel.eq('chat_jid', chatJid);

  // En paralelo: espejo (DB, con media firmada) + LIVE de Evolution (para que el
  // hilo aparezca aunque el webhook no haya poblado el espejo). El espejo es la
  // fuente autoritativa (tiene la media y los ticks); lo live rellena huecos.
  const [{ data }, liveRecords] = await Promise.all([sel, fetchMensajesEvolution(chatJid, limite).catch(() => [] as EvRecord[])]);
  const rows = (data ?? []) as Array<{ id: number; wa_message_id: string | null; chat_jid: string; from_me: boolean; tipo: string | null; texto: string | null; media_path: string | null; media_mime: string | null; wa_timestamp: string | null; status: string | null }>;

  // Firmar TODA la media del espejo en UN solo batch (createSignedUrls), con
  // timeout y fail-open (antes un loop secuencial colgaba el request → "Cargando…").
  const paths = rows.map((r) => r.media_path).filter((p): p is string => !!p);
  const urlPorPath = new Map<string, string>();
  if (paths.length) {
    try {
      const firmar = supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 3600);
      const guard = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('storage timeout')), 8000));
      const { data: signed } = await Promise.race([firmar, guard]) as Awaited<typeof firmar>;
      for (const s of signed ?? []) if (s.path && s.signedUrl) urlPorPath.set(s.path, s.signedUrl);
    } catch { /* storage caído/lento → hilo sin media, nunca colgamos el request */ }
  }

  // Merge por wa_message_id: el espejo GANA (tiene media firmada + status). Lo
  // live sólo agrega mensajes que el espejo todavía no tiene (sin webhook).
  // La media que NO está bajada al bucket (fila live, o espejo sin media_path) se
  // sirve por el proxy ?media= (baja el base64 de Evolution a pedido).
  const porWaId = new Map<string, WaMensaje>();
  const sinId: WaMensaje[] = [];
  for (const r of rows) {
    const media = r.media_path
      ? (urlPorPath.get(r.media_path) ?? null)
      : (esTipoMedia(r.tipo) ? proxyMedia(r.wa_message_id, r.chat_jid, r.from_me) : null);
    const m: WaMensaje = {
      id: r.id, fromMe: r.from_me, tipo: r.tipo, texto: r.texto,
      mediaUrl: media, mediaMime: r.media_mime, fecha: r.wa_timestamp, status: r.status,
    };
    if (r.wa_message_id) porWaId.set(r.wa_message_id, m); else sinId.push(m);
  }
  for (const rec of liveRecords) {
    const waId = rec.key?.id;
    if (!waId || porWaId.has(waId)) continue; // ya está en el espejo → no duplicar
    const c = extraerContenido(rec as UpsertData);
    if (c.tipo === 'evento' || c.tipo === 'otro') continue;
    porWaId.set(waId, {
      id: -Math.abs(hashStr(waId)) - 1, // negativo → no choca con ids reales del espejo
      fromMe: !!rec.key?.fromMe, tipo: c.tipo, texto: c.texto,
      mediaUrl: esTipoMedia(c.tipo) ? proxyMedia(waId, rec.key?.remoteJid || chatJid, !!rec.key?.fromMe) : null,
      mediaMime: c.mediaMime, fecha: tsToISO(rec.messageTimestamp), status: statusDeRecord(rec),
    });
  }
  return [...porWaId.values(), ...sinId].sort((a, b) => (Date.parse(a.fecha ?? '') || 0) - (Date.parse(b.fecha ?? '') || 0));
}

const esTipoMedia = (t: string | null): boolean => t === 'image' || t === 'audio' || t === 'video' || t === 'document' || t === 'sticker';
// URL de nuestro proxy que baja el base64 de la media desde Evolution a pedido.
function proxyMedia(waId: string | null, jid: string, fromMe: boolean): string | null {
  if (!waId) return null;
  return `/api/whatsapp/evolution/mensajes?media=${encodeURIComponent(waId)}&chat=${encodeURIComponent(jid)}&fromMe=${fromMe ? 1 : 0}`;
}

// Sincroniza a pedido ("Sincronizar todo"): trae los chats de Evolution al espejo
// (texto/metadata; la media se sirve por el proxy). Salta @lid (duplican al número
// real), grupos, status y broadcast. Bulk por chat (1 match de lead + 1 upsert)
// para no timeoutear; ignoreDuplicates = no pisa lo que ya capturó el webhook.
export async function sincronizarDesdeEvolution(): Promise<{ chats: number; mensajes: number }> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { chats: 0, mensajes: 0 };
  const instance = instanceNameDeWs(ws);
  const supabase = await getTenantDb();
  const chats = await fetchChatsEvolution().catch(() => [] as Awaited<ReturnType<typeof fetchChatsEvolution>>);
  let nChat = 0, nMsg = 0;
  for (const ch of chats.slice(0, 80)) {
    const jid = ch.remoteJid || '';
    if (!jid || jid.endsWith('@g.us') || jid.endsWith('@lid') || jid.startsWith('status@') || jid.includes('broadcast')) continue;
    const recs = await fetchMensajesEvolution(jid, 60).catch(() => [] as EvRecord[]);
    if (!recs.length) continue;
    nChat += 1;
    const telefono = normalizarTelefono(jidToNumero(jid));
    const leadId = telefono ? await matchLeadPorTelefono(telefono) : null;
    const filas: Record<string, unknown>[] = [];
    for (const rec of recs) {
      const key = rec.key;
      if (!key?.id) continue;
      const c = extraerContenido(rec as UpsertData);
      if (c.tipo === 'evento' || c.tipo === 'otro') continue;
      filas.push({
        instance_name: instance, chat_jid: jid, telefono,
        wa_message_id: key.id, from_me: !!key.fromMe, tipo: c.tipo, texto: c.texto,
        media_path: null, media_mime: c.mediaMime, status: statusDeRecord(rec),
        push_name: rec.pushName ?? null, lead_id: leadId,
        wa_timestamp: tsToISO(rec.messageTimestamp), raw: rec as unknown as Record<string, unknown>,
      });
    }
    if (filas.length) {
      await supabase.from('wa_mensajes').upsert(filas, { onConflict: 'workspace_id,wa_message_id', ignoreDuplicates: true });
      nMsg += filas.length;
    }
  }
  return { chats: nChat, mensajes: nMsg };
}

// Hash estable string → int (para ids sintéticos de mensajes live).
function hashStr(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
