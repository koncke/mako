// =============================================================================
// Duplicar un programa: el curso entero, sin los alumnos (25/10/2026)
// =============================================================================
// Pedido (Martín por el Cerebro, después de la llamada con Leandro): «Duplicar un programa, de punta a punta: la acción
// en el server (curso, módulos, clases y su configuración; nunca los alumnos ni su progreso), "Duplicar" en el «…» y en
// el clic derecho, con "Deshacer", y en la API de MaKo».
//
// Lo que fija este archivo:
//   · las reglas puras (lib/curso-duplicar-reglas.ts): el nombre, los candados y el estilo con los ids nuevos, las
//     tareas sin el post ni la categoría de la otra comunidad, los adjuntos con su id nuevo y el tope de los videos;
//   · que la copia NO toca nada de alumnos (accesos, avance, entregas, desbloqueos, la cartera de la entrega);
//   · el cableado: la action es de un admin; la cabecera navega duro a la copia con su «Deshacer»; la API lo declara.
//
// Verificado rompiéndolo: ver «ROTURAS» al final.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  nombreDeCopia, bloqueoDeCopia, camposDeCopia, conAdjuntosDeCopia, claveDeEstiloEnCopia, tituloDeCopia, videosACopiar,
  extensionDe, TOPE_VIDEOS_COPIA,
} from '../lib/curso-duplicar-reglas';
import { avisoDeCopia } from '../app/customer-success/eliminar-programa';
import { REGISTRO } from '../lib/api-mako/registro';
import type { Campo } from '../lib/curso';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tramo = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(i >= 0 && j > i, `no encontré «${desde}» … «${hasta}»`);
  return src.slice(i, j);
};
const antes = (src: string, a: string, b: string) => { const i = src.indexOf(a); const j = src.indexOf(b); return i >= 0 && j > i; };
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

test('nombreDeCopia: «X (copia)», recortando X para no pasar el tope', () => {
  assert.equal(nombreDeCopia('Fiesta Music', 60), 'Fiesta Music (copia)');
  const largo = nombreDeCopia('x'.repeat(80), 60);
  assert.equal(largo.length, 60);
  assert.ok(largo.endsWith(' (copia)'));
  assert.equal(nombreDeCopia('  ', 60), 'Programa (copia)');
  assert.equal(tituloDeCopia(null, 80), null, 'sin título a mano, manda el de la oferta (que ya es «X (copia)»)');
  assert.equal(tituloDeCopia('Mi curso', 80), 'Mi curso (copia)');
});

test('los candados: «la tarea de la clase N» pasa a la clase nueva; si no se copió, se suelta; el resto igual', () => {
  const mapa = new Map([[10, 110]]);
  assert.deepEqual(bloqueoDeCopia({ tipo: 'tarea', claseId: 10, aprobada: true }, mapa), { tipo: 'tarea', claseId: 110, aprobada: true });
  assert.equal(bloqueoDeCopia({ tipo: 'tarea', claseId: 99 }, mapa), null);
  assert.deepEqual(bloqueoDeCopia({ tipo: 'dias', dias: 7 }, mapa), { tipo: 'dias', dias: 7 });
  assert.equal(bloqueoDeCopia(null, mapa), null);
});

test('el estilo: las claves de una clase con su id nuevo; las de una etapa y del curso, iguales', () => {
  const mapa = new Map([[10, 110]]);
  assert.equal(claveDeEstiloEnCopia('portada:clase:10', mapa), 'portada:clase:110');
  assert.equal(claveDeEstiloEnCopia('comentarios:clase:10', mapa), 'comentarios:clase:110');
  assert.equal(claveDeEstiloEnCopia('portada:clase:99', mapa), null, 'una clase que no se copió');
  assert.equal(claveDeEstiloEnCopia('portada:etapa:onboarding', mapa), 'portada:etapa:onboarding');
  assert.equal(claveDeEstiloEnCopia('acento', mapa), 'acento');
});

test('las tareas: sin el post ni la categoría de la otra comunidad; los adjuntos con su id nuevo', () => {
  const adj = new Map([[U1, U2]]);
  const campos = [
    { id: 'a', tipo: 'comentar', label: 'Comenta', postId: 5, postTitulo: 'Bienvenida' },
    { id: 'b', tipo: 'publicar', label: 'Publica', categoriaId: 3 },
    { id: 'c', tipo: 'seccion', label: 'Tarea 2', descripcionHtml: `<p><img src="mako-adjunto:${U1}"></p>` },
  ] as unknown as Campo[];
  const copia = camposDeCopia(campos, adj) as Array<Record<string, unknown>>;
  assert.equal(copia[0].postId, undefined);
  assert.equal(copia[0].postTitulo, undefined);
  assert.equal(copia[1].categoriaId, undefined);
  assert.equal(copia[2].descripcionHtml, `<p><img src="mako-adjunto:${U2}"></p>`);
  assert.equal(conAdjuntosDeCopia(`<a href="mako-adjunto:${U1}">x</a> y <img src="mako-adjunto:${U1}">`, adj), `<a href="mako-adjunto:${U2}">x</a> y <img src="mako-adjunto:${U2}">`);
});

test('los videos subidos: todos o ninguno, y un peso que no se leyó cuenta como que no entra', () => {
  const peso = new Map([['1/7/a.mp4', 100], ['1/7/b.mp4', 200]]);
  assert.deepEqual(videosACopiar(['1/7/a.mp4', '1/7/b.mp4', '1/7/a.mp4'], peso, 1000), { copiar: ['1/7/a.mp4', '1/7/b.mp4'], sinCopiar: [], bytes: 300 });
  assert.deepEqual(videosACopiar(['1/7/a.mp4', '1/7/b.mp4'], peso, 250).copiar, []);
  assert.deepEqual(videosACopiar(['1/7/a.mp4', '1/7/c.mp4'], peso, 1000).sinCopiar, ['1/7/a.mp4', '1/7/c.mp4'], 'sin el peso de uno, no se copia ninguno');
  assert.equal(TOPE_VIDEOS_COPIA, 300 * 1024 * 1024);
  assert.equal(extensionDe(`1/7/${U1}.webm`), 'webm');
});

test('el aviso de la copia dice lo que NO se copió', () => {
  assert.equal(avisoDeCopia({ nombre: 'X (copia)', videos: { sinCopiar: 0 }, adjuntos: { fallidos: 0 } }), '«X (copia)» creado');
  assert.equal(avisoDeCopia({ nombre: 'X (copia)', videos: { sinCopiar: 2 }, adjuntos: { fallidos: 1 } }),
    '«X (copia)» creado. 2 videos subidos quedaron afuera: súbelos de nuevo. 1 archivo no se copió.');
});

test('la copia NO toca nada de alumnos, y lo que copia sale del producto original', () => {
  const src = sinComentarios(leer('lib/curso-duplicar.ts'));
  for (const t of ['curso_accesos', 'curso_progreso', 'curso_desbloqueos', 'cliente_entrega', 'curso_sesiones', 'comunidad_']) {
    assert.ok(!src.includes(`'${t}`), `la copia toca ${t}`);
  }
  assert.match(src, /from\('curso_clases'\)\.select\(COLS_CLASE_COPIA\)\.eq\('producto_id', productoId\)\.is\('borrada_at', null\)/, 'copia clases de la papelera');
  assert.match(src, /from\('curso_modulos'\)\.select\('clave, vinculado, nombre, despues_de, bloqueo'\)\.eq\('producto_id', productoId\)\.is\('borrado_at', null\)/);
  // Los archivos, a rutas del producto NUEVO (el alumno ve sólo los de su producto).
  assert.match(src, /const destino = `\$\{ws\}\/\$\{nuevo\}\/\$\{randomUUID\(\)\}\.\$\{extensionDe\(path\) \?\? 'mp4'\}`;/);
  assert.match(src, /const pathNuevo = `\$\{ws\}\/\$\{nuevo\}\/\$\{idNuevo\}\.\$\{extensionDe\(a\.path\) \?\? 'bin'\}`;/);
  // Los candados DESPUÉS de tener todos los ids nuevos.
  assert.ok(antes(src, 'claseNueva.set(Number(c.id), id);', 'bloqueoDeCopia(saneaBloqueo(c.bloqueo), claseNueva)'));
  // Una copia a medias no queda a la vista.
  assert.match(src, /\} catch \(e\) \{\s*await eliminarPrograma\(nuevo\)/);
});

test('la action es de un admin; la cabecera navega duro a la copia y su «Deshacer» la quita', () => {
  const acc = sinComentarios(leer('app/customer-success/actions.ts'));
  const dup = tramo(acc, 'export async function duplicarServicioAction(', '\n}\n');
  assert.ok(antes(dup, 'const ws = await adminDeWorkspaceActual();', 'duplicarPrograma('), 'duplica sin ser admin');
  const shell = sinComentarios(leer('app/clients/ClientsShell.tsx'));
  const d = tramo(shell, 'const duplicar = async (p: ProgramaClients) => {', 'const elegirEnPrograma = ');
  assert.match(d, /anotarDeshacer\(avisoDeCopia\(r\.copia\), \{ tipo: 'quitarCopia', id: r\.copia\.productoId, volverA: p\.id \}\);/);
  assert.match(d, /window\.location\.href = conWs\(hrefConPrograma\(pathname, search, r\.copia\.productoId\), ws\);/);
  const deshacer = tramo(shell, 'const deshacerNota = useCallback(', '}, [show, ws]);');
  assert.match(deshacer, /a\.tipo === 'restaurar' \? restaurarServicioAction\(a\.id, a\.deshacer\) : eliminarServicioAction\(a\.id\)/);
  assert.match(shell, /else if \(id === 'duplicar'\) void duplicar\(p\);/);
});

test('la API de MaKo declara duplicar, renombrar, eliminar y restaurar un curso (lo que hace el menú del programa)', () => {
  for (const id of ['duplicar_curso', 'renombrar_curso', 'eliminar_curso', 'restaurar_curso']) {
    const d = REGISTRO.find((x) => x.id === id);
    assert.ok(d, `falta ${id} en el registro`);
    assert.equal(d!.area, 'curso');
  }
  const run = sinComentarios(leer('lib/api-mako/areas/curso.run.ts'));
  assert.match(run, /const r = await duplicarPrograma\(ctx\.ws, Number\(p\.productoId\), autorDe\(ctx\)\);/);
  assert.match(run, /const r = await eliminarPrograma\(Number\(p\.productoId\)\);/);
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 25/10/2026 contra este archivo (9 tests), cada una sola (scratchpad de la sesión «Clients»,
// romper-duplicar.mjs, restaura de una copia en memoria): el candado con el id viejo · la tarea con el post de la otra
// comunidad · el estilo de una clase con el id viejo · un video sin peso leído que igual se copia · copiar clases de la
// papelera · una copia a medias que queda a la vista · el video copiado a la MISMA ruta · duplicar sin ser admin · la
// copia sin su «Deshacer» · el aviso sin los videos que quedaron afuera → cada una, 1 fallo y 8 pases.
