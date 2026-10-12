// =============================================================================
// tests/editor-landing-exportar — el rango, el modelo de las diapositivas y el orden de Publicar
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Cubre lo PURO de
// lib/editor-landing/exportar-*.ts (paquete I1 del editor de landings) y una regla que vive en
// la pantalla: publicar guarda PRIMERO y publica la versión que eso devuelve
// (app/landing-generator/editor/dialogos/DialogoPublicar.tsx; AGENTS.md «Un BORRADOR no es un
// DEFAULT, y publicar promueve lo GUARDADO»).
//
// Lo que NO cubre, porque necesita un navegador: bajar el archivo, la foto de html-to-image, la
// impresión del iframe y la llamada a pptxgenjs. Lo que esas funciones deciden ANTES de tocar el
// DOM está acá (`modeloDiapositiva`, `colocarImagen`, `textosPptx`, `documentoExportable`).
//
// ROTURAS (11/10/2026; cada guard probado rompiéndolo con el arnés del scratchpad, base 16/0,
// restaurado DE MEMORIA con el hash verificado, nunca con git checkout):
//   1. parsearRango sin el swap de a>b («5-3» queda vacío): 1 fallo (intervalos al revés), 15 pases.
//   2. parsearRango aceptando números por encima del total: 1 fallo (lo que no entiende), 15 pases.
//   3. elegirTarjetas numerando sólo las visibles: 2 fallos (la numeración de la tira; todas/actual/
//      sólo ocultas), 14 pases.
//   4. modeloDiapositiva con la caja de la imagen siempre a la izquierda: 1 fallo (derecha), 15 pases.
//   5. sin la tinta de la superposición «oscura»: 1 fallo (colores), 15 pases.
//   6. colocarImagen ignorando el punto de enfoque (fx = 0.5 fijo): 1 fallo (recorte), 15 pases.
//   7. textosPptx cerrando también el ÚLTIMO párrafo con breakLine: 1 fallo (breakLine), 15 pases.
//   8. DialogoPublicar mandando el pedido de 'publicar' ANTES de guardarAhora: 1 fallo, 15 pases.
//   9. DialogoPublicar publicando `version: 0` en vez de la que devolvió guardarAhora: 1 fallo,
//      15 pases. (La primera versión del assert aceptaba cualquier «version…»: con esta rotura dio
//      16 pases y 0 fallos, medido. Se ajustó a `version,` abreviado o `version: <la variable>`.)
//  10. DialogoPublicar sin cortar cuando guardarAhora devuelve null: 1 fallo, 15 pases.
//  11. nombreArchivo sin sacar \ / : * ? " < > |: 2 fallos (nombre; título del documento), 14 pases.
//  12. documentoExportable con el script del formulario también en la hoja del PDF: 1 fallo, 15 pases.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// El origen del bucket público: sin esto `srcImagen` no acepta ninguna imagen (especificacion.ts
// lo lee en cada llamada, así que alcanza con definirlo antes de llamar).
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';
const BUCKET = 'https://proyecto.supabase.co/storage/v1/object/public/landing-imagenes/7/';

import { tarjeta, titulo, parrafo, NODO, type JsonNodo } from '../lib/editor-landing/doc';
import { temaPorId } from '../lib/editor-landing/temas';
import { CSS_CONTENIDO } from '../lib/editor-landing/css';
import { documentoExportable, elegirTarjetas, nombreArchivo, parsearRango } from '../lib/editor-landing/exportar-html';
import {
  ANCHO_DIAPO, colocarImagen, escalarTexto, modeloDiapositiva, textosPptx, type Diapositiva,
} from '../lib/editor-landing/exportar-pptx';
import { nombreDeFoto } from '../lib/editor-landing/exportar-png';

const RAIZ = join(import.meta.dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');

// ─────────────────────────────────────────────────────────────────────────────
// El rango «1-3,5»
// ─────────────────────────────────────────────────────────────────────────────

test('rango: «1-3,5» son las secciones 1, 2, 3 y 5', () => {
  assert.deepEqual(parsearRango('1-3,5', 10), { ok: true, numeros: [1, 2, 3, 5] });
});

test('rango: espacios, punto y coma, repetidos y guion largo', () => {
  assert.deepEqual(parsearRango(' 2 ; 2, 7–8 ,', 10), { ok: true, numeros: [2, 7, 8] });
});

test('rango: intervalos al revés («5-3» = 3, 4, 5)', () => {
  assert.deepEqual(parsearRango('5-3', 10), { ok: true, numeros: [3, 4, 5] });
});

test('rango: lo que no entiende lo dice (vacío, inválido, fuera de rango)', () => {
  assert.deepEqual(parsearRango('   ', 10), { ok: false, error: 'Rango vacío' });
  assert.deepEqual(parsearRango('1-a', 10), { ok: false, error: 'Rango inválido' });
  assert.deepEqual(parsearRango('1..3', 10), { ok: false, error: 'Rango inválido' });
  assert.deepEqual(parsearRango('0', 10), { ok: false, error: 'Fuera de rango' });
  assert.deepEqual(parsearRango('9-11', 10), { ok: false, error: 'Fuera de rango' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Qué secciones salen
// ─────────────────────────────────────────────────────────────────────────────

const tA = tarjeta([titulo('Uno', 1)], { id: 'ta' });
const tB = tarjeta([titulo('Dos', 1)], { id: 'tb', oculta: true });
const tC = tarjeta([titulo('Tres', 1)], { id: 'tc' });
const tD = tarjeta([titulo('Cuatro', 1)], { id: 'td' });
const pagina = [tA, tB, tC, tD];

test('elegir: la numeración es la de la tira (cuenta las ocultas) y las ocultas no salen', () => {
  const r = elegirTarjetas(pagina, { tipo: 'personalizado', texto: '2-4' });
  assert.ok(r.ok);
  assert.deepEqual(r.elegidas.map((e) => [e.numero, e.tarjeta.attrs?.id]), [[3, 'tc'], [4, 'td']]);
});

test('elegir: todas, la actual, y sólo ocultas', () => {
  const todas = elegirTarjetas(pagina, { tipo: 'todas' });
  assert.ok(todas.ok);
  assert.deepEqual(todas.elegidas.map((e) => e.numero), [1, 3, 4]);
  const actual = elegirTarjetas(pagina, { tipo: 'actual', tarjetaId: 'tc' });
  assert.ok(actual.ok);
  assert.deepEqual(actual.elegidas.map((e) => e.numero), [3]);
  assert.deepEqual(elegirTarjetas(pagina, { tipo: 'actual', tarjetaId: null }), { ok: false, error: 'Sin sección actual' });
  assert.deepEqual(elegirTarjetas(pagina, { tipo: 'personalizado', texto: '2' }), { ok: false, error: 'Solo hay secciones ocultas' });
});

// ─────────────────────────────────────────────────────────────────────────────
// El nombre del archivo
// ─────────────────────────────────────────────────────────────────────────────

test('nombre: el título sin lo que un sistema de archivos rechaza, con su extensión', () => {
  assert.equal(nombreArchivo('Mi landing: oferta/2026?', 'pdf'), 'Mi landing oferta 2026.pdf');
  assert.equal(nombreArchivo('  Café   «Ñandú»  ', 'pptx'), 'Café «Ñandú».pptx');
  assert.equal(nombreArchivo('', 'html'), 'Landing.html');
  assert.equal(nombreArchivo('con', 'zip'), 'Landing con.zip');
  assert.equal(nombreArchivo('x'.repeat(200), 'png').length, 80 + 4);
  assert.equal(nombreDeFoto(7, 'Nuestros planes', 12), '07-nuestros-planes.png');
});

// ─────────────────────────────────────────────────────────────────────────────
// El documento HTML (el .html y la hoja del PDF)
// ─────────────────────────────────────────────────────────────────────────────

test('documento: título escapado, la hoja única, las fuentes del tema; el PDF sin script', () => {
  const tema = temaPorId('pewter');
  const html = documentoExportable({ titulo: 'A <b>&</b> "B"', html: '<div class="gm-doc"></div>', tema });
  // El título es el nombre que propone «Guardar como PDF»: sale limpio como un nombre de archivo, y escapado.
  assert.ok(html.includes('<title>A b &amp; b B</title>'), 'título limpio y escapado');
  assert.ok(html.includes(CSS_CONTENIDO.slice(0, 200)), 'lleva CSS_CONTENIDO');
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=/);
  assert.match(html, /<script>[^<]*preventDefault/);
  const pdf = documentoExportable({ titulo: 'x', html: '', tema, imprimir: true });
  assert.doesNotMatch(pdf, /<script/);
  assert.match(pdf, /@media print/);
});

// ─────────────────────────────────────────────────────────────────────────────
// El modelo de diapositivas (lo que decide el .pptx)
// ─────────────────────────────────────────────────────────────────────────────

function ejemplo(attrs: Record<string, unknown> = {}, extra: JsonNodo[] = []): JsonNodo {
  return tarjeta([
    titulo('Lanza tu curso', 1, 'titulo'),
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Texto con ' },
        { type: 'text', text: 'negrita', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' y un ' },
        { type: 'text', text: 'enlace', marks: [{ type: 'link', attrs: { href: 'https://mako.test/x' } }] },
        { type: 'text', text: ' interno', marks: [{ type: 'link', attrs: { href: '#t-otra' } }] },
      ],
    },
    { type: 'bulletList', content: [{ type: 'listItem', content: [parrafo('Primero')] }, { type: 'listItem', content: [parrafo('Segundo')] }] },
    {
      type: NODO.optimizado,
      attrs: { variante: 'numeros-grandes' },
      content: [
        { type: NODO.optimizadoItem, attrs: { valor: '90%' }, content: [titulo('Alumnos felices', 3), parrafo('Encuesta 2026')] },
        { type: NODO.optimizadoItem, attrs: { valor: '' }, content: [titulo('Soporte', 3)] },
      ],
    },
    ...extra,
  ], { id: 'tx', notas: 'Decir el precio', ...attrs });
}

const tema = temaPorId('pewter');
const hex = (c: string) => c.replace('#', '').toUpperCase();

test('pptx: título, párrafo con marcas, viñetas y los ítems de un diseño optimizado', () => {
  const d = modeloDiapositiva({ tarjeta: ejemplo(), numero: 3 }, tema);
  assert.equal(d.numero, 3);
  assert.equal(d.id, 'tx');
  assert.equal(d.parrafos[0].tipo, 'titulo');
  assert.equal(d.parrafos[0].trozos[0].texto, 'Lanza tu curso');
  const p = d.parrafos[1];
  assert.equal(p.tipo, 'parrafo');
  assert.equal(p.trozos.find((t) => t.texto === 'negrita')?.negrita, true);
  assert.equal(p.trozos.find((t) => t.texto === 'enlace')?.enlace, 'https://mako.test/x');
  assert.equal(p.trozos.find((t) => t.texto === ' interno')?.enlace, undefined, 'un ancla del sitio no es un enlace en PowerPoint');
  const vinetas = d.parrafos.filter((x) => x.tipo === 'vineta');
  assert.deepEqual(vinetas.map((v) => v.trozos.map((t) => t.texto).join('')), ['Primero', 'Segundo', '90% — Alumnos felices', 'Soporte']);
  assert.equal(vinetas[2].trozos[0].negrita, true);
  assert.ok(d.parrafos.some((x) => x.tipo === 'parrafo' && x.nivel === 1 && x.trozos[0].texto === 'Encuesta 2026'));
  assert.equal(d.notas, 'Decir el precio');
  assert.deepEqual(d.fuentes, { titulo: tema.fuentes.titulo.familia, cuerpo: tema.fuentes.cuerpo.familia });
  assert.equal(d.imagen, null);
  assert.equal(d.cajaTexto.w, 8.8);
});

test('pptx: imagen de acento a la derecha deja el texto a la izquierda', () => {
  const d = modeloDiapositiva({ tarjeta: ejemplo({ diseno: 'derecha', imagenSrc: BUCKET + 'foto.jpg', imagenFocoX: 20 }), numero: 1 }, tema);
  assert.equal(d.imagen?.lugar, 'derecha');
  assert.equal(d.imagen?.caja.x, 6.25);
  assert.equal(d.imagen?.caja.w + (d.imagen?.caja.x ?? 0), ANCHO_DIAPO);
  assert.equal(d.imagen?.focoX, 20);
  assert.equal(d.cajaTexto.x, 0.6);
  assert.ok(d.cajaTexto.x + d.cajaTexto.w <= 6.25, 'el texto no pisa la imagen');
});

test('pptx: sin imagen de acento, la primera imagen del cuerpo va a la derecha y entera', () => {
  const conImagen = ejemplo({}, [{ type: NODO.imagen, attrs: { src: BUCKET + 'cuerpo.png', alt: '' } }]);
  const d = modeloDiapositiva({ tarjeta: conImagen, numero: 1 }, tema);
  assert.equal(d.imagen?.lugar, 'derecha');
  assert.equal(d.imagen?.ajuste, 'contener');
  assert.equal(d.imagen?.src, BUCKET + 'cuerpo.png');
  // Una imagen que no es del bucket propio no sale (la misma regla que el render).
  const ajena = ejemplo({}, [{ type: NODO.imagen, attrs: { src: 'https://otro.sitio/x.png', alt: '' } }]);
  assert.equal(modeloDiapositiva({ tarjeta: ajena, numero: 1 }, tema).imagen, null);
});

test('pptx: colores del tema, del acento y de la superposición oscura', () => {
  const normal = modeloDiapositiva({ tarjeta: ejemplo(), numero: 1 }, tema);
  assert.match(normal.fondo, /^[0-9A-F]{6}$/);
  assert.match(normal.colores.texto, /^[0-9A-F]{6}$/);
  const acento = modeloDiapositiva({ tarjeta: ejemplo({ fondo: 'acento' }), numero: 1 }, tema);
  assert.equal(acento.fondo, hex(tema.colores.acento));
  assert.notEqual(acento.colores.texto, normal.colores.texto);
  const oscura = modeloDiapositiva({ tarjeta: ejemplo({ diseno: 'fondo', imagenSrc: BUCKET + 'f.webp', superposicion: 'oscura' }), numero: 1 }, tema);
  assert.deepEqual(oscura.velo, { color: '000000', transparencia: 45 });
  assert.equal(oscura.colores.texto, 'F5F5F5');
  assert.equal(oscura.colores.titulo, 'FFFFFF');
});

test('pptx: el texto largo se achica para entrar (sin bajar de la mitad)', () => {
  const largo = Array.from({ length: 30 }, (_, i) => parrafo(`Párrafo ${i} con bastante texto para ocupar más de una línea en la diapositiva.`));
  const d = modeloDiapositiva({ tarjeta: tarjeta(largo, { id: 'tl' }), numero: 1 }, tema);
  assert.ok(d.parrafos[0].tam < 16 && d.parrafos[0].tam >= 9, `tam = ${d.parrafos[0].tam}`);
  assert.equal(escalarTexto([{ tipo: 'parrafo', nivel: 0, trozos: [{ texto: 'Corto' }], tam: 16 }], d.cajaTexto), 1);
});

test('pptx: recorte «Rellenar» alrededor del punto de enfoque, y «Ajustar» centrado', () => {
  const caja = { x: 6.25, y: 0, w: 3.75, h: 5.625 };
  const centro = colocarImagen({ w: 1000, h: 500 }, caja, 'cubrir', 50, 50);
  assert.equal(centro.w, 11.25);
  assert.equal(centro.h, 5.625);
  assert.deepEqual(centro.sizing, { type: 'crop', x: 3.75, y: 0, w: 3.75, h: 5.625 });
  assert.equal(colocarImagen({ w: 1000, h: 500 }, caja, 'cubrir', 0, 50).sizing?.x, 0);
  assert.equal(colocarImagen({ w: 1000, h: 500 }, caja, 'cubrir', 100, 50).sizing?.x, 7.5);
  const entera = colocarImagen({ w: 1000, h: 500 }, caja, 'contener');
  assert.equal(entera.sizing, undefined);
  assert.equal(entera.w, 3.75);
  assert.equal(entera.h, 1.875);
  assert.equal(entera.y, 1.875);
});

test('pptx: cada párrafo cierra con breakLine menos el último; viñetas con bullet', () => {
  const d: Diapositiva = modeloDiapositiva({ tarjeta: ejemplo(), numero: 1 }, tema);
  const textos = textosPptx(d);
  const cierres = textos.filter((t) => t.options.breakLine === true && t.text !== '').length;
  assert.equal(cierres, d.parrafos.length - 1);
  assert.notEqual(textos[textos.length - 1].options.breakLine, true);
  assert.ok(textos.some((t) => t.text === 'Primero' && typeof t.options.bullet === 'object'));
  assert.ok(textos.some((t) => t.text === 'enlace' && (t.options.hyperlink as { url: string }).url === 'https://mako.test/x'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Publicar guarda PRIMERO (lee el fuente)
// ─────────────────────────────────────────────────────────────────────────────

test('publicar guarda primero y publica la versión que devolvió el guardado', () => {
  const src = leer('app/landing-generator/editor/dialogos/DialogoPublicar.tsx');
  const ini = src.indexOf('const publicarSitio = async');
  assert.ok(ini > 0, 'existe publicarSitio');
  const fin = src.indexOf('\n  };', ini);
  const cuerpo = src.slice(ini, fin);
  assert.ok(cuerpo.length > 100 && cuerpo.length < 2000, `el recorte mide ${cuerpo.length}`);
  const guardado = /const (\w+) = await guardarAhora\(\);/.exec(cuerpo);
  assert.ok(guardado, 'guarda con guardarAhora()');
  const v = guardado[1];
  const iGuardar = cuerpo.indexOf(guardado[0]);
  const iPublicar = cuerpo.indexOf("accion: 'publicar'");
  assert.ok(iPublicar > iGuardar, 'el pedido de publicar va DESPUÉS de guardar');
  assert.match(cuerpo.slice(iGuardar, iPublicar), new RegExp(`if \\(${v} == null\\) \\{[\\s\\S]*?return;`), 'si no guardó, no publica');
  const pedido = cuerpo.slice(iPublicar, cuerpo.indexOf('}', iPublicar) + 1);
  // `version` abreviado (si la variable se llama así) o `version: <la variable>`; nunca otro valor.
  const conVersion = v === 'version' ? /\bversion\s*[,}]/ : new RegExp(`\\bversion:\\s*${v}\\b`);
  assert.match(pedido, conVersion, `manda la versión que devolvió guardarAhora (${v})`);
});
