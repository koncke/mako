// =============================================================================
// #869: los links de un WhatsApp, con o sin la vista previa (17/10/2026)
// =============================================================================
// Mauricio (Fathom 863534245, 17:09): «es más discreto en el WhatsApp, porque a la gente también le molesta»; a Raúl le
// llegó una tarjeta gigante con la marca de otro. Martín (16:45): «para que cuando se mande un link, se mande con la
// previsualización o sin la previsualización». Cada WhatsApp no oficial tiene «Vista previa del link» (sólo si lleva un
// link); apagada, el paso guarda `sin_vista_previa: true` y Evolution recibe `linkPreview: false`. Lo honran el motor
// (lo que sale y el BORRADOR que espera al setter, mig 0309), «Si responde» y las dos pruebas.
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-869.json`; base 5 / 0). Pasan / fallan:
//   V1 `vistaPreviaAlGuardar` sin conservar la de antes (un escritor sin la clave la borra)   → 4 / 1
//   V2 `enviarTexto` sin mandar `linkPreview: false`                                          → 4 / 1
//   V3 `crearBorrador` sin el reintento sin la marca (sin la columna, el borrador se pierde)  → 4 / 1
//   V4 el motor sin pasarle la marca al texto que sale solo                                    → 4 / 1
//   V5 la prueba real sin la marca (`sanearMensajePrueba` la tira)                            → 4 / 1
//   V6 la API la cambia sin la clave (volver a prenderla no haría nada)                       → 4 / 1
//
// Correr: node --import tsx --test tests/whatsapp-sin-vista-previa.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { sinVistaPrevia, vistaPreviaAlGuardar, tieneLink } from '../lib/mensaje-partes';
import { sanearMensajePrueba } from '../lib/simulador-grafo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string): string => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
const WA = { canal: 'whatsapp', proveedor: 'no_oficial' } as const;

test('la marca es del paso, sólo de un WhatsApp no oficial, y sobrevive a un escritor que no la conoce', () => {
  assert.equal(sinVistaPrevia({ ...WA, sin_vista_previa: true }), true);
  assert.equal(sinVistaPrevia({ ...WA }), false, 'sin el campo, con la tarjeta (lo de siempre)');
  assert.equal(sinVistaPrevia({ canal: 'email', sin_vista_previa: true }), false);
  assert.equal(sinVistaPrevia({ canal: 'whatsapp', proveedor: 'oficial', sin_vista_previa: true }), false, 'el oficial es una plantilla de Meta');
  // Con la clave manda lo que llega; sin la clave (la API, el generador), la de antes.
  assert.deepEqual(vistaPreviaAlGuardar({ ...WA, sin_vista_previa: true }, null), { sin_vista_previa: true });
  assert.deepEqual(vistaPreviaAlGuardar({ ...WA, sin_vista_previa: false }, { ...WA, sin_vista_previa: true }), {}, 'volver a prenderla');
  assert.deepEqual(vistaPreviaAlGuardar({ ...WA }, { ...WA, sin_vista_previa: true }), { sin_vista_previa: true }, 'un escritor sin la clave la borró');
  assert.deepEqual(vistaPreviaAlGuardar({ canal: 'email' }, { ...WA, sin_vista_previa: true }), {});
});

test('la opción aparece sólo con un link en un texto: escrito o un dato que es un link', () => {
  assert.equal(tieneLink({ ...WA, cuerpo: 'Mira esto: https://hola-mako.com/x' }), true);
  assert.equal(tieneLink({ ...WA, cuerpo: 'Entra a www.elevate.com.mx' }), true);
  assert.equal(tieneLink({ ...WA, cuerpo: 'Tu llamada: {{reunion_link}}' }), true);
  assert.equal(tieneLink({ ...WA, cuerpo: 'Hola {{nombre}}, ¿cómo vas?' }), false);
  assert.equal(tieneLink({ ...WA, cuerpo: 'Hola', partes: [{ tipo: 'texto', cuerpo: 'Hola' }, { tipo: 'texto', cuerpo: 'El curso: https://x.com' }] }), true);
});

test('el envío: `linkPreview: false` a Evolution, en lo que sale solo, en el borrador y en las pruebas', () => {
  const evo = leer('lib/evolution.ts');
  assert.match(evo, /body: JSON\.stringify\(\{ number: num, text: texto, delay, \.\.\.\(opts\.sinVistaPrevia \? \{ linkPreview: false \} : \{\}\) \}\)/);
  const envio = leer('lib/evolution-envio.ts');
  assert.match(envio, /await enviarTexto\(params\.telefono, params\.texto, params\.linea, \{ sinVistaPrevia: params\.sinVistaPrevia \}\)/);
  // El borrador: la marca se lee APARTE del claim (pedirla ahí sin la columna frenaría todo borrador).
  assert.doesNotMatch(envio, /\.select\('id, telefono, texto, lead_id, chat_jid, instance_name, audio_id, adjunto_id, sin_vista_previa'\)/);
  assert.match(envio, /sinVistaPrevia: await borradorSinVistaPrevia\(supabase, b\.id\)/);
  const nut = leer('lib/nutricion.ts');
  assert.match(nut, /const sinTarjeta = sinVistaPrevia\(paso\);/);
  assert.match(nut, /const r = await enviarYEspejar\(\{ telefono: lead\.telefono, texto: t\.texto, leadId: lead\.id, linea: lineaSec, sinVistaPrevia: sinTarjeta \}\);/);
  assert.match(nut, /partes: partesMulti, desde: partesSalidas, telefono: lead\.telefono, leadId: lead\.id, linea: lineaSec, vars: varsNO, sinVistaPrevia: sinTarjeta \}/);
  assert.match(nut, /r = await enviarYEspejar\(\{ telefono: a\.telefono, texto: t, leadId: a\.leadId, linea: a\.linea, sinVistaPrevia: a\.sinVistaPrevia \}\);/);
  assert.equal((nut.match(/linea: lineaSec, sinVistaPrevia: sinTarjeta/g) ?? []).length >= 4, true, 'algún borrador o envío del motor sin la marca');
  assert.match(nut, /const r = await enviarYEspejar\(\{ telefono: lead\.telefono, texto: pie, leadId, linea, sinVistaPrevia: sinVistaPrevia\(p\) \}\);/, '«Si responde» sin la marca');
  assert.match(nut, /\.\.\.vistaPreviaAlGuardar\(p, antes\.find\(/, 'guardar la tira');
  // Las pruebas salen como al lead.
  const prueba = sanearMensajePrueba({ canal: 'whatsapp', tipo: 'texto', texto: 'https://x.com', sin_vista_previa: true });
  assert.equal(prueba?.sin_vista_previa, true);
  assert.equal(sanearMensajePrueba({ canal: 'email', tipo: 'texto', texto: 'x', sin_vista_previa: true })?.sin_vista_previa, undefined);
  assert.match(leer('lib/prueba-paso.ts'), /sinVistaPrevia: mensaje\.sin_vista_previa === true/);
  assert.match(leer('lib/setting-secuencias.ts'), /linea: lineaSec, sinVistaPrevia: sinVistaPrevia\(paso\) \}\);/);
  assert.match(leer('app/automations/PanelProbar.tsx'), /mandarReal\(\{ canal: 'whatsapp', tipo: 'texto', texto, \.\.\.\(sinTarjeta \? \{ sin_vista_previa: true \} : \{\}\) \}, clave, enRespuesta\);/);
  // La tarjeta: el interruptor, sólo con un link.
  assert.match(leer('app/automations/FlujoLienzo.tsx'), /\{noOficial && !recordatorio && \(tieneLink\(paso\) \|\| sinVistaPrevia\(paso\)\) && \(/);
});

// El borrador NUNCA se pierde: sin la columna (la 0309 sin aplicar) se escribe sin la marca.
const HIJO = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const escritas = [];
const db = { from: () => ({
  upsert: async (f) => { escritas.push(f); return 'sin_vista_previa' in f ? { error: { code: '42703', message: 'column "sin_vista_previa" does not exist' } } : { error: null }; },
  insert: async (f) => { escritas.push(f); return { error: null }; },
}) };
const ws = await import(${url('lib/workspace.ts')});
mock.module(${url('lib/workspace.ts')}, { exports: { ...real(ws), getTenantDb: async () => db } });
const { crearBorrador } = await import(${url('lib/evolution-envio.ts')});
await crearBorrador({ leadId: 1, telefono: '+52 1', texto: 'https://x.com', secuenciaId: 2, paso: 1, inscripcionId: 3, sinVistaPrevia: true });
console.log(JSON.stringify({ escritas }));
`;

test('sin la columna, el borrador se escribe igual (con la tarjeta): nunca se pierde', () => {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', HIJO,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const { escritas } = JSON.parse(out.trim().split('\n').pop()!) as { escritas: Array<Record<string, unknown>> };
  assert.equal(escritas.length, 2, JSON.stringify(escritas));
  assert.equal(escritas[0]!.sin_vista_previa, true);
  assert.equal('sin_vista_previa' in escritas[1]!, false);
  assert.equal(escritas[1]!.texto, 'https://x.com');
});

test('MaKo también lo cambia (la API: `vista_previa_links_paso`), siempre con la clave', () => {
  const def = leer('lib/api-mako/areas/chatbot.def.ts');
  assert.match(def, /id: 'vista_previa_links_paso', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',/);
  const run = leer('lib/api-mako/areas/chatbot.run.ts');
  const i = run.indexOf('  vista_previa_links_paso: {');
  assert.ok(i > 0);
  const bloque = run.slice(i, run.indexOf('\n  },\n', i));
  assert.match(bloque, /if \(p\.canal !== 'whatsapp' \|\| proveedorDelPaso\(p\) !== 'no_oficial'\) return \{ error:/);
  // Sin la clave, `vistaPreviaAlGuardar` conservaría la de antes: volver a prenderla no haría nada.
  assert.match(bloque, /\{ \.\.\.p, sin_vista_previa: !conTarjeta \}/);
});
