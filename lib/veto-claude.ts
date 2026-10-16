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
export type PermisoClaveDelNegocio = PermisoClaude & { readonly clave: string };

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
  modelos: ['claude-haiku-4-5'],
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
export const esDeLaClaveDelNegocio = (motivo: string | null | undefined): boolean =>
  typeof motivo === 'string' && motivo.trimStart().startsWith(MOTIVO_CLAVE_DEL_NEGOCIO);

/**
 * Las funciones del PLAN no pasan por la puerta 2, aunque la clave sea del negocio. Martín,
 * 30/09/2026, textual: «NO, JAMÁS algo pago para el plan» y «nunca sonnet ni nada pago para
 * el plan. JAMÁS». El Plan es lo que más se usa: con la clave del negocio, el Perro y la
 * lectura de reuniones se comerían su crédito de Max en silencio. Sacar una de acá es una
 * decisión suya, no un arreglo.
 */
export const FEATURES_DEL_PLAN: readonly string[] = [
  'mako-guardian', 'checklist-coach', 'plan-seed-ia', 'plan-fathom', 'plan-criterio',
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
}): { ok: true; permiso: PermisoClaveDelNegocio } | { ok: false; razon: string } {
  if (p.pausa) return { ok: false, razon: 'Claude está PAUSADO a mano (`mako.claude.pausa`): apaga también la clave del negocio.' };
  const feature = (p.feature ?? '').trim();
  if (!feature) return { ok: false, razon: 'sin `feature` no se sabe qué se compra, ni con la plata del negocio.' };
  if (FEATURES_DEL_PLAN.includes(feature)) return { ok: false, razon: `«${feature}» es del Plan, y el Plan nunca paga IA (Martín, 30/09/2026).` };
  const clave = typeof p.clave === 'string' ? p.clave.trim() : '';
  if (!clave || clave.startsWith('PENDING')) return { ok: false, razon: 'el negocio no tiene su clave de Anthropic cargada.' };
  // LA FRONTERA. Comparada sin espacios: una copia pegada con un espacio de más sigue siendo
  // la clave de la plataforma.
  if (p.clavesPlataforma.some((x) => typeof x === 'string' && x.trim() !== '' && x.trim() === clave)) {
    return { ok: false, razon: 'esa clave es una copia de la de la PLATAFORMA: con ella paga MaKo, y eso sólo pasa por la lista blanca.' };
  }
  const modelos: readonly string[] = CLAUDE_CON_CLAVE_DEL_NEGOCIO.modelos;
  const model = (p.model ?? '').trim() || modelos[0];
  if (!modelos.includes(model)) return { ok: false, razon: `con la clave del negocio sólo ${modelos.join(', ')}, no «${model}».` };
  return { ok: true, permiso: fabricar({ model, feature, porque: CLAUDE_CON_CLAVE_DEL_NEGOCIO.porque, clave }) };
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
 * decirte cuando utilizar creditos, no tenemos infinitos... Por ahora solo en onboarding.» Hoy entran las
 * funciones del wizard del primer ingreso, y sólo MIENTRAS el onboarding del negocio está en curso
 * (`soloDuranteElOnboarding`): las mismas features corren después desde Second Brain, y ahí no. Y el chat
 * de Offer, que desde el 16/10/2026 ES el onboarding (Martín: «el onboarding será ese chat de offer»): con
 * el onboarding cerrado, la tab Offer sigue con las keys del negocio y la red gratis, como siempre.
 *
 * Habilitar algo más es sumar una línea acá, y lo decide Martín. Lo que no está recibe un «no» y la cascada
 * sigue como si el crédito no existiera: con datos de clientes, sin nada gratis que entrene (AGENTS.md). El
 * Plan, además, queda afuera siempre (`FEATURES_DEL_PLAN`): el plan de arranque del cierre del wizard
 * (`plan-seed-ia`) no está, a propósito.
 */
export const CREDITO_HABILITADO_PARA: ReadonlyArray<{ feature: string; soloDuranteElOnboarding: boolean; para: string }> = [
  { feature: 'El Archivero', soloDuranteElOnboarding: true, para: 'leer los documentos que sube en el wizard' },
  { feature: 'onboarding-extract', soloDuranteElOnboarding: true, para: 'sacar el brief de sus documentos' },
  { feature: 'productos', soloDuranteElOnboarding: true, para: 'armar su catálogo en el paso Productos' },
  { feature: 'offer', soloDuranteElOnboarding: true, para: 'el chat de Offer del primer ingreso: nombre, oferta, funnel y primer CRM' },
];

/** La marca del gasto de este crédito en `anthropic_usage`, al PRINCIPIO del motivo (ver la del negocio). */
export const MOTIVO_CREDITO_PLATAFORMA = '⚠ crédito de Claude de la plataforma';
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
