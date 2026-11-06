-- =============================================================================
-- 0404 — Las láminas y el CTA de los carruseles de la biblioteca de ejemplos (6/11/2026)
-- =============================================================================
-- Pedido de Martín (por el Cerebro, 6/11/2026), al rehacer la pantalla de carruseles:
--   · «poder pasar a la siguiente slide dentro de la tarjeta» → `laminas_imagenes`: las imágenes de cada lámina, en orden,
--     ya bajadas a NUESTRO bucket (`spy-miniaturas`, carpeta `carruseles/<ref>/`): el CDN de Instagram vence y da 403 desde
--     otro dominio. También es lo que lee la IA del negocio al hacer «Editar» (lib/carruseles/replica.ts).
--   · «Filtro "CTA": identifica los carruseles que piden "Comenta X palabra"» → `cta` y `cta_via`: la palabra y por dónde la
--     pide, leídas del pie (lib/carruseles/cta.ts) AL LEER: el pie vence a los 30 días (`podarVencido`), igual que `cierre`.
--
-- Las llena el script de la PC (scripts/carruseles-biblioteca.mts): `laminas` (lee las publicaciones por su link, ~US$0,0025
-- cada una, y baja las imágenes) y `reclasificar` (el CTA de lo guardado, gratis). Una lectura nueva (`leer`) ya las guarda.
--
-- Sólo AGREGA columnas. ORDEN DE DESPLIEGUE: indiferente. El código lee con `*` y tolera que falten: sin `laminas_imagenes` la
-- tarjeta muestra la portada sola (sin flechas); sin `cta` el filtro lee el texto que queda.
-- Global, como las tablas de la 0392 (sin `workspace_id`, RLS sin políticas, sin permisos para la clave pública).
-- =============================================================================
begin;

alter table carruseles_biblioteca_piezas add column if not exists laminas_imagenes text[];
alter table carruseles_biblioteca_piezas add column if not exists cta text;
alter table carruseles_biblioteca_piezas add column if not exists cta_via text;

do $$ begin
  alter table carruseles_biblioteca_piezas add constraint carruseles_biblioteca_piezas_laminas_imagenes
    check (laminas_imagenes is null or cardinality(laminas_imagenes) between 1 and 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table carruseles_biblioteca_piezas add constraint carruseles_biblioteca_piezas_cta
    check (cta is null or char_length(cta) between 1 and 40);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table carruseles_biblioteca_piezas add constraint carruseles_biblioteca_piezas_cta_via
    check (cta_via is null or cta_via in ('comentario', 'mensaje'));
exception when duplicate_object then null; end $$;

comment on column carruseles_biblioteca_piezas.laminas_imagenes is
  'Las imágenes de cada lámina, en orden, en nuestro bucket (spy-miniaturas/carruseles/<ref>/). La tarjeta las pasa de a una y la IA las lee al editar.';
comment on column carruseles_biblioteca_piezas.cta is
  'La palabra que el pie pide comentar o mandar por mensaje (lib/carruseles/cta.ts), leída al guardar. null = no la pide.';

commit;
