// =============================================================================
// Las preguntas con opciones del onboarding aceptan lo escrito: «Lo tomé como: …» (20/10/2026)
// =============================================================================
// Martín, en la llamada con Florencia del 18/10 (Fathom 864249059, [00:44:35]): «no te deja escribir cuando te da las
// opciones». En «¿Cuál es tu MAYOR cuello de botella hoy?» ella dijo que «no queda fijo, se va moldeando» y terminó
// eligiendo una; lo escrito recibía «Elige una de las opciones.». Pasaba igual en «¿qué resolver primero?».
// docs/hallazgos-onboarding.md, «Florencia (ws21, 18/10)».
//
// La revisión del Cerebro (20/10, tarde) encontró que una CIFRA escrita caía en el tramo equivocado: «Facturo 15.000 al
// mes» o «más de 80.000» daban «$0 – $3.000», porque el «000» empataba con todas las opciones y ganaba la primera; y «No
// hago llamadas, vendo todo por chat» daba «Llamada de venta». Ahora una cifra se ubica en su tramo, el canal se lee por sus
// palabras sin lo negado, y un empate no elige.
//
// ROTURAS (20/10/2026, arnés romper.js + roturas-escritas.json del scratchpad; base 6/0): la fase sin leer lo escrito →
// 3/3 · sin guardar lo escrito → 5/1 · sin el «Lo tomé como» → 5/1 · el interés sin la más parecida → 5/1 · las cifras por
// palabras y no por tramo → 5/1 · el canal sin leer la negación → 5/1 · con empate gana la primera → 5/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERESES, NO_ENTENDI_OPCION, canalDeTexto, leerRespuesta, mensajesDeArranque, opcionMasCercana, tramoDe,
  type EstadoArranque, type HechosArranque,
} from '../lib/onboarding-arranque';
import { PREGUNTAS, VOLUMEN_POR_CANAL } from '../lib/fase-diagnostico';

const opcionesDe = (id: string) => PREGUNTAS.find((q) => q.id === id)!.opciones;

test('una cifra escrita cae en SU tramo, y sin cifra se vuelve a preguntar', () => {
  const facturacion = opcionesDe('facturacion');
  const casos: Array<[string, number]> = [
    ['Facturo 15.000 al mes', 2], ['entre 10.000 y 30.000', 2], ['10.000 - 30.000', 2], ['$10.000 - $30.000', 2],
    ['unos 50.000 usd', 3], ['más de 80.000', 4], ['Más de 100.000 dólares por mes', 4], ['Unos 15.000 dólares', 2],
    ['$20.000 al mes', 2], ['5.000 USD', 1], ['50 mil', 3], ['2.500', 0], ['Nada', 0],
  ];
  for (const [t, i] of casos) assert.equal(tramoDe(t, facturacion), i, `«${t}» → «${facturacion[i]}»`);
  const inversion = opcionesDe('inversion');
  assert.equal(tramoDe('Invierto 5.000 por mes', inversion), 2);
  assert.equal(tramoDe('unos 20.000 en anuncios', inversion), 3);
  assert.equal(tramoDe('10.000 por mes', inversion), 3);
  assert.equal(tramoDe('$20 por día', inversion), 1, 'lo diario se pasa a mes');
  assert.equal(tramoDe('unas 3.000 ventas', VOLUMEN_POR_CANAL.carrito.opciones), 3);
  assert.equal(tramoDe('3 por mes', opcionesDe('creativos')), 0, 'entre «0 – 3» y «4 – 10» no hay hueco');
  assert.equal(tramoDe('muchísimo', facturacion), null);
  assert.equal(tramoDe('15.000', opcionesDe('cuello')), null, 'una pregunta sin tramos no se lee por cifra');
  // Y en el flujo: la primera pregunta de la fase es la facturación.
  const r = leerRespuesta({ nombre: 'Florencia', negocio: 'Florencia Carballo', pdfOk: 'si' }, H, { texto: 'Facturo 15.000 al mes' });
  assert.ok(r.ok && r.patch.faseResp?.[0] === 2, r.ok ? JSON.stringify(r.patch) : r.error);
});

test('el canal por sus palabras, sin lo negado; con dos canales, se pregunta de nuevo', () => {
  assert.equal(canalDeTexto('No hago llamadas, vendo todo por chat'), 'conversaciones');
  assert.equal(canalDeTexto('no hago llamadas, todo por WhatsApp'), 'conversaciones');
  assert.equal(canalDeTexto('vendo por mensajes, sin llamada'), 'conversaciones');
  assert.equal(canalDeTexto('por Zoom'), 'llamadas');
  assert.equal(canalDeTexto('en mi local'), 'presencial');
  assert.equal(canalDeTexto('por WhatsApp y después una llamada'), null);
  assert.equal(canalDeTexto('Ninguno'), null);
  // Y en el flujo: «No hago llamadas, vendo todo por chat» guarda el canal de conversaciones.
  const antesDelCanal: EstadoArranque = { nombre: 'Florencia', negocio: 'Florencia Carballo', pdfOk: 'si', faseResp: [0, 0, 0, -1, -1, -1] };
  const r = leerRespuesta(antesDelCanal, { ...H }, { texto: 'No hago llamadas, vendo todo por chat' });
  assert.ok(r.ok && r.patch.canal === 'conversaciones', r.ok ? JSON.stringify(r.patch) : r.error);
});

test('con empate, no se elige: antes ganaba la primera', () => {
  assert.equal(opcionMasCercana('ventas', ['Más ventas este mes', 'Ventas sin parar']), null);
  assert.equal(opcionMasCercana('ventas sin parar', ['Más ventas este mes', 'Ventas y parar']), null, 'lo negado no cuenta');
});

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Florencia', nombreWorkspace: '', faseGuardada: false,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: true, terminado: false,
};
const iCuello = PREGUNTAS.findIndex((q) => q.id === 'cuello');
// Todo contestado hasta el cuello, en modo 'oferta' (el canal ya dicho).
const ANTES_DEL_CUELLO: EstadoArranque = {
  nombre: 'Florencia', negocio: 'Florencia Carballo', pdfOk: 'si', canal: 'llamadas',
  faseResp: PREGUNTAS.map((_, i) => (i < iCuello ? 0 : -1)),
};

test('la opción más parecida, por las palabras que comparten', () => {
  const cuello = PREGUNTAS[iCuello].opciones;
  assert.equal(opcionMasCercana('vendo cuando empujo yo, pero va cambiando', cuello), 2);
  assert.equal(opcionMasCercana('los que se interesan no agendan', cuello), 1);
  assert.equal(opcionMasCercana('hola', cuello), null);
});

test('el cuello escrito con sus palabras: se toma la opción, se guarda lo escrito y se dice «Lo tomé como»', () => {
  const r = leerRespuesta(ANTES_DEL_CUELLO, H, { texto: 'vendo cuando empujo yo, pero va cambiando' });
  assert.ok(r.ok, r.ok ? '' : r.error);
  if (!r.ok) return;
  assert.equal(r.patch.faseResp?.[iCuello], 2);
  assert.deepEqual(r.patch.escritas, { cuello: 'vendo cuando empujo yo, pero va cambiando' });
  const e2: EstadoArranque = { ...ANTES_DEL_CUELLO, ...r.patch };
  const todos = [...mensajesDeArranque(e2, H).antes, ...mensajesDeArranque(e2, H).despues];
  const i = todos.findIndex((m) => m.id === `arr-fase-${iCuello}-r`);
  assert.equal(todos[i]?.texto, 'vendo cuando empujo yo, pero va cambiando', 'se ve lo que escribió');
  assert.equal(todos[i + 1]?.texto, `Lo tomé como: «${PREGUNTAS[iCuello].opciones[2]}».`);
  assert.deepEqual(leerRespuesta(ANTES_DEL_CUELLO, H, { texto: 'hola' }), { ok: false, error: NO_ENTENDI_OPCION });
});

test('el interés escrito con otras palabras también entra', () => {
  const fin: EstadoArranque = { nombre: 'Florencia', negocio: 'Florencia Carballo', crmTipo: 'llamada', origen: 'Instagram' };
  const vende = { ...H, faseGuardada: true };
  const r = leerRespuesta(fin, vende, { texto: 'necesito ordenar lo mío, está todo desparramado' });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.patch.interes, 'ventas', 'ninguna palabra clave: la opción más parecida');
  assert.equal(r.patch.escritas?.interes, 'necesito ordenar lo mío, está todo desparramado');
  const tocada = leerRespuesta(fin, vende, { opcion: 0, opcionTexto: INTERESES[0].label });
  assert.ok(tocada.ok && !tocada.patch.escritas, 'una opción tocada no es una respuesta escrita');
});
