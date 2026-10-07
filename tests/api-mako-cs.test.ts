// =============================================================================
// api-mako · área cs — lo que MaKo lee de Customer Success (la cartera y el curso)
// =============================================================================
// Dos cosas del 06/10/2026, las dos sobre lib/api-mako/areas/cs.*:
//
//   1. `conTrabajo` no tenía call site: la cartera que lee MaKo traía `tareas_atrasadas` en
//      null para TODOS, y tres comentarios decían que «lo enchufa la página» (la página no lee
//      la cartera). Ahora lo enchufa `carteraConTrabajo`, con el tablero elegido por la CAPA
//      del workspace — por WhatsApp no hay cookie que preguntarle a `tableroActual()`.
//   2. `ver_avance_curso_cs`: el avance del curso (mig 0202) en el registro. Es una LECTURA:
//      nunca `linkDeAcceso`, que CREA la fila del acceso del cliente.
//
// El runner tiene `server-only` y no se puede importar: lo que ARMA el JSON vive en
// lib/curso-resumen.ts (puro) y se ejecuta acá con datos falsos; el cableado se mira sobre el
// fuente SIN comentarios.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFS } from '../lib/api-mako/areas/cs.def';
import { avanceDeCurso, accesoParaMako, NOTAS_CURSO, TOPE_PENDIENTES_MAKO } from '../lib/curso-resumen';
import type { Clase, EstadoTarea } from '../lib/curso';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RUN = sinComentarios(leer('lib/api-mako/areas/cs.run.ts'));

/** El cuerpo de UN runner: desde su clave hasta la clave del siguiente (o el cierre del objeto). */
function runner(id: string): string {
  const ini = RUN.indexOf(`\n  ${id}: {`);
  assert.ok(ini > 0, `no encontré el runner ${id}`);
  const sig = RUN.slice(ini + 4).search(/\n {2}[a-z][a-z0-9_]*: \{/);
  return sig < 0 ? RUN.slice(ini) : RUN.slice(ini, ini + 4 + sig);
}

// ── 1. La cartera con el trabajo del tablero ─────────────────────────────────

test('MaKo enchufa el tablero a la cartera: conTrabajo después de tableroDeLaCartera', () => {
  const fn = RUN.slice(RUN.indexOf('async function carteraConTrabajo('), RUN.indexOf('export const RUNNERS'));
  assert.match(fn, /await cartera\(\)/);
  assert.match(fn, /tableroDeLaCartera\(ganados, tableroDeCapa\(w\?\.capa\)\)/,
    'el tablero se elige por la CAPA: sin forzarlo, por WhatsApp el super-admin leería la tabla vacía');
  assert.match(fn, /conTrabajo\(base, porLead\)/);
  assert.match(fn, /tableroLeido: porLead != null/, 'un tablero caído tiene que decirse, no volverse 0');
  // Los DOS lectores de la cartera pasan por ahí; nadie más llama a cartera() pelado.
  assert.match(runner('ver_cartera_cs'), /await carteraConTrabajo\(ctx\.ws\)/);
  assert.match(runner('ver_cliente_cs'), /await carteraConTrabajo\(ctx\.ws\)/);
  assert.equal((RUN.match(/await cartera\(\)/g) ?? []).length, 1, 'una lectura de la cartera sin el tablero vuelve a traer tareas_atrasadas en null');
});

test('tableroDeLaCartera acepta qué tablero leer, y lo pasa a la lectura', () => {
  const src = sinComentarios(leer('app/customer-success/trabajo.ts'));
  const fn = src.slice(src.indexOf('export async function tableroDeLaCartera('), src.indexOf('export async function trabajoDeCliente('));
  assert.match(fn, /tableroDeLaCartera\(clientes: ClienteCruce\[\], forzado\?: QueTablero\)/);
  assert.match(fn, /leerTablero\(forzado\)/, 'sin pasarlo, la lectura vuelve a preguntarle a la cookie');
});

test('ningún comentario sigue diciendo que el tablero lo enchufa la página', () => {
  for (const f of ['lib/api-mako/areas/cs.run.ts', 'lib/cs-cartera.ts', 'lib/cs-senal.ts']) {
    assert.doesNotMatch(leer(f), /lo enchufa la P[ÁA]GINA|enchufa `conTrabajo` desde la página/i, `${f} afirma algo que no pasa`);
  }
});

// ── 2. ver_avance_curso_cs ───────────────────────────────────────────────────

test('la definición: lectura, sin HTTP (datos de personas), gateada por la tab y con leadId opcional', () => {
  const d = DEFS.find((x) => x.id === 'ver_avance_curso_cs');
  assert.ok(d, 'falta ver_avance_curso_cs en cs.def.ts');
  assert.equal(d!.tipo, 'lectura');
  assert.ok(!(d!.canales as readonly string[]).includes('http'), 'el avance de un cliente no sale por HTTP a un token de un tercero');
  assert.deepEqual(d!.gating, { tab: 'customer-success' });
  const p = d!.parametros.find((x) => x.nombre === 'leadId');
  assert.ok(p && !p.obligatorio, 'sin leadId tiene que devolver el resumen de la cartera');
});

test('el runner es una LECTURA: nunca crea el acceso ni manda nada', () => {
  const r = runner('ver_avance_curso_cs');
  assert.doesNotMatch(r, /linkDeAcceso|mandarLinkDelCurso|enviarYEspejar|emitirAviso|\.insert\(|\.upsert\(|\.update\(/,
    'una lectura de MaKo no puede abrirle una puerta a nadie ni escribirle');
  assert.doesNotMatch(RUN, /linkDeAcceso/, 'cs.run.ts no tiene por qué importar el que crea el acceso');
  assert.match(r, /accesoDe\(leadId\)/, 'el acceso se LEE con la función que no crea');
  // La entrega se lee ESTRICTA: con la versión de la pantalla, una lectura caída pone a todos
  // en la primera etapa y MaKo diría «va por Bienvenida» de alguien que va por el hito tres.
  assert.match(r, /await universoDeLaEntrega\(\)/);
  assert.match(r, /esDelProducto\(/, 'los cursos de un cliente son los de SUS productos, con la regla del kanban');
  assert.match(r, /avanceDeCurso\(\{/, 'los números salen del módulo puro, el mismo que fija este test');
});

// ── El JSON del avance, con datos falsos ─────────────────────────────────────

const clase = (id: number, etapa: string, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa, orden: id, titulo: `Clase ${id}`, descripcion: '', tipo: 'clase', minutos: null,
  videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
});
const ETAPAS = [{ key: 'bienvenida', label: 'Bienvenida' }, { key: 'norte', label: 'Norte' }];
const CLASES: Clase[] = [
  clase(1, 'bienvenida', { videoTipo: 'youtube', videoUrl: 'https://www.youtube.com/watch?v=xyz' }),
  clase(2, 'bienvenida', { videoTipo: 'drive', videoUrl: 'https://drive.google.com/file/d/ID9/view' }),
  clase(3, 'bienvenida', { tarea: 'Tu PAS', obligatoria: true, titulo: 'Tu PAS' }),
  clase(4, 'bienvenida', { tarea: 'Tus valores', titulo: 'Tus valores' }),
  clase(5, 'norte', { tarea: 'Tu meta', obligatoria: true, titulo: 'Tu meta' }),
  clase(6, 'cimientos', { tarea: 'Huérfana' }),
];
const conProgreso = (estados: Record<number, EstadoTarea>, pct: Record<number, number> = {}) => ({
  estadoDe: (id: number) => estados[id], pctDe: (id: number) => pct[id],
});

test('sin fila está en la PRIMERA etapa, con sus tareas, sus pendientes y los videos medibles', () => {
  const a = avanceDeCurso({ etapas: ETAPAS, clases: CLASES, etapaGuardada: null, ...conProgreso({ 4: 'enviada' }, { 1: 50 }) });
  assert.deepEqual(a.etapa_actual, { clave: 'bienvenida', nombre: 'Bienvenida' });
  assert.equal(a.etapa_huerfana, null);
  assert.deepEqual(a.tareas_de_la_etapa, { enviadas: 1, total: 2, obligatorias: 1, obligatorias_enviadas: 0 });
  assert.equal(a.etapa_completa, false, 'le falta la obligatoria');
  assert.deepEqual(a.pendientes, ['Tu PAS']);
  // El de Drive no entra al promedio: va en sin_medir, y el % es sobre el de YouTube.
  assert.deepEqual(a.videos_de_la_etapa, { pct_visto: 50, medibles: 1, sin_medir: 1 });
  assert.equal(a.clases, 6);
  assert.equal(a.clases_sin_etapa, 1, 'la clase de una etapa borrada se cuenta aparte');
  assert.deepEqual(a.etapas.map((e) => e.clave), ['bienvenida', 'norte']);
});

test('con fila, está donde dice su fila; y completa = TODAS las obligatorias enviadas', () => {
  const a = avanceDeCurso({ etapas: ETAPAS, clases: CLASES, etapaGuardada: 'norte', ...conProgreso({ 5: 'aprobada' }) });
  assert.deepEqual(a.etapa_actual, { clave: 'norte', nombre: 'Norte' });
  assert.equal(a.etapa_completa, true);
  assert.deepEqual(a.pendientes, []);
  assert.deepEqual(a.videos_de_la_etapa, { pct_visto: null, medibles: 0, sin_medir: 0 }, 'sin videos medibles, null y no 0');
});

test('una fila con una etapa borrada NO cae en la primera: se dice cuál era', () => {
  const a = avanceDeCurso({ etapas: ETAPAS, clases: CLASES, etapaGuardada: 'cimientos', ...conProgreso({}) });
  assert.equal(a.etapa_actual, null);
  assert.equal(a.etapa_huerfana, 'cimientos');
  assert.equal(a.etapa_completa, null);
  assert.equal(a.tareas_de_la_etapa, null);
});

test('los pendientes viajan con tope, y el total aparte', () => {
  const muchas = Array.from({ length: TOPE_PENDIENTES_MAKO + 3 }, (_, i) => clase(100 + i, 'bienvenida', { tarea: 'x', titulo: `T${i}` }));
  const a = avanceDeCurso({ etapas: ETAPAS, clases: muchas, etapaGuardada: null, ...conProgreso({}) });
  assert.equal(a.pendientes.length, TOPE_PENDIENTES_MAKO);
  assert.equal(a.pendientes_total, TOPE_PENDIENTES_MAKO + 3);
});

test('el acceso: sin fila es «sin-link», cortado es cortado, y la invitación por mail se distingue', () => {
  assert.deepEqual(accesoParaMako(null), { estado: 'sin-link', ingresos: 0, ultimo_ingreso: null, invitado_por_mail: false, invitado_el: null });
  assert.equal(accesoParaMako({ revocado: true, ingresos: 3, ultimoIngresoAt: null, invitacionEnviadaAt: null }).estado, 'cortado');
  const inv = accesoParaMako({ revocado: false, ingresos: 2, ultimoIngresoAt: '2026-10-06T10:00:00Z', invitacionEnviadaAt: '2026-10-05T10:00:00Z' });
  assert.equal(inv.estado, 'activo');
  assert.equal(inv.invitado_por_mail, true);
  assert.equal(inv.ultimo_ingreso, '2026-10-06T10:00:00Z');
});

test('las notas viajan con cada lectura y dicen lo que el 0 no puede afirmar', () => {
  const todo = NOTAS_CURSO.join(' ');
  assert.match(todo, /sin_medir/);
  assert.match(todo, /pct_visto null/);
  assert.match(todo, /PRIMERA etapa/);
  assert.match(todo, /no crea el acceso/);
  // Español neutro: lo lee un modelo que después le habla al dueño.
  assert.doesNotMatch(todo, /(?<!\p{L})(fijate|mirá|tenés|podés|decí)(?!\p{L})/iu);
  assert.match(runner('ver_avance_curso_cs'), /notas: NOTAS_CURSO/);
});

// PROBADO ROMPIÉNDOLO (06/10/2026), corrido junto con tests/api-mako-registro.test.ts: baseline
// 31 pass / 0 fail. Cada rotura de a una, restaurada de memoria en un `finally`:
//   1. `carteraConTrabajo` devolviendo la cartera sin `conTrabajo` → 30/1.
//   2. `tableroDeLaCartera(ganados)` sin el tablero por capa → 30/1.
//   3. `ver_cliente_cs` leyendo `cartera()` pelada → 30/1.
//   4. `leerTablero()` sin el `forzado` en trabajo.ts → 30/1.
//   5. el runner llamando a `linkDeAcceso` antes de leer el acceso → 30/1.
//   6. sin fila → ninguna etapa (no la primera) → 29/2.
//   7. la etapa huérfana cayendo en la primera → 30/1.
//   8. `pct_visto` null convertido en 0 → 30/1.
//   9. el acceso cortado leído como activo → 30/1.
//   10. `leadId` obligatorio en la def → 30/1.
//   11. la clave del runner renombrada → 28/3, uno de ellos el de registro (def sin runner).
