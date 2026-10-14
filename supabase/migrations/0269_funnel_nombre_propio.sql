-- 0269 — El CRM (un embudo) tiene nombre PROPIO: deja de ser el de su producto.
--
-- Pedido de Martín (13/10/2026): «desvincula lo que hace que se ponga automáticamente el
-- nombre de ese CRM al nombre de un curso, porque ahora ya no debería ser así, sino que los
-- cursos deberían tener el nombre de una OFERTA».
--
-- Hasta hoy la pantalla mostraba el nombre del PRODUCTO principal de cada embudo
-- (`nombreVisible`, lib/lead-funnel-reglas.ts) y renombrar el CRM escribía el producto
-- (`renombrarFunnel`, lib/funnels.ts) — y con el producto, el curso. El código nuevo muestra
-- `funnels.nombre` y renombra sólo eso. Para que NADIE vea un cambio, acá se le copia a cada
-- embudo el nombre que mostraba. Medido el 13/10/2026: 21 embudos, 2 con nombre distinto del
-- de su producto (los dos del ws1), ninguno con más de un producto principal.
--
-- ⚠️ ORDEN: ANTES (o junto con) el deploy. El código nuevo lee `funnels.nombre`; el viejo lo
-- ignora cuando hay producto, así que correr esto primero no cambia nada en pantalla.
--
-- ⚠️ `funnels_nombre_uk` es único por workspace sobre lower(btrim(nombre)): si el nombre del
-- producto ya lo usa OTRO embudo del mismo negocio, ese embudo conserva el suyo (se avisa).

do $$
declare r record;
begin
  for r in
    select distinct on (f.id) f.id, f.workspace_id, btrim(p.nombre) as nuevo
    from funnels f
    join v_funnel_productos v on v.funnel_id = f.id and v.es_principal
    join productos p on p.id = v.producto_id
    where coalesce(btrim(p.nombre), '') <> ''
      and f.nombre is distinct from btrim(p.nombre)
    order by f.id, v.producto_id desc
  loop
    begin
      update funnels set nombre = r.nuevo, updated_at = now() where id = r.id;
    exception when unique_violation then
      raise notice 'ws% embudo % conserva su nombre: «%» ya lo usa otro embudo del negocio', r.workspace_id, r.id, r.nuevo;
    end;
  end loop;
end $$;
