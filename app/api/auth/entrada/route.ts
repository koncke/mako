// =============================================================================
// GET /api/auth/entrada — cuándo nació la sesión de este navegador, con la hora del servidor (25/10/2026)
// =============================================================================
// Lo usa la puerta de la app de escritorio (app/_components/PuertaDeLaApp.tsx, lib/app-escritorio-reglas.ts): la ventana
// guarda la hora a la que empezó a esperar el login y pasa sólo con una sesión emitida DESPUÉS. Las dos horas son del servidor:
// el reloj de la computadora puede estar corrido. Sin datos de nadie: sólo si hay sesión y cuándo nació (`iat`). Pública como
// todo /api/auth (lib/rutas-publicas.ts): sin sesión contesta `emitida: null`. Liviana a propósito: /api/auth/me hace siete
// lecturas, y esto corre al abrir cada ventana de la app.

import { NextResponse } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sesion = await getUsuarioActual().catch(() => null);
  return NextResponse.json(
    { ok: true, ahora: Math.floor(Date.now() / 1000), emitida: typeof sesion?.iat === 'number' ? sesion.iat : null },
    { headers: { 'cache-control': 'no-store' } },
  );
}
