// =============================================================================
// La nevera del Marketing CoPilot avisa sola (14/11/2026)
// =============================================================================
// Martín a Julio (13/11): si te quedas sin contenido, MaKo «te va mandando mensajes por WhatsApp y por email». Fija:
//   · el texto del aviso: un renglón por formato que falta, el mismo de la tarea del Plan; nada si no falta nada;
//   · la huella: la misma semana y los mismos formatos no se repiten; otra semana u otro formato, sí;
//   · el cron y la pantalla llegan a la MISMA clave del Plan (tareasDeLaNevera), y lo cubierto queda resuelto;
//   · el aviso nace prendido y por los DOS canales, y figura en Notificaciones para poder apagarlo.
// Correr: node --import tsx --test tests/copiloto-nevera-aviso.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { armarNevera, avisosDeLaNevera, huellaAvisoNevera, textoAvisoNevera, type PiezaNevera } from '../lib/copiloto/nevera-reglas';
import { tareasDeLaNevera } from '../lib/copiloto/tareas';
import { CATALOGO_AVISOS } from '../lib/avisos-catalogo';
import { AVISOS_WA_EN_VIVO } from '../lib/notif-catalogo';

const HOY = '2026-11-14'; // sábado
const pieza = (formato: string, dia: string, o: Partial<PiezaNevera> = {}): PiezaNevera => ({ formato, red: formato === 'video' ? 'youtube' : 'instagram', dia, conArchivo: true, publicada: false, hecha: false, ...o });
// 2 reels listos (hasta el martes 18) con ritmo de 3; ningún video largo con ritmo de 1; historias y carruseles cubiertos.
const piezas = [pieza('reel', '2026-11-16'), pieza('reel', '2026-11-18'), pieza('post', '2026-11-22'), pieza('story', '2026-11-23')];
const filas = armarNevera(piezas, HOY, { reel: 3, post: 1, story: 1, video: 1 });
const avisos = avisosDeLaNevera(filas, null);

test('el texto: un renglón por formato que falta, el mismo de la tarea; nada si no falta nada', () => {
  const m = textoAvisoNevera(avisos);
  assert.ok(m);
  assert.equal(m.titulo, 'Necesito más contenido');
  assert.match(m.texto, /^🎬 \*Necesito más contenido\*\n\n/);
  assert.ok(m.texto.includes('• Graba 3 reels: te alcanzan hasta el miércoles 18.'), m.texto);
  assert.ok(m.texto.includes('• Graba 1 video largo: no tienes ninguno listo.'), m.texto);
  assert.ok(m.texto.endsWith('Ya quedó en tu Plan. — MaKo'));
  assert.equal(textoAvisoNevera([]), null);
});

test('la huella: misma semana y formatos, igual; otro lunes u otro formato, distinta', () => {
  const h = huellaAvisoNevera('2026-11-09', avisos);
  assert.equal(h, '2026-11-09:reel,video');
  assert.equal(huellaAvisoNevera('2026-11-09', [...avisos].reverse()), h, 'el orden no cambia la huella');
  assert.notEqual(huellaAvisoNevera('2026-11-16', avisos), h);
  assert.notEqual(huellaAvisoNevera('2026-11-09', avisos.filter((a) => a.formato === 'reel')), h);
});

test('el cron y la pantalla llegan a la misma clave del Plan; lo cubierto queda resuelto', () => {
  const { tareas, resueltas } = tareasDeLaNevera({ lunes: '2026-11-09', avisos });
  assert.deepEqual(tareas.map((t) => t.clave), ['instagram:nevera-reel-20261109', 'youtube:nevera-video-20261109']);
  assert.ok(tareas.every((t) => t.href === '/calendario'));
  assert.deepEqual(resueltas.sort(), ['instagram:nevera-post-20261109', 'instagram:nevera-story-20261109']);
});

test('el aviso nace prendido, por WhatsApp y email, y se puede apagar en Notificaciones', () => {
  const a = CATALOGO_AVISOS.find((c) => c.id === 'copiloto-nevera');
  assert.ok(a, 'falta en el catálogo');
  assert.equal(a.porDefecto, 'on');
  assert.deepEqual(a.canales, { wa: true, email: true });
  assert.equal(a.textoDelCodigo, true, 'el texto lo arma el código: la plantilla guardada no sale');
  assert.ok(AVISOS_WA_EN_VIVO.some((x) => x.id === 'copiloto-nevera'), 'sin estar en Notificaciones no se puede apagar');
});
