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
import { INICIO, inicioDesde, atajoBuscador } from '../lib/no-encontrado';

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
  assert.equal(atajoBuscador('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), '⌘ K');
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
