// =============================================================================
// agenda-evento-etapa — un evento de Calendly o Cal.com VINCULADO a una etapa de reunión (puro)
// =============================================================================
// Pedido de Martín (16/10/2026, por el chat Cerebro): «que una etapa catalogada como "reunion" se
// pueda vincular a un evento de calendly o cal, para que sepa que leads deben caer allí cuando se
// agendan y no caer en otra etapa u otro funnel». Hasta hoy cada negocio tenía UN tipo de evento
// para la R1 y UNO para la R2 (CALENDLY_EVENT_TYPE_J1/J2, CALCOM_EVENT_TYPE_J1/J2), y toda reserva
// caía en el funnel PRINCIPAL: con varios funnels, el agendado de un producto aparecía en otro.
//
// LA REFERENCIA (documentación pública; no se pudo entrar a una cuenta):
//   · HubSpot + Calendly (calendly.com/help/calendly-hubspot): la integración crea o actualiza el
//     CONTACTO y le suma la reunión como actividad; «if the contact already exists in HubSpot, a
//     meeting activity is added without changing the contact's existing details». El negocio
//     (deal) en un pipeline y una etapa lo crea un WORKFLOW de HubSpot filtrado por la reunión
//     (knowledge.hubspot.com/workflows/create-meeting-based-workflows: «create a deal record anytime
//     a demo meeting is booked»). Reagendar actualiza la actividad; cancelar la marca «[Canceled]»
//     y NO mueve el negocio.
//   · Pipedrive: no tiene una integración propia con Calendly (la del Marketplace es de terceros:
//     Outfunnel, Ulgebra) y su Scheduler sólo crea una ACTIVIDAD en el calendario. Outfunnel
//     (support.outfunnel.com, «How to set up a connection between Calendly and your CRM») elige el
//     TIPO DE REUNIÓN en la conexión y de ahí crea el lead o el deal; «if the contact exists, then
//     the contact owner in the CRM is not changed»; reagendar y cancelar: «coming soon».
//
// LO QUE SE TOMÓ: el vínculo es POR TIPO DE EVENTO → (embudo, etapa), uno solo por evento; varios
// eventos pueden ir a la misma etapa. Un contacto que ya existe NO cambia de casa: se lo AGREGA al
// embudo del evento (lib/lead-funnel.ts, la regla de Martín del 06/10). Cancelar no mueve la tarjeta
// (borra la fecha, como hoy). Y un evento SIN vínculo hace exactamente lo de antes.
//
// Puro (sin `server-only` ni nada de node): lo ejecutan los tests, el webhook y la pantalla.
// La base y la API de cada proveedor viven en lib/agenda-evento-etapa-server.ts.
// =============================================================================

import { reunionesDe, slotPorIndice } from './funnel-etapas';
import { esTerminal, recorridoDe, type Stage } from './pipeline';

export type ProveedorAgenda = 'calendly' | 'calcom';
export const PROVEEDORES_AGENDA: readonly ProveedorAgenda[] = ['calendly', 'calcom'];
export const esProveedorAgenda = (v: unknown): v is ProveedorAgenda => v === 'calendly' || v === 'calcom';

/** Cómo se llama cada proveedor en la pantalla y en el historial del lead (el `canal` de lib/leads.ts). */
export const NOMBRE_PROVEEDOR: Record<ProveedorAgenda, string> = { calendly: 'Calendly', calcom: 'Cal.com' };

/**
 * El servicio de `webhook_routing` de cada proveedor: el MISMO que usan sus credenciales
 * (`ROUTING_CREDS`, lib/webhook-routing.ts). Cal.com va aparte de Calendly a propósito: un slug como
 * «llamada» es plausible en los dos y compartir el espacio de nombres rutearía mal.
 */
export const SERVICIO_DE_RUTEO: Record<ProveedorAgenda, 'calendly' | 'calcom'> = { calendly: 'calendly', calcom: 'calcom' };

/** Las credenciales de la R1 y la R2 de cada proveedor (lo de antes del vínculo, que sigue valiendo sin él). */
export const CREDS_DE_REUNION: Record<ProveedorAgenda, { R1: string; R2: string }> = {
  calendly: { R1: 'CALENDLY_EVENT_TYPE_J1', R2: 'CALENDLY_EVENT_TYPE_J2' },
  calcom: { R1: 'CALCOM_EVENT_TYPE_J1', R2: 'CALCOM_EVENT_TYPE_J2' },
};

/** Un tope: un identificador de Calendly mide ~70 caracteres. Lo mismo que el webhook deja pasar (≤ 300). */
export const MAX_IDENTIFICADOR = 300;

/** Una fila de `agenda_evento_etapa` (mig 0293), ya leída. */
export type VinculoEvento = {
  workspaceId: number;
  proveedor: ProveedorAgenda;
  /**
   * El identificador del tipo de evento TAL COMO LLEGA en el webhook: en Calendly la URI del event
   * type (`scheduled_event.event_type`), en Cal.com su id (`eventTypeId`). Es el mismo valor que
   * queda en `webhook_routing`, que es lo que hace que el webhook sepa de qué negocio es la reserva.
   */
  identificador: string;
  nombre: string | null;
  funnelId: number;
  etapa: string;
};

type EtapaDelFunnel = { key: string; kind?: string | null; marcadaComo?: string | null; band?: string | null; label?: string | null };

/** Un embudo ACTIVO del negocio, con su pipeline (las etapas guardadas, que traen el `kind`). */
export type FunnelDelNegocio = { id: number; workspaceId: number; pipeline: readonly EtapaDelFunnel[] };

/** A dónde va una reserva de un evento vinculado. */
export type RutaDeReserva = { funnelId: number; etapa: string; reunion: 'R1' | 'R2'; identificador: string };

/** Comparación de identificadores: exacta salvo espacios y mayúsculas, como el valor de `webhook_routing`. */
export const mismoIdentificador = (a: string | null | undefined, b: string | null | undefined): boolean => {
  const x = (a ?? '').trim().toLowerCase();
  return x !== '' && x === (b ?? '').trim().toLowerCase();
};

/**
 * Qué reunión es una etapa: sale del ORDEN de las reuniones del embudo (`reunionesDe`), no de las
 * credenciales J1/J2. La primera reunión guarda su fecha en `fecha_junta_1`, la segunda en
 * `fecha_junta_2`; de la tercera en adelante no hay columna (`slotPorIndice` → null).
 *
 * ⚠️ Con `reunionesDe` y NO con `slotDeReunion`: esa cae al pipeline por defecto si el embudo viene
 * vacío, y acá un embudo vacío es un embudo sin la etapa — no uno con «Agenda R1».
 */
export function reunionDeEtapa(pipeline: readonly EtapaDelFunnel[], etapa: string): 'R1' | 'R2' | null {
  const slot = slotPorIndice(reunionesDe(pipeline.map((s) => ({ key: s.key, kind: s.kind ?? undefined }))).indexOf(etapa));
  return slot ? (slot.cual === 'r1' ? 'R1' : 'R2') : null;
}

/**
 * Por qué NO se puede vincular un evento a esa etapa, o null si se puede. Lo pregunta el server al
 * vincular, y el ruteo lo vuelve a mirar en cada reserva (la etapa pudo cambiar de tipo después).
 */
export function problemaDeVinculo(pipeline: readonly EtapaDelFunnel[], etapa: string): string | null {
  const e = pipeline.find((s) => s.key === etapa);
  if (!e) return 'Esa etapa no está en ese funnel.';
  if (e.kind !== 'reunion') return 'Solo una etapa de tipo Reunión puede tener un evento de agenda.';
  if (!reunionDeEtapa(pipeline, etapa)) return 'Es la tercera reunión del funnel: no tiene dónde guardar la fecha.';
  return null;
}

/**
 * EL RUTEO: a qué embudo y etapa va la reserva de un evento, o null si ese evento no está vinculado
 * (y entonces todo sigue como antes: J1/J2 y el funnel principal).
 *
 * `candidatos` son los identificadores que trae el webhook (Calendly: event_type, name, uri; Cal.com:
 * id, slug, título), los mismos que prueba contra `webhook_routing`.
 *
 * Tres cortes, y los tres devuelven null en vez de adivinar:
 *   · de OTRO negocio: sólo cuentan los vínculos y embudos del workspace `ws` —el que resolvió el
 *     webhook—, aunque quien llama pase filas de más. Un evento vinculado en el negocio A no rutea a
 *     nada del negocio B;
 *   · que ya no vale: el embudo no está entre los activos, la etapa ya no existe, ya no es una
 *     reunión o es la tercera (`problemaDeVinculo`);
 *   · ambiguo: dos vínculos que calzan con la reserva y dicen lugares distintos. No puede pasar (un
 *     evento tiene un solo vínculo y se guarda con su identificador canónico); si pasara, desempatar
 *     sería adivinar.
 */
export function rutaDeEvento(input: {
  ws: number;
  proveedor: ProveedorAgenda;
  candidatos: readonly (string | null | undefined)[];
  vinculos: readonly VinculoEvento[];
  funnels: readonly FunnelDelNegocio[];
}): RutaDeReserva | null {
  const candidatos = input.candidatos.filter((c): c is string => !!c && c.trim() !== '' && c.length <= MAX_IDENTIFICADOR);
  if (!candidatos.length) return null;
  const calzan = input.vinculos.filter((v) => v.workspaceId === input.ws && v.proveedor === input.proveedor
    && candidatos.some((c) => mismoIdentificador(c, v.identificador)));
  const rutas: RutaDeReserva[] = [];
  for (const v of calzan) {
    const f = input.funnels.find((x) => x.id === v.funnelId && x.workspaceId === input.ws);
    if (!f || problemaDeVinculo(f.pipeline, v.etapa)) continue;
    const reunion = reunionDeEtapa(f.pipeline, v.etapa);
    if (reunion) rutas.push({ funnelId: f.id, etapa: v.etapa, reunion, identificador: v.identificador });
  }
  const distintas = new Set(rutas.map((r) => `${r.funnelId}|${r.etapa}`));
  return distintas.size === 1 ? rutas[0] : null;
}

/**
 * Qué hace el webhook con una reserva: qué reunión es, si puede CREAR un lead y a dónde va.
 *
 * Es la decisión de los DOS webhooks (Calendly y Cal.com) en un solo lugar, para que se pruebe
 * ejecutándola:
 *   · sin vínculo (`ruta` null) es EXACTAMENTE lo de antes: la R la dicen J1/J2 (`tipoJunta`), sólo
 *     la R1 (o un evento desconocido) crea, y no hay destino: el lead nuevo nace sin funnel (el
 *     principal) y uno que ya existe se queda donde está;
 *   · con vínculo, la R la dice la ETAPA y el destino es ese embudo y esa etapa.
 * ⚠️ LA R2 NUNCA CREA UN LEAD, con vínculo o sin él: crear desde la segunda reunión fabrica un lead
 * que nació en la mitad del embudo, sin R1 y sin origen (la regla de los dos webhooks).
 */
export function decidirReserva(ruta: RutaDeReserva | null, tipoJunta: 'j1' | 'j2' | 'desconocido'): {
  reunion: 'R1' | 'R2';
  puedeCrearLead: boolean;
  destino: { funnelId: number; etapa: string } | null;
} {
  const reunion = ruta ? ruta.reunion : tipoJunta === 'j2' ? 'R2' : 'R1';
  return {
    reunion,
    puedeCrearLead: reunion === 'R1',
    destino: ruta ? { funnelId: ruta.funnelId, etapa: ruta.etapa } : null,
  };
}

/**
 * ¿La reserva MUEVE al lead a la etapa vinculada, dentro de ese embudo? `actual` es la etapa en la
 * que está hoy en ESE embudo (null si recién entra).
 *
 *   · Ya está ahí → no.
 *   · Está en una TERMINAL (ganado, perdido, descalificado, no responde) → no: lo de hoy, porque una
 *     reserva no cambia el `estado_lead` y la tarjeta de un ganado sigue en Ganado. Lo decide una
 *     persona, como en HubSpot, donde la reunión se suma y el negocio no se toca.
 *   · Está MÁS ADELANTE en el recorrido (en la R2 y reserva la R1 de nuevo) → no: una reserva no
 *     hace retroceder a nadie.
 *   · Si no (la entrada, una etapa anterior, una nutrición, una etapa que el embudo ya no tiene) → sí.
 *
 * `estadoLead` sólo se pasa para la CASA (el `estado_lead` es de la casa): un lead perdido o ganado
 * con la tarjeta en otra columna tampoco se mueve. `setPipelineStage` lo reabriría.
 */
export function moverAlReservar(pipeline: readonly EtapaDelFunnel[], actual: string | null | undefined, vinculada: string, estadoLead?: string | null): boolean {
  const a = (actual ?? '').trim();
  if (a === vinculada) return false;
  if (a && esTerminal(a)) return false;
  if (estadoLead != null && estadoLead !== 'abierto') return false;
  const orden = recorridoDe(pipeline.map((s) => ({
    key: s.key, kind: (s.kind ?? undefined) as Stage['kind'], marcadaComo: (s.marcadaComo ?? undefined) as Stage['marcadaComo'],
  }))).map((s) => s.key);
  const iA = orden.indexOf(a);
  const iV = orden.indexOf(vinculada);
  return !(iA >= 0 && iV >= 0 && iA > iV);
}

/**
 * Los identificadores de un proveedor que el negocio NECESITA en `webhook_routing`: los de sus
 * credenciales de R1/R2 y los de sus eventos vinculados. Sin fila, el webhook no sabe de quién es la
 * reserva y la descarta («sin_ruteo»).
 *
 * Lo usan las dos puertas que SACAN filas: desvincular un evento (sólo se suelta si ya nadie lo usa)
 * y borrar una credencial de R1/R2 (`eliminarCredencial` borra TODAS las filas del servicio, así que
 * después se vuelven a reclamar éstas).
 */
export function identificadoresNecesarios(input: {
  proveedor: ProveedorAgenda;
  creds: readonly (string | null | undefined)[];
  vinculos: readonly Pick<VinculoEvento, 'proveedor' | 'identificador'>[];
}): string[] {
  const out: string[] = [];
  const sumar = (v: string | null | undefined) => {
    const t = (v ?? '').trim();
    if (t && !out.some((x) => mismoIdentificador(x, t))) out.push(t);
  };
  for (const c of input.creds) sumar(c);
  for (const v of input.vinculos) if (v.proveedor === input.proveedor) sumar(v.identificador);
  return out;
}

/** La tabla que falta (la mig 0293 sin aplicar): PostgREST la nombra PGRST205 y Postgres 42P01. */
export const faltaLaTabla = (e: { code?: string | null } | null | undefined): boolean => !!e && (e.code === 'PGRST205' || e.code === '42P01');
