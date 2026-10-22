// =============================================================================
// Quién es "de casa": la lista que decidía descartar llamadas de OTROS clientes
// =============================================================================
// El Closing Analyst descarta una llamada como «interna» cuando no le queda
// ningún invitado externo. Hasta el 14/08/2026 esa lista era la identidad del
// DUEÑO, hardcodeada, aplicada a todos los workspaces:
//
//     INTERNAL_EMAILS  = { martinkoncke@gmail.com, ejemplo.colaborador.mako@gmail.com }
//     INTERNAL_DOMAINS = { negocio-uno.com }
//
// A otra clienta le descartaba en silencio cualquier llamada con alguien de
// negocio-uno.com, y su propio dominio no se excluía nunca. Descartar es
// destructivo y silencioso, así que la condición vive fuera de `server-only`
// para poder testearla — la regla de la casa.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dominioPropio, esInterno, internosDe, SIN_INTERNOS, DOMINIOS_PUBLICOS } from '../lib/closing-internos';

test('LA TRAMPA: un dominio público NUNCA es «mi dominio»', () => {
  // La cuenta que graba de la agencia ES un gmail. Sin esta guarda, derivar el
  // dominio de ahí volvería «interno» a TODO lead con gmail y los descartaría a
  // todos, en silencio y sin una fila que mirar.
  assert.equal(dominioPropio('martinkoncke@gmail.com'), null);
  assert.equal(dominioPropio('alguien@hotmail.com'), null);
  assert.equal(dominioPropio('alguien@outlook.com'), null);
  assert.equal(dominioPropio('alguien@prodigy.net.mx'), null, 'un lead real del CRM usa este dominio');
  // Un dominio propio sí.
  assert.equal(dominioPropio('dueno@negocio-uno.com'), 'negocio-uno.com');
  assert.equal(dominioPropio('hola@marca-ejemplo.com'), 'marca-ejemplo.com');
  assert.equal(dominioPropio(''), null);
  assert.equal(dominioPropio(null), null);
});

test('el email SIEMPRE cuenta, aunque su dominio sea público', () => {
  // Un gmail personal del equipo sigue siendo del equipo: lo que no se puede es
  // extender ese gmail a TODO el dominio.
  const i = internosDe(['martinkoncke@gmail.com']);
  assert.equal(esInterno('martinkoncke@gmail.com', i), true, 'el email exacto sí');
  assert.equal(esInterno('un.lead.cualquiera@gmail.com', i), false, 'pero no todo gmail');
  assert.equal(i.dominios.size, 0, 'gmail.com no puede entrar como dominio propio');
});

test('cada workspace tiene SU gente (el bug que esto cierra)', () => {
  const mauricio = internosDe(['dueno@negocio-uno.com']);
  const leila = internosDe(['hola@marca-ejemplo.com']);

  // Para Leila, alguien de negocio-uno.com es un PROSPECTO, no su equipo.
  assert.equal(esInterno('contacto@negocio-uno.com', leila), false,
    'era el bug: se le descartaba la llamada como «interna» y no quedaba rastro');
  assert.equal(esInterno('contacto@negocio-uno.com', mauricio), true);

  // Y su propio dominio ahora sí se reconoce: sus juntas de equipo dejan de
  // entrar como candidatas a venta y de pagarse a Claude.
  assert.equal(esInterno('otra@marca-ejemplo.com', leila), true);
  assert.equal(esInterno('otra@marca-ejemplo.com', mauricio), false);
});

test('el fallback es NADIE, nunca la identidad de otro', () => {
  // Si no se pudo resolver el workspace, la lista queda vacía: a lo sumo se
  // analiza de más —se ve y cuesta plata— pero no se descarta ninguna venta por
  // heredar la identidad de otro cliente, que es el modo de falla caro.
  assert.equal(esInterno('cualquiera@loquesea.com', SIN_INTERNOS), false);
  assert.equal(SIN_INTERNOS.emails.size + SIN_INTERNOS.dominios.size, 0);
});

test('no queda identidad de nadie hardcodeada en closing.ts', () => {
  // La guarda que impide que vuelva. El comentario que cuenta el bug SÍ nombra
  // los valores viejos, así que se mira el código sin comentarios.
  const src = readFileSync(new URL('../lib/closing.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const v of ['martinkoncke@gmail.com', 'ejemplo.colaborador.mako@gmail.com', 'negocio-uno.com']) {
    assert.ok(!src.includes(v), `volvió ${v} al código: eso se le aplica a TODOS los clientes`);
  }
  assert.ok(/internosDelWorkspace/.test(src), 'la identidad tiene que resolverse por workspace');
});

test('la lista de dominios públicos cubre lo que se usa de verdad en LATAM', () => {
  for (const d of ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.mx', 'icloud.com', 'prodigy.net.mx']) {
    assert.ok(DOMINIOS_PUBLICOS.has(d), `falta ${d}: un lead con ese correo se descartaría como interno`);
  }
});
