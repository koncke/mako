-- =============================================================================
-- 0123_propuesta_cruzado — el cruce «ya está en el plan» se corre UNA vez
-- =============================================================================
-- El cruce del Perro (¿esta candidata ya existe en el tablero?) se re-ejecutaba
-- en CADA apertura del modal de la reunión: una llamada de IA por cada vez que
-- entrabas, con el resultado viviendo solo en el estado del componente.
--
-- Dos costos, y el segundo es el que duele: (1) se paga el mismo análisis una y
-- otra vez; (2) mientras corría —y tarda— las tareas se veían como NUEVAS y se
-- podían cargar al plan. O sea que entrar y confirmar rápido creaba duplicados
-- de tareas que el cruce iba a marcar dos segundos después.
--
-- Con esta marca el resultado se guarda en las tareas del borrador (cada una con
-- su `enriquece`) y el modal ya no vuelve a preguntar.
--
--   NULL      → nunca se cruzó, hay que correrlo
--   timestamp → ya se cruzó; lo que hay en `tareas[].enriquece` es la respuesta

alter table plan_propuestas add column if not exists cruzado_at timestamptz;

comment on column plan_propuestas.cruzado_at is
  'Cuándo corrió el cruce anti-duplicados del Perro sobre este borrador. NULL = falta correrlo. El resultado vive en tareas[].enriquece.';
