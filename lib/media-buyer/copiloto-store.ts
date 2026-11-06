// =============================================================================
// Marketing CoPilot — dónde se guarda lo que respondió en la primera entrada (6/11/2026)
// =============================================================================
// Por negocio, en `app_settings` (`marketing-copilot.perfil`), como el arranque del Media Buyer: es estado de la charla, no config.
// Sin migración. Tolerante: una lectura que falla es «no respondió nada» y la pantalla muestra la entrada, nunca se cae.
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '@/lib/workspace';
import { getSetting, getSettingEstricto, setSetting } from '@/lib/settings';
import { CLAVE_COPILOTO, sanearPerfil, type PerfilCopiloto } from './copiloto';

export async function leerPerfilCopiloto(ws: number): Promise<PerfilCopiloto> {
  try {
    const crudo = await runWithWorkspace(ws, () => getSetting(CLAVE_COPILOTO));
    return crudo ? sanearPerfil(JSON.parse(crudo)) : {};
  } catch { return {}; }
}

/**
 * La lectura ESTRICTA: tira si no pudo leer. La usa la charla para ver si MaKo guardó un cambio después de un turno: con la tolerante,
 * una lectura caída devolvía `{}` y la pantalla lo tomaba por «empezó de nuevo» (una lectura que decide no cae al default).
 */
export async function leerPerfilCopilotoEstricto(ws: number): Promise<PerfilCopiloto> {
  const crudo = await runWithWorkspace(ws, () => getSettingEstricto(CLAVE_COPILOTO));
  return crudo ? sanearPerfil(JSON.parse(crudo)) : {};
}

export async function guardarPerfilCopiloto(ws: number, p: PerfilCopiloto): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(CLAVE_COPILOTO, JSON.stringify(p).slice(0, 4000)));
}
