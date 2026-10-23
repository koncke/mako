// =============================================================================
// Traer los contactos de un grupo de WhatsApp al CRM — lo PURO (23/10/2026)
// =============================================================================
// Martín, en la llamada del 23/10 (Fathom 195591907, min 37:27): «una automatización que te agrega de un grupo de WhatsApp,
// te pone todos los números y los contactos en tu CRM de manera automática... sí o sí lo tengo que tener para mañana porque
// lo voy a usar para mí mismo». Lo que habla con Evolution vive en lib/grupo-wa.ts; acá, leer lo que contesta.
//
// MEDIDO el 23/10/2026 en Evolution v2.3.7, sobre la línea viva de la plataforma (11 grupos):
//   · `GET /group/fetchAllGroups/{inst}?getParticipants=false` → 200 en 2 s: [{ id: '…@g.us', subject, size, … }];
//   · `POST /chat/findChats/{inst}` → 200 en 0,2 s (lee la BASE de Evolution, no a WhatsApp): los grupos con los que la línea
//     habló, `remoteJid` '…@g.us' y su nombre en `pushName`;
//   · `GET /group/participants/{inst}?groupJid=` → 200 en 0,4 s: { participants: [{ id: '…@lid', phoneNumber:
//     '…@s.whatsapp.net', name?, admin, imgUrl }] }.
// ⚠️ EL `id` DE UN PARTICIPANTE ES UN `@lid`, NO UN TELÉFONO: un alias interno de WhatsApp (lib/evolution-contactos.ts ya lo
//    dice). El número sale de `phoneNumber`. Uno sin `phoneNumber` (WhatsApp no lo muestra) NO se importa: se cuenta y se dice.
// ⚠️ `fetchAllGroups` en una línea con muchos grupos llegó a no terminar (90 s en el ws11, 11/09/2026: lib/evolution.ts,
//    `sondearSocketDetalle`). Por eso va con tope, y si no contesta, los grupos de la base (`findChats`).

import { limpiarNombreEtiqueta } from './etiquetas-reglas';
import { ambitoDeSecuencia, leadEnAmbito } from './nutricion-ambito';
import { TRIGGER_ETAPA, etapasDe } from './nutricion-etapa';

/** Un grupo de la línea. `tamano`: cuántos son (null si no se sabe: los de la base no lo traen). */
export type GrupoWA = { jid: string; nombre: string; tamano: number | null };
/** Un participante que se puede traer: su teléfono (sólo dígitos, con el código de país) y su nombre, si WhatsApp lo da. */
export type ParticipanteWA = { telefono: string; nombre: string | null };

/** El tope para listar los grupos hablando con WhatsApp; pasado, los de la base de Evolution. */
export const TOPE_GRUPOS_MS = 15_000;
/** El tope para los participantes de UN grupo (medido: 0,4 s). */
export const TOPE_PARTICIPANTES_MS = 30_000;
/** De a cuántos los trae la pantalla: cada lead son varias lecturas y escrituras, y una acción del server tiene 60 s. */
export const TANDA_GRUPO = 40;

const JID_GRUPO = /^[0-9]+(-[0-9]+)?@g\.us$/;
/** ¿Es el id de un grupo? (Lo que llega del navegador se valida antes de ir a Evolution.) */
export const esJidDeGrupo = (s: unknown): s is string => typeof s === 'string' && JID_GRUPO.test(s);

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const porNombre = (a: GrupoWA, b: GrupoWA) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });

/** Los grupos de `fetchAllGroups`. Sin nombre, «Grupo sin nombre». Las comunidades (su «anuncios» sí es un grupo) se dejan. */
export function gruposDeFetchAll(json: unknown): GrupoWA[] {
  if (!Array.isArray(json)) return [];
  const out: GrupoWA[] = [];
  for (const g of json) {
    if (!g || typeof g !== 'object') continue;
    const o = g as Record<string, unknown>;
    if (!esJidDeGrupo(o.id) || o.isCommunity === true) continue;
    out.push({ jid: o.id, nombre: texto(o.subject) ?? 'Grupo sin nombre', tamano: typeof o.size === 'number' && o.size >= 0 ? o.size : null });
  }
  return out.sort(porNombre);
}

/** Los grupos de la base de Evolution (`findChats`): los que la línea tiene en sus chats, con el nombre que guardó. */
export function gruposDeChats(json: unknown): GrupoWA[] {
  if (!Array.isArray(json)) return [];
  const vistos = new Set<string>();
  const out: GrupoWA[] = [];
  for (const c of json) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const jid = esJidDeGrupo(o.remoteJid) ? o.remoteJid : esJidDeGrupo(o.id) ? o.id : null;
    if (!jid || vistos.has(jid)) continue;
    vistos.add(jid);
    out.push({ jid, nombre: texto(o.pushName) ?? texto(o.name) ?? 'Grupo sin nombre', tamano: null });
  }
  return out.sort(porNombre);
}

/** El teléfono de un jid de persona (`549…@s.whatsapp.net`), en dígitos; null si no es uno (un `@lid`, un grupo). */
export function telefonoDeJid(jid: unknown): string | null {
  if (typeof jid !== 'string') return null;
  const m = /^(\d{8,15})(?::\d+)?@s\.whatsapp\.net$/.exec(jid.trim());
  return m ? m[1] : null;
}

/**
 * Los participantes que se pueden traer, sin repetidos y sin la línea misma (`propio`, el número conectado: no es un
 * contacto). `sinNumero`: los que WhatsApp no deja ver (sólo un `@lid`).
 */
export function participantesDe(json: unknown, propio?: string | null): { participantes: ParticipanteWA[]; sinNumero: number } {
  const lista = Array.isArray(json) ? json
    : json && typeof json === 'object' && Array.isArray((json as { participants?: unknown }).participants) ? (json as { participants: unknown[] }).participants
      : [];
  const propioDig = (propio ?? '').replace(/\D/g, '');
  const vistos = new Set<string>();
  const participantes: ParticipanteWA[] = [];
  let sinNumero = 0;
  for (const p of lista) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const telefono = telefonoDeJid(o.phoneNumber) ?? telefonoDeJid(o.id) ?? telefonoDeJid(o.jid);
    if (!telefono) { sinNumero++; continue; }
    if (vistos.has(telefono) || (propioDig && telefono === propioDig)) continue;
    vistos.add(telefono);
    participantes.push({ telefono, nombre: texto(o.name) ?? texto(o.notify) ?? texto(o.pushName) });
  }
  return { participantes, sinNumero };
}

/**
 * La etiqueta de ORIGEN de los que se traen. La elige la persona («Formación de Jan», «Evento Cancún»: el Cerebro, 23/10/2026,
 * para la base de venta de Martín), y viene con el nombre del grupo. Entra en el tope de una etiqueta del CRM
 * (`TOPE_NOMBRE_ETIQUETA`, 40): más larga, `limpiarNombreEtiqueta` la cortaba sin decirlo.
 */
export function etiquetaDeGrupo(nombre: string): string {
  return limpiarNombreEtiqueta(nombre) || 'Grupo de WhatsApp';
}

/** El funnel por defecto: el CRM «Prospección» si el negocio lo tiene (el de la base de venta); si no, el que se mira. */
export function funnelPorDefecto(funnels: ReadonlyArray<{ id: number; nombre: string }>, activo: number | null): number | null {
  return funnels.find((f) => /prospecci[oó]n/i.test(f.nombre))?.id ?? activo;
}

/** La etapa por defecto: «Tibio» si se puede usar (no manda nada); si no, la primera que no manda. */
export function etapaPorDefecto(etapas: ReadonlyArray<{ key: string; label: string; manda: boolean }>, entrada: string | null): string {
  return etapas.find((e) => !e.manda && /tibio/i.test(e.label))?.key ?? entrada ?? '';
}

// ── A qué etapa se pueden traer SIN mandarle nada a nadie ────────────────────────────────────────────────────────────
// Pedido: «No le manda NADA a nadie: sólo trae contactos». Y una etapa puede mandar sola, por dos caminos:
//   1. una automatización ACTIVA que cuelga de esa etapa (`etapa_actual`): la inscribe el movimiento y, aunque no, el BARRIDO
//      de la hora (`leadsDeCohorte`, lib/nutricion.ts) inscribe a todo lead abierto parado ahí con un hito de 90 días, y un
//      lead recién creado lo tiene. «Un Lead Entró» cuelga de la etapa de entrada: importar ahí era darle la bienvenida a
//      todo el grupo;
//   2. una etiqueta VINCULADA a la etapa (mig 0224): al caer ahí el lead la recibe (`espejarEtiquetasDeEtapa`), y poner una
//      etiqueta dispara las automatizaciones de esa etiqueta.
// Esas etapas no se ofrecen (y el servidor las rechaza). Moverlos después, a mano, sí dispara: es lo que quiere quien mueve.

/** Una vista de disparo de una automatización activa (`vistasPorDisparador`, lib/disparadores.ts): lo que hace falta. */
export type VistaDeEtapa = { trigger_tipo: string; etapa: string | null; etapas?: readonly string[] | null; funnel_id: number | string | null };
/** Una etiqueta del CRM con su vínculo a una etapa (`funnel_id` null = el funnel del negocio). */
export type EtiquetaDeEtapa = { etapa_key: string | null; funnel_id: number | string | null; archivada_at?: string | null };

/**
 * Las etapas del funnel `destino` donde caer manda algo. `esDefaultDe` dice si un funnel es el del negocio (null = no se
 * sabe: entonces la automatización se toma como de TODOS, que bloquea de más y nunca de menos).
 */
export function etapasQueDisparan(
  vistas: readonly VistaDeEtapa[], etiquetas: readonly EtiquetaDeEtapa[],
  destino: { id: number; esDefault: boolean }, esDefaultDe: (funnelId: number) => boolean | null,
): Set<string> {
  // El lead nuevo vive en el destino: con el del negocio, `funnel_id` NULL (como lo guarda `createLead`).
  const delLead = destino.esDefault ? null : destino.id;
  const out = new Set<string>();
  for (const v of vistas) {
    if (v.trigger_tipo !== TRIGGER_ETAPA) continue;
    const id = v.funnel_id == null || v.funnel_id === '' ? null : Number(v.funnel_id);
    const ambito = ambitoDeSecuencia(id, id == null ? null : esDefaultDe(id));
    if (leadEnAmbito(ambito, delLead)) for (const k of etapasDe(v)) out.add(k);
  }
  for (const e of etiquetas) {
    if (!e.etapa_key || e.archivada_at) continue;
    const id = e.funnel_id == null || e.funnel_id === '' ? null : Number(e.funnel_id);
    if ((id == null && destino.esDefault) || id === destino.id) out.add(e.etapa_key);
  }
  return out;
}
