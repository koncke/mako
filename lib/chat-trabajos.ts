// =============================================================================
// Los trabajos largos del chat con MaKo: se confirman y siguen POR DETRÁS (20/10/2026, ola 1, pieza 1.11)
// =============================================================================
// docs/ops-center-principal.md §2.7. Antes, confirmar algo lento (replicar una landing: unos 275 s, con un tope de 420)
// dejaba la pantalla esperando con «MaKo está escribiendo… puede tardar un par de minutos», sin avance; y con la pestaña
// cerrada a mitad, el resultado no aparecía en ningún lado. Ahora:
//   · al confirmar, se anota en el hilo «En curso: …» con un G6 (lib/chat-bloques.ts) y la respuesta vuelve ENSEGUIDA;
//   · el trabajo corre por detrás (`after()` de Next, con el maxDuration de la ruta: el mismo plazo que antes tenía);
//   · al terminar, ESE mensaje pasa a «Hecho: …» con su resultado (el G6 terminado, su G5 o su «Abrir»): lo ve la
//     pantalla que consulta (`estadoDeTrabajo`, GET /api/mako/chat?trabajo=), lo ve quien vuelve con la pestaña cerrada,
//     y lo lee el modelo en el turno siguiente.
//
// ⚠️ LA CONSULTA ES UNA LLAVE: `<id del mensaje>.<token al azar>`. Sólo la tiene quien recibió el bloque; el id solo no
//    alcanza para leer el mensaje de otra persona del negocio. El mensaje se busca en el negocio de quien consulta.
// ⚠️ SI NO SE PUEDE ANOTAR (sin la columna `bloques`, sin el chat), devuelve null y quien llama corre como antes, en
//    primer plano: un trabajo nunca se pierde por no poder mostrar su avance.
// ⚠️ UN TRABAJO QUE MUERE NO AVISA (revisión del 21/10/2026): si la plataforma corta la invocación (su techo, la memoria),
//    no corre ni el `catch` ni el «Hecho»; y si el «Hecho» final no se puede guardar, tampoco. Por eso el G6 lleva `hasta`
//    (`PLAZO_TRABAJO_MS`): pasado eso, `estadoDeTrabajo` lo da por cortado y lo deja escrito. NO se suelta la propuesta
//    ni la pendiente: no se sabe si la acción llegó a correr, y soltarla invitaría a hacerla dos veces (la propuesta queda
//    en «Fallidas» de /mako/revisar, `propuestasAccionFallidas`).

import 'server-only';
import { after } from 'next/server';
import { randomBytes } from 'node:crypto';
import { actualizarMensaje, appendMessage, getMensajeConTexto, getSession } from './chart-chats';
import { runWithWorkspace } from './workspace';
import { PLAZO_TRABAJO_MS, aGuardar, bloqueDeResultado, bloquesGuardados, textoCortado, type Abrir, type Bloque, type BloqueCreado } from './chat-bloques';

/** Lo que devuelve el trabajo (un `Ejecutado`, o lo que se le parezca). */
export type Terminado = { ok: boolean; resumen: string; datos?: Record<string, unknown> };

const CONSULTA = /^([1-9][0-9]{0,14})\.([A-Za-z0-9_-]{8,40})$/;

function g6(titulo: string, consulta: string | undefined, estado: 'en_curso' | 'listo' | 'fallo', fin?: { listo?: BloqueCreado; abrir?: Abrir }, hasta?: number): Bloque {
  return {
    t: 'trabajo', titulo, ...(consulta ? { consulta } : {}), ...(hasta ? { hasta } : {}),
    pasos: [{ texto: 'Confirmado', estado: 'listo' }, { texto: titulo, estado }],
    ...(fin?.listo ? { listo: fin.listo } : {}), ...(fin?.abrir ? { abrir: fin.abrir } : {}),
  };
}

/**
 * Anota «En curso: <titulo>» en el chat `sessionId` y corre `correr` por detrás. Devuelve el G6 que la pantalla suma al
 * hilo (y consulta), o null si no se pudo anotar: entonces quien llama corre el trabajo como antes.
 * `abrirDe`: el «Abrir en <tab>» del resultado, cuando no trae un bloque propio.
 */
export async function enSegundoPlano(ws: number, sessionId: number, titulo: string, correr: () => Promise<Terminado>,
  abrirDe?: (r: Terminado) => Abrir | null): Promise<Bloque | null> {
  if (!(await getSession(sessionId).catch(() => null))) return null;
  const hasta = Date.now() + PLAZO_TRABAJO_MS;
  const msg = await appendMessage(sessionId, 'assistant', `En curso: ${titulo}`, [aGuardar(g6(titulo, undefined, 'en_curso', undefined, hasta))]).catch(() => null);
  if (!msg?.id || !msg.conBloques) return null;
  const id = msg.id;
  const consulta = `${id}.${randomBytes(12).toString('base64url')}`;
  if (!(await actualizarMensaje(id, `En curso: ${titulo}`, [aGuardar(g6(titulo, consulta, 'en_curso', undefined, hasta))]).catch(() => false))) return null;
  after(() => runWithWorkspace(ws, async () => {
    let r: Terminado;
    try { r = await correr(); } catch (e) { r = { ok: false, resumen: `No pude terminarlo (${e instanceof Error ? e.message : 'error'}).` }; }
    const bloque = r.ok ? bloqueDeResultado(r.datos) : null;
    const listo = bloque?.t === 'creado' ? bloque : undefined;
    const abrir = r.ok && !bloque ? abrirDe?.(r) ?? undefined : undefined;
    const bloques = [g6(titulo, consulta, r.ok ? 'listo' : 'fallo', { listo, abrir }), ...(bloque && bloque.t !== 'creado' ? [bloque] : [])];
    await actualizarMensaje(id, r.ok ? `Hecho: ${r.resumen}` : `No se pudo: ${r.resumen}`, bloques.map(aGuardar));
  }).catch((e) => console.error(`[chat-trabajos] el trabajo «${titulo}» (mensaje ${id}):`, e instanceof Error ? e.message : String(e))));
  return g6(titulo, consulta, 'en_curso', undefined, hasta);
}

/**
 * Lo que una pantalla ve de un trabajo: su texto y lo que dibuja. null = no existe en este negocio o la llave no calza.
 * Uno «En curso» pasado su `hasta` se cortó: se devuelve (y se deja escrito) como tal, con `textoCortado`.
 */
export async function estadoDeTrabajo(consulta: unknown, ahora = Date.now()): Promise<{ texto: string; bloques: Bloque[] } | null> {
  if (typeof consulta !== 'string') return null;
  const m = CONSULTA.exec(consulta);
  if (!m) return null;
  const fila = await getMensajeConTexto(Number(m[1]));
  if (!fila) return null;
  const bloques = bloquesGuardados(fila.bloques);
  const suyo = bloques.find((b): b is Extract<Bloque, { t: 'trabajo' }> => b.t === 'trabajo' && b.consulta === consulta);
  if (!suyo) return null;
  if (!suyo.hasta || ahora <= suyo.hasta || !suyo.pasos.some((p) => p.estado === 'en_curso')) return { texto: fila.content, bloques };
  const cortado: Bloque = { ...suyo, pasos: suyo.pasos.map((p) => (p.estado === 'en_curso' ? { ...p, estado: 'fallo' as const } : p)) };
  const conCorte = bloques.map((b) => (b === suyo ? cortado : b));
  const texto = textoCortado(suyo.titulo);
  // Que lo vea también quien vuelve sin pantalla abierta, y el modelo en el turno siguiente. Si no se puede guardar, igual
  // se contesta: la próxima consulta lo vuelve a intentar.
  await actualizarMensaje(Number(m[1]), texto, conCorte.map(aGuardar)).catch(() => false);
  return { texto, bloques: conCorte };
}
