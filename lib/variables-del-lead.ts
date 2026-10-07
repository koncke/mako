// =============================================================================
// Los datos de la FICHA de un lead, listos para meter en un mensaje
// =============================================================================
// ⚠️ MÓDULO SIN `server-only`, A PROPÓSITO. Esto es la mitad que se puede equivocar
// —qué columna alimenta cada token y cómo se escribe un monto, una fecha o un booleano—
// y adentro de `variables-resolver.ts` (que sí es `server-only`, porque lee la base)
// ningún test la podría importar. Es la misma razón por la que vive afuera la condición
// de `exigirClienteDePrueba`.
//
// El `import type` del Lead se borra en compilación, así que no arrastra nada del server.

import type { Lead } from './leads';
// Puro y sin `server-only`, igual que este módulo: el test lo sigue pudiendo importar.
import { resumenRespuestas } from './meta-leads-campos';

/** `1500` → `US$ 1.500`. Sin decimales: un aviso no es un recibo. */
export const plata = (n: number): string => `US$ ${Math.round(n).toLocaleString('es-AR')}`;
/** `2026-10-14` → `14/10`. El año no entra: lo que se avisa es de esta semana. */
export const fecha = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
};

/**
 * Cómo se llama en pantalla cada valor de `estado_lead`. Lo pone el CÓDIGO: lo que la
 * base guarda es `no_responde`, que adentro de un WhatsApp se lee como un slug.
 */
const ROTULO_ESTADO: Readonly<Record<string, string>> = {
  abierto: 'abierto', ganado: 'ganado', perdido: 'perdido',
  descalificado: 'descalificado', no_responde: 'no responde',
};

/**
 * Los valores que salen de la FICHA del lead.
 *
 * ⚠️ LO QUE ESTÁ EN `null` NO ENTRA AL MAPA, y entonces su token sale CRUDO. Es la
 * decisión que ya estaba escrita para los tokens de otro alcance y vale igual acá: un
 * `{{lead_saldo}}` crudo se ve raro y se nota, y uno reemplazado por «—» o por vacío
 * deja el mensaje cojo sin que nadie se entere de que faltaba un dato. Y `0` SÍ entra:
 * «no debe nada» es un hecho, no un faltante.
 */
export function valoresDelLead(l: Lead): Record<string, string> {
  const out: Record<string, string> = {};
  const txt = (k: string, v: string | null | undefined) => { if (v && v.trim()) out[k] = v.trim(); };
  const num = (k: string, v: number | null | undefined) => { if (typeof v === 'number' && Number.isFinite(v)) out[k] = plata(v); };
  const dia = (k: string, v: string | null | undefined) => { if (v) out[k] = fecha(v); };
  const si = (k: string, v: boolean | null | undefined) => { if (typeof v === 'boolean') out[k] = v ? 'sí' : 'no'; };

  txt('lead_nombre', l.nombre);
  txt('lead_email', l.email);
  txt('lead_telefono', l.telefono);
  txt('lead_empresa', l.empresa);

  txt('lead_estado', ROTULO_ESTADO[l.estado_lead] ?? l.estado_lead);
  txt('lead_motivo_perdida', l.motivo_perdida);
  txt('lead_closer', l.closer ?? null);
  txt('lead_setter', l.setter ?? null);
  si('lead_calificado', l.calificado);

  dia('lead_fecha_agenda', l.fecha_agenda);
  dia('lead_fecha_r1', l.fecha_junta_1);
  dia('lead_fecha_r2', l.fecha_junta_2);
  si('lead_asistio_r1', l.asistio_j1);
  si('lead_asistio_r2', l.asistio_j2);

  num('lead_monto_cierre', l.monto_cierre_usd);
  num('lead_cobrado', l.total_cobrado_usd);
  // El saldo se CALCULA, y sólo si hay cierre: sin monto de cierre, «falta cobrar» no
  // tiene referencia y daría el negativo de lo pagado.
  if (typeof l.monto_cierre_usd === 'number' && Number.isFinite(l.monto_cierre_usd)) {
    out.lead_saldo = plata(Math.max(0, l.monto_cierre_usd - (l.total_cobrado_usd ?? 0)));
  }
  num('lead_cuota', l.monto_cuota_usd);
  if (typeof l.dia_de_pago === 'number') out.lead_dia_de_pago = String(l.dia_de_pago);
  dia('lead_fecha_cierre', l.fecha_cierre);
  num('lead_suscripcion', l.suscripcion_monto_usd ?? null);

  txt('lead_origen', l.origen_lead);
  txt('lead_campana', l.meta_campaign_name);
  txt('lead_anuncio', l.meta_ad_name);
  txt('lead_utm_source', l.utm_source);
  txt('lead_utm_campaign', l.utm_campaign);

  txt('lead_facturacion', l.respuesta_facturacion);
  txt('lead_colaboradores', l.respuesta_colaboradores);
  txt('lead_objetivo', l.respuesta_objetivo);
  txt('lead_cuando_empezar', l.respuesta_cuando_empezar);
  txt('lead_inversion', l.respuesta_inversion);
  txt('lead_decisor', l.respuesta_decisor);
  txt('lead_formulario', resumenRespuestas(l.meta_field_data));

  return out;
}

