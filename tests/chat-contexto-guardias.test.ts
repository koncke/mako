// =============================================================================
// El contexto y las guardias del chat de la app (20/10/2026, ola 1, pieza 1.5)
// =============================================================================
// docs/ops-center-principal.md §5. Hecho = «El system de un workspace que no es el 1 no nombra a Martín; "Listo, ya lo
// armé" sin herramienta sale marcado como no hecho; con 2 o más informes no pide un email». Lo que se fija:
//   1. el perfil del negocio va con el nombre del negocio, en el chat de MaKo y en el asesor de WhatsApp; ningún archivo
//      vuelve a decir «NEGOCIO DE MARTÍN» ni «del negocio de Martín» (la retrospectiva y el asesor de WhatsApp también lo
//      decían). Es la misma regla de tests/prompt-sin-dueno.test.ts, que mira los encuadres de lib/prompt-defaults.ts;
//      ésta barre todo el código;
//   2. sin nada que lo respalde, lo que dice HECHO («Listo, ya lo armé», «te creé…», «quedó programada») QUEDA y lleva
//      UNA nota («No veo esa acción en este chat…»); un dato del contexto («tu landing está publicada») no; y el doer de
//      WhatsApp sigue como estaba (la opción es del chat de la app);
//   3. el chat de la app cuenta lo que DE VERDAD corrió (lo rechazado no) y lo que leyó, y se lo pasa al guardia;
//   4. (las revisiones del 21/10/2026) el respaldo lo pone el CÓDIGO, con los «Hecho:» REALES (el resumen de ejecución
//      de `resultadoAgendar`, del pago, de las tareas, de mover): una tarjeta confirmada después del último pedido respalda
//      «Sí, ya te la agendé» y las respuestas cortas con pronombre; un «Hecho:» de antes de este pedido, no («ya le mandé
//      el WhatsApp a Juan»). Una lectura no respalda «ya le mandé», sí un «quedó»; un control que escribió de verdad sí,
//      uno que devolvió su error no. Con una tarjeta, «te dejé X para confirmar» no lleva nota; con una pregunta, nada.
//      ⚠️ Lo obvio fue el error dos veces (borrar por si corrió algo, borrar por las raíces): ninguna oración se borra.
// ⚠️ Lo que NO es de esta pieza: la persona de MaKo dice «el consultor IA de Martín Koncke» (lib/mako-persona.ts): es la
//    marca, y cambiarla es una decisión de Martín. «Mi hoja» por quien chatea (con 2 o más informes) es del Dashboard.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · el rótulo de vuelta a «NEGOCIO DE MARTÍN» en lib/mako-context.ts → 1 fallo (1);
//   · `afirmaHechoDe` que no ve nada → 1 fallo (2);
//   · el chat de la app con `corrioHerramientas: true` fijo, como antes → 1 fallo (3);
//   · (21/10) `sanearSalida` que no mira `enElHilo` → 1 fallo (4); que con una lectura no juzga nada, como antes → 1
//     fallo (4); el turno sin contar lo que leyó → 1 fallo (3); `hechoEnElHilo` que no ve el «Hecho: » → 1 fallo (4);
//     `SIN_HECHO` igual a `SIN_HACER` → 1 fallo (4);
//   · (la tercera revisión) `sanearSalida` que borra la oración otra vez → 2 fallos (2 y 4); sin la nota → 2 fallos (2 y 4);
//     `confirmadoTrasElUltimoPedido` que mira todo el hilo → 1 fallo (4); `salioBien` que da bien un error en JSON → 1
//     fallo (4); el turno con un pedido que se respalda con lo de antes → 1 fallo (3).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rotuloDelNegocio } from '../lib/negocio-rotulo';
import { NOTA_SIN_RESPALDO, SIN_HACER, afirmaHechoDe, sanearSalida } from '../lib/doer-salida';
import { confirmadoTrasElUltimoPedido, salioBien } from '../lib/mako-turno-app-reglas';
import { resultadoAgendar } from '../lib/agenda-sin-ia';

/** El chat de la app, sin nada que respalde un hecho. */
const NADA = { respaldado: false, leyo: false, tarjeta: false, pregunta: false };
const conNota = (t: string) => `${t}\n\n${NOTA_SIN_RESPALDO}`;

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

test('2. sin respaldo, lo que dice hecho queda y lleva UNA nota', () => {
  const sin = (t: string) => sanearSalida(t, { corrioHerramientas: false, hecho: NADA });
  assert.equal(sin('Listo, ya lo armé.').texto, conNota('Listo, ya lo armé.'), '«Listo, ya lo armé» sin nada que lo respalde');
  assert.equal(sin('Listo, te armé la automatización de los martes a las 3 para todo el funnel.').texto, conNota('Listo, te armé la automatización de los martes a las 3 para todo el funnel.'));
  assert.equal(sin('Quedó programada para todos los martes a las 15.').texto, conNota('Quedó programada para todos los martes a las 15.'));
  const conDato = 'Tu landing del webinar está publicada desde el lunes y tiene 230 visitas.';
  assert.equal(sin(conDato).texto, conDato, 'un dato del contexto no es una afirmación de algo hecho');
  const mezcla = 'Te cuento cómo viene tu funnel esta semana con los nuevos leads. Ya te creé la automatización. Y te armé el informe.';
  assert.equal(sin(mezcla).texto, conNota(mezcla), 'ninguna oración se borra, y la nota va UNA vez');
  assert.doesNotMatch(NOTA_SIN_RESPALDO, /otra vez|de nuevo y lo hago/, 'la nota no pide repetirlo');
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
  assert.match(s, /respaldado: escribieron > 0 \|\| \(intencion\.intencion !== 'actuar' && intencion\.intencion !== 'confirmar' && confirmadoTrasElUltimoPedido\(historial\)\),\s*leyo: leidas > 0, tarjeta: propuestas\.length > 0 \|\| retirado\.pantallas\.length > 0, pregunta: !!pregunta,/,
    'el guardia recibe lo que respalda por código: lo que escribió, o lo confirmado después del último pedido');
  assert.match(s, /if \(porId\(name\)\?\.tipo === 'control' && salioBien\(out\)\) escribieron\+\+;/, 'y los controles que escribieron de verdad');
});

test('4. el respaldo lo pone el código, con los «Hecho:» reales', () => {
  // Los «Hecho: …» que anota de VERDAD una tarjeta confirmada: el resumen de EJECUCIÓN (no el de la propuesta).
  const agendado = resultadoAgendar({ ok: true, codigo: '', motivo: '', titulo: 'Reunión con Ana López', inicioIso: '2026-10-27T13:00:00.000Z', tz: 'America/Argentina/Buenos_Aires', email: 'ana@gmail.com' }).resumen;
  assert.match(agendado, /^Listo: «Reunión con Ana López» quedó el /, 'el de agendar, tal como sale');
  const REALES: Array<[string, string]> = [
    [agendado, 'Sí, ya te la agendé.'],
    [agendado, 'Sí, quedó agendada para el martes a las 10.'],
    [agendado, '¡De nada! La reunión con Ana ya quedó agendada.'],
    ['Listo: pago de USD 300 registrado el 21 oct.', 'Sí, ya lo cargué.'],
    ['Agregué 3 tareas al plan. Míralas aquí:\nhttps://hola-mako.com/plan/t1', 'Sí, ya las cargué.'],
    ['Listo: Ana López pasó de «Seguimiento» a «Ganado» en «Mentoría».', 'Sí, ya la moví.'],
  ];
  for (const [hecho, respuesta] of REALES) {
    // Confirmó la tarjeta después de su pedido, y ahora pregunta «¿quedó?» (no es un pedido nuevo).
    const hilo = [
      { role: 'user', content: 'Hacelo, porfa' },
      { role: 'assistant', content: `Te lo dejo para confirmar abajo.\nHecho: ${hecho}` },
    ];
    assert.ok(confirmadoTrasElUltimoPedido(hilo), `la tarjeta confirmada después del pedido: ${hecho.slice(0, 30)}`);
    assert.equal(sanearSalida(respuesta, { corrioHerramientas: false, hecho: { ...NADA, respaldado: true } }).texto, respuesta, `«${respuesta}» queda entera y sin nota`);
  }
  // Un «Hecho:» de ANTES del último pedido es de otra cosa: confirmó la reunión con Ana, y después pidió el WhatsApp.
  const antes = [
    { role: 'user', content: 'Agéndame una reunión con Ana López el martes a las 10' },
    { role: 'assistant', content: `Hecho: ${agendado}` },
    { role: 'user', content: 'Gracias. ¿Y Juan?' },
  ];
  assert.equal(confirmadoTrasElUltimoPedido(antes), false, 'el «Hecho:» quedó antes del último mensaje de la persona');
  assert.equal(confirmadoTrasElUltimoPedido([{ role: 'assistant', content: 'No se pudo: Agendar reunión con Ana' }]), false, 'un «No se pudo» no respalda');
  assert.equal(sanearSalida('Listo, ya le mandé el WhatsApp a Juan.', { corrioHerramientas: true, hecho: { ...NADA, leyo: true } }).texto,
    conNota('Listo, ya le mandé el WhatsApp a Juan.'), 'sin respaldo: queda, con la nota');
  // Una lectura respalda un «quedó» (pudo leerlo), no un «ya le mandé».
  const estado = 'Miré tu agenda: la reunión con Ana quedó agendada para el martes.';
  assert.equal(sanearSalida(estado, { corrioHerramientas: true, hecho: { ...NADA, leyo: true } }).texto, estado, 'un «quedó» que pudo leer');
  // Con una tarjeta, «te dejé X para confirmar» habla de ella; «ya le mandé» sigue sin respaldo (el borrador no se mandó).
  const tarjeta = { ...NADA, tarjeta: true };
  const dejé = 'Te dejé la reunión con Ana para el martes: confírmala abajo.';
  assert.equal(sanearSalida(dejé, { corrioHerramientas: true, hecho: tarjeta }).texto, dejé);
  assert.equal(sanearSalida('Listo, ya le mandé el WhatsApp a Juan.', { corrioHerramientas: true, hecho: tarjeta }).texto, conNota('Listo, ya le mandé el WhatsApp a Juan.'), 'el borrador de Juan no respalda «ya le mandé»');
  // Con una pregunta, la pregunta cierra el mensaje: sin nota.
  assert.equal(sanearSalida('Te armé el borrador con las 5 tareas.', { corrioHerramientas: true, hecho: { ...NADA, pregunta: true } }).texto, 'Te armé el borrador con las 5 tareas.');
  // Un control que escribió de verdad respalda; uno que devolvió su error (en JSON, como cancelar_accion) no.
  assert.equal(salioBien('Listo: cancelé la acción #12 (Agendar reunión con Pedro).'), true);
  assert.equal(salioBien(JSON.stringify({ ok: false, error: 'No encuentro la acción #12 vigente.' })), false, 'su error viene como texto JSON');
  assert.equal(salioBien({ content: 'x', isError: true }), false);
  assert.equal(salioBien('❌ No se pudo: la acción ya estaba resuelta'), false);
  // «¡Listo! Le mandé…»: lo que se ve en el texto entero, queda entero, con UNA nota (no se contradice).
  assert.equal(sanearSalida('¡Listo! Le mandé el WhatsApp a Juan.', { corrioHerramientas: false, hecho: NADA }).texto, conNota('¡Listo! Le mandé el WhatsApp a Juan.'));
});
