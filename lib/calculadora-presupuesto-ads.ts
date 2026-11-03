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

/**
 * El piso de una LANDING: con menos, el resultado de esa landing no se lee.
 *
 * Criterio de Martín en la llamada del 30/10/2026
 * (docs/estrategia-lanzamiento-low-to-high.md § 6), con sus dos números: «con US$1.000 son
 * 2 landings» —tres NO: «333 dólares con cada una también estoy yendo corto»— y «con 2.000
 * serían 4, a 500 cada una».
 *
 * ⚠️ ES UN CRITERIO, NO UNA MEDICIÓN de ninguna cuenta, y por eso vive acá con su cita y no
 * se deriva de nada. Lo que gobierna: con menos del piso la respuesta es «te alcanza para
 * MENOS landings» —y en el borde, para ninguna—, nunca «repártelo entre más». Un número que
 * haga gastar mal es peor que no tener la calculadora.
 *
 * ⚠️ Va en la misma unidad que `presupuesto`, que el resto del módulo escribe con `usd()`.
 */
export const PISO_LANDING = 500;

export type PlanLandings = {
  /** Cuántas se pueden probar. 0 = no alcanza ni para una. */
  landings: number;
  /** Lo que corre cada una. 0 cuando no alcanza. */
  porLanding: number;
  alcanza: boolean;
  /** Lo que falta para la primera. 0 cuando alcanza. */
  faltan: number;
  /** La frase principal, lista para pintar. */
  veredicto: string;
  /** Por qué NO una más, con el número que la haría corta. null si no aplica. */
  porQueNoMas: string | null;
  /** Qué hacer cuando no alcanza. null cuando alcanza. */
  queHacer: string | null;
};

/**
 * Cuántas landings paga un presupuesto. PURA, y a propósito SEPARADA de
 * `calcularPresupuestoAds`: esta pregunta no necesita el costo por resultado, así que se
 * puede contestar antes de que el negocio lo sepa (y `calcularPresupuestoAds` se niega sin
 * él). Español neutro: lo lee el cliente.
 */
export function landingsDelPresupuesto(presupuesto: number, piso = PISO_LANDING): PlanLandings {
  const total = positivo(presupuesto) ? Math.floor(presupuesto) : 0;
  const landings = Math.floor(total / piso);
  if (landings < 1) {
    const faltan = piso - total;
    return {
      landings: 0, porLanding: 0, alcanza: false, faltan,
      veredicto: `Con ${usd(total)} no te alcanza para probar ni una landing.`,
      porQueNoMas: null,
      queHacer: `No lo repartas más fino: por debajo de ${usd(piso)} por landing el resultado no te dice nada y la plata se gasta igual. Te faltan ${usd(faltan)} para probar una.`,
    };
  }
  const porLanding = Math.floor(total / landings);
  const siguiente = Math.floor(total / (landings + 1));
  return {
    landings, porLanding, alcanza: true, faltan: 0,
    veredicto: `Con ${usd(total)} te alcanza para probar ${plural(landings, 'landing', 'landings')}, a ${usd(porLanding)} cada una.`,
    porQueNoMas: siguiente < piso ? `${landings + 1} no: a ${usd(siguiente)} cada una vas corto y ninguna te da un resultado claro.` : null,
    queHacer: null,
  };
}


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
  /** Cuántas landings paga el presupuesto (el paso 1 del lanzamiento, 30/10/2026). */
  landings: PlanLandings;
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
    rondas, testeo, escala, costoPorVenta, ventas, facturacion, roas, landings: landingsDelPresupuesto(e.presupuesto), avisos,
  };
}

// ── Lo que se dibuja y lo que se le manda a MaKo (puro: lo usan la pantalla y los tests) ──

export const usd = (n: number) => `US$${n.toLocaleString('es-MX', { maximumFractionDigits: n < 100 ? 2 : 0 })}`;
export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** El plan en una línea: lo que va arriba del resultado y lo primero que lee MaKo. */
export function titularDelPlan(p: PlanCalculadora): string {
  const [r1, r2] = p.rondas;
  if (p.modo === 'matriz') return `${plural(r1.avatares, 'avatar', 'avatares')} × ${plural(r1.funcionalidades, 'funcionalidad', 'funcionalidades')}`;
  if (p.modo === 'secuencial') return `${plural(r1.avatares, 'avatar', 'avatares')}, después ${plural(r2.funcionalidades, 'funcionalidad', 'funcionalidades')}`;
  if (p.modo === 'una-dimension') return r1.que === 'avatares' ? plural(r1.avatares, 'avatar', 'avatares') : plural(r1.funcionalidades, 'funcionalidad', 'funcionalidades');
  return 'Un solo anuncio';
}

/** Lo que se le manda a MaKo: los números de entrada y el plan, para que lo discuta (no lo recalcula a ojo). */
export function textoParaMako(e: EntradaCalculadora, p: PlanCalculadora): string {
  const rondas = p.rondas.map((r, i) => `Semana ${i + 1}: ${r.anuncios} anuncios (${r.que}), ${usd(r.diarioPorAnuncio)} por día cada uno, ${r.dias} días, ${usd(r.gasto)}.`);
  return [
    'Calculé el presupuesto de mis anuncios en el Ads Manager. ¿Qué me recomiendas testear?',
    `Presupuesto ${usd(e.presupuesto)} en ${e.dias} días. ${e.evento === 'lead' ? 'Costo por lead' : 'Costo por venta'}: ${usd(e.costoPorResultado)}. Ticket ${usd(e.ticket)}${e.evento === 'lead' ? `, compran ${e.cierre} de cada 100` : ''}. Tengo ${e.avatares} avatares y ${e.funcionalidades} funcionalidades.`,
    `Plan: ${titularDelPlan(p)} (${RESULTADOS_PARA_DECIDIR} resultados por ángulo).`,
    ...rondas,
    `Escala: ${usd(p.escala.diario)} por día durante ${p.escala.dias} días${p.escala.saleDeAprendizaje ? '' : ` (no sale de aprendizaje: pide ${usd(p.escala.diarioParaAprendizaje)} por día)`}.`,
    p.landings.veredicto + (p.landings.porQueNoMas ? ` ${p.landings.porQueNoMas}` : ''),
    `Ventas esperadas: ${p.ventas} (${usd(p.facturacion)}).`,
    ...p.avisos,
  ].join('\n');
}

// ── Lo que ya dicen los anuncios del negocio (24/10/2026) ───────────────────────────────────────────────────────────
// Pedido del Cerebro para el lanzamiento: «si tiene datos del negocio, que los use; si no, que igual funcione. Lo que no
// puede es mostrar números inventados como si fueran del cliente». Sale de las mismas señales que pinta la tabla del Ads
// Manager (`getSenalesRecon`: el gasto ya en dólares, los leads que reporta Meta, los leads y las ventas del CRM).
//
// ⚠️ UN NÚMERO SÓLO SE PROPONE SI HAY CON QUÉ MEDIRLO: el costo por lead con RESULTADOS_PARA_DECIDIR leads (la misma
// vara que el Recon), y cuántos compran de cada 100 con esos leads en el CRM y al menos una venta. Con menos, `null`:
// el campo queda vacío y lo escribe la persona. Un «US$40 por lead» sacado de UN lead no es un dato, es ruido.
// El ticket NO se deduce: lo cobrado (`cash_usd`) puede ser una cuota de la venta, no la venta.

/** Lo mínimo de una señal del Recon que hace falta (`SenalRecon`, lib/queries.ts, sin importarla: esto es puro). */
export type SenalParaCalculadora = { spend_usd: number; leads: number; leads_crm: number; cierres: number };

/** Lo que se puede proponer, medido. `null` = no hay con qué medirlo. */
export type DeTusAnuncios = { costoPorLead: number | null; cierre: number | null };

export function deTusAnuncios(senales: readonly SenalParaCalculadora[] | null | undefined): DeTusAnuncios {
  let gasto = 0, leads = 0, crm = 0, ventas = 0;
  for (const s of senales ?? []) {
    gasto += Number.isFinite(s.spend_usd) ? s.spend_usd : 0;
    leads += Number.isFinite(s.leads) ? s.leads : 0;
    crm += Number.isFinite(s.leads_crm) ? s.leads_crm : 0;
    ventas += Number.isFinite(s.cierres) ? s.cierres : 0;
  }
  return {
    costoPorLead: leads >= RESULTADOS_PARA_DECIDIR && gasto > 0 ? Math.round((gasto / leads) * 100) / 100 : null,
    cierre: crm >= RESULTADOS_PARA_DECIDIR && ventas >= 1 ? Math.round((ventas / crm) * 1000) / 10 : null,
  };
}

/** «del 1/10 al 23/10»: de dónde salen los números propuestos. Fechas `YYYY-MM-DD`. */
export function rangoCorto(desde: string, hasta: string): string {
  const dm = (f: string) => { const [, m, d] = f.split('-'); return `${Number(d)}/${Number(m)}`; };
  return `del ${dm(desde)} al ${dm(hasta)}`;
}

// ── Cómo entra lo medido a los campos de la pantalla ─────────────────────────────────────────────────────────────────
// ⚠️ LO QUE ESCRIBIÓ LA PERSONA GANA: lo medido sólo llena un campo VACÍO, y deja de ser «medido» en cuanto la persona
// lo toca. Y el costo medido es POR LEAD: con «Optimizas a: Venta» no vale, así que se saca (y vuelve si se vuelve a
// lead con el campo vacío). Lo medido NO se guarda en el navegador: la próxima vez se vuelve a medir.

export type CampoMedido = 'costo' | 'cierre';
type Medibles = { costo: string; cierre: string; evento: Evento };
export type EstadoCampos<T extends Medibles> = { campos: T; medido: CampoMedido[] };

export function completarConLoMedido<T extends Medibles>(campos: T, m: DeTusAnuncios | null | undefined): EstadoCampos<T> {
  const out = { ...campos };
  const medido: CampoMedido[] = [];
  if (out.evento === 'lead' && !out.costo.trim() && m?.costoPorLead != null) { out.costo = String(m.costoPorLead); medido.push('costo'); }
  if (!out.cierre.trim() && m?.cierre != null) { out.cierre = String(m.cierre); medido.push('cierre'); }
  return { campos: out, medido };
}

export function cambiarCampo<T extends Medibles>(e: EstadoCampos<T>, k: keyof T & string, v: string, m: DeTusAnuncios | null | undefined): EstadoCampos<T> {
  let campos = { ...e.campos, [k]: v } as T;
  let medido = e.medido.filter((x) => x !== k);
  if (k === 'evento') {
    if (v !== 'lead' && medido.includes('costo')) {
      campos = { ...campos, costo: '' };
      medido = medido.filter((x) => x !== 'costo');
    } else if (v === 'lead' && !campos.costo.trim() && m?.costoPorLead != null) {
      campos = { ...campos, costo: String(m.costoPorLead) };
      medido = [...medido, 'costo'];
    }
  }
  return { campos, medido };
}

/** Lo que se guarda en el navegador: lo que escribió la persona, sin lo medido. */
export function paraGuardar<T extends Medibles>(e: EstadoCampos<T>): T {
  const out = { ...e.campos };
  for (const k of e.medido) out[k] = '' as T[typeof k];
  return out;
}
