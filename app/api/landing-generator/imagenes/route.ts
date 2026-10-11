// =============================================================================
// POST /api/landing-generator/imagenes — imágenes y videos del editor de landings
// =============================================================================
// Un `accion` por operación, exactamente `PedidoImagenes` (lib/editor-landing/api-tipos.ts); lo que
// contesta cada una está en `RespuestasImagenes` (lib/imagenes-stock.ts). Todo termina en el bucket
// PÚBLICO `landing-imagenes` (mig 0246), en `<ws>/<uuid>.<ext>`: es la única URL que el render
// público acepta (D6, docs/diseno-editor-landing.md).
//
//   firmar     → URL firmada para que el NAVEGADOR suba directo a `<ws>/subidas/<uuid>.<ext>`, con
//                progreso real por XHR. Nunca por esta ruta ni por una server action: una función
//                de Vercel corta el cuerpo en ~4,5 MB y una action en 1 MB.
//   registrar  → verifica que la subida exista, que sus MAGIC BYTES sean lo que dice su extensión y
//                que no pase su tope; si todo da, la muda a la raíz del workspace y devuelve la URL
//                definitiva. Si no da, la BORRA: un archivo disfrazado no se queda en el bucket.
//   buscar     → fotos libres (Openverse traducido, o Picsum al azar sin texto).
//   elegir     → copia la foto elegida al bucket. El navegador manda el ID, nunca una URL.
//   desdeUrl   → baja una imagen o un video de un enlace con la baranda SSRF y lo copia.
//   biblioteca → lo verificado del workspace (la raíz de `<ws>/`, sin la carpeta de subidas).
//
// La puerta es la misma que la de los documentos: admin del workspace y la tab en su capa.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { getSupabaseServer } from '@/lib/supabase';
import { buscarStock, copiarStockABucket, copiarUrlABucket, type Orientacion } from '@/lib/imagenes-stock';
import {
  BUCKET_LANDING, CARPETA_SUBIDAS, archivoDeBiblioteca, esTipoVideo, pathDeSubida, sniffMedia,
  subidaDelWs, topeDeTipo, validarSubida,
} from '@/lib/editor-landing/server-reglas';
import type { ArchivoBiblioteca, PedidoImagenes } from '@/lib/editor-landing/api-tipos';

export const dynamic = 'force-dynamic';
// «Desde un enlace» puede bajar un video de hasta 100 MB (con su propio plazo de 90 s).
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const mal = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

async function puerta(): Promise<{ ws: number } | Response> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (rol == null) return mal('no autenticado', 401);
  if (ws == null || rol !== 'admin') return mal('Solo el admin del negocio', 403);
  if (!tabEnCapa('landing-writer', await getCapaActual())) return mal('No existe', 404);
  return { ws };
}

const ORIENTACIONES: readonly Orientacion[] = ['horizontal', 'vertical', 'cuadrada'];

// ─────────────────────────────────────────────────────────────────────────────
// Subir: firmar → (el navegador sube) → registrar
// ─────────────────────────────────────────────────────────────────────────────

async function firmar(ws: number, p: Extract<PedidoImagenes, { accion: 'firmar' }>): Promise<Response> {
  const v = validarSubida(p.tipo, p.tamano);
  if (!v.ok) return mal(v.error);
  const path = pathDeSubida(ws, randomUUID(), v.ext);
  const { data, error } = await getSupabaseServer().storage.from(BUCKET_LANDING).createSignedUploadUrl(path);
  if (error || !data) return mal(error?.message ?? 'No pude preparar la subida', 500);
  // Lo que quedó de una pestaña cerrada entre la subida y el registro se barre DESPUÉS de contestar,
  // sin demorar esta subida. El workspace se fija ANTES: el barrido no vuelve a leer la cookie.
  after(() => runWithWorkspace(ws, () => barrerSubidasViejas(ws)));
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
  return Response.json({ ok: true, path, signedUrl: data.signedUrl, token: data.token, apikey });
}

/** Las subidas sin registrar de más de una hora. Best-effort: si falla, queda en el log. */
async function barrerSubidasViejas(ws: number): Promise<void> {
  try {
    const bucket = getSupabaseServer().storage.from(BUCKET_LANDING);
    const { data, error } = await bucket.list(`${ws}/${CARPETA_SUBIDAS}`, { limit: 1000 });
    if (error) throw new Error(error.message);
    const limite = Date.now() - 3_600_000;
    const viejas = (data ?? [])
      .filter((f) => f.id && f.created_at && Date.parse(f.created_at) < limite)
      .map((f) => `${ws}/${CARPETA_SUBIDAS}/${f.name}`);
    if (!viejas.length) return;
    const { error: e2 } = await bucket.remove(viejas);
    if (e2) throw new Error(e2.message);
    console.log(`[landing-imagenes] ws ${ws}: barrí ${viejas.length} subida(s) sin registrar`);
  } catch (e) {
    console.warn(`[landing-imagenes] ws ${ws}: no pude barrer las subidas viejas: ${msg(e)}`);
  }
}

/**
 * Los primeros bytes (y el tamaño total) de un archivo del bucket público, con un pedido de RANGO:
 * para mirar los magic bytes de un video de 100 MB no hace falta bajarlo entero. La URL sale de
 * nuestra configuración y una ruta ya validada, nunca del navegador.
 */
async function primerosBytes(url: string, n = 64): Promise<{ buf: Uint8Array; total: number | null } | null> {
  const r = await fetch(url, { headers: { Range: `bytes=0-${n - 1}` }, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (r.status !== 206 && r.status !== 200) return null;
  const rango = /\/(\d+)\s*$/.exec(r.headers.get('content-range') ?? '');
  const largo = Number(r.headers.get('content-length'));
  const total = r.status === 206 ? (rango ? Number(rango[1]) : null) : Number.isFinite(largo) && largo > 0 ? largo : null;
  const lector = r.body?.getReader();
  if (!lector) return null;
  const trozos: Uint8Array[] = [];
  let leidos = 0;
  while (leidos < n) {
    const { done, value } = await lector.read();
    if (done || !value) break;
    trozos.push(value);
    leidos += value.length;
  }
  await lector.cancel().catch(() => {});
  const buf = new Uint8Array(Math.min(leidos, n));
  let o = 0;
  for (const t of trozos) { if (o >= buf.length) break; buf.set(t.subarray(0, buf.length - o), o); o += t.length; }
  return { buf, total };
}

async function registrar(ws: number, p: Extract<PedidoImagenes, { accion: 'registrar' }>): Promise<Response> {
  const sub = subidaDelWs(p.path, ws);
  if (!sub) return mal('Esa subida no es de este negocio');
  const path = p.path;
  const bucket = getSupabaseServer().storage.from(BUCKET_LANDING);
  // `exists` de algo que no está devuelve false (no tira): medido contra el bucket de videos del
  // curso el 06/10 (lib/curso-admin.ts). NO medido contra éste.
  const { data: hay } = await bucket.exists(path);
  if (!hay) return mal('No terminó de subir', 404);

  const descartar = async (motivo: string) => {
    const { error } = await bucket.remove([path]);
    if (error) console.warn(`[landing-imagenes] no pude borrar ${path}: ${error.message}`);
    console.warn(`[landing-imagenes] descarté ${path}: ${motivo}`);
  };

  const cabeza = await primerosBytes(bucket.getPublicUrl(path).data.publicUrl);
  if (!cabeza) return mal('No pude leer el archivo', 502);
  const real = sniffMedia(cabeza.buf);
  // El tipo REAL tiene que ser el que dice la extensión (que salió del tipo declarado al firmar):
  // un HTML subido como «image/png» pasa el filtro del bucket, y acá se va.
  if (real !== sub.tipo) {
    await descartar(`dice ${sub.tipo} y es ${real ?? 'otra cosa'}`);
    return mal('El archivo no es lo que dice');
  }
  if (cabeza.total != null && cabeza.total > topeDeTipo(sub.tipo)) {
    await descartar(`pesa ${cabeza.total} y el tope es ${topeDeTipo(sub.tipo)}`);
    return mal(esTipoVideo(sub.tipo) ? 'Pasa de 100 MB' : 'Pasa de 15 MB');
  }
  if (cabeza.total == null) console.warn(`[landing-imagenes] ${path}: sin tamaño en la respuesta; queda el tope del bucket`);

  const { error } = await bucket.move(path, sub.final);
  if (error) return mal(error.message, 500);
  return Response.json({ ok: true, url: bucket.getPublicUrl(sub.final).data.publicUrl, tipo: sub.tipo });
}

// ─────────────────────────────────────────────────────────────────────────────
// La biblioteca
// ─────────────────────────────────────────────────────────────────────────────

/** Tope de la biblioteca que se manda de una vez (las más nuevas primero). */
const TOPE_BIBLIOTECA = 600;

async function biblioteca(ws: number): Promise<Response> {
  const bucket = getSupabaseServer().storage.from(BUCKET_LANDING);
  const archivos: ArchivoBiblioteca[] = [];
  // Paginado de a 1000: el listado de Storage topea igual que PostgREST, y sin avisar.
  for (let offset = 0; archivos.length < TOPE_BIBLIOTECA; offset += 1000) {
    const { data, error } = await bucket.list(`${ws}`, { limit: 1000, offset, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) return mal(error.message, 500);
    for (const f of data ?? []) {
      // Sin `id` es una carpeta (la de subidas): no se lista. Y sólo lo que tiene la forma de algo
      // VERIFICADO (`<uuid>.<ext>`): lo demás no lo dejó `registrar`.
      const tipo = f.id ? archivoDeBiblioteca(f.name) : null;
      if (!tipo) continue;
      archivos.push({ url: bucket.getPublicUrl(`${ws}/${f.name}`).data.publicUrl, nombre: f.name, tipo, creado: f.created_at ?? '' });
      if (archivos.length >= TOPE_BIBLIOTECA) break;
    }
    if ((data ?? []).length < 1000) break;
  }
  return Response.json({ ok: true, archivos });
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const p0 = await puerta();
  if (p0 instanceof Response) return p0;
  const { ws } = p0;

  let body: unknown;
  try { body = await req.json(); } catch { return mal('body inválido'); }
  const p = (body && typeof body === 'object' ? body : {}) as PedidoImagenes;

  try {
    switch (p.accion) {
      case 'firmar': return await firmar(ws, p);
      case 'registrar': return await registrar(ws, p);
      case 'buscar': {
        const q = typeof p.q === 'string' ? p.q.slice(0, 120) : '';
        const orientacion = ORIENTACIONES.includes(p.orientacion as Orientacion) ? (p.orientacion as Orientacion) : 'horizontal';
        const r = await buscarStock(q, Number(p.pagina) || 1, orientacion);
        return r.ok ? Response.json({ ok: true, fotos: r.fotos, pagina: r.pagina, hayMas: r.hayMas }) : mal(r.error, 502);
      }
      case 'elegir': {
        if (typeof p.id !== 'string' || !p.id.trim()) return mal('Falta la foto');
        const r = await copiarStockABucket(p.id, BUCKET_LANDING, ws);
        return r.ok ? Response.json({ ok: true, url: r.url }) : mal(r.error, r.status);
      }
      case 'desdeUrl': {
        const r = await copiarUrlABucket(typeof p.url === 'string' ? p.url : '', BUCKET_LANDING, ws, { permitirVideo: true });
        return r.ok ? Response.json({ ok: true, url: r.url, tipo: r.tipo }) : mal(r.error, r.status);
      }
      case 'biblioteca': return await biblioteca(ws);
      default: return mal('Acción desconocida');
    }
  } catch (e) {
    console.error(`[api:landing-generator/imagenes ${String((p as { accion?: unknown }).accion)}] ${msg(e)}`);
    return mal(msg(e), 500);
  }
}
