// Auditoría de seguridad del 01/11/2026.
//  1. El descifrado exige un tag GCM de 16 bytes: con uno recortado a 4 (Node lo acepta), forjar un criptograma
//     costaba 2^32 intentos. Verificado rompiéndolo: con el `descifrar` de antes (HEAD del 01/11) el criptograma
//     con los 4 primeros bytes del tag ABRÍA (1 fallo, 1 pase).
//  2. La hidratación del entorno es una lista de lo PERMITIDO (el catálogo), no de exclusión.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

test('1. descifrar rechaza un tag de menos de 16 bytes', async () => {
  const antes = process.env.CREDENCIALES_SECRET;
  process.env.CREDENCIALES_SECRET = 'k'.repeat(64);
  try {
    const { cifrar, descifrar } = await import('../lib/cripto-credenciales');
    const enc = cifrar('sk-de-prueba', 7, 'GEMINI_API_KEY');
    assert.equal(descifrar(enc, 7, 'GEMINI_API_KEY'), 'sk-de-prueba', 'el camino normal sigue abriendo');
    const p = enc.split('.');
    const tag = Buffer.from(p[3], 'base64url');
    assert.equal(tag.length, 16);
    const recortado = [p[0], p[1], p[2], tag.subarray(0, 4).toString('base64url'), p[4]].join('.');
    assert.equal(descifrar(recortado, 7, 'GEMINI_API_KEY'), null, 'un tag de 4 bytes (aunque sean los correctos) no vale');
    assert.equal(descifrar(enc, 8, 'GEMINI_API_KEY'), null, 'y movido de fila tampoco (AAD)');
  } finally {
    if (antes === undefined) delete process.env.CREDENCIALES_SECRET; else process.env.CREDENCIALES_SECRET = antes;
  }
});

test('2. la hidratación copia al entorno sólo lo del catálogo', () => {
  const src = readFileSync(raiz + 'lib/credenciales.ts', 'utf8').replace(/\r\n/g, '\n');
  const cuerpo = src.slice(src.indexOf('function aplicarAEnv('), src.indexOf('function aplicarAEnv(') + 600);
  assert.match(cuerpo, /if \(!puedeHidratarse\(clave\)\) \{/, 'aplicarAEnv tiene que preguntar a la lista permitida');
  assert.match(src, /return ENVS_DEL_CATALOGO\.has\(baseDeClave\(clave\)\) \|\| esClaveDeIA\(clave\) \|\| esClaveDeCuenta\(clave\);/);
});
