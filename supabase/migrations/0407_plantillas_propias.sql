-- =============================================================================
-- 0407 — Las PLANTILLAS PROPIAS de cada negocio: una creación que no se publica (privada), y el ranking de la semana
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae «Guardar como plantilla» (lib/creaciones.ts con
-- `estado = 'privada'`). Agrega y no saca nada: la versión desplegada nunca escribe 'privada'. Sin ella, guardar una
-- plantilla sólo para el negocio contesta «Falta la migración 0407 (plantillas propias).» y lo demás anda igual.
--
-- Leila (30/10/2026): plantillas propias, que se guarden para su negocio o se compartan con la comunidad, con estrellas.
-- Martín (13/10/2026, las estrellas): «para que los usuarios hagan sus creaciones y otros usuarios puedan puntuarles».
--
-- Una plantilla propia ES una creación (mig 0273), con un estado más:
--   · 'privada': la ve y la usa SÓLO su negocio (`workspace_origen`). Lleva la definición tal cual (sus precios, sus
--     links): es suya. No recibe estrellas.
--   · 'publicada': la ven todos. La definición pasó por la limpieza de lib/plantillas-propias-reglas.ts (sin el nombre
--     del negocio, su gente, emails, teléfonos, links, @ ni precios) y por su red (`fugasDe`), en el código.
--   · 'retirada': como siempre.
-- El ranking de la semana cuenta `creacion_estrellas.created_at`: el índice es para eso.
-- No crea funciones: no hay nada que revocar.

begin;

alter table creaciones drop constraint if exists creaciones_estado_check;
alter table creaciones add constraint creaciones_estado_check check (estado in ('privada', 'publicada', 'retirada'));

-- «Tus plantillas» de una tab: las de ESTE negocio y de ESE tipo.
create index if not exists idx_creaciones_del_negocio on creaciones (workspace_origen, tipo, estado);
-- El ranking de la semana: las estrellas recientes.
create index if not exists idx_creacion_estrellas_cuando on creacion_estrellas (created_at desc);

comment on column creaciones.estado is 'privada (sólo su negocio), publicada (todos, sin datos del negocio) o retirada (fuera de la galería).';

commit;
