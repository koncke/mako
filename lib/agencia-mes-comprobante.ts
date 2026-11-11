// =============================================================================
// agencia-mes-comprobante — el comprobante de Binance que una agencia manda al GRUPO de MaKo (6/11/2026)
// =============================================================================
// Martín (5/11/2026): «MaKo pide ahí el comprobante de Binance [...] Si cubre, se marca el mes y sale el recibo. Un pago parcial
// no frena nada. Un comprobante dudoso le llega a Martín, no se decide solo.» Hasta hoy un comprobante que llegaba a un grupo no
// disparaba nada (el disparador de Automations mira los chats de leads). Lo engancha lib/mako-doer-in.ts: una foto o un PDF de
// una persona en el grupo de una agencia con la mensualidad prendida y algo por pagar viene acá ANTES del turno de MaKo; si es
// un comprobante, se atiende acá y el turno no corre (MaKo no contesta dos veces); si no lo es, sigue al turno como siempre.
//
// QUÉ SE DECIDE SOLO, Y QUÉ VA A MARTÍN:
//   · se lee con las MISMAS reglas que la tarjeta «Leer comprobante» (lib/comprobante-reglas.ts) y la IA de la PLATAFORMA;
//   · se aplica SOLO si la lectura es limpia (`leido`: monto, moneda, fecha y N.º de operación, sin dudas), en dólares (USD,
//     USDT o USDC), con una orden de Binance de verdad (18 dígitos), que no se haya usado, y que cubra exacto algo que se debe
//     (o sea menos: queda a cuenta, «un pago parcial no frena nada»);
//   · TODO lo demás —dudoso, otra moneda, otro medio, de más, nada pendiente, una falla nuestra— va a Martín por el grupo de
//     SuperAdmin, y a la agencia se le dice que lo revisa el equipo. Nunca se marca nada con dudas.
//   · una orden ya usada se dice, y no cuenta: `reciboDePago('binance', orden)` (los recibos de MaKo), la tabla de lecturas (mig
//     0400/0403, una por negocio) y el libro (`orden.<N>`, una vez).
// Lo que contesta MaKo lo arma el CÓDIGO (`textoDeComprobante`), nunca un modelo.
// =============================================================================

import 'server-only';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { referenciaNormal } from './recibos-reglas';
import { anotarAplicadoDelGrupo, guardarLecturaDelGrupo, lecturaPreviaDelGrupo, leerArchivoComprobante, mimeDeComprobante, ordenEnUnaLecturaDelGrupo } from './comprobantes';
import { estadoDeLectura, resumenDeLectura, type LecturaComprobante } from './comprobante-reglas';
import { asignarPago, esDolar, nombreDelMes, usd, veredictoDeLectura, type Pendiente } from './agencia-mes-reglas';
import {
  aplicarPagoDeAgencia, avisarAMartin, emitirReciboDeLoCompleto, mensualidadDeAgencia, mensualidadPrendida, revisarPausasDeAgencia,
  textoAlGrupoDeLaAgencia, textoDeComprobante, type MensualidadOk,
} from './agencia-mes';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const AUTOR = 'MaKo · comprobante del grupo';

/**
 * ¿Vale la pena leer una foto o un PDF de este grupo como comprobante? La agencia tiene la mensualidad prendida. Barato (una
 * lectura del libro). «No pude leer» es no: el mensaje sigue al turno de MaKo como cualquier foto.
 */
export async function hayQueLeerComprobante(agenciaWs: number): Promise<boolean> {
  return (await mensualidadPrendida(agenciaWs).catch(() => null)) === true;
}

/** Un concepto, como lo lee la agencia: «diciembre», «la entrada de Pablo». */
function concepto(clave: string, m: MensualidadOk): string {
  if (clave.startsWith('mes:')) return `la mensualidad de ${nombreDelMes(clave.slice(4))}`;
  const ws = Number(clave.slice(8));
  return `la entrada de ${m.clientes.find((c) => c.ws === ws)?.nombre ?? `la cuenta ${ws}`}`;
}

/** Lo que se debía, en una línea para Martín. */
const loQueDebe = (ps: readonly Pendiente[]): string =>
  ps.length ? ps.map((p) => `${p.tipo === 'mes' ? `mensualidad de ${nombreDelMes(p.mes)}` : `entrada de ${p.nombre}`} ${usd(p.debeUsd)}`).join(' · ') : 'nada pendiente';

export type Atendido = { atendido: boolean; que: string };

/**
 * ATIENDE UN ARCHIVO del grupo de una agencia. `atendido: false` = no era un comprobante (o no hay nada que hacer con él): sigue
 * al turno de MaKo. `atendido: true` = ya se contestó en el grupo (o se había contestado): el turno no corre. Nunca tira.
 */
export async function atenderComprobanteDeAgencia(p: { agenciaWs: number; waMensajeId: string; bytes: Uint8Array }): Promise<Atendido> {
  const ag = p.agenciaWs;
  const mime = mimeDeComprobante(p.bytes);
  if (!mime) return { atendido: false, que: 'no es una foto ni un PDF' };
  try {
    // 1. Una lectura por mensaje: si ya se leyó, ya se contestó.
    const previa = await runWithWorkspace(ag, () => lecturaPreviaDelGrupo(p.waMensajeId));
    if (previa) return { atendido: true, que: 'ya estaba leído' };
  } catch (e) {
    // No sé si ya se leyó: no se lee de nuevo (podría aplicarse dos veces). Lo mira una persona.
    await avisarAMartin(`No pude saber si un comprobante del grupo de la agencia ${ag} ya se había leído (${msg(e)}). Revísalo a mano.`);
    return { atendido: false, que: `no pude leer la tabla: ${msg(e)}` };
  }

  // 2. La lectura (la IA de la plataforma).
  const leida = await leerArchivoComprobante({ iaWs: await wsSuperAdmin(), bytes: p.bytes, mime });
  if (!leida.ok) {
    await textoAlGrupoDeLaAgencia(ag, textoDeComprobante({ tipo: 'revisar' }));
    await avisarAMartin(`Llegó un archivo al grupo de la agencia ${ag} y no lo pude leer como comprobante: ${leida.error}. Revísalo en el grupo.`);
    return { atendido: true, que: 'no se pudo leer: a Martín' };
  }
  const l = leida.lectura;
  if (!l.esComprobante) return { atendido: false, que: 'no es un comprobante' };

  // 3. Lo que se debe hoy.
  const m = await mensualidadDeAgencia(ag);
  if (!m.ok || !m.config) {
    await guardar(ag, p, mime, l, leida.proveedor, null, null);
    await textoAlGrupoDeLaAgencia(ag, textoDeComprobante({ tipo: 'revisar' }));
    await avisarAMartin(`Comprobante de la agencia ${ag} para revisar: ${resumenDeLectura(l, estadoDeLectura(l) === 'leido' ? 'cubre' : 'dudoso', null)} No pude armar lo que debía: ${m.ok ? 'la mensualidad está apagada' : m.error}.`);
    return { atendido: true, que: 'sin mensualidad: a Martín' };
  }
  const revisar = async (porque: string, esperadoUsd: number | null): Promise<Atendido> => {
    await guardar(ag, p, mime, l, leida.proveedor, esperadoUsd, null);
    await textoAlGrupoDeLaAgencia(ag, textoDeComprobante({ tipo: 'revisar' }));
    await avisarAMartin(`Comprobante de ${m.agencia} para revisar (${porque}): ${resumenDeLectura(l, 'dudoso', esperadoUsd != null ? { monto: esperadoUsd, moneda: 'USD', pagoId: null } : null)} Lo que debía: ${loQueDebe(m.pendientes)}. Si está bien, márcalo con marcar_mensualidad_pagada o marcar_entrada_pagada (con la orden).`);
    return { atendido: true, que: `a Martín: ${porque}` };
  };
  const totalDebe = Math.round(m.pendientes.reduce((a, x) => a + x.debeUsd, 0) * 100) / 100;

  // 4. Lo que se decide solo, y lo que no. La orden repetida PRIMERO, aunque la lectura tenga dudas (`veredictoDeLectura`, ticket #80).
  const ordenLeida = referenciaNormal('binance', l.operacion ?? '');
  const { reciboDePago } = await import('./recibos');
  const ya = ordenLeida ? await reciboDePago('binance', ordenLeida).catch(() => undefined) : null;
  const enUnaLectura = ordenLeida ? await runWithWorkspace(ag, () => ordenEnUnaLecturaDelGrupo(ordenLeida)).catch(() => undefined) : false;
  const usada = ordenLeida
    ? (ya || m.libro.ordenes.has(ordenLeida) || enUnaLectura === true ? true : ya === undefined || enUnaLectura === undefined ? undefined : false)
    : false;
  const v = veredictoDeLectura({ limpia: estadoDeLectura(l) === 'leido', dudas: l.dudas, moneda: l.moneda, orden: ordenLeida, ordenYaUsada: usada });
  if (v.tipo === 'repetido') {
    await guardar(ag, p, mime, l, leida.proveedor, totalDebe, null);
    await textoAlGrupoDeLaAgencia(ag, textoDeComprobante({ tipo: 'repetido', numero: ya?.numero ?? null }));
    return { atendido: true, que: 'orden repetida' };
  }
  if (v.tipo === 'revisar') return revisar(v.porque, totalDebe);
  const orden = v.orden;
  const asig = asignarPago(l.monto!, m.pendientes);
  if (asig.tipo === 'nada-pendiente') return revisar('no se debía nada', 0);
  if (asig.tipo === 'de-mas') return revisar(`es más de lo que se debía (${usd(asig.debeUsd)})`, asig.debeUsd);
  if (asig.tipo === 'ambiguo') return revisar(`calza exacto con más de una cosa: ${asig.opciones.map((o) => o.map((c) => concepto(c, m)).join(' + ')).join(' o ')}`, l.monto!);

  // 5. Se guarda la lectura (el N.º cuenta una vez: lo frena el índice único) y se aplica.
  const esperado = asig.tipo === 'cubre' ? asig.aplicado.reduce((a, x) => a + x.montoUsd, 0) : totalDebe;
  const comprobante = mime === 'application/pdf' ? null : await guardarFoto(p.bytes);
  const g = await guardar(ag, p, mime, l, leida.proveedor, esperado, asig.aplicado.map((x) => x.clave).join(','), comprobante);
  if (!g) return { atendido: true, que: 'otro intento lo atendió' };
  if (g.repetido) {
    await textoAlGrupoDeLaAgencia(ag, textoDeComprobante({ tipo: 'repetido', numero: null }));
    return { atendido: true, que: 'orden repetida (la tabla)' };
  }
  const r = await aplicarPagoDeAgencia(m, { orden, monto: l.monto!, moneda: l.moneda!, montoUsd: l.monto!, fecha: `${l.fecha}T${l.hora ?? '12:00'}:00`, comprobante }, asig.aplicado, AUTOR);
  if (!r.ok) {
    if (r.repetida) {
      await textoAlGrupoDeLaAgencia(ag, textoDeComprobante({ tipo: 'repetido', numero: null }));
      return { atendido: true, que: 'orden repetida (el libro)' };
    }
    return revisar(`no lo pude anotar: ${r.error}`, esperado);
  }
  if (g.id) await runWithWorkspace(ag, () => anotarAplicadoDelGrupo(g.id!, asig.aplicado.map((x) => x.clave).join(',')));

  // 6. El recibo de lo que quedó completo, y las cuentas en pausa que ya pagaron vuelven a entrar.
  if (r.completas.length) {
    const rec = await emitirReciboDeLoCompleto(ag, r.completas, AUTOR);
    if (!rec.ok) await avisarAMartin(`${m.agencia} pagó ${usd(l.monto!)} (orden ${orden}) y quedó anotado, pero el recibo no salió: ${rec.error}. Revísalo en Admin › Sales › Orders.`);
  }
  const pausas = await revisarPausasDeAgencia(ag).catch(() => null);
  const reabiertas = pausas?.ok ? pausas.cambios.filter((c) => c.paso === 'reabrir' && c.ok).length : 0;

  // 7. Lo que contesta MaKo.
  const conceptos = asig.aplicado.map((x) => concepto(x.clave, m));
  const texto = asig.tipo === 'cubre'
    ? textoDeComprobante({ tipo: 'cubre', montoUsd: l.monto!, conceptos, reabiertas })
    : textoDeComprobante({ tipo: 'parcial', montoUsd: l.monto!, conceptos, cubiertos: asig.cubiertas.map((c) => concepto(c, m)), faltaUsd: asig.faltaUsd });
  await textoAlGrupoDeLaAgencia(ag, texto);
  return { atendido: true, que: asig.tipo === 'cubre' ? `cubre: ${asig.claves.join(', ')}` : `parcial: falta ${asig.faltaUsd}` };
}

/** La foto del comprobante, a la carpeta de los recibos (sale en la página 2 del recibo). Si no se puede, sin foto. */
async function guardarFoto(bytes: Uint8Array): Promise<string | null> {
  try {
    const { guardarComprobante } = await import('./recibos');
    const r = await guardarComprobante(bytes, 'comprobante-binance');
    return r.ok ? r.path : null;
  } catch { return null; }
}

/** Guarda la lectura (sin cuenta ni lead: `origen = 'grupo'`). null = otro intento guardó ese mensaje a la vez. */
async function guardar(ag: number, p: { waMensajeId: string }, mime: 'image/jpeg' | 'image/png' | 'application/pdf', l: LecturaComprobante, proveedor: string, esperadoUsd: number | null, aplicadoA: string | null, path: string | null = null): Promise<{ id: number | null; repetido: boolean } | null> {
  const r = await runWithWorkspace(ag, () => guardarLecturaDelGrupo({
    waMensajeId: p.waMensajeId, mediaPath: path, mime, lectura: l, proveedor, aplicadoA,
    esperado: esperadoUsd != null ? { monto: esperadoUsd, moneda: esDolar(l.moneda) ? l.moneda! : 'USD', pagoId: null } : null,
  })).catch((e) => ({ ok: false as const, error: msg(e) }));
  if (r.ok) return { id: r.id, repetido: r.repetido };
  if ('yaEstaba' in r && r.yaEstaba) return null;
  // No se pudo guardar (falta la 0403, la base no contestó): se sigue igual. Lo que frena una orden repetida es el libro.
  console.warn(`[agencia-mes] agencia ${ag}: no pude guardar la lectura del comprobante: ${r.error}`);
  return { id: null, repetido: false };
}

