// =============================================================================
// Webhook: Apify → terminó una búsqueda de prospectos, a traer los resultados
// =============================================================================
// El Leads Scraper lanza cada búsqueda en Apify con la key del negocio (lib/prospectos.ts,
// `crearBusqueda`) y le pasa un aviso para cuando termine. Apify NO FIRMA sus avisos (su doc
// recomienda un secreto propio), así que el cuerpo trae el id de la búsqueda y una clave al azar
// que sólo conocen esa búsqueda y Apify; la fila guarda el HASH de la clave (lib/ruteo-hash.ts).
//
// El orden:
//   1. El cuerpo, con tope de largo, y sus dos campos saneados.
//   2. LA BÚSQUEDA, leída ESTRICTA por su id (service role: el aviso llega sin sesión). «No pude
//      leer» no es «no existe»: lo transitorio va 503 y Apify reintenta (hasta 11 veces, ~32 h).
//   3. LA PRUEBA: el hash de la clave tiene que ser el de la fila. Sin fila o distinta: el MISMO
//      401, para no dejar saber qué ids existen.
//   4. Los resultados, adentro de `runWithWorkspace(ws)` con la key de ESE negocio (estricta).
//      Traerlos dos veces no duplica nada (`procesarBusqueda` es idempotente): la pantalla también
//      los trae, y en local este aviso nunca llega (Apify no ve localhost).

import type { NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseServer } from '@/lib/supabase';
import { credWsEstricta } from '@/lib/credenciales';
import { hashDeRuteo } from '@/lib/ruteo-hash';
import { procesarBusqueda, type Busqueda } from '@/lib/prospectos';
import { runWithWorkspace } from '@/lib/workspace';
import { esErrorTransitorio, mensajeDeError } from '@/lib/calendly-error';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TOPE_CUERPO = 512 * 1024;

export async function GET() {
  return Response.json({ ok: true, endpoint: 'apify webhook (prospectos)', usage: 'POST con { busqueda, clave, resource }' });
}

/** ¿El hash de la clave es el guardado? En tiempo constante. */
function claveCoincide(clave: string, guardado: unknown): boolean {
  if (typeof guardado !== 'string' || !/^[0-9a-f]{64}$/.test(guardado)) return false;
  return timingSafeEqual(Buffer.from(hashDeRuteo(clave), 'hex'), Buffer.from(guardado, 'hex'));
}

function fallo(donde: string, e: unknown): Response {
  const motivo = mensajeDeError(e).slice(0, 300);
  if (esErrorTransitorio(e)) {
    console.error(`[webhook:apify] ${donde} (TRANSITORIO) → 503: ${motivo}`);
    return Response.json({ ok: false, error: donde, reintentar: true }, { status: 503 });
  }
  console.error(`[webhook:apify] ${donde} → 200, reintentar no lo arregla: ${motivo}`);
  return Response.json({ ok: false, error: donde, reintentar: false });
}

export async function POST(req: NextRequest) {
  // ── 1. El cuerpo ──
  const raw = await req.text();
  if (raw.length > TOPE_CUERPO) return Response.json({ ok: false, error: 'demasiado_grande' }, { status: 413 });
  let cuerpo: { busqueda?: unknown; clave?: unknown; resource?: { id?: unknown } } = {};
  try { cuerpo = JSON.parse(raw); } catch { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }); }
  const id = Number(cuerpo.busqueda);
  const clave = typeof cuerpo.clave === 'string' && cuerpo.clave.length <= 100 ? cuerpo.clave : null;
  if (!Number.isInteger(id) || id <= 0 || !clave) return Response.json({ ok: false, error: 'clave' }, { status: 401 });

  // ── 2. La búsqueda, ESTRICTA ──
  const { data, error } = await getSupabaseServer().from('prospeccion_busquedas')
    .select('id, workspace_id, fuente, parametros, estado, apify_run_id, clave_hash').eq('id', id).maybeSingle();
  if (error) return fallo('ruteo', Object.assign(new Error(`prospeccion_busquedas: ${error.message}`), { code: error.code, details: error.details, hint: error.hint }));

  // ── 3. La prueba: el MISMO 401 para «no existe» y «no coincide» ──
  const fila = data as (Busqueda & { workspace_id: number; clave_hash: string | null }) | null;
  if (!fila || !claveCoincide(clave, fila.clave_hash)) {
    console.warn(`[webhook:apify] clave rechazada (búsqueda ${id})`);
    return Response.json({ ok: false, error: 'clave' }, { status: 401 });
  }
  const runAviso = typeof cuerpo.resource?.id === 'string' ? cuerpo.resource.id : null;
  if (runAviso && fila.apify_run_id && runAviso !== fila.apify_run_id) {
    return Response.json({ ok: true, ignorado: 'el aviso es de otra corrida' });
  }
  const ws = Number(fila.workspace_id);

  // ── 4. Los resultados, con la key de ESE negocio ──
  let token: string | null;
  try {
    token = await credWsEstricta('APIFY_TOKEN', ws);
  } catch (e) {
    return fallo('key', e);
  }
  if (!token) return Response.json({ ok: true, ignorado: 'el negocio ya no tiene la key de Apify' });
  const key = token;
  try {
    const r = await runWithWorkspace(ws, () => procesarBusqueda(fila, key));
    console.log(`[webhook:apify] búsqueda ${id} ws=${ws}: ${r.estado}${r.nuevos != null ? ` (${r.nuevos} nuevos)` : ''}`);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return fallo('proceso', e);
  }
}
