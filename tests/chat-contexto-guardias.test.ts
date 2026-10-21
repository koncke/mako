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
//      marcado como no hecho; un dato del contexto («tu landing está publicada») no; y el doer de WhatsApp sigue como
//      estaba (la opción es del chat de la app);
//   3. el chat de la app cuenta lo que DE VERDAD corrió (lo rechazado no) y lo que leyó, y se lo pasa al guardia;
//   4. (revisión del 21/10/2026) lo que el HILO ya anota hecho no se borra: «¿quedó agendada?» después de confirmar la
//      tarjeta se contesta «sí» sin correr nada. Y una lectura no apaga el guardia: «ya le mandé el WhatsApp» después de
//      leer la ficha es mentira (en este chat el turno no ejecuta nada), «la reunión quedó agendada» no (pudo leerlo). Lo
//      que se saca de un hecho NO dice «pídemelo otra vez»: sería pedirle que lo haga dos veces.
// ⚠️ Lo que NO es de esta pieza: la persona de MaKo dice «el consultor IA de Martín Koncke» (lib/mako-persona.ts): es la
//    marca, y cambiarla es una decisión de Martín. «Mi hoja» por quien chatea (con 2 o más informes) es del Dashboard.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · el rótulo de vuelta a «NEGOCIO DE MARTÍN» en lib/mako-context.ts → 1 fallo (1);
//   · `afirmaHechoDe` que no ve nada → 1 fallo (2);
//   · el chat de la app con `corrioHerramientas: true` fijo, como antes → 1 fallo (3);
//   · (21/10) `sanearSalida` que no mira `enElHilo` → 1 fallo (4); que con una lectura no juzga nada, como antes → 1
//     fallo (4); el turno sin contar lo que leyó → 1 fallo (3); `hechoEnElHilo` que no ve el «Hecho: » → 1 fallo (4);
//     `SIN_HECHO` igual a `SIN_HACER` → 1 fallo (4).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rotuloDelNegocio } from '../lib/negocio-rotulo';
import { SIN_HACER, SIN_HECHO, afirmaHechoDe, sanearSalida } from '../lib/doer-salida';
import { hechoEnElHilo } from '../lib/mako-turno-app-reglas';

/** El chat de la app, sin nada que respalde un hecho. */
const NADA = { enElHilo: false, leyo: false, tarjeta: false };

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
  const sin = (t: string) => sanearSalida(t, { corrioHerramientas: false, hecho: NADA });
  assert.equal(sin('Listo, ya lo armé.').texto, SIN_HECHO, '«Listo, ya lo armé» sin nada corrido');
  assert.match(sin('Listo, te armé la automatización de los martes a las 3 para todo el funnel.').texto, new RegExp(`${SIN_HECHO}$`));
  assert.match(sin('Quedó programada para todos los martes a las 15.').texto, new RegExp(`${SIN_HECHO}$`));
  const conDato = 'Tu landing del webinar está publicada desde el lunes y tiene 230 visitas.';
  assert.equal(sin(conDato).texto, conDato, 'un dato del contexto no es una afirmación de algo hecho');
  const mezcla = sin('Te cuento cómo viene tu funnel esta semana con los nuevos leads. Ya te creé la automatización.');
  assert.equal(mezcla.texto, `Te cuento cómo viene tu funnel esta semana con los nuevos leads.\n\n${SIN_HECHO}`, 'se saca la oración falsa, no la respuesta');
  assert.equal(sin('Déjame ver el plan.').texto, SIN_HACER, 'una promesa sigue con la suya');
  assert.equal(sanearSalida('Listo, ya lo armé.', { corrioHerramientas: false }).texto, 'Listo, ya lo armé.', 'el doer de WhatsApp sigue como estaba');
  assert.ok(afirmaHechoDe('Ya te lo agendé para el jueves.').includes('ya te lo agende'));
});

test('3. el chat de la app cuenta lo que de verdad corrió', () => {
  const s = sinComentarios(leer('lib/mako-turno-app.ts'));
  const correr = s.slice(s.indexOf('const runTool = async'), s.indexOf('const previo = memo.previo(name);'));
  assert.ok(correr.indexOf('corridas++') > correr.indexOf('guardia.bloquea(name)'), 'lo rechazado (no permitido, o después de preguntar) no cuenta');
  assert.match(s, /if \(!escribe\(name\) && \(out as \{ isError\?: unknown \}\)\.isError !== true\) leidas\+\+;/, 'cuenta lo que LEYÓ sin error');
  assert.ok(correr.indexOf('leidas++') < 0, 'y lo cuenta después de correr, no antes');
  assert.match(s, /sanearSalida\(respuesta, \{\s*corrioHerramientas: corridas > 0,\s*hecho: \{ enElHilo: hechoEnElHilo\(historial\), leyo: leidas > 0, tarjeta: propuestas\.length > 0 \|\| retirado\.pantallas\.length > 0 \},\s*\}\)/,
    'el guardia recibe lo que corrió y lo que respalda un hecho');
});

test('4. lo que el hilo ya anota hecho no se borra, y una lectura no apaga el guardia', () => {
  // El caso de la revisión: confirmó la tarjeta, el hilo anota el «Hecho», y pregunta «¿quedó agendada?».
  const hilo = [
    { role: 'user', content: 'Agéndame una reunión con Ana el martes a las 10' },
    { role: 'assistant', content: 'Te la dejo para confirmar abajo.\nHecho: Agendar reunión con Ana, martes 10:00' },
    { role: 'user', content: '¿quedó agendada?' },
  ];
  assert.ok(hechoEnElHilo(hilo), 'el «Hecho: » de la tarjeta confirmada');
  assert.ok(!hechoEnElHilo([{ role: 'assistant', content: 'No se pudo: Agendar reunión con Ana' }, { role: 'user', content: 'Hecho: lo hice yo' }]), 'ni un «No se pudo», ni lo que escribe la persona');
  const respaldada = { ...NADA, enElHilo: hechoEnElHilo(hilo) };
  for (const t of ['Sí, quedó agendada para el martes a las 10.', 'Sí, ya te la agendé el martes a las 10.', '¡De nada! La reunión con Ana ya quedó agendada.']) {
    assert.equal(sanearSalida(t, { corrioHerramientas: false, hecho: respaldada }).texto, t, `«${t}» con el hecho en el hilo`);
  }
  // Una LECTURA no respalda lo que MaKo dice que HIZO: en la app el turno sólo propone.
  const leyo = { ...NADA, leyo: true };
  const mandado = sanearSalida('Leí la ficha de Juan. Listo, ya le mandé el WhatsApp a Juan.', { corrioHerramientas: true, hecho: leyo });
  assert.equal(mandado.texto, `Leí la ficha de Juan.\n\n${SIN_HECHO}`, '«ya le mandé» después de una lectura');
  const estado = 'Miré tu agenda: la reunión con Ana quedó agendada para el martes.';
  assert.equal(sanearSalida(estado, { corrioHerramientas: true, hecho: leyo }).texto, estado, 'un «quedó» que pudo leer');
  // Con una tarjeta en el turno, lo que falta lo dice la tarjeta.
  const conTarjeta = 'Te dejé la reunión con Ana para el martes: confírmala abajo.';
  assert.equal(sanearSalida(conTarjeta, { corrioHerramientas: true, hecho: { ...NADA, tarjeta: true } }).texto, conTarjeta);
  // Lo que se saca de un hecho no pide repetirlo.
  assert.notEqual(SIN_HECHO, SIN_HACER);
  assert.doesNotMatch(SIN_HECHO, /otra vez/);
});
