// =============================================================================
// /api/calendario/ia — «¿Qué vas a crear hoy?» del Calendario: MaKo propone eventos para una semana
// =============================================================================
// POST { pedido, lunes } → { ok: true, entradas, avisos } · { ok: false, error, link? }
//
// La puerta es la de la página (`requireRolWs([], { nav: 'calendario' })`): el admin de la cuenta y la tab en su capa.
// NO ESCRIBE NADA: devuelve lo que MaKo propone y la pantalla lo muestra para confirmar (un canal propone, una
// persona confirma). Y el modelo no ve la agenda: sólo el pedido y las fechas (lib/calendario-ia.ts).

import { NextResponse } from 'next/server';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { hoyEnWorkspace } from '@/lib/timezone';
import { zonaDelCalendario } from '@/lib/calendario';
import { rangoDeVista } from '@/lib/calendario-modelo';
import { proponerEventosIA, TOPE_PEDIDO_CALENDARIO } from '@/lib/calendario-ia';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/** La cascada tiene 50 s (lib/calendario-ia.ts). El cliente corta a 60 + margen. */
export const maxDuration = 60;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const inicio = Date.now();
  const rol = await getRolWsEfectivo();
  if (rol == null) return err(401, 'no autenticado');
  if (rol !== 'admin') return err(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('calendario', await getCapaActual())) return err(404, 'No existe');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  const pedido = typeof body?.pedido === 'string' ? body.pedido.trim().slice(0, TOPE_PEDIDO_CALENDARIO) : '';
  if (!pedido) return err(400, 'Escribe qué quieres agendar.');
  const lunes = typeof body?.lunes === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.lunes) ? body.lunes : null;
  if (!lunes) return err(400, 'Falta la semana.');

  const [hoy, tz] = await Promise.all([hoyEnWorkspace(), zonaDelCalendario()]);
  const { dias } = rangoDeVista('semana', lunes);
  const r = await proponerEventosIA(pedido, dias, hoy, tz, inicio);
  if ('error' in r) return NextResponse.json({ ok: false, error: r.error, ...(r.link ? { link: r.link } : {}) }, { status: 502 });
  return NextResponse.json({ ok: true, entradas: r.entradas, avisos: r.avisos });
}
