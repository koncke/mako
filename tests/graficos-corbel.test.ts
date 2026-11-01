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
import { TEMA_BASE, acentoDePortada, estiloEfectivo, paletaDe, paletaDeEscena, pintaPortada, plantillaDe, sanearTema, varsDeTema } from '../lib/graficos-temas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';
import { fuenteDe, sanearHoja } from '../lib/graficos-catalogo';
import { componentesDe, instanciarPlantilla, PLANTILLAS_HOJA } from '../lib/graficos-plantillas';
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
  '--cb-c1': '--c1',
};
/** Las otras series, reordenadas o cambiadas (`seriesDeEscena`): algunos no llegan a 2:1 y se cambiaron (`seriesDeEscena`). Lo que se ve tiene que ser un valor medido. */
const todosLosMedidos = (o: unknown): string => JSON.stringify(o).toLowerCase();

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
  const medidos = todosLosMedidos(MEDIDO.paletas);
  for (const escena of Object.keys(PALETAS_CORBEL) as EscenaCorbel[]) for (const modo of ['claro', 'oscuro'] as const) for (let n = 1; n <= 8; n++) {
    const v = PALETAS_CORBEL[escena][modo][`--cb-c${n}`];
    assert.ok(medidos.includes(`"${v}"`), `${escena}/${modo} c${n} = ${v}: no es un valor de la demo`);
  }
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
  assert.equal(plantillaDe('mako').fuente, 'urb');
  assert.equal(plantillaDe('general').escena, 'mono', 'las hojas de General también: «incluso los dashboard ya creados»');
  assert.deepEqual(plantillaDe('mako').paleta.slice(0, 2), seriesDeEscena('mono').slice(0, 2));
});

test('los demás se ELIGEN y no desaparecen: las otras tres paletas y los estilos de antes', () => {
  for (const id of ['pastel', 'azul', 'verde']) assert.ok(plantillaDe(id).escena, id);
  for (const id of ['vieja', 'minimal', 'suave', 'contraste', 'elevada', 'editorial']) {
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
  assert.equal(estiloEfectivo(sanearTema({ plantilla: 'vieja' })).kpiMaximo, undefined);
});

test('la portada es negra con este estilo, y el color de cada plantilla vuelve con «Clásica»', () => {
  assert.equal(acentoDePortada(sanearTema(null)), '#121212');
  assert.equal(acentoDePortada(sanearTema({ plantilla: 'vieja' })), null);
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

// El contraste WCAG, para medir tonos entre sí.
const lum = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const cr = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('los seis neutros de Mono se distinguen CON CUALQUIER CANTIDAD de series: un anillo con cuatro canales usa los primeros cuatro', () => {
  for (const modo of ['claro', 'oscuro'] as const) {
    const t = PALETAS_CORBEL.mono[modo];
    const seis = [1, 2, 3, 4, 5, 6].map((n) => t[`--cb-c${n}`]);
    for (const c of seis) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
      assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 8, `${modo} ${c}: un neutro no lleva tono (ni el verde ni el rojo del semáforo)`);
    }
    for (let n = 2; n <= 6; n++) {
      const usados = seis.slice(0, n);
      usados.forEach((c, i) => {
        const vecino = usados[(i + 1) % n];
        assert.ok(cr(c, vecino) >= 1.5, `${modo}, con ${n} series: ${c} y ${vecino} quedan vecinos con ${cr(c, vecino).toFixed(2)}`);
      });
    }
    // Aunque no se toquen, dos iguales no se pueden leer en la leyenda.
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) assert.ok(cr(seis[i], seis[j]) >= 1.25, `${modo}: ${seis[i]} y ${seis[j]}`);
  }
});

test('las hojas de General salen en blanco y negro: guardan el tema «general», no «mako», y un id que no existe no se queja', () => {
  assert.ok(PLANTILLAS_GENERAL.length >= 10);
  for (const p of PLANTILLAS_GENERAL) {
    const h = sanearHoja({ ...p.armar((l: string) => l), plantilla: p.id }, 0)!;
    assert.equal(h.tema.plantilla, 'general', `${p.id} guarda otro tema: si es uno que no existe, cae a otro sin avisar`);
    assert.equal(paletaDeEscena(h.tema), 'mono', `${p.id} no se pinta con Corbel`);
    assert.equal(acentoDePortada(h.tema), '#121212', `${p.id}: su portada no sale negra`);
    assert.match(paletaDe(h.tema)[0], /--cb-c1/, `${p.id}: sus series siguen con otra paleta`);
  }
});

test('el riel: 30 de ancho tope y el extremo redondo, sólo con Corbel', () => {
  const e = estiloEfectivo(sanearTema(null));
  assert.equal(e.anchoBarra, 30);
  assert.equal(e.radioBarra, 15);
  assert.equal(estiloEfectivo(sanearTema({ plantilla: 'vieja' })).anchoBarra, undefined);
  const g = leer('app/dashboard/Grafico.tsx');
  assert.doesNotMatch(g, /maxBarSize: BARRA\.maxVertical|maxBarSize=\{BARRA\.maxVertical\}/);
});

test('el teléfono, con lo medido a 390', () => {
  const tel = MEDIDO.telefono;
  assert.match(tel.kpi.caja, /padding 14px, gap 8px/);
  assert.match(CSS_CORBEL, /\.lk-pila>\.lk-comp--kpi\{padding:14px;gap:8px\}/);
  assert.match(tel.kpi.grilla, /gap 10px/);
  assert.match(CSS_CORBEL, /\.lk-pila\{gap:10px\}/);
  assert.match(tel.kpi.valor, /^22px/);
  assert.match(CSS_CORBEL, /\.gr-numero-val\{font-size:22px !important/);
  assert.match(tel.tarjeta.padding, /^16px/);
  assert.match(CSS_CORBEL, /\.lk-pila>\.lk-comp\{padding:16px\}/);
  assert.match(leer('app/dashboard/Grafico.tsx'), /<span className="gr-numero-val"/);
  const g = leer('app/globals.css');
  assert.equal(g.split('--fs-page: 28px;').length - 1, 2, 'el móvil y /m');
  assert.equal(g.split('--fs-kpi: 22px;').length - 1, 2);
});

test('Foco: números arriba, los OKR a lo ancho en vidrio (no en negro), y el par 7 + 5', () => {
  const p = PLANTILLAS_GENERAL.find((x) => x.id === 'foco')!;
  const h = sanearHoja({ ...p.armar((l: string) => l), plantilla: p.id }, 0)!;
  const c = h.componentes as Array<Record<string, any>>;
  const numeros = c.filter((x) => x.tipo === 'numero').sort((a, b) => a.x - b.x);
  assert.deepEqual(numeros.map((x) => [x.x, x.y, x.w]), [[0, 0, 4], [4, 0, 4], [8, 0, 4]], 'tres iguales, arriba de todo y sin hueco');
  const okr = c.find((x) => x.general?.pieza === 'objetivos')!;
  assert.deepEqual([okr.x, okr.y, okr.w, okr.h], [0, 4, 12, 8]);
  assert.equal(okr.portada, undefined, 'no entra en un tercio: en vidrio, sin negro');
  assert.equal(okr.texto, 'Cómo vas con tus OKRs');
  assert.equal(okr.general.opciones.estilo, 'barras', 'con anillos, «Facturar $30,000 e…» se corta');
  const tareas = c.find((x) => x.general?.pieza === 'tareas')!;
  const dl = c.find((x) => x.general?.pieza === 'deadlines')!;
  assert.deepEqual([tareas.x, tareas.w, dl.x, dl.w, tareas.y === dl.y, tareas.h === dl.h], [0, 7, 7, 5, true, true]);
  assert.deepEqual(dl.general.opciones, { dias: '7', que: 'tareas' });
  // Lo demás, plegado: no se borró.
  const sec = c.find((x) => x.tipo === 'seccion')!;
  assert.equal(sec.seccion.abierto, false);
  assert.ok(c.find((x) => x.general?.pieza === 'proyectos')!.y > sec.y);
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) assert.ok(!pisa(c[i] as never, c[j] as never), `${c[i].id} pisa a ${c[j].id}`);
});

test('LA COMPOSICIÓN DE CORBEL A 1440: números, negro 4 + gráfico 8, 7 + 5, y lo demás plegado sin borrar nada', () => {
  const m = MEDIDO.composicion_de_pagina.escritorio_1440.filas;
  assert.deepEqual(m.map((x: { columnas: number }) => x.columnas), [12, 4, 8, 7, 5]);
  for (const p of PLANTILLAS_HOJA) {
    const c = componentesDe(p) as unknown as Array<Record<string, any>>;
    const sec = c.find((x) => x.tipo === 'seccion' && x.seccion?.plegable);
    const vista = sec ? c.filter((x) => x.y < sec.y) : c;
    const negra = vista.filter((x) => x.portada);
    assert.equal(negra.length, 1, `${p.id}: una sola negra`);
    assert.deepEqual([negra[0].x, negra[0].y, negra[0].w, negra[0].h], [0, ALTO_NUMEROS, 4, ALTO_PROTAGONISTAS], `${p.id}: el negro va en un tercio, nunca de encabezado`);
    const vecino = vista.find((x) => x.x === 4 && x.y === ALTO_NUMEROS)!;
    assert.deepEqual([vecino.w, vecino.h], [8, ALTO_PROTAGONISTAS], p.id);
    assert.ok(vista.length <= 8, `${p.id}: ${vista.length} bloques a la vista`);
    const abajo = vista.filter((x) => x.y === ALTO_NUMEROS + ALTO_PROTAGONISTAS).sort((a, b) => a.x - b.x);
    assert.ok(abajo.length === 2 ? abajo[0].w === 7 && abajo[1].w === 5 : abajo[0].w === 12, `${p.id}: ${abajo.map((x) => x.w)}`);
    for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) assert.ok(!pisa(c[i] as never, c[j] as never), `${p.id}: ${c[i].id} pisa a ${c[j].id}`);
  }
});

test('LA HOJA QUE SE CREA DESDE LA GALERÍA SALE IGUAL QUE SU MINIATURA: lleva ids nuevos, y no por eso otra composición', () => {
  const lugares = (cs: Array<{ x: number; y: number; w: number; h: number }>) => cs.map((c) => [c.x, c.y, c.w, c.h].join(','));
  for (const p of [...PLANTILLAS_HOJA, ...PLANTILLAS_GENERAL]) {
    const creada = instanciarPlantilla(p).componentes;
    assert.deepEqual(lugares(creada as never), lugares(componentesDe(p) as never), p.id);
    assert.equal(creada.some((c) => (c as { portada?: unknown }).portada), componentesDe(p).some((c) => (c as { portada?: unknown }).portada), `${p.id}: la creada sin su negro`);
  }
});

test('el negro nunca va a lo ancho: tampoco en una hoja guardada, y sin moverle nada', () => {
  const tema = sanearTema(null);
  assert.equal(pintaPortada({ w: 12 }, tema), false, 'la tapa de 12 × 11 de una hoja guardada va en vidrio');
  assert.equal(pintaPortada({ w: 4 }, tema), true);
  assert.equal(pintaPortada({ w: 12 }, sanearTema({ plantilla: 'vieja' })), true, 'con «Clásica» la tapa sigue, elegida');
  for (const a of ['app/dashboard/EditorInforme.tsx', 'app/dashboard/MiniaturaHoja.tsx']) assert.match(leer(a), /pintaPortada\(c, hoja\.tema\) \? marcoDePortada/, a);
  assert.match(leer('app/dashboard/Grafico.tsx'), /pintaPortada\(g, tema\) \? identidadEfectiva/);
});

test('EL RAYADO NO SE COPIA: acá significa «Estimado», y un número medido no se dibuja rayado', () => {
  assert.doesNotMatch(CSS_CORBEL, /repeating-linear-gradient/);
  assert.doesNotMatch(leer('lib/graficos-corbel.ts').replace(/^\/\/.*$/gm, ''), /--hatch/);
});

// ── La composición ──────────────────────────────────────────────────────────────────────

const pisa = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

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

test('lo que no entra en un tercio va a lo ancho, en vidrio y sin portada', () => {
  const hoja = { componentes: [{ id: 'a', clase: 'grafico', tipo: 'serie', x: 0, y: 0, w: 12, h: 8 }] };
  const out = comoCorbel(hoja, { nueva: () => ({ id: 'p', clase: 'grafico', tipo: 'tarjetas' }) }, 'coral', (l) => l).componentes as Array<Record<string, unknown>>;
  assert.equal(out[0].id, 'p');
  assert.equal(out[0].w, 12);
  assert.equal(out[0].portada, undefined);
});

test('las pantallas lo usan: el editor y la miniatura llevan la paleta y los tiles', () => {
  const e = leer('app/dashboard/EditorInforme.tsx');
  assert.match(e, /<div className=\{`lk lk-app[^`]*`\} onContextMenu=\{alClicDerecho\} data-paleta=\{paleta\}/);
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
  assert.match(leer('app/_chat/bloques/GraficoHilo.tsx'), /sanearTema\(\{ plantilla: 'vieja' \}\)/);
  assert.match(leer('app/crm/lead-view/ficha/armar.ts'), /const conTema = temaPropio\(t\);/);
  // Sin `data-paleta` (la ficha no la lleva), la tarjeta cae a los tokens de la casa y no queda transparente.
  const v = varsDeTema(sanearTema({ esquinas: 'rectas' }));
  assert.match(v['--dash-tarjeta-fondo'], /var\(--cb-glass, var\(--surface\)\)/);
  assert.match(v['--dash-tarjeta-sombra'], /var\(--cb-rim, transparent\)/);
  assert.match(seriesDeEscena('mono')[0], /^var\(--cb-c1, #121212\)$/);
});
