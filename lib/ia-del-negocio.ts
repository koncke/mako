// =============================================================================
// ia-del-negocio — ¿este NEGOCIO corre su Ops Center con SU IA? (D6b, docs/ia-del-cliente.md §5 y §12.7)
// =============================================================================
// La revisión del Cerebro (21/10/2026): «La decisión se toma por NEGOCIO y falla CERRADA: si el negocio tiene cualquier PC
// activa o su clave, ningún camino con datos de clientes va a Gemini ni a una key o red gratis». La primera versión lo
// decidía por PERSONA (la PC de quien escribe), y el turno de un closer de un negocio que conectó su Claude iba a Gemini.
//
// Su IA es: una PC conectada de cualquier persona del negocio (en línea o no), su clave de Claude (aunque la plataforma
// la tenga en pausa: sigue siendo SU Claude), o su clave de OpenAI. Una clave que es copia de la de la plataforma igual
// cuenta acá: se equivoca hacia el lado de no mandar a Gemini.
//
// ⚠️ FALLA CERRADA: si algo no se pudo leer, la respuesta es SÍ. «No pude leer» leído como «no tiene» mandaba el turno a
// Gemini (la regla del repo: un «no pude leer» tratado como «no hay» deja pasar).
//
// La plataforma misma (el workspace del super admin) queda afuera: sus claves son las de la plataforma, no «su IA» de un
// cliente, y lo interno sigue como estaba (el Cerebro, D6b: «lo interno (Plan, Perro, reuniones) sigue por ahora»).
// =============================================================================

import 'server-only';
import { credWsEstricta } from './credenciales';
import { negocioConPc } from './ia-pc';
import { conSoloSuIA } from './solo-su-ia';
import { wsSuperAdmin } from './workspace';

/** Las claves que son «su IA» (no la cascada barata). */
export const CLAVES_SU_IA = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'] as const;

export type IaDelNegocio = {
  /** Con su IA: el turno corre dentro de `conSoloSuIA` (lib/solo-su-ia.ts). */
  suIA: boolean;
  /** Alguien del negocio conectó su computadora: a quien no conectó la suya se le dice dónde. */
  conPc: boolean;
};

export async function negocioConSuIA(ws: number): Promise<IaDelNegocio> {
  try {
    if (ws === (await wsSuperAdmin())) return { suIA: false, conPc: false };
    const conPc = await negocioConPc(ws);
    if (conPc) return { suIA: true, conPc };
    for (const clave of CLAVES_SU_IA) if (await credWsEstricta(clave, ws)) return { suIA: true, conPc: false };
    return { suIA: false, conPc: false };
  } catch (e) {
    console.error(`[ia-del-negocio] ws=${ws}: no pude saber si tiene su IA, así que va como si la tuviera: ${e instanceof Error ? e.message : String(e)}`);
    return { suIA: true, conPc: false };
  }
}

/**
 * Corre `fn` con D6b decidido para ESTE negocio: si tiene su IA, adentro de «sólo su IA» (lib/solo-su-ia.ts). Es la
 * forma de una ruta o una acción del Ops Center que llama a una IA (la revisión del Cerebro del 21/10/2026 encontró el
 * Archivero de su pantalla, «Buscar con MaKo» y las áreas del Second Brain fuera del contexto, yendo a la Gemini gratis).
 * ⚠️ Para el RESTO de una función que ya corre (el turno), `entrarSoloSuIA` después de su primer `await`: un `enterWith`
 * adentro de una función async que se espera NO llega a quien la esperó.
 */
export async function conSuIADelNegocio<T>(ws: number, fn: (negocio: IaDelNegocio) => Promise<T>): Promise<T> {
  const negocio = await negocioConSuIA(ws);
  return conSoloSuIA(negocio.suIA, () => fn(negocio));
}
