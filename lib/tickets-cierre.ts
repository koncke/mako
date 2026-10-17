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
import { runWithWorkspace } from './workspace';
import { REGISTROS_SLUGS, registroDe } from '@/app/admin/dev/registros';
import { anotarDelCerebro } from './tickets-db';
import { textoDelAviso, ticketsDeHitos, type AvisoCliente } from './tickets-reglas';

const T = 'tickets';

export type HitoDeTicket = { area: string; titulo: string };

/** Los tickets que nombra alguna bitácora DESPLEGADA (la de este build), con el hito que los arregla. */
export function ticketsDesplegados(): Map<number, HitoDeTicket> {
  return ticketsDeHitos(REGISTROS_SLUGS.map((slug) => ({ area: slug, bitacora: registroDe(slug).bitacora })));
}

/**
 * Cierra los tickets en curso cuyo arreglo ya está en el código que corre, y sus duplicados. Compare-and-set sobre el
 * estado: dos crons a la vez no cierran dos veces. Devuelve los ids cerrados.
 */
export async function cerrarLosDesplegados(desplegados = ticketsDesplegados()): Promise<number[]> {
  if (!desplegados.size) return [];
  const db = getSupabaseServer();
  const ids = [...desplegados.keys()];
  const { data, error } = await db.from(T).select('id, respuesta').in('id', ids).in('estado', ['en_curso', 'arreglado']);
  if (error) throw new Error(`no pude leer los tickets en curso: ${error.message}`);
  const cerrados: number[] = [];
  const ahora = new Date().toISOString();
  for (const f of data ?? []) {
    const id = Number(f.id);
    const hito = desplegados.get(id)!;
    const respuesta = (f.respuesta as string | null) || `Ya está arreglado: ${hito.titulo}.`;
    const { data: ok } = await db.from(T).update({ estado: 'resuelto', resuelto_at: ahora, respuesta: respuesta.slice(0, 2000), avisado_at: null, updated_at: ahora })
      .eq('id', id).in('estado', ['en_curso', 'arreglado']).select('id');
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

type FilaAviso = AvisoCliente & { workspace_id: number; usuario_id: number | null; canal: string; contexto: { chat?: { hilo?: string } } | null };

/** Lo que falta avisarle a algún cliente: cerrados, resueltos o con una pregunta del equipo, sin `avisado_at`. */
export async function avisarPendientes(tope = 30): Promise<{ avisados: number; fallidos: number }> {
  const { data, error } = await getSupabaseServer().from(T)
    .select('id, titulo, estado, respuesta, duplicado_de, workspace_id, usuario_id, canal, contexto')
    .is('avisado_at', null).in('estado', ['resuelto', 'rechazado', 'duplicado', 'esperando_cliente'])
    .order('updated_at').limit(tope);
  if (error) throw new Error(`no pude leer los avisos: ${error.message}`);
  let avisados = 0, fallidos = 0;
  for (const f of (data ?? []) as FilaAviso[]) {
    const r = await avisarUno(f);
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
  return avisarUno(data as FilaAviso);
}

/**
 * Le avisa a un cliente por los canales que corresponden y marca `avisado_at` si salió por ALGUNO. Si no salió por
 * ninguno, queda sin marcar y el cron lo reintenta; /tickets ya dice el estado.
 */
async function avisarUno(f: FilaAviso): Promise<boolean> {
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
  if ((f.canal === 'chat_app' || f.canal === 'chat_movil') && /^\d{1,12}$/.test(hilo)) {
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
      const r = await enviarAlGrupoMaKo(ws, sanearSalida(texto, { corrioHerramientas: true }).texto);
      if (r.ok) salio.push('whatsapp');
    } catch (e) { console.error(`[tickets] WhatsApp de #${f.id}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  // Por el formulario no hay canal de vuelta más que /tickets: el estado ya está ahí, y eso cuenta como avisado.
  if (f.canal === 'formulario' || f.canal === 'api') salio.push('tickets');
  if (!salio.length) return false;
  const ahora = new Date().toISOString();
  await getSupabaseServer().from(T).update({ avisado_at: ahora }).eq('id', f.id);
  await anotarDelCerebro(f.id, `Aviso al cliente: ${salio.join(', ')}`, 'sistema');
  return true;
}
