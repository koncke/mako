// =============================================================================
// «Mi hoja» es la de quien chatea: en el Ops Center no se pide un email para el Dashboard ni para Focus
// =============================================================================
// Ops Center = lo principal (20/10/2026, docs/ops-center-principal.md, pieza 1.5). Desde el Ops Center, «agregá un
// gráfico a mi hoja de Marketing» en una cuenta con 2 o más informes guardados contestaba «di de quién es (su email)»:
// la API elegía la persona por el email nombrado o por «el único informe», y la pantalla, en cambio, siempre abre el
// informe de quien mira. Ahora el turno de la app pasa la persona de la sesión (`Ctx.quien`) y el Dashboard y General
// la usan cuando no se nombra a otra. Lo que se puede romper sin que se vea: que vuelva a pedir el email, que quien
// chatea le gane a una persona NOMBRADA, que valga en WhatsApp o por HTTP (ahí no hay «mío»), que el turno deje de
// pasarla al proponer o al confirmar, y que un closer termine escribiendo un informe de admin.
//
// Correr: node --import tsx --test tests/api-mako-mi-hoja.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (20/10/2026, base 5/0): `elegirPersona` sin mirar `quienChatea` → 3 / 2; quien chatea antes
// que la persona nombrada → 4 / 1; `quienChatea` sin mirar el canal → 4 / 1; el turno sin `quien` al confirmar → 4 / 1;
// General sin su tercer argumento en una de sus cinco llamadas → 4 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { elegirPersona, etiquetaPersona, type MiembroCuenta, type PersonaInforme } from '../lib/api-mako/areas/dashboard.helpers';
import { elegirPersona as elegirPersonaGeneral } from '../lib/general-plantillas';
import { quienChatea } from '../lib/api-mako/tipos';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

const ANA: PersonaInforme = { sub: '11', email: 'ana@negocio.com', nombre: 'Ana' };
const BETO: PersonaInforme = { sub: '12', email: 'beto@negocio.com', nombre: 'Beto' };
const CARLA: MiembroCuenta = { sub: '13', email: 'carla@negocio.com', nombre: 'Carla', rol: 'closer' };
const MIEMBROS: MiembroCuenta[] = [{ ...ANA, rol: 'admin' }, { ...BETO, rol: 'admin' }, CARLA];

test('Dashboard: con dos informes guardados, quien chatea usa el SUYO sin pedir un email', () => {
  const base = { informes: [ANA, BETO], miembros: MIEMBROS, sinPersonaVaElInicial: false, enFlujo: false };
  const sinQuien = elegirPersona(base);
  assert.equal(sinQuien.ok, false, 'sin quien chatea sigue pidiendo de quién es');
  const e = elegirPersona({ ...base, quienChatea: BETO });
  assert.ok(e.ok);
  assert.deepEqual([e.persona?.sub, e.guardado, e.como], ['12', true, 'quien_chatea']);
  assert.equal(etiquetaPersona(e, false), 'tu informe');
  // Quien nunca guardó uno: el suyo, desde el inicial (como la pantalla), no el de otra persona.
  const nuevo = elegirPersona({ ...base, informes: [ANA], quienChatea: BETO });
  assert.ok(nuevo.ok);
  assert.deepEqual([nuevo.persona?.sub, nuevo.guardado], ['12', false]);
  assert.match(etiquetaPersona(nuevo, false), /todavía no guardaste uno/);
});

test('Dashboard: nombrar a otra persona le gana a quien chatea; un closer no escribe un informe de admin', () => {
  const base = { informes: [ANA, BETO], miembros: MIEMBROS, sinPersonaVaElInicial: false, enFlujo: false, quienChatea: BETO };
  const nombrada = elegirPersona({ ...base, pedido: 'ana@negocio.com' });
  assert.ok(nombrada.ok);
  assert.deepEqual([nombrada.persona?.sub, nombrada.como], ['11', 'nombrada']);
  const closer = elegirPersona({ ...base, quienChatea: CARLA });
  assert.equal(closer.ok, false);
  assert.match((closer as { error: string }).error, /hoja Closing/);
  // En una automatización la persona sigue siendo obligatoria.
  assert.equal(elegirPersona({ ...base, enFlujo: true }).ok, false);
});

test('General: Focus es la General de quien chatea; nombrar a otra persona le gana', () => {
  const admins = [ANA, BETO];
  assert.equal(elegirPersonaGeneral(admins, '').ok, false, 'sin quien chatea, con dos admins, pide el email');
  const e = elegirPersonaGeneral(admins, '', BETO);
  assert.ok(e.ok);
  assert.equal(e.persona.sub, '12');
  const nombrada = elegirPersonaGeneral(admins, 'Ana', BETO);
  assert.ok(nombrada.ok);
  assert.equal(nombrada.persona.sub, '11');
});

test('«mío» sólo existe en la app: en WhatsApp, por HTTP o en un flujo no hay quien chatea', () => {
  const quien = { sub: '12', email: 'beto@negocio.com', nombre: 'Beto' };
  assert.deepEqual(quienChatea({ canal: 'app', quien }), quien);
  assert.equal(quienChatea({ canal: 'whatsapp', quien }), null);
  assert.equal(quienChatea({ canal: 'http', quien }), null);
  assert.equal(quienChatea({ canal: 'app' }), null);
});

test('el turno de la app pasa quien chatea al proponer y al confirmar, y las dos áreas lo usan', () => {
  const turno = leer('lib/mako-turno-app.ts');
  assert.match(turno, /const quien = \/\^\\d\+\$\/\.test\(String\(sesion\.sub\)\) \?/, 'sólo una persona de verdad (usuarios.id)');
  assert.match(turno, /alcance: 'proponer', rol: persona\.rol, [^\n]*quien: persona\.quien,/);
  assert.match(turno, /alcance: 'ejecutar', rol: persona\.rol, actor: persona\.actor, quien: persona\.quien,/);
  const dash = leer('lib/api-mako/areas/dashboard.run.ts');
  assert.match(dash, /elegirPersona\(\{ informes, miembros, [^}]*quienChatea: quienChatea\(ctx\) \}\)/);
  const gen = leer('lib/api-mako/areas/general.run.ts');
  const llamadas = gen.match(/elegirPersona\(admins, .*\);/g) ?? [];
  assert.ok(llamadas.length >= 5, `encontré ${llamadas.length} llamadas en General`);
  for (const l of llamadas) assert.match(l, /quienChatea\(ctx/, `${l}: sin quien chatea`);
});
