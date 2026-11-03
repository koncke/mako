// =============================================================================
// MaKo no crea grupos ni suma gente hasta que Martín decida (3/11/2026)
// =============================================================================
// WhatsApp baneó la línea de MaKo, y lo último que hizo fueron altas en grupos. Corre sobre el código REAL
// (tests/_altas-en-grupos-hijo.ts) y mira lo único que importa: qué le llegó a WhatsApp.
//
// Probado ROMPIÉNDOLO (3/11/2026), de a una, 14 roturas: cada puerta sacada (grupo, grupo suelto, alta, invitación, `sumarAlGrupo`, agencia, comando de
// grupos viejos, detalle del grupo), el onboarding que se traba, prendido sin poder leer, prendido por defecto, cualquier valor, el setting leído del
// negocio en curso, y apagado para siempre. La primera pasada dejó verde sacar la puerta de `agregarParticipanteGrupo`, porque `sumarAlGrupo` la cubre:
// por eso se mira el link. Ahora fallan las 14; restaurado, 17 pasan y 0 fallan.
//
// Correr: node --import tsx --test tests/altas-en-grupos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ALTAS_APAGADAS, altasPrendidas } from '../lib/altas-en-grupos';

const RAIZ = join(import.meta.dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_altas-en-grupos-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

const CAMINOS = ['crearGrupo', 'grupoSuelto', 'agregar', 'invitar', 'equipoDeLaAgencia', 'aplicarEquipo', 'dueñoSinGrupo', 'dueñoConGrupo', 'agregarDesdeElDetalle'];

test('sólo `si` lo prende', () => {
  assert.equal(altasPrendidas('si'), true);
  for (const v of [null, undefined, '', 'no', 'true', 'SI', '1']) assert.equal(altasPrendidas(v), false, String(v));
});

for (const camino of CAMINOS) {
  test(`apagado por defecto: ${camino} no le pide nada a WhatsApp`, () => {
    assert.deepEqual(R.apagado[camino].pedidos, []);
  });
}

test('quien lo intentó se entera: no se cuenta como hecho', () => {
  for (const camino of ['crearGrupo', 'grupoSuelto', 'agregar', 'invitar', 'aplicarEquipo', 'dueñoSinGrupo', 'dueñoConGrupo', 'agregarDesdeElDetalle']) {
    assert.equal(R.apagado[camino].res.ok, false, camino);
    assert.equal(R.apagado[camino].res.error, ALTAS_APAGADAS, camino);
  }
  // El de la agencia corre adentro de la creación del grupo: no entra nadie y el grupo no dice «sumé».
  assert.deepEqual(R.apagado.equipoDeLaAgencia.res, { agencias: [], entraron: [], invitados: [], fallaron: [] });
});

test('desde Notificaciones, quien lo intentó se lleva el link para pasarlo a mano: es la salida que le queda', () => {
  assert.equal(R.apagado.agregar.res.link, 'https://chat.whatsapp.com/LINK');
});

test('el número del dueño se guarda igual: lo apagado es el grupo, no el dato', () => {
  assert.ok(R.numeroGuardadoApagado, 'sin el número, los reportes del negocio pierden su destinatario');
});

test('con el código correcto el onboarding sigue: si no, un cliente nuevo se traba por un grupo que no se va a crear', () => {
  assert.deepEqual(R.verificarApagado, { ok: true });
  assert.deepEqual(R.verificarPedidos, []);
});

test('sin poder leer el interruptor queda apagado, aunque diga `si`', () => {
  assert.equal(R.baseCaida.res.ok, false);
  assert.deepEqual(R.baseCaida.pedidos, []);
});

test('otro valor no lo prende, ni la fila de otro negocio: un cliente no puede prenderlo para la línea de todos', () => {
  assert.deepEqual(R.otroValor, []);
  assert.deepEqual(R.otroNegocio, []);
});

test('prendido, cada camino vuelve a andar: la puerta no es un callejón sin salida', () => {
  assert.ok(R.prendido.crearGrupo.includes('group/create'));
  assert.ok(R.prendido.grupoSuelto.includes('group/create'));
  assert.ok(R.prendido.agregar.includes('group/updateParticipant'));
  assert.ok(R.prendido.agregar.includes('group/sendInvite'), 'WhatsApp no dejó agregarlo: sale la invitación');
  assert.ok(R.prendido.invitar.includes('group/sendInvite'));
  assert.ok(R.prendido.equipoDeLaAgencia.includes('group/updateParticipant'));
  assert.ok(R.prendido.dueñoConGrupo.includes('group/updateParticipant'));
  assert.ok(R.prendido.agregarDesdeElDetalle.includes('group/updateParticipant'));
});
