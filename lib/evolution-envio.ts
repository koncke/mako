// =============================================================================
// Envío por WhatsApp NO oficial (Evolution) + cola de borradores — F2.3
// =============================================================================
// Regla dura del PDF: a leads CALIENTES nunca automático directo → se deposita
// un BORRADOR que el setter manda con 1 clic. Automático directo SOLO a clientes
// que ya pagaron (riesgo bajo). Acá viven: enviarYEspejar (manda + espeja el
// saliente), la clasificación del lead, y el CRUD de la cola de borradores.

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { enviarTexto, enviarMedia, enviarAudio } from '@/lib/evolution';
import { subirMediaSaliente, extDeMime } from '@/lib/evolution-media';

const ahoraISO = () => new Date().toISOString();

// ¿El lead ya PAGÓ? Solo entonces el no oficial le manda automático directo
// (riesgo de ban bajo). Regla dura del PDF = "ya pagó" → gateamos por
// fecha_primer_pago EXCLUSIVAMENTE. Un 'ganado' sin pago registrado (p.ej.
// confirmó verbal pero no pagó — cohorte confirmado_sin_pago) NO califica: cae a
// borrador (más seguro). Si un cliente real no tiene la fecha cargada, el setter
// lo manda a mano desde la cola — nunca se dispara solo a un lead sin pago.
export async function esLeadCliente(leadId: number): Promise<boolean> {
  const supabase = await getTenantDb();
  const { data } = await supabase.from('leads').select('fecha_primer_pago').eq('id', leadId).maybeSingle();
  return !!(data as { fecha_primer_pago?: string | null } | null)?.fecha_primer_pago;
}

// ¿El lead ya tiene un borrador de nutrición PENDIENTE? → no apilar otro (el
// motor espera a que el setter lo mande/descarte antes de seguir la cadencia).
export async function tieneBorradorNutriPendiente(leadId: number): Promise<boolean> {
  const supabase = await getTenantDb();
  const { count } = await supabase.from('wa_borradores')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId).eq('origen', 'nutricion').eq('estado', 'pendiente');
  return (count ?? 0) > 0;
}

// Envía un texto por el no oficial y espeja el saliente en wa_mensajes (para que
// aparezca en el hilo). Devuelve el id del mensaje o el error.
export async function enviarYEspejar(params: { telefono: string; texto: string; leadId?: number | null; chatJid?: string | null }): Promise<{ ok: boolean; error?: string }> {
  const r = await enviarTexto(params.telefono, params.texto);
  if (!r.ok) return { ok: false, error: r.error };
  // Espejo del saliente SOLO si Evolution devolvió el id real: así el eco del
  // webhook (mismo id) hace dedup por wa_message_id. Sin id real, dejamos que el
  // webhook materialice el saliente (evita una fila 'local-…' duplicada).
  if (r.id) {
    const supabase = await getTenantDb();
    await supabase.from('wa_mensajes').upsert({
      instance_name: '',
      chat_jid: r.chatJid,
      telefono: (params.telefono || '').replace(/\D/g, '') || null,
      wa_message_id: r.id,
      from_me: true,
      tipo: 'text',
      texto: params.texto,
      lead_id: params.leadId ?? null,
      wa_timestamp: ahoraISO(),
      raw: { local: true },
    }, { onConflict: 'workspace_id,wa_message_id', ignoreDuplicates: true }); // si ya llegó el eco del webhook, gana esa fila (más rica)
  }
  return { ok: true };
}

// Envía media (imagen/documento/video) por el no oficial y espeja el saliente en
// wa_mensajes (sube el binario a wa-media). Mismo patrón de dedup por el eco del webhook.
export async function enviarMediaYEspejar(params: {
  telefono: string; media: { base64: string; mimetype: string; fileName?: string; tipo: 'image' | 'video' | 'document' };
  caption?: string; leadId?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const r = await enviarMedia(params.telefono, params.media, params.caption);
  if (!r.ok) return { ok: false, error: r.error };
  if (r.id) {
    const path = await subirMediaSaliente(r.id, params.media.base64, params.media.mimetype, extDeMime(params.media.mimetype));
    const supabase = await getTenantDb();
    await supabase.from('wa_mensajes').upsert({
      instance_name: '', chat_jid: r.chatJid, telefono: (params.telefono || '').replace(/\D/g, '') || null,
      wa_message_id: r.id, from_me: true, tipo: params.media.tipo,
      texto: params.caption || null, media_path: path, media_mime: params.media.mimetype,
      lead_id: params.leadId ?? null, wa_timestamp: ahoraISO(), raw: { local: true },
      // NO ignoreDuplicates: nuestra fila (con el binario ya subido) es la
      // autoritativa del saliente; si el eco del webhook (sin media) insertó
      // primero, la actualizamos para que la media se vea igual.
    }, { onConflict: 'workspace_id,wa_message_id' });
  }
  return { ok: true };
}

// Envía una nota de voz por el no oficial y la espeja como tipo='audio'.
export async function enviarAudioYEspejar(params: { telefono: string; base64: string; mimetype?: string; leadId?: number | null }): Promise<{ ok: boolean; error?: string }> {
  const r = await enviarAudio(params.telefono, params.base64);
  if (!r.ok) return { ok: false, error: r.error };
  if (r.id) {
    const mime = params.mimetype || 'audio/ogg';
    const path = await subirMediaSaliente(r.id, params.base64, mime, extDeMime(mime));
    const supabase = await getTenantDb();
    await supabase.from('wa_mensajes').upsert({
      instance_name: '', chat_jid: r.chatJid, telefono: (params.telefono || '').replace(/\D/g, '') || null,
      wa_message_id: r.id, from_me: true, tipo: 'audio',
      texto: null, media_path: path, media_mime: mime,
      lead_id: params.leadId ?? null, wa_timestamp: ahoraISO(), raw: { local: true },
      // NO ignoreDuplicates: nuestra fila (con el binario ya subido) es la
      // autoritativa del saliente; si el eco del webhook (sin media) insertó
      // primero, la actualizamos para que la media se vea igual.
    }, { onConflict: 'workspace_id,wa_message_id' });
  }
  return { ok: true };
}

// ── Cola de borradores ────────────────────────────────────────────────────────
export type Borrador = {
  id: number; leadId: number | null; telefono: string; texto: string;
  origen: string; secuenciaId: number | null; paso: number | null;
  leadNombre: string | null; estado: string; createdAt: string;
};

export async function crearBorrador(input: {
  leadId?: number | null; telefono: string; texto: string; chatJid?: string | null;
  origen?: string; secuenciaId?: number | null; paso?: number | null; inscripcionId?: number | null;
}): Promise<void> {
  const supabase = await getTenantDb();
  // upsert anti-duplicado del toque (índice único parcial por inscripcion+paso).
  const fila = {
    lead_id: input.leadId ?? null,
    telefono: (input.telefono || '').replace(/\D/g, ''),
    chat_jid: input.chatJid ?? null,
    texto: input.texto,
    origen: input.origen ?? 'nutricion',
    secuencia_id: input.secuenciaId ?? null,
    paso: input.paso ?? null,
    inscripcion_id: input.inscripcionId ?? null,
    estado: 'pendiente',
  };
  if (input.inscripcionId != null && input.paso != null) {
    await supabase.from('wa_borradores').upsert(fila, { onConflict: 'workspace_id,inscripcion_id,paso', ignoreDuplicates: true });
  } else {
    await supabase.from('wa_borradores').insert(fila);
  }
}

export async function contarBorradores(): Promise<number> {
  const supabase = await getTenantDb();
  const { count } = await supabase.from('wa_borradores').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente');
  return count ?? 0;
}

export async function listBorradores(): Promise<Borrador[]> {
  const supabase = await getTenantDb();
  const { data } = await supabase
    .from('wa_borradores')
    .select('id, lead_id, telefono, texto, origen, secuencia_id, paso, estado, created_at, leads(nombre)')
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true })
    .limit(200);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as number,
    leadId: (r.lead_id as number | null) ?? null,
    telefono: (r.telefono as string) ?? '',
    texto: (r.texto as string) ?? '',
    origen: (r.origen as string) ?? 'nutricion',
    secuenciaId: (r.secuencia_id as number | null) ?? null,
    paso: (r.paso as number | null) ?? null,
    leadNombre: ((r.leads as { nombre?: string } | null)?.nombre) ?? null,
    estado: (r.estado as string) ?? 'pendiente',
    createdAt: (r.created_at as string) ?? '',
  }));
}

// Envía un borrador pendiente (setter, 1 clic) y lo marca enviado. CLAIM ATÓMICO:
// el UPDATE ... WHERE estado='pendiente' hace la exclusión mutua en la DB, así
// dos setters (o un doble-clic) no mandan el mismo mensaje dos veces al lead.
export async function enviarBorrador(id: number, porEmail: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getTenantDb();
  const { data: claimed } = await supabase.from('wa_borradores')
    .update({ estado: 'enviando' })
    .eq('id', id).eq('estado', 'pendiente')
    .select('id, telefono, texto, lead_id, chat_jid');
  const b = ((claimed ?? []) as Array<{ id: number; telefono: string; texto: string; lead_id: number | null; chat_jid: string | null }>)[0];
  if (!b) return { ok: false, error: 'el borrador ya no está pendiente' };

  const r = await enviarYEspejar({ telefono: b.telefono, texto: b.texto, leadId: b.lead_id, chatJid: b.chat_jid });
  if (!r.ok) {
    // Falló el envío → devolvemos el borrador a 'pendiente' para reintentar.
    await supabase.from('wa_borradores').update({ estado: 'pendiente' }).eq('id', id);
    return { ok: false, error: r.error };
  }
  await supabase.from('wa_borradores').update({ estado: 'enviado', enviado_at: ahoraISO(), enviado_por: porEmail }).eq('id', id);
  return { ok: true };
}

export async function descartarBorrador(id: number): Promise<void> {
  const supabase = await getTenantDb();
  await supabase.from('wa_borradores').update({ estado: 'descartado' }).eq('id', id);
}
