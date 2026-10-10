// =============================================================================
// Un mensaje de VARIAS partes lo entiende TODO lo que recorre `pasos` (cuarta tanda, punto 15)
// =============================================================================
// El modelo (lib/mensaje-partes.ts) cambió qué es un paso: los campos de siempre (`cuerpo`,
// `audio_id`, `media_id`) son el espejo de la PRIMERA parte y el resto vive en `partes`. AGENTS.md:
// «antes de sumar un tipo de paso, `grep` de `.pasos` y de `setSecuenciaPasos`». Lo que encontró ese
// barrido, y lo que fija este test:
//   · BORRAR un audio o un archivo de la biblioteca miraba sólo el espejo: el de la SEGUNDA parte se
//     podía borrar y el motor fallaba en cada lead (`pasosUsanAdjunto`, `pasosUsanAudio`);
//   · el GENERADOR de copy le pedía texto al modelo para el espejo (un audio con cuerpo vacío) y ese
//     texto entraba como una parte MÁS; y las VARIANTES se generaban (y se pagaban) para tirarlas;
//   · la PRUEBA de la API (`probarSecuencia`) mandaba sólo la primera parte (y un audio sin su pie);
//   · la FICHA de la API y el contexto de MaKo leían sólo el espejo;
//   · el guardado (`setSecuenciaPasos`) y el motor: que `normalizar` conserve `partes` (se EJECUTA) y
//     que el motor mande las partes ANTES que la rama del audio y deje la marca al fallar;
//   · «Probar» muestra cada parte y cada una sale de verdad una vez.
//
// PROBADO ROMPIÉNDOLO (09/10/2026, arnés del scratchpad: una rotura por vez, restaurada DE MEMORIA):
// ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pasosUsanAdjunto } from '../lib/setting-adjuntos-reglas';
import { pasosUsanAudio, pasoUsaAudio, pasoUsaArchivo, resumenDePartes, formaGuardada, type ParteMensaje } from '../lib/mensaje-partes';
import { normalizar, validarGrafo, type PasoGrafo } from '../lib/flujo-grafo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (r: string) => sinComentarios(leer(r));

const texto = (cuerpo: string): ParteMensaje => ({ tipo: 'texto', cuerpo });
const audio = (id: number): ParteMensaje => ({ tipo: 'audio', audio_id: id });
const media = (id: number): ParteMensaje => ({ tipo: 'media', media_id: id });
const wa = { canal: 'whatsapp', proveedor: 'no_oficial' as const };
/** Un paso de tres partes como lo GUARDA el editor: el espejo de la primera y `partes`. */
const tres = { ...wa, ...formaGuardada([texto('Hola'), audio(7), media(3)]) };

test('borrar de la biblioteca: el audio y el archivo de CUALQUIER parte cuentan como usados', () => {
  assert.equal(pasoUsaAudio(tres, 7), true, 'el audio de la segunda parte');
  assert.equal(pasoUsaArchivo(tres, 3), true, 'el archivo de la tercera');
  assert.equal(pasosUsanAdjunto([tres], 3), true, 'la pregunta que hace la biblioteca antes de borrar');
  assert.equal(pasosUsanAudio([tres], 7), true, 'la que hace la API antes de borrar un audio');
  assert.equal(pasosUsanAudio([tres], 8), false);
  // Lo de antes sigue: el espejo.
  assert.equal(pasosUsanAudio([{ ...wa, tipo: 'audio', audio_id: 9, cuerpo: '' }], 9), true);
  assert.equal(pasosUsanAdjunto([{ ...wa, tipo: 'media', media_id: 4, cuerpo: '' }], 4), true);
  assert.equal(pasosUsanAdjunto('roto', 4), false);
});

test('un mensaje de varias partes se LEE entero en un renglón; uno de los de siempre, como antes', () => {
  assert.equal(resumenDePartes(tres), 'Hola · [audio] · [archivo]');
  assert.equal(resumenDePartes({ ...wa, cuerpo: 'Sólo texto' }), 'Sólo texto');
  assert.equal(resumenDePartes({ ...wa, cuerpo: 'x'.repeat(200) }).length, 90);
});

test('el guardado: `normalizar` CONSERVA las partes y un flujo con ellas valida', () => {
  const pasos = normalizar([{ id: 'm1', ...tres, delay_horas: 0, asunto: null, template_wa: null, siguiente: null } as PasoGrafo]);
  assert.deepEqual(pasos[0].partes, [texto('Hola'), audio(7), media(3)], '`normalizar` reconstruye el paso: si soltara `partes`, se perdían al publicar');
  assert.deepEqual(validarGrafo(pasos), []);
  // Y en `setSecuenciaPasos` (server-only, se lee el fuente): las partes se validan ANTES de escribir y
  // se reponen después de reconstruir el paso, con las guardadas por el id del nodo.
  const nut = fuente('lib/nutricion.ts');
  const set = nut.slice(nut.indexOf('export async function setSecuenciaPasos('), nut.indexOf('async function filasCohorte<T>('));
  assert.ok(set.length > 2000, `el recorte de setSecuenciaPasos mide ${set.length}`);
  const iValida = set.indexOf('problemaDePartes(p)');
  const iEscribe = set.indexOf(".update({ pasos: grafo, updated_at: ahoraISO() })");
  assert.ok(iValida > 0 && iEscribe > iValida, 'lo imposible se rechaza antes de escribir');
  assert.match(set, /\.\.\.partesAlGuardar\(p, partesPrevias\.get\(idDe\(flujo, i\)\)\),/);
  assert.match(set, /antes\.forEach\(\(p, i\) => \{ if \(p && Array\.isArray\(p\.partes\) && p\.partes\.length\) partesPrevias\.set\(idDe\(p, i\), p\.partes\); \}\);/);
});

test('el motor: varias partes ANTES que la rama del audio, en orden, y la marca al fallar', () => {
  const nut = fuente('lib/nutricion.ts');
  const iPartes = nut.indexOf('} else if (partesMulti) {');
  const iAudio = nut.indexOf('} else if (esAudio) {');
  assert.ok(iPartes > 0 && iAudio > iPartes, 'por la rama del audio saldría sólo la primera parte');
  // Sexta tanda (parte «canales»): Instagram y Messenger también mandan varias partes, con la misma marca.
  assert.match(nut, /const partesMulti = paso\.canal === 'whatsapp' \|\| esCanalSocial\(paso\.canal\) \? partesExplicitas\(paso\) : null;/);
  assert.match(nut, /asunto: estado === 'fallo' && partesMulti \? marcaPartes\(partesSalidas\) : paso\.asunto,/);
  const enviar = nut.slice(nut.indexOf('async function enviarPartesDelPaso('), nut.indexOf('// Procesa los envíos vencidos'));
  // Los archivos se bajan TODOS antes de mandar la primera.
  assert.ok(enviar.indexOf('await getAudio(') < enviar.indexOf('await enviarYEspejar('), 'baja antes de mandar');
  assert.match(enviar, /if \(!r\.ok\) return \{ ok: false, salieron: salieronAntes \+ k,/);
});

test('el generador de copy y las variantes NO tocan un mensaje de varias partes', () => {
  const gen = fuente('lib/nutricion-generator.ts');
  assert.match(gen, /const varias = \(p: PasoSecuencia\) => p\.canal === 'whatsapp' && partesExplicitas\(p\) != null;/);
  assert.match(gen, /const aEscribir = sec\.pasos\.filter\(\(p\) => !esPasoAccion\(p\) && !esNodoDeControl\(p\) && !varias\(p\)\);/);
  const merge = gen.slice(gen.indexOf('const merged: PasoSecuencia[] = sec.pasos.map((orig) => {'), gen.indexOf('return { ok: true, secuenciaId'));
  assert.ok(merge.indexOf('if (varias(orig)) return orig;') >= 0 && merge.indexOf('if (varias(orig)) return orig;') < merge.indexOf('const i = deTexto++;'),
    'sale del merge ANTES de tomar un lugar entre los textos (si no, corre el orden de los demás)');
  const vars = fuente('lib/secuencias-variantes.ts');
  assert.match(vars, /if \(p\.tipo === 'audio' \|\| !p\.cuerpo\?\.trim\(\) \|\| partesExplicitas\(p\)\) \{ nuevos\.push\(p\); continue; \}/);
});

test('la prueba de la API manda CADA parte, en orden, y corta el paso si una falla', () => {
  const sec = fuente('lib/setting-secuencias.ts');
  const prueba = sec.slice(sec.indexOf('export async function probarSecuencia('), sec.indexOf('if (enviadosWa + enviadosEmail === 0) {'));
  assert.match(prueba, /const lista = partesDe\(paso\);/);
  assert.match(prueba, /for \(const parte of lista\) \{/);
  assert.equal((prueba.match(/; break; \}/g) ?? []).length, 5, 'cada fallo (bajar y mandar el audio y el archivo, mandar el texto) corta el resto del paso');
  assert.doesNotMatch(prueba, /paso\.tipo === 'audio' && Number\(paso\.audio_id\)/, 'volvió la rama que mandaba sólo el espejo');
});

test('la ficha de la API y MaKo leen el mensaje entero; borrar un audio mira todas las partes', () => {
  const run = fuente('lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /\.\.\.\(partesExplicitas\(p\) \? \{ partes: partesExplicitas\(p\) \} : \{\}\),/);
  const borrar = run.slice(run.indexOf('borrar_audio: {'), run.indexOf('responder_huecos_voz: {'));
  assert.equal((borrar.match(/pasosUsanAudio\(s\.pasos, audioId\)/g) ?? []).length, 2, 'al preparar Y al ejecutar');
  assert.doesNotMatch(borrar, /Number\(p\.audio_id\) === audioId/);
  assert.match(fuente('lib/mako-context.ts'), /: \$\{resumenDePartes\(p\)\}`\)/);
});

test('«Probar»: cada parte en orden, cada una sale de verdad UNA vez, y el audio sin transcripción', () => {
  const panel = fuente('app/automations/PanelProbar.tsx');
  const mostrar = panel.slice(panel.indexOf('const mostrarPaso = ('), panel.indexOf('function avanzar() {'));
  assert.match(mostrar, /const lista = partesDe\(p\);/);
  assert.match(mostrar, /const clave = lista\.length > 1 \? `\$\{nodo\}#\$\{k\}` : nodo;/, 'con la clave de la TARJETA, la segunda parte no salía («Ya salió»)');
  const parte = panel.slice(panel.indexOf('const mostrarParte = ('), panel.indexOf('const mostrarPaso = ('));
  assert.match(parte, /tipo: 'audio', mediaUrl: a\.url, texto: null,/);
  assert.doesNotMatch(panel, /a\.transcript/, 'volvió la transcripción del audio');
  // El que sigue espera a que termine de aparecer el mensaje entero.
  assert.match(panel, /const resto = mostrarPaso\(paso, evento\.nodo, undefined, evento\.enRespuesta\); luego\(ENTRE_MS \+ resto, avanzar\);/);
});

// ── ROTURAS (09/10/2026) ───────────────────────────────────────────────────────────────────────
// Cada una sola, restaurada de memoria (md5 verificado), corriendo este archivo junto con los otros
// cuatro de la tanda (base 69 pass / 0 fail). Las 13 cayeron, cada una con 68 / 1 en el test que la
// persigue:
//   1. la biblioteca mirando sólo el espejo (`media_id`).   2. `pasoUsaAudio` sin las partes.
//   3. el generador escribiendo también los de varias partes. 4. su merge sin saltearlos.
//   5. las variantes para los de varias partes.               6. `probarSecuencia` siguiendo después
//      de que un texto falla.  7. la ficha de la API sin las partes.  8. `borrar_audio` (preparar)
//      mirando sólo el espejo.  9. «Probar» con la clave de la tarjeta en cada parte.  10. «Probar»
//      con la transcripción del audio.  11. MaKo leyendo sólo el espejo.  12. el motor sin la marca de
//      cuántas salieron.  13. `setSecuenciaPasos` sin reponer las partes.
