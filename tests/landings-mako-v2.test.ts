// =============================================================================
// La landing principal de MaKo con lo que hace la competencia: dos portadas, precios vivos y nada inventado (25/10/2026)
// =============================================================================
// scripts/landings-mako-v2.mts arma las portadas A («el equipo») y B («todo junto») como documentos de Web Generator, y
// lib/editor-landing/precios-en-landing.ts pone los precios de hoy en sus marcas (app/vsl/Landing.tsx). Esto fija:
//   1. las marcas: el precio sale de los planes, y lo que no es una marca vuelve byte por byte;
//   2. las portadas: los precios NUNCA escritos a mano, el lugar de las columnas, el botón con el origen, y las reglas de lo
//      que no se dice todavía (la garantía que /reembolsos niega, el media buyer que mueve el presupuesto, cupos y Calendly);
//   3. la portada de hola-mako.com: las columnas van en `data-mako-planes` y el HTML pasa por las marcas.
// PROBADO ROMPIÉNDOLO (25/10/2026, romper-landing.mjs del scratchpad; base 4 / 0, cada una 3 / 1): el precio de Pro tipeado
// en la portada B · la garantía prometida · el media buyer que mueve el presupuesto · sin el lugar de las columnas · el botón
// sin el origen · las marcas sin «desde» · Landing.tsx sin el lugar propio · Landing.tsx sin las marcas · un contador en 0.
// Correr: node --import tsx --test tests/landings-mako-v2.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { conPreciosEnHtml, precioDesde, precioUsd } from '../lib/editor-landing/precios-en-landing';
import { AFUERA_REDONDO, AHORRO, GARANTIA, PORTADAS, TOTAL_AFUERA, seccionesDe, type Portada } from '../scripts/landings-mako-v2.mjs';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PLANES = [{ id: 'esencial', precioUsd: 47 }, { id: 'pro', precioUsd: 97 }];
const CUALES = Object.keys(PORTADAS) as Portada[];
const textoDe = (cual: Portada) => seccionesDe(cual).map(([, h]) => h).join('\n');

test('las marcas: «desde» es el plan más barato, cada precio el de su plan, y lo demás vuelve igual', () => {
  const html = '<p>Desde <span data-mako-desde="">US$1</span> · Pro <span data-mako-precio="pro">US$1</span> · <b>US$5</b></p>';
  assert.equal(conPreciosEnHtml(html, PLANES), '<p>Desde <span data-mako-desde="">US$47</span> · Pro <span data-mako-precio="pro">US$97</span> · <b>US$5</b></p>');
  assert.equal(conPreciosEnHtml(html, [{ id: 'pro', precioUsd: 120 }]).includes('data-mako-desde="">US$120<'), true, 'el «desde» con un solo plan');
  // Un plan que ya no está deja el respaldo; sin planes, nada cambia; sin marcas, el HTML vuelve idéntico.
  assert.equal(conPreciosEnHtml('<i data-mako-precio="viejo">US$9</i>', PLANES), '<i data-mako-precio="viejo">US$9</i>');
  assert.equal(conPreciosEnHtml(html, []), html);
  const sin = '<section class="x"><h1>Hola</h1></section>';
  assert.equal(conPreciosEnHtml(sin, PLANES), sin);
  assert.equal(precioUsd(1500), 'US$1.500');
  assert.equal(precioUsd(62.3), 'US$62,30');
  assert.equal(precioDesde([]), null);
});

test('las portadas: los precios salen de los planes (nunca tipeados) y van a la vista desde la portada', () => {
  const src = sinComentarios(leer('scripts/landings-mako-v2.mts'));
  // Los de los planes (el «US$1.500» que queda es lo que cuesta un diseñador afuera, no el Acelerador).
  assert.doesNotMatch(src, /US\$(47|97|297)\b/, 'un precio de MaKo escrito a mano en el script');
  assert.match(src, /PLANES_MAKO_DEFAULT/, 'el respaldo sale de lib/planes-mako.ts');
  for (const cual of CUALES) {
    const secciones = seccionesDe(cual);
    const portada = secciones.find(([id]) => id === 'inicio')![1];
    assert.match(portada, /<span data-mako-desde="">US\$\d+<\/span> al mes/, `${cual}: el «desde» en la portada`);
    assert.equal((textoDe(cual).match(/data-mako-planes=/g) ?? []).length, 1, `${cual}: un solo lugar para las columnas de precios`);
    assert.match(portada, new RegExp(`href="https://hola-mako\\.com/planes\\?landing=${PORTADAS[cual].slug}"`), `${cual}: el botón lleva el origen`);
  }
  // Cada sección pasa entera por el saneo del «Diseño editable» (las marcas y los desplegables incluidos). El saneo lleva
  // `server-only`: corre en un node aparte (tests/_landings-mako-v2-hijo.ts), una sola vez para las dos portadas.
  const hijo = JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_landings-mako-v2-hijo.ts')],
    { cwd: RAIZ, encoding: 'utf8', timeout: 120_000 })) as Record<string, Array<{ id: string; antes: Record<string, number>; despues: Record<string, number>; vacia: boolean }>>;
  for (const cual of CUALES) {
    assert.equal(hijo[cual].length, seccionesDe(cual).length);
    for (const s of hijo[cual]) {
      assert.equal(s.vacia, false, `${cual}/${s.id} quedó vacía al sanear`);
      assert.deepEqual(s.despues, s.antes, `${cual}/${s.id}: el saneo se comió una marca o un desplegable`);
    }
  }
  // La B dice el precio de Pro con su marca, y «más de US$…» redondeado HACIA ABAJO desde la misma tabla que se muestra.
  assert.match(seccionesDe('todo-junto').find(([id]) => id === 'inicio')![1], new RegExp(`más de US\\$${AFUERA_REDONDO} al mes, en MaKo Pro cuesta <span data-mako-precio="pro">`));
  assert.equal(TOTAL_AFUERA, AHORRO.reduce((s, f) => s + f.usd, 0));
  assert.ok(AFUERA_REDONDO <= TOTAL_AFUERA && TOTAL_AFUERA - AFUERA_REDONDO < 50);
});

test('nada inventado ni prometido de más: sin garantía mientras /reembolsos la niegue, sin el media buyer que mueve la plata', () => {
  const reembolsos = leer('app/reembolsos/page.tsx');
  if (/El mes ya pagado no se reembolsa/.test(reembolsos)) {
    assert.equal(GARANTIA, null, '/reembolsos dice que el mes pagado no se devuelve: la landing no puede prometer una garantía');
  }
  for (const cual of CUALES) {
    const t = textoDe(cual);
    if (GARANTIA == null) assert.doesNotMatch(t, /garant/i, `${cual}: una garantía que la política no da`);
    assert.doesNotMatch(t, /mueve el presupuesto|presupuesto se mueve|mover el presupuesto|piloto autom/i, `${cual}: el media buyer que mueve el presupuesto no está en producción`);
    assert.doesNotMatch(t, /cupos|calendly/i, `${cual}: ni cupos ni la agenda de Calendly (Martín, 24/10: las columnas de precios)`);
    // Ningún contador en 0 (la investigación: resta credibilidad).
    assert.doesNotMatch(t, />\s*\+?0\s*</, `${cual}: un contador en 0`);
    // El caso es el de Mauricio, el que ya contaba la landing; las cifras del fundador, las de sus testimonios.
    assert.match(t, /De menos de US\$10K a más de US\$70K al mes/);
  }
});

test('hola-mako.com: las columnas van donde la landing las pide, y el HTML pasa por las marcas de precios', () => {
  const src = sinComentarios(leer('app/vsl/Landing.tsx'));
  assert.match(src, /const propio = root\.querySelector<HTMLElement>\(`\[\$\{ATRIBUTO_PLANES\}\]`\);/);
  assert.match(src, /if \(propio\) \{[\s\S]{0,260}propio\.replaceChildren\(\);[\s\S]{0,120}return propio;/, 'el lugar propio gana a la agenda, y lo de adentro (el respaldo) se reemplaza');
  assert.match(src, /__html: diseno \? conPreciosEnHtml\(diseno\.html, planes\) : LANDING_HTML/);
});
