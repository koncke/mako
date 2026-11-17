// =============================================================================
// Lo que se le VENDE al cliente: el clip como unidad, los topes por plan y los paquetes (7/11/2026)
// =============================================================================
// `mako-tokens-reglas.ts` dice lo que las cosas CUESTAN. Esto dice lo que se COBRA, que es otra
// decisión y la toma Martín. Van separados a propósito: el costo se mide, el precio se decide.
//
// ── La unidad que lee el cliente es el MINUTO (17/11/2026) ─────────────────
//
// Martín, 17/11: «ya no pongas 0 clip de video… sino que pongas 0 minutos o 4 minutos, 10 minutos». El Omni de Martín por
// ApiMart (`gemini-omni-1.2-flash-ext`) cobra POR SEGUNDO y sin cargo fijo, de 3 a 15 s: el clip de 10 s ya no es «el más
// barato por segundo» como con el Omni 1.1 Ext (US$0,15 fijos + US$0,025/s, la tabla de ApiMart que el 15/11 se tomó por
// Flow: Flow cobra créditos, no dólares), así que deja de ser una unidad de precio.
// Queda como la cuenta de adentro: 6 clips de 10 s = un minuto = 1.440 MT.
//
// ── El piso, y el que NO es piso ────────────────────────────────────────────
//
// ⚠️ EL ÚNICO PISO ES EL MARGINAL: lo que cuesta cada minuto de más al subir del de US$47 al de US$97
// (US$50 ÷ 10 minutos = **US$5**, con el de US$47 sin video). Desde el 17/11 el extra sale EXACTO eso: ver
// `USD_POR_MINUTO_SUELTO` y por qué empatarlo ya no borra el escalón (el candado de `GENERA_VIDEO`).
// Es la única alternativa real que tiene el cliente, y si el paquete sale menos que eso, a uno del plan chico le
// conviene recargar antes que subir y el escalón de planes se borra. **Este piso se mueve cada vez que se toca el
// cupo**, y el 15/11 se movió TRES veces en un día sin que nadie lo notara (18 → 26 clips al caerse los topes): el
// clip suelto quedó por debajo una de esas veces. Por eso hoy el precio del clip suelto se DERIVA de la tarifa y el
// piso quedó como comprobación.
//
// ⚠️ Y LO QUE PARECE UN PISO Y NO LO ES: lo que el plan cobra por clip en promedio (US$97 ÷ 26 =
// US$3,73). El 7/11 lo usé como piso y me llevó a recomendar US$3, que daba un paquete de US$90 por
// 5 minutos **contra un plan de US$97 que da más video Y todo el producto**. Lo cazó Martín.
// La causa del error: **el plan no cobra clips, cobra el producto.** Los 97 dólares compran la app
// entera y los 6 minutos vienen adentro; dividir ese precio por los clips no da el precio de un
// clip, da un promedio que no significa nada. `rateDelPlan` queda abajo para poder MIRARLO, pero
// `respetaElPiso` no lo usa, y esa distinción es justamente lo que este archivo existe para fijar.
// =============================================================================

import { CUPO_MENSUAL, MT_POR_MINUTO_DE_VIDEO, MT_POR_USD, USD_POR_SEGUNDO, mtDeImagenes, mtDeVideo, usdDeMt, type Plan } from './mako-tokens-reglas';

/** Los segundos de un clip. Con el Omni 1.2 se cobra por segundo y sin cargo fijo, así que el clip ya no es más barato por largo. */
export const SEGUNDOS_POR_CLIP = 10;

/**
 * Lo que nos cuesta generar un clip de 10 s: **US$0,24**, el Omni de Martín (`gemini-omni-1.2-flash-ext`, US$0,024/s a
 * 720p, ./apimart-reglas.ts) por diez segundos. Se DERIVA del costo por segundo: no es un número aparte (17/11/2026).
 *
 * ⚠️ ERA 0,896 Y ESE NO ERA EL OMNI DE MARTÍN: era `kling-v3-omni`, un modelo de KLING que sale 16:9, tomado el 15/11 por
 * «el único Omni». El Omni de Martín es Omni 1.2 Flash de GOOGLE, el de Flow (Martín, 17/11: «Lo único que no quiero es
 * cambiar de modelo»; «descarta completamente Flow»). Con el de Kling el minuto costaba 5.400 MT; con el de Google, 1.440.
 * Antes de eso era 0,412: se escribió «es Omni Flash en Flow, el camino que paga el cliente», y era falso. Es la tabla de
 * ApiMart del Omni 1.1 Ext (US$0,15 + 0,025 por s, más la imagen); Flow cobra créditos, no dólares (docs/hallazgos-mako-tokens.md).
 * El precio por segundo se midió generando el 17/11 (dos clips de 4 s a US$0,096) y la cara habló igual de bien que en Flow.
 */
export const USD_POR_CLIP = SEGUNDOS_POR_CLIP * USD_POR_SEGUNDO.normal;

/** Seis clips de 10 s: un minuto. */
export const CLIPS_POR_MINUTO = 6;

/**
 * LA TARIFA DE MaKo TOKENS EXTRA: **US$1 = 288 MaKo Tokens, lineal** (Martín, 17/11/2026, la opción B).
 *
 * De dónde sale: Martín pidió «que paguen como máximo $100 extra y que con esos $100 extra ya le alcance los 30 minutos»,
 * y el plan de US$97 trae 10 (`MINUTOS_DEL_CUPO_PRO`). Los 20 que faltan son 20 × 1.440 = 28.800 MT por US$100: 288 por
 * dólar. Cada US$10 son 2.880 MT = **2 minutos**, y el minuto sale **US$5** (`USD_POR_MINUTO_SUELTO`). Lo eligió así:
 * «me gusta la opción B, evidentemente, porque es la que más rentabilidad nos da y aparte para el usuario le incita a
 * comprar más porque mientras más compra, más tiene».
 *
 * ⚠️ EL MARGEN DEL EXTRA YA NO ES EL DEL PLAN, Y ES A PROPÓSITO. La tarifa del 15/11 (250 por dólar) daba el 75% del
 * plan exacto («tampoco tienes que reducir el porcentaje… más o menos el mismo margen»); el 16/11 Martín lo dio vuelta para
 * lo que se compra aparte («si compran de más, sí estaría bueno como reducir tal vez un poco ese margen»). Con 288 el extra
 * deja **71,2% bruto de IA** (1 − 288 / 1.000) a precio de lista; con el 21% de IVA de pagar ApiMart con tarjeta, 65%.
 * Después de cobrar (12,36%) quedan US$52,79 de cada US$100 (la cuenta del Cerebro, 17/11, en docs/hallazgos-mako-tokens.md).
 * ⚠️ Lo que NO puede pasar nunca: que un dólar compre más MT de los que cuesta. `MT_POR_DOLAR` < `MT_POR_USD` lo prueba
 * un test.
 */
export const MT_POR_DOLAR = 288;

/** El margen bruto de IA del extra, de 0 a 1: 0,712 (lo que paga menos lo que cuestan sus MT, a precio de lista). */
export const MARGEN_BRUTO_DEL_EXTRA = 1 - MT_POR_DOLAR / MT_POR_USD;

/**
 * CUÁNTOS MaKo TOKENS VALE UN CLIP DE 10 SEGUNDOS: **240**, lo que cuesta (17/11/2026). Sale de `mtDeVideo`, el MISMO
 * camino que cobra cualquier otra duración: un solo precio para los mismos segundos.
 *
 * ⚠️ HABÍA DOS PRECIOS PARA LOS MISMOS 10 s: esto decía 900 (el clip de `kling-v3-omni`, redondeado hacia arriba) y
 * `mtDeVideo(10)` daba 384 (el segundo de `seedance-2.0-mini`). Ninguno era el Omni de Martín. Ahora los dos caminos son
 * el mismo número porque uno sale del otro.
 *
 * **POR QUÉ AL COSTO Y NO CON MARGEN ADENTRO:** la unidad está definida como «1.000 MaKo Tokens = US$1 de COSTO real de
 * IA» (./mako-tokens-reglas.ts, `MT_POR_USD`), y el margen vive en el PRECIO: el del plan y la tarifa del extra
 * (`MT_POR_DOLAR`). Poner margen también adentro del token lo cuenta dos veces.
 *
 * ⚠️ AL CLIENTE SE LE HABLA EN MINUTOS, NO EN CLIPS (Martín, 17/11: «ya no pongas 0 clip de video… sino que pongas 0
 * minutos o 4 minutos, 10 minutos»). El minuto, 1.440 MT, es redondo; el clip de 240 es la cuenta de adentro. El 15/11
 * había pedido lo contrario («queda mejor 18 clips que 3 minutos»): manda lo posterior.
 */
export const MT_POR_CLIP = mtDeVideo(SEGUNDOS_POR_CLIP);

/** Un minuto de video, en MT: 1.440. Re-exportado de las reglas para que la vitrina hable en minutos sin otra cuenta. */
export const MT_POR_MINUTO = MT_POR_MINUTO_DE_VIDEO;

/**
 * Lo que sale UN MINUTO de video comprado aparte, DERIVADO de la tarifa: 1.440 MT ÷ 288 = **US$5**, exacto (17/11/2026).
 *
 * ⚠️ El precio se dice por MINUTO y no por clip porque el del clip no es redondo (US$0,83): «un precio con coma en una
 * página de precios se lee como un error de cálculo» (el «US$ 109,5» del 15/11).
 * ⚠️ Y EMPATA EL PISO, A PROPÓSITO: subir del de US$47 al de US$97 cuesta US$50 por 10 minutos, o sea US$5 el minuto, lo
 * mismo que el extra. El piso existía para que al del plan chico no le conviniera recargar antes que subir; desde el
 * 15/11 el de US$47 NO genera video (`GENERA_VIDEO`), así que recargando no consigue ni un segundo: el escalón lo sostiene
 * el candado, no el precio. Ver `respetaElPiso`.
 */
export const USD_POR_MINUTO_SUELTO = MT_POR_MINUTO / MT_POR_DOLAR;

/** El clip suelto, por si alguna pantalla lo necesita: US$0,83. No se muestra: el precio se dice por minuto. */
export const USD_POR_CLIP_SUELTO = MT_POR_CLIP / MT_POR_DOLAR;

/**
 * ¿ESTE PLAN GENERA VIDEO? Es el ÚNICO tope por tipo que queda (15/11/2026), y no es de margen: es de PRODUCTO.
 *
 * Martín: «justamente eso es lo que no tiene el plan de 47, de la generación de video. Tiene solamente generación de
 * imagen y de manera limitada». Es la diferencia que más pesa entre los dos planes, y la única que hay que hacer cumplir
 * con un candado en vez de con el saldo.
 */
export const GENERA_VIDEO: Record<Plan, boolean> = { free: true, pro: false, growth: true };

/**
 * PARA CUÁNTO VIDEO LE ALCANZA EL CUPO, en clips de 10 s. **Ya no es un tope: es el extremo de la bolsa.**
 *
 * ⚠️ ANTES ERA UN TOPE ELEGIDO A MANO Y SOBRABA (15/11/2026). La pregunta de Martín que lo destapó: «si una persona no
 * genera 500 imágenes, le alcanzaría para generar más videos, más clips, ¿no?». Sí, y el tope se lo impedía sin razón.
 *
 * **EL CUPO YA ES EL TECHO, y eso es lo que hace que los topes por tipo sean fricción y nada más.** Desde que el token se
 * cobra AL COSTO (`MT_POR_CLIP` = 900, lo que sale un clip de Omni), gaste como guste, el máximo que nos puede costar un
 * cliente es su cupo entero: US$24 de los US$97, o sea **75,3% de margen bruto mínimo haga lo que haga** (el piso de los
 * dos planes está en `PISO_DE_MARGEN_BRUTO`, ./mako-tokens-reglas.ts). Un tope por tipo
 * no protege nada que el cupo no proteja ya; lo único que hace es que el plan se sienta más chico de lo que es.
 *
 * Entonces la bolsa es ÚNICA y fungible: con 14.400 MT son **60 clips (10 minutos)**, o **1.200 imágenes**, o cualquier
 * mezcla, y de ahí salen también los guiones, los copys y las transcripciones (17/11/2026; con el clip de Kling eran 24.000
 * MT y 26 clips). La equivalencia que la explica en una línea: **1 minuto = 120 imágenes** (1.440 ÷ 12).
 *
 * ⚠️ Y POR ESO ESTO SE DERIVA, no se escribe: es `cupo ÷ MT_POR_CLIP`. Un número a mano acá vuelve a ser un tope, y el
 * día que se mida otra vez el costo del modelo quedaría mintiendo. `free` no genera video de verdad (es la prueba): su
 * clip es un gesto y se deja en 1.
 */
export const CLIPS_POR_MES: Record<Plan, number> = {
  free: 1,
  pro: 0,
  growth: Math.floor(CUPO_MENSUAL.growth / MT_POR_CLIP),
};

/**
 * PARA CUÁNTAS IMÁGENES LE ALCANZA EL CUPO. El otro extremo de la misma bolsa (ver `CLIPS_POR_MES`): tampoco es un tope.
 *
 * ⚠️ NACIÓ COMO TOPE EL 15/11/2026 Y DEJÓ DE SERLO EL MISMO DÍA. Nació porque Martín dijo «me preocupa la cantidad de
 * MaKo Tokens que le pusiste al de 47… ahí ya podría generar una cantidad de videos y una cantidad de imágenes que no
 * debería», y en ese momento la preocupación era real: el clip se cobraba 500 MT cuando costaba 896, así que el cupo NO
 * era un techo — se podía gastar más de lo que el cupo decía. Arreglado el precio del token, el cupo volvió a ser el techo
 * y el tope quedó sin trabajo.
 * **La lección, que vale más que el número: un tope que tapa un precio mal puesto parece una protección y es un parche.**
 * Se arregló el precio y el tope se cayó solo.
 *
 * ⚠️ Y UNAS HORAS DESPUÉS SE INVIRTIÓ LA CAUSALIDAD, que es lo que hay que entender antes de tocar esto: desde que
 * Martín pidió «que se redondee a 1000 imágenes, porque eso queda marketinero», el número redondo es el que se DECIDE
 * (`IMAGENES_DEL_CUPO`, ./mako-tokens-reglas.ts) y el cupo es su costo. Esta constante sigue siendo `cupo ÷ costo de una`
 * a propósito: así es el mismo número por los dos caminos, y si alguien pone un cupo que no es múltiplo exacto del costo
 * de una imagen, los dos se separan y el test lo pesca. **La vitrina no puede prometer una cifra que la bolsa no compra.**
 */
export const IMAGENES_POR_MES: Record<Plan, number> = {
  free: Math.floor(CUPO_MENSUAL.free / mtDeImagenes(1)),
  pro: Math.floor(CUPO_MENSUAL.pro / mtDeImagenes(1)),
  growth: Math.floor(CUPO_MENSUAL.growth / mtDeImagenes(1)),
};

/** Cuántas imágenes se dejan de hacer por cada clip, y al revés: la equivalencia que explica la bolsa en una línea. */
export const IMAGENES_POR_CLIP = MT_POR_CLIP / mtDeImagenes(1);

/** El precio de cada plan, para calcular el piso sin cablearlo. */
export const USD_DEL_PLAN: Record<Plan, number> = { free: 0, pro: 47, growth: 97 };

// DE LA CAPA DEL PLAN A SU NIVEL DE TOKENS: vive en `cupoDeCapa` (./mako-tokens-reglas.ts), que es donde está
// CUPO_MENSUAL. Acá hubo un segundo `cupoDeLaCapa` con su propio mapa, escrito el 14/11/2026 por otra punta en paralelo:
// dos funciones idénticas leyendo la misma constante, que el día que una cambie se separan sin que nadie lo note. Una
// sola, y la trampa `pro`=US$47 / `growth`=US$97 documentada ahí (15/11/2026).

/** Los minutos que trae un plan, que es como se le dice al cliente. */
export const minutosDelPlan = (plan: Plan): number => CLIPS_POR_MES[plan] / CLIPS_POR_MINUTO;

/**
 * EL PISO: lo que cuesta cada clip de más al subir de un plan al siguiente.
 * Devuelve null si no hay clips de diferencia — no 0 ni Infinity, que invitarían a comparar.
 */
export function pisoMarginal(de: Plan = 'pro', a: Plan = 'growth'): number | null {
  const clips = CLIPS_POR_MES[a] - CLIPS_POR_MES[de];
  const usd = USD_DEL_PLAN[a] - USD_DEL_PLAN[de];
  return clips > 0 ? usd / clips : null;
}

/**
 * Lo que el plan sale por clip en promedio. **NO ES UN PISO** (ver la cabecera): el plan cobra el
 * producto, no los clips. Está para poder mirarlo y para que nadie lo vuelva a usar como piso sin
 * leer por qué no lo es.
 */
export function rateDelPlan(plan: Plan = 'growth'): number | null {
  const clips = CLIPS_POR_MES[plan];
  return clips > 0 && USD_DEL_PLAN[plan] > 0 ? USD_DEL_PLAN[plan] / clips : null;
}

/** El mismo piso, por MINUTO, que es como se dice el precio: US$50 ÷ 10 minutos = US$5 (17/11/2026). */
export function pisoPorMinuto(de: Plan = 'pro', a: Plan = 'growth'): number | null {
  const m = pisoMarginal(de, a);
  return m == null ? null : m * CLIPS_POR_MINUTO;
}

/**
 * Si un precio por clip respeta el piso. Mira el marginal y SOLO el marginal.
 *
 * ⚠️ CON EL CANDADO, EMPATAR ALCANZA (17/11/2026). El piso existe para que al del plan chico no le convenga recargar antes
 * que subir. Si el plan chico GENERA video, empatar no alcanza: le daría lo mismo recargar. Pero desde el 15/11 el de US$47
 * no genera video (`GENERA_VIDEO.pro`), así que recargando no consigue ni un segundo y el escalón lo sostiene el candado.
 * Ahí basta con no quedar POR DEBAJO, y la opción B de Martín queda justo en el piso: el minuto extra sale US$5, lo mismo
 * que cada minuto del salto de US$47 a US$97. Si algún día el de US$47 vuelve a generar video, vuelve el «estrictamente
 * más» y este precio se pone rojo, que es lo que tiene que pasar.
 */
export function respetaElPiso(usdPorClip: number): boolean {
  const m = pisoMarginal();
  if (m == null) return false;
  return GENERA_VIDEO.pro ? usdPorClip > m : usdPorClip >= m - 1e-9;
}

export type Paquete = {
  /** US$ que paga el cliente. */
  readonly usd: number;
  readonly clips: number;
  readonly minutos: number;
  readonly mt: number;
  /** Cuántas imágenes salen si lo gasta todo en imágenes. */
  readonly imagenes: number;
};

/**
 * Un paquete de MaKo Tokens por `usd` dólares, y para cuánto le alcanza.
 *
 * Los minutos y las imágenes son **los dos extremos**, no una división del paquete: con 5.760 MT se hacen 4 minutos, o
 * 480 imágenes, o cualquier mezcla. Se muestran los extremos porque es lo que contesta «¿para qué me alcanza?».
 */
export function paqueteDeTokens(usd: number): Paquete {
  const mt = Math.max(0, usd) * MT_POR_DOLAR;
  const clips = Math.floor(mt / MT_POR_CLIP);
  return { usd, mt, clips, minutos: clips / CLIPS_POR_MINUTO, imagenes: Math.floor(mt / mtDeImagenes(1)) };
}

/**
 * LOS PAQUETES QUE SE OFRECEN, en dólares redondos (15/11/2026, Martín: «que el cálculo de los MaKo Tokens sean redondos
 * para el cliente»). Con la tarifa de 288 MT por dólar (17/11/2026), los cuatro quedan redondos **en minutos**:
 *     US$10 →  2.880 MT   (2 minutos, o 240 imágenes)
 *     US$20 →  5.760 MT   (4 minutos, o 480 imágenes)
 *     US$40 → 11.520 MT   (8 minutos, o 960 imágenes)
 *     US$100 → 28.800 MT  (20 minutos, o 2.400 imágenes)
 * Y los cuatro dejan lo mismo: 71,2% bruto de IA (`MARGEN_BRUTO_DEL_EXTRA`). La tarifa es lineal: comprar más da más,
 * en la misma proporción.
 *
 * ⚠️ ANTES SE NOMBRABAN POR MINUTOS («un minuto de video, US$12») y la razón era buena — el minuto es lo que la persona
 * entiende. Lo que la rompió es que desde el 15/11 **el mismo cupo paga video, imagen y texto**: un paquete «de minutos»
 * no sirve para el que se quedó sin tokens escribiendo copys. El paquete es de TOKENS y la pantalla dice para cuánto
 * alcanza, que es la misma claridad sin mentir sobre lo que compró.
 */
export const PAQUETES: readonly Paquete[] = [10, 20, 40, 100].map(paqueteDeTokens);

/**
 * Un paquete equivalente a `minutos` de video, para las pantallas que todavía hablan en minutos. Su precio sale de la
 * TARIFA, no de un número suelto: así no puede decir un precio distinto del de los paquetes de arriba.
 */
export function paqueteDeMinutos(minutos: number): Paquete {
  const clips = minutos * CLIPS_POR_MINUTO;
  const mt = clips * MT_POR_CLIP;
  return { usd: mt / MT_POR_DOLAR, clips, minutos, mt, imagenes: Math.floor(mt / mtDeImagenes(1)) };
}

/**
 * Lo que deja un paquete: lo que paga menos lo que nos cuesta.
 *
 * ⚠️ EL COSTO DE UN PAQUETE ES SU VALOR EN MT, no «sus clips por el costo del clip» (15/11/2026). Decía
 * `p.usd - p.clips * USD_POR_CLIP`, y eso era correcto cuando el paquete se vendía por minutos: todos sus MT eran clips.
 * Con paquetes de TOKENS deja de serlo por dos razones, y las dos dan un margen inflado: `p.clips` va redondeado hacia
 * abajo (US$10 son 2.500 MT, que no son 2 clips justos), y lo que sobra se puede gastar en imágenes o en texto, que
 * cuestan otra cosa. El costo real no depende de en qué lo gaste: son sus MT, porque **1.000 MT son US$1 de costo por
 * definición de la unidad** (./mako-tokens-reglas.ts, `MT_POR_USD`). Esa es la propiedad que hace que esto se pueda
 * calcular sin saber qué va a generar.
 */
export const gananciaDe = (p: Paquete): number => p.usd - usdDeMt(p.mt);

/** El margen de un paquete, de 0 a 1. */
export const margenDe = (p: Paquete): number => (p.usd > 0 ? gananciaDe(p) / p.usd : 0);
