// =============================================================================
// image-editor/chat/ia — MaKo en el chat «MaKo IA» del Image Editor (lo que habla con la IA)
// =============================================================================
// Copia de lib/editor-video/ia.ts en cómo se llama a la IA:
//   · `chatClaude(system, [{role:'user', content}], { feature, motivo, maxTokens, hastaMs })` con la feature
//     `image-editor-ia`: default GEMINI (la key del cliente por la cascada gratis) y respeta /modelos-ia. Claude está
//     VETADO: sin fila en CLAUDE_PERMITIDO, ni de respaldo (el mismo criterio que el chat del Video Editor);
//   · el pedido va acotado con `hastaMs`: si el plazo no alcanza, falla — nunca paga para ganar tiempo;
//   · el JSON pasa por `parseJsonObject` y, si no alcanza, UNA reparación por la cascada barata. Nunca más.
//
// Lo que vuelve es una lista de operaciones validada en su FORMA (./catalogo.ts). Las refs las revisa quien tiene el
// diseño: el panel (contra lo abierto) o la API (contra lo guardado). Esta función no escribe nada.
// =============================================================================

import 'server-only';
import { chatClaude } from '../../anthropic';
import { chatCheapCascade, errorDeCascada } from '../../ai-cheap';
import { renderPrompt } from '../../prompt-render';
import { contenidoNoConfiable } from '../../prompt-render-pure';
import { brandSystem } from '../../landing-writer';
import { parseJsonObject } from '../../json-del-modelo';
import { objetoConUnaReparacion, SalidaInvalida, SYSTEM_REPARAR_JSON } from '../../editor-landing/ia-reglas';
import { FORMATO_CHAT_IMAGEN, TOPES_CHAT_IMAGEN, catalogoParaPrompt, validarOperaciones, type OperacionImagen } from './catalogo';
import { CHAT_IMAGEN_SYSTEM_TEMPLATE, CHAT_IMAGEN_USER_TEMPLATE, PROMPTS_CHAT_IMAGEN } from './prompts';

export const FEATURE_CHAT_IMAGEN = 'image-editor-ia';

/** El chat espera hasta aquí a la IA; la ruta corta a 120 s. */
const PLAZO_IA_MS = 90_000;

export type PedidoChatImagen = { instruccion?: unknown; diseno?: unknown; alcance?: unknown };

export type ResultadoChatImagen =
  | { ok: true; resumen: string; operaciones: OperacionImagen[]; descartes: string[] }
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
      feature: FEATURE_CHAT_IMAGEN,
      motivo: 'reparar el JSON (chat del Image Editor)',
      erroresOut: errores,
      hastaMs: Math.max(hastaMs, Date.now() + 10_000),
      validar: (t: string) => { try { parseJsonObject(t); return true; } catch { return false; } },
    }).catch(() => '');
  };
}

/** El mensaje de una falla, para la persona. Lo técnico va al log. */
async function falloIA(e: unknown): Promise<string> {
  if (e instanceof SalidaInvalida) {
    console.error(`[image-editor:chat] ${e.message}`);
    console.error(`[image-editor:chat] salida cruda (2000): ${e.crudo.slice(0, 2000)}`);
    return 'MaKo respondió pero no se pudo leer. Vuelve a intentar.';
  }
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[image-editor:chat] ${msg}`);
  return errorDeCascada(/Claude vetado/i.test(msg) ? [] : [msg], 'editar el diseño');
}

/**
 * La edición que pidió la persona, como operaciones del catálogo. `diseno` es la vista que arma `vistaDeDiseno`
 * (./vista.ts), ya en JSON. No escribe nada: quien la pidió la muestra y la persona la acepta.
 */
export async function editarImagen(p: PedidoChatImagen): Promise<ResultadoChatImagen> {
  const t0 = Date.now();
  const instruccion = String(p.instruccion ?? '').trim().slice(0, TOPES_CHAT_IMAGEN.instruccion);
  if (!instruccion) return invalido('Escribe qué quieres cambiar.');
  const diseno = typeof p.diseno === 'string' ? p.diseno : '';
  if (!diseno) return invalido('Falta el diseño.');
  if (diseno.length > TOPES_CHAT_IMAGEN.vistaMax) return invalido('El diseño es muy grande para el chat. Elige unos elementos y pídelo sobre la selección.');
  const alcance = p.alcance === 'seleccion' ? 'los elementos elegidos ("elegidos" en el DISEÑO)' : 'todo el diseño';

  try {
    const user = await renderPrompt(PROMPTS_CHAT_IMAGEN.user.key, CHAT_IMAGEN_USER_TEMPLATE, {
      instruccion: contenidoNoConfiable(instruccion, 'instruccion'),
      alcance,
      diseno: contenidoNoConfiable(diseno, 'diseno'),
    });
    const sys = await brandSystem(await renderPrompt(PROMPTS_CHAT_IMAGEN.system.key, CHAT_IMAGEN_SYSTEM_TEMPLATE, {
      catalogo: catalogoParaPrompt(),
      formato: FORMATO_CHAT_IMAGEN,
    }));
    const hastaIA = t0 + PLAZO_IA_MS;
    const salida = await chatClaude(sys, [{ role: 'user', content: user }], {
      feature: FEATURE_CHAT_IMAGEN,
      motivo: 'Editar el diseño con el chat',
      maxTokens: 4_000,
      hastaMs: hastaIA,
    });
    const raw = await objetoConUnaReparacion(salida, reparador(hastaIA));
    const { operaciones, descartes } = validarOperaciones(raw.operaciones);
    if (descartes.length) console.warn(`[image-editor:chat] descartes: ${descartes.slice(0, 20).join(' · ')}`);
    const resumenModelo = typeof raw.resumen === 'string' ? raw.resumen.trim().split('\n')[0].slice(0, 300) : '';
    return { ok: true, resumen: resumenModelo || (operaciones.length ? 'Listo.' : 'Sin cambios.'), operaciones, descartes };
  } catch (err) {
    return { ok: false, error: await falloIA(err), status: 502 };
  }
}
