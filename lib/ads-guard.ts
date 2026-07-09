// =============================================================================
// ads-guard — guard "solo el dueño" para los endpoints de Ads Manager
// =============================================================================
// Fase 1: escribir/leer campañas usa la cuenta de Meta GLOBAL del dueño (una sola
// página, un token). Un cliente no debe poder disparar escrituras/lecturas contra
// esa cuenta. Se usa al inicio de cada handler: `const no = await guardAdsDueno();
// if (no) return no;`.

import 'server-only';
import { esWorkspaceDueno } from './workspace';

export async function guardAdsDueno(): Promise<Response | null> {
  if (await esWorkspaceDueno()) return null;
  return Response.json(
    { ok: false, error: 'Esta acción solo está disponible en el workspace principal por ahora.' },
    { status: 403 },
  );
}
