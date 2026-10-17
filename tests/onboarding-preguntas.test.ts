// =============================================================================
// El onboarding entiende lo que le dicen, y pregunta lo que hace falta (17/10/2026)
// =============================================================================
// Martín, desde el Ops Center: «Debe ser inteligente en todo momento: le dije "Soy Martin" y me respondió "Un gusto,
// Soy. ¿Cómo se llama tu negocio?", eso es básico... Rediseña bien el objetivo del onboarding, las preguntas que hace y
// la forma natural que debe tener al hablar... E investiga las preguntas que nos hacen falta: me imagino "¿Cómo nos
// conociste?", "¿Qué funcionalidad de estas te interesa más?"».
//
// Lo que fija:
//   1. el nombre se entiende («Soy Martín», «me llamo…», «Martín de Acme») y el negocio nombrado se OFRECE después;
//   2. el negocio se entiende sin la frase alrededor («Se llama Acme»);
//   3. las dos preguntas nuevas, en su lugar (antes del objetivo), sin volver atrás en una conversación que ya pasó;
//   4. el interés decide a qué pestaña entra, y lo que contestó queda para el super admin y la API de MaKo.
//
// Correr: npx tsx --test tests/onboarding-preguntas.test.ts
//
// PROBADO ROMPIÉNDOLO el 17/10/2026 (arnés romper-preguntas.mjs en el scratchpad), junto con onboarding-arranque y
// onboarding-recorte. Base 45/0 (pasa/falla):
//   - no se saca «soy» del nombre                       → 43/2
//   - el nombre se guarda como vino                     → 44/1
//   - el negocio que nombró no se ofrece                → 44/1
//   - el negocio se guarda con la frase                 → 44/1
//   - sin la pregunta del origen                        → 43/2
//   - una conversación de antes vuelve atrás            → 35/10
//   - el Project Manager recibe la del interés          → 44/1
//   - «conseguir clientes» no se entiende como anuncios → 44/1
//   - el cierre no guarda la encuesta                   → 44/1
//   - la API de MaKo no la expone                       → 44/1
//   - al terminar entra siempre a /general              → 44/1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  extraerNombre, extraerNegocio, etapaDeArranque, mensajesDeArranque, leerRespuesta, interesDe, rutaDeEntrada,
  ORIGENES, INTERESES, CLAVE_ENCUESTA, type EstadoArranque, type HechosArranque,
} from '../lib/onboarding-arranque';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'cliente@negocio.com', nombreWorkspace: 'cliente@negocio.com', faseGuardada: false,
  canalNegocio: null, loQueVende: false, conCrm: true, conTelefono: true, terminado: false,
};
const PLAN: HechosArranque = { ...H, modo: 'plan', conCrm: false, conTelefono: false };

test('el nombre se entiende: «Soy Martín» es Martín, no «Soy»', () => {
  const casos: Array<[string, string, string | null]> = [
    ['Soy Martin', 'Martin', null],
    ['soy martín', 'Martín', null],
    ['Hola, soy Martín', 'Martín', null],
    ['¡Hola! Me llamo Juan Pablo', 'Juan Pablo', null],
    ['Mi nombre es Ana María López', 'Ana María López', null],
    ['Martín', 'Martín', null],
    ['Martín de Acme', 'Martín', 'Acme'],
    ['Hola! Soy Martín, el dueño de Acme', 'Martín', 'Acme'],
    ['Me llamo Juan y tengo una agencia que se llama Pixel', 'Juan', 'Pixel'],
    ['buenas tardes, me dicen el Tano', 'Tano', null],
  ];
  for (const [dicho, nombre, negocio] of casos) {
    const r = extraerNombre(dicho);
    assert.equal(r.nombre, nombre, `«${dicho}» → «${r.nombre}»`);
    assert.equal(r.negocio, negocio, `«${dicho}»: negocio «${r.negocio}»`);
  }
  // Sin un nombre entendible, no se inventa uno: se vuelve a preguntar.
  for (const dicho of ['hola', 'Soy', '¡buenas!']) assert.equal(extraerNombre(dicho).nombre, '', `«${dicho}» se tomó como nombre`);
});

test('la respuesta del nombre: lo que se guarda, lo que dice MaKo después y el negocio que ofrece', () => {
  const r = leerRespuesta({}, H, { texto: 'Soy Martín, de Acme' });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.patch, { nombre: 'Martín', negocioSugerido: 'Acme' });
  const { antes } = mensajesDeArranque(r.patch, H);
  const pregunta = antes[antes.length - 1];
  assert.equal(pregunta.texto, 'Un gusto, Martín. ¿Cómo se llama tu negocio?');
  assert.deepEqual(pregunta.opciones, ['Acme'], 'el negocio que nombró no se ofrece');
  // «hola» no es un nombre: se pide de nuevo, sin guardar nada.
  const mal = leerRespuesta({}, H, { texto: 'hola' });
  assert.equal(mal.ok, false);
  // La opción (su nombre de la cuenta) va tal cual.
  assert.deepEqual(leerRespuesta({}, { ...H, nombreCuenta: 'Martín Koncke' }, { opcion: 0 }), { ok: true, patch: { nombre: 'Martín' } });
});

test('el negocio se entiende sin la frase alrededor', () => {
  assert.equal(extraerNegocio('Se llama Acme'), 'Acme');
  assert.equal(extraerNegocio('Mi negocio es Acme.'), 'Acme');
  assert.equal(extraerNegocio('La empresa se llama Clínica Sonrisa'), 'Clínica Sonrisa');
  assert.equal(extraerNegocio('Acme'), 'Acme');
  const r = leerRespuesta({ nombre: 'Martín' }, H, { texto: 'se llama Acme' });
  assert.deepEqual(r, { ok: true, patch: { negocio: 'Acme' } });
});

test('las preguntas nuevas van antes del objetivo, de un toque, y no vuelven atrás en una conversación de antes', () => {
  const quien: EstadoArranque = { nombre: 'Martín', negocio: 'Acme' };
  assert.equal(etapaDeArranque(quien, H), 'origen');
  const { antes } = mensajesDeArranque(quien, H);
  assert.deepEqual(antes[antes.length - 1].opciones, [...ORIGENES]);
  assert.match(antes[antes.length - 1].texto, /¿Cómo llegaste a MaKo\?/);
  // Lo que escriba también sirve («por un amigo»).
  assert.deepEqual(leerRespuesta(quien, H, { texto: 'por un amigo' }), { ok: true, patch: { origen: 'por un amigo' } });
  assert.equal(etapaDeArranque({ ...quien, origen: 'Instagram' }, H), 'interes');
  const conOrigen = mensajesDeArranque({ ...quien, origen: 'Instagram' }, H).antes;
  assert.deepEqual(conOrigen[conOrigen.length - 1].opciones, INTERESES.map((i) => i.label));
  assert.equal(etapaDeArranque({ ...quien, origen: 'Instagram', interes: 'ventas' }, H), 'objetivo');
  // El Project Manager no tiene anuncios ni CRM: no se le pregunta qué resolver primero.
  assert.equal(etapaDeArranque({ ...quien, origen: 'Google' }, PLAN), 'objetivo');
  // Una conversación que ya pasó el objetivo (empezada antes del 17/10) no vuelve atrás.
  assert.equal(etapaDeArranque({ ...quien, objetivo: 'Vender más' }, H), 'oferta');
  assert.ok(!mensajesDeArranque({ ...quien, objetivo: 'Vender más' }, H).antes.some((m) => m.id === 'arr-origen'));
});

test('el interés: la opción o lo que escriba, y a qué pestaña entra al terminar', () => {
  for (const i of INTERESES) assert.equal(interesDe(i.label), i.id);
  assert.equal(interesDe('los anuncios'), 'anuncios');
  assert.equal(interesDe('conseguir clientes'), 'anuncios');
  assert.equal(interesDe('que me conteste el WhatsApp'), 'whatsapp');
  assert.equal(interesDe('el seguimiento de mis ventas'), 'ventas');
  assert.equal(interesDe('organizar a mi equipo'), 'organizar');
  assert.equal(interesDe('no sé'), null);
  assert.equal(rutaDeEntrada('ventas'), '/crm');
  assert.equal(rutaDeEntrada(undefined), '/general');
  const chat = leer('app/onboarding/ChatArranque.tsx');
  assert.match(chat, /entrada=\{rutaDeEntrada\(vista\.interes \?\? undefined\)\}/);
  assert.match(chat, /href=\{modo === 'oferta' \? entrada : '\/plan'\}/);
});

test('lo que contestó queda para el super admin y la API de MaKo', () => {
  assert.equal(CLAVE_ENCUESTA, 'onboarding.encuesta');
  const server = leer('lib/onboarding-arranque-server.ts');
  assert.match(server, /await setSetting\(CLAVE_ENCUESTA, JSON\.stringify\(\{ origen: e\.origen \?\? null, interes: e\.interes \?\? null,/);
  const api = leer('lib/api-mako/areas/negocio.run.ts');
  assert.match(api, /getSetting\(CLAVE_ENCUESTA\)/);
  assert.match(api, /estado: s\.status, pasos, encuesta,/);
});
