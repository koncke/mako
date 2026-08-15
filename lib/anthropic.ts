// =============================================================================
// anthropic — cliente de Claude (Messages API) con extended thinking
// =============================================================================
// MaKo = analista. Siempre el modelo más capaz y con el máximo "esfuerzo"
// (extended thinking con budget alto). La key va en ANTHROPIC_API_KEY.

import 'server-only';
import { recordUsage, type UsageInfo } from './anthropic-usage';
import { credWs } from './credenciales';
import { permisoDeGasto, type PermisoClaude } from './veto-claude';
import type { ProvName } from './ai-cheap';

// ⛔ ACÁ NO HAY NI `MODEL` NI `ENDPOINT`, y ese es el punto entero del veto.
//
// Mientras `MODEL` fue 'claude-opus-4-8', olvidarse de registrar una feature costaba el
// modelo MÁS CARO — y el camino a ese olvido se leía perfecto en el diff. Ahora no hay
// default: si no se puede resolver el modelo, la salida honesta es FALLAR, no elegir. Y la
// URL sale de `permiso.endpoint`, así que no queda ningún string suelto al que se le pueda
// pegar un `fetch` por accidente. El porqué entero está en lib/veto-claude.ts.

// Niveles de esfuerzo válidos en Opus 4.8 (output_config.effort).
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
// Esfuerzo por defecto para los análisis de MaKo (alto, sin sobre-pensar).
const DEFAULT_EFFORT: Effort = 'high';

export type ClaudeMsg = { role: 'user' | 'assistant'; content: string };

/**
 * EL INTERRUPTOR DE PÁNICO. Apaga TODO, incluido lo que está en la lista blanca, sin
 * deploy. Va en UNA sola dirección a propósito: puede apagar, nunca encender.
 *
 * Si la fila no existe, si el valor está roto o si Supabase se cae, el resultado es «no
 * pausado» — y eso NO abre nada, porque lo que autoriza es la lista de CÓDIGO. Un store
 * que puede fallar solo tiene permitido hacer las cosas MÁS restrictivas, nunca menos.
 */
async function claudePausado(): Promise<boolean> {
  try {
    const { getSetting } = await import('@/lib/settings');
    const { runWithWorkspace, OWNER_WS } = await import('@/lib/workspace');
    return (await runWithWorkspace(OWNER_WS, () => getSetting('mako.claude.pausa'))) === '1';
  } catch { return false; }
}

/**
 * EL BLOQUEO SE REGISTRA, NO SE LOGUEA. «Un console.warn no es un control» (AGENTS.md, y
 * está medido). Esta fila cuesta US$0, tiene 0 tokens y aparece en el MISMO gráfico que el
 * dueño mira, con el motivo escrito. Sin esto, un veto que funciona y un veto que nadie
 * disparó se ven exactamente iguales.
 */
async function registrarBloqueo(e: unknown, feature: string | undefined, model: string): Promise<void> {
  const razon = e instanceof Error ? e.message : String(e);
  console.error(`[veto-claude] ${razon}`);
  await recordUsage(feature?.trim() || 'sin-feature', `vetado:${model || '-'}`, {}, razon).catch(() => {});
}

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
  // El motivo por el que esta feature NO puede seguir. Se guarda en vez de lanzarse
  // adentro del try, porque ese catch existe para «no hay registro → usá el default» y
  // se comería el corte: la llamada terminaría en Opus, que es peor que Sonnet.
  let noSePuedeSeguir = '';
  if (!opts.model && opts.feature) {
    try {
      const { modeloDeFeature, fallbackDeFeature } = await import('@/lib/model-registry');
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
        //
        // ⚠️ SALVO QUE LA FEATURE DIGA QUE NO SE DEGRADA. Un fallback que no cobra no
        // dispara ninguna alarma y por eso nadie lo mira: el 12/8/2026 la MISMA reunión,
        // leída por dos workspaces con 65 segundos de diferencia, corrió en gemini-flash
        // en uno y en mistral-small en el otro —el 429 de la cuota compartida— y salió
        // 74% de precisión contra 46%, con 2 invenciones contra 12. La tab decía
        // «Gemini» y decía la verdad sobre la config. Con `fallback: []` la cascada se
        // queda en UN solo proveedor y, si no contesta, la llamada FALLA: no se degrada
        // ni se paga — un 429 se espera, no se compra. El detalle en lib/model-catalogo.ts.
        const permitidos = await fallbackDeFeature(opts.feature);
        const resto = (permitidos ?? CASCADA_DOCS) as ProvName[];
        const provs = [ref.provider as ProvName, ...resto.filter((p) => p !== ref.provider)];
        const errores: string[] = [];
        const salida = await chatCheapCascade({
          system, user, maxTokens: opts.maxTokens, feature: opts.feature, motivo: opts.motivo,
          provs, modelos: { [ref.provider as ProvName]: ref.model }, timeoutMs, esfuerzo, erroresOut: errores,
        });
        if (salida.trim()) return salida;
        // ⛔ `fallback: []` SIGNIFICA «NO DEGRADES», NO «PAGÁ CLAUDE».
        //
        // La primera versión de esto caía a Sonnet y estaba mal por donde se la mire.
        // El error que dispara la cascada es casi siempre un 429 —la cuota del minuto,
        // el error más transitorio que existe— y la respuesta correcta a un 429 no es
        // cambiar de modelo NI abrir la billetera: es esperar. Corrido en el momento
        // equivocado, «no degrades» se convirtió en una tanda de llamadas pagas que
        // encima fallaron por saldo. El dueño, textual: «No utilices Claude, eso ya lo
        // habíamos hablado». Tiene razón y es la regla de la casa desde hace rato.
        //
        // Ahora falla, y fallar acá es BARATO porque el camino de reintento ya existe:
        // la parte se marca como no leída (`partesFallidas`), el borrador no se cachea,
        // la reunión NO se cierra y el próximo cron la lee de nuevo — con la cuota
        // repuesta. Cero degradación, cero pesos, y el trabajo se hace igual, más tarde.
        if (permitidos && permitidos.length === 0) {
          noSePuedeSeguir = `${opts.feature}: ${ref.provider} no contestó y esta feature no se degrada ni se paga (${errores.join(' · ').slice(0, 200) || 'sin respuesta'}). Se reintenta en la próxima corrida.`;
          console.warn(`[anthropic] ${noSePuedeSeguir}`);
        } else {
          // Para el resto: toda la cascada gratis falló y recién ACÁ se paga, con Sonnet
          // (no Opus) y dejando VISIBLE por qué. Sin esta nota la tab decía "Gemini" y el
          // historial mostraba "Claude" sin explicación (el reclamo original de Martín).
          modeloOverride = 'claude-sonnet-5';
          fallbackNota = ` · ⚠ fallback pago: fallaron los ${provs.length} proveedores gratis (${errores.join(' · ').slice(0, 160) || 'sin respuesta'})`;
          console.warn(`[anthropic] ${opts.feature}: la cascada barata (${provs.join(', ')}) no contestó, pago Claude Sonnet — ${errores.join(' · ')}`);
        }
      } else if (ref) {
        modeloOverride = ref.model;
      }
    } catch { /* sin registro → default */ }
  }
  // Acá afuera del catch, para que el corte no se lo coma el «usá el default».
  if (noSePuedeSeguir) throw new Error(noSePuedeSeguir);

  // ── EL VETO ──────────────────────────────────────────────────────────────────────
  // Todo lo de arriba fue ELEGIR un modelo. Acá se decide si se puede COMPRAR, y es el
  // único punto por el que pasan las cinco puertas a Anthropic.
  const modeloPedido = opts.model ?? modeloOverride ?? '';
  let permiso: PermisoClaude;
  try {
    permiso = permisoDeGasto({ feature: opts.feature, model: modeloPedido, pausa: await claudePausado() });
  } catch (e) {
    await registrarBloqueo(e, opts.feature, modeloPedido);
    throw e;
  }

  // La key de Claude sale POR WORKSPACE (BYOK): fila cifrada del cliente > env del
  // dueño. Antes leía process.env directo → un cliente con su key pega no la usaba.
  const key = await credWs('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY no configurada');

  // thinking === false → sin razonamiento extendido (tareas chicas, p.ej. títulos).
  const thinkingOn = opts.thinking ?? true;
  const effort: Effort = thinkingOn ? (opts.effort ?? DEFAULT_EFFORT) : 'low';
  const payload: Record<string, unknown> = {
    model: permiso.model,
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

  const res = await fetch(permiso.endpoint, {
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
  const usage = await recordUsage(permiso.feature, String(payload.model), body.usage, (opts.motivo ?? '') + fallbackNota);
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
  let model = opts.model ?? '';   // sin default: el `?? MODEL` era la quinta puerta
  if (!opts.model && opts.feature) {
    try {
      const { modeloDeFeature } = await import('@/lib/model-registry');
      const ref = await modeloDeFeature(opts.feature);
      if (ref && ref.provider !== 'anthropic') {
        // ⚠️ ACÁ TAMBIÉN CLAUDE ES EL ÚLTIMO RECURSO. Este camino probaba UN proveedor
        // y ante cualquier fallo se iba a Claude Sonnet — el mismo agujero que
        // `chatClaude` ya tenía cerrado, vivo en la mitad con herramientas, y con el
        // error más previsible de todos (el 429 de Gemini). Ahora se recorre la cascada
        // de tools entera (todas las cuentas de cada proveedor gratis) y recién si
        // NINGUNA contesta se paga. La cascada se corta sola si un proveedor ya ejecutó
        // una herramienta: reintentar después de una escritura la duplicaría.
        const errores: string[] = [];
        try {
          const { chatCheapToolsCascade, CASCADA_TOOLS } = await import('@/lib/ai-cheap');
          const provs = [ref.provider as ProvName, ...CASCADA_TOOLS.filter((p) => p !== ref.provider)];
          const r = await chatCheapToolsCascade(system, messages, tools, runTool, {
            maxSteps: opts.maxSteps, maxTokens: opts.maxTokens, feature: opts.feature, motivo: opts.motivo,
            provs, modelos: { [ref.provider as ProvName]: ref.model }, erroresOut: errores,
          });
          if (r) return { text: r.text, steps: r.steps, stopReason: r.stopReason };
          if (opts.sinFallbackClaude) throw new Error(`falló la IA (${errores.join(' · ').slice(0, 200) || 'sin proveedor gratis disponible'})`);
        } catch (e) {
          // El caller pidió NO caer a Claude (ej. el doer): re-lanzamos para que avise
          // "falló Gemini" en vez de gastar Claude en silencio.
          if (opts.sinFallbackClaude) throw e;
          errores.push(e instanceof Error ? e.message : String(e));
        }
        // Toda la cascada gratis falló: recién ACÁ se paga, con SONNET por default (el
        // fallbackModel del router si vino), NUNCA Opus.
        model = opts.fallbackModel ?? 'claude-sonnet-5';
        console.warn(`[anthropic] tools ${opts.feature}: la cascada gratis no contestó, pago Claude ${model} — ${errores.join(' · ')}`);
      } else if (ref) {
        model = ref.model;
      }
    } catch { /* sin registro → el veto corta abajo; ya no hay «usá el default» */ }
  }

  // ── EL VETO, la MISMA puerta que chatClaude ──────────────────────────────────────
  // Este camino nunca consultó `fallbackDeFeature`, así que ni siquiera `fallback: []` lo
  // frenaba: era la tercera de las cinco puertas. Ahora no hace falta que lo consulte —
  // la puerta es una sola y está acá. Se evalúa UNA vez, antes del loop: dentro del loop
  // sería el mismo permiso N veces y N filas de bloqueo.
  let permiso: PermisoClaude;
  try {
    permiso = permisoDeGasto({ feature: opts.feature, model, pausa: await claudePausado() });
  } catch (e) {
    await registrarBloqueo(e, opts.feature, model);
    throw e;
  }
  model = permiso.model;

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

    const res = await fetch(permiso.endpoint, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(body?.error?.message ?? `Anthropic ${res.status}`);

    const usage = await recordUsage(permiso.feature, String(model), body.usage, opts.motivo);
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
