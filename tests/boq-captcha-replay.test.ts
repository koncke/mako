// =============================================================================
// El primer pedido real por BOQ: lo que Google contestó, y lo que faltaba
// =============================================================================
// ⚠️ MEDIDO el 06/09/2026, primera imagen por el replay nuevo, en la pantalla del
// cliente durante una reunión:
//
//   ["wrb.fr","ogiZ0b",null,null,null,[7,null,[["type.googleapis.com/google.rpc.ErrorInfo",
//     ["PUBLIC_ERROR_UNUSUAL_ACTIVITY"]]]],"generic"]
//
// Código 7 (PERMISSION_DENIED): la protección anti-abuso rechazó el pedido. La causa:
// el cuerpo llevaba el token de reCAPTCHA de cuando la persona ENSEÑÓ la frase, y un
// token es de un solo uso y ata la acción. Tres cosas faltaban, y las tres se fijan:
//
//   ① el lector decía «sin resultado» sobre un error que estaba escrito a la vista;
//   ② el replay no acuñaba un token fresco ni lo reponía en el cuerpo;
//   ③ `boq:WuwhI` —intermedio, también con la frase— podía ganarle a `YhhmEf`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { leerRespuestaBoq } from '../lib/flow-boq-respuesta';
import { reponerCaptcha, FORMA_TOKEN_CAPTCHA, codificar } from '../lib/flow-boq-patch';
import { elegirPlantilla } from '../lib/flow-puede-filmar';
import { OPERACIONES, A_PEDIR } from '../lib/flow-operaciones';
import { seGuardaLaRespuesta } from '../lib/flow-plantillas';

const raiz = resolve(import.meta.dirname, '..');
const vivo = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const worker = vivo(readFileSync(resolve(raiz, 'extension', 'background.js'), 'utf8'));

// La respuesta REAL, tal cual la guardó el espejo.
const RECHAZO = `)]}'\n\n192\n[["wrb.fr","ogiZ0b",null,null,null,[7,null,[["type.googleapis.com/google.rpc.ErrorInfo",["PUBLIC_ERROR_UNUSUAL_ACTIVITY"]]]],"generic"],["di",114],["af.httprm",114,"-4274164431364800754",6]]\n25\n[["e",4,null,null,228]]`;

test('① el error por RPC (payload nulo) se lee como error de Google, con código y motivo', () => {
  const r = leerRespuestaBoq(RECHAZO, 'ogiZ0b');
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, 'ERROR_DE_GOOGLE', 'se leía como SIN_FRAME: «no trae ningún resultado»');
  assert.match(!r.ok ? r.detalle : '', /codigo 7/);
  assert.match(!r.ok ? r.detalle : '', /PUBLIC_ERROR_UNUSUAL_ACTIVITY/);
});

test('① y un frame bueno de verdad sigue siendo éxito', () => {
  // La respuesta real de créditos, para que la rama nueva no se coma a la buena.
  const ok = `)]}'\n\n123\n[["wrb.fr","nzlxg","[791,3,4,1,null,791]",null,null,null,"generic"],["di",257],["af.httprm",257,"8111018560183783157",7]]`;
  const r = leerRespuestaBoq(ok, 'nzlxg');
  assert.equal(r.ok, true);
  assert.ok(r.ok && r.payload.includes('791'));
});

/** Un token con la forma medida: `0cAFcWe…`, ~2.500 chars de [A-Za-z0-9_-]. */
const token = (semilla: string) => '0cAFcWe' + semilla.repeat(300).slice(0, 2480).replace(/[^A-Za-z0-9_-]/g, 'x');

test('② reponerCaptcha reemplaza TODAS las apariciones del token, en cualquier codificación', () => {
  const viejo = token('A5wN-Yx');
  const nuevo = token('Q9kZ_Lm');
  // El cuerpo de imagen real trae el token DOS veces (dos pedidos en el batch).
  const frase = 'una esfera naranja flotando sobre nieve mako4d1c8b';
  const cuerpo = `f.req=%5B%5B%5B%22ogiZ0b%22%2C%22${codificar(frase, 'json2+form')}%22%5D%5D%5D%2C%5B%22${viejo}%22%5D%2C%5B%22${viejo}%22%5D&at=__MAKO_AT__`;
  const r = reponerCaptcha(cuerpo, nuevo);
  assert.equal(r.cuantos, 2);
  assert.ok(!r.cuerpo.includes(viejo));
  assert.equal(r.cuerpo.split(nuevo).length - 1, 2);
  // Y la frase y el hueco del `at` quedan intactos: el reemplazo es quirúrgico.
  assert.ok(r.cuerpo.includes('__MAKO_AT__'));
  assert.ok(r.cuerpo.includes(codificar(frase, 'json2+form')!));
});

test('② sin token en el cuerpo, no se inventa nada', () => {
  const r = reponerCaptcha('f.req=%5B%5D&at=__MAKO_AT__', token('Zz'));
  assert.equal(r.cuantos, 0);
  assert.equal(r.cuerpo, 'f.req=%5B%5D&at=__MAKO_AT__');
  // Y la forma no agarra la sentinela ni ids cortos.
  assert.ok(!FORMA_TOKEN_CAPTCHA.test('mako7f3a9c 9973383e-74eb-4503-80f3-d30fb856781a'));
});

test('② el replay acuña con la acción MEDIDA y repone antes de mandar', () => {
  assert.match(worker, /const rc = reponerCaptcha\(r\.cuerpo, token\);/, 'el replay no repone el token');
  assert.match(worker, /tipo: 'BOQ_PEDIDO', url: pl\.url, cuerpo: cuerpoFinal,/, 'el replay manda el cuerpo sin el token nuevo');
  assert.match(worker, /pedirCaptcha\(tab\.id, accion, !!ACCION_CAPTCHA\[op\]\)/, 'no acuña con la tabla medida del bundle');
  // Y las dos operaciones que cobran son las que piden captcha, según el catálogo.
  for (const o of OPERACIONES) {
    assert.equal(o.captcha, o.cuesta, `${o.op}: captcha (${o.captcha}) y cuesta (${o.cuesta}) tendrían que ir juntos`);
  }
});

test('② el fallo de Google NO pasa por la clasificación que marca la sesión', () => {
  assert.match(worker, /error: explicarFalloBoq\(r\),/);
  assert.match(worker, /UNUSUAL_ACTIVITY.*Google rechazó el pedido por seguridad/);
  // La rama BOQ no manda `status`: así el route no cae en `clasificarFalla`, que con
  // este motivo pausaría el puente entero por un token viejo nuestro.
  const i = worker.indexOf('const r = await repetirEnBoq(cat.op, prompt);');
  const bloque = worker.slice(i, i + 900);
  assert.ok(!/status:/.test(bloque), 'la rama BOQ manda `status` y el server la clasificaría como sesión marcada');
});

test('③ entre dos plantillas usables, gana la del rpcid que se vio generar', () => {
  const CLIP = A_PEDIR.find((o) => o.op === 'generar_clip')!;
  const cuerpo = `f.req=%5B%22${codificar(CLIP.frase!, 'form')}%22%5D&at=__MAKO_AT__`;
  const pl = {
    'boq:YhhmEf': { op: 'generar_clip', cuerpo, url: 'u', cuando: 1 },
    'boq:WuwhI': { op: 'generar_clip', cuerpo, url: 'u', cuando: 2 }, // más nueva, intermedia
  };
  assert.equal(elegirPlantilla(pl, CLIP).clase, 'boq:YhhmEf', 'eligió el pedido intermedio: se repetiría el RPC equivocado');
  // Si el id rotó y ninguna coincide, la más nueva, como antes.
  const rotado = { 'boq:AAAA': { ...pl['boq:YhhmEf'], cuando: 1 }, 'boq:BBBB': { ...pl['boq:WuwhI'], cuando: 2 } };
  assert.equal(elegirPlantilla(rotado, CLIP).clase, 'boq:BBBB');
  // Y la preferencia NUNCA reconoce: sin ancla, el rpcid preferido no habilita nada.
  const sinAncla = { 'boq:YhhmEf': { op: 'generar_clip', cuerpo: 'f.req=x&at=__MAKO_AT__', url: 'u', cuando: 1 } };
  assert.equal(elegirPlantilla(sinAncla, CLIP).clase, '');
});

test('③ los rpcids preferidos viven en su campo, y las que cobran siguen sin `rpcids`', () => {
  for (const o of OPERACIONES) {
    if (o.cuesta) assert.deepEqual([...o.rpcids], [], `${o.op} cobra y tiene rpcids: eso reconocería por un id que rota`);
  }
  assert.deepEqual([...OPERACIONES.find((o) => o.op === 'generar_clip')!.rpcidsPreferidos], ['YhhmEf']);
  assert.deepEqual([...OPERACIONES.find((o) => o.op === 'generar_imagen')!.rpcidsPreferidos], ['ogiZ0b']);
});

test('las respuestas por `op:<op>:<rpcid>` se guardan, y sólo para operaciones del catálogo', () => {
  assert.equal(seGuardaLaRespuesta('op:generar_clip:YhhmEf'), true);
  assert.equal(seGuardaLaRespuesta('op:generar_imagen:ogiZ0b'), true);
  assert.equal(seGuardaLaRespuesta('op:inventada:YhhmEf'), false);
  assert.equal(seGuardaLaRespuesta('op:generar_clip:../x'), false);
  assert.match(worker, /respuestasVistas\['op:' \+ op \+ ':' \+ rpcid\] = texto;/);
});
