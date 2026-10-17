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
  GRACIA_DIAS, pasoDeAcceso, textoDelCorte, unMesDespuesDe, vigenciaDelLugar,
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

test('una suscripción activa y pagada está al día, aunque haya cobros viejos cancelados', () => {
  const v = vigenciaDelLugar([plan({ id: 1, suscripcion_estado: 'cancelada' }), plan({ id: 2 })], [cuota('2026-08-10', 1)], T('2027-01-01'));
  assert.deepEqual(v, { estado: 'al-dia', cobroId: 2 });
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
  const renov = plan({ id: 9, estado: 'pendiente', suscripcion_estado: null, pagado_at: null, inicio_at: '2026-11-03T15:00:00Z' });
  const primerMes: CobroDelLugar = plan({ id: 8, tipo: 'unico', suscripcion_estado: null, pagado_at: '2026-10-01T10:00:00Z' });
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
  assert.match(fuente('lib/api-mako/http.ts'), /if \(await negocioPausado\(r\.ws\)\) return errorJson\(403,/);
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
  assert.match(fuente('app/cuenta-pausada/SalirDeLaCuenta.tsx'), /fetch\('\/api\/agencia\/entrar', \{ method: 'DELETE' \}\)[^\n]*window\.location\.href = '\/partners'/);
});
