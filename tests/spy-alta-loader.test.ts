// El alta va derecho al loader de MaKo, y sus frases cambian mientras un paso tarda (4/11/2026).
//
// Martín, con el alta de Leila Hormozi en producción: «cuando le di a analizar a nuevo competidor, por un momento me aparecieron
// los bloques del detail en lugar del loader de mako directamente... Y el loader de mako se quedó mucho tiempo en "mirando su
// instagram", tienes que variar, aunque sea falso». El Cerebro: frases genéricas de avance, sin afirmar resultados que no pasaron.
//   1. las frases: la primera de cada paso es la de siempre, cambian cada `CADA_FRASE_MS` y ninguna afirma un resultado;
//   2. el alta pone el loader en el MISMO tick en que navega (después de la lista), sin la entrada de la caricatura, y la ficha
//      no lo saca al abrirse; lee con `'alta'` (la lectura compartida);
//   3. el loader dibuja la frase del momento, con su animación al cambiar, y un reloj que vuelve a cero con cada paso.
// Medido en la vista de prueba con el alta de verdad (el «+», «Usar @leilahormozi», «Sí, agregar»), un cuadro cada 40 ms:
// lista → «Preparando su ficha…» con el loader → sus pasos → el detalle; ni un cuadro del detalle antes del loader.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · una frase que dice «Encontré…»                                          → 1
//   · el efecto de la ficha que vuelve a sacar el loader (`setOrdenando(null)`) → 2
//   · el alta con la entrada de la caricatura                                 → 2
//   · el loader sin el reloj de las frases                                    → 3
//
// Correr: node --import tsx --test tests/spy-alta-loader.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CADA_FRASE_MS, FRASES_DEL_PASO, TEXTO_PASO, fraseDelPaso } from '../lib/spy-lectura-pasos';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. las frases cambian solas y ninguna afirma un resultado', () => {
  for (const p of ['instagram', 'youtube', 'web', 'piezas'] as const) {
    assert.equal(fraseDelPaso(p, 0), TEXTO_PASO[p], `la primera de ${p} es la de siempre`);
    assert.notEqual(fraseDelPaso(p, CADA_FRASE_MS), fraseDelPaso(p, 0), `${p} cambia a los ${CADA_FRASE_MS} ms`);
  }
  assert.equal(fraseDelPaso('instagram', CADA_FRASE_MS * FRASES_DEL_PASO.instagram.length), TEXTO_PASO.instagram, 'da la vuelta');
  assert.equal(fraseDelPaso('inicio', 0), 'Preparando su ficha…');
  for (const f of Object.values(FRASES_DEL_PASO).flat()) {
    assert.match(f, /…$/, `«${f}» es algo que está pasando`);
    assert.doesNotMatch(f, /encontr|list[oa]|\d|tiene|ya /i, `«${f}» no afirma un resultado`);
  }
});

test('2. el alta pone el loader en el mismo tick en que navega, sin la entrada, y la ficha no lo saca', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  const i = app.indexOf('const abrirRecienAgregado = async');
  const f = app.slice(i, app.indexOf('\n  };', i));
  assert.ok(f.length > 100, `recorte de ${f.length}`);
  const lista = f.indexOf('await recargarLista();');
  const loader = f.indexOf('setOrdenando({ id, piezas: null })');
  const navega = f.indexOf("irA(id, undefined, { alta: true })");
  assert.ok(lista > 0 && loader > lista && navega > loader, 'la lista primero; el loader y la navegación juntos, después del último await');
  assert.doesNotMatch(f.slice(loader, navega), /await /, 'nada en el medio: React los dibuja en el mismo cuadro');
  assert.match(app, /setEntrada\(id != null && !quieto\(\) && !o\?\.alta \?/, 'el alta no tiene tarjeta de donde salir');
  assert.match(app, /setOrdenando\(\(v\) => \(esAlta && v\?\.id === id \? v : null\)\);/, 'la ficha no saca el loader del alta');
  assert.match(app, /await leer\(id, esAlta \|\| !p\?\.length, esAlta \? 'alta' : undefined\)/, 'con la lectura compartida');
});

test('3. el loader dibuja la frase del momento, con un reloj que vuelve a cero con cada paso', () => {
  const src = sinComentarios(leer('app/competitor-spy/OrdenSpy.tsx'));
  assert.match(src, /setInterval\(\(\) => setFrases\(\(v\) => \(v\.paso === pasoRef\.current \? \{ paso: v\.paso, n: v\.n \+ 1 \} : \{ paso: pasoRef\.current, n: 0 \}\)\), CADA_FRASE_MS\)/);
  assert.match(src, /fraseDelPaso\(p, fraseN \* CADA_FRASE_MS\)/);
  assert.match(src, /<span key=\{texto\} className="spyo-frase">\{texto\}<\/span>/, 'la frase nueva entra con su animación');
  assert.match(src, /\.spyo-frase\{display:inline-block;animation:spyoPasoEntra/);
});
