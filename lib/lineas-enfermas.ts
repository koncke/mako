// =============================================================================
// lineas-enfermas — las marcas que dejan los vigilantes: la voz SORDA y las líneas ATRASADAS (11/11/2026)
// =============================================================================
// Las escribe el cron alerta-critica (lib/canal-vigilante.ts: `vigilarSorderaDeLaVoz`, `vigilarDemoraDeLaLinea`) en los ajustes de la
// plataforma, y las lee el panel al tocar «Conectar» (lib/mako-canal.ts `conectarCanalMaKo`, lib/evolution.ts `conectar`): con la
// línea marcada, el panel la desvincula por API y da el QR en UN paso, aunque la sonda diga «viva». Antes decía «ya está conectada» y
// Martín tenía que desvincularla a mano desde el teléfono (informe del 11/11, lib/mako-canal.ts:257).
// Sin `import` de lib/evolution (que la importa): sólo ajustes.
// =============================================================================

import 'server-only';
import { getSettingEstricto } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import type { MarcaDeSordera } from './linea-sorda';
import type { MarcaDeLinea } from './linea-demora';

/** La marca de la voz sorda (JSON de `MarcaDeSordera`; '' = no está sorda). */
export const KEY_SORDERA = 'mako.voz.sorda';
/** Las líneas atrasadas, por instancia (JSON de `Record<instancia, MarcaDeLinea>`). */
export const KEY_LINEAS_ATRASADAS = 'mako.lineas.atrasadas';

const leerJson = <T>(crudo: string | null): T | null => { if (!crudo) return null; try { return JSON.parse(crudo) as T; } catch { return null; } };

/** Las marcas de líneas atrasadas. ⚠️ Estricta: un error de la base TIRA (el que escribe no puede pisar las marcas con un mapa vacío). */
export async function lineasAtrasadasMarcadas(): Promise<Record<string, MarcaDeLinea>> {
  const ws = await wsSuperAdmin();
  return leerJson<Record<string, MarcaDeLinea>>(await runWithWorkspace(ws, () => getSettingEstricto(KEY_LINEAS_ATRASADAS))) ?? {};
}

/**
 * La marca de esta línea, si está sorda (la voz) o atrasada; null si no, o si no se pudo leer. ⚠️ Ante la duda, null: una marca que no
 * existe deja el guard de la sonda en pie (el panel no toca una línea viva); una que se inventa desvincularía a un cliente.
 */
export async function marcaDeLineaEnferma(instancia: string): Promise<{ motivo: string; vinculadaDesde: number | null } | null> {
  try {
    const ws = await wsSuperAdmin();
    const [sorda, atrasadas] = await runWithWorkspace(ws, () => Promise.all([getSettingEstricto(KEY_SORDERA), getSettingEstricto(KEY_LINEAS_ATRASADAS)]));
    const voz = leerJson<MarcaDeSordera>(sorda);
    if (voz?.linea === instancia) return { motivo: `está sorda desde ${voz.desde.slice(0, 16).replace('T', ' ')} UTC (${voz.motivo ?? 'no recibe'})`, vinculadaDesde: voz.vinculadaDesde ?? null };
    const l = leerJson<Record<string, MarcaDeLinea>>(atrasadas)?.[instancia];
    if (l) return { motivo: `recibe con ${l.tipicoMin} min de atraso típico desde ${l.desde.slice(0, 16).replace('T', ' ')} UTC`, vinculadaDesde: l.vinculadaDesde ?? null };
    return null;
  } catch {
    return null;
  }
}
