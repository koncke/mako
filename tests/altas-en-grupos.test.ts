// =============================================================================
// Qué puede hacer MaKo con los grupos después del ban (3/11/2026)
// =============================================================================
// WhatsApp baneó la línea de MaKo, y lo último que hizo fueron altas en grupos. Lo que pide una persona sigue andando; lo que sale solo queda apagado;
// y el tope de altas es de la LÍNEA. Corre sobre el código REAL (tests/_altas-en-grupos-hijo.ts) y mira qué le llegó a WhatsApp y qué salió por mail.
//
// Probado ROMPIÉNDOLO (3/11/2026), de a una, 35 roturas: cada puerta del freno sacada, lo automático prendido por defecto o sin poder leerlo, el DM a quien nunca
// escribió, el tope por negocio y no por línea, el mail con la línea viva, dos mails, y un error de lectura que mandaba mail. La primera pasada dejó verdes dos (la puerta de
// `agregarParticipanteGrupo` y la del equipo, cubiertas por `sumarAlGrupo`): por eso se miran el link y el resultado vacío. Ahora fallan las 35; restaurado, 37 pasan y 0 fallan.
//
// Correr: node --import tsx --test tests/altas-en-grupos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ALTAS_FRENADAS, AUTOMATICO_APAGADO, SIN_INVITACION, altasFrenadas, automaticoPrendido } from '../lib/altas-en-grupos';
import { SIN_CUPO_ALTAS_LINEA } from '../lib/mako-linea-tope';

const RAIZ = join(import.meta.dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_altas-en-grupos-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

const LO_PEDIDO: Array<[string, string]> = [
  ['grupoNuevo', 'group/create'], ['grupoSuelto', 'group/create'], ['notificaciones', 'group/updateParticipant'],
  ['duenoSinGrupo', 'group/create'], ['duenoConGrupo', 'group/updateParticipant'], ['detalleDelGrupo', 'group/updateParticipant'],
];

test('sólo `no` frena, y sólo `si` prende lo automático', () => {
  assert.equal(altasFrenadas('no'), true);
  for (const v of [null, undefined, '', 'si', 'false', 'NO', '0']) assert.equal(altasFrenadas(v), false, String(v));
  assert.equal(automaticoPrendido('si'), true);
  for (const v of [null, undefined, '', 'no', 'true', 'SI', '1']) assert.equal(automaticoPrendido(v), false, String(v));
});

for (const [camino, pedido] of LO_PEDIDO) {
  test(`sin ningún setting, lo que pide una persona anda: ${camino}`, () => {
    assert.ok(R.porDefecto[camino].pedidos.includes(pedido), JSON.stringify(R.porDefecto[camino]));
    assert.equal(R.porDefecto[camino].res.ok, true);
  });
  test(`el freno lo corta y lo dice: ${camino}`, () => {
    assert.deepEqual(R.frenado[camino].pedidos, []);
    assert.equal(R.frenado[camino].res.ok, false);
    assert.equal(R.frenado[camino].res.error, ALTAS_FRENADAS);
  });
}

test('por defecto, el grupo nuevo de un cliente de agencia nace sin agregar a nadie más ni invitar', () => {
  assert.deepEqual(R.grupoNuevoSinEquipo.pedidos.filter((p: string) => p === 'group/updateParticipant' || p === 'group/sendInvite'), []);
  assert.deepEqual(R.equipoApagado.pedidos, []);
  assert.deepEqual(R.equipoApagado.res, { agencias: [], entraron: [], invitados: [], fallaron: [] });
  assert.deepEqual(R.comandoApagado.pedidos, []);
  assert.equal(R.comandoApagado.res.error, AUTOMATICO_APAGADO);
});

test('el caso del 3/11: WhatsApp no deja agregarlo y nunca le escribió a la línea, así que no sale el DM y queda el link', () => {
  assert.deepEqual(R.nuncaEscribio.pedidos, ['group/updateParticipant'], 'ni un mensaje por DM');
  assert.equal(R.nuncaEscribio.res.invitado, false);
  assert.equal(R.nuncaEscribio.res.link, 'https://chat.whatsapp.com/LINK');
  assert.ok(R.nuncaEscribio.res.error.includes(SIN_INVITACION));
});

test('y la pantalla de Notificaciones recibe ese link, con lo guardado guardado', () => {
  assert.equal(R.pantalla.res.ok, true);
  assert.ok(R.pantalla.res.linkGrupo, 'sin link no le queda salida');
  assert.ok(R.pantalla.res.noAgregados.some((n: { motivo: string }) => n.motivo.includes(SIN_INVITACION)));
  assert.ok(!R.pantalla.pedidos.includes('group/sendInvite'));
});

test('a quien SÍ le escribió a la línea se lo invita', () => {
  assert.deepEqual(R.escribio.pedidos, ['group/updateParticipant', 'group/sendInvite']);
  assert.equal(R.escribio.res.invitado, true);
});

test('que MaKo le haya escrito a él no cuenta como que escribió, y sin poder leerlo tampoco', () => {
  assert.ok(!R.soloSalio.pedidos.includes('group/sendInvite'));
  assert.ok(!R.lecturaRota.pedidos.includes('group/sendInvite'));
  assert.equal(R.lecturaRota.res.link, 'https://chat.whatsapp.com/LINK');
});

test('prendido lo automático, sale el equipo; la invitación por DM a quien nunca escribió, no (4/11/2026)', () => {
  assert.ok(R.equipoPrendido.pedidos.includes('group/updateParticipant'));
  // MaKo no le escribe primero a nadie (lib/mako-salida-reglas.ts): lo automático ya no abre la invitación a un desconocido.
  assert.ok(!R.invitacionPrendida.pedidos.includes('group/sendInvite'));
  assert.match(R.invitacionPrendida.res.error, new RegExp(SIN_INVITACION.slice(0, 20)));
  assert.equal(R.invitacionPrendida.res.link, 'https://chat.whatsapp.com/LINK');
});

test('lo automático sin poder leerlo queda apagado, y la fila de un cliente no lo prende para la línea de todos', () => {
  assert.deepEqual(R.automaticoSinLeer.pedidos, []);
  assert.deepEqual(R.automaticoDeOtroNegocio.pedidos, []);
});

test('el freno también corta lo automático y la invitación a quien escribió', () => {
  assert.deepEqual(R.frenado.equipo.pedidos, []);
  assert.deepEqual(R.frenado.equipo.res, { agencias: [], entraron: [], invitados: [], fallaron: [] }, 'frenado no es un fallo por persona: no se intenta');
  assert.deepEqual(R.frenado.invitar.pedidos, []);
  assert.equal(R.frenado.invitar.res.error, ALTAS_FRENADAS);
});

test('con el freno, en Notificaciones queda el link para pasarlo a mano', () => {
  assert.equal(R.frenado.notificaciones.res.link, 'https://chat.whatsapp.com/LINK');
});

test('con el freno, el número del dueño se guarda y el onboarding sigue', () => {
  assert.ok(R.numeroGuardadoFrenado);
  assert.deepEqual(R.verificarFrenado, { ok: true });
});

test('⚠️ sin poder leer el freno, ANDA: una lectura que falla no le corta a Martín crear el grupo en una reunión', () => {
  assert.ok(R.frenoSinLeer.pedidos.includes('group/updateParticipant'));
  assert.equal(R.frenoSinLeer.res.ok, true);
});

test('otro valor no frena, ni la fila de un cliente', () => {
  assert.ok(R.frenoOtroValor.pedidos.includes('group/updateParticipant'));
  assert.ok(R.frenoDeOtroNegocio.pedidos.includes('group/updateParticipant'));
});

test('el tope es de la LÍNEA: el tercer número en minutos no sale, aunque sean de dos negocios', () => {
  assert.equal(R.tope.a1.ok, true);
  assert.equal(R.tope.a2.ok, true);
  assert.equal(R.tope.a3.ok, false);
  assert.equal(R.tope.a3.error, SIN_CUPO_ALTAS_LINEA);
  assert.deepEqual(R.tope.pedidosDelTercero, [], 'ni le pregunta a WhatsApp');
});

test('el mismo número en otro grupo no gasta: si no, la mudanza a un número nuevo no pasaría del segundo grupo', () => {
  assert.equal(R.topeMismoNumero.res.ok, true);
  assert.ok(R.topeMismoNumero.pedidos.includes('group/updateParticipant'));
});

test('el grupo nuevo y el detalle del grupo también cuentan, y otra línea tiene su propio cupo', () => {
  assert.equal(R.topeGrupoNuevo.error, SIN_CUPO_ALTAS_LINEA);
  assert.equal(R.topeDetalle.error, SIN_CUPO_ALTAS_LINEA);
  assert.deepEqual(R.topeOtraLinea, { ok: true });
});

test('la verificación no gasta en la línea y no le escribe a nadie: devuelve el link para que la persona le escriba a MaKo', () => {
  assert.equal(R.topeCodigo.res.ok, true);
  assert.ok(!R.topeCodigo.pedidos.includes('message/sendText'), JSON.stringify(R.topeCodigo.pedidos));
  assert.match(R.topeCodigo.res.link, /^https:\/\/wa\.me\/5493410000999\?text=Hola%20MaKo/);
});

test('pasada la ventana vuelve', () => {
  assert.equal(R.topeDespues.res.ok, true);
  assert.ok(R.topeDespues.pedidos.includes('group/updateParticipant'));
});

test('sin poder contar no sale: es la línea de todos', () => {
  assert.equal(R.topeSinContar.res.ok, false);
});

test('el puente: si el envío al grupo FALLA sale un mail, una vez, a los del negocio', () => {
  assert.deepEqual(R.puenteFalla, { wa: false, email: true, mails: 1, para: 'equipo@cliente.test' });
});

test('con la línea viva no se fuerza nada', () => {
  assert.deepEqual(R.puenteAnda, { wa: true, email: false, mails: 0, para: null });
});

test('sin grupo sigue como estaba: queda en la app', () => {
  assert.equal(R.puenteSinGrupo.mails, 0);
});

test('«no pude leer cuál es el grupo» no es un envío que falló: no se intentó', () => {
  assert.equal(R.puenteSinLeerElGrupo.mails, 0);
});

test('si el negocio ya tenía el mail prendido no salen dos', () => {
  assert.equal(R.puenteYaPrendido.mails, 1);
});

test('con WhatsApp apagado para ese aviso, sale el mail que eligió y nada más', () => {
  assert.equal(R.puenteSoloMail.mails, 1);
});
