// =============================================================================
// curso-adjuntos — los archivos de la descripción de una clase: reglas, subida, puertas, migración
// =============================================================================
// Ejecuta lib/curso-adjuntos-reglas.ts (puro: tipos, topes, path, registro, quién ve qué, y la
// subida con piezas inyectadas) y lee como TEXTO lo que no se puede ejecutar sin base ni sesión: la
// ruta del alumno, las actions del equipo, lib/curso-adjuntos.ts, el editor y la migración 0216.
// Todo lo que lee fuente normaliza CRLF y busca sobre el texto SIN comentarios (AGENTS.md).
//
// Probado ROMPIÉNDOLO (07/10/2026), una rotura por vez sobre el archivo real, restaurado desde la
// copia en memoria (verificado por hash). Con todo en su lugar: 15 pass / 1 fail — el que falla es
// «el registro del inquilino», ROJO A PROPÓSITO hasta que se registre `curso_adjuntos` (INTEGRACIÓN
// PENDIENTE: esta pista no puede tocar lib/workspace.ts, lib/tablas-de-inquilino.ts ni
// lib/reset-workspace.ts). Cada rotura dio 14 / 2 (el suyo + ese), y el que cayó fue SU test:
//   · `mimeDeAdjunto` mira el tipo del navegador ANTES que la extensión  → el del .zip de Windows y el .csv
//   · `decidirAdjuntoAlumno` sin preguntar si la descripción lo nombra   → quién ve qué
//   · `validarRegistroAdjunto` sin el chequeo de tipo contra extensión   → el registro
//   · la subida sin el tope antes de firmar                              → la subida
//   · la ruta con `exigeEtapa: false`                                    → la ruta
//   · `urlsAdjuntosAction` con `puedeEditar` en vez de `puedeVer`         → las puertas
//   · `puedeEditar` de adjuntos-actions sin el chequeo de admin           → la copia de la puerta
//     (08/10/2026: ya no hay copia — las tres actions importan de ./puerta-curso. La rotura es ahora
//     `puedeEditar` de puerta-curso.ts sin el chequeo de admin → 16 / 1 «la puerta es UNA», sobre 17;
//     y la ruta con `exigeAbierta: false` → 16 / 1 «la ruta del alumno».)
//   · una lectura de `curso_adjuntos` sin su `workspace_id` a mano        → el workspace a mano
//   · `image/svg+xml` sumado a la lista del bucket en la migración        → la migración
// ⚠️ Y UNA QUE NO TUMBÓ NADA (15 / 1), y está bien: sacar SÓLO la comparación de producto de
//    `decidirAdjuntoAlumno` no afloja nada, porque el path del adjunto lleva el producto y el chequeo
//    del path lo frena igual. Sacando las dos, cae «quién ve qué» (14 / 2).
//
// REVISIÓN ADVERSARIAL (08/10/2026): «el pegado» es nuevo, y con él son 16 / 1 (el rojo sigue siendo
// el del registro). Cubre dos defectos del editor que ningún test miraba, y cada rotura dio 15 / 2:
//   · `pegadoEsDeArchivos` devolviendo «hay archivos» (lo de antes: un párrafo de Word con su foto
//     de regalo se subía como FOTO y el texto se tiraba) → cae «el pegado»;
//   · `handlePaste` sin mirar el HTML del pegado → cae «el pegado»;
//   · `handleDrop` sin consumir el contador de imágenes de afuera (el próximo pegado de texto plano
//     avisaba de imágenes que nadie pegó) → cae «el pegado».

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MIME_ADJUNTO, TOPE_ADJUNTO_BYTES, BUCKET_ADJUNTOS, mimeDeAdjunto, archivoConTipo, pathDeAdjunto,
  pathEsAdjuntoDelProducto, esAdjuntoDescripcionSubido, uuidDePath, validarRegistroAdjunto, urlAdjuntoDelAlumno,
  decidirAdjuntoAlumno, descargaComo, crearSubidorDeAdjuntos, esImagenAdjunto, ACEPTA_ADJUNTO,
  type PiezasSubida, type EntradaRegistroAdjunto,
} from '../lib/curso-adjuntos-reglas';
import { esPublicaSoloLectura, esPublicaDeEscritura } from '../lib/rutas-publicas';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';
// El editor es 'use client', y `tsx` ignora la directiva: acá se importa por su regla pura del
// pegado (`pegadoEsDeArchivos`), que no toca el DOM. Trae TipTap al proceso del test, y carga.
import { pegadoEsDeArchivos } from '../app/_ui/EditorRico';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas `//` PRIMERO y los bloques después (AGENTS.md: un `/*` adentro de un comentario de
// línea abre un bloque que se come el código del medio).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función, hasta la próxima declaración de nivel superior. */
const bloque = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.slice(i + firma.length).search(/\n(export |async function |function |const |type )/);
  return fin < 0 ? src.slice(i) : src.slice(i, i + firma.length + fin);
};

const U = '0f8fad5b-d9cb-469f-a165-70867728950e';
const U2 = '9a3c2b1d-1111-4222-8333-444455556666';

// ── Tipos, topes y el path ───────────────────────────────────────────────────

test('el tipo se decide por la EXTENSIÓN primero: el .zip de Windows y el .csv con Excel entran', () => {
  assert.equal(mimeDeAdjunto('Plantilla.zip', 'application/x-zip-compressed'), 'application/zip');
  assert.equal(mimeDeAdjunto('datos.csv', 'application/vnd.ms-excel'), 'text/csv');
  assert.equal(mimeDeAdjunto('Contrato.DOCX', ''), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(mimeDeAdjunto('foto.jpeg', 'image/jpeg'), 'image/jpeg');
  assert.equal(mimeDeAdjunto('sin-extension', 'application/pdf'), 'application/pdf');
  // Lo que puede llevar código no entra, ni por la extensión ni por el tipo.
  assert.equal(mimeDeAdjunto('logo.svg', 'image/svg+xml'), null);
  assert.equal(mimeDeAdjunto('sin-extension', 'image/svg+xml'), null);
  assert.equal(mimeDeAdjunto('pagina.html', 'text/html'), null);
  assert.equal(mimeDeAdjunto('clase.mp4', 'video/mp4'), null, 'un video va al video de la clase, no acá');
  assert.ok(ACEPTA_ADJUNTO.includes('.zip') && ACEPTA_ADJUNTO.includes('application/pdf'));
  assert.equal(esImagenAdjunto('image/png'), true);
  assert.equal(esImagenAdjunto('image/svg+xml'), false);
});

test('archivoConTipo re-etiqueta el archivo sin cambiarle el nombre ni el contenido', async () => {
  const f = new File(['PK'], 'Plantilla.zip', { type: 'application/x-zip-compressed' });
  const g = archivoConTipo(f, 'application/zip');
  assert.equal(g.type, 'application/zip');
  assert.equal(g.name, 'Plantilla.zip');
  assert.equal(await g.text(), 'PK');
  assert.equal(archivoConTipo(g, 'application/zip'), g, 'si ya tiene el tipo, es el mismo archivo');
});

test('el path: workspace y producto primero, puestos por el server, y nada de rutas raras', () => {
  const p = pathDeAdjunto(4, 7, 'application/pdf', U);
  assert.equal(p, `4/7/${U}.pdf`);
  assert.equal(pathDeAdjunto(4, 7, 'image/svg+xml', U), null);
  assert.equal(pathDeAdjunto(4, 7, 'application/pdf', 'no-uuid'), null);
  assert.equal(pathDeAdjunto(0, 7, 'application/pdf', U), null);
  assert.equal(pathEsAdjuntoDelProducto(p, 4, 7), true);
  assert.equal(pathEsAdjuntoDelProducto(p, 5, 7), false, 'de otro negocio');
  assert.equal(pathEsAdjuntoDelProducto(p, 4, 8), false, 'de otro producto');
  assert.equal(pathEsAdjuntoDelProducto(`4/7/../9/${U}.pdf`, 4, 7), false);
  assert.equal(pathEsAdjuntoDelProducto(`4/7/${U.toUpperCase()}.pdf`, 4, 7), false);
  assert.equal(pathEsAdjuntoDelProducto(`4/7/${U}.exe`, 4, 7), false);
  assert.equal(esAdjuntoDescripcionSubido(`12/3/${U}.zip`), true);
  assert.equal(esAdjuntoDescripcionSubido(`12/3/${U}.mp4`), false);
  assert.equal(uuidDePath(p), U);
  assert.equal(uuidDePath('x/y/z.pdf'), null);
  assert.equal(BUCKET_ADJUNTOS, 'curso-adjuntos');
});

// ── El registro ──────────────────────────────────────────────────────────────

test('validarRegistroAdjunto: el id sale del path, el tipo tiene que ser el de la extensión, y el tope es el del bucket', () => {
  const ctx = { ws: 4, productoId: 7 };
  const base = { productoId: 7, claseId: 3, path: `4/7/${U}.pdf`, nombre: 'C:\\docs\\Precios 2026.pdf', mime: 'application/pdf', bytes: 1234.4 };
  const ok = validarRegistroAdjunto(base, ctx);
  assert.ok(ok.ok);
  assert.deepEqual(ok.fila, { id: U, producto_id: 7, clase_id: 3, path: `4/7/${U}.pdf`, nombre: 'Precios 2026.pdf', mime: 'application/pdf', bytes: 1234 });
  const err = (x: Record<string, unknown>) => { const r = validarRegistroAdjunto({ ...base, ...x }, ctx); return r.ok ? 'OK' : r.error; };
  assert.equal(err({ productoId: 8 }), 'Ese producto no es este.');
  assert.equal(err({ path: `5/7/${U}.pdf` }), 'Ese archivo no es de este curso.', 'el archivo de otro negocio');
  assert.equal(err({ path: `4/8/${U}.pdf` }), 'Ese archivo no es de este curso.');
  assert.equal(err({ mime: 'image/png' }), 'Ese formato no va.', 'un .pdf registrado como imagen se dibujaría roto');
  assert.equal(err({ mime: 'text/html' }), 'Ese formato no va.');
  assert.equal(err({ bytes: TOPE_ADJUNTO_BYTES + 1 }), 'Pasa de 25 MB.');
  assert.equal(err({ bytes: 0 }), 'Pasa de 25 MB.');
  assert.equal(err({ claseId: -2 }), 'Esa clase no existe.');
  const sinClase = validarRegistroAdjunto({ ...base, claseId: null }, ctx);
  assert.ok(sinClase.ok && sinClase.fila.clase_id === null, 'una clase que todavía no se guardó');
  assert.equal(validarRegistroAdjunto(null, ctx).ok, false);
});

// ── Quién ve qué ─────────────────────────────────────────────────────────────

test('la URL del alumno: la ruta pública con su token (codificado), la clase y el id', () => {
  assert.equal(urlAdjuntoDelAlumno('c1.a+b/c', 3, `mako-adjunto:${U}`), `/api/compartido/curso/adjunto?t=c1.a%2Bb%2Fc&c=3&a=${U}`);
  assert.equal(urlAdjuntoDelAlumno('tok', 3, 'https://otra.cosa'), null);
  assert.equal(urlAdjuntoDelAlumno('', 3, `mako-adjunto:${U}`), null);
  assert.equal(urlAdjuntoDelAlumno('tok', 0, `mako-adjunto:${U}`), null);
});

test('decidirAdjuntoAlumno: se sirve sólo lo que la descripción PUBLICADA de esa clase nombra, del mismo producto', () => {
  const adj = { id: U, productoId: 7, path: `4/7/${U}.png` };
  const clase = { id: 3, productoId: 7 };
  const html = `<p>Mira</p><img src="mako-adjunto:${U}" alt="" />`;
  assert.equal(decidirAdjuntoAlumno({ adjunto: adj, clase, htmlDeClase: html, ws: 4 }), 'ok');
  // La misma imagen pegada en OTRA clase del mismo curso: también es de esa clase.
  assert.equal(decidirAdjuntoAlumno({ adjunto: adj, clase: { id: 9, productoId: 7 }, htmlDeClase: html, ws: 4 }), 'ok');
  assert.equal(decidirAdjuntoAlumno({ adjunto: adj, clase, htmlDeClase: '<p>Ya no está</p>', ws: 4 }), 'no-existe', 'lo que se sacó deja de servirse');
  assert.equal(decidirAdjuntoAlumno({ adjunto: adj, clase, htmlDeClase: `<p>mako-adjunto:${U}</p>`, ws: 4 }), 'no-existe', 'nombrarlo en el TEXTO no es publicarlo');
  assert.equal(decidirAdjuntoAlumno({ adjunto: adj, clase: { id: 3, productoId: 8 }, htmlDeClase: html, ws: 4 }), 'no-existe', 'de otro producto');
  assert.equal(decidirAdjuntoAlumno({ adjunto: { ...adj, path: `5/7/${U}.png` }, clase, htmlDeClase: html, ws: 4 }), 'no-existe', 'un path de otro negocio');
  assert.equal(decidirAdjuntoAlumno({ adjunto: { ...adj, id: U2 }, clase, htmlDeClase: `<img src="mako-adjunto:${U2}" alt="" />`, ws: 4 }), 'no-existe', 'el id y el path no coinciden');
  assert.equal(decidirAdjuntoAlumno({ adjunto: null, clase, htmlDeClase: html, ws: 4 }), 'no-existe');
  assert.equal(decidirAdjuntoAlumno({ adjunto: adj, clase, htmlDeClase: null, ws: 4 }), 'no-existe');
});

test('lo que se ve en el navegador se abre; el resto se baja con su nombre', () => {
  assert.equal(descargaComo('application/pdf', 'a.pdf'), undefined);
  assert.equal(descargaComo('image/png', 'a.png'), undefined);
  assert.equal(descargaComo('application/zip', 'Plantilla.zip'), 'Plantilla.zip');
  assert.equal(descargaComo('application/vnd.ms-excel', ''), 'archivo');
});

// ── La subida, con piezas de mentira ─────────────────────────────────────────

type Llamadas = { firmar: unknown[][]; subir: Array<{ url: string; tipo: string; nombre: string }>; registrar: EntradaRegistroAdjunto[] };
function piezas(o: { firmaFalla?: string; subidaFalla?: string; registroFalla?: string; refMala?: boolean } = {}): { p: PiezasSubida; ll: Llamadas } {
  const ll: Llamadas = { firmar: [], subir: [], registrar: [] };
  const p: PiezasSubida = {
    firmar: async (...a) => { ll.firmar.push(a); return o.firmaFalla ? { ok: false, error: o.firmaFalla } : { ok: true, path: `4/7/${U}.zip`, signedUrl: 'https://s.co/up?token=x', apikey: 'anon' }; },
    subir: (url, file, _k, onProgreso) => {
      ll.subir.push({ url, tipo: file.type, nombre: file.name });
      onProgreso(40); onProgreso(99);
      return { promesa: o.subidaFalla ? Promise.reject(new Error(o.subidaFalla)) : Promise.resolve(), cancelar: () => {} };
    },
    registrar: async (e) => { ll.registrar.push(e); return o.registroFalla ? { ok: false, error: o.registroFalla } : { ok: true, id: U, ref: o.refMala ? 'nope' : `mako-adjunto:${U}`, nombre: e.nombre, mime: e.mime }; },
  };
  return { p, ll };
}

test('la subida: valida ANTES de firmar, sube re-etiquetado con progreso, registra y devuelve la referencia', async () => {
  const { p, ll } = piezas();
  const pcts: number[] = [];
  const subir = crearSubidorDeAdjuntos(p, { productoId: 7, claseId: 3 });
  const r = await subir(new File(['PK'], 'Plantilla.zip', { type: 'application/x-zip-compressed' }), (x) => pcts.push(x));
  assert.deepEqual(r, { ref: `mako-adjunto:${U}`, nombre: 'Plantilla.zip', mime: 'application/zip' });
  assert.deepEqual(ll.firmar, [[7, 'application/zip', 2]]);
  assert.deepEqual(ll.subir, [{ url: 'https://s.co/up?token=x', tipo: 'application/zip', nombre: 'Plantilla.zip' }]);
  assert.deepEqual(ll.registrar, [{ productoId: 7, claseId: 3, path: `4/7/${U}.zip`, nombre: 'Plantilla.zip', mime: 'application/zip', bytes: 2 }]);
  assert.deepEqual(pcts, [40, 99, 100], 'el 100 lo pone la subida cuando el server registró, no la barra');

  // Lo que no va, se dice ANTES de gastar la subida: ni se firma.
  for (const [f, msg] of [
    [new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }), 'Ese formato no va.'],
    [new File([], 'vacio.pdf', { type: 'application/pdf' }), 'El archivo está vacío.'],
    [new File([new Uint8Array(TOPE_ADJUNTO_BYTES + 1)], 'grande.pdf', { type: 'application/pdf' }), 'Pasa de 25 MB.'],
  ] as const) {
    const t = piezas();
    await assert.rejects(crearSubidorDeAdjuntos(t.p, { productoId: 7 })(f), { message: msg });
    assert.equal(t.ll.firmar.length, 0, `«${f.name}» se firmó igual`);
  }
});

test('la subida: cada falla rechaza con su error corto, y lo que falló antes no deja seguir', async () => {
  const pdf = () => new File(['%PDF'], 'a.pdf', { type: 'application/pdf' });
  const a = piezas({ firmaFalla: 'Ese producto no es tuyo.' });
  await assert.rejects(crearSubidorDeAdjuntos(a.p, { productoId: 7 })(pdf()), { message: 'Ese producto no es tuyo.' });
  assert.equal(a.ll.subir.length, 0);
  const b = piezas({ subidaFalla: 'Se cortó la conexión.' });
  await assert.rejects(crearSubidorDeAdjuntos(b.p, { productoId: 7 })(pdf()), { message: 'Se cortó la conexión.' });
  assert.equal(b.ll.registrar.length, 0, 'lo que no subió no se registra');
  const c = piezas({ registroFalla: 'El archivo no terminó de subir.' });
  await assert.rejects(crearSubidorDeAdjuntos(c.p, { productoId: 7 })(pdf()), { message: 'El archivo no terminó de subir.' });
  const d = piezas({ refMala: true });
  await assert.rejects(crearSubidorDeAdjuntos(d.p, { productoId: 7 })(pdf()), { message: 'No se pudo adjuntar.' });
  // Sin clase (una lección que todavía no se guardó): el registro va con `claseId: null`.
  const e = piezas();
  await crearSubidorDeAdjuntos(e.p, { productoId: 7 })(pdf());
  assert.equal(e.ll.registrar[0].claseId, null);
});

// ── La ruta del alumno ───────────────────────────────────────────────────────

test('la ruta del alumno: GET público de lectura, workspace de la FIRMA, y la única puerta con el candado', () => {
  const ruta = '/api/compartido/curso/adjunto';
  assert.equal(esPublicaSoloLectura(ruta), true, 'sin esto el proxy la corta con 401 antes de que corra');
  assert.equal(esPublicaDeEscritura(ruta), false, 'es de LECTURA: no se abre a POST');
  const src = sinComentarios(leer('app/api/compartido/curso/adjunto/route.ts'));
  assert.match(src, /export async function GET\(/);
  assert.doesNotMatch(src, /export async function (POST|PUT|PATCH|DELETE)\(/);
  assert.match(src, /const firma = leerTokenPortal\(token\);/);
  assert.match(src, /return runWithWorkspace\(firma\.ws, async \(\) => \{/, 'el workspace sale de la firma, nunca de un parámetro');
  assert.match(src, /await resolverAccesoPortal\(token\)/);
  // Con los PERMISOS del alumno (mig 0219): un adjunto de un módulo que no le permiten es el mismo 404.
  assert.match(src, /claseDelAlumno\(acceso\.leadId, claseId, \{ exigeAbierta: true, lider: acceso\.area, alcance: acceso\.alcance \}\)/, 'el candado de la clase y los permisos, por la ÚNICA puerta');
  assert.match(src, /if \(r\.decision !== 'ok'\) return NO\(\);/);
  assert.match(src, /urlAdjuntoParaAlumno\(\{ id: r\.clase\.id, productoId: r\.clase\.productoId \}, adjuntoId\)/);
  assert.match(src, /if \(!claseId \|\| !refDeId\(adjuntoId\)\) return NO\(\);/);
  // Y el server, después de la puerta, pregunta lo que falta con la regla pura.
  const lib = sinComentarios(leer('lib/curso-adjuntos.ts'));
  const para = bloque(lib, 'export async function urlAdjuntoParaAlumno(');
  assert.match(para, /decidirAdjuntoAlumno\(\{/);
  assert.match(para, /select\('id, producto_id, descripcion_html'\)/, 'la descripción se lee aparte, no de COLUMNAS_CLASE');
  assert.match(para, /if \(decision !== 'ok' \|\| !f\) return null;/);
});

// ── Las puertas del equipo ───────────────────────────────────────────────────

const ACC = 'app/customer-success/curso/adjuntos-actions.ts';

test('las actions: subir y registrar son de un ADMIN con su producto; ver, de quien ve la tab', () => {
  const crudo = leer(ACC);
  assert.match(sinComentarios(crudo).trimStart(), /^'use server';/);
  const src = sinComentarios(crudo);
  const malos = src.split('\n').filter((l) => /^export\s+(const|let|var|class|enum|default\s+(?!async))/.test(l) || /^export\s+function\s/.test(l));
  assert.deepEqual(malos, [], 'en un archivo use server sólo se exportan funciones async');
  for (const f of ['urlSubidaAdjuntoAction', 'registrarAdjuntoAction']) {
    const b = bloque(src, `export async function ${f}(`);
    assert.match(b, /const no = await puedeEditar\(\);\s*if \(no\) return/, `${f} no pregunta si es admin`);
    assert.match(b, /await productoPropio\(/, `${f} no mira que el producto sea suyo`);
  }
  for (const f of ['urlAdjuntoAction', 'urlsAdjuntosAction']) {
    const b = bloque(src, `export async function ${f}(`);
    assert.match(b, /const no = await puedeVer\(\);\s*if \(no\) return/, `${f} no pregunta si puede ver`);
    assert.doesNotMatch(b, /puedeEditar/, `${f} pide ser admin: el equipo no podría revisar el curso`);
  }
  assert.match(bloque(src, 'export async function registrarAdjuntoAction('), /registrarAdjunto\(entrada, u\?\.email \?\? null\)/, 'el autor sale de la SESIÓN');
});

test('la puerta es UNA: las tres actions de la tab Curso la importan de ./puerta-curso y ninguna tiene su copia', () => {
  // Hasta el 08/10/2026 vivía en actions.ts y COPIADA acá, con un test que comparaba los cuerpos. La
  // tercera copia (los módulos) era la que iba a quedar vieja: se mudó a un módulo y las copias se van.
  for (const r of [ACC, 'app/customer-success/curso/actions.ts', 'app/customer-success/curso/modulos-actions.ts']) {
    const src = sinComentarios(leer(r));
    assert.match(src, /import \{[^}]*\bpuedeEditar\b[^}]*\} from '\.\/puerta-curso';/, `${r} no importa la puerta`);
    for (const f of ['function puedeVer(', 'function puedeEditar(', 'function productoPropio(']) {
      assert.ok(!src.includes(f), `${r} volvió a tener su copia de ${f}`);
    }
  }
  const puerta = sinComentarios(leer('app/customer-success/curso/puerta-curso.ts'));
  assert.match(puerta, /^import 'server-only';/m);
  assert.doesNotMatch(puerta, /'use server'/, 'con use server cada helper sería un endpoint más');
  assert.match(bloque(puerta, 'export async function puedeVer('), /tabEnCapa\('customer-success', await getCapaActual\(\)\)/);
  const editar = bloque(puerta, 'export async function puedeEditar(');
  assert.match(editar, /const no = await puedeVer\(\);\s*if \(no\) return no;/);
  assert.match(editar, /if \(!\(await adminDeWorkspaceActual\(\)\)\) return/);
  assert.match(bloque(puerta, 'export async function productoPropio('), /from\('productos'\)\.select\('id'\)\.eq\('id', productoId\)/);
});

test('lib/curso-adjuntos: cada consulta a curso_adjuntos lleva su workspace_id A MANO', () => {
  const src = sinComentarios(leer('lib/curso-adjuntos.ts'));
  const usos = [...src.matchAll(/\.from\('curso_adjuntos'\)([\s\S]*?);/g)].map((m) => m[1]);
  assert.ok(usos.length >= 4, `esperaba al menos 4 consultas, hay ${usos.length}`);
  for (const u of usos) {
    assert.match(u, /\.eq\('workspace_id', ws\)|workspace_id: ws/, `una consulta sin su workspace: ${u.slice(0, 120)}`);
  }
  // Lo que firma, firma con vida corta y sólo lo que tiene la forma de un adjunto de este negocio.
  assert.match(bloque(src, 'async function adjuntosPorId('), /pathEsAdjuntoDelProducto\(f\.path, ws, Number\(f\.producto_id\)\) && uuidDePath\(f\.path\) === f\.id/);
  assert.match(bloque(src, 'export async function registrarAdjunto('), /\.exists\(v\.fila\.path\)/, 'se verifica que el archivo llegó antes de registrarlo');
});

// ── El editor y el dibujo ────────────────────────────────────────────────────

test('el editor: cliente, sin el saneador (que es del server), sin hidratar en el server, y la barra no roba el foco', () => {
  const ed = sinComentarios(leer('app/_ui/EditorRico.tsx'));
  assert.match(ed.trimStart(), /^'use client';/);
  assert.doesNotMatch(ed, /sanitize-html|lib\/html-seguro/, 'el saneo vive en el server: no viaja al navegador');
  assert.match(ed, /immediatelyRender: false/);
  assert.match(ed, /editor\.setEditable\(!soloLectura, false\)/, 'prender o apagar la edición no es un cambio del texto');
  assert.match(bloque(ed, 'function Boton('), /onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/);
  assert.match(ed, /transaction\.mapping\.map\(p\)/, 'la imagen va donde se soltó aunque se siga escribiendo');
  const hs = sinComentarios(leer('app/_ui/HtmlSeguro.tsx'));
  assert.doesNotMatch(hs.trimStart(), /^'use (client|server)'/, 'HtmlSeguro lo montan el server y el cliente');
  assert.doesNotMatch(hs, /from 'react'(?!;)|useState|useEffect/, 'sin hooks: corre de los dos lados');
  assert.doesNotMatch(hs, /sanitize-html/);
});

test('el pegado: una captura o una imagen copiada se SUBEN; el texto de Word con su foto de regalo se PEGA como texto', () => {
  assert.equal(pegadoEsDeArchivos(1, ''), true, 'una captura de pantalla no trae HTML');
  assert.equal(pegadoEsDeArchivos(1, undefined), true);
  assert.equal(pegadoEsDeArchivos(1, '<meta charset="utf-8"><img src="https://otra.web/foto.png" alt="">'), true, '«Copiar imagen» de una página: el HTML es sólo la imagen');
  assert.equal(pegadoEsDeArchivos(1, '<p>&nbsp;</p>'), true);
  // Word: comentarios condicionales, una hoja de estilos y el párrafo. Lo que importa es el párrafo.
  const word = '<html><head><style>p.MsoNormal{margin:0}</style></head><body><!--StartFragment--><p class="MsoNormal">Hola<o:p></o:p></p><!--EndFragment--></body></html>';
  assert.equal(pegadoEsDeArchivos(1, word), false, 'pegar un párrafo de Word subía una FOTO del párrafo y tiraba el texto');
  assert.equal(pegadoEsDeArchivos(1, '<table><tr><td>12</td><td>34</td></tr></table>'), false, 'las celdas de Excel son texto');
  assert.equal(pegadoEsDeArchivos(0, ''), false, 'sin archivos no hay nada que subir');
  // Y el editor lo usa en el pegado, con el HTML del MISMO pegado.
  const ed = sinComentarios(leer('app/_ui/EditorRico.tsx'));
  assert.match(ed, /pegadoEsDeArchivos\(files\.length, event\.clipboardData\?\.getData\('text\/html'\)\)/);
  // Soltar también pasa por `transformPastedHTML`: el contador de imágenes de afuera se consume ahí.
  const drop = ed.slice(ed.indexOf('handleDrop:'), ed.indexOf('onCreate:'));
  assert.ok(drop.length > 100 && drop.length < 2000, `el bloque de handleDrop mide ${drop.length}`);
  assert.match(drop, /imagenesFueraDelPegado\.current = 0;/, 'un drop deja el contador vivo y el próximo pegado avisa de imágenes que nadie pegó');
});

// ── La migración y el registro del inquilino ─────────────────────────────────

const MIG = 'supabase/migrations/0216_curso_adjuntos.sql';

test('0216: antes del deploy, la columna con default, la tabla con RLS y revoke, el bucket privado', () => {
  const crudo = leer(MIG);
  assert.match(crudo, /se aplica ANTES del deploy: el código nuevo la lee/);
  const sql = crudo.replace(/^\s*--.*$/gm, '');
  assert.match(sql, /alter table curso_clases add column if not exists descripcion_html text not null default '';/);
  assert.match(sql, /create table if not exists curso_adjuntos \(/);
  assert.match(sql, /id\s+uuid primary key default gen_random_uuid\(\)/);
  assert.match(sql, /workspace_id\s+bigint not null default 1 references workspaces\(id\) on delete cascade/);
  assert.match(sql, /producto_id\s+bigint not null references productos\(id\) on delete cascade/);
  assert.match(sql, /clase_id\s+bigint references curso_clases\(id\) on delete set null/);
  assert.match(sql, /alter table curso_adjuntos enable row level security;/);
  assert.match(sql, /revoke all on curso_adjuntos from anon, authenticated;/);
  const ins = sql.slice(sql.indexOf('insert into storage.buckets'));
  assert.match(ins, /values \('curso-adjuntos', 'curso-adjuntos', false, (\d+), array\[/);
  const tope = Number(/values \('curso-adjuntos', 'curso-adjuntos', false, (\d+)/.exec(ins)![1]);
  assert.equal(tope, TOPE_ADJUNTO_BYTES, 'el tope del bucket y el de la pantalla son distintos');
  const lista = ins.slice(ins.indexOf('array['), ins.indexOf(']'));
  const mimes = [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(mimes, [...MIME_ADJUNTO].sort(), 'la lista del bucket y MIME_ADJUNTO se separaron');
  assert.ok(!mimes.some((m) => /svg|html|javascript/.test(m)), 'nada que pueda llevar código');
  assert.match(ins, /on conflict \(id\) do update set public = false/);
});

test('el registro del inquilino: curso_adjuntos en TENANT_TABLES y en la lista, el bucket en el reset (INTEGRACIÓN PENDIENTE)', () => {
  // ⚠️ ROJO A PROPÓSITO hasta la integración: esta pista no puede tocar esos tres archivos. Lo que
  //    falta, exacto: `'curso_adjuntos'` en TENANT_TABLES (lib/workspace.ts) y en TABLAS_DE_INQUILINO
  //    (lib/tablas-de-inquilino.ts), y `'curso-adjuntos'` en BUCKETS (lib/reset-workspace.ts).
  const ws = sinComentarios(leer('lib/workspace.ts'));
  const tenant = ws.slice(ws.indexOf('const TENANT_TABLES'), ws.indexOf(']);', ws.indexOf('const TENANT_TABLES')));
  assert.match(tenant, /'curso_adjuntos'/, 'sin esto getTenantDb() es PASSTHROUGH para curso_adjuntos');
  assert.ok((TABLAS_DE_INQUILINO as readonly string[]).includes('curso_adjuntos'), 'falta en TABLAS_DE_INQUILINO: el reset la dejaría con filas huérfanas');
  const reset = sinComentarios(leer('lib/reset-workspace.ts'));
  const buckets = reset.split('\n').find((l) => l.includes('const BUCKETS'));
  assert.ok(buckets && buckets.includes("'curso-adjuntos'"), 'falta el bucket en el reset: vaciar un workspace dejaría sus archivos');
});
