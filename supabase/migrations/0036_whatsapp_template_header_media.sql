-- =============================================================================
-- 0036_whatsapp_template_header_media — encabezado multimedia en borradores
-- =============================================================================
-- Una plantilla puede tener un encabezado de TEXTO (col header) o MULTIMEDIA
-- (imagen/video/documento). Para crear la plantilla, Meta exige una MUESTRA del
-- archivo, que se sube a su resumable-upload API y devuelve un "handle". Guardamos
-- ese handle + el formato + el nombre del archivo para poder reenviar/editar.
-- { format: 'IMAGE'|'VIDEO'|'DOCUMENT', handle: text, filename: text }

begin;

alter table whatsapp_template_drafts
  add column if not exists header_media jsonb;

commit;
