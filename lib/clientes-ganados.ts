// =============================================================================
// clientes-ganados — quiénes son los clientes de ESTE workspace
// =============================================================================
// Los leads con la venta marcada como GANADA en el CRM. Es el universo de
// «clientes» de todo el producto: lo que lista Customer Success y lo que ofrece
// el picker de cliente del tablero (mig 0172).
//
// ⚠️ VIVE ACÁ Y NO EN `app/customer-success/trabajo.ts`, QUE ES DE DONDE SALIÓ.
// Desde la 0172 lo necesitan también las dos páginas del tablero (`/plan` y
// `/plan/agencia`), y una página del tablero no puede importar de Customer
// Success: arrastraría el cruce, `lib/todo-rutear` y el Perro entero al grafo de
// una pantalla que sólo quiere catorce nombres.
//
// ⚠️ Y ES UNA SOLA DEFINICIÓN DE «CLIENTE» A PROPÓSITO. Si el picker ofreciera un
// universo distinto del que lista Customer Success, se podría asignar trabajo a
// alguien que después no aparece en su propia tab — y nadie tendría dónde mirar
// para entender por qué.

import 'server-only';
import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import type { ClienteRef } from './plan-clientes';

/**
 * Paginado por `id`, no un `.select()` suelto: PostgREST corta en 1000 filas sin un
 * solo error, y lo que cae deja de existir — un cliente que no aparece en el picker
 * es indistinguible de un cliente que no existe.
 */
export async function clientesGanados(): Promise<ClienteRef[]> {
  type Fila = { id: number; nombre: string | null; empresa: string | null };
  const db = await getTenantDb();
  const filas = await leerTodo<Fila>(db, 'leads', 'id, nombre, empresa',
    { orden: 'id', eq: { estado_lead: 'ganado' } });
  return filas.map((l) => ({ leadId: l.id, nombre: (l.nombre ?? '').trim(), empresa: l.empresa }));
}

/**
 * La misma lista, pero que NO tumba la pantalla si falla.
 *
 * ⚠️ PARA EL TABLERO, DONDE LOS CLIENTES SON UN CAMPO MÁS. Si la consulta de leads
 * falla, `/plan` tiene que seguir dibujándose: el picker se queda vacío y dice que no
 * hay clientes. Lo contrario sería que un error leyendo el CRM deje a alguien sin su
 * tablero entero, que es el peor intercambio posible.
 *
 * ⚠️ NO SE USA EN CUSTOMER SUCCESS. Ahí la lista de clientes ES la pantalla, y un
 * `[]` por una lectura fallida diría «no tenés clientes» sobre una consulta que nunca
 * contestó. Ahí se usa `clientesGanados` y el error sube: son dos pantallas distintas
 * y por eso son dos funciones.
 */
export async function clientesGanadosOVacio(): Promise<ClienteRef[]> {
  try { return await clientesGanados(); } catch { return []; }
}
