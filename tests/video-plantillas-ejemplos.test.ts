// =============================================================================
// Plantillas de anuncio: el ejemplo de cada una («Ver ejemplo») y la plantilla dibujada con él
// =============================================================================
// Plan: docs/plantillas-reales/video.md (2.0–2.11 y la tanda 1, sección 5). El módulo: lib/editor-video/plantillas-ejemplos.ts.
//   1  qué plantillas tienen ejemplo: las cinco de hoy que el doc conserva; las dos variantes retiradas, no.
//   2  los textos son EXACTAMENTE los huecos de texto de su plantilla (huecosDe), ni uno de más ni de menos.
//   3  cada texto entra en su tope, en ≤ 5 palabras (doc 2.0), y va en mayúsculas sí y sólo si su pieza las dibuja (la
//      regla del test 9 de tests/video-editor-plantillas.test.ts, de los dos lados).
//   4  plantillaConEjemplo: copia, sólo cambia `muestra` (todas las piezas de un hueco), no toca el catálogo.
//   5  dibujada con el ejemplo, la plantilla sigue en la zona segura de Meta y sin textos que se pisen (cajaDeTexto).
//   6  el guion: pegado desde 0 hasta el final del clip que se graba; sin voz, el anuncio lo cuenta.
//   7  ningún texto nombra a un real, ni tiene voseo ni regionalismos (problemasDelEjemplo).
//   8  la insignia de la tarjeta, y el módulo puro (sólo tipos de ./plantillas, sin server-only ni el motor).
//
// Probado rompiéndolo (06/11/2026): el resultado de cada rotura está al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cajaDeTexto, huecosDe, LIENZO_REF, largoTexto, PLANTILLAS, plantillaPorId, ZONA_SEGURA,
  type PiezaTexto, type Plantilla,
} from '../lib/editor-video/plantillas';
import {
  EJEMPLOS_VIDEO, ejemploDeVideo, insigniaDeVideo, OBJETIVOS_VIDEO, plantillaConEjemplo, type EjemploVideo,
} from '../lib/editor-video/plantillas-ejemplos';
import { problemasDelEjemplo } from './_reales';

const porId = (id: string) => plantillaPorId(id) as Plantilla;
const CON_EJEMPLO = ['gancho', 'testimonio', 'antes-despues', 'beneficios', 'oferta'];
const RETIRADAS = ['gancho-escrito', 'oferta-glitch'];
const conEjemplo = () => CON_EJEMPLO.map((id) => ({ p: porId(id), e: ejemploDeVideo(id) as EjemploVideo }));
const textos = (p: Plantilla) => p.piezas.filter((x): x is PiezaTexto => x.tipo === 'texto');
const piezasDe = (p: Plantilla, hueco: string) => textos(p).filter((x) => x.hueco?.nombre === hueco);

test('1: tienen ejemplo las cinco de hoy que el doc conserva; las retiradas y lo que no es un id, no', () => {
  assert.deepEqual(Object.keys(EJEMPLOS_VIDEO).sort(), [...CON_EJEMPLO].sort());
  // Todas las del catálogo están en una de las dos listas: una plantilla nueva tiene que decidir.
  assert.deepEqual(PLANTILLAS.map((p) => p.id).sort(), [...CON_EJEMPLO, ...RETIRADAS].sort());
  for (const id of CON_EJEMPLO) {
    assert.ok(plantillaPorId(id), id);
    assert.equal(ejemploDeVideo(id), EJEMPLOS_VIDEO[id]);
    assert.ok((OBJETIVOS_VIDEO as readonly string[]).includes(ejemploDeVideo(id)?.objetivo ?? ''), `${id}: objetivo`);
  }
  for (const id of [...RETIRADAS, 'no-existe', 'constructor', 'toString', '__proto__']) assert.equal(ejemploDeVideo(id), null, id);
  // El objetivo de cada una, como la tabla de 2.0 (beneficios es «Vender una llamada (retargeting)»).
  assert.deepEqual(Object.fromEntries(CON_EJEMPLO.map((id) => [id, ejemploDeVideo(id)?.objetivo])), {
    gancho: 'Vender una llamada', testimonio: 'Prueba social', 'antes-despues': 'Propiedad',
    beneficios: 'Vender una llamada', oferta: 'Evento',
  });
});

test('2: los textos son exactamente los huecos de texto de su plantilla', () => {
  for (const { p, e } of conEjemplo()) {
    const huecos = huecosDe(p).filter((h) => h.tipo === 'texto').map((h) => h.nombre).sort();
    assert.deepEqual(Object.keys(e.textos).sort(), huecos, p.id);
  }
});

test('3: cada texto en su tope y en ≤ 5 palabras; en mayúsculas sí y sólo si su pieza las dibuja', () => {
  for (const { p, e } of conEjemplo()) {
    const huecos = new Map(huecosDe(p).map((h) => [h.nombre, h]));
    for (const [nombre, texto] of Object.entries(e.textos)) {
      const donde = `${p.id} · ${nombre} «${texto}»`;
      assert.equal(texto, texto.trim(), `${donde}: espacios en los bordes`);
      assert.ok(texto.length > 0, `${donde}: vacío`);
      assert.ok(largoTexto(texto) <= (huecos.get(nombre)?.maxCaracteres ?? 0), `${donde}: no entra en ${huecos.get(nombre)?.maxCaracteres}`);
      assert.ok(texto.split(/\s+/).length <= 5, `${donde}: más de 5 palabras`);
      const enMayusculas = texto === texto.toUpperCase();
      const conLetras = /\p{L}/u.test(texto);
      for (const x of piezasDe(p, nombre)) {
        if (x.estilo.mayusculas) assert.ok(enMayusculas, `${donde}: la pieza dibuja mayúsculas`);
        else if (conLetras) assert.ok(!enMayusculas, `${donde}: en mayúsculas sin «May./min.» (test 9 del catálogo)`);
      }
    }
  }
});

test('4: plantillaConEjemplo copia, cambia sólo `muestra` (todas las piezas del hueco) y no toca el catálogo', () => {
  const antes = JSON.stringify(PLANTILLAS);
  const sinMuestra = (x: object) => ({ ...x, muestra: undefined });
  for (const { p, e } of conEjemplo()) {
    const q = plantillaConEjemplo(p);
    assert.notEqual(q, p, p.id);
    assert.notEqual(q.piezas, p.piezas, p.id);
    assert.deepEqual({ ...q, piezas: [] }, { ...p, piezas: [] }, `${p.id}: cambió algo fuera de las piezas`);
    assert.equal(q.piezas.length, p.piezas.length, p.id);
    p.piezas.forEach((x, i) => {
      const y = q.piezas[i];
      assert.deepEqual(sinMuestra(y), sinMuestra(x), `${p.id} · pieza ${i}: cambió algo que no es la muestra`);
      if (x.tipo !== 'texto' || y.tipo !== 'texto') return;
      // Con hueco, el texto del ejemplo; sin hueco (la cuenta regresiva), la de siempre.
      assert.equal(y.muestra, x.hueco ? e.textos[x.hueco.nombre] : x.muestra, `${p.id} · pieza ${i}`);
    });
    // Lo que lee la API y la miniatura: la muestra de cada hueco es la del ejemplo.
    for (const h of huecosDe(q)) if (h.tipo === 'texto') assert.equal(h.muestra, e.textos[h.nombre], `${p.id} · ${h.nombre}`);
    // Pasarle el ejemplo a mano da lo mismo; sin ejemplo, una copia igual.
    assert.deepEqual(plantillaConEjemplo(p, e), q);
    assert.deepEqual(plantillaConEjemplo(p, null), p);
  }
  // Un hueco con dos piezas (los rótulos de «Antes y después») se cambia en las dos.
  const ad = plantillaConEjemplo(porId('antes-despues'));
  assert.deepEqual(piezasDe(ad, 'rotulo-despues').map((x) => x.muestra), ['HOY · 60 %', 'HOY · 60 %']);
  // Las retiradas no tienen ejemplo: copia igual.
  for (const id of RETIRADAS) assert.deepEqual(plantillaConEjemplo(porId(id)), porId(id));
  assert.equal(JSON.stringify(PLANTILLAS), antes, 'plantillaConEjemplo cambió el catálogo');
});

test('5: dibujada con el ejemplo sigue en la zona segura de Meta y ningún par de textos simultáneos se pisa', () => {
  const tol = 0.5;
  for (const { p } of conEjemplo()) {
    const ts = textos(plantillaConEjemplo(p));
    for (const x of ts) {
      const c = cajaDeTexto(x);
      const donde = `${p.id} · «${x.muestra}»`;
      assert.ok(c.y >= ZONA_SEGURA.arriba - tol, `${donde}: arriba en ${c.y.toFixed(0)}`);
      assert.ok(c.y + c.alto <= ZONA_SEGURA.abajo + tol, `${donde}: abajo en ${(c.y + c.alto).toFixed(0)}`);
      assert.ok(c.x >= ZONA_SEGURA.izquierda - tol && c.x + c.ancho <= ZONA_SEGURA.derecha + tol, `${donde}: costados ${c.x.toFixed(0)}–${(c.x + c.ancho).toFixed(0)}`);
      assert.ok(c.x + c.ancho <= LIENZO_REF.ancho, donde);
    }
    for (let i = 0; i < ts.length; i++) {
      for (let j = i + 1; j < ts.length; j++) {
        const [a, b] = [ts[i], ts[j]];
        if (a.fin <= b.inicio || b.fin <= a.inicio) continue;
        const [ca, cb] = [cajaDeTexto(a), cajaDeTexto(b)];
        const separados = ca.y + ca.alto <= cb.y || cb.y + cb.alto <= ca.y || ca.x + ca.ancho <= cb.x || cb.x + cb.ancho <= ca.x;
        assert.ok(separados, `${p.id}: «${a.muestra}» pisa a «${b.muestra}»`);
      }
    }
  }
  // El beneficio de 24 caracteres entra en UN renglón (si se parte, pisa al siguiente): lo avisa la cabecera del módulo.
  const b2 = piezasDe(plantillaConEjemplo(porId('beneficios')), 'beneficio-2')[0];
  assert.ok(cajaDeTexto(b2).alto < 2 * b2.estilo.px, 'beneficio-2 en dos renglones');
});

/** Los segundos de una parte del guion: «0–3 s», «6.5–9.5 s». */
const tramo = (s: string) => {
  const m = /^(\d+(?:\.\d+)?)–(\d+(?:\.\d+)?) s$/.exec(s);
  assert.ok(m, `«${s}» no es «desde–hasta s»`);
  return { desde: Number(m[1]), hasta: Number(m[2]) };
};

test('6: el guion va pegado desde 0 hasta el fin del clip que se graba; sin voz, lo cuenta el anuncio', () => {
  for (const { p, e } of conEjemplo()) {
    // El clip que se graba: lo último de la principal que la persona llena (el fondo del cierre es opcional).
    const finVoz = Math.max(...p.piezas.filter((x) => x.tipo === 'clip' && x.pista === 'principal' && !x.hueco.opcional).map((x) => x.fin));
    if (e.guion.length === 0) {
      assert.ok(e.anuncio && e.anuncio.length > 0, `${p.id}: sin voz y sin anuncio, el ejemplo no cuenta nada`);
      continue;
    }
    let corte = 0;
    for (const parte of e.guion) {
      const { desde, hasta } = tramo(parte.segundos);
      assert.equal(desde, corte, `${p.id}: el guion salta en ${corte} s`);
      assert.ok(hasta > desde, `${p.id}: ${parte.segundos}`);
      assert.match(parte.dice, /^«[^«»]+»$/u, `${p.id} ${parte.segundos}: lo que se dice va entre «»`);
      corte = hasta;
    }
    assert.equal(corte, finVoz, `${p.id}: el guion termina en ${corte} s y el clip en ${finVoz} s`);
  }
});

test('7: nada del ejemplo nombra a un real, ni tiene voseo ni regionalismos', () => {
  for (const { p, e } of conEjemplo()) {
    const todo = [
      e.negocio, e.sobre, e.objetivo, e.cuando, ...Object.values(e.textos),
      ...e.guion.flatMap((g) => [g.segundos, g.dice]), ...e.tomas, e.anuncio ?? '',
    ];
    for (const t of todo) assert.deepEqual(problemasDelEjemplo(t), [], `${p.id}: «${t}»`);
    for (const t of [e.negocio, e.sobre, e.cuando, ...e.tomas]) assert.ok(t.trim().length > 0 && !t.includes('\n'), `${p.id}: «${t}»`);
    assert.ok(e.tomas.length > 0, `${p.id}: sin tomas de apoyo`);
  }
});

test('8: la insignia de la tarjeta, y el módulo es puro', () => {
  assert.equal(insigniaDeVideo(porId('gancho')), '15 s · 1 clip');
  assert.equal(insigniaDeVideo(porId('gancho'), 'Recibes leads de anuncios'), 'Sugerida · 15 s · 1 clip');
  assert.equal(insigniaDeVideo(porId('testimonio'), true), 'Sugerida · 15 s · 1 clip');
  assert.equal(insigniaDeVideo(porId('antes-despues'), null), '14 s · 2 clips');
  assert.equal(insigniaDeVideo(porId('oferta'), false), '15 s · 1 clip');
  // El fondo del cierre (opcional) no cuenta, y un hueco con dos piezas cuenta una vez.
  for (const p of PLANTILLAS) {
    const n = huecosDe(p).filter((h) => h.tipo === 'clip' && !h.opcional).length;
    assert.equal(insigniaDeVideo(p), `${p.duracion} s · ${n} ${n === 1 ? 'clip' : 'clips'}`, p.id);
  }
  const fuente = readFileSync(new URL('../lib/editor-video/plantillas-ejemplos.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const imports = [...fuente.matchAll(/^import\b[^;]*;/gm)].map((m) => m[0]);
  assert.deepEqual(imports, ["import type { Pieza, Plantilla } from './plantillas';"]);
  const sinComentarios = fuente.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(sinComentarios, /server-only|_opencut|app\/video-editor/);
});

// Roturas (06/11/2026), base 8 de 8 en verde; cada una restaurada (8/0 al final, el módulo idéntico byte a byte):
// · 1: un ejemplo para gancho-escrito (retirada) → 7/1 (1).
// · 2: el cta del testimonio como «boton» → 5/3 (2, 3 y 4: el hueco «cta» queda sin texto del ejemplo).
// · 3: el cta del gancho en 22 caracteres (tope 20) → 7/1 (3). · el título de beneficios en minúscula (la pieza dibuja
//   mayúsculas) → 7/1 (3). · el nombre del testimonio en MAYÚSCULAS (la pieza no las dibuja) → 7/1 (3).
// · 4: plantillaConEjemplo cambia sólo la primera pieza de un hueco → 7/1 (4). · la muta en vez de copiarla → 7/1 (4).
// · 5: «Práctica en VIVO semanal» (cabe en 24, pero en dos renglones pisa al beneficio 3) → 7/1 (5).
// · 6: el guion de la oferta salta de 3 a 3.5 → 7/1 (6). · el de beneficios termina en 11 (el clip, en 12) → 7/1 (6).
// · 7: «Escribime» en el anuncio del gancho → 7/1 (7). · «Mauricio» en una toma → 7/1 (7).
// · 8: la insignia cuenta el fondo opcional del cierre → 7/1 (8). · `import { type … }` (un import de valor) → 7/1 (8).
