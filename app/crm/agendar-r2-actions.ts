'use server';

// =============================================================================
// Agendar la R2 desde la ficha del lead — las tres acciones que eso necesita
// =============================================================================
// El caso: estás saliendo de la R1, el lead dijo que sí, y la segunda reunión
// queda ahí mismo en vez de «te mando el link».
//
// Las dos piezas caras ya existían y están probadas contra la cuenta real
// (`huecosDisponibles` y `reservarReunion`, lib/calendly-agenda.ts). Lo único que
// faltaba era cablearlas a la ficha, y el molde de cómo se cablean lo escribió el
// doer de WhatsApp (lib/mako-doer-acciones.ts → caso 'agendar_reunion'): se
// revalida el hueco, se intenta la reserva directa y si Calendly la rechaza se
// cae al formulario prellenado. Es el mismo orden acá, a propósito — el día que
// Calendly arregle `POST /invitees` las dos puertas empiezan a reservar solas.
//
// ⚠️ ARCHIVO APARTE Y NO `actions.ts`: en un módulo `'use server'` CADA export es
// un endpoint, así que un archivo chico es también una superficie chica. El CRM ya
// tiene cinco (auto-actions, deal-actions, insights-actions, mako-confirm-actions).
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { credWs, integracionConectada } from '@/lib/credenciales';
import { eventTypeDeReunion, huecosDisponibles, linkParaAgendar, reservarReunion } from '@/lib/calendly-agenda';
import { getLead, logLeadEvent } from '@/lib/leads';
import { getUsuarioActual } from '@/lib/auth';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { getWorkspaceActual } from '@/lib/workspace';
import { fechaHoraEnTz } from '@/lib/date-utils';
import { agruparHuecos, puedeAgendarR2, type DiaConHuecos } from './agendar-r2';

/**
 * La ventana que se le pide a Calendly. Su tope por llamada es 31 días
 * (`huecosDisponibles` lo acota), y es la misma que usa el doer: si acá fueran 7
 * y allá 31, la misma pregunta tendría dos respuestas según por dónde entraste.
 */
const DIAS_VENTANA = 31;

const texto = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * El autor del rastro en el historial.
 *
 * ⚠️ Es el gemelo de `autorActual()` de app/crm/actions.ts:97 y no se puede
 * importar de ahí: ese archivo es `'use server'`, así que exportar un helper lo
 * convertiría en un endpoint más. El lugar correcto es un módulo pelado que
 * importen los dos; queda declarado como pendiente para no tocar `actions.ts`
 * mientras otra sesión escribe en paralelo sobre este clon.
 */
async function autor(): Promise<string> {
  try {
    return (await getUsuarioActual())?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}

/** La pantalla se actualiza sola: se invalida la lectura y se re-renderiza. */
function refrescar(leadId: number): void {
  try { updateTag(TAG.leads); } catch { /* la caché vence por TTL */ }
  revalidatePath('/crm');
  revalidatePath(`/crm/${leadId}`);
}

/**
 * ¿Se dibuja el control de agendar la R2 en este negocio?
 *
 * Dos lecturas de credenciales y nada más: NO le pega a Calendly. Esto lo
 * pregunta cada ficha que se abre, y un viaje a la API de Calendly por apertura
 * sería pagar la red para decidir si se pinta un botón.
 *
 * Fail-closed: sin workspace resuelto (admin que no está mirando a nadie) o con
 * cualquier error, `false`. El control que no se dibuja no engaña a nadie; uno
 * que se dibuja y contesta «servicio inválido» se lee como que la app está rota.
 */
export async function puedeAgendarR2Action(): Promise<boolean> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return false;
    const [calendlyConectada, eventTypeR2] = await Promise.all([
      integracionConectada('calendly', ws),
      credWs('CALENDLY_EVENT_TYPE_J2', ws),
    ]);
    return puedeAgendarR2({ calendlyConectada, eventTypeR2 });
  } catch {
    return false;
  }
}

export type HuecosR2 =
  | { ok: true; dias: DiaConHuecos[]; tz: string }
  | { ok: false; error: string };

/**
 * Los horarios REALES libres para la R2, agrupados por día en la zona del negocio.
 *
 * Se piden al abrir el control, no al cargar la ficha: es una llamada a Calendly
 * y la enorme mayoría de las fichas se abren para otra cosa.
 */
export async function huecosR2Action(): Promise<HuecosR2> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return { ok: false, error: 'No se pudo resolver el negocio de esta sesión.' };
    const tz = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
    const et = await eventTypeDeReunion('R2');
    const huecos = await huecosDisponibles(et.uri, { dias: DIAS_VENTANA });
    return { ok: true, dias: agruparHuecos(huecos, tz), tz };
  } catch (e) {
    return { ok: false, error: texto(e) };
  }
}

export type ReservaR2 =
  /** Calendly creó el evento y mandó la invitación a los dos. */
  | { ok: true; modo: 'reserva'; cuando: string; joinUrl: string | null }
  /** Calendly rechazó la reserva directa: queda el formulario prellenado. */
  | { ok: true; modo: 'link'; url: string }
  | { ok: false; error: string };

/**
 * Reserva la R2 del lead en el hueco elegido.
 *
 * `startIso` tiene que ser uno de los que devolvió `huecosR2Action`, tal cual.
 */
export async function reservarR2Action(leadId: number, startIso: string): Promise<ReservaR2> {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Ese lead no existe.' };
  const iso = String(startIso ?? '').trim();
  if (!iso) return { ok: false, error: 'Elige un horario de la lista.' };

  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return { ok: false, error: 'No se pudo resolver el negocio de esta sesión.' };
    // `getLead` lee por `getTenantDb()`, o sea scopeado al workspace de la sesión:
    // un id de otro inquilino no devuelve fila, no devuelve un lead ajeno.
    const lead = await getLead(id);
    if (!lead) return { ok: false, error: 'Ese lead no existe.' };
    const email = lead.email?.trim() ?? '';
    if (!email) return { ok: false, error: 'Calendly exige el email del lead para reservar.' };

    const tz = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
    const et = await eventTypeDeReunion('R2');

    // ⚠️ EL HUECO SE REVALIDA CONTRA CALENDLY, ACÁ Y AHORA. Entre que se dibujó la
    // lista y que alguien tocó «Reservar» pueden pasar minutos, y en el medio ese
    // horario se lo puede haber llevado otro. El que manda es el valor REAL de
    // Calendly, no el que quedó dibujado en la pantalla.
    const huecos = await huecosDisponibles(et.uri, { dias: DIAS_VENTANA });
    if (!huecos.some((h) => h.startIso === iso)) {
      return { ok: false, error: 'Ese horario ya se ocupó. Elige otro.' };
    }

    const cuando = fechaHoraEnTz(iso, tz);
    const quien = await autor();

    try {
      const reserva = await reservarReunion({
        eventType: et, startIso: iso,
        invitado: { email, nombre: lead.nombre, timezone: tz },
      });
      // NO se escribe `fecha_junta_2` acá: reservar dispara el webhook
      // `invitee.created` de Calendly, que es el único que escribe esas columnas
      // (y de paso guarda las respuestas del formulario y el UTM). Escribirlo
      // también desde acá sería el mismo dato en dos lugares, con la versión de
      // acá quedándose vieja el día que el webhook cambie.
      await logLeadEvent(id, 'Reunión agendada', `R2 reservada en Calendly para el ${cuando}, desde la ficha del lead.`, quien);
      refrescar(id);
      return { ok: true, modo: 'reserva', cuando, joinUrl: reserva.joinUrl };
    } catch (e) {
      // Hoy Calendly rechaza `POST /invitees` en todo event type con videollamada
      // (ver la nota 3 del encabezado de lib/calendly-agenda.ts: se descartaron
      // CINCO formas del pedido y las cinco dan el mismo error, así que no es lo
      // que mandamos). El formulario prellenado es la misma jugada que el popup
      // del CRM y deja la reserva a un toque.
      const motivo = texto(e);
      console.warn(`[agendar-r2] reserva directa rechazada (lead ${id}): ${motivo} — queda el formulario prellenado`);
      const url = await linkParaAgendar({
        eventType: et,
        invitado: { nombre: lead.nombre, email },
        // Un solo uso: se quema al reservar, así que no queda un link vivo dando
        // vueltas en un chat.
        unUso: true,
      });
      await logLeadEvent(id, 'Link de agenda enviado', `Formulario de Calendly de la R2 prellenado desde la ficha del lead (Calendly rechazó la reserva directa: ${motivo}).`, quien);
      refrescar(id);
      return { ok: true, modo: 'link', url };
    }
  } catch (e) {
    return { ok: false, error: texto(e) };
  }
}
