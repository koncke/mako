-- =============================================================================
-- 0182 — «Lead entrante» en vez de «Lead (Instant form)»
-- =============================================================================
-- ORDEN DE DESPLIEGUE: DA IGUAL. Esto sólo cambia un RÓTULO dentro de
-- `funnels.data.pipeline`; la clave de la etapa (`lead`) no se toca, así que
-- ninguna versión del código lee distinto antes o después.
--
-- POR QUÉ: el rótulo viejo nombraba UNA de las cinco formas de entrar —el
-- formulario instantáneo de Meta— en la etapa por la que entran las cinco. Quien
-- vende por carrito leía el nombre de un producto de Meta que no usa. Se cambió
-- el default en `lib/pipeline.ts` (DEFAULT_STAGES), y el default sólo alcanza a
-- los embudos que todavía no guardaron su pipeline: los que sí lo guardaron
-- tienen NUESTRA cadena congelada adentro de su jsonb.
--
-- Medido el 29/09/2026 contra producción, 15 embudos:
--   · 10 con el rótulo viejo tal cual  → los toca esta migración
--   ·  1 renombrado por el cliente («Contacto nuevo», ws11) → NO se toca
--   ·  4 con el pipeline vacío         → caen al default, ya dicen lo nuevo
--
-- ⚠️ EL `where` COMPARA CONTRA LA CADENA EXACTA, y es lo que hace que esto sea
-- seguro: un embudo renombrado no matchea. Pisar «Contacto nuevo» sería borrar
-- una decisión del cliente para poner un default nuestro.
-- =============================================================================

update funnels f
set data = jsonb_set(
  f.data,
  '{pipeline}',
  (
    select jsonb_agg(
             case when e->>'kind' = 'entrada' and e->>'label' = 'Lead (Instant form)'
                  then jsonb_set(e, '{label}', '"Lead entrante"')
                  else e end
             order by ord)
    from jsonb_array_elements(f.data->'pipeline') with ordinality t(e, ord)
  )
)
where f.data->'pipeline' @> '[{"kind":"entrada","label":"Lead (Instant form)"}]'::jsonb;
