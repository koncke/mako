// =============================================================================
// propuestas — lo que un canal PROPONE escribir, hasta que una persona confirma
// =============================================================================
// LA REGLA, y vale para todo canal nuevo: nada que venga de Claude, de WhatsApp o de
// una automatización escribe directo en los datos del cliente. Deja una propuesta acá
// y devuelve UN LINK a una pantalla de MaKo donde se mira, se corrige y se confirma.
//
// Ya funcionaba así el plan (`plan_propuestas` → /plan/revisar) y funcionaba bien. Lo
// que faltaba era que fuera LA regla y no la costumbre de un módulo: cuando se agregó
// el alta de leads del agente, escribió directo — no porque alguien decidiera saltear
// la revisión, sino porque no había ningún lugar del que salga sola.
//
// EL PORQUÉ ESTÁ PAGADO. AGENTS.md lo tiene escrito desde el link de los borradores:
// «un DATO EXACTO que pasa por las manos de un LLM deja de ser exacto». Un teléfono con
// un dígito cambiado entra al CRM, no matchea su chat de WhatsApp ni su Calendly, y no
// se nota hasta que falta una conversación. La confirmación no es burocracia: es el
// único momento en que un humano ve el dato antes de que valga.
//
// Este módulo es GENÉRICO a propósito: guarda `tipo` + `datos`, y quién aplica cada
// tipo vive donde vive ese dominio. Una tabla por área garantizaba que la tercera
// también fuera propia y que cada una reinventara estado e idempotencia.
// =============================================================================

import 'server-only';
import { getTenantDb, runWithWorkspace, getWorkspace } from './workspace';
import { getSupabaseServer } from './supabase';

export type TipoPropuesta = 'lead';
export type EstadoPropuesta = 'pendiente' | 'aplicada' | 'descartada';

export type Propuesta = {
  id: string;
  tipo: TipoPropuesta;
  estado: EstadoPropuesta;
  origen: string | null;
  resumen: string;
  datos: Record<string, unknown>;
  resultado: Record<string, unknown> | null;
  createdAt: string;
};

/** Id corto y estable. Viaja en una URL que alguien puede pegar en un chat, así que no
 *  puede llevar caracteres que se rompan al copiar. */
const nuevoId = () => `prop${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

function aPropuesta(r: Record<string, unknown>): Propuesta {
  return {
    id: str(r.id),
    tipo: str(r.tipo, 'lead') as TipoPropuesta,
    estado: str(r.estado, 'pendiente') as EstadoPropuesta,
    origen: r.origen ? str(r.origen) : null,
    resumen: str(r.resumen),
    datos: (r.datos ?? {}) as Record<string, unknown>,
    resultado: (r.resultado ?? null) as Record<string, unknown> | null,
    createdAt: str(r.created_at),
  };
}

/**
 * Deja una propuesta y devuelve su id.
 *
 * `ref` es la llave de idempotencia DEL EMISOR: si ya hay una propuesta con esa ref en
 * el workspace, se devuelve aquélla en vez de crear otra. Un formulario de landing
 * dispara dos veces con mala conexión y un Apps Script reintenta; sin esto el dueño ve
 * dos tarjetas del mismo lead y confirma un duplicado creyendo que son dos personas.
 */
export async function crearPropuesta(input: {
  ws: number;
  tipo: TipoPropuesta;
  datos: Record<string, unknown>;
  resumen?: string;
  origen?: string;
  ref?: string | null;
}): Promise<{ id: string; nueva: boolean }> {
  return runWithWorkspace(input.ws, async () => {
    const db = await getTenantDb();
    const ref = input.ref?.trim().slice(0, 200) || null;

    if (ref) {
      const { data } = await db.from('propuestas').select('id, estado').eq('ref', ref).maybeSingle();
      if (data) return { id: str((data as Record<string, unknown>).id), nueva: false };
    }

    const id = nuevoId();
    const { error } = await db.from('propuestas').insert({
      id,
      tipo: input.tipo,
      estado: 'pendiente',
      origen: input.origen?.slice(0, 60) ?? null,
      resumen: (input.resumen ?? '').slice(0, 300),
      datos: input.datos,
      ref,
    });
    if (error) throw new Error(`crearPropuesta: ${error.message}`);
    return { id, nueva: true };
  });
}

/** Una propuesta por id. `null` si no existe en ESTE workspace — el scope lo pone
 *  `getTenantDb`, así que pedir el id de otro cliente no devuelve nada. */
export async function getPropuesta(id: string): Promise<Propuesta | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('propuestas').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`getPropuesta: ${error.message}`);
  return data ? aPropuesta(data as Record<string, unknown>) : null;
}

/**
 * Marca una propuesta como aplicada y guarda QUÉ se creó.
 *
 * ⚠️ El `.eq('estado', 'pendiente')` no es decoración: es lo que hace que confirmar dos
 * veces —dos pestañas, un doble click, un reintento— cree UNA sola cosa. Devuelve
 * `false` si ya no estaba pendiente, y el que llama tiene que tratar eso como «ya
 * estaba hecho», no como un error.
 */
export async function marcarAplicada(id: string, resultado: Record<string, unknown>): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('propuestas')
    .update({ estado: 'aplicada', applied_at: new Date().toISOString(), resultado })
    .eq('id', id)
    .eq('estado', 'pendiente')
    .select('id');
  if (error) throw new Error(`marcarAplicada: ${error.message}`);
  return (data ?? []).length > 0;
}

/** Descartar NO borra: la fila queda con su estado. Es la misma regla que el plan —
 *  descartar es una decisión y borrarla haría que el mismo lead vuelva a proponerse. */
export async function descartarPropuesta(id: string): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('propuestas').update({ estado: 'descartada' }).eq('id', id).eq('estado', 'pendiente');
  if (error) throw new Error(`descartarPropuesta: ${error.message}`);
}

/** Las pendientes, para una bandeja. */
export async function propuestasPendientes(tipo?: TipoPropuesta): Promise<Propuesta[]> {
  const db = await getTenantDb();
  let q = db.from('propuestas').select('*').eq('estado', 'pendiente').order('created_at', { ascending: false }).limit(100);
  if (tipo) q = q.eq('tipo', tipo);
  const { data, error } = await q;
  if (error) throw new Error(`propuestasPendientes: ${error.message}`);
  return (data ?? []).map((r) => aPropuesta(r as Record<string, unknown>));
}

/**
 * De quién es una propuesta, SIN scope de workspace.
 *
 * Existe para contestar bien el caso «abrí el link con otra cuenta»: sin esto la
 * pantalla solo sabe que `getPropuesta` devolvió null, y no puede distinguir «el link
 * está mal escrito» de «esto es de otro cliente». Las dos cosas se resuelven distinto y
 * la primera es un callejón sin salida.
 *
 * ⚠️ Devuelve el DUEÑO, nunca el contenido. Quién es el dueño es lo mínimo para explicar
 * el aislamiento; los datos del lead siguen del lado del server, scopeados.
 */
export async function duenoDePropuesta(id: string): Promise<{ workspaceId: number; nombre: string } | null> {
  const limpio = (id ?? '').trim().slice(0, 80);
  if (!limpio) return null;
  const { data } = await getSupabaseServer().from('propuestas').select('workspace_id').eq('id', limpio).maybeSingle();
  const ws = Number((data as { workspace_id?: unknown } | null)?.workspace_id);
  if (!Number.isFinite(ws)) return null;
  const w = await getWorkspace(ws).catch(() => null);
  return { workspaceId: ws, nombre: (w?.nombre ?? '').trim() || `workspace ${ws}` };
}
