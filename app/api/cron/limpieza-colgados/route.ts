// =============================================================================
// Cron: cierra y borra lo que quedó colgado a mitad de camino (F114 y F96, 18/11/2026)
// =============================================================================
// Tres limpiezas que antes no hacía nadie, una vez por noche:
//   · las pendientes de MaKo que se reclamaron para ejecutarse y nunca terminaron (quedaban 'confirmada' para siempre): pasan a
//     'error' con un texto que dice que pudo quedar a medias (lib/mako-pendientes.ts → `cerrarConfirmadasColgadas`);
//   · lo que la caja del Ops Center subió y nunca se firmó (lib/operaciones-adjuntos.ts → `barrerSubidasSinFirmar`);
//   · lo que un chat de MaKo subió para leer y nunca leyó (lib/chat-leer-purga.ts → `barrerLecturasSinLeer`).
// ⚠️ CADA UNA FALLA SOLA y CUENTA LO QUE HIZO: un proceso que limpia y no dice cuánto no se puede auditar. Si las tres fallan, 500.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { cerrarConfirmadasColgadas } from '@/lib/mako-pendientes';
import { barrerSubidasSinFirmar } from '@/lib/operaciones-adjuntos';
import { barrerLecturasSinLeer } from '@/lib/chat-leer-purga';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const motivo = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const ahora = Date.now();
  const [pendientes, adjuntos, lecturas] = await Promise.allSettled([
    cerrarConfirmadasColgadas(ahora),
    barrerSubidasSinFirmar(ahora),
    barrerLecturasSinLeer(ahora),
  ]);
  const errores: Record<string, string> = {};
  if (pendientes.status === 'rejected') errores.pendientes = motivo(pendientes.reason);
  if (adjuntos.status === 'rejected') errores.adjuntos = motivo(adjuntos.reason);
  if (lecturas.status === 'rejected') errores.lecturas = motivo(lecturas.reason);
  else if (lecturas.value.fallas.length) errores.lecturas = lecturas.value.fallas.slice(0, 10).join(' · ');
  const algunaAnduvo = pendientes.status === 'fulfilled' || adjuntos.status === 'fulfilled' || lecturas.status === 'fulfilled';
  return Response.json({
    ok: algunaAnduvo,
    cerradas: pendientes.status === 'fulfilled' ? pendientes.value : null,
    adjuntosBorrados: adjuntos.status === 'fulfilled' ? adjuntos.value : null,
    lecturasBorradas: lecturas.status === 'fulfilled' ? lecturas.value.borrados : null,
    ...(Object.keys(errores).length ? { errores } : {}),
  }, { status: algunaAnduvo ? 200 : 500 });
}
