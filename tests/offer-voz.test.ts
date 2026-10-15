// =============================================================================
// La voz de marca en Offer: la del negocio, por su slot, en los dos prompts que escriben por él
// =============================================================================
// Pedido de Martín (Fathom 858545195 @44:56, validado el 13/10/2026): «una configuración de voz de marca y
// tono personalizado en el Offer Generator, para evitar que los textos generados suenen genéricos,
// corporativos o desconectados del nicho». No es una configuración nueva: la voz YA existía y la usaban
// seis features; Offer era la única afuera (docs/relevo/offer.md). Lo que fija este test:
//   · `vozDelNegocio` (lib/nutricion-generator.ts): la guía destilada primero, la marca declarada después.
//   · `ContextoOffer.voz` va APARTE de `texto` (que se recorta en TOPE_CONTEXTO).
//   · el slot {{voz}} en el turno y en la oferta, NO en el diagnóstico (que no escribe copy).
//   · la ruta se la pasa a los dos.
// El registro de los slots contra el template y el render lo cubre tests/offer-ia-cableado.test.ts.
//
// ROTURAS (14/10/2026, base 4 de 4 en verde, restaurado de memoria): la marca declarada antes que la guía:
// 1 fallo, 3 pases · la voz adentro de `texto`: 1 fallo, 3 pases · la ruta sin `voz: ctx.voz` en la oferta:
// 1 fallo, 3 pases · el turno sin {{voz}}: 1 fallo, 3 pases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Desde `inicio` hasta el cierre real que se le pasa (no un número de caracteres). */
const bloque = (src: string, inicio: string, fin: string): string => {
  const i = src.indexOf(inicio);
  assert.ok(i >= 0, `no encontré «${inicio}»`);
  const j = src.indexOf(fin, i + inicio.length);
  assert.ok(j > i, `no encontré el cierre de «${inicio}»`);
  return src.slice(i, j);
};

const IA = sinComentarios(leer('lib/offer-ia.ts'));
const template = (nombre: string) => bloque(IA, `export const ${nombre} = \``, '`;');

test('vozDelNegocio: la guía destilada primero, y la marca declarada sólo si no hay guía', () => {
  const f = bloque(sinComentarios(leer('lib/nutricion-generator.ts')), 'export async function vozDelNegocio', '\n}\n');
  const guia = f.indexOf('getVozGuia()');
  const marca = f.indexOf('marcaDeclarada()');
  assert.ok(guia > 0 && marca > 0, 'vozDelNegocio no lee las dos fuentes');
  assert.ok(guia < marca, 'la marca declarada no puede ganarle a la guía destilada');
  assert.match(f, /if \(guia\) return guia;/);
});

test('el contexto de Offer trae la voz APARTE del texto que se recorta', () => {
  const src = sinComentarios(leer('lib/offer-contexto.ts'));
  assert.match(src, /vozDelNegocio\(\)\.catch\(logFallo\(/, 'la voz no se lee, o una falla tira el contexto entero');
  const ret = bloque(src, 'texto: recortar(bloques.join', '\n  };\n');
  assert.match(ret, /\n\s+voz: voz\?\.trim\(\) \? recortar\(voz\.trim\(\), TOPE_VOZ\) : null,/);
  assert.doesNotMatch(bloque(src, 'const bloques', 'texto: recortar('), /\bvoz\b/, 'la voz entró a `texto`: se recortaría con el resto del contexto');
});

test('el slot {{voz}} va en el turno y en la oferta, no en el diagnóstico', () => {
  assert.match(template('OFFER_TURNO_SYSTEM_TEMPLATE'), /LA VOZ DEL NEGOCIO[\s\S]*\{\{voz\}\}/);
  assert.match(template('OFFER_PROPUESTA_SYSTEM_TEMPLATE'), /LA VOZ DEL NEGOCIO[\s\S]*\{\{voz\}\}/);
  assert.doesNotMatch(template('OFFER_DIAGNOSTICO_SYSTEM_TEMPLATE'), /\{\{voz\}\}/, 'el diagnóstico no escribe copy');
  for (const t of ['OFFER_TURNO_SYSTEM_TEMPLATE', 'OFFER_PROPUESTA_SYSTEM_TEMPLATE']) {
    assert.match(template(t), /\$\{IDIOMA\} \$\{EXCEPCION_VOZ\}/, `${t}: el idioma neutro sin la excepción de la voz`);
  }
  // Sin guía, el slot no queda vacío: dice qué hacer.
  assert.match(bloque(IA, 'export const vozParaPrompt', ';\n'), /contenidoNoConfiable\(voz\.trim\(\), 'voz'\)[\s\S]*todavía no tiene una guía de voz/);
});

test('la ruta le pasa la voz al turno y a la oferta', () => {
  const ruta = sinComentarios(leer('app/api/offer/route.ts'));
  assert.match(bloque(ruta, 'await turnoOffer({', '});'), /\bvoz: ctx\.voz\b/, 'el turno no recibe la voz');
  assert.match(bloque(ruta, 'await propuestaOffer({', '});'), /\bvoz: ctx\.voz\b/, 'la oferta no recibe la voz');
});
