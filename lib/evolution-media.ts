// =============================================================================
// evolution-media — subida de multimedia de WhatsApp no oficial al bucket wa-media
// =============================================================================
// Módulo HOJA (leaf): solo storage + resolución de path. Vive separado para que
// tanto el ESPEJO DEL ENTRANTE (evolution-mensajes → nutricion) como el ESPEJO
// DEL SALIENTE (evolution-envio) lo usen SIN cerrar un ciclo de imports
// (evolution-envio → evolution-mensajes → nutricion → evolution-envio).

import 'server-only';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { OWNER_WS } from '@/lib/auth-session';
import { instanceNameDeWs } from '@/lib/evolution';

export const MEDIA_BUCKET = 'wa-media';

// Sube la media a wa-media (path prefijado por workspace_id). Best-effort:
// devuelve null si falla — el mensaje se guarda igual y el raw permite reintentar.
export async function subirMedia(ws: number, instance: string, msgId: string, base64: string, mime: string, ext: string): Promise<string | null> {
  try {
    const b64 = base64.includes(',') ? base64.split(',').pop()! : base64; // por si viene como data-URI
    const buf = Buffer.from(b64, 'base64');
    if (buf.length === 0 || buf.length > 25 * 1024 * 1024) return null; // vacío o >25MB → salteo
    const safeId = msgId.replace(/[^a-zA-Z0-9_-]/g, '');
    const path = `${ws}/${instance}/${safeId}.${ext}`;
    const supabase = await getTenantDb();
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, buf, { contentType: mime, upsert: true });
    return error ? null : path;
  } catch { return null; }
}

// Espejo del SALIENTE con media (imagen/audio/doc que mandamos nosotros): sube al
// MISMO bucket/convención que el entrante. Resuelve ws + instance por su cuenta.
export async function subirMediaSaliente(msgId: string, base64: string, mime: string, ext: string): Promise<string | null> {
  const ws = (await getWorkspaceActual()) ?? OWNER_WS;
  return subirMedia(ws, instanceNameDeWs(ws), msgId, base64, mime, ext);
}

// Extensión de archivo por MIME (para el path del bucket). Fallback 'bin'. Vive en el módulo
// puro de la biblioteca de archivos para que un test la pueda importar (éste es `server-only`);
// antes no conocía docx ni xlsx y el espejo los guardaba como `.bin`.
export { extDeMime } from './setting-adjuntos-reglas';
