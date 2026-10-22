// =============================================================================
// anthropic — cliente de Claude (Messages API) con extended thinking
// =============================================================================
// MaKo = analista. Siempre el modelo más capaz y con el máximo "esfuerzo"
// (extended thinking con budget alto). La key va en ANTHROPIC_API_KEY.

import 'server-only';
import { recordUsage, type UsageInfo } from './anthropic-usage';
import { credWs, credDelCliente, credWsEstricta, wsDelEntorno } from './credenciales';
import {
  permisoDeGasto, evaluarClaveDelNegocio, MOTIVO_CLAVE_DEL_NEGOCIO,
  evaluarCreditoDeLaPlataforma, CLAVES_CREDITO_PLATAFORMA, CREDITO_HABILITADO_PARA, MOTIVO_CREDITO_PLATAFORMA, type PermisoClaude,
  type PermisoClaveDelNegocio, CLAVE_MODELO_SU_CLAUDE, modeloDeSuClaude,
} from './veto-claude';
import type { ProvName } from './ai-cheap';
import { conD6bDelPedido, d6bDecidida, soloSuIA } from './solo-su-ia';

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
/** Lo que se le dice al negocio cuando su Claude está conectado y la plataforma lo tiene en pausa. */
export const CLAUDE_EN_PAUSA = 'Tu Claude está conectado, pero MaKo lo tiene en pausa por un rato: no lo estoy usando. Vuelve a intentar más tarde.';

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

/**
 * LA CLAVE DE ANTHROPIC DEL NEGOCIO, como primer intento de la cascada de texto
 * (`chatCheapCascade`). Decisión de Martín del 15/10/2026: el crédito de API de Claude Max
 * del cliente entra por su clave propia (lib/veto-claude.ts, «la segunda puerta»).
 *
 * Devuelve `null` cuando no corresponde (lo normal: el negocio no cargó su clave), y
 * `{ error }` cuando la clave es suya y Anthropic dijo que no: ése sí va a la lista con la
 * que se le habla al cliente, porque es SU clave.
 *
 * ⚠️ LAS TRES LECTURAS SON A PROPÓSITO, Y NINGUNA ES `credWs`:
 *   · la del negocio es `credDelCliente` —sólo su fila—: `credWs` cae al env de la
 *     plataforma cuando el workspace es el del dueño, y esa clave se haría pasar por suya;
 *   · las de la plataforma son ESTRICTAS: si la base no contesta, tiran, y esta función
 *     devuelve null. Un «no pude leer» tratado como «no hay clave de la plataforma» haría
 *     pasar cualquier copia;
 *   · el `fetch` usa `permiso.clave`, la que el veto verificó, y no vuelve a resolver nada.
 *
 * El permiso (la frontera) es UNA pieza para los dos caminos que la usan: la cascada de texto y, desde el 20/10/2026, el
 * turno con herramientas del chat (`chatClaudeTools`): un negocio que conectó SÓLO su Claude no tenía ninguna IA para el
 * chat, y «Conectar tu IA» le pedía Gemini (docs/investigacion-ops-center-19-10.md).
 */
export async function permisoDeLaClaveDelNegocio(feature?: string): Promise<{ permiso: PermisoClaveDelNegocio } | { pausa: true } | null> {
  const clave = await credDelCliente('ANTHROPIC_API_KEY').catch(() => null);
  if (!clave) return null;
  let clavesPlataforma: Array<string | null | undefined>;
  try {
    const { wsSuperAdmin } = await import('@/lib/workspace');
    clavesPlataforma = [
      process.env.ANTHROPIC_API_KEY,
      // La fila de la que sale el ENTORNO de esta clave (`wsDelEntorno`). Hasta el 18/10 era la del ws1 (`OWNER_WS`), y
      // así la clave propia que pegara Mauricio se leía como la de la plataforma y nunca contaba como suya.
      await credWsEstricta('ANTHROPIC_API_KEY', await wsDelEntorno('ANTHROPIC_API_KEY')),
      await credWsEstricta('ANTHROPIC_API_KEY', await wsSuperAdmin()),
    ];
  } catch { return null; }
  const pausa = await claudePausado();
  // IA5 (22/10/2026): el modelo que eligió el negocio para SU Claude, y las claves del crédito de Max de la plataforma: una
  // de ésas puesta como clave de un negocio (el ws10) va con el barato, elija lo que elija (lo paga Martín). Sin poder
  // leerlas, `null`: también el barato.
  let modelo: string;
  try {
    const { getSetting } = await import('@/lib/settings');
    modelo = modeloDeSuClaude(await getSetting(CLAVE_MODELO_SU_CLAUDE));
  } catch { modelo = modeloDeSuClaude(null); }
  let creditosPlataforma: Array<string | null> | null;
  try {
    const { wsSuperAdmin } = await import('@/lib/workspace');
    const wsSA = await wsSuperAdmin();
    creditosPlataforma = [];
    for (const nombre of CLAVES_CREDITO_PLATAFORMA) creditosPlataforma.push(process.env[nombre]?.trim() || (await credWsEstricta(nombre, wsSA)));
  } catch { creditosPlataforma = null; }
  const v = evaluarClaveDelNegocio({ feature, clave, clavesPlataforma, pausa, model: modelo, creditosPlataforma });
  if (!v.ok) return pausa ? { pausa: true } : null;
  return { permiso: v.permiso };
}

/** La clave del negocio en la cascada de TEXTO: su primer intento (arriba, `permisoDeLaClaveDelNegocio`, la frontera). */
export async function conClaveDelNegocio(p: {
  system: string; user: string; json?: boolean; maxTokens?: number; feature?: string; motivo?: string; timeoutMs: number;
  /** Lo que MIRA (IA6): imágenes y PDF como bloques de Claude, antes del texto. Las fotos de un negocio con su IA las lee su
   *  Claude o su OpenAI, nunca Gemini (lib/ai-cheap.ts → `leerDocumentoIA`). */
  bloques?: Array<Record<string, unknown>>;
}): Promise<{ texto: string; model?: string } | { error: string } | null> {
  const r = await permisoDeLaClaveDelNegocio(p.feature);
  if (!r) return null;
  // ⚠️ LA PAUSA SE DICE (17/10/2026, docs/hallazgos-graficos.md): con `null`, el negocio que conectó SU Claude quedaba sin
  // ningún error suyo y la caja le decía «Conecta tu Claude en Integraciones» (`avisoSinIA`), que ya está conectado. La
  // pausa es de la plataforma, pero la clave que no se usó es la SUYA: va a su lista, con lo que pasa de verdad.
  if ('pausa' in r) return { error: CLAUDE_EN_PAUSA };
  const permiso = r.permiso;

  // Claude no tiene modo JSON: se le pide en el system, y la cascada verifica que parsee.
  const system = p.json ? `${p.system}\n\nResponde SOLO con el JSON pedido, sin texto antes ni después y sin bloques de código.` : p.system;
  try {
    const res = await fetch(permiso.endpoint, {
      method: 'POST',
      headers: { 'x-api-key': permiso.clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: permiso.model, max_tokens: p.maxTokens ?? 1024, system, messages: [{ role: 'user', content: p.bloques?.length ? [...p.bloques, { type: 'text', text: p.user }] : p.user }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(Math.max(1_000, p.timeoutMs)),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.error) {
      const error = String(body?.error?.message ?? `Anthropic ${res.status}`);
      // ⚠️ EL FALLO DE SU CLAVE QUEDA ESCRITO (IA3, 22/10/2026). Antes se devolvía sin anotar y la cascada seguía con
      // Gemini: en toda la historia hubo 0 filas con la marca del negocio, y una clave sin crédito se veía igual que «nunca
      // se usó». El status va adelante: el motivo corto lo lee de ahí (lib/su-clave-reglas.ts).
      await (await import('./su-clave')).anotarFalloDeSuClave({ proveedor: 'anthropic', error: `HTTP ${res.status} ${body?.error?.type ?? ''} ${error}`, feature: permiso.feature, modelo: permiso.model });
      return { error };
    }
    // Lo paga el negocio: la marca va PRIMERO en el motivo, y lib/costos-ia.ts la saca del gasto de MaKo.
    await recordUsage(permiso.feature, permiso.model, body.usage, [MOTIVO_CLAVE_DEL_NEGOCIO, (p.motivo ?? '').trim()].filter(Boolean).join(' · ')).catch(() => {});
    const texto = (body.content ?? [])
      .filter((c: { type?: string }) => c.type === 'text')
      .map((c: { text?: string }) => c.text ?? '')
      .join('\n')
      .trim();
    return texto ? { texto, model: permiso.model } : { error: 'Claude contestó vacío' };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await (await import('./su-clave')).anotarFalloDeSuClave({ proveedor: 'anthropic', error, feature: permiso.feature, modelo: permiso.model });
    return { error };
  }
}

/**
 * Las cuentas del crédito que contestaron «Your credit balance is too low», y hasta cuándo no se
 * les vuelve a pedir. En `globalThis` y no en una variable de módulo, por lo mismo que las otras
 * memorias de este repo (las instancias de Vercel recargan módulos). Cada instancia lo descubre
 * con UN pedido rechazado (~200 ms), y queda una fila en `anthropic_usage`: alcanza para no
 * golpear una cuenta vacía en cada llamada sin agregar otra lectura a la base en cada una.
 */
const SIN_CREDITO_MS = 6 * 60 * 60 * 1000;
const g = globalThis as unknown as { __creditoAgotado?: Map<number, number> };
const creditoAgotado = (g.__creditoAgotado ??= new Map<number, number>());

/**
 * EL CRÉDITO DE API DE LOS PLANES MAX DE MARTÍN (lib/veto-claude.ts, «la tercera puerta»), para la
 * cascada de texto de un cliente cuyas keys no contestaron (o que no tiene). Va ANTES de las keys
 * gratis de la agencia en la red de plataforma (`chatCheapCascade`).
 *
 * Devuelve `null` si no corresponde (no hay claves del crédito cargadas, o el veto dice que no) y
 * `{ error }` si se probó y nadie contestó. Sus errores son de la PLATAFORMA: el que llama los manda
 * a `erroresPlataformaOut`, nunca a la lista con la que se le habla al cliente.
 *
 * ⚠️ Las claves se leen SÓLO por los nombres de `CLAVES_CREDITO_PLATAFORMA`: del entorno, o de la
 * fila del workspace de la plataforma, estricta (si la base no contesta, no se usa el crédito).
 * `ANTHROPIC_API_KEY` no se lee acá, y el fetch usa la clave que verificó el veto.
 */
export async function conCreditoDeLaPlataforma(p: {
  system: string; user: string; json?: boolean; maxTokens?: number; feature?: string; motivo?: string; timeoutMs: number;
  /** El workspace del CLIENTE que lo usa: la fila de uso va ahí, nunca al ws1. */
  wsCliente: number;
}): Promise<{ texto: string } | { error: string } | null> {
  // PARA QUÉ, antes de leer nada: lo que Martín no habilitó no gasta ni una lectura (la lista y el porqué,
  // en `CREDITO_HABILITADO_PARA`). Lo que se habilitó «sólo durante el onboarding» pregunta lo MISMO que el
  // wizard (`onboardingPendiente`): si no se sabe, no.
  const habilitado = CREDITO_HABILITADO_PARA.find((h) => h.feature === (p.feature ?? '').trim());
  if (!habilitado) return null;
  let onboardingEnCurso = false;
  if (habilitado.soloDuranteElOnboarding) {
    try {
      const { onboardingPendiente } = await import('@/lib/onboarding-state');
      onboardingEnCurso = await onboardingPendiente();
    } catch { return null; }
    if (!onboardingEnCurso) return null;
  }
  let creditos: Array<string | null>;
  try {
    const { wsSuperAdmin } = await import('@/lib/workspace');
    const wsSA = await wsSuperAdmin();
    creditos = [];
    for (const nombre of CLAVES_CREDITO_PLATAFORMA) {
      const env = process.env[nombre]?.trim();
      creditos.push(env || (await credWsEstricta(nombre, wsSA)));
    }
  } catch { return null; }
  if (!creditos.some(Boolean)) return null;
  const pausa = await claudePausado();
  const system = p.json ? `${p.system}\n\nResponde SOLO con el JSON pedido, sin texto antes ni después y sin bloques de código.` : p.system;
  const errores: string[] = [];
  for (const clave of creditos) {
    if (!clave) continue;
    const v = evaluarCreditoDeLaPlataforma({ feature: p.feature, clave, creditos, pausa, onboardingEnCurso });
    if (!v.ok) return null;
    const permiso = v.permiso;
    if ((creditoAgotado.get(permiso.cuenta) ?? 0) > Date.now()) continue;
    try {
      const res = await fetch(permiso.endpoint, {
        method: 'POST',
        headers: { 'x-api-key': permiso.clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: permiso.model, max_tokens: p.maxTokens ?? 1024, system, messages: [{ role: 'user', content: p.user }] }),
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.max(1_000, p.timeoutMs)),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.error) {
        const m = String(body?.error?.message ?? `Anthropic ${res.status}`);
        if (/credit balance is too low/i.test(m)) {
          // Sin crédito hasta el próximo ciclo: se saltea un rato y queda la línea, con 0 tokens.
          creditoAgotado.set(permiso.cuenta, Date.now() + SIN_CREDITO_MS);
          await recordUsage(permiso.feature, permiso.model, {}, `${MOTIVO_CREDITO_PLATAFORMA} (cuenta ${permiso.cuenta}) · sin crédito hasta el próximo ciclo`, 'anthropic', permiso.cuenta, p.wsCliente).catch(() => {});
        }
        errores.push(`crédito cuenta ${permiso.cuenta}: ${m}`);
        continue;
      }
      await recordUsage(permiso.feature, permiso.model, body.usage, [`${MOTIVO_CREDITO_PLATAFORMA} (cuenta ${permiso.cuenta})`, (p.motivo ?? '').trim()].filter(Boolean).join(' · '), 'anthropic', permiso.cuenta, p.wsCliente).catch(() => {});
      const texto = (body.content ?? [])
        .filter((c: { type?: string }) => c.type === 'text')
        .map((c: { text?: string }) => c.text ?? '')
        .join('\n')
        .trim();
      if (texto) return { texto };
      errores.push(`crédito cuenta ${permiso.cuenta}: contestó vacío`);
    } catch (e) {
      errores.push(`crédito cuenta ${permiso.cuenta}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return errores.length ? { error: errores.join(' · ') } : null;
}

export async function chatClaude(
  system: string,
  messages: ClaudeMsg[],
  // feature: categoría del gasto (ej. 'ads-rename'). motivo: razón concreta y legible
  // (ej. 'Debate de prioridad') para el historial. onUsage: callback con los
  // tokens/costo de ESTA llamada (para mostrarlo al usuario).
  //
  // ⏱ hastaMs: fecha ABSOLUTA (epoch ms) en la que la llamada ENTERA tiene que haber
  // terminado —la cascada barata con sus reintentos, o el pedido a Claude—. Es para quien
  // corre con un reloj ajeno (un cron con maxDuration): sin esto, `maxTokens × 12` acota UN
  // intento y la cascada puede encadenar varios. Si el plazo no alcanza, FALLA: nunca paga
  // Claude para ganar tiempo. Sin hastaMs no cambia nada.
  // sinRespaldoDeModelo: la cascada no cae al modelo de respaldo del proveedor
  // (flash-lite). Para las features que no se degradan de MODELO, no sólo de proveedor.
  //
  // redDePlataforma / erroresOut / erroresPlataformaOut: los mismos de `chatCheapCascade`, y
  // viajan TAL CUAL. ⚠️ ACÁ NO VIAJABAN, y eso es el Diagnóstico de una landing que no andaba
  // (15/10/2026, ws1): la cascada barata corría sin red de plataforma —el cliente tenía todas
  // sus keys rebotando y la Gemini de la agencia contestaba 200— y sus errores se quedaban en
  // esta función: lo único que salía era «Claude vetado», y la pantalla decía «Tu IA está
  // conectada pero no pudo…» sin una sola pista. `erroresOut` recibe los de las keys del
  // NEGOCIO (son los que eligen el texto); los de la red van aparte (lib/ai-cheap.ts).
  //
  // validar: el mismo de `chatCheapCascade`. Una salida que no lo pasa (un JSON cortado) NO se
  // devuelve: la cascada prueba con la cuenta o el proveedor siguiente. Sin esto, el JSON roto de
  // un modelo flojo llegaba crudo a la pantalla como «Unexpected end of JSON input».
  opts: { model?: string; thinking?: boolean; effort?: Effort; maxTokens?: number; feature?: string; motivo?: string; onUsage?: (u: UsageInfo) => void; hastaMs?: number; sinRespaldoDeModelo?: boolean; redDePlataforma?: boolean; erroresOut?: string[]; erroresPlataformaOut?: string[]; validar?: (t: string) => boolean } = {},
): Promise<string> {
  // D6b decidido por el negocio en curso (IA6, lib/solo-su-ia.ts → `conD6bDelPedido`), si nadie lo decidió antes.
  if (!d6bDecidida()) return conD6bDelPedido(opts.feature, () => chatClaude(system, messages, opts));
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
          hastaMs: opts.hastaMs, sinRespaldoDeModelo: opts.sinRespaldoDeModelo,
          redDePlataforma: opts.redDePlataforma, erroresPlataformaOut: opts.erroresPlataformaOut,
          validar: opts.validar,
        });
        if (salida.trim()) return salida;
        // Lo que contestó cada key del negocio, para que el caller diga la causa (errorDeCascada).
        opts.erroresOut?.push(...errores);
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
        } else if (opts.hastaMs !== undefined && opts.hastaMs - Date.now() < 15_000) {
          // ⏱ Se acabó el plazo del caller: se falla también en las features que SÍ pueden
          // pagar. Un pedido a Claude con el reloj vencido no termina a tiempo, y cobrar
          // una respuesta que nadie va a esperar es lo peor de los dos mundos.
          noSePuedeSeguir = `${opts.feature}: ${ref.provider} no contestó antes del plazo (${errores.join(' · ').slice(0, 200) || 'sin respuesta'}). Se reintenta en la próxima corrida.`;
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

  // ⏱ El plazo del caller vale también acá: sin él, este pedido no tiene timeout ninguno.
  // Y con el reloj vencido no se arranca, por lo mismo que en la cascada.
  if (opts.hastaMs !== undefined && opts.hastaMs - Date.now() < 15_000) {
    throw new Error(`${opts.feature ?? 'chatClaude'}: no queda plazo para pedirle a Claude. Se reintenta en la próxima corrida.`);
  }
  const res = await fetch(permiso.endpoint, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
    ...(opts.hastaMs !== undefined ? { signal: AbortSignal.timeout(opts.hastaMs - Date.now()) } : {}),
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
// enchufa acá como `tools` + un `runTool` que rutea a meta-ads, etc.
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
    /** D6b (21/10/2026): el negocio tiene SU Claude o SU GPT. La cascada sólo prueba su OpenAI y después su Claude: ni
     *  Gemini, ni Groq, ni Mistral, ni OpenRouter (docs/ia-del-cliente.md §12.7). */
    soloSuIA?: boolean;
    /** WA1 (22/10/2026): DIRECTO a la clave de Claude del negocio (la puerta 2 del veto), sin la cascada: el que llama ya
     *  probó su OpenAI (el doer de WhatsApp). Sin su clave, tira «falló la IA (…)». Nunca el Claude de MaKo. */
    soloSuClaude?: boolean;
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
  // D6b decidido por el negocio en curso (IA6, lib/solo-su-ia.ts → `conD6bDelPedido`), si nadie lo decidió antes.
  if (!d6bDecidida()) return conD6bDelPedido(opts.feature, () => chatClaudeTools(system, messages, tools, runTool, opts));
  // Override configurable por feature (tab /modelos-ia). Si el caller NO forzó un
  // modelo y la feature está ruteada a otra IA (Groq/OpenAI/Gemini), corremos el
  // LOOP de tools por chatCheapTools (function-calling OpenAI-compat) ANTES de
  // exigir la key de Anthropic. Fallback a Claude si la barata falla. Si es otro
  // modelo de Claude, lo usamos (antes chatClaudeTools ignoraba el registro y todo
  // corría en Opus). El doer de WhatsApp pasa `model` explícito (router) → salta
  // esto y sigue en Claude; su ruteo a barato va por su propio camino (DOER_GROQ_TOOLS).
  let model = opts.model ?? '';   // sin default: el `?? MODEL` era la quinta puerta
  /** La clave de Claude del NEGOCIO, cuando ninguna IA barata suya contestó (abajo). */
  let delNegocio: PermisoClaveDelNegocio | null = null;
  if (opts.soloSuClaude) {
    const n = await permisoDeLaClaveDelNegocio(opts.feature).catch(() => null);
    if (n && 'permiso' in n) delNegocio = n.permiso;
    else throw new Error(`falló la IA (${n && 'pausa' in n ? CLAUDE_EN_PAUSA : 'el negocio no tiene su clave de Claude'})`);
  } else if (!opts.model && opts.feature) {
    // ⚠️ El `catch` vacío envuelve SÓLO la lectura del registro (ticket #5, 18/10/2026). Antes envolvía también la
    // cascada, y el «falló la IA» que se re-lanza con `sinFallbackClaude` caía en él y se perdía. El modelo quedaba
    // vacío y el veto contestaba «Claude vetado — «mako-doer»…». La Ticketera lo leyó como un bug: era la IA gratis
    // que no contestó. El diagnóstico obvio, sumar la feature a la lista blanca, era el equivocado: habría pagado Claude.
    const feature = opts.feature;
    const ref = await (async () => {
      try {
        const { modeloDeFeature } = await import('@/lib/model-registry');
        return await modeloDeFeature(feature);
      } catch (e) {
        if (opts.sinFallbackClaude) throw new Error(`falló la IA (no pude leer el modelo de «${feature}»: ${e instanceof Error ? e.message : String(e)})`);
        return null; // sin registro → el veto corta abajo; ya no hay «usá el default»
      }
    })();
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
        // Con su Claude o su GPT (`soloSuIA`), sólo su OpenAI: la cascada barata no participa en sus turnos (D6b).
        const provs: ProvName[] = opts.soloSuIA || soloSuIA() ? ['openai'] : [ref.provider as ProvName, ...CASCADA_TOOLS.filter((p) => p !== ref.provider)];
        const r = await chatCheapToolsCascade(system, messages, tools, runTool, {
          maxSteps: opts.maxSteps, maxTokens: opts.maxTokens, feature: opts.feature, motivo: opts.motivo,
          provs, modelos: { [ref.provider as ProvName]: ref.model }, erroresOut: errores,
        });
        if (r) return { text: r.text, steps: r.steps, stopReason: r.stopReason };
        // ⚠️ NINGUNA IA BARATA DEL NEGOCIO CONTESTÓ (o no tiene ninguna): SU CLAVE DE CLAUDE, si la cargó (20/10/2026).
        // Un negocio que conectó SÓLO su Claude no tenía con qué contestar en el chat —este camino nunca la miraba— y
        // «Conectar tu IA» le pedía Gemini (docs/investigacion-ops-center-19-10.md). Va por la puerta 2 del veto (su
        // clave, el modelo barato, nunca el Plan) y la paga su cuenta. Sólo si la cascada volvió sin ejecutar nada: si
        // tiró, ya tocó datos, y otro modelo duplicaría la escritura.
        const n = await permisoDeLaClaveDelNegocio(opts.feature).catch(() => null);
        if (n && 'permiso' in n) delNegocio = n.permiso;
        // Con su Claude en pausa (de la plataforma), lo que pasa de verdad: no «sin proveedor», que le pedía conectar lo que ya
        // tiene conectado (revisión del Cerebro, 21/10/2026). lib/errores-app-reglas.ts lo cuenta como configuración, no bug.
        else if (n && 'pausa' in n && opts.sinFallbackClaude) throw new Error(`falló la IA (${CLAUDE_EN_PAUSA})`);
        else if (opts.sinFallbackClaude) throw new Error(`falló la IA (${errores.join(' · ').slice(0, 200) || 'sin proveedor gratis disponible'})`);
      } catch (e) {
        // El caller pidió NO caer a Claude (ej. el doer): re-lanzamos para que avise
        // "falló Gemini" en vez de gastar Claude en silencio.
        if (opts.sinFallbackClaude) throw e;
        errores.push(e instanceof Error ? e.message : String(e));
      }
      // Toda la cascada gratis falló: recién ACÁ se paga, con SONNET por default (el
      // fallbackModel del router si vino), NUNCA Opus. Salvo que pague el negocio con su clave.
      if (!delNegocio) {
        model = opts.fallbackModel ?? 'claude-sonnet-5';
        console.warn(`[anthropic] tools ${opts.feature}: la cascada gratis no contestó, pago Claude ${model} — ${errores.join(' · ')}`);
      }
    } else if (ref) {
      model = ref.model;
    }
  }

  // ── EL VETO, la MISMA puerta que chatClaude ──────────────────────────────────────
  // Este camino nunca consultó `fallbackDeFeature`, así que ni siquiera `fallback: []` lo
  // frenaba: era la tercera de las cinco puertas. Ahora no hace falta que lo consulte —
  // la puerta es una sola y está acá. Se evalúa UNA vez, antes del loop: dentro del loop
  // sería el mismo permiso N veces y N filas de bloqueo.
  // Con la clave del NEGOCIO el permiso ya lo dio la puerta 2 (arriba): no pasa por la de la plataforma.
  let permiso: PermisoClaude;
  if (delNegocio) permiso = delNegocio;
  else {
    try {
      permiso = permisoDeGasto({ feature: opts.feature, model, pausa: await claudePausado() });
    } catch (e) {
      await registrarBloqueo(e, opts.feature, model);
      throw e;
    }
  }
  model = permiso.model;

  // La key de Claude sale POR WORKSPACE (BYOK): fila cifrada del cliente > env del dueño. La del negocio, la que el
  // veto verificó (`permiso.clave`), sin volver a resolver nada.
  const key = delNegocio ? delNegocio.clave : await credWs('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY no configurada');
  const effort: Effort = opts.effort ?? DEFAULT_EFFORT;
  const maxSteps = opts.maxSteps ?? 8;
  const msgs: RichMsg[] = [...messages];

  for (let step = 0; step < maxSteps; step++) {
    // Con la clave del negocio, el pedido de `conClaveDelNegocio` (el modelo barato, sin thinking ni effort) más las
    // herramientas: es la forma que ya anda con su clave.
    const payload: Record<string, unknown> = delNegocio
      ? { model, max_tokens: opts.maxTokens ?? 4096, system, messages: msgs, tools }
      : {
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
    if (!res.ok || body.error) {
      const m = body?.error?.message ?? `Anthropic ${res.status}`;
      // Con su clave, el fallo queda escrito (IA3): es lo que la tarjeta de «Tus cuentas de IA» le muestra al negocio.
      if (delNegocio) await (await import('./su-clave')).anotarFalloDeSuClave({ proveedor: 'anthropic', error: `HTTP ${res.status} ${body?.error?.type ?? ''} ${m}`, feature: permiso.feature, modelo: String(model) });
      throw new Error(delNegocio ? `falló la IA (tu clave de Claude: ${m})` : m);
    }

    // Lo que paga el negocio lleva su marca PRIMERO: lib/costos-ia.ts lo saca del gasto de MaKo.
    const usage = await recordUsage(permiso.feature, String(model), body.usage,
      delNegocio ? [MOTIVO_CLAVE_DEL_NEGOCIO, (opts.motivo ?? '').trim()].filter(Boolean).join(' · ') : opts.motivo);
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
