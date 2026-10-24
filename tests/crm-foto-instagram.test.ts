// =============================================================================
// La foto de Instagram en la tarjeta del lead (24/10/2026)
// =============================================================================
// Pedido del 17/10 (la tarjeta «coherencia-1710»: «Quiero que tengan coherencia»): la foto de Instagram en la tarjeta. La
// tarjeta muestra `foto_auto_url`, que sólo llenaba la copia de la foto de WhatsApp. Ahora el alta copia a nuestro bucket la
// foto del perfil elegido en el buscador (la URL de Meta vence). La URL llega del NAVEGADOR: sólo se baja de un CDN de Meta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esFotoDeInstagram } from '../lib/foto-instagram-reglas';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

test('sólo se baja una foto de un CDN de Meta, por https', () => {
  assert.equal(esFotoDeInstagram('https://scontent-gru1-1.cdninstagram.com/v/t51.2885-19/abc.jpg?stp=x'), true);
  assert.equal(esFotoDeInstagram('https://scontent.xx.fbcdn.net/v/t1.0-9/abc.jpg'), true);
  assert.equal(esFotoDeInstagram('http://scontent.cdninstagram.com/a.jpg'), false, 'sin https');
  assert.equal(esFotoDeInstagram('https://cdninstagram.com.evil.com/a.jpg'), false, 'un host que sólo EMPIEZA como el de Meta');
  assert.equal(esFotoDeInstagram('https://169.254.169.254/latest/meta-data'), false, 'una dirección interna');
  assert.equal(esFotoDeInstagram('javascript:alert(1)'), false);
  assert.equal(esFotoDeInstagram(''), false);
  assert.equal(esFotoDeInstagram(null), false);
  assert.equal(esFotoDeInstagram(`https://a.cdninstagram.com/${'x'.repeat(2100)}`), false, 'una URL gigante');
});

test('el alta la copia al bucket: sólo con el perfil elegido, sin pisar otra foto, y sin frenar el alta', () => {
  const nf = leer('app/crm/new/NewLeadForm.tsx');
  assert.match(nf, /<input type="hidden" name="instagram_foto" value=\{perfil\?\.foto \?\? ''\} \/>/);
  const a = leer('app/crm/actions.ts');
  assert.match(a, /const fotoIg = formData\.get\('instagram_foto'\);\n\s+if \(igDelAlta && esFotoDeInstagram\(fotoIg\)\) await guardarFotoDeInstagram\(created\.id, fotoIg\);/);
  const f = leer('lib/foto-instagram.ts');
  assert.match(f, /if \(!esFotoDeInstagram\(url\)\) return false;/, 'el server baja cualquier URL');
  assert.match(f, /if \(!r\.ok \|\| \(r\.url && !esFotoDeInstagram\(r\.url\)\)\) return false;/, 'una redirección lleva a otro host');
  assert.match(f, /\.eq\('id', leadId\)\.is\('foto_auto_url', null\)\.select\('id'\);/, 'pisa la foto de WhatsApp');
  assert.match(f, /if \(error \|\| !data\?\.length\) \{ await storage\.remove\(\[path\]\)/, 'deja huérfana la copia que no se usó');
  assert.match(f, /if \(!buf\.length \|\| buf\.length > TOPE_BYTES\) return false;/);
  assert.match(f, /catch \(e\) \{\n\s+console\.error\('\[foto-instagram\][^\n]*\n\s+return false;/, 'puede tirar y frenar el alta');
});
