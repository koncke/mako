// =============================================================================
// Quien deja de pagar su lugar en MaKo deja de entrar (17/10/2026)
// =============================================================================
// «Darse de baja corta el cobro pero no el acceso» y «una renovación de agencia sin autorizar no corta nada»
// (docs/hallazgos-planes-y-cobro.md, «Lo que quedó SIN hacer»): no existía el estado de suscripción por negocio.
// Ahora se DERIVA de los cobros de la plataforma (lib/plan-acceso-reglas.ts, puro: se ejecuta acá con datos), el cron
// de la pasarela pausa o reabre el negocio (lib/plan-acceso.ts) y un negocio pausado no se abre: ni la app
// (getWorkspaceActual → null, requireSesion → /cuenta-pausada) ni la API de MaKo (403). El cableado se lee del fuente.
//
// Probado rompiéndolo (17/10/2026; base 12 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · GRACIA_DIAS = 0 (se corta el mismo día que termina lo pagado)                         -> 10 / 2
//   · una suscripción cancelada cubre desde el PRIMER pago, no el último                    -> 11 / 1
//   · la activa no manda (se toma el fin más lejano aunque haya una al día)                -> 11 / 1
//   · la renovación de agencia autorizada se corta igual                                    -> 11 / 1
//   · pasoDeAcceso vuelve a cortar a quien reactivaron a mano por el mismo vencimiento       -> 11 / 1
//   · pasoDeAcceso reabre una pausa sin corte vigente (una pausa a mano)                    -> 11 / 1
//   · resolverDesdeCookies sin el chequeo de pausado                                         -> 11 / 1
//   · requireSesion sin el redirect a /cuenta-pausada                                        -> 11 / 1
//   · la API sin el 403 del negocio pausado                                                  -> 11 / 1
//   · cortar sin el compare-and-set sobre `activo`                                           -> 11 / 1
//   · el cron sin revisarAccesosPorPago                                                      -> 11 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DIAS_PARA_SUSPENDER, GRACIA_DIAS, TOLERANCIA_DIAS, finDeLoCubierto, leerCorte, pasoDeAcceso, textoDelCorte, unMesDespuesDe, vigenciaDelLugar,
  type CobroDelLugar, type CorteGuardado, type PagoDelLugar,
} from '../lib/plan-acceso-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');
const T = (fecha: string) => Date.parse(`${fecha}T12:00:00Z`);

const plan = (extra: Partial<CobroDelLugar> = {}): CobroDelLugar => ({
  id: 7, tipo: 'suscripcion', estado: 'pagado', suscripcion_estado: 'activa',
  pagado_at: '2026-08-10T15:00:00Z', reembolsado_at: null, inicio_at: null, created_at: '2026-08-10T14:00:00Z', ...extra,
});
const cuota = (fecha: string, cobro_id = 7): PagoDelLugar => ({ cobro_id, pagado: true, fecha_pago: fecha });

test('un mes después: el día se capa al último del mes', () => {
  assert.equal(unMesDespuesDe('2026-01-31'), '2026-02-28');
  assert.equal(unMesDespuesDe('2026-12-15'), '2027-01-15');
  assert.equal(unMesDespuesDe('2026-10-17T03:00:00Z'), '2026-11-17');
});

test('sin un cobro de la plataforma no hay nada que vencer: el ws1 y los acuerdos a mano nunca se cortan', () => {
  assert.deepEqual(vigenciaDelLugar([], [], T('2030-01-01')), { estado: 'sin-pasarela' });
});

test('una suscripción activa con su mes cobrado está al día, aunque haya cobros viejos cancelados', () => {
  const v = vigenciaDelLugar([plan({ id: 1, suscripcion_estado: 'cancelada' }), plan({ id: 2, pagado_at: '2026-12-20T10:00:00Z' })], [cuota('2026-08-10', 1), cuota('2026-12-20', 2)], T('2027-01-01'));
  assert.deepEqual(v, { estado: 'al-dia', cobroId: 2, hasta: '2027-01-20' });
});

test('dada de baja: lo usa hasta un mes después del ÚLTIMO pago, más la gracia', () => {
  const cobros = [plan({ suscripcion_estado: 'cancelada' })];
  const pagos = [cuota('2026-08-10'), cuota('2026-09-10')];
  assert.equal(GRACIA_DIAS, 5);
  const antes = vigenciaDelLugar(cobros, pagos, T('2026-10-14'));
  assert.deepEqual(antes, { estado: 'cubierto', cobroId: 7, hasta: '2026-10-10', motivo: 'baja' });
  assert.equal(vigenciaDelLugar(cobros, pagos, Date.parse('2026-10-14T23:59:00Z')).estado, 'cubierto', 'dentro de la gracia');
  assert.equal(vigenciaDelLugar(cobros, pagos, Date.parse('2026-10-15T00:00:00Z')).estado, 'vencido');
});

test('un plan devuelto no cubre nada: se corta desde la devolución (con la gracia)', () => {
  const v = vigenciaDelLugar([plan({ estado: 'reembolsado', suscripcion_estado: 'cancelada', reembolsado_at: '2026-10-01T10:00:00Z' })], [], T('2026-10-07'));
  assert.deepEqual(v, { estado: 'vencido', cobroId: 7, hasta: '2026-10-01', motivo: 'devuelto' });
});

test('cliente de agencia: la renovación sin autorizar corta cuando tenía que empezar a cobrar; autorizada, no', () => {
  const renov = plan({ id: 9, estado: 'pendiente', suscripcion_estado: null, pagado_at: null, inicio_at: '2026-11-03T15:00:00Z', cliente_ws: 40 });
  const primerMes: CobroDelLugar = plan({ id: 8, tipo: 'unico', suscripcion_estado: null, pagado_at: '2026-10-01T10:00:00Z', cliente_ws: 40 });
  assert.equal(vigenciaDelLugar([primerMes, renov], [], T('2026-11-05')).estado, 'cubierto');
  assert.deepEqual(vigenciaDelLugar([primerMes, renov], [], T('2026-11-08')), { estado: 'vencido', cobroId: 9, hasta: '2026-11-03', motivo: 'renovacion-sin-autorizar' });
  // La agencia la autorizó (Mercado Pago cobra el `inicio_at`): no se corta.
  assert.equal(vigenciaDelLugar([primerMes, { ...renov, suscripcion_estado: 'activa' }], [], T('2026-12-30')).estado, 'al-dia');
});

const corte = (extra: Partial<CorteGuardado> = {}): CorteGuardado => ({ cobroId: 7, hasta: '2026-10-10', motivo: 'baja', desde: '2026-10-15T00:30:00Z', vigente: true, ...extra });
const vencido = { estado: 'vencido' as const, cobroId: 7, hasta: '2026-10-10', motivo: 'baja' as const };

test('el paso: vencido y activo → cortar; ya pausado → nada', () => {
  assert.deepEqual(pasoDeAcceso(vencido, 'activo', null), { tipo: 'cortar', corte: { cobroId: 7, hasta: '2026-10-10', motivo: 'baja' } });
  assert.deepEqual(pasoDeAcceso(vencido, 'pausado', corte()), { tipo: 'nada' });
});

test('el paso: reactivado a mano por el MISMO vencimiento no se vuelve a cortar; uno nuevo, sí', () => {
  assert.deepEqual(pasoDeAcceso(vencido, 'activo', corte()), { tipo: 'soltar' }, 'se anota que alguien lo reactivó');
  assert.deepEqual(pasoDeAcceso(vencido, 'activo', corte({ vigente: false })), { tipo: 'nada' });
  assert.equal(pasoDeAcceso({ ...vencido, hasta: '2026-11-10' }, 'activo', corte({ vigente: false })).tipo, 'cortar');
});

test('el paso: pagó de nuevo → reabrir SÓLO lo que cortó el cobro; una pausa a mano no se toca', () => {
  assert.deepEqual(pasoDeAcceso({ estado: 'al-dia', cobroId: 8 }, 'pausado', corte()), { tipo: 'reabrir' });
  assert.deepEqual(pasoDeAcceso({ estado: 'al-dia', cobroId: 8 }, 'pausado', null), { tipo: 'nada' });
  assert.deepEqual(pasoDeAcceso({ estado: 'al-dia', cobroId: 8 }, 'pausado', corte({ vigente: false })), { tipo: 'nada' });
});

test('la pantalla dice por qué y qué hacer', () => {
  assert.equal(textoDelCorte(null).titulo, 'Tu cuenta está pausada');
  assert.match(textoDelCorte(corte()).detalle, /10\/10\/2026/);
  assert.match(textoDelCorte(corte({ motivo: 'renovacion-sin-autorizar' })).detalle, /agencia/);
});

test('un negocio pausado no se abre: ni la app ni la API (el super admin, sí)', () => {
  const ws = fuente('lib/workspace.ts');
  // Lo primero que se mira del negocio propio es si está pausado (después viene el corte de la API por plan, lib/api-tab.ts).
  assert.match(ws, /const propio = await wsPropioDeLaSesion\(\);\s*if \(propio != null && \(await negocioPausado\(propio\)\)\) return null;/);
  assert.match(ws, /if \(!sesion \|\| sesion\.legacy \|\| sesion\.rol === 'admin'\) return null;/, 'el super admin no pasa por el corte');
  assert.match(fuente('lib/tab-access.ts'), /if \(\(await negocioPausadoDeLaSesion\(\)\) != null\) redirect\('\/cuenta-pausada'\);/);
  // El pausado se pregunta por el negocio en el que CORRE el pedido: el del token, o el cliente que nombra un token de
  // agencia (6/11/2026). `ws` arranca en el del token y sólo lo cambia la rama de la cartera.
  const http = fuente('lib/api-mako/http.ts');
  assert.match(http, /let ws = r\.ws;/);
  assert.match(http, /if \(await negocioPausado\(ws\)\) return errorJson\(403,/);
});

test('el cron pausa con compare-and-set y con tope, y reabre lo que cortó', () => {
  const p = fuente('lib/plan-acceso.ts');
  assert.match(p, /\.update\(\{ estado: 'pausado', updated_at: ahora \}\)\.eq\('id', ws\)\.eq\('estado', 'activo'\)/);
  assert.match(p, /if \(paso\.tipo === 'cortar' && out\.cortados\.length >= TOPE_POR_CORRIDA\)/);
  assert.match(p, /if \(!Number\.isFinite\(ws\) \|\| ws === plataforma\) continue;/, 'la plataforma no se corta nunca');
  assert.match(fuente('app/api/cron/cobros-reconciliar/route.ts'), /accesos = await revisarAccesosPorPago\(\)\.catch\(/);
});

// La agencia que miraba a un cliente pausado: la pantalla le habla a ELLA (activar SU renovación) y le da la salida a
// /partners. Probado rompiéndolo: sin la rama `paraAgencia` → 1 fallo (éste).
test('a la agencia que mira un cliente pausado, la pantalla le dice qué hacer ella y le da la salida', () => {
  const r = textoDelCorte(corte({ motivo: 'renovacion-sin-autorizar' }), { paraAgencia: true });
  assert.match(r.detalle, /MaKo Partners/);
  assert.equal(textoDelCorte(null, { paraAgencia: true }).titulo, 'Este cliente está pausado');
  const p = fuente('app/cuenta-pausada/page.tsx');
  assert.match(p, /const esAgencia = cliente != null;/);
  assert.match(fuente('app/cuenta-pausada/SalirDeLaCuenta.tsx'), /fetch\('\/api\/agencia\/entrar', \{ method: 'DELETE' \}\)[^\n]*window\.location\.href = '\/agency'/);
});

// La revisión adversarial del 17/10 frenó el corte de acceso (el cron sólo ve `alta_ws`; un pago devuelto con la
// suscripción activa pausa a quien paga; las cuotas sin paginar): queda APAGADO hasta su arreglo y su revisión.
test('el corte de acceso por falta de pago está APAGADO: el cron no toca nada y un pausado se abre como siempre', () => {
  assert.match(fuente('lib/plan-acceso-reglas.ts'), /export const CORTE_DE_ACCESO_PRENDIDO: boolean = false;/);
  // ⚠️ 29/10/2026: SALVO la cuenta que su agencia dio de baja (el corte `sin-agencia`, tests/agencia-baja.test.ts): el cron
  // sólo la mira a ella, nunca corta por el cobro, y un pausado sin ese corte se abre como siempre.
  const acceso = fuente('lib/plan-acceso.ts');
  assert.match(acceso, /const sinAgencia = CORTE_DE_ACCESO_PRENDIDO \? null : await cuentasSinAgencia\(opts\.soloWs\);\n\s*if \(sinAgencia && !sinAgencia\.size\) return out;/);
  assert.match(acceso, /if \(sinAgencia && paso\.tipo === 'cortar'\) continue;/);
  // ⚠️ 6/11/2026: y «Paga para entrar» (la mensualidad de una agencia, lib/agencia-mes.ts), que también vale con el corte
  // apagado. El guard ya no fija la línea de al lado: afirma lo que cuida, en asserts separados.
  const ws = fuente('lib/workspace.ts');
  const cuerpo = ws.slice(ws.indexOf('export const negocioPausado'), ws.indexOf('const corteDelNegocio'));
  assert.ok(cuerpo.length > 100, 'encontré negocioPausado');
  assert.match(cuerpo, /if \(corte\?\.motivo === 'sin-agencia' && corte\.vigente\) return !\(Date\.parse\(corte\.desde\) > Date\.now\(\)\);/, 'la cuenta que su agencia soltó');
  assert.match(cuerpo, /if \(corte\?\.motivo === 'paga-para-entrar' && corte\.vigente\) return true;/, '«Paga para entrar», sólo vigente');
  // Lo demás —un pausado sin corte, o con otro motivo— se abre como siempre: después de esas dos, sólo queda el interruptor.
  assert.deepEqual([...cuerpo.matchAll(/return ([^;]+);/g)].map((m) => m[1]), ['false', '!(Date.parse(corte.desde) > Date.now())', 'true', 'CORTE_DE_ACCESO_PRENDIDO']);
});

// =============================================================================
// LA DEUDA (23/10/2026): «si alguien no paga que se le expulse de la app... le tiene que quedar una deuda pendiente».
// Probado rompiéndolo (23/10/2026; base 20 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · DIAS_SIN_AVISO = 0 (la renovación que tarda un día ya es mora)                     -> 19 / 1
//   · la baja pedida sigue «cobrando» (deuda a quien se dio de baja)                       -> 19 / 1
//   · sin la tolerancia: el reintento tardío corre la fecha                               -> 18 / 2
//   · un cobro único de deuda vale 1 mes aunque diga 2                                     -> 19 / 1
//   · la suscripción activa con el primer pago devuelto ya no «cobra» (pausa a quien paga) -> 19 / 1
//   · sin la mora: se pausa el mismo día que vence                                        -> 18 / 2
//   · el cron corta por impago sin preguntarle a la pasarela                              -> 19 / 1
//   · el cliente de agencia pasa por la cobertura nueva (su mes es desde el onboarding)    -> 19 / 1
// =============================================================================

const FALLIDA = { motivo: 'Falló el cobro de la renovación: la tarjeta fue rechazada' };
const sus = (extra: Partial<CobroDelLugar> = {}) => plan({ monto: 47, moneda: 'USD', monto_usd: 47, ...FALLIDA, ...extra });

test('la renovación que no entró: 2 días sin aviso, después MORA (se entra), y a los 7 días VENCIDO por impago, con la deuda', () => {
  const cobros = [sus()];
  const pagos = [cuota('2026-08-10'), cuota('2026-09-10')]; // cubre hasta el 10/10
  assert.equal(DIAS_PARA_SUSPENDER, 7);
  assert.equal(vigenciaDelLugar(cobros, pagos, T('2026-10-09')).estado, 'al-dia', 'antes del día de la renovación');
  // ⚠️ SIN EL AVISO DE LA PASARELA NO HAY MORA, aunque pasen meses (revisión del 23/10: la cadena daba mora a quien pagaba).
  assert.equal(vigenciaDelLugar([sus({ motivo: null })], pagos, T('2027-03-01')).estado, 'al-dia');
  const m = vigenciaDelLugar(cobros, pagos, T('2026-10-13'));
  assert.equal(m.estado, 'mora');
  assert.deepEqual(m.estado === 'mora' && m.deuda, { cobroId: 7, ciclos: 1, desde: '2026-10-10', monto: 47, moneda: 'USD', montoUsd: 47 });
  const v = vigenciaDelLugar(cobros, pagos, T('2026-10-17'));
  assert.equal(v.estado, 'vencido');
  assert.equal(v.estado === 'vencido' && v.motivo, 'impago');
  // Dos meses sin pagar: la deuda son dos ciclos.
  const dos = vigenciaDelLugar(cobros, pagos, T('2026-11-15'));
  assert.equal(dos.estado === 'vencido' && dos.deuda?.ciclos, 2);
  assert.equal(dos.estado === 'vencido' && dos.deuda?.monto, 94);
});

test('el reintento que entra tarde paga el período que se debía (sin correr la fecha); quien vuelve meses después empieza de nuevo', () => {
  const cobros = [sus()];
  // Pagó el 10/08 y la renovación del 10/09 entró recién el 16/09 (un reintento): cubre hasta el 10/10, no el 16/10.
  assert.equal(finDeLoCubierto(cobros, [cuota('2026-08-10'), cuota('2026-09-16')])?.hasta, '2026-10-10');
  // Volvió en febrero (más de TOLERANCIA_DIAS después): su mes empieza el día que pagó.
  assert.equal(TOLERANCIA_DIAS, 62);
  assert.equal(finDeLoCubierto(cobros, [cuota('2026-08-10'), cuota('2027-02-03')])?.hasta, '2027-03-03');
});

test('la deuda pagada con un cobro único de N meses vuelve a cubrir; un reembolso con la suscripción activa NO corta', () => {
  const deuda: CobroDelLugar = plan({ id: 20, tipo: 'unico', suscripcion_estado: null, meses: 2, pagado_at: '2026-11-20T10:00:00Z' });
  const cobros = [sus(), deuda];
  const pagos = [cuota('2026-08-10'), cuota('2026-09-10'), cuota('2026-11-20', 20)];
  assert.equal(finDeLoCubierto(cobros, pagos)?.hasta, '2026-12-10', 'los dos meses debidos, desde el 10/10');
  assert.equal(vigenciaDelLugar(cobros, pagos, T('2026-11-21')).estado, 'al-dia');
  // El primer pago se devolvió pero la pasarela sigue cobrando: no se pausa a quien paga (revisión del 17/10).
  const devuelto = [sus({ estado: 'reembolsado', reembolsado_at: '2026-08-12T10:00:00Z', motivo: null })];
  assert.equal(vigenciaDelLugar(devuelto, [], T('2026-08-20')).estado, 'al-dia');
});

test('con la baja pedida la suscripción deja de «cobrar»: no hay deuda, termina con la gracia de una baja', () => {
  const cobros = [plan({ monto: 47, moneda: 'USD', monto_usd: 47, motivo: 'Baja pedida el 2026-09-20 (código BAJA-7). Deja de cobrarse el 2026-10-10.' })];
  const pagos = [cuota('2026-08-10'), cuota('2026-09-10')];
  const v = vigenciaDelLugar(cobros, pagos, T('2026-10-13'));
  assert.deepEqual(v, { estado: 'cubierto', cobroId: 7, hasta: '2026-10-10', motivo: 'baja' });
});

test('el corte guarda la deuda y la pantalla dice que los datos están guardados', () => {
  const v = vigenciaDelLugar([sus()], [cuota('2026-08-10'), cuota('2026-09-10')], T('2026-10-20'));
  const p = pasoDeAcceso(v, 'activo', null);
  assert.equal(p.tipo, 'cortar');
  assert.equal(p.tipo === 'cortar' && p.corte.deuda?.ciclos, 1);
  const leido = leerCorte(JSON.stringify({ ...(p.tipo === 'cortar' ? p.corte : {}), desde: 'x', vigente: true }));
  assert.equal(leido?.deuda?.monto, 47);
  assert.match(textoDelCorte(leido).detalle, /datos están guardados/);
  // En mora no se corta (se sigue entrando).
  assert.deepEqual(pasoDeAcceso(vigenciaDelLugar([sus()], [cuota('2026-08-10'), cuota('2026-09-10')], T('2026-10-13')), 'activo', null), { tipo: 'nada' });
});

test('el cron: antes de pausar por impago le pregunta a la pasarela, lee las cuotas de a tandas y ata la compra de quien ya tenía cuenta', () => {
  const p = fuente('lib/plan-acceso.ts');
  assert.match(p, /if \(paso\.tipo === 'cortar' && paso\.corte\.motivo === 'impago'\) \{[\s\S]*?confirmarImpago\(c, \{ reparar: !enSeco && opts\.soloWs == null \}\)[\s\S]*?if \(r !== 'impago'\) \{ out\.noCortados\.push/);
  assert.match(p, /\.range\(desde, desde \+ 999\)/);
  assert.doesNotMatch(p, /\.eq\('alta_estado', 'ya_tenia_cuenta'\)/, 'una compra NUNCA se ata sola a un negocio por el email (alta 5)');
  const d = fuente('lib/plan-deuda.ts');
  assert.match(d, /const faltan = deSuscripcion\.filter\(\(x\) => !ya\.has\(x\.id\)\);/, 'sólo se asientan los pagos que no estaban');
  assert.match(d, /if \(!f\.ok\) return \{ tipo: 'nada'/, 'si Stripe no contesta, no se abre un cobro aparte');
});

// La PAUSA de un mes gratis (la retención del Esencial, docs/ofertas-mako.md): ese mes está cubierto, no es deuda.
// Probado rompiéndolo: sin sumar los `extras` en la cobertura -> 1 fallo (éste).
test('el mes pausado de la retención cuenta como cubierto: no hay mora', () => {
  const cobros = [sus()];
  const pagos = [cuota('2026-08-10'), cuota('2026-09-10')]; // cubre hasta el 10/10
  assert.equal(vigenciaDelLugar(cobros, pagos, T('2026-10-20')).estado, 'vencido', 'sin la pausa, impago');
  const v = vigenciaDelLugar(cobros, pagos, T('2026-10-20'), [{ fecha: '2026-09-25', meses: 1 }]);
  assert.deepEqual(v, { estado: 'al-dia', cobroId: 7, hasta: '2026-11-10' });
});

// Revisión adversarial del 23/10 (alta 6): un negocio SIN ninguna suscripción (los planes de pago único que vende /admin/cobros)
// no vence (sigue con las reglas del 17/10). Y la suscripción que la pasarela dio de baja por falta de pago es un impago.
// Probado rompiéndolo: sin el `!cobros.some(tipo suscripcion)` del despacho -> 1 fallo; sin la rama del impago dado de baja -> 1 fallo.
test('un plan de pago único no vence; una suscripción dada de baja por falta de pago es un impago con su deuda', () => {
  const unico: CobroDelLugar = plan({ id: 30, tipo: 'unico', suscripcion_estado: null, pagado_at: '2026-08-10T10:00:00Z' });
  assert.deepEqual(vigenciaDelLugar([unico], [cuota('2026-08-10', 30)], T('2027-01-01')), { estado: 'sin-pasarela' });
  const baja = sus({ suscripcion_estado: 'cancelada' });
  const v = vigenciaDelLugar([baja], [cuota('2026-08-10'), cuota('2026-09-10')], T('2026-10-20'));
  assert.equal(v.estado, 'vencido');
  assert.equal(v.estado === 'vencido' && v.motivo, 'impago');
  assert.equal(v.estado === 'vencido' && v.deuda?.ciclos, 1);
});
