// =============================================================================
// ia-del-negocio — ¿este NEGOCIO corre su Ops Center con SU IA? (D6b, docs/ia-del-cliente.md §5 y §12.7)
// =============================================================================
// La revisión del Cerebro (21/10/2026): «La decisión se toma por NEGOCIO y falla CERRADA: si el negocio tiene cualquier PC
// activa o su clave, ningún camino con datos de clientes va a Gemini ni a una key o red gratis». La primera versión lo
// decidía por PERSONA (la PC de quien escribe), y el turno de un closer de un negocio que conectó su Claude iba a Gemini.
//
// Su IA es: una PC ACTIVA de cualquier persona del negocio (en línea o no), su clave de Claude (aunque la plataforma la
// tenga en pausa: sigue siendo SU Claude), o su clave de OpenAI.
// ⚠️ Una clave que es COPIA de la de la plataforma NO es suya (tercera revisión del Cerebro, 21/10/2026: el ws1 tiene en
// su fila copias de las keys de MaKo; contarlas lo pasaba a «sólo su IA» sin ninguna IA que sirviera, y Buscar, El
// Archivero y las áreas le decían «con tu propio Claude…»). La misma regla que `provsDe` y el veto (AGENTS.md).
//
// ⚠️ FALLA CERRADA: si algo no se pudo leer, la respuesta es SÍ. «No pude leer» leído como «no tiene» mandaba el turno a
// Gemini (la regla del repo: un «no pude leer» tratado como «no hay» deja pasar). Eso incluye una clave GUARDADA que no
// se puede descifrar (el secreto rotó, la fila se dañó): la fila existe, así que es suya; y las claves de la plataforma
// que no se pueden leer (no se sabe si la suya es una copia).
//
// La plataforma misma (el workspace del super admin) queda afuera: sus claves son las de la plataforma, no «su IA» de un
// cliente, y lo interno sigue como estaba (el Cerebro, D6b: «lo interno (Plan, Perro, reuniones) sigue por ahora»).
// =============================================================================

import 'server-only';
import { descifrarSecreto, wsDelEntorno } from './credenciales';
import { negocioConPc } from './ia-pc';
import { MAX_KEYS } from './ia-keys';
import { conSoloSuIA } from './solo-su-ia';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';

/** Las claves que son «su IA» (no la cascada barata). */
export const CLAVES_SU_IA = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'] as const;

const esReal = (v: string | null | undefined): v is string => !!v && !!v.trim() && !v.trim().startsWith('PENDING');

/**
 * Los valores de `clave` que son de la PLATAFORMA: el entorno y las filas del super admin y del workspace del entorno,
 * con sus cuentas extra (`OPENAI_API_KEY_2`…). Tira si una no se puede leer: sin saberlas, no se sabe si la del negocio
 * es una copia.
 */
async function clavesDeLaPlataforma(clave: string): Promise<Set<string>> {
  const nombres = [clave, ...Array.from({ length: MAX_KEYS - 1 }, (_, i) => `${clave}_${i + 2}`)];
  const out = new Set<string>();
  for (const n of nombres) if (esReal(process.env[n])) out.add(process.env[n]!.trim());
  const wss = [...new Set([await wsSuperAdmin(), await wsDelEntorno(clave)])];
  const { data, error } = await getSupabaseServer().from('credenciales').select('workspace_id, clave, valor_enc').in('workspace_id', wss).in('clave', nombres);
  if (error) throw new Error(`las claves de la plataforma (${clave}): ${error.message}`);
  for (const f of data ?? []) {
    const v = descifrarSecreto(String(f.valor_enc ?? ''), Number(f.workspace_id), String(f.clave));
    if (v == null) throw new Error(`la clave ${String(f.clave)} de la plataforma no se puede leer`);
    if (esReal(v)) out.add(v.trim());
  }
  return out;
}

/** ¿El negocio tiene una clave de IA PROPIA? Copia de la plataforma: no. Guardada e ilegible: sí. Tira si no pudo leer. */
async function claveDeIAPropia(ws: number): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from('credenciales').select('clave, valor_enc').eq('workspace_id', ws).in('clave', [...CLAVES_SU_IA]);
  if (error) throw new Error(`credenciales: ${error.message}`);
  for (const f of data ?? []) {
    const valor = descifrarSecreto(String(f.valor_enc ?? ''), ws, String(f.clave));
    if (valor == null) {
      console.error(`[ia-del-negocio] ws=${ws}: ${String(f.clave)} está guardada pero no se puede leer: cuenta como suya`);
      return true;
    }
    if (!esReal(valor)) continue;
    if ((await clavesDeLaPlataforma(String(f.clave))).has(valor.trim())) {
      console.warn(`[ia-del-negocio] ws=${ws}: ${String(f.clave)} es una copia de la de la plataforma: no es su IA`);
      continue;
    }
    return true;
  }
  return false;
}

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
    return { suIA: await claveDeIAPropia(ws), conPc: false };
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
