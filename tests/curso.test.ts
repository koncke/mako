// =============================================================================
// curso — las reglas puras del curso (lib/curso.ts) y la firma del link (lib/curso-acceso.ts)
// =============================================================================
// Probado ROMPIÉNDOLO (06/10/2026) sobre COPIAS en el scratchpad (no sobre lib/: había agentes
// leyéndolo), una rotura por regla. Las cinco dan 11 pass / 1 fail, y cae el test de esa regla:
//   · `etapaCompleta` con `ob.length >= 0` (una etapa sin obligatorias se completa sola).
//   · `videoDeLink` sin el chequeo de protocolo (deja pasar `javascript:`).
//   · `leerAccesoCurso` sin comparar la firma.
//   · `sanearValores` copiando las claves que la clase no tiene.
//   · `respuestaCompleta` dando por completo un formulario vacío.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  videoDeLink, embedDe, pctVisto, etapaCompleta, pendientesDe, etapaSiguiente,
  sanearCampos, sanearValores, respuestaCompleta, obligatoriasDe, type Clase,
} from '../lib/curso';
import { firmarAccesoCurso, leerAccesoCurso } from '../lib/curso-acceso';

const clase = (id: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa: 'e1', orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
});

test('videoDeLink reconoce las plataformas y dice cuáles se pueden medir', () => {
  assert.deepEqual(videoDeLink('https://youtu.be/abc123')?.id, 'abc123');
  assert.equal(videoDeLink('https://www.youtube.com/watch?v=xyz')?.id, 'xyz');
  assert.equal(videoDeLink('https://youtube.com/shorts/sh1')?.id, 'sh1');
  assert.equal(videoDeLink('https://vimeo.com/123456')?.medible, true);
  assert.equal(videoDeLink('https://www.loom.com/share/aa11')?.medible, false);
  assert.equal(videoDeLink('https://drive.google.com/file/d/ID9/view')?.medible, false);
  assert.equal(videoDeLink('https://cdn.x.com/v/clase.mp4')?.medible, true);
  assert.equal(videoDeLink('https://cdn.x.com/pagina')?.medible, false);
});

test('videoDeLink rechaza lo que no es http/https (va al src de un iframe del cliente)', () => {
  assert.equal(videoDeLink('javascript:alert(1)'), null);
  assert.equal(videoDeLink('data:text/html,hola'), null);
  assert.equal(videoDeLink(''), null);
  assert.equal(videoDeLink('no es un link'), null);
});

test('embedDe arma el iframe de cada plataforma, y null para el archivo directo', () => {
  assert.match(embedDe(videoDeLink('https://youtu.be/abc')!)!, /youtube-nocookie\.com\/embed\/abc\?enablejsapi=1/);
  assert.match(embedDe(videoDeLink('https://vimeo.com/42')!)!, /player\.vimeo\.com\/video\/42/);
  assert.equal(embedDe(videoDeLink('https://cdn.x.com/a.mp4')!), null);
});

test('pctVisto: lo más lejos que llegó sobre lo que dura, topeado; sin duración no hay %', () => {
  assert.equal(pctVisto(30, 60), 50);
  assert.equal(pctVisto(90, 60), 100);
  assert.equal(pctVisto(30, null), 0);
  assert.equal(pctVisto(-5, 60), 0);
});

test('etapaCompleta: todas las obligatorias ENVIADAS (o aprobadas)', () => {
  const cs = [clase(1, { obligatoria: true, tarea: 'A' }), clase(2, { tarea: 'B' }), clase(3, { obligatoria: true, tarea: 'C' })];
  const est = new Map<number, 'pendiente' | 'enviada' | 'aprobada'>([[1, 'enviada']]);
  assert.equal(etapaCompleta(cs, (id) => est.get(id)), false);
  est.set(3, 'aprobada');
  assert.equal(etapaCompleta(cs, (id) => est.get(id)), true);
  // La no obligatoria pendiente no frena.
  assert.deepEqual(pendientesDe(cs, (id) => est.get(id)).map((c) => c.id), [2]);
});

test('etapaCompleta: una etapa SIN obligatorias NO se completa sola', () => {
  assert.equal(etapaCompleta([clase(1, { tarea: 'A' })], () => 'enviada'), false);
  assert.equal(etapaCompleta([], () => undefined), false);
});

test('una obligatoria sin tarea no cuenta (no pide nada)', () => {
  assert.deepEqual(obligatoriasDe([clase(1, { obligatoria: true })]), []);
});

test('etapaSiguiente', () => {
  assert.equal(etapaSiguiente(['a', 'b', 'c'], 'a'), 'b');
  assert.equal(etapaSiguiente(['a', 'b', 'c'], 'c'), null);
  assert.equal(etapaSiguiente(['a', 'b'], 'z'), null);
});

// ⚠️ CAMBIÓ EL 08/10/2026 (audio de la prueba del curso, item 2: «volví para atrás y se me borraron todos
//    los campos»): el saneo ya no tira un campo por no tener pregunta, ni el segundo de un id repetido —
//    eso lo frena `erroresDeCampos` antes de guardar (tests/curso-tareas-secciones.test.ts). Sólo tira la
//    basura (sin id, no es un objeto), y lo anota.
test('sanearCampos tira sólo la basura (y la anota), renombra el repetido y es idempotente', () => {
  const crudo = [
    { id: 'a1', label: 'Nombre', tipo: 'linea' },
    { id: 'a1', label: 'Repetido', tipo: 'linea' },
    { id: '', label: 'Sin id' },
    { id: 't', label: 'Tabla', tipo: 'tabla', columnas: ['X', 'Y'], filasMin: 3, opciones: ['no va'] },
    { id: 'e', label: 'Elige', tipo: 'eleccion', opciones: ['sí', 'no'], obligatorio: true },
  ];
  const descartes: string[] = [];
  const s = sanearCampos(crudo, { descartes });
  assert.deepEqual(s.map((c) => c.id), ['a1', 'a1-2', 't', 'e']);
  assert.equal(s[1].label, 'Repetido', 'el repetido se conserva, con otro id');
  assert.equal(s[2].opciones, undefined);
  assert.deepEqual(descartes, ['campo 3: sin id']);
  assert.deepEqual(sanearCampos(s), s);
});

test('sanearValores descarta claves que la clase no tiene y opciones inventadas', () => {
  const campos = sanearCampos([
    { id: 'n', label: 'N', tipo: 'linea' },
    { id: 'c', label: 'C', tipo: 'checks', opciones: ['a', 'b'] },
    { id: 't', label: 'T', tipo: 'tabla', columnas: ['x', 'y'] },
  ]);
  const v = sanearValores(campos, { n: ' hola ', c: ['a', 'z'], t: [['1', '2', '3']], intruso: 'x' });
  assert.deepEqual(v, { n: 'hola', c: ['a'], t: [['1', '2']] });
  assert.deepEqual(sanearValores([], { respuesta: ' libre ', otra: 1 }), { respuesta: 'libre' });
});

test('respuestaCompleta: un formulario vacío no se puede enviar', () => {
  const c = clase(1, { campos: sanearCampos([{ id: 'a', label: 'A', tipo: 'linea' }, { id: 'b', label: 'B', tipo: 'texto' }]) });
  assert.equal(respuestaCompleta(c, {}), false);
  assert.equal(respuestaCompleta(c, { a: 'algo' }), true);
  const conOblig = clase(2, { campos: sanearCampos([{ id: 'a', label: 'A', tipo: 'linea', obligatorio: true }, { id: 'b', label: 'B', tipo: 'texto' }]) });
  assert.equal(respuestaCompleta(conOblig, { b: 'algo' }), false);
  assert.equal(respuestaCompleta(clase(3, { tarea: 'x' }), { respuesta: '  ' }), false);
});

// Las dos de la revisión del 06/10/2026. Probadas rompiéndolas: con `desde = 0` fijo en
// `campoLleno` cae la de filas fijas (1 fail); sin el `?h=` en `embedDe`, la del Vimeo (1 fail).
test('una tabla de filas FIJAS con sólo las etiquetas no está contestada', () => {
  const c = clase(1, { campos: sanearCampos([{ id: 't', label: 'T', tipo: 'tabla', columnas: ['Área', 'Meta'], filasFijas: ['Ventas', 'Operación'], obligatorio: true }]) });
  assert.equal(respuestaCompleta(c, { t: [['Ventas', ''], ['Operación', '  ']] }), false);
  assert.equal(respuestaCompleta(c, { t: [['Ventas', '+20%'], ['Operación', '']] }), true);
});

test('un Vimeo NO listado conserva su hash hasta el reproductor', () => {
  assert.equal(embedDe(videoDeLink('https://vimeo.com/123456789/abcdef1234')!), 'https://player.vimeo.com/video/123456789?h=abcdef1234');
  assert.equal(embedDe(videoDeLink('https://player.vimeo.com/video/42?h=9f8e7d6c')!), 'https://player.vimeo.com/video/42?h=9f8e7d6c');
  assert.equal(embedDe(videoDeLink('https://vimeo.com/42')!), 'https://player.vimeo.com/video/42');
});

test('la firma del link: ida y vuelta, y no se puede torcer', () => {
  const S = 'secreto-de-prueba';
  const t = firmarAccesoCurso({ ws: 1, leadId: 42, version: 3 }, S)!;
  assert.match(t, /^c1\.1\.42\.3\./);
  assert.deepEqual(leerAccesoCurso(t, S), { ws: 1, leadId: 42, version: 3 });
  // Firma cambiada en un carácter.
  const ult = t.slice(-1) === 'A' ? 'B' : 'A';
  assert.equal(leerAccesoCurso(t.slice(0, -1) + ult, S), null);
  // Otro secreto.
  assert.equal(leerAccesoCurso(t, 'otro'), null);
  // El mismo lead en OTRO workspace con la firma vieja.
  const otroWs = t.replace(/^c1\.1\./, 'c1.9.');
  assert.equal(leerAccesoCurso(otroWs, S), null);
  // Sin secreto no se firma ni se lee.
  assert.equal(firmarAccesoCurso({ ws: 1, leadId: 42, version: 1 }, ''), null);
  assert.equal(leerAccesoCurso(t, ''), null);
  assert.equal(leerAccesoCurso('basura', S), null);
});
