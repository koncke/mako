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
const loQueDebe = (ps: readonly Pendiente[]): string =>
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
  const revisar = async (porque: string, esperadoUsd: number | null, usada: boolean | undefined): Promise<Atendido> => {
    const g = await guardar(ag, p, mime, l, leida.proveedor, esperadoUsd, null);
    await textoAlGrupoDeLaAgencia(ag, textoDeComprobante({ tipo: 'revisar' }));
    // Lo que se marcaría con su «aprobado»: sólo con una orden de Binance sin usar, en dólares, y algo que se debe.
    const propuesta = ordenLeida && usada === false && l.monto && l.monto > 0 && esDolar(l.moneda)
      ? await proponerComprobanteAMartin(m, {
        agenciaWs: ag, orden: ordenLeida, monto: l.monto, moneda: l.moneda!.toUpperCase(), fecha: `${l.fecha ?? m.hoy}T${l.hora ?? '12:00'}:00`,
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
  if (v.tipo === 'revisar') return revisar(v.porque, totalDebe, usada);
  const orden = v.orden;
  const asig = asignarPago(l.monto!, m.pendientes);
  if (asig.tipo === 'nada-pendiente') return revisar('no se debía nada', 0, usada);
  if (asig.tipo === 'de-mas') return revisar(`es más de lo que se debía (${usd(asig.debeUsd)})`, asig.debeUsd, usada);
  if (asig.tipo === 'ambiguo') return revisar(`calza exacto con más de una cosa: ${asig.opciones.map((o) => o.map((c) => concepto(c, m)).join(' + ')).join(' o ')}`, l.monto!, usada);

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
    return revisar(`no lo pude anotar: ${r.error}`, esperado, undefined);
  }
  if (g.id) await runWithWorkspace(ag, () => anotarAplicadoDelGrupo(g.id!, asig.aplicado.map((x) => x.clave).join(',')));

  // 6. El recibo de lo que quedó completo, las cuentas en pausa que ya pagaron vuelven a entrar, y quiénes quedaron activos (en el texto).
  const cierre = await cerrarElPagoDeAgencia(m, r.completas, AUTOR, { conTexto: false });
  if (cierre.recibo && !cierre.recibo.ok) await avisarAMartin(`${m.agencia} pagó ${usd(l.monto!)} (orden ${orden}) y quedó anotado, pero el recibo no salió: ${cierre.recibo.error}. Revísalo en Admin › Sales › Orders.`);

  // 7. Lo que contesta MaKo.
  const conceptos = asig.aplicado.map((x) => concepto(x.clave, m));
  const texto = asig.tipo === 'cubre'
    ? textoDeComprobante({ tipo: 'cubre', montoUsd: l.monto!, conceptos, activas: cierre.activas })
    : textoDeComprobante({ tipo: 'parcial', montoUsd: l.monto!, conceptos, cubiertos: asig.cubiertas.map((c) => concepto(c, m)), faltaUsd: asig.faltaUsd, activas: cierre.activas });
  await textoAlGrupoDeLaAgencia(ag, texto);
  return { atendido: true, que: asig.tipo === 'cubre' ? `cubre: ${asig.claves.join(', ')}` : `parcial: falta ${asig.faltaUsd}` };
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
