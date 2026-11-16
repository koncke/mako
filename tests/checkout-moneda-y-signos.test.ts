// =============================================================================
// El checkout, lo que pidió Martín el 16/11/2026: la moneda de la pasarela elegida, las ✓ y ✗ de la columna, «Reembolsos» sin
// chocar con la línea y el logo de Mercado Pago de verdad
// =============================================================================
// Martín, textual: «el checkout, si se cambia de Mercado Pago o tarjeta de crédito o débito, debería cambiar de pesos a dólares.
// Evidentemente, si pongo tarjeta de crédito, debería decirme dólares. Y si pongo Mercado Pago, debería decirme los pesos
// correspondientes»; «en la suscripción de MaKo Essential y lo que tiene abajo, los checks que tienen deberían ser iguales a los
// checks que tenemos en la columna de los planes, exactamente iguales, con el mismo diseño, con el mismo color… O las cruces»;
// «abajo donde dice reembolsos, choca con la línea divisoria. Eso no puede pasar»; y «no me gusta el logo de Mercado Pago… está
// todo azul y no se llega a distinguir».
//
// Se fija lo DIBUJADO (el checkout de verdad, con el formulario de verdad, renderToStaticMarkup) y la hoja que decide qué se ve. Lo
// que se vio en un navegador (Chromium, 16/11/2026, el checkout dibujado con estos componentes):
//   · con la tarjeta elegida, el precio grande, el renglón del plan, el total y el botón dicen US$; con Mercado Pago, $ … ARS; sin
//     elegir, los pesos (Mercado Pago va primero desde Argentina). A 1440 y a 390 (el resumen plegado del teléfono).
//   · «Reembolsos» terminaba 14,2 px PASADA la línea del formulario en todos los anchos de 900 a 1440; ahora el que menos aire
//     tiene de 320 a 1440 (cada 10 px) deja 61 px, y ningún ancho se desborda.
// Y LA SEGUNDA TANDA DEL 16/11 (Martín: «Sigue estando mal el logo de Mercado Pago… encuentra un logo bueno»; «no me gustaría que
// tenga doble salto de línea… en lugar de poner la palabra Mercado Pago y Stripe, poner los logos»; «el mismo botón negro del mismo
// tamaño»): el logo es el archivo de verdad, el pie va en UN renglón con los dos logos y el botón no cambia con Mercado Pago. Medido
// con Chromium (el checkout dibujado con estos componentes, de 320 a 1440): el pie es un renglón en todos los anchos; a 320 px le
// sobran 17 px al margen y en la computadora termina 64 a 78 px antes de la línea del formulario; «Tarjeta de crédito o débito» va en
// un renglón a 320 (antes, 5) con sus marcas debajo.
// PROBADO ROMPIÉNDOLO (16/11/2026; base 8 / 0): al pie.
// Correr: node --import tsx --test tests/checkout-moneda-y-signos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Ficha, incluyeDeLaColumna, listaDelCheckout, resumenDelPlan, totalDeHoyPorPasarela } from '../app/planes/[plan]/Checkout';
import { CompraPlan } from '../app/planes/[plan]/CompraPlan';
import { LOGO_MP, LogoMercadoPago } from '../app/planes/[plan]/MarcasDePago';
import { CSS_PLANES } from '../app/planes/estilo';
import { SIGNO_NO, SIGNO_SI } from '../app/planes/signos';
import { CSS_TARJETAS, listaCorta } from '../app/planes/Tarjetas';
import { ICON } from '../app/_components/ServicioVisual';
import { PASARELAS, type Pasarela } from '../lib/cobros-tipos';
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const regla = (css: string, sel: string) => css.match(new RegExp(`(?:^|[}\\n])\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

type Opcion = { pasarela: Pasarela; moneda: string; monto: number };
const ESENCIAL = PLANES_MAKO_DEFAULT.find((p) => p.id === 'esencial')!;
const PRO = PLANES_MAKO_DEFAULT.find((p) => p.id === 'pro')!;
/** Un visitante de Argentina: Mercado Pago en pesos primero y la tarjeta en dólares (lib/compra-plan-reglas.ts, `pasarelasParaOfrecer`). */
const DESDE_ARGENTINA = (plan: typeof ESENCIAL): Opcion[] => [{ pasarela: 'mercadopago', moneda: 'ARS', monto: plan.id === 'pro' ? 153_000 : 75_000 }, { pasarela: 'stripe', moneda: 'USD', monto: plan.precioUsd }];

/** El checkout como lo arma app/planes/[plan]/page.tsx: el mismo resumen, y el formulario con lo que cobra hoy cada pasarela. */
function checkout(plan: typeof ESENCIAL, pasarelas: Opcion[], conPrueba: boolean): string {
  const resumen = resumenDelPlan({ nombre: plan.nombre, incluye: incluyeDeLaColumna(plan.capa), capa: plan.capa, precioUsd: plan.precioUsd, pasarelas, conPromo: false, conPrueba, conPrimerMes: (m) => m, precio: '' });
  const form = createElement(CompraPlan, { plan: plan.id, pasarelas, origen: null, refCodigo: null, sinPrueba: !conPrueba, promo: false, ladaInicial: '54', hoy: totalDeHoyPorPasarela(resumen) });
  return renderToStaticMarkup(createElement(Ficha, { resumen, pasarelas: pasarelas.map((x) => x.pasarela), children: form }));
}
/** El texto de cada envoltorio de una pasarela (`data-ck-moneda`), en orden. */
const deLaPasarela = (h: string, p: Pasarela) => [...h.matchAll(new RegExp(`<(?:span|div) data-ck-moneda="${p}"[^>]*>([\\s\\S]*?)</(?:span|div)>`, 'g'))].map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

test('1. con dos pasarelas, el precio de CADA UNA en su moneda: el grande (abierto y plegado), el del renglón, el total y el botón', () => {
  for (const conPrueba of [true, false]) {
    const h = checkout(ESENCIAL, DESDE_ARGENTINA(ESENCIAL), conPrueba);
    const mp = deLaPasarela(h, 'mercadopago'), tarjeta = deLaPasarela(h, 'stripe');
    // Abierto y plegado: el precio grande (2), el renglón del plan (2), los totales (2) y, sin prueba, el botón (1).
    assert.equal(mp.length, conPrueba ? 6 : 7, `con prueba ${conPrueba}: ${mp.length} lugares con el precio de Mercado Pago`);
    assert.equal(tarjeta.length, mp.length, 'la tarjeta no tiene su precio en los mismos lugares');
    for (const t of mp) assert.match(t, /\$ [\d.]+ ARS/, `Mercado Pago dice «${t}»: tiene que ser en pesos`);
    for (const t of tarjeta) { assert.match(t, /US\$ \d+/, `la tarjeta dice «${t}»: tiene que ser en dólares`); assert.doesNotMatch(t, /ARS/); }
    // El de Mercado Pago es el que se ve sin elegir (va primero desde Argentina): lo marca `data-ck-primera`.
    assert.equal((h.match(/data-ck-moneda="mercadopago" data-ck-primera=""/g) ?? []).length, mp.length);
    assert.equal((h.match(/data-ck-moneda="stripe" data-ck-primera/g) ?? []).length, 0);
    // Cada fila de pago dice qué pasarela es: es lo que lee la hoja (`:has(input[value=…]:checked)`).
    for (const p of ['mercadopago', 'stripe']) assert.match(h, new RegExp(`<input type="radio" name="pasarela" value="${p}"`), `la fila de ${p} sin su value`);
  }
  // El botón sin prueba: lo que se cobra HOY, en la moneda de la elegida. Con la prueba, sin cifra (hoy no se cobra nada).
  const sinPrueba = checkout(PRO, DESDE_ARGENTINA(PRO), false);
  assert.match(sinPrueba, /Suscribirme por <span data-ck-moneda="mercadopago" data-ck-primera="">\$ 153\.000 ARS<\/span><span data-ck-moneda="stripe">US\$ 97<\/span> al mes/);
  assert.match(checkout(PRO, DESDE_ARGENTINA(PRO), true), />Empezar mis 7 días gratis</);
});

test('2. la hoja muestra UNO: el de la fila elegida, o el de la primera sin elegir, para cada pasarela que existe', () => {
  const css = CSS_PLANES.replace(/\s+/g, ' ');
  assert.match(css, /\.ck \[data-ck-moneda\] \{ display: contents; \}/, 'el envoltorio arma caja: el precio grande deja de ser una fila flexible');
  assert.match(css, /\.ck \[data-ck-moneda\]:not\(\[data-ck-primera\]\) \{ display: none; \}/, 'sin elegir se verían todos');
  assert.match(css, /\.ck:has\(input\[name="pasarela"\]:checked\) \[data-ck-moneda\] \{ display: none; \}/, 'con una elegida seguiría viéndose la primera');
  for (const p of PASARELAS) {
    assert.ok(css.includes(`.ck:has(input[name="pasarela"][value="${p}"]:checked) [data-ck-moneda="${p}"]`), `elegir ${p} no muestra su precio`);
  }
});

test('3. con una sola pasarela, el resumen queda como estaba (sin envoltorios) y el botón sin prueba dice su precio', () => {
  const h = checkout(ESENCIAL, [{ pasarela: 'stripe', moneda: 'USD', monto: 47 }], false).replace(/<style[\s\S]*?<\/style>/g, '');
  assert.doesNotMatch(h, /data-ck-moneda/);
  assert.match(h, /<div class="ck-precio">US\$ 47<small>por mes<\/small><\/div>/);
  assert.match(h, />Suscribirme por US\$ 47 al mes</);
});

test('4. las ✓ y las ✗ del resumen son LAS de la columna: el mismo dibujo, el mismo color y los mismos renglones', () => {
  // La hoja: el mismo círculo de app/planes/signos.ts que dibuja la columna (CSS_TARJETAS), sin la letra «✓» de antes.
  assert.ok(CSS_TARJETAS.includes(`.mkpl-lista li::before { ${SIGNO_SI} }`), '¿cambió la ✓ de la columna? Entonces este test compara contra otra cosa');
  assert.ok(CSS_TARJETAS.includes(`.mkpl-lista.mkpl-lista-no li::before { ${SIGNO_NO} }`));
  assert.equal(regla(CSS_PLANES, '.ck-incluye li::before').trim(), SIGNO_SI, 'la ✓ del checkout no es la de la columna');
  assert.equal(regla(CSS_PLANES, '.ck-incluye.ck-no-incluye li::before').trim(), SIGNO_NO, 'la ✗ del checkout no es la de la columna');
  assert.doesNotMatch(CSS_PLANES, /content:\s*"[✓✕×✗✔]"/, 'quedó un signo escrito como letra');
  // Los renglones: los de la columna, con su negrita, y el «No incluye» con su ✗ sólo donde la columna lo tiene.
  for (const plan of [ESENCIAL, PRO]) {
    const h = checkout(plan, DESDE_ARGENTINA(plan), true);
    const l = listaCorta(plan.capa);
    const incluye = /<ul class="ck-incluye" aria-label="Qué incluye">([\s\S]*?)<\/ul>/.exec(h)?.[1] ?? '';
    assert.equal((incluye.match(/<li>/g) ?? []).length, listaDelCheckout(plan.capa).items.length);
    for (const x of l.items.filter((i) => i.fuerte)) assert.ok(incluye.includes(`<b>${x.fuerte}</b>${x.texto}`), `${plan.nombre}: «${x.fuerte}» sin su negrita`);
    const no = /<ul class="ck-incluye ck-no-incluye" aria-label="Qué no incluye">([\s\S]*?)<\/ul>/.exec(h)?.[1];
    if (l.noIncluye?.length) {
      assert.ok(no, `${plan.nombre}: la columna dice lo que no trae y el checkout no`);
      assert.deepEqual([...no.matchAll(/<li><span>([^<]*)<\/span><\/li>/g)].map((m) => m[1]), l.noIncluye.map((x) => x.texto));
    } else assert.equal(no, undefined, `${plan.nombre}: el checkout inventó un «No incluye»`);
  }
});

test('5. el pie en UN renglón, con los logos de Mercado Pago y Stripe en lugar de sus nombres, y sin chocar con la línea', () => {
  const h = checkout(ESENCIAL, DESDE_ARGENTINA(ESENCIAL), true);
  const pie = /<footer class="ck-pie">([\s\S]*?)<\/footer>/.exec(h)?.[1] ?? '';
  assert.match(pie, /<span class="ck-procesa"><span class="ck-procesa-largo">Pagos procesados por<\/span><span class="ck-procesa-corto">Pagos con<\/span>/);
  assert.match(pie, /<span class="ck-procesa-logo"><img class="ck-logo-mp" src="\/logos\/mercadopago\.png"[^>]*alt="Mercado Pago"/, 'el pie no lleva el logo de Mercado Pago');
  assert.match(pie, /<span class="ck-procesa-logo"><svg[^>]*role="img" aria-label="Stripe"/, 'el pie no lleva el logo de Stripe');
  assert.doesNotMatch(pie.replace(/<[^>]+>/g, ' '), /Mercado Pago y Stripe/, 'volvieron los nombres escritos');
  assert.match(pie, /<span class="ck-legales"><a href="\/terminos">Términos<\/a><a href="\/privacidad">Privacidad<\/a><a href="\/reembolsos">Reembolsos<\/a><\/span>/);
  // Un renglón: sin cortes en ningún ancho (la letra se achica en el teléfono angosto, y «Pagos con» en vez de la frase entera).
  const col = regla(CSS_PLANES, '.ck-pie .ck-col');
  assert.match(col, /flex-wrap:\s*nowrap/, 'el pie se puede partir en dos renglones');
  assert.match(col, /white-space:\s*nowrap/);
  assert.doesNotMatch(CSS_PLANES, /\.ck-pie \.ck-procesa \{ flex-basis: 100%/, 'quién procesa volvió a su propio renglón');
  assert.match(CSS_PLANES, /@media \(max-width: 420px\) \{[^@]*\.ck-pie \.ck-procesa-largo \{ display: none; \}[^@]*\.ck-pie \.ck-procesa-corto \{ display: inline; \}/);
  assert.match(regla(CSS_PLANES, '.ck-pie .ck-procesa-logo'), /flex:\s*none/, 'el logo se aplasta cuando falta lugar (medido: 0 × 0 a 320)');
});

test('6. el logo de Mercado Pago es el de VERDAD (el archivo de la captura de Martín), el mismo en todos lados, y el de simple-icons ya no está', () => {
  // El archivo: un PNG de 256 × 178 con transparencia (RGBA): se ve sobre blanco, negro y celeste.
  const png = readFileSync(join(RAIZ, 'public/logos/mercadopago.png'));
  assert.equal(png.subarray(1, 4).toString('latin1'), 'PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20), png[25]], [LOGO_MP.ancho, LOGO_MP.alto, 6], 'no es el PNG de 256 × 178 con transparencia');
  // El checkout (la fila y el pie): ese archivo, con su proporción.
  const fila = renderToStaticMarkup(createElement(LogoMercadoPago, { alto: 20 }));
  assert.match(fila, /src="\/logos\/mercadopago\.png" width="29" height="20" alt="" aria-hidden="true"/);
  // «Tus apps, conectadas» (ServicioVisual): el mismo archivo, entero en su cuadro blanco con filete.
  assert.equal(ICON.mercadopago.img, 'mercadopago.png');
  assert.equal(ICON.mercadopago.bg, '#FFFFFF');
  assert.ok(ICON.mercadopago.bd, 'el cuadro blanco sin filete se pierde sobre una tarjeta blanca');
  assert.match(leer('app/_components/ServicioVisual.tsx'), /objectFit: 'contain'/, 'el óvalo se estira a un cuadrado');
  // La tira de la portada y las landings (vsl-assets/logos/integraciones/mercadopago.svg): envuelve los MISMOS bytes.
  const tira = leer('public/vsl-assets/logos/integraciones/mercadopago.svg');
  assert.ok(tira.includes(`href="data:image/png;base64,${png.toString('base64')}"`), 'la tira no lleva el logo de verdad');
  // Y el apretón de manos de simple-icons (un trazo de un color, el que se veía mal) no queda en ningún lado.
  const oficial = /<path d="([^"]+)"/.exec(readFileSync(join(RAIZ, 'node_modules/simple-icons/icons/mercadopago.svg'), 'utf8'))?.[1];
  assert.ok(oficial, 'no encontré el trazo de simple-icons');
  for (const f of ['app/_components/ServicioVisual.tsx', 'app/planes/[plan]/MarcasDePago.tsx', 'public/vsl-assets/logos/integraciones/mercadopago.svg']) {
    assert.ok(!leer(f).includes(oficial.slice(0, 40)), `${f} todavía dibuja el logo de simple-icons`);
  }
  assert.doesNotMatch(leer('app/_components/ServicioVisual.tsx'), /id="ic-mercadopago"/);
  // La columna del ícono entra los dos logos (29 × 20 y 28 × 20), así el nombre de las dos filas empieza en el mismo lugar.
  assert.match(CSS_PLANES, /label\.ck-medio \{ display: grid; grid-template-columns: 18px 30px 1fr auto;/);
});

test('7. el mismo botón negro con las dos formas de pago (y «Tarjeta de crédito o débito» no se parte en cinco a 320 px)', () => {
  const f = leer('app/planes/[plan]/CompraPlan.tsx');
  assert.match(f, /<button className="planes-btn" type="submit" disabled=\{enviando \|\| !completo\}>/, 'el botón cambia de clase con la pasarela');
  assert.doesNotMatch(f, /ck-btn-mp|AZUL_MP|style=\{pasarela === 'mercadopago'/, 'con Mercado Pago el botón vuelve a su azul o a su logo');
  assert.doesNotMatch(CSS_PLANES, /ck-btn-mp/);
  // A 420 px o menos, las marcas de la tarjeta bajan debajo de su nombre (al lado lo partían en 5 renglones a 320: revisión, hallazgo 6).
  assert.match(CSS_PLANES, /@media \(max-width: 420px\) \{[^@]*\.ck-formulario label\.ck-medio \.ck-marcas \{ grid-column: 3; grid-row: 2; \}/);
});

test('8. la prueba ya usada: la compra sigue SIN ella, el botón dice lo que se cobra hoy (nunca «$ 0») y el resumen cambia con él', () => {
  // Como lo arma la página: el resumen con la prueba, su versión sin ella y el botón con lo de hoy SIN la prueba.
  const pasarelas = DESDE_ARGENTINA(ESENCIAL);
  const armado = { nombre: ESENCIAL.nombre, incluye: incluyeDeLaColumna(ESENCIAL.capa), capa: ESENCIAL.capa, precioUsd: ESENCIAL.precioUsd, pasarelas, conPromo: false, conPrimerMes: (m: number) => m, precio: '' };
  const con = resumenDelPlan({ ...armado, conPrueba: true }), sin = resumenDelPlan({ ...armado, conPrueba: false });
  const hoy = totalDeHoyPorPasarela(sin);
  assert.deepEqual(hoy, { mercadopago: '$ 75.000 ARS', stripe: 'US$ 47' }, 'lo de hoy salió del resumen con la prueba (0)');
  const pagina = leer('app/planes/[plan]/page.tsx');
  assert.match(pagina, /hoy=\{totalDeHoyPorPasarela\(resumenSin\)\}/, 'la página le pasa al botón lo de hoy CON la prueba');
  assert.match(pagina, /sinPrueba=\{conPrueba \? resumenSin : undefined\}/);
  // El botón, ya sin la prueba (lo que queda después de que la ruta dijo que se usó): lo que se cobra hoy, en la moneda elegida.
  const form = renderToStaticMarkup(createElement(CompraPlan, { plan: 'esencial', pasarelas, origen: null, refCodigo: null, sinPrueba: true, promo: false, ladaInicial: '+54', hoy }));
  assert.match(form, /Suscribirme por <span data-ck-moneda="mercadopago" data-ck-primera="">\$ 75\.000 ARS<\/span><span data-ck-moneda="stripe">US\$ 47<\/span> al mes/);
  assert.doesNotMatch(form, /Suscribirme por[^<]*\$ 0|US\$ 0/, 'el botón dice «Suscribirme por $ 0»');
  // El resumen trae las dos versiones de lo que cambia (la etiqueta, el precio grande y los totales) y la hoja muestra una.
  // Sin la hoja: sus reglas también nombran `data-ck-prueba`.
  const h = renderToStaticMarkup(createElement(Ficha, { resumen: con, sinPrueba: sin, pasarelas: pasarelas.map((x) => x.pasarela), children: 'formulario' })).replace(/<style[\s\S]*?<\/style>/g, '');
  assert.equal((h.match(/data-ck-prueba="con"/g) ?? []).length, (h.match(/data-ck-prueba="sin"/g) ?? []).length);
  assert.ok((h.match(/data-ck-prueba="sin"/g) ?? []).length >= 6, 'abierto y plegado: la etiqueta, el precio y los totales');
  assert.match(h, /<span data-ck-prueba="sin">Suscribirte a MaKo Essential<\/span>/);
  const css = CSS_PLANES.replace(/\s+/g, ' ');
  assert.ok(css.includes('.ck [data-ck-prueba="sin"], .ck:has(form[data-ck-sin-prueba]) [data-ck-prueba="con"] { display: none; }'));
  assert.ok(css.includes('.ck:has(form[data-ck-sin-prueba]) [data-ck-prueba="sin"] { display: contents; }'));
  // El formulario: con `sinPrueba` de la ruta pasa solo a la compra sin prueba, dice por qué y se marca; no hay un segundo botón.
  const f = leer('app/planes/[plan]/CompraPlan.tsx');
  assert.match(f, /if \(j\.sinPrueba && !sin\) \{ setSinPrueba\(true\); setPorQueSinPrueba\(j\.error \?\? null\); setEnviando\(false\); return; \}/);
  assert.match(f, /data-ck-sin-prueba=\{sinPrueba && !p\.sinPrueba \? '' : undefined\}/);
  assert.doesNotMatch(f, />Empezar sin prueba<\/button>/, 'volvió el segundo botón');
});

// ── Probado rompiéndolo (16/11/2026) ───────────────────────────────────────────────────────────────────────────────────
// Base (la primera tanda): 6 pasan / 0 fallan. Cada rotura, restaurada después (pasan / fallan):
//   · el resumen arma todas las monedas con la primera pasarela   -> 5 / 1 (el 1)
//   · las filas de pago sin su `value`                            -> 5 / 1 (el 1)
//   · el botón sin prueba vuelve a «Suscribirme» a secas          -> 4 / 2 (el 1 y el 3)
//   · la hoja sin la regla que muestra la elegida                 -> 5 / 1 (el 2)
//   · la ✓ del checkout vuelve a ser la letra                     -> 5 / 1 (el 4)
//   · el checkout sin el «No incluye» de la columna               -> 5 / 1 (el 4)
//   · el pie del checkout vuelve a un renglón sin cortes          -> 5 / 1 (el 5)
//   · el logo del checkout vuelve al azul oscuro #2D3277          -> 5 / 1 (el 6)
//   · el cuadro de Mercado Pago de «Tus apps» vuelve a su celeste -> 5 / 1 (el 6)
// La segunda tanda (16/11/2026; base 8 / 0):
//   · el pie vuelve a partirse (flex-wrap: wrap)                -> 7 / 1
//   · el pie vuelve a los nombres escritos                      -> 7 / 1
//   · el logo de la fila vuelve al trazo de simple-icons        -> 6 / 2
//   · el botón vuelve al azul de Mercado Pago                   -> 7 / 1
//   · el botón recibe lo de hoy CON la prueba («$ 0»)           -> 7 / 1
//   · el resumen sin su versión sin prueba                      -> 7 / 1
