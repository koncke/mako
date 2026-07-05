-- =============================================================================
-- 0069 — "Solucionar en una sola pasada": omisiones + motivo agenda externa
-- =============================================================================
-- El wizard "Solucionar" ahora resuelve TODOS los datos sin marcar en una pasada.
-- Para los que se pueden OMITIR conscientemente (documento fiscal del cliente,
-- comprobante de pago) se persiste la omisión así el aviso rojo no vuelve a
-- pedirlos. Para las Respuestas de Calendly (R2) que NO se pueden cargar a mano:
-- si la reunión no estaba en Calendly, se registra POR QUÉ se agendó fuera y eso
-- satisface el requisito. Declarado UNA vez (igual que sin_r1/sin_r2/fathom).

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS deal_fiscal_doc_omitido boolean,
  ADD COLUMN IF NOT EXISTS comprobante_omitido boolean,
  ADD COLUMN IF NOT EXISTS r2_agenda_externa_motivo text;

COMMENT ON COLUMN leads.deal_fiscal_doc_omitido IS 'Omisión declarada: no se sube el documento fiscal del cliente (no se vuelve a exigir).';
COMMENT ON COLUMN leads.comprobante_omitido IS 'Omisión declarada: no se suben los comprobantes de pago (no se vuelven a exigir).';
COMMENT ON COLUMN leads.r2_agenda_externa_motivo IS 'La R2 se agendó fuera de Calendly: motivo. Satisface el requisito de Respuestas de Calendly (R2).';
