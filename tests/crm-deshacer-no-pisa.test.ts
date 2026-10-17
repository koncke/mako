// =============================================================================
// El «Deshacer» del historial y el de «Información principal» no pisan lo que cambió otra persona (17/10/2026)
// =============================================================================
// Hasta el 17/10/2026 deshacer una línea del historial (`revertMoveAction`, `revertAuditChangeAction`) y el
// «Deshacer» del toast de «Información principal» (la ficha de Customer Success) escribían el valor de antes
// A CIEGAS: si otra persona, MaKo o el plan de pagos había cambiado ese dato después, se lo pisaban sin
// avisar (docs/relevo/crm.md §0-Ω10). Ahora se deshace sólo si el dato sigue diciendo lo que se escribió.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { camposPisados } from '../lib/historial-pisado';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const entre = (s: string, desde: string, hasta: string) => {
  const i = s.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = s.indexOf(hasta, i + desde.length);
  return s.slice(i, j < 0 ? undefined : j);
};

// Verificado rompiéndolo (el archivo da 4 / 0):
// · `camposPisados` devolviendo siempre [] → 3 / 1 (éste);
// · sin el salteo de la Etapa → 3 / 1 (éste);
// · con `hoy === undefined` contado como pisado → 3 / 1 (éste).
test('camposPisados: sólo los datos que HOY dicen otra cosa que la línea; la etapa y lo que no es columna, no', () => {
  const hoy: Record<string, string | null> = { 'Monto de cierre': '4800', Email: 'otra@x.com', Empresa: null };
  const valorHoy = (c: string) => (c in hoy ? hoy[c] : undefined);
  const filas = [
    { campo: 'Monto de cierre', valor_nuevo: '4800' },      // sigue igual: se puede deshacer
    { campo: 'Email', valor_nuevo: 'ana@x.com' },           // otra persona lo cambió
    { campo: 'Empresa', valor_nuevo: null },                // vacío y vacío: igual
    { campo: 'Etapa', valor_nuevo: 'facturando' },          // derivada: la cuida la regla del último estado
    { campo: 'Links de Fathom', valor_nuevo: '2 link(s)' }, // no es comparable acá
    { campo: 'Email', valor_nuevo: 'ana@x.com' },           // repetida: una vez
  ];
  assert.deepEqual(camposPisados(filas, valorHoy), ['Email']);
  assert.deepEqual(camposPisados([{ campo: 'Empresa', valor_nuevo: 'Celis' }], valorHoy), ['Empresa'], 'borrado después también es «lo cambiaron»');
  assert.deepEqual(camposPisados([{ campo: 'Etapa', valor_nuevo: 'x' }], () => 'y'), []);
});

// Verificado rompiéndolo: sin el `if (pisados.length) return` en revertMoveAction → 3 / 1 (éste); sin el
// chequeo en revertAuditChangeAction → 3 / 1 (éste).
test('CABLEADO: las dos puertas del historial preguntan ANTES de escribir, y el «no» vuelve como dato', () => {
  const acc = leer('app/crm/actions.ts');
  const grupo = entre(acc, 'export async function revertMoveAction(', 'alinearEtapaVista(');
  const iChequeo = grupo.indexOf('const pisados = camposPisados(grupo, (c) => valorDelHistorial(actual, c));');
  assert.ok(iChequeo > 0, 'revertMoveAction no pregunta si otra persona cambió el dato');
  assert.match(grupo, /if \(pisados\.length\) return \{ error: `\$\{YA_LO_CAMBIARON\}: \$\{pisados\.join\(', '\)\}` \};/);
  assert.ok(grupo.indexOf('await updateLead(') > iChequeo, 'el chequeo va antes de la primera escritura');
  const uno = entre(acc, 'export async function revertAuditChangeAction(', 'export async function revertMoveAction(');
  const iUno = uno.indexOf('camposPisados([row], (c) => valorDelHistorial(before, c))');
  assert.ok(iUno > 0 && iUno < uno.indexOf('switch (row.campo)'), 'revertAuditChangeAction escribe sin preguntar');
  const ui = leer('app/crm/lead-view/AuditHistory.tsx');
  assert.match(ui, /if \(r && 'error' in r\) \{ setRevertErr\(r\.error\); return; \}/, 'la pantalla no muestra el «no»');
});

// Verificado rompiéndolo: el deshacer del toast con `saveLeadMetaAction(leadId, { [campo]: antes })` de vuelta → 3 / 1.
test('«Información principal»: el deshacer del toast pasa por deshacerContactoLeadAction (también el nombre)', () => {
  const card = leer('app/crm/lead-view/InfoPrincipalCard.tsx');
  const guardar = entre(card, 'const guardar = (', 'const iconLink');
  assert.match(guardar, /await deshacerContactoLeadAction\(leadId, campo, previo, nuevo \|\| null\)/);
  assert.doesNotMatch(guardar, /saveLeadMetaAction\(leadId, \{ \[campo\]: antes \}\)/, 'volvió el deshacer a ciegas');
  const inline = leer('app/crm/campo-inline.ts');
  assert.match(inline, /export const esCampoDeshacible = \(c: unknown\): c is CampoDeshacible => c === 'nombre' \|\| esCampoContacto\(c\);/);
  const acc = leer('app/crm/actions.ts');
  assert.match(entre(acc, 'export async function deshacerContactoLeadAction(', 'export type MiembroEquipo'), /if \(!esCampoDeshacible\(campo\)\)/);
});

test('la etapa no se compara (cambia sola con las fechas) y lo dice la constante que usa el módulo', () => {
  const m = leer('lib/historial-pisado.ts');
  assert.match(m, /export const CAMPO_ETAPA_HISTORIAL = 'Etapa';/);
});
