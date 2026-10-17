// Los selectores de cuenta, modelo y esfuerzo al lado de la caja del Ops Center (app/admin/operaciones/PiezasCentro.tsx)
// llevaban la clase `co-elegir`, que en centro.css también es la GRILLA del elegidor de muñecos (ElegirMuneco.tsx):
// `display: grid; min-height: 360px`. Gana la regla de abajo, así que cada <select> se dibujaba como una caja de 360 px.
// Martín lo vio en producción el 17/10/2026 («mira cómo se bugea eso»). La clase de los selectores es `co-envio-sel`.
//
// Probado rompiéndolo (17/10/2026): con `co-chip co-elegir` de nuevo en PiezasCentro, el test 1 da rojo (1/1); sin la
// regla `.co-envio-sel {` en centro.css, el test 2 da rojo (1/1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

test('los selectores de envío no usan la clase de la grilla del muñeco', () => {
  const piezas = leer('app/admin/operaciones/PiezasCentro.tsx');
  const selects = piezas.match(/<select className="[^"]*"/g) ?? [];
  assert.ok(selects.length >= 3, `se esperaban los tres selectores, hay ${selects.length}`);
  for (const s of selects) assert.doesNotMatch(s, /\bco-elegir\b/, `${s}: co-elegir es la grilla del elegidor de muñecos`);
});

test('la clase de los selectores de envío tiene su regla propia', () => {
  const css = leer('app/admin/operaciones/centro.css');
  assert.match(css, /^\.co-envio-sel \{/m);
  assert.equal((css.match(/^\.co-envio-sel \{/gm) ?? []).length, 1, 'una sola regla para los selectores');
});
