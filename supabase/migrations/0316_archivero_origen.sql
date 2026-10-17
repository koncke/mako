-- =============================================================================
-- 0316 — De dónde vino cada documento de El Archivero (17/10/2026, «Pendientes B3»)
-- =============================================================================
-- docs/relevo/offer.md: «`archivero_files` no guarda de dónde vino un documento (pide migración)». Desde el 15/10 el
-- chat de Offer deja sus archivos en El Archivero (`registrarDocumentoSinPisar`) y desde el 17/10 el onboarding deja
-- «Lo que vendes»: en la lista se veían igual que lo que la persona subió a mano.
--
-- ORDEN DE DESPLIEGUE: da lo mismo. El código la TOLERA (lib/archivero.ts): sin la columna, inserta sin `origen` y lee
-- sin ella (y lo dice en el log). Con la columna, las filas viejas quedan en NULL = «subido en El Archivero».
-- Sin datos que migrar: lo de antes no tiene cómo saberse.
-- =============================================================================

alter table public.archivero_files add column if not exists origen text;

alter table public.archivero_files drop constraint if exists archivero_files_origen_check;
alter table public.archivero_files add constraint archivero_files_origen_check
  check (origen is null or origen in ('archivero', 'link', 'offer', 'onboarding'));

comment on column public.archivero_files.origen is
  'De dónde vino el documento: archivero (subido acá), link (una página), offer (el chat de Offer), onboarding (Lo que vendes). NULL = de antes del 17/10/2026.';
