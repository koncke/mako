// =============================================================================
// GET /api/cron/vigia-aprobaciones — las aprobaciones de las apps de MaKo, cada hora
// =============================================================================
// Pedido de Martín (4/11/2026): «crea un script que me vaya avisando de todas las notficaciones de aprobaciones pendientes…».
// Lee App Store, Google Play, la Chrome Web Store, Meta y Resend, y le avisa a Martín SÓLO cuando algo pasa a aprobado,
// rechazado o «piden algo» (la bandeja de avisos y el teléfono). Lo que decide: lib/vigia-aprobaciones.ts.
//
// Cada hora, a los :11 (vercel.json). Auth por CRON_SECRET (`checkCronAuth`, primera sentencia), como todo /api/cron.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrVigiaAprobaciones } from '@/lib/vigia-aprobaciones-server';

export const dynamic = 'force-dynamic';
// Diez lectores en paralelo, cada pedido con tope de 15 s (el de Play y la tienda de Chrome esperan el token de Google antes).
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const fail = checkCronAuth(request);
  if (fail) return fail;

  try {
    const r = await correrVigiaAprobaciones();
    // Se logea sólo cuando pasa algo o hay algo que no se pudo leer: corre 24 veces por día.
    const sinLeer = Object.entries(r.lecturas).filter(([, v]) => v.startsWith('no pude'));
    if (r.avisos.length || sinLeer.length) {
      console.log(`[cron:vigia-aprobaciones] ${r.avisos.length} novedades${r.avisado === false ? ' (NO salió el aviso)' : ''}; ${sinLeer.map(([k, v]) => `${k}: ${v}`).join(' · ')}`);
    }
    return Response.json(r);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron:vigia-aprobaciones] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
