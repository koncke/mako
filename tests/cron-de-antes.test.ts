// =============================================================================
// Décima tanda, CRON 2 (11/10/2026): los CRON «de antes» — el panel (fase 0) y la migración en simulacro
// =============================================================================
// Pedido literal de Martín: «Sospecho que muchas tarjetas quedaron viejas, de versiones anteriores... Y por eso
// salen bugs como que al editar el segundo paso no me aparece ningún desplegable... O que no se selecciona los
// pasos que elegí. Revisa eso. Siempre que se hacen modificaciones las automatizaciones ya creadas deben
// acompañar eso. Nunca nada debe quedar en una versión vieja...». El diseño, con lo medido, en
// docs/diseno-automations-configuraciones.md §4. Lo que fija este test:
//   · FASE 0 (el panel, sin tocar datos): un CRON que arranca por un evento del catálogo que ya no se ofrece
//     (`esEventoDeAntes`) es «Producto», abre el desplegable de las etapas con lo puesto en el botón,
//     marcado «(de antes)», y elegir una etapa lo reemplaza. Los del EMISOR (el recordatorio, un evento de
//     MaKo) no son de antes.
//   · LA PROPUESTA (`propuestaCronDeAntes`, lib/cron-de-antes.ts): «Cualquier etapa» del mismo embudo + una
//     CONDITION de entrada armada con filas del catálogo, AL FINAL del array (no corre el `paso_actual` de
//     nadie), con un id que la historia no usó, y `validarGrafo` sin errores.
//   · EL SCRIPT (scripts/migrar-cron-de-antes.mts): sólo lee (transacción `read only`), y `--aplicar` se
//     niega hasta la fase 1 del motor, antes de leer el .env.
//
// Probado ROMPIÉNDOLO (arnés `viejas-roturas.mjs` del scratchpad, restaurado de memoria con md5 igual), base
// 9/0 y cada rotura sola:
//   R1. `esEventoDeAntes` sin excluir los del emisor → 7/2 (qué es de antes; la clase y la marca del recordatorio).
//   R2. la entrada al PRINCIPIO del array             → 7/2 (los índices de antes, en los dos tests de la propuesta).
// Y la propuesta sobre una LISTA de antes (arnés `viejas-roturas3.mjs`, la retomada), base 10/0:
//   R10. lo de hoy crudo, sin escribir sus flechas     → 9/1 (el círculo: el último mensaje seguía por la entrada).
//   R11. la lista sin convertir (`abrirFlujo`)          → 9/1 (las esperas de antes no pasan a tarjetas).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  esEventoDeAntes, claseDeDisparador, iconoDeDisparador, textoDeDisparador, disparadoresDe, conDisparo, disparoActualDe,
  MARCA_DE_ANTES, type Disparador,
} from '../lib/disparadores';
import { valoresTrasTocar, valorDeVarios, disparoDeValor } from '../lib/flujo-conversacion';
import { propuestaCronDeAntes, ENTRADA_DE_ANTES, CUALQUIER_ETAPA } from '../lib/cron-de-antes';
import { problemaDeFila } from '../lib/condiciones-catalogo';
import { validarGrafo, antiguedadDeEntrada, type PasoGrafo } from '../lib/flujo-grafo';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const d = (trigger_tipo: string, extra: Partial<Disparador> = {}): Disparador => ({ id: 'd1', trigger_tipo, ...extra } as Disparador);
const msg = (id: string, siguiente: string | null): PasoGrafo =>
  ({ id, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: `Hola ${id}`, template_wa: null, siguiente } as PasoGrafo);

// ── Fase 0: qué es de antes y cómo se dibuja ────────────────────────────────────────────────────

const DE_ANTES = ['instant_form_sin_agenda', 'agendado_sin_confirmar', 'agendado_primer_contacto', 'agendado_ya_contactado',
  'no_show_j1', 'vio_vsl_sin_agendar', 'post_pago', 'reactivacion_viejo', 'residuo_sin_cierre'];
const DE_HOY = ['etapa_actual', 'entrega_actual', 'etiqueta_puesta', 'etiqueta_agregada', 'etiqueta_quitada', 'instagram',
  'messenger', 'email_recibido', 'grupo_mako'];

test('un evento del catálogo que ya no se ofrece es «de antes»; las seis de hoy, los del emisor y «a mano», no', () => {
  for (const t of DE_ANTES) assert.equal(esEventoDeAntes(d(t)), true, t);
  for (const t of DE_HOY) assert.equal(esEventoDeAntes(d(t)), false, t);
  assert.equal(esEventoDeAntes(d('reunion_recordatorio')), false, 'el recordatorio es de OTRO motor (su emisor), no de antes');
  assert.equal(esEventoDeAntes(d('aviso_mako')), false, 'un evento de MaKo tampoco');
  assert.equal(esEventoDeAntes(d('manual')), false);
  assert.equal(esEventoDeAntes(d('instant_form_sin_agenda', { cron: { unidad: 'dia', cada: 1, hora: 9, minuto: 0 } as never })), false,
    'con horario es un Recurrente');
});

test('fase 0: un evento de antes es «Producto» (con su ícono) y se dice marcado «(de antes)»', () => {
  assert.equal(claseDeDisparador(d('instant_form_sin_agenda')), 'producto', 'era `otro`: el paso 2 salía como texto, sin desplegable');
  assert.equal(iconoDeDisparador(d('no_show_j1')), 'producto');
  assert.equal(claseDeDisparador(d('reunion_recordatorio')), 'otro', 'el del emisor se dice como es, sin editor');
  const n = { deSiempre: (x: Disparador) => `«${x.trigger_tipo}»`, tz: null };
  assert.equal(textoDeDisparador(d('instant_form_sin_agenda'), n), `«instant_form_sin_agenda» ${MARCA_DE_ANTES}`);
  assert.equal(textoDeDisparador(d('reunion_recordatorio'), n), '«reunion_recordatorio»', 'el recordatorio no es de antes');
  assert.equal(textoDeDisparador(d('etapa_actual', { etapa: 'nuevo' }), n), '«etapa_actual»');
});

test('fase 0: elegir una etapa sobre un evento de antes lo REEMPLAZA (no se suma ni queda a medias)', () => {
  const viejo = d('agendado_sin_confirmar', { funnel_id: 5 });
  // Lo que hace `tocarEtapa` (EditorDisparadores): sin etapas puestas arranca de cero con la tocada.
  const valores = valoresTrasTocar([], 'venta:5:agendado');
  assert.deepEqual(valores, ['venta:5:agendado']);
  const nuevo = conDisparo(viejo, disparoDeValor(valorDeVarios(valores), disparoActualDe(viejo)));
  assert.equal(nuevo.trigger_tipo, 'etapa_actual');
  assert.equal(nuevo.etapa, 'agendado');
  assert.equal(nuevo.funnel_id, 5);
  assert.equal(nuevo.id, viejo.id, 'el mismo CRON, no uno nuevo');
  assert.equal(esEventoDeAntes(nuevo), false);
});

test('fase 0, el editor: el desplegable de Producto abre con el evento de antes en el botón, marcado', () => {
  const src = sinComentarios(leer('app/automations/EditorDisparadores.tsx'));
  const ini = src.indexOf("if (clase === 'producto') {");
  const bloque = src.slice(ini, src.indexOf("if (clase === 'etiqueta') {", ini));
  assert.ok(ini > 0 && bloque.length < 2000, 'no encontré el editor de Producto');
  assert.match(bloque, /const valor = d\.trigger_tipo === 'etapa_actual' \|\| d\.trigger_tipo === 'entrega_actual' \|\| esEventoDeAntes\(d\) \? valorDisparo\(actual\) : '';/,
    'sin el evento de antes, el botón dice «Elige la etapa» sobre un CRON que sí tiene algo puesto');
  assert.match(bloque, /botonLabel=\{valor \? rotuloDisparo\(conRaiz, valor, textos\.texto\(d\)\) : 'Elige la etapa'\}/,
    'el botón dice lo puesto con la marca «(de antes)» (`textos.texto`), no `deSiempre`');
  // Y tocar una etapa no suma a un evento de antes: arranca de cero (ver el test de arriba).
  assert.match(src, /valoresTrasTocar\(d\.trigger_tipo === 'etapa_actual' \|\| d\.trigger_tipo === 'entrega_actual' \? valoresDisparo\(actual\) : \[\], tocado\)/);
});

// ── La propuesta ─────────────────────────────────────────────────────────────────────────────

test('la propuesta: «Cualquier etapa» del mismo embudo + la entrada AL FINAL, apuntada por el CRON', () => {
  const pasos = [msg('a', 'b'), msg('b', null)];
  const pr = propuestaCronDeAntes({ trigger_tipo: 'instant_form_sin_agenda', etapa: 'nuevo', funnel_id: 5, pasos }, { rnd: () => 0.5 });
  assert.equal(pr.estado, 'propuesta');
  if (pr.estado !== 'propuesta') return;
  assert.deepEqual(pr.eventos, ['instant_form_sin_agenda']);
  assert.deepEqual(pr.disparadores, [{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: CUALQUIER_ETAPA, etapas: null, funnel_id: 5 }]);
  // ⚠️ Los pasos de hoy, TAL CUAL y en sus índices: `paso_actual` es un índice del array.
  assert.deepEqual(pr.pasos.slice(0, pasos.length), pasos, 'la entrada corrió los índices de las inscripciones vivas');
  const entrada = pr.pasos.find((p) => p.id === pr.entrada.id)!;
  assert.equal(pr.pasos.indexOf(entrada), pr.pasos.length - 1, 'la entrada va al final');
  assert.equal(entrada.nodo, 'condicion');
  assert.equal(entrada.si_no, null, '«Si no» termina: el que no cumple no entra');
  assert.equal(entrada.ramas?.[0].siguiente, 'a', 'el que cumple sigue por lo de siempre');
  assert.equal(pr.pasos.find((p) => p.nodo === 'inicio')?.siguiente, pr.entrada.id, 'el CRON apunta a la entrada');
  assert.deepEqual(pr.errores, [], 'Publicar no la frenaría');
  assert.deepEqual(validarGrafo(pr.pasos), []);
  assert.equal(pr.antiguedad, 720, 'el motor de HOY ya mira la antigüedad al inscribir');
  assert.equal(antiguedadDeEntrada(pr.pasos), 720);
});

test('la propuesta: un flujo con CRON dibujado conserva su nodo; el id nuevo no reusa uno que la historia vio', () => {
  const pasos = [msg('a', null), { id: 'entrada', nodo: 'inicio', siguiente: 'a' } as PasoGrafo];
  const sin = propuestaCronDeAntes({ trigger_tipo: 'no_show_j1', etapa: 'x', pasos }, { rnd: () => 0.5 });
  assert.equal(sin.estado, 'propuesta');
  if (sin.estado !== 'propuesta') return;
  assert.equal(sin.pasos.length, pasos.length + 1, 'sólo se agrega la entrada');
  assert.deepEqual(sin.pasos[0], pasos[0]);
  const con = propuestaCronDeAntes({ trigger_tipo: 'no_show_j1', etapa: 'x', pasos }, { rnd: () => 0.5, usados: [sin.entrada.id] });
  assert.equal(con.estado, 'propuesta');
  if (con.estado !== 'propuesta') return;
  assert.notEqual(con.entrada.id, sin.entrada.id, 'una inscripción vieja con ese nodo seguiría por la tarjeta nueva');
  assert.ok(sin.falta.length > 0, 'lo que no es 1:1 se dice (la ventana de 45 días del no-show)');
});

test('la propuesta sobre una LISTA de antes: sin flechas escritas no arma un círculo; con algo de antes, se convierte', () => {
  // La forma de las archivadas (medido con `--todas` el 11/10/2026): ids `o<i>` y SIN `siguiente`. Con la entrada
  // agregada abajo, el último mensaje seguía por ella y ella por el primero: 24 de 32 daban «vuelve atrás».
  const lista = [0, 1, 2].map((i) => ({ id: `o${i}`, canal: 'whatsapp', delay_horas: i ? 24 : 0, asunto: null, cuerpo: `Hola ${i}`, template_wa: null } as PasoGrafo));
  const pr = propuestaCronDeAntes({ trigger_tipo: 'agendado_sin_confirmar', etapa: 'x', pasos: lista }, { rnd: () => 0.5 });
  assert.equal(pr.estado, 'propuesta');
  if (pr.estado !== 'propuesta') return;
  assert.deepEqual(pr.errores, [], 'la entrada, abajo de una lista sin flechas escritas, cerraba un círculo');
  assert.equal(pr.convertida, true, 'con esperas de antes (`delay_horas`) se convierte como al abrirla en el lienzo');
  assert.equal(pr.pasos.filter((p) => p.nodo === 'esperar').length, 2, 'las dos esperas pasan a tarjetas');
  assert.equal(pr.pasos[pr.pasos.length - 1].id, pr.entrada.id, 'la entrada sigue yendo al final');
  // Sin nada de antes, la misma lista sale normalizada (sus flechas, escritas) y NO convertida: sus índices no cambian.
  const lineal = lista.map((p) => ({ ...p, delay_horas: 0 }));
  const pl = propuestaCronDeAntes({ trigger_tipo: 'agendado_sin_confirmar', etapa: 'x', pasos: lineal }, { rnd: () => 0.5 });
  assert.equal(pl.estado, 'propuesta');
  if (pl.estado !== 'propuesta') return;
  assert.deepEqual(pl.errores, []);
  assert.equal(pl.convertida, false);
  assert.deepEqual(pl.pasos.slice(0, 3).map((p) => p.id), ['o0', 'o1', 'o2'], 'los índices de hoy, en su lugar');
  assert.equal(pl.pasos[2].siguiente, null, 'el último mensaje termina; no sigue por la entrada');
});

test('sin propuesta: otro CRON al lado, un evento sin mapa, hilos en paralelo, o entradas distintas', () => {
  const pasos = [msg('a', null)];
  const fila = (disparadores: unknown[], extra: Record<string, unknown> = {}) =>
    ({ trigger_tipo: (disparadores[0] as Disparador).trigger_tipo, etapa: 'x', pasos, disparadores, ...extra });
  const motivo = (pr: ReturnType<typeof propuestaCronDeAntes>) => (pr.estado === 'sin_propuesta' ? pr.motivo : `(${pr.estado})`);
  const conEtiqueta = propuestaCronDeAntes(fila([d('instant_form_sin_agenda'), { id: 'd2', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 3 }]));
  assert.match(motivo(conEtiqueta), /otros CRON/, 'la entrada frenaría también a lo que entra por la etiqueta');
  assert.match(motivo(propuestaCronDeAntes({ trigger_tipo: 'post_pago', etapa: 'x', pasos })), /sin mapa: post_pago/);
  const paralelo = [msg('a', null), msg('b', null), { id: 'entrada', nodo: 'inicio', siguiente: 'a', paralelos: ['b'] } as PasoGrafo];
  assert.match(motivo(propuestaCronDeAntes({ trigger_tipo: 'instant_form_sin_agenda', etapa: 'x', pasos: paralelo })), /paralelo/,
    'la entrada frenaría sólo uno de los hilos');
  const distintas = propuestaCronDeAntes(fila([d('instant_form_sin_agenda'), { id: 'd2', trigger_tipo: 'no_show_j1' }]));
  assert.match(motivo(distintas), /entradas distintas/);
  assert.equal(propuestaCronDeAntes({ trigger_tipo: 'etapa_actual', etapa: 'x', pasos }).estado, 'nada');
});

test('cada entrada del mapa es de un evento de antes y se arma con filas que el catálogo acepta', () => {
  for (const [t, e] of Object.entries(ENTRADA_DE_ANTES)) {
    assert.equal(esEventoDeAntes(d(t)), true, t);
    assert.ok(e.filas.length > 0, t);
    for (const f of e.filas) assert.equal(problemaDeFila(f), null, `${t}: ${JSON.stringify(f)}`);
  }
});

// ── El script ─────────────────────────────────────────────────────────────────────────────────

test('el script sólo LEE, y su `--aplicar` se niega antes de leer el .env', () => {
  const src = sinComentarios(leer('scripts/migrar-cron-de-antes.mts'));
  assert.match(src, /await sql\.begin\('read only', async \(tx\) => \{/, 'la transacción read only es la que asegura que no escribe');
  assert.doesNotMatch(src, /\b(insert\s+into|update\s+\w+\s+set|delete\s+from|upsert)\b/i, 'el simulacro escribe');
  assert.ok(src.indexOf("process.argv.includes('--aplicar')") < src.indexOf('config({'), 'se niega antes de leer el .env');
  // Cada evento con mapa tiene su cohorte de antes transcripta (si no, el simulacro no puede medir).
  const cohorte = src.slice(src.indexOf('const COHORTE_DE_ANTES'), src.indexOf('const sinCohorte'));
  for (const t of Object.keys(ENTRADA_DE_ANTES)) assert.match(cohorte, new RegExp(`\\b${t}:`), `${t} sin cohorte transcripta`);
  let codigo = 0;
  let err = '';
  try {
    execFileSync(process.execPath, ['--import', 'tsx', join(RAIZ, 'scripts/migrar-cron-de-antes.mts'), '--aplicar', '--env=no-existe.env'],
      { cwd: RAIZ, stdio: 'pipe', timeout: 60_000 });
  } catch (e) {
    codigo = (e as { status?: number }).status ?? -1;
    err = String((e as { stderr?: Buffer }).stderr ?? '');
  }
  assert.equal(codigo, 1, 'con --aplicar tiene que salir con 1');
  assert.match(err, /--aplicar se niega/);
});
