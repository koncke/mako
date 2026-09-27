// =============================================================================
// /api/portadas — el repositorio de fotos, y la subida
// =============================================================================
// Dos cosas que el navegador no puede hacer solo (mig 0173):
//
//   GET  ?pagina=N → la lista de fotos del repositorio. Va por acá y no directo
//                    desde el navegador porque picsum.photos NO manda
//                    `Access-Control-Allow-Origin` (medido el 27/09/2026 con curl):
//                    un `fetch` desde nuestra página lo bloquea CORS. Las IMÁGENES
//                    sí se cargan directo — un `<img>` no pasa por CORS.
//   POST (multipart) → sube una imagen propia al bucket público `portadas`.
//
// ⚠️ EL REPOSITORIO ES PICSUM Y NO HACE FALTA NINGUNA KEY. Es la razón por la que
// es éste y no Unsplash o Pexels, que son mejores catálogos y piden una credencial:
// una feature que necesita una variable de entorno nace apagada para todo el mundo
// que no la cargó, y nadie se entera — se ve como un selector vacío. Si algún día
// hay key de un catálogo curado, entra como una pestaña MÁS, no reemplazando a ésta.
//
// ⚠️ Y SI EL REPOSITORIO NO CONTESTA, LA PANTALLA LO DICE. Una lista vacía y «no
// pude leer el catálogo» son dos cosas distintas, y la primera invita a pensar que
// no hay fotos. Los degradados no dependen de esto: se dibujan sin red.

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { getWorkspaceActual } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import type { FotoDeCatalogo } from '@/lib/portadas';

export const dynamic = 'force-dynamic';

const BUCKET = 'portadas';
const MAX = 6 * 1024 * 1024; // 6MB

// Sólo formatos raster inertes. NUNCA image/svg+xml: un SVG es un documento ACTIVO
// (script, onload) y el bucket es público, así que sería ejecutar JS de un tercero
// bajo nuestro dominio. Mismo criterio que /api/perfil/avatar.
const EXT_DE: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
};

/** El tipo REAL por magic bytes. `file.type` lo pone el cliente, así que no decide nada. */
function sniffImagen(buf: Buffer): keyof typeof EXT_DE | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const POR_PAGINA = 24;

export async function GET(req: NextRequest) {
  const sesion = await getUsuarioActual();
  if (!sesion) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });

  const pagina = Math.max(1, Math.min(50, Number(new URL(req.url).searchParams.get('pagina')) || 1));
  try {
    // `signal` y no sólo el `maxDuration` de la ruta: un fetch sin corte con la red
    // caída en el medio no resuelve NUNCA, y lo que se ve es un spinner eterno.
    const r = await fetch(`https://picsum.photos/v2/list?page=${pagina}&limit=${POR_PAGINA}`,
      { signal: AbortSignal.timeout(12_000), cache: 'no-store' });
    if (!r.ok) return Response.json({ ok: false, error: `El catálogo de fotos contestó ${r.status}` }, { status: 502 });
    const crudo: unknown = await r.json();
    if (!Array.isArray(crudo)) return Response.json({ ok: false, error: 'El catálogo de fotos contestó algo que no es una lista' }, { status: 502 });
    const fotos: FotoDeCatalogo[] = [];
    for (const f of crudo) {
      const o = f as Record<string, unknown>;
      const id = typeof o.id === 'string' ? o.id : String(o.id ?? '');
      if (!/^[0-9]+$/.test(id)) continue;
      fotos.push({
        id,
        autor: typeof o.author === 'string' ? o.author : '',
        // El recorte lo hace el propio repositorio: pedimos la proporción de una
        // banda, no la foto de 5000px que después el navegador achica.
        mini: `https://picsum.photos/id/${id}/400/140`,
        grande: `https://picsum.photos/id/${id}/1600/420`,
      });
    }
    return Response.json({ ok: true, fotos, pagina });
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError'
      ? 'El catálogo de fotos tardó demasiado.'
      : e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sesion = await getUsuarioActual();
    if (!sesion) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });

    // ⚠️ UN ROUTE HANDLER MULTIPART Y NO UNA SERVER ACTION: una action topea el cuerpo
    // en 1 MB (este proyecto no define `serverActions.bodySizeLimit`), así que una foto
    // de celular falla siempre. Está medido en AGENTS.md.
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ ok: false, error: 'No llegó ningún archivo' }, { status: 400 });
    if (file.size > MAX) return Response.json({ ok: false, error: 'La imagen supera los 6MB' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const tipo = sniffImagen(buf);
    if (!tipo) return Response.json({ ok: false, error: 'Formato no permitido. Usa JPG, PNG, WEBP o GIF.' }, { status: 400 });

    const supabase = getSupabaseServer();
    try { await supabase.storage.createBucket(BUCKET, { public: true }); } catch { /* ya existe */ }

    // Carpeta por WORKSPACE, no por persona: la portada es del cliente o del proyecto,
    // no de quien la subió, y dos inquilinos no comparten carpeta ni al subir algo con
    // el mismo nombre. El bucket es PÚBLICO (lo tiene que poder pintar cualquier
    // navegador), así que la ruta no es un secreto: es trazabilidad.
    const ws = await getWorkspaceActual();
    const path = `ws${ws ?? 0}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT_DE[tipo]}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: tipo, upsert: false });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return Response.json({ ok: true, url: data.publicUrl });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
