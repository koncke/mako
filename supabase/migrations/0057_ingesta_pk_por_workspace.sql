-- =============================================================================
-- 0057 — PK/unique por workspace en las tablas de ingesta (cierre de Fase 2b)
-- =============================================================================
-- La 0054 dejó a propósito con PK/unique de una sola columna a las tablas que
-- solo escribían los crons (ingesta), difiriendo el PK compuesto a "cuando la
-- ingesta sea por-cliente". Fase 2b hace justamente eso: los crons ahora corren
-- por-workspace. Sin este cambio, cuando un SEGUNDO cliente ingiere, su upsert
-- colisiona con las filas del dueño (ad_id de Meta / recording_id de Fathom /
-- (fecha,adset_id) no son únicos entre cuentas → violación de unique o pisado).
--
-- Todas las filas existentes tienen workspace_id=1 (default de la 0054), así que
-- las PK compuestas siguen siendo únicas. Aditiva e idempotente.
-- =============================================================================

begin;

-- PKs naturales por id-de-proveedor → compuestas con workspace_id.
do $$
begin
  if exists (select 1 from pg_constraint where conname='ad_transcripts_pkey' and conrelid='ad_transcripts'::regclass and array_length(conkey,1)=1) then
    alter table ad_transcripts drop constraint ad_transcripts_pkey;
    alter table ad_transcripts add constraint ad_transcripts_pkey primary key (workspace_id, ad_id);
  end if;
  if exists (select 1 from pg_constraint where conname='script_analyses_pkey' and conrelid='script_analyses'::regclass and array_length(conkey,1)=1) then
    alter table script_analyses drop constraint script_analyses_pkey;
    alter table script_analyses add constraint script_analyses_pkey primary key (workspace_id, ad_id);
  end if;
  if exists (select 1 from pg_constraint where conname='closing_analyses_pkey' and conrelid='closing_analyses'::regclass and array_length(conkey,1)=1) then
    alter table closing_analyses drop constraint closing_analyses_pkey;
    alter table closing_analyses add constraint closing_analyses_pkey primary key (workspace_id, recording_id);
  end if;
  if exists (select 1 from pg_constraint where conname='adset_budget_daily_pkey' and conrelid='adset_budget_daily'::regclass and array_length(conkey,1)=2) then
    alter table adset_budget_daily drop constraint adset_budget_daily_pkey;
    alter table adset_budget_daily add constraint adset_budget_daily_pkey primary key (workspace_id, fecha, adset_id);
  end if;
end $$;

-- Unique de idempotencia de métricas → incluir workspace_id (mismo COALESCE).
drop index if exists idx_mmd_unique;
create unique index if not exists idx_mmd_unique on marketing_metrics_daily
  (workspace_id, fecha, plataforma, coalesce(adset_id, ''), coalesce(ad_id, ''), coalesce(youtube_video_id, ''), coalesce(video_id, ''));

commit;
