// =============================================================================
// API: "Completar con los datos de Mau" / "Eliminar los datos de Mau"
// =============================================================================
// El botón que aparece en cada lugar donde falta algo. Trae del workspace del
// dueño SOLO el ámbito del lugar donde está parado el usuario, y lo devuelve
// exacto (lib/datos-mau.ts guarda el recibo de lo que trajo).
//
// GET  → { ok, disponible, completados }   ¿corresponde mostrar los botones acá?
// POST { action: 'completar'|'eliminar', ambito }
//
// Guard, en este orden y sin excepciones:
//   · super-admin de la agencia (getSesionAdmin)
//   · el workspace efectivo NO puede ser el del dueño
// Así, un cliente nunca puede tirar de los datos de Mauricio, y un admin
// distraído no puede escribir sobre la cuenta real.

import { NextResponse } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { OWNER_WS } from '@/lib/auth-session';
import { getWorkspaceActual } from '@/lib/workspace';
import { AMBITOS, ambitosCompletados, completarConDatosDelDueno, eliminarDatosDelDueno, type AmbitoKey } from '@/lib/datos-mau';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** null si acá no corresponde tocar nada; el workspace de prueba si sí. */
async function wsDePrueba(): Promise<number | null> {
  if (!(await getSesionAdmin())) return null;
  const ws = await getWorkspaceActual();
  if (ws == null || ws === OWNER_WS) return null;
  return ws;
}

/** El catálogo, para que el panel global lo liste sin duplicar los nombres. */
const CATALOGO = (Object.keys(AMBITOS) as AmbitoKey[]).map((k) => ({ key: k, label: AMBITOS[k].label, nota: AMBITOS[k].nota ?? null }));

export async function GET() {
  const ws = await wsDePrueba();
  if (ws == null) return NextResponse.json({ ok: true, disponible: false, completados: [], ambitos: [] });
  try {
    return NextResponse.json({ ok: true, disponible: true, ws, ambitos: CATALOGO, completados: await ambitosCompletados(ws) });
  } catch {
    return NextResponse.json({ ok: true, disponible: true, ws, ambitos: CATALOGO, completados: [] });
  }
}

export async function POST(req: Request) {
  const ws = await wsDePrueba();
  if (ws == null) {
    return NextResponse.json({ ok: false, error: 'Esto solo corre en un workspace de prueba de la agencia.' }, { status: 403 });
  }
  let body: { action?: string; ambito?: string };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }

  // Reset: vaciar el workspace entero. No lleva ámbito — se lleva todo.
  if (body.action === 'reset') {
    try {
      const { resetearWorkspace } = await import('@/lib/reset-workspace');
      const r = await resetearWorkspace(ws);
      return NextResponse.json({ ok: true, ...r });
    } catch (e) {
      console.error(`[api:datos-mau] reset ws=${ws}: ${msg(e)}`);
      return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  }

  const ambito = body.ambito as AmbitoKey;
  if (!ambito || !(ambito in AMBITOS)) {
    return NextResponse.json({ ok: false, error: 'ámbito inválido' }, { status: 400 });
  }

  try {
    if (body.action === 'completar') {
      const r = await completarConDatosDelDueno(ambito, ws);
      return NextResponse.json({ ok: true, ...r });
    }
    if (body.action === 'eliminar') {
      const r = await eliminarDatosDelDueno(ambito, ws);
      return NextResponse.json({ ok: true, ...r });
    }
    return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:datos-mau] ${body.action}/${ambito}: ${msg(e)}`);
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
