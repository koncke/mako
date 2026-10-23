import 'server-only';

// =============================================================================
// cs-crear-cliente — cargar un cliente que nunca pasó por el CRM
// =============================================================================
// El alta de la cartera de Customer Success. Vivía adentro de `crearClienteAction`
// (app/customer-success/actions.ts) y se mudó acá el 23/10/2026 para que la usen también el alta de
// un alumno desde el curso y la API de MaKo (P0-3 de la auditoría de la API): un runner no llama
// server actions, y una segunda copia del alta es la que se queda vieja. La action sigue haciendo lo
// suyo —la puerta, el `revalidatePath`— y delega acá.
//
// ⚠️ NO HAY TABLA DE CLIENTES, Y ESA ES LA DECISIÓN. «Al cargarse se debería cargar en el CRM también»
// (26/09/2026) — y la única forma de que eso no se desincronice nunca es que no haya dos lugares: un
// cliente ES un lead ganado. Con una tabla propia habría clientes que el CRM no conoce, y el día que
// alguien busque a uno por teléfono no lo encuentra.
//
// ⚠️ Y PASA POR `createLead`, no por un insert propio: ahí viven la detección de duplicados, la
// auto-asignación de vendedor y el alta del hilo de WhatsApp. Un insert a mano se saltea las tres sin
// que nada falle.
// =============================================================================

import { getTenantDb } from './workspace';
import { createLead, updateLead, logLeadEvent } from './leads';
import { LeadDuplicadoError, type MotivoDuplicado } from './leads-duplicados';
import { VENTA_SIN_COBRO } from './venta-tipo';
import { ORIGEN_LEAD } from '@/app/crm/origen-lead';

export type DatosClienteNuevo = {
  nombre: string; empresa?: string; email?: string; telefono?: string;
  /** Un becado o bonificado (#747): la venta se marca «sin cobro» (lib/venta-tipo.ts). */
  sinCobro?: boolean;
  /**
   * Crearlo AUNQUE se parezca a otro (07/10/2026, el alta desde el editor del curso). Es la regla de
   * lib/leads-duplicados.ts: «si el usuario lo quiere duplicar bueno, que lo pueda hacer, pero no
   * cargarlo automáticamente». Lo manda SÓLO alguien que vio el aviso de duplicado.
   */
  permitirDuplicado?: boolean;
};

export type ClienteNuevo = {
  ok: boolean; leadId?: number; error?: string;
  /**
   * Con quién choca, cuando choca (07/10/2026). El alta desde el editor del curso necesita el LEAD para
   * ofrecer «usar ese» en vez de fallar.
   */
  duplicados?: Array<{ leadId: number; nombre: string; motivo: MotivoDuplicado; texto: string }>;
};

/** Crea el cliente: crea el LEAD en el CRM y lo marca ganado. `por` firma el historial. */
export async function crearClienteGanado(datos: DatosClienteNuevo, por: string): Promise<ClienteNuevo> {
  const nombre = (datos.nombre ?? '').trim();
  if (nombre.length < 2) return { ok: false, error: 'Falta el nombre.' };
  const email = (datos.email ?? '').trim() || null;
  const telefono = (datos.telefono ?? '').trim() || null;
  if (!email && !telefono) {
    return { ok: false, error: 'Carga un email o un teléfono: sin eso el cliente es incontactable.' };
  }

  try {
    // ⚠️ `carga_manual`, el MISMO valor que el alta del CRM, y no uno propio de esta
    // pantalla: la pregunta que contesta la columna es «¿cómo llegó esta persona?», y
    // la respuesta —alguien la tipeó— no cambia porque el formulario viva en otra tab.
    // Un valor por pantalla partiría el filtro de origen del CRM en dos opciones que
    // significan lo mismo. De dónde se lo cargó es otra pregunta, y la contesta el
    // historial del lead, no este campo.
    const lead = await createLead({
      nombre, empresa: (datos.empresa ?? '').trim() || null, email, telefono,
      origen_lead: ORIGEN_LEAD.carga_manual.id,
      permitirDuplicado: datos.permitirDuplicado === true,
    });
    // El desenlace va en una segunda escritura porque `createLead` no lo acepta: su
    // trabajo es dar de alta un lead, y `estado_lead` es del recorrido. `updateLead`
    // deriva `cerro` solo (lib/leads.ts), así que las dos columnas quedan de acuerdo.
    await updateLead(lead.id, { estado_lead: 'ganado' });
    // «Sin cobro» (#747): el tipo de venta va directo porque `updateLead` no escribe
    // `venta_tipo` —el wizard del CRM hace lo mismo—. Con eso el CRM le da el monto, el
    // plan y el comprobante por contestados, y las métricas de venta no lo cuentan.
    // ⚠️ El lead YA existe y ya es ganado: si esto falla, se dice — reintentar el alta
    // chocaría con su propio duplicado.
    if (datos.sinCobro === true) {
      const { error } = await (await getTenantDb()).from('leads').update({ venta_tipo: VENTA_SIN_COBRO }).eq('id', lead.id);
      if (error) return { ok: false, leadId: lead.id, error: 'Se cargó, pero sin marcar «Sin cobro». Márcalo en el CRM.' };
      await logLeadEvent(lead.id, 'Tipo de venta', 'Sin cobro', por);
    }
    return { ok: true, leadId: lead.id };
  } catch (e) {
    // El duplicado tiene su propio error y su propio mensaje: mandar a alguien a cargar
    // de nuevo a un cliente que YA está es cómo se termina con dos fichas de la misma
    // persona y ninguna forma de saber cuál es la buena.
    if (e instanceof LeadDuplicadoError) {
      return {
        ok: false,
        error: 'Ya tienes a alguien con ese nombre o contacto en el CRM. Márcalo como ganado ahí y aparece aquí.',
        duplicados: e.coincidencias.map((c) => ({ leadId: Number(c.lead.id), nombre: (c.lead.nombre ?? '').trim() || 'Sin nombre', motivo: c.motivo, texto: c.texto })),
      };
    }
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo cargar.' };
  }
}
