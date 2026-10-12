-- =============================================================================
-- 0263 — El dominio propio de una landing del editor (T7)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae /api/landing-generator/dominio y el
-- cambio de proxy.ts. El código nuevo LEE estas columnas: la pestaña «Dominios» del diálogo
-- Publicar, la ruta interna que sirve una landing en su dominio, el borrado de una landing y el
-- vaciado de un workspace. Sin ellas, esa pestaña contesta «column does not exist» y un dominio de
-- cliente contesta 503 (todavía no hay ninguno conectado, así que no se le cae nada a nadie). Agrega
-- y no saca nada: la versión desplegada no nombra ninguna de estas columnas (`leerPublicado` y
-- `COLS_DOC` piden columnas explícitas), así que aplicarla antes no le molesta.
--
-- (Se escribió como 0258; se renumeró a 0263 antes de aplicarse el 12/10/2026: la 0258 la tomó la
-- sesión del CRM y las 0260-0262 la de Graphics.)
--
-- Pedido de Martín (11/10/2026), punto 10 de la tanda 2, textual: «Y claro, falta la opción de
-- publicar, ya sea con una URL creada por MaKo, como lo hace Gamma, o la opción de traer tu
-- dominio.» Decisión T7 de docs/diseno-editor-landing.md.
--
-- · `dominio` es ÚNICO GLOBAL (un host lo sirve UNA landing): primer reclamante gana, igual que el
--   slug. Índice parcial porque casi ninguna fila tiene dominio; el mismo índice es el que usa la
--   lectura host → landing de cada visita (lib/editor-landing/dominios.ts, `landingDeDominio`).
--   El patrón del CHECK es el de `DOMINIO_RE` (lib/editor-landing/dominios-reglas.ts): si cambia
--   uno, cambia el otro.
-- · `dominio_estado`: 'pendiente' (conectado en Vercel, falta el DNS o la prueba TXT de MaKo) o
--   'verificado' (se sirve). Una vez verificado NO vuelve atrás por una lectura: un DNS que
--   parpadea apagaría un sitio que anda. Sólo «Quitar» lo limpia.
-- · `dominio_verificado_at`: cuándo pasó a verificado.
-- · `dominio_reclamado_at` (revisión de la tanda 2): cuándo se reclamó. Un PENDIENTE reserva el
--   dominio sólo 72 h (`PLAZO_PENDIENTE_MS`): pasado eso, otra landing que lo pida se lo queda; y
--   antes, también, si quien lo pide ya cargó en el DNS el TXT `_mako` de SU landing. Sin esto el
--   índice único dejaba que cualquier admin reservara el dominio de otro para siempre. El tope de
--   pendientes por negocio (5) lo pone el código (`reclamar`, dominios.ts): con un `now()` no hay
--   índice ni CHECK que lo pueda decir.
-- · `dominio_agregado_por_mako` (revisión de la tanda 2): MaKo agregó ESTE dominio al proyecto de
--   Vercel (la API contestó 2xx a nuestro POST, o se heredó del reclamo vencido que ésta reemplazó).
--   Es lo único que habilita el DELETE a Vercel (`puedeSoltarseDeVercel`, en positivo): un dominio que
--   ya estaba en el proyecto —uno de MaKo que no esté en `DOMINIOS_DE_MAKO`— no se suelta nunca.
--
-- El CHECK de coherencia ata las cinco: sin dominio no hay estado, ni fecha de reclamo, ni marca; con
-- dominio hay estado y fecha de reclamo; y sólo un verificado tiene fecha de verificación.
--
-- Sin columnas nuevas en TENANT_TABLES ni en TABLAS_DE_INQUILINO: la tabla ya está en los dos
-- (0246). El borrado de una landing y el reset de un workspace sueltan el dominio de Vercel ANTES de
-- borrar la fila (lib/editor-landing/server.ts `borrar`, lib/reset-workspace.ts `vaciarTablas`).

begin;

alter table landing_docs
  add column if not exists dominio text
    check (dominio is null or (length(dominio) between 4 and 253
      and dominio ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})$')),
  add column if not exists dominio_estado text
    check (dominio_estado is null or dominio_estado in ('pendiente', 'verificado')),
  add column if not exists dominio_verificado_at timestamptz,
  add column if not exists dominio_reclamado_at timestamptz,
  add column if not exists dominio_agregado_por_mako boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'landing_docs_dominio_coherente_ck') then
    alter table landing_docs add constraint landing_docs_dominio_coherente_ck check (
      (dominio is null) = (dominio_estado is null)
      and (dominio is null) = (dominio_reclamado_at is null)
      and (dominio is not null or not dominio_agregado_por_mako)
      and (dominio_verificado_at is null or dominio_estado = 'verificado')
    );
  end if;
end $$;

create unique index if not exists landing_docs_dominio_uk on landing_docs (dominio) where dominio is not null;

comment on column landing_docs.dominio is 'Dominio propio de la landing (host en minúsculas, único global). Lo sirve proxy.ts sólo si dominio_estado = verificado. Diseño: docs/diseno-editor-landing.md (T7).';
comment on column landing_docs.dominio_estado is 'pendiente | verificado. Verificado = en el proyecto de Vercel, DNS apuntando y TXT _mako con el valor de esta landing. No vuelve atrás solo.';
comment on column landing_docs.dominio_verificado_at is 'Cuándo el dominio pasó a verificado.';
comment on column landing_docs.dominio_reclamado_at is 'Cuándo se reclamó. Un pendiente reserva el dominio 72 h; después (o antes, con el TXT _mako de quien lo pide) otra landing se lo puede quedar.';
comment on column landing_docs.dominio_agregado_por_mako is 'MaKo agregó este dominio al proyecto de Vercel (2xx a nuestro POST, o heredado del reclamo vencido que ésta reemplazó). Sólo así se lo suelta de Vercel.';

commit;
