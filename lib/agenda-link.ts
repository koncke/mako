// =============================================================================
// agenda-link — el link de AGENDA del negocio (Calendly o Cal.com), para agendar una llamada
// =============================================================================
// Martín, 14/10/2026: «agregar el calendly o cal, para agendar llamadas». Lo usan «Crear › Agendar llamada» del
// Calendario (app/calendario/AgendarLlamada.tsx) y la API de MaKo (`link_agenda_llamada`, área calendario).
//
// La reserva NO se escribe desde acá: la persona (o su prospecto) reserva en la página de Calendly o Cal.com, y el
// webhook de cada uno la mete en el CRM (`junta_1_at`/`junta_2_at`), de donde la lee la capa «Llamadas» del Calendario.
//
//   · CALENDLY primero: es el camino medido (`eventTypeDeReunion`, lib/calendly-agenda.ts, el mismo que usa el CRM
//     para su botón «Agendarla por Calendly»). Del event type de la R1 / R2 sale su `scheduling_url`.
//   · CAL.COM si no hay Calendly: `CALCOM_EVENT_TYPE_J1`/`_J2` + el usuario de la API key (`linkDeReservaCalcom`,
//     lib/calcom.ts, NO MEDIDO contra una cuenta real: ver ahí qué se niega a armar).
//   · Sin ninguno: lo dice, y cuáles se pueden conectar (`faltan`), para que la pantalla abra ESE modal de integración.
//
// ⚠️ Nunca el link de otro negocio: todo sale de las credenciales del workspace en curso (`credWs`). Es la historia de
//    app/crm/calendly-widget.ts, que tuvo la agenda del dueño hardcodeada y se la servía a todos.

import 'server-only';
import { credWs } from './credenciales';
import { eventTypeDeReunion } from './calendly-agenda';
import { linkDeReservaCalcom, perfilDeCalcom } from './calcom';

export type ProveedorAgenda = 'calendly' | 'calcom';

export type LinkDeAgenda =
  | { ok: true; url: string; proveedor: ProveedorAgenda; reunion: string | null }
  | { ok: false; motivo: string; faltan: ProveedorAgenda[] };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** El link de la página de reserva de la R1 (o la R2) del negocio en curso. */
export async function linkDeAgenda(cual: 'R1' | 'R2'): Promise<LinkDeAgenda> {
  const [tokenCalendly, etCalcom, keyCalcom] = await Promise.all([
    credWs('CALENDLY_API_TOKEN'),
    credWs(cual === 'R1' ? 'CALCOM_EVENT_TYPE_J1' : 'CALCOM_EVENT_TYPE_J2'),
    credWs('CALCOM_API_KEY'),
  ]);

  if (tokenCalendly) {
    try {
      const et = await eventTypeDeReunion(cual);
      const url = et.schedulingUrl?.trim() ?? '';
      if (/^https:\/\//i.test(url)) return { ok: true, url, proveedor: 'calendly', reunion: et.nombre || null };
      return { ok: false, motivo: 'Ese tipo de evento de Calendly no tiene página de reserva.', faltan: ['calendly'] };
    } catch (e) {
      const m = msg(e);
      // Los dos de configuración (lib/calendly-agenda.ts): se arreglan en el modal de Calendly.
      if (/No está configurado el event type/i.test(m)) return { ok: false, motivo: `Falta elegir la ${cual} en Calendly.`, faltan: ['calendly'] };
      if (/no coincide con ninguno activo/i.test(m)) return { ok: false, motivo: `La ${cual} de Calendly no está activa.`, faltan: ['calendly'] };
      console.error('[agenda-link] calendly:', m);
      return { ok: false, motivo: 'Calendly no contestó. Prueba de nuevo.', faltan: [] };
    }
  }

  if (etCalcom) {
    const directo = linkDeReservaCalcom(etCalcom, null);
    if (directo) return { ok: true, url: directo, proveedor: 'calcom', reunion: null };
    if (!keyCalcom) return { ok: false, motivo: 'Falta la API key de Cal.com para armar el link.', faltan: ['calcom'] };
    const url = linkDeReservaCalcom(etCalcom, await perfilDeCalcom(keyCalcom));
    if (url) return { ok: true, url, proveedor: 'calcom', reunion: null };
    return { ok: false, motivo: 'No pude armar el link de Cal.com.', faltan: ['calcom'] };
  }

  return { ok: false, motivo: 'Conecta Calendly o Cal.com para agendar desde aquí.', faltan: ['calendly', 'calcom'] };
}
