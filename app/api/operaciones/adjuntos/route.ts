// =============================================================================
// POST /api/operaciones/adjuntos — las fotos y los PDF de la caja del Ops Center (17/10/2026)
// =============================================================================
// La caja sube acá lo que se adjuntó (o se pegó con Ctrl+V) ANTES de firmar el trabajo: esto devuelve dónde quedó cada
// archivo (`ref`), y el navegador firma el trabajo con el `ref` y el sha256 que calculó ÉL sobre lo que subió. La PC sólo
// baja lo que nombra un trabajo firmado (lib/operaciones-adjuntos.ts, cartero.mjs → bajarAdjuntos).
//
// ⚠️ ES UNA RUTA Y NO UNA SERVER ACTION: una action corta el cuerpo en 1 MB y una captura pesa más. Vercel corta en
//    ~4,5 MB con un 413 en texto plano: el tope es el del chat con MaKo (4 MB en total) y se mira ANTES de leer.
// ⚠️ LA GUARDA ES LA DEL CENTRO: `getSesionAdmin` + `puedeOperar` (el workspace de la plataforma, con segundo factor),
//    antes de leer el cuerpo. No está en PUBLICOS (tests/operaciones.test.ts).

import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { puedeOperar } from '@/lib/operaciones-reglas';
import { ERROR_ADJUNTO, MARGEN_MULTIPART_BYTES, TOPE_TOTAL_BYTES } from '@/lib/mako-adjuntos';
import { subirAdjuntosCentro } from '@/lib/operaciones-adjuntos';

export const dynamic = 'force-dynamic';

const json = (cuerpo: Record<string, unknown>, status = 200) => Response.json(cuerpo, { status });

export async function POST(req: Request) {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return json({ ok: false, error: 'Entra con tu segundo factor para usar el Centro.' }, 403);
  const largo = Number(req.headers.get('content-length') ?? 0);
  if (largo > TOPE_TOTAL_BYTES + MARGEN_MULTIPART_BYTES) return json({ ok: false, error: ERROR_ADJUNTO.pesado }, 413);
  let archivos: File[];
  try {
    archivos = (await req.formData()).getAll('adjuntos').filter((f): f is File => f instanceof File);
  } catch {
    return json({ ok: false, error: 'No llegó ningún archivo.' }, 400);
  }
  if (archivos.reduce((n, f) => n + f.size, 0) > TOPE_TOTAL_BYTES) return json({ ok: false, error: ERROR_ADJUNTO.pesado }, 413);
  try {
    const leidos = await Promise.all(archivos.map(async (f) => ({ nombre: f.name, mime: f.type, bytes: new Uint8Array(await f.arrayBuffer()) })));
    const r = await subirAdjuntosCentro(leidos);
    return r.ok ? json({ ok: true, adjuntos: r.adjuntos }) : json({ ok: false, error: r.error }, 400);
  } catch (e) {
    console.error('[operaciones/adjuntos]', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No pude guardarlo: vuelve a intentarlo.' }, 503);
  }
}
