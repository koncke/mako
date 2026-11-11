// =============================================================================
// La pantalla de «esta dirección no existe» (7/11/2026)
// =============================================================================
// Hasta el 7/11 no había ninguna, y lo que se veía no era un hueco: era **el 404 por defecto de Next, en
// inglés** («404 · This page could not be found»), adentro del layout de MaKo, en una app que está entera en
// español. Medido en producción contra `hola-mako.com/esta-ruta-no-existe-7nov`.
//
// Esto prueba lo único de esa pantalla que puede romperse SIN QUE SE NOTE: el link que ofrece. Lo visual se
// mira; que el link conserve el negocio, no — se ve igual con el negocio equivocado.
//
// Correr: node --import tsx --test tests/no-encontrado.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INICIO, inicioDesde, atajoBuscador, marcarNoEncontrado, suscribirNoEncontrado, hayNoEncontrado } from '../lib/no-encontrado';
import { tituloDe, TITULO_NO_ENCONTRADO } from '../lib/titulo-tab';

const RAIZ = join(import.meta.dirname, '..');

test('⚠️ el botón del 404 conserva el negocio que se está mirando', () => {
  // ÉSTE es el que importa. Un super admin mirando el negocio de un cliente tiene `?ws=3` en la barra; si el
  // botón fuera `/dashboard` pelado lo devolvería al SUYO sin decírselo — la pantalla se ve igual y los datos
  // son otros. Es el salto silencioso que el repo cuida en cada link con `rutaConWs`.
  assert.equal(inicioDesde('?ws=3'), '/dashboard?ws=3');
  assert.equal(inicioDesde('?algo=1&ws=42&otro=x'), '/dashboard?ws=42');
});

test('sin negocio en la barra, el link es el inicio pelado', () => {
  for (const s of ['', '?', '?otra=cosa']) {
    assert.equal(inicioDesde(s), INICIO, `«${s}» no dio el inicio`);
  }
});

test('un `ws` inventado no viaja al link: viene de la URL, o sea de cualquiera', () => {
  // No es que rompa nada río abajo (el servidor valida), pero ofrecer un link que ya sabemos que no sirve es
  // mandar a la persona a una segunda pantalla rota desde la que le avisa de la primera.
  for (const malo of ['abc', '3; drop', '-1', '1.5', '', '9999999999999']) {
    assert.equal(inicioDesde(`?ws=${encodeURIComponent(malo)}`), INICIO, `«${malo}» se coló en el link`);
  }
});

test('el atajo se escribe como lo tiene ESE teclado', () => {
  // Decirle «Ctrl K» a alguien en una Mac es nombrarle una tecla que para él no hace eso.
  assert.equal(atajoBuscador('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), '⌘ K');
  // Un teléfono no tiene teclado: la frase no va (11/11/2026, el 404 de Lead Magnet mirado a 375 px).
  assert.equal(atajoBuscador('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), null);
  assert.equal(atajoBuscador('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'), null);
  assert.equal(atajoBuscador('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), '⌘ K', 'un iPad suele tener teclado');
  assert.equal(atajoBuscador('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'Ctrl K');
  assert.equal(atajoBuscador(''), 'Ctrl K', 'sin dato, el de la mayoría');
});

test('el inicio apunta a una ruta que EXISTE en el nav', () => {
  // Si alguien renombra la ruta del Dashboard, este 404 mandaría a otro 404: el peor final posible para una
  // pantalla cuyo trabajo es sacar a alguien de uno.
  const nav = readFileSync(join(RAIZ, 'app/_components/nav.ts'), 'utf8');
  assert.ok(nav.includes(`href: '${INICIO}'`),
    `el 404 manda a ${INICIO} y esa ruta ya no está en el nav: mandaría a otro 404`);
});

test('la pantalla le habla al cliente en español y no en inglés', () => {
  // El bug que vino a arreglar era, literalmente, un texto en inglés. Si alguien la reescribe y vuelve a caer
  // en el default de Next, esto lo dice.
  const src = readFileSync(join(RAIZ, 'app/not-found.tsx'), 'utf8');
  const visible = src.split('\n').filter((l) => !l.trim().startsWith('//'));
  assert.ok(visible.some((l) => /Esta dirección no existe/.test(l)), 'desapareció el título en español');
  assert.ok(!visible.some((l) => /could not be found|Page not found|Not Found<|404<\/h1>/i.test(l)),
    'volvió un texto de 404 en inglés');
});

test('el 404 no promete un botón que no lleva a ningún lado', () => {
  // «Volver a donde estaba» sólo aparece si hay algo atrás: un botón que no hace nada es peor que no tenerlo,
  // y en una pantalla de error es exactamente lo que hace desconfiar del resto.
  const src = readFileSync(join(RAIZ, 'app/not-found.tsx'), 'utf8');
  assert.match(src, /hayAtras\s*&&/, 'el botón de volver dejó de depender de que haya a dónde volver');
  assert.match(src, /history\.length\s*>\s*1/, 'ya no se comprueba que haya historial');
});

// =============================================================================
// EL TÍTULO DE LA PESTAÑA EN UN 404 (9/11/2026)
// =============================================================================
// Lo dejó anotado la propia pantalla del 7/11 como «otro ítem»: el 404 ya estaba en español, pero la PESTAÑA
// seguía diciendo «MaKo - Esta ruta no existe 7nov» —el slug convertido en nombre por `desdeLaRuta`, la red
// de seguridad de `tituloDe`—. Un título es lo que queda en el historial y en lo que alguien manda cuando
// dice «no me anda esto»: un nombre inventado ahí se guarda como si el lugar existiera.
//
// ROTURAS (9/11/2026, una por vez y restaurada; base 14 / 0):
//   · titular con `tituloDe(ruta)` en vez de `TITULO_NO_ENCONTRADO`            → 13 / 1
//   · sacar `noEncontrado` de las dependencias del efecto                      → 13 / 1
//   · que `marcarNoEncontrado` no avise a los oyentes                          → 12 / 2
//   · sacar el apagado (`return () => marcarNoEncontrado(false)`) del 404      → 13 / 1
//   · dejar que la landing y lo compartido salgan antes aunque sea un 404      → 13 / 1
// =============================================================================

test('⚠️ el título del 404 NO se deriva de la ruta: ahí la ruta es lo que está mal', () => {
  // Esto es el bug, medido: la red de seguridad de `tituloDe` convierte el slug en un nombre que se lee como
  // una pantalla real. No está rota —hace lo que tiene que hacer para una ruta sin entrada en el nav—; lo que
  // no puede es opinar sobre una dirección que NO EXISTE.
  assert.equal(tituloDe('/esta-ruta-no-existe-7nov'), 'MaKo - Esta ruta no existe 7nov');
  // Y por eso el 404 tiene su título propio, en español y sin nada del slug.
  assert.equal(TITULO_NO_ENCONTRADO, 'MaKo - Esta dirección no existe');
  assert.doesNotMatch(TITULO_NO_ENCONTRADO, /7nov|ruta no existe/i);
});

test('el aviso llega a quien está escuchando, y se apaga al salir del 404', () => {
  const avisos: boolean[] = [];
  const dejar = suscribirNoEncontrado(() => avisos.push(hayNoEncontrado()));
  try {
    assert.equal(hayNoEncontrado(), false, 'arranca apagado: en el servidor nunca hay un 404 montado');
    marcarNoEncontrado(true);
    marcarNoEncontrado(false);
    assert.deepEqual(avisos, [true, false], 'tiene que avisar las dos veces, no sólo al prender');
  } finally {
    dejar();
    marcarNoEncontrado(false);
  }
});

test('avisar lo mismo dos veces no despierta a nadie, y desuscribirse corta', () => {
  let veces = 0;
  const dejar = suscribirNoEncontrado(() => { veces += 1; });
  try {
    marcarNoEncontrado(true);
    marcarNoEncontrado(true);
    assert.equal(veces, 1, 'el mismo valor dos veces es un aviso, no dos: si no, TituloTab retitula de más');
    dejar();
    marcarNoEncontrado(false);
    assert.equal(veces, 1, 'después de desuscribirse no llega nada');
  } finally {
    dejar();
    marcarNoEncontrado(false);
  }
});

test('⚠️ TituloTab usa el título del 404, y lo tiene en sus dependencias', () => {
  const src = readFileSync(join(RAIZ, 'app/_components/TituloTab.tsx'), 'utf8');
  assert.match(src, /const titulo = noEncontrado \? TITULO_NO_ENCONTRADO : tituloDe\(ruta\);/,
    'sin esto el 404 vuelve a titularse con el slug');
  // La dependencia es lo que hace que SIRVA: el aviso llega después de que el efecto corrió —el 404 y
  // TituloTab son dos ramas distintas del árbol—, así que sin la dependencia el título nunca se rehace.
  assert.match(src, /\}, \[pathname, ruta, noEncontrado\]\);/,
    'el efecto tiene que volver a correr cuando llega el aviso');
  assert.match(src, /useSyncExternalStore\(suscribirNoEncontrado, hayNoEncontrado, \(\) => false\)/,
    'en el servidor el valor es false: el 404 avisa al MONTAR');
});

test('⚠️ en un 404 el título gana también en la landing y en lo compartido', () => {
  // Esas dos salen antes porque traen SU título, pensado para afuera. Un 404 no trae ninguno: si sale antes,
  // la pestaña se queda con el título de la pantalla anterior, que es el bug con otro disfraz.
  const src = readFileSync(join(RAIZ, 'app/_components/TituloTab.tsx'), 'utf8');
  assert.match(src, /if \(trajoElSuyo && !noEncontrado\) return;/);
});

test('⚠️ el 404 apaga el aviso al irse: si no, el título queda pegado en la pantalla siguiente', () => {
  const src = readFileSync(join(RAIZ, 'app/not-found.tsx'), 'utf8');
  assert.match(src, /marcarNoEncontrado\(true\);/, 'tiene que avisar al montar');
  assert.match(src, /return \(\) => \{ marcarNoEncontrado\(false\); \};/,
    'y apagarlo al desmontar: un título pegado es peor que el nombre inventado que vinimos a arreglar');
});

test('el 404 NO intenta escribir document.title: está medido que el observador lo revierte', () => {
  // `TituloTab` monta un MutationObserver sobre el <head> que reafirma su título cada vez que alguien lo pisa
  // (lo necesita por /crm, que llega con su <title> en streaming). Escribirlo desde el 404 es el atajo que no
  // funciona, y que esta pantalla ya había documentado el 7/11 antes de que existiera el arreglo.
  const src = readFileSync(join(RAIZ, 'app/not-found.tsx'), 'utf8');
  assert.doesNotMatch(src, /document\.title\s*=/, 'el 404 avisa, no escribe el título');
});
