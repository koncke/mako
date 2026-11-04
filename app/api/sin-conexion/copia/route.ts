// =============================================================================
// /api/sin-conexion/copia — lo que la persona ve hoy del CRM y del Plan, para guardarlo en su computadora (28/10/2026)
// =============================================================================
// GET → CopiaV1 (lib/sin-conexion/reglas.ts). La app la cifra en el navegador con la llave de /api/sin-conexion/llave y la
// guarda en IndexedDB; el servidor nunca la guarda. Las lecturas son las del teléfono, con la sesión de la persona: quién ve
// qué es la misma regla que en la app (./armar.ts).
//
// ⚠️ Mientras alguien mira la cuenta de OTRO (super admin o agencia: `estaImpersonando`) no hay copia: lo de un cliente no se
// guarda en la computadora de quien lo inspecciona.
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { estaImpersonando, getWorkspaceActual } from '@/lib/workspace';
import { armarCopia } from './armar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const SIN_CACHE = { 'Cache-Control': 'no-store, private' };
const json = (x: unknown, status = 200) => Response.json(x, { status, headers: SIN_CACHE });

export async function GET() {
  const sesion = await getUsuarioActual();
  if (!sesion) return json({ ok: false, error: 'Entra a MaKo para guardar una copia.' }, 401);
  if (await estaImpersonando()) return json({ ok: false, error: 'No se guarda una copia mientras miras la cuenta de otro.' }, 409);
  const ws = await getWorkspaceActual();
  if (ws == null) return json({ ok: false, error: 'Esta cuenta no tiene un negocio para guardar.' }, 409);
  return json({ ok: true, copia: await armarCopia({ ws, persona: sesion.nombre?.trim() || sesion.email, email: sesion.email }) });
}
