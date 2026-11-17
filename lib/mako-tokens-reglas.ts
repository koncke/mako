// =============================================================================
// MaKo Tokens — la regla, sin servidor y sin base (7/11/2026)
// =============================================================================
// QUÉ PROBLEMA RESUELVE, en una línea: que MaKo no pueda gastar en IA más de lo que ya cobró.
//
// Martín, 7/11: «quiero reducir al máximo el costo generativo sin perder calidad… que me siga saliendo rentable…
// podemos vender MaKo Tokens». Y sobre el flujo de caja: «no lo tengo que comprar con mi dinero».
//
// ⚠️ LA RECARGA AUTOMÁTICA DEL PROVEEDOR NO RESUELVE ESO. fal, Replicate y OpenAI la traen de fábrica, pero igual
// le cobran a la tarjeta del dueño. **Lo que protege la caja es este medidor**: si una generación sólo corre
// cuando hay saldo, y el saldo entra con el pago, no se puede gastar antes de cobrar. Es una propiedad del
// diseño, no una promesa.
//
// LA UNIDAD ES COSTO, NO TOKENS DE MODELO: **1.000 MT = US$1 de costo real**. Así se cambia de modelo, de
// proveedor o de precio sin rehacer los planes — y esta semana ya se movieron dos veces (los endpoints de Veo 3.1
// en fal se apagan el 17/11/2026).
//
// LO QUE ESTE ARCHIVO NO HACE, A PROPÓSITO: no toca la base, no suma ni resta saldo y no sabe de workspaces. Eso
// vive en el ledger. Acá está la aritmética, que es lo que se puede probar sin levantar nada.
//
// ⚠️ EL CONTADOR NO PUEDE VIVIR EN `app_settings` (docs/costos-ia-y-planes.md): hace read-modify-write NO
// ATÓMICO, y ese bug ya se pagó en este repo (migración 0113). Dos generaciones a la vez se pisan el saldo. El
// ledger va en su propia tabla con índice único.
//
// Las cifras de abajo salen de `docs/costos-ia-y-planes.md` (medido contra `anthropic_usage` en producción,
// 41 días, 23,4M tokens) y de los precios verificados el 7/11 en docs/hallazgos-video-pipeline.md.
// =============================================================================

// El único import, y es a propósito: el costo del video lo fija el modelo (el Omni), y el modelo vive en el catálogo.
// ./apimart-reglas.ts no importa nada, así que no arma ningún ciclo (ver la nota de imports de ./economia-unitaria.ts).
import { MODELOS_VIDEO, MODELO_OMNI } from './apimart-reglas';

/** 1.000 MaKo Tokens = US$1 de costo real de IA. */
export const MT_POR_USD = 1000;

/**
 * De costo a tokens, SIEMPRE hacia arriba: cobrar de menos es regalar margen en cada llamada.
 *
 * ⚠️ EL `Math.round` DE ADENTRO NO ES DECORACIÓN: SIN ÉL, EL REDONDEO HACIA ARRIBA COBRA 1 MT DE MÁS (15/11/2026).
 * `0,012` no se puede representar exacto en coma flotante, así que `1700 * 0.012 * 1000` da **20400.000000000004** y el
 * `Math.ceil` lo sube a 20401. Medido: de las 2.000 primeras cantidades de imágenes, **250 cobraban 1 MT de más** — el
 * 12,5% de los casos. Es poca plata, pero no es un problema de plata: le rompe lo REDONDO al cliente, que es justo lo que
 * Martín pidió el 15/11 («que el cálculo de los MaKo Tokens sean redondos para el cliente… no me gusta que sea un número
 * que no sea redondo»). Un gasto de 20.401 en una pantalla se lee como un error, y lo es.
 * Se redondea a la millonésima ANTES de subir: así el ceil sigue haciendo su trabajo (cualquier costo real por encima de
 * un token entero paga el siguiente) y el ruido de la representación no inventa un token.
 *
 * ⚠️ Y LA OTRA MITAD DE LA CURA ESTÁ EN LOS QUE LLAMAN: para una CANTIDAD de cosas iguales, se saca el costo de UNA en
 * MT y se multiplica (`mtDeImagenes`). Multiplicar dólares y después convertir arrastra el error tantas veces como
 * unidades haya.
 */
export const mtDeUsd = (usd: number): number => Math.ceil(Math.round(usd * MT_POR_USD * 1e6) / 1e6);

/** De tokens a costo, para mostrarlo. */
export const usdDeMt = (mt: number): number => mt / MT_POR_USD;

/**
 * Qué modelo se usa por defecto. **Acá vive el margen.**
 *
 * Un reel de 60 s se arma con ~32 s de video generado (8 clips de 4 s, transiciones entre imágenes consecutivas:
 * es el método del curso de Avatar Hype, que está en nuestro portal). A 15 reels por mes son 480 s.
 *
 * ⚠️ ESTOS PRECIOS ESTÁN **MEDIDOS**, no leídos de una lista. La versión anterior de esta tabla decía «Veo 3.1
 * Lite 0,030» y salía del tarifario de un proveedor; la medición contra ApiMart con la foto real de Mauricio
 * (7/11/2026, cuatro generaciones pagadas) da otra cosa:
 *
 * | modelo                  | US$/s medido | formato que devuelve | ¿sale la persona? |
 * |-------------------------|--------------|----------------------|-------------------|
 * | MiniMax-Hailuo-2.3-Fast | 0,0253       | 768×1024 (3:4) ✗     | sí                |
 * | **seedance-2.0-mini**   | **0,0384**   | **720×1280 (9:16)** ✓| **sí** ← default  |
 * | seedance-2.0-fast-face  | 0,0836       | 720×1280 (9:16) ✓    | sí                |
 * | wan2.6-i2v-flash        | —            | falló, sin cargo     | —                 |
 *
 * **Y EL HALLAZGO QUE PAGA EL MARGEN: la familia `-face` cuesta 2,2× y no compra nada.** La identidad no la
 * preserva el modelo: la preserva el MÉTODO. En image-to-video la foto **es el cuadro 0**, así que la cara no se
 * genera, se arrastra — y un modelo barato la conserva igual de bien. Verificado en el ÚLTIMO cuadro de cada
 * video, que es donde la deriva se nota. Ver `docs/hallazgos-ai-avatar.md`.
 *
 * Hailuo es más barato todavía pero devolvió 3:4, y un reel es 9:16: no sirve de default hasta medir que acepte
 * el formato. Por eso el default es `seedance-2.0-mini`.
 */
export type Calidad = 'normal' | 'premium';

/**
 * US$ por segundo de video generado, por calidad.
 *
 * ⚠️ DESDE EL 17/11/2026 `normal` ES EL OMNI DE MARTÍN y sale del catálogo, no de un número escrito acá:
 * `gemini-omni-1.2-flash-ext` a US$0,024/s (`MODELO_OMNI`, ./apimart-reglas.ts). Era 0,0384, el de `seedance-2.0-mini`
 * —un modelo que Martín prohibió para una cara que habla el 8/11— y convivía con OTRO costo del mismo clip:
 * `MT_POR_CLIP` = 900 (el de `kling-v3-omni`). Los mismos 10 s costaban 384 MT por un camino y 900 por el otro. Ahora
 * son 240 por los dos, y el minuto, 1.440.
 * ⚠️ `premium` (0,084, la familia `-face`) no lo usa nadie para una cara que habla: queda por la vitrina de costos.
 * Antes `normal` era 0,030 y estaba 28 % por debajo del costo real: si se cambia de modelo, se cambia en el catálogo.
 */
export const USD_POR_SEGUNDO: Record<Calidad, number> = { normal: MODELOS_VIDEO[MODELO_OMNI].usdPorSegundo, premium: 0.084 };

/** Lo que cuesta, en MT, UN MINUTO de video con el Omni: 60 × US$0,024 = US$1,44 = **1.440 MT**. Es como se le habla al cliente. */
export const MT_POR_MINUTO_DE_VIDEO = mtDeUsd(60 * USD_POR_SEGUNDO.normal);

/**
 * LOS MINUTOS DE VIDEO QUE TRAE EL PLAN DE US$97, que es el número que se DECIDE (Martín, 17/11/2026, la opción B):
 * **10 minutos** = 14.400 MT. El de US$47 no genera video (`GENERA_VIDEO`, ./mako-tokens-paquetes.ts).
 */
export const MINUTOS_DEL_CUPO_PRO = 10;

/** US$ por imagen, por calidad. FLUX.2 dev y GPT Image 2 medium. */
export const USD_POR_IMAGEN: Record<Calidad, number> = { normal: 0.012, premium: 0.047 };

/** Lo que cuesta, en MT, UNA imagen de esa calidad. 12 MT la normal, 47 la premium. */
export const MT_POR_IMAGEN: Record<Calidad, number> = {
  normal: mtDeUsd(USD_POR_IMAGEN.normal),
  premium: mtDeUsd(USD_POR_IMAGEN.premium),
};

export type Plan = 'free' | 'pro' | 'growth';

/**
 * LAS IMÁGENES QUE SE PROMETEN EN LA VITRINA, y de acá sale el cupo. **Redondas porque las lee un cliente** (15/11/2026).
 *
 * Martín, 15/11: «en el de $47 haz que se redondee a 1000 imágenes, porque eso queda marketinero. Justamente la idea es
 * esa. No sé cómo quedaría el margen ahí, pero yo creo que tranquilamente nos podríamos permitir eso». Se puede, y lo que
 * cuesta está medido en `PISO_DE_MARGEN_BRUTO`: un punto de margen, y sólo en el plan chico.
 *
 * ⚠️ EL CUPO SE DIO VUELTA: ERA LA CAUSA Y AHORA ES LA CONSECUENCIA. Hasta hoy el número elegido era el cupo (11.500,
 * 24.000) y las imágenes salían de dividirlo — por eso daban **958**, que es exactamente la clase de cifra que no puede
 * estar en una vitrina. Dado vuelta, se decide el número redondo y el cupo es su costo.
 * Y el detalle que muestra que esta era la forma correcta desde el principio: **puesto así, dos de los tres cupos caen en
 * el MISMO valor que ya tenían** (125 × 12 = 1.500 en la prueba, 2.000 × 12 = 24.000 en el de US$97). Sólo se movió el del
 * medio, que era justo el que no daba redondo.
 *
 * ⚠️ Y POR ESO EL MÚLTIPLO IMPORTA: el cupo tiene que ser múltiplo EXACTO de `MT_POR_IMAGEN.normal`, o el cliente ve 999
 * imágenes y un resto que no le alcanza para nada. Un test lo comprueba en los dos sentidos.
 *
 * El de US$47 no genera video (`GENERA_VIDEO`, ./mako-tokens-paquetes.ts), así que su bolsa se cuenta en imágenes y nada
 * más.
 *
 * ⚠️ EL DE US$97 SE DIO VUELTA OTRA VEZ EL 17/11/2026: lo que se decide ahí son los MINUTOS de video (10, la opción B de
 * Martín), y sus imágenes son la consecuencia: 14.400 MT ÷ 12 = **1.200**. Era 2.000 (24.000 MT), un cupo que sólo cerraba
 * con el clip mal cobrado. La misma bolsa da 10 minutos o 1.200 imágenes, como quiera.
 */
export const IMAGENES_DEL_CUPO: Record<Plan, number> = {
  free: 125,
  pro: 1_000,
  growth: (MINUTOS_DEL_CUPO_PRO * MT_POR_MINUTO_DE_VIDEO) / MT_POR_IMAGEN.normal,
};

/**
 * Los MaKo Tokens que trae cada plan al mes: **lo que cuestan sus imágenes prometidas** (o, en el de US$97, sus minutos).
 * free 1.500 (US$1,50) · pro 12.000 (US$12,00) · growth 14.400 (US$14,40 = 10 minutos de video).
 *
 * ⚠️ NO ES EL COSTO ESPERADO, ES EL TECHO: es lo máximo que un cliente nos puede costar en IA, y por eso fija el margen
 * bruto MÍNIMO del plan (ver `PISO_DE_MARGEN_BRUTO`). Un workspace intensivo medido gastaba **US$68/mes** sin medidor
 * (`docs/costos-ia-y-planes.md`), o sea −45% en el plan chico: un solo usuario pesado se comía el plan.
 */
export const CUPO_MENSUAL: Record<Plan, number> = {
  free: IMAGENES_DEL_CUPO.free * MT_POR_IMAGEN.normal,
  pro: IMAGENES_DEL_CUPO.pro * MT_POR_IMAGEN.normal,
  growth: IMAGENES_DEL_CUPO.growth * MT_POR_IMAGEN.normal,
};

/**
 * EL MARGEN BRUTO QUE NINGÚN PLAN BAJA: **74%**. Es la guarda del negocio, y el número que hay que mirar antes de
 * agrandarle el cupo a cualquier plan.
 *
 * Por qué 74 y no 75 (15/11/2026): las 1.000 imágenes redondas del de US$47 cuestan US$12,00 de un precio de US$47, o sea
 * **25,5% del precio en vez del 25% de la meta → 74,5% de margen**. Martín lo decidió con el costo a la vista («no sé cómo
 * quedaría el margen ahí, pero yo creo que tranquilamente nos podríamos permitir eso»): **un punto de margen por un número
 * que el cliente puede repetir de memoria**. El de US$97 queda en 85,2% desde el 17/11/2026 (14.400 MT de US$97: sus 10
 * minutos con el Omni a costo de lista; con el 21 % de IVA de la tarjeta, 82%).
 *
 * Lo que cuesta en plata, para que la decisión se pueda revisar con un dato y no con una sensación: el cupo del plan chico
 * sube 500 MT, o sea **US$0,50 por cliente por mes** — y sólo si lo gasta TODO, que es el peor caso, no el esperado.
 *
 * ⚠️ ES EL ÚNICO LUGAR DEL CIRCUITO DONDE SE ELIGIÓ QUEDAR POR DEBAJO DEL 75%. Todos los demás redondeos van para nuestro
 * lado (`mtDeUsd` sube el gasto; el cupo baja cuando no cae redondo). Si alguien agranda otro cupo «porque queda lindo»,
 * el margen se va sumando por abajo y nadie lo ve: por eso el piso está escrito acá y hay un test que recorre TODAS las
 * mezclas de video e imagen de los dos planes contra él.
 */
export const PISO_DE_MARGEN_BRUTO = 0.74;

/**
 * ⚠️ EL REDONDEO DEL CUPO VA AL REVÉS QUE EL DEL GASTO, Y NO ES UN DESCUIDO (15/11/2026).
 *
 * Martín pidió que los números de MaKo Tokens sean redondos para el cliente, «redondeando para arriba para que nosotros
 * nos quede mayor margen». El cupo es lo que se le DA, no lo que se le cobra, así que ahí el lado que nos deja margen es
 * el de ABAJO. Las dos reglas apuntan al mismo lado — el redondeo siempre queda de nuestro lado — y por eso van en
 * direcciones opuestas. El que toque uno de los dos sin pensar en cuál es cuál, lo va a invertir.
 *
 * ⚠️ Y HAY UNA EXCEPCIÓN, UNA SOLA, DECIDIDA A OJO ABIERTO: las 1.000 imágenes del plan de US$47 redondean para ARRIBA
 * (958 → 1.000), porque ese número lo lee un cliente antes de comprar. Cuesta un punto de margen y está medido en
 * `PISO_DE_MARGEN_BRUTO`. No se extiende sola a los otros cupos: ahí la regla sigue siendo hacia abajo.
 */


/**
 * ⚠️ DESDE EL 15/11/2026 ESTE CUPO PAGA **TODA** LA IA, no sólo el video y la imagen.
 *
 * Martín dio vuelta su decisión del 22/10 («cada negocio paga su IA»). Textual, 15/11: «vinculemos todas las cosas
 * que utilicen inteligencia artificial y que todo utilice MaKo Tokens… Lo mismo con la generación de
 * transcripciones, la generación de análisis de la competencia, que eso también gasta dinero. O sea, todo debería
 * consumir MaKo Tokens». Conectar su propia clave (o su Google Flow) sigue existiendo, pero como OPCIÓN: el camino
 * por defecto es gastar MaKo Tokens.
 *
 * Qué cambia en la práctica: hasta el 14/11 el cupo cubría dos cosas (el clip y la imagen) y todo el texto corría
 * con la clave del negocio (`conSuIADelNegocio`, lib/ia-del-negocio.ts). Ahora cubre también los guiones, los copys,
 * las transcripciones, las respuestas del setter y el análisis de la competencia.
 *
 * ⚠️ Y POR ESO EL CUPO NO SE BAJA PARA LIMITAR UN PLAN: bajárselo al de US$47 para que genere menos imágenes le saca, de
 * paso, el texto — que es lo que más usa. Lo que diferencia a los planes es el CANDADO de video (`GENERA_VIDEO`,
 * ./mako-tokens-paquetes.ts) y el tamaño de la bolsa, no un tope por tipo: los topes por tipo vivieron unas horas el
 * 15/11 y se cayeron solos al arreglar el precio del clip (el porqué está en `IMAGENES_POR_MES`).
 * El medidor que descuenta de verdad se construye aparte: hasta el 15/11/2026 **nadie escribía el ledger**
 * (`mako_tokens_movimientos`, supabase/migrations/0412_mako_tokens.sql sólo lo crea).
 */

/**
 * Qué clave de acá es cada plan que se VENDE (14/11/2026). ⚠️ Los nombres no coinciden y confunden: estas claves son de
 * cuando los planes eran Free/Pro/Growth (8/8). Hoy MaKo Essential (US$47, capa `completo`) es `pro` y MaKo Pro (US$97, capa
 * `agencia`) es `growth` (lib/planes-mako.ts). Leer «pro» acá como «MaKo Pro» le da al plan de US$97 el cupo del de US$47.
 */
export const PLAN_DE_CAPA: Readonly<Record<string, Plan>> = { completo: 'pro', agencia: 'growth' };

/**
 * Los MaKo Tokens que trae al mes el plan de esa capa, o null si la capa no es un plan que se vende.
 *
 * ⚠️ EL ACELERADOR NO TIENE CUPO (15/11/2026): trae MaKo Pro los 3 meses, pero nadie decidió cuántos MaKo Tokens da, y
 *    esto NO lo inventa — devuelve null para cualquier capa que no sea `completo` o `agencia`, y su columna de /planes no
 *    habla de tokens. Un número puesto a mano acá es una promesa que el producto no cumple.
 */
export const cupoDeCapa = (capa: string): number | null => {
  const p = PLAN_DE_CAPA[capa];
  return p ? CUPO_MENSUAL[p] : null;
};


/** Lo que cuesta, en MT, generar un video de `segundos` con esa calidad. */
export const mtDeVideo = (segundos: number, calidad: Calidad = 'normal'): number =>
  mtDeUsd(Math.max(0, segundos) * USD_POR_SEGUNDO[calidad]);

/**
 * Lo que cuesta, en MT, generar `cuantas` imágenes con esa calidad.
 *
 * ⚠️ MULTIPLICA EL COSTO DE UNA, NO CONVIERTE EL COSTO DE TODAS (15/11/2026). Era
 * `mtDeUsd(cuantas * USD_POR_IMAGEN[calidad])`, y eso arrastra el error de coma flotante de `0,012` tantas veces como
 * imágenes haya: con 1.700 daba **20.401** en vez de 20.400 (el porqué está en `mtDeUsd`). De las 2.000 primeras
 * cantidades, 250 salían con 1 MT de más. Sacando el costo de UNA (12, exacto) y multiplicando, el resultado es siempre
 * un múltiplo de 12 — redondo, que es lo que el cliente tiene que poder sumar de cabeza.
 */
export const mtDeImagenes = (cuantas: number, calidad: Calidad = 'normal'): number =>
  Math.max(0, Math.floor(cuantas)) * MT_POR_IMAGEN[calidad];

/** Cuántos segundos de video entran en un cupo, con esa calidad. Para decirlo en la pantalla. */
export const segundosQueEntran = (mt: number, calidad: Calidad = 'normal'): number =>
  Math.floor(usdDeMt(Math.max(0, mt)) / USD_POR_SEGUNDO[calidad]);

/**
 * Cuántos VIDEOS por mes deja cada plan, aparte del cupo.
 *
 * ⚠️ EL CUPO SOLO NO ALCANZA, y es un agujero de precio, no un detalle. El cupo topea GASTO, así que un Pro
 * podía gastarse los 11.750 MT enteros en video: 306 s ≈ 9 reels. Martín, 7/11: «**el de 47 sólo le ofreceremos
 * 1 video de prueba al mes** y las imágenes generosas». Sin este tope, el plano de US$47 daba lo mismo por dólar
 * que el de US$97 (los dos cupos son el 25 % del precio) — o sea, ninguna razón para subir de plan.
 *
 * `free` en 0 es a propósito: las imágenes son baratas y ahí el Free puede ser generoso, pero el primer video es
 * exactamente lo que se paga al pasar a Pro. Un Free con video regalado vuelve a borrar el escalón.
 *
 * `growth` es `Infinity` porque ahí el límite ES el cupo: el video es el punto del plan.
 */
export const VIDEOS_POR_MES: Record<Plan, number> = { free: 0, pro: 1, growth: Infinity };

/** El veredicto de un chequeo PRE-VUELO. `alcanza: false` NUNCA se interpreta como «seguí igual». */
export type Veredicto =
  | { alcanza: true; cuesta: number; queda: number }
  | { alcanza: false; cuesta: number; saldo: number; falta: number; motivo: string };

/**
 * ¿Se puede hacer esta llamada con este saldo?
 *
 * ⚠️ ESTO VA **ANTES** DEL FETCH, y es lo único nuevo que hace falta. Los `recordUsage` que ya existen corren
 * DESPUÉS y son fire-and-forget: sirven para contabilizar, **no para frenar** (docs/costos-ia-y-planes.md).
 *
 * ⚠️ Y FALLA CERRADO: un saldo que no se pudo leer es `null`, y `null` NO alcanza. Si un error de base dejara
 * pasar la llamada, el medidor no protege nada justo el día que la base anda mal — que es cuando más raro se
 * comporta todo.
 */
export function alcanzaElSaldo(saldo: number | null, cuesta: number): Veredicto {
  if (saldo == null || !Number.isFinite(saldo)) {
    return { alcanza: false, cuesta, saldo: 0, falta: cuesta, motivo: 'No pude leer tu saldo de MaKo Tokens. Vuelve a intentarlo en un momento.' };
  }
  if (cuesta <= 0) return { alcanza: true, cuesta: 0, queda: saldo };
  if (saldo < cuesta) {
    return {
      alcanza: false, cuesta, saldo, falta: cuesta - saldo,
      motivo: `Te faltan ${cuesta - saldo} MaKo Tokens para esto: cuesta ${cuesta} y tienes ${saldo}.`,
    };
  }
  return { alcanza: true, cuesta, queda: saldo - cuesta };
}

/**
 * ¿Se puede generar ESTE video? Chequea las DOS cosas: el tope de videos del plan y el saldo.
 *
 * ⚠️ El orden importa para lo que ve el cliente. Si se le acabaron los videos del mes, el problema NO es el
 * saldo — decirle «te faltan tokens» lo manda a comprar algo que no le va a servir. Primero el tope, después
 * la plata.
 *
 * ⚠️ Y falla cerrado igual que `alcanzaElSaldo`: un conteo que no se pudo leer (`null`) NO habilita.
 */
export function alcanzaParaVideo(
  plan: Plan,
  videosEsteMes: number | null,
  saldo: number | null,
  cuesta: number,
): Veredicto {
  const tope = VIDEOS_POR_MES[plan];
  if (videosEsteMes == null || !Number.isFinite(videosEsteMes)) {
    return {
      alcanza: false, cuesta, saldo: saldo ?? 0, falta: 0,
      motivo: 'No pude verificar cuántos videos llevas este mes. Vuelve a intentarlo en un momento.',
    };
  }
  if (videosEsteMes >= tope) {
    return {
      alcanza: false, cuesta, saldo: saldo ?? 0, falta: 0,
      motivo: tope === 0
        ? 'Tu plan incluye imágenes, no video. Pasa a Pro para generar tu primer video.'
        : `Ya usaste los ${tope} video${tope === 1 ? '' : 's'} de este mes. Pasa a Growth para generar sin ese tope.`,
    };
  }
  return alcanzaElSaldo(saldo, cuesta);
}
