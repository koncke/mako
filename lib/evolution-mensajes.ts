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
import { leerPorPaginas } from '@/lib/supabase-paginado';
import { OWNER_WS } from '@/lib/auth-session';
import { jidToNumero, instanceNameDeWs, fetchMensajesEvolution,
  fetchConversacionEvolution, fetchChatsEvolution, fetchLidDeNumero, statusDeRecord, type EvRecord } from '@/lib/evolution';
import { normalizarTelefono } from '@/lib/leads';
import { pausarPorRespuesta } from '@/lib/nutricion';
import { MEDIA_BUCKET, subirMedia } from '@/lib/evolution-media';
import { derivarEtapa, type LeadEtapaFields } from '@/lib/wa-etapas';
import { telefonosBloqueados, telefonosOcultos } from '@/lib/evolution-block';
import { getNombresContacto } from '@/lib/evolution-contactos';
import { upsertContacto, upsertContactosLote } from './evolution-contactos';
import { fetchContactosEvolution } from './evolution';

// ── Parseo del payload de Evolution ──────────────────────────────────────────
type UpsertData = {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string; remoteJidAlt?: string; senderPn?: string; addressingMode?: string };
  pushName?: string;
  message?: Record<string, unknown> & { base64?: string };
  messageType?: string;
  messageTimestamp?: number | string;
  base64?: string;
};

// JID canónico del chat: WhatsApp direcciona a los contactos NO agendados (Android)
// por un alias "@lid" (ej. 70781665022126@lid) en vez del número. El número real
// viene en key.remoteJidAlt / key.senderPn. Canonicalizamos al número para que el
// entrante caiga en la MISMA conversación que el saliente (si no, se parte en dos).
function jidCanonico(key: UpsertData['key']): string | null {
  const jid = key?.remoteJid;
  if (!jid) return null;
  if (jid.endsWith('@lid')) {
    const alt = key?.remoteJidAlt || key?.senderPn;
    if (alt) {
      if (alt.includes('@')) return alt;
      const d = alt.replace(/\D/g, '');
      if (d) return `${d}@s.whatsapp.net`;
    }
  }
  return jid;
}

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
  // Canonicalizar @lid → número real (si Baileys mandó el alt) para que el
  // entrante caiga en la conversación del número, no en un hilo @lid aparte.
  const chatJid = jidCanonico(key) ?? key.remoteJid;
  // Ignoramos grupos y estados (además de groupsIgnore en Evolution).
  if (chatJid.endsWith('@g.us') || chatJid.startsWith('status@')) return;

  const fromMe = !!key.fromMe;
  // Si la canonicalización de arriba no encontró el número real, chatJid sigue
  // siendo un @lid (alias interno de Meta) — guardarlo como "teléfono" mostraba
  // ese ID de 15 dígitos como si fuera un número de verdad, y ningún cruce por
  // teléfono (lead, nombre de agenda, foto) lo iba a encontrar jamás.
  const telefono = chatJid.endsWith('@lid') ? null : normalizarTelefono(jidToNumero(chatJid));
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
    if (Object.keys(patch).length) {
      const { error } = await supabase.from('wa_mensajes').update(patch).eq('id', prev.id);
      if (error) throw new Error(`update wa_mensajes: ${error.message}`);
    }
    return; // ya existía → no re-pausar nutrición
  }

  // OJO: supabase-js NO tira excepción en error → hay que chequear .error a mano
  // (si no, el fallo — p.ej. FK de workspace_id — pasa en SILENCIO y no se guarda).
  const { error: insErr } = await supabase.from('wa_mensajes').insert({
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
    push_name: fromMe ? null : (data.pushName ?? null), // el push_name de un saliente es NUESTRO ('Você'/nuestro perfil), no el del contacto
    lead_id: leadId,
    wa_timestamp: tsToISO(data.messageTimestamp),
    raw: data as unknown as Record<string, unknown>,
  });
  if (insErr) throw new Error(`insert wa_mensajes: ${insErr.message}`);

  // El lead RESPONDIÓ (mensaje entrante REAL, no reacción/protocolo) → pausar su
  // nutrición, como el webhook de Chatwoot. Solo en el insert (no re-entregas).
  if (!fromMe && leadId && tipo !== 'evento' && tipo !== 'otro') {
    // El texto va para el modo asistido: MaKo redacta el borrador de respuesta.
    try { await pausarPorRespuesta(leadId, { texto: texto ?? undefined }); } catch { /* no fatal */ }
  }
}

// ── Lectura para el inbox ────────────────────────────────────────────────────
// Clave de agrupación de una conversación: los últimos 10 dígitos del teléfono
// (robusto ante variaciones del jid); si no hay teléfono, el jid crudo.
export function claveTel(tel: string | null, jid: string): string {
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

/**
 * Orden del barrido del espejo: del mensaje más nuevo al más viejo. Los dos
 * lectores de abajo dependen de eso (el primero que aparece por chat ES el
 * último mensaje), así que vive en un solo lugar.
 *
 * El desempate por `id` NO es adorno: `wa_timestamp` se repite (WhatsApp entrega
 * ráfagas con el mismo segundo, y el importador vuelca chats enteros de golpe).
 * Con un orden que empata, Postgres puede acomodar las filas empatadas distinto
 * en cada request, y el OFFSET de la página siguiente se aplica sobre ese otro
 * reparto → mensajes repetidos y mensajes salteados, sin ningún error.
 */
const ORDEN_ESPEJO = [{ col: 'wa_timestamp', asc: false }, { col: 'id', asc: false }] as const;

/**
 * Tope explícito del barrido: 20 páginas = 20.000 mensajes, los MÁS RECIENTES
 * (por el orden de arriba). Es el mismo techo que tenía el bucle a mano; la
 * diferencia es que ahora se lee en el call-site en vez de estar escondido en un
 * `desde < 20000`. Un espejo más grande que eso no entra en el presupuesto de un
 * request, y quedarse con lo más nuevo es la pérdida menos mala.
 */
const TOPE_PAGINAS_ESPEJO = 20;

// Conversaciones del canal no oficial: agrupa wa_mensajes por chat (en JS, como
// el inbox de Chatwoot). Trae los últimos N y arma un hilo por contacto.
export async function getConversacionesNoOficial(limite = 600, incluirOcultos = false): Promise<WaConversacion[]> {
  const supabase = await getTenantDb();
  // `limite` es cuántas CONVERSACIONES devolver, no cuántos mensajes leer: un
  // `.limit(limite)` sobre wa_mensajes solo ve las últimas `limite` FILAS, y con
  // muchos contactos de poca frecuencia esas filas son un puñado de hilos muy
  // activos una y otra vez — el resto de las conversaciones (la mayoría) queda
  // afuera del todo, aunque tengan mensajes. Por eso el botón "abrir chat" desde
  // otra pantalla casi siempre terminaba en el hilo más reciente: el jid pedido
  // no estaba entre esas `limite` filas. Se pagina TODO el espejo (mismo patrón
  // que la ruta de onboarding) y recién al final se corta a `limite` conversaciones.
  type Fila = { chat_jid: string; telefono: string | null; push_name: string | null; texto: string | null; tipo: string | null; from_me: boolean; wa_timestamp: string | null; lead_id: number | null };
  const rows: Fila[] = [];
  await leerPorPaginas<Fila>(
    supabase, 'wa_mensajes',
    'chat_jid, telefono, push_name, texto, tipo, from_me, wa_timestamp, lead_id',
    (pagina, nro) => { rows.push(...pagina); return nro < TOPE_PAGINAS_ESPEJO; },
    // reacciones/protocolo no cuentan como "último mensaje"
    { orden: ORDEN_ESPEJO, filtros: (q) => q.neq('tipo', 'evento') },
  );

  // Agrupamos por TELÉFONO (últimos 10 dígitos), NO por chat_jid exacto: Evolution
  // guarda entrantes/salientes bajo jids que a veces difieren (9 de AR, @lid vs
  // @s.whatsapp.net, sufijo de device). Agrupar por número junta el hilo real y
  // evita el "Sin mensajes" cuando el jid del listado no coincide con el guardado.
  // rows viene desc → la 1ª fila por número es la más reciente → su chat_jid es el
  // representante (el que usa el hilo).
  // El push_name de un SALIENTE es el nuestro ('Você'/nuestro perfil), no el del
  // contacto → solo usamos push_name de ENTRANTES y nunca el literal 'Você'.
  const nombreDe = (r: { push_name: string | null; from_me: boolean }): string | null =>
    (!r.from_me && r.push_name && r.push_name !== 'Você') ? r.push_name : null;
  const jidNombre = (jid: string) => jid.replace(/@.*/, '');
  const porChat = new Map<string, WaConversacion>();
  for (const r of rows) {
    const k = claveTel(r.telefono, r.chat_jid);
    const prev = porChat.get(k);
    if (!prev) {
      porChat.set(k, {
        chatJid: r.chat_jid, telefono: r.telefono, nombre: nombreDe(r) || r.telefono || jidNombre(r.chat_jid),
        leadId: r.lead_id, empresa: null, etapaKey: null, etapaLabel: null,
        ultimoTexto: r.texto, ultimoTipo: r.tipo, ultimaFecha: r.wa_timestamp,
        ultimoEntrante: !r.from_me, total: 1, bloqueado: false,
      });
    } else {
      prev.total += 1;
      if (!prev.leadId && r.lead_id) prev.leadId = r.lead_id;
      if (!prev.telefono && r.telefono) prev.telefono = r.telefono;
      // Completar el nombre con un push_name de ENTRANTE si el que tenemos es solo el número/jid.
      const pn = nombreDe(r);
      if (pn && (prev.nombre === prev.telefono || prev.nombre === jidNombre(prev.chatJid) || prev.nombre === 'Você')) prev.nombre = pn;
    }
  }
  const convs = [...porChat.values()];

  // El inbox lista SOLO desde el espejo (nuestra DB): NO llama a Evolution en cada
  // poll (así el uso normal no "duplica" trabajo ni interfiere). Los chats se
  // traen al espejo A PEDIDO con "Sincronizar todo" (sincronizarDesdeEvolution),
  // y en tiempo real por el webhook. + placeholders de Nutrición-Manual.

  // Resolver leadId por teléfono para las convs sin lead (salientes sin lead_id)
  // → el enriquecido de abajo les pone empresa/etapa/nombre del CRM.
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
      if (l.nombre && (c.nombre === c.telefono || c.nombre === c.chatJid.replace(/@.*/, '') || c.nombre === 'Você')) c.nombre = l.nombre;
      if (l.pipeline_stage === 'manual') { c.etapaKey = 'manual'; c.etapaLabel = 'Nutrición - Manual'; }
      else { const et = derivarEtapa(l); c.etapaKey = et.key; c.etapaLabel = et.label; }
    }
  }

  // Nombre del contacto de WhatsApp (evolution_contactos, del evento contacts.upsert)
  // para las convs que quedaron solo con el número (sin lead ni push_name entrante).
  // Con `catch`: la agenda es un ADORNO del inbox (sin ella se ve el número), y
  // desde que la lectura pasó a paginar de verdad puede lanzar. Una agenda que
  // no se pudo leer no puede dejar al dueño sin inbox.
  const nombresContacto = await getNombresContacto().catch(() => new Map<string, string>());
  if (nombresContacto.size) for (const c of convs) {
    if (c.nombre === c.telefono || c.nombre === c.chatJid.replace(/@.*/, '') || c.nombre === 'Você') {
      const n = nombresContacto.get((c.telefono || '').replace(/\D/g, '').slice(-10));
      if (n) c.nombre = n;
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

  // Ocultos: por defecto los SACAMOS del inbox (y de MaKo). Con incluirOcultos
  // (vista "ver ocultos") los dejamos para poder desocultarlos.
  const ocultos = await telefonosOcultos();
  let salida = convs;
  if (ocultos.size) {
    const estaOculto = (c: WaConversacion) => !!c.telefono && ocultos.has(c.telefono.replace(/\D/g, ''));
    salida = incluirOcultos ? convs.filter(estaOculto) : convs.filter((c) => !estaOculto(c));
  } else if (incluirOcultos) {
    salida = []; // no hay ocultos → la vista "ver ocultos" queda vacía
  }

  // Marcar contactos bloqueados (una sola query).
  const bloq = await telefonosBloqueados();
  if (bloq.size) for (const c of salida) if (c.telefono && bloq.has(c.telefono.replace(/\D/g, ''))) c.bloqueado = true;

  // El corte a `limite` va ACÁ (conversaciones, ya ordenadas por la más reciente),
  // no en la lectura de wa_mensajes — ver comentario arriba.
  salida.sort((a, b) => (b.ultimaFecha ?? '').localeCompare(a.ultimaFecha ?? ''));
  return salida.slice(0, limite);
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
  const ocultos = await telefonosOcultos(); // los ocultos no notifican
  const porChat = new Map<string, WaResumen>();
  for (const r of rows) {
    if (ocultos.size && r.telefono && ocultos.has(r.telefono.replace(/\D/g, ''))) continue;
    const k = claveTel(r.telefono, r.chat_jid); // agrupar por teléfono (mismo criterio que el inbox)
    if (porChat.has(k)) continue; // rows vienen desc → el primero es el último mensaje
    porChat.set(k, {
      chatJid: r.chat_jid,
      nombre: (!r.from_me && r.push_name && r.push_name !== 'Você') ? r.push_name : (r.telefono || r.chat_jid.replace(/@.*/, '')),
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

// Mensajes de un chat (asc) con URLs firmadas para la multimedia. Lee SOLO del
// espejo (nuestra DB): NO trae en vivo de Evolution. Así, tras "empezar de 0" o
// en un chat no sincronizado, el hilo muestra únicamente lo capturado por el
// webhook / lo que sincronizaste — no vuelca todo el historial de Evolution.
// Matchea por TELÉFONO (últimos 10 díg.) además del jid exacto (tolera 9/@lid).
export async function getMensajesDeChat(chatJid: string, limite = 300): Promise<WaMensaje[]> {
  const supabase = await getTenantDb();
  const last10 = (normalizarTelefono(jidToNumero(chatJid)) || '').replace(/\D/g, '').slice(-10);
  let sel = supabase
    .from('wa_mensajes')
    .select('id, wa_message_id, chat_jid, from_me, tipo, texto, media_path, media_mime, wa_timestamp, status')
    .neq('tipo', 'evento')   // no ensuciamos el hilo con reacciones/protocolo
    .order('wa_timestamp', { ascending: true })
    .limit(limite);
  const jidSimple = /^[A-Za-z0-9@._:-]+$/.test(chatJid);
  if (last10.length >= 8 && jidSimple) sel = sel.or(`chat_jid.eq.${chatJid},telefono.like.%${last10}%`);
  else if (last10.length >= 8) sel = sel.like('telefono', `%${last10}%`);
  else sel = sel.eq('chat_jid', chatJid);
  const { data } = await sel;
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
  return [...porWaId.values(), ...sinId].sort((a, b) => (Date.parse(a.fecha ?? '') || 0) - (Date.parse(b.fecha ?? '') || 0));
}

const esTipoMedia = (t: string | null): boolean => t === 'image' || t === 'audio' || t === 'video' || t === 'document' || t === 'sticker';
// URL de nuestro proxy que baja el base64 de la media desde Evolution a pedido.
function proxyMedia(waId: string | null, jid: string, fromMe: boolean): string | null {
  if (!waId) return null;
  return `/api/whatsapp/evolution/mensajes?media=${encodeURIComponent(waId)}&chat=${encodeURIComponent(jid)}&fromMe=${fromMe ? 1 : 0}`;
}

// Sincroniza a pedido ("Sincronizar todo"): trae los chats de Evolution al espejo
// (texto/metadata; la media se sirve por el proxy). Canonicaliza @lid→número
// (busca el remoteJidAlt en cualquier mensaje del chat) → los ENTRANTES de
// contactos no agendados quedan bajo el número, no en un chat @lid aparte. Salta
// grupos/status/broadcast. Bulk por chat (1 match de lead + 1 upsert) para no
// timeoutear; ignoreDuplicates = no pisa lo que ya capturó el webhook.
/**
 * Debajo de esto se asume que la conversación se trajo con un tope viejo y hay
 * que volver a pedirla. Por encima, ya tiene historia de sobra y se saltea.
 * Las charlas realmente cortas se re-piden cada vez, pero cuestan una request
 * chica y son minoría.
 */
const MINIMO_COMPLETO = 120;

export async function sincronizarDesdeEvolution(): Promise<{ chats: number; mensajes: number }> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { chats: 0, mensajes: 0 };
  const instance = instanceNameDeWs(ws);
  const supabase = await getTenantDb();
  // La agenda primero, en UNA request: findChats casi no trae nombres (solo el
  // que el contacto se puso a sí mismo), y sin esto la lista queda llena de
  // números crudos. Best-effort — si falla, se sigue igual.
  try {
    await upsertContactosLote(await fetchContactosEvolution());
  } catch { /* sin agenda */ }

  const chats = await fetchChatsEvolution().catch(() => [] as Awaited<ReturnType<typeof fetchChatsEvolution>>);
  let nChat = 0, nMsg = 0;
  // TODOS los chats, no los primeros 100: el número de prueba tenía 398 y se
  // miraban 100, así que las tres cuartas partes no existían para MaKo. Se
  // ordenan por actividad para que, si el tiempo se acaba, lo que entró sea lo
  // más reciente y no lo que Evolution devolvió primero.
  const orden = [...chats].sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));

  // Lo que YA está en el espejo, para no volver a pedirlo. Con 400 chats el
  // recorrido no entra en una sola request: sin esto, cada intento arrancaba
  // otra vez desde el más reciente y se quedaba siempre en la misma mitad — el
  // dueño apretaba el botón tres veces y no avanzaba nunca.
  const yaEspejado = new Map<string, { ultimo: string; cuantos: number }>();
  try {
    // Por página y no `leerTodo`: de cada mensaje solo sobrevive un contador en
    // el Map, no hay motivo para tener 20.000 filas vivas a la vez.
    await leerPorPaginas<{ chat_jid: string; wa_timestamp: string | null }>(
      supabase, 'wa_mensajes', 'chat_jid, wa_timestamp',
      (filas, nro) => {
        for (const f of filas) {
          const e = yaEspejado.get(f.chat_jid);
          // El primero que aparece es el más nuevo (viene ordenado desc).
          if (e) e.cuantos += 1;
          else yaEspejado.set(f.chat_jid, { ultimo: f.wa_timestamp ?? '', cuantos: 1 });
        }
        return nro < TOPE_PAGINAS_ESPEJO;
      },
      { orden: ORDEN_ESPEJO },
    );
  } catch { /* sin espejo previo, se recorre todo */ }

  const limite = Date.now() + 240_000;
  for (const ch of orden) {
    if (Date.now() > limite) break;
    const rawJid = ch.remoteJid || '';
    if (!rawJid || rawJid.endsWith('@g.us') || rawJid.endsWith('@newsletter') || rawJid.startsWith('status@') || rawJid.includes('broadcast')) continue;
    // Se saltea solo lo que ya está COMPLETO: sin mensajes nuevos Y con historia
    // suficiente guardada.
    //
    // Mirar únicamente la fecha fue un error caro: las conversaciones traídas
    // con el tope viejo de 60 mensajes no tenían actividad nueva, así que se
    // salteaban para siempre y nunca se expandían. Solo crecían las cuatro que
    // habían recibido un mensaje después. El umbral las obliga a pasar una vez
    // más por el importador, y de ahí en adelante quedan quietas.
    const visto = yaEspejado.get(rawJid);
    const sinNovedad = visto && ch.updatedAt && new Date(String(ch.updatedAt)).toISOString() <= visto.ultimo;
    if (sinNovedad && visto.cuantos >= MINIMO_COMPLETO) continue;
    // 60 era el número que dejaba el espejo en nada: hay chats con más de 2.000
    // mensajes en Evolution. Se traen los 300 más recientes y los 100 del
    // arranque, que es lo que el paso "Tu forma de escribir" necesita leer.
    const { mensajes: recs } = await fetchConversacionEvolution(rawJid, { recientes: 300, arranque: 100 })
      .catch(() => ({ mensajes: [] as EvRecord[], total: 0 }));
    if (!recs.length) continue;
    // Canonical del chat: el número real de CUALQUIER mensaje (remoteJidAlt/senderPn).
    let chatJid = rawJid;
    for (const rec of recs) { const cj = jidCanonico(rec.key); if (cj && !cj.endsWith('@lid')) { chatJid = cj; break; } }
    if (chatJid.endsWith('@g.us') || chatJid.endsWith('@newsletter') || chatJid.startsWith('status@') || chatJid.includes('broadcast')) continue;
    nChat += 1;
    // findChats YA devuelve el nombre y la foto del contacto: descartarlos
    // dejaba la lista mostrando números crudos, y obligaba a esperar a que el
    // webhook de contacts.upsert disparara alguna vez. Best-effort, como el
    // resto del importador.
    if (ch.pushName || ch.profilePicUrl) {
      await upsertContacto(chatJid, ch.pushName ?? null, ch.profilePicUrl ?? null).catch(() => {});
    }
    // Mismo cuidado que en guardarMensajeUpsert: un chatJid que sigue en @lid no
    // tiene número real conocido — guardar su ID como teléfono es peor que nada.
    const telefono = chatJid.endsWith('@lid') ? null : normalizarTelefono(jidToNumero(chatJid));
    const leadId = telefono ? await matchLeadPorTelefono(telefono) : null;
    const filas: Record<string, unknown>[] = [];
    for (const rec of recs) {
      const key = rec.key;
      if (!key?.id) continue;
      const c = extraerContenido(rec as UpsertData);
      if (c.tipo === 'evento' || c.tipo === 'otro') continue;
      filas.push({
        instance_name: instance, chat_jid: chatJid, telefono,
        wa_message_id: key.id, from_me: !!key.fromMe, tipo: c.tipo, texto: c.texto,
        media_path: null, media_mime: c.mediaMime, status: statusDeRecord(rec),
        push_name: key.fromMe ? null : (rec.pushName ?? null), lead_id: leadId,
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

// Borra TODO el espejo de mensajes no oficial del workspace (empezar de 0). Scopeado.
export async function borrarEspejoNoOficial(): Promise<number> {
  const supabase = await getTenantDb();
  const { count } = await supabase.from('wa_mensajes').delete({ count: 'exact' }).gte('id', 0);
  return count ?? 0;
}

// ── Por-chat (sincronizar / borrar SOLO una conversación) ────────────────────
// Sincroniza UN chat: trae su historial de Evolution (por el número y por su @lid)
// al espejo, canonicalizado al número. Para "traer este chat" sin traer todos.
export async function sincronizarChat(chatJid: string): Promise<{ mensajes: number }> {
  const ws = await getWorkspaceActual();
  if (ws == null || !chatJid) return { mensajes: 0 };
  const instance = instanceNameDeWs(ws);
  const supabase = await getTenantDb();
  const num = jidToNumero(chatJid) || '';
  const telefono = normalizarTelefono(num);
  const lid = await fetchLidDeNumero(telefono || num).catch(() => null);
  const jids = [...new Set([chatJid, lid].filter((x): x is string => !!x))];
  const recs: EvRecord[] = [];
  for (const jid of jids) recs.push(...(await fetchMensajesEvolution(jid, 100).catch(() => [] as EvRecord[])));
  if (!recs.length) return { mensajes: 0 };
  let canon = chatJid;
  for (const rec of recs) { const cj = jidCanonico(rec.key); if (cj && !cj.endsWith('@lid')) { canon = cj; break; } }
  const leadId = telefono ? await matchLeadPorTelefono(telefono) : null;
  const filas: Record<string, unknown>[] = [];
  const vistos = new Set<string>();
  for (const rec of recs) {
    const key = rec.key;
    if (!key?.id || vistos.has(key.id)) continue;
    vistos.add(key.id);
    const c = extraerContenido(rec as UpsertData);
    if (c.tipo === 'evento' || c.tipo === 'otro') continue;
    filas.push({
      instance_name: instance, chat_jid: canon, telefono, wa_message_id: key.id,
      from_me: !!key.fromMe, tipo: c.tipo, texto: c.texto, media_path: null, media_mime: c.mediaMime,
      status: statusDeRecord(rec), push_name: key.fromMe ? null : (rec.pushName ?? null), lead_id: leadId,
      wa_timestamp: tsToISO(rec.messageTimestamp), raw: rec as unknown as Record<string, unknown>,
    });
  }
  if (filas.length) await supabase.from('wa_mensajes').upsert(filas, { onConflict: 'workspace_id,wa_message_id', ignoreDuplicates: true });
  return { mensajes: filas.length };
}

// Borra el espejo de UNA conversación (por teléfono últimos-10, o jid exacto).
export async function borrarChat(chatJid: string): Promise<number> {
  const supabase = await getTenantDb();
  const last10 = (normalizarTelefono(jidToNumero(chatJid)) || '').replace(/\D/g, '').slice(-10);
  const del = supabase.from('wa_mensajes').delete({ count: 'exact' });
  const { count } = await (last10.length >= 8 ? del.like('telefono', `%${last10}%`) : del.eq('chat_jid', chatJid));
  return count ?? 0;
}
