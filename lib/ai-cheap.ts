// =============================================================================
// ai-cheap — IA barata para tareas simples + transcripción (hermano de chatClaude)
// =============================================================================
// Objetivo: sacar a Claude Opus de lo que NO necesita su cabeza (clasificar,
// extraer, titular, resumir, detectar intención) y del STT (notas de voz). Se
// resuelve el proveedor por env, todo OpenAI-compatible:
//   1) GROQ_API_KEY  → Groq (gpt-oss-20b + whisper-large-v3-turbo). Barato, rápido,
//      NO entrena con tus datos (activá ZDR en la consola de Groq para PII).
//   2) OPENAI_API_KEY → OpenAI (gpt-4o-mini + whisper-1). Ya configurado en el repo,
//      así que esto FUNCIONA HOY; al agregar GROQ_API_KEY se abarata solo.
// Para ESCUCHAR audio el orden es otro (CASCADA_STT): Gemini → Groq → OpenAI. Gemini
// va primero porque es la key gratis que carga cada cliente y escucha el audio nativo;
// OpenAI queda último por ser el único que cobra.
//
// LA ROTACIÓN TIENE DOS EJES, y hasta el 12/8/2026 solo existía uno:
//   · entre PROVEEDORES (Gemini → Groq → Cerebras → …), que es lo que hace la cascada;
//   · entre CUENTAS del mismo proveedor (GEMINI_API_KEY, _2, _3 — ver lib/ia-keys.ts).
// El segundo importa porque el free tier se agota POR CUENTA: con la key 1 de Gemini
// en 429, la respuesta correcta es la key 2 de Gemini (mismo modelo, 1M de contexto) y
// no el Llama de 70b que quedaba río abajo. Todo el que resuelve un proveedor pasa por
// `provsDe`, que devuelve UNA instancia por cuenta cargada.
// Modelos e IDs por env (rotan seguido, no hardcodear). Claude sigue para el
// razonamiento fino y el copywriting con voz de marca (lib/anthropic.ts).

import 'server-only';
import { recordUsage, recordSttUsage } from '@/lib/anthropic-usage';
import type { ToolDef, ToolRunner, RichMsg, ToolsResult } from '@/lib/anthropic';
import { credWs } from '@/lib/credenciales';
import { ordenarCuentas, ordenarPorCuota, anotarRebote429 } from '@/lib/ia-cuotas';
import { clavesAProbar, clavesDe } from '@/lib/ia-keys';
import { clavesCargadas } from '@/lib/ia-keys-ws';
import { mensajeIAFallo, motivoDeErroresCascada } from '@/lib/ia-mensajes';
import { corregirMarca } from '@/lib/mako-gramatica';

export type ProvName = 'groq' | 'openai' | 'gemini' | 'cerebras' | 'mistral' | 'openrouter';
/** `clave` = de QUÉ credencial salió esta key. Con varias cuentas del mismo
 *  proveedor (GEMINI_API_KEY, _2, _3) es lo único que las distingue: sin ese dato,
 *  un reintento «del mismo proveedor» volvía a pegarle a la cuenta ya agotada. */
type Prov = { base: string; key: string; chatModel: string; sttModel: string; nombre: ProvName; clave: string };

// Cada proveedor, sin la key: endpoint y modelos. Los `process.env` se leen al
// llamar (los ids rotan seguido y se pisan por entorno), así que va como función.
function cfgDe(nombre: ProvName): Omit<Prov, 'key' | 'clave'> {
  switch (nombre) {
    case 'groq':
      return { nombre, base: (process.env.CHEAP_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''), chatModel: process.env.CHEAP_MODEL || 'openai/gpt-oss-20b', sttModel: process.env.STT_MODEL || 'whisper-large-v3-turbo' };
    case 'gemini':
      // Endpoint OpenAI-compatible de Gemini (chat + function-calling). Para AUDIO no
      // sirve —no tiene /audio/transcriptions— pero Gemini igual escucha: lo hace por su
      // API nativa (ver sttGemini), y por eso encabeza la cascada de STT. 1M de contexto.
      // `gemini-flash-latest` = alias oficial al Flash GA vigente (no 404ea como los ids
      // pineados que se van retirando). Pisable con GEMINI_MODEL.
      return { nombre, base: 'https://generativelanguage.googleapis.com/v1beta/openai', chatModel: process.env.GEMINI_MODEL || 'gemini-flash-latest', sttModel: '' };
    // ── IA GRATIS extra para rotar (todas OpenAI-compatibles) ─────────────────
    // ⚠️ LOS IDS DE MODELO CADUCAN, Y CUANDO CADUCAN LA KEY QUEDA MUERTA EN SILENCIO.
    // Medido el 12/8/2026 pegándole a cada cuenta cargada: las SEIS keys de Cerebras y
    // OpenRouter devolvían error —404 «no existe ese modelo» y «este modelo ya no es
    // gratis»— con los ids que estaban acá. El dueño había cargado tres cuentas de cada
    // uno pensando que sumaba cuota y no sumaba nada: dos proveedores enteros muertos.
    // Los de abajo salieron de pedirle a cada API su lista real de modelos.
    case 'cerebras': // gratis y MUY rápida (su propio chip). Soporta tools.
      // Su catálogo son TRES modelos y ninguno es Llama: gemma-4-31b, gpt-oss-120b y
      // zai-glm-4.7. ⚠️ OJO: probado el 12/8, las tres cuentas cargadas devuelven 402 en
      // los TRES — no es el id, es que esas cuentas no tienen tier gratis. El id queda
      // correcto para el día que alguna lo tenga; hasta entonces Cerebras no suma nada.
      return { nombre, base: 'https://api.cerebras.ai/v1', chatModel: process.env.CEREBRAS_MODEL || 'gpt-oss-120b', sttModel: '' };
    case 'mistral': // free tier de La Plateforme. Soporta tools.
      return { nombre, base: 'https://api.mistral.ai/v1', chatModel: process.env.MISTRAL_MODEL || 'mistral-small-latest', sttModel: '' };
    case 'openrouter': // agregador con modelos ":free".
      // ⚠️ LOS ID DE ESTE PROVEEDOR CADUCAN, Y CUANDO CADUCAN LA KEY QUEDA MUERTA EN SILENCIO.
      // Acá ya estuvieron un Llama 3.3 y después un `nvidia/nemotron-3-nano-30b-a3b:free`, y
      // los dos dejaron de existir. El segundo devolvía, TEXTUAL: «This model is unavailable
      // for free. The paid version is available now» — o sea que el modelo sigue estando y
      // solo se cayó del tier gratis, que es el modo más engañoso de romperse.
      //
      // Se elige por LATENCIA y por FORMA DE LA SALIDA, las dos medidas contra la key de un
      // cliente real (16/08): `minimax/minimax-m3:free` contesta en 1,0 s y devuelve el JSON
      // pelado. Se descartó `nvidia/nemotron-3.5-lightning:free`, que anda y tarda 1,5 s pero
      // contesta con su razonamiento por delante («Here's a thinking process…») — inútil para
      // los callers que parsean JSON. Y `google/gemma-4-31b-it:free` y `z-ai/glm-5.2:free`
      // daban 429 «temporarily rate-limited» en el momento de medir.
      //
      // Antes de cambiar este id: pedí la lista real (`GET /api/v1/models`, filtrar por
      // `:free`) y PROBÁ el candidato con un payload de verdad. Que esté listado no significa
      // que sirva — esa es la lección que dejó cada uno de los dos anteriores.
      return { nombre, base: 'https://openrouter.ai/api/v1', chatModel: process.env.OPENROUTER_MODEL || 'minimax/minimax-m3:free', sttModel: '' };
    default:
      return { nombre: 'openai', base: 'https://api.openai.com/v1', chatModel: process.env.CHEAP_MODEL || 'gpt-4o-mini', sttModel: process.env.STT_MODEL || 'whisper-1' };
  }
}

/** Las claves de un proveedor EN ORDEN. Los gratis admiten varias cuentas
 *  (lib/ia-keys.ts); OpenAI y Anthropic, una sola: cobran, y rotar entre cuentas
 *  pagas no suma cuota, suma facturas. Vive en el catálogo para que tenga test. */
const clavesProv = clavesAProbar;

// La key sale POR WORKSPACE (credWs): la fila cifrada del cliente primero, y para
// el DUEÑO el env queda de respaldo. Así cada cliente usa SU propia key (BYOK real)
// y su gasto corre contra SU cuenta; un cliente sin fila propia → null, nunca la
// del dueño (aislamiento). Antes se leía process.env directo → pagaba la agencia.
async function provDe(nombre: ProvName, clave?: string, wsKey?: number): Promise<Prov | null> {
  const cl = clave ?? clavesProv(nombre)[0];
  // `wsKey` SOLO lo pasa la red de plataforma (ver `provsGratisDePlataforma`).
  // Sin él se comporta igual que siempre: la fila del workspace en curso.
  const key = await credWs(cl, wsKey);
  if (!key) return null;
  return { ...cfgDe(nombre), key, clave: cl };
}

/**
 * TODAS las cuentas cargadas de un proveedor, en orden (la de siempre primero).
 * Vacío si no hay ninguna. Es el eje de rotación que faltaba: el free tier se agota
 * por CUENTA, así que quien cargó tres keys de Gemini tiene tres veces la cuota —
 * y hasta acá la cascada saltaba de proveedor con la segunda cuenta sin tocar.
 */
/**
 * Las CUENTAS cargadas de un proveedor, ya ordenadas por cuota disponible.
 *
 * ⚠️ Exportada desde el 27/09/2026, y el motivo es un bug medido: el doer de
 * WhatsApp tenía su propio loop de proveedores y llamaba a `chatCheapTools` SIN
 * `clave`, así que resolvía siempre la key base y **nunca probaba la segunda cuenta
 * del cliente**. Medido en `anthropic_usage` del ws13: `feature=mako-doer-in` tiene
 * 24 llamadas con la cuenta 1 y CERO con la cuenta 2 en toda la historia — mientras
 * la misma key funcionaba perfecto por otro camino (`campaign-suggest`, 8 llamadas
 * OK), porque ése sí pasa por la cascada. El cliente veía «te quedaste sin cuota»
 * teniendo una cuenta entera sin tocar.
 */
export async function provsDe(nombre: ProvName): Promise<Prov[]> {
  const out: Prov[] = [];
  // Solo las que ESTE workspace tiene cargadas (una query, cacheada por request) en
  // vez de preguntar por las MAX_KEYS del catálogo: con el tope en 10 eso eran 10
  // SELECT por proveedor —hasta 50 por generación— casi todos para descubrir que la
  // key no existe. Si la lectura falla, `clavesCargadas` devuelve el catálogo entero
  // y esto se comporta como antes.
  // OJO: `nroCuenta` sigue usando `clavesProv` (la lista COMPLETA) a propósito — el
  // número de cuenta tiene que salir del nombre, no de la posición entre las cargadas.
  /**
   * ⚠️ `clavesCargadas` DEVUELVE `[]` POR DOS RAZONES DISTINTAS, Y ACÁ SE LEÍA UNA SOLA.
   *
   * Una es «este workspace no tiene ninguna cargada». La otra es «este proveedor no
   * admite varias cuentas», que es el caso de OpenAI: `clavesDe` le devuelve `[]` a
   * propósito —cobra por token, así que una segunda cuenta no suma cuota gratis, suma
   * otra factura— y su nombre de clave lo da `clavesProv`, con el fallback
   * `${NOMBRE}_API_KEY`. El propio `ia-keys-ws.ts` lo dice en su comentario: «los dos
   * casos dan [] y se distinguen preguntando primero por el catálogo». Este loop no
   * preguntaba.
   *
   * Consecuencia, desde el 13/08/2026 (commit 85a020b8, cuando esto pasó a
   * `clavesCargadas`): **OpenAI no existe en NINGUNA cascada del producto**. Es el
   * último escalón de `CASCADA_GRATIS`, de `CASCADA_DOCS` y de `CASCADA_STT`, o sea el
   * respaldo que existe justo para cuando los gratis se caen — y nunca corrió. Peor:
   * `cheapDisponible()` y `sttDisponible()` iteran esto, así que a un workspace cuya
   * ÚNICA key es de OpenAI el producto le contesta «no tenés IA» teniéndola cargada.
   *
   * No da error y no deja log: una lista vacía es una respuesta perfectamente válida.
   */
  const delCatalogo = clavesDe(nombre);
  const claves = delCatalogo.length ? await clavesCargadas(nombre) : clavesProv(nombre);
  for (const cl of claves) {
    const p = await provDe(nombre, cl);
    if (p) out.push(p);
  }
  // PROACTIVO: la cuenta con más cuota disponible primero. Sin esto la cascada
  // arranca siempre por la 1, y si esa está al tope cada llamada paga un 429 de
  // peaje antes de llegar a la 2 — con tres cuentas, tres peajes por llamada.
  if (out.length < 2) return out;
  const orden = await ordenarCuentas(nombre, out.map((p) => p.clave)).catch(() => out.map((p) => p.clave));
  return orden.map((c) => out.find((p) => p.clave === c)).filter((p): p is Prov => !!p);
}

/** Cómo se nombra un proveedor en logs y errores. Con varias cuentas, «gemini» a
 *  secas no dice nada: hay que poder leer CUÁL de las tres se quedó sin cuota. */
export const rotulo = (p: Prov): string => {
  const n = nroCuenta(p);
  return n > 1 ? `${p.nombre} · cuenta ${n}` : p.nombre;
};

/** Nº de cuenta (1..3) de una instancia. Es lo que se guarda en `anthropic_usage.cuenta`
 *  (mig 0132) para poder medir la cuota POR CUENTA y no sumada por proveedor. */
export const nroCuenta = (p: Prov): number => Math.max(1, clavesProv(p.nombre).indexOf(p.clave) + 1);

/** Proveedor barato para CHAT. `pref` (del registro de modelos) fuerza uno; si no
 *  está, cae a groq→openai. Gemini SOLO sale si lo pide `pref` explícito: necesita
 *  la key del cliente y no entra en el fallback por default. null si ninguno. */
async function proveedor(pref?: ProvName, clave?: string, wsKey?: number): Promise<Prov | null> {
  if (pref) { const p = await provDe(pref, clave, wsKey); if (p) return p; }
  return (await provDe('groq', undefined, wsKey)) ?? (await provDe('openai', undefined, wsKey));
}

/**
 * Los proveedores GRATIS de la PLATAFORMA, como última red de un cliente.
 *
 * ⚠️ Esto rompe a propósito —y SOLO en un sentido— el aislamiento que declara
 * `provDe`: «un cliente sin fila propia → null, nunca la del dueño». Esa regla es
 * correcta para el camino normal (cada uno gasta en SU cuenta) y tiene un costo
 * que nadie había medido: **un cliente con UNA sola key no tiene cascada.**
 *
 * EL CASO (2026-08-25). El ws13 tiene cargada `GEMINI_API_KEY` y nada más. La
 * cascada del doer prueba [gemini, groq, cerebras, mistral, openai] y las últimas
 * cuatro devuelven `null` al instante por falta de key: cinco casilleros, un solo
 * intento real. Gemini tuvo un bache de 74 segundos y el cliente recibió un error
 * en su primer día de prueba. Medido: cero llamadas en `anthropic_usage` ese
 * minuto, y la misma consulta andando perfecto un minuto después.
 *
 * Tres límites, y los tres importan:
 *
 *  1. **Solo GRATIS.** `openai` y `anthropic` quedan afuera: ahí una llamada de más
 *     es una factura de más, y eso es una decisión de plata que no toma el código.
 *     Estos consumen cuota gratis de la agencia, que se repone sola cada día.
 *  2. **Solo ÚLTIMO RECURSO.** Se usa cuando las keys del propio cliente ya
 *     fallaron. Mientras el cliente tenga con qué, gasta lo suyo.
 *  3. **Se REGISTRA.** El `motivo` dice «⚠ red de plataforma», así que en el Saldo
 *     de IA se ve cuánto se está apoyando cada cliente en la agencia. Sin eso, un
 *     respaldo que se vuelve permanente es indistinguible de uno que nunca se usó
 *     — y el que hay que cargar su key nunca se entera.
 */
export async function provsGratisDePlataforma(): Promise<Array<{ provider: ProvName; clave: string }>> {
  const { wsSuperAdmin } = await import('./workspace');
  const ws = await wsSuperAdmin().catch(() => null);
  if (ws == null) return [];
  const out: Array<{ provider: ProvName; clave: string }> = [];
  // ⚠️ MISTRAL NO ESTÁ, Y ES EL MISMO MOTIVO QUE EN LA CASCADA DEL DOER: rebota SIEMPRE.
  //
  // El 30/09 se lo sacó de `cands` (lib/mako-doer-in.ts) porque su 429 crónico le
  // FABRICABA el veredicto `sin_cuota` a cualquier falla — y quedó vivo acá, que es la
  // lista que corre cuando al cliente no le contesta nadie. Medido el 01/10/2026 en el
  // ws13: las TRES keys de mistral DE LA AGENCIA devolvieron 429 en el mismo turno, y
  // esos tres fueron los únicos errores de cuota de la lista con la que se eligió el
  // texto. O sea que el «te quedaste sin cuota» que leyó un cliente lo fabricaron
  // nuestras propias keys, con la suya contestando HTTP 200.
  //
  // Y además gastaba el presupuesto: el log dice «cortada por tiempo: 7/8 probados», y
  // tres de esos siete intentos eran mistral.
  for (const prov of ['gemini', 'groq'] as const) {
    for (const clave of clavesProv(prov)) {
      const k = await credWs(clave, ws).catch(() => null);
      if (k) out.push({ provider: prov, clave });
    }
  }
  return out;
}

// Orden de la transcripción (STT). Gemini primero: es la key gratis y generosa que
// cada cliente carga en el onboarding, y escucha el audio NATIVO (no por Whisper).
// Groq después (Whisper turbo, rápido y gratis) y OpenAI al final, que es el único
// que cobra. Ver transcribirAudio: la cascada cae por ERROR, no solo por falta de key.
export const CASCADA_STT: ProvName[] = ['gemini', 'groq', 'openai'];

export async function cheapDisponible(): Promise<boolean> { return (await proveedor()) !== null; }
/** ¿Hay alguna IA que pueda escuchar un audio en este workspace? */
export async function sttDisponible(): Promise<boolean> {
  for (const p of CASCADA_STT) { if ((await provsDe(p)).length) return true; }
  return false;
}

// Cascada para LEER DOCUMENTOS del negocio (El Archivero, onboarding-extract). A
// diferencia de CASCADA_GRATIS, INCLUYE Gemini y lo pone primero: es la IA gratis y
// generosa que el cliente carga en el onboarding (#4), así que la extracción tiene
// que poder usarla. Sin esto, un workspace con SOLO key de Gemini extrae vacío.
export const CASCADA_DOCS: ProvName[] = ['gemini', 'groq', 'openrouter', 'mistral', 'openai'];
// Modelo CAPAZ por proveedor para EXTRAER de documentos. El default barato de cada
// uno (ej. Groq gpt-oss-20b) es demasiado chico: con un doc real de +10k chars
// genera JSON malformado/truncado y devuelve 0 campos (probado: 20b falla, 70b saca
// 11/11). La extracción de un brief es "análisis", necesita un modelo grande.
/**
 * Modelos de RESPALDO por proveedor, para cuando el principal no está sirviendo.
 *
 * ⚠️ NO ES REDUNDANCIA: es el único eje que salva a un workspace con UN proveedor.
 * Rotar cuentas no sirve si lo que está caído es el modelo, y rotar proveedores no
 * existe cuando hay uno solo — que es el estado normal de un cliente recién dado de
 * alta, con su key de Gemini gratis y nada más.
 *
 * El respaldo de Gemini es `flash-lite` porque **está medido que responde cuando
 * `flash-latest` no**: 16/08, misma key, mismo payload de 24k caracteres, `flash-latest`
 * daba 503 «high demand» de forma persistente y `flash-lite-latest` contestaba 200.
 *
 * Es un modelo MÁS FLOJO, y eso es a propósito y aceptable acá: solo entra cuando el
 * bueno no está, y la alternativa no es «una respuesta un poco peor» sino NINGUNA. Los
 * callers de documentos pasan `validar`, así que una salida inservible igual se descarta.
 *
 * ⚠️ Y NO SE PONEN IDS CON NÚMERO DE VERSIÓN. Google los retira: `gemini-2.5-flash` ya
 * contesta 404 «no longer available to new users», y `gemini-2.0-flash` también. Solo
 * alias `-latest`, que es lo único que no envejece solo.
 */
const MODELOS_RESPALDO: Partial<Record<ProvName, string[]>> = {
  gemini: ['gemini-flash-lite-latest'],
};

/** El modelo pedido primero, y atrás los respaldos que no sean el mismo. */
function modelosAProbar(prov: ProvName, pedido?: string): Array<string | undefined> {
  const respaldos = (MODELOS_RESPALDO[prov] ?? []).filter((m) => m !== pedido);
  return [pedido, ...respaldos];
}

/**
 * El modelo que lee DOCUMENTOS en cada proveedor.
 *
 * ⚠️ ESTOS ID CADUCAN Y SE ROMPEN EN SILENCIO. Medido el 16/08 contra la key de un
 * cliente que tenía CUATRO proveedores cargados y aún así no podía subir un documento:
 *   · groq       → «The model `llama-3.3-70b-versatile` does not exist» (id muerto)
 *   · openrouter → «This model is unavailable for free» (se cayó del tier gratis)
 *   · cerebras   → HTTP 402 «Payment required» (la CUENTA no tiene tier gratis)
 *   · gemini     → HTTP 429 (cuota de verdad)
 * O sea: de cuatro respaldos, tres estaban muertos y nadie se había enterado. Un
 * proveedor con la key cargada y el id vencido se ve EXACTAMENTE igual que uno sano
 * hasta que se lo llama.
 *
 * Los de ahora se eligieron pidiéndole a cada API su lista real y PROBÁNDOLOS con un
 * payload de verdad: groq `openai/gpt-oss-120b` (1,2 s) y openrouter
 * `minimax/minimax-m3:free` (1,0 s, JSON pelado).
 */
export const MODELO_DOCS: Partial<Record<ProvName, string>> = {
  groq: process.env.DOCS_MODEL_GROQ || 'openai/gpt-oss-120b',
  gemini: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  openai: 'gpt-4o-mini',
  cerebras: 'gpt-oss-120b',
  openrouter: 'minimax/minimax-m3:free',
  mistral: 'mistral-small-latest',
};
/** ¿Hay alguna IA para leer documentos (Gemini/Groq/OpenAI/…) en este workspace? */
export async function docsIADisponible(): Promise<boolean> {
  for (const p of CASCADA_DOCS) { if ((await provsDe(p)).length) return true; }
  return false;
}

// Ante un 404 de "modelo no encontrado", listamos los modelos que SÍ acepta la key
// (GET /models, OpenAI-compat) y los metemos en el error → nunca más adivinamos el id.
async function modelosDisponibles(p: Prov): Promise<string> {
  try {
    const res = await fetch(`${p.base}/models`, { headers: { Authorization: `Bearer ${p.key}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const data = await res.json().catch(() => ({})) as { data?: Array<{ id?: string }>; models?: Array<{ name?: string }> };
    const ids = [...(data.data ?? []).map((m) => m.id), ...(data.models ?? []).map((m) => m.name)].filter(Boolean).map((s) => String(s).replace(/^models\//, ''));
    const flash = ids.filter((id) => /flash|gemini/i.test(id)).slice(0, 20);
    return flash.length ? ` · modelos disponibles: ${flash.join(', ')}` : '';
  } catch { return ''; }
}

/**
 * LLM barato para tareas simples. Devuelve el texto (o el JSON crudo si json=true).
 * NO usar para copywriting con voz de marca ni razonamiento fino → eso es chatClaude.
 */
/**
 * Cuánto puede PENSAR el modelo barato. Gemini es el único que entiende el campo.
 *
 * ⚠️ Esto no estaba y era un agujero silencioso: `chatClaude` delega acá cuando la
 * feature está ruteada a un proveedor barato, pero TIRABA el `effort` del caller y
 * chatCheap mandaba 'minimal' hardcodeado. O sea: una tarea configurada con
 * `effort:'high'` —la extracción de reuniones, por ejemplo— corría con el mínimo
 * esfuerzo posible, y nadie se enteraba. Explica por qué los detalles salían de 140
 * caracteres cuando el prompt pide 4 a 8 frases.
 *
 * 'minimal' sigue siendo el DEFAULT cuando el caller no pide nada: es lo que arregló el
 * panorama del Archivero, que se cortaba a la mitad porque el modelo gastaba todo el
 * presupuesto pensando. No es un valor válido 'none' (400 Invalid argument, probado).
 */
export type EsfuerzoBarato = 'minimal' | 'low' | 'medium' | 'high';

export async function chatCheap(opts: { system: string; user: string; json?: boolean; maxTokens?: number; temperature?: number; feature?: string; motivo?: string; provider?: ProvName; model?: string; clave?: string; timeoutMs?: number; esfuerzo?: EsfuerzoBarato }): Promise<string> {
  // `clave` elige CUÁL cuenta del proveedor (GEMINI_API_KEY vs _2 vs _3). La pone la
  // cascada al rotar; un caller suelto no la pasa y usa la de siempre.
  const p = await proveedor(opts.provider, opts.clave);
  if (!p) throw new Error('Sin proveedor de IA barata (falta GROQ_API_KEY u OPENAI_API_KEY).');
  const model = opts.model || p.chatModel;
  // Timeout configurable: 30s alcanza para tareas simples, pero una llamada grande
  // (el Perro Guardián puntuando TODO el plan: ~40k input + 8k output) tarda más en
  // Gemini Flash → con el tope fijo abortaba y caía al fallback de Claude. El caller
  // (chatClaude) lo escala según maxTokens.
  const res = await fetch(`${p.base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      max_tokens: opts.maxTokens ?? 512,
      temperature: opts.temperature ?? 0.2,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      // Gemini 2.5 Flash "piensa" por default y ese razonamiento oculto consume del
      // mismo max_tokens: con un tope chico, el modelo gasta todo pensando y la
      // respuesta VISIBLE sale cortada a mitad de frase (bug reportado: panorama del
      // Archivero con solo 2 de 6 secciones — confirmado con un pedido de prueba real:
      // SIN este campo, finish_reason daba "length" hasta para "decí hola y nada más").
      // 'none' no es un valor válido para este endpoint (400 Invalid argument,
      // probado); 'minimal' sí, y da finish_reason "stop" — es el mínimo real que
      // acepta. Solo gemini entiende este campo: los demás proveedores tirarían 400
      // con un campo que no reconocen, así que se limita a gemini.
      ...(p.nombre === 'gemini' ? { reasoning_effort: opts.esfuerzo ?? 'minimal' } : {}),
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const extra = p.nombre === 'gemini' && res.status === 404 ? await modelosDisponibles(p) : '';
    throw new Error(`chatCheap(${rotulo(p)}): ${data?.error?.message || `HTTP ${res.status}`}${extra}`);
  }
  // Registrar el gasto (barato, no descuenta del saldo de Claude) con descripción.
  void recordUsage(opts.feature || 'ia-barata', model, data.usage, opts.motivo, p.nombre, nroCuenta(p));
  // Si la respuesta se CORTÓ por llegar al tope, decilo. Era el punto ciego que hacía
  // indistinguible "la reunión no dejaba más tareas" de "se quedó sin lugar para
  // escribirlas": el JSON llega mocho, el parse falla y quedan cero tareas sin motivo.
  const fin = data.choices?.[0]?.finish_reason;
  if (fin && fin !== 'stop') console.warn(`[ia-barata] ${p.nombre}/${model} terminó por "${fin}" (${opts.feature ?? ''}) — la respuesta puede venir cortada; subí maxTokens (era ${opts.maxTokens ?? 512})`);
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

/** Genera texto probando las IA baratas EN ORDEN (Groq gratis → OpenAI barato), SIN tocar
 *  Claude. Para cuando la IA pineada (ej. Gemini) falla o no devuelve algo usable y NO
 *  queremos caer en el gasto de Claude. Devuelve el texto de la primera que funcione, o ''. */
// Orden por default: GRATIS primero (Groq, Cerebras, OpenRouter, Mistral) y OpenAI (barato)
// al final. Claude NUNCA entra acá. Cada uno se usa solo si tiene su key cargada (si no, se salta).
export const CASCADA_GRATIS: ProvName[] = ['groq', 'openrouter', 'mistral', 'openai'];

// ─────────────────────────────────────────────────────────────────────────────
// EL TECHO DE ENTRADA: por qué la cascada mira cuánto pesa el prompt
// ─────────────────────────────────────────────────────────────────────────────
// CASCADA_GRATIS arranca por Groq, y el plan gratis de Groq son 8.000 tokens POR
// MINUTO. No es el contexto del modelo: es lo que la cuenta deja pasar. Un prompt más
// grande que eso NO ENTRA NUNCA, por más que el modelo lo soporte.
//
// Eso convertía a la cascada en una trampa silenciosa: quien mandaba algo grande
// —el tablero entero, un documento, sesenta commits— rebotaba en Groq, en Cerebras y
// en OpenRouter, perdía ~9 segundos en el camino y terminaba atendido por el modelo
// más chico que quedara. No fallaba: contestaba MAL. Medido el 6/8/2026 con la
// búsqueda del plan (497 tareas, 48k tokens): 12,8 s y resultados que no tenían nada
// que ver, contra 3,3 s y los 4 correctos cuando el mismo prompt fue a Gemini.
//
// Ahora la cascada lo resuelve sola. Ningún caller tiene que acordarse de pasar
// `provs`: acordarse es exactamente lo que no pasó en ninguno de los doce.
const TECHO_ENTRADA: Partial<Record<ProvName, number>> = {
  groq: 7_000,        // 8k TPM del free tier, menos lo que reserva la salida
  cerebras: 30_000,
  openrouter: 30_000,
  mistral: 100_000,
  openai: 100_000,
  gemini: 900_000,    // 1M de contexto: es el único que come el tablero entero
};

/** Tokens aproximados de un prompt. 3,5 caracteres por token es el número del español
 *  (el inglés está más cerca de 4); se queda corto a propósito, porque pasarse de
 *  optimista acá significa volver a mandarle a Groq algo que va a rebotar. */
const tokensAprox = (texto: string): number => Math.ceil(texto.length / 3.5);
// erroresOut es opcional y ADITIVO (no cambia qué devuelve la función): si el caller
// pasa un array, cada proveedor que falla empuja su motivo ahí — así quien llama puede
// distinguir "sin key" de "con key pero la cascada falló" (cuota, rate-limit, timeout)
// sin tener que cambiar cómo usa el string que ya devuelve chatCheapCascade.
// `temperature` es opcional y por default sigue siendo la de chatCheap (0.2), que
// es la correcta para extraer y clasificar. Existe porque hay un caller que NO
// hace eso: el ensayo del Chat Agent, donde el modelo interpreta a un lead. Con
// 0.2 se pegaba a la salida más probable y repetía la misma objeción turno tras
// turno, hasta copiar literalmente las frases de ejemplo del prompt.
export async function chatCheapCascade(opts: { system: string; user: string; json?: boolean; maxTokens?: number; temperature?: number; feature?: string; motivo?: string; provs?: ProvName[]; timeoutMs?: number; modelos?: Partial<Record<ProvName, string>>; validar?: (t: string) => boolean; erroresOut?: string[]; esfuerzo?: EsfuerzoBarato }): Promise<string> {
  // ¿Cuánto pesa esto? La salida cuenta: el techo de Groq es de tokens por minuto, y
  // los que gasta contestando salen del mismo balde que los que gasta leyendo.
  const pesa = tokensAprox(opts.system) + tokensAprox(opts.user) + (opts.maxTokens ?? 1_000);
  // Si el caller no eligió proveedores y el prompt es grande, la lista por defecto pasa a
  // ser la que INCLUYE Gemini. Es el único con contexto de verdad, y la alternativa —que
  // cada caller se acuerde de pasar `provs`— ya se probó: ninguno de los doce se acordó.
  const pedidos = opts.provs ?? (pesa > (TECHO_ENTRADA.groq ?? 7_000) ? CASCADA_DOCS : CASCADA_GRATIS);
  // Y sacamos de la lista a los que no lo pueden recibir. No es una optimización: cada uno
  // de esos es un viaje de ida y vuelta que termina en 413 y suma segundos a la espera.
  const caben = pedidos.filter((p) => pesa <= (TECHO_ENTRADA[p] ?? Number.MAX_SAFE_INTEGER));
  // Si no entra en NINGUNO, igual lo intentamos con todos: mejor que rebote de verdad y
  // quede en el log a devolver '' sin haber preguntado. El techo es una estimación.
  const candidatos = caben.length ? caben : pedidos;
  if (caben.length < pedidos.length) {
    console.info(`[ai-cheap] ~${pesa} tokens: salteo ${pedidos.filter((p) => !caben.includes(p)).join(', ')} (no les entra)`);
  }
  // PROACTIVO: probamos primero los que todavía tienen cuota hoy (los cerca del tope van al final).
  const orden = await ordenarPorCuota(candidatos.map(String)).catch(() => candidatos.map(String));
  for (const prov of orden as ProvName[]) {
    // DOS ejes de rotación, y este es el de adentro: todas las CUENTAS cargadas de
    // este proveedor antes de pasar al siguiente. El free tier se agota por cuenta,
    // así que un 429 de la primera key de Gemini lo contesta la segunda key de
    // Gemini —mismo modelo, mismo contexto de 1M— y no un Llama de 70b que era lo
    // mejor que quedaba río abajo. Sin key cargada, `instancias` es vacío y no
    // cuesta ni un request.
    const instancias = await provsDe(prov);
    for (const inst of instancias) {
     // ⚠️ TERCER EJE DE ROTACIÓN: EL MODELO. Los otros dos (cuenta y proveedor) no
     // sirven de nada cuando lo que está caído es UN MODELO y el workspace tiene un
     // solo proveedor: se prueban las N cuentas contra el mismo modelo muerto y se
     // rinde con el resto del catálogo del proveedor intacto.
     //
     // Pasó el 16/08 con un cliente esperando, y el diagnóstico obvio fue el equivocado
     // DOS veces: no era la cuota (la key era nueva) y no era la key. Medido con la key
     // real del cliente y el mismo payload de 24k caracteres:
     //   gemini-flash-latest      → 503 «high demand», persistente
     //   gemini-2.5-flash         → 404 «no longer available to new users»
     //   gemini-flash-lite-latest → 200, perfecto
     // O sea: Google tenía caído el alias que la app fija, y al lado había un modelo
     // sano de la MISMA cuenta. Sin este eje, el cliente no podía subir un documento.
     for (const model of modelosAProbar(prov, opts.modelos?.[prov])) {
      // El ESFUERZO viaja por toda la cascada. Sin esto, una feature con effort alto
      // ruteada a la IA barata corría en 'minimal' apenas cambiaba de proveedor.
      const base = { system: opts.system, user: opts.user, maxTokens: opts.maxTokens, temperature: opts.temperature, feature: opts.feature, motivo: `${opts.motivo ?? ''} · fallback ${rotulo(inst)}`, provider: prov, clave: inst.clave, model, timeoutMs: opts.timeoutMs, esfuerzo: opts.esfuerzo };
      // Un reintento de la MISMA cuenta si el fallo parece transitorio (5xx/timeout):
      // clave para un workspace con UN solo proveedor y una sola key, donde no hay a
      // quién caer. Un 429 NO se reintenta si hay otra cuenta esperando: esperar
      // 1,5 s para volver a pegarle a la cuota que se acabó es tiempo tirado.
      const otraCuenta = inst !== instancias[instancias.length - 1];
      // ⚠️ CUÁNTO INSISTIR DEPENDE DE SI HAY A DÓNDE CAER, y esa es toda la diferencia.
      // Con otra cuenta o otro proveedor esperando, un reintento alcanza: seguir
      // golpeando al que falla es tiempo que el usuario mira una pantalla quieta.
      // Pero cuando este es el ÚLTIMO —un workspace con un solo proveedor y una sola
      // key, que es el caso normal de un cliente recién dado de alta— rendirse al primer
      // reintento significa perder el documento entero por un bache de 3 segundos del
      // proveedor.
      //
      // Pasó el 16/08 con un cliente esperando: Gemini devolvió 503 «high demand» y los
      // 4 documentos se cayeron; minutos después la MISMA key contestaba 200 tres de tres.
      // No era cuota, no era la key: era Google saturado y nadie atrás.
      const ultimoRecurso = !otraCuenta && prov === orden[orden.length - 1];
      const maxIntentos = ultimoRecurso ? 3 : 1;
      for (let intento = 0; intento <= maxIntentos; intento++) {
        try {
          let t = await chatCheap({ ...base, json: opts.json });
          // La capa OpenAI-compat de Gemini a veces devuelve contenido VACÍO con
          // response_format json_object (el modelo native anda; el /chat/completions no).
          // Reintentamos la MISMA cuenta SIN el flag: `validar`/parseJsonLoose de los
          // callers tolera fences/markdown igual, así que no perdemos nada.
          if (!t.trim() && opts.json) t = await chatCheap({ ...base, json: false });
          // `validar`: solo aceptamos salida que sirve (ej. JSON parseable con la forma esperada).
          // Si un modelo devuelve texto no vacío pero inútil (JSON roto), pasamos al próximo.
          if (t.trim() && (!opts.validar || opts.validar(t))) return t;
          break; // respondió (o vacío en ambos modos) pero no sirve → próxima cuenta
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          console.warn(`[ai-cheap] cascade ${rotulo(inst)} falló${intento ? ' (reintento)' : ''}: ${m}`);
          opts.erroresOut?.push(`${rotulo(inst)}: ${m}`);
          const esCuota = /\b429\b|quota|rate.?limit|resource_exhausted/i.test(m);
          // ⚠️ EL 429 QUEDA ANOTADO, no sólo logueado. El `console.warn` de arriba es
          // para depurar después; los logs de Vercel no los lee nadie y a los 60
          // minutos no existen. Sin la fila, «esta cuenta está agotada desde el
          // martes» y «hoy no se usó» se ven IGUAL desde la app: las dos son una
          // barra en cero. Best-effort y sin await bloqueante del camino feliz: esto
          // corre en el camino de error y un fallo acá no puede costar el fallback.
          if (esCuota) void anotarRebote429(prov, nroCuenta(inst), model ?? '', m);
          const transitorio = /\b(429|5\d\d)\b|timeout|abort|ETIMEDOUT|fetch failed|ECONNRESET|unavailable|overloaded|high demand/i.test(m);
          // Un modelo RETIRADO (404) no se reintenta ni un segundo: no va a volver. Se
          // pasa derecho al modelo siguiente, que es justo para lo que existe la lista.
          if (/\b404\b|no longer available|not_found/i.test(m)) break;
          if (intento < maxIntentos && transitorio && !(esCuota && otraCuenta)) {
            // Espera creciente: 1,5s · 4s · 9s. Un 503 de saturación no se arregla en el
            // mismo segundo, y volver enseguida es gastar el intento sin darle tiempo.
            await new Promise((r) => setTimeout(r, 1500 * (intento + 1) ** 2));
            continue;
          }
          break; // fallo no transitorio (o hay otra cuenta con cuota) → seguir rotando
        }
      }
     }
    }
  }
  return '';
}

/** Interpreta los errores crudos que dejó chatCheapCascade en `erroresOut` en un
 *  motivo legible — el caso más confuso es "hay key conectada pero igual no
 *  respondió": sin esto, el usuario ve el mismo mensaje genérico que si nunca
 *  hubiera conectado nada. null si no hay ninguna pista clara (falla genérica). */
/**
 * El mensaje para el usuario cuando `chatCheapCascade` devolvió ''. ÚSALO SIEMPRE:
 * es el único que sabe distinguir «no hay ninguna IA» de «hay IA y falló», y el
 * único que le muestra QUÉ contestó cada cuenta. Escribir la frase a mano en el
 * call-site es exactamente el bug que se pagó (ver lib/ia-mensajes.ts).
 *
 * `tema` va adentro de la frase: 'generar las razones', 'elegir los formatos'…
 */
export async function errorDeCascada(errores: string[], tema: string): Promise<string> {
  const hayIA = await docsIADisponible().catch(() => false);
  return mensajeIAFallo({ hayIA, motivo: motivoDeErroresCascada(errores), errores, tema });
}

// ⚠️ `motivoDeErroresCascada` SE MUDÓ a lib/ia-mensajes.ts, y no fue por prolijidad: es
// una función PURA que decide qué lee el usuario y acá adentro —con `server-only`— ningún
// test la podía importar. Lo único sin red era justo lo que le habla a la persona. Se
// re-exporta para no tocar a los que ya la importaban de este módulo.
export { motivoDeErroresCascada };

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de DOCUMENTOS / IMÁGENES (contratos, comprobantes) con IA multimodal.
// Cascada GRATIS-primero SIN Claude: Gemini (docs+imágenes, free tier) → OpenAI
// (docs+imágenes, barato). Cada uno se usa solo si tiene su key (credWs: fila del
// cliente o env del dueño). Devuelve el texto crudo del modelo (JSON string) del
// primero que funcione. Claude queda para el razonamiento fino, no para OCR.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Quien puede MIRAR una imagen o un PDF escaneado.
 *
 * ⚠️ OPENROUTER ENTRA EN EL MEDIO, Y NO ES UN LUJO: era el único paso del onboarding SIN
 * respaldo real. La lista era `[gemini, openai]`, y OpenAI es el único que COBRA — o sea
 * que un cliente con las cuatro IA gratis cargadas tenía, para visión, exactamente UNA.
 * Cuando Gemini se cae, la cara de marca no se puede analizar y el wizard se traba ahí.
 *
 * Pasó el 16/08 con el cliente probando: las dos keys de Gemini devolvían 429
 * «prepayment credits are depleted» y la pantalla no tenía a dónde caer. Medido con la key
 * del propio cliente, `minimax/minimax-m3:free` describe una imagen en 10 s.
 *
 * Groq NO está: se le pidió la lista y no tiene un solo modelo con entrada de imagen.
 */
export const VISION_CASCADE: ProvName[] = ['gemini', 'openrouter', 'openai'];

/**
 * El modelo que MIRA, por proveedor. Va aparte de `MODELO_DOCS` porque no todo modelo de
 * texto acepta imágenes: de los 19 `:free` de OpenRouter, solo 8 declaran `image` como
 * modalidad de entrada, y de esos varios devuelven 429 o piden un harness agentico.
 *
 * Se eligen PROBÁNDOLOS con una imagen de verdad, no por lo que declara el catálogo.
 */
const MODELO_VISION: Partial<Record<ProvName, string>> = {
  openrouter: process.env.OPENROUTER_VISION_MODEL || 'minimax/minimax-m3:free',
  openai: process.env.OPENAI_VISION_MODEL || 'gpt-4o',
};

// dataUrls (plural) es opcional: cuando viene, pisa a dataUrl y manda TODAS esas
// imágenes en la MISMA llamada de visión — para que el modelo sintetice entre varias
// fotos en vez de mirar solo una (bug real: la cara de marca solo analizaba la
// primera foto que le funcionaba, y una sola conclusión sobre p.ej. la vestimenta
// quedaba como si fuera válida para todas). Solo aplica al camino de imagen, no PDF.
type DocOpts = { dataUrl: string; dataUrls?: string[]; isPdf: boolean; nombreArchivo: string; prompt: string; json?: boolean; feature?: string; motivo?: string; timeoutMs?: number };

export async function leerDocumentoIA(opts: DocOpts): Promise<{ text: string; provider: ProvName }> {
  const errores: string[] = [];
  const sinKey: ProvName[] = [];
  for (const prov of VISION_CASCADE) {
    // Todas las CUENTAS del proveedor: leer un contrato con la key 1 agotada y
    // rendirse teniendo la key 2 cargada era perder el documento por nada.
    const instancias = await provsDe(prov);
    if (!instancias.length) { sinKey.push(prov); continue; }
    for (const inst of instancias) {
      // MISMO tercer eje que en chatCheapCascade: si el modelo está caído (503) o
      // retirado (404), rotar cuentas no sirve — todas pegan contra el mismo modelo
      // muerto. Acá pegó fuerte: el paso de la cara de marca es VISIÓN, y el free tier
      // de `gemini-flash-latest` son 20 requests, que un onboarding se come solo.
      for (const model of modelosAProbar(prov, undefined)) {
        try {
          const text = prov === 'gemini'
            ? await leerConGemini(inst.key, opts, nroCuenta(inst), model)
            : await leerConOpenAI(inst.key, opts, nroCuenta(inst), prov);
          if (text.trim()) return { text, provider: prov };
          errores.push(`${rotulo(inst)}: respuesta vacía`);
        } catch (e) {
          errores.push(`${rotulo(inst)}: ${e instanceof Error ? e.message : String(e)}`);
        }
        // OpenAI no tiene lista de respaldo: no tiene sentido repetir con el mismo modelo.
        if (prov !== 'gemini') break;
      }
    }
  }
  if (errores.length) throw new Error(`No se pudo leer el documento con ninguna IA. ${errores.join(' · ')}`);
  const nombres = sinKey.map((p) => (p === 'gemini' ? 'Gemini (gratis)' : 'OpenAI')).join(' o ');
  throw new Error(`No hay ninguna IA con visión configurada. Carga una API key de ${nombres || 'Gemini u OpenAI'} en Integraciones.`);
}

/**
 * Visión por endpoint OpenAI-compatible. Sirve para CUALQUIER proveedor con ese contrato
 * — OpenAI y OpenRouter hoy — porque el cuerpo es el mismo; lo único que cambia es a dónde
 * se apunta y con qué modelo. Estaba clavado a `api.openai.com`, y eso era lo que impedía
 * usar el respaldo gratis que ya estaba cargado.
 */
async function leerConOpenAI(key: string, o: DocOpts, cuenta = 1, prov: ProvName = 'openai'): Promise<string> {
  const cfg = cfgDe(prov);
  const model = MODELO_VISION[prov] ?? cfg.chatModel;
  const imagenes = o.dataUrls && o.dataUrls.length ? o.dataUrls : [o.dataUrl];
  const content = o.isPdf
    ? [{ type: 'text', text: o.prompt }, { type: 'file', file: { filename: o.nombreArchivo.toLowerCase().endsWith('.pdf') ? o.nombreArchivo : 'contrato.pdf', file_data: o.dataUrl } }]
    : [{ type: 'text', text: o.prompt }, ...imagenes.map((u) => ({ type: 'image_url', image_url: { url: u, detail: 'high' } }))];
  const res = await fetch(cfg.base + '/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, ...(o.json ? { response_format: { type: 'json_object' } } : {}), messages: [{ role: 'user', content }] }),
    cache: 'no-store',
    signal: AbortSignal.timeout(o.timeoutMs ?? 100000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j?.error?.message || `HTTP ${res.status}`);
  void recordUsage(o.feature || 'leer-documento', model, j.usage, o.motivo, prov, cuenta);
  return j.choices?.[0]?.message?.content ?? '';
}

async function leerConGemini(key: string, o: DocOpts, cuenta = 1, modelPedido?: string): Promise<string> {
  // Endpoint NATIVO (no el OpenAI-compat): maneja PDF e imágenes vía inline_data.
  // `modelPedido` lo pone la rotación de modelos de leerDocumentoIA; sin él, el de siempre.
  const model = modelPedido || process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const imagenes = o.dataUrls && o.dataUrls.length ? o.dataUrls : [o.dataUrl];
  const partesImagen = imagenes.map((u) => {
    const m = u.match(/^data:([^;]+);base64,([\s\S]*)$/);
    return { inline_data: { mime_type: m?.[1] || (o.isPdf ? 'application/pdf' : 'image/jpeg'), data: m?.[2] ?? '' } };
  });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: o.prompt }, ...partesImagen] }],
      generationConfig: { temperature: 0, ...(o.json ? { response_mime_type: 'application/json' } : {}) },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(o.timeoutMs ?? 100000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j?.error?.message || `HTTP ${res.status}`);
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
  const um = j.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;
  void recordUsage(o.feature || 'leer-documento', model, um ? { prompt_tokens: um.promptTokenCount, completion_tokens: um.candidatesTokenCount, total_tokens: um.totalTokenCount } : undefined, o.motivo, 'gemini', cuenta);
  return text;
}

// Bloques (tool_use/tool_result/text) → texto plano. El historial del doer ya viene
// como texto; esto es defensivo por si entra un Block[].
function bloqueATexto(content: RichMsg['content']): string {
  if (typeof content === 'string') return content;
  return content.filter((b) => b.type === 'text').map((b) => String((b as { text?: string }).text ?? '')).join('\n').trim();
}

// Gemini (function-calling) RECHAZA varios keywords de JSON Schema que Claude y
// OpenAI aceptan sin drama (additionalProperties, propertyNames, $schema/$ref/$defs,
// default, title, format, const, examples, exclusiveMin/Max…) → 400 INVALID_ARGUMENT
// y toda la llamada falla. Los limpiamos recursivamente SOLO para Gemini (los otros
// proveedores los toleran, no les tocamos nada). Ref: ai.google.dev/gemini-api/docs/openai.
const GEMINI_SCHEMA_STRIP = new Set(['additionalProperties', 'propertyNames', '$schema', '$defs', '$ref', '$id', '$comment', 'default', 'examples', 'title', 'const', 'format', 'exclusiveMaximum', 'exclusiveMinimum']);
function sanitizarSchemaGemini(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizarSchemaGemini);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (GEMINI_SCHEMA_STRIP.has(k)) continue;
      out[k] = sanitizarSchemaGemini(v);
    }
    return out;
  }
  return node;
}

export type CheapToolsResult = ToolsResult & { toolsUsados: number };

/**
 * Como chatClaudeTools pero por Groq/OpenAI (function-calling OpenAI-compatible). Para
 * el doer: los turnos de tool-use (cargar tareas, leer un dato, confirmar) tienen INPUT
 * enorme (tools + historial + resultados) y en Claude eso cuesta; en Groq el input es
 * ~gratis. Menos fiable que Claude en orquestaciones largas → el caller DEBE mirar
 * `toolsUsados`: si el turno pedía una acción y Groq no llamó ninguna tool, hacer
 * fallback a Claude (no dejar que "describa" en vez de ejecutar).
 */
export async function chatCheapTools(
  system: string,
  messages: RichMsg[],
  tools: ToolDef[],
  runTool: ToolRunner,
  opts: {
    maxSteps?: number; maxTokens?: number; feature?: string; motivo?: string;
    provider?: ProvName; model?: string;
    /** De qué workspace sale la KEY. Solo lo usa la red de plataforma; sin esto,
     *  la del workspace en curso, que es el BYOK de siempre. */
    wsKey?: number;
    /** Techo de espera por request. Default 45 s, que está bien para un cron. En un
     *  chat en vivo hay que bajarlo: un proveedor colgado se come el turno entero y
     *  deja al cliente esperando por alguien que no va a contestar. */
    timeoutMs?: number;
    /** Cuál CUENTA del proveedor (GEMINI_API_KEY vs _2). La pone quien rota. */
    clave?: string;
    /**
     * `'required'` obliga al modelo a llamar UNA herramienta en el primer paso.
     * Se libera solo (paso 1 en adelante vuelve a 'auto'), porque forzarlo en todos
     * los pasos es un bucle infinito: nunca podría contestar.
     *
     * Para qué: hay turnos donde la acción ya está decidida por el ROUTER (cargar
     * tareas al plan), y ahí `'auto'` es pedirle permiso al modelo para hacer lo que
     * ya se resolvió. El hermano de Claude tiene esto desde siempre (`toolChoice`);
     * acá faltaba, y el agujero se pagó: el modelo contestaba en prosa y el borrador
     * no se creaba nunca.
     */
    toolChoicePrimerPaso?: 'required';
  } = {},
): Promise<CheapToolsResult> {
  const p = await proveedor(opts.provider, opts.clave, opts.wsKey);
  if (!p) throw new Error('Sin proveedor de IA barata (falta GROQ_API_KEY u OPENAI_API_KEY).');
  const model = opts.model || p.chatModel;
  const esGemini = p.nombre === 'gemini';
  const oaiTools = tools.map((t) => {
    const fn: Record<string, unknown> = { name: t.name, description: t.description };
    let params: unknown = t.input_schema;
    if (esGemini) {
      params = sanitizarSchemaGemini(t.input_schema);
      // Gemini RECHAZA un OBJECT con `properties` vacío (400): las tools SIN parámetros
      // (ver_plan, estado_experimentos, ver_funnel…) tienen que ir SIN `parameters`.
      const props = (params as { properties?: Record<string, unknown> } | null)?.properties;
      if (!props || Object.keys(props).length === 0) params = undefined;
    }
    if (params !== undefined) fn.parameters = params as Record<string, unknown>;
    return { type: 'function', function: fn };
  });
  const msgs: Array<Record<string, unknown>> = [{ role: 'system', content: system }];
  for (const m of messages) msgs.push({ role: m.role, content: bloqueATexto(m.content) });

  const maxSteps = opts.maxSteps ?? 6;
  let toolsUsados = 0;
  /** Lo que el modelo PUEDE llamar en este turno. Ver la guarda de las fantasmas. */
  const permitidas = new Set(tools.map((t) => t.name));
  let rechazadas = 0;
  for (let step = 0; step < maxSteps; step++) {
    // ⚠️ EL REINTENTO QUE FALTABA ACÁ, y que el módulo ya tenía escrito para la
    // otra mitad (`chatCheapCascade`). Este camino —el del tool-use, o sea el que
    // usa MaKo en WhatsApp— pegaba UNA vez y tiraba: un 503 de saturación mataba
    // el turno entero.
    //
    // EL CASO (2026-08-25, 02:45 UTC). Un cliente escribió y MaKo le contestó con
    // un error. En `anthropic_usage` no hay NI UNA llamada de ese minuto, y 74
    // segundos después la misma consulta funcionó perfecto. Gemini había tenido un
    // bache. Ese cliente tiene UNA sola key cargada, así que la cascada de cinco
    // proveedores es en los hechos un solo intento: si ese falla, no hay red.
    //
    // ⚠️ SOLO MIENTRAS NO SE HAYA TOCADO NADA. Es la regla que el propio módulo ya
    // dice para la cascada: «reintentar después de una acción a medias es
    // duplicarla». Un reintento después de que una tool creó un borrador crea DOS.
    // Por eso la ventana es `toolsUsados === 0`: ahí no se escribió nada todavía, y
    // ahí es justo donde caen los 429 y los 503 — en el primer request.
    let res: Response | null = null;
    let data: any = {};
    for (let intento = 0; ; intento++) {
      res = await fetch(`${p.base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, messages: msgs,
          // ⚠️ CON LA LISTA VACÍA NO VIAJAN NI `tools` NI `tool_choice`.
          //
          // Medido el 01/10/2026 contra Groq con `openai/gpt-oss-20b`: un body con
          // `tools: []` hace que el proveedor resuelva `tool_choice` a `none`, y si el
          // modelo igual emite una llamada contesta **HTTP 400 «Tool choice is none, but
          // model called a tool»**. Mandar un array vacío no es «no mandar nada»: es
          // pedir explícitamente que no use ninguna, que es otra cosa.
          //
          // ⚠️ Y ESTO SOLO NO ALCANZA: con el preámbulo del doer el mismo pedido revienta
          // igual SIN el campo (2/2 medido). Lo que rompe de fondo es el PROMPT que ordena
          // usar herramientas que no se mandaron — eso se arregla en el caller
          // (ver `DOER_WA_TOOLS` en lib/mako-doer-in.ts). Esta guarda cierra la mitad que
          // es del transporte; aquélla, la del contenido.
          ...(oaiTools.length
            ? { tools: oaiTools, tool_choice: step === 0 && opts.toolChoicePrimerPaso ? opts.toolChoicePrimerPaso : 'auto' }
            : {}),
          max_tokens: opts.maxTokens ?? 1400, temperature: 0.2,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(opts.timeoutMs ?? 45000),
      });
      data = await res.json().catch(() => ({}));
      const err = !res.ok || (data as { error?: unknown }).error;
      if (!err) break;
      const detalle = String((data as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`);
      // ⚠️ EL 429 NO SE REINTENTA, y esa distinción es la que hace que esto sirva.
      // Un 429 es la CUOTA de esa cuenta: volver a pegarle en un segundo es pedirle
      // otra vez a quien ya dijo que no. Quien llama rota a otra cuenta o a otro
      // proveedor, que es la respuesta correcta — lo dice el propio módulo más
      // arriba. Lo que SÍ se reintenta es la SATURACIÓN (5xx, timeout), que es un
      // bache de segundos: es exactamente lo que mató el turno del 25/8, con la
      // misma consulta funcionando perfecto 74 s después.
      //
      // Un 404 (modelo retirado) o un 401 (key mala) tampoco: no van a volver.
      const saturacion = /\b5\d\d\b|timeout|abort|ETIMEDOUT|fetch failed|ECONNRESET|unavailable|overloaded|high demand/i.test(detalle)
        || (res.status >= 500 && res.status <= 599);
      // UN solo reintento, y corto: del otro lado hay alguien mirando el chat. Si
      // con 1,2 s no se destrabó, rotar es mejor que seguir esperando.
      if (!saturacion || toolsUsados > 0 || intento >= 1) break;
      console.warn(`[ai-cheap] chatCheapTools(${rotulo(p)}) ${detalle} → reintento`);
      await new Promise((r) => setTimeout(r, 1200));
    }
    if (!res!.ok || (data as { error?: unknown }).error) {
      const extra = p.nombre === 'gemini' && res!.status === 404 ? await modelosDisponibles(p) : '';
      throw new Error(`chatCheapTools(${rotulo(p)}): ${(data as { error?: { message?: string } })?.error?.message || `HTTP ${res!.status}`}${extra}`);
    }
    void recordUsage(opts.feature || 'ia-barata-tools', model, data.usage, opts.motivo, p.nombre, nroCuenta(p));
    const msg = data.choices?.[0]?.message as { content?: string; tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }> } | undefined;
    if (!msg) break;
    msgs.push(msg as Record<string, unknown>);
    const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    if (!calls.length) {
      const txt = (msg.content || '').trim();
      /**
       * ⚠️ UN 200 CON EL CONTENIDO VACÍO NO ES UNA RESPUESTA, Y TIENE QUE DECIRSE DISTINTO.
       *
       * Devolvía el centinela '(sin respuesta)' con `stopReason: 'stop'`, o sea con la
       * MISMA forma que usa el caller para descartar (`r.text.startsWith('(')`) — así que
       * un modelo mudo y un modelo que empieza una frase con un paréntesis son
       * indistinguibles río abajo, y el motivo que se escribe en la lista de errores
       * decía «fin=stop», que es exactamente lo contrario de lo que pasó.
       *
       * Medido el 01/10/2026: la key del ws13 contestó 200 con el content vacío y el
       * `finish_reason` REAL de Gemini era `tool_calls` (pidió una tool que no se le
       * declaró). Ese dato lo estábamos tirando: ahora viaja.
       */
      const fin = String((data as { choices?: Array<{ finish_reason?: string }> }).choices?.[0]?.finish_reason || 'stop');
      if (!txt) return { text: '(sin respuesta)', steps: step + 1, stopReason: `vacio:${fin}`, toolsUsados };
      return { text: txt, steps: step + 1, stopReason: fin, toolsUsados };
    }
    /**
     * ⚠️ EL CONTRATO DE TOOLS SE APLICABA AL DECLARAR Y NO AL EJECUTAR.
     *
     * Medido el 01/10/2026: Gemini, con `tools: []`, devolvió un `tool_calls` pidiendo
     * `metricas_negocio` — un nombre que sólo aparecía en el TEXTO del system. Y el
     * código la ejecutaba igual: acá no se miraba la lista. O sea que el recorte por
     * intención (`toolsParaIntencion`) era una sugerencia, no un contrato — y el caso
     * caro no es una lectura de más: es `proponer_tareas_plan`, que crea un borrador de
     * verdad sobre un saludo. Ése es exactamente el bug que ese recorte vino a cerrar.
     *
     * ⚠️ Y LA GUARDA VIENE CON UN CORTE. Devolverle el error al modelo y seguir deja que
     * lo reintente: con la lista vacía eso quema los 8 pasos y termina más lento y más
     * caro que antes. Al SEGUNDO rechazo se sale del loop con lo que haya.
     */
    const fantasmas = calls.filter((c) => !permitidas.has(c.function?.name || ''));
    if (fantasmas.length) {
      rechazadas += fantasmas.length;
      console.warn(`[ai-cheap] chatCheapTools(${rotulo(p)}) llamó ${fantasmas.map((c) => c.function?.name).join(', ')} sin que se le declarara (${rechazadas})`);
      for (const c of fantasmas) {
        msgs.push({ role: 'tool', tool_call_id: c.id, content: `No existe la herramienta "${c.function?.name}" en este turno. Contesta con lo que ya sabes.` });
      }
      if (rechazadas >= 2) break;
      if (fantasmas.length === calls.length) continue;
    }
    for (const c of calls.filter((x) => permitidas.has(x.function?.name || ''))) {
      toolsUsados++;
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(c.function?.arguments || '{}'); } catch { /* args mal formados → tool con {} */ }
      let out: string;
      try { const r = await runTool(c.function?.name || '', input); out = typeof r === 'string' ? r : r.content; }
      catch (e) { out = e instanceof Error ? e.message : String(e); }
      msgs.push({ role: 'tool', tool_call_id: c.id, content: out.slice(0, 12000) });
    }
  }
  /**
   * ⚠️ AGOTAR LOS PASOS NO ES UN FALLO: EL MODELO YA TRABAJÓ Y SÓLO FALTA QUE ESCRIBA.
   *
   * ESTA ES LA CAUSA REAL del incidente del 30/09/2026, el que el dueño reportó como
   * «¿realmente se acabó la cuota de 4 cuentas con un par de mensajes?». No se había
   * acabado nada: Gemini contestó OCHO veces HTTP 200 en nueve segundos —una fila en
   * `anthropic_usage` ES un 200, porque `recordUsage` corre después del `throw`—, llamó
   * sus herramientas, y se quedó sin pasos antes de redactar la respuesta. Lo único que
   * volvía de acá era este centinela, el doer lo descartaba, y el veredicto terminaba
   * juzgando con los errores de los proveedores que no importaban.
   *
   * Un pedido más SIN herramientas lo cierra: todo el trabajo ya está en `msgs` (las
   * tool_calls y sus resultados), es el request más barato del turno, y es lo único que
   * el modelo no pudo hacer por su cuenta. Sin `tools` no tiene a dónde volver a
   * llamar, así que contesta en texto.
   *
   * Se manda SIN `tools` en vez de con `tool_choice: 'none'` a propósito: ese valor lo
   * aceptan OpenAI y Groq y no está garantizado en la capa compatible de Gemini, que es
   * justo el proveedor del caso. Y va envuelto: si ESTE pedido falla, se devuelve el
   * centinela de siempre y el caller decide — nunca se pierde el desenlace.
   */
  const cierre = await cerrarSinTools(p, model, msgs, opts).catch((e) => {
    console.warn(`[ai-cheap] chatCheapTools(${rotulo(p)}) no pudo cerrar sin tools: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  });
  if (cierre) {
    console.info(`[ai-cheap] chatCheapTools(${rotulo(p)}) agotó ${maxSteps} pasos y cerró sin tools (${cierre.length} chars, ${toolsUsados} tools)`);
    return { text: cierre, steps: maxSteps, stopReason: 'max_steps_cerrado', toolsUsados };
  }
  return { text: '(se alcanzó el máximo de pasos)', steps: maxSteps, stopReason: 'max_steps', toolsUsados };
}

/**
 * El último pedido de un turno que se quedó sin pasos: el MISMO hilo, sin herramientas.
 *
 * Devuelve el texto o null. No reintenta —del otro lado hay alguien mirando el chat— y
 * registra el gasto como el resto, con la feature marcada para poder medir cuántos
 * turnos terminan así.
 */
async function cerrarSinTools(
  p: Prov,
  model: string,
  msgs: Array<Record<string, unknown>>,
  opts: { maxTokens?: number; feature?: string; motivo?: string; timeoutMs?: number },
): Promise<string | null> {
  const res = await fetch(`${p.base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: msgs, max_tokens: opts.maxTokens ?? 1400, temperature: 0.2 }),
    cache: 'no-store',
    signal: AbortSignal.timeout(opts.timeoutMs ?? 45000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as { error?: unknown }).error) {
    throw new Error(String((data as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`));
  }
  void recordUsage(`${opts.feature || 'ia-barata-tools'}-cierre`, model, (data as { usage?: unknown }).usage, opts.motivo, p.nombre, nroCuenta(p));
  const txt = String((data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content || '').trim();
  return txt || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// La cascada del TOOL-USE — el agujero por donde se pagaba Claude a la primera
// ─────────────────────────────────────────────────────────────────────────────
// `chatCheapCascade` recorría los seis proveedores gratis antes de pagar, pero el
// camino con herramientas no tenía nada de eso: `chatClaudeTools` probaba UN
// proveedor y, ante cualquier fallo, se iba a Claude Sonnet. O sea el mismo bug que
// AGENTS.md documenta como cerrado —«Claude es el ÚLTIMO recurso, no el segundo»—
// vivo en la otra mitad del sistema, y con el error más común de todos: el 429 de
// Gemini. Todos estos proveedores hacen function-calling.
export const CASCADA_TOOLS: ProvName[] = ['gemini', 'groq', 'mistral', 'openrouter', 'openai'];

/**
 * Corre el loop de herramientas por la cascada gratis: cada CUENTA de cada
 * proveedor, en orden de cuota. `null` = ninguno pudo (el caller decide si paga
 * Claude o avisa que falló).
 *
 * ⚠️ REGLA DURA: si el proveedor que falló YA EJECUTÓ una herramienta, la cascada se
 * corta y el error se relanza. Las tools del doer ESCRIBEN (crean un borrador, mandan
 * un mensaje): reintentar con otro modelo después de una acción a medias es duplicarla,
 * y un duplicado silencioso es peor que un error visible. Rotar es seguro solo mientras
 * no se tocó nada — que es donde caen los 429, en el primer request.
 */
export async function chatCheapToolsCascade(
  system: string,
  messages: RichMsg[],
  tools: ToolDef[],
  runTool: ToolRunner,
  opts: {
    maxSteps?: number; maxTokens?: number; feature?: string; motivo?: string;
    provs?: ProvName[]; modelos?: Partial<Record<ProvName, string>>;
    toolChoicePrimerPaso?: 'required'; erroresOut?: string[];
  } = {},
): Promise<CheapToolsResult | null> {
  const pedidos = opts.provs ?? CASCADA_TOOLS;
  const orden = await ordenarPorCuota(pedidos.map(String)).catch(() => pedidos.map(String));
  for (const prov of orden as ProvName[]) {
    for (const inst of await provsDe(prov)) {
      let ejecutó = false;
      const runMarcado: ToolRunner = async (nombre, input) => { ejecutó = true; return runTool(nombre, input); };
      try {
        return await chatCheapTools(system, messages, tools, runMarcado, {
          maxSteps: opts.maxSteps, maxTokens: opts.maxTokens, feature: opts.feature,
          motivo: `${opts.motivo ?? ''} · ${rotulo(inst)}`,
          provider: prov, clave: inst.clave, model: opts.modelos?.[prov],
          toolChoicePrimerPaso: opts.toolChoicePrimerPaso,
        });
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        opts.erroresOut?.push(`${rotulo(inst)}: ${m}`);
        console.warn(`[ai-cheap] tools ${rotulo(inst)} falló: ${m}`);
        if (ejecutó) throw e; // ya tocó datos: no se reintenta con otro (ver arriba)
      }
    }
  }
  return null;
}

/** Igual que chatCheap pero parsea el JSON (json:true forzado). Lanza si no parsea. */
export async function chatCheapJson<T = unknown>(opts: { system: string; user: string; maxTokens?: number }): Promise<T> {
  const raw = await chatCheap({ ...opts, json: true });
  try { return JSON.parse(raw) as T; }
  catch { const m = raw.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]) as T; throw new Error('chatCheapJson: respuesta no es JSON'); }
}

const EXT_POR_MIME = (mime: string): string =>
  mime.includes('ogg') || mime.includes('opus') ? 'ogg'
    : mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac') ? 'm4a'
    : mime.includes('mpeg') || mime.includes('mp3') ? 'mp3'
    : mime.includes('wav') ? 'wav'
    : mime.includes('webm') ? 'webm' : 'ogg';

export type SttOpts = { language?: string; prompt?: string; feature?: string; motivo?: string };

// Gemini manda el audio DENTRO del request (inline_data), así que hay un techo de
// tamaño. Una nota de voz de WhatsApp pesa kilobytes; un audio largo se va a Whisper.
const MAX_INLINE_GEMINI = 14 * 1024 * 1024;

/** Whisper por endpoint OpenAI-compatible (Groq / OpenAI). Cobra por segundos de audio. */
async function sttWhisper(p: Prov, buf: Buffer, mime: string, opts: SttOpts): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buf)], { type: mime || 'audio/ogg' }), `nota.${EXT_POR_MIME(mime || '')}`);
  form.append('model', p.sttModel);
  form.append('language', opts.language || 'es');
  form.append('response_format', 'verbose_json'); // trae `duration` → costo real
  if (opts.prompt) form.append('prompt', opts.prompt);
  const res = await fetch(`${p.base}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.key}` },
    body: form,
    cache: 'no-store',
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`HTTP ${res.status}: ${data?.error?.message || 'sin detalle'}`);
  void recordSttUsage(opts.feature || 'stt-nota-voz', p.sttModel, Number(data.duration ?? 0), opts.motivo, p.nombre, nroCuenta(p));
  return (data.text ?? '').trim();
}

/**
 * Gemini ESCUCHA el audio (multimodal nativo): no hay /audio/transcriptions, va por
 * generateContent con el audio inline. Por eso no entra por la ruta Whisper de arriba
 * y necesita su propia llamada. Gratis en su free tier.
 */
async function sttGemini(p: Prov, base64: string, buf: Buffer, mime: string, opts: SttOpts): Promise<string> {
  if (buf.length > MAX_INLINE_GEMINI) throw new Error('audio demasiado grande para mandarlo inline');
  const model = process.env.GEMINI_STT_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest';
  // p.base es el shim OpenAI-compatible (…/v1beta/openai); la API nativa cuelga del
  // mismo host sin ese sufijo.
  const base = p.base.replace(/\/openai\/?$/, '');
  const idioma = (opts.language || 'es') === 'es' ? 'español' : (opts.language || 'es');
  const instruccion = [
    `Transcribe este audio en ${idioma}.`,
    'Devuelve SOLO la transcripción literal de lo que se dice: sin comillas, sin timestamps, sin nombres de hablante, sin comentarios tuyos y sin describir el audio.',
    opts.prompt ? `Contexto (nombres propios y jerga que pueden aparecer): ${opts.prompt}` : '',
    'Si no se entiende nada o no hay voz, devuelve exactamente: (vacío)',
  ].filter(Boolean).join(' ');
  const res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': p.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: instruccion }, { inline_data: { mime_type: (mime || 'audio/ogg').split(';')[0].trim(), data: base64 } }] }],
      // ⚠️ ESTE TECHO CORTA LA TRANSCRIPCIÓN, Y ANTES LO HACÍA EN SILENCIO. Estaba en
      // 2.048, que a ~0,75 palabras por token son ~1.500 palabras: unos DIEZ MINUTOS de
      // habla. Alcanza de sobra para una nota de voz de WhatsApp —que es para lo que se
      // escribió— pero `transcribirAudio` también la usa `lib/archivo-a-texto.ts`, o sea
      // el importador de archivos al plan, donde entra un .mp3 o un .m4a de la duración
      // que sea. Una grabación de 40 minutos volvía con los primeros 10 y MaKo armaba
      // tareas con un cuarto de la reunión, sin que nada lo dijera.
      // Medido: una clase de 52 minutos necesita 9.722 tokens de salida, así que 8.192
      // tampoco alcanzaba. Se paga por lo que sale, no por el techo, así que ponerlo alto
      // no cuesta nada — y el que de verdad cierra el agujero es el chequeo de abajo.
      generationConfig: { temperature: 0, maxOutputTokens: 65536 },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`HTTP ${res.status}: ${data?.error?.message || 'sin detalle'}`);
  // ⚠️ Y EL TECHO NUEVO TAMPOCO ALCANZA SIEMPRE: 8.192 tokens son ~40 minutos. Lo que
  // cierra el agujero no es el número, es MIRAR SI SE CORTÓ. `finishReason` lo dice, y
  // no había un solo chequeo de ese campo en todo el repo.
  //
  // Se lanza en vez de devolver el texto a medias, y eso es a propósito: hace caer la
  // cascada a Whisper (Groq/OpenAI), que no tiene techo de salida y devuelve el audio
  // entero. Media transcripción se lee igual que una completa —bien escrita, bien
  // puntuada, termina antes— y nadie la revisa. Es la misma familia que se cerró en el
  // pipeline de cursos: «decodifica» no es «está completo».
  const fin = data.candidates?.[0]?.finishReason;
  if (fin && fin !== 'STOP') throw new Error(`la transcripción se cortó (finishReason=${fin}) — la mando al que sigue`);
  const partes = (data.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string }>;
  const texto = partes.map((x) => x.text ?? '').join('').trim();
  const u = data.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;
  void recordUsage(opts.feature || 'stt-nota-voz', model,
    { prompt_tokens: u?.promptTokenCount ?? 0, completion_tokens: u?.candidatesTokenCount ?? 0, total_tokens: u?.totalTokenCount ?? 0 },
    opts.motivo, 'gemini', nroCuenta(p));
  return texto === '(vacío)' ? '' : texto;
}

/** Fallos que valen un reintento del MISMO proveedor antes de pasar al siguiente. */
const esTransitorio = (msg: string): boolean => /HTTP (429|5\d\d)|timeout|aborted|fetch failed|ECONN/i.test(msg);

/**
 * Transcribe audio (base64) a texto. Para notas de voz de WhatsApp (ogg/opus).
 * Fuerza español por default (evita auto-detección errónea en clips cortos).
 *
 * CASCADA REAL (Gemini → Groq → OpenAI): antes elegía UN proveedor por tener la key
 * cargada, y si ese fallaba —cuota agotada, 429— la nota de voz se perdía en silencio
 * aunque hubiera otro disponible. Ahora se prueba uno por uno, con un reintento si el
 * error parece pasajero, y solo lanza si NINGUNO pudo escuchar el audio.
 */
export async function transcribirAudio(base64: string, mime: string, opts?: SttOpts): Promise<string> {
  const o = opts ?? {};
  const buf = Buffer.from(base64, 'base64');
  if (!buf.length) return '';
  // Proactivo: los que ya quemaron su cuota de hoy van al final (mismo criterio que el chat).
  const orden = await ordenarPorCuota(CASCADA_STT.map(String)).catch(() => CASCADA_STT.map(String));

  const errores: string[] = [];
  let alguienEscuchó = false; // respondió OK pero sin texto → el audio está vacío, no falló nada
  for (const nombre of orden as ProvName[]) {
    // Igual que el chat: todas las CUENTAS de este proveedor antes de saltar al
    // siguiente. Una nota de voz que rebota por cuota en la key 1 de Gemini la
    // escucha la key 2, en vez de irse a Whisper (o de perderse).
    for (const p of await provsDe(nombre)) {
      if (nombre !== 'gemini' && !p.sttModel) continue; // proveedor de chat sin Whisper
      for (let intento = 0; intento <= 1; intento++) {
        try {
          const texto = nombre === 'gemini'
            ? await sttGemini(p, base64, buf, mime, o)
            : await sttWhisper(p, buf, mime, o);
          alguienEscuchó = true;
          // El nombre de la marca se corrige ACÁ, que es por donde entra mal: Whisper
          // escucha "MaKo" y escribe «Maco», esa cadena termina siendo el TÍTULO de una
          // tarea y desde ahí el Perro la repite en su razón y en el deadline. Corregirlo
          // después es perseguir el texto por diez lugares; en la puerta de entrada es
          // una línea. Ver `corregirMarca` en lib/mako-gramatica.ts.
          if (texto) return corregirMarca(texto);
          break; // respondió vacío: no insistas con el mismo, probá el próximo
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errores.push(`${rotulo(p)}: ${msg}`);
          console.error(`[stt] ${rotulo(p)} falló: ${msg}`);
          if (intento === 0 && esTransitorio(msg)) continue; // un reintento y listo
          break;
        }
      }
    }
  }
  if (alguienEscuchó) return ''; // el audio no traía voz entendible
  throw new Error(errores.length ? `transcribirAudio — ninguna IA pudo: ${errores.join(' | ')}` : 'Sin proveedor de STT (falta GEMINI_API_KEY, GROQ_API_KEY u OPENAI_API_KEY).');
}
