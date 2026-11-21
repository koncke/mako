// =============================================================================
// EL VIDEO SE REPRODUCE EN EL CHAT, Y SU GLOBO TIENE SU ANCHO (20/11/2026, Martín probando en producción, ws 3 «Laland»)
// =============================================================================
// 1. «¡Hola de nuevo!» se iba a la esquina sin motivo: sin scroll, con el mensaje a la vista, tocó play y el video saltó al recuadro de
//    abajo a la derecha («Martín · MaKo», con «Omitir recorrido»). Martín: «debería haberse reproducido directamente ahí en el chat».
//    La llegada (app/second-brain/LlegadaAlReto.tsx) arrancaba el recorrido SIN `lugar`, y el motor sin lugar dibuja su video en la
//    esquina. Ahora le da su lugar (como el día del reto: el reproductor entero, pantalla y barra, en el mensaje) y el motor lo dibuja
//    ahí mientras se ve; a la esquina sólo si el mensaje sale de la vista o se cambia de pantalla, y vuelve al volver.
//    Con el video en el mensaje, el motor no muestra «Omitir recorrido» entre paso y paso (sólo en la esquina): la llegada lo pone
//    debajo del reproductor mientras el recorrido corre.
//    Y para todo VideoDelMomento: no pasaba a la esquina si el motor tenía una marca de SUS frases (los coaches con `marcarFrases`) o
//    un «dale play»: quedaba pausado en el chat y en ningún lado. Esas le dejan el lugar; una tarea o un recorrido no, y entonces el
//    video sigue en el chat, nunca pausado sin nadie.
// 2. El video era más chico que su globo: el texto de abajo («Te doy la bienvenida a tu Ops Center…») ensanchaba el globo. Un globo
//    con un video tiene el ancho del video (400 + el padding), y el texto se acomoda debajo.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cedeAlFlotante, reproducirFlotante, senalAhora, senalarDondeTocar, cerrarTutorial, mostrarTutorial } from '../app/_ui/tutorial/store';
import { TUTORIAL_RECORRIDO } from '../lib/onboarding-v2/recorrido';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. la llegada arranca el recorrido CON su lugar en el mensaje: el reproductor entero, que el motor tapa con el video mientras se ve', () => {
  const l = sinComentarios(fuente('app/second-brain/LlegadaAlReto.tsx'));
  assert.match(l, /export const LUGAR_VIDEO_LLEGADA = '\[data-video-lugar="recorrido"\]';/);
  assert.match(l, /const empezar = \(\) => mostrarTutorial\(TUTORIAL_RECORRIDO, \{ alTerminar, lugar: LUGAR_VIDEO_LLEGADA \}\);/);
  // El lugar es el reproductor entero (pantalla 16:9 y barra), como el del día del reto: el video del motor (pantalla y barra) lo tapa justo.
  const i = l.indexOf(' data-video-lugar="recorrido" data-recorrido="sb-llegada-play"');
  assert.ok(i > 0, 'sin su lugar');
  const lugar = l.slice(l.lastIndexOf('<div', i), l.indexOf('<div className="ch-md">', i));
  assert.match(lugar, /className="mk-vmom sbl-vlugar"/);
  assert.match(lugar, /className="mk-vmom__pantalla[ "]/);
  assert.match(lugar, /className="mk-vmom__ctrl"/);
  // El motor: en el lugar mientras se ve; en la esquina, no.
  const m = fuente('app/_ui/tutorial/MotorTutorial.tsx');
  assert.match(m, /const enLugar = useLugarALaVista\(lugar && video \? lugar : null\);/);
  assert.match(m, /lugar=\{senal\.lugar\}/);
});

test('2. con el video en el mensaje, «Omitir recorrido» va debajo del reproductor mientras el recorrido corre', () => {
  const l = sinComentarios(fuente('app/second-brain/LlegadaAlReto.tsx'));
  assert.match(l, /const corre = senal\?\.tipo === 'tutorial' && senal\.tutorial === TUTORIAL_RECORRIDO;/);
  assert.match(l, /\{corre && senal && <button type="button" className="sbl-omitir" onClick=\{\(\) => terminar\(senal\.id, 'omitido'\)\}>Omitir recorrido<\/button>\}/);
});

test('3. un VideoDelMomento pasa a la esquina aunque haya una marca de SUS frases o un «dale play»; una tarea o un recorrido no lo pisan', () => {
  const frase = senalarDondeTocar({ sel: '#x', titulo: 'Offer Coach', texto: 'aquí', haz: '' }, () => {}, { libre: true });
  assert.equal(cedeAlFlotante(senalAhora()), true);
  assert.equal(reproducirFlotante('offer-coach', 'Offer Coach', 12), true, 'la marca de su frase le deja el lugar');
  assert.equal(senalAhora()?.tipo, 'video');
  assert.notEqual(senalAhora()?.id, frase);
  cerrarTutorial();
  senalarDondeTocar({ sel: '#y', titulo: 'Bienvenida a MaKo: dale play', texto: '', haz: '' }, () => {}, { invita: true });
  assert.equal(reproducirFlotante('onboarding-bienvenida', 'Bienvenida', 3), true, 'un «dale play» también');
  cerrarTutorial();
  senalarDondeTocar({ sel: '#z', titulo: 'Tu día 1 sigue en Offer Coach', texto: '', haz: 'Haz clic' }, () => {});
  assert.equal(reproducirFlotante('reto-dia-1', 'Día 1', 5), false, 'una tarea no se pisa');
  assert.equal(senalAhora()?.tipo, 'marca');
  mostrarTutorial(TUTORIAL_RECORRIDO);
  assert.equal(reproducirFlotante('reto-dia-1', 'Día 1', 5), false, 'un recorrido tampoco');
  cerrarTutorial();
  // Y el video del chat se pausa SÓLO si pasó a la esquina: si no, sigue donde está (nunca pausado y en ningún lado).
  const f = fuente('app/_ui/tutorial/useVideoQueFlota.ts');
  assert.match(f, /if \(!reproducirFlotante\(clave, titulo, t, \(m\) => aviso\.current\?\.\(m\)\)\) return;\n\s*v\.dataset\[BANDERA_FLOTA\] = '1';\n\s*v\.pause\(\);/);
});

test('4. un globo con un video tiene el ancho del video: 400 del video y el padding del globo; el texto, debajo', () => {
  const css = fuente('app/admin/operaciones/centro.css');
  const globo = /\.co-el:not\(\.co-trabajando\) > \.co-el__cuerpo:not\(\.co-el__cuerpo--ancho\) \{\n\s*position: relative; padding: 7px (\d+)px 5px;/.exec(css);
  assert.ok(globo, 'el padding del globo');
  const lados = 2 * Number(globo[1]);
  const conVideo = /\.co-el:not\(\.co-trabajando\) > \.co-el__cuerpo:not\(\.co-el__cuerpo--ancho\):has\(\.mk-vmom\) \{ width: min\(100%, (\d+)px\); box-sizing: border-box; \}/.exec(css);
  assert.ok(conVideo, 'el globo con un video, con su ancho');
  const video = /\.mk-vmom \{ width: (\d+)px; max-width: 100%;/.exec(fuente('app/_ui/tutorial/VideoDelMomento.tsx'));
  assert.ok(video);
  assert.equal(Number(conVideo[1]), Number(video[1]) + lados, 'a 1440: el video ocupa el ancho del globo, sin sobrante');
  // A 375 el globo es el 100% de su fila y el video, con su max-width: 100%, el ancho de adentro del globo: el mismo que el texto.
});

// ⚠️ PROBADO ROMPIÉNDOLO (20/11/2026, base 4/0; al restaurar, 4/0). Cada rotura, de a una, cae:
//   - la llegada sin `lugar` (lo de antes: a la esquina) → 1
//   - la llegada con el botón de antes (sólo la pantalla, sin la barra) → 1
//   - sin «Omitir recorrido» en el mensaje → 2
//   - reproducirFlotante con el `return` de antes ante cualquier marca → 3
//   - el video del chat pausado ANTES de saber si pasó a la esquina → 3
//   - sin el ancho del globo con video → 4; con un ancho que deja sobrante → 4
