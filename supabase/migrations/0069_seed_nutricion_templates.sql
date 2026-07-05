-- =============================================================================
-- 0069 — Backfill de templates de nutrición para los workspaces existentes
-- =============================================================================
-- Los workspaces NUEVOS reciben estas secuencias por el hook de alta/onboarding
-- (lib/nutricion-templates.ts, seedNutricionTemplates). Esta migración las seedea
-- de una vez en los workspaces que YA existían. El copy debe quedar sincronizado
-- con NUTRITION_TEMPLATES en lib/nutricion-templates.ts.
--
-- No duplica: saltea un template si el workspace ya tiene una secuencia con esa
-- clave O con el mismo cohorte (trigger_tipo), para no doble-inscribir leads.
-- activa=true; el envío real sigue gateado por NUTRICION_SEND_ENABLED.

begin;

insert into nutricion_secuencias (workspace_id, clave, nombre, etapa, trigger_tipo, activa, pasos)
select w.id, t.clave, t.nombre, t.etapa, t.trigger_tipo, true, t.pasos
from workspaces w
cross join (values
  ('no-agenda', 'No agendó — 3 toques', 'nutri', 'instant_form_sin_agenda', $$[
    {"orden":1,"canal":"email","delay_horas":1,"asunto":"¿Pudiste ver el video?","cuerpo":"Hola 👋 Vi que dejaste tus datos pero todavía no agendaste tu llamada. Si te quedó alguna duda, respondé este mail y te ayudo. Y si ya lo tenés claro, dejá agendada tu sesión acá 👉 [tu link de agenda].","template_wa":null},
    {"orden":2,"canal":"whatsapp","delay_horas":20,"asunto":null,"cuerpo":"Hola, te escribo porque dejaste tus datos y quería ver si puedo ayudarte con [tu problema]. ¿Coordinamos una llamada corta esta semana?","template_wa":"nutri_no_agenda"},
    {"orden":3,"canal":"email","delay_horas":72,"asunto":"Un caso que te puede servir","cuerpo":"Te dejo el caso de alguien que estaba en tu misma situación y hoy [resultado]. Si te resuena, agendá tu llamada acá 👉 [tu link de agenda]. Cualquier cosa, respondé este mail.","template_wa":null}
  ]$$::jsonb),
  ('no-show-r1', 'No Show R1 — reagenda', 'noshow', 'no_show_j1', $$[
    {"orden":1,"canal":"whatsapp","delay_horas":1,"asunto":null,"cuerpo":"Hola, teníamos la reunión hoy y no pudimos conectarnos. ¿Se te complicó? Reagendemos en el horario que mejor te venga 👉 [tu link de agenda].","template_wa":"nutri_no_show"},
    {"orden":2,"canal":"email","delay_horas":24,"asunto":"¿Reagendamos tu llamada?","cuerpo":"Sé que la agenda a veces se complica. Dejé el horario abierto para que elijas el que mejor te quede 👉 [tu link de agenda]. Me encantaría ayudarte a resolver [tu problema].","template_wa":null}
  ]$$::jsonb),
  ('no-show-r2', 'No Show R2 — reagenda', 'noshow', 'no_show_j2', $$[
    {"orden":1,"canal":"whatsapp","delay_horas":1,"asunto":null,"cuerpo":"Nos quedó pendiente la segunda reunión — estabas muy cerca de decidir. Reagendemos y cerramos los últimos detalles 👉 [tu link de agenda].","template_wa":"nutri_no_show"},
    {"orden":2,"canal":"email","delay_horas":24,"asunto":"Terminemos lo que empezamos","cuerpo":"Habíamos avanzado un montón. Reagendá la llamada acá 👉 [tu link de agenda] y resolvemos las dudas que te queden.","template_wa":null}
  ]$$::jsonb),
  ('no-paga', 'No paga aún — recordatorio', 'nopaga', 'confirmado_sin_pago', $$[
    {"orden":1,"canal":"whatsapp","delay_horas":2,"asunto":null,"cuerpo":"Hola, quedó confirmado tu lugar pero todavía no vi el pago. ¿Necesitás que te reenvíe el link o coordinamos otra forma? Te ayudo por acá.","template_wa":"nutri_pago"},
    {"orden":2,"canal":"email","delay_horas":24,"asunto":"¿Coordinamos el pago?","cuerpo":"Para dejar tu lugar reservado solo falta el pago. Te dejo el link de nuevo 👉 [tu link de pago]. Si preferís otra modalidad (transferencia, cuotas), decime y lo vemos.","template_wa":null}
  ]$$::jsonb),
  ('reactivacion', 'Reactivación de fríos', 'reactivacion', 'reactivacion_viejo', $$[
    {"orden":1,"canal":"email","delay_horas":1,"asunto":"¿Seguís buscando resolver esto?","cuerpo":"Hace un tiempo mostraste interés y no seguimos en contacto. Si todavía estás buscando [resultado], me encantaría retomar. ¿Coordinamos una llamada corta? Respondé este mail o agendá acá 👉 [tu link de agenda].","template_wa":null},
    {"orden":2,"canal":"whatsapp","delay_horas":48,"asunto":null,"cuerpo":"Hola, te escribo para retomar. Sé que el timing no siempre es el ideal — si ahora es mejor momento para resolver [tu problema], avisame y lo vemos.","template_wa":"nutri_reactivacion"}
  ]$$::jsonb)
) as t(clave, nombre, etapa, trigger_tipo, pasos)
where w.estado = 'activo'
  and not exists (
    select 1 from nutricion_secuencias s
    where s.workspace_id = w.id and (s.clave = t.clave or s.trigger_tipo = t.trigger_tipo)
  );

commit;
