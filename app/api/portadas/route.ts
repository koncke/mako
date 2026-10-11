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
//
// ⚠️ LA BÚSQUEDA (Openverse + la traducción es→en), EL REPOSITORIO AL AZAR (Picsum), EL SNIFF DE
// MAGIC BYTES Y LA COPIA AL BUCKET VIVEN EN lib/imagenes-stock.ts desde el 11/10/2026: los usa
// también el editor de landings (bucket `landing-imagenes`). Esta ruta les pasa lo que es SUYO —
// el bucket `portadas`, la banda de 1600×420, el tope de 6 MB y la forma de la ruta `ws<N>/…` —
// y sigue contestando exactamente lo mismo. Los porqués de cada decisión se mudaron con el código.

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { getWorkspaceActual } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { buscarStock, tandaPicsum, copiarStockABucket, sniffImagen, EXT_IMAGEN } from '@/lib/imagenes-stock';
import type { FotoDeCatalogo } from '@/lib/portadas';
import type { FotoStock } from '@/lib/editor-landing/api-tipos';

export const dynamic = 'force-dynamic';

const BUCKET = 'portadas';
const MAX = 6 * 1024 * 1024; // 6MB

/** La banda de una portada: Picsum la recorta en el server, y Openverse se filtra a fotos anchas. */
const BANDA = { w: 1600, h: 420 };

/** La ruta de una portada: carpeta por WORKSPACE (ver el porqué en el POST). */
const pathPortada = (ws: number | null) => (ext: string) =>
  `ws${ws ?? 0}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

/** Lo que la pantalla de portadas espera de cada foto (sin la licencia, que no dibuja). */
const aCatalogo = (f: FotoStock): FotoDeCatalogo => ({ id: f.id, autor: f.autor, mini: f.mini, grande: f.grande });

export async function GET(req: NextRequest) {
  const sesion = await getUsuarioActual();
  if (!sesion) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });

  const q = new URL(req.url).searchParams;

  // Con texto, manda el buscador; sin texto, el repositorio al azar de siempre.
  const texto = (q.get('q') ?? '').trim();
  if (texto) {
    const pag = Math.max(1, Math.min(20, Number(q.get('pagina')) || 1));
    // Fotos ANCHAS: una vertical en 1600×420 es un recorte del 10% de la imagen.
    const r = await buscarStock(texto, pag, 'horizontal');
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
    return Response.json({ ok: true, fotos: r.fotos.map(aCatalogo), pagina: pag, hayMas: r.hayMas });
  }

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
  const semilla = Math.abs(Math.trunc(Number(q.get('semilla')) || 0));
  const r = await tandaPicsum(semilla, Number(q.get('pagina')) || 1, BANDA);
  if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
  return Response.json({ ok: true, fotos: r.fotos.map(aCatalogo), pagina: r.pagina, hayMas: r.hayMas });
}

export async function POST(req: NextRequest) {
  try {
    const sesion = await getUsuarioActual();
    if (!sesion) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });

    /**
     * ELEGIR UNA FOTO DEL BUSCADOR: se COPIA a nuestro bucket y se guarda nuestra URL.
     *
     * ⚠️ NO SE GUARDA LA URL DEL TERCERO, y las dos razones pesan igual. La primera es
     * el guard de origen: estas fotos viven en un servidor distinto cada una —flickr,
     * museos, archivos— y `ORIGENES_OK` los rechaza; una lista de orígenes que crece
     * con cada proveedor es un guard que dejó de guardar. La segunda es que una
     * portada apuntada a un tercero se rompe el día que ese tercero borra la foto, y
     * el síntoma llega meses después como una banda gris.
     *
     * ⚠️ Y EL NAVEGADOR MANDA EL **ID**, NO LA URL. Aceptar una URL y bajarla sería
     * convertir esta ruta en un descargador de lo que cualquiera con sesión le pida
     * —la red interna incluida—. Con el id, la URL la dice OPENVERSE (lib/imagenes-stock.ts).
     */
    const tipoCuerpo = req.headers.get('content-type') ?? '';
    if (tipoCuerpo.includes('application/json')) {
      const body = (await req.json().catch(() => ({}))) as { ov?: unknown };
      const ov = typeof body.ov === 'string' ? body.ov : '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ov)) {
        return Response.json({ ok: false, error: 'pedido inválido' }, { status: 400 });
      }
      const ws = await getWorkspaceActual();
      const r = await copiarStockABucket(ov, BUCKET, ws, { tope: MAX, path: pathPortada(ws), crearBucket: true, uso: 'de portada' });
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: r.status });
      return Response.json({ ok: true, url: r.url });
    }

    // ⚠️ UN ROUTE HANDLER MULTIPART Y NO UNA SERVER ACTION: una action topea el cuerpo
    // en 1 MB (este proyecto no define `serverActions.bodySizeLimit`), así que una foto
    // de celular falla siempre. Está medido en AGENTS.md.
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ ok: false, error: 'No llegó ningún archivo' }, { status: 400 });
    if (file.size > MAX) return Response.json({ ok: false, error: 'La imagen supera los 6MB' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    // El tipo REAL por magic bytes: `file.type` lo pone el cliente, así que no decide nada.
    const tipo = sniffImagen(buf);
    if (!tipo) return Response.json({ ok: false, error: 'Formato no permitido. Usa JPG, PNG, WEBP o GIF.' }, { status: 400 });

    const supabase = getSupabaseServer();
    try { await supabase.storage.createBucket(BUCKET, { public: true }); } catch { /* ya existe */ }

    // Carpeta por WORKSPACE, no por persona: la portada es del cliente o del proyecto,
    // no de quien la subió, y dos inquilinos no comparten carpeta ni al subir algo con
    // el mismo nombre. El bucket es PÚBLICO (lo tiene que poder pintar cualquier
    // navegador), así que la ruta no es un secreto: es trazabilidad.
    const ws = await getWorkspaceActual();
    const path = pathPortada(ws)(EXT_IMAGEN[tipo]);
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: tipo, upsert: false });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return Response.json({ ok: true, url: data.publicUrl });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
