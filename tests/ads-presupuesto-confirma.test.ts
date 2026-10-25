// =============================================================================
// Cambiar un presupuesto pasa por un cartel, y el cartel dice números de verdad
// =============================================================================
// Tarea #349 (07/10/2026): «Agregar cartel de confirmación al modificar presupuesto».
// Hasta este día el ✓ (o el Enter) de la celda hacía el POST a /api/meta-write sin
// ningún paso intermedio, y la barra de lote escribía con un clic en «Aplicar a N».
//
// Y lo urgente, que la tarea no nombraba: desde db7b7682 cualquier workspace escribe
// presupuestos con SU cuenta, y la celda multiplicaba SIEMPRE por 17,30. En una cuenta
// que cobra en dólares, tipear 50 escribía 865 USD/día — y un cartel armado encima de
// esos números habría avalado el error.
//
// Dos mitades: (a) la regla de la moneda, ejecutada (lib/presupuesto-cambio.ts es puro);
// (b) el cableado de la pantalla, sobre el fuente (un client component no se monta en
// node:test). Los cortes van en el cierre REAL de cada bloque, nunca a N caracteres.
//
// Los «ROTO A PROPÓSITO» dicen con cuántos tests se midió: 13 el día del cartel, 18
// desde la revisión (mismo día), que encontró tres guards que seguían verdes con lo que
// fijaban roto y un optimista que se soltaba por reloj.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sinComentarios } from './_emoji';
import { TIPO_DE_CAMBIO_USD_MXN } from '../lib/config';
import {
  usdACuenta, cuentaAUsd, esConvertible, inicialTipeado, tipeadoACuenta, saltoPresupuesto,
  editaPresupuestoAca, presupuestosVigentes, horaDeEscritura, GRANO_HORA_SERVIDOR_MS, SALTO_AVISO,
  type EscritoPresupuesto,
} from '../lib/presupuesto-cambio';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');

/** El fuente entre dos marcas, las dos obligatorias: un corte que no encuentra su cierre mira otra cosa. */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}

// ── (a) la moneda ───────────────────────────────────────────────────────────

test('ws1 (MXN): el número que viaja a Meta es IDÉNTICO al de antes', () => {
  // La celda mandaba `Math.round(usd * TIPO_DE_CAMBIO_USD_MXN)`. Para cada monto que se
  // puede tipear en un uso razonable, el camino nuevo tiene que dar lo mismo.
  for (let usd = 1; usd <= 5000; usd++) {
    assert.equal(tipeadoACuenta(String(usd), 'MXN'), Math.round(usd * TIPO_DE_CAMBIO_USD_MXN), `${usd} USD`);
  }
  assert.equal(usdACuenta(29, 'MXN'), 502);
  assert.equal(usdACuenta(50, 'MXN'), 865);
});

test('una cuenta en USD no multiplica, y una moneda sin tasa va cruda', () => {
  assert.equal(usdACuenta(50, 'USD'), 50, 'tipear 50 en una cuenta en dólares escribía 865');
  assert.equal(tipeadoACuenta('50', 'USD'), 50);
  assert.equal(cuentaAUsd(50, 'USD'), 50);
  // Sin tasa no se inventa una: el monto va en esa moneda y la pantalla lo dice.
  assert.equal(esConvertible('ARS'), false);
  assert.equal(usdACuenta(15000, 'ARS'), 15000);
  assert.equal(cuentaAUsd(15000, 'ARS'), null, 'sin tasa no hay dólares que mostrar');
  // `in` daba true para los métodos del prototipo.
  assert.equal(esConvertible('toString'), false);
  //   ROTO A PROPÓSITO (07/10/2026): `usdACuenta` de vuelta a `Math.round(usd *
  //   TIPO_DE_CAMBIO_USD_MXN)` → pass 12 / fail 1, y cae ESTE (el de ws1 sigue verde,
  //   que es justo por qué el bug no se veía en la cuenta del ws1).
});

test('lo que el editor muestra y la regla de «no cambió»', () => {
  // 500 MXN se muestra como 29 y 29 vuelve como 502: comparar en la moneda de la cuenta
  // abriría el cartel «500 → 502» al guardar sin tocar. Se compara lo TIPEADO.
  assert.equal(inicialTipeado(500, 'MXN'), '29');
  assert.equal(tipeadoACuenta('29', 'MXN'), 502);
  assert.equal(inicialTipeado(50, 'USD'), '50');
  assert.equal(inicialTipeado(15000, 'ARS'), '15000');
  assert.equal(inicialTipeado(null, 'MXN'), '');
  // Sólo dígitos: el lote leía «1.500» como 1,5.
  assert.equal(tipeadoACuenta('1.500', 'MXN'), null);
  assert.equal(tipeadoACuenta('1,500', 'MXN'), null);
  assert.equal(tipeadoACuenta('0', 'MXN'), null);
  assert.equal(tipeadoACuenta('', 'MXN'), null);
});

test('el salto ×5 se marca en las dos direcciones', () => {
  assert.equal(SALTO_AVISO, 5);
  assert.deepEqual(saltoPresupuesto(2500, 500), { veces: 5, sube: true });
  assert.equal(saltoPresupuesto(2499, 500), null);
  assert.deepEqual(saltoPresupuesto(100, 500), { veces: 5, sube: false }, 'un cero de menos frena la campaña');
  assert.equal(saltoPresupuesto(101, 500), null);
  assert.equal(saltoPresupuesto(5000, null), null, 'sin actual no hay contra qué comparar');
  assert.equal(saltoPresupuesto(5000, 0), null);
});

test('el presupuesto TOTAL no se edita como diario', () => {
  // budgetLevel se pone también con lifetime_budget (lib/meta-health.ts): con eso solo,
  // la celda escribía un daily_budget sobre una entidad que no lo tiene.
  assert.equal(editaPresupuestoAca({ budgetLevel: 'campaign', dailyBudgetMxn: 500 }, 'campaign'), true);
  assert.equal(editaPresupuestoAca({ budgetLevel: 'adset', dailyBudgetMxn: 200 }, 'adset'), true);
  assert.equal(editaPresupuestoAca({ budgetLevel: 'campaign', dailyBudgetMxn: null }, 'campaign'), false, 'presupuesto total');
  assert.equal(editaPresupuestoAca({ budgetLevel: null, dailyBudgetMxn: null }, 'adset'), false, 'CBO: el conjunto no tiene propio');
  assert.equal(editaPresupuestoAca({ budgetLevel: 'campaign', dailyBudgetMxn: 500 }, 'adset'), false);
  assert.equal(editaPresupuestoAca({ budgetLevel: 'campaign', dailyBudgetMxn: 500 }, 'ad'), false);
  //   ROTO A PROPÓSITO (07/10/2026): sacando `&& node.dailyBudgetMxn != null` → pass 12 /
  //   fail 1, éste.
});

// ⚠️ Hasta la revisión de la #349 (07/10/2026) acá había un test que fijaba
// `VENTANA_CACHE_HEALTH_MS === revalidate de getMetaHealth`, o sea la propiedad
// equivocada: `unstable_cache` es stale-while-revalidate y SIRVE la entrada vencida, así
// que ningún reloj del lado de la pestaña dice si una lectura ya ve la escritura. Lo que
// lo dice es cuándo EMPEZÓ la lectura en el servidor. El caso que se escapaba es el
// primero de abajo.
test('una lectura de ANTES de la escritura no suelta lo escrito, la sirva la caché cuando la sirva', () => {
  const t0 = Date.parse('2026-10-07T21:00:00Z');
  const escritos = new Map<string, EscritoPresupuesto>([['a', { valor: 1000, en: t0 + 10_000 }]]);
  // La caché guardó el árbol en t0 (A = 500), se escribió a los 10 s, nadie miró, y a
  // los 3 minutos una pausa recarga: la entrada vencida vuelve TAL CUAL, con su t0.
  const vencida = presupuestosVigentes(escritos, new Map([['a', 500]]), t0);
  assert.deepEqual([...vencida.mantener], [['a', 1000]], 'la fila volvía a 500 con Meta en 1000');
  assert.deepEqual(vencida.soltar, []);
  // Sin saber cuándo empezó la lectura (una entrada escrita antes de que existiera el
  // campo) tampoco se suelta: mostrar lo que Meta ACEPTÓ es el error barato.
  assert.deepEqual([...presupuestosVigentes(escritos, new Map([['a', 500]]), null).mantener], [['a', 1000]]);
  //   ROTO A PROPÓSITO (07/10/2026): devolviendo la regla vieja —soltar si
  //   `Date.now() - e.en > 120_000`— → pass 16 / fail 2, éste y el siguiente.
});

test('la primera lectura de DESPUÉS manda, traiga lo que traiga', () => {
  const en = Date.parse('2026-10-07T21:00:10Z');
  const escritos = new Map<string, EscritoPresupuesto>([['a', { valor: 1000, en }], ['b', { valor: 300, en }]]);
  const despues = en + GRANO_HORA_SERVIDOR_MS;
  // a: Meta dice otra cosa (lo cambiaron en Meta, o no se aplicó) → manda Meta.
  // b: ya no está en el árbol → se suelta.
  const r = presupuestosVigentes(escritos, new Map([['a', 700]]), despues);
  assert.equal(r.mantener.size, 0);
  assert.deepEqual(r.soltar.sort(), ['a', 'b']);
  // El header Date trunca a segundos: una lectura que arrancó 500 ms «después» puede
  // haber arrancado ANTES de la escritura real.
  assert.deepEqual([...presupuestosVigentes(escritos, new Map([['a', 500], ['b', 300]]), en + 500).mantener].map(([id]) => id), ['a'],
    'b llegó (mismo monto) y se suelta; a no, todavía');
  // Y si la lectura de antes ya trae el monto escrito, llegó.
  assert.equal(presupuestosVigentes(escritos, new Map([['a', 1000], ['b', 300]]), en - 60_000).soltar.length, 2);
  //   ROTO A PROPÓSITO (07/10/2026): sin el `+ GRANO_HORA_SERVIDOR_MS` en la
  //   comparación → pass 17 / fail 1, éste.
});

test('una escritura en vuelo no se suelta con nada', () => {
  // En vuelo = anotada antes del POST y sin hora todavía. Un cargar() que resuelve en el
  // medio no puede llevársela: así se perdía el optimista y no volvía.
  const escritos = new Map<string, EscritoPresupuesto>([['a', { valor: 1000, en: null }]]);
  const r = presupuestosVigentes(escritos, new Map([['a', 500]]), Date.parse('2030-01-01T00:00:00Z'));
  assert.deepEqual([...r.mantener], [['a', 1000]]);
  //   ROTO A PROPÓSITO (07/10/2026): sacando la línea del `e.en == null` → pass 17 /
  //   fail 1, éste (una lectura muy posterior lo soltaba).
});

test('la hora de la escritura sale del header Date, no del reloj de la pestaña', () => {
  assert.equal(horaDeEscritura('Wed, 07 Oct 2026 21:00:10 GMT', 1), Date.parse('2026-10-07T21:00:10Z'));
  assert.equal(horaDeEscritura(null, 42), 42);
  assert.equal(horaDeEscritura('no es una fecha', 42), 42);
});

test('una tecla mantenida no confirma el cartel', () => {
  const src = sinComentarios(leer('app/_ui/Confirm.tsx'));
  const onKey = bloque(src, 'const onKey = (e: KeyboardEvent) => {', 'document.addEventListener');
  const repeat = onKey.indexOf('e.repeat');
  assert.ok(repeat >= 0, 'falta la guarda de e.repeat');
  assert.ok(repeat < onKey.indexOf('onConfirm()'), 'la guarda va ANTES de confirmar');
  // Con el `return`: sin él, el Enter repetido sigue de largo hasta `onConfirm()`.
  assert.match(onKey, /if \(e\.repeat && e\.key === 'Enter'\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); return; \}/);
  //   ROTO A PROPÓSITO (07/10/2026): sacando la línea del `e.repeat` → pass 12 / fail 1
  //   (con los 13 tests de entonces); y dejándola sin el `return` → pass 17 / fail 1 con
  //   los 18 de hoy (con el regex anterior daba 13 / 0). Las dos caen acá.
});
