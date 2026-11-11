// =============================================================================
// veto-claude — la ÚNICA puerta a api.anthropic.com/v1/messages
// =============================================================================
// El pedido, textual (13/8/2026): «que ya no se pueda gastar con Claude directamente,
// que se prohíba».
//
// HAY CINCO PUERTAS, Y CERRAR CUATRO DEJA LA QUINTA. Es exactamente lo que pasó ayer:
// `fallback: []` tapó dos y las otras tres siguieron cobrando US$12,79.
//
//   1. `def` pago del catálogo ............. closing US$23,96 · experimentos · lead_insights
//   2. fallback pago de `chatClaude` ....... plan-fathom 38,02 + Perro 14,13 + coach 3,53
//   3. fallback pago de `chatClaudeTools` .. ni siquiera consultaba `fallbackDeFeature`
//   4. `opts.model` explícito .............. US$8,67; saltea el registro ENTERO
//   5. el `MODEL` del módulo ............... feature fuera del catálogo → Opus, el más caro
//
// Las cinco terminan en el mismo `fetch`. El veto vive ahí y en ningún otro lado.
//
// ⚠️ Y LA ASIMETRÍA ES EL DISEÑO: el default es BLOQUEAR, y bloquear es instantáneo —una
// feature nueva ya está vetada el día que se escribe—. Desbloquear necesita commit,
// pre-push, push y deploy: lento y revisable. Por eso la lista blanca vive en CÓDIGO y no
// en `app_settings`: un veto que se apaga con la misma palanca que gobierna se apaga solo.
//
// SIN `server-only` a propósito: un módulo con server-only no lo puede importar ningún
// test, y la guarda del gasto quedaría sin red justo donde más duele.
//
// ── LA SEGUNDA PUERTA: LA CLAVE DE ANTHROPIC DEL NEGOCIO (15/10/2026) ─────────────
// El veto del 13/8 es sobre la plata de MaKo: «que ya no se pueda gastar con Claude
// directamente, que se prohíba». El 15/10 Martín pidió lo otro, textual: «quiero
// implementar esto en todos los workspace de los clientes, para que puedan conectar sus
// cuentas de lo que sea, Claude, GPT, etc...», y esa noche eligió la opción A de la
// Ticketera (`clientes-usan-su-claude`): el crédito de API de Claude Max del cliente entra
// por su clave propia. Esa plata es del NEGOCIO, no de MaKo.
//
// Así que hay dos puertas y ninguna se deriva de la otra:
//   1. `evaluarPermiso`: la lista blanca de abajo, con la clave que resuelva el runtime.
//   2. `evaluarClaveDelNegocio`: cualquier función de texto del negocio, con UN modelo
//      barato, y SÓLO con la clave que el negocio cargó en su propia fila.
//
// ⚠️ TODO EL RIESGO ESTÁ EN ESA FRONTERA: una clave de la PLATAFORMA (el env, la fila del
// dueño, que `migrarEnvACredenciales` siembra desde el env, o la del workspace de la
// plataforma) que pase por la puerta 2 es el gasto de MaKo sin lista blanca, que es
// exactamente lo que el veto cerró. Por eso la puerta 2 recibe la clave YA LEÍDA y las de
// la plataforma, las compara acá —puro, con test— y el permiso lleva adentro la clave
// verificada: el `fetch` usa ÉSA, nunca vuelve a resolver otra. Lo prueba rompiéndolo
// tests/veto-claude-clave-negocio.test.ts.
//
// ── LA TERCERA PUERTA: EL CRÉDITO DE API DE LOS PLANES MAX DE MARTÍN (16/10/2026) ──
// Martín vinculó el crédito de API de dos planes Max suyos (US$200 por mes cada uno, que se
// renuevan y no se acumulan) y pidió, textual: «Vinculalas a MaKo», para «habilitar los TOKENS
// a usuarios nuevos, sobre todo para el onboarding, para que no tengan la fricción de traer su
// API». No contradice el «que ya no se pueda gastar con Claude directamente, que se prohíba» del
// 13/8: ese crédito viene incluido en la suscripción, sin tarjeta, y al acabarse corta en vez de
// cobrar. Por eso pasa como excepción EXPLÍCITA y NOMBRADA: sólo las dos claves de
// `CLAVES_CREDITO_PLATAFORMA`, comparadas acá contra la que llega, y ninguna otra clave de la
// plataforma. Lo prueba rompiéndolo tests/veto-claude-credito-plataforma.test.ts.
//
// Y el MISMO día, el PARA QUÉ: «Yo debo decirte cuando utilizar creditos, no tenemos infinitos...
// Por ahora solo en onboarding.» El crédito lo usa sólo lo que está en `CREDITO_HABILITADO_PARA`.
// =============================================================================

import { CATALOGO_MODELOS } from '@/lib/model-catalogo';

const ENDPOINT = 'https://api.anthropic.com/v1/messages' as const;
/** «Probar mi clave» (IA3): contar tokens no cobra ni compra nada. Vive acá porque la URL de mensajes vive SÓLO acá. */
export const ENDPOINT_CONTAR_TOKENS = `${ENDPOINT}/count_tokens` as const;

/**
 * LA MARCA. El símbolo NO se exporta: ningún otro módulo puede FABRICAR un
 * `PermisoClaude`. Y como el `fetch` de `lib/anthropic.ts` saca la URL de
 * `permiso.endpoint` —ya no de una constante propia—, escribir una llamada a Claude sin
 * pasar por acá no tipa.
 *
 * No es a prueba de balas: `{} as PermisoClaude` la saltea, y el typecheck NO corre en el
 * build de Vercel. Esta capa es para el que agrega código nuevo y NO sabe que hay un veto:
 * se entera al escribirlo, no en la factura. Al que castea a propósito lo caza el test.
 */
declare const marcaDeVeto: unique symbol;

export type PermisoClaude = {
  readonly endpoint: typeof ENDPOINT;
  readonly model: string;
  readonly feature: string;
  readonly porque: string;
  readonly [marcaDeVeto]: true;
};

/** El permiso de la puerta 2: trae ADENTRO la clave que se verificó que es del negocio. */
export type PermisoClaveDelNegocio = PermisoClaude & {
  readonly clave: string;
  /** La clave es el crédito de Max de la PLATAFORMA (el ws10): su gasto se anota como del crédito, no del negocio. */
  readonly esCredito?: true;
  /** El crédito de los GRUPOS (`CLAVES_CREDITO_DE_LOS_GRUPOS`): el número de la cuenta que pagó, para el Uso (`creditoQuePago`). */
  readonly cuentaDelCredito?: number;
};

export type PermisoDeclarado = {
  feature: string;
  /** los ÚNICOS modelos que esta feature puede comprar. Uno de más es plata de más. */
  modelos: string[];
  /** YYYY-MM-DD. Vencido = vetado (el test avisa 14 días antes). */
  hasta: string;
  porque: string;
  /** quién lo autorizó y cuándo. Un permiso sin dueño no lo revisa nadie. */
  pidio: string;
};

export const CLAUDE_PERMITIDO: PermisoDeclarado[] = [
  {
    feature: 'closing',
    // ⚠️ SONNET, no Opus. El 13/8 el dueño bajó el `def` de closing de Opus a Sonnet
    // («~60% menos»). Declarar Opus acá rompería closing el día 1: el modelo que resuelve
    // el registro no estaría permitido y la feature se apagaría sola.
    modelos: ['claude-sonnet-5'],
    hasta: '2026-11-13',
    porque:
      'Transcript completo de una llamada de venta + juicio comercial sobre PII. Es el '
      + 'análisis insignia y lo que el cliente compra: la diferencia de criterio se nota.',
    pidio: 'Martín, 13/8/2026 — la única excepción declarada al aplicar el veto.',
  },
];

// `experimentos` y `lead_insights` NO están, y no es un olvido: las dos tenían
// `def: CLAUDE()` con su `pagoPorque` escrito y ninguna corre desde julio (US$0,88 el 16/7
// y US$0 desde el 5/7). Una autorización que nadie usa es una que nadie revisa, y es la
// forma exacta del «default que cobra en silencio». Su `def` pasó a Gemini en el MISMO
// commit. Volverlas es una fila acá y una fecha.

export type Veredicto =
  | { ok: true; permiso: PermisoClaude }
  | { ok: false; razon: string };

const diaISO = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * ¿Esta llamada puede pagarle a Anthropic? Puro y síncrono: no lee la base, no hace red.
 * Por eso lo puede correr un test y también la UI de /modelos-ia.
 *
 * `pausa` va como PARÁMETRO y no como lectura interna: quien la lee es el llamador, y así
 * este módulo queda testeable y sin `server-only`.
 */
export function evaluarPermiso(p: {
  feature?: string; model?: string; pausa?: boolean; hoy?: Date;
}): Veredicto {
  const feature = (p.feature ?? '').trim();

  if (p.pausa) {
    return { ok: false, razon: 'Claude está PAUSADO a mano (`mako.claude.pausa`). Se despausa desde /modelos-ia.' };
  }

  // 1) SIN FEATURE NO SE PAGA. Hoy los call-sites la pasan por disciplina y nada los
  //    obligaba: esto no rompe nada y cierra la puerta para el que viene.
  if (!feature) {
    return { ok: false, razon: 'llamada a Claude sin `feature`: no hay forma de saber qué se está comprando.' };
  }

  // 2) FUERA DEL CATÁLOGO NO ES «USÁ EL DEFAULT», ES UN DATO QUE FALTA.
  //    `modeloDeFeature` devolvía null igual si no había feature que si la feature no
  //    existía; los dos caían en el mismo `else` y compraban OPUS.
  const enCatalogo = CATALOGO_MODELOS.find((f) => f.feature === feature);
  if (!enCatalogo) {
    return { ok: false, razon: `«${feature}» no está en CATALOGO_MODELOS (lib/model-catalogo.ts). Regístrala con un \`def\` gratis — una feature sin registrar no compra Opus.` };
  }

  const permiso = CLAUDE_PERMITIDO.find((x) => x.feature === feature);
  if (!permiso) {
    return { ok: false, razon: `«${feature}» no está en la lista blanca de lib/veto-claude.ts. Claude está prohibido salvo excepción explícita (pedido del dueño, 13/8/2026).` };
  }

  const hoy = diaISO(p.hoy ?? new Date());
  if (hoy > permiso.hasta) {
    return { ok: false, razon: `el permiso de «${feature}» venció el ${permiso.hasta}. Renuévalo con una fecha nueva o déjalo vencido — vencer es la decisión por default.` };
  }

  // 3) EL MODELO. `opts.model` deja de ser un parámetro y pasa a ser un permiso: es la
  //    única ruta que no consultaba nada (el lookup entero se cortaba con
  //    `if (!opts.model && opts.feature)`) y es la #4 en plata.
  //
  //    Si no vino modelo se cae al `def` DEL CATÁLOGO —import estático, no la base— y
  //    igual tiene que estar declarado abajo. Sin esto, un blip de Supabase deja
  //    `model: ''` y apaga la única feature autorizada. Un default POSITIVO y acotado a lo
  //    ya permitido no abre nada; la ausencia de regla sí.
  const model = (p.model ?? '').trim() || enCatalogo.def.model;
  if (!model) {
    return { ok: false, razon: `«${feature}»: no se resolvió ningún modelo. Antes esto caía al \`MODEL\` del módulo, que era Opus.` };
  }
  if (!permiso.modelos.includes(model)) {
    return { ok: false, razon: `«${feature}» tiene permiso para ${permiso.modelos.join(', ')}, no para «${model}».` };
  }

  return { ok: true, permiso: fabricar({ model, feature, porque: permiso.porque }) };
}

/** El ÚNICO cast a PermisoClaude de todo el repo, para las dos puertas. El test lo verifica. */
function fabricar<T extends { model: string; feature: string; porque: string }>(p: T): PermisoClaude & T {
  return { endpoint: ENDPOINT, ...p } as PermisoClaude & T;
}

// ── PUERTA 2: la clave de Anthropic del negocio ──────────────────────────────────

/**
 * Lo que puede comprar la clave del NEGOCIO. Un solo modelo, el barato: es para sus
 * funciones de TEXTO (extraer, clasificar, redactar), las mismas que hoy hace Gemini Flash,
 * y el crédito de Max son 100 o 200 dólares por mes. Sin `hasta`, a diferencia de la lista
 * blanca: la lista es una excepción al gasto de MaKo y vence; esto no gasta plata de MaKo,
 * y lo que lo habilita no es una fecha sino de quién es la clave.
 */
export const CLAUDE_CON_CLAVE_DEL_NEGOCIO = {
  // IA5 (22/10/2026): el negocio elige el modelo de SU Claude en «Tus cuentas de IA» (`MODELO_SU_CLAUDE`). El primero es el
  // default. Lo paga su cuenta; la frontera (nunca una copia de la clave de la plataforma) no cambia.
  modelos: ['claude-haiku-4-5', 'claude-sonnet-5'],
  porque: 'El negocio cargó SU clave de Anthropic (el crédito de API de Claude Max, o la suya paga): '
    + 'MaKo la usa primero para sus funciones de texto, y lo paga su cuenta, no la de MaKo.',
  pidio: 'Martín, 15/10/2026 — opción A de la Ticketera `clientes-usan-su-claude`.',
} as const;

/**
 * La marca con la que se registra en `anthropic_usage` una llamada pagada con la clave del
 * negocio, y la pregunta que la reconoce. Va al PRINCIPIO del motivo: `insertUsage` lo corta a
 * 200 caracteres, y al final se perdería con un motivo largo.
 *
 * ⚠️ ESE GASTO NO ES DE MAKO, y todo lo que sume `anthropic_usage` como costo de la agencia lo
 * tiene que sacar con `esDeLaClaveDelNegocio` (lib/costos-ia.ts). Si no, el día que un cliente
 * use su crédito de Max, Martín ve un gasto de Claude que no es suyo y el veto parece roto.
 */
export const MOTIVO_CLAVE_DEL_NEGOCIO = '⚠ clave de Anthropic del negocio';

/**
 * El modelo de SU Claude que eligió el negocio (IA5, 22/10/2026), en `app_settings` de su workspace. Sin elegir, el barato.
 * Lo elige el admin en «Tus cuentas de IA»; lo paga su cuenta.
 */
export const CLAVE_MODELO_SU_CLAUDE = 'ia.su_claude.modelo';
export const MODELO_SU_CLAUDE = { haiku: 'claude-haiku-4-5', sonnet: 'claude-sonnet-5' } as const;
export type EleccionSuClaude = keyof typeof MODELO_SU_CLAUDE;
/**
 * ¿Es una de las elecciones? Con `Object.hasOwn`, no `in`: `in` acepta lo heredado («constructor», «toString»), y guardado
 * así el modelo salía una función, la puerta 2 tiraba un TypeError y el Claude del negocio desaparecía sin aviso, con la
 * tarjeta diciendo Haiku (revisión de IA5, 22/10/2026).
 */
export const esEleccionSuClaude = (x: unknown): x is EleccionSuClaude => typeof x === 'string' && Object.hasOwn(MODELO_SU_CLAUDE, x);
export const modeloDeSuClaude = (guardado: unknown): string => MODELO_SU_CLAUDE[esEleccionSuClaude(guardado) ? guardado : 'haiku'];
export const esDeLaClaveDelNegocio = (motivo: string | null | undefined): boolean =>
  typeof motivo === 'string' && motivo.trimStart().startsWith(MOTIVO_CLAVE_DEL_NEGOCIO);

/**
 * Las funciones del PLAN. Martín, 30/09/2026, textual: «NO, JAMÁS algo pago para el plan» y «nunca sonnet ni nada pago
 * para el plan. JAMÁS». La EXCEPCIÓN, Martín, 22/10/2026, textual: «Sí, si es su clave» — si el negocio conectó y paga su
 * propia clave, su Plan la usa; si no, sigue como siempre. Así que en la puerta 2 una función del Plan pasa SÓLO:
 *   · con la clave que paga el negocio, nunca con el crédito de Max de la plataforma (el ws10: lo pagaría Martín), y sin
 *     poder comparar con el crédito, tampoco;
 *   · con el modelo barato, elija lo que elija: el Plan es lo que más se usa (el Perro, las reuniones), y con Sonnet se
 *     comería su crédito en silencio.
 * La plataforma no paga el Plan por ninguna puerta (la 1 no lo tiene, la 3 lo rechaza). Sacar una de acá es una decisión
 * de Martín, no un arreglo.
 */
export const FEATURES_DEL_PLAN: readonly string[] = [
  'mako-guardian', 'checklist-coach', 'plan-seed-ia', 'plan-fathom', 'plan-criterio',
  // Revisión de IA5 (22/10/2026): el buscador del tablero (app/api/plan-buscar) y el cierre de tareas por commits
  // (lib/cerrar-por-commits.ts, cron sin workspace: cae en el ws1) pasaban la puerta 2 con Sonnet. Una función del Plan con
  // nombre nuevo queda abierta por default: tests/su-claude-modelo.test.ts exige que toda feature del Plan esté acá.
  'plan-buscar', 'cerrar-por-commits',
  // Revisión del lote 2 (22/10/2026): «importar archivos» del Plan leía fotos y PDF escaneados con la feature por default
  // de `archivoATexto` («Importar al plan», que también usan el CRM, el chat y el Video Generator, y no es del Plan).
  'plan-importar',
];

/**
 * ¿Esta función de texto puede usar la clave de Anthropic del negocio? Puro y síncrono.
 *
 * `clave` es la que el negocio tiene en SU fila (`credDelCliente`, que no cae al env), y
 * `clavesPlataforma` son TODAS las copias de la clave de la plataforma que el llamador pudo
 * leer: el env, la fila del dueño y la del workspace de la plataforma. Si no las pudo leer,
 * no llama: «no pude leer» nunca habilita nada.
 */
export function evaluarClaveDelNegocio(p: {
  feature?: string; model?: string; pausa?: boolean;
  clave?: string | null; clavesPlataforma: ReadonlyArray<string | null | undefined>;
  /**
   * Las claves del CRÉDITO de Max de la plataforma (`CLAVES_CREDITO_PLATAFORMA`), o `null` si no se pudieron leer. Una clave
   * del negocio que ES una de ésas (el ws10: Martín le puso su cuenta 2) se usa sólo con el modelo barato, elija lo que
   * elija: lo paga Martín (IA5). Sin poder leerlas, igual: «no pude leer» nunca habilita gastar más.
   */
  creditosPlataforma?: ReadonlyArray<string | null | undefined> | null;
}): { ok: true; permiso: PermisoClaveDelNegocio } | { ok: false; razon: string } {
  if (p.pausa) return { ok: false, razon: 'Claude está PAUSADO a mano (`mako.claude.pausa`): apaga también la clave del negocio.' };
  const feature = (p.feature ?? '').trim();
  if (!feature) return { ok: false, razon: 'sin `feature` no se sabe qué se compra, ni con la plata del negocio.' };
  const delPlan = FEATURES_DEL_PLAN.includes(feature);
  const clave = typeof p.clave === 'string' ? p.clave.trim() : '';
  if (!clave || clave.startsWith('PENDING')) return { ok: false, razon: 'el negocio no tiene su clave de Anthropic cargada.' };
  // LA FRONTERA. Comparada sin espacios: una copia pegada con un espacio de más sigue siendo
  // la clave de la plataforma.
  if (p.clavesPlataforma.some((x) => typeof x === 'string' && x.trim() !== '' && x.trim() === clave)) {
    return { ok: false, razon: 'esa clave es una copia de la de la PLATAFORMA: con ella paga MaKo, y eso sólo pasa por la lista blanca.' };
  }
  const modelos: readonly string[] = CLAUDE_CON_CLAVE_DEL_NEGOCIO.modelos;
  let model = (p.model ?? '').trim() || modelos[0];
  if (!modelos.includes(model)) return { ok: false, razon: `con la clave del negocio sólo ${modelos.join(', ')}, no «${model}».` };
  // El crédito de Max de la PLATAFORMA puesto como clave de un negocio: sólo el barato (IA5).
  // `creditosPlataforma` trae también la propia clave del negocio cuando está MARCADA como crédito (lib/credito-marca.ts).
  const coincide = (p.creditosPlataforma ?? []).some((x) => typeof x === 'string' && x.trim() !== '' && x.trim() === clave);
  const esCredito = p.creditosPlataforma === null || coincide;
  // El Plan, sólo con la clave que paga el negocio (Martín, 22/10/2026: «Sí, si es su clave»), y siempre con el barato.
  if (delPlan && esCredito) {
    return { ok: false, razon: p.creditosPlataforma === null
      ? `«${feature}» es del Plan: sin poder leer el crédito de Max de la plataforma, no se sabe si esta clave la paga el negocio.`
      : `«${feature}» es del Plan, y esa clave es el crédito de Max de la PLATAFORMA: el Plan sólo paga con la clave que paga el negocio.` };
  }
  if (esCredito || delPlan) model = modelos[0];
  // `esCredito` en el permiso sólo cuando SE SABE (coincide): su gasto es del crédito de la plataforma, no del negocio, y así
  // se anota (lib/anthropic.ts). Sin poder leer, va con el barato pero no se afirma de quién es.
  return { ok: true, permiso: fabricar({ model, feature, porque: CLAUDE_CON_CLAVE_DEL_NEGOCIO.porque, clave, ...(coincide ? { esCredito: true as const } : {}) }) };
}

// ── PUERTA 3: el crédito de API de los planes Max de la plataforma ───────────────

/**
 * Los NOMBRES de las dos claves del crédito, en orden (la cuenta 1 y la cuenta 2). Se leen del
 * entorno o de la fila del workspace de la plataforma con estos nombres, y de ningún otro lado:
 * `ANTHROPIC_API_KEY` NO está, a propósito, aunque también sea de la plataforma.
 */
export const CLAVES_CREDITO_PLATAFORMA = ['ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2'] as const;

export const CREDITO_DE_LA_PLATAFORMA = {
  modelos: ['claude-haiku-4-5'],
  // Vence como toda excepción al gasto de la plataforma: renovarla es una línea, y obliga a mirar
  // cuánto se usó (la línea aparte del gasto de IA en /integraciones).
  hasta: '2026-12-31',
  porque: 'Crédito de API incluido en dos planes Max de Martín (US$200 por mes cada uno, sin tarjeta): '
    + 'cubre la IA de texto de los clientes sin clave propia, sobre todo en el onboarding.',
  pidio: 'Martín, 16/10/2026: «Vinculalas a MaKo».',
} as const;

/**
 * PARA QUÉ se usa el crédito: una lista, y lo que no está no lo usa. Martín, 16/10/2026, textual: «Yo debo
 * decirte cuando utilizar creditos, no tenemos infinitos... Por ahora solo en onboarding.» Hoy entra el chat
 * de Offer, que desde el 16/10/2026 ES el onboarding (Martín: «el onboarding será ese chat de offer»), y lo que
 * ese chat usa de El Archivero para leer los documentos que le mandan, y sólo MIENTRAS el onboarding del
 * negocio está en curso (`soloDuranteElOnboarding`): con el onboarding cerrado, la tab Offer y Second Brain
 * siguen con las keys del negocio y la red gratis, como siempre. 'productos' (el paso del wizard) salió el
 * mismo día, con el wizard: sin él, nada lo llama mientras el onboarding está en curso.
 *
 * Habilitar algo más es sumar una línea acá, y lo decide Martín. Lo que no está recibe un «no» y la cascada
 * sigue como si el crédito no existiera: con datos de clientes, sin nada gratis que entrene (AGENTS.md). El
 * Plan, además, queda afuera siempre (`FEATURES_DEL_PLAN`): el plan de arranque del cierre del onboarding
 * (`plan-seed-ia`) no está, a propósito.
 *
 * Lo INTERNO de MaKo ya no está acá (11/11/2026): las tres filas `soloLaPlataforma` del 26/10 (el editor de landings, la
 * réplica y el analizador, como último recurso) las cubre la regla del crédito para la plataforma
 * (`puedeUsarUnaCuentaDelCredito`, abajo), que va PRIMERO y por la puerta 2. Una autorización que nadie usa es una que nadie
 * revisa. Esta puerta queda sólo para el onboarding.
 */
export const CREDITO_HABILITADO_PARA: ReadonlyArray<{ feature: string; soloDuranteElOnboarding: boolean; para: string }> = [
  { feature: 'El Archivero', soloDuranteElOnboarding: true, para: 'leer los documentos que le manda al chat de arranque' },
  { feature: 'onboarding-extract', soloDuranteElOnboarding: true, para: 'sacar el brief de sus documentos' },
  { feature: 'offer', soloDuranteElOnboarding: true, para: 'el chat de Offer del primer ingreso: nombre, oferta, funnel y primer CRM' },
];

/**
 * EL CRÉDITO DE UNA CUENTA MAX COMO EL CLAUDE DE UN NEGOCIO, sin pegarlo en su fila (22/10/2026). Martín, textual: «habilita los
 * tokens de la API de la cuenta de Mauricio, esos 200, para su Ops Center, que lo pueda usar, así puedo seguir probando en
 * Automations», y «dame luego una opción para deshabilitarle esa API a Mauricio en SuperAdmin». Es una EXCEPCIÓN a «Por ahora
 * solo en onboarding» que da Martín, negocio por negocio, y se apaga en SuperAdmin › Uso (lib/credito-negocio.ts).
 *
 * ⚠️ NO SE PEGA EN LA FILA DEL NEGOCIO: el ws1 es el workspace del ENTORNO (`hidratarCredenciales`), y su fila pasaría a ser la
 * clave de MaKo (la trampa del 18/10). Entra por la puerta 2 (`permisoDeLaClaveDelNegocio`, lib/anthropic.ts) como el crédito
 * del ws10: con el modelo barato, nunca el Plan, y su gasto con la marca del crédito. Su clave propia, si la conecta, gana.
 */
export type CreditoDeUnNegocio = { ws: number; clave: (typeof CLAVES_CREDITO_PLATAFORMA)[number]; quien: string };
export const CREDITO_DE_UN_NEGOCIO: readonly CreditoDeUnNegocio[] = [
  { ws: 1, clave: 'ANTHROPIC_CREDITO_CUENTA1', quien: 'Mauricio (ws1)' },
];
/** El interruptor, en el workspace de la PLATAFORMA (el negocio no lo puede tocar): «apagado» lo apaga; sin fila, prendido. */
export const claveDelInterruptorDeCredito = (ws: number): string => `ia.credito_negocio.${ws}`;

/**
 * EL CRÉDITO DE LOS PLANES 200 PARA LOS GRUPOS DE WHATSAPP DE MaKo (28/10/2026). Martín, textual: «te pedí que habilites las API que
 * tenemos disponibles con todas las cuentas de planes 200», después de que MaKo le contestara cualquier cosa a Leandro (ws10) por un
 * Gemini que no respondió. El turno de texto de un grupo (`FEATURE_DE_LOS_GRUPOS`) de CUALQUIER negocio sin su Claude contesta con el
 * crédito de las cuentas Max que tienen clave, repartido entre ellas (lib/credito-negocio.ts, `cuentasDelCreditoDeLosGrupos`). Entra
 * por la puerta 2 como el crédito asignado: el modelo barato (Haiku), nunca el Plan, y su gasto con la marca del crédito. Su Claude
 * propio, si lo conecta, gana. Se apaga con la fila `CLAVE_INTERRUPTOR_CREDITO_GRUPOS` («apagado») de la plataforma.
 * Las cuentas son las del Uso (`CLAVES_CREDITO_DE_LOS_GRUPOS`, lib/credito-api.ts, de `CUENTAS_DEL_CREDITO`): N, no cuatro fijas.
 */
export const FEATURE_DE_LOS_GRUPOS = 'mako-doer-in';
export const CLAVE_INTERRUPTOR_CREDITO_GRUPOS = 'ia.credito_grupos';
export const esInterruptorPrendido = (valor: string | null | undefined): boolean => valor !== 'apagado';

/**
 * Las funciones de MaKo en WhatsApp que pagan con el crédito de los grupos en CUALQUIER negocio: el turno de texto (y el
 * clasificador y el bot 1 a 1, que usan la misma) y las fotos y los PDF que llegan al grupo (11/11/2026). La de la nota de voz
 * NO: va con Groq (lib/ai-cheap.ts → `notaDeVozDelGrupo`).
 */
export const FEATURES_DE_LOS_GRUPOS: readonly string[] = [FEATURE_DE_LOS_GRUPOS, 'MaKo en WhatsApp · adjunto'];

/**
 * EL CRÉDITO PARA TODO LO DEL ESPACIO DE MaKo, MENOS EL PLAN (11/11/2026). Martín, textual: «MaKo con WhatsApp ya habíamos dicho
 * que eso se gaste con los tokens de las cuentas de Claude 200 dólares que estoy pagando… En general, yo creo que sería bueno que
 * gastemos eso para todo esto en lugar de Gemini, porque es mucho más estable.» Va PRIMERO y Gemini queda de respaldo. Entra por
 * la puerta 2, con las cuentas de los grupos (lib/credito-negocio.ts → `cuentasDelCredito('plataforma')`): Haiku, la marca
 * «(cuenta N)» y nunca el Plan. Vence como toda excepción al gasto de la plataforma.
 */
export const CREDITO_PARA_LA_PLATAFORMA = {
  hasta: '2026-12-31',
  porque: 'El crédito de API de las cuentas Max de Martín ya está pago con la suscripción y vence cada mes sin acumularse; '
    + 'Claude es más estable que el Gemini gratis para lo interno de MaKo.',
  pidio: 'Martín, 11/11/2026: «En general, yo creo que sería bueno que gastemos eso para todo esto en lugar de Gemini, porque '
    + 'es mucho más estable.»',
} as const;
/** El interruptor del crédito de la plataforma, en el workspace de la plataforma: «apagado» lo apaga; sin fila, prendido. */
export const CLAVE_INTERRUPTOR_CREDITO_PLATAFORMA = 'ia.credito_plataforma';

/** Para qué se usa una cuenta del crédito: el interruptor que la gobierna y si guarda el último 10% (lib/credito-negocio.ts). */
export type UsoDelCredito = 'grupos' | 'plataforma';

/**
 * ¿Este pedido puede pagar con una cuenta del crédito? Puro y síncrono: lo usan la puerta 2 (lib/anthropic.ts), la cascada, el
 * test y /modelos-ia.
 *   · una función de los grupos de WhatsApp (`FEATURES_DE_LOS_GRUPOS`): sí, en cualquier negocio, como desde el 28/10;
 *   · cualquier otra que no sea del Plan: sí, SÓLO si el pedido es del espacio de la plataforma y el permiso no venció;
 *   · todo lo demás, no. «No sé si es la plataforma» es no.
 *
 * ⚠️ `esLaPlataforma` lo calcula la PUERTA (`getWorkspaceActual() === wsSuperAdmin()`, y si algo falla, false), nunca un dato que
 * mande el que llama, y nunca contra `OWNER_WS`: el ws1 es Mauricio, un cliente. Lo prueba rompiéndolo tests/credito-plataforma.test.ts.
 */
export function puedeUsarUnaCuentaDelCredito(p: {
  feature?: string; esLaPlataforma?: boolean; pausa?: boolean; hoy?: Date;
}): { ok: true; para: UsoDelCredito } | { ok: false; razon: string } {
  if (p.pausa) return { ok: false, razon: 'Claude está PAUSADO a mano (`mako.claude.pausa`): apaga también el crédito.' };
  const feature = (p.feature ?? '').trim();
  if (!feature) return { ok: false, razon: 'sin `feature` no se sabe qué se compra con el crédito.' };
  if (FEATURES_DEL_PLAN.includes(feature)) return { ok: false, razon: `«${feature}» es del Plan, y el Plan nunca paga con el crédito (Martín, 30/09/2026).` };
  if (FEATURES_DE_LOS_GRUPOS.includes(feature)) return { ok: true, para: 'grupos' };
  if (p.esLaPlataforma !== true) return { ok: false, razon: `«${feature}» usa el crédito sólo en el espacio de MaKo: un negocio paga su IA.` };
  // `fallback: []` (lib/model-catalogo.ts): un juicio que nadie revisa corre con UN solo proveedor. Probar primero el crédito
  // mezclaría dos modelos, que es justo lo que esa marca evita. Acá y no sólo en `chatClaude`: vale para todos los caminos.
  if (CATALOGO_MODELOS.find((f) => f.feature === feature)?.fallback?.length === 0) {
    return { ok: false, razon: `«${feature}» no se degrada de modelo (\`fallback: []\`): no prueba el crédito antes que su proveedor.` };
  }
  if (diaISO(p.hoy ?? new Date()) > CREDITO_PARA_LA_PLATAFORMA.hasta) {
    return { ok: false, razon: `el crédito de la plataforma venció el ${CREDITO_PARA_LA_PLATAFORMA.hasta}. Renuévalo con una fecha nueva o déjalo vencido.` };
  }
  return { ok: true, para: 'plataforma' };
}

/**
 * Lo que corre PRIMERO en una función por el crédito, dicho para una pantalla (la API de /modelos-ia). La misma regla que la puerta
 * (`puedeUsarUnaCuentaDelCredito`): el catálogo dice el `def` (el respaldo), y esto lo que va antes. null = el crédito no va.
 */
export function primeroConElCredito(feature: string, hoy?: Date): string | null {
  const v = puedeUsarUnaCuentaDelCredito({ feature, esLaPlataforma: true, hoy });
  if (!v.ok) return null;
  return v.para === 'grupos'
    ? 'primero: crédito de Claude (Haiku), en los grupos de WhatsApp de todos los negocios sin su Claude'
    : 'primero: crédito de Claude (Haiku), sólo en el espacio de MaKo';
}

/**
 * Una cuenta del crédito no contestó: ¿se prueba la siguiente o se pasa al respaldo (Gemini, la cascada)? Puro.
 *   · sin saldo («credit balance is too low»), 401, 429 o sin la clave cargada: es de ESA cuenta, la otra puede contestar;
 *   · plazo vencido, 5xx, 529 u «overloaded»: es el mismo Anthropic para todas las cuentas, se pasa al respaldo;
 *   · cualquier otro (un 400 por el pedido): la otra cuenta contestaría lo mismo, se pasa al respaldo.
 * ⚠️ SIN RESPALDO, LO PASAJERO SE PRUEBA UNA VEZ MÁS (revisión del 11/11/2026). «Al respaldo» supone que hay uno: un negocio sin su
 * IA en su grupo no tiene ni Gemini ni red, y un 529 o un 5xx de Anthropic suele pasar en un segundo. Con `sinRespaldo`, la
 * PRIMERA falla pasajera (`esFallaPasajeraDelCredito`) prueba la cuenta siguiente; la segunda ya no (`pasajerasAntes`, lo cuenta
 * quien llama): dos cuentas colgadas son 90 s en el turno del grupo, cinco serían 225.
 */
export function queHacerSiFallaElCredito(
  status: number | null | undefined, mensaje: string, o: { sinRespaldo?: boolean; pasajerasAntes?: number } = {},
): 'otra_cuenta' | 'al_respaldo' {
  if (/credit balance is too low|no tiene su clave de Claude/i.test(mensaje)) return 'otra_cuenta';
  if (status === 401 || status === 403 || status === 429) return 'otra_cuenta';
  if (/authentication_error|invalid x-api-key|rate_limit_error/i.test(mensaje)) return 'otra_cuenta';
  if (o.sinRespaldo && (o.pasajerasAntes ?? 0) < 1 && esFallaPasajeraDelCredito(status, mensaje)) return 'otra_cuenta';
  return 'al_respaldo';
}

/** ¿Es una falla de Anthropic que suele pasar sola (5xx, 529 «overloaded», plazo vencido, la red)? Un 400 por el pedido, no. Puro. */
export function esFallaPasajeraDelCredito(status: number | null | undefined, mensaje: string): boolean {
  if (typeof status === 'number' && status >= 500) return true;
  if (/overloaded/i.test(mensaje)) return true;
  return status == null && /timeout|timed out|aborted|ETIMEDOUT|ECONNRESET|fetch failed|socket hang up/i.test(mensaje);
}

/** La marca del gasto de este crédito en `anthropic_usage`, al PRINCIPIO del motivo (ver la del negocio). */
export const MOTIVO_CREDITO_PLATAFORMA = '⚠ crédito de Claude de la plataforma';
/** La marca del gasto de la clave de un NEGOCIO que es el crédito de Max de la plataforma (el ws10, lib/credito-marca.ts). */
export const MOTIVO_CREDITO_SU_CLAVE = `${MOTIVO_CREDITO_PLATAFORMA} (su clave es el crédito)`;
export const esDelCreditoDeLaPlataforma = (motivo: string | null | undefined): boolean =>
  typeof motivo === 'string' && motivo.trimStart().startsWith(MOTIVO_CREDITO_PLATAFORMA);

/** El permiso de la puerta 3: la clave verificada y de qué cuenta es (1 o 2). */
export type PermisoCredito = PermisoClaude & { readonly clave: string; readonly cuenta: number };

/**
 * ¿Esta función de texto puede usar el crédito de la plataforma, con ESTA clave? Puro y síncrono.
 *
 * `creditos` son los VALORES de las dos claves de `CLAVES_CREDITO_PLATAFORMA`, en orden, como los
 * leyó el llamador (null si una no está cargada). La clave pasa sólo si es una de esas dos: eso es
 * lo que impide que cualquier otra clave de la plataforma entre por acá.
 */
export function evaluarCreditoDeLaPlataforma(p: {
  feature?: string; model?: string; pausa?: boolean; hoy?: Date;
  clave?: string | null; creditos: ReadonlyArray<string | null | undefined>;
  /** ¿El onboarding del negocio que pide está en curso? Lo lee el llamador; sin saberlo, se toma que no. */
  onboardingEnCurso?: boolean;
}): { ok: true; permiso: PermisoCredito } | { ok: false; razon: string } {
  if (p.pausa) return { ok: false, razon: 'Claude está PAUSADO a mano (`mako.claude.pausa`): apaga también el crédito de la plataforma.' };
  const feature = (p.feature ?? '').trim();
  if (!feature) return { ok: false, razon: 'sin `feature` no se sabe qué se compra con el crédito.' };
  if (FEATURES_DEL_PLAN.includes(feature)) return { ok: false, razon: `«${feature}» es del Plan, y el Plan nunca paga IA (Martín, 30/09/2026).` };
  // PARA QUÉ: sólo lo que Martín habilitó, en positivo.
  const habilitado = CREDITO_HABILITADO_PARA.find((h) => h.feature === feature);
  if (!habilitado) return { ok: false, razon: `el crédito no está habilitado para «${feature}»: lo decide Martín («Por ahora solo en onboarding»).` };
  if (habilitado.soloDuranteElOnboarding && p.onboardingEnCurso !== true) {
    return { ok: false, razon: `«${feature}» usa el crédito sólo durante el onboarding, y el de este negocio no está en curso.` };
  }
  if (diaISO(p.hoy ?? new Date()) > CREDITO_DE_LA_PLATAFORMA.hasta) {
    return { ok: false, razon: `el permiso del crédito de la plataforma venció el ${CREDITO_DE_LA_PLATAFORMA.hasta}. Renuévalo con una fecha nueva o déjalo vencido.` };
  }
  const clave = typeof p.clave === 'string' ? p.clave.trim() : '';
  if (!clave) return { ok: false, razon: 'no llegó ninguna clave del crédito.' };
  // LA FRONTERA: sólo una de las dos claves con nombre. Cualquier otra —la de la plataforma, la
  // de un negocio, una vacía— no pasa.
  const i = p.creditos.findIndex((x) => typeof x === 'string' && x.trim() !== '' && x.trim() === clave);
  if (i < 0 || i >= CLAVES_CREDITO_PLATAFORMA.length) {
    return { ok: false, razon: 'esa clave no es ninguna de las dos del crédito de la plataforma: sólo esas pasan por esta puerta.' };
  }
  const modelos: readonly string[] = CREDITO_DE_LA_PLATAFORMA.modelos;
  const model = (p.model ?? '').trim() || modelos[0];
  if (!modelos.includes(model)) return { ok: false, razon: `con el crédito de la plataforma sólo ${modelos.join(', ')}, no «${model}».` };
  return { ok: true, permiso: fabricar({ model, feature, porque: CREDITO_DE_LA_PLATAFORMA.porque, clave, cuenta: i + 1 }) };
}

export class VetoClaude extends Error {
  constructor(readonly feature: string, readonly model: string, readonly razon: string) {
    super(`Claude vetado — ${razon}`);
    this.name = 'VetoClaude';
  }
}

/** La versión que usa el runtime: devuelve el permiso o CORTA. */
export function permisoDeGasto(p: { feature?: string; model?: string; pausa?: boolean; hoy?: Date }): PermisoClaude {
  const v = evaluarPermiso(p);
  if (!v.ok) throw new VetoClaude(p.feature ?? '', p.model ?? '', v.razon);
  return v.permiso;
}

/** Los modelos de Claude que una feature puede elegir en /modelos-ia. Vacío = ninguno. */
export function modelosPermitidos(feature: string): string[] {
  return CLAUDE_PERMITIDO.find((p) => p.feature === feature)?.modelos ?? [];
}

/** Los permisos que vencen dentro de N días. Los miran el test y /modelos-ia. */
export function permisosPorVencer(dias = 14, hoy = new Date()): PermisoDeclarado[] {
  const limite = diaISO(new Date(hoy.getTime() + dias * 86_400_000));
  return CLAUDE_PERMITIDO.filter((p) => p.hasta <= limite);
}
