// =============================================================================
// Offer: un documento largo se lee ENTERO, por partes (tarjeta #865, 17/10/2026)
// =============================================================================
// Medido en el ws13 (conversación 8): la transcripción de una llamada de venta tenía 64.462 caracteres y se guardó
// cortada en 40.000 («Leí sólo el principio»); en cada pedido la IA leía ~17.000, porque los documentos de un pedido
// comparten 24.000. Lo que el cliente dijo en la segunda mitad no llegaba nunca a la conversación, al diagnóstico ni a
// la oferta. Lo de acá fija:
//   1. partir no pierde un carácter, y nunca descarta la cola;
//   2. lo que viaja a un pedido es la lectura de TODAS las partes, también la última, y una parte que la IA no pudo
//      leer va tal cual (y el chip lo dice);
//   3. la lectura sobrevive a la próxima escritura de la conversación (`sanearDocumentos` es una lista blanca);
//   4. la ruta lee por partes en los tres caminos (un archivo, un link y la transcripción de un audio) y ya no corta en
//      40.000; el prompt de la lectura está registrado.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (17/10/2026, arnés romper-888.mjs con otra lista de roturas, en el scratchpad de
// la sesión: rompe UNA cosa, corre este archivo y restaura DE MEMORIA). La base en verde (5 de 5); 9 roturas, las 9
// cazadas; los números, al lado de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_PARTES, TOPE_DOC_ENTERO, TOPE_PARTE, TOPE_TEXTO_DOC, avisoDeLectura, documentosParaPrompt, lecturaPorPartes, parseLectura, partirEnPartes,
  sanearDocumentos, type DocParaPrompt,
} from '../lib/offer-reglas';

const leer = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** Una llamada de venta de ~64.000 caracteres, como la del ws13: renglones con la hora y quién habla. */
function llamada(): string {
  const lineas: string[] = [];
  for (let i = 0; lineas.join('\n').length < 64_000; i++) {
    const h = `${Math.floor(i / 60)}:${String(i % 60).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`;
    lineas.push(`${h} ${i % 2 ? 'Cristian' : 'Joan'}: seguimos hablando del sistema de captación y de cómo trabaja el equipo con cada agente, renglón ${i}.`);
  }
  // Lo que importa, al FINAL de la llamada: el precio y la objeción.
  lineas.push('1:58:10 Joan: el plan de implementación son 1.900 USD por tres meses.');
  lineas.push('1:58:40 Cristian: «me da miedo que los leads sean de mala calidad».');
  return lineas.join('\n');
}

// rotura (`partirEnPartes` sin la última parte): 1 fallo, 4 pases. rotura (sin agrandar el tope con más de
// MAX_PARTES): 1 fallo, 4 pases.
test('1 · partir no pierde un carácter, corta en un renglón y nunca descarta la cola', () => {
  const t = llamada();
  assert.ok(t.length > 64_000);
  const partes = partirEnPartes(t);
  assert.equal(partes.join(''), t, 'unidas dan exactamente el texto');
  assert.ok(partes.length >= 4 && partes.every((p) => p.length <= TOPE_PARTE));
  assert.ok(partes.slice(0, -1).every((p) => p.endsWith('\n')), 'cada corte cae al final de un renglón');
  assert.match(partes[partes.length - 1], /1\.900 USD/, 'la cola, con el precio, está');
  // Sin un solo separador también: a la fuerza, pero entero.
  const corrido = 'x'.repeat(40_000);
  assert.equal(partirEnPartes(corrido).join(''), corrido);
  // Un documento enorme no supera MAX_PARTES: crece el tamaño de cada parte, no se descarta nada.
  const enorme = 'Renglón con datos del negocio.\n'.repeat(40_000);
  const p = partirEnPartes(enorme);
  assert.ok(p.length <= MAX_PARTES);
  assert.equal(p.join(''), enorme);
  assert.deepEqual(partirEnPartes(''), []);
});

const doc = (d: Partial<DocParaPrompt> & { texto: string }): DocParaPrompt => ({ id: 'd1', nombre: 'transcripcion llamada mako.docx', at: '2026-10-16T22:40:22.488Z', ...d });

// rotura (`documentosParaPrompt` con el texto y no la lectura): 1 fallo, 4 pases.
// rotura (`lecturaPorPartes` sin la parte que la IA no leyó): 1 fallo, 4 pases.
test('2 · lo que viaja al pedido es la lectura de TODAS las partes, también la última; la que no se leyó va tal cual', () => {
  const t = llamada();
  const partes = partirEnPartes(t);
  // La IA anota lo de cada parte; la ÚLTIMA trae el precio y la objeción.
  const lecturas = partes.map((p, i) => (i === partes.length - 1 ? 'Joan dice que el plan son 1.900 USD por tres meses. Cristian: «me da miedo que los leads sean de mala calidad».' : `Parte ${i + 1}: hablan del sistema.`));
  const lectura = lecturaPorPartes(lecturas, partes);
  const prompt = documentosParaPrompt([doc({ texto: t, lectura, partes: partes.length }), doc({ id: 'd2', nombre: 'Propuesta.pdf', texto: 'Propuesta: 1.900 USD.'.repeat(300) })]);
  assert.match(prompt, /1\.900 USD por tres meses/, 'el precio del final de la llamada llega');
  assert.match(prompt, /me da miedo que los leads sean de mala calidad/);
  assert.match(prompt, new RegExp(`«transcripcion llamada mako\\.docx» \\(leído entero, en ${partes.length} partes\\)`));
  assert.doesNotMatch(prompt.slice(0, prompt.indexOf('«Propuesta.pdf»')), /recortado/, 'la lectura de la llamada entra sin recortar');
  // Sin lectura, el mismo texto se recortaba: es lo que pasaba antes.
  assert.doesNotMatch(documentosParaPrompt([doc({ texto: t })]), /1\.900 USD por tres meses/);
  // Una parte que la IA no pudo leer va TAL CUAL, y el chip lo dice.
  const conHueco = lecturas.map((l, i) => (i === 1 ? null : l));
  const l2 = lecturaPorPartes(conHueco, partes);
  assert.ok(l2.includes(partes[1].trim()), 'la parte 2 entera, sin resumir');
  assert.match(l2, /\[Parte 2 de \d+, tal cual\]/);
  assert.equal(avisoDeLectura(conHueco, partes.length), `No pude resumir la parte 2 de ${partes.length}: va tal cual.`);
  assert.equal(avisoDeLectura(lecturas, partes.length), null, 'leído entero, el chip no dice nada');
  assert.equal(parseLectura('{"lectura": "  algo  "}'), 'algo');
  assert.equal(parseLectura('{"lectura": ""}'), null);
});

// rotura (`sanearDocumentos` sin `lectura`): 1 fallo, 4 pases.
test('3 · la lectura y las partes sobreviven a la próxima escritura de la conversación', () => {
  const [d] = sanearDocumentos([{ id: 'a', nombre: 'n', via: 'docx', texto: 'x'.repeat(70_000), chars: 70_000, at: 'x', lectura: '[Parte 1 de 5]\nalgo', partes: 5 }]);
  assert.equal(d.lectura, '[Parte 1 de 5]\nalgo');
  assert.equal(d.partes, 5);
  assert.equal(d.texto.length, 70_000, 'el texto entero');
});

// rotura (el tope de lo guardado otra vez en 40.000): 1 fallo, 4 pases.
// rotura (`leer` sin `leerPorPartes`): 1 fallo, 4 pases. rotura (la transcripción del audio sin su lectura): 1 fallo, 4 pases.
test('4 · la ruta guarda el documento entero y lo lee por partes en los tres caminos; el prompt está registrado', () => {
  assert.ok(TOPE_TEXTO_DOC >= 200_000, 'la llamada del ws13 (64.462) y una de cuatro horas entran enteras');
  assert.ok(TOPE_DOC_ENTERO <= 24_000 / 1.5, 'uno que no entra en su parte del pedido se lee por partes');
  const ruta = leer('app/api/offer/route.ts');
  const fn = (nombre: string) => ruta.slice(ruta.indexOf(`async function ${nombre}(`), ruta.indexOf('\n}\n', ruta.indexOf(`async function ${nombre}(`)));
  // Un archivo.
  const leerFn = fn('leer');
  assert.ok(leerFn.indexOf('await leerPorPartes(texto, nombre, inicio)') > 0 && leerFn.indexOf('await leerPorPartes(') < leerFn.indexOf('guardarDocumento(body, doc)'));
  assert.match(leerFn, /\.\.\.\(porPartes \? \{ lectura: porPartes\.lectura, partes: porPartes\.partes \} : \{\}\),/);
  // Un link.
  const link = fn('leerLink');
  assert.match(link, /const porPartes = await leerPorPartes\(texto, nombreDoc, inicio\);/);
  assert.match(link, /\.\.\.\(porPartes \? \{ lectura: porPartes\.lectura, partes: porPartes\.partes \} : \{\}\),/);
  // La transcripción de un audio largo, ANTES del CAS.
  const turno = fn('turno');
  assert.ok(turno.indexOf("await leerPorPartes(transcripcion, 'Transcripción del audio', inicio)") < turno.indexOf('await actualizarSesion(sesionId, (f) => {'));
  // Desde el 20/10/2026 el mismo documento sirve para un texto escrito largo (repartirTextoLargo): `porPartes` es el del
  // audio o el del texto (tests/offer-texto-largo.test.ts).
  assert.match(turno, /const porPartes = transcripcion \? audioPorPartes : textoPorPartes;/);
  assert.match(turno, /\.\.\.\(porPartes \? \{ lectura: porPartes\.lectura, partes: porPartes\.partes \} : \{\}\),/);
  // Nadie más corta en 40.000.
  assert.doesNotMatch(ruta, /(?<!\d)40_000|slice\(0, 40/);
  // Cada parte la lee la IA con su prompt, registrado y editable.
  const pp = fn('leerPorPartes');
  assert.match(pp, /lecturaDeParte\(\{ nombre, parte: partes\[i\], i, n: partes\.length, hastaMs \}\)/);
  assert.match(pp, /return \{ lectura: lecturaPorPartes\(lecturas, partes\), partes: partes\.length, aviso: avisoDeLectura\(lecturas, partes\.length\) \};/);
  assert.match(leer('lib/prompt-registry.ts'), /key: 'offer\.lectura\.system'[\s\S]*?default: OFFER_LECTURA_SYSTEM_TEMPLATE,/);
});

// rotura (el prompt de la lectura sin «TAL CUAL»): 1 fallo, 4 pases.
test('5 · el prompt de cada parte copia los números tal cual y no inventa', () => {
  const ia = leer('lib/offer-ia.ts');
  const t = ia.slice(ia.indexOf('export const OFFER_LECTURA_SYSTEM_TEMPLATE = `'), ia.indexOf('`;', ia.indexOf('export const OFFER_LECTURA_SYSTEM_TEMPLATE = `')));
  assert.match(t, /Copia los números, montos, plazos y nombres TAL CUAL aparecen\. No calcules, no redondees, no inventes\./);
  assert.match(t, /\{"lectura": "lo que dice esta parte"\}/);
  assert.match(ia, /contenidoNoConfiable\(p\.parte, 'documentos'\)/, 'la parte va envuelta como dato');
});
