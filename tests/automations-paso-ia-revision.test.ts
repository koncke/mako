// =============================================================================
// El AI Step después de la revisión adversarial (novena tanda, 11/10/2026)
// =============================================================================
// La revisión del motor y los datos del AI Step (tests/automations-paso-ia.test.ts) encontró tres defectos
// y dos riesgos, y el implementador dejó tres puertas fuera de sus archivos. Lo que fija cada test:
//
//   1. «Enseñar un caso» sin guía a un AI Step se aceptaba al PROPONER y moría al EJECUTAR
//      (`agregarCasoAlGrafo`, lib/nutricion-grafo-motor.ts): ahora frena en `preparar()`.
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
  idRespuestaDeCaso, TOPE_GUIA, TOPE_RESPONDER, TOPE_INSTRUCCIONES, separarPasosIA,
} from '../lib/flujo-grafo';
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

test('un caso NUEVO sin «cómo responder» en un AI Step se rechaza en `agregarCasoAlGrafo` (antes moría al guardar)', () => {
  const pasos = conIA([caso('A', { titulo: 'Precio', cuando: 'pregunta el precio', responder: 'En la llamada' })]);
  const r = agregarCasoAlGrafo(pasos, { titulo: 'Horario', cuando: 'pregunta el horario', comoResponder: '   ' }, rndDe());
  assert.ok('error' in r, 'se aceptó un caso que no contesta ni avisa');
  assert.match(r.error, /cómo responder/);
  // El porqué: el mismo caso, colgado a mano, es lo que `setSecuenciaPasos` rechazaba en `ejecutar`.
  const colgado = conIA([...pasos[1].casos!, caso('n1', { titulo: 'Horario', cuando: 'pregunta el horario' })]);
  assert.equal(faltaEnCaso(colgado[1].casos![1]), 'que_hace');
  assert.ok(validarGrafo(normalizar(colgado)).some((e) => /no contesta ni avisa/.test(e)), 'el caso colgado ya no lo frena Publicar');
  // Y re-enseñar sin guía uno que YA estaba vacío (un borrador a medio armar) tampoco lo deja pasar.
  const vacio = agregarCasoAlGrafo(colgado, { titulo: 'horario', cuando: 'otra vez', comoResponder: '' }, rndDe());
  assert.ok('error' in vacio, 'se aceptó re-enseñar un caso que sigue sin contestar ni avisar');
});

test('con guía entra; y un caso que YA contesta o avisa se puede re-enseñar sin guía (conserva lo suyo)', () => {
  const pasos = conIA([
    caso('A', { titulo: 'Precio', cuando: 'pregunta el precio', responder: 'En la llamada', sola: true }),
    caso('C', { titulo: 'Se enoja', cuando: 'está molesto', avisar: true }),
  ]);
  const nuevo = agregarCasoAlGrafo(pasos, { titulo: 'Horario', cuando: 'pregunta el horario', comoResponder: 'De 9 a 18' }, rndDe());
  assert.ok('pasos' in nuevo);
  // AI Step v2: el caso nuevo es una TARJETA nueva (al final del array), no un caso más de R.
  assert.equal(nuevo.pasos.at(-1)!.casos![0].responder, 'De 9 a 18');
  // Mismo título, sin guía: conserva su `responder` (y `sola` se reescribe con lo enseñado: ausente = a revisar).
  const precio = agregarCasoAlGrafo(pasos, { titulo: 'precio', cuando: 'otra vez el precio', comoResponder: '' }, rndDe());
  assert.ok('pasos' in precio, 'un caso que ya contesta no se pudo re-enseñar sin guía');
  const a = nodoPorId(precio.pasos, 'R')!.casos!.find((c) => c.id === 'A')!;
  assert.equal(a.responder, 'En la llamada');
  assert.equal(a.cuando, 'otra vez el precio');
  assert.equal(a.sola, undefined);
  // Un caso que sólo avisa sigue avisando: re-enseñarlo sin guía tampoco lo deja sin qué hacer.
  const enojo = agregarCasoAlGrafo(pasos, { titulo: 'Se enoja', cuando: 'insulta', comoResponder: '' }, rndDe());
  assert.ok('pasos' in enojo, 'un caso que avisa no se pudo re-enseñar sin guía');
  // (R tiene dos casos —forma v1—: se publica separado, una tarjeta por caso.)
  assert.deepEqual(validarGrafo(separarPasosIA(enojo.pasos, rndDe()).pasos), []);
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

test('`ficha_secuencia_mensajes` suma al AI Step su marca, su tono, su «Otra cosa» y cada caso con lo que hace', () => {
  const run = fuente('lib/api-mako/areas/chatbot.run.ts');
  const ficha = bloque(run, '  ficha_secuencia_mensajes: {', '\n  },\n');
  const control = bloque(ficha, 'pasos: s.pasos.map((p, i) => esNodoDeControl(p) ? ({', '}) : esPasoAccion(p) ? ({', 1200);
  assert.match(control, /\.\.\.\(esPasoIA\(p\) \? fichaPasoIA\(p\) : \{\}\),\n\s*$/, 'la ficha muestra un «Si responde» con casos que no contestan nada');
  const f = bloque(run, 'function fichaPasoIA(p: PasoSecuencia) {', '\n}\n', 800);
  for (const campo of ["paso_ia: true as const,", "instrucciones: p.instrucciones ?? null,", "otra_aviso: p.otra_aviso ?? null,"]) {
    assert.ok(f.includes(campo), `falta ${campo}`);
  }
  assert.match(f, /responder: c\.responder \?\? null, sola: c\.sola === true, avisar: c\.avisar === true,/);
});

// ── 8. El DTO del lienzo declara el AI Step ────────────────────────────────────────

// Lo fija el TYPECHECK: si `CamposDelFlujo` (app/automations/ChatAgentApp.tsx) pierde una de estas claves, esta
// línea no compila (y tampoco el editor del AI Step en FlujoLienzo, que ya no castea).
type ClavesDelPasoIA = Extract<keyof PasoSecuenciaDto, 'paso_ia' | 'instrucciones' | 'otra_aviso' | 'suelta'>;
const CLAVES_DEL_PASO_IA: Record<ClavesDelPasoIA, true> = { paso_ia: true, instrucciones: true, otra_aviso: true, suelta: true };

test('el lienzo edita el AI Step sobre el DTO, sin castear a `PasoGrafo`', () => {
  assert.equal(Object.keys(CLAVES_DEL_PASO_IA).length, 4);
  // AI Step v2: el bloque suma «＋ Otro AI Step» (crea otra tarjeta del medio y la abre): mide más.
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
// Y `guardarRespaldo` se EJECUTÓ aparte (scratchpad `arreglo-respaldo-prueba.mjs`, la función real transpilada
// con esbuild, sobre filas falsas): un respaldo bueno pasa; los pasos como texto, otro `updated_at` y otro
// workspace tiran. El simulacro del script (sin escribir) imprime dónde quedaría.
