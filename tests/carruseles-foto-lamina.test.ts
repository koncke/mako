// La foto de una lámina con gente, armada por la IA de IMAGEN del negocio (lib/carruseles/foto-lamina.ts), con el
// ORQUESTADOR corriendo de verdad: la cola de Flow, la puerta del puente, el prompt que se le manda y el compare-and-set del
// diseño. El hijo (tests/_carruseles-foto-lamina-hijo.ts) lo corre contra una base y un Storage de mentira.
//
// Por qué no alcanzaba con los tests puros: lo que decide si esto sirve no es `fotosAGenerar` (eso está en
// tests/carruseles-replica.test.ts) — es si al pedido LE LLEGA la cara como referencia, si se frena cuando el navegador del
// cliente no está, y si la foto que vuelve termina adentro del diseño en el lugar que se le reservó.
//
// Probado rompiéndolo (6/11/2026) — base 48 / 0 contando los tres archivos del área (replica + editar + éste); una rotura por
// vez, los rojos MEDIDOS:
//   · la foto del cliente va donde haya CUALQUIER persona (el bug del encargo 387)                 → 1 rojo;
//   · se le pide a la IA de imagen también lo que NO es gente                                      → 1 rojo;
//   · se genera «al dueño» sin tener su cara de referencia                                        → 1 rojo;
//   · no se reserva el lugar de la foto que está por llegar                                        → 2 rojos;
//   · no se pregunta por el puente antes de encolar (`puedeGenerarFotos`)                          → 1 rojo;
//   · el puente en cualquier estado sirve (sacar el latido y `usaInterfaz`)                        → 1 rojo;
//   · se manda la cara del dueño también en la lámina de otra persona                              → 1 rojo;
//   · se guarda en el documento la url que devolvió Flow, sin copiar la foto a «Subidos»            → 3 rojos;
//   · la foto generada va ENCIMA de los textos (al final de `objects`)                             → 1 rojo;
//   · un trabajo que todavía está en curso se suelta igual                                        → 1 rojo;
//   · un trabajo `fallido` se trata como listo                                                     → 1 rojo;
//   · el lector exige la clave en español (el bug de `texts`, medido con la IA real)               → 1 rojo;
//   · el prompt no pregunta QUIÉN está en la foto                                                  → 3 rojos;
//   · y un cambio SIN efecto (renombrar `anotar`)                                                  → 48 verdes, como tiene que ser.
//
// ⚠️ «Se manda la cara también en la lámina ajena» daba CERO rojos con la primera versión de este archivo, y enseña algo: con un
// solo pedido de «otra persona», `cara` ni se busca, así que el pedido sale igual con el bug puesto. Lo que hay que correr es
// el caso MIXTO — las dos láminas en el mismo diseño (`mixta`).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

type Trabajo = { tipo: string; prompt: string; referencias: string[]; ruta: string; vertical: boolean };
type Objeto = { type: string; name: string; src?: string; left?: number; top?: number };
type Salida = {
  trabajos: Trabajo[]; pedidas: number; nota: string | null; pendientes: number;
  asentar?: { puestas: number; caidas: number }; paginas?: Objeto[][]; subidos?: number; subidas?: string[]; red?: string[];
};

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_carruseles-foto-lamina-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, Salida> & { error?: string; rutaValida?: boolean };

/** El bloque de identidad que `promptFinal` (lib/flow-imagen.ts) pone SÓLO cuando va una cara de referencia. */
const IDENTIDAD = /identity reference/i;

test('la foto de una lámina con OTRA persona se le pide a la IA de imagen, y sin la cara del dueño', () => {
  assert.equal(R.error, undefined, String(R.error));
  const c = R.ajena;
  assert.equal(c.pedidas, 1);
  assert.equal(c.trabajos.length, 1);
  assert.equal(c.trabajos[0].tipo, 'generar_imagen');
  assert.deepEqual(c.trabajos[0].referencias, [], 'no es el dueño: su cara NO va como referencia de identidad');
  assert.doesNotMatch(c.trabajos[0].prompt, IDENTIDAD, 'sin referencia no se le pide respetar una cara que no mandamos');
  assert.match(c.trabajos[0].prompt, /No lettering/, 'la escena viaja entera');
  assert.match(c.trabajos[0].prompt, /iPhone/, 'y el método de la casa lo pone el código, no el modelo');
  assert.equal(c.trabajos[0].vertical, true, 'una lámina 4:5 es vertical');
  assert.equal(R.rutaValida, true, 'la ruta de subida tiene la forma que el puente sabe firmar (`RUTA_SUBIDA`)');
  assert.equal(c.pendientes, 1, 'queda anotado para asentarlo cuando llegue');
  assert.match(String(c.nota), /armando/, 'y la persona se entera de que la foto está en camino');
});

test('la foto de la lámina de SU autor va con la cara del dueño como referencia de identidad', () => {
  const c = R.suya;
  assert.equal(c.pedidas, 1);
  assert.deepEqual(c.trabajos[0].referencias, ['media-de-la-cara'], 'el mediaId de su foto dentro de Flow');
  assert.match(c.trabajos[0].prompt, IDENTIDAD, 'con la foto puesta, se le pide que RESPETE esa cara');
});

test('las dos láminas en el mismo diseño: la de su autor lleva su cara, la de otra persona NO', () => {
  const imagenes = R.mixta.trabajos.filter((t) => t.tipo === 'generar_imagen');
  assert.equal(R.mixta.pedidas, 2);
  assert.deepEqual(imagenes.map((t) => t.referencias), [['media-de-la-cara'], []], 'una con su cara y la otra sin ninguna');
  assert.deepEqual(imagenes.map((t) => IDENTIDAD.test(t.prompt)), [true, false], 'y el bloque de identidad va sólo en la que manda una cara');
});

test('si su cara todavía se está subiendo a Flow, esa lámina se saltea y la otra igual se pide', () => {
  const c = R.caraEnVuelo;
  const imagenes = c.trabajos.filter((t) => t.tipo === 'generar_imagen');
  assert.equal(c.pedidas, 1, 'una de las dos');
  assert.deepEqual(imagenes.map((t) => t.referencias), [[]], 'la que salió es la que no necesitaba su cara');
  assert.doesNotMatch(imagenes[0].prompt, IDENTIDAD);
  // Y de paso su foto ARRANCÓ para arriba: `caraDeFoto` encola la subida, así que el próximo «Editar» ya la tiene.
  assert.ok(c.trabajos.some((t) => t.tipo === 'subir_imagen'), `la cara se empieza a subir: ${c.trabajos.map((t) => t.tipo).join(' ')}`);
});

test('sin el navegador del cliente no se promete nada: ni un trabajo encolado ni un lugar reservado esperando', () => {
  for (const [nombre, c] of [['sinPuente', R.sinPuente], ['extensionVieja', R.extensionVieja]] as const) {
    assert.equal(c.pedidas, 0, nombre);
    assert.deepEqual(c.trabajos, [], `${nombre}: un trabajo que nadie va a tomar deja la lámina esperando para siempre`);
    assert.equal(c.pendientes, 0, `${nombre}: y nada anotado`);
    assert.equal(c.nota, null, `${nombre}: tampoco se le avisa de una foto que no viene`);
  }
});

test('la foto que devolvió el navegador se COPIA a «Subidos» y se asienta en su lámina, DETRÁS de los textos', () => {
  const c = R.asentada;
  assert.deepEqual(c.asentar, { puestas: 1, caidas: 0 });
  assert.equal(c.subidos, 1, 'quedó en «Subidos» del Image Editor: el diseño la guarda y se puede cambiar');
  const lamina = (c.paginas ?? [])[1] ?? [];
  assert.equal(lamina[0]?.type, 'image', 'la foto es el fondo de la lámina: va primera, no encima del titular');
  assert.match(lamina[0].name, /tu IA/, 'y se llama por lo que es, para que el chat del editor la encuentre');
  assert.equal(lamina[0].left, 540, 'en el lugar que «Editar» le reservó');
  assert.equal(lamina[0].top, 135);
  assert.ok(lamina.some((o) => o.type === 'textbox'), 'el titular sigue ahí');
  assert.deepEqual((c.paginas ?? [])[0].map((o) => o.type), ['textbox'], 'la portada no se toca');
  assert.equal(c.pendientes, 0, 'y el pendiente se suelta');
});

test('la url firmada de Flow NUNCA se guarda en el documento: vence en horas y mañana la imagen sale rota', () => {
  const c = R.urlQueVence;
  const srcs = (c.paginas ?? []).flat().map((o) => o.src ?? '');
  assert.ok(!srcs.some((s) => /Expires=/.test(s)), `una url que vence adentro del diseño: ${srcs.join(' ')}`);
  assert.ok(!srcs.some((s) => /flow-content/.test(s)), 'ni la de Flow sin copiar');
  // Bajarla no se pudo (el host no existe en el test): el pendiente se queda y se reintenta. Lo que importa es que no se
  // escribió nada: una imagen rota se lee como que la app perdió el archivo, no como «venció un enlace».
  assert.equal(c.asentar?.puestas, 0);
});

test('un trabajo que falló se suelta y el diseño queda como estaba; uno en curso se vuelve a preguntar', () => {
  assert.deepEqual(R.fallida.asentar, { puestas: 0, caidas: 1 });
  assert.equal(R.fallida.pendientes, 0, 'un fallo terminal no se reintenta solo');
  assert.deepEqual((R.fallida.paginas ?? [])[1].map((o) => o.type), ['textbox'], 'el diseño no se tocó');

  assert.deepEqual(R.enCurso.asentar, { puestas: 0, caidas: 0 });
  assert.equal(R.enCurso.pendientes, 1, 'todavía generando: se pregunta la próxima vez que abran el diseño');
});

test('la foto se baja de NUESTRO Storage, nunca de un host que mandó el navegador sin pasar por la baranda', () => {
  const c = R.asentada;
  assert.ok((c.red ?? []).includes('supa.test'), 'la bajada salió por nuestro bucket');
  assert.ok((c.subidas ?? []).some((s) => /^image-editor\//.test(s)), `se subió al bucket del editor: ${(c.subidas ?? []).join(' ')}`);
});
