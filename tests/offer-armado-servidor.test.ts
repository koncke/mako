// =============================================================================
// La oferta se arma en el SERVIDOR, y al terminar MaKo avisa (16/10/2026)
// =============================================================================
// Pedido de Martín en la llamada con Leila (12/10, 00:37:00): que la persona no se quede esperando en la
// pestaña, «te mando una notificación cuando esté listo». Lo que se encontró al mirarlo: «Armar mi oferta» eran
// DOS pedidos que esperaba el navegador (diagnóstico y oferta), y si se cerraba la pestaña en el primero la oferta
// no se hacía nunca. Ahora 'armar' anota el armado en la fila (`offer_sesiones.armado`, mig 0296), contesta al
// toque y corre los dos pasos en un `after()`; al terminar, el evento de la plataforma `oferta_lista` (lo que se
// manda lo arma la automatización del SuperAdmin, no este código).
//
// Lo PURO (cuándo un armado está en curso, vencido o fallido; los datos del aviso) se prueba EJECUTÁNDOLO. El
// cableado (la ruta, la fila, la pantalla, el evento) se fija leyendo el fuente, sin comentarios y con LF.
//
// PROBADO ROMPIÉNDOLO (16/10/2026, arnés romper-armado.mjs en el scratchpad, restaura de memoria en un finally).
// Base: 8 pasan, 0 fallan. Cada rotura, «1 fallo, 7 pases»: un armado fallido cuenta como en curso · uno vencido
// sigue «armando» · se acepta un armado sin intento · el nombre con «[completar]» va al aviso · dos clics arrancan
// dos armados · el trabajo de fondo sin su workspace · un intento viejo pisa el armado nuevo · el aviso sale
// aunque la oferta falle · la columna fuera de las COLS · la vista no lleva el armado · la pantalla no relee
// mientras arma · el onboarding vuelve a pedir el armado · el aviso por el camino viejo · la plantilla sin el link.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARMADO_CORTADO, ARMADO_VENCE_MS, armadoEnCurso, armadoParaVista, pasoInicialDelArmado, sanearArmado,
} from '../lib/offer-reglas';
import { datosOfertaLista } from '../lib/oferta-lista';
import { EVENTOS_MAKO } from '../lib/disparadores';
import { AVISOS_SOLO_SUPERADMIN } from '../lib/avisos-catalogo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const funcion = (src: string, nombre: string): string => {
  const i = src.indexOf(`async function ${nombre}(`);
  assert.ok(i >= 0, `no está ${nombre}`);
  const corte = [src.indexOf('\nasync function ', i + 10), src.indexOf('\nfunction ', i + 10)].filter((x) => x > 0);
  return src.slice(i, corte.length ? Math.min(...corte) : undefined);
};

const AHORA = Date.parse('2026-10-16T12:00:00Z');
const hace = (min: number) => new Date(AHORA - min * 60_000).toISOString();

// ── Lo puro ─────────────────────────────────────────────────────────────────
test('el armado guardado: en curso, fallido o vencido (uno que se cortó no deja la pantalla «armando» para siempre)', () => {
  const vivo = { desde: hace(2), paso: 'diagnostico' as const, origen: 'tab' as const, intento: 'a1' };
  assert.equal(armadoEnCurso(vivo, AHORA), true);
  assert.deepEqual(armadoParaVista(vivo, AHORA), { paso: 'diagnostico', corriendo: true, error: null });
  // Fallido: no corre, y el error es el que se le muestra al dueño.
  const fallo = { ...vivo, paso: 'oferta' as const, error: 'La IA no contestó.' };
  assert.equal(armadoEnCurso(fallo, AHORA), false);
  assert.deepEqual(armadoParaVista(fallo, AHORA), { paso: 'oferta', corriendo: false, error: 'La IA no contestó.' });
  // Vencido: pasado el tope, se cortó (un deploy, la plataforma): se puede volver a pedir.
  const viejo = { ...vivo, desde: new Date(AHORA - ARMADO_VENCE_MS - 1).toISOString() };
  assert.equal(armadoEnCurso(viejo, AHORA), false);
  assert.deepEqual(armadoParaVista(viejo, AHORA), { paso: 'diagnostico', corriendo: false, error: ARMADO_CORTADO });
  assert.ok(ARMADO_VENCE_MS > 800_000, 'el tope tiene que pasar el maxDuration de la ruta (800 s)');
  assert.equal(armadoParaVista(null, AHORA), null);
  // El reintento arranca desde la oferta si el diagnóstico ya estaba hecho.
  assert.equal(pasoInicialDelArmado(true), 'oferta');
  assert.equal(pasoInicialDelArmado(false), 'diagnostico');
});

test('lo que se lee de la columna se sanea: un armado roto es «no hay armado», nunca uno inventado', () => {
  assert.equal(sanearArmado(null), null);
  assert.equal(sanearArmado({ desde: 'ayer', paso: 'oferta', intento: 'x' }), null, 'fecha que no se entiende');
  assert.equal(sanearArmado({ desde: hace(1), paso: 'otro', intento: 'x' }), null, 'paso desconocido');
  assert.equal(sanearArmado({ desde: hace(1), paso: 'oferta' }), null, 'sin intento no se puede proteger de uno viejo');
  assert.deepEqual(sanearArmado({ desde: hace(1), paso: 'oferta', intento: 'x', origen: 'raro', error: '  falló  ' }),
    { desde: hace(1), paso: 'oferta', intento: 'x', origen: 'tab', error: 'falló' });
});

test('los datos del aviso: el nombre con «[completar]» no va (su renglón se va solo), la versión y el link sí', () => {
  assert.deepEqual(datosOfertaLista({ nombre: '  Método Lumen  ', version: 2, link: 'https://x/offer' }),
    { oferta_lista_nombre: 'Método Lumen', oferta_lista_version: '2', oferta_lista_link: 'https://x/offer' });
  assert.deepEqual(datosOfertaLista({ nombre: 'Programa [completar]', version: 1, link: 'L' }), { oferta_lista_version: '1', oferta_lista_link: 'L' });
  assert.deepEqual(datosOfertaLista({ nombre: null, version: 1, link: 'L' }), { oferta_lista_version: '1', oferta_lista_link: 'L' });
});

// ── La ruta ─────────────────────────────────────────────────────────────────
const RUTA = sinComentarios(leer('app/api/offer/route.ts'));

test('la ruta: «armar» contesta al toque y corre los dos pasos en el servidor, uno solo a la vez', () => {
  assert.match(RUTA, /export const maxDuration = 800;/);
  assert.match(RUTA, /case 'armar':\n\s*return await armar\(ws, body\);/);
  const armar = funcion(RUTA, 'armar');
  // Idempotente: con uno corriendo, no arranca otro (el CAS no cambia nada).
  assert.match(armar, /if \(armadoEnCurso\(f\.armado, Date\.now\(\)\)\) return null;/);
  assert.match(armar, /armado: \{ desde: new Date\(\)\.toISOString\(\), paso: pasoInicialDelArmado\(!!f\.borrador\), origen, intento \}/);
  // El trabajo va DESPUÉS de contestar, con el workspace explícito.
  assert.match(armar, /const trabajo = \(\) => runWithWorkspace\(ws, \(\) => armarPorDetras\(ws, id, intento\)\);/);
  assert.match(armar, /try \{ after\(trabajo\); \} catch \{ void trabajo\(\); \}/);
  assert.ok(armar.indexOf('if (arranco)') > 0 && armar.indexOf('after(trabajo)') > armar.indexOf('if (arranco)'), 'sólo el que arrancó corre el trabajo');
  // Los pasos sueltos siguen: los usa MaKo Mobile (app/m/offer/OfferM.tsx).
  assert.match(RUTA, /case 'diagnosticar': \{[\s\S]*?const r = await diagnosticarSesion\(id, inicio\);/);
  assert.match(RUTA, /case 'generar':\n\s*return await generar\(body, inicio\);/);
});

test('por detrás: cada escritura es de ESTE intento, el aviso sale sólo si la oferta quedó, y un fallo queda escrito', () => {
  const pd = funcion(RUTA, 'armarPorDetras');
  assert.match(pd, /const esteIntento = \(f: FilaOffer\) => f\.armado\?\.intento === intento;/);
  assert.match(pd, /actualizarSesion\(id, \(f\) => \(f\.armado && esteIntento\(f\) \? \{ armado: cambio\(f\.armado\) \} : null\)\)/);
  // El diagnóstico sólo si toca, y cada paso con su propio plazo (el `inicio` de los de lib/offer-ia.ts).
  assert.match(pd, /if \(arranque\.armado\.paso === 'diagnostico'\) \{\n\s*const d = await diagnosticarSesion\(id, Date\.now\(\)\);/);
  assert.match(pd, /const g = await generarSesion\(id, Date\.now\(\)\);\n\s*if \(!g\.ok\) \{ await fallar\(g\.error\); return; \}/);
  // El aviso, al final y sólo después de una oferta guardada.
  const iGen = pd.indexOf('await generarSesion(');
  const iAviso = pd.indexOf('await avisarOfertaLista(ws, g.final);');
  assert.ok(iGen > 0 && iAviso > iGen, 'el aviso sale antes de que la oferta quede');
  assert.equal(pd.split('avisarOfertaLista(').length - 1, 1, 'el aviso sale una sola vez');
  // Un fallo (también un 409 del CAS) queda en `armado.error`: nunca tira.
  assert.match(pd, /\} catch \(e\) \{\n\s*await fallar\(e instanceof ErrorOffer \? e\.message :/);
});

// ── La fila y la migración ──────────────────────────────────────────────────
test('la fila: `armado` en las COLS, saneado al leer, escrito por CAS y en la vista; la migración, aditiva', () => {
  const S = sinComentarios(leer('lib/offer-sesiones.ts'));
  assert.match(S, /const COLS = '[^']*\barmado\b[^']*';/);
  assert.match(S, /armado: sanearArmado\(r\.armado\),/);
  assert.match(S, /if \(c\.armado !== undefined\) r\.armado = c\.armado;/);
  assert.match(S, /armando: armadoParaVista\(f\.armado, Date\.now\(\)\),/);
  const mig = 'supabase/migrations/0296_offer_armado.sql';
  assert.ok(existsSync(join(RAIZ, mig)), 'falta la migración');
  const sql = leer(mig);
  assert.match(sql, /alter table public\.offer_sesiones add column if not exists armado jsonb;/);
  assert.match(sql, /notify pgrst, 'reload schema';/);
});

// ── La pantalla ─────────────────────────────────────────────────────────────
test('la pantalla: pide el armado, lo que ve sale de lo guardado y relee mientras corre', () => {
  const APP = sinComentarios(leer('app/offer/OfferApp.tsx'));
  const i = APP.indexOf('const armar = async');
  const armar = APP.slice(i, APP.indexOf('const elegirOpcion', i));
  assert.match(armar, /action: 'armar', sesionId: id, origen: arranque \? 'arranque' : 'tab'/);
  assert.match(armar, /useEffect\(\(\) => \{\n\s*if \(armadoPaso\) \{ setGen\(\{ paso: armadoPaso, corriendo: armadoCorre, error: armadoError \}\); return; \}/);
  assert.match(armar, /const idSesionArmando = armadoCorre \? \(sesion\?\.id \?\? null\) : null;/);
  assert.match(armar, /const t = setInterval\(\(\) => \{ void releer\(\); \}, RELEER_ARMADO_MS\);/);
  assert.match(armar, /return \(\) => \{ clearInterval\(t\); document\.removeEventListener\('visibilitychange', alVolver\); \};/);
  // El onboarding no vuelve a pedirlo si el servidor ya está armando.
  assert.match(APP, /sesion\.conclusion \|\| sesion\.armando\?\.corriendo \|\| generando\.current\) return;/);
});

// ── El evento ───────────────────────────────────────────────────────────────
test('el evento de la plataforma `oferta_lista`: lo configura el SuperAdmin y lo emite sólo el armado, sin camino viejo', () => {
  const ev = EVENTOS_MAKO.find((e) => e.subtipo === 'oferta_lista');
  assert.ok(ev, 'falta el evento');
  assert.equal(ev.aviso, 'oferta-lista');
  assert.equal(ev.plataforma, true);
  assert.deepEqual([...ev.trae], ['oferta']);
  assert.ok(AVISOS_SOLO_SUPERADMIN.includes('oferta-lista'));
  // La plantilla del SuperAdmin, con los tres datos.
  const P = leer('lib/plantillas-automatizaciones.ts');
  const p = P.slice(P.indexOf("id: 'mako-oferta-lista'"), P.indexOf('],', P.indexOf("id: 'mako-oferta-lista'")));
  assert.match(p, /soloPlataforma: true,/);
  assert.match(p, /cron: \{ fijo: TRIGGER_AVISO_MAKO, evento: 'oferta_lista' \},/);
  for (const v of ['oferta_lista_version', 'oferta_lista_nombre', 'oferta_lista_link']) assert.ok(p.includes(`{{${v}}}`), `la plantilla no usa {{${v}}}`);
  assert.match(leer('scripts/mudanza-avisos-plataforma.mts'), /\{ plantilla: 'mako-oferta-lista', evento: 'oferta_lista' \},/);
  // El emisor: SIEMPRE por la plataforma. `emitirDelCatalogo` caería, sin fila, al camino viejo con el ejemplo del
  // catálogo como si fuera real.
  const E = sinComentarios(leer('lib/oferta-lista-server.ts'));
  assert.match(E, /await emitirEventoDePlataforma\('oferta-lista', \{ ws, datos \}\);/);
  assert.doesNotMatch(E, /emitirDelCatalogo|emitirAviso\(/);
  assert.match(E, /\} catch \(e\) \{/, 'el aviso nunca tira: la oferta ya quedó');
});
