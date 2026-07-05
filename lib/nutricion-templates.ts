// =============================================================================
// Templates de nutrición — secuencias por defecto que MaKo seedea sola
// =============================================================================
// Al crear un workspace (alta de cliente / onboarding) NO se configura nada a
// mano: MaKo deja estas secuencias listas, mapeadas a los cohortes que ya existen
// en lib/nutricion.ts (leadsDeCohorte). El envío real sigue gateado por
// NUTRICION_SEND_ENABLED; el copy trae [placeholders] para que el cliente ajuste.
//
// OJO: el copy debe quedar sincronizado con el backfill de la migración 0069
// (que seedea los workspaces que YA existían). Esto es la fuente para los NUEVOS.
// No creamos secuencias de recordatorio de reunión: eso lo maneja n8n hoy.

import 'server-only';

import { getTenantDb } from './workspace';
import type { PasoSecuencia } from './nutricion';

export type NutricionTemplate = { clave: string; nombre: string; etapa: string; trigger_tipo: string; pasos: PasoSecuencia[] };

const email = (orden: number, delay_horas: number, asunto: string, cuerpo: string): PasoSecuencia =>
  ({ orden, canal: 'email', delay_horas, asunto, cuerpo, template_wa: null });
const wa = (orden: number, delay_horas: number, template_wa: string, cuerpo: string): PasoSecuencia =>
  ({ orden, canal: 'whatsapp', delay_horas, asunto: null, cuerpo, template_wa });

export const NUTRITION_TEMPLATES: NutricionTemplate[] = [
  {
    clave: 'no-agenda', nombre: 'No agendó — 3 toques', etapa: 'nutri', trigger_tipo: 'instant_form_sin_agenda',
    pasos: [
      email(1, 1, '¿Pudiste ver el video?', 'Hola 👋 Vi que dejaste tus datos pero todavía no agendaste tu llamada. Si te quedó alguna duda, respondé este mail y te ayudo. Y si ya lo tenés claro, dejá agendada tu sesión acá 👉 [tu link de agenda].'),
      wa(2, 20, 'nutri_no_agenda', 'Hola, te escribo porque dejaste tus datos y quería ver si puedo ayudarte con [tu problema]. ¿Coordinamos una llamada corta esta semana?'),
      email(3, 72, 'Un caso que te puede servir', 'Te dejo el caso de alguien que estaba en tu misma situación y hoy [resultado]. Si te resuena, agendá tu llamada acá 👉 [tu link de agenda]. Cualquier cosa, respondé este mail.'),
    ],
  },
  {
    clave: 'no-show-r1', nombre: 'No Show R1 — reagenda', etapa: 'noshow', trigger_tipo: 'no_show_j1',
    pasos: [
      wa(1, 1, 'nutri_no_show', 'Hola, teníamos la reunión hoy y no pudimos conectarnos. ¿Se te complicó? Reagendemos en el horario que mejor te venga 👉 [tu link de agenda].'),
      email(2, 24, '¿Reagendamos tu llamada?', 'Sé que la agenda a veces se complica. Dejé el horario abierto para que elijas el que mejor te quede 👉 [tu link de agenda]. Me encantaría ayudarte a resolver [tu problema].'),
    ],
  },
  {
    clave: 'no-show-r2', nombre: 'No Show R2 — reagenda', etapa: 'noshow', trigger_tipo: 'no_show_j2',
    pasos: [
      wa(1, 1, 'nutri_no_show', 'Nos quedó pendiente la segunda reunión — estabas muy cerca de decidir. Reagendemos y cerramos los últimos detalles 👉 [tu link de agenda].'),
      email(2, 24, 'Terminemos lo que empezamos', 'Habíamos avanzado un montón. Reagendá la llamada acá 👉 [tu link de agenda] y resolvemos las dudas que te queden.'),
    ],
  },
  {
    clave: 'no-paga', nombre: 'No paga aún — recordatorio', etapa: 'nopaga', trigger_tipo: 'confirmado_sin_pago',
    pasos: [
      wa(1, 2, 'nutri_pago', 'Hola, quedó confirmado tu lugar pero todavía no vi el pago. ¿Necesitás que te reenvíe el link o coordinamos otra forma? Te ayudo por acá.'),
      email(2, 24, '¿Coordinamos el pago?', 'Para dejar tu lugar reservado solo falta el pago. Te dejo el link de nuevo 👉 [tu link de pago]. Si preferís otra modalidad (transferencia, cuotas), decime y lo vemos.'),
    ],
  },
  {
    clave: 'reactivacion', nombre: 'Reactivación de fríos', etapa: 'reactivacion', trigger_tipo: 'reactivacion_viejo',
    pasos: [
      email(1, 1, '¿Seguís buscando resolver esto?', 'Hace un tiempo mostraste interés y no seguimos en contacto. Si todavía estás buscando [resultado], me encantaría retomar. ¿Coordinamos una llamada corta? Respondé este mail o agendá acá 👉 [tu link de agenda].'),
      wa(2, 48, 'nutri_reactivacion', 'Hola, te escribo para retomar. Sé que el timing no siempre es el ideal — si ahora es mejor momento para resolver [tu problema], avisame y lo vemos.'),
    ],
  },
];

/**
 * Seedea las secuencias de nutrición por defecto en el workspace ACTUAL. No pisa
 * lo que el cliente ya tenga: saltea un template si ya existe una secuencia con
 * esa misma clave O con el mismo cohorte (trigger_tipo) — así nunca duplica los
 * envíos. Devuelve cuántas creó.
 */
export async function seedNutricionTemplates(): Promise<number> {
  const supabase = await getTenantDb();
  const { data } = await supabase.from('nutricion_secuencias').select('clave, trigger_tipo');
  const rows = (data ?? []) as Array<{ clave: string; trigger_tipo: string }>;
  const claves = new Set(rows.map((r) => r.clave));
  const triggers = new Set(rows.map((r) => r.trigger_tipo));
  let creadas = 0;
  for (const t of NUTRITION_TEMPLATES) {
    if (claves.has(t.clave) || triggers.has(t.trigger_tipo)) continue;
    const { error } = await supabase.from('nutricion_secuencias').insert({
      clave: t.clave, nombre: t.nombre, etapa: t.etapa, trigger_tipo: t.trigger_tipo, activa: true, pasos: t.pasos,
    });
    if (!error) { creadas++; claves.add(t.clave); triggers.add(t.trigger_tipo); }
    else console.error(`[nutricion-templates] seed ${t.clave} falló: ${error.message}`);
  }
  return creadas;
}
