// =============================================================================
// Lo que se le VENDE al cliente: el clip como unidad, los topes por plan y los paquetes (7/11/2026)
// =============================================================================
// `mako-tokens-reglas.ts` dice lo que las cosas CUESTAN. Esto dice lo que se COBRA, que es otra
// decisión y la toma Martín. Van separados a propósito: el costo se mide, el precio se decide.
//
// ── La unidad es el CLIP de 10 segundos ─────────────────────────────────────
//
// No es arbitrario: 10 s es el TOPE de Omni Flash (`invalid duration 60, must be one of 4/6/8/10`)
// y es el más barato POR SEGUNDO, porque el modelo cobra US$0,15 fijos + US$0,025 por segundo. Un
// clip de 4 s sale US$0,0625 el segundo; uno de 10 s, US$0,040. **Partir una pieza en clips cortos
// la encarece sin que nadie lo note.** Al cliente se le habla en MINUTOS: seis clips.
//
// ── El piso, y el que NO es piso ────────────────────────────────────────────
//
// ⚠️ EL ÚNICO PISO ES EL MARGINAL: lo que cuesta cada clip de más al subir del de US$47 al de US$97
// (US$50 ÷ 26 clips = **US$1,92**, con el de US$97 repartiendo su bolsa en hasta 26 clips y el de US$47 sin video).
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

import { CUPO_MENSUAL, mtDeImagenes, usdDeMt, type Plan } from './mako-tokens-reglas';

/**
 * Lo que nos cuesta generar un clip de 10 s. **US$0,896: `kling-v3-omni` a US$0,0896/s**, medido el 7/11/2026 contra
 * ApiMart (lib/apimart-reglas.ts, `MODELOS_VIDEO`).
 *
 * ⚠️ ERA 0,412 Y ESE NÚMERO NO ERA NUESTRO COSTO: era Omni Flash en **Google Flow** (US$0,15 fijo + US$0,025/s, más
 * US$0,012 de la imagen de referencia), y Flow lo paga el cliente con sus créditos. Desde el 15/11/2026 los clips salen
 * por ApiMart y los pagamos nosotros (Martín: «la idea es darles a todos la opción de generar los clips con MaKo Tokens,
 * que nosotros lo hacemos a través de ApiMart para que no tenga que estar conectando su Flow»), y el modelo es Omni y
 * sólo Omni (⛔⛔ 8/11: «TENÉS PROHIBIDO USAR OTRO MODELO QUE NO SEA OMNI»; 15/11: «la generación de video sí o sí la vamos
 * a hacer con Omni»). Estimar con el costo de Flow era estimar con el precio del camino que no pagamos — y dio 2,2 veces
 * menos.
 * ⚠️ No se copia de un tarifario: si se cambia de modelo, se vuelve a MEDIR.
 */
export const USD_POR_CLIP = 0.896;

/** Seis clips de 10 s. Es como se le cuenta al cliente: «un minuto». */
export const CLIPS_POR_MINUTO = 6;

/**
 * LA TARIFA DE MaKo TOKENS: **US$1 = 250 MaKo Tokens** (15/11/2026).
 *
 * De dónde sale, y es una cuenta de un paso: 1.000 MaKo Tokens son, por definición, US$1 de costo real de IA
 * (`MT_POR_USD`, ./mako-tokens-reglas.ts). Vendidos a US$4 dejan el **75% de margen**, que es exactamente el margen del
 * plan (su cupo es el 25% del precio). O sea: US$4 → 1.000 MT, o US$1 → 250 MT.
 *
 * Martín, 15/11, al pedirla: «dame el cálculo de los usuarios que compran MaKo Tokens, ahí cuánto les alcanzaría…
 * tampoco tienes que reducir el porcentaje de los MaKo Tokens. Debería quedarnos más o menos el mismo margen de
 * ganancia.» Con esta tarifa el margen del paquete y el del plan son el MISMO número, no «parecido»: los dos 75%.
 *
 * ⚠️ Y POR ESO SE VENDEN TOKENS Y NO MINUTOS. Antes se vendía el minuto a un precio en dólares puesto a mano
 * (`USD_POR_CLIP_SUELTO`), y eso dejaba el margen del paquete a la deriva del costo del modelo: con el clip de Omni a
 * US$0,896, el minuto a US$18 dejaba 70% — cinco puntos por debajo del plan, sin que nadie lo decidiera. Con una tarifa
 * por token, el margen es la tarifa: no se puede desacoplar.
 */
export const MT_POR_DOLAR = 250;


/**
 * CUÁNTOS MaKo TOKENS VALE UN CLIP DE 10 SEGUNDOS: **900 — los 896 que CUESTA, redondeados hacia arriba** (15/11/2026).
 *
 * ⚠️ ERA 500 Y ESO PERDÍA PLATA EN CADA GENERACIÓN. Los 500 salían de «redondo hacia arriba desde los 412 de costo: deja
 * aire», y esos 412 eran el costo de **Omni Flash en Google Flow**, que lo pagaba el cliente con sus créditos. Desde que
 * los clips salen por ApiMart y los paga MaKo (Martín, 15/11: «la idea es darles a todos la opción de generar los clips
 * con MaKo Tokens, que nosotros lo hacemos a través de ApiMart para justamente que no tenga que estar conectando su
 * Flow»), el costo es el de **`kling-v3-omni`, el único modelo autorizado** para una cara que habla (⛔⛔ regla de Martín
 * del 8/11, en la cabecera de lib/apimart-reglas.ts; Martín, 15/11: «la generación de video sí o sí la vamos a hacer con
 * Omni, no la vamos a hacer con ningún otro»). Omni sale **US$0,0896/s medidos contra ApiMart** = US$0,896 el clip de
 * 10 s. Cobrando 500 MT (US$0,50) se perdían **US$0,40 en cada clip**.
 *
 * **POR QUÉ AL COSTO Y NO CON MARGEN ADENTRO, que es el error que había:** la unidad está definida como «1.000 MaKo
 * Tokens = US$1 de COSTO real de IA» (./mako-tokens-reglas.ts, `MT_POR_USD`), y el margen vive en el **precio del plan**
 * — el cupo es el 25% del precio, o sea 75% de margen bruto. Poner margen también adentro del token lo cuenta dos veces,
 * y acá lo contaba **para abajo**: un clip «con margen» de 500 MT costaba 896 de verdad.
 * El único lugar del circuito donde el margen va adentro del precio de una generación es el clip SUELTO, que por eso
 * está en dólares y no en MT: ver `USD_POR_CLIP_SUELTO`.
 *
 * El minuto son 6 clips = **5.400 MT**. Y el clip de 10 s es la unidad con la que se le habla al cliente — Martín,
 * 15/11: «también puede ser 18 clips, que creo que queda mejor 18 clips que 3 minutos».
 *
 * ⚠️ REDONDO PARA EL CLIENTE, Y HACIA ARRIBA. Martín, 15/11: «el cálculo de los MaKo Tokens sean redondos para el
 * cliente… no me gusta que sean 1337, que sea 1400 directa… obviamente redondeando para arriba para que nosotros nos
 * quede mayor margen». Los 896 exactos se redondean a 900: el cliente ve números que puede sumar de cabeza (1 clip 900,
 * 18 clips 16.200, un minuto 5.400) y los 4 MT del redondeo quedan de nuestro lado. Es poca plata por clip (US$0,004) y
 * no es por la plata: **un gasto con cifras como 16.128 se lee como un error de cálculo**, igual que el «US$ 109,5» que
 * el test del clip suelto pescó esta misma tarde.
 * **La regla, para el que agregue una generación nueva:** el costo se mide, y el PRECIO en MT es ese costo redondeado
 * HACIA ARRIBA a una cifra que se lea (centena para el video, unidad para la imagen). Nunca hacia abajo: eso es regalar
 * margen en cada llamada.
 */
export const MT_POR_CLIP = 900;

/**
 * Lo que sale un clip suelto, DERIVADO de la tarifa: 900 MT ÷ 250 = **US$3,60**.
 *
 * ⚠️ YA NO SE ESCRIBE A MANO, y el ida y vuelta del 15/11 es el porqué: en un mismo día fue 2 → 3 → 2,50 → 3, cada vez
 * persiguiendo el piso marginal, que se mueve con los clips del plan. Derivado de la tarifa deja de perseguir nada.
 * El piso se sigue vigilando (`respetaElPiso`), pero ahora como una COMPROBACIÓN y no como la fuente del precio: con 26
 * clips en el plan grande y 0 en el chico, el piso es US$1,92 y los US$3,60 lo pasan con aire — recargar sigue siendo
 * más caro que subir de plan, que es lo que Martín quiere («la idea es que compren el de 97»).
 */
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
 * Entonces la bolsa es ÚNICA y fungible: con 24.000 MT son **26 clips**, o **2.000 imágenes**, o cualquier mezcla, y de
 * ahí salen también los guiones, los copys y las transcripciones. La equivalencia que la explica en una línea:
 * **1 clip = 75 imágenes** (900 ÷ 12). Cada clip que no hace le compra 75 imágenes más.
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

/** Si un precio por clip respeta el piso. Mira el marginal y SOLO el marginal. */
export function respetaElPiso(usdPorClip: number): boolean {
  const m = pisoMarginal();
  return m != null && usdPorClip > m;
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
 * Los clips y las imágenes son **los dos extremos**, no una división del paquete: con 5.000 MT se hacen 5 clips, o 416
 * imágenes, o cualquier mezcla. Se muestran los extremos porque es lo que contesta «¿para qué me alcanza?».
 */
export function paqueteDeTokens(usd: number): Paquete {
  const mt = Math.max(0, usd) * MT_POR_DOLAR;
  const clips = Math.floor(mt / MT_POR_CLIP);
  return { usd, mt, clips, minutos: clips / CLIPS_POR_MINUTO, imagenes: Math.floor(mt / mtDeImagenes(1)) };
}

/**
 * LOS PAQUETES QUE SE OFRECEN, en dólares redondos (15/11/2026, Martín: «que el cálculo de los MaKo Tokens sean redondos
 * para el cliente»). Con la tarifa de 250 MT por dólar, los cuatro quedan redondos **en las dos unidades**:
 *     US$10 →  2.500 MT   (2 clips, o 208 imágenes)
 *     US$20 →  5.000 MT   (5 clips, o 416 imágenes)
 *     US$40 → 10.000 MT   (11 clips, o 833 imágenes)
 *     US$100 → 25.000 MT  (27 clips, o 2.083 imágenes)
 * Y los cuatro dejan el 75%, el mismo margen que el plan.
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
