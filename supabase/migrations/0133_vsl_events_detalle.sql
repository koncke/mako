-- =============================================================================
-- 0133 — vsl_events.detalle: qué se clickeó
-- =============================================================================
-- El 14/08/2026 el dueño probó la landing de una clienta: apretó los CTA que
-- scrollean al formulario y el enlace de WhatsApp, y no se registró nada. Tenía
-- razón — el snippet solo emitía pageview, play, pNN, sNN y exit. Nunca un click.
--
-- Para una landing cuyo CTA es un ancla (#registro) o un link de WhatsApp, el
-- click ES el embudo: entre «visitó» y «dejó sus datos» no había NINGÚN punto
-- intermedio, así que una página que convertía mal no se podía distinguir de una
-- que nadie miraba.
--
-- Por qué una columna nueva y no reusar `vsl_titulo`: son dos preguntas distintas
-- («cómo se llama el video» vs «qué se clickeó») y meterlas en el mismo campo es
-- exactamente cómo se pierde una de las dos. Este repo ya pagó esa factura.
--
-- Nullable y sin default: un evento que no es un click no tiene detalle, y NULL
-- dice eso. Un default inventaría un dato — que es el otro error que ya costó
-- caro acá (las filas con tipo_evento = 'desconocido').
-- =============================================================================

alter table public.vsl_events
  add column if not exists detalle text;

comment on column public.vsl_events.detalle is
  'Para tipo_evento=''click'': el destino (href) o el texto del botón, saneado a 300 caracteres. NULL en el resto de los eventos.';

-- Índice parcial: las consultas de clicks siempre filtran por workspace + tipo, y
-- los clicks son una fracción de la tabla. Un índice sobre todas las filas
-- ocuparía de más para responder lo mismo.
create index if not exists idx_vsl_events_click
  on public.vsl_events (workspace_id, created_at desc)
  where tipo_evento = 'click';
