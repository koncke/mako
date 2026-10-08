-- =============================================================================
-- 0226 — La consigna de la tarea, con formato: `curso_clases.tarea_html`
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy. El código nuevo PIDE la columna en la lectura de clases
-- que comparten el portal del alumno, /mi-curso, la ficha, la tab Curso y el cron de los mensajes
-- (`COLUMNAS_CLASE`, lib/curso-datos.ts). Sin la columna, PostgREST rechaza la consulta ENTERA
-- («column curso_clases.tarea_html does not exist») y se caen el portal de cada cliente y la tab —
-- el precedente es la 0212. Agrega y no saca nada: la versión desplegada no la mira, así que
-- aplicarla antes no le cambia nada a nadie.
--
-- Pedido (audio del 08/10/2026, la prueba del curso con alguien que tiene el suyo, item 11, 18:00):
-- «sería bueno que sea formateable la descripción de la tarea, como lo ves arriba, la descripción
-- del curso, o sea, que tenga negrita». Es lo mismo que la 0216 hizo con la descripción de la clase:
--
--   · `tarea_html`: la consigna de la TAREA PRINCIPAL, HTML saneado en el server con lista blanca
--     (lib/html-seguro.ts), con los adjuntos por referencia `mako-adjunto:<uuid>`.
--   · `tarea` (la de siempre) sigue siendo su TEXTO PLANO, DERIVADO al guardar
--     (`tareaParaGuardar`, lib/curso-tarea-html.ts): lo leen la IA, los mensajes y `tieneTarea`.
--   · NULL = no tiene consigna con formato: se dibuja `tarea` como texto, que es lo de antes. Por
--     eso NO lleva default '' (la 0216 sí): una fila de antes no tiene que decir «tengo HTML vacío».
--
-- Las tareas de MÁS (item 12, «que se pueda agregar más de una tarea») NO van acá: son campos de tipo
-- `seccion` adentro del jsonb `campos`, con su título y su consigna (`Campo.descripcionHtml`). No
-- piden migración.
--
-- El tope es el de la descripción (0216): 200.000 caracteres. El server topea antes (`TOPE_HTML` de
-- lib/html-seguro.ts, 100.000 ya saneado); esto es la red si algún camino se lo saltea.
--
-- RLS on sin políticas = sólo server-side (service_role), igual que el resto del curso: la tabla ya
-- lo tiene (0202) y esto sólo agrega una columna. Se repite por si una base se armó a mano sin él:
-- es idempotente y no cambia nada donde ya está.

begin;

alter table curso_clases add column if not exists tarea_html text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'curso_clases_tarea_html_largo') then
    alter table curso_clases add constraint curso_clases_tarea_html_largo
      check (tarea_html is null or char_length(tarea_html) <= 200000);
  end if;
end $$;

comment on column curso_clases.tarea_html is
  'La consigna de la tarea principal con formato: HTML saneado en el server (lib/html-seguro.ts), adjuntos por referencia mako-adjunto:<uuid>. NULL = no tiene (se dibuja `tarea`). `tarea` lleva su texto plano, derivado al guardar. Las tareas de más son campos `seccion` del jsonb `campos`.';

alter table curso_clases enable row level security;
revoke all on curso_clases from anon, authenticated;

commit;
