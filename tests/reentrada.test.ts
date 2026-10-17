// =============================================================================
// La «Reentrada» del CRON (14/10/2026, docs/diseno-mako-nada-por-detras.md §1-B y §2.4-a)
// =============================================================================
// Hasta hoy, si un lead volvía a entrar a una automatización lo decidía una regla escondida (`reusaInscripciones` =
// `preparaReunion`). Ahora es una opción del panel del CRON: «Una sola vez», «Otra vez si es otra reunión», «Cada vez
// que vuelve a entrar». Lo puro (lib/reentrada.ts, la decisión manual) se EJECUTA; el cableado del motor, la ruta y el
// panel se fijan sobre el FUENTE sin comentarios. PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reentradaDe, puedeReentrar, esReentrada, REENTRADAS } from '../lib/reentrada';
import { decidirInscripcionManual } from '../lib/nutricion-inscripcion-manual';
import { SIN_MARCAS, type FilaPrevia } from '../lib/nutricion-reinscripcion';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, ini: string, fin: string): string => {
  const i = src.indexOf(ini);
  assert.ok(i >= 0, `no encontré «${ini}»`);
  const j = src.indexOf(fin, i + ini.length);
  assert.ok(j > i, `no encontré el cierre «${fin}» después de «${ini}»`);
  return src.slice(i, j);
};

const DIA = 86_400_000;
const AHORA = Date.parse('2026-10-14T15:00:00Z');
const fila = (x: Partial<FilaPrevia> = {}): FilaPrevia => ({ estado: 'completada', desenlace: null, reunion_at: null, ...x });

// ── Lo puro ─────────────────────────────────────────────────────────────────────

test('sin guardar, la regla de antes (transitoria); guardada, la guardada', () => {
  assert.equal(reentradaDe(null, true), 'otra_reunion', 'un flujo de reunión perdía el reuso que tenía solo');
  assert.equal(reentradaDe(null, false), 'una_vez');
  assert.equal(reentradaDe('basura', true), 'otra_reunion');
  for (const r of REENTRADAS) {
    assert.equal(reentradaDe(r, true), r);
    assert.equal(reentradaDe(r, false), r);
  }
  assert.equal(esReentrada('siempre'), true);
  assert.equal(esReentrada('una vez'), false);
});

test('«Una sola vez» nunca vuelve; «Otra vez si es otra reunión» es la regla de la reunión', () => {
  const base = { marcas: SIN_MARCAS, porEvento: true };
  assert.equal(puedeReentrar('una_vez', { ...base, fila: fila(), reunionNuevaMs: AHORA + DIA }).entra, false);
  const antes = new Date(AHORA - 3 * DIA).toISOString();
  const otra = puedeReentrar('otra_reunion', { ...base, fila: fila({ reunion_at: antes }), reunionNuevaMs: AHORA + 2 * DIA });
  assert.deepEqual(otra, { entra: true, porque: 'reunion_nueva' });
  const misma = puedeReentrar('otra_reunion', { ...base, fila: fila({ reunion_at: new Date(AHORA + 2 * DIA).toISOString() }), reunionNuevaMs: AHORA + 2 * DIA });
  assert.deepEqual(misma, { entra: false, porque: 'misma_reunion' });
  assert.equal(puedeReentrar('otra_reunion', { ...base, fila: fila(), reunionNuevaMs: null }).porque, 'sin_reunion_futura');
});

test('«Cada vez que vuelve a entrar»: por evento y si terminó; nunca una cancelada, ni a mitad, ni por el barrido', () => {
  const p = (f: FilaPrevia, porEvento = true) => puedeReentrar('siempre', { fila: f, marcas: SIN_MARCAS, reunionNuevaMs: null, porEvento });
  assert.deepEqual(p(fila()), { entra: true, porque: 'vuelve_a_entrar' });
  assert.deepEqual(p(fila({ estado: 'no_responde' })), { entra: true, porque: 'vuelve_a_entrar' });
  assert.deepEqual(p(fila({ estado: 'cancelada' })), { entra: false, porque: 'cancelada' }, 'una baja volvía a recibir mensajes');
  assert.deepEqual(p(fila({ desenlace: 'cancelado' })), { entra: false, porque: 'cancelada' });
  assert.deepEqual(p(fila({ estado: 'activa' })), { entra: false, porque: 'no_termino' }, 'le reiniciaba la secuencia a mitad');
  assert.deepEqual(p(fila({ estado: 'respondio', proximo_envio_at: null })), { entra: false, porque: 'no_termino' });
  assert.deepEqual(p(fila({ estado: 'respondio', proximo_envio_at: new Date(AHORA).toISOString() })), { entra: true, porque: 'vuelve_a_entrar' });
  assert.deepEqual(p(fila(), false), { entra: false, porque: 'solo_por_evento' }, 'el barrido le mandaba todo de nuevo a quien sigue parado en la etapa');
});

test('un «Ir a» vuelve a meter a quien ya estuvo sólo si la Reentrada del destino lo deja', () => {
  const comun = {
    secuencia: { activa: true, archivada: false, pasos: 2 },
    previa: { estado: 'completada', desenlace: null },
    motor: { aTiempo: true, sinReunion: false, fueraDelResiduo: false, enLaOtraMitad: false },
    desdeFlujo: true,
  };
  assert.deepEqual(decidirInscripcionManual(comun), { inscribe: false, porque: 'ya_estuvo' });
  assert.deepEqual(decidirInscripcionManual({ ...comun, reentraDesdeFlujo: true }), { inscribe: true, como: 'reinicio' });
  // Una persona la vuelve a arrancar como siempre, con o sin la opción.
  assert.deepEqual(decidirInscripcionManual({ ...comun, desdeFlujo: false }), { inscribe: true, como: 'reinicio' });
  // Y la cancelada sigue sin volver, aunque la Reentrada diga que sí.
  assert.deepEqual(decidirInscripcionManual({ ...comun, previa: { estado: 'cancelada', desenlace: null }, reentraDesdeFlujo: true }), { inscribe: false, porque: 'cancelada' });
});

// ── El motor ────────────────────────────────────────────────────────────────────

const NUTRI = sinComentarios(leer('lib/nutricion.ts'));

test('el motor decide por la Reentrada, no por la forma del flujo', () => {
  const reusa = bloque(NUTRI, 'const reusaInscripciones = ', ';\n');
  assert.match(reusa, /reentradaDeSecuencia\(s\) !== 'una_vez' && s\.pasos\.length > 0/);
  assert.doesNotMatch(reusa, /preparaReunion\(/, 'volvió la regla escondida');
  const rd = bloque(NUTRI, 'async function reusablesDe(', '\n}\n');
  assert.match(rd, /puedeReentrar\(modo, \{ fila, marcas: marcas\.get\(fila\.id\) \?\? SIN_MARCAS, reunionNuevaMs: reunionMs, porEvento \}\)/);
  // El barrido NO es un evento; el evento sí.
  const ains = bloque(NUTRI, 'async function aInscribir(', '\n}\n');
  assert.match(ains, /reusablesDe\(db, filas, \(\) => modo, false\)/);
  const ev = bloque(NUTRI, 'export async function enrolarPorEvento(', '\n}\n');
  assert.match(ev, /reusablesDe\(supabase, previas, \(secId\) => modoSec\.get\(secId\) \?\? null, true\)/);
  assert.match(ev, /reunionAt: r\.reunionMs == null \? null : new Date\(r\.reunionMs\)\.toISOString\(\)/, '«Cada vez» sin reunión reventaba en new Date(null)');
  // Un «Ir a»: la Reentrada del destino.
  const man = bloque(NUTRI, 'export async function inscribirEnSecuencia(', '\n}\n');
  assert.match(man, /reentraDesdeFlujo,/);
  assert.match(man, /puedeReentrar\(modo, \{/);
});

test('la columna que falta no frena al motor (se lee con la 0279 y sin ella)', () => {
  const lect = bloque(NUTRI, 'async function leerFilasDeSecuencias(', '\n}\n');
  assert.match(lect, /const conReentrada = await pedir\(`\$\{COLS_SECUENCIA\}, \$\{COL_ETAPAS\}, \$\{COLS_DISPARADORES\}, \$\{COL_REENTRADA\}`\);/);
  assert.match(lect, /if \(!esColumnaInexistente\(conReentrada\.error\)\) throw/);
  assert.equal(NUTRI.match(/reentrada: esReentrada\(r\.reentrada\) \? r\.reentrada : null,/g)?.length, 2, 'una de las dos lecturas no trae la reentrada');
  const man = bloque(NUTRI, 'export async function inscribirEnSecuencia(', '\n}\n');
  assert.match(man, /if \(lecturaSec\.error && esColumnaInexistente\(lecturaSec\.error\)\) \{/, 'sin la 0279, un «Ir a» tiraba');
});

// (17/10, #846) El control vive en el panel de cada WhatsApp; sin WhatsApp, en el del CRON (tests/cron-solo-disparo.test.ts).
test('se guarda desde su panel, y el panel muestra la que el motor usa', () => {
  const set = bloque(NUTRI, 'export async function setSecuenciaReentrada(', '\n}\n');
  assert.match(set, /if \(!esReentrada\(reentrada\)\) throw/);
  const ruta = sinComentarios(leer('app/api/whatsapp/secuencias/route.ts'));
  assert.match(ruta, /if \('reentrada' in body\) await setSecuenciaReentrada\(id, body\.reentrada\);/);
  const dto = sinComentarios(leer('lib/setting-secuencias.ts'));
  assert.match(dto, /reentrada_efectiva: reentradaDeSecuencia\(s\),/);
  const perfil = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
  assert.match(perfil, /useState<Reentrada>\(secuencia\.reentrada_efectiva \?\? 'una_vez'\)/, 'el panel mostraba «Una sola vez» en un flujo que vuelve a entrar');
  assert.match(perfil, /options=\{REENTRADAS\.map\(\(r\) => \(\{ value: r, label: ROTULO_REENTRADA\[r\], icono: ICONO_REENTRADA\[r\] \}\)\)\}/);
  assert.match(perfil, /body: JSON\.stringify\(\{ id: secuencia\.id, reentrada: valor \}\)/);
});

test('la migración acota los valores a los tres', () => {
  const mig = leer('supabase/migrations/0279_reentrada_cron.sql');
  assert.match(mig, /add column if not exists reentrada text;/);
  assert.match(mig, /check \(reentrada is null or reentrada in \('una_vez', 'otra_reunion', 'siempre'\)\)/);
});

// ── ROTURAS (14/10/2026) ────────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo, restaura DE MEMORIA; nunca git). Base: 8 / 0. Cada una
// dio 7 / 1: reusar por la forma del flujo · «Cada vez» también por el barrido · «Cada vez» reabriendo una cancelada ·
// el barrido pasado como evento · la reunión nula en el evento (`new Date(null)`) · null leído como «Una sola vez» ·
// el «Ir a» sin mirar la Reentrada · la lectura sin la 0279 · el panel con la guardada en vez de la efectiva · la
// migración sin el check. Restaurado: 8 / 0.
