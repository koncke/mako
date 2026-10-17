// =============================================================================
// funnels-elegidos — «de qué funnels» cuando se puede elegir UNO O VARIOS
// =============================================================================
// Pedido del 17/10/2026 (un cliente por WhatsApp, 00:10): «al momento de poner un OKR objetivo se referencia vs el
// funnel VSL de negocio que escala y no del funnel de renovación. ¿Hay forma de relacionar ambos…? ¿cómo le digo de
// dónde tomar los ingresos?». Martín: «Voy a agregar la opción de poder referenciar a varios CRM… que sea una
// selección múltiple y que puedas seleccionar 1 o varios».
//
// Lo de este archivo es PURO (sin base): lo usan la pantalla, la server action, la API de MaKo y los lectores de
// lib/objectives-fuentes.ts, y por eso tiene test que lo ejecuta (tests/funnels-elegidos.test.ts).
//
// LA CONVENCIÓN: una lista VACÍA es «todos los funnels» (el negocio entero), que es lo que un OKR medía antes de que
// se pudiera elegir. Así un OKR viejo, sin nada guardado, sigue midiendo lo mismo sin migrar nada.
//
// ⚠️ A QUÉ FUNNEL ES UN PAGO (o un cierre, o una agenda). Un pago no guarda de qué funnel es: cuelga de un LEAD, y un
// lead está en su CASA (`leads.funnel_id`, NULL = el del negocio) y en los funnels a los que se lo AGREGÓ
// (`lead_funnel`, mig 0207). La regla de las métricas era «sólo la casa», y con ella el caso que trajo el pedido da
// CERO: en el ws1, «Renovación» tiene 0 leads con casa ahí y 5 agregados (medido el 17/10/2026). Por eso acá cada
// cosa cuenta en el funnel donde estaba el lead EN ESE MOMENTO: su casa, o el último funnel al que se lo agregó en
// esa fecha o antes (`funnelDelMomento`). Cada pago va a UN solo funnel, así que «VSL + Renovación» suma el total
// sin contar nada dos veces. Lo que no resolvía: una cuota vieja de la venta del VSL que se cobra DESPUÉS de agregar
// al lead a Renovación contaba en Renovación.
// ⚠️ DESDE EL 17/10/2026 (#897, mig 0310) EL PAGO GUARDA SU FUNNEL (`pagos.funnel_id`): un trigger lo fija al CREAR la
// fila con esta misma regla (el funnel del lead ese día), así la cuota de la venta del VSL sigue siendo del VSL aunque
// se cobre después de agregarlo a Renovación. Un hecho con `funnel` manda sobre `funnelDelMomento`; sin él (la columna
// todavía no está, o un pago sin lead), la regla de siempre. Medido ese día: con las dos reglas los pagos cobrados de
// hoy caen en el MISMO funnel (en el ws1, los 33 en «Negocio que ESCALA»: los 5 leads de Renovación se agregaron el
// 13/10 y todos sus pagos son de antes), así que el backfill no movió ningún número.
// =============================================================================

/** Lo guardado (`funnel_ids` de la base, un número suelto de antes, una lista del navegador) como lista limpia. */
export function leerFunnelIds(crudo: unknown): number[] {
  const lista = Array.isArray(crudo) ? crudo : crudo == null || crudo === '' ? [] : [crudo];
  const out: number[] = [];
  for (const x of lista) {
    const n = typeof x === 'number' ? x : typeof x === 'string' && /^\d+$/.test(x.trim()) ? Number(x.trim()) : NaN;
    if (Number.isSafeInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Cuántos funnels se pueden elegir a la vez: un tope de cordura, no de producto (nadie tiene veinte). */
export const TOPE_FUNNELS_ELEGIDOS = 20;

/** Lo que llega de afuera (la pantalla, la API), saneado: enteros positivos, sin repetir, con tope. */
export const sanearFunnelIds = (crudo: unknown): number[] => leerFunnelIds(crudo).slice(0, TOPE_FUNNELS_ELEGIDOS);

/**
 * El conjunto después de tocar un renglón del desplegable. `''` es «Todos»: vacía la lista. Tocar un funnel lo prende
 * o lo apaga; apagar el último vuelve a «Todos» (una lista vacía no es «ninguno»: es el negocio entero).
 */
export function alternarFunnel(ids: readonly number[], tocado: string): number[] {
  if (tocado === '') return [];
  const n = Number(tocado);
  if (!Number.isSafeInteger(n) || n <= 0) return [...ids];
  return ids.includes(n) ? ids.filter((x) => x !== n) : [...ids, n];
}

/** Lo que dice el botón: los nombres (no «2 elegidos»), y los que ya no están, dichos. */
export function rotuloDeFunnels(ids: readonly number[], funnels: readonly { id: number; nombre: string }[], todos = 'Todos los funnels'): string {
  if (!ids.length) return todos;
  const nombres = ids.map((id) => funnels.find((f) => f.id === id)?.nombre ?? 'Un funnel que ya no está');
  if (nombres.length === 1) return nombres[0];
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  return `${nombres[0]}, ${nombres[1]} y ${nombres.length - 2} más`;
}

/** Un funnel al que se agregó al lead, desde qué día (YYYY-MM-DD o un timestamp: se compara el día). */
export type Agregado = { funnel: number; desde: string };

const dia = (s: string) => s.slice(0, 10);

/**
 * En qué funnel estaba el lead en `fecha`: el último al que se lo agregó ese día o antes; si ninguno, su casa.
 * `casa` ya traducida (NULL → el id del funnel del negocio). `null` = no se sabe (casa sin id y sin agregados).
 */
export function funnelDelMomento(casa: number | null, agregados: readonly Agregado[], fecha: string): number | null {
  const f = dia(fecha);
  let mejor: Agregado | null = null;
  for (const a of agregados) {
    if (dia(a.desde) > f) continue;
    // A igual día gana el que se agregó después (el timestamp completo desempata).
    if (!mejor || a.desde > mejor.desde) mejor = a;
  }
  return mejor ? mejor.funnel : casa;
}

/**
 * Un hecho que cuenta para un OKR o un KPI: de qué lead es, cuándo pasó y cuánto suma (1 si se cuenta). `funnel`: el
 * que guardó el pago (mig 0310); cuando está, manda.
 */
export type Hecho = { lead: number | null; fecha: string | null; valor: number; funnel?: number | null };

/**
 * ¿El error es que `pagos.funnel_id` todavía no existe (la mig 0310 sin aplicar)? Los lectores reintentan sin la columna
 * y cuentan con la regla de siempre: nunca un cero ni una pantalla caída por una migración que falta.
 */
export function faltaColumnaFunnel(e: unknown): boolean {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
  return /funnel_id/.test(m) && (code === '42703' || /does not exist|no existe/i.test(m));
}

/**
 * La suma de los hechos que caen en los funnels elegidos. `casas` y `agregados` son de los leads de los hechos; un
 * hecho sin lead o sin fecha no es de ningún funnel y no suma (con «Todos» no se llama a esto: se cuenta todo).
 */
export function sumarEnFunnels(
  hechos: readonly Hecho[],
  elegidos: readonly number[],
  casas: ReadonlyMap<number, number | null>,
  agregados: ReadonlyMap<number, readonly Agregado[]>,
): number {
  return filtrarEnFunnels(hechos, (h) => h, elegidos, casas, agregados).reduce((s, h) => s + h.valor, 0);
}

/** Los ítems (un pago, un cierre del desglose) que caen en los funnels elegidos, con la misma regla que la suma. */
export function filtrarEnFunnels<T>(
  items: readonly T[],
  de: (x: T) => { lead: number | null | undefined; fecha: string | null | undefined; funnel?: number | null },
  elegidos: readonly number[],
  casas: ReadonlyMap<number, number | null>,
  agregados: ReadonlyMap<number, readonly Agregado[]>,
): T[] {
  const set = new Set(elegidos);
  return items.filter((x) => {
    const { lead, fecha, funnel } = de(x);
    // El que guardó el pago (mig 0310) manda: es el de cuando se creó, no el de cuando se cobró.
    if (funnel != null) return set.has(funnel);
    if (lead == null || !fecha) return false;
    const f = funnelDelMomento(casas.get(lead) ?? null, agregados.get(lead) ?? [], fecha);
    return f != null && set.has(f);
  });
}
