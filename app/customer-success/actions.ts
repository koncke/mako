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
import { saneaPortada, urlDeImagenOk } from '@/lib/portadas';
import { createLead, updateLead } from '@/lib/leads';
// La clase vive en su módulo, no en `lib/leads`, que sólo la re-usa.
import { LeadDuplicadoError } from '@/lib/leads-duplicados';
import { revalidatePath } from 'next/cache';
import { autoasignar } from './trabajo';

/** ¿Este lead es un cliente DE ESTE workspace? Fail-closed: sin esto, un POST
 *  con el id de un lead ajeno leería o escribiría datos de otro inquilino. */
async function clienteDelWorkspace(leadId: number): Promise<{ id: number; nombre: string } | null> {
  if (!Number.isFinite(leadId) || leadId <= 0) return null;
  const db = await getTenantDb();
  const { data } = await db.from('leads')
    .select('id, nombre').eq('id', leadId).eq('estado_lead', 'ganado').maybeSingle();
  return (data as { id: number; nombre: string } | null) ?? null;
}

// ⚠️ SE FUERON CUATRO ACTIONS MÁS EL 27/09/2026, CON EL BOTÓN QUE LAS LLAMABA.
// `trabajoDelClienteAction`, `catalogoAsignableAction`, `asignarTrabajoAction` y
// `trabajoAsignadoAction` alimentaban el selector de «Asignarle trabajo», que se sacó a
// pedido: «si ya copiamos la tab de plan, ya hay otros botones para eso». Tenía razón —
// la ficha monta el tablero de verdad, así que lo que se crea adentro nace del cliente y
// a lo que ya existe se le pone el cliente desde su propio detalle.
//
// No se dejan «por si vuelven»: una action exportada sin call site es una puerta abierta
// que nadie audita, y la pregunta «¿quién la llama?» ya costó caro en este repo. El
// mecanismo sigue entero en `./trabajo.ts` (`asignarTrabajo`), que es lo que usa la
// corrida de `autoasignar`.

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
  { ok: true; porNombre: number; porIA: number; consultadas: number; sinRespuesta: number } | { ok: false; error: string }
> {
  try {
    const r = await autoasignar();
    if (r.ok) revalidatePath('/customer-success');
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo.' };
  }
}

/**
 * Su foto y su portada (mig 0173).
 *
 * ⚠️ LO QUE MANDA EL NAVEGADOR ES UNA PROPUESTA, y acá se sanea. Las dos cosas
 * terminan dibujadas en la pantalla de cualquiera que abra la tab —una en un `<img>`
 * y la otra adentro de un `url()` de CSS—, así que una URL de un origen cualquiera
 * sería una pieza de un tercero cargándose con el referer del cliente. `saneaPortada`
 * y `urlDeImagenOk` comparan `new URL(v).origin` contra una lista, nunca un prefijo:
 * `https://picsum.photos@evil.tld/x` pasa cualquier `startsWith` y su origen REAL es
 * el del atacante (AGENTS.md → «Un guard de ORIGEN se escribe con `origin`»).
 *
 * ⚠️ `undefined` = «no lo toques» y `null` = «sacalo». Son dos cosas distintas y las
 * dos tienen que poder viajar, o quitarse la foto sería imposible.
 */
export async function guardarImagenClienteAction(leadId: number, cambio: {
  avatarUrl?: string | null;
  portada?: string | null;
}): Promise<{ ok: true; avatarUrl: string | null; portada: string | null } | { ok: false; error: string }> {
  try {
    // El mismo guard que el resto de la pantalla: sin esto, un POST con el id de un
    // lead ajeno escribiría sobre la ficha de otro inquilino.
    const cliente = await clienteDelWorkspace(leadId);
    if (!cliente) return { ok: false, error: 'Ese cliente no es de este workspace.' };

    const upd: Record<string, unknown> = {};
    if (cambio.avatarUrl !== undefined) upd.avatar_url = urlDeImagenOk(cambio.avatarUrl);
    if (cambio.portada !== undefined) upd.portada = saneaPortada(cambio.portada);
    if (!Object.keys(upd).length) return { ok: false, error: 'No había nada que cambiar.' };

    const db = await getTenantDb();
    const { data, error } = await db.from('leads').update(upd).eq('id', leadId)
      .select('avatar_url, portada').single();
    if (error) return { ok: false, error: error.message };

    revalidatePath('/customer-success');
    const fila = data as { avatar_url: string | null; portada: string | null };
    // Se devuelve LO QUE QUEDÓ GUARDADO, no lo que se pidió: si el saneo descartó la
    // URL, la pantalla tiene que enterarse en vez de pintar algo que la base no tiene.
    return { ok: true, avatarUrl: fila.avatar_url, portada: fila.portada };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}
