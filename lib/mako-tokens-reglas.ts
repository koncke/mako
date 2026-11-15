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

/** 1.000 MaKo Tokens = US$1 de costo real de IA. */
export const MT_POR_USD = 1000;

/** De costo a tokens, SIEMPRE hacia arriba: cobrar de menos es regalar margen en cada llamada. */
export const mtDeUsd = (usd: number): number => Math.ceil(usd * MT_POR_USD);

/** De tokens a costo, para mostrarlo. */
export const usdDeMt = (mt: number): number => mt / MT_POR_USD;

/**
 * Los planes y su cupo mensual.
 *
 * ⚠️ EL CUPO NO ES UN NÚMERO ELEGIDO: es el techo de IA que deja el margen objetivo.
 * `docs/costos-ia-y-planes.md`: para sostener 75 % de margen bruto el presupuesto es **US$11,75 en Pro** y
 * **US$24,25 en Growth**. Un workspace intensivo medido gastaba **US$68/mes**, o sea −45 % en Pro: sin medidor,
 * un solo usuario pesado se come el plan.
 */
export type Plan = 'free' | 'pro' | 'growth';

export const CUPO_MENSUAL: Record<Plan, number> = {
  free: 1_500,     // una prueba, y la suficiente para que se vea qué hace
  pro: 11_750,     // US$11,75 — el plan de US$47
  growth: 24_250,  // US$24,25 — el plan de US$97
};

/**
 * Qué clave de acá es cada plan que se VENDE (14/11/2026). ⚠️ Los nombres no coinciden y confunden: estas claves son de
 * cuando los planes eran Free/Pro/Growth (8/8). Hoy MaKo Esencial (US$47, capa `completo`) es `pro` y MaKo Pro (US$97, capa
 * `agencia`) es `growth` (lib/planes-mako.ts). Leer «pro» acá como «MaKo Pro» le da al plan de US$97 el cupo del de US$47.
 */
export const PLAN_DE_CAPA: Readonly<Record<string, Plan>> = { completo: 'pro', agencia: 'growth' };

/** Los MaKo Tokens que trae al mes el plan de esa capa, o null si la capa no es un plan que se vende. */
export const cupoDeCapa = (capa: string): number | null => {
  const p = PLAN_DE_CAPA[capa];
  return p ? CUPO_MENSUAL[p] : null;
};

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
 * US$ por segundo de video generado, por calidad. **Medido el 7/11/2026 contra ApiMart**, no estimado.
 *
 * ⚠️ `normal` era 0,030 y estaba 28 % por debajo del costo real: eso salía directo del margen en cada
 * generación. Si se cambia de modelo, este número se vuelve a MEDIR; no se copia del tarifario.
 */
export const USD_POR_SEGUNDO: Record<Calidad, number> = { normal: 0.0384, premium: 0.084 };

/** US$ por imagen, por calidad. FLUX.2 dev y GPT Image 2 medium. */
export const USD_POR_IMAGEN: Record<Calidad, number> = { normal: 0.012, premium: 0.047 };

/** Lo que cuesta, en MT, generar un video de `segundos` con esa calidad. */
export const mtDeVideo = (segundos: number, calidad: Calidad = 'normal'): number =>
  mtDeUsd(Math.max(0, segundos) * USD_POR_SEGUNDO[calidad]);

/** Lo que cuesta, en MT, generar `cuantas` imágenes con esa calidad. */
export const mtDeImagenes = (cuantas: number, calidad: Calidad = 'normal'): number =>
  mtDeUsd(Math.max(0, cuantas) * USD_POR_IMAGEN[calidad]);

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
