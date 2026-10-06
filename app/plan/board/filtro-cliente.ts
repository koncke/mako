// =============================================================================
// filtro-cliente — «mostrame sólo lo de ESTE cliente», en el tablero /plan
// =============================================================================
// El pedido (05/10/2026), sobre la ficha de un cliente en Customer Success: «dejar solo la
// sección de PRIORIDADES y Tareas, Proyectos y Recurrentes que se vean en la tab de Plan, y
// que haya un botón que te redirija con el filtro ya puesto para ver solo las tareas o
// proyectos de ese cliente».
//
// ⚠️ SIN `'use client'` Y SIN `server-only`, A PROPÓSITO. Lo importan las dos puntas: la
// PÁGINA (server) lee `?cliente=` para que el primer HTML ya venga filtrado —igual que
// `?vista=`, por la misma razón: corregir después de hidratar es un parpadeo en cada F5—, y
// el TABLERO (navegador) aplica el predicado. Y el test lo puede importar.
//
// ⚠️ LA REGLA DE «QUÉ ES DE UN CLIENTE» ES LA DE SU FICHA, no una parecida. La ficha
// (`filasDeCliente` / `filasDeTodos` en app/customer-success/trabajo.ts) muestra:
//   · los PROYECTOS que lo declaran (`cliente_lead_id`), y
//   · las TAREAS que lo declaran MÁS las que viven en uno de esos proyectos.
// Un proyecto NO es del cliente por tener una tarea suya adentro («una tarea asignada es de
// ese cliente; su proyecto NO lo es», mismo archivo). Si «Ver en el Plan» filtrara con otra
// regla, el botón llevaría a una lista distinta de la que la ficha acaba de mostrar — y eso
// se lee como que una de las dos pantallas está rota.
//
// ⚠️ ES ESTADO DE LA SESIÓN, NUNCA UNA PREFERENCIA. No pasa por `usePref` ni por
// `localStorage`: un filtro de cliente restaurado en silencio la próxima vez que entrás al
// Plan esconde el tablero entero detrás de una decisión que tomaste ayer — la trampa de la
// casa «localStorage restaura una PREFERENCIA, nunca pisa una DECISIÓN». Lo pone la persona
// (el menú «Filtrar») o la URL (`?cliente=`), y vive en la URL mientras está puesto, así que
// el link que copiás es la pantalla que ves y borrar el filtro lo borra también de ahí.

import { clienteDe, esDelCliente, type ClienteRef, type ConCliente } from '@/lib/plan-clientes';

/** El nombre del parámetro. UNA constante: lo escriben la ficha (el link) y el tablero (al
 *  sincronizar la URL), y lo lee la página. Tres strings a mano son tres oportunidades de
 *  que uno diga `client`. */
export const PARAM_CLIENTE = 'cliente';

/**
 * El leadId de `?cliente=`, o `null`.
 *
 * Estricto a propósito: sólo un entero positivo escrito entero. `Number('12abc')` es NaN y
 * `parseInt('12abc')` es 12 — y un parámetro a medio escribir que filtra por OTRO cliente es
 * peor que uno que no filtra. Acepta el array que Next entrega cuando el parámetro se repite
 * (se queda con el primero, igual que el reenvío de `/plan → /plan/agencia`).
 */
export function leerClienteDeUrl(v: string | string[] | null | undefined): number | null {
  const s = (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
  if (!/^[1-9]\d{0,15}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * El link al Plan con el filtro puesto. Lo usa el botón «Ver en el Plan» de la ficha.
 *
 * ⚠️ ABRE EN «TAREAS» Y NO EN PRIORIDADES, y no es estética: Prioridades es justamente lo
 * que la ficha ya muestra adentro, así que aterrizar ahí sería un botón que lleva a la misma
 * pantalla que dejaste. Además Tareas es la vista que dibuja «Filtrar», donde se ve el filtro
 * y se lo saca.
 *
 * ⚠️ VA A `/plan`, NUNCA A `/plan/agencia`: `/plan` decide quién es quién (super admin →
 * su tablero, cliente → el suyo) y reenvía el query entero. Y el `?ws=` no se arma acá: lo
 * agrega `app/_ui/Link`, que es el que sabe qué pestaña estás mirando.
 */
export function hrefPlanDeCliente(leadId: number, vista: 'tareas' | 'proyectos' | 'recurrentes' | 'prioridades' = 'tareas'): string {
  const sp = new URLSearchParams();
  if (vista !== 'prioridades') sp.set('vista', vista);
  sp.set(PARAM_CLIENTE, String(leadId));
  return `/plan?${sp.toString()}`;
}

/** Los ids de los PROYECTOS de ese cliente: los que lo declaran, y sólo esos. */
export function proyectosDelCliente(proyectos: ReadonlyArray<{ id: string } & ConCliente>, leadId: number): Set<string> {
  return new Set(proyectos.filter((p) => esDelCliente(p, leadId)).map((p) => p.id));
}

/**
 * ¿Esta TAREA es de ese cliente? La declara, o vive en uno de sus proyectos.
 *
 * `proys` es lo que devuelve `proyectosDelCliente` para el mismo `leadId`: se calcula UNA
 * vez por render y no por tarjeta, que con 550 tareas y 71 proyectos es la diferencia entre
 * un filtro que se siente instantáneo y uno que no.
 */
export function tareaEsDelCliente(t: { labels: readonly string[] } & ConCliente, leadId: number, proys: ReadonlySet<string>): boolean {
  return esDelCliente(t, leadId) || t.labels.some((l) => proys.has(l));
}

/**
 * Cómo se llama el cliente del filtro, para el chip y para el menú.
 *
 * ⚠️ UN ID QUE NO ESTÁ ENTRE LOS CLIENTES GANADOS IGUAL FILTRA, Y ESTA ES LA RAZÓN DEL
 * RESPALDO. Ignorar el parámetro era la otra opción y es la que miente: un lead que dejó de
 * estar «ganado», o una lectura del CRM que falló (`clientesGanadosOVacio` devuelve `[]`),
 * convertirían «Ver en el Plan» de Brigitte en el tablero ENTERO de todo el mundo, sin una
 * palabra. Filtrando con el chip a la vista, un tablero vacío se explica solo y se apaga con
 * la ✕. El nombre sale, en orden, de la cartera, de lo que las propias tarjetas tienen
 * escrito, y si no hay nada, de `Cliente #N` — el mismo respaldo que usa `clienteDe`.
 */
export function nombreDelCliente(leadId: number, clientes: ReadonlyArray<Pick<ClienteRef, 'leadId' | 'nombre'>>, items: ReadonlyArray<ConCliente>): string {
  const deCartera = clientes.find((c) => c.leadId === leadId)?.nombre?.trim();
  if (deCartera) return deCartera;
  for (const x of items) {
    const c = clienteDe(x);
    if (c?.leadId === leadId && (x.clienteNombre ?? '').trim()) return c.nombre;
  }
  return `Cliente #${leadId}`;
}

/**
 * Las opciones del menú «Cliente»: la cartera MÁS los que aparecen en tarjetas y no están en
 * ella (un lead que dejó de estar ganado sigue teniendo trabajo escrito con su id, y si el
 * menú no lo ofrece, ese trabajo no se puede aislar nunca). Ordenadas por nombre.
 */
export function opcionesDeCliente(clientes: ReadonlyArray<Pick<ClienteRef, 'leadId' | 'nombre'>>, items: ReadonlyArray<ConCliente>): Array<{ leadId: number; nombre: string }> {
  const m = new Map<number, string>();
  for (const c of clientes) if (Number.isInteger(c.leadId) && c.leadId > 0) m.set(c.leadId, (c.nombre ?? '').trim() || `Cliente #${c.leadId}`);
  for (const x of items) {
    const c = clienteDe(x);
    if (c && !m.has(c.leadId)) m.set(c.leadId, c.nombre);
  }
  return [...m].map(([leadId, nombre]) => ({ leadId, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
