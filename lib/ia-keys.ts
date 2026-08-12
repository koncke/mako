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
// Vive SIN `server-only` a propósito (misma razón que `lib/model-catalogo.ts`): el
// catálogo lo consumen el server (ai-cheap, ia-cuotas), la UI (metodo-catalogo llega
// al bundle del cliente) y los tests. Un `server-only` acá dejaría sin red la parte
// que decide qué keys existen.

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
 * Cuántas cuentas por proveedor. Tres no es un número mágico: es el techo de lo que
 * una persona sostiene sin perder de vista cuál es cuál. Si alguna vez sube, sube
 * ACÁ y la UI, la whitelist del API y la cascada se enteran solas.
 */
export const MAX_KEYS = 3;

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
