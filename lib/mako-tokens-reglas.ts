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
 * Qué modelo se usa por defecto. **Acá vive el margen.**
 *
 * Medido el 7/11: un reel de 60 s se arma con ~32 s de video generado (8 clips de 4 s, transiciones entre
 * imágenes consecutivas: es el método del curso de Avatar Hype, que está en nuestro portal). A 15 reels por mes:
 *
 * | modelo            | US$/s | 480 s  | margen sobre US$97 |
 * |-------------------|-------|--------|--------------------|
 * | Veo 3.1 Lite      | 0,030 | US$14  | **82 %**           |
 * | Kling v3 estándar | 0,084 | US$40  | 48 %               |
 * | Wan 3.0           | 0,100 | US$48  | 44 %               |
 *
 * Por eso el barato es el DEFAULT y el bueno se paga con tokens: el cliente elige dónde gastar su cupo, y el
 * margen no depende de que no lo use.
 */
export type Calidad = 'normal' | 'premium';

/** US$ por segundo de video generado, por calidad. Verificado el 7/11/2026. */
export const USD_POR_SEGUNDO: Record<Calidad, number> = { normal: 0.030, premium: 0.084 };

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
