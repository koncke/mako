-- =============================================================================
-- 0102 — Nombre del invitado en un share
-- =============================================================================
-- La 0099 guardaba solo el email. La lista de "quién tiene acceso" necesita
-- mostrar a la persona (foto + nombre + email), no una dirección suelta.
--
-- El nombre es OPCIONAL y lo escribe quien invita, con el formato clásico de
-- mail: `Martín Tejado <martin@gmail.com>`. Si no viene, la UI lo deriva de la
-- parte local del email — nunca queda un renglón vacío.

begin;

alter table share_invitados add column if not exists nombre text;

commit;

notify pgrst, 'reload schema';
