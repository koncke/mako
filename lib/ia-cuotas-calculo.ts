// =============================================================================
// ia-cuotas-calculo — la ARITMÉTICA de la cuota, sin base de datos
// =============================================================================
// Vive separado de `ia-cuotas.ts` y SIN `server-only` por la misma razón que
// `lib/fallo-ia-texto.ts` y `lib/ia-keys.ts`: lo que decide si a un cliente se le
// dice «te quedaste sin cuota» tiene que poder probarse con números, y el módulo
// de al lado importa Supabase en la primera línea.
//
// Acá no hay I/O: entran filas de `anthropic_usage` y límites, sale el reparto.
// =============================================================================

export type LimiteProv = { label: string; rpd?: number; tokensDia?: number; nota?: string };
export type UsoProv = {
  requests: number; tokens: number;
  /**
   * Cuantas veces HOY el proveedor le dijo 429 a esta cuenta.
   *
   * No sale del gauge: el gauge estima cuanto queda contra un tope que ponemos
   * NOSOTROS, y un rebote es el proveedor CONTESTANDO que ya no hay. Las dos cifras
   * se contradicen todo el tiempo y la que manda es esta — el tope de Gemini estuvo
   * 1440 veces mal durante meses y el gauge decia «te sobra» mientras las llamadas
   * rebotaban. Un tope inventado es una opinion; un 429 es un hecho.
   */
  rebotes: number;
};

/**
 * Como se marca en `anthropic_usage` la llamada que REBOTO por cuota.
 *
 * Va en `model` y no en `motivo` porque el motivo lo escribe cada caller y no hay
 * forma de contarlo; el modelo es del sistema. Mismo molde que `vetado:` del veto de
 * Claude, y por la misma razon: una fila de 0 tokens y US$0 en el MISMO lugar que el
 * dueno ya mira. Un 429 que solo deja un `console.warn` no lo lee nadie, y a los 60
 * minutos en Vercel ya no existe.
 */
export const MARCA_REBOTE = 'rebote429:';

/**
 * Los topes de cada free tier.
 *
 * ⚠️ `gemini` NO lleva `tokensDia`, y eso es un arreglo, no un olvido. Tenía
 * 250_000, que es el tope por MINUTO (TPM) del free tier de 2.5 Flash usado como si
 * fuera el del DÍA — 1440 veces más chico. Medido contra `anthropic_usage` el
 * 19/09/2026: veinte días-workspace lo pasaron, de 139% a 469% (ws9 el 05/08:
 * 1.171.928 tokens en 144 pedidos), y Google contestó TODAS esas llamadas. Un tope
 * que se revienta a diario sin que el proveedor se queje no es un tope: es un número
 * inventado que apaga la rotación y le dice al cliente que se quedó sin nada.
 *
 * Lo que Gemini sí limita por día son los PEDIDOS (250 rpd), y ese contador nunca se
 * acercó: el pico medido es 144 (58%).
 *
 * Antes de volver a poner un `tokensDia` acá: medilo contra las keys que YA están en
 * la base. Es la misma regla que `lib/ia-keys.ts` exige para tocar la lista de
 * proveedores — «está en la documentación» no es evidencia de nada.
 */
export const LIMITES_PROVEEDOR: Record<string, LimiteProv> = {
  gemini: { label: 'Gemini', rpd: 250, nota: '2.5 Flash free' },
  groq: { label: 'Groq', tokensDia: 500_000, nota: 'plan gratis' },
  mistral: { label: 'Mistral', rpd: 500, nota: 'free (Experiment)' },
  openrouter: { label: 'OpenRouter', rpd: 50, nota: 'modelos :free sin créditos' },
};

/**
 * OpenRouter cuando el usuario YA cargó créditos. Mismo caso que `GEMINI_PAGO` y por la
 * misma razón: el tier gratis topea en 50 pedidos por día, y seguir aplicándole ese techo
 * a una cuenta con saldo la manda al fondo de la cascada TENIENDO PLATA. Pagar para que
 * te sigan racionando es la peor cara del bug.
 *
 * Sin `rpd`: con créditos el límite lo pone el saldo, no un contador diario, y ese saldo
 * se lee de la API (lib/openrouter-saldo.ts) en vez de cargarse a mano.
 */
export const OPENROUTER_PAGO: LimiteProv = { label: 'OpenRouter', nota: 'créditos cargados' };

/**
 * Gemini con billing activo: el free tier topea en 250 pedidos/día y con créditos sube
 * muchísimo, así que no lo saltamos de la rotación.
 *
 * Sin `tokensDia` por lo mismo que el free (ver `LIMITES_PROVEEDOR`): el 4M que había acá
 * era el 250k inventado multiplicado a ojo, y heredaba el error de unidad.
 */
export const GEMINI_PAGO: LimiteProv = { label: 'Gemini', rpd: 30_000, nota: 'créditos cargados (tier pago)' };

/** A partir de este % de cuota lo tratamos como «sin cuota» (saltar antes del 429). */
export const UMBRAL = 0.9;

/**
 * La clave con la que se indexa el uso de UNA cuenta: `gemini#1`, `gemini#2`…
 *
 * ⚠️ EL `#1` NO ES COSMÉTICO. Esto devolvía `provider` pelado para la cuenta 1, o sea
 * exactamente la misma clave donde `plegarUso` acumula el TOTAL del proveedor. Las dos
 * cosas escribían en el mismo casillero, así que la fila «cuenta 1» del panel mostraba
 * la SUMA de todas las cuentas contra el tope de UNA: con tres keys, el triple.
 *
 * Y se realimentaba: `ordenarCuentas` ordena por % consumido, la cuenta 1 salía siempre
 * la más gastada del mundo, se probaba ÚLTIMA y nunca se usaba — medido en ws9, cero
 * llamadas en la cuenta 1 en treinta días mientras la 2 y la 3 hacían todo el trabajo.
 *
 * El agregado por proveedor sigue existiendo, y sigue viviendo en la clave pelada
 * (`gemini`): lo consumen el panel de costo y los reportes. Lo que NO puede es compartir
 * casillero con una cuenta.
 */
export const claveCuenta = (provider: string, cuenta = 1): string => `${provider}#${Math.max(1, cuenta)}`;

/** Fila de `anthropic_usage` que le importa a la cuota. */
export type FilaUso = {
  provider: string | null;
  cuenta: number | null;
  /** Para distinguir la llamada que reboto (`MARCA_REBOTE`) de la que contesto. */
  model?: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
};

/**
 * Pliega las filas del día en uso por CUENTA (`gemini#2`) y por PROVEEDOR (`gemini`).
 *
 * El agregado se mantiene porque responde «cuánto consumí hoy». Lo que no responde
 * —y por eso vive aparte— es «cuánto me queda»: el free tier se agota por cuenta, y
 * tres keys no son un tanque de 750k sino tres tanques que no se trasvasan.
 */
export function plegarUso(filas: FilaUso[]): Record<string, UsoProv> {
  const out: Record<string, UsoProv> = {};
  const sumar = (k: string, tok: number, reboto: boolean): void => {
    const u = out[k] ?? { requests: 0, tokens: 0, rebotes: 0 };
    u.requests += 1;
    u.tokens += tok;
    if (reboto) u.rebotes += 1;
    out[k] = u;
  };
  for (const r of filas) {
    const p = r.provider ?? 'anthropic';
    // `cuenta` es NULL en las filas anteriores a la mig 0132: se leen como 1, que es la
    // verdad histórica (antes de multi-key había una sola key por proveedor).
    const tok = (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0);
    // ⚠️ UN REBOTE CUENTA COMO PEDIDO, y es a propósito: el 429 salió, viajó y el
    // proveedor lo contó contra el límite diario de pedidos. Lo que no suma es
    // TOKENS, porque no los gastó — la fila nace en 0 y 0.
    const reboto = typeof r.model === 'string' && r.model.startsWith(MARCA_REBOTE);
    sumar(claveCuenta(p, Number(r.cuenta) || 1), tok, reboto);
    sumar(p, tok, reboto);
  }
  return out;
}

/** % de cuota consumida (el MAYOR entre pedidos/día y tokens/día). 0 = libre, 1 = tope. */
/** El % consumido. Toma sólo los dos números que le hacen falta: `rebotes` no
 *  participa de la cuenta —manda en el veredicto, no en la barra— y exigirlo
 *  obligaría a inventarlo en cada llamador que sólo quiere medir. */
export function pctDe(uso: Pick<UsoProv, 'requests' | 'tokens'>, lim: LimiteProv): number {
  const pr = lim.rpd ? uso.requests / lim.rpd : 0;
  const pt = lim.tokensDia ? uso.tokens / lim.tokensDia : 0;
  return Math.min(1, Math.max(pr, pt));
}

/** El uso de una cuenta, o cero si esa cuenta todavía no gastó nada. */
export const usoDeCuenta = (uso: Record<string, UsoProv>, provider: string, cuenta: number): UsoProv =>
  uso[claveCuenta(provider, cuenta)] ?? { requests: 0, tokens: 0, rebotes: 0 };
