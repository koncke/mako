// =============================================================================
// El plan por TRAMOS en la API de MaKo (`armar_plan_por_tramos`, área cobros; 29/10/2026)
// =============================================================================
// Ticket #26 (Mauricio, ws1, 29/10 03:51): en el Ops Center le pidió a MaKo «7500 dolares en 3 pagos, primer pago 28 de octubre,
// segundo pago 28 de noviembre y tercer pago 28 de diciembre. Cada uno de $2,500 dólares.», y MaKo contestó: «Mis herramientas
// leen la cobranza, pero no crean el plan de pagos ni editan cuotas». AGENTS.md: todo MaKo se usa por la API. Se fija:
//   1. la forma: una acción por chat (UN lead, el resumen dice cada cuota), que mueve plata (`plata`), sin `dinero`, para
//      cualquiera de la ficha, por los tres canales, con rótulo en cada parámetro, y al final de su área;
//   2. su URL REST: PUT /cobros/ventas/{leadId}/plan;
//   3. UNA implementación: el runner no escribe `pagos` ni `leads`; arma con la regla de la ficha (`planPorTramosDelServer` →
//      `cuotasDelPlanPorTramos`) y escribe con `guardarPlanPorTramos` (lib/pagos.ts), con las columnas de la ficha;
//   4. el caso REAL del ticket corrido de punta a punta (preparar y el «sí») contra una base de mentira, en el negocio de prueba
//      (tests/_plan-tramos-api-hijo.ts): las tres cuotas, su repetición sin cambios, lo que rechaza, dos tramos en pesos con
//      anticipo, la cuota con un link, y el cobro a medias en pesos sin dólares (A1 de la revisión de 9fc4030dd, en el server).
// PROBADO ROMPIÉNDOLO (29/10/2026), una rotura por vez, restaurando el archivo (fallos / pases sobre los 8 de acá):
//   · el tramo sin su cantidad                                     → 3 / 5
//   · una suscripción se arma igual (sin la guarda de preparar)     → 1 / 7
//   · `guardarPlanPorTramos` sin `protegidasPrimero` ni `sobreLoVisto` → 2 / 6
//   · sin escribir las columnas del plan                            → 2 / 6
//   · el resumen sin cada cuota                                     → 2 / 6
//   · la propuesta de `marcar_pago_cobrado` sin la tasa de la cuota  → 1 / 7
//   · `cobranza_lead` le dice «cobrada_en» a una cuota sin cobrar    → 1 / 7
//   · sin la familia `plan-dictado` (lib/mako-intencion-app.ts): falla «cobros: las 26 frases» de
//     tests/ops-center-clasificador-app.test.ts (1 / 47).
// Y la re-verificación de 805afb460, sobre los 12 de acá (fallos / pases), una rotura por vez:
//   · N1: `faltaParaConfirmar` no mira nada / el «sí» ejecuta sin lo que se vio            → 1 / 11 cada una
//   · N2: `cuotasQueQuedan` sin lo que no se puede cambiar / el resumen de lo pedido        → 1 / 11 cada una
//   · N3: la base de mentira deja la diferencia en dólares / la 0347 sin sus pesos          → 1 / 11 cada una
//   · N4: el anticipo sobre uno cobrado se promete / B6: el choque de dos «sí», crudo        → 1 / 11 cada una
//   · B7 («Las cuota del plan»): falla su test en tests/pagos-tramos.test.ts (1 / 24).
// Y la tercera vuelta (B8 a B13), sobre los 16 de acá (3/11/2026, con main traído), una rotura por vez:
//   · B8: no comparar la firma                                                                        → 1 / 15
//   · B9: `faltaParaConfirmar` deja pasar la de antes / `ejecutar` la cumple / sin vistas vale vacías  → 1 / 15 cada una
//   · B10: el #0 cobrado sin su columna / B11: no se nombra lo de aparte / la venta no lo descuenta    → 1 / 15 cada una
//   · B12: la que ya no vale sigue viva                                                                → 1 / 15
//   · B13: la regla siempre en dólares / `cobrarCuota` sin los pesos / el resumen en dólares           → 1 / 15 cada una
//   · la firma sin la fecha, o sin la moneda y su monto: 0 fallos acá. Los atrapa «B8 · cada dato…» de tests/pagos-tramos.test.ts.
// Correr: node --import tsx --test tests/api-mako-plan-tramos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { porArea, porId, visible, type Vista } from '../lib/api-mako/registro';
import { esAccion, type AccionDef } from '../lib/api-mako/tipos';
import { rutaRestDe } from '../lib/api-mako/rest';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

type Fila = { numero: number; monto_usd: number; fecha_esperada: string | null; pagado: boolean; moneda: string | null; monto_original: number | null };
type Paso = { prep: { resumen?: string; error?: string; payload?: Record<string, unknown> }; ejec: { ok: boolean; resumen: string; datos?: Record<string, unknown> } | null };
type Salida = {
  fernando: Paso & { pagos: Fila[]; plan: Record<string, unknown>; historial: string[]; red: string[] };
  fernandoOtraVez: { ejec: Paso['ejec']; pagos: Fila[] };
  rechazos: { sus: { error?: string }; pesos: { error?: string }; ajeno: { error?: string }; pagos: number };
  pesos: Paso & { pagos: Fila[]; plan: Record<string, unknown> };
  conLink: Paso & { pagos: Array<{ id: number; monto_usd: number; fecha_esperada: string }> };
  aMedias: Paso & { pagos: Fila[] };
  cobranzaMia: unknown;
  siViejo: { vistas: number[] | null; sinCambios: string | null; falta: string | null; ejec: { ok: boolean; resumen: string }; pagos: Fila[]; faltaLeo: string | null };
  queda: Paso & { pagos: Fila[] };
  anticipoCobrado: { error?: string; resumen?: string };
  dosSi: { dos: Array<{ ok: boolean; resumen: string }>; pagos: Fila[] };
  firma: { vistas: unknown; falta: string | null; ejec: { ok: boolean; resumen: string }; pagos: Fila[] };
  deAntes: { casos: Array<{ falta: string | null; ejec: { ok: boolean; resumen: string } }>; pagos: Fila[] };
  carla: { error?: string; resumen?: string };
  aparte: { error?: string; resumen?: string };
  cerrada: { viejo: { error?: string }; nuevo: Record<string, unknown>; estados: string[]; pagos: Fila[] };
  red: string[];
};
let salida: Salida | null = null;
const correr = (): Salida => {
  salida ??= JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_plan-tramos-api-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
  })) as Salida;
  return salida;
};

test('1. la forma: por chat, mueve plata sin costar, para cualquiera de la ficha, por los tres canales, al final de cobros', () => {
  const d = porId('armar_plan_por_tramos');
  assert.ok(d && esAccion(d), 'no está en el registro');
  const a = d as AccionDef;
  assert.equal(a.area, 'cobros');
  assert.equal(a.confirmacion, 'chat', 'es UN lead y el resumen dice cada cuota antes del «sí»');
  assert.equal(a.plata, true, 'cambia lo que el cliente debe: por WhatsApp se confirma con un «sí» sin nada más');
  assert.equal(a.costo, 'gratis');
  assert.deepEqual([...a.canales].sort(), ['app', 'http', 'whatsapp']);
  assert.deepEqual(a.gating, { tab: 'crm' });
  for (const p of a.parametros) {
    assert.ok(p.rotulo?.trim(), `${p.nombre} sin rótulo`);
    for (const c of p.campos ?? []) assert.ok(c.rotulo?.trim(), `${p.nombre}.${c.nombre} sin rótulo`);
  }
  const tramos = a.parametros.find((p) => p.nombre === 'tramos');
  assert.ok(tramos?.obligatorio && tramos.tipo === 'object[]' && tramos.max === 10, 'hasta 10 tramos, obligatorios');
  assert.deepEqual(tramos?.campos?.find((c) => c.nombre === 'cada')?.enum, ['mes', 'quincena', 'semana']);
  // Un closer de la ficha también arma un plan (como editar_cuota); y va AL FINAL de su área (AGENTS.md: no le saca el lugar a otra).
  const miembro: Vista = { canal: 'app', alcance: 'proponer', ws: 9, rol: 'miembro', tabs: null };
  assert.equal(visible(d, miembro), true);
  // No «es la última» (eso se rompe con la próxima operación de cobros, y pasó en el área chatbot el 31/10/2026): lo que se
  // cuida es que no se haya adelantado a las que ya estaban. La de atrás es la que había al final cuando ésta se declaró.
  const cobros = porArea('cobros').map((x) => x.id);
  assert.ok(
    cobros.indexOf('armar_plan_por_tramos') > cobros.indexOf('editar_cuota'),
    'una operación nueva va AL FINAL de su área, detrás de las que ya estaban (AGENTS.md): a igual puntaje el chat trae la declarada antes y le saca el lugar',
  );
  // El plan uniforme manda acá lo que no entra en él (una primera cuota con fecha, quincenas, otra moneda, varios montos).
  assert.match(porId('guardar_plan_pagos')?.descripcion ?? '', /usa armar_plan_por_tramos/);
});

test('2. su URL REST: PUT /cobros/ventas/{leadId}/plan', () => {
  assert.deepEqual(rutaRestDe('armar_plan_por_tramos'), { metodo: 'PUT', ruta: '/cobros/ventas/{leadId}/plan' });
});

test('3. una implementación: la regla de la ficha y la escritura de lib/pagos.ts, sin un `.from(` propio', () => {
  const run = leer('lib/api-mako/areas/cobros.run.ts');
  const ini = run.indexOf('  armar_plan_por_tramos: {');
  // Hasta lo que sigue en el objeto: otro runner, el comentario del siguiente o el cierre.
  const cuerpo = run.slice(ini, ini + 1 + run.slice(ini + 1).search(/\n {2}(?:\/\/|[a-z][a-z0-9_]*: \{)|\n\};/));
  assert.ok(cuerpo.length > 200, 'no encontré el runner');
  assert.doesNotMatch(cuerpo, /\.from\(/, 'el runner escribe la base por su cuenta');
  assert.match(cuerpo, /const plan = planPorTramosDelServer\(\{/);
  assert.match(cuerpo, /const r = await guardarPlanPorTramos\(/);
  const lib = leer('lib/pagos.ts');
  const guardar = lib.slice(lib.indexOf('export async function guardarPlanPorTramos('), lib.indexOf('export type ResultadoPlan'));
  assert.match(guardar, /guardarCuotasPorId\(leadId, armado\.deseadas, \{ vistos: new Set\(p\.vistas\.map\(\(v\) => v\.id\)\), protegidasPrimero: true, sobreLoVisto: true \}\)/, 'no guarda como la ficha, sobre lo que se vio');
  assert.match(guardar, /await asegurarLeadDelNegocio\(leadId\);/);
  const campo = leer('lib/pagos-campo.ts');
  assert.match(campo, /const encima = cuotasDelPlanPorTramos\(\{ pagos: p\.pagos, protegidas: p\.protegidas, anticipo: p\.anticipo, lista: armado\.cuotas, planConInicial: p\.planConInicial \}\);/);
  // Las columnas del plan, las MISMAS en la ficha y en la API.
  assert.match(leer('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx'), /const columnas: PlanUniforme = columnasDelPlan\(\{/);
  assert.match(campo, /columnas: columnasDelPlan\(\{ tramos: p\.tramos, cuotas: armado\.cuotas\.length, anticipoUsd \}\)/);
});

test('4. el ticket #26: 3 cuotas de US$2.500 los 28 desde el 28/10, con cada cuota en el resumen, y otra vez no cambia nada', () => {
  const s = correr();
  assert.deepEqual(s.red, [], 'nada sale a la red');
  const r = s.fernando.prep.resumen ?? '';
  assert.match(r, /Plan de Fernando Muñoz: 3 cuota\(s\)\./, s.fernando.prep.error ?? r);
  assert.match(r, /Cuotas: 28\/10\/2026 US\$ 2\.500 · 28\/11\/2026 US\$ 2\.500 · 28\/12\/2026 US\$ 2\.500\./, 'el resumen no dice cada cuota');
  assert.match(r, /Total: US\$ 7\.500\./);
  assert.match(r, /La venta dice que no tiene monto: el plan no la cambia \(eso es editar_venta_lead\)\./, 'no avisa que la venta sigue en $0');
  assert.equal(s.fernando.ejec?.ok, true, s.fernando.ejec?.resumen);
  assert.deepEqual(s.fernando.pagos.map((q) => [q.numero, q.monto_usd, q.fecha_esperada, q.pagado]), [
    [1, 2500, '2026-10-28', false], [2, 2500, '2026-11-28', false], [3, 2500, '2026-12-28', false],
  ]);
  // Las columnas del plan: un tramo, 3 cuotas, el día 28 (como las escribe la ficha).
  assert.deepEqual(s.fernando.plan, { cobro_inicial_usd: null, monto_cuota_usd: 2500, total_cuotas: 3, dia_de_pago: 28 });
  assert.equal(s.fernando.historial.filter((h) => h.startsWith('Cuota ')).length, 3, 'el historial no dice las tres cuotas');
  assert.ok(s.fernando.historial.some((h) => /^Plan de pagos: Plan por tramos: 3 cuota\(s\)/.test(h)), 'el historial no dice que se armó el plan');
  // Otro «sí» con lo mismo (otra pestaña, un reintento): nada.
  assert.equal(s.fernandoOtraVez.ejec?.ok, true);
  assert.deepEqual(s.fernandoOtraVez.ejec?.datos && { a: s.fernandoOtraVez.ejec.datos.actualizadas, n: s.fernandoOtraVez.ejec.datos.nuevas, q: s.fernandoOtraVez.ejec.datos.quitadas }, { a: 0, n: 0, q: 0 });
  assert.equal(s.fernandoOtraVez.pagos.length, 3, 'repetirlo duplicó cuotas');
});

test('5. lo que no arma: una suscripción, pesos sin sus dólares, el lead de otro negocio', () => {
  const s = correr().rechazos;
  assert.match(s.sus.error ?? '', /Nadia es una suscripción: pásala a pago único con editar_venta_lead/);
  assert.match(s.pesos.error ?? '', /¿Cuánto es en dólares\?/, 'pesos sin dólares: una tasa inventada');
  assert.match(s.ajeno.error ?? '', /No existe el lead #401 en este negocio/);
  assert.equal(s.pagos, 0, 'escribió algo');
});

test('6. dos tramos en pesos con anticipo: cada cuota con sus pesos y sus dólares, el segundo tramo donde termina el primero', () => {
  const s = correr().pesos;
  assert.equal(s.ejec?.ok, true, s.ejec?.resumen ?? s.prep.error);
  const cero = s.pagos.find((q) => q.numero === 0);
  assert.deepEqual(cero && [cero.monto_usd, cero.fecha_esperada, cero.moneda], [1000, '2026-10-29', null], 'el anticipo');
  const cuotas = s.pagos.filter((q) => q.numero !== 0);
  assert.equal(cuotas.length, 12);
  assert.deepEqual(cuotas.slice(0, 6).map((q) => [q.moneda, q.monto_original, q.monto_usd]), Array(6).fill(['MXN', 12000, 600]));
  assert.deepEqual(cuotas.slice(6).map((q) => [q.moneda, q.monto_original, q.monto_usd]), Array(6).fill(['MXN', 10000, 500]));
  assert.deepEqual([cuotas[0].fecha_esperada, cuotas[5].fecha_esperada, cuotas[6].fecha_esperada], ['2026-11-01', '2027-04-01', '2027-05-01']);
  assert.match(s.prep.resumen ?? '', /01\/11\/2026 \$ 12\.000 MXN \(US\$ 600\)/);
  // Dos tramos: las columnas de UN monto van vacías; el anticipo, sí.
  assert.deepEqual(s.plan, { cobro_inicial_usd: 1000, monto_cuota_usd: null, total_cuotas: null, dia_de_pago: null });
});

test('7. la cuota con un link sin pagar no se borra al acortar: toma el lugar de una sin proteger', () => {
  const s = correr().conLink;
  assert.equal(s.ejec?.ok, true, s.ejec?.resumen ?? s.prep.error);
  assert.deepEqual(s.pagos.map((q) => [q.id, q.monto_usd, q.fecha_esperada]).sort(), [[31, 500, '2026-11-10'], [33, 500, '2026-12-10']]);
});

test('8. A1 en el server: cobrar a medias por la API una cuota en pesos, sin los dólares, deja la diferencia pendiente', () => {
  // Lo que MaKo lee de la cuota en pesos SIN cobrar: lo pactado («cobrada_en» le hacía decir que ya había pagado).
  const leida = JSON.stringify(correr().cobranzaMia);
  assert.match(leida, /pactada_en[^}]*MXN[^}]*12000/, leida.slice(0, 400));
  assert.doesNotMatch(leida, /cobrada_en/);
  const s = correr().aMedias;
  // Lo que se confirma dice lo que se va a escribir: US$300 y la diferencia pendiente (decía «USD 600»).
  // B13 (revisión de 7f79a4e6c): con la 0347 la diferencia queda en pesos, y los textos lo dicen («los 300 USD que faltan»).
  assert.match(s.prep.resumen ?? '', /por 300 USD: los \$ 6\.000 MXN \(300 USD\) que faltan quedan como una cuota nueva pendiente/, s.prep.resumen);
  assert.equal((s.ejec as { ok?: boolean } | null)?.ok, true, JSON.stringify(s.prep));
  const cobrada = s.pagos.find((q) => q.pagado);
  assert.deepEqual(cobrada && [cobrada.monto_usd, cobrada.moneda, cobrada.monto_original], [300, 'MXN', 6000], 'la cuota quedó cobrada entera: se perdían 6.000 pesos');
  const resto = s.pagos.filter((q) => !q.pagado);
  assert.deepEqual(resto.map((q) => q.monto_usd), [300], 'no quedó la diferencia pendiente');
  // N3 (revisión de 805afb460): la diferencia queda en la moneda de la cuota, lo pactado menos lo cobrado (mig 0347, copiada en
  // tests/_postgrest-de-mentira.ts). Antes quedaba «US$300» y el recordatorio le pedía dólares a quien paga en pesos.
  assert.deepEqual(resto.map((q) => [q.moneda, q.monto_original]), [['MXN', 6000]], 'la diferencia quedó en dólares');
  assert.match((s.ejec as { resumen?: string } | null)?.resumen ?? '', /quedan \$ 6\.000 MXN \(300 USD\) pendientes en una cuota nueva/);
});

test('9. N1: el «sí» a una propuesta vieja no pisa un plan armado después (ni una cuota cobrada en el medio), y lo dice', () => {
  const s = correr().siViejo;
  assert.deepEqual(s.vistas, [], 'la propuesta no guarda lo que vio');
  assert.equal(s.sinCambios, null, 'sin cambios, el «sí» pasa');
  // `yaNoVale`: además de frenarse antes de reclamarla, la pendiente se cierra (B12).
  assert.match(s.falta ?? '', /^yaNoVale: El plan de cuotas cambió desde que lo propuse \(apareció «Cuota 1»\): no guardé nada/, 'el «sí» viejo no se frena antes de reclamar la pendiente');
  // Y si llega igual a ejecutar (la carrera entre el control y la escritura), no escribe.
  assert.equal(s.ejec.ok, false);
  assert.deepEqual(s.pagos.map((q) => q.monto_usd), [1000, 1000, 1000, 1000, 1000, 1000], 'pisó las 6 cuotas de la ficha');
  assert.match(s.faltaLeo ?? '', /se cobró «Cuota 2»/);
});

test('10. N2: lo que se confirma es lo que QUEDA: la cobrada, la que no se puede cambiar y el total de verdad', () => {
  const s = correr().queda;
  const r = s.prep.resumen ?? '';
  assert.match(r, /Cuotas: 10\/11\/2026 US\$ 500 \(cobrada\) · 10\/12\/2026 US\$ 700 · 10\/01\/2027 US\$ 500 \(queda como está\)\./, r);
  assert.match(r, /Total: US\$ 1\.700\. Ya cobrado: US\$ 500\./, 'decía US$2.100: lo pedido, no lo que queda');
  assert.match(r, /No se puede cambiar: Cuota 3: tiene un link sin pagar\./, 'el link se decía recién después del «sí»');
  // Y es lo que queda de verdad después del «sí».
  assert.deepEqual(s.pagos.map((q) => [q.monto_usd, q.pagado]), [[500, true], [700, false], [500, false]]);
});

test('11. N4 y B6: un anticipo sobre uno cobrado no se promete; dos «sí» a la vez no duplican ni contestan el error de la base', () => {
  const s = correr();
  assert.match(s.anticipoCobrado.error ?? '', /El anticipo de Ana ya está cobrado: no se pide otro/, 'prometía US$800 que no quedaban como deuda');
  assert.deepEqual(s.dosSi.dos.map((x) => x.ok).sort(), [false, true]);
  const segundo = s.dosSi.dos.find((x) => !x.ok)?.resumen ?? '';
  assert.doesNotMatch(segundo, /duplicate key|pagos_lead_numero/, segundo);
  assert.match(segundo, /Otro guardado del mismo plan llegó a la vez|El plan cambió/);
  assert.equal(s.dosSi.pagos.length, 3, 'duplicó cuotas');
});

test('12. N3: la migración 0347 deja la diferencia en la moneda de la cuota, con la misma firma (cualquier orden de despliegue)', () => {
  const sql = leer('supabase/migrations/0347_resto_en_la_moneda_de_la_cuota.sql').replace(/^\s*--.*$/gm, '');
  assert.match(sql, /create or replace function public\.cobrar_cuota_con_resto\(/);
  // La moneda pactada se lee ANTES de la toma, que la pisa con la del cobro.
  assert.ok(sql.indexOf('select moneda, monto_original into v_moneda, v_pactado') < sql.indexOf('update pagos set'), 'lee la moneda después de pisarla');
  assert.match(sql, /p_moneda is not null and upper\(p_moneda\) = upper\(v_moneda\)/);
  assert.match(sql, /v_resto_original := v_pactado - p_monto_original;/);
  assert.match(sql, /insert into pagos \(workspace_id, lead_id, numero, monto_usd, fecha_esperada, pagado, resto_de, moneda, monto_original\)\s*values \(p_ws, p_lead, v_numero, p_resto, p_vence, false, v_id, v_resto_moneda, v_resto_original\)/);
  // La toma, igual que la 0323 (el monto leído), y cerrada a la clave pública.
  assert.match(sql, /and \(p_original is null or monto_usd = p_original\)/);
  const firma = 'public\\.cobrar_cuota_con_resto\\(bigint, bigint, bigint, date, text, numeric, text, numeric, boolean, numeric, date, numeric\\)';
  assert.match(sql, new RegExp(`revoke execute on function ${firma} from public, anon, authenticated;`));
  assert.match(sql, new RegExp(`grant execute on function ${firma} to service_role;`));
});

test('13. B8: una cuota que cambió de monto o de moneda entre la propuesta y el «sí» (el mismo id) no se pisa', () => {
  const s = correr().firma;
  const vistas = s.vistas as Array<{ id: number; firma: string }>;
  assert.deepEqual(vistas.map((v) => v.id), [31, 32, 33], 'la propuesta no guarda lo que vio');
  assert.ok(vistas.every((v) => typeof v.firma === 'string' && v.firma.length > 0), 'sin la firma de cada cuota, un cambio con el mismo id pasa');
  assert.match(s.falta ?? '', /^yaNoVale: El plan de cuotas cambió desde que lo propuse \(cambió «Cuota 2»\): no guardé nada/, s.falta ?? '');
  assert.equal(s.ejec.ok, false, s.ejec.resumen);
  assert.deepEqual(s.pagos.map((q) => [q.numero, q.monto_usd, q.moneda, q.monto_original]), [[1, 500, null, null], [2, 900, 'MXN', 18000], [3, 500, null, null]], 'pisó los MXN 18.000 de la ficha');
});

test('14. B9: una propuesta sin las vistas con su firma (de antes) no se cumple con la regla vieja: se pide de nuevo', () => {
  const s = correr().deAntes;
  assert.equal(s.casos.length, 2);
  for (const c of s.casos) {
    assert.match(c.falta ?? '', /^yaNoVale: Esta propuesta es de una versión anterior de MaKo: no guardé nada/, c.falta ?? '');
    assert.equal(c.ejec.ok, false);
    assert.match(c.ejec.resumen, /versión anterior de MaKo/);
  }
  assert.deepEqual(s.pagos.map((q) => q.monto_usd), [500, 500, 500], 'una propuesta de antes escribió');
});

test('15. B10 y B11: el anticipo sobre un #0 cobrado sin su columna no se promete; la diferencia que queda aparte se nombra', () => {
  const s = correr();
  assert.match(s.carla.error ?? '', /El anticipo de Carla ya está cobrado: no se pide otro/, s.carla.resumen ?? '');
  const r = s.aparte.resumen ?? '';
  assert.match(r, /Total: US\$ 1\.250\. Ya cobrado: US\$ 250\. Aparte del plan queda sin cobrar: Cuota 4 US\$ 250 \(10\/11\/2026\)\./, r || (s.aparte.error ?? ''));
  assert.doesNotMatch(r, /La venta dice/, 'con lo de aparte, el plan y la venta dicen lo mismo (US$1.500)');
});

test('16. B12: el «sí» a una propuesta que ya no vale la cierra, y el «sí» pelado siguiente de WhatsApp no choca con ella', () => {
  const s = correr().cerrada;
  assert.match(s.viejo.error ?? '', /El plan de cuotas cambió desde que lo propuse \(apareció «Cuota 1»\)/, JSON.stringify(s.viejo));
  assert.doesNotMatch(JSON.stringify(s.nuevo), /aclara cuál/, 'la vieja seguía viva');
  assert.deepEqual(s.estados, ['error', 'ejecutada']);
  assert.deepEqual(s.pagos.map((q) => [q.numero, q.monto_usd, q.fecha_esperada]), [[1, 2500, '2026-10-28'], [2, 2500, '2026-11-28'], [3, 2500, '2026-12-28']]);
  assert.deepEqual(correr().red, [], 'nada sale a la red');
});
