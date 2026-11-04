-- =============================================================================
-- 0393 — La biblioteca de carruseles: ¿cada publicación parece CONTENIDO o es personal?
-- =============================================================================
-- Pedido del Cerebro con lo medido en la primera carga (4/11/2026, ~21:20 UTC): «El orden por outlier sube publicaciones
-- personales. El primero de @leilahormozi es una foto de su embarazo ("Anytime now…", 9,7×). Busca una forma medible de
-- bajarlas sin esconder lo que funciona».
--
-- La señal la calcula `pareceContenido` (lib/carruseles/clasificar.ts) AL LEER: con el texto alternativo que Instagram escribe
-- de la portada («May be an image of text…» o «…of 1 person…»), que no se guarda, y con el pie, que vence a los 30 días.
-- Por eso se guarda el RESULTADO acá: true (tiene tipo, pide algo al final, o la portada tiene texto), false (la portada es
-- de personas sin texto, o un pie corto sin nada de contenido), null (no se puede decir). Sólo ordena: lo que es false va
-- después en «Mayor outlier» y «Más interacción», y se sigue viendo con su número.
--
-- Sólo AGREGA una columna. ORDEN DE DESPLIEGUE: indiferente. Sin la columna, la pantalla la calcula del texto que queda y el
-- script de la PC (scripts/carruseles-biblioteca.mts) no la manda (lo detecta y lo dice).
-- =============================================================================
begin;

alter table carruseles_biblioteca_piezas add column if not exists parece_contenido boolean;

comment on column carruseles_biblioteca_piezas.parece_contenido is
  '¿Parece contenido (true) o una publicación personal (false)? null = no se puede decir. Sólo ordena. lib/carruseles/clasificar.ts.';

commit;
