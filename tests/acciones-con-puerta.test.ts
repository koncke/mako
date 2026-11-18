// =============================================================================
// TODA server action de app/ corta sin sesión al arrancar, se llame como se llame su puerta (18/11/2026, F115)
// =============================================================================
// Una server action es un POST con un id que viaja en el bundle, y el proxy sólo valida la FIRMA de la cookie (la de un
// suspendido vale 30 días). tests/crm-acciones-sesion.test.ts lo exige en app/crm desde el 17/10; fuera del CRM, el 6/11 se midió
// a mano que los 60 archivos tenían su puerta, con 21 formas distintas, y no había nada que frenara al archivo 61
// (docs/hallazgos-seguridad.md, «Un grep del NOMBRE de un guard no mide si hay guard»).
//
// Esto barre TODOS los 'use server' de app/, función por función, con el analizador de tests/_puerta-acciones.ts: no busca un
// nombre, sigue cada llamada hasta el fondo (la del mismo archivo, la importada) y pregunta si la FORMA corta. El fondo
// —`getUsuarioActual` y `exigirSesion`— se EJECUTA sin sesión (tests/_puerta-acciones-hijo.ts), junto con lo que se arma encima
// (getRolWsEfectivo, getSesionAdmin, adminDeWorkspaceActual, requireSesion) y cinco acciones de verdad, una por forma: sin
// sesión ninguna llega a los datos. Y el analizador mismo se prueba con fuentes de mentira que tienen cada agujero conocido.
//
// Al armarlo aparecieron DOS acciones sin puerta, y se arreglaron: `estadoPuenteAction` y `estadoPruebaAction`
// (app/video-generator/puente-actions.ts), que leían el puente y un trabajo de la cola sin preguntar por la sesión.
//
// Probado rompiéndolo (18/11/2026), base 5 pases / 0 fallos, una rotura por vez y restaurando de memoria:
//   · sin `await exigirSesion();` en deleteLeadAction (app/crm/actions.ts)                     → 4 / 1
//   · `haySesion` de app/crm/ficha-actions.ts devolviendo `true` siempre                       → 4 / 1
//   · `if (admin)` en vez de `if (!puedeOperar(admin, …))` en pushesCentroAction                → 4 / 1
//   · `estadoPuenteAction` sin su corte (como estaba)                                           → 3 / 2 (el barrido y el hijo)
//   · `soloMiembro` de app/competitor-spy/actions.ts con la pregunta al revés                  → 3 / 2 (el barrido y el hijo)
// Y el analizador contra fuentes de mentira (el último test): nueve agujeros que tiene que ver y siete formas buenas.
// Correr: node --import tsx --test tests/acciones-con-puerta.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { Analizador, BASE, PREDICADOS } from './_puerta-acciones';
import { puedeOperar } from '../lib/operaciones-reglas';

const RAIZ = join(__dirname, '..');

test('cada export async function de los use server de app/ corta sin sesión al arrancar', () => {
  const a = new Analizador(RAIZ);
  const archivos = execFileSync('git', ['ls-files', 'app'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter((f) => /\.tsx?$/.test(f));
  const faltan: string[] = [];
  let acciones = 0, conArchivo = 0;
  for (const f of archivos) {
    const lista = a.acciones(f);
    if (!lista) continue;
    conArchivo++;
    for (const x of lista) {
      acciones++;
      const v = a.veredictoDeAccion(f, x.nombre);
      if (!v.corta) faltan.push(`${f} · ${x.nombre} — ${v.motivo}`);
    }
  }
  // El denominador: el 18/11/2026 eran 585 acciones en 98 archivos. Si baja de golpe, el barrido dejó de verlas.
  assert.ok(conArchivo >= 90 && acciones >= 550, `el barrido dejó de ver las acciones (${acciones} en ${conArchivo} archivos)`);
  assert.deepEqual(faltan, [], `estas acciones no cortan sin sesión al arrancar. La primera espera tiene que ser una puerta (\`await exigirSesion();\` de lib/sesion-accion.ts, o la de su tab):\n${faltan.join('\n')}`);
});

// ── El fondo y unas acciones de verdad, ejecutadas sin sesión ──────────────────────────────────────────────────────────────
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_puerta-acciones-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 240_000,
});
type Corrida = { dio: unknown; tiro: string | null; base: string[] };
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, Record<string, Corrida>>;

test('el fondo, sin cookie y con una cookie falsa: null o tira, y sin tocar la base', () => {
  assert.deepEqual(Object.keys(BASE).sort(), ['exigirSesion', 'getUsuarioActual'], 'una puerta nueva en el fondo se ejecuta acá antes de sumarla');
  for (const cual of ['sinCookie', 'cookieFalsa']) {
    const r = R[cual];
    for (const nombre of ['getUsuarioActual', 'getRolWsEfectivo', 'getSesionAdmin', 'adminDeWorkspaceActual']) {
      assert.deepEqual({ dio: r[nombre].dio, tiro: r[nombre].tiro }, { dio: null, tiro: null }, `${cual} · ${nombre} tiene que devolver null`);
    }
    assert.match(String(r.exigirSesion.tiro), /sesión no está activa/, `${cual} · exigirSesion tiene que tirar`);
    assert.match(String(r.requireSesion.tiro), /^NEXT_REDIRECT;replace;\/login;/, `${cual} · requireSesion tiene que mandar a /login`);
    for (const [nombre, c] of Object.entries(r)) assert.deepEqual(c.base, [], `${cual} · ${nombre} tocó la base sin sesión`);
  }
});

test('cinco acciones de verdad, una por forma de puerta: sin sesión no llegan a los datos', () => {
  const a = R.acciones;
  assert.match(String(a['getEquipoAction (exigirSesion)'].tiro), /sesión no está activa/);
  assert.deepEqual(a['estadoPuenteAction (getRolWsEfectivo)'].dio, { estado: 'sin_conectar', detalle: '', etiqueta: '', projectId: '', ultimoVisto: null, emparejado: false, version: '' });
  assert.deepEqual((a['estadoPruebaAction (getRolWsEfectivo)'].dio as { prueba: unknown }).prueba, null);
  assert.equal((a['pushesCentroAction (getSesionAdmin + puedeOperar)'].dio as { ok: boolean }).ok, false);
  assert.equal((a['competidoresAction (soloMiembro)'].dio as { ok: boolean }).ok, false);
  // Lo único que se puede leer antes de la puerta es el contexto (cuál es la plataforma: `workspaces`).
  for (const [nombre, c] of Object.entries(a)) {
    assert.deepEqual(c.base.filter((t) => t !== 'workspaces'), [], `${nombre} llegó a la base sin sesión: ${c.base.join(', ')}`);
  }
});

test('los predicados que valen como puerta, ejecutados: sin sesión dan false', () => {
  assert.deepEqual(Object.keys(PREDICADOS), ['puedeOperar'], 'un predicado nuevo se ejecuta acá antes de sumarlo');
  assert.equal(puedeOperar(null, 9), false);
  assert.equal(puedeOperar(undefined, 9), false);
});

// ── El analizador, contra fuentes de mentira con cada agujero ──────────────────────────────────────────────────────────────
test('el analizador NO se deja engañar: cada agujero conocido da «no corta», y cada forma buena da «corta»', () => {
  const dir = mkdtempSync(join(tmpdir(), 'puertas-'));
  const escribir = (rel: string, src: string) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), src); };
  try {
    escribir('lib/auth.ts', "export async function getUsuarioActual() { return null; }\nexport async function getSesionAdmin() {\n  const s = await getUsuarioActual();\n  if (!s) return null;\n  return s;\n}\n");
    escribir('lib/sesion-accion.ts', 'export async function exigirSesion() {}\n');
    const cabeza = "'use server';\nimport { getUsuarioActual, getSesionAdmin } from '@/lib/auth';\nimport { exigirSesion } from '@/lib/sesion-accion';\nimport { borrar, leer } from '@/lib/datos';\n";
    const malas: Record<string, string> = {
      sinPuerta: 'export async function f() { return borrar(); }',
      leeAntes: 'export async function f() { const x = await leer(); await exigirSesion(); return x; }',
      alReves: 'export async function f() { const s = await getSesionAdmin(); if (s) return null; return borrar(); }',
      ignorada: 'export async function f() { const s = await getSesionAdmin(); await borrar(); return s; }',
      tragada: 'export async function f() { try { await exigirSesion(); } catch { /* sigue */ } return borrar(); }',
      helperSinPuerta: 'async function guard() { return true; }\nexport async function f() { if (!(await guard())) return null; return borrar(); }',
      ternarioConDatos: 'export async function f() { return (await getUsuarioActual()) ? null : await leer(); }',
      impostora: 'async function getUsuarioActual() { return { id: 1 }; }\nexport async function f() { const s = await getUsuarioActual(); if (!s) return null; return borrar(); }',
      predicadoCualquiera: 'function cualquiera(_s: unknown) { return true; }\nexport async function f() { const s = await getSesionAdmin(); if (!cualquiera(s)) return null; return borrar(); }',
    };
    const buenas: Record<string, string> = {
      exigir: 'export async function f() { await exigirSesion(); return borrar(); }',
      validarAntes: "export async function f(id: unknown) { if (typeof id !== 'number') return null; await exigirSesion(); return borrar(); }",
      nula: 'export async function f() { const s = await getSesionAdmin(); if (!s) return null; return borrar(); }',
      enLaCondicion: 'export async function f() { if (!(await getUsuarioActual())) return null; return borrar(); }',
      helper: "async function noPuede() { return (await getUsuarioActual()) ? null : 'Entra.'; }\nexport async function f() { const no = await noPuede(); if (no) return { error: no }; return borrar(); }",
      envoltorio: 'async function conSesion<T>(fn: () => Promise<T>) { const s = await getUsuarioActual(); if (!s) return null; return fn(); }\nexport async function f() { return conSesion(() => borrar()); }',
      tryQueCorta: "export async function f() { try { await exigirSesion(); return await borrar(); } catch { return { error: 'x' }; } }",
    };
    const a = new Analizador(dir);
    const verificar = (casos: Record<string, string>, espera: boolean) => {
      for (const [nombre, src] of Object.entries(casos)) {
        const rel = `app/casos/${nombre}.ts`;
        escribir(rel, cabeza + src + '\n');
        const v = a.veredictoDeAccion(rel, 'f');
        assert.equal(v.corta, espera, `${nombre}: ${espera ? 'es una puerta y no la vio' : 'es un agujero y lo dejó pasar'} (${JSON.stringify(v)})`);
      }
    };
    verificar(malas, false);
    verificar(buenas, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
