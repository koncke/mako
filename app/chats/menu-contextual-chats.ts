// =============================================================================
// menu-contextual-chats — QUÉ ofrece el clic derecho de una conversación de la lista de Chats (puro)
// =============================================================================
// Pedido de Leandro (ws10, 24/10/2026, f26): «el click derecho casi que en toda la app se tiene que poder usar». El clic
// derecho de una fila (y mantenerla presionada con el dedo) ofrece lo MISMO que su «⋯» (`MasAcciones`, ListaChats.tsx):
// Cerrar o Reabrir, Reanudar si está pospuesta, «Posponer hasta ›» si está abierta y «Asignar ›» si hay lead, con «Abrir»
// arriba, que es lo que ya hace tocar la fila. CÓMO se abre es de app/_ui/useMenuContextual.ts y se dibuja con la pieza de
// la casa (app/_ui/MenuContextual.tsx).
//
// ⚠️ EL «⋯» SIGUE CON SU DROPDOWN, A PROPÓSITO (27/10/2026): la tab la está tocando otro chat y el pedido era sólo sumar el
//    clic derecho. Las dos listas dicen lo mismo y tests/clic-derecho-listas.test.ts las cruza (cada rótulo del «⋯» está
//    acá y al revés). El paso que falta, del chat de Chats: que el «⋯» abra ESTE menú (AGENTS.md, «El "⋯" y el clic
//    derecho de lo mismo son un menú»).
// =============================================================================
import type { EntradaMenuContextual, ItemMenuContextual } from '@/app/_ui/MenuContextual';
import type { ChatResumen } from '@/lib/chats-tipos';
import { MAKO_SETTER } from '@/lib/pipeline';
import type { AccionFila } from './ListaChats';
import { fechaOpcion, opcionesPosponer, type OpcionPosponer } from './ventana-reglas';

type Fila = Pick<ChatResumen, 'estado' | 'leadId' | 'asignado'>;
type Miembro = { nombre: string; foto_url: string | null };

/** Lo que se pospone: las MISMAS opciones del «⋯» (sólo con la conversación abierta). */
export const posponerDe = (c: Fila, ahora: Date): OpcionPosponer[] => (c.estado === 'abierta' ? opcionesPosponer(ahora) : []);

/** Los renglones del menú de una fila. `posponer` sale de `posponerDe` con el MISMO `ahora` que después decide. */
export function itemsFilaChat(c: Fila, equipo: ReadonlyArray<Miembro>, posponer: ReadonlyArray<OpcionPosponer>): EntradaMenuContextual[] {
  const out: EntradaMenuContextual[] = [{ id: 'abrir', label: 'Abrir', icono: 'ver' }, null];
  out.push(c.estado === 'cerrada'
    ? { id: 'reabrir', label: 'Reabrir', icono: 'restaurar' }
    : { id: 'cerrar', label: 'Cerrar', icono: 'check' });
  if (c.estado === 'pospuesta') out.push({ id: 'reanudar', label: 'Reanudar', icono: 'reloj' });
  if (posponer.length) {
    out.push({
      id: 'posponer', label: 'Posponer hasta', icono: 'cronometro',
      hijos: posponer.map((p) => ({ id: `pos:${p.key}`, label: `${p.label} · ${fechaOpcion(p.hasta)}`, icono: 'reloj' })),
    });
  }
  // Asignar = el setter del lead (como el «⋯»): sin lead no hay a quién asignar todavía.
  if (c.leadId != null) {
    const hijos: ItemMenuContextual[] = [];
    if (c.asignado) hijos.push({ id: 'asig:', label: 'Quitar asignación', icono: 'persona-menos' });
    hijos.push({ id: `asig:${MAKO_SETTER}`, label: MAKO_SETTER, icono: 'mako', marcado: c.asignado === MAKO_SETTER });
    for (const m of equipo) {
      if (m.nombre && m.nombre !== MAKO_SETTER) hijos.push({ id: `asig:${m.nombre}`, label: m.nombre, avatar: m.foto_url, marcado: c.asignado === m.nombre });
    }
    out.push({ id: 'asignar', label: 'Asignar', icono: 'persona', hijos });
  }
  return out;
}

/** Qué hace lo elegido: «abrir», la acción de la fila (la misma que manda el «⋯»), o nada (asignar al que ya está). */
export function accionDeMenuChat(id: string, c: Fila, posponer: ReadonlyArray<OpcionPosponer>): 'abrir' | AccionFila | null {
  if (id === 'abrir') return 'abrir';
  if (id === 'cerrar' || id === 'reabrir' || id === 'reanudar') return { tipo: id };
  if (id.startsWith('pos:')) {
    const p = posponer.find((x) => x.key === id.slice(4));
    return p ? { tipo: 'posponer', hasta: p.hasta.toISOString() } : null;
  }
  if (id.startsWith('asig:')) {
    const nombre = id.slice(5);
    return (nombre || null) !== (c.asignado ?? null) ? { tipo: 'asignar', setter: nombre || null } : null;
  }
  return null;
}
