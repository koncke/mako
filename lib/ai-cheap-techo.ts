// =============================================================================
// ai-cheap-techo — cuánta SALIDA se le puede pedir a cada modelo de OpenAI (revisión adversarial de IA15, 22/10/2026)
// =============================================================================
// Pedir más de lo que acepta el modelo es un 400 («max_tokens is too large»). Con su OpenAI, el Plan del negocio (IA15)
// pedía 32.000 a `gpt-4o-mini`, que acepta 16.384, y fallaba SIEMPRE en las llamadas grandes (leer una reunión,
// re-priorizar), anotado como fallo de SU clave. Un modelo que no está en la tabla va con el más chico: anda, aunque corte
// antes. Los demás proveedores manejan su tope solos.
//
// Pura (sin `server-only`): la prueba la importa. La usa lib/ai-cheap.ts en los tres pedidos de la capa barata, y
// lib/anthropic-usage.ts para contar la salida que se cobró (`tokensDeSalida`).
// =============================================================================

export const TECHO_SALIDA_OPENAI: Readonly<Record<string, number>> = {
  'gpt-4o-mini': 16_384, 'gpt-4o': 16_384, 'gpt-4.1': 32_768, 'gpt-4.1-mini': 32_768, 'gpt-4.1-nano': 32_768,
};

export const conTechoDeSalida = (p: { nombre: string }, model: string, pedido: number): number =>
  p.nombre === 'openai' ? Math.min(pedido, TECHO_SALIDA_OPENAI[model] ?? 16_384) : pedido;

// -----------------------------------------------------------------------------
// Los modelos de OpenAI CON RAZONAMIENTO no aceptan los campos de salida de siempre (23/10/2026, «Tu ChatGPT» con modelo)
// -----------------------------------------------------------------------------
// La capa barata manda `max_tokens` y `temperature: 0.2`. Con `gpt-4o-mini` anda, y por eso nunca se vio: era el ÚNICO modelo
// de OpenAI que corría. Los de la familia o1/o3/GPT-5 en adelante contestan 400 a los dos («Unsupported parameter: 'max_tokens'
// … use 'max_completion_tokens'» y «temperature does not support 0.2»): la referencia de Chat Completions marca `max_tokens`
// como incompatible con ellos, y el foro de OpenAI lo reporta para GPT-5. O sea que darle a «Tu ChatGPT» un modelo capaz
// cambiando sólo el NOMBRE rompía cada turno, con un error que se lee como «se cayó tu clave».
// ⚠️ NO MEDIDO contra GPT-5.6 Luna ni GPT-6: la cuenta de OpenAI de MaKo (ws9) contesta «sin crédito» ANTES de mirar los
// parámetros (medido: los 12 pedidos de prueba, 429 `credit_balance_exhausted`). Lo confirma la prueba de punta a punta.
// Y el razonamiento sale del MISMO tope: con 1.400 tokens, el modelo puede gastarlos pensando y contestar vacío
// (`finish_reason: length`), así que se le suma aire. No se manda `reasoning_effort`: cada familia acepta valores distintos
// y un valor que deja de valer es un 400 (el caso de Gemini con 'minimal', lib/gemini-esfuerzo.ts).

/** ¿Un modelo de OpenAI con razonamiento? o1/o3/o4 y GPT-5 en adelante; los «-chat» no razonan. */
export const esRazonadorOpenAI = (model: string): boolean =>
  /^(o\d|gpt-([5-9]|\d{2}))/.test(model) && !/-chat/.test(model);

/** Lo que se le suma al tope de un modelo con razonamiento para que pensar no se coma la respuesta. */
export const AIRE_RAZONAMIENTO = 4_000;

/**
 * ⚠️ Y SI EL SUPUESTO ESTÁ MAL, SE APRENDE DEL 400 (revisión del 23/10/2026): como no se pudo medir, un modelo puede
 * rechazar el formato que le eligió `esRazonadorOpenAI`. Entonces `chatCheapTools` repite el pedido UNA vez con el OTRO
 * formato y lo recuerda POR MODELO y en este proceso (el molde de lib/gemini-esfuerzo.ts). Si el otro también falla, no se
 * da vuelta de nuevo: el error sube tal cual, con su ticket.
 */
const FORMATO_APRENDIDO = new Map<string, 'razonador' | 'clasico'>();

/** El formato de salida que se le manda a un modelo de OpenAI: el aprendido de un 400, o el que dice su nombre. */
export const formatoDeSalida = (model: string): 'razonador' | 'clasico' =>
  FORMATO_APRENDIDO.get(model) ?? (esRazonadorOpenAI(model) ? 'razonador' : 'clasico');

/** Un 400 que dice que un CAMPO DE SALIDA no se acepta: aprende el otro formato para ese modelo. true = hay que repetir. */
export function aprenderFormatoSiLoRechaza(model: string, mensaje: string): boolean {
  if (FORMATO_APRENDIDO.has(model)) return false;
  if (!/\b(max_tokens|max_completion_tokens|temperature)\b/.test(mensaje)) return false;
  if (!/unsupported|not supported|does not support|only the default/i.test(mensaje)) return false;
  FORMATO_APRENDIDO.set(model, formatoDeSalida(model) === 'razonador' ? 'clasico' : 'razonador');
  return true;
}

/** Para los tests: un proceso nuevo arranca sin nada aprendido. */
export const olvidarFormatos = (): void => FORMATO_APRENDIDO.clear();

/** Los campos de SALIDA de un pedido de la capa barata: el tope (con su nombre) y la temperatura, sólo donde se acepta. */
export function paramsDeSalida(p: { nombre: string }, model: string, pedido: number, temperatura: number):
  { max_tokens: number; temperature: number } | { max_completion_tokens: number } {
  if (p.nombre === 'openai' && formatoDeSalida(model) === 'razonador') {
    return { max_completion_tokens: conTechoDeSalida(p, model, pedido + AIRE_RAZONAMIENTO) };
  }
  return { max_tokens: conTechoDeSalida(p, model, pedido), temperature: temperatura };
}

/**
 * Cuántos tokens de SALIDA se cobraron, según la forma del `usage` (revisión del 23/10/2026). `recordUsage` sumaba
 * `completion_tokens_details.reasoning_tokens` a `completion_tokens`, pensado para Gemini, que cobra lo que piensa APARTE
 * de `completion_tokens` (sólo lo trae `total_tokens`). En OpenAI es al revés: lo pensado ya está ADENTRO de
 * `completion_tokens` (total = prompt + completion), así que con un modelo que razona se contaba dos veces, en cada paso.
 * Con `total_tokens` manda la resta (vale para los dos); sin él (Anthropic), lo visible más lo pensado.
 */
export function tokensDeSalida(u: Record<string, unknown>): number {
  const input = Number(u.input_tokens ?? u.prompt_tokens ?? 0) || 0;
  const visible = Number(u.output_tokens ?? u.completion_tokens ?? 0) || 0;
  const total = Number(u.total_tokens ?? 0) || 0;
  const pensado = Number((u.completion_tokens_details as Record<string, unknown> | undefined)?.reasoning_tokens ?? 0) || 0;
  return total > input ? Math.max(visible, total - input) : visible + pensado;
}
