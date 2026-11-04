// =============================================================================
// La agencia y el grupo de WhatsApp de un cliente suyo (3/11/2026, ticket #49 de Joan)
// =============================================================================
// Joan: «no puedo ver los notificaciones dentro de la cuenta de un cliente para agregar un número de WhatsApp al grupo de Mako».
// Medido con la sesión de una agencia sobre el código real (tests/_agencia-grupos-hijo.ts): el server lo dejaba leer y guardar, la
// invitación salía y la cartera aislaba bien. Lo roto era el ÍNDICE: `seccionesCuenta` esconde «Notificaciones» mirando a otro, y desde
// el 25/10/2026 a quién le avisa MaKo lo del negocio vive adentro de esa sección. La pantalla existía, sin un renglón que llevara.
//
// Probado ROMPIÉNDOLO (3/11/2026): al pie del archivo.
//
// Correr: node --import tsx --test tests/agencia-grupos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_agencia-grupos-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const claves = (indice: Array<{ titulo: string; keys: string[] }>, titulo: string) => indice.find((g) => g.titulo === titulo)?.keys ?? [];

test('el índice: el admin de la agencia parado en un cliente ve «Notificaciones», y lo suyo no', () => {
  assert.ok(claves(R.indiceAgencia, 'Tu cuenta').includes('notificaciones'), 'es el bug de Joan: la pantalla no tiene renglón');
  assert.ok(claves(R.indiceSuperAdmin, 'Tu cuenta').includes('notificaciones'), 'el super admin tampoco la tenía');
  // Lo que es de quien mira sigue afuera.
  for (const propio of ['seguridad', 'instalar']) assert.ok(!claves(R.indiceAgencia, 'Tu cuenta').includes(propio), propio);
  // En su propia cuenta, todo, una sola vez.
  assert.deepEqual(claves(R.indiceEnSuCuenta, 'Tu cuenta'), ['info', 'seguridad', 'notificaciones', 'instalar']);
  // El closer de la agencia no administra: ni el renglón.
  assert.deepEqual(claves(R.indiceCloserDeAgencia, 'Tu cuenta'), ['info']);
});

test('la pantalla, mirando a otro: sólo WhatsApp y Email; lo de la app, el celular y «No molestar» es de quien mira', () => {
  const panel = sinComentarios(leer('app/perfil/NotificacionesPanel.tsx'));
  assert.match(panel, /\{!deOtro && <FilaAjustes icono="avisar"/);
  assert.match(panel, /\{!deOtro && <FilaAjustes icono="celular"/);
  assert.match(panel, /\{!deOtro && <GrupoAjustes titulo="No molestar">/);
  assert.match(panel, /\{admin && <FilaAjustes icono="whatsapp"/);
  // Un 500 de lo personal no es un error de esta pantalla: no se muestra.
  assert.match(panel, /errorDe\(deOtro \? dest\.error : inApp\.error \?\? push\.error \?\? dest\.error\)/);
  assert.match(sinComentarios(leer('app/perfil/notificaciones/page.tsx')), /<NotificacionesPanel [^>]*deOtro=\{deOtro\} \/>/);
});

test('el teléfono tiene por dónde entrar: «Notificaciones» en «Tu negocio», sólo mirando a un cliente', () => {
  const pagina = sinComentarios(leer('app/m/cuenta/page.tsx'));
  assert.match(pagina, /const notifDelNegocio = salida != null \? SECCIONES_CUENTA\.filter\(\(s\) => s\.key === 'notificaciones'\) : \[\];/);
  assert.match(pagina, /\[\.\.\.notifDelNegocio, \.\.\.seccionesNegocio\(await disponiblesNegocio\(\)\)\]/);
  // Y la fila abre la pantalla del negocio, no la hoja de los avisos del teléfono.
  assert.match(leer('lib/movil-rutas.ts'), /notificaciones: '\/configuraciones\/notificaciones',/);
});

test('la puerta: la agencia lee y guarda en el negocio que mira; su closer, no', () => {
  assert.deepEqual(R.quienAgencia, { ws: 19, rol: 'admin' });
  assert.equal(R.getAgencia.status, 200);
  assert.deepEqual(R.getAgencia.cuerpo.destinatarios.telefonos, ['5491130000190']);
  assert.equal(R.getAgencia.cuerpo.ws, 19);
  assert.equal(R.getCloser, 403);
  assert.equal(R.closer.status, 403);
  assert.deepEqual(R.closer.evolution, [], 'el closer no toca WhatsApp');
});

test('agregarse: entra directo al grupo de ESE cliente, y el principal sigue siendo el suyo', () => {
  assert.equal(R.alta.status, 200);
  assert.equal(R.alta.cuerpo.noAgregados, undefined);
  assert.deepEqual(R.listaTrasAlta, ['5491130000190', '5492230000684']);
  const altas = R.alta.evolution.filter((l: { ruta: string }) => l.ruta.startsWith('/group/updateParticipant'));
  assert.equal(altas.length, 1, JSON.stringify(R.alta.evolution));
  assert.ok(altas[0].ruta.includes(encodeURIComponent('grupo-19@g.us')));
  // Como jid completo: crudo, Evolution le borra el 9 de Argentina (`jidCanonico`).
  assert.deepEqual(altas[0].body.participants, ['5492230000684@s.whatsapp.net']);
});

// ⚠️ 4/11/2026: MaKo no le escribe primero a nadie (lib/mako-salida-reglas.ts). Con lo automático prendido, igual NO sale la invitación
// por DM a quien nunca le escribió a la línea: la pantalla lo dice y da el link para pasarlo a mano.
test('WhatsApp no deja agregarlo y nunca le escribió a la línea: NO sale la invitación, y la pantalla dice qué pasó y da el link', () => {
  const faltan = R.privado.cuerpo.noAgregados as Array<{ telefono: string; motivo: string }>;
  assert.equal(faltan.length, 1);
  assert.equal(faltan[0].telefono, '5491130000403');
  assert.match(faltan[0].motivo, /no deja agregarlo directo/);
  assert.match(faltan[0].motivo, /Pásale tú el link del grupo: MaKo no le escribe a un número que nunca le escribió/);
  assert.equal(R.privado.cuerpo.linkGrupo, 'https://chat.whatsapp.com/LINKDEPRUEBA');
  const invitacion = R.privado.evolution.find((l: { ruta: string }) => l.ruta.startsWith('/group/sendInvite'));
  assert.equal(invitacion, undefined, 'salió un DM con link a alguien que nunca le escribió a la línea');
  // Las dos pantallas lo dibujan.
  assert.match(sinComentarios(leer('app/perfil/DestinatariosCanal.tsx')), /noAgregados\.map/);
  assert.match(sinComentarios(leer('app/m/configuraciones/notificaciones/NotificacionesNegocioM.tsx')), /faltaGrupo\.noAgregados\.map/);
});

test('AISLAMIENTO: el cliente de otra agencia no se abre, ni con una cookie firmada a mano', () => {
  assert.equal(R.quienCookieAjena.ws, 13, 'la cookie para un cliente de otra agencia abrió ese negocio');
  assert.equal(R.ajenaTocoAlDeLaOtra, false, 'se escribió en la lista del cliente de otra agencia');
  assert.deepEqual(R.ajenaGrupos, [], 'se tocó el grupo del cliente de otra agencia');
  // Revocado: mismo corte, leído en este pedido.
  assert.equal(R.quienRevocado.ws, 13);
  assert.equal(R.revocadoTocado, false);
  // Y la cookie no es portable: en la sesión de otra agencia no abre al cliente.
  assert.equal(R.quienCookieRobada.ws, 14);
});

test('la pestaña vieja: la lista se leyó de un cliente y la sesión ya cae en otra cuenta → no se guarda', () => {
  // La cookie de la agencia dura 8 horas. Sin ella el pedido cae en la cuenta PROPIA de la agencia, sin error.
  assert.equal(R.pestanaVieja.status, 409);
  assert.match(R.pestanaVieja.cuerpo.error, /Recarga/);
  assert.deepEqual(R.pestanaVieja.evolution, [], 'no se toca WhatsApp');
  assert.equal(R.pestanaViejaPiso, false, 'pisó la lista de la agencia con la del cliente');
  // Las dos pantallas mandan de qué negocio leyeron.
  assert.match(sinComentarios(leer('app/perfil/DestinatariosCanal.tsx')), /JSON\.stringify\(\{ telefonos, emails, \.\.\.\(ws != null \? \{ ws \} : \{\}\) \}\)/);
  assert.match(sinComentarios(leer('app/m/configuraciones/notificaciones/NotificacionesNegocioM.tsx')), /\.\.\.\(wsLeido != null \? \{ ws: wsLeido \} : \{\}\)/);
});

// ROTURAS (3/11/2026), una por vez y restaurando; base 8 pases, 0 fallos. Antes del arreglo: 3 pases, 5 fallos (el bug, reproducido). Cada una dio 7/1:
//   · `contextoDeAgencia` sin revalidar la cartera · la cookie portable (sin `agenciaWs === sesion.ws`) · `puedeEntrar` sin el estado
//     (revocado cuenta como aprobado) · el POST sin `soloAdmin` · el índice sin el renglón · el índice ofreciéndosela al closer · no se
//     manda la invitación y se dice igual · sin el link del grupo · la pestaña vieja guarda igual.
