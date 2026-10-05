// =============================================================================
// El pulso por página: agrupar clics, leer la profundidad, y no dibujar ceros
// =============================================================================
// Lo que cuida este archivo son las tres cosas que esta pantalla puede afirmar de
// más, y cada una ya tiene precedente pagado en el repo:
//
//   1. Contar CLICS donde se prometieron PERSONAS. Tres clics de la misma persona
//      no son tres personas, y en una página con un botón que scrollea ése es el
//      caso normal.
//   2. Dibujar 0% de profundidad cuando lo que pasó es que no se midió. El scroll
//      existe desde el Pixel v19: dividir por los visitantes daría «el 0,2% llega
//      a tu oferta» sobre una página que nadie está midiendo.
//   3. Dibujar 0 cuando la consulta FALLÓ. El cero y el «no pude leer» no son lo
//      mismo, y confundirlos ya costó una medición fantasma acá.
//
// Correr: npx tsx --test tests/landing-pulso.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clavePorClic, ordenarClics, profundidadDe, HITOS_SCROLL, MAX_CLICS } from '../lib/landing-pulso';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
/** ⚠️ Sin comentarios: los comentarios de este módulo NOMBRAN lo que no tiene que
 *  pasar, así que un guard que busca una cadena se acusa a sí mismo por el párrafo
 *  que la explica. */
const soloCodigo = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── clavePorClic: los tres formatos que escribe el snippet ──────────────────

test('los tres formatos del detalle de un clic se parten bien', () => {
  // Copiados del snippet (lib/landing-token.ts: `detalle` + ' — ' + texto).
  assert.deepEqual(clavePorClic('boton: Agendar ahora'), { clave: 'boton: Agendar ahora', texto: 'Agendar ahora' });
  assert.deepEqual(clavePorClic('ancla #registro — Ver precios'), { clave: 'ancla #registro', texto: 'Ver precios' });
  assert.deepEqual(clavePorClic('https://negocioejemplo.com/precios — Ver planes'), {
    clave: 'https://negocioejemplo.com/precios', texto: 'Ver planes',
  });
  // Un link sin texto (un ícono): queda el destino y nada más.
  assert.deepEqual(clavePorClic('https://negocioejemplo.com/gracias'), {
    clave: 'https://negocioejemplo.com/gracias', texto: null,
  });
});

test('un botón SIN texto no se lee como un link, y un detalle vacío no se descarta', () => {
  // `boton: ` pelado: el snippet manda `'boton: ' + texto` y el trim se come el
  // espacio. Sin buscar el prefijo sin espacio, esto caía por el camino del link.
  assert.deepEqual(clavePorClic('boton:'), { clave: 'boton:', texto: null });
  assert.deepEqual(clavePorClic('boton: '), { clave: 'boton:', texto: null });
  // Un clic sin detalle ocurrió igual: esconderlo sería tirar una medición real.
  for (const v of [null, undefined, '', '   ']) {
    assert.deepEqual(clavePorClic(v), { clave: '(sin destino)', texto: null });
  }
});

test('el texto del botón puede traer su propio guión largo y viaja entero', () => {
  // El separador es la PRIMERA aparición de ` — `: ni una URL ni `ancla #x` tienen
  // espacios, así que lo de después es del botón, guiones incluidos.
  assert.deepEqual(clavePorClic('https://negocioejemplo.com — Reservar — hoy mismo'), {
    clave: 'https://negocioejemplo.com', texto: 'Reservar — hoy mismo',
  });
});

// ── ordenarClics: personas ≠ clics ──────────────────────────────────────────

/** Arma el acumulador como lo arma getPulso, para no duplicar su forma. */
function acum(filas: Array<{ detalle: string; visitor: string }>) {
  const m = new Map<string, { clics: number; personas: Set<string>; textos: Map<string, number> }>();
  for (const f of filas) {
    const { clave, texto } = clavePorClic(f.detalle);
    let c = m.get(clave);
    if (!c) { c = { clics: 0, personas: new Set(), textos: new Map() }; m.set(clave, c); }
    c.clics++;
    c.personas.add(f.visitor);
    if (texto) c.textos.set(texto, (c.textos.get(texto) ?? 0) + 1);
  }
  return m;
}

test('⚠️ TRES CLICS DE LA MISMA PERSONA NO SON TRES PERSONAS', () => {
  // Es la mitad cara de la pantalla: «qué botón tocan» se contesta con gente, y
  // un CTA que scrollea al formulario se aprieta varias veces por visita.
  const { filas } = ordenarClics(acum([
    { detalle: 'ancla #registro — Agendar', visitor: 'v1' },
    { detalle: 'ancla #registro — Agendar', visitor: 'v1' },
    { detalle: 'ancla #registro — Agendar', visitor: 'v1' },
  ]));
  assert.equal(filas.length, 1);
  assert.equal(filas[0].clics, 3);
  assert.equal(filas[0].personas, 1, 'se contaron clics donde se prometieron personas');
});

test('el mismo destino con dos textos es UNA fila, con el texto más visto', () => {
  // El snippet lee innerText: el mismo link puede llegar como «Agendar» arriba y
  // «Empezar» al final. Agrupando por el crudo, la lista mostraría el destino dos
  // veces con la mitad de los clics cada vez.
  const { filas, restantes } = ordenarClics(acum([
    { detalle: 'https://negocioejemplo.com/alta — Agendar', visitor: 'v1' },
    { detalle: 'https://negocioejemplo.com/alta — Agendar', visitor: 'v2' },
    { detalle: 'https://negocioejemplo.com/alta — Empezar', visitor: 'v3' },
  ]));
  assert.equal(restantes, 0);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].clics, 3);
  assert.equal(filas[0].personas, 3);
  assert.equal(filas[0].texto, 'Agendar');
  assert.equal(filas[0].destino, 'negocioejemplo.com/alta');
});

test('un botón sin href no inventa un destino', () => {
  // `boton:` es el prefijo interno del snippet: mostrarlo como dirección sería
  // dibujar nuestra plomería como si fuera un lugar de la página del cliente.
  const { filas } = ordenarClics(acum([{ detalle: 'boton: Quiero saber más', visitor: 'v1' }]));
  assert.equal(filas[0].destino, null);
  assert.equal(filas[0].texto, 'Quiero saber más');
});

test('el orden es por clics, el desempate por personas, y la lista se topea', () => {
  const filas: Array<{ detalle: string; visitor: string }> = [
    { detalle: 'https://a.example/x', visitor: 'v1' },
    { detalle: 'https://a.example/x', visitor: 'v1' },
    { detalle: 'https://b.example/y', visitor: 'v1' },
    { detalle: 'https://b.example/y', visitor: 'v2' },
  ];
  // 2 clics cada uno: gana el que tuvo DOS personas distintas.
  const dos = ordenarClics(acum(filas));
  assert.equal(dos.filas[0].clave, 'https://b.example/y');

  // El tope: MAX_CLICS filas y el resto contado, no escondido.
  const muchas = Array.from({ length: MAX_CLICS + 4 }, (_, i) => ({
    detalle: `https://negocioejemplo.com/p${i}`, visitor: `v${i}`,
  }));
  const topeada = ordenarClics(acum(muchas));
  assert.equal(topeada.filas.length, MAX_CLICS);
  assert.equal(topeada.restantes, 4);
});

// ── profundidadDe: el cero que no se dibuja ─────────────────────────────────

test('⚠️ SIN NADIE MEDIDO DEVUELVE null, NUNCA UNA BARRA EN 0%', () => {
  // La pantalla usa este null para explicar qué falta (el Pixel, su versión) en
  // vez de afirmar que nadie llegó a la oferta.
  assert.equal(profundidadDe([]), null);
});

test('la profundidad sale del MÁXIMO por persona, y los hitos son acumulativos', () => {
  // El snippet manda un evento por hito cruzado Y uno exacto al irse, así que lo
  // que llega acá es un tope por persona: 4 personas, una de ellas al 100.
  const p = profundidadDe([18, 40, 80, 100]);
  assert.ok(p);
  assert.equal(p.base, 4);
  assert.deepEqual(p.hitos.map((h) => h.hito), [...HITOS_SCROLL]);
  assert.deepEqual(p.hitos.map((h) => h.personas), [3, 2, 2, 1]);
});

test('la mayor caída puede ser el PRIMER escalón: entrar y no llegar al 25%', () => {
  // La página donde la gente se va arriba es justo la que hay que arreglar, y con
  // los escalones empezando en el 25% esa caída quedaba invisible.
  const p = profundidadDe([5, 7, 9, 10, 80]);
  assert.ok(p);
  assert.deepEqual(p.mayorCaida, { desde: 0, hasta: 25, personas: 4 });

  // Y cuando la gente entra pero se va en el medio, el escalón es ése.
  const q = profundidadDe([30, 35, 40, 45, 100]);
  assert.ok(q);
  assert.deepEqual(q.mayorCaida, { desde: 25, hasta: 50, personas: 4 });

  // Nadie se cae: no hay caída que destacar, y no se inventa una.
  const r = profundidadDe([100, 100]);
  assert.ok(r);
  assert.equal(r.mayorCaida, null);
});

// ── cableado: lo que el typecheck no ve ─────────────────────────────────────

const PURO = soloCodigo(leer('../lib/landing-pulso.ts'));
const LIB = soloCodigo(leer('../lib/landing-pulso-server.ts'));

test('la parte probable vive FUERA del modulo con server-only', () => {
  // Es la razon de que haya dos archivos: adentro de un `server-only` ninguno de
  // los tests de arriba puede importar nada, y la pantalla ('use client') tampoco
  // puede traerse las constantes de version del Pixel sin romper el build.
  assert.doesNotMatch(PURO, /import\s+'server-only'/, 'lib/landing-pulso.ts volvio a ser server-only: los tests de arriba no pueden correr y la pantalla no puede importar sus constantes');
  assert.match(LIB, /import\s+'server-only'/, 'la lectura perdio su server-only: su grafo entero puede viajar al navegador');
  for (const f of ['clavePorClic', 'ordenarClics', 'profundidadDe']) {
    assert.ok(PURO.includes(`export function ${f}`), `${f} se mudo al modulo sin test`);
  }
});

test('se PAGINA, y los clics y el scroll se piden por separado', () => {
  // `vsl_events` pasa las 75.000 filas en un workspace: un `.select()` suelto topea
  // en 1000 y pierde datos SIN error. Y dos consultas y no un `.in(...)` porque el
  // índice de los clics es PARCIAL (mig 0133) y un IN no lo usa.
  assert.ok(LIB.includes('leerPorPaginas'), 'se dejó de paginar: la lista de clics quedaría cortada en 1000 filas sin avisar');
  assert.match(LIB, /eq:\s*\{\s*tipo_evento:\s*'click'\s*\}/, 'los clics dejaron de pedirse por su tipo');
  assert.match(LIB, /eq:\s*\{\s*tipo_evento:\s*'scroll'\s*\}/, 'el scroll dejó de pedirse por su tipo');
  assert.doesNotMatch(LIB, /\.in\('tipo_evento'/, 'un IN de tipos no usa el índice parcial de los clics');
});

test('⚠️ CADA BLOQUE QUE FALLA EMPUJA UNA FALLA: ningún catch devuelve un cero', () => {
  // La regla de la casa. Un catch que deja el contador en 0 hace que la pantalla
  // dibuje «nadie llegó a tu oferta» sobre una consulta que nunca corrió.
  for (const bloque of ['visitas', 'scroll', 'clics', 'paginas', 'pixel']) {
    assert.ok(
      LIB.includes(`fallas.push({ bloque: '${bloque}'`),
      `el bloque ${bloque} dejó de reportar su falla: su vacío pasa a leerse como un cero medido`,
    );
  }
  // Y ningún `catch` del módulo se come el error sin dejar rastro.
  const mudos = [...LIB.matchAll(/catch\s*(?:\([^)]*\))?\s*\{([^{}]*)\}/g)]
    .filter((m) => !m[1].includes('fallas.push') && !m[1].includes('return null'));
  assert.equal(mudos.length, 0, `hay ${mudos.length} catch que descartan el error sin decirlo`);
});

test('el sello del constructor no cuenta como clic de la persona, y se dice cuántos fueron', () => {
  // 208 de 441 clics de un workspace medido eran «Edit with Lovable». Se filtran al
  // LEER —el evento queda en la base— y la pantalla dice cuántos, para que la lista
  // no parezca incompleta por magia.
  assert.ok(LIB.includes('esClicDelConstructor'), 'volvió a entrar el badge del constructor a la lista de botones');
  assert.ok(LIB.includes('clicsDelConstructor++'), 'se filtran sin contarlos: la lista queda corta sin explicación');
});

test('la lista de páginas guardadas se lee con la versión ESTRICTA', () => {
  // Con `getSetting`, un 5xx de Supabase se lee como «no tiene páginas» y el
  // selector se queda mudo sin decir que no pudo leer.
  assert.ok(LIB.includes('getSettingEstricto'), 'un error leyendo las páginas volvió a convertirse en «no hay páginas»');
  assert.doesNotMatch(LIB, /\bgetSetting\(/, 'se coló la versión que convierte «no pude leer» en «no existe»');
});

test('un evento sin página no se reparte entre las páginas: se cuenta aparte', () => {
  // Los eventos de un Pixel anterior al v12 traen landing_url NULL y nunca van a
  // traer otra cosa. Repartirlos sería inventar en cuál de tus páginas pasó.
  assert.ok(LIB.includes('eventosSinPagina++'), 'los eventos sin página dejaron de contarse: la pantalla no puede ofrecer el arreglo');
  const sueltos = (LIB.match(/if \(!u\) \{ eventosSinPagina\+\+; continue; \}/g) ?? []).length;
  assert.equal(sueltos, 3, 'los tres barridos (visitas, scroll, clics) tienen que descartar lo que no se puede atribuir');
});

const UI = soloCodigo(leer('../app/landing-analyst/PulsoPaginas.tsx'));

/**
 * El bloque de un componente, de su firma a la declaración siguiente.
 *
 * ⚠️ NO se corta en el primer `\n}`: eso cierra el TIPO de las props (`}) {`), así
 * que el recorte terminaba ANTES del primer `if` del cuerpo y el guard daba «dejó
 * de mirar» sobre código que sí miraba. Y se afirma el LARGO: si mañana mide
 * 4.000, está mirando otra cosa.
 */
function bloqueDe(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i > 0, `no encontré ${firma}`);
  const re = /\n(?:export )?function /g;
  re.lastIndex = i + firma.length;
  const sig = re.exec(src);
  const b = src.slice(i, sig ? sig.index : src.length);
  assert.ok(b.length < 4000, `el recorte de ${firma} mide ${b.length}: está mirando otra cosa`);
  return b;
}

test('la pantalla contesta «no se pudo leer» ANTES de dibujar cualquier número', () => {
  // El guard es de ORDEN: el early-return de la falla va primero, o el bloque
  // pinta un 0 sobre una lectura que no ocurrió.
  for (const comp of ['function Profundidad', 'function Clics']) {
    const cuerpo = bloqueDe(UI, comp);
    const iFalla = cuerpo.indexOf('if (falla)');
    assert.ok(iFalla > 0, `${comp} dejó de mirar si su lectura falló`);
    const iBarras = cuerpo.indexOf('<Barras');
    assert.ok(iBarras > 0, `${comp} dejó de dibujar su gráfico: el guard no mide nada`);
    assert.ok(iFalla < iBarras, `${comp} dibuja la barra antes de preguntar si pudo leer`);
    // Y el vacío tampoco puede ganarle: un EmptyState que explique «no hay datos»
    // sobre una consulta que falló es el mismo cero con otra cara.
    const iVacio = cuerpo.indexOf('<EmptyState');
    assert.ok(iVacio > 0 && iFalla < iVacio, `${comp} dibuja el vacío antes de preguntar si pudo leer`);
  }
});

test('el vacío EXPLICA qué falta y lleva a donde se arregla', () => {
  // Un «sin datos» pelado manda a buscar el problema al lugar equivocado: las tres
  // causas (sin Pixel, Pixel viejo, Pixel al día y sin datos) se dicen distinto.
  assert.ok(UI.includes('PIXEL_SCROLL_DESDE'), 'el vacío del scroll dejó de nombrar la versión que lo mide');
  assert.ok(UI.includes('PIXEL_CLICS_DESDE'), 'el vacío de los clics dejó de nombrar la versión que los mide');
  const accionesAlPixel = (UI.match(/href:\s*LINK_PIXEL/g) ?? []).length;
  assert.ok(accionesAlPixel >= 3, `un vacío sin salida: solo ${accionesAlPixel} llevan a donde se pega el código`);
});

test('el denominador de la profundidad está a la vista', () => {
  // Un porcentaje sin su denominador acá diría que la página es mala cuando lo que
  // pasa es que el scroll no se está midiendo.
  assert.ok(UI.includes('p.base') && UI.includes('pag.visitantes'),
    'se perdió la línea que dice en cuántas de las personas que entraron se midió');
});

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ PROBADO ROMPIÉNDOLO (05/10/2026), de a una rotura y restaurando entre cada
// una. Con el árbol sano: 19 pasan / 0 fallan.
//
//   · `personas: a.personas.size` → `a.clics`                  → 17 / 2
//   · `profundidadDe`: el `return null` del vacío apagado       → 18 / 1
//   · `previoHito` arrancado en 25 (sin el escalón de entrar)   → 18 / 1
//   · el texto más visto cambiado por el último que llega       → 18 / 1
//   · el `fallas.push` del bloque de clics por un `void err`    → 18 / 1
//   · `getSettingEstricto` → `getSetting`                       → 18 / 1
//   · el `if (falla)` de `Clics` movido abajo del vacío         → 18 / 1
//
// Los siete son UN test cada uno (un test con dos asserts cuenta una vez), menos
// el primero, que cae en los dos tests que miran personas contra clics.
// ─────────────────────────────────────────────────────────────────────────────
