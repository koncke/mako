// =============================================================================
// ia-keys — VARIAS API keys por proveedor gratis (rotar entre CUENTAS)
// =============================================================================
// La cascada de `ai-cheap` rota entre PROVEEDORES (Gemini → Groq → Cerebras → …).
// Esto agrega el eje que faltaba: rotar entre CUENTAS del mismo proveedor. El free
// tier se agota por CUENTA, no por proveedor, así que quien tiene tres cuentas de
// Gemini tiene tres veces la cuota — y hasta acá no había forma de cargarlas: la
// tabla `credenciales` es una fila por (workspace, clave) y la clave era una sola.
//
// Cómo: claves DERIVADAS de la base, `GEMINI_API_KEY` · `GEMINI_API_KEY_2` ·
// `GEMINI_API_KEY_3`. Sin migración, sin tabla nueva y sin tocar el cifrado: para
// `credenciales` son tres filas más, con la misma auditoría y el mismo aislamiento.
//
// Vive SIN `server-only` a propósito (misma razón que `lib/model-catalogo.ts`): lo
// consumen el server (ai-cheap, ia-cuotas) y los tests, que lo importan sueltos.
//
// ⚠️ Acá decía además «la UI (metodo-catalogo llega al bundle del cliente)», y eso
// dejó de ser cierto el 25/08/2026: metodo-catalogo es `server-only` y ya no viaja
// al navegador. Hoy NINGÚN componente cliente importa este módulo (verificado). Si
// alguna vez hiciera falta cerrarlo, el camino está libre.

/** Los proveedores GRATIS que admiten varias cuentas. Anthropic y OpenAI quedan
 *  afuera a propósito: cobran por token, así que una segunda cuenta no suma cuota
 *  gratis — suma otra factura. Rotar entre cuentas pagas esconde el gasto. */
/**
 * Los proveedores que admiten VARIAS cuentas, y que son los que se le ofrecen al usuario
 * como «IA gratis para conectar».
 *
 * ⚠️ CEREBRAS SE FUE, y no por gusto: medido el 16/08 contra las SIETE keys cargadas en
 * cinco workspaces distintos, las siete devuelven HTTP 402 «Payment required to access
 * this resource». No es una cuenta sin saldo: es que ya no hay tier gratis. Dejarlo en la
 * lista le pide al usuario que vaya a sacar una key que NUNCA va a funcionar, y encima
 * suma un viaje de ida y vuelta a cada cascada para volver con un 402.
 *
 * Antes de sacar o agregar uno acá: probá una llamada real con las keys que YA existen en
 * la base. «Está en la documentación» no es evidencia de nada.
 */
export const PROVS_MULTIKEY = ['gemini', 'groq'] as const;
export type ProvMultiKey = (typeof PROVS_MULTIKEY)[number];

/** La clave BASE de cada proveedor (la que ya existía y la que leen las libs). */
export const ENV_BASE: Record<ProvMultiKey, string> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
};

/**
 * Cuántas cuentas por proveedor.
 *
 * ⚠️ ES UN TOPE DE NOMBRES, NO DE PRODUCTO — y esa distinción es lo único que
 * mantiene CERRADA la whitelist del API. La cadena es: `MAX_KEYS` → `clavesDe` →
 * `CLAVES_EXTRA` → `keysExtra` (lib/metodo-catalogo.ts) → `ENVS_METODO` → los
 * guards de guardar / borrar / revelar de app/api/integraciones/credencial.
 * Subir el número es gratis y seguro: la lista sigue siendo una lista.
 *
 * ⛔ LO QUE NO SE PUEDE HACER es reemplazar la lista por un patrón tipo
 * `/_API_KEY(_\d+)?$/` «para que no tenga tope». `guardarCredencial` termina en
 * `process.env[clave] = valor` cuando el workspace es el dueño, y `cfgDe()` relee
 * `process.env.CHEAP_BASE_URL` en CADA llamada: un patrón que acepte una clave de
 * más es **todo el tráfico de IA de todos los inquilinos saliendo hacia otro host
 * con los Bearer adentro**. La distancia entre «acepta una de más» y eso es de una
 * línea, así que el tope se sube cambiando este número y nada más.
 *
 * POR QUÉ 10: el free tier de Gemini son 250k tokens/día POR CUENTA
 * (`LIMITES_PROVEEDOR` en lib/ia-cuotas.ts) y el ws1 consume ~860k/día medidos.
 * Diez cuentas son 2,5M: casi 3× lo que se gasta. Si alguna vez no alcanza, se
 * sube ACÁ y la UI, la whitelist y la cascada se enteran solas.
 */
export const MAX_KEYS = 10;

const esProvMultiKey = (p: string): p is ProvMultiKey => (PROVS_MULTIKEY as readonly string[]).includes(p);

/** Las claves de un proveedor EN ORDEN de uso: base primero, después las extra. */
export function clavesDe(prov: string): string[] {
  if (!esProvMultiKey(prov)) return [];
  const base = ENV_BASE[prov];
  return [base, ...Array.from({ length: MAX_KEYS - 1 }, (_, i) => `${base}_${i + 2}`)];
}

/**
 * Los nombres de clave que hay que PROBAR para un proveedor. Nunca vacío.
 *
 * ⚠️ ES OTRA PREGUNTA QUE `clavesDe`, Y CONFUNDIRLAS DEJÓ A OPENAI FUERA DEL PRODUCTO
 * DURANTE SEIS SEMANAS. `clavesDe` contesta «¿cuántas CUENTAS admite?» y devuelve `[]`
 * para los que cobran por token, a propósito: rotar entre cuentas pagas no suma cuota,
 * suma facturas. Esto contesta «¿por qué nombre de credencial pregunto?», y para ésos la
 * respuesta es una sola clave, no ninguna.
 *
 * El bug vivía en `provsDe` (lib/ai-cheap.ts), que iteraba `clavesCargadas` —derivada de
 * `clavesDe`— y por eso devolvía SIEMPRE cero instancias de OpenAI. Es el último escalón
 * de las tres cascadas (`CASCADA_GRATIS`, `CASCADA_DOCS`, `CASCADA_STT`), o sea el
 * respaldo que existe justo para cuando los gratis se caen, y no corrió nunca: a un
 * workspace cuya única key fuera de OpenAI el producto le contestaba «no tenés IA».
 *
 * Vive acá y no en `ai-cheap` por lo de siempre: `ai-cheap` es `server-only` y ningún
 * test lo puede importar, así que la condición quedaba sin red justo donde más duele.
 */
export function clavesAProbar(prov: string): string[] {
  const c = clavesDe(prov);
  // `'openai'.toUpperCase()` ya es `OPENAI`, así que el caso especial que había acá
  // producía exactamente la misma cadena. Se deja el derivado solo.
  return c.length ? c : [`${prov.toUpperCase()}_API_KEY`];
}

/**
 * Cuántas claves de `provs` tienen fila en `enBase` (los nombres cargados en `credenciales` de un workspace). Cuenta
 * también a los de UNA sola clave (su Claude, su GPT), por `clavesAProbar`.
 *
 * ⚠️ LA MISMA TRAMPA DE ARRIBA, UNA CAPA MÁS ARRIBA (24/10/2026, el cartel del ws21). `contarKeysIA` del doer de WhatsApp
 * sumaba `clavesCargadas(prov)`, que deriva de `clavesDe` y devuelve `[]` para anthropic y openai: un negocio con su
 * Claude o su GPT contaba CERO claves, y si su IA fallaba el cartel le decía «todavía no cargaste ninguna API key». Son
 * filas, no instancias que contesten: quien las usa igual resuelve con `credWs`.
 */
export function contarClavesCargadas(enBase: ReadonlySet<string>, provs: readonly string[]): number {
  return [...new Set(provs)].reduce((n, p) => n + clavesAProbar(p).filter((c) => enBase.has(c)).length, 0);
}

/** Todas las claves extra del catálogo (las que hay que sumar a la whitelist). */
export const CLAVES_EXTRA: string[] = PROVS_MULTIKEY.flatMap((p) => clavesDe(p).slice(1));

/**
 * La clave BASE de la que deriva una extra (`GEMINI_API_KEY_2` → `GEMINI_API_KEY`).
 * Devuelve la misma clave si no es una extra. Lo usa la ayuda por campo: el tutorial
 * de "cómo consigo esta key" es el mismo para la cuenta 1 y para la 3.
 */
export function claveBaseDe(clave: string): string {
  const m = clave.match(/^(.+)_(\d+)$/);
  if (!m) return clave;
  return CLAVES_EXTRA.includes(clave) ? m[1] : clave;
}

/** Nº de cuenta de una clave (1 para la base). Es lo que la UI muestra como rótulo. */
export function slotDe(clave: string): number {
  const m = clave.match(/^(.+)_(\d+)$/);
  return m && CLAVES_EXTRA.includes(clave) ? Number(m[2]) : 1;
}

/**
 * Sufijo del campo que dice DE QUÉ CUENTA es una key: `GEMINI_API_KEY_2_ACCOUNT`.
 *
 * ⚠️ El email NO se puede sacar de la API de ningún proveedor. Verificado el
 * 2026-08-13 en los cinco: una key de Gemini cuelga de un PROYECTO de Google, no de
 * una persona («Standard keys don't identify a caller», ai.google.dev), y el
 * `GET /api/v1/key` de OpenRouter devuelve label/límites/uso pero ningún mail. Groq,
 * Cerebras y Mistral no documentan endpoint de cuenta. Así que **lo escribe la
 * persona**: lo que se automatiza es no volver a preguntarlo y mostrarlo siempre.
 *
 * Vive acá, con los nombres de clave, por «una cosa, un lugar»: el que deriva
 * `GEMINI_API_KEY_2` es el mismo que deriva su acompañante.
 */
export const SUFIJO_CUENTA = '_ACCOUNT';

/** El campo «de qué cuenta es» de una key. `GEMINI_API_KEY` → `GEMINI_API_KEY_ACCOUNT`. */
export const claveCuentaDe = (clave: string): string => `${clave}${SUFIJO_CUENTA}`;

/** true si la clave es un rótulo de cuenta y no un secreto (para no enmascararla). */
export const esClaveDeCuenta = (clave: string): boolean => clave.endsWith(SUFIJO_CUENTA);

/** Todos los rótulos de cuenta del catálogo: van a la whitelist junto con las keys. */
export const CLAVES_CUENTA: string[] = PROVS_MULTIKEY.flatMap((p) => clavesDe(p).map(claveCuentaDe));

/**
 * Las keys que un negocio puede usar como PROPIAS: las de su fila que NO son una copia de una de la plataforma.
 *
 * ⚠️ Medido el 16/10/2026: la `GEMINI_API_KEY` de la fila del ws1 (Mauricio, un cliente) es la MISMA que una de
 * la plataforma, y su `OPENAI_API_KEY` también. Toda cascada prueba primero las keys «del negocio», así que los
 * pedidos del ws1 con datos de SUS clientes (el turno con herramientas, el análisis del lead, las notas de voz)
 * iban a la key gratis de la agencia, que entrena con lo que recibe. El corte por datos de clientes mira sólo la
 * red de la plataforma, y por esta puerta no pasaba. Es la regla de la clave de Anthropic del negocio
 * (`evaluarClaveDelNegocio`) y de la de Resend (`esDeLaPlataforma`): una key de la plataforma copiada en la fila
 * de un cliente sigue siendo de la plataforma. Fuera de acá, sólo entra por la red, que corta con datos de clientes.
 *
 * Pura, para que tenga test: `huellas` son las de las keys de la plataforma (`null` = no se pudieron leer) y
 * `huella` la función que las calcula. El workspace de la plataforma usa las suyas tal cual. Si no se sabe cuáles
 * son las de la plataforma, no se arriesga ninguna: fail-closed.
 */
export function sinCopiasDeLaPlataforma<T extends { key: string }>(
  provs: T[],
  p: { ws: number | null; wsPlataforma: number | null; huellas: ReadonlySet<string> | null; huella: (k: string) => string },
): T[] {
  if (p.wsPlataforma != null && p.ws === p.wsPlataforma) return provs;
  if (p.wsPlataforma == null || p.huellas == null) return [];
  const huellas = p.huellas;
  return provs.filter((x) => !huellas.has(p.huella(x.key)));
}

/**
 * LA TARJETA DE UNA IA EN /integraciones DICE LO QUE MaKo PUEDE USAR (tickets #5 y #6, 18/10/2026).
 *
 * Medido ese día, sólo leyendo: en el ws1 las siete tarjetas de IA decían «Conectada y operativa», y MaKo no tenía
 * con qué contestarle. Tres son copias de la plataforma en su fila (Gemini, OpenAI, Claude), y en producción las demás
 * también: la hidratación del arranque copia la fila del ws1 (`OWNER_WS`) al entorno, y la regla de arriba descarta
 * toda key igual a una del entorno. La grilla miraba `credWs` («hay algo guardado, o el entorno si es el ws1»); la
 * cascada mira «es SUYA». Ahora la tarjeta hace la pregunta de la cascada (lib/integraciones.ts → `iaDelNegocio`).
 *
 * `fila` = el negocio tiene la key base guardada en SU fila; `propia` = MaKo la puede usar como suya.
 *
 * ⚠️ `delEntorno` = es el workspace cuya fila se copia a `process.env` (lib/credenciales.ts → `esNegocioDelEntorno`;
 * hasta el 18/10, el ws1). Ahí la tarjeta NO ofrece pegar una key ni dice «la de MaKo» (el Cerebro, 18/10/2026): lo que pegara pasaría
 * a ser la key de la plataforma y su workspace seguiría sin IA. Dice que la configura el equipo, y gana sobre todo lo demás.
 */
export function veredictoDeIA(p: { fila: boolean; propia: boolean; delEntorno?: boolean }): 'conectada' | 'copia' | 'falta' | 'equipo' {
  if (p.delEntorno) return 'equipo';
  if (p.propia) return 'conectada';
  return p.fila ? 'copia' : 'falta';
}

/**
 * ¿Es una credencial de IA? Las de la cascada (todas sus cuentas y sus rótulos `_ACCOUNT`), OpenAI, Cerebras y la clave
 * de Anthropic. Desde el 18/10/2026 éstas salen del workspace de la PLATAFORMA y no del ws1 (lib/credenciales.ts →
 * `wsDelEntorno`; Martín: «separá el ws1 de las claves de la plataforma... para que Mauricio pueda conectar su propia
 * IA»). Las del crédito de Claude (`ANTHROPIC_CREDITO_CUENTA*`) no entran: ya se leen sólo de la plataforma (veto).
 */
const IA_DE_UNA_CUENTA: ReadonlySet<string> = new Set([
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  // ⚠️ APIMART: la GENERACIÓN (video e imagen) la paga MaKo, medida en MaKo Tokens — Martín, 7/11: «muchos
  // clientes no tienen Flow… quiero poder ofrecerles otra API» y «para que nosotros costeemos eso». Si esta
  // clave NO estuviera en este set, `wsDelEntorno` la resolvería contra `OWNER_WS`, **que vale 1 y el 1 es
  // Mauricio, un CLIENTE**: la clave de generación de la plataforma saldría de la fila de un cliente, y el día
  // que él pegue algo ahí, todo MaKo generaría con su cuenta. Es exactamente la trampa que `lib/elevenlabs.ts`
  // dejó escrita y la misma que se pagó con `RESEND_API_KEY` el 4/11.
  'APIMART_API_KEY',
]);
export function esClaveDeIA(clave: string): boolean {
  const c = esClaveDeCuenta(clave) ? clave.slice(0, -SUFIJO_CUENTA.length) : clave;
  return IA_DE_UNA_CUENTA.has(c) || PROVS_MULTIKEY.some((p) => clavesDe(p).includes(c));
}

/** Lo que lee el negocio cuando lo guardado es una copia de la plataforma (la tarjeta y su modal). */
export const POR_QUE_IA_DE_MAKO = 'Esa key es la de MaKo, no la tuya: pega la de tu cuenta.';
/** Lo que lee el workspace del entorno en sus IA: sin formulario para pegar nada. */
export const POR_QUE_LA_CONFIGURA_MAKO = 'La configura el equipo de MaKo.';
