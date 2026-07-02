-- =============================================================================
-- 0060 — Estado de onboarding: el workspace del dueño queda marcado COMPLETADO
-- =============================================================================
-- El wizard de onboarding gatea a los clientes con status pending|in_progress.
-- El código ya exime al dueño (OWNER_WS=1) — esta fila es el segundo seguro
-- para que Mauricio jamás vea el wizard, ni aunque cambie la regla del código.
-- Un workspace SIN fila = 'pending' (cliente nuevo, cae al wizard).

begin;

insert into app_settings (workspace_id, key, value)
values (1, 'onboarding.state', '{"version":1,"status":"done","step":"retro","completedBy":"seed-0060","completedAt":"2026-07-02T00:00:00Z","steps":{"integraciones":{"done":true},"tabs":{"done":true},"negocio":{"done":true},"retro":{"done":true,"retroId":null}},"extraction":{"status":"done","jobs":{}}}')
on conflict (workspace_id, key) do nothing;

commit;
