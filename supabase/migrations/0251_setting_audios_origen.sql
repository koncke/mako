-- =============================================================================
-- 0251 — setting_audios.origen: la biblioteca del dueño vs. las notas de voz con que contesta un AI Step
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae el AI Step v2 (docs/diseno-ai-step-v2.md §5).
-- Agrega una columna con default y no saca nada: la versión desplegada no la mira, así que aplicarla antes no
-- le molesta a nadie. El código nuevo la tolera AUSENTE (lib/setting-audios.ts): `listAudios` cae a la lectura
-- de antes ante un 42703, y una respuesta en audio sin la columna FALLA y sale en texto (nunca cae en la
-- biblioteca). O sea: sin esta migración, un AI Step con «Responde con: Audio» contesta en texto.
--
-- Pedido de Martín (11/10/2026, décima tanda, FEEDBACK AI STEP 1): «Agrega la opción de responder con audios,
-- ya que se puede gracias a que tenemos elevenlabs conectado».
--
-- POR QUÉ UNA COLUMNA Y NO OTRA TABLA: el borrador (`wa_borradores.audio_id`) y `enviarBorrador` ya mandan una
-- nota de voz de ESTA tabla por id. La respuesta de un AI Step es una nota de voz más; lo único distinto es que
-- no es de la biblioteca del dueño. Sin el filtro, cada respuesta en audio a cada lead le aparecía en su lista.
--
-- Lo que hay hoy (todo lo subido por el dueño) queda 'biblioteca' por el default.

begin;

alter table setting_audios add column if not exists origen text not null default 'biblioteca';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'setting_audios_origen_check') then
    alter table setting_audios add constraint setting_audios_origen_check check (origen in ('biblioteca', 'ai_step'));
  end if;
end $$;

comment on column setting_audios.origen is
  '''biblioteca'' = lo que subió el dueño (lo lista `listAudios`); ''ai_step'' = la nota de voz con que un AI Step le contestó a un lead (sólo por id: el borrador y el envío).';

commit;
