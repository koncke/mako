-- =============================================================================
-- 0364 — Qué avance del ticket ya se le mandó por email a quien lo levantó
-- =============================================================================
-- Martín, 2/11/2026, después de que Joan preguntara por WhatsApp «¿cómo van esos tickets?»: «crea
-- diferentes estados como para ir avisándole al usuario de cómo está avanzando su ticket. Y también
-- sería bueno de que tal vez se le envíe por email los avances. Y solamente cuando ya esté 100 %
-- finalizado, ahí sí el mensaje de WhatsApp que ya tenemos».
--
-- Lo que YA existía y no hacía falta construir: los estados de cara al cliente (`EstadoCliente` en
-- lib/tickets-reglas.ts) y la línea de tiempo con fechas (`pasosDelTicket`). Y el WhatsApp YA sale
-- sólo al final: `avisarPendientes` (lib/tickets-cierre.ts) dispara con 'resuelto', 'rechazado',
-- 'duplicado' y 'esperando_cliente'. Esa parte del pedido estaba bien.
--
-- Lo que faltaba es el aviso del AVANCE, y por eso hace falta esta columna.
--
-- ⚠️ POR QUÉ UNA COLUMNA Y NO UN BOOLEANO: hay que saber QUÉ hito se avisó, no si se avisó alguno.
-- Un ticket pasa por «recibido» y después por «en curso», y los dos merecen un correo; pero un
-- ticket que rebota entre «en curso» y «esperando cliente» mandaría uno por rebote. Guardando el
-- último hito avisado, sólo se escribe cuando el hito CAMBIA hacia adelante.
--
-- ⚠️ `avisado_at` NO SE TOCA: es del aviso FINAL (push, chat y WhatsApp) y sigue haciendo lo suyo.
-- Mezclarlos haría que un correo de avance tape el aviso de cierre.
-- =============================================================================
begin;

alter table tickets
  add column if not exists avance_email text
    check (avance_email is null or avance_email in ('recibido', 'en_curso', 'tu_respuesta', 'resuelto', 'cerrado')),
  add column if not exists avance_email_at timestamptz;

comment on column tickets.avance_email is
  'El último hito de cara al cliente (EstadoCliente) que YA se le mandó por email. Null = todavía ninguno. No reemplaza a avisado_at, que es el aviso final por push/chat/WhatsApp.';

commit;
