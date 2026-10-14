// =============================================================================
// graficos-ia-generar — «Pídeselo a MaKo»: la IA arma UNA hoja del Dashboard a partir de un pedido
// =============================================================================
// Mudado de app/api/graficos/ia/route.ts (11/10/2026) para que lo llamen DOS puertas con el mismo
// cuerpo: el modal «Nueva hoja» (la ruta) y la API de MaKo (`crear_hoja_dashboard` con `pedido`,
// lib/api-mako/areas/dashboard.run.ts). Con una copia en cada lado, la segunda se queda vieja (AGENTS.md,
// «Una cosa, un lugar»): la red de plataforma, el pin gratis y la traducción en el `validar` viven acá.
//
// ⚠️ NO GUARDA NADA. Devuelve la hoja saneada; quien la mete en el informe es el que llama (el editor con
//    `mutar`, la API con su compare-and-set de lib/graficos-tablero.ts).
//
// ⚠️ NUNCA POR CLAUDE NI POR NADA QUE COBRE. `chatCheapCascade` sobre la lista gratis medida de
//    Automations (`PROVS_CREAR_IA`: gemini → groq → openrouter, con el modelo gratis vivo de
//    OpenRouter), con el pin de /modelos-ia PRIMERO si es un proveedor gratis; un pin pago se ignora.
//    La feature (`dashboard-hoja-ia`, lib/model-catalogo.ts) no tiene fila en CLAUDE_PERMITIDO.
//
// LAS DOS CAPAS: el prompt pide ids del catálogo; `deIAHoja` (lib/graficos-ia.ts) es el `validar` de
// la cascada y rechaza lo que no sirve, así una salida inservible prueba el proveedor siguiente en vez
// de llegar a la pantalla. Tres escalones, como en Automations: la cascada; si un proveedor escribió
// un JSON roto, que la cascada lo COPIE como JSON válido; si lo leído tenía errores, UN reintento
// diciéndole cuáles. Después, la RED DE PLATAFORMA. Si nada sirve, el motivo honesto (`falloDeIA`).
//
// ⚠️ EL PLAZO ES DEL QUE LLAMA. La ruta corta a los 120 s y le da 100 a la cascada; /api/v1 corta a los
//    60 s, y la API de MaKo pasa `plazoMs` más corto: con el de la ruta, la función moría a mitad de un
//    intento sin contestar nada.

import 'server-only';
import { chatCheapCascade, MODELO_DOCS, provsDe, tokensAprox, techoDeEntrada, type ProvName } from './ai-cheap';
import { overrideDeFeature } from './model-registry';
import { getPromptText } from './prompt-render';
import { parseJsonObject } from './json-del-modelo';
import { PROVS_CREAR_IA, PROVS_GRATIS_PIN, MODELOS_CREAR_IA, salidaParaIA, falloDeIA, type FalloIA } from './flujo-ia';
import { FEATURE_HOJA_IA, HOJA_IA_SYSTEM_TEMPLATE, deIAHoja, userDeHoja, type ResultadoHojaIA } from './graficos-ia';
import { porLaRedDePlataforma } from './graficos-ia-red';
import { FUENTES } from './graficos-catalogo';

/** Lo que tiene la cascada para contestar, por defecto (el de la ruta: deja aire para traducir y responder). */
export const PLAZO_MODELO_MS = 100_000;
/** Lo mínimo que tiene que quedar para intentar un escalón más (copiar o corregir). */
const MIN_PARA_OTRO_MS = 25_000;
/** Un intento de un proveedor. */
const TIMEOUT_INTENTO_MS = 60_000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** UNA pasada por la cascada gratis, con `deIAHoja` adentro del `validar`. */
async function pasada(p: {
  system: string; user: string; motivo: string; hastaMs: number;
  provs: ProvName[]; modelos: Partial<Record<ProvName, string>>; errores: string[];
}): Promise<{ bueno: ResultadoHojaIA | null; crudos: string[]; ultimo: string[] | null }> {
  const out: { bueno: ResultadoHojaIA | null; crudos: string[]; ultimo: string[] | null } = { bueno: null, crudos: [], ultimo: null };
  // ⚠️ LA SALIDA SE DIMENSIONA PARA QUE GROQ ENTRE (`salidaParaIA`): con 6000 fijos la cascada lo
  // saltea, y suele ser el único que contesta (lib/flujo-ia.ts, la medición del 09/10).
  const maxTokens = salidaParaIA(tokensAprox(p.system) + tokensAprox(p.user), techoDeEntrada('groq'));
  await chatCheapCascade({
    system: p.system, user: p.user, json: true, maxTokens, temperature: 0.3,
    feature: FEATURE_HOJA_IA, motivo: p.motivo,
    provs: p.provs, modelos: p.modelos, timeoutMs: TIMEOUT_INTENTO_MS, hastaMs: p.hastaMs,
    erroresOut: p.errores,
    validar: (t) => {
      let obj: Record<string, unknown>;
      try { obj = parseJsonObject(t); } catch { out.crudos.push(t); return false; }
      const r = deIAHoja(obj);
      if (r.errores.length) { out.ultimo = r.errores; return false; }
      out.bueno = r;
      return true;
    },
  }).catch((e) => { p.errores.push(msg(e)); return ''; });
  return out;
}

/**
 * La hoja que pide `pedido`, o el motivo honesto por el que no salió. `inicio` es el arranque del pedido
 * (ms epoch); `plazoMs`, cuánto tiene la cascada desde ahí (por defecto, el de la ruta).
 */
export async function generarHojaIA(pedido: string, inicio: number, opts: { plazoMs?: number; soloFuentes?: readonly string[] } = {}): Promise<ResultadoHojaIA | FalloIA> {
  const system = await getPromptText('dashboard.hoja-ia.system', HOJA_IA_SYSTEM_TEMPLATE);
  // `soloFuentes` (13/10/2026): el catálogo con sólo esos conjuntos (los que tienen datos, lib/graficos-con-datos-server.ts).
  const user = opts.soloFuentes ? userDeHoja(pedido, FUENTES.filter((f) => opts.soloFuentes!.includes(f.id))) : userDeHoja(pedido);
  // El pin de /modelos-ia va PRIMERO y el resto atrás (con el pin solo, una key bloqueada dejaba la
  // feature sin nadie a quien caer). Un pin pago (Claude, OpenAI) no se usa: esta feature no cobra.
  const pin = await overrideDeFeature(FEATURE_HOJA_IA).catch(() => null);
  const pinGratis = pin != null && PROVS_GRATIS_PIN.includes(pin.provider as ProvName) ? pin : null;
  const provs: ProvName[] = pinGratis
    ? [pinGratis.provider as ProvName, ...PROVS_CREAR_IA.filter((x) => x !== pinGratis.provider)]
    : [...PROVS_CREAR_IA];
  const modelos: Partial<Record<ProvName, string>> = {
    ...MODELO_DOCS, ...MODELOS_CREAR_IA,
    ...(pinGratis ? { [pinGratis.provider]: pinGratis.model } : {}),
  };
  const hastaMs = inicio + (opts.plazoMs ?? PLAZO_MODELO_MS);
  const quedan = () => hastaMs - Date.now();
  const errores: string[] = [];

  const uno = await pasada({ system, user, motivo: 'Armar una hoja del Dashboard con IA', hastaMs, provs, modelos, errores });
  if (uno.bueno) return uno.bueno;
  let ultimo = uno.ultimo;

  // 2. Un JSON que no se pudo leer: que la cascada lo copie bien (no se le pide que piense).
  if (uno.crudos.length && quedan() > MIN_PARA_OTRO_MS) {
    const crudo = uno.crudos[uno.crudos.length - 1];
    console.error('[graficos/ia] JSON inválido del modelo (2000):', crudo.slice(0, 2000));
    const copia = await chatCheapCascade({
      system: 'Recibes un texto que pretende ser un JSON pero tiene errores de sintaxis. Devuelve EXACTAMENTE el mismo contenido como JSON válido: mismas claves, mismos valores, mismo orden. No agregues, no quites, no comentes. Solo el JSON.',
      user: crudo.slice(0, 30_000), json: true, maxTokens: 4000, temperature: 0,
      feature: FEATURE_HOJA_IA, motivo: 'reparar el JSON de la hoja', provs, modelos, hastaMs, erroresOut: errores,
      validar: (t) => { try { parseJsonObject(t); return true; } catch { return false; } },
    }).catch((e) => { errores.push(msg(e)); return ''; });
    if (copia) {
      try {
        const r = deIAHoja(parseJsonObject(copia));
        if (!r.errores.length) return r;
        ultimo = r.errores;
      } catch { /* sigue al reintento o al error */ }
    }
  }

  // 3. Lo leído tenía errores: un reintento diciéndole cuáles (con ids: los lee el modelo).
  if (ultimo && quedan() > MIN_PARA_OTRO_MS) {
    const corregir = `${user}\n\nTU RESPUESTA ANTERIOR TENÍA ESTOS PROBLEMAS. Corrígelos y devuelve el JSON COMPLETO:\n${ultimo.slice(0, 12).map((e) => `- ${e}`).join('\n')}`;
    const dos = await pasada({ system, user: corregir, motivo: 'Corregir la hoja del Dashboard con IA', hastaMs, provs, modelos, errores });
    if (dos.bueno) return dos.bueno;
    if (dos.ultimo) ultimo = dos.ultimo;
  }

  // 4. La RED DE PLATAFORMA (lib/graficos-ia-red.ts): las keys del negocio no armaron nada usable (o no
  //    tiene). Martín, 11/10/2026: «siempre tiene que probar con otros provedoores». Sus errores van al
  //    log, nunca al mensaje: el texto de abajo se arma con los del negocio.
  if (quedan() > MIN_PARA_OTRO_MS) {
    // Una caja: lo que asigna el `validar` (un closure) no lo ve el análisis de flujo de TypeScript.
    const deLaRed: { r: ResultadoHojaIA | null } = { r: null };
    await porLaRedDePlataforma({
      system, user, maxTokens: salidaParaIA(tokensAprox(system) + tokensAprox(user), techoDeEntrada('groq')),
      feature: FEATURE_HOJA_IA, motivo: 'Armar una hoja del Dashboard con IA', hastaMs,
      validar: (t) => {
        try {
          const r = deIAHoja(parseJsonObject(t));
          if (r.errores.length) return false;
          deLaRed.r = r;
          return true;
        } catch { return false; }
      },
    });
    if (deLaRed.r) return deLaRed.r;
  }

  if (ultimo) {
    // ⚠️ EL DETALLE VA AL LOG, NO A LA PANTALLA: trae ids del catálogo que no le dicen nada a nadie.
    console.error('[graficos/ia] la salida no pasó la revisión:', ultimo.join(' | '));
    return { error: 'MaKo no pudo armar esa hoja con tus datos. Prueba con otras palabras.' };
  }
  if (uno.crudos.length) return { error: 'MaKo armó la hoja pero se cortó al leerla. Prueba de nuevo.' };
  console.error('[graficos/ia] ningún proveedor armó la hoja:', errores.join(' | '));
  const hayIA = (await Promise.all(provs.map((x) => provsDe(x).catch(() => [])))).some((l) => l.length > 0);
  return falloDeIA(errores, hayIA);
}
