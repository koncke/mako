// =============================================================================
// curso-portal — el portal del alumno: qué etapa se abre, qué clase se le abre a quién, y que
// las rutas públicas arranquen por el token
// =============================================================================
// Lo que se EJECUTA: lib/curso-portal.ts (la mitad pura) y app/compartido/curso/[token]/
// tarea-valores.ts. Lo que se LEE como fuente (sin comentarios): las tres rutas de
// app/api/compartido/curso y la página, para fijar que el workspace sale de la FIRMA del token y
// que lo primero que corre adentro de `runWithWorkspace` es `resolverAcceso`.
//
// Probado ROMPIÉNDOLO (06/10/2026) con un arnés que rompe una regla por vez y restaura de MEMORIA
// (nunca con git). Con todo en su lugar: 21 pass / 0 fail. Cada rotura tumba SU test:
//   · `estadosDeEtapas` sin el «sin actual, la primera» (iActual = -1)       → 20 / 1 «sin fila…»
//   · `decidirClase` sin mirar el producto del alumno                         → 20 / 1 «clase ajena…»
//   · `armarEtapas` mandando las clases de una etapa bloqueada               → 20 / 1 «lo bloqueado no viaja»
//   · `videoDeClase` creyéndole a `video_tipo` en vez de reconocer el link    → 20 / 1 «el link manda»
//   · la ruta de video validando el path contra un producto que manda el pedido → 20 / 1 «el bucket es uno»
//   · `leerJsonTopeado` sin contar bytes (sólo el content-length)            → 20 / 1 «el tope se cuenta»
//   · `campoLleno` contando la etiqueta de una fila fija                     → 20 / 1 «la etiqueta no cuenta»
//   · la ruta de progreso leyendo el workspace de `b.ws`                     → 19 / 2 (los dos guards de la firma)
//   · la ruta de video llamando a `claseDelAlumno` antes de `resolverAcceso` → 20 / 1 «resolverAcceso primero»
//   · `/api/compartido/curso/tarea` fuera de PUBLICOS_ESCRITURA              → 20 / 1 «las que escriben…»
//   · la página contando el ingreso DESPUÉS de armar la vista                → 20 / 1 «la página también…»
//   · PortalAlumno importando un VALOR de lib/curso-portal                   → 20 / 1 «sólo importan TIPOS»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  estadosDeEtapas, decidirClase, armarEtapas, videoDeClase, leerJsonTopeado, idDeClase, primerNombre,
} from '../lib/curso-portal';
import { campoLleno, queFalta, filasDeTabla, fraseQueFalta } from '../app/compartido/curso/[token]/tarea-valores';
import { pathEsDelProducto } from '../app/customer-success/curso/reglas';
import { esPublicaDeEscritura, PUBLICOS_ESCRITURA } from '../lib/rutas-publicas';
import type { Clase, Progreso, Campo } from '../lib/curso';

const RAIZ = join(import.meta.dirname, '..');

const clase = (id: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa: 'e1', orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
});
const prog = (claseId: number, o: Partial<Progreso> = {}): Progreso => ({
  claseId, segundosMax: 0, duracionSeg: null, pct: 0, vistoAt: null, valores: {}, estado: 'pendiente', enviadaAt: null, ...o,
});

// ── Las etapas ────────────────────────────────────────────────────────────────

test('estadosDeEtapas: antes de la actual hechas, la actual abierta, después bloqueadas', () => {
  assert.deepEqual(estadosDeEtapas(['a', 'b', 'c', 'd'], 'b'), { a: 'hecha', b: 'actual', c: 'bloqueada', d: 'bloqueada' });
  assert.deepEqual(estadosDeEtapas(['a', 'b'], 'b'), { a: 'hecha', b: 'actual' });
  assert.deepEqual(estadosDeEtapas([], 'a'), {});
});

test('sin fila (o con una etapa que ya no existe) está en la PRIMERA, no en ninguna', () => {
  // Es la regla del kanban: los 14 clientes de Mauricio arrancan sin fila en cliente_entrega.
  // Con «ninguna» abrirían el link a un programa entero cerrado.
  assert.deepEqual(estadosDeEtapas(['a', 'b', 'c'], null), { a: 'actual', b: 'bloqueada', c: 'bloqueada' });
  assert.deepEqual(estadosDeEtapas(['a', 'b'], 'borrada'), { a: 'actual', b: 'bloqueada' });
});

test('decidirClase: una clase ajena es un 404, igual que una que no existe', () => {
  const c = clase(5, { productoId: 7 });
  assert.equal(decidirClase(null, [7], 'actual', true), 'no-existe');
  assert.equal(decidirClase(c, [1, 2], 'actual', true), 'no-existe', 'producto que el cliente no compró');
  assert.equal(decidirClase(c, [], 'actual', false), 'no-existe');
  assert.equal(decidirClase(c, [7], 'actual', true), 'ok');
  assert.equal(decidirClase(c, [7], 'hecha', true), 'ok', 'lo de atrás se puede releer y corregir');
});

test('decidirClase: con la etapa exigida, bloqueada o desconocida no se abre', () => {
  const c = clase(5, { productoId: 7 });
  assert.equal(decidirClase(c, [7], 'bloqueada', true), 'bloqueada');
  assert.equal(decidirClase(c, [7], undefined, true), 'bloqueada', 'una etapa que ya no existe en la entrega');
  assert.equal(decidirClase(c, [7], 'bloqueada', false), 'ok', 'el progreso no exige la etapa');
});

test('armarEtapas: agrupa en el orden de la entrega, ordena por orden y cuenta lo que cierra la etapa', () => {
  const etapas = [{ key: 'e1', label: 'Uno' }, { key: 'e2', label: 'Dos' }];
  const clases = [
    clase(3, { etapa: 'e1', orden: 2, obligatoria: true, tarea: 'hazlo' }),
    clase(1, { etapa: 'e1', orden: 1, obligatoria: true, tarea: 'hazlo' }),
    clase(2, { etapa: 'e1', orden: 1 }), // sin tarea: no cuenta como obligatoria
    clase(9, { etapa: 'vieja' }), // su etapa ya no existe: no se dibuja
  ];
  const vista = armarEtapas(etapas, 'e1', clases, new Map([[1, prog(1, { estado: 'enviada' })]]));
  assert.deepEqual(vista.map((e) => [e.key, e.estado]), [['e1', 'actual'], ['e2', 'bloqueada']]);
  assert.deepEqual(vista[0].clases.map((c) => c.id), [1, 2, 3], 'orden, y a igual orden el id');
  assert.equal(vista[0].obligatorias, 2);
  assert.equal(vista[0].enviadas, 1);
  // Lo que ve el alumno cuenta TODAS las tareas (aquí, las dos con tarea; la 2 no pide nada).
  assert.equal(vista[0].tareas, 2);
  assert.equal(vista[0].tareasEnviadas, 1);
  assert.equal(vista[0].clases.find((c) => c.id === 1)?.estado, 'enviada');
  assert.ok(!vista.flatMap((e) => e.clases).some((c) => c.id === 9), 'una clase huérfana no aparece');
});

test('lo bloqueado no viaja: se manda cuántas clases tiene, no su contenido', () => {
  const etapas = [{ key: 'e1', label: 'Uno' }, { key: 'e2', label: 'Dos' }];
  const clases = [clase(1, { etapa: 'e1' }), clase(2, { etapa: 'e2', tarea: 'secreto' }), clase(3, { etapa: 'e2' })];
  const [, e2] = armarEtapas(etapas, 'e1', clases, new Map());
  assert.equal(e2.estado, 'bloqueada');
  assert.equal(e2.clases.length, 0);
  assert.equal(e2.cuantas, 2);
});

// ── El video ──────────────────────────────────────────────────────────────────

test('videoDeClase: qué reproductor lleva cada clase y si se mide', () => {
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'archivo', videoPath: '1/a.mp4' })), { video: { tipo: 'archivo' }, medible: true });
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'archivo', videoPath: null })), { video: null, medible: false });
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'youtube', videoUrl: 'https://youtu.be/abc' })), { video: { tipo: 'youtube', id: 'abc' }, medible: true });
  assert.equal(videoDeClase(clase(1, { videoTipo: 'vimeo', videoUrl: 'https://vimeo.com/123' })).video?.tipo, 'vimeo');
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'drive', videoUrl: 'https://drive.google.com/file/d/X/view' })).medible, false);
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'url', videoUrl: 'https://cdn.x.com/a.mp4' })), { video: { tipo: 'directo', url: 'https://cdn.x.com/a.mp4' }, medible: true });
  assert.equal(videoDeClase(clase(1, { videoTipo: 'url', videoUrl: 'https://cdn.x.com/pagina' })).video?.tipo, 'afuera');
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'ninguno', videoUrl: 'https://youtu.be/abc' })), { video: null, medible: false });
});

test('el link manda, no la columna: lo guardado termina en el src de un iframe del cliente', () => {
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'youtube', videoUrl: 'javascript:alert(1)' })), { video: null, medible: false });
  // Guardado como 'youtube' pero es un link de Drive: va en un iframe sin medir, no a la API de YouTube.
  const v = videoDeClase(clase(1, { videoTipo: 'youtube', videoUrl: 'https://drive.google.com/file/d/X/view' }));
  assert.equal(v.video?.tipo, 'iframe');
  assert.equal(v.medible, false);
});

test('claseVista: un video que no se mide viaja con pct null («sin medir»), no con 0', () => {
  const [e] = armarEtapas([{ key: 'e1', label: 'Uno' }], 'e1', [
    clase(1, { videoTipo: 'loom', videoUrl: 'https://www.loom.com/share/abc' }),
    clase(2, { videoTipo: 'youtube', videoUrl: 'https://youtu.be/x' }),
  ], new Map([[2, prog(2, { pct: 40 })]]));
  assert.equal(e.clases[0].pct, null);
  assert.equal(e.clases[1].pct, 40);
});

test('el bucket es uno para todos: la ruta de video firma sólo lo del workspace Y del producto de la clase', () => {
  // La regla vive en la tab Curso (la usa al guardar); la ruta pública la llama con el
  // workspace de la FIRMA y el producto de la clase. Acá se fija el cableado y se ejecuta la regla.
  const src = leer('app/api/compartido/curso/video/route.ts');
  assert.match(src, /pathEsDelProducto\(\s*r\.clase\.videoPath\s*,\s*acceso\.ws\s*,\s*r\.clase\.productoId\s*\)/);
  assert.ok(src.indexOf('pathEsDelProducto(') < src.indexOf('createSignedUrl('), 'se valida antes de firmar');
  const u = '0f8fad5b-d9cb-469f-a165-70867728950e';
  assert.equal(pathEsDelProducto(`1/7/${u}.mp4`, 1, 7), true);
  assert.equal(pathEsDelProducto(`2/7/${u}.mp4`, 1, 7), false, 'carpeta de otro inquilino');
  assert.equal(pathEsDelProducto(`10/7/${u}.mp4`, 1, 7), false, 'el 10 empieza con 1 y no es el 1');
  assert.equal(pathEsDelProducto(`1/8/${u}.mp4`, 1, 7), false, 'otro producto');
  assert.equal(pathEsDelProducto(`1/7/../../2/7/${u}.mp4`, 1, 7), false);
  assert.equal(pathEsDelProducto(null, 1, 7), false);
});

// ── El cuerpo de las rutas que escriben ───────────────────────────────────────

const pedido = (cuerpo: string, headers: Record<string, string> = {}) =>
  new Request('http://x/api', { method: 'POST', body: cuerpo, headers });

test('el tope se cuenta en bytes, no se le cree al content-length', async () => {
  assert.deepEqual(await leerJsonTopeado(pedido('{"a":1}'), 100), { ok: true, valor: { a: 1 } });
  assert.deepEqual(await leerJsonTopeado(pedido('no es json'), 100), { ok: false, status: 400 });
  // Sin content-length (chunked): lo que corta es contar.
  const largo = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`{"a":"${'x'.repeat(500)}"}`)); c.close(); } });
  const r = new Request('http://x/api', { method: 'POST', body: largo, duplex: 'half' } as RequestInit);
  assert.deepEqual(await leerJsonTopeado(r, 100), { ok: false, status: 413 });
  // Y un content-length declarado de más corta sin leer.
  assert.deepEqual(await leerJsonTopeado(pedido('{}', { 'content-length': '999999' }), 100), { ok: false, status: 413 });
});

test('idDeClase y primerNombre: lo que llega del navegador', () => {
  assert.equal(idDeClase(12), 12);
  assert.equal(idDeClase('12'), 12);
  for (const malo of [0, -1, 1.5, '1e3', 'abc', null, undefined, {}]) assert.equal(idDeClase(malo), null, String(malo));
  assert.equal(primerNombre('  María José Pérez '), 'María');
  assert.equal(primerNombre(''), null);
  assert.equal(primerNombre(null), null);
});

// ── La tarea (lo que mira la pantalla antes de mandar) ────────────────────────

const tabla = (o: Partial<Campo> = {}): Campo => ({ id: 't', label: 'Tabla', tipo: 'tabla', columnas: ['Bloque', 'Cuántas'], ...o });

test('la etiqueta de una fila fija no cuenta como contestada', () => {
  const c = tabla({ filasFijas: ['Las buenas', 'Las malas'], obligatorio: true });
  const soloEtiquetas = filasDeTabla(c, undefined);
  assert.deepEqual(soloEtiquetas, [['Las buenas', ''], ['Las malas', '']]);
  assert.equal(campoLleno(c, soloEtiquetas), false);
  assert.equal(campoLleno(c, [['Las buenas', '3'], ['Las malas', '']]), true);
  // Sin filas fijas, la primera columna es del alumno y sí cuenta.
  assert.equal(campoLleno(tabla(), [['algo', '']]), true);
});

test('filasDeTabla: las fijas mandan en su orden; filasMin se ve desde el arranque', () => {
  const c = tabla({ filasFijas: ['A', 'B'] });
  assert.deepEqual(filasDeTabla(c, [['otra cosa', '1'], ['x', '2'], ['de más', '9']]), [['A', '1'], ['B', '2']]);
  assert.equal(filasDeTabla(tabla({ filasMin: 3 }), undefined).length, 3);
  assert.equal(filasDeTabla(tabla(), undefined).length, 1);
});

test('queFalta: misma regla que el server, dicha en una frase', () => {
  assert.deepEqual(queFalta([], {}), { tipo: 'respuesta' });
  assert.equal(queFalta([], { respuesta: 'listo' }), null);
  const a: Campo = { id: 'a', label: 'Tu meta', tipo: 'texto', obligatorio: true };
  const b: Campo = { id: 'b', label: 'Tu plazo', tipo: 'linea', obligatorio: true };
  const libre: Campo = { id: 'c', label: 'Algo más', tipo: 'texto' };
  assert.deepEqual(queFalta([a, b], { a: 'crecer' }), { tipo: 'campos', labels: ['Tu plazo'] });
  assert.equal(queFalta([a, b], { a: 'crecer', b: '3 meses' }), null);
  assert.deepEqual(queFalta([libre], {}), { tipo: 'alguno' });
  assert.equal(fraseQueFalta({ tipo: 'campos', labels: ['Tu plazo', 'Tu meta'] }), 'Falta «Tu plazo» y 1 más.');
});

// ── Las rutas públicas: el workspace sale de la firma y lo primero es resolverAcceso ──────────

const DIR_RUTAS = join(RAIZ, 'app/api/compartido/curso');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));

// En POSITIVO: una ruta nueva bajo esta carpeta falla acá hasta que alguien decide que cumple.
const RUTAS = { progreso: 'POST', tarea: 'POST', video: 'GET' } as const;

test('las rutas del portal son exactamente éstas', () => {
  const hay = readdirSync(DIR_RUTAS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  assert.deepEqual(hay, Object.keys(RUTAS).sort());
  for (const r of Object.keys(RUTAS)) assert.ok(existsSync(join(DIR_RUTAS, r, 'route.ts')), r);
});

test('cada ruta: el workspace sale de la firma y lo primero adentro de runWithWorkspace es resolverAcceso', () => {
  for (const [r, metodo] of Object.entries(RUTAS)) {
    const src = leer(`app/api/compartido/curso/${r}/route.ts`);
    const handlers = [...src.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
    assert.deepEqual(handlers, [metodo], `${r}: un solo handler, ${metodo}`);

    const firma = src.match(/const\s+(\w+)\s*=\s*leerAccesoCurso\(/);
    assert.ok(firma, `${r}: la firma sale de leerAccesoCurso`);
    const v = firma![1];
    const run = new RegExp(`runWithWorkspace\\(\\s*${v}\\.ws\\s*,\\s*async\\s*\\(\\)\\s*=>\\s*\\{\\s*const\\s+(\\w+)\\s*=\\s*await\\s+resolverAcceso\\(`);
    const m = src.match(run);
    assert.ok(m, `${r}: runWithWorkspace(${v}.ws, …) tiene que arrancar con resolverAcceso`);

    // Nada que lea la base corre antes de resolverAcceso.
    const iResolver = src.indexOf('resolverAcceso(');
    for (const lectura of ['claseDelAlumno(', 'claseDeId(', 'productosDelAlumno(', 'guardarVisto(', 'guardarTarea(', 'alEnviarTarea(', 'getTenantDb(', 'getSupabaseServer(', 'createSignedUrl(']) {
      const i = src.indexOf(lectura);
      if (i >= 0) assert.ok(i > iResolver, `${r}: ${lectura} corre antes de resolverAcceso`);
    }
    // Toda clase pedida pasa por claseDelAlumno (que valida existencia + producto del alumno).
    assert.ok(src.includes('claseDelAlumno('), `${r}: la clase se valida contra el alumno`);
  }
});

test('el workspace sale de la firma: ninguna ruta lo lee del pedido', () => {
  for (const r of Object.keys(RUTAS)) {
    const src = leer(`app/api/compartido/curso/${r}/route.ts`);
    assert.doesNotMatch(src, /\.get\(\s*['"]ws['"]\s*\)/, `${r}: ?ws= del pedido`);
    const usos = [...src.matchAll(/\b(\w+)\.ws\b/g)].map((m) => m[1]);
    for (const u of usos) assert.ok(u === 'firma' || u === 'acceso', `${r}: «${u}.ws» no es el workspace de la firma`);
  }
});

test('las que escriben están en PUBLICOS_ESCRITURA; la que lee, no', () => {
  for (const [r, metodo] of Object.entries(RUTAS)) {
    const ruta = `/api/compartido/curso/${r}`;
    assert.equal(esPublicaDeEscritura(ruta), metodo === 'POST', ruta);
  }
  assert.ok((PUBLICOS_ESCRITURA as readonly string[]).includes('/api/compartido/curso/tarea'));
});

test('la página también arranca por la firma y por resolverAcceso, y cuenta el ingreso', () => {
  const src = leer('app/compartido/curso/[token]/page.tsx');
  assert.match(src, /const\s+firma\s*=\s*leerAccesoCurso\(token\)/);
  // El callback puede llevar su tipo de retorno (`async (): Promise<…> => {`).
  assert.match(src, /runWithWorkspace\(\s*firma\.ws\s*,\s*async\s*\(\)\s*(?::[^=]+)?=>\s*\{\s*const\s+acceso\s*=\s*await\s+resolverAcceso\(token\)/);
  assert.ok(src.indexOf('contarIngreso(') > src.indexOf('resolverAcceso('));
  assert.ok(src.indexOf('contarIngreso(') < src.indexOf('armarVistaAlumno('), 'el ingreso se cuenta antes de armar la vista');
});

test('los componentes del portal sólo importan TIPOS de lib/curso-portal (trae la capa de datos)', () => {
  const dir = join(RAIZ, 'app/compartido/curso/[token]');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx') || x.endsWith('.ts'))) {
    if (f === 'page.tsx') continue; // el server sí la llama
    const src = sinComentarios(readFileSync(join(dir, f), 'utf8'));
    const imports = [...src.matchAll(/import\s+(type\s+)?[^;]*?from\s+['"]@\/lib\/curso-portal['"]/g)];
    for (const m of imports) assert.ok(m[1], `${f}: importa un VALOR de lib/curso-portal`);
  }
});
