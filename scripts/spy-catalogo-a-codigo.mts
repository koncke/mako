// Escribe lib/spy-catalogo-datos.ts desde la tabla del catálogo (docs/catalogo-funnels-y-formatos.md, §4).
// Correr: node --import tsx scripts/spy-catalogo-a-codigo.mts
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { leerCatalogo } from '../lib/spy-catalogo-leer';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const { funnels, formatos } = leerCatalogo(readFileSync(`${raiz}docs/catalogo-funnels-y-formatos.md`, 'utf8'));
if (!funnels.length || !formatos.length) throw new Error('No encontré la tabla del catálogo (§4.1 y §4.2).');
const salida = `// =============================================================================
// spy-catalogo-datos — GENERADO desde docs/catalogo-funnels-y-formatos.md (§4). No se edita a mano.
// =============================================================================
// Se regenera con \`node --import tsx scripts/spy-catalogo-a-codigo.mts\`; tests/spy-funnel-tipo.test.ts falla si el catálogo
// y este archivo dicen cosas distintas. La investigación (definiciones y fuentes) vive en el documento.
// =============================================================================

import type { EntradaCatalogo } from './spy-catalogo-leer';

export const FUNNELS_DEL_CATALOGO: readonly EntradaCatalogo[] = ${JSON.stringify(funnels, null, 2)};

export const FORMATOS_DEL_CATALOGO: readonly EntradaCatalogo[] = ${JSON.stringify(formatos, null, 2)};
`;
writeFileSync(`${raiz}lib/spy-catalogo-datos.ts`, salida.replace(/\r\n/g, '\n'));
console.log(`${funnels.length} funnels y ${formatos.length} formatos.`);
