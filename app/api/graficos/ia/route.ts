// =============================================================================
// /api/graficos/ia — «Pídeselo a MaKo»: la IA arma una hoja del Dashboard (punto 19)
// =============================================================================
// Martín, 11/10/2026: «replica el modal que tenemos en "Automations", en donde al principio tenemos
// la opción de "Pídeselo a MaKo"». Lo llama app/dashboard/NuevaHoja.tsx.
//
//   POST { pedido } → { ok: true, hoja, avisos } | { ok: false, error, link? }
//
// ⚠️ NO GUARDA NADA. El informe es UN JSON por persona que el navegador reescribe entero, con
//    autoguardado (lib/graficos-tablero.ts, EditorInforme.tsx): si esta ruta escribiera, serían dos
//    escritores con ritmos distintos y el próximo autoguardado pisaría la hoja. Devuelve la hoja y el
//    editor la mete con `mutar` (que además le da el deshacer). Por eso cancelar sale gratis.
//
// ⚠️ LA PUERTA ES LA DE /api/graficos: admin del workspace Y la tab en su capa (404 si no está). La de
//    Automations sólo mira el rol; copiada, un workspace sin el Dashboard llegaba por acá.
//
// ⚠️ EL CUERPO VIVE EN lib/graficos-ia-generar.ts (`generarHojaIA`, 11/10/2026): lo llaman esta ruta y la
//    API de MaKo (`crear_hoja_dashboard` con `pedido`). La cascada GRATIS, el pin, la traducción en el
//    `validar` (`deIAHoja`), los tres escalones y la red de plataforma están allá; acá sólo la puerta.
// =============================================================================

import { NextResponse } from 'next/server';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { ALCANCE_GENERAL, TOPE_PEDIDO_IA } from '@/lib/graficos-ia';
import { generarHojaIA } from '@/lib/graficos-ia-generar';
import { hojaConDatos } from '@/lib/graficos-con-datos-server';
import { hoyEnTijuana } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/**
 * El tope de la función. Una hoja son ~1-2k tokens de salida: Gemini Flash la escribe en 5-15 s y el
 * modelo gratis de OpenRouter en ~20 s. Con un respaldo, la copia como JSON y un reintento, 120 da
 * aire. El cliente corta a 120 + margen (app/dashboard/NuevaHoja.tsx).
 */
export const maxDuration = 120;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const inicio = Date.now();
  const rol = await getRolWsEfectivo();
  if (rol == null) return err(401, 'no autenticado');
  if (rol !== 'admin') return err(403, 'Sólo el admin de la cuenta');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  // 16/10/2026: «Pídeselo» en General armaba una hoja con tipos del Dashboard (no sabía de qué informe era). Con
  // `informe: 'general'`, la puerta es la de General y la hoja sale con lo que General ofrece y sus bloques.
  const general = body?.informe === 'general';
  if (general) { if (!tabEnCapa('general', await getCapaActual())) return err(404, 'No existe'); }
  else if (!tabEnCapa('graphics', await getCapaActual())) return err(404, 'No existe');
  const pedido = typeof body?.pedido === 'string' ? body.pedido.trim().slice(0, TOPE_PEDIDO_IA) : '';
  if (!pedido) return err(400, 'Escribe qué quieres ver.');

  const r = await generarHojaIA(pedido, inicio, general ? { alcance: ALCANCE_GENERAL } : {});
  if ('error' in r) return NextResponse.json({ ok: false, error: r.error, ...(r.link ? { link: r.link } : {}) }, { status: 502 });
  if (r.correcciones.length) console.log('[graficos/ia] hoja aceptada con correcciones:', r.correcciones.join(' | '));
  // Sin los gráficos que quedarían vacíos en ESTE negocio (Martín, 12/10: «no crear un montón de gráficos vacíos»).
  // Sólo poda: lo armó MaKo con el pedido, no hay qué sumar. Si no queda tiempo para medir, sale como vino.
  const conDatos = Date.now() - inicio < 100_000
    ? await hojaConDatos(r.hoja, { hoy: hoyEnTijuana(), hastaMs: inicio + 115_000 }).catch(() => null)
    : null;
  const avisos = conDatos?.aviso ? [conDatos.aviso, ...r.avisos] : r.avisos;
  return NextResponse.json({ ok: true, hoja: conDatos?.hoja ?? r.hoja, avisos });
}
