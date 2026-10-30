-- =============================================================================
-- 0350 · El Media Buyer: DÓNDE, HASTA y las campañas que lanza (29/10/2026)
-- =============================================================================
-- Lo prometido a la agencia de Thiago (docs/promesas/2910-llamada-thiago.md): «quiero que sea en tal zona, país o ciudad,
-- solamente hasta tal fecha» y «lánzame una campaña». El código: lib/media-buyer/zona.ts, campana.ts y vigia.ts.
--
--   · `zona`: los lugares de Meta donde el Media Buyer puede prender y subir presupuestos ([] = toda la cuenta).
--   · `hasta` y `hasta_campanas`: la fecha de fin de toda la cuenta y la de cada campaña (gana la de la campaña). Pasada la
--     fecha, la campaña se pausa sola (táctica `hasta`).
--   · `crear_campana`: una campaña que lanzó MaKo (desde «Nueva campaña» o por la API) queda como decisión, con su Deshacer.
--
-- ORDEN: ANTES del deploy. Sólo AGREGA columnas con default y agranda dos CHECK: ninguna fila que hoy pasa deja de pasar.
-- Sin ella, `leerConfig` no ve las columnas nuevas (las da vacías) y guardar una zona o una fecha da error de columna; la
-- corrida sigue como hoy. El número lo confirma el Cerebro (0349 es de zernio-token-2910). Idempotente.
-- Aplicada a mano en producción el 29/10/2026 a las 21:50 (la aplicó el Cerebro, con el sí de Martín).
-- =============================================================================

begin;

alter table media_buyer_config add column if not exists zona jsonb not null default '[]'::jsonb;
alter table media_buyer_config add column if not exists hasta date;
alter table media_buyer_config add column if not exists hasta_campanas jsonb not null default '{}'::jsonb;

alter table media_buyer_config drop constraint if exists media_buyer_config_zona_lista;
alter table media_buyer_config add constraint media_buyer_config_zona_lista check (jsonb_typeof(zona) = 'array');
alter table media_buyer_config drop constraint if exists media_buyer_config_hasta_campanas_objeto;
alter table media_buyer_config add constraint media_buyer_config_hasta_campanas_objeto check (jsonb_typeof(hasta_campanas) = 'object');

alter table media_buyer_decisiones drop constraint if exists media_buyer_decisiones_tipo_check;
alter table media_buyer_decisiones add constraint media_buyer_decisiones_tipo_check
  check (tipo in ('subir_presupuesto', 'bajar_presupuesto', 'pausar', 'activar', 'variaciones_texto', 'variaciones_hook', 'crear_anuncios', 'crear_campana'));
alter table media_buyer_decisiones drop constraint if exists media_buyer_decisiones_tactica_check;
alter table media_buyer_decisiones add constraint media_buyer_decisiones_tactica_check
  check (tactica in ('surf', 'sunsetting', 'stop_loss', 'revive', 'calidad', 'ganador', 'manual', 'hasta'));

commit;
