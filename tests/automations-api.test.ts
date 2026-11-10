// =============================================================================
// Automations por la API de MaKo: lo que la pantalla hacía y la API no (10/11/2026)
// =============================================================================
// Martín, 9/11/2026: «todo lo anterior documentado en la API: todo tiene que estar documentado en la API». Leandro configura
// Automations con su Claude y la API no tenía: las plantillas de la galería, crear desde una, duplicar, «Volver a probar» con un
// lead (cerradas por una regla de la tanda, no por un motivo de datos), ni renombrar ni «quién espera en cada tarjeta y por qué».
//
// Lo que fija este archivo:
//   1. las seis salen por HTTP, con su ruta REST; las que le escriben a una persona real (inscribir, empezar de nuevo, la
//      difusión) y la que cancela para siempre (sacar) siguen cerradas, con su motivo (docs/relevo/nube-automations-manychat.md);
//   2. renombrar, por un token detallado de verdad (`aplicarEnElActo`): cambia nombre y emoji, «ya está así» es un éxito sin
//      cambios, un emoji que no es emoji no toca el nombre, y la de otro negocio no existe;
//   3. «quién espera»: cuántos y por qué por tarjeta, con el MISMO motivo que el chip del lienzo, sin un solo nombre de lead.
//
// Probado rompiéndolo (10/11/2026, base 3/0):
//   · `renombrar_automatizacion` sin el emoji primero (nombre y después emoji) → 1 rojo (con un emoji malo, el nombre cambia igual).
//   · `espera_por_tarjeta` con el nombre del lead en cada tarjeta → 1 rojo.
//   · `duplicar_automatizacion` de vuelta en SIN_HTTP → 1 rojo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { REGISTRO } from '../lib/api-mako/registro';
import { RUTAS_REST } from '../lib/api-mako/rest';

const RAIZ = join(__dirname, '..');
type Escena = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let cache: Map<string, Escena> | null = null;
function escena(nombre: string): Escena {
  if (!cache) {
    const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', join(RAIZ, 'tests/_automations-api-hijo.ts')], {
      cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000,
    });
    if (r.status !== 0) throw new Error(`el hijo salió con ${r.status}: ${r.stderr.slice(-2000)}`);
    cache = new Map();
    for (const l of r.stdout.split('\n')) if (l.startsWith('@@AUT_API@@')) { const e = JSON.parse(l.slice(11)) as Escena; cache.set(e.nombre, e); }
  }
  const e = cache.get(nombre);
  assert.ok(e, `falta la escena «${nombre}»`);
  return e;
}
const resultado = (r: Escena) => JSON.parse(r.resultado as string) as Escena;

test('1. lo que se abrió sale por HTTP con su ruta; lo que le escribe a alguien sigue cerrado', () => {
  const http = (id: string) => (REGISTRO.find((d) => d.id === id)?.canales as readonly string[] | undefined)?.includes('http');
  for (const id of ['listar_plantillas_automatizaciones', 'crear_automatizacion_desde_plantilla', 'duplicar_automatizacion', 'volver_a_probar_lead_secuencia', 'renombrar_automatizacion', 'espera_por_tarjeta']) {
    assert.equal(http(id), true, `${id} sale por HTTP`);
    assert.ok(RUTAS_REST.some(([, , op]) => op === id), `${id} tiene su ruta REST`);
  }
  for (const id of ['inscribir_lead_secuencia', 'empezar_de_nuevo_lead_secuencia', 'difundir_a_leads', 'sacar_lead_de_secuencia']) assert.equal(http(id), false, `${id} no sale por HTTP`);
});

test('2. renombrar: nombre y emoji, «ya está así», un emoji malo no toca nada, la de otro negocio no existe', () => {
  const e = escena('renombrar');
  assert.equal(e.r1.ok, true, JSON.stringify(e.r1));
  assert.equal(e.nombreFila, 'Bienvenida nueva', 'el nombre se guarda saneado');
  assert.equal(e.emoji, '🎉');
  assert.equal(e.igual.ok, true, '«ya está así» es un éxito sin cambios (un PUT idempotente)');
  assert.equal(e.igual.via, 'ninguna');
  assert.equal(e.vacio.ok, false);
  assert.match(e.vacio.resumen, /Pasa el nombre nuevo/);
  assert.equal(e.noEmoji.ok, false);
  assert.match(e.noEmoji.resumen, /no es un emoji/);
  assert.equal(e.nombreTrasNoEmoji, 'Bienvenida nueva', 'con el emoji malo, el nombre tampoco cambió');
  assert.equal(e.ajeno.ok, false);
  assert.equal(e.nombre42, 'De otro negocio');
});

test('3. quién espera: cuántos y por qué por tarjeta, sin nombres de leads', () => {
  const e = escena('espera');
  const vacia = resultado(e.vacia);
  assert.deepEqual(vacia.tarjetas, []);
  assert.match(vacia.nota, /Nadie está esperando/);
  const dos = resultado(e.conDos);
  assert.equal(dos.total, 2);
  assert.equal(dos.tarjetas.length, 1);
  assert.deepEqual([dos.tarjetas[0].tarjeta, dos.tarjetas[0].esperando], ['m1', 2]);
  assert.match(dos.tarjetas[0].porQue, /WhatsApp/);
  assert.match(dos.tarjetas[0].texto, /^Hola, te escribo/);
  assert.doesNotMatch(e.conDos.resultado, /Lead Secreto|5215511/, 'ni nombres ni teléfonos');
  assert.equal(e.otra.ok, false, 'la de otro negocio no existe');
});
