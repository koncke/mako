-- =============================================================================
-- 0146 — `generar_imagen` entra a la cola de Flow
-- =============================================================================
-- La 0145 dejó cuatro tipos: subir_imagen, generar_clip, estado_clips, creditos.
-- Faltaba el que genera una imagen desde cero, que es la primera prueba REAL del
-- puente que produce algo: `creditos` solo lee, y un circuito que solo lee no
-- prueba que se pueda escribir.
--
-- Y es la prueba barata: en Flow las imágenes no consumen créditos de video.
--
-- El CHECK se rehace entero en vez de agregar uno nuevo: dos constraints sobre la
-- misma columna se contradicen sin que nada avise, y la que gana es la que se
-- evaluó primero.

alter table flow_trabajos drop constraint if exists flow_trabajos_tipo_check;

alter table flow_trabajos add constraint flow_trabajos_tipo_check
  check (tipo in ('subir_imagen', 'generar_imagen', 'generar_clip', 'estado_clips', 'creditos'));
