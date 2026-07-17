// =============================================================================
// test-cripto — el cifrado de credenciales, probado suelto
// =============================================================================
//   node --experimental-strip-types scripts/test-cripto.mjs
//
// No toca la base ni necesita la app. Fija lo que tiene que seguir siendo cierto:
//   · v2 va y vuelve.
//   · el AAD ata: un criptograma movido a otra fila o a otro workspace NO abre.
//   · el formato viejo (gcm1) ya NO se acepta — no hay downgrade posible.
//   · sin secreto no se escribe nada a ciegas.

import { strict as assert } from 'node:assert';
import crypto from 'node:crypto';

process.env.CREDENCIALES_SECRET = 'ZmFrZS1zZWNyZXRvLXBhcmEtZWwtdGVzdC0zMmI';

const M = await import('../lib/cripto-credenciales.ts');

let n = 0;
const ok = (t) => { n++; console.log(`  ✓ ${t}`); };

// ── v2 ──────────────────────────────────────────────────────────────────────
{
  const c = M.cifrar('sk-ant-secreto', 7, 'ANTHROPIC_API_KEY');
  assert.equal(M.versionCripto(c), 'gcm2');
  ok('cifra en v2');

  assert.equal(M.descifrar(c, 7, 'ANTHROPIC_API_KEY'), 'sk-ant-secreto');
  ok('v2 va y vuelve');

  // EL PUNTO DE TODO: el criptograma está atado a SU fila.
  assert.equal(M.descifrar(c, 8, 'ANTHROPIC_API_KEY'), null);
  ok('NO abre en otro workspace (AAD)');
  assert.equal(M.descifrar(c, 7, 'OPENAI_API_KEY'), null);
  ok('NO abre bajo otra clave (AAD)');

  // Sal por fila: mismo valor, misma fila, criptogramas distintos.
  const c2 = M.cifrar('sk-ant-secreto', 7, 'ANTHROPIC_API_KEY');
  assert.notEqual(c, c2);
  assert.equal(M.descifrar(c2, 7, 'ANTHROPIC_API_KEY'), 'sk-ant-secreto');
  ok('dos cifrados del mismo valor dan criptogramas distintos');

  const partes = c.split('.');
  partes[4] = Buffer.from('otra-cosa').toString('base64url');
  assert.equal(M.descifrar(partes.join('.'), 7, 'ANTHROPIC_API_KEY'), null);
  ok('manipulado no abre (authTag)');
}

// ── el formato viejo NO entra ───────────────────────────────────────────────
{
  // Forjamos un gcm1 como lo haría un atacante que conoce la clave vieja
  // (AUTH_COOKIE_VALUE viajaba al browser en el login compartido).
  const key = crypto.createHash('sha256').update('la-vieja-cookie-compartida').digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update('token-del-atacante', 'utf8'), cipher.final()]);
  const forjado = `gcm1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;

  assert.equal(M.versionCripto(forjado), 'gcm1');
  assert.equal(M.descifrar(forjado, 7, 'ANTHROPIC_API_KEY'), null);
  ok('un gcm1 forjado NO entra: sin rama v1 no hay downgrade');
}

// ── sin secreto no se escribe a ciegas ──────────────────────────────────────
{
  const guardado = process.env.CREDENCIALES_SECRET;
  delete process.env.CREDENCIALES_SECRET;
  assert.throws(() => M.cifrar('x', 1, 'K'), /CREDENCIALES_SECRET/);
  ok('sin CREDENCIALES_SECRET explota en vez de guardar algo ilegible');
  assert.equal(M.descifrar('gcm2.a.b.c.d', 1, 'K'), null);
  ok('sin secreto, descifrar devuelve null (no explota)');
  process.env.CREDENCIALES_SECRET = guardado;
}

// ── basura ──────────────────────────────────────────────────────────────────
{
  assert.equal(M.versionCripto('texto-plano-viejo'), 'otro');
  assert.equal(M.descifrar('cualquier-cosa', 1, 'K'), null);
  assert.equal(M.descifrar('gcm2.mal', 1, 'K'), null);
  ok('la basura devuelve null, no explota');
}

console.log(`\n${n}/${n} OK`);
