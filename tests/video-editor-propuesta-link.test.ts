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
// (M4, M5 y M8 probaban el reparto por versión y cantidad, que se reemplazó el 21/10 por el cierre por contenido.)
//
// Y la segunda revisión (21/10; base 15 / 0):
//   Q1  el cierre vuelve a contar cantidades en vez de comparar contenido        → 14 / 1
//   Q2  la clave de una operación depende del orden de sus campos (jsonb)        → 14 / 1
//   Q3  el server reescribe la fila aunque no saque nada                         → 14 / 1
//   Q4  tras dos choques contesta «ya resuelta» con la propuesta abierta         → 14 / 1
//   Q5  lo que se está aplicando no cuenta como manejado (doble aplicación)      → 14 / 1
//   Q6  no se resta lo manejado (vuelve a ofrecer lo aplicado)                   → 14 / 1
//   Q7  un pendiente que muestra otra cosa no se reemplaza                       → 14 / 1
//   Q8  «se resolvió en otra pestaña» de algo que sólo no vino en el listado     → 14 / 1
//   Q9  un cierre que no llegó no se reintenta                                   → 14 / 1
//   Q10 «ya resuelta» no cuenta como cerrada (reintenta para siempre)            → 14 / 1
//   Q11 el panel no anota que el cierre llegó                                    → 14 / 1
//   Q12 el foco va al último mensaje y no al pendiente                           → 14 / 1 (la primera vez pasaba:
//       en el caso del test el pendiente también era el último)
//   Q13 el hilo guardado olvida que el cierre llegó                              → 14 / 1
//   Q14 el server no trae lo que el editor pide por id                           → 14 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { focoDePropuesta, idDeMensaje, queMostrar, SIN_PROYECTO_AQUI } from '../app/video-editor/_opencut/chat/foco';
import { claveDeOperacion, restarOperaciones } from '../lib/editor-video/propuestas';
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



test('el hilo guardado recuerda la versión y cuántos cambios vio (y descarta lo que no es un entero)', () => {
  const id = '0b9e5f4c-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
  const [g] = hiloParaGuardar([{ id: 'api-x', c: 1, t: 1, de: 'mako', texto: 'P', propuestaApi: { id, canal: 'app', version: 3, cuantas: 2, cerrada: true } }]) as Array<{ propuestaApi?: unknown }>;
  assert.deepEqual(g.propuestaApi, { id, canal: 'app', version: 3, cuantas: 2, cerrada: true }, 'olvida que el cierre llegó: lo reintenta para siempre');
  const [h] = hiloParaGuardar([{ id: 'api-y', c: 1, t: 1, de: 'mako', texto: 'P', propuestaApi: { id, canal: 'app', version: 'tres', cuantas: -1 } as never }]) as Array<{ propuestaApi?: unknown }>;
  assert.deepEqual(h.propuestaApi, { id, canal: 'app' });
});

test('el foco se suelta al cerrar el panel, y el listado trae las más nuevas y las que el editor pide por id', () => {
  const panel = sinComentarios(leer('app', 'video-editor', '_opencut', 'chat', 'PanelChat.tsx'));
  assert.match(panel, /useEffect\(\(\) => \(\) => useChatAbierto\.getState\(\)\.setFoco\(null\), \[\]\);/, 'el foco queda pegado y salta a la propuesta vieja al reabrir');
  const srv = sinComentarios(leer('lib', 'editor-video', 'propuestas-server.ts'));
  assert.match(srv, /\.order\('created_at', \{ ascending: false \}\)\.limit\(TOPE_ABIERTAS\);/, 'con 21 abiertas, la del pedido de hoy no llega');
  assert.match(srv, /\.eq\('estado', 'abierta'\)\.in\('id', faltan\);/, 'lo que el editor pide por id no llega si quedó fuera de las 20');
  assert.match(sinComentarios(leer('app', 'api', 'video-editor', 'propuestas', 'route.ts')), /searchParams\.getAll\('propuesta'\)\.filter\(\(x\) => UUID\.test\(x\)\)\.slice\(0, TOPE_INCLUIR\)/);
});

// ── Lo que encontró la segunda revisión (21/10) ────────────────────────────────────────────────────────

const op1 = { op: 'velocidad', ref: 'v1', x: 2 };
const op2 = { op: 'cambiar_texto', ref: 't2', texto: 'Hola' };

test('el cierre saca de la base EXACTAMENTE lo que el editor aplicó, por contenido', () => {
  // El caso normal: creció, se acepta op1, queda op2.
  assert.deepEqual(restarOperaciones([op1, op2], [op1]), [1]);
  assert.deepEqual(restarOperaciones([op1], [op1]), []);
  // ⚠️ La vista vieja: otra pestaña ya cerró op1 y la fila quedó en [op2]. Aceptar op1 otra vez no cierra op2.
  assert.deepEqual(restarOperaciones([op2], [op1]), [0], 'una vista vieja cierra un cambio que el editor nunca vio');
  // jsonb reordena las claves: el orden no cuenta. Dos iguales se sacan de a una.
  assert.deepEqual(restarOperaciones([{ x: 2, ref: 'v1', op: 'velocidad' }], [op1]), []);
  assert.deepEqual(restarOperaciones([op1, op1, op2], [op1]), [1, 2]);
  assert.equal(claveDeOperacion({ b: 1, a: { d: 2, c: 3 } }), claveDeOperacion({ a: { c: 3, d: 2 }, b: 1 }));
});

test('el server cierra restando con compare-and-set, y si choca dice «cambió», no «ya resuelta»', () => {
  const srv = sinComentarios(leer('lib', 'editor-video', 'propuestas-server.ts'));
  assert.match(srv, /const quedan = p\.vistas \? restarOperaciones\(ops\.map\(comoLaVe\), p\.vistas\) : \[\];/);
  assert.match(srv, /if \(p\.vistas && quedan\.length === ops\.length\) return \{ ok: true, quedan: ops\.length \};/, 'reescribe la fila aunque no saque nada');
  assert.match(srv, /\.eq\('estado', 'abierta'\)\.eq\('version', fila\.version\)\.select\('id'\)/, 'sin compare-and-set, una acción en el medio se pierde');
  assert.match(srv, /return \{ ok: false, cambio: true \};\n\}/, 'tras dos choques dice «ya resuelta» y el editor deja de reintentar con la propuesta abierta');
  const ruta = sinComentarios(leer('app', 'api', 'video-editor', 'propuestas', 'route.ts'));
  assert.match(ruta, /const vistas = Array\.isArray\(body\.ops\) \? validarOperaciones\(body\.ops\.slice\(0, 40\)\)\.operaciones : undefined;/);
  assert.match(ruta, /if \('cambio' in r\) return responder\(\{ ok: false, cambio: true,/);
});

test('el editor ofrece sólo lo que ningún mensaje manejó: ni doble aplicación ni mensajes duplicados', () => {
  const X = '6f1c2b0e-8a1d-4c2f-9b7e-1a2b3c4d5e6f';
  // El cierre de op1 no llegó a la base y la propuesta creció: se ofrece op2, NO op1 otra vez.
  assert.deepEqual(queMostrar(X, [op1, op2], [{ id: `api-${X}`, estado: 'aplicada', ops: [op1] }]), { accion: 'nuevo', id: `api-${X}-2`, quedan: [1] });
  // Mientras se aplica (la búsqueda que dispara el clic llega en el medio): op1 está en curso, no se ofrece.
  assert.deepEqual(queMostrar(X, [op1, op2], [{ id: `api-${X}`, estado: 'aplicando', ops: [op1] }]).accion === 'nuevo' ? 'ok' : 'no', 'ok');
  assert.deepEqual((queMostrar(X, [op1, op2], [{ id: `api-${X}`, estado: 'aplicando', ops: [op1] }]) as { quedan: number[] }).quedan, [1]);
  // Después de un reparto, al recargar: el resto ya tiene su mensaje pendiente. Nada nuevo, sin aviso.
  assert.deepEqual(queMostrar(X, [op2], [{ id: `api-${X}`, estado: 'aplicada', ops: [op1] }, { id: `api-${X}-2`, estado: 'pendiente', ops: [op2] }]), { accion: 'nada' });
  // Un pendiente que muestra otra cosa que lo abierto se reemplaza (creció, o se cerró una parte en otra pestaña).
  assert.deepEqual(queMostrar(X, [op1, op2], [{ id: `api-${X}`, estado: 'pendiente', ops: [op1] }]), { accion: 'reemplazar', id: `api-${X}`, quedan: [0, 1] });
  assert.deepEqual(queMostrar(X, [op2], [{ id: `api-${X}`, estado: 'pendiente', ops: [op1, op2] }]), { accion: 'reemplazar', id: `api-${X}`, quedan: [0] });
  // El foco va al pendiente de la propuesta, aunque tenga otro id.
  assert.deepEqual(focoDePropuesta(X, new Set([X]), [{ id: `api-${X}`, estado: 'aplicada', propuestaApi: { id: X } }, { id: `api-${X}-2`, estado: 'pendiente', propuestaApi: { id: X } }]), { mensajeId: `api-${X}-2`, aviso: null });
  // Aunque el pendiente no sea el último del hilo (el hilo se ordena por la fecha de la propuesta).
  assert.deepEqual(focoDePropuesta(X, new Set([X]), [{ id: `api-${X}-2`, estado: 'pendiente', propuestaApi: { id: X } }, { id: `api-${X}`, estado: 'aplicada', propuestaApi: { id: X } }]), { mensajeId: `api-${X}-2`, aviso: null });
});

test('el editor pide por id lo que le importa, sólo afirma «se resolvió» de eso, y reintenta los cierres', () => {
  const ed = sinComentarios(leer('app', 'video-editor', '_opencut', 'chat', 'propuestas.ts'));
  assert.match(ed, /const sinCerrar = \(m: MensajeMako\) => m\.estado === "pendiente" \|\| !m\.propuestaApi\?\.cerrada;/);
  assert.match(ed, /if \(!pedidas\.has\(id\)\) continue;/, 'da por «resuelta en otra pestaña» una que sólo no vino en el listado');
  assert.match(ed, /if \(manejada && !m\.propuestaApi!\.cerrada && m\.propuesta\) \{\n\t\t\t\tvoid resolverEnServidor\(/, 'un cierre que no llegó no se reintenta');
  assert.match(ed, /const d = queMostrar\(p\.id, crudas\.map\(comoLaVe\),/);
  assert.doesNotMatch(ed, /-v\$\{vio\}/, 'volvió el renombre que duplicaba mensajes');
  assert.match(ed, /return \{ cerrada: r\?\.ok === true \|\| r\?\.yaResuelta === true, quedan \};/);
  const panel = sinComentarios(leer('app', 'video-editor', '_opencut', 'chat', 'PanelChat.tsx'));
  assert.match(panel, /resolverEnServidor\(m\.propuestaApi\.id, "aplicada", r\.descartes, m\.propuesta\.operaciones\)\.then\(\(c\) => alCerrar\(m\.id, c\)\)/);
  assert.match(panel, /resolverEnServidor\(m\.propuestaApi\.id, "descartada", \[\], m\.propuesta\?\.operaciones \?\? \[\]\)\.then\(\(c\) => alCerrar\(m\.id, c\)\)/);
  assert.match(panel, /if \(c\.cerrada\) marcarCerrada\(proyectoId, mensajeId\);/);
  assert.match(panel, /if \(c\.quedan\) void traerPropuestas\(editorRef\.current\);/);
});
