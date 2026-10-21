// =============================================================================
// La décima revisión del Cerebro (5d353db16, 21/10/2026): la red de opciones, con la entrada en dígitos
// =============================================================================
// docs/hallazgos-onboarding.md, «Una lectura por defecto no se propone» y «Los números en letras se normalizan antes de
// leer». La novena prometió que la opción correcta está siempre; con «Tres cuotas mensuales» faltaba la de 3 meses, porque
// la red sólo juntaba dígitos pegados a la palabra. Se cambió la ENTRADA (`precioEnDigitos`, una vez, antes de leer), no se
// sumaron reglas. Y lo que no salió de una señal («Renovación anual», «Membresía USD 29», «USD 997») no se propone: se
// pregunta sin recomendar. La guarda de pestaña vieja vuelve a ver la pregunta del cobro.
//
// ROTURAS: ver el final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COBRO_MENSUAL, COBRO_SIN_LECTURA, COBRO_UNICO, PDF_BIEN, RECARGA_LA_PAGINA, SUMA_PDF, cobroDelPrecio, etiquetaCobro, leerRespuesta,
  mensajesDeArranque, notaDelPdf, opcionesDeCobro, pdfConfirmarPregunta, precioEnDigitos, recomienda, type EstadoArranque, type HechosArranque, type Respuesta,
} from '../lib/onboarding-arranque';
import { preguntaQueContesta } from '../app/onboarding/arranque-ui';

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Ana López', nombreWorkspace: '', faseGuardada: false,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: true, terminado: false,
};
const E: EstadoArranque = { nombre: 'Ana', negocio: 'Acme', pdfOk: 'si' };
const responder = (e: EstadoArranque, r: Respuesta, h = H) => leerRespuesta(e, h, { ...preguntaQueContesta(mensajesDeArranque(e, h)), ...r });
const conPrecio = (precio: string): HechosArranque => ({ ...H, cobroLeido: cobroDelPrecio(precio), cobroOpciones: opcionesDeCobro(precio) });
const ops = (precio: string) => opcionesDeCobro(precio).map(etiquetaCobro);
const de = (n: number) => `Suscripción de ${n} meses`;

test('1. el precio se pasa a dígitos una vez, y la lectura y las opciones leen lo mismo', () => {
  assert.equal(precioEnDigitos('Tres cuotas mensuales de USD 300'), '3 cuotas mensuales de usd 300');
  assert.equal(precioEnDigitos('treinta y seis cuotas'), '36 cuotas');
  assert.equal(precioEnDigitos('Elegí tres, seis o doce cuotas'), 'elegi 3 , 6 o 12 cuotas');
  // La lectura también: «tres cuotas» es la de 3 meses, no la sin fin.
  assert.deepEqual(cobroDelPrecio('Tres cuotas mensuales de USD 300'), { tipo: 'suscripcion', meses: 3 });
  assert.deepEqual(cobroDelPrecio('dos pagos de USD 500'), { tipo: 'suscripcion', meses: 2 });
  assert.deepEqual(cobroDelPrecio('USD 300 por mes durante tres meses'), { tipo: 'suscripcion', meses: 3 });
  // Y las opciones, completas.
  assert.deepEqual(ops('Tres cuotas mensuales de USD 300'), [de(3), COBRO_UNICO, COBRO_MENSUAL]);
  assert.deepEqual(ops('veinticuatro cuotas de USD 50'), [de(24), COBRO_UNICO, COBRO_MENSUAL]);
});

test('2. qué N entran: enumeraciones, «x», «cuotas:», \\b a la izquierda, las de cuotas antes y sin tope', () => {
  assert.deepEqual(ops('Elegí 3, 6 o 12 cuotas'), [de(12), COBRO_UNICO, COBRO_MENSUAL, de(3), de(6)]);
  assert.deepEqual(ops('USD 900 en 3 o 6 cuotas'), [de(6), COBRO_UNICO, COBRO_MENSUAL, de(3)]);
  assert.ok(ops('10 x USD 120 mensuales').includes(de(10)));
  assert.ok(ops('USD 120 mensuales x 10').includes(de(10)));
  assert.ok(ops('3x USD 330').includes(de(3)));
  assert.ok(ops('Cuotas: 3 de USD 300').includes(de(3)));
  assert.ok(ops('USD 1.500 en 3 partes').includes(de(3)));
  // Lo que dice la N sin escribirla: los plazos en días y un plan trimestral o semestral.
  assert.ok(ops('Cuotas a 30, 60 y 90 días').includes(de(3)));
  assert.ok(ops('Plan trimestral: USD 297/mes').includes(de(3)));
  assert.ok(ops('Plan semestral a USD 200 por mes').includes(de(6)));
  assert.ok(!ops('Hasta 2026 meses').includes(de(26)), '«2026 meses» no es «26 meses»');
  assert.ok(!ops('USD 50, 3 cuotas de USD 20').includes(de(50)), 'un monto antes de una coma no es una enumeración');
  assert.ok(!ops('2x1 en el primer mes, USD 100 por mes').some((o) => /de 1 meses/.test(o)));
  // Las de cuotas van antes que las de «meses» (que pueden ser la duración) y no las corta el tope.
  const largo = ops('Mentoría 1:1 semanal: 2 meses de onboarding, 3 meses de implementación, 4 meses de escala, 6 meses de comunidad; 9 cuotas');
  assert.equal(largo[2], de(9), 'la de las cuotas no va primera entre las N');
  assert.ok(ops('USD 30 por mes, 48 cuotas, clase 1:1 semanal').includes(de(48)), 'el techo de 36 sacaba la de 48');
  // Sin repetir: «12 cuotas» y «12 meses» son una sola opción.
  const doce = ops('USD 1.200 en 12 cuotas, 12 meses de acceso, o de contado');
  assert.equal(doce.filter((o) => o === de(12)).length, 1);
});

test('3. una lectura por defecto no se propone: se pregunta sin recomendar, y un sí no elige', () => {
  for (const precio of ['Renovación anual de USD 1.500', 'Anual: USD 1.500', 'Inversión semanal: USD 99', 'Membresía USD 29', 'Suscripción USD 9,99',
    'Suscripción de 6 meses', 'USD 2.400 en 24 meses', 'Programa de 12 meses, 3.000 USD', 'USD 997']) {
    const leido = cobroDelPrecio(precio);
    assert.equal(recomienda(leido), false, `«${precio}» se recomendó sin una señal`);
    const h = conPrecio(precio);
    const m = mensajesDeArranque(E, h).despues.at(-1);
    assert.equal(m?.texto, COBRO_SIN_LECTURA, precio);
    assert.deepEqual(m?.opciones?.slice(0, 2), [COBRO_UNICO, COBRO_MENSUAL], `«${precio}»: orden fijo`);
    assert.equal(responder(E, { texto: 'sí' }, h).ok, false, `«${precio}»: un sí eligió`);
  }
  // Lo que sí salió de una señal se propone: pago único, contado, lo negado, cuotas, mensual.
  for (const precio of ['Pago único de USD 997', 'USD 997 de contado', 'USD 1.000, sin cuotas', 'USD 997, acceso de por vida, sin mensualidades', '6 cuotas de USD 100', 'USD 100 por mes']) {
    assert.equal(recomienda(cobroDelPrecio(precio)), true, precio);
  }
  // Y la opción correcta de las por defecto está.
  assert.ok(ops('Suscripción de 6 meses').includes(de(6)));
  assert.ok(ops('USD 2.400 en 24 meses').includes(de(24)));
});

test('4. en el cobro, un «no» escrito no elige, y un sí sin la pregunta pide recargar', () => {
  const h = conPrecio('USD 997 en 6 cuotas');
  for (const t of ['no', 'Nop', 'No, son 3 cuotas', 'no, es pago único']) assert.equal(responder(E, { texto: t }, h).ok, false, `«${t}» eligió`);
  for (const t of ['Ok', 'Dale', 'Perfecto']) assert.deepEqual(responder(E, { texto: t }, h), { ok: true, patch: { cobro: { tipo: 'suscripcion', meses: 6 } } }, t);
  // Una pantalla de antes (sin la pregunta): con una lectura recomendada es una confirmación, y pide recargar.
  assert.deepEqual(leerRespuesta(E, h, { texto: 'Sí' }), { ok: false, error: RECARGA_LA_PAGINA, cambio: true });
  assert.deepEqual(leerRespuesta(E, h, { opcion: 0, opcionTexto: de(6) }), { ok: false, error: RECARGA_LA_PAGINA, cambio: true });
});

test('5. PDF: el separador de lo sumado no es algo que la persona escriba, y la pregunta cambia aunque lo nuevo empiece igual', () => {
  const E2: EstadoArranque = { nombre: 'Ana', negocio: 'Acme' };
  // Lo que escribe con « · » adentro se cita entero.
  assert.equal(pdfConfirmarPregunta('Precio: 200 · Garantía: 30 días'), 'Escribiste «Precio: 200 · Garantía: 30 días». ¿Lo tomo como que está todo bien?');
  // Lo mismo, más largo, sumado pasado el tope: la pregunta cambia (cuenta lo sumado).
  const larga = 'La garantía me parece bien explicada, aunque la reformularía un poco más corta';
  const antes: EstadoArranque = { ...E2, pdfEscritas: ['a', 'b', 'c', 'd', larga] };
  const vio = preguntaQueContesta(mensajesDeArranque(antes, H));
  const r = responder(antes, { texto: `${larga}, y el precio es 200` });
  assert.ok(r.ok);
  const despues: EstadoArranque = { ...antes, ...(r.ok ? r.patch : {}) };
  assert.notEqual(mensajesDeArranque(despues, H).despues.at(-1)?.texto, vio.pregunta);
  assert.deepEqual(leerRespuesta(despues, H, { opcion: 0, opcionTexto: PDF_BIEN, ...vio }), { ok: false, error: 'La pregunta cambió.', cambio: true });
  // La nota los junta con « · ».
  assert.equal(notaDelPdf({ ...E2, pdfOk: 'no', pdfEscritas: ['a', `b${SUMA_PDF}c`] }), 'a · b · c');
});

// ROTURAS (21/10/2026, romper.js + roturas-decima.json y roturas-decima2.json del scratchpad; con novena, octava, séptima,
// sexta, quinta, toque-que-confirma, cierre-florencia y pdf-confirmar; base 50/0), 18 de 18: sin los números en letras →
// 48/2 · la lectura sin el precio en dígitos → 49/1 · sin la enumeración → 48/2 · sin «x N» ni «cuotas:» → 48/2 · sin \b
// a la izquierda → 49/1 · sólo la primera N → 48/2 · las N hasta 36 → 48/2 · las de meses antes → 49/1 · sin el dedup →
// 48/2 · sin «pagos» ni «mensualidades» → 48/2 · la lectura por defecto se propone → 49/1 · lo negado no es señal → 48/2 ·
// la guarda no ve el cobro → 49/1 · un no elige → 49/1 · el separador « · » → 49/1 · la pregunta del PDF sin contar → 49/1 ·
// sin los plazos en días → 8/1 · sin el plan trimestral → 8/1. Y medido con las frases de la sonda de la décima que traen
// su respuesta (316, medir-red.mts del scratchpad): la correcta está entre las opciones en las 316.
