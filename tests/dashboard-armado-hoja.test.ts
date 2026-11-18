// =============================================================================
// Lo que MaKo arma en una hoja del Dashboard aparece de a una tarjeta (18/11/2026)
// =============================================================================
// Pendiente O13 de docs/pendientes-verificados-17-11.md: «Editar con MaKo» y el ajuste de una plantilla ponían la hoja nueva
// de golpe. El test EJECUTA lo que decide qué tarjetas se revelan y en qué orden (`tarjetasPorArmar`) y la hoja de estilo
// que esconde las que todavía no se ven (`cssDeArmado`), con hojas reales de la galería. La cadencia es la de la pieza
// compartida (`visiblesAhora`, app/_ui/armado-en-vivo.ts, con su test): acá se mide cómo se enchufa.
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026), una rotura por vez y vuelta atrás:
//   1. `tarjetasPorArmar` sin comparar contra `antes` (todas) .......................... 1 fallo
//   2. `tarjetasPorArmar` sin ordenar por lugar ........................................ 1 fallo
//   3. `cssDeArmado` escondiendo también las ya visibles ............................... 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cssDeArmado, tarjetasPorArmar } from '../app/dashboard/armado-hoja';
import { instanciarPlantilla, PLANTILLAS_HOJA } from '../lib/graficos-plantillas';
import { visiblesAhora } from '../app/_ui/armado-en-vivo';
import type { Hoja } from '../lib/graficos-catalogo';

const hoja = (): Hoja => instanciarPlantilla(PLANTILLAS_HOJA[0]);

test('se arman sólo las tarjetas que MaKo agregó o cambió, en el orden en que se leen', () => {
  const antes = hoja();
  assert.ok(antes.componentes.length > 2, 'la plantilla de prueba tiene tarjetas');
  const [a, b] = antes.componentes;
  const nueva = { ...a, id: 'nueva-abajo', y: 1000, x: 0 };
  const otra = { ...a, id: 'nueva-arriba', y: -1, x: 6 };
  const despues: Hoja = { ...antes, componentes: [...antes.componentes.map((c) => (c.id === b.id ? { ...c, w: c.w === 12 ? 6 : c.w + 1 } : c)), nueva, otra] };
  assert.deepEqual(tarjetasPorArmar(antes, despues), ['nueva-arriba', b.id, 'nueva-abajo'], 'las dos nuevas y la que cambió, por lugar');
  assert.deepEqual(tarjetasPorArmar(antes, antes), [], 'nada cambió: no se arma nada');
  // Sin la hoja de antes (una hoja que no estaba), todas.
  assert.equal(tarjetasPorArmar(null, antes).length, antes.componentes.length);
});

test('la hoja de estilo esconde sólo las que faltan, y con todas a la vista no queda nada', () => {
  const ids = ['g1', 'g2', 'g3'];
  const css = cssDeArmado(ids, 1);
  // Las escondidas son el selector de la regla con `opacity:0` (después de la de la transición).
  const ocultas = css.slice(css.indexOf('}') + 1, css.indexOf('{opacity:0'));
  assert.equal(ocultas, '[data-comp="g2"],[data-comp="g3"]', 'escondió una que ya se ve, o no escondió las que faltan');
  assert.match(css, /prefers-reduced-motion: reduce/, 'sin la salida para «reducir movimiento»');
  // `translate` y no `transform`: la grilla ubica cada tarjeta con `transform`.
  assert.doesNotMatch(css.replace('transform .2s ease', ''), /transform:/);
  assert.equal(cssDeArmado(ids, 3), '');
  assert.equal(cssDeArmado([], 0), '');
  // Un id con comillas no corta el selector.
  assert.doesNotMatch(cssDeArmado(['a"b'], 0), /"a"b"/);
});

test('con la cadencia de la pieza compartida, se ven de a una y «Ver todo» las muestra todas', () => {
  assert.equal(visiblesAhora({ llegadas: 4, visibles: 0, desdeUltima: 10_000 }), 1);
  assert.equal(visiblesAhora({ llegadas: 4, visibles: 1, desdeUltima: 0 }), 1);
  assert.equal(visiblesAhora({ llegadas: 4, visibles: 1, desdeUltima: 0, salteado: true }), 4);
  assert.equal(visiblesAhora({ llegadas: 4, visibles: 0, desdeUltima: 0, sinMovimiento: true }), 4);
});

test('el editor arma lo que propone MaKo y lo del ajuste de la plantilla; el Deshacer va de una', () => {
  const ed = readFileSync(join(__dirname, '..', 'app', 'dashboard', 'EditorInforme.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(ed, /onAplicar=\{aplicarDeMako\} onDeshacer=\{ponerHojaDeMako\}/);
  assert.match(ed, /const ids = tarjetasPorArmar\(tableroRef\.current\.hojas\.find\(\(x\) => x\.id === h\.id\), h\);/);
  assert.match(ed, /const ids = tarjetasPorArmar\(actual, \{ \.\.\.h, id \}\);/, 'el ajuste de la plantilla no se arma');
  assert.match(ed, /\{armado && armado\.hojaId === hoja\.id && <ArmadoDeHoja key=\{armado\.clave\} ids=\{armado\.ids\} onFin=\{terminarArmado\} \/>\}/);
});
