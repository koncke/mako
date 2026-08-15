-- =============================================================================
-- 0136 — `auto`: el video arrancó SOLO, nadie lo pidió
-- =============================================================================
-- Panda y muchos reproductores arrancan con autoplay. Hasta ahora un evento
-- `play` se contaba igual viniera de un dedo o del propio player: el chequeo
-- «reproduce tu video» pasaba en verde sin que nadie tocara nada, y la retención
-- mezclaba a quien quiso ver con quien pasó por al lado.
--
-- Nullable y sin default: NULL es «no lo sé» —todos los eventos anteriores a esta
-- migración— y eso NO es lo mismo que `false`. Un default los convertiría a todos
-- en «lo pidió una persona», que es justo el dato que no tenemos.
-- =============================================================================

alter table public.vsl_events
  add column if not exists auto boolean;

comment on column public.vsl_events.auto is
  'true = el play lo disparó el autoplay del reproductor, no una persona. NULL en los eventos anteriores a la mig 0136.';
