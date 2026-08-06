// =============================================================================
// Cron: revisar los commits y proponer cerrar las tareas que ya están hechas
// =============================================================================
// La mitad que faltaba del auto-completado. El cron `tareas-verificar` cierra por
// SEÑALES DEL NEGOCIO y por eso solo alcanza a las tareas del seed; las de desarrollo no
// tienen señal, su única prueba es el código. Esto la lee.
//
//   GET /api/cron/cerrar-por-commits           → corre
//   GET /api/cron/cerrar-por-commits?dry=1     → dice qué propondría, sin escribir
//
// NO CIERRA NADA: deja un borrador en /plan/revisar que el dueño confirma de a una, con
// el botón «está a medias» para lo que avanzó pero no terminó. El porqué de esa decisión
// está escrito en lib/cerrar-por-commits.ts.
//
// Corre DESPUÉS de tareas-verificar (13:40) para no pisarle el aviso diario.
// Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { proponerCierresPorCommits } from '@/lib/cerrar-por-commits';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const no = checkCronAuth(req);
  if (no) return no;

  const url = new URL(req.url);
  const dry = url.searchParams.get('dry') === '1';
  // `desde` a mano sirve para la primera corrida y para recuperar un día perdido, sin
  // tener que tocar la setting de la marca de agua.
  const desdeISO = url.searchParams.get('desde') || undefined;

  const r = await proponerCierresPorCommits({ dry, desdeISO });
  console.log(`[cron:cerrar-por-commits] ${r.propuestas} propuesta(s)${r.borradorId ? ` → ${r.borradorId}` : ''} · ${r.motivo}`);
  return Response.json({ ok: true, dry, ...r });
}
