// =============================================================================
// /api/crm/ficha/armar — «¿Qué vas a crear hoy?» de una tab de la ficha: MaKo arma la tab con un pedido
// =============================================================================
// Martín, 16/10/2026: «Si nunca configuró una tab, y entra por primera vez al detail de un lead, que le salten los
// templates y el ¿Qué vas a crear hoy?». Lo llama la galería de una tab (app/crm/lead-view/ficha/GaleriaTab.tsx).
//
//   POST { tab, pedido } → { ok: true, bloques, epica, avisos } | { ok: false, error, link? }
//
// ⚠️ NO GUARDA NADA, como /api/graficos/ia: devuelve la tab y la galería la MUESTRA con los datos del lead (mirar no
//    guarda). Si la persona la usa, va por el cambio `armar` de la ficha (cambiarFichaFunnelAction), que se puede
//    deshacer. Por eso cancelar sale gratis.
// ⚠️ LA PUERTA ES LA DE PERSONALIZAR: admin del workspace Y el CRM en su capa. El cuerpo vive en
//    lib/ficha/ia-generar.ts (lo comparte con la API de MaKo, `armar_tab_ficha`).
// =============================================================================

import { NextResponse } from 'next/server';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { esTabFicha } from '@/lib/ficha/catalogo';
import { TOPE_PEDIDO_TAB } from '@/lib/ficha/ia';
import { generarTabIA } from '@/lib/ficha/ia-generar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/** Una tab son pocos cientos de tokens de salida; con un reintento y la red, 100 s dan aire. El cliente corta a 100 + margen. */
export const maxDuration = 100;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const inicio = Date.now();
  const rol = await getRolWsEfectivo();
  if (rol == null) return err(401, 'no autenticado');
  if (rol !== 'admin') return err(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('crm', await getCapaActual())) return err(404, 'No existe');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  if (!esTabFicha(body?.tab)) return err(400, 'Esa tab no existe.');
  const pedido = typeof body?.pedido === 'string' ? body.pedido.trim().slice(0, TOPE_PEDIDO_TAB) : '';
  if (!pedido) return err(400, 'Escribe qué quieres ver.');

  const r = await generarTabIA(pedido, body.tab, inicio);
  if ('error' in r) return NextResponse.json({ ok: false, error: r.error, ...(r.link ? { link: r.link } : {}) }, { status: 502 });
  return NextResponse.json({ ok: true, bloques: r.bloques, epica: r.epica, avisos: r.avisos });
}
