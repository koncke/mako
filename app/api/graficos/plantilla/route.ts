// POST /api/graficos/plantilla { plantilla } → { hoja, aviso } — una plantilla de «Nueva hoja» armada con los datos del
// negocio: sin los gráficos que quedarían vacíos y con los que MaKo suma sobre lo que sí tiene (lib/graficos-con-datos*).
//
// Martín (reunión del 12/10/2026, 103:41): «al momento de crear un template, debería analizar qué métricas tiene ese
// negocio disponible y crear los gráficos alrededor de esa métrica y no crear un montón de gráficos vacíos».
//
// QUIÉN: el admin del negocio, con la tab en su capa (lo mismo que «¿Qué vas a crear hoy?», ./../ia/route.ts). No
// escribe nada: devuelve la hoja y la pantalla la agrega con su guardado de siempre. Cerrar el modal corta el pedido.

import { NextResponse } from 'next/server';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { hoyEnTijuana } from '@/lib/date-utils';
import { instanciarPlantilla, plantillaHojaDe } from '@/lib/graficos-plantillas';
import { hojaConDatos } from '@/lib/graficos-con-datos-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/** Medir (dos veces) y, en el medio, MaKo sumando gráficos con la IA gratis: lo mismo que «¿Qué vas a crear hoy?». */
export const maxDuration = 120;
/** Lo que se trabaja: el tope de la ruta menos un margen para contestar. */
const PLAZO_MS = 110_000;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const inicio = Date.now();
  const rol = await getRolWsEfectivo();
  if (rol == null) return err(401, 'no autenticado');
  if (rol !== 'admin') return err(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('graphics', await getCapaActual())) return err(404, 'No existe');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  const p = typeof body?.plantilla === 'string' ? plantillaHojaDe(body.plantilla.slice(0, 40)) : undefined;
  if (!p) return err(400, 'Esa plantilla no existe.');

  // La hoy del Dashboard es la de siempre (app/dashboard/page.tsx): la misma con que la pantalla va a pedir los datos.
  const r = await hojaConDatos(instanciarPlantilla(p), { hoy: hoyEnTijuana(), hastaMs: inicio + PLAZO_MS, sumar: { nombre: p.nombre, linea: p.linea } });
  console.log(`[graficos/plantilla] ${p.id}: ${r.quitados} sin datos, ${r.agregados} sumados${r.sinNada ? ', ninguno con datos' : ''} (${Date.now() - inicio} ms)`);
  return NextResponse.json({ ok: true, hoja: r.hoja, aviso: r.aviso });
}
