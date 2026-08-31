// =============================================================================
// Una plantilla de Flow no puede terminar guardada en el workspace de otro
// =============================================================================
// El defecto, encontrado auditando el aislamiento entre clientes:
//
// El respaldo de plantillas de la extensión vive en `chrome.storage.local` bajo
// UNA clave global —`plantillas`—, sin token ni workspace adentro. Emparejar el
// mismo navegador con otro cliente pisa el `token` y NO toca ese respaldo, así
// que el latido siguiente sube al workspace nuevo lo aprendido con el anterior:
// el projectId de Flow de aquel cliente, el cuerpo de su generación y el mediaId
// de su cara. El server lo persistía sin mirar procedencia, y en el latido
// siguiente se lo bajaba al navegador real de ese otro cliente como «faltantes».
//
// Es el caso normal del super-admin, que abre un cliente por pestaña. Nadie gana
// un permiso que no tenía —el que empareja está autorizado en los dos, y el
// Google que paga es siempre el del navegador que apretó Conectar—, pero los
// datos de un cliente quedan PERSISTIDOS en la fila de otro.
//
// El arreglo de raíz es de la extensión. Esto es el lado del server, que es el
// que no depende de que el cliente actualice.

import test from 'node:test';
import assert from 'node:assert/strict';
import { proyectoDePlantilla, soloDelProyecto } from '../lib/flow-plantillas';

const MIO = '9973383e-74eb-4503-80f3-d30fb856781a';
const AJENO = '1f234160-bb33-4fbd-896a-4e1f88179d00';

const enUrl = (proj: string) => ({
  clase: 'flowMedia:batchGenerateImages',
  url: `https://aisandbox-pa.googleapis.com/v1/projects/${proj}/flowMedia:batchGenerateImages`,
  metodo: 'POST', headers: {}, cuerpo: null, cuando: 1,
});
const enCuerpo = (proj: string) => ({
  clase: 'video:batchAsyncGenerateVideoReferenceImages',
  url: 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoReferenceImages',
  metodo: 'POST', headers: {},
  cuerpo: JSON.stringify({ clientContext: { projectId: proj } }),
  cuando: 1,
});
const sinProyecto = {
  clase: 'credits',
  url: 'https://aisandbox-pa.googleapis.com/v1/credits?key=AIza',
  metodo: 'GET', headers: {}, cuerpo: null, cuando: 1,
};

// ── De dónde sale el proyecto ───────────────────────────────────────────────

test('el projectId sale del PATH de la url', () => {
  // Medido contra la plantilla real guardada en producción.
  assert.equal(proyectoDePlantilla(enUrl(MIO)), MIO);
});

test('y cuando no está en la url, del clientContext del cuerpo', () => {
  // Las de video no lo llevan en el path: si sólo se mirara la url, la mitad de
  // las plantillas serían inverificables y pasarían todas.
  assert.equal(proyectoDePlantilla(enCuerpo(AJENO)), AJENO);
});

test('sin proyecto en ningún lado devuelve vacío, no basura', () => {
  assert.equal(proyectoDePlantilla(sinProyecto), '');
  assert.equal(proyectoDePlantilla({ ...sinProyecto, cuerpo: 'no soy json' }), '');
});

// ── Qué se descarta ─────────────────────────────────────────────────────────

test('la plantilla de OTRO proyecto no se guarda', () => {
  const r = soloDelProyecto([enUrl(MIO), enUrl(AJENO)], MIO);
  assert.deepEqual(r.quedan.map(proyectoDePlantilla), [MIO]);
  assert.equal(r.ajenas.length, 1, 'y se devuelve, para poder registrarla');
});

test('lo que no se puede PROBAR ajeno pasa', () => {
  // `credits` y `uploadImage` no llevan proyecto. Tirarlas sería castigar la
  // falta de evidencia, y son las que hacen andar el saldo y la subida de fotos.
  const r = soloDelProyecto([sinProyecto], MIO);
  assert.equal(r.quedan.length, 1);
  assert.equal(r.ajenas.length, 0);
});

test('sin proyecto del lado del puente NO se filtra nada', () => {
  // Un navegador que todavía no abrió un proyecto de Flow reporta vacío. Sin la
  // mitad de la comparación no hay comparación — y filtrar ahí dejaría a todo
  // cliente nuevo sin poder aprender nada.
  const ps = [enUrl(MIO), enUrl(AJENO)];
  assert.equal(soloDelProyecto(ps, '').quedan.length, 2);
  assert.equal(soloDelProyecto(ps, 'no-es-un-uuid').quedan.length, 2);
});

test('el proyecto se compara sin distinguir mayúsculas', () => {
  // Un uuid es el mismo escrito de las dos formas; rechazar por eso sería
  // borrarle a un cliente sus propias plantillas.
  assert.equal(soloDelProyecto([enUrl(MIO.toUpperCase())], MIO).ajenas.length, 0);
});

test('el caso completo: el respaldo mezclado sube sólo lo propio', () => {
  // Lo que de verdad llega en el latido después de cambiar de cliente: unas
  // aprendidas acá, otras arrastradas del workspace anterior, y las neutras.
  const mezcla = [enUrl(MIO), enCuerpo(AJENO), sinProyecto, enUrl(AJENO)];
  const r = soloDelProyecto(mezcla, MIO);
  assert.equal(r.quedan.length, 2, 'la propia y la neutra');
  assert.equal(r.ajenas.length, 2, 'las dos del otro cliente');
  assert.ok(r.ajenas.every((p) => proyectoDePlantilla(p) === AJENO));
});
