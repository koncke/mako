// =============================================================================
// «Clips mágicos» del Video Editor (pedido de Leila, 30/10/2026; tanda 3 de nube-video-clips)
// =============================================================================
// Lo que fija este archivo, corriendo el código:
//   1. LOS CANDIDATOS (lib/editor-video/clips.ts): de 15 a 60 s, arrancan y terminan en un corte natural, y su puntaje
//      (gancho, valor, ritmo, cierre, como el 0–99 de OpusClip) premia un arranque con gancho sobre un saludo.
//   2. LA ELECCIÓN: nunca dos clips que se pisen más de la mitad (la regla de SamurAIGPT), los de más puntaje, hasta
//      «cuántos», en el orden del video; y sin IA, el respaldo por las reglas.
//   3. PARA LA IA: los pedazos de 20 minutos con un minuto de solape, la transcripción numerada, y lo que devuelve un
//      modelo validado con CASOS DE EJEMPLO (números fuera del pedazo, al revés, muy corto, muy largo, sin título).
//   4. ABRIR: el corte con aire, el principal llenando el cuadro vertical, y el cableado (la copia, el original intacto,
//      la ruta adentro de «sólo su IA», el chat y la API, los prompts editables).
//
// PROBADO ROMPIÉNDOLO: al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  bloquesParaIA,
  candidatosDeClips,
  clipsDeIA,
  clipsDeRespaldo,
  cuantosClips,
  elegirSinSolape,
  frasesDeClips,
  puntajeDeClip,
  solape,
  tramoDeCorte,
  transcripcionParaIA,
  TOPES_CLIPS,
  type Frase,
} from '../lib/editor-video/clips';
import { CLIPS_SYSTEM_TEMPLATE, CLIPS_USER_TEMPLATE, PROMPTS_CLIPS } from '../lib/editor-video/clips-prompts';
import { principalCubriendo } from '../app/video-editor/_opencut/clips/cubrir';
import { validarOperacion } from '../lib/editor-video/chat-catalogo';
import { OPERACIONES_API } from '../lib/editor-video/chat-api';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Una clase ficticia de ~90 s sobre conseguir clientes: un saludo, un tramo bueno, relleno, otro tramo bueno, despedida.
const TEXTOS = [
  'Bienvenidos a esta clase sobre cómo conseguir clientes.', 'Hoy vamos a hablar de varias cosas.', 'Primero, un poco de contexto.',
  '¿Sabías que el 70% de los negocios no tiene un proceso de ventas?', 'Por eso pierden clientes todos los días.', 'Y no es por falta de interés.',
  'Es porque nadie les responde a tiempo.', 'Un cliente que espera más de una hora se va con otro.', 'Eso lo medimos con más de cien negocios.',
  'Bueno, sigamos.', 'Ahora vamos a ver la pantalla.', 'Acá tienen el tablero.', 'Esto lo vamos a usar después.', 'Pasemos a otra cosa.',
  'El error más común es cobrar barato.', 'Si cobras barato, atraes clientes que no valoran tu trabajo.', 'Y terminas trabajando el doble por la mitad.',
  'La solución es subir el precio y mejorar la oferta.', 'Un cliente que paga más se compromete más.', 'Así de simple.',
  'Bueno, eso es todo por hoy.', 'Nos vemos en la próxima clase.',
];
const CLASE: Frase[] = TEXTOS.map((texto, i) => ({ texto, inicio: i * 4.2, fin: i * 4.2 + 3.9 }));

// ── 1. Los candidatos ────────────────────────────────────────────────────────

test('1. los candidatos: de 15 a 60 s, de corte natural a corte natural, con puntaje de 0 a 99', () => {
  const c = candidatosDeClips(CLASE);
  assert.ok(c.length > 10, `${c.length} candidatos`);
  for (const x of c) {
    const d = x.fin - x.inicio;
    assert.ok(d >= TOPES_CLIPS.minSeg && d <= TOPES_CLIPS.maxSeg, `uno de ${d} s`);
    assert.ok(x.desde === 0 || /[.!?…]$/.test(CLASE[x.desde - 1].texto), `arranca a mitad de una idea (${x.desde})`);
    assert.ok(/[.!?…]$/.test(CLASE[x.hasta].texto), `termina a mitad de una idea (${x.hasta})`);
    assert.ok(x.puntaje >= 0 && x.puntaje <= 99);
  }
  assert.deepEqual(candidatosDeClips([]), []);
});

test('1c. un clip no arranca ni termina a mitad de una idea (sin punto y sin pausa)', () => {
  // Whisper parte una idea larga en renglones sin punto: «Y lo que pasa es que» + «la gente no compra».
  const partidas: Frase[] = [];
  for (let i = 0; i < 24; i++) {
    const cierra = i % 3 === 2;
    partidas.push({ texto: cierra ? `y por eso compra ${i}.` : `lo que pasa es que ${i}`, inicio: i * 3, fin: i * 3 + 2.9 });
  }
  const c = candidatosDeClips(partidas);
  assert.ok(c.length > 0);
  for (const x of c) {
    assert.ok(x.desde === 0 || /\.$/.test(partidas[x.desde - 1].texto), `arranca a mitad de una idea (${x.desde})`);
    assert.match(partidas[x.hasta].texto, /\.$/, `termina a mitad de una idea (${x.hasta})`);
  }
  // Con una pausa larga antes, sí se puede arrancar aunque no haya punto.
  const conPausa = partidas.map((f, i) => (i >= 4 ? { ...f, inicio: f.inicio + 1, fin: f.fin + 1 } : f));
  assert.ok(candidatosDeClips(conPausa).some((x) => x.desde === 4), 'una pausa de 1 s es un corte natural');
});

test('1b. el gancho: una pregunta o un dato arrancando pesa más que un saludo', () => {
  const pregunta = puntajeDeClip(CLASE, 3, 7);
  const saludo = puntajeDeClip(CLASE, 0, 4);
  assert.equal(pregunta.partes.gancho, 30);
  assert.ok(saludo.partes.gancho < pregunta.partes.gancho);
  assert.ok(pregunta.puntaje > saludo.puntaje);
  const error = puntajeDeClip(CLASE, 14, 18);
  assert.equal(error.partes.gancho, 30, '«El error más común…» es un arranque de gancho');
  assert.equal(error.partes.cierre, 19, 'termina en una idea y dura lo que mejor anda');
});

// ── 2. La elección ───────────────────────────────────────────────────────────

test('2. sin pisarse más de la mitad, los de más puntaje, hasta «cuántos», en el orden del video', () => {
  const elegidos = elegirSinSolape(candidatosDeClips(CLASE), 3);
  assert.ok(elegidos.length >= 2 && elegidos.length <= 3);
  for (let a = 0; a < elegidos.length; a++) {
    for (let b = a + 1; b < elegidos.length; b++) assert.ok(solape(elegidos[a], elegidos[b]) <= TOPES_CLIPS.solapeMax, `${a} y ${b} se pisan`);
    if (a) assert.ok(elegidos[a].inicio > elegidos[a - 1].inicio, 'en el orden del video');
  }
  const mejor = [...candidatosDeClips(CLASE)].sort((x, y) => y.puntaje - x.puntaje)[0];
  assert.ok(elegidos.some((e) => e.desde === mejor.desde && e.hasta === mejor.hasta), 'el mejor de todos está');
  assert.equal(solape({ inicio: 0, fin: 10 }, { inicio: 20, fin: 30 }), 0);
  assert.equal(solape({ inicio: 0, fin: 10 }, { inicio: 5, fin: 40 }), 0.5);
});

test('2b. sin IA: los mejores por las reglas, titulados con su primera frase', () => {
  const r = clipsDeRespaldo(CLASE, 2);
  assert.equal(r.length, 2);
  for (const c of r) {
    assert.equal(c.deIA, false);
    assert.equal(c.primera, CLASE[c.desde].texto);
    assert.ok(c.titulo && c.titulo.length <= TOPES_CLIPS.titulo);
  }
  assert.equal(cuantosClips(undefined), TOPES_CLIPS.porDefecto);
  assert.equal(cuantosClips(99), TOPES_CLIPS.maxClips);
  assert.equal(cuantosClips(0), 1);
  assert.equal(cuantosClips(2.5), TOPES_CLIPS.porDefecto);
});

// ── 3. Para la IA ────────────────────────────────────────────────────────────

test('3. los pedazos: uno si es corto; de 20 min con un minuto de solape si es largo; hasta seis', () => {
  assert.deepEqual(bloquesParaIA(CLASE), [{ desde: 0, hasta: CLASE.length - 1 }]);
  const larga: Frase[] = Array.from({ length: 1440 }, (_, i) => ({ texto: `Frase ${i}.`, inicio: i * 5, fin: i * 5 + 4.5 }));
  const b = bloquesParaIA(larga);
  assert.equal(b.length, TOPES_CLIPS.maxBloques);
  assert.equal(b[0].desde, 0);
  for (let i = 0; i < b.length; i++) {
    assert.ok(larga[b[i].hasta].fin - larga[b[i].desde].inicio <= TOPES_CLIPS.bloqueSeg + 1e-9, `el pedazo ${i} pasa de 20 min`);
    if (i) {
      const solapado = larga[b[i - 1].hasta].fin - larga[b[i].desde].inicio;
      assert.ok(solapado >= 50 && solapado <= 65, `el pedazo ${i} se solapa ${solapado} s con el anterior`);
    }
  }
});

test('3b. la transcripción para la IA: una frase por renglón, con su número y su minuto', () => {
  const t = transcripcionParaIA(CLASE, { desde: 2, hasta: 3 });
  assert.equal(t, '[2] 0:08 Primero, un poco de contexto.\n[3] 0:12 ¿Sabías que el 70% de los negocios no tiene un proceso de ventas?');
});

test('3c. lo que devuelve un modelo: lo bueno pasa; lo inventado o imposible se descarta con su motivo', () => {
  const bloque = { desde: 0, hasta: CLASE.length - 1 };
  const r = clipsDeIA(CLASE, {
    clips: [
      { desde: 3, hasta: 8, titulo: 'Por qué pierdes clientes', puntaje: 88, motivo: 'Un dato y una consecuencia.' },
      { desde: '14', hasta: '18', titulo: '  El error de cobrar barato ', puntaje: 140 }, // texto y un puntaje imposible
      { desde: 0, hasta: 1, titulo: 'Muy corto' }, // 8 s
      { desde: 0, hasta: 21, titulo: 'Muy largo' }, // 92 s
      { desde: 30, hasta: 31, titulo: 'Fuera del pedazo' },
      { desde: 8, hasta: 3, titulo: 'Al revés' },
      { desde: 3, hasta: 8, titulo: '' }, // sin título
    ],
  }, bloque);
  assert.deepEqual(r.clips.map((c) => [c.desde, c.hasta, c.titulo]), [[3, 8, 'Por qué pierdes clientes'], [14, 18, 'El error de cobrar barato']]);
  assert.equal(r.clips[0].puntaje, 88);
  assert.equal(r.clips[1].puntaje, puntajeDeClip(CLASE, 14, 18).puntaje, 'un puntaje imposible lo reemplazan las reglas');
  assert.ok(r.clips.every((c) => c.deIA && c.inicio === CLASE[c.desde].inicio && c.fin === CLASE[c.hasta].fin), 'los tiempos los pone el código');
  assert.equal(r.descartes.length, 5, r.descartes.join(' · '));
  const enOtroPedazo = clipsDeIA(CLASE, { clips: [{ desde: 3, hasta: 8, titulo: 'x' }] }, { desde: 10, hasta: 21 });
  assert.deepEqual(enOtroPedazo.clips, [], 'un número de otro pedazo no vale');
  for (const crudo of [null, {}, { clips: 'no' }]) assert.deepEqual(clipsDeIA(CLASE, crudo, bloque).clips, []);
});

test('3d. las frases que llegan del navegador se sanean: sin texto, sin tiempos o al revés se tiran; se ordenan', () => {
  const f = frasesDeClips([
    { texto: 'B', inicio: 5, fin: 6 }, { texto: ' A  a ', inicio: 1, fin: 2 }, { texto: '', inicio: 3, fin: 4 },
    { texto: 'x', inicio: 4, fin: 3 }, { texto: 'y', inicio: Number.NaN, fin: 1 },
  ]);
  assert.deepEqual(f, [{ texto: 'A a', inicio: 1, fin: 2 }, { texto: 'B', inicio: 5, fin: 6 }]);
});

// ── 4. Abrir ─────────────────────────────────────────────────────────────────

test('4. el corte deja aire y no se sale del video', () => {
  assert.deepEqual(tramoDeCorte({ inicio: 10, fin: 30 }, 100), { inicio: 10 - TOPES_CLIPS.margenSeg, fin: 30 + TOPES_CLIPS.margenSeg });
  assert.deepEqual(tramoDeCorte({ inicio: 0.05, fin: 99.95 }, 100), { inicio: 0, fin: 100 });
});

test('4b. el principal llena el cuadro vertical; lo que no tiene tamaño se queda como está', () => {
  const el = (id: string, mediaId: string, type = 'video') => ({ id, type, mediaId, name: id, startTime: 0, duration: 1, trimStart: 0, trimEnd: 0, params: { opacity: 1 } });
  const tracks = { main: { id: 'm', name: 'Main', type: 'video', elements: [el('a', 'horizontal'), el('b', 'sin-tamano')], muted: false, hidden: false }, overlay: [], audio: [] };
  const lienzo = { width: 1080, height: 1920 };
  const r = principalCubriendo(tracks as never, lienzo, (id) => (id === 'horizontal' ? { width: 1920, height: 1080 } : null)) as unknown as typeof tracks;
  const a = r.main.elements[0].params as Record<string, unknown>;
  // Un 16:9 en un 9:16 pierde los costados: el recorte (no la escala) es lo que llena el cuadro.
  const costados = Object.entries(a).filter(([k, v]) => /izquierda|derecha|left|right/i.test(k) && typeof v === 'number');
  assert.equal(costados.length, 2, `no se recortan los costados: ${JSON.stringify(a)}`);
  for (const [k, v] of costados) assert.ok((v as number) > 0.3 && (v as number) < 0.4, `${k} = ${v}`);
  assert.equal(a['transform.positionX'], 0, 'centrado');
  assert.equal(a.opacity, 1, 'lo demás queda');
  assert.deepEqual(r.main.elements[1].params, { opacity: 1 });
  const sinNada = principalCubriendo(tracks as never, lienzo, () => null);
  assert.equal(sinNada, tracks, 'sin nada que cubrir, la escena es la misma');
});

test('4c. abrir: copia el proyecto, el original no se toca, y si falla se borra la copia y vuelve el original', () => {
  const abrir = sinComentarios(leer('app/video-editor/_opencut/clips/abrir.ts'));
  assert.match(abrir, /editor\.project\.duplicateProjects\(\{ ids: \[original\] \}\)/);
  assert.match(abrir, /await editor\.project\.loadProject\(\{ id: copia \}\)/);
  assert.ok(abrir.indexOf('duplicateProjects(') < abrir.indexOf('loadProject({ id: copia })') && abrir.indexOf('loadProject({ id: copia })') < abrir.indexOf('cortarTramosEnEditor(editor'), 'se corta en la COPIA, después de copiarla y abrirla');
  assert.match(abrir, /deleteProjects\(\{ ids: \[copia\] \}\)[\s\S]*?loadProject\(\{ id: original \}\)/);
  assert.match(abrir, /relacion: "9:16"/);
  assert.match(abrir, /generarSubtitulos\(editor\)/);
  assert.match(abrir, /editor\.command\.clear\(\)/);
});

test('4d. el cableado: el registro, la ruta adentro de «sólo su IA», el chat y la API, y los prompts', () => {
  assert.match(leer('app/video-editor/ce/extensiones.ts'), /^import '\.\.\/_opencut\/clips\/registro';$/m);
  const ruta = sinComentarios(leer('app/api/video-editor/clips/route.ts'));
  assert.match(ruta, /conSuIADelNegocio\(p\.ws, \(\) => elegirClips\(frases, cuantosClips\(body\.cuantos\)\)\)/);
  assert.match(ruta, /frasesDeClips\(lista\.map/, 'la ruta vuelve a sanear lo que manda el navegador');
  assert.deepEqual(validarOperacion({ op: 'clips_magicos' }), { ok: true, op: { op: 'clips_magicos' } });
  assert.deepEqual(validarOperacion({ op: 'clips_magicos', cuantos: 3 }), { ok: true, op: { op: 'clips_magicos', cuantos: 3 } });
  assert.equal(validarOperacion({ op: 'clips_magicos', cuantos: 50 }).ok, false);
  assert.equal(validarOperacion({ op: 'clips_magicos', desde: 3 }).ok, false, 'el chat no elige los momentos');
  assert.equal(OPERACIONES_API.find((o) => o.op === 'clips_magicos')?.id, 'buscar_clips_video');
  // «Va al final» es la regla de AGENTS.md, no una foto: una operación nueva de después (editar_video_automatico, 9/11/2026)
  // no la rompe. Lo que cuida: clips_magicos va DETRÁS de las que ya estaban cuando entró.
  const posApi = (op: string) => OPERACIONES_API.findIndex((o) => o.op === op);
  assert.ok(posApi('clips_magicos') > posApi('broll') && posApi('broll') >= 0, 'una operación nueva va detrás de las que ya estaban');
  assert.match(sinComentarios(leer('app/video-editor/_opencut/chat/aplicar.ts')), /if \(r\.op === "clips_magicos"\) \{[\s\S]*?buscarClips\(editor, \{ cuantos: r\.cuantos \}\)[\s\S]*?textoDeClips\(hecho\)/);
  const slots = (t: string) => [...t.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
  assert.deepEqual(slots(CLIPS_SYSTEM_TEMPLATE), ['cuantos', 'formato']);
  assert.deepEqual(slots(CLIPS_USER_TEMPLATE), ['negocio', 'rango', 'transcripcion']);
  const registro = leer('lib/prompt-registry.ts');
  assert.ok(registro.includes(`key: '${PROMPTS_CLIPS.system.key}'`) && registro.includes(`key: '${PROMPTS_CLIPS.user.key}'`));
  const ia = sinComentarios(leer('lib/editor-video/clips-ia.ts'));
  assert.match(ia, /transcripcion: contenidoNoConfiable\(/);
  assert.match(leer('lib/model-catalogo.ts'), /feature: 'video-editor-clips'[^\n]*def: GEMINI\(\)/);
});

// PROBADO ROMPIÉNDOLO (06/11/2026, base 13 / 0; una rotura por vez, restaurada de memoria; 18 de 18 en rojo):
//   empieza en cualquier frase → 1c · sin el tope de 60 s → 1 · el gancho sin peso → 1b · sin mirar el solape → 2 ·
//   por orden y no por puntaje → 2 · el respaldo dice que fue la IA → 2b · «cuántos» sin tope → 2b · pedazos sin solape →
//   3 · pedazos sin tope → 3 · la IA fuera de su pedazo → 3c · la IA sin la duración → 3c · un puntaje imposible → 3c ·
//   las frases sin ordenar → 3d · el corte fuera del video → 4 · el principal sin cubrir el 9:16 → 4b · la copia queda si
//   falla → 4c · los clips sin «sólo su IA» → 4d · el chat elige los momentos → 4d.
