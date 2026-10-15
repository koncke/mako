// =============================================================================
// LA zona del negocio: un default, una canónica, quién la decide y quién NO la detecta
// =============================================================================
// Undécima tanda de Automations (11/10/2026), decisión 4 de la décima. Martín: «Si, siempre por ubicación que se
// maneje por defecto. Detectando la ubicacion del usuario.» Diseño: docs/diseno-undecima-tanda.md §2 y §9 (25-27).
//
// El caso medido: el ws1 (Mauricio, Baja California) no tenía `mako.timezone`, tenía el horario de 9 a 21 prendido y
// el motor lo medía en hora de Ciudad de México (`ZONA_SIN_CONFIGURAR`): el envío #22 salió a las 08:00 de Tijuana.
// El repo tenía DOS defaults (Tijuana para las pantallas, CDMX para el motor). Queda uno: `ZONA_POR_DEFECTO`.
//
// Probado rompiéndolo (11/10/2026), una rotura por vez con este archivo solo (scratchpad wf-undecima/w1-zona/
// rotura.cjs: reemplaza, corre, restaura byte a byte); base 9 pasan / 0 fallan:
//   R1. que 'navegador' pise a 'persona' (sin `if (actual.origen === 'persona') return 'nada';` en
//       `decidirZona`)                                                          → 8 pasan / 1 falla (la matriz)
//   R2. que la acción escriba con el rol del super admin (`const propio = true` en
//       app/_components/zona-actions.ts)                                         → 8 / 1 (el guard de la acción)
//   R3. que `zonaDeLoGuardado` caiga a Ciudad de México (`?? 'America/Mexico_City'`) → 7 / 2 (el default y el caso
//       medido del envío #22)
//   R4. `mismoReloj` comparando sólo el nombre (sin el barrido)                   → 7 / 2 (Tijuana y Los Ángeles, y el
//       «sellar» de la matriz)
//   R5. `zonaCanonica` devolviendo el id ICU en vez de la zona de la lista        → 6 / 3 (el alias, el default y la
//       ubicación: 'America/Buenos_Aires' se quedaba como alias)
//   R6. `horario-actions.ts` guardando con `setSetting(KEY_TIMEZONE, z)` y otro origen → 8 / 1 (el escritor único)
//
// Ola 3 (w3-motor-integracion, 11/10/2026): «UN solo default» abajo, con el motor, el tick y `tzDeWorkspace` ejecutado
// con una base de mentira. Roturas al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  ZONA_POR_DEFECTO, CLAVE_ZONA, CLAVE_ZONA_ORIGEN, ORIGENES_ZONA, zonaCanonica, zonaDeUbicacion, zonaDeLoGuardado,
  mismoReloj, decidirZona, leerOrigen, origenParaGuardar, origenVigente, textoOrigen, type OrigenZona,
} from '../lib/zona-negocio-reglas';
import { dentroDeVentanaEn } from '../lib/nutricion-grafo-motor';

const raiz = join(__dirname, '..');
const leer = (r: string): string => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const DESDE = Date.parse('2026-10-11T00:00:00Z');

// ── La forma canónica y el default ──────────────────────────────────────────────────────────────

test('un alias no es otra zona: se canoniza a la de la lista de países', () => {
  // Cal.com contesta el alias viejo y así quedó guardado en el ws13; la tabla de acentos no lo conocía.
  assert.equal(zonaCanonica('America/Buenos_Aires'), 'America/Argentina/Buenos_Aires');
  assert.equal(zonaCanonica('America/Argentina/Buenos_Aires'), 'America/Argentina/Buenos_Aires');
  assert.equal(zonaCanonica('America/Ensenada'), 'America/Tijuana');
  assert.equal(zonaCanonica('US/Pacific'), 'America/Los_Angeles');
  assert.equal(zonaCanonica(' america/tijuana '), 'America/Tijuana');
  // Una válida que no está en la lista vuelve tal cual (su fila propia en otras tablas no se pierde).
  assert.equal(zonaCanonica('America/Argentina/Cordoba'), 'America/Argentina/Cordoba');
  for (const roto of ['Marte/Olympus', '', '   ', null, undefined, 42, 'x'.repeat(80)]) {
    assert.equal(zonaCanonica(roto), null, `«${String(roto)}» no es una zona`);
  }
});

test('UN default, Tijuana, y LA regla de lectura nunca tira', () => {
  assert.equal(ZONA_POR_DEFECTO, 'America/Tijuana');
  assert.equal(CLAVE_ZONA, 'mako.timezone');
  assert.equal(CLAVE_ZONA_ORIGEN, 'mako.timezone.origen');
  for (const nada of [null, undefined, '', 'Marte/Olympus', {}]) assert.equal(zonaDeLoGuardado(nada), 'America/Tijuana');
  assert.equal(zonaDeLoGuardado('America/Buenos_Aires'), 'America/Argentina/Buenos_Aires');
  assert.equal(zonaDeLoGuardado('America/Cancun'), 'America/Cancun');
});

test('UTC, GMT y Etc/* no son una ubicación (lo que reporta un navegador en privado)', () => {
  for (const z of ['UTC', 'Etc/UTC', 'Etc/GMT+3', 'GMT', 'Etc/Unknown', 'Factory', 'Marte/Olympus', '']) {
    assert.equal(zonaDeUbicacion(z), null, `«${z}» se tomó como un lugar`);
  }
  assert.equal(zonaDeUbicacion('America/Tijuana'), 'America/Tijuana');
  assert.equal(zonaDeUbicacion('America/Buenos_Aires'), 'America/Argentina/Buenos_Aires');
  // Pero UTC SÍ es una zona válida para leer (si alguien la eligió): sólo no dice dónde está nadie.
  assert.equal(zonaCanonica('UTC'), 'UTC');
});

// ── El reloj ────────────────────────────────────────────────────────────────────────────────────

test('Tijuana y Los Ángeles marcan la misma hora todo el año; Tijuana y CDMX, no', () => {
  const t0 = Date.now();
  assert.equal(mismoReloj('America/Tijuana', 'America/Los_Angeles', DESDE), true);
  assert.equal(mismoReloj('America/Tijuana', 'America/Ensenada', DESDE), true);
  assert.equal(mismoReloj('America/Tijuana', 'America/Mexico_City', DESDE), false);
  assert.equal(mismoReloj('America/Argentina/Buenos_Aires', 'America/Sao_Paulo', DESDE), true, 'hoy no tienen horario de verano ninguna de las dos');
  assert.equal(mismoReloj('America/Tijuana', 'Marte/Olympus', DESDE), false);
  // Con un formateador nuevo por llamada, el barrido de un año costó 10,7 s: se reusan.
  assert.ok(Date.now() - t0 < 2000, `mismoReloj tardó ${Date.now() - t0} ms`);
  // Y por eso la detección de un navegador en Los Ángeles no le cambia el nombre a la zona de Tijuana.
  assert.notEqual(decidirZona({ tz: 'America/Tijuana', origen: 'meta' }, { tz: 'America/Los_Angeles', origen: 'navegador' }, DESDE), 'escribir');
  assert.equal(decidirZona({ tz: 'America/Tijuana', origen: 'legado' }, { tz: 'America/Los_Angeles', origen: 'ip' }, DESDE), 'nada');
});

test('el caso medido: el horario de 9 a 21 del ws1 en SU zona (sin zona guardada = Tijuana)', () => {
  const zona = zonaDeLoGuardado(null);
  // 15:00:47 UTC del 11/10/2026: el envío #22. 08:00 en Tijuana (fuera); 09:00 en CDMX (adentro: el bug).
  assert.equal(dentroDeVentanaEn(Date.parse('2026-10-11T15:00:47Z'), zona, 9, 21), false, 'el envío #22 salió a las 08:00 de Tijuana');
  assert.equal(dentroDeVentanaEn(Date.parse('2026-10-11T15:00:47Z'), 'America/Mexico_City', 9, 21), true);
  // El 1/11 Tijuana pasa a UTC-8: 16:30 UTC son las 08:30 (fuera); al día siguiente, 17:00 UTC son las 09:00.
  assert.equal(dentroDeVentanaEn(Date.parse('2026-11-01T16:30:00Z'), zona, 9, 21), false);
  assert.equal(dentroDeVentanaEn(Date.parse('2026-11-02T17:00:00Z'), zona, 9, 21), true);
  // El 14/3/2027 vuelve a UTC-7: 16:00 UTC del 15/3 son las 09:00.
  assert.equal(dentroDeVentanaEn(Date.parse('2027-03-15T16:00:00Z'), zona, 9, 21), true);
});

// ── Quién decide ────────────────────────────────────────────────────────────────────────────────

test('la matriz de decidirZona: la persona manda, la primera detección gana, lo inferido sólo llena un vacío', () => {
  const TJ = 'America/Tijuana';
  const BA = 'America/Argentina/Buenos_Aires';
  const CUN = 'America/Cancun';
  const d = (actual: { tz: string | null; origen: OrigenZona | null }, tz: string, origen: OrigenZona) => decidirZona(actual, { tz, origen }, DESDE);
  const actuales: Array<OrigenZona | null> = [...ORIGENES_ZONA, null];

  // 'persona' escribe siempre: sobre cualquier origen, sobre un vacío y aunque sea la misma zona.
  for (const o of actuales) assert.equal(d({ tz: TJ, origen: o }, BA, 'persona'), 'escribir', `persona sobre ${o}`);
  assert.equal(d({ tz: null, origen: null }, TJ, 'persona'), 'escribir');
  assert.equal(d({ tz: TJ, origen: 'persona' }, TJ, 'persona'), 'escribir');

  // Una zona de 'persona' sólo la cambia otra persona.
  for (const o of ORIGENES_ZONA.filter((x) => x !== 'persona')) {
    assert.equal(d({ tz: TJ, origen: 'persona' }, BA, o), 'nada', `${o} pisó a una persona`);
  }

  // 'navegador' pisa inferencias, 'legado' y lo que no tiene origen; NO a otro navegador.
  for (const o of ['ip', 'calendario', 'meta', 'telefono', 'legado', null] as const) {
    assert.equal(d({ tz: CUN, origen: o }, BA, 'navegador'), 'escribir', `navegador no pisó a ${o}`);
  }
  assert.equal(d({ tz: CUN, origen: 'navegador' }, BA, 'navegador'), 'nada', 'la segunda detección pisó a la primera (el dueño de viaje)');
  // Con el mismo reloj, el navegador que CONFIRMA sella su origen sin tocar la zona; si ya había uno, nada.
  assert.equal(d({ tz: TJ, origen: 'meta' }, 'America/Los_Angeles', 'navegador'), 'sellar');
  assert.equal(d({ tz: TJ, origen: null }, TJ, 'navegador'), 'sellar');
  assert.equal(d({ tz: TJ, origen: 'navegador' }, TJ, 'navegador'), 'nada');

  // 'ip', 'calendario', 'meta' y 'telefono' sólo llenan un vacío.
  for (const o of ['ip', 'calendario', 'meta', 'telefono'] as const) {
    assert.equal(d({ tz: null, origen: null }, CUN, o), 'escribir', `${o} no llenó el vacío`);
    for (const a of actuales) assert.equal(d({ tz: TJ, origen: a }, CUN, o), 'nada', `${o} pisó a ${a}`);
  }
  // Una zona rota guardada es un vacío; una zona nueva rota no se escribe nunca.
  assert.equal(d({ tz: 'Marte/Olympus', origen: 'legado' }, CUN, 'meta'), 'escribir');
  assert.equal(d({ tz: null, origen: null }, 'Marte/Olympus', 'persona'), 'nada');
});

test('el origen: se guarda con su zona, y un origen de OTRA zona es huérfano', () => {
  const raw = origenParaGuardar('navegador', 'America/Tijuana', 'ana@negocio.com', new Date('2026-10-11T18:00:00Z'));
  const o = leerOrigen(raw);
  assert.deepEqual(o, { origen: 'navegador', por: 'ana@negocio.com', at: '2026-10-11T18:00:00.000Z', tz: 'America/Tijuana' });
  assert.equal(origenVigente(o, 'America/Tijuana'), o);
  assert.equal(origenVigente(o, 'America/Mexico_City'), null, 'un origen de otra zona hablaba por una zona que no escribió');
  assert.equal(origenVigente(o, null), null);
  // El alias guardado y su canónica son la misma zona.
  assert.ok(origenVigente(leerOrigen(origenParaGuardar('legado', 'America/Argentina/Buenos_Aires', null)), 'America/Buenos_Aires'));
  for (const roto of [null, '', '{', '{"origen":"marciano"}', '[]', 42]) assert.equal(leerOrigen(roto), null);
  // El texto: corto y de tú (sin voseo).
  assert.match(textoOrigen(o), /^Detectada por el navegador de ana@negocio\.com el 11\/10\/2026$/);
  assert.equal(textoOrigen(null), 'Sin registro de dónde salió');
  for (const x of ORIGENES_ZONA) assert.ok(textoOrigen({ origen: x, por: null, at: null }).length <= 60);
});

// ── Quién detecta (guard de fuente) ─────────────────────────────────────────────────────────────

test('la acción detecta SÓLO con un admin PROPIO, en producción; el resto, con las integraciones del cliente', () => {
  const src = sinComentarios(leer('app/_components/zona-actions.ts'));
  assert.match(src, /^'use server';/m);
  const i = src.indexOf('export async function detectarZonaAction(');
  assert.ok(i > 0, 'no está la acción');
  const cuerpo = src.slice(i);
  const iProd = cuerpo.indexOf("if (process.env.VERCEL_ENV !== 'production') return;");
  const iSesion = cuerpo.indexOf('await getUsuarioActual()');
  assert.ok(iProd > 0 && iSesion > iProd, 'un next dev local escribiría la zona de prod (VERCEL_ENV va primero)');
  assert.match(cuerpo, /if \(!sesion \|\| sesion\.legacy\) return;/);
  // Los cinco cortes de «propio».
  const iProp = cuerpo.indexOf('const propio =');
  const prop = cuerpo.slice(iProp, cuerpo.indexOf(';', iProp));
  assert.match(prop, /sesion\.rol !== 'admin'/, 'el super admin con ?ws= le cambiaría la zona a un cliente');
  assert.match(prop, /!\(await contextoDeAgencia\(\)\)/, 'una agencia detectaría la zona de su cliente');
  assert.match(prop, /sesion\.ws === ws/, 'un usuario detectaría la zona de otro negocio');
  assert.match(prop, /\(sesion\.rolWs \?\? 'admin'\) === 'admin'/, 'un setter o un closer detectaría la zona');
  // El navegador y la IP sólo en la rama propia; la otra rama, sólo integraciones y sólo con la zona vacía.
  const iRamaProp = cuerpo.indexOf('if (propio) {');
  const iNoProp = cuerpo.indexOf('const actual = await zonaDelNegocioDetalle(ws);');
  assert.ok(iRamaProp > iProp && iNoProp > iRamaProp, 'cambió la forma de las dos ramas');
  const ramaProp = cuerpo.slice(iRamaProp, iNoProp);
  const noProp = cuerpo.slice(iNoProp);
  assert.match(ramaProp, /zonaDeUbicacion\(tzNavegador\)/);
  assert.match(ramaProp, /x-vercel-ip-timezone|HEADER_ZONA_IP/);
  assert.match(ramaProp, /fijarZonaDelNegocio\(ws, zona, origen, sesion\.email \|\| null\)/);
  assert.doesNotMatch(noProp, /tzNavegador|headers\(\)|sesion\.email/, 'la rama NO propia usa el navegador, la IP o el email de quien mira');
  assert.match(noProp, /if \(actual\.guardada\) return;/);
  assert.match(noProp, /inferirZonaDesdeIntegraciones\(ws\)/);
  // La monta el layout para toda sesión que no sea la vieja compartida, y el cliente una vez por pestaña.
  assert.match(leer('app/layout.tsx'), /\{sesion && !sesion\.legacy && <ZonaDelNegocio \/>\}/);
  const cli = leer('app/_components/ZonaDelNegocio.tsx');
  assert.match(cli, /^'use client';/m);
  assert.match(cli, /sessionStorage/);
  assert.match(cli, /detectarZonaAction\(zonaDelNavegador\(\)\)/);
});

test('la zona se lee y se escribe en UN lugar: lib/timezone.ts (y una persona escribe con origen «persona»)', () => {
  const MIOS = [
    'lib/zona-negocio-reglas.ts', 'app/_components/ZonaDelNegocio.tsx', 'app/_components/zona-actions.ts', 'app/layout.tsx',
    'app/configuraciones/horario-actions.ts', 'app/configuraciones/HorarioEnvioPanel.tsx', 'lib/api-mako/areas/equipo.run.ts',
    'lib/api-mako/areas/equipo.def.ts', 'lib/api-mako/areas/contenido.helpers.ts', 'lib/api-mako/areas/email.helpers.ts',
    'lib/avisos-programados.ts', 'lib/lineas-vigilante.ts', 'lib/reunion-auto.ts', 'lib/acento-workspace.ts',
  ];
  for (const f of MIOS) {
    const src = sinComentarios(leer(f));
    assert.doesNotMatch(src, /(get|set)Setting(Estricto)?\(\s*KEY_TIMEZONE/, `${f} lee o escribe la zona a mano`);
    assert.doesNotMatch(src, /cambiarSettingSi\(\s*KEY_TIMEZONE/, `${f} escribe la zona a mano`);
    assert.doesNotMatch(src, /zonaDelMotor|ZONA_SIN_CONFIGURAR/, `${f} usa el default viejo del motor (Ciudad de México)`);
    assert.doesNotMatch(src, /\.catch\(\(\) => 'America\/Tijuana'\)/, `${f} tiene un default suelto`);
  }
  const acc = sinComentarios(leer('app/configuraciones/horario-actions.ts'));
  assert.match(acc, /fijarZonaDelNegocio\(ws, z, 'persona', /);
  assert.match(acc, /zonaDelNegocioDetalle\(ws\)/);
  const api = sinComentarios(leer('lib/api-mako/areas/equipo.run.ts'));
  assert.match(api, /fijarZonaDelNegocio\(ctx\.ws, String\(payload\.timezone \?\? ''\), 'persona', /);
  // El escritor: compare-and-set sobre updated_at, y la zona antes que el origen.
  const tz = sinComentarios(leer('lib/timezone.ts'));
  const esc = tz.slice(tz.indexOf('export async function fijarZonaDelNegocio('), tz.indexOf('export async function setTimezoneWorkspace('));
  assert.match(tz, /\.eq\('updated_at', leidoUpdatedAt\)/);
  assert.match(esc, /decidirZona\(/);
  assert.ok(esc.indexOf('escribirZonaSi(') > 0 && esc.indexOf('escribirZonaSi(') < esc.indexOf('KEY_TIMEZONE_ORIGEN'), 'el origen se escribe antes de ganar la zona');
});

// ── UN solo default (ola 3, w3-motor-integracion) ─────────────────────────────────────────────────
// Hasta la ola 3 el motor tenía su propio default (`ZONA_SIN_CONFIGURAR` = Ciudad de México) y su propia lectura
// (`getSetting(KEY_TIMEZONE)` → `zonaDelMotor`). Ahora `zonaDelMotor` ES `zonaDeLoGuardado`, el tick usa
// `zonaDeLoGuardado` y el motor lee con `zonaDelNegocioEstricta`: las tres respuestas, y la de `tzDeWorkspace`, son UNA.

/** Lo que `mako.timezone` puede tener guardado: nada (sin fila), vacío, basura, un alias, mayúsculas y una válida. */
const GUARDADOS: Array<string | null> = [null, '', '   ', 'Marte/Olympus', 'America/Buenos_Aires', 'America/Ensenada', ' america/tijuana ', 'America/Cancun', 'UTC'];

/** `tzDeWorkspace` de VERDAD (lib/timezone.ts, `server-only`) en un node aparte, con la base de mentira: ws = índice + 1. */
function zonasDeTzDeWorkspace(): string[] {
  const url = (rel: string): string => JSON.stringify(pathToFileURL(join(raiz, rel)).href);
  const codigo = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const guardados = ${JSON.stringify(GUARDADOS)};
const db = { from: () => ({ select: () => ({ eq: (_c, ws) => ({ in: async () => ({
  data: guardados[ws - 1] == null ? [] : [{ key: 'mako.timezone', value: guardados[ws - 1], updated_at: '2026-10-11T00:00:00Z' }], error: null,
}) }) }) }) };
const sb = await import(${url('lib/supabase.ts')});
mock.module(${url('lib/supabase.ts')}, { exports: { ...real(sb), getSupabaseServer: () => db } });
const { tzDeWorkspace } = await import(${url('lib/timezone.ts')});
const out = [];
for (let i = 0; i < guardados.length; i++) out.push(await tzDeWorkspace(i + 1));
console.log(JSON.stringify(out));
`;
  const salida = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: raiz, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = salida.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as string[];
}

test('UN solo default: el motor, el tick y tzDeWorkspace leen la MISMA zona para lo que esté guardado', () => {
  const pantallas = zonasDeTzDeWorkspace();
  GUARDADOS.forEach((g, i) => {
    assert.equal(pantallas[i], zonaDeLoGuardado(g), `«${String(g)}»: tzDeWorkspace no lee la zona como el motor y el tick`);
  });
  // Lo medido: sin zona (el ws1), Tijuana; nunca Ciudad de México.
  assert.equal(zonaDeLoGuardado(null), ZONA_POR_DEFECTO);
  assert.equal(pantallas[0], 'America/Tijuana');
  assert.equal(pantallas[4], 'America/Argentina/Buenos_Aires', 'el alias del ws13 es la zona de la lista');
});

/** Los `.ts`/`.tsx` de una carpeta, del DISCO (un guard sobre `git ls-files` no ve lo nuevo). */
function fuentes(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(raiz, dir))) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const r = `${dir}/${n}`;
    if (statSync(join(raiz, r)).isDirectory()) out.push(...fuentes(r));
    else if (/\.tsx?$/.test(n)) out.push(r);
  }
  return out;
}
/** El fuente sin comentarios (un guard que lee el fuente también leería las citas de lo que prohíbe). */
const sinNotas = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Dónde `'America/Mexico_City'` es un DATO y no un default: las listas de zonas (la del teléfono `ZONAS_POR_PAIS`, la de
 * Meta por país y el selector del perfil) y la tabla de acentos. Un default nuevo cae en el barrido.
 */
const LISTAS: Record<string, number> = {
  'lib/disparadores.ts': 1, // ZONAS_POR_PAIS (la lista de México)
  'lib/meta-pais.ts': 1, // zona → país de Meta
  'lib/acento-workspace.ts': 1, // POR_ZONA: el acento de CDMX
  'app/perfil/InformacionPersonal.tsx': 1, // el selector de zona del perfil
};
/**
 * PENDIENTE (no es de este paquete): un default propio que contradice «un solo default». Se pidió el cambio al cierre de
 * la ola; cuando se arregle, este barrido falla y se borra la línea.
 */
const PENDIENTES: Record<string, number> = {
  'lib/offer-pdf.ts': 1, // `fechaCorta`: `zona || 'America/Mexico_City'` (Offer) → `zonaDeLoGuardado(zona)`
};

test('el default viejo del motor no existe, y Ciudad de México sólo aparece como un dato de una lista', () => {
  const conCdmx: Record<string, number> = {};
  for (const f of [...fuentes('lib'), ...fuentes('app')]) {
    const src = sinNotas(leer(f));
    assert.doesNotMatch(src, /ZONA_SIN_CONFIGURAR/, `${f}: volvió el default del motor (Ciudad de México)`);
    const n = (src.match(/America\/Mexico_City/g) ?? []).length;
    if (n) conCdmx[f] = n;
  }
  assert.deepEqual(conCdmx, { ...LISTAS, ...PENDIENTES }, 'un literal de Ciudad de México que no es una lista es un segundo default');
  // El motor y el tick: ni el literal ni su propia lectura de la zona.
  const nut = sinNotas(leer('lib/nutricion.ts'));
  assert.doesNotMatch(nut, /getSetting\(KEY_TIMEZONE\)|zonaDelMotor\(/);
  assert.match(nut, /zonaDelNegocioEstricta\(ws\)/);
  // El motor usa `zonaDeLoGuardado` por su nombre (el alias `zonaDelMotor` se borró en el cierre de la ola 3).
  assert.doesNotMatch(sinNotas(leer('lib/nutricion-grafo-motor.ts')), /zonaDelMotor/);
  assert.match(sinNotas(leer('lib/nutricion-grafo-motor.ts')), /const zona = zonaDeLoGuardado\(tz\);/);
  assert.match(sinNotas(leer('app/api/cron/nutricion-tick/route.ts')), /zonaDeLoGuardado\(zonaDe\.get\(ws\)\)/);
});

// ── ROTURAS de la ola 3 (11/10/2026, arnés scratchpad/wf-undecima/w3-motor-integracion/romper.cjs) ─────────────────
// Una por vez, restaurada por md5 desde la copia en memoria. R1 (`zonaDelMotor` a Ciudad de México sin zona) tumba los dos
// tests de arriba; R2 (la ventana del motor a Ciudad de México si no lee) y R6 (`zonaPara` mirando el destino), el barrido.
// Los números, al pie de tests/undecima-motor-integracion.test.ts.
