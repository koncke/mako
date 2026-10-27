// =============================================================================
// Media Buyer — lo que la verificación de tren-m dejó anotado (26/10/2026), arreglado en la nube el 27/10/2026
// =============================================================================
// El detalle de cada falla está en las notas del Cerebro (`verificacion-tren-m.md`, bloque [mb]) y en docs/hallazgos-ads.md →
// «La verificación de tren-m: lo que quedaba». Cada test dice cuál fija; probado rompiendo el código (los números, abajo).
// Correr: node --import tsx --test tests/media-buyer-verificacion-m.test.ts
//
// Roturas (base 9/0, cada una restaurada antes de la siguiente):
//   · 1: el 1% de tolerancia a «cualquier diferencia» → 8/1; volver a «el mismo porcentaje sobre el de hoy» en ejecutar.ts → 8/1.
//   · 2: mezclarTacticas táctica por táctica (`{ ...guardadas, ...recibidas }`) → 8/1; el panel con la táctica a mano → 8/1.
//   · 9: sacar el `if (x.lugares <= 0)` de agentes-ia.ts → 8/1; lugaresParaPropios sin restar lo del motor → 8/1.
//   · baja: revisarMontoEditado sin `bajaConfirmada` (frena siempre) → 8/1; la hoja del teléfono con `if (r)` → 8/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { presupuestoCambioDesdeLaPropuesta } from '../lib/media-buyer/topes';
import { mezclarTacticas, validarTacticas } from '../lib/media-buyer/tacticas';
import { cambioDeAgente, cambiarAgente } from '../lib/media-buyer/agentes';
import { lugaresParaPropios } from '../lib/media-buyer/plan';
import { revisarMontoEditado } from '../lib/media-buyer/monto';
import { resultadoAplicar } from '../app/ads-manager/mb-modelo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const fmt = (n: number) => `$${n}`;

// ── 1: un cambio de presupuesto que no es decisión del Media Buyer no compone con su porcentaje ─────────────────────────────

test('1 · el presupuesto de hoy distinto del de la propuesta (más de 1%) la deja vieja', () => {
  assert.equal(presupuestoCambioDesdeLaPropuesta(30, 30), false);
  assert.equal(presupuestoCambioDesdeLaPropuesta(30, 30.2), false, 'el redondeo de Meta no es un cambio');
  assert.equal(presupuestoCambioDesdeLaPropuesta(30, 45), true, 'alguien lo subió a mano (por el chat, la tabla o en Meta)');
  assert.equal(presupuestoCambioDesdeLaPropuesta(30, 20), true);
  assert.equal(presupuestoCambioDesdeLaPropuesta(null, 45), false, 'sin el de la propuesta no hay contra qué comparar');
  assert.equal(presupuestoCambioDesdeLaPropuesta(0, 45), false);
});

test('1 · lanzar la cierra como vencida con el motivo, y ya no aplica «el mismo porcentaje sobre el de hoy»', () => {
  const ej = sinComentarios(leer('lib/media-buyer/ejecutar.ts'));
  const rama = ej.slice(ej.indexOf('} else if (presupuestoCambioDesdeLaPropuesta(d.antes.presupuesto, actual.presupuesto)) {'));
  assert.ok(rama.length > 0 && ej.includes('presupuestoCambioDesdeLaPropuesta(d.antes.presupuesto, actual.presupuesto)'), 'la rama existe');
  assert.match(rama.slice(0, 600), /reclamar\(ws, id, \['abierta', 'fallida', 'bloqueada'\], \{ estado: 'vencida', error: motivo \}\);\s*return \{ ok: false, error: motivo \};/);
  assert.doesNotMatch(ej, /actual\.presupuesto \* \(d\.despues\.presupuesto \/ d\.antes\.presupuesto\)/, 'el porcentaje sobre el de hoy componía');
  // Lo que editó la persona sigue mandando: la rama del monto editado va ANTES.
  assert.ok(ej.indexOf('if (opts.presupuesto != null) {') < ej.indexOf('presupuestoCambioDesdeLaPropuesta(d.antes'));
});

// ── 2: la mezcla de tácticas es campo por campo ──────────────────────────────────────────────────────────────────────────

test('2 · una pestaña vieja que cambia sólo el estado no pisa los umbrales ni las campañas que otro cambió', () => {
  const guardadas = { surf: { estado: 'propone' as const, parametros: { a: 1, b: 2 }, campanas: ['11'] }, stop_loss: { estado: 'propone' as const } };
  assert.deepEqual(mezclarTacticas(guardadas, { surf: { estado: 'apagada' } }).surf, { estado: 'apagada', parametros: { a: 1, b: 2 }, campanas: ['11'] });
  assert.deepEqual(mezclarTacticas(guardadas, { surf: { parametros: { a: 5 } } }).surf?.parametros, { a: 5, b: 2 }, 'los umbrales, uno por uno');
  assert.equal(mezclarTacticas(guardadas, { surf: { campanas: null } }).surf?.campanas, null, 'null es «toda la cuenta»');
  assert.deepEqual(mezclarTacticas(guardadas, { surf: { estado: 'apagada' } }).stop_loss, { estado: 'propone' }, 'la otra táctica, intacta');
  assert.deepEqual(mezclarTacticas(null, { revive: { estado: 'automatica' } }), { revive: { estado: 'automatica' } });
});

test('2 · el panel de agentes, Automatizaciones y la API mandan sólo lo que cambian', () => {
  const delta = cambioDeAgente('media_buyer', 'apagada');
  for (const c of Object.values(delta)) assert.deepEqual(c, { estado: 'apagada' }, 'sin la copia de los umbrales ni de las campañas');
  assert.ok(validarTacticas(delta).ok);
  // cambiarAgente (la config entera) sigue sirviendo para mostrar; lo que se MANDA es cambioDeAgente.
  assert.deepEqual(Object.keys(delta).sort(), Object.keys(cambiarAgente({}, 'media_buyer', 'apagada')).sort());
  assert.match(sinComentarios(leer('app/ads-manager/Agentes.tsx')), /onTacticas\(cambioDeAgente\(a, estado\)\)/);
  assert.match(sinComentarios(leer('app/ads-manager/Automatizaciones.tsx')), /const tacticas: ConfigTacticas = \{ \[t\]: cambio \};/);
  const api = sinComentarios(leer('lib/api-mako/areas/ads.run.ts'));
  assert.match(api, /const v = validarTacticas\(\{ \[t\]: cambio \}\);/, 'automatizacion_media_buyer: la confirmación lleva sólo el cambio');
  assert.match(api, /const v = validarTacticas\(cambioDeAgente\(a, TACTICA_DE_ESTADO\[estado\]\)\);/, 'modo_agente_media_buyer, igual');
});

// ── 9: los agentes propios no gastan IA cuando su respuesta no entraría ──────────────────────────────────────────────────

test('9 · los lugares para los agentes propios son lo que deja el motor (que entra antes)', () => {
  assert.equal(lugaresParaPropios(2, 0, 2), 0, 'el motor llenó el cupo de Esencial');
  assert.equal(lugaresParaPropios(1, 0, 2), 1);
  assert.equal(lugaresParaPropios(0, 2, 2), 0, 'ya se recomendaron dos hoy');
  assert.equal(lugaresParaPropios(5, 1, 2), 0);
  assert.equal(lugaresParaPropios(9, 9, null), Infinity, 'Pro no tiene cupo');
});

test('9 · con cero lugares no se le pregunta a la IA del negocio, y la corrida pasa los lugares', () => {
  const ia = sinComentarios(leer('lib/media-buyer/agentes-ia.ts'));
  const cuerpo = ia.slice(ia.indexOf('export async function propuestasDeAgentesPropios'));
  const corte = cuerpo.indexOf('if (x.lugares <= 0) return');
  assert.ok(corte > 0, 'el corte existe');
  assert.ok(corte < cuerpo.indexOf('chatCheapCascade('), 'y va ANTES de pedirle a la IA');
  const corrida = sinComentarios(leer('lib/media-buyer/corrida.ts'));
  assert.match(corrida, /const libres = lugaresParaPropios\(props\.filter\(\(p\) => !yaGuardadas\.has\(p\.clave\)\)\.length, yaHoy, cupo\.recomendacionesDia\);/);
  assert.match(corrida, /propuestasDeAgentesPropios\(ws, \{[^}]*lugares: libres \}\)/);
});

// ── La baja de 80% o más: se puede, confirmada; la subida de ×5, no ──────────────────────────────────────────────────────

test('baja · bajar 80% o más pide confirmar (y el mensaje no culpa al separador de miles); subir cinco veces, no sale', () => {
  const r = revisarMontoEditado(15, 100, { fmt });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.confirmar, 'baja');
  assert.equal(!r.ok && r.error, 'Bajarlo de $100 a $15 por día es 85% menos.');
  assert.doesNotMatch(!r.ok ? r.error : '', /separador|miles/);
  assert.deepEqual(revisarMontoEditado(15, 100, { fmt, bajaConfirmada: true }), { ok: true });
  assert.equal(revisarMontoEditado(20, 100, { fmt }).ok, false, '80% justo es una baja grande');
  assert.deepEqual(revisarMontoEditado(21, 100, { fmt }), { ok: true });
  const sube = revisarMontoEditado(500, 100, { fmt, bajaConfirmada: true });
  assert.equal(sube.ok, false, 'confirmar una baja no deja pasar una subida');
  assert.equal(!sube.ok && sube.confirmar, undefined);
  assert.equal(revisarMontoEditado(0, 100, { fmt }).ok, false);
  assert.deepEqual(revisarMontoEditado(15, null, { fmt }), { ok: true }, 'sin el de hoy no hay contra qué comparar');
});

test('baja · la tarjeta pregunta pegada al botón y la hoja no se cierra con un «confírmalo»', () => {
  assert.deepEqual(resultadoAplicar({ ok: false, error: 'Bajarlo…', confirmar: 'baja' }), { confirmar: 'baja', mensaje: 'Bajarlo…' });
  assert.equal(resultadoAplicar({ ok: false, error: 'no' }), false);
  assert.equal(resultadoAplicar({ ok: true }), true);
  const tarjeta = sinComentarios(leer('app/ads-manager/Autopilot.tsx'));
  assert.match(tarjeta, /if \(typeof r === 'object'\) \{ setPorConfirmar\(r\.mensaje\); return; \}/);
  assert.match(tarjeta, /onClick=\{\(\) => aplicar\(true\)\}/);
  for (const f of ['app/ads-manager/MediaBuyer.tsx', 'app/m/ads/MediaBuyerM.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /if \(r === true\) setAbierta\(null\); return r;/, `${f}: un objeto es «verdadero» y cerraba la hoja`);
    assert.match(src, /const res = resultadoAplicar\(r\);\s*if \(typeof res === 'object'\) return res;/, `${f}: sin aviso de error`);
  }
});

test('baja · la ruta y la API pasan la confirmación hasta lanzar', () => {
  const ruta = sinComentarios(leer('app/api/media-buyer/route.ts'));
  assert.match(ruta, /bajaConfirmada: body\.confirmarBaja === true/);
  const ej = sinComentarios(leer('lib/media-buyer/ejecutar.ts'));
  assert.match(ej, /revisarMontoEditado\(opts\.presupuesto, actual\.presupuesto, \{ bajaConfirmada: opts\.bajaConfirmada === true/);
  const api = sinComentarios(leer('lib/api-mako/areas/ads.run.ts'));
  // La confirmación de la pantalla de MaKo dice la baja con todas las letras; la subida de ×5 ni se propone.
  assert.match(api, /if \(!rev\.ok && !rev\.confirmar\) return \{ error: rev\.error \};/);
  assert.match(api, /\.\.\.\(baja \? \{ confirmarBaja: true \} : \{\}\)/);
  assert.match(api, /resumen: `\$\{baja \? `⚠️ \$\{baja\} ` : ''\}Lanzar:/);
  assert.match(api, /bajaConfirmada: payload\.confirmarBaja === true/);
});
