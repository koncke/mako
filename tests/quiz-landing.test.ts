// =============================================================================
// El quiz con diagnóstico de una landing (6/11/2026, lib/editor-landing/quiz.ts)
// =============================================================================
// Martín (29/10/2026): «un quiz (preguntas que llevan a un diagnóstico)». Lo que decide, ejecutado:
//   · qué resultado gana (`indiceDeResultado`) y la MISMA regla en el script de la página (`ELEGIR_RESULTADO_JS`), comparadas
//     sobre miles de casos al azar;
//   · la página publicada en un DOM (jsdom) con su script de verdad: la portada, «Elige una opción», el contacto y el
//     resultado según lo contestado; dos quizzes en una página no se pisan;
//   · el Pixel de VERDAD (lib/landing-token.ts, en un node aparte porque tiene server-only) leyendo el formulario del quiz: el
//     resultado, el puntaje y las respuestas llegan como datos del lead;
//   · sin una pregunta completa y un resultado con título no sale; el saneo lo guarda; la IA lo conserva; la API lo valida.
//
// Probado rompiéndolo (base 10 pases y 0 fallos; cada rotura, cuántos tests cayó y cuáles):
//   · `indiceDeResultado` con `<` en vez de `<=`                          → 2: «qué resultado gana» y «la regla del navegador».
//   · `ELEGIR_RESULTADO_JS` eligiendo el primero que alcanza              → 3: «la regla del navegador», «el flujo» y «el Pixel».
//   · `llenar()` sacado del script (los campos del lead vacíos)           → 2: «el flujo» y «el Pixel lee el resultado».
//   · los nombres de las opciones sin el número del quiz                  → 1: «dos quizzes en una página».
//   · render.ts sin saltear el quiz a medio armar                         → 1: «sin el dato no sale».
//   · `siguiente` sin exigir una opción                                   → 1: «el flujo en la página».
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Script, runInNewContext } from 'node:vm';
// jsdom viene en node_modules sin sus tipos: se carga con su forma mínima (como tests/bloques-venta-landing.test.ts).
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string, o: { runScripts: 'outside-only'; url?: string }) => { window: unknown } };
import {
  ELEGIR_RESULTADO_JS, QUIZ_NUEVO, SCRIPT_QUIZ, attrsQuiz, avisoDelBoton, faltaDelQuiz, indiceDeResultado, preguntasCompletas, puntajeMaximo,
  quizListo, resultadoDe, resultadosCompletos,
} from '../lib/editor-landing/quiz';
import { htmlDePagina } from '../lib/editor-landing/render';
import { temaPorId } from '../lib/editor-landing/temas';
import { NODO, type JsonNodo, type LandingContenido, type Pagina } from '../lib/editor-landing/doc';
import { CONFIG_DEFAULT } from '../lib/editor-landing/api-tipos';
import { SCRIPT_PAGINA } from '../lib/editor-landing/pagina-publica';
import { sanearContenido } from '../lib/editor-landing/validar';
import { tarjetaABloques, bloquesATarjeta } from '../lib/editor-landing/ia-bloques';
import { planQuiz } from '../lib/api-mako/areas/landing-contenido.helpers';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const tema = temaPorId('pewter');

/** El quiz de los tests: tres preguntas, tres resultados (el del medio con un botón). */
const QUIZ = {
  titulo: '¿Por qué tus anuncios no traen pacientes?', intro: '3 preguntas.', empezar: '', enviar: '', pideTelefono: true,
  preguntas: [
    { texto: '¿Qué anuncias?', opciones: [{ texto: 'Limpieza', puntos: 0 }, { texto: 'Un tratamiento', puntos: 1 }, { texto: 'Implantes', puntos: 2 }] },
    { texto: '¿Cuánto tardas en contestar?', opciones: [{ texto: 'Horas', puntos: 0 }, { texto: 'Minutos', puntos: 2 }] },
    { texto: '¿Quién contesta?', opciones: [{ texto: 'Nadie', puntos: 0 }, { texto: 'Recepción', puntos: 1 }, { texto: 'Alguien con guion', puntos: 2 }] },
  ],
  resultados: [
    { desde: 5, titulo: 'Listo para escalar', texto: 'Tu base está.\nSuma presupuesto.', boton: '', href: '' },
    { desde: 0, titulo: 'Atraes curiosos', texto: 'Cambia lo que anuncias.', boton: '', href: '' },
    { desde: 3, titulo: 'Se pierden en el chat', texto: 'Contesta antes.', boton: 'Ver la guía', href: 'https://example.com/guia' },
  ],
};
const quiz = (attrs: unknown = QUIZ): JsonNodo => ({ type: NODO.quiz, attrs: attrs as Record<string, unknown> });
const pagina = (bloques: JsonNodo[]): Pagina => ({ id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [{ type: NODO.tarjeta, attrs: { id: 'tA' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }, ...bloques] }] } });
const html = (bloques: JsonNodo[]) => htmlDePagina(pagina(bloques), CONFIG_DEFAULT, tema, { modo: 'publico' });

test('qué resultado gana: el de «desde» más alto que alcanza; los empates, en el orden en que se escribieron', () => {
  const a = attrsQuiz(QUIZ);
  assert.deepEqual(resultadosCompletos(a).map((r) => r.titulo), ['Atraes curiosos', 'Se pierden en el chat', 'Listo para escalar']);
  assert.equal(puntajeMaximo(a), 6);
  assert.equal(resultadoDe(QUIZ, [0, 0, 0])?.resultado.titulo, 'Atraes curiosos');
  assert.equal(resultadoDe(QUIZ, [2, 0, 1])?.resultado.titulo, 'Se pierden en el chat', '3 puntos: alcanza el «desde 3»');
  assert.equal(resultadoDe(QUIZ, [2, 0, 2])?.puntaje, 4);
  assert.equal(resultadoDe(QUIZ, [2, 1, 1])?.resultado.titulo, 'Listo para escalar', '5 puntos: el «desde 5»');
  assert.equal(resultadoDe(QUIZ, [null, null, null])?.resultado.titulo, 'Atraes curiosos');
  // Si ninguno alcanza (todos «desde» más alto), el primero.
  assert.equal(indiceDeResultado([3, 5], 0), 0);
  assert.equal(indiceDeResultado([0, 0, 4], 0), 1, 'a igual «desde», el último que alcanza');
  assert.equal(indiceDeResultado([], 9), 0);
});

test('la regla del navegador es la misma que la del servidor, sobre miles de casos', () => {
  const ctx: Record<string, unknown> = {};
  runInNewContext(`${ELEGIR_RESULTADO_JS}; this.f = gmQuizElegir;`, ctx);
  const enPagina = ctx.f as (d: number[], p: number) => number;
  let semilla = 7;
  const azar = (n: number) => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla % n; };
  for (let i = 0; i < 5000; i++) {
    const desdes = Array.from({ length: 1 + azar(6) }, () => azar(20)).sort((x, y) => x - y);
    const p = azar(25);
    assert.equal(enPagina(desdes, p), indiceDeResultado(desdes, p), `desdes ${desdes} con ${p}`);
  }
});

test('el script que se sirve: sin barras invertidas, backticks ni ${, y compila', () => {
  const s = SCRIPT_QUIZ.join('\n');
  assert.doesNotMatch(s, /\\|`|\$\{/, 'el script del quiz va adentro de un texto que se sirve');
  assert.doesNotThrow(() => new Script(SCRIPT_PAGINA), 'el script de la página no compila');
  assert.ok(SCRIPT_PAGINA.includes('function quizzes()'), 'el script del quiz no está en el de la página');
});

test('sin el dato no sale: una pregunta completa y un resultado con título; el editor dice qué falta', () => {
  assert.equal(quizListo(QUIZ_NUEVO), false);
  assert.equal(faltaDelQuiz(QUIZ_NUEVO), 'Falta una pregunta con dos opciones');
  const unaOpcion = { ...QUIZ, preguntas: [{ texto: '¿Uno?', opciones: [{ texto: 'Sí', puntos: 1 }, { texto: '', puntos: 0 }] }] };
  assert.equal(quizListo(unaOpcion), false, 'una pregunta con una sola opción escrita no sale');
  assert.equal(faltaDelQuiz({ ...QUIZ, resultados: [{ desde: 0, titulo: '' }] }), 'Falta un resultado con título');
  assert.doesNotMatch(html([quiz(QUIZ_NUEVO)]), /gm-quiz/, 'un quiz a medio armar no se dibuja en la página');
  assert.match(html([quiz()]), /class="gm-quiz" data-quiz-n="3"/);
  // Las opciones sin texto no salen; las preguntas completas sí.
  assert.equal(preguntasCompletas(attrsQuiz({ ...QUIZ, preguntas: [...QUIZ.preguntas, { texto: '', opciones: [] }] })).length, 3);
  // El saneo del server lo conoce: se guarda sin descartes.
  const r = sanearContenido({ v: 1, paginas: [pagina([quiz()])] } as LandingContenido);
  assert.deepEqual(r.descartes, []);
  // El botón de un resultado sin link de la casa (o sin texto) no sale: el editor lo dice al lado.
  assert.equal(avisoDelBoton({ boton: 'Agendar', href: '' }), 'Sin un link válido, el botón no se muestra.');
  assert.equal(avisoDelBoton({ boton: 'Agendar', href: 'javascript:alert(1)' }), 'Sin un link válido, el botón no se muestra.');
  assert.equal(avisoDelBoton({ boton: '', href: 'https://example.com' }), 'Sin texto, el botón no se muestra.');
  assert.equal(avisoDelBoton({ boton: 'Agendar', href: 'https://example.com' }), null);
  assert.equal(avisoDelBoton({ boton: '', href: '' }), null);
});

test('la página publicada: lo que se ve sin JavaScript es la portada, y el link de un resultado es de la casa', () => {
  const h = html([quiz()]);
  assert.match(h, /<h3 class="gm-quiz-titulo">¿Por qué tus anuncios no traen pacientes\?<\/h3>/);
  assert.match(h, /<fieldset class="gm-quiz-pregunta" data-paso="0" hidden="">/);
  assert.match(h, /<form class="gm-quiz-form" method="post" hidden="">/);
  assert.match(h, /type="email" name="email"/);
  assert.match(h, /type="tel" name="telefono"/, 'pide el WhatsApp si se marcó');
  assert.match(h, /<label class="gm-quiz-dato"><span>Resultado del quiz<\/span><input type="text" readonly="" tabindex="-1" data-quiz-dato="resultado"/);
  assert.match(h, /<a class="gm-boton" data-variante="primario" href="https:\/\/example\.com\/guia" target="_blank" rel="noopener noreferrer">Ver la guía<\/a>/);
  // Un link que no es de la casa no se guarda.
  assert.equal(attrsQuiz({ ...QUIZ, resultados: [{ desde: 0, titulo: 'x', boton: 'Ir', href: 'javascript:alert(1)' }] }).resultados[0].href, '');
  // Exportada (PDF, PNG, HTML) la ve el cliente y no se puede contestar: la portada sola, sin los puntajes ni lo que falta.
  const exp = htmlDePagina(pagina([quiz()]), CONFIG_DEFAULT, tema, { modo: 'exportar' });
  assert.match(exp, /<h3 class="gm-quiz-titulo">¿Por qué tus anuncios no traen pacientes\?<\/h3>/);
  assert.doesNotMatch(exp, /gm-quiz-resumen|desde \d|sin escribir/);
});

/** La página en un DOM, con su script. */
function enDom(h: string) {
  const dom = new JSDOM(`<!doctype html><html><body>${h}</body></html>`, { runScripts: 'outside-only' });
  const w = dom.window as unknown as Window & typeof globalThis & { eval: (s: string) => unknown };
  w.eval(SCRIPT_PAGINA);
  const d = w.document;
  const clic = (el: Element | null) => { assert.ok(el, 'no está el botón'); (el as HTMLElement).click(); };
  const visibles = (z: Element, sel: string) => [...z.querySelectorAll(sel)].filter((e) => !(e as HTMLElement).hidden);
  return { w, d, clic, visibles };
}

function contestar(z: Element, clic: (e: Element | null) => void, elegidas: number[]) {
  for (const [i, k] of elegidas.entries()) {
    const paso = z.querySelector(`.gm-quiz-pregunta[data-paso="${i}"]`)!;
    (paso.querySelectorAll('input[type=radio]')[k] as HTMLInputElement).click();
    clic(paso.querySelector('[data-quiz="siguiente"]'));
  }
}

test('el flujo en la página: empezar, «Elige una opción», el contacto con los datos llenos y el resultado que corresponde', () => {
  const { d, clic, visibles } = enDom(html([quiz()]));
  const z = d.querySelector('.gm-quiz')!;
  assert.equal(visibles(z, '.gm-quiz-pregunta').length, 0);
  clic(z.querySelector('[data-quiz="empezar"]'));
  assert.equal((z.querySelector('.gm-quiz-inicio') as HTMLElement).hidden, true);
  assert.equal(z.querySelector('.gm-quiz-cuenta')?.textContent, 'Pregunta 1 de 3');
  // El foco va al paso nuevo (el botón que se apretó queda escondido): la primera opción.
  assert.equal(d.activeElement, z.querySelector('.gm-quiz-pregunta[data-paso="0"] input[type=radio]'), 'el foco no pasó a la pregunta');
  // Sin elegir no avanza, y lo dice.
  clic(z.querySelector('.gm-quiz-pregunta[data-paso="0"] [data-quiz="siguiente"]'));
  assert.equal((z.querySelector('.gm-quiz-pregunta[data-paso="0"]') as HTMLElement).hidden, false);
  assert.equal((z.querySelector('.gm-quiz-pregunta[data-paso="0"] .gm-quiz-falta') as HTMLElement).hidden, false);
  contestar(z, clic, [2, 0, 1]);
  const form = z.querySelector('.gm-quiz-form') as HTMLFormElement;
  assert.equal(form.hidden, false, 'después de la última va el contacto');
  assert.equal(d.activeElement, form.querySelector('[name=nombre]'), 'el foco no pasó al primer campo del contacto');
  // «Anterior» desde el contacto vuelve a la última pregunta, con lo elegido (y el foco en lo elegido).
  clic(form.querySelector('[data-quiz="atras"]'));
  assert.equal((z.querySelector('.gm-quiz-pregunta[data-paso="2"]') as HTMLElement).hidden, false);
  assert.equal(d.activeElement, z.querySelector('.gm-quiz-pregunta[data-paso="2"] input[type=radio]:checked'));
  clic(z.querySelector('.gm-quiz-pregunta[data-paso="2"] [data-quiz="siguiente"]'));
  const dato = (k: string) => (form.querySelector(`[data-quiz-dato="${k}"]`) as HTMLInputElement).value;
  assert.equal(dato('resultado'), 'Se pierden en el chat');
  assert.equal(dato('puntaje'), '3');
  assert.deepEqual([...form.querySelectorAll('[data-quiz-respuesta]')].map((e) => (e as HTMLInputElement).value), ['Implantes', 'Horas', 'Recepción']);
  // Enviar sin correo no muestra el resultado (la validación del navegador).
  form.dispatchEvent(new d.defaultView!.Event('submit', { cancelable: true, bubbles: true }));
  assert.equal(visibles(z, '.gm-quiz-resultado').length, 0);
  (form.querySelector('[name=nombre]') as HTMLInputElement).value = 'Ana';
  (form.querySelector('[name=email]') as HTMLInputElement).value = 'ana@example.com';
  const ev = new d.defaultView!.Event('submit', { cancelable: true, bubbles: true });
  form.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, true, 'el envío del navegador se cancela: el opt-in lo manda el Pixel');
  assert.equal(form.hidden, true);
  assert.deepEqual(visibles(z, '.gm-quiz-resultado').map((r) => r.querySelector('h3')?.textContent), ['Se pierden en el chat']);
  assert.equal(d.activeElement, visibles(z, '.gm-quiz-resultado')[0], 'el foco no pasó al resultado');
});

test('dos quizzes en una página no se pisan: cada uno con sus opciones', () => {
  const { d, clic } = enDom(html([quiz(), quiz()]));
  const [z1, z2] = [...d.querySelectorAll('.gm-quiz')];
  const nombres = (z: Element) => new Set([...z.querySelectorAll('input[type=radio]')].map((r) => (r as HTMLInputElement).name));
  for (const n of nombres(z1)) assert.ok(!nombres(z2).has(n), `las dos usan «${n}»`);
  clic(z1.querySelector('[data-quiz="empezar"]'));
  clic(z2.querySelector('[data-quiz="empezar"]'));
  (z1.querySelectorAll('.gm-quiz-pregunta[data-paso="0"] input')[2] as HTMLInputElement).click();
  (z2.querySelectorAll('.gm-quiz-pregunta[data-paso="0"] input')[0] as HTMLInputElement).click();
  assert.equal((z1.querySelectorAll('.gm-quiz-pregunta[data-paso="0"] input')[2] as HTMLInputElement).checked, true, 'elegir en el segundo desmarcó el primero');
});

/** El Pixel de VERDAD (server-only: en un node aparte) y lo que manda al enviar el formulario del quiz. */
function optinDelPixel(pagina: string, elegidas: number[]): Record<string, unknown> | null {
  const m = (r: string) => JSON.stringify(pathToFileURL(join(RAIZ, r)).href);
  const pixel = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', [
    `import { landingSnippet } from ${m('lib/landing-token.ts')};`,
    `import { pixelComoArchivo } from ${m('lib/pixel-archivo.ts')};`,
    `process.stdout.write(pixelComoArchivo(landingSnippet('mko_${'c3'.repeat(16)}')) ?? '');`,
  ].join('\n')], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  assert.ok(pixel.length > 1000, 'no salió el Pixel');
  const dom = new JSDOM(`<!doctype html><html><body>${pagina}</body></html>`, { runScripts: 'outside-only', url: 'https://hola-mako.site/quiz' });
  const w = dom.window as unknown as Window & typeof globalThis & { eval: (s: string) => unknown };
  const enviados: string[] = [];
  const guardar = (cuerpo: unknown) => { if (typeof cuerpo === 'string') enviados.push(cuerpo); };
  w.fetch = (async (_url: unknown, o?: { body?: unknown }) => { guardar(o?.body); return { ok: true, json: async () => ({}), text: async () => '' }; }) as never;
  Object.defineProperty(w.navigator, 'sendBeacon', { value: (_u: string, cuerpo: unknown) => { guardar(cuerpo); return true; } });
  w.eval(pixel);
  w.eval(SCRIPT_PAGINA);
  const z = w.document.querySelector('.gm-quiz')!;
  (z.querySelector('[data-quiz="empezar"]') as HTMLElement).click();
  contestar(z, (e) => (e as HTMLElement).click(), elegidas);
  const form = z.querySelector('.gm-quiz-form') as HTMLFormElement;
  (form.querySelector('[name=nombre]') as HTMLInputElement).value = 'Ana';
  (form.querySelector('[name=email]') as HTMLInputElement).value = 'ana@example.com';
  form.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  const optin = enviados.map((s) => { try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; } })
    .find((o) => o && (o.email === 'ana@example.com'));
  return optin ?? null;
}

test('el Pixel lee el resultado: el resultado, el puntaje y las respuestas llegan como datos del lead', () => {
  const o = optinDelPixel(html([quiz()]), [2, 1, 2]);
  assert.ok(o, 'el Pixel no mandó el opt-in del quiz');
  assert.equal(o!.nombre, 'Ana');
  const r = o!.respuestas as Record<string, string>;
  assert.equal(r['Resultado del quiz'], 'Listo para escalar');
  assert.equal(r['Puntaje del quiz'], '6');
  assert.equal(r['1. ¿Qué anuncias?'], 'Implantes');
  assert.equal(r['2. ¿Cuánto tardas en contestar?'], 'Minutos');
});

// El Pixel decide qué es contacto mirando name, id, placeholder y aria-label (lib/landing-token.ts → `campo()`): una pregunta que
// dice «negocio», «hotel» o «email» no puede llegar al lead como su empresa, su teléfono o su correo. Probado poniéndole a los
// campos del quiz el `aria-label` de antes: este test cae en la primera aserción (la respuesta llegaba como la empresa).
test('una pregunta que nombra el negocio, un hotel o el email llega como respuesta, nunca como dato de contacto', () => {
  const q = {
    ...QUIZ, pideTelefono: false,
    preguntas: [
      { texto: '¿Cuánto factura tu negocio al mes?', opciones: [{ texto: 'Menos de 5 mil', puntos: 0 }, { texto: 'Más de 5 mil', puntos: 2 }] },
      { texto: '¿Tienes hotel o casa de huéspedes?', opciones: [{ texto: 'Hotel', puntos: 1 }, { texto: 'Casa', puntos: 0 }] },
      { texto: '¿Usas email marketing?', opciones: [{ texto: 'Sí', puntos: 2 }, { texto: 'No', puntos: 0 }] },
    ],
  };
  const o = optinDelPixel(html([quiz(q)]), [1, 0, 0]);
  assert.ok(o, 'el Pixel no mandó el opt-in del quiz');
  assert.ok(!o!.empresa, `la respuesta llegó como la empresa del lead: ${String(o!.empresa)}`);
  assert.ok(!o!.telefono, `la respuesta llegó como su teléfono: ${String(o!.telefono)}`);
  assert.equal(o!.email, 'ana@example.com');
  const r = o!.respuestas as Record<string, string>;
  assert.equal(r['1. ¿Cuánto factura tu negocio al mes?'], 'Más de 5 mil');
  assert.equal(r['2. ¿Tienes hotel o casa de huéspedes?'], 'Hotel');
  assert.equal(r['3. ¿Usas email marketing?'], 'Sí');
});

test('la IA no lo toca: viaja cerrado y vuelve igual', () => {
  const tarjeta = pagina([quiz()]).doc.content![0];
  const bloques = tarjetaABloques(tarjeta);
  assert.ok(bloques.bloques.some((b) => b.t === 'conservar' && b.que === 'quiz'), 'el quiz no viaja como «conservar»');
  const vuelta = bloquesATarjeta(bloques, { base: tarjeta });
  const q = (vuelta.content ?? []).find((n) => n.type === NODO.quiz);
  assert.deepEqual(q?.attrs, tarjeta.content![1].attrs);
});

test('la API: valida lo que se pasa y no deja un quiz que no sale', () => {
  const c: LandingContenido = { v: 1, paginas: [pagina([])] };
  const falta = planQuiz(c, { seccion: 'tA', titulo: 'Mi quiz' });
  assert.ok('error' in falta && /Falta una pregunta/.test(falta.error));
  const malo = planQuiz(c, { seccion: 'tA', preguntas: [{ texto: '¿Uno?', opciones: [{ texto: 'Sí' }] }], resultados: [{ titulo: 'A' }] });
  assert.ok('error' in malo && /de 2 a 6 opciones/.test(malo.error));
  const link = planQuiz(c, { seccion: 'tA', preguntas: QUIZ.preguntas, resultados: [{ titulo: 'A', href: 'javascript:alert(1)' }] });
  assert.ok('error' in link && /no es válido/.test(link.error));
  const ok = planQuiz(c, { seccion: 'tA', titulo: 'Mi quiz', preguntas: QUIZ.preguntas, resultados: QUIZ.resultados });
  assert.ok('contenido' in ok, 'error' in ok ? ok.error : '');
  if (!('contenido' in ok)) return;
  assert.match(ok.resumen, /3 preguntas, 3 resultados, puntaje de 0 a 6/);
  // Cambiar sólo el título conserva preguntas y resultados; repetir lo mismo es «ya está así».
  const otra = planQuiz(ok.contenido, { seccion: 'tA', titulo: 'Otro' });
  assert.ok('contenido' in otra);
  const igual = planQuiz(ok.contenido, { seccion: 'tA', titulo: 'Mi quiz' });
  assert.ok('error' in igual && igual.yaEstaba);
});
