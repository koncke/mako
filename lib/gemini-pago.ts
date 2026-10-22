// =============================================================================
// gemini-pago — ¿el Gemini de la PLATAFORMA está en el plan pago? (IA16, 22/10/2026)
// =============================================================================
// Martín, 22/10/2026, textual: «¿Activo el pago por uso de Gemini?» → «Sí, sin tope». Los datos de los clientes de un
// negocio nunca van a un proveedor que entrena con lo que recibe (la regla del 16/10): el plan GRATIS de Gemini entrena, el
// pago no. Con el Gemini de la plataforma pago, es la base de quien no conectó su IA, también con datos de clientes.
//
// ⚠️ LA MARCA LA PRENDE QUIEN MIDIÓ LA CLAVE, no el código: `ia.gemini.plataforma_paga = '1'` en el workspace de la
// plataforma, después de comprobar que la clave ya no topa como gratis (GenerateRequestsPerDay…FreeTier) y de sacar las
// claves gratis de la plataforma (una sola gratis en la rotación mandaría datos de clientes a entrenar). Sin la marca, o
// sin poder leerla, es NO: falla cerrada.
// =============================================================================

import 'server-only';

export const CLAVE_GEMINI_PAGO = 'ia.gemini.plataforma_paga';

const MEMORIA_MS = 60_000;
const g = globalThis as unknown as { __geminiPago?: { hasta: number; paga: boolean } };

/** ¿El Gemini de la plataforma está en el plan pago (no entrena)? Memoria de 60 s. Sin poder leer: no. */
export async function geminiDeLaPlataformaPaga(): Promise<boolean> {
  const m = g.__geminiPago;
  if (m && m.hasta > Date.now()) return m.paga;
  try {
    const { runWithWorkspace, wsSuperAdmin } = await import('./workspace');
    const { getSetting } = await import('./settings');
    const paga = (await runWithWorkspace(await wsSuperAdmin(), () => getSetting(CLAVE_GEMINI_PAGO))) === '1';
    g.__geminiPago = { hasta: Date.now() + MEMORIA_MS, paga };
    return paga;
  } catch {
    return false;
  }
}

/** Para los tests: olvidar lo leído. */
export const olvidarGeminiPago = (): void => { g.__geminiPago = undefined; };
