// =============================================================================
// menu-contextual-chats — QUÉ ofrece el clic derecho de una conversación de la lista de Chats (puro)
// =============================================================================
// Pedido de Leandro (ws10, 24/10/2026, f26): «el click derecho casi que en toda la app se tiene que poder usar». El clic
// derecho de una fila (y mantenerla presionada con el dedo) ofrece lo MISMO que su «⋯» (`MasAcciones`, ListaChats.tsx):
// «Abrir ficha» o «Agregar al CRM» (con 2+ funnels, en cuál) y «Asignar ›» si hay lead, con «Abrir» arriba, que es lo que ya
// hace tocar la fila. Sin Cerrar ni Posponer: Martín los sacó del «⋯» el 27/10 y viven en la cabecera del chat abierto. CÓMO
// se abre es de app/_ui/useMenuContextual.ts y se dibuja con la pieza de la casa (app/_ui/MenuContextual.tsx).
//
// ⚠️ EL «⋯» SIGUE CON SU DROPDOWN, A PROPÓSITO: el pedido era sólo sumar el clic derecho. Las dos listas dicen lo mismo y
//    tests/clic-derecho-listas.test.ts las cruza (cada rótulo del «⋯» está acá y al revés).
// =============================================================================
import type { EntradaMenuContextual, ItemMenuContextual } from '@/app/_ui/MenuContextual';
import type { ChatResumen } from '@/lib/chats-tipos';
import { pideProducto, type ProductoParaAlta } from '@/lib/lead-funnel-reglas';
import { MAKO_SETTER } from '@/lib/pipeline';
import { sePuedeAgregar } from './lista-reglas';
import type { AccionFila } from './ListaChats';

type Fila = Pick<ChatResumen, 'leadId' | 'asignado' | 'canales'>;
type Miembro = { nombre: string; foto_url: string | null };

/** Los renglones del menú de una fila. `productos` en `null`: no se leyeron, y decide el server (como el «⋯»). */
export function itemsFilaChat(c: Fila, equipo: ReadonlyArray<Miembro>, productos: ReadonlyArray<ProductoParaAlta> | null): EntradaMenuContextual[] {
  const out: EntradaMenuContextual[] = [{ id: 'abrir', label: 'Abrir', icono: 'ver' }];
  const crm: EntradaMenuContextual[] = [];
  if (c.leadId != null) crm.push({ id: 'ficha', label: 'Abrir ficha', icono: 'cliente' });
  else if (sePuedeAgregar(c)) {
    crm.push(productos && pideProducto(productos as ProductoParaAlta[])
      ? { id: 'agregar', label: 'Agregar al CRM en', icono: 'persona-mas', hijos: productos.map((p) => ({ id: `alta:${p.id}`, label: p.nombre, icono: 'persona-mas' })) }
      : { id: 'alta:', label: 'Agregar al CRM', icono: 'persona-mas' });
  }
  // Asignar = el setter del lead (como el «⋯»): sin lead no hay a quién asignar todavía.
  if (c.leadId != null) {
    const hijos: ItemMenuContextual[] = [];
    if (c.asignado) hijos.push({ id: 'asig:', label: 'Quitar asignación', icono: 'persona-menos' });
    hijos.push({ id: `asig:${MAKO_SETTER}`, label: MAKO_SETTER, icono: 'mako', marcado: c.asignado === MAKO_SETTER });
    for (const m of equipo) {
      if (m.nombre && m.nombre !== MAKO_SETTER) hijos.push({ id: `asig:${m.nombre}`, label: m.nombre, avatar: m.foto_url, marcado: c.asignado === m.nombre });
    }
    crm.push({ id: 'asignar', label: 'Asignar', icono: 'persona', hijos });
  }
  return crm.length ? [...out, null, ...crm] : out;
}

/** Qué hace lo elegido: «abrir», la acción de la fila (la misma que manda el «⋯»), o nada (asignar al que ya está). */
export function accionDeMenuChat(id: string, c: Pick<Fila, 'asignado'>): 'abrir' | AccionFila | null {
  if (id === 'abrir') return 'abrir';
  if (id === 'ficha') return { tipo: 'ficha' };
  if (id.startsWith('alta:')) {
    const n = Number(id.slice(5));
    return { tipo: 'agregar', funnelId: id.length > 5 && Number.isSafeInteger(n) && n > 0 ? n : null };
  }
  if (id.startsWith('asig:')) {
    const nombre = id.slice(5);
    return (nombre || null) !== (c.asignado ?? null) ? { tipo: 'asignar', setter: nombre || null } : null;
  }
  return null;
}
