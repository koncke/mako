// Tests de los formatters de pantalla (lib/format.ts). Puros (Intl). Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtUSD, fmtNum } from '../lib/format';

test('fmtUSD — USD entero, redondea, guion si no es número finito', () => {
  assert.equal(fmtUSD(1000), '$1,000');
  assert.equal(fmtUSD(1234.7), '$1,235'); // maximumFractionDigits: 0 → redondea
  assert.equal(fmtUSD(0), '$0');
  assert.equal(fmtUSD(null), '—');
  assert.equal(fmtUSD(undefined), '—');
  assert.equal(fmtUSD(NaN), '—');
  assert.equal(fmtUSD(Infinity), '—');
});

test('fmtNum — entero con separador de miles, redondea, guion si no es finito', () => {
  assert.equal(fmtNum(1234.6), '1,235'); // Math.round → 1235
  assert.equal(fmtNum(0), '0');
  assert.equal(fmtNum(null), '—');
  assert.equal(fmtNum(NaN), '—');
});
