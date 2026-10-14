// =============================================================================
// /api/general/ia — «¿Qué vas a crear hoy?» en Nueva vista de General
// =============================================================================
// POST { pedido } → { ok: true, vista, avisos } · { ok: false, error, link? }
//
// La puerta es la de la página (`requireRolWs([], { nav: 'general' })`): el admin de la cuenta y la tab en su capa.
// No escribe nada: la vista vuelve a la pantalla y la guarda el mismo camino que una plantilla
// (app/general/actions.ts). Cancelar sale gratis. El modelo es gratis siempre (lib/general-vistas-ia.ts).

import { NextResponse } from 'next/server';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { leerCatalogoAlcance } from '@/lib/general-alcance';
import { generarVistaIA, TOPE_PEDIDO_VISTA } from '@/lib/general-vistas-ia';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/** La cascada tiene 50 s (lib/general-vistas-ia.ts). El cliente corta a 60 + margen (app/general/NuevaVista.tsx). */
export const maxDuration = 60;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const inicio = Date.now();
  const rol = await getRolWsEfectivo();
  if (rol == null) return err(401, 'no autenticado');
  if (rol !== 'admin') return err(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('general', await getCapaActual())) return err(404, 'No existe');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  const pedido = typeof body?.pedido === 'string' ? body.pedido.trim().slice(0, TOPE_PEDIDO_VISTA) : '';
  if (!pedido) return err(400, 'Escribe qué quieres ver.');

  // Sin el catálogo del negocio, MaKo arma la vista igual: sólo que no puede atarla a un funnel.
  const cat = await leerCatalogoAlcance();
  const r = await generarVistaIA(pedido, { funnels: cat?.funnels ?? [], ofertas: cat?.ofertas ?? [] }, inicio);
  if ('error' in r) return NextResponse.json({ ok: false, error: r.error, ...(r.link ? { link: r.link } : {}) }, { status: 502 });
  return NextResponse.json({ ok: true, vista: r.vista, avisos: r.avisos });
}
