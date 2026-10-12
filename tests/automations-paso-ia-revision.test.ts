// =============================================================================
// El AI Step después de la revisión adversarial (novena tanda, 11/10/2026)
// =============================================================================
// La revisión del motor y los datos del AI Step (tests/automations-paso-ia.test.ts) encontró tres defectos
// y dos riesgos, y el implementador dejó tres puertas fuera de sus archivos. Lo que fija cada test:
//
//   1. «Enseñar un caso» sin guía a un AI Step se aceptaba al PROPONER y moría al EJECUTAR
//      (`agregarCasoAlGrafo`, lib/nutricion-grafo-motor.ts): ahora frena en `preparar()`.
//      ⚠️ UNDÉCIMA TANDA: un escenario sin respuesta es «Sólo te avisa» (válido), así que ya no hay nada que frenar:
//      entra ADENTRO del AI Step, como cualquier otro (tests 1 y 2, reescritos).
//   2. Dos casos con el mismo id: el segundo contestaba con la guía del primero (la expansión deriva del id
//      las tarjetas de cada caso). `idsDeCasos` (lib/flujo-grafo.ts) los desempata en `normalizar` y en
//      `expandirPasoIA`.
//   3. «Probar» cortaba la guía en 2000 y el motor no: con un tono largo perdía el FINAL —la respuesta del
//      caso—. El tope es `TOPE_GUIA` (app/api/chat-agent/simulador/route.ts).
//   4. «Eliminar» y «Recuperar» un Mensaje de MaKo NO escriben en la BASE de la plataforma: `oculto` no se
//      hereda y `enabled` sí, así que apagaban (o prendían) el mensaje de todos los clientes (lib/plantillas.ts).
//   5. El script de la novena tanda guarda las tres filas enteras ANTES de escribir (scripts/novena-tanda-ws1.mts).
//   6. El filtro de la lista cuenta lo que manda un AI Step (lib/chatbot-lista-filtro.ts, `enviosDePasos`).
//   7. La ficha que lee MaKo muestra el AI Step (lib/api-mako/areas/chatbot.run.ts, `fichaPasoIA`).
//   8. `PasoSecuenciaDto` declara los campos del AI Step y el lienzo los edita sin castear.
//
// Lo puro se EJECUTA; lo `server-only` (el store de plantillas, la ficha de la API) y el script se fijan en
// el fuente sin comentarios, cada pieza por su bloque.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type PasoGrafo, type CasoRespuesta,
  expandirPasoIA, escenariosDeRespuesta, validarGrafo, normalizar, nodoPorId, idsDeCasos, guiaDeCaso, faltaEnCaso,
  idRespuestaDeCaso, TOPE_GUIA, TOPE_RESPONDER, TOPE_INSTRUCCIONES, juntarPasosIA,
} from '../lib/flujo-grafo';
import { libertadDeCaso } from '../lib/ai-step-libertad';
import { camposDelFlujo, agregarCasoAlGrafo } from '../lib/nutricion-grafo-motor';
import { enviosDePasos } from '../lib/chatbot-lista-filtro';
import type { PasoSecuenciaDto } from '../app/automations/ChatAgentApp';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (p: string): string => sinComentarios(leer(p));
/** El bloque de `desde` hasta `hasta` (su cierre real, no un número de caracteres), con su largo acotado. */
function bloque(src: string, desde: string, hasta: string, tope = 4000): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  const b = src.slice(i, j);
  assert.ok(b.length < tope, `el recorte de «${desde}» mide ${b.length}: está mirando otra cosa`);
  return b;
}

// Un generador determinista: los ids de los tests no dependen del azar.
const rndDe = () => { let k = 0; return () => ((k++ * 7919) % 100_000) / 100_000 + 0.00001; };
const msg = (o: Partial<PasoGrafo> = {}): PasoGrafo => ({ canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: 'hola', template_wa: null, ...o });
const caso = (id: string, o: Partial<CasoRespuesta> = {}): CasoRespuesta => ({ id, titulo: `Caso ${id}`, cuando: `cuando ${id}`, siguiente: null, ...o });
/** Una salida (m1) y un AI Step R con los casos que se le pasen. */
const conIA = (casos: CasoRespuesta[], o: Partial<PasoGrafo> = {}): PasoGrafo[] => [
  msg({ id: 'm1', cuerpo: 'Hola', siguiente: null }),
  { ...msg({ cuerpo: '' }), id: 'R', nodo: 'respuesta', paso_ia: true, casos, si_no: null, ...o },
];

// ── 1. «Enseñar un caso» a un AI Step: frena al proponer, no al ejecutar ───────────

test('UNDÉCIMA: un caso NUEVO sin «cómo responder» entra ADENTRO del AI Step como «Sólo te avisa» (ya no hay «no contesta ni avisa»)', () => {
  const pasos = conIA([caso('A', { titulo: 'Precio', cuando: 'pregunta el precio', responder: 'En la llamada' })], { objetivo: 'Que agende' });
  const r = agregarCasoAlGrafo(pasos, { titulo: 'Horario', cuando: 'pregunta el horario', comoResponder: '   ' }, rndDe());
  assert.ok('pasos' in r, 'se rechazó un escenario que sólo avisa');
  const horario = nodoPorId(r.pasos, 'R')!.casos!.find((c) => c.titulo === 'Horario')!;
  assert.equal(libertadDeCaso(horario), 'avisa');
  // Y se publica: el mismo escenario colgado a mano ya no lo frena Publicar.
  assert.equal(faltaEnCaso(horario), null);
  assert.deepEqual(validarGrafo(normalizar(r.pasos)), []);
});

test('con guía entra; y un caso que YA contesta o avisa se puede re-enseñar sin guía (conserva lo suyo)', () => {
  const pasos = conIA([
    caso('A', { titulo: 'Precio', cuando: 'pregunta el precio', responder: 'En la llamada', sola: true }),
    caso('C', { titulo: 'Se enoja', cuando: 'está molesto', avisar: true }),
  ]);
  const nuevo = agregarCasoAlGrafo(pasos, { titulo: 'Horario', cuando: 'pregunta el horario', comoResponder: 'De 9 a 18' }, rndDe());
  assert.ok('pasos' in nuevo);
  // UNDÉCIMA: el caso nuevo es un escenario MÁS de R (no una tarjeta nueva).
  assert.equal(nuevo.pasos.length, pasos.length);
  assert.equal(nodoPorId(nuevo.pasos, 'R')!.casos!.at(-1)!.responder, 'De 9 a 18');
  // Mismo título, sin guía: conserva su `responder` y su libertad; sólo cambia el «cuándo».
  const precio = agregarCasoAlGrafo(pasos, { titulo: 'precio', cuando: 'otra vez el precio', comoResponder: '' }, rndDe());
  assert.ok('pasos' in precio, 'un caso que ya contesta no se pudo re-enseñar sin guía');
  const a = nodoPorId(precio.pasos, 'R')!.casos!.find((c) => c.id === 'A')!;
  assert.equal(a.responder, 'En la llamada');
  assert.equal(a.cuando, 'otra vez el precio');
  assert.equal(a.sola, true);
  // Un caso que sólo avisa sigue avisando: re-enseñarlo sin guía tampoco lo deja sin qué hacer.
  const enojo = agregarCasoAlGrafo(pasos, { titulo: 'Se enoja', cuando: 'insulta', comoResponder: '' }, rndDe());
  assert.ok('pasos' in enojo, 'un caso que avisa no se pudo re-enseñar sin guía');
  assert.equal(libertadDeCaso(nodoPorId(enojo.pasos, 'R')!.casos!.find((c) => c.id === 'C')), 'avisa');
  // Junto (el «Precio» que salía sola baja a «Para aprobar») y con objetivo, se publica.
  assert.deepEqual(validarGrafo(juntarPasosIA(enojo.pasos.map((p) => (p.id === 'R' ? { ...p, objetivo: 'Que agende' } : p))).pasos), []);
});

test('la forma de siempre no cambia: ahí un caso sin guía sigue colgando un «MaKo contesta»', () => {
  const clasico: PasoGrafo[] = [
    msg({ id: 'm1', cuerpo: 'Hola', siguiente: null }),
    { ...msg({ cuerpo: '' }), id: 'R', nodo: 'respuesta', casos: [], si_no: null },
  ];
  assert.ok('pasos' in agregarCasoAlGrafo(clasico, { titulo: 'Horario', cuando: 'x', comoResponder: '' }, rndDe()));
});

// ── 2. Ids de caso repetidos ───────────────────────────────────────────────────────

test('`idsDeCasos`: los únicos quedan iguales, el vacío toma `<nodo>c<k>` y el repetido se desempata', () => {
  assert.deepEqual(idsDeCasos('R', [{ id: 'a' }, { id: 'b' }]), ['a', 'b']);
  assert.deepEqual(idsDeCasos('R', [{ id: '' }, { id: 'b' }]), ['Rc0', 'b']);
  assert.deepEqual(idsDeCasos('R', [{ id: 'a' }, { id: 'a' }, { id: 'a_2' }]), ['a', 'a_2', 'a_2_2']);
  assert.deepEqual(idsDeCasos('R', []), []);
});

test('dos casos con el MISMO id: cada uno contesta con SU guía y sale (o no) por lo suyo', () => {
  const pasos = conIA([
    caso('cx', { titulo: 'Precio', cuando: 'pregunta el precio', responder: 'NO des precio' }),
    caso('cx', { titulo: 'Confirma', cuando: 'confirma la reunión', responder: 'Agradece', sola: true }),
  ]);
  // Sin normalizar (los pasos del lienzo que llegan a «Probar»): la expansión ya los separa.
  const esc = escenariosDeRespuesta(pasos);
  assert.deepEqual(esc.map((e) => [e.titulo, e.comoResponder, e.contestaSolo === true]), [
    ['Precio', 'NO des precio', false], ['Confirma', 'Agradece', true],
  ], '«Confirma» contesta con la guía del precio');
  assert.notEqual(esc[0].casoId, esc[1].casoId);
  // Guardado (`normalizar`): el segundo ya tiene otro id, y la expansión del guardado dice lo mismo.
  const guardado = normalizar(pasos);
  assert.deepEqual(nodoPorId(guardado, 'R')!.casos!.map((c) => c.id), ['cx', 'cx_2']);
  assert.deepEqual(escenariosDeRespuesta(guardado), esc);
  assert.ok(nodoPorId(expandirPasoIA(guardado), idRespuestaDeCaso('R', 'cx_2')), 'el segundo caso no tiene su «MaKo contesta»');
});

test('el repetido que nace del saneo: un id inválido queda en \'\' y su `<nodo>c<k>` es el de otro caso', () => {
  const crudo = {
    ...msg({ cuerpo: '' }), id: 'R', nodo: 'respuesta', paso_ia: true, si_no: null,
    casos: [
      { id: 'no vale', titulo: 'Precio', cuando: 'pregunta el precio', responder: 'NO des precio', siguiente: null },
      { id: 'Rc0', titulo: 'Confirma', cuando: 'confirma', responder: 'Agradece', sola: true, siguiente: null },
    ],
  };
  const saneado = camposDelFlujo(crudo);
  assert.deepEqual(saneado.casos!.map((c) => c.id), ['', 'Rc0']);
  const guardado = normalizar([msg({ id: 'm1', siguiente: null }), { ...crudo, ...saneado } as PasoGrafo]);
  assert.deepEqual(nodoPorId(guardado, 'R')!.casos!.map((c) => c.id), ['Rc0', 'Rc0_2']);
  assert.deepEqual(escenariosDeRespuesta(guardado).map((e) => e.comoResponder), ['NO des precio', 'Agradece']);
});

// ── 3. «Probar» lee la guía entera ─────────────────────────────────────────────────

test('`TOPE_GUIA` es el largo máximo de la guía (tono + respuesta), y «Probar» corta ahí', () => {
  const guia = guiaDeCaso({ instrucciones: 't'.repeat(TOPE_INSTRUCCIONES) }, { responder: `${'r'.repeat(TOPE_RESPONDER - 3)}FIN` });
  assert.equal(guia.length, TOPE_GUIA);
  assert.ok(guia.slice(0, TOPE_GUIA).endsWith('FIN'), '«Probar» pierde el final de la respuesta del caso');
  const responder = bloque(fuente('app/api/chat-agent/simulador/route.ts'), "if (body.action === 'responder') {", "if (body.action === 'enviar-real') {");
  assert.match(responder, /comoResponder: String\(e\.comoResponder \?\? ''\)\.slice\(0, TOPE_GUIA\),/);
});

// ── 4. «Eliminar» y «Recuperar» no escriben en la BASE de la plataforma ────────────

test('ocultar y restaurar contestan `false` SIN escribir cuando se edita la base; la ruta de /mensajes lo dice', () => {
  const store = fuente('lib/plantillas.ts');
  const oc = bloque(store, 'export async function ocultarPlantilla(', 'export async function restaurarPlantilla(');
  assert.ok(oc.indexOf('if (enLaBase()) return false;') > 0, 'ocultar en la base apaga el mensaje de todos los clientes');
  assert.ok(oc.indexOf('if (enLaBase()) return false;') < oc.indexOf('await mutar(id, ocultar);'));
  const rest = bloque(store, 'export async function restaurarPlantilla(', 'export async function setCanalesPlantilla(');
  assert.match(rest, /Promise<boolean> \{\n\s+if \(enLaBase\(\)\) return false;\n\s+await mutar\(id, restaurar\);\n\s+return true;/, 'recuperar en la base prende el mensaje de todos los clientes');
  const admin = fuente('app/api/admin/plantillas/route.ts');
  assert.match(bloque(admin, "case 'restaurar': {", "case 'probar':"), /if \(!\(await restaurarPlantilla\(b\.id\)\)\) return NextResponse\.json\(\{ ok: false, error: '[^']+' \}, \{ status: 400 \}\);/,
    'la ruta contesta ok sobre un «Recuperar» que no hizo nada');
});

// ── 5. El script de la novena tanda: el respaldo va ANTES de escribir ──────────────

test('scripts/novena-tanda-ws1.mts guarda y RELEE el respaldo antes de la primera escritura', () => {
  const s = fuente('scripts/novena-tanda-ws1.mts');
  // La foto sale de lo recién leído, antes de convertir nada.
  const iFoto = s.indexOf('const respaldoTexto = JSON.stringify({');
  assert.ok(iFoto > 0 && iFoto < s.indexOf('const antes213 = normalizar('), 'el respaldo se arma después de convertir');
  assert.match(s, /const filasRespaldo: Fila\[\] = \[s213, s212, s198\];/);
  assert.match(bloque(s, 'const respaldoTexto = JSON.stringify({', '}, null, 1);'), /secuencias: filasRespaldo,/);
  const guardar = bloque(s, 'function guardarRespaldo(): void {', '\nif (!aplicar)');
  assert.match(guardar, /writeFileSync\(RESPALDO, respaldoTexto, 'utf8'\);\n\s+const vuelta = JSON\.parse\(readFileSync\(RESPALDO, 'utf8'\)\)/, 'el respaldo no se relee');
  assert.match(guardar, /if \(vuelta\.ws !== WS \|\| malas\.length\) throw new Error\(/, 'un respaldo que no sirve deja escribir igual');
  const escribe = s.slice(s.indexOf('if (aplicar) {\n  console.log(\'\\n══ ESCRIBIENDO ══\');'));
  const iGuardar = escribe.indexOf('guardarRespaldo();');
  assert.ok(iGuardar > 0 && iGuardar < escribe.indexOf('await escribir('), 'se escribe antes de guardar el respaldo');
});

// ── 6. El filtro de la lista cuenta lo que manda un AI Step ────────────────────────

test('una automatización cuyo único mensaje al lead es su AI Step pasa «WhatsApp» y «A clientes»', () => {
  const soloIA: PasoGrafo[] = [
    { nodo: 'esperar', canal: 'whatsapp', espera: { modo: 'tiempo', minutos: 60 }, id: 'e1', siguiente: null },
    { ...msg({ cuerpo: '' }), id: 'R', nodo: 'respuesta', paso_ia: true, si_no: null,
      casos: [caso('A', { titulo: 'Precio', cuando: 'pregunta el precio', responder: 'En la llamada' })] },
  ];
  assert.deepEqual(enviosDePasos(soloIA), [{ canal: 'whatsapp', destino: 'clientes' }, { canal: 'whatsapp', destino: 'mako' }]);
  // Sin casos: todo va a «Otra cosa», que avisa al equipo (como el «Si no» de la forma de siempre).
  const sinCasos: PasoGrafo[] = [{ ...soloIA[1], casos: [] }];
  assert.deepEqual(enviosDePasos(sinCasos), [{ canal: 'whatsapp', destino: 'mako' }]);
});

// ── 7. La ficha que lee MaKo muestra el AI Step ────────────────────────────────────

// UNDÉCIMA (w2-aistep-editor): la ficha dice el AI Step de HOY —uno por medio, un objetivo y sus escenarios con su
// LIBERTAD (la MISMA función que la tarjeta y el motor, `libertadDeCaso`), «Lo demás» aparte— y lo lee JUNTO
// (`juntarPasosIA`, la puerta para lo viejo). Lo de antes (tono, «Otra cosa» con texto, `hasta`, `avisar`) ya no se dice.
test('`ficha_secuencia_mensajes` lee lo JUNTO y dice del AI Step su objetivo y cada escenario con su libertad', () => {
  const run = fuente('lib/api-mako/areas/chatbot.run.ts');
  const ficha = bloque(run, '  ficha_secuencia_mensajes: {', '\n  },\n');
  assert.match(ficha, /const pasos = juntarPasosIA\(s\.pasos\)\.pasos;/, 'la ficha muestra las tarjetas de antes sin juntar');
  const junta = 'const pasos = juntarPasosIA(s.pasos).pasos;';
  assert.doesNotMatch(ficha.slice(ficha.indexOf(junta) + junta.length), /s\.pasos/, 'una parte de la ficha lee lo guardado sin juntar');
  const control = bloque(ficha, 'pasos: pasos.map((p, i) => esNodoDeControl(p) ? ({', '}) : esPasoAccion(p) ? ({', 1200);
  assert.match(control, /\.\.\.\(esPasoIA\(p\) \? fichaPasoIA\(p\) : \{\}\),\n\s*$/, 'la ficha muestra un «Si responde» con casos que no contestan nada');
  assert.match(control, /casos: esPasoIA\(p\) \? undefined : p\.casos \?\? null,/, 'el AI Step repite sus escenarios crudos (sin su libertad)');
  const f = bloque(run, 'function fichaPasoIA(p: PasoGrafo) {', '\n}\n', 900);
  for (const campo of ["paso_ia: true as const,", "objetivo: (p.objetivo ?? '').trim() || null,", 'medio: medioDe(p),', "ejemplos: (p.ejemplos ?? []).length,", 'lo_demas: libertadDeLoDemas(casos),']) {
    assert.ok(f.includes(campo), `falta ${campo}`);
  }
  assert.match(f, /escenarios: casos\.filter\(\(c\) => c\.cualquiera !== true\)\.map\(\(c\) => \(\{\n\s+id: c\.id, titulo: c\.titulo, cuando: c\.cuando, responder: \(c\.responder \?\? ''\)\.trim\(\) \|\| null, libertad: libertadDeCaso\(c\),/);
  for (const viejo of ['instrucciones', 'otra_aviso', 'avisar', 'hasta', 'no_contesta']) assert.ok(!f.includes(viejo), `la ficha todavía dice «${viejo}»`);
  // La nota que lee el modelo: uno por medio, objetivo y escenarios (no «UNA tarjeta por caso»).
  assert.ok(ficha.includes('UN AI Step por medio, con un objetivo y sus escenarios adentro'));
  assert.ok(!ficha.includes('UNA tarjeta por caso'));
});

// UNDÉCIMA (w2-aistep-editor): enseñar un caso por la API (agregar_escenario_secuencia, resolver_handoff) entra ADENTRO
// del AI Step sobre lo JUNTO, y lo que se escribe pasa por `setSecuenciaPasos`.
test('agregar_escenario_secuencia y resolver_handoff suman el escenario adentro del AI Step, sobre lo junto', () => {
  const run = fuente('lib/api-mako/areas/chatbot.run.ts');
  const agregar = bloque(run, '  agregar_escenario_secuencia: {', '\n  resolver_handoff: {', 5000);
  assert.match(agregar, /const pasos = juntarPasosIA\(s\.pasos\)\.pasos;\n\s+if \(raizRespuesta\(pasos\) != null\) \{\n\s+const r = agregarCasoAlGrafo\(pasos, escenario\);/);
  assert.match(agregar, /const r = agregarCasoAlGrafo\(pasos, payload\.escenario as EscenarioSecuencia\);[\s\S]*?await setSecuenciaPasos\(id, r\.pasos\);/);
  assert.doesNotMatch(agregar, /agregarCasoAlGrafo\(s\.pasos/, 'agrega sobre lo guardado sin juntar');
  const handoff = bloque(run, '  resolver_handoff: {', '\n  archivar_secuencia: {', 5000);
  assert.match(handoff, /juntarPasosIA\(s\.pasos as PasoSecuencia\[\]\)\.pasos/);
  // El resumen dice la libertad con la que QUEDA (un «contesta solo» que habla de plata queda para aprobar).
  assert.match(bloque(run, 'function dondeEntra(', '\n}\n', 900), /ROTULO_LIBERTAD\[libertadDeCaso\(c\)\]/);
});

// ── 8. El DTO del lienzo declara el AI Step ────────────────────────────────────────

// Lo fija el TYPECHECK: si `CamposDelFlujo` (app/automations/ChatAgentApp.tsx) pierde una de estas claves, esta
// línea no compila (y tampoco el editor del AI Step en FlujoLienzo, que ya no castea).
// UNDÉCIMA (w2-aistep-editor): lo del OBJETIVO es de la tarjeta (`objetivo`, `audio`, `ejemplos`) y se fueron el tono
// y el aviso de «Otra cosa» (`instrucciones`, `otra_aviso`), que ya no edita ni lee nadie en la pantalla.
type ClavesDelPasoIA = Extract<keyof PasoSecuenciaDto, 'paso_ia' | 'suelta' | 'medio' | 'objetivo' | 'audio' | 'ejemplos'>;
const CLAVES_DEL_PASO_IA: Record<ClavesDelPasoIA, true> = { paso_ia: true, suelta: true, medio: true, objetivo: true, audio: true, ejemplos: true };
/** Lo que el DTO ya NO declara: si vuelve una, el tipo deja de ser `never`, la condición da `false` y esta línea no compila. */
type ClavesQueSeFueron = Extract<keyof PasoSecuenciaDto, 'instrucciones' | 'otra_aviso'>;
const SE_FUERON: [ClavesQueSeFueron] extends [never] ? true : false = true;

test('el lienzo edita el AI Step sobre el DTO, sin castear a `PasoGrafo`', () => {
  assert.equal(Object.keys(CLAVES_DEL_PASO_IA).length, 6);
  assert.equal(SE_FUERON, true);
  // (AI Step v2 sumaba «＋ Otro AI Step» en el bloque; la undécima lo sacó: uno por medio.)
  const ia = bloque(fuente('app/automations/FlujoLienzo.tsx'), 'if (esPasoIA(paso)) {', "return <EditorRespuesta", 1000);
  // El tipo explícito NO es un cast: sin él, TypeScript infiere el paso del PARCHE (`PasoIAEditable`).
  assert.match(ia, /pr\.onPasos\(\(prev\) => cambiarNodo<PasoSecuenciaDto>\(prev, id, patch\), apilar\);/);
  assert.match(ia, /<EditorPasoIA key=\{`ia-\$\{id\}`\} id=\{id\} paso=\{paso\} /);
  assert.doesNotMatch(ia, /\bas Paso(Grafo|SecuenciaDto)\b/, 'volvió el cast');
});

// ROTURAS (11/10/2026), una por vez, con un arnés (scratchpad `arreglo-roturas.mjs`) que rompe, corre ESTE
// archivo, tests/plantillas-ocultas.test.ts, tests/automations-paso-ia.test.ts y tests/chatbot-lista-filtro.test.ts
// (54 tests entre los cuatro), y restaura DE MEMORIA (nunca con git), verificando que cada archivo volviera
// idéntico y que nadie lo hubiera tocado mientras estaba roto. Base: 54 pass / 0 fail; al final, igual.
//   · R1 caso NUEVO sin guía, sin el freno: 53 / 1 · R2 caso que YA estaba (vacío), sin el freno: 53 / 1
//   · R3 `idsDeCasos` no desempata: 51 / 3 · R4 `normalizar` con el id de antes: 52 / 2 · R5 `expandirPasoIA`
//     con el id de antes: 53 / 1
//   · R6 «Probar» corta en 2000: 53 / 1 · R7 `TOPE_GUIA` sin el rótulo ni el salto: 53 / 1
//   · R8 ocultar escribe en la base: 53 / 1 · R9 restaurar escribe en la base: 53 / 1 · R10 la ruta ignora el
//     «no» de restaurar: 52 / 2 (también tests/plantillas-ocultas.test.ts)
//   · R11 el script escribe sin respaldo: 53 / 1 · R12 un respaldo que no sirve deja escribir: 53 / 1
//   · R13 el filtro lee el AI Step compacto: 53 / 1 · R14 la ficha sin el AI Step: 53 / 1 · R15 la ficha sin
//     «avisar»: 53 / 1 · R16 el lienzo vuelve a castear: 53 / 1
//   · R17, del TIPO (tsc sólo sobre este archivo): `CamposDelFlujo` sin 'otra_aviso' → TS2353 en
//     `CLAVES_DEL_PASO_IA`. ⚠️ FlujoLienzo compila igual sin esa clave (`Partial<…>` es un tipo «débil»: le
//     alcanza con que `casos` coincida), así que la línea de tipo de acá es la única red.
// UNDÉCIMA (11/10/2026, w1-aistep-modelo; arnés wf-undecima/w1-aistep-modelo/roturas.cjs, base 12 / 0): R1 y R2 rompían el
// freno de «no contesta ni avisa», que se fue (un escenario sin respuesta es «Sólo te avisa»). Sus reemplazos:
//   · U1 enseñar sin guía vuelve a rechazarse: 10 / 2 · U2 re-enseñar sin guía le reescribe la libertad: 11 / 1
// UNDÉCIMA, LA API DEL AI STEP (11/10/2026, w2-aistep-editor; arnés wf-undecima/w2-aistep-editor/roturas.cjs sobre los
// seis archivos del paquete, 100 tests, base 100 / 0): la ficha lee lo guardado SIN juntar → 1 / 100 · la ficha vuelve
// a decir el tono (`instrucciones`) → 1 / 100 · `agregar_escenario_secuencia` agrega sin juntar → 1 / 100. Los tres caen
// en los tests 7 de acá. La línea de TIPO del DTO (`SE_FUERON`, `CLAVES_DEL_PASO_IA`) la caza `tsc`, no el runner: no se
// midió rompiéndola (el typecheck entero tarda y pide turno); la de la ola 1 (R17) se midió igual y daba TS2353.
// Y `guardarRespaldo` se EJECUTÓ aparte (scratchpad `arreglo-respaldo-prueba.mjs`, la función real transpilada
// con esbuild, sobre filas falsas): un respaldo bueno pasa; los pasos como texto, otro `updated_at` y otro
// workspace tiran. El simulacro del script (sin escribir) imprime dónde quedaría.
