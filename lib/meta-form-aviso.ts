// =============================================================================
// meta-form-aviso — los DATOS del aviso «completó tu formulario de Meta» (puro, con test)
// =============================================================================
// «Nada por detrás», lote 3 (docs/inventario-nada-por-detras.md, 17/10/2026): `lead-formulario-meta` salía del store de
// /mensajes (lo que el negocio editaba ahí, con el texto de fábrica del catálogo) y lo que faltaba se tapaba con frases
// del código («sin teléfono», «Sin preguntas extra en el formulario.»). Ahora es el evento de la plataforma
// `lead_formulario_meta` con el texto literal en su fila de SuperAdmin; del lead sale su nombre y el link a su ficha, y
// estos datos son lo que trae el formulario. ⚠️ Un dato que FALTA se lleva su renglón: nunca una frase de relleno.

import { resumenRespuestas, type MetaFieldData } from './meta-leads-campos';

export type DatosFormularioMeta = { meta_telefono?: string; meta_campana?: string; meta_respuestas?: string };

/** El teléfono, la campaña de la que vino y lo que contestó (una lista, cada respuesta en su renglón). */
export function datosFormularioMeta(p: { telefono?: string | null; campana?: string | null; fieldData?: MetaFieldData | null }): DatosFormularioMeta {
  const tel = (p.telefono ?? '').trim();
  const campana = (p.campana ?? '').trim();
  const respuestas = resumenRespuestas(p.fieldData ?? null);
  return {
    ...(tel ? { meta_telefono: tel } : {}),
    ...(campana ? { meta_campana: campana } : {}),
    ...(respuestas ? { meta_respuestas: `\n${respuestas}` } : {}),
  };
}
