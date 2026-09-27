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

/**
 * CUÁNTAS PÁGINAS TIENE EL CATÁLOGO, medido con curl el 27/09/2026:
 * la 41 trae 24, la **42 trae 9** y de la 43 en adelante `[]`. O sea 993 fotos.
 *
 * ⚠️ NO HAY FORMA DE PREGUNTARLO. El header `Link` de picsum sólo trae `rel="next"`,
 * y lo trae SIEMPRE — también en la 43, que ya está vacía. Así que el final del
 * catálogo no se detecta: se cuenta. Si un día picsum crece, el único síntoma es
 * que dejamos de ofrecer lo nuevo; si encoge, una tanda vuelve vacía.
 */
const TOTAL_PAGINAS = 42;

export async function GET(req: NextRequest) {
  const sesion = await getUsuarioActual();
  if (!sesion) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const pagina = Math.max(1, Math.min(TOTAL_PAGINAS, Number(q.get('pagina')) || 1));
  /**
   * LA SEMILLA DEL RANDOMIZER, y la manda el NAVEGADOR a propósito.
   *
   * «Ponele un randomizer a la API, así no aparecen siempre las mismas»
   * (27/09/2026). Lo obvio —sortear la página acá en cada request— rompe «Ver más
   * fotos»: esa lista ACUMULA, así que dos tandas sorteadas por separado repiten
   * fotos (y con `key={f.id}` duplicada, React avisa) y saltean otras. Con la
   * semilla fija por apertura del selector, la primera tanda arranca en cualquier
   * lado y las siguientes CAMINAN desde ahí, sin repetir hasta dar la vuelta.
   */
  const semilla = Math.abs(Math.trunc(Number(q.get('semilla')) || 0)) % TOTAL_PAGINAS;
  // `pagina` es 1-based y la semilla es un corrimiento: la tanda N sale de la página
  // (semilla + N - 1) del catálogo, dando la vuelta al llegar al final.
  const paginaReal = ((semilla + pagina - 1) % TOTAL_PAGINAS) + 1;
  try {
    // `signal` y no sólo el `maxDuration` de la ruta: un fetch sin corte con la red
    // caída en el medio no resuelve NUNCA, y lo que se ve es un spinner eterno.
    const r = await fetch(`https://picsum.photos/v2/list?page=${paginaReal}&limit=${POR_PAGINA}`,
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
        // ⚠️ LA MINIATURA SALE POR NUESTRA RUTA Y NO POR PICSUM, y no es una
        // preferencia: medido el 27/09/2026, una grilla de 24 `<img>` a
        // `picsum.photos` deja las 24 EN BLANCO — el navegador no sigue el 302 y no
        // da ningún error. El server sí puede (12 en paralelo con curl, las 12 bien).
        // El porqué completo está en `app/api/portadas/foto/route.ts`.
        mini: `/api/portadas/foto?id=${id}&w=400&h=140`,
        // ⚠️ LA GRANDE SE GUARDA APUNTANDO A PICSUM, a propósito: es el DATO que
        // queda en la columna, y tiene que seguir siendo una URL absoluta de un
        // origen que `ORIGENES_OK` valide. Una ruta relativa nuestra no pasaría
        // `urlDeImagenOk` y, peor, dejaría la portada atada a que esta ruta exista.
        // El recorte lo hace el propio repositorio: pedimos la proporción de una
        // banda, no la foto de 5000px que después el navegador achica.
        grande: `https://picsum.photos/id/${id}/1600/420`,
      });
    }
    // ⚠️ `hayMas` LO DECIDE EL SERVER, que es el único que sabe cuántas páginas hay.
    // Sin esto el botón «Ver más fotos» se dibuja para siempre y, pasada la última,
    // cada click trae una lista vacía: la pantalla no puede distinguir «no hay más»
    // de «no llegó nada», que son dos cosas y sólo una es un problema.
    return Response.json({ ok: true, fotos, pagina, hayMas: pagina < TOTAL_PAGINAS });
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
