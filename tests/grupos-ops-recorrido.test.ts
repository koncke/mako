// =============================================================================
// El recorrido de Joan en el grupo de la app, de punta a punta (4/11/2026)
// =============================================================================
// Martín: «dale especial atención al pedido de Joan de los grupos de WhatsApp dentro de MaKo y que eso funcione bien, que ellos puedan invitar a
// personas etcétera». Cada test es un eslabón de la cadena: quien administra abre el grupo → invita por email → al invitado le llega el aviso →
// abre el link → ve el grupo → lee, escribe, le habla a MaKo → le llegan los avisos → sale. Y quien no tiene cuenta: el mail, y el grupo al ENTRAR.
// Lo que corre de verdad (rutas, puerta, copia, turno, login), en tests/_grupos-ops-recorrido-hijo.ts. Un eslabón que no llega es rojo.
//
// PROBADO ROMPIÉNDOLO: al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
let corrida: Record<string, any> | null = null;
let fallo: unknown = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  if (fallo) throw fallo;
  try {
    const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_grupos-ops-recorrido-hijo.ts')], {
      cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
    corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
    return corrida;
  } catch (e) { fallo = e; throw e; }
}

test('1. quien administra abre el grupo de su negocio', () => {
  const a = R().abre;
  assert.equal(a.lista, 200);
  assert.deepEqual(a.ws, [10]);
  assert.equal(a.hilo, 200);
});

test('2-3. invita por email, y al invitado le llegan el push y el mail, con el link al grupo', () => {
  assert.equal(R().invita, 200);
  const v = R().aviso;
  assert.ok(v.push, 'no le llegó el push');
  assert.equal(v.push.titulo, 'Invitación de Fiesta');
  assert.match(v.push.url, /\/second-brain\?grupo=10$/, 'el push no abre el grupo');
  assert.ok(v.mail, 'no le llegó el mail');
  assert.equal(v.mail.link, true, 'el mail no lleva el link al grupo');
});

test('4. el link abre el grupo, también desde el teléfono, y el grupo está en su lista', () => {
  const l = R().link;
  assert.deepEqual(l.desvio, { tipo: 'movil', destino: '/m/second-brain?grupo=10' }, 'desde el teléfono, el link tiene que caer en el grupo');
  assert.equal(l.pedido.tipo, 'reescribir');
  assert.equal(l.pedido.destino, '/m/second-brain?grupo=10');
  const g = R().lista;
  assert.equal(g.status, 200);
  assert.equal(g.seVe, true, 'el grupo no se ve en la lista sin «Ver todos»');
  assert.equal(g.invitado, true);
});

test('5. lee, escribe y MaKo le contesta en el hilo, sin tocar WhatsApp', () => {
  const l = R().lee;
  assert.equal(l.status, 200);
  assert.deepEqual(l.textos, ['sistema: Joan entró al grupo.']);
  const e = R().escribe;
  assert.equal(e.status, 200);
  assert.deepEqual(e.textos.slice(-2), ['persona: mako, buenas', 'mako: Hola, Joan.'], 'MaKo no le contestó');
  assert.equal(e.evolution, 0, 'lo que se escribe en la app no sale por WhatsApp');
});

test('6. le llegan los avisos del negocio', () => {
  assert.equal(R().avisos.length, 1, 'el aviso no cayó en el grupo de la app');
});

test('7. sale, y deja de ver el grupo', () => {
  const s = R().sale;
  assert.equal(s.status, 200);
  assert.equal(s.despues, 404);
  assert.equal(s.enLaLista, false);
});

test('sin cuenta: la misma respuesta, le llega el mail, y ve el grupo al ENTRAR con ese email (no al crear la cuenta)', () => {
  const c = R().sinCuenta;
  assert.equal(c.status, 200);
  assert.equal(c.mismaRespuesta, true, 'si la respuesta distingue, invitar sirve para averiguar quién usa MaKo');
  assert.ok(c.mail, 'a quien no tiene cuenta no le llegó nada: queda anotado y nunca se entera');
  assert.match(c.mail.texto, /^Ana te invitó a su grupo de MaKo\./);
  assert.equal(c.mail.link, true);
  assert.equal(c.conCuentaSinEntrar, 404, 'crear la cuenta no prueba que el email sea suyo: recién al entrar');
  assert.equal(c.alEntrar, 200, 'entró con ese email y no ve el grupo');
  assert.equal(c.enLaLista, true);
  assert.equal(c.usuariosCreados, 1, 'invitar no crea cuentas');
});

// PROBADO ROMPIÉNDOLO (4/11/2026): una por vez, sobre el código real y restaurada; base 7/0, y las 4 en rojo:
//   · sin aviso a quien no tiene cuenta (`if (usuario)` antes de `avisarInvitacion`) → 1 en rojo: «sin cuenta»
//   · `registrarLogin` sin atar la invitación → 1 en rojo: «sin cuenta»
//   · el aviso sin la copia al grupo de la app (`enviarPartesAlGrupoMaKo` sin `copiarAlGrupo`) → 1 en rojo: «6. le llegan los avisos»
//   · salir no marca `salio_at` → 1 en rojo: «7. sale»
