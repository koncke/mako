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

/** `accion` = una acción genérica del registro de la API (lib/api-mako) esperando
 *  confirmación en /mako/revisar/<id>; `datos` = { operacion, payload, resumen, canal }. */
export type TipoPropuesta = 'lead' | 'accion';
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

    // ⚠️ EL ESTADO SE MIRA. Antes se leía (`select('id, estado')`) y no se usaba
    // para nada: cualquier fila con esa `ref` bloqueaba, incluida una DESCARTADA.
    //
    // Y descartar no significa «esta persona no existe»: significa «esto no era
    // un lead» o «me equivoqué». Si mañana la misma persona vuelve a completar el
    // formulario, eso es intención NUEVA y tiene que poder revisarse — con el
    // código viejo no volvía a entrar nunca más, en silencio y para siempre.
    //
    // Las otras dos sí bloquean, y por razones distintas:
    //   · 'pendiente' → ya está esperando; proponerla de nuevo duplica la fila.
    //   · 'aplicada'  → el lead YA está en el CRM; re-proponerlo lo duplicaría.
    let refFinal = ref;
    if (ref) {
      const { data } = await db.from('propuestas').select('id, estado').eq('ref', ref).maybeSingle();
      const estado = data ? str((data as Record<string, unknown>).estado) : null;
      if (data && estado !== 'descartada') return { id: str((data as Record<string, unknown>).id), nueva: false };
      // Descartada: entra de nuevo, con una `ref` propia para no chocar con la
      // vieja. El día en la llave mantiene la idempotencia donde hace falta —dos
      // submits seguidos siguen siendo uno— sin encadenar a esa persona a una
      // decisión que se tomó hace un mes.
      if (data) {
        refFinal = `${ref}:${new Date().toISOString().slice(0, 10)}`.slice(0, 200);
        // Y la llave del día también se consulta, o el SEGUNDO submit del mismo
        // día chocaría contra el unique de `ref` — la idempotencia se rompería
        // justo en el caso que esta rama vino a habilitar.
        const { data: hoy } = await db.from('propuestas').select('id, estado').eq('ref', refFinal).maybeSingle();
        if (hoy && str((hoy as Record<string, unknown>).estado) !== 'descartada') {
          return { id: str((hoy as Record<string, unknown>).id), nueva: false };
        }
        // Descartada OTRA VEZ hoy: se deja entrar sin llave. Perder la
        // idempotencia de un caso tan raro es mucho más barato que volver a
        // encadenar a esa persona, que es el bug que se está arreglando.
        if (hoy) refFinal = null;
      }
    }

    const id = nuevoId();
    const { error } = await db.from('propuestas').insert({
      id,
      tipo: input.tipo,
      estado: 'pendiente',
      origen: input.origen?.slice(0, 60) ?? null,
      resumen: (input.resumen ?? '').slice(0, 300),
      datos: input.datos,
      ref: refFinal,
    });
    if (error) throw new Error(`crearPropuesta: ${error.message}`);
    // El push va SÓLO con `nueva: true`: las ramas de arriba devuelven una propuesta que ya
    // existía (la misma `ref`), y ésa ya avisó cuando nació.
    await avisarPropuesta(input.ws, id, input.tipo, input.resumen ?? '', input.origen ?? null);
    return { id, nueva: true };
  });
}

/**
 * «MaKo dejó algo para revisar», al teléfono de quien lo quiera (MaKo Mobile, lib/push.ts).
 *
 * NO se manda cuando quien la originó la está mirando o se aplica sola: `app` es el chat de
 * MaKo de la app y también un paso de una automatización (que la aplica EN EL ACTO,
 * `aplicarEnElActo` en lib/api-mako/flujo.ts). Y se re-pregunta antes de mandar: una
 * propuesta que se aplicó en el mismo pedido (un token con escritura directa) ya no espera.
 *
 * Tag fijo: diez formularios de una landing en una hora son UNA notificación que se
 * actualiza, no diez (la bandeja las lista). TTL 24 h: un borrador espera a que lo miren.
 */
async function avisarPropuesta(ws: number, id: string, tipo: TipoPropuesta, resumen: string, origen: string | null): Promise<void> {
  if (origen === 'app' || origen?.startsWith('flujo:')) return;
  try {
    const { pushPorDetras } = await import('./push');
    await pushPorDetras(ws, {
      tipo: 'mako-propuesta',
      titulo: 'MaKo dejó algo para revisar',
      cuerpo: resumen.trim() || (tipo === 'lead' ? 'Un lead nuevo espera tu revisión.' : 'Una acción espera tu revisión.'),
      ruta: tipo === 'lead' ? `/crm/revisar/${id}` : `/mako/revisar/${id}`,
      tag: 'mako-propuesta',
      ttl: 24 * 3600,
      urgencia: 'normal',
    }, async () => {
      const { data } = await getSupabaseServer().from('propuestas')
        .select('estado').eq('id', id).eq('workspace_id', ws).maybeSingle();
      return (data as { estado?: string } | null)?.estado === 'pendiente';
    });
  } catch (e) {
    // Que falle el push no puede tumbar la propuesta, que ya está creada.
    console.error(`[propuestas] push de ${id}:`, e instanceof Error ? e.message : String(e));
  }
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

/** El resultado de una propuesta que ya se reclamó con `marcarAplicada`: el que reclama
 *  ANTES de hacer el trabajo escribe lo que pasó después. */
export async function guardarResultadoPropuesta(id: string, resultado: Record<string, unknown>): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('propuestas').update({ resultado }).eq('id', id);
  if (error) console.error(`[propuestas] no pude guardar el resultado de ${id}:`, error.message);
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
