// =============================================================================
// La prueba A/B de una landing, servida y contada (O18, L2; 18/11/2026)
// =============================================================================
// AGENTS.md, «Una prueba A/B la decide lib/pruebas/juez.ts»: servir es `servirRama` (nunca un sorteo sin registro) y contar es
// `conteosPorRama`. Lo que se fija, EJECUTADO y con dobles de la base:
//   1. `ramaParaServir` respeta la rama que trae la cookie del servidor (`preferida`) sólo si está activa;
//   2. `conteosPorRama` saca del denominador a quien no vio la página (`cuenta: false`) sin tomarlo como un hueco;
//   3. `resultadosDeLanding`: el denominador es quien tuvo una visita desde la asignación; el éxito, el PRIMER evento desde
//      la asignación (con el minuto de tolerancia) y hasta el fin de ayer;
//   4. `destinoCuenta`: el destino congelado, con su query o su ancla, y no uno que sólo empieza igual;
//   5. `servirPruebaDeLanding`: sin prueba corriendo, nada; lo de MaKo va fijo a A; una B armada sobre otra versión o con
//      otra estructura no se sirve NI SE ASIGNA; un visitante nuevo recibe su cookie y la de la rama; la rama de la cookie
//      viaja como preferida; el control sirve A;
//   6. `responderPublico` con la prueba: privada, por cookie, sin el borde de Vercel, con las dos cookies (también en el 304);
//      y si decidir la prueba tira, sale A como siempre.
// La puerta del juez sigue siendo tests/pruebas-juez-aa.test.ts (no se tocó el juez).
//
// PROBADO ROMPIÉNDOLO (18/11/2026), sobre una base de 8 / 0:
//   R1 `ramaParaServir` sin la rama `preferida`                                  → 7 / 1 (el 1)
//   R2 `conteosPorRama` sin el `cuenta === false`                                 → 7 / 1 (el 2)
//   R3 `resultadosDeLanding` sin exigir la visita (todos cuentan)                 → 7 / 1 (el 3)
//   R4 `servirPruebaDeLanding` sin la revisión de estructura                      → 7 / 1 (el 5b)
//   R5 `responderPublico` dejando el caché del borde con prueba                    → 7 / 1 (el 6)
// Restaurado, 8 / 0. (La primera vuelta de R1 quedó en verde: la unidad caía en B por la huella; ahora cae en A.)
//
// Correr: node --import tsx --test tests/pruebas-landing.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ramaParaServir } from '../lib/pruebas/asignar';
import { conteosPorRama, type Asignacion, type Resultado } from '../lib/pruebas/metricas';
import { destinoCuenta, resultadosDeLanding } from '../lib/pruebas/medidores-landing-reglas';
import { servirPruebaDeLanding, type DepServir, type SitioServible } from '../lib/editor-landing/prueba-landing-servir';
import { nombreCookiePrueba } from '../lib/editor-landing/prueba-landing';
import { responderPublico, type Entorno } from '../lib/editor-landing/pagina-publica';
import { CONFIG_DEFAULT } from '../lib/editor-landing/api-tipos';
import type { PruebaGuardada, RamaGuardada } from '../lib/pruebas/store';

const HTML_A = '<section class="gm-tarjeta" id="t-1"><h1>Vende más con tu landing</h1><a href="https://pago.example/x">Comprar</a></section>';
const HTML_B = '<section class="gm-tarjeta" id="t-1"><h1>Tu landing, lista para vender hoy</h1><a href="https://pago.example/x">Comprar</a></section>';
const HTML_B_OTRO_BOTON = '<section class="gm-tarjeta" id="t-1"><h1>Otro gancho</h1><a href="https://otro.example/y">Comprar</a></section>';

const sitio = (): SitioServible => ({
  workspaceId: 9, docId: 40, titulo: 'Landing de ejemplo',
  foto: { css: '.a{}', fuentes: '', sitio: CONFIG_DEFAULT.sitio, temaId: 'pewter', paginas: [{ ruta: '', html: HTML_A, titulo: 'Inicio', descripcion: '' }], config: CONFIG_DEFAULT, version: 5 },
  pagina: { html: HTML_A, titulo: 'Inicio', descripcion: '' },
  estructura: {},
});
const fotoB = (html = HTML_B) => ({ v: 1, paginas: [{ ruta: '', html, titulo: 'Inicio', descripcion: '' }], css: '.b{}', fuentes: '', config: CONFIG_DEFAULT, version: 5, publicadoAt: null });
const rama = (clave: string, o: Partial<RamaGuardada> = {}): RamaGuardada => ({
  id: clave.charCodeAt(0), clave, control: clave === 'A', nombre: clave === 'A' ? 'Sin cambio' : 'Otro gancho', peso: 50,
  contenido: clave === 'A' ? {} : fotoB(), firma: null, activa: true, autor: 'dueno', ...o,
});
const prueba = (o: Partial<PruebaGuardada> = {}): PruebaGuardada => ({
  id: 77, ws: 9, superficie: 'landing', lugar: { doc_id: 40, version_base: 5 }, claveLugar: 'landing:40', titulo: 'Gancho', hipotesis: 'Un gancho más directo',
  cambio: null, origen: 'dueno', unidad: 'visitante', metrica: 'clic_conversion', metricaDef: { destinos: ['https://pago.example/x'] }, guardrails: [],
  ventanaDias: 7, tasaBase: 0.1, mdeRel: 0.5, nPorRama: 300, minDias: 7, maxDias: 60, epoca: 1, epocaAt: '2026-11-01T00:00:00Z', autoAplicar: false,
  estado: 'corriendo', veredicto: null, sirviendo: null, experimentoId: null, iniciadaAt: '2026-11-01T00:00:00Z', concluidaAt: null,
  ultimaLecturaAt: null, ultimaLecturaError: null, ramas: [rama('A'), rama('B')], ...o,
});

type Llamada = { unidad: string; preferida: string | null };
function dobles(p: PruebaGuardada | null, devuelve = 'B'): { dep: DepServir; llamadas: Llamada[]; avisos: string[] } {
  const llamadas: Llamada[] = [];
  const avisos: string[] = [];
  return {
    llamadas, avisos,
    dep: {
      pruebaViva: async (ws, clave) => (ws === 9 && clave === 'landing:40' ? p : null),
      servirRama: async (_ws, _p, unidad, o) => { llamadas.push({ unidad, preferida: o.preferida }); return devuelve; },
      normalizarConfig: (c) => c,
      nuevoVisitante: () => 'visitante-nuevo-0001',
      ahora: () => new Date('2026-11-18T12:00:00Z'),
      avisar: (t) => avisos.push(t),
    },
  };
}
const pedido = (cookie?: string, ua = 'Mozilla/5.0') => new Request('https://hola-mako.site/mi-landing', { headers: { 'user-agent': ua, ...(cookie ? { cookie } : {}) } });

test('1. la rama de la cookie del servidor se respeta si está activa; si no, decide la huella', () => {
  const p = { id: 77, estado: 'corriendo', epoca: 1, ramas: [{ clave: 'A', peso: 50, control: true }, { clave: 'B', peso: 50 }] };
  // `v-0000000002` cae en A por la huella de la prueba 77 (medido): así la preferida B se distingue de la huella.
  assert.deepEqual(ramaParaServir(p, 'v-0000000002', null), { clave: 'A', escribir: true }, 'la huella sola');
  assert.deepEqual(ramaParaServir(p, 'v-0000000002', null, 'B'), { clave: 'B', escribir: true }, 'la rama que ya vio');
  assert.deepEqual(ramaParaServir(p, 'v-0000000002', 'A', 'B'), { clave: 'A', escribir: false }, 'la rama guardada manda sobre la cookie');
  const cortada = { ...p, ramas: [{ clave: 'A', peso: 50, control: true }, { clave: 'B', peso: 50, activa: false }] };
  assert.equal(ramaParaServir(cortada, 'v-0000000002', null, 'B').clave, 'A', 'una rama cortada no se respeta');
  assert.deepEqual(ramaParaServir(p, 'v-0000000002', null, 'Z'), { clave: 'A', escribir: true }, 'una rama que no es de la prueba: decide la huella');
});

test('2. quien no vio la página sale del denominador sin ser un hueco', () => {
  const asig: Asignacion[] = [
    { unidad: 'v-aaaaaaaa1', rama: 'A', asignadaAt: '2026-11-01T10:00:00Z' },
    { unidad: 'v-aaaaaaaa2', rama: 'A', asignadaAt: '2026-11-01T10:00:00Z' },
    { unidad: 'v-bbbbbbbb1', rama: 'B', asignadaAt: '2026-11-01T10:00:00Z' },
  ];
  const res = new Map<string, Resultado>([
    ['v-aaaaaaaa1', { logro: true, at: '2026-11-02T10:00:00Z' }],
    ['v-aaaaaaaa2', { logro: false, cuenta: false }],
    ['v-bbbbbbbb1', { logro: false }],
  ]);
  const c = conteosPorRama(asig, res, { ramas: [{ clave: 'A', control: true }, { clave: 'B' }], ventanaDias: 7, hasta: '2026-11-17T23:59:59Z', metrica: 'clic_conversion' });
  assert.ok(c.ok);
  assert.deepEqual(c.ramas.map((r) => [r.clave, r.n, r.x]), [['A', 1, 1], ['B', 1, 0]], 'el que no vio la página no cuenta en A');
  assert.equal(c.asignados.A, 2, 'pero sí entre los asignados (lo que dice la pantalla)');
});

test('3. el denominador es quien vio la página, y el éxito su primer evento dentro de la ventana', () => {
  const asig: Asignacion[] = [
    { unidad: 'v-vio-y-clic', rama: 'B', asignadaAt: '2026-11-10T10:00:00Z' },
    { unidad: 'v-vio-sin-clic', rama: 'B', asignadaAt: '2026-11-10T10:00:00Z' },
    { unidad: 'v-bot-sin-pixel', rama: 'A', asignadaAt: '2026-11-10T10:00:00Z' },
    { unidad: 'v-clic-de-antes', rama: 'A', asignadaAt: '2026-11-10T10:00:00Z' },
    { unidad: 'desconocido', rama: 'A', asignadaAt: '2026-11-10T10:00:00Z' },
  ];
  const visitas = [
    { unidad: 'v-vio-y-clic', at: '2026-11-10T09:59:30Z' }, // el Pixel se adelantó medio minuto a la asignación
    { unidad: 'v-vio-sin-clic', at: '2026-11-10T10:00:05Z' },
    { unidad: 'v-clic-de-antes', at: '2026-11-10T10:00:05Z' },
  ];
  const logros = [
    { unidad: 'v-vio-y-clic', at: '2026-11-12T08:00:00Z' },
    { unidad: 'v-vio-y-clic', at: '2026-11-11T08:00:00Z' },
    { unidad: 'v-clic-de-antes', at: '2026-11-09T08:00:00Z' },
    { unidad: 'v-vio-sin-clic', at: '2026-11-18T08:00:00Z' }, // después del fin de ayer: no se mira
  ];
  const r = resultadosDeLanding(asig, visitas, logros, '2026-11-17T23:59:59Z');
  assert.deepEqual(r.get('v-vio-y-clic'), { logro: true, at: '2026-11-11T08:00:00.000Z' }, 'el primero');
  assert.deepEqual(r.get('v-vio-sin-clic'), { logro: false });
  assert.deepEqual(r.get('v-bot-sin-pixel'), { logro: false, cuenta: false }, 'sin visita no entra al denominador');
  assert.deepEqual(r.get('v-clic-de-antes'), { logro: false }, 'un clic de antes de la asignación no es de la prueba');
  assert.equal(r.has('desconocido'), false);
});

test('4. el destino congelado cuenta con su query o su ancla, no uno que sólo empieza igual', () => {
  const d = ['https://pago.example/x', 'https://agenda.example/'];
  assert.equal(destinoCuenta('https://pago.example/x', d), true);
  assert.equal(destinoCuenta('https://pago.example/x?off=abc', d), true);
  assert.equal(destinoCuenta('https://pago.example/x#paso', d), true);
  assert.equal(destinoCuenta('https://agenda.example/martes', d), true);
  assert.equal(destinoCuenta('https://pago.example/xyz', d), false);
  assert.equal(destinoCuenta('https://otro.example/x', d), false);
  assert.equal(destinoCuenta(null, d), false);
});

test('5a. sin prueba corriendo no cambia nada, y lo de MaKo va fijo a A sin asignar', async () => {
  assert.equal(await servirPruebaDeLanding(sitio(), '', pedido(), dobles(null).dep), null);
  assert.equal(await servirPruebaDeLanding(sitio(), '', pedido(), dobles(prueba({ estado: 'propuesta' })).dep), null, 'una propuesta no se sirve');
  const { dep, llamadas } = dobles(prueba());
  const r = await servirPruebaDeLanding(sitio(), '', pedido(undefined, 'MaKoPixel/1.0 (vigilancia)'), dep);
  assert.equal(r?.lectura.pagina.html, HTML_A);
  assert.equal(r?.cabeceras['Cache-Control'], 'private, no-cache', 'privada igual: el borde no guarda A durante la prueba');
  assert.deepEqual(r?.setCookie, []);
  assert.equal(llamadas.length, 0);
});

test('5b. una B armada sobre otra versión, o con otra estructura, no se sirve ni se asigna', async () => {
  const otraVersion = dobles(prueba({ lugar: { doc_id: 40, version_base: 4 } }));
  assert.equal((await servirPruebaDeLanding(sitio(), '', pedido(), otraVersion.dep))?.lectura.pagina.html, HTML_A);
  assert.equal(otraVersion.llamadas.length, 0);
  const otroBoton = dobles(prueba({ ramas: [rama('A'), rama('B', { contenido: fotoB(HTML_B_OTRO_BOTON) })] }));
  const r = await servirPruebaDeLanding(sitio(), '', pedido(), otroBoton.dep);
  assert.equal(r?.lectura.pagina.html, HTML_A);
  assert.equal(otroBoton.llamadas.length, 0, 'nadie queda contado en una B que no se puede mostrar');
  assert.match(otroBoton.avisos.join(' '), /rama B cambia lo que la página de inicio lleva/);
});

test('5c. un visitante nuevo recibe su cookie y la de la rama; la rama de la cookie viaja como preferida', async () => {
  const nuevo = dobles(prueba(), 'B');
  const r = await servirPruebaDeLanding(sitio(), '', pedido(), nuevo.dep);
  assert.equal(r?.lectura.pagina.html, HTML_B);
  assert.equal(r?.lectura.foto.css, '.b{}', 'con la hoja de B');
  assert.deepEqual(nuevo.llamadas, [{ unidad: 'visitante-nuevo-0001', preferida: null }]);
  assert.ok(r?.setCookie.some((c) => c.startsWith('nqe_visitor_id=visitante-nuevo-0001;') && !/HttpOnly/i.test(c)), 'la del visitante la lee el Pixel');
  assert.ok(r?.setCookie.some((c) => c.startsWith(`${nombreCookiePrueba(77)}=B;`) && /HttpOnly/.test(c)));

  const vuelve = dobles(prueba(), 'B');
  await servirPruebaDeLanding(sitio(), '', pedido(`nqe_visitor_id=visitante-de-safari-02; ${nombreCookiePrueba(77)}=B`), vuelve.dep);
  assert.deepEqual(vuelve.llamadas, [{ unidad: 'visitante-de-safari-02', preferida: 'B' }]);

  const control = dobles(prueba(), 'A');
  const a = await servirPruebaDeLanding(sitio(), '', pedido('nqe_visitor_id=visitante-de-antes-03'), control.dep);
  assert.equal(a?.lectura.pagina.html, HTML_A);
  assert.ok(a?.setCookie.some((c) => c.startsWith(`${nombreCookiePrueba(77)}=A;`)));
  assert.equal(a?.setCookie.some((c) => c.startsWith('nqe_visitor_id=')), false, 'ya tenía su cookie');
});

test('6. la página con prueba: privada, por cookie, sin el borde, con sus cookies; si la prueba tira, sale A como siempre', async () => {
  const ENTORNO: Entorno = { appBaseUrl: 'https://hola-mako.com', prefijoBucket: 'https://proy.supabase.co/storage/v1/object/public/landing-imagenes/' };
  const TOKEN = `mko_${'b2'.repeat(16)}`;
  const { dep } = dobles(prueba(), 'B');
  const req = pedido();
  const s = sitio();
  const r = await responderPublico(req, { tipo: 'pagina', slug: 'mi-landing', ruta: '' }, {
    leer: async () => s, probar: () => servirPruebaDeLanding(s, '', req, dep), tokenPixel: async () => TOKEN, entorno: ENTORNO,
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'private, no-cache');
  assert.equal(r.headers.get('vary'), 'Cookie');
  assert.equal(r.headers.get('vercel-cdn-cache-control'), null, 'con prueba, nada en el borde');
  const cookies = r.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.match(await r.text(), /Tu landing, lista para vender hoy/);

  const req304 = new Request('https://hola-mako.site/mi-landing', { headers: { 'user-agent': 'Mozilla/5.0', 'if-none-match': r.headers.get('etag') ?? '' } });
  const r304 = await responderPublico(req304, { tipo: 'pagina', slug: 'mi-landing', ruta: '' }, {
    leer: async () => s, probar: () => servirPruebaDeLanding(s, '', req304, dep), tokenPixel: async () => TOKEN, entorno: ENTORNO,
  });
  assert.equal(r304.status, 304, 'la misma rama, el mismo documento');
  assert.equal(r304.headers.getSetCookie().length, 2, 'las cookies van también en el 304');

  const caida = await responderPublico(pedido(), { tipo: 'pagina', slug: 'mi-landing', ruta: '' }, {
    leer: async () => s, probar: async () => { throw new Error('la base no contestó'); }, tokenPixel: async () => TOKEN, entorno: ENTORNO,
  });
  assert.equal(caida.status, 200);
  assert.equal(caida.headers.get('cache-control'), 'public, no-cache');
  assert.equal(caida.headers.get('vercel-cdn-cache-control'), 's-maxage=30, stale-while-revalidate=300', 'sin prueba, el borde como siempre');
  assert.match(await caida.text(), /Vende más con tu landing/);
});
