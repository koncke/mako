// =============================================================================
// AI Avatar — lo que encontró la prueba de punta a punta en producción (10/11/2026)
// =============================================================================
// Martín, 10/11/2026: «que funcione todo a la perfección, que lo pruebe también». El informe, caso por caso y con capturas,
// está en docs/pruebas/ai-avatar-10-11.md. Cada test de acá fija una falla que se VIO en producción, con el número medido.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requisitosAvatar, resumenDeRequisitos, type PuenteVisto } from '../lib/ai-avatar/requisitos';
import { PLANTILLAS_VENTA_AVATAR } from '../lib/ai-avatar/plantillas-venta';
import { nombreDeArchivo } from '../lib/ai-avatar/descarga';

const fuente = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n');
const ESTUDIO = fuente('app/ai-avatar/Estudio.tsx');
const TELEFONO = fuente('app/m/ai-avatar/EstudioM.tsx');
const CSS = fuente('app/ai-avatar/estudio.css');
/** El código sin comentarios: los comentarios nombran el `<a download>` que se fue, y eso no es usarlo. */
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('«Ver ejemplo» de una plantilla de venta se dibuja AFUERA de PantallaCrear (adentro queda en un `hidden`)', () => {
  // En producción, el diálogo existía con ancho 0: «Ver ejemplo» se toca en «Nuevo avatar», y mientras «Nuevo» está abierto
  // PantallaCrear esconde a sus hijos (`.cr-pieza hidden`). Afuera, como Lead Magnet y Offer.
  const cierre = ESTUDIO.indexOf('</PantallaCrear>');
  const modal = ESTUDIO.indexOf('<EjemploVenta ');
  assert.ok(cierre > 0 && modal > cierre, 'el modal de «Ver ejemplo» volvió adentro de PantallaCrear: se abre invisible');
  // Y «Usar esta plantilla» cierra «Nuevo avatar»: la pantalla se vuelve a montar con otra `key`.
  assert.match(ESTUDIO, /<PantallaCrear [^>]*key=\{vuelta\}/);
  assert.match(ESTUDIO, /usarVenta\(p\); setVuelta\(\(v\) => v \+ 1\);/);
});

test('el selector de presets no apila las baldosas: filas del alto de su baldosa', () => {
  // Medido a 1440 × 900: la grilla (alta fija, con scroll) achicaba las filas a 65 px y cada baldosa 3:4 (255 px) tapaba a las
  // de abajo. Con `grid-auto-rows: max-content` las filas miden 254,66 px.
  const regla = CSS.slice(CSS.indexOf('.hf-grilla--selector {'), CSS.indexOf('}', CSS.indexOf('.hf-grilla--selector {')) + 1);
  assert.match(regla, /grid-auto-rows:\s*max-content/, 'sin filas del alto de su contenido, las baldosas se pisan');
});

test('«Descargar» baja el archivo de Flow tal cual, no lo abre en otra pestaña', () => {
  // `<a download>` a Storage (otro origen): el navegador ignora `download` y ABRE la imagen. Se baja con `descargarComo`, el
  // del Video Generator: el archivo byte por byte, en su calidad original.
  for (const [nombre, src] of [['computadora', ESTUDIO], ['teléfono', TELEFONO]] as const) {
    assert.doesNotMatch(sinComentarios(src), /<a [^>]*\bdownload\b/, `${nombre}: volvió el <a download>, que abre en vez de bajar`);
    assert.match(src, /descargarComo\(/, `${nombre}: sin descargarComo`);
  }
  // Los videos también se pueden bajar (antes sólo «Editar y exportar», que lleva al Video Editor, de Pro).
  assert.match(ESTUDIO, /nombreDeArchivo\(p\.nombre, 'toma', t\.n\)/, 'el video recién filmado sin «Descargar»');
  assert.match(ESTUDIO, /nombreDeArchivo\(p\.nombre, 'toma', v\.tomas === 1/, 'los videos de antes sin «Descargar»');
});

test('el nombre de lo que se descarga se entiende y no rompe el sistema de archivos', () => {
  assert.equal(nombreDeArchivo('Charla en el auto', 'imagen'), 'Avatar - Charla en el auto.jpg');
  assert.equal(nombreDeArchivo('Charla en el auto', 'toma', 2), 'Avatar - Charla en el auto - toma 2.mp4');
  assert.equal(nombreDeArchivo('Charla en el auto', 'toma'), 'Avatar - Charla en el auto.mp4');
  assert.equal(nombreDeArchivo('a/b:c*d', 'imagen'), 'Avatar - a b c d.jpg');
  assert.equal(nombreDeArchivo('', 'imagen'), 'Avatar.jpg');
});

test('la línea de «no disponible todavía» se va sola y no tapa lo que falta para generar', () => {
  // Medido: tocar «HD» dejaba «2K y 4K: no disponible todavía» para siempre en lugar de «Antes de generar: …», con el botón
  // apagado y sin decir por qué.
  assert.match(ESTUDIO, /function usePasajera\(/);
  assert.equal((ESTUDIO.match(/usePasajera\(linea, setLinea/g) ?? []).length, 2, 'la barra del avatar y la del video');
  assert.match(TELEFONO, /Object\.values\(SIN_MOTOR\) as string\[\]\)\.includes\(linea\)[\s\S]{0,80}setTimeout\(\(\) => setLinea\(''\)/);
});

test('cada menú de la barra sale arriba de SU pastilla', () => {
  // Antes los tres (Modelo, Formato, Cantidad) salían pegados a la izquierda de la barra, lejos de la pastilla tocada.
  assert.equal((ESTUDIO.match(/<span className="hf-pastilla-lugar">/g) ?? []).length, 3);
  assert.match(CSS, /\.hf-pastilla-lugar \{ position: relative;/);
});

const puente = (estado: PuenteVisto['estado']): PuenteVisto => ({ estado, vivo: true, actualizada: true });

test('«Antes de generar»: cada paso es una oración entera, y el teléfono no dice «:» dos veces seguidas', () => {
  for (const enTelefono of [false, true]) {
    const r = requisitosAvatar({ puente: puente('sin_conectar'), instalada: false, enTelefono, fotos: 0, para: 'avatar' });
    for (const x of r.pasos) assert.match(x.titulo, /^[A-ZÁÉÍÓÚÑ]/, `«${x.titulo}» empieza en minúscula (así se lee en la lista)`);
    const linea = `Antes de generar: ${r.falta!.titulo}.`;
    assert.doesNotMatch(linea, /:[^:]*:/, `«${linea}»: dos «:» en la misma línea`);
    assert.doesNotMatch(resumenDeRequisitos(r.pasos).linea, /:[^·]*$/, 'el resumen plegado con «:» en el paso');
  }
});

test('las plantillas de venta no visten a la persona con ropa de un solo género', () => {
  // La escena de la plantilla va a la barra de quien la usa: «Con blusa blanca de lino» le ponía una blusa a cualquiera.
  for (const p of PLANTILLAS_VENTA_AVATAR) {
    assert.doesNotMatch(p.detalle, /\b(blusa|vestido|falda|corbata)\b/i, `${p.id}: «${p.detalle}»`);
  }
});
