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
import { clientesGanados, trabajoDeCliente, type ResultadoTrabajo } from './trabajo';

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
