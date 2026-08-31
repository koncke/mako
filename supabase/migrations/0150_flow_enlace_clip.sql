-- =============================================================================
-- 0150 — `enlace_clip` entra a la cola de Flow
-- =============================================================================
-- El trabajo que consigue el enlace FIRMADO de un clip ya generado.
--
-- Sin esta línea el `insert` de `encolar()` viola el CHECK, la fila no entra, y
-- `encolar` devuelve `null` **sin decir nada**: la pantalla se queda esperando un
-- trabajo que nunca existió. Costó una vuelta entera de diagnóstico el 31/08/2026
-- con el código de la bajada ya desplegado y funcionando — lo único que faltaba
-- era que la base aceptara el tipo.
--
-- ⚠️ El CHECK se rehace ENTERO, como en la 0146: dos constraints sobre la misma
-- columna se contradicen sin que nada avise, y la que gana es la que se evaluó
-- primero.
--
-- Por qué el tipo es necesario, en corto: el enlace de un clip no vive en ninguna
-- respuesta de Flow. `getMediaUrlRedirect?name=<id>` REDIRIGE al archivo, y ese
-- redirect no se puede leer con `fetch` ni desde la página ni desde el service
-- worker de la extensión — CORS lo corta en las dos. Lo único que lo ve es
-- `webRequest`. Así que hace falta un trabajo que PROVOQUE el pedido en el
-- navegador del cliente y mire a dónde fue.

alter table flow_trabajos drop constraint if exists flow_trabajos_tipo_check;

alter table flow_trabajos add constraint flow_trabajos_tipo_check
  check (tipo in (
    'subir_imagen', 'generar_imagen', 'generar_clip', 'estado_clips', 'creditos',
    'enlace_clip'
  ));
