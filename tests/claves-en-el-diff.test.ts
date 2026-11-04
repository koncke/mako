// La guarda de claves del push (01/11/2026, auditoría de seguridad): frena lo que tiene forma de clave REAL y deja pasar
// los datos de prueba con cara de inventados. Los valores de acá se arman por partes para que este mismo archivo no los
// tenga literales. Verificado rompiéndolo: con `pareceInventada` devolviendo siempre false, el caso 2 da hallazgos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hallazgosEnLinea, pareceInventada } from '../scripts/claves-en-el-diff.mjs';

// Azar de verdad (lo que tendría una clave): 40 caracteres de una base de 62, sin repeticiones largas.
const AZAR = 'Q7vK2pX9mL4tR8wZ3bN6cJ1dF5gH0sY' + 'eUaTiOoPqWr';

test('1. una clave con forma real se frena', () => {
  assert.deepEqual(hallazgosEnLinea(`const k = '${'sk-ant-' + 'api03-' + AZAR}';`), ['clave de Anthropic']);
  assert.deepEqual(hallazgosEnLinea(`OPENAI_API_KEY=${'sk-proj-' + AZAR}`), ['clave de OpenAI', 'asignación tipo .env']);
  assert.deepEqual(hallazgosEnLinea(`DATABASE_URL=${'postgresql://' + 'postgres:' + 'S3gr' + 'eta99@db.x.co/postgres'}`), ['URL de base con contraseña']);
  assert.deepEqual(hallazgosEnLinea(`${'-----BEGIN ' + 'PRIVATE KEY-----'}`), ['clave privada']);
  assert.deepEqual(hallazgosEnLinea(`  RESEND_API_KEY=${'re_' + 'Ab3dE6gH_' + AZAR}`).includes('clave de Resend'), true);
});

test('2. un dato de prueba con cara de inventado, no', () => {
  assert.deepEqual(hallazgosEnLinea(`const k = '${'sk-ant-' + 'api03-' + 'cuenta1-' + 'a'.repeat(40)}';`), []);
  assert.deepEqual(hallazgosEnLinea(`const k = '${'rk_live_' + 'CUENTA' + 'a'.repeat(30)}';`), []);
  assert.deepEqual(hallazgosEnLinea(`const k = '${'sk-proj-' + 'DE-LA-PRUEBA-' + 'x'.repeat(30)}';`), []);
  assert.deepEqual(hallazgosEnLinea(`const k = '${'sk-ant-' + AZAR}'; // claves-en-el-diff: ok`), [], 'la marca explícita deja pasar');
  assert.equal(pareceInventada('sk-ant-' + AZAR), false);
  assert.equal(pareceInventada('sk-ant-AAAAAAAAAAAAAAAAAAAAAAAAAAAA'), true);
});

test('3. la guarda corre en el push', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const sh = readFileSync(fileURLToPath(new URL('../scripts/guardas-push.sh', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
  assert.match(sh, /if ! node scripts\/claves-en-el-diff\.mjs; then/);
});
