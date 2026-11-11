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
//   MEDIDO    lo que cuesta cobrar (1,80% de pasarela + 8,36% de impuesto, `PASARELA` + `IMPUESTO`) y el CAC.
//
// ⚠️ NINGÚN NÚMERO SE INVENTA CUANDO FALTA UN DATO. Si no hay clientes, el fijo por cliente es
// `null`, no 0 ni Infinity; si no se pudo leer el MRR, el resultado es `null` y la pantalla lo dice.
// Es la misma regla que ya gobierna esta pantalla: un cero puede significar «no pude leer», y ahí
// deja de ser un dato. (El «0 min» de GitHub Actions es exactamente ese caso.)
// =============================================================================

/**
 * La pasarela: Mercado Pago con la plata a 35 días, 1,80% (docs/estrategia-financiera-mako.md §2; Martín, 7/11/2026).
 * ⚠️ Hasta el 7/11 esto era un 15% único que llevaba adentro a Creem (5,75%) y el giro (0,7-1,1%). Creem rechazó la tienda
 * el 5/11, y no hay otra pasarela viva: ese 15% no tenía nada detrás (docs/tableros/LEEME.md, «La pasarela NO es el
 * impuesto»; corregido acá el 10/11).
 */
export const PASARELA = 0.018;

/** El impuesto: monotributo H, 8,36% efectivo (estrategia-financiera-mako.md:128). Hoy lo paga Leandro, y es un costo igual. */
export const IMPUESTO = 0.0836;

/** Lo que se va en cobrar: la pasarela más el impuesto (10,16%). Van separados arriba para poder mostrarlos aparte. */
export const PARTE_DE_COBRAR = PASARELA + IMPUESTO;

/** La meta de clientes de Martín: «La meta que te pusiste son 50» (docs/tableros/numeros-mako.html). Reparte el fijo. */
export const META_CLIENTES = 50;

/**
 * Lo que cuesta traer un cliente. Es el 100% del primer mes que cobra un MaKo Partner, y también
 * el techo que Martín se puso en Meta (7/11: «lo máximo que debería ponerme como objetivo»).
 */
export const CAC_USD = 97;

/**
 * Los meses que se queda un cliente: 9, decisión de Martín (10/11/2026), hasta que haya bajas reales para medirla. Textual:
 * «bajalo a 9 meses, me parece más realista… la gran mayoría no dura esa cantidad de tiempo».
 * ⚠️ Antes eran 22,2: el benchmark de SaaS para pymes (4,5% de churn por mes → 1/0,045). No era una medición, y Martín no
 * le creyó. 9 es lo que ya usaba el modelo viejo para el plan de 47 (`modelo.ts`, retención del 23%). Lo medido al 10/11: 3
 * clientes que pagan y 0 bajas, que no alcanzan para nada.
 *
 * ⚠️ Y VA AL REVÉS DE LA INTUICIÓN: una vida CORTA empeora el margen, no lo mejora, porque el CAC
 * se reparte sobre menos meses. A 9 meses son US$10,78/mes; a 22 eran US$4,37; a 4 serían US$24,25.
 */
export const MESES_DE_VIDA = 9;

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

// =============================================================================
// LO QUE QUEDA EN EL BOLSILLO con N clientes (7/11/2026)
// =============================================================================
// Martín, 7/11: «no entiendo la tabla. ¿Cómo es posible que vendiendo 10 clientes me quede con 44 dólares, y con 20 me
// quede con 500?». **Tenía razón en no entenderlo, y el error era de la frase, no de la cuenta:** la pantalla decía «con 10
// clientes son US$43,83 por cliente», que es el GASTO FIJO dividido por los clientes, y se lee como la ganancia.
//
// ⚠️ LA IA NO SE RESTA POR CLIENTE. Cada negocio conecta y paga SU propia clave (BYOK, lib/ia-del-negocio.ts): la
// generación del cliente no es un costo de MaKo. Lo que MaKo gasta de IA es de plataforma y ya está en el fijo. Restarla
// por cliente la contaría dos veces y haría que el negocio pareciera peor de lo que es.
//
// Es LINEAL: cada cliente deja lo mismo, y el fijo se paga una sola vez. Por eso pasar de 10 a 20 no duplica lo que queda,
// lo más que duplica — la segunda decena ya no tiene que pagar el fijo otra vez.

/** Lo que deja UN cliente de ese plan cada mes: lo que cobra, menos cobrarlo, menos su parte del CAC. */
export const dejaUnCliente = (planUsd: number): number => planUsd - planUsd * PARTE_DE_COBRAR - cacPorMes();

/** Lo que queda en el bolsillo con `clientes` de ese plan, pagando `fijoMensualUsd`. Negativo = se pierde. */
export const loQueQueda = (clientes: number, planUsd: number, fijoMensualUsd: number): number =>
  dejaUnCliente(planUsd) * Math.max(0, clientes) - fijoMensualUsd;

/**
 * Cuántos clientes de ese plan hacen falta para no perder. `null` si cada uno deja cero o menos: ahí no hay cantidad que
 * alcance, y devolver un número enorme sugeriría que sí.
 */
export function clientesParaNoPerder(planUsd: number, fijoMensualUsd: number): number | null {
  const deja = dejaUnCliente(planUsd);
  return deja > 0 ? Math.ceil(fijoMensualUsd / deja) : null;
}

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
