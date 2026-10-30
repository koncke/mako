// =============================================================================
// graficos-ia-editar — «Editar con MaKo»: la cascada GRATIS que cambia la hoja abierta con un pedido
// =============================================================================
// La mitad que llama a la IA; lo puro (el system, cómo se cuenta la hoja, cómo se aplica lo que vuelve) vive en
// lib/graficos-ia-edicion.ts. La llaman DOS puertas con el mismo cuerpo: el panel de la hoja (app/api/graficos/editar) y
// la API de MaKo (`editar_hoja_con_ia_dashboard` y `editar_hoja_general_con_ia`).
//
// ⚠️ LOS MISMOS CUATRO ESCALONES QUE «PÍDESELO A MaKo» (`generarHojaIA`, lib/graficos-ia-generar.ts), en el mismo
//    orden: la cascada gratis con `aplicarEdicion` en el `validar`; si un proveedor escribió un JSON roto, que la cascada
//    lo COPIE; si lo leído tenía errores, UN reintento diciéndole cuáles; y la RED DE PLATAFORMA. Si nada sirve, el
//    motivo honesto (`falloDeIA`). No se unificaron: los tests de «Pídeselo» fijan su forma línea por línea, y
//    tests/graficos-ia-edicion.test.ts compara los dos para que no se separen.
// ⚠️ NUNCA POR CLAUDE NI POR NADA QUE COBRE: la feature es la de «Pídeselo» (`dashboard-hoja-ia`, sin la marca `pii`:
//    a la IA no le llega ningún dato del negocio), con los mismos proveedores (`proveedoresHojaIA`).
// ⚠️ NO GUARDA NADA: devuelve la hoja nueva. El editor la mete con `mutar`; la API, con su compare-and-set.

import 'server-only';
import { chatCheapCascade, provsDe, tokensAprox, techoDeEntrada, type ProvName } from './ai-cheap';
import { getPromptText } from './prompt-render';
import { parseJsonObject } from './json-del-modelo';
import { salidaParaIA, falloDeIA, type FalloIA } from './flujo-ia';
import { FEATURE_HOJA_IA, type AlcanceIA } from './graficos-ia';
import {
  CLAVE_PROMPT_EDITAR, EDITAR_HOJA_IA_SYSTEM_TEMPLATE, TOPE_EXPERIMENTOS_IA, aplicarEdicion, conExperimentos, userDeEdicion,
  type ResultadoEdicion, type TurnoEdicion,
} from './graficos-ia-edicion';
import { PLAZO_MODELO_MS, proveedoresHojaIA } from './graficos-ia-generar';
import { porLaRedDePlataforma } from './graficos-ia-red';
import type { Hoja } from './graficos-catalogo';
import { listExperimentos } from './experimentos';
import type { ExperimentoConocido } from './graficos-ia';

/** Los experimentos del negocio que «Editar con MaKo» puede poner en la hoja (los más nuevos primero). */
async function experimentosConocidos(): Promise<ExperimentoConocido[]> {
  try {
    const xs = await listExperimentos();
    return xs.slice(0, TOPE_EXPERIMENTOS_IA).map((x) => ({ id: Number(x.id), titulo: String(x.titulo ?? '').trim() || `Experimento ${x.id}`, estado: String(x.estado ?? '') }));
  } catch (e) {
    console.error('[graficos-ia-editar] sin la lista de experimentos:', e instanceof Error ? e.message : e);
    return [];
  }
}

/** Lo mínimo que tiene que quedar para intentar un escalón más (copiar o corregir). */
const MIN_PARA_OTRO_MS = 25_000;
/** Un intento de un proveedor. */
const TIMEOUT_INTENTO_MS = 60_000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** UNA pasada por la cascada gratis, con `aplicarEdicion` adentro del `validar`. */
async function pasada(p: {
  system: string; user: string; motivo: string; hastaMs: number; hoja: Hoja; alcance?: AlcanceIA;
  provs: ProvName[]; modelos: Partial<Record<ProvName, string>>; errores: string[];
}): Promise<{ bueno: ResultadoEdicion | null; crudos: string[]; ultimo: string[] | null }> {
  const out: { bueno: ResultadoEdicion | null; crudos: string[]; ultimo: string[] | null } = { bueno: null, crudos: [], ultimo: null };
  const maxTokens = salidaParaIA(tokensAprox(p.system) + tokensAprox(p.user), techoDeEntrada('groq'));
  await chatCheapCascade({
    system: p.system, user: p.user, json: true, maxTokens, temperature: 0.2,
    feature: FEATURE_HOJA_IA, motivo: p.motivo,
    provs: p.provs, modelos: p.modelos, timeoutMs: TIMEOUT_INTENTO_MS, hastaMs: p.hastaMs,
    erroresOut: p.errores,
    validar: (t) => {
      let obj: Record<string, unknown>;
      try { obj = parseJsonObject(t); } catch { out.crudos.push(t); return false; }
      const r = aplicarEdicion(p.hoja, obj, p.alcance);
      if (r.errores.length) { out.ultimo = r.errores; return false; }
      out.bueno = r;
      return true;
    },
  }).catch((e) => { p.errores.push(msg(e)); return ''; });
  return out;
}

/**
 * La hoja cambiada según `pedido`, o el motivo honesto por el que no salió. `inicio` es el arranque del pedido (ms
 * epoch); `plazoMs`, cuánto tiene la cascada desde ahí. `alcance`: lo que la hoja acepta (`ALCANCE_GENERAL` en General).
 */
export async function editarHojaIA(p: {
  hoja: Hoja; pedido: string; historial?: readonly TurnoEdicion[]; alcance?: AlcanceIA; inicio: number; plazoMs?: number;
  /** Lo que el sistema leyó de los archivos del pedido (userDeEdicion lo pone aparte, como dato). */
  archivos?: string;
}): Promise<ResultadoEdicion | FalloIA> {
  const system = await getPromptText(CLAVE_PROMPT_EDITAR, EDITAR_HOJA_IA_SYSTEM_TEMPLATE);
  // LOS EXPERIMENTOS QUE YA EXISTEN (17/10/2026): sin esto, los de antes y los que crea la API no se veían en ninguna
  // pantalla. Sólo en el Dashboard; si no se pueden leer, MaKo sigue sin ellos (sólo puede proponer uno nuevo).
  const alcance: AlcanceIA | undefined = conExperimentos(p.alcance)
    ? { ...(p.alcance ?? {}), experimentos: await experimentosConocidos() }
    : p.alcance;
  p = { ...p, alcance };
  const user = userDeEdicion({ hoja: p.hoja, pedido: p.pedido, historial: p.historial, alcance: p.alcance, archivos: p.archivos });
  const { provs, modelos } = await proveedoresHojaIA();
  const hastaMs = p.inicio + (p.plazoMs ?? PLAZO_MODELO_MS);
  const quedan = () => hastaMs - Date.now();
  const errores: string[] = [];
  const base = { system, hastaMs, hoja: p.hoja, alcance: p.alcance, provs, modelos, errores };

  // 1. La cascada gratis.
  const uno = await pasada({ ...base, user, motivo: 'Editar una hoja del Dashboard con IA' });
  if (uno.bueno) return uno.bueno;
  let ultimo = uno.ultimo;

  // 2. Un JSON que no se pudo leer: que la cascada lo copie bien (no se le pide que piense).
  if (uno.crudos.length && quedan() > MIN_PARA_OTRO_MS) {
    const crudo = uno.crudos[uno.crudos.length - 1];
    console.error('[graficos/editar] JSON inválido del modelo (2000):', crudo.slice(0, 2000));
    const copia = await chatCheapCascade({
      system: 'Recibes un texto que pretende ser un JSON pero tiene errores de sintaxis. Devuelve EXACTAMENTE el mismo contenido como JSON válido: mismas claves, mismos valores, mismo orden. No agregues, no quites, no comentes. Solo el JSON.',
      user: crudo.slice(0, 30_000), json: true, maxTokens: 4000, temperature: 0,
      feature: FEATURE_HOJA_IA, motivo: 'reparar el JSON de la edición', provs, modelos, hastaMs, erroresOut: errores,
      validar: (t) => { try { parseJsonObject(t); return true; } catch { return false; } },
    }).catch((e) => { errores.push(msg(e)); return ''; });
    if (copia) {
      try {
        const r = aplicarEdicion(p.hoja, parseJsonObject(copia), p.alcance);
        if (!r.errores.length) return r;
        ultimo = r.errores;
      } catch { /* sigue al reintento o al error */ }
    }
  }

  // 3. Lo leído tenía errores: un reintento diciéndole cuáles (con ids: los lee el modelo).
  if (ultimo && quedan() > MIN_PARA_OTRO_MS) {
    const corregir = `${user}\n\nTU RESPUESTA ANTERIOR TENÍA ESTOS PROBLEMAS. Corrígelos y devuelve el JSON COMPLETO:\n${ultimo.slice(0, 12).map((e) => `- ${e}`).join('\n')}`;
    const dos = await pasada({ ...base, user: corregir, motivo: 'Corregir la edición de la hoja con IA' });
    if (dos.bueno) return dos.bueno;
    if (dos.ultimo) ultimo = dos.ultimo;
  }

  // 4. La RED DE PLATAFORMA (lib/graficos-ia-red.ts): las keys del negocio no contestaron nada usable (o no tiene).
  //    Sus errores van al log, nunca al mensaje.
  if (quedan() > MIN_PARA_OTRO_MS) {
    const deLaRed: { r: ResultadoEdicion | null } = { r: null };
    await porLaRedDePlataforma({
      system, user, maxTokens: salidaParaIA(tokensAprox(system) + tokensAprox(user), techoDeEntrada('groq')),
      feature: FEATURE_HOJA_IA, motivo: 'Editar una hoja del Dashboard con IA', hastaMs,
      validar: (t) => {
        try {
          const r = aplicarEdicion(p.hoja, parseJsonObject(t), p.alcance);
          if (r.errores.length) return false;
          deLaRed.r = r;
          return true;
        } catch { return false; }
      },
    });
    if (deLaRed.r) return deLaRed.r;
  }

  if (ultimo) {
    // ⚠️ EL DETALLE VA AL LOG, NO A LA PANTALLA: trae ids que no le dicen nada a nadie.
    console.error('[graficos/editar] la salida no pasó la revisión:', ultimo.join(' | '));
    return { error: 'MaKo no pudo hacer ese cambio en esta hoja. Prueba con otras palabras.' };
  }
  if (uno.crudos.length) return { error: 'MaKo contestó pero se cortó al leerlo. Prueba de nuevo.' };
  console.error('[graficos/editar] ningún proveedor contestó:', errores.join(' | '));
  const hayIA = (await Promise.all(provs.map((x) => provsDe(x).catch(() => [])))).some((l) => l.length > 0);
  return falloDeIA(errores, hayIA);
}
