// =============================================================================
// EL ONBOARDING V2 CONTRA LO ACORDADO: la tarjeta del código, la del teléfono y los recuadros (20/11/2026)
// =============================================================================
// La auditoría del Cerebro (side-session-notes/…/auditoria-onboarding-reto-20-11.md, tramo «onboarding-antes»). OA-01 a OA-05 ya
// estaban (la cuarta ronda, a8187496b). Aquí:
//   · OA-06: «Confirmar» siempre activo; de lo pegado, el grupo de 6 números seguidos; un teléfono en la caja no es un código;
//   · OA-07: con los 6 números, se confirma solo a los 0,9 s;
//   · OA-08: con el código vencido, «Abrir WhatsApp» sigue (sin «Pedir otro»);
//   · OA-05 (el resto): el error de la caja ya no dice «Pega aquí el código»;
//   · OA-15: «Seguir» siempre activo, y con menos dígitos el error de la maqueta;
//   · OA-14, OA-18, OA-F2: «Escribe otra cosa» en el contacto, «¿Cómo llegaste a MaKo?» sin el nombre, «Ya lo guardé» en la caja;
//   · OA-F1: el WhatsApp de la burbuja, con la lada y en grupos;
//   · OA-11 / OD-F3: «Sigamos en tu computadora» con la estrellita, el correo y el nombre del chat.
// Probado rompiéndolo (20/11/2026, una rotura por vez y restaurada): cada test cae con su arreglo sacado.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { E_TELEFONO_INCOMPLETO, codigoDeLoEscrito, mensajesDeArranque, telefonoVisible, type HechosArranque } from '../lib/onboarding-arranque';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const v2 = () => sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
const H: HechosArranque = { modo: 'oferta', v2: true, nombreCuenta: '', nombreWorkspace: '', faseGuardada: false, canalNegocio: null, loQueVende: false, conCrm: true, conTelefono: true, terminado: false };
const VERIFICADO = { nombre: 'Valentina', telefono: 'verificado' as const, telefonoNumero: '+5491155550101' };

test('1. OA-06: de lo pegado, el grupo de 6 números; «Confirmar» siempre activo; un teléfono en la caja no es un código', () => {
  assert.equal(codigoDeLoEscrito('Hola Valentina, soy MaKo. Tu código para confirmar tu WhatsApp es 482913. 21:30'), '482913', 'el mensaje entero');
  assert.equal(codigoDeLoEscrito('48 29 13'), '482913');
  assert.equal(codigoDeLoEscrito('4829'), '4829', 'incompleto: el servidor dice «Faltan números»');
  const t = v2();
  assert.match(t, /onChange=\{\(e\) => setCodigo\(codigoDeLoEscrito\(e\.target\.value\)\)\}/);
  assert.match(t, /<Button variant="primary" size="sm" disabled=\{ocupado\} loading=\{ocupado\} onClick=\{confirmar\}>Confirmar<\/Button>/, 'sin apagarse por el largo');
  const ruta = leer('app/api/onboarding/arranque/route.ts');
  assert.match(ruta, /const grupoDe6 = texto \? \/\(\?<!\\d\)\\d\{6\}\(\?!\\d\)\/\.exec\(texto\)\?\.\[0\] : undefined;/);
  assert.match(ruta, /\(grupoDe6 \|\| \(digitosCodigo\.length > 0 && digitosCodigo\.length < 6\)\)/, 'un teléfono (más de 6 sin un grupo de 6) no entra');
});

test('2. OA-07: con los 6 números, el código se confirma solo a los 0,9 s, una vez por código', () => {
  const t = v2();
  assert.match(t, /const MS_CODIGO_SOLO = 900;/);
  assert.match(t, /if \(codigo\.length !== 6 \|\| ocupado \|\| solo\.current === codigo\) return;\n\s*const t = window\.setTimeout\(\(\) => \{ solo\.current = codigo; confirmar\(\); \}, MS_CODIGO_SOLO\);/);
});

test('3. OA-08: con el código vencido, «Abrir WhatsApp» sigue en la tarjeta (sin «Pedir otro»)', () => {
  const t = v2();
  assert.doesNotMatch(t, /Pedir otro|Pasó mucho tiempo/);
  assert.match(t, /const sinLink = !w \|\| !w\.link;/, 'sólo sin el link no hay «Abrir WhatsApp»');
  assert.doesNotMatch(t, /w\.estado === 'vencido'/);
});

test('4. OA-05 y OA-15: los textos de error de la caja y del teléfono', () => {
  const lib = leer('lib/onboarding-arranque.ts');
  assert.doesNotMatch(lib, /'Pega aquí el código/, 'sin «Pega aquí»: la tarjeta no tiene ese rótulo');
  assert.match(lib, /if \(etapa === 'codigo'\) return \{ ok: false, error: 'Escribe el código de 6 números que te mandé por WhatsApp\.' \};/);
  assert.equal(E_TELEFONO_INCOMPLETO, 'A ese número le faltan dígitos. Revísalo y toca «Seguir».');
  const t = v2();
  assert.match(t, /if \(numero\.replace\(\/\\D\/g, ''\)\.length < 6\) \{ onIncompleto\(\); return; \}/);
  assert.match(t, /<Button variant="primary" size="sm" full disabled=\{ocupado\} loading=\{ocupado\} onClick=\{seguir\}>Seguir<\/Button>/, '«Seguir» siempre activo');
  assert.match(leer('app/api/onboarding/arranque/route.ts'), /if \(digitos\.length < 8\) return no\(422, h\.v2 \? E_TELEFONO_INCOMPLETO :/);
});

test('5. OA-14, OA-18 y OA-F2: «Escribe otra cosa» en el contacto, la pregunta sin el nombre y «Ya lo guardé»', () => {
  const agendado = mensajesDeArranque({ ...VERIFICADO }, H).antes.at(-1)!;
  assert.equal(agendado.id, 'arr-agendado');
  assert.equal(agendado.recuadro?.libre, true, 'OA-14');
  const agendadoNo = mensajesDeArranque({ ...VERIFICADO, agendado: 'no' }, H).antes.at(-1)!;
  assert.equal(agendadoNo.id, 'arr-agendado-no');
  assert.equal(agendadoNo.recuadro?.libre, true);
  const origen = mensajesDeArranque({ ...VERIFICADO, agendado: 'si', negocio: 'Nutri Vale' }, H).antes.at(-1)!;
  assert.equal(origen.recuadro?.pregunta, '¿Cómo llegaste a MaKo?', 'OA-18: el recuadro sin el nombre');
  assert.match(origen.texto, /Valentina/, 'el mensaje sí lo nombra');
  const t = v2();
  assert.match(t, /<p className="co-preg__texto">\{q\.pregunta \?\? m\.texto\}<\/p>/);
  assert.match(t, /const enAgendadoNo = etapa === 'agendado' && mensajes\.some\(\(m\) => m\.id === 'arr-agendado-no'\);/);
  assert.match(t, /: enAgendadoNo \? 'Ya lo guardé' : PH\[etapa\]/, 'OA-F2');
});

test('6. OA-F1: el WhatsApp de la burbuja, con la lada y en grupos (nunca pegado)', () => {
  assert.equal(telefonoVisible('+5491155550101'), '+54 911 5555 0101');
  assert.equal(telefonoVisible('5491155550101'), '+54 911 5555 0101');
  const r = mensajesDeArranque({ ...VERIFICADO }, H).antes.find((m) => m.id === 'arr-telefono-r');
  assert.equal(r?.texto, '+54 911 5555 0101', 'la respuesta guardada');
  assert.match(v2(), /onSeguir=\{\(tel, visible\) => void accion\(\{ action: 'telefono', telefono: tel \}, visible\)\}/, 'la que espera, como la escribió');
});

test('7. OA-11 / OD-F3: «Sigamos en tu computadora» con la estrellita, el correo y el nombre del chat', () => {
  const s = sinComentarios(leer('app/onboarding/ChatArranque.tsx'));
  assert.match(s, /\{maqueta && <span aria-hidden="true" data-seguir-criatura=""><CriaturaMako size=\{64\} reaccion="contenta" \/><\/span>\}/);
  assert.match(s, /\{maqueta && email && <p data-seguir-correo=""[^>]*>Te mandamos el link a <b[^>]*>\{email\}<\/b>\.<\/p>\}/);
  assert.match(v2(), /<SeguirEnPc nombre=\{primerNombre\(vista\.nombre \|\| persona\?\.nombre \|\| ''\)\} email=\{persona\?\.email \?\? ''\} maqueta \/>/);
});
