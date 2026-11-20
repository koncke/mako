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
//     SuperAdmin, CON EL ARCHIVO (16/11/2026), y a la agencia se le dice que lo revisa el equipo. Nunca se marca nada con dudas.
//   · una orden ya usada se dice, y no cuenta: `reciboDePago('binance', orden)` (los recibos de MaKo), la tabla de lecturas (mig
//     0400/0403, una por negocio) y el libro (`orden.<N>`, una vez).
//   · ⚠️ DESDE EL 19/11/2026, UN COMPROBANTE SOLO NUNCA SE APLICA (Martín, 18/11: «te fijas si realmente impactó»): el pago se busca en
//     la cuenta de Binance de MaKo (`verificarEnBinance`, lib/binance-pay-reglas.ts) y se aplica con el número y el monto REALES de la
//     cuenta. Si todavía no está, a la agencia «lo reviso solo en un rato» y lo vuelve a mirar el cron de cobros cada media hora
//     (`revisarPagosEnEspera`) durante 48 h; después, a Martín. Una lectura con dudas pero en dólares también se busca (por monto + hora
//     + quién paga): si calza, se aplica; si no, a Martín como antes.
// Lo que contesta MaKo lo arma el CÓDIGO (`textoDeComprobante`), nunca un modelo.
//
// ⚠️ EL «APROBADO» DE MARTÍN ES LA CONFIRMACIÓN (16/11/2026, Martín: «no debería pedirme confirmación si ya yo le digo aprobado que le abra
// las cuentas»). Al mandarle uno a revisar, si se puede saber qué se marcaría (una orden de Binance, en dólares, y algo que se debe), el
// CÓDIGO deja la pendiente `aplicar_comprobante_agencia` en el grupo de SuperAdmin (`proponerComprobanteAMartin`) y el aviso lo dice: su
// «aprobado» a ESE aviso la confirma. Antes el modelo proponía en ese turno (y pedía otro «sí»), y repartía a ojo: tres entradas de
// US$29,77 con un pago de 59,54. El reparto es `repartoDelComprobante`: nunca más que lo pagado, y si calza con más de una cosa, lo que
// dijo quien aprueba o quien pagó en el grupo (`loDichoAlrededor`); si nadie lo dijo, se pregunta.
// =============================================================================

import 'server-only';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { getSupabaseServer } from './supabase';
import { referenciaNormal } from './recibos-reglas';
import { anotarAplicadoDelGrupo, guardarLecturaDelGrupo, lecturaPreviaDelGrupo, leerArchivoComprobante, mimeDeComprobante, ordenEnUnaLecturaDelGrupo } from './comprobantes';
import { estadoDeLectura, resumenDeLectura, type LecturaComprobante } from './comprobante-reglas';
import {
  asignarPago, avisoDeComprobanteParaRevisar, clientesNombrados, enLista, esDolar, nombreDelMes, repartoDelComprobante, textoDeComprobante, usd,
  veredictoDeLectura, type Pendiente, type Reparto,
} from './agencia-mes-reglas';
import { aplicarPagoDeAgencia, avisarAMartin, cerrarElPagoDeAgencia, mensualidadDeAgencia, mensualidadPrendida, textoAlGrupoDeLaAgencia, type MensualidadOk } from './agencia-mes';
import { crearPendiente } from './mako-pendientes';
import { getGrupoSuperAdminJid, type ArchivoDelAviso } from './mako-grupo';
import { claveDeLaApp, conSalidaDelGrupo } from './grupo-salida';
import { calzarConBinance, HORAS_DE_ESPERA, momentoDelComprobante, numerosUsados, seVencioLaEspera, TEXTO_ESPERANDO_EL_PAGO, type Calce } from './binance-pay-reglas';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const AUTOR = 'MaKo · comprobante del grupo';
/** La acción del registro que deja la revisión (lib/api-mako/areas/cobros.def.ts). */
export const TIPO_APLICAR_COMPROBANTE = 'aplicar_comprobante_agencia';
/** Cuánto espera el «aprobado» de Martín: un día (la de un chat, 2 h, vencía antes de que mirara el grupo). */
const TTL_REVISION_MIN = 24 * 60;

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
/** Sólo el nombre, para las opciones de una pregunta: «Giselle», «la mensualidad de noviembre». */
const quienDe = (clave: string, m: MensualidadOk): string => (clave.startsWith('entrada:') ? (m.clientes.find((c) => c.ws === Number(clave.slice(8)))?.nombre ?? `la cuenta ${clave.slice(8)}`) : concepto(clave, m));

/** Lo que se debía, en una línea para Martín. Con el número de cuenta de cada cliente: el turno de MaKo lo necesita para marcarlo. */
export const loQueDebe = (ps: readonly Pendiente[]): string =>
  ps.length ? ps.map((p) => `${p.tipo === 'mes' ? `mensualidad de ${nombreDelMes(p.mes)}` : `entrada de ${p.nombre} (cuenta ${p.ws})`} ${usd(p.debeUsd)}`).join(' · ') : 'nada pendiente';

/** El archivo del comprobante, para el aviso a Martín. */
const archivoDe = (bytes: Uint8Array, mime: string): ArchivoDelAviso => ({ base64: Buffer.from(bytes).toString('base64'), mime, nombre: mime === 'application/pdf' ? 'comprobante.pdf' : 'comprobante.jpg' });

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
    await avisarAMartin(`No pude saber si un comprobante del grupo de la agencia ${ag} ya se había leído (${msg(e)}). Revísalo a mano.`, archivoDe(p.bytes, mime));
    return { atendido: false, que: `no pude leer la tabla: ${msg(e)}` };
  }

  // 2. La lectura (la IA de la plataforma).
  const leida = await leerArchivoComprobante({ iaWs: await wsSuperAdmin(), bytes: p.bytes, mime });
  if (!leida.ok) {
    await textoAlGrupoDeLaAgencia(ag, textoDeComprobante({ tipo: 'revisar' }));
    await avisarAMartin(`Llegó un archivo al grupo de la agencia ${ag} y no lo pude leer como comprobante: ${leida.error}. Revísalo en el grupo.`, archivoDe(p.bytes, mime));
    return { atendido: true, que: 'no se pudo leer: a Martín' };
  }
  const l = leida.lectura;
  if (!l.esComprobante) return { atendido: false, que: 'no es un comprobante' };

  // 3. Lo que se debe hoy.
  const m = await mensualidadDeAgencia(ag);
  if (!m.ok || !m.config) {
    await guardar(ag, p, mime, l, leida.proveedor, null, null);
    await textoAlGrupoDeLaAgencia(ag, textoDeComprobante({ tipo: 'revisar' }));
    await avisarAMartin(`Comprobante de la agencia ${ag} para revisar: ${resumenDeLectura(l, estadoDeLectura(l) === 'leido' ? 'cubre' : 'dudoso', null)} No pude armar lo que debía: ${m.ok ? 'la mensualidad está apagada' : m.error}.`, archivoDe(p.bytes, mime));
    return { atendido: true, que: 'sin mensualidad: a Martín' };
  }
  const ordenLeida = referenciaNormal('binance', l.operacion ?? '');
  /** `usada`: true/false si se sabe; undefined si no se pudo saber (entonces no se propone nada: lo mira Martín a mano). */
  /** `real`: el número y el monto que mostró la cuenta de Binance, si el pago ya se vio (ganan sobre lo leído). */
  const revisar = async (porque: string, esperadoUsd: number | null, usada: boolean | undefined, real?: { orden: string; monto: number }): Promise<Atendido> => {
    const g = await guardar(ag, p, mime, l, leida.proveedor, esperadoUsd, null);
    await textoAlGrupoDeLaAgencia(ag, textoDeComprobante({ tipo: 'revisar' }));
    // Lo que se marcaría con su «aprobado»: sólo con una orden de Binance sin usar, en dólares, y algo que se debe.
    const ordenP = real?.orden ?? ordenLeida;
    const montoP = real?.monto ?? l.monto;
    const propuesta = ordenP && usada === false && montoP && montoP > 0 && esDolar(l.moneda)
      ? await proponerComprobanteAMartin(m, {
        agenciaWs: ag, orden: ordenP, monto: montoP, moneda: l.moneda!.toUpperCase(), fecha: `${l.fecha ?? m.hoy}T${l.hora ?? '12:00'}:00`,
        comprobante: mime === 'application/pdf' ? null : await guardarFoto(p.bytes), lecturaId: g?.id ?? null, waMensajeId: p.waMensajeId,
        recibidoAt: new Date().toISOString(), claves: null,
      }).catch((e) => { console.error(`[agencia-mes] agencia ${ag}: no pude dejar la pendiente del comprobante: ${msg(e)}`); return null; })
      : null;
    await avisarAMartin(avisoDeComprobanteParaRevisar({
      agencia: m.agencia, agenciaWs: ag, porque,
      lectura: resumenDeLectura(l, 'dudoso', esperadoUsd != null ? { monto: esperadoUsd, moneda: 'USD', pagoId: null } : null),
      debe: loQueDebe(m.pendientes), propuesta,
    }), archivoDe(p.bytes, mime));
    return { atendido: true, que: `a Martín: ${porque}${propuesta ? ' (con la pendiente)' : ''}` };
  };
  const totalDebe = Math.round(m.pendientes.reduce((a, x) => a + x.debeUsd, 0) * 100) / 100;

  // 4. Lo que se decide solo, y lo que no. La orden repetida PRIMERO, aunque la lectura tenga dudas (`veredictoDeLectura`, ticket #80).
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

  // 5. ⚠️ LA PLATA TIENE QUE ESTAR EN LA CUENTA (Martín, 18/11/2026: «un comprobante solo NUNCA activa nada»). Se busca el pago en la
  //    cuenta de Binance de MaKo (lib/binance-pay-reglas.ts): por el número del comprobante y, si no aparece o no se leyó bien, por el
  //    monto exacto + la hora + quién paga. Calza → se aplica con el número y el monto REALES de la cuenta. Con una lectura limpia que
  //    todavía no aparece (o si Binance no contestó), se espera y se vuelve a mirar sola (`revisarPagosEnEspera`); lo demás, a Martín.
  const sePuedeBuscar = esDolar(l.moneda) && (l.monto ?? 0) > 0 && usada !== undefined;
  const ver = sePuedeBuscar ? await verificarEnBinance(m, { orden: ordenLeida, monto: l.monto!, at: momentoDelComprobante(l.fecha, l.hora, Date.now()) }) : null;
  if (!ver || ver.tipo !== 'calza') {
    if (v.tipo === 'revisar') return revisar(`${v.porque}${ver ? ` · ${queDijoBinance(ver)}` : ''}`, totalDebe, usada);
    if (ver?.tipo === 'revisar') return revisar(ver.porque, totalDebe, usada);
    if (ver?.tipo === 'sin-clave') return revisar('no lo pude comprobar en la cuenta de Binance: falta la clave de lectura', totalDebe, usada);
    return esperarElPago({ m, p, mime, l, proveedor: leida.proveedor, totalDebe, ordenLeida, at: momentoDelComprobante(l.fecha, l.hora, Date.now()), error: ver?.tipo === 'falla' ? ver.error : null });
  }
  const mov = ver.mov;
  const monto = Math.round(mov.monto * 100) / 100;
  const lReal: LecturaComprobante = { ...l, operacion: mov.orderId, monto, moneda: mov.moneda };
  const comprobante = mime === 'application/pdf' ? null : await guardarFoto(p.bytes);
  const r = await aplicarPagoVerificado(m, { orden: mov.orderId, monto, moneda: mov.moneda, fecha: fechaLocal(mov.at, m.zona), comprobante, lecturaId: null },
    (esperado, claves) => guardar(ag, p, mime, lReal, leida.proveedor, esperado, claves, comprobante));
  if (r.tipo === 'revisar') return revisar(r.porque, r.esperado, r.sinPropuesta ? undefined : false, { orden: mov.orderId, monto });
  if (r.tipo === 'repetido') await textoAlGrupoDeLaAgencia(ag, textoDeComprobante({ tipo: 'repetido', numero: null }));
  return { atendido: true, que: `${r.que}${r.tipo === 'aplicado' ? ` (verificado en Binance por ${ver.por === 'orden' ? 'el número' : 'el monto y la hora'})` : ''}` };
}

// ── El pago tiene que estar en la cuenta (19/11/2026) ──────────────────────────────────────────────────────────────

/** Lo que se le dice a Martín de lo que mostró la cuenta, en una frase. */
const queDijoBinance = (v: Verificacion): string =>
  v.tipo === 'calza' ? `en Binance está la orden ${v.mov.orderId}` : v.tipo === 'no-entro' ? 'en la cuenta de Binance todavía no está'
    : v.tipo === 'sin-clave' ? 'no hay clave de Binance para mirarlo' : v.tipo === 'falla' ? `Binance no contestó (${v.error})` : v.porque;

/** El momento de un pago en la hora del negocio, como lo guarda el libro: `AAAA-MM-DDTHH:MM:00`. */
export function fechaLocal(ms: number, zona: string): string {
  try {
    const s = new Intl.DateTimeFormat('sv-SE', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return `${s.replace(' ', 'T')}:00`;
  } catch { /* zona rara: la de UTC */ }
  return `${new Date(ms).toISOString().slice(0, 16)}:00`;
}

export type Verificacion = Calce | { tipo: 'sin-clave' } | { tipo: 'falla'; error: string };

/**
 * ¿Entró el pago? Lee la cuenta de Binance de MaKo (90 días: también sirve para saber quién le pagó antes por esta agencia) y lo calza
 * (`calzarConBinance`). Un movimiento cuenta UNA vez: los números anotados en el libro de CUALQUIER agencia y los de los recibos quedan
 * afuera. Si no se puede saber si un número ya se usó, se lo trata como usado (nunca se cuenta dos veces). Nunca tira.
 */
export async function verificarEnBinance(m: MensualidadOk, pedido: { orden: string | null; monto: number; at: number }): Promise<Verificacion> {
  try {
    const { pagosRecibidosEnBinance } = await import('./binance-pay');
    const ahora = Date.now();
    const lec = await pagosRecibidosEnBinance(ahora - 89 * 86_400_000, ahora);
    if (!lec.ok) return lec.sinClave ? { tipo: 'sin-clave' } : { tipo: 'falla', error: lec.error };
    const anotadas = await ordenesAnotadas();
    if (anotadas == null) return { tipo: 'falla', error: 'no pude leer las órdenes ya anotadas' };
    // Con los mal copiados adentro (`numerosUsados`): un número anotado con un dígito de más es el real, ya contado.
    const usadas = numerosUsados([...anotadas, ...m.libro.ordenes.keys()], lec.movs);
    const propias = numerosUsados(m.libro.ordenes.keys(), lec.movs);
    const conocidos = new Set(lec.movs.filter((x) => propias.has(x.orderId) && x.pagadorId).map((x) => x.pagadorId!));
    return calzarConBinance(pedido, lec.movs, { usadas, conocidos });
  } catch (e) {
    return { tipo: 'falla', error: msg(e) };
  }
}

/**
 * Los números de Binance ya anotados en algún lado: el libro de cualquier agencia (`agencia.mensualidad.<ws>.orden.<N>`) y los recibos de
 * MaKo (`recibo_pagos`, medio binance, sin anular). null si no se pudo leer alguno (entonces no se aplica nada: nunca dos veces).
 */
export async function ordenesAnotadas(): Promise<Set<string> | null> {
  const db = getSupabaseServer();
  const [libros, recibos] = await Promise.all([
    db.from('app_settings').select('key').eq('workspace_id', await wsSuperAdmin()).like('key', 'agencia.mensualidad.%.orden.%').limit(5000),
    db.from('recibo_pagos').select('referencia').eq('medio', 'binance').eq('anulado', false).limit(5000),
  ]);
  if (libros.error || recibos.error) return null;
  return new Set([
    ...((libros.data ?? []) as Array<{ key: string }>).map((f) => f.key.slice(f.key.lastIndexOf('.orden.') + 7)),
    ...((recibos.data ?? []) as Array<{ referencia: string | null }>).map((f) => String(f.referencia ?? '')),
  ].map((s) => s.trim().toUpperCase()).filter(Boolean));
}

type ResultadoVerificado =
  | { tipo: 'aplicado'; que: string }
  | { tipo: 'repetido'; que: string }
  | { tipo: 'nada'; que: string }
  | { tipo: 'revisar'; porque: string; esperado: number | null; sinPropuesta?: true };

/**
 * APLICA UN PAGO QUE YA SE VIO EN LA CUENTA: a qué va (`asignarPago`), la lectura con su N.º (`guardarLectura`, si es la primera vez:
 * el índice único lo frena), el libro (`aplicarPagoDeAgencia`, la orden una vez), el recibo de lo que quedó completo, las cuentas en
 * pausa que vuelven a entrar, y lo que se le contesta a la agencia. Lo que no se decide solo vuelve como `revisar`.
 * También lo usa el pago que entró SIN captura (lib/binance-sin-captura.ts, 20/11/2026): `medio` va en el texto a la agencia («Recibí tu
 * pago de US$ 97 por Binance») y `autor` en el libro.
 */
export async function aplicarPagoVerificado(
  m: MensualidadOk,
  pago: { orden: string; monto: number; moneda: string; fecha: string; comprobante: string | null; lecturaId: number | null },
  guardarLectura?: (esperado: number, claves: string) => Promise<{ id: number | null; repetido: boolean } | null>,
  o: { medio?: string; autor?: string } = {},
): Promise<ResultadoVerificado> {
  const autor = o.autor ?? AUTOR;
  const ag = m.agenciaWs;
  const totalDebe = Math.round(m.pendientes.reduce((a, x) => a + x.debeUsd, 0) * 100) / 100;
  const asig = asignarPago(pago.monto, m.pendientes);
  if (asig.tipo === 'nada-pendiente') return { tipo: 'revisar', porque: 'no se debía nada', esperado: 0 };
  if (asig.tipo === 'de-mas') return { tipo: 'revisar', porque: `es más de lo que se debía (${usd(asig.debeUsd)})`, esperado: asig.debeUsd };
  if (asig.tipo === 'ambiguo') return { tipo: 'revisar', porque: `calza exacto con más de una cosa: ${asig.opciones.map((o) => o.map((c) => concepto(c, m)).join(' + ')).join(' o ')}`, esperado: pago.monto };

  const claves = asig.aplicado.map((x) => x.clave).join(',');
  const esperado = asig.tipo === 'cubre' ? asig.aplicado.reduce((a, x) => a + x.montoUsd, 0) : totalDebe;
  let lecturaId = pago.lecturaId;
  if (guardarLectura) {
    const g = await guardarLectura(esperado, claves);
    if (!g) return { tipo: 'nada', que: 'otro intento lo atendió' };
    if (g.repetido) return { tipo: 'repetido', que: 'orden repetida (la tabla)' };
    lecturaId = g.id;
  }
  const r = await aplicarPagoDeAgencia(m, { orden: pago.orden, monto: pago.monto, moneda: pago.moneda, montoUsd: pago.monto, fecha: pago.fecha, comprobante: pago.comprobante }, asig.aplicado, autor);
  if (!r.ok) {
    if (r.repetida) return { tipo: 'repetido', que: 'orden repetida (el libro)' };
    return { tipo: 'revisar', porque: `no lo pude anotar: ${r.error}`, esperado, sinPropuesta: true };
  }
  if (lecturaId) await runWithWorkspace(ag, () => anotarAplicadoDelGrupo(lecturaId!, claves));

  // El recibo de lo que quedó completo, las cuentas en pausa que ya pagaron vuelven a entrar, y quiénes quedaron activos (en el texto).
  const cierre = await cerrarElPagoDeAgencia(m, r.completas, autor, { conTexto: false });
  if (cierre.recibo && !cierre.recibo.ok) await avisarAMartin(`${m.agencia} pagó ${usd(pago.monto)} (orden ${pago.orden}) y quedó anotado, pero el recibo no salió: ${cierre.recibo.error}. Revísalo en Admin › Sales › Orders.`);

  const conceptos = asig.aplicado.map((x) => concepto(x.clave, m));
  const texto = asig.tipo === 'cubre'
    ? textoDeComprobante({ tipo: 'cubre', montoUsd: pago.monto, conceptos, activas: cierre.activas, medio: o.medio })
    : textoDeComprobante({ tipo: 'parcial', montoUsd: pago.monto, conceptos, cubiertos: asig.cubiertas.map((c) => concepto(c, m)), faltaUsd: asig.faltaUsd, activas: cierre.activas });
  await textoAlGrupoDeLaAgencia(ag, texto);
  return { tipo: 'aplicado', que: asig.tipo === 'cubre' ? `cubre: ${asig.claves.join(', ')}` : `parcial: falta ${asig.faltaUsd}` };
}

// ── El comprobante cuyo pago todavía no se ve: se espera y se vuelve a mirar sola (19/11/2026) ─────────────────────────

/** El renglón de la espera, en los ajustes de la plataforma: `binance.espera.<agencia>.<mensaje>`. */
const PREFIJO_ESPERA = 'binance.espera.';
type Espera = { agenciaWs: number; waMensajeId: string; lecturaId: number | null; orden: string | null; monto: number; at: number; comprobante: string | null; desde: string };

function leerEspera(v: string | null | undefined): Espera | null {
  try {
    const o = JSON.parse(v ?? '') as Record<string, unknown>;
    if (typeof o.agenciaWs !== 'number' || typeof o.waMensajeId !== 'string' || typeof o.monto !== 'number' || !(o.monto > 0) || typeof o.at !== 'number' || typeof o.desde !== 'string') return null;
    return {
      agenciaWs: o.agenciaWs, waMensajeId: o.waMensajeId, lecturaId: typeof o.lecturaId === 'number' ? o.lecturaId : null, orden: typeof o.orden === 'string' ? o.orden : null,
      monto: o.monto, at: o.at, comprobante: typeof o.comprobante === 'string' ? o.comprobante : null, desde: o.desde,
    };
  } catch { return null; }
}

/**
 * Una lectura limpia cuyo pago todavía no aparece en la cuenta: se guarda la lectura (sin aplicar), se anota la espera y a la agencia
 * se le dice que se revisa sola. Si no se pudo anotar la espera, va a Martín (nunca queda olvidado en silencio).
 */
async function esperarElPago(x: { m: MensualidadOk; p: { waMensajeId: string; bytes: Uint8Array }; mime: 'image/jpeg' | 'image/png' | 'application/pdf'; l: LecturaComprobante; proveedor: string; totalDebe: number; ordenLeida: string | null; at: number; error: string | null }): Promise<Atendido> {
  const ag = x.m.agenciaWs;
  const comprobante = x.mime === 'application/pdf' ? null : await guardarFoto(x.p.bytes);
  const g = await guardar(ag, x.p, x.mime, x.l, x.proveedor, x.totalDebe, null, comprobante);
  if (!g) return { atendido: true, que: 'otro intento lo atendió' };
  const espera: Espera = { agenciaWs: ag, waMensajeId: x.p.waMensajeId, lecturaId: g.id, orden: x.ordenLeida, monto: x.l.monto!, at: x.at, comprobante, desde: new Date().toISOString() };
  const wsP = await wsSuperAdmin();
  const { error } = await getSupabaseServer().from('app_settings')
    .upsert({ workspace_id: wsP, key: `${PREFIJO_ESPERA}${ag}.${x.p.waMensajeId}`.slice(0, 200), value: JSON.stringify(espera), updated_at: espera.desde }, { onConflict: 'workspace_id,key' });
  if (error) {
    await textoAlGrupoDeLaAgencia(ag, textoDeComprobante({ tipo: 'revisar' }));
    await avisarAMartin(`Comprobante de ${x.m.agencia} (${usd(x.l.monto!)}, orden ${x.ordenLeida ?? 'sin leer'}): todavía no está en la cuenta de Binance y no pude anotarlo para volver a mirarlo (${error.message}). Revísalo a mano.`, archivoDe(x.p.bytes, x.mime));
    return { atendido: true, que: `no pude anotar la espera: a Martín` };
  }
  await textoAlGrupoDeLaAgencia(ag, TEXTO_ESPERANDO_EL_PAGO);
  return { atendido: true, que: `esperando el pago en Binance${x.error ? ` (${x.error})` : ''}` };
}

/**
 * VUELVE A MIRAR LOS COMPROBANTES EN ESPERA (lo corre el cron de los cobros, cada media hora). Calza → se aplica y se le contesta a la
 * agencia; un caso para una persona → a Martín; pasadas `HORAS_DE_ESPERA` sin que aparezca → a Martín y a la agencia «lo revisa el
 * equipo». Cada espera se borra al resolverse. Nunca tira.
 */
export async function revisarPagosEnEspera(ahora: number = Date.now()): Promise<{ revisadas: number; aplicadas: number; aMartin: number; errores: number }> {
  const out = { revisadas: 0, aplicadas: 0, aMartin: 0, errores: 0 };
  let filas: Array<{ key: string; value: string }> = [];
  const wsP = await wsSuperAdmin().catch(() => null);
  if (wsP == null) return { ...out, errores: 1 };
  const db = getSupabaseServer();
  const { data, error } = await db.from('app_settings').select('key, value').eq('workspace_id', wsP).like('key', `${PREFIJO_ESPERA}%`).limit(200);
  if (error) { console.warn(`[agencia-mes] no pude leer los comprobantes en espera: ${error.message}`); return { ...out, errores: 1 }; }
  filas = (data ?? []) as Array<{ key: string; value: string }>;
  const borrar = (key: string) => db.from('app_settings').delete().eq('workspace_id', wsP).eq('key', key).then(({ error: e }) => { if (e) console.warn(`[agencia-mes] no pude borrar ${key}: ${e.message}`); });
  for (const f of filas) {
    out.revisadas++;
    try {
      const e = leerEspera(f.value);
      if (!e) { await borrar(f.key); continue; }
      const m = await mensualidadDeAgencia(e.agenciaWs);
      if (!m.ok) { out.errores++; continue; }
      if (!m.config) { await borrar(f.key); continue; }
      const ver = await verificarEnBinance(m, { orden: e.orden, monto: e.monto, at: e.at });
      if (ver.tipo === 'calza') {
        const monto = Math.round(ver.mov.monto * 100) / 100;
        const r = await aplicarPagoVerificado(m, { orden: ver.mov.orderId, monto, moneda: ver.mov.moneda, fecha: fechaLocal(ver.mov.at, m.zona), comprobante: e.comprobante, lecturaId: e.lecturaId });
        if (r.tipo === 'aplicado') out.aplicadas++;
        else if (r.tipo === 'revisar') {
          out.aMartin++;
          await textoAlGrupoDeLaAgencia(e.agenciaWs, textoDeComprobante({ tipo: 'revisar' }));
          await avisarAMartin(`El pago de ${m.agencia} (${usd(monto)}, orden ${ver.mov.orderId}) ya está en la cuenta de Binance, pero no lo apliqué solo: ${r.porque}. Debe: ${loQueDebe(m.pendientes)}.`);
        }
        await borrar(f.key);
        continue;
      }
      if (ver.tipo === 'revisar' || ver.tipo === 'sin-clave' || seVencioLaEspera(e.desde, ahora)) {
        out.aMartin++;
        const porque = ver.tipo === 'revisar' ? ver.porque : ver.tipo === 'sin-clave' ? 'no hay clave de Binance para mirarlo' : `pasaron ${HORAS_DE_ESPERA} h y el pago no aparece en la cuenta de Binance`;
        await textoAlGrupoDeLaAgencia(e.agenciaWs, textoDeComprobante({ tipo: 'revisar' }));
        await avisarAMartin(`Comprobante de ${m.agencia} para revisar (${usd(e.monto)}, orden ${e.orden ?? 'sin leer'}): ${porque}. Debe: ${loQueDebe(m.pendientes)}.`);
        await borrar(f.key);
      }
      // Si no: todavía no entró (o Binance no contestó) y no se venció: en la próxima vuelta.
    } catch (err) {
      out.errores++;
      console.error(`[agencia-mes] comprobante en espera ${f.key}: ${msg(err)}`);
    }
  }
  return out;
}

// ── El comprobante que aprueba Martín (16/11/2026) ─────────────────────────────────────────────────────────────────

/** Lo que guarda la pendiente `aplicar_comprobante_agencia`: el pago como se leyó, y a qué va si ya se sabía al proponerlo. */
export type PagoParaAprobar = {
  agenciaWs: number; orden: string; monto: number; moneda: string;
  /** El momento del pago, `AAAA-MM-DDTHH:MM:00`. */
  fecha: string;
  /** La foto guardada para la página 2 del recibo, si hay. */
  comprobante: string | null;
  /** La lectura del grupo (`comprobantes_leidos`), para anotarle a qué se aplicó. */
  lecturaId: number | null;
  /** El mensaje de la foto en el grupo de la agencia ('' si lo propuso el turno de Martín): lo que dijo quien la mandó se busca de ahí. */
  waMensajeId: string;
  recibidoAt: string;
  /** A qué va, si ya se sabía; null = lo dice quien aprueba o quien pagó (o se pregunta). */
  claves: string[] | null;
};

export function leerPagoParaAprobar(v: Record<string, unknown>): PagoParaAprobar | null {
  const ok = typeof v.agenciaWs === 'number' && typeof v.orden === 'string' && typeof v.monto === 'number' && v.monto > 0 && typeof v.moneda === 'string' && typeof v.fecha === 'string';
  if (!ok) return null;
  return {
    agenciaWs: v.agenciaWs as number, orden: v.orden as string, monto: v.monto as number, moneda: v.moneda as string, fecha: v.fecha as string,
    comprobante: typeof v.comprobante === 'string' ? v.comprobante : null, lecturaId: typeof v.lecturaId === 'number' ? v.lecturaId : null,
    waMensajeId: typeof v.waMensajeId === 'string' ? v.waMensajeId : '', recibidoAt: typeof v.recibidoAt === 'string' ? v.recibidoAt : '',
    claves: Array.isArray(v.claves) && v.claves.every((c) => typeof c === 'string') ? (v.claves as string[]) : null,
  };
}

/** Lo que se marca, en una frase (el aviso, la pendiente y lo que se le dice a Martín). */
function queSeMarca(m: MensualidadOk, monto: number, r: Reparto): string {
  if (r.tipo === 'aplicar') return `${enLista(r.aplicado.map((x) => concepto(x.clave, m)))}${r.parcial ? `, a cuenta (falta ${usd(r.parcial.faltaUsd)})` : ''}`;
  if (r.tipo === 'preguntar') return `${usd(monto)} alcanza para ${r.opciones[0]?.length ?? 0} de ${enLista([...new Set(r.opciones.flat())].map((c) => quienDe(c, m)))}`;
  return r.porque;
}

/** Lo que dice la pendiente (lo leen Martín y el modelo mientras espera el «aprobado»). */
export function resumenDelComprobante(m: MensualidadOk, pago: Pick<PagoParaAprobar, 'monto' | 'moneda' | 'orden'>, r: Reparto): string {
  return `Aplicar el comprobante de ${m.agencia} (${usd(pago.monto)} ${pago.moneda}, orden ${pago.orden}): ${queSeMarca(m, pago.monto, r)}${r.tipo === 'preguntar' ? ', las que nombre quien pagó o quien aprueba' : ''}. Sale el recibo al grupo de la agencia y sus cuentas vuelven a entrar.`;
}

/** La pregunta cuando nadie dijo a quiénes va. */
const preguntaDelReparto = (m: MensualidadOk, monto: number, opciones: string[][]): string =>
  `${usd(monto)} alcanza para ${opciones[0]?.length ?? 0} de esas y nadie dijo cuáles (ni en el grupo de ${m.agencia} ni aquí): ¿a cuáles lo aplico? ${opciones.map((op) => enLista(op.map((c) => quienDe(c, m)))).join(' · ')}.`;

/**
 * DEJA LA PENDIENTE en el grupo de SuperAdmin y devuelve la frase del aviso, o null si no se pudo (el aviso sale igual, sin ella). La pendiente
 * nace fuera del turno de la agencia (`conSalidaDelGrupo` del grupo de SuperAdmin): un comprobante llegado por el grupo de la APP la marcaba
 * «nacida en la app» y el «aprobado» de WhatsApp no la confirmaba (lib/confirmacion-pura.ts, `lineaSeConfirmaEnLaApp`).
 */
export async function proponerComprobanteAMartin(m: MensualidadOk, pago: PagoParaAprobar): Promise<string | null> {
  const r = repartoDelComprobante(pago.monto, m.pendientes);
  if (r.tipo === 'no') return null;
  const claves = r.tipo === 'aplicar' ? r.claves : null;
  const wsP = await wsSuperAdmin();
  const grupoJid = (await getGrupoSuperAdminJid().catch(() => null)) ?? claveDeLaApp(wsP);
  const resumen = resumenDelComprobante(m, pago, r);
  const c = await conSalidaDelGrupo({ ws: wsP, clave: grupoJid, soloApp: false, hayInvitado: false }, () => crearPendiente(wsP, {
    grupoJid, tipo: TIPO_APLICAR_COMPROBANTE, payload: { ...pago, claves }, resumen, origen: 'comprobante', ttlMin: TTL_REVISION_MIN,
  }));
  if ('error' in c) return null;
  return r.tipo === 'aplicar'
    ? `Con lo que pagó marco: ${queSeMarca(m, pago.monto, r)}.`
    : `${queSeMarca(m, pago.monto, r)} y el comprobante no dice cuáles: marco las que nombre la agencia en su grupo, y si no las nombró, te pregunto.`;
}

/**
 * Lo que dijeron en el grupo de la agencia alrededor del comprobante: de 10 minutos antes a una hora después, de quien mandó la foto (si se
 * encuentra; si no, de cualquier persona). Es lo que nombra a quiénes va («Giselle Belanti y Marcela Fernández»). Nunca tira: sin leer, nada.
 */
async function loDichoAlrededor(pago: PagoParaAprobar): Promise<string[]> {
  const t = Date.parse(pago.recibidoAt);
  if (!Number.isFinite(t)) return [];
  const { data, error } = await getSupabaseServer().from('grupo_mensajes').select('texto, autor_nombre, wa_message_id')
    .eq('workspace_id', pago.agenciaWs).eq('autor_tipo', 'persona')
    .gte('created_at', new Date(t - 10 * 60_000).toISOString()).lte('created_at', new Date(t + 60 * 60_000).toISOString())
    .order('created_at', { ascending: true }).limit(30);
  if (error) return [];
  const filas = (data ?? []) as Array<{ texto: string | null; autor_nombre: string | null; wa_message_id: string | null }>;
  const foto = pago.waMensajeId ? filas.find((f) => f.wa_message_id === pago.waMensajeId) : undefined;
  return filas.filter((f) => !foto || f.autor_nombre === foto.autor_nombre).map((f) => String(f.texto ?? '').trim()).filter(Boolean);
}

/** Lo que resuelve una aprobación: a qué va (con la mensualidad leída), la pregunta, o por qué ya no va. `falla`: no se pudo leer (sigue viva). */
export type Aprobacion =
  | { tipo: 'aplicar'; m: MensualidadOk; pago: PagoParaAprobar; reparto: Extract<Reparto, { tipo: 'aplicar' }> }
  | { tipo: 'preguntar' | 'no' | 'falla'; texto: string };

/**
 * A QUÉ VA, al confirmar (corre en `faltaParaConfirmar` y otra vez en `ejecutar`, con lo que se debe AHORA). Decide lo que eligió la propuesta;
 * si no eligió, lo que dice quien aprueba (`mensaje`, su «aprobado, son Giselle y Marcela») y después quien pagó en el grupo.
 */
export async function aQueVaElComprobante(payload: Record<string, unknown>, mensaje: string): Promise<Aprobacion> {
  const pago = leerPagoParaAprobar(payload);
  if (!pago) return { tipo: 'no', texto: 'Esa propuesta no trae el pago completo: revisa el comprobante a mano.' };
  const m = await mensualidadDeAgencia(pago.agenciaWs).catch((e) => ({ ok: false as const, error: msg(e) }));
  if (!m.ok) return { tipo: 'falla', texto: `No pude leer la mensualidad de la agencia: ${m.error}. Intenta de nuevo.` };
  if (!m.config) return { tipo: 'no', texto: 'Esa agencia ya no tiene la mensualidad prendida.' };
  if (m.libro.ordenes.has(pago.orden)) return { tipo: 'no', texto: `La orden ${pago.orden} ya quedó anotada: un comprobante cuenta una sola vez.` };
  // Anotada a mano por otro camino (un recibo cargado en Sales): tampoco se cuenta otra vez.
  const { reciboDePago } = await import('./recibos');
  const enRecibo = await reciboDePago('binance', pago.orden).catch(() => undefined);
  if (enRecibo === undefined) return { tipo: 'falla', texto: 'No pude revisar si esa orden ya está en un recibo. Intenta de nuevo.' };
  if (enRecibo) return { tipo: 'no', texto: `La orden ${pago.orden} ya está en el recibo N.º ${String(enRecibo.numero).padStart(4, '0')}: no se cuenta dos veces.` };
  const nombrados = pago.claves ? [] : [clientesNombrados([mensaje], m.clientes), clientesNombrados(await loDichoAlrededor(pago).catch(() => []), m.clientes)];
  const r = repartoDelComprobante(pago.monto, m.pendientes, { claves: pago.claves, nombrados });
  if (r.tipo === 'aplicar') return { tipo: 'aplicar', m, pago, reparto: r };
  if (r.tipo === 'preguntar') return { tipo: 'preguntar', texto: preguntaDelReparto(m, pago.monto, r.opciones) };
  return { tipo: 'no', texto: `Ese comprobante ya no se puede aplicar: ${r.porque}.` };
}

/**
 * APLICA EL COMPROBANTE APROBADO: la orden una vez (`aplicarPagoDeAgencia`), lo que quedó completo con su recibo, las cuentas que vuelven a
 * entrar (`cerrarElPagoDeAgencia`) y a la agencia lo mismo que con un comprobante leído («Recibí tu pago…» con quiénes quedaron activos).
 */
export async function aplicarComprobanteAprobado(a: Extract<Aprobacion, { tipo: 'aplicar' }>, autor: string): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  const { m, pago, reparto } = a;
  const r = await aplicarPagoDeAgencia(m, { orden: pago.orden, monto: pago.monto, moneda: pago.moneda, montoUsd: pago.monto, fecha: pago.fecha, comprobante: pago.comprobante }, reparto.aplicado, autor);
  if (!r.ok) return { ok: false, error: r.error };
  if (pago.lecturaId) await runWithWorkspace(pago.agenciaWs, () => anotarAplicadoDelGrupo(pago.lecturaId!, reparto.claves.join(',')));
  const cierre = await cerrarElPagoDeAgencia(m, r.completas, autor, { conTexto: false });
  const conceptos = reparto.aplicado.map((x) => concepto(x.clave, m));
  await textoAlGrupoDeLaAgencia(pago.agenciaWs, reparto.parcial
    ? textoDeComprobante({ tipo: 'parcial', montoUsd: pago.monto, conceptos, cubiertos: reparto.parcial.cubiertas.map((c) => concepto(c, m)), faltaUsd: reparto.parcial.faltaUsd, activas: cierre.activas })
    : textoDeComprobante({ tipo: 'cubre', montoUsd: pago.monto, conceptos, activas: cierre.activas }));
  const recibo = cierre.recibo?.ok && cierre.recibo.numero ? ` Salió el recibo N.º ${String(cierre.recibo.numero).padStart(4, '0')} al grupo de la agencia.` : cierre.recibo && !cierre.recibo.ok ? ` El recibo no salió: ${cierre.recibo.error}.` : '';
  return {
    ok: true,
    resumen: `Listo: con ${usd(pago.monto)} (orden ${pago.orden}) quedó pagado: ${queSeMarca(m, pago.monto, reparto)}${reparto.porNombre ? ' (a cuáles, según lo que se dijo en el chat)' : ''}.${recibo}${cierre.texto ? ` A la agencia: «${cierre.texto}»` : ''}`,
  };
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
