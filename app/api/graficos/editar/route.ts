// =============================================================================
// /api/graficos/editar — «Editar con MaKo»: una frase cambia la hoja abierta del Dashboard o de General
// =============================================================================
// Martín, 16/10/2026: «en dashboard y general no está la edición con IA, y debería». Lo llama el panel de la hoja
// (app/dashboard/PanelEditarMako.tsx).
//
//   POST { hoja, pedido, historial?, informe? } → { ok: true, respuesta, cambios, avisos, hoja? } | { ok: false, error, link? }
//
// ⚠️ NO GUARDA NADA, como «Pídeselo» (./../ia/route.ts): el informe lo reescribe entero el navegador con su autoguardado,
//    y un segundo escritor lo pisaría. Devuelve la hoja cambiada (sólo si cambió algo) y el editor la mete con `mutar`,
//    que además le da el deshacer.
// ⚠️ LA HOJA LLEGA DEL NAVEGADOR (lo que la persona tiene en pantalla, aunque no se haya guardado todavía) y se SANEA acá
//    antes de usarla: vale por lo que dice el catálogo, no por lo que mandó la pestaña.
// ⚠️ LA PUERTA: el admin del workspace y la tab en su capa (la del Dashboard o la de General, 404 si no está).
// ⚠️ EL CUERPO VIVE EN lib/graficos-ia-editar.ts (`editarHojaIA`): lo llama también la API de MaKo.
// =============================================================================

import { NextResponse } from 'next/server';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { sanearHoja } from '@/lib/graficos-catalogo';
import { ALCANCE_GENERAL, TOPE_PEDIDO_IA } from '@/lib/graficos-ia';
import { TURNOS_IA, type TurnoEdicion } from '@/lib/graficos-ia-edicion';
import { editarHojaIA } from '@/lib/graficos-ia-editar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/** Lo mismo que «Pídeselo»: la cascada, la copia como JSON, un reintento y la red. El panel corta a 120 + margen. */
export const maxDuration = 120;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

/** Lo que se habló en el panel: sólo turnos con quién y texto, los últimos. */
function historialDe(v: unknown): TurnoEdicion[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((t): TurnoEdicion[] => {
    if (!t || typeof t !== 'object') return [];
    const { quien, texto } = t as Record<string, unknown>;
    if ((quien !== 'persona' && quien !== 'mako') || typeof texto !== 'string' || !texto.trim()) return [];
    return [{ quien, texto: texto.trim().slice(0, 600) }];
  }).slice(-TURNOS_IA);
}

export async function POST(req: Request) {
  const inicio = Date.now();
  const rol = await getRolWsEfectivo();
  if (rol == null) return err(401, 'no autenticado');
  if (rol !== 'admin') return err(403, 'Sólo el admin de la cuenta');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  const general = body?.informe === 'general';
  if (!tabEnCapa(general ? 'general' : 'graphics', await getCapaActual())) return err(404, 'No existe');

  const hoja = sanearHoja(body?.hoja, 0);
  if (!hoja) return err(400, 'No llegó la hoja.');
  const pedido = typeof body?.pedido === 'string' ? body.pedido.trim().slice(0, TOPE_PEDIDO_IA) : '';
  if (!pedido) return err(400, 'Escribe qué quieres cambiar.');

  const r = await editarHojaIA({ hoja, pedido, historial: historialDe(body?.historial), alcance: general ? ALCANCE_GENERAL : undefined, inicio });
  if ('error' in r) return NextResponse.json({ ok: false, error: r.error, ...(r.link ? { link: r.link } : {}) }, { status: 502 });
  if (r.correcciones.length) console.log('[graficos/editar] aceptada con correcciones:', r.correcciones.join(' | '));
  return NextResponse.json({ ok: true, respuesta: r.respuesta, cambios: r.cambios, avisos: r.avisos, ...(r.cambios.length ? { hoja: r.hoja } : {}) });
}
