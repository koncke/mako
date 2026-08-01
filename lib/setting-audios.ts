// =============================================================================
// setting-audios — biblioteca de notas de voz del dueño (mig 0108)
// =============================================================================
// La reunión del 31/07 definió que el vehículo de la nutrición por WhatsApp son
// AUDIOS grabados por el dueño con su propia voz, estandarizados (el mismo para
// todos). Acá se suben, se listan y se bajan para que el motor los mande por
// Evolution (enviarAudioYEspejar) — el canal no oficial, decisión de Martín:
// una nota de voz NO cabe en una plantilla aprobada por Meta.
//
// El binario vive en el bucket wa-media (mismo que el espejo del no oficial);
// esta tabla es solo el catálogo por workspace.

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { OWNER_WS } from './auth-session';
import { MEDIA_BUCKET, extDeMime } from './evolution-media';
import { transcribirAudio } from './ai-cheap';

export type AudioSetting = {
  id: number;
  titulo: string;
  media_path: string;
  media_mime: string;
  duracion_s: number | null;
  transcript: string | null;
  created_at: string;
};

const COLS = 'id, titulo, media_path, media_mime, duracion_s, transcript, created_at';

export async function listAudios(): Promise<AudioSetting[]> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase.from('setting_audios').select(COLS).order('created_at', { ascending: false });
  if (error) throw new Error(`listAudios: ${error.message}`);
  return (data ?? []) as AudioSetting[];
}

/**
 * Sube una nota de voz a la biblioteca. Transcribe con el STT barato para que
 * MaKo sepa QUÉ dice el audio (lo usa el generador y el simulador: sin esto, un
 * paso de audio es una caja negra para la IA).
 */
export async function crearAudio(input: { titulo: string; base64: string; mime?: string; duracionS?: number | null }): Promise<AudioSetting> {
  const mime = input.mime || 'audio/ogg';
  const b64 = input.base64.includes(',') ? input.base64.split(',').pop()! : input.base64;
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) throw new Error('El audio está vacío.');
  if (buf.length > 16 * 1024 * 1024) throw new Error('El audio es muy pesado (máx 16 MB).');

  const ws = (await getWorkspaceActual()) ?? OWNER_WS;
  const supabase = await getTenantDb();
  const path = `${ws}/setting-audios/${Date.now().toString(36)}-${Math.abs(hash(input.titulo))}.${extDeMime(mime)}`;
  const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(path, buf, { contentType: mime, upsert: false });
  if (upErr) throw new Error(`No se pudo guardar el audio: ${upErr.message}`);

  // Transcripción best-effort: si falla, el audio igual queda usable.
  let transcript: string | null = null;
  try { transcript = (await transcribirAudio(b64, mime)).trim() || null; } catch { transcript = null; }

  const { data, error } = await supabase
    .from('setting_audios')
    .insert({ titulo: input.titulo.trim() || 'Audio sin título', media_path: path, media_mime: mime, duracion_s: input.duracionS ?? null, transcript })
    .select(COLS)
    .single();
  if (error) throw new Error(`crearAudio: ${error.message}`);
  return data as AudioSetting;
}

export async function borrarAudio(id: number): Promise<void> {
  const supabase = await getTenantDb();
  const { data } = await supabase.from('setting_audios').select('media_path').eq('id', id).maybeSingle();
  const path = (data as { media_path?: string } | null)?.media_path;
  const { error } = await supabase.from('setting_audios').delete().eq('id', id);
  if (error) throw new Error(`borrarAudio: ${error.message}`);
  if (path) { try { await supabase.storage.from(MEDIA_BUCKET).remove([path]); } catch { /* huérfano tolerable */ } }
}

/** Un audio del workspace actual por id (o null si no existe/es de otro ws). */
export async function getAudio(id: number): Promise<AudioSetting | null> {
  const supabase = await getTenantDb();
  const { data } = await supabase.from('setting_audios').select(COLS).eq('id', id).maybeSingle();
  return (data as AudioSetting | null) ?? null;
}

/** Binario en base64 para mandarlo por Evolution. null si no se pudo bajar. */
export async function audioBase64(a: Pick<AudioSetting, 'media_path'>): Promise<string | null> {
  try {
    const supabase = await getTenantDb();
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).download(a.media_path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer()).toString('base64');
  } catch { return null; }
}

/** URL firmada para escuchar el audio en la UI (1 hora). */
export async function audioUrlFirmada(path: string): Promise<string | null> {
  try {
    const supabase = await getTenantDb();
    const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  } catch { return null; }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
