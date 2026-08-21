-- =============================================================================
-- 0141 — el juicio del Perro y el número que se muestra son DOS cosas
-- =============================================================================
-- `score` es lo que se ve y lo que ordena el tablero. Hasta hoy era también lo único que
-- había, y por eso cualquier ajuste determinista sobre él era IRREVERSIBLE: el reparto
-- (`curveTaskScores`) reasigna por ranking a bandas fijas, así que el valor anterior deja
-- de existir en cuanto se escribe el nuevo. Restarle 15 puntos a algo por estar quieto y
-- después querer devolvérselos era imposible: no quedaba de dónde.
--
-- `score_base` guarda EL JUICIO: lo que decidió el Perro, o lo que decidió el dueño al
-- debatirlo o al arrastrar la tarjeta. No lo toca nada más.
--
--     score = curva( score_base + empuje por deadline − castigo por quietud , dependencias )
--
-- Con eso el reparto pasa a ser IDEMPOTENTE —correrlo dos veces da lo mismo, porque no lee
-- su propia salida— y REVERSIBLE: si mañana se apaga el envejecimiento, el tablero vuelve
-- exacto al juicio original. Sin esta columna, cada corrida se sumaba a la anterior y el
-- castigo de un mes se convertía en el castigo de un año.
--
-- ⚠️ NO es «dos productores del mismo número», que es el antipatrón que este board acaba
-- de terminar de pagar. Es exactamente lo contrario: UN productor por número, con una
-- derivación explícita entre los dos. `score_base` lo escribe quien JUZGA; `score` lo
-- escribe solo el reparto, y nunca al revés.
--
-- Backfill = el score actual: es el mejor juicio disponible el día de la migración.
-- =============================================================================

begin;

alter table plan_tareas add column if not exists score_base int;
update plan_tareas set score_base = score where score_base is null;

comment on column plan_tareas.score_base is 'El JUICIO (Perro o dueño). `score` se DERIVA de acá + deadline + quietud + dependencias. El reparto nunca escribe esta columna (mig 0141).';

commit;

notify pgrst, 'reload schema';
