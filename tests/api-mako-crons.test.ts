// =============================================================================
// `cambiar_crons_secuencia`: los CRON de una automatización, por la API de MaKo
// =============================================================================
// Sexta tanda (09/10/2026), segunda pasada, parte «motor». Hasta acá la API LEÍA los CRON
// (`ficha_secuencia_mensajes` trae `disparadores`) y no había cómo cambiarlos sin la pantalla. Lo que
// fija este archivo:
//   · es de PANTALLA, del admin y SIN http (cambia a quién le escribe; exponerlo a un token es otra
//     decisión, la del snapshot);
//   · lo que llega por la API pasa por el MISMO saneador que lo de la pantalla: `ignorar` y `cron.dias`
//     viajan como textos (el validador no tiene listas de números) y salen como números;
//   · `preparar()` chequea todo lo que se puede saber sin escribir (`prepararDisparadores`), y guarda por
//     la MISMA puerta que la pantalla (`guardarDisparadores`).
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { porId } from '../lib/api-mako/registro';
import { validarInput } from '../lib/api-mako/validar';
import { esAccion } from '../lib/api-mako/tipos';
import { sanearDisparadores, TOPE_DISPARADORES } from '../lib/disparadores';
import { UNIDADES } from '../lib/cron-aviso';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const DEF = porId('cambiar_crons_secuencia');

test('es una acción de PANTALLA, del admin y sin HTTP', () => {
  assert.ok(DEF && esAccion(DEF), 'no está en el registro');
  assert.equal(DEF.confirmacion, 'pantalla', 'cambia a quién le escribe: no se confirma con un «sí» por chat');
  assert.equal(DEF.gating?.rolMinimo, 'admin');
  assert.ok(!DEF.canales.includes('http'), 'exponerlo por HTTP es una decisión del snapshot');
  assert.equal(DEF.reversible, false, 'en una activa, la próxima corrida le escribe a la cohorte nueva: un mensaje no se deshace');
  // Los topes son los del modelo.
  const crons = DEF.parametros.find((p) => p.nombre === 'crons')!;
  assert.equal(crons.max, TOPE_DISPARADORES);
  const cron = crons.campos!.find((p) => p.nombre === 'cron')!;
  assert.deepEqual([...(cron.campos!.find((p) => p.nombre === 'unidad')!.enum ?? [])], UNIDADES.map((u) => u.key));
});

test('lo que llega por la API sale del MISMO saneador que lo de la pantalla (los textos vuelven números)', () => {
  const r = validarInput(DEF!.parametros, {
    secuenciaId: 5,
    crons: [
      { id: 'd1', trigger_tipo: 'etiqueta_agregada', ignorar: ['12', '15'] },
      { trigger_tipo: 'etapa_actual', etapa: 'agenda', funnel_id: 3, cron: { unidad: 'semana', dias: ['2', '4'], hora: 10 } },
    ],
  }, 'json');
  assert.ok('input' in r, 'error' in r ? r.error : '');
  const lista = sanearDisparadores((r as { input: Record<string, unknown> }).input.crons);
  assert.deepEqual(lista[0], { id: 'd1', trigger_tipo: 'etiqueta_agregada', ignorar: [12, 15] });
  assert.deepEqual(lista[1].cron, { unidad: 'semana', cada: 1, hora: 10, minuto: 0, diaSemana: 2, dias: [2, 4] });
  assert.equal(lista[1].funnel_id, 3);
  // Lo que la def no declara (la próxima ocurrencia, que la calcula quien guarda) no pasa.
  const conProxima = validarInput(DEF!.parametros, { secuenciaId: 5, crons: [{ trigger_tipo: 'etapa_actual', etapa: 'x', cron_proxima_at: '2020-01-01T00:00:00Z' }] }, 'json');
  assert.ok('input' in conProxima);
  assert.equal(((conProxima as { input: { crons: Array<Record<string, unknown>> } }).input.crons[0]).cron_proxima_at, undefined);
});

test('el runner chequea en preparar() y guarda por la puerta de la pantalla', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  const i = run.indexOf('  cambiar_crons_secuencia: {');
  const r = run.slice(i, run.indexOf('\n  agregar_escenario_secuencia: {', i));
  assert.ok(i > 0 && r.length < 2500, `el recorte mide ${r.length}`);
  const prep = r.slice(r.indexOf('preparar:'), r.indexOf('ejecutar:'));
  assert.match(prep, /await prepararDisparadores\(id, input\.crons\)/, 'preparar() no chequea contra el negocio: el rechazo llegaría al confirmar, con la pendiente consumida');
  assert.match(prep, /yaEstaba: true/, '«ya está así» no es un fallo para un flujo ni para un token');
  assert.doesNotMatch(prep, /guardarDisparadores|tzDeWorkspace/, 'preparar() no escribe (y tzDeWorkspace escribe la zona si falta)');
  assert.match(r.slice(r.indexOf('ejecutar:')), /await guardarDisparadores\(id, payload\.crons\)/);
  // Y `prepararDisparadores` hace lo mismo que el guardado, sin escribir.
  const g = sinComentarios(leer('lib/disparadores-guardar.ts'));
  const p = g.slice(g.indexOf('export async function prepararDisparadores('), g.indexOf('export async function guardarDisparadores('));
  assert.match(p, /const lista = listaValida\(entrada\);/);
  assert.match(p, /await validarContraElNegocio\(nuevosOCambiados\(lista, previos\)\);/);
  assert.doesNotMatch(p, /\.update\(|\.insert\(|\.upsert\(/, 'prepararDisparadores escribe');
});

// ── ROTURAS (09/10/2026) ───────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo, restaura DE MEMORIA con md5; nunca git).
// Base: 3 / 0. Las cuatro, 2 / 1: la def con `confirmacion: 'chat'` · `preparar()` sin
// `prepararDisparadores` (sólo el saneador) · la def sin `cron.dias` (el validador los tira) ·
// `prepararDisparadores` con un `.update(` adentro. Restaurado: 3 / 0.
