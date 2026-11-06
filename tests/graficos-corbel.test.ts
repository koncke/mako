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
import { PLANTILLAS_GENERAL, PORTADAS_GENERAL } from '../lib/general-plantillas';
import { fuenteDe, sanearHoja } from '../lib/graficos-catalogo';
import { componentesDe, instanciarPlantilla, PLANTILLAS_HOJA } from '../lib/graficos-plantillas';
import { comoDenso, portadasDashboard, MOLDES, ALTO_MEDIANO, ALTO_NUMEROS, ALTO_PROTAGONISTA, ALTO_FRASE } from '../lib/graficos-portadas';
import { sinBloquesDeDiseno } from '../lib/disenos-partes';

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
  // De a 2 × 2 (1/11/2026): la cuenta sigue en la fila de abajo, y los cuatro salen distintos.
  const d = tilesDeHoja([n('a', 6, 0), n('b', 9, 0), n('c', 6, 4), n('e', 9, 4)]);
  assert.deepEqual(['a', 'b', 'c', 'e'].map((x) => d.get(x)), ['sky', 'mint', 'lemon', 'coral']);
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
  assert.ok(PLANTILLAS_GENERAL.length >= 5);
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

test('Focus: la frase del día, cuatro números bajos y los OKR a lo ancho, que son filas largas', () => {
  const p = PLANTILLAS_GENERAL.find((x) => x.id === 'foco')!;
  const h = sanearHoja({ ...p.armar((l: string) => l), plantilla: p.id }, 0)!;
  // Sus piezas, sin los bloques de su diseño (6/11/2026: la hoja nace con las tarjetas de Focus arriba, lib/disenos-partes.ts).
  const c = sinBloquesDeDiseno(h.componentes) as Array<Record<string, any>>;
  // 4/11/2026 (Pane · Lumora): abre con lo que te queda hoy, y debajo lo de siempre.
  const frase = c.find((x) => x.tipo === 'frase')!;
  assert.deepEqual([frase.x, frase.y, frase.w, frase.h], [0, 0, 12, ALTO_FRASE]);
  const numeros = c.filter((x) => String(x.tipo).startsWith('numero')).sort((a, b) => a.y - b.y || a.x - b.x);
  assert.deepEqual(numeros.map((x) => [x.x, x.y, x.w, x.h]), [[0, 3, 6, 3], [6, 3, 6, 3], [0, 6, 6, 3], [6, 6, 6, 3]]);
  const okr = c.find((x) => x.general?.pieza === 'objetivos')!;
  assert.deepEqual([okr.x, okr.y, okr.w], [0, 9, 12]);
  assert.equal(okr.texto, 'Cómo vas con tus OKRs');
  assert.equal(okr.general.opciones.estilo, 'barras', 'con anillos, «Facturar $30,000 e…» se corta');
  assert.deepEqual(c.find((x) => x.general?.pieza === 'deadlines')!.general.opciones, { dias: '7', que: 'tareas' });
});

const PLANTILLAS_TODAS = [...PLANTILLAS_HOJA, ...PLANTILLAS_GENERAL];
/**
 * Las piezas de una plantilla como se escribieron. Una hoja con diseño copiado nace en BLOQUES (6/11/2026, lib/disenos-partes.ts):
 * arriba las tarjetas de su diseño y, plegadas en «Todas las piezas», estas piezas. Lo que se mide acá es la estructura de las
 * piezas (la que se ve en una hoja sin diseño, y en la de un diseño al abrir «Todas las piezas»).
 */
const piezasDe = (p: (typeof PLANTILLAS_TODAS)[number]) => sinBloquesDeDiseno(componentesDe(p));
const MEDIDO_DENSO = () => JSON.parse(leer('docs/diseno/densidad-codeandchill.json'));
/** La forma de una hoja: sus filas, con los anchos. */
const formaDe = (c: Array<Record<string, any>>) => [...new Set(c.map((x) => x.y))].sort((a, b) => a - b).map((y) => c.filter((x) => x.y === y).sort((a, b) => a.x - b.x).map((x) => x.w).join('+')).join(' / ');

test('CADA PLANTILLA TIENE SU ESTRUCTURA: la asignación escrita es la que se usa, con su porqué, y ninguna forma domina', () => {
  const m = MEDIDO_DENSO();
  const portadas = portadasDashboard() as Record<string, { molde?: string }>;
  // Una plantilla armada con TARJETAS de diseños copiados (6/11/2026, «Velocidad de llamada»: lib/graficos-plantillas.ts) no tiene
  // molde ni portada: su lugar es el de sus tarjetas. Las demás, sí.
  const deTarjetas = (p: (typeof PLANTILLAS_HOJA)[number]) => (p.armar((l) => l) as { componentes: Array<{ tipo?: string }> }).componentes.some((c) => c.tipo === 'diseno');
  assert.deepEqual(PLANTILLAS_HOJA.filter(deTarjetas).map((p) => p.id), ['velocidad-llamada']);
  for (const p of PLANTILLAS_HOJA.filter((x) => !deTarjetas(x))) {
    const [molde, porque] = m.asignacion.dashboard[p.id];
    assert.equal(portadas[p.id]?.molde, molde, p.id);
    assert.ok(porque.length > 20, `${p.id}: sin porqué`);
  }
  for (const p of PLANTILLAS_GENERAL) {
    const [molde, porque] = m.asignacion.general[p.id];
    assert.equal((PORTADAS_GENERAL[p.id] as { molde?: string }).molde, molde, p.id);
    assert.ok(porque.length > 20, `${p.id}: sin porqué`);
  }
  const usos = new Map<string, number>();
  for (const [molde] of [...Object.values(m.asignacion.dashboard), ...Object.values(m.asignacion.general)].filter(Array.isArray) as string[][]) usos.set(molde, (usos.get(molde) ?? 0) + 1);
  assert.deepEqual([...usos.keys()].sort(), Object.keys(MOLDES).sort(), 'cada molde se usa, y no hay uno que no exista');
  assert.ok(Math.max(...usos.values()) <= 4, `una estructura domina: ${[...usos]}`);
  // Y se ve: lo que abre cada hoja no es siempre lo mismo.
  // La frase de apertura (4/11/2026) es una línea a lo ancho que abre casi todas: la estructura empieza DEBAJO de ella.
  const sinFrase = (c: Array<Record<string, any>>) => c.filter((x) => x.tipo !== 'frase');
  const aperturas = new Set(PLANTILLAS_TODAS.map((p) => formaDe(sinFrase(piezasDe(p) as never)).split(' / ')[0]));
  assert.ok(aperturas.size >= 4, `abren igual: ${[...aperturas]}`);
  const formas = new Set(PLANTILLAS_TODAS.map((p) => formaDe(piezasDe(p) as never)));
  assert.ok(formas.size >= 8, `${formas.size} formas distintas en ${PLANTILLAS_TODAS.length} plantillas`);
});

test('LO MEDIDO A 1440: sin losa, sin títulos sueltos, densas, y cada fila llena las 12 columnas', () => {
  const m = MEDIDO_DENSO();
  assert.deepEqual(['wharf', 'ledge', 'prism'].map((d) => m.demos[d].paneles), [9, 10, 11]);
  // 30 h + 16 (h - 1): lo que mide en la grilla es lo que se midió en la demo.
  const px = (h: number) => 30 * h + 16 * (h - 1);
  assert.equal(px(ALTO_NUMEROS), 168);
  assert.equal(px(ALTO_PROTAGONISTA), 352);
  assert.equal(px(ALTO_MEDIANO), 306, 'los 306 de las tres iguales de Wharf');
  for (const p of PLANTILLAS_TODAS) {
    const c = piezasDe(p) as unknown as Array<Record<string, any>>;
    assert.ok(!c.some((x) => x.portada), `${p.id}: volvió la losa`);
    assert.ok(!c.some((x) => x.tipo === 'seccion'), `${p.id}: en la referencia el título vive en la tarjeta`);
    // La oración de apertura (tipo «frase», 4/11/2026) SÍ va a lo ancho y primera: es una línea de texto sin marco, no la losa que
    // Martín rechazó. Nunca más alta que ALTO_FRASE, y nunca más de una.
    assert.ok(!c.some((x) => x.y === 0 && x.w === 12 && x.tipo !== 'frase'), `${p.id}: abre con algo a lo ancho`);
    const frases = c.filter((x) => x.tipo === 'frase');
    assert.ok(frases.length <= 1 && frases.every((x) => x.y === 0 && x.h <= ALTO_FRASE), `${p.id}: la frase abre la hoja y es una línea`);
    assert.ok(c.length >= 8 && c.length <= 14, `${p.id}: ${c.length} paneles`);
    // Sin huecos: cada columna, de arriba abajo, está ocupada hasta donde termina la hoja de paneles.
    const hasta = Math.max(...c.filter((x) => x.tipo !== 'accion').map((x) => x.y + x.h));
    for (let col = 0; col < 12; col++) for (let fila = 0; fila < hasta; fila++) {
      assert.ok(c.some((x) => x.x <= col && col < x.x + x.w && x.y <= fila && fila < x.y + x.h), `${p.id}: hueco en la columna ${col}, fila ${fila}: ${formaDe(c)}`);
    }
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
      { id: 'sec', clase: 'elemento', tipo: 'seccion', x: 0, y: 20, w: 12, h: 1 },
    ],
  };
  const out = comoDenso(hoja, { sube: 'hero' }, (l) => l).componentes as Array<Record<string, unknown>>;
  const de = (id: string) => out.find((c) => c.id === id)!;
  assert.deepEqual([de('serie').x, de('serie').y, de('serie').w, de('serie').h], [0, 0, 6, ALTO_PROTAGONISTA], 'el principal es el gráfico en el tiempo, no la tabla');
  assert.deepEqual([de('n2').x, de('n2').y], [6, 0], 'la invertida abre, que es donde va el negro');
  assert.equal(de('hero').portada, undefined, 'no vuelve la losa');
  assert.ok((de('tabla').y as number) >= ALTO_PROTAGONISTA);
  assert.equal(de('sec'), undefined, 'los títulos de sección no van');
});

test('lo que necesita el ancho va a lo ancho, y lo que sobra de a uno va al lado de la primera tabla', () => {
  const hoja = {
    componentes: [
      { id: 'a', clase: 'grafico', tipo: 'serie', x: 0, y: 0, w: 12, h: 8 },
      { id: 'b', clase: 'grafico', tipo: 'barras', x: 0, y: 8, w: 12, h: 8 },
      { id: 't', clase: 'grafico', tipo: 'tabla', x: 0, y: 16, w: 12, h: 8 },
      { id: 'm', clase: 'grafico', tipo: 'mapa_calor', x: 0, y: 24, w: 12, h: 24 },
    ],
  };
  const out = comoDenso(hoja, { sube: 'a', molde: 'ledge' }, (l) => l).componentes as Array<Record<string, any>>;
  const de = (id: string) => out.find((c) => c.id === id)!;
  assert.deepEqual([de('t').x, de('t').w, de('b').x, de('b').w, de('t').y === de('b').y], [0, 8, 8, 4, true]);
  assert.deepEqual([de('m').w, de('m').h], [12, 24], 'el mapa de calor conserva su alto');
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
