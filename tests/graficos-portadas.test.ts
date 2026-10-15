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
import { esElemento, esGrafico, sanearComponente, sanearHoja, type Componente, type Hoja } from '../lib/graficos-catalogo';
import type { PlantillaHoja } from '../lib/graficos-plantillas';

const hojaDe = (p: PlantillaHoja): Hoja => sanearHoja({ ...p.armar((l) => l), plantilla: p.id }, 0) as Hoja;
const portadaDe = (h: Hoja): Componente | undefined => h.componentes.find((c) => (c as { portada?: string }).portada);
/** La FORMA de una portada: el tipo de gráfico, o el bloque de General que es. */
const formaDe = (c: Componente): string => (esGrafico(c) ? c.tipo : esElemento(c) ? `${c.tipo}:${c.general?.pieza ?? ''}` : '?');

test('la tabla de colores: adentro de una galería ninguno se repite, y todos existen', () => {
  for (const [nombre, tabla, galeria] of [['Dashboard', COLOR_DASHBOARD, PLANTILLAS_HOJA], ['General', COLOR_GENERAL, PLANTILLAS_GENERAL]] as const) {
    const colores = galeria.map((p) => tabla[p.id]);
    assert.ok(colores.every((c) => identidadDe(c)), `${nombre}: una plantilla sin color o con uno que no existe (${galeria.map((p) => `${p.id}=${tabla[p.id]}`).join(', ')})`);
    assert.equal(new Set(colores).size, colores.length, `${nombre}: un color repetido`);
  }
});

test('el MISMO TEMA lleva el MISMO COLOR en las dos galerías', () => {
  const pares: Array<[string, string]> = [['chat-analyst', 'funnel-whatsapp'], ['marketing', 'anuncios'], ['cobranza', 'cobros'], ['vsl-analyst', 'lanzamiento'], ['closing', 'funnel-llamadas'], ['cs-analyst', 'servicio'], ['comercial', 'ventas']];
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

for (const [nombre, galeria] of [['Dashboard', PLANTILLAS_HOJA], ['General', PLANTILLAS_GENERAL]] as const) {
  test(`${nombre}: cada plantilla abre con su portada, arriba de todo y a lo ancho, con su color`, () => {
    for (const p of galeria) {
      const h = hojaDe(p);
      const portada = portadaDe(h);
      assert.ok(portada, `${p.id} no tiene portada`);
      assert.deepEqual([portada.x, portada.y, portada.w], [0, 0, 12], `${p.id}: la portada no está arriba a lo ancho`);
      assert.ok(portada.h >= 8, `${p.id}: una portada de ${portada.h} filas no es la portada`);
      assert.ok(h.componentes.every((c) => c === portada || c.y >= portada.y + portada.h), `${p.id}: algo se mete en la portada`);
      assert.equal(h.componentes.filter((c) => (c as { portada?: string }).portada).length, 1, `${p.id}: UNA portada`);
    }
  });

  test(`${nombre}: las portadas tienen formas distintas (el color nunca es lo único que las separa)`, () => {
    const formas = galeria.map((p) => formaDe(portadaDe(hojaDe(p))!));
    // Dos portadas con el mismo tipo tienen que ser OTRA cosa: otros datos (dos números de temas distintos se separan por
    // el titular y el color). Lo que no puede pasar es que más de dos compartan forma: eso era la galería de antes.
    const cuenta = new Map<string, number>();
    for (const f of formas) cuenta.set(f, (cuenta.get(f) ?? 0) + 1);
    const repetidas = [...cuenta].filter(([, n]) => n > 2);
    assert.deepEqual(repetidas, [], `${nombre}: ${formas.join(', ')}`);
  });

  test(`${nombre}: ninguna plantilla se pisa`, () => {
    for (const p of galeria) {
      const cs = hojaDe(p).componentes;
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i]; const b = cs[j];
        const cruzan = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.ok(!cruzan, `${p.id}: ${a.id} (${a.x},${a.y} ${a.w}×${a.h}) pisa a ${b.id} (${b.x},${b.y} ${b.w}×${b.h})`);
      }
    }
  });
}

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

test('la portada de cada hoja del Dashboard conserva el id de la pieza que sube (el closer y la caja de IA la buscan así)', () => {
  const mk = componentesDe(PLANTILLAS_HOJA.find((p) => p.id === 'marketing')!);
  assert.equal(portadaDe({ componentes: mk } as Hoja)?.id, 'mk-cac');
  const cl = componentesDe(PLANTILLAS_HOJA.find((p) => p.id === 'closing')!);
  assert.equal(portadaDe({ componentes: cl } as Hoja)?.id, 'cl-embudo-embudo');
});
