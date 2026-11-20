// Las piezas compartidas de los videos en los chats (20/11/2026; la tanda 2 de la auditoría de chats del Cerebro, videos-1 a 6): una sola
// duración de los puntitos, la pausa por pasar a la esquina que no suelta mensajes, la frase que suena (`onFrase`), el recuadro reservado
// mientras llega el manifiesto, la entrada que se trae a la vista, y el hilo que le deja lugar al video que flota.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MS_ESCRIBE_TOPE, msEscribiendo } from '../lib/puntitos';
import { fraseEnElTiempo } from '../lib/tutoriales/videos';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. videos-4 y reto-8: UNA sola duración de los puntitos, por el largo, con el tope de la maqueta (3,5 s)', async () => {
  assert.equal(MS_ESCRIBE_TOPE, 3500, 'la maqueta: «que tarde un poquito más»');
  assert.equal(msEscribiendo(''), 600);
  assert.equal(msEscribiendo('x'.repeat(50)), 1600);
  assert.equal(msEscribiendo('x'.repeat(500)), 3500);
  assert.equal(msEscribiendo(null), 3500, 'sin texto que medir, el tope');
  // La usan la cola, la entrada y la llegada (nadie con su número fijo).
  const cola = await import('../app/_chat/useColaDeSalida');
  assert.equal(cola.msEscribiendo, msEscribiendo);
  const e = sinComentarios(leer('app/_ui/tutorial/EntradaEscribiendo.tsx'));
  assert.match(e, /export function useEntrada\(clave: string, activa: boolean, texto\?: string \| null\)/);
  assert.match(e, /window\.setTimeout\(\(\) => setEscribe\(false\), msEscribiendo\(texto\)\)/);
  assert.doesNotMatch(leer('app/_ui/tutorial/entrada.ts'), /MS_ESCRIBE_ENTRADA = 1800/);
});

test('2. videos-1: pasar a la esquina no es una pausa de la persona (bandera en el <video>), y el fin en la esquina avisa', () => {
  const f = sinComentarios(leer('app/_ui/tutorial/useVideoQueFlota.ts'));
  assert.match(f, /v\.dataset\[BANDERA_FLOTA\] = '1';\n\s*v\.pause\(\);/);
  const v = sinComentarios(leer('app/_ui/tutorial/VideoDelMomento.tsx'));
  assert.match(v, /onPause=\{\(e\) => \{ if \(e\.currentTarget\.ended\) return; setEstado\('pausado'\); soltarMarca\(\); if \(!pausaPorFlotar\(e\.currentTarget\)\) onPausa\?\.\(\); \}\}/);
  assert.match(v, /onPlay=\{\(e\) => \{ delete e\.currentTarget\.dataset\[BANDERA_FLOTA\];/);
  // El fin en la esquina: `onTerminaFuera` (del reto). No se repite en onTermina: el reto pasa el mismo manejador a los dos.
  assert.match(v, /useVideoQueFlota\(ref, v \? clave : null, titulo, onTerminaFuera\);/);
});

test('3. videos-5: la frase que suena (`onFrase`), y las que tienen lugar se marcan sin tapar nada', () => {
  const frases = [{ id: 'a', t_inicio: 0.1, t_fin: 3.5 }, { id: 'b', t_inicio: 3.98, t_fin: 8.4 }];
  assert.equal(fraseEnElTiempo(frases, 1)?.id, 'a');
  assert.equal(fraseEnElTiempo(frases, 3.8), null, 'en el silencio entre frases, ninguna');
  assert.equal(fraseEnElTiempo(frases, 4)?.id, 'b');
  assert.equal(fraseEnElTiempo(frases, 9), null);
  const v = sinComentarios(leer('app/_ui/tutorial/VideoDelMomento.tsx'));
  assert.match(v, /onTimeUpdate=\{\(e\) => alTiempo\(e\.currentTarget\.currentTime\)\}/);
  assert.match(v, /onTiempo\?\.\(tt\);\n\s*const f = fraseEnElTiempo\(v\?\.frases \?\? \[\], tt\);/);
  assert.match(v, /onFrase\?\.\(f\);\n\s*if \(marcarFrases && f\.sel && typeof document !== 'undefined' && document\.querySelector\(f\.sel\)\) \{/);
  assert.match(v, /senalarDondeTocar\(\{ sel: f\.sel, titulo, texto: f\.texto, haz: '' \}, fuera, \{ alOmitir: fuera, libre: true \}\)/);
  assert.match(v, /onError=\{\(\) => onError\?\.\(\)\}/);
});

test('4. videos-3: mientras llega el manifiesto, el reproductor reserva su lugar (16:9 y la barra), y no aparece después empujando', () => {
  const v = sinComentarios(leer('app/_ui/tutorial/VideoDelMomento.tsx'));
  assert.match(v, /if \(!listo\) return <><style>\{CSS\}<\/style><div className="mk-vmom mk-vmom--reserva" data-clave=\{clave\} aria-hidden="true" \/><\/>;/);
  const css = leer('app/_ui/tutorial/VideoDelMomento.tsx');
  assert.match(css, /\.mk-vmom--reserva::before \{ content: ''; display: block; aspect-ratio: 16 \/ 9;/);
  assert.match(css, /\.mk-vmom--reserva::after \{ content: ''; display: block; height: 44px;/);
});

test('5. videos-2 y 6: la entrada trae su fila a la vista y se mide con el scroll; el hilo le deja lugar al video que flota', () => {
  const e = sinComentarios(leer('app/_ui/tutorial/EntradaEscribiendo.tsx'));
  assert.match(e, /try \{ el\.scrollIntoView\(\{ block: 'end' \}\); \} catch \{\s*\}\n\s*medir\(\);/);
  assert.match(e, /document\.addEventListener\('scroll', medir, \{ capture: true, passive: true \}\);/);
  const p = leer('app/_ui/tutorial/VideoEnLaEsquina.tsx');
  assert.match(p, /html\.setAttribute\('data-video-esquina', ''\);/);
  assert.match(p, /html\[data-video-esquina\] \.co-hilo, html\[data-video-esquina\] \.m-operaciones-hilo \{ padding-bottom: calc\(var\(--alto-esquina, 0px\) \+ 16px\); \}/);
});
