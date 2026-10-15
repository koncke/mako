// =============================================================================
// editor-video/ia — MaKo en el chat del Video Editor (lo que habla con la IA)
// =============================================================================
// El molde es `editar` de lib/editor-landing/ia.ts, y se copia tal cual en cómo se llama
// a la IA:
//   · `chatClaude(system, [{role:'user', content}], { feature, motivo, maxTokens, hastaMs })`
//     con la feature `video-editor-ia`: default GEMINI (la key del cliente por la cascada
//     gratis) y respeta /modelos-ia. Claude está VETADO: sin fila en CLAUDE_PERMITIDO, ni
//     de respaldo (decisión de «Estrategia 3 cuentas» del 15/10/2026: un chat que reescribe
//     la línea de tiempo no compra nada que justifique pagar).
//   · el pedido va acotado con `hastaMs`: si el plazo no alcanza, falla — nunca paga para
//     ganar tiempo;
//   · el JSON pasa por `parseJsonObject` y, si no alcanza, UNA reparación por la cascada
//     barata (`objetoConUnaReparacion`, la misma del Landing). Nunca más;
//   · los errores van por `errorDeCascada`.
//
// Lo que vuelve es una lista de operaciones validada en su FORMA
// (lib/editor-video/chat-catalogo.ts). Las referencias (v1, t2…) las mira el editor, que es
// el único que tiene la línea de tiempo: los proyectos viven en el navegador (decisión 5 de
// docs/diseno-editor-video.md).
// =============================================================================

import 'server-only';
import { chatClaude } from '../anthropic';
import { chatCheapCascade, errorDeCascada } from '../ai-cheap';
import { renderPrompt } from '../prompt-render';
import { contenidoNoConfiable } from '../prompt-render-pure';
import { brandSystem } from '../landing-writer';
import { parseJsonObject } from '../json-del-modelo';
import { objetoConUnaReparacion, SalidaInvalida, SYSTEM_REPARAR_JSON } from '../editor-landing/ia-reglas';
import { FORMATO_CHAT, TOPES_CHAT, catalogoParaPrompt, validarOperaciones, type OperacionChat } from './chat-catalogo';
import { CHAT_VIDEO_SYSTEM_TEMPLATE, CHAT_VIDEO_USER_TEMPLATE, PROMPTS_CHAT_VIDEO } from './chat-prompts';

export const FEATURE_CHAT_VIDEO = 'video-editor-ia';

/** El chat espera hasta acá a la IA; la ruta corta a 120 s. */
const PLAZO_IA_MS = 90_000;

export type PedidoChatVideo = { instruccion?: unknown; linea?: unknown; alcance?: unknown };

export type ResultadoChatVideo =
  | { ok: true; resumen: string; operaciones: OperacionChat[]; descartes: string[] }
  | { ok: false; error: string; status: 400 | 502 };

const invalido = (error: string) => ({ ok: false as const, error, status: 400 as const });

/** El paso de reparación: UN pedido a la cascada barata que copia la salida como JSON válido. */
function reparador(hastaMs: number) {
  return async (crudo: string): Promise<string> => {
    const errores: string[] = [];
    return chatCheapCascade({
      system: SYSTEM_REPARAR_JSON,
      user: crudo,
      json: true,
      maxTokens: 4000,
      temperature: 0,
      feature: FEATURE_CHAT_VIDEO,
      motivo: 'reparar el JSON (chat del Video Editor)',
      erroresOut: errores,
      hastaMs: Math.max(hastaMs, Date.now() + 10_000),
      validar: (t: string) => { try { parseJsonObject(t); return true; } catch { return false; } },
    }).catch(() => '');
  };
}

/** El mensaje de una falla, para la persona. Lo técnico va al log (mismo criterio que el Landing). */
async function falloIA(e: unknown): Promise<string> {
  if (e instanceof SalidaInvalida) {
    console.error(`[video-editor:chat] ${e.message}`);
    console.error(`[video-editor:chat] salida cruda (2000): ${e.crudo.slice(0, 2000)}`);
    return 'MaKo respondió pero no se pudo leer. Vuelve a intentar.';
  }
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[video-editor:chat] ${msg}`);
  return errorDeCascada(/Claude vetado/i.test(msg) ? [] : [msg], 'editar el video');
}

/**
 * La edición que pidió la persona, como operaciones del catálogo. `linea` es la vista de la
 * línea de tiempo que arma el editor (`vistaDeLinea`, app/video-editor/_opencut/chat/linea.ts),
 * ya en JSON. No escribe nada: el editor muestra la propuesta y la persona la acepta.
 */
export async function editarVideo(p: PedidoChatVideo): Promise<ResultadoChatVideo> {
  const t0 = Date.now();
  const instruccion = String(p.instruccion ?? '').trim().slice(0, TOPES_CHAT.instruccion);
  if (!instruccion) return invalido('Escribe qué quieres cambiar.');
  const linea = typeof p.linea === 'string' ? p.linea : '';
  if (!linea) return invalido('Falta la línea de tiempo.');
  if (linea.length > TOPES_CHAT.vistaMax) return invalido('El proyecto es muy grande para el chat. Elige unos clips y pídelo sobre la selección.');
  const alcance = p.alcance === 'seleccion' ? 'los elementos elegidos ("elegidos" en la LÍNEA DE TIEMPO)' : 'todo el video';

  try {
    const sys = await brandSystem(await renderPrompt(PROMPTS_CHAT_VIDEO.system.key, CHAT_VIDEO_SYSTEM_TEMPLATE, {
      catalogo: catalogoParaPrompt(),
      formato: FORMATO_CHAT,
    }));
    const user = await renderPrompt(PROMPTS_CHAT_VIDEO.user.key, CHAT_VIDEO_USER_TEMPLATE, {
      instruccion: contenidoNoConfiable(instruccion, 'instruccion'),
      alcance,
      linea: contenidoNoConfiable(linea, 'linea_de_tiempo'),
    });
    const hastaIA = t0 + PLAZO_IA_MS;
    const salida = await chatClaude(sys, [{ role: 'user', content: user }], {
      feature: FEATURE_CHAT_VIDEO,
      motivo: 'Editar el video con el chat',
      maxTokens: 4_000,
      hastaMs: hastaIA,
    });
    const raw = await objetoConUnaReparacion(salida, reparador(hastaIA));
    const { operaciones, descartes } = validarOperaciones(raw.operaciones);
    if (descartes.length) console.warn(`[video-editor:chat] descartes: ${descartes.slice(0, 20).join(' · ')}`);
    const resumenModelo = typeof raw.resumen === 'string' ? raw.resumen.trim().split('\n')[0].slice(0, 300) : '';
    return { ok: true, resumen: resumenModelo || (operaciones.length ? 'Listo.' : 'Sin cambios.'), operaciones, descartes };
  } catch (err) {
    return { ok: false, error: await falloIA(err), status: 502 };
  }
}
