// =============================================================================
// /api/ads-manager/formulario-create — crear un formulario instantáneo en la página
// =============================================================================
// GET                → { base: { sitio, landings } } para prellenar el creador
// POST { formulario } → crea el formulario en la página de Facebook del workspace
//
// Escribe en la página del CLIENTE y un formulario no se borra por API: la
// validación vive en el server (lib/meta-formularios.ts) y no hay reintento.
// =============================================================================

import type { NextRequest } from 'next/server';
import { guardAdsWs } from '@/lib/ads-guard';
import { crearFormularioInstantaneo, formularioBase, metaErrorEnvelope } from '@/lib/meta-ads-create';
import { PREGUNTAS_ESTANDAR, type FormularioNuevo, type PreguntaEstandar } from '@/lib/meta-formularios';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const no = await guardAdsWs(); if (no) return no;
  try {
    return Response.json({ ok: true, base: await formularioBase() });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}

/** Del body del navegador sólo se toma lo que tiene la forma esperada. */
function sanear(raw: unknown): FormularioNuevo | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    nombre: texto(o.nombre).slice(0, 200),
    estandar: Array.isArray(o.estandar) ? o.estandar.filter((x): x is PreguntaEstandar => (PREGUNTAS_ESTANDAR as readonly string[]).includes(x as string)) : [],
    propias: Array.isArray(o.propias) ? o.propias.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 300)) : [],
    mayorIntencion: o.mayorIntencion === true,
    privacidadUrl: texto(o.privacidadUrl).slice(0, 1000),
    sitioUrl: texto(o.sitioUrl).slice(0, 1000),
  };
}

export async function POST(req: NextRequest) {
  const no = await guardAdsWs(); if (no) return no;
  let body: { formulario?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const formulario = sanear(body.formulario);
  if (!formulario) return Response.json({ ok: false, error: 'falta el formulario' }, { status: 400 });
  try {
    return Response.json({ ok: true, formulario: await crearFormularioInstantaneo(formulario) });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:formulario-create] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}
