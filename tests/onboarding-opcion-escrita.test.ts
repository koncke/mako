// =============================================================================
// Lo escrito en una pregunta con opciones se ENTIENDE, pero se guarda recién con un toque (20/10 → 21/10/2026)
// =============================================================================
// Martín, en la llamada con Florencia del 18/10 (Fathom 864249059, [00:44:35]): «no te deja escribir cuando te da las
// opciones». En «¿Cuál es tu MAYOR cuello de botella hoy?» ella dijo que «no queda fijo, se va moldeando» y terminó
// eligiendo una; lo escrito recibía «Elige una de las opciones.». docs/hallazgos-onboarding.md, «Florencia (ws21, 18/10)».
//
// Tres revisiones del Cerebro (20/10 tarde, 20/10 noche, 21/10) encontraron que cada ronda de reglas para LEER frases
// («15.000», «2 millones», «no cierran», «la web») cerraba los casos de la anterior y abría otros, y cada error guardaba un
// dato malo en el diagnóstico con un «Lo tomé como» que no dejaba corregir. La regla desde el 21/10 (Cerebro): NADA de lo
// escrito se guarda en silencio. MaKo muestra lo que entendió («Entendí: «…». ¿Es así?») con «Sí, es eso» y las otras
// opciones, y se guarda recién con ese toque. Una cifra en pesos no se ubica: se pregunta en dólares.
//
// ROTURAS: en el encabezado de tests/onboarding-cifras-escritas.test.ts (roturas-tercera.json, 21/10/2026). La que más
// importa es la primera: «lo escrito se guarda sin el toque» tira 6 tests, entre ellos el barrido de abajo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EN_DOLARES, INTERESES, interesDe, NO_ENTENDI_OPCION, SI_ES_ESO, canalDeTexto, leerRespuesta, mensajesDeArranque,
  opcionMasCercana, tramoDe, type EstadoArranque, type HechosArranque, type MensajeArranque, type Respuesta,
} from '../lib/onboarding-arranque';
import { CANALES, PREGUNTAS, VOLUMEN_POR_CANAL } from '../lib/fase-diagnostico';
import { preguntaQueContesta } from '../app/onboarding/arranque-ui';

const opcionesDe = (id: string) => PREGUNTAS.find((q) => q.id === id)!.opciones;
const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Florencia', nombreWorkspace: '', faseGuardada: false,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: false, terminado: false,
};
const QUIEN: EstadoArranque = { nombre: 'Florencia', negocio: 'Florencia Carballo', pdfOk: 'si' };
const iCuello = PREGUNTAS.findIndex((q) => q.id === 'cuello');
const iVolumen = PREGUNTAS.findIndex((q) => q.id === 'volumen');
// Todo contestado hasta el cuello, en modo 'oferta' (el canal ya dicho).
const ANTES_DEL_CUELLO: EstadoArranque = { ...QUIEN, canal: 'llamadas', faseResp: PREGUNTAS.map((_, i) => (i < iCuello ? 0 : -1)) };
const todos = (e: EstadoArranque, h = H): MensajeArranque[] => { const m = mensajesDeArranque(e, h); return [...m.antes, ...m.despues]; };
// Como la pantalla: la respuesta viaja con la pregunta que contesta (cuarta revisión, 21/10).
const responder = (e: EstadoArranque, h: HechosArranque, r: Respuesta) => leerRespuesta(e, h, { ...preguntaQueContesta(mensajesDeArranque(e, h)), ...r });

test('una cifra escrita se ubica en SU tramo, y sin cifra se vuelve a preguntar', () => {
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
  assert.equal(tramoDe('$20 por día', inversion), 1, 'lo diario se pasa a mes');
  assert.equal(tramoDe('unas 3.000 ventas', VOLUMEN_POR_CANAL.carrito.opciones), 3);
  assert.equal(tramoDe('3 por mes', opcionesDe('creativos')), 0, 'entre «0 – 3» y «4 – 10» no hay hueco');
  assert.equal(tramoDe('muchísimo', facturacion), null);
  assert.equal(tramoDe('15.000', opcionesDe('cuello')), null, 'una pregunta sin tramos no se lee por cifra');
});

test('la cifra escrita NO se guarda: se muestra lo entendido, y se guarda con «Sí, es eso»', () => {
  const r = leerRespuesta(QUIEN, H, { texto: 'Facturo 15.000 al mes' });
  assert.deepEqual(r, { ok: true, patch: { opcionPorConfirmar: { id: 'facturacion', opcion: 2, escrito: 'Facturo 15.000 al mes' } } });
  const pend: EstadoArranque = { ...QUIEN, ...(r.ok ? r.patch : {}) };
  const ultimo = todos(pend).at(-1)!;
  assert.equal(ultimo.texto, `Entendí: «${opcionesDe('facturacion')[2]}». ¿Es así?`);
  assert.deepEqual(ultimo.opciones, [SI_ES_ESO, ...opcionesDe('facturacion').filter((_, k) => k !== 2)], 'las otras opciones, para corregir con un toque');
  const ok = responder(pend, H, { opcion: 0, opcionTexto: SI_ES_ESO });
  assert.ok(ok.ok && ok.patch.faseResp?.[0] === 2 && ok.patch.escritas?.facturacion === 'Facturo 15.000 al mes' && 'opcionPorConfirmar' in ok.patch && ok.patch.opcionPorConfirmar === undefined,
    ok.ok ? JSON.stringify(ok.patch) : ok.error);
  // Corregir con otra opción guarda ESA, sin lo escrito.
  const otra = responder(pend, H, { opcion: 3, opcionTexto: opcionesDe('facturacion')[3] });
  assert.ok(otra.ok && otra.patch.faseResp?.[0] === 3 && !otra.patch.escritas, otra.ok ? JSON.stringify(otra.patch) : otra.error);
  // Un sí escrito también confirma; un no vuelve a la pregunta con sus opciones.
  const si = responder(pend, H, { texto: 'sí' });
  assert.ok(si.ok && si.patch.faseResp?.[0] === 2);
  assert.deepEqual(responder(pend, H, { texto: 'no' }), { ok: true, patch: { opcionPorConfirmar: undefined } });
});

test('una cifra en pesos no se ubica: se pregunta en dólares (los tramos son en dólares)', () => {
  // Tercera revisión (21/10): «2 palos por mes» o «2 millones de pesos» (≈ USD 1.500) quedaban en «Más de $80.000».
  for (const t of ['Facturamos 2 palos por mes', 'unos 2 millones de pesos', '50 lucas', 'facturo 800 mil pesos', '$ 2.000.000 ars',
    'facturo 3 millones de pesos colombianos', '1 500 000 pesos']) {
    assert.deepEqual(leerRespuesta(QUIEN, H, { texto: t }), { ok: false, error: EN_DOLARES }, `«${t}»`);
  }
  // Con dólares dicho, sí.
  const r = leerRespuesta(QUIEN, H, { texto: '2 palos verdes por año' });
  assert.ok(r.ok && r.patch.opcionPorConfirmar?.opcion === 4, r.ok ? JSON.stringify(r.patch) : r.error);
});

test('el canal por sus palabras, sin lo negado, y también se confirma', () => {
  assert.equal(canalDeTexto('No hago llamadas, vendo todo por chat'), 'conversaciones');
  assert.equal(canalDeTexto('no hago llamadas, todo por WhatsApp'), 'conversaciones');
  assert.equal(canalDeTexto('vendo por mensajes, sin llamada'), 'conversaciones');
  assert.equal(canalDeTexto('por Zoom'), 'llamadas');
  assert.equal(canalDeTexto('en mi local'), 'presencial');
  assert.equal(canalDeTexto('por WhatsApp y después una llamada'), null);
  assert.equal(canalDeTexto('Ninguno'), null);
  const antesDelCanal: EstadoArranque = { ...QUIEN, faseResp: PREGUNTAS.map((_, i) => (i < iVolumen ? 0 : -1)) };
  const r = leerRespuesta(antesDelCanal, H, { texto: 'No hago llamadas, vendo todo por chat' });
  const iConv = CANALES.findIndex((c) => c.id === 'conversaciones');
  assert.deepEqual(r, { ok: true, patch: { opcionPorConfirmar: { id: 'canal', opcion: iConv, escrito: 'No hago llamadas, vendo todo por chat' } } });
  const ok = responder({ ...antesDelCanal, ...(r.ok ? r.patch : {}) }, H, { opcion: 0, opcionTexto: SI_ES_ESO });
  assert.ok(ok.ok && ok.patch.canal === 'conversaciones', ok.ok ? JSON.stringify(ok.patch) : ok.error);
});

test('con empate o con una sola palabra suelta, no se elige', () => {
  assert.equal(opcionMasCercana('ventas', ['Más ventas este mes', 'Ventas sin parar']), null);
  assert.equal(opcionMasCercana('ventas sin parar', ['Más ventas este mes', 'Ventas y parar']), null, 'lo negado no cuenta');
  const cuello = PREGUNTAS[iCuello].opciones;
  assert.equal(opcionMasCercana('vendo cuando empujo yo, pero va cambiando', cuello), 2);
  assert.equal(opcionMasCercana('los que se interesan no agendan', cuello), 1);
  assert.equal(opcionMasCercana('hola', cuello), null);
});

test('el cuello escrito: se entiende, se muestra, y con el toque queda lo escrito con su «Entendí» y su sí', () => {
  const texto = 'vendo cuando empujo yo, pero va cambiando';
  const r = leerRespuesta(ANTES_DEL_CUELLO, H, { texto });
  assert.deepEqual(r, { ok: true, patch: { opcionPorConfirmar: { id: 'cuello', opcion: 2, escrito: texto } } });
  const pend: EstadoArranque = { ...ANTES_DEL_CUELLO, ...(r.ok ? r.patch : {}) };
  const ok = responder(pend, H, { opcion: 0, opcionTexto: SI_ES_ESO });
  assert.ok(ok.ok, ok.ok ? '' : ok.error);
  if (!ok.ok) return;
  assert.equal(ok.patch.faseResp?.[iCuello], 2);
  assert.deepEqual(ok.patch.escritas, { cuello: texto });
  const m = todos({ ...pend, ...ok.patch });
  const i = m.findIndex((x) => x.id === `arr-fase-${iCuello}-r`);
  assert.equal(m[i]?.texto, texto, 'se ve lo que escribió');
  assert.equal(m[i + 1]?.texto, `Entendí: «${PREGUNTAS[iCuello].opciones[2]}». ¿Es así?`);
  assert.equal(m[i + 2]?.texto, SI_ES_ESO);
  assert.deepEqual(leerRespuesta(ANTES_DEL_CUELLO, H, { texto: 'hola' }), { ok: false, error: NO_ENTENDI_OPCION });
});

test('el interés escrito también se confirma', () => {
  const fin: EstadoArranque = { nombre: 'Florencia', negocio: 'Florencia Carballo', crmTipo: 'llamada', origen: 'Instagram' };
  const vende = { ...H, faseGuardada: true };
  const texto = 'necesito ordenar lo mío, está todo desparramado';
  const r = leerRespuesta(fin, vende, { texto });
  const iVentas = INTERESES.findIndex((x) => x.id === 'ventas');
  assert.deepEqual(r, { ok: true, patch: { opcionPorConfirmar: { id: 'interes', opcion: iVentas, escrito: texto } } });
  const ok = responder({ ...fin, ...(r.ok ? r.patch : {}) }, vende, { opcion: 0, opcionTexto: SI_ES_ESO });
  assert.ok(ok.ok && ok.patch.interes === 'ventas' && ok.patch.escritas?.interes === texto);
  const tocada = leerRespuesta(fin, vende, { opcion: 0, opcionTexto: INTERESES[0].label });
  assert.ok(tocada.ok && tocada.patch.interes === INTERESES[0].id && !tocada.patch.escritas, 'una opción tocada no es una respuesta escrita');
  // Lo negado no cuenta: «no quiero anuncios, quiero ordenar mis ventas» no es «anuncios» (tercera revisión).
  assert.equal(interesDe('no quiero anuncios, quiero ordenar mis ventas'), 'ventas');
  assert.equal(interesDe('que WhatsApp responda solo, los anuncios no'), 'whatsapp');
  assert.equal(interesDe('no me interesan los anuncios'), null);
  const neg = leerRespuesta(fin, vende, { texto: 'no quiero anuncios, quiero ordenar mis ventas' });
  assert.ok(neg.ok && neg.patch.opcionPorConfirmar?.opcion === iVentas, neg.ok ? JSON.stringify(neg.patch) : neg.error);
});

// ── La regla, barrida: NINGUNA respuesta escrita de la fase, el canal o el interés se guarda sin el toque ─────────
const FRASES = [
  'Facturo 15.000 al mes', '2 millones', 'entre 30 y 50 mil', 'cincuenta mil', 'unos 3 por día', '10 llamadas por semana',
  'más de 80.000', 'nada', 'Tengo muchos leads pero no cierran', 'los que se interesan no agendan', 'no doy abasto',
  'vendo cuando empujo yo', 'por WhatsApp', 'No hago llamadas, vendo todo por chat', 'por Zoom', 'en mi local',
  'Me compran directo en la web', 'webinars', 'quiero ordenar mis ventas', 'que WhatsApp responda', 'anuncios',
  'Todavía no tengo nada armado', 'tengo un funnel completo con equipo', 'sí', 'dale', 'hola', '12', '0',
];

test('la regla: ninguna respuesta ESCRITA se guarda sin el toque que la confirma', () => {
  const sinTocar = (patch: Partial<EstadoArranque>, donde: string, frase: string) => {
    for (const k of ['faseResp', 'canal', 'interes', 'escritas'] as const) {
      assert.ok(!(k in patch), `${donde}, «${frase}»: se guardó «${k}» sin el toque (${JSON.stringify(patch)})`);
    }
  };
  // Cada pregunta de la fase (con el canal antes del volumen), en los dos modos, y el interés.
  const estados: Array<[string, EstadoArranque, HechosArranque]> = [];
  for (let i = 0; i < PREGUNTAS.length; i++) {
    const faseResp = PREGUNTAS.map((_, k) => (k < i ? 0 : -1));
    if (PREGUNTAS[i].id === 'volumen') estados.push(['canal', { ...QUIEN, faseResp }, H]);
    estados.push([PREGUNTAS[i].id, { ...QUIEN, canal: 'llamadas', faseResp }, H]);
    estados.push([`${PREGUNTAS[i].id} (plan)`, { nombre: 'F', negocio: 'N', queHace: 'Consultoría', canal: 'llamadas', faseResp }, { ...H, modo: 'plan' }]);
  }
  estados.push(['interes', { nombre: 'F', negocio: 'N', crmTipo: 'llamada', origen: 'Instagram' }, { ...H, faseGuardada: true }]);
  let pendientes = 0;
  for (const [donde, e, h] of estados) {
    for (const frase of FRASES) {
      const r = leerRespuesta(e, h, { texto: frase });
      if (!r.ok) continue;
      sinTocar(r.patch, donde, frase);
      assert.equal(r.fase, undefined, `${donde}, «${frase}»: el diagnóstico se calculó sin el toque`);
      if (r.patch.opcionPorConfirmar) pendientes += 1;
      // Y con algo pendiente, otra frase tampoco guarda: vuelve a pedir el toque (salvo un sí, que ES la confirmación).
      if (r.patch.opcionPorConfirmar) {
        const otra = leerRespuesta({ ...e, ...r.patch }, h, { texto: 'Me compran directo en la web' });
        if (otra.ok) sinTocar(otra.patch, `${donde} (pendiente)`, 'Me compran directo en la web');
      }
    }
  }
  assert.ok(pendientes > 40, `el barrido tiene que llegar a pedir el toque muchas veces (fueron ${pendientes})`);
});
