-- =============================================================================
-- 0274 — El Resumen del lead personalizable (14/10/2026)
-- =============================================================================
-- Martín (13/10/2026, feedback del detalle del lead, Resumen punto 1): «el usuario puede querer
-- ver distintos tipos de información en el resumen... unos su IG, otros su YouTube, otros su
-- Web, LinkedIn, dirección, otros su sexo, otros quieren ver la respuesta del instant form, las
-- respuestas del form de opt-in, etc... Entonces te pido que lo hagas personalizable».
--
-- Los datos que faltaban, como columnas del lead (los edita la ficha, uno por uno, con su línea
-- en el historial). Y lo que la persona contestó en el formulario de la landing, que hasta hoy
-- sólo viajaba en el WhatsApp del aviso y no quedaba en ningún lado.
--
-- ORDEN: ANTES del deploy. La ficha los escribe; un update que nombra una columna que no existe
-- se rechaza entero.
-- =============================================================================

alter table leads add column if not exists youtube text;
alter table leads add column if not exists linkedin text;
alter table leads add column if not exists direccion text;
alter table leads add column if not exists sexo text;
-- [{ pregunta, respuesta }] del formulario de la landing (app/api/track/optin, lib/optin-respuestas.ts).
alter table leads add column if not exists optin_respuestas jsonb;

do $$
begin
  alter table leads add constraint leads_sexo_ck check (sexo is null or sexo in ('mujer', 'hombre', 'otro'));
exception when duplicate_object then null;
end $$;
