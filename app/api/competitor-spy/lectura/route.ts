// =============================================================================
// /api/competitor-spy/lectura — en qué canal va la lectura de un competidor (4/11/2026)
// =============================================================================
// Martín (por el Cerebro): en el alta, «que vayan apareciendo como una animación especial de "Mirando su Instagram…
// Investigando su Web…"», sólo lo que esté ocurriendo. La lectura (`mirarCompetidor`, lib/spy.ts) anota su paso antes de cada
// canal; la pantalla lo pregunta acá mientras espera. Es una RUTA y no una server action: las actions van de a una, y ésta haría
// fila detrás de la misma lectura que quiere mirar.
//
//   GET ?id=<competidor>&marca=<la de esa lectura> → { ok, pasos: Array<'instagram' | 'youtube' | 'web'> } (en orden)
//
// Sólo lee una fila del negocio (app_settings, por su workspace): no llama a nadie.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { getSetting } from '@/lib/settings';
import { claveLectura, marcaValida, pasosDe } from '@/lib/spy-lectura-pasos';
import { getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // La misma puerta que la pantalla (`requireRolWs([], { nav: 'market-an' })`).
  const cerrada = await soloAdminDeTab('market-an');
  if (cerrada) return cerrada;
  const s = await getUsuarioActual();
  const ws = s ? await getWorkspaceActual() : null;
  if (!s || ws == null) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get('id'));
  const marca = req.nextUrl.searchParams.get('marca');
  if (!Number.isInteger(id) || id <= 0 || !marcaValida(marca)) return Response.json({ ok: false, error: 'Falta la lectura.' }, { status: 400 });
  const pasos = pasosDe(await getSetting(claveLectura(id)), marca, Date.now());
  return Response.json({ ok: true, pasos }, { headers: { 'Cache-Control': 'no-store' } });
}
