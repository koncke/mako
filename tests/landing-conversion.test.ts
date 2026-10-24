// =============================================================================
// El último paso del probador del Pixel es el de ESTA página, no «Deja sus datos» para todas
// =============================================================================
// Pedido de Martín (23/10/2026, 22:52): «no es personalizable según qué funnel... Debería serlo. [...] Hay eventos que
// sobran... como «Deja sus datos». La landing de Mauricio no recopila datos...». Hasta el 24/10 el paso 5 era «Agenda»
// si había agenda sin formulario y «Deja sus datos» en cualquier otro caso: una página de venta con checkout quedaba en
// «falta» para siempre pidiendo un formulario que no tiene. La regla vive en lib/landing-conversion.ts.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  conversionDeLaPagina, esClicDelEditor, esConversion, RE_CHECKOUT, RE_WHATSAPP, CONVERSIONES, NOMBRE_CONVERSION,
  type SenalesConversion,
} from '../lib/landing-conversion';
import { conLanding, parsearConfig } from '../lib/landing-config';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
/** Sin señales: ni funnel, ni análisis, ni nada medido. */
const nada: SenalesConversion = { entradas: [], piezas: null, hayAgendo: false, hayOptin: false, hayClicCheckout: false, hayClicWhatsapp: false };
const con = (s: Partial<SenalesConversion>) => conversionDeLaPagina({ ...nada, ...s });

test('una página de venta con checkout pide «Va a pagar», no un formulario', () => {
  // El caso que destapó el pedido: el funnel de la página es «Compran en el carrito».
  assert.deepEqual(con({ entradas: ['carrito'], piezas: ['botones', 'video-panda'] }), { conversion: 'compra', porque: 'funnel' });
  // Sin funnel propio, el clic medido a buy.stripe.com lo dice igual.
  assert.deepEqual(con({ piezas: ['botones'], hayClicCheckout: true }), { conversion: 'compra', porque: 'medido' });
});

test('«Llenan un formulario» del funnel NO dice que la página pida datos', () => {
  // Es la entrada que traen casi todos los funnels por default: con ella sola, la página de Mauricio (una agenda
  // embebida y nada más) volvía a pedir «Deja sus datos».
  assert.deepEqual(con({ entradas: ['formulario_anuncio', 'landing'], piezas: ['embed-agenda'] }), { conversion: 'agenda', porque: 'pagina' });
  // Y «Agendan llamada» en una página CON formulario: lo que entra al CRM es el formulario.
  assert.deepEqual(con({ entradas: ['agenda_sola'], piezas: ['formulario', 'embed-agenda'] }), { conversion: 'datos', porque: 'pagina' });
});

test('la página de gracias gana a todo, también a una elección vieja', () => {
  // Al marcarla, la pregunta del paso 2 se esconde: una elección de antes no puede pedir «toca tu botón de compra» ahí.
  assert.deepEqual(con({ gracias: true, elegida: 'compra', entradas: ['carrito'], hayClicCheckout: true }), { conversion: 'ninguna', porque: 'gracias' });
});

test('lo elegido en el paso 2 gana al funnel, a lo medido y a la página', () => {
  assert.deepEqual(con({ elegida: 'registro', entradas: ['carrito'], piezas: ['formulario'], hayClicCheckout: true }), { conversion: 'registro', porque: 'elegida' });
  // Un valor que no es una conversión (un setting editado a mano) no se elige: decide el resto.
  assert.deepEqual(con({ elegida: 'cualquiera' as never, piezas: ['formulario'] }), { conversion: 'datos', porque: 'pagina' });
});

test('el funnel del NEGOCIO va después de lo medido y de lo que tiene la página', () => {
  // Dice cómo vende el negocio, no qué hace ESTA página: la del VSL y la de gracias comparten el mismo funnel.
  assert.deepEqual(con({ entradasDelNegocio: ['carrito'], piezas: ['embed-agenda'] }), { conversion: 'agenda', porque: 'pagina' });
  assert.deepEqual(con({ entradasDelNegocio: ['carrito'], hayOptin: true }), { conversion: 'datos', porque: 'medido' });
  assert.deepEqual(con({ entradasDelNegocio: ['carrito'], piezas: ['botones'] }), { conversion: 'compra', porque: 'negocio' });
  // El de la PÁGINA, en cambio, va antes que lo medido.
  assert.deepEqual(con({ entradas: ['chat_entrante'], hayOptin: true }), { conversion: 'whatsapp', porque: 'funnel' });
});

test('sin ninguna señal NO se inventa un paso: se pide elegirlo', () => {
  assert.deepEqual(con({}), { conversion: null, porque: 'nada' });
  assert.deepEqual(con({ piezas: ['botones', 'video-panda'], entradasDelNegocio: ['formulario_anuncio'] }), { conversion: null, porque: 'nada' });
});

test('⚠️ en una página que es sólo una agenda, el opt-in es el de la reserva: sigue siendo «Agenda»', () => {
  // Medido el 24/10/2026 contra la base de Código Inmobiliario: su landing es una agenda embebida y salía «Deja sus
  // datos» porque una reserva también manda el contacto.
  assert.deepEqual(con({ piezas: ['botones', 'embed-agenda', 'video-wistia'], hayOptin: true }), { conversion: 'agenda', porque: 'pagina' });
  // Con un formulario de verdad en la página, el opt-in sí dice «datos».
  assert.deepEqual(con({ piezas: ['embed-agenda', 'formulario'], hayOptin: true }), { conversion: 'datos', porque: 'medido' });
  // Y sin saber qué tiene la página, un opt-in es un opt-in.
  assert.deepEqual(con({ hayOptin: true }), { conversion: 'datos', porque: 'medido' });
});

test('CABLEADO: fuera de una prueba, el opt-in del NEGOCIO no se cuenta como hecho de esta página', () => {
  // Los leads de landing de 24 h se buscan sin URL: con dos páginas, el de una decidía el paso final de la otra.
  assert.match(leer('../lib/landing-token.ts'), /hayOptin: \(enPrueba && hayOptin\) \|\| hayOptinBloqueado,/);
});

test('lo medido va en el orden del embudo más fuerte', () => {
  assert.equal(con({ hayClicCheckout: true, hayAgendo: true, hayOptin: true }).conversion, 'compra');
  assert.equal(con({ hayAgendo: true, hayOptin: true, hayClicWhatsapp: true }).conversion, 'agenda');
  assert.equal(con({ hayOptin: true, hayClicWhatsapp: true }).conversion, 'datos');
  assert.equal(con({ hayClicWhatsapp: true }).conversion, 'whatsapp');
});

test('qué es un checkout, qué es WhatsApp y qué es el sello del editor', () => {
  for (const u of ['https://buy.stripe.com/abc123', 'https://checkout.stripe.com/c/pay/cs_x', 'https://pay.hotmart.com/X1', 'https://mpago.la/2abc', 'https://www.mercadopago.com.mx/checkout/v1/redirect?x=1']) {
    assert.ok(RE_CHECKOUT.test(u), `${u} es un checkout`);
  }
  for (const u of ['https://stripe.com/pricing', 'https://mauriciobustos.com/checkout-info', 'boton: Comprar']) {
    assert.ok(!RE_CHECKOUT.test(u), `${u} NO es un checkout`);
  }
  assert.ok(RE_WHATSAPP.test('https://wa.me/5215555555555?text=hola'));
  assert.ok(RE_WHATSAPP.test('https://api.whatsapp.com/send?phone=1'));
  assert.ok(!RE_WHATSAPP.test('https://www.whatsapp.com/business'));
  assert.ok(esClicDelEditor('https://lovable.dev/projects/x?utm_source=lovable-badge'));
  assert.ok(esClicDelEditor('boton: Edit with Lovable'));
  assert.ok(!esClicDelEditor('boton: Agenda tu llamada'));
  assert.ok(!esClicDelEditor(null));
});

test('cada conversión tiene su nombre en pantalla', () => {
  for (const c of CONVERSIONES) assert.ok(NOMBRE_CONVERSION[c], `falta el nombre de ${c}`);
  assert.ok(esConversion('compra') && !esConversion('mako') && !esConversion(null));
});

test('la conversión es de la PÁGINA: se guarda, se lee, se borra y no se pierde al tocar otra cosa', () => {
  const cfgs = conLanding([], 'https://a.com', { conversion: 'compra' })!;
  assert.deepEqual(cfgs, [{ url: 'https://a.com', conversion: 'compra' }]);
  // Lo que se guarda vuelve a leerse igual, y la basura de un setting editado a mano no pasa.
  assert.deepEqual(parsearConfig(JSON.stringify(cfgs)), cfgs);
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","conversion":"vende"}]'), [{ url: 'https://a.com' }]);
  // ⚠️ La trampa del mapper que reconstruye la fila campo por campo: cambiar los productos o marcar la de gracias no
  // puede borrar lo elegido.
  const conProductos = conLanding(cfgs, 'https://a.com', { funnelIds: [7] })!;
  assert.deepEqual(conProductos, [{ url: 'https://a.com', funnelIds: [7], conversion: 'compra' }]);
  // `null` la borra (vuelve a decidir MaKo); una config sin elegir no gana el campo.
  assert.deepEqual(conLanding(conProductos, 'https://a.com', { conversion: null }), [{ url: 'https://a.com', funnelIds: [7] }]);
  assert.deepEqual(conLanding([], 'https://b.com', {}), [{ url: 'https://b.com' }]);
});

test('CABLEADO: el diagnóstico arma el paso final con la regla, y la pantalla pide lo que dice el server', () => {
  const lib = leer('../lib/landing-token.ts');
  assert.match(lib, /conversionDeLaPagina\(\{/, 'el paso 5 tiene que salir de lib/landing-conversion.ts');
  assert.match(lib, /conversion === 'compra' \? pasoCompra/, 'una página de venta tiene que tener su paso');
  // El sello del editor no cuenta como clic.
  assert.match(lib, /e\.tipo === 'click' && !esClicDelEditor\(e\.detalle\)/);
  const ui = leer('../app/integraciones/ProbarTracking.tsx');
  assert.match(ui, /\.map\(\(c\) => c\.pedir \?\? null\)/, 'la instrucción de la prueba sale de `pedir`, no de un regex sobre el label');
  assert.doesNotMatch(ui, /\/agenda\/i\.test\(c\.label\)/, 'volvió a deducir el paso final del texto del renglón');
  const paso2 = leer('../app/integraciones/AsignarProducto.tsx');
  assert.match(paso2, /guardarLandingAction\(elegida, \{ conversion: nueva \}\)/, 'la pregunta del paso 2 tiene que guardar SOLO la conversión');
});

test('CABLEADO: los eventos del video que no se puede medir no llegan como «desconocido»', () => {
  // Faltaban desde la v16: 1.731 filas en un workspace en 30 días, que el probador leía como «Pixel modificado».
  const ruta = leer('../app/api/track/vsl/route.ts');
  const conocidos = /const CONOCIDOS = \[([^\]]*)\]/.exec(ruta)?.[1] ?? '';
  for (const t of ['video_ajeno', 'toque_video']) assert.ok(conocidos.includes(`'${t}'`), `${t} tiene que estar en CONOCIDOS`);
  // Y los manda el Pixel de hoy: si un día dejan de existir, este test tiene que caerse acá, no mentir verde.
  const snippet = leer('../lib/landing-token.ts');
  assert.match(snippet, /tipo_evento: 'video_ajeno'/);
  assert.match(snippet, /tipo_evento: 'toque_video'/);
});

test('CABLEADO: la API de MaKo guarda la conversión y el diagnóstico la devuelve', () => {
  const def = leer('../lib/api-mako/areas/landing.def.ts');
  assert.match(def, /nombre: 'conversion'.*enum: \[\.\.\.CONVERSIONES, 'mako'\]/);
  const run = leer('../lib/api-mako/areas/landing.run.ts');
  assert.match(run, /payload\.conversion === 'mako' \? null/, '«mako» tiene que BORRAR la elección, no guardarla');
  assert.match(run, /conversion: \{ valor: d\.conversion\.valor, porque: d\.conversion\.porque \}/);
});
