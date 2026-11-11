// =============================================================================
// «Lo que hace MaKo» en el Second Brain de los chats (lib/cerebro-funciones.ts, lib/cerebro-para-chat.ts) — 28/10/2026
// =============================================================================
// Martín: «Supongo que todos los chats ya extraen data del second brain, si no lo hacen está mal... y que sea eficiente
// justamente, por eso tenemos tipo grafo, sin gastar tantos tokens». Lo que fija:
//   1. el grafo de las funciones tiene la forma de siempre: una raíz que es estructura, un nodo `fn:<key>` por función,
//      sus áreas en la taxonomía y aristas que unen nodos que existen, sin repetir un par;
//   2. la vista local encuentra la función por cómo se la nombra («la bandeja», «respond.io», «CapCut»), barata;
//   3. pedida por id con profundidad 0 viaja ENTERA, con «Hace» y «No hace» (lo que va a leer el Web Generator);
//   4. `conCapa` hace UN cerebro: la carpeta cuelga de la raíz del negocio, el índice muestra las dos, nada se pierde y un
//      id que choca se prefija;
//   5. las herramientas del Second Brain leen `grafoParaChat` (sin física, con caché y con las funciones en la plataforma),
//      nunca `construirCerebro()` a secas.
//
// Probado rompiéndolo (28/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  bloquesDeFuncion, CAPA_FUNCIONES, catalogoCorto, funcionEntera, funcionesDeMako, funcionQueVende, ID_RAIZ_FUNCIONES, idFuncion, menciones,
  PUENTE_FUNCIONES, REGLA_FUNCION, ROTULO_MARCA, ROTULO_PERFIL,
} from '../lib/cerebro-funciones';
import { funcionDeKey, funcionesMako } from '../lib/funciones-mako';
import { esEstructura } from '../lib/cerebro-areas';
import { indiceDelCerebro, recuperar, tokensDe } from '../lib/cerebro-recuperar';
import { conCapa } from '../lib/cerebro-union';
import { CACHE_GRAFO_MS, grafoGuardado, guardarGrafo, invalidarGrafoChat } from '../lib/cerebro-cache-chat';
import type { Cerebro } from '../lib/cerebro-modelo';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('1. una raíz que es estructura, un nodo por función, sus áreas en la taxonomía y aristas sanas', () => {
  const g = funcionesDeMako();
  const raiz = g.nodos.find((n) => n.id === ID_RAIZ_FUNCIONES);
  assert.ok(raiz && esEstructura(raiz), 'la raíz de las funciones cuenta como un dato (el índice y la vista local la tomarían)');
  // La capa vive sólo en la plataforma: todas las funciones menos las que no van en ella.
  const fs = funcionesMako().filter((f) => !f.noEnPlataforma);
  assert.deepEqual(g.nodos.filter((n) => !esEstructura(n)).map((n) => n.id).sort(), fs.map((f) => idFuncion(f.key)).sort());
  const areas = new Set(g.taxonomia!.areas.map((a) => a.id));
  for (const n of g.nodos) assert.ok(areas.has(n.area), `${n.id}: su área ${n.area} no está en la taxonomía`);
  const ids = new Set(g.nodos.map((n) => n.id));
  const pares = new Set<string>();
  for (const a of g.aristas) {
    assert.ok(ids.has(a.de) && ids.has(a.a) && a.motivo.trim(), `arista rota ${a.de} → ${a.a}`);
    const par = [a.de, a.a].sort().join('|');
    assert.ok(!pares.has(par), `el par ${par} se repite`);
    pares.add(par);
  }
  assert.equal(g.taxonomia!.capas?.[0]?.id, CAPA_FUNCIONES);
  // La capa vive sólo en la plataforma: sin lo que no va en ella (MaKo Partners).
  assert.ok(!g.nodos.some((n) => n.id === 'fn:partners'), 'la capa de la plataforma trae MaKo Partners');
});

test('2. la vista local encuentra la función por cómo se la nombra, sin traer el catálogo entero', () => {
  const g = funcionesDeMako();
  for (const [pregunta, fn] of [
    ['hacé de esta copia la landing de los Chats', 'fn:chats'], ['qué reemplaza a respond.io', 'fn:chats'], ['qué no hace la bandeja', 'fn:chats'],
    ['el editor tipo CapCut', 'fn:video-editor'], ['cómo funciona el curso de mis alumnos', 'fn:customer-success'], ['quiero pautar en meta', 'fn:ads-manager'],
  ] as const) {
    const p = recuperar(g, { pregunta });
    assert.equal(p.modo, 'vista-local', `«${pregunta}» no sembró nada`);
    assert.equal(p.semillas[0], fn, `«${pregunta}» trajo primero ${p.semillas[0]}`);
    assert.ok(p.nodos.length < g.nodos.length - 1, `«${pregunta}» trajo el catálogo entero`);
  }
  // Las claves de los datos no siembran todas las funciones a la vez: «reemplaza» no es una clave, «En vez de» sí.
  assert.deepEqual(recuperar(g, { pregunta: 'qué reemplaza a respond.io' }).semillas, ['fn:chats']);
});

test('3. pedida por id con profundidad 0, la función viaja entera: qué hace y qué no hace', () => {
  const p = recuperar(funcionesDeMako(), { ids: ['fn:chats'], profundidad: 0 });
  assert.match(p.texto, /Hace:\n\s+- Una conversación por contacto/);
  assert.match(p.texto, /No hace:\n\s+- Llamadas de voz/);
  assert.match(p.texto, /En vez de: respond\.io/);
  assert.ok(p.tokens <= 600, `la función entera pesa ${p.tokens} tokens`);
});

test('4. conCapa hace UN cerebro: la carpeta cuelga de la raíz, el índice muestra las dos y nada se pierde', () => {
  const negocio: Cerebro<string> = {
    negocio: 'Negocio de prueba',
    nodos: [
      { id: 'raiz', area: 'norte', etiqueta: 'Negocio de prueba', detalle: '', fuente: '', autoria: 'usuario' },
      { id: 'prod:1', area: 'productos', etiqueta: 'Mentoría', detalle: 'La mentoría grupal', fuente: 'Offer', autoria: 'usuario' },
      { id: 'fn:chats', area: 'norte', etiqueta: 'Un dato que se llama igual', detalle: '', fuente: '', autoria: 'usuario' },
    ],
    aristas: [{ de: 'raiz', a: 'prod:1', motivo: 'Lo que vende' }],
    cuenta: { total: 2, mako: 0, usuario: 2, pendientes: 0 }, vacias: [], posiciones: {}, encuadre: { x: 0, y: 0, lado: 1 },
  };
  const fns = funcionesDeMako();
  const u = conCapa(negocio, fns, { id: CAPA_FUNCIONES, nombre: 'Lo que hace MaKo', raiz: ID_RAIZ_FUNCIONES, motivo: PUENTE_FUNCIONES });
  assert.equal(u.nodos.length, negocio.nodos.length + fns.nodos.length, 'se perdió un nodo');
  assert.equal(new Set(u.nodos.map((n) => n.id)).size, u.nodos.length, 'hay ids repetidos');
  assert.ok(u.nodos.some((n) => n.id === 'funciones:fn:chats'), 'el id que choca no se prefijó');
  assert.ok(u.aristas.some((a) => a.de === 'raiz' && a.a === ID_RAIZ_FUNCIONES && a.motivo === PUENTE_FUNCIONES), 'las funciones quedaron sueltas: dos cerebros');
  assert.equal(u.aristas.length, negocio.aristas.length + fns.aristas.length + 1);
  assert.deepEqual(u.taxonomia!.capas!.map((c) => c.id), ['negocio', CAPA_FUNCIONES]);
  const idx = indiceDelCerebro(u);
  assert.match(idx, /## Lo que hace MaKo/);
  assert.match(idx, /Mentoría|productos/i);
});

test('5. las herramientas del Second Brain leen grafoParaChat: sin física, con caché y con las funciones en la plataforma', () => {
  const run = fuente('lib/api-mako/areas/negocio.run.ts');
  const de = (op: string) => run.slice(run.indexOf(`${op}: {`), run.indexOf('\n  },', run.indexOf(`${op}: {`)));
  for (const op of ['indice_segundo_cerebro', 'recuperar_del_segundo_cerebro', 'buscar_en_segundo_cerebro']) {
    assert.match(de(op), /await grafoParaChat\(\)/, `${op} no lee el grafo de los chats`);
    assert.doesNotMatch(de(op), /construirCerebro\(/, `${op} rearma el mapa entero con su física`);
  }
  const chat = fuente('lib/cerebro-para-chat.ts');
  assert.match(chat, /construirCerebro\(\{ sinLayout: true, alFallar:/, 'el grafo de los chats corre la física (o no se entera de una lectura caída)');
  assert.match(chat, /wsSuperAdmin\(\)\.then\(\(s\) => s === ws, \(\) => false\)/, 'las funciones no se limitan a la plataforma (o fallan abiertas)');
  assert.match(chat, /return grafoGuardado<Cerebro<string>>\(ws\) \?\? guardarGrafo\(ws, armar\(ws\)\);/, 'sin caché: cada pedido rearma el grafo');
  assert.match(chat, /return \{ grafo, completo: cayeron\.length === 0 \};/, 'un grafo con una lectura caída se guarda igual');
  assert.doesNotMatch(chat, /construccionDeMako|cerebroUnido/, 'la capa Construcción no es para los chats');
  assert.match(fuente('lib/cerebro-grafo.ts'), /opciones\.sinLayout \? \{ posiciones: \{\}, encuadre: \{ x: 0, y: 0, lado: 1 \} \} : layoutCerebro\(nodos, aristas\)/);
});

test('6. la función que vende una landing: la que nombra el pedido; si no, la que la página nombra claramente; si no, ninguna', () => {
  for (const [pedido, pagina, fn] of [
    ['hacé de esta copia la landing de los Chats', '', 'chats'],
    ['la landing de la bandeja unificada', '', 'chats'],
    ['quiero la landing del Web Generator', '', 'landing-writer'],
    ['una landing para el editor tipo capcut', '', 'video-editor'],
    // «Cambia el hero» no nombra nada: la toma de la página, si ella nombra claramente una sola (una copia de respond.io).
    ['cambiá el hero', 'Turn conversations into customers. respond.io unifies WhatsApp, Instagram and Messenger in one inbox.', 'chats'],
  ] as const) {
    assert.equal(funcionQueVende({ pedido, pagina })?.key ?? null, fn, `«${pedido}» no eligió ${fn}`);
  }
  // Una landing de MaKo en general, un empate o nada: ninguna (no se ata la landing a una función por una palabra suelta).
  assert.equal(funcionQueVende({ pedido: 'cambiá el hero', pagina: 'MaKo: el CRM, los chats, las automatizaciones y el web generator en una sola app.' }), null);
  assert.equal(funcionQueVende({ pedido: 'la landing del CRM y los chats' }), null, 'un empate eligió una');
  assert.equal(funcionQueVende({ pedido: 'cambiá el hero' }), null);
  // «landing» habla de lo que se edita, no del Web Generator.
  assert.equal(menciones(funcionDeKey('landing-writer')!, 'cambia la landing'), 0);
  // Lo que sólo ve el super admin no se vende.
  assert.equal(funcionQueVende({ pedido: 'la landing de customers, los negocios de mako' }), null);
  // AI Avatar es de Pro desde el 29/10/2026: ya se vende. Desde el 11/11/2026 es parte de Video (Martín: «[AI Avatar] no debería
  // estar» en la barra; lib/funciones-mako.ts): una landing de AI Avatar vende la función Video.
  assert.equal(funcionQueVende({ pedido: 'la landing de AI Avatar como heygen' })?.key, 'video-editor');
});

test('7. el catálogo corto nombra todas las que se venden con lo que reemplazan, y la función entera viaja del grafo unido', () => {
  const corto = catalogoCorto();
  for (const x of ['Chats (en vez de respond.io)', 'Web Generator (en vez de Gamma)', 'Video (en vez de CapCut)', 'CRM', 'Automations']) assert.ok(corto.includes(x), `falta «${x}»`);
  assert.doesNotMatch(corto, /Reels|Customers/, 'nombra una función que sólo ve el super admin');
  assert.ok(tokensDe(corto) < 150, 'el catálogo corto dejó de ser corto');
  const negocio: Cerebro<string> = {
    negocio: 'MaKo', nodos: [{ id: 'raiz', area: 'norte', etiqueta: 'MaKo', detalle: '', fuente: '', autoria: 'usuario' }], aristas: [],
    cuenta: { total: 0, mako: 0, usuario: 0, pendientes: 0 }, vacias: [], posiciones: {}, encuadre: { x: 0, y: 0, lado: 1 },
  };
  const u = conCapa(negocio, funcionesDeMako(), { id: CAPA_FUNCIONES, nombre: 'Lo que hace MaKo', raiz: ID_RAIZ_FUNCIONES, motivo: PUENTE_FUNCIONES });
  const chats = funcionEntera(u, funcionDeKey('chats')!);
  assert.match(chats, /No hace:\n\s+- Llamadas de voz/);
  // Los vecinos van aparte, con el porqué: no la raíz ni el negocio.
  assert.match(chats, /Se conecta con:\n- CRM: Cada contacto es un lead del CRM/);
  assert.doesNotMatch(chats.split('Se conecta con:')[1], /Lo que hace MaKo|MaKo\n/);
  assert.ok(tokensDe(chats) <= 900, `Chats entera pesa ${tokensDe(chats)} tokens`);
  assert.equal(funcionEntera(negocio, funcionDeKey('chats')!), '', 'un negocio sin la capa (un cliente) recibió la función');
});

test('8. el brief del Web Generator en la plataforma: todas las funciones, la que vende entera antes del perfil, y el perfil pasa a ser la marca', () => {
  // Un cliente: el brief de siempre.
  assert.deepEqual(bloquesDeFuncion(null), { antes: [], rotuloPerfil: ROTULO_PERFIL });
  // La plataforma sin una función elegida: sólo el catálogo corto (que «Discutir» no niegue una que existe).
  const sinFuncion = bloquesDeFuncion({ catalogo: catalogoCorto(), funcion: '' });
  assert.equal(sinFuncion.antes.length, 1);
  assert.match(sinFuncion.antes[0], /LAS FUNCIONES DE MAKO[\s\S]*Chats \(en vez de respond\.io\)/);
  assert.equal(sinFuncion.rotuloPerfil, ROTULO_PERFIL);
  // Con la función: entera, con la regla de no prometer lo que no hace, y el perfil como la marca que la vende.
  const con = bloquesDeFuncion({ catalogo: catalogoCorto(), funcion: funcionEntera(funcionesDeMako(), funcionDeKey('chats')!) });
  assert.match(con.antes[1], /LA FUNCIÓN DE MAKO QUE VENDE ESTA LANDING[\s\S]*No hace:[\s\S]*Llamadas de voz/);
  assert.ok(con.antes[1].includes(REGLA_FUNCION));
  assert.equal(con.rotuloPerfil, ROTULO_MARCA);
});

test('9. el brief y el editor lo usan: la función va antes del perfil, Editar y Discutir pasan la página, y sólo en la plataforma', () => {
  const brief = fuente('lib/landing-writer.ts');
  const cuerpo = brief.slice(brief.indexOf('export async function buildLandingBrief('), brief.indexOf('export async function diagnosticoDe('));
  assert.match(cuerpo, /funcionesParaLanding\(\{ pedido, pagina: opts\.pagina \}\)/);
  const i = cuerpo.indexOf('...deFuncion.antes,');
  assert.ok(i > 0 && i < cuerpo.indexOf('### FUNNEL'), 'la función no va antes del funnel y del perfil');
  assert.match(cuerpo, /`### \$\{deFuncion\.rotuloPerfil\}\\n\$\{perfilTxt\}`/, 'el perfil no cambia de rótulo con una función');
  const ia = fuente('lib/editor-landing/ia.ts');
  assert.match(ia, /buildLandingBrief\(instruccion, \{ pagina: originales\.map\(\(t\) => textoDe\(t\)\)\.join\('\\n'\) \}\)/, 'Editar no pasa la página');
  assert.match(ia, /buildLandingBrief\(pregunta, \{ pagina: tarjetas\.map\(\(t\) => textoDe\(t\)\)\.join\('\\n'\) \}\)/, 'Discutir no pasa la página');
  const chat = fuente('lib/cerebro-para-chat.ts');
  const fl = chat.slice(chat.indexOf('export async function funcionesParaLanding('), chat.indexOf('async function armar('));
  assert.match(fl, /if \(ws == null \|\| ws !== \(await wsSuperAdmin\(\)\)\) return null;/, 'las funciones de MaKo le llegarían al brief de un cliente');
  assert.match(fl, /funcionEntera\(funcionesDeMako\(\), f\)/, 'la función no viaja entera');
});

test('10. la caché del grafo de los chats: cada negocio el suyo, una acción la borra, y lo incompleto o lo que tira no queda', async () => {
  const ahora = 1_000_000;
  const armado = (grafo: string, completo = true) => Promise.resolve({ grafo, completo });
  assert.equal(await guardarGrafo(3, armado('del 3'), ahora), 'del 3');
  await guardarGrafo(5, armado('del 5'), ahora);
  assert.equal(await grafoGuardado<string>(3, ahora + 1), 'del 3');
  assert.equal(await grafoGuardado<string>(5, ahora + 1), 'del 5', 'un negocio recibió el grafo de otro');
  assert.equal(grafoGuardado(3, ahora + CACHE_GRAFO_MS + 1), undefined, 'no vence');
  // Una acción ejecutada en el 3 lo borra; el 5 sigue.
  invalidarGrafoChat(3);
  assert.equal(grafoGuardado(3, ahora + 1), undefined, 'después de una acción, el chat sigue con el grafo viejo');
  assert.equal(await grafoGuardado<string>(5, ahora + 1), 'del 5');
  invalidarGrafoChat(null);
  // Armado con una lectura caída: se devuelve, pero no queda.
  assert.equal(await guardarGrafo(7, armado('parcial', false), ahora), 'parcial');
  await new Promise((r) => setImmediate(r));
  assert.equal(grafoGuardado(7, ahora + 1), undefined, 'un grafo incompleto quedó guardado 3 minutos');
  // Armado que tira: no queda.
  await assert.rejects(guardarGrafo(8, Promise.reject(new Error('base caída')), ahora));
  await new Promise((r) => setImmediate(r));
  assert.equal(grafoGuardado(8, ahora + 1), undefined);
  invalidarGrafoChat(5);
});

test('11. lo que lo borra y lo que avisa: cada acción ejecutada, y cada lectura secundaria del grafo que se cae', () => {
  const acc = fuente('lib/api-mako/acciones.ts');
  const generica = acc.slice(acc.indexOf('export async function aplicarPropuestaGenerica('), acc.indexOf('export async function confirmarPendiente('));
  assert.match(generica, /await marcarResultado\([^\n]*\);\n\s*invalidarGrafoChat\(ctx\.ws\);/, 'aplicar una propuesta no borra la caché del grafo');
  const pendiente = acc.slice(acc.indexOf('export async function confirmarPendiente('));
  assert.match(pendiente, /await resolverPendiente\([^\n]*\);\n\s*invalidarGrafoChat\(ctx\.ws\);/, 'confirmar una acción no borra la caché del grafo');
  const grafo = fuente('lib/cerebro-grafo.ts');
  for (const [desde, hasta] of [['async function leerLoVivo(', ']);'], ['  const [schema, diag, files, manual,', ']);']] as const) {
    const i = grafo.indexOf(desde);
    const bloque = grafo.slice(i, grafo.indexOf(hasta, i));
    assert.doesNotMatch(bloque, /\.catch\(\(\) =>/, `una lectura de ${desde.trim()} se cae callada: el chat guardaría el grafo incompleto`);
    assert.ok((bloque.match(/vacioAvisando\(/g) ?? []).length >= 9, `${desde.trim()}: faltan lecturas que avisen`);
  }
});

// ── Probado rompiéndolo (28/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado (sha1 igual):
//   6. la raíz `fn:raiz` (cuenta como dato)                                → rojo el 1 y el 2.
//   7. la clave «Reemplaza a» en los datos (siembra todas las funciones)    → rojo el 2 y el 3.
//   8. el cuerpo sin «No hace»                                             → rojo el 3.
//   9. `conCapa` sin la arista de la raíz (dos cerebros)                    → rojo el 4.
//  10. el índice con `construirCerebro()`                                   → rojo el 5.
//  11. el grafo de los chats con la física                                  → rojo el 5.
//  16. «landing» cuenta como el Web Generator                                → rojo el 6.
//  17. una palabra suelta de la página alcanza para elegir                    → rojo el 6.
//  18. se vende lo que sólo ve el super admin                                 → rojo el 6 y el 7.
//  (28/10, la verificación de 0c80dd3ce) V5. confirmar sin borrar la caché, V8. una lectura que se cae callada → rojo el 11;
//  V6. lo incompleto queda, V7. invalidar no borra → rojo el 10; V11. Partners en la capa de la plataforma → rojo el 1.
//  (28/10, el Web Generator) W1. la función sin la regla de no prometer, W2. el perfil sigue como protagonista → rojo el 8;
//  W3. la función después del funnel, W4. Editar sin la página, W5. las funciones de MaKo al brief de un cliente → rojo el 9;
//  W6. la función sin sus vecinos → rojo el 7.
