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
export const PROVS_MULTIKEY = ['gemini', 'groq', 'cerebras', 'mistral', 'openrouter'] as const;
export type ProvMultiKey = (typeof PROVS_MULTIKEY)[number];

/** La clave BASE de cada proveedor (la que ya existía y la que leen las libs). */
export const ENV_BASE: Record<ProvMultiKey, string> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
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
