// =============================================================================
// Ticket #121 (20/11/2026, ws 13): «Carolina Casab» no aparecía porque la lead se llama «Carolina Cassab»
// =============================================================================
// El dueño mandó una nota de voz al grupo: los datos de «Carolina Casab, que tiene agenda el miércoles 25 a las 15». Whisper
// escribió una sola «s»; en la base es «Cassab», la ÚNICA lead del negocio con R1 el 25/11 a las 15. MaKo contestó «no aparece
// en la base, no la tengo cargada» y marcó [[no-pude]], que abrió el ticket. Dos causas juntas:
//   · `buscar_leads` comparaba el texto ENTERO con `.includes` (lib/mako-tools.ts): ni tildes, ni palabras en otro orden, ni una
//     letra de diferencia;
//   · el prompt mandaba rendirse («di que no lo sabes y marca [[no-pude]]») sin probar la pista de la reunión.
// Lo que fija este archivo:
//   1. la pasada estricta de siempre gana; si da 0, la del CRM (`coincideBusqueda`: tildes y palabras sueltas) con el formato de
//      siempre; si da 0, los APROXIMADOS de una letra por palabra, SIN teléfono ni email y con la orden de preguntar;
//   2. la tolerancia: sólo en el nombre, al menos una palabra exacta, palabras de 4 letras o más, nunca con una sola palabra ni
//      con dígitos o un email;
//   3. el prompt: un nombre que no aparece se busca por la otra pista (día Y hora), y [[no-pude]] no es para un dato que no existe.
//
// PROBADO ROMPIÉNDOLO (20/11/2026): ver la cabecera de abajo, al final del archivo.
// Correr: node --import tsx --test tests/ticket-121-buscar-leads-aproximados.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import * as BT from '../lib/buscar-texto';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

const RAIZ = join(__dirname, '..');
type Buscado = { crudo: string; json: Record<string, any> };

test('1. casiIgual vive en lib/buscar-texto.ts (una sola copia) y la regla del nombre parecido', () => {
  const casiIgual = (BT as Record<string, any>).casiIgual as (a: string, b: string) => boolean;
  const nombreParecido = (BT as Record<string, any>).nombreParecido as (buscado: string, nombre: string | null) => boolean;
  assert.equal(typeof casiIgual, 'function', 'casiIgual exportada desde lib/buscar-texto.ts');
  assert.equal(casiIgual('casab', 'cassab'), true);
  assert.equal(casiIgual('juan', 'joan'), true, 'una letra cambiada: por eso piden una palabra exacta y 4 letras');
  assert.equal(casiIgual('ana', 'ama'), false, 'menos de 4 letras, nunca');
  const dis = fuenteSinComentarios('lib/detalle-sin-inventos.ts');
  assert.doesNotMatch(dis, /function casiIgual\(/, 'detalle-sin-inventos no tiene su copia');
  assert.match(dis, /import \{[^}]*\bcasiIgual\b[^}]*\} from '\.\/buscar-texto';/, 'la importa de lib/buscar-texto.ts');

  assert.equal(typeof nombreParecido, 'function');
  assert.equal(nombreParecido('carolina casab', 'Carolina Cassab'), true, 'una exacta y la otra a una letra');
  assert.equal(nombreParecido('Mariano López', 'Mariana López'), true);
  assert.equal(nombreParecido('Mariano', 'Mariana López'), false, 'una sola palabra: sin tolerancia');
  assert.equal(nombreParecido('Carolina', 'Carolina Cassab'), false, 'una sola palabra, ni exacta: eso lo trae la pasada exacta, no es un parecido');
  assert.equal(nombreParecido('Karolina Casab', 'Carolina Cassab'), false, 'ninguna palabra exacta');
  assert.equal(nombreParecido('carolina casab', 'Carolina Benítez'), false);
  assert.equal(nombreParecido('ana ama', 'Ana Ana'), false, 'la de 3 letras no se tolera');
  assert.equal(nombreParecido('maría anas', 'María Ana'), false, 'tampoco contra una de 3 letras del nombre (casiIgual sólo mira la primera)');
  assert.equal(nombreParecido('carolina 5555 0009', 'Carolina 5555 0001'), false, 'con dígitos, nunca');
  assert.equal(nombreParecido('carolina carolina.c@correo.tst', 'Carolina carolina.c@correo.test'), false, 'con un email, nunca');
  assert.equal(nombreParecido('carolina casab', null), false);
});

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_ticket-121-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 240_000,
  env: { ...process.env, NODE_TEST_CONTEXT: undefined },
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
const ids = (b: Buscado, k: 'leads' | 'aproximados') => ((b.json[k] ?? []) as Array<{ id: number }>).map((l) => l.id).sort();

test('2. «carolina casab»: la 6381 como APROXIMADA, con su R1 en la hora del negocio, sin contacto y con la orden de preguntar', () => {
  assert.equal(R.error, undefined, R.error);
  const b = R.casab as Buscado;
  assert.equal(b.json.encontrados, 0, 'no es una coincidencia: es un parecido');
  assert.deepEqual(ids(b, 'aproximados'), [6381], 'sólo la Cassab: ni la otra Carolina ni la del otro negocio');
  assert.deepEqual(b.json.aproximados[0].reuniones, [{ r: 'R1', fecha: '2026-11-25', dia: 'miércoles 25/11', hora: '15:00' }]);
  assert.doesNotMatch(b.crudo, /telefono|email|5555|correo/, 'el grupo lo lee el equipo: ni teléfono ni email de quien quizá no es');
  assert.match(String(b.json.instruccion), /no es el nombre exacto/i);
  assert.match(String(b.json.instruccion), /¿Es <nombre>, con reunión el <día> a las <hora>\?/);
  assert.match(String(b.json.instruccion), /día y (la )?hora/, 'el desempate por la reunión vive también en la salida');
  assert.deepEqual(R.red, [], 'ninguna red fuera de la base');
});

test('3. lo exacto como siempre: «Carolina Cassab» con su contacto y «carolina» las dos de la pasada estricta', () => {
  const e = R.exacto as Buscado;
  assert.deepEqual(ids(e, 'leads'), [6381]);
  assert.equal(e.json.aproximados, undefined);
  assert.equal(e.json.leads[0].telefono, '+54 9 11 5555 0001', 'el formato de siempre, con el contacto');
  const c = R.carolina as Buscado;
  assert.deepEqual(ids(c, 'leads'), [2624, 6381]);
  assert.equal(c.json.aproximados, undefined);
});

test('4. un nombre parecido de OTRA persona vuelve aproximado y sin contacto; una sola palabra, ni eso', () => {
  const m = R.mariano as Buscado;
  assert.equal(m.json.encontrados, 0);
  assert.deepEqual(ids(m, 'aproximados'), [7001]);
  assert.doesNotMatch(m.crudo, /telefono|email|4444|correo/);
  const s = R.marianoSolo as Buscado;
  assert.equal(s.json.encontrados, 0);
  assert.equal(s.json.aproximados, undefined, '«Mariano» no trae a «Mariana»');
  const k = R.karolina as Buscado;
  assert.equal(k.json.aproximados, undefined, '«Karolina Casab»: ninguna palabra exacta');
  assert.equal(k.json.encontrados, 0);
});

test('5. ni teléfono ni email se toleran: un dígito o una letra de diferencia es otra persona', () => {
  for (const k of ['telefono', 'email'] as const) {
    const b = R[k] as Buscado;
    assert.equal(b.json.encontrados, 0, k);
    assert.equal(b.json.aproximados, undefined, k);
  }
});

test('6. palabras en otro orden y con tildes: la encuentra la regla del CRM, con el formato de siempre', () => {
  for (const k of ['alReves', 'conTilde'] as const) {
    const b = R[k] as Buscado;
    assert.deepEqual(ids(b, 'leads'), [6381], k);
    assert.equal(b.json.encontrados, 1, k);
    assert.equal(b.json.aproximados, undefined, k);
  }
});

test('7. nadie se llama así ni parecido: cero, y la orden de buscar por la otra pista sin [[no-pude]]', () => {
  const b = R.nadie as Buscado;
  assert.equal(b.json.encontrados, 0);
  assert.deepEqual(b.json.leads, []);
  assert.match(String(b.json.instruccion), /reuniones_recientes/);
  assert.match(String(b.json.instruccion), /no-pude/);
});

test('8. el prompt: un nombre que no aparece se busca por la otra pista, y [[no-pude]] no es para un dato que no existe', () => {
  const d = fuenteSinComentarios('lib/mako-doer-in.ts');
  const tools = d.slice(d.indexOf('const DOER_WA_TOOLS = `'), d.indexOf('`;', d.indexOf('const DOER_WA_TOOLS = `')));
  assert.match(tools, /UN NOMBRE QUE NO APARECE/);
  assert.match(tools, /aproximados/);
  assert.match(tools, /reuniones_recientes/);
  assert.match(tools, /campo_fecha=fecha_junta_1/);
  assert.match(tools, /DÍA Y HORA/);
  const consulta = d.slice(d.indexOf('const VOZ_DE_LA_CONSULTA = `'), d.indexOf('`;', d.indexOf('const VOZ_DE_LA_CONSULTA = `')));
  const pregunta = d.slice(d.indexOf('ESTE MENSAJE ES UNA PREGUNTA'), d.indexOf('${ticket}`', d.indexOf('ESTE MENSAJE ES UNA PREGUNTA')));
  for (const [nombre, t] of [['VOZ_DE_LA_CONSULTA', consulta], ['la clase pregunta', pregunta]] as const) {
    assert.match(t, /no es «no existe»/, `${nombre}: «no lo encontré escrito así» no es «no existe»`);
    assert.match(t, /\[\[no-pude/, `${nombre}: la marca sigue para lo que no se pudo mirar`);
  }
  assert.doesNotMatch(pregunta, /si no lo ves ahí, di en una línea que no lo sabes y marca \[\[no-pude/, 'ya no manda la marca sin probar');
  // Las dos descripciones dicen que vuelven aproximados sin contacto, y la del registro ya no dice «tal cual».
  const tdesc = fuenteSinComentarios('lib/mako-tools.ts');
  assert.match(tdesc.slice(tdesc.indexOf("name: 'buscar_leads'"), tdesc.indexOf("name: 'buscar_leads'") + 900), /aproximados/);
  const def = fuenteSinComentarios('lib/api-mako/areas/crm.def.ts');
  const defBuscar = def.slice(def.indexOf("id: 'buscar_leads'"), def.indexOf("id: 'ficha_lead'"));
  assert.match(defBuscar, /aproximados/);
  assert.doesNotMatch(defBuscar, /tal cual \(sensible a acentos\)/);
});

test('9. las aproximadas y las halladas por la fecha quedan como refs del turno: el «sí, ésa» siguiente sabe cuál es', async () => {
  const { referenciasDeLaSalida } = await import('../lib/doer-hilo');
  assert.deepEqual(referenciasDeLaSalida('buscar_leads', (R.casab as Buscado).crudo)?.items, [{ id: '6381', nombre: 'Carolina Cassab' }]);
  const porFecha = JSON.stringify([{ leadId: 6381, nombre: 'Carolina Cassab', empresa: null, reunion: 'R1', fecha: '2026-11-25', hora: '15:00' }]);
  assert.deepEqual(referenciasDeLaSalida('reuniones_recientes', porFecha)?.items, [{ id: '6381', nombre: 'Carolina Cassab' }], 'reuniones_recientes devuelve `leadId`');
});

// PROBADO ROMPIÉNDOLO (20/11/2026, base 9/0; contra el código de antes, 2/6: sólo pasaban el 3 y el 5, que cuidan lo de siempre):
//   R1  sin la pasada del CRM (`coincideBusqueda`)                          → 8/1 (6)
//   R2  los aproximados con teléfono y email                               → 7/2 (2, 4)
//   R3  sin pedir una palabra exacta                                       → 7/2 (1, 4)
//   R4  tolerancia con una sola palabra                                    → 8/1 (1) (la primera vez quedó verde: con una palabra NO
//       exacta ya la frena la regla de la exacta; lo que cuida es la sola palabra exacta, «Carolina» contra «Carolina Cassab»)
//   R5  tolerancia con dígitos o un email                                  → 8/1 (1)
//   R6  `casiIgual` contra una palabra del nombre de 3 letras              → 8/1 (1)
//   R7  el cero sin la orden de buscar por la otra pista                   → 8/1 (7)
//   R8  la hora de la reunión en UTC y no en la zona del negocio           → 8/1 (2)
//   R9  el prompt sin la regla «UN NOMBRE QUE NO APARECE»                  → 8/1 (8)
//   R10 las refs sin `leadId`                                              → 8/1 (9)
//   R11 sin la pasada tolerante                                            → 6/3 (2, 4, 9)
