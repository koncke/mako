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

/**
 * ⚠️ CADA TANDA SE ARMA CON VARIOS LOTES DE PÁGINAS DISTINTAS, Y ESO ES EL
 * RANDOMIZER DE VERDAD.
 *
 * La primera versión sorteaba UNA página y devolvía sus 24 fotos. El dueño lo
 * reportó mirando la grilla: «ordenaste todas las fotos, cuando ya habíamos
 * implementado el randomizer». Y tenía razón — el error no era que no sorteara, era
 * QUÉ sorteaba. En picsum los ids consecutivos son de la misma sesión de fotos: los
 * 1052 al 1063 son todos «notebook sobre un escritorio». Una página son 24 ids
 * consecutivos, así que sortear la página cambia el TEMA de la tanda y no la mezcla:
 * seis laptops, después seis bosques, después seis playas.
 *
 * Ahora cada tanda junta 4 páginas repartidas por todo el catálogo y las INTERCALA.
 * Cuesta 4 pedidos en vez de 1 — desde el server, que es donde eso es barato (medido:
 * 12 en paralelo, las 12 bien) y que además cachea cada miniatura 24 h.
 */
const LOTES_POR_TANDA = 4;
const POR_LOTE = 6;

/**
 * Las 4 páginas de una tanda, repartidas y sin repetir entre tandas.
 *
 * El salto es un número PRIMO respecto de 42, así que multiplicarlo recorre todas las
 * páginas antes de volver a pisar una: con un salto par (digamos 2) sólo se verían las
 * pares y la mitad del catálogo no existiría nunca.
 */
function paginasDeLaTanda(semilla: number, tanda: number): number[] {
  const SALTO = 11; // primo con 42
  const base = semilla % TOTAL_PAGINAS;
  return Array.from({ length: LOTES_POR_TANDA }, (_, i) =>
    ((base + (tanda - 1) * LOTES_POR_TANDA * SALTO + i * SALTO) % TOTAL_PAGINAS) + 1);
}

/**
 * BUSCAR POR TEXTO — y no lo hace picsum, lo hace OPENVERSE.
 *
 * «Sería bueno que haya una barra de búsqueda en las fotos de portada, no sé si la API
 * que estás consumiendo tiene algo para buscar por texto» (27/09/2026). No tiene:
 * medido con curl, `picsum.photos/v2/list?q=montana` devuelve **la misma lista sin
 * filtrar**. Es Lorem Picsum — fotos al azar, sin título ni etiquetas. No hay nada que
 * buscar ahí, así que buscar exige otra fuente.
 *
 * Openverse, medido el mismo día:
 *   · `GET /v1/images/?q=mountain` → 240 resultados. **Sin ninguna key**, que es la
 *     misma propiedad por la que el repositorio base es picsum.
 *   · trae MINIATURA propia (`thumbnail`), así que la grilla no carga los originales.
 *   · **y dice la licencia de cada foto**, que es la parte que casi se cuela: agrega
 *     CC-BY y CC-BY-SA, que OBLIGAN a atribuir. Con `license=cc0,pdm` quedan sólo
 *     dominio público y CC0 — las que no obligan a nada. Es exactamente la misma
 *     trampa que Solar en el catálogo de íconos, y el mismo guard: en positivo.
 *   · NO manda CORS, así que va por acá igual que picsum.
 */
const LICENCIAS_OK = 'cc0,pdm';

/**
 * TRADUCIR LO QUE SE BUSCA, SIN QUE NADIE SE ENTERE.
 *
 * «Cuando busco en español debería hacer la traducción, sin que el usuario lo sepa, al
 * inglés, para buscar bien» (27/09/2026). Y es cierto: Openverse indexa por los tags
 * de cada proveedor, y esos tags están en inglés — «dinero» devuelve un puñado y
 * «money» devuelve el catálogo.
 *
 * MyMemory, medido el mismo día: sin key, y además **no rompe el inglés**, que era el
 * riesgo de traducir siempre. Probado con `langpair=es|en`: money → Money, office →
 * office, modern office → modern office, beach → Beach. O sea que se puede traducir
 * SIEMPRE sin preguntarse en qué idioma escribió la persona — que es justo la
 * pregunta que no se puede contestar bien con una palabra suelta.
 *
 * ⚠️ Y SI FALLA, SE BUSCA CON LO QUE ESCRIBIÓ. Un traductor caído no puede dejar sin
 * buscar: la traducción es una mejora del término, no un requisito. Es la misma regla
 * que «rechazar deja una deuda» — lo que no se pudo hacer no puede llevarse puesto lo
 * que sí.
 */
async function aIngles(texto: string): Promise<string> {
  try {
    const u = new URL('https://api.mymemory.translated.net/get');
    u.searchParams.set('q', texto);
    u.searchParams.set('langpair', 'es|en');
    const r = await fetch(u, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return texto;
    const j = (await r.json()) as { responseData?: { translatedText?: unknown } };
    const t = j.responseData?.translatedText;
    // Se descarta lo que no parezca una traducción: MyMemory devuelve avisos en el
    // mismo campo cuando algo sale mal («NO QUERY SPECIFIED…»), y eso como término de
    // búsqueda da cero resultados sin decir por qué.
    if (typeof t !== 'string' || !t.trim() || t.length > texto.length * 3 + 20) return texto;
    return t.trim();
  } catch { return texto; }
}

/**
 * ⚠️ VEINTE, NO VEINTICUATRO. Openverse topea `page_size` en 20 **para pedidos
 * anónimos** —los que no llevan key, que es todo el punto de haberlo elegido— y con 24
 * contesta `401 {"detail":"page_size may not exceed 20 for anonymous requests"}`.
 *
 * Es el patrón que AGENTS.md ya tiene escrito: el entorno tiene un tope y tu código
 * declara otro. Acá salió barato porque el proveedor lo dice con todas las letras; la
 * versión cara es la que contesta 200 con menos datos y nadie se entera.
 */
const POR_PAGINA_OV = 20;

/** Una página de Openverse, cruda. */
async function paginaOpenverse(texto: string, pagina: number) {
  const url = new URL('https://api.openverse.org/v1/images/');
  url.searchParams.set('q', texto.slice(0, 60));
  url.searchParams.set('page', String(pagina));
  url.searchParams.set('page_size', String(POR_PAGINA_OV));
  url.searchParams.set('license', LICENCIAS_OK);
  // Sólo lo que se puede recortar a una banda sin que quede una tira: una foto
  // vertical en 1600×420 es un recorte del 10% de la imagen.
  url.searchParams.set('aspect_ratio', 'wide');

  const r = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: 'no-store' });
  if (!r.ok) {
    // ⚠️ SE PASA EL MOTIVO DEL PROVEEDOR, no sólo el número. «contestó 401» manda a
    // buscar una credencial que esta API no usa; su `detail` dice exactamente qué
    // pasó («page_size may not exceed 20…»), y eso es la diferencia entre un curl y
    // media hora. Se recorta porque es texto de un tercero yendo a una pantalla.
    const detalle = await r.json().then((j: { detail?: unknown }) => (typeof j.detail === 'string' ? j.detail : '')).catch(() => '');
    return { ok: false as const, error: `El buscador de fotos contestó ${r.status}${detalle ? `: ${detalle.slice(0, 120)}` : ''}` };
  }
  const j = (await r.json()) as { results?: Array<Record<string, unknown>>; page_count?: number };
  return { ok: true as const, resultados: j.results ?? [], paginas: j.page_count ?? 1 };
}

/**
 * Una TANDA de resultados: dos páginas de Openverse.
 *
 * ⚠️ DOS Y NO UNA, porque Openverse topea en 20 por página para pedidos anónimos y
 * una tanda de 20 se ve corta al lado de las 24 del repositorio base — «busco algo y
 * limita la cantidad de fotos que aparece» (27/09/2026). Con dos, la tanda es de 40 y
 * se recorta a 24: el mismo tamaño que las otras, y «Ver más» trae otra tanda entera
 * en vez de un resto.
 */
async function buscarEnOpenverse(textoOriginal: string, tanda: number) {
  const texto = await aIngles(textoOriginal.slice(0, 60));
  const p1 = (tanda - 1) * 2 + 1;
  const [a, b] = await Promise.all([paginaOpenverse(texto, p1), paginaOpenverse(texto, p1 + 1)]);
  if (!a.ok) return a;
  const crudos = [...a.resultados, ...(b.ok ? b.resultados : [])];
  const fotos: FotoDeCatalogo[] = [];
  for (const o of crudos) {
    const id = typeof o.id === 'string' ? o.id : '';
    const grande = typeof o.url === 'string' ? o.url : '';
    if (!id || !grande.startsWith('https://')) continue;
    fotos.push({
      id: `ov:${id}`,
      autor: typeof o.creator === 'string' ? o.creator : '',
      // ⚠️ LAS DOS SALEN POR NUESTRA RUTA. La miniatura por lo mismo que las de picsum
      // (el navegador no le habla a un tercero con el referer del cliente), y la
      // GRANDE porque al elegirla hay que COPIARLA a nuestro bucket: estas fotos viven
      // en servidores distintos por cada una (flickr, museos, archivos), y
      // `ORIGENES_OK` los rechaza — con razón. Una lista de orígenes que crece con
      // cada proveedor nuevo es un guard que deja de guardar.
      mini: `/api/portadas/foto?ov=${encodeURIComponent(id)}`,
      grande,
    });
  }
  return { ok: true as const, fotos: fotos.slice(0, POR_PAGINA), hayMas: p1 + 1 < Math.min(20, a.paginas) };
}

export async function GET(req: NextRequest) {
  const sesion = await getUsuarioActual();
  if (!sesion) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });

  const q = new URL(req.url).searchParams;

  // Con texto, manda el buscador; sin texto, el repositorio al azar de siempre.
  const texto = (q.get('q') ?? '').trim();
  if (texto) {
    const pag = Math.max(1, Math.min(20, Number(q.get('pagina')) || 1));
    try {
      const r = await buscarEnOpenverse(texto, pag);
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true, fotos: r.fotos, pagina: pag, hayMas: r.hayMas });
    } catch (e) {
      const msg = e instanceof Error && e.name === 'TimeoutError'
        ? 'El buscador de fotos tardó demasiado.'
        : e instanceof Error ? e.message : String(e);
      return Response.json({ ok: false, error: msg }, { status: 502 });
    }
  }

  // El tope de tandas: el catalogo entero dividido por lo que consume cada una.
  const pagina = Math.max(1, Math.min(Math.ceil(TOTAL_PAGINAS / LOTES_POR_TANDA), Number(q.get('pagina')) || 1));
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
  try {
    // `signal` y no sólo el `maxDuration` de la ruta: un fetch sin corte con la red
    // caída en el medio no resuelve NUNCA, y lo que se ve es un spinner eterno.
    const trozos = await Promise.all(paginasDeLaTanda(semilla, pagina).map(async (pg) => {
      const r = await fetch(`https://picsum.photos/v2/list?page=${pg}&limit=${POR_LOTE}`,
        { signal: AbortSignal.timeout(12_000), cache: 'no-store' });
      if (!r.ok) throw new Error(`El catálogo de fotos contestó ${r.status}`);
      const c: unknown = await r.json();
      if (!Array.isArray(c)) throw new Error('El catálogo de fotos contestó algo que no es una lista');
      return c;
    }));
    // ⚠️ SE INTERCALAN, no se concatenan. Concatenadas quedarían seis fotos de un
    // lote, seis del siguiente… o sea grupos otra vez, sólo que de otro tamaño.
    const crudo: unknown[] = [];
    for (let i = 0; i < POR_LOTE; i++) for (const t of trozos) if (t[i] !== undefined) crudo.push(t[i]);
    const fotos: FotoDeCatalogo[] = [];
    for (const f of crudo.slice(0, POR_PAGINA)) {
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
    // Cuántas tandas se pueden servir sin repetir: el catálogo entero dividido por lo
    // que consume cada una.
    return Response.json({ ok: true, fotos, pagina, hayMas: pagina * LOTES_POR_TANDA < TOTAL_PAGINAS });
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
     * —la red interna incluida—. Con el id, la URL la dice OPENVERSE: se le pregunta
     * por ese id y se baja lo que él conteste. El cliente no elige el destino.
     */
    const tipoCuerpo = req.headers.get('content-type') ?? '';
    if (tipoCuerpo.includes('application/json')) {
      const body = (await req.json().catch(() => ({}))) as { ov?: unknown };
      const ov = typeof body.ov === 'string' ? body.ov : '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ov)) {
        return Response.json({ ok: false, error: 'pedido inválido' }, { status: 400 });
      }
      const meta = await fetch(`https://api.openverse.org/v1/images/${ov}/`, { signal: AbortSignal.timeout(12_000) });
      if (!meta.ok) return Response.json({ ok: false, error: `El buscador contestó ${meta.status}` }, { status: 502 });
      const j = (await meta.json()) as { url?: unknown; license?: unknown };
      const origen = typeof j.url === 'string' ? j.url : '';
      // La licencia se vuelve a mirar ACÁ. El filtro del buscador es lo que se OFRECE;
      // esto es lo que se GUARDA, y entre las dos cosas hay un id que viajó por el
      // navegador. Es la regla de las dos capas, aplicada a un tercero.
      if (!['cc0', 'pdm'].includes(String(j.license ?? ''))) {
        return Response.json({ ok: false, error: 'Esa foto pide atribución, así que no se puede usar de portada.' }, { status: 400 });
      }
      if (!origen.startsWith('https://')) return Response.json({ ok: false, error: 'La foto no tiene una URL usable' }, { status: 502 });

      const img = await fetch(origen, { signal: AbortSignal.timeout(20_000) });
      if (!img.ok) return Response.json({ ok: false, error: `No pude bajar la foto (${img.status})` }, { status: 502 });
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length > MAX) return Response.json({ ok: false, error: 'La foto supera los 6MB' }, { status: 400 });
      // El tipo REAL por magic bytes, igual que en la subida: lo que diga el tercero
      // en su `content-type` es su palabra, no un dato.
      const tipo = sniffImagen(buf);
      if (!tipo) return Response.json({ ok: false, error: 'El archivo no es una imagen que podamos usar' }, { status: 400 });

      const supabase = getSupabaseServer();
      try { await supabase.storage.createBucket(BUCKET, { public: true }); } catch { /* ya existe */ }
      const ws = await getWorkspaceActual();
      const path = `ws${ws ?? 0}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT_DE[tipo]}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: tipo, upsert: false });
      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return Response.json({ ok: true, url: data.publicUrl });
    }

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
