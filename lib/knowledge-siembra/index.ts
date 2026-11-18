// =============================================================================
// knowledge-siembra — TODAS las fichas de Knowledge, en el orden de los módulos (18/11/2026)
// =============================================================================
// Una lista por módulo de lib/knowledge-modulos.ts, más las plantillas de guion (el pedido 3.2 del 30/10: «guiones al
// estilo de…»), que viven en el módulo `organico` porque las consume el Copywriting. La siembra y su test leen ESTO, no los
// archivos sueltos: un módulo que se agrega acá sin su archivo no compila, y uno con archivo y sin entrada acá lo frena el
// test (cada módulo de MODULOS_KNOWLEDGE tiene que tener fichas).
// =============================================================================

import { MODULOS_KNOWLEDGE } from '../knowledge-modulos';
import { FICHAS_ANUNCIOS } from './anuncios';
import { FICHAS_VENTA } from './venta';
import { FICHAS_ORGANICO } from './organico';
import { PLANTILLAS_GUION } from './plantillas-guion';
import { FICHAS_OFERTA } from './oferta';
import { FICHAS_PAGINAS } from './paginas';
import { FICHAS_PIEZAS } from './piezas';
import { FICHAS_APP } from './app';
import type { FichaKnowledge } from './tipos';

export * from './tipos';

/** Las fichas de cada módulo, por su `key`. El orden adentro de cada lista es el que se carga (las tres primeras son las bases). */
export const FICHAS_POR_MODULO: Readonly<Record<string, readonly FichaKnowledge[]>> = {
  anuncios: FICHAS_ANUNCIOS,
  venta: FICHAS_VENTA,
  organico: [...FICHAS_ORGANICO, ...PLANTILLAS_GUION],
  oferta: FICHAS_OFERTA,
  paginas: FICHAS_PAGINAS,
  piezas: FICHAS_PIEZAS,
  app: FICHAS_APP,
};

/** Todas, en el orden de MODULOS_KNOWLEDGE. */
export const TODAS_LAS_FICHAS: readonly FichaKnowledge[] = MODULOS_KNOWLEDGE.flatMap((m) => FICHAS_POR_MODULO[m.key] ?? []);
