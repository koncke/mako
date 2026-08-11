-- =============================================================================
-- 0129 — el ACTA de la revisión de un borrador: qué se preguntó y qué se contestó
-- =============================================================================
-- El dueño, el 11/8/2026, sobre un bug que vio en pantalla (la opción «Todavía no
-- hay fecha» duplicada y las dos marcadas): «no creo que hayas revisado bien los
-- borradores, porque me aparecen bugs como este… ¿guardás los borradores luego
-- para poder revisarlos?».
--
-- No se guardaban, y por eso la auditoría no podía verlo. Dos agujeros distintos:
--
--  1. Las preguntas DINÁMICAS (las que arma «Profundizar borrador» al abrir el
--     link) viven en el localStorage del navegador y nunca tocan la base. De 23
--     borradores auditados, CERO tenían rastro de una sola.
--  2. Las estáticas sí se guardan —en `notas`— pero al APLICAR se vacían a
--     propósito, porque hablaban de tareas que ya entraron. O sea que el registro
--     existe justo hasta el momento en que uno querría mirarlo.
--
-- Resultado: cada bug del formulario solo se descubre si el dueño lo ve con los
-- ojos y saca una captura. Eso no escala y ya nos costó una auditoría entera que
-- dijo «revisé las preguntas» cuando lo único que había mirado eran las buenas.
--
-- `revision` es el acta y NO se vacía nunca. Es append-only y va aparte de `notas`
-- justamente para eso: `notas` son las preguntas PENDIENTES (el wizard las lee para
-- saber qué falta), esto es lo que YA PASÓ. Mezclarlos haría que aplicar tenga que
-- elegir entre borrar el registro o re-preguntar lo mismo.
--
-- Cada entrada: { pregunta, tipo, opciones[], respuesta, origen: 'estatica'|'dinamica', ts }

alter table plan_propuestas
  add column if not exists revision jsonb not null default '[]'::jsonb;

comment on column plan_propuestas.revision is
  'Acta append-only de la revisión: qué preguntó MaKo (con su tipo y opciones) y qué contestó el dueño. NO se vacía al aplicar — es lo único que permite auditar el formulario sin mirarlo con los ojos.';
