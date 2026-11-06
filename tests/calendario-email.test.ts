// =============================================================================
// El «Email» del Calendario, enlazado a Email Marketing (6/11/2026, la promesa a la agencia de Thiago)
// =============================================================================
// Un email del Calendario era un recordatorio que se tildaba a mano. Ahora se enlaza a un broadcast de Email Marketing y se
// programa a la hora del evento con la MISMA regla que «Programar» en Email Marketing (lib/calendario-email.ts). Acá corren
// las reglas puras (qué evento se enlaza, cómo se lee el email, si la hora coincide) y se fija el cableado que no se puede
// ejecutar sin una base: que se programe por `programar_broadcast` y no por una escritura propia, que se vuelva a revisar
// antes de escribir y que el plan del negocio tenga Email Marketing.
//
// Probado rompiéndolo (6/11/2026), con la base en 7/0:
//   · `motivoParaNoEnlazar` sin el chequeo de la hora pasada → 6/1: «uno que ya pasó no se programa».
//   · `ejecutarEnlace` sin el segundo `preparar` → 6/1: «vuelve a revisar antes de escribir».
//   · `prepararEnlace` sin `sinEmailEnElPlan` → 6/1: «el plan sin Email Marketing».
//   · `cambiarEventoAction` sin `reprogramarSiEnlazado` → 6/1: «mover el evento mueve el email».
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coincideLaHora, estadoDelEmail, motivoParaNoEnlazar, MARGEN_PROGRAMAR_MS, ESTADOS_ENLAZABLES } from '../lib/calendario-email-reglas';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';
import { resolverRest } from '../lib/api-mako/rest';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const cuerpo = (src: string, abre: string, cierra: string) => {
  const i = src.indexOf(abre);
  assert.ok(i >= 0, `no encontré «${abre}»`);
  const f = src.indexOf(cierra, i + abre.length);
  assert.ok(f > i, `no encontré el cierre de «${abre}»`);
  return src.slice(i, f);
};

const AHORA = Date.parse('2026-11-06T12:00:00Z');
const ev = (o: Partial<{ tipo: string; formato: string | null; dia_completo: boolean; inicio: string }> = {}) => ({
  tipo: 'publicacion', formato: 'email', dia_completo: false, inicio: '2026-11-10T15:00:00.000Z', ...o,
});

test('qué evento se enlaza: una publicación Email, con hora y en el futuro', () => {
  assert.equal(motivoParaNoEnlazar(ev(), AHORA), null);
  assert.match(motivoParaNoEnlazar(ev({ formato: 'reel' }), AHORA)!, /formato Email/);
  assert.match(motivoParaNoEnlazar(ev({ tipo: 'bloque', formato: null }), AHORA)!, /formato Email/);
  assert.match(motivoParaNoEnlazar(ev({ dia_completo: true }), AHORA)!, /hora/, 'un email sale a una hora');
  assert.match(motivoParaNoEnlazar(ev({ inicio: '2026-11-01T10:00:00Z' }), AHORA)!, /ya pasó/, 'uno que ya pasó no se programa');
  assert.match(motivoParaNoEnlazar(ev({ inicio: new Date(AHORA + MARGEN_PROGRAMAR_MS - 1).toISOString() }), AHORA)!, /ya pasó/, 'el margen de programar_broadcast');
  assert.match(motivoParaNoEnlazar(ev({ inicio: 'mañana' }), AHORA)!, /hora válida/);
});

test('el evento dice lo que pasó con su email, no un tilde', () => {
  assert.deepEqual(estadoDelEmail(null), { texto: 'Sin email enlazado', tono: 'neutro', enviado: false });
  const b = (estado: string) => ({ id: 1, asunto: 'Hola', estado, programado_at: null, enviado_at: null });
  assert.equal(estadoDelEmail(b('enviado')).enviado, true);
  assert.equal(estadoDelEmail(b('programado')).texto, 'Programado');
  assert.equal(estadoDelEmail(b('enviando')).texto, 'Enviándose');
  assert.match(estadoDelEmail(b('borrador')).texto, /borrador/);
  assert.deepEqual([...ESTADOS_ENLAZABLES], ['borrador', 'programado'], 'un enviado o un cancelado no se vuelve a programar desde acá');
});

test('si el evento se movió y el email no, la hora no coincide (y uno ya enviado no se mira)', () => {
  const p = { estado: 'programado', programado_at: '2026-11-10T15:00:00.000Z' };
  assert.equal(coincideLaHora(p, '2026-11-10T15:00:00Z'), true);
  assert.equal(coincideLaHora(p, '2026-11-11T15:00:00Z'), false);
  assert.equal(coincideLaHora({ estado: 'enviado', programado_at: '2026-11-10T15:00:00Z' }, '2026-12-01T00:00:00Z'), true);
});

test('se programa por la regla de Email Marketing, y vuelve a revisar antes de escribir', () => {
  const src = leer('lib/calendario-email.ts');
  assert.match(src, /RUNNERS as RUNNERS_EMAIL/);
  assert.doesNotMatch(src, /from\('email_broadcasts'\)\s*\.update/, 'ninguna escritura propia del broadcast: la hace programar_broadcast');
  const ej = cuerpo(src, 'export async function ejecutarEnlace(', '\n}\n');
  const rePrep = ej.indexOf('programar().preparar!(');
  const escribe = ej.indexOf('programar().ejecutar(');
  assert.ok(rePrep > 0 && escribe > rePrep, 'vuelve a revisar antes de escribir');
  assert.ok(ej.indexOf("from('calendario_eventos').update") > escribe, 'el enlace se anota DESPUÉS de programar');
});

test('el plan sin Email Marketing: el Calendario no le programa emails', () => {
  const src = leer('lib/calendario-email.ts');
  assert.match(src, /tabEnCapa\('email', w\.capa\)/);
  assert.match(cuerpo(src, 'export async function prepararEnlace(', '\n}\n'), /await sinEmailEnElPlan\(ctx\.ws\)/);
  assert.match(cuerpo(src, 'export async function ejecutarEnlace(', '\n}\n'), /await sinEmailEnElPlan\(ctx\.ws\)/);
});

test('mover el evento mueve el email (cambiarEventoAction), y las acciones siguen siendo del admin', () => {
  const act = leer('app/calendario/actions.ts');
  assert.match(cuerpo(act, 'export async function cambiarEventoAction(', '\n}\n'), /reprogramarSiEnlazado\(String\(id\)/);
  const enl = cuerpo(act, 'export async function enlazarEmailAction(', '\n}\n');
  assert.ok(enl.indexOf('await guard()') >= 0 && enl.indexOf('prepararEnlace(') < enl.indexOf('ejecutarEnlace('));
  for (const f of ['emailDelEventoAction', 'revisarEmailAction', 'soltarEmailAction']) {
    assert.match(cuerpo(act, `export async function ${f}(`, '\n}\n'), /await guard\(\);/, `${f} sin el guard`);
  }
});

test('la API de MaKo: se declara, es plata (pantalla, sólo el admin) y tiene su ruta REST', () => {
  const d = porId('enlazar_email_calendario');
  assert.ok(d && esAccion(d));
  assert.equal(d.confirmacion, 'pantalla');
  assert.equal(d.costo, 'dinero');
  assert.equal(d.gating?.rolMinimo, 'admin');
  const r = resolverRest('POST', ['', 'calendario', 'eventos', 'abc', 'email']);
  assert.ok(r && 'operacion' in r && r.operacion === 'enlazar_email_calendario');
});
