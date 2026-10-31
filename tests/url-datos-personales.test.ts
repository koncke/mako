// =============================================================================
// Las URL que guarda el Pixel van SIN los datos de una persona (24/10/2026, P6)
// =============================================================================
// La página de gracias de Calendly trae `?name=…&email=…` y la guardábamos entera en `vsl_events.landing_url` y en
// `landing_visits.landing_url` (medido: 487 + 112 filas de Código Inmobiliario y P2P Consulting). La regla vive en
// lib/url-datos-personales.ts y la usan las rutas del Pixel y `normalizarUrl`.
// Correr: node --import tsx --test tests/url-datos-personales.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esParametroPersonal, urlSinDatosPersonales } from '../lib/url-datos-personales';
import { normalizarUrl } from '../lib/landing-paginas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la página de gracias de Calendly sale sin el nombre ni el email; lo demás queda igual', () => {
  assert.equal(
    urlSinDatosPersonales('https://x.com/gracias?name=Ana+P%C3%A9rez&email=ana%40x.com&utm_source=fb&utm_id=120212345678901'),
    'https://x.com/gracias?utm_source=fb&utm_id=120212345678901',
  );
  assert.equal(urlSinDatosPersonales('https://x.com/gracias?name=Ana&email=ana@x.com'), 'https://x.com/gracias', 'sin nada que quede, sin «?»');
  // Lo de Calendly que trae datos: reprogramar, los invitee_*, las respuestas, el teléfono del recordatorio.
  const calendly = 'https://x.com/ok?assigned_to=Mauricio&event_type_name=R1&invitee_full_name=Ana&invitee_email=a%40b.co&answer_1=%2B5491155550000&text_reminder_number=%2B5491155550000&rescheduledby=a%40b.co&event_start_time=2026-10-25';
  assert.equal(urlSinDatosPersonales(calendly), 'https://x.com/ok?assigned_to=Mauricio&event_type_name=R1&event_start_time=2026-10-25');
});

test('una URL sin datos personales vuelve IDÉNTICA (las UTM, los ids de clic, el marcador de prueba, el ancla)', () => {
  for (const u of [
    'https://x.com/',
    'https://x.com/vsl?utm_source=fb&utm_campaign=120212345678901&fbclid=IwAR0abc&mko_test=t_1',
    'https://x.com/precios?plan=pro#faq',
    'https://x.com/a?b=c&&d=',
    '/gracias',
    'no es una url',
  ]) assert.equal(urlSinDatosPersonales(u), u);
  // Los ids de campaña de Meta son números largos: NO son de nadie (en la medición, 84 mil filas eran eso).
  assert.equal(esParametroPersonal('utm_id', '120212345678901'), false);
});

test('se reconoce aunque venga escrito de otra forma: mayúsculas, acentos, guiones, codificado; y un email en cualquier parámetro', () => {
  for (const [k, v] of [['EMAIL', 'x'], ['E-mail', 'x'], ['Teléfono', '1155550000'], ['nombre%20completo', 'x'], ['first-name', 'x'], ['Invitee_Email', 'x'], ['answer_3', 'x']]) {
    assert.equal(esParametroPersonal(k, v), true, `${k} no se reconoce como personal`);
  }
  assert.equal(esParametroPersonal('ref', 'ana%40x.com'), true, 'un email codificado en el valor');
  assert.equal(esParametroPersonal('ref', 'ana@x.com'), true);
  assert.equal(esParametroPersonal('plan', 'pro'), false);
  // En un `#…` con forma de query, también; un ancla común queda.
  assert.equal(urlSinDatosPersonales('https://x.com/g#email=a@b.co&tab=2'), 'https://x.com/g#tab=2');
  assert.equal(urlSinDatosPersonales('https://x.com/g?email=a@b.co#precios'), 'https://x.com/g#precios');
  assert.equal(urlSinDatosPersonales('/gracias?email=a@b.co&v=2'), '/gracias?v=2', 'una URL relativa también');
});

test('normalizarUrl (las listas de páginas, el pagina_registro de un lead, el cruce de funnels) tampoco los deja pasar', () => {
  assert.equal(normalizarUrl('https://x.com/gracias?name=Ana&email=ana%40x.com&plan=pro'), 'https://x.com/gracias?plan=pro');
  assert.equal(normalizarUrl('https://x.com/gracias?name=Ana&email=ana%40x.com'), 'https://x.com/gracias');
});

test('las tres rutas del Pixel guardan la URL saneada, ANTES de cortarla', () => {
  const vsl = sinComentarios(leer('app/api/track/vsl/route.ts'));
  assert.doesNotMatch(vsl, /texto\(payload\.landing_url, 500\)/, 'una escritura de landing_url volvió a ir cruda');
  assert.equal((vsl.match(/urlGuardable\(payload\.landing_url\)/g) ?? []).length, 3, 'vsl_events (2) y la visita (1)');
  // ⚠️ Desde el 30/10/2026 es la lista BLANCA (`urlDeEntradaGuardable`): la negra dejaba pasar el `attendeeName` de
  // Cal.com. La regla y lo medido, en tests/url-de-entrada-lista-blanca.test.ts.
  assert.match(vsl, /const urlGuardable = \(v: unknown\): string \| null => texto\(typeof v === 'string' \? urlDeEntradaGuardable\(v\) : v, 500\);/);
  const replay = sinComentarios(leer('app/api/track/replay/route.ts'));
  assert.match(replay, /landingUrl: texto\(typeof payload\.landing_url === 'string' \? urlDeEntradaGuardable\(payload\.landing_url\) : payload\.landing_url, 500\),/);
  const optin = sinComentarios(leer('app/api/track/optin/route.ts'));
  assert.match(optin, /landing_url: txt\(typeof body\.pagina === 'string' \? urlDeEntradaGuardable\(body\.pagina\) : body\.pagina\),/);
  assert.match(optin, /const paginaOptin = normalizarUrl\(/, 'el pagina_registro pasa por normalizarUrl, que ahora los saca');
});

// ─────────────────────────────────────────────────────────────────────────────
// La revisión adversarial del 24/10/2026: cada caso que se escapaba, y los falsos positivos que había que evitar.
// ─────────────────────────────────────────────────────────────────────────────

test('adversarial: nombres de otros formularios (Calendly prellenado, Hotmart, CF7, portugués) y claves con corchetes', () => {
  const casos: Array<[string, string]> = [
    ['/agenda?name=Ana&email=ana@x.com&a1=%2B5491155550000&a2=Palermo', '/agenda'],
    ['/pago?name=Ana&email=ana@x.com&doc=12345678909&phoneac=11&phonenumber=987654321', '/pago?phoneac=11'],
    ['/g?phoneNumber=1155550000&nombreCompleto=Ana+Perez&your-name=Ana&your-phone=1155550000&customer_name=Ana', '/g'],
    ['/g?nome=Ana&sobrenome=Silva&telefone=11987654321&cpf=12345678909&cedula=1234567', '/g'],
    ['/g?data[name]=Ana+Perez&data[phone]=5491155550000&lead%5Bphone%5D=5491155550000&plan=pro', '/g?plan=pro'],
    ['/g?x=1&amp;name=Ana&amp;phone=5491155550000', '/g?x=1'],
    ['/g?src=fb;nombre=Ana;telefono=5491155550000', '/g?src=fb'],
  ];
  for (const [entra, sale] of casos) assert.equal(urlSinDatosPersonales(entra), sale, entra);
});

test('adversarial: el email como clave, doble codificado o con un % roto; una URL adentro de otra; ? repetido; router con #', () => {
  assert.equal(urlSinDatosPersonales('/g?ana@x.com'), '/g');
  assert.equal(urlSinDatosPersonales('/g?email%3Dana%40x.com'), '/g');
  assert.equal(urlSinDatosPersonales('/g?ref2=ana%2540x.com&v=2'), '/g?v=2', 'doble codificado');
  assert.equal(urlSinDatosPersonales('/g?ref2=ana%40x.com%ZZ&v=2'), '/g?v=2', 'un % roto no frena');
  assert.equal(urlSinDatosPersonales('/g?next=https%3A%2F%2Fx.com%2Fok%3Fname%3DAna%26phone%3D5491155550000%26plan%3Dpro'),
    '/g?next=https%3A%2F%2Fx.com%2Fok%3Fplan%3Dpro', 'la URL de adentro se limpia y se vuelve a codificar');
  assert.equal(urlSinDatosPersonales('/gracias?plan=pro?name=Ana+Perez&email=ana@x.com'), '/gracias?plan=pro');
  assert.equal(urlSinDatosPersonales('/#/gracias?invitee_full_name=Ana+Perez&invitee_email=ana%40x.com&v=1'), '/#/gracias?v=1');
  assert.equal(normalizarUrl('https://x.com/gracias?plan=pro?name=Ana+Perez&email=ana@x.com'), 'https://x.com/gracias?plan=pro');
});

test('adversarial: lo que NO es de nadie se queda (tel=1, mobile=1, doc=intro, utm_id largo, una query codificada sin datos)', () => {
  for (const u of ['/g?tel=1&mobile=1', '/help?doc=intro', '/g?utm_id=120212345678901&ct=1729900000', '/g?q=a%26b%3Dc', '/g?phoneac=11']) {
    assert.equal(urlSinDatosPersonales(u), u, u);
  }
});

test('el referrer de la visita y el detalle de un clic también se guardan saneados', () => {
  const vsl = sinComentarios(leer('app/api/track/vsl/route.ts'));
  assert.match(vsl, /referrer: urlGuardable\(payload\.referrer\),/, 'el referrer de la página que sigue a /gracias trae la misma query');
  assert.doesNotMatch(vsl, /referrer: texto\(payload\.referrer/);
  assert.match(vsl, /detalle: texto\(typeof payload\.detalle === 'string' \? urlSinDatosPersonales\(payload\.detalle\) : payload\.detalle, 300\),/);
});
