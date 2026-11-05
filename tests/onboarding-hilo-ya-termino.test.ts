// =============================================================================
// El chat «Onboarding» también para quien ya terminó, nunca con el chat del super admin, y con la salida (20/10/2026)
// =============================================================================
// Martín (20/10): «en el caso de Florencia, debería haber llegado a un chat llamado "Onboarding" en su Ops Center... Y no
// llegó». El hilo (b222b34fc) sólo nacía en la pantalla del onboarding al llegar a 'listo', y /onboarding redirige a quien
// ya terminó: Florencia (ws21, terminó el 18/10) tenía 0 chats. De la llamada del 18/10 (Fathom 864249059): al terminar,
// nadie le preguntó por dónde empezar ni le dijo dónde pedir ayuda, y lo que contestó a «¿qué resolver primero?»
// (`interes`) se guardaba y nadie lo leía. docs/hallazgos-onboarding.md, «Florencia (ws21, 18/10)».
//
// ROTURAS (20/10/2026, arnés romper.js + roturas-hilo.json del scratchpad; base 4/0): el Ops Center no lo crea → 3/1 · sin
// la guarda del super admin → 3/1 · crea otro en vez de reusar → 3/1 · la salida no usa el interés → 3/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TITULO_HILO, mensajesDelHilo, salidaDelOnboarding } from '../lib/onboarding-arranque';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el hilo: la conversación tal cual, el adjunto sin texto con su nombre, y al final la salida', () => {
  const ms = mensajesDelHilo([
    { de: 'mako', texto: '¿Qué vendes?' },
    { de: 'yo', texto: '', adjuntos: [{ nombre: 'mi-oferta.docx' }] },
    { de: 'yo', texto: '   ' },
    { de: 'mako', texto: '¡Gracias!' },
  ], { nombre: 'Ana López', telefonoVerificado: true });
  assert.deepEqual(ms.slice(0, 3), [
    { role: 'assistant', content: '¿Qué vendes?' },
    { role: 'user', content: 'Adjunto: mi-oferta.docx' },
    { role: 'assistant', content: '¡Gracias!' },
  ]);
  assert.equal(ms.at(-1)?.content, salidaDelOnboarding({ nombre: 'Ana López', telefonoVerificado: true }));
});

test('la salida es corta, sin preguntas sueltas, y nombra el grupo sólo con el teléfono verificado', () => {
  // 5/11/2026 (docs/mako-iniciativa/plan.md §3.2, paso 15): se fueron el «¿arrancamos por ahí?» sin botones y la lista de lo que
  // MaKo «también puede»; lo que sigue lo pregunta la escalera del Ops Center con sus botones. El grupo de WhatsApp existe con el
  // teléfono verificado: sin él (el paso se salta con «Ahora no»), prometerlo era mentir.
  assert.equal(salidaDelOnboarding({ nombre: 'Ana López', telefonoVerificado: true }),
    'Listo, Ana: ya conozco tu negocio. Si algo no funciona, escríbeme aquí o en tu grupo de WhatsApp y abro un ticket.');
  assert.equal(salidaDelOnboarding({ nombre: 'Ana', telefonoVerificado: false }),
    'Listo, Ana: ya conozco tu negocio. Si algo no funciona, escríbeme aquí y abro un ticket.');
  assert.equal(salidaDelOnboarding({ nombre: '', telefonoVerificado: false }), 'Listo: ya conozco tu negocio. Si algo no funciona, escríbeme aquí y abro un ticket.');
  for (const t of [true, false]) assert.doesNotMatch(salidaDelOnboarding({ nombre: 'Ana', telefonoVerificado: t }), /\?/, 'ninguna pregunta que no se pueda contestar con un toque');
});

test('se crea UNA vez, con el chart_key del cliente: mirando como super admin, no', () => {
  const srv = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  const hilo = srv.slice(srv.indexOf('export async function hiloDelOnboarding('), srv.indexOf('export async function hiloParaQuienYaTermino('));
  assert.match(hilo, /^export async function hiloDelOnboarding\(\): Promise<number \| null> \{\s*if \(await estaImpersonando\(\)\.catch\(\(\) => true\)\) return null;/,
    'lo primero es no crearlo con el chart_key de quien mira');
  // Desde la revisión del 20/10 se reconoce por su marca (`contextoDelHilo`), no por el título, y se reserva antes de crear
  // (tests/onboarding-hilo-carrera.test.ts lo prueba con la base de mentira).
  assert.match(hilo, /if \(!raw \|\| !\(await cambiarSettingSi\(CLAVE, raw, reservado\)\)\) return null;/, 'sin la reserva, dos pestañas crean dos');
  assert.match(hilo, /for \(const s of sesiones\.filter\(\(x\) => x\.contexto === marca\)\) await deleteSession\(s\.id\);/, 'uno a medias se borra y se rehace');
  assert.equal(TITULO_HILO, 'Onboarding');
});

test('quien ya terminó lo recibe en su primera visita al Ops Center, y entra a él', () => {
  const srv = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  const relleno = srv.slice(srv.indexOf('export async function hiloParaQuienYaTermino('));
  assert.match(relleno, /if \(e\.hiloChat \|\| \(!e\.nombre && !e\.sesionId\)\) return null;/);
  assert.match(relleno, /if \(!capaDef\(await getCapaActual\(\)\)\.onboarding\.includes\('productos'\)\) return null;/, 'la misma regla que el final: el Project Manager no');
  assert.match(relleno, /if \(\(await getEstadoOnboarding\(\)\)\.status !== 'done'\) return null;/);
  assert.match(relleno, /if \('error' in \(await wsDelOnboarding\(\)\)\) return null;/, 'un closer o un setter no se lo lleva');
  const pagina = sinComentarios(leer('app/second-brain/page.tsx'));
  assert.match(pagina, /const hiloNuevo = await hiloParaQuienYaTermino\(\)\.catch\(\(\) => null\);\s*if \(hiloNuevo\) redirect\(await rutaConWs\(rutaDelHilo\(hiloNuevo\)\)\);/);
});
