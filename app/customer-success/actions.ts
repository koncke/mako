'use server';

// =============================================================================
// Server actions de Customer Success
// =============================================================================
// Queda UNA: el trabajo de un cliente en el tablero. Es lo único que la pantalla
// hace, y la pantalla es una lista de clientes con sus proyectos, sus tareas y
// sus recurrentes.
//
// ⚠️ `marcarEstadoAction` SE FUE CON LOS BOTONES (26/09/2026). Ponía a un cliente
// en pausa / terminado / baja en `cs_clientes`, y esos tres botones eran parte de
// lo que esta pantalla nunca tuvo que tener. La CAPACIDAD no se perdió: MaKo la
// sigue teniendo entera en `lib/api-mako/areas/cs.helpers.ts`
// (`marcarEstadoCliente`), que es donde vive ese mecanismo. Si vuelve a hacer
// falta un botón, el server action se reescribe en cuatro líneas; lo que no se
// puede es dejarlo acá sin nadie que lo llame.
//
// ⚠️ SE FUERON TRES MÁS, Y EL PORQUÉ IMPORTA (26/09/2026). `emitirLinkAction`,
// `revocarLinksAction`, `avanceDelClienteAction` y `sincronizarWhopAction` eran
// del programa de 44 clases de UN cliente: el link abría SU cuestionario, el
// avance leía `cs_respuestas` (0 filas en todo el producto) y el sync subía SU
// temario a Whop. Nada de eso es de un workspace cualquiera.
// Los links ya emitidos se siguen operando desde MaKo
// (`lib/api-mako/areas/cs.helpers.ts`), que es donde vive ese mecanismo ahora.
//
// ⚠️ Y EL WORKSPACE ES EL ACTUAL, SIN EXCEPCIONES. `wsActual()` devolvía
// `OWNER_WS` cuando quien miraba era admin, para que la tab de Mauricio se
// viera desde cualquier lado. Con eso, un admin parado en OTRO cliente escribía
// el estado sobre la cartera de Mauricio. Es la misma pantalla para todos: el
// inquilino lo resuelve `getTenantDb()`.

import { getTenantDb } from '@/lib/workspace';
import { createLead, updateLead } from '@/lib/leads';
// La clase vive en su módulo, no en `lib/leads`, que sólo la re-usa.
import { LeadDuplicadoError } from '@/lib/leads-duplicados';
import { revalidatePath } from 'next/cache';
import { clientesGanados, trabajoDeCliente, trabajoAsignado, catalogoAsignable, asignarTrabajo, autoasignar, type ResultadoTrabajo, type Catalogo } from './trabajo';

/** ¿Este lead es un cliente DE ESTE workspace? Fail-closed: sin esto, un POST
 *  con el id de un lead ajeno leería o escribiría datos de otro inquilino. */
async function clienteDelWorkspace(leadId: number): Promise<{ id: number; nombre: string } | null> {
  if (!Number.isFinite(leadId) || leadId <= 0) return null;
  const db = await getTenantDb();
  const { data } = await db.from('leads')
    .select('id, nombre').eq('id', leadId).eq('estado_lead', 'ganado').maybeSingle();
  return (data as { id: number; nombre: string } | null) ?? null;
}

// ── El trabajo de ese cliente en el tablero ─────────────────────────────────
// El detalle NO viaja dentro de la cartera: son entre 2 y 55 tareas por cliente y
// la grilla sólo necesita los números (ver `tableroDeLaCartera`). Se pide al abrir
// la tab.
//
// ⚠️ EL CRUCE SE RESUELVE ACÁ, EN EL SERVER. `lib/todo.ts` y `lib/todo-rutear.ts`
// son `server-only`, así que ningún componente cliente los puede importar — y
// aunque pudiera, bajar las 212 tareas del workspace para filtrar tres en el
// navegador es mandarle a la pantalla el trabajo de todos los clientes para
// mostrar el de uno.
//
// ⚠️ Y LA LISTA DE CLIENTES CONTRA LA QUE SE CRUZA NO PUEDE VENIR DEL NAVEGADOR.
// El cruce blando (`atar`, ./cruce.ts) decide si una palabra es distintiva
// mirando a TODOS los clientes y a TODOS los proyectos: con una lista recortada
// por quien pregunta, cualquier palabra suya sería única y ataría cualquier cosa.

export async function trabajoDelClienteAction(leadId: number): Promise<ResultadoTrabajo> {
  const cliente = await clienteDelWorkspace(leadId);
  if (!cliente) return { ok: false, error: 'Ese cliente no está en tu cartera.' };
  try {
    const clientes = await clientesGanados();
    return await trabajoDeCliente(leadId, clientes);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude leer el tablero.' };
  }
}

// ── Asignarle trabajo a un cliente ───────────────────────────────────────────
// «No tengo forma de asignar proyectos o tareas a clientes. Debería desde allí
// mismo, buscando o filtrando y seleccionando los que quiera asignar» (26/09/2026).

/** El catálogo para el selector: todo lo que se le puede asignar a alguien. */
export async function catalogoAsignableAction(): Promise<Catalogo> {
  try { return await catalogoAsignable(); }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'No pude leer el tablero.' }; }
}

/**
 * Asigna (o desasigna, con `asignar: false`) las tarjetas elegidas.
 *
 * ⚠️ EL NOMBRE DEL CLIENTE LO PONE EL SERVER, leyéndolo de `leads`. Si viniera del
 * navegador, quien llama podría escribir cualquier etiqueta al lado de un id real —y esa
 * etiqueta es la que después pinta el chip del tablero, así que una tarjeta podría decir
 * «Mauricio» y pertenecer a otro sin que nada falle.
 *
 * ⚠️ Y EL LEAD SE VERIFICA CONTRA ESTE WORKSPACE (`clienteDelWorkspace`), fail-closed. Sin
 * eso, un POST con el id de un lead ajeno marcaría las tareas de este inquilino como
 * trabajo de un cliente de otro.
 */
export async function asignarTrabajoAction(
  leadId: number,
  ids: { proyectos: string[]; tareas: string[] },
  asignar = true,
): Promise<{ ok: boolean; proyectos?: number; tareas?: number; error?: string }> {
  const cliente = await clienteDelWorkspace(leadId);
  if (!cliente) return { ok: false, error: 'Ese cliente no está en tu cartera.' };
  if (!ids.proyectos.length && !ids.tareas.length) return { ok: false, error: 'No elegiste nada.' };

  try {
    const r = await asignarTrabajo(ids, asignar ? { leadId, nombre: (cliente.nombre ?? '').trim() || `Cliente #${leadId}` } : null);
    if (!r.ok) return r;
    revalidatePath('/customer-success');
    return { ok: true, proyectos: r.proyectos, tareas: r.tareas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude guardarlo.' };
  }
}

/**
 * LO QUE YA TIENE DUEÑO ESCRITO. Es la primera de las dos lecturas de la ficha: dos
 * consultas filtradas en vez de bajar el tablero entero y cruzarlo (ver el bloque «LA
 * LECTURA RÁPIDA» en ./trabajo.ts).
 */
export async function trabajoAsignadoAction(leadId: number): Promise<ResultadoTrabajo> {
  const cliente = await clienteDelWorkspace(leadId);
  if (!cliente) return { ok: false, error: 'Ese cliente no está en tu cartera.' };
  return trabajoAsignado(leadId);
}

// ── Cargar un cliente que nunca pasó por el CRM ──────────────────────────────

/**
 * Crea el cliente. Que es: crea el LEAD en el CRM y lo marca ganado.
 *
 * ⚠️ NO HAY TABLA DE CLIENTES, Y ESA ES LA DECISIÓN. «Al cargarse se debería cargar en el
 * CRM también» (26/09/2026) — y la única forma de que eso no se desincronice nunca es que
 * no haya dos lugares: un cliente ES un lead ganado. Con una tabla propia habría clientes
 * que el CRM no conoce, y el día que alguien busque a uno por teléfono no lo encuentra.
 *
 * ⚠️ Y PASA POR `createLead`, no por un insert propio: ahí viven la detección de
 * duplicados, la auto-asignación de vendedor y el alta del hilo de WhatsApp. Un insert a
 * mano se saltea las tres sin que nada falle.
 */
export async function crearClienteAction(datos: {
  nombre: string; empresa?: string; email?: string; telefono?: string;
}): Promise<{ ok: boolean; leadId?: number; error?: string }> {
  const nombre = (datos.nombre ?? '').trim();
  if (nombre.length < 2) return { ok: false, error: 'Falta el nombre.' };
  const email = (datos.email ?? '').trim() || null;
  const telefono = (datos.telefono ?? '').trim() || null;
  if (!email && !telefono) {
    return { ok: false, error: 'Carga un email o un teléfono: sin eso el cliente es incontactable.' };
  }

  try {
    const lead = await createLead({ nombre, empresa: (datos.empresa ?? '').trim() || null, email, telefono });
    // El desenlace va en una segunda escritura porque `createLead` no lo acepta: su
    // trabajo es dar de alta un lead, y `estado_lead` es del recorrido. `updateLead`
    // deriva `cerro` solo (lib/leads.ts), así que las dos columnas quedan de acuerdo.
    await updateLead(lead.id, { estado_lead: 'ganado' });
    revalidatePath('/customer-success');
    revalidatePath('/crm');
    return { ok: true, leadId: lead.id };
  } catch (e) {
    // El duplicado tiene su propio error y su propio mensaje: mandar a alguien a cargar
    // de nuevo a un cliente que YA está es cómo se termina con dos fichas de la misma
    // persona y ninguna forma de saber cuál es la buena.
    const msg = e instanceof Error ? e.message : 'No se pudo cargar.';
    if (e instanceof LeadDuplicadoError) {
      return { ok: false, error: 'Ya tienes a alguien con ese nombre o contacto en el CRM. Márcalo como ganado ahí y aparece aquí.' };
    }
    return { ok: false, error: msg };
  }
}

/**
 * Que MaKo asigne lo evidente. Devuelve cuántas y por qué vía, porque son dos cosas
 * distintas: lo del nombre es un hecho y lo de la IA es un juicio.
 */
export async function autoasignarAction(): Promise<
  { ok: true; porNombre: number; porIA: number; consultadas: number } | { ok: false; error: string }
> {
  try {
    const r = await autoasignar();
    if (r.ok) revalidatePath('/customer-success');
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo.' };
  }
}
