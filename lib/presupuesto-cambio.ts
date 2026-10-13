// =============================================================================
// presupuesto-cambio — en qué unidad se TIPEA un presupuesto y cómo se le pregunta
// =============================================================================
// Módulo PURO a propósito (sin `server-only` y sin 'use client'): lo usan el wizard
// de campañas, el modal de agregar conjunto, la tabla del Ads Manager (la celda y la
// barra de lote) y las propuestas de MaKo por chat. Antes eran TRES copias de la tabla
// de tasas y DOS del aviso «es N veces el actual», y la celda de la tabla ni siquiera
// tenía copia: multiplicaba siempre por 17,30.
//
// ⚠️ POR QUÉ ESTO ES PLATA Y NO COPY. `dailyBudgetMxn` se llama así por historia: lo que
// viaja es un monto en la MONEDA DE LA CUENTA, sea cual sea (lib/meta-write.ts lo manda
// en centavos de esa moneda). Desde db7b7682 (07/10/2026) cualquier workspace escribe
// presupuestos con SU cuenta, y la celda convertía siempre USD→MXN: en una cuenta que
// cobra en dólares, tipear 50 escribía 865 USD/día. Lo mismo, al revés, en lo que se
// MOSTRABA: la celda dividía por 17,3 un monto que ya estaba en dólares.
//
// La regla, la misma del wizard desde el 11/09 (docs/hallazgos-ads.md, «el presupuesto
// se multiplicaba por 17,3»): se TIPEA en dólares y se convierte a la moneda de la
// cuenta. Para una moneda sin tasa en el código NO se inventa una: el monto va crudo, en
// esa moneda, y la pantalla lo dice.
// =============================================================================

import { TIPO_DE_CAMBIO_USD_MXN } from './config';

/**
 * Cuántas unidades de la moneda de la cuenta vale UN dólar. Sólo las que el código
 * conoce de verdad: el peso mexicano tiene su tasa a mano en lib/config.ts, y el dólar
 * es 1. Cualquier otra moneda NO está acá, y eso es lo que la pantalla tiene que decir.
 */
export const TASAS_DESDE_USD: Readonly<Record<string, number>> = Object.freeze({ USD: 1, MXN: TIPO_DE_CAMBIO_USD_MXN });

/**
 * ¿Hay tasa para esta moneda?
 *
 * ⚠️ Con `hasOwnProperty` y no con `in`: `'toString' in {}` es true, y una moneda
 * rara que se llamara como un método del prototipo «tendría tasa» y multiplicaría por
 * una función (NaN).
 */
export function esConvertible(currency: string): boolean {
  return Object.prototype.hasOwnProperty.call(TASAS_DESDE_USD, currency);
}

/**
 * Lo TIPEADO (dólares) en la moneda de la cuenta. Sin tasa conocida, 1:1 — el monto
 * va crudo en esa moneda, y la pantalla lo aclara.
 *
 * Mismo nombre y misma semántica que la copia que tenían los dos modales, a propósito:
 * tests/ads-pais-y-recos.test.ts exige una llamada a `usdACuenta(` en cada uno.
 *
 * Para el ws1 (MXN) es `Math.round(usd * 17.30)`, o sea EXACTAMENTE lo que la celda de
 * la tabla mandaba antes (`Math.round(usd * TIPO_DE_CAMBIO_USD_MXN)`): el número que
 * viaja a Meta no cambia. Lo fija tests/ads-presupuesto-confirma.test.ts.
 */
export function usdACuenta(usd: number, currency: string): number {
  return Math.round(usd * (esConvertible(currency) ? TASAS_DESDE_USD[currency] : 1));
}

/** Un monto de la cuenta en dólares, o `null` si la moneda no tiene tasa (no se inventa). */
export function cuentaAUsd(monto: number, currency: string): number | null {
  if (!esConvertible(currency)) return null;
  return monto / TASAS_DESDE_USD[currency];
}

/**
 * Cómo pasar a dólares lo que GASTÓ una cuenta de Meta, sabiendo (o no) en qué moneda cobra.
 *
 * ⚠️ LA LECTURA DEL GASTO DIVIDÍA POR 17,30 PARA TODOS. Las escrituras se arreglaron con
 * `usdACuenta`; lo que se MOSTRABA —el dashboard, el CAC, los experimentos, la tool del
 * doer— seguía tratando el `spend` de Meta como pesos mexicanos. Medido el 08/10/2026: ws1,
 * ws4 y ws11 cobran en MXN; ws13, ws14 y ws15 en USD, y para esos tres todo gasto en dólares
 * salía 17,3 veces más chico. La moneda la resuelve `lib/moneda-meta.ts`; esto decide qué
 * hacer con ella, y es puro para que tenga test.
 *
 * - `aUsd`: el monto en dólares, o `null` si la moneda no se conoce o no tiene tasa. Es la
 *   que va donde la salida puede decir «no lo sé» (la tool del doer, las métricas de MaKo).
 * - `aUsdNum`: siempre un número, para los tableros cuyos tipos no admiten un vacío. Con la
 *   moneda DESCONOCIDA convierte como pesos —lo que hacía todo el código antes— y lo avisa:
 *   decisión consciente para no romper una pantalla en un camino que sólo se da si nunca se
 *   pudo leer la cuenta (la moneda se guarda al sincronizar). Con una moneda CONOCIDA sin
 *   tasa (ARS, EUR…) devuelve el monto crudo, igual que `usdACuenta`: no se inventa una tasa.
 */
export type ConversorGasto = {
  moneda: string | null;
  aUsd: (monto: number) => number | null;
  aUsdNum: (monto: number) => number;
};
export function conversorDeGasto(moneda: string | null, avisar: (m: string) => void = () => {}): ConversorGasto {
  const m = moneda ? moneda.trim().toUpperCase() : null;
  let avisado = false;
  return {
    moneda: m,
    aUsd: (monto) => (m ? cuentaAUsd(monto, m) : null),
    aUsdNum: (monto) => {
      if (!m) {
        // Sólo si hay algo que convertir: un negocio sin Meta pasa por acá con gasto 0 en
        // cada pantalla, y ese aviso no dice nada (medido: el ws3 lo disparaba siempre).
        if (monto !== 0 && !avisado) { avisado = true; avisar('moneda de la cuenta de Meta desconocida: el gasto se convierte como MXN'); }
        return monto / TIPO_DE_CAMBIO_USD_MXN;
      }
      return cuentaAUsd(monto, m) ?? monto;
    },
  };
}

/**
 * Lo que el editor muestra al abrirse, en la unidad que se TIPEA.
 *
 * Es también contra lo que se decide si HUBO cambio, y por eso es un string: el
 * redondeo hace que la ida y la vuelta no cierren (500 MXN se muestra como 29 y 29
 * vuelve como 502). Comparar en la moneda de la cuenta haría que guardar sin tocar
 * abriera el cartel «500 → 502»; comparando lo tipeado contra esto, no abre nada.
 */
export function inicialTipeado(monto: number | null, currency: string): string {
  if (monto == null || !Number.isFinite(monto)) return '';
  const usd = cuentaAUsd(monto, currency);
  return String(Math.round(usd ?? monto));
}

/**
 * Lo tipeado → el monto en la moneda de la cuenta, o `null` si no es un número > 0.
 *
 * SÓLO dígitos, igual que la celda: el lote hacía `Number(x.replace(',', '.'))`, que
 * convierte «1.500» y «1,500» en 1,5 — con separadores de miles en español es justo el
 * error de tipeo que el cartel tiene que atajar.
 */
export function tipeadoACuenta(texto: string, currency: string): number | null {
  if (!/^\d+$/.test(texto)) return null;
  const n = Number(texto);
  if (!Number.isFinite(n) || n <= 0) return null;
  return usdACuenta(n, currency);
}

/** «1,500» — la cifra sola, para cuando la moneda va una sola vez al final del renglón. */
export function cifra(monto: number): string {
  return monto.toLocaleString('es-MX', { maximumFractionDigits: 2 });
}

/** «865 MXN». Sin la moneda pegada, un número de plata no dice nada. */
export function montoCuenta(monto: number, currency: string): string {
  return `${cifra(monto)} ${currency}`;
}

/**
 * Las monedas que Meta maneja SIN subdivisión: su «offset» es 1, o sea que un
 * `daily_budget` de 5000 en una cuenta en JPY son 5000 yenes, no 50. Todas las demás
 * tienen offset 100 (el campo viaja en centavos). Copiada de la tabla «Supported
 * currencies and offsets» de developers.facebook.com/docs/marketing-api/currencies,
 * leída el 13/10/2026.
 *
 * ⚠️ HASTA EL 13/10/2026 TODO MULTIPLICABA Y DIVIDÍA POR 100. Para los clientes de hoy
 * (MXN y USD) es correcto; un negocio que cobre en pesos colombianos o chilenos habría
 * visto la celda, el cartel y el wizard 100 veces corridos, y escribir «20.000 COP/día»
 * habría puesto 2.000.000. Ningún cliente cobraba en una de éstas al escribirlo: el
 * arreglo llegó antes que el primero.
 */
export const MONEDAS_SIN_CENTAVOS_META: ReadonlySet<string> = new Set([
  'CLP', 'COP', 'CRC', 'HUF', 'IDR', 'ISK', 'JPY', 'KRW', 'PYG', 'TWD', 'VND',
]);

/**
 * Por cuánto se multiplica un monto de la cuenta para mandárselo a Meta (y se divide lo
 * que Meta devuelve): 1 para las monedas sin centavos, 100 para el resto.
 *
 * Con la moneda DESCONOCIDA devuelve 100, que es lo que el código hizo siempre: sirve
 * para DIBUJAR. Quien ESCRIBE un presupuesto no llama esto con `null` — se niega a
 * escribir si no sabe la moneda (lib/meta-write.ts), porque ahí un default es plata.
 */
export function offsetMeta(currency: string | null | undefined): number {
  const m = currency ? currency.trim().toUpperCase() : '';
  return MONEDAS_SIN_CENTAVOS_META.has(m) ? 1 : 100;
}

/** Un monto en la moneda de la cuenta → el entero que Meta espera en `daily_budget`. */
export function aUnidadMeta(monto: number, currency: string | null | undefined): number {
  return Math.round(monto * offsetMeta(currency));
}

/** Lo que Meta devuelve en `daily_budget`, `balance`, `spend_cap`… → el monto en la moneda de la cuenta. */
export function desdeUnidadMeta(valor: number, currency: string | null | undefined): number {
  return valor / offsetMeta(currency);
}

/**
 * A partir de cuántas veces el actual el cambio se marca. El mismo número que usaban
 * las propuestas de MaKo por chat (lib/api-mako/areas/ads.run.ts), que ahora lo leen
 * de acá: era la tercera copia.
 */
export const SALTO_AVISO = 5;

/**
 * Si el monto nuevo es un salto de ×5 o más contra el actual, en cualquiera de las dos
 * direcciones. `null` si no lo es, o si no hay contra qué comparar (actual nulo o 0).
 *
 * ⚠️ Las DOS direcciones: un cero de más (×10) gasta plata, y uno de menos (÷10) frena
 * la campaña y la devuelve a aprendizaje. Es el mismo error de tipeo con el signo
 * cambiado. El chat de MaKo sólo avisa la subida (`sube`) y sigue así.
 */
export function saltoPresupuesto(nuevo: number, viejo: number | null): { veces: number; sube: boolean } | null {
  if (viejo == null || !(viejo > 0) || !(nuevo > 0)) return null;
  if (nuevo >= viejo * SALTO_AVISO) return { veces: Math.round(nuevo / viejo), sube: true };
  if (viejo >= nuevo * SALTO_AVISO) return { veces: Math.round(viejo / nuevo), sube: false };
  return null;
}

/**
 * ¿El presupuesto DIARIO de esta fila se edita en ESTE nivel?
 *
 * Las dos condiciones, y la segunda es la que faltaba: `budgetLevel` (lib/meta-health.ts)
 * se pone también cuando el presupuesto es TOTAL (`lifetime_budget`), y ahí la celda era
 * editable igual, mostraba «—» con el lápiz y el editor escribía un `daily_budget` sobre
 * una entidad que no lo tiene. Las propuestas de MaKo ya rechazaban ese caso; la tabla no.
 * Lo usan la celda Y la barra de lote, para que no puedan contestar distinto.
 */
export function editaPresupuestoAca(
  node: { budgetLevel?: 'campaign' | 'adset' | null; dailyBudgetMxn?: number | null },
  level: 'campaign' | 'adset' | 'ad',
): boolean {
  return level !== 'ad' && node.budgetLevel === level && node.dailyBudgetMxn != null;
}

/**
 * Un presupuesto escrito desde la pestaña. `en` es la hora del SERVIDOR en que Meta lo
 * aceptó (ver `horaDeEscritura`), y `null` mientras el POST sigue en vuelo.
 */
export type EscritoPresupuesto = { valor: number; en: number | null };

/**
 * El grano del header `Date`: segundos enteros, TRUNCADOS. Una hora sacada de ahí puede
 * estar hasta 999 ms antes de la real, así que una lectura cuenta como posterior a la
 * escritura sólo si arrancó un grano entero después.
 */
export const GRANO_HORA_SERVIDOR_MS = 1000;

/**
 * La hora de una escritura en el reloj del SERVIDOR: el header `Date` de la respuesta de
 * /api/meta-write. Se compara contra `inicioLecturaISO` del árbol, que también sale del
 * servidor; el reloj de la máquina de quien mira puede estar corrido minutos.
 *
 * Sin header (no pasa ni en Vercel ni en el dev server de Node) cae al reloj local
 * (`respaldo`). Corrido hacia adelante, eso sólo hace durar más al optimista; corrido
 * hacia atrás, reabre el caso que esto cierra. Es el único camino que lo usa.
 */
export function horaDeEscritura(date: string | null, respaldo: number): number {
  const t = date ? Date.parse(date) : NaN;
  return Number.isFinite(t) ? t : respaldo;
}

/**
 * Qué presupuestos escritos desde la pestaña siguen valiendo después de recargar.
 *
 * `metaWrite` no invalida la caché del árbol de Meta (docs/hallazgos-ads.md, «El árbol de
 * Meta que leen las guardas puede tener CUALQUIER edad»), y la tabla recarga después de cada
 * pausa, activación, renombre o borrado. Sin esto, cambiar un presupuesto y pausar algo
 * devolvía la fila al monto VIEJO — se lee como «no se aplicó», y el próximo cartel
 * tomaba ese viejo como el actual.
 *
 * ⚠️ NO SE SUELTA POR RELOJ. La primera versión (07/10/2026) soltaba lo escrito a los
 * 120 s, el `revalidate` de `getMetaHealth`, y suponía que /api/meta-health nunca sirve
 * algo más viejo que eso. Es falso: `unstable_cache` es stale-while-revalidate (Next
 * 16.2.6, unstable-cache.js: «we're doing background revalidation - return stale
 * immediately»). La primera lectura DESPUÉS de vencer devuelve la entrada vieja y recién
 * ahí revalida de fondo, así que la edad de lo que se sirve no tiene techo: escribir a
 * los 10 s, no mirar nada, y pausar otra fila a los 3 min devolvía la fila al monto de
 * antes. Lo encontró la revisión de la #349; la prueba del navegador había dado verde
 * porque su /api/meta-health simulado no tenía caché.
 *
 * Lo que decide es CUÁNDO SE LEYÓ el árbol, no cuándo llegó a la pestaña:
 * - en vuelo (`en` null) → se mantiene, pase lo que pase;
 * - la lectura trae el mismo monto → se suelta (llegó);
 * - la lectura EMPEZÓ un grano entero después de la escritura → se suelta, y manda lo
 *   que diga Meta: otro monto, o que la entidad ya no esté;
 * - si no, se mantiene. Y si no se sabe cuándo empezó (`leidaDesde` null: una entrada
 *   de caché escrita antes de que existiera el campo), también: mostrar lo que Meta
 *   ACEPTÓ es el error barato; mostrar el monto de antes es el que este cambio cierra.
 *
 * Se compara contra el INICIO de la lectura, no contra `fetchedAtISO`, que se pone al
 * final: una lectura que arrancó antes de la escritura y terminó después trae el monto
 * viejo con una hora posterior.
 */
export function presupuestosVigentes(
  escritos: ReadonlyMap<string, EscritoPresupuesto>,
  reales: ReadonlyMap<string, number | null>,
  leidaDesde: number | null,
): { mantener: Map<string, number>; soltar: string[] } {
  const mantener = new Map<string, number>();
  const soltar: string[] = [];
  for (const [id, e] of escritos) {
    if (e.en == null) { mantener.set(id, e.valor); continue; }
    const llego = reales.has(id) && reales.get(id) === e.valor;
    const posterior = leidaDesde != null && leidaDesde >= e.en + GRANO_HORA_SERVIDOR_MS;
    if (llego || posterior) soltar.push(id);
    else mantener.set(id, e.valor);
  }
  return { mantener, soltar };
}
