import 'server-only';

// =============================================================================
// La Ticketera de los usuarios — el CIERRE solo y el AVISO al cliente
// =============================================================================
// Martín (17/10/2026): «cuando el arreglo está en producción, el ticket se cierra solo y al usuario le llega el aviso
// por donde lo levantó».
//
// ⚠️ «EN PRODUCCIÓN» LO DICE EL CÓDIGO QUE CORRE, NO UN COMMIT. Quien arregla anota en la bitácora de su área el hito de
// siempre con `tickets: [12]` (app/admin/dev/_registro/tipos.ts). Las bitácoras viajan dentro del build: si ESTE
// deploy trae el hito, el arreglo está desplegado. El diagnóstico obvio —preguntarle a GitHub si el commit está en
// `main`— estaba mal dos veces: el token de GitHub de la plataforma contesta 404 sobre el repo desde la transferencia
// (docs/hallazgos-operaciones.md, 15/10), y un commit en `main` todavía no es un deploy.
//
// ⚠️ EL AVISO VA POR DONDE LO LEVANTÓ (`canal`): en su chat de MaKo (un mensaje en ESE hilo) y un push a su teléfono;
// por el grupo de MaKo del negocio si fue por WhatsApp; y siempre queda en /tickets. Un aviso es un EVENTO y /tickets
// es el ESTADO (AGENTS.md, «Un canal PROPONE»): si el push no llega, el ticket igual dice «Resuelto».

import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { REGISTROS_SLUGS, registroDe } from '@/app/admin/dev/registros';
import { anotarDelCerebro, ticketsDelNegocioEntre } from './tickets-db';
import { HORAS_MAX_SIN_TOMAR, MIN_SIN_TOMAR, delegadosParaAvisar, textoDelegadoSinTomar, type DelegadoSinTomar } from './despacho-grupo';
import { aprobadoPorRegla, hitosDeLosTickets, hitosDelNegocio, loCierraElDeploy, pruebaDeProduccion, textoArregloAlGrupo, textoDelAviso, ticketsDeHitos, ticketsQueNombran, TIPO_FALTA_EN_PRODUCCION, TIPO_PASO_HECHO, type AvisoCliente } from './tickets-reglas';

const T = 'tickets';

/** `falta`: el `faltaEnProduccion` del hito (13/11/2026). Con eso, el deploy no lo cierra hasta que el paso se marque hecho. */
export type HitoDeTicket = { area: string; titulo: string; falta?: string };

/** Los tickets que nombra alguna bitácora DESPLEGADA (la de este build), con el hito que los arregla. */
export function ticketsDesplegados(): Map<number, HitoDeTicket> {
  return ticketsDeHitos(REGISTROS_SLUGS.map((slug) => ({ area: slug, bitacora: registroDe(slug).bitacora })));
}

/** El renglón del historial de un delegado al que ya se le avisó la demora: un aviso por pedido, nunca uno cada 15 minutos. */
export const TIPO_DEMORA_AVISADA = 'demora_avisada';

/**
 * EL PEDIDO DELEGADO QUE NADIE TOMÓ (29/10/2026, el Cerebro, por la llamada con Thiago: «si un pedido delegado no se toma en 30
 * minutos, MaKo avisa en el grupo»; lib/despacho-grupo.ts). Lo corre el cron de tickets (cada 15 minutos): los delegados por
 * WhatsApp que siguen nuevos o esperando la decisión entre 30 minutos y 6 horas reciben UN aviso en su grupo. El renglón del
 * historial va aunque el aviso no salga (sin grupo, Evolution caída): /tickets dice el estado, y reintentar cada 15 minutos sería
 * ruido. Devuelve cuántos salieron.
 */
export async function avisarDelegadosSinTomar(ahoraMs = Date.now()): Promise<number> {
  const db = getSupabaseServer();
  const desde = new Date(ahoraMs - HORAS_MAX_SIN_TOMAR * 3600_000).toISOString();
  const hasta = new Date(ahoraMs - MIN_SIN_TOMAR * 60_000).toISOString();
  const { data, error } = await db.from(T).select('id, workspace_id, titulo, estado, created_at, canal, contexto')
    .in('estado', ['nuevo', 'esperando_decision']).eq('canal', 'whatsapp').gte('created_at', desde).lte('created_at', hasta)
    .order('created_at', { ascending: true }).limit(50);
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as DelegadoSinTomar[];
  if (!filas.length) return 0;
  const { data: ev, error: eEv } = await db.from('ticket_eventos').select('ticket_id').in('ticket_id', filas.map((f) => f.id)).eq('tipo', TIPO_DEMORA_AVISADA);
  // Sin poder leer a quién ya se avisó, no se avisa: mejor ninguno que uno repetido cada 15 minutos.
  if (eEv) throw new Error(eEv.message);
  const avisados = new Set((ev ?? []).map((e) => Number(e.ticket_id)));
  let salieron = 0;
  for (const f of delegadosParaAvisar(filas, avisados, ahoraMs)) {
    const { enviarAlGrupoMaKo } = await import('./mako-grupo');
    const r = await enviarAlGrupoMaKo(Number(f.workspace_id), textoDelegadoSinTomar(f.id, f.titulo), { de: 'equipo', ticket: f.id })
      .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
    await db.from('ticket_eventos').insert({
      ticket_id: f.id, actor: 'sistema', tipo: TIPO_DEMORA_AVISADA,
      texto: r.ok ? 'Sin tomar a los 30 minutos: se le avisó en su grupo.' : `Sin tomar a los 30 minutos: el aviso no salió (${'error' in r ? String(r.error).slice(0, 160) : 'sin detalle'}).`,
      datos: null,
    });
    if (r.ok) salieron++;
  }
  return salieron;
}

/**
 * Lo que salió en ESTE build para los tickets `ids` del negocio `ws`, con sus puntos: lo lee el turno del grupo
 * (`PedidoDelNegocio.desplegado`). Sólo los hitos cuyos tickets son TODOS de ese negocio (A1 de la revisión de privacidad,
 * `hitosDelNegocio`): de quién son los que nombran se lee de la base, y sin poder leerlo tira (el turno sigue sin hitos).
 */
export async function hitosDesplegadosDelNegocio(ws: number, ids: readonly number[]): Promise<Map<number, { titulo: string; puntos: string[] }>> {
  const hitos = hitosDeLosTickets(REGISTROS_SLUGS.map((slug) => ({ bitacora: registroDe(slug).bitacora })));
  const nombrados = ticketsQueNombran(hitos, ids);
  if (!nombrados.length) return new Map();
  return hitosDelNegocio(hitos, ids, await ticketsDelNegocioEntre(ws, nombrados));
}

/**
 * Lo que cierra el deploy: todo ticket ABIERTO, espere a quien espere. Hasta el 29/10/2026 eran sólo `en_curso` y `arreglado`,
 * y el #15 (Video Editor de Leila) siguió «esperando la decisión» con su arreglo en producción: Martín pidió que todo ticket se
 * lea y se implemente sin esperarlo (27/10), así que el hito puede llegar antes que la decisión. Uno cerrado no se reabre.
 */
export const ESTADOS_QUE_CIERRA_EL_DEPLOY = ['nuevo', 'esperando_decision', 'esperando_cliente', 'en_curso', 'arreglado'] as const;

/**
 * Cierra los tickets abiertos cuyo arreglo ya está en el código que corre, y sus duplicados. Compare-and-set sobre el
 * estado: dos crons a la vez no cierran dos veces. Devuelve los ids cerrados.
 *
 * ⚠️ «DESPLEGADO» NO SIEMPRE ES «LE ANDA AL CLIENTE» (13/11/2026, el #93 de Mauricio). Su arreglo necesitaba además prender su
 * email, su tope y sus columnas EN PRODUCCIÓN, con el sí de Martín, después del deploy. El hito llegó con `tickets: [93]`, el
 * cron lo cerró a las 18:45 UTC y a las 18:46 le dijo «Arreglamos… Ya anda» con el email apagado. Un hito con
 * `faltaEnProduccion` no cierra: deja UNA vez en el historial qué falta, y espera a que alguien marque el paso hecho
 * (`scripts/tickets.ts paso-hecho <n>`, un renglón `TIPO_PASO_HECHO`). El cron siguiente lo cierra y avisa como siempre.
 */
export async function cerrarLosDesplegados(desplegados = ticketsDesplegados()): Promise<number[]> {
  if (!desplegados.size) return [];
  const db = getSupabaseServer();
  const ids = [...desplegados.keys()];
  const { data, error } = await db.from(T).select('id, respuesta').in('id', ids).in('estado', [...ESTADOS_QUE_CIERRA_EL_DEPLOY]);
  if (error) throw new Error(`no pude leer los tickets abiertos: ${error.message}`);
  const cerrados: number[] = [];
  const ahora = new Date().toISOString();
  const pasos = await pasosEnProduccion((data ?? []).map((f) => Number(f.id)).filter((id) => desplegados.get(id)?.falta));
  for (const f of data ?? []) {
    const id = Number(f.id);
    const hito = desplegados.get(id)!;
    if (!loCierraElDeploy(hito, pasos.hechos.has(id))) {
      if (!pasos.anotados.has(id)) {
        await db.from('ticket_eventos').insert({ ticket_id: id, actor: 'sistema', tipo: TIPO_FALTA_EN_PRODUCCION, texto: `En producción: ${hito.titulo}. Falta antes de avisarle: ${hito.falta}`.slice(0, 2000), datos: null });
      }
      continue;
    }
    const respuesta = (f.respuesta as string | null) || `Ya está arreglado: ${hito.titulo}.`;
    const { data: ok } = await db.from(T).update({ estado: 'resuelto', resuelto_at: ahora, respuesta: respuesta.slice(0, 2000), avisado_at: null, updated_at: ahora })
      .eq('id', id).in('estado', [...ESTADOS_QUE_CIERRA_EL_DEPLOY]).select('id');
    if (!ok?.length) continue;
    cerrados.push(id);
    await anotarDelCerebro(id, `En producción: ${hito.titulo}`, 'sistema');
    // Los duplicados se resuelven con él: Linear mueve al que lo pidió al original; acá se le avisa a cada uno.
    const { data: dups } = await db.from(T).update({ estado: 'resuelto', resuelto_at: ahora, respuesta: `Se resolvió junto con el ticket #${id}: ${hito.titulo}.`, avisado_at: null, updated_at: ahora })
      .eq('duplicado_de', id).neq('estado', 'resuelto').select('id');
    for (const d of dups ?? []) await anotarDelCerebro(Number(d.id), `Resuelto con #${id}`, 'sistema');
  }
  return cerrados;
}

/**
 * De los tickets con un paso en producción pendiente: cuáles ya lo tienen marcado HECHO y a cuáles ya se les anotó qué falta.
 * Sin poder leerlo, ninguno está hecho (un «ya anda» falso no se deshace: mejor esperar 15 minutos) y todos anotados (no se
 * repite el renglón cada 15 minutos).
 */
async function pasosEnProduccion(ids: readonly number[]): Promise<{ hechos: Set<number>; anotados: Set<number> }> {
  if (!ids.length) return { hechos: new Set(), anotados: new Set() };
  const { data, error } = await getSupabaseServer().from('ticket_eventos').select('ticket_id, tipo')
    .in('ticket_id', [...ids]).in('tipo', [TIPO_PASO_HECHO, TIPO_FALTA_EN_PRODUCCION]);
  if (error) {
    console.error(`[tickets] no pude leer los pasos en producción de ${ids.map((i) => `#${i}`).join(', ')}: ${error.message}`);
    return { hechos: new Set(), anotados: new Set(ids) };
  }
  const de = (tipo: string) => new Set((data ?? []).filter((e) => e.tipo === tipo).map((e) => Number(e.ticket_id)));
  return { hechos: de(TIPO_PASO_HECHO), anotados: de(TIPO_FALTA_EN_PRODUCCION) };
}

type FilaAviso = AvisoCliente & { workspace_id: number; usuario_id: number | null; canal: string; contexto: { chat?: { hilo?: string } } | null };

/** Lo que falta avisarle a algún cliente: cerrados, resueltos o con una pregunta del equipo, sin `avisado_at`. */
export async function avisarPendientes(tope = 30): Promise<{ avisados: number; fallidos: number }> {
  const { data, error } = await getSupabaseServer().from(T)
    .select('id, titulo, estado, respuesta, duplicado_de, workspace_id, usuario_id, canal, contexto')
    .is('avisado_at', null).in('estado', ['resuelto', 'rechazado', 'duplicado', 'esperando_cliente'])
    .order('updated_at').limit(tope);
  if (error) throw new Error(`no pude leer los avisos: ${error.message}`);
  let avisados = 0, fallidos = 0;
  // Lo que trae ESTE build: es la prueba de que un arreglo está en producción (el aviso al grupo la exige).
  const desplegados = ticketsDesplegados();
  for (const f of (data ?? []) as FilaAviso[]) {
    const r = await avisarUno(f, desplegados);
    if (r) avisados++; else fallidos++;
  }
  return { avisados, fallidos };
}

/** Avisa UN ticket por id (lo llama la decisión de Martín, para no esperar al cron). */
export async function avisarTicket(id: number): Promise<boolean> {
  const { data } = await getSupabaseServer().from(T)
    .select('id, titulo, estado, respuesta, duplicado_de, workspace_id, usuario_id, canal, contexto, avisado_at')
    .eq('id', id).maybeSingle();
  if (!data || data.avisado_at) return false;
  if (!['resuelto', 'rechazado', 'duplicado', 'esperando_cliente'].includes(data.estado as string)) return false;
  return avisarUno(data as FilaAviso, ticketsDesplegados());
}

/**
 * Le avisa a un cliente por los canales que corresponden y marca `avisado_at` si salió por ALGUNO. Si no salió por
 * ninguno, queda sin marcar y el cron lo reintenta; /tickets ya dice el estado.
 */
async function avisarUno(f: FilaAviso, desplegados: Map<number, HitoDeTicket>): Promise<boolean> {
  const texto = textoDelAviso(f);
  const ws = Number(f.workspace_id);
  const salio: string[] = [];
  // Un push a SU teléfono (es lo único de MaKo que llega a una persona y no a todo el negocio).
  if (f.usuario_id) {
    try {
      const { enviarPushAUsuario } = await import('./push');
      const r = await enviarPushAUsuario(Number(f.usuario_id), ws, { tipo: 'ticket', titulo: `Tu ticket #${f.id}`, cuerpo: texto, ruta: `/tickets?t=${f.id}`, tag: `ticket-${f.id}` });
      if (r.enviados > 0) salio.push('push');
    } catch (e) { console.error(`[tickets] push de #${f.id}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  // Por donde lo levantó.
  const hilo = f.contexto?.chat?.hilo ?? '';
  if ((f.canal === 'chat_app' || f.canal === 'chat_movil' || f.canal === 'sistema') && /^\d{1,12}$/.test(hilo)) {
    try {
      const { appendMessage } = await import('./chart-chats');
      await runWithWorkspace(ws, () => appendMessage(Number(hilo), 'assistant', texto));
      salio.push('chat');
    } catch (e) { console.error(`[tickets] chat de #${f.id}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  if (f.canal === 'whatsapp') {
    try {
      // Por el MISMO saneo de salida que el doer (lib/doer-salida.ts; lo pidió el chat «MaKo en WhatsApp»): lo libre del
      // aviso es la respuesta de Martín o la nota del arreglo. `corrioHerramientas: true` porque el aviso ES el resultado
      // de algo hecho (el cierre): «te avisamos cuando esté» de un duplicado lo cumple el código, no es una promesa suelta.
      const { sanearSalida } = await import('./doer-salida');
      const { enviarAlGrupoMaKo } = await import('./mako-grupo');
      // Es la respuesta del EQUIPO a su ticket: al anillo del equipo, no como turno de MaKo (lib/doer-equipo.ts).
      // Con su ticket: si la persona le contesta en el grupo, va a ESE ticket (lib/doer-equipo.ts, `respuestaAlEquipo`).
      const r = await enviarAlGrupoMaKo(ws, sanearSalida(texto, { corrioHerramientas: true }).texto, { de: 'equipo', ticket: Number(f.id) });
      if (r.ok) salio.push('whatsapp');
    } catch (e) { console.error(`[tickets] WhatsApp de #${f.id}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  // Un error que la app vio sola (lib/errores-app.ts): cuando está ARREGLADO Y DESPLEGADO, a cada negocio que lo vio se le
  // avisa en su grupo con `avisarArregloAlGrupo` (lib/aviso-arreglo.ts, de «MaKo en WhatsApp»: pone la firma del equipo,
  // un aviso por arreglo y por negocio, tope por día). Es una función de lib y no una operación del registro, para
  // que ni un modelo ni una automatización de un cliente puedan firmar como el equipo.
  // ⚠️ SÓLO CON PRUEBA: la función no puede verificar producción. La prueba es que ESTE build trae el hito con
  // `tickets: [n]` (el del ticket, o el de su original si es un duplicado). Un ticket del sistema «resuelto» por otra cosa
  // (Martín lo contestó) no tiene arreglo desplegado: no se le avisa a ningún grupo.
  // ⚠️ El ws1 es de Mauricio, un cliente: va con `ws1Seguro` sólo porque está en la lista de afectados de verdad.
  if (f.canal === 'sistema') {
    const hito = f.estado === 'resuelto' ? (desplegados.get(f.id) ?? (f.duplicado_de ? desplegados.get(f.duplicado_de) : undefined)) : undefined;
    if (hito) {
      try {
        const { negociosAfectados } = await import('./errores-app');
        const { avisarArregloAlGrupo } = await import('./aviso-arreglo');
        const plataforma = await wsSuperAdmin();
        const negocios = new Set([...(await negociosAfectados(f.id)), ...(ws !== plataforma ? [ws] : [])]);
        const prueba = pruebaDeProduccion({ ticket: f.id, hito: hito.titulo, area: hito.area, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null, deploy: process.env.VERCEL_URL ?? null });
        for (const n of negocios) {
          const r = await avisarArregloAlGrupo({ ws: n, clave: `ticket:${f.id}`, texto: textoArregloAlGrupo(f), prueba, origen: 'ticketera', ws1Seguro: n === 1 });
          if (r.ok) salio.push(`grupo de ws ${n}`);
          else if (r.motivo !== 'ya-avisado') console.error(`[tickets] aviso al grupo de ws ${n} por #${f.id}: ${r.motivo} — ${r.detalle}`);
        }
      } catch (e) { console.error(`[tickets] aviso al grupo de #${f.id}: ${e instanceof Error ? e.message : String(e)}`); }
    }
    // Lo vea o no un cliente, el ticket del sistema ya está en /tickets y en la bandeja: no se reintenta para siempre.
    if (!salio.length) salio.push('tickets');
  }
  // Un negocio con la regla de Martín (Leandro, 26/10/2026: «tú después le tienes que ir avisando... por el grupo de WhatsApp de
  // MaKo los tickets que ya van siendo resueltos»): ARREGLADO Y DESPLEGADO, el aviso va a su grupo por el camino del equipo
  // (`avisarArregloAlGrupo`), con la MISMA prueba que exige (el hito de ESTE build con `tickets: [n]`). Por WhatsApp ya salió
  // arriba (`enviarAlGrupoMaKo`): no se repite.
  if (aprobadoPorRegla(ws) && f.canal !== 'sistema' && f.canal !== 'whatsapp' && f.estado === 'resuelto') {
    const hito = desplegados.get(f.id) ?? (f.duplicado_de ? desplegados.get(f.duplicado_de) : undefined);
    if (hito) {
      try {
        const { avisarArregloAlGrupo } = await import('./aviso-arreglo');
        const prueba = pruebaDeProduccion({ ticket: f.id, hito: hito.titulo, area: hito.area, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null, deploy: process.env.VERCEL_URL ?? null });
        // El ws 1 (Mauricio) va con `ws1Seguro`: es SU ticket y SU grupo (27/10/2026, MAU-09), no una lista que se arma sola.
        const r = await avisarArregloAlGrupo({ ws, clave: `ticket:${f.id}`, texto: textoArregloAlGrupo(f), prueba, origen: 'ticketera', ws1Seguro: ws === 1 });
        if (r.ok) salio.push(`grupo de ws ${ws}`);
        else if (r.motivo !== 'ya-avisado') console.error(`[tickets] aviso al grupo de ws ${ws} por #${f.id}: ${r.motivo} — ${r.detalle}`);
      } catch (e) { console.error(`[tickets] aviso al grupo de #${f.id}: ${e instanceof Error ? e.message : String(e)}`); }
    }
  }
  // Por el formulario no hay canal de vuelta más que /tickets: el estado ya está ahí, y eso cuenta como avisado.
  if (f.canal === 'formulario' || f.canal === 'api') salio.push('tickets');
  // El chat de Soporte (23/10/2026, app/tickets/soporte/) levanta con canal de chat y SIN hilo: su conversación ES /tickets, donde
  // ya está la respuesta. Sin esto, sin push nunca quedaba avisado, y 30 así llenaban la ventana de `avisarPendientes` (los 30
  // más viejos sin avisar): el cron dejaba de mandar TODOS los avisos (la revisión de Integración, 23/10/2026).
  if ((f.canal === 'chat_app' || f.canal === 'chat_movil') && !/^\d{1,12}$/.test(hilo)) salio.push('tickets');
  if (!salio.length) return false;
  const ahora = new Date().toISOString();
  await getSupabaseServer().from(T).update({ avisado_at: ahora }).eq('id', f.id);
  await anotarDelCerebro(f.id, `Aviso al cliente: ${salio.join(', ')}`, 'sistema');
  return true;
}
