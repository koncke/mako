// =============================================================================
// Las charlas con MaKo de las TABS, para el grafo del Second Brain (23/10/2026, chat «Chats de las tabs»)
// =============================================================================
// Martín, 17/10/2026 19:31: «todo siempre guardarse en chats en el Ops Center e ir guardándose en el grafo del Second
// Brain». El Ops Center ya las lista (lib/chat-mako-indice.ts: las de antes, las de las tabs de la persona, Automations y los
// editores); el grafo sólo sumaba las de Offer y las de la estrella de la persona. Esto traduce ESAS MISMAS listas —las que la
// persona ve en su Ops Center, con la misma regla de quién ve qué— a lo que el grafo dibuja: de qué tab es cada charla y de qué
// entidad habla. Nada se copia: el grafo es una proyección (docs/diseno-chats-de-mako.md, «Cada conversación queda…»).
//
// La tab sale de la MISMA regla que agrupa el Ops Center (lib/chat-mako-reglas.ts → origenDeClave, y el origen que el índice ya
// trae dicho: «CRM», «Ficha · Ana»). La entidad, de la clave: `crm:<funnel>` y `lead:<id>`. Las demás (una hoja, una landing,
// una automatización, un diseño) no son nodos del grafo, así que no se inventa a qué colgarlas: su tab va a la raíz.
//
// Puro (sin `server-only`): lo prueba tests/cerebro-chats-tabs.test.ts.
// =============================================================================

import { EDITORES, ORIGEN_AUTOMATIONS, ORIGEN_PREGUNTALE, origenDeClave, type TipoEditor } from './chat-mako-reglas';
import type { ChatMakoVivo } from './cerebro-vivo';

/** Lo que devuelven las lecturas del índice (lib/chat-mako-indice.ts), con sólo lo que el grafo usa. */
export type FuentesDeChatsDeTabs = {
  /** `chatsDeAntes` y `chatsDeLasTabs`: su clave (visible) y, si el índice ya la dijo, su origen. */
  antes: ReadonlyArray<{ id: number; titulo: string | null; clave: string; updatedAt: string; origen?: string | null }>;
  /** `chatsDeAutomations`: una por automatización. */
  automations: ReadonlyArray<{ id: number; titulo: string; updatedAt: string }>;
  /** `chatsDeLosEditores`: una por persona y por diseño o proyecto. */
  editores: ReadonlyArray<{ tipo: TipoEditor; clave: string; titulo: string | null; updatedAt: string }>;
};

/** La entidad de la que habla una charla, si su clave la nombra y es algo que el grafo dibuja. */
function entidadDeClave(clave: string): ChatMakoVivo['entidad'] {
  const k = clave.replace(/^persona:[^:]+:/, '');
  const crm = /(?:^|:)crm:(\d+)$/.exec(k);
  if (crm) return { tipo: 'funnel', id: Number(crm[1]) };
  const lead = /(?:^|:)lead:(\d+)$/.exec(k);
  if (lead) return { tipo: 'lead', id: Number(lead[1]) };
  return null;
}

/**
 * Las charlas de las tabs, con su tab y su entidad. Lo que no es de una tab no entra: «Pregúntale a MaKo» (el /mako de antes) y
 * lo que no tiene origen conocido. Las de Offer tampoco: el grafo ya las cuelga de la oferta (lib/cerebro-vivo.ts).
 */
export function chatsDeTabParaElGrafo(f: FuentesDeChatsDeTabs): ChatMakoVivo[] {
  const out: ChatMakoVivo[] = [];
  const vistas = new Set<number>();
  for (const c of f.antes) {
    // `chatsDeAntes` y `chatsDeLasTabs` no se pisan, pero una misma sesión no entra dos veces aunque algún día lo hagan.
    if (vistas.has(c.id)) continue;
    vistas.add(c.id);
    // «Ficha · Ana» es la tab «Ficha»: el nombre del lead es de la charla, no del grupo.
    const origen = c.origen?.trim() || origenDeClave(c.clave);
    const tab = origen?.startsWith('Ficha') ? 'Ficha' : origen;
    if (!tab || tab === ORIGEN_PREGUNTALE) continue;
    out.push({ id: `antes:${c.id}`, titulo: c.titulo, updatedAt: c.updatedAt, tab, entidad: entidadDeClave(c.clave) });
  }
  for (const a of f.automations) out.push({ id: `automations:${a.id}`, titulo: a.titulo, updatedAt: a.updatedAt, tab: ORIGEN_AUTOMATIONS, entidad: null });
  for (const e of f.editores) out.push({ id: `${e.tipo}:${e.clave}`, titulo: e.titulo, updatedAt: e.updatedAt, tab: EDITORES[e.tipo].origen, entidad: null });
  return out;
}
