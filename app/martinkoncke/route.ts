// =============================================================================
// GET /martinkoncke — redirige a /todo
// =============================================================================
// El plan de ejecución se mudó a /todo (role-aware: el super-admin ve su plan;
// el cliente ve su tablero de tareas). Esta ruta queda como redirección para no
// romper bookmarks. localStorage es por-origen, así que el board conserva sus
// datos (keys mako_plan_v2) al abrirse en /todo.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return NextResponse.redirect(new URL('/plan', req.url));
}
