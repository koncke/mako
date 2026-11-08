// =============================================================================
// Cuánto del cupo de IA se usa de verdad, y qué le hace eso al margen (7/11/2026)
// =============================================================================
// Martín, 7/11: «muy probablemente muchos usuarios no gasten al 100% de los MaKo Tokens al mes, y esos tokens no deberían
// acumularse. Eso me reduce un montón el gasto por cliente. Hoy la gran mayoría, por no decir el 100%, no usa la generación
// de video: Código Inmobiliario y sus clientes no lo necesitan para su negocio».
//
// ⚠️ EL CUPO NO ES UN COSTO: ES UN TECHO. El plan de US$97 incluye `CUPO_MENSUAL.growth` = 24.250 MT = US$24,25 de costo de
// video e imagen (lib/mako-tokens-reglas.ts, `MT_POR_USD = 1000`). Pero sólo se gasta lo que el cliente genera. Un cliente
// que nunca abre AI Avatar cuesta CERO de cupo, y su plan deja casi todo.
//
// ── Por qué esto no es «breakage» de los libros, y el número de afuera no sirve ──
//
// La literatura de cobros habla de 5-15% de créditos COMPRADOS que vencen sin usar. No aplica acá, y usarlo subestimaría
// muchísimo el margen: un crédito comprado lo pagó alguien que QUERÍA usarlo. Un cupo INCLUIDO en un plan, para una función
// que el negocio no necesita, no se usa nunca — no el 10%, el 100%. El proxy más cercano que publica alguien es la
// utilización de licencias de software (54% en 2025), y sigue siendo de asientos, no de cupos.
//
// **Por eso esto se MIDE con lo nuestro, no se estima con lo de afuera.** `tasaDeUsoMedida` existe para que el número salga
// del gasto real contra el cupo repartido, y mientras no haya meses suficientes se dice que no se sabe, en vez de inventar.
//
// ⚠️ Y EL CUPO NO SE ACUMULA (decisión de Martín, 7/11): se reinicia cada mes, como cualquier suscripción. Si se acumulara,
// un cliente que no usó nada en seis meses podría gastar seis cupos de una, y el mes en que lo haga el costo es real y la
// plata de esos meses ya se gastó. Acumular convierte un techo mensual en una deuda sin fecha.
// =============================================================================

import { CUPO_MENSUAL, usdDeMt, type Plan } from './mako-tokens-reglas';
import { PARTE_DE_COBRAR, cacPorMes } from './economia-unitaria';

/** Lo que cuesta, como mucho, la IA de un cliente de ese plan en un mes: su cupo entero. */
export const techoDeIa = (plan: Plan): number => usdDeMt(CUPO_MENSUAL[plan]);

/**
 * Lo que deja un cliente de ese plan con una tasa de uso del cupo (0 = no genera nada; 1 = lo agota).
 * ⚠️ `tasa` se recorta a [0,1]: por arriba del cupo no sigue gastando, el medidor lo frena (`alcanzaElSaldo`).
 */
export function dejaConUso(planUsd: number, plan: Plan, tasa: number): number {
  const t = Math.min(1, Math.max(0, Number.isFinite(tasa) ? tasa : 0));
  return planUsd - planUsd * PARTE_DE_COBRAR - cacPorMes() - techoDeIa(plan) * t;
}

export type UsoMedido = {
  /** La parte del cupo que se usó, de 0 a 1. `null` = todavía no se puede saber. */
  readonly tasa: number | null;
  readonly aviso: string | null;
};

/**
 * La tasa de uso REAL: lo que se gastó de IA contra lo que se podía gastar.
 *
 * ⚠️ Devuelve `null`, no 0, cuando no hay con qué calcularla. Un 0 acá leería «nadie usa nada», que es justo la conclusión
 * que queremos sacar de los datos y no regalarle al que mire la pantalla. Es la misma regla que el resto de Costs.
 */
export function tasaDeUsoMedida(gastoIaUsd: number | null, clientes: number, plan: Plan): UsoMedido {
  if (gastoIaUsd == null) return { tasa: null, aviso: 'No pude leer el gasto de IA del mes.' };
  if (!Number.isFinite(clientes) || clientes <= 0) return { tasa: null, aviso: 'Sin clientes que paguen no hay cupo contra el que medir.' };
  const techo = techoDeIa(plan) * clientes;
  if (techo <= 0) return { tasa: null, aviso: 'Ese plan no trae cupo de IA.' };
  return { tasa: Math.min(1, gastoIaUsd / techo), aviso: null };
}

/**
 * Lo que hay que COMPRAR de crédito para cubrir el mes que viene de un cliente, sabiendo lo que gastó este mes.
 *
 * El pedido de Martín (7/11): «si el usuario no se gastó sus tokens, al mes que viene no se le vuelve a comprar la misma
 * cantidad, sino un diferencial para cubrir lo que no se gastó». O sea: el saldo que sobró en la cuenta del proveedor sigue
 * ahí y sólo se repone la diferencia.
 *
 * ⚠️ `saldoQueQuedaUsd` es lo que quedó SIN GASTAR en el proveedor, no lo que le sobró al cliente de su cupo: el cupo se
 * reinicia, el saldo comprado no. Confundirlos hace comprar de más todos los meses.
 */
export function compraDelMes(plan: Plan, saldoQueQuedaUsd: number): number {
  const techo = techoDeIa(plan);
  const saldo = Number.isFinite(saldoQueQuedaUsd) ? Math.max(0, saldoQueQuedaUsd) : 0;
  return Math.max(0, Math.round((techo - saldo) * 100) / 100);
}
