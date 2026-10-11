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

/**
 * La BIBLIOTECA del dueño: sólo lo que él subió (`origen = 'biblioteca'`, mig 0251). Las notas de voz con que
 * un AI Step contesta a cada lead (`origen: 'ai_step'`, AI Step v2) también viven en esta tabla —el borrador y
 * `enviarBorrador` las buscan por id— pero NO son de la biblioteca: sin el filtro, cada respuesta en audio
 * le llenaba la lista de audios al dueño.
 *
 * ⚠️ SIN LA COLUMNA (la migración todavía no se aplicó: 42703) se lee como antes, sin filtro: no hay
 * respuestas en audio que esconder, porque guardarlas exige la columna (`crearAudio` con `origen`).
 */
export async function listAudios(): Promise<AudioSetting[]> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase.from('setting_audios').select(COLS).eq('origen', 'biblioteca').order('created_at', { ascending: false });
  if (error && esColumnaQueFalta(error)) {
    const viejo = await supabase.from('setting_audios').select(COLS).order('created_at', { ascending: false });
    if (viejo.error) throw new Error(`listAudios: ${viejo.error.message}`);
    return (viejo.data ?? []) as AudioSetting[];
  }
  if (error) throw new Error(`listAudios: ${error.message}`);
  return (data ?? []) as AudioSetting[];
}

/** La columna que no existe (Postgres 42703, PostgREST PGRST204): NO la tabla que falta. */
function esColumnaQueFalta(e: { code?: string; message?: string }): boolean {
  return e.code === '42703' || e.code === 'PGRST204' || /column .*origen.* does not exist/i.test(e.message ?? '');
}

/**
 * Sube una nota de voz a la biblioteca. Transcribe con el STT barato para que
 * MaKo sepa QUÉ dice el audio (lo usa el generador y el simulador: sin esto, un
 * paso de audio es una caja negra para la IA).
 */
export async function crearAudio(input: {
  titulo: string; base64: string; mime?: string; duracionS?: number | null;
  /** Lo que dice el audio, si ya se sabe (la respuesta de un AI Step: es el texto que leyó la voz). Sin STT. */
  transcript?: string | null;
  /** De dónde sale: la biblioteca del dueño (default) o una respuesta de un AI Step (no se lista). */
  origen?: 'biblioteca' | 'ai_step';
}): Promise<AudioSetting> {
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

  // Transcripción best-effort: si falla, el audio igual queda usable. Si ya se sabe lo que dice, no se paga el STT.
  let transcript: string | null = input.transcript?.trim() || null;
  if (!transcript) { try { transcript = (await transcribirAudio(b64, mime)).trim() || null; } catch { transcript = null; } }

  // `origen` va SÓLO si no es la biblioteca: así subir un audio a la biblioteca no depende de la mig 0251, y una
  // respuesta de un AI Step sin la columna FALLA (y sale en texto) en vez de caer en la lista del dueño.
  const { data, error } = await supabase
    .from('setting_audios')
    .insert({
      titulo: input.titulo.trim() || 'Audio sin título', media_path: path, media_mime: mime, duracion_s: input.duracionS ?? null, transcript,
      ...(input.origen && input.origen !== 'biblioteca' ? { origen: input.origen } : {}),
    })
    .select(COLS)
    .single();
  if (error) throw new Error(`crearAudio: ${error.message}`);
  return data as AudioSetting;
}

export async function borrarAudio(id: number): Promise<void> {
  const ws = (await getWorkspaceActual()) ?? OWNER_WS;
  const supabase = await getTenantDb();
  const { data } = await supabase.from('setting_audios').select('media_path').eq('id', id).maybeSingle();
  const path = (data as { media_path?: string } | null)?.media_path;
  const { error } = await supabase.from('setting_audios').delete().eq('id', id);
  if (error) throw new Error(`borrarAudio: ${error.message}`);
  // El binario se borra SOLO si vive bajo el prefijo de este workspace.
  //
  // El scoping por workspace intercepta `.from()`, no `.storage`: cualquier path
  // llega al service_role sin filtro. Y "Completar con los datos de Mau" copia la
  // fila de un audio con su `media_path` apuntando al prefijo del DUEÑO. Sin esta
  // guarda, borrar ese audio desde el cliente de prueba borraba el archivo real
  // de Mauricio y le dejaba la fila viva apuntando a la nada. La fila copiada sí
  // se borra; el archivo del dueño no se toca.
  if (path && path.startsWith(`${ws}/`)) {
    try { await supabase.storage.from(MEDIA_BUCKET).remove([path]); } catch { /* huérfano tolerable */ }
  }
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
/**
 * URL para escuchar el audio en la app. Vive 12 horas y no una, y el motivo es
 * concreto: la lista se pide UNA vez al abrir la pantalla y las URLs quedan en
 * el DOM toda la sesión. Un onboarding real —grabar tres notas de voz y después
 * recorrer nueve escenarios— pasa la hora sin esfuerzo, y ahí los audios dejaban
 * de sonar sin ningún error visible: el archivo estaba perfecto, el link había
 * vencido. Lo mismo al dejar la pestaña abierta y volver después de comer.
 *
 * El bucket sigue siendo privado; esto solo alarga la ventana de un link que ya
 * es imposible de adivinar (lleva una firma HMAC del path).
 */
const HORAS_URL = 12;

export async function audioUrlFirmada(path: string): Promise<string | null> {
  try {
    const supabase = await getTenantDb();
    const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, HORAS_URL * 3600);
    return data?.signedUrl ?? null;
  } catch { return null; }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
