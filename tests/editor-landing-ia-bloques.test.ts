// =============================================================================
// editor-landing-ia-bloques — la gramática de la IA ↔ las tarjetas del editor
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». La IA del editor no
// escribe JSON de ProseMirror: escribe bloques simples (lib/editor-landing/ia-bloques.ts,
// D5 de docs/diseno-editor-landing.md) que el CÓDIGO convierte y valida. Lo que estos tests
// cuidan es lo que no se ve en una pantalla hasta que alguien lo pierde:
//   · que la ida y la vuelta («Editar con IA») no cambien nada que la persona no pidió;
//   · que lo inválido se caiga CON MOTIVO (una variante, un ícono, un tono, un destino);
//   · que los datos EXACTOS (URLs de imágenes y videos) no viajen por el modelo: van como
//     `ref` y vuelven del original;
//   · que un asterisco escrito no se convierta en una cursiva que se come el resto;
//   · que el «#formulario» de un botón termine en la sección real y haya UN solo Título;
//   · y que specADoc (el generador anterior → documento) no ponga las notas en la página.
//
// PROBADO ROMPIÉNDOLO (11/10/2026, scratchpad/paqC/romper.mjs, en memoria y sin git): al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsearInline, inlineAMarkdown, bloquesATarjeta, bloquesATarjetas, tarjetaABloques,
  recolectarBusquedas, aplicarImagenes, normalizarBusqueda, resolverAnclas, ANCLA_FORMULARIO,
  GRAMATICA_IA, CUANDO_OPTIMIZADO, ICONOS_CONTENIDO, type TarjetaIA, type BloqueIA,
} from '../lib/editor-landing/ia-bloques';
import { specADoc } from '../lib/editor-landing/spec-a-doc';
import { NORMALIZAR_NODOS } from '../lib/editor-landing/especificacion';
import { sanearContenido } from '../lib/editor-landing/validar';
import { NODO, VARIANTES_OPTIMIZADO, TONOS_RECUADRO, textoDe, type JsonNodo } from '../lib/editor-landing/doc';
import { NOMBRES_ICONO } from '../lib/editor-landing/iconos';
import type { LandingSpec } from '../lib/landing-spec';
import { marcasDeVoseo } from '../lib/puestas-data';

// Las imágenes sólo valen si son del bucket propio (srcImagen lee la variable en cada llamada).
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ejemplo.supabase.co';
const BUCKET = 'https://ejemplo.supabase.co/storage/v1/object/public/landing-imagenes/3/';
const FOTO = `${BUCKET}foto-1.jpg`;
const VIDEO = `${BUCKET}video-1.mp4`;

/** Recorre un árbol. */
function* nodos(n: JsonNodo): Generator<JsonNodo> {
  yield n;
  for (const c of n.content ?? []) yield* nodos(c);
}
const deTipo = (n: JsonNodo, tipo: string) => [...nodos(n)].filter((x) => x.type === tipo);
/** Saca los `ref` (los pone la vuelta: la ida de la IA no los trae). */
const sinRef = <T>(x: T): T => JSON.parse(JSON.stringify(x, (k, v) => (k === 'ref' ? undefined : v))) as T;

// ── Texto en línea ────────────────────────────────────────────────────────────

test('markdown en línea: **negrita**, *cursiva* y [enlace](url) se vuelven marcas', () => {
  const n = parsearInline('Hola **mundo** y *más* en [este enlace](https://ejemplo.com/x).');
  assert.deepEqual(n, [
    { type: 'text', text: 'Hola ' },
    { type: 'text', text: 'mundo', marks: [{ type: 'bold' }] },
    { type: 'text', text: ' y ' },
    { type: 'text', text: 'más', marks: [{ type: 'italic' }] },
    { type: 'text', text: ' en ' },
    { type: 'text', text: 'este enlace', marks: [{ type: 'link', attrs: { href: 'https://ejemplo.com/x', target: '_blank' } }] },
    { type: 'text', text: '.' },
  ]);
  // Las dos marcas a la vez, y un ancla a una sección (no abre otra pestaña).
  assert.deepEqual(parsearInline('***ya*** [ir](#t-abc)'), [
    { type: 'text', text: 'ya', marks: [{ type: 'bold' }, { type: 'italic' }] },
    { type: 'text', text: ' ' },
    { type: 'text', text: 'ir', marks: [{ type: 'link', attrs: { href: '#t-abc' } }] },
  ]);
});

test('un asterisco ESCRITO no abre nada: «5 * 3», «Precio*», el escapado y los corchetes de un marcador', () => {
  assert.deepEqual(parsearInline('5 * 3 = 15'), [{ type: 'text', text: '5 * 3 = 15' }]);
  // Impar: el último sin pareja es literal (si no, la cursiva se come el resto del texto).
  assert.deepEqual(parsearInline('Precio* final'), [{ type: 'text', text: 'Precio* final' }]);
  assert.deepEqual(parsearInline('\\*no\\* es cursiva'), [{ type: 'text', text: '*no* es cursiva' }]);
  assert.deepEqual(parsearInline('[Nombre del cliente] dijo'), [{ type: 'text', text: '[Nombre del cliente] dijo' }]);
});

test('la vuelta del texto es estable: nodos → markdown → nodos', () => {
  const b = { type: 'bold' };
  const i = { type: 'italic' };
  const l = (href: string) => ({ type: 'link', attrs: /^https?:/.test(href) ? { href, target: '_blank' } : { href } });
  const casos: JsonNodo[][] = [
    [{ type: 'text', text: 'a', marks: [b] }, { type: 'text', text: 'b', marks: [b, i] }, { type: 'text', text: 'c' }],
    [{ type: 'text', text: 'Ver ' }, { type: 'text', text: 'aquí', marks: [b, l('https://x.com/a)b')] }, { type: 'text', text: '.' }],
    [{ type: 'text', text: 'uno' }, { type: 'hardBreak' }, { type: 'text', text: 'dos', marks: [i] }],
    [{ type: 'text', text: 'literal * y \\ y [a](b) y [Marcador]' }],
    // Asteriscos pegados al texto: sin escaparlos, «2*3*4» volvería con el 3 en cursiva.
    [{ type: 'text', text: '2*3*4 es una cuenta' }],
    [{ type: 'text', text: 'x', marks: [i] }, { type: 'text', text: 'y', marks: [b] }],
  ];
  for (const nodosIn of casos) {
    const md = inlineAMarkdown(nodosIn);
    assert.deepEqual(parsearInline(md), nodosIn, `markdown: ${md}`);
    assert.equal(inlineAMarkdown(parsearInline(md)), md);
  }
});

test('un enlace con un destino no permitido queda como texto, con motivo', () => {
  const d: string[] = [];
  const n = parsearInline('[clic](javascript:alert)', { descartes: d });
  assert.deepEqual(n, [{ type: 'text', text: 'clic' }]);
  assert.ok(d.some((m) => m.includes('enlace no válido')), d.join(' | '));
});

// ── Ida y vuelta de una sección ───────────────────────────────────────────────

const COMPLETA: TarjetaIA = {
  diseno: 'derecha', ancho: 'amplio', fondo: 'aurora', alineacion: 'arriba',
  bloques: [
    { t: 'antetitulo', texto: 'Clase gratis' },
    { t: 'titulo', texto: 'Aprende **rápido** y *bien*', alinea: 'centro' },
    { t: 'h2', texto: 'Por qué' },
    { t: 'h3', texto: 'Uno' },
    { t: 'h4', texto: 'Dos' },
    { t: 'p', texto: 'Un párrafo con [un enlace](https://ejemplo.com/x) y un [Nombre del cliente].' },
    { t: 'p-grande', texto: 'Grande' },
    { t: 'p-pequeno', texto: 'Chico\ncon salto' },
    { t: 'lista', items: ['uno', '**dos**'] },
    { t: 'numerada', items: ['a', 'b'] },
    { t: 'tareas', items: ['hacer x'] },
    { t: 'cita', texto: 'Una frase', autor: '[Nombre del cliente]' },
    { t: 'recuadro', tono: 'exito', texto: 'Garantía de [00] días' },
    { t: 'botones', items: [{ texto: 'Quiero', destino: 'https://ejemplo.com', estilo: 'primario' }, { texto: 'Ver más', destino: '#t-abc123', estilo: 'contorno' }], alinea: 'centro' },
    { t: 'optimizado', variante: 'iconos-texto', items: [{ titulo: 'Rápido', texto: 'En minutos', icono: 'rayo' }, { titulo: 'Seguro', texto: 'Sin riesgos', icono: 'escudo' }], columnas: 2 },
    { t: 'optimizado', variante: 'numeros-grandes', items: [{ titulo: '[Clientes]', texto: '', valor: '[000+]' }] },
    { t: 'optimizado', variante: 'cajas-solidas', items: [{ titulo: 'Plan', texto: 'Incluye', valor: '$10', destacado: true }] },
    { t: 'columnas', columnas: [[{ t: 'h3', texto: 'A' }, { t: 'p', texto: 'a' }], [{ t: 'h3', texto: 'B' }]], anchos: [5, 7] },
    { t: 'tabla', filas: [['', 'Nosotros'], ['Precio', '$1']] },
    { t: 'desplegables', items: [{ titulo: '¿Cuánto cuesta?', texto: 'Depende' }, { titulo: '¿Cuándo?', texto: 'Hoy' }] },
    { t: 'separador' },
    { t: 'espaciador', alto: 'l' },
    { t: 'formulario', campos: [{ tipo: 'nombre', etiqueta: 'Nombre', requerido: true }, { tipo: 'email', etiqueta: 'Correo', requerido: true }, { tipo: 'opciones', etiqueta: 'Plan', requerido: false, opciones: ['A', 'B'] }], boton: 'Enviar', exito: 'Gracias' },
    { t: 'grafico', tipo: 'barras', titulo: 'Ventas', categorias: ['Ene', 'Feb'], series: [{ nombre: 'Serie 1', valores: [1, 2] }], sufijo: '%' },
    { t: 'etiqueta', texto: 'Más vendido' },
  ],
};

test('ida y vuelta: bloquesATarjeta → tarjetaABloques devuelve los MISMOS bloques, y una segunda vuelta no cambia nada', () => {
  const d: string[] = [];
  const n = bloquesATarjeta(COMPLETA, { descartes: d });
  assert.deepEqual(d, [], 'una sección válida no tiene descartes');
  assert.equal(n.type, NODO.tarjeta);
  const x1 = tarjetaABloques(n);
  assert.deepEqual(sinRef(x1.bloques), COMPLETA.bloques);
  assert.deepEqual({ diseno: x1.diseno, ancho: x1.ancho, fondo: x1.fondo, alineacion: x1.alineacion }, { diseno: 'derecha', ancho: 'amplio', fondo: 'aurora', alineacion: 'arriba' });
  assert.equal(x1.id, n.attrs?.id, 'la vuelta lleva el id: «Editar con IA» reemplaza por id');
  const x2 = tarjetaABloques(bloquesATarjeta(x1, { base: n }));
  assert.deepEqual(x2, x1);
  // Lo convertido ya está en su forma CANÓNICA: el saneo del server (validar.ts) no le cambia nada.
  const doc = { v: 1 as const, paginas: [{ id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc' as const, content: [n] } }] };
  const saneo = sanearContenido(doc);
  assert.deepEqual(saneo.descartes, []);
  assert.deepEqual(saneo.contenido, doc);
});

test('una variante inválida se descarta CON MOTIVO y el contenido se conserva', () => {
  const d: string[] = [];
  const n = bloquesATarjeta({ bloques: [{ t: 'optimizado', variante: 'tarjetas-locas' as never, items: [{ titulo: 'Uno', texto: 'Texto' }] }] }, { descartes: d });
  const opt = deTipo(n, NODO.optimizado)[0];
  assert.equal(opt.attrs?.variante, 'vinetas-grandes');
  assert.equal(textoDe(opt).includes('Uno'), true, 'el ítem sigue ahí');
  assert.ok(d.some((m) => m.includes('tarjetas-locas')), `sin motivo: ${d.join(' | ')}`);
});

test('íconos, tonos, tipos de campo, diseños y bloques fuera de la gramática se caen con motivo', () => {
  const d: string[] = [];
  const n = bloquesATarjeta({
    diseno: 'diagonal' as never,
    bloques: [
      { t: 'optimizado', variante: 'iconos-texto', items: [{ titulo: 'A', texto: 'a', icono: 'icono-que-no-existe' }] },
      { t: 'recuadro', tono: 'fucsia' as never, texto: 'Hola' },
      { t: 'formulario', campos: [{ tipo: 'fecha' as never, etiqueta: 'Cuándo' }, { tipo: 'email', etiqueta: 'Correo' }], boton: 'Ok', exito: 'Listo' },
      { t: 'carrusel' } as unknown as BloqueIA,
    ],
  }, { descartes: d });
  assert.equal(n.attrs?.diseno, 'sin');
  assert.equal(deTipo(n, NODO.optimizadoItem)[0].attrs?.icono, null);
  assert.equal(deTipo(n, NODO.recuadro)[0].attrs?.tono, 'info');
  assert.deepEqual((deTipo(n, NODO.formulario)[0].attrs?.campos as { tipo: string }[]).map((c) => c.tipo), ['email']);
  for (const pista of ['diagonal', 'icono-que-no-existe', 'fucsia', 'fecha', 'carrusel']) {
    assert.ok(d.some((m) => m.includes(pista)), `falta el motivo de «${pista}»: ${d.join(' | ')}`);
  }
});

test('un formulario sin email ni teléfono recibe el email: sin eso no entra al CRM', () => {
  const d: string[] = [];
  const n = bloquesATarjeta({ bloques: [{ t: 'formulario', campos: [{ tipo: 'nombre', etiqueta: 'Nombre' }], boton: 'Enviar', exito: 'Gracias' }] }, { descartes: d });
  const campos = deTipo(n, NODO.formulario)[0].attrs?.campos as { tipo: string; id: string; requerido: boolean }[];
  assert.deepEqual(campos.map((c) => c.tipo), ['nombre', 'email']);
  assert.equal(campos[1].requerido, true);
  assert.ok(campos.every((c) => /^c[a-z0-9]+$/.test(c.id)), 'cada campo con su id');
  assert.ok(d.some((m) => m.includes('email')));
});

test('varias secciones: «#formulario» y «#seccion-N» apuntan a la tarjeta real, y queda UN solo Título', () => {
  const d: string[] = [];
  const ts = bloquesATarjetas([
    { bloques: [{ t: 'titulo', texto: 'Uno' }, { t: 'botones', items: [{ texto: 'Ir al formulario', destino: '#formulario' }, { texto: 'Ver precios', destino: '#seccion-2', estilo: 'contorno' }] }] },
    { bloques: [{ t: 'titulo', texto: 'Otro título' }, { t: 'p', texto: 'Precios' }] },
    { bloques: [{ t: 'formulario', campos: [{ tipo: 'email', etiqueta: 'Correo' }], boton: 'Enviar', exito: 'Gracias' }] },
  ], { descartes: d });
  const hrefs = deTipo(ts[0], NODO.boton).map((b) => b.attrs?.href);
  assert.deepEqual(hrefs, [`#t-${ts[2].attrs?.id}`, `#t-${ts[1].attrs?.id}`]);
  const titulos = ts.flatMap((t) => deTipo(t, 'heading')).filter((h) => h.attrs?.variante === 'titulo');
  assert.equal(titulos.length, 1);
  assert.ok(d.some((m) => m.startsWith('sección 2') && m.includes('Título')), d.join(' | '));
  assert.equal(new Set(ts.map((t) => t.attrs?.id)).size, 3, 'ids distintos');
});

test('una sección SOLA guarda el ancla pendiente, y resolverAnclas la cambia por la real cuando la página está completa', () => {
  // «Generar» convierte de a tandas de 3: la sección del botón no sabe dónde va a quedar el formulario.
  const d: string[] = [];
  const a = bloquesATarjeta({ bloques: [{ t: 'botones', items: [{ texto: 'Quiero', destino: '#formulario' }, { texto: 'Precios', destino: '#seccion-3' }] }] }, { descartes: d });
  assert.deepEqual(deTipo(a, NODO.boton).map((b) => b.attrs?.href), [ANCLA_FORMULARIO, '#t-seccion-3']);
  assert.deepEqual(d, [], 'pendiente no es un descarte');
  assert.deepEqual(tarjetaABloques(a).bloques[0], { t: 'botones', items: [{ texto: 'Quiero', destino: '#formulario', estilo: 'primario' }, { texto: 'Precios', destino: '#seccion-3', estilo: 'secundario' }] });
  const doc = { v: 1 as const, paginas: [{ id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc' as const, content: [a] } }] };
  assert.deepEqual(sanearContenido(doc).descartes, [], 'el saneo acepta el ancla pendiente');

  const b = bloquesATarjeta({ bloques: [{ t: 'p', texto: 'Algo' }] });
  const c = bloquesATarjeta({ bloques: [{ t: 'formulario', campos: [{ tipo: 'email', etiqueta: 'Correo' }], boton: 'Enviar', exito: 'Gracias' }] });
  const r = resolverAnclas([a, b, c]);
  assert.deepEqual(deTipo(r[0], NODO.boton).map((x) => x.attrs?.href), [`#t-${c.attrs?.id}`, `#t-${c.attrs?.id}`]);
  assert.equal(deTipo(a, NODO.boton)[0].attrs?.href, ANCLA_FORMULARIO, 'no muta la entrada');

  const d2: string[] = [];
  const sinForm = resolverAnclas([a, b], { descartes: d2 });
  assert.deepEqual(deTipo(sinForm[0], NODO.boton).map((x) => x.attrs?.href), ['#', '#']);
  assert.equal(d2.length, 2);
});

test('Editar con IA: con la tarjeta original vuelven el id, la imagen, las notas y lo que NO pasa por el modelo', () => {
  const base = bloquesATarjeta({ diseno: 'izquierda', imagenSrc: FOTO, notas: 'Nota privada', bloques: [{ t: 'h2', texto: 'Viejo' }] });
  base.content!.push(
    { type: NODO.video, attrs: NORMALIZAR_NODOS[NODO.video]({ src: VIDEO }) },
    { type: NODO.insertado, attrs: NORMALIZAR_NODOS[NODO.insertado]({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }) },
    { type: NODO.imagen, attrs: NORMALIZAR_NODOS[NODO.imagen]({ src: FOTO, alt: 'Una foto' }) },
    { type: NODO.optimizado, attrs: { variante: 'galeria', columnas: 'auto', mostrarIconos: false }, content: [{ type: NODO.optimizadoItem, attrs: { icono: null, imagenSrc: FOTO, valor: '', destacado: false }, content: [{ type: 'heading', attrs: { level: 3, variante: null, textAlign: null }, content: [{ type: 'text', text: 'Pie' }] }] }] },
  );
  assert.ok(deTipo(base, NODO.insertado)[0].attrs?.src, 'el insertado de prueba es válido');

  const ida = tarjetaABloques(base);
  // Ninguna URL del bucket viaja al modelo: van como ref.
  assert.equal(JSON.stringify(ida).includes('supabase'), false, JSON.stringify(ida));
  assert.deepEqual(ida.bloques.filter((b) => b.t === 'conservar').map((b) => (b as { que: string }).que), ['video', 'insertado']);

  // El modelo cambia el texto y deja lo demás.
  const editada: TarjetaIA = { ...ida, bloques: ida.bloques.map((b) => (b.t === 'h2' ? { ...b, texto: 'Nuevo' } : b)) };
  const vuelta = bloquesATarjeta(editada, { base });
  assert.equal(vuelta.attrs?.id, base.attrs?.id);
  assert.equal(vuelta.attrs?.imagenSrc, FOTO);
  assert.equal(vuelta.attrs?.notas, 'Nota privada');
  assert.equal(textoDe(deTipo(vuelta, 'heading')[0]), 'Nuevo');
  for (const tipo of [NODO.video, NODO.insertado, NODO.imagen]) assert.deepEqual(deTipo(vuelta, tipo), deTipo(base, tipo), tipo);
  assert.equal(deTipo(vuelta, NODO.optimizadoItem)[0].attrs?.imagenSrc, FOTO);

  // Una URL que escriba el modelo no se lee: sólo vale la del bucket que pone el server.
  const intruso = bloquesATarjeta({ diseno: 'derecha', imagen: 'office', imagenSrc: 'https://malo.com/x.jpg', bloques: [{ t: 'imagen', busqueda: 'x', alt: 'x', src: 'https://malo.com/y.jpg' }] });
  assert.equal(intruso.attrs?.imagenSrc, null);
  assert.equal(deTipo(intruso, NODO.imagen).length, 0);
});

test('imágenes: el server recolecta las búsquedas en inglés, las resuelve y las aplica; lo que falta queda sin imagen o con hueco', () => {
  const tarjetas: TarjetaIA[] = [
    { diseno: 'derecha', imagen: 'Team Meeting   Bright Office', bloques: [{ t: 'h2', texto: 'Uno' }] },
    { diseno: 'fondo', imagen: 'https://no-es-una-busqueda.com/x.jpg', bloques: [{ t: 'h2', texto: 'Dos' }] },
    { bloques: [{ t: 'optimizado', variante: 'galeria', items: [{ titulo: 'A', texto: '', imagen: 'mountain lake' }, { titulo: 'B', texto: '', imagen: 'team meeting bright office' }] }] },
    { diseno: 'arriba', imagen: 'empty desk', bloques: [{ t: 'imagen', busqueda: 'coffee cup', alt: 'Café' }] },
  ];
  assert.deepEqual(recolectarBusquedas(tarjetas), ['team meeting bright office', 'mountain lake', 'empty desk', 'coffee cup']);
  assert.equal(normalizarBusqueda('www.algo.com'), '');

  const mapa = { 'team meeting bright office': FOTO, 'coffee cup': `${BUCKET}cafe.webp` };
  const quitar = bloquesATarjetas(aplicarImagenes(tarjetas, mapa));
  assert.equal(quitar[0].attrs?.imagenSrc, FOTO);
  assert.deepEqual(deTipo(quitar[2], NODO.optimizadoItem).map((i) => i.attrs?.imagenSrc), [null, FOTO]);
  assert.equal(quitar[3].attrs?.diseno, 'sin', 'se buscó y no hubo: sin imagen (no un hueco que mienta)');
  assert.equal(deTipo(quitar[3], NODO.imagen)[0].attrs?.src, `${BUCKET}cafe.webp`);

  const hueco = bloquesATarjetas(aplicarImagenes(tarjetas, mapa, { siFalta: 'hueco' }));
  assert.equal(hueco[3].attrs?.diseno, 'arriba', 'con «marcadores» queda el hueco para elegir');
  assert.equal(hueco[3].attrs?.imagenSrc, null);
  assert.equal(tarjetas[0].imagenSrc, undefined, 'aplicarImagenes no muta la entrada');
});

test('columnas adentro de columnas y un optimizado adentro de una columna se caen con motivo', () => {
  const d: string[] = [];
  const n = bloquesATarjeta({
    bloques: [{ t: 'columnas', columnas: [
      [{ t: 'p', texto: 'a' }, { t: 'columnas', columnas: [[{ t: 'p', texto: 'x' }], [{ t: 'p', texto: 'y' }]] }],
      [{ t: 'optimizado', variante: 'cajas-solidas', items: [{ titulo: 'z', texto: '' }] }, { t: 'p', texto: 'b' }],
    ] }],
  }, { descartes: d });
  assert.equal(deTipo(n, NODO.columnas).length, 1);
  assert.equal(deTipo(n, NODO.optimizado).length, 0);
  assert.ok(d.some((m) => m.includes('columnas adentro')) && d.some((m) => m.includes('optimizado adentro')), d.join(' | '));
});

test('GRAMATICA_IA nombra cada variante, cada tono y los íconos de contenido (que existen en el set), y está en español neutro', () => {
  for (const v of VARIANTES_OPTIMIZADO) assert.ok(GRAMATICA_IA.includes(v), `falta la variante ${v}`);
  for (const t of TONOS_RECUADRO) assert.ok(GRAMATICA_IA.includes(t), `falta el tono ${t}`);
  const set = new Set(NOMBRES_ICONO);
  for (const i of ICONOS_CONTENIDO) {
    assert.ok(set.has(i), `el ícono de contenido «${i}» no existe en iconos.ts`);
    assert.ok(GRAMATICA_IA.includes(i), `falta el ícono ${i}`);
  }
  assert.equal(GRAMATICA_IA.includes('chevron-abajo'), false, 'los íconos del chrome no se le ofrecen a la IA');
  assert.deepEqual(Object.keys(CUANDO_OPTIMIZADO).sort(), [...VARIANTES_OPTIMIZADO].sort());
  assert.deepEqual(marcasDeVoseo(GRAMATICA_IA), []);
  assert.equal(GRAMATICA_IA.includes('`'), false);
});

// ── specADoc ──────────────────────────────────────────────────────────────────

const SPEC: LandingSpec = {
  nombre: 'Prueba', objetivo: 'registrar', avatar: 'dueños de negocio', promesa: 'más clientes',
  headline: 'Consigue más clientes', subheadline: 'Sin gastar de más', cta_principal: 'Quiero entrar',
  bloques: [
    { tipo: 'hero', titulo: '', copy: '', bullets: [], cta: '', nota: 'El hero va primero' },
    { tipo: 'beneficios', titulo: 'Beneficios', copy: 'Lo que ganas', bullets: ['Ahorro: menos horas', 'Orden — todo en un lugar'], cta: '', nota: 'NOTA-BENEFICIOS' },
    { tipo: 'como_funciona', titulo: 'Cómo funciona', copy: '', bullets: ['Te anotas', 'Te llamamos', 'Empiezas'], cta: '', nota: '' },
    { tipo: 'testimonios', titulo: 'Testimonios', copy: '', bullets: [], cta: '', nota: 'Conseguir 3 testimonios reales' },
    { tipo: 'faq', titulo: 'Preguntas', copy: '', bullets: ['¿Cuánto cuesta? Es gratis', '¿Cuándo empiezo? Hoy'], cta: '', nota: '' },
    { tipo: 'garantia', titulo: 'Garantía', copy: 'Si no te sirve, te devolvemos el dinero', bullets: [], cta: '', nota: '' },
    { tipo: 'cta_final', titulo: 'Empieza hoy', copy: 'Déjanos tus datos', bullets: [], cta: 'Anotarme', nota: '' },
  ],
  meta_titulo: 'Título SEO', meta_descripcion: 'Descripción SEO', rationale: 'Va directo al formulario',
};

test('specADoc: título, botón al formulario, testimonios con marcadores y la nota en las notas del orador (no en la página)', () => {
  const d: string[] = [];
  const c = specADoc(SPEC, { descartes: d });
  assert.equal(c.paginas.length, 1);
  const [p] = c.paginas;
  assert.equal(p.seoTitulo, 'Título SEO');
  assert.equal(p.seoDescripcion, 'Descripción SEO');
  const ts = p.doc.content;
  assert.equal(ts.length, 7);
  const titulo = deTipo(ts[0], 'heading')[0];
  assert.equal(titulo.attrs?.variante, 'titulo');
  assert.equal(textoDe(titulo), 'Consigue más clientes');
  const form = ts.findIndex((t) => deTipo(t, NODO.formulario).length);
  assert.equal(form, 6, 'el formulario va en el cierre');
  assert.equal(deTipo(ts[0], NODO.boton)[0].attrs?.href, `#t-${ts[6].attrs?.id}`);
  assert.equal(deTipo(ts[1], NODO.optimizado)[0].attrs?.variante, 'iconos-texto');
  assert.deepEqual(deTipo(ts[1], 'heading').slice(1).map((h) => textoDe(h)), ['Ahorro', 'Orden']);
  assert.equal(deTipo(ts[2], NODO.optimizado)[0].attrs?.variante, 'etapas-horizontales');
  assert.ok(textoDe(ts[3]).includes('[Nombre del cliente]'), 'testimonios vacíos = marcadores, nunca inventados');
  assert.deepEqual(deTipo(ts[4], NODO.desplegableTitulo).map((x) => textoDe(x)), ['¿Cuánto cuesta?', '¿Cuándo empiezo?']);
  assert.equal(deTipo(ts[5], NODO.recuadro)[0].attrs?.tono, 'exito');
  // La nota NO va al contenido.
  assert.equal(ts[1].attrs?.notas, 'NOTA-BENEFICIOS');
  assert.equal(JSON.stringify(ts.map((t) => t.content)).includes('NOTA-BENEFICIOS'), false);
  assert.ok(String(ts[0].attrs?.notas).includes('El hero va primero'));
  assert.deepEqual(d, []);
  // Y lo que sale ya es lo que el server guardaría.
  const saneo = sanearContenido(c);
  assert.deepEqual(saneo.descartes, []);
  assert.deepEqual(saneo.contenido, c);
});

test('specADoc sin formulario («vender»): los botones van a la sección del precio', () => {
  const venta: LandingSpec = {
    ...SPEC, objetivo: 'vender',
    bloques: [
      { tipo: 'hero', titulo: '', copy: '', bullets: [], cta: '', nota: '' },
      { tipo: 'problema', titulo: 'El problema', copy: 'Algo duele', bullets: [], cta: '', nota: '' },
      { tipo: 'precio', titulo: 'Precio', copy: '$100', bullets: ['Incluye A', 'Incluye B'], cta: 'Comprar', nota: '' },
      { tipo: 'cta_final', titulo: 'Decide hoy', copy: '', bullets: [], cta: 'Comprar ahora', nota: '' },
    ],
  };
  const ts = specADoc(venta).paginas[0].doc.content;
  assert.equal(ts.some((t) => deTipo(t, NODO.formulario).length), false);
  const precio = `#t-${ts[2].attrs?.id}`;
  assert.equal(deTipo(ts[0], NODO.boton)[0].attrs?.href, precio);
  assert.equal(deTipo(ts[3], NODO.boton)[0].attrs?.href, precio);
  assert.equal(deTipo(ts[2], NODO.boton)[0].attrs?.href, '#', 'una sección no se apunta a sí misma');
});

// ── PROBADO ROMPIÉNDOLO (11/10/2026) ──────────────────────────────────────────
// scratchpad/paqC/romper.mjs: cada rotura cambia UNA línea en memoria, corre este archivo y
// restaura desde memoria (nunca git; se verificó byte a byte). Base: 16 pasan, 0 fallan.
//   · el motivo de la variante inválida, quitado ............ 1 fallo (variante inválida)
//   · sin la regla de paridad del asterisco ................. 1 fallo (asterisco escrito)
//   · la URL de la imagen viaja en la vuelta (src) .......... 1 fallo (Editar con IA)
//   · «#formulario» sin resolver ............................ 2 fallos (varias secciones, specADoc)
//   · sin bajar el segundo «Título» ......................... 1 fallo (varias secciones)
//   · formulario sin email no se completa ................... 1 fallo (formulario)
//   · sin la forma canónica (canonizar) ..................... 2 fallos (ida y vuelta, specADoc)
//   · resolverAnclas no resuelve el formulario .............. 1 fallo (ancla pendiente)
//   · lo que no se encontró queda con hueco (no 'sin') ...... 2 fallos (imágenes, Editar con IA)
//   · el `*` del texto sin escapar en la vuelta ............. 1 fallo (vuelta del texto)
//     ⚠️ La PRIMERA versión de ese caso daba VERDE con la rotura: su asterisco estaba rodeado
//     de espacios y la regla de «asterisco libre» lo salvaba igual. Se sumó «2*3*4».
//   · la nota del spec va al contenido ...................... 1 fallo (specADoc)
// Y una rotura que no fue a propósito: una URL con «)» volvía como «%29» (la vuelta del texto
// la cazó antes de existir este pie; ahora el «)» viaja escapado).
