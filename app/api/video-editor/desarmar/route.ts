// =============================================================================
// /api/video-editor/desarmar — desarmar el video de un outlier, plano a plano (ticket 97, 14/11/2026)
// =============================================================================
// Lo llaman la caja de un reel en Video Editor › Outliers (app/video-editor/OutliersVideo.tsx) y la de un video en Competitors
// Spy (app/competitor-spy/DetallePieza.tsx), con el botón «Desarmar» (app/video-editor/Desarmar.tsx):
//   POST { accion: 'ver', clave }                          → lo que hay (sin pedir nada)
//   POST { accion: 'desarmar', fuente, duracionS, subido? } → lo desarma con el Gemini del negocio (o devuelve el guardado)
//   POST { accion: 'subir-url', tamano, mime }              → { path, signedUrl }: el navegador sube el mp4 con un PUT
//   GET  ?clave=…&bajar=videomd | json                     → el paquete VIDEO.md (zip) o el desarme en JSON
//
// ⚠️ LA PUERTA: la de Competitors Spy (`esAdminDeTab('market-an')`) o la del Video Editor (administrador, el editor en su plan).
// Gasta la IA y la clave de Apify del negocio: no la abre quien no ve ninguna de las dos.
// ⚠️ CON LA IA DEL NEGOCIO (D6b, tests/d6b-rutas.test.ts): `conSuIADelNegocio`. Gemini mira el video con SU clave.
// ⚠️ LA FUENTE LA MANDA EL NAVEGADOR: sólo `red` + `id` deciden qué video se trae (el enlace de Instagram, si viene, tiene que ser
// de instagram.com); cuenta y título son rótulos.
// =============================================================================

import type { NextRequest } from 'next/server';
import { zipSync, strToU8 } from 'fflate';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { esAdminDeTab } from '@/lib/puerta-admin-tab';
import { conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { veEditorVideo } from '@/app/video-editor/acceso';
import { claveDeDesarme, leerClaveDesarme, type FuenteDesarme, type RedDesarme } from '@/lib/video-desarmar';
import {
  MAX_BYTES_DESARMAR, desarmarVideo, desarmeGuardado, estiloDeGaleria, paqueteGuardado, urlParaSubir, vistaDeDesarme,
} from '@/lib/video-desarmar-servidor';

export const dynamic = 'force-dynamic';
/** Traer el video por Apify (hasta 100 s), subirlo a Gemini y que lo mire (hasta 300 s por pedido, dos modelos). */
export const maxDuration = 800;

const json = (cuerpo: Record<string, unknown>, status = 200) => Response.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store' } });
const cadena = (x: unknown, max = 200) => (typeof x === 'string' ? x.trim().slice(0, max) : '');

/** La puerta: Spy o el Video Editor. `editor`: si quien pide puede abrir el editor (la caja ofrece «Abrir en el editor»). */
async function puerta(): Promise<{ ws: number; editor: boolean } | Response> {
  const [s, rol, ws] = await Promise.all([getUsuarioActual(), getRolWsEfectivo(), getWorkspaceActual()]);
  if (!s || rol == null || ws == null) return json({ ok: false, error: 'Tu sesión venció. Vuelve a entrar.' }, 401);
  if (rol !== 'admin') return json({ ok: false, error: 'Solo el administrador.' }, 403);
  const [spy, editor] = await Promise.all([
    esAdminDeTab('market-an').catch(() => false),
    veEditorVideo().then(async (si) => si && tabEnCapa('video-editor', await getCapaActual())).catch(() => false),
  ]);
  if (spy || editor) return { ws, editor };
  return json({ ok: false, error: 'No encontrado.' }, 404);
}

const REDES: readonly RedDesarme[] = ['instagram', 'youtube', 'tiktok', 'meta-ads', 'subido'];

/** La fuente que manda el navegador, validada. */
function fuenteDe(x: unknown): FuenteDesarme | null {
  const f = (x ?? {}) as Record<string, unknown>;
  const red = REDES.includes(f.red as RedDesarme) ? (f.red as RedDesarme) : null;
  const id = cadena(f.id, 64);
  if (!red || !claveDeDesarme(red, id)) return null;
  const url = cadena(f.url, 500);
  return {
    red,
    id,
    url: /^https:\/\/(www\.)?(instagram\.com|youtube\.com|facebook\.com)\//i.test(url) ? url : null,
    cuenta: cadena(f.cuenta, 80).replace(/^@/, '') || null,
    titulo: cadena(f.titulo, 200) || null,
  };
}

export async function POST(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const { ws, editor } = p;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.accion === 'ver') {
    const clave = leerClaveDesarme(body.clave);
    if (!clave) return json({ ok: false, error: 'No sé qué video es.' }, 400);
    const vista = await vistaDeDesarme(`${clave.red}.${clave.id}`);
    return json({ ok: true, editor, vista, ...(vista.estado === 'listo' ? { estilo: estiloDeGaleria(vista.guardado) } : {}) });
  }

  if (body.accion === 'subir-url') {
    const tamano = Number(body.tamano);
    const mime = cadena(body.mime, 60);
    if (!/^video\//.test(mime)) return json({ ok: false, error: 'Eso no es un video (mp4, mov o webm).' }, 415);
    if (!Number.isFinite(tamano) || tamano <= 0 || tamano > MAX_BYTES_DESARMAR) return json({ ok: false, error: 'El video pesa más de 100 MB.' }, 413);
    const u = await urlParaSubir(ws);
    if (!u) return json({ ok: false, error: 'No pude preparar la subida (falló el almacenamiento de MaKo, no es tu video). Prueba de nuevo.' }, 502);
    return json({ ok: true, ...u });
  }

  if (body.accion === 'desarmar') {
    const fuente = fuenteDe(body.fuente);
    if (!fuente) return json({ ok: false, error: 'No sé qué video es.' }, 400);
    const d = Number(body.duracionS);
    const duracionS = Number.isFinite(d) && d > 0 && d < 6 * 3600 ? d : null;
    const subido = typeof body.subido === 'string' ? body.subido : null;
    try {
      const r = await runWithWorkspace(ws, () => conSuIADelNegocio(ws, () => desarmarVideo(ws, { fuente, duracionS, subido })));
      if (!r.ok) return json({ ok: false, motivo: r.motivo, error: r.error, subir: r.subir ?? false });
      return json({ ok: true, editor, nuevo: r.nuevo, vista: { estado: 'listo', guardado: r.guardado }, estilo: estiloDeGaleria(r.guardado) });
    } catch (e) {
      console.error('[desarmar]', e instanceof Error ? e.message : String(e));
      return json({ ok: false, motivo: 'fallo', error: 'No pude desarmarlo. Prueba de nuevo en un momento.' }, 500);
    }
  }

  return json({ ok: false, error: 'No sé qué hacer con eso.' }, 400);
}

export async function GET(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const clave = leerClaveDesarme(req.nextUrl.searchParams.get('clave'));
  if (!clave) return json({ ok: false, error: 'No sé qué video es.' }, 400);
  const c = `${clave.red}.${clave.id}`;
  const nombre = `desarme-${clave.red}-${clave.id}`;
  if (req.nextUrl.searchParams.get('bajar') === 'json') {
    const g = await desarmeGuardado(c);
    if (!g) return json({ ok: false, error: 'Ese video todavía no está desarmado.' }, 404);
    return new Response(JSON.stringify(g, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${nombre}.json"`, 'Cache-Control': 'no-store' },
    });
  }
  const paquete = await paqueteGuardado(c);
  if (!paquete) return json({ ok: false, error: 'Ese video todavía no está desarmado.' }, 404);
  const zip = zipSync(Object.fromEntries(Object.entries(paquete).map(([ruta, texto]) => [`${nombre}/${ruta}`, strToU8(texto)])));
  return new Response(Buffer.from(zip), {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${nombre}.zip"`, 'Cache-Control': 'no-store' },
  });
}
