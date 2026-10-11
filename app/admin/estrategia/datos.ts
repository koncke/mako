// =============================================================================
// /admin/estrategia — los datos de la tab, separados de la pantalla
// =============================================================================
// Pedido de Martín (10/10/2026): «tenemos runway, tenemos una de análisis de
// costos, y mucha info desparramada» → TODO en una sola tab, sólo super admin,
// «gráfico, simple, con poco texto, como está la de estrategia».
//
// ⚠️ LOS NÚMEROS SE IMPORTAN, NO SE COPIAN. Esta tab junta tres fuentes, y cada
// una sigue siendo la dueña de sus números:
//   · el runway (plata, plazos, hitos) → app/admin/runway/datos.ts
//   · los costos y la retención        → app/admin/dev/pricing/modelo.ts
//   · la estrategia de adquisición      → ESTE archivo, porque sólo vivía en la
//     página vieja /vsl/estrategia (Estrategia.tsx, revisión del 28/07, que
//     Martín revisó línea por línea). Cada bloque dice de qué línea salió.
// Si una porción de torta o un costo se CALCULA, se calcula acá, a partir de
// esos exports, con la cuenta escrita al lado. Escribir el resultado a mano es
// la forma de que la pantalla y el modelo empiecen a decir cosas distintas.
//
// ⚠️ IMPORTS RELATIVOS a propósito: el test (tests/estrategia-tab.test.ts) lo
// importa con `node --import tsx`, y así no depende de que resuelva el alias.

import { MEDIDO, DESDE, HASTA, HITOS, CIFRAS, type Hito } from '../runway/datos';
import {
  UNIT_V2, IA_POR_PRO, ASCENSO_PROGRAMAS, ASCENSO_NETO, VALOR_HORA_DUENO, CAC_CANALES,
  FREE_A_PAGO, TOPE_PAUTA,
  type UnitPlan,
} from '../dev/pricing/modelo';

export { MEDIDO, DESDE, HASTA, HITOS };
export type { Hito };

// ── Formato ─────────────────────────────────────────────────────────────────
// US$1.500 y 78,23: punto de miles y coma decimal, como escribe Martín. NO el
// «$1,500» de la página vieja, que era formato de EE.UU.
const NUM = (dec: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const num = (n: number, dec = 0) => NUM(dec).format(n);
/** Con decimales sólo si los tiene: 47 → «US$47», 43,77 → «US$43,77». */
export const usd = (n: number) => `US$${num(n, Number.isInteger(n) ? 0 : 2)}`;

/** Redondeo al centavo: cada porción se redondea antes de sumarse. */
const r2 = (n: number) => Math.round(n * 100) / 100;

// ── El calendario (riel) ────────────────────────────────────────────────────
// Las mismas cuentas que app/admin/runway/page.tsx:46-54. Se COPIAN las cuatro
// funciones porque un page.tsx de Next no admite exports extra y no se pueden
// importar de ahí; lo que NO se copia son las fechas, que salen de HITOS.
export const dia = (f: string) => Math.round(Date.parse(f) / 86400000);
export const LARGO = dia(HASTA) - dia(DESDE);
export const pct = (f: string) => ((dia(f) - dia(DESDE)) / LARGO) * 100;
/** Los rótulos de los extremos se anclan a su borde: centrados, se salen del riel. */
export const anclaje = (p: number) =>
  p < 8 ? 'translateX(0)' : p > 92 ? 'translateX(-100%)' : 'translateX(-50%)';

/**
 * Hoy, en Argentina, como «AAAA-MM-DD».
 *
 * ⚠️ SE LLAMA ADENTRO DEL COMPONENTE, NO A NIVEL MÓDULO. El runway lo calcula al
 * tope del archivo (page.tsx:60) y con `toISOString()`: `force-dynamic` vuelve a
 * correr la función, no el módulo, así que una instancia caliente se queda con
 * la fecha de su primera carga; y la fecha UTC ya es «mañana» después de las
 * 21 h de Buenos Aires.
 */
export function hoyAR(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora);
}
export const faltan = (f: string, hoy: string) => dia(f) - dia(hoy);

/** Un hito por su nota. Si el runway la cambia, el test lo marca antes que la pantalla. */
function hito(nota: string): Hito {
  const h = HITOS.find((x) => x.nota === nota);
  if (!h) throw new Error(`runway/datos.ts: no hay un hito «${nota}»`);
  return h;
}
export const HITO_ANUNCIOS = hito('arrancan los anuncios');
// «el capital», no «la plata»: el copy va en español neutro (regla de Martín, «no digas plata»).
export const HITO_PLATA = hito('se acaba el capital');
export const HITO_FIN = hito('dejan de comprar');

function cifra(clave: string): string {
  const c = CIFRAS.find((x) => x.clave === clave);
  if (!c?.valor) throw new Error(`runway/datos.ts: no hay una cifra «${clave}» con valor`);
  return c.valor;
}
export const CAPITAL = cifra('Capital restante');
export const VENTANA = cifra('Ventana de venta');

// ── La ventana de los anuncios (decisión de Martín, 10/10/2026) ─────────────
// «No lo mediría en mes... Lo mediría el total que son 2k repartido de inicio a fin
// en las fechas donde dijimos que íbamos a correr los ads.» Las fechas son las del
// runway (arrancan los anuncios → dejan de comprar), y TODA la proyección se cuenta
// sobre ese tramo: la pauta, los dos canales y el objetivo. Antes era «en el mes» y
// la pauta de la estrategia (1.000) no coincidía con la del runway (2.000).
/** 1/11 al 15/12, contando los dos extremos: 45 días (el «45 días» de VENTANA). */
export const DIAS_VENTANA = dia(HITO_FIN.fecha) - dia(HITO_ANUNCIOS.fecha) + 1;
/** 45 ÷ 30 = 1,5: con esto se estira lo que la estrategia vieja contaba por mes. */
export const MESES_VENTANA = DIAS_VENTANA / 30;
/** US$2.000 en total, de punta a punta de la ventana. No es un ritmo mensual. */
export const PAUTA_TOTAL = 2000;

/**
 * El objetivo de la ventana. Martín, 10/10/2026: «El objetivo no debe ser 10k...
 * Debería ser 15k, que son vender 10 tickets de 1500 o muchos de 47 o 97, o la
 * combinación de ambos.» Es el mismo US$15.000 que factura la cuenta del runway.
 * ⚠️ Es un OBJETIVO, no lo que proyecta el embudo: lo proyectado se calcula abajo
 * (FACTURADO) y la pantalla dibuja la brecha entre los dos.
 */
export const OBJETIVO_USD = 15000;

// ── La oferta (decisión de Martín, 10/10/2026) ──────────────────────────────
// Reemplaza la escalera vieja de Estrategia.tsx:24-55 (Solo 497 · Grupal ·
// 1 a 1 de 4.000). El Solo no vuelve; el 1 a 1 sí, a otro precio (PRECIO_1A1).
// Los precios de software salen de UNIT_V2; el grupal, de ASCENSO_PROGRAMAS.
function plan(id: UnitPlan['plan']): UnitPlan {
  const p = UNIT_V2.find((u) => u.plan === id);
  if (!p) throw new Error(`modelo.ts: UNIT_V2 no tiene el plan «${id}»`);
  return p;
}
const PRO = plan('pro');
const GROWTH = plan('growth');
const GRUPAL = ASCENSO_PROGRAMAS.grupal;

export const PRECIO_PRO = PRO.precioListaUsd; // 47
export const PRECIO_GROWTH = GROWTH.precioListaUsd; // 97
export const PRECIO_GRUPAL = GRUPAL.precioUsd; // 1.500
/** docs/referidos.md:37 — 3 cuotas de 500, 3 meses de entrega. */
export const CUOTAS_GRUPAL = 3;
/** Del 21/09: renovación del grupal, 500 cada 3 meses (o 97/mes sólo software). */
export const RENOVACION_GRUPAL_USD = 500;
/**
 * El 1 a 1, de vuelta y a US$10.000. Martín, 10/10/2026: «Podríamos plantear una
 * oferta 1 a 1... Pero que salga 10k y debería realmente valer mucho la pena».
 * ⚠️ QUÉ INCLUYE LO DEFINE ÉL («La defino yo»): la tab dibuja el precio y dice que el
 * contenido falta. No entra en la proyección ni en la brecha: sin contenido no hay
 * embudo que lo venda, y su objetivo de 15.000 lo nombró en grupales y planes.
 */
export const PRECIO_1A1 = 10000;

// ── A dónde va cada dólar (las tres tortas) ─────────────────────────────────
// Con la IA de HOY (IA_POR_PRO.hoyUsd = 10,90, medida), no la del ruteo barato:
// el ruteo todavía no tiene código. Por eso NO se leen UNIT_V2.pro.contribucionMes
// (36,30) ni .cacMax3a1 (105,27): esos son el escenario de IA barata.
//
//   servir      = IA + soporte + infra
//   contribución= neto − servir
//   captación   = el TECHO DE CAC que se dibuja en «Lo que cuesta conseguir un
//                 cliente», repartido en la vida del cliente (techo ÷ vida)
//   ganancia    = lo que queda
// ⚠️ La captación sale del MISMO techo que se dibuja abajo, no de «un tercio de la
// contribución»: en el 97 el techo que manda es el de PAYBACK (158,07), y un tercio
// de la contribución equivale a 272,23 de techo (la regla 3:1). Con dos reglas, la
// torta y la barra del techo decían dos cosas distintas en la misma página.
//
// ⚠️ SUMAN EXACTO AL CENTAVO: cada porción se redondea a 2 decimales y la
// PRIMERA (ganancia / lo que queda) se calcula como total − el resto.

export type ClavePorcion = 'ganancia' | 'conseguir' | 'servir' | 'reembolso' | 'cobro';
export type Porcion = { clave: ClavePorcion; label: string; usd: number; cuenta: string };
export type Torta = { clave: string; nombre: string; total: number; unidad: string; porciones: Porcion[] };

function torta(
  clave: string, nombre: string, total: number, unidad: string,
  primera: Omit<Porcion, 'usd'>, resto: Porcion[],
): Torta {
  const redondeadas = resto.map((p) => ({ ...p, usd: r2(p.usd) }));
  const suma = redondeadas.reduce((s, p) => s + p.usd, 0);
  return { clave, nombre, total, unidad, porciones: [{ ...primera, usd: r2(total - suma) }, ...redondeadas] };
}

const SERVIR_PRO = IA_POR_PRO.hoyUsd + PRO.soporteUsd + PRO.infraUsd; // 10,90 + 3 + 1 = 14,90
/** 43,77 − 14,90 = 28,87. Sólo existía como texto en UNIT_V2.pro.reglaQueGobierna. */
export const CONTRIB_PRO = r2(PRO.netoUsd - SERVIR_PRO);
// ⚠️ La IA del Growth (25,18) es el cupo entero de MaKo Tokens (EXPOSICION), un
// supuesto: no hay un Growth medido.
const SERVIR_GROWTH = GROWTH.iaUsd + GROWTH.soporteUsd + GROWTH.infraUsd; // 25,18 + 8 + 5 = 38,18
export const CONTRIB_GROWTH = r2(GROWTH.netoUsd - SERVIR_GROWTH); // 90,87 − 38,18 = 52,69

/** La comisión del grupal: US$300, el 20% de cada cuota. docs/referidos.md:37 (no existe en modelo.ts). */
export const COMISION_GRUPAL = 300;
/** 300 ÷ 1.500 = 20%: el % de cada cuota que se lleva el que refiere. */
export const COMISION_GRUPAL_PCT = (COMISION_GRUPAL / GRUPAL.precioUsd) * 100;

// ── Lo que deja un cliente y el techo de lo que se puede pagar por él ────────
// (Va ANTES de las tortas: la porción de captación sale de estos techos.)
/** LTV del 47 con la IA de hoy: 28,87 × 8,7 = 251,17. */
export const LTV_PRO = r2(CONTRIB_PRO * PRO.vidaMeses);
/** LTV del 97: 52,69 × 15,5 = 816,70 (= UNIT_V2.growth.ltvSuscripcion). */
export const LTV_GROWTH = r2(CONTRIB_GROWTH * GROWTH.vidaMeses);
/**
 * Techo de CAC del 47: (LTV + ASCENSO_NETO) / 3 = (251,17 − 6,57) / 3 = 81,53.
 * ⚠️ Es la cuenta que da el «81,50» de UNIT_V2.pro.reglaQueGobierna y de
 * docs/referidos.md (redondeado). Con la convención de UNIT_V2 (sin ascenso,
 * porque el Pro mensual no recibe la llamada) daría 83,72; se usa la más
 * estricta, que es la que Martín dio por buena el 10/10.
 */
export const TECHO_PRO = r2((LTV_PRO + ASCENSO_NETO.netoUsd) / 3);
/** Techo del 97: manda el PAYBACK (3 × 52,69 = 158,07), no el 3:1. */
export const TECHO_GROWTH = GROWTH.cacMaxPayback;
export const VIDA_PRO = PRO.vidaMeses;
export const VIDA_GROWTH = GROWTH.vidaMeses;

export const TORTAS: Torta[] = [
  // 3,23 + 14,90 + 9,37 (81,53 ÷ 8,7) + 19,50 = 47,00
  torta('pro', `Plan de ${num(PRO.precioListaUsd)}`, PRO.precioListaUsd, 'por mes',
    { clave: 'ganancia', label: 'Ganancia', cuenta: 'Lo que queda' }, [
      { clave: 'conseguir', label: 'Captación', usd: TECHO_PRO / VIDA_PRO, cuenta: `Techo de CAC ${num(TECHO_PRO, 2)} ÷ ${num(VIDA_PRO, 1)} meses de vida` },
      { clave: 'servir', label: 'Servir la cuenta', usd: SERVIR_PRO, cuenta: `IA ${num(IA_POR_PRO.hoyUsd, 2)} + soporte ${num(PRO.soporteUsd)} + infra ${num(PRO.infraUsd)}` },
      { clave: 'cobro', label: 'Cobro', usd: PRO.precioListaUsd - PRO.netoUsd, cuenta: 'Paddle 5% + 0,50, sobre el precio con IVA' },
    ]),
  // 6,13 + 38,18 + 10,20 (158,07 ÷ 15,5) + 42,49 = 97,00
  torta('growth', `Plan de ${num(GROWTH.precioListaUsd)}`, GROWTH.precioListaUsd, 'por mes',
    { clave: 'ganancia', label: 'Ganancia', cuenta: 'Lo que queda' }, [
      { clave: 'conseguir', label: 'Captación', usd: TECHO_GROWTH / VIDA_GROWTH, cuenta: `Techo de CAC ${num(TECHO_GROWTH, 2)} (payback) ÷ ${num(VIDA_GROWTH, 1)} meses de vida` },
      { clave: 'servir', label: 'Servir la cuenta', usd: SERVIR_GROWTH, cuenta: `IA ${num(GROWTH.iaUsd, 2)} + soporte ${num(GROWTH.soporteUsd)} + infra ${num(GROWTH.infraUsd)}` },
      { clave: 'cobro', label: 'Cobro', usd: GROWTH.precioListaUsd - GROWTH.netoUsd, cuenta: 'Paddle 5% + 0,50, sobre el precio con IVA' },
    ]),
  // 66,30 + 143,37 + 300 + 100 + 890,33 = 1.500,00
  // ⚠️ La comisión va entera (300) y el cobro es el de UN pago (66,30): «sin
  // comisión si hay reembolso» (valor esperado 270) y el cobro en 3 cuotas (66,90)
  // los decide Martín. Con los dos, «Ganancia» sube unos 29.
  torta('grupal', 'Grupal', GRUPAL.precioUsd, 'por alumno',
    { clave: 'ganancia', label: 'Ganancia', cuenta: 'Lo que queda' }, [
      { clave: 'conseguir', label: 'Captación', usd: COMISION_GRUPAL, cuenta: `Comisión del referido: ${num(COMISION_GRUPAL_PCT)}% de cada cuota` },
      { clave: 'servir', label: 'Hora de entrega', usd: GRUPAL.horasEntrega * VALOR_HORA_DUENO.usd, cuenta: `${num(GRUPAL.horasEntrega)} h × US$${num(VALOR_HORA_DUENO.usd)}` },
      // 10% de (1.500 − 66,30): la reserva se calcula sobre lo neto del cobro, no sobre los 1.500.
      { clave: 'reembolso', label: 'Reserva de reembolso', usd: GRUPAL.precioUsd - GRUPAL.feeUsd - GRUPAL.cajaUsd, cuenta: `${num(GRUPAL.reembolso * 100)}% de lo neto del cobro` },
      { clave: 'cobro', label: 'Cobro', usd: GRUPAL.feeUsd, cuenta: '4,4% + 0,30 (cobro propio)' },
    ]),
];

/**
 * Los % de una torta, a un decimal, que suman 100,0 exacto (mayor resto).
 * Redondear cada uno por su lado puede dar 99,9 o 100,1.
 */
export function porcentajes(valores: number[], total: number): number[] {
  const crudos = valores.map((v) => (v / total) * 1000);
  const base = crudos.map(Math.floor);
  let falta = 1000 - base.reduce((s, n) => s + n, 0);
  const orden = crudos.map((c, i) => ({ i, resto: c - Math.floor(c) })).sort((a, b) => b.resto - a.resto);
  for (const o of orden) {
    if (falta <= 0) break;
    base[o.i] += 1;
    falta -= 1;
  }
  return base.map((n) => n / 10);
}

// ── Referidos (decisión del 10/10, con los dos cambios del mismo día) ──────
// docs/referidos.md «EL PROGRAMA DECIDIDO» + «Dos cambios de Martín».
// Retención mensual = GRR anual^(1/12). El crédito del que refiere cuenta cuando
// el cliente ya pagó 2 meses: con el 1er mes gratis es el mes 3 → r².
const rMensual = (p: UnitPlan) => {
  if (p.grrAnual == null) throw new Error(`modelo.ts: ${p.plan} sin grrAnual`);
  return (p.grrAnual / 100) ** (1 / 12);
};
const LLEGA_47 = rMensual(PRO) ** 2; // 0,8847² = 0,7827
const LLEGA_97 = rMensual(GROWTH) ** 2; // 0,9356² = 0,8754
/** Un 47 descontado de un plan de 97 le saca a MaKo 47 × 90,87/97 = 44,03 netos. */
const CREDITO_POR_UN_47 = PRO.precioListaUsd * (GROWTH.netoUsd / GROWTH.precioListaUsd);
/** El que llega por el 97: como mucho 50% del 1er mes («si no, no es rentable»). */
export const DESCUENTO_MAX_97 = 0.5;

export type CostoReferido = { clave: string; label: string; usd: number; techo: number; cuenta: string };
export const COSTO_REFERIDO: CostoReferido[] = [
  // 43,77 (el mes gratis) + 44,03 × 0,7827 = 78,23
  { clave: 'pro', label: `Cliente de ${num(PRO.precioListaUsd)}`, usd: r2(PRO.netoUsd + CREDITO_POR_UN_47 * LLEGA_47), techo: TECHO_PRO,
    cuenta: `${num(PRO.netoUsd, 2)} del mes gratis + ${num(CREDITO_POR_UN_47, 2)} × ${num(LLEGA_47, 4)}` },
  // 43,77 + 47 × 0,7827 = 80,56
  { clave: 'revendedor', label: `${num(PRO.precioListaUsd)} de un revendedor`, usd: r2(PRO.netoUsd + PRO.precioListaUsd * LLEGA_47), techo: TECHO_PRO,
    cuenta: `${num(PRO.netoUsd, 2)} + ${num(PRO.precioListaUsd)} en efectivo × ${num(LLEGA_47, 4)}` },
  // 45,44 + 90,87 × 0,8754 = 124,98 (Martín escribió 124,99 redondeando 45,435 antes de sumar)
  { clave: 'growth', label: `Cliente de ${num(GROWTH.precioListaUsd)}`, usd: r2(GROWTH.netoUsd * DESCUENTO_MAX_97 + GROWTH.netoUsd * LLEGA_97), techo: TECHO_GROWTH,
    cuenta: `${num(GROWTH.netoUsd * DESCUENTO_MAX_97, 2)} del ${num(DESCUENTO_MAX_97 * 100)}% + ${num(GROWTH.netoUsd, 2)} × ${num(LLEGA_97, 4)}` },
];

/** Una fila de un gráfico de costo contra techo. `nota` reemplaza al «✓ entra / ✕ no entra». */
export type FilaCac = { label: string; usd: number; nota?: string; detalle: string };

// ── Estrategia de adquisición (Estrategia.tsx, revisión del 28/07) ─────────
// Contenido aprobado por Martín. Lo único que cambió: «en agosto» → «en el mes».

/** Estrategia.tsx:300-318. */
export const PASOS = [
  { n: '01', t: 'Prospección + campaña de mensajes', icono: 'megafono' },
  { n: '02', t: 'Conversación por WhatsApp', icono: 'chat' },
  { n: '03', t: 'Llamada 1 a 1', icono: 'video' },
] as const;

export type Escalon = { l: string; n: number; tasa?: string };
export type Canal = {
  id: 'A' | 'B'; nombre: string; sub: string; inversion: number;
  hechos: string[]; fases?: { t: string; usd: number }[]; embudo: Escalon[];
};

// Las TASAS son las de la página vieja (Estrategia.tsx:60-72), que Martín aprobó; los
// VOLÚMENES se calculan con ellas sobre la ventana. Antes eran 1.000 conversaciones
// «en el mes» y US$1.000 de pauta (400 conversaciones → 8 agendas).
/** Prospección: 1.000 conversaciones por mes, estiradas a la ventana («Proporcional», 10/10). */
const PROSPECCION_POR_MES = 1000;
const RESPONDE_A = 0.2;
const AGENDA_A = 0.035;
/** Campaña: lo que cuesta cada conversación iniciada, y las dos tasas de después. */
const COSTO_CONVERSACION = 2.5;
const RESPONDE_B = 0.7;
const AGENDA_B = 0.03;
/** La fase 1 (encontrar el ad ganador) sigue en 300; el resto de la pauta es escalar. */
const AD_GANADOR = 300;

const CONVERSACIONES_A = Math.round(PROSPECCION_POR_MES * MESES_VENTANA); // 1.500
const RESPONDEN_A = Math.round(CONVERSACIONES_A * RESPONDE_A); // 300
const CONVERSACIONES_B = Math.round(PAUTA_TOTAL / COSTO_CONVERSACION); // 800
const RESPONDEN_B = Math.round(CONVERSACIONES_B * RESPONDE_B); // 560
// ⚠️ Las agendas van con floor: media agenda no se cuenta (10,5 → 10 y 16,8 → 16).
// Con la pauta vieja daban exacto (7 y 8,4 → 8), así que el criterio no cambió nada de antes.

/** Estrategia.tsx:60-72 (embudos) y :321-357 (las tarjetas). */
export const CANALES: Canal[] = [
  {
    id: 'A', nombre: 'Prospección', sub: 'Círculo rojo + leads 100% fríos', inversion: 0,
    hechos: ['Un Loom VSL por cada lead'],
    embudo: [
      { l: 'Conversaciones abiertas', n: CONVERSACIONES_A, tasa: `${num(PROSPECCION_POR_MES)} por mes` },
      { l: 'Responden', n: RESPONDEN_A, tasa: `${num(RESPONDE_A * 100)}% · la abro yo` },
      { l: 'Agendadas', n: Math.floor(RESPONDEN_A * AGENDA_A), tasa: `${num(AGENDA_A * 100, 1)}%` },
    ],
  },
  {
    id: 'B', nombre: 'Campaña de mensajes', sub: 'Meta optimizando a WhatsApp', inversion: PAUTA_TOTAL,
    hechos: [],
    fases: [{ t: 'Ad ganador', usd: AD_GANADOR }, { t: 'Escalar', usd: PAUTA_TOTAL - AD_GANADOR }],
    embudo: [
      { l: 'Conversaciones iniciadas', n: CONVERSACIONES_B, tasa: `${usd(COSTO_CONVERSACION)} c/u` },
      { l: 'Responden', n: RESPONDEN_B, tasa: `${num(RESPONDE_B * 100)}% · escribieron ellos` },
      { l: 'Agendadas', n: Math.floor(RESPONDEN_B * AGENDA_B), tasa: `${num(AGENDA_B * 100)}%` },
    ],
  },
];

/** Estrategia.tsx:75-81 — lo que el setter de IA le dice sobre su anuncio. */
export const DIAG = [
  'Si el gancho frena el scroll o pasa desapercibido',
  'A qué tipo de cliente le está hablando — y a cuál no',
  'Qué razón de compra está usando',
  'Por qué ese anuncio no le trae agendas',
  'Qué cambiar para la próxima versión',
];
export const DIAG_PASOS = ['Escribe por el anuncio', 'El setter de IA le pregunta', 'Diagnóstico + invitación a la llamada'];

/** Estrategia.tsx:396-412 — el Loom de la prospección. */
export const LOOM_PASOS = ['Miro su negocio', 'Grabo un Loom para él', 'Cierro con el link'];
export const LOOM_MIRA = [
  'Su Instagram y su marca personal',
  'Su biblioteca de anuncios: qué corre y hace cuánto',
  'Su landing, su oferta y a quién le habla hoy',
];
export const LOOM_DICE = [
  'A quién le está vendiendo, visto desde afuera',
  'A qué otros clientes les podría vender y no lo hace',
  'Qué haría yo en su lugar, concreto',
];

/**
 * Estrategia.tsx:99-106 — los seis ejes de la llamada, con su frase `w` A LA VISTA.
 * La primera versión de la tab la dejó en el `title` (poco texto) y Martín la
 * reclamó el mismo 10/10: «eliminaste cosas de la antigua tab que estaban buenas».
 * Un `title` no se ve en el celular ni sin pasar el mouse: es esconder, no acortar.
 */
export const ANALISIS = [
  { t: 'Anuncios y creativos', icono: 'megafono', w: 'Qué corre hoy y por qué no le trae agendas.' },
  { t: 'Landing', icono: 'pagina', w: 'Si promete lo mismo que el anuncio y dónde se cae la gente.' },
  { t: 'VSL', icono: 'video', w: 'Si retiene, en qué minuto se caen y qué le falta al guion.' },
  { t: 'Mensajes de venta', icono: 'chat', w: 'Qué se le dice entre el dato y la llamada.' },
  { t: 'Oferta y precios', icono: 'etiqueta', w: 'Qué vende, a cuánto, y por qué el precio no es el problema.' },
  { t: 'Números del funnel', icono: 'barras', w: 'Cuánto cuesta un lead, una agenda y un cliente.' },
] as const;

/**
 * Estrategia.tsx:84-96 — la duda abierta, como MATRIZ de criterios × con/sin.
 * Las ocho viñetas de la página vieja, una por celda (la frase entera va en el
 * `title`). `gana`: qué lado sale mejor en ese criterio; 'empate' cuando cada uno
 * gana algo (más conversaciones contra más calificadas).
 */
export type FilaDuda = { criterio: string; con: string; sin: string; gana: 'con' | 'sin' | 'empate'; detalle: string };
export const DUDA: FilaDuda[] = [
  { criterio: 'Fricción', con: 'Baja', sin: 'Más alta', gana: 'con',
    detalle: 'Con personalización baja la fricción: piden un recurso, no información de un servicio' },
  { criterio: 'Conversaciones', con: 'Más', sin: 'Menos, más calificadas', gana: 'empate',
    detalle: 'Sin personalización: menos conversaciones, pero más calificadas' },
  { criterio: 'Llega a la llamada', con: 'Sabiendo qué tiene mal', sin: 'Frío', gana: 'con',
    detalle: 'Con personalización llega sabiendo qué tiene mal; sin ella, llega frío' },
  { criterio: 'Trabajo', con: '~200 Looms al mes, de cero', sin: 'Un mensaje para todos', gana: 'sin',
    detalle: 'Un Loom por cada lead que responde (~200 videos en el mes) y nada se reutiliza; sin personalización, el mismo mensaje para todos' },
  { criterio: 'Arranque', con: 'Hay que armarlo', sin: 'Mañana', gana: 'sin',
    detalle: 'Sin personalización se arranca mañana' },
  { criterio: 'Presupuesto', con: 'Parte a operativa', sin: 'Todo a pauta', gana: 'sin',
    detalle: 'Sin personalización todo el presupuesto va a pauta, no a operativa' },
];

// ── Proyección (Estrategia.tsx:109-113 y :488-533) ──────────────────────────
// Sobre la VENTANA entera (1/11 al 15/12), no por mes: decisión del 10/10.
// ⚠️ Las tasas son las de la página de estrategia (80% asiste, 40% cierra, US$125
// por agenda), NO las del runway (50% de show up, cierre implícito de 100%, US$100
// por agenda): Martín aprobó éstas. La pauta (2.000) y el objetivo (15.000) ya
// coinciden con los del runway; las tasas siguen distintas y eso NO se dibuja.
// ⚠️ Lo FACTURADO se calcula con el precio del grupal (lo que venden los dos canales),
// y el objetivo se dibuja aparte, con su brecha.
export const ASISTE = 0.8;
export const CIERRA = 0.4;
export const AGENDADAS = CANALES.reduce((s, c) => s + (c.embudo.at(-1)?.n ?? 0), 0); // 10 + 16 = 26
export const EFECTIVAS = Math.round(AGENDADAS * ASISTE); // 20,8 → 21
/** 21 × 40% = 8,4 → 8. Se redondea porque se dibuja como un número de ventas. */
export const VENTAS = Math.round(EFECTIVAS * CIERRA);
export const PAUTA = CANALES.reduce((s, c) => s + c.inversion, 0); // 2.000 (= PAUTA_TOTAL)
/** 8 grupales × US$1.500 = US$12.000. Lo que el embudo proyecta, no el objetivo. */
export const FACTURADO = VENTAS * PRECIO_GRUPAL;
/** 12.000 − 2.000 = 10.000. */
export const NETO = FACTURADO - PAUTA;
/**
 * Con 3 cuotas mensuales, dentro de la ventana entra COMO MÍNIMO la primera de cada
 * venta: 8 × 500 = 4.000. Una venta del 1/11 ya paga la segunda el 1/12; cuántas lo
 * hacen depende de en qué día cae cada una, y eso la proyección no lo sabe.
 */
export const PRIMERAS_CUOTAS = VENTAS * (PRECIO_GRUPAL / CUOTAS_GRUPAL);
/** Para llegar al objetivo con sólo grupales: ⌈15.000 ÷ 1.500⌉ = 10 ventas. */
export const VENTAS_OBJETIVO = Math.ceil(OBJETIVO_USD / PRECIO_GRUPAL);
/** Y las agendas que hacen falta con la misma asistencia y cierre: ⌈10 ÷ (0,8 × 0,4)⌉ = 32. */
export const AGENDAS_OBJETIVO = Math.ceil(VENTAS_OBJETIVO / (ASISTE * CIERRA) - 1e-9);
/** US$2.000 ÷ 16 agendas de la campaña = US$125. */
export const COSTO_POR_AGENDA = (() => {
  const b = CANALES.find((c) => c.id === 'B');
  return b ? b.inversion / (b.embudo.at(-1)?.n ?? 1) : 0;
})();

// ── Lo que cuesta conseguir un cliente ──────────────────────────────────────
// ⚠️ DOS GRÁFICOS, uno por lo que se vende, y cada uno contra SU techo:
//   · el GRUPAL, que es lo que venden los canales A y B de esta página;
//   · el PLAN DE 47 vendido solo (autoservicio), que es lo que modela CAC_CANALES.
// Antes era uno solo con los nombres de los canales A y B y los números del 47:
// la pantalla decía que «Campaña a WhatsApp» no entraba (US$176) cuando la campaña
// de esta página vende el grupal y cuesta unos US$391 por venta contra US$1.190.

function canal(id: string) {
  const c = CAC_CANALES.find((x) => x.id === id);
  if (!c) throw new Error(`modelo.ts: CAC_CANALES no tiene «${id}»`);
  return c;
}
/** Ventas que trae un canal: sus agendadas × asiste × cierra (sin redondear: es un costo). */
const ventasDe = (id: Canal['id']) => (CANALES.find((c) => c.id === id)?.embudo.at(-1)?.n ?? 0) * ASISTE * CIERRA;

/** Lo que deja un grupal ANTES de pagar por conseguirlo: 1.500 − cobro − reserva − 1 h = 1.190,33. */
export const DEJA_GRUPAL = GRUPAL.capacidadUsd;
/** US$2.000 ÷ (16 × 0,8 × 0,4 = 5,12 ventas) = 390,62 (390,625 en coma flotante). */
export const CAC_CAMPANA_GRUPAL = r2((CANALES.find((c) => c.id === 'B')?.inversion ?? 0) / ventasDe('B'));
/**
 * Un Loom por cada lead que responde, por venta: 1 ÷ (3,5% × 0,8 × 0,4) ≈ 89.
 * ⚠️ Sale de las TASAS, no de dividir los volúmenes: con la agenda redondeada para
 * abajo (300 → 10, no 10,5), 300 ÷ 3,2 daba 94 y el costo de un canal cambiaba sólo
 * por alargar la ventana.
 */
export const LOOMS_POR_VENTA = Math.round(1 / (AGENDA_A * ASISTE * CIERRA));

export const CAC_GRUPAL: FilaCac[] = [
  { label: 'Campaña de mensajes', usd: CAC_CAMPANA_GRUPAL,
    detalle: `Pauta ${usd(PAUTA)} ÷ ${num(ventasDe('B'), 2)} ventas de la campaña` },
  { label: 'Referido', usd: COMISION_GRUPAL,
    detalle: `Comisión: ${num(COMISION_GRUPAL_PCT)}% de cada cuota` },
  { label: 'Prospección', usd: 0, nota: `+ ~${LOOMS_POR_VENTA} Looms`,
    detalle: `Sin pauta. Cuesta horas: un Loom por cada lead que responde, ~${LOOMS_POR_VENTA} por venta` },
];

/**
 * El 47 vendido solo. Los canales pagos van SÓLO con su costo de MEDIOS: lo que
 * CAC_CANALES les suma por los usuarios Free que no pagan no existe en la oferta
 * de hoy (UNIT_V2.free: «el Free NO EXISTE hasta el mes 10»).
 *   · mensajes a WhatsApp: 176 − 19 Free × 4,00 = 100 (19 = 1 ÷ 5% − 1, el
 *     FREE_A_PAGO base; 4,00 = lo que cuesta un Free en su vida, −UNIT_V2.free.ltvTotal);
 *   · anuncio a la landing: 124,22 (TOPE_PAUTA.cacBaseCarrito, el CAC de medios).
 * Con o sin el Free, los dos quedan arriba del techo: el veredicto no cambia.
 */
const FREE = UNIT_V2.find((u) => u.plan === 'free');
const COSTO_UN_FREE = -(FREE?.ltvTotal ?? 0);
const FREE_POR_PAGO_CTWA = Math.round(1 / FREE_A_PAGO.base - 1);
export const CAC_PRO: FilaCac[] = [
  { label: 'Referido', usd: COSTO_REFERIDO[0].usd, detalle: COSTO_REFERIDO[0].cuenta },
  { label: 'Mensajes a WhatsApp → registro', usd: r2(canal('ctwa').plataPorCliente - FREE_POR_PAGO_CTWA * COSTO_UN_FREE),
    detalle: 'Sólo medios: sin los usuarios Free, que hoy no existen' },
  { label: 'Anuncio a la landing', usd: TOPE_PAUTA.cacBaseCarrito,
    detalle: 'Sólo medios: sin los usuarios Free, que hoy no existen' },
  { label: 'Prospección con el chatbot', usd: canal('prospeccion').plataPorCliente, nota: 'sin horas',
    detalle: 'Centavos de IA por contacto; lo que la limita es la lista con permiso' },
];

// ── Canales a futuro (Estrategia.tsx:128-164) ───────────────────────────────
// C (Referidos) ya no va acá: tiene programa decidido y su propia sección arriba.
// `que` se dibuja (como `w` en ANALISIS: el `title` lo escondía, y Martín lo reclamó).
export const FUTURO = [
  { id: 'D', nombre: 'Orgánico + Lead Magnet', costo: 'Casi cero', tono: 'ok',
    que: 'Los creativos de la campaña, en orgánico. «Comenta [palabra]» → ManyChat → diagnóstico → Calendly → CRM.' },
  { id: 'E', nombre: 'VSL Funnel propio + Ads', costo: 'Requiere capital', tono: 'caja',
    que: 'Ya está construido: landing, VSL, Calendly y testimonios. Entra cuando la campaña dé señal.' },
  { id: 'F', nombre: 'Webinar', costo: 'Requiere capital', tono: 'caja',
    que: 'Tres días sobre VSL Funnel, con CTA a la llamada. Cuando haya ads: se repite todos los meses.' },
  { id: 'G', nombre: 'Asociarse con infoproductores', costo: 'Mayor palanca', tono: 'palanca',
    que: 'Un solo sí abre acceso a cientos de dueños que ya corren ads. Caso concreto: Jan.' },
] as const;

/**
 * La propuesta a Jan, el caso concreto del canal G, REESCRITA con el programa de
 * referidos (decisión de Martín, 10/10/2026: «Reescribirla»).
 *
 * La de julio (Estrategia.tsx:563-585 de la página vieja, 28/07/2026) chocaba con
 * docs/referidos.md («EL PROGRAMA DECIDIDO») en cinco filas, y la tab sólo marcaba tres:
 *   · «Licencia de reventa para todos sus clientes» → cada cliente paga su plan.
 *   · «Prueba gratuita extendida» → el 1er mes gratis en el 47 y hasta 50% en el 97.
 *   · «Un % de las ganancias a futuro con sus clientes» → MaKo cobra el plan y el que
 *     refiere recibe el premio, no al revés.
 *   · «Acceso personal de por vida a MaKo» (sin marcar) → «todo se cobra, también a
 *     los amigos» (reglas comunes): su cuenta se paga con lo que trae.
 *   · «Cobra una recurrencia sin mover un dedo» (sin marcar) → el premio es UNA vez por
 *     cliente nuevo (su primer mes), no un ingreso todos los meses.
 * Lo que queda es lo mismo que recibe cualquier revendedor, más lo que no tiene precio
 * (su metodología en el software, el trabajo para que MaKo se use al 100%). Los montos
 * salen de las constantes del programa, no se escriben.
 */
export type FilaJan = { t: string };
export const JAN_GANA: FilaJan[] = [
  { t: `Su cuenta de ${num(PRECIO_GROWTH)} da de alta un workspace por cada cliente suyo, y cada uno paga su plan` },
  { t: 'Cada cliente nuevo le descuenta su primer mes; cubierta su suscripción, lo que sobra se le paga en efectivo' },
  { t: `Sus clientes entran con el 1er mes gratis en el ${num(PRECIO_PRO)}, o hasta ${num(DESCUENTO_MAX_97 * 100)}% del 1er mes en el ${num(PRECIO_GROWTH)}` },
  { t: `${usd(COMISION_GRUPAL)} en efectivo por cada alumno que traiga al grupal` },
  { t: 'Su metodología implementada en el software, para vender lo que él ofrece' },
  { t: 'Trabajo para que MaKo se use al 100% en sus productos' },
];
export const JAN_GANO: FilaJan[] = [
  { t: 'Jan me ayuda 1 a 1 con mis ads (RECON)' },
  { t: 'Me recomienda ya con 3 o más de sus clientes; lo cobrado va 100% a los ads que él recomiende' },
  { t: 'Cada cliente suyo paga su plan de lista: MaKo cobra, y él recibe el premio' },
];
