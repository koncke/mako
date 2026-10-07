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
// Son asserts sobre el FUENTE: las rutas no se pueden importar en node:test.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (AGENTS.md).
const codigo = (p: string) => leer(p).replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const CREATE = codigo('app/api/ads-manager/campaign-create/route.ts');
const AD_ADD = codigo('app/api/ads-manager/ad-add/route.ts');
const ADSET_ADD = codigo('app/api/ads-manager/adset-add/route.ts');
const LIB = codigo('lib/meta-ads-create.ts');

/** Los `persist({ status: '…' … })` de un tramo: los TERMINALES. */
const terminales = (src: string) => [...src.matchAll(/await persist\(\{ status: '(publicada|error)'[^\n]*\}\);/g)].map((m) => m[0]);

test('campaign-create: el terminal de éxito reescribe la campaña, y el rollback sólo cuenta si Meta lo confirma', () => {
  const [exito] = terminales(CREATE).filter((t) => t.includes("'publicada'"));
  assert.ok(exito, 'sin el persist de éxito');
  assert.match(exito, /meta_campaign_id: campaignId/, 'una fila publicada sin campaña devolvía campaign_id: null');
  assert.match(CREATE, /rolledBack = await deleteEntity\(campaignId\);/, '«(revertido)» sale de lo que Meta contestó');
  // deleteEntity lee la respuesta: `{ success: true }` o no hay borrado.
  const borrar = LIB.slice(LIB.indexOf('export async function deleteEntity('), LIB.indexOf('export async function getAdsetTargeting('));
  assert.match(borrar, /Promise<boolean>/);
  assert.match(borrar, /return r\.ok && j\?\.success === true;/);
  //   ROTO A PROPÓSITO (07/10/2026): sin `meta_campaign_id: campaignId` en el terminal,
  //   pass 5 / fail 1 — éste.
});

test('ad-add, lote: los DOS terminales reescriben los ids que hay en memoria', () => {
  const lote = AD_ADD.slice(AD_ADD.indexOf('const ads = body.ads;'));
  const ts = terminales(lote);
  assert.equal(ts.length, 2, 'éxito y error');
  for (const t of ts) assert.match(t, /meta_ad_ids: ad_ids, meta_creative_ids: creative_ids/, t);
  //   ROTO A PROPÓSITO (07/10/2026): sin los ids en el terminal de error, pass 5 / fail 1 —
  //   éste: un persist intermedio perdido dejaba «creados 2» sobre 4, y el reintento
  //   recortaba 2 y volvía a crear el 3 y el 4.
});

test('ad-add: el objetivo de la fila nunca cae al default de la tabla', () => {
  const inserts = [...AD_ADD.matchAll(/\.from\('meta_campaign_drafts'\)\.insert\(/g)];
  assert.equal(inserts.length, 2);
  for (const m of inserts) {
    const i = m.index ?? 0;
    assert.match(AD_ADD.slice(i, AD_ADD.indexOf('}).select(', i)), /objective: objetivoDelBody\(body\.campaign_objective\)/);
  }
  assert.match(AD_ADD, /const OBJETIVO_DESCONOCIDO = 'DESCONOCIDO';/);
  // Y el modal manda la campaña y su objetivo, que salen del árbol que la tabla ya tiene.
  const modal = codigo('app/ads-manager/AgregarAnuncioModal.tsx');
  assert.match(modal, /campaign_id: campaignId, campaign_objective: campaignObjective/);
  const tabla = codigo('app/ads-manager/CampanasBrowser.tsx');
  assert.match(tabla, /campaignId=\{addAnuncioAdset\.campaignId\} campaignObjective=\{addAnuncioAdset\.objective\}/);
  //   ROTO A PROPÓSITO (07/10/2026): con el insert del modo simple sin `objective`,
  //   pass 5 / fail 1 — éste.
});

test('adset-add: la campaña se lee ANTES de abrir el registro, y la fila nace con su objetivo', () => {
  const iBasics = ADSET_ADD.indexOf('basics = await getCampaignBasics(campaignId)');
  const iRegistro = ADSET_ADD.indexOf('abrirRegistro(');
  assert.ok(iBasics > 0 && iBasics < iRegistro, 'con la lectura después, la fila nacía afirmando Leads');
  const i = ADSET_ADD.indexOf(".from('meta_campaign_drafts').insert(");
  assert.match(ADSET_ADD.slice(i, ADSET_ADD.indexOf('}).select(', i)), /objective: basics\.objective/);
});

test('adset-add: lo creado vive en la ruta, los terminales lo reescriben, y un conjunto VACÍO se borra', () => {
  // El avance se guarda en memoria antes de anotarlo.
  assert.match(ADSET_ADD, /\(p\) => \{\n\s*creado = p;\n\s*return persist\(ids\(\)\);/);
  const ts = terminales(ADSET_ADD);
  assert.equal(ts.length, 2, 'éxito y error');
  for (const t of ts) assert.match(t, /\.\.\.ids\(\)/, t);
  // El borrado: sólo sin anuncios, y sólo cuenta si Meta lo confirma.
  const iCatch = ADSET_ADD.indexOf('} catch (err) {', ADSET_ADD.indexOf('addAdsetToCampaign('));
  const captura = ADSET_ADD.slice(iCatch);
  assert.match(captura, /if \(hecho && hecho\.ad_ids\.length === 0\) \{\n\s*revertido = await deleteEntity\(hecho\.adset_id\)/);
  assert.match(captura, /if \(revertido\) \{[\s\S]*?creado = null;/);
  //   ROTO A PROPÓSITO (07/10/2026): con `if (hecho && hecho.ad_ids.length >= 0)` (borrar
  //   también un conjunto CON anuncios), pass 5 / fail 1 — éste.
});

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
