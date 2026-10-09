// =============================================================================
// Mover las tarjetas del lienzo de /chatbot, y el ＋ en cualquier punto de una flecha
// =============================================================================
// Pedido literal de Martín (09/10/2026, quinta tanda, punto 2): «Por alguna razón ya no está la
// opción de insertar un delay o condición algo en medio de una flecha... Y tampoco se puede mover
// las tarjetas libremente por el lienzo.»
//
//   · (a) el ＋ del medio no se había roto: vivía en un cuadrado invisible de 28 px y la flecha no
//     reaccionaba fuera de él. Ahora la flecha entera es zona de toque (app/_components/Lienzo.tsx).
//   · (b) /chatbot nunca pudo mover tarjetas: `FlujoLienzo` no le pasaba `onMover` al lienzo. Ahora
//     las posiciones se guardan en `nutricion_secuencias.posiciones` (mig 0233), relativas al CRON
//     derivado (lib/lienzo-posiciones.ts), por su propia acción (lib/secuencia-posiciones.ts).
//
// PROBADO ROMPIÉNDOLO (09/10/2026; con todo puesto: 12 pasan, 0 fallan). Cada rotura de a una,
// aplicada y restaurada DE MEMORIA por un arnés (nunca con `git checkout`). Pasan / fallan:
//   1. `conPosiciones` guarda ABSOLUTO (sin sumar la base del CRON)                    ->  9 / 3
//   2. `moverRelativo` mide contra el CRON YA movido en vez del derivado               -> 11 / 1
//   3. `moverRelativo` sin podar                                                        -> 11 / 1
//   4. `sanearPosiciones` sin redondear ni topear                                       ->  9 / 3
//   5. la lectura TIRA con la columna que falta (en vez de devolver null)               -> 11 / 1
//   6. la escritura trata la columna que falta como un error cualquiera (tira)          -> 11 / 1
//   7. `FlujoLienzo` sin `onMover` (lo de antes del punto 2)                            -> 11 / 1
//   8. el hook guarda aunque no se hayan podido leer (`inicial == null`)                -> 11 / 1
//   9. Publicar manda también las posiciones                                            -> 11 / 1
//  10. la zona de toque con `vectorEffect` y sin dividir por el zoom                    -> 11 / 1
//  11. el arrastre vuelve a mover sólo la tarjeta (sin el envoltorio)                    -> 11 / 1
//  12. soltar vuelve a reencuadrar (sin `trasMover`)                                     -> 11 / 1
//
// Correr: node --import tsx --test tests/lienzo-posiciones.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanearPosiciones, conPosiciones, moverRelativo, podarPosiciones, LIMITE_POSICION, type Posiciones } from '../lib/lienzo-posiciones';
import { podarPosiciones as podarDeAviso } from '../lib/flujo-aviso';
import { leerPosicionesSecuencias, guardarPosicionesSecuencia, TOPE_POSICIONES, type DbPosiciones } from '../lib/secuencia-posiciones';
import { grafoDeSecuencia, ID_ENTRADA, type PasoParaGrafo, type NodoFlujo } from '../lib/flujo-conversacion';
import { ID_INICIO, TOPE_NODOS } from '../lib/flujo-grafo';
import type { GrafoFlujo } from '../lib/lienzo-grafo';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const msg = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...extra });
const inicio = (siguiente: string | null, paralelos: string[]): PasoParaGrafo => ({ id: ID_INICIO, nodo: 'inicio', siguiente, paralelos, canal: 'whatsapp', delay_horas: 0, cuerpo: '' });
const nodo = (g: { nodos: NodoFlujo[] }, id: string): NodoFlujo => { const n = g.nodos.find((x) => x.id === id); assert.ok(n, `no está el nodo ${id}`); return n; };
const grafo = (pasos: PasoParaGrafo[]): GrafoFlujo => grafoDeSecuencia(pasos, { disparador: 'A mano' });

// ── El modelo puro ──────────────────────────────────────────────────────────────

test('sanear: sólo `id → {x, y}` con números finitos, redondeados, topeados y con tope de entradas', () => {
  const p = sanearPosiciones({
    entrada: { x: 10.6, y: -3.2 }, n4f9k2a: { x: '40', y: 7 },
    'mal id con espacios': { x: 1, y: 1 }, sinY: { x: 1 }, infinito: { x: Infinity, y: 0 }, lejos: { x: 1e9, y: -1e9 },
    nulo: null,
  });
  assert.deepEqual(p, { entrada: { x: 11, y: -3 }, n4f9k2a: { x: 40, y: 7 }, lejos: { x: LIMITE_POSICION, y: -LIMITE_POSICION } });
  assert.deepEqual(sanearPosiciones([1, 2]), {}, 'un array no es un mapa');
  assert.deepEqual(sanearPosiciones('{"a":1}'), {}, 'un string no se parsea: lo que llega ya viene como objeto');
  const muchas = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`n${i}`, { x: i, y: i }]));
  assert.equal(Object.keys(sanearPosiciones(muchas, TOPE_POSICIONES)).length, TOPE_NODOS + 1, 'una por tarjeta más la del CRON');
});

test('sin posiciones, el MISMO grafo: un flujo que nadie tocó se dibuja idéntico a antes', () => {
  const g = grafo([msg('m1', { siguiente: 'm2' }), msg('m2'), inicio('m1', [])]);
  assert.equal(conPosiciones(g, undefined), g);
  assert.equal(conPosiciones(g, {}), g);
  assert.equal(conPosiciones(g, { fantasma: { x: 1, y: 1 } }), g, 'una posición de una tarjeta que no está no cambia nada');
});

test('soltar y volver a dibujar deja la tarjeta EXACTAMENTE donde se soltó (ida y vuelta por el CRON)', () => {
  const g = grafo([msg('m1', { siguiente: 'm2' }), msg('m2'), inicio('m1', [])]);
  const pos = moverRelativo(g, {}, 'm2', 900, 640, ID_ENTRADA);
  const cron = nodo(g, ID_ENTRADA);
  assert.deepEqual(pos, { m2: { x: 900 - cron.x, y: 640 - cron.y } }, 'se guarda el desplazamiento desde el CRON, no el absoluto');
  const movido = conPosiciones(g, pos, ID_ENTRADA);
  assert.deepEqual([nodo(movido, 'm2').x, nodo(movido, 'm2').y], [900, 640]);
  assert.deepEqual([nodo(movido, 'm1').x, nodo(movido, 'm1').y], [nodo(g, 'm1').x, nodo(g, 'm1').y], 'las que no se movieron, donde las puso el árbol');
  assert.ok(movido.ancho >= 900 + nodo(g, 'm2').ancho, 'la caja del dibujo crece con la tarjeta movida (el encuadre la cuenta)');
});

test('RELATIVA AL CRON: si una rama nueva corre el dibujo, la tarjeta movida viaja con el CRON', () => {
  // Sin paralelos el CRON queda en el margen; con dos flechas en paralelo sus hijos se apilan
  // centrados en él, el primero ARRIBA, y `aOrigen` baja el dibujo entero (también al CRON).
  const solo = grafo([msg('m1', { siguiente: 'm2' }), msg('m2'), msg('e1'), msg('f1'), inicio('m1', [])]);
  const conRamas = grafo([msg('m1', { siguiente: 'm2' }), msg('m2'), msg('e1'), msg('f1'), inicio('m1', ['e1', 'f1'])]);
  const dy = nodo(conRamas, ID_ENTRADA).y - nodo(solo, ID_ENTRADA).y;
  assert.ok(dy > 0, `el caso no prueba nada: el CRON no se corrió (dy = ${dy})`);
  const pos: Posiciones = { m2: { x: 700, y: 300 } };
  const a = nodo(conPosiciones(solo, pos, ID_ENTRADA), 'm2');
  const b = nodo(conPosiciones(conRamas, pos, ID_ENTRADA), 'm2');
  assert.equal(b.y - a.y, dy, 'la tarjeta movida se despegó del CRON cuando el dibujo se corrió');
  assert.equal(b.x - a.x, nodo(conRamas, ID_ENTRADA).x - nodo(solo, ID_ENTRADA).x);
});

test('mover el CRON guarda SU desplazamiento y no arrastra a las demás', () => {
  const g = grafo([msg('m1', { siguiente: 'm2' }), msg('m2'), inicio('m1', [])]);
  const p1 = moverRelativo(g, {}, 'm2', 900, 640, ID_ENTRADA);
  const p2 = moverRelativo(g, p1, ID_ENTRADA, 5, 500, ID_ENTRADA);
  const movido = conPosiciones(g, p2, ID_ENTRADA);
  assert.deepEqual([nodo(movido, ID_ENTRADA).x, nodo(movido, ID_ENTRADA).y], [5, 500]);
  assert.deepEqual([nodo(movido, 'm2').x, nodo(movido, 'm2').y], [900, 640], 'mover el CRON movió otra tarjeta');
  // Y se mide contra el DERIVADO: volver a soltar m2 donde está no la corre.
  assert.deepEqual(moverRelativo(g, p2, 'm2', 900, 640, ID_ENTRADA).m2, p2.m2);
});

test('PODADA: al soltar, la posición de una tarjeta que ya no existe no sobrevive', () => {
  const g = grafo([msg('m1'), inicio('m1', [])]);
  const pos = moverRelativo(g, { borrada: { x: 1, y: 1 }, m1: { x: 0, y: 0 } }, 'm1', 400, 100, ID_ENTRADA);
  assert.deepEqual(Object.keys(pos), ['m1']);
  // Y la poda es UNA: la de /mensajes es la misma función (se re-exporta).
  assert.equal(podarDeAviso, podarPosiciones);
});

// ── La base: la columna que falta no rompe nada ─────────────────────────────────

type Lectura = { data?: Array<{ id: number; posiciones: unknown }>; error?: { code?: string; message?: string } | null };
type Escritura = { data?: Array<{ id: number }>; error?: { code?: string; message?: string } | null };
const dbFalsa = (o: { leer?: Lectura; escribir?: Escritura; anotar?: (fila: Record<string, unknown>) => void }): DbPosiciones => ({
  from: () => ({
    select: () => ({ is: () => Promise.resolve({ data: o.leer?.data ?? [], error: o.leer?.error ?? null }) }),
    update: (fila) => {
      o.anotar?.(fila);
      return { eq: () => ({ select: () => Promise.resolve({ data: o.escribir?.data ?? [{ id: 7 }], error: o.escribir?.error ?? null }) }) };
    },
  }),
});
const callado = async <T>(fn: () => Promise<T>): Promise<T> => {
  const w = console.warn;
  console.warn = () => {};
  try { return await fn(); } finally { console.warn = w; }
};

test('leer: el mapa por id, saneado; la columna que falta o un error = null («no se pudieron leer»), nunca vacío', async () => {
  const m = await leerPosicionesSecuencias(dbFalsa({ leer: { data: [
    { id: 7, posiciones: { m1: { x: 1.4, y: 2 } } }, { id: 8, posiciones: null }, { id: 9, posiciones: 'basura' },
  ] } }));
  assert.ok(m);
  assert.deepEqual([...m.entries()], [[7, { m1: { x: 1, y: 2 } }]], 'una fila sin nada guardado no entra');
  for (const error of [{ code: '42703', message: 'column nutricion_secuencias.posiciones does not exist' }, { code: 'PGRST204' }, { code: '08006', message: 'conexión caída' }]) {
    assert.equal(await callado(() => leerPosicionesSecuencias(dbFalsa({ leer: { error } }))), null, `con ${error.code} tiene que devolver null`);
  }
});

test('guardar: saneado, vacío = null, la columna que falta = `sin_columna` (no tira), otro error tira, sin fila = no_existe', async () => {
  let escrito: Record<string, unknown> | null = null;
  const r = await guardarPosicionesSecuencia(dbFalsa({ anotar: (f) => { escrito = f; } }), 7, { m1: { x: 3.6, y: 4 }, 'x y': { x: 1, y: 1 } });
  assert.deepEqual(r, { ok: true, posiciones: { m1: { x: 4, y: 4 } } });
  assert.deepEqual(escrito, { posiciones: { m1: { x: 4, y: 4 } } }, 'sólo la columna `posiciones`: ni `pasos`, ni `estrategia`, ni `updated_at`');
  await guardarPosicionesSecuencia(dbFalsa({ anotar: (f) => { escrito = f; } }), 7, {});
  assert.deepEqual(escrito, { posiciones: null }, 'ninguna movida se guarda como null');
  assert.deepEqual(await callado(() => guardarPosicionesSecuencia(dbFalsa({ escribir: { error: { code: '42703', message: 'no existe' } } }), 7, {})), { ok: false, motivo: 'sin_columna' });
  assert.deepEqual(await guardarPosicionesSecuencia(dbFalsa({ escribir: { data: [] } }), 7, {}), { ok: false, motivo: 'no_existe' });
  await assert.rejects(guardarPosicionesSecuencia(dbFalsa({ escribir: { error: { code: '08006', message: 'caída' } } }), 7, {}), /caída/);
});

// ── El cableado: quién guarda qué, y por dónde ──────────────────────────────────

test('el lienzo de /chatbot mueve: `onMover` con `moverRelativo` sobre el DERIVADO, y lo movido se dibuja', () => {
  const fl = sinComentarios(leer('../app/chatbot/FlujoLienzo.tsx'));
  assert.match(fl, /const grafo = conPosiciones\(derivado, posiciones, ID_ENTRADA\);/);
  assert.match(fl, /onMover=\{onPosiciones \? \(id, x, y\) => onPosiciones\(moverRelativo\(derivado, posiciones, id, x, y, ID_ENTRADA\)\) : undefined\}/,
    'FlujoLienzo no le pasa `onMover` al lienzo: las tarjetas no se agarran (lo de antes del punto 2)');
  const sp = sinComentarios(leer('../app/chatbot/SecuenciaPerfil.tsx'));
  assert.match(sp, /usePosicionesLienzo\(secuencia\.id, secuencia\.posiciones, \{ puedeGuardar: rolAdmin, onError: setErr \}\)/);
  assert.match(sp, /posiciones=\{lugares\.posiciones\} onPosiciones=\{rolAdmin \? lugares\.mover : undefined\}/);
});

test('las posiciones se guardan por SU acción: ni Publicar, ni `setSecuenciaPasos`, ni la estrategia', () => {
  const sp = sinComentarios(leer('../app/chatbot/SecuenciaPerfil.tsx'));
  const publicar = sp.slice(sp.indexOf('const publicar = async'), sp.indexOf('const abrirGuiaSiFalta'));
  assert.ok(publicar.length > 400 && publicar.length < 4000, `el recorte de Publicar mide ${publicar.length}: está mirando otra cosa`);
  assert.doesNotMatch(publicar, /posiciones|lugares/, 'Publicar manda las posiciones: el layout pasaría por `validarGrafo` y por «Sin publicar»');
  for (const f of ['../lib/nutricion.ts', '../lib/setting-estrategia.ts']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /posiciones/, `${f} conoce las posiciones: se perderían en el saneo campo por campo`);
  }
  const hook = sinComentarios(leer('../app/chatbot/usePosicionesLienzo.ts'));
  assert.match(hook, /action: 'posiciones', secuenciaId, posiciones: pos/);
  assert.match(hook, /const guardable = useRef\(opts\.puedeGuardar && inicial != null\);/,
    'sin haberlas leído, guardar un mapa que arrancó vacío pisa lo que la persona ya acomodó');
  const ruta = sinComentarios(leer('../app/api/chat-agent/secuencias/route.ts'));
  assert.match(ruta, /if \(body\.action === 'posiciones'\) \{[\s\S]{0,400}guardarPosicionesSecuencia\(/);
  const mig = leer('../supabase/migrations/0233_secuencia_posiciones.sql');
  assert.match(mig, /add column if not exists posiciones jsonb;/);
  assert.match(mig, /ORDEN DE DESPLIEGUE: ANTES DEL DEPLOY/);
});

test('(a) la flecha ENTERA enciende su ＋: trazo de toque, `stroke`, y el ancho dividido por el ZOOM', () => {
  const src = sinComentarios(leer('../app/_components/Lienzo.tsx'));
  const i = src.indexOf('data-toque-flecha');
  assert.ok(i > 0, 'se fue la zona de toque de las flechas: el ＋ sólo aparece en un cuadrado de 28 px');
  const toque = src.slice(src.lastIndexOf('<path', i), src.indexOf('/>', i));
  assert.match(toque, /strokeWidth=\{\(TOQUE_FLECHA \* 100\) \/ zoomTxt\}/, 'la franja volvió a medirse en unidades del grafo (al 40 % mide 6 px)');
  assert.match(toque, /pointerEvents: 'stroke'/);
  assert.match(toque, /onPointerEnter=\{\(\) => entrarFlecha\(i\)\} onPointerLeave=\{\(\) => salirFlecha\(i\)\}/);
  assert.doesNotMatch(src, /vectorEffect|vector-effect/, '`non-scaling-stroke` no compensa el `scale` de CSS de la capa (medido: 6,5 px)');
  assert.match(src, /const TOQUE_FLECHA = 1[46];/);
});

test('(b) el arrastre: delta / zoom, mueve el ENVOLTORIO con las flechas, y soltar no reencuadra', () => {
  const src = sinComentarios(leer('../app/_components/Lienzo.tsx'));
  const mov = src.slice(src.indexOf('function onPointerMove'), src.indexOf('function onPointerUp'));
  assert.match(mov, /movido\.current = \{ id: g\.nodo, x: g\.nx0 \+ dx \/ k, y: g\.ny0 \+ dy \/ k \};/, 'el delta del mouse no se divide por la escala');
  assert.match(mov, /pintarArrastre\(g\.nodo, dx \/ k, dy \/ k\);/);
  const pintar = src.slice(src.indexOf('function pintarArrastre'), src.indexOf('const soltarArrastre'));
  assert.match(pintar, /\[data-envoltorio="\$\{id\}"\]/, 'el arrastre mueve sólo la tarjeta: sus salidas y su ＋ se quedan atrás');
  assert.match(pintar, /\[data-arista="\$\{i\}"\]/, 'las flechas no siguen a la tarjeta');
  assert.match(src, /<div key=\{n\.id\} data-envoltorio=\{n\.id\}/);
  const up = src.slice(src.indexOf('function onPointerUp'), src.indexOf('const nodoSel ='));
  assert.match(up, /trasMover\.current = true;[\s\S]{0,120}onMover\?\.\(/);
  assert.match(src, /if \(!forzar && trasMover\.current\) \{ trasMover\.current = false; encuadrado\.current = firma; return; \}/,
    'soltar una tarjeta reencuadra el lienzo y deshace el paneo');
});
