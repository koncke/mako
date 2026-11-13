// =============================================================================
// Un texto de MaKo para personas nombra el negocio, nunca «ws9» (13/11/2026)
// =============================================================================
// En la prueba del grupo de la app del ws9 MaKo contestó «Este resumen es de la cuenta de este grupo, ws9» y «en esta cuenta (ws9)».
// Martín (memoria `nombres-no-codigos`): «No me digas más "ws9"… Dime nombres». La pieza: lib/sin-codigos-de-negocio.ts; la usa
// lib/mako-doer-in.ts en lo que sale del turno.
//
// PROBADO ROMPIÉNDOLO: sin la pieza en el doer, rojo «el doer la usa…»; sin la pieza, el archivo no carga.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { idsDeNegocioEn, sinCodigosDeNegocio } from '../lib/sin-codigos-de-negocio';

const NOMBRES = new Map([[9, 'Martin Koncke'], [13, 'Codigo Inmobiliario']]);

test('⛔ lo que salió el 13/11 queda con el nombre del negocio', () => {
  assert.equal(sinCodigosDeNegocio('Este resumen es de la cuenta de este grupo, ws9. Si querías otro negocio, dime cuál y lo reviso.', NOMBRES),
    'Este resumen es de la cuenta de este grupo, Martin Koncke. Si querías otro negocio, dime cuál y lo reviso.');
  assert.equal(sinCodigosDeNegocio('Aparte, en el CRM no hay reuniones R1 ni R2 agendadas para mañana en esta cuenta (ws9).', NOMBRES),
    'Aparte, en el CRM no hay reuniones R1 ni R2 agendadas para mañana en esta cuenta (Martin Koncke).');
});

test('el nombre que ya estaba no se repite, y lo que no tiene nombre dice «este negocio»', () => {
  assert.equal(sinCodigosDeNegocio('Codigo Inmobiliario (ws13) pagó.', NOMBRES), 'Codigo Inmobiliario pagó.');
  assert.equal(sinCodigosDeNegocio('Lo vi en WS 21 y en ws#9.', NOMBRES), 'Lo vi en este negocio y en Martin Koncke.');
});

test('un link, las palabras de la persona y lo que no es un código no se tocan', () => {
  const link = 'Mira la ficha aquí → https://hola-mako.com/crm/6013?ws=9';
  assert.equal(sinCodigosDeNegocio(link, NOMBRES), link);
  assert.equal(sinCodigosDeNegocio('Anoté tu pedido: «revisar el ws9 mañana»', NOMBRES), 'Anoté tu pedido: «revisar el ws9 mañana»');
  assert.equal(sinCodigosDeNegocio('El campo `ws9` del JSON.', NOMBRES), 'El campo `ws9` del JSON.');
  assert.equal(sinCodigosDeNegocio('news9 y ws9x no son códigos.', NOMBRES), 'news9 y ws9x no son códigos.');
  assert.deepEqual(idsDeNegocioEn('ws9, ws 13, ?ws=21 y «ws4»'), [9, 13]);
});

test('el doer la usa en lo que sale del turno, y en el grupo de un cliente sólo nombra al suyo', () => {
  const doer = readFileSync(join(__dirname, '..', 'lib', 'mako-doer-in.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(doer, /const partes = \(respuesta \?\? ''\)[^\n]*sinCodigosDeNegocio\(alTuteo\(conElDominioDeMaKo\(/, 'lo que sale al grupo y a la memoria seguiría diciendo «ws9»');
  assert.match(doer, /idsDeNegocioEn\(texto\)\.filter\(\(id\) => esPlataforma \|\| id === wsData\)/, 'en el grupo de un cliente, el número de otro negocio se volvería su nombre');
  assert.match(doer, /nombresParaLaSalida\(respuesta \?\? '', wsData, esElGrupoDeLaPlataforma\)/);
});
