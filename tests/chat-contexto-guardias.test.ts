// =============================================================================
// El contexto y las guardias del chat de la app (20/10/2026, ola 1, pieza 1.5)
// =============================================================================
// docs/ops-center-principal.md §5. Hecho = «El system de un workspace que no es el 1 no nombra a Martín; "Listo, ya lo
// armé" sin herramienta sale marcado como no hecho; con 2 o más informes no pide un email». Lo que se fija:
//   1. el perfil del negocio va con el nombre del negocio, en el chat de MaKo y en el asesor de WhatsApp; ningún archivo
//      vuelve a decir «NEGOCIO DE MARTÍN» ni «del negocio de Martín» (la retrospectiva y el asesor de WhatsApp también lo
//      decían). Es la misma regla de tests/prompt-sin-dueno.test.ts, que mira los encuadres de lib/prompt-defaults.ts;
//      ésta barre todo el código;
//   2. en el chat de la app NINGUNA oración se borra por lo que dice: lo que afirma un hecho sin respaldo queda y lleva
//      UNA nota («No veo esa acción en este chat…»); la promesa de algo inmediato sin herramientas, la suya; nunca las
//      dos. Sólo cuenta una afirmación CLARA: primera persona, pasado con tilde, sin negación, sin pregunta y sin hablar
//      de lo propuesto. Un dato del contexto no lleva nota, y el doer de WhatsApp sigue como estaba;
//   3. el chat de la app le pasa al guardia lo que respalda por CÓDIGO: un control que escribió de verdad, o una tarjeta
//      confirmada después del último PEDIDO (un «gracias» no corta), salvo que este mensaje sea un pedido;
//   4. con los «Hecho:» REALES (el resumen de ejecución de `resultadoAgendar`, del pago, de las tareas, de mover), la
//      tarjeta confirmada respalda «Sí, ya te la agendé» y las respuestas cortas; un «Hecho:» de antes del último pedido,
//      no. El banco completo de frases está en tests/chat-guardia-banco.test.ts.
//      ⚠️ Lo obvio fue el error tres veces (borrar por si corrió algo, por las raíces, y las promesas que borraban desde
//      main): ninguna oración se borra.
// ⚠️ Lo que NO es de esta pieza: la persona de MaKo dice «el consultor IA de Martín Koncke» (lib/mako-persona.ts): es la
//    marca, y cambiarla es una decisión de Martín. «Mi hoja» por quien chatea (con 2 o más informes) es del Dashboard.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · el rótulo de vuelta a «NEGOCIO DE MARTÍN» en lib/mako-context.ts → 1 fallo (1);
//   · (la tercera revisión, 21/10) el camino de promesas borrando otra vez en la app → 1 fallo (2); `afirmacionesDeHecho`
//     sin mirar la tilde → 1 fallo (2); el turno sin `esPedido` → 1 fallo (3); `confirmadoTrasElUltimoPedido` que corta
//     con un «gracias» → 1 fallo (4); `salioBien` que da bien un error en JSON → 1 fallo (4).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rotuloDelNegocio } from '../lib/negocio-rotulo';
import { NOTA_SIN_HACER, NOTA_SIN_RESPALDO, SIN_HACER, afirmacionesDeHecho, sanearSalida } from '../lib/doer-salida';
import { confirmadoTrasElUltimoPedido, esPedido, salioBien } from '../lib/mako-turno-app-reglas';
import { clasificarIntencion } from '../lib/mako-intencion';
import { resultadoAgendar } from '../lib/agenda-sin-ia';

/** El chat de la app, sin nada que respalde un hecho. */
const NADA = { respaldado: false };
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

test('2. en la app ninguna oración se borra: lo que afirma un hecho sin respaldo lleva UNA nota', () => {
  const sin = (t: string, corrio = false) => sanearSalida(t, { corrioHerramientas: corrio, hecho: NADA });
  assert.equal(sin('Listo, ya lo armé.').texto, conNota('Listo, ya lo armé.'));
  assert.equal(sin('Le mandé el WhatsApp a Juan con el link.').texto, conNota('Le mandé el WhatsApp a Juan con el link.'), 'el pretérito al principio también');
  const mezcla = 'Te cuento cómo viene tu funnel esta semana. Ya te creé la automatización. Y te armé el informe.';
  assert.equal(sin(mezcla).texto, conNota(mezcla), 'una sola nota');
  // Lo que NO afirma: subjuntivo (sin tilde), negación, pregunta, oferta, lo propuesto.
  for (const t of ['¿Querés que te mande el resumen?', 'Para que te cargue los leads, pásame el CSV.', 'No te agendé la reunión porque Ana no tiene email.',
    'Si querés, te armo un borrador.', 'Te armé la propuesta: confírmala abajo.', 'Tu landing del webinar está publicada desde el lunes.']) {
    assert.equal(sin(t).texto, t, `«${t}» no afirma nada`);
  }
  // La promesa de algo inmediato sin herramientas: la oración queda, con su nota; nunca las dos notas.
  assert.equal(sin('Déjame ver el plan y te cuento.').texto, 'Déjame ver el plan y te cuento.\n\n' + NOTA_SIN_HACER);
  assert.equal(sin('Ya te creé la automatización. Déjame ver si hay algo más.').texto, conNota('Ya te creé la automatización. Déjame ver si hay algo más.'), 'el hecho primero');
  assert.equal(sin('Perfecto, cualquier cosa te aviso.').texto, 'Perfecto, cualquier cosa te aviso.', 'una oferta no es una promesa');
  assert.deepEqual(afirmacionesDeHecho('Juan quedó agendado ayer. Esa la armó tu equipo.'), [], 'lo que hizo otro no');
  // El doer de WhatsApp sigue como estaba: una promesa sin herramientas se saca.
  assert.equal(sanearSalida('Déjame ver el plan.', { corrioHerramientas: false }).texto, SIN_HACER);
});

test('3. el chat de la app le pasa al guardia lo que respalda por código', () => {
  const s = sinComentarios(leer('lib/mako-turno-app.ts'));
  const correr = s.slice(s.indexOf('const runTool = async'), s.indexOf('const previo = memo.previo(name);'));
  assert.ok(correr.indexOf('corridas++') > correr.indexOf('guardia.bloquea(name)'), 'lo rechazado (no permitido, o después de preguntar) no cuenta');
  assert.match(s, /if \(porId\(name\)\?\.tipo === 'control' && salioBien\(out\)\) escribieron\+\+;/, 'los controles que escribieron de verdad');
  assert.match(s, /respaldado: escribieron > 0 \|\| \(!esPedido\(intencion\.intencion\) && confirmadoTrasElUltimoPedido\(historial,\s*\(t\) => esPedido\(clasificarIntencion\(t, \{ hayMedia: false \}\)\.intencion\)\)\),/,
    'lo que escribió, o lo confirmado después del último pedido (si este mensaje no es uno)');
});

test('4. con los «Hecho:» reales, lo confirmado después del pedido respalda la respuesta', () => {
  const agendado = resultadoAgendar({ ok: true, codigo: '', motivo: '', titulo: 'Reunión con Ana López', inicioIso: '2026-10-27T13:00:00.000Z', tz: 'America/Argentina/Buenos_Aires', email: 'ana@gmail.com' }).resumen;
  assert.match(agendado, /^Listo: «Reunión con Ana López» quedó el /, 'el de agendar, tal como sale');
  const pide = (t: string) => esPedido(clasificarIntencion(t, { hayMedia: false }).intencion);
  for (const [hecho, respuesta] of [
    [agendado, 'Sí, ya te la agendé.'],
    ['Listo: pago de USD 300 registrado el 21 oct.', 'Sí, ya lo cargué.'],
    ['Agregué 3 tareas al plan. Míralas aquí:\nhttps://hola-mako.com/plan/t1', 'Sí, ya las cargué.'],
    ['Listo: Ana López pasó de «Seguimiento» a «Ganado» en «Mentoría».', 'Sí, ya la moví.'],
  ]) {
    const hilo = [
      { role: 'user', content: 'Agéndame una reunión con Ana López el martes a las 10' },
      { role: 'assistant', content: `Te la dejo para confirmar abajo.\nHecho: ${hecho}` },
      // Un «gracias» en el medio no corta: no es un pedido.
      { role: 'user', content: '¡Gracias!' },
      { role: 'assistant', content: '¡De nada!' },
    ];
    assert.ok(confirmadoTrasElUltimoPedido(hilo, pide), `confirmado después del pedido: ${hecho.slice(0, 30)}`);
    assert.equal(sanearSalida(respuesta, { corrioHerramientas: false, hecho: { respaldado: true } }).texto, respuesta, `«${respuesta}» queda sin nota`);
  }
  // Un pedido NUEVO después del «Hecho:» corta: lo de antes es de otra cosa.
  const otro = [
    { role: 'user', content: 'Agéndame una reunión con Ana López el martes a las 10' },
    { role: 'assistant', content: `Hecho: ${agendado}` },
    { role: 'user', content: 'Agéndame otra con Pedro el jueves a las 15' },
  ];
  assert.equal(confirmadoTrasElUltimoPedido(otro, pide), false);
  assert.equal(confirmadoTrasElUltimoPedido([{ role: 'assistant', content: 'No se pudo: Agendar reunión con Ana' }]), false, 'un «No se pudo» no respalda');
  // Un control que escribió de verdad respalda; uno que devolvió su error (en JSON, como cancelar_accion) no.
  assert.equal(salioBien('Listo: cancelé la acción #12 (Agendar reunión con Pedro).'), true);
  assert.equal(salioBien(JSON.stringify({ ok: false, error: 'No encuentro la acción #12 vigente.' })), false);
  assert.equal(salioBien({ content: 'x', isError: true }), false);
  assert.equal(salioBien('❌ No se pudo: la acción ya estaba resuelta'), false);
});
