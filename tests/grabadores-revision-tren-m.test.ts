// =============================================================================
// Grabadores: lo que encontró la revisión del tren m (26/10/2026, hallazgos 9 a 14 sobre ad1d2ccf8)
// =============================================================================
//   9. La MISMA reunión grabada por dos grabadores (Fathom + tl;dv) tenía dos claves: se analizaba, se enganchaba y
//      disparaba eventos dos veces. Ahora se reconoce (`esLaMismaReunion`) y se procesa UNA copia (`leTocaA`).
//  10. Un fallo de la clave de la PLATAFORMA se le avisaba al negocio como suyo: sólo `deSuClave` es «de su cuenta» (el
//      caso real, con el harness: tests/closing-su-claude.test.ts → 6).
//  11. Sin la migración 0338, Customer Success quemaba los 3 intentos de cada sesión de otro grabador: ahora espera.
//  12. Con tl;dv o Fireflies un no-show quedaba «asistió»: un «no se sabe» es «asistió» sólo con Fathom.
//  13. tl;dv avisa antes de tener la transcripción: no se paga un análisis vacío y el seguimiento espera la transcripción.
//  14. El incidente `closing_ia_caida` podía quedar abierto después de recargar: «Re-analizar» lo cierra y una vuelta
//      sin llamadas que lo prueben hace una prueba mínima con SU clave.
// Probado rompiéndolo (26/10/2026): ver el pie.
// Correr: node --import tsx --test tests/grabadores-revision-tren-m.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  anotaLaAsistencia, claveDeReunion, claveDeReunionDelLead, esLaMismaReunion, gemelasDe, leTocaA, mapaDeGemelas,
  type GrabadorId, type Reunion,
} from '../lib/grabadores/reunion';
import { conEspera, leerEsperas, vigentes, VIDA_ESPERA_MS, type EsperaSeguimiento } from '../lib/grabadores/seguimiento-pendiente-reglas';
import { resultadoDeLaPrueba } from '../lib/closing-ia-caida-reglas';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, desde: string, hasta: string) => src.slice(src.indexOf(desde), src.indexOf(hasta, src.indexOf(desde)));

function reunion(grabador: GrabadorId, id: string, p: Partial<Reunion> = {}): Reunion {
  return {
    grabador, id, clave: claveDeReunion(grabador, grabador === 'fathom' ? Number(id) : id),
    titulo: 'R1 con Juan', inicio: '2026-10-26T15:00:00Z', fin: '2026-10-26T15:40:00Z', programada: null, aparecio: null,
    invitados: [{ nombre: 'Juan', email: 'juan@gmail.com', externo: true }, { nombre: 'Closer', email: 'closer@mako.com', externo: false }],
    anfitrion: { nombre: 'Closer', email: 'closer@mako.com' }, link: `https://${grabador}.test/${id}`, linkCompartido: null,
    ...p,
  };
}

test('12. un «no se sabe» es «asistió» SÓLO con Fathom; una certeza se anota con cualquiera', () => {
  assert.equal(anotaLaAsistencia('fathom', null), true, 'Fathom: como siempre (atribuye voces)');
  for (const g of ['tldv', 'fireflies', 'zoom', 'otter'] as const) {
    assert.equal(anotaLaAsistencia(g, null), false, `${g}: un no-show quedaba «asistió»`);
    assert.equal(anotaLaAsistencia(g, true), true);
    assert.equal(anotaLaAsistencia(g, false), true);
  }
  const A = sinComentarios(leer('../lib/grabadores/al-terminar.ts'));
  assert.match(A, /applyFathomRecording\(lead, which, link, attended, \{ marcarAsistencia: anotaLaAsistencia\(r\.grabador, attended\) \}\)/);
});

test('9. la MISMA reunión de dos grabadores se reconoce; dos reuniones distintas, no', () => {
  const fathom = reunion('fathom', '501');
  const tldv = reunion('tldv', 'abc', { inicio: '2026-10-26T15:04:00Z', titulo: 'Llamada', invitados: [{ nombre: null, email: 'Juan@Gmail.com', externo: true }] });
  assert.equal(esLaMismaReunion(fathom, tldv), true, 'mismo invitado, 4 minutos de diferencia');
  assert.equal(esLaMismaReunion(tldv, fathom), true, 'y al revés');
  assert.equal(esLaMismaReunion(fathom, reunion('fathom', '502')), false, 'del mismo grabador nunca: su id la identifica');
  assert.equal(esLaMismaReunion(fathom, { ...tldv, inicio: '2026-10-26T15:30:00Z' }), false, '30 minutos después es otra');
  assert.equal(esLaMismaReunion(fathom, { ...tldv, inicio: null, programada: null }), false, 'sin hora no se afirma nada');
  // Comparten SÓLO al anfitrión: dos reuniones seguidas del mismo closer no son la misma.
  const otra = reunion('tldv', 'def', { titulo: 'Otra cosa', invitados: [{ nombre: null, email: 'closer@mako.com', externo: false }, { nombre: null, email: 'ana@x.com', externo: true }] });
  assert.equal(esLaMismaReunion(fathom, otra), false);
  // Una de equipo (Zoom + Fathom): sin correo de afuera, por el título y el anfitrión.
  const equipoF = reunion('fathom', '600', { titulo: 'Weekly de ventas', invitados: [] });
  const equipoZ = reunion('zoom', '9', { titulo: 'Weekly  de Ventas!', invitados: [], anfitrion: { nombre: null, email: 'closer@mako.com' } });
  assert.equal(esLaMismaReunion(equipoF, equipoZ), true);
  assert.equal(esLaMismaReunion(equipoF, { ...equipoZ, anfitrion: { nombre: null, email: 'otro@mako.com' } }), false, 'mismo título, otro anfitrión');
  assert.equal(esLaMismaReunion({ ...equipoF, titulo: 'R1' }, { ...equipoZ, titulo: 'R1' }), false, 'un título de 2 letras no identifica nada');
  // La que empezó tarde: la hora PROGRAMADA de una contra el inicio de la otra.
  assert.equal(esLaMismaReunion({ ...fathom, inicio: '2026-10-26T15:25:00Z', programada: '2026-10-26T15:00:00Z' }, { ...tldv, inicio: '2026-10-26T15:02:00Z' }), true);

  // El índice del barrido encuentra lo mismo que la comparación directa, y con un solo grabador no mira nada.
  const todas = [fathom, tldv, reunion('fathom', '502', { inicio: '2026-10-26T18:00:00Z' }), equipoF, equipoZ];
  const mapa = mapaDeGemelas(todas);
  for (const r of todas) assert.deepEqual((mapa.get(r.clave) ?? []).map((x) => x.clave).sort(), gemelasDe(r, todas).map((x) => x.clave).sort(), r.id);
  assert.equal(mapaDeGemelas([fathom, reunion('fathom', '502')]).size, 0);
});

test('9. se procesa UNA copia: la que ya tiene algo hecho; si ninguna, la de Fathom', () => {
  const fathom = reunion('fathom', '501');
  const tldv = reunion('tldv', 'abc', { inicio: '2026-10-26T15:03:00Z' });
  const nada = () => false;
  assert.equal(leTocaA(fathom, [tldv], nada), true, 'sin nada hecho: Fathom');
  assert.equal(leTocaA(tldv, [fathom], nada), false);
  // tl;dv llegó primero y ya tiene su fila: la de Fathom, que aparece DESPUÉS, no se procesa de nuevo.
  const hechaTldv = (x: Reunion) => x.clave === tldv.clave;
  assert.equal(leTocaA(tldv, [fathom], hechaTldv), true);
  assert.equal(leTocaA(fathom, [tldv], hechaTldv), false);
  assert.equal(leTocaA(tldv, [], nada), true, 'sin gemelas, siempre');
  // La clave del dedup del evento y del aviso es del lead y la reunión, no del grabador.
  assert.equal(claveDeReunionDelLead(7, 'j1', '2026-10-26'), claveDeReunionDelLead(7, 'j1', '2026-10-26'));
  assert.notEqual(claveDeReunionDelLead(7, 'j1', '2026-10-26'), claveDeReunionDelLead(7, 'j2', '2026-10-26'));

  // El cableado: el evento y el aviso con esa clave; el Closing (barrido y por lead) y el Plan preguntan `leTocaA`.
  const A = sinComentarios(leer('../lib/grabadores/al-terminar.ts'));
  assert.match(A, /const claveReunion = claveDeReunionDelLead\(lead\.id, which, fecha\);/);
  assert.match(A, /dispararEvento\('reunion\.ocurrio', \{ ws, leadId: lead\.id, leadNombre: nombre, reunion, dedupKey: claveReunion \}\)/);
  assert.match(A, /emitirDelCatalogo\('reunion-ocurrio-fathom', \{[^}]*\}[^}]*\}\), dedupKey: claveReunion, dedupTtlMin: 180 \}\)/);
  const C = sinComentarios(leer('../lib/closing.ts'));
  const triage = bloque(C, '  for (const m of meetings) {', 'candidatas.push(m);');
  // El needle de `preClassify` no lleva el paréntesis de cierre a propósito: lo que se chequea
  // acá es el ORDEN, y la firma ya creció una vez (`marcadores`, 06/11/2026).
  assert.ok(triage.indexOf('leTocaA(m, gemelas.get(m.clave)') > 0 && triage.indexOf('leTocaA(m, gemelas.get(m.clave)') < triage.indexOf('preClassify(m, internos'),
    'el barrido pregunta por la gemela ANTES de escribir la fila de la heurística (la de Customer Success también)');
  assert.match(C, /const conFila = new Set\(doneData\.map\(\(r\) => r\.recording_id\)\);/);
  assert.match(bloque(C, 'export async function analizarLlamadasDeLead(', '\n}\n'), /if \(!leTocaA\(meta, gemelasDe\(meta, meetings\), \(x\) => doneByRec\.has\(x\.clave\)\)\) \{ yaEstaban\+\+; continue; \}/);
  const P = sinComentarios(leer('../lib/reunion-auto.ts'));
  const iGem = P.indexOf('if (!leTocaA(r.reunion, susGemelas, (x) => vistas.has(x.clave)))');
  assert.ok(iGem > 0 && iGem < P.indexOf('tomarLectura('), 'el Plan pregunta por la gemela ANTES del candado de la lectura');
  assert.match(P, /if \(p !== null \|\| await getSetting\(KEY_VISTA\(g\.clave\)\)\.catch\(\(\) => 'error'\)\) vistas\.add\(g\.clave\);/);
});

test('10. sólo el error de SU clave es «de su cuenta» (la de la plataforma y el crédito de MaKo, no)', () => {
  const C = sinComentarios(leer('../lib/closing.ts'));
  assert.match(C, /if \(suya\) return \{ ok: false, error: `Tu clave de Claude no pudo analizar la llamada: \$\{suya\.error\}`, \.\.\.\('esCredito' in suya && suya\.esCredito \? \{\} : \{ deSuClave: true as const \}\) \};/);
  assert.equal((C.match(/deSuClave: true/g) ?? []).length, 1, 'la marca la pone UN lugar: el error de su clave');
  assert.match(C, /const suCuenta = res\.deSuClave \? falloDeSuCuenta\(res\.error\) : null;/);
  assert.match(C, /else if \(res\.deSuClave && falloDeSuCuenta\(res\.error\)\) \{/);
  // 11/11/2026: la puerta 2 también paga con una cuenta del CRÉDITO de MaKo (`cuentaDelCredito`: la IA interna va primero con
  // el crédito de las cuentas Max). Ese error tampoco es «de su cuenta»: se marca `esCredito`, igual que el crédito asignado.
  assert.match(sinComentarios(leer('../lib/anthropic.ts')), /return permiso\.esCredito \|\| permiso\.cuentaDelCredito \? \{ error, esCredito: true, status: res\.status \} : \{ error, status: res\.status \};/);
});

test('11. sin la 0338 (o con la base caída) Customer Success no gasta intentos: espera, o corta sin culpar a la sesión', () => {
  const E = sinComentarios(leer('../lib/closing-entrega.ts'));
  const una = bloque(E, 'async function analizarUna(', 'const grabador = nombreDeGrabador(ref.grabador);');
  assert.match(una, /catch \(e\) \{ return fallar\(f, `no pude leer de qué grabador es: \$\{msgDe\(e\)\}`, 'proveedor', true\); \}/);
  assert.match(una, /if \(!ref\) return \{ desenlace: 'espera', atada: false, iaContesto: false \};/);
  assert.doesNotMatch(una, /'sesion'/, 'no saber de qué grabador es no es culpa de la sesión');
  assert.match(E, /if \(desenlace === 'espera'\) \{ tomadas--; r\.esperan = \(r\.esperan \?\? 0\) \+ 1; continue; \}/);
  // Y la migración ya no promete algo falso sobre el orden.
  assert.match(leer('../supabase/migrations/0338_reuniones_de_cualquier_grabador.sql'), /Customer Success deja ESPERANDO esas\n-- sesiones sin gastarles intentos/);
});

test('13. sin transcripción no se paga un análisis vacío, y el seguimiento la espera', () => {
  const C = sinComentarios(leer('../lib/closing.ts'));
  const porLead = bloque(C, 'export async function analizarLlamadasDeLead(', '\n}\n');
  const iEspera = porLead.indexOf('if (e instanceof GrabadorSinRespuestaError) { esperan++; continue; }');
  assert.ok(iEspera > 0 && iEspera < porLead.indexOf('await analyzeMeeting(m, lead)'), 'el análisis vacío se pagaba igual');
  const A = sinComentarios(leer('../lib/grabadores/al-terminar.ts'));
  assert.match(A, /if \(attended !== false && opts\.transcripcionPendiente\) \{\s*await anotarEsperaDeSeguimiento\(/);
  assert.match(A, /r = await leerFicha\(ref\);\s*transcripcionPendiente = true;/);
  assert.match(A, /alTerminarReunion\(ws, r, \{ hasta: opts\.hasta, log, yaEnSegundoPlano: true, transcripcionPendiente \}\)/);
  assert.match(sinComentarios(leer('../app/api/cron/closing-sync/route.ts')), /const seguimiento = caida \? null : await seguimientosQueEsperaban\(\{ deadline, reservaMs: RESERVA_LLAMADA_MS \}\);/);

  // La lista: una reunión una vez (un aviso reentregado no duplica), y de más de 48 h se suelta.
  const ahora = Date.parse('2026-10-26T20:00:00Z');
  const e = (ref: string, horas: number): EsperaSeguimiento => ({ ref, leadId: 7, link: null, reunion: 'R1', desde: new Date(ahora - horas * 3600_000).toISOString() });
  const lista = conEspera(conEspera([], e('tldv:a', 1)), e('tldv:a', 0));
  assert.equal(lista.length, 1);
  assert.deepEqual(vigentes([e('tldv:a', 1), e('tldv:b', 49)], ahora).map((x) => x.ref), ['tldv:a']);
  assert.equal(VIDA_ESPERA_MS, 48 * 3600_000);
  assert.deepEqual(leerEsperas(JSON.stringify([e('tldv:a', 1), { ref: 'x', leadId: 'no' }, e('sin-dos-puntos', 1)])).map((x) => x.ref), ['tldv:a']);
  assert.deepEqual(leerEsperas('{roto'), []);
});

test('13. la espera por la transcripción deja lugar a lo de después', async () => {
  const { entraOtraEspera, INTENTOS_TRANSCRIPCION } = await import('../lib/grabadores/al-terminar').catch(() => ({ entraOtraEspera: null, INTENTOS_TRANSCRIPCION: 0 }));
  // `al-terminar` es de servidor: si no se puede importar acá, se mide su texto.
  if (!entraOtraEspera) {
    const A = leer('../lib/grabadores/al-terminar.ts');
    assert.match(A, /intento < INTENTOS_TRANSCRIPCION && ahora \+ ESPERA_TRANSCRIPCION_MS \+ RESERVA_DESPUES_MS <= hasta;/);
    return;
  }
  const t0 = 1_000_000;
  assert.equal(entraOtraEspera(1, t0 + 280_000, t0), true);
  assert.equal(entraOtraEspera(1, t0 + 170_000, t0), false, 'sin lugar para el análisis del seguimiento, no se espera');
  assert.equal(entraOtraEspera(INTENTOS_TRANSCRIPCION, t0 + 10_000_000, t0), false, 'y hay un tope de intentos');
});

test('14. el incidente se cierra: «Re-analizar» que sale, o una prueba mínima cuando nadie lo probó', () => {
  assert.equal(resultadoDeLaPrueba({ texto: 'OK' }), 'volvio');
  assert.equal(resultadoDeLaPrueba({ error: 'Claude contestó vacío' }), 'volvio', 'contestó: la cuenta anda');
  assert.equal(resultadoDeLaPrueba({ error: 'Your credit balance is too low to access the Anthropic API.' }), 'sigue');
  assert.equal(resultadoDeLaPrueba({ error: 'Your credit balance is too low', esCredito: true }), 'no-se', 'el crédito de MaKo no dice nada de su cuenta');
  assert.equal(resultadoDeLaPrueba({ error: 'Overloaded' }), 'no-se');
  assert.equal(resultadoDeLaPrueba(null), 'no-se', 'sin su clave no hay qué probar');
  const C = sinComentarios(leer('../lib/closing.ts'));
  assert.match(bloque(C, 'export async function analyzeOne(', '\n}\n'), /if \(r\.status !== 'error'\) await anotarQueVolvio\(\);\s*return r\.status;/);
  assert.match(C, /if \(caida && result\.corto_por !== 'ia_del_negocio' && entraOtraLlamada\(\)\) result\.prueba_ia = await probarSiVolvio\(\);/);
  const I = sinComentarios(leer('../lib/closing-ia-caida.ts'));
  assert.match(I, /maxTokens: 1, feature: 'closing'/, 'la prueba es mínima y con SU clave (count_tokens no mira el crédito)');
  assert.match(I, /if \(v === 'volvio'\) await anotarQueVolvio\(\)/);
});

// Probado rompiéndolo (26/10/2026), cada rotura sola y restaurada después — 8/0 de nuevo al final. Todas dieron 1 fallo:
//   12 · null = «asistió» con cualquier grabador · INVERTIDA («o» por «y») · el webhook sin la regla
//    9 · del mismo grabador también · ventana de una hora · el anfitrión como invitado compartido · `leTocaA` sin mirar
//        lo ya hecho · INVERTIDA (le toca a la otra) · el evento sin dedup · el barrido del Closing sin gemelas · el Plan
//        sin la marca de vista
//   10 · processCandidate sin la marca · (en tests/closing-su-claude.test.ts → 6) el crédito de MaKo como suyo, y
//        anthropic sin decir que era el crédito
//   11 · sin la 0338 gasta intentos · la base caída culpa a la sesión
//   13 · paga el análisis sin transcripción · la ficha sin marcar que falta · un aviso reentregado duplica la espera ·
//        INVERTIDA (se quedan las vencidas)
//   14 · «Re-analizar» no cierra · el crédito de MaKo dice «sigue» · INVERTIDA (la prueba al revés)
