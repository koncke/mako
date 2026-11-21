// =============================================================================
// «IR A UN PASO» CON TODOS LOS PASOS, COMO EL ARTEFACTO (21/11/2026, Martín probando en el ws 3, por el Cerebro)
// =============================================================================
// «Hoy son 16 bloques. Tiene que tener el desglose de cada uno: cada mensaje o pregunta del arranque, cada paso del recorrido (cada
// marca), y dentro de cada día sus partes (el video, cada tarea, cada marca), para ir exactamente al paso que quiere.»
//   · el arranque: el video de bienvenida, cada pregunta, la segunda del contacto («si no lo guardó») y el cierre;
//   · el recorrido: la llegada y cada una de sus marcas (las de lib/onboarding-v2/recorrido.ts, con sus títulos);
//   · cada día: MaKo escribe y manda el video, el video, cada tarea y cada marca de cada tarea.
// Al llegar, la marca exacta la arranca quien corresponde: el motor (el recorrido, desde su paso) y el chat del reto (la tarea, desde
// su marca; las de antes se tocan solas, como el `antes` en cadena del motor).
// El código del WhatsApp NO está: su paso es el del punto 3 (el camino de un número nuevo, con el modal que simula WhatsApp).
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PASOS_DE_REVISION, clavesVistasDelReto, despuesDelPaso, destinoDelPaso, diaDelPaso, esPasoDeRevision, estadoArranqueHasta, saltoDelPaso } from '../lib/onboarding-v2/saltar';
import { TUTORIAL_RECORRIDO } from '../lib/onboarding-v2/recorrido';
import { DIAS_RETO } from '../lib/reto/dias';
import { etapaDeArranqueV2, type HechosArranque } from '../lib/onboarding-arranque';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const HECHOS = { modo: 'oferta', v2: true, conTelefono: true, terminado: false, nombreCuenta: 'Martín', nombreWorkspace: 'Laland' } as unknown as HechosArranque;
const ids = PASOS_DE_REVISION.map((p) => p.id);

test('1. la lista: el arranque mensaje por mensaje, el recorrido marca por marca y cada día con su video, sus tareas y sus marcas', () => {
  assert.deepEqual(ids.slice(0, 9), ['bienvenida', 'nombre', 'telefono', 'agendado', 'agendado-no', 'negocio', 'origen', 'interes', 'cierre']);
  assert.deepEqual(ids.slice(9, 10 + TUTORIAL_RECORRIDO.pasos.length), ['llegada', ...TUTORIAL_RECORRIDO.pasos.map((_, k) => `recorrido-${k + 1}`)]);
  TUTORIAL_RECORRIDO.pasos.forEach((p, k) => assert.ok(PASOS_DE_REVISION.find((x) => x.id === `recorrido-${k + 1}`)?.rotulo.includes(p.titulo), `la marca ${k + 1}, con su título`));
  for (const d of DIAS_RETO) {
    assert.ok(ids.includes(`dia-${d.n}`) && ids.includes(`dia-${d.n}-video`), `el día ${d.n} y su video`);
    for (const t of d.tareas.filter((x) => !x.siempre)) {
      assert.ok(ids.includes(`dia-${d.n}-${t.id}`), `día ${d.n}: la tarea ${t.id}`);
      t.marcas.slice(1).forEach((_, k) => assert.ok(ids.includes(`dia-${d.n}-${t.id}-${k + 2}`), `día ${d.n}: ${t.id}, la marca ${k + 2}`));
    }
  }
  assert.equal(new Set(ids).size, ids.length, 'sin repetidos');
  assert.ok(ids.length > 60, 'el desglose entero, no 16 bloques');
  assert.equal(esPasoDeRevision('dia-2-video'), true);
  assert.equal(esPasoDeRevision('dia-9'), false);
  assert.ok(!ids.includes('codigo'), 'el código del WhatsApp va con el punto 3');
});

test('2. el arranque: cada mensaje deja la máquina de verdad en su etapa (el video de bienvenida, y la segunda del contacto)', () => {
  const b = estadoArranqueHasta('bienvenida', { telefonoNumero: null });
  assert.equal(etapaDeArranqueV2(b, HECHOS), 'nombre');
  assert.ok(!b.introVista, 'el video de bienvenida vuelve a salir');
  const no = estadoArranqueHasta('agendado-no', { telefonoNumero: '5491155550101' });
  assert.equal(etapaDeArranqueV2(no, HECHOS), 'agendado', 'sigue en el contacto');
  assert.equal(no.agendado, 'no', 'con la segunda pregunta («si no lo guardó»)');
});

test('3. al llegar, la marca exacta: el recorrido desde su paso; la tarea desde su marca; el día y su video, como recién llegado', () => {
  assert.deepEqual(saltoDelPaso('recorrido-3'), { recorrido: 2 });
  assert.equal(saltoDelPaso('llegada'), null);
  const d2 = DIAS_RETO.find((d) => d.n === 2)!;
  const t = d2.tareas.find((x) => !x.siempre && x.marcas.length > 1)!;
  assert.deepEqual(saltoDelPaso(`dia-2-${t.id}`), { dia: 2, tarea: t.id, marca: 0 });
  assert.deepEqual(saltoDelPaso(`dia-2-${t.id}-2`), { dia: 2, tarea: t.id, marca: 1 });
  assert.equal(saltoDelPaso('dia-2'), null);
  assert.equal(diaDelPaso(`dia-2-${t.id}-2`), 2);
  // Lo visto de hoy en el navegador: con el día, nada; con el video, su entrada; con una tarea, la entrada y el video.
  const i = '2026-11-21T00:00:00.000Z';
  assert.ok(!clavesVistasDelReto(i, 2, 'dia-2').some((k) => /\|(video|entrada):2$/.test(k)));
  assert.ok(clavesVistasDelReto(i, 2, 'dia-2-video').includes(`mako.reto.visto.${i}|entrada:2`));
  assert.ok(!clavesVistasDelReto(i, 2, 'dia-2-video').includes(`mako.reto.visto.${i}|video:2`));
  assert.ok(clavesVistasDelReto(i, 2, `dia-2-${t.id}`).includes(`mako.reto.visto.${i}|video:2`));
  // Las tareas de hoy antes de la elegida, «Lo hago después»: la elegida es la próxima.
  const antes = d2.tareas.slice(0, d2.tareas.indexOf(t)).filter((x) => !x.siempre).map((x) => `2:${x.id}`);
  assert.deepEqual(despuesDelPaso(`dia-2-${t.id}`), antes);
  // Adónde: el recorrido en la flecha necesita el grafo abierto; lo demás, el reto.
  const iFlecha = TUTORIAL_RECORRIDO.pasos.findIndex((p) => p.sel.includes('sb-brain-volver'));
  assert.equal(destinoDelPaso(`recorrido-${iFlecha + 1}`), '/second-brain?panel=mapa');
  assert.equal(destinoDelPaso('recorrido-1'), '/second-brain?reto=1');
  assert.equal(destinoDelPaso('nombre'), '/onboarding');
});

test('4. quién arranca la marca: el motor (desde su paso, sin el video) y el chat del reto (la tarea, con las marcas de antes en cadena)', () => {
  const st = sinComentarios(fuente('app/_ui/tutorial/store.ts'));
  assert.match(st, /desde\?: number/);
  const m = sinComentarios(fuente('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /useState\(senal\.tipo === 'tutorial' && senal\.desde \? senal\.desde : /, 'empieza en su paso');
  assert.match(m, /senal\.tipo === 'tutorial' && senal\.desde \? null :/, 'sin el video (sigue los pasos desde el primero)');
  assert.match(m, /tomarSalto\(esDelRecorrido\)/, 'el motor toma el salto del recorrido');
  const r = sinComentarios(fuente('app/second-brain/reto/ChatDelReto.tsx'));
  assert.match(r, /tomarSalto\(esDeUnaTarea\)/, 'el chat del reto toma el de la tarea');
  assert.match(r, /marcasDesde\(marcasDeLaTarea\(t\), s\.marca\)/);
  const s = sinComentarios(fuente('app/_components/SaltarAPaso.tsx'));
  assert.match(s, /anotarSalto\(j\.salto\)/);
  assert.match(s, /for \(const k of j\.vistos \?\? \[\]\)/);
  const p = sinComentarios(fuente('lib/onboarding-v2/salto-pendiente.ts'));
  assert.match(p, /sessionStorage/, 'por pestaña: lo toma la pantalla a la que se va');
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (21/11/2026), de a una rotura, y cada una cae:
//   · sin las marcas de las tareas en la lista                       → 1
//   · la bienvenida con el video ya visto                            → 2
//   · el salto del recorrido corrido en uno                          → 3
//   · lo visto de hoy con el video en el paso del video              → 3
//   · el motor sin empezar en su paso                                → 4
// ─────────────────────────────────────────────────────────────────────────────
