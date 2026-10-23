// =============================================================================
// «Conectar mi computadora» sin terminal: el enlace mako://conectar y la ventana del sistema (22/10/2026)
// =============================================================================
// Martín, textual: «el proceso de instalación jamás sea por Powershell, ni siquiera que se tenga que abrir, que sea una app
// de escritorio con el típico panel de "avanzar"» (docs/plan-instalador-escritorio.md, la parte 1). Lo que fija este test,
// con el programa REAL contra un MaKo de mentira (tests/_ia-pc-enlace-hijo.mjs):
//   1. del enlace sale SÓLO el código: un servidor en el enlace se ignora (con él, cualquier página se llevaría la computadora
//      y la suscripción de Claude de la persona a su MaKo); un enlace que no es de conectar no sale a la red;
//   2. la ventana pregunta a qué negocio y como quién, y si reemplaza la conexión de antes; con el «no», se suelta lo
//      pendiente y queda como estaba;
//   3. con el «sí», queda conectada y arranca; si MaKo rechaza el código o no confirma, se dice su error y no cambia nada;
//   4. la ventana es del sistema (MessageBoxW en Windows, osascript en la Mac), nunca una consola; sin poder mostrarla, «no».
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALFABETO_CODIGO, LARGO_CODIGO } from '../lib/ia-pc-reglas';

type Corrida = { salida: number; arrancado: number; pedidos: string[]; config: Record<string, any> | null; ventanas: Array<{ titulo: string; texto: string; botones: string }> };
let cache: Record<string, Corrida> | null = null;
function correr(): Record<string, Corrida> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./_ia-pc-enlace-hijo.mjs', import.meta.url))], { encoding: 'utf8', timeout: 60_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@ENLACE@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@ENLACE@@'.length));
  return cache!;
}
const programa = () => readFileSync(new URL('../scripts/ia-pc/mako-pc.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('1. del enlace sale sólo el código; el servidor del enlace se ignora; un enlace que no es de conectar no sale a la red', async () => {
  const pc = await import('../scripts/ia-pc/mako-pc.mjs');
  assert.equal(pc.codigoDelEnlace('mako://conectar?codigo=abcd-2345'), 'ABCD2345');
  assert.equal(pc.codigoDelEnlace('mako:conectar?codigo=ABCD2345'), 'ABCD2345');
  for (const malo of ['https://hola-mako.com/conectar?codigo=ABCD2345', 'mako://otro?codigo=ABCD2345', 'mako://conectar?codigo=ABCD2340', 'mako://conectar', '']) {
    assert.equal(pc.codigoDelEnlace(malo), null, malo);
  }
  // Las mismas reglas del código que el servidor.
  assert.equal(pc.ALFABETO_CODIGO, ALFABETO_CODIGO);
  assert.equal(pc.LARGO_CODIGO, LARGO_CODIGO);
  const r = correr();
  assert.deepEqual(r.malo.pedidos, [], 'un enlace que no es de conectar salió a la red');
  assert.deepEqual(r.malo.ventanas.map((v) => v.texto), ['Ese enlace no sirve: pide otro en MaKo (Tus cuentas de IA).']);
  // El enlace del «sí» traía `servidor=https://malo.example`: todo fue a hola-mako.com.
  assert.ok(r.si.pedidos.length > 0 && r.si.pedidos.every((p) => p.startsWith('hola-mako.com/')), `salió a otro servidor: ${r.si.pedidos}`);
  assert.equal(r.si.config?.servidor, 'https://hola-mako.com');
});

test('2. la ventana pregunta a qué negocio y como quién; con el «no», se suelta lo pendiente y queda como estaba', async () => {
  const r = correr();
  assert.equal(r.no.ventanas[0].botones, 'si-no');
  assert.match(r.no.ventanas[0].texto, /^¿Conectar esta computadora a «Pizzería Ana» como Ana\?/);
  assert.deepEqual(r.no.pedidos, ['hola-mako.com/api/ia-pc/emparejar', 'hola-mako.com/api/ia-pc/soltar']);
  assert.equal(r.no.config?.token, undefined);
  assert.equal(r.no.config?.pendiente, undefined, 'quedó lo pendiente después del «no»');
  assert.equal(r.no.arrancado, 0);
  assert.equal(r.no.ventanas.at(-1)?.texto, 'No la conecté: tu computadora sigue como estaba.');
  // Sin conexión de antes, el Ops Center es el del negocio del código (no «tu Ops Center»).
  assert.match(r.no.ventanas[0].texto, /El Ops Center de «Pizzería Ana» va a usar tu suscripción de Claude/);
  // Con una conexión a OTRO negocio, eso va PRIMERO (revisión del enlace: el caso del phishing).
  assert.match(r.reemplaza.ventanas[0].texto, /^Esta computadora hoy usa tu Claude para «Pizzería Ana»\. Si sigues, lo va a usar «Otro negocio», y «Pizzería Ana» se queda sin él\.\n\n¿Conectar/);
  for (const caso of ['no', 'reemplaza']) assert.doesNotMatch(r[caso].ventanas[0].texto, /Tu Ops Center/, caso);
  // Una de la 0.2.0, sin el nombre guardado, también avisa.
  assert.match(r.sinNombre.ventanas[0].texto, /^Esta computadora hoy usa tu Claude para otro negocio\. Si sigues, lo va a usar «Pizzería Ana» como Ana, y otro negocio se queda sin él\./);
  // El mismo negocio otra vez: se reemplaza, sin el aviso de cambio.
  const pc = await import('../scripts/ia-pc/mako-pc.mjs');
  assert.match(pc.preguntaDeConexion({ negocio: 'A', antes: 'A', conectada: true }), /^¿Conectar esta computadora a «A»\?[\s\S]*Hoy ya está conectada a «A»: esa conexión se reemplaza\.$/);
});

test('2b. dos enlaces a la vez: ni el «Sí» ni el «No» de una ventana tocan el pendiente de la otra', () => {
  const r = correr();
  for (const caso of ['dosSi', 'dosNo']) {
    assert.equal(r[caso].salida, 1, caso);
    assert.equal(r[caso].ventanas.at(-1)?.texto, 'Se abrió otro enlace de MaKo mientras esta ventana esperaba: desde acá no conecté nada. Contesta la otra ventana.', caso);
    assert.deepEqual(r[caso].pedidos, ['hola-mako.com/api/ia-pc/emparejar'], `${caso}: confirmó o soltó el de la otra`);
    assert.equal(r[caso].config?.pendiente?.token, 'tok-de-la-otra', caso);
    assert.equal(r[caso].config?.token, 'tok-otro', `${caso}: cambió la conexión`);
  }
});

test('3. con el «sí», queda conectada y arranca; si MaKo rechaza o no confirma, se dice y no cambia nada', () => {
  const r = correr();
  assert.equal(r.si.salida, 0);
  assert.equal(r.si.config?.token, 'tok-nuevo');
  assert.equal(r.si.config?.negocio, 'Pizzería Ana');
  assert.equal(r.si.arrancado, 1, 'no arrancó con la conexión nueva');
  assert.match(r.si.ventanas.at(-1)?.texto ?? '', /^¡Listo! Esta computadora quedó conectada a «Pizzería Ana»/);
  // La de antes se soltó al reemplazarla.
  assert.deepEqual(r.reemplaza.pedidos, ['hola-mako.com/api/ia-pc/emparejar', 'hola-mako.com/api/ia-pc/confirmar', 'hola-mako.com/api/ia-pc/soltar']);
  // MaKo rechaza el código: su error, y la conexión de antes sigue.
  assert.deepEqual(r.vencido.ventanas.map((v) => v.texto), ['Ese código ya venció o se usó: pide otro en MaKo.']);
  assert.equal(r.vencido.config?.token, 'tok-otro');
  // MaKo no confirma: su error, se suelta lo pendiente, y la de antes sigue.
  assert.equal(r.sinConfirmar.salida, 1);
  assert.equal(r.sinConfirmar.config?.token, 'tok-otro');
  assert.equal(r.sinConfirmar.config?.pendiente, undefined, 'quedó lo pendiente después de un «no confirmado»');
  assert.equal(r.sinConfirmar.arrancado, 0);
  assert.equal(r.sinConfirmar.ventanas.at(-1)?.texto, 'No pude confirmar.');
});

test('4. la ventana es del sistema (sin consola), y sin poder mostrarla es «no»; el programa abre los enlaces mako:', () => {
  const src = programa();
  const v = src.slice(src.indexOf('export async function ventana('), src.indexOf('export function arrancarConLaNueva('));
  assert.match(v, /dlopen\('user32\.dll', \{ MessageBoxW:/, 'en Windows, la ventana de user32');
  assert.match(v, /spawnSync\('osascript', \['-e', `display dialog /, 'en la Mac, osascript');
  assert.doesNotMatch(v, /powershell|cmd\.exe|Read-Host/i, 'la ventana abre una consola');
  assert.match(v, /return r === 6; \/\/ IDYES/);
  // Enter contesta «No» (revisión del enlace): MB_DEFBUTTON2 en Windows, el botón 1 («No») en la Mac.
  assert.match(v, /botones === 'si-no' \? 0x4 \| 0x20 \| 0x100 :/);
  assert.match(v, /'\{"No", "Sí, conectar"\} default button 1 cancel button 1'/);
  assert.match(v, /\n  \}\n  return false;\n\}\n/, 'sin poder mostrar la ventana, tiene que ser «no»');
  assert.match(v, /if \(botones === 'si-no' && process\.env\.MAKO_PC_SI === '1'\) return true;/, 'MAKO_PC_SI sólo para la prueba de punta a punta');
  assert.match(src, /else if \(\/\^mako:\/i\.test\(cmd\)\) conectarDesdeEnlace\(cmd\)\.then\(salir, fallar\);/);
  // Del enlace no sale el servidor: emparejar va siempre con el suyo.
  assert.match(src, /await emparejar\(\{ codigo, servidor: SERVIDOR_DEFAULT, nombre: hostname\(\) \}\)/);
});

test('5. varias computadoras: el latido manda el sistema, y la desconectada lo dice en una ventana (sólo si fue ella)', async () => {
  const pc = await import('../scripts/ia-pc/mako-pc.mjs');
  assert.equal(pc.versionConSistema('win32'), `${pc.VERSION}+windows`);
  assert.equal(pc.versionConSistema('darwin'), `${pc.VERSION}+mac`);
  assert.equal(pc.versionConSistema('linux'), pc.VERSION);
  const src = programa();
  assert.match(src, /api\(c, 'POST', '\/api\/ia-pc\/latido', \{ version: versionConSistema\(\),/);
  const d = src.slice(src.indexOf('async function desconectada('), src.indexOf('// ── Esperar turnos'));
  // Primero mira que sea SU token (reemplazada por otra conexión, no dice nada), y la ventana va al final, esperada.
  assert.ok(d.indexOf('if (c.token && c.token !== miToken) return;') < d.indexOf('await ventana('), 'la ventana sale aunque la hayan reemplazado');
  assert.match(d, /await ventana\('MaKo', `MaKo desconectó esta computadora\$\{negocio \? ` de «\$\{negocio\}»` : ''\}\. Para volver a usarla, conéctala de nuevo desde MaKo \(Tus cuentas de IA\)\.`, 'ok'\);\n\}/);
});
