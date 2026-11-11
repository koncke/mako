// =============================================================================
// anthropic — cliente de Claude (Messages API) con extended thinking
// =============================================================================
// MaKo = analista. Siempre el modelo más capaz y con el máximo "esfuerzo"
// (extended thinking con budget alto). La key va en ANTHROPIC_API_KEY.

import { exigirPermisoIa } from '@/lib/ia-permiso';
import 'server-only';
import { recordUsage, type UsageInfo } from './anthropic-usage';
import { credWs, credDelCliente, credWsEstricta, wsDelEntorno } from './credenciales';
import {
  permisoDeGasto, evaluarClaveDelNegocio, MOTIVO_CLAVE_DEL_NEGOCIO, MOTIVO_CREDITO_SU_CLAVE, FEATURES_DEL_PLAN,
  evaluarCreditoDeLaPlataforma, CLAVES_CREDITO_PLATAFORMA, CREDITO_HABILITADO_PARA, MOTIVO_CREDITO_PLATAFORMA, type PermisoClaude, type PermisoCredito,
  type PermisoClaveDelNegocio, CLAVE_MODELO_SU_CLAUDE, modeloDeSuClaude, puedeUsarUnaCuentaDelCredito, queHacerSiFallaElCredito, type UsoDelCredito,
} from './veto-claude';
import { CLAVES_CREDITO_DE_LOS_GRUPOS } from './credito-api';
import type { ProvName } from './ai-cheap';
import { PROVS_SU_IA, conD6bDelPedido, pasaPorLaPuerta, planPuedePagarConSuClave, soloSuIA } from './solo-su-ia';

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

/** ¿Esta clave es una de la plataforma? `null`: no se pudieron leer (y entonces no se sabe de quién es). */
async function esClaveAnthropicDeLaPlataforma(key: string): Promise<boolean | null> {
  const k = key.trim();
  if (!k) return false;
  if (k === process.env.ANTHROPIC_API_KEY?.trim()) return true;
  const deLaPlataforma = await clavesAnthropicDeLaPlataforma().catch(() => null);
  if (!deLaPlataforma) return null;
  return deLaPlataforma.some((x) => typeof x === 'string' && x.trim() !== '' && x.trim() === k);
}

/**
 * De quién es el gasto de la clave del negocio, PRIMERO en el motivo: lib/costos-ia.ts lo saca del de MaKo. Si su clave es el
 * crédito de Max de la plataforma (el ws10, `esCredito`), es del CRÉDITO: el panel lo muestra aparte, no como del negocio
 * (revisión del lote 2 de IA: si no, ese gasto no se veía en ningún lado).
 */
// El crédito de los GRUPOS lleva su cuenta, como `conCreditoDeLaPlataforma`: «(su clave es el crédito)» no trae el número, y
// `creditoQuePago` (lib/credito-api.ts) lo mandaba a la cuenta 1 (28/10/2026).
const marcaDelGasto = (permiso: PermisoClaveDelNegocio): string =>
  permiso.cuentaDelCredito ? `${MOTIVO_CREDITO_PLATAFORMA} (cuenta ${permiso.cuentaDelCredito})`
    : permiso.esCredito ? MOTIVO_CREDITO_SU_CLAVE : MOTIVO_CLAVE_DEL_NEGOCIO;

/**
 * ¿El pedido es del ESPACIO DE LA PLATAFORMA (el super admin, el ws 9)? Se calcula acá y sólo acá: el workspace en curso contra
 * `wsSuperAdmin()`. Si algo no se puede leer, o no hay workspace (un cron sin cookie resuelve al ws1), NO es la plataforma.
 * ⚠️ Nunca contra `OWNER_WS`: el ws1 es Mauricio, un cliente. Lo prueba rompiéndolo tests/credito-plataforma-frontera.test.ts.
 */
async function esElEspacioDeLaPlataforma(): Promise<boolean> {
  try {
    const { getWorkspaceActual, wsSuperAdmin } = await import('@/lib/workspace');
    const actual = await getWorkspaceActual();
    return actual != null && actual === (await wsSuperAdmin());
  } catch { return false; }
}

/** El workspace en curso, para la fila de gasto del crédito: el negocio que lo usó (sin él, `recordUsage` lo mandaba al ws 9). */
async function wsDelPedido(): Promise<number | undefined> {
  try {
    const { getWorkspaceActual } = await import('@/lib/workspace');
    return (await getWorkspaceActual()) ?? undefined;
  } catch { return undefined; }
}

/**
 * Las cuentas del crédito que puede probar ESTE pedido, en orden (lib/credito-negocio.ts → `cuentasDelCredito`), o []. Lo usan la
 * cascada de texto, la de herramientas y la lectura de imágenes del espacio de MaKo (11/11/2026). Sólo en la plataforma, salvo
 * `tambienLosGrupos` (las fotos y los PDF de un grupo de WhatsApp, en cualquier negocio). La puerta 2 lo vuelve a mirar igual.
 */
export async function cuentasDelCreditoParaElPedido(feature: string | undefined, o: { tambienLosGrupos?: boolean } = {}): Promise<string[]> {
  try {
    const esLaPlataforma = await esElEspacioDeLaPlataforma();
    const v = puedeUsarUnaCuentaDelCredito({ feature, esLaPlataforma, pausa: await claudePausado() });
    if (!v.ok || (!esLaPlataforma && !(o.tambienLosGrupos && v.para === 'grupos'))) return [];
    const { cuentasDelCredito } = await import('@/lib/credito-negocio');
    return await cuentasDelCredito(v.para);
  } catch { return []; }
}

/**
 * EL FALLO DE UNA CUENTA DEL CRÉDITO QUEDA ESCRITO (11/11/2026), en UN lugar para la cascada de texto y la de herramientas. Antes
 * cada llamador marcaba la cuenta sólo en la memoria de su instancia y no dejaba fila: el Uso (`sinCreditoAt`) nunca se enteraba de
 * que una cuenta de los grupos se quedó sin saldo. Con «credit balance is too low», la cuenta se saltea (6 h) y queda la fila «sin
 * crédito hasta el próximo ciclo» (el texto que reconoce lib/credito-api.ts). Cortada después de mandar, la fila «cortada sin
 * respuesta» con lo que pudo gastar. Nunca en la tarjeta del negocio: el crédito es NUESTRO.
 */
async function anotarFalloDelCredito(permiso: PermisoClaveDelNegocio, error: string, o: { cortada?: boolean; maxTokens?: number; motivo?: string } = {}): Promise<void> {
  const n = permiso.cuentaDelCredito;
  if (!n) return;
  const marca = `${MOTIVO_CREDITO_PLATAFORMA} (cuenta ${n})`;
  const ws = await wsDelPedido();
  if (/credit balance is too low/i.test(error)) {
    (await import('@/lib/credito-negocio')).marcarCuentaDeLosGruposSinCredito(`ANTHROPIC_CREDITO_CUENTA${n}`);
    await recordUsage(permiso.feature, permiso.model, {}, `${marca} · sin crédito hasta el próximo ciclo`, 'anthropic', n, ws).catch(() => {});
  } else if (o.cortada) {
    await recordUsage(permiso.feature, permiso.model, {}, [marca, `cortada sin respuesta (${error.slice(0, 80)}): puede haber gastado hasta ${o.maxTokens ?? 1024} tokens de salida`, (o.motivo ?? '').trim()].filter(Boolean).join(' · '), 'anthropic', n, ws).catch(() => {});
  }
}

/** Lo que dice una función cuando no se pudo comprobar la clave de Claude del negocio: se reintenta, no se paga otra. */
// Sin la causa: puede ser la base que no contestó o una fila de la plataforma que no se descifra (revisión del lote 2), y
// decir «la base no contestó» en el segundo caso era falso.
export const NO_PUDE_COMPROBAR_SU_CLAUDE = 'No pude comprobar tu clave de Claude. Se reintenta en la próxima corrida.';

/**
 * La puerta 1 (la lista blanca) paga con la clave de la PLATAFORMA, y con ninguna otra (revisión de IA5/IA12, 22/10/2026).
 * `credWs` devuelve la fila del negocio si tiene una: sin esto, una función de la lista blanca corrida en un negocio con SU
 * clave pagaba con ella el modelo de la plataforma (Sonnet con thinking), sin su marca en el gasto, y con el crédito de Max
 * de Martín si ésa era la clave (el ws10). La clave del negocio va por SU puerta (`permisoDeLaClaveDelNegocio`). Sin poder
 * leer las de la plataforma, tampoco: no se sabe de quién es.
 */
async function exigirClaveDeLaPlataforma(key: string, feature?: string): Promise<void> {
  const deLaPlataforma = await esClaveAnthropicDeLaPlataforma(key);
  if (deLaPlataforma) return;
  const razon = deLaPlataforma === false
    ? 'la clave de Claude de este negocio es SUYA: va por su puerta (su modelo, su marca en el gasto), no por la lista blanca de la plataforma'
    : 'no pude leer las claves de la plataforma, y sin eso no se sabe de quién es la clave';
  await registrarBloqueo(new Error(`Claude vetado — ${razon}`), feature, '');
  throw new Error(`${feature ?? 'Claude'}: ${razon}. Se reintenta en la próxima corrida.`);
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
export async function permisoDeLaClaveDelNegocio(feature?: string, opts: { modelo?: string; cuentaDeLosGrupos?: string } = {}): Promise<{ permiso: PermisoClaveDelNegocio } | { pausa: true } | { noPudeLeer: true } | null> {
  let clave = await credDelCliente('ANTHROPIC_API_KEY').catch(() => null);
  // EL CRÉDITO ASIGNADO AL NEGOCIO (22/10/2026, Martín: «habilita los tokens de la API de la cuenta de Mauricio… para su Ops
  // Center»; lib/credito-negocio.ts): sin su clave propia —o con una copia de la de MaKo, como el ws1—, la del crédito que le
  // asignó Martín, prendido en SuperAdmin › Uso. Sigue por esta misma puerta como el crédito del ws10: el barato, nunca el Plan,
  // y su gasto con la marca del crédito. Su clave propia, si la conecta, gana.
  // Y EL DE LOS GRUPOS (28/10/2026, `CLAVES_CREDITO_DE_LOS_GRUPOS`): sólo el turno de un grupo de WhatsApp, con la cuenta que eligió
  // el doer (`cuentasDelCreditoDeLosGrupos`), por la misma puerta y con las mismas reglas.
  // Y DESDE EL 11/11/2026, TODO LO DEL ESPACIO DE MaKo MENOS EL PLAN (Martín: «gastemos eso para todo esto en lugar de Gemini»):
  // quién puede usar una cuenta lo dice UNA regla pura (`puedeUsarUnaCuentaDelCredito`), y «es la plataforma» se calcula ACÁ
  // adentro (`esElEspacioDeLaPlataforma`), nunca con un dato del que llama: un negocio que pida una cuenta no la recibe.
  let asignada = false;
  let delGrupo: string | null = null;
  const credito = await import('@/lib/credito-negocio');
  const asignadoAlNegocio = await credito.claveDelCreditoAsignado().catch(() => null);
  let usoDelCredito: UsoDelCredito | null = null;
  if (!asignadoAlNegocio && opts.cuentaDeLosGrupos) {
    const v = puedeUsarUnaCuentaDelCredito({ feature, esLaPlataforma: await esElEspacioDeLaPlataforma(), pausa: await claudePausado() });
    if (v.ok) usoDelCredito = v.para;
  }
  const cuentaDelGrupo = usoDelCredito ? opts.cuentaDeLosGrupos ?? null : null;
  const delCredito = asignadoAlNegocio ?? (cuentaDelGrupo && usoDelCredito ? await credito.claveDeLaCuentaDeLosGrupos(cuentaDelGrupo, usoDelCredito).catch(() => null) : null);
  if (delCredito && (!clave || (await esClaveAnthropicDeLaPlataforma(clave)) !== false)) {
    clave = delCredito;
    asignada = true;
    delGrupo = asignadoAlNegocio ? null : cuentaDelGrupo;
  }
  if (!clave) return null;
  // ⚠️ EL PLAN, SÓLO CON LA DECISIÓN DEL PLAN EN «SÍ» Y CIERTA (revisión adversarial de IA15, 22/10/2026). La cascada prueba
  // esta puerta en cualquier pedido, decida lo que decida el Plan: con una fila de la plataforma ilegible, la frontera no
  // reconocía el crédito de Martín ni la copia de la clave de MaKo, y el Plan pagaba con ellas. `planConSuClave` sí los
  // reconoce (o dice «no pude saber»), y es la que manda.
  if (FEATURES_DEL_PLAN.includes((feature ?? '').trim()) && !(await planPuedePagarConSuClave())) return null;
  // ⚠️ «NO PUDE LEER» NO ES «NO TIENE» (revisión de IA5/IA12, 22/10/2026). Con `null`, el closing lo leía como «sin su clave»
  // y caía a `chatClaude`, que pagaba con ESA misma clave (`credWs`): Sonnet con thinking sobre la clave de un negocio que
  // eligió Haiku, sin su marca en el gasto, y en el ws10, sobre el crédito de Martín.
  let clavesPlataforma: Array<string | null | undefined>;
  try { clavesPlataforma = await clavesAnthropicDeLaPlataforma(); } catch { return { noPudeLeer: true }; }
  const pausa = await claudePausado();
  // IA5 (22/10/2026): el modelo que eligió el negocio para SU Claude, y las claves del crédito de Max de la plataforma: una
  // de ésas puesta como clave de un negocio (el ws10) va con el barato, elija lo que elija (lo paga Martín). Sin poder
  // leerlas, `null`: también el barato.
  let modelo: string;
  try {
    const { getSetting } = await import('@/lib/settings');
    // El que eligió la persona para ESTE chat (8b, `opts.modelo`, sólo «haiku» o «sonnet»: `modeloDeSuClaude`), si no, el del
    // negocio. Con el crédito de MaKo, `evaluarClaveDelNegocio` lo baja a Haiku igual.
    modelo = modeloDeSuClaude(opts.modelo ?? await getSetting(CLAVE_MODELO_SU_CLAUDE));
  } catch { modelo = modeloDeSuClaude(opts.modelo ?? null); }
  let creditosPlataforma: Array<string | null> | null;
  try {
    const { wsSuperAdmin } = await import('@/lib/workspace');
    const wsSA = await wsSuperAdmin();
    creditosPlataforma = [];
    // Las DOS fuentes, siempre: con el entorno puesto, la fila no se leía, y una clave rotada en la fila (o un entorno que
    // no coincide) dejaba al ws10 elegir Sonnet sobre el crédito de Martín. Con las de los grupos: también son de Martín.
    for (const nombre of new Set<string>([...CLAVES_CREDITO_PLATAFORMA, ...CLAVES_CREDITO_DE_LOS_GRUPOS])) {
      const env = process.env[nombre]?.trim() || null;
      const fila = await credWsEstricta(nombre, wsSA, { ilegibleTira: true });
      creditosPlataforma.push(env, fila);
      // Reconocido por su VALOR y sin marca: se marca, para que la próxima vez no dependa de que esa fila siga ahí. El asignado
      // no: no es su fila (y el ws1 no se toca).
      if (!asignada && [env, fila].some((x) => x && x.trim() === clave!.trim())) {
        const { leerMarcaDeCredito, esElCreditoMarcado, marcarCredito } = await import('@/lib/credito-marca');
        if (!esElCreditoMarcado(clave, await leerMarcaDeCredito().catch(() => null))) await marcarCredito(clave, nombre);
      }
    }
  } catch { creditosPlataforma = null; }
  // ⚠️ LA MARCA EXPLÍCITA MANDA (lib/credito-marca.ts; decisión del Cerebro, 22/10/2026: «que no dependa del valor»): una
  // clave marcada como el crédito de Martín se trata como crédito aunque la fila del crédito de la plataforma ya no exista.
  // Sin poder leer la marca, «no sé»: el barato y el Plan cerrado.
  try {
    const { leerMarcaDeCredito, esElCreditoMarcado } = await import('@/lib/credito-marca');
    // Marcada: es crédito, se pudieran leer las filas de la plataforma o no (sin leerlas, `null` decía «no sé» y el gasto se
    // anotaba como del negocio; la marca SÍ sabe).
    if (esElCreditoMarcado(clave, await leerMarcaDeCredito())) creditosPlataforma = [...(creditosPlataforma ?? []), clave];
  } catch { creditosPlataforma = null; }
  const v = evaluarClaveDelNegocio({ feature, clave, clavesPlataforma, pausa, model: modelo, creditosPlataforma });
  if (!v.ok) return pausa ? { pausa: true } : null;
  // La cuenta del crédito de los grupos que paga (ANTHROPIC_CREDITO_CUENTA3 → 3): sin ella, el Uso se lo anotaba a la cuenta 1.
  const n = delGrupo ? Number(/(\d+)$/.exec(delGrupo)?.[1]) : NaN;
  return { permiso: Number.isInteger(n) && n > 0 ? { ...v.permiso, cuentaDelCredito: n } : v.permiso };
}

/**
 * Las claves de Anthropic de la PLATAFORMA, ESTRICTAS: si la base no contesta, tira. Las lee la frontera (la puerta 2: una
 * copia de éstas en un negocio no es suya) y la puerta 1 (`chatClaude` y `chatClaudeTools` sólo pagan con una de éstas).
 */
async function clavesAnthropicDeLaPlataforma(): Promise<Array<string | null | undefined>> {
  const { wsSuperAdmin } = await import('@/lib/workspace');
  return [
    process.env.ANTHROPIC_API_KEY,
    // La fila de la que sale el ENTORNO de esta clave (`wsDelEntorno`). Hasta el 18/10 era la del ws1 (`OWNER_WS`), y
    // así la clave propia que pegara Mauricio se leía como la de la plataforma y nunca contaba como suya.
    await credWsEstricta('ANTHROPIC_API_KEY', await wsDelEntorno('ANTHROPIC_API_KEY'), { ilegibleTira: true }),
    await credWsEstricta('ANTHROPIC_API_KEY', await wsSuperAdmin(), { ilegibleTira: true }),
  ];
}

/** La clave del negocio en la cascada de TEXTO: su primer intento (arriba, `permisoDeLaClaveDelNegocio`, la frontera). */
export async function conClaveDelNegocio(p: {
  system: string; user: string; json?: boolean; maxTokens?: number; feature?: string; motivo?: string; timeoutMs: number;
  /** Lo que MIRA (IA6): imágenes y PDF como bloques de Claude, antes del texto. Las fotos de un negocio con su IA las lee su
   *  Claude o su OpenAI, nunca Gemini (lib/ai-cheap.ts → `leerDocumentoIA`). */
  bloques?: Array<Record<string, unknown>>;
  /** Una cuenta del crédito (11/11/2026, `cuentasDelCreditoParaElPedido`): la puerta 2 decide si este pedido la puede usar. */
  cuentaDeLosGrupos?: string;
}): Promise<{ texto: string; model?: string } | { error: string; noPudeLeer?: true; esCredito?: true; status?: number } | null> {
  const r = await permisoDeLaClaveDelNegocio(p.feature, { cuentaDeLosGrupos: p.cuentaDeLosGrupos });
  if (!r) return null;
  // No es un fallo de SU clave: no se anota en su tarjeta (`anotarFalloDeSuClave`), y quien llama no paga con otra.
  if ('noPudeLeer' in r) return { error: NO_PUDE_COMPROBAR_SU_CLAUDE, noPudeLeer: true };
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
      // Una cuenta del crédito NO es su clave (11/11/2026): su fallo va al Uso de SuperAdmin, nunca a la tarjeta del negocio.
      if (permiso.cuentaDelCredito) await anotarFalloDelCredito(permiso, error);
      else await (await import('./su-clave')).anotarFalloDeSuClave({ proveedor: 'anthropic', error: `HTTP ${res.status} ${body?.error?.type ?? ''} ${error}`, feature: permiso.feature, modelo: permiso.model });
      // Con el crédito que paga MaKo (`esCredito`), «sin crédito» es de la plataforma: quien llama no se lo pide al negocio.
      return permiso.esCredito || permiso.cuentaDelCredito ? { error, esCredito: true, status: res.status } : { error, status: res.status };
    }
    // Lo paga el negocio: la marca va PRIMERO en el motivo, y lib/costos-ia.ts la saca del gasto de MaKo. Una cuenta del crédito,
    // con su número y el ws que la usó (sin el ws, la fila de un negocio caía al ws 9).
    const deLaCuenta = permiso.cuentaDelCredito ? { n: permiso.cuentaDelCredito, ws: await wsDelPedido() } : null;
    await recordUsage(permiso.feature, permiso.model, body.usage, [marcaDelGasto(permiso), (p.motivo ?? '').trim()].filter(Boolean).join(' · '), 'anthropic', deLaCuenta?.n, deLaCuenta?.ws).catch(() => {});
    const texto = (body.content ?? [])
      .filter((c: { type?: string }) => c.type === 'text')
      .map((c: { text?: string }) => c.text ?? '')
      .join('\n')
      .trim();
    return texto ? { texto, model: permiso.model } : { error: 'Claude contestó vacío' };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    // Cortada (por plazo o por la red) DESPUÉS de mandar: con el crédito queda la fila de lo que pudo gastar, como en la puerta 3.
    if (permiso.cuentaDelCredito) {
      await anotarFalloDelCredito(permiso, error, { cortada: true, maxTokens: p.maxTokens ?? 1024, motivo: p.motivo });
      return { error, esCredito: true };
    }
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
  const permisos = await permisosDelCredito(p);
  if (!permisos) return null;
  const system = p.json ? `${p.system}\n\nResponde SOLO con el JSON pedido, sin texto antes ni después y sin bloques de código.` : p.system;
  const errores: string[] = [];
  for (const permiso of permisos) {
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
      const detalle = e instanceof Error ? `${e.name} ${e.message}` : String(e);
      errores.push(`crédito cuenta ${permiso.cuenta}: ${detalle}`);
      // Cortada (por plazo o por la red) DESPUÉS de mandar: Anthropic puede haber cobrado igual. Queda la fila, con la marca
      // del crédito y hasta cuánto pudo gastar (verificación del tren-m: sin esto, un corte no dejaba rastro del gasto).
      await recordUsage(permiso.feature, permiso.model, {}, [`${MOTIVO_CREDITO_PLATAFORMA} (cuenta ${permiso.cuenta})`, `cortada sin respuesta (${detalle.slice(0, 80)}): puede haber gastado hasta ${p.maxTokens ?? 1024} tokens de salida`, (p.motivo ?? '').trim()].filter(Boolean).join(' · '), 'anthropic', permiso.cuenta, p.wsCliente).catch(() => {});
    }
  }
  return errores.length ? { error: errores.join(' · ') } : null;
}

/**
 * Las cuentas del crédito que puede usar ESTE pedido, con su permiso, sin llamar a nadie (o null): la cuenta que hace la puerta
 * antes de pedir. Desde el 11/11/2026 esta puerta es sólo del onboarding (lo interno de MaKo va por la 2, con
 * `cuentasDelCreditoParaElPedido`).
 */
async function permisosDelCredito(p: { feature?: string; wsCliente: number }): Promise<PermisoCredito[] | null> {
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
  const permisos: PermisoCredito[] = [];
  for (const clave of creditos) {
    if (!clave) continue;
    const v = evaluarCreditoDeLaPlataforma({ feature: p.feature, clave, creditos, pausa, onboardingEnCurso });
    if (!v.ok) return null;
    permisos.push(v.permiso);
  }
  return permisos.length ? permisos : null;
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
  // Sin el permiso de la persona, la app de iPhone no le manda nada a una IA (Apple 5.1.2(i), lib/ia-permiso.ts).
  await exigirPermisoIa();
  // D6b decidido por el negocio en curso (IA6, lib/solo-su-ia.ts → `conD6bDelPedido`), si nadie lo decidió antes.
  if (pasaPorLaPuerta(opts.feature)) return conD6bDelPedido(opts.feature, () => chatClaude(system, messages, opts));
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
      const { modeloDeFeature, fallbackDeFeature, deSuIADeFeature } = await import('@/lib/model-registry');
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
          // `deSuIA` (lib/model-catalogo.ts): su Claude y su GPT, nunca Gemini (ni el suyo).
          sinGemini: deSuIADeFeature(opts.feature),
          // `fallback: []` (11/11/2026): un solo proveedor, así que tampoco el crédito de Claude primero (mezclaría dos modelos).
          sinCredito: permitidos?.length === 0,
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
  await exigirClaveDeLaPlataforma(key, opts.feature);

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
    /** D6b (21/10/2026): el negocio tiene SU IA. La cascada sólo prueba su Gemini y su OpenAI (`PROVS_SU_IA`, IA16) y
     *  después su Claude: ni el Gemini de la plataforma, ni Groq, ni Mistral, ni OpenRouter (docs/ia-del-cliente.md §12.7). */
    soloSuIA?: boolean;
    /** WA1 (22/10/2026): DIRECTO a la clave de Claude del negocio (la puerta 2 del veto), sin la cascada: el que llama ya
     *  probó su OpenAI (el doer de WhatsApp). Sin su clave, tira «falló la IA (…)». Nunca el Claude de MaKo. */
    soloSuClaude?: boolean;
    /** El turno de un grupo de WhatsApp con el crédito de los planes 200 (28/10/2026): la cuenta que eligió el doer
     *  (`cuentasDelCreditoDeLosGrupos`, lib/credito-negocio.ts). Sólo con `soloSuClaude` y la feature del grupo. */
    cuentaDeLosGrupos?: string;
    /** 8b (23/10/2026): con `soloSuClaude`, el modelo que eligió la persona para ese chat («haiku» o «sonnet»). */
    modeloSuClaude?: string;
    /** 8b (23/10/2026): DIRECTO a la clave de OpenAI del negocio, sin la cascada y sin caer a Claude. Sin su clave, tira. */
    soloSuOpenAI?: boolean;
    /** Con `soloSuOpenAI`, el modelo de OpenAI que corre (el elegido o el de por defecto, `MODELO_SU_OPENAI_DEFAULT`). Sin
     *  esto, el de la capa barata (`gpt-4o-mini`). */
    modeloSuOpenAI?: string;
    sinFallbackClaude?: boolean;    // si el override a IA barata falla, RE-LANZÁ el error (no caigas a Claude): el caller quiere avisar "falló", no gastar Claude en silencio.
    /** ⏱ El plazo de CADA pedido a Anthropic del bucle (11/11/2026). Antes no había ninguno: un Anthropic colgado trababa el turno
     *  hasta el corte de undici (~300 s). Sin él, 12 ms por token de salida, entre 45 s y 120 s. */
    plazoPasoMs?: number;
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
  // Sin el permiso de la persona, la app de iPhone no le manda nada a una IA (Apple 5.1.2(i), lib/ia-permiso.ts).
  await exigirPermisoIa();
  // D6b decidido por el negocio en curso (IA6, lib/solo-su-ia.ts → `conD6bDelPedido`), si nadie lo decidió antes.
  if (pasaPorLaPuerta(opts.feature)) return conD6bDelPedido(opts.feature, () => chatClaudeTools(system, messages, tools, runTool, opts));
  // Override configurable por feature (tab /modelos-ia). Si el caller NO forzó un
  // modelo y la feature está ruteada a otra IA (Groq/OpenAI/Gemini), corremos el
  // LOOP de tools por chatCheapTools (function-calling OpenAI-compat) ANTES de
  // exigir la key de Anthropic. Fallback a Claude si la barata falla. Si es otro
  // modelo de Claude, lo usamos (antes chatClaudeTools ignoraba el registro y todo
  // corría en Opus). El doer de WhatsApp pasa `model` explícito (router) → salta
  // esto y sigue en Claude; su ruteo a barato va por su propio camino (DOER_GROQ_TOOLS).
  // Lo que eligió la persona en el «+» (8b): SU OpenAI, y nada más. Nunca cae a Claude: eligió ésa.
  if (opts.soloSuOpenAI) {
    const errores: string[] = [];
    const { chatCheapToolsCascade } = await import('@/lib/ai-cheap');
    const r = await chatCheapToolsCascade(system, messages, tools, runTool, {
      maxSteps: opts.maxSteps, maxTokens: opts.maxTokens, feature: opts.feature, motivo: opts.motivo, provs: ['openai'], erroresOut: errores,
      ...(opts.modeloSuOpenAI ? { modelos: { openai: opts.modeloSuOpenAI } } : {}),
    });
    if (r) return { text: r.text, steps: r.steps, stopReason: r.stopReason };
    throw new Error(`falló la IA (${errores.join(' · ').slice(0, 200) || 'el negocio no tiene su clave de OpenAI'})`);
  }
  let model = opts.model ?? '';   // sin default: el `?? MODEL` era la quinta puerta
  /** La clave de Claude del NEGOCIO, cuando ninguna IA barata suya contestó (abajo). */
  let delNegocio: PermisoClaveDelNegocio | null = null;
  if (opts.soloSuClaude) {
    const n = await permisoDeLaClaveDelNegocio(opts.feature, { modelo: opts.modeloSuClaude, cuentaDeLosGrupos: opts.cuentaDeLosGrupos }).catch(() => null);
    if (n && 'permiso' in n) delNegocio = n.permiso;
    else throw new Error(`falló la IA (${n && 'pausa' in n ? CLAUDE_EN_PAUSA : n && 'noPudeLeer' in n ? NO_PUDE_COMPROBAR_SU_CLAUDE : 'el negocio no tiene su clave de Claude'})`);
  } else if (!opts.model && opts.feature) {
    // ── EL CRÉDITO DE CLAUDE PRIMERO EN EL ESPACIO DE MaKo (11/11/2026, Martín: «gastemos eso para todo esto en lugar de Gemini,
    // porque es mucho más estable»). Sólo en la plataforma y nunca el Plan (`cuentasDelCreditoParaElPedido` devuelve [] si no);
    // de cuenta en cuenta, como el bot 1 a 1 (lib/mako-bot.ts), por la puerta 2 (`soloSuClaude`, Haiku, la marca «(cuenta N)»).
    // Cubre el chat del Ops Center (lib/mako-turno-app.ts) y el de la web (app/api/mako-doer). Si una cuenta falla SIN haber
    // corrido ninguna herramienta: sin saldo, 401 o 429, la otra cuenta; plazo, 5xx u «overloaded», directo a la cascada (es el
    // mismo Anthropic). Si ya corrió una herramienta, se re-lanza: otro modelo duplicaría la escritura (la regla de abajo).
    for (const cuenta of await cuentasDelCreditoParaElPedido(opts.feature)) {
      let corrioUnaHerramienta = false;
      const mirado: ToolRunner = async (name, input) => { corrioUnaHerramienta = true; return runTool(name, input); };
      try {
        return await chatClaudeTools(system, messages, tools, mirado, { ...opts, soloSuClaude: true, cuentaDeLosGrupos: cuenta, modeloSuClaude: undefined });
      } catch (e) {
        if (corrioUnaHerramienta) throw e;
        const m = e instanceof Error ? e.message : String(e);
        console.warn(`[anthropic] tools ${opts.feature}: el crédito (${cuenta}) no contestó: ${m.slice(0, 200)}`);
        if (queHacerSiFallaElCredito((e as { status?: number }).status, m) !== 'otra_cuenta') break;
      }
    }
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
        // Con su IA (`soloSuIA`), sólo su Gemini y su OpenAI (`PROVS_SU_IA`): la cascada barata no participa en sus turnos (D6b).
        const provs: ProvName[] = opts.soloSuIA || soloSuIA() ? [...PROVS_SU_IA] as ProvName[] : [ref.provider as ProvName, ...CASCADA_TOOLS.filter((p) => p !== ref.provider)];
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
  if (!delNegocio) await exigirClaveDeLaPlataforma(key, opts.feature);
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

    // ⏱ CON PLAZO (11/11/2026): sin `signal`, un Anthropic colgado dejaba el turno trabado hasta el corte de undici.
    const plazo = opts.plazoPasoMs ?? Math.min(120_000, Math.max(45_000, Number(payload.max_tokens) * 12));
    let res: Response;
    try {
      res = await fetch(permiso.endpoint, {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.max(1_000, plazo)),
      });
    } catch (e) {
      // Cortada DESPUÉS de mandar: con una cuenta del crédito queda la fila de lo que pudo gastar (`anotarFalloDelCredito`).
      if (delNegocio?.cuentaDelCredito) await anotarFalloDelCredito(delNegocio, e instanceof Error ? `${e.name} ${e.message}` : String(e), { cortada: true, maxTokens: Number(payload.max_tokens), motivo: opts.motivo });
      throw e;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      const m = body?.error?.message ?? `Anthropic ${res.status}`;
      // Con su clave, el fallo queda escrito (IA3): es lo que la tarjeta de «Tus cuentas de IA» le muestra al negocio.
      // El crédito de los grupos no es SU clave: su fallo no va a la tarjeta del negocio (lo ve el Uso de SuperAdmin). Y desde el
      // 11/11/2026 queda escrito ACÁ, una vez para todos los que llaman: sin saldo, la cuenta se saltea y queda la fila «sin
      // crédito» (antes cada llamador la marcaba sólo en su memoria, y el Uso nunca se enteraba de que se agotó).
      if (delNegocio && !delNegocio.cuentaDelCredito) await (await import('./su-clave')).anotarFalloDeSuClave({ proveedor: 'anthropic', error: `HTTP ${res.status} ${body?.error?.type ?? ''} ${m}`, feature: permiso.feature, modelo: String(model) });
      if (delNegocio?.cuentaDelCredito) await anotarFalloDelCredito(delNegocio, String(m));
      // «tu clave de Claude: …» le dice al negocio que la SUYA no tiene crédito (lib/errores-app-reglas.ts): el de los grupos es nuestro.
      // Con el status adentro (`queHacerSiFallaElCredito`): un 429 de una cuenta prueba la otra; un 529, no.
      throw Object.assign(new Error(delNegocio ? `falló la IA (${delNegocio.cuentaDelCredito ? `el crédito de Claude de MaKo, cuenta ${delNegocio.cuentaDelCredito}` : 'tu clave de Claude'}: ${m})` : m), { status: res.status });
    }

    // Lo que paga el negocio lleva su marca PRIMERO: lib/costos-ia.ts lo saca del gasto de MaKo. Una cuenta del crédito, con su
    // número y el ws del pedido (sin el ws, el gasto de un negocio sin su Claude quedaba anotado en el ws 9).
    const usage = delNegocio?.cuentaDelCredito
      ? await recordUsage(permiso.feature, String(model), body.usage, [marcaDelGasto(delNegocio), (opts.motivo ?? '').trim()].filter(Boolean).join(' · '), 'anthropic', delNegocio.cuentaDelCredito, await wsDelPedido())
      : await recordUsage(permiso.feature, String(model), body.usage,
        delNegocio ? [marcaDelGasto(delNegocio), (opts.motivo ?? '').trim()].filter(Boolean).join(' · ') : opts.motivo);
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
