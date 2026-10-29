-- =============================================================================
-- 0342_calendario_publicar — una «Publicación» del Calendario se programa de verdad en la red, por Zernio (28/10/2026)
-- =============================================================================
-- Martín a Teo (28/10, 00:23:08 y 00:38:01): «publicás reels e historias desde el Calendar los días y a la hora que
-- elijas». Hasta hoy una Publicación era un recordatorio que se tildaba a mano («Ya se publicó»). El Cerebro (28/10): la
-- decisión que esperaba docs/hallazgos-calendario.md («ESPERA UNA DECISIÓN de Martín») es este pedido.
--
-- Columnas NUEVAS de `calendario_eventos` (todas opcionales: un evento que no se programa no cambia):
--   · `red` + `cuenta_red`: dónde se publica (instagram | facebook | tiktok | youtube) y la cuenta conectada en Zernio (su id).
--   · `archivo` + `archivo_tipo`: la ruta en el bucket privado `ig-media` (`<ws>/calendario/<evento>/<archivo>`) y si es
--     imagen o video. Zernio lee la media por una URL firmada que vive hasta 7 días después de publicar.
--   · `texto`: lo que va en la publicación (2.200, el tope de Instagram). Las `notas` siguen siendo notas internas.
--   · `post_id`, `publicacion`, `publicacion_motivo`, `publicacion_url`: el post en Zernio y su estado
--     (programando | programada | dudosa | publicada | fallo; null = no se programó). «dudosa»: Zernio no contestó y puede haberla
--     programado igual; no se reprograma ni se mueve hasta que alguien diga que no quedó (si no, se duplicaba un post público). ⚠️ Es APARTE de `estado` (planeado | hecho),
--     que no se toca: cuando Zernio dice «publicada», el evento además pasa a `hecho`.
--
-- ORDEN: puede ir ANTES o DESPUÉS del deploy. El código lee estas columnas aparte y tolera que no existan (el Calendario
-- sigue igual y «Programar» dice que falta la migración): sumarlas a la lectura de siempre la rompería entera.
-- TODO ADITIVO: columnas nuevas con sus CHECK. Seguro de re-ejecutar.
-- =============================================================================

begin;

alter table calendario_eventos add column if not exists red text;
alter table calendario_eventos add column if not exists cuenta_red text;
alter table calendario_eventos add column if not exists archivo text;
alter table calendario_eventos add column if not exists archivo_tipo text;
alter table calendario_eventos add column if not exists texto text not null default '';
alter table calendario_eventos add column if not exists post_id text;
alter table calendario_eventos add column if not exists publicacion text;
alter table calendario_eventos add column if not exists publicacion_motivo text;
alter table calendario_eventos add column if not exists publicacion_url text;
-- (la verificación del 28/10) El x-request-id del último intento (para no duplicar un post si Zernio no contestó) y la huella
-- de la clave con que se programó (si la clave cambió, un 404 de Zernio no es «ya cancelado»).
alter table calendario_eventos add column if not exists publicacion_intento text;
alter table calendario_eventos add column if not exists publicacion_clave text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_red_ok') then
    alter table calendario_eventos add constraint calendario_eventos_red_ok
      check (red is null or red in ('instagram', 'facebook', 'tiktok', 'youtube'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_cuenta_red_ok') then
    alter table calendario_eventos add constraint calendario_eventos_cuenta_red_ok
      check (cuenta_red is null or char_length(cuenta_red) between 1 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_archivo_ok') then
    alter table calendario_eventos add constraint calendario_eventos_archivo_ok
      check (archivo is null or char_length(archivo) between 1 and 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_archivo_tipo_ok') then
    alter table calendario_eventos add constraint calendario_eventos_archivo_tipo_ok
      check (archivo_tipo is null or archivo_tipo in ('image', 'video'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_texto_ok') then
    alter table calendario_eventos add constraint calendario_eventos_texto_ok check (char_length(texto) <= 2200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_post_id_ok') then
    alter table calendario_eventos add constraint calendario_eventos_post_id_ok
      check (post_id is null or char_length(post_id) between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_publicacion_ok') then
    alter table calendario_eventos add constraint calendario_eventos_publicacion_ok
      check (publicacion is null or publicacion in ('programando', 'programada', 'dudosa', 'publicada', 'fallo'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_publicacion_motivo_ok') then
    alter table calendario_eventos add constraint calendario_eventos_publicacion_motivo_ok
      check (publicacion_motivo is null or char_length(publicacion_motivo) <= 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_publicacion_intento_ok') then
    alter table calendario_eventos add constraint calendario_eventos_publicacion_intento_ok
      check (publicacion_intento is null or char_length(publicacion_intento) between 1 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_publicacion_clave_ok') then
    alter table calendario_eventos add constraint calendario_eventos_publicacion_clave_ok
      check (publicacion_clave is null or char_length(publicacion_clave) between 1 and 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_publicacion_url_ok') then
    alter table calendario_eventos add constraint calendario_eventos_publicacion_url_ok
      check (publicacion_url is null or char_length(publicacion_url) <= 500);
  end if;
end $$;

-- Las que esperan a Zernio (para releerlas al abrir el Calendario).
create index if not exists idx_calendario_eventos_publicacion on calendario_eventos (workspace_id, publicacion)
  where publicacion in ('programando', 'programada', 'dudosa');

comment on column calendario_eventos.publicacion is
  'El post en la red, por Zernio: programando | programada | publicada | fallo (null = no se programó). Aparte de estado (mig 0342).';

commit;

notify pgrst, 'reload schema';
