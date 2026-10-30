// =============================================================================
// copywriter/contexto — lo que MaKo sabe del negocio al escribir un guion (se mudó a lib/negocio-para-crear.ts, 29/10/2026)
// =============================================================================
// El encargo (28/10/2026): «El contexto del negocio (oferta, avatar, ángulos, funciones de MaKo) sale del Second Brain
// con `grafoParaChat`, sólo los nodos que hacen falta». Desde el 29/10/2026 lo leen las cinco tabs de Create
// (docs/plantillas-reales/README.md, tanda 0), así que vive en lib/negocio-para-crear.ts y ya lee `grafoParaChat`.
// Esto queda para los imports del Copywriter (./ia.ts, ./referencias.ts): lo nuevo importa de allá.
// =============================================================================

import 'server-only';

export { contextoDelNegocio, LO_QUE_PIDE_UNA_PIEZA as LO_QUE_PIDE_UN_GUION, PRESUPUESTO_NEGOCIO } from '../negocio-para-crear';
