// =============================================================================
// credito-marca — la clave de un negocio que ES el crédito de Max de Martín, marcada (22/10/2026)
// =============================================================================
// El crédito de Max de la plataforma puesto como clave de un negocio (el ws10: Martín le puso su cuenta 2) va siempre con el
// modelo barato, nunca paga el Plan, y su gasto es de la plataforma, no del negocio (IA5, IA15). Hasta acá se reconocía
// sólo por el VALOR, comparándola contra las filas `ANTHROPIC_CREDITO_CUENTA*` del ws9: borrada o rotada esa fila, el ws10
// volvía a elegir Sonnet sobre el crédito de Martín, a pagar su Plan con él, y ese gasto se veía como «del negocio» (fuera
// del costo de MaKo). Revisión del lote 2 de IA; la decisión es del Cerebro, textual: «que no dependa del valor. Marcá la
// credencial del ws10 con una marca explícita… que se lee aunque la fila de la plataforma no exista».
//
// La marca vive en los ajustes del NEGOCIO (`ia.su_claude.credito_de`): la HUELLA de su clave (sha256, 16 hex: no expone
// la clave) y de qué cuenta es. Vale mientras su clave sea ésa: si el negocio la cambia por una suya, la huella no coincide
// y deja de valer sola. La comparación por valor queda de respaldo, y cuando reconoce un crédito sin marca, la escribe.
// =============================================================================

import 'server-only';
import { createHash } from 'node:crypto';

export const CLAVE_CREDITO_DE = 'ia.su_claude.credito_de';

/** La huella de una clave: sha256 en hex, los 16 primeros. Sirve para reconocerla sin guardarla. */
export const huellaDeClave = (clave: string): string => createHash('sha256').update(clave.trim()).digest('hex').slice(0, 16);

export type MarcaDeCredito = { cuenta: string; huella: string };

/** La marca del negocio en curso (o de `ws`): `null` sin marca. Tira si no pudo leer. */
export async function leerMarcaDeCredito(ws?: number): Promise<MarcaDeCredito | null> {
  // Estricto: si la base no contesta, TIRA (y quien llama decide «no sé»). Con `getSetting`, un bache se leía «sin marca».
  const { getSettingEstricto } = await import('./settings');
  const { runWithWorkspace } = await import('./workspace');
  const crudo = ws == null ? await getSettingEstricto(CLAVE_CREDITO_DE) : await runWithWorkspace(ws, () => getSettingEstricto(CLAVE_CREDITO_DE));
  if (!crudo) return null;
  try {
    const m = JSON.parse(crudo) as Partial<MarcaDeCredito>;
    return typeof m.huella === 'string' && /^[0-9a-f]{16}$/.test(m.huella) ? { cuenta: String(m.cuenta ?? ''), huella: m.huella } : null;
  } catch { return null; }
}

/** ¿Esta clave es la marcada como crédito? */
export const esElCreditoMarcado = (clave: string, marca: MarcaDeCredito | null): boolean => !!marca && huellaDeClave(clave) === marca.huella;

/** Marca la clave del negocio en curso (o de `ws`) como el crédito `cuenta`. Best-effort: nunca tira. */
export async function marcarCredito(clave: string, cuenta: string, ws?: number): Promise<boolean> {
  try {
    const { setSetting } = await import('./settings');
    const { runWithWorkspace } = await import('./workspace');
    const valor = JSON.stringify({ cuenta, huella: huellaDeClave(clave) });
    if (ws == null) await setSetting(CLAVE_CREDITO_DE, valor);
    else await runWithWorkspace(ws, () => setSetting(CLAVE_CREDITO_DE, valor));
    console.warn(`[credito-marca] ws=${ws ?? 'actual'}: su clave de Claude es el crédito de Max de la plataforma (${cuenta}); quedó marcada`);
    return true;
  } catch (e) {
    console.warn(`[credito-marca] no pude marcar el crédito: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}
