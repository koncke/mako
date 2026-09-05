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
/**
 * UN solo texto para TODO el área. Antes convivían dos redacciones del MISMO
 * predicado —esta y la inline de campaign-create/creative-signurl/creative-upload
 * ("…en el workspace principal por ahora")— y quien depuraba creía estar ante dos
 * problemas distintos. El texto nombra las DOS vías que lo abren, porque decir solo
 * una manda a mirar el workspace cuando lo que falta puede ser el rol.
 *
 * Y dice por qué, no solo que no: Ads Manager escribe sobre la cuenta de Meta de la
 * agencia (lib/meta-ads-create.ts está cableado a las env del dueño, tarea #170), así
 * que hoy no hay una versión "de tu cuenta" que ofrecer todavía.
 */
export async function guardAdsDueno(): Promise<Response | null> {
  if (await esDuenoAdmin()) return null;
  return Response.json(
    {
      ok: false,
      error:
        'Ads Manager todavía opera sobre la cuenta de Meta de la agencia, así que solo lo usa ' +
        'el equipo de la agencia o un admin del workspace principal. No es un problema de tu ' +
        'cuenta de Meta ni de tu pixel.',
    },
    { status: 403 },
  );
}
