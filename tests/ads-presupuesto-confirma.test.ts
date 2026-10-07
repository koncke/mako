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
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sinComentarios } from './_emoji';
import { TIPO_DE_CAMBIO_USD_MXN } from '../lib/config';
import {
  usdACuenta, cuentaAUsd, esConvertible, inicialTipeado, tipeadoACuenta, saltoPresupuesto,
  editaPresupuestoAca, presupuestosVigentes, VENTANA_CACHE_HEALTH_MS, SALTO_AVISO,
} from '../lib/presupuesto-cambio';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const BROWSER = 'app/ads-manager/CampanasBrowser.tsx';
const BARRA = 'app/ads-manager/BarraAcciones.tsx';

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

test('un presupuesto recién escrito sobrevive a una recarga cacheada', () => {
  const t0 = 1_000_000;
  const escritos = new Map([['a', { valor: 865, en: t0 }], ['b', { valor: 300, en: t0 }], ['c', { valor: 50, en: t0 }]]);
  // a: Meta (cacheado) todavía dice el viejo → se mantiene el escrito.
  // b: Meta ya devuelve el nuevo → se suelta.  c: ya no está en el árbol → se suelta.
  const r = presupuestosVigentes(escritos, new Map([['a', 500], ['b', 300]]), t0 + 30_000);
  assert.deepEqual([...r.mantener], [['a', 865]]);
  assert.deepEqual(r.soltar.sort(), ['b', 'c']);
  // Pasada la ventana de la caché, manda lo que diga Meta.
  const tarde = presupuestosVigentes(escritos, new Map([['a', 500]]), t0 + VENTANA_CACHE_HEALTH_MS + 1);
  assert.equal(tarde.mantener.size, 0);
});

test('la ventana es la de la caché de /api/meta-health', () => {
  const m = leer('lib/meta-health.ts').match(/export const getMetaHealth = cachedRead\([^)]*revalidate:\s*(\d+)/);
  assert.ok(m, 'no encontré el revalidate de getMetaHealth');
  assert.equal(Number(m![1]) * 1000, VENTANA_CACHE_HEALTH_MS, 'si la caché cambia, la ventana también');
});

// ── (b) la pantalla: nada escribe sin el «sí» ─────────────────────────────

test('la celda y el lote ARMAN el cartel; sólo su «sí» llama a writeBudget', () => {
  const src = sinComentarios(leer(BROWSER));
  const celda = bloque(src, 'onSaveBudget={', 'onStartName=');
  assert.doesNotMatch(celda, /writeBudget/, 'el ✓ de la celda volvió a escribir directo');
  assert.match(celda, /pedirPresupuesto\(/);

  const pedir = bloque(src, 'const pedirPresupuesto', 'const bulkPresupuesto');
  assert.doesNotMatch(pedir, /writeBudget/);
  assert.match(pedir, /setPideBudget\(/);

  const lote = bloque(src, 'const bulkPresupuesto', 'const aplicarPresupuesto');
  assert.doesNotMatch(lote, /writeBudget/, '«Aplicar a N» volvió a escribir sin preguntar');
  assert.match(lote, /setPideBudget\(/);

  // Todos los llamados a writeBudget viven en aplicarPresupuesto…
  const aplicar = bloque(src, 'const aplicarPresupuesto', '\n  const ');
  const total = (src.match(/writeBudget\(/g) ?? []).length - 1; // menos la declaración
  assert.ok(total >= 1);
  assert.equal((aplicar.match(/writeBudget\(/g) ?? []).length, total, 'hay un writeBudget fuera de aplicarPresupuesto');
  // …y no recarga: con la caché de 120 s, la fila volvería al monto viejo.
  assert.doesNotMatch(aplicar, /cargar\(/);
  // …y a aplicarPresupuesto lo llama UNA vez, el onConfirm del cartel.
  const cartel = bloque(src, '{pideBudget && (', '{pideLote && (');
  assert.equal((src.match(/aplicarPresupuesto\(/g) ?? []).length, 1);
  assert.match(cartel, /onConfirm=\{[\s\S]*aplicarPresupuesto\(p\)/);
  assert.match(cartel, /cancelLabel="No cambiar"/);
  // Enter tiene dos caminos al mismo onConfirm: el segundo no escribe de nuevo.
  assert.match(cartel, /if \(aplicandoBudget\.current === p\) return;/);
  //   ROTO A PROPÓSITO (07/10/2026), cada una por separado y restaurando de memoria:
  //   el `onSaveBudget` de vuelta a `writeBudget(...)` → pass 12 / fail 1; un
  //   `void writeBudget(...)` adentro de bulkPresupuesto → pass 12 / fail 1; y un
  //   `cargar(true)` en aplicarPresupuesto → pass 12 / fail 1. Las tres caen acá.
});

test('writeBudget dice si salió, y el éxito se afirma sólo con todas', () => {
  const src = sinComentarios(leer(BROWSER));
  assert.match(src, /async function writeBudget\([^)]*\): Promise<\{ ok: boolean; msg\?: string \}>/);
  const aplicar = bloque(src, 'const aplicarPresupuesto', '\n  const ');
  assert.match(aplicar, /Promise\.allSettled/);
  assert.match(aplicar, /avisarFallos\(results/);
});

test('la celda convierte con la moneda de la cuenta, no con el 17,30 fijo', () => {
  const src = sinComentarios(leer(BROWSER));
  const editor = bloque(src, 'function BudgetEditor', 'function NameEditor');
  assert.doesNotMatch(editor, /TIPO_DE_CAMBIO_USD_MXN|17\.3/);
  assert.match(editor, /tipeadoACuenta\(v, currency\)/);
  assert.match(editor, /if \(v === inicial\) \{ onCancel\(\); return; \}/, 'sin cambio no hay cartel');
  // El cartel se monta en el mismo keydown y enfoca su botón: sin el preventDefault, el
  // keypress del Enter lo activaba.
  assert.match(editor, /if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\);/);
  assert.doesNotMatch(src, /mxnAUsd/, 'lo que se MUESTRA también asumía pesos');

  const celda = bloque(src, 'function BudgetCell', 'function BudgetEditor');
  assert.match(celda, /editaPresupuestoAca\(r\.node, r\.level\)/, 'sin diario no hay lápiz');
  assert.match(bloque(src, 'const bulkPresupuesto', 'const aplicarPresupuesto'), /editaPresupuestoAca\(r\.node, r\.level\)/, 'la celda y el lote con la MISMA regla');
  //   ROTO A PROPÓSITO (07/10/2026): borrando `if (v === inicial) { onCancel(); return; }`
  //   → pass 12 / fail 1; y el Enter de vuelta a `if (e.key === 'Enter') save();` (sin
  //   el preventDefault) → pass 12 / fail 1. Los dos caen acá.
});

test('la barra de lote tipea en la misma unidad que la celda', () => {
  const src = sinComentarios(leer(BARRA));
  const panel = bloque(src, "{modo === 'presupuesto' && onPresupuesto && (", "{modo === 'producto'");
  assert.doesNotMatch(panel, /replace\(',', '\.'\)/, '«1.500» volvía a leerse como 1,5');
  assert.match(panel, /tipeadoACuenta\(monto, moneda\)/);
  assert.match(panel, /placeholder=\{`Diario, en \$\{esConvertible\(moneda\) \? 'USD' : moneda\}`\}/, 'el placeholder dice la unidad');
  //   ROTO A PROPÓSITO (07/10/2026): el `disabled` de vuelta a
  //   `!Number(monto.replace(',', '.'))` → pass 12 / fail 1, éste.
});

test('una tecla mantenida no confirma el cartel', () => {
  const src = sinComentarios(leer('app/_ui/Confirm.tsx'));
  const onKey = bloque(src, 'const onKey = (e: KeyboardEvent) => {', 'document.addEventListener');
  const repeat = onKey.indexOf('e.repeat');
  assert.ok(repeat >= 0, 'falta la guarda de e.repeat');
  assert.ok(repeat < onKey.indexOf('onConfirm()'), 'la guarda va ANTES de confirmar');
  assert.match(onKey, /if \(e\.repeat && e\.key === 'Enter'\) \{ e\.preventDefault\(\);/);
  //   ROTO A PROPÓSITO (07/10/2026): sacando la línea del `e.repeat` → pass 12 / fail 1,
  //   éste.
});

test('la tabla de tasas y el aviso ×5 viven en UN lugar', () => {
  for (const f of ['app/ads-manager/NuevaCampanaModal.tsx', 'app/ads-manager/AgregarConjuntoModal.tsx']) {
    const codigo = sinComentarios(leer(f));
    assert.doesNotMatch(codigo, /const (usdACuenta|TASAS_DESDE_USD|USD_MXN)\b/, `${f} volvió a copiar la tabla de tasas`);
    assert.match(codigo, /from '@\/lib\/presupuesto-cambio'/);
  }
  const run = sinComentarios(leer('lib/api-mako/areas/ads.run.ts'));
  assert.doesNotMatch(run, /dailyBudgetMxn \* 5/, 'el ×5 volvió a escribirse a mano');
  assert.equal((run.match(/saltoPresupuesto\(monto, n\.dailyBudgetMxn\)/g) ?? []).length, 2);
});
