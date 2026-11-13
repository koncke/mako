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
//   8. la lámina fiel: la plancha de fondo, el texto en la caja medida y con el color medido, sin la foto del negocio;
//   9. la vista previa del armado la dibuja igual que el editor: la plancha de fondo y los acentos (`PaginaCarrusel`);
//  10. un ícono en la punta de un renglón no es una letra (`sinIconoEnLasPuntas`): el renglón mide lo que miden sus letras;
//  11. el peso de la letra se MIDE (el trazo con el cuerpo, `pesoMedido`): un cuerpo regular no sale en negrita;
//  12. lo que leyó el segundo pedido en el recorte decide qué va en unos renglones (`queVaEnLosRenglones`);
//  13. un signo suelto en la franja de un texto (el «=» de «= 100M Business») es de ese texto;
//  14. sin @ del negocio, a quién seguir es el negocio por su nombre; un acento no cae en una palabra vacía sola;
//  15. el nombre de un logo (debajo de él, corto) queda como en el original; un «texto» sin letras es un ícono;
//  16. dos textos de la IA en un mismo bloque a la vista se juntan (`mismoBloque`), y las filas se cuentan (`filasDe`).
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
//   P8 el renglón sin sacarle el ícono de la punta                                           → falla el 10
//   P9 el peso por el papel, sin medir el trazo                                              → falla el 11
//   P10 la IA principal gana siempre, diga lo que diga el recorte                            → falla el 12
//   P11 sin el signo suelto en la franja del titular                                         → falla el 13
//   P15 el nombre de un logo se reescribe (`esNombreDeLogo` siempre falso)                   → falla el 15
//   P16 dos textos en un mismo bloque no se juntan (`mismoBloque` siempre falso)              → falla el 16
//   P17 un emoji pasa por texto (`sinLetras` sólo con el vacío)                               → falla el 15
//   P18 «Sigue para más…» sin el nombre del negocio                                           → falla el 16
//   P12 «Sigue @usuario» sin el nombre del negocio                                           → falla el 14
//   P13 la vista previa sin la imagen de fondo                                               → falla el 9
//   P14 el acento en una palabra vacía sola                                                  → falla el 14
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asignarRenglones, bloqueDeRenglones, bloquesSinDueno, borrarZona, esDeUnaLista, esNombreDeLogo, filasDe, leerLamina, mismoBloque, planchar, sinLetras, type Renglon, type Rgba } from '../lib/carruseles/plancha-local';
import { conAcentos, dicenLoMismo, documentoDeReplica, leerCompletado, PERSONA_A_GENERAR, pesoMedido, queVaEnLosRenglones, sinArroba, sinCambio, sinVaciasSueltas, type Replica } from '../lib/carruseles/replica';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fondoDePagina, PaginaCarrusel } from '../app/image-editor/carruseles/MiniaturaCarrusel';

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
  // Sin @ del negocio, el del original se va con la palabra que lo presentaba.
  assert.equal(sinArroba('Síguenos en @usuario para más contenido.', ''), 'Síguenos para más contenido.');
  assert.equal(sinArroba('Sigue a @usuario', '@mako'), 'Sigue a @mako');
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

test('9. la vista previa de «Tu versión está lista» dibuja la plancha de fondo y los acentos, como el editor', () => {
  // 13/11/2026, en producción: el editor abría la réplica fiel bien y la vista previa la mostraba en blanco, con los textos
  // sueltos encima (sólo leía `background.color`). Lo primero que se ve tiene que ser lo que se va a abrir.
  const pagina = {
    background: { type: 'image', src: 'https://x/plancha.jpg', fit: 'cover' },
    objects: [{ type: 'textbox', text: 'Crea un\nproyecto', left: 100, top: 200, width: 800, fontSize: 90, fill: '#141414', styles: { 1: { 0: { fill: '#D97757' }, 1: { fill: '#D97757' } } } }],
  };
  const html = renderToStaticMarkup(createElement(PaginaCarrusel, { pagina }));
  assert.match(html, /background-image:url\(&quot;https:\/\/x\/plancha\.jpg&quot;\)/, `sin la plancha de fondo: ${html.slice(0, 300)}`);
  assert.match(html, /<span style="color:#D97757">pr<\/span>oyecto/, `sin el acento: ${html}`);
  // Una página sin plancha sigue con su color.
  assert.deepEqual(fondoDePagina({ type: 'solid', color: '#FBF3EA' }), { background: '#FBF3EA' });
  // Sólo una imagen https o en línea (el `src` va adentro de un `url()`).
  assert.deepEqual(fondoDePagina({ type: 'image', src: 'javascript:alert(1)' }), { background: '#fff' });
});

test('10. un ícono en la punta de un renglón no es una letra: el renglón mide lo que miden sus letras', () => {
  // 13/11/2026, el pie de la lámina 6 de @lifeofarjav en producción: «✳ Follow @lifeofarjav…». El ✳ entraba al renglón con la
  // primera mayúscula, el renglón medía 34 px en vez de 16, el texto nuevo salía con la letra el doble de grande y el ícono se borraba.
  const img = lamina(400, 400);
  pintar(img, 20, 200, 34, 34, NARANJA);              // el ícono
  pintar(img, 60, 208, 9, 18, NEGRO);                 // la mayúscula
  renglon(img, 74, 213, 14, 13);                      // las minúsculas
  const l = leerLamina(img);
  const r = l.renglones.find((x) => x.caja.y >= 195 && x.caja.y <= 215);
  assert.ok(r, `no hay renglón: ${JSON.stringify(l.renglones)}`);
  assert.ok(r.caja.x >= 55, `el ícono quedó adentro del renglón: ${JSON.stringify(r.caja)}`);
  assert.ok(r.caja.alto <= 20, `el renglón mide el alto del ícono: ${JSON.stringify(r.caja)}`);
});

/** Un renglón de letras de dos PALOS de `grosor` (como una «n»): el trazo que se mide es el del palo. */
function palos(img: Rgba, x: number, y: number, letras: number, alto: number, grosor: number) {
  let cx = x;
  for (let k = 0; k < letras; k++) {
    pintar(img, cx, y, grosor, alto, NEGRO);
    pintar(img, cx + Math.round(0.35 * alto), y, grosor, alto, NEGRO);
    pintar(img, cx, y, Math.round(0.35 * alto) + grosor, grosor, NEGRO);
    cx += Math.round(0.35 * alto) + grosor + Math.round(0.15 * alto);
  }
}

test('11. el peso de la letra se mide: un cuerpo regular no sale en negrita aunque la IA lo llame titular', () => {
  // 13/11/2026: el cuerpo de un tuit de @AlexHormozi (regular) salía en Inter 800, apretado. Medido en producción: 11 px de trazo
  // con un cuerpo de ~115 px; los titulares de @lifeofarjav, 17 con ~117.
  assert.equal(pesoMedido(11, 115), 400);
  assert.equal(pesoMedido(17, 117), 700);
  assert.equal(pesoMedido(20, 110), 800);
  assert.equal(pesoMedido(3, 20), 0, 'una letra chica no se mide (el borde suavizado pesa más que el palo)');
  const img = lamina(600, 600);
  palos(img, 20, 40, 8, 60, 6);    // fina: 6 px de palo con 60 de alto
  palos(img, 20, 160, 8, 60, 14);  // gruesa: 14
  const l = leerLamina(img);
  const fina = bloqueDeRenglones(img, l.renglones.filter((r) => r.caja.y < 120))!;
  const gruesa = bloqueDeRenglones(img, l.renglones.filter((r) => r.caja.y >= 120))!;
  assert.ok(Math.abs((fina.trazo ?? 0) - 6) <= 1, `trazo fino ${fina.trazo}`);
  assert.ok(Math.abs((gruesa.trazo ?? 0) - 14) <= 1, `trazo grueso ${gruesa.trazo}`);
  // Con el cuerpo de esas letras (60 px de alto sin colitas: 81 px de cuerpo), una es regular y la otra negrita.
  assert.equal(pesoMedido(fina.trazo, 60 / 0.74), 400);
  assert.equal(pesoMedido(gruesa.trazo, 60 / 0.74), 800);
});

test('12. lo que el segundo pedido leyó en el recorte decide qué va en unos renglones', () => {
  // La lámina 6 en seco: la IA principal le dio «3. Lead Generation» a los renglones de «Comment "GIFT"…».
  assert.equal(queVaEnLosRenglones(
    { original: '3. Lead Generation', texto: '3. Generación de Leads' },
    { original: 'Comment "GIFT"\nand I\'ll send it over.', texto: 'Comenta "FUNNEL"\ny te lo envío.' },
  ), 'leido');
  // La portada en producción: «Claude» debajo de su logo salió «PASO 2». El recorte lo deja igual: queda el original.
  assert.equal(queVaEnLosRenglones({ original: 'Claude', texto: 'PASO 2' }, { original: 'Claude', texto: 'Claude' }), 'original');
  // Sin dueño, lo mismo: lo que vuelve igual no se borra ni se reescribe.
  assert.equal(queVaEnLosRenglones(null, { original: '© 2026', texto: '©2026' }), 'original');
  assert.equal(queVaEnLosRenglones(null, { original: 'STEP 2', texto: 'PASO 2' }), 'leido');
  // El recorte dice lo que ella leyó (aunque le falte el «step by step.» del renglón de abajo): queda lo de la IA principal.
  assert.equal(queVaEnLosRenglones(
    { original: 'Turn Claude into your Hormozi business coach,\nstep by step.', texto: 'Tu estrategia de ventas, paso a paso.' },
    { original: 'Turn Claude into your Hormozi business coach,', texto: 'Convierte a Claude en tu asesor,' },
  ), 'suyo');
  // La IA principal escribió el texto NUEVO en «original» (pasó en una corrida entera): va lo leído, que dice lo mismo.
  assert.equal(queVaEnLosRenglones({ original: 'PASO 1', texto: 'PASO 1' }, { original: 'STEP 1', texto: 'PASO 1' }), 'leido');
  assert.ok(sinCambio({ original: '02 / 06', texto: '02/06' }));
  assert.ok(!sinCambio({ original: '@LIFEOFARJAV', texto: '' }), 'el @ que se saca no es «sin cambio»: se borra');
  assert.ok(!dicenLoMismo('Alex Hormozi Set Up Guide', 'Comment "GIFT" and I\'ll send it over.'));
});

test('13. un signo suelto en la franja de un texto (el «=» de «= 100M Business») es de ese texto', () => {
  const img = lamina(500, 500);
  pintar(img, 40, 114, 30, 8, NEGRO);   // las dos barras del «=»
  pintar(img, 40, 134, 30, 8, NEGRO);
  renglon(img, 100, 100, 8, 60);        // «100M Business»
  const l = leerLamina(img);
  const barras = l.renglones.filter((r) => r.caja.x < 80);
  assert.equal(barras.length, 2, `las barras: ${JSON.stringify(l.renglones)}`);
  const [titular] = asignarRenglones([{ x: 100, y: 100, ancho: 380, em: 80, renglones: 1, alinear: 'left' }], l.renglones, 500);
  for (const b of barras) assert.ok(titular.includes(b.n), `la barra ${b.n} quedó sin dueño: ${JSON.stringify(titular)}`);
});

test('14. sin @ del negocio, a quién seguir es el negocio por su nombre; un acento no cae en una palabra vacía sola', () => {
  // 13/11/2026, el pie de la lámina 6 en producción: «Sigue para más estrategia de ventas.»
  assert.equal(sinArroba('Sigue @usuario para más estrategia de ventas.', '', 'Martin Koncke'), 'Sigue a Martin Koncke para más estrategia de ventas.');
  assert.equal(sinArroba('Síguenos en @usuario para más.', '', 'Martin Koncke'), 'Síguenos para más.');
  assert.equal(sinArroba('Sigue @usuario para más.', '@mako'), 'Sigue @mako para más.');
  // La portada en producción: «Tu estrategia *de* ventas» (en el original, ahí iba «Hormozi» en naranja).
  const t = 'Tu estrategia de ventas por WhatsApp';
  const de = t.indexOf('de ');
  assert.deepEqual(sinVaciasSueltas(t, [[de, de + 2]]), []);
  const a = 'Acelerador de Ventas';
  assert.equal(sinVaciasSueltas(a, [[0, 10], [11, 13], [14, 20]]).length, 3, 'entre dos palabras de acento, la vacía queda');
});

test('15. el nombre de un logo queda como en el original; un «texto» sin letras es un ícono', () => {
  // 13/11/2026: «Claude» debajo del logo de Claude salió «PASO 2» en producción y «MaKo» en seco.
  const img = lamina(500, 600);
  pintar(img, 300, 300, 80, 80, NARANJA);     // el logo (una figura casi cuadrada)
  renglon(img, 314, 388, 4, 22);              // «Claude», debajo
  renglon(img, 322, 560, 4, 22);              // otro renglón, lejos del logo
  const l = leerLamina(img);
  const le = { img, lectura: l };
  const nombre = l.renglones.find((r) => r.caja.y >= 380 && r.caja.y < 400)!;
  const lejos = l.renglones.find((r) => r.caja.y >= 550)!;
  assert.ok(nombre && lejos, `renglones: ${JSON.stringify(l.renglones)}`);
  assert.ok(esNombreDeLogo(le, [nombre], []), 'el nombre del logo se reescribiría');
  assert.ok(!esNombreDeLogo(le, [lejos], []), 'un renglón lejos del logo no es su nombre');
  const persona = l.figuras[0].n;
  assert.ok(!esNombreDeLogo(le, [nombre], [persona]), 'debajo de una PERSONA va el nombre del negocio, no queda el original');
  assert.ok(sinLetras('📄') && sinLetras('✦ ') && !sinLetras('PASO 2') && !sinLetras('02 / 06'));
});

test('16. dos textos de la IA en un mismo bloque a la vista se juntan, y las filas se cuentan', () => {
  const r = (n: number, x: number, y: number, ancho: number, alto: number): Renglon => ({ n, caja: { x, y, ancho, alto } });
  // La caja de la lámina 6: «Comment "GIFT"» y «and I'll send it over.» (medidas en el original).
  assert.ok(mismoBloque([r(23, 401, 1098, 352, 34)], [r(24, 401, 1150, 300, 26)]), 'las dos filas de la llamada a la acción no son un bloque');
  // La portada: el titular y el subtítulo no son un bloque (otra letra).
  assert.ok(!mismoBloque([r(5, 204, 493, 779, 86)], [r(8, 147, 626, 805, 38)]));
  // Ni dos textos lejos uno de otro.
  assert.ok(!mismoBloque([r(1, 100, 100, 300, 30)], [r(2, 100, 300, 300, 30)]));
  // Dos pedazos de la misma franja son UNA fila (y su ancho, la suma); dos franjas, dos.
  assert.deepEqual(filasDe([r(1, 100, 100, 120, 30), r(2, 240, 102, 80, 28)]).map((f) => f.ancho), [200]);
  assert.equal(filasDe([r(23, 401, 1098, 352, 34), r(24, 401, 1150, 300, 26)]).length, 2);
  // Y «Sigue para más…» (sin @, como lo escribe la IA): a quién, por su nombre.
  assert.equal(sinArroba('Sigue para más contenido de alto impacto.', '', 'Martin Koncke'), 'Sigue a Martin Koncke para más contenido de alto impacto.');
  assert.equal(sinArroba('Síguenos para más contenido.', '', 'Martin Koncke'), 'Síguenos para más contenido.');
});
