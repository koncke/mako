// =============================================================================
// Ningún botón le pide a alguien que vaya a donde ya está
// =============================================================================
// ⚠️ ESTE TEST EXISTE PORQUE EL MISMO DEFECTO SE REPORTÓ TRES VECES.
//
//   «ya estoy en flow y me pide ir a flow»
//   «me sigue diciendo ir a google flow cuando ya estoy»
//
// Y las tres veces el botón HACÍA lo correcto: `abrirFlow` enfoca la pestaña, así
// que estando ahí sólo cierra el popup y deja Flow adelante. Lo que mentía era la
// ETIQUETA — por eso sobrevivió a dos arreglos, porque los dos miraron la acción.
//
// Y sobrevivió por una razón estructural, no por descuido: cada arreglo agregaba
// una condición para SU caso y dejaba un `else` que no miraba dónde estaba la
// persona. Primero se cubrió el paso que tenía frase; después apareció
// `subir_imagen`, que no tiene, y cayó por el else.
//
// La cura fue que la pregunta sea UNA —¿está parada donde tiene que actuar?— y que
// el rótulo de cada operación viva en el catálogo, donde el compilador lo exige.
//
// Este test fija la clase entera, no el caso: **con la persona adentro del
// proyecto, ningún rótulo puede mandarla a Google Flow.**
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OPERACIONES, A_PEDIR } from '../lib/flow-operaciones';

const popup = readFileSync(
  resolve(import.meta.dirname, '..', 'extension', 'popup.js'), 'utf8',
);

test('toda operación que PIDE algo trae su propio rótulo de botón', () => {
  // Sin esto, el popup tiene que decidirlo con un `if`, y ahí es donde crece el
  // `else` que no mira dónde está la persona.
  for (const o of A_PEDIR) {
    assert.ok(o.boton, `${o.op} no tiene rótulo de botón`);
    assert.ok(o.boton.length <= 24, `el rótulo de ${o.op} es muy largo para un botón`);
  }
});

test('ningún rótulo del catálogo manda a Flow', () => {
  // El rótulo del catálogo se usa CUANDO YA ESTÁ AHÍ. Si alguno dijera «ir a Flow»,
  // volvería el defecto por la puerta nueva.
  for (const o of OPERACIONES) {
    assert.ok(
      !/\b(ir|anda|ve|abrir?)\b.*\bflow\b/i.test(o.boton || ''),
      `El rótulo de ${o.op} manda a Flow: «${o.boton}». Ese rótulo se muestra cuando la\n`
      + 'persona YA está adentro del proyecto.',
    );
  }
});

test('los rótulos nombran su acción, no son un verbo suelto', () => {
  // La regla de la casa: ningún botón puede ser «Aceptar», «Sí» o «Continuar» a secas.
  const SUELTOS = ['aceptar', 'sí', 'si', 'ok', 'continuar', 'siguiente', 'cerrar', 'listo'];
  for (const o of A_PEDIR) {
    assert.ok(
      !SUELTOS.includes(String(o.boton).toLowerCase()),
      `El rótulo de ${o.op} es un verbo suelto: «${o.boton}»`,
    );
  }
});

test('el popup decide el rótulo por DÓNDE ESTÁ, en una sola condición', () => {
  // La forma que evita el `else` ciego: `enProyecto ? <del catálogo> : 'Ir a Google
  // Flow'`. Si vuelve a haber una condición que mezcla el rótulo con «tiene frase»,
  // vuelve el bug — porque la operación sin frase cae por el else.
  const sinComentarios = popup
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const m = /boton:\s*([^\n]+)/.exec(sinComentarios.slice(sinComentarios.indexOf('v.siguiente')));
  assert.ok(m, 'no encontré el rótulo del botón del paso');
  const linea = m[1];

  assert.ok(
    /v\.flowEnProyecto/.test(linea),
    'El rótulo del botón no mira `flowEnProyecto`. Sin eso, alguien parado en Flow\n'
    + 'puede leer «Ir a Google Flow» — reportado tres veces.',
  );
  assert.ok(
    /v\.siguiente\.boton/.test(linea),
    'El rótulo no sale del catálogo: lo está decidiendo el popup con un `if`, que es\n'
    + 'de donde salió el `else` ciego las tres veces.',
  );
  assert.ok(
    !/frase/.test(linea),
    'El rótulo vuelve a depender de si hay frase. Ésa es exactamente la condición que\n'
    + 'dejó afuera a `subir_imagen`: no tiene frase y cayó por el else, diciéndole a\n'
    + 'alguien parado en Flow que fuera a Flow.',
  );
});
