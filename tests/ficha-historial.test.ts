// =============================================================================
// La ficha de un CRM guarda QUIÉN la cambió, QUÉ, y cómo estaba: y se puede volver (17/10/2026)
// =============================================================================
// docs/relevo/crm-tanda-b1.md (b1): «La ficha no tiene historial... cambiarFichaFunnelAction sólo deja un console.info
// con el autor». Ahora cada cambio deja una línea en `data.fichaHistorial` (lib/ficha/historial.ts), en la MISMA
// escritura compare-and-set que la ficha, y «Volver a como estaba» la restaura (es un cambio más, con su línea).
//
// Verificado rompiéndolo (el archivo da 3 / 0): `conEntrada` agregando al final en vez de arriba → 2 / 1; sin los dos
// topes (el `.slice` y el `break`) → 2 / 1 (los dos, el 1); `cambiarFichaDeFunnel` sin escribir `fichaHistorial` → 2 / 1 (el 2); `volverFichaAction`
// sin el corte de admin → 2 / 1 (el 3).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conEntrada, sanearHistorial, TOPE_HISTORIAL_FICHA } from '../lib/ficha/historial';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const e = (n: number) => ({ at: new Date(Date.UTC(2026, 9, 17, 10, n)).toISOString(), autor: `a${n}@x.test`, que: `cambio ${n}`, antes: {} });

test('el historial: la más nueva arriba, con tope, y lo ilegible se descarta', () => {
  let h: unknown = undefined;
  for (let i = 0; i < TOPE_HISTORIAL_FICHA + 5; i++) h = conEntrada(h, e(i));
  const lista = sanearHistorial(h);
  assert.equal(lista.length, TOPE_HISTORIAL_FICHA, 'sin tope, el data del funnel crece para siempre');
  assert.equal(lista[0].que, `cambio ${TOPE_HISTORIAL_FICHA + 4}`, 'la más nueva va arriba');
  assert.deepEqual(sanearHistorial([{ at: 'ayer', autor: 'x', que: 'y', antes: {} }, 'basura', null]), [], 'una fecha que no es fecha no entra');
  assert.equal(sanearHistorial([{ at: e(1).at, antes: {} }])[0].autor, 'Alguien');
});

test('el cableado: la línea va en la MISMA escritura que la ficha, con el autor de cada puerta', () => {
  const srv = leer('lib/ficha/config-server.ts');
  const cambiar = srv.slice(srv.indexOf('export async function cambiarFichaDeFunnel('));
  const iHist = cambiar.indexOf('nueva.fichaHistorial = conEntrada(data.fichaHistorial, { at: ahora, autor:');
  const iUpdate = cambiar.indexOf(".update({ data: nueva, updated_at: ahora })");
  assert.ok(iHist > 0 && iUpdate > iHist, 'el historial no viaja en el update compare-and-set de la ficha');
  assert.match(leer('app/crm/ficha-actions.ts'), /await cambiarFichaDeFunnel\(funnelId, c, \{ autor: quien \}\)/);
  assert.equal((leer('lib/api-mako/areas/crm.run.ts').match(/cambiarFichaDeFunnel\(Number\(payload\.embudoId\), c, \{ autor: 'MaKo' \}\)/g) ?? []).length, 2);
});

test('volver a como estaba: sólo el admin, por el mismo camino (`restaurar`), y la pantalla lo ofrece en el «⋯»', () => {
  const acc = leer('app/crm/ficha-actions.ts');
  const volver = acc.slice(acc.indexOf('export async function volverFichaAction('));
  assert.match(volver, /if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\) return \{ ok: false/);
  assert.match(volver, /cambiarFichaDeFunnel\(h\.funnelId, \{ op: 'restaurar', ficha: e\.antes \}, \{ autor: quien \}\)/);
  // El «⋯» abre el menú de la ficha desde el 24/10/2026: «Historial de la ficha» es su `case 'historial'`.
  assert.match(leer('app/crm/lead-view/ficha/FichaPorBloques.tsx'), /case 'historial': setHistorial\(true\); return;/);
});
