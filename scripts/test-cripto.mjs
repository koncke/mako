// =============================================================================
// test-cripto — el cifrado de credenciales, probado suelto
// =============================================================================
//   node scripts/test-cripto.mjs
//
// No toca la base ni necesita la app. Prueba lo que tiene que ser cierto ANTES de
// migrar nada:
//   · v1 (lo que ya está escrito en prod) se sigue abriendo con la clave congelada.
//   · v2 va y vuelve.
//   · el AAD hace su trabajo: un criptograma movido a otra fila NO abre.
//   · el flag decide el formato, y sin secreto no se escribe v2 en silencio.
//   · el lector dual lee los dos sin saber cuál le toca.

import { strict as assert } from 'node:assert';

// Env de laboratorio: valores de juguete, ninguno real.
process.env.AUTH_COOKIE_VALUE = 'secreto-viejo-de-sesiones';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-juguete';
delete process.env.CREDENCIALES_SECRET;
delete process.env.CREDENCIALES_V2;

const M = await import('../lib/cripto-credenciales.ts');

let n = 0;
const ok = (t) => { n++; console.log(`  ✓ ${t}`); };

// ── v1: lo que ya existe ────────────────────────────────────────────────────
{
  const c = M.cifrarV1('token-viejo');
  assert.equal(M.versionCripto(c), 'gcm1');
  assert.equal(M.descifrar(c, 1, 'META_ACCESS_TOKEN'), 'token-viejo');
  ok('v1 va y vuelve');

  // v1 no tiene AAD: abre desde cualquier fila. Es la debilidad que v2 arregla —
  // lo fijamos como test para que quede claro qué estamos dejando atrás.
  assert.equal(M.descifrar(c, 99, 'OTRA_CLAVE'), 'token-viejo');
  ok('v1 abre desde cualquier fila (la debilidad que v2 cierra)');
}

// ── el escritor no cambia de formato solo ───────────────────────────────────
{
  assert.equal(M.escribeV2(), false);
  assert.equal(M.versionCripto(M.cifrar('x', 1, 'K')), 'gcm1');
  ok('sin flag ni secreto, se sigue escribiendo v1');

  process.env.CREDENCIALES_V2 = '1';
  assert.equal(M.escribeV2(), false, 'flag sin secreto NO debe escribir v2');
  assert.equal(M.versionCripto(M.cifrar('x', 1, 'K')), 'gcm1');
  ok('flag prendido pero sin secreto → sigue v1, no escribe v2 a ciegas');
  delete process.env.CREDENCIALES_V2;
}

// ── v2 ──────────────────────────────────────────────────────────────────────
{
  process.env.CREDENCIALES_SECRET = 'ZmFrZS1zZWNyZXRvLXBhcmEtZWwtdGVzdC0zMmI=';

  assert.equal(M.escribeV2(), false, 'secreto sin flag NO debe escribir v2');
  ok('secreto puesto pero flag apagado → todavía escribe v1 (paso 1 del plan)');

  process.env.CREDENCIALES_V2 = '1';
  assert.equal(M.escribeV2(), true);
  const c = M.cifrar('sk-ant-secreto', 7, 'ANTHROPIC_API_KEY');
  assert.equal(M.versionCripto(c), 'gcm2');
  ok('con flag + secreto, escribe v2');

  assert.equal(M.descifrar(c, 7, 'ANTHROPIC_API_KEY'), 'sk-ant-secreto');
  ok('v2 va y vuelve');

  // EL PUNTO DE TODO: el criptograma está atado a SU fila.
  assert.equal(M.descifrar(c, 8, 'ANTHROPIC_API_KEY'), null);
  ok('v2 NO abre en otro workspace (AAD)');
  assert.equal(M.descifrar(c, 7, 'OPENAI_API_KEY'), null);
  ok('v2 NO abre bajo otra clave (AAD)');

  // Sal por fila: mismo valor, misma fila, criptogramas distintos.
  const c2 = M.cifrar('sk-ant-secreto', 7, 'ANTHROPIC_API_KEY');
  assert.notEqual(c, c2);
  assert.equal(M.descifrar(c2, 7, 'ANTHROPIC_API_KEY'), 'sk-ant-secreto');
  ok('dos cifrados del mismo valor dan criptogramas distintos');

  // Manipulación → falla, no devuelve basura.
  const partes = c.split('.');
  partes[4] = Buffer.from('otra-cosa').toString('base64url');
  assert.equal(M.descifrar(partes.join('.'), 7, 'ANTHROPIC_API_KEY'), null);
  ok('v2 manipulado no abre (authTag)');
}

// ── lector dual: los dos formatos a la vez ──────────────────────────────────
{
  const viejo = M.cifrarV1('valor-viejo');
  const nuevo = M.cifrar('valor-nuevo', 3, 'RESEND_API_KEY');
  assert.equal(M.descifrar(viejo, 3, 'RESEND_API_KEY'), 'valor-viejo');
  assert.equal(M.descifrar(nuevo, 3, 'RESEND_API_KEY'), 'valor-nuevo');
  ok('el lector dual abre v1 y v2 en simultáneo');
}

// ── el secreto v2 NO se cae a la cadena vieja ───────────────────────────────
{
  // Con el secreto v2 puesto, v1 tiene que seguir usando el SUYO. Si mirara
  // CREDENCIALES_SECRET, todo lo que está en prod dejaría de abrir en silencio.
  const c = M.cifrarV1('escrito-antes-de-la-migracion');
  process.env.CREDENCIALES_SECRET = 'otro-secreto-completamente-distinto';
  assert.equal(M.descifrar(c, 1, 'K'), 'escrito-antes-de-la-migracion');
  ok('cambiar CREDENCIALES_SECRET no rompe lo escrito en v1');
}

// ── downgrade: la razón por la que v1 tiene que morir ───────────────────────
{
  process.env.CREDENCIALES_SECRET = 'ZmFrZS1zZWNyZXRvLXBhcmEtZWwtdGVzdC0zMmI=';
  process.env.CREDENCIALES_V2 = '1';
  delete process.env.CREDENCIALES_V1_OFF;

  // La fila ws=9/ANTHROPIC_API_KEY ya está migrada a v2.
  const legitimo = M.cifrar('token-real', 9, 'ANTHROPIC_API_KEY');
  assert.equal(M.versionCripto(legitimo), 'gcm2');

  // Un atacante que conoce la clave v1 (¡AUTH_COOKIE_VALUE viaja al browser en el
  // login compartido!) forja un gcm1 y lo planta en esa fila ya migrada.
  const forjado = M.cifrarV1('token-del-atacante');
  assert.equal(M.descifrar(forjado, 9, 'ANTHROPIC_API_KEY'), 'token-del-atacante');
  ok('con v1 vivo, un gcm1 forjado entra en una fila ya migrada (el AAD no ata nada)');

  // Con v1 apagado deja de entrar. RECIÉN ACÁ la promesa del AAD es cierta.
  process.env.CREDENCIALES_V1_OFF = '1';
  assert.equal(M.descifrar(forjado, 9, 'ANTHROPIC_API_KEY'), null);
  ok('con v1 apagado, el gcm1 forjado NO entra');
  assert.equal(M.descifrar(legitimo, 9, 'ANTHROPIC_API_KEY'), 'token-real');
  ok('con v1 apagado, lo legítimo en v2 sigue abriendo');

  // Fail-closed: si no se puede escribir v2, no se escribe v1 a escondidas.
  delete process.env.CREDENCIALES_V2;
  assert.throws(() => M.cifrar('x', 9, 'K'), /CREDENCIALES_V1_OFF/);
  ok('v1 apagado y sin poder escribir v2 → explota en vez de guardar algo ilegible');

  delete process.env.CREDENCIALES_V1_OFF;
  process.env.CREDENCIALES_V2 = '1';
}

// ── basura ──────────────────────────────────────────────────────────────────
{
  assert.equal(M.versionCripto('texto-plano-viejo'), 'otro');
  assert.equal(M.descifrar('cualquier-cosa', 1, 'K'), null);
  assert.equal(M.descifrar('gcm2.mal', 1, 'K'), null);
  assert.equal(M.descifrar('gcm1.a.b', 1, 'K'), null);
  ok('la basura devuelve null, no explota');
}

console.log(`\n${n}/${n} OK`);
