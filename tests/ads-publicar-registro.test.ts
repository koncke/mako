// =============================================================================
// El registro de una publicación dice TODO lo que existe en Meta (revisión de la #59)
// =============================================================================
// La fila de meta_campaign_drafts es lo único que lee un reintento con la misma clave
// (lib/meta-idempotencia.ts). Si dice MENOS de lo que existe en Meta, el reintento crea
// de nuevo lo que ya estaba. Tres formas de que dijera menos, las tres medidas en la
// revisión del 07/10/2026:
//
// - Los persist intermedios tragan su error y los terminales no reescribían los ids que
//   ya estaban en memoria: un intermedio perdido dejaba la fila corta para siempre.
// - El rollback no leía la respuesta del DELETE: «(revertido)» sin que Meta lo confirmara.
// - adset-add no borraba un conjunto vacío, y la miniatura se exigía DESPUÉS de crearlo:
//   «vuelve a intentar» sobre una clave que contestaba «a medias» para siempre.
//
// Y el objetivo: la columna tiene default 'OUTCOME_LEADS', y dejarlo caer ahí afirmaba Leads.
//
// Son asserts sobre el FUENTE.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (AGENTS.md).
const codigo = (p: string) => leer(p).replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const LIB = codigo('lib/meta-ads-create.ts');

// ⚠️ 27/10/2026: los cuatro tests de las rutas (campaign-create, ad-add, adset-add) se fueron con ellas: eran del Ads Manager
// viejo y no las llamaba ninguna pantalla desde el 25/10 (docs/hallazgos-ads.md → «Las rutas viejas de app/api/ads-manager»).
// Queda lo que vive en la lib.

test('addAdsetToCampaign exige las miniaturas ANTES de crear el conjunto', () => {
  const cuerpo = LIB.slice(LIB.indexOf('export async function addAdsetToCampaign('), LIB.indexOf('export async function adoptarTranscripcionDelCreativo('));
  const iMini = cuerpo.indexOf('await conMiniaturaParaPublicar(ad.creative)');
  const iConjunto = cuerpo.indexOf('await createAdSet(');
  assert.ok(iMini > 0 && iConjunto > iMini, 'con la miniatura después, «vuelve a intentar» llegaba con el conjunto ya creado');
  // Y el bucle crea con los creativos YA resueltos.
  assert.match(cuerpo, /for \(const ad of ads\) \{/);
  //   ROTO A PROPÓSITO (07/10/2026): con el `for` de las miniaturas después de createAdSet,
  //   pass 5 / fail 1 — éste.
});
