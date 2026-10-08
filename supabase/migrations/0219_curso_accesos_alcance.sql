-- =============================================================================
-- 0219 — Los permisos de un alumno, su entrada con el email y el reclamo de la invitación
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy. Agrega columnas que el código nuevo LEE en el camino
-- del PORTAL: `resolverAcceso` y `resolverAccesoPortal` (lib/curso-datos.ts) piden `alcance` en cada
-- pedido, y `accesoDe` lo trae junto con el resto del acceso. Sin la columna, PostgREST rechaza la
-- consulta ENTERA («column … does not exist») y se caen el portal del alumno, /mi-curso, la ficha y
-- el cron de recordatorios. Y también ESCRIBE una: `marcarInvitacion` suelta `invitando_at` en la
-- misma escritura que anota la invitación, así que sin la columna TODA invitación (la de la ficha
-- también) sale por mail y no queda anotada. Agrega y no saca nada: la versión desplegada no las mira.
--
-- Pedido de Martín (07/10/2026, item 9 del curso tipo Skool): «En cada cliente del kanban se
-- debería poder invitar al curso … solo al curso, sin la sidebar principal ni nada … Y claro poder
-- administrar los permisos de ese alumno, ya sea solo algunos módulos o lo que sea». Las decisiones,
-- en docs/diseno-curso-skool.md (D3).
--
-- TRES COSAS, todas de la fila del acceso del CLIENTE (`area is null`):
--
-- 1. `alcance` — qué módulos ve. NULL = TODO (el default de toda fila, y el de todas las que ya
--    existen: nadie pierde nada al aplicar esto). Forma: { "modulos": { "<productoId>": ["clave", …] } }.
--    Un producto sin entrada ve todos sus módulos; con entrada, sólo los listados (lista vacía =
--    ninguno). La forma la decide y la sanea el código (lib/curso-alcance.ts, `saneaAlcance`); la
--    base sólo exige que sea un objeto.
--
-- 2. `link_magico_nonce` / `link_magico_at` — «Soy alumno: entrar con mi email» en /login. El link
--    que le llega por mail lleva este nonce adentro de la firma (lib/alumno-sesion.ts) y vale UNA vez:
--    entrar lo borra con compare-and-set, y pedir otro lo reemplaza (el anterior deja de abrir).
--    `link_magico_at` es cuándo se emitió el último: no se manda más de uno por minuto por acceso,
--    y eso vale entre instancias (el rate limit en memoria no).
--
-- 3. `invitando_at` — el RECLAMO de la invitación sin sesión (lib/curso-invitar.ts, la usa el CRM al
--    ganar). Dos disparos del mismo «pasó a Ganado» (hay tres lugares que lo escriben) leían los dos
--    «no tiene invitación» y mandaban dos mails. El que reclama primero escribe `invitando_at` con
--    compare-and-set; el otro no encuentra la fila y no manda. Vence a los 5 minutos, para que un
--    envío que murió a mitad no deje al cliente sin invitación para siempre.
--    ⚠️ NO es «lo invitaron»: eso sigue siendo `invitacion_enviada_at`, que se escribe sólo si el
--    mail salió (mig 0206).
--
-- RLS: `curso_accesos` ya lo tiene prendido y sin políticas (0202): sólo el server (service_role).
-- Se re-afirma igual, con el revoke a anon/authenticated, porque es lo único que mantiene estas
-- columnas afuera del navegador si algún día alguien aplica DDL con otro rol.

begin;

alter table curso_accesos add column if not exists alcance jsonb;
alter table curso_accesos add column if not exists link_magico_nonce text;
alter table curso_accesos add column if not exists link_magico_at timestamptz;
alter table curso_accesos add column if not exists invitando_at timestamptz;

-- La forma fina la decide el código; la base corta lo que no puede ser nunca (un array, un número).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'curso_accesos_alcance_objeto') then
    alter table curso_accesos add constraint curso_accesos_alcance_objeto
      check (alcance is null or jsonb_typeof(alcance) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'curso_accesos_link_magico_nonce_largo') then
    alter table curso_accesos add constraint curso_accesos_link_magico_nonce_largo
      check (link_magico_nonce is null or char_length(link_magico_nonce) between 16 and 64);
  end if;
end $$;

comment on column curso_accesos.alcance is
  'Qué módulos ve el alumno. NULL = todo. {"modulos":{"<productoId>":["clave",…]}}: producto sin entrada = todos; con entrada = sólo esos. Lo sanea lib/curso-alcance.ts.';
comment on column curso_accesos.link_magico_nonce is
  'El nonce del último link de entrada por email (/login, «Soy alumno»). Vale una vez: entrar lo borra con compare-and-set.';
comment on column curso_accesos.link_magico_at is
  'Cuándo se emitió el último link de entrada por email. No se manda más de uno por minuto por acceso.';
comment on column curso_accesos.invitando_at is
  'Reclamo de la invitación sin sesión (lib/curso-invitar.ts): evita dos mails por el mismo disparo. Vence a los 5 minutos. NO es «invitado».';

alter table curso_accesos enable row level security;
revoke all on curso_accesos from anon, authenticated;

commit;
