// =============================================================================
// #852: «Probar en el grupo» — una automatización que SÓLO le habla al grupo de MaKo se prueba ahí, de verdad
// =============================================================================
// Martín en la revisión del 16/10/2026 (44:06): «todavía no se envían las pruebas al grupo de MaKo… si la automatización
// no tiene ningún mensaje a clientes, solamente tiene mensajes al grupo de MaKo… que se pueda probar en el grupo de MaKo».
// Y Joan, un minuto antes: «¿pero por qué me piden un remitente?». Lo que fija este test:
//   1. cuándo es «sólo al grupo» (`soloAlGrupo`): una tarjeta al grupo y ningún mensaje al lead, ni un AI Step;
//   2. el envío DE VERDAD (lib/probar-grupo-envio.ts, en un node aparte con la base y WhatsApp de mentira): el encabezado de
//      prueba primero, las partes validadas como las de la tarjeta, sólo una automatización del negocio, y «sin grupo»
//      dicho como tal;
//   3. el cableado: la ruta sólo para el admin y con tope; el panel sin «De» ni «Para», y nunca en una fila de SuperAdmin.
//
// Probado rompiéndolo (17/10/2026, arnés `romper.py` + `roturas-852.json` del scratchpad, md5 igual al restaurar; base
// 4 / 4): `soloAlGrupo` sin mirar los mensajes al lead → 3 / 1 (cae el 1); sin el encabezado → 3 / 1 (el 2); la ruta sin
// el corte del admin → 3 / 1 (el 4); el panel ofreciendo el grupo también en una fila de SuperAdmin → 3 / 1 (el 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { soloAlGrupo, partesDeBurbujas, ENCABEZADO_PRUEBA, PROBAR_EN_EL_GRUPO } from '../lib/probar-grupo';
import type { PasoGrafo } from '../lib/flujo-grafo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string): string => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
function hijo(codigo: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, unknown>;
}

const RELLENO = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial' } as const;
const mako = (id: string, params: Record<string, unknown> = {}): PasoGrafo =>
  ({ ...RELLENO, id, siguiente: null, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje: 'Hola', partes: [{ tipo: 'texto', cuerpo: 'Hola' }], ...params } } }) as PasoGrafo;
const wa = (id: string): PasoGrafo => ({ ...RELLENO, id, siguiente: null, cuerpo: 'Hola {{nombre}}' }) as PasoGrafo;
const esperar = (id: string): PasoGrafo => ({ ...RELLENO, id, nodo: 'esperar', espera: { modo: 'tiempo', minutos: 5 }, siguiente: null }) as PasoGrafo;
const aiStep = (id: string): PasoGrafo => ({ ...RELLENO, id, nodo: 'respuesta', paso_ia: true, siguiente: null }) as PasoGrafo;

test('1. «sólo al grupo»: una tarjeta al grupo y ningún mensaje al lead', () => {
  assert.equal(soloAlGrupo([mako('m1')]), true, 'la de Joan: «Llegó un nuevo propietario…» al grupo');
  assert.equal(soloAlGrupo([esperar('e1'), mako('m1')]), true, 'una espera no le habla a nadie');
  assert.equal(soloAlGrupo([mako('m1'), wa('w1')]), false, 'con un WhatsApp al lead sigue «Probar en WhatsApp»');
  assert.equal(soloAlGrupo([mako('m1'), aiStep('ai')]), false, 'un AI Step le contesta al lead');
  assert.equal(soloAlGrupo([mako('m1', { canal: 'email', asunto: 'A' })]), false, 'la de email no le escribe al grupo');
  assert.equal(soloAlGrupo([wa('w1')]), false);
  assert.equal(PROBAR_EN_EL_GRUPO, 'Probar en el grupo');
  assert.deepEqual(partesDeBurbujas([
    { tipo: 'texto', texto: 'Llegó Ana' }, { tipo: 'texto', texto: '  ' }, { tipo: 'audio', audioId: 3 }, { tipo: 'media', mediaId: 9, caption: '' },
  ]), [{ tipo: 'texto', cuerpo: 'Llegó Ana' }, { tipo: 'audio', audio_id: 3 }, { tipo: 'media', media_id: 9 }]);
  assert.equal(ENCABEZADO_PRUEBA('Un Lead Entró', 'Caso 1'), '🧪 Prueba de «Un Lead Entró» · Caso 1. No es un lead real.');
});

const HIJO = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const log = { envios: [] };
let fila = { id: 266, nombre: 'Un Lead Entró 2' }; let sinGrupo = false; let problema = null;
const ws = await import(${url('lib/workspace.ts')});
const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fila, error: null }) }) }) }) };
mock.module(${url('lib/workspace.ts')}, { exports: { ...real(ws), getTenantDb: async () => db } });
mock.module(${url('lib/mako-tarjeta-envio.ts')}, { exports: { ...real(await import(${url('lib/mako-tarjeta-envio.ts')})),
  problemaDePartesGrupo: async () => problema,
  prepararPartesGrupo: async (lista, r) => ({ ok: true, partes: await Promise.all(lista.map(async (p) => (p.tipo === 'texto' ? { tipo: 'texto', texto: await r(p.cuerpo) } : { tipo: 'audio', base64: 'QUJD', mime: 'audio/mpeg' }))) }),
} });
mock.module(${url('lib/mako-grupo.ts')}, { exports: { ...real(await import(${url('lib/mako-grupo.ts')})),
  enviarPartesAlGrupoMaKo: async (w, partes) => { log.envios.push({ w, partes }); return sinGrupo ? { ok: false, salieron: 0, ids: [], error: 'x', sinGrupo: true } : { ok: true, salieron: partes.length, ids: ['W1'] }; },
} });
const { enviarPruebaAlGrupo } = await import(${url('lib/probar-grupo-envio.ts')});
const out = {};
out.bien = await enviarPruebaAlGrupo({ ws: 15, secuenciaId: 266, partes: [{ tipo: 'texto', cuerpo: 'Llegó Ana Pérez' }, { tipo: 'audio', audio_id: 31 }], caso: 'Caso 1' });
out.enviado = JSON.parse(JSON.stringify(log.envios[0]));
sinGrupo = true; out.sinGrupo = await enviarPruebaAlGrupo({ ws: 15, secuenciaId: 266, partes: [{ tipo: 'texto', cuerpo: 'x' }], caso: null }); sinGrupo = false;
problema = 'Ese audio no es la Voz de MaKo.'; out.ajena = await enviarPruebaAlGrupo({ ws: 15, secuenciaId: 266, partes: [{ tipo: 'audio', audio_id: 7 }], caso: null }); problema = null;
fila = null; out.otra = await enviarPruebaAlGrupo({ ws: 15, secuenciaId: 999, partes: [{ tipo: 'texto', cuerpo: 'x' }], caso: null }); fila = { id: 266, nombre: 'x' };
out.vacia = await enviarPruebaAlGrupo({ ws: 15, secuenciaId: 266, partes: [], caso: null });
out.total = log.envios.length;
console.log(JSON.stringify(out));
`;

test('2. el envío de verdad: primero el encabezado de prueba, las partes validadas, sólo lo del negocio, y «sin grupo» dicho', () => {
  const o = hijo(HIJO) as Record<string, any>;
  assert.deepEqual(o.bien, { ok: true, salieron: 3 });
  assert.equal(o.enviado.w, 15);
  assert.equal(o.enviado.partes[0].texto, '🧪 Prueba de «Un Lead Entró 2» · Caso 1. No es un lead real.', 'el equipo saldría a buscar a un lead que no existe');
  assert.equal(o.enviado.partes[1].texto, 'Llegó Ana Pérez');
  assert.equal(o.enviado.partes[2].tipo, 'audio');
  assert.deepEqual(o.sinGrupo, { ok: false, error: 'Este negocio no tiene grupo de MaKo.' });
  assert.deepEqual(o.ajena, { ok: false, error: 'Ese audio no es la Voz de MaKo.' }, 'un audio que no es la Voz de MaKo suplantaría al dueño');
  assert.deepEqual(o.otra, { ok: false, error: 'Esa automatización no es de este negocio.' });
  assert.equal(o.vacia.ok, false);
  assert.equal(o.total, 2, 'sólo salen los dos que pasan las guardas');
});

test('3. el panel: sin «De» ni «Para», con la línea de MaKo al grupo, y lo de siempre cuando hay un mensaje al lead', () => {
  const panel = leer('app/automations/PanelProbar.tsx');
  assert.match(panel, /const enElGrupo = conGrupo && soloAlGrupo\(flujoVivo\) && triggerProbado !== TRIGGER_AVISO_MAKO;/);
  assert.match(panel, /\{rolAdmin && !real && !social && enElGrupo && \(\s*<Button size="sm" data-probar-en-el-grupo onClick=\{\(\) => \{ cerrarMenu\(\); if \(!frenado\(\)\) reiniciar\(true\); \}\}>\{PROBAR_EN_EL_GRUPO\}<\/Button>/);
  assert.match(panel, /\{rolAdmin && !real && !social && !enElGrupo && \(sinConectar/, '«Probar en WhatsApp» con su remitente queda para el resto');
  assert.match(panel, /postar\(\{ action: 'enviar-grupo', secuenciaId: c\.secuenciaId, partes, caso \}\)/);
});

test('4. la ruta: sólo el admin, con tope por negocio', () => {
  const ruta = leer('app/api/chat-agent/simulador/route.ts');
  const i = ruta.indexOf("if (body.action === 'enviar-grupo') {");
  assert.ok(i > 0);
  const b = ruta.slice(i, ruta.indexOf('\n    }\n', i));
  assert.match(b, /if \(a\.rol !== 'admin'\) return json\(\{ ok: false, error: 'Solo el admin prueba de verdad\.' \}, 403\);/, 'un setter le escribiría al grupo del equipo');
  assert.match(b, /rateLimit\(`probar-grupo:\$\{a\.ws\}`, 12, 10 \* 60_000\)/);
  assert.match(b, /enviarPruebaAlGrupo\(\{ ws: a\.ws, secuenciaId: Number\(body\.secuenciaId\), partes: body\.partes, caso: body\.caso \}\)/);
});
