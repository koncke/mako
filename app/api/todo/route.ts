// =============================================================================
// /api/todo — tablero kanban /todo (tareas + categorías)
// =============================================================================
// GET  → { tareas, categorias }
// POST { action: 'crear'|'crear-lote'|'mover'|'editar'|'borrar'
//               |'categoria-crear'|'categoria-borrar', ... }
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  listTareas, crearTarea, crearTareasDesde, moverTarea, editarTarea, borrarTarea,
  listCategorias, crearCategoria, editarCategoria, borrarCategoria,
  type EstadoTarea, type Prioridad, type OrigenTarea, type ChecklistItem, type HistEntry, type CamposResponsable,
} from '@/lib/todo';
import { priorizarNuevasCliente } from '@/lib/todo-guardian';
// «Cómo se repite» (mig 0167): la RRULE. El saneo vive en el módulo compartido — esta ruta
// es la PUERTA del tablero del cliente, y la columna no tiene `check`, así que lo que pase
// de acá llega a la base tal cual. No se sanea EN esta puerta a propósito: la invariante
// necesita saber si la fila se repite, y eso sólo lo sabe `lib/todo.ts`, que lee la fila.
// Sanear las dos veces sería la segunda copia de la regla; sanear SÓLO acá dejaría entrar
// una recurrencia a algo que vence.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// El Perro hace DOS llamadas de IA (puntuar + checklists) sobre varias tareas: con el
// default se cortaba a la mitad y el board se quedaba esperando sin enterarse.
export const maxDuration = 120;

export async function GET() {
  try {
    const [tareas, categorias] = await Promise.all([listTareas(), listCategorias().catch(() => [])]);
    return Response.json({ ok: true, tareas, categorias });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

type TareaBody = {
  titulo?: string; detalle?: string | null; prioridad?: Prioridad; estado?: EstadoTarea;
  progreso?: number; deadline?: string | null; quarter?: string | null; recurrente?: boolean; recurrencia?: unknown; categorias?: number[];
  checklist?: ChecklistItem[]; historial?: HistEntry[]; en_prioridad?: boolean; score?: number; score_razon?: string | null;
  origen?: OrigenTarea; retro_id?: number | null; experimento_id?: number | null;
  // DE DÓNDE SALIÓ la tarea (reunión de Fathom + minuto, archivo, WhatsApp). La tabla
  // y lib/todo.ts siempre la soportaron, pero esta ruta no la declaraba ni la pasaba:
  // por eso las tareas del cliente que venían de una reunión perdían el chip de origen
  // y el link al minuto de la grabación, mientras que en el board del dueño sí salían.
  fuente?: { tipo: string; etiqueta?: string; url?: string } | null;
} & CamposResponsable;

/** Los campos de QUIÉN, tal cual vinieron (lib/todo los sanea). Una persona puede
 *  corregir el responsable o el cliente; los del CRITERIO no pasan por esta ruta: son
 *  lo que dijo el juez, y si el cliente los pudiera reescribir dejarían de servir para
 *  saber en qué se equivocó el criterio. */
const responsableDe = (t: TareaBody): CamposResponsable => ({
  responsable: t.responsable, responsable_email: t.responsable_email, responsable_tipo: t.responsable_tipo,
  cliente_nombre: t.cliente_nombre, cliente_lead_id: t.cliente_lead_id, tema: t.tema,
});

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const action = String(body.action ?? '');
  const id = Number(body.id);

  try {
    // El Perro Guardián para el board del CLIENTE. Antes esta acción no existía y el
    // tablero del cliente no tenía forma de invocarlo: sus tareas entraban con el
    // score que había adivinado la extracción, sin razón, sin detalle y sin checklist
    // — que es justo lo que se veía en el tablero de Mauricio.
    if (action === 'priorizar-nuevas') {
      const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isFinite) : [];
      if (!ids.length) return Response.json({ ok: false, error: 'sin ids' }, { status: 400 });
      const contexto = typeof body.contexto === 'string' ? body.contexto : '';
      const r = await priorizarNuevasCliente(ids, contexto);
      return Response.json({ ok: true, n: r.n, patches: r.patches });
    }
    if (action === 'crear') {
      const t = body.tarea as TareaBody | undefined;
      if (!t || !t.titulo) return Response.json({ ok: false, error: 'falta el título' }, { status: 400 });
      return Response.json({ ok: true, tarea: await crearTarea({
        titulo: t.titulo, detalle: t.detalle ?? null, prioridad: t.prioridad, estado: t.estado,
        progreso: t.progreso, deadline: t.deadline, categorias: t.categorias,
        // ⚠️ `recurrente` VA EN EL ALTA, y faltaba: `NuevaTarea` lo soporta desde la 0163 y
        // esta rama no lo nombraba, así que una tarea del cliente NACÍA compitiendo aunque
        // quien la creó hubiera marcado que se repite — y recién al editarla se arreglaba.
        // Esta rama arma el objeto campo por campo: lo que no se nombra, no llega.
        recurrente: t.recurrente,
        // ⚠️ Y LA RECURRENCIA CON ÉL (mig 0167). Misma rama y mismo motivo: arma el objeto
        // campo por campo, así que lo que no se nombre no llega — y una recurrente creada
        // desde el tablero del cliente nacería sin ritmo, que es el único dato temporal que
        // le queda. Va CRUDA a propósito: el saneo con su invariante lo hace `crearTarea`
        // (`recurrenciaDe(input)`), que es el único que sabe si esta alta se repite.
        recurrencia: t.recurrencia,
        origen: t.origen, retro_id: t.retro_id ?? null, experimento_id: t.experimento_id ?? null,
        // La fuente va EN EL ALTA: si se escribiera en un editar posterior, la tarjeta
        // nace sin chip y el Perro la puntúa sin saber de dónde salió.
        fuente: t.fuente ?? null,
        ...responsableDe(t),
      }) });
    }
    if (action === 'crear-lote') {
      const items = (body.items as Array<{ titulo: string; detalle?: string; prioridad?: Prioridad }>) ?? [];
      const meta = (body.meta as { origen?: OrigenTarea; retro_id?: number; experimento_id?: number }) ?? {};
      const n = await crearTareasDesde(items, { origen: meta.origen ?? 'mako', retro_id: meta.retro_id ?? null, experimento_id: meta.experimento_id ?? null });
      return Response.json({ ok: true, creadas: n });
    }
    if (action === 'mover') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      const estado = String(body.estado) as EstadoTarea;
      const orden = body.orden != null ? Number(body.orden) : undefined;
      const historial = (body.historial as HistEntry[] | undefined);
      return Response.json({ ok: true, tarea: await moverTarea(id, estado, orden, historial) });
    }
    if (action === 'editar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      const patch = (body.patch as TareaBody) ?? {};
      return Response.json({ ok: true, tarea: await editarTarea(id, {
        titulo: patch.titulo, detalle: patch.detalle, prioridad: patch.prioridad,
        progreso: patch.progreso, deadline: patch.deadline, quarter: patch.quarter, recurrente: patch.recurrente,
        // Va CRUDA y sin sanear acá: el patch puede traer la recurrencia sin `recurrente`,
        // así que la única que puede decidir es `editarTarea`, que lee el flag de la fila.
        // `undefined` = «no lo toques» y `null` = «bórrala»: son dos cosas distintas, y las
        // dos viajan — colapsarlas haría que editar cualquier otro campo borrara el ritmo.
        recurrencia: patch.recurrencia,
        categorias: patch.categorias,
        checklist: patch.checklist, historial: patch.historial, en_prioridad: patch.en_prioridad, score: patch.score, score_razon: patch.score_razon,
        fuente: patch.fuente,
        ...responsableDe(patch),
      }) });
    }
    if (action === 'borrar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      await borrarTarea(id);
      return Response.json({ ok: true });
    }
    if (action === 'categoria-crear') {
      const nombre = String(body.nombre ?? '');
      const color = String(body.color ?? '#9b9ba2');
      const emoji = body.emoji != null ? String(body.emoji) : undefined;
      const prioridad = body.prioridad != null ? Number(body.prioridad) : undefined;
      const detalle = body.detalle != null ? String(body.detalle) : undefined;
      const historial = body.historial as HistEntry[] | undefined;
      const scoreRazon = body.score_razon != null ? String(body.score_razon) : undefined;
      const deadline = body.deadline != null ? String(body.deadline) : undefined;
      const quarter = body.quarter != null ? String(body.quarter) : undefined;
      // «Se repite para siempre» a nivel proyecto (mig 0164). Va en el alta y en el editar:
      // sin esta línea el board del cliente puede marcar el interruptor y el proyecto nace
      // compitiendo igual — el control se dibuja y no guarda nada.
      const recurrente = body.recurrente != null ? Boolean(body.recurrente) : undefined;
      // Cómo se repite (mig 0167). Va en el alta por lo mismo que `recurrente`, y cruda:
      // la sanea `crearCategoria` con su invariante (`recurrenciaDe`).
      const recurrencia = body.recurrencia;
      // DE QUIÉN es (mig 0172). Va en el alta porque restaurar un proyecto borrado pasa por
      // acá: sin esta línea, deshacer un borrado devuelve el proyecto sin su cliente y la
      // tab de Customer Success lo pierde de vista sin que nadie lo haya desasignado.
      const cliente = { lead_id: body.cliente_lead_id as number | null | undefined, nombre: body.cliente_nombre as string | null | undefined };
      // SU PORTADA (mig 0173). Va en el alta por lo mismo que el cliente: deshacer el
      // borrado de un proyecto pasa por acá, y sin esta línea vuelve sin su portada.
      const portada = body.portada != null ? String(body.portada) : undefined;
      // El encuadre y el ícono (mig 0174), por lo mismo: sin esto, deshacer el borrado
      // de un proyecto lo devuelve sin ícono y con la portada descentrada.
      const portadaY = body.portada_y != null ? Number(body.portada_y) : undefined;
      const icono = body.icono != null ? String(body.icono) : undefined;
      if (!nombre.trim()) return Response.json({ ok: false, error: 'falta el nombre' }, { status: 400 });
      return Response.json({ ok: true, categoria: await crearCategoria(nombre, color, emoji, prioridad, detalle, historial, scoreRazon, deadline, quarter, recurrente, recurrencia, cliente, portada, portadaY, icono) });
    }
    if (action === 'categoria-editar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      // Este tipo es la PUERTA: `editarCategoria` arma su `upd` campo por campo, así que un
      // campo que no esté acá tampoco llega, aunque el navegador lo mande.
      // ⚠️ `recurrencia` ESTÁ EN ESTE TIPO O NO LLEGA (mig 0167): `editarCategoria` arma su
      // `upd` campo por campo, así que un campo que no esté declarado acá se cae en la
      // puerta aunque el navegador lo mande. Viaja CRUDA —el tipo es `unknown`— porque el
      // saneo necesita saber si la fila se repite, y eso lo lee `editarCategoria`.
      // ⚠️ `cliente_lead_id` / `cliente_nombre` ESTÁN EN ESTE TIPO O NO LLEGAN (mig 0172),
      // por lo mismo que `recurrencia`: la puerta es un tipo, y lo que no se nombre acá se
      // cae en silencio aunque el navegador lo mande.
      // ⚠️ `portada` ESTÁ EN ESTE TIPO O NO LLEGA (mig 0173), por lo mismo que las dos de
      // arriba. Es el quinto campo que pasa por esta puerta y el modo de falla no cambió:
      // el selector se abre, la request contesta 200 y la banda sigue igual.
      // ⚠️ Y `portada_y` / `icono` lo mismo (mig 0174). Van SEIS. El día que esta lista
      // llegue a diez, la puerta pide ser un esquema y no una enumeración a mano.
      const patch = (body.patch as { nombre?: string; color?: string; emoji?: string; prioridad?: number; detalle?: string; historial?: HistEntry[]; score_razon?: string | null; deadline?: string | null; quarter?: string | null; recurrente?: boolean; recurrencia?: unknown; cliente_lead_id?: number | null; cliente_nombre?: string | null; portada?: string | null; portada_y?: number | null; icono?: string | null }) ?? {};
      return Response.json({ ok: true, categoria: await editarCategoria(id, patch) });
    }
    if (action === 'categoria-borrar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      await borrarCategoria(id);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
