// =============================================================================
// El WhatsApp es lo primero del onboarding (30/10/2026, estrategia de lanzamiento: se paga antes de entrar)
// =============================================================================
// El Cerebro: «el WhatsApp del comprador se pide en el primer paso adentro de la app, con una sola pregunta y sin formulario». Es la
// MISMA pregunta que iba al final, con su código: sin verificar, MaKo no suma a nadie a su grupo (auditoría del 14/10). Esto fija:
//   1. el orden: el teléfono antes que el nombre, y «Ahora no» no traba;
//   2. lo que se dibuja: el saludo una sola vez, y el resto de la charla no vuelve a preguntarlo;
//   3. la capa sin teléfono (Project Manager) sigue arrancando por el nombre;
//   4. las dos trampas de adelantarlo: la entrada de MaKo se dispara también en esta etapa, y el grupo no nace «MaKo <> tu negocio»;
//   5. escribirlo en la caja del chat vale: era lo primero que hacía quien pagó, y le contestaba «Ahora no estoy esperando eso»;
//   6. quien lo dio al pagar no lo escribe de nuevo: la tarjeta arranca con él, y lo manda un toque, nunca solo.
//
// Correr: node --import tsx --test tests/onboarding-whatsapp-primero.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AHORA_NO, CAMBIAR_NUMERO, PIDE_TELEFONO, PREGUNTA_TELEFONO, SALUDO_ARRANQUE, SALUDO_TRAS_TELEFONO,
  etapaDeArranque, leerRespuesta, mensajesDeArranque, telefonoEscrito, type EstadoArranque, type HechosArranque,
} from '../lib/onboarding-arranque';
import { ladoDeLaPregunta, placeholderDe, tarjetaConNumero } from '../app/onboarding/arranque-ui';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Ana', nombreWorkspace: 'Negocio de Ana', faseGuardada: false,
  canalNegocio: null, loQueVende: false, conCrm: true, conTelefono: true, terminado: false,
};
const PLAN: HechosArranque = { ...H, modo: 'plan', conCrm: false, conTelefono: false };

test('1. el teléfono va antes que el nombre; el código, después; verificado o «Ahora no», sigue', () => {
  assert.equal(etapaDeArranque({}, H), 'telefono');
  assert.equal(etapaDeArranque({ telefono: 'codigo' }, H), 'codigo');
  assert.equal(etapaDeArranque({ telefono: 'verificado' }, H), 'nombre');
  assert.equal(etapaDeArranque({ telefono: 'postergado' }, H), 'nombre', '«Ahora no» no traba a quien ya pagó');
  // Una conversación que venía por la mitad, de antes del cambio: también se lo pregunta, y después sigue donde estaba.
  const aMedias: EstadoArranque = { nombre: 'Ana', negocio: 'N' };
  assert.equal(etapaDeArranque(aMedias, H), 'telefono');
  assert.equal(etapaDeArranque({ ...aMedias, telefono: 'postergado' }, H), 'oferta');
  assert.equal(etapaDeArranque({}, { ...H, terminado: true }), 'listo', 'terminado no pregunta nada');
});

test('2. lo primero que se dibuja es la pregunta, con su tarjeta y «Ahora no»; el saludo no se repite', () => {
  const { antes: a0, despues: d0 } = mensajesDeArranque({}, H);
  assert.deepEqual(a0.map((m) => m.id), ['arr-telefono']);
  assert.equal(a0[0].texto, PREGUNTA_TELEFONO);
  assert.equal(a0[0].tarjeta, 'telefono');
  assert.deepEqual(a0[0].opciones, [AHORA_NO]);
  assert.deepEqual(d0, []);

  const codigo = mensajesDeArranque({ telefono: 'codigo', telefonoNumero: '+5491155551234' }, H).antes;
  assert.deepEqual(codigo.map((m) => m.id), ['arr-telefono', 'arr-telefono-r', 'arr-codigo']);
  assert.deepEqual(codigo[2].opciones, [CAMBIAR_NUMERO, AHORA_NO]);
  assert.match(codigo[2].texto, /\+5491155551234/);

  const nombre = mensajesDeArranque({ telefono: 'postergado' }, H).antes;
  assert.equal(nombre.at(-1)?.texto, SALUDO_TRAS_TELEFONO);
  assert.doesNotMatch(SALUDO_TRAS_TELEFONO, /Hola/, 'ya saludó con la pregunta del WhatsApp');
  assert.equal(nombre[0].tarjeta, undefined, 'contestada, la tarjeta no vuelve');

  // Al terminar, la pregunta no se repite al final.
  const todos = mensajesDeArranque({ telefono: 'verificado', nombre: 'Ana', negocio: 'N', origen: 'Instagram', interes: 'ventas', pdfOk: 'si', crmTipo: 'llamada' },
    { ...H, loQueVende: true, faseGuardada: true });
  assert.equal([...todos.antes, ...todos.despues].filter((m) => m.id === 'arr-telefono').length, 1);
  assert.ok(todos.antes.some((m) => m.id === 'arr-telefono'));
  assert.ok(!todos.despues.some((m) => m.id === 'arr-telefono'));
});

test('2b. la respuesta optimista se dibuja al lado de la pregunta', () => {
  assert.equal(ladoDeLaPregunta('telefono', 'oferta'), 'antes');
  assert.equal(ladoDeLaPregunta('codigo', 'oferta'), 'antes');
});

test('3. la capa sin teléfono sigue arrancando por el nombre, con el saludo entero', () => {
  assert.equal(etapaDeArranque({}, PLAN), 'nombre');
  assert.equal(mensajesDeArranque({}, PLAN).antes[0].texto, SALUDO_ARRANQUE);
});

test('4. las trampas de adelantarlo', () => {
  const chat = leer('app/onboarding/ChatArranque.tsx');
  assert.match(chat, /useState\(!inicial\.introVista && \(inicial\.etapa === 'telefono' \|\| inicial\.etapa === 'nombre'\)\)/, 'sin esto, la entrada de MaKo no sale nunca');
  const ruta = leer('app/api/onboarding/arranque/route.ts');
  // Que con el nombre vacío el grupo nazca con el del workspace lo prueba EJECUTANDO tests/whatsapp-anti-ban.test.ts («sin el nombre del
  // negocio todavía…»). Acá, que la ruta lo pase vacío y no «tu negocio».
  assert.match(ruta, /pedirMensajeDeVerificacion\(g\.ws, digitos, e\.negocio \|\| ''\)/, 'con «tu negocio» el grupo nace «MaKo <> tu negocio»: vacío, usa el nombre del workspace');
  // Al decir el negocio, el grupo que ya nació toma el nombre; sin grupo, no se crea uno vacío.
  assert.match(ruta, /if \(patch\.negocio && \(await getGrupoJidMaKo\(g\.ws\)\.catch\(\(\) => null\)\)\) await asegurarGrupoMaKo\(g\.ws, \{ nombre: patch\.negocio \}\)/);
  // Y el contacto de los reportes, que nació sin nombre.
  assert.match(ruta, /if \(c\?\.telefono && !c\.nombre\) await setContactoReportes\(\{ \.\.\.c, nombre: patch\.nombre \}\)/);
});

test('5. el WhatsApp escrito en la caja vale, con su país; lo demás pide el número, sin trabar', () => {
  for (const [escrito, digitos] of [['+54 9 11 5555-1234', '5491155551234'], ['+52 (686) 123 4567', '526861234567'], ['5491155551234', '5491155551234']] as const) {
    assert.equal(telefonoEscrito(escrito), digitos, escrito);
  }
  // Sin país no se adivina: a un número local el código le llegaría a otra persona.
  for (const escrito of ['1155551234', '01155551234', '+54', 'Ana', 'mi número es 1155551234', 'tengo 5491155551234 clientes', '+1234567890123456', '']) {
    assert.equal(telefonoEscrito(escrito), null, escrito);
  }
  const ruta = leer('app/api/onboarding/arranque/route.ts');
  assert.match(ruta, /const escrito = etapa === 'telefono' && opcion === undefined && texto \? telefonoEscrito\(texto\) : null;\n\s+if \(escrito\) return await pedirCodigo\(e, h, confirmado, escrito\);/, 'lo escrito va por el mismo camino que la tarjeta, con su código');
  assert.deepEqual(leerRespuesta({}, H, { texto: 'hola' }), { ok: false, error: PIDE_TELEFONO });
  assert.deepEqual(leerRespuesta({}, H, { texto: 'ahora no' }), { ok: true, patch: { telefono: 'postergado' } });
  assert.deepEqual(leerRespuesta({}, H, { opcion: 0, opcionTexto: AHORA_NO }), { ok: true, patch: { telefono: 'postergado' } });
  assert.ok(placeholderDe('telefono'), 'la caja dice qué escribir');
});

test('6. el WhatsApp del pago: arranca cargado, editable, y nada lo usa hasta el toque', () => {
  assert.deepEqual(tarjetaConNumero('5491122334455'), { lada: '+54', numero: '91122334455' });
  assert.deepEqual(tarjetaConNumero('526861234567'), { lada: '+52', numero: '6861234567' });
  // Sin número, con basura, o con un país que no se conoce: vacía. `splitTelefono` le pondría +52 a un número de otro país.
  const vacia = tarjetaConNumero('');
  assert.equal(vacia.numero, '');
  for (const raro of [null, undefined, 'abc', '123', '+5491122334455', '1234567890123456', '999999999999']) {
    assert.deepEqual(tarjetaConNumero(raro), vacia, String(raro));
  }

  const server = leer('lib/onboarding-arranque-server.ts');
  assert.match(server, /telefonoDelPago: etapa === 'telefono' \? \(await getSetting\(CLAVE_WHATSAPP_DEL_PAGO\)/, 'sólo en la etapa del teléfono');
  const chat = leer('app/onboarding/ChatArranque.tsx');
  assert.match(chat, /<TarjetaTelefono inicial=\{vista\.telefonoDelPago\}/);
  assert.match(chat, /useState\(\(\) => tarjetaConNumero\(inicial\)\.numero\)/);
  // Nadie más lo lee: sin probar no llega al contacto de los reportes ni dispara un código (auditoría del 14/10).
  assert.equal(server.split('(CLAVE_WHATSAPP_DEL_PAGO').length - 1, 1, 'una sola lectura: la de la vista');
  assert.doesNotMatch(leer('app/api/onboarding/arranque/route.ts'), /whatsapp_del_pago|WHATSAPP_DEL_PAGO|telefonoDelPago/);
  assert.equal(chat.split('telefonoDelPago').length - 1, 1, 'la pantalla sólo se lo da a la tarjeta');

  // El mismo texto que escribe el alta, apenas esa constante exista en el árbol.
  const declarada = /CLAVE_WHATSAPP_DEL_PAGO = '([^']+)'/.exec(server)?.[1];
  assert.equal(declarada, 'cuenta.whatsapp_del_pago');
  const delAlta = /export const CLAVE_WHATSAPP_DEL_PAGO = '([^']+)'/.exec(leer('lib/origen-cuenta.ts'))?.[1];
  if (delAlta !== undefined) assert.equal(delAlta, declarada, 'el alta y el onboarding leen claves distintas');
});

// PROBADO ROMPIENDO (31/10/2026, base 5/0): el teléfono de vuelta al final, 3/2; el saludo repetido, 4/1; la respuesta lejos de la pregunta,
// 4/1; sin la entrada de MaKo, 4/1; el grupo con «tu negocio», 4/1; el grupo sin tomar el nombre del negocio, 4/1. Con el test 5 (base 6/0): la
// ruta sin mirar lo escrito, 5/1; un número local aceptado, 5/1; una frase con un número aceptada, 5/1 (la primera versión del caso pasaba igual,
// por el largo: de ahí «tengo 5491155551234 clientes»); lo escrito sin pedir el número, 5/1; «ahora no» escrito sin valer, 5/1. Con el test 6 (base 7/0): un país desconocido con el de por defecto, 6/1;
// cualquier cosa aceptada como número, 6/1; leído en todas las etapas, 6/1; otra clave, 6/1; la tarjeta sin recibirlo, 6/1; la ruta usándolo, 6/1;
// el alta con otra clave en lib/origen-cuenta.ts, 6/1.

// 4/11/2026: MaKo no le escribe primero a nadie. En una verificación entrante el chat no dice «Te mandé un código»: pide que la persona
// le escriba, con la tarjeta del link, y lo escrito en la caja no se toma como código. Probado rompiéndolo: con el texto de antes, 1 fallo.
test('6. la verificación entrante: MaKo pide el mensaje, no manda un código', () => {
  const e: EstadoArranque = { telefono: 'codigo', telefonoNumero: '+5491130000111', telefonoEntrante: true };
  const ultimo = mensajesDeArranque(e, H).antes.at(-1)!;
  assert.equal(ultimo.tarjeta, 'whatsapp');
  assert.doesNotMatch(ultimo.texto, /Te mandé/);
  assert.match(ultimo.texto, /mándame un mensaje desde el \+5491130000111/);
  assert.deepEqual(ultimo.opciones, [CAMBIAR_NUMERO, AHORA_NO]);
  const tipeado = leerRespuesta(e, H, { texto: 'K7P2QX' });
  assert.equal(tipeado.ok, false);
  // Cambiar el número saca también la marca: el próximo pedido es otro.
  const cambio = leerRespuesta(e, H, { opcion: 0, opcionTexto: CAMBIAR_NUMERO });
  assert.ok(cambio.ok && 'patch' in cambio && cambio.patch.telefonoEntrante === undefined && 'telefonoEntrante' in cambio.patch);
  // Un pedido de antes (MaKo mandó el código) sigue igual.
  assert.match(mensajesDeArranque({ telefono: 'codigo', telefonoNumero: '+5491130000111' }, H).antes.at(-1)!.texto, /Te mandé un código/);
});
