// =============================================================================
// Los prompts del escritor de Instagram, EDITABLES desde /configuraciones (6/11/2026)
// =============================================================================
// Items 26, 129 y 197 del barrido del 6/11: «las instrucciones de carruseles y stories están
// fijas y no se pueden tocar». Lo que se fija acá NO es que los strings existan, sino que una
// EDICIÓN DEL USUARIO cambie lo que se le manda al modelo:
//
//   1. `generarPieza` EJECUTADO con el modelo de mentira: sin nada editado le llega el
//      default; después de guardar un override POR LA MISMA PUERTA QUE LA UI
//      (`savePromptByKey`, lo que hace el POST de /api/mako/config-prompts), le llega el
//      texto editado y NO el default.
//   2. Lo mismo con la metodología, que es el bloque que de verdad dice cómo se escribe un
//      carrusel: se edita `ig.metodologia.carrusel` y el system que sale lleva lo editado.
//   3. Que `metodologiaIgVigente` sin overrides devuelva EXACTAMENTE `metodologiaDe`: el
//      orden de los dos bloques vive en una sola función (`componerMetodologia`) justamente
//      para que no driftee, y nada más que un test lo nota.
//   4. Que no quede ningún call site MUDO: los dos caminos vivos (el motor y el Copywriter)
//      leen la metodología vigente, no la constante.
//   5. El cableado del registro que el compilador no ve: las keys son las MISMAS constantes
//      que usa el call site, los defaults son los mismos textos, y los slots declarados en
//      el registro son exactamente los `{{...}}` del template.
//
// El molde del proceso hijo (react-server + `mock.module`) es tests/editor-web-discutir-editar.ts.
// Correr: node --import tsx --test tests/ig-writer-prompts.test.ts
//
// ⚠️ PROBADO ROMPIENDO CADA PIEZA (6/11/2026): ver el comentario arriba de cada test con la
// rotura y cuántos rojos dio.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  componerMetodologia, metodologiaDe,
  METODOLOGIA_POR_FORMATO, METODOLOGIA_TRANSVERSAL, FORMATOS_IG,
} from '../lib/ig-formatos';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

/** Un proceso hijo con los módulos del server (react-server) y `mock.module`; su última línea es el JSON del resultado. */
function hijo(codigo: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, unknown>;
}

/**
 * El preámbulo de un hijo que ejecuta el motor de verdad:
 *   · `lib/settings.ts` con un app_settings EN MEMORIA → el override se guarda y se lee por
 *     el camino real (lib/prompt-render.ts), no simulado;
 *   · `lib/workspace.ts` con un ws fijo (el motor lo verifica en positivo);
 *   · `lib/anthropic.ts` capturando lo que se le manda al modelo y devolviendo una pieza válida;
 *   · `lib/campaign-structurer.ts` con `brandSystem` identidad (así el system que se afirma es
 *     el template y nada más) y el `parseJsonObject` de verdad;
 *   · el brief del negocio en seco (sin base): el motor ya lo degrada, acá se fija su texto.
 */
const PREAMBULO = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const base = new Map();
const log = { llamadas: [] };
mock.module(${url('lib/settings.ts')}, { exports: { ...real(await import(${url('lib/settings.ts')})),
  getSetting: async (k) => base.get(k) ?? null,
  setSetting: async (k, v) => { base.set(k, v); },
} });
mock.module(${url('lib/workspace.ts')}, { exports: { ...real(await import(${url('lib/workspace.ts')})), getWorkspaceActual: async () => 9 } });
mock.module(${url('lib/anthropic.ts')}, { exports: { ...real(await import(${url('lib/anthropic.ts')})), chatClaude: async (sys, msgs, op) => {
  log.llamadas.push({ sys, user: msgs[0].content, feature: op.feature });
  return JSON.stringify({
    idea: 'La idea del día', objetivo: 'responder la story',
    slides: [{ texto: 'a', visual: 'plano 1' }, { texto: 'b', visual: 'plano 2' }],
    frames: [{ tipo: 'selfie', texto: 'uno', indicacion: 'x' }, { tipo: 'pov', texto: 'dos', indicacion: 'y' }, { tipo: 'layout', texto: 'tres', indicacion: 'z' }],
    cta: 'Responde LISTO', palabraClave: 'LISTO', caption: 'corta',
  });
} } });
const cs = await import(${url('lib/campaign-structurer.ts')});
mock.module(${url('lib/campaign-structurer.ts')}, { exports: { ...real(cs), brandSystem: async (s) => s } });
mock.module(${url('lib/funnels.ts')}, { exports: { ...real(await import(${url('lib/funnels.ts')})), getFunnelDefault: async () => { throw new Error('sin base'); } } });
mock.module(${url('lib/onboarding.ts')}, { exports: { ...real(await import(${url('lib/onboarding.ts')})), perfilNegocioTexto: async () => 'Vende mentorías' } });
mock.module(${url('lib/mako-knowledge.ts')}, { exports: { ...real(await import(${url('lib/mako-knowledge.ts')})), searchKnowledge: async () => [] } });
const { generarPieza } = await import(${url('lib/ig-writer.ts')});
const { savePromptByKey, resetPromptByKey } = await import(${url('lib/prompt-registry.ts')});
`;

// rotura (renderPrompt → renderTemplate en el system de generarPieza): 1 fallo, 4 pases.
// rotura (la key del render 'ig.writer.systemX' y la del registro intactas): 1 fallo, 4 pases.
// rotura (savePromptOverride guardando sin pasar por el store): 1 fallo, 4 pases.
test('una edición del usuario REALMENTE cambia lo que se le manda al modelo (system y user del motor)', () => {
  const r = hijo(`${PREAMBULO}
const antes = await generarPieza(9, 'carrusel', 'un carrusel sobre precios');
await savePromptByKey('ig.writer.system', 'SOY OTRO ESCRITOR. Escribe {{formato}}.\\n\\nMETODO:\\n{{metodologia}}\\n\\n{{jsonShape}}');
await savePromptByKey('ig.writer.user', 'OTRO PEDIDO: {{pedido}}\\n---\\n{{contexto}}');
const despues = await generarPieza(9, 'carrusel', 'un carrusel sobre precios');
await resetPromptByKey('ig.writer.system');
const vuelta = await generarPieza(9, 'carrusel', 'un carrusel sobre precios');
console.log(JSON.stringify({ log, ok: [antes.ok, despues.ok, vuelta.ok] }));
`) as { log: { llamadas: { sys: string; user: string; feature: string }[] }; ok: boolean[] };

  assert.deepEqual(r.ok, [true, true, true], 'las tres piezas tienen que salir');
  const [antes, despues, vuelta] = r.log.llamadas;
  assert.ok(antes && despues && vuelta, JSON.stringify(r).slice(0, 2_000));

  // Sin nada editado: el default, con los slots rellenos.
  assert.match(antes.sys, /Eres MaKo y estás escribiendo un CARRUSEL de Instagram ORGÁNICO/);
  assert.match(antes.sys, /IDIOMA DEL COPY/);
  assert.match(antes.user, /PEDIDO DEL USUARIO:/);
  assert.equal(antes.feature, 'carousels-writer');

  // Después de editar: lo editado, y el default YA NO está.
  assert.match(despues.sys, /^SOY OTRO ESCRITOR\. Escribe un CARRUSEL\./);
  assert.doesNotMatch(despues.sys, /Eres MaKo y estás escribiendo/);
  assert.doesNotMatch(despues.sys, /IDIOMA DEL COPY/);
  assert.match(despues.user, /^OTRO PEDIDO: /);
  assert.doesNotMatch(despues.user, /PEDIDO DEL USUARIO:/);
  // Y los slots del texto editado se rellenan igual (metodología y contrato JSON adentro).
  assert.match(despues.sys, /AVISO DE COBERTURA/);
  assert.match(despues.sys, /"slides"/);
  assert.match(despues.user, /un carrusel sobre precios/);
  assert.match(despues.user, /Vende mentorías/);
  assert.doesNotMatch(despues.sys, /\{\{/, 'quedó un slot sin rellenar');

  // «Volver al default» vuelve de verdad: el user sigue editado, el system no.
  assert.match(vuelta.sys, /Eres MaKo y estás escribiendo un CARRUSEL/);
  assert.match(vuelta.user, /^OTRO PEDIDO: /);
});

// rotura (metodologiaDe en vez de metodologiaIgVigente en generarPieza): 1 fallo, 4 pases.
// rotura (la key 'ig.metodologia.carrusel' cambiada sólo en PROMPTS_METODOLOGIA_IG): 1 fallo, 4 pases.
test('la metodología de carrusel y de stories también se edita, y cada formato lee la suya', () => {
  const r = hijo(`${PREAMBULO}
await savePromptByKey('ig.metodologia.carrusel', 'MI DOCTRINA DE CARRUSEL: tres slides y listo.');
await savePromptByKey('ig.metodologia.transversal', 'MIS PRINCIPIOS: hablar claro.');
const carr = await generarPieza(9, 'carrusel', 'tema');
const story = await generarPieza(9, 'story', 'tema');
console.log(JSON.stringify({ log, ok: [carr.ok, story.ok] }));
`) as { log: { llamadas: { sys: string }[] }; ok: boolean[] };

  assert.deepEqual(r.ok, [true, true]);
  const [carr, story] = r.log.llamadas;
  assert.ok(carr && story, JSON.stringify(r).slice(0, 2_000));

  // El carrusel: su metodología editada + la transversal editada, y NADA del default.
  assert.match(carr.sys, /MI DOCTRINA DE CARRUSEL: tres slides y listo\.\n\nMIS PRINCIPIOS: hablar claro\./);
  assert.doesNotMatch(carr.sys, /AVISO DE COBERTURA/);
  assert.doesNotMatch(carr.sys, /PRINCIPIOS QUE REPITEN LOS TRES CURSOS/);
  // Stories: la transversal editada (es compartida) pero su propia metodología INTACTA.
  assert.match(story.sys, /MIS PRINCIPIOS: hablar claro\./);
  assert.match(story.sys, /ROL EN EL EMBUDO/);
  assert.doesNotMatch(story.sys, /MI DOCTRINA DE CARRUSEL/);
});

// rotura (componerMetodologia con la transversal primero): 1 fallo, 4 pases.
test('sin nada editado, la metodología vigente es EXACTAMENTE el default (mismo orden, mismo separador)', () => {
  const r = hijo(`${PREAMBULO}
const { metodologiaIgVigente } = await import(${url('lib/ig-metodologia.ts')});
const { metodologiaDe } = await import(${url('lib/ig-formatos.ts')});
const iguales = {};
for (const f of ['reel', 'carrusel', 'story']) iguales[f] = (await metodologiaIgVigente(f)) === metodologiaDe(f);
console.log(JSON.stringify({ iguales }));
`) as { iguales: Record<string, boolean> };
  assert.deepEqual(r.iguales, { reel: true, carrusel: true, story: true });

  // Y el orden que fija la función compartida: primero la del formato, después la transversal.
  for (const f of FORMATOS_IG) {
    assert.equal(metodologiaDe(f), componerMetodologia(METODOLOGIA_POR_FORMATO[f], METODOLOGIA_TRANSVERSAL));
  }
});

// rotura (volver copywriter/ia.ts a metodologiaDe): 1 fallo, 4 pases.
test('ningún call site vivo se queda con la constante: el motor y el Copywriter leen la vigente', () => {
  const writer = sinComentarios(leer('lib/ig-writer.ts'));
  assert.match(writer, /metodologiaIgVigente\(formato\)/);
  assert.doesNotMatch(writer, /metodologiaDe\(/, 'el motor volvió a la metodología hardcodeada');
  assert.doesNotMatch(writer, /renderTemplate\(/, 'el motor volvió a renderTemplate (ignora lo editado)');
  assert.match(writer, /renderPrompt\(PROMPTS_IG\.system\.key, PROMPTS_IG\.system\.tpl/);
  assert.match(writer, /renderPrompt\(PROMPTS_IG\.user\.key, PROMPTS_IG\.user\.tpl/);

  // El Copywriter: la vigente, con el default SÓLO como respaldo de una lectura caída.
  const copy = sinComentarios(leer('lib/copywriter/ia.ts'));
  assert.match(copy, /await metodologiaIgVigente\(g\.props\.tipo\)\.catch\(\(\) => metodologiaDe\(/);

  // Y nadie más: el único uso restante de la constante es el respaldo del Copywriter (el
  // default vive en lib/ig-formatos.ts, que es de donde sale).
  const usos: Record<string, number> = {};
  for (const r of ['lib/ig-writer.ts', 'lib/copywriter/ia.ts', 'lib/ig-metodologia.ts']) {
    usos[r] = [...sinComentarios(leer(r)).matchAll(/metodologiaDe\(/g)].length;
  }
  assert.deepEqual(usos, {
    'lib/ig-writer.ts': 0, 'lib/copywriter/ia.ts': 1, 'lib/ig-metodologia.ts': 0,
  });
});

// rotura (un slot v('metodologiaX') en el registro): 1 fallo, 4 pases.
// rotura (default: IG_WRITER_USER_TEMPLATE en la entry del system): 1 fallo, 4 pases.
test('el registro: las keys, los defaults y los slots son los MISMOS que usa el call site', () => {
  const reg = sinComentarios(leer('lib/prompt-registry.ts'));
  // Los defaults entran por la constante compartida, nunca por una copia del texto.
  assert.match(reg, /import \{ PROMPTS_IG \} from '\.\/ig-writer';/);
  assert.match(reg, /import \{ PROMPTS_METODOLOGIA_IG \} from '\.\/ig-metodologia';/);
  for (const [k, d] of [
    ['PROMPTS_IG.system', 'PROMPTS_IG.system.tpl'],
    ['PROMPTS_IG.user', 'PROMPTS_IG.user.tpl'],
    ['PROMPTS_METODOLOGIA_IG.transversal', 'PROMPTS_METODOLOGIA_IG.transversal.tpl'],
    ['PROMPTS_METODOLOGIA_IG.reel', 'PROMPTS_METODOLOGIA_IG.reel.tpl'],
    ['PROMPTS_METODOLOGIA_IG.carrusel', 'PROMPTS_METODOLOGIA_IG.carrusel.tpl'],
    ['PROMPTS_METODOLOGIA_IG.story', 'PROMPTS_METODOLOGIA_IG.story.tpl'],
  ] as const) {
    const i = reg.indexOf(`key: ${k}.key,`);
    assert.ok(i >= 0, `la entry de ${k} no está en el registro`);
    assert.ok(reg.slice(i, i + 1_400).includes(`default: ${d},`), `la entry de ${k} no tiene como default ${d}`);
  }

  // Los slots declarados == los {{...}} del template DE VERDAD (leído de la constante en un
  // hijo, porque lib/ig-writer.ts es server-only). Lo que el registro declara es lo que la UI
  // le muestra al usuario: un slot de más es una promesa que no se cumple, y uno de menos es
  // un slot que el usuario borra sin saber que lo necesitaba.
  const declarados = (k: string) => {
    const i = reg.indexOf(`key: ${k}.key,`);
    assert.ok(i >= 0, `la entry de ${k} no está en el registro`);
    const trozo = reg.slice(i, i + 1_400);
    return [...new Set([...trozo.slice(0, trozo.indexOf('scope:')).matchAll(/v\('(\w+)'/g)].map((m) => m[1]!))].sort();
  };
  const r = hijo(`
const { PROMPTS_IG } = await import(${url('lib/ig-writer.ts')});
const slots = (t) => [...new Set([...t.matchAll(/\\{\\{(\\w+)\\}\\}/g)].map((m) => m[1]))].sort();
console.log(JSON.stringify({ system: slots(PROMPTS_IG.system.tpl), user: slots(PROMPTS_IG.user.tpl) }));
`) as { system: string[]; user: string[] };
  assert.deepEqual(r.system, ['formato', 'jsonShape', 'metodologia']);
  assert.deepEqual(r.user, ['contexto', 'pedido']);
  assert.deepEqual(declarados('PROMPTS_IG.system'), r.system);
  assert.deepEqual(declarados('PROMPTS_IG.user'), r.user);

  // Los bloques de metodología son texto, sin slots: ni los declara el registro ni los tiene
  // el texto (un {{algo}} ahí quedaría a la vista del modelo, sin rellenar).
  const slotsDe = (tpl: string) => [...new Set([...tpl.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!))].sort();
  for (const f of FORMATOS_IG) {
    assert.deepEqual(slotsDe(METODOLOGIA_POR_FORMATO[f]), [], `la metodología de ${f} trae un {{slot}} que nadie rellena`);
    assert.deepEqual(declarados(`PROMPTS_METODOLOGIA_IG.${f}`), []);
  }
  assert.deepEqual(slotsDe(METODOLOGIA_TRANSVERSAL), []);
  assert.deepEqual(declarados('PROMPTS_METODOLOGIA_IG.transversal'), []);
});
