// =============================================================================
// El equipo de la agencia entra solo al grupo de MaKo de un cliente suyo (3/11/2026)
// =============================================================================
// Martín: «cuando crea el grupo automáticamente que le invite a las personas que están en el usuario padre». Corre sobre el código real
// (tests/_agencia-grupos-auto-hijo.ts) y mira a quién se agregó a qué grupo y qué se dijo en él.
//
// Probado ROMPIÉNDOLO (3/11/2026): al pie del archivo.
//
// Correr: node --import tsx --test tests/agencia-grupos-auto.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { lineaDeLaAgencia, mismoTelefono, quienesFaltan, telefonoDeParticipante, telefonosDelEquipo } from '../lib/agencia-equipo-grupo';

const RAIZ = join(import.meta.dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_agencia-grupos-auto-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
type Paso = { paso: string; quien?: string; texto?: string; a?: string; grupo?: string };
const agregados = (pasos: Paso[]) => pasos.filter((p) => p.paso === 'agregar').map((p) => String(p.quien).split('@')[0]);
const mensajes = (pasos: Paso[]) => pasos.filter((p) => p.paso === 'mensaje').map((p) => ({ ...p, texto: String(p.texto ?? '') }));
const DUENO = '5492230000684', OTRO_ADMIN = '5491130000111', CLOSER = '5491130000222', SETTER = '5491130000333', SUSPENDIDO = '5491130000444', DUENO_OTRA = '5491130000555';

test('lo puro: quién es del equipo', () => {
  const miembros = [
    { rol_ws: 'admin', estado: 'activo', perfil: { telefono: '' } },
    { rol_ws: null, estado: 'activo', perfil: { telefono: '+54 9 11 3000-0111' } },
    { rol_ws: 'admin', estado: 'activo', perfil: { telefono: '+54 223 000 0684' } },
    { rol_ws: 'closer', estado: 'activo', perfil: { telefono: CLOSER } },
    { rol_ws: 'setter', estado: 'activo', perfil: { telefono: SETTER } },
    { rol_ws: 'admin', estado: 'suspendido', perfil: { telefono: SUSPENDIDO } },
    { rol_ws: 'admin', estado: 'invitado', perfil: { telefono: '5491130000666' } },
    { rol_ws: 'admin', estado: 'activo', perfil: null },
    { rol_ws: 'admin', estado: 'activo', perfil: { telefono: '123' } },
  ];
  // El número del dueño primero; el mismo celular tipeado distinto, una vez; closer, setter, suspendido, invitado y un no-teléfono, afuera.
  assert.deepEqual(telefonosDelEquipo(miembros, DUENO), [DUENO, '5491130000111']);
  // Es el caso de producción: perfil vacío, número en la agencia. Sin el `numero_dueno`, nadie.
  assert.deepEqual(telefonosDelEquipo([{ rol_ws: 'admin', estado: 'activo', perfil: { telefono: '' } }], DUENO), [DUENO]);
  assert.deepEqual(telefonosDelEquipo([{ rol_ws: 'admin', estado: 'activo', perfil: { telefono: '' } }], null), []);
  assert.ok(mismoTelefono('5492233550684', '542233550684'), 'el mismo celular con y sin el 9');
  assert.ok(!mismoTelefono('123', '123'), 'un número corto no es un teléfono');
  assert.deepEqual(quienesFaltan([DUENO, OTRO_ADMIN], ['54 223 000 0684@x']), [OTRO_ADMIN]);
  // El `id` es un @lid, que parece un número: nunca se lee como teléfono.
  assert.equal(telefonoDeParticipante({ id: '12345678901@lid', phoneNumber: `${DUENO}@s.whatsapp.net` }), DUENO);
  assert.equal(telefonoDeParticipante({ id: '12345678901@lid' }), '');
});

test('lo puro: lo que dice el grupo dice lo que pasó', () => {
  assert.match(lineaDeLaAgencia(['Agencia Uno'], { entraron: 1, invitados: 0 }), /^Sumé también a \*Agencia Uno\*, tu agencia/);
  assert.match(lineaDeLaAgencia(['Agencia Uno'], { entraron: 0, invitados: 2 }), /^Invité también a \*Agencia Uno\*, tu agencia/);
  assert.match(lineaDeLaAgencia(['Uno', 'Dos'], { entraron: 1, invitados: 0 }), /tus agencias, \*Uno\* y \*Dos\*/);
  assert.equal(lineaDeLaAgencia(['Agencia Uno'], { entraron: 0, invitados: 0 }), '', 'no entró nadie: no se dice nada');
  assert.equal(lineaDeLaAgencia([], { entraron: 1, invitados: 0 }), '');
  assert.equal(lineaDeLaAgencia(['  '], { entraron: 1, invitados: 0 }), '', 'sin nombre no se afirma una agencia');
});

test('nace el grupo de un cliente de agencia: entran quienes la administran, y el grupo dice quién', () => {
  const { r, pasos } = R.cliente;
  assert.equal(r.ok, true);
  assert.equal(r.creado, true);
  assert.deepEqual(agregados(pasos).sort(), [DUENO, OTRO_ADMIN].sort());
  for (const nadie of [CLOSER, SETTER, SUSPENDIDO]) assert.ok(!agregados(pasos).includes(nadie), `${nadie} no administra la agencia`);
  // Al grupo que nació, no a otro.
  for (const p of pasos.filter((x: Paso) => x.paso === 'agregar')) assert.equal(p.grupo, r.jid);
  // La bienvenida UNA vez, después de las altas, y nombra a la agencia.
  const m = mensajes(pasos);
  assert.equal(m.length, 1);
  assert.equal(m[0].a, r.jid);
  assert.match(m[0].texto, /^¡Hola, Natalia!/);
  assert.match(m[0].texto, /Sumé también a \*Agencia Uno\*, tu agencia/);
  assert.ok(pasos.findIndex((p: Paso) => p.paso === 'mensaje') > pasos.findIndex((p: Paso) => p.paso === 'agregar'), 'el mensaje dice lo que ya pasó');
  // Nada de plata ni de cuentas publicitarias en el grupo del cliente (31/10/2026, ticket #37).
  assert.doesNotMatch(m[0].texto, /pago|cuenta publicitaria|plan|cobr/i);
  // No entran a la lista del cliente: no le aparecen en Notificaciones ni reciben sus reportes por DM.
  assert.deepEqual(R.notifCliente, []);
});

test('sin agencia aprobada no entra nadie: directo, pendiente, revocada', () => {
  for (const c of ['directo', 'pendiente', 'revocado']) {
    assert.equal(R[c].r.ok, true, c);
    assert.deepEqual(agregados(R[c].pasos), [], c);
    const m = mensajes(R[c].pasos);
    assert.equal(m.length, 1, c);
    assert.doesNotMatch(m[0].texto, /agencia/i, `${c}: no se le nombra una agencia que no tiene`);
  }
});

test('con dos agencias, las dos; y una agencia sin teléfonos no inventa nada', () => {
  assert.deepEqual(agregados(R.deDos.pasos).sort(), [DUENO, OTRO_ADMIN, DUENO_OTRA].sort());
  assert.match(mensajes(R.deDos.pasos)[0].texto, /tus agencias, \*Agencia Uno\* y \*Agencia Dos\*/);
  assert.deepEqual(agregados(R.deMuda.pasos), []);
  assert.doesNotMatch(mensajes(R.deMuda.pasos)[0].texto, /agencia/i, 'no entró nadie: no se dice que entró');
});

test('el tope de la línea manda: más de 5 por hora no salen, y el cliente tiene su grupo igual', () => {
  assert.equal(R.grande.r.ok, true);
  assert.equal(agregados(R.grande.pasos).length, 5, JSON.stringify(agregados(R.grande.pasos)));
  assert.match(mensajes(R.grande.pasos)[0].texto, /Agencia Grande/);
});

test('si no se puede leer la cartera el grupo nace igual, sin invitar a nadie y sin nombrar una agencia', () => {
  assert.equal(R.carteraCaida.r.ok, true);
  assert.equal(R.carteraCaida.r.creado, true);
  assert.deepEqual(agregados(R.carteraCaida.pasos), []);
  assert.doesNotMatch(mensajes(R.carteraCaida.pasos)[0].texto, /agencia/i);
});

// ⚠️ 4/11/2026: MaKo no le escribe primero a nadie (lib/mako-salida-reglas.ts). Con lo automático prendido, a alguien de la agencia que
// WhatsApp no deja sumar y que nunca le escribió a la línea NO le sale la invitación por DM, y el grupo no dice «invité».
test('WhatsApp no deja a uno de la agencia que nunca escribió: no sale la invitación por DM, y el grupo no dice «invité»', () => {
  assert.equal(R.privado.r.ok, true);
  assert.equal(R.privado.pasos.find((p: Paso) => p.paso === 'invitar'), undefined, 'salió un DM con link a alguien que nunca le escribió a la línea');
  assert.doesNotMatch(mensajes(R.privado.pasos)[0].texto, /Invité/);
});

test('un grupo que ya existe: el plan sólo lee; aplicar suma a quien falta; otra vez no repite', () => {
  // El plan: ni una escritura en la base, ni una llamada que le escriba a alguien.
  assert.equal(R.planNoEscribio, true);
  assert.equal(R.planLlamadas, 0);
  assert.deepEqual(R.plan.faltan, [DUENO], 'el otro admin ya está adentro');
  // Aplicar.
  assert.deepEqual(agregados(R.aplicarPasos), [DUENO]);
  const m = mensajes(R.aplicarPasos);
  assert.equal(m.length, 1);
  assert.match(m[0].texto, /^Sumé también a \*Agencia Uno\*, tu agencia/);
  // Otra vez: nadie, y nada dicho.
  assert.deepEqual(R.aplicarOtraVezPasos, []);
  assert.deepEqual(R.aplicarOtraVez.entraron, []);
  // Sin poder leer quién está, no se toca: agregaría a ciegas.
  assert.equal(R.sinLectura.ok, false);
  assert.deepEqual(R.sinLecturaPasos, []);
  // Sin grupo, no se crea uno: entran solos cuando nazca.
  assert.equal(R.sinGrupo.ok, false);
  assert.deepEqual(R.sinGrupoPasos, []);
});

// ROTURAS (3/11/2026), una por vez y restaurando; base 9 pases, 0 fallos. Entre paréntesis, lo que dio cada una:
//   · la creación no llama al equipo (5/4) · también las agencias no aprobadas (8/1) · closer y setter de la agencia (5/4)
//   · suspendidos e invitados (5/4) · sin el número del dueño, sólo el perfil, que es lo de producción (5/4)
//   · el mismo celular dos veces (5/4) · el @lid leído como teléfono (8/1) · la bienvenida sin la línea de la agencia (5/4)
//   · dice «sumé» aunque sólo se invitó (7/2) · la línea se dice aunque no entró nadie (6/3)
//   · el equipo tira y se lleva puesto el grupo (el hijo muere, 0/1) · la invitación con el texto del dueño (8/1)
//   · aplicar agrega a ciegas si no pudo leer (8/1) · aplicar repite (8/1) · aplicar no le dice nada al grupo (8/1).
