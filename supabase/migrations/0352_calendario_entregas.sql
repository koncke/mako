-- =============================================================================
-- 0352_calendario_entregas — el Calendario agenda REUNIONES DE ENTREGA del servicio (29/10/2026)
-- =============================================================================
-- Martín (29/10): «Esa pestaña es principalmente para gestionar publicaciones, para recordatorios de deadlines del propio
-- Plan, para reuniones de llamadas de ventas, reuniones de entrega de servicio». Las tres primeras ya tenían de dónde salir
-- (las publicaciones y las llamadas propias, el Plan, el CRM); la entrega sólo salía de la agenda de Google. Ésta suma
-- `entrega` a los tipos de `calendario_eventos` (lib/calendario-modelo.ts, TIPOS_EVENTO): el «+» de Entregas del Calendario,
-- la API de MaKo (`crear_evento`, área calendario) y el teléfono crean una fila con ese tipo.
-- Sólo agranda la lista: ninguna fila que hoy pasa deja de pasar. Idempotente: se puede correr dos veces.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES (o junto con) el código de la rama cal-classroom-2910. Sin ella, crear una «Reunión de
--    entrega» la rechaza el CHECK y la pantalla dice «no se pudo guardar»; nada más se rompe (leer, mover y lo demás siguen
--    igual). Después de aplicarla: `scripts/verificar-migraciones-aplicadas.mjs`.
-- =============================================================================

alter table calendario_eventos drop constraint if exists calendario_eventos_tipo_ok;
alter table calendario_eventos add constraint calendario_eventos_tipo_ok
  check (tipo in ('publicacion', 'bloque', 'llamada', 'otro', 'entrega'));
