// =============================================================================
// credito-negocio — el crédito de una cuenta Max como el Claude de un negocio, con su interruptor (22/10/2026)
// =============================================================================
// Martín, textual: «habilita los tokens de la API de la cuenta de Mauricio, esos 200, para su Ops Center, que lo pueda usar,
// así puedo seguir probando en Automations» y «dame luego una opción para deshabilitarle esa API a Mauricio en SuperAdmin,
// tal vez en USO, que pueda desactivar». Qué negocio usa qué crédito: `CREDITO_DE_UN_NEGOCIO` (lib/veto-claude.ts). Acá:
//   · el interruptor, guardado en el workspace de la PLATAFORMA (el negocio no lo ve ni lo toca). Sin fila, PRENDIDO: lo
//     pidió Martín, y prenderlo no necesita escribir en producción;
//   · la clave del crédito, del entorno o de la fila de la plataforma, y sólo con el interruptor prendido.
// ⚠️ «NO PUDE LEER» APAGA: si el interruptor no se puede leer, no hay crédito para ese pedido (nunca se gasta por un bache).
// =============================================================================

import 'server-only';
import { CREDITO_DE_UN_NEGOCIO, claveDelInterruptorDeCredito, esInterruptorPrendido, type CreditoDeUnNegocio } from './veto-claude';
import { credWsEstricta } from './credenciales';
import { getSettingEstricto, setSetting } from './settings';
import { getWorkspaceActual, runWithWorkspace, wsSuperAdmin } from './workspace';

/** El crédito asignado a ese negocio y si está prendido. null = no tiene. Tira si no pudo leer el interruptor. */
export async function creditoAsignadoA(ws: number | null | undefined): Promise<(CreditoDeUnNegocio & { prendido: boolean }) | null> {
  const def = CREDITO_DE_UN_NEGOCIO.find((c) => c.ws === ws);
  if (!def) return null;
  const valor = await runWithWorkspace(await wsSuperAdmin(), () => getSettingEstricto(claveDelInterruptorDeCredito(def.ws)));
  return { ...def, prendido: esInterruptorPrendido(valor) };
}

/**
 * La clave del crédito asignado al negocio en curso (o a `ws`), si lo tiene y está prendido. null si no, o si algo no se pudo
 * leer (falla cerrada). La usa la puerta 2 (lib/anthropic.ts → `permisoDeLaClaveDelNegocio`) y lo que pregunta «¿tiene IA?».
 */
export async function claveDelCreditoAsignado(ws?: number | null): Promise<string | null> {
  try {
    const w = ws ?? (await getWorkspaceActual());
    const c = await creditoAsignadoA(w);
    if (!c?.prendido) return null;
    // Las dos fuentes, como `conCreditoDeLaPlataforma`: el entorno o la fila de la plataforma con el mismo nombre.
    return process.env[c.clave]?.trim() || (await credWsEstricta(c.clave, await wsSuperAdmin(), { ilegibleTira: true }))?.trim() || null;
  } catch (e) {
    console.error(`[credito-negocio] no pude leer el crédito asignado: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Prende o apaga el crédito de ese negocio (SuperAdmin › Uso). Sólo un negocio de la lista. */
export async function guardarInterruptorDeCredito(ws: number, prendido: boolean): Promise<void> {
  if (!CREDITO_DE_UN_NEGOCIO.some((c) => c.ws === ws)) throw new Error('Ese negocio no tiene un crédito asignado.');
  await runWithWorkspace(await wsSuperAdmin(), () => setSetting(claveDelInterruptorDeCredito(ws), prendido ? 'prendido' : 'apagado'));
}
