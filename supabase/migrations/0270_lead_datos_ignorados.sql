-- 0270 — Ignorar UN dato sin marcar de un lead (no el lead entero).
--
-- Pedido de Martín (13/10/2026, feedback del detalle del lead, punto 1): en el desplegable de
-- «Datos sin marcar», cada dato con «solucionar» e «ignorar»; «En caso de ignorar, ya no salta
-- la notificación». Hasta hoy sólo se podía ignorar el lead ENTERO (`pendientes_ignorados`,
-- mig 0109), que callaba también lo que sí importaba.
--
-- Guarda los ids de paso (StepId de lib/stage-requirements.ts) que no avisan. El dato sigue
-- faltando y mover de etapa lo sigue pidiendo: esto decide el AVISO, no el requisito. Qué tipos
-- de dato avisan para TODO el negocio es un setting aparte (crm.datos_aviso.apagados).
--
-- ⚠️ ORDEN: ANTES (o junto con) el deploy. El worklist la pide en su lista de columnas, y esa
-- lectura relee con '*' si falta una columna (lib/queries.ts, leerLeadsDePendientes), pero
-- ignorar un dato desde la ficha escribe esta columna y sin ella falla.

alter table leads add column if not exists datos_ignorados text[] not null default '{}';

comment on column leads.datos_ignorados is
  'Datos sin marcar ignorados uno por uno (ids de paso de lib/stage-requirements.ts): no avisan, siguen faltando. Mig 0270.';
