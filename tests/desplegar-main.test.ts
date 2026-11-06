// =============================================================================
// Compilar producción una vez por día y sólo si hace falta (6/11/2026)
// =============================================================================
// Un push a main no compila: lo hace /api/cron/desplegar-main. Compilar de más cuesta plata, y no compilar deja producción
// vieja sin que nadie lo vea, así que ante la duda compila. El gasto: docs/hallazgos-infra.md, «El gasto de Vercel».
// PROBADO ROMPIÉNDOLO (6/11/2026), con éste y tests/vercel-saltar-build.test.ts en verde (11 / 0), una rotura por vez (pasan / fallan):
//   · compila con otra compilación en curso              → 10 / 1
//   · sin saber qué cambió, no compila                   → 10 / 1
//   · compila cuando sólo cambian documentos             → 10 / 1
//   · los dos documentos de producto no compilan         → 10 / 1
//   · main vuelve a compilar con cada push               → 9 / 2
//   · sin el cron que lleva los cambios a producción     → 10 / 1
// Y el 6/11/2026, con main rojo (la marca ci-rojo/main del chequeo diario sobre main; base 7 / 0 en este archivo):
//   · sin el freno (compila con main rojo)                             → 6 / 1
//   · `mainRojo` null o ausente tratado como rojo (frena sin saber)     → 4 / 3
//   · `decision.hacer === 'nada'` en vez de `!== 'compilar'` en la lib  → 6 / 1
// Correr: node --import tsx --test tests/desplegar-main.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cambioLlegaALaApp, decidirDespliegue, MOTIVO_MAIN_ROJO, TOPE_ARCHIVOS_GITHUB } from '../lib/desplegar-main-reglas';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8');
const base = { enCurso: false, enProduccion: 'aaa', main: 'bbb', adelante: 3, archivos: ['lib/x.ts'] as readonly string[] | null };

test('compila si main tiene algo nuevo de la app', () => {
  assert.equal(decidirDespliegue(base).hacer, 'compilar');
  assert.equal(decidirDespliegue({ ...base, archivos: ['docs/a.md', 'app/page.tsx'] }).hacer, 'compilar');
});

test('no compila si no hay nada que valga: sin cambios, sólo documentos, o ya compilando', () => {
  assert.equal(decidirDespliegue({ ...base, main: 'aaa' }).hacer, 'nada');
  assert.equal(decidirDespliegue({ ...base, archivos: ['docs/a.md', 'tests/b.test.ts', '.github/c.yml', 'AGENTS.md'] }).hacer, 'nada');
  assert.equal(decidirDespliegue({ ...base, enCurso: true }).hacer, 'nada');
  assert.equal(decidirDespliegue({ ...base, adelante: 0 }).hacer, 'nada', 'producción no está atrás de main');
});

test('ante la duda compila: sin saber qué hay en producción, sin saber qué cambió, o con la lista cortada', () => {
  assert.equal(decidirDespliegue({ ...base, enProduccion: null }).hacer, 'compilar');
  assert.equal(decidirDespliegue({ ...base, archivos: null }).hacer, 'compilar');
  assert.equal(decidirDespliegue({ ...base, archivos: Array.from({ length: TOPE_ARCHIVOS_GITHUB }, (_, i) => `docs/${i}.md`) }).hacer, 'compilar');
});

test('la lista de lo que no sale en la app es la misma que la del script de Vercel, y los documentos de producto compilan', () => {
  const script = leer('scripts/vercel-saltar-build.sh');
  for (const a of ['docs/', 'tests/', '.github/', '.claude/', 'AGENTS.md', 'CLAUDE.md', 'README.md']) assert.ok(script.includes(a.endsWith('/') ? `${a}*` : a), `${a} no está en el script`);
  for (const f of ['docs/a.md', 'tests/a.ts', '.github/a.yml', '.claude/a', 'AGENTS.md', 'CLAUDE.md', 'README.md']) assert.equal(cambioLlegaALaApp(f), false, f);
  for (const f of ['lib/a.ts', 'app/a.tsx', 'vercel.json', 'package.json', 'scripts/a.mjs', 'public/a.png']) assert.equal(cambioLlegaALaApp(f), true, f);
  const next = leer('next.config.ts');
  const traidos = [...next.matchAll(/'\.\/docs\/([a-z0-9-]+\.md)'/g)].map((m) => m[1]);
  assert.ok(traidos.length >= 2);
  for (const d of traidos) assert.equal(cambioLlegaALaApp(`docs/${d}`), true, `${d} entra al deploy de una pantalla`);
});

test('vercel.json: main no compila solo, y el cron que lo reemplaza corre una vez por día', () => {
  const v = JSON.parse(leer('vercel.json')) as { git?: { deploymentEnabled?: Record<string, boolean> }; crons: Array<{ path: string; schedule: string }> };
  assert.equal(v.git?.deploymentEnabled?.main, false);
  const c = v.crons.find((x) => x.path === '/api/cron/desplegar-main');
  assert.ok(c, 'sin este cron, ningún cambio llega a producción');
  assert.match(c.schedule, /^\d+ \d+ \* \* \*$/, 'Martín eligió 1 por día: cada compilación cuesta hasta US$0,42');
});

test('la ruta pide el secreto del cron, y el modo en seco o un despliegue frenado no compilan', () => {
  assert.match(leer('app/api/cron/desplegar-main/route.ts'), /checkCronAuth\(req\)/);
  const lib = leer('lib/desplegar-main.ts');
  assert.match(lib, /decision\.hacer !== 'compilar' \|\| o\.dry/);
  assert.ok(lib.indexOf("decision.hacer !== 'compilar' || o.dry") < lib.indexOf('/v13/deployments'), 'el modo en seco y el frenado tienen que volver antes de compilar');
  assert.match(lib, /mainRojo,/, 'la lib le pasa la marca a la regla');
});

test('con main rojo (ci-rojo/main) no compila y lo dice; sin saber si está rojo, compila (ante la duda)', () => {
  const frenado = decidirDespliegue({ ...base, mainRojo: true });
  assert.equal(frenado.hacer, 'frenar');
  assert.equal(frenado.motivo, MOTIVO_MAIN_ROJO);
  assert.match(frenado.motivo, /desplegar-ya/, 'dice cómo sacar lo urgente');
  assert.equal(decidirDespliegue({ ...base, enProduccion: null, mainRojo: true }).hacer, 'frenar', 'sin saber qué hay en producción, igual no sale lo rojo');
  assert.equal(decidirDespliegue({ ...base, mainRojo: false }).hacer, 'compilar');
  assert.equal(decidirDespliegue({ ...base, mainRojo: null }).hacer, 'compilar', 'un token vencido no deja producción vieja');
  assert.equal(decidirDespliegue({ ...base, main: 'aaa', mainRojo: true }).hacer, 'nada', 'si producción ya tiene main, no hay nada que frenar');
  assert.equal(decidirDespliegue({ ...base, archivos: ['docs/a.md'], mainRojo: true }).hacer, 'nada', 'sólo documentos: no iba a compilar');
});
