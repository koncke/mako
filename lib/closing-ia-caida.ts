// =============================================================================
// closing-ia-caida — anotar (y avisar UNA vez) que el Claude del negocio no puede analizar sus llamadas (server)
// =============================================================================
// Las reglas, con test: lib/closing-ia-caida-reglas.ts. Acá la marca (app_settings del negocio) y el aviso: el evento de
// la plataforma `closing_ia_caida`, cuyo TEXTO es el de su automatización de SuperAdmin (`mako-closing-ia-caida`, un texto
// literal por motivo). Sin esa fila en la plataforma no sale nada (AGENTS.md, «nada por detrás»): la marca queda SIN
// `avisadoAt`, y la próxima vuelta lo vuelve a intentar.
// =============================================================================

import 'server-only';
import { getSetting, setSetting } from './settings';
import { emitirEventoDePlataforma } from './avisos';
import { TZ_DEFAULT, zonaDelNegocio } from './timezone';
import { fechaEnPalabras, hoyEnTz } from './date-utils';
import { linkApp } from './app-url';
import { getWorkspaceActual } from './workspace';
import { conClaveDelNegocio } from './anthropic';
import { KEY_IA_CAIDA, conFallo, datosIaCaida, leerIaCaida, resultadoDeLaPrueba, tocaAvisar, type FalloDeSuCuenta, type IaCaida } from './closing-ia-caida-reglas';

/** El incidente abierto del negocio en curso, o null. «No pude leer» = null (no frena: a lo sumo se prueba una llamada). */
export async function iaDelNegocioCaida(): Promise<IaCaida | null> {
  return leerIaCaida(await getSetting(KEY_IA_CAIDA).catch(() => null));
}

/**
 * Anota que su cuenta falló y, si este incidente todavía no se avisó, emite el evento. `pendientes` = las llamadas que
 * esperan análisis (lo que el aviso promete que se analiza solo cuando vuelva). Nunca tira: un aviso que no sale no
 * frena el Closing.
 */
export async function anotarIaCaida(ws: number, motivo: FalloDeSuCuenta, pendientes: number): Promise<{ avisado: boolean }> {
  try {
    const marca = { ...conFallo(await iaDelNegocioCaida(), motivo, new Date().toISOString()), pendientes: Math.max(0, Math.floor(pendientes)) };
    let avisado = false;
    if (tocaAvisar(marca)) {
      const tz = await zonaDelNegocio(ws);
      const desdeDia = fechaEnPalabras(hoyEnTz(tz, new Date(marca.desde)), hoyEnTz(tz));
      const r = await emitirEventoDePlataforma('closing-ia-caida', {
        ws, datos: datosIaCaida({ motivo, desdeDia, pendientes, link: linkApp('/integraciones?abrir=anthropic', ws) }),
      });
      avisado = r.filas > 0;
      if (avisado) marca.avisadoAt = new Date().toISOString();
      else console.warn(`[closing] ws=${ws}: su Claude falló (${motivo}) y la plataforma todavía no tiene la automatización «closing_ia_caida» — no salió el aviso, se reintenta`);
    }
    await setSetting(KEY_IA_CAIDA, JSON.stringify(marca));
    return { avisado };
  } catch (e) {
    console.error(`[closing] ws=${ws}: no pude anotar que su Claude falló (${e instanceof Error ? e.message : String(e)})`);
    return { avisado: false };
  }
}

/** Su Claude volvió a analizar: el incidente se cierra (el próximo, si lo hay, se avisa de nuevo). */
export async function anotarQueVolvio(): Promise<void> {
  if (await iaDelNegocioCaida()) await setSetting(KEY_IA_CAIDA, '').catch(() => {});
}

/**
 * ¿Volvió su Claude? Un pedido mínimo (un token) con SU clave, para la vuelta que no tuvo ninguna llamada que lo probara
 * (revisión del tren m, 26/10/2026). `count_tokens` no sirve: no mira el crédito. Si volvió, el incidente se cierra.
 */
export async function probarSiVolvio(): Promise<'volvio' | 'sigue' | 'no-se'> {
  const r = await conClaveDelNegocio({ system: 'Contesta solo: OK', user: 'OK', maxTokens: 1, feature: 'closing', motivo: 'Probar si volvió su Claude (Closing)', timeoutMs: 20_000 }).catch(() => null);
  const v = resultadoDeLaPrueba(r);
  if (v === 'volvio') await anotarQueVolvio().catch(() => {});
  return v;
}

/**
 * Lo que la hoja «Closing» necesita para decir por qué no analiza (27/10/2026, app/dashboard/aviso-closing.ts): el
 * incidente con su fecha en la zona del negocio y cuántas esperan. Sin incidente, null. No tira: «no pude leer» = null.
 */
export async function iaCaidaParaLaHoja(): Promise<{ motivo: FalloDeSuCuenta; desdeDia: string; pendientes: number | null } | null> {
  try {
    const c = await iaDelNegocioCaida();
    if (!c) return null;
    const ws = await getWorkspaceActual();
    const tz = ws != null ? await zonaDelNegocio(ws) : TZ_DEFAULT;
    return { motivo: c.motivo, desdeDia: fechaEnPalabras(hoyEnTz(tz, new Date(c.desde)), hoyEnTz(tz)), pendientes: c.pendientes ?? null };
  } catch { return null; }
}
