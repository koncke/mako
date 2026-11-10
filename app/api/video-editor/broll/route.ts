// =============================================================================
// /api/video-editor/broll — el B-roll del Video Editor: qué imagen va y de dónde sale
// =============================================================================
// POST json { accion: 'elegir', huecos, objetivo }        → { ok, elegidos, conIA, aviso }
// POST json { accion: 'buscar', consultas, orientacion, medio?, cuantas? }
//                                                         → { ok, resultados: [{ consulta, fotos }] } (con `medio: 'videos'`,
//                                                           [{ consulta, videos }]); `cuantas` de 1 a 15 (sin él, 4)
// POST json { accion: 'pexels' }                         → { ok, conectado }: ¿hay clave de Pexels? (antes de pagar la IA)
// GET  ?foto=<id de Pexels>&orientacion=vertical           → los bytes de la foto (content-type por magic bytes)
// GET  ?video=<id de Pexels>                               → los bytes del video (un MP4 de hasta 4 MB, video/mp4)
//
// Pedido de Leila (30/10/2026), «al estilo de Submagic». DÓNDE lo decide el editor con reglas
// (lib/editor-video/broll.ts → `huecosParaBroll`, en el navegador, sobre los subtítulos). Acá:
//   · `elegir`: la IA DEL NEGOCIO elige entre esos huecos y escribe la búsqueda (lib/editor-video/broll-ia.ts), adentro
//     de «sólo su IA» (D6b). Sin IA, el respaldo sin IA, con su aviso.
//   · `buscar`, la foto y el video: Pexels con la clave del negocio (lib/pexels.ts). Sin clave, 409 con `falta` y la
//     pantalla abre el modal de Pexels ahí mismo. El navegador manda el ID, nunca una URL a bajar.
//   · Los videos (10/11/2026): la misma licencia de Pexels («All photos and videos on Pexels can be downloaded and used
//     for free»). Esta ruta devuelve los bytes y Vercel corta una respuesta en ~4,5 MB: se baja un archivo de 540p o
//     menos, de hasta 20 s, y si pasa de 4 MB, ese video no se usa (lib/pexels.ts → `bajarVideoPexels`).
// Esta ruta no escribe nada: el proyecto vive en el navegador, y lo que se propone lo acepta la persona en el editor.
//
// La puerta es la de /api/video-editor/ia (la prueba 1d de tests/video-editor-integracion.test.ts lo exige).

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { veEditorVideo } from '@/app/video-editor/acceso';
import { tabEnCapa } from '@/lib/capas';
import { rateLimit } from '@/lib/rate-limit';
import { conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { elegirBroll, huecosDelPedido } from '@/lib/editor-video/broll-ia';
import { busquedaValida, TOPES_BROLL } from '@/lib/editor-video/broll';
import type { OrientacionBroll } from '@/lib/editor-video/broll-pexels';
import { bajarFotoPexels, bajarVideoPexels, buscarFotosPexels, buscarVideosPexels, clavePexels } from '@/lib/pexels';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// La IA tiene 45 s (lib/editor-video/broll-ia.ts) y una reparación del JSON; buscar son hasta 15 pedidos a Pexels.
export const maxDuration = 120;

const TOPE_CUERPO = 30_000;
const ORIENTACIONES: readonly OrientacionBroll[] = ['vertical', 'horizontal', 'cuadrada'];

type Puerta = { ws: number } | { error: string; status: number };

async function puerta(): Promise<Puerta> {
  const [sesion, rol] = await Promise.all([getUsuarioActual(), getRolWsEfectivo()]);
  if (!sesion || rol == null) return { error: 'Tu sesión venció. Vuelve a entrar.', status: 401 };
  if (rol !== 'admin') return { error: 'Solo el administrador.', status: 403 };
  if (!(await veEditorVideo())) return { error: 'No encontrado.', status: 404 };
  if (!tabEnCapa('video-editor', await getCapaActual())) return { error: 'Tu plan no incluye el Video Editor.', status: 403 };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'Entra a un cliente primero.', status: 400 };
  return { ws };
}

const responder = (cuerpo: object, status = 200) => Response.json(cuerpo, { status, headers: { 'cache-control': 'no-store' } });
const fallo = (error: string, status: number, extra: object = {}) => responder({ ok: false, error, ...extra }, status);
const orientacionDe = (v: unknown): OrientacionBroll => (ORIENTACIONES.includes(v as OrientacionBroll) ? (v as OrientacionBroll) : 'vertical');

export async function POST(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  const crudo = await req.text().catch(() => '');
  if (!crudo || crudo.length > TOPE_CUERPO) return fallo('Pedido inválido.', 400);
  let body: { accion?: unknown; huecos?: unknown; objetivo?: unknown; consultas?: unknown; orientacion?: unknown; medio?: unknown; cuantas?: unknown };
  try { body = JSON.parse(crudo) as typeof body; } catch { return fallo('Pedido inválido.', 400); }

  if (body.accion === 'pexels') {
    // Sólo si está la clave, sin usarla: el B-roll lo pregunta antes de pedirle a la IA que elija (no gasta una
    // llamada a la IA del negocio para después decir que falta Pexels). «No pude leer» no es «no está»: 503.
    const clave = await clavePexels(p.ws);
    if (clave.ok) return responder({ ok: true, conectado: true });
    if (clave.falta) return responder({ ok: true, conectado: false });
    return fallo(clave.error, clave.status);
  }

  if (body.accion === 'elegir') {
    if (!rateLimit(`video-editor:broll-ia:${p.ws}`, 20, 60_000)) return fallo('Demasiados pedidos. Espera un minuto.', 429);
    const huecos = huecosDelPedido(body.huecos);
    if (!huecos.length) return fallo('No hay dónde poner imágenes: el video no dice nada que se pueda mostrar.', 422);
    const objetivo = typeof body.objetivo === 'number' && Number.isInteger(body.objetivo) ? body.objetivo : 0;
    const r = await runWithWorkspace(p.ws, () => conSuIADelNegocio(p.ws, () => elegirBroll(huecos, objetivo)));
    return responder({ ok: true, ...r });
  }

  if (body.accion === 'buscar') {
    if (!rateLimit(`video-editor:broll-buscar:${p.ws}`, 30, 60_000)) return fallo('Demasiadas búsquedas. Espera un minuto.', 429);
    const consultas = Array.isArray(body.consultas)
      ? [...new Set(body.consultas.map(busquedaValida).filter((c): c is string => c !== null))].slice(0, TOPES_BROLL.maxPropuestas)
      : [];
    if (!consultas.length) return fallo('Falta qué buscar.', 400);
    const clave = await clavePexels(p.ws);
    if (!clave.ok) return fallo(clave.error, clave.status, clave.falta ? { falta: clave.falta } : {});
    const orientacion = orientacionDe(body.orientacion);
    const videos = body.medio === 'videos';
    // «Cambiar por otra» pide más de una búsqueda (la siguiente que no se vio); proponer, 4 por hueco.
    const cuantas = typeof body.cuantas === 'number' && Number.isInteger(body.cuantas) ? Math.max(1, Math.min(15, body.cuantas)) : 4;
    const resultados: Array<{ consulta: string; fotos?: unknown[]; videos?: unknown[]; error?: string }> = [];
    for (const consulta of consultas) {
      // De a una: el límite de Pexels es por hora y una ráfaga de 15 no gana nada.
      const r = videos
        ? await buscarVideosPexels(clave.clave, consulta, { orientacion, cuantos: cuantas })
        : await buscarFotosPexels(clave.clave, consulta, { orientacion, cuantas });
      if (!r.ok) {
        // Clave mala o límite: el resto va a fallar igual.
        if (r.status === 429 || /clave/.test(r.error)) return fallo(r.error, r.status === 429 ? 429 : 424);
        resultados.push({ consulta, ...(videos ? { videos: [] } : { fotos: [] }), error: r.error });
        continue;
      }
      resultados.push('videos' in r ? { consulta, videos: r.videos } : { consulta, fotos: r.fotos });
    }
    return responder({ ok: true, resultados });
  }

  return fallo('Pedido inválido.', 400);
}

export async function GET(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  const idVideo = req.nextUrl.searchParams.get('video');
  if (idVideo != null) {
    // Un video pesa: menos pedidos por minuto que las fotos.
    if (!rateLimit(`video-editor:broll-video:${p.ws}`, 20, 60_000)) return fallo('Demasiados pedidos. Espera un minuto.', 429);
    if (!/^\d{1,12}$/.test(idVideo)) return fallo('Falta el video.', 400);
    const clave = await clavePexels(p.ws);
    if (!clave.ok) return fallo(clave.error, clave.status, clave.falta ? { falta: clave.falta } : {});
    const r = await bajarVideoPexels(clave.clave, Number(idVideo));
    if (!r.ok) return fallo(r.error, r.status);
    return new Response(new Uint8Array(r.bytes), {
      headers: {
        'content-type': 'video/mp4',
        'cache-control': 'private, max-age=3600',
        'x-content-type-options': 'nosniff',
        'x-foto-autor': encodeURIComponent(r.autor),
      },
    });
  }
  if (!rateLimit(`video-editor:broll-foto:${p.ws}`, 60, 60_000)) return fallo('Demasiados pedidos. Espera un minuto.', 429);
  const id = req.nextUrl.searchParams.get('foto') ?? '';
  if (!/^\d{1,12}$/.test(id)) return fallo('Falta la foto.', 400);
  const clave = await clavePexels(p.ws);
  if (!clave.ok) return fallo(clave.error, clave.status, clave.falta ? { falta: clave.falta } : {});
  const r = await bajarFotoPexels(clave.clave, Number(id), orientacionDe(req.nextUrl.searchParams.get('orientacion')));
  if (!r.ok) return fallo(r.error, r.status);
  return new Response(new Uint8Array(r.bytes), {
    headers: {
      'content-type': r.tipo,
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
      // El crédito de la foto (lo pide Pexels): viaja codificado, un header no admite tildes.
      'x-foto-autor': encodeURIComponent(r.autor),
    },
  });
}
