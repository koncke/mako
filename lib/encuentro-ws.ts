// =============================================================================
// encuentro-ws — ¿de los encuentros de ESTE workspace se espera una grabación?
// =============================================================================
// La pregunta tiene dos mitades y las dos son necesarias:
//
//   1. La NATURALEZA del encuentro, que se deriva del canal de cierre declarado
//      (`seGraba` en lib/pipeline.ts). Una llamada 1:1 remota deja video; un
//      taller presencial y un webinar grupal, nunca.
//   2. Que Fathom esté conectado AHORA. Estado vivo, no recordado.
//
// ⚠️ Por qué existe este módulo en vez de repetir las dos líneas donde hacen
// falta: la respuesta gobierna DOS cosas que hoy vivían separadas y se
// contradecían — si el motor del CRM puede concluir «No Show» por la ausencia de
// una grabación (lib/crm-auto.ts) y si el wizard exige el link de Fathom para
// mover un lead (lib/stage-requirements.ts). Mientras la regla estuviera escrita
// en los dos lados, iban a divergir: el motor marcaba No Show y el humano no
// podía cerrar el lead sin inventar un link de una reunión que nunca se grabó.
//
// El caso que lo trajo: una clienta cuyo producto se entrega en un taller
// presencial semanal. Sin este gate, todos los miércoles el motor le marcaba No
// Show a las veinte personas que sí habían ido.

import 'server-only';
import { seGraba } from './pipeline';
import { getDiagnosticoFase } from './fase-store';
import { credWs } from './credenciales';

/**
 * `true` si de un encuentro de este workspace se espera una grabación.
 *
 * ⚠️ Falla hacia el comportamiento de HOY (`true`), no hacia el nuevo. Un dato
 * que no se pudo leer no puede AFIRMAR un hecho nuevo, pero tampoco puede APAGAR
 * en silencio una automatización que ya funciona para los workspaces que sí
 * graban. El que decide es lo que sí se pudo leer.
 */
export async function encuentroGrabable(): Promise<boolean> {
  try {
    const [diag, key] = await Promise.all([getDiagnosticoFase(), credWs('FATHOM_API_KEY')]);
    return seGraba(diag?.canal ?? null, !!key);
  } catch (e) {
    console.error('[encuentro-ws] no se pudo decidir si el encuentro es grabable:', e);
    return true;
  }
}
