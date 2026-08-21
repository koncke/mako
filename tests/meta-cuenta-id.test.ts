// =============================================================================
// La forma de META_AD_ACCOUNT_ID: verificar una cosa y guardar otra
// =============================================================================
// El 21/8/2026 un cliente recibió cuatro WhatsApps diciéndole que su cuenta
// publicitaria estaba caída y que no le entraba un solo lead. Su cuenta estaba
// ACTIVA. Lo único roto era que su `META_AD_ACCOUNT_ID` se había guardado como
// `1357728489423123` en vez de `act_1357728489423123`, así que
// `GET /v24.0/1357728489423123` devolvía 400 y el estado no se podía leer.
//
// Lo que lo hizo invisible: el PING de verificación normalizaba el prefijo antes
// de pegarle a la API, y el GUARDADO no. La prueba daba verde sobre un valor que
// nunca se almacenó.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizarCuentaMeta } from '../lib/meta-cuenta-id';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('El id pelado que muestra Business Manager se guarda como lo pide la Graph API', () => {
  assert.equal(normalizarCuentaMeta('1357728489423123'), 'act_1357728489423123');
  // Idempotente: el que ya viene bien no se toca (ni se le pega un segundo act_).
  assert.equal(normalizarCuentaMeta('act_1357728489423123'), 'act_1357728489423123');
  assert.equal(normalizarCuentaMeta('  1357728489423123  '), 'act_1357728489423123');
});

test('Lo que no es inequívocamente un id vuelve INTACTO, no desaparece', () => {
  // Un saneo que se traga lo que no entiende es un `console.warn` con otra cara:
  // la credencial rara tiene que fallar A LA VISTA en la verificación.
  assert.equal(normalizarCuentaMeta('act_'), 'act_');
  assert.equal(normalizarCuentaMeta('https://adsmanager.facebook.com/?act=123'), 'https://adsmanager.facebook.com/?act=123');
  assert.equal(normalizarCuentaMeta('  '), '');
  assert.equal(normalizarCuentaMeta(null), '');
  assert.equal(normalizarCuentaMeta(undefined), '');
});

test('Los CUATRO caminos que tocan la cuenta usan el MISMO normalizador', () => {
  // La regla de la casa: si hay que copiar la misma regla en dos archivos, el
  // segundo se queda viejo. Acá había cuatro copias del ternario
  // `startsWith('act_') ? x : \`act_${x}\`` y una de ellas —el guardado— nunca
  // existió. Este test falla si alguna vuelve a resolverlo por su cuenta.
  const archivos = {
    'app/api/integraciones/credencial/route.ts': leer('../app/api/integraciones/credencial/route.ts'),
    'lib/metodo-verificar.ts': leer('../lib/metodo-verificar.ts'),
    'lib/meta-descubrir.ts': leer('../lib/meta-descubrir.ts'),
  };

  for (const [ruta, src] of Object.entries(archivos)) {
    assert.ok(src.includes('normalizarCuentaMeta'),
      `${ruta} dejó de usar el normalizador de lib/meta-cuenta-id.ts`);
    assert.ok(!/startsWith\('act_'\)\s*\?/.test(src),
      `${ruta} volvió a normalizar el prefijo act_ por su cuenta: es la copia que se queda vieja`);
  }

  // Y el GUARDADO en particular, que es el que faltaba: la whitelist de campos
  // que se normalizan antes de escribir tiene que incluir el de Meta.
  const route = archivos['app/api/integraciones/credencial/route.ts'];
  assert.match(route, /env === 'META_AD_ACCOUNT_ID'/,
    'el guardado volvió a escribir META_AD_ACCOUNT_ID crudo: verificar una cosa y guardar otra');
});
