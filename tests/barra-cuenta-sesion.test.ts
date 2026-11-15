// =============================================================================
// La barra del sitio con la sesión abierta: la cuenta, no «Iniciar sesión» (15/11/2026)
// =============================================================================
// Martín, 15/11/2026, textual: «si yo ya tengo iniciada la sesión, en lugar de decirme iniciar sesión, debería ahí estar mi
// imagen de perfil, mi foto de perfil. Y si le doy clic, que me salte el desplegable, ya sea para ir al dashboard o para ir
// a la pestaña dentro de Maco, no? O para cerrar sesión».
//
// Lo que cuida, que es lo que se rompe sin darse cuenta:
//   1. EL HTML DEL SERVER SIGUE DICIENDO «Iniciar sesión» en los dos lugares (la barra de la computadora y el pie del menú
//      del teléfono). Ése es el que ven el buscador, quien no tiene JavaScript y el visor estático de las landings. El día
//      que alguien lea la sesión en el server para pintar la cara, esto se cae — y tiene que caerse, pero NO por lo que
//      decía acá («para que las veinte páginas públicas sigan siendo estáticas»): estáticas no son, y el test 6 lo mide.
//   2. La sesión se pregunta por /api/auth/me, que es la única puerta de sesión PÚBLICA (lib/rutas-publicas.ts).
//   3. UNA sola pregunta por carga: la barra monta la cuenta DOS veces (la de PC y el pie del teléfono), así que el pedido
//      vive en el módulo y no adentro del componente. Con uno por instancia eran 2 pedidos a /api/auth/me en cada visita de
//      las 25 páginas que montan esta barra (4 con sesión), y los dos lugares podían contradecirse si uno se caía.
//   4. Los tres destinos del desplegable son los de verdad: el repartidor por rol (/inicio), la tab MaKo
//      (RUTA_OPS_CENTER_NEGOCIO) y el POST /api/auth/logout que ya usa el resto de la app, no un logout nuevo.
//   5. Abre con teclado, cierra con Escape y con un clic afuera, y el botón dice aria-expanded.
//   6. El botón y el desplegable declaran SUS DOS MODOS en estilos.ts: nacen después de que el sol y la luna leyó los
//      colores de la página (app/vsl/_competencia/TemaSitio.tsx), así que el script no los lleva al modo y sin esas reglas
//      quedan del modo anterior cuando se aprieta el sol.
//
// PROBADO ROMPIÉNDOLO (15/11/2026; base 5 / 0): sacar el <MenuCuenta> del pie del menú del teléfono → 3 / 2 («el pie del
// menú del teléfono sin su cuenta» y «la barra dibuja la cuenta en 1 lugares y son 2») · cambiar RUTA_MAKO a '/mako' → 4 / 1 ·
// borrar la regla de html[data-sitio-modo="oscuro"] .s-cuenta → 4 / 1 · volver el fetch adentro del componente → 4 / 1
// («fetch('/api/auth/me') se pide ADENTRO del componente»).
// Correr: node --import tsx --test tests/barra-cuenta-sesion.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Barra } from '../app/vsl/_sitio/Barra';
import { RUTA_OPS_CENTER_NEGOCIO } from '../lib/ops-center-ruta';
import { PUBLICOS } from '../lib/rutas-publicas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** El fuente sin comentarios: una ruta nombrada en una nota no es la ruta que se usa. */
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

test('sin sesión, el HTML del server dice «Iniciar sesión» en los dos lugares de la barra', () => {
  const html = renderToStaticMarkup(createElement(Barra, { claro: true }));
  // Los dos: la barra de la computadora y el pie del menú del teléfono.
  const veces = html.split('href="/login">Iniciar sesión</a>').length - 1;
  assert.equal(veces, 2, `la barra tiene ${veces} «Iniciar sesión» y tienen que ser 2 (la de PC y la del pie del teléfono)`);
  assert.ok(html.includes('class="s-cuenta s-solo-pc"'), 'la barra de la computadora sin su cuenta');
  assert.ok(html.includes('class="s-cuenta s-cuenta-pie"'), 'el pie del menú del teléfono sin su cuenta');
  // Y NADA de la cara ni del desplegable: el server no sabe quién entró. Que este render funcione ES la razón de verdad —
  // acá no hay request store, y un `cookies()` en la Barra no devolvería null sino que reventaría. Lo que se dibuje de más
  // acá se dibuja en las 25 páginas que montan esta barra.
  assert.doesNotMatch(html, /s-cuenta-b|s-cuenta-m|s-cuenta-cara/, 'el server está dibujando la cara: ¿leyó la cookie?');
});

test('la cuenta pregunta por /api/auth/me y nunca lee la sesión en el server', () => {
  const src = sinComentarios(leer('app/vsl/_sitio/Cuenta.tsx'));
  assert.ok(src.includes("fetch('/api/auth/me'"), 'la cuenta no pregunta por /api/auth/me');
  assert.ok(src.includes("fetch('/api/perfil'"), 'la foto sale de /api/perfil, la misma puerta del Sidebar');
  for (const prohibido of ['getUsuarioActual', 'next/headers', 'server-only']) {
    assert.ok(!src.includes(prohibido), `la cuenta usa ${prohibido}: la Barra se arma con renderToStaticMarkup en cuatro tests y en scripts/visor-landings/, donde cookies() revienta`);
  }
  // /api/auth es público: sin eso, el pedido del navegador se lo come el gate.
  assert.ok((PUBLICOS as readonly string[]).includes('/api/auth'), '/api/auth dejó de ser público: la barra no puede preguntar quién entró');
});

test('pregunta UNA vez por carga, aunque la barra la dibuje en dos lugares', () => {
  // La barra monta DOS <MenuCuenta>: la de la computadora y el pie del menú del teléfono (una la esconde el CSS, la otra
  // vive dentro de un <details> cerrado, pero las dos montan y las dos corren su efecto). Con el fetch adentro del
  // componente eran 2 pedidos a /api/auth/me por carga de CADA una de las 25 páginas que montan esta barra —también sin
  // sesión, que son casi todas— y 4 con sesión (medido el 15/11/2026 montando <Barra> en un DOM de prueba). /api/auth/me
  // hace siete lecturas más la marca de «última vez que entró» y /api/perfil otras tres, y es un viaje que antes de hoy
  // esas páginas no hacían NI UNA vez. Y compartido, los dos lugares ya no pueden contradecirse cuando un pedido se cae.
  const barra = sinComentarios(leer('app/vsl/_sitio/Barra.tsx'));
  const lugares = barra.split('<MenuCuenta').length - 1;
  assert.equal(lugares, 2, `la barra dibuja la cuenta en ${lugares} lugares y son 2 (la de PC y el pie del teléfono)`);
  const src = sinComentarios(leer('app/vsl/_sitio/Cuenta.tsx'));
  const componente = src.indexOf('export function MenuCuenta');
  for (const puerta of ["fetch('/api/auth/me'", "fetch('/api/perfil'"]) {
    assert.equal(src.split(puerta).length - 1, 1, `${puerta}) está escrito más de una vez`);
    assert.ok(src.indexOf(puerta) < componente, `${puerta}) se pide ADENTRO del componente: la barra lo monta dos veces y se pediría dos veces por carga`);
  }
});

test('los tres destinos del desplegable son los de verdad', () => {
  const src = sinComentarios(leer('app/vsl/_sitio/Cuenta.tsx'));
  // El repartidor por rol, no una tab elegida a mano (app/inicio/page.tsx).
  assert.ok(src.includes("const RUTA_TABLERO = '/inicio'"), 'el tablero ya no sale del repartidor /inicio');
  // La tab MaKo, atada a donde vive de verdad.
  assert.ok(src.includes(`const RUTA_MAKO = '${RUTA_OPS_CENTER_NEGOCIO}'`), `la tab MaKo vive en ${RUTA_OPS_CENTER_NEGOCIO} y el desplegable apunta a otro lado`);
  // El cierre de sesión de la app, no uno nuevo.
  assert.ok(src.includes("fetch('/api/auth/logout', { method: 'POST' })"), 'el cierre de sesión no es el de la app');
  for (const r of ['app/inicio/page.tsx', 'app/second-brain/page.tsx', 'app/api/auth/logout/route.ts']) {
    assert.ok(existsSync(join(RAIZ, r)), `${r} no existe: el desplegable lleva a un 404`);
  }
  // Teclado y cierre: un desplegable que sólo se cierra apretando otra vez el botón es una trampa.
  for (const [que, trozo] of [['aria-expanded', 'aria-expanded={abierto}'], ['Escape', "'Escape'"], ['el clic afuera', "'pointerdown'"], ['las flechas', 'ArrowDown']] as const) {
    assert.ok(src.includes(trozo), `el desplegable sin ${que}`);
  }
});

test('la cara y el desplegable declaran sus dos modos (el sol y la luna no los toca)', () => {
  const src = leer('app/vsl/_sitio/Cuenta.tsx');
  const css = leer('app/vsl/_sitio/estilos.ts');
  assert.ok(src.includes('data-tema-fijo'), 'sin data-tema-fijo el sol y la luna les pisa los colores con !important');
  for (const sel of ['.s-claro .s-cuenta,html[data-sitio-modo="claro"] .s-cuenta', 'html[data-sitio-modo="oscuro"] .s-cuenta']) {
    assert.ok(css.includes(sel), `estilos.ts sin «${sel}»: el desplegable queda del modo anterior al apretar el sol`);
  }
  // Y los colores por variable, no clavados dos veces: lo que cambia de modo es el valor de --cu-*.
  for (const v of ['--cu-fondo', '--cu-tinta', '--cu-dim', '--cu-raya', '--cu-velo']) {
    assert.ok(css.includes(`${v}:`), `estilos.ts sin la variable ${v} de la cuenta`);
  }
});

test('las páginas de esta barra NO son estáticas: el layout raíz ya lee la cookie', () => {
  // ⚠️ EL PRECIO DE ESTA BARRA NO SE PAGA EN «PÁGINAS ESTÁTICAS QUE SE VUELVEN DINÁMICAS» (medido el 15/11/2026). Las tres
  // notas de esta punta decían que leer la sesión en el server «vuelve dinámicas a veinte páginas públicas estáticas». No:
  // app/layout.tsx es el layout RAÍZ de todas las rutas y hace `await getUsuarioActual()` en el cuerpo del componente, que
  // es `await cookies()` (lib/auth.ts). En este Next (16.2.6, sin `ppr` ni `cacheComponents`) `cookies()` entra por el modo
  // `prerender-legacy` y llama a `throwToInterruptStaticGeneration` —«Route … couldn't be rendered statically because it
  // used `cookies`»—, que además pone `revalidate = 0`. O sea que ninguna de estas páginas se prerenderiza, los
  // `revalidate = 300` de la portada y de /vsl/<slug> tampoco corren, y el argumento se cae.
  //
  // Este test fija los DOS datos de los que depende esa cuenta, para que el día que cambien salte acá y no en una nota:
  // si alguien saca la lectura de la sesión del layout raíz, o prende `cacheComponents`/`ppr`, entonces estas páginas SÍ
  // pueden volverse estáticas y recién entonces «leer la cookie las vuelve dinámicas» querrá decir algo.
  const layout = sinComentarios(leer('app/layout.tsx'));
  assert.match(layout, /await getUsuarioActual\(\)/, 'el layout raíz dejó de leer la sesión: si ya nadie toca cookies() arriba, estas páginas pueden ser estáticas y hay que revisar la nota de Cuenta.tsx');
  const config = sinComentarios(leer('next.config.ts'));
  for (const bandera of ['cacheComponents', 'dynamicIO', 'ppr']) {
    assert.ok(!config.includes(bandera), `next.config.ts prendió ${bandera}: con eso una ruta puede ser estática aunque el layout lea cookies, y la cuenta de costo de Cuenta.tsx hay que rehacerla`);
  }
  // Y la razón que SÍ vale: la Barra se arma fuera de todo pedido en estos cuatro tests y en el visor, donde cookies()
  // no devuelve null — revienta. Si alguno deja de armarla, el muro que impide leer la sesión acá se corrió.
  for (const t of ['tests/vsl-landings-competencia.test.ts', 'tests/vsl-landings-dicen-el-plan.test.ts', 'tests/planes-tres-bloques.test.ts']) {
    const src = leer(t);
    assert.ok(src.includes('renderToStaticMarkup'), `${t} ya no arma la barra fuera de un pedido`);
  }
});
