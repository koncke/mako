// Las fichas de los referentes: una por curso, destiladas de sus transcripciones (public/cono-tx/). Cada una dice de qué curso sale.
// Sólo el servidor: pesan, y el navegador no las usa.

import { FICHA_HORMOZI } from './ficha-hormozi';
import { FICHA_JUAN_ADS } from './ficha-juan-ads';
import { FICHA_JULIAN_OTALORA } from './ficha-julian-otalora';
import { FICHA_MARCOS_RAZZETTI } from './ficha-marcos-razzetti';
import { FICHA_SOFIA_CONTRERAS } from './ficha-sofia-contreras';
import { FICHA_VICTOR_HERAS } from './ficha-victor-heras';
import { FICHA_AGUSTIN_NIEVAS } from './ficha-agustin-nievas';
import { FICHA_DAVID_TURU } from './ficha-david-turu';
import { FICHA_DEREK_CHAMIZO } from './ficha-derek-chamizo';
import { FICHA_GUILLE_COLLADO } from './ficha-guille-collado';
import { FICHA_IMAN_GADZHI } from './ficha-iman-gadzhi';
import { FICHA_MARC_VERDU } from './ficha-marc-verdu';
import { FICHA_RAMIRO_CUBRIA } from './ficha-ramiro-cubria';
import { FICHA_XIMENA_FUKUDA } from './ficha-ximena-fukuda';
// Segunda tanda (1/11/2026): otros seis cursos de Knowledge que sirven a un negocio de ticket alto.
import { FICHA_FELIPE_VERGARA } from './ficha-felipe-vergara';
import { FICHA_JAIME_HIGUERA } from './ficha-jaime-higuera';
import { FICHA_ADRIA_SOLA } from './ficha-adria-sola';
import { FICHA_AUGUSTO_BIANCHI } from './ficha-augusto-bianchi';
import { FICHA_TINO_MOSSU } from './ficha-tino-mossu';
import { FICHA_EMILIO_PUIGRREDON } from './ficha-emilio-puigrredon';
import { FICHA_JULIAN_ALBORNA } from './ficha-julian-alborna';
import { FICHA_JORDI_SEGUES } from './ficha-jordi-segues';
import type { IdAsesor } from './catalogo';

export const FICHAS: Readonly<Record<IdAsesor, string>> = {
  hormozi: FICHA_HORMOZI,
  'juan-ads': FICHA_JUAN_ADS,
  'julian-otalora': FICHA_JULIAN_OTALORA,
  'sofia-contreras': FICHA_SOFIA_CONTRERAS,
  'marcos-razzetti': FICHA_MARCOS_RAZZETTI,
  'victor-heras': FICHA_VICTOR_HERAS,
  'agustin-nievas': FICHA_AGUSTIN_NIEVAS,
  'derek-chamizo': FICHA_DEREK_CHAMIZO,
  'david-turu': FICHA_DAVID_TURU,
  'ximena-fukuda': FICHA_XIMENA_FUKUDA,
  'guille-collado': FICHA_GUILLE_COLLADO,
  'marc-verdu': FICHA_MARC_VERDU,
  'ramiro-cubria': FICHA_RAMIRO_CUBRIA,
  'iman-gadzhi': FICHA_IMAN_GADZHI,
  'felipe-vergara': FICHA_FELIPE_VERGARA,
  'jaime-higuera': FICHA_JAIME_HIGUERA,
  'adria-sola': FICHA_ADRIA_SOLA,
  'augusto-bianchi': FICHA_AUGUSTO_BIANCHI,
  'tino-mossu': FICHA_TINO_MOSSU,
  'emilio-puigrredon': FICHA_EMILIO_PUIGRREDON,
  'julian-alborna': FICHA_JULIAN_ALBORNA,
  'jordi-segues': FICHA_JORDI_SEGUES,
};
