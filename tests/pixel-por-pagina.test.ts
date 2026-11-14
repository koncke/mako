// =============================================================================
// La tab Tracking nunca queda vacía sin explicar: la página por la que entró sin el Pixel (14/11/2026)
// =============================================================================
// La llamada de Martín con Julio (13/11, min 25:20): el tracking de un lead de Mauricio salió vacío «tal vez porque no
// instaló el Pixel» en esa página. La ficha sólo avisaba cuando el NEGOCIO entero no medía; Mauricio mide en su funnel
// principal, así que un lead que entró por OTRA página quedaba con «Sin datos para mostrar». Ahora se revisa SU página
// (la de su registro, o las de su funnel) en `landing_visits` y la ficha lo dice, con el botón para poner el Pixel.
//
// Correr: node --import tsx --test tests/pixel-por-pagina.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { REGLAS_TRACKING } from '../app/crm/lead-view/ficha/reglas-tracking';
import { desdeParaElPixel, paginasDelLead, pistaDePagina, sinPixelDe, textoSinTracking, veredictoDePagina } from '../lib/pixel-por-pagina-reglas';

const RAIZ = join(__dirname, '..');
let corrida: Record<string, any> | null = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_pixel-por-pagina-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  return corrida;
}

// La tarjeta de la tab, sin navegador, con lo que devolvió la lectura (todo en cero: un lead sin un solo evento). En su propio
// hijo: trae dos acciones de servidor que van de mentira.
const dibujar = (sinTracking: unknown, partes?: Record<string, boolean>): string => {
  const salida = execFileSync(process.execPath, ['--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_pixel-por-pagina-dibujo-hijo.ts'), JSON.stringify([{ sinTracking, partes }])], {
    cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return (JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as string[])[0];
};

test('⛔ el lead que entró por una página sin el Pixel lo dice, con la página y el botón', () => {
  assert.deepEqual(R().formulario, { como: 'sin-pixel', url: 'https://mauricio.com/form', deEntrada: true },
    'la página del formulario no mandó un solo evento en ESTE negocio (la de otro negocio no cuenta)');
  const html = dibujar(R().formulario);
  assert.match(html, /La página mauricio\.com\/form por la que entró no tiene el Pixel de MaKo: lo que pase ahí no se registra\./);
  assert.match(html, /href="\/integraciones\?servicio=landing"[^>]*>Conectar el Pixel</);
  assert.equal(html.split('no tiene el Pixel de MaKo').length, 2, 'una sola vez, aunque se dibujen las visitas y el recorrido');
  assert.doesNotMatch(html, /Sin seguimiento para este lead|entró antes del tracking/, 'en lugar del vacío genérico, no además');
  assert.match(dibujar(R().formulario, { actividad: true }), /no tiene el Pixel de MaKo/, 'el bloque del recorrido suelto también lo dice');
});

test('la página que mide no acusa a nadie; las del funnel se dicen como del funnel', () => {
  assert.equal(R().vsl, null, 'con www y con UTM es la misma página: mide');
  assert.deepEqual(R().webinar, { como: 'sin-pixel', url: 'https://mauricio.com/webinar', deEntrada: false });
  assert.equal(textoSinTracking(R().webinar), 'La página mauricio.com/webinar de su funnel no tiene el Pixel de MaKo: lo que pase ahí no se registra.');
  assert.equal(R().funnelQueMide, null, 'la página de su funnel mide: pudo entrar sin dejar su identificador');
  assert.equal(R().sinFunnel, null, 'sin página que revisar no se afirma nada');
});

test('el que no entró por una página lo dice en una línea, sin botón', () => {
  assert.deepEqual(R().meta, { como: 'sin-pagina', origen: 'Entró por el formulario de Meta' });
  const html = dibujar(R().meta);
  assert.match(html, /Entró por el formulario de Meta, sin pasar por una página: no hay visitas que registrar\./);
  assert.doesNotMatch(html, /Conectar el Pixel/);
  assert.match(dibujar(null), /Sin seguimiento para este lead/, 'sin saber por qué, la tarjeta de siempre');
});

test('la tab ya no se calla cuando se sabe por qué', () => {
  const ctx = (data: Record<string, unknown>) => ({ lead: { visitor_id: null }, data: { visitas: { total_visitas: 0 }, vslEng: { plays: 0, sin_datos: true, max_pct: null }, tracking: [], pixelPuesto: true, ...data } } as never);
  const sin = { como: 'sin-pixel', url: 'https://mauricio.com/form', deEntrada: true };
  assert.equal(REGLAS_TRACKING.visitas.estaVacio(ctx({})), true, 'sin saber por qué, se calla como siempre');
  assert.equal(REGLAS_TRACKING.visitas.estaVacio(ctx({ sinTracking: sin })), false, '«Nunca vacío sin explicar»');
  const actividad = REGLAS_TRACKING['actividad-en-pagina'].estaVacio;
  assert.equal(actividad(ctx({ sinTracking: sin }), {} as never, ['actividad-en-pagina']), false, 'suelto, el recorrido lo dice');
  assert.equal(actividad(ctx({ sinTracking: sin }), {} as never, ['visitas', 'actividad-en-pagina']), true, 'con las visitas en la hoja, lo dicen ellas: una vez');
});

test('las reglas: qué página, desde cuándo, la pista del ilike y cuándo no se puede afirmar', () => {
  assert.deepEqual(paginasDelLead({ pagina_registro: 'https://Mauricio.com/form/?utm_source=x' }, [], null), { urls: ['https://mauricio.com/form'], deEntrada: true });
  assert.deepEqual(paginasDelLead({ origen_lead: 'chat_whatsapp', funnel_id: 5 }, [{ url: 'https://a.com/x', funnelIds: [5] }] as never, null).urls, [], 'por WhatsApp no pasó por ninguna página');
  const configs = [{ url: 'https://a.com/sin', funnelIds: [] }, { url: 'https://a.com/del-default', funnelIds: [1] }, { url: 'https://a.com/otro', funnelIds: [7] }] as never;
  assert.deepEqual(paginasDelLead({ funnel_id: null }, configs, 1).urls, ['https://a.com/sin', 'https://a.com/del-default'], 'el funnel del negocio: las sin asignar y las suyas');
  const ahora = Date.parse('2026-11-14T12:00:00Z');
  assert.equal(desdeParaElPixel('2026-11-10T00:00:00Z', ahora), '2026-10-15T12:00:00.000Z', 'reciente: 30 días');
  assert.equal(desdeParaElPixel('2026-06-10T00:00:00Z', ahora), '2026-06-03T00:00:00.000Z', 'viejo: desde una semana antes de que entrara');
  assert.equal(pistaDePagina('https://www.mi_sitio.com/50%off'), '%mi\\_sitio.com/50\\%off%');
  assert.equal(veredictoDePagina('https://a.com/x', [{ landing_url: 'https://a.com/x/otra' }]), 'no-mide', 'una subpágina no es la página');
  assert.equal(veredictoDePagina('https://a.com/x', [{ landing_url: 'https://a.com/x/otra' }], 1), 'no-se', 'con el tope lleno no se afirma');
  assert.equal(sinPixelDe(false, [{ url: 'https://a.com/x', v: 'no-mide' }, { url: 'https://a.com/y', v: 'no-se' }]), null, 'una página en duda no deja afirmar');
});
