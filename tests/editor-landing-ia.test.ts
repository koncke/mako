// =============================================================================
// La IA del editor de landings: lo que decide sin hablar con ningún modelo
// =============================================================================
// lib/editor-landing/ia.ts es `server-only` y no se puede importar acá; lo que decide
// qué le llega a la persona vive en lib/editor-landing/ia-reglas.ts (puro) y se
// prueba directo. Lo de ia.ts que no se puede ejecutar (el cableado de los prompts,
// la puerta de las rutas) se lee del FUENTE, normalizado a LF y sin comentarios
// (AGENTS.md: en un worktree los fuentes llegan en CRLF, y un `doesNotMatch` sobre
// un fuente con comentarios se acusa a sí mismo).
//
// Cada test se probó ROMPIENDO lo que persigue; el resultado de la rotura va en el
// comentario de cada uno, con números (fallos / pases de ESE test, corrido solo con
// --test-name-pattern). Medido el 11/10/2026: 30 roturas, las 30 dieron 1 fallo y 0 pases.
//
// Correr: node --import tsx --test tests/editor-landing-ia.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cortarPegado, esquemaConservado, sanearEsquema, esquemaDelPedido, tandasDe, indicesValidos, pedidoDeTanda,
  ordenarPorIndice, sanearNodo, emparejarEdicion, convertirEdicion, seccionesParaEditar, objetoConUnaReparacion,
  SalidaInvalida, resolverBusquedas, sinStockEnPersonas, quitarPruebaInventada, elegirAlternativas,
  prepararAlternativa, bajarTitulo, tarjetaDesdeEsquema, normalizarParams, slotsDe, PROMPTS_EDITOR,
  MAX_POR_TANDA, MAX_REPARACIONES, type SeccionGramatica,
} from '../lib/editor-landing/ia-reglas';
import { ATTRS_TARJETA_DEFAULT, NODO, textoDe, type JsonNodo } from '../lib/editor-landing/doc';
import { CATALOGO_MODELOS } from '../lib/model-catalogo';
import { IA_FEATURE_LABEL } from '../lib/ia-labels';
import { CLAUDE_PERMITIDO } from '../lib/veto-claude';

const leer = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (un `/*` dentro de un `//` no abre nada). */
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── helpers de armado ────────────────────────────────────────────────────────
const p = (texto: string): JsonNodo => ({ type: 'paragraph', content: [{ type: 'text', text: texto }] });
const tarj = (id: string, contenido: JsonNodo[], attrs: Record<string, unknown> = {}): JsonNodo => ({
  type: NODO.tarjeta, attrs: { ...ATTRS_TARJETA_DEFAULT, ...attrs, id }, content: contenido,
});
type SecFake = SeccionGramatica & { bloques: { t: string; texto: string }[] };
/** Un `bloquesATarjeta` de mentira que hace lo que el de verdad promete con `base`: conserva el id y los atributos. */
const convertirFake = (t: SecFake, base: JsonNodo | null): JsonNodo => ({
  type: NODO.tarjeta,
  attrs: { ...ATTRS_TARJETA_DEFAULT, ...(base?.attrs ?? {}), id: (base?.attrs?.id as string) ?? t.id ?? 't1' },
  content: t.bloques.map((b) => p(b.texto)),
});

// ─────────────────────────────────────────────────────────────────────────────
// Pegar texto: los `---` cortan secciones
// ─────────────────────────────────────────────────────────────────────────────

// Roto cambiando el patrón del corte por `/^---$/m` (sin espacios ni CRLF): 1 fallo, 0 pases.
test('los `---` cortan secciones: con espacios, con CRLF, con más guiones, y nada más', () => {
  const texto = 'Hola mundo\r\nprimera\r\n---\r\n# Segunda\nlínea\n  ----  \nTercera\n---\n\n---\n';
  assert.deepEqual(cortarPegado(texto), ['Hola mundo\nprimera', '# Segunda\nlínea', 'Tercera']);
  // Un `---` en el MEDIO de una línea no corta: es texto.
  assert.deepEqual(cortarPegado('uno --- dos\ntres'), ['uno --- dos\ntres']);
  assert.deepEqual(cortarPegado(''), []);
});

// Roto recortando cada punto de `esquemaConservado` a 200 caracteres (un recorte «inofensivo»):
// 1 fallo, 0 pases — en «Conservar» el punto ES el texto de la persona.
test('«Conservar»: cada trozo es una sección y su texto llega INTACTO en los puntos', () => {
  const largo = 'Esto es un párrafo largo de la persona que no se puede recortar ni reescribir. '.repeat(6).trim();
  const e = esquemaConservado(`# Hero de la página\n${largo}\n---\n## Beneficios\n- Rápido\n- Barato`);
  assert.equal(e.secciones.length, 2);
  assert.equal(e.titulo, 'Hero de la página');
  assert.deepEqual(e.secciones[0], { titulo: 'Hero de la página', puntos: [largo] });
  assert.deepEqual(e.secciones[1], { titulo: 'Beneficios', puntos: ['Rápido', 'Barato'] });
  // Sin `---`, corta por títulos; sin títulos tampoco, una sola sección.
  assert.equal(esquemaConservado('# A\nuno\n# B\ndos').secciones.length, 2);
  assert.equal(esquemaConservado('solo texto\nsin cortes').secciones.length, 1);
});

// Roto sacando el relleno con `exactas` en sanearEsquema: 1 fallo, 0 pases.
test('con N trozos, el esquema tiene EXACTAMENTE N secciones aunque el modelo devuelva otra cantidad', () => {
  const exactas = esquemaConservado('A\nuno\n---\nB\ndos\n---\nC\ntres');
  const corto = sanearEsquema({ titulo: 'X', secciones: [{ titulo: 'a', puntos: ['1'] }, { titulo: 'b', puntos: ['2'] }] }, { exactas });
  assert.equal(corto.secciones.length, 3);
  assert.equal(corto.secciones[2].titulo, 'C', 'la que faltó sale del corte determinista');
  const largo = sanearEsquema({ secciones: Array.from({ length: 5 }, (_, i) => ({ titulo: `s${i}`, puntos: [] })) }, { exactas });
  assert.equal(largo.secciones.length, 3);
  // Sin corte, se respeta lo que vino (dentro del tope) y se tiran las vacías.
  const libre = sanearEsquema({ secciones: [{ titulo: '', puntos: [] }, { titulo: 'ok', puntos: ['x'] }] });
  assert.deepEqual(libre.secciones, [{ titulo: 'ok', puntos: ['x'] }]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Secciones: el pedido por tandas
// ─────────────────────────────────────────────────────────────────────────────

// Roto con `tam` sin tope (tandasDe(7, 5) devolvía tandas de 5): 1 fallo, 0 pases.
test('las tandas son de a tres, en orden, y la pantalla no puede pedir más', () => {
  assert.equal(MAX_POR_TANDA, 3);
  assert.deepEqual(tandasDe(7), [[0, 1, 2], [3, 4, 5], [6]]);
  assert.deepEqual(tandasDe(3), [[0, 1, 2]]);
  assert.deepEqual(tandasDe(0), []);
  assert.deepEqual(tandasDe(7, 5), [[0, 1, 2], [3, 4, 5], [6]], 'un tamaño mayor se acota a tres');
});

// Roto recortando con `.slice(0, MAX_POR_TANDA)` en vez de devolver el error: 1 fallo, 0 pases
// (un recorte en silencio deja a la pantalla esperando la cuarta).
test('los índices de un pedido: sin repetir, dentro del esquema, ordenados, y más de tres es un ERROR', () => {
  assert.deepEqual(indicesValidos([2, 0, 2, '1', 9, -1, 1.5], 5), { ok: true, indices: [0, 1, 2] });
  assert.equal(indicesValidos([0, 1, 2, 3], 10).ok, false);
  assert.equal(indicesValidos([], 10).ok, false);
  assert.equal(indicesValidos('0,1', 10).ok, false);
});

// Roto mandando los puntos de TODAS las secciones en `pedidas`: 1 fallo, 0 pases.
test('cada tanda ve la página entera por títulos y el detalle SOLO de lo que escribe', () => {
  const e = { titulo: 'Mi landing', secciones: ['Hero', 'Problema', 'Solución', 'Precio', 'Cierre'].map((t, i) => ({ titulo: t, puntos: [`punto-${i}`] })) };
  const t = pedidoDeTanda(e, [3, 4]);
  for (const s of e.secciones) assert.ok(t.esquema.includes(s.titulo), `falta «${s.titulo}» en el mapa`);
  assert.match(t.esquema, />>> \[3\] Precio/);
  assert.doesNotMatch(t.esquema, />>> \[0\]/);
  assert.ok(t.pedidas.includes('punto-3') && t.pedidas.includes('punto-4'));
  assert.ok(!t.pedidas.includes('punto-0') && !t.esquema.includes('punto-0'), 'los puntos de otra tanda no viajan');
  assert.match(t.pedidas, /CIERRE/);
});

// Roto emparejando solo por posición (sin mirar `indice`): 1 fallo, 0 pases.
test('lo que vuelve se ordena por el índice pedido; lo que falta queda en `faltan`', () => {
  const vino: SecFake[] = [{ indice: 5, bloques: [] }, { indice: 3, bloques: [] }, { indice: 99, bloques: [] }];
  const r = ordenarPorIndice(vino, [3, 4, 5]);
  assert.deepEqual(r.secciones.map((s) => [s.indice, (s.tarjeta as SecFake).indice]), [[3, 3], [4, 99], [5, 5]]);
  assert.deepEqual(r.faltan, []);
  assert.deepEqual(ordenarPorIndice([{ bloques: [] }], [0, 1, 2]).faltan, [1, 2]);
});

// Roto con `tarjetaDesdeEsquema` devolviendo una tarjeta vacía: 1 fallo, 0 pases. Roto con
// `bajarTitulo` sin bajar nada (la condición en `false`): 1 fallo, 0 pases.
test('la sección que faltó sale del esquema, y fuera de la primera no hay «Título» grande', () => {
  const t = tarjetaDesdeEsquema({ titulo: 'Beneficios', puntos: ['Rápido', 'Barato'] }, false);
  assert.equal(t.type, NODO.tarjeta);
  assert.match(textoDe(t), /Beneficios[\s\S]*Rápido[\s\S]*Barato/);
  const hero = tarjetaDesdeEsquema({ titulo: 'Hero', puntos: [] }, true);
  assert.equal(hero.content?.[0].attrs?.variante, 'titulo');
  const bajada = bajarTitulo(hero);
  assert.equal(bajada.content?.[0].attrs?.variante, null);
  assert.equal(bajada.content?.[0].attrs?.level, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Validación determinista de la salida
// ─────────────────────────────────────────────────────────────────────────────

// Roto quitando la línea de `variante` del `case NODO.optimizado` de sanearNodo: 1 fallo, 0 pases.
test('una variante, un tono o un diseño fuera de su lista cerrada vuelve a su default; lo desconocido se cae', () => {
  const crudo: JsonNodo = tarj('t1', [
    { type: NODO.optimizado, attrs: { variante: 'inventada', columnas: '9' }, content: [{ type: NODO.optimizadoItem, content: [p('a')] }] },
    { type: NODO.recuadro, attrs: { tono: 'violeta' }, content: [p('b')] },
    { type: 'heading', attrs: { level: 9 }, content: [{ type: 'text', text: 'h', marks: [{ type: 'parpadeo' }, { type: 'bold' }] }] },
    { type: 'slide', content: [p('no existe')] },
  ], { diseno: 'diagonal', fondoColor: 'rojo' });
  const n = sanearNodo(crudo)!;
  assert.equal(n.attrs?.diseno, 'sin');
  assert.equal(n.attrs?.fondoColor, null);
  assert.equal(n.content?.[0].attrs?.variante, 'vinetas-grandes');
  assert.equal(n.content?.[0].attrs?.columnas, 'auto');
  assert.equal(n.content?.[1].attrs?.tono, 'info');
  assert.equal(n.content?.[2].attrs?.level, 2);
  assert.deepEqual(n.content?.[2].content?.[0].marks, [{ type: 'bold' }]);
  assert.equal(n.content?.length, 3, 'el nodo «slide» no existe en doc.ts: se descarta');
});

// ─────────────────────────────────────────────────────────────────────────────
// «Edición con IA»: bloqueadas respetadas, ids conservados
// ─────────────────────────────────────────────────────────────────────────────

// Roto sacando el `continue` de la bloqueada en emparejarEdicion: 1 fallo, 0 pases.
// Roto quitando la reasignación de id de una nueva que choca (convertirEdicion): 1 fallo, 0 pases.
test('una bloqueada no se toca; las editadas conservan su id; las nuevas no pisan ninguno', () => {
  const originales = [
    tarj('t1', [p('uno')], { imagenSrc: 'https://x/y.webp', notas: 'mis notas' }),
    tarj('t2', [p('dos')], { bloqueadaIA: true }),
    tarj('t3', [p('tres')]),
  ];
  const vino: SecFake[] = [
    { id: 't2', bloques: [{ t: 'p', texto: 'DOS PISADO' }] },        // bloqueada → fuera
    { id: 't1', bloques: [{ t: 'p', texto: 'uno nuevo' }] },
    { id: 't1', bloques: [{ t: 'p', texto: 'uno otra vez' }] },      // repetida → vale la primera
    { id: 't3', bloques: [{ t: 'p', texto: 'tres nuevo' }] },
    { id: 'inventado', bloques: [{ t: 'p', texto: 'sección nueva' }] },
  ];
  const { pares, descartes } = emparejarEdicion(vino, originales);
  assert.equal(pares.length, 3);
  assert.equal(descartes.length, 2);
  assert.ok(descartes.some((d) => /bloqueada/.test(d)));
  assert.equal(pares[2].base, null);
  assert.equal(pares[2].tarjeta.id, undefined, 'a una nueva se le borra el id que trajo');

  // Un convertidor que, para la nueva, devuelve el id de una que ya existe: no puede quedar.
  const res = convertirEdicion(pares, originales, (t, base) => (base ? convertirFake(t, base) : { ...convertirFake(t, null), attrs: { ...ATTRS_TARJETA_DEFAULT, id: 't3' } }));
  const ids = res.tarjetas.map((t) => t.attrs?.id);
  assert.deepEqual(ids.slice(0, 2), ['t1', 't3']);
  assert.ok(!['t1', 't2', 't3'].includes(String(ids[2])), `la nueva quedó con un id ajeno: ${String(ids[2])}`);
  assert.deepEqual(res.nuevas, [ids[2]]);
  assert.ok(!res.tarjetas.some((t) => textoDe(t).includes('PISADO')));
  assert.equal(res.tarjetas[0].attrs?.imagenSrc, 'https://x/y.webp', 'lo que la gramática no expresa vuelve del original');
  assert.equal(res.tarjetas[0].attrs?.notas, 'mis notas');
});

// Roto sacando el caso `unaSola` de emparejarEdicion: 1 fallo, 0 pases.
test('con UNA sola sección mandada, la que vuelve sin id (o con uno inventado) es ésa', () => {
  const originales = [tarj('tA', [p('a')])];
  const { pares } = emparejarEdicion<SecFake>([{ bloques: [{ t: 'p', texto: 'a2' }] }, { id: 'zzz', bloques: [{ t: 'p', texto: 'nueva' }] }], originales);
  assert.equal(pares[0].base?.attrs?.id, 'tA');
  assert.equal(pares[0].tarjeta.id, 'tA');
  assert.equal(pares[1].base, null, 'la segunda ya no puede ser la misma: es nueva');
});

// Roto mandando las bloqueadas con su contenido: 1 fallo, 0 pases.
test('al modelo, una bloqueada le llega SOLO con su título', () => {
  const v = seccionesParaEditar([tarj('t1', [p('libre')]), tarj('t2', [p('secreto de la bloqueada')], { bloqueadaIA: true })], (t) => ({ id: t.attrs?.id, bloques: ['x'] }));
  assert.deepEqual(v[1], { id: 't2', bloqueada: true, titulo: 'secreto de la bloqueada' });
  assert.ok(!('bloques' in v[1]));
});

// ─────────────────────────────────────────────────────────────────────────────
// UNA reparación, nunca más
// ─────────────────────────────────────────────────────────────────────────────

// Roto cambiando MAX_REPARACIONES a 3: 1 fallo, 0 pases (llamó 3 veces). Roto devolviendo
// `{}` en vez de tirar al final: 1 fallo, 0 pases (el JSON inválido «pasaba», la trampa de presenton).
test('el JSON se repara sin red; si no alcanza, UN solo pedido de reparación y después se falla', async () => {
  assert.equal(MAX_REPARACIONES, 1);
  let llamadas = 0;
  const reparar = async () => { llamadas++; return 'sigue roto {'; };

  assert.deepEqual(await objetoConUnaReparacion('{"a":1}', reparar), { a: 1 });
  assert.deepEqual(await objetoConUnaReparacion('```json\n{"a":["x" "y"],}\n```', reparar), { a: ['x', 'y'] }, 'la coma que falta y la que sobra se arreglan sin red');
  assert.equal(llamadas, 0, 'un JSON válido o reparable no gasta un pedido');

  await assert.rejects(objetoConUnaReparacion('esto no es json', reparar), (e: unknown) => e instanceof SalidaInvalida && e.crudo === 'esto no es json');
  assert.equal(llamadas, 1, 'una sola reparación');

  let otra = 0;
  const bien = await objetoConUnaReparacion('nada', async () => { otra++; return '{"ok":true}'; });
  assert.deepEqual(bien, { ok: true });
  assert.equal(otra, 1);

  let tira = 0;
  await assert.rejects(objetoConUnaReparacion('nada', async () => { tira++; throw new Error('429'); }), SalidaInvalida);
  assert.equal(tira, 1, 'si la reparación tira, no se reintenta');
});

// ─────────────────────────────────────────────────────────────────────────────
// Imágenes: paralelo acotado, la que falla no tumba nada, y nada de stock en personas
// ─────────────────────────────────────────────────────────────────────────────

// Roto con `limite` ignorado (un trabajador por búsqueda): 1 fallo, 0 pases.
test('las búsquedas van de a dos, sin repetir, y la que falla queda fuera del mapa sin tirar', async () => {
  let enVuelo = 0;
  let maximo = 0;
  const vistas: string[] = [];
  const buscar = async (q: string) => {
    vistas.push(q);
    enVuelo++; maximo = Math.max(maximo, enVuelo);
    await new Promise((r) => setTimeout(r, 15));
    enVuelo--;
    if (q === 'falla') throw new Error('red');
    if (q === 'nada') return null;
    return `https://bucket/${q}.webp`;
  };
  const mapa = await resolverBusquedas(['a', 'b', 'a', 'falla', 'nada', 'c', 'd'], buscar, { limite: 2 });
  assert.equal(maximo, 2);
  assert.equal(vistas.length, 6, 'la repetida no se busca dos veces');
  assert.deepEqual([...mapa.keys()].sort(), ['a', 'b', 'c', 'd']);
  // Pasado el plazo no arranca ninguna nueva.
  const tarde = await resolverBusquedas(['x', 'y'], buscar, { hastaMs: Date.now() - 1 });
  assert.equal(tarde.size, 0);
});

// Roto sacando 'equipo' de VARIANTES_SIN_STOCK: 1 fallo, 0 pases.
test('el equipo, las caras de los testimonios y los logos no se buscan en stock (también dentro de columnas)', () => {
  const t = sinStockEnPersonas({
    bloques: [
      { t: 'optimizado', variante: 'equipo', items: [{ titulo: 'Ana', texto: 'CEO', imagen: 'smiling woman' }] },
      { t: 'optimizado', variante: 'galeria', items: [{ titulo: 'Oficina', texto: '', imagen: 'office' }] },
      { t: 'columnas', columnas: [[{ t: 'optimizado', variante: 'logos', items: [{ titulo: 'X', texto: '', imagen: 'logo' }] }]] },
    ],
  });
  const b = t.bloques as Array<Record<string, any>>;
  assert.equal('imagen' in b[0].items[0], false);
  assert.equal(b[1].items[0].imagen, 'office', 'una galería sí lleva fotos de stock');
  assert.equal('imagen' in b[2].columnas[0][0].items[0], false);
});

// Roto haciendo que `citaRespaldada` devuelva siempre true: 1 fallo, 0 pases.
test('una cita o una cifra que no están en el material se vacían; las que sí están se quedan', () => {
  const material = 'Somos una agencia con más de 300 clientes. María dijo: «Me cambiaron el negocio en tres meses».';
  const t = tarj('t1', [
    { type: 'blockquote', content: [p('Me cambiaron el negocio en tres meses')] },
    { type: 'blockquote', content: [p('El mejor servicio que contraté en mi vida, cinco estrellas')] },
    { type: NODO.optimizado, attrs: { variante: 'numeros-grandes' }, content: [
      { type: NODO.optimizadoItem, attrs: { valor: '300+' }, content: [p('clientes')] },
      { type: NODO.optimizadoItem, attrs: { valor: '97%' }, content: [p('satisfacción')] },
    ] },
  ]);
  const { tarjeta, quitados } = quitarPruebaInventada(t, material);
  assert.equal(quitados, 2);
  assert.match(textoDe(tarjeta.content![0]), /tres meses/);
  assert.equal(textoDe(tarjeta.content![1]), '', 'la cita inventada queda vacía');
  assert.equal(tarjeta.content![2].content![0].attrs?.valor, '300+');
  assert.equal(tarjeta.content![2].content![1].attrs?.valor, '', 'el 97% no está en el material');

  // Los MARCADORES que pide la gramática cuando falta la prueba son honestos y se quedan.
  // Roto sacando la línea del marcador de `citaRespaldada`: 1 fallo, 0 pases.
  const conMarcadores = quitarPruebaInventada(tarj('t2', [
    { type: 'blockquote', content: [p('[Testimonio real de un cliente sobre el servicio]')] },
    { type: NODO.optimizado, attrs: { variante: 'numeros-grandes' }, content: [{ type: NODO.optimizadoItem, attrs: { valor: '[00]%' }, content: [p('x')] }] },
  ]), material);
  assert.equal(conMarcadores.quitados, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// «Probar nuevo diseño»: el texto se conserva
// ─────────────────────────────────────────────────────────────────────────────

// Roto sacando el chequeo `conservaElTexto` de elegirAlternativas: 1 fallo, 0 pases.
test('las alternativas conservan el texto, no repiten la forma actual y salen con el id de la original', () => {
  const original = tarj('tO', [p('Tres pasos para ordenar tus finanzas sin contador'), p('Registra, clasifica y revisa cada semana')]);
  const mismaForma: SecFake = { bloques: [{ t: 'p', texto: 'Tres pasos para ordenar tus finanzas sin contador' }, { t: 'p', texto: 'Registra, clasifica y revisa cada semana' }] };
  const reescrita: SecFake = { bloques: [{ t: 'p', texto: 'Una forma distinta de decir algo totalmente nuevo y diferente' }] };
  const otraForma: SecFake = { bloques: [{ t: 'h2', texto: 'Tres pasos para ordenar tus finanzas sin contador' }, { t: 'p', texto: 'Registra, clasifica y revisa cada semana' }] };
  const convertir = (t: SecFake): JsonNodo => tarj('cualquiera', t.bloques.map((b) => (b.t === 'h2' ? { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: b.texto }] } : p(b.texto))));
  const descartes: string[] = [];
  const opciones = elegirAlternativas([mismaForma, reescrita, otraForma, otraForma], original, convertir, descartes);
  assert.equal(opciones.length, 1);
  assert.equal(opciones[0].attrs?.id, 'tO');
  assert.equal(descartes.length, 3);
  // Sin imagen, una alternativa no puede pedir un acento ni traer una búsqueda.
  const prep = prepararAlternativa<SeccionGramatica>({ diseno: 'derecha', imagen: 'office', bloques: [] }, original);
  assert.equal(prep.diseno, 'sin');
  assert.equal('imagen' in prep, false);
  assert.equal(prep.id, 'tO');
});

// ─────────────────────────────────────────────────────────────────────────────
// Parámetros, catálogo y etiquetas
// ─────────────────────────────────────────────────────────────────────────────

// Roto sin el tope de `cantidad`: 1 fallo, 0 pases.
test('los parámetros del navegador quedan dentro de sus listas y topes', () => {
  const n = normalizarParams({ cantidad: 99, textoPorSeccion: 'gigante' as never, objetivo: 'hackear' as never, fuenteImagenes: 'url' as never, modoTexto: 'conservar', instrucciones: 'x'.repeat(9_000) });
  assert.equal(n.cantidad, 20);
  assert.equal(n.textoPorSeccion, 'medio');
  assert.equal(n.objetivo, 'agendar');
  assert.equal(n.fuenteImagenes, 'stock');
  assert.equal(n.modoTexto, 'conservar');
  assert.equal(n.instrucciones.length, 5_000);
  assert.equal(normalizarParams(undefined).idioma, 'es-MX');
  assert.equal(esquemaDelPedido({ secciones: [] }), null);
});

// Roto poniendo `fallback: []` en landing-editor: 1 fallo, 0 pases.
test('las dos features: gratis (Gemini), sin `pagoPorque`, sin `fallback: []`, con etiqueta y fuera del permiso de Claude', () => {
  for (const f of ['landing-editor', 'landing-editor-ia']) {
    const fila = CATALOGO_MODELOS.find((m) => m.feature === f);
    assert.ok(fila, `falta ${f} en lib/model-catalogo.ts`);
    assert.equal(fila!.def.provider, 'gemini');
    assert.equal(fila!.pagoPorque, undefined);
    assert.equal(fila!.fallback, undefined);
    assert.ok(IA_FEATURE_LABEL[f], `falta la etiqueta de ${f} en lib/ia-labels.ts`);
    assert.ok(!CLAUDE_PERMITIDO.some((x) => x.feature === f), `${f} no puede tener permiso de Claude`);
  }
  const ia = sinComentarios(leer('lib/editor-landing/ia.ts'));
  assert.match(ia, /export const FEATURE_GENERAR = 'landing-editor';/);
  assert.match(ia, /export const FEATURE_EDITAR = 'landing-editor-ia';/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Prompts: el registro, los defaults y los call sites dicen lo mismo
// ─────────────────────────────────────────────────────────────────────────────

/** El objeto literal que sigue a `desde` (de su `{` a su `}`), sin entrar en strings ni template literals. */
function objetoTras(src: string, desde: number): string {
  const a = src.indexOf('{', desde);
  let prof = 0;
  for (let i = a; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') prof++;
    if (c === '}' || c === ')' || c === ']') { prof--; if (prof === 0) return src.slice(a, i + 1); }
  }
  throw new Error('objeto sin cerrar');
}

/** Las claves de primer nivel de un objeto literal (`clave: …` o la abreviada `clave,`). */
function clavesDe(obj: string): string[] {
  const out: string[] = [];
  let prof = 0;
  let token = '';
  for (let i = 0; i < obj.length; i++) {
    const c = obj[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < obj.length && obj[i] !== c; i++) if (obj[i] === '\\') i++;
      token = '';
      continue;
    }
    if ('{(['.includes(c)) { prof++; token = ''; continue; }
    if ('})]'.includes(c)) { if (prof === 1 && /^\w+$/.test(token.trim())) out.push(token.trim()); prof--; token = ''; continue; }
    if (prof !== 1) continue;
    if (c === ':') { if (/^\w+$/.test(token.trim())) out.push(token.trim()); token = '\u0000'; continue; }
    if (c === ',') { if (/^\w+$/.test(token.trim())) out.push(token.trim()); token = ''; continue; }
    if (token !== '\u0000') token += c;
  }
  return out;
}

const ALIAS: Record<string, string> = {
  esquemaSystem: 'LANDING_EDITOR_ESQUEMA_SYSTEM', esquemaUser: 'LANDING_EDITOR_ESQUEMA_USER',
  seccionesSystem: 'LANDING_EDITOR_SECCIONES_SYSTEM', seccionesUser: 'LANDING_EDITOR_SECCIONES_USER',
  editarSystem: 'LANDING_EDITOR_EDITAR_SYSTEM', editarUser: 'LANDING_EDITOR_EDITAR_USER',
  textoSystem: 'LANDING_EDITOR_TEXTO_SYSTEM', textoUser: 'LANDING_EDITOR_TEXTO_USER',
  disenosSystem: 'LANDING_EDITOR_DISENOS_SYSTEM', disenosUser: 'LANDING_EDITOR_DISENOS_USER',
  notasSystem: 'LANDING_EDITOR_NOTAS_SYSTEM', notasUser: 'LANDING_EDITOR_NOTAS_USER',
};

// Roto borrando `v('diagnostico', …)` de la fila del registro: 1 fallo, 0 pases. Roto cambiando
// la key de notas.user en el registro a 'landing_editor.notas.usuario': 1 fallo, 0 pases.
test('cada prompt del editor está en el registro con SU key, SU default y exactamente SUS slots', () => {
  const reg = sinComentarios(leer('lib/prompt-registry.ts'));
  const reglas = leer('lib/editor-landing/ia-reglas.ts');
  assert.match(reg, /group: 'Editor de landings \(Landing Generator\)'/);
  assert.match(reg, /from '\.\/editor-landing\/ia-reglas';/);
  for (const [nombre, { key, tpl }] of Object.entries(PROMPTS_EDITOR)) {
    const i = reg.indexOf(`key: '${key}'`);
    assert.ok(i > 0, `falta ${key} en lib/prompt-registry.ts`);
    const fila = reg.slice(i, reg.indexOf('context:', i));
    assert.match(fila, new RegExp(`default: ${ALIAS[nombre]},`), `${key}: el default no es la constante de ia-reglas`);
    // El alias del registro apunta a LA plantilla de este prompt, y PROMPTS_EDITOR también.
    const constante = nombre.replace(/([A-Z])/g, '_$1').toUpperCase() + '_TEMPLATE';
    assert.ok(reg.includes(`${constante} as ${ALIAS[nombre]},`) || reg.includes(`${constante} as ${ALIAS[nombre]}\n`), `${key}: el alias no es ${constante}`);
    assert.ok(reglas.includes(`${nombre}: { key: '${key}', tpl: ${constante} }`), `${nombre}: PROMPTS_EDITOR no usa ${constante}`);
    const declaradas = [...fila.matchAll(/v\('(\w+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(declaradas, slotsDe(tpl).sort(), `${key}: las variables del registro no son los slots de la plantilla`);
    assert.match(fila, /source: 'override'/);
  }
});

// Roto borrando `diagnostico,` del renderPrompt del esquema en ia.ts: 1 fallo, 0 pases (slot sin dato).
test('ia.ts resuelve cada prompt con PROMPTS_EDITOR y le pasa exactamente sus slots', () => {
  const ia = sinComentarios(leer('lib/editor-landing/ia.ts'));
  for (const [nombre, { tpl }] of Object.entries(PROMPTS_EDITOR)) {
    const ref = nombre.endsWith('System') ? `system(PROMPTS_EDITOR.${nombre},` : `renderPrompt(PROMPTS_EDITOR.${nombre}.key, PROMPTS_EDITOR.${nombre}.tpl,`;
    const i = ia.indexOf(ref);
    assert.ok(i >= 0, `ia.ts no resuelve ${nombre} con «${ref}»`);
    const claves = clavesDe(objetoTras(ia, i + ref.length)).sort();
    assert.deepEqual(claves, slotsDe(tpl).sort(), `${nombre}: lo que se le pasa no son los slots de la plantilla`);
    assert.equal(ia.indexOf(ref, i + 1), -1, `${nombre} se resuelve dos veces`);
  }
  // Ningún prompt del editor escrito a mano por fuera del registro.
  assert.doesNotMatch(ia, /renderPrompt\('/);
});

// Roto escribiendo 'podés' en la plantilla de notas: 1 fallo, 0 pases.
test('los prompts no nombran formas rioplatenses (el guard de voseo barre lib/) y piden el copy de tú', () => {
  // Límites por Unicode y no `\b` (que es ASCII): con `\b`, «mirá» no matchea nunca (AGENTS.md).
  const RIOPLATENSE = /(?<!\p{L})(vos|tenés|querés|podés|sabés|sos|mirá|tocá|escribí|devolvé|usá|poné|agregá)(?!\p{L})/iu;
  for (const { key, tpl } of Object.values(PROMPTS_EDITOR)) assert.doesNotMatch(tpl, RIOPLATENSE, key);
  const reglas = leer('lib/editor-landing/ia-reglas.ts');
  assert.match(reglas, /tratando al lector de «tú»/);
});

// Tanda 6 (pendiente de la tanda 2: «"Probar nuevo diseño" no recibe el formato»): en una
// presentación proponía secciones de página. Roturas (14/10/2026, el archivo entero con la base en
// 25 pasan / 0 fallan; en las cinco el que falla es éste):
//   · ia.ts: `esDiapositivas(undefined)` (el formato no se mira, lo de antes)  -> 24 pasan / 1 falla
//   · la ruta no pasa `params` a disenos                                       -> 24 / 1
//   · el system recibe FORMATO_DISENOS solo (sin las reglas)                   -> 24 / 1
//   · la regla de diapositiva copiada de editar («si no entra, pártelo en dos») -> 24 / 1
//   · api-tipos sin `params` en el pedido de disenos                           -> 24 / 1
test('«Probar nuevo diseño» recibe el formato: diapositivas en una presentación, sin contradecir el pedido', () => {
  const tipos = sinComentarios(leer('lib/editor-landing/api-tipos.ts'));
  assert.match(tipos, /\{ accion: 'disenos'; tarjeta: JsonNodo; params\?: Partial<ParamsGeneracion> \}/);
  const ruta = sinComentarios(leer('app/api/landing-generator/ia/route.ts'));
  assert.match(ruta, /disenos\(\{ tarjeta: body\.tarjeta, params: body\.params \}\)/);
  const ia = sinComentarios(leer('lib/editor-landing/ia.ts'));
  const i = ia.indexOf('export async function disenos(');
  const fn = ia.slice(i, ia.indexOf('\nexport async function notas(', i));
  assert.ok(i > 0 && fn.length > 300);
  assert.match(fn, /const formato = `\$\{FORMATO_DISENOS\}\\n\$\{esDiapositivas\(p\.params\) \? REGLAS_DISENOS\.diapositiva : REGLAS_DISENOS\.pagina\}`;/);
  assert.match(fn, /system\(PROMPTS_EDITOR\.disenosSystem, \{ gramatica: GRAMATICA_IA, formato \}\)/);
  // Las reglas: una presentación es UNA diapositiva y no se parte; una landing no es una presentación.
  const reglas = ia.slice(ia.indexOf('const REGLAS_DISENOS = {'), ia.indexOf('} as const;', ia.indexOf('const REGLAS_DISENOS = {')));
  const diapositiva = /diapositiva: '([^']+)'/.exec(reglas)?.[1] ?? '';
  const pagina = /pagina: '([^']+)'/.exec(reglas)?.[1] ?? '';
  assert.match(diapositiva, /PRESENTACIÓN/);
  assert.match(diapositiva, /entrar ENTERA en la diapositiva/);
  assert.match(diapositiva, /No la partas en dos/, 'cada tarjeta devuelta es UNA alternativa');
  assert.match(pagina, /NO es una presentación/);
  for (const r of [diapositiva, pagina]) {
    assert.doesNotMatch(r, /p[áa]rtelo|copy que una p[áa]gina necesita/i, 'una regla de editar que acá contradice el pedido');
    assert.doesNotMatch(r, /(?<!\p{L})(vos|tenés|querés|podés|partí|armá)(?!\p{L})/iu);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Las rutas
// ─────────────────────────────────────────────────────────────────────────────

// Roto sacando el `tabEnCapa` de la ruta de IA: 1 fallo, 0 pases.
test('las dos rutas: admin + la tab en la capa, maxDuration 300, sin server actions; importar es multipart con tope', () => {
  for (const ruta of ['app/api/landing-generator/ia/route.ts', 'app/api/landing-generator/importar/route.ts']) {
    const src = sinComentarios(leer(ruta));
    assert.match(src, /if \(rol !== 'admin'\)/, ruta);
    assert.match(src, /tabEnCapa\('landing-writer', await getCapaActual\(\)\)/, ruta);
    assert.match(src, /export const maxDuration = 300;/, ruta);
    assert.doesNotMatch(src, /['"]use server['"]/, ruta);
  }
  const ia = sinComentarios(leer('app/api/landing-generator/ia/route.ts'));
  for (const a of ['esquema', 'secciones', 'editar', 'texto', 'disenos', 'notas']) assert.match(ia, new RegExp(`case '${a}':`), a);
  const imp = sinComentarios(leer('app/api/landing-generator/importar/route.ts'));
  assert.match(imp, /req\.formData\(\)/);
  assert.match(imp, /archivoATexto\(file\)/);
  const tope = Number(imp.match(/TOPE_IMPORTAR_BYTES = (\d+) \* 1024 \* 1024/)?.[1]);
  assert.ok(tope > 0 && tope < 18, `el tope (${tope} MB) tiene que quedar por debajo de los ~18 MB del proxy`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Con el convertidor DE VERDAD (lib/editor-landing/ia-bloques.ts, paquete C)
// ─────────────────────────────────────────────────────────────────────────────
// Los de arriba usan un convertidor de mentira para fijar las reglas de este módulo
// sin depender de otro; éste corre la cadena entera de «Edición con IA» como la arma
// ia.ts: comoTarjetasIA → emparejarEdicion → convertirEdicion(bloquesATarjeta con base).
// El src del bucket tiene que parecerse al de verdad: `srcImagen` (especificacion.ts)
// solo deja pasar URLs del bucket público, que arma con NEXT_PUBLIC_SUPABASE_URL.

// Roto haciendo que convertirEdicion le pase `null` como base a la conversión: 1 fallo, 0 pases
// (la imagen y las notas del original se pierden). Roto cambiando el formato de la edición a
// `{"resumen":…,"secciones":…}`: 1 fallo, 0 pases (la gramática pide «tarjetas»).
test('la cadena real de una edición: bloqueada intacta, id e imagen conservados, variante inválida corregida', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
  const { bloquesATarjeta, comoTarjetasIA, GRAMATICA_IA } = await import('../lib/editor-landing/ia-bloques');
  const { FORMATO_SECCIONES, FORMATO_EDITAR, FORMATO_DISENOS } = await import('../lib/editor-landing/ia-reglas');
  const src = 'https://abc.supabase.co/storage/v1/object/public/landing-imagenes/3/foto-hero.webp';
  const originales = [
    tarj('t1', [p('uno')], { diseno: 'derecha', imagenSrc: src, notas: 'mis notas' }),
    tarj('t2', [p('dos')], { bloqueadaIA: true }),
  ];
  const raw = {
    resumen: 'Cambié el título.',
    tarjetas: [
      { id: 't2', bloques: [{ t: 'p', texto: 'PISADO' }] },
      { id: 't1', bloques: [{ t: 'h2', texto: 'Nuevo **título**' }, { t: 'optimizado', variante: 'inventada', items: [{ titulo: 'a', texto: 'b' }] }] },
      { id: 't2-falso', bloques: [{ t: 'p', texto: 'una sección nueva' }] },
    ],
  };
  const descartes: string[] = [];
  const { pares, descartes: d0 } = emparejarEdicion(comoTarjetasIA(raw), originales);
  const res = convertirEdicion(pares, originales, (t, base) => bloquesATarjeta(t, { base, descartes }), [...d0, ...descartes]);
  assert.equal(res.tarjetas.length, 2);
  assert.ok(!res.tarjetas.some((t) => textoDe(t).includes('PISADO')), 'la bloqueada no se tocó');
  const t1 = res.tarjetas[0];
  assert.equal(t1.attrs?.id, 't1');
  assert.equal(t1.attrs?.imagenSrc, src);
  assert.equal(t1.attrs?.notas, 'mis notas');
  assert.equal(t1.content?.find((n) => n.type === NODO.optimizado)?.attrs?.variante, 'vinetas-grandes');
  assert.equal(res.nuevas.length, 1);
  assert.ok(!['t1', 't2', 't2-falso'].includes(String(res.nuevas[0])));
  // Los formatos de cada pedido hablan el mismo JSON que la gramática.
  assert.match(GRAMATICA_IA, /\{"tarjetas":\[/);
  for (const f of [FORMATO_SECCIONES, FORMATO_EDITAR, FORMATO_DISENOS]) assert.match(f, /"tarjetas"/);
});
