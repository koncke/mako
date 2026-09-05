// =============================================================================
// El diagnóstico del puente: qué se guarda, y sobre todo qué NO
// =============================================================================
// Este payload lo manda el navegador de un cliente en cada latido, y describe una
// sesión autenticada de Google. Su saneo es un allowlist POSITIVO campo por campo,
// no una lista de prohibidos — una lista de prohibidos se queda vieja el día que
// una extensión futura decide mandar un campo más.
//
// Lo que NUNCA puede entrar: cuerpos de pedido (traen el `at`, el token anti-CSRF
// de la sesión de Google, y pueden traer el de reCAPTCHA) y urls (traen el
// `source-path` con el projectId). Nada de eso hace falta para contestar «¿qué sabe
// hacer este puente y desde cuándo?», que es la única pregunta que existe para
// responder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanearDiagnostico, resumenDiagnostico } from '../lib/flow-diagnostico';

const BUENO = {
  cuando: 1757000000000,
  manifest: '0.53.0',
  espejo: '0.53.0',
  dominio: 'flow.google.com',
  enProyecto: true,
  clases: ['boq:YhhmEf', 'boq:nzlxg'],
  ops: ['generar_clip', 'creditos'],
  faltan: ['subir_imagen'],
  estado: 'sin_sesion',
};

test('un diagnóstico completo pasa entero', () => {
  const d = sanearDiagnostico(BUENO);
  assert.ok(d);
  assert.equal(d.manifest, '0.53.0');
  assert.deepEqual(d.ops, ['generar_clip', 'creditos']);
  assert.equal(d.enProyecto, true);
});

test('lo que no está nombrado NO entra, aunque venga', () => {
  // El corazón del allowlist positivo. Un campo nuevo que una extensión futura
  // decida mandar se cae por no estar nombrado, no por estar prohibido.
  const d = sanearDiagnostico({
    ...BUENO,
    cuerpo: 'f.req=%5B%5D&at=TOKEN_ANTI_CSRF',
    url: 'https://flow.google.com/…?source-path=%2Fproject%2Fabc',
    bearer: 'ya29.SECRETO',
    cookies: 'SID=x',
  } as Record<string, unknown>);
  assert.ok(d);
  const texto = JSON.stringify(d);
  for (const prohibido of ['TOKEN_ANTI_CSRF', 'source-path', 'ya29.SECRETO', 'SID=x']) {
    assert.ok(!texto.includes(prohibido), `se coló ${prohibido}`);
  }
  assert.deepEqual(
    Object.keys(d).sort(),
    ['clases', 'cuando', 'dominio', 'enProyecto', 'espejo', 'faltan', 'manifest', 'ops', 'estado'].sort(),
  );
});

test('sin versión de manifest no hay diagnóstico', () => {
  // Una fila vacía se leería como «el navegador contestó» cuando no contestó nada,
  // que es exactamente la ambigüedad que este dato viene a cerrar.
  assert.equal(sanearDiagnostico({ ...BUENO, manifest: '' }), null);
  assert.equal(sanearDiagnostico(null), null);
  assert.equal(sanearDiagnostico([]), null);
  assert.equal(sanearDiagnostico('hola'), null);
});

test('el dominio se limpia: es un host, no una url', () => {
  const d = sanearDiagnostico({ ...BUENO, dominio: 'flow.google.com/_/x?source-path=%2Fproject%2Fabc' });
  assert.ok(d);
  assert.ok(!d.dominio.includes('/'), 'dejó pasar un path');
  assert.ok(!d.dominio.includes('?'), 'dejó pasar un query');
});

test('las listas se acotan: un navegador no decide cuánto escribimos', () => {
  const d = sanearDiagnostico({ ...BUENO, clases: Array(500).fill('x'.repeat(200)) });
  assert.ok(d);
  assert.ok(d.clases.length <= 40, 'no acotó la cantidad');
  assert.ok(d.clases.every((c) => c.length <= 40), 'no acotó el largo');
});

test('el resumen NOMBRA el desfase del espejo', () => {
  // Es la causa más cara que tuvo este puente y es invisible de cualquier otra
  // forma: la extensión al día, el código correcto, y la pestaña corriendo lo de
  // ayer porque nadie hizo F5.
  const viejo = sanearDiagnostico({ ...BUENO, espejo: '0.48.0', manifest: '0.53.0' });
  const txt = resumenDiagnostico(viejo);
  assert.match(txt, /0\.48\.0/);
  assert.match(txt, /F5/, 'no dice qué hacer');

  // Y al día NO lo menciona: un aviso que sale siempre deja de leerse.
  assert.ok(!resumenDiagnostico(sanearDiagnostico(BUENO)).includes('F5'));
});

test('sin diagnóstico, el resumen lo dice en vez de inventar', () => {
  assert.match(resumenDiagnostico(null), /todavía no reportó/);
});
