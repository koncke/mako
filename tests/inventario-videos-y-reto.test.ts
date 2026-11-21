// =============================================================================
// EL INVENTARIO DE BOTONES (20/11/2026, Martín: «todos los botones que puede apretar»): los arreglos de los videos, las marcas y el reto
// =============================================================================
// Lo que fallaba (la tabla del inventario, en docs/hallazgos-onboarding.md):
//   1. No había PANTALLA COMPLETA en ningún reproductor del chat (sólo el video chico del motor sin lugar, con los controles del navegador).
//   2. La X del «dale play» de la llegada cerraba la invitación para siempre y dejaba el reto FRENADO: el recorrido sin ver, la barra
//      escondida, y el reto esperando el recorrido para el saludo y «¿Qué hacemos ahora?». La única salida era tocar play.
//   3. Con el «dale play» puesto, tocar la VELOCIDAD o la BARRA del video quieto contaba como «tocado»: la invitación se cerraba para siempre
//      sin reproducir (y en el día 1, el video quedaba visto y marcaba Offer Coach).
//   4. La marca de «Muéstrame {pestaña}» no tenía salida: sin «Lo hago después» ni Escape, y las tapas tapando todo alrededor.
//   5. El desplegable «Día N de 7», el pin y los videos del chat no se cerraban tocando afuera ni con Escape; y elegir un video en el
//      desplegable lo dejaba abierto encima del video que arrancaba.
//   6. Con el video de un día (2 a 7) corriendo EN su mensaje, no había cómo saltearlo entre frase y frase (el motor muestra «Omitir
//      recorrido» sólo en la esquina): como en la llegada, va debajo del reproductor.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pantallaCompleta } from '../app/_ui/tutorial/pantalla-completa';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. pantalla completa: la del navegador, o la del iPhone (webkitEnterFullscreen); en el reproductor del chat y en el del motor', () => {
  let pedido = '';
  assert.equal(pantallaCompleta({ requestFullscreen: () => { pedido = 'estandar'; return Promise.resolve(); } }), true);
  assert.equal(pedido, 'estandar');
  assert.equal(pantallaCompleta({ webkitEnterFullscreen: () => { pedido = 'iphone'; } }), true, 'el iPhone no tiene requestFullscreen en el video');
  assert.equal(pedido, 'iphone');
  assert.equal(pantallaCompleta({}), false);
  assert.equal(pantallaCompleta(null), false);
  for (const f of ['app/_ui/tutorial/VideoDelMomento.tsx', 'app/_ui/tutorial/BarraDelVideo.tsx']) {
    assert.match(sinComentarios(fuente(f)), /className="mk-vmom__btn mk-vmom__completa" onClick=\{\(\) => pantallaCompleta\((ref|vidRef)\.current\)\} aria-label="Pantalla completa"/, `${f}: sin pantalla completa`);
  }
});

test('2. la X del «dale play» de la llegada omite el recorrido (queda visto) y muestra la barra: el reto no queda frenado', () => {
  const d = sinComentarios(fuente('app/_ui/tutorial/useDalePlay.ts'));
  assert.match(d, /\{ invita: true, alOmitir: \(\) => \{ visto\(\); alCerrar\.current\?\.\(\); \} \}/, 'la X avisa a quien la puso');
  const l = sinComentarios(fuente('app/second-brain/LlegadaAlReto.tsx'));
  assert.match(l, /alCerrar: \(\) => \{ mostrarLaBarra\(\); alTerminar\('omitido'\); \}/);
});

test('3. con el «dale play» puesto, tocar la velocidad o la barra NO cuenta como tocado (sólo el play o la pantalla)', () => {
  const m = sinComentarios(fuente('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /if \(senal\.tipo === 'marca' && senal\.invita && e\.target instanceof Element && e\.target\.closest\('\.mk-vmom__vel, \.mk-vmom__pista, \.mk-vmom__completa'\)\) return;\n\s*tocado = true;/);
});

test('4. la marca de «Muéstrame» tiene salida («Lo hago después» y Escape)', () => {
  const p = sinComentarios(fuente('app/second-brain/reto/enSuPestana.ts'));
  const i = p.indexOf('export function mostrarEnSuPestana(');
  assert.match(p.slice(i), /haz: `Haz clic en \$\{t\.nombre\}`, lado: 'derecha' \}, \(\) => \{[\s\S]*?\}, \{ alOmitir: \(\) => \{\} \}\);/);
});

test('5. el desplegable del reto, el pin y los videos del chat se cierran tocando afuera o con Escape; elegir un video cierra el desplegable', () => {
  const r = sinComentarios(fuente('app/second-brain/reto/ChatDelReto.tsx'));
  assert.match(r, /useCerrarAfuera\(caja, abierto, cerrarMenu\);/, 'el desplegable');
  assert.match(r, /useCerrarAfuera\(cajaPin, abierto, cerrarPin\);/, 'el pin');
  assert.match(r, /onClick=\{\(\) => \{ alElegir\?\.\(\); verVideoDelDia\(dia, conMarcas, titulo\); \}\}/, 'elegir un video cierra el desplegable');
  assert.match(sinComentarios(fuente('app/_ui/tutorial/VideosDelChat.tsx')), /useCerrarAfuera\(caja, abierto, cerrar\);/, 'los videos del chat');
});

test('6. con el video de un día corriendo en su mensaje, «Omitir recorrido» debajo del reproductor', () => {
  const r = sinComentarios(fuente('app/second-brain/reto/ChatDelReto.tsx'));
  assert.match(r, /\{corre && senal\?\.tipo === 'tutorial' && <button type="button" className="rt-omitir" onClick=\{\(\) => terminar\(senal\.id, 'omitido'\)\}>Omitir recorrido<\/button>\}/);
});

// ⚠️ PROBADO ROMPIÉNDOLO (20/11/2026, base 6/0; al restaurar, 6/0). Cada rotura, de a una, cae:
//   - pantallaCompleta sin la vuelta del iPhone → 1;  el reproductor del chat sin el botón → 1
//   - la X del «dale play» sin avisar → 2;  la llegada sin omitir el recorrido → 2
//   - la velocidad cuenta como tocado → 3;  «Muéstrame» sin salida → 4
//   - el desplegable sin cerrarse afuera → 5;  elegir un video sin cerrar → 5;  sin «Omitir» en el día → 6
