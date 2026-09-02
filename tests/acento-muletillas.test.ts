import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACENTOS_ES, MULETILLAS, resolverAcento, type AcentoId,
} from '../lib/acento-workspace';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';

// =============================================================================
// Cómo habla el avatar del cliente — el acento DECLARADO y sus muletillas
// =============================================================================
// Todo esto falla en silencio. El guion sale en un español correcto igual, y que
// la variedad no sea la suya se descubre cuando alguien lo dice en voz alta, con
// el clip pagado. Por eso el módulo no tiene `server-only`: es lo único que se
// puede probar sin gastar una llamada.

const IDS = Object.keys(ACENTOS_ES) as AcentoId[];

test('toda variedad tiene sus muletillas', () => {
  // Sin entrada, el paso del onboarding muestra una grilla vacía y no hay forma
  // de contestarlo — y `armar` haría `MULETILLAS[id].includes` sobre undefined.
  for (const id of IDS) {
    assert.ok(Array.isArray(MULETILLAS[id]) && MULETILLAS[id].length >= 4, `${id} sin muletillas`);
  }
});

test('el acento DECLARADO le gana a la zona horaria', () => {
  // Es el punto entero del onboarding: hasta que existió, los dos llamadores
  // pasaban `declarado = null` y no había forma de corregir la inferencia.
  const r = resolverAcento('mx-cdmx', 'America/Tijuana');
  assert.equal(r.id, 'mx-cdmx');
  assert.equal(r.origen, 'declarado');
  assert.equal(r.seguro, true);
});

test('sin declarar, sale de la zona horaria y se marca como inseguro', () => {
  const r = resolverAcento(null, 'America/Tijuana');
  assert.equal(r.id, 'mx-norte');
  assert.equal(r.origen, 'zona-horaria');
  assert.equal(r.seguro, false, 'una inferencia presentada como declarada es cómo se cuela un error que nadie audita');
});

test('un acento declarado que ya no existe no gana: cae a la inferencia', () => {
  const r = resolverAcento('mx-yucatan-inventado', 'America/Bogota');
  assert.equal(r.id, 'co');
  assert.equal(r.seguro, false);
});

test('las muletillas viajan PEGADAS al acento, no por un slot nuevo', () => {
  // ⚠️ Va así a propósito: `renderTemplate` deja literales los slots que no
  // conoce, así que un `{{muletillas}}` nuevo llegaría CRUDO a todo workspace
  // con el prompt editado a mano — el mismo modo de falla que dejó «{{acento}}»
  // sin llenar durante meses.
  const r = resolverAcento('mx-norte', null, ['pues', 'la neta']);
  assert.match(r.prompt, /Northern Mexican Spanish/);
  assert.match(r.prompt, /"pues"/);
  assert.match(r.prompt, /"la neta"/);
});

test('el prompt NO dice cuántas veces usarlas', () => {
  // El repo ya se equivocó repartiendo muletillas por densidad y el cliente lo
  // marcó al instante: «exageraste el uso del pues, lo pusiste en lugares que no
  // tienen sentido». Un número acá reproduce ese error.
  const r = resolverAcento('mx-cdmx', null, ['neta']);
  assert.doesNotMatch(r.prompt, /\d/, 'el prompt de muletillas trae un número');
  assert.match(r.prompt, /naturally/);
});

test('sin muletillas marcadas, el prompt es el acento pelado', () => {
  // Hay gente que habla limpio, y el paso se puede cerrar vacío. La cadena no
  // puede quedar hablando de una lista que no existe.
  const r = resolverAcento('latam', null, []);
  assert.equal(r.prompt, ACENTOS_ES.latam);
  assert.deepEqual(r.muletillas, []);
});

test('una muletilla de OTRA variedad no viaja', () => {
  // Pasa al cambiar de acento con muletillas ya guardadas. «Órale» en un guion
  // colombiano no se ve al leer: se oye, y suena a que el avatar cambió de
  // nacionalidad a mitad del anuncio.
  const r = resolverAcento('co', null, ['pues', 'órale', 'vale']);
  assert.deepEqual(r.muletillas, ['pues']);
  assert.doesNotMatch(r.prompt, /órale/);
  assert.doesNotMatch(r.prompt, /vale/);
});

test('las muletillas se filtran también cuando el acento es INFERIDO', () => {
  // El filtro vive en `armar`, así que cubre los tres orígenes. Si viviera solo
  // en la rama de «declarado», un cliente sin acento elegido mandaría al modelo
  // la lista entera sin filtrar.
  const r = resolverAcento(null, 'America/Bogota', ['órale']);
  assert.equal(r.id, 'co');
  assert.deepEqual(r.muletillas, []);
});

// ── El onboarding de la tab ────────────────────────────────────────────────

test('la tab del generador de video tiene su onboarding', () => {
  const def = TAB_ONBOARDINGS['video-generator'];
  assert.ok(def, 'toda tab tiene onboarding: es la regla del producto');
  assert.equal(def.key, 'video-generator', 'la key tiene que ser la del nav o el gate no encuentra la tab');
});

test('todos sus pasos van con prefijo `vg_`', () => {
  // ⚠️ `contexto`/`ensayo` pelados COLISIONAN vía el registro compartido de pasos
  // con el Chat Agent y con Instagram: terminar el ensayo acá marcaría «Ensayo de
  // conversación» del Chat Agent como hecho. Es un gotcha ya documentado en el
  // catálogo y ya cometido dos veces.
  for (const p of TAB_ONBOARDINGS['video-generator'].pasos) {
    assert.match(p.key, /^vg_/, `el paso «${p.key}» puede colisionar con otra tab`);
  }
});

test('lo aburrido va anteúltimo, pegado a lo único que bloquea', () => {
  // La regla de la skill es «lo aburrido AL FINAL, excepto lo que bloquea». El
  // puente bloquea al ensayo y a nada más, así que va justo antes — y los tres
  // pasos que se pueden hacer sin él van primero.
  const keys = TAB_ONBOARDINGS['video-generator'].pasos.map((p) => p.key);
  assert.equal(keys[keys.length - 1], 'vg_ensayo');
  assert.equal(keys[keys.length - 2], 'vg_puente');
  assert.deepEqual(keys.slice(0, 3), ['vg_cara', 'vg_acento', 'vg_muletillas']);
});
