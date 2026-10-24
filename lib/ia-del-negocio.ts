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
import { CLAVES_CREDITO_PLATAFORMA } from './veto-claude';
import { conSoloSuIA } from './solo-su-ia';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';

/**
 * Las claves que son «su IA». Desde el 22/10/2026 también su Gemini (clave de AI Studio): Martín, textual, «Cada usuario debe
 * poder pagar su token, su propia IA de gemini». Una COPIA de la de la plataforma (el ws1) no cuenta, como con las otras.
 */
export const CLAVES_SU_IA = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'] as const;

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

/** Cómo está cada clave de IA guardada en la fila del negocio. Sin fila (o un valor vacío o PENDING), no aparece. */
export type SuClaveGuardada = { clave: (typeof CLAVES_SU_IA)[number]; es: 'propia' | 'copia' | 'ilegible' };

/** Las claves de IA del negocio, cada una con lo que es. Tira si no pudo leer (la falla cerrada la decide quien llama). */
export async function susClaves(ws: number): Promise<SuClaveGuardada[]> {
  const { data, error } = await getSupabaseServer().from('credenciales').select('clave, valor_enc').eq('workspace_id', ws).in('clave', [...CLAVES_SU_IA]);
  if (error) throw new Error(`credenciales: ${error.message}`);
  const out: SuClaveGuardada[] = [];
  for (const f of data ?? []) {
    const clave = String(f.clave) as SuClaveGuardada['clave'];
    const valor = descifrarSecreto(String(f.valor_enc ?? ''), ws, clave);
    if (valor == null) { out.push({ clave, es: 'ilegible' }); continue; }
    if (!esReal(valor)) continue;
    out.push({ clave, es: (await clavesDeLaPlataforma(clave)).has(valor.trim()) ? 'copia' : 'propia' });
  }
  return out;
}

/** ¿El negocio tiene una clave de IA PROPIA? Copia de la plataforma: no. Guardada e ilegible: sí. Tira si no pudo leer. */
export async function claveDeIAPropia(ws: number): Promise<boolean> {
  for (const c of await susClaves(ws)) {
    if (c.es === 'ilegible') {
      console.error(`[ia-del-negocio] ws=${ws}: ${c.clave} está guardada pero no se puede leer: cuenta como suya`);
      return true;
    }
    if (c.es === 'copia') {
      console.warn(`[ia-del-negocio] ws=${ws}: ${c.clave} es una copia de la de la plataforma: no es su IA`);
      continue;
    }
    return true;
  }
  return false;
}

/** El valor de una clave de la fila del negocio, o null. Tira si no pudo leer. */
async function valorDeSuClave(ws: number, clave: string): Promise<string | null> {
  const { data, error } = await getSupabaseServer().from('credenciales').select('valor_enc').eq('workspace_id', ws).eq('clave', clave).maybeSingle();
  if (error) throw new Error(`credenciales: ${error.message}`);
  if (!data) return null;
  const v = descifrarSecreto(String(data.valor_enc ?? ''), ws, clave);
  if (v == null) throw new Error(`la clave ${clave} del negocio no se puede leer`);
  return esReal(v) ? v.trim() : null;
}

/**
 * ¿El PLAN de este negocio usa SU IA? Martín, 22/10/2026, textual: «Sí, si es su clave». Es una EXCEPCIÓN a «NO, JAMÁS
 * algo pago para el plan» (30/09/2026): el Plan no paga IA de MaKo, pero si el negocio conectó y paga su propia clave, su
 * Plan la usa; si no, sigue como siempre.
 *   · Cuenta su OpenAI, su Gemini, o su Claude si NO es el crédito de Max de la plataforma (el ws10: esa clave la paga Martín).
 *   · La PC no cuenta: el Plan corre de fondo (el Perro, las reuniones), y la suscripción no se puede usar de fondo (D6a).
 *   · Falla CERRADA, como `negocioConSuIA`: sin poder leer, sí (no se arriesgan datos de clientes en Gemini; la puerta 2
 *     igual no paga con una clave que no pudo comparar con el crédito).
 */
export async function planConSuClave(ws: number): Promise<{ suClave: boolean; incierto?: true }> {
  try {
    if (ws === (await wsSuperAdmin())) return { suClave: false };
    for (const c of await susClaves(ws)) {
      if (c.es === 'copia') continue;
      if (c.es === 'ilegible' || c.clave === 'OPENAI_API_KEY' || c.clave === 'GEMINI_API_KEY') return { suClave: true };
      const suya = await valorDeSuClave(ws, c.clave);
      let credito = false;
      // La MARCA explícita primero (lib/credito-marca.ts): vale aunque la fila del crédito de la plataforma ya no exista. El
      // valor, de respaldo.
      const { leerMarcaDeCredito, esElCreditoMarcado } = await import('./credito-marca');
      if (suya && esElCreditoMarcado(suya, await leerMarcaDeCredito(ws))) credito = true;
      for (const nombre of CLAVES_CREDITO_PLATAFORMA) if (!credito && suya && (await clavesDeLaPlataforma(nombre)).has(suya)) credito = true;
      if (!credito) return { suClave: true };
    }
    return { suClave: false };
  } catch (e) {
    console.error(`[ia-del-negocio] ws=${ws}: no pude saber si su Plan tiene su clave, así que va como si la tuviera: ${e instanceof Error ? e.message : String(e)}`);
    return { suClave: true, incierto: true };
  }
}

export type IaDelNegocio = {
  /** Con su IA: el turno corre dentro de `conSoloSuIA` (lib/solo-su-ia.ts). */
  suIA: boolean;
  /** Alguien del negocio conectó su computadora: a quien no conectó la suya se le dice dónde. */
  conPc: boolean;
  /** No se pudo saber (la base no contestó): `suIA` es la falla cerrada. La puerta de D6b no la recuerda (IA6, revisión). */
  incierto?: true;
};

export async function negocioConSuIA(ws: number): Promise<IaDelNegocio> {
  try {
    if (ws === (await wsSuperAdmin())) return { suIA: false, conPc: false };
    const conPc = await negocioConPc(ws);
    if (conPc) return { suIA: true, conPc };
    return { suIA: await claveDeIAPropia(ws), conPc: false };
  } catch (e) {
    console.error(`[ia-del-negocio] ws=${ws}: no pude saber si tiene su IA, así que va como si la tuviera: ${e instanceof Error ? e.message : String(e)}`);
    return { suIA: true, conPc: false, incierto: true };
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
