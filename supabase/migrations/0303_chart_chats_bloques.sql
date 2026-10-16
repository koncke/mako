-- =============================================================================
-- 0303 — Los adjuntos de un mensaje del chat con MaKo, guardados (`chart_chats.bloques`)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES, JUNTO o DESPUÉS del deploy que trae los adjuntos del Second Brain: agrega una
-- columna y no saca nada, y el código la tolera ausente. Sin la columna, el chat anda igual que antes: la foto o el
-- PDF le llegan a MaKo en el turno, pero al recargar no vuelven (el binario que se subió se borra en el acto, no queda
-- suelto). Con la columna, vuelven.
--
-- Etapa 2 de docs/diseno-mako-ai-native.md, tanda 4 (pedido de Martín: «los adjuntos se guardan en el archivero»).
-- El binario va al bucket privado `archivero`, en `<ws>/chat/<uuid>` (lib/chat-mako-bloques.ts); acá se guarda la
-- REFERENCIA, una por archivo del mensaje:
--   [{ "k": "adjunto", "path": "<ws>/chat/<uuid>", "nombre": "...", "mime": "...", "tipo": "image"|"document",
--      "archivero": { "estado": "guardado", "id": "..." } | { "estado": "fallo", "motivo": "..." } }]
-- `archivero` lo anota después de responder el registro del PDF en El Archivero (sólo el admin; las fotos no).
-- La pantalla nunca ve el `path`: pide el archivo a /api/mako/chat?adjunto=<id del mensaje>:<n>, que mira de quién
-- es la conversación antes de firmar.
--
-- `chart_chats` ya tiene RLS (0118) y está en TENANT_TABLES: no cambia nada de eso.
-- =============================================================================

alter table chart_chats add column if not exists bloques jsonb;

comment on column chart_chats.bloques is
  'Los adjuntos de un mensaje del chat con MaKo (Second Brain y teléfono): referencias al bucket archivero, <ws>/chat/<uuid>. Ver lib/chat-mako-bloques.ts.';
