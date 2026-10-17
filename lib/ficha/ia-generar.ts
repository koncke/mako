// =============================================================================
// ficha/ia-generar — MaKo arma UNA tab de la ficha a partir de un pedido (la cascada barata de la casa)
// =============================================================================
// Lo llaman DOS puertas con el mismo cuerpo: la caja «¿Qué vas a crear hoy?» de la galería de una tab
// (app/api/crm/ficha/armar) y la API de MaKo (`armar_tab_ficha`, lib/api-mako/areas/crm.run.ts). Es el molde de
// `generarHojaIA` (lib/graficos-ia-generar.ts), el pedido de hoja del Dashboard: la misma cascada y la misma red.
//
// ⚠️ NO GUARDA NADA. Devuelve la tab saneada; quien la guarda es el que llama (la pantalla con el cambio `armar`,
//    que se puede deshacer; la API al confirmar). Por eso cancelar sale gratis.
// ⚠️ NUNCA POR CLAUDE NI POR NADA QUE COBRE de las keys del negocio: `chatCheapCascade` sobre la lista gratis de
//    Automations (`PROVS_CREAR_IA`), con el pin de /modelos-ia PRIMERO si es un proveedor gratis (uno pago se ignora).
//    Después, la RED DE PLATAFORMA de la casa (lib/graficos-ia-red.ts: el crédito de Claude ya pagado y las keys
//    gratis de la agencia). El pedido no lleva datos de clientes (`pii: false` en el catálogo de modelos).
// ⚠️ SÓLO SE OFRECE LO QUE SE DIBUJA: los bloques de la tab con componente (`reglasDe`, el registro puro de la
//    pantalla), igual que «Agregar bloque».
// =============================================================================

import 'server-only';
import { chatCheapCascade, MODELO_DOCS, provsDe, tokensAprox, techoDeEntrada, type ProvName } from '../ai-cheap';
import { overrideDeFeature } from '../model-registry';
import { getPromptText } from '../prompt-render';
import { parseJsonObject } from '../json-del-modelo';
import { PROVS_CREAR_IA, PROVS_GRATIS_PIN, MODELOS_CREAR_IA, salidaParaIA, falloDeIA, type FalloIA } from '../flujo-ia';
import { porLaRedDePlataforma } from '../graficos-ia-red';
import { reglasDe } from '../../app/crm/lead-view/ficha/reglas';
import type { LugarFicha } from './catalogo';
import { FEATURE_TAB_IA, TAB_IA_SYSTEM_TEMPLATE, TOPE_PEDIDO_TAB, deIATab, ofrecidosParaIA, userDeTab, type ResultadoTabIA } from './ia';

/** Lo que tiene la cascada para contestar, por defecto (el de la ruta). */
export const PLAZO_TAB_IA_MS = 90_000;
const MIN_PARA_OTRO_MS = 20_000;
const TIMEOUT_INTENTO_MS = 45_000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** La tab que pide `pedido`, o el motivo honesto por el que no salió. */
export async function generarTabIA(pedido: string, tab: LugarFicha, inicio: number, opts: { plazoMs?: number } = {}): Promise<ResultadoTabIA | FalloIA> {
  const ofrecidos = ofrecidosParaIA(tab, (id) => !!reglasDe(id));
  if (!ofrecidos.length) return { error: 'Esta tab todavía no tiene bloques para armar.' };
  const system = await getPromptText('crm.ficha-tab-ia.system', TAB_IA_SYSTEM_TEMPLATE);
  const user = userDeTab(pedido.slice(0, TOPE_PEDIDO_TAB), tab, ofrecidos);
  const pin = await overrideDeFeature(FEATURE_TAB_IA).catch(() => null);
  const pinGratis = pin != null && PROVS_GRATIS_PIN.includes(pin.provider as ProvName) ? pin : null;
  const provs: ProvName[] = pinGratis
    ? [pinGratis.provider as ProvName, ...PROVS_CREAR_IA.filter((x) => x !== pinGratis.provider)]
    : [...PROVS_CREAR_IA];
  const modelos: Partial<Record<ProvName, string>> = { ...MODELO_DOCS, ...MODELOS_CREAR_IA, ...(pinGratis ? { [pinGratis.provider]: pinGratis.model } : {}) };
  const hastaMs = inicio + (opts.plazoMs ?? PLAZO_TAB_IA_MS);
  const quedan = () => hastaMs - Date.now();
  const errores: string[] = [];
  // Una caja: lo que asigna el `validar` (un closure) no lo ve el análisis de flujo de TypeScript.
  const ult: { e: string[] | null } = { e: null };

  /** UNA pasada por la cascada gratis, con `deIATab` adentro del `validar`. */
  const pasada = async (u: string, motivo: string): Promise<ResultadoTabIA | null> => {
    const caja: { r: ResultadoTabIA | null } = { r: null };
    await chatCheapCascade({
      system, user: u, json: true, temperature: 0.3, feature: FEATURE_TAB_IA, motivo,
      maxTokens: salidaParaIA(tokensAprox(system) + tokensAprox(u), techoDeEntrada('groq')),
      provs, modelos, timeoutMs: TIMEOUT_INTENTO_MS, hastaMs, erroresOut: errores,
      validar: (t) => {
        let r: ResultadoTabIA;
        try { r = deIATab(parseJsonObject(t), tab, ofrecidos); } catch { return false; }
        if (r.errores.length) { ult.e = r.errores; return false; }
        caja.r = r;
        return true;
      },
    }).catch((e) => { errores.push(msg(e)); return ''; });
    return caja.r;
  };

  const uno = await pasada(user, 'Armar una tab de la ficha con IA');
  if (uno) return uno;
  // Lo leído tenía errores: un reintento diciéndole cuáles.
  if (ult.e && quedan() > MIN_PARA_OTRO_MS) {
    const corregir = `${user}\n\nTU RESPUESTA ANTERIOR TENÍA ESTOS PROBLEMAS. Corrígelos y devuelve el JSON COMPLETO:\n${ult.e.slice(0, 8).map((e) => `- ${e}`).join('\n')}`;
    const dos = await pasada(corregir, 'Corregir una tab de la ficha con IA');
    if (dos) return dos;
  }
  // La red de plataforma: las keys del negocio no armaron nada usable (o no tiene).
  if (quedan() > MIN_PARA_OTRO_MS) {
    const deLaRed: { r: ResultadoTabIA | null } = { r: null };
    await porLaRedDePlataforma({
      system, user, maxTokens: salidaParaIA(tokensAprox(system) + tokensAprox(user), techoDeEntrada('groq')),
      feature: FEATURE_TAB_IA, motivo: 'Armar una tab de la ficha con IA', hastaMs,
      validar: (t) => {
        try {
          const r = deIATab(parseJsonObject(t), tab, ofrecidos);
          if (r.errores.length) return false;
          deLaRed.r = r;
          return true;
        } catch { return false; }
      },
    });
    if (deLaRed.r) return deLaRed.r;
  }
  if (ult.e) {
    // El detalle va al log: trae ids del catálogo que no le dicen nada a nadie.
    console.error('[ficha/ia] la salida no pasó la revisión:', ult.e.join(' | '));
    return { error: 'MaKo no pudo armar esa tab. Prueba con otras palabras.' };
  }
  console.error('[ficha/ia] ningún proveedor armó la tab:', errores.join(' | '));
  const hayIA = (await Promise.all(provs.map((x) => provsDe(x).catch(() => [])))).some((l) => l.length > 0);
  return falloDeIA(errores, hayIA);
}
