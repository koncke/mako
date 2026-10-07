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

test('el árbol de Meta dice cuándo EMPEZÓ a leerse, y la tabla compara contra eso', () => {
  const health = sinComentarios(leer('lib/meta-health.ts'));
  // ANTES del primer pedido a Meta: `fetchedAtISO` se pone al final, y una lectura que
  // arrancó antes de la escritura y terminó después traería el monto viejo con una hora
  // posterior.
  const antes = bloque(health, 'async function _getMetaHealth', 'await fetchAccountRaw()');
  assert.match(antes, /const inicioLecturaISO = new Date\(\)\.toISOString\(\);/);
  assert.match(bloque(health, 'recosMetaDisponibles,\n    parcial,', '};'), /inicioLecturaISO,/);

  const src = sinComentarios(leer(BROWSER));
  const opt = bloque(src, 'const optimistasQueSiguen', 'useEffect(() => { cargar(); }');
  assert.match(opt, /Date\.parse\(h\.inicioLecturaISO \?\? ''\)/);
  assert.match(opt, /presupuestosVigentes\(escritos\.current, reales, Number\.isFinite\(leidaDesde\) \? leidaDesde : null\)/);
  assert.doesNotMatch(opt, /Date\.now\(\)|fetchedAtISO/, 'ni el reloj de la pestaña ni el FINAL de la lectura');
  //   ROTO A PROPÓSITO (07/10/2026), cada una por separado: la línea de
  //   `inicioLecturaISO` movida debajo de `fetchAccountRaw()` → pass 17 / fail 1; y
  //   `presupuestosVigentes(escritos.current, reales, Date.now())` en la tabla → pass 17
  //   / fail 1. Las dos caen acá.
});

test('writeBudget anota ANTES del POST, y si falla vuelve a lo que había', () => {
  const src = sinComentarios(leer(BROWSER));
  const wb = bloque(src, 'async function writeBudget', 'const avisarFallos');
  const anota = wb.indexOf('escritos.current.set(id, mio);');
  assert.ok(anota >= 0, 'falta anotar la escritura en vuelo');
  assert.ok(anota < wb.indexOf("fetch('/api/meta-write'"), 'se anota ANTES del POST, o un cargar() en el medio la pierde');
  assert.match(wb, /const mio: EscritoPresupuesto = \{ valor: monto, en: null \};/);
  // Al volver OK: la hora del servidor, y el optimista repuesto.
  assert.match(wb, /mio\.en = horaDeEscritura\(r\.headers\.get\('date'\), Date\.now\(\)\);/);
  assert.match(wb, /if \(escritos\.current\.get\(id\) === mio\) setOpt\(id, \{ budget: monto \}\);/);
  // Al fallar: lo de antes, no el árbol cargado.
  assert.match(wb, /if \(previo\) \{ escritos\.current\.set\(id, previo\); setOpt\(id, \{ budget: previo\.valor \}\); \}/);
  assert.match(wb, /if \(!j\.ok\) \{ volver\(\); return/);
  assert.match(wb, /catch \(e\) \{ volver\(\); return/);
  assert.doesNotMatch(wb.slice(wb.indexOf("fetch('/api/meta-write'")), /clearOpt\(id, 'budget'\)/, 'un fallo borraba el optimista sin mirar lo escrito antes');
  //   ROTO A PROPÓSITO (07/10/2026), cada una por separado y restaurando de memoria: el
  //   `escritos.current.set(id, mio)` movido después del `await fetch` → pass 17 / fail 1;
  //   el `if (!j.ok)` de vuelta a `clearOpt(id, 'budget')` → pass 17 / fail 1; y sin el
  //   `if (previo) {…}` de `volver` → pass 17 / fail 1. Las tres caen acá.
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
  // …y no recarga: la caché del árbol no se entera de la escritura y no traería nada nuevo.
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
  // La línea que DECIDE: la rama de fallo corta. Sin el `return`, «Presupuesto cambiado
  // en N» volvía a pisar el error, que es el bug que la #349 cerró.
  const corta = "{ avisarFallos(results, 'cambiar'); return; }";
  assert.match(aplicar, /if \(results\.some\(\(res\) => res\.status === 'rejected' \|\| !res\.value\.ok\)\) \{ avisarFallos\(results, 'cambiar'\); return; \}/);
  assert.ok(aplicar.indexOf(corta) < aplicar.indexOf('setToast('), 'el éxito va DESPUÉS del if que corta');
  //   ROTO A PROPÓSITO (07/10/2026): sacando el `return` de la rama de fallo → pass 17 /
  //   fail 1, éste. (La versión anterior de este test sólo buscaba que `avisarFallos(`
  //   existiera, y con esa rotura daba 13 / 0: lo midió la revisión de la #349.)
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
  assert.match(panel, /disabled=\{tipeadoACuenta\(monto, moneda\) == null\}/);
  // Lo que SE MANDA, no sólo el `disabled`: el regex suelto encontraba
  // `tipeadoACuenta(monto, moneda)` en el disabled y dejaba pasar un onClick que mandaba
  // el número crudo (50 en vez de 865 en el ws1).
  const click = bloque(panel, 'onClick={() =>', 'setModo(null)');
  assert.match(click, /const m = tipeadoACuenta\(monto, moneda\); if \(m == null\) return; onPresupuesto\(m\);/);
  assert.match(panel, /placeholder=\{`Diario, en \$\{esConvertible\(moneda\) \? 'USD' : moneda\}`\}/, 'el placeholder dice la unidad');
  //   ROTO A PROPÓSITO (07/10/2026), con los 18 tests de hoy: el `disabled` de vuelta a
  //   `!Number(monto.replace(',', '.'))` → pass 17 / fail 1; y `onPresupuesto(m)`
  //   cambiado por `onPresupuesto(Number(monto))` → pass 17 / fail 1 (con el test
  //   anterior daba 13 / 0). Los dos caen acá.
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

test('agregar conjunto no trata «no pude leer la moneda» como «cobra en dólares»', () => {
  const src = sinComentarios(leer('app/ads-manager/AgregarConjuntoModal.tsx'));
  assert.doesNotMatch(src, /cuenta\?\.currency \?\? 'USD'/, 'una lectura caída escribía el monto sin convertir');
  assert.match(src, /const moneda = cuenta\?\.currency \?\? monedaRespaldo \?\? null;/);
  // Sin moneda no se puede crear un conjunto con presupuesto propio…
  assert.match(src, /budgetUsd > 0 && moneda != null/);
  assert.match(src, /usdACuenta\(budgetUsd \?\? 0, moneda\)/);
  // …y el respaldo es la moneda del árbol que la tabla ya tiene, como en el wizard.
  const montaje = bloque(sinComentarios(leer(BROWSER)), '<AgregarConjuntoModal', '\n');
  assert.match(montaje, /monedaRespaldo=\{health\?\.account\.currency \?\? null\}/);
  //   ROTO A PROPÓSITO (07/10/2026): `const moneda = cuenta?.currency ?? 'USD'` (la
  //   regla vieja) → pass 17 / fail 1, éste.
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
