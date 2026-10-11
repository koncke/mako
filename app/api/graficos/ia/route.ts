// =============================================================================
// /api/graficos/ia — «Pídeselo a MaKo»: la IA arma una hoja del Dashboard (punto 19)
// =============================================================================
// Martín, 11/10/2026: «replica el modal que tenemos en "Automations", en donde al principio tenemos
// la opción de "Pídeselo a MaKo"». Lo llama app/dashboard/NuevaHoja.tsx.
//
//   POST { pedido } → { ok: true, hoja, avisos } | { ok: false, error, link? }
//
// ⚠️ NO GUARDA NADA. El informe es UN JSON por persona que el navegador reescribe entero, con
//    autoguardado (lib/graficos-tablero.ts, EditorInforme.tsx): si esta ruta escribiera, serían dos
//    escritores con ritmos distintos y el próximo autoguardado pisaría la hoja. Devuelve la hoja y el
//    editor la mete con `mutar` (que además le da el deshacer). Por eso cancelar sale gratis.
//
// ⚠️ LA PUERTA ES LA DE /api/graficos: admin del workspace Y la tab en su capa (404 si no está). La de
//    Automations sólo mira el rol; copiada, un workspace sin el Dashboard llegaba por acá.
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
// diciéndole cuáles. Si nada sirve, el motivo honesto por proveedor (`falloDeIA`).
// =============================================================================

import { NextResponse } from 'next/server';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { chatCheapCascade, MODELO_DOCS, provsDe, tokensAprox, techoDeEntrada, type ProvName } from '@/lib/ai-cheap';
import { overrideDeFeature } from '@/lib/model-registry';
import { getPromptText } from '@/lib/prompt-render';
import { parseJsonObject } from '@/lib/json-del-modelo';
import { PROVS_CREAR_IA, PROVS_GRATIS_PIN, MODELOS_CREAR_IA, salidaParaIA, falloDeIA, type FalloIA } from '@/lib/flujo-ia';
import { FEATURE_HOJA_IA, HOJA_IA_SYSTEM_TEMPLATE, TOPE_PEDIDO_IA, deIAHoja, userDeHoja, type ResultadoHojaIA } from '@/lib/graficos-ia';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/**
 * El tope de la función. Una hoja son ~1-2k tokens de salida: Gemini Flash la escribe en 5-15 s y el
 * modelo gratis de OpenRouter en ~20 s. Con un respaldo, la copia como JSON y un reintento, 120 da
 * aire. El cliente corta a 120 + margen (app/dashboard/NuevaHoja.tsx).
 */
export const maxDuration = 120;

/** Lo que tiene la cascada para contestar (deja aire para traducir y responder). */
const PLAZO_MODELO_MS = 100_000;
/** Lo mínimo que tiene que quedar para intentar un escalón más (copiar o corregir). */
const MIN_PARA_OTRO_MS = 25_000;
/** Un intento de un proveedor. */
const TIMEOUT_INTENTO_MS = 60_000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

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

async function generar(system: string, user: string, inicio: number): Promise<ResultadoHojaIA | FalloIA> {
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
  const hastaMs = inicio + PLAZO_MODELO_MS;
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

export async function POST(req: Request) {
  const inicio = Date.now();
  const rol = await getRolWsEfectivo();
  if (rol == null) return err(401, 'no autenticado');
  if (rol !== 'admin') return err(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('graphics', await getCapaActual())) return err(404, 'No existe');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  const pedido = typeof body?.pedido === 'string' ? body.pedido.trim().slice(0, TOPE_PEDIDO_IA) : '';
  if (!pedido) return err(400, 'Escribe qué quieres ver.');

  const system = await getPromptText('dashboard.hoja-ia.system', HOJA_IA_SYSTEM_TEMPLATE);
  const r = await generar(system, userDeHoja(pedido), inicio);
  if ('error' in r) return NextResponse.json({ ok: false, error: r.error, ...(r.link ? { link: r.link } : {}) }, { status: 502 });
  if (r.correcciones.length) console.log('[graficos/ia] hoja aceptada con correcciones:', r.correcciones.join(' | '));
  return NextResponse.json({ ok: true, hoja: r.hoja, avisos: r.avisos });
}
