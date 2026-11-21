// El COPY PEGADO de un carrusel sale palabra por palabra, una parte por lámina, y agregar láminas nunca deja una en blanco
// (20/11/2026, la llamada con Leila, Fathom 205366178, 00:49:31–00:53:42).
//
// Lo que se vio en producción (ws 11, diseño 14331b1a, «Tu negocio te está consumiendo»):
//   · Leila pegó en «Editar» un copy de 10 láminas sobre una referencia de 7. Lo pegado se APLANABA y se cortaba en 300 letras
//     (`TOPE_LIBRE` de lib/carruseles/guiado.ts) y llegaba a la IA como un tema: salió «1. Simplifica la operación», «2. Pon a
//     prueba más ideas cada semana»…, que ella no escribió, y 7 láminas (el total topado al largo de la referencia).
//   · En el editor pegó el copy otra vez («eran 10 slide no 7») y el chat agregó 3 páginas con `agregar_pagina` sin `duplicar`:
//     BLANCAS (#ffffff) y con el texto en la tinta crema del diseño (#f3eee2). «Le agregué, pero es página 9 en blanco».
//   · La misma foto de banco en las láminas 2 y 3, y la de la 7 en cuatro: «te repetí dos imágenes que nada que ver».
//
// Esto fija:
//   1. el copy de Leila, tal cual lo pegó, se parte en sus 10 láminas, con el pie «(abajo: …)» aparte y sin tocar una letra;
//   2. un tema (sin marcas de lámina) no es un copy;
//   3. el guiado guarda el copy ENTERO, con sus renglones (antes: aplanado y cortado en 300), y la ruta lo recibe igual;
//   4. con qué lámina del original va cada parte: portada, cierre y las del medio en orden (10 partes sobre 7: 0,1,2,3,4,5,1,2,3,6);
//   5. la réplica con el copy tiene 10 láminas, y cada una dice EXACTAMENTE su parte (el pie, abajo); ninguna queda vacía;
//   6. lo que escribió la IA vale sólo si es el copy tal cual; si reescribió, reparte el código;
//   7. con planchas (la réplica fiel), cada parte lleva la plancha de su lámina y su texto puede bajar hasta el de abajo;
//   8. el prompt lleva cada parte palabra por palabra y no la regla de «cada texto lo escribes tú»;
//   9. ninguna foto se repite en el documento, ni con la misma búsqueda en dos láminas; un cuadro sin foto propia queda sin foto;
//  10. agregar 3 láminas a un carrusel de 8 da 11, cada una con el diseño de una de contenido y los renglones dictados.
//  11. SIN IA (21/11/2026, la prueba en producción en el ws 3): las láminas de guía llevan cada una SU parte, tantas como partes
//      (un tipo topado en 8 no corta un copy de 9), sin una palabra de la guía; antes salían las guías y el copy se perdía;
//  12. el guiado dice las láminas que salen: «Generar las 10 láminas» con el copy de Leila (decía 7), y un anuncio sigue en una.
//  13. con «Slide N», un «01/05» suelto es texto (el sello del diseño), no una marca; y un renglón igual a un texto fijo de la
//      lámina (el sello, el @) es ése: no corre los de abajo un lugar (21/11/2026, «Páginas que venden» de Martín: el sello salió
//      «04 / 09», «Hormozi» cayó donde iba «página» y «POR QUÉ VENDE» en el titular). Uno con otro valor («02/05») cambia el sello.
//
// Correr: node --import tsx --test tests/carruseles-copy-pegado.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAMINAS_DEL_COPY, conElCopy, laminaParaCadaParte, laminasConElCopy, partesDelCopy, repartirEnLosTextos } from '../lib/carruseles/copy-pegado';
import { escribir, leerPedidoGuiado, pedidoDelGuiado, preguntaDe, respuestasPorDefecto, resumenDe, type HechosGuiado } from '../lib/carruseles/guiado';
import { LAMINAS_MAX, documentoDeReplica, promptDeReplica, type LaminaReplica, type Replica, type TextoReplica } from '../lib/carruseles/replica';
import { aplicarOperaciones } from '../lib/image-editor/chat/aplicar';
import { validarOperacion, type OperacionImagen } from '../lib/image-editor/chat/catalogo';
import { vistaDeDiseno } from '../lib/image-editor/chat/vista';
import { tipoCarrusel } from '../lib/carruseles/tipos';

/** El copy que pegó Leila el 20/11/2026 (image_editor_chats del diseño 14331b1a, ws 11), tal cual. */
const COPY_DE_LEILA = `Slide 1, portada
Tu negocio te está consumiendo y los resultados no llegan por esto…
(abajo: Sígueme para más)

Slide 2
LA REVELACIÓN
Por dos fuerzas.
01 Lo que le exiges a cada resultado.
02 El ruido de afuera que te marca el ritmo sin que lo notes.
(abajo: Guárdalo para después)

Slide 3
EL GIRO
No te falta disciplina.
Te sobra importancia.
Le estás pidiendo a cada venta que demuestre tu valor COMO PERSONA.
(abajo: Compártelo con tu equipo)

Slide 4
POR DENTRO
Cada venta se siente como una sentencia.
Y trabajas con prisa, sin descanso y con ansiedad. Eso empeora tus decisiones.
(abajo: Envíalo a quien lo necesite)

Slide 5
POR FUERA
El péndulo.
Una presión colectiva que se alimenta de la atención de todos.
«Publica todos los días»
«Si no escalas, te quedas atrás»
Las métricas y la competencia
Se alimenta de tu reacción.
(abajo: Sígueme para más)

Slide 6
EL EFECTO PÉNDULO
Quejarte de esa presión le da fuerza. Obedecerla también.
Lo que la apaga es dejar de reaccionar. Cada indignación, comparación o urgencia ajena le da otro empujón, pero en contra de lo que quieres.
(abajo: Compártelo con tu equipo)

Slide 7
GUÁRDALO · PRUEBA DE 30 SEGUNDOS
Complétalo sin pensar.
Si esta venta no sale, significa que ________
La urgencia que siento hoy la traje de ________
Lo que escribiste es el peso que estás cargando.
(abajo: Guárdalo para después)

Slide 8
LA SALIDA
Una venta mide una venta.
Tu parte: la acción de hoy.
Plan B: «Si no sale, hago ___ y sigo».
Cuando sabes que puedes sostenerlo, vuelves a decidir con claridad.
(abajo: Envíalo a quien lo necesite)

Slide 9
PROTOCOLO ANTI-PÉNDULO
Cuando sientas la reacción:

Ponle nombre: prisa, miedo o comparación.
Pregúntate: «¿Esto es mío o me enganchó algo?»
Retira la atención y vuelve a tu acción con hora.
(abajo: Sígueme para más)

Slide 10, cierre
Leila Fittipaldi · MetaCoach · La Academia del Coach
Un negocio sano se construye con acción constante, no con desesperación.

Guárdalo para tu próximo lanzamiento
Envíaselo a quien se está dejando la vida
Comenta PESO y te envío la plantilla`;

/** Todas las palabras del copy, en orden (lo que no puede cambiar). */
const palabras = (s: string) => s.replace(/\(abajo:\s*([^)]*)\)/g, '$1').split(/\s+/).filter((w) => w && !/^(slide|\d+,?|portada|cierre)$/i.test(w));

test('1 · el copy de Leila se parte en sus 10 láminas, con el pie aparte y sin tocar una letra', () => {
  const p = partesDelCopy(COPY_DE_LEILA)!;
  assert.ok(p, 'no lo reconoció como un copy de láminas');
  assert.equal(p.length, 10);
  assert.deepEqual(p[0], { lineas: ['Tu negocio te está consumiendo y los resultados no llegan por esto…'], abajo: 'Sígueme para más' });
  assert.deepEqual(p[1].lineas, ['LA REVELACIÓN', 'Por dos fuerzas.', '01 Lo que le exiges a cada resultado.', '02 El ruido de afuera que te marca el ritmo sin que lo notes.']);
  assert.equal(p[4].lineas.length, 7, 'la lámina 5 tiene 7 renglones');
  assert.deepEqual(p[8].lineas.slice(1, 3), ['Cuando sientas la reacción:', 'Ponle nombre: prisa, miedo o comparación.'], 'el renglón vacío del medio no es otra lámina');
  assert.equal(p[9].abajo, null);
  assert.equal(p[9].lineas.at(-1), 'Comenta PESO y te envío la plantilla');
  // Todas las palabras, en orden: ni una de más ni una de menos.
  const juntas = p.flatMap((x) => [...x.lineas, ...(x.abajo ? [x.abajo] : [])]).join(' ');
  assert.deepEqual(palabras(juntas), palabras(COPY_DE_LEILA));
  // Otras marcas: «Lámina N:», «3/5» y «---».
  assert.equal(partesDelCopy('Lámina 1: Hola\nLámina 2: Chau')!.length, 2);
  assert.deepEqual(partesDelCopy('Lámina 1: Hola\nLámina 2: Chau')![0].lineas, ['Hola']);
  assert.equal(partesDelCopy('1/3\nUno\n2/3\nDos\n3/3\nTres')!.length, 3);
  assert.equal(partesDelCopy('Uno\n---\nDos\n---\nTres')!.length, 3);
});

test('2 · un tema no es un copy', () => {
  assert.equal(partesDelCopy('Hazlo sobre mi curso de liderazgo. Voz cercana. CTA: Comenta "PESO".'), null);
  assert.equal(partesDelCopy('Slide 1\nSólo una lámina'), null, 'una sola parte no es un copy de láminas');
  assert.equal(partesDelCopy(''), null);
});

const HECHOS: HechosGuiado = { laminas: 7, creador: '@alguien', ofertas: [{ id: 1, nombre: 'MetaCoach', principal: true }], persona: false, leyendo: false, fotos: { cara: false, look: false }, kit: false } as HechosGuiado;

test('3 · el guiado guarda el copy ENTERO y con sus renglones; la ruta lo recibe igual', () => {
  const r0 = respuestasPorDefecto(HECHOS);
  const r = escribir(HECHOS, { ...r0, listo: false }, COPY_DE_LEILA);
  const pedido = pedidoDelGuiado(HECHOS, r)!;
  assert.equal(pedido.copy, COPY_DE_LEILA, 'el copy no llegó entero al pedido (antes: aplanado y cortado en 300 letras)');
  assert.equal(pedido.pedido, null, 'el copy no es un tema: no va en el pedido');
  const leido = leerPedidoGuiado(JSON.parse(JSON.stringify(pedido)));
  assert.equal(leido.copy, COPY_DE_LEILA, 'la ruta lo aplanó o lo cortó');
  assert.equal(partesDelCopy(leido.copy)!.length, 10);
  // Pegado con el armado andando: otra vuelta, con el copy.
  const andando = escribir(HECHOS, { ...r0, listo: true, vuelta: 0 }, COPY_DE_LEILA);
  assert.equal(andando.vuelta, 1);
  assert.equal(andando.copy, COPY_DE_LEILA);
  // Un texto corto sigue siendo un extra, como siempre.
  assert.deepEqual(escribir(HECHOS, { ...r0, listo: false }, 'Que sea para dueños de negocio').extras, ['Que sea para dueños de negocio']);
});

test('4 · con qué lámina del original va cada parte', () => {
  assert.deepEqual(laminaParaCadaParte(10, 7), [0, 1, 2, 3, 4, 5, 1, 2, 3, 6]);
  assert.deepEqual(laminaParaCadaParte(5, 7), [0, 1, 2, 3, 6]);
  assert.deepEqual(laminaParaCadaParte(4, 2), [0, 1, 1, 1]);
  assert.deepEqual(laminaParaCadaParte(3, 1), [0, 0, 0]);
});

const T = (rol: TextoReplica['rol'], texto: string, y: number, extra: Partial<TextoReplica> = {}): TextoReplica => ({
  rol, texto, x: 0.1, y, ancho: 0.8, tamano: rol === 'titulo' ? 0.08 : 0.045, color: '#F3EEE2', negrita: rol === 'titulo', alinear: 'left', mayus: false, letra: 'sans', ...extra,
});
/** La réplica de la referencia de Leila como la armó la IA: 7 láminas, portada, cinco del medio y cierre, con texto INVENTADO. */
function replicaDeSiete(): Replica {
  const medio = (i: number): LaminaReplica => ({
    fondo: '#1F1F1F', foto: null, cuadros: [{ x: 0, y: 0, ancho: 1, alto: 1, tipo: 'escena', persona: false, descripcion: 'oficina', busqueda: `office scene ${i}` }],
    textos: [T('titulo', `${i}. Simplifica la operación.`, 0.22), T('rotulo', 'Una tarea, un sistema simple.', 0.4), T('cuerpo', 'Delega lo operativo.', 0.48), T('cuerpo', 'Ese es todo el cambio.', 0.68), T('cta', 'Guárdalo', 0.9)],
  });
  return {
    proporcion: '4:5', titulo: 'Tu negocio te está consumiendo',
    laminas: [
      { fondo: '#1F1F1F', foto: null, cuadros: [], textos: [T('titulo', 'Tu negocio te está consumiendo', 0.35), T('cta', 'Sígueme para más', 0.88), T('firma', '@leila', 0.04, { x: 0.7 })] },
      medio(1), medio(2), medio(3), medio(4), medio(5),
      { fondo: '#1F1F1F', foto: null, cuadros: [], textos: [T('titulo', 'La lección.', 0.28), T('cuerpo', 'Elimina las variables.', 0.44), T('cuerpo', 'Retoma el control.', 0.6)] },
    ],
  };
}

test('5 · la réplica con el copy: 10 láminas, cada una dice EXACTAMENTE su parte; ninguna vacía', () => {
  const partes = partesDelCopy(COPY_DE_LEILA)!;
  const { replica } = conElCopy(replicaDeSiete(), partes, { alto: 1350, ancho: 1080 });
  assert.equal(replica.laminas.length, 10, 'el total quedó topado al largo de la referencia');
  replica.laminas.forEach((l, k) => {
    const dicho = l.textos.filter((t) => t.copy && t.texto).map((t) => t.texto).join('\n');
    const parte = partes[k];
    assert.deepEqual(palabras(dicho), palabras([...parte.lineas, ...(parte.abajo ? [parte.abajo] : [])].join(' ')), `la lámina ${k + 1} no dice su parte`);
    assert.ok(l.textos.some((t) => t.texto.trim()), `la lámina ${k + 1} quedó vacía`);
    assert.ok(!l.textos.some((t) => /Simplifica la operación/.test(t.texto)), `quedó texto inventado en la ${k + 1}`);
  });
  // El pie va en el texto de abajo, y la firma del marco no recibe el copy.
  const portada = replica.laminas[0];
  assert.equal(portada.textos.find((t) => t.rol === 'cta')!.texto, 'Sígueme para más');
  assert.equal(portada.textos.find((t) => t.rol === 'firma')!.texto, '@leila');
  // La lámina 5 tiene 7 renglones y su diseño 4 lugares de arriba: los que sobran van juntos en el último, con sus cortes.
  const cinco = replica.laminas[4].textos.filter((t) => t.copy);
  assert.equal(cinco[0].texto, 'POR FUERA');
  assert.ok(cinco.some((t) => t.texto.includes('«Publica todos los días»\n«Si no escalas, te quedas atrás»')), 'los cortes de renglón del copy se perdieron');
  assert.ok(replica.laminas.every((l) => l.textos.every((t) => !t.copy || t.mayus === false)), 'el copy no se pasa a mayúsculas');
  // Las láminas 7 a 9 llevan el diseño de las del medio (no la portada ni el cierre), y la 10 el del cierre.
  assert.equal(replica.laminas[6].cuadros[0].busqueda, 'office scene 1');
  assert.equal(replica.laminas[9].textos.length, 3);
});

test('6 · lo que escribió la IA vale sólo si es el copy tal cual', () => {
  const parte = { lineas: ['LA REVELACIÓN', 'Por dos fuerzas.', '01 Lo que le exiges.'], abajo: null };
  const lugares = [{ rol: 'rotulo', x: 0.1, y: 0.1 }, { rol: 'titulo', x: 0.1, y: 0.2 }, { rol: 'cuerpo', x: 0.1, y: 0.4 }];
  // La IA puso el rótulo chico vacío y el titular con dos renglones: es el copy, va como ella lo ubicó.
  assert.deepEqual(repartirEnLosTextos(parte, lugares, { escrito: ['', 'LA REVELACIÓN\nPor dos fuerzas.', '01 Lo que le exiges.'] }), ['', 'LA REVELACIÓN\nPor dos fuerzas.', '01 Lo que le exiges.']);
  // La IA reescribió («Por 2 fuerzas»): reparte el código, en orden.
  assert.deepEqual(repartirEnLosTextos(parte, lugares, { escrito: ['LA REVELACIÓN', 'Por 2 fuerzas.', '01 Lo que le exiges.'] }), ['LA REVELACIÓN', 'Por dos fuerzas.', '01 Lo que le exiges.']);
});

test('7 · con planchas: cada parte lleva la de su lámina, y el texto puede bajar hasta el de abajo', () => {
  const r = replicaDeSiete();
  const bloque = (y: number, alto = 60) => ({ caja: { x: 100, y, ancho: 880, alto } });
  const planchas = r.laminas.map((l, i) => ({ src: `plancha-${i}.jpg`, personas: [], textos: l.textos.map((t) => bloque(Math.round(t.y * 1350))) }));
  const { replica, planchas: finales } = conElCopy(r, partesDelCopy(COPY_DE_LEILA)!, { planchas, alto: 1350, ancho: 1080 });
  assert.ok(finales);
  assert.deepEqual(finales!.map((p) => p!.src), ['plancha-0.jpg', 'plancha-1.jpg', 'plancha-2.jpg', 'plancha-3.jpg', 'plancha-4.jpg', 'plancha-5.jpg', 'plancha-1.jpg', 'plancha-2.jpg', 'plancha-3.jpg', 'plancha-6.jpg']);
  const ultimo = replica.laminas[4].textos.filter((t) => t.copy && t.texto).at(-2)!;
  assert.ok((ultimo.altoMax ?? 0) > 60, 'el texto con varios renglones no puede crecer: se achicaría a letra de 12 px');
});

test('8 · el prompt lleva cada parte palabra por palabra, sin «cada texto lo escribes tú»', () => {
  const partes = partesDelCopy(COPY_DE_LEILA)!;
  const prompt = promptDeReplica({
    laminas: 7, vistas: 7, negocio: '', voz: '', nombreNegocio: 'Leila', cta: null, conAvatar: false, pedido: null,
    copy: { partes, laminaDe: laminaParaCadaParte(10, 7) },
  });
  for (const p of partes.slice(0, 6)) for (const l of p.lineas) assert.ok(prompt.includes(l), `falta «${l}» en el prompt`);
  assert.ok(prompt.includes('PALABRA POR PALABRA'));
  assert.ok(!prompt.includes('cada texto lo escribes tú'), 'la regla de reescribir sigue en el prompt');
});

const FOTO = (n: number) => ({ id: '', url: `https://x.supabase.co/storage/v1/object/public/landing-imagenes/11/f${n}.jpg`, ancho: 1200, alto: 1500 });
const nuevoId = (() => { let n = 0; return () => `id${++n}`; })();
const estilo = { titular: { familia: 'Montserrat', respaldo: 'sans-serif' as const, peso: 800 }, texto: { familia: 'Inter', respaldo: 'sans-serif' as const, peso: 400 } } as never;

test('9 · ninguna foto se repite en el documento; un cuadro sin foto propia queda sin foto', () => {
  const { replica } = conElCopy(replicaDeSiete(), partesDelCopy(COPY_DE_LEILA)!, { alto: 1350, ancho: 1080 });
  // Cada búsqueda trajo DOS fotos; las láminas 7 a 9 repiten la búsqueda de la 2 a la 4.
  const escenas = new Map([1, 2, 3, 4, 5].map((i) => [`office scene ${i}`, [FOTO(i * 10), FOTO(i * 10 + 1)]] as const));
  const doc = documentoDeReplica({ replica, estilo, marca: { nombre: 'Leila', usuario: null }, foto: null, nuevoId, escenas });
  const fotos = (doc.pages as Array<{ objects: Array<Record<string, unknown>> }>).flatMap((p) => p.objects.filter((o) => o.type === 'image').map((o) => String(o.src)));
  assert.equal(new Set(fotos).size, fotos.length, `se repitió una foto: ${fotos.join(', ')}`);
  assert.equal(fotos.length, 8, 'las láminas 2 a 9 llevan una foto cada una');
  // Con UNA foto por búsqueda, la lámina que repite la búsqueda queda sin foto (antes: la misma, o «otra escena» cualquiera).
  const una = new Map([1, 2, 3, 4, 5].map((i) => [`office scene ${i}`, FOTO(i)] as const));
  const doc2 = documentoDeReplica({ replica, estilo, marca: { nombre: 'Leila', usuario: null }, foto: null, nuevoId, escenas: una });
  const fotos2 = (doc2.pages as Array<{ objects: Array<Record<string, unknown>> }>).map((p) => p.objects.filter((o) => o.type === 'image').length);
  assert.deepEqual(fotos2, [0, 1, 1, 1, 1, 1, 0, 0, 0, 0]);
});

// ── El chat del editor: agregar láminas ──────────────────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
/** Un carrusel de 8 láminas como el de Leila: fondo oscuro, una foto, un titular y un cuerpo crema. */
function carruselDeOcho() {
  const lamina = (i: number) => ({
    id: `p${i}`, background: { type: 'solid', color: '#1F1F1F' },
    objects: [
      { type: 'image', id: `f${i}`, name: 'Foto', src: `https://x/f${i}.jpg`, originX: 'left', originY: 'top', left: 0, top: 0, width: 1080, height: 1350, scaleX: 1, scaleY: 1 },
      { type: 'textbox', id: `t${i}`, name: 'Titular', text: `Titular ${i}`, fontFamily: '"Montserrat", sans-serif', fontSize: 86, fill: '#F3EEE2', originX: 'left', originY: 'top', left: 108, top: 300, width: 864, height: 98, scaleX: 1, scaleY: 1 },
      { type: 'textbox', id: `c${i}`, name: 'Texto', text: `Cuerpo ${i}`, fontFamily: '"Inter", sans-serif', fontSize: 49, fill: '#F3EEE2', originX: 'left', originY: 'top', left: 108, top: 600, width: 864, height: 56, scaleX: 1, scaleY: 1 },
    ],
  });
  return { width: 1080, height: 1350, pages: Array.from({ length: 8 }, (_, i) => lamina(i + 1)) };
}
const op = (x: Record<string, unknown>): OperacionImagen => {
  const v = validarOperacion(x);
  assert.ok(v.ok, `la operación de prueba no valida: ${JSON.stringify(x)} → ${!v.ok ? v.motivo : ''}`);
  return v.op;
};

test('10 · agregar 3 láminas a un carrusel de 8 da 11, con el diseño de una de contenido y los renglones dictados', () => {
  const doc = carruselDeOcho();
  const vista = vistaDeDiseno(doc, { activePageId: 'p8' });
  let n = 0;
  const partes = partesDelCopy(COPY_DE_LEILA)!.slice(7);
  const r = aplicarOperaciones({
    doc, vista, nuevoId: () => `nuevo-${++n}`, activePageId: 'p8',
    operaciones: partes.map((p) => op({ op: 'agregar_pagina', textos: [...p.lineas, ...(p.abajo ? [p.abajo] : [])] })),
  });
  const paginas = r.doc.pages as unknown as Array<{ background: Obj; objects: Obj[] }>;
  assert.equal(paginas.length, 11);
  paginas.slice(8).forEach((pg, k) => {
    assert.notDeepEqual(pg.background, { type: 'solid', color: '#ffffff' }, `la lámina ${9 + k} quedó blanca`);
    assert.ok(pg.objects.some((o) => o.type === 'image'), `la lámina ${9 + k} no tiene el diseño (la foto)`);
    const textos = pg.objects.filter((o) => o.type === 'textbox').map((o) => String(o.text));
    const parte = partes[k];
    assert.deepEqual(palabras(textos.join(' ')), palabras([...parte.lineas, ...(parte.abajo ? [parte.abajo] : [])].join(' ')), `la lámina ${9 + k} no dice lo dictado`);
    assert.ok(!textos.some((t) => /Titular|Cuerpo/.test(t)), 'quedó el texto de la lámina copiada');
  });
  assert.equal(String(paginas[8].objects.find((o) => o.type === 'textbox')!.text), 'LA SALIDA', 'el título va en el titular');
  // Sin textos, la nueva copia el diseño y deja los textos de la otra afuera (lo que se agregue va solo).
  const sola = aplicarOperaciones({ doc: carruselDeOcho(), vista, nuevoId: () => `x-${++n}`, activePageId: 'p8', operaciones: [op({ op: 'agregar_pagina' })] });
  const nueva = (sola.doc.pages as unknown as Array<{ background: Obj; objects: Obj[] }>).at(-1)!;
  assert.deepEqual(nueva.background, { type: 'solid', color: '#1F1F1F' });
  assert.equal(nueva.objects.filter((o) => o.type === 'textbox').length, 0);
  assert.equal(nueva.objects.filter((o) => o.type === 'image').length, 1);
});

test('11 · sin IA, cada lámina de guía lleva SU parte del copy, tantas como partes y sin una palabra de la guía', () => {
  // «Antes y después» va de 5 a 8 láminas: el copy de Leila (10) no puede quedar cortado en 8.
  const guias = tipoCarrusel('antes-despues')!.estructura(8);
  const partes = partesDelCopy(COPY_DE_LEILA)!;
  const ls = laminasConElCopy(guias, partes);
  assert.equal(ls.length, 10, 'salieron las láminas del tipo, no las del copy');
  partes.forEach((p, i) => {
    assert.equal(ls[i].titulo, p.lineas[0], `la lámina ${i + 1} no abre con su primer renglón`);
    assert.equal(ls[i].cuerpo, [...p.lineas.slice(1), ...(p.abajo ? [p.abajo] : [])].join('\n'), `la lámina ${i + 1} no dice su parte`);
    assert.equal(ls[i].rotulo, '', 'quedó el rótulo de la guía');
  });
  const dicho = ls.map((l) => `${l.titulo} ${l.cuerpo}`).join(' ');
  assert.deepEqual(palabras(dicho), palabras(COPY_DE_LEILA), 'falta o sobra una palabra del copy');
  for (const g of guias) for (const t of [g.titulo, g.cuerpo]) if (t.trim().length > 12) assert.ok(!dicho.includes(t), `quedó la guía «${t}»`);
  // La portada y el cierre conservan su diseño (el rol); las del medio, las del medio.
  assert.equal(ls[0].rol, guias[0].rol);
  assert.equal(ls[9].rol, guias[7].rol);
  assert.equal(LAMINAS_DEL_COPY, LAMINAS_MAX, 'el tope del copy se separó del de la réplica');
  assert.equal(laminasConElCopy(guias, []).length, 8, 'sin copy, las guías como siempre');
});

test('12 · el guiado dice las láminas que salen: las del copy, no las del ejemplo (y un anuncio sigue en una)', () => {
  const r0 = respuestasPorDefecto(HECHOS);
  const r = { ...escribir(HECHOS, { ...r0, listo: false }, COPY_DE_LEILA), oferta: { id: 1, nombre: 'MetaCoach' }, cambio: 'textos' as const };
  assert.match(resumenDe(HECHOS, r), /^10 láminas/, 'el resumen dice las del ejemplo (7)');
  const pregunta = preguntaDe(HECHOS, r);
  assert.ok(pregunta && JSON.stringify(pregunta).includes('Generar las 10 láminas'), 'el botón dice 7 con un copy de 10');
  assert.match(resumenDe(HECHOS, r0), /^7 láminas/, 'sin copy, las del ejemplo');
  assert.match(resumenDe({ ...HECHOS, laminas: 1, anuncio: true }, r), /^Una lámina/, 'un anuncio no se vuelve 10 láminas');
});

test('13 · el sello «01/05» del copy no es una marca de lámina ni corre los renglones de abajo', () => {
  const copy = 'Slide 1\nPáginas que venden\ncópialas\n\nSlide 2\n01/05\npágina\nHormozi\nPOR QUÉ VENDE\n\nSlide 3\n02/05\npágina\nDotCom Secrets\nPOR QUÉ VENDE';
  const partes = partesDelCopy(copy)!;
  assert.equal(partes.length, 3, 'el «01/05» abrió otra lámina');
  assert.deepEqual(partes[1].lineas, ['01/05', 'página', 'Hormozi', 'POR QUÉ VENDE'], 'el sello desapareció del copy');
  // Sin «Slide N», «1/3» sigue siendo la marca de cada lámina.
  assert.equal(partesDelCopy('1/3\nUno\n2/3\nDos\n3/3\nTres')!.length, 3);

  // La lámina 2 de @textura.us: el sello «01/05» (del marco: no recibe), el «prompt» a mano, el nombre y la etiqueta.
  const lugares = [
    { rol: 'rotulo', x: 0.5, y: 0.09 }, { rol: 'rotulo', x: 0.3, y: 0.13 }, { rol: 'titulo', x: 0.55, y: 0.14 }, { rol: 'rotulo', x: 0.1, y: 0.72 },
  ];
  const fijos = ['01/05', 'prompt', 'Auralis', 'PROMPT'];
  const noRecibe = [true, false, false, false];
  assert.deepEqual(repartirEnLosTextos(partes[1], lugares, { noRecibe, fijos }), [null, 'página', 'Hormozi', 'POR QUÉ VENDE'],
    'el «01/05» corrió los renglones un lugar');
  // La lámina 3 usa el mismo diseño: su «02/05» va al sello, que cambia.
  assert.deepEqual(repartirEnLosTextos(partes[2], lugares, { noRecibe, fijos }), ['02/05', 'página', 'DotCom Secrets', 'POR QUÉ VENDE']);
});
