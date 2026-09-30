import 'server-only';

// =============================================================================
// ia-cuotas — cuánto le queda a cada IA GRATIS hoy, para rotar ANTES del 429
// =============================================================================
// Cada free tier tiene un límite (pedidos/día y/o tokens/día). Contamos el uso de HOY
// desde anthropic_usage (una fila por llamada) y, si un proveedor está cerca del tope,
// lo SALTAMOS de la rotación en vez de esperar a que tire 429. También alimenta el gauge
// "cuánto queda" de /integraciones. Global (contra las keys de la agencia), igual que el
// panel de costo.
//
// La ARITMÉTICA vive en `ia-cuotas-calculo.ts`, sin `server-only` y sin base: los
// límites, el plegado de las filas y el % consumido se prueban con números en
// tests/ia-cuotas.test.ts. Acá queda lo que necesita Supabase.

import { getSupabaseServer } from '@/lib/supabase';
import { leerPorPaginas } from '@/lib/supabase-paginado';
import { getSaldo, recordUsage } from '@/lib/anthropic-usage';
import { openrouterConCredito } from './openrouter-saldo';
import { credWs } from '@/lib/credenciales';
import { clavesDe, slotDe } from '@/lib/ia-keys';
import { clavesCargadas } from '@/lib/ia-keys-ws';
import { OWNER_WS, getWorkspaceActual } from '@/lib/workspace';
import {
  GEMINI_PAGO,
  LIMITES_PROVEEDOR,
  OPENROUTER_PAGO,
  UMBRAL,
  claveCuenta,
  MARCA_REBOTE,
  pctDe,
  plegarUso,
  usoDeCuenta,
} from '@/lib/ia-cuotas-calculo';
import type { FilaUso, LimiteProv, UsoProv } from '@/lib/ia-cuotas-calculo';

export { LIMITES_PROVEEDOR, UMBRAL, claveCuenta, MARCA_REBOTE };

/**
 * ANOTA que una cuenta rebotó por cuota. Best-effort: nunca tira.
 *
 * ⚠️ POR QUÉ EXISTE. El 429 dejaba un `console.warn` y nada más, y esta casa ya tiene
 * escrito que un warn no es un control: los logs de Vercel no los lee nadie y a los 60
 * minutos no existen. Sin esto, «la cuenta 1 está agotada desde el martes» y «hoy no
 * se usó» se ven exactamente igual desde la app — los dos son una barra en cero.
 *
 * Se escribe una fila de 0 tokens y US$0, el mismo molde que usa el veto de Claude
 * para registrar lo que bloqueó: en el lugar que el dueño ya mira, no en uno nuevo.
 */
export async function anotarRebote429(provider: string, cuenta: number, modelo: string, detalle: string): Promise<void> {
  await recordUsage(
    'cuota', `${MARCA_REBOTE}${modelo || '-'}`, {},
    `429 de ${provider} en la cuenta ${cuenta}: ${detalle.slice(0, 300)}`,
    provider, cuenta,
  ).catch(() => {});
}
export type { LimiteProv, UsoProv };

/**
 * De qué CUENTAS del catálogo son las keys que este workspace tiene cargadas.
 *
 * ⚠️ Devuelve SLOTS, no un rango 1..n, y esa es toda la diferencia: `ai-cheap`
 * registra el consumo con `clavesProv(prov).indexOf(clave) + 1`, o sea que
 * `GEMINI_API_KEY_3` es la cuenta 3 aunque sea la segunda cargada. Contando 1..n,
 * con keys en los slots 1 y 3 el panel pintaba una «cuenta 2» que no existe
 * —siempre en 0%, o sea siempre libre— y el uso real de la 3 no aparecía en
 * ninguna fila. Y como `agotado` exige que lo estén TODAS, esa fila fantasma
 * alcanzaba para que el proveedor no se viera agotado nunca.
 *
 * Vive acá y no en `ai-cheap` a propósito: `ai-cheap` ya importa este módulo
 * (`ordenarPorCuota`), y ponerlo del otro lado cerraba un ciclo de imports.
 */
export async function slotsCargados(prov: string, ws?: number): Promise<number[]> {
  // Ojo con el orden de las dos preguntas, que dan lo mismo y significan distinto:
  // «este proveedor no admite varias cuentas» (openai/anthropic) lo contesta
  // `clavesDe` y vale 1; «no tiene ninguna cargada» lo contesta `clavesCargadas`
  // y vale 0.
  if (!clavesDe(prov).length) return [1]; // proveedor sin multi-key (openai/anthropic)
  // Las cargadas, no las MAX_KEYS del catálogo: con el tope en 10 esto eran 10
  // SELECT por proveedor en CADA pintada del gauge (50 con los 5 proveedores).
  const claves = await clavesCargadas(prov, ws);
  const slots: number[] = [];
  for (const c of claves) if (await credWs(c, ws)) slots.push(slotDe(c));
  return slots.sort((a, b) => a - b);
}

/**
 * Cuántas CUENTAS (API keys) tiene cargadas este workspace de un proveedor.
 *
 * Vive acá y no en `ai-cheap` a propósito: `ai-cheap` ya importa este módulo
 * (`ordenarPorCuota`), y ponerlo del otro lado cerraba un ciclo de imports.
 */
export async function cuentasDe(prov: string, ws?: number): Promise<number> {
  return (await slotsCargados(prov, ws)).length;
}

/**
 * Límite de UNA cuenta. Lo único que lo mueve es que Gemini u OpenRouter pasen a tier
 * pago (= hay créditos cargados).
 *
 * ⚠️ NO se multiplica por la cantidad de cuentas. La versión anterior lo hacía —tres
 * keys, tope × 3— y eso es justo lo que hacía mentir al panel: el tope de tres cuentas
 * NO es un tanque de 750k, son tres tanques de 250k que no se trasvasan. Con el uso
 * apilado en la cuenta 1 el gauge marcaba 32% mientras esa cuenta estaba al 96%.
 * El tope sigue siendo por cuenta; el reparto lo muestra `cuotasProveedores`.
 */
async function limitesEfectivos(): Promise<Record<string, LimiteProv>> {
  // Los dos proveedores que pueden pasar a tier pago, y cada uno se entera distinto:
  // el de Gemini se carga A MANO porque su API no publica el prepago; el de OpenRouter
  // se LEE, porque sí lo publica. Un saldo que hay que copiar a mano queda viejo al día
  // siguiente, así que donde se puede leer, se lee.
  const [geminiConCredito, orConCredito] = await Promise.all([
    getSaldo('gemini').then((s) => !!s).catch(() => false),
    openrouterConCredito().catch(() => false),
  ]);
  const out: Record<string, LimiteProv> = { ...LIMITES_PROVEEDOR };
  if (geminiConCredito) out.gemini = GEMINI_PAGO;
  if (orConCredito) out.openrouter = OPENROUTER_PAGO;
  return out;
}

export type CuotaCuenta = {
  cuenta: number; requests: number; tokens: number; pct: number; agotado: boolean;
  /** Cuántos 429 le tiró el proveedor a ESTA cuenta hoy. Ver `MARCA_REBOTE`. */
  rebotes: number;
};
export type CuotaProv = {
  provider: string; requests: number; tokens: number; rpd?: number; tokensDia?: number;
  pct: number; agotado: boolean; label: string; nota?: string;
  /** Una fila por CUENTA conectada. El total de arriba es la suma, y la suma sola
   *  miente: ver el comentario de `usoHoyPorCuenta`. */
  cuentas?: CuotaCuenta[];
};

/**
 * Uso de HOY por PROVEEDOR y CUENTA, de anthropic_usage.
 *
 * ⚠️ POR QUÉ POR CUENTA, y no solo por proveedor. El free tier se agota por cuenta:
 * tres keys de Gemini son tres cuotas que NO se trasvasan. Sumarlas da un número que
 * es cierto y una conclusión que es falsa — el panel de una clienta decía
 * «240,6k / 750,0k» (o sea "te sobra") mientras la cuenta 1, que era la que atendía
 * TODAS las llamadas, estaba al 96% de SUS 250k. Ninguna de las dos cifras estaba
 * mal; lo que estaba mal era sumar cuotas que no se pueden mover de lugar.
 *
 * Estas IA son todas BYOK (gratis por-cliente), así que el uso se cuenta SOLO en el
 * workspace del request: el gauge de Mauricio (ws1) no incluye el Gemini de Martín (ws9).
 */
export async function usoHoyPorCuenta(): Promise<Record<string, UsoProv>> {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const ws = await (async () => { try { return (await getWorkspaceActual()) ?? OWNER_WS; } catch { return OWNER_WS; } })();
  try {
    // Paginado y agregado al vuelo. El `.limit(20000)` de antes era una promesa
    // falsa: PostgREST corta en 1000 igual. Hoy un día son <100 filas por
    // workspace, pero el gauge que decide si queda cuota no puede depender de
    // eso — y el número falso invitaba a copiar el patrón.
    const filas: FilaUso[] = [];
    await leerPorPaginas<FilaUso>(
      // `model` viaja porque es donde se marca el rebote por cuota (MARCA_REBOTE).
      getSupabaseServer(), 'anthropic_usage', 'provider, cuenta, model, input_tokens, output_tokens',
      (pag) => { filas.push(...pag); },
      { eq: { workspace_id: ws }, filtros: (q) => q.gte('created_at', dayStart.toISOString()) },
    );
    return plegarUso(filas);
  } catch (e) {
    console.warn(`[ia-cuotas] uso: ${e instanceof Error ? e.message : String(e)}`);
    return {};
  }
}

/** Compat: el uso agregado por proveedor (lo que había antes de la mig 0132). */
export async function usoHoyProveedores(): Promise<Record<string, UsoProv>> {
  return usoHoyPorCuenta();
}

/**
 * Cuota de cada proveedor gratis (para el gauge de /integraciones), CON el detalle
 * por cuenta.
 *
 * El total de arriba sigue siendo la suma —es lo que responde "cuánto consumí hoy"—
 * pero `agotado` ya NO sale de ese total: un proveedor está sin cuota solo cuando
 * TODAS sus cuentas lo están. Es la diferencia entre "te queda el 68%" y "la cuenta
 * que atiende todas tus llamadas está al 96%", que era exactamente lo que el panel
 * no sabía decir.
 */
export async function cuotasProveedores(uso?: Record<string, UsoProv>): Promise<CuotaProv[]> {
  const u = uso ?? (await usoHoyPorCuenta());
  const limites = await limitesEfectivos();
  const out: CuotaProv[] = [];
  for (const [provider, lim] of Object.entries(limites)) {
    // Los SLOTS reales de las keys cargadas, no 1..n: ver `slotsCargados`. Con
    // cero cargadas queda una fila vacía en el slot 1, que es lo que había antes
    // —decirlo con un `agotado: null` propio sigue PENDIENTE (cambia el tipo que
    // leen el board y la API).
    const slots = await slotsCargados(provider).catch(() => [1]);
    const n = Math.max(1, slots.length);
    const cuentas: CuotaCuenta[] = (slots.length ? slots : [1]).map((slot) => {
      const usoC = usoDeCuenta(u, provider, slot);
      const pct = pctDe(usoC, lim);
      // ⚠️ UN REBOTE MANDA SOBRE EL PORCENTAJE. El pct sale de un tope que ponemos
      // nosotros; el rebote es el proveedor diciendo que no. Cuando se contradicen,
      // gana el hecho: el de Gemini estuvo 1440 veces mal y el panel decía «te sobra»
      // mientras todas las llamadas volvían con 429.
      return { cuenta: slot, requests: usoC.requests, tokens: usoC.tokens, pct, agotado: pct >= UMBRAL || usoC.rebotes > 0, rebotes: usoC.rebotes };
    });
    const usoP = u[provider] ?? { requests: 0, tokens: 0, rebotes: 0 };
    out.push({
      provider, requests: usoP.requests, tokens: usoP.tokens,
      // El tope que se muestra al lado del total es el de TODAS las cuentas juntas,
      // porque el total también es de todas. El de una sola vive en cada fila.
      rpd: lim.rpd ? lim.rpd * n : undefined,
      tokensDia: lim.tokensDia ? lim.tokensDia * n : undefined,
      pct: pctDe(usoP, { ...lim, rpd: lim.rpd ? lim.rpd * n : undefined, tokensDia: lim.tokensDia ? lim.tokensDia * n : undefined }),
      agotado: cuentas.every((c) => c.agotado),
      label: lim.label, nota: lim.nota, cuentas,
    });
  }
  return out;
}

/** Reordena una lista de proveedores para la rotación PROACTIVA: primero los que todavía
 *  tienen cuota, después los que están al tope (por si todo lo demás falla). Nunca los saca:
 *  solo los manda al final. Un proveedor sin límite conocido (ej. openai pago) va como "con cuota".
 *
 *  Un proveedor está agotado solo si TODAS sus cuentas lo están: mandar Gemini al final
 *  porque su cuenta 1 se acabó, teniendo dos cuentas intactas, es tirar la mejor opción.
 *
 *  ⚠️ «TODAS sus cuentas» son las CARGADAS, no las del catálogo. Esto miraba
 *  `clavesDe(p).length`, que devuelve siempre MAX_KEYS (10) — así que revisaba diez
 *  casilleros, encontraba vacío el 4 (una cuenta que no existe) y concluía que quedaba
 *  cuota. Resultado: esta función era la identidad y la rotación proactiva entre
 *  proveedores no existía; se pagaba el peaje del 429 en cada llamada. */
export async function ordenarPorCuota(orden: string[]): Promise<string[]> {
  const [uso, limites] = await Promise.all([
    usoHoyPorCuenta().catch(() => ({} as Record<string, UsoProv>)),
    limitesEfectivos().catch(() => LIMITES_PROVEEDOR),
  ]);
  // Los SLOTS reales de cada proveedor de la lista, en paralelo y una sola vez.
  const slots = new Map<string, number[]>(
    await Promise.all(orden.map(async (p): Promise<[string, number[]]> => [p, await slotsCargados(p).catch(() => [1])])),
  );
  const agotado = (p: string): boolean => {
    const lim = limites[p];
    if (!lim) return false;
    const suyos = slots.get(p) ?? [];
    // Sin ninguna cargada no está agotado: está vacío, que es otra cosa y la
    // resuelve la cascada fallando rápido, no este orden.
    if (!suyos.length) return false;
    // Sin dato de una cuenta, cuenta como libre. La duda favorece intentar.
    for (const slot of suyos) {
      if (pctDe(usoDeCuenta(uso, p, slot), lim) < UMBRAL) return false;
    }
    return true;
  };
  return [...orden.filter((p) => !agotado(p)), ...orden.filter((p) => agotado(p))];
}

/**
 * Ordena las CUENTAS de un proveedor por cuota disponible: la que tiene nafta va
 * primero. Es la mitad proactiva de la rotación — sin esto la cascada siempre
 * empieza por la cuenta 1, y si esa está al tope cada llamada paga un 429 de peaje
 * antes de llegar a la 2. Devuelve las claves en el orden en que hay que probarlas.
 */
export async function ordenarCuentas(provider: string, claves: string[]): Promise<string[]> {
  if (claves.length < 2) return claves;
  const [uso, limites] = await Promise.all([
    usoHoyPorCuenta().catch(() => ({} as Record<string, UsoProv>)),
    limitesEfectivos().catch(() => LIMITES_PROVEEDOR),
  ]);
  const lim = limites[provider];
  if (!lim) return claves;
  // `slotDe` y no `indexOf`: son lo mismo mientras el catálogo esté completo, y
  // el slot es el que `ai-cheap` escribe en `anthropic_usage.cuenta`.
  const pctDeClave = (c: string): number => pctDe(usoDeCuenta(uso, provider, slotDe(c)), lim);
  // Estable y por % consumido: la menos gastada primero. `sort` de V8 es estable,
  // así que con todo en 0 el orden queda igual al de siempre (cuenta 1 primero).
  return [...claves].sort((a, b) => pctDeClave(a) - pctDeClave(b));
}
