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
// Los recordatorios de reunión viven ACÁ (secuencia 'recordatorio-r1' con pasos
// anclados a la fecha de la reunión) — reemplazan la tanda de n8n apagada (#18).

import 'server-only';

import { getTenantDb } from './workspace';
import { getFunnel } from './leads';
import type { PasoSecuencia } from './nutricion';

export type NutricionTemplate = { clave: string; nombre: string; etapa: string; trigger_tipo: string; pasos: PasoSecuencia[] };

const email = (orden: number, delay_horas: number, asunto: string, cuerpo: string): PasoSecuencia =>
  ({ orden, canal: 'email', delay_horas, asunto, cuerpo, template_wa: null });
const wa = (orden: number, delay_horas: number, template_wa: string, cuerpo: string): PasoSecuencia =>
  ({ orden, canal: 'whatsapp', delay_horas, asunto: null, cuerpo, template_wa });
// Paso de WhatsApp por el canal NO oficial (Evolution): no exige plantilla de
// Meta y a leads calientes genera borrador para el setter — el default seguro
// para etapas derivadas cuyo copy todavía no aprobó nadie.
const waNo = (orden: number, delay_horas: number, cuerpo: string): PasoSecuencia =>
  ({ orden, canal: 'whatsapp', delay_horas, asunto: null, cuerpo, proveedor: 'no_oficial', template_wa: null });

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
    // Recordatorio de reunión (#18): pasos ANCLADOS a la fecha de la R1 del lead
    // (delay_horas = horas ANTES de la reunión). El WhatsApp va por el canal no
    // oficial: a leads calientes queda como borrador que el setter manda con 1 clic.
    clave: 'recordatorio-r1', nombre: 'Recordatorio de reunión — que llegue', etapa: 'postagenda', trigger_tipo: 'agendado_sin_confirmar',
    pasos: [
      { orden: 1, canal: 'email', delay_horas: 24, ancla: 'reunion', asunto: 'Mañana tenemos nuestra reunión', cuerpo: 'Hola 👋 Te escribo para confirmar nuestra reunión de mañana. Vamos a ver [tu problema] y salir con un plan concreto. Si se te complicó el horario, reagendá acá 👉 [tu link de agenda]. ¡Nos vemos!', template_wa: null },
      { orden: 2, canal: 'whatsapp', delay_horas: 2, ancla: 'reunion', asunto: null, cuerpo: 'Hola, en un par de horas tenemos nuestra reunión. ¿Confirmamos que llegás bien? Cualquier cosa avisame por acá.', proveedor: 'no_oficial', template_wa: null },
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
  // Además del set estándar, cubrir las etapas de nutrición que DERIVA el funnel
  // real del workspace (funnel-agnóstico, #34) — no fatal si falla.
  try { creadas += await seedNutricionDesdeFunnel(); }
  catch (e) { console.error('[nutricion-templates] seed desde funnel falló:', e); }
  return creadas;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed funnel-agnóstico (#34): una secuencia por etapa de NUTRICIÓN del funnel
// derivado del workspace que no tenga cobertura, con trigger 'etapa_actual'
// (enrola por etapa efectiva del lead, sea el funnel que sea).
// ─────────────────────────────────────────────────────────────────────────────

// Etapas derivadas que NO reciben secuencia automática: la nutrición manual es
// del setter por definición y la reunión excepcional es un estacionamiento.
const ETAPAS_SIN_SEED = new Set(['manual', 'reunion_excepcional']);

// Qué stage keys del funnel derivado ya cubre cada trigger legacy. La cobertura
// se decide por trigger (no por la columna etapa: sus valores viejos divergen
// entre workspaces — ej. 'noshow' / 'postagenda' ya no existen como stage keys).
const LEGACY_TRIGGER_CUBRE: Record<string, string[]> = {
  instant_form_sin_agenda: ['nutri'],
  vio_vsl_sin_agendar: ['nutri'],
  vio_poco_vsl: ['nutri'],
  no_show_j1: ['noshow_r1'],
  no_show_j2: ['noshow_r2'],
  confirmado_sin_pago: ['nopaga'],
  post_j2_sin_cerrar: ['nocompro'],
  reactivacion_viejo: ['reactivacion'],
  ultimo_intento_antes_noresp: ['reactivacion'],
};

/**
 * Crea las secuencias que faltan para las etapas de nutrición del funnel del
 * workspace ACTUAL. Nacen PAUSADAS (activa=false) y con copy [placeholder]:
 * MaKo las escribe y el cliente las prende al aprobar — así una etapa derivada
 * nunca queda enviando texto genérico solo por existir. Idempotente por clave
 * y por etapa cubierta. Devuelve cuántas creó.
 */
export async function seedNutricionDesdeFunnel(): Promise<number> {
  const supabase = await getTenantDb();
  const funnel = await getFunnel();
  const etapasNutri = funnel.stages.filter((s) => s.band === 'nutricion' && !ETAPAS_SIN_SEED.has(s.key));
  if (etapasNutri.length === 0) return 0;

  const { data } = await supabase.from('nutricion_secuencias').select('clave, etapa, trigger_tipo');
  const rows = (data ?? []) as Array<{ clave: string; etapa: string | null; trigger_tipo: string }>;
  const claves = new Set(rows.map((r) => r.clave));
  const cubiertas = new Set<string>();
  for (const r of rows) {
    if (r.etapa) cubiertas.add(r.etapa);
    for (const k of LEGACY_TRIGGER_CUBRE[r.trigger_tipo] ?? []) cubiertas.add(k);
  }

  let creadas = 0;
  for (const st of etapasNutri) {
    const clave = `etapa-${st.key}`;
    if (cubiertas.has(st.key) || claves.has(clave)) continue;
    const pasos: PasoSecuencia[] = [
      email(1, 24, `Seguimos en contacto`, `Hola 👋 Te escribo porque estás en la etapa "${st.label}". [Contale por qué vale la pena dar el siguiente paso y qué gana con eso]. Si te queda alguna duda, respondé este mail y lo vemos.`),
      waNo(2, 48, `Hola, quería retomar contacto — [motivo puntual de esta etapa]. ¿Te queda alguna duda que pueda resolverte por acá?`),
    ];
    const { error } = await supabase.from('nutricion_secuencias').insert({
      clave, nombre: `${st.label} — seguimiento`, etapa: st.key, trigger_tipo: 'etapa_actual', activa: false, pasos,
    });
    if (!error) { creadas++; claves.add(clave); cubiertas.add(st.key); }
    else console.error(`[nutricion-templates] seed etapa ${st.key} falló: ${error.message}`);
  }
  return creadas;
}
