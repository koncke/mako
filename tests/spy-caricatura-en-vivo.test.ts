// La caricatura que se está haciendo se nota, y cuando llega entra sola, sin recargar (4/11/2026).
//
// Martín: «Vuelvo a todos los competidores y me aparece Leila sin su caricatura... si aun no la generó un placeholder que se note
// que lo está generando» y «para yo poder ver el avatar... sí o sí tengo que refrescar la página, no debería».
//   1. «en camino» es sólo la que está en la cola sin fallos: ni la de un referente, ni la que falló y espera, ni sin foto nuestra;
//   2. la lista lo dice por competidor, y una RUTA lo contesta (no una action: haría fila detrás de una lectura);
//   3. la pantalla pregunta sólo mientras hay alguna en camino, con la pestaña a la vista, y deja de preguntar;
//   4. la tarjeta: su foto suavizada con «Haciendo su caricatura…», y la nueva entra con un fundido (sin movimiento si se pidió).
// Medido en la vista de prueba: «Haciendo su caricatura…» al abrir, y a la segunda pregunta (10 s) la imagen nueva, sin recargar.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · `caricaturaEnCamino` que cuenta la que espera su reintento         → 1
//   · la lista sin `caricaturaPendiente`                                 → 2
//   · el efecto que pregunta por la action de la lista                    → 3
//   · la imagen sin `key` (no hay fundido al cambiar)                     → 4
//
// Correr: node --import tsx --test tests/spy-caricatura-en-vivo.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { caricaturaEnCamino } from '../lib/spy-caricatura-reglas';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const FOTO = 'https://abc.supabase.co/storage/v1/object/public/spy-miniaturas/avatar/leila.jpg';
const AHORA = Date.parse('2026-11-04T18:00:00Z');

test('1. «en camino» es sólo la que está en la cola sin fallos', () => {
  assert.equal(caricaturaEnCamino(undefined, { avatar: FOTO, referente: false }, AHORA), true, 'recién leída, con su foto en nuestro Storage');
  assert.equal(caricaturaEnCamino({ url: 'https://x/c.png' }, { avatar: FOTO, referente: false }, AHORA), false, 'ya está');
  assert.equal(caricaturaEnCamino(undefined, { avatar: FOTO, referente: true }, AHORA), false, 'un referente ya tiene su dibujo');
  assert.equal(caricaturaEnCamino({ foto: FOTO, fallos: 1, ultimoFallo: new Date(AHORA - 60_000).toISOString() }, { avatar: FOTO, referente: false }, AHORA), false, 'la que falló y espera no dice «Haciendo…»');
  assert.equal(caricaturaEnCamino(undefined, { avatar: 'https://scontent.cdninstagram.com/x.jpg', referente: false }, AHORA), false, 'sin su foto en nuestro Storage no entra a la cola');
});

test('2. la lista lo dice por competidor, y una ruta lo contesta', () => {
  const spy = sinComentarios(leer('lib/spy.ts'));
  assert.match(spy, /caricaturaPendiente: caricaturaEnCamino\(registro\[String\(c\.id\)\], \{ avatar: c\.avatar, referente: !!referenteDeCompetidor\(c\) \}, ahora\)/);
  const ruta = sinComentarios(leer('app/api/competitor-spy/caricaturas/route.ts'));
  assert.match(ruta, /export async function GET\(\)/);
  assert.doesNotMatch(ruta, /export async function POST/, 'sólo lee');
  assert.match(ruta, /soloAdminDeTab\('market-an'\)/, 'la misma puerta que la pantalla');
  assert.match(ruta, /caras = r\.competidores\.map\(\(c\) => \(\{ id: c\.id, caricatura: c\.caricatura \?\? null, pendiente: !!c\.caricaturaPendiente \}\)\)/);
});

test('3. la pantalla pregunta sólo mientras hay alguna en camino, y deja de preguntar', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /const enCamino = competidores\.filter\(\(x\) => x\.caricaturaPendiente && !x\.caricatura\)\.map\(\(x\) => x\.id\)\.join\(','\);/);
  const i = app.indexOf('const enCamino');
  const efecto = app.slice(i, app.indexOf('}, [enCamino]);', i));
  assert.ok(efecto.length > 200 && efecto.length < 3000, `recorte de ${efecto.length}`);
  assert.match(efecto, /if \(!enCamino\) return;/, 'sin ninguna en camino no pregunta');
  assert.match(efecto, /fetch\('\/api\/competitor-spy\/caricaturas'/, 'por la ruta');
  assert.doesNotMatch(efecto, /competidoresAction\(/, 'no por una action, que haría fila detrás de una lectura');
  assert.match(efecto, /document\.visibilityState === 'visible'/);
  assert.match(efecto, /if \(vueltas < 150\)/, 'y se rinde (la próxima apertura la trae)');
});

test('4. la tarjeta: su foto suavizada con «Haciendo su caricatura…», y la nueva entra con un fundido', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /const haciendo = !!c\.caricaturaPendiente && !c\.caricatura;/);
  assert.match(app, /data-haciendo=\{haciendo \|\| undefined\}/);
  assert.match(app, /\{haciendo && <span className="spy-ccard__haciendo" role="status"><i aria-hidden \/>Haciendo su caricatura…<\/span>\}/);
  assert.match(app, /<img key=\{cara\} src=\{cara\}/, 'con `key`, la imagen nueva es otro nodo y entra con su fundido');
  assert.match(app, /\.spy-ccard__cara img\{[^}]*animation:spy-cara-entra \.7s ease-out both/);
  assert.match(app, /\.spy-ccard__cara\[data-haciendo\] img\{filter:blur\(5px\)/);
  assert.match(app, /@media \(prefers-reduced-motion:reduce\)\{\n  \.spy-ccard__cara img\{animation:none\}\n  \.spy-ccard__cara\[data-haciendo\]::after,\.spy-ccard__haciendo i\{animation:none\}/);
});
