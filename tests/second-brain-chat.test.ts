// =============================================================================
// El Second Brain como chat: las dos puertas, en el SERVIDOR (16/10/2026)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md: /second-brain es el chat con MaKo de todos los que tienen MaKo (closer y
// setter incluidos), y el Mapa (el grafo, las áreas, la skill de Claude con su token) es sólo del admin con la tab en
// su capa. Lo que se fija, sobre la forma del código (un corte por rol se escribe en el servidor: AGENTS.md):
//   · la página entra con la puerta de MaKo y calcula el Mapa SÓLO adentro de `veMapa` (lo que no se ve no viaja);
//   · `veMapa` sale de la MISMA puerta de las rutas del Second Brain (`soloAdminDeTab`), no de una copia;
//   · la ruta del chat pide la persona ADENTRO de cada handler, aguanta lo que dura un turno, no lee el `?ws=` crudo y
//     no llama a Claude por su cuenta (el crédito de Claude de la plataforma es sólo del onboarding).
//
// ⚠️ Probado ROMPIÉNDOLO (16/10/2026), contra la base en verde de 3 pases (4 con el del índice):
//   · construyendo el cerebro fuera del `if (veMapa…)` → 1 fallo («la página»);
//   · `veMapa` con un `rol === 'admin'` a mano → 1 fallo («la página»);
//   · el POST de la ruta leyendo el cuerpo antes de la persona → 1 fallo («la ruta»).
// Los adjuntos (tanda 4, 16/10/2026), base 5 / 0, cada rotura → 4 / 1 («los adjuntos»): `urlDeAdjunto` sin mirar de quién
// es la conversación; el turno sin soltar los binarios de un mensaje que quedó sin bloques; El Archivero para cualquier
// rol; abrir devolviendo las filas crudas (con el path); `deleteSession` sin los binarios; el `<img>` sin `conWs`; el
// `formData()` antes de mirar el largo. Y lo que encontró la revisión adversarial (16/10/2026), base 5 / 0 → 4 / 1 cada
// una: subir sin mirar `guardarAdjuntos` (el PDF de un LEAD iba a El Archivero del negocio por el Analyst del CRM); el
// plazo de El Archivero desde después de leer los archivos.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const leer = (r: string) => readFileSync(r, 'utf8');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('la página: entra con la puerta de MaKo, y el Mapa se calcula sólo para el admin de la tab', () => {
  const src = sinComentarios(leer('app/second-brain/page.tsx'));
  const cuerpo = src.slice(src.indexOf('export default async function'));
  const lineas = cuerpo.split('\n').map((l) => l.trim()).filter(Boolean);
  assert.equal(lineas[1], "await requireRolWs(['closer', 'setter'], { nav: 'mako' });", 'la primera línea es la puerta del chat');
  assert.equal(lineas[2], "const veMapa = await esAdminDeTab('second-brain');", 'el Mapa, con la puerta de las rutas del Second Brain');
  const si = cuerpo.indexOf('if (veMapa && ');
  assert.ok(si > 0, 'el Mapa va adentro de un `if (veMapa && …)`');
  const bloque = cuerpo.slice(si, cuerpo.indexOf('\n  }\n', si));
  for (const f of ['construirCerebro(', 'tokenAgenteVisible(']) {
    assert.equal(cuerpo.split(f).length - 1, 1, `${f} aparece una sola vez`);
    assert.ok(bloque.includes(f), `${f} sólo adentro del if del Mapa`);
  }
  assert.ok(!/rol\s*===\s*'admin'/.test(cuerpo), 'el rol no se mira a mano: lo decide la puerta');
});

test('la ruta del chat: la persona adentro de cada handler, el plazo de un turno, sin ?ws= crudo y sin Claude propio', () => {
  const r = 'app/api/mako/chat/route.ts';
  assert.ok(!existsSync('app/api/second-brain/chat/route.ts'), 'no va en app/api/second-brain (esa carpeta es sólo del admin)');
  const src = sinComentarios(leer(r));
  for (const m of ['GET', 'POST']) {
    const i = src.indexOf(`export async function ${m}(`);
    assert.ok(i > 0, m);
    const dos = src.slice(src.indexOf('{', i) + 1).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2);
    assert.deepEqual(dos, ['const persona = await personaDelRequest();', "if ('error' in persona) return json({ ok: false, error: persona.error }, persona.status);"], `${m}: la persona primero`);
  }
  assert.match(src, /^export const maxDuration = 420;/m);
  assert.ok(!/get\('ws'\)/.test(src), 'el workspace sale de la sesión, nunca del ?ws=');
  assert.ok(!/chatClaude|@\/lib\/anthropic/.test(src), 'el turno es el de siempre: sin una llamada propia al modelo');
  assert.equal((src.match(/export async function /g) ?? []).length, 2, 'un handler nuevo entra a este test');
});

test('la pantalla corta después del techo de la ruta, y manda por la ruta del chat', () => {
  const src = leer('app/second-brain/ChatSecondBrain.tsx');
  assert.match(src, /const RUTA = '\/api\/mako\/chat';/);
  assert.match(src, /const TOPE_MS = 425_000;/);
  assert.ok(!src.includes('/api/m/mako'), 'una sola ruta para la pieza de escritorio');
});

test('el índice: un chat de otro no existe, «Antes» usa la regla de /mako, y la API toma la persona del turno', () => {
  // ⚠️ Probado ROMPIÉNDOLO (16/10/2026): sin el cruce de la base en hiloDelSecondBrain → 1 fallo (éste); el runner
  // leyendo el chat de un parámetro en vez del canal → 1 fallo (éste).
  const crudo = leer('lib/chat-mako-indice.ts');
  const src = sinComentarios(crudo);
  const hilo = src.slice(src.indexOf('export async function hiloDelSecondBrain('));
  assert.ok(hilo.includes('if (!s || s.chart_key !== t.base) return null;'), 'el chat pedido es de la MISMA persona');
  const antes = crudo.slice(crudo.indexOf('export async function hiloDeAntes('), crudo.indexOf('// ── Para la API'));
  assert.ok(antes.includes('esChatDelTelefono(s.chart_key)') && antes.includes('puedeUsarSesion(s.chart_key, q)'), '«Antes»: la regla de /mako');
  const run = sinComentarios(leer('lib/api-mako/areas/mako.run.ts'));
  for (const op of ['listar_chats_mako', 'hilo_chat_mako']) {
    const ini = run.indexOf(`  ${op}: {`);
    assert.ok(ini > 0, op);
    const c = run.slice(ini, run.indexOf('\n  },', ini));
    assert.ok(c.includes('const sid = sesionDelCanal(ctx.canalKey);'), `${op}: la conversación sale del canal`);
  }
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  const i = ruta.indexOf("if (sp.get('antes') || sp.has('antesId')) {");
  assert.ok(i > 0 && ruta.indexOf('await quienChateaDelRequest()', i) > i, '«Antes» pide quién chatea antes de leer');
});

// Tanda 4 (16/10/2026): los adjuntos guardados. Las reglas puras están en tests/chat-mako-bloques.test.ts; acá, el
// cableado que las hace valer en el servidor.
test('los adjuntos: se abren por su mensaje mirando de quién es, no quedan sueltos, y sólo el PDF del admin va a El Archivero', () => {
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(ruta, /urlDeAdjunto\(persona, sp\.get\('adjunto'\)\)/, 'el adjunto sale de su mensaje, nunca de un path del navegador');
  assert.ok(!/createSignedUrl|storage\.from/.test(ruta), 'la ruta no firma por su cuenta');
  const multi = ruta.slice(ruta.indexOf("startsWith('multipart/form-data')"));
  const largo = multi.indexOf('TOPE_TOTAL_BYTES + MARGEN_MULTIPART_BYTES');
  assert.ok(largo > 0 && largo < multi.indexOf('req.formData()'), 'el largo se mira antes de leer el cuerpo');

  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  const url = turno.slice(turno.indexOf('export async function urlDeAdjunto('));
  const cuerpoUrl = url.slice(0, url.indexOf('\n}\n'));
  const deQuien = cuerpoUrl.indexOf('sesionDe(persona, m.session_id)');
  assert.ok(deQuien > 0 && deQuien < cuerpoUrl.indexOf('urlFirmadaDeAdjunto('), 'de quién es la conversación, ANTES de firmar');
  assert.match(cuerpoUrl, /sanearBloques\(persona\.ws, m\.bloques\)/, 'el path se sanea con el workspace de la persona');
  assert.match(turno, /mensajes: mensajes\.map\(\(m\) => aMensajeChat\(persona\.ws, m\)\)/, 'abrir no devuelve las filas crudas (con el path)');
  assert.match(turno, /if \(bloques\.length && !msg\.conBloques\) await borrarAdjuntos\(/, 'un mensaje que quedó sin sus bloques suelta los binarios');
  // Revisión del 16/10/2026: el MaKo Analyst de un lead usa este mismo turno, y su PDF es del lead. Guardar (y El
  // Archivero) es SÓLO de quien lo pide: el Second Brain y el teléfono.
  assert.match(turno, /adjuntos\.length && entrada\.guardarAdjuntos \? await subirAdjuntos\(/, 'subir sólo si quien llama lo pide');
  assert.equal((ruta.match(/guardarAdjuntos: true/g) ?? []).length, 1, 'el Second Brain lo pide (sólo en el envío con archivos)');
  assert.match(sinComentarios(leer('app/api/m/mako/route.ts')), /guardarAdjuntos: true/, 'el teléfono lo pide');
  assert.ok(!/guardarAdjuntos/.test(sinComentarios(leer('lib/mako-analyst-lead.ts'))), 'el Analyst del lead no');
  assert.match(turno, /archivarPdfsDelChat\(ws, msg\.id, inicio, pdfs\)/, 'el plazo de El Archivero corre desde que empezó el turno');
  const archivar = turno.indexOf('archivarPdfsDelChat(ws');
  assert.ok(archivar > 0, 'el turno pasa los PDF a El Archivero');
  const antes = turno.slice(0, archivar);
  assert.ok(antes.slice(antes.lastIndexOf('if (')).startsWith("if (persona.rol === 'admin'"), 'sólo los del admin (El Archivero alimenta el perfil del negocio)');

  const cc = sinComentarios(leer('lib/chart-chats.ts'));
  const del = cc.slice(cc.indexOf('export async function deleteSession('));
  const binarios = del.indexOf('.remove(paths)');
  assert.ok(binarios > 0 && binarios < del.indexOf(".from('chart_chats').delete()"), 'los binarios se van antes que las filas que los nombran');
  assert.match(del, /filter\(esRutaDeChatDeAlguno\)/, 'y sólo los que tienen la forma de un adjunto del chat');

  assert.match(leer('app/_chat/ArchivosHilo.tsx'), /conWs\(rutaDeArchivo\(a\.ref\), ws\)/, 'el <img> no pasa por WsFetch: el ?ws= va a mano');
});

