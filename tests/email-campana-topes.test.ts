// =============================================================================
// Los topes, la rampa y el freno del email (4/11/2026, punto 7 de la campaña de email de Mauricio)
// =============================================================================
// Mauricio va a mandar 14 emails a 1.128 personas desde un dominio recién conectado. Lo que se pidió:
//   · leer y cambiar los topes de envío por la API (`ver_limites_envio`, `cambiar_limites_envio`);
//   · una rampa del email, por defecto 50 el primer día y 50 más cada día que llega a su tope (lib/goteo.ts, `topeConRampa`);
//   · un freno: en 24 h con 50 enviados o más, rebotes de 5 % o quejas de 0,3 % apagan el envío y avisan (lib/email-freno.ts);
//   · al activar, cuántos días tarda: a 100 por día, 14 × 1.128 son 15.792 envíos y el segundo email le llega a cada
//     persona ~11 días después del primero, no a las 24 h (lib/ritmo-al-activar.ts).
//
// Lo puro corre acá; el motor real, la ruta real del webhook de Resend y los runners, en tests/_email-campana-hijo.ts
// (escenario «topes») sobre una base en memoria. Nada sale a la red.
//
// Probado ROMPIÉNDOLO (4/11/2026), sobre una base de 9 / 0 (10 / 0 con la respuesta de activar; sin el ritmo en
// `nutricion_toggle` → 9 / 1): el motor sin la rampa (el tope de la línea) → 7 / 2; el webhook
// sin el freno al rebotar → 8 / 1; el freno con «>» en vez de «>=» en rebotes → 8 / 1; sin el mínimo de 50 enviados → 8 / 1;
// el aviso sin la campaña entera → 7 / 2; un rebote temporal tomado como permanente → 8 / 1. Restaurado, 9 / 0.
// La rampa del número (5/11/2026), sobre 11 / 0: `cambiar_limites_envio` sin los parámetros de la rampa → 10 / 1; `ver_limites_envio`
// con el tope de la línea en vez del de hoy → 10 / 1.
//
// Correr: node --import tsx --test tests/email-campana-topes.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { topeConRampa } from '../lib/goteo';
import { conteoDeLosUltimos, decidirFrenoEmail, desdeDelFreno, textoDelFreno } from '../lib/email-freno';
import { avisoDeRitmo } from '../lib/ritmo-al-activar';
import { LIMITES_CONSTANTES } from '../lib/limites-envio';

const RAIZ = join(import.meta.dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_email-campana-hijo.ts'), 'topes'], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 180_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('la rampa: 50 el primer día, sube 50 cada día que llegó a su tope, y un hueco largo vuelve a empezar', () => {
  const email = LIMITES_CONSTANTES.email;
  assert.deepEqual([email.arranqueDia, email.arranqueSube, email.dia], [50, 50, 100], 'lo de fábrica');
  const dias = (o: Record<string, number>) => new Map(Object.entries(o));
  assert.equal(topeConRampa(email, dias({}), '2026-11-04'), 50, 'dominio nuevo');
  assert.equal(topeConRampa(email, dias({ '2026-11-03': 50 }), '2026-11-04'), 100, 'ayer llegó a 50');
  assert.equal(topeConRampa(email, dias({ '2026-11-03': 30 }), '2026-11-04'), 50, 'ayer no llegó: no sube');
  assert.equal(topeConRampa(email, dias({ '2026-10-20': 50, '2026-10-21': 100 }), '2026-11-04'), 50, 'dos semanas sin mandar: vuelve a empezar');
  assert.equal(topeConRampa({ ...email, arranqueDia: 100 }, dias({}), '2026-11-04'), 100, 'sin rampa, el tope');
});

test('el freno: desde 50 enviados, rebotes de 5 % o quejas de 0,3 %', () => {
  assert.deepEqual(decidirFrenoEmail({ enviados: 49, rebotes: 20, quejas: 5 }), { frena: false }, 'con menos de 50 no dice nada del dominio');
  assert.deepEqual(decidirFrenoEmail({ enviados: 50, rebotes: 2, quejas: 0 }), { frena: false }, '4 %');
  const r = decidirFrenoEmail({ enviados: 60, rebotes: 3, quejas: 0 });
  assert.equal(r.frena && r.motivo, 'rebotes', '5 %');
  assert.equal(decidirFrenoEmail({ enviados: 1000, rebotes: 0, quejas: 2 }).frena, false, '0,2 %');
  const q = decidirFrenoEmail({ enviados: 1000, rebotes: 0, quejas: 3 });
  assert.equal(q.frena && q.motivo, 'quejas', '0,3 %');
  if (r.frena) assert.match(textoDelFreno(r, { enviados: 60, rebotes: 3, quejas: 0 }), /^Apagué el envío de email: de los últimos 60 emails, 3 rebotaron/);
});

// Ticket #76 (10/11/2026): el freno apagó el email de Mauricio a las 9:01 con «3 de 52». Ayer Piloto A mandó 100 entre las
// 17:00:32 y las 17:02:34 UTC (rebotes a las 17:01:12, 17:02:11 y 17:02:18); hoy Piloto B arrancó a las 17:01:10 y su primer
// rebote llegó con el 7.º envío. Con «las últimas 24 h», la ventana tenía la COLA de Piloto A (con 2 de sus 3 rebotes) y 7 de B.
const ENVIO_A = Date.parse('2026-11-09T17:00:32Z');
const ENVIO_B = Date.parse('2026-11-10T17:01:10Z');
const enviosDeMauricio = (hastaB: number): Array<{ created_at: string; rebotado_at: string | null }> => {
  const a = Array.from({ length: 100 }, (_, i) => ENVIO_A + i * 1220);
  const cerca = (t: number) => a.reduce((m, x) => (Math.abs(x - t) < Math.abs(m - t) ? x : m));
  const reboteA = new Set(['2026-11-09T17:01:12Z', '2026-11-09T17:02:11Z', '2026-11-09T17:02:18Z'].map((s) => cerca(Date.parse(s))));
  const b = Array.from({ length: hastaB }, (_, i) => ENVIO_B + i * 4500);
  return [
    ...a.map((t) => ({ created_at: new Date(t).toISOString(), rebotado_at: reboteA.has(t) ? new Date(t).toISOString() : null })),
    ...b.map((t, i) => ({ created_at: new Date(t).toISOString(), rebotado_at: i === 6 || i === 40 ? new Date(t).toISOString() : null })),
  ];
};

test('el freno mira los últimos 100 envíos: no apaga un envío partido por el borde de las 24 h (ticket #76)', () => {
  const filas = enviosDeMauricio(7);
  const ahora = ENVIO_B + 6 * 4500 + 1000;
  // Lo de antes, para que se vea por qué apagó: lo de las últimas 24 h.
  const enLas24h = filas.filter((f) => Date.parse(f.created_at) >= ahora - 86_400_000);
  const antes = { enviados: enLas24h.length, rebotes: enLas24h.filter((f) => f.rebotado_at).length, quejas: 0 };
  assert.equal(decidirFrenoEmail(antes).frena, true, `con 24 h: ${antes.rebotes} de ${antes.enviados}`);
  // Ahora: los últimos 100 (93 de Piloto A y 7 de B, con 4 rebotes): 4 %.
  const c = conteoDeLosUltimos(filas);
  assert.deepEqual(c, { enviados: 100, rebotes: 4, quejas: 0 });
  assert.equal(decidirFrenoEmail(c).frena, false, '4 de 100');
  // Piloto B entero (78, con 2 rebotes) tampoco: los últimos 100 son 22 de A y los 78 de B.
  assert.equal(decidirFrenoEmail(conteoDeLosUltimos(enviosDeMauricio(78))).frena, false);
  // Y una lista mala sí: 6 rebotes en los últimos 100.
  const mala = Array.from({ length: 120 }, (_, i) => ({ created_at: new Date(ENVIO_B + i * 1000).toISOString(), rebotado_at: i >= 114 ? 'x' : null }));
  assert.deepEqual(decidirFrenoEmail(conteoDeLosUltimos(mala)), { frena: true, motivo: 'rebotes', porcentaje: 6 });
  // Dos tablas con 100 cada una no suman 200: se cortan los 100 más nuevos.
  assert.equal(conteoDeLosUltimos([...mala, ...filas]).enviados, 100);
});

test('el freno cuenta desde que una persona prendió el envío, y si no, 7 días', () => {
  const ahora = Date.parse('2026-11-10T22:00:00Z');
  assert.equal(desdeDelFreno(ahora, '2026-11-10T20:49:53.563Z'), '2026-11-10T20:49:53.563Z', 'lo prendió Mauricio a las 12:49');
  assert.equal(desdeDelFreno(ahora, null), '2026-11-03T22:00:00.000Z', 'sin la setting: 7 días');
  assert.equal(desdeDelFreno(ahora, '2026-10-01T00:00:00Z'), '2026-11-03T22:00:00.000Z', 'prendido hace un mes: 7 días');
  assert.equal(desdeDelFreno(ahora, 'no-es-fecha'), '2026-11-03T22:00:00.000Z');
});

test('al activar la campaña de Mauricio se dice cuánto tarda de verdad: 15.792 envíos y ~11 días entre email y email', () => {
  const a = avisoDeRitmo({
    personas: 1128, canal: 'email', goteo: null, horario: null, emailsDelFlujo: 14,
    topes: { wa: { dia: 40, hora: 6 }, email: { dia: 100, rampa: { dia: 50, sube: 50 } } },
  });
  assert.ok(a);
  // Con el formato de México (es-MX): miles con coma.
  assert.match(a!.texto, /Son hasta 15,792 emails \(1,128 personas × 14\)/);
  assert.match(a!.texto, /la campaña entera tarda al menos 158 días/);
  assert.match(a!.texto, /Cada persona recibe el email siguiente al menos 11 días después del anterior/);
  assert.match(a!.texto, /Tu dominio arranca hoy con 50 emails y sube 50/);
  // Con un solo email no hay campaña que decir.
  const uno = avisoDeRitmo({ personas: 1128, canal: 'email', goteo: null, horario: null, emailsDelFlujo: 1, topes: { wa: { dia: 40, hora: 6 }, email: { dia: 100 } } });
  assert.doesNotMatch(uno!.texto, /Son hasta/);
});

test('el aviso al activar del motor cuenta a los que entran y la campaña entera', () => {
  assert.match(R.ritmo.texto, /^Entran 60 personas/);
  assert.match(R.ritmo.texto, /hasta 50 por día/, 'hoy frena la rampa, no el tope de 100');
  assert.match(R.ritmo.texto, /Son hasta 840 emails \(60 personas × 14\)\. A ese ritmo, la campaña entera tarda al menos 8 días\./);
});

test('la respuesta de ACTIVAR (la del token detallado, que se aplica en el acto) dice el ritmo', () => {
  assert.equal(R.activar.ok, true);
  assert.match(R.activar.resumen, /activada\. Entran 60 personas/);
  assert.match(R.activar.resumen, /Son hasta 840 emails/);
});

test('el motor respeta la rampa: el primer día salen 50 de 60', () => {
  assert.equal(R.verAntes.email.tope_de_hoy, 50);
  assert.equal(R.run1.enviados, 50);
  assert.equal(R.emails1, 50);
  assert.equal(R.run1.topeEmail, 10, 'las otras 10 esperan');
});

test('el freno por el webhook: un rebote temporal no cuenta; al tercero permanente (6 %) se apaga el envío y se avisa', () => {
  assert.equal(R.temporal.status, 200);
  assert.deepEqual(R.trasTemporal, { envio: 'true', baja: null }, 'el temporal no da de baja ni cuenta');
  assert.equal(R.trasDos, 'true', '2 de 50 = 4 %');
  assert.equal(R.tercero.status, 200, 'el webhook sigue contestando 200');
  assert.equal(R.trasTres, 'false', '3 de 50 = 6 %');
  assert.equal(R.rebotados, 3);
  assert.equal(R.bajas, 3);
  assert.deepEqual(R.avisos.map((a: { titulo: string }) => a.titulo), ['Apagué el envío de email']);
  assert.equal(R.verDespues.email.envio_prendido, false);
  assert.deepEqual(R.verDespues.email.freno.ultimos_envios, { enviados: 50, rebotes: 3, quejas: 0 });
});

test('cambiar los topes por la API: fuera de rango no; adentro guarda sólo lo que difiere; restaurar vuelve a fábrica', () => {
  assert.match(R.cambiarMal.error, /Email por día: entre 1 y 500/);
  assert.match(R.cambiarNada.error, /No dice qué cambiar/);
  assert.equal(R.ejecCambiar.ok, true);
  assert.deepEqual(JSON.parse(R.limitesGuardados), { email: { dia: 200, arranqueDia: 40 } });
  assert.equal(R.limitesRestaurados, '{}');
});

test('ver los topes dice la regla del freno y la rampa', () => {
  assert.deepEqual(R.verAntes.email.rampa.primer_dia, 50);
  assert.match(R.verAntes.email.freno.regla, /últimos 100 emails enviados .*con 50 o más/);
  assert.equal(R.verAntes.whatsapp.por_dia, 40);
  // La rampa del número (5/11/2026): un negocio que no mandó ningún WhatsApp arranca hoy en 20.
  assert.equal(R.verAntes.whatsapp.tope_de_hoy, 20);
  assert.deepEqual([R.verAntes.whatsapp.rampa.primer_dia, R.verAntes.whatsapp.rampa.sube_por_dia], [20, 20]);
  assert.deepEqual([R.verAntes.de_fabrica.whatsapp_rampa_primer_dia, R.verAntes.de_fabrica.whatsapp_rampa_sube], [20, 20]);
});

test('cambiar la rampa del número por la API: se propone con sus dos parámetros, y fuera de rango no', () => {
  assert.match(R.cambiarWa.resumen, /la rampa del número arranca con: 10 · y sube por día: 15/);
  assert.deepEqual([R.cambiarWa.payload.limites.wa.arranqueDia, R.cambiarWa.payload.limites.wa.arranqueSube], [10, 15]);
  assert.match(R.cambiarWaMal.error, /WhatsApp, cuánto sube por día: entre 1 y 150/);
});

test('nada salió a la red', () => {
  assert.deepEqual(R.otros, []);
});
