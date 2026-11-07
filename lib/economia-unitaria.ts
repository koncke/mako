// =============================================================================
// La economía por cliente, cruzando lo VIVO con lo declarado (7/11/2026)
// =============================================================================
// Martín pidió verlo en SuperAdmin y «que sea en tiempo real, que se vaya actualizando». Esto es la
// parte pura: entra lo que la pantalla ya sabe leer (cuántos clientes pagan y cuánto facturan, de
// `lib/clientes-plataforma.ts`, y el gasto de IA del mes, de `lib/costos-ia.ts`) y sale el punto de
// equilibrio y lo que queda.
//
// ── Qué es vivo y qué es declarado, porque no se puede mezclar sin decirlo ──
//
//   VIVO      los clientes que pagan y su MRR, y el gasto de IA del mes.
//   DECLARADO el gasto fijo (`lib/costos-fijos.ts`): Vercel y GitHub NO se pueden leer por API
//             —403 el primero, el token del segundo no ve facturación— así que van a mano con su
//             fecha. La pantalla muestra cuándo se confirmó cada uno.
//   MEDIDO    lo que cuesta cobrar (14,1-15,5% entre pasarela, impuesto y giro) y el CAC.
//
// ⚠️ NINGÚN NÚMERO SE INVENTA CUANDO FALTA UN DATO. Si no hay clientes, el fijo por cliente es
// `null`, no 0 ni Infinity; si no se pudo leer el MRR, el resultado es `null` y la pantalla lo dice.
// Es la misma regla que ya gobierna esta pantalla: un cero puede significar «no pude leer», y ahí
// deja de ser un dato. (El «0 min» de GitHub Actions es exactamente ese caso.)
// =============================================================================

/** Lo que se va en cobrar: pasarela + impuesto + traer la plata. Medido en docs/estrategia-financiera-mako.md. */
export const PARTE_DE_COBRAR = 0.15;

/**
 * Lo que cuesta traer un cliente. Es el 100% del primer mes que cobra un MaKo Partner, y también
 * el techo que Martín se puso en Meta (7/11: «lo máximo que debería ponerme como objetivo»).
 */
export const CAC_USD = 97;

/**
 * Los meses que se queda un cliente. Benchmark 2026 de SaaS para pymes: 3-5% de churn mensual,
 * 4,5% el promedio → 1/0,045 ≈ 22 meses.
 *
 * ⚠️ Y VA AL REVÉS DE LA INTUICIÓN: una vida CORTA empeora el margen, no lo mejora, porque el CAC
 * se reparte sobre menos meses. A 22 meses son US$4,37/mes; a 4 meses serían US$24,25.
 */
export const MESES_DE_VIDA = 22.2;

export type EntradaEconomia = {
  /** VIVO: los que pagan. Las pruebas no cuentan: no facturan y no se les cobra la adquisición. */
  readonly clientesQuePagan: number;
  /** VIVO: lo que facturan por mes, en US$. `null` si no se pudo leer. */
  readonly mrrUsd: number | null;
  /** VIVO: lo que se gastó de IA en el mes, en US$. `null` si no se pudo leer. */
  readonly iaDelMesUsd: number | null;
  /** DECLARADO: el gasto fijo mensual que sale del bolsillo de quien mira. */
  readonly fijoMensualUsd: number;
};

export type Economia = {
  readonly clientes: number;
  readonly fijoPorCliente: number | null;
  /** Lo que queda después de cobrar, IA, fijo y la parte del CAC que toca este mes. */
  readonly resultadoDelMes: number | null;
  readonly margen: number | null;
  /** Cuántos clientes hacen falta para no perder. `null` si todavía no se puede saber. */
  readonly equilibrio: number | null;
  /** Cuántos faltan para llegar. 0 si ya se pasó. */
  readonly faltanParaElEquilibrio: number | null;
  /** Lo que deja un cliente promedio por mes, ya con todo adentro. */
  readonly dejaCadaCliente: number | null;
  readonly avisos: readonly string[];
};

/** El CAC repartido en la vida del cliente, que es lo que pesa cada mes. */
export const cacPorMes = (): number => CAC_USD / MESES_DE_VIDA;

/**
 * La economía del mes.
 *
 * ⚠️ Con 0 clientes NO devuelve 0: devuelve `null` en lo que depende de dividir, y el aviso lo
 * dice. Un 0 en «fijo por cliente» leería «no cuesta nada», que es lo contrario de la verdad.
 */
export function economiaDelMes(e: EntradaEconomia): Economia {
  const avisos: string[] = [];
  const n = Number.isFinite(e.clientesQuePagan) ? Math.max(0, Math.trunc(e.clientesQuePagan)) : 0;

  const fijoPorCliente = n > 0 ? e.fijoMensualUsd / n : null;
  if (n === 0) avisos.push('Todavía no hay clientes que paguen: el fijo no se reparte entre nadie.');

  if (e.mrrUsd == null) avisos.push('No pude leer lo facturado: sin eso no hay resultado ni margen.');
  if (e.iaDelMesUsd == null) avisos.push('No pude leer el gasto de IA del mes.');

  let resultadoDelMes: number | null = null;
  let margen: number | null = null;
  let dejaCadaCliente: number | null = null;
  let equilibrio: number | null = null;

  if (e.mrrUsd != null && e.iaDelMesUsd != null) {
    const cobrar = e.mrrUsd * PARTE_DE_COBRAR;
    const cac = n * cacPorMes();
    resultadoDelMes = e.mrrUsd - cobrar - e.iaDelMesUsd - e.fijoMensualUsd - cac;
    margen = e.mrrUsd > 0 ? resultadoDelMes / e.mrrUsd : null;
    if (e.mrrUsd <= 0) avisos.push('Lo facturado es cero: no hay margen que calcular.');

    if (n > 0) {
      // Lo que deja UN cliente, sin el fijo: es lo que después cubre el fijo.
      dejaCadaCliente = (e.mrrUsd - cobrar - e.iaDelMesUsd) / n - cacPorMes();
      equilibrio = dejaCadaCliente > 0 ? Math.ceil(e.fijoMensualUsd / dejaCadaCliente) : null;
      if (dejaCadaCliente <= 0) {
        avisos.push('Cada cliente cuesta más de lo que deja: no hay cantidad de clientes que alcance.');
      }
    }
  }

  return {
    clientes: n,
    fijoPorCliente,
    resultadoDelMes,
    margen,
    equilibrio,
    faltanParaElEquilibrio: equilibrio == null ? null : Math.max(0, equilibrio - n),
    dejaCadaCliente,
    avisos,
  };
}
