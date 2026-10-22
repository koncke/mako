// =============================================================================
// Offer · la SEGUNDA prueba de los chats (22/10/2026, contra producción 87365c830)
// =============================================================================
// El arnés del Cerebro (rama probar-chats-offer) corrió dos veces la conversación del Sprint en el ws3 por el POST real
// de /api/offer. Lo que seguía fallando y vive en Offer:
//   1 · «Todavía no vendí ninguno… No tengo casos ni testimonios»: no anotaba la prueba (y «Armar» rebotaba con «falta:
//       prueba») o dejaba ventas «sin dato: ya vende el Sprint», leído de «Vendo el Sprint».
//   2 · «Quiero que la promesa sea exactamente esta: «…». Anótala así»: contestaba «queda anotada tal cual» y no.
//   3 · el PDF decía «Dónde cierras la venta: Llamada de venta» en una oferta sin canal en el funnel que el dueño dijo
//       tres veces que se vende por WhatsApp y sin llamadas.
//   5 · «[de: chat]» impreso 7 veces en el PDF (el modelo copiaba la marca del bloque de piezas).
//   6 · «Número 2: ventas para validar» y «Número 5» en la caja de datos para completar.
//   7 · «se guarda automáticamente cuando tocas Armar mi oferta» (lo guarda «Guardar»).
//   8 · «¿qué más te falta saber?» contestado con una pieza opcional mientras lo que frenaba «Armar» era la prueba.
// (La 4, los turnos lentos con Gemini, es del área IA: docs/hallazgos-ia.md.)
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (22/10/2026, arnés romper-prueba2.mjs en el scratchpad de la sesión). Los
// números, al lado de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DIMENSION_IDS, faltanMinimas, type PiezasSabidas } from '../lib/offer-marco';
import {
  canalQueDijo, conCanalDeLaOferta, conclusionVisible, conLoQueDijoElDueno, estadoDeLaOferta, literalDelDueno, parseDiagnostico,
  parseTurno, rotuloDeNumero,
} from '../lib/offer-reglas';
import type { Diagnostico } from '../lib/fase-diagnostico';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// Los mensajes del dueño en la conversación del Sprint del arnés (scripts/probar-chats/casos-offer.json, O01-O08).
const O01 = 'Vendo el Sprint: un programa de 2 semanas para diseñadores gráficos freelance que todavía no consiguen clientes. Cuesta USD 270, pago único. Es 100% online, por WhatsApp y con videos grabados: no hay llamadas de venta ni sesiones en vivo.';
const O04 = 'Todavía no vendí ninguno: el sábado 24/10 empiezo a mandar los mensajes de prospección. No tengo casos ni testimonios todavía.';
const O07 = 'Te lo repito: es pago único de USD 270 y no hay llamadas.';
const O08 = 'Quiero que la promesa sea exactamente esta, sin cambiarle nada: «Tu primer cliente de diseño en 14 días, sin llamadas de venta». Anótala así.';
const p = (valor: string) => ({ valor, fuente: 'chat' as const, at: '' });

// rotura (sin leer «no vendí»): 1 fallo. rotura (sin leer «no tengo casos»): 1 fallo.
test('1 · «Todavía no vendí ninguno… No tengo casos ni testimonios» queda anotado, y «Armar» ya no rebota por la prueba', () => {
  const antes: PiezasSabidas = { cliente: p('Diseñadores'), problema: p('Nadie les escribe'), resultado: p('Primer cliente en 14 días'), entregables: p('Plan día por día'), precio: p('USD 270, pago único'), ventas: p('sin dato: ya vende el Sprint') };
  const despues = conLoQueDijoElDueno(antes, O04, 'T');
  assert.match(despues.ventas?.valor ?? '', /^0: todavía no vendió/, 'pisa el «sin dato» leído de «Vendo el Sprint», y empieza en 0 (lo lee alertaSinDatos)');
  assert.match(despues.prueba?.valor ?? '', /no tiene casos ni testimonios/);
  assert.deepEqual(faltanMinimas(despues), [], 'con eso, nada mínimo falta');
  assert.equal(conLoQueDijoElDueno(antes, O01, 'T'), antes, '«todavía no consiguen clientes» no es «no vendí»');
});

// rotura (sin el texto literal): 1 fallo. rotura (sin los alias de las keys): 1 fallo.
test('2 · «la promesa sea exactamente esta: «…». Anótala así» queda TAL CUAL, y una key inventada va a su pieza', () => {
  assert.deepEqual(literalDelDueno(O08), { key: 'resultado', valor: 'Tu primer cliente de diseño en 14 días, sin llamadas de venta' });
  assert.equal(literalDelDueno('La promesa: «algo»'), null, 'sin pedir que quede literal, no');
  assert.equal(conLoQueDijoElDueno({}, O08, 'T').resultado?.valor, 'Tu primer cliente de diseño en 14 días, sin llamadas de venta');
  const t = parseTurno({ respuesta: 'Queda anotada tal cual.', opciones: [], piezas: { promesa: 'Tu primer cliente de diseño en 14 días', 'garantía': '7 días' } });
  assert.equal(t?.piezas.resultado, 'Tu primer cliente de diseño en 14 días', '«promesa» no existe: es el resultado');
  assert.equal(t?.piezas.garantia, '7 días', 'con tilde, la misma pieza');
});

// rotura (sin el canal dicho): 1 fallo. rotura (las llamadas del negocio se imprimen igual): 1 fallo.
// rotura (lo dicho le gana al funnel): 1 fallo.
test('3 · sin canal en el funnel, el canal es el que dijo el dueño; y «no hay llamadas» nunca imprime «Llamada de venta»', () => {
  const fase = { fase: 1, canal: 'llamadas' } as unknown as Diagnostico;
  const dicho = canalQueDijo([O01, O04, O07, O08]);
  assert.deepEqual(dicho, { canal: 'conversaciones', sinLlamadas: true }, '«por WhatsApp» y «no hay llamadas»');
  assert.equal(conCanalDeLaOferta(fase, null, dicho)?.canal, 'conversaciones');
  const soloSin = conCanalDeLaOferta(fase, null, canalQueDijo([O07]));
  assert.ok(soloSin && !('canal' in soloSin), 'sólo «no hay llamadas»: el canal no se imprime');
  assert.equal(conCanalDeLaOferta(fase, 'carrito', dicho)?.canal, 'carrito', 'el canal del funnel es un dato cargado: gana');
  assert.equal(canalQueDijo(['Agendamos una llamada de 30 minutos y ahí cierro']).canal, 'llamadas');
});

// rotura (la ruta no anota lo que dijo el dueño): 1 fallo. rotura (el PDF no mira lo que dijo): 1 fallo.
test('1, 2 y 3 en la ruta: las piezas del turno pasan por lo que dijo el dueño, y el PDF por el canal que dijo', () => {
  const r = leer('app/api/offer/route.ts');
  assert.match(r, /conCobroDelPrecio\(conLoQueDijoElDueno\(\s*turnoIA \? fundirPiezasDelTurno\([^)]*\) : f\.piezas, u\.texto,\s*\)\)/);
  assert.match(r, /conCanalDeLaOferta\(faseVigenteDe\(ctx\), ctx\.funnel\?\.canal \?\? null, canalQueDijo\(fila\.mensajes\.filter\(\(m\) => m\.de === 'yo'\)\.map\(\(m\) => m\.texto\)\)\)/);
});

const diagCon = (tesis: string) => ({
  tesis, fuerte: 'F', fuertes: ['La promesa [de: chat] es clara'],
  dimensiones: DIMENSION_IDS.map((id) => ({ id, nota: 7, porque: `porque [de: chat] sí`, mejora: 'm' })),
  cambios: [{ titulo: 'Cambio [de: documento]', porque: 'p', hipotesis: 'h' }],
});

// rotura (lo que trae el modelo sigue con la marca): 1 fallo. rotura (lo guardado sigue con la marca): 1 fallo.
test('5 · «[de: chat]» no llega al diagnóstico ni al PDF: ni lo nuevo ni lo guardado', () => {
  const d = parseDiagnostico(diagCon('Tu oferta [de: chat] es buena.'));
  assert.ok(d, 'el diagnóstico se lee');
  assert.doesNotMatch(JSON.stringify(d), /\[de:/i);
  const guardada = { version: 1, calculo: { total: 70, cuello: 'D1', lista: false, alertas: [] }, diagnostico: diagCon('T [de: chat].'), propuesta: { nombre: 'N [de: chat]', numeros: [] } };
  const f = { piezas: {}, mensajes: [], documentos: [] };
  assert.doesNotMatch(JSON.stringify(conclusionVisible(guardada as never, f)), /\[de:/i);
  const limpia = { ...guardada, diagnostico: diagCon('T.'), propuesta: { nombre: 'N', numeros: [] } };
  limpia.diagnostico.fuertes = ['F'];
  limpia.diagnostico.dimensiones = limpia.diagnostico.dimensiones.map((x) => ({ ...x, porque: 'p' }));
  limpia.diagnostico.cambios = [{ titulo: 'C', porque: 'p', hipotesis: 'h' }];
  assert.equal(conclusionVisible(limpia as never, f), limpia, 'sin marcas, el MISMO objeto: nadie reescribe nada');
});

// rotura (el rótulo vuelve a ser la posición): 1 fallo.
test('6 · un número para completar se llama como dice antes de la marca', () => {
  assert.equal(rotuloDeNumero('Ventas objetivo por mes: [completar] ventas para validar', 1), 'Ventas objetivo por mes');
  assert.equal(rotuloDeNumero('LTV:CAC [completar]', 4), 'LTV:CAC');
  assert.equal(rotuloDeNumero('[completar] clientes al mes', 2), 'Número 3', 'sin nada antes, la posición');
  assert.match(leer('lib/offer-reglas.ts'), /\.\.\.p\.numeros\.map\(\(n, i\): \[string, string\] => \[rotuloDeNumero\(n, i\), n\]\)/);
});

// rotura (vuelve «se arma y después la puede guardar»): 1 fallo. rotura (sin qué falta): 1 fallo.
test('7 y 8 · el turno sabe que «Armar» no guarda, y qué falta para armarla (o que ya puede)', () => {
  const sinPrueba: PiezasSabidas = { cliente: p('a'), problema: p('a'), resultado: p('a'), entregables: p('a'), ventas: p('0'), precio: p('270') };
  const e = estadoDeLaOferta({ conclusiones: [], ofertaId: null, ofertaVersion: null, piezas: sinPrueba });
  assert.match(e, /«Armar mi oferta» la arma pero NO la guarda\. Nunca digas que se guarda sola\./);
  assert.match(e, /Para armarla falta: prueba\. Si pregunta qué te falta, es eso y nada más\./);
  const lista = estadoDeLaOferta({ conclusiones: [], ofertaId: null, ofertaVersion: null, piezas: { ...sinPrueba, prueba: p('no tiene') } });
  assert.match(lista, /Ya tiene lo mínimo para armarla: si pregunta qué te falta, dile que puede tocar «Armar mi oferta»/);
  assert.match(leer('app/api/offer/route.ts'), /estadoDeLaOferta\(fila\)/, 'con la fila entera: lleva las piezas');
});
