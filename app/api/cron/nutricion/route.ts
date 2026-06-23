// =============================================================================
// Cron: motor de nutrición (VSL funnel)
// =============================================================================
// Cada corrida: (1) inscribe leads que cayeron en la cohorte de una secuencia
// activa, (2) procesa los envíos vencidos con rate-limiting anti-baneo (ventana
// horaria, tope diario/por-corrida, 1 msg/lead cada 20h).
//
// Modos:
//   - default        → dry-run puro: computa y muestra, NO escribe nada.
//   - ?commit=1       → persiste inscripciones y procesa envíos. El envío REAL
//                       por WhatsApp (Chatwoot) ocurre solo si
//                       NUTRICION_SEND_ENABLED=true; si no, avanza 'simulado'.
//   - ?commit=1&ignorar_ventana=1 → ignora la ventana horaria (tests).
//
// El cron de vercel.json corre sin querystring → dry-run. Para enviar de verdad
// hay que llamarlo con ?commit=1 (o ajustar el cron al ir a vivo).
// Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  planificarInscripciones,
  planificarEnvios,
  comprometerInscripciones,
  procesarEnvios,
} from '@/lib/nutricion';

export const dynamic = 'force-dynamic';

function checkAuth(request: NextRequest): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ ok: false, error: 'CRON_SECRET no configurado' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const unauth = checkAuth(request);
  if (unauth) return unauth;

  const commit = new URL(request.url).searchParams.get('commit') === '1';

  try {
    if (!commit) {
      const [inscribiria, enviaria] = await Promise.all([
        planificarInscripciones(),
        planificarEnvios(),
      ]);
      return Response.json({
        ok: true,
        modo: 'dry-run',
        inscribiria_count: inscribiria.length,
        enviaria_count: enviaria.length,
        inscribiria,
        enviaria,
      });
    }

    const inscriptas = await comprometerInscripciones();
    const ignorarVentana = new URL(request.url).searchParams.get('ignorar_ventana') === '1';
    const proc = await procesarEnvios({ ignorarVentana });
    return Response.json({ ok: true, modo: 'commit', inscriptas, ...proc });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron:nutricion] error: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
