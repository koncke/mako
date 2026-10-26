// =============================================================================
// Las pruebas A/B se guardan, se leen una vez por día y concluyen en Experimentos (tanda A2, 25/10/2026)
// =============================================================================
// El Cerebro (25/10): «A2. Tablas (migración sin número: la numero yo, y se aplica con el sí de Martín), store, un solo cron
// diario, y `concluir` hacia `experimentos`, con el formato `ab:` arreglado en `fmtVal`». Fija:
//   · la migración: cinco tablas con `workspace_id` SIN default (el 1 es un cliente), RLS sin políticas y revoke; una prueba
//     viva por lugar; «desconocido» nunca se asigna; y las cinco en TABLAS_DE_INQUILINO;
//   · concluir: validada sólo si gana B, refutada sólo con daño demostrado, «da lo mismo» NO es refutada; el aprendizaje
//     cita el intervalo; la fila lleva el ws explícito, «ab:<métrica>», los valores en % y la letra de la rama;
//   · `fmtVal` con «ab:» (9,4 % y no 9; 0,09 % y no 0) y la tarjeta que dice «A / B»;
//   · lo que MaKo cita: «PROBADO QUE NO FUNCIONA» sólo de una prueba A/B, nunca de un antes/después;
//   · la lectura: las ventanas terminan ayer, el día de la época, sólo las maduras al medidor;
//   · el store: el ws explícito en cada consulta, concluir y arrancar RECLAMAN, servir relee lo escrito y sin poder
//     escribir sirve el control; la corrida no juzga con una lectura que falló; el cron diario está agendado.
// Correr: node --import tsx --test tests/pruebas-guardar.test.ts
// ROTURAS (25/10/2026, una por vez y restaurada): ver el pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';
import { juzgar, type ConteoRama, type Regla } from '../lib/pruebas/juez';
import { aprendizajeDe, filaDeExperimento, veredictoDeExperimento, type PruebaParaConcluir } from '../lib/pruebas/concluir';
import { diaDeLaPrueba, finDeAyer, maduras } from '../lib/pruebas/lectura';
import { problemasDeNuevaPrueba, type NuevaPrueba } from '../lib/pruebas/nueva';
import { esPruebaAB, fmtVal } from '../lib/experimentos-formato';
import { textoDeVerdades, type ExperimentoParaVerdades } from '../lib/experimentos-verdades';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, '');
const TABLAS = ['pruebas', 'prueba_variantes', 'prueba_asignaciones', 'prueba_lecturas', 'prueba_historial'];

test('la migración: cinco tablas con workspace_id sin default, RLS y revoke, una viva por lugar, y en TABLAS_DE_INQUILINO', () => {
  const sql = leer('supabase/migrations/0335_pruebas_ab.sql').replace(/--[^\n]*/g, '');
  for (const t of TABLAS) {
    const cuerpo = new RegExp(`create table if not exists ${t} \\(([\\s\\S]*?)\\n\\);`).exec(sql)?.[1];
    assert.ok(cuerpo, `falta la tabla ${t}`);
    const ws = /^\s*workspace_id\s+([^\n]+)$/m.exec(cuerpo!)?.[1] ?? '';
    assert.match(ws, /^bigint not null references workspaces\(id\) on delete cascade,$/, `${t}: workspace_id ${ws}`);
    assert.doesNotMatch(ws, /default/i, `${t}: workspace_id con default (el 1 es un cliente)`);
    assert.match(sql, new RegExp(`alter table ${t} enable row level security;`), `${t} sin RLS`);
    assert.match(sql, new RegExp(`revoke all on ${t} from anon, authenticated;`), `${t} sin revoke`);
    assert.ok((TABLAS_DE_INQUILINO as readonly string[]).includes(t), `${t} no está en TABLAS_DE_INQUILINO`);
  }
  assert.match(sql, /create unique index if not exists pruebas_una_viva_por_lugar on pruebas \(workspace_id, clave_lugar\) where estado in \('propuesta', 'corriendo'\);/);
  assert.match(sql, /lower\(unidad\) <> 'desconocido'/);
  assert.match(sql, /primary key \(prueba_id, unidad\)/, 'una unidad con dos ramas');
  assert.match(sql, /primary key \(prueba_id, fecha, variante\)/, 'el cron dos veces el mismo día duplicaría');
});

// ── concluir ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const REGLA: Regla = { nPorRama: 300, minDias: 7, maxDias: 60, mdeRel: 0.8 };
const ramas = (a: [number, number], b: [number, number]): ConteoRama[] => [{ clave: 'A', control: true, n: a[0], x: a[1] }, { clave: 'B', n: b[0], x: b[1] }];
const P: PruebaParaConcluir = {
  id: 41, superficie: 'automatizacion', titulo: 'El audio de apertura', hipotesis: 'Un audio responde más que un texto', cambio: 'B abre con un audio',
  origen: 'dueno', metrica: 'respondio', ventanaDias: 7, iniciadaAt: '2026-11-01T12:00:00.000Z', mdeRel: 0.8,
  ramas: [{ clave: 'A', nombre: 'Sin cambio', control: true }, { clave: 'B', nombre: 'Con audio', control: false }],
};
const concluye = (a: [number, number], b: [number, number]) => {
  const j = juzgar({ dia: 30, ramas: ramas(a, b) }, REGLA);
  if (j.accion !== 'concluir') throw new Error(`no concluyó: ${j.accion}`);
  return j;
};

test('concluir: validada si gana B, refutada sólo con daño, «da lo mismo» NO es refutada, y el aprendizaje cita el intervalo', () => {
  assert.equal(veredictoDeExperimento('gana_variante'), 'validada');
  assert.equal(veredictoDeExperimento('gana_control'), 'refutada');
  assert.equal(veredictoDeExperimento('da_lo_mismo'), 'no_concluyente', '«no se vio una diferencia» no es «probado que no funciona»');
  assert.equal(veredictoDeExperimento('no_concluyente'), 'no_concluyente');
  const gana = concluye([300, 30], [300, 60]);
  assert.match(aprendizajeDe(P, gana), /^La versión B \(«Con audio»\) subió «Respondió» de 10 % a 20 % \(A 300 \/ B 300 personas\): con 90 % de seguridad, entre \+[\d,]+ % y \+[\d,]+ %\.$/);
  const pierde = concluye([300, 40], [300, 15]);
  assert.match(aprendizajeDe(P, pierde), /bajó «Respondió» de 13,3 % a 5 % .*entre −[\d,]+ % y −[\d,]+ %\. Probado que no funciona\.$/);
  const igual = concluye([300, 30], [300, 31]);
  assert.match(aprendizajeDe(P, igual), /^No se vio una diferencia mayor a 80 % en «Respondió» entre A \(10 %\) y B \(«Con audio»\) \(10,3 %\), con A 300 \/ B 300 personas\.$/);
});

test('la fila de experimentos: el ws explícito, «ab:<métrica>», los valores en %, la letra de la rama y el id de la prueba', () => {
  const j = concluye([300, 30], [300, 60]);
  const f = filaDeExperimento(13, P, j, '2026-12-01T06:15:00.000Z');
  assert.equal(f.workspace_id, 13);
  assert.equal(f.estado, 'cerrado');
  assert.equal(f.metrica, 'ab:respondio');
  assert.equal(f.metrica_label, 'Respondió (A / B)');
  assert.equal(f.baseline_valor, 10);
  assert.equal(f.resultado_valor, 20);
  assert.equal(f.veredicto, 'validada');
  assert.equal(f.fecha_inicio, '2026-11-01');
  assert.equal(f.fecha_fin, '2026-12-01');
  const config = f.config as { prueba_id: number; variante: string; veredicto_prueba: string };
  assert.equal(config.prueba_id, 41);
  assert.equal(config.variante, 'B');
  assert.equal(config.veredicto_prueba, 'gana_variante');
});

test('fmtVal con «ab:»: en %, con un decimal (antes caía en «num» y 9,4 daba 9), y la tarjeta dice A y la letra de la rama', () => {
  assert.equal(fmtVal(9.44, 'ab:respondio'), '9.4%');
  assert.equal(fmtVal(0.09, 'ab:clic_conversion'), '0.1%');
  assert.equal(fmtVal(9.44, 'agendamientos'), '9', 'las métricas de siempre no cambian');
  assert.equal(esPruebaAB('ab:x'), true);
  assert.equal(esPruebaAB('cpl'), false);
  const tarjeta = leer('app/dashboard/ElementoExperimento.tsx');
  assert.match(tarjeta, /antes=\{esPruebaAB\(metrica\) \? `A \$\{fmtVal\(leido\.baseline_valor, metrica\)\}` : fmtVal\(leido\.baseline_valor, metrica\)\}/);
  assert.match(tarjeta, /ahora=\{esPruebaAB\(metrica\) \? `\$\{leido\.config\?\.variante \?\? 'B'\} \$\{fmtVal\(leido\.resultado_valor, metrica\)\}`/);
});

test('lo que MaKo cita: «PROBADO QUE NO FUNCIONA» sólo de una prueba A/B; un antes/después refutado no entra', () => {
  const e = (x: Partial<ExperimentoParaVerdades>): ExperimentoParaVerdades => ({ titulo: 't', estado: 'cerrado', veredicto: null, aprendizaje: null, metrica: 'cpl', metrica_label: null, config: null, ...x });
  const t = textoDeVerdades([
    e({ veredicto: 'validada', aprendizaje: 'El audio subió las respuestas' }),
    e({ veredicto: 'refutada', aprendizaje: 'La B de la prueba bajó las respuestas', metrica: 'ab:respondio', config: { prueba_id: 41 } }),
    e({ veredicto: 'refutada', aprendizaje: 'Bajar el precio no subió el CPL' }),
    e({ veredicto: 'no_concluyente', aprendizaje: 'No se vio una diferencia', config: { prueba_id: 42 } }),
    e({ estado: 'activo', titulo: 'Hook nuevo', metrica_label: 'CPL' }),
  ]);
  assert.match(t, /VERDADES VALIDADAS[^\n]*\n- El audio subió las respuestas/);
  assert.match(t, /PROBADO QUE NO FUNCIONA[^\n]*\n- La B de la prueba bajó las respuestas/);
  assert.doesNotMatch(t, /Bajar el precio/, 'un antes/después refutado no es «probado que no funciona»');
  assert.doesNotMatch(t, /No se vio una diferencia/);
  assert.match(t, /EXPERIMENTOS EN CURSO[^\n]*\n- "Hook nuevo" mide CPL/);
  assert.equal(textoDeVerdades([]), '');
  assert.match(sinComentarios(leer('lib/experimentos.ts')), /return textoDeVerdades\(todos\);/, 'resumenExperimentos no pasa por el módulo puro');
});

test('la lectura: termina ayer (medianoche UTC), el día cuenta desde la época, y al medidor sólo las maduras', () => {
  assert.equal(finDeAyer(new Date('2026-11-20T06:15:00.000Z')), '2026-11-20T00:00:00.000Z');
  assert.equal(diaDeLaPrueba('2026-11-19T00:00:00.000Z', '2026-11-20T00:00:00.000Z'), 2);
  assert.equal(diaDeLaPrueba('2026-11-20T00:00:00.000Z', '2026-11-20T00:00:00.000Z'), 1);
  assert.equal(diaDeLaPrueba(null, '2026-11-20T00:00:00.000Z'), 0);
  const a = [
    { unidad: '1', rama: 'A', asignadaAt: '2026-11-12T23:59:00.000Z' },
    { unidad: '2', rama: 'B', asignadaAt: '2026-11-13T00:00:00.000Z' },
    { unidad: '3', rama: 'B', asignadaAt: '2026-11-13T00:01:00.000Z' },
  ];
  assert.deepEqual(maduras(a, 7, '2026-11-20T00:00:00.000Z').map((x) => x.unidad), ['1', '2']);
});

test('una prueba nueva: sin plan, sin lugar, con ramas o métrica malas, no se crea', () => {
  const ok: NuevaPrueba = {
    superficie: 'automatizacion', lugar: { secuencia_id: 9, nodo_id: 'ab1' }, claveLugar: 'auto:9', titulo: 'Audio', hipotesis: 'h', origen: 'dueno',
    metrica: 'respondio', guardrails: [{ metrica: 'agendo', toleranciaRel: 0.1 }], ventanaDias: 7, mdeRel: 0.8, nPorRama: 315, maxDias: 60,
    ramas: [{ clave: 'A', nombre: 'Sin cambio', peso: 50, control: true }, { clave: 'B', nombre: 'Con audio', peso: 50 }],
  };
  assert.deepEqual(problemasDeNuevaPrueba(ok), []);
  assert.match(problemasDeNuevaPrueba({ ...ok, nPorRama: 0 }).join(' '), /Falta el plan/);
  assert.match(problemasDeNuevaPrueba({ ...ok, claveLugar: '' }).join(' '), /Falta el lugar/);
  assert.match(problemasDeNuevaPrueba({ ...ok, metrica: 'optin' }).join(' '), /no se mide en automatizacion/);
  assert.match(problemasDeNuevaPrueba({ ...ok, ramas: [ok.ramas[0]] }).join(' '), /de 2 a 4 ramas/);
});

test('el store: el ws explícito en cada consulta, arrancar y concluir reclaman, servir relee y sin poder escribir da el control', () => {
  const st = sinComentarios(leer('lib/pruebas/store.ts'));
  assert.match(st, /^import 'server-only';/m);
  // Cada consulta a una tabla de pruebas filtra por el ws, menos las dos del cron (que traen el ws de cada fila).
  const funciones = st.split(/\nexport async function /).slice(1);
  for (const f of funciones) {
    const nombre = f.slice(0, f.indexOf('('));
    if (nombre === 'pruebasVivas' || nombre === 'vencerPropuestas') continue;
    const consultas = f.match(/\.from\('prueba[a-z_]*'\)[\s\S]*?;/g) ?? [];
    for (const q of consultas) {
      if (/\.insert\(|\.upsert\(/.test(q)) {
        // Lo que escribe lleva el ws: en el literal, o en la variable que se arma antes (`fila`, `ramas`, `filas`).
        const v = /\.(?:insert|upsert)\((\w+)[,)]/.exec(q)?.[1];
        if (v) assert.match(f, new RegExp(`const ${v}(?:: [^=]+)? = [\\s\\S]*?workspace_id: ws`), `${nombre}: escribe «${v}» sin el ws`);
        else assert.match(q, /workspace_id: ws/, `${nombre}: escribe sin el ws`);
        continue;
      }
      assert.match(q, /\.eq\('workspace_id', ws\)/, `${nombre}: consulta sin el ws: ${q.slice(0, 80)}`);
    }
  }
  const de = (n: string) => st.slice(st.indexOf(`export async function ${n}(`), st.indexOf('\nexport', st.indexOf(`export async function ${n}(`) + 10));
  assert.match(de('concluirPrueba'), /\.eq\('id', p\.id\)\.eq\('estado', 'corriendo'\)\.select\('id'\);\n\s+if \(error\) return falla\('concluirPrueba', error\);\n\s+if \(!\(data \?\? \[\]\)\.length\) return \{ ok: false, experimentoId: null \};/);
  assert.match(de('concluirPrueba'), /from\('experimentos'\)\.insert\(filaDeExperimento\(ws, p, j, iso\)\)/);
  assert.match(de('arrancarPrueba'), /\.eq\('estado', 'propuesta'\)\.select\('id'\)/);
  const servir = de('servirRama');
  assert.match(servir, /\{ onConflict: 'prueba_id,unidad', ignoreDuplicates: true \}\);\n\s+if \(error\) return control;\n\s+const escrita = await leer\(\);/);
  assert.match(servir, /if \(previa === 'error'\) return control;/);
  // La corrida no juzga con una lectura que falló.
  const corrida = sinComentarios(leer('lib/pruebas/corrida.ts'));
  const una = corrida.slice(corrida.indexOf('export async function leerUnaPrueba'));
  assert.ok(una.indexOf("if ('error' in principal) { await marcarLecturaFallida(") < una.indexOf('juzgar('), 'juzga antes de mirar si la lectura falló');
  assert.match(una, /if \('error' in principal\) \{ await marcarLecturaFallida\(ws, id, principal\.error\); return \{ id, ws, hecho: 'fallida', detalle: principal\.error \}; \}/, 'marca la falla y sigue a juzgar');
  assert.match(una, /if \('error' in c\) \{ await marcarLecturaFallida\(ws, id, c\.error\); return \{ id, ws, hecho: 'fallida', detalle: c\.error \}; \}/, 'un guardrail que falla no frena');
  assert.match(corrida, /if \(!medidor\) return \{ error: `No hay medidor para/);
  assert.match(corrida, /return runWithWorkspace\(ws, async \(\) => \{/);
  // El cron diario, agendado.
  const cron = (JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string; schedule: string }> }).crons.find((c) => c.path === '/api/cron/pruebas');
  assert.equal(cron?.schedule, '15 6 * * *');
  assert.match(leer('app/api/cron/pruebas/route.ts'), /const authFail = checkCronAuth\(request\);\n\s+if \(authFail\) return authFail;/);
});

// ROTURAS (25/10/2026, harness del scratchpad `roturas-a2.cjs`, una por vez y restaurada; base 8 / 0), cada una 7 / 1:
//   una consulta del store sin el ws · concluir sin reclamar · servir sin releer lo escrito · servir una rama que no quedó
//   registrada · la corrida juzga con una lectura fallida · «da lo mismo» es refutada · fmtVal sin «ab:» · toda refutada es
//   «probado que no funciona» · workspace_id con default 1 · el aprendizaje sin el intervalo · madura un minuto antes ·
//   una tabla fuera de TABLAS_DE_INQUILINO · los valores sin % · la tarjeta sin «A / B» · el cron sin auth.
