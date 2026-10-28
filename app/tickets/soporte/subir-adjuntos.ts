// =============================================================================
// Sube los archivos del chat de Soporte y devuelve sus referencias (28/10/2026): lib/tickets-adjuntos.ts dice por qué.
// =============================================================================
// ⚠️ SE LEE COMO TEXTO ANTES DE PARSEAR: lo que corta Vercel antes de la ruta (un 413 de más de 4,5 MB) no es JSON.
// ⚠️ Una foto grande del teléfono se achica antes (la misma `achicarImagen` de los chats de MaKo): una captura chica va tal cual.

import { achicarImagen } from '@/app/m/mako/achicar-imagen';
import { problemaDeAdjuntosTicket, type AdjuntoTicket } from '@/lib/tickets-adjuntos';

const ACHICAR_DESDE = 1_500_000;

export async function subirAdjuntosTicket(archivos: readonly File[]): Promise<{ ok: true; adjuntos: AdjuntoTicket[] } | { ok: false; error: string }> {
  const listos: File[] = [];
  for (const f of archivos) {
    try { listos.push(f.type.startsWith('image/') && f.type !== 'image/gif' && f.size > ACHICAR_DESDE ? await achicarImagen(f) : f); }
    catch { return { ok: false, error: `No pude leer «${f.name}»: elígelo de nuevo.` }; }
  }
  const problema = problemaDeAdjuntosTicket(listos);
  if (problema) return { ok: false, error: problema };
  const fd = new FormData();
  for (const f of listos) fd.append('archivos', f, f.name);
  let r: Response;
  try { r = await fetch('/api/tickets/adjuntos', { method: 'POST', body: fd, signal: AbortSignal.timeout(90_000) }); }
  catch { return { ok: false, error: 'No hay conexión: los archivos no subieron. Vuelve a mandarlos.' }; }
  if (r.status === 413) return { ok: false, error: 'Los archivos pesan demasiado juntos: manda menos, o en otro mensaje.' };
  let o: { ok?: boolean; error?: string; adjuntos?: AdjuntoTicket[] } = {};
  try { o = JSON.parse(await r.text()); } catch { return { ok: false, error: `No pude subir los archivos (error ${r.status}). Vuelve a mandarlos.` }; }
  if (!r.ok || !o.ok || !Array.isArray(o.adjuntos)) return { ok: false, error: o.error || `No pude subir los archivos (error ${r.status}).` };
  return { ok: true, adjuntos: o.adjuntos };
}
