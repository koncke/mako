// =============================================================================
// Una clave pegada en el Ops Center del super admin no sale ni se guarda (22/10/2026, la de Apify)
// =============================================================================
// Martín contestó una pregunta del Cerebro («¿creás la cuenta de Apify?») con «Otra:» y su token pegado: quedó en el pedido
// firmado, en la respuesta guardada de la pregunta y en lo que el chat recibió. Lo que se escribe en el Ops Center del super admin
// sale FIRMADO desde el navegador (app/admin/operaciones/mandar.ts): no se puede tapar después, así que NO SALE.
//   1. las reglas reconocen la de Apify (y las de Anthropic y OpenAI), sin tapar texto normal;
//   2. mandar.ts la frena ANTES de firmar, y el servidor no guarda un pedido que la traiga (una pestaña de antes);
//   3. la caja y el «Otra» lo dicen apenas aparece, con el botón a /integraciones; el «Otra» no la manda;
//   4. lo que sube el cartero (lo escrito en la app de Claude) se guarda tapado.
// Las claves de este test se arman al correr: ninguna está escrita entera en el archivo.
//
// Correr: node --import tsx --test tests/ops-center-clave-pegada.test.ts
// PROBADO ROMPIÉNDOLO (base 4/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AVISO_CLAVE_EN_EL_CENTRO, RUTA_INTEGRACIONES, hayClave, taparClaves } from '../lib/claves-en-el-chat';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const APIFY = ['apify', 'api', 'A1b2C3d4'.repeat(5)].join('_');
const ANTHROPIC = `sk-ant-api03-${'Ab1_'.repeat(24)}`;
const OPENAI = `sk-proj-${'Ab1x'.repeat(14)}`;

test('1. reconoce la de Apify (y las de Anthropic y OpenAI), sin tapar texto normal', () => {
  const t = taparClaves(`Otra: ${APIFY}`);
  assert.equal(t.tapadas, 1);
  // Desde el 1/11/2026 ofrece conectar la de Competitors Spy. La del Leads Scraper sigue retirada (tests/leads-scraper-retirado.test.ts).
  assert.equal(t.servicio, 'apify-instagram', 'la clave de Apify se conecta a lo único que la usa');
  assert.ok(!t.texto.includes(APIFY));
  for (const k of [ANTHROPIC, OPENAI]) assert.ok(hayClave(`te paso la clave ${k}`), k.slice(0, 8));
  for (const normal of ['el apify_api no anda', 'creala con apify.com y avisame', '/products/sk-ii-facial-treatment-essence-230ml']) {
    assert.equal(hayClave(normal), false, normal);
  }
});

test('2. no sale: mandar.ts la frena antes de firmar, y el servidor no guarda un pedido que la traiga', () => {
  const mandar = sinComentarios(leer('app/admin/operaciones/mandar.ts'));
  // Desde el 27/10/2026 la regla vive en `problemaAntesDeMandar` (el mensaje se dibuja en el acto: lo que no sale se dice antes).
  const frena = mandar.indexOf('if (hayClave(texto)) return AVISO_CLAVE_EN_EL_CENTRO;');
  assert.ok(frena > 0, 'la frena');
  const usa = mandar.indexOf('const antes = problemaAntesDeMandar(!!clave, texto, adjuntos.length > 0, d.tope);');
  assert.ok(usa > 0 && usa < mandar.indexOf('await firmar(clave, firmado)'), 'ANTES de firmar');
  assert.match(sinComentarios(leer('app/admin/operaciones/useCentro.ts')), /const antes = problemaAntesDeMandar\(!!firma\.clave, texto, archivos\.length > 0, tope\);\n    if \(antes\) \{ avisar\(antes, 'bad'\); return; \}/, 'la caja la dice en el acto, sin ponerla en camino');
  const ops = sinComentarios(leer('lib/operaciones.ts'));
  const corta = ops.indexOf('if (hayClave(l.p.texto)) return { ok: false, error: AVISO_CLAVE_EN_EL_CENTRO };');
  assert.ok(corta > 0 && corta < ops.indexOf('.from(T_PEDIDOS).insert('), 'antes de guardar el pedido');
});

test('3. la caja y el «Otra» lo dicen apenas aparece, con el botón a /integraciones; el «Otra» no la manda', () => {
  assert.match(AVISO_CLAVE_EN_EL_CENTRO, /clave.*\/integraciones/);
  assert.equal(RUTA_INTEGRACIONES, '/integraciones');
  assert.match(sinComentarios(leer('app/_chat/AvisoClave.tsx')), /<a className="ch-enlace" href=\{RUTA_INTEGRACIONES\}>Abrir Integraciones<\/a>/);
  assert.match(sinComentarios(leer('app/admin/operaciones/Conversacion.tsx')), /\{envio\.puede && hayClave\(texto\) && <AvisoClave \/>\}/);
  const bloque = sinComentarios(leer('app/admin/operaciones/PreguntasDelChat.tsx'));
  assert.match(bloque, /\{hayClave\(otra\) && <AvisoClave \/>\}/);
  assert.match(bloque, /if \(v\.otra && hayClave\(v\.otra\)\) \{ setError\(AVISO_CLAVE_EN_EL_CENTRO\); return; \}/, 'no la manda');
});

test('4. lo que sube el cartero se guarda tapado', () => {
  const db = sinComentarios(leer('lib/centro-turnos-db.ts'));
  assert.match(db, /\.\.\.\(hayClave\(t\.texto\) \? \{ texto: taparClaves\(t\.texto\)\.texto \} : \{\}\),\n\s*\.\.\.\(t\.resumen && hayClave\(t\.resumen\) \? \{ resumen: taparClaves\(t\.resumen\)\.texto \} : \{\}\),/);
  assert.match(db, /JSON\.stringify\(unirTurnos\(antes, tapados\)\)/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 4/0):
//   · sin la regla de Apify                 → 3/1 (1)
//   · mandar.ts no la frena                 → 3/1 (2)
//   · el servidor la guarda                 → 3/1 (2)
//   · el «Otra» la manda                    → 3/1 (3)
//   · los turnos se guardan sin tapar       → 3/1 (4)
