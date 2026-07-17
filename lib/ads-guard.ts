// =============================================================================
// ads-guard — guard "solo el dueño" para los endpoints de Ads Manager
// =============================================================================
// Fase 1: escribir/leer campañas usa la cuenta de Meta GLOBAL del dueño (una sola
// página, un token). Un cliente no debe poder disparar escrituras/lecturas contra
// esa cuenta. Se usa al inicio de cada handler: `const no = await guardAdsDueno();
// if (no) return no;`.

import 'server-only';
import { esDuenoAdmin } from './workspace';

/**
 * Antes esto era solo esWorkspaceDueno(): miraba el workspace y NO el rol. El
 * workspace principal tiene closers y setters adentro, así que cualquiera de
 * ellos pasaba y llegaba a publicar, pausar, renombrar, cambiar presupuesto y
 * BORRAR campañas con plata puesta. Ahora exige además ser admin (esDuenoAdmin).
 */
export async function guardAdsDueno(): Promise<Response | null> {
  if (await esDuenoAdmin()) return null;
  return Response.json(
    { ok: false, error: 'Esta acción solo está disponible para un admin del workspace principal.' },
    { status: 403 },
  );
}
