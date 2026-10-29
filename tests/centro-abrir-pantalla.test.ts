// =============================================================================
// «Abrir» en «Nuevo chat»: la pantalla del clic (Ops Center, 17/10/2026)
// =============================================================================
// Martín: «un clic + el permiso de la PC», nunca pegar un comando en PowerShell. La PC abre (tests/centro-abrir.test.ts);
// esto fija la pantalla, en la computadora y en el teléfono:
//   · «Abrir» aparece sólo para una cuenta de TERMINAL cuyo Runner abre (cartero 1.11.0): con uno de antes, el trabajo
//     quedaría escrito para siempre y nadie lo diría;
//   · el nombre se mira con la MISMA lista blanca que la firma, antes de firmar;
//   · se firma por el único camino (mandar.ts), con `destino: 'nuevo'`;
//   · «Nuevo chat» dice cómo va el último que se pidió (un trabajo `nuevo` no es de ningún chat de la lista), y qué hacer
//     si no se abre;
//   · copiar el comando queda de segunda opción.
//
// ⚠️ Probado ROMPIÉNDOLO (17/10/2026), una rotura por vez contra la base en verde de 5 pases:
//   · puedeAbrirEn sin mirar que la cuenta sea de terminal → 1 fallo;
//   · estadoDeApertura con el PRIMERO y no el último → 1 fallo;
//   · sePuedeAbrir sin mirar el nombre → 1 fallo;
//   · la hoja del teléfono con «Abrir» sin preguntar si esa cuenta abre → 1 fallo;
//   · versionAlMenos comparando texto («1.10.0» < «1.9.1») → 1 fallo.
//   Restaurado de memoria (no con git checkout): 5 pases.
// Lo que el test NO ve: el modal y la hoja pintados (no hay navegador en estos tests).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERSION_ABRIR, aceptaAbrir, aceptaAdjuntos, versionAlMenos } from '../lib/operaciones-reglas';
import { estadoDeApertura, primerMensajeNuevo } from '../lib/centro-chats';
import { sePuedeAbrir } from '../app/admin/operaciones/NuevoChat';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('«Abrir» sólo con el cartero que abre; la versión se compara por número', async () => {
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  assert.ok(aceptaAbrir(cartero.VERSION), `el cartero ${cartero.VERSION} abre (${VERSION_ABRIR})`);
  assert.equal(aceptaAbrir('1.10.0'), false, 'el instalado hoy no abre');
  assert.equal(aceptaAbrir('1.11.0'), false, 'la 1.11.0 tenía los defectos de la revisión de seguridad: no habilita «Abrir»');
  assert.ok(aceptaAbrir('1.12.0') && aceptaAbrir('2.0.0') && aceptaAbrir('1.11.3'));
  assert.equal(aceptaAbrir(null), false);
  assert.ok(versionAlMenos('1.10.0', '1.9.1'), '«1.10.0» es mayor que «1.9.1» (como texto sería menor)');
  assert.ok(aceptaAdjuntos('1.10.0') && !aceptaAdjuntos('1.9.0'), 'los adjuntos siguen con su versión');
});

test('el nombre se mira con la lista blanca ANTES de firmar', () => {
  assert.equal(sePuedeAbrir({ nombre: 'CRM › Lead Detail', cuenta: 'claude2' }, true), true);
  assert.equal(sePuedeAbrir({ nombre: '  CRM   Funnels ', cuenta: 'claude2' }, true), true, 'los espacios de más se limpian como al firmar');
  for (const n of ['CRM"', "O'Brien", '$(calc)', '--x', '']) assert.equal(sePuedeAbrir({ nombre: n, cuenta: 'claude2' }, true), false, n);
  assert.equal(sePuedeAbrir({ nombre: 'CRM', cuenta: 'claude2' }, false), false, 'sin un Runner que abra, no');
  assert.equal(primerMensajeNuevo('CRM'), 'Hola, eres el chat «CRM». Lee AGENTS.md y espera instrucciones.');
});

test('«Nuevo chat» dice cómo va el ÚLTIMO que se pidió abrir, y qué hacer si no se abre', () => {
  const w = (titulo: string, at: string, estado: string, motivo: string | null = null) =>
    ({ destino: 'nuevo', destino_titulo: titulo, created_at: at, estado: estado as never, motivo });
  const chat = { destino: 'local_0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601', destino_titulo: 'CRM', created_at: '2026-10-17T12:30:00Z', estado: 'escrito' as never, motivo: null };
  assert.equal(estadoDeApertura([chat]), null, 'un trabajo para un chat no es una apertura');
  const viejo = w('Pagos', '2026-10-17T10:00:00Z', 'entregado', 'Se pidió abrir «Pagos» en la terminal de la cuenta 2: mira que aparezca en la lista');
  const nuevo = w('CRM › Funnels', '2026-10-17T12:00:00Z', 'escrito');
  assert.match(estadoDeApertura([nuevo, viejo, chat])!, /^«CRM › Funnels»: espera al Runner\. .*«prende la apertura de chats»/);
  assert.match(estadoDeApertura([viejo, nuevo])!, /^«CRM › Funnels»/, 'el último, aunque venga después en la lista');
  assert.equal(estadoDeApertura([viejo])!, '«Pagos»: se pidió abrir en la terminal de la cuenta 2: mira que aparezca en la lista');
  assert.equal(estadoDeApertura([w('X', '2026-10-17T12:00:00Z', 'no_entregado', 'Prende la apertura de chats en la PC: pídeselo al Runner')])!,
    '«X»: no se abrió · Prende la apertura de chats en la PC: pídeselo al Runner');
});

test('el motor firma la apertura por mandar.ts, sólo para una terminal con el cartero que abre', () => {
  const motor = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  assert.match(motor, /const puedeAbrirEn = \(cuenta: string\) => tieneTerminal\(cuenta\) && carteros\.some\(\(k\) => k\.cuenta === cuenta && aceptaAbrir\(k\.version\)\)/);
  const abrir = motor.slice(motor.indexOf('async function abrirChat'), motor.indexOf('async function mandar'));
  assert.match(abrir, /problemaDeNombreNuevo\(nombre\)/, 'la lista blanca antes de firmar');
  assert.match(abrir, /firma\.mandar\(\{ sesion: DESTINO_NUEVO, cuenta: b\.cuenta, titulo: nombre \}/, 'por el único camino que firma');
});

// Desde el 17/10/2026 (22:50) «Nuevo chat» no abre un modal ni una hoja de formulario (tests/centro-nuevo-chat.test.ts): abre un chat
// vacío (ChatNuevo.tsx) y la cuenta la elige MaKo. Lo que se fijaba acá sigue valiendo, en su lugar nuevo.
test('«Nuevo chat» abre sólo en una cuenta cuyo Runner abre, dice cómo va, y copiar el comando queda de último recurso', () => {
  const motor = sinComentarios(leer('app/admin/operaciones/ChatNuevo.tsx'));
  assert.match(motor, /const abren = CUENTAS_TERMINAL\.filter\(\(c\) => k\.puedeAbrirEn\(c\)\);/, '«Abrir» sólo en una cuenta que abre');
  // Con archivos (28/10/2026), de ésas, las que los llevan a un chat nuevo: siempre un subconjunto de las que abren.
  assert.match(motor, /const conArchivos = fs\.length \? abren\.filter\(\(c\) => k\.adjuntaEnNuevo\(c\)\) : abren;/);
  assert.match(motor, /cuentaParaChatNuevo\(conArchivos\.length \? conArchivos : abren,/);
  assert.match(motor, /if \(!cuenta\) \{ setFase\('sin_forma'\); return; \}/, 'y si ninguna abre, lo dice');
  assert.match(motor, /k\.abrirChat\(\{ nombre: d\.nombre, cuenta, texto: enviado, archivos: fs \}\)/);
  const piezas = sinComentarios(leer('app/admin/operaciones/ChatNuevoPiezas.tsx'));
  assert.match(piezas, /Copiar comando/, 'el comando sigue, sólo cuando ninguna cuenta abre');
  assert.match(piezas, /n\.apertura \?\? 'Abriéndolo en la PC…'/, 'dice cómo va el último que se pidió');
  const tel = sinComentarios(leer('app/m/operaciones/ChatsMovil.tsx'));
  assert.match(tel, /useChatNuevo\(centro, onAbrir\)/, 'el teléfono usa el mismo motor');
});
