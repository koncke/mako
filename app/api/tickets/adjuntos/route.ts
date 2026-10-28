// =============================================================================
// /api/tickets/adjuntos — sube lo que se adjunta en el chat de Soporte (28/10/2026)
// =============================================================================
// Las capturas, fotos, PDF y documentos de un ticket (lib/tickets-adjuntos.ts dice por qué). Recibe los archivos, los guarda en
// el bucket privado `archivero` en `<ws>/tickets/<uuid>` (el negocio es el de la SESIÓN, nunca uno que mande el navegador) y
// devuelve sus referencias, que el chat manda con el mensaje o con el ticket. No crea nada en el ticket: eso lo hace la acción,
// que vuelve a validar cada referencia contra el negocio (`sanearAdjuntosTicket`).
// =============================================================================

import { randomUUID } from 'node:crypto';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { BUCKET_ADJUNTOS } from '@/lib/chart-chats';
import { TOPE_NOMBRE_ADJUNTO, mimeDeArchivoTicket, problemaDeAdjuntosTicket, rutaDeAdjuntoTicket, type AdjuntoTicket } from '@/lib/tickets-adjuntos';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await getUsuarioActual())) return Response.json({ ok: false, error: 'Se cerró tu sesión: vuelve a entrar.' }, { status: 401 });
  const ws = await getWorkspaceActual().catch(() => null);
  if (ws == null) return Response.json({ ok: false, error: 'No sé de qué negocio es: recarga la página.' }, { status: 400 });
  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ ok: false, error: 'No llegaron los archivos: vuelve a mandarlos.' }, { status: 400 }); }
  const archivos = form.getAll('archivos').filter((f): f is File => f instanceof File);
  if (!archivos.length) return Response.json({ ok: false, error: 'No llegó ningún archivo.' }, { status: 400 });
  const problema = problemaDeAdjuntosTicket(archivos);
  if (problema) return Response.json({ ok: false, error: problema }, { status: 400 });
  const bucket = getSupabaseServer().storage.from(BUCKET_ADJUNTOS);
  const adjuntos: AdjuntoTicket[] = [];
  for (const f of archivos) {
    const mime = mimeDeArchivoTicket(f.name, f.type)!;
    const path = rutaDeAdjuntoTicket(ws, randomUUID());
    const { error } = await bucket.upload(path, Buffer.from(await f.arrayBuffer()), { contentType: mime, upsert: false });
    if (error) {
      console.error(`[tickets:adjunto] no pude guardar «${f.name}»: ${error.message}`);
      return Response.json({ ok: false, error: `No pude guardar «${f.name}»: vuelve a mandarlo.` }, { status: 502 });
    }
    adjuntos.push({ path, nombre: f.name.trim().slice(0, TOPE_NOMBRE_ADJUNTO) || 'archivo', mime, bytes: f.size });
  }
  return Response.json({ ok: true, adjuntos });
}
