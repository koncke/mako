// =============================================================================
// anthropic — cliente de Claude (Messages API) con extended thinking
// =============================================================================
// MaKo = analista. Siempre el modelo más capaz y con el máximo "esfuerzo"
// (extended thinking con budget alto). La key va en ANTHROPIC_API_KEY.

import 'server-only';
import { recordUsage, type UsageInfo } from './anthropic-usage';
import { credWs } from './credenciales';
import type { ProvName } from './ai-cheap';

// Opus 4.8: el modelo más pensante disponible.
const MODEL = 'claude-opus-4-8';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

// Niveles de esfuerzo válidos en Opus 4.8 (output_config.effort).
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
// Esfuerzo por defecto para los análisis de MaKo (alto, sin sobre-pensar).
const DEFAULT_EFFORT: Effort = 'high';

export type ClaudeMsg = { role: 'user' | 'assistant'; content: string };

export async function chatClaude(
  system: string,
  messages: ClaudeMsg[],
  // feature: categoría del gasto (ej. 'ads-rename'). motivo: razón concreta y legible
  // (ej. 'Debate de prioridad') para el historial. onUsage: callback con los
  // tokens/costo de ESTA llamada (para mostrarlo al usuario).
  opts: { model?: string; thinking?: boolean; effort?: Effort; maxTokens?: number; feature?: string; motivo?: string; onUsage?: (u: UsageInfo) => void } = {},
): Promise<string> {
  // Override configurable por feature (tab /modelos-ia). Si el caller NO forzó un
  // modelo y la feature está ruteada a otra IA (Groq/OpenAI/Gemini), delegamos a la
  // capa barata ANTES de exigir la key de Anthropic (un cliente puede tener SOLO
  // Gemini). Si es otro modelo de Claude, lo usamos. Fallback a Claude si la barata
  // falla (no romper una tarea por un override mal puesto).
  let modeloOverride: string | undefined;
  let fallbackNota = ''; // si caímos de la IA barata a Claude, lo dejamos VISIBLE en el historial
  if (!opts.model && opts.feature) {
    try {
      const { modeloDeFeature } = await import('@/lib/model-registry');
      const ref = await modeloDeFeature(opts.feature);
      if (ref && ref.provider !== 'anthropic') {
        // ⚠️ CLAUDE ES EL ÚLTIMO RECURSO, NO EL SEGUNDO.
        //
        // Acá había UN solo intento: si el proveedor del registro fallaba, se caía
        // derecho a Claude Sonnet y se cobraba. El error más común de todos —el que
        // trajo el reclamo— es un **HTTP 429 de Gemini**, o sea la cuota del minuto:
        // el error más transitorio que existe, y el más previsible cuando el Perro
        // corre en tandas. Dos corridas de priorización con 429 costaron US$0.25 con
        // otros CUATRO proveedores gratis configurados y sin usar.
        //
        // Ahora se recorre la cascada barata ENTERA (reintenta el mismo proveedor una
        // vez ante 429/5xx, saltea a los que no les entra el prompt por su techo de
        // entrada, y ordena por cuota disponible). Recién si NINGUNO contesta se paga.
        const { chatCheapCascade, CASCADA_DOCS } = await import('@/lib/ai-cheap');
        const user = messages.map((m) => m.content).join('\n\n');
        // Timeout proporcional al trabajo: una llamada grande (el Perro puntuando TODO
        // el plan, ~8000 tokens de salida) NO entra en 30s en Gemini Flash y abortaba →
        // fallback silencioso a Claude. Escalamos con maxTokens (piso 30s, techo 120s).
        const timeoutMs = Math.min(120000, Math.max(30000, (opts.maxTokens ?? 512) * 12));
        // El ESFUERZO viaja. Sin esto, cualquier feature con effort:'high' ruteada a
        // Gemini corría en 'minimal' y el resultado salía pobre sin ninguna señal:
        // la tab decía "Gemini" y el trabajo se hacía con la mitad del cerebro.
        const esfuerzo = opts.effort === 'max' || opts.effort === 'xhigh' || opts.effort === 'high' ? 'medium'
          : opts.effort === 'medium' ? 'low' : 'minimal';
        // El del registro va PRIMERO y el resto detrás, sin repetir. CASCADA_DOCS es la
        // lista larga (la que incluye Gemini) porque estas llamadas son las grandes.
        const provs = [ref.provider as ProvName, ...CASCADA_DOCS.filter((p) => p !== ref.provider)];
        const errores: string[] = [];
        const salida = await chatCheapCascade({
          system, user, maxTokens: opts.maxTokens, feature: opts.feature, motivo: opts.motivo,
          provs, modelos: { [ref.provider as ProvName]: ref.model }, timeoutMs, esfuerzo, erroresOut: errores,
        });
        if (salida.trim()) return salida;
        // Toda la cascada gratis falló: recién ACÁ se paga, con Sonnet (no Opus) y
        // dejando VISIBLE por qué. Sin esta nota la tab decía "Gemini" y el historial
        // mostraba "Claude" sin explicación (el reclamo original de Martín).
        modeloOverride = 'claude-sonnet-5';
        fallbackNota = ` · ⚠ fallback pago: fallaron los ${provs.length} proveedores gratis (${errores.join(' · ').slice(0, 160) || 'sin respuesta'})`;
        console.warn(`[anthropic] ${opts.feature}: la cascada barata (${provs.join(', ')}) no contestó, pago Claude Sonnet — ${errores.join(' · ')}`);
      } else if (ref) {
        modeloOverride = ref.model;
      }
    } catch { /* sin registro → default */ }
  }

  // La key de Claude sale POR WORKSPACE (BYOK): fila cifrada del cliente > env del
  // dueño. Antes leía process.env directo → un cliente con su key pega no la usaba.
  const key = await credWs('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY no configurada');

  // thinking === false → sin razonamiento extendido (tareas chicas, p.ej. títulos).
  const thinkingOn = opts.thinking ?? true;
  const effort: Effort = thinkingOn ? (opts.effort ?? DEFAULT_EFFORT) : 'low';
  const payload: Record<string, unknown> = {
    model: opts.model ?? modeloOverride ?? MODEL,
    // Con thinking adaptativo el razonamiento entra en max_tokens: damos aire.
    max_tokens: opts.maxTokens ?? (thinkingOn ? 16000 : 512),
    system,
    messages,
    // Opus 4.8: el esfuerzo se controla acá, NO con budget_tokens.
    output_config: { effort },
  };
  // Opus 4.8: thinking ADAPTATIVO (el modelo decide cuánto pensar).
  // El antiguo { type: 'enabled', budget_tokens } ya no existe en este modelo.
  if (thinkingOn) payload.thinking = { type: 'adaptive' };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body?.error?.message ?? `Anthropic ${res.status}`);
  }
  // Registrar tokens/costo de esta llamada (best-effort) y avisar al caller.
  // Si hubo fallback desde la IA barata, el motivo lo dice → el historial no miente.
  const usage = await recordUsage(opts.feature ?? 'otros', String(payload.model), body.usage, (opts.motivo ?? '') + fallbackNota);
  opts.onUsage?.(usage);
  // Corte por tope de salida: el JSON llega mocho, el parse falla y el caller ve cero
  // resultados sin saber por qué. Pasó de verdad (una extracción con out=4500 exacto
  // devolvió 0 tareas y nadie se enteró).
  if (body.stop_reason && body.stop_reason !== 'end_turn' && body.stop_reason !== 'tool_use') {
    console.warn(`[anthropic] ${payload.model} terminó por "${body.stop_reason}" (${opts.feature ?? ''}) — respuesta posiblemente cortada; maxTokens era ${payload.max_tokens}`);
  }
  // Quedarse solo con el texto (descartar los bloques de "thinking").
  const text = (body.content ?? [])
    .filter((c: { type?: string }) => c.type === 'text')
    .map((c: { text?: string }) => c.text ?? '')
    .join('\n')
    .trim();
  return text || '(sin respuesta)';
}

// =============================================================================
// chatClaudeTools — el LOOP de tool-use (MaKo pasa de "sugiere" a "hace")
// =============================================================================
// `chatClaude` es solo-texto: MaKo analiza y responde, pero no puede ACTUAR.
// Esta función corre el ciclo agente de la Messages API: le da a Claude un set
// de herramientas (tools), y cada vez que Claude pide usar una (stop_reason
// 'tool_use'), ejecuta el `runTool` del caller, le devuelve el resultado, y
// vuelve a llamar — hasta que Claude termina (end_turn). Es el cimiento del
// "doer": el MCP bridge (send_whatsapp / meta_ad_write / book_meeting…) se
// enchufa acá como `tools` + un `runTool` que rutea a lib/chatwoot, meta-ads, etc.
//
// Claves de Opus 4.8 (verificadas con la skill claude-api):
//   · tool-use NO necesita beta header (es GA en /v1/messages).
//   · Con thinking adaptativo hay que RE-ENVIAR el content del assistant TAL CUAL
//     (bloques thinking con su firma + tool_use), o la API rechaza el turno.
//   · Todos los tool_result de una tanda van en UN SOLO turno 'user'.
//   · Se hace loop hasta stop_reason 'end_turn' (o se corta por maxSteps).

/** Definición de una herramienta (esquema JSON de entrada). */
export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };

/** Ejecutor de herramientas del caller: nombre + input → resultado (texto) o error. */
export type ToolRunner = (
  name: string,
  input: Record<string, unknown>,
) => Promise<string | { content: string; isError?: boolean }>;

type Block = Record<string, unknown> & { type: string };
export type RichMsg = { role: 'user' | 'assistant'; content: string | Block[] };
export type ToolsResult = { text: string; steps: number; stopReason: string };

export async function chatClaudeTools(
  system: string,
  messages: RichMsg[],
  tools: ToolDef[],
  // runTool: ejecuta la herramienta que pidió Claude. DEBE ser idempotente/segura;
  // acá va el gating (dry-run, permisos, scope por workspace) del "doer".
  runTool: ToolRunner,
  opts: {
    model?: string;
    fallbackModel?: string;         // si el override a IA barata (Gemini/Groq) falla, caé A ESTE (no a Opus).
    sinFallbackClaude?: boolean;    // si el override a IA barata falla, RE-LANZÁ el error (no caigas a Claude): el caller quiere avisar "falló", no gastar Claude en silencio.
    effort?: Effort;
    maxTokens?: number;
    maxSteps?: number;              // tope de vueltas del loop (default 8) — baranda anti-bucle.
    toolChoice?: 'auto' | 'any';    // 'any' = forzá al menos una herramienta.
    feature?: string;
    motivo?: string;
    onUsage?: (u: UsageInfo) => void;                                   // costo de CADA llamada.
    onStep?: (info: { step: number; toolCalls: Array<{ name: string; input: Record<string, unknown> }> }) => void;
  } = {},
): Promise<ToolsResult> {
  // Override configurable por feature (tab /modelos-ia). Si el caller NO forzó un
  // modelo y la feature está ruteada a otra IA (Groq/OpenAI/Gemini), corremos el
  // LOOP de tools por chatCheapTools (function-calling OpenAI-compat) ANTES de
  // exigir la key de Anthropic. Fallback a Claude si la barata falla. Si es otro
  // modelo de Claude, lo usamos (antes chatClaudeTools ignoraba el registro y todo
  // corría en Opus). El doer de WhatsApp pasa `model` explícito (router) → salta
  // esto y sigue en Claude; su ruteo a barato va por su propio camino (DOER_GROQ_TOOLS).
  let model = opts.model ?? MODEL;
  if (!opts.model && opts.feature) {
    try {
      const { modeloDeFeature } = await import('@/lib/model-registry');
      const ref = await modeloDeFeature(opts.feature);
      if (ref && ref.provider !== 'anthropic') {
        try {
          const { chatCheapTools } = await import('@/lib/ai-cheap');
          const r = await chatCheapTools(system, messages, tools, runTool, {
            maxSteps: opts.maxSteps, maxTokens: opts.maxTokens, feature: opts.feature, motivo: opts.motivo, provider: ref.provider, model: ref.model,
          });
          return { text: r.text, steps: r.steps, stopReason: r.stopReason };
        } catch (e) {
          // El caller pidió NO caer a Claude (ej. el doer): re-lanzamos para que avise
          // "falló Gemini" en vez de gastar Claude en silencio.
          if (opts.sinFallbackClaude) throw e;
          // Si no, caemos a Claude pero a SONNET por default (el fallbackModel del router
          // si vino), NUNCA a Opus: un fallo de Gemini no debe disparar el modelo más caro.
          model = opts.fallbackModel ?? 'claude-sonnet-5';
          console.warn(`[anthropic] tools ${opts.feature}→${ref.provider} falló, uso Claude ${model}: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else if (ref) {
        model = ref.model;
      }
    } catch { /* sin registro → default */ }
  }

  // La key de Claude sale POR WORKSPACE (BYOK): fila cifrada del cliente > env del dueño.
  const key = await credWs('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY no configurada');
  const effort: Effort = opts.effort ?? DEFAULT_EFFORT;
  const maxSteps = opts.maxSteps ?? 8;
  const msgs: RichMsg[] = [...messages];

  for (let step = 0; step < maxSteps; step++) {
    const payload: Record<string, unknown> = {
      model,
      max_tokens: opts.maxTokens ?? 16000,
      system,
      messages: msgs,
      output_config: { effort },
      thinking: { type: 'adaptive' },
      tools,
    };
    if (opts.toolChoice) payload.tool_choice = { type: opts.toolChoice };

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(body?.error?.message ?? `Anthropic ${res.status}`);

    const usage = await recordUsage(opts.feature ?? 'tools', String(model), body.usage, opts.motivo);
    opts.onUsage?.(usage);

    const content: Block[] = Array.isArray(body.content) ? (body.content as Block[]) : [];
    const stop = String(body.stop_reason ?? '');

    // Re-enviar el turno del assistant VERBATIM (thinking+firma+tool_use intactos).
    msgs.push({ role: 'assistant', content });

    const toolUses = content.filter((b) => b.type === 'tool_use') as unknown as Array<{ id: string; name: string; input?: Record<string, unknown> }>;

    if (stop === 'tool_use' && toolUses.length) {
      opts.onStep?.({ step, toolCalls: toolUses.map((t) => ({ name: t.name, input: t.input ?? {} })) });
      const results: Block[] = [];
      for (const tu of toolUses) {
        let out: string;
        let isError = false;
        try {
          const r = await runTool(tu.name, tu.input ?? {});
          if (typeof r === 'string') out = r;
          else { out = r.content; isError = Boolean(r.isError); }
        } catch (e) {
          out = e instanceof Error ? e.message : String(e);
          isError = true;
        }
        // Un tool_result por cada tool_use, con su tool_use_id. Todos en un turno.
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: out, ...(isError ? { is_error: true } : {}) });
      }
      msgs.push({ role: 'user', content: results });
      continue;
    }

    // pause_turn: una server-tool pausó (límite de iteraciones) → reenviar para reanudar.
    if (stop === 'pause_turn') continue;

    // Terminal (end_turn / max_tokens / refusal): devolver el texto final.
    const text = content
      .filter((b) => b.type === 'text')
      .map((b) => String((b as { text?: string }).text ?? ''))
      .join('\n')
      .trim();
    return { text: text || '(sin respuesta)', steps: step + 1, stopReason: stop };
  }

  return { text: '(se alcanzó el máximo de pasos de herramientas)', steps: maxSteps, stopReason: 'max_steps' };
}
