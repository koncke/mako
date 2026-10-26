-- =============================================================================
-- 0337_mako_knowledge_modelo — con qué modelo se embebió cada fila del conocimiento (25/10/2026)
-- =============================================================================
-- Numerada por el Cerebro (25/10/2026); se aplica con el sí de Martín. Revisada contra producción ese día: `embedding` es
-- jsonb, 77 filas de 1536 (las de text-embedding-3-small de antes del 22/10), 42 sin vector y ninguna de 768.
--
-- El Cerebro, 25/10/2026 (docs/conexiones-y-ayuda.md): el buscador de conocimiento deja de depender de Gemini. Embebe con
-- la IA del negocio que la tenga: su OpenAI (`text-embedding-3-small`, 1536) primero, su Gemini (`gemini-embedding-001`, 768)
-- si es lo único; sin ninguna, busca por palabras. «Cada fila guarda con qué se embebió. Una pregunta sólo se compara contra
-- filas del mismo modelo, y el resto se re-embebe solo, de a poco, cuando el negocio conecta su IA» (lib/embeddings.ts,
-- lib/mako-knowledge.ts).
--
--   · `mako_knowledge.embedding_modelo`: el modelo del vector de `embedding` (null = sin vector). El vector sigue en la misma
--     columna jsonb: una fila tiene UN vector, el del modelo con que se embebió la última vez.
--   · Las filas que ya tienen vector se marcan por su largo (768 = Gemini, 1536 = OpenAI), que es lo mismo que el código
--     deduce mientras la columna no está (`modeloDelVector`).
--
-- TODO ADITIVO: una columna nullable con su check y un update de las filas con vector. Ninguna lectura vieja la mira. Seguro
-- de re-ejecutar.
-- SIN ESTA MIGRACIÓN el código anda igual: escribe y lee sin la columna (lo detecta por el error de PostgREST y no lo vuelve a
-- probar en ese proceso) y el modelo sale del largo del vector. Lo que se pierde es que quede escrito.
-- =============================================================================

alter table mako_knowledge add column if not exists embedding_modelo text
  check (embedding_modelo is null or embedding_modelo in ('text-embedding-3-small', 'gemini-embedding-001'));

-- El largo, sólo de lo que es un array: Postgres no promete el orden de un `and`, y `jsonb_array_length` de un escalar tira.
update mako_knowledge
   set embedding_modelo = case case when jsonb_typeof(embedding) = 'array' then jsonb_array_length(embedding) end
                            when 768  then 'gemini-embedding-001'
                            when 1536 then 'text-embedding-3-small'
                          end
 where embedding_modelo is null
   and case when jsonb_typeof(embedding) = 'array' then jsonb_array_length(embedding) end in (768, 1536);

notify pgrst, 'reload schema';
