-- =============================================================================
-- 0056 — perfil personal por usuario
-- =============================================================================
-- El perfil (nombre, foto, cargo, bio, etc.) vivía en app_settings scopeado por
-- workspace, así que todos los usuarios de un workspace —y todos los admins, que
-- caen al workspace dueño— compartían un único perfil y se pisaban la foto entre
-- sí. El perfil es de la PERSONA, no del workspace: pasa a la fila de `usuarios`.
-- `usuarios` ya tiene nombre, email y foto_url; el resto de campos van en un
-- jsonb `perfil`. La config de reportes/notificaciones sigue en app_settings
-- (es por-workspace: la usan los crons).
--
-- Seguro de re-ejecutar.
-- =============================================================================

begin;

alter table usuarios add column if not exists perfil jsonb not null default '{}'::jsonb;

commit;
