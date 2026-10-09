-- =============================================================================
-- 0242_canales_zernio — Instagram y Messenger como CANALES de las automatizaciones (por Zernio)
-- =============================================================================
-- Decisión de Martín (09/10/2026, sexta tanda, CRON 4-7): Instagram vuelve —salió el 06/10 con su tab—
-- como canal de /chatbot, y Messenger con él. Lo que esta migración agrega:
--
--  · `ig_conversaciones` pasa a ser «la persona en esa plataforma»: una fila por (workspace,
--    plataforma, igsid). `plataforma` ('instagram' | 'facebook') la separa de Messenger, que usa la
--    MISMA tabla (un PSID de Messenger es lo mismo que un IGSID de Instagram: el id de la persona en
--    esa app, que es lo único que Meta da). La fila existe ANTES de que haya conversación (un
--    comentario no abre ninguna), así que `zernio_conversation_id` deja de ser obligatorio: la
--    unicidad vieja `(workspace_id, zernio_conversation_id)` sigue, y los NULL no chocan entre sí.
--  · El comentario sin contestar de esa persona (`comentario_*`): la respuesta privada es UNA por
--    comentario y dentro de los 7 días (doc de Zernio, 09/10/2026), y el motor la necesita para el
--    «comenta y te mando el link».
--  · `zernio_eventos`: el id de CADA evento del webhook, para no procesarlo dos veces. Zernio entrega
--    «at-least-once» y reintenta 7 veces (hasta ~51 h): sin esto, una reentrega dispara la
--    automatización otra vez —un DM más al lead—. Es un índice de PLATAFORMA (se escribe antes de
--    saber del todo el workspace y lo lee sólo el webhook, con el cliente crudo), por eso NO lleva
--    `workspace_id` ni va a TENANT_TABLES, igual que `webhook_routing`.
--
-- SIN BACKFILL: medido en producción el 09/10/2026, `ig_conversaciones` y `ig_mensajes` tienen 0 filas.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES DEL DEPLOY. El webhook nuevo hace upsert con `on conflict
-- (workspace_id, plataforma, igsid)` y reclama el evento en `zernio_eventos`: sin la migración contesta
-- 500 y Zernio REINTENTA (10 s, 1 min 40 s, 16 min, 2 h 46 min, 24 h, 24 h), así que nada se pierde si
-- la migración llega dentro de ese día. El motor lee `plataforma` y `comentario_*` para mandar: sin la
-- migración un paso de Instagram falla con backoff y reintenta, no manda nada equivocado. Al revés no
-- rompe nada: el código de hoy no lee estas columnas.
-- =============================================================================

begin;

-- ── ig_conversaciones: la persona en una plataforma ──────────────────────────
alter table public.ig_conversaciones
  add column if not exists plataforma text not null default 'instagram';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ig_conversaciones_plataforma_check') then
    alter table public.ig_conversaciones
      add constraint ig_conversaciones_plataforma_check check (plataforma in ('instagram', 'facebook'));
  end if;
end $$;

alter table public.ig_conversaciones alter column zernio_conversation_id drop not null;

alter table public.ig_conversaciones
  add column if not exists comentario_id text,
  add column if not exists comentario_post_id text,
  add column if not exists comentario_at timestamptz,
  add column if not exists comentario_respondido_at timestamptz;

-- El target del upsert del webhook. NO parcial (ON CONFLICT lo exige); los igsid NULL no chocan.
create unique index if not exists uq_ig_conversaciones_persona
  on public.ig_conversaciones (workspace_id, plataforma, igsid);

comment on column public.ig_conversaciones.plataforma is
  'instagram | facebook (Messenger). Una fila = la persona en esa plataforma (igsid = IGSID o PSID).';
comment on column public.ig_conversaciones.comentario_id is
  'El último comentario de la persona que no se contestó: el motor responde por privado (uno por comentario, 7 días).';

-- ── zernio_eventos: dedup del webhook ────────────────────────────────────────
create table if not exists public.zernio_eventos (
  evento_id   text        primary key,
  evento      text        not null,
  recibido_at timestamptz not null default now()
);

comment on table public.zernio_eventos is
  'El id de cada evento del webhook de Zernio (payload.id = X-Zernio-Event-Id): se procesa una vez. Índice de plataforma, sin workspace.';

alter table public.zernio_eventos enable row level security;
revoke all on public.zernio_eventos from anon, authenticated;

commit;

notify pgrst, 'reload schema';
