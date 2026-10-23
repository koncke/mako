// =============================================================================
// Calculadora de presupuesto de anuncios: ¿cuántos ángulos testeo con lo que tengo?
// =============================================================================
// Pedido de Martín (audio del 22/10/2026), textual: «yo no puedo salir a hacer 10
// pruebas A/B con todas las funcionalidades y todos los avatares si mi presupuesto
// actual es de 2.000 dólares... tengo que definir cuántas funcionalidades y cuántos
// avatares ataco... la mayoría de emprendedores siempre tienen la duda de cuánto
// debo invertir».
//
// Entra: presupuesto, días de pauta, lo que cuesta un resultado (lead, conversación o
// venta), el ticket, y cuántos avatares y funcionalidades tiene la persona.
// Sale: cuántos ángulos se testean con datos suficientes, cómo se reparten entre
// avatares y funcionalidades, cuánto por anuncio y por cuántos días, y lo que queda
// para escalar al ganador.
//
// Los DOS criterios, cada uno donde corresponde (no son alternativas):
//   · TESTEO → «mínimo para decidir»: RESULTADOS_PARA_DECIDIR por ángulo. Cada ángulo
//     va en su conjunto, con su presupuesto (si van juntos, Meta le da casi todo a uno
//     y los otros no juntan nada). Un conjunto de testeo NO sale de aprendizaje y no
//     hace falta: alcanza para descartar.
//   · ESCALA → «salir de aprendizaje»: RESULTADOS_APRENDIZAJE en DIAS_APRENDIZAJE en el
//     conjunto del ganador. Si el diario de la escala no llega, se avisa.
//
// Es PURA: la pantalla (app/ads-manager/CalculadoraPresupuesto.tsx), el chat de MaKo y
// la API (lib/api-mako) llaman a ésta, y nadie más hace la cuenta.
// =============================================================================

import { RECON_LEADS_VALIDACION } from './config';

/** Meta: un conjunto sale de la fase de aprendizaje con unos 50 resultados en 7 días. */
export const RESULTADOS_APRENDIZAJE = 50;
export const DIAS_APRENDIZAJE = 7;

/**
 * El mínimo para decidir entre ángulos: la MISMA vara con la que el panel Recon del Ads
 * Manager da un anuncio por validado (lib/config.ts, metodología de Jan, hoy 10). Si la
 * calculadora usara otra, el plan diría «alcanza» y la tabla diría «sin validar» con
 * los mismos números. Una cosa, un lugar.
 */
export const RESULTADOS_PARA_DECIDIR = RECON_LEADS_VALIDACION;

/** Una ronda de testeo dura lo que la ventana de aprendizaje: cubre cada día de la semana. */
export const DIAS_RONDA = 7;

/** Como mucho la mitad del presupuesto va a testear; la otra mitad escala al ganador. */
export const TOPE_TESTEO = 0.5;

/**
 * Como mucho 3 avatares y 3 funcionalidades por test: la matriz de Jan (3 × 3 = 9
 * RECON, la de la fábrica de creativos de MaKo). Con 24 funcionalidades y plata de
 * sobra, la cuenta proponía probar 15: nadie mira 15 anuncios de a uno, y elegir las
 * 3 mejores es parte del trabajo (lo hace el chat de MaKo con la persona).
 */
export const MAX_POR_DIMENSION = 3;

export type Evento = 'lead' | 'venta';

export type EntradaCalculadora = {
  /** Lo que hay para pautar en toda la ventana, en la moneda de la cuenta. */
  presupuesto: number;
  /** Días de la ventana de pauta. */
  dias: number;
  /** Lo que cuesta UN resultado del evento al que optimiza la campaña (CPL o CPA). */
  costoPorResultado: number;
  /** 'lead' = lead, registro o conversación iniciada; 'venta' = compra. */
  evento: Evento;
  /** Lo que deja una venta. */
  ticket: number;
  /** Sólo con evento 'lead': de cada 100 resultados, cuántos compran (admite decimales). */
  cierre?: number;
  /** Cuántos avatares tiene armados la persona (para no proponer más de los que existen). */
  avatares: number;
  /** Cuántas funcionalidades / razones / ofertas tiene para mostrar. */
  funcionalidades: number;
};

export type Ronda = {
  /** Qué se compara en la ronda. */
  que: 'avatares' | 'funcionalidades' | 'matriz';
  avatares: number;
  funcionalidades: number;
  /** Anuncios (= conjuntos) de la ronda: avatares × funcionalidades. */
  anuncios: number;
  dias: number;
  diarioPorAnuncio: number;
  /** Lo que se gasta la ronda entera. */
  gasto: number;
};

export type Modo = 'matriz' | 'secuencial' | 'una-dimension' | 'sin-test';

export type PlanCalculadora = {
  ok: true;
  modo: Modo;
  /** Resultados que compra el presupuesto entero. */
  resultados: number;
  /** Lo que cuesta llevar UN ángulo al mínimo para decidir. */
  costoPorAngulo: number;
  /** Ángulos que entran en el tope de testeo con datos suficientes. */
  angulosPosibles: number;
  /** Los que el plan usa de verdad (≤ posibles, ≤ los que la persona tiene). */
  angulos: number;
  /** Con el criterio estricto (50 por ángulo), cuántos entrarían. */
  angulosEstricto: number;
  rondas: Ronda[];
  testeo: { gasto: number; dias: number };
  escala: { gasto: number; dias: number; diario: number; resultadosPorSemana: number; saleDeAprendizaje: boolean; diarioParaAprendizaje: number };
  costoPorVenta: number;
  ventas: number;
  facturacion: number;
  roas: number;
  avisos: string[];
};

export type ErrorCalculadora = { ok: false; error: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
const positivo = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const entero = (n: number) => Math.max(1, Math.floor(n));

/** El primer campo que no sirve, con lo que hay que poner. Una frase. */
function validar(e: EntradaCalculadora): string | null {
  if (!positivo(e.presupuesto)) return 'Pon el presupuesto';
  if (!positivo(e.dias)) return 'Pon los días de pauta';
  if (!positivo(e.costoPorResultado)) return 'Pon el costo por resultado';
  if (!positivo(e.ticket)) return 'Pon el ticket';
  if (e.evento === 'lead' && !positivo(e.cierre)) return 'Pon cuántos de cada 100 compran';
  if (e.evento === 'lead' && (e.cierre as number) > 100) return 'De cada 100, no más de 100';
  if (!positivo(e.avatares) || !positivo(e.funcionalidades)) return 'Pon cuántos avatares y funcionalidades tienes';
  if (e.costoPorResultado > e.presupuesto) return 'El presupuesto no alcanza para un resultado';
  return null;
}

type Opcion = { modo: Modo; rondas: Omit<Ronda, 'dias' | 'diarioPorAnuncio' | 'gasto'>[] };

/**
 * Todas las formas de repartir los ángulos posibles entre avatares y funcionalidades
 * (la elección entre ellas la hace `elegir`, con la plata y los días):
 *
 * · MATRIZ a × f en una ronda: la más rápida, y ve las combinaciones (lo que le sirve a
 *   un avatar puede no servirle a otro).
 * · SECUENCIAL: primero AVATARES (con la funcionalidad principal), después
 *   FUNCIONALIDADES sobre el avatar ganador. a + f anuncios en vez de a × f, a cambio de
 *   una semana más. Primero el «¿a quién?»: es la palanca más grande.
 * · UNA DIMENSIÓN: sólo avatares (o sólo funcionalidades, si hay un solo avatar).
 * · SIN TEST: un anuncio y todo a ése.
 */
export function opciones(posibles: number, avataresDisp: number, funcsDisp: number): Opcion[] {
  const A = Math.min(MAX_POR_DIMENSION, entero(avataresDisp));
  const F = Math.min(MAX_POR_DIMENSION, entero(funcsDisp));
  const ronda = (que: Ronda['que'], a: number, f: number) => ({ que, avatares: a, funcionalidades: f, anuncios: a * f });
  const out: Opcion[] = [{ modo: 'sin-test', rondas: [] }];
  for (let a = 2; a <= A; a++) {
    for (let f = 2; f <= F; f++) {
      if (a * f <= posibles) out.push({ modo: 'matriz', rondas: [ronda('matriz', a, f)] });
      if (a + f <= posibles) out.push({ modo: 'secuencial', rondas: [ronda('avatares', a, 1), ronda('funcionalidades', 1, f)] });
    }
  }
  for (let a = 2; a <= Math.min(A, posibles); a++) out.push({ modo: 'una-dimension', rondas: [ronda('avatares', a, 1)] });
  if (A === 1) for (let f = 2; f <= Math.min(F, posibles); f++) out.push({ modo: 'una-dimension', rondas: [ronda('funcionalidades', 1, f)] });
  return out;
}

/** Cuántos avatares y cuántas funcionalidades distintas llegan a probarse (sin test = 1 + 1). */
export function cobertura(o: Opcion): number {
  const a = Math.max(1, ...o.rondas.map((r) => r.avatares));
  const f = Math.max(1, ...o.rondas.map((r) => r.funcionalidades));
  return a + f;
}

export function calcularPresupuestoAds(e: EntradaCalculadora): PlanCalculadora | ErrorCalculadora {
  const error = validar(e);
  if (error) return { ok: false, error };

  const costo = e.costoPorResultado;
  const resultados = Math.floor(e.presupuesto / costo);
  const costoPorAngulo = RESULTADOS_PARA_DECIDIR * costo;
  const topeTesteo = e.presupuesto * TOPE_TESTEO;
  const angulosPosibles = Math.floor(topeTesteo / costoPorAngulo);
  const angulosEstricto = Math.floor(topeTesteo / (RESULTADOS_APRENDIZAJE * costo));

  const diarioParaAprendizaje = r2((RESULTADOS_APRENDIZAJE * costo) / DIAS_APRENDIZAJE);
  const armar = (o: Opcion) => {
    const rondas: Ronda[] = o.rondas.map((r) => ({
      ...r,
      dias: DIAS_RONDA,
      diarioPorAnuncio: r2(costoPorAngulo / DIAS_RONDA),
      gasto: r2(r.anuncios * costoPorAngulo),
    }));
    const testeo = { gasto: r2(rondas.reduce((s, r) => s + r.gasto, 0)), dias: rondas.length * DIAS_RONDA };
    const gasto = r2(e.presupuesto - testeo.gasto);
    const dias = Math.max(1, e.dias - testeo.dias);
    const diario = r2(gasto / dias);
    const escala = {
      gasto, dias, diario,
      resultadosPorSemana: Math.floor((diario * DIAS_APRENDIZAJE) / costo),
      saleDeAprendizaje: diario >= diarioParaAprendizaje,
      diarioParaAprendizaje,
    };
    return { modo: o.modo, cobertura: cobertura(o), rondas, testeo, escala };
  };

  // Entran las que caben en el tope de testeo y dejan al menos una semana para escalar.
  const candidatas = opciones(angulosPosibles, e.avatares, e.funcionalidades)
    .map(armar)
    .filter((c) => c.testeo.gasto <= topeTesteo && (c.modo === 'sin-test' || c.testeo.dias + DIAS_RONDA <= e.dias));
  // Gana: (1) una que de verdad compare algo, (2) que deje la escala fuera de aprendizaje,
  // (3) la que más avatares + funcionalidades prueba, (4) la más corta, (5) la más barata.
  const conTest = candidatas.filter((c) => c.modo !== 'sin-test');
  const pool = conTest.length ? conTest : candidatas;
  const elegida = [...pool].sort((x, y) =>
    Number(y.escala.saleDeAprendizaje) - Number(x.escala.saleDeAprendizaje)
    || y.cobertura - x.cobertura
    || x.testeo.dias - y.testeo.dias
    || x.testeo.gasto - y.testeo.gasto)[0];
  const { modo, rondas, testeo, escala } = elegida;
  const angulos = rondas.reduce((s, r) => s + r.anuncios, 0);

  const tasa = e.evento === 'venta' ? 1 : (e.cierre as number) / 100;
  const costoPorVenta = r2(costo / tasa);
  const ventas = r2(resultados * tasa);
  const facturacion = r2(ventas * e.ticket);
  const roas = r2(facturacion / e.presupuesto);

  // Frases cortas: las dibuja la pantalla y las lee el chat. El número va aparte.
  const avisos: string[] = [];
  if (modo === 'sin-test') avisos.push('No alcanza para comparar ángulos: un solo anuncio');
  if (!escala.saleDeAprendizaje) avisos.push('La escala no sale de aprendizaje');
  if (costoPorVenta > e.ticket) avisos.push('Cada venta cuesta más que el ticket');

  return {
    ok: true, modo, resultados, costoPorAngulo: r2(costoPorAngulo), angulosPosibles, angulos, angulosEstricto,
    rondas, testeo, escala, costoPorVenta, ventas, facturacion, roas, avisos,
  };
}
