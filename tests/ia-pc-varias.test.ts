// =============================================================================
// Varias computadoras por persona, «Desconectar», y el panel del super admin (22/10/2026)
// =============================================================================
// Martín, textual: «el usuario debería poder abrir y ejecutar su Claude en varios dispositivos, por ejemplo, ahora abrí la
// cuenta de Mauricio e instalé MaKo desktop para conectarme a su claude, pero luego él va a querer hacerlo en su PC, se
// debería poder ver eso... Lo mismo en SuperAdmin. Y poder "Desconectar" dispositivos». Lo que fija este test (lib/ia-pc.ts
// REAL contra un PostgREST de mentira, tests/_ia-pc-varias-hijo.ts):
//   1. conectar otra no suelta la que había: la de Martín en la cuenta de Mauricio NO se pierde;
//   2. el turno va a una que conteste; con varias, a la que contestó el último turno (no salta cada 30 s), sin turnos a la
//      última conectada, y si una se apaga, a la que queda;
//   3. cada una dice su sistema (desde la 0.4.0) y cuándo se conectó; la tarjeta ofrece «Conectar otra computadora»;
//   4. el super admin ve las de todos los negocios, sin secretos, con «Desconectar»; desconectar revoca al instante (su token
//      ya no sirve, y sale del turno y de las listas), y con el negocio equivocado no toca nada.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { detalleDeLaPc, elegirPc, sistemaDeLaVersion, type PcDeNegocio } from '../lib/ia-pc-reglas';
import { VistaComputadoras } from '../app/admin/operaciones/UsoComputadoras';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_ia-pc-varias-hijo.ts', import.meta.url))], { encoding: 'utf8', timeout: 120_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@VARIAS@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@VARIAS@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}

test('1. conectar otra no suelta la que había (la de Martín en la cuenta de Mauricio no se pierde)', () => {
  const r = correr();
  assert.deepEqual(r.listadas.map((p: { nombre: string }) => p.nombre).sort(), ['PC de Martín', 'PC de Mauricio']);
});

test('2. el turno: a una que conteste; con varias, la del último turno; sin turnos, la última conectada; apagada, la otra', () => {
  const r = correr();
  assert.equal(r.sinTurnos, 'PC de Mauricio', 'sin turnos, la última conectada');
  assert.equal(r.conTurno, 'PC de Martín', 'la que contestó el último turno');
  assert.equal(r.apagada, 'PC de Mauricio', 'con la del último turno apagada, la que está en línea');
  // Revisión adversarial: la que falló su último turno, o tiene la cuenta agotada, va al final (no queda pegado a ella).
  assert.equal(r.fallo, 'PC de Mauricio', 'el turno quedó pegado a la que falló el último');
  assert.equal(r.agotada, 'PC de Martín', 'el turno fue a la que tiene la cuenta agotada');
  // Puro: sin ninguna que conteste, la que latió último (el turno dice apagada o sin sesión).
  const pc = (id: number, enLinea: boolean, cuentas: number, latido: string | null, conectadaAt: string | null = null) => ({ id, enLinea, cuentas: Array(cuentas).fill({}), ultimoLatido: latido, conectadaAt });
  assert.equal(elegirPc([pc(1, false, 1, '2026-10-22T10:00:00Z'), pc(2, false, 1, '2026-10-22T11:00:00Z')], new Map())?.id, 2);
  assert.equal(elegirPc([pc(1, true, 0, '2026-10-22T12:00:00Z'), pc(2, true, 1, '2026-10-22T11:00:00Z')], new Map())?.id, 2, 'en línea sin sesión no contesta');
  assert.equal(elegirPc([], new Map()), null);
  // Las dos fallaron: primero la que falló hace más (se turnan).
  const fallaron = new Map([[1, { at: '2026-10-22T12:00:00Z', ok: false }], [2, { at: '2026-10-22T11:00:00Z', ok: false }]]);
  assert.equal(elegirPc([pc(1, true, 1, null), pc(2, true, 1, null)], fallaron)?.id, 2);
});

test('3. cada una dice su sistema y cuándo se conectó; la tarjeta ofrece «Conectar otra computadora»', () => {
  const r = correr();
  assert.deepEqual(r.listadas.find((p: { nombre: string }) => p.nombre === 'PC de Mauricio'), { nombre: 'PC de Mauricio', sistema: 'Windows', conectada: true, enLinea: true });
  assert.equal(sistemaDeLaVersion('0.4.0+mac'), 'Mac');
  assert.equal(sistemaDeLaVersion('0.3.2'), null, 'las de antes no lo dicen: no se muestra');
  assert.equal(detalleDeLaPc({ sistema: 'Windows', conectadaAt: '2026-10-22T12:00:00Z' }, () => '22/10'), 'Windows · conectada el 22/10');
  assert.equal(detalleDeLaPc({ sistema: null, conectadaAt: null }, () => 'x'), null, 'sin dato, no se muestra');
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  assert.match(ui, /<button type="button" className="tci-boton tci-boton--suave" onClick=\{abrirTutorial\}>Conectar otra computadora<\/button>/);
  assert.match(ui, /detalleDeLaPc\(pc, fechaCorta\)/);
  assert.match(sinComentarios(leer('app/api/ia-pc/estado/route.ts')), /conectadaAt: d\.conectadaAt, sistema: d\.sistema,/);
});

test('4. el super admin: las de todos, sin secretos, con «Desconectar»; desconectar revoca al instante, y sólo en su negocio', () => {
  const r = correr();
  assert.deepEqual(r.todas.map((p: { ws: number; nombre: string }) => [p.ws, p.nombre]), [[1, 'PC de Mauricio'], [1, 'PC de Martín'], [13, 'MacBook de Ana']]);
  assert.equal(r.todas[0].negocio, 'Mauricio Bustos');
  assert.equal(r.secretos, null, 'la lista del super admin lleva un token o un hash');
  assert.deepEqual(r.despues.listadas, ['PC de Martín'], 'la desconectada sigue en la lista');
  assert.equal(r.despues.turno, 'PC de Martín', 'el turno siguió yendo a la desconectada');
  assert.equal(r.despues.tokenSirve, false, 'el token de la desconectada sigue sirviendo');
  assert.deepEqual(r.despues.todas, ['PC de Martín', 'MacBook de Ana']);
  assert.equal(r.otroWs, true, 'desconectar con el negocio equivocado tocó otra');
  // Revisión adversarial: desconectada en el medio, el turno no se le da (queda vencido) y sus herramientas no se piden.
  assert.equal(r.tomadaRevocada, null, 'una PC desconectada recibió el turno');
  assert.equal(r.turnoRevocado, 'vencido');
  assert.equal(r.llamadaRevocada, null, 'una PC desconectada pidió una herramienta');
  assert.deepEqual(r.herramientaRevocada, { corrio: false, salida: 'El turno se cortó: no se corrió.' }, 'corrió una herramienta de una PC desconectada');
  assert.match(sinComentarios(leer('lib/ia-pc.ts')), /if \(t\.error\) throw new Error\(`ia-pc: la desconecté, pero no pude cortar su turno/);
  // Las acciones son del super admin (tests/operaciones.test.ts mira la puerta de cada una).
  const acc = sinComentarios(leer('app/admin/operaciones/acciones.ts'));
  for (const n of ['computadorasAction', 'desconectarComputadoraAction']) {
    const i = acc.indexOf(`export async function ${n}(`);
    assert.ok(i > 0 && /if \(!puedeOperar\(admin, await wsSuperAdmin\(\)\)\) return \{ ok: false, error: NO_PUEDE \};/.test(acc.slice(i, i + 400)), `${n} sin la puerta del super admin`);
  }
  // La pantalla, por negocio y persona, con «Desconectar» que pide confirmar.
  const pcs: PcDeNegocio[] = [
    { id: 1, ws: 1, negocio: 'Mauricio Bustos', persona: 'mauricio@negocio.com', nombre: 'PC de Mauricio', sistema: 'Windows', enLinea: true, conClaude: true, conectadaAt: '2026-10-22T12:00:00Z', ultimoLatido: new Date().toISOString() },
    { id: 2, ws: 1, negocio: 'Mauricio Bustos', persona: 'mauricio@negocio.com', nombre: 'PC de Martín', sistema: null, enLinea: false, conClaude: true, conectadaAt: null, ultimoLatido: '2026-10-22T10:00:00Z' },
  ];
  const html = renderToStaticMarkup(createElement(VistaComputadoras, { lectura: { ok: true, pcs }, ahora: Date.parse('2026-10-22T12:30:00Z'), onDesconectar: () => {} }));
  assert.match(html, /Computadoras.*1 de 2 en línea/);
  assert.match(html, /Mauricio Bustos \(ws1\)/);
  assert.match(html, /PC de Mauricio.*En línea.*Windows · conectada el/);
  assert.match(html, /PC de Martín.*Sin conexión/);
  assert.equal((html.match(/>Desconectar</g) ?? []).length, 2);
  // En la computadora y en el teléfono.
  assert.match(sinComentarios(leer('app/admin/operaciones/Uso.tsx')), /<SeccionComputadoras leer=\{onLeerComputadoras\} desconectar=\{onDesconectarComputadora\} ahora=\{ahora\} \/>/);
  assert.match(sinComentarios(leer('app/m/operaciones/RunnerMovil.tsx')), /<SeccionComputadoras leer=\{onLeerComputadoras\} desconectar=\{onDesconectarComputadora\} ahora=\{ahora\} \/>/);
  assert.match(sinComentarios(leer('app/m/operaciones/CentroAppMovil.tsx')), /onLeerComputadoras=\{k\.leerComputadoras\} onDesconectarComputadora=\{k\.desconectarComputadora\}/);
});
