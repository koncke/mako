// =============================================================================
// Un navegador NUEVO del mismo workspace filma sin que la persona toque Flow
// =============================================================================
// El dueño (06/09/2026): «ahora lo hará Mauricio desde su PC, y no quiero que tenga
// que hacer nada en flow». Lo que lo impedía, medido:
//
// ① `plantillasFaltantes = clasesQueTiene.length ? … : []` — un navegador nuevo manda
//    `clases: []`, y `[].length === 0` se leía como «no mandó»: no recibía NADA.
// ② El `projectId` sólo se aprendía del protocolo viejo (`/v1/projects/<id>/`): un
//    Chrome que empieza en flow.google.com no lo sabía nunca, «Empezar» abría la
//    portada, y el popup pedía entrar a un proyecto a mano.
// ③ El respaldo estaba VACÍO de BOQ (url relativa descartada sin ruido) y el
//    navegador que sí sabía no reenviaba: su firma no cambia por una url.
// ④ El espejo de la pestaña sobrevive a la actualización (manifest 0.64.0, espejo
//    0.63.0) y nadie lo decía: las protecciones nuevas no corrían con el popup en verde.
// ⑤ Ninguna respuesta de BOQ se persistía (allowlist por clase, y la clase rota), así
//    que la forma del payload —el último eslabón— no se podía medir sin otro crédito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  queSembrar, opsSinRespaldo, seGuardaLaRespuesta, sanearPlantillas, type PlantillaEspejo,
} from '../lib/flow-plantillas';
import { codificar } from '../lib/flow-boq-patch';
import { A_PEDIR } from '../lib/flow-operaciones';

const raiz = resolve(import.meta.dirname, '..');
const leer = (...p: string[]) => readFileSync(resolve(raiz, ...p), 'utf8');
const vivo = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const worker = vivo(leer('extension', 'background.js'));
const popup = vivo(leer('extension', 'popup.js'));
const route = vivo(leer('app', 'api', 'flow', 'puente', 'route.ts'));
const cola = vivo(leer('lib', 'flow-cola.ts'));

const CLIP = A_PEDIR.find((o) => o.op === 'generar_clip')!;
const BOQ = 'https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=YhhmEf';
const conAncla = () => `f.req=%5B%5B%22${codificar(CLIP.frase!, 'form')}%22%5D%5D&at=__MAKO_AT__`;
const plantilla = (extra: Partial<PlantillaEspejo> = {}): PlantillaEspejo => ({
  clase: 'boq:YhhmEf', url: BOQ, metodo: 'POST', headers: {},
  cuerpo: conAncla(), op: 'generar_clip', sentinela: 'form', cuando: 10, ...extra,
});

test('① un navegador que manda CERO clases recibe TODO el respaldo', () => {
  const respaldo = [plantilla()];
  assert.equal(queSembrar(respaldo, [], []).length, 1, 'al navegador nuevo no se le siembra nada');
  // Y la extensión vieja, que no manda el campo, sigue sin recibir: no se decide por ella.
  assert.equal(queSembrar(respaldo, undefined, undefined).length, 0);
  // Y el que ya lo tiene por rol no lo recibe de vuelta.
  assert.equal(queSembrar(respaldo, ['boq:OTRO'], ['generar_clip']).length, 0);
});

test('② el worker abre el proyecto que el SERVER conoce cuando el suyo no lo sabe', () => {
  assert.match(worker, /async function proyectoConocido\(\)/, 'desapareció `proyectoConocido`');
  assert.match(worker, /\['projectId', 'projectIdServidor'\]/, 'ya no cae al proyecto del server');
  assert.match(worker, /projectIdServidor: String\(out\.projectId\)/, 'el worker no guarda el proyecto que manda el server');
  assert.match(route, /\.\.\.\(projectIdGuardado \? \{ projectId: projectIdGuardado \} : \{\}\)/, 'el route no devuelve el proyecto');
  // Los tres caminos que abren Flow van al proyecto, no a la portada.
  const portadas = [...worker.matchAll(/chrome\.tabs\.create\(\{ url: URL_FLOW, active: true \}\)/g)];
  assert.equal(portadas.length, 0, 'un camino vuelve a abrir la PORTADA de Flow: la persona tiene que buscar el proyecto');
  assert.match(worker, /const guardado = await proyectoConocido\(\);/);
  // Y lo aprende de la url de la pestaña, que es donde vive en el Flow nuevo.
  assert.match(worker, /\/project\\\/\(\[0-9a-f-\]\{36\}\)\/i\.exec\(tfl\.url/);
});

test('③ una url RELATIVA de BOQ se acepta, y el server pide reenvío cuando falta con ancla', () => {
  const desc: string[] = [];
  const out = sanearPlantillas([plantilla({ url: '/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=YhhmEf&source-path=%2Fproject%2F9973383e-74eb-4503-80f3-d30fb856781a' })], desc);
  assert.equal(out.length, 1, 'la plantilla de generación con url relativa se sigue descartando');
  assert.match(out[0].url, /^https:\/\/flow\.google\.com\/_\//);
  assert.deepEqual(desc, []);
  // Una relativa de OTRA forma no se inventa un origen.
  assert.equal(sanearPlantillas([plantilla({ url: 'batchexecute?rpcids=YhhmEf' })]).length, 0);

  // El pedido de reenvío: el navegador sabe generar_clip, el respaldo no lo tiene con ancla.
  assert.deepEqual(opsSinRespaldo([], ['generar_clip']), ['generar_clip']);
  assert.deepEqual(opsSinRespaldo([plantilla()], ['generar_clip']), []);
  assert.deepEqual(opsSinRespaldo([plantilla({ cuerpo: 'f.req=x&at=__MAKO_AT__' })], ['generar_clip']), ['generar_clip'], 'una plantilla sin ancla cuenta como respaldada');
  assert.deepEqual(opsSinRespaldo([], []), [], 'no se pide lo que el navegador no sabe');
  assert.match(worker, /if \(out\.pedirPlantillas\) await chrome\.storage\.local\.remove\('firmaPlantillas'\);/);
  assert.match(route, /const pedirPlantillas = opsSinRespaldo\(guardadas, opsQueTiene\)\.length > 0;/);
});

test('④ el popup pide recargar Flow cuando el espejo quedó viejo, ANTES de decir que puede', () => {
  assert.match(worker, /espejoViejo = !!e && e !== chrome\.runtime\.getManifest\(\)\.version;/);
  const i = popup.indexOf('if (v.espejoViejo)');
  const j = popup.indexOf('if (v.siguiente)');
  assert.ok(i > 0, 'el popup no mira `espejoViejo`');
  assert.ok(i < j, 'la recarga tiene que ofrecerse ANTES de la pantalla de «ya puede»');
  assert.match(popup.slice(i, i + 400), /accion: recargarFlow/);
});

test('⑤ las respuestas de BOQ se guardan por OPERACIÓN, no por clase', () => {
  assert.equal(seGuardaLaRespuesta('op:generar_clip'), true);
  assert.equal(seGuardaLaRespuesta('op:estado_clips'), true);
  assert.equal(seGuardaLaRespuesta('op:enlace_clip'), false, 'una op que no se enseña ni se repite no se guarda');
  assert.equal(seGuardaLaRespuesta('boq:YhhmEf'), false, 'por clase no: el rpcid rota');
  assert.match(worker, /respuestasVistas\['op:' \+ op\] = texto;/, 'el worker no re-etiqueta por op');
  assert.match(route, /k\.startsWith\('op:'\) \? 12000/, 'una respuesta de operación no entra en 1400');
});

test('con `listo`, el detalle viejo se borra', () => {
  assert.match(cola, /estado === 'listo' \? \{ estado_detalle: '' \}/,
    'un `listo` volvería a convivir con un SIN_ANCLA de hace una hora');
});
