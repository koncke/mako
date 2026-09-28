-- =============================================================================
-- 0177 — «Agencia» es un PLAN, y deja de ser una etiqueta encima de «Completo»
-- =============================================================================
-- Pedido del dueño el 27/09/2026, mirando la tarjeta de Código Inmobiliario, que
-- decía «Completo» + un chip verde «Agencia»: «Un cliente de Agencia NO es super
-- admin y tampoco Completo, es Agencia».
--
-- ORDEN DE DESPLIEGUE: esta migración va **ANTES o JUNTO** con el deploy, y el
-- UPDATE de la última línea es seguro en ese orden POR UNA RAZÓN QUE NO
-- GENERALIZA — vale la pena escribirla:
--
--   Entre esta migración y el deploy, el catálogo TS vivo NO conoce 'agencia', y
--   `capaDef` es FAIL-OPEN: cae a `CAPA_DEFAULT` = 'completo'. O sea que en esa
--   ventana el ws13 se comporta como 'completo'… que es exactamente la capa que
--   tiene HOY. El cambio es invisible para él.
--
--   ⚠️ CON CUALQUIER OTRO WORKSPACE ESTO SERÍA UN AGUJERO: pasar un cliente de
--   'pm' a una capa que el código todavía no conoce lo deja viendo TODAS las tabs
--   del producto, sin error y sin log. Si algún día se agrega otra capa, el UPDATE
--   va DESPUÉS del deploy, no acá.
--
-- ⚠️ Y AL REVÉS TAMPOCO: código primero y CHECK después significa un dropdown que
-- ofrece un tipo que la base rechaza con 23514, devuelto como un 500 con el texto
-- crudo de Postgres en la cara.

-- ── El CHECK ────────────────────────────────────────────────────────────────
-- Mismo patrón que la 0096, que es la que agregó 'superadmin'. El CHECK no es
-- cosmético: es la ÚNICA red contra el fail-open de `capaDef`.
alter table workspaces drop constraint if exists workspaces_capa_valida;
alter table workspaces
  add constraint workspaces_capa_valida
  check (capa = any (array['pm'::text, 'completo'::text, 'superadmin'::text, 'agencia'::text]));

-- ── Código Inmobiliario pasa a ser lo que es ────────────────────────────────
-- Por id y no por nombre: un nombre se edita desde la pantalla y este script
-- quedaría apuntando a nadie. Y `where capa = 'completo'` para que, si alguien ya
-- lo movió a mano, esto no lo pise.
update workspaces set capa = 'agencia', updated_at = now()
where id = 13 and capa = 'completo';

comment on column workspaces.capa is
  'El plan del cliente: qué compró y qué tabs ve. «agencia» además puede tener clientes propios — lo lee esAgencia() en lib/agencia.ts. «superadmin» NO es un plan: es cómo se identifica la plataforma (wsSuperAdmin), y por eso no está en CAPAS_VENDIBLES.';
