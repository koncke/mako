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
//
// Y las fotos enviadas (23/10/2026, lib/operaciones-adjuntos.ts → «Las fotos enviadas»): `POST ?miniatura=<trabajo>&ref=`
// guarda la miniatura de una foto que ya salió (la manda el navegador que la mandó), y `GET ?enviadas=<ids>` da las de
// esos trabajos con su URL firmada, para verlas en otro dispositivo. Es una ruta y no una action también por eso: las
// actions se encolan de a una, y una foto no puede hacer esperar al refresco de la conversación.

import { after } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { MAX_BYTES_MINIATURA, puedeOperar } from '@/lib/operaciones-reglas';
import { ERROR_ADJUNTO, MARGEN_MULTIPART_BYTES, TOPE_TOTAL_BYTES } from '@/lib/mako-adjuntos';
import { barrerSiToca, firmarSubidasCentro, fotosEnviadasDe, guardarMiniaturaEnviada, subirAdjuntosCentro } from '@/lib/operaciones-adjuntos';

export const dynamic = 'force-dynamic';

const json = (cuerpo: Record<string, unknown>, status = 200) => Response.json(cuerpo, { status, headers: { 'cache-control': 'no-store' } });
const NO_PUEDE = 'Entra con tu segundo factor para usar el Centro.';

export async function GET(req: Request) {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return json({ ok: false, error: NO_PUEDE }, 403);
  const ids = (new URL(req.url).searchParams.get('enviadas') ?? '').split(',').filter(Boolean);
  try {
    const fotos = await fotosEnviadasDe(ids);
    // Las vencidas se barren también al leer (como mucho una vez por hora): si no se manda otra foto, igual se van.
    after(() => barrerSiToca());
    return json({ ok: true, fotos });
  } catch (e) {
    console.error('[operaciones/adjuntos] enviadas', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No pude leer las fotos.' }, 503);
  }
}

export async function POST(req: Request) {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return json({ ok: false, error: NO_PUEDE }, 403);
  const busca = new URL(req.url).searchParams;
  if (busca.has('miniatura')) {
    // Sin un largo válido no se lee: un pedido «chunked» no trae Content-Length y se leería entero antes del tope. El
    // navegador manda un Blob, y con un Blob fetch siempre lo pone.
    const largo = Number(req.headers.get('content-length') ?? NaN);
    if (!(largo > 0 && largo <= MAX_BYTES_MINIATURA)) return json({ ok: false, error: 'La miniatura pesa demasiado.' }, 413);
    try {
      const bytes = new Uint8Array(await req.arrayBuffer());
      const r = await guardarMiniaturaEnviada(busca.get('miniatura') ?? '', busca.get('ref') ?? '', bytes);
      if (r.ok) after(() => barrerSiToca());
      return r.ok ? json({ ok: true }) : json({ ok: false, error: r.error }, r.status);
    } catch (e) {
      console.error('[operaciones/adjuntos] miniatura', e instanceof Error ? e.message : e);
      return json({ ok: false, error: 'No pude guardar la foto: vuelve a intentarlo.' }, 503);
    }
  }
  // Con un Runner 1.16.0 (18/10/2026): sin archivos, sólo lo que se va a subir; vuelve una URL firmada por archivo y el
  // navegador sube DIRECTO al storage (un archivo grande no pasa por Vercel). JSON chico: se corta antes de leerlo.
  if ((req.headers.get('content-type') ?? '').startsWith('application/json')) {
    if (Number(req.headers.get('content-length') ?? 0) > 64 * 1024) return json({ ok: false, error: 'Demasiados archivos.' }, 413);
    let cuerpo: { archivos?: unknown } = {};
    try { cuerpo = await req.json(); } catch { return json({ ok: false, error: 'No llegó ningún archivo.' }, 400); }
    try {
      const r = await firmarSubidasCentro(cuerpo.archivos);
      return r.ok ? json({ ok: true, subidas: r.subidas }) : json({ ok: false, error: r.error }, 400);
    } catch (e) {
      console.error('[operaciones/adjuntos] firmar', e instanceof Error ? e.message : e);
      return json({ ok: false, error: 'No pude preparar la subida: vuelve a intentarlo.' }, 503);
    }
  }
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
