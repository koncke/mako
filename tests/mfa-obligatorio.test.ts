// =============================================================================
// El 2FA obligatorio para todos, con plazo (14/10/2026)
// =============================================================================
// Pedido de Martín (vía «Estrategia 3 cuentas»): el 2FA obligatorio para TODOS, con plazo al
// 21/10 a las 24:00 en la hora de cada negocio, y «al que no lo configuró se lo desloguea». Se
// armó con el chat de Automations: el circuito (avisos, recordatorios) es de ellos; la regla, de
// Ciberseguridad. «Desloguear» quedó como EXIGIR: una FECHA en el negocio
// (`workspaces.mfa_obligatorio_desde`) que `requiereSegundoFactor` calcula en cada pedido, así
// que no hay una acción a la hora del corte que se pueda disparar dos veces ni alcanzar a quien
// ya lo tiene.
//
// Lo que se fija:
//   · la regla pura (antes y después de la fecha, admin, quien ya lo tiene, una fecha rota);
//   · el instante del plazo en cuatro zonas reales, con el 24:00 y un día de cambio de horario;
//   · que el login, la sesión de cada pedido y Seguridad usen la fecha (fuente);
//   · que la acción sea SÓLO de la plataforma: en el gating y otra vez en preparar y ejecutar.
//
// Probado ROMPIÉNDOLO (14/10/2026), una rotura por vez y restaurando de memoria. Los números,
// en ROTURAS al final.
//
// Correr: node --import tsx --test tests/mfa-obligatorio.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  requiereSegundoFactor, exigidoYa, politicaLoExige, instanteDelPlazo, decidirTrasGoogle,
} from '../lib/mfa-reglas';
import { REGISTRO, gatingOk } from '../lib/api-mako/registro';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const CORTE = '2026-10-22T07:00:00.000Z';
const ANTES = Date.parse('2026-10-22T06:59:59.000Z');
const DESPUES = Date.parse('2026-10-22T07:00:00.000Z');

test('la regla: sin fecha nada cambia; pasada la fecha, sin un factor no hay sesión', () => {
  // Lo de siempre, intacto.
  assert.equal(requiereSegundoFactor('admin', false), true);
  assert.equal(requiereSegundoFactor('usuario', false), false);
  assert.equal(requiereSegundoFactor('usuario', true), true);
  // El negocio lo exige desde el corte.
  assert.equal(requiereSegundoFactor('usuario', false, CORTE, ANTES), false, 'exige antes de la hora');
  assert.equal(requiereSegundoFactor('usuario', false, CORTE, DESPUES), true, 'no exige al llegar la hora');
  assert.equal(requiereSegundoFactor('usuario', false, null, DESPUES), false);
  // Una fecha que no se entiende NO exige (dejar afuera a un negocio entero por un dato roto es peor).
  assert.equal(exigidoYa('no-es-fecha', DESPUES), false);
  assert.equal(exigidoYa('', DESPUES), false);
});

test('después de Google: pasada la fecha, quien no tiene un factor va al segundo paso (a activarlo)', () => {
  const base = { rol: 'usuario', mfaActivo: false, tieneFila: true, dispositivoValido: false };
  assert.equal(decidirTrasGoogle({ ...base, obligatorioDesde: CORTE, ahora: ANTES }), 'sesion');
  assert.equal(decidirTrasGoogle({ ...base, obligatorioDesde: CORTE, ahora: DESPUES }), 'segundo-factor');
  assert.equal(decidirTrasGoogle({ ...base }), 'sesion', 'sin fecha, como siempre');
});

test('la política: el último método no se quita si el negocio lo exige, aunque la fecha no llegó', () => {
  assert.equal(politicaLoExige('admin', null), true);
  assert.equal(politicaLoExige('usuario', CORTE), true);
  assert.equal(politicaLoExige('usuario', null), false);
});

test('el instante del plazo: «el 21/10 a las 24:00» en la hora de cada negocio de hoy', () => {
  // Las cuatro zonas que hay en producción (medido el 14/10/2026).
  assert.equal(instanteDelPlazo('America/Tijuana', '2026-10-21', '24:00')?.toISOString(), '2026-10-22T07:00:00.000Z');
  assert.equal(instanteDelPlazo('America/Cancun', '2026-10-21', '24:00')?.toISOString(), '2026-10-22T05:00:00.000Z');
  assert.equal(instanteDelPlazo('America/Argentina/Buenos_Aires', '2026-10-21', '24:00')?.toISOString(), '2026-10-22T03:00:00.000Z');
  assert.equal(instanteDelPlazo('Europe/Madrid', '2026-10-21', '24:00')?.toISOString(), '2026-10-21T22:00:00.000Z');
  // 24:00 es el final del día: lo mismo que las 00:00 del siguiente, también a fin de mes.
  assert.equal(instanteDelPlazo('UTC', '2026-10-31', '24:00')?.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(instanteDelPlazo('UTC', '2026-10-21', '12:00')?.toISOString(), '2026-10-21T12:00:00.000Z');
  // El día del cambio de horario en Tijuana (8/3/2026): con una sola pasada sale una hora corrida.
  assert.equal(instanteDelPlazo('America/Tijuana', '2026-03-08', '09:00')?.toISOString(), '2026-03-08T16:00:00.000Z');
  // Lo que no es un día o una hora.
  for (const [f, h] of [['2026-02-31', '10:00'], ['2026-10-21', '25:00'], ['2026-10-21', '24:30'], ['21/10/2026', '24:00'], ['2026-10-21', '9']]) {
    assert.equal(instanteDelPlazo('UTC', f, h), null, `${f} ${h}`);
  }
});

test('el login, la sesión y Seguridad leen la fecha del negocio (el fuente)', () => {
  const auth = sinComentarios(leer('lib/auth.ts'));
  assert.match(auth, /if \(!firmada\.mfa && requiereSegundoFactor\(u\.rol, !!u\.mfa_activo, await obligatorioDesdeDe\(u\.workspace_id\)\)\) return null;/,
    'la sesión de cada pedido no mira la fecha del negocio');
  assert.doesNotMatch(auth, /requiereSegundoFactor\(u\.rol, !!u\.mfa_activo\)/, 'quedó la lectura sin la fecha');

  const cb = sinComentarios(leer('app/api/auth/callback/google/route.ts'));
  assert.match(cb, /const obligatorioDesde = usuario\.id > 0 \? await obligatorioDesdeDe\(usuario\.workspace_id\) : null;/);
  assert.match(cb, /const requiere = requiereSegundoFactor\(usuario\.rol, mfaActivo, obligatorioDesde\);/, 'el login no le pide el factor');
  assert.match(cb, /decidirTrasGoogle\(\{[^}]*obligatorioDesde,[^}]*\}\)/, 'la decisión después de Google no recibe la fecha');

  const seg = sinComentarios(leer('app/api/perfil/seguridad/route.ts'));
  assert.match(seg, /const obligado = politicaLoExige\(s\.rol, await obligatorioDesdeDe\(s\.ws\)\);\s*const r = await quitarFactor\(uid, obligado,/,
    'Seguridad deja quitar el último método a quien su negocio se lo exige');
  const mfa = sinComentarios(leer('lib/mfa.ts'));
  assert.match(mfa, /if \(obligado && cantidadFactores\(e\) <= 1\) \{/);
});

const OPS = ['ver_exigencia_2fa', 'exigir_2fa_desde', 'dejar_de_exigir_2fa'] as const;

test('las operaciones del 2FA son SÓLO de la plataforma, y no salen por HTTP', () => {
  for (const id of OPS) {
    const def = REGISTRO.find((d) => d.id === id);
    assert.ok(def, `falta ${id} en el registro`);
    assert.equal(def!.gating?.soloPlataforma, true, `${id} sin soloPlataforma`);
    assert.ok(!def!.canales.includes('http'), `${id} sale por HTTP`);
    const v = { ws: 9, rol: 'admin' as const, tabs: null };
    assert.equal(gatingOk(def!, { ...v, plataforma: true }), true, `${id}: la plataforma no la ve`);
    assert.equal(gatingOk(def!, { ...v, plataforma: false }), false, `${id}: un negocio la ve`);
    assert.equal(gatingOk(def!, v), false, `${id}: una vista sin el dato la ve`);
  }
  // Y la vista lo resuelve por CAPA.
  assert.match(sinComentarios(leer('lib/api-mako/vista.ts')), /plataforma = w\?\.capa === 'superadmin';/);
});

test('cada runner del 2FA vuelve a preguntar si es la plataforma, en preparar Y en ejecutar', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/equipo.run.ts'));
  const bloque = (id: string) => {
    const i = run.indexOf(`\n  ${id}: {`);
    assert.ok(i >= 0, `no encontré el runner de ${id}`);
    const fin = run.indexOf('\n  },\n', i);
    return run.slice(i, fin);
  };
  assert.match(bloque('ver_exigencia_2fa'), /leer: async \(_input, ctx\) => \{\s*if \(!\(await esWsPlataforma\(ctx\.ws\)\)\) return errorLectura\(NO_ES_PLATAFORMA\);/);
  for (const id of ['exigir_2fa_desde', 'dejar_de_exigir_2fa']) {
    const b = bloque(id);
    assert.match(b, /preparar: async \(input, ctx\): Promise<Preparado> => \{\s*if \(!\(await esWsPlataforma\(ctx\.ws\)\)\) return \{ error: NO_ES_PLATAFORMA \};/, `${id}: preparar`);
    const ej = b.slice(b.indexOf('ejecutar:'));
    const corte = ej.indexOf('if (!(await esWsPlataforma(ctx.ws))) return { ok: false, resumen: NO_ES_PLATAFORMA };');
    assert.ok(corte >= 0 && corte < ej.indexOf('fijarObligatorioDesde('), `${id}: ejecutar escribe sin preguntar`);
  }
  // La zona DECIDE el instante: la lectura estricta.
  assert.match(bloque('exigir_2fa_desde'), /await zonaDelNegocioEstricta\(n\.ws\)/);
});

// ROTURAS (14/10/2026), una por vez y restaurando de memoria. Base: 7 pases, 0 fallos.
//   · la regla sin la fecha                                   → 5 / 2
//   · exige recién DESPUÉS de la hora (`<` en vez de `<=`)     → 5 / 2
//   · una fecha rota exige                                    → 6 / 1
//   · 24:00 como las 00:00 del MISMO día                       → 6 / 1
//   · la política (quitar el último) sólo para el admin        → 6 / 1
//   · la sesión de cada pedido sin la fecha                    → 6 / 1
//   · el login sin la fecha                                    → 6 / 1
//   · Seguridad con el criterio viejo (`s.rol === 'admin'`)    → 6 / 1
//   · gatingOk sin soloPlataforma                              → 6 / 1
//   · la def sin soloPlataforma                                → 6 / 1
//   · la vista: plataforma para todos                          → 6 / 1
//   · exigir: ejecutar escribe sin preguntar                   → 6 / 1
//   · exigir: la zona con la lectura tolerante                 → 6 / 1
//   Restaurado: 7 / 0.
