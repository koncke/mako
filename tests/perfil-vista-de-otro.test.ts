// =============================================================================
// /perfil en una «vista de otro», y la cuenta a la que no puede entrar nadie (09/10/2026)
// =============================================================================
// Pedido de Martín, con una captura de Joan (Código Inmobiliario, ws13) inspeccionando a
// Brigitte Eberlin (ws15): el cartel decía «Estás viendo el dashboard de Brigitte Eberlin»
// y /perfil mostraba nombre «Codigo Inmobiliario» y codigoinmobiliarioia@gmail.com. Y
// «no se le envió la invitación a Brigitte»: medido, el ws15 tiene CERO usuarios.
//
// Lo que fija este archivo:
//   · de quién es el perfil lo decide `deQuienEsElPerfil` (lib/perfil-sujeto.ts), y la
//     agencia cambia de sujeto SÓLO con su contexto de agencia vigente;
//   · la persona es la del workspace MIRADO, y con cero personas es null — nunca el que mira;
//   · lib/perfil.ts usa esas dos y no tiene más el `if (sesion.rol !== 'admin') return propio`;
//   · la tarjeta dice «nadie puede entrar» sólo cuando la lectura anduvo;
//   · sumar a alguien desde la ficha dice si el mail SALIÓ, mirando `enviado`.
//
// PROBADO ROMPIÉNDOLO (en memoria, restaurando en un `finally`, scratchpad/brigitte/romper.mjs).
// Corrida del 09/10/2026. Con todo en su lugar: 7 pass / 0 fail. Cada rotura, de a una:
//   1. `deQuienEsElPerfil` sin el chequeo de la agencia (`if (p.esSuperAdmin)` → `if (true)`)    → 6 / 1 «… la agencia»
//   2. la agencia sin exigir que el contexto sea el ws mirado (sin `&& … === p.wsActual`)        → 6 / 1 «… la agencia»
//   3. `titularDelCliente` sin filtrar por workspace (devuelve `gente[0]`)                       → 6 / 1 «… la persona»
//   4. lib/perfil.ts con la regla vieja (`if (sesion.rol !== 'admin') return …` antes del sujeto) → 6 / 1 «lib/perfil.ts …»
//   5. lib/perfil.ts cayendo a `?? propio` en la vista de otro                                   → 6 / 1 «lib/perfil.ts …»
//   6. page.tsx sembrando `[]` aunque la lectura de usuarios falle (`if (true)`)                  → 6 / 1 «la tarjeta …»
//   7. la ficha leyendo `j.invitacion ?` en vez de pasárselo a `avisoInvitacion`                  → 6 / 1 «sumar desde la ficha …»
// Y la guarda que ya existía del falso éxito al APROBAR (tests/curso-invitar.test.ts, «los avisos de
// aprobación de agencia miran `enviado`»), rota el mismo día: `aviso = inv` en la aprobación → 29 / 1,
// `aviso: invitacion ?` en el alta → 29 / 1 (base 30 / 0).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deQuienEsElPerfil, titularDelCliente } from '../lib/perfil-sujeto';
import { avisoInvitacion } from '../lib/invitacion-aviso';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Los sujetos del caso real, y una SEGUNDA agencia: con una sola, una regla cableada al 13
// pasaría todo (AGENTS.md: «se prueba con DOS sujetos, no con uno»).
const AGENCIA = 13, BRIGITTE = 15, JOAN_PRUEBA = 17, OTRA_AGENCIA = 14, PLATAFORMA = 9;

test('de quién es el perfil: la agencia cambia de sujeto SÓLO con su contexto vigente y sobre ese ws', () => {
  // Joan inspeccionando a Brigitte: el perfil es el de Brigitte.
  assert.deepEqual(
    deQuienEsElPerfil({ esSuperAdmin: false, wsPropio: AGENCIA, wsActual: BRIGITTE, clienteDeAgencia: BRIGITTE }),
    { tipo: 'cliente', ws: BRIGITTE },
  );
  // Otra agencia con SU cliente: lo mismo, con sus números (no hay un 13 cableado).
  assert.deepEqual(
    deQuienEsElPerfil({ esSuperAdmin: false, wsPropio: OTRA_AGENCIA, wsActual: JOAN_PRUEBA, clienteDeAgencia: JOAN_PRUEBA }),
    { tipo: 'cliente', ws: JOAN_PRUEBA },
  );
  // En su propia cuenta, sin vista: su perfil.
  assert.deepEqual(deQuienEsElPerfil({ esSuperAdmin: false, wsPropio: AGENCIA, wsActual: AGENCIA, clienteDeAgencia: null }), { tipo: 'propio' });
  // ⚠️ Un ws distinto SIN contexto de agencia NO es permiso: el perfil sigue siendo el propio.
  assert.deepEqual(deQuienEsElPerfil({ esSuperAdmin: false, wsPropio: AGENCIA, wsActual: BRIGITTE, clienteDeAgencia: null }), { tipo: 'propio' });
  // ⚠️ Y un contexto de agencia sobre OTRO cliente tampoco habilita el que se mira.
  assert.deepEqual(deQuienEsElPerfil({ esSuperAdmin: false, wsPropio: AGENCIA, wsActual: BRIGITTE, clienteDeAgencia: JOAN_PRUEBA }), { tipo: 'propio' });
  // Basura de afuera no cambia nada.
  for (const ws of [null, undefined, 0, -1, 1.5]) {
    assert.deepEqual(deQuienEsElPerfil({ esSuperAdmin: false, wsPropio: AGENCIA, wsActual: ws, clienteDeAgencia: ws }), { tipo: 'propio' }, String(ws));
  }
});

test('de quién es el perfil: el super admin, parado en un cliente, ve el del cliente; en lo suyo, el suyo', () => {
  assert.deepEqual(deQuienEsElPerfil({ esSuperAdmin: true, wsPropio: PLATAFORMA, wsActual: BRIGITTE, clienteDeAgencia: null }), { tipo: 'cliente', ws: BRIGITTE });
  assert.deepEqual(deQuienEsElPerfil({ esSuperAdmin: true, wsPropio: PLATAFORMA, wsActual: PLATAFORMA, clienteDeAgencia: null }), { tipo: 'propio' });
  assert.deepEqual(deQuienEsElPerfil({ esSuperAdmin: true, wsPropio: PLATAFORMA, wsActual: null, clienteDeAgencia: null }), { tipo: 'propio' });
});

test('la persona del perfil es la del workspace MIRADO, y con cero personas es null — nunca otra', () => {
  const gente = [
    { id: 10, workspace_id: AGENCIA, rol_ws: 'admin', email: 'codigoinmobiliarioia@gmail.com' },
    { id: 13, workspace_id: JOAN_PRUEBA, rol_ws: 'admin', email: 'joandowd5469@gmail.com' },
    { id: 20, workspace_id: OTRA_AGENCIA, rol_ws: 'closer', email: 'closer@x.com' },
    { id: 21, workspace_id: OTRA_AGENCIA, rol_ws: null, email: 'duena@x.com' },
  ];
  // Brigitte (ws15) no tiene a nadie: null. Ni la agencia ni el primero de la lista.
  assert.equal(titularDelCliente(gente, BRIGITTE), null);
  assert.equal(titularDelCliente([], BRIGITTE), null);
  assert.equal(titularDelCliente(gente, JOAN_PRUEBA)?.id, 13);
  // `rol_ws` nulo cuenta como admin, y le gana al closer que está antes.
  assert.equal(titularDelCliente(gente, OTRA_AGENCIA)?.id, 21);
});

test('lib/perfil.ts decide con `deQuienEsElPerfil` y el contexto de agencia, y no cae al perfil propio', () => {
  const src = sinComentarios(leer('lib/perfil.ts'));
  // La regla vieja: sólo el super admin cambiaba de sujeto. Era el bug de la captura de Joan.
  assert.doesNotMatch(src, /if \(sesion\.rol !== 'admin'\) return/);
  // El permiso de la agencia sale de `contextoDeAgencia` (cookie firmada + cartera AHORA), no de la URL.
  assert.match(src, /clienteDeAgencia: esSuperAdmin \? null : await contextoDeAgencia\(\)/);
  assert.match(src, /wsActual: await getWorkspaceActual\(\)/);
  assert.doesNotMatch(src, /searchParams|wsDePestana|\?ws=/);
  // La persona sale de `titularDelCliente`, y el vacío NO se rellena con quien mira.
  assert.match(src, /const fila = titularDelCliente\(filas, sujeto\.ws\)/);
  assert.doesNotMatch(src, /\?\? propio/);
  // Y guardar sin nadie adentro es un error, no un «ok» que no escribió nada.
  assert.match(src, /if \(!u && vista\.deOtro\) throw/);
});

test('la tarjeta dice «nadie puede entrar» sólo cuando la lectura de usuarios ANDUVO', () => {
  const page = sinComentarios(leer('app/customer-success/page.tsx'));
  // La siembra de `[]` cuelga de que `listarUsuarios` haya contestado: un fallo es `null`.
  assert.match(page, /listarUsuarios\(\)\.catch\(\(\) => null\)/);
  assert.match(page, /if \(usuarios\) for \(const ws of permitidos\) equipoPorWs\[ws\] = \[\];/);
  const card = sinComentarios(leer('app/customer-success/ClienteCard.tsx'));
  assert.match(card, /const sinNadie = Boolean\(ws && equipo && equipo\.length === 0\)/);
  assert.match(card, /\{sinNadie && !aviso && <PieTexto mal>/);
});

test('sumar desde la ficha dice si el mail SALIÓ, con `avisoInvitacion` (que mira `enviado`)', () => {
  const ficha = sinComentarios(leer('app/customer-success/FichaCliente.tsx'));
  assert.match(ficha, /if \(puedeSumar\) setEnvio\(avisoInvitacion\(j\.invitacion, email\.trim\(\)\)\)/);
  assert.doesNotMatch(ficha, /j\.invitacion\s*\?(?!\.)/);
  // Y la función contesta por `enviado`: un objeto con `enviado: false` NO es «le llegó».
  assert.equal(avisoInvitacion({ enviado: false, error: 'remitente de prueba', enlace: 'x' }, 'a@b.com').tono, 'warn');
  assert.equal(avisoInvitacion({ enviado: true, enlace: 'x' }, 'a@b.com').tono, 'ok');
});

test('los textos nuevos de pantalla son cortos y sin voseo', async () => {
  const { marcasDeVoseo } = await import('../lib/puestas-data');
  for (const t of ['Nadie puede entrar todavía', 'Esta cuenta todavía no tiene a nadie adentro.', 'No pude leer el perfil de esta cuenta.', 'Perfil de Brigitte Eberlin']) {
    assert.deepEqual(marcasDeVoseo(t), [], t);
    assert.ok(t.split(/\s+/).length <= 8, `largo: ${t}`);
  }
});
