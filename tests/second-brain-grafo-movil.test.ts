// =============================================================================
// Second Brain — el grafo en el teléfono, y UN solo grafo para el super admin (17/10/2026)
// =============================================================================
// Pedido de Martín (Android, Chrome), 17/10/2026 a las 21:30:
//   1. «No puedo clickear en nodos, o nada»: el Mapa del teléfono era una FOTO sin gestos (MapaChico). Ahora abre el grafo
//      de verdad (el mismo componente de escritorio): tocar un nodo lo fija, pan y pellizco con los dedos.
//   2. «Que se vea volteada la pantalla por default»: pantalla completa + `screen.orientation.lock('landscape')` desde un
//      toque (app/second-brain/apaisar.ts).
//   3. «Que se vea la sidebar como en desktop, solo que con scroll»: apaisado, la barra lateral va AL COSTADO.
//   4. «En SuperAdmin no pongas 2 grafos, todo 1 solo; para eso existen los filtros»: lib/cerebro-union.ts junta el
//      negocio y la construcción de MaKo, y las capas son un atajo del filtro de carpetas.
//
// Verificado ROMPIÉNDOLO (17/10/2026), cada rotura contra la base en verde (12 pasan / 0 fallan) y restaurando después
// (pasan / fallan):
//   · la raíz de la construcción sin renombrar (dos `raiz`)                            → 8 / 4  (no se pierde nada, choca, lado a lado, capas)
//   · `unirCerebros` que descarta las aristas de la construcción                       → 10 / 2 (no se pierde nada, choca)
//   · la nube de la construcción encimada sobre la del negocio (dx = 0)                → 11 / 1 (lado a lado)
//   · `pasaFiltro` sin la regla de la raíz del negocio                                 → 11 / 1 (las capas filtran)
//   · `filtroDelNegocio` con el filtro vacío cuando se mira sólo la construcción        → 11 / 1 (Exportar)
//   · `apaisar` pidiendo `lock` sin la pantalla completa antes                         → 11 / 1 (apaisar)
//   · Grafo.tsx con la tolerancia de 5 px de siempre en vez de la del dedo             → 11 / 1 (tocar un nodo con el dedo)
//   · VistaCerebro con un segundo `<Grafo>`                                            → 11 / 1 (la pantalla dibuja UN grafo)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { layoutCerebro } from '../lib/cerebro-layout';
import { armarConstruccion, TAXONOMIA_CONSTRUCCION, type AreaDeObra } from '../lib/cerebro-construccion';
import { CAPA_CONSTRUCCION, CAPA_NEGOCIO, TAXONOMIA_NEGOCIO, type AristaCerebro, type Cerebro, type NodoCerebro } from '../lib/cerebro-modelo';
import { capaActiva, cuentaFiltros, filtroDeCapa, filtroVacio, pasaFiltro } from '../lib/cerebro-filtro';
import { esAreaDeNegocio, filtroDelNegocio, ID_RAIZ_OBRA, unirCerebros } from '../lib/cerebro-union';
import { apaisar, soltarApaisado } from '../app/second-brain/apaisar';
import type { HitoP } from '../lib/progreso-reglas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '');

// ── Los dos grafos de prueba ────────────────────────────────────────────────────────────────────────────────────────
const nodoN = (id: string, area: NodoCerebro['area'], extra: Partial<NodoCerebro> = {}): NodoCerebro => ({
  id, area, etiqueta: id, detalle: '', fuente: 'prueba', autoria: 'usuario', ...extra,
});
function negocio(): Cerebro {
  const nodos: NodoCerebro[] = [
    nodoN('raiz', 'norte', { autoria: 'mako' }),
    nodoN('n1:oferta', 'oferta'), nodoN('area:oferta', 'oferta'),
    nodoN('n1:mercado', 'cliente'), nodoN('area:cliente', 'cliente'),
    nodoN('of:1', 'oferta'), nodoN('of:2', 'oferta'), nodoN('cl:1', 'cliente'), nodoN('cl:2', 'cliente'),
  ];
  const aristas: AristaCerebro[] = [
    { de: 'raiz', a: 'n1:oferta', motivo: 'm' }, { de: 'raiz', a: 'n1:mercado', motivo: 'm' },
    { de: 'n1:oferta', a: 'area:oferta', motivo: 'm' }, { de: 'n1:mercado', a: 'area:cliente', motivo: 'm' },
    { de: 'of:1', a: 'area:oferta', motivo: 'm' }, { de: 'of:2', a: 'area:oferta', motivo: 'm' },
    { de: 'cl:1', a: 'area:cliente', motivo: 'm' }, { de: 'cl:2', a: 'area:cliente', motivo: 'm' },
    { de: 'of:1', a: 'cl:1', motivo: 'lateral' },
  ];
  const { posiciones, encuadre } = layoutCerebro(nodos, aristas);
  return {
    negocio: 'Negocio de prueba', nodos, aristas, posiciones, encuadre, huella: 'h-negocio',
    cuenta: { total: 4, mako: 0, usuario: 4, pendientes: 0 }, vacias: [],
  };
}
const AHORA = Date.parse('2026-10-17T12:00:00Z');
const hito = (fecha: string, hora: string, chat: string, titulo: string): HitoP => ({
  fecha, hora, chat, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion', titulo, puntos: [`**${titulo}**: lo que pasó`],
});
const AREAS_OBRA: AreaDeObra[] = [
  { slug: 'crm', titulo: 'CRM', familia: 'Sales Machine', estado: 'parcial', alcance: 'Leads.', vive: ['app/crm/a.tsx', 'lib/leads.ts'],
    partes: [], bitacora: [hito('15 oct', '10:00', 'CRM', 'uno'), hito('16 oct', '10:00', 'CRM', 'dos')] },
  { slug: 'pagos', titulo: 'Pagos', familia: 'Business', estado: 'listo', alcance: 'Cobros.', vive: ['app/pagos/b.tsx', 'lib/leads.ts'],
    partes: [], bitacora: [hito('16 oct', '22:30', 'CRM', 'cobro')] },
  { slug: 'infra', titulo: 'Infra', familia: 'Infra', estado: 'listo', alcance: '', vive: ['x'], partes: [], bitacora: [] },
];
const obra = (): Cerebro<string> => armarConstruccion(AREAS_OBRA, AHORA);
const idsDe = (c: Cerebro<string>) => c.nodos.map((n) => n.id);

// ── 4 · UN solo grafo ───────────────────────────────────────────────────────────────────────────────────────────────

test('un solo grafo: no se pierde ningún nodo ni ninguna arista, y la raíz de la construcción no choca', () => {
  const n = negocio();
  const o = obra();
  const u = unirCerebros(n, o);
  assert.equal(u.nodos.length, n.nodos.length + o.nodos.length, 'ningún nodo de ninguno de los dos');
  // Ninguna arista se pierde; se suma UNA, la que cuelga la construcción de la raíz (20/10/2026: un cerebro, nunca dos).
  assert.equal(u.aristas.length, n.aristas.length + o.aristas.length + 1, 'ninguna arista, y el puente');
  const ids = idsDe(u);
  assert.equal(new Set(ids).size, ids.length, 'ids únicos');
  assert.equal(ids.filter((i) => i === 'raiz').length, 1, 'una sola raíz del negocio');
  assert.ok(ids.includes(ID_RAIZ_OBRA), 'la raíz de la construcción pasa a `n1:obra`');
  assert.ok(!ids.includes('obra:raiz'));
  for (const e of u.aristas) assert.ok(ids.includes(e.de) && ids.includes(e.a), `la arista ${e.de} → ${e.a} apunta a nodos que existen`);
  // Cada nodo original sigue (con su id, salvo la raíz): lo mismo del lado de la construcción.
  for (const x of o.nodos) assert.ok(ids.includes(x.id === 'raiz' ? ID_RAIZ_OBRA : x.id), `falta ${x.id}`);
  for (const x of n.nodos) assert.ok(ids.includes(x.id), `falta ${x.id}`);
  assert.deepEqual(u.cuenta, {
    total: n.cuenta.total + o.cuenta.total, mako: n.cuenta.mako + o.cuenta.mako,
    usuario: n.cuenta.usuario + o.cuenta.usuario, pendientes: n.cuenta.pendientes + o.cuenta.pendientes,
  });
  assert.equal(u.negocio, n.negocio, 'el nombre del negocio es el del workspace que se mira');
});

test('un solo grafo: si otro id choca, el de la construcción se prefija y nada se pisa', () => {
  const n = negocio();
  const o = obra();
  // Un id de la construcción que ya existe en el negocio (hoy no hay ninguno, salvo `raiz`): `of:1`.
  const choca = { ...o, nodos: [...o.nodos, nodoN('of:1', 'mako' as never)], aristas: [...o.aristas, { de: 'of:1', a: 'dev:crm', motivo: 'x' }] } as Cerebro<string>;
  const u = unirCerebros(n, choca);
  const ids = idsDe(u);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('obra:of:1') && ids.includes('of:1'));
  assert.ok(u.aristas.some((e) => e.de === 'obra:of:1' && e.a === 'dev:crm'), 'la arista sigue al nodo renombrado');
});

// 20/10/2026: lado a lado son sólo las posiciones de PARTIDA; el servidor corre la física entera
// (tests/second-brain-un-cerebro.test.ts fija que el acomodado NO queda así).
test('un solo grafo: las posiciones de partida cubren todo, adentro de un encuadre que las abarca', () => {
  const n = negocio();
  const o = obra();
  const u = unirCerebros(n, o);
  for (const x of u.nodos) assert.ok(u.posiciones[x.id], `${x.id} tiene posición`);
  for (const x of n.nodos) assert.deepEqual(u.posiciones[x.id], n.posiciones[x.id], 'la nube del negocio no se mueve');
  const { x, y, lado } = u.encuadre;
  for (const p of Object.values(u.posiciones)) {
    assert.ok(p.x >= x && p.x <= x + lado && p.y >= y && p.y <= y + lado, 'todo adentro del encuadre');
  }
});

test('un solo grafo: la taxonomía es de las dos capas, sin ids repetidos, y cada carpeta en una sola capa', () => {
  const u = unirCerebros(negocio(), obra());
  const tax = u.taxonomia!;
  assert.equal(tax.carpetas.length, TAXONOMIA_NEGOCIO.carpetas.length + TAXONOMIA_CONSTRUCCION.carpetas.length);
  assert.equal(tax.areas.length, TAXONOMIA_NEGOCIO.areas.length + TAXONOMIA_CONSTRUCCION.areas.length);
  assert.equal(new Set(tax.carpetas.map((c) => c.id)).size, tax.carpetas.length, 'carpetas sin repetir entre capas');
  assert.equal(new Set(tax.areas.map((a) => a.id)).size, tax.areas.length, 'áreas sin repetir entre capas');
  assert.deepEqual(tax.capas?.map((c) => c.id), [CAPA_NEGOCIO, CAPA_CONSTRUCCION]);
  const enCapas = tax.capas!.flatMap((c) => c.carpetas);
  assert.deepEqual([...enCapas].sort(), tax.carpetas.map((c) => c.id).sort(), 'toda carpeta está en una capa, y en una sola');
  for (const a of TAXONOMIA_CONSTRUCCION.areas) assert.ok(!esAreaDeNegocio(a.id), `${a.id} es de la construcción: no se edita`);
  for (const a of TAXONOMIA_NEGOCIO.areas) assert.ok(esAreaDeNegocio(a.id));
});

test('las capas filtran: son un atajo de las carpetas, y la raíz sola no se queda mirando la otra capa', () => {
  const u = unirCerebros(negocio(), obra());
  const tax = u.taxonomia!;
  const quedan = (f: ReturnType<typeof filtroVacio>) => u.nodos.filter((n) => pasaFiltro(n, f, tax)).map((n) => n.id);

  assert.equal(quedan(filtroVacio()).length, u.nodos.length, 'sin filtro se ve todo');

  const obraSola = filtroDeCapa(filtroVacio(), tax, CAPA_CONSTRUCCION);
  assert.equal(capaActiva(obraSola, tax), CAPA_CONSTRUCCION);
  assert.equal(cuentaFiltros(obraSola, tax), 1, 'una capa entera es UN filtro');
  assert.equal(cuentaFiltros(obraSola), obraSola.carpetas.size, 'y sin taxonomía se cuenta por carpeta (el filtro de siempre)');
  const verObra = quedan(obraSola);
  assert.ok(!verObra.includes('raiz'), 'la raíz del negocio no queda sola');
  assert.ok(verObra.includes(ID_RAIZ_OBRA) && verObra.includes('dev:crm') && verObra.includes('dev:pagos'));
  assert.ok(!verObra.some((i) => i.startsWith('of:') || i.startsWith('cl:')), 'ni un nodo del negocio');

  const negSolo = filtroDeCapa(filtroVacio(), tax, CAPA_NEGOCIO);
  const verNeg = quedan(negSolo);
  assert.ok(verNeg.includes('raiz') && verNeg.includes('of:1'));
  assert.ok(!verNeg.includes(ID_RAIZ_OBRA) && !verNeg.some((i) => i.startsWith('dev:')), 'ni un nodo de la construcción');

  // Una carpeta suelta ("desarrollo", "ventas"...) sigue funcionando, y deja de ser "una capa".
  const suelta = filtroVacio();
  suelta.carpetas.add('producto');
  assert.equal(capaActiva(suelta, tax), null);
  assert.ok(quedan(suelta).includes('dev:crm') && !quedan(suelta).includes('dev:pagos'));

  assert.equal(capaActiva(filtroDeCapa(obraSola, tax, null), tax), null, '«Todo» limpia la capa');
});

test('Exportar: baja sólo el negocio; mirando sólo la construcción no hay nada que bajar', () => {
  const tax = unirCerebros(negocio(), obra()).taxonomia!;
  assert.deepEqual(filtroDelNegocio(filtroVacio(), tax), filtroVacio(), 'sin filtro, todo el negocio');
  assert.equal(filtroDelNegocio(filtroDeCapa(filtroVacio(), tax, CAPA_CONSTRUCCION), tax), null, 'sólo construcción: nada');
  const mixto = filtroVacio();
  mixto.carpetas.add('oferta');
  mixto.carpetas.add('producto');
  assert.deepEqual([...filtroDelNegocio(mixto, tax)!.carpetas], ['oferta'], 'la carpeta de la construcción no entra al ZIP');
  assert.equal(filtroDelNegocio(filtroDeCapa(filtroVacio(), tax, CAPA_NEGOCIO), tax)?.carpetas.size, TAXONOMIA_NEGOCIO.carpetas.length);
});

test('un solo grafo: la pantalla dibuja UN `<Grafo>`, con el cerebro que manda el servidor, sin el selector de dos grafos', () => {
  const v = sinComentarios(leer('app/second-brain/VistaCerebro.tsx'));
  assert.equal((v.match(/<Grafo\b/g) ?? []).length, 1, 'un solo grafo');
  assert.doesNotMatch(v, /key="construccion"|sb-capas|elegirCapa|filtroObra/, 'ya no hay dos grafos ni su selector');
  assert.match(v, /<Grafo\s+cerebro=\{cerebro\}/, 'el que llega, ya unido en el servidor (20/10/2026)');
  const f = sinComentarios(leer('app/second-brain/FiltroMapa.tsx'));
  assert.match(f, /label: 'Capa'/, 'las capas se eligen en el filtro');
  assert.doesNotMatch(f, /\bNIVEL1\b|\bAREAS\b/, 'el filtro lee la taxonomía del grafo, no la del negocio a mano');
  const g = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  assert.match(g, /className="cbg-nav-capa"/, 'y desde la barra lateral');
  assert.doesNotMatch(g, /esNegocio/, 'el editor es de las áreas del negocio, no de "este grafo"');
});

// ── 2 · apaisar ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('apaisar: pantalla completa PRIMERO y después el bloqueo horizontal; si algo falla, lo dice', async () => {
  const llamadas: string[] = [];
  const doc = { fullscreenElement: null as Element | null };
  const el = { requestFullscreen: async () => { llamadas.push('completa'); doc.fullscreenElement = {} as Element; } };
  const pantalla = { orientation: { lock: async (o: string) => { llamadas.push(`lock:${o}`); }, unlock: () => { llamadas.push('unlock'); } } };
  assert.equal(await apaisar(el, doc, pantalla as never), 'apaisada');
  assert.deepEqual(llamadas, ['completa', 'lock:landscape'], 'sin la pantalla completa Chrome rechaza el lock');

  // Ya en pantalla completa: no la pide de nuevo.
  llamadas.length = 0;
  assert.equal(await apaisar(el, doc, pantalla as never), 'apaisada');
  assert.deepEqual(llamadas, ['lock:landscape']);

  // El navegador no deja girar (iOS, o un SecurityError): queda la pantalla completa.
  const sinGiro = { orientation: { lock: async () => { throw new Error('SecurityError'); } } };
  assert.equal(await apaisar(el, doc, sinGiro as never), 'completa');
  const sinApi = {};
  assert.equal(await apaisar(el, doc, sinApi as never), 'completa');

  // Ni pantalla completa ni giro: nada, y sin tirar.
  assert.equal(await apaisar({}, { fullscreenElement: null }, sinApi as never), 'nada');
  const rechaza = { requestFullscreen: async () => { throw new Error('no'); } };
  assert.equal(await apaisar(rechaza, { fullscreenElement: null }, sinGiro as never), 'nada');
});

test('soltarApaisado: devuelve la rotación y nunca tira', () => {
  const llamadas: string[] = [];
  soltarApaisado({ orientation: { unlock: () => { llamadas.push('unlock'); } } });
  assert.deepEqual(llamadas, ['unlock']);
  soltarApaisado({});
  soltarApaisado({ orientation: { unlock: () => { throw new Error('x'); } } });
});

// ── 1 y 3 · el teléfono ─────────────────────────────────────────────────────────────────────────────────────────────

test('tocar un nodo con el dedo: tolerancia de dedo, blanco de 44 px, el dedo panea, y sin el menú del mantener apretado', () => {
  const g = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  assert.match(g, /const ARRASTRE2_TACTIL = 100;/, '10 px de tolerancia con el dedo (5 era la rodada del pulgar)');
  assert.match(g, /dx \* dx \+ dy \* dy <= \(arr\.tactil \? ARRASTRE2_TACTIL : ARRASTRE2\)/);
  assert.match(g, /const TOQUE_PX = 22;/);
  assert.match(g, /Math\.max\(r \+ 8 \/ kr, \(tactil \? TOQUE_PX : CLIC_PX\) \/ kr\)/, 'el blanco invisible del nodo crece con el dedo');
  assert.match(g, /matchMedia\?\.\('\(pointer: coarse\)'\)/);
  // Con el dedo el nodo no se arrastra: se mueve el mapa (si no, en un mapa denso no hay cómo desplazarse).
  assert.match(g, /if \(arrastrando\.current && !arr\.tactil\)/);
  assert.match(g, /if \(e\.pointerType === 'touch'\) return;/);
  // El menú de «mantener apretado» (contextmenu) de Android no abre encima del gesto.
  assert.match(g, /onContextMenu=\{frenarMenu\}/);
  // El `mouseenter` que el teléfono emite después de tocar no resalta el nodo como si hubiera cursor.
  assert.match(g, /onMouseEnter=\{\(\) => \{ if \(!esToque\.current\) setActivo\(n\.id\); \}\}/);
  // El pellizco sigue ahí (dos punteros).
  assert.match(g, /punteros\.current\.size === 2/);
  assert.match(g, /touch-action: none/);
});

test('la barra lateral apaisada: al costado, con scroll, y el botón «Girar la pantalla» (sólo en el teléfono vertical)', () => {
  const g = leer('app/second-brain/Grafo.tsx');
  const css = g.slice(g.indexOf('@media (orientation: landscape) and (max-height: 640px)'));
  assert.ok(css.length > 0, 'el corte del teléfono apaisado');
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) clamp\(250px, 38vw, 340px\)/, 'dos columnas: el mapa y la barra');
  assert.match(css, /\.cbg \.cbg-detalle\[data-plegado="1"\] \{[^}]*position: static; display: flex;/, 'la barra siempre a la vista, no flotante');
  assert.match(css, /\.cbg \.cbg-tirador, \.cbg \.cbg-areas-btn \{ display: none; \}/);
  assert.match(css, /overscroll-behavior: contain/, 'el scroll de la barra no arrastra la página');
  // Va DESPUÉS de los otros cortes: es lo que los pisa (misma especificidad, gana el último).
  assert.ok(g.indexOf('@media (orientation: landscape) and (max-height: 640px)') > g.indexOf('@media (max-width: 720px)'));
  assert.ok(g.indexOf('@media (max-width: 720px)') > g.indexOf('@media (max-width: 1100px)'));
  const j = sinComentarios(g);
  assert.match(j, /movil && retrato && !sinGiro && !nodoSel/);
  assert.match(j, /else if \(movil\) void apaisar\(el\)/, 'el botón de pantalla completa del teléfono también gira');
  assert.match(j, /if \(!document\.fullscreenElement\) soltarApaisado\(\);/, 'salir de la pantalla completa devuelve la rotación');
  assert.match(j, /data-movil=\{movil \? '1' : undefined\}/);
});

test('el Mapa del teléfono abre el grafo real a pantalla entera, y la foto es la puerta', () => {
  const m = sinComentarios(leer('app/m/second-brain/SecondBrainM.tsx'));
  assert.match(m, /<VistaCerebro\s+movil\s/, 'el mismo componente de escritorio, en su modo teléfono');
  assert.match(m, /<VistaCerebro\s+movil\s+cerebro=\{grafo\}/, 'con la construcción adentro: UN cerebro también acá (20/10/2026)');
  assert.match(m, /useAtrasCierra\(grafoAbierto, \(\) => setGrafoAbierto\(false\)\)/, 'el «atrás» de Android cierra el grafo');
  assert.match(m, /className="m-second-brain-abrir"/, 'la foto del mapa es un botón');
  assert.match(m, /document\.getElementById\('m-root'\) \?\? document\.body/, 'en el shell del teléfono (ahí viven sus tokens)');
  assert.match(m, /useState\(\(\) => !areaInicial && cerebro\.nodos\.length > 1\)/, 'el Mapa abre en el grafo, salvo que otra pantalla pida un área');
  const css = leer('app/m/second-brain/second-brain.css');
  assert.match(css, /\.m-second-brain-grafo \{[^}]*position: fixed; inset: 0; z-index: 60; height: 100dvh/);
  const v = sinComentarios(leer('app/second-brain/VistaCerebro.tsx'));
  assert.match(v, /\{!movil && \(\s*<header/, 'sin cabecera en el teléfono: son 340 px de alto');
  assert.match(v, /\{!movil && <AreasHub/, 'y sin el editor de escritorio');
});
