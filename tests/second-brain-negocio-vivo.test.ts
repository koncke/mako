// =============================================================================
// Second Brain — el grafo «Negocio» se arma con lo que MaKo SABE hoy (18/10/2026, segunda punta)
// =============================================================================
// Martín (directo, 18/10/2026): «los nodos de los grafos de "Negocio" de Super Admin, como todos los nodos de los demás
// workspace, se deben siempre ajustar a lo que MaKo sepa... No tengas miedo en quitarle nodos, o agregarles. Si les falta
// info ya la irán completando... No te quedes con la vieja estructura de nodos que teníamos».
//   · SE AGREGAN las dos fuentes de la venta que el grafo no leía: los CLIENTES (leads con la venta ganada) y las REUNIONES
//     de venta que el Closing Analyst ya leyó. Un nodo sin datos no aparece; uno nuevo aparece solo (el grafo es vivo).
//   · SE QUITA la estructura fija de huecos: once nodos `falta:<área>` colgados de la raíz, iguales para todos los negocios.
//     Lo que falta se DICE (en la raíz y en la barra lateral) y no se dibuja.
//
// Verificado ROMPIÉNDOLO (18/10/2026), cada rotura contra la base en verde (8 / 0) y restaurando después (pasan / fallan):
//   · los clientes sin tope (se cuelgan todos)                                       → 7 / 1  (clientes: UN nodo con el total exacto)
//   · los clientes sin la arista a «N clientes»                                      → 7 / 1  (ídem)
//   · una reunión que no se cuelga del cliente que compró                            → 7 / 1  (reuniones)
//   · `falta:<área>` dibujado otra vez en el constructor                             → 7 / 1  (ya no hay once nodos `falta:`)
//   · los clientes y las reuniones colgados también del nodo de área (hub inflado)    → 7 / 1  (el hub inflado)
//   · una lectura nueva sin su `.catch` (una fuente que falle tumba el mapa)          → 7 / 1  (el constructor lee sin tumbar)
//   · «Sin completar» ofrecido aunque no haya nada sin completar                     → 7 / 1  (el filtro)
//   (la primera vez, `falta:` con otra variable pasaba: la prueba miraba `a.id` y no el prefijo; ahora mira el prefijo)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AristaCerebro, NodoCerebro } from '../lib/cerebro-modelo';
import { agregarLoVivo, LECTURAS_VACIAS, TOPES_VIVOS, type LecturasVivas, type ReunionViva } from '../lib/cerebro-vivo';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const n = (id: string, area: NodoCerebro['area'], extra: Partial<NodoCerebro> = {}): NodoCerebro => ({
  id, area, etiqueta: id, detalle: '', fuente: '', autoria: 'mako', ...extra,
});
function base(): { nodos: NodoCerebro[]; aristas: AristaCerebro[] } {
  return {
    nodos: [n('raiz', 'norte', { etiqueta: 'Coaching de ventas' }), n('etapa:lead', 'funnel', { etiqueta: 'Lead' }), n('etapa:agenda', 'funnel', { etiqueta: 'Agendó' })],
    aristas: [{ de: 'etapa:lead', a: 'etapa:agenda', motivo: 'Avanza' }],
  };
}
const LEADS = { total: 120, nuevos7d: 9, sinAsignar: 4, porEtapa: [{ key: 'lead', leads: 80 }], origenes: [{ origen: 'directo', leads: 120 }] };
const reunion = (id: number, extra: Partial<ReunionViva> = {}): ReunionViva => ({
  id, leadId: null, leadNombre: `Lead ${id}`, titulo: null, fecha: '2026-10-1' + (id % 9) + 'T15:00:00Z', tipo: 'R1', closer: 'Mauricio',
  score: 7.5, outcome: 'Cierre ganado', resumen: 'Una llamada de venta.', duracionMin: 42, ...extra,
});
function armar(l: Partial<LecturasVivas>) {
  const g = base();
  agregarLoVivo(g, { ...LECTURAS_VACIAS, leads: LEADS, ...l }, { raiz: 'raiz', primeraEtapa: 'etapa:lead', etapasEnMapa: new Set(['etapa:lead', 'etapa:agenda']) });
  const porId = new Map(g.nodos.map((x) => [x.id, x]));
  const arista = (de: string, a: string) => g.aristas.find((x) => x.de === de && x.a === a);
  return { ...g, porId, arista };
}

test('clientes: UN nodo con el total exacto y los más recientes con tope, cada uno colgado de él', () => {
  const total = 40;
  const recientes = Array.from({ length: TOPES_VIVOS.clientes + 4 }, (_, i) => ({ leadId: 500 + i, nombre: `Cliente ${i}`, empresa: i % 2 ? `Empresa ${i}` : null, fechaCierre: '2026-10-1' + (i % 9), sinCobro: i === 1 }));
  const g = armar({ clientes: { total, recientes } });
  const hub = g.porId.get('clientes')!;
  assert.equal(hub.etiqueta, `${total} clientes`, 'el total EXACTO, no los que se leyeron');
  assert.equal(hub.area, 'funnel');
  assert.equal(hub.href, '/classroom/clients', 'la tab se llama Clients (lib/clients-rutas.ts): /customer-success es una ruta que redirige');
  assert.equal(g.nodos.filter((x) => x.id.startsWith('cliente:')).length, TOPES_VIVOS.clientes, 'con tope: el volumen no es un nodo por cliente');
  for (const c of recientes.slice(0, TOPES_VIVOS.clientes)) assert.ok(g.arista(`cliente:${c.leadId}`, 'clientes'), `el cliente ${c.leadId} cuelga de «N clientes»`);
  assert.ok(g.arista('clientes', 'leads'), '«N clientes» sale de los leads');
  const becado = g.porId.get('cliente:501')!;
  assert.ok((becado.datos ?? []).some((d) => d.k === 'Venta' && d.v.startsWith('Becado')), 'un becado se dice');
  assert.equal(becado.nace, '2026-10-11', 'nace es la fecha de cierre, nunca una inventada');
  // La ficha, no la lista (20/10/2026: hasta ese día esto fijaba '/crm?lead=500', que abría la lista del CRM).
  assert.equal(g.porId.get('cliente:500')!.href, '/crm/500');
});

test('clientes y reuniones: sin datos no hay nodos (un nodo sin datos no aparece)', () => {
  const g = armar({ clientes: { total: 0, recientes: [] }, reuniones: [] });
  assert.ok(!g.nodos.some((x) => x.id === 'clientes' || x.id.startsWith('cliente:') || x.id.startsWith('reunion:')));
  const sin = armar({ clientes: null });
  assert.ok(!sin.porId.has('clientes'), 'una lectura que falló (null) tampoco dibuja nada');
  // Y el total cuenta aunque no se hayan leído los recientes: el nodo dice cuántos hay.
  assert.equal(armar({ clientes: { total: 3, recientes: [] } }).porId.get('clientes')!.etiqueta, '3 clientes');
  assert.equal(armar({ clientes: { total: 1, recientes: [] } }).porId.get('clientes')!.etiqueta, '1 cliente');
});

test('reuniones: las más recientes con tope; cada una cuelga del cliente que compró, si no de los leads', () => {
  const reuniones = [reunion(1, { leadId: 500 }), reunion(2, { leadId: 999 }), reunion(3, { leadId: null, leadNombre: null, titulo: 'Llamada con Ana', tipo: null }),
    ...Array.from({ length: 10 }, (_, i) => reunion(10 + i))];
  const g = armar({ clientes: { total: 1, recientes: [{ leadId: 500, nombre: 'Ana', empresa: null, fechaCierre: '2026-10-15', sinCobro: false }] }, reuniones });
  assert.equal(g.nodos.filter((x) => x.id.startsWith('reunion:')).length, TOPES_VIVOS.reuniones, 'con tope');
  assert.ok(g.arista('reunion:1', 'cliente:500'), 'la reunión de un cliente cuelga del cliente');
  assert.equal(g.arista('reunion:1', 'cliente:500')?.motivo, 'La reunión de venta de este cliente');
  assert.ok(g.arista('reunion:2', 'leads'), 'un lead que no compró: de los leads');
  assert.ok(!g.arista('reunion:2', 'cliente:999'));
  const r1 = g.porId.get('reunion:1')!;
  assert.equal(r1.tipo, 'Reunión R1');
  assert.equal(r1.href, '/dashboard?hoja=closing', 'Closing Analyst vive en una hoja del Dashboard: /closing es una tab retirada');
  const dato = (id: string, k: string) => (g.porId.get(id)!.datos ?? []).find((d) => d.k === k)?.v;
  assert.equal(dato('reunion:1', 'Puntaje'), '7,5 de 10');
  assert.equal(dato('reunion:1', 'Duración'), '42 min');
  assert.equal(g.porId.get('reunion:3')!.etiqueta, 'Llamada con Ana', 'sin lead, el título de la grabación');
  assert.equal(g.porId.get('reunion:3')!.tipo, 'Reunión de venta');
  // Sin el nodo de leads (el conteo del CRM falló) la reunión cuelga del funnel / la primera etapa, nunca queda suelta.
  const sinLeads = armar({ leads: null, reuniones: [reunion(1)] });
  assert.ok(sinLeads.aristas.some((a) => a.de === 'reunion:1'));
});

test('el constructor lee clientes y reuniones sin que una fuente caída tumbe el mapa', () => {
  const g = sinComentarios(leer('lib/cerebro-grafo.ts'));
  // Desde el 28/10/2026 la lectura caída AVISA (`vacioAvisando`: el grafo de los chats no guarda uno incompleto), y se
  // degrada igual a vacío: el mapa no se cae.
  assert.match(g, /leerClientes\(\)\.catch\(vacioAvisando\(alFallar, 'leerClientes', null\)\)/);
  assert.match(g, /leerReuniones\(\)\.catch\(vacioAvisando\(alFallar, 'leerReuniones', \[\]\)\)/);
  assert.match(g, /\.eq\('estado_lead', 'ganado'\)/, '«cliente» es un lead con la venta ganada (lib/clientes-ganados.ts)');
  assert.match(g, /\.from\('closing_analyses'\)[\s\S]*?\.eq\('status', 'analizada'\)[\s\S]*?\.eq\('category', 'venta'\)/, 'sólo reuniones de venta ya leídas');
  assert.match(g, /\.limit\(TOPES_VIVOS\.clientes\)/);
  assert.match(g, /\.limit\(TOPES_VIVOS\.reuniones\)/);
  assert.match(g, /\{ count: 'exact' \}/, 'el total de clientes es exacto, no los que se leyeron');
});

test('los clientes y las reuniones no cuelgan además del nodo de área del funnel (el hub inflado)', () => {
  const g = sinComentarios(leer('lib/cerebro-grafo.ts'));
  assert.match(g, /nutricionDelFunnel\.has\(n\.id\) \|\| \/\^\(cliente\|reunion\):\/\.test\(n\.id\)\) continue;/);
});

test('ya no hay once nodos `falta:` fijos: lo que falta se dice en la raíz', () => {
  const g = sinComentarios(leer('lib/cerebro-grafo.ts'));
  assert.doesNotMatch(g, /`falta:/, 'sin los nodos de hueco por área (con la variable que sea)');
  assert.doesNotMatch(g, /Todavía sin construir/);
  assert.match(g, /k: 'Todavía sin info'/, 'la raíz lo dice');
  assert.match(g, /const vacias: AreaId\[\] = AREAS\.filter\(\(a\) => !conNodos\.has\(a\.id\)\)/, 'y `vacias` sigue (el ZIP y la barra lateral lo usan)');
});

test('«Sin completar» del filtro se ofrece sólo si hay algo sin completar', () => {
  const f = sinComentarios(leer('app/second-brain/FiltroMapa.tsx'));
  assert.match(f, /AUTORIA_OPS\.filter\(\(o\) => o\.id !== 'falta' \|\| conteoAutoria\.falta > 0 \|\| filtro\.autoria === 'falta'\)\.map\(/);
});

test('lo nuevo aparece solo: las dos fuentes entran al grafo vivo que se vuelve a pedir', () => {
  const v = sinComentarios(leer('lib/cerebro-vivo.ts'));
  assert.match(v, /clientes\?: ClientesVivos \| null;/);
  assert.match(v, /reuniones\?: ReunionViva\[\];/);
  const g = sinComentarios(leer('lib/cerebro-grafo.ts'));
  assert.match(g, /\.\.\.LECTURAS_VACIAS,\s*clientes, reuniones,/);
  // La huella del contenido incluye todos los nodos: un cliente nuevo cambia la huella y la pantalla lo pide y lo dibuja.
  assert.match(g, /huella: huellaDeContenido\(nodos, aristas\)/);
});
