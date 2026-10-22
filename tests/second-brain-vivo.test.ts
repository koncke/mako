// =============================================================================
// Second Brain — punto 13a del feedback del 17/10/2026: lo que el negocio TIENE hoy, como nodos, y el nodo que viaja
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · lib/cerebro-vivo.ts suma ofertas (sólo las activas), sus productos y funnels, los lead magnets, TODOS los
//     funnels, los leads como UN nodo (y cuántos hay en cada etapa como dato de la etapa, nunca un nodo por lead), los
//     OKR y KPI, los chats de Offer y los chats con MaKo de quien mira; cada nodo con su tipo, su fecha y su «Abrir en»;
//     ninguna arista con una punta que no existe;
//   · un chat con MaKo se cuelga de lo que NOMBRA su título; los que no nombran nada van juntos en un nodo;
//   · un producto que una oferta incluye no lleva además la arista vieja al brief (lib/cerebro-grafo.ts);
//   · lo NUEVO es lo que no estaba la última vez (null la primera vez: no viaja todo), del más reciente al más viejo;
//   · la fecha corta sale del texto (no de la zona horaria del servidor) y «Lo último» no trae estructura ni pendientes;
//   · el grafo vivo: el bucle de dibujo arranca UNA vez (una vuelta del grafo vivo no rearma el mapa entero), un nodo
//     que viaja no tiene aristas hasta aterrizar, y la pantalla pide con la huella y sólo con la pestaña a la vista.
//
// Verificado ROMPIÉNDOLO (17/10/2026), cada rotura contra la base en verde (10 / 0) y restaurando después:
//   · `agregarLoVivo` sin filtrar las ofertas inactivas: 9 / 1.
//   · el nodo de los leads con un id de «uno por lead» (`lead:todos`): 9 / 1.
//   · el funnel principal sin engancharse con su primera etapa: 9 / 1.
//   · los chats que no nombran nada, cada uno como nodo suelto (sin el agregado `chats`): 9 / 1.
//   · el producto con oferta llevando igual la arista al brief (sin `!conOferta.has(`): 9 / 1.
//   · `nuevosDesde` devolviendo [] en vez de null sin nada guardado: 9 / 1.
//   · `fechaCortaNodo` con toLocaleDateString: 9 / 1.
//   · el bucle de Grafo.tsx con `[posiciones]` otra vez: 9 / 1.
//   · las aristas de un nodo que espera, dibujadas: 9 / 1.
//   · la pantalla pidiendo el grafo sin mirar si la pestaña está a la vista: 9 / 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AristaCerebro, NodoCerebro } from '../lib/cerebro-modelo';
import { agregarLoVivo, LECTURAS_VACIAS, TOPES_VIVOS, type LecturasVivas } from '../lib/cerebro-vivo';
import { claveVistos, fechaCortaNodo, idsVistos, nuevosDesde, ultimosDelCerebro } from '../lib/cerebro-areas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const n = (id: string, area: NodoCerebro['area'], extra: Partial<NodoCerebro> = {}): NodoCerebro => ({
  id, area, etiqueta: id, detalle: '', fuente: '', autoria: 'mako', ...extra,
});

/** El grafo «de antes» (lo que arma lib/cerebro-grafo.ts antes de llamar a agregarLoVivo). */
function base(): { nodos: NodoCerebro[]; aristas: AristaCerebro[] } {
  return {
    nodos: [
      n('raiz', 'norte', { etiqueta: 'Coaching de ventas' }),
      n('fase', 'norte', { etiqueta: 'Fase 2 · Tracción' }),
      n('campo:oferta_nombre', 'oferta', { etiqueta: 'Oferta' }),
      n('prod:7', 'productos', { etiqueta: 'Mentoría Premium' }),
      n('prod:8', 'productos', { etiqueta: 'Curso Base' }),
      n('etapa:lead', 'funnel', { etiqueta: 'Lead' }),
      n('etapa:agenda', 'funnel', { etiqueta: 'Agendó' }),
    ],
    aristas: [{ de: 'etapa:lead', a: 'etapa:agenda', motivo: 'Avanza' }],
  };
}

const LECTURAS: LecturasVivas = {
  ...LECTURAS_VACIAS,
  ofertas: [
    { id: 1, nombre: 'Programa Cierra Más', precio_usd: 1500, modelo: 'unico', precio_nota: null, promesa: 'Duplicas tus cierres en 90 días', incluye: '12 sesiones', garantia: '30 días', bonos: [{ nombre: 'Guiones' }], es_principal: true, activa: true, origen: 'offer' },
    { id: 2, nombre: 'Oferta vieja', precio_usd: 99, precio_nota: null, promesa: null, incluye: null, garantia: null, es_principal: false, activa: false, origen: 'manual' },
  ],
  ligasProducto: [{ oferta_id: 1, producto_id: 7, rol: 'principal' }, { oferta_id: 2, producto_id: 8, rol: 'principal' }],
  ligasFunnel: [{ funnel_id: 10, oferta_id: 1, es_principal: true }, { funnel_id: 10, oferta_id: 2, es_principal: false }],
  leadMagnets: [{ id: 5, oferta_id: 1, nombre: 'Checklist de cierre', tipo: 'pdf', que_es: 'Una lista', fomo: null, enlace: null }],
  funnels: [{ id: 10, nombre: 'VSL', canal: 'llamadas', esDefault: true }, { id: 11, nombre: 'Renovación', canal: null, esDefault: false }],
  leads: { total: 120, nuevos7d: 9, sinAsignar: 4, porEtapa: [{ key: 'lead', leads: 80 }, { key: 'agenda', leads: 40 }], origenes: [{ origen: 'Anuncio A', leads: 70 }, { origen: 'directo', leads: 50 }] },
  objetivos: [{ id: 'o1', titulo: 'Facturar 30k', metaValor: 30000, unidad: 'usd', quarter: 4, anio: 2026, funnelIds: [10] }],
  kpis: [{ id: 'k1', nombre: 'Agendas por día', objectiveId: 'o1', compromiso: 3, unidad: 'cantidad', cadencia: 'diaria', funnelIds: [] }],
  chatsOffer: Array.from({ length: TOPES_VIVOS.chatsOffer + 3 }, (_, i) => ({ id: 100 + i, titulo: `Oferta ${i}`, estado: 'abierta', updatedAt: '2026-10-1' + (i % 9) + 'T10:00:00Z' })),
  chatsMako: [
    { id: 300, titulo: 'Cómo vendo la Mentoría Premium', updatedAt: '2026-10-17T03:00:00Z' },
    { id: 301, titulo: 'Ideas para el fin de semana', updatedAt: '2026-10-16T03:00:00Z' },
  ],
  fechas: { ofertas: { '1': '2026-10-12T14:00:00Z' }, funnels: { '10': '2026-09-01T00:00:00Z' } },
};

function armar(l: LecturasVivas = LECTURAS) {
  const g = base();
  agregarLoVivo(g, l, { raiz: 'raiz', primeraEtapa: 'etapa:lead', etapasEnMapa: new Set(['etapa:lead', 'etapa:agenda']) });
  return { ...g, porId: new Map(g.nodos.map((x) => [x.id, x])) };
}

test('13a · las ofertas activas, con sus productos, su lead magnet y sus funnels', () => {
  const { nodos, aristas, porId } = armar();
  assert.ok(porId.has('oferta:1') && !porId.has('oferta:2'), 'sólo las activas');
  const o = porId.get('oferta:1')!;
  assert.equal(o.tipo, 'Oferta principal');
  assert.equal(o.nace, '2026-10-12T14:00:00Z');
  assert.equal(o.href, '/offer?oferta=1');
  assert.equal(o.abrirEn, 'Offer');
  assert.ok((o.datos ?? []).some((d) => d.k === 'Precio' && d.v === 'USD 1.500 · pago único'));
  const e = (de: string, a: string) => aristas.find((x) => x.de === de && x.a === a);
  assert.equal(e('oferta:1', 'prod:7')?.motivo, 'Lo que vende esta oferta');
  assert.ok(!aristas.some((x) => x.a === 'prod:8' && x.de === 'oferta:2'), 'una oferta inactiva no cuelga nada');
  assert.ok(e('campo:oferta_nombre', 'oferta:1'), 'la principal se une con el nombre del brief');
  assert.ok(e('oferta:1', 'lm:5'), 'el lead magnet cuelga de su oferta');
  assert.ok(e('funnel:10', 'oferta:1') && !e('funnel:10', 'oferta:2'));
  assert.ok(e('funnel:10', 'etapa:lead'), 'el funnel principal se engancha con su primera etapa');
  assert.ok(porId.has('funnel:11'), 'TODOS los funnels, no sólo el principal');
  const ids = new Set(nodos.map((x) => x.id));
  for (const a of aristas) assert.ok(ids.has(a.de) && ids.has(a.a), `arista con una punta que no existe: ${a.de} → ${a.a}`);
});

test('13a · los leads son UN nodo, y cuántos hay en cada etapa es un dato de la etapa', () => {
  const { nodos, porId, aristas } = armar();
  const leads = porId.get('leads');
  assert.ok(leads, 'el nodo de los leads');
  assert.equal(leads!.etiqueta, '120 leads');
  assert.ok(!nodos.some((x) => /^lead:/.test(x.id)), 'nunca un nodo por lead');
  assert.ok(aristas.some((a) => a.de === 'leads' && a.a === 'funnel:10'));
  assert.deepEqual(porId.get('etapa:lead')!.datos, [{ k: 'Leads hoy', v: '80' }]);
  assert.ok((leads!.datos ?? []).some((d) => d.k === 'De dónde vienen' && d.v.startsWith('Anuncio A (70)')));
});

test('13a · OKR, KPI, chats de Offer con tope, y los chats con MaKo colgados de lo que nombran', () => {
  const { porId, aristas, nodos } = armar();
  assert.ok(aristas.some((a) => a.de === 'okr:o1' && a.a === 'funnel:10'), 'el objetivo cuenta su funnel');
  assert.ok(aristas.some((a) => a.de === 'kpi:k1' && a.a === 'okr:o1'), 'el KPI mide su objetivo');
  assert.equal(nodos.filter((x) => x.id.startsWith('offerchat:')).length, TOPES_VIVOS.chatsOffer, 'con tope');
  assert.ok(aristas.some((a) => a.de === 'chat:300' && a.a === 'prod:7'), 'el chat que nombra un producto se cuelga de él');
  assert.ok(!porId.has('chat:301'), 'el que no nombra nada no es un nodo suelto');
  assert.match(porId.get('chats')!.detalle, /Ideas para el fin de semana/, 'va en el agregado');
  // Sin chats (el ZIP y la API): ni uno.
  const sin = armar({ ...LECTURAS, chatsMako: undefined });
  assert.ok(!sin.nodos.some((x) => x.id === 'chats' || x.id.startsWith('chat:')));
});

test('13a · un producto que una oferta incluye no lleva además la arista vieja al brief', () => {
  const g = sinComentarios(leer('lib/cerebro-grafo.ts'));
  assert.match(g, /if \(!conOferta\.has\(Number\(p\.id\)\)\) unir\(nodoOferta \?\? RAIZ, id,/);
  assert.match(g, /agregarLoVivo\(\{ nodos, aristas \}, vivo, \{/, 'lo vivo se suma en el constructor');
  const iVivo = g.indexOf('agregarLoVivo({ nodos, aristas }');
  const iAreas = g.indexOf('const nutricionDelFunnel = new Set(');
  assert.ok(iVivo > 0 && iVivo < iAreas, 'antes de los nodos de área: sus miembros entran al racimo');
});

test('13a · lo nuevo: lo que no estaba la última vez, null la primera vez', () => {
  const nodos = [n('raiz', 'norte'), n('area:oferta', 'oferta'), n('prod:1', 'productos', { nace: '2026-10-10T00:00:00Z' }),
    n('prod:2', 'productos', { nace: '2026-10-15T00:00:00Z' }), n('falta:voz', 'voz', { autoria: 'pendiente' }), n('fase', 'norte')];
  assert.equal(nuevosDesde(null, nodos), null, 'sin nada guardado no viaja nada');
  assert.deepEqual(nuevosDesde(['fase'], nodos)!.map((x) => x.id), ['prod:2', 'prod:1'], 'el más reciente primero, sin estructura ni pendientes');
  assert.deepEqual(nuevosDesde(['fase', 'prod:1', 'prod:2'], nodos), []);
  assert.deepEqual(idsVistos(nodos), ['prod:1', 'prod:2', 'fase']);
  assert.notEqual(claveVistos('Negocio A', null), claveVistos('Negocio B', null), 'dos negocios no se pisan');
  assert.notEqual(claveVistos('Negocio A', '3'), claveVistos('Negocio A', '1'), 'ni dos workspaces');
});

test('13a · la fecha corta sale del texto, y «Lo último» no trae estructura ni pendientes', () => {
  assert.equal(fechaCortaNodo('2026-10-17T23:59:00-03:00'), '17 oct', 'el día que dice la fila, no el del servidor');
  assert.equal(fechaCortaNodo('2026-01-05'), '5 ene');
  assert.equal(fechaCortaNodo(null), null);
  assert.equal(fechaCortaNodo('ayer'), null);
  const nodos = [n('area:x', 'oferta', { nace: '2026-10-17' }), n('a', 'oferta', { nace: '2026-10-01' }), n('b', 'oferta', { nace: '2026-10-09' }),
    n('c', 'oferta', { autoria: 'pendiente', nace: '2026-10-16' }), n('d', 'oferta')];
  assert.deepEqual(ultimosDelCerebro(nodos).map((x) => x.id), ['b', 'a']);
});

test('13a · el grafo vivo: el bucle arranca una vez y lo que ya estaba se desliza', () => {
  const g = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  const bucle = g.slice(g.indexOf('const latir = () =>'), g.indexOf('const primerGrafo = useRef(true);'));
  assert.match(bucle, /\}, \[\]\);/, 'el bucle es de montaje: con [posiciones] cada vuelta rearmaba el mapa entero');
  assert.match(g, /deslizarRef\.current = \{ desde: new Map\(baseRef\.current\), t: performance\.now\(\) - t0\.current \};/);
});

test('13a · el nodo que viaja: espera sin aristas, aterriza con su pop', () => {
  const g = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  assert.match(g, /if \(esperando\.has\(e\.de\) \|\| esperando\.has\(e\.a\)\) return null;/, 'sin aristas hasta aterrizar');
  assert.match(g, /key=\{saliendo\.has\(n\.id\) \? 'fuera' : esperando\.has\(n\.id\) \? 'espera' : 'dentro'\}/, 'el pop se repite al aterrizar');
  assert.match(g, /nuevosDesde\(antes, nodos, TOPE_VIAJEROS\)/, 'la regla de qué es nuevo es la compartida');
  assert.match(g, /if \(!nuevos\.length \|\| sinMovimiento\(\)\) return;/, 'con movimiento reducido no viaja nada');
  // El teléfono: desde el 22/10/2026 su pantalla ES este grafo (SecondBrainM.tsx), así que viaja con esta misma regla.
  const m = sinComentarios(leer('app/m/second-brain/SecondBrainM.tsx'));
  assert.match(m, /<VistaCerebro\s+movil\s/, 'el teléfono, con el mismo grafo');
});

test('13a · la pantalla pide el grafo con la huella, y sólo con la pestaña a la vista', () => {
  const v = sinComentarios(leer('app/second-brain/VistaCerebro.tsx'));
  assert.match(v, /if \(document\.visibilityState !== 'visible'\) return;/);
  assert.match(v, /\/api\/second-brain\/cerebro\$\{huella \? `\?huella=\$\{encodeURIComponent\(huella\)\}` : ''\}/);
  assert.match(v, /if \(vivo && j\?\.ok && !j\.igual && j\.cerebro\) setCerebro\(j\.cerebro\);/, 'sólo redibuja si cambió');
});

test('13a · la ruta del grafo vivo: la puerta del Second Brain primero', () => {
  const r = sinComentarios(leer('app/api/second-brain/cerebro/route.ts'));
  const cuerpo = r.slice(r.indexOf('export async function GET('));
  const dos = cuerpo.slice(cuerpo.indexOf('{') + 1).split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 2);
  assert.deepEqual(dos, ["const cerrada = await soloAdminDeTab('second-brain');", 'if (cerrada) return cerrada;']);
  assert.match(r, /if \(tenia && tenia === cerebro\.huella\) return Response\.json\(\{ ok: true, igual: true/);
});
