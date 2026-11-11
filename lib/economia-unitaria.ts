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

// ⚠️ IMPORTA SÓLO MÓDULOS SIN IMPORTS PROPIOS (mako-tokens-reglas, mako-tokens-paquetes, costos-fijos): `uso-del-cupo.ts`
// importa de acá, así que este archivo NO puede importar de él (un ciclo de imports en los tests de tsx deja exports a
// medio cargar). Por eso `USO_SUPUESTO` y `techoDeIa` viven acá desde el 10/11/2026 y `uso-del-cupo.ts` los re-exporta.
import { CUPO_MENSUAL, usdDeMt, type Plan } from './mako-tokens-reglas';
import { USD_DEL_PLAN } from './mako-tokens-paquetes';
import { fijoDeMartin } from './costos-fijos';

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

// =============================================================================
// A DÓNDE VA LO QUE PAGA UN CLIENTE, por plan (10/11/2026)
// =============================================================================
// Martín, 10/11: «la torta de un cliente de 97: cuánto le queda y a dónde va cada dólar», y que esté en SuperAdmin › Costs
// con lo del tablero local (docs/tableros/numeros-mako.html): los selectores, el primer mes, el techo del CAC y los cupos.
// La torta vivía armada en app/admin/estrategia/datos.ts (`tortaDePlan`, rama punta/torta-97); ahora la arma ESTA función y
// la usan las dos páginas, así no pueden decir dos números distintos.
//
//   cobro      precio × pasarela (Mercado Pago a 35 días, 1,80%)
//   impuesto   precio × impuesto (monotributo H, 8,36%). Va APARTE de la pasarela (docs/tableros/LEEME.md)
//   servir     el video con IA (el uso del cupo del plan) + su parte del gasto fijo (el fijo ÷ los clientes)
//   conseguir  el CAC repartido en la vida del cliente
//   ganancia   lo que queda
// La IA de texto NO es una parte: la paga cada negocio con su clave (lib/ia-del-negocio.ts).
//
// ⚠️ SUMAN EXACTO AL CENTAVO: cada parte se redondea a 2 decimales y la ganancia es el precio menos el resto. El 97 con el
// escenario del modelo da 67,94 · 4,37 · 14,83 · 8,11 · 1,75 (tests/costs-suscripcion.test.ts).
//
// ⚠️ EL TECHO DEL CAC ES «LO QUE DEJA DESDE EL SEGUNDO MES», CON EL FIJO ADENTRO. El tablero local lo calculaba como precio −
// cobrar − IA, sin la parte del fijo (81,08 en el 97, contando el impuesto). Acá se usa el mismo modelo que la torta, donde
// «servir la cuenta» lleva la parte del fijo: así el primer mes (−24,69 con un CAC de 97) es exactamente el techo menos el
// CAC, y la página no dice dos cosas que no cierran. Lo anotó docs/relevo/nube-costs-suscripcion.md para que decida Martín.

/**
 * El uso del cupo que se SUPONE mientras `tasaDeUsoMedida` (lib/uso-del-cupo.ts) no tenga meses: 25%, el valor inicial del
 * deslizador de docs/tableros/numeros-mako.html. Es un supuesto, no una medición: hoy nadie genera video.
 */
export const USO_SUPUESTO = 0.25;

/** Lo que cuesta, como mucho, la IA de un cliente de ese plan en un mes: su cupo entero (lib/uso-del-cupo.ts lo re-exporta). */
export const techoDeIa = (plan: Plan): number => usdDeMt(CUPO_MENSUAL[plan]);

/** Los planes que pagan. */
export type PlanPago = 'pro' | 'growth';
export const PLANES_PAGOS: readonly PlanPago[] = ['pro', 'growth'];

/**
 * Por dónde se cobra, con lo que se lleva cada camino. Son las cuatro opciones del tablero local, con su fuente:
 * docs/estrategia-financiera-mako.md §2 y la recomendación 3 (Mercado Pago, 24/10/2026) y la tabla de Argentina directo.
 * La primera es la del modelo (`PASARELA`).
 */
export const PASARELAS = [
  { id: 'mp-35', nombre: 'Mercado Pago a 35 días', tasa: PASARELA },
  { id: 'mp-ya', nombre: 'Mercado Pago al instante', tasa: 0.0761 },
  { id: 'creem-paddle', nombre: 'Creem / Paddle', tasa: 0.0575 },
  { id: 'directo', nombre: 'Transferencia o Binance', tasa: 0 },
] as const;

/** Lo que se puede mover para ver otro escenario. Lo que no se pasa, sale del modelo (`ESCENARIO_DEL_MODELO`). */
export type Escenario = {
  /** Entre cuántos clientes se reparte el fijo. */
  readonly clientes: number;
  /** Lo que cuesta traer un cliente, en US$, entero. */
  readonly cacUsd: number;
  /** La parte del cupo de video que se usa, de 0 a 1. */
  readonly usoDelCupo: number;
  /** Lo que se lleva la pasarela, de 0 a 1. */
  readonly pasarela: number;
  /** El impuesto, de 0 a 1 (0 = no contarlo: hoy lo paga Leandro). */
  readonly impuesto: number;
  /** El gasto fijo mensual que se reparte. */
  readonly fijoMensualUsd: number;
};

/** El escenario del modelo del 7/11: 50 clientes, CAC de 97, 25% del cupo, Mercado Pago a 35 días, con impuesto, el fijo de Martín. */
export const ESCENARIO_DEL_MODELO: Escenario = {
  clientes: META_CLIENTES,
  cacUsd: CAC_USD,
  usoDelCupo: USO_SUPUESTO,
  pasarela: PASARELA,
  impuesto: IMPUESTO,
  fijoMensualUsd: fijoDeMartin(),
};

export type ClaveDeParte = 'ganancia' | 'conseguir' | 'servir' | 'impuesto' | 'cobro';

/** Cómo se llama cada parte en las dos páginas (la torta de /admin/estrategia y el reparto de Costs). */
export const NOMBRE_DE_PARTE: Record<ClaveDeParte, string> = {
  ganancia: 'Ganancia',
  conseguir: 'Captación',
  servir: 'Servir la cuenta',
  impuesto: 'Impuesto',
  cobro: 'Cobro',
};

export type ParteDeSuscripcion = { readonly clave: ClaveDeParte; readonly usd: number };

export type Suscripcion = {
  readonly plan: PlanPago;
  readonly precioUsd: number;
  /** Las cinco partes de un mes, en este orden (ganancia, captación, servir, impuesto, cobro). Suman el precio al centavo. */
  readonly partes: readonly ParteDeSuscripcion[];
  /** El cupo de video e imagen del plan, en MaKo Tokens, y lo que vale como mucho. */
  readonly cupoMt: number;
  readonly techoIaUsd: number;
  /** Lo que se supone que se gasta del cupo (el uso del escenario × el techo), sin redondear. */
  readonly videoUsd: number;
  /** El fijo de cada cliente. `null` si no hay clientes entre quienes repartirlo. */
  readonly fijoPorClienteUsd: number | null;
  readonly cacUsd: number;
  readonly mesesDeVida: number;
  /** Lo que deja desde el segundo mes: el precio menos cobrarlo, el impuesto y servirlo. Es el techo del CAC. */
  readonly desdeElSegundoMesUsd: number;
  /** El primer mes, pagando el CAC entero. Negativo = ese mes se pierde. */
  readonly primerMesUsd: number;
  readonly avisos: readonly string[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const entre01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const noNegativo = (n: number) => Math.max(0, Number.isFinite(n) ? n : 0);

/**
 * A dónde va lo que paga un cliente de ese plan cada mes, y su primer mes.
 *
 * ⚠️ Con 0 clientes el fijo NO se reparte: `fijoPorClienteUsd` es `null`, «servir» lleva sólo el video y sale un aviso. Un
 * fijo «por cliente» sin clientes no es un número.
 */
export function loQueSeVaDeUnaSuscripcion(plan: PlanPago, cambios: Partial<Escenario> = {}): Suscripcion {
  const e: Escenario = { ...ESCENARIO_DEL_MODELO, ...cambios };
  const avisos: string[] = [];
  const precio = USD_DEL_PLAN[plan];
  const clientes = Number.isFinite(e.clientes) ? Math.max(0, Math.trunc(e.clientes)) : 0;
  const cac = noNegativo(e.cacUsd);
  const techoIa = techoDeIa(plan);
  const video = techoIa * entre01(e.usoDelCupo);
  const fijoPorCliente = clientes > 0 ? noNegativo(e.fijoMensualUsd) / clientes : null;
  if (fijoPorCliente == null) avisos.push('Sin clientes, el gasto fijo no se reparte entre nadie.');

  const resto: ParteDeSuscripcion[] = [
    { clave: 'conseguir', usd: r2(cac / MESES_DE_VIDA) },
    { clave: 'servir', usd: r2(video + (fijoPorCliente ?? 0)) },
    { clave: 'impuesto', usd: r2(precio * entre01(e.impuesto)) },
    { clave: 'cobro', usd: r2(precio * entre01(e.pasarela)) },
  ];
  const suma = resto.reduce((s, p) => s + p.usd, 0);
  const partes: ParteDeSuscripcion[] = [{ clave: 'ganancia', usd: r2(precio - suma) }, ...resto];

  const deResto = (clave: ClaveDeParte) => resto.find((p) => p.clave === clave)?.usd ?? 0;
  const desdeElSegundoMes = r2(precio - deResto('cobro') - deResto('impuesto') - deResto('servir'));
  return {
    plan,
    precioUsd: precio,
    partes,
    cupoMt: CUPO_MENSUAL[plan],
    techoIaUsd: techoIa,
    videoUsd: video,
    fijoPorClienteUsd: fijoPorCliente,
    cacUsd: cac,
    mesesDeVida: MESES_DE_VIDA,
    desdeElSegundoMesUsd: desdeElSegundoMes,
    primerMesUsd: r2(desdeElSegundoMes - cac),
    avisos,
  };
}
