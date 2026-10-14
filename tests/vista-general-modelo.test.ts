// =============================================================================
// «La vista general» — las decisiones que comparten /general y el Today móvil
// =============================================================================
// Lo que se fija acá gobierna el texto más grande de la pantalla de entrada del negocio,
// en las DOS pantallas que la dibujan. Un error no se ve como un bug: se ve como un dato.
//
// Cinco bugs medidos el 11/10/2026 se arreglaron al extraer esto de `app/general/page.tsx`,
// y cada uno tiene su bloque:
//   (1) la alerta de Meta escribía «MXN» fijo sobre un saldo en la moneda de la CUENTA;
//   (2) la tarjeta de pendientes decía «Datos al día» con `aviso` diciendo que algo falló;
//   (3) si `getDataSources()` fallaba, `fuentes = []` APAGABA la guarda #165;
//   (4) el escalón «Plan» del foco leía `experimento_tareas` también para el dueño;
//   (5) los defaults UTC de la fecha de hoy.
// Más uno que apareció en el camino: la marca del tiempo de un objetivo ANUAL caía en el
// fin del trimestre.
//
// ⚠️ CADA BLOQUE SE PROBÓ ROMPIÉNDOLO; el resultado está en su comentario.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  armarAlertas, saldoMeta, estadoFuentes, sinFuentesDeDatos, estadoLampara, contarSemaforo,
  objetivoAtrasado, plataDelObjetivo, fraccionDeRango, fraccionDelObjetivo, ayerDe,
  estadoPendientes, tareasDelDuenoParaFoco, tareasDelClienteParaFoco,
  type EntradaAlertas, type SaludMetaEntrada,
} from '../lib/vista-general-modelo';
import { elegirFoco, type EntradaFoco } from '../lib/focus';

const leer = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: la convención de la casa es explicar en prosa lo que se sacó, y un
 *  `doesNotMatch` sobre el texto crudo se acusaría a sí mismo. Líneas primero, bloques después. */
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const VACIA: EntradaAlertas = {
  pendientesArranque: [],
  saludMeta: null,
  cuotas: { vencidas: [], porVencer: [] },
  tramo: { promedio: null, n: 0 },
  fatiga: [],
  maduras: null,
};

const META_ROJA: SaludMetaEntrada = {
  severidad: 'rojo', statusLabel: 'Deshabilitada', balanceMxn: 1234.5, currency: 'USD',
  fundingCard: 'Visa ••4242', disableReasonLabel: null,
};

// ── (1) La moneda del saldo de Meta ──────────────────────────────────────────

test('(1) el saldo de Meta va en la moneda de la CUENTA, no en MXN fijo', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): volviendo `saldoMeta` a `… MXN` fijo, 1 fallo
  // (éste) y 26 pases — el de la cuenta en pesos sigue pasando, que es lo que tiene que
  // pasar: para MXN el texto no cambió.
  const [a] = armarAlertas({ ...VACIA, saludMeta: META_ROJA });
  assert.equal(a.tipo, 'meta-cuenta');
  const monto = (1234.5).toLocaleString('es-MX', { minimumFractionDigits: 2 });
  assert.ok(a.detalle.startsWith(`Adeudo ~${monto} USD (Visa ••4242). `), a.detalle);
  assert.doesNotMatch(a.detalle, /MXN/);
});

test('(1) una cuenta en pesos se lee EXACTAMENTE como antes', () => {
  const s = saldoMeta({ balanceMxn: 1234.5, currency: 'MXN' });
  // El formato viejo, literal: `${balanceMxn.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`.
  assert.equal(s, `${(1234.5).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`);
  // Una moneda vacía no inventa otra: cae a la de siempre.
  assert.match(saldoMeta({ balanceMxn: 1, currency: '' }), / MXN$/);
});

// ── Las reglas del semáforo, sin cambiar una ─────────────────────────────────

test('las alertas salen ordenadas por gravedad, y las de cuotas traen las filas CRUDAS', () => {
  const cuota = (lead_id: number, dias: number, monto_usd: number) => ({
    lead_id, lead_nombre: `Lead ${lead_id}`, numero: 1, monto_usd, fecha_esperada: '2026-10-01', dias,
  });
  const al = armarAlertas({
    ...VACIA,
    fatiga: [{ adset_name: 'Conjunto A', frequency_7d: 4.2, cpl_7d_usd: 30, cpl_28d_usd: 12 }],
    cuotas: { vencidas: [cuota(7, -3, 500), cuota(8, -1, 250)], porVencer: [cuota(9, 2, 100)] },
    maduras: { tasa_cierre_madura: 35, limpias: 5 },
  });
  assert.deepEqual(al.map((a) => a.tipo), ['cuotas-vencidas', 'cuotas-por-vencer', 'fatiga-creativo', 'cierre-sano']);
  assert.equal(al[0].nivel, 'rojo');
  assert.equal(al[0].totalUsd, 750);
  assert.deepEqual(al[0].cuotas?.map((c) => c.lead_id), [7, 8]);
  assert.match(al[0].titulo, /^2 cuotas VENCIDAS — cobrar URGENTE/);
  // El href es de ESCRITORIO: el móvil lo traduce con rutaMovil().
  assert.equal(al[0].href, '/dashboard?hoja=comercial');
});

test('no poder leer el arranque es una alerta; no tener nada pendiente, ninguna', () => {
  // `null` = la lectura falló, que no es «no quedó nada»: se dice.
  assert.deepEqual(armarAlertas({ ...VACIA, pendientesArranque: null }).map((a) => a.tipo), ['arranque-sin-leer']);
  assert.deepEqual(armarAlertas(VACIA), []);
  const [p] = armarAlertas({ ...VACIA, pendientesArranque: [{ que: 'Conectar WhatsApp', ruta: '/whatsapp', donde: 'WhatsApp' }] });
  assert.equal(p.titulo, 'Te quedó pendiente: conectar whatsapp');
  assert.equal(p.href, '/whatsapp');
});

test('la tasa de cierre: sana desde 30, baja debajo de 20, y nada en el medio ni con pocas cohortes', () => {
  assert.equal(armarAlertas({ ...VACIA, maduras: { tasa_cierre_madura: 15, limpias: 3 } })[0]?.tipo, 'cierre-bajo');
  assert.deepEqual(armarAlertas({ ...VACIA, maduras: { tasa_cierre_madura: 25, limpias: 9 } }), []);
  assert.deepEqual(armarAlertas({ ...VACIA, maduras: { tasa_cierre_madura: 5, limpias: 2 } }), []);
});

// ── (3) #165 — una lectura caída es «no sé» ──────────────────────────────────

test('(3) si las fuentes no se pudieron leer, NO se puede opinar (antes: [] apagaba la guarda)', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): con `if (fuentes === null) return 'con-datos'`
  // —que es lo que hacía `fuentes.length > 0 && …` sobre el `[]` del default— 1 fallo
  // (éste) y 26 pases.
  assert.equal(estadoFuentes(null), 'sin-leer');
  assert.equal(sinFuentesDeDatos(null), true);
});

test('(3) ninguna fuente con datos pero alguna sin leer: «no sé», no «sin datos»', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): sacando la línea que mira `f.error`, 1 fallo
  // (éste) y 26 pases: `getDataSources` traga el error de cada query como `lastSync: null`.
  assert.equal(estadoFuentes([{ lastSync: null }, { lastSync: null, error: 'timeout' }]), 'sin-leer');
});

test('#165 · se pregunta por lastSync, nunca por status: «stale» sin un dato es SIN datos', () => {
  // calendly y vsl_beacon devuelven 'stale' sin un solo dato (lib/sources.ts). El campo
  // `status` ni siquiera entra al tipo: la pregunta no se puede hacer mal.
  const vacias = [{ lastSync: null, status: 'stale' }, { lastSync: null, status: 'off' }];
  assert.equal(estadoFuentes(vacias), 'sin-datos');
  assert.equal(sinFuentesDeDatos(vacias), true);
  assert.equal(estadoFuentes([]), 'sin-datos');
});

test('#165 · con UNA fuente que entregó algo, sí se puede opinar (aunque otra falle)', () => {
  assert.equal(estadoFuentes([{ lastSync: '2026-10-10' }, { lastSync: null, error: 'x' }]), 'con-datos');
  assert.equal(sinFuentesDeDatos([{ lastSync: '2026-10-10' }]), false);
});

// ── La lámpara ───────────────────────────────────────────────────────────────

test('la lámpara: apagada sin fuentes aunque haya rojo; roja con una urgente; ámbar si el objetivo va atrasado', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): sacando `+ (atrasado ? 1 : 0)` de
  // `contarSemaforo`, 1 fallo (éste: la lámpara sale VERDE con «vas abajo» arriba, el caso
  // medido en ws13) y 26 pases.
  const roja = [{ nivel: 'rojo' as const }];
  assert.equal(estadoLampara(roja, true, false), 'apagado');
  assert.equal(estadoLampara(roja, false, false), 'rojo');
  assert.equal(estadoLampara([], false, true), 'ambar');
  assert.equal(estadoLampara([{ nivel: 'verde' as const }], false, false), 'verde');
  assert.deepEqual(contarSemaforo([{ nivel: 'ambar' }, { nivel: 'rojo' }], true), { urgentes: 1, vigilar: 2 });
});

test('el objetivo «atrasado» sólo se afirma con el avance LEÍDO', () => {
  assert.equal(objetivoAtrasado(null), false);
  assert.equal(objetivoAtrasado({ actual: null, ritmo: { alDia: false } }), false);
  assert.equal(objetivoAtrasado({ actual: 10, ritmo: null }), false);
  assert.equal(objetivoAtrasado({ actual: 10, ritmo: { alDia: false } }), true);
  assert.equal(objetivoAtrasado({ actual: 10, ritmo: { alDia: true } }), false);
});

// ── (2) Los pendientes: «al día» sólo si se leyó todo ────────────────────────

test('(2) con `aviso` y cero pendientes, la tarjeta NO dice «al día»', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): con `return 'al-dia'` en lugar del chequeo de
  // `aviso`, 1 fallo (éste) y 26 pases.
  assert.equal(estadoPendientes({ total: 0, aviso: 'No se pudo leer el plan de pagos: esta lista puede estar incompleta.' }), 'sin-confirmar');
  assert.equal(estadoPendientes({ total: 0, aviso: '' }), 'al-dia');
  assert.equal(estadoPendientes({ total: 0 }), 'al-dia');
});

test('(2) con pendientes, el número manda aunque haya aviso', () => {
  assert.equal(estadoPendientes({ total: 4, aviso: 'No se pudo leer…' }), 'por-marcar');
});

test('(2) la tarjeta de escritorio pregunta por `estadoPendientes`, no por `total` a secas', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): volviendo el h2 a `pendientes.total > 0 ? …`,
  // 1 fallo (éste) y 26 pases. La función sola no alcanza: hay que ver que la tarjeta la use.
  // Desde el 14/10/2026 la tarjeta es el bloque «Pendientes del CRM» de General (app/general/bloques/Negocio.tsx).
  // Re-probado ahí (base 27 / 0): el estado por `p.total > 0` → 26 / 1.
  const page = sinComentarios(leer('app/general/bloques/Negocio.tsx'));
  assert.match(page, /const estado = estadoPendientes\(p\);/);
  assert.doesNotMatch(page, /p\.total > 0\s*\?/);
});

// ── La plata del objetivo ────────────────────────────────────────────────────

test('la plata: cobrado arriba si el objetivo es de cobrado, y nada si no es de plata', () => {
  const br = { cash: [{ monto: 100 }, { monto: 50 }], sold: [{ monto: 900 }] };
  const c = plataDelObjetivo('cash_usd', br);
  assert.deepEqual({ esCash: c?.esCash, p: c?.totalPropios, o: c?.totalOtros }, { esCash: true, p: 150, o: 900 });
  const s = plataDelObjetivo('sold_usd', br);
  assert.deepEqual({ esCash: s?.esCash, p: s?.totalPropios, o: s?.totalOtros }, { esCash: false, p: 900, o: 150 });
  assert.equal(plataDelObjetivo('cierres', br), null);
});

// ── La marca del tiempo ──────────────────────────────────────────────────────

test('la marca de un objetivo ANUAL cae en HOY, no en el fin del trimestre', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): pasando el fin del período en vez de `hoy` —lo
  // que hacía la cabecera con `progreso.hasta`: en Q4, el fin del año— 1 fallo (éste) y 26
  // pases.
  const anual = { quarter: null, desde: '2026-01-01', hasta: '2026-12-31' };
  const f = fraccionDelObjetivo(anual, { fraccion: 0.12 }, '2026-10-11');
  assert.ok(Math.abs(f - 284 / 365) < 1e-9, `fracción ${f}`);
});

test('la marca de un objetivo del trimestre es la fracción del trimestre; sin objetivo, 0', () => {
  assert.equal(fraccionDelObjetivo({ quarter: 4, desde: '2026-10-01', hasta: '2026-12-31' }, { fraccion: 0.12 }, '2026-10-11'), 0.12);
  assert.equal(fraccionDelObjetivo(null, { fraccion: 0.5 }, '2026-10-11'), 0);
});

test('fraccionDeRango cuenta días enteros, inclusive, y no se sale de 0..1', () => {
  assert.equal(fraccionDeRango('2026-01-01', '2026-01-10', '2026-01-01'), 0.1);
  assert.equal(fraccionDeRango('2026-01-01', '2026-01-10', '2026-01-10'), 1);
  assert.equal(fraccionDeRango('2026-01-01', '2026-01-10', '2025-12-01'), 0);
  assert.equal(fraccionDeRango('2026-01-01', '2026-01-10', '2027-01-01'), 1);
  assert.equal(fraccionDeRango('mal', '2026-01-10', '2026-01-05'), 0);
});

test('ayer cruza meses y años', () => {
  assert.equal(ayerDe('2026-10-01'), '2026-09-30');
  assert.equal(ayerDe('2026-01-01'), '2025-12-31');
});

// ── (4) El escalón «Plan» del foco ───────────────────────────────────────────

test('(4) del tablero del DUEÑO compiten las abiertas que no se repiten', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): sacando `sinRecurrentes` de
  // `tareasDelDuenoParaFoco`, 1 fallo (éste) y 26 pases.
  const t = (title: string, score: number, progress: number, recurrente = false) =>
    ({ title, score, progress, deadline: '', recurrente });
  const r = tareasDelDuenoParaFoco([t('hecha', 99, 100), t('se repite', 98, 0, true), t('abierta', 50, 30)]);
  assert.deepEqual(r.map((x) => x.titulo), ['abierta']);
  assert.equal(r[0].deadline, null); // '' del BoardTask no es una fecha
  assert.equal(r[0].progreso, 30);
});

test('(4) del tablero del CLIENTE compiten las pendientes: sin hechas, sin «no cumple» y sin recurrentes', () => {
  const t = (titulo: string, estado: 'hecho' | 'no_cumple' | 'por_hacer' | 'en_seguimiento', recurrente = false) =>
    ({ titulo, score: 50, progreso: 0, deadline: null, estado, recurrente });
  const r = tareasDelClienteParaFoco([t('a', 'hecho'), t('b', 'no_cumple'), t('c', 'por_hacer', true), t('d', 'en_seguimiento'), t('e', 'por_hacer')]);
  assert.deepEqual(r.map((x) => x.titulo), ['d', 'e']);
});

test('(4) la lectura elige el tablero con tableroActual() y lee plan_tareas para el dueño', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): reemplazando la rama del dueño por
  // `listTareas()` —lo que hacía la página— 1 fallo (éste) y 26 pases.
  const src = sinComentarios(leer('lib/vista-general.ts'));
  assert.match(src, /await tableroActual\(\)/);
  assert.match(src, /tablero === 'dueno'\) return tareasDelDuenoParaFoco\(\(await listPlanBoard\(\)\)\.tareas\)/);
  assert.match(src, /tablero === 'cliente'\) return tareasDelClienteParaFoco\(await listTareas\(\)\)/);
  // Y la página ya no elige tabla por su cuenta.
  assert.doesNotMatch(sinComentarios(leer('app/general/page.tsx')), /listTareas|experimento_tareas/);
});

// ── (5) El hoy del workspace ─────────────────────────────────────────────────

test('(5) toda lectura con un default UTC recibe el `hoy` del workspace', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): con `getFatigaAdsets()` sin argumento, 1 fallo
  // (éste, nombrando la función) y 26 pases.
  const src = sinComentarios(leer('lib/vista-general.ts'));
  for (const fn of ['getPendientesDeMarcar', 'getFatigaAdsets', 'getTramoJ1J2Reciente', 'getCuotasPendientes', 'getTableroKpis', 'getCapacidad']) {
    const llamadas = [...src.matchAll(new RegExp(`\\b${fn}\\(([^)]*)\\)`, 'g'))].map((m) => m[1].trim());
    assert.ok(llamadas.length > 0, `${fn} no se llama`);
    for (const args of llamadas) assert.match(args, /^hoy\b/, `${fn}(${args}) no recibe el hoy del workspace`);
  }
  assert.match(src, /getResumenComparativo\(ayer\)/);
  assert.match(src, /const ayer = ayerDe\(hoy\)/);
  // El `hoy` sale de quarterActual() (hoyEnWorkspace), no de un Date.
  assert.match(src, /const \{ qt, hoy, progreso \} = await quarterActual\(\)/);
  assert.doesNotMatch(src, /new Date\(\)\.toISOString/);
});

// ── El foco: el campo explícito y las recurrentes ────────────────────────────

const BASE: EntradaFoco = {
  kpis: [], alertas: [], tareas: [], objetivos: 0, cuello: null, sinFuentes: false, hoy: '2026-10-11',
};

test('el foco dice QUÉ falta configurar en un campo, no en el rótulo del botón', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): con `pideConfigurar: null` en el escalón del
  // objetivo, 1 fallo (éste) y 26 pases: el guard de la cabecera de abajo sigue pasando
  // (son dos preguntas: el dato y quién lo lee).
  assert.equal(elegirFoco(BASE).pideConfigurar, 'objetivo');
  assert.equal(elegirFoco({ ...BASE, objetivos: 1 }).pideConfigurar, 'kpis');
  const kpi = { id: 'k', nombre: 'Agendas', estado: 'sin-datos' as const, cadencia: 'semanal' as const, compromiso: 5,
    unidad: 'cantidad' as const, valor: null, fuente: 'auto' as const, fuenteId: 'agendas', objetivoTitulo: null, orden: 0 };
  assert.equal(elegirFoco({ ...BASE, objetivos: 1, kpis: [kpi], sinFuentes: true }).pideConfigurar, 'fuente');
  assert.equal(elegirFoco({ ...BASE, objetivos: 1, kpis: [kpi] }).pideConfigurar, null);
});

test('la cabecera calla según el campo, no comparando el texto del botón', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): devolviendo la comparación de `hrefLabel`, 1
  // fallo (éste) y 26 pases.
  const cab = sinComentarios(leer('app/general/Cabecera.tsx'));
  assert.match(cab, /foco\.pideConfigurar === 'objetivo'/);
  assert.doesNotMatch(cab, /hrefLabel === 'Cargar el objetivo'/);
});

test('una tarea que se repite NUNCA es «la acción», aunque tenga el score más alto', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): sacando `sinRecurrentes` de `elegirFoco`, 1
  // fallo (éste, con la recurrente como acción) y 26 pases.
  const foco = elegirFoco({ ...BASE, tareas: [
    { titulo: 'Junta de los miércoles', score: 99, progreso: 0, deadline: null, recurrente: true },
    { titulo: 'Armar la oferta', score: 60, progreso: 10, deadline: null },
  ] });
  assert.equal(foco.origen, 'plan');
  assert.equal(foco.accion, 'Armar la oferta');
});

test('(3) con las fuentes sin leer, el foco NO dice «al día» ni culpa al cliente', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (11/10/2026): ignorando `fuentesSinLeer`, 1 fallo (éste, con
  // «Conecta una fuente de datos» — pedirle al cliente que arregle algo que no rompió) y 26
  // pases.
  const kpi = { id: 'k', nombre: 'Agendas', estado: 'verde' as const, cadencia: 'semanal' as const, compromiso: 5,
    unidad: 'cantidad' as const, valor: 6, fuente: 'auto' as const, fuenteId: 'agendas', objetivoTitulo: null, orden: 0 };
  const foco = elegirFoco({ ...BASE, objetivos: 1, kpis: [kpi], sinFuentes: true, fuentesSinLeer: true });
  assert.doesNotMatch(foco.accion, /al día|[Cc]onecta/);
  assert.match(foco.accion, /No pude leer/);
  assert.equal(foco.pideConfigurar, null);
  assert.equal(foco.nivel, 'ambar');
});
