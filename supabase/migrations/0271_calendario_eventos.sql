-- =============================================================================
-- 0271 — Los eventos PROPIOS del Calendario (la tab nueva, 13/10/2026)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae /calendario. El código nuevo la LEE: sin ella la tab
-- se dibuja con lo que sale de otros lados (el CRM, Google, el Plan, los Objetivos) y dice «No pude leer tus
-- eventos» en vez de afirmar que no hay ninguno; crear un evento contesta que falta la migración. Agrega y no saca
-- nada: la versión desplegada no la nombra, así que aplicarla antes no le molesta a nadie.
--
-- Pedido de Martín (punto 14 de su feedback, y «Dale, arrancá con el Calendario, pero que sea en otra tab, no en
-- GENERAL», 13/10/2026): «debería ser "CALENDARIO" y listo... puede utilizarse para planificar publicaciones de
-- Stories, Reels, Ads... organizar llamadas de ventas, de entrega de servicio... poner "bloques de trabajo"... Se
-- puede combinar con... "OBJETIVOS", el Q, el PLAN... que sea simple de usar, que sirva para todos los casos, que
-- tenga IA que te ayude o "templates" y que no sea restrictivo».
--
-- Lo que vive acá es SÓLO lo que la persona agenda en el Calendario (una publicación, un bloque de trabajo, una
-- llamada que no sale de una agenda conectada). Las reuniones del CRM, la agenda de Google, los plazos del Plan y el
-- Quarter NO se copian: se leen de donde viven cada vez (lib/calendario.ts). Una copia sería la segunda verdad.
--
--   · `id`: texto, lo genera el código (como objectives y kpis). PK (workspace_id, id).
--   · `tipo`: publicacion | bloque | llamada | otro. `formato`, sólo para una publicación: story | reel | post | ad |
--     email | video | otro. Un CHECK por columna: un valor fuera del conjunto quedaría escrito y la pantalla no
--     sabría cómo dibujarlo.
--   · `inicio` es un INSTANTE (timestamptz). La hora de pared la convierte el código con la zona del negocio
--     (`instanteDe`, lib/cron-aviso.ts: dos pasadas, por el salto de horario). `dia_completo`: un evento sin hora.
--   · `estado`: planeado | hecho — una publicación se tilda cuando salió.
--   · `origen`: user | plantilla | ia | api. Lo que propuso MaKo entra recién cuando la persona lo confirma.
--   · SIN `default 1` en `workspace_id`, a propósito: el 1 es un cliente (Mauricio). `getTenantDb` estampa el
--     workspace al insertar; una fila sin él es un error, no del ws 1.
--
-- RLS prendida sin políticas y `revoke` explícito: el servidor lee y escribe con service_role (getTenantDb).

begin;

create table if not exists calendario_eventos (
  id            text not null check (char_length(id) between 1 and 40),
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  tipo          text not null default 'bloque',
  formato       text,
  titulo        text not null default '' check (char_length(titulo) <= 160),
  notas         text not null default '' check (char_length(notas) <= 4000),
  inicio        timestamptz not null,
  fin           timestamptz,
  dia_completo  boolean not null default false,
  estado        text not null default 'planeado',
  origen        text not null default 'user',
  creado_por    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, id),
  constraint calendario_eventos_tipo_ok check (tipo in ('publicacion', 'bloque', 'llamada', 'otro')),
  constraint calendario_eventos_formato_ok check (formato is null or formato in ('story', 'reel', 'post', 'ad', 'email', 'video', 'otro')),
  constraint calendario_eventos_estado_ok check (estado in ('planeado', 'hecho')),
  constraint calendario_eventos_origen_ok check (origen in ('user', 'plantilla', 'ia', 'api')),
  constraint calendario_eventos_fin_ok check (fin is null or fin >= inicio)
);

create index if not exists idx_calendario_eventos_inicio on calendario_eventos (workspace_id, inicio);

comment on table calendario_eventos is 'Lo que una persona agenda en el Calendario (publicaciones, bloques de trabajo, llamadas sueltas). Las reuniones del CRM, Google, el Plan y el Quarter se leen de donde viven, no se copian acá.';

alter table calendario_eventos enable row level security;
revoke all on calendario_eventos from anon, authenticated;

commit;
