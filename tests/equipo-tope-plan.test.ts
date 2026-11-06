// =============================================================================
// El tope de usuarios del plan al invitar al equipo (23/10/2026)
// =============================================================================
// Los planes de MaKo: Esencial 1 usuario, Pro 5 (lib/topes-plan.ts → 'equipo.usuarios'). El Cerebro: hacerlo cumplir al
// invitar, con un cartel corto y «Pasar a Pro», SÓLO a quien MaKo le cobra por la pasarela (nunca al ws1 ni a un acuerdo a
// mano), y sin que nadie del equipo pierda el acceso.
//   1. la regla (lib/tope-equipo-reglas.ts): Esencial con su dueño ya está lleno; Pro, con 5; sin cobro de MaKo, sin tope;
//   2. la ruta lo mira SÓLO al invitar, antes de crear la cuenta, y si no puede leer el cobro no frena a nadie;
//   3. el cartel en la computadora y en el teléfono, con «Pasar a Pro» (en el teléfono, aparte del error para Soporte).
//
// Correr: node --import tsx --test tests/equipo-tope-plan.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HREF_PASAR_A_PRO, topeAlInvitar } from '../lib/tope-equipo-reglas';
import { RUTA_CAMBIAR_PLAN, textoTope } from '../lib/topes-plan';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la regla: Esencial con su dueño ya está lleno; Pro, con 5; sin cobro de MaKo, sin tope', () => {
  assert.deepEqual(topeAlInvitar({ cobraMako: true, capa: 'completo', miembros: 1 }), { ok: false, tope: 1, error: textoTope(1), pasarAPro: HREF_PASAR_A_PRO });
  assert.deepEqual(topeAlInvitar({ cobraMako: true, capa: 'completo', miembros: 0 }), { ok: true });
  assert.deepEqual(topeAlInvitar({ cobraMako: true, capa: 'agencia', miembros: 4 }), { ok: true }, 'Pro: el quinto entra');
  assert.equal(topeAlInvitar({ cobraMako: true, capa: 'agencia', miembros: 5 }).ok, false, 'Pro: el sexto no');
  // Ni el ws1 ni un acuerdo a mano (también capa `completo`): sin cobro de MaKo por la pasarela, sin tope.
  assert.deepEqual(topeAlInvitar({ cobraMako: false, capa: 'completo', miembros: 9 }), { ok: true });
  assert.deepEqual(topeAlInvitar({ cobraMako: true, capa: null, miembros: 9 }), { ok: true }, 'sin capa, sin tope');
  assert.deepEqual(topeAlInvitar({ cobraMako: true, capa: 'superadmin', miembros: 9 }), { ok: true }, 'una capa que no es un plan');
  assert.equal(HREF_PASAR_A_PRO, RUTA_CAMBIAR_PLAN, 'la ruta de Planes (lib/topes-plan.ts), nunca una propia');
  assert.doesNotMatch(sinComentarios(leer('lib/tope-equipo-reglas.ts')), /'\/configuraciones\/plan'/, 'la ruta escrita a mano');
});

test('2. la ruta lo mira SÓLO al invitar, antes de crear la cuenta, y sin poder leer el cobro no frena', () => {
  const r = sinComentarios(leer('app/api/equipo/route.ts'));
  const invitar = r.slice(r.indexOf("case 'invitar': {"), r.indexOf("case 'rolws': {"));
  assert.match(invitar, /const tope = topeAlInvitar\(\{ cobraMako: await cobraMako\(ws\), capa: \(await getWorkspace\(ws\)\)\?\.capa, miembros: equipo\.length \}\);\n\s*if \(!tope\.ok\) return NextResponse\.json\(\{ ok: false, error: tope\.error, tope: tope\.tope, pasarAPro: tope\.pasarAPro \}, \{ status: 403 \}\);/);
  assert.ok(invitar.indexOf('topeAlInvitar(') < invitar.indexOf('crearUsuario('), 'antes de crear la cuenta');
  assert.equal((r.match(/topeAlInvitar\(/g) ?? []).length, 1, 'sólo al invitar: a los que ya están no se los toca (rol, estado, reenviar)');
  assert.match(r, /try \{ return await aplicanTopes\(ws\); \} catch \(e\) \{[^}]*return false; \}/, 'si no se puede leer, no frena');
});

test('3. el cartel con «Pasar a Pro» en la computadora; en el teléfono dice que llegó, sin venderlo (T5)', () => {
  const pc = sinComentarios(leer('app/equipo/EquipoView.tsx'));
  assert.match(pc, /setErrCrear\(j\.error \?\? 'No se pudo invitar\.'\); setAPro\(j\.pasarAPro \?\? null\);/);
  // Envuelto en `CtaPasarAPro` (6/11/2026, #494): al cliente de una agencia, el cambio de plan se lo pide a ella.
  assert.match(pc, /\{errCrear\}\{aPro && <> <CtaPasarAPro><Link href=\{aPro\}[^>]*>Pasar a Pro<\/Link><\/CtaPasarAPro><\/>\}/);
  const m = sinComentarios(leer('app/m/configuraciones/equipo/EquipoM.tsx'));
  assert.match(m, /if \(!j\.ok && j\.pasarAPro\) \{ haptico\('error'\); setTope\(true\); return; \}/);
  assert.match(m, /\{tope && <p className="m-configuraciones-aviso" data-tono="warn" role="status">Llegaste al tope de tu plan\.<\/p>\}/, 'aparte del error para Soporte: no es un error');
  assert.doesNotMatch(m, /Pasar a Pro/, 'el teléfono no vende');
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 3/0):
//   · el tope también sin cobro de MaKo (el ws1)        → 2/1 (1)
//   · cuenta uno de menos                              → 2/1 (1)
//   · sin poder leer el cobro, frena                   → 2/1 (2)
//   · el tope después de crear la cuenta               → 2/1 (2)
//   · el cartel del teléfono con «Pasar a Pro» (3/11/2026) → 2/1 (3)
//   · la ruta escrita a mano, no la de Planes          → 2/1 (1)
