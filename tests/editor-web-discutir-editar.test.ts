// =============================================================================
// El chat del editor web con «Discutir | Editar» en lugar de «Toda la landing / <la sección>» (24/10/2026)
// =============================================================================
// Martín, textual: «Tampoco pongas los botones de "toda la landing, sin titulo" pon los botones de "Discutir, editar"».
// Es el par de Automations (lib/flujo-ia-intencion.ts): EDITAR hace lo pedido; DISCUTIR contesta y sugiere SIN tocar la
// página. Lo que se fija acá:
//   1. la pantalla: el selector compartido (app/_chat/SelectorIntencion.tsx, la misma preferencia que Automations) en el
//      lugar de los chips, y «Discutir» manda por su lado;
//   2. lo puro de «Discutir» (ia-reglas.ts): las secciones numeradas con tope, el foco, la charla filtrada;
//   3. `discutir` EJECUTADO con el modelo de mentira: lo que le llega (la pregunta, la página, la charla, el foco) y que
//      devuelve texto; y `editar` con la sección del cursor como pista en «toda la landing»;
//   4. la ruta lo despacha y el registro de prompts lo tiene (el test del registro, editor-landing-ia.test.ts).
// Correr: node --import tsx --test tests/editor-web-discutir-editar.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  TOPES_DISCUTIR, charlaParaDiscutir, focoParaDiscutir, focoParaEditar, seccionesParaDiscutir, PROMPTS_EDITOR,
} from '../lib/editor-landing/ia-reglas';
import { CLAVE_INTENCION } from '../app/_chat/SelectorIntencion';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

/** Un proceso hijo con los módulos del server (react-server) y `mock.module`; su última línea es el JSON del resultado. */
function hijo(codigo: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, unknown>;
}

test('pantalla: «Discutir | Editar» en el lugar de los chips de alcance, con la preferencia de Automations', () => {
  const panel = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
  assert.doesNotMatch(panel, /Toda la landing|Toda la presentación|gma-ag-alcance|setAlcance|alcanceReal/, 'volvieron los chips de alcance');
  assert.match(panel, /<SelectorIntencion valor=\{intencion\} onCambio=\{elegirIntencion\} deshabilitado=\{hilo\.corriendo\} \/>/);
  assert.match(panel, /const \[intencion, elegirIntencion\] = useIntencion\(\);/);
  // Lo escrito: Discutir por su lado (sin tocar la página), Editar como siempre.
  assert.match(panel, /if \(intencion === 'discutir'\) void pedirDiscusion\(ctxRef\.current, texto, \{ adjuntos: paraEnviar\(items\) \}\);\s*else void pedirEdicion\(ctxRef\.current, texto, 'landing',/);
  // «Discutir» no llama a «editar» ni arma una propuesta: una burbuja de texto.
  const discusion = panel.slice(panel.indexOf('async function pedirDiscusion('), panel.indexOf('type Sugerencia ='));
  assert.ok(discusion.length > 300, 'no encontré pedirDiscusion');
  assert.match(discusion, /accion: 'discutir'/);
  assert.doesNotMatch(discusion, /accion: 'editar'|propuesta/);
  // La preferencia es la MISMA clave que Automations (quien eligió Discutir allá, lo encuentra acá).
  assert.equal(CLAVE_INTENCION, 'mako-chat-intencion');
  // Y Automations usa la MISMA pieza (24/10/2026): sin copia propia, la clave es una sola por construcción.
  assert.match(leer('app/automations/ChatMako.tsx'), /import \{ SelectorIntencion, useIntencion \} from '@\/app\/_chat\/SelectorIntencion';/);
});

test('editar: toda la landing con la sección del cursor como pista; si no entra de una vez, sólo esa sección (y lo dice)', () => {
  const panel = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
  const pedir = panel.slice(panel.indexOf('async function pedirEdicion('), panel.indexOf('const MUCHO_SIN_FOCO'));
  assert.match(pedir, /enFoco: deUna \? null : ctx\.tarjetaActiva, /, '«toda la landing» no lleva la pista del cursor');
  assert.match(pedir, /if \(!deUna && enFoco && !r\.ok && r\.error === MUCHO_PARA_EDITAR\) \{ deUna = enFoco; continue; \}/);
  assert.match(pedir, /La landing es muy larga para cambiarla entera de una vez: cambié la sección donde tienes el cursor\./);
  assert.equal((pedir.match(/pedirIA\(/g) ?? []).length, 1, 'un solo lugar llama a «editar»');
  // La ruta pasa la pista y despacha «discutir».
  const ruta = sinComentarios(leer('app/api/landing-generator/ia/route.ts'));
  assert.match(ruta, /params: body\.params, enFoco: body\.enFoco, adjuntos: body\.adjuntos \}\)\);/);
  assert.match(ruta, /case 'discutir':\s*return responder\(await discutir\(\{ pregunta: body\.pregunta, tarjetas: body\.tarjetas, enFoco: body\.enFoco, charla: body\.charla, adjuntos: body\.adjuntos \}\)\);/);
});

test('lo puro de «Discutir»: secciones numeradas con tope, el foco, y la charla filtrada (lo último, sin basura)', () => {
  assert.equal(seccionesParaDiscutir([{ texto: 'Hola  mundo\n\ncon aire' }, { texto: '' }]), 'Sección 1: Hola mundo con aire\nSección 2: (sin texto)');
  assert.equal(seccionesParaDiscutir([]), '(la página no tiene secciones)');
  const largas = seccionesParaDiscutir(Array.from({ length: 30 }, () => ({ texto: 'x'.repeat(5_000) })));
  assert.ok(largas.length <= TOPES_DISCUTIR.total + 200, `se pasó del tope: ${largas.length}`);
  assert.match(largas, /\(y \d+ secciones más\)$/, 'lo que no entra se dice, no se calla');
  assert.equal(focoParaDiscutir(-1), '');
  assert.match(focoParaDiscutir(2), /^LA PERSONA ESTÁ MIRANDO la sección 3/);
  assert.equal(focoParaEditar(-1), '');
  assert.match(focoParaEditar(0), /cursor en la sección 1[\s\S]*si la instrucción no dice a qué parte se refiere/);
  const charla = charlaParaDiscutir([
    ...Array.from({ length: 10 }, (_, i) => ({ de: i % 2 ? 'mako' : 'yo', texto: `m${i}` })),
    { de: 'pedido', texto: 'una burbuja de pedido' }, { de: 'yo', texto: '   ' }, 'basura', null,
  ]);
  assert.deepEqual(charla.split('\n'), ['La persona: m2', 'MaKo: m3', 'La persona: m4', 'MaKo: m5', 'La persona: m6', 'MaKo: m7', 'La persona: m8', 'MaKo: m9']);
  assert.equal(charlaParaDiscutir('no'), '');
  assert.ok(charlaParaDiscutir([{ de: 'yo', texto: 'y'.repeat(5_000) }]).length <= TOPES_DISCUTIR.porMensaje + 20);
  // Los prompts de Discutir están en el registro (los slots los fija editor-landing-ia.test.ts).
  assert.equal(PROMPTS_EDITOR.discutirSystem.key, 'landing_editor.discutir.system');
  assert.match(PROMPTS_EDITOR.discutirSystem.tpl, /No cambias nada/);
});

test('discutir y editar EJECUTADOS con el modelo de mentira: lo que le llega y lo que vuelve', () => {
  const r = hijo(`
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const log = { llamadas: [] };
mock.module(${url('lib/settings.ts')}, { exports: { ...real(await import(${url('lib/settings.ts')})), getSetting: async () => null } });
mock.module(${url('lib/anthropic.ts')}, { exports: { ...real(await import(${url('lib/anthropic.ts')})), chatClaude: async (sys, msgs, op) => {
  log.llamadas.push({ sys, user: msgs[0].content, motivo: op.motivo });
  if (op.motivo === 'Discutir la landing') return '« Cambiaría el título de la sección 1. »';
  return JSON.stringify({ resumen: 'Listo', tarjetas: [] });
} } });
mock.module(${url('lib/landing-writer.ts')}, { exports: { ...real(await import(${url('lib/landing-writer.ts')})), buildLandingBrief: async () => 'PERFIL DEL NEGOCIO', brandSystem: (s) => s } });
const { discutir, editar } = await import(${url('lib/editor-landing/ia.ts')});
const t = (id, texto) => ({ type: 'tarjeta', attrs: { id, diseno: 'sin', notas: '' }, content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: texto }] }] });
const d = await discutir({ pregunta: '¿Qué mejorarías?', tarjetas: [t('a', 'Hola'), t('b', 'Precios')], enFoco: 'b', charla: [{ de: 'yo', texto: 'Antes te pedí algo' }] });
const vacia = await discutir({ pregunta: '   ', tarjetas: [t('a', 'Hola')] });
const e = await editar({ instruccion: 'Mejora la escritura', tarjetas: [t('a', 'Hola'), t('b', 'Precios')], alcance: 'landing', enFoco: 'b' });
const s = await editar({ instruccion: 'Mejora la escritura', tarjetas: [t('b', 'Precios')], alcance: 'seccion', enFoco: 'b' });
console.log(JSON.stringify({ log, d, vacia, e, s }));
`) as {
    log: { llamadas: { sys: string; user: string; motivo: string }[] };
    d: { ok: boolean; respuesta?: string }; vacia: { ok: boolean; error?: string }; e: { ok: boolean }; s: { ok: boolean };
  };
  const [disc, ed, sec] = r.log.llamadas;
  assert.ok(disc && ed && sec, JSON.stringify(r).slice(0, 2_000));
  // Discutir: la pregunta, la página numerada, la sección que mira, la charla y el negocio; contesta texto limpio.
  assert.equal(disc.motivo, 'Discutir la landing');
  assert.match(disc.sys, /No cambias nada/);
  assert.match(disc.user, /¿Qué mejorarías\?/);
  assert.match(disc.user, /Sección 1: Hola\nSección 2: Precios/);
  assert.match(disc.user, /LA PERSONA ESTÁ MIRANDO la sección 2/);
  assert.match(disc.user, /LA CHARLA HASTA AHORA[\s\S]*La persona: Antes te pedí algo/);
  assert.match(disc.user, /PERFIL DEL NEGOCIO/);
  assert.deepEqual(r.d, { ok: true, respuesta: 'Cambiaría el título de la sección 1.' });
  assert.equal(r.vacia.ok, false, 'sin pregunta no se llama al modelo');
  // Editar «toda la landing» lleva la pista del cursor; «una sección», no (ya es ésa).
  assert.match(ed.user, /cursor en la sección 2/);
  assert.doesNotMatch(sec.user, /cursor en la sección/);
  assert.equal(r.log.llamadas.length, 3);
});
