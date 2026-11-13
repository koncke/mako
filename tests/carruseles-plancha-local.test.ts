// =============================================================================
// La réplica FIEL: la lámina original sin sus letras de fondo y los textos nuevos encima, en su lugar (13/11/2026)
// =============================================================================
// Martín, 13/11/2026, sobre la réplica de @lifeofarjav: «fíjate cómo quedaron los textos, no son igual a los de la referencia…
// se está replicando terriblemente mal», y que su foto de noche no vaya «de todos lados». Lo que se arregló y fija este test:
//   1. los renglones y las figuras se DETECTAN en la lámina (`leerLamina`), no se le creen a la IA sus coordenadas;
//   2. cada texto de la IA se lleva sus renglones EN ORDEN (`asignarRenglones`), salteando la letra de una captura;
//   3. la plancha borra la letra rellenando con el fondo que la rodea, y no toca lo que no es liso (`borrarZona`);
//   4. una pastilla se queda en la plancha y sólo se le borra la letra (`planchar` → `pastilla`);
//   5. el color de acento y la alineación se MIDEN (`bloqueDeRenglones`);
//   6. la letra de una lista o de una interfaz no es un texto principal (`esDeUnaLista`);
//   7. lo que lee la IA: las palabras de acento (`conAcentos`) y el segundo pedido por número de recorte (`leerCompletado`);
//   8. la lámina fiel: la plancha de fondo, el texto en la caja medida y con el color medido, sin la foto del negocio.
// Las láminas se dibujan acá, píxel por píxel: rectángulos de «tinta» con la forma de un renglón.
//
// Correr: node --import tsx --test tests/carruseles-plancha-local.test.ts
// Probado rompiéndolo (13/11/2026; cada rotura sola, restaurada después):
//   P1 `asignarRenglones` por cercanía y no en orden (el costo de la posición sin tope)        → falla el 2
//   P2 `borrarZona` sin mirar si el borde es parejo (ni sus filas ni arriba y abajo)          → falla el 3
//   P3 la pastilla borrada entera (sin `pastillaDe`)                                         → falla el 4
//   P4 el acento contando el borde gris de la letra (sin exigir color vivo)                  → falla el 5
//   P5 `esDeUnaLista` pidiendo seis vecinos en vez de tres                                   → falla el 6
//   P6 `leerCompletado` por orden y no por «n»                                                → falla el 7
//   P7 la lámina fiel con el color de la IA en vez del medido                                → falla el 8
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asignarRenglones, bloquesSinDueno, borrarZona, esDeUnaLista, leerLamina, planchar, type Rgba } from '../lib/carruseles/plancha-local';
import { conAcentos, documentoDeReplica, leerCompletado, PERSONA_A_GENERAR, type Replica } from '../lib/carruseles/replica';

const CREMA: [number, number, number] = [251, 243, 234];
const NEGRO: [number, number, number] = [20, 20, 20];
const NARANJA: [number, number, number] = [214, 86, 44];
const BLANCO: [number, number, number] = [255, 255, 255];

function lamina(ancho = 400, alto = 500, fondo = CREMA): Rgba {
  const px = new Uint8ClampedArray(ancho * alto * 4);
  for (let i = 0; i < ancho * alto; i++) { px[i * 4] = fondo[0]; px[i * 4 + 1] = fondo[1]; px[i * 4 + 2] = fondo[2]; px[i * 4 + 3] = 255; }
  return { ancho, alto, px };
}
function pintar(img: Rgba, x: number, y: number, w: number, h: number, c: readonly number[]) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = (yy * img.ancho + xx) * 4; img.px[i] = c[0]; img.px[i + 1] = c[1]; img.px[i + 2] = c[2]; }
}
/** Un renglón de «letras»: palitos de `alto` separados por un hueco chico (y uno más grande cada 4: el espacio entre palabras). */
function renglon(img: Rgba, x: number, y: number, letras: number, alto: number, c: readonly number[] = NEGRO, colores?: (k: number) => readonly number[]) {
  let cx = x;
  for (let k = 0; k < letras; k++) {
    pintar(img, cx, y, Math.max(3, Math.round(alto * 0.45)), alto, colores ? colores(k) : c);
    cx += Math.round(alto * 0.45) + Math.max(2, Math.round(alto * 0.12)) + (k % 4 === 3 ? Math.round(alto * 0.3) : 0);
  }
  return cx - x;
}
const color = (img: Rgba, x: number, y: number) => { const i = (y * img.ancho + x) * 4; return [img.px[i], img.px[i + 1], img.px[i + 2]]; };
const cerca = (a: readonly number[], b: readonly number[], d = 12) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= d;

test('1. los renglones y las figuras se detectan en la lámina', () => {
  const img = lamina();
  renglon(img, 40, 60, 12, 30);
  renglon(img, 40, 100, 9, 30);
  pintar(img, 120, 300, 120, 140, NARANJA); // una figura (una foto, una persona)
  const l = leerLamina(img);
  assert.equal(l.renglones.length, 2, `renglones: ${JSON.stringify(l.renglones)}`);
  assert.ok(l.renglones[0].caja.y <= 60 && l.renglones[0].caja.alto >= 30);
  assert.equal(l.figuras.length, 1, `figuras: ${JSON.stringify(l.figuras)}`);
});

test('2. cada texto se lleva sus renglones EN ORDEN, aunque la IA lo ubique corrido, y salteando los de una captura', () => {
  const img = lamina(400, 600);
  renglon(img, 40, 40, 14, 40);   // el titular
  renglon(img, 40, 120, 18, 18);  // el subtítulo
  for (let k = 0; k < 4; k++) renglon(img, 60, 300 + k * 22, 20, 10); // la letra chica de una captura
  renglon(img, 40, 520, 10, 18);  // el pie
  const l = leerLamina(img);
  // La IA dice el subtítulo 200 px más abajo de donde está (como medido en producción), pero en orden.
  const textos = [
    { x: 40, y: 10, ancho: 320, em: 46, renglones: 1, alinear: 'left' as const },
    { x: 40, y: 330, ancho: 320, em: 20, renglones: 1, alinear: 'left' as const },
    { x: 40, y: 560, ancho: 200, em: 20, renglones: 1, alinear: 'left' as const },
  ];
  const a = asignarRenglones(textos, l.renglones, 400);
  const yDe = (n: number) => l.renglones.find((r) => r.n === n)!.caja.y;
  assert.deepEqual(a.map((rs) => rs.map(yDe)), [[40], [120], [520]], `asignó ${JSON.stringify(a.map((rs) => rs.map(yDe)))}`);
});

test('3. la letra se borra con el fondo que la rodea; sobre una foto (borde que no es parejo) no se toca', () => {
  const img = lamina();
  renglon(img, 40, 60, 10, 30);
  assert.equal(borrarZona(img, { x: 40, y: 60, ancho: 200, alto: 30 }, 3), true);
  assert.ok(cerca(color(img, 50, 70), CREMA), 'la letra quedó');
  // Una «foto»: bandas de colores alternados alrededor del texto.
  const foto = lamina();
  for (let y = 0; y < 500; y += 4) pintar(foto, 0, y, 400, 2, y % 8 === 0 ? [30, 90, 160] : [200, 180, 60]);
  renglon(foto, 40, 60, 10, 30, BLANCO);
  const antes = color(foto, 50, 70);
  assert.equal(borrarZona(foto, { x: 40, y: 60, ancho: 200, alto: 30 }, 3), false, 'borró sobre una foto');
  assert.deepEqual(color(foto, 50, 70), antes, 'tocó la foto aunque dijo que no');
});

test('4. una pastilla se queda en la plancha y sólo se le borra la letra', () => {
  const img = lamina();
  pintar(img, 40, 40, 160, 44, NARANJA);       // la pastilla «STEP 1»
  renglon(img, 64, 52, 6, 20, BLANCO);         // su letra blanca
  renglon(img, 40, 140, 12, 40);               // un titular
  const l = leerLamina(img);
  const pastilla = l.renglones.find((r) => r.caja.alto >= 40 && r.caja.alto <= 50 && r.caja.y <= 45)!;
  assert.ok(pastilla, `no detectó la pastilla: ${JSON.stringify(l.renglones)}`);
  const r = planchar(img, l, { textos: [{ renglones: [pastilla.n] }], personas: [] });
  assert.ok(r.ok);
  assert.ok(r.ok && r.textos[0]?.pastilla, 'no la reconoció como pastilla');
  assert.ok(cerca(color(img, 45, 60), NARANJA, 30), 'se borró la pastilla entera');
  assert.ok(cerca(color(img, 66, 60), NARANJA, 30), 'la letra blanca quedó');
  // Una de CONTORNO («STEP 2» de @lifeofarjav): un trazo fino y claro, la lámina adentro y la letra naranja.
  const c = lamina();
  const TRAZO = [197, 149, 127];
  pintar(c, 40, 40, 150, 2, TRAZO); pintar(c, 40, 92, 150, 2, TRAZO); pintar(c, 40, 40, 2, 54, TRAZO); pintar(c, 188, 40, 2, 54, TRAZO);
  renglon(c, 74, 56, 4, 22, NARANJA);
  const lc = leerLamina(c);
  const etiqueta = lc.renglones.find((r) => r.caja.y <= 42)!;
  assert.ok(etiqueta, `no detectó la etiqueta: ${JSON.stringify(lc.renglones)}`);
  const rc = planchar(c, lc, { textos: [{ renglones: [etiqueta.n] }], personas: [] });
  assert.ok(rc.ok && rc.textos[0]?.pastilla?.contorno, 'no la reconoció como etiqueta de contorno');
  assert.ok(cerca(color(c, 115, 41), TRAZO, 20), 'se borró el contorno');
  assert.ok(cerca(color(c, 78, 66), CREMA), 'la letra de adentro quedó');
  // Y la letra de adentro (un renglón aparte) no queda «sin dueño» para el segundo pedido: se escribiría dos veces.
  assert.equal(bloquesSinDueno(c, lc, new Set([etiqueta.n])).length, 0, 'la letra de la etiqueta quedó sin dueño');
  const letraDeAdentro = lc.renglones.find((r) => r.n !== etiqueta.n);
  if (letraDeAdentro) assert.equal(bloquesSinDueno(c, lc, new Set([letraDeAdentro.n])).length, 0, 'el contorno de una letra con dueño quedó sin dueño');
});

test('5. el acento y la alineación se miden en la lámina', () => {
  const img = lamina();
  // «Claude + Hormozi»: las 4 primeras letras naranjas, centrado en la lámina.
  const ancho = renglon(img, 0, 0, 0, 30); void ancho;
  const w = 12 * (Math.round(30 * 0.45) + Math.round(30 * 0.12)) + 2 * Math.round(30 * 0.3);
  const x0 = Math.round((400 - w) / 2);
  renglon(img, x0, 80, 12, 30, NEGRO, (k) => (k < 4 ? NARANJA : NEGRO));
  const l = leerLamina(img);
  const r = planchar(img, l, { textos: [{ renglones: [l.renglones[0].n] }], personas: [] });
  assert.ok(r.ok && r.textos[0]);
  const b = r.ok ? r.textos[0]! : null;
  assert.equal(b?.alineacion, 'center');
  assert.ok(b?.acento, 'no midió el acento');
  assert.ok(cerca([parseInt(b!.acento!.color.slice(1, 3), 16), parseInt(b!.acento!.color.slice(3, 5), 16), parseInt(b!.acento!.color.slice(5, 7), 16)], NARANJA, 40));
  const [ini, fin] = b!.acento!.tramos[0][0];
  assert.ok(ini < 0.05 && fin > 0.25 && fin < 0.45, `el tramo del acento: ${ini}–${fin}`);
  // Un titular todo negro (el borde gris de cada letra no es un acento).
  const negro = lamina();
  renglon(negro, 40, 80, 12, 30);
  // Con el borde suavizado de una letra de verdad (y del JPEG): dos píxeles grises a cada lado de cada palito.
  const bordes: number[] = [];
  for (let x = 2; x < 398; x++) if (cerca(color(negro, x, 90), NEGRO) !== cerca(color(negro, x + 1, 90), NEGRO)) bordes.push(x);
  for (const x of bordes) pintar(negro, cerca(color(negro, x, 90), NEGRO) ? x + 1 : x - 1, 80, 2, 30, [136, 132, 127]);
  const ln = leerLamina(negro);
  const rn = planchar(negro, ln, { textos: [{ renglones: [ln.renglones[0].n] }], personas: [] });
  assert.ok(rn.ok && !rn.textos[0]?.acento, 'un texto de un color salió con acento');
});

test('6. la letra de una lista o de una interfaz no es un texto principal', () => {
  const img = lamina(400, 600);
  renglon(img, 40, 40, 14, 40);
  for (let k = 0; k < 5; k++) renglon(img, 60, 300 + k * 22, 20, 12);
  const l = leerLamina(img);
  const titular = l.renglones.find((r) => r.caja.alto >= 40)!;
  const deLista = l.renglones.find((r) => r.caja.y >= 340 && r.caja.y < 350)!;
  assert.equal(esDeUnaLista(l, [titular]), false);
  assert.equal(esDeUnaLista(l, [deLista]), true);
});

test('7. lo que lee la IA: las palabras de acento y el segundo pedido por número de recorte', () => {
  assert.deepEqual(conAcentos('*MaKo* + Claude'), { texto: 'MaKo + Claude', acentos: [[0, 4]] });
  assert.deepEqual(conAcentos('Sin acento*'), { texto: 'Sin acento', acentos: [] }, 'un asterisco suelto no marca nada');
  // La IA contesta salteando el recorte 1: el 2 no se corre al lugar del 1.
  const r = leerCompletado(JSON.stringify({ textos: [{ n: 2, original: '02 / 06', texto: '02 / 06', rol: 'rotulo', color: '#111111' }], personas: [{ n: 3, persona: true }] }), { textos: 2, figuras: 1 });
  assert.equal(r.textos[0], null);
  assert.equal(r.textos[1]?.texto, '02 / 06');
  assert.deepEqual(r.personas, [true]);
});

test('8. la lámina fiel: la plancha de fondo, el texto en su caja con el color medido, y la persona sin la foto del negocio', () => {
  const replica: Replica = {
    proporcion: '4:5', titulo: 'R', laminas: [{
      fondo: '#FBF3EA', foto: null, cuadros: [], formas: [],
      textos: [{ rol: 'titulo', texto: 'Crea tu proyecto', original: 'Build a Claude project', x: 0.1, y: 0.1, ancho: 0.8, tamano: 0.08, color: '#D97757', negrita: true, alinear: 'left', mayus: false, letra: 'sans' }],
    }],
  };
  const doc = documentoDeReplica({
    replica, estilo: { titular: { familia: 'Inter', respaldo: 'sans-serif', peso: 800 }, texto: { familia: 'Inter', respaldo: 'sans-serif', peso: 400 } } as never,
    marca: { nombre: 'X', usuario: null }, foto: null, nuevoId: (() => { let n = 0; return () => `id${n++}`; })(),
    planchas: [{ src: 'https://x/plancha.jpg', personas: [{ x: 600, y: 700, ancho: 300, alto: 400 }], textos: [{ caja: { x: 100, y: 200, ancho: 800, alto: 90 }, renglones: 1, paso: 0, altoRenglon: 90, tinta: '#141414', fondo: '#FBF3EA', franjas: [{ x: 100, y: 200, ancho: 800, alto: 90 }] }] }],
  }) as { pages: Array<{ background: { type: string; src?: string }; objects: Array<Record<string, unknown>> }> };
  const p = doc.pages[0];
  assert.deepEqual(p.background, { type: 'image', src: 'https://x/plancha.jpg', fit: 'cover' });
  const t = p.objects.find((o) => o.type === 'textbox')!;
  assert.equal(t.fill, '#141414', 'el color de la IA en vez del medido');
  assert.ok(Math.abs(Number(t.left) - 100) <= 1, `el texto no fue a su caja: ${t.left}`);
  assert.ok(!p.objects.some((o) => o.type === 'image'), 'apareció una foto');
  assert.ok(p.objects.some((o) => o.name === PERSONA_A_GENERAR), 'el lugar de la persona no quedó marcado');
});
