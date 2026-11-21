// =============================================================================
// /api/admin/saltar-onboarding — la revisión: ir a cualquier paso del onboarding V2 o del reto (20/11/2026)
// =============================================================================
// Martín: «viste que hay un desplegable en el artefacto que me deja ir avanzando o retrocediendo. Si no, cada vez que quiero ver algo
// que ya pasó, tengo que resetear todo».
//   GET                → { ok, puede: true, pasos } si se ve; 403 si no (el desplegable no se dibuja).
//   POST { paso }      → deja el negocio en ese paso, con el estado real (lib/onboarding-v2/saltar-server.ts), y dice adónde ir.
// Guard: alguien de MaKo (getSesionAdmin) y un negocio de PRUEBA (el 3 y el 9: `puedeVerLaRevision`); el negocio lo dice el SERVER
// (getWorkspaceActual), nunca el cuerpo del pedido. Nunca le aparece a un cliente: tests/revision-saltar-y-ejemplos.test.ts.
// =============================================================================
import { NextResponse } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { PASOS_DE_REVISION, esPasoDeRevision, puedeVerLaRevision } from '@/lib/onboarding-v2/saltar';
import { saltarAlPaso } from '@/lib/onboarding-v2/saltar-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = !!(await getSesionAdmin());
  const ws = await getWorkspaceActual();
  if (!puedeVerLaRevision({ ws, admin })) return NextResponse.json({ ok: false, puede: false }, { status: 403 });
  return NextResponse.json({ ok: true, puede: true, ws, pasos: PASOS_DE_REVISION });
}

export async function POST(req: Request) {
  const admin = !!(await getSesionAdmin());
  const ws = await getWorkspaceActual();
  if (!puedeVerLaRevision({ ws, admin })) return NextResponse.json({ ok: false, puede: false }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { paso?: unknown };
  if (!esPasoDeRevision(body.paso)) return NextResponse.json({ ok: false, error: 'Ese paso no existe.' }, { status: 400 });
  try {
    const r = await saltarAlPaso(ws as number, body.paso);
    return NextResponse.json({ ok: true, ws, ...r });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[api:saltar-onboarding] ws=${ws} paso=${String(body.paso)}: ${error}`);
    return NextResponse.json({ ok: false, error: `No pude ir a ese paso: ${error}` }, { status: 500 });
  }
}
