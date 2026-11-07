// =============================================================================
// scripts/limpiar-temporales.mjs y scripts/perfil-cdp.mjs: lo que se deja en %TEMP% (6/11/2026)
// =============================================================================
// Pendiente: «unos scripts llenan el disco: hasta 1 GB por día que nadie borra». Medido ese día: `tsx-marti` tenía 216.852
// entradas de primer nivel y `mako-cdp-*` tenía 0 — el agujero de los perfiles existía (ninguno de los tres scripts borraba
// el suyo) pero no era el que ocupaba el disco.
//
// Se corre el código de verdad, con un %TEMP% de mentira en una carpeta descartable.
//
// PROBADO ROMPIÉNDOLO (6/11/2026; base 4 / 0). Pasan / fallan:
//   · `aBorrar` sin el corte por fecha (se lleva lo de hoy, que está en uso)   → 2 / 2
//   · `tsx-` marcado con `adentro: false` (borra la carpeta raíz de la caché)  → 3 / 1
//   · los tres scripts de CDP vuelven al `mkdtempSync` suelto                  → 3 / 1
// Correr: node --import tsx --test tests/limpiar-temporales.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Es un `.mjs` (un script, no código de la app) y el tsconfig lo resuelve con `allowJs`, igual que
// tests/minutos-actions.test.ts con scripts/minutos-actions.mjs. ⚠️ SIN `@ts-expect-error`: no hay ningún error que esperar,
// y un directivo sin usar ES un error de tipos (TS2578) — fue el rojo de este mismo cambio. Ningún test del repo lo usa.
import { aBorrar, BLANCOS } from '../scripts/limpiar-temporales.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

const DIA = 86_400_000;
/** Un %TEMP% de mentira: carpetas con la fecha que se les pida. */
function temp(entradas: Array<{ ruta: string; diasAtras: number }>) {
  const base = mkdtempSync(join(tmpdir(), 'limpiar-test-'));
  for (const e of entradas) {
    const full = join(base, e.ruta);
    mkdirSync(dirname(full), { recursive: true });
    mkdirSync(full, { recursive: true });
    writeFileSync(join(full, 'x'), 'x');
    const t = (Date.now() - e.diasAtras * DIA) / 1000;
    utimesSync(full, t, t);
  }
  return base;
}

test('se barre lo viejo y NO lo de hoy: la caché la está usando un chat ahora mismo', () => {
  const base = temp([
    { ruta: 'mako-cdp-viejo', diasAtras: 5 },
    { ruta: 'mako-cdp-dehoy', diasAtras: 0 },
    { ruta: 'tsx-marti/entrada-vieja', diasAtras: 9 },
    { ruta: 'tsx-marti/entrada-de-hoy', diasAtras: 0 },
    { ruta: 'otra-cosa-ajena', diasAtras: 30 },
  ]);
  try {
    const rutas = aBorrar({ base, dias: 2 }).map((x: { ruta: string }) => x.ruta.slice(base.length + 1).replace(/\\/g, '/'));
    assert.deepEqual(rutas.sort(), ['mako-cdp-viejo', 'tsx-marti/entrada-vieja']);
    // Nada ajeno a los blancos, ni la carpeta raíz de la caché.
    assert.ok(!rutas.some((r) => r === 'tsx-marti'), 'la raíz de la caché de tsx no se borra: se reusa');
    assert.ok(!rutas.some((r) => r.includes('ajena')), 'no toca lo que no es de estos scripts');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('la caché de tsx se vacía por dentro; un perfil de Chrome se borra entero', () => {
  // El tipo se declara acá (el .mjs no lo trae) y se afirma que el blanco EXISTE: un `find` que no encuentra devuelve
  // undefined, y `undefined.adentro` sería un error de tipos, no un test.
  const blancos = BLANCOS as ReadonlyArray<{ patron: RegExp; adentro: boolean; que: string }>;
  const tsx = blancos.find((b) => b.patron.test('tsx-marti'));
  const cdp = blancos.find((b) => b.patron.test('mako-cdp-abc'));
  assert.ok(tsx, 'hay un blanco para la caché de tsx');
  assert.ok(cdp, 'hay un blanco para los perfiles de Chrome');
  assert.equal(tsx.adentro, true, 'tsx se reusa: se borra lo de adentro');
  assert.equal(cdp.adentro, false, 'un perfil de Chrome es de una corrida: se borra entero');
});

test('con un %TEMP% que no se puede leer, no explota: no hay nada que borrar', () => {
  assert.deepEqual(aBorrar({ base: join(tmpdir(), 'no-existe-esta-carpeta-' + Math.random()) }), []);
});

test('los tres scripts de CDP borran su perfil al salir', () => {
  for (const f of ['scripts/mirar-consola.mjs', 'scripts/mirar-pantalla.mjs', 'scripts/onboarding-vg-recorrer.mjs']) {
    const s = leer(f);
    assert.match(s, /import \{ perfilTemporal \} from '\.\/perfil-cdp\.mjs';/, `${f} sin el perfil que se borra`);
    assert.match(s, /const \{ dir: perfil, aCargoDe \} = perfilTemporal\(\);/, `${f} sin perfilTemporal()`);
    assert.match(s, /const chrome = aCargoDe\(spawn\(/, `${f}: el perfil no sabe a qué Chrome matar antes de borrar`);
    assert.doesNotMatch(s, /mkdtempSync/, `${f} volvió al mkdtempSync suelto, que no borra nada`);
  }
  // Y el helper mata Chrome ANTES de borrar: en Windows un Chrome vivo tiene los archivos abiertos.
  const h = leer('scripts/perfil-cdp.mjs');
  const iKill = h.indexOf('hijo?.kill()');
  const iRm = h.indexOf('rmSync(dir');
  assert.ok(iKill > 0 && iRm > iKill, 'hay que matar Chrome antes de borrar su perfil');
  assert.match(h, /maxRetries/, 'Chrome tarda un instante en soltar los archivos después del kill');
  assert.match(h, /process\.on\('exit'/, 'el borrado va en exit: estos scripts mueren en cualquier await');
});

test('el barredor existe y no borra nada sin --aplicar', () => {
  const s = leer('scripts/limpiar-temporales.mjs');
  assert.match(s, /const aplicar = args\.includes\('--aplicar'\)/);
  assert.match(s, /if \(!aplicar\)/, 'sin --aplicar sólo dice qué borraría');
  // El orden importa: el `rmSync` vive después del corte de `--aplicar`.
  assert.ok(s.indexOf("if (!aplicar)") < s.indexOf('rmSync(x.ruta'), 'el rmSync tiene que estar detrás de --aplicar');
  assert.ok(readdirSync(join(RAIZ, 'scripts')).includes('perfil-cdp.mjs'));
});
