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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { focoDePropuesta, idDeMensaje } from '../app/video-editor/_opencut/chat/foco';

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
  assert.match(sinComentarios(leer('app', 'video-editor', '_opencut', 'editor-page.tsx')), /iniciarPropuestas\(editor, \{ foco: propuesta \}\), \[editor, propuesta\]/);
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
