// =============================================================================
// agencia-mes-consulta-reglas — «¿cuánto hay que pagar para activar la cuenta de X?», contestado por el CÓDIGO (20/11/2026)
// =============================================================================
// Código Inmobiliario (ws 13), 20/11/2026, en su grupo de MaKo: «Mako pasame cuanto hay que pagar de Pablo Chavez para activar su cuenta»,
// dos veces. MaKo buscó a Pablo Chavez como LEAD del CRM (#2665) y contestó que no tenía monto. La pregunta era por la CUENTA de MaKo de
// su cliente (ws 18, «Paga para entrar · US$ 23,50 hoy» en la app): la entrada de la regla del 5/11. Martín: lo que se paga a MaKo lo
// contesta la mensualidad de la agencia (lib/agencia-mes.ts), no el CRM. Y si el nombre es a la vez un lead y una cuenta-cliente, gana la
// cuenta cuando la frase habla de pagar o activar.
//
// ⚠️ LO ARMA EL CÓDIGO, NUNCA UN MODELO, como lo que contesta un comprobante (`textoDeComprobante`): el monto sale de `situacion` y de lo que
// se debe (`Pendiente`), y a dónde se paga, del ajuste de cobro de la plataforma (`planes.pago_directo`, lib/pago-directo.ts). Sin Pay ID
// cargado no se inventa uno: se dice el medio, sin número.
//
// Y LA OTRA MITAD (`esPreguntaYNoPago`): la captura de la app con «confírmame si está bien» se trató como comprobante (grupo_mensajes 1047):
// «Recibí tu comprobante. Lo revisa el equipo» y el aviso a Martín por algo que no era un pago. Una foto con una PREGUNTA y sin N.º de
// operación es una pregunta: va al turno, que la contesta con esto.
//
// Puro: sin base ni red. Lo prueba tests/agencia-pago-consulta.test.ts.
// =============================================================================

import { operacionNormal, type LecturaComprobante } from './comprobante-reglas';
import { clientesNombrados, diaCorto, diaLargo, nombreDelMes, sumarDias, usd, usdDia, type Dia, type Pendiente, type Situacion } from './agencia-mes-reglas';

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();

/** Pregunta un monto, o pide que se lo confirmen. */
const PREGUNTA = /\b(cuanto|cuanta|cuantos|monto|importe|confirm\w*|esta bien|es correcto|es asi)\b|\?/;
/** Habla de pagar, en presente o infinitivo («pagó» sin tilde cae acá también: por eso hace falta además la cuenta o el mes). */
const PAGA = /\b(pagar|pagarla|pagarlo|paga|pago|pagamos|pagan|debo|debemos|adeudo|adeudamos)\b/;
/** La cuenta de MaKo de alguien: activarla, sacarla de la pausa, que entre. «activo» va porque «para ponerlo como activo» (el 1047). */
const CUENTA = /\b(activar\w*|activa|activo|activas|activamos|reactivar\w*|despausar\w*|pausa|pausad[ao]|habilitar\w*|para que entre|para entrar|su cuenta|la cuenta|cuenta de)\b/;
/** Activar sin hablar de plata: «¿cómo activo la cuenta de Pablo?». */
const ACTIVAR_LA_CUENTA = /\b(activ|reactiv|despaus|habilit)\w*\b.*\bcuenta\b|\bcuenta\b.*\b(activ|reactiv|despaus|habilit)\w*/;
/** Lo que la agencia le debe a MaKo: en primera persona, o la mensualidad por su nombre. */
const LO_SUYO = /\b(debo|debemos|adeudo|adeudamos|mensualidad|a mako|de mako)\b|\b(hay|tengo|tenemos) que pagar\b.*\b(este|el) (mes|ciclo)\b/;

export type PedidoDePago = { tipo: 'cuenta' } | { tipo: 'debe' };

/**
 * ¿PREGUNTA POR LO QUE SE LE PAGA A MaKo? `cuenta`: lo que cuesta activar (o lo que debe) la cuenta de un cliente de la agencia; sólo se
 * contesta si el texto nombra a uno (`respuestaDePago`). `debe`: lo que la agencia debe hoy. null: otra cosa (lo de un lead es del CRM:
 * «cuánto pagó Pablo», «cuánto le falta pagar a Pablo»).
 */
export function pidePagoDeLaMensualidad(texto: string): PedidoDePago | null {
  const n = norm(texto);
  if (!n || !PREGUNTA.test(n)) return null;
  if ((PAGA.test(n) && CUENTA.test(n)) || ACTIVAR_LA_CUENTA.test(n)) return { tipo: 'cuenta' };
  if (LO_SUYO.test(n)) return { tipo: 'debe' };
  return null;
}

/** El monto que dice el texto, en dólares («USD 23,50», «US$ 23.50», «23,5 dólares»). null si no dice uno. */
export function montoDicho(texto: string): number | null {
  const n = norm(texto);
  const m = n.match(/(?:usd|usdt|us\$|u\$s|\$)\s*(\d{1,6}(?:[.,]\d{1,2})?)\b/) ?? n.match(/\b(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:usd|usdt|dolares|dolar)\b/);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** A dónde se paga: el medio de la mensualidad y, si es Binance, el Pay ID o el link cargados en el ajuste de cobro. */
export type DondePagar = { medio: string; binancePayId: string | null; linkBinance: string | null };

/**
 * La línea de a dónde pagar. Sin Pay ID ni link cargados: el medio solo (nunca un número escrito a mano). `una`: una sola cosa (la entrada,
 * la mensualidad) o varias («Págalo»). `activa`: hay una cuenta que vuelve a entrar con el pago; si no, sólo queda registrado.
 */
export function lineaDePago(d: DondePagar, o: { una?: boolean; activa?: boolean } = {}): string {
  const binance = /binance/i.test(d.medio);
  const donde = binance && d.binancePayId ? `por Binance Pay al Pay ID ${d.binancePayId}` : binance && d.linkBinance ? `por Binance con este link: ${d.linkBinance}` : `por ${d.medio}`;
  const despues = o.activa === false ? 'queda registrado solo cuando el pago aparece' : 'la cuenta se activa sola cuando el pago aparece';
  return `Págal${o.una === false ? 'o' : 'a'} ${donde} y manda aquí la captura del pago: ${despues}.`;
}

/** Lo que la regla necesita de la mensualidad (lo trae `MensualidadOk`, lib/agencia-mes.ts). */
export type ParaLaConsulta = {
  hoy: Dia;
  agenciaEnPausa: boolean;
  clientes: ReadonlyArray<{ ws: number; nombre: string; situacion: Situacion }>;
  pendientes: readonly Pendiente[];
};

/** Lo de UN cliente: cuánto, el porqué en una línea, y si hay que pagar algo. */
function loDeUnCliente(c: ParaLaConsulta['clientes'][number], m: ParaLaConsulta): { texto: string; montoUsd: number | null } {
  const s = c.situacion;
  const debe = m.pendientes.find((p) => p.tipo === 'entrada' && p.ws === c.ws);
  if (s.tipo === 'paga-para-entrar' || s.tipo === 'debe-entrada') {
    const e = s.entrada;
    const monto = debe?.debeUsd ?? e.montoUsd;
    const yaPagado = debe && debe.pagadoUsd > 0.009 ? ` Ya entraron ${usd(debe.pagadoUsd)} a cuenta.` : '';
    const cabeza = s.tipo === 'paga-para-entrar'
      ? `Para activar la cuenta de ${c.nombre} son ${usd(monto)} si pagas hoy.`
      : `La entrada de ${c.nombre} son ${usd(monto)}${s.vencida ? `: venció el ${diaCorto(s.limite)} y su cuenta se pausa` : ` y se paga hasta el ${diaLargo(s.limite)}; si no entra, su cuenta se pausa`}.`;
    const porque = `Es su entrada: ${e.dias} días, del ${diaCorto(e.desde)} al ${diaCorto(e.hasta)}, a ${usdDia(e.tarifaUsd)} por día; desde el ${diaCorto(sumarDias(e.hasta, 1))} entra en la mensualidad.${s.tipo === 'paga-para-entrar' ? ' Si pagas otro día cambia: se cuenta desde el día que pagas.' : ''}${yaPagado}`;
    return { texto: `${cabeza}\n${porque}`, montoUsd: monto };
  }
  if (s.tipo === 'sin-costo') {
    return s.entrada
      ? { texto: `${c.nombre} está en sus días sin costo hasta el ${diaCorto(s.hasta)}: hoy no hay nada que pagar. Ese día su entrada son ${usd(s.entrada.montoUsd)} (${s.entrada.dias} días hasta el ${diaCorto(s.entrada.hasta)}).`, montoUsd: null }
      : { texto: `La entrada de ${c.nombre} ya está pagada: su cuenta cuenta desde el ${diaCorto(s.hasta)}.`, montoUsd: null };
  }
  if (s.tipo === 'cuenta') {
    const mes = m.pendientes.find((p) => p.tipo === 'mes');
    return m.agenciaEnPausa && mes
      ? { texto: `La cuenta de ${c.nombre} está en pausa porque falta la mensualidad de la agencia: son ${usd(mes.debeUsd)}. Con eso vuelven a entrar todas.`, montoUsd: mes.debeUsd }
      : { texto: `La cuenta de ${c.nombre} ya está activa: no hay nada que pagar aparte, va en la mensualidad.`, montoUsd: null };
  }
  return { texto: `La cuenta de ${c.nombre} está de baja: no se cobra nada.`, montoUsd: null };
}

/**
 * LA RESPUESTA, armada por el código. null = no hay con qué contestar acá (una pregunta por una cuenta que no nombra a ningún cliente de la
 * agencia: puede ser un lead, y sigue al turno de siempre). Con un monto en el texto («me dice US$ 23,50, ¿está bien?») lo confirma o lo corrige.
 */
export function respuestaDePago(p: { pedido: PedidoDePago; texto: string; m: ParaLaConsulta; donde: DondePagar }): string | null {
  const { m } = p;
  const nombrados = clientesNombrados([p.texto], m.clientes).map((ws) => m.clientes.find((c) => c.ws === ws)!).filter(Boolean);
  if (nombrados.length) {
    const partes = nombrados.map((c) => loDeUnCliente(c, m));
    const montos = partes.map((x) => x.montoUsd).filter((x): x is number => x != null);
    const dicho = montoDicho(p.texto);
    const total = Math.round(montos.reduce((a, x) => a + x, 0) * 100) / 100;
    const confirma = dicho == null || !montos.length ? '' : Math.abs(dicho - total) <= 0.01 ? 'Sí, está bien. ' : `Hoy son ${usd(total)}, no ${usd(dicho)}. `;
    const cuerpo = partes.map((x) => x.texto).join('\n\n');
    return [`${confirma}${cuerpo}`, ...(montos.length ? [lineaDePago(p.donde)] : [])].join('\n');
  }
  if (p.pedido.tipo === 'cuenta') return null;
  // Lo que la agencia debe hoy.
  if (!m.pendientes.length) return 'Hoy no hay nada por pagar a MaKo.';
  const total = Math.round(m.pendientes.reduce((a, x) => a + x.debeUsd, 0) * 100) / 100;
  const renglones = m.pendientes.map((x) => (x.tipo === 'mes'
    ? `· La mensualidad de ${nombreDelMes(x.mes)}: ${usd(x.debeUsd)}, hasta el ${diaLargo(x.limite)}.`
    : `· La entrada de ${x.nombre}: ${usd(x.debeUsd)}, hasta el ${diaLargo(x.limite)}.`));
  // Con el pago vuelve a entrar algo si hay una entrada (esa cuenta está o estará en pausa) o si la agencia está en pausa por el mes.
  const activa = m.agenciaEnPausa || m.pendientes.some((x) => x.tipo === 'entrada');
  return [`Hoy son ${usd(total)}:`, ...renglones, lineaDePago(p.donde, { una: m.pendientes.length === 1, activa })].join('\n');
}

/** Lo que pide el texto que acompaña una foto: confirmar, preguntar, revisar. «acá dice» y «fíjate» van por su raíz: es lo que ESCRIBE la persona, y la
 *  palabra entera dispara el guardia del voseo (tests/puente-panel-copy.test.ts). */
const PIDE_ALGO = /\?|\b(confirm\w*|esta bien|es correcto|es asi|cuanto|cuanta|por que|que es|me dice|dice que|ac[aá] dice|aqu[ií] dice|revis\w*|fij\w*|chequea\w*)\b/;

/**
 * ¿ES UNA PREGUNTA Y NO UN PAGO? Una foto con un texto que pregunta o pide confirmar algo, y en la que la lectura no encontró un N.º de
 * operación, no es un comprobante: es una captura (de la app de MaKo, de lo que vence) sobre la que preguntan. Va al turno de MaKo, que
 * la contesta. Con N.º de operación sí es un pago aunque pregunte («¿me confirmas que llegó?»): sigue como comprobante. Sin texto, sigue
 * como siempre (un comprobante dudoso le llega a Martín: nunca se pierde en silencio).
 */
export function esPreguntaYNoPago(l: Pick<LecturaComprobante, 'esComprobante' | 'operacion'>, pie: string | null | undefined): boolean {
  if (!l.esComprobante) return true;
  const n = norm(pie ?? '');
  if (!n || !PIDE_ALGO.test(n)) return false;
  return !operacionNormal(l.operacion);
}
