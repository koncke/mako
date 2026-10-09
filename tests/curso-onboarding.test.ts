// =============================================================================
// EL ONBOARDING DE LA TAB CURSO: pasos derivados de los datos, una lista que no tapa nada,
// y un ensayo (la vista del alumno) que no crea accesos ni escribe progreso
// =============================================================================
// Regla de la casa: toda tab tiene onboarding (.claude/skills/tab-onboarding). Lo de la tab Curso
// tiene tres condiciones que fallan en silencio, y cada una tiene acá su test:
//
//  1. El ws1 llegó con 107 clases cargadas por script: un paso que no se derive del DATO le
//     pediría a Mauricio cargar lo que ya tiene. Y «no pude leer» no puede desmarcar nada.
//  2. La lista NO TAPA la tab (no es un wizard ni un redirect): el curso se arma usándolo.
//  3. El ensayo abre el portal: abrir el de un cliente real le crea su fila de `curso_accesos` y
//     le cuenta un ingreso (docs/relevo/customer-success.md, trampa 5). La vista previa va sin
//     lead y sin token, y las piezas del portal no escriben con `vistaPrevia` puesto. Y el paso
//     de invitar no se dispara solo: manda un email real.
//
// ⚠️ PROBADO ROMPIÉNDOLO, una rotura por vez (06/10/2026, arnés del scratchpad que restaura de
// memoria). Base: 10 pasan, 0 fallan. Cada rotura tumbó su test (9 / 1), salvo la 1 (8 / 2):
//   1. `curso_invitar` sin `opcional` en el catálogo               → «el catálogo: …» y «el ws1…»
//      (con invitar obligatorio, al ws1 le quedarían DOS pasos: el ensayo y mandar un email)
//   2. «no se sabe» leído como «no hay» (`hay` con null → false)   → «no pude leer NO desmarca…»
//   3. `curso_vista` agregado a DESMARCABLES                       → «ver el portal e invitar…»
//   4. el ensayo sin la entrada de un cliente real (sin `entraron`) → «un cliente que entró…»
//   5. la página sin `onboarding={onboarding}`                      → «la página anota los pasos…»
//   6. la vista previa sin `vistaPrevia` en PortalAlumno            → «la vista previa no crea…»
//   7. Reproductor: `enviar` sin `previa ||`                        → «con vistaPrevia, el portal…»
//   8. TareaAlumno: `mandar` sin el `if (previa)`                   → «con vistaPrevia, el portal…»
//   9. la lista llamando a `invitarAlCursoAction`                   → «la lista no manda nada»
// Restaurado: 10 / 0.
//
// ⚠️ Y LA LISTA CUENTA EL PRODUCTO ELEGIDO (revisión del 06/10: con A en 107 clases y B en 0,
// al elegir B decía «Tu programa ✓ 107 clases»). Probado rompiéndolo con el mismo arnés, una
// rotura por vez. Base: 14 / 0. Cada rotura tumbó UN test (13 / 1):
//   1. `checklistCurso` sin el filtro por producto                → «la lista cuenta el PRODUCTO…»
//   2. si se dibuja, decidido por el producto y no el workspace    → «si la lista se dibuja lo decide…»
//   3. `checklistCurso` sin `errorDelProducto`                     → «"no pude leer" no dibuja la lista…»
//   4. CursoApp: `clases={clases.length}` (el workspace)            → «la página anota los pasos…»
//   5. CursoApp: `errorDelProducto: false`                          → «la página anota los pasos…»
//   6. ChecklistCurso: `const programa = true`                      → «la lista dibuja "Tu programa"…»
// Restaurado: 14 / 0.
//
// ⚠️ 08/10/2026: LA TAB YA NO DIBUJA LA LISTA, la reemplazó el RECORRIDO (item 3). Las roturas 4 y 5
// de arriba miraban la lista en CursoApp y ya no aplican; `checklistCurso` sigue con sus tests (los
// pasos se siguen derivando). Las nuevas (scratchpad/editor/roturas.mjs), base 14 / 0, cada una 13 / 1
// en «la página anota los pasos…»: sin el «?» del recorrido · un paso cuyo objetivo nadie marca
// (la portada sin `data-recorrido`) · la lista de vuelta en la tab.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';
import { pasoBloqueadoPor } from '../lib/onboarding-orden';
import {
  TAB_CURSO, PASOS_CURSO, cambiosDeOnboarding, pasosDeLosDatos, hechosDeClases, checklistCurso, type HechosCurso,
} from '../app/customer-success/curso/onboarding-curso';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque que arranca en `desde` y termina en el primer `hasta` después de él. */
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: ¿se movió?`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  return src.slice(i, j);
};

const DEF = TAB_ONBOARDINGS[TAB_CURSO];

test('el catálogo: prefijo propio, el orden de PASOS_CURSO, invitar al final y opcional', () => {
  assert.ok(DEF, 'la tab Curso no tiene onboarding en el catálogo');
  assert.equal(DEF.href, '/customer-success/curso');
  assert.deepEqual(DEF.pasos.map((p) => p.key), [...PASOS_CURSO], 'el catálogo y PASOS_CURSO dicen órdenes distintos: el orden es una guarda');
  for (const p of DEF.pasos) assert.match(p.key, /^curso_/, `«${p.key}» sin prefijo: colisiona vía KEY_PASOS_COMPARTIDOS`);
  const de = (k: string) => DEF.pasos.find((p) => p.key === k)!;
  assert.ok(!de('curso_programa').opcional, 'sin programa no hay curso');
  assert.ok(!de('curso_vista').opcional, 'el ensayo es la prueba de que la tab quedó lista');
  assert.ok(de('curso_videos').opcional, 'un curso de puros formularios existe');
  const ultimo = DEF.pasos[DEF.pasos.length - 1];
  assert.equal(ultimo.key, 'curso_invitar', 'invitar manda un email real: va al final');
  assert.ok(ultimo.opcional, 'invitar no puede trabar la tab');
  // La key del catálogo es la del nav (la usan `navEnCapa` y la pantalla final del onboarding).
  assert.match(leer('app/_components/nav.ts'), /key:\s*'cs-curso'/);
});

test('el ws1 (107 clases cargadas, nadie entró ni fue invitado) entra con «Tu programa» hecho', () => {
  const ws1: HechosCurso = { clases: 107, conVideo: 0, entraron: 0, invitados: 0 };
  const cambios = cambiosDeOnboarding({}, ws1);
  assert.deepEqual(cambios, [{ paso: 'curso_programa', done: true }]);
  // Y cada cambio es marcable en el orden en que sale (`marcarPasoTab` corre esta guarda).
  const steps: Record<string, { done: boolean }> = {};
  for (const c of cambios) {
    assert.equal(pasoBloqueadoPor(DEF.pasos, steps, c.paso), null, `«${c.paso}» saldría bloqueado`);
    steps[c.paso] = { done: c.done };
  }
  const faltan = DEF.pasos.filter((p) => !p.opcional && !steps[p.key]?.done).map((p) => p.key);
  assert.deepEqual(faltan, ['curso_vista'], 'al ws1 sólo le tiene que quedar el ensayo');
});

test('«no pude leer» NO desmarca ni marca nada', () => {
  const todoHecho = Object.fromEntries(PASOS_CURSO.map((p) => [p, { done: true }]));
  const nada: HechosCurso = { clases: null, conVideo: null, entraron: null, invitados: null };
  assert.deepEqual(cambiosDeOnboarding(todoHecho, nada), []);
  assert.deepEqual(cambiosDeOnboarding({}, nada), []);
  assert.deepEqual(pasosDeLosDatos(nada), { curso_programa: null, curso_videos: null, curso_vista: null, curso_invitar: null });
});

test('ver el portal e invitar son hechos que ya pasaron: el dato no los deshace; las clases sí', () => {
  const todoHecho = Object.fromEntries(PASOS_CURSO.map((p) => [p, { done: true }]));
  assert.deepEqual(cambiosDeOnboarding(todoHecho, { clases: 5, conVideo: 2, entraron: 0, invitados: 0 }), []);
  assert.deepEqual(cambiosDeOnboarding(todoHecho, { clases: 0, conVideo: 0, entraron: 0, invitados: 0 }), [
    { paso: 'curso_programa', done: false },
    { paso: 'curso_videos', done: false },
  ]);
});

test('un cliente que entró a su portal también cierra el ensayo; la vista previa, sola, también', () => {
  assert.equal(pasosDeLosDatos({ clases: 3, conVideo: 0, entraron: 1, invitados: 1 }).curso_vista, true);
  assert.equal(pasosDeLosDatos({ clases: 3, conVideo: 0, entraron: null, invitados: null, vistaAbierta: true }).curso_vista, true);
  assert.equal(pasosDeLosDatos({ clases: 3, conVideo: 0, entraron: 0, invitados: 0 }).curso_vista, false);
});

test('«con video» es lo que el portal DIBUJA, no lo que dice la columna', () => {
  const r = hechosDeClases([
    { videoTipo: 'ninguno', videoUrl: null, videoPath: null },
    { videoTipo: 'archivo', videoUrl: null, videoPath: '1/9/x.mp4' },
    { videoTipo: 'archivo', videoUrl: null, videoPath: null },               // subida que no llegó
    { videoTipo: 'youtube', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoPath: null },
    { videoTipo: 'url', videoUrl: 'javascript:alert(1)', videoPath: null },  // no se dibuja
  ]);
  assert.deepEqual(r, { clases: 5, conVideo: 2 });
});

test('la página anota los pasos en cada carga y NO tapa la tab', () => {
  const page = sinComentarios(leer('app/customer-success/curso/page.tsx'));
  assert.match(page, /sincronizarOnboardingCurso\(/, 'la página dejó de anotar los pasos derivados');
  assert.match(page, /onboarding=\{onboarding\}/, 'la lista del onboarding no le llega a la tab');
  // Ni wizard ni redirect AL ONBOARDING: la tab se abre siempre en su curso. El ÚNICO redirect es el
  // del Avance de los clientes, que se mudó a Clientes (item 4, 08/10/2026), y se fija su DESTINO:
  // otro redirect (el de un onboarding pendiente) no puede entrar por la misma puerta.
  assert.doesNotMatch(page, /onboardingTabPendiente|onboardingRequeridoPara/);
  const redirects = [...page.matchAll(/\bredirect\(([^;]*)\);/g)].map((m) => m[1]);
  assert.equal(redirects.length, 1, `la página redirige ${redirects.length} veces`);
  assert.match(redirects[0], /^await rutaConWs\(`\/customer-success\?vista=avance/, `redirige a otro lado: ${redirects[0]}`);
  // ⚠️ DESDE EL 08/10/2026 LA TAB NO DIBUJA LA LISTA «Configura tu curso» (item 3, Martín: «Elimina el
  //    recuadro… En su lugar haz el típico tutorial de app»). La reemplazó el RECORRIDO, que se ve una
  //    vez por PERSONA (D7) y se puede volver a ver con el «?». Los pasos de arriba se siguen anotando.
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.doesNotMatch(app, /<ChecklistCurso\b|checklistCurso\(/, 'volvió el recuadro «Configura tu curso»');
  // Desde el 08/10/2026 son DOS recorridos, el del curso y el de una clase (items 1 y 19), con sus pasos
  // en ./recorridos-curso.ts. Que cada paso señale algo que existe, y cuál se abre dónde, lo fija
  // tests/curso-recorridos.test.ts; acá queda que el del curso se abra solo y se pueda volver a ver.
  // Rotura (scratchpad/apariencia/romper.mjs): el «?» con un onClick que no reabre nada → 13 / 1.
  assert.match(app, /const recorrido = useRecorrido\(RECORRIDO_CURSO, \{ autoabrir: puedeEditar && !enClase \}\);/);
  assert.match(app, /<Recorrido id=\{RECORRIDO_CURSO\} pasos=\{PASOS_RECORRIDO\} abierto=\{recorrido\.abierto\} onCerrar=\{recorrido\.onCerrar\} \/>/);
  assert.match(app, /<BotonRecorrido objetivo="ayuda"[^>]*onClick=\{enClase \? recorridoClase\.reabrir : recorrido\.reabrir\}/,
    'sin el «?» el recorrido no se puede volver a ver');
  assert.doesNotMatch(app, /hechosDeClases\(/, 'la tab volvió a contar el workspace entero');
});

// ── La lista: si se dibuja lo dice el WORKSPACE; lo que cuenta, el PRODUCTO elegido ──
// El caso que lo pidió (revisión del 06/10): A con 107 clases y B con 0; al elegir B la lista
// decía «Tu programa ✓ 107 clases» y escondía «Agregar clase», con la cabecera de B en «0 clases».
type ClaseMin = Parameters<typeof checklistCurso>[0]['clases'][number];
const clase = (productoId: number, video = false): ClaseMin => video
  ? { productoId, videoTipo: 'youtube', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoPath: null }
  : { productoId, videoTipo: 'ninguno', videoUrl: null, videoPath: null };
const dosProductos: ClaseMin[] = [
  ...Array.from({ length: 105 }, () => clase(1)),
  clase(1, true), clase(1, true),
];

test('la lista cuenta el PRODUCTO elegido: B con 0 clases no dice las 107 de A', () => {
  const anotado = { programa: true, vista: false };
  assert.deepEqual(checklistCurso({ clases: dosProductos, productoId: 2, anotado, errorDelProducto: false }), { clases: 0, conVideo: 0 });
  assert.deepEqual(checklistCurso({ clases: dosProductos, productoId: 1, anotado, errorDelProducto: false }), { clases: 107, conVideo: 2 });
});

test('si la lista se dibuja lo decide el WORKSPACE: un producto sin clases no la trae de vuelta', () => {
  // Programa (en A) + ensayo hecho: no se dibuja en ninguno de los dos.
  for (const productoId of [1, 2]) {
    assert.equal(checklistCurso({ clases: dosProductos, productoId, anotado: { programa: true, vista: true }, errorDelProducto: false }), null);
  }
  // Lo local cuenta aunque lo anotado no lo diga todavía (la clase recién agregada).
  assert.equal(checklistCurso({ clases: dosProductos, productoId: 2, anotado: { programa: false, vista: true }, errorDelProducto: false }), null);
  // Sin una sola clase en el workspace, la lista sigue: falta el programa.
  assert.deepEqual(checklistCurso({ clases: [], productoId: 2, anotado: { programa: false, vista: true }, errorDelProducto: false }), { clases: 0, conVideo: 0 });
});

test('«no pude leer» no dibuja la lista: ni las clases del producto ni lo anotado', () => {
  const anotado = { programa: true, vista: false };
  assert.equal(checklistCurso({ clases: [], productoId: 1, anotado, errorDelProducto: true }), null,
    'con la lectura caída diría «Agrega la primera clase» sobre un curso que quizás tiene 107');
  assert.equal(checklistCurso({ clases: dosProductos, productoId: 1, anotado: null, errorDelProducto: false }), null);
});

test('la lista dibuja «Tu programa» y «Tus videos» de los números que recibe', () => {
  const src = sinComentarios(leer('app/customer-success/curso/ChecklistCurso.tsx'));
  assert.match(src, /const\s+programa\s*=\s*clases\s*>\s*0\s*;/);
  assert.match(src, /const\s+videos\s*=\s*conVideo\s*>\s*0\s*;/);
  assert.match(src, /accion=\{!programa\s*&&\s*onAgregarClase\s*\?/, '«Agregar clase» se ofrece cuando el producto no tiene ninguna');
});

test('la lista no manda nada: invitar lleva a Avance, donde una persona elige', () => {
  const src = sinComentarios(leer('app/customer-success/curso/ChecklistCurso.tsx'));
  assert.doesNotMatch(src, /invitarAlCursoAction|habilitarAccesoCursoAction|BotonInvitar|curso-ficha-actions|fetch\(/,
    'la lista del onboarding no puede disparar una invitación (es un email real)');
  assert.match(src, /onClick=\{onIrAAvance\}/);
});

test('la vista previa no crea accesos ni cuenta ingresos: sin lead, sin token y con vistaPrevia', () => {
  const vista = sinComentarios(leer('app/customer-success/curso/vista/page.tsx'));
  // Desde el 08/10/2026 lleva además las URLs firmadas de los adjuntos de las descripciones (la vista
  // previa no tiene token para pedirlos como el alumno).
  // Desde el 09/10/2026 la vista va con TODAS las correctas (`conCorrectasDelEquipo`, punto 5 del audio
  // del 08/10 a la noche): la vista previa corrige el quiz como el server. Lo fija
  // tests/curso-vista-alumno-0910.test.ts.
  assert.match(vista, /<PortalAlumno\s+token=""\s+vista=\{conCorrectasDelEquipo\(vista, clases\)\}\s+vistaPrevia(?:\s+urlsAdjuntos=\{urlsAdjuntos\})?\s*\/>/, 'la vista previa tiene que dibujar el portal en modo previa');
  assert.doesNotMatch(vista, /@\/lib\/curso-acceso|@\/lib\/alumno-acceso/, 'la vista previa no firma ni lee accesos');
  for (const f of ['linkDeAcceso', 'accesoDe', 'contarIngreso', 'resolverAcceso', 'marcarInvitacion', 'firmarAccesoCurso', 'linkDeEntradaAlumno', 'armarVistaAlumno', 'progresoDelCliente']) {
    assert.ok(!vista.includes(`${f}(`), `la vista previa llama a ${f}: toca el acceso o el avance de un cliente real`);
  }
  // Y las dos puertas de un alumno REAL nunca la prenden.
  for (const p of ['app/compartido/curso/[token]/page.tsx', 'app/mi-curso/page.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(p)), /vistaPrevia/, `${p} prende la vista previa: el alumno no guardaría nada`);
  }
});

test('con vistaPrevia, el portal no escribe: ni el progreso del video ni la tarea', () => {
  const rep = sinComentarios(leer('app/compartido/curso/[token]/Reproductor.tsx'));
  const enviar = bloque(rep, 'const enviar = useCallback(', 'fetch(URL_PROGRESO');
  assert.match(enviar, /if\s*\(\s*previa\s*\|\|/, 'el progreso del video sale en la vista previa');
  const salirRep = bloque(rep, 'const salir = () => {', 'sendBeacon(URL_PROGRESO');
  assert.match(salirRep, /if\s*\(\s*previa\s*\|\|/, 'el beacon del video sale en la vista previa');

  const tarea = sinComentarios(leer('app/compartido/curso/[token]/TareaAlumno.tsx'));
  const mandar = bloque(tarea, 'const mandar = useCallback(', 'fetch(URL_TAREA');
  assert.match(mandar, /if\s*\(\s*previa\s*\)\s*return/, 'la tarea sale en la vista previa');
  const salirTarea = bloque(tarea, 'const salir = () => {', 'sendBeacon(URL_TAREA');
  assert.match(salirTarea, /if\s*\(\s*previa\s*\|\|/, 'el borrador de la tarea sale por beacon en la vista previa');
});
