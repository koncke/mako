-- =============================================================================
-- 0206 — Invitar a un cliente al curso: a qué email, cuándo y quién
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy. Agrega tres columnas que el código nuevo LEE (la
-- ficha dibuja «Invitado a X el …» y el login con Google busca el acceso por email). Agrega y no
-- saca nada: la versión desplegada no las mira.
--
-- Pedido de Martín (06/10/2026): «Al igual que en la vista de Agencia, se debería poder INVITAR al
-- cliente a MaKo para que tenga acceso al curso.»
--
-- ⚠️ «TIENE FILA» NO ES «LO INVITARON». Hasta acá, `curso_accesos` se creaba con sólo abrir la
-- pestaña Curso de la ficha, así que la existencia de la fila no decía nada. Lo que dice que lo
-- invitaron es `invitacion_enviada_at`, y se escribe SÓLO si el mail salió de verdad.
--
-- `email` es aparte del email del lead a propósito: es la dirección con la que la persona va a
-- ENTRAR (con Google, o por el link del mail), y puede no ser la que el CRM tiene cargada.
-- El índice por lower(email) es para el login: el callback de Google busca «¿esta dirección es
-- alumno de algún negocio?» sin saber todavía de qué workspace es. NO es único: la misma persona
-- puede ser cliente de dos negocios, y ahí gana la invitación más reciente.

alter table curso_accesos add column if not exists email text;
alter table curso_accesos add column if not exists invitacion_enviada_at timestamptz;
alter table curso_accesos add column if not exists invitado_por text;

create index if not exists idx_curso_accesos_email on curso_accesos (lower(email)) where email is not null;

comment on column curso_accesos.email is 'La dirección a la que se invitó y con la que entra (Google o el link del mail). Puede no ser la del lead.';
comment on column curso_accesos.invitacion_enviada_at is 'Cuándo SALIÓ el mail de invitación. NULL = nunca se invitó (la fila puede existir igual).';
