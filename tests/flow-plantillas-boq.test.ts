// =============================================================================
// El respaldo acepta el Flow nuevo — y la llave es la OPERACIÓN, no el rpcid
// =============================================================================
// Hasta hoy `sanearPlantillas` descartaba el 100% de las plantillas de BOQ por dos
// condiciones del protocolo viejo. Lo aprendido vivía sólo en el perfil de Chrome:
// limpiarlo, o entrar desde otra máquina, costaba volver a pagar un clip.
//
// ⚠️ ABRIRLO NO ES AFLOJAR EL ALLOWLIST. En el protocolo viejo cada operación tenía
// su path, así que enumerar paths alcanzaba. En BOQ **todos** los pedidos van al
// mismo `/data/batchexecute` y lo único que los distingue es un `rpcids` que ROTA
// con cada bundle de Google. «Todo lo que empiece con boq:» sería un allowlist por
// descarte —prohibido acá— y además guardaría la telemetría de Google en la base.
//
// El criterio positivo que no envejece es el ROL: útil es lo que el navegador pudo
// atar a una operación del catálogo. Y ese rol es también la LLAVE, porque un
// respaldo keyeado por rpcid re-siembra ids muertos después de una rotación — y un
// respaldo que devuelve basura es peor que no tenerlo: nadie sospecha de él.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanearPlantillas, fundirPlantillas, faltantes, llaveDePlantilla,
  proyectoDePlantilla, soloDelProyecto,
  type PlantillaEspejo,
} from '../lib/flow-plantillas';

const BOQ = 'https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=YhhmEf';

/** Una plantilla de BOQ plausible, con lo que el navegador manda. */
function boq(extra: Record<string, unknown> = {}) {
  return {
    clase: 'boq:YhhmEf',
    url: BOQ,
    metodo: 'POST',
    headers: {},
    cuerpo: 'f.req=%5B%5D',
    op: 'generar_clip',
    sentinela: 'form',
    cuando: 10,
    ...extra,
  };
}

test('una plantilla de BOQ con su operación se guarda', () => {
  const out = sanearPlantillas([boq()]);
  assert.equal(out.length, 1, 'el Flow nuevo sigue rebotando');
  assert.equal(out[0].op, 'generar_clip');
  assert.equal(out[0].sentinela, 'form');
});

test('sin operación NO se guarda: es el allowlist positivo', () => {
  // La telemetría de Google comparte path con todo lo demás. Lo único que la deja
  // afuera es que nadie le pueda poner un rol.
  assert.deepEqual(sanearPlantillas([boq({ op: undefined })]), []);
  assert.deepEqual(sanearPlantillas([boq({ op: '' })]), []);
  assert.deepEqual(sanearPlantillas([boq({ op: 'telemetria' })]), []);
  assert.deepEqual(sanearPlantillas([boq({ op: 'enlace_clip' })]), [],
    'enlace_clip no pasa por el espejo: no tiene plantilla que guardar');
});

test('la FORMA de la clase se exige: es llave de un mapa', () => {
  for (const clase of ['boq:', 'boq:../x', 'boq:' + 'a'.repeat(40), 'batchexecute', 'boq:a']) {
    assert.deepEqual(
      sanearPlantillas([boq({ clase })]), [],
      `dejó pasar la clase ${JSON.stringify(clase)}`,
    );
  }
  // Un batch real trae varios rpcids separados por coma, y eso SÍ es válido.
  assert.equal(sanearPlantillas([boq({ clase: 'boq:YhhmEf,ngNC2' })]).length, 1);
});

test('una clase de BOQ tiene que venir del endpoint de BOQ', () => {
  // Sin esto, cualquier pedido de flow.google.com con un `op` puesto entraría.
  assert.deepEqual(sanearPlantillas([boq({ url: 'https://flow.google.com/otra/cosa' })]), []);
  assert.deepEqual(sanearPlantillas([boq({ url: 'https://flow.google.com/' })]), []);
});

test('la llave es la operación cuando la hay, y la clase cuando no', () => {
  assert.equal(llaveDePlantilla({ clase: 'boq:YhhmEf', op: 'generar_clip' } as PlantillaEspejo), 'op:generar_clip');
  assert.equal(llaveDePlantilla({ clase: 'credits' } as PlantillaEspejo), 'credits');
});

test('una rotación de rpcid NO duplica la plantilla', () => {
  // El caso que motiva todo: Google despliega un bundle nuevo, el rpcid cambia, y el
  // navegador manda la misma operación bajo otra clase. Con la clase como llave
  // quedaban dos entradas y el respaldo re-sembraba la muerta.
  const ayer = sanearPlantillas([boq({ clase: 'boq:YhhmEf', cuando: 1 })]);
  const hoy = sanearPlantillas([boq({ clase: 'boq:ZZZZZZ', cuando: 2 })]);
  const fundido = fundirPlantillas(ayer, hoy);
  assert.equal(fundido.length, 1, 'quedaron dos plantillas para la misma operación');
  assert.equal(fundido[0].clase, 'boq:ZZZZZZ', 'ganó la vieja');
});

test('al fundir, `op` y `sentinela` NO se pierden', () => {
  // Se descubren una vez y no cambian. Un pedido posterior que no los trae no puede
  // borrarlos — es el mismo defecto que ya se pagó en el navegador.
  const previa = sanearPlantillas([boq({ cuando: 1 })]);
  const nueva: PlantillaEspejo[] = [{
    clase: 'boq:YhhmEf', url: BOQ, metodo: 'POST', headers: {},
    cuerpo: 'f.req=%5B1%5D', op: 'generar_clip', cuando: 5,
  }];
  const out = fundirPlantillas(previa, nueva);
  assert.equal(out.length, 1);
  assert.equal(out[0].cuerpo, 'f.req=%5B1%5D', 'no ganó la más nueva');
  assert.equal(out[0].sentinela, 'form', 'la sentinela se perdió al fundir');
});

test('`faltantes` no devuelve una operación que el navegador ya tiene', () => {
  const guardadas = sanearPlantillas([boq({ clase: 'boq:VIEJO' })]);
  // El navegador tiene la misma operación, pero bajo el rpcid de hoy.
  assert.deepEqual(
    faltantes(guardadas, ['boq:NUEVO'], ['generar_clip']), [],
    'le devolvería una plantilla muerta para una operación que ya sabe',
  );
  // Y si de verdad no la tiene, sí la manda.
  assert.equal(faltantes(guardadas, ['boq:NUEVO'], ['creditos']).length, 1);
  // Sin la lista de ops —una extensión vieja— se degrada al comportamiento anterior.
  assert.equal(faltantes(guardadas, ['boq:NUEVO']).length, 1);
});

test('el projectId de BOQ se lee del `source-path`, y el guard entre clientes vuelve a aplicar', () => {
  // ⚠️ ESTA GUARDA ESTABA MUERTA PARA EL FLOW NUEVO, y abrir el allowlist la volvía
  // urgente. `proyectoDePlantilla` buscaba `/projects/` (plural) en el path o un
  // cuerpo JSON; en BOQ el id viaja en el query como `source-path=/project/<uuid>` y
  // el cuerpo es form-urlencoded. O sea que devolvía '' siempre, y `soloDelProyecto`
  // dejaba pasar por abstención.
  //
  // Eso importa porque el respaldo de plantillas del navegador es UNA clave global:
  // un navegador emparejado antes con otro cliente manda plantillas con el projectId
  // de aquél, con el cuerpo de SU generación adentro.
  const MIO = '9973383e-74eb-4503-80f3-d30fb856781a';
  const OTRO = '11111111-2222-3333-4444-555555555555';
  const conProyecto = (id: string) => boq({
    url: `${BOQ}&source-path=%2Fproject%2F${id}`,
  }) as unknown as PlantillaEspejo;

  assert.equal(proyectoDePlantilla(conProyecto(MIO)), MIO, 'no lee el source-path escapado');
  assert.equal(
    proyectoDePlantilla({ ...conProyecto(MIO), url: `${BOQ}&source-path=/project/${MIO}` }),
    MIO, 'no lee el source-path sin escapar',
  );

  assert.equal(soloDelProyecto([conProyecto(OTRO)], MIO).ajenas.length, 1,
    'guardaría una plantilla aprendida con OTRO cliente');
  assert.equal(soloDelProyecto([conProyecto(MIO)], MIO).quedan.length, 1,
    'descarta las propias');
  // Y sin el dato se ABSTIENE: no saber de quién es no autoriza a tirarla.
  assert.equal(soloDelProyecto([boq() as unknown as PlantillaEspejo], OTRO).quedan.length, 1);
});

test('el protocolo viejo sigue entrando igual', () => {
  // La rama nueva no puede haber roto la que funcionaba.
  const out = sanearPlantillas([{
    clase: 'credits',
    url: 'https://aisandbox-pa.googleapis.com/v1/credits',
    metodo: 'POST', headers: {}, cuerpo: null, cuando: 1,
  }]);
  assert.equal(out.length, 1);
});
