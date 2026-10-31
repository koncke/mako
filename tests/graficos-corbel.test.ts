// =============================================================================
// El estilo por defecto del Dashboard: los VALORES de Corbel, y su composición (31/10/2026)
// =============================================================================
// Martín: «ya estan los dashboard? Ya lo aplicamos? Sigo viendo los templates viejos». La primera vuelta describió los
// patrones con palabras y no tomó un solo valor. Este test compara la tabla de lib/graficos-corbel.ts con lo que se leyó
// de la demo (docs/diseno/tokens-corbel.json): si alguien «mejora» un color, se pone rojo.
//
// Correr: node --import tsx --test tests/graficos-corbel.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CSS_CORBEL, PALETAS_CORBEL, seriesDeEscena, tilesDeHoja, type EscenaCorbel } from '../lib/graficos-corbel';
import { TEMA_BASE, acentoDePortada, estiloEfectivo, paletaDeEscena, plantillaDe, sanearTema, varsDeTema } from '../lib/graficos-temas';
import { componentesDe, PLANTILLAS_HOJA } from '../lib/graficos-plantillas';
import { comoCorbel, ALTO_NUMEROS, ALTO_PROTAGONISTAS } from '../lib/graficos-portadas';

const MEDIDO = JSON.parse(readFileSync('docs/diseno/tokens-corbel.json', 'utf8'));
const leer = (r: string) => readFileSync(r, 'utf8').replace(/\r\n/g, '\n');

/** Qué token de Corbel es cada token nuestro. */
const EQUIVALE: Readonly<Record<string, string>> = {
  '--bg': '--bg', '--surface': '--surface', '--ink': '--text', '--dim': '--muted', '--faint': '--faint',
  '--border': '--line', '--border-strong': '--line-2', '--primary': '--primary', '--primary-bg': '--primary-soft',
  '--good': '--up', '--bad': '--down', '--warn': '--warn',
  '--cb-glass': '--glass', '--cb-rim': '--rim', '--cb-shadow': '--shadow', '--cb-ocean': '--ocean', '--cb-on-ocean': '--on-ocean',
  '--cb-sky': '--sky', '--cb-mint': '--mint', '--cb-lemon': '--lemon', '--cb-coral': '--coral',
  '--cb-c1': '--c1', '--cb-c2': '--c2', '--cb-c3': '--c3', '--cb-c4': '--c4', '--cb-c5': '--c5',
};

test('cada color de la tabla es el que se leyó de la demo, en las cuatro paletas y en los dos temas', () => {
  let comparados = 0;
  for (const escena of Object.keys(PALETAS_CORBEL) as EscenaCorbel[]) {
    for (const modo of ['claro', 'oscuro'] as const) {
      const medido = MEDIDO.paletas[escena][modo] as Record<string, string>;
      for (const [nuestro, suyo] of Object.entries(EQUIVALE)) {
        if (medido[suyo] === undefined) continue; // El JSON resume lo que se repite entre paletas (`_resto`).
        assert.equal(PALETAS_CORBEL[escena][modo][nuestro], medido[suyo], `${escena}/${modo}: ${nuestro} (el ${suyo} de Corbel)`);
        comparados++;
      }
    }
  }
  assert.ok(comparados > 120, `se compararon ${comparados}: el test no puede pasar por no mirar nada`);
});

test('el semáforo es el mismo en las cuatro paletas: lo que cambia es la paleta, no lo que significa', () => {
  for (const escena of Object.keys(PALETAS_CORBEL) as EscenaCorbel[]) {
    for (const t of ['--good', '--bad', '--warn']) {
      assert.equal(PALETAS_CORBEL[escena].claro[t], PALETAS_CORBEL.mono.claro[t]);
      assert.equal(PALETAS_CORBEL[escena].oscuro[t], PALETAS_CORBEL.mono.oscuro[t]);
    }
  }
});

test('el de por defecto es el blanco y negro, y lo trae toda hoja que nunca eligió otro', () => {
  assert.equal(TEMA_BASE.plantilla, 'mako', 'el id es lo que se guarda: cambiarlo dejaría a las hojas viejas en otra cosa');
  assert.equal(plantillaDe('mako').escena, 'mono');
  assert.equal(paletaDeEscena(sanearTema(null)), 'mono');
  assert.equal(paletaDeEscena(sanearTema({ plantilla: 'inventada' })), 'mono');
  assert.equal(plantillaDe('mako').fuente, 'urbanist');
  assert.deepEqual(plantillaDe('mako').paleta.slice(0, 2), seriesDeEscena('mono').slice(0, 2));
});

test('los demás se ELIGEN y no desaparecen: las otras tres paletas y los estilos de antes', () => {
  for (const id of ['pastel', 'oceano', 'salvia']) assert.ok(plantillaDe(id).escena, id);
  for (const id of ['clasica', 'minimal', 'suave', 'contraste', 'elevada', 'general', 'editorial']) {
    assert.equal(plantillaDe(id).id, id);
    assert.equal(plantillaDe(id).escena, undefined, `${id} no se pinta con Corbel`);
    assert.equal(paletaDeEscena(sanearTema({ plantilla: id })), undefined);
  }
});

test('la tarjeta y el número salen con los valores de Corbel', () => {
  const v = varsDeTema(sanearTema(null));
  assert.equal(v['--dash-tarjeta-radio'], '22px');
  assert.equal(v['--dash-tarjeta-pad'], '20px');
  assert.equal(v['--dash-titulo-tam'], '15px');
  assert.equal(v['--dash-titulo-espacio'], '-0.075px');
  assert.match(v['--dash-tarjeta-fondo'], /--cb-glass/);
  assert.match(v['--dash-tarjeta-sombra'], /inset 0 0 0 1px var\(--cb-rim/);
  const e = estiloEfectivo(sanearTema(null));
  assert.equal(e.kpiMaximo, 26);
  assert.equal(e.kpiMaximoPortada, 34);
  assert.match(CSS_CORBEL, /padding:18px 20px 16px/);
  assert.match(CSS_CORBEL, /\.lk-comp-tit\{font-size:12\.5px;font-weight:600/);
  // Los de antes no cambian: su número sigue llenando la tarjeta.
  assert.equal(estiloEfectivo(sanearTema({ plantilla: 'clasica' })).kpiMaximo, undefined);
});

test('la portada es negra con este estilo, y el color de cada plantilla vuelve con «Clásica»', () => {
  assert.equal(acentoDePortada(sanearTema(null)), '#121212');
  assert.equal(acentoDePortada(sanearTema({ plantilla: 'clasica' })), null);
  assert.equal(acentoDePortada(sanearTema({ plantilla: 'mako', acento: '#ff0000' })), '#ff0000', 'el color que eligió gana');
  assert.equal(acentoDePortada(sanearTema({ plantilla: 'pastel' })), '#1f4d6a');
  assert.match(CSS_CORBEL, /--portada-fondo:var\(--cb-ocean\) !important/);
  assert.match(CSS_CORBEL, /\.lk-comp--portada::before\{display:none\}/, 'sin el círculo ni la diagonal de la tapa de Canva');
});

test('los tiles salen de la POSICIÓN: negro, blanco, gris y gris más oscuro, de izquierda a derecha', () => {
  const n = (id: string, x: number, y = 0, extra = {}) => ({ id, x, y, esNumero: true, ...extra });
  const t = tilesDeHoja([n('d', 9), n('b', 3), n('a', 0), n('c', 6)]);
  assert.deepEqual(['a', 'b', 'c', 'd'].map((i) => t.get(i)), ['sky', 'mint', 'lemon', 'coral']);
  // La invertida es el negro aunque no sea la primera, y los otros siguen en orden.
  const i = tilesDeHoja([n('a', 0), n('b', 3, 0, { invertida: true }), n('c', 6)]);
  assert.deepEqual(['a', 'b', 'c'].map((x) => i.get(x)), ['mint', 'sky', 'lemon']);
  // Una sola ancla: las filas de abajo no llevan negro.
  const f = tilesDeHoja([n('a', 0), n('b', 0, 8)]);
  assert.equal(f.get('a'), 'sky');
  assert.equal(f.get('b'), 'mint');
  // Lo que no es un número, o ya es la tarjeta negra, no lleva tile.
  const o = tilesDeHoja([{ id: 'g', x: 0, y: 0, esNumero: false }, n('p', 0, 0, { portada: 'azul-meta' }), n('k', 3)]);
  assert.equal(o.get('g'), undefined);
  assert.equal(o.get('p'), undefined);
  assert.equal(o.get('k'), 'sky');
});

test('EL RAYADO NO SE COPIA: acá significa «Estimado», y un número medido no se dibuja rayado', () => {
  assert.doesNotMatch(CSS_CORBEL, /repeating-linear-gradient/);
  assert.doesNotMatch(leer('lib/graficos-corbel.ts').replace(/^\/\/.*$/gm, ''), /--hatch/);
});

// ── La composición ──────────────────────────────────────────────────────────────────────

const pisa = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('cada plantilla abre como Corbel: los números arriba y debajo la tarjeta negra, sin pisarse nada', () => {
  assert.ok(PLANTILLAS_HOJA.length >= 13);
  for (const p of PLANTILLAS_HOJA) {
    const comps = componentesDe(p);
    const negra = comps.find((c) => (c as { portada?: unknown }).portada);
    assert.ok(negra, `${p.id}: sin pieza protagonista`);
    assert.ok(negra.y <= ALTO_NUMEROS, `${p.id}: la tarjeta negra va en la segunda fila`);
    assert.equal(negra.x, 0, p.id);
    const arriba = comps.filter((c) => c.y === 0 && c !== negra);
    if (negra.y > 0) {
      assert.ok(arriba.length >= 1 && arriba.length <= 4, `${p.id}: ${arriba.length} números arriba`);
      assert.equal(arriba.reduce((s, c) => s + c.w, 0), 12, `${p.id}: la fila llena el ancho`);
      for (const c of arriba) assert.equal(c.h, ALTO_NUMEROS, `${p.id}: ${c.id}`);
    }
    for (let i = 0; i < comps.length; i++) for (let j = i + 1; j < comps.length; j++) {
      assert.ok(!pisa(comps[i], comps[j]), `${p.id}: ${comps[i].id} pisa a ${comps[j].id}`);
    }
  }
});

test('la pieza es la misma y conserva su id: el closer y la caja de IA la buscan así', () => {
  const hoja = {
    componentes: [
      { id: 'n1', clase: 'grafico', tipo: 'numero', x: 0, y: 0, w: 3, h: 4 },
      { id: 'n2', clase: 'grafico', tipo: 'numero', x: 3, y: 0, w: 3, h: 4, invertida: true },
      { id: 'hero', clase: 'grafico', tipo: 'numero', x: 6, y: 0, w: 6, h: 4 },
      { id: 'tabla', clase: 'grafico', tipo: 'tabla', x: 0, y: 4, w: 12, h: 8 },
      { id: 'serie', clase: 'grafico', tipo: 'serie', x: 0, y: 12, w: 12, h: 8 },
    ],
  };
  const out = comoCorbel(hoja, { sube: 'hero' }, 'azul-meta', (l) => l).componentes as Array<Record<string, unknown>>;
  const de = (id: string) => out.find((c) => c.id === id)!;
  assert.equal(de('n2').x, 0, 'la invertida abre la fila');
  assert.equal(de('n1').x, 6);
  assert.deepEqual([de('hero').x, de('hero').w, de('hero').h, de('hero').portada], [0, 4, ALTO_PROTAGONISTAS, 'azul-meta']);
  assert.deepEqual([de('serie').x, de('serie').y, de('serie').w], [4, ALTO_NUMEROS, 8], 'al lado va el gráfico en el tiempo, no la tabla');
  assert.ok((de('tabla').y as number) >= ALTO_NUMEROS + ALTO_PROTAGONISTAS);
});

test('lo que no entra en un tercio va a lo ancho', () => {
  const hoja = { componentes: [{ id: 'a', clase: 'grafico', tipo: 'serie', x: 0, y: 0, w: 12, h: 8 }] };
  const out = comoCorbel(hoja, { nueva: () => ({ id: 'p', clase: 'grafico', tipo: 'tarjetas' }) }, 'coral', (l) => l).componentes as Array<Record<string, unknown>>;
  assert.equal(out[0].id, 'p');
  assert.equal(out[0].w, 12);
});

test('las pantallas lo usan: el editor y la miniatura llevan la paleta y los tiles', () => {
  const e = leer('app/dashboard/EditorInforme.tsx');
  assert.match(e, /<div className=\{`lk lk-app[^`]*`\} data-paleta=\{paleta\}/);
  assert.match(e, /data-tile=\{tiles\?\.get\(c\.id\)\}/);
  assert.match(e, /<style>\{CSS_CORBEL\}<\/style>/);
  assert.match(e, /marcoDePortada\(c, acentoDePortada\(hoja\.tema\)\)/);
  const m = leer('app/dashboard/MiniaturaHoja.tsx');
  assert.match(m, /data-paleta=\{hoja \? paletaDeEscena\(hoja\.tema\) : undefined\}/);
  assert.match(m, /data-tile=\{tile\}/);
  assert.match(leer('app/dashboard/NuevaHoja.tsx'), /<style>\{CSS_CORBEL\}<\/style>/);
  const g = leer('app/dashboard/Grafico.tsx');
  assert.match(g, /maximo=\{portada \? e\.kpiMaximoPortada \?\? MAXIMO_PORTADA : e\.kpiMaximo\}/);
});

test('lo que no tiene hoja sigue con lo de antes: el chat, y la ficha del lead si nadie le eligió un estilo', () => {
  assert.match(leer('app/_chat/bloques/GraficoHilo.tsx'), /sanearTema\(\{ plantilla: 'clasica' \}\)/);
  assert.match(leer('app/crm/lead-view/ficha/armar.ts'), /const conTema = temaPropio\(t\);/);
  // Sin `data-paleta` (la ficha no la lleva), la tarjeta cae a los tokens de la casa y no queda transparente.
  const v = varsDeTema(sanearTema({ esquinas: 'rectas' }));
  assert.match(v['--dash-tarjeta-fondo'], /var\(--cb-glass, var\(--surface\)\)/);
  assert.match(v['--dash-tarjeta-sombra'], /var\(--cb-rim, transparent\)/);
  assert.match(seriesDeEscena('mono')[0], /^var\(--cb-c1, #121212\)$/);
});
