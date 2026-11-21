// =============================================================================
// API: el negocio de PRUEBA (21/11/2026: lo que quedó de /api/datos-mau)
// =============================================================================
// «Datos de Mauricio» se borró (Martín: «esa parte ya no debería existir»; traía datos de un cliente a una cuenta de prueba). Quedan dos
// cosas, con la MISMA puerta:
//   GET  → { ok, disponible, ws }            ¿es un negocio de prueba? (el «Probar tema» del Cliente de Diseño, app/_components/PanelAgencia.tsx)
//   POST { action: 'borrar' }                 vacía el negocio entero («Borrar todos los datos» en /admin/customers/<ws>, lib/reset-workspace.ts)
//
// Guard, en este orden y sin excepciones:
//   · super-admin de la agencia (getSesionAdmin)
//   · el workspace efectivo (el `?ws=` lo valida el proxy) tiene que ser uno de PRUEBA: la lista blanca, NUNCA «distinto del dueño»
//   · y nunca uno que una agencia tenga en su cartera vigente (una fila a mano en `agencia_clientes` alcanzaba para abrirlo)
// =============================================================================
import { NextResponse } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { agenciasDeCliente } from '@/lib/agencia';
import { esCarteraVigente } from '@/lib/agencia-cartera';
import { esClienteDePrueba } from '@/lib/auth-session';
import { getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** null si acá no corresponde tocar nada; el workspace de prueba si sí. */
async function wsDePrueba(): Promise<number | null> {
  if (!(await getSesionAdmin())) return null;
  const ws = await getWorkspaceActual();
  if (ws == null || !esClienteDePrueba(ws)) return null;
  // Las revocadas no cuentan (`esCarteraVigente`, 17/10/2026): la del ws 3, revocada el 28/09, escondía el borrado del Cliente de Prueba.
  if ((await agenciasDeCliente(ws)).some(esCarteraVigente)) return null;
  return ws;
}

export async function GET() {
  const ws = await wsDePrueba();
  return NextResponse.json(ws == null ? { ok: true, disponible: false } : { ok: true, disponible: true, ws });
}

export async function POST(req: Request) {
  const ws = await wsDePrueba();
  if (ws == null) return NextResponse.json({ ok: false, error: 'Esto solo corre en un negocio de prueba.' }, { status: 403 });
  let body: { action?: string };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }
  if (body.action === 'borrar') {
    try {
      const { resetearWorkspace } = await import('@/lib/reset-workspace');
      const r = await resetearWorkspace(ws);
      return NextResponse.json({ ok: true, ...r });
    } catch (e) {
      console.error(`[api:negocio-de-prueba] borrar ws=${ws}: ${msg(e)}`);
      return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
}
