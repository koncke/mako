// =============================================================================
// Second Brain — NINGÚN CEREBRO SE DIVIDE EN DOS (20/10/2026)
// =============================================================================
// Martín, 20/10/2026: «El Second Brain de SuperAdmin ya te había pedido que no se dividiera en 2... En ningún caso jamás
// los cerebros se deben dividir en 2» (ya lo había pedido el 17 y el 18). Por qué el código decía «uno» y se veían dos:
// `unirCerebros` devolvía UN `Cerebro` (un `<Grafo>`) con DOS raíces y ninguna arista entre ellas, y ponía la nube de la
// construcción AL LADO de la del negocio con aire en el medio; el teléfono además cambiaba un grafo por otro
// («Negocio · Construcción»). Y no era sólo el super admin: medido en producción, el negocio del ws 9 tenía 3 pedazos y
// el del ws 3 (Cliente de Prueba), 2 (racimos sin ninguna arista lateral, que flotaban aparte).
//
// Lo que fija: desde UNA raíz se llega a TODOS los nodos (un solo componente), en el cerebro unido, en el de cualquier
// negocio y con la física corrida entera en el servidor; y ninguna pantalla vuelve a juntar ni a elegir entre dos.
//
// Verificado ROMPIÉNDOLO (20/10/2026, arnés romper.py del scratchpad), cada rotura contra la base en verde (7 pasan /
// 0 fallan) y restaurando después (pasan / fallan):
//   · `unirCerebros` sin la arista raíz → construcción (el puente)                         → 6 / 1
//   · `puentesARaiz` que no devuelve nada (los racimos sueltos de vuelta)                    → 3 / 4
//   · `construirCerebro` sin `puentesARaiz` antes del layout                                → 6 / 1
//   · `acomodarUnido` que devuelve las posiciones lado a lado de `unirCerebros` (sin física) → 6 / 1
//   · `cerebroUnido` que recalcula siempre (sin reusar con la misma huella)                → 6 / 1
//   · VistaCerebro juntando otra vez en el cliente (`unirCerebros(cerebro, construccion)`)  → 6 / 1
//   · el teléfono con su «Negocio · Construcción» de vuelta                                → 6 / 1
//   · AGENTS.md sin la regla                                                                → 6 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { layoutCerebro } from '../lib/cerebro-layout';
import { armarConstruccion, type AreaDeObra } from '../lib/cerebro-construccion';
import type { AristaCerebro, Cerebro, NodoCerebro } from '../lib/cerebro-modelo';
import { componentes, esAreaDeNegocio, ID_RAIZ_OBRA, PUENTE_OBRA, puentesARaiz, soloElNegocio, unirCerebros } from '../lib/cerebro-union';
import { acomodarUnido, cerebroUnido, huellaUnida } from '../lib/cerebro-union-servidor';
import type { HitoP } from '../lib/progreso-reglas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/** Lo que se alcanza desde `raiz` caminando aristas (en los dos sentidos: el dibujo no tiene flechas). */
function alcanzables(c: Pick<Cerebro<string>, 'nodos' | 'aristas'>, raiz = 'raiz'): Set<string> {
  const vecinos = new Map<string, string[]>();
  for (const a of c.aristas) {
    vecinos.set(a.de, [...(vecinos.get(a.de) ?? []), a.a]);
    vecinos.set(a.a, [...(vecinos.get(a.a) ?? []), a.de]);
  }
  const vistos = new Set([raiz]);
  const cola = [raiz];
  while (cola.length) for (const v of vecinos.get(cola.shift()!) ?? []) if (!vistos.has(v)) { vistos.add(v); cola.push(v); }
  return vistos;
}
function unoSolo(c: Pick<Cerebro<string>, 'nodos' | 'aristas'>, que: string) {
  const llega = alcanzables(c);
  const sueltos = c.nodos.filter((n) => !llega.has(n.id)).map((n) => n.id);
  assert.deepEqual(sueltos, [], `${que}: desde la raíz se llega a todo (sueltos: ${sueltos.join(', ')})`);
  assert.equal(componentes(c.nodos, c.aristas).length, 1, `${que}: un solo componente`);
  assert.equal(c.nodos.filter((n) => n.id === 'raiz').length, 1, `${que}: una sola raíz`);
}

// ── Un negocio CON UN RACIMO SUELTO (pasa en producción: el ws 3 tenía uno) y la construcción ─────────────────────────
const nodoN = (id: string, area: NodoCerebro['area']): NodoCerebro => ({ id, area, etiqueta: id, detalle: '', fuente: 'prueba', autoria: 'usuario' });
function negocio(): Cerebro {
  const nodos: NodoCerebro[] = [
    nodoN('raiz', 'norte'), nodoN('n1:oferta', 'oferta'), nodoN('area:oferta', 'oferta'), nodoN('of:1', 'oferta'), nodoN('of:2', 'oferta'),
    // El racimo de la voz sin el quiz de personalidad: sus audios cuelgan sólo de su área, y el área de nada.
    nodoN('area:voz', 'voz'), nodoN('audio:1', 'voz'), nodoN('audio:2', 'voz'),
  ];
  const aristas: AristaCerebro[] = [
    { de: 'raiz', a: 'n1:oferta', motivo: 'm' }, { de: 'n1:oferta', a: 'area:oferta', motivo: 'm' },
    { de: 'of:1', a: 'area:oferta', motivo: 'm' }, { de: 'of:2', a: 'area:oferta', motivo: 'm' },
    { de: 'audio:1', a: 'area:voz', motivo: 'm' }, { de: 'audio:2', a: 'area:voz', motivo: 'm' },
  ];
  aristas.push(...puentesARaiz(nodos, aristas));
  const { posiciones, encuadre } = layoutCerebro(nodos, aristas);
  return { negocio: 'Prueba', nodos, aristas, posiciones, encuadre, huella: 'h-neg', cuenta: { total: 5, mako: 0, usuario: 5, pendientes: 0 }, vacias: [] };
}
const hito = (fecha: string, titulo: string): HitoP => ({
  fecha, hora: '10:00', chat: 'CRM', cuenta: 'claude4', actor: 'claude', tipo: 'implementacion', titulo, puntos: [`**${titulo}**: x`],
});
const AREAS_OBRA: AreaDeObra[] = [
  { slug: 'crm', titulo: 'CRM', familia: 'Sales Machine', estado: 'parcial', alcance: 'Leads.', vive: ['app/crm/a.tsx', 'lib/leads.ts'],
    partes: [], bitacora: [hito('15 oct', 'uno'), hito('16 oct', 'dos')] },
  { slug: 'pagos', titulo: 'Pagos', familia: 'Business', estado: 'listo', alcance: 'Cobros.', vive: ['app/pagos/b.tsx', 'lib/leads.ts'],
    partes: [], bitacora: [hito('16 oct', 'cobro')] },
  { slug: 'infra', titulo: 'Infra', familia: 'Infra', estado: 'listo', alcance: '', vive: ['x'], partes: [], bitacora: [] },
];
const obra = (): Cerebro<string> => armarConstruccion(AREAS_OBRA, Date.parse('2026-10-17T12:00:00Z'));

test('el negocio: un racimo sin aristas laterales se engancha a la raíz por su nodo más estructural', () => {
  const n = negocio();
  unoSolo(n, 'el negocio');
  const puente = n.aristas.filter((a) => a.a === 'raiz' && a.de === 'area:voz');
  assert.equal(puente.length, 1, 'el área (no un audio suelto) cuelga de la raíz');
  assert.deepEqual(puentesARaiz(n.nodos, n.aristas), [], 'conectado, no agrega nada');
  // Y lo hace el armado de verdad, antes del layout (si no, el racimo se dibuja aparte aunque la arista llegue después).
  const g = sinComentarios(leer('lib/cerebro-grafo.ts'));
  const i = g.indexOf('aristas.push(...puentesARaiz(nodos, aristas, RAIZ));');
  assert.ok(i > 0 && i < g.indexOf('const { posiciones, encuadre } = layoutCerebro(nodos, aristas);'), 'construirCerebro engancha todo antes del layout');
});

test('el cerebro unido: UNA raíz, la construcción colgada de ella, y desde ahí se llega a todo', () => {
  const n = negocio();
  const o = obra();
  const u = unirCerebros(n, o);
  unoSolo(u, 'el unido');
  assert.ok(u.aristas.some((a) => a.de === 'raiz' && a.a === ID_RAIZ_OBRA && a.motivo === PUENTE_OBRA), 'la raíz del negocio → la carpeta de la construcción');
  unoSolo(o, 'la construcción sola (con un área sin hitos y carpetas de una familia)');
  // Aunque la construcción traiga un pedazo suelto, el unido sigue siendo uno.
  const conIsla = { ...o, nodos: [...o.nodos, nodoN('hito:suelto', 'mako' as never)] } as Cerebro<string>;
  unoSolo(unirCerebros(n, conIsla), 'con un hito suelto en la construcción');
  // «Exportar» sigue contando sólo el negocio.
  assert.deepEqual(soloElNegocio(u).nodos.map((x) => x.id).sort(), n.nodos.map((x) => x.id).sort());
  assert.ok(soloElNegocio(u).nodos.every((x) => esAreaDeNegocio(x.area)));
});

test('la física corre ENTERA: la construcción es un racimo más de la nube, no una segunda nube al lado', () => {
  const n = negocio();
  const o = obra();
  const u = acomodarUnido(n, o);
  unoSolo(u, 'acomodado');
  for (const x of u.nodos) assert.ok(u.posiciones[x.id], `${x.id} tiene posición`);
  const caja = (f: (x: NodoCerebro<string>) => boolean) => {
    const ps = u.nodos.filter(f).map((x) => u.posiciones[x.id]);
    return { x0: Math.min(...ps.map((p) => p.x)), x1: Math.max(...ps.map((p) => p.x)), y0: Math.min(...ps.map((p) => p.y)), y1: Math.max(...ps.map((p) => p.y)) };
  };
  const a = caja((x) => esAreaDeNegocio(x.area));
  const b = caja((x) => !esAreaDeNegocio(x.area));
  assert.ok(a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1, 'las dos partes se tocan: no hay aire entre dos nubes');
  // Lo de `unirCerebros` son posiciones de PARTIDA: la construcción a la derecha. Acomodado, eso tiene que cambiar.
  const lado = unirCerebros(n, o);
  const igualQueAntes = o.nodos.every((x) => {
    const id = x.id === 'raiz' ? ID_RAIZ_OBRA : x.id;
    return lado.posiciones[id].x === u.posiciones[id].x && lado.posiciones[id].y === u.posiciones[id].y;
  });
  assert.ok(!igualQueAntes, 'no son las nubes lado a lado');
  assert.equal(u.huella, huellaUnida(n, o), 'la huella es la del unido: cambia si cambia cualquiera de las dos partes');
  assert.notEqual(u.huella, n.huella);
});

test('el servidor reusa el acomodado mientras nada cambie, y lo nuevo parte de donde estaba', () => {
  const n = negocio();
  const o = obra();
  const primero = cerebroUnido(n, o);
  assert.equal(cerebroUnido(n, o), primero, 'misma huella: el mismo, sin volver a correr la física');
  const cambio = { ...n, huella: 'h-neg-2' };
  const segundo = cerebroUnido(cambio, o);
  assert.notEqual(segundo, primero, 'cambió el negocio: se vuelve a acomodar');
  unoSolo(segundo, 'el segundo');
});

test('las puertas: el servidor manda UN cerebro (pantalla, teléfono y grafo vivo) y nadie junta dos en el cliente', () => {
  const op = leer('lib/second-brain-opera.ts');
  assert.match(op, /^import 'server-only';/m);
  assert.match(op, /\? cerebroUnido\(negocio, construccionDeMako\(\)\) : negocio;/, 'a quien no opera, sólo su negocio');
  assert.match(sinComentarios(leer('app/second-brain/pagina.tsx')), /const cerebro = await cerebroQueSeDibuja\(await construirCerebro\(\{ chatsMako \}\), opera\);\s*return <VistaCerebro cerebro=\{cerebro\} funnelPanel=\{funnelPanel\} \/>;/);
  assert.match(leer('app/api/second-brain/cerebro/route.ts'), /const cerebro = await cerebroQueSeDibuja\(await construirCerebro\(/, 'el grafo vivo trae lo mismo: si no, a los 3 minutos la construcción se iría');
  assert.match(leer('app/m/second-brain/mapa/page.tsx'), /grafo = await cerebroQueSeDibuja\(cerebro\);/);
  const v = sinComentarios(leer('app/second-brain/VistaCerebro.tsx'));
  assert.doesNotMatch(v, /unirCerebros|construccion\?:/, 'la pantalla no junta nada: recibe uno');
  assert.match(v, /const conObra = !!tax\?\.capas\?\.length;/, 'que trae la construcción lo dice el cerebro mismo');
});

test('el teléfono: UNA foto y UN grafo, sin «Negocio · Construcción»', () => {
  const m = sinComentarios(leer('app/m/second-brain/SecondBrainM.tsx'));
  assert.doesNotMatch(m, /'construccion'|enObra|ConstruccionM|Qué grafo ver/, 'nada que cambie un grafo por otro');
  assert.equal((m.match(/<MapaChico /g) ?? []).length, 1, 'una sola foto');
  assert.match(m, /<MapaChico cerebro=\{grafo\} nuevos=\{nuevos\} \/>/);
  assert.match(m, /<VistaCerebro\s+movil\s+cerebro=\{grafo\}/, 'el grafo entero, el mismo cerebro');
  assert.ok(!existsSync(join(RAIZ, 'app/m/second-brain/ConstruccionM.tsx')), 'la vista aparte de la construcción se fue');
});

test('la regla queda escrita donde la leen todos antes de escribir', () => {
  assert.match(leer('AGENTS.md'), /NINGÚN CEREBRO SE DIVIDE EN DOS/);
});
