// =============================================================================
// Cron: cerrar los tickets cuyo arreglo ya está en producción, y avisarle a cada cliente
// =============================================================================
// Martín (17/10/2026): «cuando el arreglo está en producción, el ticket se cierra solo y al usuario le llega el aviso
// por donde lo levantó». Cada 15 minutos:
//   1. los tickets en curso que nombra una bitácora DE ESTE DEPLOY (`tickets: [n]` en un hito) pasan a «Resuelto»;
//   2. a cada cliente con algo nuevo sin avisar (resuelto, cerrado, o una pregunta del equipo) le llega el aviso;
//   3. un pedido delegado desde el grupo de WhatsApp que nadie tomó en 30 minutos: un aviso en su grupo (29/10/2026).
//   4. a quien levantó un ticket le llega UN correo por cada avance (recibido, en curso, te necesitamos, resuelto), nunca
//      dos por el mismo y nunca si lo apagó (lib/tickets-avance.ts, 4/11/2026). El final sigue siendo el aviso del paso 2.
// Cómo y por qué, en lib/tickets-cierre.ts. Sin tickets abiertos, son dos consultas y nada más.
//
//   GET /api/cron/tickets   (Auth: Bearer ${CRON_SECRET})
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { avisarDelegadosSinTomar, avisarPendientes, cerrarLosDesplegados } from '@/lib/tickets-cierre';
import { avisarAvancesPorEmail } from '@/lib/tickets-avance-email';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const no = checkCronAuth(req);
  if (no) return no;
  try {
    const cerrados = await cerrarLosDesplegados();
    const avisos = await avisarPendientes();
    // 3. Un pedido delegado desde el grupo que nadie tomó en 30 minutos: un aviso en su grupo (lib/tickets-cierre.ts, 29/10/2026).
    // Aparte: si falla, lo de arriba ya se hizo y el error no lo tapa.
    const demorados = await avisarDelegadosSinTomar().catch((e: unknown) => {
      console.error(`[cron:tickets] delegados sin tomar: ${e instanceof Error ? e.message : String(e)}`);
      return 0;
    });
    // 4. El correo de cada avance. Aparte, como el 3: si Resend o la base fallan, lo de arriba ya se hizo.
    const correos = await avisarAvancesPorEmail().catch((e: unknown) => {
      console.error(`[cron:tickets] correos de avance: ${e instanceof Error ? e.message : String(e)}`);
      return { enviados: 0, fallidos: 0, salteados: {}, motivo: 'falló la vuelta' };
    });
    if (cerrados.length || avisos.avisados || avisos.fallidos || demorados || correos.enviados || correos.fallidos) {
      console.log(`[cron:tickets] cerrados ${cerrados.join(', ') || '—'} · avisados ${avisos.avisados} · sin avisar ${avisos.fallidos} · delegados sin tomar ${demorados} · correos de avance ${correos.enviados} (fallidos ${correos.fallidos})`);
    }
    return Response.json({ ok: true, cerrados, ...avisos, demorados, correos });
  } catch (e) {
    // La mig 0311 sin aplicar no es un error del cron: no hay tickets todavía.
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[cron:tickets] ${msg}`);
    return Response.json({ ok: false, error: msg.slice(0, 300) }, { status: 500 });
  }
}
