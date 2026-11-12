// =============================================================================
// mako-doer-conv — memoria de conversación del doer por grupo (mig 0086)
// =============================================================================
// Guarda cada turno (dueño y MaKo) por grupo y devuelve el historial reciente para
// re-inyectarlo como contexto en cada respuesta. Sin esto, MaKo arranca de cero en
// cada mensaje (era la queja: "no guarda los mensajes anteriores"). Tenant-scoped.

import 'server-only';
import { getTenantDb, runWithWorkspace } from '@/lib/workspace';
import { palabrasDeBusqueda, partirMemoria } from '@/lib/doer-hilo';
import type { FilaDeMemoria } from '@/lib/hilo-real';

export type TurnoConv = { role: 'user' | 'assistant'; content: string };

/** Guarda un turno de la conversación de un grupo. */
export async function guardarTurno(ws: number, grupoJid: string, role: 'user' | 'assistant', content: string, waMessageId?: string): Promise<void> {
  if (!content.trim()) return;
  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { error } = await db.from('mako_doer_conv').insert({ grupo_jid: grupoJid, role, content, wa_message_id: waMessageId ?? null });
    if (error) console.error('[mako-doer-conv] guardar:', error.message);
  });
}

// Cuánto para atrás mira MaKo. Sin corte, un "sí, dale" se pegaba a la última cosa
// que hubiera en la tabla AUNQUE FUERA DE HACE CUATRO DÍAS: pasó de verdad — Martín
// contestó "sí cargalo" a una pregunta de esa tarde y MaKo confirmó una charla del 26
// de julio, duplicando dos tareas que ya estaban en el board. Una conversación de
// WhatsApp de hace dos días no es contexto: es ruido.
// Bajado de 48 a 14 el 12/8. El propio comentario de arriba ya decía que una
// charla de hace dos días es ruido, y la ventana seguía en dos días: MaKo
// contestó un pedido nuevo con material de 33 h antes (ver lib/mako-intencion.ts).
// 14 h cubre lo que importa —la charla de hoy, y la de anoche a la mañana
// siguiente— sin arrastrar anteayer. La marca de CONTEXTO en mako-doer-in.ts es
// la otra mitad: acota QUÉ ES el historial; esto acota CUÁNTO.
const HORAS_CONTEXTO = 14;

/** Historial reciente de un grupo (los últimos `limite` turnos, en orden cronológico). */
export async function historialGrupo(ws: number, grupoJid: string, limite = 24): Promise<TurnoConv[]> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const desde = new Date(Date.now() - HORAS_CONTEXTO * 3600_000).toISOString();
    const { data } = await db.from('mako_doer_conv')
      .select('role, content, created_at')
      .eq('grupo_jid', grupoJid)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(limite);
    const rows = ((data ?? []) as Array<{ role: string; content: string }>).reverse();
    return rows.map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content } as TurnoConv));
  });
}

/** Cuándo habló MaKo por última vez en el grupo (su último turno 'assistant'), o null. Tira si no se pudo leer. */
export async function ultimaDeMaKo(ws: number, grupoJid: string): Promise<string | null> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data, error } = await db.from('mako_doer_conv').select('created_at')
      .eq('grupo_jid', grupoJid).eq('role', 'assistant').order('created_at', { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    return (data?.[0] as { created_at?: string } | undefined)?.created_at ?? null;
  });
}

export type FilaConv = { role: 'user' | 'assistant'; content: string; created_at: string };

/**
 * El texto de un mensaje de ESTE grupo por su id de WhatsApp (ticket #40): lo que MaKo guardó cuando la cita no trae el texto.
 * Sin fecha: citar un mensaje de hace 10 días es justo el caso. null si no está; tira si la base no contesta.
 */
export async function textoPorIdDeWhatsApp(ws: number, grupoJid: string, waMessageId: string): Promise<string | null> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data, error } = await db.from('mako_doer_conv').select('content')
      .eq('grupo_jid', grupoJid).eq('wa_message_id', waMessageId).order('created_at', { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    return (data?.[0] as { content?: string } | undefined)?.content ?? null;
  });
}

/**
 * Busca en lo guardado de ESTE grupo (ticket #40, `buscar_en_el_grupo`): las filas con TODAS las palabras, de la más nueva a la
 * más vieja. Sin fecha. Estricto, como `hiloDelGrupo`: si la base no contesta, tira; un «no encontré» tiene que ser verdad.
 */
export async function buscarEnElGrupo(ws: number, grupoJid: string, texto: string, limite = 12): Promise<FilaConv[]> {
  const palabras = palabrasDeBusqueda(texto);
  if (!palabras.length) return [];
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    let q = db.from('mako_doer_conv').select('role, content, created_at').eq('grupo_jid', grupoJid);
    for (const p of palabras) q = q.ilike('content', `%${p}%`);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(limite);
    if (error) throw new Error(`buscarEnElGrupo falló: ${error.message}`);
    return ((data ?? []) as Array<{ role: string; content: string; created_at: string }>)
      .map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content, created_at: r.created_at }));
  });
}

/**
 * LA MEMORIA DEL GRUPO PARA UN TURNO (26/10/2026, lib/doer-hilo.ts): la charla reciente como TURNOS (los últimos `turnos` de
 * las últimas 14 h, lo mismo que `historialGrupo`) y lo de antes —lo que quedó afuera por la hora o por la cantidad, hasta
 * `dias` atrás— como FILAS con su fecha, que el doer vuelve HECHOS en el system (`bloqueYaSeHablo`), nunca turnos: con
 * turnos viejos, un «sí, cargalo» se pegaba a una charla de cuatro días antes (el 26/07). Una consulta. Si la base no
 * contesta, las dos vacías: el turno sigue como si fuera la primera vez, como siempre.
 */
export async function memoriaDelGrupo(
  ws: number, grupoJid: string, { turnos = 12, dias = 7, antesMax = 60 }: { turnos?: number; dias?: number; antesMax?: number } = {},
): Promise<{ reciente: TurnoConv[]; antes: FilaConv[]; recienteFilas: FilaDeMemoria[] }> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
    const { data, error } = await db.from('mako_doer_conv')
      .select('role, content, created_at, wa_message_id')
      .eq('grupo_jid', grupoJid)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(turnos + antesMax);
    if (error) { console.error('[mako-doer-conv] memoria:', error.message); return { reciente: [], antes: [], recienteFilas: [] }; }
    const crudas = (data ?? []) as Array<{ role: string; content: string; created_at: string; wa_message_id?: string | null }>;
    const filas = crudas.map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content, created_at: r.created_at } as FilaConv));
    // Las mismas de `reciente`, con su hora y su id: con ellas el turno funde el chat de verdad (lib/hilo-real.ts, 11/11/2026).
    const corte = Date.now() - HORAS_CONTEXTO * 3600_000;
    const recienteFilas: FilaDeMemoria[] = crudas.filter((r) => Date.parse(r.created_at) >= corte).slice(0, turnos).reverse()
      .map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content, created_at: r.created_at, wa_message_id: r.wa_message_id ?? null }));
    return { ...partirMemoria(filas, Date.now(), { turnos, horas: HORAS_CONTEXTO }), recienteFilas };
  });
}

/**
 * El hilo de un grupo para LEERLO en pantalla (el Second Brain, tanda 8 de docs/diseno-mako-ai-native.md, 16/10/2026),
 * por páginas: los `limite` anteriores a `antes`, en orden cronológico, y si hay más atrás.
 * ⚠️ NO ES `historialGrupo`: ése es el CONTEXTO del modelo (14 h, 24 turnos) y no mira el error. Éste es estricto: si la
 *    base no contesta, tira, porque una lista vacía en pantalla diría «no hay mensajes».
 */
export async function hiloDelGrupo(
  ws: number, grupoJid: string, { antes = null, limite = 60 }: { antes?: string | null; limite?: number } = {},
): Promise<{ filas: FilaConv[]; hayMas: boolean }> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    let q = db.from('mako_doer_conv').select('role, content, created_at').eq('grupo_jid', grupoJid);
    if (antes) q = q.lt('created_at', antes);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(limite + 1);
    if (error) throw new Error(`hiloDelGrupo falló: ${error.message}`);
    const rows = (data ?? []) as Array<{ role: string; content: string; created_at: string }>;
    return {
      filas: rows.slice(0, limite).reverse().map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content, created_at: r.created_at })),
      hayMas: rows.length > limite,
    };
  });
}
