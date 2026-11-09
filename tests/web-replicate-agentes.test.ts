// =============================================================================
// Web Replicate: los varios mouse armando la réplica, atados a lo que de verdad pasa (Martín, 9/11/2026)
// =============================================================================
// Martín: «PARA WEB REPLICATE, COPIAR ESTO: [el reel] … Sobre todo la animación de los multiples mouse actuando». Lo que
// fija, EJECUTANDO el código (lib/editor-landing/replicar-escena.ts, app/_ui/enjambre.ts y las piezas dibujadas):
//   1. los doce del reel: nombres y colores distintos, y dos cajas vecinas nunca son del mismo;
//   2. la escena sale SÓLO de los eventos: sin esquema no hay cajas, una caja se escribe sólo si su sección llegó Y se
//      reveló, el diseño y la reunión del final van después de verlo todo, y la falla se ve;
//   3. el tiempo: una caja no se escribe antes de terminar de trazarse, y cada estado lleva su etiqueta (la del reel);
//   4. los cursores: escondidos mientras lee, el dueño arrastra la esquina y sigue el tecleo, sin tarea no se salen del
//      escenario, y al final se juntan abajo;
//   5. el tirón: llega sin pasarse, y sin tarea el destino queda quieto durante la pausa y cambia en la siguiente;
//   6. el tecleo y la cámara; 7. el acento del diseño; 8. las piezas dibujadas (la barra, «Ver todo», sin movimiento).
// Correr: node --import tsx --test tests/web-replicate-agentes.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AGENTES, PAUSA_MIN_MS, PAUSA_RANGO_MS, RADIO_OCIO, acercar, duracionTecleo, letrasVisibles, puntoOcioso, type Rect,
} from '../app/_ui/enjambre';
import {
  ACENTO_REEL, ANCHO_PASTILLA, FINAL, PINTA_MS, TRAZO_MS, acentoDe, camaraDe, destinoDeAgente, duenoDeCaja, escenaDeReplica,
  estadoDeCaja, etiquetaDeCaja, inicioDeTrazo, letrasDeCaja, tiemposFinales, type Escena, type Tiempos,
} from '../lib/editor-landing/replicar-escena';
import type { EventoReplica } from '../lib/editor-landing/replicar-progreso';
import type { MoldeSeccion } from '../lib/editor-landing/replicar-estructura';
import { EscenarioReplica, textoDeEtapa } from '../app/web-generator/crear/EscenarioReplica';
import { ArmadoEnVivo } from '../app/_ui/ArmadoEnVivo';
import { CSS_CURSOR } from '../app/_ui/CursorAgente';

const ANCHO = 720;
const VISTA = { y: 0, alto: 380 };
const esquema = (titulos: string[]): EventoReplica => ({ fase: 'esquema', secciones: titulos });
const seccion = (indice: number, titulo: string, respaldo = false): EventoReplica => ({ fase: 'seccion', indice, titulo, ...(respaldo ? { respaldo } : {}) });
const finOk: EventoReplica = { fase: 'fin', respuesta: { ok: true, id: 7, titulo: 'x', secciones: 3, formato: 'landing' } };
const finMal: EventoReplica = { fase: 'fin', respuesta: { ok: false, error: 'x' } };
const TRES = [{ fase: 'leer' } as EventoReplica, esquema(['Portada', 'Precio', 'Cierre'])];
const tiemposVacios = (): Tiempos & { escritas: Map<number, number> } => ({ esquema: null, escritas: new Map(), diseno: null, lista: null });

test('1. los doce del reel: nombres y colores distintos, y dos cajas vecinas nunca son del mismo', () => {
  assert.equal(AGENTES.length, 12, '«12 agents live»');
  assert.equal(new Set(AGENTES.map((a) => a.nombre)).size, 12);
  assert.equal(new Set(AGENTES.map((a) => a.color.toLowerCase())).size, 12);
  for (const a of AGENTES) assert.match(a.color, /^#[0-9a-f]{6}$/i, a.nombre);
  for (let i = 0; i < 30; i++) assert.notEqual(duenoDeCaja(i), duenoDeCaja(i + 1), `cajas ${i} y ${i + 1}`);
  assert.equal(new Set(Array.from({ length: 12 }, (_, i) => duenoDeCaja(i))).size, 12, 'con doce cajas trabajan los doce');
});

test('2. la escena sale SÓLO de los eventos', () => {
  assert.equal(escenaDeReplica([], { visibles: 0, ancho: ANCHO }).etapa, 'arranque');
  const leyendo = escenaDeReplica([{ fase: 'leer' }], { visibles: 0, ancho: ANCHO });
  assert.equal(leyendo.etapa, 'arranque');
  assert.equal(leyendo.cajas.length, 0, 'sin esquema no se dibuja ninguna caja');

  const e = escenaDeReplica(TRES, { visibles: 0, ancho: ANCHO });
  assert.equal(e.etapa, 'secciones');
  assert.deepEqual(e.cajas.map((c) => c.titulo), ['Portada', 'Precio', 'Cierre'], 'los títulos reales del esquema');
  assert.equal(e.cajas.filter((c) => c.escrita).length, 0, 'ninguna escrita antes de que llegue su sección');
  for (const [k, c] of e.cajas.entries()) {
    assert.ok(c.rect.x >= 0 && c.rect.x + c.rect.w <= ANCHO, `la caja ${k} entra a lo ancho`);
    if (k) assert.ok(c.rect.y >= e.cajas[k - 1].rect.y + e.cajas[k - 1].rect.h, `la caja ${k} va debajo de la anterior, sin pisarla`);
  }
  assert.ok(e.alto >= e.cajas[2].rect.y + e.cajas[2].rect.h, 'la página tiene alto para todas');

  // Llegan fuera de orden (las tandas de la IA vuelven así): se escribe la que se reveló, con su título del evento.
  const llegadas = [...TRES, seccion(2, 'Cierre final'), seccion(0, 'Portada')];
  const una = escenaDeReplica(llegadas, { visibles: 1, ancho: ANCHO });
  assert.deepEqual(una.cajas.map((c) => c.escrita), [false, false, true], 'sólo la primera revelada (la 2)');
  assert.equal(una.cajas[2].titulo, 'Cierre final', 'el título que trajo su sección');
  assert.equal(una.cajas[2].orden, 0);
  const muchas = escenaDeReplica(llegadas, { visibles: 99, ancho: ANCHO });
  assert.deepEqual(muchas.cajas.map((c) => c.escrita), [true, false, true], 'nunca una que no llegó, aunque se pidan de más');
  assert.equal(muchas.escritas, 2);

  // Repetida: no se cuenta dos veces.
  assert.equal(escenaDeReplica([...llegadas, seccion(2, 'otra vez')], { visibles: 99, ancho: ANCHO }).escritas, 2);

  // El diseño y la reunión, recién con todo a la vista.
  const todas = [...TRES, seccion(0, 'a'), seccion(1, 'b'), seccion(2, 'c'), { fase: 'diseno' } as EventoReplica];
  assert.equal(escenaDeReplica(todas, { visibles: 2, ancho: ANCHO }).etapa, 'secciones', 'el diseño espera a que se vea escribir todo');
  assert.equal(escenaDeReplica(todas, { visibles: 3, ancho: ANCHO }).etapa, 'diseno');
  assert.equal(escenaDeReplica([...todas, finOk], { visibles: 2, ancho: ANCHO }).etapa, 'secciones', 'lista, sólo con todo a la vista');
  assert.equal(escenaDeReplica([...todas, finOk], { visibles: 3, ancho: ANCHO }).etapa, 'lista');
  assert.equal(escenaDeReplica([...TRES, finMal], { visibles: 0, ancho: ANCHO }).etapa, 'fallo');
  assert.equal(escenaDeReplica([{ fase: 'leer' }, finMal], { visibles: 0, ancho: ANCHO }).etapa, 'fallo');

  // La forma de cada sección: de la lectura sólo si son las mismas secciones; si no, neutra (no se inventan botones).
  const molde = (subtitulos: number, botones: number): MoldeSeccion => ({ titulo: 't', subtitulos, parrafos: 1, vinetas: 0, botones, desplegables: 0, palabras: 5 });
  const conMoldes = escenaDeReplica(TRES, { visibles: 0, ancho: ANCHO, moldes: [molde(3, 1), molde(0, 0), molde(0, 2)] });
  assert.deepEqual(conMoldes.cajas.map((c) => [c.esqueleto.tarjetas, c.esqueleto.botones]), [[3, 1], [0, 0], [0, 2]]);
  assert.ok(conMoldes.cajas[0].rect.h > conMoldes.cajas[1].rect.h, 'la caja con tarjetas es más alta');
  const otrosMoldes = escenaDeReplica(TRES, { visibles: 0, ancho: ANCHO, moldes: [molde(3, 1)] });
  assert.ok(otrosMoldes.cajas.every((c) => c.esqueleto.botones === 0 && c.esqueleto.tarjetas === 0), 'si no son las mismas, neutras');
});

test('3. el tiempo: no se escribe antes de trazarse, y cada estado con su etiqueta (la del reel)', () => {
  const ev = [...TRES, seccion(0, 'Portada'), seccion(1, 'Precio', true)];
  const e = escenaDeReplica(ev, { visibles: 2, ancho: ANCHO });
  const t = tiemposVacios();
  assert.equal(estadoDeCaja(e.cajas[0], e, t, 5_000), 'oculta', 'sin la hora del esquema, nada');
  t.esquema = 1_000;
  t.escritas.set(0, 1_000); // se reveló en el mismo instante que llegó el esquema
  t.escritas.set(1, 1_000);
  const c0 = e.cajas[0];
  const c1 = e.cajas[1];
  assert.equal(estadoDeCaja(c1, e, t, 1_000), 'oculta', 'la segunda arranca su trazo después');
  assert.equal(estadoDeCaja(c0, e, t, 1_000), 'trazando');
  assert.equal(estadoDeCaja(c0, e, t, 1_000 + TRAZO_MS - 1), 'trazando', 'revelada, pero todavía trazándose: no se escribe');
  assert.equal(letrasDeCaja(c0, e, t, 1_000 + TRAZO_MS - 1), 0);
  assert.equal(etiquetaDeCaja(c0, e, t, 1_200), `${AGENTES[c0.dueno].nombre} · ${Math.round(c0.rect.w)} × ${Math.round(c0.rect.h)}`, 'el reel: «QA · 400 × 16»');
  const escribe = 1_000 + TRAZO_MS;
  assert.equal(estadoDeCaja(c0, e, t, escribe + 10), 'escribiendo');
  assert.equal(etiquetaDeCaja(c0, e, t, escribe + 10), `${AGENTES[c0.dueno].nombre} · escribiendo`);
  const fin1 = 1_000 + inicioDeTrazo(1, 3) + TRAZO_MS + 10;
  assert.equal(etiquetaDeCaja(c1, e, t, fin1), `${AGENTES[c1.dueno].nombre} · del esquema`, 'la que quedó con el texto del esquema lo dice');
  const escrita = escribe + duracionTecleo(c0.titulo);
  assert.equal(estadoDeCaja(c0, e, t, escrita), 'escrita');
  assert.equal(letrasDeCaja(c0, e, t, escrita), Array.from(c0.titulo).length);
  assert.equal(etiquetaDeCaja(c0, e, t, escrita), null, 'escrita, la etiqueta se va');
  // La tercera no llegó: queda trazada, sin letras, para siempre.
  assert.equal(estadoDeCaja(e.cajas[2], e, t, 99_999), 'trazada');
  assert.equal(letrasDeCaja(e.cajas[2], e, t, 99_999), 0);
  // El diseño, en la etapa del diseño.
  const conDiseno = escenaDeReplica([...ev, seccion(2, 'Cierre'), { fase: 'diseno' }], { visibles: 3, ancho: ANCHO });
  t.escritas.set(2, 1_000);
  t.diseno = 10_000;
  assert.equal(estadoDeCaja(conDiseno.cajas[0], conDiseno, t, 10_010), 'pintando');
  assert.match(etiquetaDeCaja(conDiseno.cajas[0], conDiseno, t, 10_010) ?? '', /^Colores · aplicando$/);
  assert.equal(estadoDeCaja(conDiseno.cajas[0], conDiseno, t, 10_000 + PINTA_MS), 'pintada');
  assert.equal(estadoDeCaja(conDiseno.cajas[0], e, t, 10_010), 'escrita', 'sin el evento del diseño no se pinta');
});

test('4. los cursores: escondidos al leer, el dueño trabaja su caja, nadie se sale y al final se juntan', () => {
  const arranque = escenaDeReplica([{ fase: 'leer' }], { visibles: 0, ancho: ANCHO });
  for (let i = 0; i < 12; i++) {
    const d = destinoDeAgente(i, arranque, tiemposVacios(), 1_000, VISTA, ANCHO);
    assert.equal(d.visible, false, 'mientras lee, en el anillo');
    assert.equal(d.accion, 'oculto');
  }
  const e = escenaDeReplica([...TRES, seccion(0, 'Software engineer & AI builder')], { visibles: 1, ancho: ANCHO });
  const t = tiemposVacios();
  t.esquema = 0;
  t.escritas.set(0, 0);
  const c0 = e.cajas[0];
  const a = destinoDeAgente(c0.dueno, e, t, TRAZO_MS * 0.3, VISTA, ANCHO);
  const b = destinoDeAgente(c0.dueno, e, t, TRAZO_MS * 0.8, VISTA, ANCHO);
  assert.equal(a.accion, 'trazar', 'el dueño arrastra la esquina de su caja');
  assert.ok(b.p.x > a.p.x && b.p.y > a.p.y, 'la esquina baja y se abre con el trazo');
  const tecleo = destinoDeAgente(c0.dueno, e, t, TRAZO_MS + 200, VISTA, ANCHO);
  assert.equal(tecleo.accion, 'escribir');
  assert.ok(tecleo.p.y > c0.rect.y && tecleo.p.y < c0.rect.y + c0.rect.h, 'escribe adentro de su caja');
  const masTarde = destinoDeAgente(c0.dueno, e, t, TRAZO_MS + 600, VISTA, ANCHO);
  assert.ok(masTarde.p.x >= tecleo.p.x, 'sigue a las letras');
  // Sin tarea, adentro del escenario y sin que la pastilla se salga por la derecha.
  for (let i = 0; i < 12; i++) for (const ahora of [3_000, 7_777, 15_000]) {
    const d = destinoDeAgente(i, e, t, ahora, VISTA, ANCHO);
    assert.ok(d.visible);
    assert.ok(d.p.x >= 0 && d.p.x <= ANCHO - ANCHO_PASTILLA + 6, `x de ${AGENTES[i].nombre}: ${d.p.x}`);
    assert.ok(d.p.y >= 0 && d.p.y <= Math.max(e.alto, VISTA.alto), `y de ${AGENTES[i].nombre}: ${d.p.y}`);
  }
  // Lista: se juntan abajo (el final del reel).
  const lista = escenaDeReplica([...TRES, seccion(0, 'a'), seccion(1, 'b'), seccion(2, 'c'), { fase: 'diseno' }, finOk], { visibles: 3, ancho: ANCHO });
  const tl = { esquema: 0, escritas: new Map([[0, 0], [1, 0], [2, 0]]), diseno: 0, lista: 0 };
  const juntos = Array.from({ length: 12 }, (_, i) => destinoDeAgente(i, lista, tl, 60_000, VISTA, ANCHO));
  assert.ok(juntos.every((d) => d.accion === 'reunirse'));
  const xs = juntos.map((d) => d.p.x);
  const ys = juntos.map((d) => d.p.y);
  assert.ok(Math.max(...xs) - Math.min(...xs) < ANCHO * 0.6, 'juntos, no repartidos por todo el escenario');
  // Juntos pero sin pisarse, también en un teléfono (el escenario mide ~358 px de ancho y 320 de alto).
  for (const [ancho, alto] of [[ANCHO, VISTA.alto], [358, 320]]) {
    const listaAncho = escenaDeReplica([...TRES, seccion(0, 'a'), seccion(1, 'b'), seccion(2, 'c'), finOk], { visibles: 3, ancho });
    const ps = Array.from({ length: 12 }, (_, i) => destinoDeAgente(i, listaAncho, tl, 60_000, { y: 0, alto }, ancho).p);
    for (let a = 0; a < 12; a++) {
      assert.ok(ps[a].x >= 0 && ps[a].x <= ancho - ANCHO_PASTILLA + 6 && ps[a].y < alto - 50, `${AGENTES[a].nombre} adentro y sobre la barra (${ancho})`);
      for (let b = a + 1; b < 12; b++) {
        const pisa = Math.abs(ps[a].x - ps[b].x) < 80 && Math.abs(ps[a].y - ps[b].y) < 18;
        assert.ok(!pisa, `juntos pero sin pisarse a ${ancho} px: ${AGENTES[a].nombre} y ${AGENTES[b].nombre}`);
      }
    }
  }
  assert.ok(Math.min(...ys) > VISTA.alto * 0.45, 'abajo, al lado de la barra');
  // La falla: quietos.
  const fallo = escenaDeReplica([...TRES, finMal], { visibles: 0, ancho: ANCHO });
  assert.deepEqual(destinoDeAgente(4, fallo, t, 1_000, VISTA, ANCHO), destinoDeAgente(4, fallo, t, 9_000, VISTA, ANCHO), 'con la falla no se mueven');
  assert.equal(destinoDeAgente(4, fallo, t, 1_000, VISTA, ANCHO).accion, 'quieto');
});

test('5. el tirón: llega sin pasarse, y sin tarea se queda quieto en la pausa y salta en la siguiente', () => {
  let p = { x: 0, y: 0 };
  const destino = { x: 100, y: -40 };
  let previa = 0;
  for (let k = 0; k < 40; k++) {
    p = acercar(p, destino, 16);
    assert.ok(p.x <= destino.x && p.y >= destino.y, 'nunca se pasa');
    assert.ok(p.x >= previa, 'siempre avanza');
    previa = p.x;
  }
  assert.ok(Math.abs(p.x - 100) < 0.5 && Math.abs(p.y + 40) < 0.5, 'llega');
  const tramo1 = acercar({ x: 0, y: 0 }, { x: 100, y: 0 }, 16).x;
  const tramo2 = acercar({ x: tramo1, y: 0 }, { x: 100, y: 0 }, 16).x - tramo1;
  assert.ok(tramo1 > tramo2, 'rápido al salir, frena al llegar (ease-out)');
  assert.deepEqual(acercar({ x: 3, y: 4 }, { x: 9, y: 9 }, 0), { x: 3, y: 4 }, 'sin tiempo no se mueve');
  for (const dt of [16, 64, 400, 5_000]) {
    const q = acercar({ x: 0, y: 0 }, { x: 100, y: 50 }, dt);
    assert.ok(q.x <= 100 && q.y <= 50, `ni en un cuadro largo se pasa (${dt} ms: ${q.x.toFixed(1)})`);
  }

  const zona: Rect = { x: 0, y: 0, w: 600, h: 300 };
  let cambios = 0;
  let previo = puntoOcioso(5, 0, zona);
  const pasos = 200;
  for (let k = 1; k <= pasos; k++) {
    const q = puntoOcioso(5, k * 50, zona);
    if (q.x !== previo.x || q.y !== previo.y) cambios++;
    assert.ok(q.x >= zona.x && q.x <= zona.x + zona.w && q.y >= zona.y && q.y <= zona.y + zona.h, 'adentro de la zona');
    previo = q;
  }
  const maxCambios = (pasos * 50) / PAUSA_MIN_MS;
  const minCambios = (pasos * 50) / (PAUSA_MIN_MS + PAUSA_RANGO_MS) - 1;
  assert.ok(cambios <= maxCambios + 1 && cambios >= minCambios, `un salto por pausa (${cambios} en 10 s)`);
  assert.deepEqual(puntoOcioso(5, 1234, zona), puntoOcioso(5, 1234, zona), 'determinista');
  // Sin tarea se reparten por lo que se ve (cada uno su lugar), no se amontonan en un rincón.
  for (const ahora of [0, 4_321, 17_000]) {
    const xs = Array.from({ length: 12 }, (_, i) => puntoOcioso(i, ahora, zona).x);
    assert.ok(Math.max(...xs) - Math.min(...xs) > zona.w * 0.6, `repartidos a lo ancho (${Math.round(Math.max(...xs) - Math.min(...xs))} px)`);
  }
  // El salto es corto (alrededor de su lugar), no de punta a punta.
  const saltos: number[] = [];
  for (let k = 0; k < 60; k++) {
    const a = puntoOcioso(3, k * 3_000, zona);
    const b = puntoOcioso(3, k * 3_000 + 1_600, zona);
    saltos.push(Math.hypot(a.x - b.x, a.y - b.y));
  }
  assert.ok(Math.max(...saltos) <= RADIO_OCIO * 2 * Math.SQRT2 + 1, `salta corto (${Math.round(Math.max(...saltos))} px)`);
});

test('6. el tecleo y la cámara', () => {
  assert.equal(letrasVisibles('Hola', 0), 0);
  assert.equal(letrasVisibles('Hola', duracionTecleo('Hola')), 4);
  let previa = 0;
  for (let ms = 0; ms <= 2_000; ms += 37) {
    const n = letrasVisibles('Software engineer & AI builder', ms);
    assert.ok(n >= previa, 'nunca borra lo escrito');
    previa = n;
  }
  assert.ok(duracionTecleo('x'.repeat(500)) <= 1_400, 'un título largo no tarda minutos');
  assert.equal(letrasVisibles('ok 🚀', duracionTecleo('ok 🚀')), 4, 'un emoji es una letra, no se parte');

  const titulos = Array.from({ length: 12 }, (_, i) => `Sección ${i + 1}`);
  const soloEsquema: Escena = escenaDeReplica([{ fase: 'leer' }, esquema(titulos)], { visibles: 0, ancho: ANCHO });
  const t0 = { ...tiemposVacios(), esquema: 0 };
  assert.equal(camaraDe(escenaDeReplica([{ fase: 'leer' }], { visibles: 0, ancho: ANCHO }), t0, 5_000, VISTA.alto), 0);
  assert.equal(camaraDe(soloEsquema, t0, 10_000, VISTA.alto), 0, 'los trazos no mueven la cámara: sin nada escrito, arriba');
  // Se escriben de a una, cada medio segundo: la página baja siguiendo lo que se escribe.
  const e = escenaDeReplica([{ fase: 'leer' }, esquema(titulos), ...titulos.map((x, i) => seccion(i, x))], { visibles: 12, ancho: ANCHO });
  const t = { ...tiemposVacios(), esquema: 0 };
  titulos.forEach((_, i) => t.escritas.set(i, 3_000 + i * 500));
  const temprano = camaraDe(e, t, 10, VISTA.alto);
  const medio = camaraDe(e, t, 3_000 + 5 * 500 + 50, VISTA.alto);
  const tarde = camaraDe(e, t, 30_000, VISTA.alto);
  assert.equal(temprano, 0, 'arranca arriba');
  assert.ok(medio > 0 && medio < tarde, `la página baja siguiendo lo que se escribe (${Math.round(medio)} → ${Math.round(tarde)})`);
  assert.ok(e.cajas[5].rect.y >= medio && e.cajas[5].rect.y <= medio + VISTA.alto, 'la que se escribe queda a la vista');
  assert.ok(tarde <= e.alto - VISTA.alto, 'sin pasarse del final');
  // Lo que se ESCRIBE manda: arriba se escribe la primera mientras abajo se trazan las últimas (la copia idéntica: todo
  // llega junto). La cámara se queda en lo que se escribe, no se va con los trazos.
  const largo = 'Software engineer & AI builder';
  const juntas = escenaDeReplica([{ fase: 'leer' }, esquema(titulos.map((x, i) => (i === 0 ? largo : x))), seccion(0, largo)], { visibles: 1, ancho: ANCHO });
  const tj = { ...tiemposVacios(), esquema: 0 };
  tj.escritas.set(0, 0);
  const ahora = TRAZO_MS + 300;
  assert.equal(estadoDeCaja(juntas.cajas[0], juntas, tj, ahora), 'escribiendo');
  assert.ok(juntas.cajas.some((c) => estadoDeCaja(c, juntas, tj, ahora) === 'trazando' && c.rect.y > VISTA.alto), 'abajo se sigue trazando');
  assert.equal(camaraDe(juntas, tj, ahora, VISTA.alto), 0, 'la cámara mira la caja que se escribe');
});

test('7. el acento del diseño: el color más vivo de la original, nunca un gris', () => {
  assert.equal(acentoDe(['#ffffff', '#111111', '#e8501f', '#2f6fd6']), '#E8501F');
  assert.equal(acentoDe(['#fff', '#0a0a0a', '#888888']), ACENTO_REEL, 'sin un color vivo, el naranja del reel');
  assert.equal(acentoDe(null), ACENTO_REEL);
  assert.equal(acentoDe(['rojo', '#f06']), '#FF0066', 'el #rgb también vale');
});

test('8. las piezas dibujadas: los doce con su nombre, la barra con la fase real y «Ver todo» sólo si hay algo que mostrar', () => {
  const ev = [...TRES, seccion(0, 'Portada'), seccion(1, 'Precio')];
  const html = renderToStaticMarkup(createElement(EscenarioReplica, { eventos: ev, visibles: 1, llegadas: 2, saltear: () => {} }));
  for (const a of AGENTES) assert.ok(html.includes(`data-agente="${a.id}"`) && html.includes(`${a.nombre}</span>`), `el cursor de ${a.nombre}`);
  assert.equal((html.match(/class="wr-caja"/g) ?? []).length, 3, 'una caja por sección del esquema');
  assert.match(html, /MaKo en vivo/);
  assert.match(html, /Escribiendo · 1 de 3/, 'la fase real, con lo revelado');
  assert.match(html, /<button type="button" class="wr-ver-todo">Ver todo<\/button>/);
  assert.match(html, /class="wr-lienzo" aria-hidden="true"/, 'lo que se mueve no lo lee un lector de pantalla');
  const lienzo = html.indexOf('class="wr-lienzo"');
  const boton = html.indexOf('class="wr-ver-todo"');
  const barra = html.indexOf('class="wr-barra"');
  assert.ok(barra > lienzo && boton > barra, 'el botón va en la barra, fuera de lo escondido');
  assert.match(html, /prefers-reduced-motion: reduce/, 'el escenario se queda quieto con «reducir movimiento»');
  const todo = renderToStaticMarkup(createElement(EscenarioReplica, { eventos: ev, visibles: 2, llegadas: 2, saltear: () => {} }));
  assert.doesNotMatch(todo, /<button[^>]*wr-ver-todo/, 'con todo a la vista no hay nada que saltear');
  const leyendo = renderToStaticMarkup(createElement(EscenarioReplica, { eventos: [{ fase: 'leer' }], visibles: 0, llegadas: 0, saltear: () => {} }));
  assert.match(leyendo, /Leyendo la página/, 'el anillo del arranque');
  assert.equal((leyendo.match(/class="wr-caja"/g) ?? []).length, 0);
  assert.equal(textoDeEtapa(escenaDeReplica([...TRES, finMal], { visibles: 0, ancho: ANCHO })), 'Se detuvo');
  assert.match(CSS_CURSOR, /@media \(prefers-reduced-motion: reduce\)/);

  // ArmadoEnVivo con escenario: el escenario recibe la MISMA cuenta y reemplaza a la lista y a su «Ver todo».
  let recibido: { visibles: number; llegadas: number } | null = null;
  const piezas = [{ id: 's0', texto: 'Portada' }, { id: 's1', texto: 'Precio' }];
  const armado = renderToStaticMarkup(createElement(ArmadoEnVivo, {
    titulo: 'Replicando', fases: [], piezas, total: 3, unidad: 'secciones',
    escena: (r) => { recibido = { visibles: r.visibles, llegadas: r.llegadas }; return createElement('div', { id: 'el-escenario' }); },
  }));
  assert.match(armado, /id="el-escenario"/);
  assert.deepEqual(recibido, { visibles: 0, llegadas: 2 });
  assert.doesNotMatch(armado, /class="(ae-piezas|ae-saltear|ae-puntos)"/, 'con escenario no se repite la lista');
  const sinEscena = renderToStaticMarkup(createElement(ArmadoEnVivo, { titulo: 'Replicando', fases: [], piezas, total: 3, unidad: 'secciones' }));
  assert.match(sinEscena, /class="ae-saltear"/, 'sin escenario, la pieza de siempre');
});

test('9. sin movimiento: cada caja en su estado final y cada cursor en su lugar, sin animar', () => {
  const lista = escenaDeReplica([...TRES, seccion(0, 'Portada'), seccion(1, 'Precio'), seccion(2, 'Cierre'), { fase: 'diseno' }, finOk], { visibles: 3, ancho: ANCHO });
  const t = tiemposFinales(lista);
  assert.deepEqual(lista.cajas.map((c) => estadoDeCaja(c, lista, t, FINAL)), ['pintada', 'pintada', 'pintada']);
  assert.deepEqual(lista.cajas.map((c) => letrasDeCaja(c, lista, t, FINAL)), [7, 6, 6], 'los títulos enteros');
  assert.ok(lista.cajas.every((c) => etiquetaDeCaja(c, lista, t, FINAL) === null));
  const mitad = escenaDeReplica([...TRES, seccion(0, 'Portada')], { visibles: 1, ancho: ANCHO });
  const tm = tiemposFinales(mitad);
  assert.deepEqual(mitad.cajas.map((c) => estadoDeCaja(c, mitad, tm, FINAL)), ['escrita', 'trazada', 'trazada'], 'lo que no llegó, sin escribir');
  const d = destinoDeAgente(0, lista, t, FINAL, VISTA, ANCHO);
  assert.ok(Number.isFinite(d.p.x) && Number.isFinite(d.p.y), 'un lugar de verdad, no NaN');
});

test('10. el enchufe: Replicar dibuja el escenario con los eventos, la lectura y la cadencia de ArmadoEnVivo', () => {
  const src = readFileSync(join(__dirname, '..', 'app/web-generator/crear/Replicar.tsx'), 'utf8').replace(/\r\n/g, '\n');
  // Hay dos armados (9/11/2026): el de la página leída y el de una foto de la extensión sin lectura (una página casi sin
  // texto). Los dos dibujan el escenario con los eventos y la cadencia; el de la leída, además, con sus moldes.
  const bloques = [...src.matchAll(/<ArmadoEnVivo[\s\S]*?\n\s*\/>/g)].map((m) => m[0]);
  assert.ok(bloques.length >= 1 && bloques.every((b) => b.length > 100 && b.length < 2_000), `los bloques de ArmadoEnVivo (${bloques.map((b) => b.length)})`);
  for (const bloque of bloques) {
    assert.match(bloque, /escena=\{\(\{ visibles, llegadas, saltear \}\) => \(?/);
    assert.match(bloque, /<EscenarioReplica\s+eventos=\{eventos\}\s+visibles=\{visibles\}\s+llegadas=\{llegadas\}\s+saltear=\{saltear\}/);
  }
  assert.ok(bloques.some((b) => /moldes=\{lectura\.lectura\.secciones\}/.test(b)), 'el de la página leída lleva sus moldes');
});
