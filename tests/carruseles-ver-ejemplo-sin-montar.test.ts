// «Ver ejemplo» de los carruseles de MaKo: el titular nunca tapa el texto de abajo (19/11/2026).
//
// Lo encontró el chat de los carruseles de ventas dibujando los ejemplos de lib/carruseles/tipos.ts con el mismo código que «Ver
// ejemplo» (`documentoDeCarrusel` → `PaginaCarrusel`): el titular de varias láminas terminaba ENCIMA de su bajada («Comprar en
// preventa no es para todos», la portada de «Opinión»). Medido con la tabla real de anchos del editor (lib/carruseles/medir-letra.ts)
// eran 14 de 53 láminas, hasta 207 px de montado: el alto de cada caja salía de `altoEstimado` (0,58 del cuerpo por letra), y
// Archivo Black es más ancha, así que el titular ocupaba un renglón más de lo calculado. Ahora `pagina` MIDE (`altoMedido`).
//
// Fija, para el ejemplo de cada tipo:
//   1. el titular, medido como lo parte el editor, termina antes de donde empieza su texto;
//   2. el texto no baja hasta la flecha ni el «Desliza →» (1150 px), y ningún renglón se sale a lo ancho;
//   3. el alto que guarda el documento es el medido (el editor lo vuelve a medir igual: no salta al abrir).
//
// Correr: node --import tsx --test tests/carruseles-ver-ejemplo-sin-montar.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS_CARRUSEL } from '../lib/carruseles/tipos';
import { documentoDeCarrusel, altoMedido } from '../lib/carruseles/documento';
import { altoEnElEditor, medidorReal } from '../lib/carruseles/medir-letra';
import { partirEnRenglones } from '../lib/carruseles/tipografia-medida';

type Obj = Record<string, unknown>;
let n = 0;
const paginas = TIPOS_CARRUSEL.flatMap((t) => {
  const doc = documentoDeCarrusel({ laminas: t.ejemplo.laminas, estilo: t.estilo, marca: { nombre: t.ejemplo.negocio, usuario: t.ejemplo.usuario }, nuevoId: () => `o${++n}` });
  return (doc.pages as Array<{ objects: Obj[] }>).map((p, i) => ({ donde: `${t.id} lámina ${i + 1}`, objetos: p.objects }));
});
const medir = (o: Obj) => {
  const f = { familia: String(o.fontFamily), peso: Number(o.fontWeight), italica: false, tam: Number(o.fontSize), espaciado: Number(o.charSpacing ?? 0) };
  const renglones = partirEnRenglones(String(o.text), Number(o.width), f, medidorReal);
  return { alto: altoEnElEditor(renglones.length, f.tam, Number(o.lineHeight)), ancho: Math.max(...renglones.map((r) => medidorReal(r, f))) };
};

test('1 · el titular de ningún ejemplo termina encima de su texto', () => {
  assert.ok(paginas.length >= 50, `están todos los ejemplos (${paginas.length})`);
  const montadas = paginas.flatMap(({ donde, objetos }) => {
    const tit = objetos.find((o) => o.name === 'Titular');
    const cuerpo = objetos.find((o) => o.name === 'Texto' || o.name === 'Bajada');
    if (!tit || !cuerpo) return [];
    const fin = Number(tit.top) + medir(tit).alto;
    return fin > Number(cuerpo.top) ? [`${donde}: el titular termina en ${Math.round(fin)} y el texto empieza en ${cuerpo.top}`] : [];
  });
  assert.deepEqual(montadas, []);
});

test('2 · el texto no baja hasta la flecha y nada se sale a lo ancho', () => {
  const malas = paginas.flatMap(({ donde, objetos }) => objetos
    .filter((o) => o.name === 'Titular' || o.name === 'Texto' || o.name === 'Bajada')
    .flatMap((o) => {
      const m = medir(o);
      const out: string[] = [];
      if (Number(o.top) + m.alto > 1150) out.push(`${donde} ${o.name}: termina en ${Math.round(Number(o.top) + m.alto)}`);
      if (m.ancho > Number(o.width) + 0.5) out.push(`${donde} ${o.name}: un renglón mide ${Math.round(m.ancho)} en ${o.width}`);
      return out;
    }));
  assert.deepEqual(malas, []);
});

test('3 · el alto guardado es el medido (y una palabra que no entra a lo ancho no da alto)', () => {
  for (const { objetos } of paginas) {
    for (const o of objetos.filter((x) => x.name === 'Titular' || x.name === 'Texto' || x.name === 'Bajada')) {
      assert.equal(Number(o.height), Math.ceil(medir(o).alto));
    }
  }
  assert.equal(altoMedido('Supercalifragilístico', { familia: '"Archivo Black", sans-serif', peso: 400 }, 150, 400, 1.05), null);
});
