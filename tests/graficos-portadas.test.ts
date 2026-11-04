// Tests de las PORTADAS de las plantillas (15/10/2026). Martín: «A simple vista se tienen que diferenciar MUY bien de qué es
// cada template… en cada template al principio… sea muy épico y que se note el objetivo del template con un vistazo… También
// puedes jugar con los COLORES». Cada plantilla de las dos galerías (Dashboard y General) abre con UNA pieza a lo ancho, con
// la forma de su objetivo y su color (lib/graficos-portadas.ts, lib/graficos-identidad.ts, lib/general-plantillas.ts).
// Correr: npx tsx --test tests/graficos-portadas.test.ts
//
// Probados rompiéndolos (15/10/2026), con la base en 13 pases y 0 fallos, restaurando de memoria:
//   · Instagram en azul Meta (un color repetido adentro de General)        -> 11 / 2 («la tabla de colores», «el mismo tema»)
//   · `conPortada` sin bajar el resto de la hoja                            ->  9 / 4 («cada plantilla abre…», «ninguna se pisa»)
//   · el saneo sin copiar `portada`                                         ->  7 / 6 (las portadas desaparecen al sanear)
//   · el verde de WhatsApp de antes (#138A48: 4,41 contra el blanco)        -> 12 / 1 («la tinta se lee sobre su color»)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_DASHBOARD, COLOR_GENERAL, IDENTIDADES, contraste, identidadDe, iniciales, mezclar } from '../lib/graficos-identidad';
import { ALTO_PORTADA, cerrarHueco } from '../lib/graficos-portadas';
import { PLANTILLAS_HOJA, componentesDe } from '../lib/graficos-plantillas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';
import { sanearComponente, sanearHoja, type Hoja } from '../lib/graficos-catalogo';
import type { PlantillaHoja } from '../lib/graficos-plantillas';

const hojaDe = (p: PlantillaHoja): Hoja => sanearHoja({ ...p.armar((l) => l), plantilla: p.id }, 0) as Hoja;

test('la tabla de colores: adentro de una galería ninguno se repite, y todos existen', () => {
  for (const [nombre, tabla, galeria] of [['Dashboard', COLOR_DASHBOARD, PLANTILLAS_HOJA], ['General', COLOR_GENERAL, PLANTILLAS_GENERAL]] as const) {
    const colores = galeria.map((p) => tabla[p.id]);
    assert.ok(colores.every((c) => identidadDe(c)), `${nombre}: una plantilla sin color o con uno que no existe (${galeria.map((p) => `${p.id}=${tabla[p.id]}`).join(', ')})`);
    assert.equal(new Set(colores).size, colores.length, `${nombre}: un color repetido`);
  }
});

test('el MISMO TEMA lleva el MISMO COLOR en las dos galerías', () => {
  // 4/11/2026: «Ventas del mes» se fue (la absorbe Comercial): queda el par de la cartera.
  const pares: Array<[string, string]> = [['cs-analyst', 'servicio']];
  for (const [d, g] of pares) assert.equal(COLOR_DASHBOARD[d], COLOR_GENERAL[g], `${d} y ${g}`);
  assert.equal(COLOR_GENERAL.instagram, 'magenta', 'el magenta es de Instagram');
  assert.ok(!Object.values(COLOR_DASHBOARD).includes('magenta'), 'y ninguna del Dashboard lo usa');
});

test('la tinta se lee sobre su color: 4,5 la letra, y 3 los grises de la portada', () => {
  for (const x of IDENTIDADES) {
    assert.ok(contraste(x.fondo, x.tinta) >= 4.5, `${x.id}: ${contraste(x.fondo, x.tinta).toFixed(2)}`);
    // El gris de los rótulos de una portada es la tinta al 72 % sobre el fondo (paletaDePortada y --dim en editor-css.ts).
    assert.ok(contraste(x.fondo, mezclar(x.tinta, x.fondo, 0.72)) >= 3, `${x.id}: el gris no se lee`);
  }
});

// Desde el 1/11/2026 ninguna plantilla trae portada: lib/graficos-portadas.ts, `comoDenso`, y tests/graficos-corbel.test.ts. El saneo
// y el dibujo siguen entendiéndola, porque hay hojas guardadas con la suya.
test('ninguna plantilla se pisa', () => {
  for (const p of [...PLANTILLAS_HOJA, ...PLANTILLAS_GENERAL]) {
    const cs = hojaDe(p).componentes;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i]; const b = cs[j];
      const cruzan = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!cruzan, `${p.id}: ${a.id} (${a.x},${a.y} ${a.w}×${a.h}) pisa a ${b.id} (${b.x},${b.y} ${b.w}×${b.h})`);
    }
  }
});

test('el hueco que deja la portada: una fila de números se reparte el ancho, y lo de abajo sube', () => {
  const n = (id: string, x: number) => ({ id, clase: 'grafico', tipo: 'numero', x, y: 0, w: 3, h: 4 });
  const comps = [n('a', 0), n('b', 3), n('c', 6), n('d', 9), { id: 'g', clase: 'grafico', tipo: 'serie', x: 0, y: 4, w: 12, h: 8 }];
  const out = cerrarHueco(comps.filter((c) => c.id !== 'b'), comps[1]);
  assert.deepEqual(out.filter((c) => c.tipo === 'numero').map((c) => [c.id, c.x, c.w]), [['a', 0, 4], ['c', 4, 4], ['d', 8, 4]]);
  // Un gráfico a lo ancho que se va: lo de abajo sube su alto.
  const solo = [n('arriba', 0), { id: 'x', clase: 'grafico', tipo: 'area', x: 0, y: 4, w: 12, h: 10 }, { id: 'y', clase: 'grafico', tipo: 'serie', x: 0, y: 14, w: 12, h: 8 }];
  assert.equal(cerrarHueco([solo[0], solo[2]], solo[1]).find((c) => c.id === 'y')!.y, 4);
  // Dos piezas con el MISMO id local (pasa antes del saneo): cada una conserva su lugar.
  const gemelas = [{ ...n('dup', 0), w: 12, h: 1 }, { ...n('dup', 0), y: 1 }];
  assert.deepEqual(cerrarHueco(gemelas, { id: 'z', x: 0, y: 20, w: 12, h: 1 }).map((c) => c.y), [0, 1]);
  // Uno de media hoja: su vecino se estira.
  const medias = [{ id: 'm', clase: 'grafico', tipo: 'embudo_vertical', x: 0, y: 4, w: 6, h: 10 }, { id: 'v', clase: 'grafico', tipo: 'serie', x: 6, y: 4, w: 6, h: 10 }];
  assert.deepEqual(['x', 'w'].map((k) => cerrarHueco([medias[1]], medias[0])[0][k as 'x' | 'w']), [0, 12]);
  assert.equal(ALTO_PORTADA, 11);
});

test('el saneo guarda una portada que existe y tira la que no (y en un pop-up, ninguna)', () => {
  const g = (portada: unknown) => ({ id: 'p1', clase: 'grafico', tipo: 'numero', fuente: 'negocio', metricas: ['cac'], x: 0, y: 0, w: 12, h: 11, portada });
  assert.equal((sanearComponente(g('azul-meta')) as { portada?: string }).portada, 'azul-meta');
  assert.equal((sanearComponente(g('rosa-chicle')) as { portada?: string }).portada, undefined);
  assert.equal((sanearComponente(g('azul-meta'), { enPopup: true }) as { portada?: string } | null)?.portada, undefined);
});

test('las iniciales de una persona', () => {
  assert.equal(iniciales('Ana Gómez'), 'AG');
  assert.equal(iniciales('lucía'), 'L');
  assert.equal(iniciales('ana@correo.com'), 'A');
  assert.equal(iniciales('  '), '·');
});

test('la pieza que manda conserva su id (el closer y la caja de IA la buscan así)', () => {
  const ids = (id: string) => componentesDe(PLANTILLAS_HOJA.find((p) => p.id === id)!).map((c) => c.id);
  // Marketing: la que sube a portada (lib/graficos-portadas.ts, `sube: 'mk-tendencias'`) y las de la firma de la hoja guardada de antes.
  for (const id of ['mk-tendencias', 'mk-spend', 'mk-funnel', 'mk-anuncios']) assert.ok(ids('marketing').includes(id), id);
  assert.ok(ids('closing').includes('cl-embudo-embudo'));
});
