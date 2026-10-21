// =============================================================================
// «Aceptar en el editor» abre ESA propuesta (pieza 1.14 del Ops Center, 20/10/2026)
// =============================================================================
// La API deja cada edición del Video Editor como PROPUESTA y devuelve el link
// `/video-editor/<proyecto>?propuesta=<id>` (lib/api-mako/areas/video.run.ts). Hasta el 20/10 nadie leía el
// `?propuesta=`: el editor traía todas las propuestas a los 1,5 s y abría el chat SÓLO si llegaba una nueva. La
// segunda vez que alguien tocaba el link, caía en el editor con el chat cerrado y sin saber dónde estaba lo que venía
// a aceptar. Lo que fija este archivo:
//   · la página lee `?propuesta=` (sólo un uuid) y lo pasa hasta el editor, con el MISMO nombre que usa la API;
//   · el editor reintenta la primera búsqueda hasta que el proyecto cargó, abre el chat y pone el foco en ESA;
//   · si ya se aceptó o se descartó, lo dice en vez de abrir un chat mudo;
//   · el panel baja hasta la propuesta y la resalta.
//
// PROBADO ROMPIÉNDOLO (20/10/2026; base 7 / 0). Pasan / fallan:
//   R1  la página no lee `?propuesta=`                        → 6 / 1
//   R2  viaja cualquier texto, no sólo un uuid                 → 6 / 1
//   R3  VideoEditorCliente no se lo pasa al editor             → 6 / 1
//   R4  el editor arranca las propuestas sin foco              → 6 / 1
//   R5  sin reintento mientras el proyecto carga               → 6 / 1
//   R6  enfoca pero no abre el chat (el problema original)     → 6 / 1
//   R7  una propuesta ya aceptada se trata como abierta        → 6 / 1
//   R8  el panel no baja hasta la propuesta                    → 6 / 1
//   R9  el foco corre antes del «baja solo», que lo pisa       → 6 / 1
//   R10 la API cambia el nombre del parámetro (`?p=`)          → 6 / 1
// La primera pasada de R9 (borrar el «baja solo») pasaba: la comparación de posiciones daba verdadero con -1.
//
// Y lo que encontró la revisión adversarial del 20/10 (noche; base 13 / 0):
//   M1  enfoca con cualquier proyecto activo (uno vacío: «ya no está abierta»)   → 12 / 1
//   M2  una búsqueda en vuelo consume el foco después de irse el editor          → 12 / 1
//   M3  con ?propuesta= y el proyecto en otro navegador, abre uno vacío          → 12 / 1
//   M4  aceptar cierra la propuesta entera aunque haya crecido                   → 12 / 1
//   M5  el server parte sin compare-and-set de versión                           → 12 / 1
//   M6  aceptar no manda lo que el editor vio                                    → 12 / 1 (la primera vez pasaba:
//       la fijaba sólo tests/video-editor-propuestas-api.test.ts; ahora también acá)
//   M6b descartar no manda lo que el editor vio                                  → 12 / 1
//   M7  lo que quedó abierto no se trae al editor                                → 12 / 1
//   M8  el resto de una propuesta partida no entra como mensaje                  → 12 / 1
//   M9  el hilo guardado olvida la versión                                       → 12 / 1
//   M10 el foco queda pegado al cerrar el panel                                  → 12 / 1
//   M11 el listado trae las 20 más viejas                                        → 12 / 1
//   M12 la ruta no incluye la propuesta del link                                 → 12 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { focoDePropuesta, idDeMensaje, SIN_PROYECTO_AQUI } from '../app/video-editor/_opencut/chat/foco';
import { repartoAlResolver } from '../lib/editor-video/propuestas';
import { hiloParaGuardar } from '../lib/editor-video/chat-hilo';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const P = '6f1c2b0e-8a1d-4c2f-9b7e-1a2b3c4d5e6f';

test('una propuesta abierta y en el hilo: el foco va a su mensaje, sin aviso', () => {
  assert.deepEqual(focoDePropuesta(P, new Set([P]), [{ id: 'otro' }, { id: idDeMensaje(P), estado: 'pendiente' }]), { mensajeId: `api-${P}`, aviso: null });
});

test('una que ya se resolvió: el foco va a su mensaje y dice qué pasó', () => {
  assert.match(focoDePropuesta(P, new Set(), [{ id: idDeMensaje(P), estado: 'aplicada' }]).aviso ?? '', /ya se aceptó/);
  assert.match(focoDePropuesta(P, new Set(), [{ id: idDeMensaje(P), estado: 'descartada' }]).aviso ?? '', /ya no está abierta/);
  assert.match(focoDePropuesta(P, new Set(), [{ id: idDeMensaje(P), estado: 'restaurada' }]).aviso ?? '', /deshizo/);
});

test('una que no está en ningún lado: no hay mensaje al que ir, y lo dice', () => {
  const f = focoDePropuesta(P, new Set(), []);
  assert.equal(f.mensajeId, null);
  assert.match(f.aviso ?? '', /ya no está abierta/);
});

test('el link de la API y la página usan el MISMO parámetro', () => {
  assert.match(leer('lib', 'api-mako', 'areas', 'video.run.ts'), /`\/video-editor\/\$\{proyecto\}\?propuesta=\$\{r\.id\}`/);
  const pag = sinComentarios(leer('app', 'video-editor', '[proyecto]', 'page.tsx'));
  assert.match(pag, /const \{ desde, plantilla, propuesta \} = await searchParams;/);
  // Sólo un uuid viaja al cliente (el id de video_editor_propuestas, mig 0302).
  assert.match(pag, /UUID\.test\(propuesta\)/);
  assert.match(pag, /propuesta=\{idPropuesta\}/);
});

test('el id llega hasta el editor y arranca las propuestas con ese foco', () => {
  assert.match(sinComentarios(leer('app', 'video-editor', 'VideoEditorCliente.tsx')), /<EditorPage projectId=\{proyectoId\} propuesta=\{propuesta\} \/>/);
  assert.match(sinComentarios(leer('app', 'video-editor', '_opencut', 'editor-page.tsx')), /iniciarPropuestas\(editor, \{ foco: propuesta, proyecto: projectId \}\), \[editor, propuesta, projectId\]/);
});

test('la primera búsqueda con foco se reintenta hasta que el proyecto cargó, y abre el chat en ESA', () => {
  const src = sinComentarios(leer('app', 'video-editor', '_opencut', 'chat', 'propuestas.ts'));
  assert.match(src, /if \(\+\+intentos < INTENTOS_FOCO\) reintento = setTimeout\(buscar, 1500\);/, 'sin reintento, el foco se pierde si el proyecto tarda en cargar');
  assert.match(src, /enfocarPropuesta\(proyectoId, foco, r\.abiertas\)/);
  const enfocar = src.slice(src.indexOf('function enfocarPropuesta'), src.indexOf('const INTENTOS_FOCO'));
  assert.match(enfocar, /setAbierto\(true\)/, 'el chat no se abre: era el problema');
  assert.match(enfocar, /setFoco\(f\.mensajeId\)/);
  assert.match(enfocar, /toast\(f\.aviso\)/);
});

test('el panel baja hasta la propuesta, la resalta y la suelta', () => {
  const src = sinComentarios(leer('app', 'video-editor', '_opencut', 'chat', 'PanelChat.tsx'));
  assert.match(src, /data-mensaje=\{m\.id\}/);
  assert.match(src, /querySelector<HTMLElement>\(`\[data-mensaje="\$\{CSS\.escape\(foco\)\}"\]`\)/);
  assert.match(src, /scrollIntoView\(\{ block: "center" \}\)/);
  assert.match(src, /foco === m\.id \?/);
  // DESPUÉS del «baja solo»: si no, el scroll al final pisa al de la propuesta.
  const baja = src.indexOf('el.scrollTop = el.scrollHeight');
  assert.ok(baja > 0 && baja < src.indexOf('scrollIntoView'), 'el foco corre antes del «baja solo», que lo pisa');
});

// ── Lo que encontró la revisión adversarial (20/10, noche) ─────────────────────────────────────────────

test('el foco es del proyecto del LINK: con otro activo no se usa, y una búsqueda vieja no lo consume', () => {
  const src = sinComentarios(leer('app', 'video-editor', '_opencut', 'chat', 'propuestas.ts'));
  assert.match(src, /if \(r && proyectoId && \(!opciones\.proyecto \|\| proyectoId === opciones\.proyecto\)\) \{/, 'enfoca con cualquier proyecto activo: con uno vacío dice «ya no está abierta»');
  assert.match(src, /if \(cancelado \|\| !pendienteDeFoco\) return;/, 'una búsqueda en vuelo enfoca después de que el editor se fue');
  assert.match(src, /return \(\) => \{\n\t\tcancelado = true;/);
  // La del link llega aunque haya más de 20 abiertas.
  assert.match(src, /traerPropuestas\(editor, \{ incluir: pendienteDeFoco \}\)/);
});

test('si el proyecto del link no está en este navegador, lo dice y no inventa uno vacío', () => {
  const src = sinComentarios(leer('app', 'video-editor', '_opencut', 'components', 'providers', 'editor-provider.tsx'));
  const dice = src.indexOf('if (isNotFound && propuesta) {');
  const crea = src.indexOf('editor.project.createNewProject(');
  assert.ok(dice > 0 && crea > 0 && dice < crea, 'con ?propuesta= abre un proyecto vacío');
  assert.match(src.slice(dice, crea), /setError\(SIN_PROYECTO_AQUI\);/);
  assert.match(sinComentarios(leer('app', 'video-editor', '_opencut', 'editor-page.tsx')), /<EditorProvider projectId=\{projectId\} propuesta=\{propuesta\}>/);
  assert.match(SIN_PROYECTO_AQUI, /no está guardado en este navegador/);
});

test('aceptar cierra SÓLO lo que el editor vio: si la propuesta creció, el resto sigue abierto', () => {
  // La misma versión: se cierra entera.
  assert.deepEqual(repartoAlResolver({ version: 3, total: 2 }, { version: 3, cuantas: 2 }), { cerrar: true });
  // Creció (op2 llegó desde el teléfono): se cierra op1 y op2 sigue abierta, con el mismo id.
  assert.deepEqual(repartoAlResolver({ version: 4, total: 2 }, { version: 3, cuantas: 1 }), { cerrar: false, desde: 1 });
  // Un editor viejo, sin versión: como antes.
  assert.deepEqual(repartoAlResolver({ version: 4, total: 2 }, {}), { cerrar: true });
  // Lo que no cierra (vio todo, o una cuenta rota): entera, nunca se parte en algo vacío.
  for (const cuantas of [2, 5, 0, -1, 1.5, undefined]) assert.deepEqual(repartoAlResolver({ version: 4, total: 2 }, { version: 3, cuantas }), { cerrar: true }, `cuantas=${cuantas}`);
});

test('el server parte con compare-and-set de versión, la ruta pasa lo que vio el editor, y el editor trae el resto', () => {
  const srv = sinComentarios(leer('lib', 'editor-video', 'propuestas-server.ts'));
  assert.match(srv, /const reparto = repartoAlResolver\(\{ version: Number\(fila\.version\) \|\| 0, total: ops\.length \}, p\.vio \?\? \{\}\);/);
  assert.match(srv, /\{ operaciones: ops\.slice\(reparto\.desde\), lineas: lineas\.slice\(reparto\.desde\), version: \(Number\(fila\.version\) \|\| 0\) \+ 1/);
  assert.match(srv, /\.eq\('estado', 'abierta'\)\.eq\('version', fila\.version\)\.select\('id'\)/, 'sin compare-and-set, una acción en el medio se pierde');
  const ruta = sinComentarios(leer('app', 'api', 'video-editor', 'propuestas', 'route.ts'));
  assert.match(ruta, /const vio = \{ version: entero\(body\.version\), cuantas: entero\(body\.cuantas\) \};/);
  assert.match(ruta, /return responder\(\{ ok: true, quedan: r\.quedan \}\);/);
  const panel = sinComentarios(leer('app', 'video-editor', '_opencut', 'chat', 'PanelChat.tsx'));
  assert.match(panel, /if \(quedan\) void traerPropuestas\(editorRef\.current\);/, 'lo que quedó abierto no vuelve al editor');
  // Aceptar y descartar mandan lo que el editor VIO: sin eso, el server la cierra entera.
  assert.match(panel, /resolverEnServidor\(m\.propuestaApi\.id, "aplicada", r\.descartes, m\.propuestaApi\)/);
  assert.match(panel, /resolverEnServidor\(m\.propuestaApi\.id, "descartada", \[\], m\.propuestaApi\)/);
  // Lo que quedó entra como un mensaje nuevo con el id de siempre; el viejo queda como historia.
  const ed = sinComentarios(leer('app', 'video-editor', '_opencut', 'chat', 'propuestas.ts'));
  assert.match(ed, /if \(vio === undefined \|\| vio === Number\(p\.version\)\) continue;/);
  assert.match(ed, /\{ \.\.\.x, id: `\$\{viejo\}-v\$\{vio\}` \}/);
  assert.match(ed, /propuestaApi: \{ id: p\.id, canal: p\.canal, version: Number\(p\.version\) \|\| 0, cuantas: Array\.isArray\(p\.operaciones\) \? p\.operaciones\.length : 0 \}/);
});

test('el hilo guardado recuerda la versión y cuántos cambios vio (y descarta lo que no es un entero)', () => {
  const id = '0b9e5f4c-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
  const [g] = hiloParaGuardar([{ id: 'api-x', c: 1, t: 1, de: 'mako', texto: 'P', propuestaApi: { id, canal: 'app', version: 3, cuantas: 2 } }]) as Array<{ propuestaApi?: unknown }>;
  assert.deepEqual(g.propuestaApi, { id, canal: 'app', version: 3, cuantas: 2 });
  const [h] = hiloParaGuardar([{ id: 'api-y', c: 1, t: 1, de: 'mako', texto: 'P', propuestaApi: { id, canal: 'app', version: 'tres', cuantas: -1 } as never }]) as Array<{ propuestaApi?: unknown }>;
  assert.deepEqual(h.propuestaApi, { id, canal: 'app' });
});

test('el foco se suelta al cerrar el panel, y el listado trae las más NUEVAS y la del link', () => {
  const panel = sinComentarios(leer('app', 'video-editor', '_opencut', 'chat', 'PanelChat.tsx'));
  assert.match(panel, /useEffect\(\(\) => \(\) => useChatAbierto\.getState\(\)\.setFoco\(null\), \[\]\);/, 'el foco queda pegado y salta a la propuesta vieja al reabrir');
  const srv = sinComentarios(leer('lib', 'editor-video', 'propuestas-server.ts'));
  assert.match(srv, /\.order\('created_at', \{ ascending: false \}\)\.limit\(TOPE_ABIERTAS\);/, 'con 21 abiertas, la del pedido de hoy no llega');
  assert.match(srv, /const filas = \(\(data \?\? \[\]\) as Fila\[\]\)\.reverse\(\);/);
  assert.match(srv, /if \(incluir && !filas\.some\(\(f\) => f\.id === incluir\)\)/);
  assert.match(sinComentarios(leer('app', 'api', 'video-editor', 'propuestas', 'route.ts')), /propuestasAbiertas\(p\.ws, proyecto, incluir && UUID\.test\(incluir\) \? incluir : null\)/);
});
