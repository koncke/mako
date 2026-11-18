// F117 (18/11/2026): un lead de Meta que la puerta grabó y no llegó a anunciar (se cayó después del insert) se anuncia en el
// reintento —el de Meta, el de Zernio o el poll—, una sola vez. La marca es una línea del historial que `alNacerLeadDeMeta`
// escribe ANTES de anunciar (lib/meta-anuncio.ts); las reglas viven en lib/meta-anuncio-reglas.ts y se ejecutan acá. El
// reclamo y la lectura de los reintentos corren DE VERDAD en un hijo, contra el PostgREST de mentira (tests/_meta-anuncio-hijo.ts).
//
// Probado rompiéndolo (base 5/0; cada rotura cae en la regla pura Y en el hijo que la corre de verdad):
//   · `podriaSerReintento` sin mirar que el lead nació del formulario (la persona que ya estaba) → 3/2;
//   · `anunciarEnElReintento` sin el margen de «desde cuándo marca» → 3/2;
//   · `ganaElReclamo` devolviendo `true` siempre (las dos puertas anuncian) → 3/2;
//   · `alNacerLeadDeMeta` sin cortar el reintento que no pudo marcar → 3/2;
//   · el webhook de Meta sin la rama del reintento → 4/1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  MARGEN_DESPLIEGUE_MS, TOLERANCIA_RELOJ_MS, anunciarEnElReintento, ganaElReclamo, podriaSerReintento,
} from '../lib/meta-anuncio-reglas';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const AHORA = Date.parse('2026-11-18T15:00:00Z');
const hace = (min: number) => new Date(AHORA - min * 60_000).toISOString();

test('es el mismo lead nuevo: el formulario es de hoy y el lead nació de él', () => {
  assert.equal(podriaSerReintento({ id: 1, creadoAt: hace(30), formCreadoEn: hace(31) }, AHORA), true);
  assert.equal(podriaSerReintento({ id: 1, creadoAt: hace(30), formCreadoEn: hace(30 - TOLERANCIA_RELOJ_MS / 60_000 + 1) }, AHORA), true,
    'dos relojes: un alta un poco ANTES del formulario es el mismo lead');
  assert.equal(podriaSerReintento({ id: 1, creadoAt: hace(120), formCreadoEn: hace(30) }, AHORA), false,
    'la persona ya era un lead (vino antes por WhatsApp): no se le manda otro primer mensaje');
  assert.equal(podriaSerReintento({ id: 1, creadoAt: hace(30), formCreadoEn: hace(25 * 60) }, AHORA), false, 'un formulario de ayer ya no es nuevo');
  assert.equal(podriaSerReintento({ id: 1, creadoAt: hace(30), formCreadoEn: null }, AHORA), false, 'sin la hora del formulario no se sabe');
  assert.equal(podriaSerReintento({ id: 1, creadoAt: null, formCreadoEn: hace(31) }, AHORA), false, 'sin el alta tampoco');
});

test('se anuncia sólo sin la marca, y si el negocio ya marcaba cuando nació el lead', () => {
  const c = { id: 1, creadoAt: hace(30), formCreadoEn: hace(31) };
  assert.equal(anunciarEnElReintento({ candidato: c, marcado: false, marcaDesde: hace(60 * 5), ahoraMs: AHORA }), true);
  assert.equal(anunciarEnElReintento({ candidato: c, marcado: true, marcaDesde: hace(60 * 5), ahoraMs: AHORA }), false, 'ya se anunció');
  assert.equal(anunciarEnElReintento({ candidato: c, marcado: false, marcaDesde: null, ahoraMs: AHORA }), false,
    'un negocio que todavía no marca: sus leads no tienen marca porque no existía, no porque se cayeron');
  const justo = new Date(Date.parse(c.creadoAt) - MARGEN_DESPLIEGUE_MS + 60_000).toISOString();
  assert.equal(anunciarEnElReintento({ candidato: c, marcado: false, marcaDesde: justo, ahoraMs: AHORA }), false,
    'nacido en el despliegue: la versión de antes lo pudo anunciar sin marca');
});

test('dos puertas a la vez: anuncia la marca más vieja', () => {
  assert.equal(ganaElReclamo(10, [10, 11]), true);
  assert.equal(ganaElReclamo(11, [10, 11]), false);
  assert.equal(ganaElReclamo(10, [10]), true);
  assert.equal(ganaElReclamo(12, [10, 11]), null, 'sin ver la propia no se sabe');
});

test('lo real: el reclamo, la marca, los reintentos y quién anuncia', () => {
  const salida = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests', '_meta-anuncio-hijo.ts'),
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000 });
  const o = JSON.parse(salida.slice(salida.lastIndexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  assert.equal(o.tiro, undefined, String(o.tiro));
  assert.deepEqual(o.red, [], 'no salió a la red');
  assert.deepEqual([o.carrera.a, o.carrera.b].sort(), [false, true], 'dos reclamos a la vez: uno gana');
  assert.equal(o.carrera.marcas, 1, 'la marca del que perdió no queda en el historial');
  assert.equal(o.tarde, false);
  assert.ok(o.desde, 'el primer reclamo anota desde cuándo marca el negocio');
  assert.deepEqual(o.nuevo.sale, ['aviso:600', 'flujos:600:meta-lead:600', 'automatizaciones:600'], 'el lead nuevo se anuncia, con la dedupKey de los flujos');
  assert.equal(o.nuevo.marcas, 1);
  assert.deepEqual(o.reentrega, [], 'una reentrega de un lead anunciado no repite nada');
  assert.deepEqual(o.reintentos, [700], 'sólo el caído: ni el marcado, ni el de antes de marcar, ni el que ya estaba, ni el sin formulario');
  assert.deepEqual(o.otroNegocio, []);
  assert.deepEqual(o.caido.sale, ['aviso:700', 'flujos:700:meta-lead:700', 'automatizaciones:700'], 'el caído se anuncia una vez');
  assert.equal(o.caido.marcas, 1);
  assert.deepEqual(o.sinMarcaReintento, [], 'un reintento que no pudo marcar no anuncia: sería el segundo aviso');
  assert.deepEqual(o.sinMarcaNuevo, ['aviso:801', 'flujos:801:meta-lead:801', 'automatizaciones:801'], 'el lead nuevo se anuncia igual, como antes de la marca');
});

test('las tres puertas llaman al reintento, y el webhook no se saltea el anuncio si tira la conversión', () => {
  const webhook = sinComentarios(leer('app/api/webhooks/meta-leads/route.ts'));
  assert.match(webhook, /\} else if \(await reintentoSinAnunciar\(ws, \{ id: lead\.id, creadoAt: lead\.created_at, formCreadoEn: graphLead\.created_time \?\? null \}\)\) \{/);
  assert.match(webhook, /\}, \{ esReintento: true \}\);/);
  const capi = webhook.slice(webhook.indexOf('const capi = await sendMetaCAPIEvent('));
  assert.ok(capi.indexOf('} catch (e) {') > 0 && capi.indexOf('} catch (e) {') < capi.indexOf('alNacerLeadDeMeta('), 'la conversión va en su propio try');
  const poll = sinComentarios(leer('lib/meta-leads.ts'));
  assert.match(poll, /const sinAnunciar = await sinAnunciarDe\(ws, yaEstaban, ahoraMs\);/);
  assert.match(poll, /\{ esReintento: true \}\);\s*reanunciados\+\+;/);
  const zernio = sinComentarios(leer('lib/zernio-leads.ts'));
  assert.match(zernio, /const ws = created \|\| opc\.soloCrear \? null : await getWorkspaceActual\(\);/, 'el barrido no reintenta');
  assert.match(zernio, /\.\.\.\(reintento \? \{ nuevo: true \} : \{\}\),/);
  assert.match(zernio, /\}, \{ esReintento: c\.reintento \}\);/);
  const nacer = sinComentarios(leer('lib/meta-lead-nuevo.ts'));
  assert.ok(nacer.indexOf('await reclamarAnuncio(ws, lead.id)') < nacer.indexOf('emitirDelCatalogo('), 'se reclama ANTES de anunciar');
  assert.match(nacer, /if \(reclamo === null && opc\.esReintento\) return;/);
});
