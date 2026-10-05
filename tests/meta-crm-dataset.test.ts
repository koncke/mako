// =============================================================================
// El conjunto de datos de CRM: un campo nuevo que NO puede desconectar a nadie
// =============================================================================
// Martín, el 05/10/2026: «explicame qué es el dataset, si ya tenemos un tutorial en
// integraciones de cómo el usuario lo debe configurar». No lo teníamos: Meta tenía
// seis ayudas de campo y ninguna nombraba el conjunto de datos de CRM, que es lo
// único de Meta sin endpoint (ver docs/hallazgos-ads.md, 05/10).
//
// Lo que fija este test son las dos formas de romperlo, que no se ven compilando:
//
//   1. MARCARLO REQUERIDO. `opcional` lo leen los TRES lectores de «está
//      conectado» (lib/credenciales.ts, lib/metodo-verificar.ts,
//      app/api/metodo/route.ts). Un campo nuevo sin `opcional: true` deja «no
//      conectado» a Meta Ads en todos los workspaces que hoy funcionan, sin que
//      nadie toque una credencial. Ya pasó una vez.
//   2. INVERTIR EL DESTINO. Si `destinoCAPI` prefiriera el píxel, el conjunto de
//      datos quedaría cargado y mudo; y si cortara el envío cuando no hay conjunto
//      de datos, apagaría las conversiones que HOY entran (ningún workspace lo
//      tiene). El orden es: CRM si existe, píxel si no, nunca nada.
//
// La ficha se lee del FUENTE y no se importa: `lib/metodo-catalogo.ts` tiene
// `import 'server-only'` y bajo tsx no se puede importar (ver tests/elevenlabs-voz).
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CUSTOM_DATA_CRM, destinoCAPI } from '../lib/meta-capi-payload';

const FUENTE = readFileSync(new URL('../lib/metodo-catalogo.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const CAPI = readFileSync(new URL('../lib/meta-capi.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** La línea del campo en el catálogo, tal como está escrita. */
function lineaDelCampo(env: string): string {
  const l = FUENTE.split('\n').find((x) => x.includes(`{ env: '${env}'`));
  assert.ok(l, `el campo ${env} salió del catálogo`);
  return l;
}

test('el campo del conjunto de datos de CRM existe y es OPCIONAL', () => {
  const l = lineaDelCampo('META_CRM_DATASET_ID');
  assert.match(l, /opcional: true/, 'META_CRM_DATASET_ID sin `opcional: true` deja «no conectado» a Meta Ads en todo workspace que hoy funciona');
  // No es `auto`: Meta no tiene endpoint para crear el conjunto de datos, así que
  // prometer «lo completa MaKo» es prometer algo que nunca llega.
  assert.doesNotMatch(l, /auto: true/, 'no puede ser `auto`: no hay endpoint que lo cree');
});

test('ningún campo de Meta se volvió requerido de más', () => {
  // Lo único que Meta necesita para figurar conectado: el token que se pega, y el id
  // de cuenta publicitaria, que el token completa solo (`auto`, pero NO opcional —
  // sin cuenta no hay nada que leer). Los otros cinco son opcionales.
  const requeridos = ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_PAGE_ACCESS_TOKEN', 'META_PIXEL_ID', 'META_CAPI_TOKEN', 'META_PAGE_ID', 'META_CRM_DATASET_ID']
    .filter((e) => !/opcional: true/.test(lineaDelCampo(e)));
  assert.deepEqual(requeridos, ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'], 'cambió quién figura «conectado» en Meta Ads');
});

test('el campo tiene su propia ayuda, y arranca por el para qué', () => {
  const zona = FUENTE.slice(FUENTE.indexOf('AYUDA_CAMPO'), FUENTE.indexOf('export function ayudaDeCampo'));
  const m = /^ {2}META_CRM_DATASET_ID:\s*\{\s*\n\s*pasos: \[\s*\n\s*'([^']+)/m.exec(zona);
  assert.ok(m, 'sin entrada en AYUDA_CAMPO el "?" de este campo abre el tutorial ENTERO de Meta, y el de los otros seis deja de contestar lo suyo');
  assert.match(m[1], /^Para qué sirve/, 'la ayuda de campo abre diciendo para qué sirve, no cómo se hace');
  // Los pasos nombran la pantalla de HOY de Meta (doc leída el 05/10/2026). Si Meta
  // la renombra, esto grita y manda a releer la doc en vez de a adivinar.
  for (const rotulo of ['Conectar orígenes de datos', 'Administrador de eventos', 'Clientes potenciales de conversión']) {
    assert.ok(zona.includes(rotulo), `el tutorial dejó de nombrar «${rotulo}»`);
  }
});

test('el destino es el conjunto de datos de CRM si existe, y el píxel si no', () => {
  assert.deepEqual(destinoCAPI('111', '999'), { id: '111', esCrm: true }, 'el conjunto de datos de CRM gana');
  assert.deepEqual(destinoCAPI(null, '999'), { id: '999', esCrm: false }, 'sin conjunto de datos sigue entrando por el píxel');
  assert.equal(destinoCAPI(null, null), null);
});

test('el centinela PENDING no es un destino', () => {
  // `credWs` devuelve `PENDING…` para una credencial dada de alta y sin cargar. Un
  // `??` lo tomaría por un id bueno y mandaría los eventos a la nada.
  assert.deepEqual(destinoCAPI('PENDING_CARGA', '999'), { id: '999', esCrm: false });
  assert.deepEqual(destinoCAPI('   ', '999'), { id: '999', esCrm: false });
  assert.equal(destinoCAPI('PENDING_CARGA', ''), null);
});

test('los campos que Meta exige solo para CRM no viajan al píxel del sitio', () => {
  assert.deepEqual(CUSTOM_DATA_CRM, { event_source: 'crm', lead_event_source: 'MaKo' });
  // La doc es explícita: «Refrain from using this payload specification for other
  // event types, such as website leads». Por eso el spread va condicionado.
  assert.match(CAPI, /destino\.esCrm \? CUSTOM_DATA_CRM : \{\}/, 'los campos de CRM dejaron de estar condicionados al destino');
  // Y el llamador gana: su customData se spreadea DESPUÉS.
  assert.match(CAPI, /CUSTOM_DATA_CRM : \{\}\),\s*\.\.\.params\.customData/, 'el customData del llamador tiene que poder pisar lo de CRM');
  assert.match(CAPI, /\$\{destino\.id\}\/events/, 'el POST volvió a ir a un id fijo en vez del destino elegido');
});
