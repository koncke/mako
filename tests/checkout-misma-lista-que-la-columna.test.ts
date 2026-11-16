// =============================================================================
// El checkout dice LO MISMO que la columna (14/11/2026)
// =============================================================================
// Martín, textual: «no es la idea de que diga todo lo de Essential más tal, todo lo de MaKo Pro más… la idea es que cada uno se
// sienta único». El 14/11 se sacó la fórmula «todo lo de X» de las columnas de /planes (`listaCorta`, app/planes/Tarjetas.tsx),
// y quedaron DOS puertas más con la lista vieja del mismo plan:
//   · el checkout mensual, con su propia lista (`INCLUYE_EN_EL_CHECKOUT`, lib/planes-mako.ts);
//   · el checkout ANUAL, que leía `PLANES_MAKO_DEFAULT[].incluye` — donde Pro todavía dice «Todo lo de Essential, sin tope de
//     leads, landings ni automatizaciones». El visitante leía la columna nueva, tocaba «Anual / 2 meses gratis» y le aparecía
//     otra verdad del mismo plan, con la frase que Martín mandó sacar.
// El relevo del 14/11 (docs/relevo/planes-que-incluye-cada-columna.md §1.4) dio `incluye` por muerto («no lo lee nadie»): era
// falso, el anual lo dibujaba. Por eso esto se fija sobre la PANTALLA (se renderiza el checkout de verdad) y no sobre la
// constante: un test sobre `incluye` daba verde con la pantalla mintiendo.
//
// Desde ahora el checkout no tiene lista propia: aplana la de la columna (`incluyeDeLaColumna`, app/planes/[plan]/Checkout.tsx).
// Cambiar un renglón en `listaCorta` cambia las dos pantallas, y acá se fija que no se puedan volver a separar.
//
// Probado rompiéndolo (14/11/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MESES_GRATIS_ANUAL, PLANES_MAKO_DEFAULT, PRUEBA_DIAS, planConPrueba } from '../lib/planes-mako';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/** La fórmula que Martín mandó sacar, en cualquiera de sus formas. */
const TODO_LO_DE = /todo lo de/i;

const sinMarcas = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/**
 * El checkout de un plan, dibujado de verdad, con LOS MISMOS armadores que usa app/planes/[plan]/page.tsx (`resumenDelPlan` el
 * mensual, `resumenDelAnual` el anual). Si el resumen se armara acá a mano, este test diría verde con la pantalla mintiendo:
 * es exactamente lo que pasó hasta hoy, cuando el anual se armaba a mano adentro de la página.
 */
async function checkout(capa: string, nombre: string, precioUsd: number, precioAnualUsd: number, periodo: 'mes' | 'anual'): Promise<string> {
  const React = await import('react');
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { Ficha, incluyeDeLaColumna, resumenDelAnual, resumenDelPlan } = await import('../app/planes/[plan]/Checkout');
  const resumen = periodo === 'anual'
    ? resumenDelAnual({ nombre, capa, precioAnualUsd })
    : resumenDelPlan({
      nombre, incluye: incluyeDeLaColumna(capa), precioUsd, pasarelas: [{ pasarela: 'stripe' as const, moneda: 'USD', monto: precioUsd }],
      conPromo: false, conPrueba: true, conPrimerMes: (m: number) => m, precio: `US$ ${precioUsd} por mes`,
    });
  return sinMarcas(renderToStaticMarkup(React.createElement(Ficha, { resumen, pasarelas: ['stripe'], children: 'formulario' })));
}

/** Los dos planes que se venden, con su capa: el checkout habla por CAPA, igual que la columna. */
const VENDIDOS = PLANES_MAKO_DEFAULT.filter((p) => p.activo && p.precioAnualUsd);

test('ninguna puerta del checkout dice «todo lo de X»: ni el mensual ni el anual, en los dos planes', async () => {
  for (const p of VENDIDOS) {
    for (const periodo of ['mes', 'anual'] as const) {
      const html = await checkout(p.capa, p.nombre, p.precioUsd, p.precioAnualUsd!, periodo);
      assert.doesNotMatch(html, TODO_LO_DE, `el checkout ${periodo} de ${p.nombre} vuelve a la fórmula que Martín mandó sacar`);
    }
  }
  // Y de dónde venía: la constante sigue diciéndolo (lib/planes-mako.ts es compartida y no se toca acá), así que lo único que
  // protege a la pantalla es que el checkout ya NO la lea. Si alguien vuelve a enchufarla, este test cae.
  const pagina = fuente('app/planes/[plan]/page.tsx');
  assert.doesNotMatch(pagina, /incluye: plan\.incluye/, 'el checkout volvió a leer `PLANES_MAKO_DEFAULT[].incluye`');
  assert.doesNotMatch(pagina, /INCLUYE_EN_EL_CHECKOUT/, 'el checkout volvió a tener su propia lista');
  // La página no vuelve a armar un resumen a mano: los dos salen de app/planes/[plan]/Checkout.tsx, que es lo que se dibuja acá.
  assert.match(pagina, /<Ficha resumen=\{resumenDelAnual\(\{ nombre: plan\.nombre, capa: plan\.capa, precioAnualUsd: plan\.precioAnualUsd \}\)\}>/, 'el anual volvió a armarse a mano en la página');
});

test('el checkout muestra LA MISMA lista que la columna, renglón por renglón (una sola fuente: `listaCorta`)', async () => {
  const { listaCorta } = await import('../app/planes/Tarjetas');
  const { incluyeDeLaColumna } = await import('../app/planes/[plan]/Checkout');
  for (const capa of ['completo', 'agencia'] as const) {
    const l = listaCorta(capa);
    // El orden de la columna: los MaKo Tokens y después las funciones. Nada escrito a mano en el medio.
    // ⚠️ 15/11/2026: ya no hay una fila de TOPES aparte. Martín pidió que los topes fueran checks («todo lo que está abajo
    //    debería ir como checks. No debería ir ahí arriba»), así que vienen dentro de `l.items` y el checkout los toma solo.
    //    Lo que este test fija no cambió: que haya UNA fuente, y que las dos pantallas digan renglón por renglón lo mismo.
    assert.deepEqual(
      [...incluyeDeLaColumna(capa)],
      [...(l.tokens ? [l.tokens] : []), ...l.items.map((x) => `${x.fuerte ?? ''}${x.texto}`)],
      `${capa}: el checkout y la columna se separaron`,
    );
  }
  // Y en la PANTALLA, no sólo en el arreglo: cada renglón de la columna se lee en el checkout mensual y en el anual.
  for (const p of VENDIDOS) {
    for (const periodo of ['mes', 'anual'] as const) {
      const html = await checkout(p.capa, p.nombre, p.precioUsd, p.precioAnualUsd!, periodo);
      for (const r of incluyeDeLaColumna(p.capa)) {
        assert.ok(html.includes(sinMarcas(r).trim()), `${p.nombre} ${periodo}: falta «${r}»`);
      }
    }
  }
});

test('el que paga sigue pasando: Pro se lleva en el checkout todo lo que la columna le promete, y Essential no lo promete', async () => {
  const { listaCorta } = await import('../app/planes/Tarjetas');
  const pro = PLANES_MAKO_DEFAULT.find((p) => p.id === 'pro')!;
  const esencial = PLANES_MAKO_DEFAULT.find((p) => p.id === 'esencial')!;
  // Lo que se cerró en Essential el 14/11 (`FUNCIONES_SOLO_PRO`): copiar la landing del competidor, la edición con IA y el chat
  // con los referentes. Cerrarlo adentro y no decirlo en el checkout del que SÍ lo paga es la otra forma de romperlo.
  // 15/11/2026, a la noche: el copy aprobado por Martín dice «página de venta» y no «landing», y «Edición automática» y no
  // «Edición con IA» (palabras de cliente). Lo que se vigila es lo mismo: que lo de Pro esté en el checkout de Pro.
  // 15/11/2026, más tarde: con las palabras cortas de la tabla («Compara los planes»), que pidió Martín para las columnas.
  const DE_PRO = [/Copiar landings de la competencia/, /Edición de videos con IA/, /Setter con IA/];
  for (const periodo of ['mes', 'anual'] as const) {
    const htmlPro = await checkout(pro.capa, pro.nombre, pro.precioUsd, pro.precioAnualUsd!, periodo);
    for (const re of DE_PRO) assert.match(htmlPro, re, `el checkout ${periodo} de Pro no promete lo que Pro paga (${re})`);
    const htmlEs = await checkout(esencial.capa, esencial.nombre, esencial.precioUsd, esencial.precioAnualUsd!, periodo);
    for (const re of DE_PRO) assert.doesNotMatch(htmlEs, re, `el checkout ${periodo} de Essential promete algo que no trae (${re})`);
  }
  // Los topes que la columna dice son los que el checkout dice: el que paga el de 97 ve su «sin tope», que es por lo que paga
  // el doble. ⚠️ 15/11/2026: los topes son CHECKS, no una fila aparte (Martín), así que se buscan en `items`.
  const itemsPro = listaCorta('agencia').items.map((x) => `${x.fuerte ?? ''}${x.texto}`);
  const sinTope = itemsPro.filter((t) => /ilimitad/i.test(t));
  assert.ok(sinTope.length > 0, 'la columna de Pro dejó de decir lo que tiene ilimitado');
  assert.ok(!itemsPro.some((t) => /sin tope/i.test(t)), 'la columna de Pro volvió a decir «sin tope»: es «ilimitado» (Martín, 15/11/2026)');
  const htmlPro = await checkout(pro.capa, pro.nombre, pro.precioUsd, pro.precioAnualUsd!, 'mes');
  for (const t of sinTope) assert.ok(htmlPro.includes(sinMarcas(t).trim()), `el checkout de Pro se comió sus topes: «${t}»`);
  // La prueba de 7 días (`planConPrueba`: los dos planes desde el 14/11) no la tocó esta vuelta: sigue en el checkout mensual.
  for (const p of VENDIDOS) {
    if (!planConPrueba(p.id)) continue;
    assert.match(await checkout(p.capa, p.nombre, p.precioUsd, p.precioAnualUsd!, 'mes'), new RegExp(`${PRUEBA_DIAS} días gratis`), `${p.nombre} perdió la prueba`);
  }
  // Y el ANUAL sigue siendo el anual: su precio por año y los 2 meses gratis, que es lo que se vino a comprar.
  const anualPro = await checkout(pro.capa, pro.nombre, pro.precioUsd, pro.precioAnualUsd!, 'anual');
  assert.match(anualPro, new RegExp(`US\\$ ${pro.precioAnualUsd!.toLocaleString('es-AR')}`), 'el anual perdió su precio');
  assert.match(anualPro, new RegExp(`${MESES_GRATIS_ANUAL} meses gratis`), 'el anual perdió los 2 meses gratis');
});

test('el Accelerator no pasa por acá: sigue con su lista y se pide por la llamada', () => {
  const pagina = fuente('app/planes/[plan]/page.tsx');
  // Es un `ProgramaMako`, no un plan con capa: `listaCorta` no sabe dibujarlo, y su checkout sigue leyendo `PROGRAMA_ACELERADOR`.
  assert.match(pagina, /incluye: pr\.incluye/, 'el Accelerator perdió su propia lista');
  assert.ok(pagina.indexOf('PROGRAMA_ACELERADOR.id') < pagina.indexOf('ofertaDelPlan('), 'el programa dejó de salir antes de la pasarela');
});

// ── Probado rompiéndolo (14/11/2026) ────────────────────────────────────────────────────────────────────────────────
// Base: 4 pasan / 0 fallan. Cada rotura, restaurada después (pasan / fallan):
//   · el anual vuelve a la lista vieja («Todo lo de Essential, sin tope de…»)                -> 1 / 3
//   · el mensual vuelve a `INCLUYE_EN_EL_CHECKOUT[plan.id] ?? plan.incluye`                 -> 3 / 1
//   · `incluyeDeLaColumna` se saltea los topes (sólo los checks)                            -> 2 / 2
//   · `incluyeDeLaColumna` escribe un renglón a mano en vez de leer `listaCorta`            -> 3 / 1
//   · el checkout del Accelerator pasa a `LISTA_PROGRAMA`                                    -> 3 / 1
//   · la página vuelve a armar el resumen del anual a mano                                  -> 3 / 1
