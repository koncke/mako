// =============================================================================
// El contexto y las guardias del chat de la app (20/10/2026, ola 1, pieza 1.5)
// =============================================================================
// docs/ops-center-principal.md §5. Hecho = «El system de un workspace que no es el 1 no nombra a Martín; "Listo, ya lo
// armé" sin herramienta sale marcado como no hecho; con 2 o más informes no pide un email». Lo que se fija:
//   1. el perfil del negocio va con el nombre del negocio, en el chat de MaKo y en el asesor de WhatsApp; ningún archivo
//      vuelve a decir «NEGOCIO DE MARTÍN» ni «del negocio de Martín» (la retrospectiva y el asesor de WhatsApp también lo
//      decían). Es la misma regla de tests/prompt-sin-dueno.test.ts, que mira los encuadres de lib/prompt-defaults.ts;
//      ésta barre todo el código;
//   2. sin ninguna herramienta corrida, lo que dice HECHO («Listo, ya lo armé», «te creé…», «quedó programada») sale
//      marcado como no hecho; un dato del contexto («tu landing está publicada») no; con algo corrido, no se toca; y el
//      doer de WhatsApp sigue como estaba (la opción es del chat de la app);
//   3. el chat de la app cuenta lo que DE VERDAD corrió (lo rechazado no) y se lo pasa al guardia.
// ⚠️ Lo que NO es de esta pieza: la persona de MaKo dice «el consultor IA de Martín Koncke» (lib/mako-persona.ts): es la
//    marca, y cambiarla es una decisión de Martín. «Mi hoja» por quien chatea (con 2 o más informes) es del Dashboard.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · el rótulo de vuelta a «NEGOCIO DE MARTÍN» en lib/mako-context.ts → 1 fallo (1);
//   · `afirmaHechoDe` que no ve nada → 1 fallo (2);
//   · el chat de la app con `corrioHerramientas: true` fijo, como antes → 1 fallo (3).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rotuloDelNegocio } from '../lib/negocio-rotulo';
import { SIN_HACER, afirmaHechoDe, sanearSalida } from '../lib/doer-salida';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function fuentes(dir: string): string[] {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const r = `${dir}/${n}`;
    if (statSync(join(RAIZ, r)).isDirectory()) return n === 'node_modules' || n.startsWith('.') ? [] : fuentes(r);
    return /\.(ts|tsx|mjs)$/.test(n) ? [r] : [];
  });
}

test('1. el perfil del negocio va con SU nombre, y nadie vuelve a decir «NEGOCIO DE MARTÍN»', () => {
  assert.equal(rotuloDelNegocio('Código Inmobiliario'), 'NEGOCIO «Código Inmobiliario» (perfil del cliente)');
  assert.equal(rotuloDelNegocio('  '), 'EL NEGOCIO (perfil del cliente)', 'sin nombre, sin nombre: nunca uno inventado');
  assert.equal(rotuloDelNegocio(null), 'EL NEGOCIO (perfil del cliente)');
  for (const f of ['lib/mako-context.ts', 'lib/whatsapp-advisor.ts']) {
    assert.match(sinComentarios(leer(f)), /\$\{rotuloDelNegocio\(nombreNegocio\)\}:\\n\$\{perfil\}/, `${f}: el rótulo con el nombre`);
  }
  const conMartin = [...fuentes('lib'), ...fuentes('app')].filter((f) => /NEGOCIO DE MART[IÍ]N/i.test(sinComentarios(leer(f))));
  assert.deepEqual(conMartin, [], 'ningún system dice que el negocio es de Martín');
});

test('2. sin herramientas, lo que dice hecho sale marcado como no hecho', () => {
  const sin = (t: string) => sanearSalida(t, { corrioHerramientas: false, hecho: true });
  assert.equal(sin('Listo, ya lo armé.').texto, SIN_HACER, '«Listo, ya lo armé» sin nada corrido');
  assert.match(sin('Listo, te armé la automatización de los martes a las 3 para todo el funnel.').texto, new RegExp(`${SIN_HACER}$`));
  assert.match(sin('Quedó programada para todos los martes a las 15.').texto, new RegExp(`${SIN_HACER}$`));
  const conDato = 'Tu landing del webinar está publicada desde el lunes y tiene 230 visitas.';
  assert.equal(sin(conDato).texto, conDato, 'un dato del contexto no es una afirmación de algo hecho');
  const mezcla = sin('Te cuento cómo viene tu funnel esta semana con los nuevos leads. Ya te creé la automatización.');
  assert.equal(mezcla.texto, `Te cuento cómo viene tu funnel esta semana con los nuevos leads.\n\n${SIN_HACER}`, 'se saca la oración falsa, no la respuesta');
  assert.equal(sanearSalida('Listo, ya lo armé.', { corrioHerramientas: true, hecho: true }).texto, 'Listo, ya lo armé.', 'con algo corrido, no se toca');
  assert.equal(sanearSalida('Listo, ya lo armé.', { corrioHerramientas: false }).texto, 'Listo, ya lo armé.', 'el doer de WhatsApp sigue como estaba');
  assert.ok(afirmaHechoDe('Ya te lo agendé para el jueves.').includes('ya te lo agende'));
});

test('3. el chat de la app cuenta lo que de verdad corrió', () => {
  const s = sinComentarios(leer('lib/mako-turno-app.ts'));
  const correr = s.slice(s.indexOf('const runTool = async'), s.indexOf('const previo = memo.previo(name);'));
  assert.ok(correr.indexOf('corridas++') > correr.indexOf('guardia.bloquea(name)'), 'lo rechazado (no permitido, o después de preguntar) no cuenta');
  assert.match(s, /sanearSalida\(respuesta, \{ corrioHerramientas: corridas > 0, hecho: true \}\)/, 'el guardia recibe lo que corrió, y mira lo que dice hecho');
});
