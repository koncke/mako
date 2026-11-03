// =============================================================================
// Cron: borra las lecturas compartidas de Competitors Spy de más de 30 días (diario)
// =============================================================================
// `spy_lecturas_canal` es la copia que le ahorra a un negocio leer un canal que otro ya leyó. Crece una
// fila por canal mirado, con sus piezas. Borrarla no le saca nada a nadie: lo de cada negocio vive en
// `spy_piezas`, y sin la copia la próxima lectura se paga, como antes de la migración 0363.
// Las reglas viven en lib/spy-compartido-db.ts → `podarLecturasCompartidas`.
//
// ⚠️ NO VA POR `correrPorWorkspace`: la tabla es GLOBAL (no tiene `workspace_id`, a propósito), así que hay
// un solo trabajo y no uno por negocio.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { podarLecturasCompartidas } from '@/lib/spy-compartido-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const r = await podarLecturasCompartidas();
  if (r.error) return Response.json({ ok: false, error: r.error }, { status: 500 });
  return Response.json({ ok: true, podadas: r.podadas });
}
