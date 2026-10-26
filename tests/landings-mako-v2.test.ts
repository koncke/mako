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
// Y las de funcionalidad y avatar (romper-funnels.mjs; base 6 / 0): sin el origen de mako-closing → 5 / 1 · el media buyer
// sin pausa → 5 / 1 · un precio tipeado en una landing → 5 / 1 · el subir sin saltear las pausadas → 5 / 1 · una landing
// sin el lugar de los precios → 4 / 2.
// Y la prueba gratis (romper-prueba.mjs; base 6 / 0): Landing.tsx sin la prueba → 5 / 1 · el botón sin su marca → 4 / 2 ·
// la línea escrita a mano → 5 / 1 · una garantía de vuelta en el cierre → 4 / 2 · las marcas sin la prueba → 5 / 1.
// Correr: node --import tsx --test tests/landings-mako-v2.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { botonDePrueba, conPreciosEnHtml, lineaDePrueba, precioDesde, precioUsd } from '../lib/editor-landing/precios-en-landing';
import { AFUERA_REDONDO, AHORRO, COMO_FUNCIONA_LA_PRUEBA, PORTADAS, PREGUNTAS, TOTAL_AFUERA, seccionesDe, type Portada } from '../scripts/landings-mako-v2.mjs';
import { PLANES_MAKO_DEFAULT, PRUEBA_DIAS } from '../lib/planes-mako';
import { FUNNELS, seccionesDeFunnel } from '../scripts/landings-mako-v2-funnels.mjs';
import { LANDINGS_MAKO } from '../lib/origen-cuenta';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PLANES = [{ id: 'esencial', precioUsd: 47 }, { id: 'pro', precioUsd: 97 }];
const CUALES = Object.keys(PORTADAS) as Portada[];
const textoDe = (cual: Portada) => seccionesDe(cual).map(([, h]) => h).join('\n');

// El saneo lleva `server-only`: corre en un node aparte (tests/_landings-mako-v2-hijo.ts), UNA vez para todas las landings.
type Conteo = Array<{ id: string; antes: Record<string, number>; despues: Record<string, number>; vacia: boolean }>;
let saneadas: Record<string, Conteo> | null = null;
const delHijo = (): Record<string, Conteo> => (saneadas ??= JSON.parse(execFileSync(process.execPath,
  ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_landings-mako-v2-hijo.ts')], { cwd: RAIZ, encoding: 'utf8', timeout: 180_000 })));
const sinPerderMarcas = (clave: string, n: number) => {
  const h = delHijo()[clave];
  assert.equal(h.length, n, `${clave}: otra cantidad de secciones`);
  for (const s of h) {
    assert.equal(s.vacia, false, `${clave}/${s.id} quedó vacía al sanear`);
    assert.deepEqual(s.despues, s.antes, `${clave}/${s.id}: el saneo se comió una marca o un desplegable`);
  }
};
/** Lo que no se dice todavía (ver la cabecera del script de la principal). */
const sinPrometerDeMas = (nombre: string, t: string) => {
  // Sin garantía de devolución (Martín, 25/10: entra la prueba gratis en su lugar).
  // (El pie enlaza a /reembolsos, la política legal: eso sí va.)
  assert.doesNotMatch(t, /garant|te devolvemos/i, `${nombre}: una garantía de devolución que ya no existe`);
  // La prueba: el botón y la línea de abajo, con su marca y el texto de la fuente (nunca escrito en el script).
  assert.ok(t.includes(`<span data-mako-prueba="boton">Empieza tus ${PRUEBA_DIAS} días gratis</span>`), `${nombre}: el botón de la prueba, de la fuente`);
  assert.ok(t.includes(`<span data-mako-prueba="linea">${PRUEBA_DIAS} días gratis · Cancela cuando quieras · Usas tu propia IA</span>`), `${nombre}: la línea de la prueba, de la fuente`);
  assert.ok(t.includes(COMO_FUNCIONA_LA_PRUEBA), `${nombre}: la pregunta de cómo funciona la prueba`);
  assert.doesNotMatch(t, /mueve el presupuesto|presupuesto se mueve|mover el presupuesto|piloto autom/i, `${nombre}: el media buyer que mueve el presupuesto no está en producción`);
  assert.doesNotMatch(t, /cupos|calendly/i, `${nombre}: ni cupos ni la agenda de Calendly (Martín, 24/10: las columnas de precios)`);
  // Ningún contador en 0 (la investigación: resta credibilidad).
  assert.doesNotMatch(t, />\s*\+?0\s*</, `${nombre}: un contador en 0`);
};

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
  // La prueba gratis: los cuatro textos, de los días que se pasen; sin días (o con días que no son), quedan los de respaldo.
  const conPrueba = '<a><span data-mako-prueba="boton">x</span></a><p><span data-mako-prueba="linea">y</span> · <i data-mako-prueba="dias">z</i> días, el <b data-mako-prueba="cobro">w</b></p>';
  assert.equal(conPreciosEnHtml(conPrueba, [], 10),
    '<a><span data-mako-prueba="boton">Empieza tus 10 días gratis</span></a><p><span data-mako-prueba="linea">10 días gratis · Cancela cuando quieras · Usas tu propia IA</span> · <i data-mako-prueba="dias">10</i> días, el <b data-mako-prueba="cobro">11</b></p>');
  assert.equal(conPreciosEnHtml(conPrueba, []), conPrueba);
  for (const mal of [0, -3, 2.5, Number.NaN]) assert.equal(conPreciosEnHtml(conPrueba, [], mal), conPrueba, `días ${mal}`);
  // La línea corta del Cerebro (25/10), armada con los días.
  assert.equal(lineaDePrueba(7), '7 días gratis · Cancela cuando quieras · Usas tu propia IA');
  assert.equal(botonDePrueba(7), 'Empieza tus 7 días gratis');
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
  // Cada sección pasa entera por el saneo del «Diseño editable» (las marcas y los desplegables incluidos).
  for (const cual of CUALES) sinPerderMarcas(cual, seccionesDe(cual).length);
  // La B dice el precio de Pro con su marca, y «más de US$…» redondeado HACIA ABAJO desde la misma tabla que se muestra.
  assert.match(seccionesDe('todo-junto').find(([id]) => id === 'inicio')![1], new RegExp(`más de US\\$${AFUERA_REDONDO} al mes, en MaKo Pro cuesta <span data-mako-precio="pro">`));
  assert.equal(TOTAL_AFUERA, AHORRO.reduce((s, f) => s + f.usd, 0));
  assert.ok(AFUERA_REDONDO <= TOTAL_AFUERA && TOTAL_AFUERA - AFUERA_REDONDO < 50);
});

test('nada inventado ni prometido de más: sin garantía de devolución, la prueba de la fuente, sin el media buyer que mueve la plata', () => {
  // Los días de la prueba salen de PRUEBA_DIAS (lib/planes-mako.ts) y sus frases de precios-en-landing: ningún script las escribe a mano.
  for (const rel of ['scripts/landings-mako-v2.mts', 'scripts/landings-mako-v2-funnels.mts']) {
    assert.doesNotMatch(sinComentarios(leer(rel)), /\b\d+ días gratis|Empieza tus|Cancela cuando quieras/, `${rel}: la prueba gratis escrita a mano`);
  }
  for (const cual of CUALES) {
    const t = textoDe(cual);
    sinPrometerDeMas(cual, t);
    // El caso es el de Mauricio, el que ya contaba la landing; las cifras del fundador, las de sus testimonios.
    assert.match(t, /De menos de US\$10K a más de US\$70K al mes/);
  }
});

test('hola-mako.com: las columnas van donde la landing las pide, y el HTML pasa por las marcas de precios', () => {
  const src = sinComentarios(leer('app/vsl/Landing.tsx'));
  assert.match(src, /const propio = root\.querySelector<HTMLElement>\(`\[\$\{ATRIBUTO_PLANES\}\]`\);/);
  assert.match(src, /if \(propio\) \{[\s\S]{0,260}propio\.replaceChildren\(\);[\s\S]{0,120}return propio;/, 'el lugar propio gana a la agenda, y lo de adentro (el respaldo) se reemplaza');
  assert.match(src, /__html: diseno \? conPreciosEnHtml\(diseno\.html, planes, PRUEBA_DIAS\) : LANDING_HTML/, 'los precios y la prueba de hoy, de la fuente');
  assert.match(src, /import \{ PRUEBA_DIAS \} from '@\/lib\/planes-mako';/);
});

test('las landings por funcionalidad y avatar: su origen, el precio por marca, nada de más, y las que no salen, en pausa', () => {
  const src = sinComentarios(leer('scripts/landings-mako-v2-funnels.mts'));
  assert.doesNotMatch(src, /US\$(47|97|297)\b/, 'un precio de MaKo escrito a mano en el script');
  const slugs = FUNNELS.map((f) => f.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'un slug repetido');
  for (const f of FUNNELS) {
    assert.ok(LANDINGS_MAKO[f.slug], `${f.slug} no está en LANDINGS_MAKO: el alta no sabría de dónde vino`);
    assert.ok(!existsSync(join(RAIZ, 'app', 'vsl', f.slug)), `${f.slug}: una ruta fija de /vsl le ganaría al documento`);
    const secciones = seccionesDeFunnel(f);
    const t = secciones.map(([, h]) => h).join('\n');
    assert.match(secciones.find(([id]) => id === 'inicio')![1], /<span data-mako-desde="">US\$\d+<\/span> al mes/, `${f.slug}: el «desde» en la portada`);
    assert.equal((t.match(/data-mako-planes=/g) ?? []).length, 1, `${f.slug}: un solo lugar para las columnas`);
    assert.ok(t.includes(`href="https://hola-mako.com/planes?landing=${f.slug}"`), `${f.slug}: el botón lleva el origen`);
    if (!f.pausada) sinPrometerDeMas(f.slug, t);
    sinPerderMarcas(f.slug, secciones.length);
  }
  // Las que se arman y NO se suben: el media buyer (no está en producción) y los avatares (en pausa desde el 23/10).
  assert.deepEqual(FUNNELS.filter((f) => f.pausada).map((f) => f.slug).sort(), ['mako-avatares', 'mako-media-buyer']);
  assert.ok(src.includes('if (f.pausada) { console.log(`${f.slug}: NO se sube (${f.pausada})`); continue; }'), 'el --subir tiene que saltear las pausadas');
  // Las portadas A y B también tienen su origen.
  for (const cual of CUALES) assert.ok(LANDINGS_MAKO[PORTADAS[cual].slug], `${PORTADAS[cual].slug} no está en LANDINGS_MAKO`);
});

test('el catálogo de preguntas está entero (lo comparten todas las landings)', () => {
  for (const k of ['tecnologia', 'cierra', 'equivoca', 'numero', 'bloqueo', 'ia', 'equipo', 'permanencia', 'datos', 'chatgpt']) {
    const qa = PREGUNTAS[k];
    assert.ok(qa && qa[0].endsWith('?') && qa[1].length > 20, `la pregunta «${k}» está incompleta`);
  }
});

test('el cierre: los planes con la prueba gratis, y la llamada como un link chico debajo (Martín, 26/10)', () => {
  const activos = PLANES_MAKO_DEFAULT.filter((p) => p.activo);
  const todas: Array<[string, Array<[string, string]>]> = [
    ...CUALES.map((c): [string, Array<[string, string]>] => [PORTADAS[c].slug, seccionesDe(c)]),
    ...FUNNELS.map((f): [string, Array<[string, string]>] => [f.slug, seccionesDeFunnel(f)]),
  ];
  assert.equal(todas.length, 14, 'las dos portadas y las doce');
  for (const [slug, secciones] of todas) {
    const c = secciones.find(([id]) => id === 'empezar')?.[1] ?? '';
    assert.ok(c, `${slug}: sin cierre`);
    for (const p of activos) {
      assert.ok(c.includes(`<span data-mako-precio="${p.id}">`), `${slug}: ${p.id} sin su precio por marca`);
      assert.ok(c.includes(`href="https://hola-mako.com/planes/${p.id}?landing=${slug}"><span>Empezar mis <span data-mako-prueba="dias">${PRUEBA_DIAS}</span> días gratis</span></a>`),
        `${slug}: el botón de ${p.id} lleva a su carrito con el origen, con los días por marca`);
    }
    const destacados = [...c.matchAll(/class="mkv-plan mkv-plan-destacado">[\s\S]*?data-mako-precio="([a-z-]+)"/g)].map((m) => m[1]);
    assert.deepEqual(destacados, activos.filter((p) => p.destacado).map((p) => p.id), `${slug}: el destacado es el de los planes`);
    assert.doesNotMatch(c, /data-mako-planes|data-calendly/, `${slug}: el cierre no es el lugar de las columnas ni una agenda`);
    const hablar = c.indexOf('¿Prefieres hablar antes? <a href=');
    assert.ok(hablar > c.lastIndexOf('class="mkv-plan'), `${slug}: la llamada va debajo de los planes`);
    assert.ok(c.slice(hablar).includes(`landing=${slug}">Déjanos tus datos y te escribimos</a>`), `${slug}: la llamada lleva el origen`);
  }
});
